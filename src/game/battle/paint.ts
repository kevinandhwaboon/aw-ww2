// Pixel drawing for battle scenes: crisp rectangles, lines, discs and polygons on a small canvas that
// is scaled up with nearest-neighbor, so the battle art stays pixel art (08-art-pipeline §18).

import { packColor } from "../artPack";
import { playerColors } from "../placeholderUnits";
import { mix, shade, type TeamShades } from "./colors";
import type { NationId } from "../../engine/data/nations";

export class Painter {
  constructor(readonly ctx: CanvasRenderingContext2D) {}

  rect(x: number, y: number, w: number, h: number, color: string): void {
    if (w <= 0 || h <= 0) return;
    this.ctx.fillStyle = color;
    this.ctx.fillRect(Math.round(x), Math.round(y), Math.round(w), Math.round(h));
  }

  px(x: number, y: number, color: string): void {
    this.rect(x, y, 1, 1, color);
  }

  /** A line `width` pixels thick, stepped one pixel at a time so it stays crisp. */
  line(x0: number, y0: number, x1: number, y1: number, color: string, width = 1): void {
    const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    this.ctx.fillStyle = color;
    const off = Math.floor(width / 2);
    for (let i = 0; i <= steps; i++) {
      const x = Math.round(x0 + ((x1 - x0) * i) / steps);
      const y = Math.round(y0 + ((y1 - y0) * i) / steps);
      this.ctx.fillRect(x - off, y - off, width, width);
    }
  }

  ellipse(cx: number, cy: number, rx: number, ry: number, color: string): void {
    if (rx <= 0 || ry <= 0) return;
    this.ctx.fillStyle = color;
    const top = Math.round(cy - ry);
    const bottom = Math.round(cy + ry);
    for (let y = top; y < bottom; y++) {
      const dy = (y + 0.5 - cy) / ry;
      const half = rx * Math.sqrt(Math.max(0, 1 - dy * dy));
      const x0 = Math.round(cx - half);
      const x1 = Math.round(cx + half);
      if (x1 > x0) this.ctx.fillRect(x0, y, x1 - x0, 1);
    }
  }

  disc(cx: number, cy: number, r: number, color: string): void {
    this.ellipse(cx, cy, r, r, color);
  }

  /** A filled polygon, scanline by scanline (even-odd rule). */
  poly(points: readonly (readonly [number, number])[], color: string): void {
    if (points.length < 3) return;
    this.ctx.fillStyle = color;
    const ys = points.map((p) => p[1]);
    const top = Math.floor(Math.min(...ys));
    const bottom = Math.ceil(Math.max(...ys));
    for (let y = top; y < bottom; y++) {
      const sy = y + 0.5;
      const xs: number[] = [];
      for (let i = 0; i < points.length; i++) {
        const a = points[i];
        const b = points[(i + 1) % points.length];
        if (!a || !b) continue;
        if ((a[1] <= sy && b[1] > sy) || (b[1] <= sy && a[1] > sy)) {
          xs.push(a[0] + ((sy - a[1]) * (b[0] - a[0])) / (b[1] - a[1]));
        }
      }
      xs.sort((m, n) => m - n);
      for (let i = 0; i + 1 < xs.length; i += 2) {
        const x0 = Math.round(xs[i] ?? 0);
        const x1 = Math.round(xs[i + 1] ?? 0);
        if (x1 > x0) this.ctx.fillRect(x0, y, x1 - x0, 1);
      }
    }
  }

  /** A barrel or tube of `width` pixels from (x, y) at `angle` radians (0 = right, negative = up). */
  barrel(x: number, y: number, length: number, angle: number, width: number, color: string): { x: number; y: number } {
    const ex = x + Math.cos(angle) * length;
    const ey = y + Math.sin(angle) * length;
    this.line(x, y, ex, ey, color, width);
    return { x: ex, y: ey };
  }
}

// ---- Colors ----

export { C, mix, shade, type TeamShades } from "./colors";

export function teamShades(owner: number | null, nation: NationId | null): TeamShades {
  if (owner === null) {
    const stone = packColor("battleConcrete");
    return { hi: shade(stone, 1.2), mid: stone, lo: shade(stone, 0.75), deep: shade(stone, 0.5), cloth: stone, clothLo: shade(stone, 0.75) };
  }
  const [fill] = playerColors(owner);
  const drab = packColor(nation === "germany" ? "battleFieldGrey" : "battleOlive");
  const body = mix(fill, drab, 0.35);
  const cloth = mix(fill, drab, 0.6);
  return {
    hi: shade(body, 1.3),
    mid: body,
    lo: shade(body, 0.72),
    deep: shade(body, 0.5),
    cloth,
    clothLo: shade(cloth, 0.72),
  };
}

