// The background behind each half of a battle scene, from the terrain the unit stands on
// (08-art-pipeline §18). Aircraft fight against open sky; a submerged submarine fights underwater;
// a Landing Craft on a beach is drawn run aground, half on the sand.

import type { TerrainId } from "../../engine/data/terrain";
import { C, mix, shade, type Painter } from "./paint";
import { hash } from "./timeline";

export const SCENE = { width: 384, height: 240, half: 192, top: 18, bottom: 222, horizon: 124 } as const;

/** How tall the strip of sea under aircraft flying over water is, at the bottom of their half. */
export const AIR_SEA_BAND = 26;

export type BackdropView = "land" | "sea" | "air" | "underwater" | "shore";

function sky(p: Painter, x0: number, bottom: number, t: number, clouds: number): void {
  const bands = 7;
  const span = bottom - SCENE.top;
  for (let i = 0; i < bands; i++) {
    const y = SCENE.top + Math.floor((span * i) / bands);
    const next = SCENE.top + Math.floor((span * (i + 1)) / bands);
    p.rect(x0, y, SCENE.half, next - y, mix(C("battleSkyTop"), C("battleSkyLow"), i / (bands - 1)));
  }
  for (let i = 0; i < clouds; i++) {
    const cx = x0 + ((hash(i, 3) * 260 + t / 120) % 230) - 20;
    const cy = SCENE.top + 10 + hash(i, 9) * Math.max(10, bottom - SCENE.top - 40);
    const w = 14 + hash(i, 5) * 18;
    p.ellipse(cx, cy, w, 5, C("battleCloud"));
    p.ellipse(cx - w / 3, cy - 3, w / 2, 5, C("battleCloud"));
    p.ellipse(cx + w / 4, cy - 4, w / 2.5, 5, C("battleCloud"));
    p.rect(cx - w + 3, cy + 3, w * 2 - 6, 1, shade(C("battleCloud"), 0.88));
  }
}

function grass(p: Painter, x0: number, top: number, color: string): void {
  p.rect(x0, top, SCENE.half, SCENE.bottom - top, color);
  // Lighter toward the front, so the ground reads as receding.
  p.rect(x0, top, SCENE.half, 6, shade(color, 0.9));
  for (let i = 0; i < 110; i++) {
    const x = x0 + Math.floor(hash(i, x0, 1) * SCENE.half);
    const y = top + 2 + Math.floor(hash(i, x0, 2) * (SCENE.bottom - top - 4));
    const light = hash(i, 4) > 0.5;
    p.px(x, y, light ? C("battleGrassLight") : C("battleGrassDark"));
    p.px(x + 1, y - 1, light ? C("battleGrassLight") : C("battleGrassDark"));
  }
}

function treeline(p: Painter, x0: number, y: number, size: number, dark: boolean): void {
  for (let x = -8; x < SCENE.half + 8; x += size) {
    const r = size * (0.7 + hash(x, y) * 0.6);
    p.disc(x0 + x, y - r * 0.4, r, dark ? C("battleTreeDark") : C("battleTree"));
  }
}

function tree(p: Painter, x: number, ground: number, height: number): void {
  p.rect(x - 1, ground - height * 0.45, 3, height * 0.45, shade(C("battleWood"), 0.6));
  p.disc(x, ground - height * 0.6, height * 0.32, C("battleTreeDark"));
  p.disc(x - 3, ground - height * 0.72, height * 0.26, C("battleTree"));
  p.disc(x + 3, ground - height * 0.82, height * 0.2, mix(C("battleTree"), C("battleGrassLight"), 0.3));
}

function house(p: Painter, x: number, ground: number, w: number, h: number, seed: number): void {
  p.rect(x, ground - h, w, h, C("battleStone"));
  p.rect(x + w - 3, ground - h, 3, h, shade(C("battleStone"), 0.8));
  p.poly([[x - 2, ground - h], [x + w / 2, ground - h - w / 2], [x + w + 2, ground - h]], C("battleRoof"));
  for (let wx = x + 3; wx < x + w - 5; wx += 7) {
    p.rect(wx, ground - h + 4, 3, 4, C("battleInk"));
    p.rect(wx - 1, ground - h + 8, 5, 1, shade(C("battleStone"), 0.75));
  }
  p.rect(x + 3, ground - 7, 4, 7, shade(C("battleWood"), 0.7));
  if (seed % 2 === 0) p.rect(x + w - 6, ground - h - w / 2 + 2, 3, 6, shade(C("battleStone"), 0.7));
}

function water(p: Painter, x0: number, top: number, bottom: number, t: number, width: number = SCENE.half): void {
  p.rect(x0, top, width, bottom - top, C("battleSea"));
  p.rect(x0, top, width, 2, C("battleSeaDeep"));
  const shift = Math.floor(t / 300) % 2;
  for (let i = 0; i < 46; i++) {
    const y = top + 2 + Math.floor(hash(i, 11) * (bottom - top - 3));
    const x = x0 + Math.floor(hash(i, 13) * Math.max(1, width - 8)) + shift * 2;
    p.rect(x, y, 5 + Math.floor(hash(i, 17) * 6), 1, hash(i, 19) > 0.7 ? C("battleFoam") : C("battleSeaLight"));
  }
}

// ---- Harbor pieces (08-art-pipeline §18, §19): shared by Port battle backdrops and the capture scene ----

/** A lighthouse on the end of a stone breakwater: white tower with red bands, a lamp that flashes. */
export function lighthouse(p: Painter, x: number, base: number, height: number, t: number): void {
  const w = Math.max(4, Math.round(height / 6));
  p.rect(x - w * 2, base - 3, w * 4, 4, shade(C("battleStone"), 0.8));
  p.poly([[x - w / 2 - 1, base - 3], [x - w / 2 + 1, base - height], [x + w / 2 - 1, base - height], [x + w / 2 + 1, base - 3]], C("battleStar"));
  for (let k = 1; k <= 3; k += 2) {
    const y = base - 3 - ((height - 3) * k) / 4;
    p.rect(x - w / 2, y - height / 10, w + 1, height / 8, C("battleSun"));
  }
  p.rect(x - w / 2 - 1, base - height - 1, w + 3, 1, C("battleSteelDark"));
  const lit = Math.floor(t / 600) % 2 === 0;
  p.rect(x - w / 2, base - height - 4, w + 1, 3, lit ? C("battleTracer") : shade(C("battleTracer"), 0.6));
  p.poly([[x - w / 2 - 1, base - height - 4], [x + 0.5, base - height - 8], [x + w / 2 + 2, base - height - 4]], C("battleSun"));
  if (lit) p.rect(x + w, base - height - 3, 6, 1, mix(C("battleTracer"), C("battleSkyLow"), 0.5));
}

/** A low breakwater of stone across the harbor mouth, its far end at `tip`. */
function breakwater(p: Painter, from: number, tip: number, y: number): void {
  const left = Math.min(from, tip);
  p.rect(left, y - 3, Math.abs(tip - from), 4, shade(C("battleStone"), 0.75));
  p.rect(left, y - 3, Math.abs(tip - from), 1, C("battleStone"));
  for (let x = left; x < left + Math.abs(tip - from); x += 5) p.px(x, y - 1, shade(C("battleStone"), 0.6));
}

/**
 * A freighter moored alongside: black hull with a red boot-topping at the waterline, a white bridge,
 * a funnel with a band, masts with cargo derricks. `bow` is 1 when the bow points right.
 */
export function freighter(p: Painter, x: number, waterline: number, length: number, bow: 1 | -1): void {
  const hull = C("battleInk");
  const h = Math.round(length / 7);
  const sx = (k: number) => x + bow * (k - 0.5) * length;
  const stern = sx(0);
  const prow = sx(1);
  p.poly([[stern, waterline - h], [prow + bow * 4, waterline - h - 3], [prow - bow * 2, waterline], [stern + bow * 3, waterline]], hull);
  p.rect(Math.min(stern, prow) + 2, waterline - 3, length - 4, 2, C("battleSun"));
  p.rect(Math.min(stern, prow), waterline - h, length, 1, shade(hull, 2.2));
  // Superstructure toward the stern, a funnel behind it.
  const bridge = sx(0.22);
  p.rect(bridge - length * 0.09, waterline - h - 9, length * 0.18, 9, C("battleStar"));
  p.rect(bridge - length * 0.07, waterline - h - 13, length * 0.14, 4, C("battleStar"));
  for (let k = 0; k < 4; k++) p.rect(bridge - length * 0.06 + k * length * 0.035, waterline - h - 7, 2, 2, C("battleInk"));
  const funnel = sx(0.12);
  p.rect(funnel - 3, waterline - h - 19, 7, 10, shade(C("battleRoof"), 0.9));
  p.rect(funnel - 3, waterline - h - 16, 7, 2, C("battleStar"));
  p.rect(funnel - 3, waterline - h - 19, 7, 1, C("battleInk"));
  // Masts and derricks fore and aft of the holds.
  for (const k of [0.45, 0.78]) {
    const mx = sx(k);
    p.rect(mx, waterline - h - 26, 1, 26, C("battleSteelDark"));
    p.line(mx, waterline - h - 18, mx + bow * length * 0.12, waterline - h - 4, C("battleSteelDark"));
    p.rect(mx - length * 0.06, waterline - h - 3, length * 0.12, 3, shade(C("battleWood"), 0.8));
  }
  p.line(sx(0.45), waterline - h - 26, sx(0.78), waterline - h - 26, shade(C("battleSteelDark"), 1.2));
}

/** An iron mooring bollard on a quay. */
export function bollard(p: Painter, x: number, y: number): void {
  p.rect(x - 2, y - 3, 5, 4, C("battleSteelDark"));
  p.rect(x - 3, y - 4, 7, 2, C("battleSteelDark"));
  p.rect(x - 2, y - 4, 5, 1, C("battleSteel"));
}

/** A dockside gantry crane: two legs on the quay, a cab, and a jib reaching out to `reach` with a load swinging on the hook. */
export function harborCrane(p: Painter, x: number, base: number, top: number, reach: number, t: number): void {
  const steel = shade(C("battleBrass"), 0.85);
  const dark = shade(steel, 0.6);
  p.line(x - 8, base, x - 3, top + 8, steel, 2);
  p.line(x + 8, base, x + 3, top + 8, steel, 2);
  for (let y = top + 16; y < base - 4; y += 12) p.line(x - 7 + (base - y) * 0.15, y, x + 7 - (base - y) * 0.15, y + 6, dark);
  p.rect(x - 6, top, 12, 9, steel);
  p.rect(x - 4, top + 2, 4, 3, C("battleSkyLow"));
  p.line(x, top, reach, top - 10, steel, 2);
  p.line(x, top - 8, reach, top - 10, dark);
  p.rect(x - 2, top - 12, 4, 4, dark);
  // The hook line swings gently; a crate in a cargo net hangs from it.
  const sway = Math.sin(t / 700) * 3;
  const hookX = reach + (reach < x ? 6 : -6);
  const hookY = top + 34;
  p.line(hookX, top - 9, hookX + sway, hookY, C("battleInk"));
  p.rect(hookX + sway - 5, hookY, 11, 8, C("battleWood"));
  p.rect(hookX + sway - 5, hookY, 11, 1, shade(C("battleWood"), 1.25));
  p.line(hookX + sway - 5, hookY, hookX + sway, hookY - 4, C("battleInk"));
  p.line(hookX + sway + 5, hookY, hookX + sway, hookY - 4, C("battleInk"));
}

/** A few gulls wheeling over the water. */
export function gulls(p: Painter, x0: number, width: number, top: number, t: number): void {
  for (let i = 0; i < 3; i++) {
    const x = x0 + ((hash(i, 61) * width + t / (40 + i * 13)) % width);
    const y = top + hash(i, 67) * 30 + Math.sin(t / 500 + i * 2) * 4;
    const flap = Math.floor(t / 180 + i) % 2;
    p.px(x, y, C("battleStar"));
    p.px(x - 1, y - flap, C("battleStar"));
    p.px(x + 1, y - flap, C("battleStar"));
    p.px(x - 2, y - 1 + flap, C("battleStar"));
    p.px(x + 2, y - 1 + flap, C("battleStar"));
  }
}

/** Stacked cargo crates and oil drums on the quay. */
export function dockCargo(p: Painter, x: number, ground: number, seed: number): void {
  const wood = C("battleWood");
  p.rect(x, ground - 10, 14, 10, wood);
  p.rect(x + 14, ground - 8, 10, 8, shade(wood, 0.85));
  p.rect(x + 3, ground - 18, 12, 8, shade(wood, 1.1));
  for (const [bx, by, bw] of [[x, ground - 10, 14], [x + 14, ground - 8, 10], [x + 3, ground - 18, 12]] as const) {
    p.rect(bx, by, bw, 1, shade(wood, 1.3));
    p.line(bx + 1, by + 1, bx + bw - 2, by + 7, shade(wood, 0.7));
  }
  for (let k = 0; k < 2; k++) {
    const dx = x + 28 + k * 7;
    const drum = hash(seed, k) > 0.5 ? shade(C("battleSun"), 0.8) : C("battleOlive");
    p.rect(dx, ground - 9, 6, 9, drum);
    p.rect(dx, ground - 6, 6, 1, shade(drum, 0.7));
    p.rect(dx + 1, ground - 9, 1, 9, shade(drum, 1.3));
  }
}

/**
 * The Port seen from its quay, for battle scenes: the harbor water at the back with a breakwater and
 * lighthouse, a freighter moored alongside, a crane over it, and the quay's stone edge with bollards.
 * `quay` is where the quay's edge meets the water. `dir` points toward the half's middle.
 */
function portQuay(p: Painter, x0: number, quay: number, t: number, dir: 1 | -1): void {
  const outer = dir === 1 ? x0 : x0 + SCENE.half;
  const at = (local: number) => outer + dir * local;
  sky(p, x0, quay - 34, t, 2);
  water(p, x0, quay - 34, quay, t);
  breakwater(p, at(0), at(70), quay - 26);
  lighthouse(p, at(66), quay - 26, 26, t);
  freighter(p, at(116), quay - 2, 96, dir === 1 ? 1 : -1);
  harborCrane(p, at(168), quay + 6, quay - 64, at(130), t);
  gulls(p, x0, SCENE.half, SCENE.top + 8, t);
  // The quay's stone coping, with bollards along the edge.
  p.rect(x0, quay, SCENE.half, 3, shade(C("battleStone"), 0.7));
  p.rect(x0, quay, SCENE.half, 1, C("battleStone"));
  for (let local = 18; local < SCENE.half; local += 46) bollard(p, at(local), quay + 1);
}

/** Paved quay from `top` to the bottom of the half, with a dock railway and cargo by the edge. */
function quayPaving(p: Painter, x0: number, top: number): void {
  const stone = mix(C("battleConcrete"), C("battleStone"), 0.5);
  p.rect(x0, top, SCENE.half, SCENE.bottom - top, stone);
  for (let y = top + 7; y < SCENE.bottom; y += 7) p.rect(x0, y, SCENE.half, 1, shade(stone, 0.9));
  for (let i = 0; i < 40; i++) p.px(x0 + Math.floor(hash(i, x0, 79) * SCENE.half), top + 2 + Math.floor(hash(i, x0, 83) * (SCENE.bottom - top - 3)), shade(stone, 0.82));
  for (const ry of [top + 10, top + 15]) {
    p.rect(x0, ry, SCENE.half, 1, C("battleSteelDark"));
    p.rect(x0, ry - 1, SCENE.half, 1, C("battleSteel"));
  }
  for (let x = x0 + 2; x < x0 + SCENE.half; x += 6) p.rect(x, top + 9, 2, 7, shade(C("battleWood"), 0.7));
}

/**
 * A ship's view of the Port: open water in front, and across the basin the quay with a warehouse,
 * a crane and a freighter alongside, the breakwater and lighthouse further out.
 */
function portBasin(p: Painter, x0: number, t: number, dir: 1 | -1): void {
  const { horizon, bottom } = SCENE;
  const quay = horizon - 6;
  const outer = dir === 1 ? x0 : x0 + SCENE.half;
  const at = (local: number) => outer + dir * local;
  sky(p, x0, quay - 22, t, 2);
  water(p, x0, quay - 22, quay - 14, t);
  breakwater(p, at(0), at(56), quay - 16);
  lighthouse(p, at(52), quay - 16, 22, t);
  // The far quay: a stone wall, a warehouse with a pitched roof, a crane, a freighter alongside.
  p.rect(x0, quay - 14, SCENE.half, 14, shade(C("battleStone"), 0.8));
  p.rect(x0, quay - 14, SCENE.half, 1, C("battleStone"));
  const wx = Math.min(at(110), at(170));
  p.rect(wx, quay - 34, 60, 20, C("battleStone"));
  p.poly([[wx - 3, quay - 34], [wx + 30, quay - 44], [wx + 63, quay - 34]], shade(C("battleRoof"), 0.85));
  for (let k = 0; k < 4; k++) p.rect(wx + 6 + k * 14, quay - 28, 6, 8, C("battleInk"));
  harborCrane(p, at(92), quay - 14, quay - 62, at(64), t);
  freighter(p, at(70), quay, 70, dir === 1 ? 1 : -1);
  for (let local = 10; local < SCENE.half; local += 30) bollard(p, at(local), quay - 14);
  water(p, x0, quay, bottom, t);
  gulls(p, x0, SCENE.half, SCENE.top + 8, t);
}

/**
 * The capture scene's harbor (08-art-pipeline §19), drawn across the full width: sea and a
 * breakwater with its lighthouse at the back, a freighter moored at the quay with a crane working
 * over it, gulls, and the quay itself, paved and crossed by a dock railway, instead of open fields.
 */
export function drawHarbor(p: Painter, t: number): void {
  const quay = 170;
  sky(p, 0, 108, t, 3);
  sky(p, SCENE.half, 108, t, 3);
  water(p, 0, 108, quay, t, SCENE.width);
  breakwater(p, 0, 120, 118);
  lighthouse(p, 116, 118, 38, t);
  freighter(p, 112, quay - 3, 150, 1);
  harborCrane(p, 164, quay + 8, 86, 104, t);
  gulls(p, 0, SCENE.width, SCENE.top + 6, t);
  // The quay: stone paving, its coping along the water with bollards, the dock railway, mooring lines.
  const stone = mix(C("battleConcrete"), C("battleStone"), 0.5);
  p.rect(0, quay, SCENE.width, SCENE.bottom - quay, stone);
  for (let y = quay + 8; y < SCENE.bottom; y += 7) p.rect(0, y, SCENE.width, 1, shade(stone, 0.9));
  for (let i = 0; i < 70; i++) p.px(Math.floor(hash(i, 71) * SCENE.width), quay + 4 + Math.floor(hash(i, 73) * (SCENE.bottom - quay - 5)), shade(stone, 0.82));
  p.rect(0, quay, SCENE.width, 3, shade(C("battleStone"), 0.7));
  p.rect(0, quay, SCENE.width, 1, C("battleStone"));
  for (const bx of [24, 90, 150]) bollard(p, bx, quay + 2);
  p.line(24, quay - 2, 50, quay - 12, C("battleWood"));
  p.line(150, quay - 2, 168, quay - 14, C("battleWood"));
  for (const ry of [quay + 12, quay + 17]) {
    p.rect(0, ry, SCENE.width, 1, C("battleSteelDark"));
    p.rect(0, ry - 1, SCENE.width, 1, C("battleSteel"));
  }
  for (let x = 2; x < SCENE.width; x += 6) p.rect(x, quay + 11, 2, 7, shade(C("battleWood"), 0.7));
}

/** Brick hall with a sawtooth roof, chimney, water tower, gantry crane, yard and railway siding. */
function factory(p: Painter, x0: number, ground: number, t: number): void {
  const brick = shade(C("battleRoof"), 0.85);
  const brickLo = shade(brick, 0.75);
  const glass = mix(C("battleSkyLow"), C("battleSteel"), 0.35);
  // Back hall, lower.
  p.rect(x0 + 96, ground - 26, 64, 26, brickLo);
  for (let wx = x0 + 100; wx < x0 + 156; wx += 8) p.rect(wx, ground - 20, 4, 8, C("battleInk"));
  // Main hall with sawtooth roof: each tooth's steep face is glazed.
  const hx = x0 + 6;
  const hw = 104;
  const wall = 30;
  p.rect(hx, ground - wall, hw, wall, brick);
  for (let y = ground - wall + 3; y < ground; y += 3) p.rect(hx, y, hw, 1, brickLo);
  for (let i = 0; i < 5; i++) {
    const tx = hx + i * 21;
    p.poly([[tx, ground - wall], [tx + 21, ground - wall], [tx + 21, ground - wall - 12]], C("battleSteel"));
    p.rect(tx + 18, ground - wall - 11, 3, 11, glass);
    p.line(tx, ground - wall, tx + 21, ground - wall - 12, shade(C("battleSteel"), 1.2));
  }
  // Tall arched windows with mullions, and a loading door.
  for (let i = 0; i < 6; i++) {
    const wx = hx + 6 + i * 16;
    if (i === 3) continue;
    p.rect(wx, ground - wall + 7, 7, 14, C("battleInk"));
    p.rect(wx + 1, ground - wall + 6, 5, 1, C("battleInk"));
    p.rect(wx + 3, ground - wall + 7, 1, 14, brickLo);
    p.rect(wx, ground - wall + 13, 7, 1, brickLo);
    p.rect(wx + 1, ground - wall + 8, 2, 4, glass);
  }
  p.rect(hx + 52, ground - 19, 14, 19, shade(C("battleWood"), 0.6));
  for (let y = ground - 18; y < ground; y += 3) p.rect(hx + 52, y, 14, 1, shade(C("battleWood"), 0.45));
  p.rect(hx, ground - wall, hw, 2, brickLo);
  // Chimney with bands, and smoke billowing from it.
  const cx = x0 + 128;
  p.rect(cx, ground - 92, 9, 66, brick);
  p.rect(cx + 6, ground - 92, 3, 66, brickLo);
  for (const by of [ground - 90, ground - 70, ground - 50]) p.rect(cx - 1, by, 11, 2, C("battleSteelDark"));
  p.rect(cx - 1, ground - 94, 11, 3, C("battleSteelDark"));
  for (let k = 0; k < 6; k++) {
    const life = (t / 1600 + k / 6) % 1;
    const r = 4 + life * 10;
    p.disc(cx + 4 + life * 34, ground - 98 - life * 26, r, mix(C("battleSmokeDark"), C("battleSmoke"), life));
  }
  // Water tower on legs.
  const wtx = x0 + 160;
  p.line(wtx, ground, wtx + 3, ground - 40, C("battleSteelDark"));
  p.line(wtx + 16, ground, wtx + 13, ground - 40, C("battleSteelDark"));
  p.line(wtx + 1, ground - 12, wtx + 15, ground - 28, C("battleSteelDark"));
  p.line(wtx + 15, ground - 12, wtx + 1, ground - 28, C("battleSteelDark"));
  p.rect(wtx - 1, ground - 54, 18, 14, shade(C("battleWood"), 0.75));
  for (let x = wtx; x < wtx + 17; x += 3) p.px(x, ground - 47, shade(C("battleWood"), 0.5));
  p.poly([[wtx - 2, ground - 54], [wtx + 8, ground - 60], [wtx + 18, ground - 54]], C("battleSteel"));
  // Gantry crane over the yard.
  p.line(x0 + 84, ground + 10, x0 + 84, ground - 44, C("battleBrass"));
  p.line(x0 + 84, ground - 44, x0 + 124, ground - 44, C("battleBrass"));
  p.line(x0 + 106, ground - 44, x0 + 106, ground - 32, C("battleSteelDark"));
  p.rect(x0 + 103, ground - 32, 7, 4, C("battleSteelDark"));
  // Yard: crates, barrels, rails.
  for (let i = 0; i < 3; i++) {
    p.rect(x0 + 14 + i * 9, ground + 3, 8, 7, C("battleWood"));
    p.rect(x0 + 14 + i * 9, ground + 3, 8, 1, shade(C("battleWood"), 1.3));
  }
  for (let i = 0; i < 3; i++) p.rect(x0 + 150 + i * 6, ground + 4, 5, 7, i === 1 ? C("battleOlive") : C("battleSteel"));
  p.rect(x0, ground + 14, SCENE.half, 1, C("battleSteelDark"));
  p.rect(x0, ground + 18, SCENE.half, 1, C("battleSteelDark"));
  for (let x = x0; x < x0 + SCENE.half; x += 5) p.rect(x, ground + 13, 2, 7, shade(C("battleWood"), 0.6));
  p.rect(x0, ground + 14, SCENE.half, 1, C("battleSteel"));
  p.rect(x0, ground + 18, SCENE.half, 1, C("battleSteel"));
}

/** A concrete casemate behind a trench line: the fortification foot soldiers fight from. */
function fortification(p: Painter, x0: number, ground: number): void {
  const c = C("battleConcrete");
  p.poly([[x0 + 20, ground], [x0 + 28, ground - 30], [x0 + 150, ground - 30], [x0 + 160, ground]], c);
  p.rect(x0 + 28, ground - 30, 122, 3, shade(c, 1.15));
  p.poly([[x0 + 20, ground], [x0 + 28, ground - 30], [x0 + 34, ground - 30], [x0 + 30, ground]], shade(c, 0.75));
  for (const sx of [44, 84, 124]) {
    p.rect(x0 + sx, ground - 20, 20, 5, C("battleInk"));
    p.rect(x0 + sx - 1, ground - 15, 22, 1, shade(c, 1.2));
  }
  p.line(x0 + 60, ground - 30, x0 + 64, ground - 24, shade(c, 0.6));
  p.rect(x0 + 140, ground - 40, 2, 10, C("battleSteelDark"));
  // Camouflage netting draped over the roof.
  for (let x = x0 + 30; x < x0 + 148; x += 6) p.disc(x, ground - 31, 3, mix(C("battleTreeDark"), c, 0.3));
  // Barbed wire in front.
  for (let x = x0; x < x0 + SCENE.half; x += 12) {
    p.line(x, ground + 4, x, ground - 2, C("battleSteelDark"));
    p.line(x, ground - 1, x + 12, ground + 1, C("battleSteel"));
    p.line(x, ground + 2, x + 12, ground - 1, C("battleSteel"));
  }
}

/** The crest's top edge at local x (0 at the half's outer edge): highest in the middle of the half. */
export const crestAt = (local: number): number => SCENE.horizon + 24 - Math.sin((Math.max(0, Math.min(SCENE.half, local)) / SCENE.half) * Math.PI) * 22;

/**
 * Standing on a hilltop: the valley lies far below in the haze, with small fields, hedgerows, a
 * road and a village, and the near ground is the rounded, rocky crest the unit holds.
 */
function hilltop(p: Painter, x0: number, t: number): void {
  const valley = SCENE.horizon + 4;
  sky(p, x0, valley, t, 3);
  const haze = (c: string, k: number) => mix(c, C("battleSkyLow"), k);
  p.rect(x0, valley - 6, SCENE.half, 6, haze(C("battleHill"), 0.6));
  p.rect(x0, valley, SCENE.half, SCENE.bottom - valley, haze(C("battleGrass"), 0.45));
  // Patchwork fields with hedgerows between them, a road and a village far off.
  for (let row = 0; row < 4; row++) {
    const y = valley + row * 5;
    for (let x = 0; x < SCENE.half; x += 18 + row * 4) {
      const w = 14 + Math.floor(hash(x, row) * 8);
      p.rect(x0 + x + (row % 2) * 7, y + 1, w, 4, haze(hash(x, row, 3) > 0.5 ? C("battleGrassLight") : C("battleSand"), 0.5));
      p.rect(x0 + x + (row % 2) * 7, y, w, 1, haze(C("battleTreeDark"), 0.5));
    }
  }
  p.line(x0, valley + 18, x0 + SCENE.half, valley + 8, haze(C("battleRoad"), 0.4));
  for (let i = 0; i < 4; i++) {
    const vx = x0 + 120 + i * 6;
    p.rect(vx, valley + 6, 4, 3, haze(C("battleStone"), 0.35));
    p.px(vx + 1, valley + 5, haze(C("battleRoof"), 0.35));
  }
  // The crest: grass bending over the top, shaded toward the slopes, rocks and boulders.
  const grassC = C("battleGrass");
  for (let local = 0; local < SCENE.half; local++) {
    const top = Math.round(crestAt(local));
    const slope = Math.abs(local - SCENE.half / 2) / (SCENE.half / 2);
    p.rect(x0 + local, top, 1, SCENE.bottom - top, shade(grassC, 1 - slope * 0.12));
    p.px(x0 + local, top, C("battleGrassLight"));
    if (local % 3 === 0) p.px(x0 + local, top - 1, C("battleGrassLight"));
  }
  for (let i = 0; i < 90; i++) {
    const local = Math.floor(hash(i, x0, 41) * SCENE.half);
    const y = Math.round(crestAt(local)) + 3 + Math.floor(hash(i, x0, 43) * (SCENE.bottom - crestAt(local) - 4));
    p.px(x0 + local, y, hash(i, 47) > 0.5 ? C("battleGrassLight") : C("battleGrassDark"));
  }
  for (let i = 0; i < 6; i++) {
    const local = 12 + i * 32 + hash(i, 53) * 10;
    const y = Math.round(crestAt(local)) + 6 + (i % 3) * 14;
    const r = 3 + hash(i, 59) * 3;
    p.ellipse(x0 + local, y, r + 1, r * 0.7, C("battleConcrete"));
    p.ellipse(x0 + local - 1, y - 1, r * 0.6, r * 0.4, shade(C("battleConcrete"), 1.2));
  }
}

export function backdropView(air: boolean, naval: boolean, submerged: boolean, terrain: TerrainId): BackdropView {
  if (air) return "air";
  if (submerged) return "underwater";
  if (naval) return terrain === "beach" ? "shore" : "sea";
  return "land";
}

/** Where the waterline meets the sand on a shore, from the half's outer edge (it slants with depth). */
export const shoreline = (y: number): number => 64 + (y - SCENE.horizon) * 0.35;

/** `dir` is 1 for the left half and -1 for the right, so a shore faces the enemy. */
export function drawBackdrop(p: Painter, x0: number, terrain: TerrainId, view: BackdropView, t: number, dir: 1 | -1): void {
  const { horizon, bottom } = SCENE;
  if (view === "underwater") {
    for (let i = 0; i < 8; i++) {
      const y = SCENE.top + Math.floor(((bottom - SCENE.top) * i) / 8);
      p.rect(x0, y, SCENE.half, 26, mix(C("battleSea"), C("battleSeaDeep"), i / 7));
    }
    p.rect(x0, SCENE.top, SCENE.half, 3, C("battleSeaLight"));
    for (let i = 0; i < 5; i++) {
      const x = x0 + 20 + i * 38;
      p.line(x, SCENE.top + 3, x - 30, bottom - 40, mix(C("battleSea"), C("battleSeaLight"), 0.35));
    }
    for (let i = 0; i < 12; i++) {
      const x = x0 + hash(i, 23) * SCENE.half;
      const y = bottom - ((t / 20 + hash(i, 29) * 200) % (bottom - SCENE.top));
      p.px(x, y, C("battleFoam"));
    }
    return;
  }
  if (view === "air") {
    sky(p, x0, bottom, t, 5);
    if (terrain === "sea" || terrain === "reef") {
      // Low over the sea: the water fills the bottom of the half, close enough for a Torpedo
      // Bomber's run to skim it (a hazy line where it meets the sky).
      water(p, x0, bottom - AIR_SEA_BAND, bottom, t);
      p.rect(x0, bottom - AIR_SEA_BAND - 1, SCENE.half, 1, mix(C("battleSea"), C("battleSkyLow"), 0.5));
      return;
    }
    const ground = terrain === "beach" ? C("battleSand") : C("battleGrassDark");
    p.rect(x0, bottom - 10, SCENE.half, 10, mix(ground, C("battleSkyLow"), 0.45));
    return;
  }
  if (view === "shore") {
    // Sea toward the half's outer edge, sand toward the middle, foam along the waterline.
    sky(p, x0, horizon - 6, t, 3);
    water(p, x0, horizon - 6, bottom, t);
    const sand = C("battleSand");
    for (let y = horizon - 6; y < bottom; y++) {
      const edge = Math.round(shoreline(y));
      const width = SCENE.half - edge;
      const x = dir === 1 ? x0 + edge : x0;
      p.rect(x, y, width, 1, y % 7 === 0 ? shade(sand, 0.92) : sand);
      const wet = dir === 1 ? x0 + edge : x0 + width - 4;
      p.rect(wet, y, 4, 1, shade(sand, 0.8));
      const foamAt = dir === 1 ? x0 + edge - 3 + (Math.floor(t / 250 + y / 9) % 2) : x0 + width + 1 - (Math.floor(t / 250 + y / 9) % 2);
      p.rect(foamAt, y, 2, 1, C("battleFoam"));
    }
    // Beach obstacles on the sand.
    for (let i = 0; i < 2; i++) {
      const local = 150 + i * 22;
      const hx = dir === 1 ? x0 + local : x0 + SCENE.half - local;
      const gy = horizon + 20 + i * 30;
      p.line(hx - 5, gy - 10, hx + 5, gy, C("battleSteelDark"), 2);
      p.line(hx + 5, gy - 10, hx - 5, gy, C("battleSteelDark"), 2);
    }
    return;
  }
  if (view === "sea" && terrain === "port") {
    // A ship in port lies alongside the quay: warehouses, cranes and a freighter on the far side of
    // the basin, the breakwater and its lighthouse beyond (08-art-pipeline §18).
    portBasin(p, x0, t, dir);
    return;
  }
  if (view === "sea" || terrain === "sea" || terrain === "reef") {
    sky(p, x0, horizon - 6, t, 3);
    water(p, x0, horizon - 6, bottom, t);
    if (terrain === "reef") {
      for (let i = 0; i < 4; i++) {
        const x = x0 + 18 + i * 48 + hash(i, 31) * 12;
        p.ellipse(x, horizon + 4 + i * 3, 9, 5, C("battleSteel"));
        p.rect(x - 9, horizon + 6 + i * 3, 18, 1, C("battleFoam"));
      }
    }
    return;
  }

  // Land.
  if (terrain === "hills") {
    hilltop(p, x0, t);
    return;
  }
  sky(p, x0, horizon, t, 3);
  const base = terrain === "beach" ? C("battleSand") : terrain === "bunker" || terrain === "rubble" || terrain === "obstacle" ? mix(C("battleDirt"), C("battleGrass"), 0.4) : C("battleGrass");
  switch (terrain) {
    case "forest":
      treeline(p, x0, horizon, 14, true);
      for (let i = 0; i < 6; i++) tree(p, x0 + 10 + i * 34 + hash(i, 41) * 10, horizon + 8, 70 + hash(i, 43) * 20);
      break;
    case "bocage":
      treeline(p, x0, horizon - 22, 10, false);
      p.rect(x0, horizon - 22, SCENE.half, 16, C("battleTreeDark"));
      for (let x = 0; x < SCENE.half; x += 7) p.disc(x0 + x, horizon - 9, 5 + hash(x, 47) * 3, C("battleTree"));
      p.rect(x0, horizon - 4, SCENE.half, 4, C("battleDirt"));
      break;
    case "city":
    case "hq":
      treeline(p, x0, horizon, 9, true);
      for (let i = 0; i < 5; i++) house(p, x0 + 4 + i * 38, horizon, 26 + hash(i, 53) * 8, 22 + hash(i, 59) * 16, i);
      if (terrain === "hq") {
        p.rect(x0 + 70, horizon - 64, 12, 30, C("battleStone"));
        p.poly([[x0 + 68, horizon - 64], [x0 + 76, horizon - 78], [x0 + 84, horizon - 64]], C("battleRoof"));
      }
      break;
    case "factory":
      treeline(p, x0, horizon, 9, true);
      break;
    case "airfield":
      treeline(p, x0, horizon, 9, true);
      p.ellipse(x0 + 70, horizon, 50, 28, C("battleSteel"));
      p.rect(x0 + 20, horizon - 1, 100, 1, C("battleSteelDark"));
      p.rect(x0 + 150, horizon - 30, 1, 30, C("battleSteelDark"));
      p.rect(x0 + 151, horizon - 30, 8, 3, C("battleFire"));
      break;
    case "port":
      // Standing on the quay, with the harbor behind; the paving replaces the grass below.
      portQuay(p, x0, horizon, t, dir);
      quayPaving(p, x0, horizon + 3);
      return;
    case "beach":
      water(p, x0, horizon - 12, horizon + 14, t);
      p.rect(x0, horizon + 12, SCENE.half, 2, C("battleFoam"));
      break;
    case "river":
    case "bridge":
      treeline(p, x0, horizon - 10, 10, true);
      water(p, x0, horizon - 10, horizon + 2, t);
      break;
    case "bunker":
      treeline(p, x0, horizon, 9, true);
      break;
    default:
      treeline(p, x0, horizon, 9, true);
      treeline(p, x0 + 5, horizon + 2, 6, false);
  }
  const groundTop = terrain === "beach" ? horizon + 14 : horizon;
  grass(p, x0, groundTop, base);
  if (terrain === "factory") factory(p, x0, horizon, t);
  if (terrain === "bunker") fortification(p, x0, horizon + 18);
  if (terrain === "beach") {
    p.rect(x0, groundTop, SCENE.half, 3, shade(C("battleSand"), 0.85));
    for (let i = 0; i < 3; i++) {
      const hx = x0 + 30 + i * 60;
      p.line(hx - 5, groundTop + 2, hx + 5, groundTop + 12, C("battleSteelDark"), 2);
      p.line(hx + 5, groundTop + 2, hx - 5, groundTop + 12, C("battleSteelDark"), 2);
    }
  }
  if (terrain === "road" || terrain === "bridge" || terrain === "city" || terrain === "hq" || terrain === "airfield") {
    const surface = terrain === "airfield" ? C("battleSteel") : terrain === "bridge" ? C("battleStone") : C("battleRoad");
    p.rect(x0, horizon + 4, SCENE.half, 16, surface);
    p.rect(x0, horizon + 9, SCENE.half, 1, shade(surface, 0.85));
    p.rect(x0, horizon + 15, SCENE.half, 1, shade(surface, 0.85));
    if (terrain === "bridge") p.rect(x0, horizon + 2, SCENE.half, 3, shade(C("battleStone"), 0.75));
  }
  if (terrain === "forest") {
    for (let i = 0; i < 4; i++) p.disc(x0 + 20 + i * 52, SCENE.bottom - 2, 9, C("battleTreeDark"));
  }
  if (terrain === "rubble" || terrain === "obstacle") {
    for (let i = 0; i < 6; i++) {
      const x = x0 + 10 + i * 32;
      if (terrain === "obstacle") p.poly([[x, horizon + 6], [x + 5, horizon - 6], [x + 10, horizon + 6]], C("battleConcrete"));
      else p.rect(x, horizon - 3 + (i % 2) * 3, 12, 6, C("battleConcrete"));
    }
  }
}
