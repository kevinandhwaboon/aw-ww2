// Battle figures for aircraft (08-art-pipeline §18), seen side-on with the near wing below the
// fuselage. US: P-51, B-26, C-47, SBD Dauntless, TBF Avenger. Germany: Bf 109, Ju 88, Ju 52.
// Japan: A6M Zero, G4M, Ki-57, D3A (Val), B5N (Kate). Germany has no carrier aircraft.
// Ships are in ships.ts.

import { C, mix, shade, type Painter } from "./paint";
import { FIRE_TIMING } from "./timeline";
import { star } from "./vehicles";
import { justFired, type Look, type Pose, type Rig } from "./rig";

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

// ---- Carrier aircraft (05-supply-transport §10) ----

/** A radial cowling and propeller at the nose. */
function radialNose(p: Painter, x: number, top: number, bottom: number, t: number): void {
  p.rect(x, top, 5, bottom - top + 1, C("battleSteelDark"));
  p.rect(x, top, 5, 1, shade(C("battleSteelDark"), 1.5));
  p.poly([[x + 5, -2], [x + 8, 0], [x + 5, 2]], C("battleSteel"));
  prop(p, x + 8, 0, 11, t);
}

/** A long glazed canopy over a crew sitting one behind the other, framed every few pixels. */
function longCanopy(p: Painter, x0: number, x1: number, top: number, frame: string): void {
  p.poly([[x0, -5], [x0 + 3, top], [x1 - 2, top], [x1, -5]], C("battleSkyLow"));
  for (let x = x0 + 4; x < x1 - 1; x += 4) p.line(x, top, x, -5, frame);
}

/** Still in the rack: the store is shown until the first shot has left. */
const stillAboard = (pose: Pose, fire: "diveBomb" | "aerialTorpedo") =>
  pose.fire !== fire || pose.ct === null || pose.ct < (FIRE_TIMING[fire].shots[0] ?? 0);

export const diveBomberRig: Rig = {
  body: "air",
  hit: { x: 0, y: 0 },
  draw(p, pose, look) {
    const T = look.team;
    const y = bob(pose, 380, 2);
    p.ctx.save();
    p.ctx.translate(0, y);
    // Tail, fuselage and tailplane.
    p.poly([[-32, -1], [-30, -14], [-24, -14], [-20, -4]], T.mid);
    p.poly([[-34, -1], [-24, -5], [10, -6], [22, -5], [26, -3], [26, 3], [18, 5], [-24, 3], [-34, 1]], T.mid);
    p.rect(-24, 2, 42, 2, T.lo);
    p.rect(-22, -5, 40, 1, T.hi);
    p.rect(-37, -1, 10, 2, T.lo);
    if (jp(look)) {
      // D3A (Val): elliptical wings, fixed legs in spats, a long canopy, the hinomaru.
      longCanopy(p, -8, 14, -11, T.deep);
      sun(p, -18, 0, 2);
      p.poly([[-8, 2], [14, 2], [12, 7], [-2, 9], [-10, 7]], T.mid);
      p.line(-8, 2, 14, 2, T.hi);
      sun(p, 2, 5, 2);
      p.line(10, 4, 11, 11, T.lo, 2);
      p.ellipse(11, 12, 3, 2, T.mid);
      radialNose(p, 22, -5, 4, pose.t);
    } else {
      // SBD Dauntless: a long canopy for pilot and gunner, perforated dive flaps on the wing, a star.
      longCanopy(p, -10, 14, -11, T.deep);
      p.line(-11, -6, -15, -9, C("battleSteelDark"));
      p.poly([[-9, 2], [14, 2], [11, 9], [-12, 8]], T.mid);
      p.line(-9, 2, 14, 2, T.hi);
      p.rect(-12, 7, 20, 2, T.lo);
      for (let x = -11; x < 8; x += 3) p.px(x, 8, C("battleInk"));
      star(p, -16, 0);
      radialNose(p, 22, -5, 4, pose.t);
    }
    if (stillAboard(pose, "diveBomb")) {
      // The bomb on its swinging crutch under the belly.
      p.ellipse(4, 11, 6, 2, C("battleSteelDark"));
      p.rect(-3, 10, 2, 3, C("battleSteelDark"));
      p.line(8, 4, 4, 9, C("battleSteelDark"));
    }
    p.ctx.restore();
  },
  muzzle(pose) {
    return { x: 4, y: bob(pose, 380, 2) + 12 };
  },
};

export const torpedoBomberRig: Rig = {
  body: "air",
  hit: { x: 0, y: 0 },
  draw(p, pose, look) {
    const T = look.team;
    const y = bob(pose, 400, 2);
    p.ctx.save();
    p.ctx.translate(0, y);
    if (jp(look)) {
      // B5N (Kate): slim, a long three-seat canopy, the torpedo slung under the fuselage.
      p.poly([[-34, -1], [-32, -14], [-25, -14], [-21, -4]], T.mid);
      p.poly([[-36, -1], [-24, -5], [12, -6], [22, -5], [26, -3], [26, 3], [18, 5], [-24, 3], [-36, 1]], T.mid);
      p.rect(-24, 2, 42, 2, T.lo);
      p.rect(-22, -5, 40, 1, T.hi);
      p.rect(-39, -1, 10, 2, T.lo);
      longCanopy(p, -14, 16, -11, T.deep);
      sun(p, -22, 0, 2);
    } else {
      // TBF Avenger: a deep, portly fuselage, the ball turret behind the long canopy, a star.
      p.poly([[-34, -1], [-31, -16], [-24, -16], [-19, -4]], T.mid);
      p.poly([[-36, -1], [-24, -6], [10, -8], [22, -6], [26, -3], [26, 4], [16, 8], [-22, 5], [-36, 1]], T.mid);
      p.rect(-22, 4, 38, 2, T.lo);
      p.rect(-22, -6, 40, 1, T.hi);
      p.rect(-39, -1, 10, 2, T.lo);
      longCanopy(p, -6, 16, -12, T.deep);
      p.disc(-10, -8, 3, C("battleSkyLow"));
      p.rect(-10, -9, 6, 1, C("battleSteelDark"));
      star(p, -20, 0);
    }
    // Near wing.
    p.poly([[-10, 2], [14, 2], [11, 10], [-13, 9]], T.mid);
    p.line(-10, 2, 14, 2, T.hi);
    if (jp(look)) sun(p, 0, 6, 2);
    radialNose(p, 22, -5, 4, pose.t);
    if (stillAboard(pose, "aerialTorpedo")) {
      // The torpedo: a long dark body with its tail fins, under the fuselage.
      p.rect(-10, 10, 22, 3, C("battleSteelDark"));
      p.rect(-10, 10, 22, 1, C("battleSteel"));
      p.rect(-13, 9, 3, 5, C("battleSteelDark"));
      p.line(4, 8, 4, 10, C("battleSteelDark"));
    }
    p.ctx.restore();
  },
  muzzle(pose) {
    return { x: 2, y: bob(pose, 400, 2) + 12 };
  },
};
