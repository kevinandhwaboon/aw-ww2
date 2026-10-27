// Movement rules (02-terrain §5, 05-supply-transport §1). Used both by apply() to validate moves
// and by the UI to show move ranges and build paths, so the two can never disagree.

import { inBounds, type Point } from "./map";
import type { GameState, Unit } from "./state";
import * as stats from "./stats";

export interface Reach {
  /** Movement points (= fuel) spent to get here by the cheapest path. */
  readonly cost: number;
  /** Tile index this tile was reached from on the cheapest path; null for the start tile. */
  readonly prev: number | null;
}

const STEPS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

export const tileIndex = (state: GameState, p: Point) => p.y * state.map.width + p.x;
export const tilePoint = (state: GameState, i: number): Point => ({ x: i % state.map.width, y: Math.floor(i / state.map.width) });
const isAdjacent = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

/** How far the unit can move this turn: its move points, limited by its fuel (05-supply-transport §1). */
export function movementBudget(state: GameState, unit: Unit): number {
  return Math.min(stats.movePoints(state, unit), unit.fuel);
}

function sideOf(state: GameState, unit: Unit) {
  return state.players[unit.owner]?.side;
}

/** Whether the unit may pass through this tile: in bounds, passable terrain, no enemy unit. */
function enterCost(state: GameState, unit: Unit, p: Point): number | null {
  if (!inBounds(state.map, p)) return null;
  const terrain = state.map.terrain[tileIndex(state, p)];
  if (terrain === undefined) return null;
  const occupant = state.units.find((u) => u.pos.x === p.x && u.pos.y === p.y);
  if (occupant && sideOf(state, occupant) !== sideOf(state, unit)) return null; // enemies block
  return stats.moveCost(state, unit, terrain);
}

/** Whether the unit may end its move here: its own tile, or an empty one. (Load/join come later.) */
export function canEndOn(state: GameState, unit: Unit, p: Point): boolean {
  const occupant = state.units.find((u) => u.pos.x === p.x && u.pos.y === p.y);
  return !occupant || occupant.id === unit.id;
}

/**
 * Every tile the unit can reach this turn (including tiles it can only pass through), keyed by
 * tile index, with the cheapest cost and the previous tile on that path. Deterministic.
 */
export function reachableTiles(state: GameState, unit: Unit): ReadonlyMap<number, Reach> {
  const budget = movementBudget(state, unit);
  const best = new Map<number, Reach>([[tileIndex(state, unit.pos), { cost: 0, prev: null }]]);
  const done = new Set<number>();
  for (;;) {
    // Pick the cheapest unfinished tile (lowest index on ties). Ranges are small, so a linear scan is fine.
    let current: number | undefined;
    for (const [i, reach] of best) {
      if (done.has(i)) continue;
      const bestCost = current === undefined ? Infinity : (best.get(current)?.cost ?? Infinity);
      if (reach.cost < bestCost || (reach.cost === bestCost && current !== undefined && i < current)) current = i;
    }
    if (current === undefined) return best;
    done.add(current);
    const from = tilePoint(state, current);
    const fromCost = best.get(current)?.cost ?? 0;
    for (const step of STEPS) {
      const p = { x: from.x + step.x, y: from.y + step.y };
      const cost = enterCost(state, unit, p);
      if (cost === null) continue;
      const total = fromCost + cost;
      const i = tileIndex(state, p);
      if (total > budget || done.has(i)) continue;
      const known = best.get(i);
      if (!known || total < known.cost) best.set(i, { cost: total, prev: current });
    }
  }
}

/** Tiles the unit can end its move on this turn, including staying put. */
export function moveDestinations(state: GameState, unit: Unit): Point[] {
  return [...reachableTiles(state, unit).keys()]
    .sort((a, b) => a - b)
    .map((i) => tilePoint(state, i))
    .filter((p) => canEndOn(state, unit, p));
}

/** The cheapest path to dest (excluding the start tile), or null if it isn't reachable. */
export function cheapestPath(state: GameState, reach: ReadonlyMap<number, Reach>, dest: Point): Point[] | null {
  if (!inBounds(state.map, dest)) return null;
  let i: number | null = tileIndex(state, dest);
  if (!reach.has(i)) return null;
  const path: Point[] = [];
  while (i !== null) {
    const r = reach.get(i);
    if (!r) return null;
    if (r.prev !== null) path.unshift(tilePoint(state, i));
    i = r.prev;
  }
  return path;
}

export type PathCheck =
  | { readonly ok: true; readonly cost: number }
  | { readonly ok: false; readonly reason: string };

/**
 * Validates a path the unit would walk this turn. The path lists the tiles stepped onto, in order,
 * excluding the start tile; an empty path means "stay put". With `throughOnly`, the path may end
 * on a friendly unit (useful while drawing a path that passes through one).
 */
export function checkPath(
  state: GameState,
  unit: Unit,
  path: readonly Point[],
  options: { readonly throughOnly?: boolean } = {},
): PathCheck {
  const budget = movementBudget(state, unit);
  const visited = new Set<number>([tileIndex(state, unit.pos)]);
  let from = unit.pos;
  let cost = 0;
  for (const [n, p] of path.entries()) {
    const where = `step ${n + 1} (${p.x}, ${p.y})`;
    if (!isAdjacent(from, p)) return { ok: false, reason: `${where} is not next to the previous tile` };
    const i = tileIndex(state, p);
    if (!inBounds(state.map, p)) return { ok: false, reason: `${where} is outside the map` };
    if (visited.has(i)) return { ok: false, reason: `${where} revisits a tile` };
    const step = enterCost(state, unit, p);
    if (step === null) return { ok: false, reason: `${where} is impassable or blocked by an enemy` };
    cost += step;
    if (cost > budget) return { ok: false, reason: `path costs ${cost}, more than the ${budget} available` };
    visited.add(i);
    from = p;
  }
  if (!options.throughOnly && !canEndOn(state, unit, from)) return { ok: false, reason: `can't end the move on an occupied tile` };
  return { ok: true, cost };
}
