// Draws the Railway Gun's 32x32 map sprite (01-units §2b, 08-art-pipeline §17): Schwerer Gustav, the
// 80 cm Krupp gun, seen from above and a little to the side. A long girder carriage in the team color
// on two bogie groups, the cradle amidships and the huge barrel cocked up to the right, with the
// Balkenkreuz on the carriage side. The down and up views show it end-on, the barrel pointing toward
// or away from the viewer, for moving along a line that runs up or down the map. The second idle
// frame has a wisp of smoke at the muzzle. Only Germany has one.
//
// Run: node tools/art/railgun32.mjs   (writes public/assets/units/de-railgun-32-*.png and docs/art/de-railgun-32.png)

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { balkenkreuz, finish, fixedColors, sprite, teamRamps } from "./kit32.mjs";
import { canvas, savePng, stamp } from "./png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** The double track under the gun: two pairs of rails on sleepers. */
function rails(s, x0, x1, y) {
  s.rect(x0, y, x1, y + 2, "darkwood", 1);
  s.shape();
  for (let x = x0; x <= x1; x += 2) s.dot(x, y + 1, "leather", 2);
  s.line(x0, y, x1, y, "metal", 1);
  s.line(x0, y + 2, x1, y + 2, "metal", 3);
}

function side(smoke) {
  const s = sprite();
  s.oval(15.5, 28.5, 15, 2.5, "canvas", 3);
  rails(s, 0, 31, 27);
  // Two bogie groups, each a frame on four small wheels.
  for (const x0 of [2, 19]) {
    s.rect(x0, 22, x0 + 10, 25, "team", 3);
    for (let k = 0; k < 4; k++) s.oval(x0 + 1.5 + k * 2.6, 26, 1.2, 1.2, "rubber", 2);
  }
  // The girder carriage, long and low, with the ammunition hoist at the back.
  s.rect(1, 16, 30, 22, "team", 2, true);
  s.fill(2, 17, 29, 17, "team", 1);
  balkenkreuz(s, 4, 17, 5);
  s.rect(1, 11, 5, 16, "team", 3);
  // The cradle tower amidships.
  s.poly([[9, 16], [12, 9], [20, 9], [22, 16]], "team", 2);
  s.oval(16, 11, 2, 2, "metal", 3);
  // The barrel: thick at the breech behind the cradle, tapering up and to the right.
  s.bar(9, 14, 31, 2, 4, "team", 2);
  s.bar(20, 8, 31, 2, 3, "team", 1);
  s.rect(7, 12, 10, 16, "metal", 3);
  if (smoke) {
    s.oval(29.5, 1.5, 1.6, 1.3, "canvas", 0);
  }
  return finish(s);
}

/** End-on, the barrel toward the viewer (down) or away from them (up). */
function endOn(toward, smoke) {
  const s = sprite();
  s.oval(15.5, 28.5, 12, 2.5, "canvas", 3);
  // Both tracks, seen end-on: two rails each side.
  s.rect(4, 26, 27, 28, "darkwood", 1);
  for (const x of [5, 10, 21, 26]) s.rect(x, 26, x + 1, 27, "metal", 2);
  // Bogies under each side of the carriage.
  s.rect(4, 21, 12, 26, "team", 3);
  s.rect(19, 21, 27, 26, "team", 3);
  // The carriage and cradle, narrow and tall seen from the end.
  s.rect(5, 13, 26, 21, "team", 2, true);
  s.poly([[9, 13], [11, 6], [20, 6], [22, 13]], "team", 2);
  if (toward) {
    // The muzzle faces us: a round mouth above the carriage, the barrel foreshortened behind it.
    s.oval(15.5, 9, 4.5, 4, "team", 1, true);
    s.oval(15.5, 9, 2.2, 2, "ink", 0);
    if (smoke) s.oval(15.5, 3, 2, 1.5, "canvas", 0);
  } else {
    // The barrel points away, rising up the picture from the cradle.
    s.rect(14, 1, 17, 10, "team", 2, true);
    s.rect(13, 0, 18, 1, "team", 1);
    s.oval(15.5, 10, 2.5, 2, "metal", 3);
    if (smoke) s.oval(19.5, 0.5, 1.6, 1.2, "canvas", 0);
  }
  return finish(s);
}

const views = [[side(false), side(true)], [endOn(true, false), endOn(true, true)], [endOn(false, false), endOn(false, true)]];
for (const f of views.flat()) if (f.length !== 32 || f.some((r) => r.length !== 32)) throw new Error("railway gun sprite is not 32x32");

for (const team of ["olive", "red", "blue", "grey"]) {
  // One row: side, down, up, two frames each, as on every unit sheet (§22).
  const sheet = canvas(32 * 6, 32);
  views.flat().forEach((f, col) => stamp(sheet, f, { ...fixedColors, ...teamRamps[team] }, col * 32, 0));
  savePng(sheet, join(root, "public", "assets", "units", `de-railgun-32-${team}.png`));
}

const scale = 4;
const preview = canvas(3 * (32 * scale + 4), 32 * scale);
preview.px.fill(255);
views.forEach(([f], i) => {
  stamp(preview, Array(32).fill("G".repeat(32)), { G: "#8cc25a" }, i * (32 * scale + 4), 0, scale);
  stamp(preview, f, { ...fixedColors, ...teamRamps.grey }, i * (32 * scale + 4), 0, scale);
});
savePng(preview, join(root, "docs", "art", "de-railgun-32.png"));
console.log("german railway gun rendered");
