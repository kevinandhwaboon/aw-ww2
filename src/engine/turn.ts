// The start-of-turn sequence (04-economy §2), in the doc's order.

import { arriveUnits, sendRaidersHome } from "./arrivals";
import type { GameEvent } from "./commands";
import { unitDef } from "./data/units";
import { clearAbandonedCaptures, servicesUnit } from "./economy";
import { displayHp, MAX_HP, type GameState, type Unit } from "./state";
import * as stats from "./stats";
import { applySupply, besideSupplyShip, supplyTargets } from "./transport";

/** Displayed HP repaired per turn on a property (04-economy §5). */
export const REPAIR_HP = 2;

/** Displayed HP repaired per turn for an aircraft aboard a Carrier (05-supply-transport §10). */
export const CARRIER_REPAIR_HP = 1;

/** Displayed HP repaired per turn for a ship next to its own Supply Ship (05-supply-transport §3a). */
export const SUPPLY_SHIP_REPAIR_HP = 1;

/** The player's units and their passengers are ready again; Carriers may move or launch again. */
function readyUp(unit: Unit): Unit {
  const ready: Unit = { ...unit, hasActed: false, cargo: unit.cargo.map((c) => (c.hasActed ? { ...c, hasActed: false } : c)) };
  delete (ready as { launched?: true }).launched;
  return ready;
}

/**
 * Runs the start of state.currentPlayer's turn: raiders due home leave first (23-survival §5c), then
 * the doc's sequence, then any units due to arrive (23-survival §5a).
 */
export function startTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [{ type: "turnStarted", player: state.currentPlayer, day: state.day }];
  const afterRaids = sendRaidersHome(state, events);
  const afterFuel = burnFuel(afterRaids, events);
  const afterIncome = collectIncome(afterFuel, events);
  const afterRepairs = repairAndResupply(afterIncome, events);
  const afterSupply = supplyRound(afterRepairs, events);
  const player = state.currentPlayer;
  const ready = { ...afterSupply, units: afterSupply.units.map((u) => (u.owner === player ? readyUp(u) : u)) };
  // Arrivals come last, so they aren't ready to act until this player's next turn (23-survival §5a).
  return { state: arriveUnits(ready, events), events };
}

/** Whether a unit stands on its own or an ally's property that repairs and resupplies its category (04-economy §5). */
function isServiced(state: GameState, unit: Unit): boolean {
  return servicesUnit(state, unit.pos, unit);
}

/**
 * Air and naval units burn fuel every turn (05-supply-transport §5, §7). Not on day 1, and not on a
 * property that services them, which refuels them anyway. An aircraft whose tank runs dry crashes; a
 * ship stays afloat but stranded, and a submerged submarine surfaces.
 */
function burnFuel(state: GameState, events: GameEvent[]): GameState {
  if (state.day === 1) return state;
  const units: Unit[] = [];
  for (const unit of state.units) {
    const burn = unit.owner === state.currentPlayer && !isServiced(state, unit) ? stats.fuelPerDay(state, unit) : 0;
    const fuel = Math.max(0, unit.fuel - burn);
    if (burn === 0) {
      units.push(unit);
    } else if (fuel > 0) {
      units.push({ ...unit, fuel });
    } else if (unitDef(unit.type).category === "air") {
      events.push({ type: "unitOutOfFuel", unitId: unit.id, unitType: unit.type, owner: unit.owner, pos: unit.pos });
    } else {
      const surfacing = unit.submerged === true;
      if (surfacing) events.push({ type: "unitSurfaced", unitId: unit.id });
      if (unit.fuel > 0) events.push({ type: "unitStranded", unitId: unit.id, pos: unit.pos });
      units.push({ ...unit, fuel, ...(surfacing ? { submerged: false } : {}) });
    }
  }
  return clearAbandonedCaptures({ ...state, units });
}

/**
 * Each of the player's supply units refills adjacent friendly units (05-supply-transport §3, §3a). A
 * Supply Ship spends one of its loads if it tops anyone up, and with none left does nothing (§3b).
 */
function supplyRound(state: GameState, events: GameEvent[]): GameState {
  let current = state;
  for (const { id } of state.units.filter((u) => u.owner === state.currentPlayer)) {
    const supplier = current.units.find((u) => u.id === id);
    if (!supplier) continue;
    const supplied = applySupply(current, supplier, supplyTargets(current, supplier));
    current = supplied.state;
    events.push(...supplied.events);
  }
  return current;
}

function setFunds(state: GameState, funds: number): GameState {
  return { ...state, players: state.players.map((p) => (p.id === state.currentPlayer ? { ...p, funds } : p)) };
}

function collectIncome(state: GameState, events: GameEvent[]): GameState {
  const player = state.players[state.currentPlayer];
  const amount = stats.propertyIncome(state, state.currentPlayer);
  if (!player || amount === 0) return state;
  const funds = player.funds + amount;
  events.push({ type: "incomeReceived", player: player.id, amount, funds });
  return setFunds(state, funds);
}

const carries = (unit: Unit) => unitDef(unit.type).specialActions.includes("launch") && unit.cargo.length > 0;

/**
 * Units on owned properties of the right category heal and resupply, and so do aircraft aboard a
 * Carrier, by less (05-supply-transport §10). Ships next to their own Supply Ship are repaired here
 * too; their fuel and ammo come from the Supply Ship's own round, which spends its loads (§3a, §3b).
 * Runs in row-major order, a Carrier before its aircraft, so when funds run short they run out the
 * same way every time (04-economy §5). A ship in port that also lies next to a Supply Ship gets the
 * port's repair only.
 */
function repairAndResupply(state: GameState, events: GameEvent[]): GameState {
  const player = state.players[state.currentPlayer];
  if (!player) return state;
  let funds = player.funds;
  const updated = new Map<number, Unit>();

  /** Repairs up to `most` displayed HP, as far as funds allow, and (unless told not to) refills fuel and ammo. */
  const service = (unit: Unit, most: number, refill = true): Unit => {
    const costPerHp = Math.floor(stats.unitCost(state, player.id, unit.type) / 10);
    const wanted = Math.min(most, 10 - displayHp(unit.hp));
    const affordable = costPerHp === 0 ? wanted : Math.floor(funds / costPerHp);
    const healed = Math.min(wanted, affordable);
    const fuel = stats.maxFuel(state, unit);
    const ammo = stats.maxAmmo(state, unit);
    const resupplied = refill && (unit.fuel < fuel || unit.ammo < ammo);
    if (healed > 0) {
      const cost = healed * costPerHp;
      funds -= cost;
      events.push({ type: "unitRepaired", unitId: unit.id, hp: healed, cost });
    }
    if (resupplied) events.push({ type: "unitResupplied", unitId: unit.id });
    if (healed === 0 && !resupplied) return unit;
    const repaired = { ...unit, hp: Math.min(MAX_HP, unit.hp + healed * 10) };
    return resupplied ? { ...repaired, fuel, ammo } : repaired;
  };

  const served = state.units
    .filter((u) => u.owner === player.id && (isServiced(state, u) || carries(u) || besideSupplyShip(state, u)))
    .sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x);

  for (const unit of served) {
    const self = isServiced(state, unit)
      ? service(unit, stats.repairHp(state, unit, REPAIR_HP))
      : besideSupplyShip(state, unit)
        ? service(unit, SUPPLY_SHIP_REPAIR_HP, false)
        : unit;
    const after = carries(self) ? { ...self, cargo: self.cargo.map((c) => service(c, CARRIER_REPAIR_HP)) } : self;
    if (after !== unit) updated.set(unit.id, after);
  }

  return setFunds({ ...state, units: state.units.map((u) => updated.get(u.id) ?? u) }, funds);
}
