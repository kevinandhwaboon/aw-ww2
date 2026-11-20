// Chooses which tiles from the pack's terrain sheet draw each map cell (08-art-pipeline §14):
// variants for open ground, joined pieces for roads and rivers, bridges over rivers, shore foam on
// sea next to land, beaches that are half sea on the sides facing it, and which way a port's harbor
// opens (§15). Presentation only: none of this affects the rules.

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

/** Bridges of every kind, drawn as a deck or wreck over a river piece (02-terrain §4a). */
const BRIDGES: readonly TerrainId[] = ["bridge", "majorBridge", "blownBridge"];
/** A road runs up to a Blown Bridge's stub too. */
const ROAD_JOINS: readonly TerrainId[] = ["road", ...BRIDGES];
const RIVER_JOINS: readonly TerrainId[] = ["river", ...BRIDGES, "sea", "reef"];
/** Shore foam never forms against these: they're water too. */
const WATER: readonly TerrainId[] = ["sea", "reef", "river", ...BRIDGES];

const at = (map: GameMap, x: number, y: number): TerrainId | undefined =>
  x >= 0 && y >= 0 && x < map.width && y < map.height ? map.terrain[y * map.width + x] : undefined;

/**
 * Which sides of a cell join a neighbor, as a mask: N=1, E=2, S=4, W=8.
 * A road or river that dead-ends at the map's edge runs straight on past it, so it never stops
 * short of the border. One that turns or branches there keeps its shape.
 */
export function joinMask(
  map: GameMap,
  x: number,
  y: number,
  joins: readonly TerrainId[],
  alsoJoins: (x: number, y: number) => boolean = () => false,
): number {
  let mask = 0;
  const offMap: number[] = [];
  for (const { bit, dx, dy } of SIDES) {
    const next = at(map, x + dx, y + dy);
    if (next === undefined) offMap.push(bit);
    else if (joins.includes(next) || alsoJoins(x + dx, y + dy)) mask |= bit;
  }
  const deadEnd = SIDES.some(({ bit }) => mask === bit);
  for (const bit of offMap) {
    if (deadEnd && mask === OPPOSITE[bit]) return mask | bit;
  }
  return mask;
}

/** A bridge spans the water beside it: water above or below means it runs left to right. */
export function bridgeRunsAcross(map: GameMap, x: number, y: number): boolean {
  const water = (t: TerrainId | undefined) => t !== undefined && !BRIDGES.includes(t) && WATER.includes(t);
  if (water(at(map, x, y - 1)) || water(at(map, x, y + 1))) return true;
  return !(water(at(map, x - 1, y)) || water(at(map, x + 1, y)));
}

/**
 * A Railway square where the line crosses a river (02-terrain §4c): river on two opposite sides. It
 * draws as river with a girder span over it, and the river runs into it from both banks.
 */
export function isRailCrossing(map: GameMap, x: number, y: number): boolean {
  if (at(map, x, y) !== "railway") return false;
  const river = (dx: number, dy: number) => at(map, x + dx, y + dy) === "river";
  return (river(0, -1) && river(0, 1)) || (river(-1, 0) && river(1, 0));
}
const railCrossingAt = (map: GameMap) => (x: number, y: number) => isRailCrossing(map, x, y);

/** Picks the same variant for a cell every time, so the map doesn't shuffle when redrawn. */
export function variantFor(x: number, y: number, count: number): number {
  const h = (Math.imul(x, 73856093) ^ Math.imul(y, 19349663)) >>> 0;
  return h % count;
}

/** Open water a beach runs down into, and a port's harbor opens onto. */
const OPEN_WATER: readonly TerrainId[] = ["sea", "reef"];
const isOpenWater = (t: TerrainId | undefined) => t !== undefined && OPEN_WATER.includes(t);

/**
 * Whether sea next to this cell forms a line of foam against it. Never against a port, whose quay and
 * harbor run straight into the sea, nor (when the sheet draws half-sea beaches) against a beach,
 * whose sides facing the sea are water already: a line there would read as a wall.
 */
const makesFoam = (t: TerrainId | undefined, seaBeaches: boolean) =>
  t !== undefined && !WATER.includes(t) && t !== "port" && !(seaBeaches && t === "beach");

/**
 * Shore foam pieces for a sea cell, in sheet order: edges N, E, S, W, then corners NE, SE, SW, NW.
 * Pass `seaBeaches` when beaches are drawn half sea, so they make no foam.
 */
export function shorePieces(map: GameMap, x: number, y: number, seaBeaches = false): number[] {
  const land = (dx: number, dy: number) => makesFoam(at(map, x + dx, y + dy), seaBeaches);
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

/** Which sides of a beach face open water, as a mask: N=1, E=2, S=4, W=8. Those halves are drawn as sea. */
export function beachWaterMask(map: GameMap, x: number, y: number): number {
  let mask = 0;
  for (const { bit, dx, dy } of SIDES) if (isOpenWater(at(map, x + dx, y + dy))) mask |= bit;
  return mask;
}

/**
 * Inner corners of a beach, in sheet order NE, SE, SW, NW: where open water touches only diagonally,
 * a quarter of sea rounds into the sand so the waterline carries on from the beaches beside it. Only
 * where a beach is next to that corner, since otherwise there's no waterline to carry on.
 */
export function beachCorners(map: GameMap, x: number, y: number): number[] {
  const t = (dx: number, dy: number) => at(map, x + dx, y + dy);
  const corners = [[1, -1], [1, 1], [-1, 1], [-1, -1]] as const;
  const out: number[] = [];
  corners.forEach(([dx, dy], i) => {
    const sides = [t(dx, 0), t(0, dy)];
    if (isOpenWater(t(dx, dy)) && !sides.some(isOpenWater) && sides.includes("beach")) out.push(i);
  });
  return out;
}

/** Full land beside a beach: anything but another beach or open water. Off the map doesn't count. */
const isFullLand = (t: TerrainId | undefined) => t !== undefined && t !== "beach" && !isOpenWater(t);

/**
 * Flares of a beach (08-art-pipeline §14): at a corner where one side is open water and the other is
 * full land, the sand sweeps out to the land's corner, so the waterline never runs into the middle
 * of a plain or forest tile's side. Numbered as in the sheet: 8 for each corner NE, SE, SW, NW; plus
 * 4 when the sea is on the corner's east or west side (and the land north or south) rather than the
 * other way round; plus 1 when the side opposite the corner's north/south side is sea, and 2 when
 * the side opposite its east/west side is.
 */
export function beachFlares(map: GameMap, x: number, y: number): number[] {
  const mask = beachWaterMask(map, x, y);
  const N = 1, E = 2, S = 4, W = 8;
  const corners = [
    { upDown: N, across: E, dy: -1, dx: 1 },
    { upDown: S, across: E, dy: 1, dx: 1 },
    { upDown: S, across: W, dy: 1, dx: -1 },
    { upDown: N, across: W, dy: -1, dx: -1 },
  ];
  const out: number[] = [];
  corners.forEach(({ upDown, across, dx, dy }, i) => {
    const opposites = (mask & (upDown === N ? S : N) ? 1 : 0) + (mask & (across === E ? W : E) ? 2 : 0);
    const seaUpDown = (mask & upDown) !== 0 && isFullLand(at(map, x + dx, y));
    const seaAcross = (mask & across) !== 0 && isFullLand(at(map, x, y + dy));
    if (seaUpDown) out.push(i * 8 + opposites);
    else if (seaAcross) out.push(i * 8 + 4 + opposites);
  });
  return out;
}

export type Side = "N" | "E" | "S" | "W";

/**
 * The side a port's harbor basin opens to (08-art-pipeline §15): the side facing open water, so the
 * basin runs straight into the sea. With water on several sides, the one with the most water around
 * it; ties go south, east, west, then north. A port with no open water beside it opens south.
 */
export function portOpening(map: GameMap, x: number, y: number): Side {
  const wet = (dx: number, dy: number) => (isOpenWater(at(map, x + dx, y + dy)) ? 1 : 0);
  const options: { side: Side; dx: number; dy: number }[] = [
    { side: "S", dx: 0, dy: 1 },
    { side: "E", dx: 1, dy: 0 },
    { side: "W", dx: -1, dy: 0 },
    { side: "N", dx: 0, dy: -1 },
  ];
  let best: Side = "S";
  let bestScore = 0;
  for (const { side, dx, dy } of options) {
    if (!wet(dx, dy)) continue;
    // The cell beside it, the two diagonals on that side, and the cell beyond.
    const score = 1 + wet(dx + dy, dy + dx) + wet(dx - dy, dy - dx) + wet(2 * dx, 2 * dy);
    if (score > bestScore) [best, bestScore] = [side, score];
  }
  return best;
}

/** Every layer for one cell, bottom to top. Terrain the sheet doesn't cover keeps its placeholder. */
export function terrainLayers(map: GameMap, x: number, y: number, sheet: TerrainSheet | null): TerrainLayer[] {
  const id = at(map, x, y);
  if (id === undefined) return [];
  const placeholder: TerrainLayer[] = [{ kind: "placeholder", terrain: id }];
  if (!sheet) return placeholder;
  const tile = (n: number): TerrainLayer => ({ kind: "sheet", tile: n });
  const { connected, bridges, shore, beach } = sheet;

  // A Major Bridge falls back to the plain deck, and a Blown Bridge to bare river, in packs without them.
  const deck = id === "bridge" ? bridges : id === "majorBridge" ? (sheet.majorBridges ?? bridges) : id === "blownBridge" ? sheet.blownBridges : undefined;
  if (BRIDGES.includes(id) && connected.river !== undefined) {
    const base = tile(connected.river + joinMask(map, x, y, RIVER_JOINS));
    return deck ? [base, tile(bridgeRunsAcross(map, x, y) ? deck.horizontal : deck.vertical)] : [base];
  }
  if (id === "road" && connected.road !== undefined) return [tile(connected.road + joinMask(map, x, y, ROAD_JOINS))];
  if (id === "river" && connected.river !== undefined) return [tile(connected.river + joinMask(map, x, y, RIVER_JOINS, railCrossingAt(map)))];
  if (id === "railway") {
    if (isRailCrossing(map, x, y) && connected.river !== undefined && sheet.railBridges) {
      const base = tile(connected.river + joinMask(map, x, y, RIVER_JOINS, railCrossingAt(map)));
      return [base, tile(bridgeRunsAcross(map, x, y) ? sheet.railBridges.horizontal : sheet.railBridges.vertical)];
    }
    if (connected.railway !== undefined) return [tile(connected.railway + joinMask(map, x, y, ["railway"]))];
  }

  if (id === "beach" && beach !== undefined) {
    const mask = beachWaterMask(map, x, y);
    const sand = sheet.tiles.beach;
    const base = mask === 0 && sand && sand.length > 0 ? (sand[variantFor(x, y, sand.length)] ?? beach) : beach + mask;
    const flares = sheet.beachFlares;
    return [
      tile(base),
      ...beachCorners(map, x, y).map((c) => tile(beach + 16 + c)),
      ...(flares === undefined ? [] : beachFlares(map, x, y).map((f) => tile(flares + f))),
    ];
  }

  const variants = sheet.tiles[id];
  if (!variants || variants.length === 0) return placeholder;
  const layers = [tile(variants[variantFor(x, y, variants.length)] ?? 0)];
  if ((id === "sea" || id === "reef") && shore !== undefined) {
    for (const piece of shorePieces(map, x, y, beach !== undefined)) layers.push(tile(shore + piece));
  }
  return layers;
}
