// Builds the movement path arrow as the cursor moves, like the original game: the arrow follows the
// cursor tile by tile while that stays legal, and falls back to the cheapest path when it doesn't.
// Pure logic on engine data (no Phaser), so it's unit-tested.

import type { Point } from "../engine/map";
import { checkPath, cheapestPath, type Reach } from "../engine/movement";
import type { GameState, Unit } from "../engine/state";

const same = (a: Point, b: Point) => a.x === b.x && a.y === b.y;
const adjacent = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;

/**
 * The new path (excluding the start tile) after the cursor moves to `tile`.
 * - Cursor outside the move range: the path is unchanged.
 * - Cursor back on the unit, or on a tile already in the path: the path is cut back to it.
 * - Cursor next to the path's end, and the longer path is still affordable: it's extended.
 * - Otherwise: the cheapest path to the cursor.
 */
export function extendPath(
  state: GameState,
  unit: Unit,
  reach: ReadonlyMap<number, Reach>,
  path: readonly Point[],
  tile: Point,
): Point[] {
  if (!reach.has(tile.y * state.map.width + tile.x)) return [...path];
  if (same(tile, unit.pos)) return [];
  const existing = path.findIndex((p) => same(p, tile));
  if (existing >= 0) return path.slice(0, existing + 1);
  const end = path[path.length - 1] ?? unit.pos;
  if (adjacent(end, tile)) {
    const extended = [...path, tile];
    // The arrow may pass over a friendly unit mid-drag; the destination is checked on confirm.
    if (checkPath(state, unit, extended, { throughOnly: true }).ok) return extended;
  }
  return cheapestPath(state, reach, tile) ?? [...path];
}
