// Chooses which tiles from the pack's terrain sheet draw each map cell (08-art-pipeline §14):
// variants for open ground, joined pieces for roads and rivers, bridges over rivers, and
// shore foam on sea next to land. Presentation only: none of this affects the rules.

import type { TerrainId } from "../engine/data/terrain";
import type { GameMap } from "../engine/map";
import type { TerrainSheet } from "./artPack";

/** One image drawn for a cell: a tile from the pack's sheet, or the built-in placeholder. */
export type TerrainLayer =
  | { readonly kind: "sheet"; readonly tile: number }
  | { readonly kind: "placeholder"; readonly terrain: TerrainId };

const N = 1, E = 2, S = 4, W = 8;
const SIDES = [
  { bit: N, dx: 0, dy: -1 },
  { bit: E, dx: 1, dy: 0 },
  { bit: S, dx: 0, dy: 1 },
  { bit: W, dx: -1, dy: 0 },
] as const;
const OPPOSITE: Readonly<Record<number, number>> = { [N]: S, [E]: W, [S]: N, [W]: E };

const ROAD_JOINS: readonly TerrainId[] = ["road", "bridge"];
const RIVER_JOINS: readonly TerrainId[] = ["river", "bridge", "sea", "reef"];
/** Shore foam never forms against these: they're water too. */
const WATER: readonly TerrainId[] = ["sea", "reef", "river", "bridge"];

const at = (map: GameMap, x: number, y: number): TerrainId | undefined =>
  x >= 0 && y >= 0 && x < map.width && y < map.height ? map.terrain[y * map.width + x] : undefined;

/**
 * Which sides of a cell join a neighbor, as a mask: N=1, E=2, S=4, W=8.
 * A road or river that dead-ends at the map's edge runs straight on past it, so it never stops
 * short of the border. One that turns or branches there keeps its shape.
 */
export function joinMask(map: GameMap, x: number, y: number, joins: readonly TerrainId[]): number {
  let mask = 0;
  const offMap: number[] = [];
  for (const { bit, dx, dy } of SIDES) {
    const next = at(map, x + dx, y + dy);
    if (next === undefined) offMap.push(bit);
    else if (joins.includes(next)) mask |= bit;
  }
  const deadEnd = SIDES.some(({ bit }) => mask === bit);
  for (const bit of offMap) {
    if (deadEnd && mask === OPPOSITE[bit]) return mask | bit;
  }
  return mask;
}

/** A bridge spans the water beside it: water above or below means it runs left to right. */
export function bridgeRunsAcross(map: GameMap, x: number, y: number): boolean {
  const water = (t: TerrainId | undefined) => t !== undefined && t !== "bridge" && WATER.includes(t);
  if (water(at(map, x, y - 1)) || water(at(map, x, y + 1))) return true;
  return !(water(at(map, x - 1, y)) || water(at(map, x + 1, y)));
}

/** Picks the same variant for a cell every time, so the map doesn't shuffle when redrawn. */
export function variantFor(x: number, y: number, count: number): number {
  const h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  return h % count;
}

const isLand = (t: TerrainId | undefined) => t !== undefined && !WATER.includes(t);

/** Shore foam pieces for a sea cell, in sheet order: edges N, E, S, W, then corners NE, SE, SW, NW. */
export function shorePieces(map: GameMap, x: number, y: number): number[] {
  const land = (dx: number, dy: number) => isLand(at(map, x + dx, y + dy));
  const pieces: number[] = [];
  SIDES.forEach(({ dx, dy }, i) => {
    if (land(dx, dy)) pieces.push(i);
  });
  // A corner shows only where land touches diagonally and the two sides beside it are open water.
  const corners = [[1, -1], [1, 1], [-1, 1], [-1, -1]] as const;
  corners.forEach(([dx, dy], i) => {
    if (land(dx, dy) && !land(dx, 0) && !land(0, dy)) pieces.push(4 + i);
  });
  return pieces;
}

/** Every layer for one cell, bottom to top. Terrain the sheet doesn't cover keeps its placeholder. */
export function terrainLayers(map: GameMap, x: number, y: number, sheet: TerrainSheet | null): TerrainLayer[] {
  const id = at(map, x, y);
  if (id === undefined) return [];
  const placeholder: TerrainLayer[] = [{ kind: "placeholder", terrain: id }];
  if (!sheet) return placeholder;
  const tile = (n: number): TerrainLayer => ({ kind: "sheet", tile: n });
  const { connected, bridges, shore } = sheet;

  if (id === "bridge" && connected.river !== undefined && bridges) {
    const base = connected.river + joinMask(map, x, y, RIVER_JOINS);
    return [tile(base), tile(bridgeRunsAcross(map, x, y) ? bridges.horizontal : bridges.vertical)];
  }
  if (id === "road" && connected.road !== undefined) return [tile(connected.road + joinMask(map, x, y, ROAD_JOINS))];
  if (id === "river" && connected.river !== undefined) return [tile(connected.river + joinMask(map, x, y, RIVER_JOINS))];

  const variants = sheet.tiles[id];
  if (!variants || variants.length === 0) return placeholder;
  const layers = [tile(variants[variantFor(x, y, variants.length)] ?? 0)];
  if ((id === "sea" || id === "reef") && shore !== undefined) {
    for (const piece of shorePieces(map, x, y)) layers.push(tile(shore + piece));
  }
  return layers;
}
