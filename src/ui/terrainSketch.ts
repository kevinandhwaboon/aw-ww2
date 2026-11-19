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
 * The sketch of `map`. A block that's half sea or more is sea. A river or bridge crossing a block
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
      out.push(featureOf(counts, total, cellSize));
    }
  }
  return { columns, rows, cells: out, cellSize };
}

function featureOf(counts: Readonly<Record<SketchFeature, number>>, total: number, cellSize: number): SketchFeature {
  if (total === 0 || counts.sea * 2 >= total) return "sea";
  // A river runs about one square wide through a block, so a whole row's worth of it counts.
  if (counts.river >= Math.max(1, Math.ceil(cellSize * 0.75))) return "river";
  const [best, most] = (["forest", "hills", "marsh"] as const).map((f) => [f, counts[f]] as const).reduce((a, b) => (b[1] > a[1] ? b : a));
  return most * 5 >= total * 2 ? best : "land";
}
