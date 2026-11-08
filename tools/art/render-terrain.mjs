// Renders the terrain tiles in terrain.mjs and the buildings in buildings.mjs to sprite sheets. Run with `npm run art`.
// Layout: docs/08-art-pipeline.md §14.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { canvas, savePng, stamp } from "./png.mjs";
import { ACROSS, FRAMES, layout, palette, TILE_HEIGHT } from "./terrain.mjs";
import { columns, palette as buildingPalette, ramps, rows as buildings } from "./buildings.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const dir = join(root, "public", "assets", "terrain");
mkdirSync(dir, { recursive: true });

// One panel per animation frame, stacked top to bottom, each with the same layout.
const rows = Math.ceil(layout.length / ACROSS);
const sheet = canvas(ACROSS * 16, rows * TILE_HEIGHT * FRAMES);
layout.forEach((entry, i) => {
  if (!entry) return;
  const x = (i % ACROSS) * 16, y = Math.floor(i / ACROSS) * TILE_HEIGHT;
  entry[1].forEach((grid, frame) => stamp(sheet, grid, palette, x, y + frame * rows * TILE_HEIGHT));
});
savePng(sheet, join(dir, "terrain.png"));

// Buildings: one row per property, one column per owner, each recolored with that owner's ramp.
const buildingSheet = canvas(columns.length * 16, buildings.length * TILE_HEIGHT);
buildings.forEach(([, grid], row) => columns.forEach((owner, col) => {
  stamp(buildingSheet, grid, { ...buildingPalette, ...ramps[owner] }, col * 16, row * TILE_HEIGHT);
}));
savePng(buildingSheet, join(dir, "buildings.png"));

console.log(`buildings: ${buildings.length} properties, ${columns.length} owners`);
console.log(`terrain: ${layout.filter(Boolean).length} tiles, ${FRAMES} frames`);

// ---- The 32-pixel grid's terrain and buildings (08-art-pipeline §17): 32x64 tiles, same layouts.
// Not used by the game until the map moves to a 32-pixel grid.
const t32 = await import("./terrain32.mjs");
const b32 = await import("./buildings32.mjs");
{
  const rows32 = Math.ceil(t32.layout.length / t32.ACROSS);
  const sheet32 = canvas(t32.ACROSS * 32, rows32 * 64 * t32.FRAMES);
  t32.layout.forEach((entry, i) => {
    const x = (i % t32.ACROSS) * 32, y = Math.floor(i / t32.ACROSS) * 64;
    entry[1].forEach((grid, frame) => stamp(sheet32, grid, t32.palette, x, y + frame * rows32 * 64));
  });
  savePng(sheet32, join(dir, "terrain-32.png"));
  const bSheet = canvas(b32.columns.length * 32, b32.rows.length * 64);
  b32.rows.forEach(([, grid], row) => b32.columns.forEach((owner, col) => {
    stamp(bSheet, grid, { ...b32.palette, ...b32.ramps[owner] }, col * 32, row * 64);
  }));
  savePng(bSheet, join(dir, "buildings-32.png"));
  console.log(`terrain and buildings rendered at 32x64`);
}

// ---- Winter versions of the 32-pixel terrain and buildings (08-art-pipeline §21): same layouts,
// so the same tile numbers. Buildings keep their owner roofs and stand on snow.
const w32 = await import("./terrain32-winter.mjs");
{
  const rows32 = Math.ceil(w32.layout.length / w32.ACROSS);
  const sheet = canvas(w32.ACROSS * 32, rows32 * 64 * w32.FRAMES);
  w32.layout.forEach((entry, i) => {
    const x = (i % w32.ACROSS) * 32, y = Math.floor(i / w32.ACROSS) * 64;
    entry[1].forEach((grid, frame) => stamp(sheet, grid, w32.palette, x, y + frame * rows32 * 64));
  });
  savePng(sheet, join(dir, "terrain-32-winter.png"));
  const winterBuildings = { ...b32.palette, ...w32.palette, W: b32.palette.W, Y: b32.palette.Y, Z: b32.palette.Z, c: b32.palette.c };
  const bSheet = canvas(b32.columns.length * 32, b32.rows.length * 64);
  b32.rows.forEach(([, grid], row) => b32.columns.forEach((owner, col) => {
    stamp(bSheet, grid, { ...winterBuildings, ...b32.ramps[owner] }, col * 32, row * 64);
  }));
  savePng(bSheet, join(dir, "buildings-32-winter.png"));
  console.log(`winter terrain and buildings rendered at 32x64`);
}
