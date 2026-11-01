// The start-of-turn sequence (04-economy §2), in the doc's order.

import type { GameEvent } from "./commands";
import { UNITS } from "./data/units";
import { clearAbandonedCaptures, propertyDefAt } from "./economy";
import { displayHp, MAX_HP, propertyAt, type GameState, type Unit } from "./state";
import * as stats from "./stats";
import { applySupply, supplyTargets } from "./transport";

/** Displayed HP repaired per turn on a property (04-economy §5). */
export const REPAIR_HP = 2;

/** Runs the start of state.currentPlayer's turn. */
export function startTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [{ type: "turnStarted", player: state.currentPlayer, day: state.day }];
  const afterFuel = burnFuel(state, events);
  const afterIncome = collectIncome(afterFuel, events);
  const afterRepairs = repairAndResupply(afterIncome, events);
  const afterSupply = halftrackResupply(afterRepairs, events);
  const player = state.currentPlayer;
  return {
    state: { ...afterSupply, units: afterSupply.units.map((u) => (u.owner === player && u.hasActed ? { ...u, hasActed: false } : u)) },
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

/**
 * Units on owned properties of the right category heal and resupply. Runs in row-major order, so
 * when funds run short they run out the same way every time (04-economy §5).
 */
function repairAndResupply(state: GameState, events: GameEvent[]): GameState {
  const player = state.players[state.currentPlayer];
  if (!player) return state;
  let funds = player.funds;
  const updated = new Map<number, Unit>();

  const served = state.units
    .filter((u) => u.owner === player.id && isServiced(state, u))
    .sort((a, b) => a.pos.y - b.pos.y || a.pos.x - b.pos.x);

  for (const unit of served) {
    const costPerHp = Math.floor(stats.unitCost(state, player.id, unit.type) / 10);
    const wanted = Math.min(REPAIR_HP, 10 - displayHp(unit.hp));
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
    if (healed > 0 || resupplied) {
      updated.set(unit.id, { ...unit, hp: Math.min(MAX_HP, unit.hp + healed * 10), fuel, ammo });
    }
  }

  return setFunds({ ...state, units: state.units.map((u) => updated.get(u.id) ?? u) }, funds);
}
