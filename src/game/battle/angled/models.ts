// 3D models for tanks and tank destroyers in battle scenes, drawn turned 5° toward the viewer (see
// mesh.ts, 08-art-pipeline §18). Each is built from the shapes that make the real vehicle
// recognizable. US: M5 Stuart, M4 Sherman, Churchill, M10. Germany: Panzer II, Panzer IV, Tiger I,
// StuG III. `recoil` slides the gun back along its barrel when it fires.

import { C, mix, type TeamShades } from "../colors";
import { barrel, box, circle, decalY, extrudeX, extrudeY, loftZ, wheel, type Face, type V3 } from "./mesh";

export interface Model {
  readonly faces: readonly Face[];
  /** Where a crewman's head pokes out of the hatch, drawn as a sprite. */
  readonly commander: V3 | null;
  /** More crew heads, for open-topped vehicles. */
  readonly crew?: readonly V3[];
  readonly muzzle: V3;
  /** The hull machine gun's muzzle, for the secondary weapon. */
  readonly mg: V3;
}

type Poly = (readonly [number, number])[];

/** A five-pointed star lying on the vehicle's right side (y), centred at (x, z). */
export function starDecal(y: number, x: number, z: number, r: number): Face {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    return [x + Math.cos(a) * rr, z - Math.sin(a) * rr] as const;
  });
  return decalY(y, pts, C("battleStar"));
}

/** German vehicles carry no insignia (08-art-pipeline §12): camouflage blotches on the side instead. */
export function camoDecals(y: number, x0: number, x1: number, z0: number, z1: number, t: TeamShades, seed: number): Face[] {
  const color = mix(t.lo, C("battleOlive"), 0.5);
  const out: Face[] = [];
  const count = Math.max(3, Math.floor((x1 - x0) / 12));
  for (let i = 0; i < count; i++) {
    const x = x0 + ((i * 17 + seed * 5) % Math.max(1, x1 - x0 - 8));
    const z = z0 + ((i * 7 + seed) % Math.max(1, z1 - z0 - 3));
    out.push(decalY(y, [[x, z], [x + 7, z + 1], [x + 6, z + 3], [x + 1, z + 3]], color));
  }
  return out;
}

const rubber = () => C("battleRubber");
const steel = () => C("battleSteel");
const steelDark = () => C("battleSteelDark");

/** A track run seen from the side, rounded at both ends, from x0 to x1 and z 0 to h. */
function trackProfile(x0: number, x1: number, h: number): Poly {
  return [[x0 + 3, 0], [x1 - 3, 0], [x1, 3], [x1 + 1, h * 0.55], [x1 - 2, h], [x0 + 2, h], [x0, h * 0.6], [x0, 3]];
}

/** Both tracks, the belly between them, and the links along the near track's top and bottom. */
export function running(x0: number, x1: number, h: number, inner: number, outer: number, belly: string): Face[] {
  const f: Face[] = [];
  f.push(...extrudeY(inner, outer, trackProfile(x0, x1, h), rubber()));
  f.push(...extrudeY(-outer, -inner, trackProfile(x0, x1, h), rubber()));
  f.push(...box(x0 + 3, x1 - 3, -inner, inner, 3, h, belly));
  for (let x = x0 + 4; x < x1 - 4; x += 3) f.push(decalY(-outer - 0.05, [[x, 0.2], [x + 1, 0.2], [x + 1, 1.4], [x, 1.4]], steelDark()));
  return f;
}

/** A road wheel on the near side: rubber rim, steel disc. */
export const roadWheel = (x: number, y: number, z: number, r: number, tone = 1) =>
  wheel(x, y, z, r, 1.2, tone === 1 ? steel() : mix(steel(), steelDark(), 0.4), steelDark());

// ---- US ----

/** M5 Stuart: tall and narrow, a sloped glacis, two bogies and a trailing idler, the 37mm in its sleeve. */
export function stuart(t: TeamShades, recoil = 0): Model {
  const f: Face[] = [];
  f.push(...running(-27, 27, 10, 9, 14, t.lo));
  f.push(...wheel(25, -14.6, 6, 4, 1.2, steelDark(), steel()));
  f.push(...roadWheel(-24, -14.8, 4.5, 4.4));
  for (const b of [-11, 9]) {
    f.push(...box(b - 6, b + 6, -15.6, -14.8, 5, 9, steelDark()));
    f.push(...roadWheel(b - 4.5, -14.8, 4, 3.8));
    f.push(...roadWheel(b + 4.5, -14.8, 4, 3.8));
  }
  f.push(...extrudeY(-14, 14, [[-27, 10], [27, 10], [28, 13], [14, 21], [-25, 21], [-27, 19]], t.mid));
  f.push(starDecal(-14.05, -8, 15, 3.8));
  f.push(...barrel(24, 29, 6, 15, 0.7, steelDark()));
  f.push(...loftZ(21, [[-9, -8], [6, -8], [8, -6], [8, 6], [6, 8], [-9, 8]], 31, [[-8, -7], [4, -7], [6, -5], [6, 5], [4, 7], [-8, 7]], t.mid));
  f.push(...box(6, 10, -5, 5, 23, 29, t.lo));
  f.push(...barrel(8 - recoil, 18 - recoil, 0, 26, 1.8, steelDark()));
  f.push(...barrel(8 - recoil, 30 - recoil, 0, 26, 1.1, steelDark()));
  f.push(...box(-6, -5, 4, 5, 31, 35, steelDark()));
  f.push(...barrel(-6, 4, 4.5, 35.5, 0.5, steelDark()));
  return { faces: f, commander: [-3, -2, 31], muzzle: [30 - recoil, 0, 26], mg: [29, 6, 15] };
}

/** M4 Sherman: high hull, steep sloped glacis, VVSS bogies, rounded cast turret, short 75. */
export function sherman(t: TeamShades, recoil = 0): Model {
  const f: Face[] = [];
  f.push(...running(-35, 35, 12, 11, 18, t.lo));
  // Drive sprocket at the front, idler at the back, three bogies of two wheels with return rollers.
  f.push(...wheel(32, -18.6, 7, 4.6, 1.2, steelDark(), steel()));
  f.push(...wheel(-32, -18.6, 6, 4, 1.2, steel(), steelDark()));
  for (const b of [-18, 0, 18]) {
    f.push(...box(b - 7, b + 7, -19.6, -18.8, 6, 10, steelDark()));
    f.push(...box(b - 2, b + 2, -20.2, -19.6, 6.5, 9.5, steel()));
    f.push(...roadWheel(b - 5, -18.8, 4.5, 4.2));
    f.push(...roadWheel(b + 5, -18.8, 4.5, 4.2));
    f.push(...wheel(b + 1, -18.8, 11, 1.7, 1, steel(), steelDark()));
  }
  // Upper hull: sloped glacis, sponsons over the tracks, tools on the side.
  f.push(...extrudeY(-18, 18, [[-34, 12], [35, 12], [35, 14], [15, 25], [-31, 25], [-34, 22]], t.mid));
  f.push(starDecal(-18.05, -10, 18.5, 4.6));
  f.push(decalY(-18.05, [[-28, 22], [-16, 22], [-16, 23], [-28, 23]], C("battleWood")));
  f.push(decalY(-18.05, [[4, 15], [12, 15], [12, 22], [4, 22]], mix(t.mid, t.hi, 0.35)));
  // Spare track links on the glacis, the bow machine gun, towing shackles, headlights.
  for (let k = 0; k < 3; k++) f.push(...box(19 + k * 4.5, 22 + k * 4.5, -12, -2, 21.5 - k * 2.4, 23 - k * 2.4, rubber()));
  f.push(...barrel(30, 36, 7, 17, 0.8, steelDark()));
  f.push(...box(34, 36, -14, -12, 12, 14, steelDark()));
  f.push(...box(34, 36, 12, 14, 12, 14, steelDark()));
  // Cast turret: rounded and tapering, a wide mantlet, the 75mm, a hatch and a .50 cal on the roof.
  f.push(...loftZ(25, circle(-1, 0, 13, 14, 0.9), 37, circle(-2, 0, 10.5, 14, 0.85), t.mid));
  f.push(...box(9, 14, -7, 7, 27, 34, t.lo));
  f.push(...barrel(13 - recoil, 42 - recoil, 0, 30.5, 1.7, steelDark()));
  f.push(...barrel(40 - recoil, 42 - recoil, 0, 30.5, 2, steelDark()));
  f.push(...loftZ(37, circle(-5, 3, 4, 10), 39, circle(-5, 3, 3.6, 10), t.lo));
  f.push(...box(-11, -9, -6, -4, 37, 41, steelDark()));
  f.push(...barrel(-11, 4, -5, 41.5, 0.6, steelDark()));
  return { faces: f, commander: [-5, 3, 39], muzzle: [42 - recoil, 0, 30.5], mg: [36, 7, 17] };
}

/** Churchill: long, its tracks running up over the hull sides, square escape doors, a box turret. */
export function churchill(t: TeamShades, recoil = 0): Model {
  const f: Face[] = [];
  // The tracks wrap high round the whole hull side, horns at the front.
  const tall: Poly = [[-38, 2], [-34, 0], [34, 0], [40, 6], [41, 16], [38, 22], [-36, 22], [-40, 14]];
  f.push(...extrudeY(12, 19, tall, rubber()));
  f.push(...extrudeY(-19, -12, tall, rubber()));
  for (let x = -34; x < 36; x += 3) f.push(decalY(-19.05, [[x, 21], [x + 1, 21], [x + 1, 22], [x, 22]], steelDark()));
  for (let i = 0; i < 11; i++) f.push(...roadWheel(-30 + i * 6.2, -19.2, 2.6, 2.4));
  f.push(...box(-37, 37, -12, 12, 4, 22, t.lo));
  // Panniers over the tracks with the square escape door, louvres at the back.
  f.push(...box(-30, 28, -20, -19, 7, 19, t.mid));
  f.push(...box(-2, 7, -20.6, -20, 9, 17, t.lo));
  f.push(decalY(-20.65, [[-1, 15], [6, 15], [6, 16], [-1, 16]], t.hi));
  for (let x = -27; x < -12; x += 3) f.push(decalY(-20.05, [[x, 10], [x + 1, 10], [x + 1, 17], [x, 17]], t.lo));
  f.push(starDecal(-20.05, 16, 13, 3.6));
  f.push(...box(-34, 36, -14, 14, 22, 24, t.mid));
  f.push(...barrel(36, 41, 6, 17, 0.8, steelDark()));
  // Box turret, the 6-pounder, a hatch.
  f.push(...loftZ(24, [[-6, -11], [14, -11], [16, -9], [16, 9], [14, 11], [-6, 11]], 36, [[-5, -10], [13, -10], [15, -8], [15, 8], [13, 10], [-5, 10]], t.mid));
  f.push(...box(15, 18, -5, 5, 26, 33, t.lo));
  f.push(...barrel(17 - recoil, 42 - recoil, 0, 29.5, 1.5, steelDark()));
  f.push(...loftZ(36, circle(2, 4, 3.6, 8), 38, circle(2, 4, 3.2, 8), t.lo));
  return { faces: f, commander: [2, 4, 38], muzzle: [42 - recoil, 0, 29.5], mg: [41, 6, 17] };
}

/** M10: a Sherman chassis with sloped hull sides, an open pentagonal turret, counterweights, the 3-inch. */
export function m10(t: TeamShades, recoil = 0): Model {
  const f: Face[] = [];
  f.push(...running(-35, 35, 12, 11, 18, t.lo));
  f.push(...wheel(32, -18.6, 7, 4.6, 1.2, steelDark(), steel()));
  f.push(...wheel(-32, -18.6, 6, 4, 1.2, steel(), steelDark()));
  for (const b of [-18, 0, 18]) {
    f.push(...box(b - 7, b + 7, -19.6, -18.8, 6, 10, steelDark()));
    f.push(...roadWheel(b - 5, -18.8, 4.5, 4.2));
    f.push(...roadWheel(b + 5, -18.8, 4.5, 4.2));
  }
  // Sloped hull sides and glacis, with bolted-on armour bosses.
  f.push(...loftZ(12, [[-34, -18], [30, -18], [36, -12], [36, 12], [30, 18], [-34, 18]], 24, [[-31, -13], [14, -13], [17, -9], [17, 9], [14, 13], [-31, 13]], t.mid));
  f.push(starDecal(-15.5, -12, 18, 3.8));
  // Open-topped pentagonal turret: the crew show over the rim; counterweights hang off the back.
  const pent: Poly = [[-12, -12], [8, -12], [15, -5], [15, 5], [8, 12], [-12, 12]];
  const pentTop: Poly = [[-11, -10], [7, -10], [12, -4], [12, 4], [7, 10], [-11, 10]];
  f.push(...loftZ(24, pent, 33, pentTop, t.mid));
  f.push({ points: pentTop.map(([x, y]) => [x * 0.86, y * 0.82, 33.1] as V3), color: C("battleInk"), decal: true, facing: [0, 0, 1] });
  f.push(...box(-18, -12, -9, 9, 25, 31, t.lo));
  f.push(...box(13, 17, -4, 4, 26, 31, t.lo));
  f.push(...barrel(15 - recoil, 56 - recoil, 0, 28.5, 1.4, steelDark()));
  f.push(...box(-10, -8, 6, 8, 33, 37, steelDark()));
  f.push(...barrel(-10, 4, 7, 37.5, 0.6, steelDark()));
  return { faces: f, commander: null, crew: [[-3, -3, 34], [4, 3, 34]], muzzle: [56 - recoil, 0, 28.5], mg: [8, 7, 37.5] };
}

// ---- Germany ----

/** Panzer II: small, five big road wheels on leaf springs, a little turret with a 20mm. */
export function panzerII(t: TeamShades, recoil = 0): Model {
  const f: Face[] = [];
  f.push(...running(-24, 24, 10, 8, 13, t.lo));
  f.push(...wheel(22, -13.6, 6, 3.8, 1.2, steelDark(), steel()));
  for (let i = 0; i < 5; i++) {
    const x = -17 + i * 8.5;
    f.push(...box(x - 4, x + 1, -14.2, -13.6, 6, 7, steelDark()));
    f.push(...roadWheel(x, -13.8, 4.6, 4.4));
  }
  for (let i = 0; i < 4; i++) f.push(...wheel(-13 + i * 8.5, -13.6, 9.2, 1.4, 1, steel(), steelDark()));
  f.push(...extrudeY(-13, 13, [[-24, 10], [24, 10], [25, 15], [22, 18], [-22, 18], [-24, 16]], t.mid));
  f.push(...camoDecals(-13.05, -20, 18, 11, 17, t, 1));
  f.push(...loftZ(18, [[-8, -5], [7, -5], [9, -3], [9, 9], [7, 11], [-8, 11]], 26, [[-7, -4], [6, -4], [8, -2], [8, 8], [6, 10], [-7, 10]], t.mid));
  f.push(...box(8, 11, -1, 6, 20, 25, t.lo));
  f.push(...barrel(10 - recoil, 26 - recoil, 1.5, 22.5, 0.9, steelDark()));
  f.push(...barrel(10, 16, 4.5, 22, 0.5, steelDark()));
  f.push(...loftZ(26, circle(-2, 4, 3.4, 8), 29, circle(-2, 4, 3, 8), t.lo));
  return { faces: f, commander: [-2, 4, 29], muzzle: [26 - recoil, 1.5, 22.5], mg: [16, 4.5, 22] };
}

/** Panzer IV: box hull with a vertical front plate, side skirts, boxy turret with skirts, long 75. */
export function panzerIV(t: TeamShades, recoil = 0): Model {
  const f: Face[] = [];
  const skirt = mix(t.lo, t.mid, 0.45);
  f.push(...running(-37, 37, 11, 11, 18, t.lo));
  f.push(...wheel(35, -18.6, 6.5, 4.2, 1.2, steelDark(), steel()));
  for (let i = 0; i < 8; i++) f.push(...roadWheel(-27 + i * 7.7, -18.8, 3.6, 3.3));
  // Hull: a vertical front plate with the driver's visor and the ball-mounted machine gun.
  f.push(...extrudeY(-17, 17, [[-36, 11], [37, 11], [37, 22], [34, 24], [-34, 24], [-36, 22]], t.mid));
  f.push(...box(37, 37.6, -9, -3, 19, 21, C("battleInk")));
  f.push(...barrel(37, 40, 6, 19, 0.8, steelDark()));
  for (let k = 0; k < 3; k++) f.push(...box(37, 38, -14 + k * 4, -11 + k * 4, 13, 17, rubber()));
  // Spare road wheels on the rear deck, the exhaust muffler, the antenna base.
  f.push(...extrudeX(-33, -31, circle(-8, 27.5, 3.3, 10), steel()));
  f.push(...extrudeX(-33, -31, circle(-1, 27.5, 3.3, 10), steel()));
  f.push(...box(-39, -36, -6, 6, 14, 19, steelDark()));
  f.push(...camoDecals(-17.05, -30, 30, 14, 22, t, 2));
  // Side skirts in panels on their rail, hiding the top of the running gear.
  f.push(...box(-33, 32, -20.2, -19.4, 17.5, 18.5, steelDark()));
  for (let k = 0; k < 5; k++) f.push(...box(-32 + k * 13, -20 + k * 13, -21, -20.2, 7, 18, skirt));
  // Turret: angled front plates, turret skirts, the cupola at the back, the long 75 with its brake.
  const lower: Poly = [[-14, -11], [10, -11], [14, -7], [14, 7], [10, 11], [-14, 11]];
  const upper: Poly = [[-13, -9], [8, -9], [12, -6], [12, 6], [8, 9], [-13, 9]];
  f.push(...loftZ(24, lower, 34, upper, t.mid));
  f.push(...box(-15, 9, -15, -14.2, 25, 33, skirt));
  f.push(...camoDecals(-15.05, -13, 7, 26, 32, t, 5));
  f.push(...box(12, 16, -5, 5, 26, 32, t.lo));
  f.push(...barrel(15 - recoil, 56 - recoil, 0, 29, 1.4, steelDark()));
  f.push(...barrel(52 - recoil, 57 - recoil, 0, 29, 2.3, steelDark()));
  f.push(...loftZ(34, circle(-9, 0, 4.5, 10), 38, circle(-9, 0, 4, 10), t.lo));
  return { faces: f, commander: [-9, 0, 38], muzzle: [57 - recoil, 0, 29], mg: [40, 6, 19] };
}

/** Tiger I: slab-sided hull, interleaved road wheels, Zimmerit, horseshoe turret, the 88. */
export function tiger(t: TeamShades, recoil = 0): Model {
  const f: Face[] = [];
  f.push(...running(-44, 44, 14, 12, 20, t.lo));
  f.push(...wheel(42, -20.6, 8, 5, 1.2, steelDark(), steel()));
  // Interleaved road wheels: two overlapping layers.
  for (let i = 0; i < 8; i++) {
    const inner = i % 2 === 1;
    f.push(...wheel(-33 + i * 9.4, inner ? -19.4 : -20.8, 6.6, 6.2, 1.3, inner ? mix(steel(), steelDark(), 0.4) : steel(), steelDark()));
  }
  // Hull: big flat plates, overhanging the tracks, ridged with Zimmerit paste.
  f.push(...extrudeY(-21, 21, [[-43, 13], [45, 13], [45, 27], [42, 29], [-42, 29], [-43, 27]], t.mid));
  for (let x = -40; x < 40; x += 3) f.push(decalY(-21.05, [[x, 15], [x + 1, 15], [x + 1, 27], [x, 27]], mix(t.mid, t.lo, 0.45)));
  f.push(...camoDecals(-21.1, -38, 36, 16, 26, t, 3));
  f.push(...box(45, 46, -16, -10, 22, 25, C("battleInk")));
  f.push(...barrel(45, 48, 10, 22, 0.9, steelDark()));
  // Tow cable along the side, mufflers on the back.
  for (let x = -36; x < 30; x += 6) f.push(...box(x, x + 4, -21.6, -21.1, 22, 23, steelDark()));
  f.push(...box(-46, -43, -10, -6, 18, 27, steelDark()));
  f.push(...box(-46, -43, 6, 10, 18, 27, steelDark()));
  // Horseshoe turret: a flat front, sides curving round the back, the mantlet and the 88.
  const horseshoe: Poly = [
    [16, -15], [16, 15], [4, 16], ...Array.from({ length: 7 }, (_, i) => {
      const a = Math.PI / 2 + (i / 6) * Math.PI;
      return [-6 + Math.cos(a) * 12, Math.sin(a) * 16] as const;
    }), [4, -16],
  ];
  f.push(...loftZ(29, horseshoe, 43, horseshoe, t.mid));
  for (let x = -14; x < 14; x += 3) f.push(decalY(-16.05, [[x, 31], [x + 1, 31], [x + 1, 42], [x, 42]], mix(t.mid, t.lo, 0.45)));
  f.push(...box(16, 21, -9, 9, 30, 41, t.lo));
  f.push(...barrel(20 - recoil, 70 - recoil, 0, 35.5, 2, steelDark()));
  f.push(...barrel(66 - recoil, 72 - recoil, 0, 35.5, 3.1, steelDark()));
  // Smoke dischargers either side of the front, cupola, stowage bin at the back.
  for (let k = 0; k < 3; k++) f.push(...barrel(14, 17, -15 + k * 1.6, 42 + k * 0.4, 0.7, steelDark()));
  f.push(...loftZ(43, circle(-8, 7, 5, 10), 46, circle(-8, 7, 4.5, 10), t.lo));
  f.push(...box(-26, -17, -10, 10, 31, 39, t.lo));
  return { faces: f, commander: [-8, 7, 46], muzzle: [72 - recoil, 0, 35.5], mg: [48, 10, 22] };
}

/** StuG III: low hull with six road wheels and skirts, a casemate instead of a turret, the rounded mantlet. */
export function stug(t: TeamShades, recoil = 0): Model {
  const f: Face[] = [];
  const skirt = mix(t.lo, t.mid, 0.45);
  f.push(...running(-35, 35, 11, 10, 17, t.lo));
  f.push(...wheel(33, -17.6, 6.5, 4.2, 1.2, steelDark(), steel()));
  for (let i = 0; i < 6; i++) f.push(...roadWheel(-26 + i * 10, -17.8, 4.6, 4.4));
  for (let i = 0; i < 3; i++) f.push(...wheel(-20 + i * 18, -17.6, 9.5, 1.5, 1, steel(), steelDark()));
  f.push(...extrudeY(-16, 16, [[-34, 11], [35, 11], [36, 18], [32, 20], [-32, 20], [-34, 18]], t.mid));
  f.push(...camoDecals(-16.05, -30, 28, 12, 19, t, 4));
  f.push(...box(-31, 30, -19.2, -18.4, 17, 18, steelDark()));
  for (let k = 0; k < 5; k++) f.push(...box(-30 + k * 12, -19 + k * 12, -20, -19.2, 7, 17, skirt));
  // Casemate with sloped plates, the "pig's head" mantlet, the 75 with its brake.
  const low: Poly = [[-22, -14], [10, -14], [17, -10], [17, 10], [10, 14], [-22, 14]];
  const high: Poly = [[-20, -12], [7, -12], [13, -8], [13, 8], [7, 12], [-20, 12]];
  f.push(...loftZ(20, low, 29, high, t.mid));
  f.push(...camoDecals(-14.05, -18, 6, 21, 27, t, 6));
  f.push(...extrudeX(13, 21, circle(0, 24.5, 4.6, 10), t.lo));
  f.push(...barrel(18 - recoil, 54 - recoil, 0, 24.5, 1.4, steelDark()));
  f.push(...barrel(50 - recoil, 55 - recoil, 0, 24.5, 2.3, steelDark()));
  // Commander's cupola with the scissor periscope, the MG shield on the roof.
  f.push(...loftZ(29, circle(-12, 6, 3.6, 8), 32, circle(-12, 6, 3.2, 8), t.lo));
  f.push(...box(-3, -2, -8, 2, 29, 34, t.lo));
  f.push(...barrel(-2, 8, -3, 33, 0.6, steelDark()));
  return { faces: f, commander: [-12, 6, 32], muzzle: [55 - recoil, 0, 24.5], mg: [8, -3, 33] };
}

export type TankKind = "light" | "medium" | "heavy" | "td";

/** Each nation's model for each tank kind. Other Allied nations use the US models (08-art-pipeline §18). */
export const TANK_MODELS: Record<TankKind, { us: (t: TeamShades, recoil?: number) => Model; de: (t: TeamShades, recoil?: number) => Model }> = {
  light: { us: stuart, de: panzerII },
  medium: { us: sherman, de: panzerIV },
  heavy: { us: churchill, de: tiger },
  td: { us: m10, de: stug },
};
