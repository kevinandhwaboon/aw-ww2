// Turn-start repair and resupply, split into one step per unit so the map can show them one at a
// time (04-economy §2, §5; 00-master-design §12). Only reads what the engine already decided.

import type { GameEvent } from "../engine/commands";
import type { Point } from "../engine/map";
import type { GameState, Unit, UnitId } from "../engine/state";

/** One unit serviced at turn start. */
export interface ServiceStep {
  readonly unitId: UnitId;
  /** Where the cursor goes: the unit's tile, or its Carrier's for an aircraft aboard one. */
  readonly pos: Point;
  /** Displayed HP repaired, 0 if none. */
  readonly repairedHp: number;
  /** What the repair cost. */
  readonly cost: number;
  readonly resupplied: boolean;
  /**
   * The game as drawn while this step plays, one frame per displayed HP repaired (the HP and funds
   * tick one point at a time), or one frame for a resupply alone. The last frame has this unit done.
   */
  readonly frames: readonly GameState[];
}

export interface TurnService {
  /** The game as drawn before any unit is serviced: repairs not yet made or paid for. */
  readonly start: GameState;
  readonly steps: readonly ServiceStep[];
}

/** The unit with this id, on the map or aboard a transport, and the tile it's on. */
function locate(state: GameState, id: UnitId): { unit: Unit; pos: Point } | undefined {
  for (const u of state.units) {
    if (u.id === id) return { unit: u, pos: u.pos };
    const aboard = u.cargo.find((c) => c.id === id);
    if (aboard) return { unit: aboard, pos: u.pos };
  }
  return undefined;
}

function updateUnit(state: GameState, id: UnitId, change: (unit: Unit) => Unit): GameState {
  return {
    ...state,
    units: state.units.map((u) =>
      u.id === id ? change(u) : u.cargo.some((c) => c.id === id) ? { ...u, cargo: u.cargo.map((c) => (c.id === id ? change(c) : c)) } : u,
    ),
  };
}

function addFunds(state: GameState, amount: number): GameState {
  if (amount === 0) return state;
  return { ...state, players: state.players.map((p) => (p.id === state.currentPlayer ? { ...p, funds: p.funds + amount } : p)) };
}

/**
 * The repairs and resupplies of the turn that `events` start, unit by unit, in the order the engine
 * made them; a unit both repaired and resupplied is one step. `before` is the game before the
 * command (for fuel and ammo before a resupply), `after` the game after it. Empty when the events
 * start no turn or nobody was serviced.
 */
export function turnServiceSteps(before: GameState, after: GameState, events: readonly GameEvent[]): TurnService {
  const from = events.findIndex((e) => e.type === "turnStarted");
  const order: UnitId[] = [];
  const repairs = new Map<UnitId, { hp: number; cost: number }>();
  const resupplied = new Set<UnitId>();
  for (const event of from < 0 ? [] : events.slice(from + 1)) {
    if (event.type !== "unitRepaired" && event.type !== "unitResupplied") continue;
    if (!locate(after, event.unitId)) continue;
    if (!order.includes(event.unitId)) order.push(event.unitId);
    if (event.type === "unitRepaired") repairs.set(event.unitId, { hp: event.hp, cost: event.cost });
    else resupplied.add(event.unitId);
  }

  // Undo every repair and resupply, then redo them one unit at a time.
  let start = after;
  for (const id of order) {
    const repair = repairs.get(id);
    const old = resupplied.has(id) ? locate(before, id)?.unit : undefined;
    start = updateUnit(start, id, (u) => ({
      ...u,
      ...(repair ? { hp: u.hp - repair.hp * 10 } : {}),
      ...(old ? { fuel: old.fuel, ammo: old.ammo } : {}),
    }));
    if (repair) start = addFunds(start, repair.cost);
  }

  let current = start;
  const steps: ServiceStep[] = [];
  for (const id of order) {
    const done = locate(after, id);
    if (!done) continue;
    const repair = repairs.get(id) ?? { hp: 0, cost: 0 };
    const refilled = resupplied.has(id);
    if (refilled) current = updateUnit(current, id, (u) => ({ ...u, fuel: done.unit.fuel, ammo: done.unit.ammo }));
    const frames: GameState[] = [];
    // Funds go down a share per HP; the last point takes what's left, so they end exact.
    let paid = 0;
    for (let hp = 1; hp <= repair.hp; hp++) {
      const due = Math.round((repair.cost * hp) / repair.hp);
      current = addFunds(updateUnit(current, id, (u) => ({ ...u, hp: u.hp + 10 })), paid - due);
      paid = due;
      frames.push(current);
    }
    if (frames.length === 0) frames.push(current);
    steps.push({ unitId: id, pos: done.pos, repairedHp: repair.hp, cost: repair.cost, resupplied: refilled, frames });
  }
  return { start, steps };
}
