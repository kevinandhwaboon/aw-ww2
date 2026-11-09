// The start-of-turn sequence (04-economy §2), in the doc's order.

import type { GameEvent } from "./commands";
import { UNITS, unitDef } from "./data/units";
import { clearAbandonedCaptures, propertyDefAt } from "./economy";
import { displayHp, MAX_HP, propertyAt, type GameState, type Unit } from "./state";
import * as stats from "./stats";
import { applySupply, supplyTargets } from "./transport";

/** Displayed HP repaired per turn on a property (04-economy §5). */
export const REPAIR_HP = 2;

/** Displayed HP repaired per turn for an aircraft aboard a Carrier (05-supply-transport §10). */
export const CARRIER_REPAIR_HP = 1;

/** The player's units and their passengers are ready again; Carriers may move or launch again. */
function readyUp(unit: Unit): Unit {
  const ready: Unit = { ...unit, hasActed: false, cargo: unit.cargo.map((c) => (c.hasActed ? { ...c, hasActed: false } : c)) };
  delete (ready as { launched?: true }).launched;
  return ready;
}

/** Runs the start of state.currentPlayer's turn. */
export function startTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [{ type: "turnStarted", player: state.currentPlayer, day: state.day }];
  const afterFuel = burnFuel(state, events);
  const afterIncome = collectIncome(afterFuel, events);
  const afterRepairs = repairAndResupply(afterIncome, events);
  const afterSupply = halftrackResupply(afterRepairs, events);
  const player = state.currentPlayer;
  return {
    state: { ...afterSupply, units: afterSupply.units.map((u) => (u.owner === player ? readyUp(u) : u)) },
    events,
  };
}

/** Whether a unit stands on an owned property that repairs and resupplies its category. */
function isServiced(state: GameState, unit: Unit): boolean {
  return propertyAt(state, unit.pos)?.owner === unit.owner && propertyDefAt(state, unit.pos)?.repairs === UNITS[unit.type].category;
}

/**
 * Air and naval units burn fuel every turn, and are lost if it runs out (05-supply-transport §5, §7).
 * Not on day 1, and not on a property that services them, which refuels them anyway.
 */
function burnFuel(state: GameState, events: GameEvent[]): GameState {
  if (state.day === 1) return state;
  const units: Unit[] = [];
  for (const unit of state.units) {
    const burn = unit.owner === state.currentPlayer && !isServiced(state, unit) ? stats.fuelPerDay(state, unit) : 0;
    const fuel = Math.max(0, unit.fuel - burn);
    if (burn > 0 && fuel === 0) {
      events.push({ type: "unitOutOfFuel", unitId: unit.id, unitType: unit.type, owner: unit.owner, pos: unit.pos });
    } else {
      units.push(burn > 0 ? { ...unit, fuel } : unit);
    }
  }
  return clearAbandonedCaptures({ ...state, units });
}

/** Each of the player's supply units refills adjacent friendly units (05-supply-transport §3). */
function halftrackResupply(state: GameState, events: GameEvent[]): GameState {
  let current = state;
  for (const supplier of state.units.filter((u) => u.owner === state.currentPlayer)) {
    const supplied = applySupply(current, supplyTargets(current, supplier));
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
 * Carrier, by less (05-supply-transport §10). Runs in row-major order, a Carrier before its
 * aircraft, so when funds run short they run out the same way every time (04-economy §5).
 */
function repairAndResupply(state: GameState, events: GameEvent[]): GameState {
  const player = state.players[state.currentPlayer];
  if (!player) return state;
  let funds = player.funds;
  const updated = new Map<number, Unit>();

  /** Repairs up to `most` displayed HP, as far as funds allow, and refills fuel and ammo. */
  const service = (unit: Unit, most: number): Unit => {
    const costPerHp = Math.floor(stats.unitCost(state, player.id, unit.type) / 10);
    const wanted = Math.min(most, 10 - displayHp(unit.hp));
    const affordable = costPerHp === 0 ? wanted : Math.floor(funds / costPerHp);
    const healed = Math.min(wanted, affordable);
    const fuel = stats.maxFuel(state, unit);
    const ammo = stats.maxAmmo(state, unit);
    const resupplied = unit.fuel < fuel || unit.ammo < ammo;
    if (healed > 0) {
      const cost = healed * costPerHp;
      funds -= cost;
      events.push({ type: "unitRepaired", unitId: unit.id, hp: healed, cost });
    }
    if (resupplied) events.push({ type: "unitResupplied", unitId: unit.id });
    return healed > 0 || resupplied ? { ...unit, hp: Math.min(MAX_HP, unit.hp + healed * 10), fuel, ammo } : unit;
  };

  const served = state.units
    .filter((u) => u.owner === player.id && (isServiced(state, u) || carries(u)))
    .sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x);

  for (const unit of served) {
    const self = isServiced(state, unit) ? service(unit, REPAIR_HP) : unit;
    const after = carries(self) ? { ...self, cargo: self.cargo.map((c) => service(c, CARRIER_REPAIR_HP)) } : self;
    if (after !== unit) updated.set(unit.id, after);
  }

  return setFunds({ ...state, units: state.units.map((u) => updated.get(u.id) ?? u) }, funds);
}
