// Renders the terrain tiles in terrain.mjs to one sprite sheet. Run with `npm run art`.
// Layout: docs/08-art-pipeline.md §14.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canvas, savePng, stamp } from "./png.mjs";
import { ACROSS, FRAMES, layout, palette } from "./terrain.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = join(root, "public", "assets", "terrain");
mkdirSync(dir, { recursive: true });

// One panel per animation frame, stacked top to bottom, each with the same layout.
const rows = Math.ceil(layout.length / ACROSS);
const sheet = canvas(ACROSS * 16, rows * 16 * FRAMES);
layout.forEach((entry, i) => {
  if (!entry) return;
  const x = (i % ACROSS) * 16, y = Math.floor(i / ACROSS) * 16;
  entry[1].forEach((grid, frame) => stamp(sheet, grid, palette, x, y + frame * rows * 16));
});
savePng(sheet, join(dir, "terrain.png"));

console.log(`terrain: ${layout.filter(Boolean).length} tiles, ${FRAMES} frames`);
