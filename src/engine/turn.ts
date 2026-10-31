// The start-of-turn sequence (04-economy §2), in the doc's order. Daily fuel burn for air and naval
// units arrives with them in phase 2; Halftrack automatic resupply arrives in milestone 5.

import type { GameEvent } from "./commands";
import { UNITS } from "./data/units";
import { propertyDefAt } from "./economy";
import { displayHp, MAX_HP, propertyAt, type GameState, type Unit } from "./state";
import * as stats from "./stats";

/** Displayed HP repaired per turn on a property (04-economy §5). */
export const REPAIR_HP = 2;

/** Runs the start of state.currentPlayer's turn. */
export function startTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [{ type: "turnStarted", player: state.currentPlayer, day: state.day }];
  const afterIncome = collectIncome(state, events);
  const afterRepairs = repairAndResupply(afterIncome, events);
  const player = state.currentPlayer;
  return {
    state: { ...afterRepairs, units: afterRepairs.units.map((u) => (u.owner === player && u.hasActed ? { ...u, hasActed: false } : u)) },
    events,
  };
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
    .filter((u) => u.owner === player.id && propertyAt(state, u.pos)?.owner === player.id)
    .filter((u) => propertyDefAt(state, u.pos)?.repairs === UNITS[u.type].category)
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
