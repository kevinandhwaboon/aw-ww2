// Battle figures for the field fortifications (08-art-pipeline §18): a Minefield (02-terrain §4b) and
// an Obstacle's dragon's teeth (02-terrain §4). Neither fires back. Like a unit's figures, how many
// stand follows HP: each stretch of minefield goes up, and each tooth topples, as its figure falls.

import { shade } from "./colors";
import { C, mix, type Painter } from "./paint";
import type { Muzzle, Pose, Rig } from "./rig";
import { hash } from "./timeline";

/** The churned ground of a fortification square, as its backdrop draws it, in the current season. */
const ground = () => mix(C("battleDirt"), C("battleGrass"), 0.4);

const NO_MUZZLE: Muzzle = { x: 0, y: 0, angle: 0 };

// ---- Minefield ----

/** Half the width of one stretch of minefield; neighbors' wire meets at the edges. */
const STRETCH = 24;

/** A yellow triangular warning sign, its top at (x, y), tipped `lean` pixels to one side. */
function warningSign(p: Painter, x: number, y: number, lean: number): void {
  p.poly([[x - 6 + lean, y + 9], [x + lean * 2, y - 1], [x + 6 + lean, y + 9]], C("battleSteelDark"));
  p.poly([[x - 4 + lean, y + 8], [x + lean * 2, y + 1], [x + 4 + lean, y + 8]], C("battleMineSign"));
  // The exclamation mark painted on it.
  p.rect(x + lean, y + 3, 1, 3, C("battleSteelDark"));
  p.px(x + lean, y + 7, C("battleSteelDark"));
}

/** A strand of barbed wire between two points, sagging in the middle, with a barb every few pixels. */
function wire(p: Painter, x0: number, x1: number, y: number, sag: number): void {
  const mid = (x0 + x1) / 2;
  p.line(x0, y, mid, y + sag, C("battleSteelDark"));
  p.line(mid, y + sag, x1, y, C("battleSteelDark"));
  for (let x = Math.ceil(x0 / 5) * 5; x < x1; x += 5) {
    const dy = Math.round(sag * (1 - Math.abs(x - mid) / ((x1 - x0) / 2)));
    p.px(x, y + dy - 1, C("battleSteel"));
  }
}

/** A buried mine: a low hump of earth, its pressure plate showing through on some. */
function mine(p: Painter, x: number, y: number, showing: boolean): void {
  const earth = ground();
  p.ellipse(x, y, 5, 2, shade(earth, 1.12));
  p.rect(x - 4, y + 1, 8, 1, shade(earth, 0.78));
  if (showing) p.rect(x - 1, y - 1, 3, 1, C("battleSteelDark"));
}

/** A disturbed strip of ground, darker than the square around it, with ragged edges. */
function strip(p: Painter, index: number): void {
  const earth = ground();
  p.rect(-STRETCH, -2, STRETCH * 2, 8, shade(earth, 0.9));
  for (let x = -STRETCH; x < STRETCH; x += 4) {
    const top = Math.round(hash(index, x, 11) * 2);
    p.rect(x, -3 - top, 4, top + 1, shade(earth, 0.9));
  }
}

function minefieldStanding(p: Painter, pose: Pose): void {
  const i = pose.index;
  strip(p, i);
  // Mines laid ahead of the wire, staggered.
  mine(p, -13, 3, i % 2 === 0);
  mine(p, 3, 1, false);
  mine(p, 15, 4, i % 3 === 1);
  // Pickets, the wire strung between them, and a sign on one; a sign shakes a little as rounds land nearby.
  const shake = 10 - pose.hp > 0 ? Math.round((hash(i, Math.floor(pose.t / 90)) - 0.5) * 0.8) : 0;
  for (const x of [-20, 4]) {
    p.rect(x, -16, 2, 16, C("battleWood"));
    p.rect(x + 1, -16, 1, 16, shade(C("battleWood"), 0.75));
  }
  wire(p, -STRETCH - 2, -19, -13, 0);
  wire(p, -19, 5, -13, 2);
  wire(p, 5, STRETCH + 2, -13, 1);
  wire(p, -STRETCH - 2, -19, -7, 0);
  wire(p, -19, 5, -7, 1);
  wire(p, 5, STRETCH + 2, -7, 1);
  warningSign(p, 5, -24, shake);
}

function minefieldDown(p: Painter, pose: Pose): void {
  const i = pose.index;
  const earth = ground();
  strip(p, i);
  // Where the mines went up: a crater with thrown-up earth around its rim.
  p.ellipse(0, 2, 15, 5, shade(earth, 1.1));
  p.ellipse(0, 2, 11, 3.5, shade(earth, 0.55));
  p.ellipse(1, 3, 6, 1.5, shade(earth, 0.4));
  for (let k = 0; k < 6; k++) p.rect(-18 + hash(i, k, 3) * 36, -1 + hash(i, k, 5) * 6, 2, 1, shade(earth, 0.7));
  // One picket knocked flat on the ground, the other bent over.
  p.rect(-25, 4, 15, 2, C("battleWood"));
  p.line(15, 0, 22, -10, C("battleWood"), 2);
  // The wire snapped, its loose ends hanging to the ground.
  p.line(-STRETCH - 2, -13, -16, 0, C("battleSteelDark"));
  p.line(-STRETCH - 2, -7, -18, 1, C("battleSteelDark"));
  p.line(STRETCH + 2, -13, 20, -8, C("battleSteelDark"));
  p.line(STRETCH + 2, -7, 17, 1, C("battleSteelDark"));
  // The sign lies flat in the dirt on every other stretch; on the rest it was blown away.
  if (i % 2 === 0) {
    p.poly([[18, 6], [24, 3], [27, 7]], C("battleSteelDark"));
    p.poly([[19, 6], [24, 4], [26, 6]], C("battleMineSign"));
  }
}

/** A stretch of minefield: wire on pickets, a yellow warning sign, and mines buried in front. */
export const minefieldRig: Rig = {
  body: "field",
  hit: { x: 0, y: -4 },
  draw(p, pose) {
    if (pose.down === undefined) minefieldStanding(p, pose);
    else minefieldDown(p, pose);
  },
  muzzle: () => NO_MUZZLE,
};

// ---- Obstacle: dragon's teeth ----

/** A concrete dragon's tooth: a squat pyramid with its top cut off, on a footing, lit from the upper left. */
function tooth(p: Painter, pose: Pose): void {
  const concrete = C("battleConcrete");
  const i = pose.index;
  p.rect(-11, -2, 24, 4, shade(concrete, 0.72));
  p.poly([[-9, 0], [9, 0], [4, -20], [-4, -20]], concrete);
  p.poly([[9, 0], [12, -3], [6, -21], [4, -20]], shade(concrete, 0.7));
  p.poly([[-4, -20], [4, -20], [6, -21], [-2, -21]], shade(concrete, 1.18));
  p.line(-9, 0, -4, -20, shade(concrete, 1.1));
  // Chips and cracks spread over the face as the obstacle loses HP, more on some teeth than others.
  const cracks = Math.max(0, Math.round((10 - pose.hp) * (0.4 + hash(i, 17) * 0.4)));
  for (let k = 0; k < cracks; k++) {
    const cx = -5 + hash(i, k, 19) * 9;
    const cy = -17 + hash(i, k, 23) * 14;
    p.line(cx, cy, cx + 2, cy + 3, shade(concrete, 0.5));
    p.line(cx + 2, cy + 3, cx + 1, cy + 6, shade(concrete, 0.5));
  }
}

/** A tooth blown off its footing: the stump with rebar showing, and the top half lying broken beside it. */
function toothDown(p: Painter, pose: Pose): void {
  const concrete = C("battleConcrete");
  const i = pose.index;
  p.rect(-11, -2, 24, 4, shade(concrete, 0.72));
  p.poly([[-9, 0], [9, 0], [8, -5], [-1, -8], [-8, -5]], shade(concrete, 0.9));
  p.line(-3, -7, -5, -12, C("battleSteelDark"));
  p.line(2, -6, 4, -11, C("battleSteelDark"));
  // The broken-off top, toppled onto its side.
  const side = i % 2 === 0 ? 1 : -1;
  const x = side * 14;
  p.poly([[x - 7 * side, 3], [x - 7 * side, -8], [x + 9 * side, -3], [x + 9 * side, 2]], concrete);
  p.poly([[x - 7 * side, 3], [x + 9 * side, 2], [x + 9 * side, 4], [x - 7 * side, 5]], shade(concrete, 0.66));
  p.line(x - 2 * side, -6, x + side, 0, shade(concrete, 0.5));
  for (let k = 0; k < 5; k++) p.rect(-14 + hash(i, k, 29) * 28, 1 + hash(i, k, 31) * 4, 2, 2, shade(concrete, 0.8));
}

/** A dragon's tooth of an Obstacle square. */
export const obstacleRig: Rig = {
  body: "field",
  hit: { x: 0, y: -10 },
  draw(p, pose) {
    if (pose.down === undefined) tooth(p, pose);
    else toothDown(p, pose);
  },
  muzzle: () => NO_MUZZLE,
};
