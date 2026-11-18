// Battle figures for aircraft (08-art-pipeline §18), seen side-on with the near wing below the
// fuselage. US: P-51, B-26, C-47, SBD Dauntless, TBF Avenger. Germany: Bf 109, Ju 88, Ju 52.
// Japan: A6M Zero, G4M, Ki-57, D3A (Val), B5N (Kate). Soviet Union: Yak-9, Il-2 Sturmovik (its
// Bomber), Li-2. UK (and Canada): Spitfire, Lancaster, Dakota, Fairey Barracuda, Fairey Swordfish.
// Italy: Macchi C.202, SM.79, SM.82, with the white fuselage band and the plain white rudder cross,
// never the fasces or the Savoy crest. Germany, the Soviet Union and Italy have no carrier aircraft.
// Ships are in ships.ts.

import { C, mix, shade, type Painter } from "./paint";
import { FIRE_TIMING } from "./timeline";
import { redStar, star } from "./vehicles";
import { justFired, kitOf, type Look, type Pose, type Rig } from "./rig";

const de = (look: Look) => look.nation === "germany";
const uk = (look: Look) => kitOf(look) === "uk";

/** The RAF roundel: a red centre in a white ring in a blue ring, the UK's only marking. */
function roundel(p: Painter, cx: number, cy: number, r: number): void {
  p.disc(cx, cy, r, C("battleRoundel"));
  p.disc(cx, cy, r * 0.64, C("battleStar"));
  p.disc(cx, cy, r * 0.34, C("battleSun"));
}

/** The fin flash: red, white and blue upright stripes on the fin. */
function finFlash(p: Painter, x: number, top: number, h: number): void {
  p.rect(x, top, 2, h, C("battleSun"));
  p.rect(x + 2, top, 1, h, C("battleStar"));
  p.rect(x + 3, top, 2, h, C("battleRoundel"));
}
const jp = (look: Look) => look.nation === "japan";
const su = (look: Look) => look.nation === "ussr";
const it = (look: Look) => kitOf(look) === "it";

/** Italy's markings: the white band round the rear fuselage, and the plain white cross on the rudder. */
function whiteBand(p: Painter, x: number, top: number, bottom: number): void {
  p.rect(x, top, 3, bottom - top + 1, C("battleStar"));
}
function rudderCross(p: Painter, cx: number, cy: number, arm: number): void {
  p.rect(cx - arm, cy, arm * 2 + 1, 1, C("battleStar"));
  p.rect(cx, cy - arm, 1, arm * 2 + 1, C("battleStar"));
}

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
    if (uk(look)) {
      // Spitfire: slim, a long pointed nose with its exhaust stacks, the teardrop canopy, the
      // elliptical wing with the radiator under it, a pointed elliptical fin with the fin flash.
      p.poly([[-26, 0], [-26, -9], [-23, -12], [-20, -10], [-17, -3]], T.mid);
      finFlash(p, -24, -9, 6);
      p.poly([[-27, -1], [-20, -3], [2, -5], [16, -4], [25, -2], [25, 2], [16, 3], [-20, 2], [-27, 1]], T.mid);
      p.rect(-20, 1, 36, 2, T.lo);
      p.rect(-18, -4, 34, 1, T.hi);
      p.poly([[-1, -5], [2, -9], [8, -9], [11, -5]], C("battleSkyLow"));
      p.line(5, -9, 5, -5, T.deep);
      p.rect(-30, -1, 9, 2, T.lo);
      roundel(p, -11, -1, 3);
      p.poly([[-9, 2], [-4, 6], [2, 8], [9, 8], [13, 5], [14, 2]], T.mid);
      p.line(-9, 2, 14, 2, T.hi);
      roundel(p, 3, 5, 2.5);
      p.rect(0, 8, 6, 2, T.lo);
      invasionStripes(p, -18, -3, 3);
      for (let x = 15; x < 23; x += 2) p.px(x, -2, C("battleSteelDark"));
      p.poly([[25, -2], [29, 0], [25, 2]], C("battleSteelDark"));
      prop(p, 29, 0, 11, pose.t);
    } else if (su(look)) {
      // Yak-9: slim and rounded, a teardrop canopy over a raised spine, the radiator scoop under
      // the belly, a red spinner, and red stars on the tail and wing.
      p.poly([[-26, 0], [-25, -11], [-20, -11], [-16, -3]], T.mid);
      p.poly([[-27, -1], [-20, -3], [4, -5], [18, -4], [24, -2], [24, 2], [16, 3], [-20, 2], [-27, 1]], T.mid);
      p.rect(-20, 1, 36, 2, T.lo);
      p.rect(-18, -4, 34, 1, T.hi);
      p.poly([[0, -5], [3, -9], [10, -9], [13, -5]], C("battleSkyLow"));
      p.line(6, -9, 6, -5, T.deep);
      p.rect(-30, -1, 9, 2, T.lo);
      redStar(p, -23, -6);
      p.poly([[-4, 3], [6, 3], [4, 7], [-6, 6]], T.lo);
      p.poly([[-6, 2], [12, 2], [9, 8], [-8, 7]], T.mid);
      p.line(-6, 2, 12, 2, T.hi);
      redStar(p, 2, 5);
      for (let x = 16; x < 22; x += 2) p.px(x, -1, C("battleSteelDark"));
      p.poly([[24, -2], [28, 0], [24, 2]], C("battleSun"));
      prop(p, 28, 0, 10, pose.t);
    } else if (jp(look)) {
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
    } else if (it(look)) {
      // Macchi C.202 Folgore: slim and rounded, a small framed canopy faired into the spine, the oil
      // cooler under the nose, the white band and rudder cross, "smoke ring" mottle.
      p.poly([[-26, 0], [-25, -11], [-20, -11], [-17, -3]], T.mid);
      rudderCross(p, -23, -6, 2);
      p.poly([[-27, -1], [-20, -3], [4, -5], [18, -4], [24, -2], [24, 2], [16, 3], [-20, 2], [-27, 1]], T.mid);
      p.rect(-20, 1, 36, 2, T.lo);
      p.rect(-18, -4, 34, 1, T.hi);
      p.poly([[1, -5], [3, -8], [11, -8], [13, -5]], C("battleSkyLow"));
      p.line(6, -8, 6, -5, T.deep);
      p.poly([[-12, -5], [1, -5], [1, -6], [-10, -6]], T.mid);
      p.rect(-30, -1, 9, 2, T.lo);
      whiteBand(p, -16, -3, 2);
      for (const [mx, my] of [[-8, -3], [4, -2], [12, 0]] as const) p.rect(mx, my, 2, 2, mix(T.lo, C("battleSand"), 0.4));
      p.poly([[-6, 2], [12, 2], [9, 8], [-8, 7]], T.mid);
      p.line(-6, 2, 12, 2, T.hi);
      p.rect(14, 3, 6, 2, T.lo);
      for (let x = 16; x < 22; x += 2) p.px(x, -1, C("battleSteelDark"));
      p.poly([[24, -2], [28, 0], [24, 2]], C("battleSteel"));
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
    if (su(look)) {
      // Il-2 Sturmovik: one big engine in an armored nose, a long canopy for pilot and rear gunner
      // with his machine gun, the main wheels in pods under the wing, RS-82 rockets on rails.
      p.poly([[-34, -1], [-32, -14], [-26, -14], [-22, -4]], T.mid);
      redStar(p, -29, -8);
      p.rect(-38, -1, 12, 2, T.lo);
      p.poly([[-36, -1], [-24, -5], [8, -7], [22, -7], [30, -4], [30, 4], [22, 6], [-24, 3], [-36, 1]], T.mid);
      p.rect(-24, 2, 46, 2, T.lo);
      p.rect(-22, -5, 44, 1, T.hi);
      p.rect(18, -6, 11, 10, mix(T.mid, C("battleSteelDark"), 0.3));
      for (let x = 19; x < 27; x += 2) p.px(x, -1, C("battleSteelDark"));
      longCanopy(p, -2, 16, -12, T.deep);
      p.line(-3, -8, -9, -11, C("battleSteelDark"));
      p.rect(-6, 5, 14, doors ? 3 : 1, doors ? C("battleInk") : T.deep);
      p.poly([[-10, 3], [18, 3], [14, 13], [-14, 11]], T.mid);
      p.line(-10, 3, 18, 3, T.hi);
      p.ellipse(10, 9, 4, 2, T.lo);
      redStar(p, -2, 7);
      for (let k = 0; k < 2; k++) {
        p.rect(-9 + k * 6, 12, 5, 1, C("battleSteelDark"));
        p.px(-4 + k * 6, 12, C("battleSun"));
      }
      p.poly([[30, -3], [34, 0], [30, 3]], C("battleSteel"));
      prop(p, 34, 0, 11, pose.t);
      p.ctx.restore();
      return;
    }
    if (uk(look)) {
      // Lancaster: a long slab-sided fuselage, the glazed nose with its turret, a turret on the
      // spine and one in the tail, the twin oval fins at the tailplane's tips, four engines on the
      // great wing (the near two show) and the long bomb bay.
      p.ellipse(-44, -11, 3, 9, shade(T.mid, 0.8));
      p.rect(-50, -2, 14, 3, T.lo);
      p.poly([[-48, -2], [-36, -7], [24, -8], [36, -6], [42, -2], [42, 4], [30, 7], [-30, 5], [-48, 1]], T.mid);
      p.rect(-36, -7, 60, 1, T.hi);
      p.rect(-30, 4, 60, 2, T.lo);
      p.ellipse(40, 0, 5, 5, C("battleSkyLow"));
      p.line(39, -4, 39, 4, T.deep);
      p.poly([[-48, -3], [-54, 0], [-48, 3]], C("battleSkyLow"));
      p.disc(-12, -9, 3, C("battleSkyLow"));
      p.rect(-13, -10, 6, 1, C("battleSteelDark"));
      p.poly([[16, -8], [20, -12], [28, -11], [31, -7]], C("battleSkyLow"));
      roundel(p, -24, -1, 4);
      p.ellipse(-41, -12, 3, 9, T.mid);
      finFlash(p, -43, -17, 8);
      p.rect(-20, 5, 34, doors ? 4 : 1, doors ? C("battleInk") : T.deep);
      p.poly([[-14, 3], [26, 3], [22, 15], [-18, 13]], T.mid);
      p.line(-14, 3, 26, 3, T.hi);
      for (const [ex, ey] of [[10, 5], [20, 9]] as const) {
        p.poly([[ex - 14, ey - 3], [ex + 6, ey - 3], [ex + 8, ey], [ex + 6, ey + 3], [ex - 14, ey + 3]], T.lo);
        p.poly([[ex + 6, ey - 2], [ex + 10, ey], [ex + 6, ey + 2]], C("battleSteelDark"));
        prop(p, ex + 10, ey, 9, pose.t + ex * 13);
      }
      p.ctx.restore();
      return;
    }
    if (it(look)) {
      // SM.79 Sparviero: three engines, one in the nose and one on each wing, the "gobbo" hump with
      // its guns on the spine behind the cockpit, a ventral gondola, the white band and rudder cross.
      p.poly([[-44, -1], [-42, -19], [-35, -19], [-30, -4]], T.mid);
      rudderCross(p, -39, -11, 3);
      p.rect(-48, -2, 14, 3, T.lo);
      p.poly([[-46, -2], [-34, -7], [24, -8], [34, -6], [38, -3], [38, 3], [30, 6], [-30, 5], [-46, 1]], T.mid);
      p.rect(-34, -7, 58, 1, T.hi);
      p.rect(-30, 4, 60, 2, T.lo);
      // The hump, glazed at the front, with the dorsal gun poking back out of it.
      p.poly([[2, -8], [6, -14], [18, -14], [22, -8]], T.mid);
      p.rect(16, -13, 5, 3, C("battleSkyLow"));
      p.line(2, -12, -6, -12, C("battleSteelDark"));
      p.poly([[22, -8], [25, -11], [31, -10], [33, -7]], C("battleSkyLow"));
      whiteBand(p, -26, -6, 4);
      p.rect(-8, 5, 16, 4, T.lo);
      p.rect(-10, 5, 18, doors ? 4 : 1, doors ? C("battleInk") : T.deep);
      // The nose engine and its propeller.
      p.disc(39, 0, 4, C("battleSteelDark"));
      p.poly([[42, -2], [45, 0], [42, 2]], C("battleSteel"));
      prop(p, 45, 0, 10, pose.t);
      // The near wing and its engine.
      p.poly([[-14, 3], [22, 3], [18, 14], [-18, 12]], T.mid);
      p.line(-14, 3, 22, 3, T.hi);
      p.poly([[4, 2], [26, 2], [28, 6], [26, 10], [4, 10]], T.lo);
      p.disc(27, 6, 4, C("battleSteelDark"));
      p.poly([[26, 3], [30, 6], [26, 9]], C("battleSteel"));
      prop(p, 30, 6, 12, pose.t + 70);
      p.ctx.restore();
      return;
    }
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
    } else if (it(look)) {
      // SM.82 Marsupiale: a deep fuselage with a row of cabin windows, three engines (the nose one
      // here), fixed undercarriage, the white band and rudder cross.
      for (let x = -18; x < 16; x += 6) p.rect(x, -5, 3, 2, C("battleSkyLow"));
      whiteBand(p, -30, -7, 4);
      rudderCross(p, -40, -10, 3);
      p.disc(44, 0, 4, C("battleSteelDark"));
      prop(p, 48, 0, 9, pose.t);
      p.line(8, 8, 6, 18, C("battleSteelDark"), 2);
      p.disc(6, 19, 3, C("battleRubber"));
    } else if (uk(look)) {
      // Dakota: the C-47 in RAF colors, invasion stripes, the roundel and a fin flash.
      for (let x = -18; x < 16; x += 6) p.rect(x, -5, 3, 2, C("battleSkyLow"));
      p.rect(-26, -5, 5, 9, T.lo);
      invasionStripes(p, -40, -6, 5, 2);
      roundel(p, -15, 0, 4);
      finFlash(p, -43, -15, 9);
    } else if (su(look)) {
      // Li-2: the Soviet-built DC-3, cabin windows, a gun turret on the spine, a red star.
      for (let x = -18; x < 16; x += 6) p.rect(x, -5, 3, 2, C("battleSkyLow"));
      p.rect(-26, -5, 5, 9, T.lo);
      p.disc(-6, -9, 3, C("battleSkyLow"));
      p.rect(-6, -11, 6, 1, C("battleSteelDark"));
      redStar(p, -32, 0);
      p.disc(25, 6, 4, C("battleSteelDark"));
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
    if (uk(look)) {
      // Fairey Barracuda: a deep fuselage, the wing set high at the top of it, a long glazed canopy
      // over the crew of three, the tailplane braced high up the fin, a bomb on the crutch.
      p.rect(-34, -15, 9, 2, T.lo);
      p.line(-30, -13, -28, -4, C("battleSteelDark"));
      longCanopy(p, -10, 14, -12, T.deep);
      roundel(p, -17, 0, 3);
      finFlash(p, -31, -12, 7);
      p.poly([[-8, -4], [16, -4], [12, 4], [-11, 3]], T.mid);
      p.line(-8, -4, 16, -4, T.hi);
      roundel(p, 2, 0, 2.5);
      p.line(6, 4, 7, 11, T.lo, 2);
      p.ellipse(7, 12, 2, 2, C("battleRubber"));
      p.rect(20, 3, 5, 2, T.lo);
      radialNose(p, 22, -5, 4, pose.t);
    } else if (jp(look)) {
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
    if (uk(look)) {
      // Fairey Swordfish: a fabric biplane, two open cockpits with the crew's heads showing, the
      // upper wing high on its struts, big fixed wheels and the torpedo slung between them.
      p.poly([[-32, -1], [-30, -13], [-25, -13], [-21, -3]], T.mid);
      finFlash(p, -30, -11, 7);
      p.poly([[-34, -1], [-24, -4], [12, -5], [22, -5], [26, -3], [26, 3], [18, 4], [-24, 3], [-34, 1]], T.mid);
      p.rect(-24, 2, 42, 2, T.lo);
      p.rect(-37, -1, 10, 2, T.lo);
      roundel(p, -15, 0, 3);
      for (const hx of [-4, 4]) {
        p.rect(hx, -8, 4, 3, C("battleSkin"));
        p.rect(hx, -9, 4, 2, C("battleLeather"));
      }
      for (const sx of [-10, 12]) p.line(sx, -14, sx + 1, 2, C("battleSteelDark"));
      p.rect(-14, -16, 32, 3, T.mid);
      p.line(-14, -16, 18, -16, T.hi);
      roundel(p, 4, -15, 1.5);
      p.line(8, 4, 6, 12, C("battleSteelDark"), 2);
      p.line(14, 4, 16, 12, C("battleSteelDark"), 2);
      p.disc(6, 14, 3, C("battleRubber"));
      p.disc(16, 14, 3, C("battleRubber"));
    } else if (jp(look)) {
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
    if (uk(look)) roundel(p, 0, 6, 2.5);
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
