// Colors for battle figures, free of the DOM so models and tests can use them (08-art-pipeline §18).

import type { Season } from "../../engine/data/weather";
import { packColor, type ColorKey } from "../artPack";

const hex = (value: number) => Math.max(0, Math.min(255, Math.round(value))).toString(16).padStart(2, "0");

function rgb(color: string): [number, number, number] {
  const n = parseInt(color.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
}

/** Lighter (factor above 1) or darker (below 1). */
export function shade(color: string, factor: number): string {
  const [r, g, b] = rgb(color);
  if (factor <= 1) return `#${hex(r * factor)}${hex(g * factor)}${hex(b * factor)}`;
  const t = factor - 1;
  return `#${hex(r + (255 - r) * t)}${hex(g + (255 - g) * t)}${hex(b + (255 - b) * t)}`;
}

/** `t` of the way from a to b. */
export function mix(a: string, b: string, t: number): string {
  const [r1, g1, b1] = rgb(a);
  const [r2, g2, b2] = rgb(b);
  return `#${hex(r1 + (r2 - r1) * t)}${hex(g1 + (g2 - g1) * t)}${hex(b1 + (b2 - b1) * t)}`;
}

function toHsl(color: string): [number, number, number] {
  const [r, g, b] = rgb(color).map((v) => v / 255) as [number, number, number];
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const l = (max + min) / 2;
  if (max === min) return [0, 0, l];
  const d = max - min;
  const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
  const h = max === r ? (g - b) / d + (g < b ? 6 : 0) : max === g ? (b - r) / d + 2 : (r - g) / d + 4;
  return [h * 60, s, l];
}

function fromHsl(h: number, s: number, l: number): string {
  const k = (n: number) => (n + h / 30) % 12;
  const a = s * Math.min(l, 1 - l);
  const f = (n: number) => l - a * Math.max(-1, Math.min(k(n) - 3, Math.min(9 - k(n), 1)));
  return `#${hex(f(0) * 255)}${hex(f(8) * 255)}${hex(f(4) * 255)}`;
}

/**
 * Lit, keeping the color's saturation: lightness moves `amount` of the way to white and the hue
 * turns a few degrees toward `toward`'s hue, so a lit red stays red rather than washing out to pink.
 */
export function brighten(color: string, amount: number, toward: string): string {
  const [h, s, l] = toHsl(color);
  const [th] = toHsl(toward);
  const turn = ((th - h + 540) % 360) - 180;
  return fromHsl((h + Math.sign(turn) * Math.min(Math.abs(turn), 14 * amount * 2.5) + 360) % 360, s, l + (1 - l) * amount * 0.75);
}

/** The shades one side's battle figures are painted in. */
export interface TeamShades {
  readonly hi: string;
  readonly mid: string;
  readonly lo: string;
  readonly deep: string;
  /** The uniform: the team color toned toward the nation's drab, so soldiers still look like soldiers. */
  readonly cloth: string;
  readonly clothLo: string;
}

/** What the sky and ground look like in battle scenes (12-weather §5). */
export interface BattleWeather {
  readonly season: Season;
  readonly snowing: boolean;
}

/** On a winter map, snow-covered colors stand in for the summer ground and trees. */
const WINTER: Partial<Record<ColorKey, ColorKey>> = {
  battleGrass: "battleSnow",
  battleGrassLight: "battleSnowLight",
  battleGrassDark: "battleSnowDark",
  battleDirt: "battleSnowDirt",
  battleRoad: "battleSnowRoad",
  battleHill: "battleSnowHill",
  battleTree: "battleWinterTree",
  battleTreeDark: "battleWinterTreeDark",
};
/** While it snows, the sky is overcast. */
const SNOWING: Partial<Record<ColorKey, ColorKey>> = {
  battleSkyTop: "battleOvercastTop",
  battleSkyLow: "battleOvercastLow",
  battleCloud: "battleOvercastLow",
};

let weather: BattleWeather = { season: "summer", snowing: false };

/** Sets the weather the next battle scenes are drawn in. Drawing only: no outcome depends on it. */
export function setBattleWeather(next: BattleWeather): void {
  weather = next;
}

export function battleWeather(): BattleWeather {
  return weather;
}

/** Shorthand for battle colors from the art pack, in the current battle weather. */
export const C = (key: ColorKey): string => {
  const winter = weather.season === "winter" ? WINTER[key] : undefined;
  const sky = weather.snowing ? SNOWING[key] : undefined;
  return packColor(sky ?? winter ?? key);
};

/**
 * Polish for sprite figures (08-art-pipeline §18 "Polish"): lights the figure's own edges in place.
 * A pixel whose top is open sky and whose body continues below catches the light; one whose
 * bottom is open shades toward `shade`. Left and right edges do the same, more gently. Lines one
 * pixel thick (rifles, straps) are left alone, so they don't wash out. `data` is RGBA, `w` wide.
 */
/** Edge colors already worked out, by tints, then by color and edge: figures reuse a few dozen colors. */
const RIM_CACHE = new Map<string, Map<number, number>>();

export function rimLight(data: Uint8ClampedArray, w: number, h: number, light: string, shadeTint: string): void {
  // 0 empty, 1 part-covered, 2 solid; one pixel of empty border round the outside.
  const bw = w + 2;
  const cover = new Uint8Array(bw * (h + 2));
  let any = false;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const alpha = data[(y * w + x) * 4 + 3] ?? 0;
      if (alpha === 0) continue;
      cover[(y + 1) * bw + x + 1] = alpha === 255 ? 2 : 1;
      any = true;
    }
  }
  if (!any) return;
  const tints = `${light}${shadeTint}`;
  let cache = RIM_CACHE.get(tints);
  if (!cache) {
    cache = new Map<number, number>();
    RIM_CACHE.set(tints, cache);
  }
  const recolor = (i: number, mode: number) => {
    const r = data[i] ?? 0;
    const g = data[i + 1] ?? 0;
    const b = data[i + 2] ?? 0;
    const key = ((r << 16) | (g << 8) | b) * 4 + mode;
    let out = cache.get(key);
    if (out === undefined) {
      const color = `#${hex(r)}${hex(g)}${hex(b)}`;
      const c = rgb(mode === 0 ? brighten(color, 0.38, light) : mode === 1 ? mix(color, shadeTint, 0.38) : mode === 2 ? brighten(color, 0.2, light) : mix(color, shadeTint, 0.22));
      out = (c[0] << 16) | (c[1] << 8) | c[2];
      cache.set(key, out);
    }
    data[i] = (out >> 16) & 255;
    data[i + 1] = (out >> 8) & 255;
    data[i + 2] = out & 255;
  };
  for (let y = 0; y < h; y++) {
    let k = (y + 1) * bw + 1;
    for (let x = 0; x < w; x++, k++) {
      if (cover[k] !== 2) continue;
      const up = cover[k - bw];
      const down = cover[k + bw];
      const mode = up === 0 && down === 2 ? 0 : down === 0 && up === 2 ? 1 : cover[k - 1] === 0 && cover[k + 1] === 2 ? 2 : cover[k + 1] === 0 && cover[k - 1] === 2 ? 3 : -1;
      if (mode >= 0) recolor((y * w + x) * 4, mode);
    }
  }
}
