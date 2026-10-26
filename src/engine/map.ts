import type { TerrainId } from "./data/terrain";

export interface GameMap {
  readonly width: number;
  readonly height: number;
  /** Row-major: index = y * width + x. */
  readonly terrain: readonly TerrainId[];
}

export interface Point {
  readonly x: number;
  readonly y: number;
}

/** One character per terrain, for readable maps in tests and placeholder maps. */
export const DEFAULT_LEGEND: Readonly<Record<string, TerrainId>> = {
  ".": "plains",
  "=": "road",
  "#": "bridge",
  F: "forest",
  H: "hills",
  "~": "river",
  b: "bocage",
  S: "sea",
  _: "beach",
  r: "reef",
  C: "city",
  f: "factory",
  A: "airfield",
  P: "port",
  Q: "hq",
  X: "bunker",
  x: "rubble",
  o: "obstacle",
};

/** Parses rows of equal length, e.g. ["..F", "=.."], into a map. Whitespace is ignored. */
export function parseAsciiMap(
  rows: readonly string[],
  legend: Readonly<Record<string, TerrainId>> = DEFAULT_LEGEND,
): GameMap {
  const cleaned = rows.map((row) => row.replace(/\s+/g, "")).filter((row) => row.length > 0);
  const first = cleaned[0];
  if (first === undefined) throw new Error("Map has no rows");
  const width = first.length;
  const terrain: TerrainId[] = [];
  cleaned.forEach((row, y) => {
    if (row.length !== width) {
      throw new Error(`Row ${y} has length ${row.length}, expected ${width}`);
    }
    for (const [x, ch] of row.split("").entries()) {
      const id = legend[ch];
      if (id === undefined) throw new Error(`Unknown map character "${ch}" at (${x}, ${y})`);
      terrain.push(id);
    }
  });
  return { width, height: cleaned.length, terrain };
}

export function inBounds(map: GameMap, p: Point): boolean {
  return p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height;
}

export function terrainAt(map: GameMap, p: Point): TerrainId {
  const id = inBounds(map, p) ? map.terrain[p.y * map.width + p.x] : undefined;
  if (id === undefined) throw new Error(`Point (${p.x}, ${p.y}) is outside the map`);
  return id;
}
