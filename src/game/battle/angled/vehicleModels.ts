// 3D models for the other land machines in battle scenes, drawn turned 5° toward the viewer like
// the tanks (mesh.ts, 08-art-pipeline §18): recon vehicles, halftracks, Mobile AA, flak guns,
// howitzers, rocket launchers and the bunker. The crews stay sprites, drawn between a model's
// parts: a model's `far` parts go behind its crew and its `near` parts in front of them.
// US: Willys jeep, M3 halftrack, M16 quad .50, 90mm M2, 105mm M2A1, T34 Calliope.
// Germany: R75 motorcycle and sidecar, Sd.Kfz. 251, Flakvierling, 88mm Flak, leFH 18, Nebelwerfer 41.

import { C, mix, type TeamShades } from "../colors";
import { barrel, beam, box, circle, decalX, decalY, decalZ, elevate, elevatePoint, extrudeX, extrudeY, loftZ, wheel, type Face, type V3 } from "./mesh";
import { camoDecals, roadWheel, running, sherman, starDecal } from "./models";

/** A machine's parts, drawn in order with the crew between them, and the points the rig needs. */
export interface Built<A extends string> {
  /** Behind the crew. */
  readonly far: readonly Face[];
  /** In front of the crew: the near side of an open hull, near wheels. */
  readonly near: readonly Face[];
  /** In front of a second crewman sitting nearer still (the sidecar gunner). */
  readonly front?: readonly Face[];
  readonly at: Readonly<Record<A, V3>>;
}

type Poly = (readonly [number, number])[];

const rubber = () => C("battleRubber");
const steel = () => C("battleSteel");
const steelDark = () => C("battleSteelDark");
const olive = () => C("battleOlive");
const ink = () => C("battleInk");
const glass = (t: TeamShades) => mix(C("battleSkyLow"), t.lo, 0.2);

/** A road tire: black rubber, a steel hub. */
const tire = (x: number, y: number, z: number, r: number, w = 3) => wheel(x, y, z, r, w, rubber(), steel());

/**
 * An open hull's dark inside, seen from above. A shape rather than a marking, so the near wall
 * hides it where it should.
 */
const inside = (z: number, outline: Poly): Face => ({ points: outline.map(([x, y]) => [x, y, z] as V3), color: mix(ink(), C("battleSteelDark"), 0.3) });

// ---- Recon ----

/** Willys jeep: a flat-sided tub, flat hood with a star, upright windshield, pedestal .30 cal. */
export function willys(t: TeamShades, shake = 0): Built<"gunner" | "driver" | "grip" | "fore" | "muzzle"> {
  const far: Face[] = [];
  const near: Face[] = [];
  // The tub side with its cut-out beside the seats.
  const side: Poly = [[-31, 7], [6, 7], [6, 19], [4, 19], [2, 15], [-6, 15], [-8, 19], [-31, 19]];
  far.push(...tire(-18, 10.5, 7, 7), ...tire(23, 10.5, 7, 7));
  far.push(...box(-31, 6, -10, 10, 7, 9, t.lo));
  far.push(...extrudeY(9, 10, side, t.mid));
  far.push(...box(-32, -31, -10, 10, 7, 19, t.mid));
  // Seats and the rear bench, the hood with a star on top, the cowl and the grille.
  far.push(...box(-3, 4, 2, 8, 9, 13, C("battleLeather")), ...box(-3, 4, -8, -2, 9, 13, C("battleLeather")));
  far.push(...box(-29, -20, -8, 8, 9, 13, C("battleLeather")));
  far.push(...box(5, 7, -10, 10, 7, 20, t.mid));
  far.push(...extrudeY(-9, 9, [[6, 8], [35, 8], [35, 17], [6, 18]], t.mid));
  far.push(starDecal(-9.05, 22, 12.5, 3.2));
  far.push(decalZ(17.6, Array.from({ length: 10 }, (_, i) => {
    const a = (i * Math.PI) / 5;
    const r = i % 2 === 0 ? 5 : 2.1;
    return [21 + Math.cos(a) * r, Math.sin(a) * r] as const;
  }), C("battleStar")));
  for (let k = 0; k < 5; k++) far.push(decalX(35.05, [[-6 + k * 3, 10], [-5 + k * 3, 10], [-5 + k * 3, 16], [-6 + k * 3, 16]], ink()));
  far.push(...box(33, 36, -9, -6, 13, 16, C("battleSkyLow")), ...box(33, 36, 6, 9, 13, 16, C("battleSkyLow")));
  far.push(...box(8, 36, 9, 13, 14, 15, t.lo));
  // Windshield frame and glass, a spare wheel and jerrycan on the back, the whip antenna.
  far.push(...extrudeX(-35, -32, circle(3, 14, 6.5, 12), rubber()), ...extrudeX(-35.4, -34.6, circle(3, 14, 3, 8), steel()));
  far.push(...box(-35, -32, -9, -4, 8, 16, olive()));
  far.push(...box(-31.5, -30.8, 8, 8.7, 19, 50, steelDark()));
  // The pedestal and its M1919: receiver, perforated jacket, ammunition can.
  const g = -shake;
  far.push(...box(-5, -3, -1, 1, 9, 30, steelDark()));
  far.push(...box(-12 + g, 0 + g, -1.5, 1.5, 30, 33.5, steelDark()));
  far.push(...barrel(0 + g, 14 + g, 0, 32, 1.2, steelDark()), ...barrel(14 + g, 18 + g, 0, 32, 0.6, steelDark()));
  far.push(...box(-9 + g, -4 + g, -4.5, -1.5, 27, 31, olive()));
  // In front of the crew: the windshield, the tub's near wall, fender and wheels.
  near.push(...box(7, 8, -10, -9, 19, 31, t.lo), ...box(7, 8, 9, 10, 19, 31, t.lo), ...box(7, 8, -10, 10, 30, 31, t.lo));
  near.push(...box(7.2, 7.8, -9, 9, 19, 30, glass(t)));
  near.push(...extrudeY(-10, -9, side, t.mid));
  near.push(...box(8, 36, -13, -9, 14, 15, t.lo));
  near.push(...tire(-18, -10.5, 7, 7), ...tire(23, -10.5, 7, 7));
  return { far, near, at: { gunner: [-17, 0, 2], driver: [0, 5, 13], grip: [-9 + g, 0, 32], fore: [-1 + g, 0, 31], muzzle: [18 + g, 0, 32] } };
}

/** R75 motorcycle with its sidecar on the near side; an MG 34 on the sidecar's nose. */
export function r75(t: TeamShades, shake = 0): Built<"rider" | "bars" | "gunner" | "grip" | "fore" | "muzzle"> {
  const far: Face[] = [];
  const near: Face[] = [];
  // The bike, on the far side: spoked wheels, frame, boxer engine, tank, saddle, fork, headlight.
  far.push(...wheel(-18, 4, 7, 7, 2, rubber(), steel()), ...wheel(18, 4, 7, 7, 2, rubber(), steel()));
  far.push(...extrudeY(3.4, 4.6, [[-18, 7], [0, 15], [18, 7], [16, 6], [0, 12], [-16, 6]], steelDark()));
  far.push(...box(-6, 2, 1, 7, 7, 13, steelDark()), ...box(-4, 0, -1, 9, 8, 11, steel()));
  far.push(...box(-4, 10, 2, 6, 15, 20, t.mid));
  far.push(...box(-13, -6, 2.5, 5.5, 17, 19, C("battleLeather")));
  far.push(...extrudeY(3.4, 4.6, [[11, 24], [13, 24], [19, 7], [17, 7]], steel()));
  far.push(...box(14, 18, 2, 6, 20, 24, steelDark()), ...box(10, 12, -2, 10, 26, 27, steelDark()));
  far.push(...extrudeY(2.5, 5.5, [[-26, 10], [-24, 14], [-12, 14], [-12, 13], [-23, 13], [-25, 10]], t.mid));
  // In front of the rider, the sidecar: a boat-shaped tub, its spare wheel on the back, the MG on a
  // post at the nose.
  const plan: Poly = [[-26, -12], [4, -12], [14, -8], [4, -4], [-26, -4]];
  near.push(...loftZ(5, plan, 14, plan, t.mid));
  near.push(inside(14.05, [[-22, -11], [0, -11], [6, -8], [0, -5], [-22, -5]]));
  near.push(...extrudeX(-29, -26, circle(-8, 10, 4.5, 10), rubber()));
  const g = -shake;
  near.push(...box(5, 7, -9, -7, 14, 20, steelDark()));
  near.push(...box(-6 + g, -1 + g, -9, -7, 19, 22, rubber()));
  near.push(...box(-1 + g, 4 + g, -9, -7, 19.5, 22, steelDark()));
  near.push(...barrel(4 + g, 16 + g, -8, 21, 1, steelDark()), ...box(10 + g, 11 + g, -8.5, -7.5, 22, 24, steelDark()));
  // In front of the gunner: the sidecar's near wall and wheel.
  const front: Face[] = [...box(-25, 4, -12.6, -12, 5, 12, t.mid), ...wheel(-2, -13.5, 5, 5, 2, rubber(), steel())];
  return { far, near, front, at: { rider: [-7, 4, 4], bars: [12, 4, 26], gunner: [-13, -8, 7], grip: [-2 + g, -8, 21], fore: [5 + g, -8, 21], muzzle: [16 + g, -8, 21] } };
}

// ---- Halftracks ----

/** M3: a box troop compartment, armored cab with its shutter up, louvred hood, winch roller. */
function m3Chassis(t: TeamShades): Face[] {
  const f: Face[] = [];
  f.push(...running(-32, 6, 12, 7, 12, t.lo));
  f.push(...wheel(4, -12.6, 6, 4.4, 1.2, steelDark(), steel()), ...wheel(-30, -12.6, 6, 4, 1.2, steel(), steelDark()));
  for (let i = 0; i < 4; i++) f.push(...roadWheel(-23 + i * 7, -12.8, 4.5, 4.2));
  f.push(...tire(25, 10.5, 7, 7), ...tire(25, -10.5, 7, 7));
  // Open compartment: floor, walls, rear door.
  f.push(...box(-34, 6, -11, 11, 12, 14, t.lo));
  f.push(...box(-34, 6, 10, 11, 12, 27, t.mid), ...box(-34, 6, -11, -10, 12, 27, t.mid), ...box(-34, -33, -10, 10, 12, 27, t.mid));
  f.push(inside(14.05, [[-33, -10], [6, -10], [6, 10], [-33, 10]]));
  f.push(starDecal(-11.05, -14, 20, 4));
  for (let x = -30; x < 6; x += 6) f.push(decalY(-11.05, [[x, 21], [x + 1, 21], [x + 1, 22], [x, 22]], t.lo));
  f.push(...box(-33, 4, -12, -11, 24, 25, steelDark()));
  // Cab with the armored windshield shutter raised, hood with louvres, fenders, bumper and roller.
  f.push(...box(6, 18, -11, 11, 12, 28, t.mid));
  f.push(...box(17, 18.6, -10, 10, 24, 28, steelDark()));
  f.push(decalX(18.65, [[-8, 25], [8, 25], [8, 27], [-8, 27]], glass(t)));
  f.push(...extrudeY(-9, 9, [[18, 12], [33, 12], [33, 20], [18, 21]], t.mid));
  for (let x = 20; x < 30; x += 2) f.push(decalY(-9.05, [[x, 15], [x + 1, 15], [x + 1, 18], [x, 18]], t.lo));
  f.push(...box(18, 34, -13, -9, 15, 16, t.lo), ...box(18, 34, 9, 13, 15, 16, t.lo));
  f.push(...box(30, 32, -12, -9, 20, 23, C("battleSkyLow")), ...box(30, 32, 9, 12, 20, 23, C("battleSkyLow")));
  f.push(...box(33, 35, -12, 12, 10, 13, steelDark()));
  f.push(...extrudeY(-6, 6, circle(37, 12, 3, 10), steel()));
  return f;
}

/** Sd.Kfz. 251: an armored body with plates angled in, a long sloped engine nose, interleaved wheels. */
function sdkfz251Chassis(t: TeamShades): Face[] {
  const f: Face[] = [];
  f.push(...running(-34, 10, 12, 7, 12, t.lo));
  for (let i = 0; i < 6; i++) f.push(...roadWheel(-28 + i * 6.5, i % 2 ? -12.2 : -12.9, 5.5, 5.4, i % 2 ? 0.8 : 1));
  f.push(...wheel(26, 10.5, 7, 7, 2.6, rubber(), steel()), ...wheel(26, -10.5, 7, 7, 2.6, rubber(), steel()));
  // Lower body straight up, upper plates angled in; open on top.
  f.push(...box(-34, 4, -11, 11, 10, 18, t.mid));
  f.push(...camoDecals(-11.05, -32, 2, 11, 17, t, 1));
  f.push(...loftZ(18, [[-34, -11], [4, -11], [4, 11], [-34, 11]], 28, [[-33, -9], [4, -9], [4, 9], [-33, 9]], t.mid));
  f.push(inside(28.05, [[-32, -8], [3, -8], [3, 8], [-32, 8]]));
  // The nose slopes down to the radiator; curved front fenders; a Notek light.
  f.push(...loftZ(10, [[4, -10], [34, -6], [34, 6], [4, 10]], 26, [[4, -9], [16, -6], [16, 6], [4, 9]], t.mid));
  const fender: Poly = [[16, 12], [20, 17], [32, 17], [37, 12], [35, 12], [31, 15], [21, 15], [18, 12]];
  f.push(...extrudeY(-13.5, -9.5, fender, t.lo), ...extrudeY(9.5, 13.5, fender, t.lo));
  f.push(...box(29, 31, -9, -7, 18, 20, steelDark()));
  for (const vx of [-24, -10]) f.push(decalY(-11.1, [[vx, 15], [vx + 4, 15], [vx + 4, 16], [vx, 16]], ink()));
  // Stowage bins on the side.
  f.push(...box(-30, -21, -12.4, -11, 11, 15, t.lo), ...box(-18, -9, -12.4, -11, 11, 15, t.lo));
  return f;
}

/** Where the riflemen's helmets show over the side of the compartment. */
const TROOPS: readonly V3[] = [[-28, -4, 26], [-19, 4, 26], [-10, -4, 26]];

export function m3(t: TeamShades, shake = 0): Built<"muzzle" | "troop0" | "troop1" | "troop2"> {
  const far = m3Chassis(t);
  // The .50 on its ring mount over the cab.
  const g = -shake;
  far.push(...loftZ(30, circle(11, 0, 8, 12), 31, circle(11, 0, 8, 12), steelDark()));
  far.push(...box(9, 11, -1, 1, 28, 33, steelDark()));
  far.push(...box(6 + g, 14 + g, -1.5, 1.5, 33, 36, steelDark()), ...barrel(14 + g, 29 + g, 0, 34.5, 1, steelDark()));
  return { far, near: [], at: { muzzle: [29 + g, 0, 34.5], troop0: TROOPS[0] ?? [0, 0, 0], troop1: TROOPS[1] ?? [0, 0, 0], troop2: TROOPS[2] ?? [0, 0, 0] } };
}

export function sdkfz251(t: TeamShades, shake = 0): Built<"muzzle" | "troop0" | "troop1" | "troop2"> {
  const far = sdkfz251Chassis(t);
  // The MG 34 behind its shield at the front of the compartment.
  const g = -shake;
  far.push(...box(2, 3, -5, 5, 27, 35, t.mid));
  far.push(...box(-9 + g, -5 + g, -1, 1, 29.5, 32, rubber()), ...box(-5 + g, 3 + g, -1, 1, 30, 32.5, steelDark()));
  far.push(...barrel(3 + g, 16 + g, 0, 31.5, 0.9, steelDark()));
  return { far, near: [], at: { muzzle: [16 + g, 0, 31.5], troop0: TROOPS[0] ?? [0, 0, 0], troop1: TROOPS[1] ?? [0, 0, 0], troop2: TROOPS[2] ?? [0, 0, 0] } };
}

// ---- Mobile AA ----

/** The four guns' places across the mount: two side by side, two above them. */
const QUAD: readonly (readonly [number, number])[] = [[-4.5, -2], [4.5, -2], [-4.5, 2.5], [4.5, 2.5]];
const AA_PIVOT: V3 = [-14, 0, 35];

/**
 * Mobile AA: the US M16 (an M3 with the Maxson quad .50 turret) or a Sd.Kfz. 251 carrying the
 * Flakvierling's four 20mm guns behind their shield. `elevation` raises the guns; `kick` is which
 * barrel just fired (it slides back), or -1.
 */
export function quadAA(t: TeamShades, german: boolean, elevation: number, kick: number): Built<"gunner" | "muzzle0" | "muzzle1" | "muzzle2" | "muzzle3"> {
  const far = german ? sdkfz251Chassis(t) : m3Chassis(t);
  const [px, , pz] = AA_PIVOT;
  const len = german ? 26 : 22;
  if (german) {
    // The Flakvierling's flat shield and its pedestal.
    far.push(...loftZ(27, circle(px, 0, 7, 10), 31, circle(px, 0, 6, 10), steelDark()));
    far.push(...box(px + 9, px + 10, -13, 13, 28, 44, t.mid));
    far.push(...box(px + 9, px + 10, -3, 3, 42, 44, ink()));
  } else {
    // The Maxson turret: a round base, armored wings, ammunition chests either side.
    far.push(...loftZ(27, circle(px, 0, 9, 12), 31, circle(px, 0, 8, 12), t.lo));
    far.push(...box(px - 6, px + 4, -11, -10, 29, 38, t.lo), ...box(px - 6, px + 4, 10, 11, 29, 38, t.lo));
    far.push(...box(px - 6, px + 2, -9, -5.5, 31, 38, olive()), ...box(px - 6, px + 2, 5.5, 9, 31, 38, olive()));
  }
  const guns: Face[] = [];
  QUAD.forEach(([y, dz], i) => {
    const back = kick === i ? 2 : 0;
    guns.push(...barrel(px - 4 - back, px + len - back, y, pz + dz, 1, i % 2 ? steel() : steelDark()));
    if (german) guns.push(...barrel(px + len - 2 - back, px + len - back, y, pz + dz, 1.5, steelDark()));
    else guns.push(...barrel(px - 4 - back, px + 6 - back, y, pz + dz, 1.6, steelDark()));
  });
  guns.push(...box(px - 6, px + 2, -3, 3, pz - 3, pz + 4, steelDark()));
  far.push(...elevate(guns, px, pz, elevation));
  const muzzle = (i: number): V3 => {
    const [y, dz] = QUAD[i] ?? [0, 0];
    return elevatePoint([px + len, y, pz + dz], px, pz, elevation);
  };
  return { far, near: [], at: { gunner: [px - 6, 0, 32], muzzle0: muzzle(0), muzzle1: muzzle(1), muzzle2: muzzle(2), muzzle3: muzzle(3) } };
}

// ---- Flak guns ----

const FLAK_PIVOT: V3 = [0, 0, 26];
export const FLAK_LEN = 56;

/** The 88mm Flak (with its gun shield) or the US 90mm, on a cross-shaped platform with outriggers. */
export function flakGun(t: TeamShades, german: boolean, elevation: number, recoil: number): Built<"muzzle" | "breech" | "handwheel"> {
  const far: Face[] = [];
  const [px, , pz] = FLAK_PIVOT;
  // The cross-shaped platform, jack pads at its four ends, the pedestal and the carriage.
  far.push(...box(-38, 38, -3, 3, 2, 6, t.lo), ...box(-3, 3, -32, 32, 2, 6, t.lo));
  for (const [x, y] of [[-38, 0], [38, 0], [0, -32], [0, 32]] as const) far.push(...box(x - 3, x + 3, y - 3, y + 3, 0, 2, steelDark()));
  far.push(...loftZ(6, circle(0, 0, 9, 12), 11, circle(0, 0, 7, 12), t.mid));
  far.push(...box(-7, 9, -7, -5, 10, 29, t.mid), ...box(-7, 9, 5, 7, 10, 29, t.mid));
  far.push(...wheel(12, -8.5, 17, 3, 1, steelDark(), steel()));
  if (german) {
    // The 88's shield, cut away round the barrel.
    far.push(...box(12, 13, -15, -4, 12, 40, t.mid), ...box(12, 13, 4, 15, 12, 40, t.mid), ...box(12, 13, -4, 4, 12, 20, t.mid));
  } else {
    // The 90mm's fuze setter.
    far.push(...box(-22, -15, -10, -5, 6, 15, t.lo));
  }
  const gun: Face[] = [
    ...barrel(-14 - recoil, FLAK_LEN - recoil, 0, pz, 2.4, steelDark()),
    ...barrel(-10 - recoil, 20 - recoil, 0, pz + 4.5, 1.8, t.lo),
    ...barrel(-8, 16, 0, pz - 4.5, 1.8, t.lo),
    ...box(-20 - recoil, -12 - recoil, -3.5, 3.5, pz - 3.5, pz + 3.5, steelDark()),
  ];
  if (german) gun.push(...barrel(FLAK_LEN - 4 - recoil, FLAK_LEN - recoil, 0, pz, 3, steelDark()));
  far.push(...elevate(gun, px, pz, elevation));
  return {
    far,
    near: [],
    at: { muzzle: elevatePoint([FLAK_LEN, 0, pz], px, pz, elevation), breech: elevatePoint([-20, 0, pz], px, pz, elevation), handwheel: [12, -9, 17] },
  };
}

// ---- Howitzers ----

const HOWITZER_PIVOT: V3 = [4, 0, 30];
const HOWITZER_LEN = 44;

/** The leFH 18 (tall notched shield, spoked steel wheels, muzzle brake) or the US 105mm M2A1. */
export function howitzer(t: TeamShades, german: boolean, elevation: number, recoil: number): Built<"muzzle" | "breech"> {
  const far: Face[] = [];
  const near: Face[] = [];
  const [px, , pz] = HOWITZER_PIVOT;
  // The split trail opened out behind, with spades, and the ready-round box.
  far.push(...beam([-2, 5, 14], [-50, 17, 3], 4, 4, t.lo), ...box(-55, -49, 13, 21, 0, 6, steelDark()));
  near.push(...beam([-2, -5, 14], [-50, -17, 3], 4, 4, t.lo), ...box(-55, -49, -21, -13, 0, 6, steelDark()));
  if (!german) near.push(...beam([-36, -14, 5], [-40, -15, 14], 1.5, 1.5, C("battleWood")));
  far.push(...box(-66, -54, -4, 4, 0, 7, C("battleWood")));
  for (let i = 0; i < 3; i++) far.push(...box(-65 + i * 4, -62 + i * 4, -2, 1, 7, 10, C("battleBrass")));
  // Wheels on their axle, the cradle.
  const wheelOf = (y: number) => (german ? wheel(0, y, 14, 14, 3, steel(), steelDark()) : tire(0, y, 14, 14, 4));
  far.push(...wheelOf(15));
  far.push(...extrudeY(-14, 14, circle(0, 14, 2, 8), steelDark()));
  far.push(...box(-6, 8, -5, 5, 16, 26, t.mid));
  if (german) for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    near.push(decalY(-16.6, [[Math.cos(a) * 3, 14 + Math.sin(a) * 3], [Math.cos(a) * 11, 14 + Math.sin(a) * 11], [Math.cos(a + 0.15) * 11, 14 + Math.sin(a + 0.15) * 11]], steelDark()));
  }
  near.push(...wheelOf(-15));
  // The shield: tall with a notch on the leFH, low and leaning back on the M2A1.
  // Its wings sweep back either side of the barrel, so the near one faces the viewer.
  const top = german ? 50 : 42;
  const wing = (s: 1 | -1): Poly => [[10, s * 4], [11.5, s * 4], [5.5, s * 17], [4, s * 17]];
  far.push(...loftZ(10, wing(1), top, wing(1), t.mid));
  far.push(...box(9, 11, -4, 4, 10, german ? 30 : 26, t.mid));
  if (german) far.push(...box(9, 11, -4, 4, 40, top, t.mid));
  near.push(...loftZ(10, wing(-1), top, wing(-1), t.mid));
  near.push(decalY(-12, [[6, top - 9], [8, top - 9], [8, top - 5], [6, top - 5]], ink()));
  // The barrel with its recuperator underneath and the breech block.
  const gun: Face[] = [
    ...barrel(-16 - recoil, HOWITZER_LEN - recoil, 0, pz, 2.6, steelDark()),
    ...barrel(-10, 30, 0, pz - 4.5, 2, t.lo),
    ...box(-22 - recoil, -14 - recoil, -3.5, 3.5, pz - 3.5, pz + 3.5, steelDark()),
  ];
  if (german) gun.push(...box(HOWITZER_LEN - 4 - recoil, HOWITZER_LEN + 1 - recoil, -3.4, 3.4, pz - 3.4, pz + 3.4, steelDark()));
  far.push(...elevate(gun, px, pz, elevation));
  return { far, near, at: { muzzle: elevatePoint([HOWITZER_LEN, 0, pz], px, pz, elevation), breech: elevatePoint([-20, 0, pz], px, pz, elevation) } };
}

// ---- Rocket artillery ----

const NEBEL_PIVOT: V3 = [2, 0, 22];
const NEBEL_LEN = 22;

/** Nebelwerfer 41: six barrels in a ring on a light two-wheeled carriage with a single trail. */
export function nebelwerfer(t: TeamShades, elevation: number): Built<"muzzle0" | "muzzle1" | "muzzle2" | "muzzle3" | "muzzle4" | "muzzle5"> {
  const far: Face[] = [];
  const near: Face[] = [];
  const [px, , pz] = NEBEL_PIVOT;
  far.push(...beam([0, 0, 8], [-30, 0, 2], 3, 3, t.lo), ...box(-34, -29, -3, 3, 0, 4, steelDark()));
  far.push(...wheel(0, 11, 8, 8, 2, steel(), steelDark()));
  far.push(...extrudeY(-11, 11, circle(0, 8, 1.4, 8), steelDark()));
  far.push(...box(-3, 7, -3, 3, 8, 18, t.mid));
  const ring: Face[] = [];
  const at = (k: number): readonly [number, number] => {
    const a = (k / 6) * Math.PI * 2 + Math.PI / 6;
    return [Math.cos(a) * 5.4, pz + Math.sin(a) * 5.4];
  };
  for (let k = 0; k < 6; k++) {
    const [y, z] = at(k);
    ring.push(...barrel(-12, NEBEL_LEN, y, z, 2.4, k % 2 ? steel() : steelDark()));
  }
  for (const x of [-6, 12]) ring.push(...extrudeX(x, x + 2, circle(0, pz, 8.4, 6), t.lo));
  far.push(...elevate(ring, px, pz, elevation));
  near.push(...wheel(0, -11, 8, 8, 2, steel(), steelDark()));
  const muzzle = (k: number): V3 => {
    const [y, z] = at(k);
    return elevatePoint([NEBEL_LEN, y, z], px, pz, elevation);
  };
  return { far, near, at: { muzzle0: muzzle(0), muzzle1: muzzle(1), muzzle2: muzzle(2), muzzle3: muzzle(3), muzzle4: muzzle(4), muzzle5: muzzle(5) } };
}

const RACK_PIVOT: V3 = [0, 0, 45];
const RACK = { x0: -22, x1: 22, z0: 45, z1: 56, half: 14, rows: 5 };

/** T34 Calliope: a Sherman carrying a 60-tube rocket rack over its turret, tied to the gun barrel. */
export function calliope(t: TeamShades, elevation: number): Built<"muzzle0" | "muzzle1" | "muzzle2" | "muzzle3" | "muzzle4"> {
  const tank = sherman(t);
  const far: Face[] = [...tank.faces];
  const [px, , pz] = RACK_PIVOT;
  const { x0, x1, z0, z1, half, rows } = RACK;
  const rack: Face[] = [...box(x0, x1, -half, half, z0, z1, t.lo)];
  const rowH = (z1 - z0) / rows;
  // Tube ends showing on the near side and the front, tube tops along the roof.
  for (let r = 0; r < rows; r++) {
    const z = z0 + r * rowH;
    rack.push(decalY(-half - 0.05, [[x0 + 1, z + rowH * 0.45], [x1 - 1, z + rowH * 0.45], [x1 - 1, z + rowH * 0.6], [x0 + 1, z + rowH * 0.6]], t.deep));
    for (let c = 0; c < 12; c++) {
      const y = -half + 1.5 + c * ((2 * half - 3) / 11);
      rack.push(decalX(x1 + 0.05, [[y - 0.9, z + 0.6], [y + 0.9, z + 0.6], [y + 0.9, z + rowH - 0.6], [y - 0.9, z + rowH - 0.6]], ink()));
    }
  }
  for (let c = 0; c < 12; c++) {
    const y = -half + 1.5 + c * ((2 * half - 3) / 11);
    rack.push(decalZ(z1 + 0.05, [[x0 + 1, y - 0.4], [x1 - 1, y - 0.4], [x1 - 1, y + 0.4], [x0 + 1, y + 0.4]], t.deep));
  }
  far.push(...elevate(rack, px, pz, elevation));
  // Struts down to the hull, and the arm that ties the rack to the gun barrel.
  const frontLow = elevatePoint([x1 - 2, 0, z0], px, pz, elevation);
  far.push(...beam([frontLow[0], 0, frontLow[2]], [40, 0, 31], 1.6, 1.6, steelDark()));
  for (const y of [-16, 16]) far.push(...beam([-18, y, 25], [-18, y, elevatePoint([-18, 0, z0], px, pz, elevation)[2]], 1.6, 1.6, steelDark()));
  const muzzle = (r: number): V3 => elevatePoint([x1, 0, z0 + (r + 0.5) * rowH], px, pz, elevation);
  return { far, near: [], at: { muzzle0: muzzle(0), muzzle1: muzzle(1), muzzle2: muzzle(2), muzzle3: muzzle(3), muzzle4: muzzle(4) } };
}

// ---- Bunker ----

/** A concrete bunker: sloped walls, a roof slab under camouflage netting, a gun in its embrasure. */
export function bunker(t: TeamShades): Built<"muzzle"> {
  const far: Face[] = [];
  const wall = mix(t.mid, t.lo, 0.4);
  const h = 36;
  // The walls lean in: the near wall from y -26 at the ground to -21 at the top, the front from x 42 to 32.
  const nearY = (z: number) => -26 + (z * 5) / h - 0.12;
  const frontX = (z: number) => 42 - (z * 10) / h + 0.12;
  const onNear = (x0: number, x1: number, z0: number, z1: number, color: string): Face => ({
    points: [[x0, nearY(z0), z0], [x1, nearY(z0), z0], [x1, nearY(z1), z1], [x0, nearY(z1), z1]], color, decal: true, facing: [0, -1, 0.14],
  });
  far.push(...loftZ(0, [[-42, -26], [42, -26], [42, 26], [-42, 26]], h, [[-34, -21], [32, -21], [32, 21], [-34, 21]], wall));
  far.push(...box(-32, 29, -19, 19, h, h + 5, t.lo));
  // Shuttering lines, an observation slit and the steel door on the near wall.
  for (let z = 6; z < h - 2; z += 7) far.push(onNear(-40 + z / 4, 40 - z / 4, z, z + 0.7, mix(wall, t.deep, 0.35)));
  far.push(onNear(-4, 22, 22, 26, ink()));
  far.push(onNear(-28, -17, 0, 21, steelDark()), onNear(-27, -18, 19, 20, steel()));
  // The embrasure on the sloped front wall, with the gun barrel in it.
  far.push({ points: [[frontX(14), -13, 14], [frontX(14), 13, 14], [frontX(22), 13, 22], [frontX(22), -13, 22]], color: ink(), decal: true, facing: [1, 0, 0.27] });
  far.push(...barrel(30, 50, 0, 18, 1.5, steelDark()));
  // Netting and turf over the roof.
  for (let k = 0; k < 12; k++) {
    const x = -28 + ((k * 23) % 54);
    const y = -16 + ((k * 13) % 31);
    far.push(decalZ(h + 5.05, circle(x, y, 4.5, 7), mix(C("battleTreeDark"), C("battleOlive"), (k % 3) * 0.3)));
  }
  return { far, near: [], at: { muzzle: [50, 0, 18] } };
}
