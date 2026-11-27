// Draws the Supply Truck's 32x32 map sprites (01-units §2, 05-supply-transport §3, 08-art-pipeline §17):
// each nation's army lorry, facing right, with an open bed of ammunition boxes and jerrycans. It
// took over resupply from the Halftrack on 2026-11-27. The side view is drawn here; the front and
// rear come from facings32.mjs. One row per sheet, as for the Radar Station: side, down, up, two
// frames each (§22).
//
// Run: node tools/art/supplytruck32.mjs   (writes public/assets/units/{nation}-truck-32-*.png and docs/art/supply-trucks-32.png)

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { arches, balkenkreuz, finish, fixedColors, grille, redStar, roundelMark, sprite, star, teamRamps, wheelsInWells } from "./kit32.mjs";
import { supplyTruckViews } from "./facings32.mjs";
import { canvas, savePng, stamp } from "./png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/**
 * The side view. o.cab: "round" (a closed cab with a rounded roof: GMC, Opel Blitz, Bedford,
 * Isuzu) or "open" (an open cab with a canvas hood: ZIS-5, SPA). o.mark paints the nation's
 * marking on the door, if it carried one.
 */
function side(o) {
  return (frame) => {
    const s = sprite();
    const dip = frame;
    const wheels = [[6, 26.5, 3.5], [13, 26.5, 3.5], [26, 26.5, 3.5]];
    // Chassis and the bed's sides, with board seams.
    s.rect(1, 20 + dip, 31, 24 + dip, "team", 3);
    arches(s, wheels);
    s.rect(1, 15 + dip, 18, 21 + dip, "team", 2, true);
    for (let x = 5; x < 18; x += 4) s.line(x, 16 + dip, x, 20 + dip, "team", 3);
    // The load above the boards: two ammunition boxes and two jerrycans.
    s.rect(2, 11 + dip, 6, 15 + dip, "wood", 1, true);
    s.fill(3, 13 + dip, 5, 13 + dip, "wood", 3);
    s.rect(7, 12 + dip, 10, 15 + dip, "wood", 1, true);
    s.rect(11, 10 + dip, 13, 15 + dip, "metal", 2, true);
    s.fill(12, 10 + dip, 12, 10 + dip, "metal", 0);
    s.rect(14, 10 + dip, 16, 15 + dip, "metal", 2, true);
    s.fill(15, 10 + dip, 15, 10 + dip, "metal", 0);
    // The cab.
    if (o.cab === "open") {
      s.rect(19, 10 + dip, 25, 12 + dip, "canvas", 2, true);
      s.rect(19, 13 + dip, 25, 21 + dip, "team", 1, true);
      s.fill(21, 13 + dip, 24, 14 + dip, "glass", 0);
    } else {
      s.rect(19, 10 + dip, 25, 21 + dip, "team", 1, true);
      s.fill(19, 10 + dip, 19, 10 + dip, "team", 4);
      s.fill(21, 12 + dip, 24, 14 + dip, "glass", 0);
    }
    if (o.mark) o.mark(s, 19, 16 + dip);
    // The bonnet and the grille at the front.
    s.rect(26, 14 + dip, 31, 21 + dip, "team", 2, true);
    grille(s, 30, 31, 15 + dip, 20 + dip);
    wheelsInWells(s, wheels, frame);
    return finish(s);
  };
}

const smallCross = (s, x, y) => balkenkreuz(s, x + 1, y, 5);

const NATIONS = [
  { id: "us", real: "GMC CCKW 2½-ton", cab: "round", mark: star, view: undefined, teams: ["olive", "red", "blue"] },
  { id: "de", real: "Opel Blitz", cab: "round", mark: smallCross, view: undefined, teams: ["grey", "olive", "red", "blue"] },
  { id: "jp", real: "Isuzu Type 94", cab: "round", mark: null, view: undefined, teams: ["khaki", "olive", "red", "blue"] },
  { id: "su", real: "ZIS-5", cab: "open", mark: redStar, view: "redStar", teams: ["green4bo", "olive", "red", "blue"] },
  { id: "uk", real: "Bedford OY", cab: "round", mark: roundelMark, view: undefined, teams: ["brown", "olive", "red", "blue"] },
  // Italy wears blue, its azzurro (18-scenarios-north-africa §1).
  { id: "it", real: "SPA Dovunque 35", cab: "open", mark: null, view: undefined, teams: ["blue", "olive", "red"] },
];

const rows = NATIONS.map((n) => {
  const draw = side(n);
  const frames = [draw(0), draw(1)];
  const views = supplyTruckViews(n.view);
  const all = [...frames, ...views.down, ...views.up];
  for (const f of all) if (f.length !== 32 || f.some((r) => r.length !== 32)) throw new Error(`${n.id} supply truck is not 32x32`);
  return { ...n, all };
});

for (const { id, all, teams } of rows) {
  for (const team of teams) {
    const sheet = canvas(32 * 6, 32);
    all.forEach((f, col) => stamp(sheet, f, { ...fixedColors, ...teamRamps[team] }, col * 32, 0));
    savePng(sheet, join(root, "public", "assets", "units", `${id}-truck-32-${team}.png`));
  }
}

// Docs preview: each nation's truck in its own color, side, down and up, on grass at 3x.
const scale = 3, cell = 32 * scale, gap = 6;
const preview = canvas(6 * (cell + 2) - 2, rows.length * (cell + gap) - gap);
preview.px.fill(255);
rows.forEach(({ all, teams }, r) => {
  all.forEach((f, col) => {
    stamp(preview, Array(32).fill("G".repeat(32)), { G: "#8cc25a" }, col * (cell + 2), r * (cell + gap), scale);
    stamp(preview, f, { ...fixedColors, ...teamRamps[teams[0]] }, col * (cell + 2), r * (cell + gap), scale);
  });
});
savePng(preview, join(root, "docs", "art", "supply-trucks-32.png"));
console.log(`supply trucks rendered for ${rows.length} nations`);
