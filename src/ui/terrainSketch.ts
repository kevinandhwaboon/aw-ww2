// The map select's terrain sketch (00-master-design §12): a map's big geographic features on a
// coarse grid, the way a briefing chart shows them, rather than a shrunken copy of every square.
// Each sketch cell covers a block of squares and shows what most of that block is.

import type { TerrainId } from "../engine/data/terrain";
import type { GameMap } from "../engine/map";

export const SKETCH_FEATURES = ["sea", "land", "forest", "hills", "river", "marsh"] as const;
export type SketchFeature = (typeof SKETCH_FEATURES)[number];

/** Which feature each terrain counts toward. Buildings, roads and works are just land at this scale. */
const FEATURE_OF: Readonly<Record<TerrainId, SketchFeature>> = {
  plains: "land",
  road: "land",
  bridge: "river",
  forest: "forest",
  hills: "hills",
  river: "river",
  bocage: "forest",
  sea: "sea",
  beach: "land",
  reef: "sea",
  city: "land",
  factory: "land",
  airfield: "land",
  port: "land",
  hq: "land",
  bunker: "land",
  rubble: "land",
  obstacle: "land",
  majorBridge: "river",
  blownBridge: "river",
  minefield: "land",
  ridge: "hills",
  saltMarsh: "marsh",
  railway: "land",
};

export interface TerrainSketch {
  readonly columns: number;
  readonly rows: number;
  /** Row-major, like the map. */
  readonly cells: readonly SketchFeature[];
  /** How many map squares each cell spans, across and down. */
  readonly cellSize: number;
}

/** About how many cells the longer side of a sketch has. */
export const SKETCH_CELLS = 22;

/**
 * The sketch of `map`. A block that's half sea or more is sea, and so is one a narrow channel of
 * water runs through between two banks. A river or bridge crossing a block
 * keeps it a river, so rivers stay unbroken lines; otherwise the block is forest, hills or marsh if
 * that covers two fifths of it, and plain land if not.
 */
export function sketchMap(map: GameMap, cells = SKETCH_CELLS): TerrainSketch {
  const cellSize = Math.max(1, Math.round(Math.max(map.width, map.height) / cells));
  const columns = Math.ceil(map.width / cellSize);
  const rows = Math.ceil(map.height / cellSize);
  const out: SketchFeature[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < columns; col++) {
      const counts: Record<SketchFeature, number> = { sea: 0, land: 0, forest: 0, hills: 0, river: 0, marsh: 0 };
      let total = 0;
      for (let y = row * cellSize; y < Math.min(map.height, (row + 1) * cellSize); y++) {
        for (let x = col * cellSize; x < Math.min(map.width, (col + 1) * cellSize); x++) {
          const terrain = map.terrain[y * map.width + x];
          if (terrain === undefined) continue;
          counts[FEATURE_OF[terrain]]++;
          total++;
        }
      }
      out.push(channel(map, col * cellSize, row * cellSize, cellSize, counts.sea) ? "sea" : featureOf(counts, total, cellSize));
    }
  }
  return { columns, rows, cells: out, cellSize };
}

/**
 * Whether a narrow channel of water runs through the block with land on both banks, like the Volga
 * at Stalingrad: a whole row's worth of sea, and some row or column of the block that goes land,
 * water, land (looking one square past the block). Shown as water even though it's under half the block, so the channel stays an
 * unbroken line. A coast, with land on one side only, isn't a channel.
 */
function channel(map: GameMap, x0: number, y0: number, cellSize: number, sea: number): boolean {
  if (sea < Math.max(1, Math.ceil(cellSize / 2))) return false;
  /** "S" water, "L" land, "O" off the map (neither: a map's edge is never a bank). */
  const at = (x: number, y: number) => (x < 0 || y < 0 || x >= map.width || y >= map.height ? "O" : map.terrain[y * map.width + x] === "sea" ? "S" : "L");
  const x1 = Math.min(map.width, x0 + cellSize);
  const y1 = Math.min(map.height, y0 + cellSize);
  // Each line reaches one square past the block on both ends, so a channel along the block's edge
  // still has its far bank.
  const crosses = (cells: readonly string[]) => {
    const first = cells.indexOf("S");
    const last = cells.lastIndexOf("S");
    return first >= 0 && cells.slice(0, first).includes("L") && cells.slice(last + 1).includes("L");
  };
  for (let y = y0; y < y1; y++) {
    const line: string[] = [];
    for (let x = x0 - 1; x <= x1; x++) line.push(at(x, y));
    if (crosses(line)) return true;
  }
  for (let x = x0; x < x1; x++) {
    const line: string[] = [];
    for (let y = y0 - 1; y <= y1; y++) line.push(at(x, y));
    if (crosses(line)) return true;
  }
  return false;
}

function featureOf(counts: Readonly<Record<SketchFeature, number>>, total: number, cellSize: number): SketchFeature {
  if (total === 0 || counts.sea * 2 >= total) return "sea";
  // A river runs about one square wide through a block, so a whole row's worth of it counts.
  if (counts.river >= Math.max(1, Math.ceil(cellSize * 0.75))) return "river";
  const [best, most] = (["forest", "hills", "marsh"] as const).map((f) => [f, counts[f]] as const).reduce((a, b) => (b[1] > a[1] ? b : a));
  return most * 5 >= total * 2 ? best : "land";
}
