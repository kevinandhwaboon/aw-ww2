// 3D models for ships in battle scenes, turned 5° toward the viewer like the land machines (mesh.ts,
// 08-art-pipeline §18). Each naval unit is one ship. US: an Iowa-class battleship, a Fletcher, a Gato,
// an LCT carrying two Shermans and an Elco PT boat. Germany: a 1936A Zerstörer, a Type VII U-boat, an
// S-boot, and the LCT hull carrying two Panzer IVs. Japan: the Yamato, a Kagero, a B1-type I-boat
// with its aircraft hangar, a Daihatsu carrying a Ha-Go, and a small torpedo boat. Carriers: the
// Essex class for the US and UK, the Shōkaku for Japan; Germany has none. Ships carry no
// insignia (08-art-pipeline §12).
//
// Model axes as for the tanks: x toward the bow, y to port (the near side is y negative), z up, with
// the waterline at z = 0. Parts are grouped in layers drawn one after the other, so that whatever
// stands on a deck is always drawn over that deck however big the deck's faces are.

import { C, mix, shade, type TeamShades } from "../colors";
import { barrel, box, circle, decalX, decalY, decalZ, elevate, elevatePoint, loftZ, oriented, shift, type Face, type V3 } from "./mesh";
import { TANK_MODELS } from "./models";

type Poly = (readonly [number, number])[];

/** One cross-section of a hull: at `x`, `b` either side of the centerline, from `bottom` up to the deck at `top`. */
export interface Station {
  readonly x: number;
  readonly b: number;
  readonly top: number;
  readonly bottom: number;
}

export interface ShipModel {
  /** Drawn in order: the hull, then deckhouses, then what stands on them. */
  readonly layers: readonly (readonly Face[])[];
  /** The hull's outline where it meets the water, bow first: the waves follow it. */
  readonly water: readonly Station[];
  /** The deck edge, bow first, for the guard rails; null for a submarine. */
  readonly deck: readonly Station[] | null;
  /** Named points: muzzles, the depth-charge racks, troops' heads. */
  readonly at: Readonly<Record<string, V3>>;
  /** Heads of troops aboard, drawn as sprites. */
  readonly troops: readonly V3[];
  /** How far to raise the model so its near waterline sits on the figure's origin. */
  readonly lift: number;
}

/**
 * A rod from a to b, `w` by `h` thick, with its cross-section square to its length: masts, booms,
 * rails and light gun barrels. (The shared `beam` keeps its section level, so it goes paper-thin
 * when it stands upright.)
 */
function beam(a: V3, b: V3, w: number, h: number, color: string): Face[] {
  const d: V3 = [b[0] - a[0], b[1] - a[1], b[2] - a[2]];
  const len = Math.hypot(...d) || 1;
  const u0: V3 = [d[0] / len, d[1] / len, d[2] / len];
  const ref: V3 = Math.abs(u0[1]) > 0.9 ? [1, 0, 0] : [0, 1, 0];
  const cross = (p: V3, q: V3): V3 => [p[1] * q[2] - p[2] * q[1], p[2] * q[0] - p[0] * q[2], p[0] * q[1] - p[1] * q[0]];
  const c1 = cross(u0, ref);
  const l1 = Math.hypot(...c1) || 1;
  const u: V3 = [c1[0] / l1, c1[1] / l1, c1[2] / l1];
  const v = cross(u0, u);
  const corner = (c: V3, su: number, sv: number): V3 => [
    c[0] + u[0] * su * (w / 2) + v[0] * sv * (h / 2),
    c[1] + u[1] * su * (w / 2) + v[1] * sv * (h / 2),
    c[2] + u[2] * su * (w / 2) + v[2] * sv * (h / 2),
  ];
  const signs = [[-1, -1], [1, -1], [1, 1], [-1, 1]] as const;
  const ra = signs.map(([su, sv]) => corner(a, su, sv));
  const rb = signs.map(([su, sv]) => corner(b, su, sv));
  const mid: V3 = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2];
  const f: Face[] = [oriented(ra, color, mid), oriented(rb, color, mid)];
  for (let i = 0; i < 4; i++) {
    const j = (i + 1) % 4;
    const p0 = ra[i];
    const p1 = ra[j];
    const q0 = rb[i];
    const q1 = rb[j];
    if (p0 && p1 && q0 && q1) f.push(oriented([p0, p1, q1, q0], color, mid));
  }
  return f;
}

const st = (x: number, b: number, top: number, bottom: number): Station => ({ x, b, top, bottom });
const steel = () => C("battleSteel");
const steelDark = () => C("battleSteelDark");
const ink = () => C("battleInk");
/** Long naval barrels: a lighter steel, so a turret's barrels read as separate guns. */
const gunMetal = () => mix(C("battleSteel"), C("battleSteelDark"), 0.35);

function along(stations: readonly Station[], x: number, pick: (s: Station) => number): number {
  const first = stations[0];
  const last = stations[stations.length - 1];
  if (!first || !last) return 0;
  if (x >= first.x) return pick(first);
  if (x <= last.x) return pick(last);
  for (let i = 0; i + 1 < stations.length; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    if (!a || !b || x > a.x || x < b.x) continue;
    const u = a.x === b.x ? 0 : (a.x - x) / (a.x - b.x);
    return pick(a) + (pick(b) - pick(a)) * u;
  }
  return pick(last);
}

export const deckAt = (s: readonly Station[], x: number): number => along(s, x, (q) => q.top);
export const beamAt = (s: readonly Station[], x: number): number => along(s, x, (q) => q.b);

/** Where the stem and the stern come out of the water, from the hull's outline. */
export function waterline(s: readonly Station[]): { bow: number; stern: number } {
  let bow = s[0]?.x ?? 0;
  let stern = s[s.length - 1]?.x ?? 0;
  for (let i = 0; i + 1 < s.length; i++) {
    const a = s[i];
    const b = s[i + 1];
    if (!a || !b) continue;
    if (a.bottom > 0 && b.bottom <= 0) bow = a.x + (b.x - a.x) * (a.bottom / (a.bottom - b.bottom));
    if (a.bottom <= 0 && b.bottom > 0) stern = a.x + (b.x - a.x) * (-a.bottom / (b.bottom - a.bottom));
  }
  return { bow, stern };
}

interface HullPaint {
  /** Below `boot`. */
  readonly lower: string;
  readonly upper: string;
  readonly deck: string;
  readonly boot: number;
}

const same = (a: V3 | undefined, b: V3 | undefined) => !!a && !!b && a[0] === b[0] && a[1] === b[1] && a[2] === b[2];

/** A hull lofted through its stations, bow first: sides in two colors, the deck, and closed ends. */
function hull(stations: readonly Station[], paint: HullPaint): Face[] {
  const f: Face[] = [];
  const section = (s: Station): V3[] => {
    const boot = Math.min(s.top, Math.max(s.bottom, paint.boot));
    return [[s.x, -s.b, s.bottom], [s.x, -s.b, boot], [s.x, -s.b, s.top], [s.x, s.b, s.top], [s.x, s.b, boot], [s.x, s.b, s.bottom]];
  };
  const colors = [paint.lower, paint.upper, paint.deck, paint.upper, paint.lower, paint.lower];
  for (let i = 0; i + 1 < stations.length; i++) {
    const a = stations[i];
    const b = stations[i + 1];
    if (!a || !b) continue;
    const sa = section(a);
    const sb = section(b);
    const inside: V3 = [(a.x + b.x) / 2, 0, (Math.min(a.bottom, b.bottom) + Math.max(a.top, b.top)) / 2];
    for (let e = 0; e < 6; e++) {
      const p0 = sa[e];
      const p1 = sa[(e + 1) % 6];
      const q0 = sb[e];
      const q1 = sb[(e + 1) % 6];
      if (!p0 || !p1 || !q0 || !q1 || (same(p0, p1) && same(q0, q1))) continue;
      f.push(oriented([p0, p1, q1, q0], colors[e] ?? paint.upper, inside));
    }
  }
  const first = stations[0];
  const last = stations[stations.length - 1];
  if (first && first.b > 0.6) f.push(oriented(section(first), paint.upper, [first.x - 4, 0, (first.top + first.bottom) / 2]));
  if (last && last.b > 0.6) f.push(oriented(section(last), paint.upper, [last.x + 4, 0, (last.top + last.bottom) / 2]));
  return f;
}

/** A deckhouse from x0 to x1, `base` above the deck and `h` tall, following the deck's sheer. */
function house(s: readonly Station[], x0: number, x1: number, half: number, base: number, h: number, color: string): Face[] {
  const at = (x: number) => st(x, half, deckAt(s, x) + base + h, deckAt(s, x) + base - 0.3);
  return hull([at(x1), at(x0)], { lower: color, upper: color, deck: color, boot: -99 });
}

/** A round tube lofted through rings, bow first: a submarine's pressure hull, a hangar. */
interface Ring {
  readonly x: number;
  readonly ry: number;
  readonly rz: number;
  readonly zc: number;
}

function tube(rings: readonly Ring[], upper: string, lower: string, sides = 12): Face[] {
  const f: Face[] = [];
  const sec = (r: Ring): V3[] =>
    Array.from({ length: sides }, (_, i) => {
      const a = (i / sides) * Math.PI * 2;
      return [r.x, Math.cos(a) * r.ry, r.zc + Math.sin(a) * r.rz] as V3;
    });
  for (let i = 0; i + 1 < rings.length; i++) {
    const a = rings[i];
    const b = rings[i + 1];
    if (!a || !b) continue;
    const sa = sec(a);
    const sb = sec(b);
    const inside: V3 = [(a.x + b.x) / 2, 0, (a.zc + b.zc) / 2];
    for (let k = 0; k < sides; k++) {
      const p0 = sa[k];
      const p1 = sa[(k + 1) % sides];
      const q0 = sb[k];
      const q1 = sb[(k + 1) % sides];
      if (!p0 || !p1 || !q0 || !q1) continue;
      const below = Math.sin(((k + 0.5) / sides) * Math.PI * 2) < -0.2;
      f.push(oriented([p0, p1, q1, q0], below ? lower : upper, inside));
    }
  }
  const first = rings[0];
  const last = rings[rings.length - 1];
  if (first) f.push(oriented(sec(first), upper, [first.x - 2, 0, first.zc]));
  if (last) f.push(oriented(sec(last), upper, [last.x + 2, 0, last.zc]));
  return f;
}

/** The hull's outline at the waterline from a submarine's rings: how wide the round hull is at z = 0. */
function ringWater(rings: readonly Ring[]): Station[] {
  return rings.map((r) => {
    const u = r.zc / r.rz;
    return st(r.x, r.ry * Math.sqrt(Math.max(0, 1 - u * u)), r.zc + r.rz, r.zc - r.rz);
  });
}

function rotZ(faces: readonly Face[], angle: number): Face[] {
  const c = Math.cos(angle);
  const s = Math.sin(angle);
  const r = (q: V3): V3 => [q[0] * c - q[1] * s, q[0] * s + q[1] * c, q[2]];
  return faces.map((f) => (f.facing ? { ...f, points: f.points.map(r), facing: r(f.facing) } : { ...f, points: f.points.map(r) }));
}

const rotPoint = (q: V3, angle: number): V3 => [q[0] * Math.cos(angle) - q[1] * Math.sin(angle), q[0] * Math.sin(angle) + q[1] * Math.cos(angle), q[2]];

function scaled(faces: readonly Face[], k: number): Face[] {
  return faces.map((f) => ({ ...f, points: f.points.map((q) => [q[0] * k, q[1] * k, q[2] * k] as V3) }));
}

/** Superstructure, turrets and mounts: lighter than the hull, as the haze grey over a navy-blue hull. */
const sup = (t: TeamShades) => mix(t.mid, t.hi, 0.6);

const liftFor = (water: readonly Station[]) => -Math.round(Math.max(...water.map((s) => s.b)) * 0.4);

// ---- Fittings ----

interface TurretSpec {
  readonly back: number;
  readonly front: number;
  readonly half: number;
  readonly height: number;
  /** How far the top of the face plate sits back from its foot. */
  readonly slope: number;
  readonly guns: number;
  readonly spacing: number;
  readonly bore: number;
  readonly length: number;
  readonly gunZ: number;
  readonly color: string;
  /** Rangefinder hoods sticking out of the turret's rear sides. */
  readonly hoods?: boolean;
  /** Turned about its own center, in radians: π faces aft, negative swings it toward the viewer. */
  readonly train?: number;
  readonly elevation?: number;
  readonly recoil: number;
}

/**
 * Battleship main guns are raised to fire so every barrel looks 20° up on screen. The aft turret,
 * swung out toward the viewer, needs more raise to look the same as the forward two.
 */
const MAIN_ELEVATION = 0.41;
const AFT_ELEVATION = 0.54;

/** A gun turret with a sloped face plate and `guns` barrels, standing at (x, 0, z). */
function turret(x: number, z: number, s: TurretSpec): { faces: Face[]; muzzle: V3; aim: V3 } {
  const { back, front, half, height, slope } = s;
  const foot: Poly = [[-back, -half], [front - 3, -half], [front, -half + 2.5], [front, half - 2.5], [front - 3, half], [-back, half]];
  const top: Poly = [
    [-back + 1, -half + 0.8], [front - 3 - slope, -half + 0.8], [front - slope, -half + 2.8],
    [front - slope, half - 2.8], [front - 3 - slope, half - 0.8], [-back + 1, half - 0.8],
  ];
  let f: Face[] = loftZ(0, foot, height, top, s.color);
  if (s.hoods) {
    f.push(...box(-back + 1, -back + 5, -half - 1.4, -half, height - 2.6, height - 0.8, s.color));
    f.push(...box(-back + 1, -back + 5, half, half + 1.4, height - 2.6, height - 0.8, s.color));
  }
  const x0 = front - slope * 0.6 - 1 - s.recoil;
  let guns: Face[] = [];
  for (let g = 0; g < s.guns; g++) {
    const y = (g - (s.guns - 1) / 2) * s.spacing;
    guns.push(...barrel(x0, x0 + 2.5, y, s.gunZ, s.bore * 1.6, steelDark()));
    guns.push(...barrel(x0, x0 + s.length, y, s.gunZ, s.bore, gunMetal()));
  }
  let muzzle: V3 = [x0 + s.length, 0, s.gunZ];
  if (s.elevation) {
    guns = elevate(guns, front - slope, s.gunZ, s.elevation);
    muzzle = elevatePoint(muzzle, front - slope, s.gunZ, s.elevation);
  }
  f.push(...guns);
  // A point a little further out along the barrels, so the shot can leave the way they point.
  const e = s.elevation ?? 0;
  let aim: V3 = [muzzle[0] + Math.cos(e) * 10, muzzle[1], muzzle[2] + Math.sin(e) * 10];
  if (s.train) {
    f = rotZ(f, s.train);
    muzzle = rotPoint(muzzle, s.train);
    aim = rotPoint(aim, s.train);
  }
  return { faces: shift(f, x, 0, z), muzzle: [muzzle[0] + x, muzzle[1], muzzle[2] + z], aim: [aim[0] + x, aim[1], aim[2] + z] };
}

/** A round barbette a turret stands on. */
const barbette = (x: number, r: number, z0: number, z1: number, color: string) => loftZ(z0, circle(x, 0, r, 12), z1, circle(x, 0, r, 12), color);

/** A funnel, raked aft by `rake`, with a dark cap. */
function funnel(x: number, z: number, r: number, h: number, rake: number, color: string, cap: string, squash = 0.78): Face[] {
  return [
    ...loftZ(z, circle(x, 0, r, 12, squash), z + h, circle(x - rake, 0, r * 0.88, 12, squash), color),
    ...loftZ(z + h, circle(x - rake, 0, r * 0.88, 12, squash), z + h + 1.4, circle(x - rake * 1.07, 0, r * 0.84, 12, squash), cap),
  ];
}

/** A twin 5-inch or 12.7cm mount, enclosed, both barrels forward (or aft). */
function twinMount(x: number, y: number, z: number, color: string, aft = false, size = 1): Face[] {
  const k = size;
  const foot: Poly = [[-3 * k, -2.6 * k], [2 * k, -2.6 * k], [3.4 * k, -1.4 * k], [3.4 * k, 1.4 * k], [2 * k, 2.6 * k], [-3 * k, 2.6 * k]];
  const top: Poly = [[-2.6 * k, -2.2 * k], [1.4 * k, -2.2 * k], [2.4 * k, -1.2 * k], [2.4 * k, 1.2 * k], [1.4 * k, 2.2 * k], [-2.6 * k, 2.2 * k]];
  let f = loftZ(0, foot, 3.2 * k, top, color);
  for (const gy of [-0.9 * k, 0.9 * k]) f.push(...beam([3 * k, gy, 1.7 * k], [10 * k, gy, 1.9 * k], 0.8, 0.8, steelDark()));
  if (aft) f = rotZ(f, Math.PI);
  return shift(f, x, y, z);
}

/** A destroyer's single gun: a 5-inch in its enclosed gunhouse, or a 15cm behind an open-backed shield. */
function singleMount(x: number, z: number, color: string, recoil: number, aft: boolean, length = 11): { faces: Face[]; muzzle: V3 } {
  const foot: Poly = [[-4, -3], [2.5, -3], [4.6, -1.6], [4.6, 1.6], [2.5, 3], [-4, 3]];
  const top: Poly = [[-3.4, -2.5], [1.6, -2.5], [3.4, -1.2], [3.4, 1.2], [1.6, 2.5], [-3.4, 2.5]];
  let f = loftZ(0, foot, 4.4, top, color);
  f.push(...barrel(3.6 - recoil, 3.6 + length - recoil, 0, 2.2, 0.75, steelDark()));
  let muzzle: V3 = [3.6 + length - recoil, 0, 2.2];
  if (aft) {
    f = rotZ(f, Math.PI);
    muzzle = rotPoint(muzzle, Math.PI);
  }
  return { faces: shift(f, x, 0, z), muzzle: [muzzle[0] + x, muzzle[1], muzzle[2] + z] };
}

/** A light AA gun tub: 40mm Bofors or 25mm, `barrels` side by side, raised. */
function aaTub(x: number, y: number, z: number, color: string, barrels: number, r = 2.2): { faces: Face[]; muzzle: V3 } {
  const f = loftZ(0, circle(0, 0, r, 10), 1.4, circle(0, 0, r, 10), color);
  for (let i = 0; i < barrels; i++) {
    const gy = (i - (barrels - 1) / 2) * 0.8;
    f.push(...beam([0, gy, 1.6], [4.5, gy, 3.4], 0.5, 0.5, steelDark()));
  }
  return { faces: shift(f, x, y, z), muzzle: [x + 4.5, y, z + 3.4] };
}

/** A 20mm Oerlikon: pedestal, shield and barrel. */
function oerlikon(x: number, y: number, z: number, color: string): { faces: Face[]; muzzle: V3 } {
  return {
    faces: [
      ...beam([x, y, z], [x, y, z + 1.8], 0.6, 0.6, steelDark()),
      ...box(x + 0.4, x + 0.9, y - 1.1, y + 1.1, z + 1.3, z + 2.8, color),
      ...beam([x - 0.5, y, z + 2], [x + 4.5, y, z + 2.9], 0.45, 0.45, steelDark()),
    ],
    muzzle: [x + 4.5, y, z + 2.9],
  };
}

/** A torpedo mount of `n` tubes side by side, along the ship. */
function torpedoMount(x: number, z: number, n: number, length: number, color: string, shield = false): Face[] {
  const f: Face[] = [...loftZ(z, circle(x, 0, 2, 8), z + 1, circle(x, 0, 2, 8), steelDark())];
  for (let i = 0; i < n; i++) f.push(...barrel(x - length / 2, x + length / 2, (i - (n - 1) / 2) * 1.2, z + 1.8, 0.55, steel()));
  if (shield) f.push(...box(x - length / 2 - 0.5, x + 1, -(n * 0.6 + 0.6), n * 0.6 + 0.6, z + 1, z + 3.4, color));
  return f;
}

/** A floatplane on its catapult: fuselage, wing, float and tail. */
function floatplane(x: number, y: number, z: number, color: string): Face[] {
  return [
    ...beam([x - 3, y, z + 0.7], [x + 5, y, z + 0.7], 1.4, 1.1, color),
    ...box(x, x + 0.8, y - 0.2, y + 0.2, z + 1.2, z + 2.4, steelDark()),
    ...beam([x - 5, y, z + 3.1], [x + 5, y, z + 3.1], 1.8, 1.8, color),
    ...box(x - 5, x - 3.6, y - 0.2, y + 0.2, z + 3.6, z + 6.2, color),
    ...box(x - 0.5, x + 2.5, y - 7, y + 7, z + 4, z + 4.5, color),
    ...box(x + 5, x + 5.4, y - 1.6, y + 1.6, z + 1.8, z + 4.4, steelDark()),
  ];
}

/** Bridge windows: a row of dark panes on the near face of a deckhouse at y. */
function windows(y: number, x0: number, x1: number, z: number, h = 1, step = 2.2): Face[] {
  const f: Face[] = [];
  for (let x = x0; x + 1.2 <= x1; x += step) f.push(decalY(y - 0.05, [[x, z], [x + 1.3, z], [x + 1.3, z + h], [x, z + h]], ink()));
  return f;
}

/** Portholes along the near side of the hull. */
function portholes(s: readonly Station[], x0: number, x1: number, z: number, step: number, color: string): Face[] {
  const f: Face[] = [];
  for (let x = x0; x <= x1; x += step) {
    const y = -beamAt(s, x) - 0.1;
    f.push(decalY(y, [[x, z], [x + 0.9, z], [x + 0.9, z + 0.9], [x, z + 0.9]], color));
  }
  return f;
}

/** The anchor in its hawse pipe on the near bow. */
function anchor(s: readonly Station[], x: number, z: number): Face[] {
  const y = -beamAt(s, x) - 0.15;
  return [
    decalY(y, [[x, z], [x + 2.4, z], [x + 2.4, z + 1.2], [x, z + 1.2]], ink()),
    decalY(y - 0.02, [[x + 0.8, z - 2.4], [x + 1.6, z - 2.4], [x + 1.6, z + 0.4], [x + 0.8, z + 0.4]], steelDark()),
    decalY(y - 0.02, [[x - 0.2, z - 2.8], [x + 2.6, z - 2.8], [x + 2.2, z - 2.1], [x + 0.2, z - 2.1]], steelDark()),
  ];
}

/** Angular camouflage patches on the near side, as German ships wore in the Baltic and Norway. */
function splinter(y: number, x0: number, x1: number, z0: number, z1: number, t: TeamShades): Face[] {
  const dark = mix(t.lo, C("battleFieldGrey"), 0.45);
  const light = mix(t.hi, C("battleFieldGrey"), 0.4);
  const f: Face[] = [];
  let i = 0;
  for (let x = x0; x < x1 - 6; x += 9 + (i % 3) * 3) {
    const h = z1 - z0;
    const color = i % 2 === 0 ? dark : light;
    f.push(decalY(y, i % 2 === 0
      ? [[x, z0], [x + 9, z0], [x + 5, z0 + h], [x - 2, z0 + h]]
      : [[x + 2, z0], [x + 7, z0], [x + 10, z0 + h * 0.6], [x + 3, z0 + h]], color));
    i++;
  }
  return f;
}

// ---- Battleships ----

/** How each salvo's turret has recoiled: `firing` is the turret firing, `recoil` how far back its guns are. */
export interface Salvo {
  readonly firing: number;
  readonly recoil: number;
}

/**
 * Iowa class: a long, narrow hull with a sharp clipper bow and sheer forward, three triple 16-inch
 * turrets (two forward, the second superfiring, one aft), a tower bridge round an armored conning
 * tower with a main-battery director on top, two tall stacks with a mast between them, ten twin
 * 5-inch mounts along the superstructure, 40mm quads, and catapults with a Kingfisher on the fantail.
 * Painted in Measure 22: dark below the line of the lowest deck, lighter above.
 */
export function iowa(T: TeamShades, salvo: Salvo): ShipModel {
  const U = sup(T);
  const S = [
    st(93, 0.5, 18, 15), st(87, 3, 17, -4), st(74, 6.5, 15.5, -4), st(56, 10, 13.5, -4), st(34, 11.8, 12, -4), st(10, 12, 11.2, -4),
    st(-40, 12, 10.6, -4), st(-66, 10.8, 10.2, -4), st(-82, 8, 10, -4), st(-90, 5.5, 10, 0), st(-93, 3, 10, 4),
  ];
  const d = (x: number) => deckAt(S, x);
  const r = (i: number) => (salvo.firing === i ? salvo.recoil : 0);
  const spec = { back: 10, front: 8, half: 7.5, height: 6.5, slope: 3, guns: 3, spacing: 3.6, bore: 0.55, length: 25, gunZ: 3.2, color: U, hoods: true, elevation: MAIN_ELEVATION };
  const base: Face[] = [...hull(S, { lower: T.lo, upper: T.mid, deck: mix(C("battleWood"), C("battleSand"), 0.45), boot: 7 })];
  base.push(...portholes(S, -36, 30, 8.2, 6, T.deep), ...anchor(S, 79, 13));
  const houses: Face[] = [...house(S, -38, 27, 10.5, 0, 4, U), ...house(S, 2, 25, 5.5, 4, 4, U), ...house(S, -38, -27, 6, 4, 6, U)];
  const top: Face[] = [];
  const t1 = turret(58, d(58), { ...spec, recoil: r(0) });
  const z2 = d(36) + 5.5;
  top.push(...barbette(36, 7, d(36) - 0.5, z2, U));
  const t2 = turret(36, z2, { ...spec, recoil: r(1) });
  const z3 = d(-56) + 2;
  top.push(...barbette(-56, 7, d(-56) - 0.5, z3, U));
  const t3 = turret(-56, z3, { ...spec, recoil: r(2), train: -0.6, elevation: AFT_ELEVATION });
  top.push(...t1.faces, ...t2.faces, ...t3.faces);
  // Conning tower, the tower bridge, the Mk 38 director with its rangefinder arms, the foremast and radar.
  const b8 = d(14) + 8;
  top.push(...loftZ(b8, circle(22, 0, 4.2, 12, 0.95), b8 + 7, circle(22, 0, 4, 12, 0.95), U));
  top.push(...box(8, 19, -4.5, 4.5, b8, b8 + 9, U), ...windows(-4.5, 9, 18.5, b8 + 6.2));
  top.push(...box(9.5, 17.5, -3.6, 3.6, b8 + 9, b8 + 15, U), ...windows(-3.6, 10, 17, b8 + 12.6));
  const tt = b8 + 15;
  top.push(...box(10.5, 16.5, -2.6, 2.6, tt, tt + 3, U), ...box(12, 15, -6.5, 6.5, tt + 1, tt + 2.2, T.lo));
  top.push(...box(12.5, 15, -1.6, 1.6, tt + 3, tt + 4.6, steelDark()));
  top.push(...beam([12, 0, tt + 3], [12, 0, tt + 17], 0.9, 0.9, steelDark()), ...beam([12, -6, tt + 13], [12, 6, tt + 13], 0.6, 0.6, steelDark()));
  top.push(...box(13, 13.6, -4, 4, tt + 6, tt + 10.5, steel()));
  // Two stacks, the mainmast between them, the after superstructure and its director.
  top.push(...funnel(0, d(0) + 4, 5.5, 21, 2, U, steelDark()));
  top.push(...beam([-10, 0, d(-10) + 4], [-10, 0, d(-10) + 33], 0.8, 0.8, steelDark()), ...beam([-10, -5, d(-10) + 28], [-10, 5, d(-10) + 28], 0.6, 0.6, steelDark()));
  top.push(...funnel(-20, d(-20) + 4, 5.5, 18, 2, U, steelDark()));
  const ta = d(-32) + 10;
  top.push(...box(-35, -30, -2.6, 2.6, ta, ta + 3, U), ...box(-34, -31, -6, 6, ta + 1, ta + 2.2, T.lo));
  // Five twin 5-inch mounts a side, all trained forward, and the 40mm quads.
  for (const x of [20, 9, -2, -14, -26]) for (const y of [-8.2, 8.2]) top.push(...twinMount(x, y, d(x) + 4, U));
  const aa = aaTub(-36, -8.5, d(-36) + 4, T.lo, 4, 2.6);
  top.push(...aa.faces, ...aaTub(-36, 8.5, d(-36) + 4, T.lo, 4, 2.6).faces);
  top.push(...aaTub(31, 0, z2 + 6.5, T.lo, 4, 2.4).faces);
  for (const y of [-5, 5]) top.push(...aaTub(-74, y, d(-74), T.lo, 4, 2.4).faces);
  // Fantail: two catapults, a Kingfisher on the near one, the aircraft crane at the stern.
  const df = d(-80);
  top.push(...beam([-87, -7, df + 1], [-68, -10, df + 1], 1.4, 1, steelDark()), ...beam([-87, 7, df + 1], [-68, 10, df + 1], 1.4, 1, steelDark()));
  top.push(...floatplane(-77, -8.6, df + 1.6, mix(T.hi, C("battleSteel"), 0.4)));
  top.push(...beam([-90, 0, df], [-90, 0, df + 10], 1, 1, steelDark()), ...beam([-90, 0, df + 10], [-80, 0, df + 14], 0.7, 0.7, steelDark()));
  top.push(...beam([92, 0, 18], [92, 0, 23], 0.4, 0.4, steelDark()));
  return {
    layers: [base, houses, top],
    water: S,
    deck: S,
    at: { gun0: t1.muzzle, gun1: t2.muzzle, gun2: t3.muzzle, aim0: t1.aim, aim1: t2.aim, aim2: t3.aim, aa: aa.muzzle },
    troops: [],
    lift: liftFor(S),
  };
}

/**
 * Yamato: a broad hull with a deep flared bow and the deck stepping down to the quarterdeck, three
 * triple 46cm turrets, a 15.5cm triple turret superfiring over the second, the tall stepped tower
 * bridge with its 15m rangefinder, one big raked funnel, the tripod mainmast, twin 12.7cm mounts and
 * 25mm triples along the sides, and the aircraft deck with catapults and a crane at the stern.
 */
export function yamato(T: TeamShades, salvo: Salvo): ShipModel {
  const U = sup(T);
  const S = [
    st(93, 0.5, 19, 15), st(88, 3, 18, -4), st(74, 8, 15, -4), st(60, 12, 12.8, -4), st(40, 14, 11.8, -4), st(-20, 14.2, 11.6, -4),
    st(-52, 13, 11.4, -4), st(-56.5, 12.6, 11.3, -4), st(-57, 12.5, 8.6, -4), st(-82, 9, 8.6, -4), st(-90, 5.5, 8.6, 0), st(-93, 3, 8.6, 4),
  ];
  const d = (x: number) => deckAt(S, x);
  const r = (i: number) => (salvo.firing === i ? salvo.recoil : 0);
  const spec = { back: 12, front: 9, half: 9.5, height: 7.5, slope: 3.5, guns: 3, spacing: 4.4, bore: 0.65, length: 28, gunZ: 3.6, color: U, hoods: true, elevation: MAIN_ELEVATION };
  const base: Face[] = [...hull(S, { lower: T.deep, upper: T.mid, deck: mix(C("battleWood"), C("battleSand"), 0.4), boot: 1.5 })];
  base.push(...portholes(S, -50, 36, 8, 7, T.deep), ...anchor(S, 80, 13.5));
  const houses: Face[] = [...house(S, -42, 20, 11.5, 0, 4, U)];
  const top: Face[] = [];
  const t1 = turret(56, d(56), { ...spec, recoil: r(0) });
  const z2 = d(34) + 6.5;
  top.push(...barbette(34, 8, d(34) - 0.5, z2, U));
  const t2 = turret(34, z2, { ...spec, recoil: r(1) });
  const z3 = d(-50) + 2;
  top.push(...barbette(-50, 8, 8.2, z3, U));
  const t3 = turret(-50, z3, { ...spec, recoil: r(2), train: -0.6, elevation: AFT_ELEVATION });
  top.push(...t1.faces, ...t2.faces, ...t3.faces);
  // The tower: a broad base carrying the forward 15.5cm turret, then narrowing levels up to the
  // rangefinder and radar.
  const dt = d(6);
  houses.push(...box(-8, 20, -7.5, 7.5, dt + 4, dt + 13, U));
  const sec = { back: 6, front: 6, half: 5.5, height: 4.5, slope: 2, guns: 3, spacing: 2.4, bore: 0.45, length: 15, gunZ: 2.4, color: U };
  top.push(...turret(15, dt + 13, { ...sec, recoil: 0 }).faces);
  top.push(...box(-5, 9, -6, 6, dt + 13, dt + 20, U), ...box(-3.5, 7, -5, 5, dt + 20, dt + 27, U));
  top.push(...box(-2.5, 6, -4, 4, dt + 27, dt + 33, U), ...windows(-4, -2, 5.6, dt + 30.5));
  top.push(...box(-1.5, 5, -3.4, 3.4, dt + 33, dt + 37, U), ...windows(-3.4, -1, 4.6, dt + 35));
  top.push(...box(0.5, 3, -9.5, 9.5, dt + 37, dt + 39, T.lo), ...box(-1, 4, -2.2, 2.2, dt + 39, dt + 41.5, steelDark()));
  top.push(...beam([1.5, 0, dt + 41.5], [1.5, 0, dt + 50], 0.7, 0.7, steelDark()));
  // The funnel, raked well aft, and the tripod mainmast behind it.
  top.push(...funnel(-14, d(-14) + 4, 7.5, 20, 7, U, steelDark(), 0.72));
  const dm = d(-30) + 4;
  top.push(...beam([-30, 0, dm], [-27, 0, dm + 26], 0.9, 0.9, steelDark()));
  for (const y of [-3, 3]) top.push(...beam([-34, y, dm], [-27.5, 0, dm + 22], 0.6, 0.6, steelDark()));
  top.push(...beam([-27.5, -6, dm + 23], [-27.5, 6, dm + 23], 0.6, 0.6, steelDark()));
  // The after 15.5cm turret superfiring over the third, facing aft.
  const za = d(-38) + 9;
  top.push(...barbette(-38, 5, d(-38) + 3.5, za, U));
  top.push(...turret(-38, za, { ...sec, recoil: 0, train: Math.PI }).faces);
  // Twin 12.7cm mounts and 25mm triples along both sides.
  for (const x of [6, -5, -17]) for (const y of [-9.4, 9.4]) top.push(...twinMount(x, y, d(x) + 4, U, false, 1.1));
  const aa = aaTub(-28, -9, d(-28) + 4, T.lo, 3);
  top.push(...aa.faces, ...aaTub(-28, 9, d(-28) + 4, T.lo, 3).faces);
  for (const [x, y] of [[-66, -6], [-66, 6], [-76, -5], [-76, 5], [70, -4], [70, 4]] as const) top.push(...aaTub(x, y, d(x), T.lo, 3, 1.8).faces);
  // The aircraft deck: catapults, a floatplane and the crane.
  top.push(...beam([-90, -7, 9.6], [-73, -10, 9.6], 1.4, 1, steelDark()), ...beam([-90, 7, 9.6], [-73, 10, 9.6], 1.4, 1, steelDark()));
  top.push(...floatplane(-81, -8.6, 10.2, mix(T.hi, C("battleSteel"), 0.4)));
  top.push(...beam([-88, 0, 8.6], [-88, 0, 19], 1, 1, steelDark()), ...beam([-88, 0, 19], [-75, 0, 23], 0.7, 0.7, steelDark()));
  top.push(...beam([92, 0, 19], [92, 0, 24], 0.4, 0.4, steelDark()));
  return {
    layers: [base, houses, top],
    water: S,
    deck: S,
    at: { gun0: t1.muzzle, gun1: t2.muzzle, gun2: t3.muzzle, aim0: t1.aim, aim1: t2.aim, aim2: t3.aim, aa: aa.muzzle },
    troops: [],
    lift: liftFor(S),
  };
}

// ---- Destroyers ----

/** `firing`: which forward gun is firing (0 or 1), `recoil` how far back it is. */
export type GunState = Salvo;

/**
 * Fletcher: a flush deck, two raked stacks, five single 5-inch gunhouses (two forward, three aft),
 * the Mk 37 director on top of the bridge, a pole foremast with radar, two quintuple torpedo mounts,
 * 40mm twins, and depth-charge racks at the stern. Measure 22.
 */
export function fletcher(T: TeamShades, gun: GunState): ShipModel {
  const U = sup(T);
  const S = [st(76, 0.5, 13, 10), st(71, 2.5, 12, -3), st(58, 5.5, 10.5, -3), st(36, 7.5, 9.2, -3), st(0, 7.6, 8.6, -3), st(-52, 7.4, 8.2, -3), st(-68, 6, 8, -3), st(-74, 4.5, 8, 0), st(-76, 3, 8, 3)];
  const d = (x: number) => deckAt(S, x);
  const r = (i: number) => (gun.firing === i ? gun.recoil : 0);
  const base: Face[] = [...hull(S, { lower: T.lo, upper: T.mid, deck: shade(T.lo, 0.92), boot: 5 })];
  base.push(...portholes(S, 30, 62, 7, 4, T.deep), ...anchor(S, 64, 9.4));
  const houses: Face[] = [
    ...house(S, 14, 46, 5.2, 0, 4, U), ...house(S, 17, 33, 5, 4, 5, U), ...house(S, 19, 31, 4.6, 9, 2, U),
    ...house(S, -25, 13, 4.6, 0, 3.6, U), ...house(S, -41, -31, 4.8, 0, 6, U), ...house(S, -54, -46, 4.5, 0, 2.5, U),
  ];
  houses.push(...windows(-5, 19, 32, d(25) + 6.6, 1.2));
  const top: Face[] = [];
  const m1 = singleMount(52, d(52), U, r(0), false);
  const m2 = singleMount(40, d(40) + 4, U, r(1), false);
  top.push(...m1.faces, ...m2.faces);
  top.push(...singleMount(-36, d(-36) + 6, U, 0, true).faces, ...singleMount(-50, d(-50) + 2.5, U, 0, true).faces, ...singleMount(-64, d(-64), U, 0, true).faces);
  // Mk 37 director, its rangefinder and radar; the foremast with the air-search radar.
  const zd = d(25) + 11;
  top.push(...loftZ(zd, [[22, -3], [28.5, -3], [28.5, 3], [22, 3]], zd + 3.4, [[22.4, -2.6], [28, -2.6], [28, 2.6], [22.4, 2.6]], U));
  top.push(...box(24, 26, -6, 6, zd + 1.2, zd + 2.4, T.lo), ...box(24, 26.6, -2, 2, zd + 3.4, zd + 5.2, steelDark()));
  top.push(...beam([15, 0, d(15) + 9], [13, 0, d(13) + 30], 0.8, 0.8, steelDark()), ...beam([13.3, -5.5, d(13) + 25], [13.3, 5.5, d(13) + 25], 0.5, 0.5, steelDark()));
  top.push(...box(14, 14.6, -3, 3, d(13) + 26, d(13) + 29.5, steel()));
  // Two raked stacks with their black caps, torpedo mounts between and abaft them.
  top.push(...funnel(6, d(6) + 3.6, 3.8, 15, 2.4, U, ink(), 0.82), ...funnel(-15, d(-15) + 3.6, 3.8, 14, 2.4, U, ink(), 0.82));
  top.push(...torpedoMount(-4.5, d(-4.5) + 3.6, 5, 8, U), ...torpedoMount(-27, d(-27), 5, 9, U));
  const aa = aaTub(-22, 0, d(-22) + 3.6, T.lo, 2);
  top.push(...aa.faces);
  for (const y of [-5.6, 5.6]) top.push(...oerlikon(30, y, d(30), T.lo).faces);
  // Depth-charge racks at the stern, K-guns either side.
  for (const y of [-3.6, 3.6]) top.push(...box(-76, -68, y - 0.8, y + 0.8, d(-72), d(-72) + 1.8, steelDark()));
  for (const y of [-6, 6]) top.push(...beam([-58, y, d(-58)], [-58.5, y * 1.1, d(-58) + 2], 0.8, 0.8, steelDark()));
  return {
    layers: [base, houses, top],
    water: S,
    deck: S,
    at: { gun0: m1.muzzle, gun1: m2.muzzle, aa: aa.muzzle, charges: [-74, 0, d(-74) + 2] },
    troops: [],
    lift: liftFor(S),
  };
}

/**
 * Zerstörer 1936A: a high flared "Atlantic" bow, a twin 15cm turret forward and single 15cm guns
 * aft behind open-backed shields, a tripod foremast, two capped funnels, two quadruple torpedo
 * mounts, mine rails on the quarterdeck, and splinter camouflage.
 */
export function zerstorer(T: TeamShades, gun: GunState): ShipModel {
  const U = sup(T);
  const S = [st(77, 0.5, 15, 12), st(71, 3, 13.5, -3), st(57, 6, 11, -3), st(36, 7.5, 9.4, -3), st(-50, 7.5, 8.4, -3), st(-68, 6, 8.2, -3), st(-75, 4, 8.2, 1), st(-77, 2.5, 8.2, 4)];
  const d = (x: number) => deckAt(S, x);
  const base: Face[] = [...hull(S, { lower: shade(T.mid, 0.82), upper: T.mid, deck: mix(T.lo, C("battleWood"), 0.25), boot: 1.5 })];
  base.push(...splinter(-7.56, -48, 34, 1.5, 8.2, T), ...anchor(S, 64, 10.6));
  const houses: Face[] = [...house(S, 20, 35, 5.4, 0, 5, U), ...house(S, 22, 33, 4.8, 5, 4.5, U), ...house(S, -20, 14, 4.6, 0, 3.2, U), ...house(S, -46, -33, 4.6, 0, 5, U)];
  houses.push(...windows(-4.8, 23, 32.5, d(28) + 7.6, 1.2));
  const top: Face[] = [];
  const twin = turret(50, d(50), { back: 6.5, front: 6, half: 5, height: 5, slope: 2, guns: 2, spacing: 2.8, bore: 0.55, length: 15, gunZ: 2.4, color: U, recoil: gun.recoil, elevation: 0.05 });
  top.push(...twin.faces);
  top.push(...singleMount(-39.5, d(-39.5) + 5, U, 0, true, 13).faces, ...singleMount(-56, d(-56), U, 0, true, 13).faces);
  // Rangefinder on the bridge, radar mattress, tripod foremast.
  const zb = d(28) + 9.5;
  top.push(...loftZ(zb, circle(28, 0, 2.2, 10), zb + 2, circle(28, 0, 2, 10), U), ...box(27, 29, -5.5, 5.5, zb + 0.6, zb + 1.6, T.lo));
  top.push(...box(31.5, 32.1, -3, 3, zb + 1.5, zb + 5.5, steel()));
  top.push(...beam([19, 0, d(19) + 5], [19, 0, d(19) + 33], 0.8, 0.8, steelDark()));
  for (const y of [-2.6, 2.6]) top.push(...beam([22, y, zb], [19.2, 0, d(19) + 28], 0.5, 0.5, steelDark()));
  top.push(...beam([19, -5, d(19) + 29], [19, 5, d(19) + 29], 0.5, 0.5, steelDark()));
  // Funnels with their raked caps, torpedo mounts, searchlight, light flak.
  top.push(...funnel(7, d(7) + 3.2, 4.2, 15, 2.6, U, steelDark(), 0.8), ...funnel(-14, d(-14) + 3.2, 4.2, 14, 2.6, U, steelDark(), 0.8));
  top.push(...torpedoMount(-3.5, d(-3.5) + 3.2, 4, 9, U), ...torpedoMount(-27, d(-27), 4, 9, U));
  top.push(...loftZ(d(-22) + 3.2, circle(-22, 0, 1.4, 8), d(-22) + 6, circle(-22, 0, 1.4, 8), steelDark()));
  const aa = aaTub(-30, 0, d(-30), T.lo, 2);
  top.push(...aa.faces);
  for (const y of [-5, 5]) top.push(...oerlikon(30, y, d(30) + 5, T.lo).faces);
  for (const y of [-3.5, 3.5]) top.push(...beam([-76, y, d(-70) + 0.3], [-46, y, d(-46) + 0.3], 0.5, 0.4, steelDark()));
  return {
    layers: [base, houses, top],
    water: S,
    deck: S,
    at: { gun0: [twin.muzzle[0], -1.3, twin.muzzle[2]], gun1: [twin.muzzle[0], 1.3, twin.muzzle[2]], aa: aa.muzzle, charges: [-75, 0, d(-75) + 2] },
    troops: [],
    lift: liftFor(S),
  };
}

/**
 * Kagero: a raised forecastle, an enclosed twin 12.7cm turret forward and two aft, a tall layered
 * bridge with its rangefinder, a tripod foremast, two strongly raked funnels, two shielded quadruple
 * torpedo mounts, 25mm guns, and depth charges at the stern.
 */
export function kagero(T: TeamShades, gun: GunState): ShipModel {
  const U = sup(T);
  const S = [
    st(77, 0.5, 14, 11), st(71, 3, 13, -3), st(57, 6, 11.6, -3), st(30, 7.5, 10.6, -3), st(23.5, 7.6, 10.5, -3), st(23, 7.6, 8.2, -3),
    st(-52, 7.4, 8, -3), st(-68, 6, 8, -3), st(-75, 4, 8, 1), st(-77, 2.5, 8, 4),
  ];
  const d = (x: number) => deckAt(S, x);
  const base: Face[] = [...hull(S, { lower: T.deep, upper: T.mid, deck: mix(C("battleWood"), T.lo, 0.5), boot: 1.5 })];
  base.push(...portholes(S, 26, 56, 8.4, 4, T.deep), ...anchor(S, 64, 10.4));
  const houses: Face[] = [...house(S, 27, 40, 5.2, 0, 5, U), ...house(S, 28, 38, 4.6, 5, 5, U), ...house(S, 29, 37, 4, 10, 3.5, U), ...house(S, -48, -36, 4.6, 0, 4, U)];
  houses.push(...windows(-4, 29.5, 36.5, d(33) + 11.5, 1.2, 1.9));
  const spec = { back: 6, front: 5.5, half: 4.8, height: 5.4, slope: 1.5, guns: 2, spacing: 2.8, bore: 0.55, length: 14, gunZ: 2.6, color: U };
  const top: Face[] = [];
  const twin = turret(50, d(50), { ...spec, recoil: gun.recoil, elevation: 0.05 });
  top.push(...twin.faces, ...turret(-42, d(-42) + 4, { ...spec, recoil: 0, train: Math.PI }).faces, ...turret(-57, d(-57), { ...spec, recoil: 0, train: Math.PI }).faces);
  const zr = d(33) + 13.5;
  top.push(...box(31, 34, -6, 6, zr, zr + 1.3, T.lo));
  // Tripod foremast, raked funnels, shielded torpedo mounts, mainmast.
  top.push(...beam([25, 0, d(25)], [22, 0, d(25) + 30], 0.8, 0.8, steelDark()));
  for (const y of [-3, 3]) top.push(...beam([21, y, 8.2], [22.4, 0, d(25) + 22], 0.5, 0.5, steelDark()));
  top.push(...beam([22.3, -5, d(25) + 26], [22.3, 5, d(25) + 26], 0.5, 0.5, steelDark()), ...box(22.8, 23.4, -2.6, 2.6, d(25) + 18, d(25) + 21, steel()));
  top.push(...funnel(11, d(11), 4.6, 15, 4, U, steelDark(), 0.8), ...funnel(-12, d(-12), 3.8, 13, 3.4, U, steelDark(), 0.8));
  top.push(...torpedoMount(0, d(0), 4, 10, U, true), ...torpedoMount(-27, d(-27), 4, 10, U, true));
  top.push(...beam([-19, 0, d(-19)], [-20, 0, d(-19) + 22], 0.7, 0.7, steelDark()));
  const aa = aaTub(-5, 0, d(-5) + 4, T.lo, 2, 1.8);
  top.push(...box(-8, -2, -2.6, 2.6, d(-5), d(-5) + 4, U), ...aa.faces);
  for (const y of [-3.6, 3.6]) top.push(...box(-76, -68, y - 0.8, y + 0.8, d(-72), d(-72) + 1.8, steelDark()));
  return {
    layers: [base, houses, top],
    water: S,
    deck: S,
    at: { gun0: [twin.muzzle[0], -1.3, twin.muzzle[2]], gun1: [twin.muzzle[0], 1.3, twin.muzzle[2]], aa: aa.muzzle, charges: [-75, 0, d(-75) + 2] },
    troops: [],
    lift: liftFor(S),
  };
}

// ---- Submarines ----

/**
 * Gato: a long fleet boat, its round pressure hull mostly under water, a flat deck casing with the
 * limber holes along its side, the conning-tower fairwater with periscope shears, SJ radar and 20mm
 * platforms, a deck gun forward, and bow planes rigged out.
 */
export function gato(T: TeamShades): ShipModel {
  const U = sup(T);
  const R: Ring[] = [
    { x: 70, ry: 0.8, rz: 1.5, zc: 1.5 }, { x: 64, ry: 3, rz: 3.6, zc: 0 }, { x: 52, ry: 5.4, rz: 5.2, zc: -1.6 }, { x: 30, ry: 6.4, rz: 5.8, zc: -2 },
    { x: -30, ry: 6.4, rz: 5.8, zc: -2 }, { x: -52, ry: 5, rz: 4.8, zc: -1.8 }, { x: -64, ry: 2.6, rz: 2.8, zc: -1.4 }, { x: -70, ry: 0.8, rz: 1.2, zc: -1.2 },
  ];
  const casing = [st(69, 0.6, 5.6, 1), st(62, 3, 4.8, 0), st(46, 4.5, 4.2, 0), st(-48, 4.5, 4.2, 0), st(-62, 2.6, 3.8, 0), st(-68, 0.6, 3.6, 1)];
  const pressure = [...tube(R, T.mid, T.lo)];
  pressure.push(...box(57, 60, -7.5, 7.5, 1.6, 2.1, T.lo), ...box(-68, -64, -6, 6, -1.6, -1.1, T.lo), ...box(-71, -67, -0.3, 0.3, -5, -0.5, T.lo));
  const deck: Face[] = [...hull(casing, { lower: T.mid, upper: T.mid, deck: mix(T.lo, C("battleWood"), 0.3), boot: -9 })];
  for (let x = -44; x <= 44; x += 2.4) deck.push(decalY(-4.56, [[x, 2.5], [x + 1.2, 2.5], [x + 1.2, 3.3], [x, 3.3]], T.deep));
  const top: Face[] = [];
  top.push(...loftZ(4.2, [[0, -3], [16, -3], [21, -1], [21, 1], [16, 3], [0, 3]], 12.5, [[1, -2.6], [15.5, -2.6], [19, -0.8], [19, 0.8], [15.5, 2.6], [1, 2.6]], U));
  top.push(...windows(-2.6, 13, 18, 11.2, 0.6, 1.6));
  top.push(...box(8, 11.5, -1.4, 1.4, 12.5, 18, U), ...beam([9, 0, 18], [9, 0, 25], 0.6, 0.6, steelDark()), ...beam([10.6, 0, 18], [10.6, 0, 22.5], 0.6, 0.6, steelDark()));
  top.push(...beam([5, 0, 12.5], [5, 0, 20], 0.5, 0.5, steelDark()), ...box(4.4, 6, -1.4, 1.4, 20, 20.8, steelDark()));
  top.push(...box(-6, 0, -2.4, 2.4, 4.2, 9.5, U), ...oerlikon(-3.6, 0, 9.5, T.lo).faces);
  top.push(...box(21, 25, -2.2, 2.2, 4.2, 9.5, U), ...oerlikon(22.6, 0, 9.5, T.lo).faces);
  top.push(...loftZ(4.2, circle(32, 0, 1.4, 8), 6, circle(32, 0, 1.2, 8), steelDark()), ...box(30.6, 34, -1, 1, 5.6, 7.2, steelDark()), ...barrel(32, 44, 0, 6.6, 0.6, steelDark()));
  const water = ringWater(R);
  return { layers: [pressure, deck, top], water, deck: null, at: { torpedo: [70, 0, -1] }, troops: [], lift: liftFor(water) };
}

/**
 * Type VII: a shorter boat with saddle tanks bulging amidships, a narrow deck, the conning tower with
 * its "winter garden" flak platform aft, an 88mm deck gun forward, and the net cutter and jumping
 * wire at the bow.
 */
export function typeVII(T: TeamShades): ShipModel {
  const U = sup(T);
  const R: Ring[] = [
    { x: 58, ry: 0.8, rz: 1.4, zc: 1.2 }, { x: 52, ry: 2.6, rz: 3.4, zc: -0.4 }, { x: 38, ry: 4.2, rz: 4.8, zc: -1.6 }, { x: 22, ry: 6.6, rz: 5, zc: -2 },
    { x: -14, ry: 6.6, rz: 5, zc: -2 }, { x: -34, ry: 4.4, rz: 4.4, zc: -1.8 }, { x: -50, ry: 2.4, rz: 2.6, zc: -1.2 }, { x: -58, ry: 0.8, rz: 1, zc: -1 },
  ];
  const casing = [st(57, 0.6, 4.6, 1), st(50, 2, 3.6, 0), st(36, 2.4, 3.2, 0), st(-40, 2.4, 3.2, 0), st(-52, 1.6, 3, 0), st(-57, 0.5, 2.8, 1)];
  const pressure = [...tube(R, T.mid, shade(T.mid, 0.8))];
  pressure.push(...box(46, 49, -6, 6, 0.6, 1, T.lo), ...box(-57, -54, -5, 5, -1.4, -1, T.lo), ...box(-59, -56, -0.3, 0.3, -4.4, -0.4, T.lo));
  const deck: Face[] = [...hull(casing, { lower: T.mid, upper: T.mid, deck: mix(T.lo, C("battleWood"), 0.3), boot: -9 })];
  const top: Face[] = [];
  top.push(...loftZ(3.2, [[-1, -2.4], [11, -2.6], [15, -1.2], [15.5, 0], [15, 1.2], [11, 2.6], [-1, 2.4]], 10.5, [[0, -2.1], [10.5, -2.3], [14, -1], [14.4, 0], [14, 1], [10.5, 2.3], [0, 2.1]], U));
  top.push(...box(-7, -1, -2.6, 2.6, 3.2, 8.5, U), ...oerlikon(-4.5, 0, 8.5, T.lo).faces);
  for (const y of [-2.6, 2.6]) top.push(...beam([-7, y, 9.8], [-1, y, 9.8], 0.3, 0.3, steelDark()));
  top.push(...beam([9, 0, 10.5], [9, 0, 17], 0.6, 0.6, steelDark()), ...beam([7, 0, 10.5], [7, 0, 15], 0.6, 0.6, steelDark()));
  top.push(...beam([56, 0, 5.2], [14, 0, 11.5], 0.3, 0.3, steelDark()), ...beam([-1, 0, 10], [-56, 0, 3.8], 0.3, 0.3, steelDark()));
  top.push(...box(55, 58, -0.3, 0.3, 3.6, 6, steelDark()));
  top.push(...loftZ(3.2, circle(22, 0, 1.2, 8), 5, circle(22, 0, 1, 8), steelDark()), ...box(20.5, 24, -1, 1, 4.6, 6.4, steelDark()), ...barrel(22, 34, 0, 5.6, 0.6, steelDark()));
  const water = ringWater(R);
  return { layers: [pressure, deck, top], water, deck: null, at: { torpedo: [58, 0, -1] }, troops: [], lift: liftFor(water) };
}

/**
 * B1-type I-boat: a big ocean-going boat with a raised bow casing, the watertight aircraft hangar
 * forward of the conning tower and the catapult running to the bow, a 14cm deck gun aft and 25mm
 * guns on the tower.
 */
export function iBoat(T: TeamShades): ShipModel {
  const U = sup(T);
  const R: Ring[] = [
    { x: 75, ry: 0.8, rz: 1.5, zc: 1.6 }, { x: 68, ry: 3, rz: 3.4, zc: 0 }, { x: 54, ry: 5.4, rz: 5, zc: -1.6 }, { x: 30, ry: 6.6, rz: 5.8, zc: -2 },
    { x: -30, ry: 6.6, rz: 5.8, zc: -2 }, { x: -54, ry: 5, rz: 4.6, zc: -1.8 }, { x: -68, ry: 2.4, rz: 2.6, zc: -1.2 }, { x: -75, ry: 0.8, rz: 1, zc: -1 },
  ];
  const casing = [st(74, 0.6, 6.2, 1), st(66, 2.8, 5, 0), st(52, 3.8, 4.2, 0), st(-50, 3.8, 4.2, 0), st(-64, 2.4, 3.8, 0), st(-73, 0.6, 3.6, 1)];
  const pressure = [...tube(R, T.mid, T.deep)];
  pressure.push(...box(60, 63, -7, 7, 1.6, 2.1, T.lo), ...box(-73, -69, -5.6, 5.6, -1.4, -1, T.lo), ...box(-76, -72, -0.3, 0.3, -4.6, -0.4, T.lo));
  const deck: Face[] = [...hull(casing, { lower: T.mid, upper: T.mid, deck: mix(T.lo, C("battleWood"), 0.35), boot: -9 })];
  const top: Face[] = [];
  top.push(...tube([{ x: 33, ry: 2.4, rz: 2.4, zc: 7 }, { x: 32.4, ry: 3, rz: 3, zc: 7 }, { x: 13, ry: 3, rz: 3, zc: 7 }, { x: 12.6, ry: 2.6, rz: 2.6, zc: 7 }], U, T.lo));
  top.push(decalX(33.1, [[-1.6, 5.8], [1.6, 5.8], [1.6, 8.6], [-1.6, 8.6]], shade(U, 0.75)));
  top.push(...beam([34, 0, 4.7], [68, 0, 6], 1.6, 0.8, steelDark()));
  top.push(...loftZ(4.2, [[-6, -2.8], [8, -2.8], [13, -1], [13, 1], [8, 2.8], [-6, 2.8]], 12, [[-5, -2.4], [7.5, -2.4], [11.4, -0.8], [11.4, 0.8], [7.5, 2.4], [-5, 2.4]], U));
  top.push(...windows(-2.4, 6, 11, 10.8, 0.6, 1.6));
  top.push(...beam([4, 0, 12], [4, 0, 19], 0.6, 0.6, steelDark()), ...beam([2, 0, 12], [2, 0, 17], 0.6, 0.6, steelDark()));
  top.push(...aaTub(-3, 0, 12, T.lo, 2, 1.6).faces);
  top.push(...loftZ(4.2, circle(-22, 0, 1.4, 8), 6, circle(-22, 0, 1.2, 8), steelDark()), ...box(-21.6, -21, -1.6, 1.6, 5.4, 8.2, T.lo), ...barrel(-22, -11, 0, 6.6, 0.65, steelDark()));
  const water = ringWater(R);
  return { layers: [pressure, deck, top], water, deck: null, at: { torpedo: [75, 0, -1] }, troops: [], lift: liftFor(water) };
}

// ---- Landing craft ----

/** Tanks riding in a landing craft: a lighter shade of the team color, so they stand out from the hull. */
const cargo = (t: TeamShades, u: string): TeamShades => ({ ...t, hi: shade(u, 1.2), mid: u, lo: t.mid, deep: t.lo });

/** The bow ramp, `length` long, hinged at (x, z): raised upright, or lowered onto a beach. */
function ramp(x: number, z: number, half: number, length: number, down: boolean, color: string): Face[] {
  const plate = box(x, x + length, -half, half, z - 0.5, z + 0.5, color);
  for (let k = 2; k < length; k += 3) plate.push(...box(x + k, x + k + 0.6, -half + 0.6, half - 0.6, z + 0.5, z + 0.9, shade(color, 0.85)));
  return elevate(plate, x, z, down ? -0.5 : 1.45);
}

/**
 * LCT: a flat box of a hull with high side walls round an open well deck, the bow ramp, the
 * wheelhouse and twin 20mm aft. It carries two of its side's medium tanks (Shermans, or Panzer IVs
 * on the German craft) and their crews.
 */
export function lct(T: TeamShades, kit: "us" | "de", beached: boolean): ShipModel {
  const U = sup(T);
  const S = [st(56, 12, 2.4, -3), st(-52, 12, 2.4, -3), st(-56, 11, 2.4, 0)];
  const back: Face[] = [...hull(S, { lower: T.lo, upper: T.mid, deck: shade(T.lo, 0.9), boot: 0.5 })];
  back.push(...box(-40, 52, 10.6, 12, 2.4, 8.5, T.mid), ...box(-55.5, -40, -12, 12, 2.4, 9, T.mid));
  const tanks: Face[] = [];
  const make = TANK_MODELS.medium[kit];
  for (const x of [22, -10]) tanks.push(...shift(scaled(make(cargo(T, U), 0).faces, 0.3), x, 0, 2.4));
  const front: Face[] = [...box(-40, 52, -12, -10.6, 2.4, 8.5, T.mid)];
  for (let x = -36; x < 50; x += 8) front.push(decalY(-12.05, [[x, 3], [x + 0.8, 3], [x + 0.8, 8], [x, 8]], shade(T.mid, 0.82)));
  front.push(...ramp(52.5, 2.9, 10.6, 12, beached, T.lo));
  front.push(...box(-53, -43, -6, 6, 9, 16, U), ...windows(-6, -52, -44, 13.6, 1));
  front.push(...beam([-48, 0, 16], [-48, 0, 28], 0.6, 0.6, steelDark()), ...beam([-48, -4, 25], [-48, 4, 25], 0.4, 0.4, steelDark()));
  for (const y of [-8.5, 8.5]) front.push(...aaTub(-42, y, 9, T.lo, 2, 1.8).faces);
  return {
    layers: [back, tanks, front],
    water: S,
    deck: null,
    at: {},
    troops: [[40, -9, 8.6], [34, -9, 8.6], [4, -9, 8.6], [-26, -9, 8.6], [-32, -9, 8.6]],
    lift: liftFor(S) - (beached ? 2 : 0),
  };
}

/**
 * Daihatsu: a smaller craft with a bow ramp, a raised stern with the engine house and an exhaust
 * stack, carrying a Ha-Go and its infantry.
 */
export function daihatsu(T: TeamShades, beached: boolean): ShipModel {
  const U = sup(T);
  const S = [st(46, 8, 4, -2.6), st(-34, 9, 4, -2.6), st(-36, 9, 6.5, -2.6), st(-44, 8, 6.8, -2), st(-47, 6.5, 6.8, 1)];
  const back: Face[] = [...hull(S, { lower: T.lo, upper: T.mid, deck: mix(C("battleWood"), T.lo, 0.4), boot: 0.5 })];
  back.push(...box(-34, 44, 8, 9, 4, 8.5, T.mid));
  const tanks: Face[] = [...shift(scaled(TANK_MODELS.light.jp(cargo(T, U), 0).faces, 0.32), 12, 0, 4)];
  const front: Face[] = [...box(-34, 44, -9, -8, 4, 8.5, T.mid), ...ramp(44.5, 4.5, 8, 11, beached, T.lo)];
  front.push(...box(-44, -32, -6, 6, 6.6, 10.5, U), ...windows(-6, -42, -34, 8.6, 0.8));
  front.push(...beam([-38, 3, 10.5], [-38, 3, 15], 1, 1, steelDark()), ...beam([-46, 0, 6.8], [-46, 0, 11], 0.4, 0.4, steelDark()));
  return {
    layers: [back, tanks, front],
    water: S,
    deck: null,
    at: {},
    troops: [[-6, -7, 8.6], [-12, -7, 8.6], [-18, -7, 8.6], [-24, -7, 8.6], [36, -7, 8.6]],
    lift: liftFor(S) - (beached ? 2 : 0),
  };
}

// ---- Torpedo boats ----

/** How far the ready torpedo has slid out of its tube, and whether it has gone. */
export interface Launch {
  readonly slide: number;
  readonly launched: boolean;
}

/**
 * Elco PT boat: a planing hull riding bow-high, the day cabin and cockpit with a radar dome on its
 * mast, twin .50 turrets either side of the cockpit, four torpedo tubes along the deck edges, a 20mm
 * on the stern and the smoke generator.
 */
export function ptBoat(T: TeamShades, launch: Launch, shake: number): ShipModel {
  const U = sup(T);
  const S = [st(52, 0.5, 14, 9), st(46, 2.8, 13, -2), st(32, 5.6, 11.4, -2), st(10, 7, 10, -2), st(-48, 6.8, 9, -2), st(-52, 6, 9, 0)];
  const d = (x: number) => deckAt(S, x);
  const base: Face[] = [...hull(S, { lower: T.lo, upper: T.mid, deck: mix(T.lo, C("battleWood"), 0.35), boot: 3.5 })];
  const houses: Face[] = [...house(S, 12, 27, 3.4, 0, 3.6, U), ...house(S, 2, 14, 3.9, 0, 5, U)];
  houses.push(...windows(-3.4, 14, 26, d(20) + 1.4, 1.2, 2.6), decalX(14.05, [[-3, d(14) + 3.2], [3, d(14) + 3.2], [3, d(14) + 4.6], [-3, d(14) + 4.6]], C("battleSkyLow")));
  const top: Face[] = [];
  top.push(...beam([8, 0, d(8) + 5], [8, 0, d(8) + 14], 0.7, 0.7, steelDark()), ...loftZ(d(8) + 14, circle(8, 0, 1.8, 8), d(8) + 16.4, circle(8, 0, 1.5, 8), steel()));
  let mg: V3 = [0, 0, 0];
  for (const y of [-4.6, 4.6]) {
    top.push(...loftZ(d(2), circle(-1, y, 2.1, 10), d(2) + 3.4, circle(-1, y, 2.1, 10), T.lo));
    for (const gy of [-0.7, 0.7]) top.push(...beam([-1.5, y + gy, d(2) + 4], [7 - shake, y + gy, d(2) + 5.6], 0.55, 0.55, steelDark()));
    if (y < 0) mg = [7 - shake, y, d(2) + 5.6];
  }
  // Four tubes; the ready torpedo slides out of the near forward one.
  for (const y of [-4.6, 4.6]) for (const [x0, x1] of [[14, 34], [-32, -12]] as const) top.push(...barrel(x0, x1, y, d((x0 + x1) / 2) + 1.5, 1.4, mix(C("battleSteel"), U, 0.4)));
  if (!launch.launched && launch.slide > 0) top.push(...barrel(33, 34 + launch.slide, -4.6, d(24) + 1.5, 1, steel()));
  top.push(...oerlikon(-40, 0, d(-40), T.lo).faces, ...box(-51, -48, -1.5, 1.5, d(-50), d(-50) + 1.8, steelDark()));
  return {
    layers: [base, houses, top],
    water: S,
    deck: S,
    at: { torpedo: [34 + launch.slide, -4.6, d(24) + 1.5], mg },
    troops: [],
    lift: liftFor(S),
  };
}

/**
 * S-boot: a long round-bilged hull with a raised forecastle hiding the two torpedo tubes, which
 * open at the bow, the low rounded armored bridge, a 20mm in a well forward and one aft, and mottled
 * camouflage.
 */
export function sBoot(T: TeamShades, launch: Launch, shake: number): ShipModel {
  const U = sup(T);
  const S = [st(52, 0.5, 10.5, 6.5), st(46, 3, 10, -2), st(30, 6, 9.6, -2), st(16, 6.8, 9.2, -2), st(14, 6.8, 7.6, -2), st(-48, 6.5, 7, -2), st(-52, 5.5, 7, 0)];
  const d = (x: number) => deckAt(S, x);
  const base: Face[] = [...hull(S, { lower: shade(T.mid, 0.82), upper: T.mid, deck: mix(T.lo, C("battleWood"), 0.25), boot: 1 })];
  base.push(...splinter(-6.9, -44, 12, 1, 6.8, T));
  const y = -beamAt(S, 42) - 0.15;
  base.push(decalY(y, [[41, 7.2], [43.4, 7.2], [43.4, 9], [41, 9]], ink()));
  const top: Face[] = [];
  top.push(...loftZ(d(8), circle(8, 0, 3.8, 12, 0.9), d(8) + 3.4, circle(8.6, 0, 2.6, 12, 0.9), U), ...windows(-3.2, 9, 12, d(8) + 1.8, 0.6, 1.4));
  top.push(...beam([3, 0, d(3)], [2, 0, d(3) + 12], 0.6, 0.6, steelDark()), ...beam([2.2, -3.5, d(3) + 9], [2.2, 3.5, d(3) + 9], 0.4, 0.4, steelDark()));
  if (!launch.launched && launch.slide > 0) top.push(...barrel(42, 43 + launch.slide, -4.2, 8.1, 0.8, steel()));
  const aft = oerlikon(-38 - shake, 0, d(-38), T.lo);
  top.push(...loftZ(d(-38), circle(-38, 0, 2.2, 10), d(-38) + 1.2, circle(-38, 0, 2.2, 10), T.lo), ...aft.faces);
  top.push(...loftZ(d(28) - 0.2, circle(28, 0, 2, 10), d(28) + 0.8, circle(28, 0, 2, 10), T.lo), ...oerlikon(28, 0, d(28) - 0.6, T.lo).faces);
  return {
    layers: [base, [], top],
    water: S,
    deck: S,
    at: { torpedo: [43 + launch.slide, -4.2, 8.1], mg: aft.muzzle },
    troops: [],
    lift: liftFor(S),
  };
}

/**
 * Japanese torpedo boat: a small hard-chined boat with a low cabin, two torpedoes on racks either
 * side of it, and a machine gun aft.
 */
export function gyoraitei(T: TeamShades, launch: Launch, shake: number): ShipModel {
  const U = sup(T);
  const S = [st(46, 0.5, 10, 6.5), st(40, 2.6, 9, -2), st(26, 5, 8, -2), st(-42, 5.6, 6.4, -2), st(-46, 5, 6.4, 0)];
  const d = (x: number) => deckAt(S, x);
  const base: Face[] = [...hull(S, { lower: T.deep, upper: T.mid, deck: mix(C("battleWood"), T.lo, 0.4), boot: 1.5 })];
  const houses: Face[] = [...house(S, -2, 16, 3.2, 0, 4, U)];
  houses.push(...windows(-3.2, 0, 15, d(8) + 2.2, 0.9, 2.4), decalX(16.05, [[-2.6, d(16) + 2.4], [2.6, d(16) + 2.4], [2.6, d(16) + 3.4], [-2.6, d(16) + 3.4]], C("battleSkyLow")));
  const top: Face[] = [];
  top.push(...beam([6, 0, d(6) + 4], [5.5, 0, d(6) + 12], 0.5, 0.5, steelDark()));
  for (const y of [-4.2, 4.2]) {
    top.push(...box(-28, -10, y - 0.9, y + 0.9, d(-19), d(-19) + 0.8, steelDark()));
    const s = y < 0 && !launch.launched ? launch.slide : 0;
    if (!(y < 0 && launch.launched)) top.push(...barrel(-28 + s, -8 + s, y, d(-19) + 1.6, 0.85, steel()));
  }
  const gun = oerlikon(-36 - shake, 0, d(-36), T.lo);
  top.push(...gun.faces);
  return {
    layers: [base, houses, top],
    water: S,
    deck: S,
    at: { torpedo: [-8 + launch.slide, -4.2, d(-19) + 1.6], mg: gun.muzzle },
    troops: [],
    lift: liftFor(S),
  };
}

// ---- Carriers (05-supply-transport §10) ----

/** A carrier aircraft parked on deck with its wings folded up over its back. */
function parkedPlane(x: number, y: number, z: number, color: string): Face[] {
  return [
    ...beam([x - 4.5, y, z + 1], [x + 4, y, z + 1.2], 1.6, 1.4, color),
    ...box(x + 1, x + 2.6, y - 1.6, y + 1.6, z + 1.6, z + 3.8, color),
    ...box(x - 4.6, x - 3.4, y - 0.2, y + 0.2, z + 1.4, z + 3.6, color),
    ...box(x - 4.6, x - 3.6, y - 2.2, y + 2.2, z + 1.2, z + 1.6, color),
    ...box(x + 4, x + 4.4, y - 1.4, y + 1.4, z + 0.8, z + 1.8, steelDark()),
  ];
}

/** Paint on the flight deck: a dashed centerline, the deck's edge lines, and the elevators' outlines. */
function deckMarks(x0: number, x1: number, half: number, z: number, elevators: readonly number[], deck: string): Face[] {
  const white = mix(C("battleStar"), deck, 0.2);
  const f: Face[] = [];
  for (let x = x0; x + 5 <= x1; x += 9) f.push(decalZ(z, [[x, -0.35], [x + 5, -0.35], [x + 5, 0.35], [x, 0.35]], white));
  for (const y of [-half, half - 0.5]) f.push(decalZ(z, [[x0, y], [x1, y], [x1, y + 0.5], [x0, y + 0.5]], white));
  for (const x of elevators) f.push(decalZ(z, [[x - 6, -6], [x + 6, -6], [x + 6, 6], [x - 6, 6]], shade(deck, 0.82)));
  return f;
}

/** The flight deck: a slab wider than the hull below, with a squared-off stern and a tapered bow. */
function flightDeck(x0: number, x1: number, half: number, z: number, color: string): Face[] {
  const outline: Poly = [[x0, -half], [x1 - 12, -half], [x1, -half * 0.55], [x1, half * 0.55], [x1 - 12, half], [x0, half]];
  return loftZ(z - 1.2, outline, z, outline, color);
}

/**
 * Essex class: a long hull with an open hangar under a wooden flight deck that overhangs it fore
 * and aft, the island on the starboard side with its bridge, one broad funnel and a lattice mast,
 * twin 5-inch mounts before and abaft the island, 40mm quads in sponsons along the side, and
 * aircraft parked aft with their wings folded.
 */
export function essex(T: TeamShades): ShipModel {
  const U = sup(T);
  const S = [
    st(92, 0.5, 15, 12), st(86, 3.5, 13.5, -4), st(72, 8, 12, -4), st(50, 11, 11.4, -4), st(20, 12, 11, -4),
    st(-50, 12, 11, -4), st(-74, 11, 11, -4), st(-86, 8.5, 11, -1), st(-91, 6, 11, 3),
  ];
  const top = 21;
  const deck = mix(C("battleWood"), T.lo, 0.35);
  const base: Face[] = [...hull(S, { lower: T.lo, upper: T.mid, deck: T.lo, boot: 6 }), ...anchor(S, 80, 9.5)];
  // The hangar, open along the side in bays, and the closed forecastle under the bow overhang.
  const houses: Face[] = [...house(S, -76, 58, 11.6, 0, 8.8, U), ...house(S, 58, 82, 7, 0, 8.8, T.mid)];
  for (let x = -70; x + 10 <= 52; x += 14) houses.push(decalY(-11.65, [[x, 12.6], [x + 10, 12.6], [x + 10, 18], [x, 18]], T.deep));
  const flight: Face[] = [...flightDeck(-96, 94, 14.5, top, deck)];
  for (const x of [-92, -84, 86]) flight.push(...beam([x, -6, x > 0 ? 13.5 : 11], [x, -10, top - 1.2], 0.8, 0.8, steelDark()));
  const over: Face[] = [...deckMarks(-92, 84, 13.6, top + 0.02, [40, -28], deck)];
  // The island on the starboard (near) side.
  over.push(...box(-6, 30, -14.4, -10, top, top + 10, U), ...box(4, 24, -14, -10.4, top + 10, top + 16, U));
  over.push(...windows(-14.05, 5, 23, top + 13, 1.1), ...box(8, 20, -13.6, -10.8, top + 16, top + 18, T.lo));
  over.push(...shift(funnel(-2, top + 10, 4.6, 10, 1.5, U, steelDark(), 0.5), 0, -12.2, 0));
  over.push(...beam([14, -12.2, top + 18], [14, -12.2, top + 33], 0.8, 0.8, steelDark()), ...beam([14, -16, top + 29], [14, -8, top + 29], 0.6, 0.6, steelDark()));
  over.push(...box(13, 15, -15, -9.4, top + 24, top + 25, steel()));
  for (const x of [38, -14]) over.push(...twinMount(x, -12.2, top, U, x < 0));
  // 40mm quads in sponsons just under the flight deck edge.
  for (const x of [66, 4, -40, -66]) over.push(...aaTub(x, -15.5, top - 3.4, T.lo, 4, 2.2).faces);
  // Aircraft parked aft, wings folded.
  const plane = mix(T.mid, C("battleSteel"), 0.45);
  for (const [x, y] of [[-58, -5], [-58, 5], [-70, -5], [-70, 5], [-82, -5], [-82, 5]] as const) over.push(...parkedPlane(x, y, top, plane));
  return {
    layers: [base, houses, flight, over],
    water: S,
    deck: [st(94, 8, top, 0), st(82, 14.5, top, 0), st(-96, 14.5, top, 0)],
    at: {},
    troops: [],
    lift: liftFor(S),
  };
}

/**
 * Shōkaku: a closed two-level hangar under the flight deck, a small island well forward on the
 * starboard side, two funnels curving down and out from the starboard side below the deck edge,
 * twin 12.7cm mounts in sponsons, 25mm triples, and aircraft parked aft.
 */
export function shokaku(T: TeamShades): ShipModel {
  const U = sup(T);
  const S = [
    st(92, 0.5, 16, 12), st(85, 3.5, 14, -4), st(70, 8, 12.4, -4), st(46, 11.4, 11.6, -4), st(10, 12, 11, -4),
    st(-52, 12, 11, -4), st(-76, 10.4, 11, -4), st(-87, 7.5, 11, -1), st(-91, 5, 11, 3),
  ];
  const top = 22;
  const deck = mix(C("battleWood"), C("battleSand"), 0.3);
  const base: Face[] = [...hull(S, { lower: T.deep, upper: T.mid, deck: T.lo, boot: 4 }), ...anchor(S, 80, 10)];
  base.push(...portholes(S, -70, 60, 8.4, 5, T.deep));
  // The closed hangar, the same color as the hull, with a row of scuttles along each level.
  const houses: Face[] = [...house(S, -80, 64, 11.8, 0, 9.8, T.mid), ...house(S, 64, 84, 6.6, 0, 9.8, T.mid)];
  for (const z of [13.6, 17.6]) houses.push(...portholes([st(64, 11.8, 0, 0), st(-80, 11.8, 0, 0)], -74, 58, z, 6, T.deep));
  const flight: Face[] = [...flightDeck(-95, 92, 14, top, deck)];
  for (const x of [-90, -80, 84]) flight.push(...beam([x, -6, x > 0 ? 14 : 11], [x, -10, top - 1.2], 0.8, 0.8, steelDark()));
  const over: Face[] = [...deckMarks(-90, 82, 13, top + 0.02, [46, -10, -50], deck)];
  // Two funnels from the starboard side, curving down and out, below the flight deck.
  for (const x of [-4, -12]) {
    over.push(...beam([x, -11.8, 17], [x, -16, 17.5], 3.2, 3.2, U), ...beam([x, -16, 17.5], [x - 1, -18.5, 13], 3, 3, U));
    over.push(...box(x - 2.4, x + 0.4, -19.6, -17.4, 11.4, 12.6, steelDark()));
  }
  // The small island forward, with its bridge, rangefinder and mast.
  over.push(...box(26, 38, -14, -10.4, top, top + 8, U), ...box(28, 36, -13.6, -10.8, top + 8, top + 12, U));
  over.push(...windows(-13.65, 28.5, 35.5, top + 10, 0.9, 2), ...box(30, 34, -14.6, -9.8, top + 12, top + 13.2, T.lo));
  over.push(...beam([31, -12.2, top + 13.2], [30, -12.2, top + 25], 0.7, 0.7, steelDark()), ...beam([30.2, -15.4, top + 22], [30.2, -9, top + 22], 0.5, 0.5, steelDark()));
  // Twin 12.7cm mounts in sponsons below the deck edge, and 25mm triples.
  for (const x of [60, 24, -40, -64]) over.push(...twinMount(x, -15, top - 4.6, U, x < 0, 0.9));
  for (const x of [44, 8, -26, -52]) over.push(...aaTub(x, -15.2, top - 3, T.lo, 3, 1.8).faces);
  const plane = mix(C("battleKhaki"), T.mid, 0.35);
  for (const [x, y] of [[-56, -5], [-56, 5], [-68, -5], [-68, 5], [-80, -5], [-80, 5]] as const) over.push(...parkedPlane(x, y, top, plane));
  return {
    layers: [base, houses, flight, over],
    water: S,
    deck: [st(92, 7.7, top, 0), st(80, 14, top, 0), st(-95, 14, top, 0)],
    at: {},
    troops: [],
    lift: liftFor(S),
  };
}
