// Renders the terrain tiles in terrain.mjs and the buildings in buildings.mjs to sprite sheets. Run with `npm run art`.
// Layout: docs/08-art-pipeline.md §14.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canvas, savePng, stamp } from "./png.mjs";
import { ACROSS, FRAMES, layout, palette } from "./terrain.mjs";
import { columns, palette as buildingPalette, ramps, rows as buildings } from "./buildings.mjs";

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

// Buildings: one row per property, one column per owner, each recolored with that owner's ramp.
const buildingSheet = canvas(columns.length * 16, buildings.length * 16);
buildings.forEach(([, grid], row) => columns.forEach((owner, col) => {
  stamp(buildingSheet, grid, { ...buildingPalette, ...ramps[owner] }, col * 16, row * 16);
}));
savePng(buildingSheet, join(dir, "buildings.png"));

console.log(`buildings: ${buildings.length} properties, ${columns.length} owners`);
console.log(`terrain: ${layout.filter(Boolean).length} tiles, ${FRAMES} frames`);
