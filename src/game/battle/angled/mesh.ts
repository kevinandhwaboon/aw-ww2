// Battle figures built from simple 3D shapes and drawn turned a little toward the viewer, so a
// vehicle's turret roof, front and mantlet show as well as its side (08-art-pipeline §18).
// Shapes are boxes, extrusions and lofts; they're turned toward the viewer, lit, and painted back
// to front as crisp pixel polygons.

import { mix, shade, type Painter } from "../paint";

export type V3 = readonly [number, number, number];

export interface Face {
  readonly points: readonly V3[];
  readonly color: string;
  /** Markings and camouflage: drawn after the shapes, on whichever face they lie on. */
  readonly decal?: boolean;
  /** A marking's outward direction, so one on a hidden side isn't drawn. */
  readonly facing?: V3;
}

export interface View {
  /** Turn about the vertical, in radians: negative turns the front toward the viewer. */
  readonly yaw: number;
  /** How far the camera looks down, in radians. */
  readonly pitch: number;
}

/** Battle scenes turn vehicles 5° toward the viewer and look down about 24° (08-art-pipeline §18). */
export const BATTLE_VIEW: View = { yaw: -0.087, pitch: 0.42 };

// Model axes: x forward (toward the enemy), y to the vehicle's left, z up. Units are scene pixels.

/** A polygon in a plane, as a list of 2D points. */
type Poly2 = readonly (readonly [number, number])[];

function faceOf(points: V3[], color: string, center: V3): Face {
  // Wind every face so its normal points away from the shape's centre.
  const n = normal(points);
  const c = centroid(points);
  const out = (c[0] - center[0]) * n[0] + (c[1] - center[1]) * n[1] + (c[2] - center[2]) * n[2];
  return { points: out >= 0 ? points : [...points].reverse(), color };
}

function centroid(points: readonly V3[]): V3 {
  const s = points.reduce<[number, number, number]>((a, p) => [a[0] + p[0], a[1] + p[1], a[2] + p[2]], [0, 0, 0]);
  return [s[0] / points.length, s[1] / points.length, s[2] / points.length];
}

function normal(points: readonly V3[]): V3 {
  // Newell's method: robust for any planar polygon.
  let nx = 0;
  let ny = 0;
  let nz = 0;
  for (let i = 0; i < points.length; i++) {
    const a = points[i] ?? [0, 0, 0];
    const b = points[(i + 1) % points.length] ?? [0, 0, 0];
    nx += (a[1] - b[1]) * (a[2] + b[2]);
    ny += (a[2] - b[2]) * (a[0] + b[0]);
    nz += (a[0] - b[0]) * (a[1] + b[1]);
  }
  const len = Math.hypot(nx, ny, nz) || 1;
  return [nx / len, ny / len, nz / len];
}

/** Two matching outlines joined by side faces: covers boxes, wedges, prisms and tapered turrets. */
function loft(bottom: V3[], top: V3[], color: string, sides = color): Face[] {
  const center = centroid([...bottom, ...top]);
  const faces = [faceOf(bottom, color, center), faceOf(top, color, center)];
  for (let i = 0; i < bottom.length; i++) {
    const j = (i + 1) % bottom.length;
    const a = bottom[i];
    const b = bottom[j];
    const c = top[j];
    const d = top[i];
    if (a && b && c && d) faces.push(faceOf([a, b, c, d], sides, center));
  }
  return faces;
}

export function box(x0: number, x1: number, y0: number, y1: number, z0: number, z1: number, color: string): Face[] {
  const rect: Poly2 = [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
  return loftZ(z0, rect, z1, rect, color);
}

/** A shape seen from the side (x, z), extruded across its width (y). Hulls, wedges, wheels. */
export function extrudeY(y0: number, y1: number, profile: Poly2, color: string): Face[] {
  return loft(profile.map(([x, z]) => [x, y0, z] as V3), profile.map(([x, z]) => [x, y1, z] as V3), color);
}

/** A shape seen end-on (y, z), extruded along the length (x). Barrels and tubes. */
export function extrudeX(x0: number, x1: number, section: Poly2, color: string): Face[] {
  return loft(section.map(([y, z]) => [x0, y, z] as V3), section.map(([y, z]) => [x1, y, z] as V3), color);
}

/** A plan outline (x, y) at one height lofted to another outline higher up: turrets with sloped sides. */
export function loftZ(z0: number, bottom: Poly2, z1: number, top: Poly2, color: string): Face[] {
  return loft(bottom.map(([x, y]) => [x, y, z0] as V3), top.map(([x, y]) => [x, y, z1] as V3), color);
}

export function circle(cx: number, cy: number, r: number, sides = 10, squash = 1): Poly2 {
  return Array.from({ length: sides }, (_, i) => {
    const a = (i / sides) * Math.PI * 2;
    return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * squash] as const;
  });
}

/** A gun barrel along x from x0 to x1, centred on (y, z). */
export function barrel(x0: number, x1: number, y: number, z: number, r: number, color: string): Face[] {
  return extrudeX(x0, x1, circle(y, z, r, 8), color);
}

/** A wheel on the side at y, its axle across the vehicle. */
export function wheel(x: number, y: number, z: number, r: number, width: number, rim: string, hub: string): Face[] {
  return [...extrudeY(y - width / 2, y + width / 2, circle(x, z, r, 12), rim), ...extrudeY(y - width / 2 - 0.4, y + width / 2 + 0.4, circle(x, z, r * 0.55, 8), hub)];
}

/** A flat marking lying on a face at y (the vehicle's right side is y negative). */
export function decalY(y: number, outline: Poly2, color: string): Face {
  return { points: outline.map(([x, z]) => [x, y, z] as V3), color, decal: true, facing: [0, y < 0 ? -1 : 1, 0] };
}

// ---- Projection ----

export interface Projected {
  readonly x: number;
  readonly y: number;
  readonly depth: number;
}

export function project(p: V3, view: View): Projected {
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  const wx = p[0] * cy - p[1] * sy;
  const wy = p[0] * sy + p[1] * cy;
  const wz = p[2];
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  return { x: wx, y: -(wy * sp + wz * cp), depth: wy * cp - wz * sp };
}

function rotateNormal(n: V3, view: View): V3 {
  const cy = Math.cos(view.yaw);
  const sy = Math.sin(view.yaw);
  return [n[0] * cy - n[1] * sy, n[0] * sy + n[1] * cy, n[2]];
}

/** Light from the upper left, a little in front: lit faces brighten, faces turned away darken. */
const LIGHT: V3 = (() => {
  const l: V3 = [-0.45, -0.55, 0.7];
  const len = Math.hypot(...l);
  return [l[0] / len, l[1] / len, l[2] / len];
})();

/**
 * Paints faces back to front at (ox, oy). `flip` mirrors the result so a figure on the right half
 * faces left. Edges are inked a shade darker so the shapes read as pixel art, not flat polygons.
 */
export function drawMesh(p: Painter, faces: readonly Face[], view: View, ox: number, oy: number, flip = false, scale = 1): void {
  const cp = Math.cos(view.pitch);
  const sp = Math.sin(view.pitch);
  const toward: V3 = [0, -cp, sp];
  const drawn = faces
    .map((face) => {
      const n = rotateNormal(face.facing ?? normal(face.points), view);
      const facing = n[0] * toward[0] + n[1] * toward[1] + n[2] * toward[2];
      const pts = face.points.map((pt) => project(pt, view));
      const depth = pts.reduce((s, q) => s + q.depth, 0) / pts.length - (face.decal ? 0.5 : 0);
      return { face, n, facing, pts, depth };
    })
    .filter((f) => f.facing > 0.02)
    // Shapes back to front, then markings on top of them.
    .sort((a, b) => (a.face.decal === b.face.decal ? b.depth - a.depth : a.face.decal ? 1 : -1));
  for (const { face, n, pts } of drawn) {
    const lit = Math.max(0, n[0] * LIGHT[0] + n[1] * LIGHT[1] + n[2] * LIGHT[2]);
    const color = face.decal ? face.color : shade(face.color, 0.62 + 0.5 * lit);
    const poly = pts.map((q) => [ox + (flip ? -q.x : q.x) * scale, oy + q.y * scale] as const);
    p.poly(poly, color);
    // Ink the edges of the bigger faces only; small parts would turn into noise.
    let area = 0;
    for (let i = 0; i < poly.length; i++) {
      const a = poly[i];
      const b = poly[(i + 1) % poly.length];
      if (a && b) area += a[0] * b[1] - b[0] * a[1];
    }
    if (!face.decal && Math.abs(area) / 2 > 40) {
      const edge = shade(color, 0.8);
      for (let i = 0; i < poly.length; i++) {
        const a = poly[i];
        const b = poly[(i + 1) % poly.length];
        if (a && b) p.line(Math.round(a[0]), Math.round(a[1]), Math.round(b[0]), Math.round(b[1]), edge);
      }
    }
  }
}

/** Where a point of the model lands on screen, for drawing sprites (heads, flashes) on it. */
export function screenPoint(pt: V3, view: View, ox: number, oy: number, flip = false, scale = 1): { x: number; y: number } {
  const q = project(pt, view);
  return { x: ox + (flip ? -q.x : q.x) * scale, y: oy + q.y * scale };
}

export const tone = (a: string, b: string, t: number): string => mix(a, b, t);
