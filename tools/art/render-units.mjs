// Renders the unit pixel grids in us-units.mjs and de-units.mjs to PNG sprite sheets. Run with `npm run art`.
// Layout and palette rules: docs/08-art-pipeline.md §12.
import { mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { units as usUnits } from "./us-units.mjs";
import { units as deUnits } from "./de-units.mjs";
import { canvas, savePng, stamp } from "./png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const sheetDir = join(root, "public", "assets", "units");
const previewDir = join(root, "docs", "art");
mkdirSync(sheetDir, { recursive: true });
mkdirSync(previewDir, { recursive: true });

// Sheet rows, in 08-art-pipeline §4 order. A nation with no art for a unit leaves that row empty.
const landRows = ["IN", "AI", "MO", "RC", "HT", "LT", "MT", "HV", "TD", "AR", "RK", "AA", "FK"];

const fixed = {
  K: "#1a1a16", t: "#2e2c26", r: "#6a665a", W: "#8c8878", h: "#4a473e", S: "#f2efe0",
  o: "#e8b888", b: "#8a5a30", B: "#b07a42", c: "#a8d8e8", f: "#e8f4f8", P: "#c8c4b4",
};
// Only these ramps change per team. The colors are placeholders until team colors are decided.
const olive = { L: "#a3a55c", M: "#73793f", D: "#4c5430" };
const grey = { L: "#a2a89e", M: "#6c736c", D: "#454b47" };
const teams = {
  blue: { L: "#7fb0e8", M: "#3f74c4", D: "#274a8c" },
  red: { L: "#ec8a70", M: "#c4482f", D: "#842c20" },
};
const grass = "#8cc25a";

const nations = [
  { id: "us", units: usUnits, natural: { olive } },
  { id: "de", units: deUnits, natural: { grey } },
];

for (const { id, units, natural } of nations) {
  const landUnits = landRows.map((code) => units.find((u) => u.code === code));

  // One sheet per team: a row per unit, 2 frames across, transparent background.
  for (const [team, ramp] of Object.entries({ ...natural, ...teams })) {
    const sheet = canvas(32, 16 * landRows.length);
    landUnits.forEach((u, row) => u?.frames.forEach((f, col) => {
      stamp(sheet, f, { ...fixed, ...ramp }, col * 16, row * 16);
    }));
    savePng(sheet, join(sheetDir, `${id}-land-${team}.png`));
  }

  // Preview for docs: every land unit's two frames on grass at 4x.
  const scale = 4, cell = 16 * scale, gap = 6, across = 4;
  const shown = landUnits.filter((u) => u !== undefined);
  const preview = canvas(
    across * (cell * 2 + 2 + gap) - gap,
    Math.ceil(shown.length / across) * (cell + gap) - gap,
  );
  preview.px.fill(255);
  shown.forEach((u, i) => {
    const x = (i % across) * (cell * 2 + 2 + gap);
    const y = Math.floor(i / across) * (cell + gap);
    u.frames.forEach((f, col) => {
      const ox = x + col * (cell + 2);
      stamp(preview, Array(16).fill("G".repeat(16)), { G: grass }, ox, y, scale);
      stamp(preview, f, { ...fixed, ...Object.values(natural)[0] }, ox, y, scale);
    });
  });
  savePng(preview, join(previewDir, `${id}-land-units.png`));

  console.log(`${id}: ${shown.length} land units rendered`);
}
