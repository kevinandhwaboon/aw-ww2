// Draws a terrain sketch (terrainSketch.ts) as a small briefing chart: one 6-pixel cell per block,
// a tiny mark for forest and hills, colored for the map's season from the art pack.

import type { Season } from "../engine/data/weather";
import { packColor, terrainName, type ColorKey } from "../game/artPack";
import { shade } from "../game/battle/colors";
import type { SketchFeature, TerrainSketch } from "./terrainSketch";

export const SKETCH_CELL = 6;

const PALETTE: Readonly<Record<Season, Readonly<Record<SketchFeature, readonly [ColorKey, ColorKey]>>>> = {
  summer: {
    sea: ["battleSea", "battleSeaLight"],
    land: ["battleGrass", "battleGrassLight"],
    forest: ["battleTree", "battleTreeDark"],
    hills: ["battleHill", "battleGrassDark"],
    river: ["battleSeaLight", "battleSea"],
    marsh: ["battleSalt", "battleSaltDark"],
  },
  winter: {
    sea: ["battleSea", "battleSeaLight"],
    land: ["battleSnow", "battleSnowLight"],
    forest: ["battleWinterTree", "battleWinterTreeDark"],
    hills: ["battleSnowHill", "battleSnowDark"],
    river: ["battleSeaLight", "battleSea"],
    marsh: ["battleSalt", "battleSaltDark"],
  },
  desert: {
    sea: ["battleSea", "battleSeaLight"],
    land: ["battleDesert", "battleDesertLight"],
    forest: ["battleDesertScrub", "battleDesertScrubDark"],
    hills: ["battleDesertHill", "battleDesertDark"],
    river: ["battleSeaLight", "battleSea"],
    marsh: ["battleSalt", "battleSaltDark"],
  },
};

/** What the legend calls each feature, from the art pack's terrain names. */
export const featureName = (feature: SketchFeature): string =>
  feature === "land" ? terrainName("plains") : feature === "marsh" ? terrainName("saltMarsh") : terrainName(feature);

export const featureColor = (feature: SketchFeature, season: Season): string => packColor(PALETTE[season][feature][0]);

export function drawSketch(canvas: HTMLCanvasElement, sketch: TerrainSketch, season: Season): void {
  const c = SKETCH_CELL;
  canvas.width = sketch.columns * c + 1;
  canvas.height = sketch.rows * c + 1;
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  // A thin frame round the chart; inside it each cell's own edge, a shade darker, draws the grid.
  ctx.fillStyle = packColor("sketchGrid");
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  sketch.cells.forEach((feature, i) => {
    const col = i % sketch.columns;
    const row = Math.floor(i / sketch.columns);
    const x = col * c + 1, y = row * c + 1;
    const [fill, mark] = PALETTE[season][feature];
    ctx.fillStyle = shade(packColor(fill), 0.84);
    ctx.fillRect(x, y, c, c);
    ctx.fillStyle = packColor(fill);
    ctx.fillRect(x, y, c - 1, c - 1);
    ctx.fillStyle = packColor(mark);
    if (feature === "forest") {
      ctx.fillRect(x + 1, y + 1, 2, 2);
      ctx.fillRect(x + 3, y + 3, 1, 1);
    } else if (feature === "hills") {
      ctx.fillRect(x + 2, y + 1, 1, 1);
      ctx.fillRect(x + 1, y + 2, 1, 1);
      ctx.fillRect(x + 3, y + 2, 1, 1);
    } else if (feature === "sea" && (col + row * 3) % 4 === 0) {
      ctx.fillRect(x + 1, y + 2, 2, 1);
    } else if (feature === "marsh") {
      ctx.fillRect(x + 1, y + 1, 1, 1);
      ctx.fillRect(x + 3, y + 3, 1, 1);
    }
  });
}
