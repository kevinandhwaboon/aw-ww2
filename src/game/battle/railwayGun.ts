// The Railway Gun's battle figure (01-units §2b, 08-art-pipeline §18): Schwerer Gustav, the 80 cm
// Krupp gun, standing on its double track. One figure: a long girder carriage on four bogie groups,
// a tall cradle amidships, and the barrel cocked up toward the target. When it fires, the barrel
// slides back in its cradle and the whole carriage rocks on its springs.

import { shade } from "./colors";
import { C, type Painter } from "./paint";
import { kick, type Look, type Muzzle, type Pose, type Rig } from "./rig";
import { drawSoldier, earsCovered, soldierFrame } from "./soldiers";
import { FIRE_TIMING } from "./timeline";

/** Where the barrel pivots in its cradle, from the figure's feet. */
const TRUNNION = { x: -6, y: -50 };
/** Barrel elevation: negative is up. */
const ELEVATION = -0.55;
const BARREL = 104;
/** The carriage's span along the track, front and back from the feet. */
const FRONT = 62;
const BACK = -78;

const SHOT_AT = FIRE_TIMING.howitzer.shots[0] ?? 760;

function track(p: Painter): void {
  // Ballast and sleepers under both tracks, then the near rails.
  p.rect(BACK - 14, -3, FRONT - BACK + 28, 4, C("battleRoad"));
  for (let x = BACK - 12; x < FRONT + 12; x += 7) p.rect(x, -3, 4, 3, C("battleLeather"));
  p.rect(BACK - 14, -4, FRONT - BACK + 28, 1, C("battleSteel"));
  p.rect(BACK - 14, -1, FRONT - BACK + 28, 1, C("battleSteelDark"));
}

/** One bogie group: a frame on four small wheels, centered at x. */
function bogie(p: Painter, x: number, look: Look, rock: number): void {
  const t = look.team;
  p.rect(x - 15, -13 + rock, 30, 7, t.lo);
  p.rect(x - 15, -13 + rock, 30, 1, t.mid);
  for (let k = 0; k < 4; k++) {
    const wx = x - 11 + k * 7;
    p.disc(wx, -4, 3, C("battleSteelDark"));
    p.px(wx, -4, C("battleSteel"));
  }
}

function draw(p: Painter, pose: Pose, look: Look): void {
  const t = look.team;
  const ct = pose.fire === "howitzer" ? pose.ct : null;
  const recoil = kick(ct, SHOT_AT, 60, 700) * 12;
  const rock = Math.round(kick(ct, SHOT_AT, 40, 260) * 2);

  track(p);
  for (const x of [BACK + 16, BACK + 48, FRONT - 46, FRONT - 14]) bogie(p, x, look, rock);

  // The girder carriage: a long box beam, lighter along its top edge, riveted.
  const top = -32 + rock;
  p.rect(BACK, top, FRONT - BACK, 19, t.mid);
  p.rect(BACK, top, FRONT - BACK, 2, t.hi);
  p.rect(BACK, top + 15, FRONT - BACK, 4, t.lo);
  for (let x = BACK + 4; x < FRONT - 2; x += 8) p.px(x, top + 8, t.deep);
  // The ammunition hoist at the back, with a shell on its way up while the gun is loading.
  p.rect(BACK + 4, top - 26, 12, 26, t.lo);
  p.rect(BACK + 4, top - 26, 12, 2, t.hi);
  const hoist = ct === null ? 0 : Math.min(1, ct / Math.max(1, SHOT_AT - 200));
  if (ct !== null && ct < SHOT_AT) {
    const sy = top - 4 - Math.round(hoist * 16);
    p.rect(BACK + 18, sy, 10, 5, C("battleBrass"));
    p.rect(BACK + 28, sy + 1, 3, 3, shade(C("battleBrass"), 0.7));
  }

  // The cradle tower amidships that carries the barrel's trunnions.
  const tx = TRUNNION.x;
  const ty = TRUNNION.y + rock;
  p.poly([[tx - 30, top], [tx - 20, ty - 6], [tx + 14, ty - 6], [tx + 22, top]], t.mid);
  p.poly([[tx - 30, top], [tx - 20, ty - 6], [tx - 16, ty - 6], [tx - 25, top]], t.hi);
  p.rect(tx - 4, ty - 4, 8, 8, t.deep);

  // The barrel: thick at the breech, tapering to the muzzle, sliding back along its axis on recoil.
  const cos = Math.cos(ELEVATION);
  const sin = Math.sin(ELEVATION);
  const bx = tx - cos * (30 + recoil);
  const by = ty - sin * (30 + recoil);
  p.barrel(bx, by, BARREL * 0.45, ELEVATION, 11, t.lo);
  const mid = p.barrel(bx, by, BARREL * 0.45, ELEVATION, 8, t.mid);
  const end = p.barrel(mid.x, mid.y, BARREL * 0.55, ELEVATION, 7, t.lo);
  p.barrel(mid.x, mid.y, BARREL * 0.55, ELEVATION, 4, t.mid);
  p.barrel(bx, by - 3, BARREL, ELEVATION, 1, t.hi);
  p.disc(end.x, end.y, 4, t.deep);
  // The breech block at the back of the barrel.
  p.rect(bx - 7, by - 6, 10, 12, t.deep);

  // Two of the crew by the carriage: the gun's own crew numbered about 250, its guard thousands.
  const clear = ct !== null && ct > SHOT_AT - 300 && ct < SHOT_AT + 700;
  const f = soldierFrame(FRONT + 6, 0, clear ? "crouch" : "stand");
  drawSoldier(p, FRONT + 6, 0, clear ? "crouch" : "stand", look, clear ? earsCovered(f) : {});
  drawSoldier(p, BACK + 2, 0, "stand", look);
}

/** The gun in wreck: the barrel dropped across the carriage, the carriage broken off its bogies. */
function wreck(p: Painter, look: Look): void {
  const t = look.team;
  track(p);
  for (const x of [BACK + 16, FRONT - 14]) bogie(p, x, look, 0);
  p.poly([[BACK, -20], [FRONT, -26], [FRONT, -10], [BACK, -6]], shade(t.mid, 0.6));
  p.barrel(BACK + 30, -30, BARREL * 0.9, 0.12, 9, shade(t.lo, 0.6));
  p.rect(BACK + 2, -16, 14, 10, shade(t.lo, 0.5));
}

export const railwayGunRig: Rig = {
  body: "machine",
  hit: { x: -10, y: -34 },
  draw(p, pose, look) {
    if (pose.down !== undefined && pose.down > 400) wreck(p, look);
    else draw(p, pose, look);
  },
  muzzle(): Muzzle {
    const cos = Math.cos(ELEVATION);
    const sin = Math.sin(ELEVATION);
    const len = BARREL - 30;
    return { x: TRUNNION.x + cos * len, y: TRUNNION.y + sin * len, angle: ELEVATION };
  },
};
