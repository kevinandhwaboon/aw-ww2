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

// ---- 32x32 units (08-art-pipeline §17). Each row runs side, front (moving down) and rear (moving
// up) views, two frames each (§22): six 32-pixel frames across.
const { fixedColors, teamRamps } = await import("./kit32.mjs");
const { landViews, paratrooperViews, ukParatrooperViews } = await import("./facings32.mjs");
/** Every frame of a row, left to right: side, down, up. */
const rowFrames = (u) => [...u.frames, ...u.views.down, ...u.views.up];
const COLUMNS = 6;
/** Docs preview of the moving views: per unit, the side view, then front and rear, both frames. */
function facingPreview(list, team, groundFor, file) {
  const scale = 3, cell = 32 * scale, gap = 6, across = 2, width = 5 * (cell + 2) + gap;
  const preview = canvas(across * width - gap, Math.ceil(list.length / across) * (cell + gap) - gap);
  preview.px.fill(255);
  list.forEach((u, i) => {
    const x = (i % across) * width, y = Math.floor(i / across) * (cell + gap);
    [u.frames[0], ...u.views.down, ...u.views.up].forEach((f, col) => {
      stamp(preview, Array(32).fill("G".repeat(32)), { G: groundFor(u) }, x + col * (cell + 2), y, scale);
      stamp(preview, f, { ...fixedColors, ...teamRamps[team] }, x + col * (cell + 2), y, scale);
    });
  });
  savePng(preview, join(previewDir, file));
}
const { units: us32, paratroopers } = await import("./us-units32.mjs");
const { units: de32 } = await import("./de-units32.mjs");
const { units: jp32 } = await import("./jp-units32.mjs");
const { units: su32 } = await import("./su-units32.mjs");
const { units: uk32, paratroopers: ukParatroopers } = await import("./uk-units32.mjs");
const { units: it32 } = await import("./it-units32.mjs");
// Each nation's natural color first (used for the docs preview), then the player colors.
const big = [
  { id: "us", units: us32, extra: paratroopers.map((u) => ({ ...u, views: paratrooperViews(u.code.slice(3)) })), teams: ["olive", "red", "blue"] },
  { id: "de", units: de32, extra: [], teams: ["grey", "olive", "red", "blue"] },
  { id: "jp", units: jp32, extra: [], teams: ["khaki", "olive", "red", "blue"] },
  { id: "su", units: su32, extra: [], teams: ["green4bo", "olive", "red", "blue"] },
  { id: "uk", units: uk32, extra: ukParatroopers.map((u) => ({ ...u, views: ukParatrooperViews(u.head) })), teams: ["brown", "olive", "red", "blue"] },
  // Italy wears blue, its azzurro (18-scenarios-north-africa §1).
  { id: "it", units: it32, extra: [], teams: ["blue", "olive", "red"] },
];
for (const { id, units, extra, teams: names } of big) {
  // Rows: the land units in §4 order, then any variants (the US paratrooper's four card suits, the
  // UK's airborne helmet and red beret).
  const rows = [
    ...landRows.map((code) => units.find((u) => u.code === code)).map((u) => u && { ...u, views: landViews(id, u.code) }),
    ...extra,
  ];
  for (const team of names) {
    const sheet = canvas(32 * COLUMNS, 32 * rows.length);
    rows.forEach((u, row) => u && rowFrames(u).forEach((f, col) => stamp(sheet, f, { ...fixedColors, ...teamRamps[team] }, col * 32, row * 32)));
    savePng(sheet, join(sheetDir, `${id}-land-32-${team}.png`));
  }
  const shown = rows.filter((u) => u !== undefined);
  const scale = 3, cell = 32 * scale, gap = 6, across = 4;
  const preview = canvas(across * (cell * 2 + 2 + gap) - gap, Math.ceil(shown.length / across) * (cell + gap) - gap);
  preview.px.fill(255);
  shown.forEach((u, i) => {
    const x = (i % across) * (cell * 2 + 2 + gap), y = Math.floor(i / across) * (cell + gap);
    u.frames.forEach((f, col) => {
      stamp(preview, Array(32).fill("G".repeat(32)), { G: grass }, x + col * (cell + 2), y, scale);
      stamp(preview, f, { ...fixedColors, ...teamRamps[names[0]] }, x + col * (cell + 2), y, scale);
    });
  });
  savePng(preview, join(previewDir, `${id}-land-units-32.png`));
  facingPreview(shown, names[0], () => grass, `${id}-land-facings-32.png`);
  console.log(`${id}: ${shown.length} land units rendered at 32x32`);
}

// ---- 32x32 aircraft and ships. Rows: FT, BM, TA, DB, TR and BB, DD, SS, LC, TB, CV, SP; empty where a nation has none.
const { usAir, usNaval, deAir, deNaval, jpAir, jpNaval, suAir, suNaval, ukAir, ukNaval, itAir } = await import("./air-naval32.mjs");
const airRows = ["FT", "BM", "TA", "DB", "TR"];
const navalRows = ["BB", "DD", "SS", "LC", "TB", "CV", "SP"];
for (const { id, air, naval, teams: names } of [
  { id: "us", air: usAir, naval: usNaval, teams: ["olive", "red", "blue"] },
  { id: "de", air: deAir, naval: deNaval, teams: ["grey", "olive", "red", "blue"] },
  { id: "jp", air: jpAir, naval: jpNaval, teams: ["khaki", "olive", "red", "blue"] },
  { id: "su", air: suAir, naval: suNaval, teams: ["green4bo", "olive", "red", "blue"] },
  { id: "uk", air: ukAir, naval: ukNaval, teams: ["brown", "olive", "red", "blue"] },
  { id: "it", air: itAir, naval: [], teams: ["blue", "olive", "red"] },
]) {
  for (const [kind, list, order] of [["air", air, airRows], ["naval", naval, navalRows]]) {
    if (list.length === 0) continue;
    const rows = order.map((code) => list.find((u) => u.code === code));
    for (const team of names) {
      const sheet = canvas(32 * COLUMNS, 32 * rows.length);
      rows.forEach((u, row) => u && rowFrames(u).forEach((f, col) => stamp(sheet, f, { ...fixedColors, ...teamRamps[team] }, col * 32, row * 32)));
      savePng(sheet, join(sheetDir, `${id}-${kind}-32-${team}.png`));
    }
  }
  const shown = [...air, ...naval];
  const scale = 3, cell = 96, gap = 6, across = 4;
  const preview = canvas(across * (cell * 2 + 2 + gap) - gap, Math.ceil(shown.length / across) * (cell + gap) - gap);
  preview.px.fill(255);
  shown.forEach((u, i) => {
    const x = (i % across) * (cell * 2 + 2 + gap), y = Math.floor(i / across) * (cell + gap);
    const ground = air.includes(u) ? grass : "#3f86c8";
    u.frames.forEach((f, col) => {
      stamp(preview, Array(32).fill("G".repeat(32)), { G: ground }, x + col * (cell + 2), y, scale);
      stamp(preview, f, { ...fixedColors, ...teamRamps[names[0]] }, x + col * (cell + 2), y, scale);
    });
  });
  savePng(preview, join(previewDir, naval.length ? `${id}-air-naval-32.png` : `${id}-air-32.png`));
  facingPreview(shown, names[0], (u) => (air.includes(u) ? grass : "#3f86c8"), naval.length ? `${id}-air-naval-facings-32.png` : `${id}-air-facings-32.png`);
  console.log(`${id}: ${air.length} aircraft and ${naval.length} ships rendered at 32x32`);
}
