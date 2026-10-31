// Transport, supply and joining (05-supply-transport §3–4, 04-economy §6). Used both by apply() and
// by the UI for menus, so what the menus offer is exactly what the engine accepts.
//
// Passengers live inside their transport (`cargo`), not in GameState.units. So they can't be
// targeted, aren't repaired, and are destroyed with the transport without counting as kills.

import type { GameEvent } from "./commands";
import { unitDef } from "./data/units";
import { inBounds, type Point } from "./map";
import { tileIndex } from "./movement";
import { displayHp, unitAt, type GameState, type Unit } from "./state";
import * as stats from "./stats";

const NEIGHBORS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const neighborsOf = (state: GameState, p: Point): Point[] =>
  NEIGHBORS.map((n) => ({ x: p.x + n.x, y: p.y + n.y })).filter((q) => inBounds(state.map, q));

function replaceUnits(state: GameState, remove: Unit, keep: Unit): GameState {
  return { ...state, units: state.units.filter((u) => u.id !== remove.id).map((u) => (u.id === keep.id ? keep : u)) };
}

/** Why this unit can't board that transport, or null if it can. */
export function loadProblem(unit: Unit, transport: Unit): string | null {
  const rules = unitDef(transport.type).transport;
  if (!rules) return "that unit isn't a transport";
  if (transport.owner !== unit.owner) return "you can only board your own transports";
  if (!rules.carries.includes(unit.type)) return "this unit doesn't fit in that transport";
  if (transport.cargo.length >= rules.capacity) return "the transport is full";
  return null;
}

/** Puts the moved unit inside the transport. Its action is over (05-supply-transport §4). */
export function applyLoad(state: GameState, unit: Unit, transport: Unit): { state: GameState; event: GameEvent } {
  const loaded: Unit = { ...transport, cargo: [...transport.cargo, { ...unit, pos: transport.pos, hasActed: true }] };
  return {
    state: replaceUnits(state, unit, loaded),
    event: { type: "unitLoaded", unitId: unit.id, transportId: transport.id },
  };
}

/** Tiles this passenger could be unloaded onto: next to the transport, passable for it, and empty. */
export function unloadTiles(state: GameState, transport: Unit, passenger: Unit): Point[] {
  return neighborsOf(state, transport.pos).filter((p) => {
    const terrain = state.map.terrain[tileIndex(state, p)];
    return terrain !== undefined && !unitAt(state, p) && stats.moveCost(state, passenger, terrain) !== null;
  });
}

/** Unloads a passenger, who can't act this turn (05-supply-transport §4). */
export function applyUnload(state: GameState, transport: Unit, passenger: Unit, to: Point): { state: GameState; event: GameEvent } {
  const emptied: Unit = { ...transport, cargo: transport.cargo.filter((c) => c.id !== passenger.id) };
  const landed: Unit = { ...passenger, pos: to, hasActed: true };
  return {
    state: { ...state, units: [...state.units.map((u) => (u.id === transport.id ? emptied : u)), landed].sort((a, b) => a.id - b.id) },
    event: { type: "unitUnloaded", unitId: passenger.id, transportId: transport.id, pos: to },
  };
}

function needsSupply(state: GameState, unit: Unit): boolean {
  return unit.fuel < stats.maxFuel(state, unit) || unit.ammo < stats.maxAmmo(state, unit);
}

/** Friendly units next to this supply unit that are short of fuel or ammo (05-supply-transport §3). */
export function supplyTargets(state: GameState, supplier: Unit): Unit[] {
  if (!unitDef(supplier.type).specialActions.includes("resupply")) return [];
  const side = state.players[supplier.owner]?.side;
  return neighborsOf(state, supplier.pos)
    .map((p) => unitAt(state, p))
    .filter((u): u is Unit => u !== undefined && state.players[u.owner]?.side === side && needsSupply(state, u));
}

/** Refills these units' fuel and ammo. Free; doesn't heal. */
export function applySupply(state: GameState, targets: readonly Unit[]): { state: GameState; events: GameEvent[] } {
  const ids = new Set(targets.map((t) => t.id));
  return {
    state: {
      ...state,
      units: state.units.map((u) => (ids.has(u.id) ? { ...u, fuel: stats.maxFuel(state, u), ammo: stats.maxAmmo(state, u) } : u)),
    },
    events: targets.map((t) => ({ type: "unitResupplied", unitId: t.id })),
  };
}

/** Why this unit can't join that one, or null if it can (04-economy §6). */
export function joinProblem(unit: Unit, target: Unit): string | null {
  if (target.owner !== unit.owner) return "you can only join your own units";
  if (target.type !== unit.type) return "units must be the same type to join";
  if (displayHp(target.hp) >= 10) return "that unit is at full strength";
  if (unit.cargo.length > 0 || target.cargo.length > 0) return "a transport carrying units can't join";
  return null;
}

/**
 * Merges the moved unit into the target (04-economy §6, 03-combat §6): displayed HP adds up to 10,
 * excess HP is refunded, fuel and ammo add up to their maximum, and the merged unit keeps the kills
 * of whichever contributed more HP (the higher count on a tie). The result has acted this turn.
 */
export function applyJoin(state: GameState, unit: Unit, target: Unit): { state: GameState; event: GameEvent } {
  const mine = displayHp(unit.hp);
  const theirs = displayHp(target.hp);
  const total = mine + theirs;
  const kills = mine === theirs ? Math.max(unit.kills, target.kills) : mine > theirs ? unit.kills : target.kills;
  const refund = Math.max(0, total - 10) * Math.floor(stats.unitCost(state, unit.owner, unit.type) / 10);
  const merged: Unit = {
    ...target,
    hp: Math.min(10, total) * 10,
    fuel: Math.min(stats.maxFuel(state, target), unit.fuel + target.fuel),
    ammo: Math.min(stats.maxAmmo(state, target), unit.ammo + target.ammo),
    kills,
    hasActed: true,
  };
  const joined = replaceUnits(state, unit, merged);
  return {
    state: { ...joined, players: joined.players.map((p) => (p.id === unit.owner ? { ...p, funds: p.funds + refund } : p)) },
    event: { type: "unitJoined", unitId: unit.id, targetId: target.id, hp: merged.hp, refund },
  };
}
