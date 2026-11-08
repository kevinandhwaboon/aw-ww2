// Prototype 3D models for the three-quarter battle view (see mesh.ts). Each is built from the shapes
// that make the real vehicle recognizable: the Sherman's cast turret and sloped glacis, the Panzer
// IV's box hull, skirts and long gun, the Tiger's slab sides, horseshoe turret and 88.

import { C, mix, type TeamShades } from "../paint";
import { barrel, box, circle, decalY, extrudeY, loftZ, wheel, type Face, type V3 } from "./mesh";

export interface Model {
  readonly faces: readonly Face[];
  /** Where a crewman's head pokes out of the hatch, to be drawn as a sprite. */
  readonly commander: V3;
  readonly muzzle: V3;
}

/** A five-pointed star lying on the vehicle's right side (y), centred at (x, z). */
function starDecal(y: number, x: number, z: number, r: number): Face {
  const pts = Array.from({ length: 10 }, (_, i) => {
    const a = -Math.PI / 2 + (i * Math.PI) / 5;
    const rr = i % 2 === 0 ? r : r * 0.42;
    return [x + Math.cos(a) * rr, z - Math.sin(a) * rr] as const;
  });
  return decalY(y, pts, C("battleStar"));
}

function camoDecals(y: number, x0: number, x1: number, z0: number, z1: number, color: string, seed: number): Face[] {
  const out: Face[] = [];
  for (let i = 0; i < 5; i++) {
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
function trackProfile(x0: number, x1: number, h: number): (readonly [number, number])[] {
  return [[x0 + 3, 0], [x1 - 3, 0], [x1, 3], [x1 + 1, h * 0.55], [x1 - 2, h], [x0 + 2, h], [x0, h * 0.6], [x0, 3]];
}

/** M4 Sherman: high hull, steep sloped glacis, VVSS bogies, rounded cast turret, short 75. */
export function sherman(t: TeamShades): Model {
  const f: Face[] = [];
  f.push(...extrudeY(11, 18, trackProfile(-35, 35, 12), rubber()));
  f.push(...extrudeY(-18, -11, trackProfile(-35, 35, 12), rubber()));
  f.push(...box(-32, 32, -11, 11, 3, 12, t.lo));
  // Drive sprocket at the front, idler at the back, three bogies of two wheels with return rollers.
  f.push(...wheel(32, -18.6, 7, 4.6, 1.2, steelDark(), steel()));
  f.push(...wheel(-32, -18.6, 6, 4, 1.2, steel(), steelDark()));
  for (const b of [-18, 0, 18]) {
    f.push(...box(b - 7, b + 7, -19.6, -18.8, 6, 10, steelDark()));
    f.push(...wheel(b - 5, -18.8, 4.5, 4.2, 1.2, steel(), steelDark()));
    f.push(...wheel(b + 5, -18.8, 4.5, 4.2, 1.2, steel(), steelDark()));
    f.push(...wheel(b + 1, -18.8, 11, 1.7, 1, steel(), steelDark()));
  }
  // Upper hull: sloped glacis, sponsons over the tracks.
  f.push(...extrudeY(-18, 18, [[-34, 12], [35, 12], [35, 14], [15, 25], [-31, 25], [-34, 22]], t.mid));
  f.push(starDecal(-18.05, -10, 18.5, 4.6));
  // Spare track links on the glacis, the bow machine gun, a towing shackle.
  for (let k = 0; k < 3; k++) f.push(...box(19 + k * 4.5, 22 + k * 4.5, -12, -2, 21.5 - k * 2.4, 23 - k * 2.4, rubber()));
  f.push(...barrel(30, 36, 7, 17, 0.8, steelDark()));
  // Cast turret: rounded and tapering, a wide mantlet, the 75mm, a hatch and a .50 cal on the roof.
  f.push(...loftZ(25, circle(-1, 0, 13, 14, 0.9), 37, circle(-2, 0, 10.5, 14, 0.85), t.mid));
  f.push(...box(9, 14, -7, 7, 27, 34, t.lo));
  f.push(...barrel(13, 42, 0, 30.5, 1.7, steelDark()));
  f.push(...barrel(40, 42, 0, 30.5, 2, steelDark()));
  f.push(...loftZ(37, circle(-5, 3, 4, 10), 39, circle(-5, 3, 3.6, 10), t.lo));
  f.push(...box(-11, -9, -6, -4, 37, 41, steelDark()));
  f.push(...barrel(-11, 4, -5, 41.5, 0.6, steelDark()));
  return { faces: f, commander: [-5, 3, 39], muzzle: [42, 0, 30.5] };
}

/** Panzer IV: box hull with a vertical front plate, side skirts, boxy turret with skirts, long 75. */
export function panzerIV(t: TeamShades): Model {
  const f: Face[] = [];
  const skirt = mix(t.lo, t.mid, 0.45);
  f.push(...extrudeY(11, 18, trackProfile(-37, 37, 11), rubber()));
  f.push(...extrudeY(-18, -11, trackProfile(-37, 37, 11), rubber()));
  f.push(...box(-34, 34, -11, 11, 3, 11, t.lo));
  f.push(...wheel(35, -18.6, 6.5, 4.2, 1.2, steelDark(), steel()));
  for (let i = 0; i < 8; i++) f.push(...wheel(-27 + i * 7.7, -18.8, 3.6, 3.3, 1.2, steel(), steelDark()));
  // Hull: a vertical front plate with the driver's visor and the ball-mounted machine gun.
  f.push(...extrudeY(-17, 17, [[-36, 11], [37, 11], [37, 22], [34, 24], [-34, 24], [-36, 22]], t.mid));
  f.push(...box(37, 37.6, -9, -3, 19, 21, C("battleInk")));
  f.push(...barrel(37, 40, 6, 19, 0.8, steelDark()));
  for (let k = 0; k < 3; k++) f.push(...box(37, 38, -14 + k * 4, -11 + k * 4, 13, 17, rubber()));
  f.push(...camoDecals(-17.05, -30, 30, 14, 22, mix(t.lo, C("battleOlive"), 0.5), 2));
  // Side skirts in panels, hiding the top of the running gear.
  for (let k = 0; k < 5; k++) f.push(...box(-32 + k * 13, -20 + k * 13, -21, -20.2, 7, 18, skirt));
  // Turret: angled front plates, turret skirts, the cupola at the back, the long 75 with its brake.
  const lower: (readonly [number, number])[] = [[-14, -11], [10, -11], [14, -7], [14, 7], [10, 11], [-14, 11]];
  const upper: (readonly [number, number])[] = [[-13, -9], [8, -9], [12, -6], [12, 6], [8, 9], [-13, 9]];
  f.push(...loftZ(24, lower, 34, upper, t.mid));
  f.push(...box(-15, 9, -15, -14.2, 25, 33, skirt));
  f.push(...box(12, 16, -5, 5, 26, 32, t.lo));
  f.push(...barrel(15, 56, 0, 29, 1.4, steelDark()));
  f.push(...barrel(52, 57, 0, 29, 2.3, steelDark()));
  f.push(...loftZ(34, circle(-9, 0, 4.5, 10), 38, circle(-9, 0, 4, 10), t.lo));
  return { faces: f, commander: [-9, 0, 38], muzzle: [57, 0, 29] };
}

/** Tiger I: slab-sided hull, interleaved road wheels, Zimmerit, horseshoe turret, the 88. */
export function tiger(t: TeamShades): Model {
  const f: Face[] = [];
  f.push(...extrudeY(12, 20, trackProfile(-44, 44, 14), rubber()));
  f.push(...extrudeY(-20, -12, trackProfile(-44, 44, 14), rubber()));
  f.push(...box(-40, 40, -12, 12, 3, 13, t.lo));
  f.push(...wheel(42, -20.6, 8, 5, 1.2, steelDark(), steel()));
  // Interleaved road wheels: two overlapping layers.
  for (let i = 0; i < 8; i++) {
    const inner = i % 2 === 1;
    f.push(...wheel(-33 + i * 9.4, inner ? -19.4 : -20.8, 6.6, 6.2, 1.3, inner ? mix(steel(), steelDark(), 0.4) : steel(), steelDark()));
  }
  // Hull: big flat plates, overhanging the tracks, ridged with Zimmerit paste.
  f.push(...extrudeY(-21, 21, [[-43, 13], [45, 13], [45, 27], [42, 29], [-42, 29], [-43, 27]], t.mid));
  for (let x = -40; x < 40; x += 3) f.push(decalY(-21.05, [[x, 15], [x + 1, 15], [x + 1, 27], [x, 27]], mix(t.mid, t.lo, 0.45)));
  f.push(...box(45, 46, -16, -10, 22, 25, C("battleInk")));
  f.push(...barrel(45, 48, 10, 22, 0.9, steelDark()));
  // Tow cable along the side, mufflers on the back.
  for (let x = -36; x < 30; x += 6) f.push(...box(x, x + 4, -21.6, -21.1, 22, 23, steelDark()));
  f.push(...box(-46, -43, -10, -6, 18, 27, steelDark()));
  f.push(...box(-46, -43, 6, 10, 18, 27, steelDark()));
  // Horseshoe turret: a flat front, sides curving round the back, the mantlet and the 88.
  const horseshoe: (readonly [number, number])[] = [
    [16, -15], [16, 15], [4, 16], ...Array.from({ length: 7 }, (_, i) => {
      const a = Math.PI / 2 + (i / 6) * Math.PI;
      return [-6 + Math.cos(a) * 12, Math.sin(a) * 16] as const;
    }), [4, -16],
  ];
  f.push(...loftZ(29, horseshoe, 43, horseshoe, t.mid));
  for (let x = -14; x < 14; x += 3) f.push(decalY(-16.05, [[x, 31], [x + 1, 31], [x + 1, 42], [x, 42]], mix(t.mid, t.lo, 0.45)));
  f.push(...box(16, 21, -9, 9, 30, 41, t.lo));
  f.push(...barrel(20, 70, 0, 35.5, 2, steelDark()));
  f.push(...barrel(66, 72, 0, 35.5, 3.1, steelDark()));
  // Smoke dischargers either side of the front, cupola, stowage bin at the back.
  for (let k = 0; k < 3; k++) f.push(...barrel(14, 17, -15 + k * 1.6, 42 + k * 0.4, 0.7, steelDark()));
  f.push(...loftZ(43, circle(-8, 7, 5, 10), 46, circle(-8, 7, 4.5, 10), t.lo));
  f.push(...box(-26, -17, -10, 10, 31, 39, t.lo));
  return { faces: f, commander: [-8, 7, 46], muzzle: [72, 0, 35.5] };
}
