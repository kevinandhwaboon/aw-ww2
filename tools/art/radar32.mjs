// Draws the Radar Station's 32x32 map sprite (20-scenarios-battle-of-britain, 08-art-pipeline §17): a
// Chain Home station seen from above and a little to the side, two tall steel lattice masts with
// their cantilever platforms and the transmitter block, a low hut in the team color, at their feet.
// It can't move, so every view (side, down, up) is the same picture; the warning lights on the mast
// tops blink between the two frames. Only the UK has one.
//
// Run: node tools/art/radar32.mjs   (writes public/assets/units/uk-radar-32-*.png and docs/art/uk-radar-32.png)

import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { finish, fixedColors, sprite, teamRamps } from "./kit32.mjs";
import { canvas, savePng, stamp } from "./png.mjs";

const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");

/** One lattice mast, its foot at (x, foot), `top` its highest row. */
function mast(s, x, foot, top) {
  s.shape();
  // Two legs tapering toward the top, with cross-bracing between them.
  for (let y = foot; y >= top; y--) {
    const half = 1 + Math.round(((y - top) / (foot - top)) * 2);
    s.dot(x - half, y, "metal", 2);
    s.dot(x + half, y, "metal", 3);
    if ((y - top) % 4 === 0) s.line(x - half, y, x + half, y, "metal", 2);
    else if ((y - top) % 4 === 2) s.dot(x, y, "metal", 3);
  }
  // Cantilever platforms at a third and two-thirds of the way up, and at the top.
  for (const y of [top, Math.round(top + (foot - top) / 3), Math.round(top + ((foot - top) * 2) / 3)]) {
    s.rect(x - 4, y, x + 4, y, "metal", 1);
  }
}

function frame(blink) {
  const s = sprite();
  // A patch of worn ground and the concrete footings.
  s.oval(15.5, 27, 13, 3.5, "canvas", 2);
  // The far mast first, then the near one, taller in the picture since it's closer.
  mast(s, 22, 25, 3);
  mast(s, 10, 28, 1);
  // The transmitter block between them: a low hut with a flat roof, in the team color.
  s.rect(13, 22, 21, 28, "team", 2, true);
  s.rect(12, 21, 22, 22, "team", 1);
  s.fill(16, 25, 17, 28, "metal", 4);
  // Aerial wires strung from the near mast's platforms.
  s.shape();
  s.line(14, 1, 14, 18, "metal", 3);
  // The red warning lights on the mast tops, lit in one frame.
  if (blink) {
    s.shape();
    s.dot(10, 0, "sun", 0);
    s.dot(22, 2, "sun", 0);
  }
  return finish(s);
}

const frames = [frame(true), frame(false)];
for (const f of frames) if (f.length !== 32 || f.some((r) => r.length !== 32)) throw new Error("radar sprite is not 32x32");

for (const team of ["brown", "olive", "red", "blue"]) {
  // One row: side, down, up, two frames each, as on every unit sheet (§22).
  const sheet = canvas(32 * 6, 32);
  for (let col = 0; col < 6; col++) stamp(sheet, frames[col % 2], { ...fixedColors, ...teamRamps[team] }, col * 32, 0);
  savePng(sheet, join(root, "public", "assets", "units", `uk-radar-32-${team}.png`));
}

const scale = 4;
const preview = canvas(2 * 32 * scale + 4, 32 * scale);
preview.px.fill(255);
frames.forEach((f, i) => {
  stamp(preview, Array(32).fill("G".repeat(32)), { G: "#8cc25a" }, i * (32 * scale + 4), 0, scale);
  stamp(preview, f, { ...fixedColors, ...teamRamps.brown }, i * (32 * scale + 4), 0, scale);
});
savePng(preview, join(root, "docs", "art", "uk-radar-32.png"));
console.log("uk radar station rendered");
