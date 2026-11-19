// The map select's world map (00-master-design §12): real coastlines drawn as chunky pixels, a dot
// where each battle was fought, and a camera that flies between theaters. The land is rasterized at
// a fixed low resolution for every view, so zooming in sharpens the coast the way a pixel map would.

import { packColor, type ColorKey } from "../game/artPack";
import { between, project, viewHeight, VIEW_ASPECT, WORLD_VIEW, type MapView } from "./theaters";
import { WORLD_LAND } from "./worldLand";

/** The map's own pixels; CSS scales the canvas up. */
export const WORLD_PIXELS = { width: 288, height: 288 / VIEW_ASPECT } as const;

export interface MapDot {
  readonly id: string;
  readonly lon: number;
  readonly lat: number;
}

const ease = (t: number) => (t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2);

type Rgb = readonly [number, number, number];
const rgb = (key: ColorKey): Rgb => {
  const n = parseInt(packColor(key).slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

export class WorldMap {
  readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly mask: CanvasRenderingContext2D;
  private readonly land: readonly Path2D[];
  private base: ImageData | null = null;
  private view: MapView = WORLD_VIEW;
  private flight: { from: MapView; to: MapView; via: MapView | null; start: number; length: number } | null = null;
  private dots: readonly MapDot[] = [];
  private selected: string | null = null;
  private frame = 0;
  /** Called whenever the camera moves, so labels over the map can follow. */
  onMove: (view: MapView) => void = () => {};

  constructor() {
    this.canvas = document.createElement("canvas");
    this.canvas.width = WORLD_PIXELS.width;
    this.canvas.height = WORLD_PIXELS.height;
    this.canvas.className = "world-map-canvas";
    const ctx = this.canvas.getContext("2d");
    const maskCanvas = document.createElement("canvas");
    maskCanvas.width = WORLD_PIXELS.width;
    maskCanvas.height = WORLD_PIXELS.height;
    const mask = maskCanvas.getContext("2d", { willReadFrequently: true });
    if (!ctx || !mask) throw new Error("2D canvas not available");
    this.ctx = ctx;
    this.mask = mask;
    this.land = WORLD_LAND.map((d) => new Path2D(d));
    this.frame = requestAnimationFrame(this.tick);
  }

  get currentView(): MapView {
    return this.view;
  }

  setDots(dots: readonly MapDot[], selected: string | null): void {
    this.dots = dots;
    this.selected = selected;
  }

  /** Flies to `to`; between distant views it pulls back to the whole world on the way. */
  flyTo(to: MapView, instant = false): void {
    if (instant) {
      this.flight = null;
      this.setView(to);
      return;
    }
    const from = this.view;
    const far = Math.abs(from.west + from.width / 2 - (to.west + to.width / 2)) > (from.width + to.width) / 2;
    this.flight = { from, to, via: far ? WORLD_VIEW : null, start: performance.now(), length: far ? 1400 : 700 };
  }

  stop(): void {
    cancelAnimationFrame(this.frame);
  }

  private setView(view: MapView): void {
    this.view = view;
    this.base = null;
    this.onMove(view);
  }

  private readonly tick = (now: number): void => {
    if (this.flight) {
      const { from, to, via, start, length } = this.flight;
      const t = ease(Math.min(1, (now - start) / length));
      this.setView(via ? (t < 0.5 ? between(from, via, t * 2) : between(via, to, t * 2 - 1)) : between(from, to, t));
      if (t >= 1) this.flight = null;
    }
    this.draw(now);
    this.frame = requestAnimationFrame(this.tick);
  };

  /** Rasterizes the land for the current view into the palette: sea, shallows, coast, land. */
  private rasterize(): ImageData {
    const { width: w, height: h } = WORLD_PIXELS;
    const { mask, view } = this;
    mask.setTransform(1, 0, 0, 1, 0, 0);
    mask.fillStyle = "#000";
    mask.fillRect(0, 0, w, h);
    mask.fillStyle = "#fff";
    const s = w / view.width;
    // The land data spans −180 to 180; views past 180 (the Pacific) draw it again one turn east.
    for (const turn of [0, 360]) {
      if (view.west + view.width < -180 + turn || view.west > 180 + turn) continue;
      mask.setTransform(s / 10, 0, 0, s / 10, (turn - view.west) * s, view.north * s);
      for (const path of this.land) mask.fill(path);
    }
    const src = mask.getImageData(0, 0, w, h).data;
    const isLand = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h && (src[(y * w + x) * 4] ?? 0) > 110;
    const out = this.ctx.createImageData(w, h);
    const sea = rgb("worldSea");
    const shallow = rgb("worldSeaShallow");
    const grid = rgb("worldGrid");
    const land = rgb("worldLand");
    const landShade = rgb("worldLandShade");
    const coast = rgb("worldCoast");
    // Lines every 15° of longitude and latitude, dotted, on the sea only.
    const step = view.width > 150 ? 30 : view.width > 50 ? 10 : 5;
    const gridCol = new Uint8Array(w);
    const gridRow = new Uint8Array(h);
    for (let x = 0; x < w; x++) {
      const a = view.west + (x / w) * view.width, b = view.west + ((x + 1) / w) * view.width;
      gridCol[x] = Math.floor(a / step) !== Math.floor(b / step) ? 1 : 0;
    }
    const vh = viewHeight(view);
    for (let y = 0; y < h; y++) {
      const a = view.north - (y / h) * vh, b = view.north - ((y + 1) / h) * vh;
      gridRow[y] = Math.floor(a / step) !== Math.floor(b / step) ? 1 : 0;
    }
    for (let y = 0; y < h; y++) {
      for (let x = 0; x < w; x++) {
        let color: Rgb;
        if (isLand(x, y)) {
          const edge = !isLand(x - 1, y) || !isLand(x + 1, y) || !isLand(x, y - 1) || !isLand(x, y + 1);
          // Land facing south-east is in shadow, which lifts the coast off the sea.
          color = edge ? coast : !isLand(x + 1, y + 1) || !isLand(x, y + 2) ? landShade : land;
        } else {
          const near = isLand(x - 1, y) || isLand(x + 1, y) || isLand(x, y - 1) || isLand(x, y + 1) || isLand(x - 1, y - 1) || isLand(x + 1, y + 1);
          color = near ? shallow : ((gridCol[x] && y % 2 === 0) || (gridRow[y] && x % 2 === 0)) ? grid : sea;
        }
        const i = (y * w + x) * 4;
        out.data[i] = color[0];
        out.data[i + 1] = color[1];
        out.data[i + 2] = color[2];
        out.data[i + 3] = 255;
      }
    }
    return out;
  }

  private draw(now: number): void {
    this.base ??= this.rasterize();
    const { ctx, view } = this;
    ctx.putImageData(this.base, 0, 0);
    const { width: w, height: h } = WORLD_PIXELS;
    const blink = Math.floor(now / 400) % 2 === 0;
    const order = [...this.dots].sort((a, b) => Number(a.id === this.selected) - Number(b.id === this.selected));
    for (const dot of order) {
      const p = project(view, dot.lon, dot.lat);
      const x = Math.floor(p.x * w), y = Math.floor(p.y * h);
      if (x < -4 || y < -4 || x > w + 4 || y > h + 4) continue;
      const chosen = dot.id === this.selected;
      ctx.fillStyle = packColor("worldDotOutline");
      ctx.fillRect(x - 2, y - 2, 5, 5);
      ctx.fillStyle = packColor(chosen ? "worldDot" : "worldDotOther");
      ctx.fillRect(x - 1, y - 1, 3, 3);
      if (chosen) {
        // Corner brackets around the chosen battle, blinking like the map cursor.
        const r = blink ? 5 : 6;
        ctx.fillStyle = packColor("worldDot");
        for (const [sx, sy] of [[-1, -1], [1, -1], [-1, 1], [1, 1]] as const) {
          const cx = x + sx * r, cy = y + sy * r;
          ctx.fillRect(sx < 0 ? cx : cx - 2, cy, 3, 1);
          ctx.fillRect(cx, sy < 0 ? cy : cy - 2, 1, 3);
        }
      }
    }
  }
}
