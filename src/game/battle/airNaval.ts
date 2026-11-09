// Battle figures for aircraft and ships (08-art-pipeline §18). Aircraft are seen side-on with the
// near wing below the fuselage; ships side-on at the waterline. US: P-51, B-26, C-47, USS Texas,
// Fletcher, Gato, LCT, PT boat. Germany: Bf 109, Ju 88, Ju 52, Z-class, Type VII, S-boot. Japan:
// A6M Zero, G4M, Ki-57 and the Yamato; its smaller ships share the common hulls without US markings.

import { C, mix, shade, type Painter } from "./paint";
import { FIRE_TIMING } from "./timeline";
import { star } from "./vehicles";
import { justFired, kick, type Look, type Pose, type Rig } from "./rig";

const de = (look: Look) => look.nation === "germany";
const jp = (look: Look) => look.nation === "japan";

/** The hinomaru: a red disc in a thin white ring, Japan's aircraft marking (never the rising-sun ensign). */
function sun(p: Painter, cx: number, cy: number, r: number): void {
  p.disc(cx, cy, r + 1, C("battleStar"));
  p.disc(cx, cy, r, C("battleSun"));
}

const bob = (pose: Pose, period: number, amp: number) => Math.round(Math.sin(pose.t / period + pose.index * 1.7) * amp);

/** A spinning propeller seen edge-on: a blurred disc that flickers. */
function prop(p: Painter, x: number, y: number, r: number, t: number): void {
  const frame = Math.floor(t / 40) % 3;
  const blur = mix(C("battleSmoke"), C("battleSkyLow"), 0.4);
  for (let dy = -r; dy <= r; dy++) if ((dy + frame) % 3 !== 0) p.px(x, y + dy, blur);
  p.rect(x - 1, y - 1, 2, 3, C("battleSteelDark"));
}

/** Mottle for German aircraft and ships, in place of insignia. */
function mottle(p: Painter, x: number, y: number, w: number, look: Look): void {
  const blot = mix(look.team.lo, C("battleFieldGrey"), 0.5);
  for (let i = 0; i < w; i += 9) p.rect(x + i, y + ((i / 9) % 2), 5, 2, blot);
}

// ---- Aircraft ----

/** D-Day invasion stripes: alternating white and black bands, painted on Allied aircraft. */
function invasionStripes(p: Painter, x: number, top: number, bottom: number, band = 2): void {
  for (let i = 0; i < 5; i++) p.rect(x + i * band, top, band, bottom - top, i % 2 === 0 ? C("battleStar") : C("battleInk"));
}

export const fighterRig: Rig = {
  body: "air",
  hit: { x: 0, y: 0 },
  draw(p, pose, look) {
    const T = look.team;
    const y = bob(pose, 330, 2);
    const shake = pose.fire === "planeGuns" && justFired(pose.ct, FIRE_TIMING.planeGuns.shots, 40) >= 0 ? 1 : 0;
    p.ctx.save();
    p.ctx.translate(-shake, y);
    if (jp(look)) {
      // A6M Zero: slender, a long glazed canopy, a big round radial cowling, hinomaru on body and wing.
      p.poly([[-26, 0], [-25, -10], [-20, -10], [-16, -3]], T.mid);
      p.poly([[-27, -1], [-20, -3], [4, -5], [16, -5], [21, -4], [21, 3], [14, 4], [-20, 2], [-27, 1]], T.mid);
      p.rect(-20, 1, 34, 2, T.lo);
      p.rect(-18, -4, 34, 1, T.hi);
      p.poly([[-2, -5], [1, -10], [12, -10], [14, -5]], C("battleSkyLow"));
      for (const fx of [2, 6, 10]) p.line(fx, -10, fx, -5, T.deep);
      p.rect(-30, -1, 9, 2, T.lo);
      sun(p, -12, 0, 2);
      p.poly([[-6, 2], [12, 2], [9, 8], [-8, 7]], T.mid);
      p.line(-6, 2, 12, 2, T.hi);
      sun(p, 2, 5, 2);
      // The cowling: a dark ring round the radial engine, and the exhaust behind it.
      p.rect(21, -5, 4, 9, C("battleSteelDark"));
      p.rect(21, -5, 4, 1, shade(C("battleSteelDark"), 1.5));
      p.px(19, 2, C("battleSteelDark"));
      p.poly([[25, -2], [28, 0], [25, 2]], C("battleSteel"));
      prop(p, 28, 0, 10, pose.t);
    } else if (de(look)) {
      // Bf 109: slim and angular, a framed canopy, a spiral on the spinner.
      p.poly([[-26, 0], [-24, -10], [-20, -10], [-17, -3]], T.mid);
      p.poly([[-27, -1], [-20, -3], [6, -4], [18, -4], [24, -2], [24, 2], [16, 3], [-20, 2], [-27, 1]], T.mid);
      p.rect(-20, 1, 36, 2, T.lo);
      p.rect(-18, -4, 34, 1, T.hi);
      p.poly([[2, -4], [4, -8], [13, -8], [15, -4]], C("battleSkyLow"));
      for (const fx of [5, 8, 11]) p.line(fx, -8, fx, -4, T.deep);
      p.rect(-30, -1, 9, 2, T.lo);
      mottle(p, -16, -2, 26, look);
      p.poly([[-6, 2], [12, 2], [9, 8], [-8, 7]], T.mid);
      p.line(-6, 2, 12, 2, T.hi);
      // Radiator under the wing, the supercharger intake on the cowling, tailplane strut.
      p.rect(-2, 7, 6, 2, T.lo);
      p.rect(12, -2, 3, 2, C("battleSteelDark"));
      p.line(-27, 1, -24, 4, C("battleSteelDark"));
      // Exhaust stubs along the nose.
      for (let x = 16; x < 22; x += 2) p.px(x, 0, C("battleSteelDark"));
      p.poly([[24, -2], [28, 0], [24, 2]], C("battleSteel"));
      p.px(25, -1, C("battleStar"));
      p.px(26, 0, C("battleStar"));
      prop(p, 28, 0, 10, pose.t);
    } else {
      // P-51: a bubble canopy, a belly radiator scoop, a white star.
      p.poly([[-26, -1], [-24, -12], [-19, -12], [-16, -4]], T.mid);
      p.poly([[-27, -1], [-20, -4], [10, -5], [20, -4], [24, -2], [24, 2], [18, 4], [-6, 4], [-20, 2], [-27, 1]], T.mid);
      p.rect(-20, 2, 38, 2, T.lo);
      p.rect(-18, -4, 36, 1, T.hi);
      p.poly([[-6, 4], [4, 4], [1, 8], [-9, 6]], T.lo);
      p.poly([[0, -5], [3, -10], [9, -10], [13, -5]], C("battleSkyLow"));
      p.rect(4, -9, 3, 1, C("battleStar"));
      p.rect(-30, -1, 9, 2, T.lo);
      p.poly([[-6, 2], [13, 2], [10, 9], [-9, 8]], T.mid);
      p.line(-6, 2, 13, 2, T.hi);
      for (const gx of [9, 11]) p.px(gx, 4, C("battleInk"));
      // Invasion stripes on the rear fuselage and the wing, six exhaust stacks, the radio mast.
      invasionStripes(p, -20, -3, 3);
      invasionStripes(p, -2, 3, 8, 2);
      for (let x = 14; x < 22; x += 2) p.px(x, -2, C("battleSteelDark"));
      p.line(-4, -5, -6, -8, C("battleSteelDark"));
      star(p, -4, 0);
      p.poly([[24, -3], [29, 0], [24, 3]], C("battleSteel"));
      prop(p, 29, 0, 11, pose.t);
    }
    p.ctx.restore();
  },
  muzzle(pose, shot, look) {
    const y = bob(pose, 330, 2);
    if (de(look) && shot % 2 === 0) return { x: 24, y: y - 3 };
    if (jp(look) && shot % 2 === 0) return { x: 20, y: y - 5 };
    return { x: 13, y: y + 5 };
  },
};

export const bomberRig: Rig = {
  body: "air",
  hit: { x: 0, y: 0 },
  draw(p, pose, look) {
    const T = look.team;
    const y = bob(pose, 420, 2);
    const doors = pose.fire === "bombs" && pose.ct !== null;
    p.ctx.save();
    p.ctx.translate(0, y);
    // Tail.
    p.poly([[-44, -1], [-42, -20], [-35, -20], [-30, -4]], T.mid);
    p.rect(-48, -2, 14, 3, T.lo);
    // Fuselage.
    p.poly([[-46, -2], [-34, -7], [24, -8], [36, -6], [42, -2], [42, 4], [30, 7], [-30, 5], [-46, 1]], T.mid);
    p.rect(-34, -7, 58, 1, T.hi);
    p.rect(-30, 4, 60, 2, T.lo);
    if (jp(look)) {
      // G4M: a round cigar of a fuselage, a glazed nose, a glazed tail-gun cone, the hinomaru.
      p.ellipse(38, 0, 6, 6, C("battleSkyLow"));
      for (const gx of [35, 39]) p.line(gx, -5, gx, 5, T.deep);
      p.poly([[-46, -2], [-52, 0], [-46, 2]], C("battleSkyLow"));
      p.disc(-6, -8, 3, C("battleSkyLow"));
      sun(p, -22, 0, 3);
    } else if (de(look)) {
      // Ju 88: the glazed "beetle's eye" nose and a gondola under it.
      p.ellipse(38, 0, 7, 6, C("battleSkyLow"));
      for (const gx of [34, 37, 40]) p.line(gx, -5, gx, 5, T.deep);
      p.rect(18, 6, 14, 4, T.lo);
      mottle(p, -28, -4, 50, look);
    } else {
      // B-26: a glass nose, a top turret with twin .50s, invasion stripes and a white star.
      p.poly([[36, -6], [44, -2], [44, 3], [36, 6]], C("battleSkyLow"));
      p.line(39, -5, 39, 5, T.deep);
      p.disc(-8, -9, 4, C("battleSkyLow"));
      p.rect(-4, -11, 8, 1, C("battleSteelDark"));
      invasionStripes(p, -34, -6, 5, 2);
      p.rect(-46, -2, 3, 2, C("battleSteelDark"));
      star(p, -18, 0);
    }
    // Cockpit.
    p.poly([[18, -8], [22, -12], [30, -11], [33, -7]], C("battleSkyLow"));
    // Bomb bay.
    p.rect(-10, 5, 18, doors ? 4 : 1, doors ? C("battleInk") : T.deep);
    // Near wing and engine.
    p.poly([[-14, 3], [22, 3], [18, 14], [-18, 12]], T.mid);
    p.line(-14, 3, 22, 3, T.hi);
    p.poly([[4, 2], [26, 2], [28, 6], [26, 10], [4, 10]], T.lo);
    if (de(look) || jp(look)) p.disc(27, 6, 4, C("battleSteelDark"));
    if (jp(look)) sun(p, 0, 9, 2);
    p.poly([[26, 3], [30, 6], [26, 9]], C("battleSteel"));
    prop(p, 30, 6, 12, pose.t);
    p.ctx.restore();
  },
  muzzle(pose) {
    return { x: -1, y: bob(pose, 420, 2) + 7 };
  },
};

export const transportRig: Rig = {
  body: "air",
  hit: { x: 0, y: 0 },
  draw(p, pose, look) {
    const T = look.team;
    const y = bob(pose, 450, 2);
    p.ctx.save();
    p.ctx.translate(0, y);
    p.poly([[-46, -1], [-44, -18], [-37, -18], [-32, -4]], T.mid);
    p.rect(-50, -2, 14, 3, T.lo);
    p.poly([[-48, -2], [-34, -8], [30, -9], [42, -5], [44, 0], [40, 5], [-30, 6], [-48, 1]], T.mid);
    p.rect(-34, -8, 64, 1, T.hi);
    p.rect(-30, 4, 68, 2, T.lo);
    p.poly([[-14, 3], [22, 3], [18, 14], [-18, 12]], T.mid);
    if (de(look)) {
      // Ju 52: corrugated skin, three engines, fixed undercarriage.
      for (let x = -40; x < 34; x += 3) p.line(x, -6, x, 4, shade(T.mid, 0.85));
      p.disc(44, 0, 4, C("battleSteelDark"));
      prop(p, 48, 0, 9, pose.t);
      p.line(8, 8, 6, 18, C("battleSteelDark"), 2);
      p.disc(6, 19, 3, C("battleRubber"));
      mottle(p, -30, -6, 50, look);
    } else if (jp(look)) {
      // Ki-57: a row of cabin windows, radial engines, the hinomaru.
      for (let x = -18; x < 16; x += 6) p.rect(x, -5, 3, 2, C("battleSkyLow"));
      sun(p, -30, 0, 3);
      p.disc(25, 6, 4, C("battleSteelDark"));
    } else {
      // C-47: rounded nose, a row of cabin windows, the cargo door, invasion stripes, a white star.
      for (let x = -18; x < 16; x += 6) p.rect(x, -5, 3, 2, C("battleSkyLow"));
      p.rect(-26, -5, 5, 9, T.lo);
      invasionStripes(p, -40, -6, 5, 2);
      star(p, -15, 1);
    }
    p.poly([[30, -9], [34, -12], [40, -8], [42, -5]], C("battleSkyLow"));
    p.poly([[2, 2], [24, 2], [26, 6], [24, 10], [2, 10]], T.lo);
    prop(p, 27, 6, 12, pose.t);
    p.ctx.restore();
  },
  muzzle() {
    return { x: 0, y: 0 };
  },
};

// ---- Ships (origin at the waterline) ----

const shipBob = (pose: Pose) => bob(pose, 600, 1);

const BB_TURRETS = [52, 34, -36, -54] as const;
const bbTurretY = (x: number) => (x === 52 || x === -54 ? -18 : -13);
/** The Yamato's three triple turrets: two forward, the second firing over the first, and one aft. */
const YAMATO_TURRETS = [56, 36, -50] as const;
const yamatoTurretY = (x: number) => (x === 36 ? -19 : -13);

/** Yamato: a long flush deck, a tall stepped tower bridge, one big raked funnel, three triple 46cm turrets. */
function yamato(p: Painter, look: Look, ct: number | null): void {
  const T = look.team;
  const shots = FIRE_TIMING.navalGuns.shots;
  p.poly([[-84, -9], [74, -9], [90, -14], [84, 2], [-80, 2]], T.mid);
  p.rect(-84, -9, 158, 1, T.hi);
  p.rect(-82, -2, 164, 4, T.lo);
  for (let x = -64; x < 64; x += 8) p.rect(x, -6, 3, 2, C("battleInk"));
  // The tower bridge, stepped and narrowing, with its rangefinder arms at the top.
  p.rect(4, -22, 24, 13, T.mid);
  p.rect(8, -32, 16, 10, T.mid);
  p.rect(10, -42, 12, 10, T.mid);
  p.rect(12, -50, 8, 8, T.mid);
  p.rect(6, -52, 20, 2, T.lo);
  for (const [y, w] of [[-29, 12], [-39, 8], [-47, 4]] as const) p.rect(16 - w / 2, y, w, 2, C("battleInk"));
  p.line(16, -52, 16, -62, C("battleSteelDark"));
  // The raked funnel, and the aft mast.
  p.poly([[-14, -9], [-12, -30], [-2, -30], [2, -9]], T.lo);
  p.rect(-12, -31, 10, 2, C("battleInk"));
  p.line(-28, -9, -28, -38, C("battleSteelDark"));
  p.line(-34, -30, -22, -30, C("battleSteelDark"));
  // Secondary turrets amidships.
  for (const x of [26, -22]) {
    p.rect(x + 3, -15, 10, 1, C("battleSteelDark"));
    p.poly([[x - 5, -10], [x - 4, -14], [x + 4, -14], [x + 5, -10]], T.mid);
  }
  YAMATO_TURRETS.forEach((x, i) => {
    const ty = yamatoTurretY(x);
    const firing = shots.findIndex((s) => ct !== null && ct >= s && ct < s + 260);
    const recoil = firing === i ? 3 : 0;
    if (ty < -13) p.rect(x - 6, ty + 4, 12, -13 - ty, T.lo);
    for (const dy of [-1, 1, 3]) p.rect(x + 5 - recoil, ty + dy, 24, 1, C("battleSteelDark"));
    p.poly([[x - 10, ty + 5], [x - 9, ty - 2], [x + 7, ty - 3], [x + 10, ty + 5]], T.mid);
    p.rect(x - 8, ty - 3, 15, 1, T.hi);
  });
}

export const battleshipRig: Rig = {
  body: "ship",
  hit: { x: 0, y: -14 },
  draw(p, pose, look) {
    const T = look.team;
    const ct = pose.fire === "navalGuns" ? pose.ct : null;
    const shots = FIRE_TIMING.navalGuns.shots;
    const roll = Math.max(...shots.map((s) => kick(ct, s, 60, 300)));
    p.ctx.save();
    p.ctx.translate(0, shipBob(pose) + Math.round(roll));
    if (jp(look)) {
      yamato(p, look, ct);
      p.ctx.restore();
      return;
    }
    p.poly([[-82, -9], [72, -9], [86, -13], [82, 2], [-78, 2]], T.mid);
    p.rect(-82, -9, 154, 1, T.hi);
    p.rect(-80, -2, 160, 4, T.lo);
    for (let x = -60; x < 60; x += 8) p.rect(x, -6, 3, 2, C("battleInk"));
    // Superstructure, tripod masts with fighting tops, funnel.
    p.rect(-8, -24, 26, 15, T.mid);
    p.rect(-4, -34, 16, 10, T.mid);
    p.rect(-4, -34, 16, 1, T.hi);
    p.rect(-2, -31, 12, 2, C("battleInk"));
    p.line(4, -34, 4, -58, C("battleSteelDark"));
    p.line(4, -40, 0, -34, C("battleSteelDark"));
    p.rect(0, -60, 9, 5, T.lo);
    p.rect(-24, -28, 10, 19, T.lo);
    p.rect(-25, -30, 12, 2, C("battleInk"));
    p.line(-40, -12, -40, -44, C("battleSteelDark"));
    p.rect(-44, -46, 8, 4, T.lo);
    // Main turrets, two forward and two aft, all trained on the enemy.
    BB_TURRETS.forEach((x, i) => {
      const ty = bbTurretY(x);
      const firing = shots.findIndex((s) => ct !== null && ct >= s && ct < s + 260);
      // Salvo 1 is the forward pair's front turret, salvo 2 the other, salvo 3 both aft turrets.
      const recoil = firing >= 0 && (firing === i || (firing === 2 && i === 3)) ? 3 : 0;
      if (ty < -13) p.rect(x - 5, ty + 4, 10, -13 - ty, T.lo);
      p.rect(x + 4 - recoil, ty, 20, 1, C("battleSteelDark"));
      p.rect(x + 4 - recoil, ty + 2, 20, 1, C("battleSteelDark"));
      p.poly([[x - 8, ty + 4], [x - 7, ty - 1], [x + 6, ty - 2], [x + 8, ty + 4]], T.mid);
      p.rect(x - 6, ty - 2, 12, 1, T.hi);
    });
    p.ctx.restore();
  },
  muzzle(pose, shot, look) {
    if (jp(look)) {
      const jx = YAMATO_TURRETS[Math.min(shot, YAMATO_TURRETS.length - 1)] ?? 56;
      return { x: jx + 29, y: yamatoTurretY(jx) + 1 + shipBob(pose) };
    }
    const x = BB_TURRETS[Math.min(shot, BB_TURRETS.length - 1)] ?? 52;
    return { x: x + 24, y: bbTurretY(x) + 1 + shipBob(pose) };
  },
};

export const destroyerRig: Rig = {
  body: "ship",
  hit: { x: 0, y: -10 },
  draw(p, pose, look) {
    const T = look.team;
    const ct = pose.ct;
    const recoil = pose.fire === "deckGun" ? Math.max(...FIRE_TIMING.deckGun.shots.map((s) => kick(ct, s, 40, 200))) * 2 : 0;
    p.ctx.save();
    p.ctx.translate(0, shipBob(pose));
    p.poly([[-50, -7], [34, -7], [52, -12], [46, 2], [-46, 2]], T.mid);
    p.rect(-50, -7, 84, 1, T.hi);
    p.rect(-48, -1, 94, 3, T.lo);
    // Bridge, mast and raked funnels.
    p.rect(14, -18, 12, 11, T.mid);
    p.rect(16, -16, 9, 2, C("battleInk"));
    p.line(10, -7, 10, -32, C("battleSteelDark"));
    p.line(6, -26, 14, -26, C("battleSteelDark"));
    p.poly([[-2, -7], [0, -20], [6, -20], [6, -7]], T.lo);
    p.poly([[-16, -7], [-14, -19], [-8, -19], [-8, -7]], T.lo);
    if (!de(look) && !jp(look)) p.rect(-14, -19, 6, 2, C("battleInk"));
    // Torpedo tubes and depth-charge racks.
    p.rect(-30, -10, 12, 3, C("battleSteelDark"));
    for (let i = 0; i < 3; i++) p.rect(-48 + i * 3, -10, 2, 3, C("battleSteelDark"));
    // Gun mounts fore and aft.
    for (const [x, y] of [[36, -12], [26, -16], [-30, -12], [-40, -12]] as const) {
      const r = x > 0 ? recoil : 0;
      p.rect(x + 3 - r, y + 1, 11, 1, C("battleSteelDark"));
      p.poly([[x - 4, y + 5], [x - 3, y], [x + 3, y - 1], [x + 5, y + 5]], T.mid);
    }
    // 40mm mount amidships.
    p.rect(-6, -11, 6, 3, T.lo);
    p.line(-2, -11, 4, -15, C("battleSteelDark"));
    p.ctx.restore();
  },
  muzzle(pose, shot) {
    const y = shipBob(pose);
    if (pose.fire === "depthCharges") return { x: -46, y: y - 11 };
    if (pose.fire === "aaGuns") return { x: 4, y: y - 15 };
    return shot % 2 === 0 ? { x: 50, y: y - 11 } : { x: 40, y: y - 15 };
  },
};

export const submarineRig: Rig = {
  body: "ship",
  hit: { x: 0, y: -4 },
  draw(p, pose, look) {
    const T = look.team;
    p.ctx.save();
    p.ctx.translate(0, shipBob(pose));
    if (look.submerged) {
      // Below the surface the whole cigar-shaped hull shows.
      p.poly([[-48, 0], [-44, -5], [40, -6], [50, 0], [42, 6], [-44, 5]], T.mid);
      p.rect(-42, 4, 84, 2, T.lo);
    } else {
      p.poly([[-48, 2], [-46, -3], [40, -4], [50, -1], [44, 2]], T.mid);
    }
    p.rect(-44, -4, 84, 1, T.hi);
    // Conning tower, periscopes, deck gun.
    p.poly([[-6, -4], [-5, -13], [10, -13], [14, -4]], T.mid);
    p.rect(-5, -13, 15, 1, T.hi);
    p.line(2, -13, 2, -24, C("battleSteelDark"));
    p.line(5, -13, 5, -20, C("battleSteelDark"));
    p.rect(20, -7, 8, 1, C("battleSteelDark"));
    p.rect(18, -6, 4, 2, T.lo);
    if (!de(look) && !jp(look)) p.rect(-2, -11, 10, 1, C("battleInk"));
    p.ctx.restore();
  },
  muzzle(pose) {
    return { x: 48, y: shipBob(pose) + 1 };
  },
};

export const landingCraftRig: Rig = {
  body: "ship",
  hit: { x: 0, y: -8 },
  draw(p, pose, look) {
    const T = look.team;
    p.ctx.save();
    // Run aground it sits still on the sand; afloat it rides the swell.
    p.ctx.translate(0, look.beached ? 0 : shipBob(pose));
    // LCT: a flat-bottomed box hull with a wheelhouse and twin 20mm aft.
    p.rect(-40, -13, 72, 15, T.mid);
    p.rect(-40, -13, 72, 1, T.hi);
    p.rect(-40, -1, 72, 3, T.lo);
    for (let x = -36; x < 30; x += 8) p.px(x, -7, T.lo);
    p.rect(-36, -27, 12, 14, T.mid);
    p.rect(-36, -27, 12, 1, T.hi);
    p.rect(-34, -24, 8, 2, C("battleInk"));
    p.line(-30, -27, -30, -40, C("battleSteelDark"));
    p.rect(-22, -17, 4, 4, T.lo);
    p.line(-20, -17, -16, -21, C("battleSteelDark"));
    // Cargo: a tank's turret, and the helmets of the troops aboard.
    p.rect(-6, -18, 18, 5, C("battleSteelDark"));
    p.rect(12, -17, 12, 2, C("battleSteelDark"));
    for (let i = 0; i < 3; i++) p.rect(-16 + i * 7, -16, 5, 3, T.deep);
    if (look.beached) {
      // The bow ramp lowered onto the beach.
      p.poly([[32, -13], [36, -13], [58, 1], [54, 2]], T.lo);
      p.line(33, -13, 56, 1, T.hi);
      for (let k = 0; k < 4; k++) p.px(38 + k * 5, -9 + k * 3, T.deep);
    } else {
      p.poly([[32, -16], [38, -14], [40, 1], [32, 2]], T.lo);
      p.line(34, -15, 38, -13, T.hi);
    }
    p.ctx.restore();
  },
  muzzle() {
    return { x: 0, y: 0 };
  },
};

export const torpedoBoatRig: Rig = {
  body: "ship",
  hit: { x: 0, y: -6 },
  draw(p, pose, look) {
    const T = look.team;
    const ct = pose.fire === "torpedo" ? pose.ct : null;
    const launched = ct !== null && ct > (FIRE_TIMING.torpedo.shots[0] ?? 300);
    const slide = ct === null ? 0 : Math.min(6, Math.max(0, (ct - 100) / 30));
    p.ctx.save();
    p.ctx.translate(0, shipBob(pose));
    // A planing hull, bow high.
    p.poly([[-28, -5], [16, -7], [30, -12], [26, 1], [-26, 2]], T.mid);
    p.line(-28, -5, 16, -7, T.hi);
    p.line(16, -7, 30, -12, T.hi);
    p.rect(-26, -1, 52, 2, T.lo);
    // Bridge with windscreen.
    p.rect(-2, -14, 11, 7, T.mid);
    p.rect(4, -14, 5, 3, C("battleSkyLow"));
    // Torpedo tubes on deck; a torpedo slides out of the forward one before it drops.
    p.rect(-18, -10, 18, 3, C("battleSteelDark"));
    if (!launched) p.rect(-14 + slide, -10, 16, 2, C("battleSteel"));
    // Twin MG aft.
    p.rect(-22, -12, 4, 3, T.lo);
    p.line(-20, -12, -12, -14, C("battleSteelDark"));
    // Bow wave.
    const wave = Math.floor(pose.t / 120) % 2;
    p.rect(24 + wave, -2, 6, 1, C("battleFoam"));
    p.rect(20 - wave, 0, 8, 1, C("battleFoam"));
    p.ctx.restore();
  },
  muzzle(pose) {
    if (pose.fire === "mg") return { x: -12, y: shipBob(pose) - 14 };
    return { x: 6, y: shipBob(pose) - 6 };
  },
};

