// Battle figures on foot (08-art-pipeline §18): rifle squads, bazooka and Panzerschreck teams, and
// mortar crews. A standing soldier is about 44 pixels tall, nearly three map squares, so helmets,
// weapons and webbing read clearly: the US M1 helmet, Garand, Thompson and BAR; the German
// Stahlhelm, Kar98k, MP 40 and MG 42; the Japanese Type 90 helmet with its neck flaps, the Arisaka with
// its long bayonet, the Type 100 and the Type 99 light machine gun.

import { fallAt, FALL_MS } from "./fall";
import { squadWeapon } from "./plan";
import { C, mix, shade, type Painter } from "./paint";
import { FIRE_TIMING, figureTiming } from "./timeline";
import { along, justFired, kick, kitOf, lerp, seg, type Look, type Muzzle, type Pose, type Pt, type Rig } from "./rig";

export type Stance = "stand" | "kneel" | "crouch" | "run";

/**
 * Draws one man, who may have been hit (`down` ms ago): he topples backwards about his feet at
 * `footX` and fades, without taking the gear around him along (fall.ts). `facing` -1 for a man
 * facing left, who falls the other way.
 */
function falling(p: Painter, down: number | undefined, footX: number, draw: () => void, o: { facing?: 1 | -1; prone?: boolean } = {}): void {
  if (down === undefined) {
    draw();
    return;
  }
  if (down > FALL_MS) return;
  const f = fallAt(down, o.prone ?? false);
  const { ctx } = p;
  ctx.save();
  ctx.globalAlpha *= f.alpha;
  ctx.translate(footX, f.sink);
  ctx.rotate(-f.angle * (o.facing ?? 1));
  ctx.translate(-footX, 0);
  draw();
  ctx.restore();
}

export interface Frame {
  readonly top: number;
  readonly hip: number;
  readonly lean: number;
  /** Top-left of the face, which is 6 wide and 7 tall. */
  readonly head: Pt;
  readonly backShoulder: Pt;
  readonly frontShoulder: Pt;
}

export function soldierFrame(x: number, y: number, stance: Stance, lean = 0): Frame {
  const hip = y - (stance === "stand" ? 17 : stance === "run" ? 16 : stance === "kneel" ? 12 : 9);
  const top = hip - (stance === "crouch" ? 11 : 14);
  const l = lean + (stance === "crouch" ? 3 : stance === "run" ? 3 : 0);
  return {
    top,
    hip,
    lean: l,
    head: { x: x - 2 + l, y: top - 8 },
    backShoulder: { x: x - 1 + l, y: top + 3 },
    frontShoulder: { x: x + 3 + l, y: top + 4 },
  };
}

/** A sleeve from the shoulder to the hand, bent at the elbow, and the hand. */
function arm(p: Painter, from: Pt, to: Pt, cloth: string): void {
  const elbow = { x: (from.x + to.x) / 2 - 1, y: Math.max(from.y, to.y) + 2 };
  p.line(from.x, from.y, elbow.x, elbow.y, cloth, 3);
  p.line(elbow.x, elbow.y, to.x, to.y, cloth, 3);
  p.rect(to.x - 1, to.y - 1, 3, 3, C("battleSkin"));
  p.px(to.x - 1, to.y + 1, shade(C("battleSkin"), 0.8));
}

/**
 * A card suit on a 101st Airborne paratrooper's helmet, as its regiments marked theirs: 0 spade,
 * 1 heart, 2 diamond, 3 club. Always white; only the shape changes (08-art-pipeline §17).
 */
const SUITS: readonly (readonly string[])[] = [
  ["..#..", ".###.", "#####", "..#.."],
  [".#.#.", "#####", ".###.", "..#.."],
  ["..#..", ".###.", ".###.", "..#.."],
  [".###.", "#####", ".###.", "..#.."],
];

function suit(p: Painter, x: number, y: number, which: number): void {
  const rows = SUITS[((which % 4) + 4) % 4] ?? SUITS[0] ?? [];
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) if (row[dx] === "#") p.px(x + dx, y + dy, C("battleStar"));
  });
}

/** A soldier's steel helmet over a face whose top-left is (hx, hy): M1, Stahlhelm or Type 90. */
export function helmet(p: Painter, hx: number, hy: number, look: Look): void {
  const t = look.team;
  if (look.nation === "japan") {
    // Type 90: a low round dome with a narrow rim, and the cloth neck flaps of the cap under it
    // hanging down behind the ears.
    const flap = mix(t.cloth, C("battleSand"), 0.3);
    p.rect(hx - 3, hy - 2, 4, 7, flap);
    p.rect(hx - 3, hy + 4, 3, 1, shade(flap, 0.8));
    p.px(hx - 1, hy + 1, shade(flap, 0.8));
    p.px(hx - 1, hy + 3, shade(flap, 0.8));
    p.rect(hx, hy - 6, 6, 1, t.lo);
    p.rect(hx - 1, hy - 5, 8, 2, t.lo);
    p.rect(hx - 2, hy - 3, 9, 1, t.lo);
    p.rect(hx - 2, hy - 2, 10, 1, t.deep);
    p.rect(hx + 1, hy - 6, 3, 1, t.mid);
    p.px(hx, hy - 5, t.mid);
    p.px(hx + 1, hy + 3, C("battleLeather"));
    p.px(hx + 2, hy + 4, C("battleLeather"));
  } else if (look.nation === "germany") {
    // Stahlhelm: a tall crown, a short visor, and a skirt that flares over the ears and neck.
    p.rect(hx, hy - 7, 6, 1, t.lo);
    p.rect(hx - 1, hy - 6, 8, 3, t.lo);
    p.rect(hx - 2, hy - 3, 9, 1, t.lo);
    p.rect(hx + 6, hy - 2, 2, 1, t.lo);
    p.rect(hx - 3, hy - 2, 4, 4, t.lo);
    p.px(hx - 4, hy + 1, t.lo);
    p.px(hx - 4, hy + 2, t.deep);
    p.rect(hx, hy - 7, 4, 1, t.mid);
    p.px(hx - 1, hy - 5, t.mid);
    p.px(hx + 1, hy - 4, t.deep);
    p.rect(hx - 3, hy - 3, 10, 1, t.deep);
  } else {
    // M1: a rounded dome, widest at the rim, with netting and a loose chinstrap.
    p.rect(hx, hy - 6, 6, 1, t.lo);
    p.rect(hx - 1, hy - 5, 8, 1, t.lo);
    p.rect(hx - 2, hy - 4, 10, 2, t.lo);
    p.rect(hx - 3, hy - 2, 12, 1, t.deep);
    p.rect(hx + 1, hy - 6, 3, 1, t.mid);
    p.rect(hx, hy - 5, 2, 1, t.mid);
    for (const [dx, dy] of [[2, -4], [5, -4], [0, -3], [3, -5], [6, -3]] as const) p.px(hx + dx, hy + dy, t.deep);
    p.px(hx, hy + 1, C("battleLeather"));
    p.px(hx, hy + 2, C("battleLeather"));
    p.px(hx + 1, hy + 3, C("battleLeather"));
    if (look.paratrooper) {
      // Helmet net with burlap scrim tufts, and the regiment's card suit on the side.
      for (const [dx, dy] of [[-1, -5], [4, -6], [7, -4], [-2, -3]] as const) p.px(hx + dx, hy + dy, C("battleSand"));
      suit(p, hx + 1, hy - 5, look.suit);
    }
  }
}

export interface SoldierOptions {
  readonly lean?: number;
  /** Where the hands are; arms hang at the sides if left out. */
  readonly front?: Pt;
  readonly back?: Pt;
  /** Cheek on the stock while aiming. */
  readonly headDx?: number;
  /** Drawn between the body and the front arm, so the near hand holds it. */
  readonly weapon?: () => void;
  /** Running: which of the four steps of the stride the legs are in. */
  readonly stride?: number;
}

/** Running legs, step by step: the near leg's knee and foot, then the far leg's, from the hip. */
const STRIDE: readonly (readonly [number, number, number, number, number, number, number, number])[] = [
  [5, 8, 9, 0, -3, 9, -10, -5],
  [4, 8, 3, 0, -1, 10, -5, -8],
  [-3, 9, -10, -5, 5, 8, 9, 0],
  [-1, 10, -5, -8, 4, 8, 3, 0],
];

/** The uniform's two shades. Paratroopers wear the tan M1942 jump suit, toned with the team color. */
function uniform(look: Look): { cloth: string; clothLo: string } {
  const t = look.team;
  if (!look.paratrooper) return { cloth: t.cloth, clothLo: t.clothLo };
  return { cloth: mix(t.cloth, C("battleSand"), 0.45), clothLo: mix(t.clothLo, C("battleSand"), 0.35) };
}

/** One soldier facing right with feet at (x, y). */
export function drawSoldier(p: Painter, x: number, y: number, stance: Stance, look: Look, o: SoldierOptions = {}): Frame {
  const f = soldierFrame(x, y, stance, o.lean ?? 0);
  const t = look.team;
  const para = look.paratrooper;
  const { cloth, clothLo } = uniform(look);
  const skin = C("battleSkin");
  const boot = C("battleRubber");
  const de = look.nation === "germany";
  const jp = look.nation === "japan";
  const webbing = de || jp ? C("battleLeather") : mix(C("battleSand"), C("battleOlive"), 0.35);
  const l = f.lean;
  // Japanese puttees: cloth wound round the shin, its turns showing as slanted lines.
  const puttees = (lx: number, ly: number, h: number) => {
    p.rect(lx, ly, 5, h, cloth);
    for (let k = 1; k < h; k += 2) p.line(lx, ly + k + 1, lx + 4, ly + k, clothLo);
  };

  arm(p, f.backShoulder, o.back ?? { x: f.backShoulder.x - 1, y: f.hip + 1 }, clothLo);

  // Legs and boots: German jackboots, US canvas leggings over brown boots.
  const leggings = (lx: number, ly: number, h: number) => {
    p.rect(lx, ly, 5, h, C("battleSand"));
    for (let k = 1; k < h; k += 2) p.px(lx + 4, ly + k, shade(C("battleSand"), 0.75));
  };
  if (stance === "stand") {
    p.rect(x - 4, f.hip, 5, y - f.hip, clothLo);
    p.rect(x + 1, f.hip, 5, y - f.hip, cloth);
    p.px(x + 5, f.hip + 8, shade(cloth, 0.85));
    p.rect(x - 5, y - 4, 6, 4, boot);
    p.rect(x + 1, y - 4, 8, 4, boot);
    p.rect(x + 1, y - 1, 8, 1, shade(boot, 1.6));
    if (de) {
      p.rect(x - 4, y - 11, 5, 7, boot);
      p.rect(x + 1, y - 11, 5, 7, boot);
      p.px(x + 2, y - 10, shade(boot, 2));
    } else if (jp) {
      puttees(x + 1, y - 10, 6);
      p.rect(x - 4, y - 9, 5, 5, clothLo);
    } else if (para) {
      // Brown jump boots laced high, a knife strapped to one, and a bulging cargo pocket.
      p.rect(x - 4, y - 10, 5, 6, C("battleLeather"));
      p.rect(x + 1, y - 10, 5, 6, C("battleLeather"));
      for (let k = 0; k < 3; k++) p.px(x + 4, y - 9 + k * 2, shade(C("battleLeather"), 1.5));
      p.rect(x + 1, y - 9, 1, 4, C("battleSteel"));
      p.rect(x + 1, f.hip + 3, 6, 6, clothLo);
      p.rect(x + 1, f.hip + 3, 6, 1, cloth);
    } else {
      leggings(x + 1, y - 10, 6);
      p.rect(x - 4, y - 9, 5, 5, shade(C("battleSand"), 0.8));
    }
  } else if (stance === "run") {
    const step = STRIDE[(((o.stride ?? 0) % 4) + 4) % 4] ?? STRIDE[0];
    if (step) {
      const [nkx, nky, nfx, nfy, fkx, fky, ffx, ffy] = step;
      const leg = (kx: number, ky: number, fx: number, fy: number, color: string) => {
        p.line(x, f.hip + 1, x + kx, f.hip + ky, color, 5);
        p.line(x + kx, f.hip + ky, x + fx, y - 3 + fy, color, 4);
        const bootColor = para ? C("battleLeather") : boot;
        p.rect(x + fx - 2, y - 4 + fy, 7, 4, bootColor);
        if (jp) p.line(x + fx - 1, y - 6 + fy, x + fx + 2, y - 7 + fy, clothLo);
        else if (!de && !para) p.rect(x + fx - 1, y - 8 + fy, 4, 4, C("battleSand"));
      };
      leg(fkx, fky, ffx, ffy, clothLo);
      leg(nkx, nky, nfx, nfy, cloth);
    }
  } else if (stance === "kneel") {
    p.rect(x - 5, f.hip, 5, y - 4 - f.hip, clothLo);
    p.rect(x - 15, y - 4, 12, 4, clothLo);
    p.rect(x - 19, y - 5, 4, 5, boot);
    p.rect(x, f.hip, 10, 5, cloth);
    p.rect(x + 6, f.hip + 4, 5, y - 4 - (f.hip + 4), cloth);
    p.rect(x + 6, y - 4, 9, 4, boot);
    p.rect(x + 6, y - 1, 9, 1, shade(boot, 1.6));
    if (de) p.rect(x + 6, y - 9, 5, 5, boot);
    else if (jp) puttees(x + 6, y - 9, 5);
    else if (para) {
      p.rect(x + 6, y - 9, 5, 5, C("battleLeather"));
      p.rect(x + 2, f.hip + 1, 6, 4, clothLo);
    } else leggings(x + 6, y - 9, 5);
  } else {
    p.rect(x - 5, f.hip + 1, 5, y - f.hip - 4, clothLo);
    p.rect(x - 4, f.hip, 13, 4, cloth);
    p.rect(x + 4, f.hip + 3, 5, y - f.hip - 6, cloth);
    p.rect(x - 6, y - 3, 6, 3, boot);
    p.rect(x + 4, y - 3, 8, 3, boot);
  }

  // Kit on the back. US: pack with a blanket roll, an entrenching tool, a canteen.
  // Germany: the fluted gas-mask canister, a bread bag and a spade. Japan: a small pack with the
  // blanket rolled in a horseshoe over it, and a canteen.
  if (jp) {
    p.rect(x - 9 + l, f.top + 3, 4, 9, clothLo);
    p.rect(x - 10 + l, f.top + 1, 5, 2, mix(C("battleSand"), cloth, 0.5));
    p.rect(x - 10 + l, f.top + 1, 1, 8, mix(C("battleSand"), cloth, 0.5));
    p.rect(x - 9 + l, f.hip - 5, 3, 5, mix(C("battleKhaki"), C("battleSteel"), 0.4));
    p.px(x - 8 + l, f.hip - 6, C("battleInk"));
  } else if (de) {
    p.rect(x - 9 + l, f.top + 4, 4, 11, C("battleSteel"));
    for (let k = 1; k < 11; k += 2) p.rect(x - 9 + l, f.top + 4 + k, 4, 1, C("battleSteelDark"));
    p.rect(x - 8 + l, f.hip - 4, 4, 6, C("battleOlive"));
    p.line(x - 6 + l, f.hip, x - 9 + l, f.hip + 6, C("battleWood"), 2);
    p.rect(x - 10 + l, f.hip + 5, 3, 3, C("battleSteelDark"));
  } else if (para) {
    // A musette bag high on the back, an entrenching tool, a gas mask bag at the hip.
    p.rect(x - 9 + l, f.top + 2, 4, 7, mix(C("battleOlive"), C("battleSand"), 0.4));
    p.rect(x - 9 + l, f.top + 2, 4, 1, shade(C("battleOlive"), 1.2));
    p.rect(x - 9 + l, f.top + 10, 3, 4, C("battleSteel"));
    p.rect(x - 8 + l, f.hip - 5, 4, 5, C("battleOlive"));
  } else {
    p.rect(x - 9 + l, f.top + 2, 4, 10, clothLo);
    p.rect(x - 10 + l, f.top + 1, 5, 3, C("battleSand"));
    p.px(x - 9 + l, f.top + 2, shade(C("battleSand"), 0.75));
    p.rect(x - 9 + l, f.top + 12, 3, 4, C("battleSteel"));
    p.line(x - 8 + l, f.top + 11, x - 8 + l, f.top + 7, C("battleWood"));
    p.rect(x - 8 + l, f.hip - 5, 3, 5, mix(C("battleOlive"), C("battleSand"), 0.4));
  }

  // Torso: jacket, collar, pockets, belt and webbing.
  const h = f.hip - f.top;
  const tx = x - 5 + l;
  p.rect(tx, f.top, 11, h, cloth);
  p.rect(tx, f.top, 3, h, clothLo);
  p.rect(tx + 3, f.top, 7, 1, shade(cloth, 1.2));
  p.rect(tx + 5, f.top, 5, 2, de ? t.deep : clothLo);
  p.rect(tx + 6, f.top + 4, 4, 1, clothLo);
  p.px(tx + 8, f.top + 5, t.deep);
  if (de) p.rect(tx + 6, f.hip - 6, 4, 1, clothLo);
  p.rect(tx, f.hip - 2, 11, 2, webbing);
  p.px(tx + 8, f.hip - 2, C("battleSteel"));
  if (de) {
    // Y-straps, three-cell ammunition pouches, and a stick grenade tucked in the belt.
    p.line(tx + 3, f.top + 1, tx + 8, f.hip - 3, webbing);
    p.rect(tx + 5, f.hip - 5, 5, 3, webbing);
    p.px(tx + 6, f.hip - 5, shade(webbing, 1.5));
    p.line(tx + 2, f.hip - 1, tx + 2, f.hip - 9, C("battleWood"));
    p.rect(tx + 1, f.hip - 12, 3, 4, C("battleSteelDark"));
  } else if (jp) {
    // Two leather cartridge boxes on the front of the belt, and the bayonet's scabbard at the hip.
    p.rect(tx + 3, f.hip - 4, 3, 2, webbing);
    p.rect(tx + 7, f.hip - 4, 3, 2, webbing);
    p.px(tx + 4, f.hip - 4, shade(webbing, 1.5));
    p.line(tx + 1, f.hip - 1, tx - 1, f.hip + 6, shade(webbing, 0.8), 2);
  } else {
    // Suspenders, cartridge belt pockets, and a grenade hooked on the strap.
    p.line(tx + 4, f.top + 1, tx + 4, f.hip - 3, webbing);
    for (let k = 0; k < 3; k++) p.rect(tx + 3 + k * 3, f.hip - 4, 2, 2, webbing);
    p.rect(tx + 5, f.top + 6, 2, 3, C("battleOlive"));
  }

  // Head: face, eye, nose, ear, a shadow under the helmet.
  const hx = f.head.x + (o.headDx ?? 0);
  const hy = f.head.y;
  const skinLo = shade(skin, 0.8);
  p.rect(hx + 1, hy + 7, 4, 1, skinLo);
  p.rect(hx, hy, 6, 7, skin);
  p.rect(hx, hy, 6, 1, skinLo);
  p.rect(hx, hy + 1, 2, 2, shade(C("battleWood"), 0.6));
  p.px(hx + 1, hy + 3, skinLo);
  p.px(hx + 4, hy + 2, C("battleInk"));
  p.px(hx + 4, hy + 1, skinLo);
  p.px(hx + 6, hy + 3, skin);
  p.px(hx + 6, hy + 4, skinLo);
  p.rect(hx + 3, hy + 5, 2, 1, skinLo);
  helmet(p, hx, hy, look);

  o.weapon?.();
  arm(p, f.frontShoulder, o.front ?? { x: f.frontShoulder.x + 1, y: f.hip + 1 }, cloth);
  return f;
}

/** A soldier facing left: drawn mirrored about his own feet. Hands are given in scene coordinates. */
export function drawSoldierFacingLeft(p: Painter, x: number, y: number, stance: Stance, look: Look, o: SoldierOptions = {}): Frame {
  const flip = (pt: Pt | undefined) => (pt ? { x: 2 * x - pt.x, y: pt.y } : undefined);
  const front = flip(o.front);
  const back = flip(o.back);
  p.ctx.save();
  p.ctx.translate(2 * x, 0);
  p.ctx.scale(-1, 1);
  const f = drawSoldier(p, x, y, stance, look, {
    ...(o.lean === undefined ? {} : { lean: o.lean }),
    ...(o.headDx === undefined ? {} : { headDx: o.headDx }),
    ...(front ? { front } : {}),
    ...(back ? { back } : {}),
  });
  p.ctx.restore();
  return { ...f, head: { x: 2 * x - f.head.x - 6, y: f.head.y } };
}

/** Hands over the ears, for a crewman ducking from the blast. */
export function earsCovered(f: Frame): SoldierOptions {
  return { back: { x: f.head.x + 1, y: f.head.y + 3 }, front: { x: f.head.x + 6, y: f.head.y + 3 } };
}

// ---- Small arms ----

export type GunKind = "garand" | "kar98" | "carbine" | "thompson" | "mp40" | "bar" | "mg42" | "arisaka" | "type100" | "type99";

/** Each gun's length from butt to muzzle, and where the hands go on it. */
export const GUN: Record<GunKind, { readonly length: number; readonly trigger: number; readonly fore: number }> = {
  garand: { length: 30, trigger: 10, fore: 19 },
  kar98: { length: 32, trigger: 10, fore: 20 },
  carbine: { length: 23, trigger: 8, fore: 15 },
  thompson: { length: 26, trigger: 9, fore: 19 },
  mp40: { length: 22, trigger: 9, fore: 14 },
  bar: { length: 33, trigger: 10, fore: 19 },
  mg42: { length: 32, trigger: 8, fore: 14 },
  arisaka: { length: 31, trigger: 10, fore: 20 },
  type100: { length: 24, trigger: 9, fore: 16 },
  type99: { length: 31, trigger: 9, fore: 15 },
};

/** The bolt-action rifles, whose firer works the bolt between shots. */
const BOLT_ACTION: readonly GunKind[] = ["kar98", "arisaka"];

/** A long arm with its butt at (x, y), pointing along `angle`. Returns the muzzle. */
export function drawGun(p: Painter, x: number, y: number, angle: number, kind: GunKind, look: Look, recoil = 0): Pt {
  const de = look.nation === "germany";
  const wood = de ? shade(C("battleWood"), 0.72) : C("battleWood");
  const woodHi = shade(wood, 1.25);
  const steel = C("battleSteelDark");
  const steelHi = C("battleSteel");
  const base = along(x, y, angle, -recoil);
  const cos = Math.cos(angle);
  const sin = Math.sin(angle);
  /** A point `d` along the gun and `off` below its line. */
  const q = (d: number, off = 0): Pt => ({ x: base.x + cos * d - sin * off, y: base.y + sin * d + cos * off });
  const seg2 = (d0: number, d1: number, width: number, color: string, off = 0) => {
    const a = q(d0, off);
    const b = q(d1, off);
    p.line(a.x, a.y, b.x, b.y, color, width);
  };
  const dot = (d: number, off: number, color: string) => {
    const a = q(d, off);
    p.px(a.x, a.y, color);
  };
  switch (kind) {
    case "garand":
    case "kar98":
    case "arisaka":
    case "carbine": {
      const long = kind === "kar98" || kind === "arisaka";
      const end = GUN[kind].length;
      seg2(0, 1, 4, C("battleInk"), 1);
      seg2(1, 9, 3, wood, 1);
      seg2(2, 8, 1, woodHi, 0);
      seg2(9, 15, 2, steel);
      seg2(15, end - (long ? 4 : 6), 2, wood);
      seg2(15, end - (long ? 6 : 8), 1, woodHi, -1);
      seg2(end - (long ? 4 : 6), end, 1, steelHi);
      dot(end - 1, -1, steel);
      if (kind === "garand") {
        dot(12, -1, C("battleBrass"));
        dot(13, -1, C("battleBrass"));
        seg2(18, 24, 1, steelHi, 1);
      }
      if (long) dot(13, 2, steelHi);
      if (kind === "arisaka") {
        // The sliding dust cover over the bolt, and the long Type 30 bayonet fixed under the muzzle.
        seg2(10, 14, 1, steelHi, -1);
        dot(end - 2, 1, steel);
        seg2(end - 1, end + 11, 1, C("battleSteel"), 1);
        dot(end + 11, 1, C("battleStar"));
      }
      // Sling.
      seg2(4, end - 8, 1, C("battleLeather"), 3);
      break;
    }
    case "thompson": {
      // Thompson: wooden stock, a 50-round drum, a vertical foregrip, a finned barrel and the
      // Cutts compensator at the muzzle.
      seg2(0, 1, 4, C("battleInk"), 1);
      seg2(1, 8, 3, wood, 1);
      seg2(2, 7, 1, woodHi, 0);
      seg2(8, 16, 3, steel);
      dot(13, -2, steelHi);
      const grip = q(9, 2);
      p.rect(grip.x, grip.y, 2, 4, wood);
      const drum = q(12, 4);
      p.disc(drum.x, drum.y, 3.5, steel);
      p.disc(drum.x, drum.y, 1.5, steelHi);
      seg2(16, 23, 2, steelHi);
      for (let d = 17; d < 23; d += 2) dot(d, 0, steel);
      const fore = q(19, 2);
      p.rect(fore.x, fore.y, 2, 4, wood);
      seg2(23, 26, 3, steel);
      break;
    }
    case "mp40": {
      seg2(0, 7, 1, steel, 1);
      seg2(0, 1, 3, steel, 1);
      seg2(7, 15, 2, steel);
      seg2(15, 22, 1, steelHi);
      for (let d = 15; d < 21; d += 2) dot(d, 1, steel);
      const mag = q(11, 1);
      p.rect(mag.x, mag.y, 2, 8, steel);
      const grip = q(8, 1);
      p.rect(grip.x, grip.y, 2, 3, shade(C("battleWood"), 0.5));
      break;
    }
    case "bar": {
      seg2(0, 9, 3, wood, 1);
      seg2(9, 20, 3, steel);
      seg2(20, 25, 2, wood);
      seg2(25, 33, 1, steelHi);
      const mag = q(14, 2);
      p.rect(mag.x, mag.y, 3, 4, steel);
      // Bipod folded down to the ground near the muzzle.
      const leg = q(29, 0);
      p.line(leg.x, leg.y, leg.x - 2, leg.y + 7, steel);
      p.line(leg.x, leg.y, leg.x + 2, leg.y + 7, steelHi);
      break;
    }
    case "type100": {
      // Type 100: a rifle-style wooden stock, a magazine out to the left side, a perforated jacket.
      seg2(0, 1, 4, C("battleInk"), 1);
      seg2(1, 10, 3, wood, 1);
      seg2(2, 9, 1, woodHi, 0);
      seg2(10, 14, 2, wood);
      seg2(12, 18, 2, steel);
      const mag = q(14, 1);
      p.rect(mag.x - 1, mag.y, 2, 4, steel);
      seg2(18, 24, 2, steelHi);
      for (let d = 19; d < 24; d += 2) dot(d, 0, steel);
      break;
    }
    case "type99": {
      // Type 99: a wooden butt, the curved box magazine standing up out of the top, a finned barrel,
      // a carrying handle, a cone flash hider and the bipod down to the ground.
      seg2(0, 9, 3, wood, 1);
      seg2(2, 8, 1, woodHi, 0);
      seg2(9, 17, 3, steel);
      for (let k = 0; k < 5; k++) {
        const m = q(11 + k * 0.4, -2 - k);
        p.rect(m.x, m.y, 3, 1, k === 4 ? steelHi : steel);
      }
      seg2(17, 28, 2, steel);
      for (let d = 18; d < 26; d += 2) dot(d, -1, steelHi);
      dot(19, -2, steel);
      seg2(28, 31, 3, steel);
      const leg = q(25, 1);
      p.line(leg.x, leg.y, leg.x - 3, leg.y + 7, steel);
      p.line(leg.x, leg.y, leg.x + 2, leg.y + 7, steelHi);
      break;
    }
    case "mg42": {
      seg2(0, 7, 3, shade(C("battleRubber"), 1.4), 1);
      seg2(7, 15, 3, steel);
      dot(10, -2, steelHi);
      seg2(15, 30, 3, steel);
      for (let d = 16; d < 29; d += 3) dot(d, 0, C("battleInk"));
      seg2(30, 32, 2, steelHi);
      const leg = q(26, 1);
      p.line(leg.x, leg.y, leg.x - 3, leg.y + 7, steel);
      p.line(leg.x, leg.y, leg.x + 2, leg.y + 7, steelHi);
      // The ammunition belt hangs from the feed.
      const feed = q(9, 2);
      for (let k = 0; k < 4; k++) p.rect(feed.x - k, feed.y + k * 2, 2, 1, C("battleBrass"));
      break;
    }
  }
  return q(GUN[kind].length);
}

// ---- Sandbags, for soldiers dug in on a bunker ----

/** A low wall of sandbags across a soldier's front, from his feet up `height` pixels. */
export function sandbags(p: Painter, x0: number, x1: number, ground: number, height: number): void {
  const bag = C("battleSand");
  const seam = shade(bag, 0.72);
  for (let row = 0; row * 4 < height; row++) {
    const y = ground - (row + 1) * 4;
    const offset = row % 2 === 0 ? 0 : 4;
    for (let x = x0 - offset; x < x1; x += 8) {
      const left = Math.max(x, x0);
      const right = Math.min(x + 8, x1);
      if (right <= left) continue;
      p.rect(left, y, right - left, 4, row % 2 ? shade(bag, 0.92) : bag);
      p.rect(left, y + 3, right - left, 1, seam);
      p.px(left, y, seam);
    }
  }
  p.rect(x0, ground - height, x1 - x0, 1, shade(bag, 1.15));
}

// ---- Infantry ----

/** Front rank kneels, the squad's automatic weapon lies prone, the rest stand. */
const INFANTRY_STANCE: readonly ("kneel" | "stand" | "prone")[] = ["kneel", "kneel", "kneel", "stand", "prone", "stand", "stand", "stand"];
const stanceOf = (index: number) => INFANTRY_STANCE[index] ?? "stand";

export function squadGun(index: number, look: Look): GunKind {
  const kit = kitOf(look);
  const weapon = squadWeapon(index, look.nation, look.paratrooper);
  if (weapon === "smg") return kit === "de" ? "mp40" : kit === "jp" ? "type100" : "thompson";
  if (weapon === "lmg") return kit === "de" ? "mg42" : kit === "jp" ? "type99" : "bar";
  return kit === "de" ? "kar98" : kit === "jp" ? "arisaka" : look.paratrooper ? "carbine" : "garand";
}

/** How the gun sits: butt position and angle, aiming or held at port arms. */
function gunPose(pose: Pose, look: Look): { stance: "kneel" | "stand" | "prone"; kind: GunKind; butt: Pt; angle: number; aiming: boolean; bob: number } {
  const stance = stanceOf(pose.index);
  const kind = squadGun(pose.index, look);
  const aiming = pose.fire !== null || stance === "prone";
  const bob = aiming ? 0 : Math.floor(pose.t / 480 + pose.index) % 2;
  if (stance === "prone") {
    return { stance, kind, butt: { x: -2, y: -9 }, angle: pose.atAir && pose.fire !== null ? -0.35 : 0, aiming, bob };
  }
  const f = soldierFrame(0, bob, stance, aiming ? 1 : 0);
  if (!aiming) return { stance, kind, butt: { x: f.frontShoulder.x - 4, y: f.hip + 1 }, angle: -1.0, aiming, bob };
  return { stance, kind, butt: { x: f.backShoulder.x - 1, y: f.top + 5 }, angle: pose.atAir ? -0.6 : 0, aiming, bob };
}

function shotsFor(pose: Pose, look: Look): readonly number[] {
  return figureTiming("rifle", { kind: "infantry", nation: look.nation, paratrooper: look.paratrooper }, pose.index).shots;
}

/** A soldier lying prone behind his squad's automatic weapon, its bipod on the ground. */
function drawProne(p: Painter, look: Look, butt: Pt, angle: number, kind: GunKind, recoil: number): void {
  const t = { ...look.team, ...uniform(look) };
  const boot = C("battleRubber");
  // Legs stretched out behind, boots heels-up.
  p.rect(-28, -5, 16, 5, t.clothLo);
  p.rect(-26, -8, 12, 4, t.cloth);
  p.rect(-33, -7, 5, 5, boot);
  p.rect(-31, -10, 4, 4, boot);
  // Body and pack.
  p.rect(-14, -10, 16, 8, t.cloth);
  p.rect(-14, -10, 16, 2, shade(t.cloth, 1.15));
  p.rect(-12, -13, 10, 4, look.nation === "germany" ? C("battleSteel") : t.clothLo);
  p.rect(-14, -3, 16, 2, kitOf(look) === "us" ? mix(C("battleSand"), C("battleOlive"), 0.35) : C("battleLeather"));
  // Head low behind the sights.
  const hx = 1;
  const hy = -17;
  p.rect(hx, hy, 6, 6, C("battleSkin"));
  p.px(hx + 4, hy + 2, C("battleInk"));
  p.rect(hx, hy, 2, 2, shade(C("battleWood"), 0.6));
  helmet(p, hx, hy, look);
  drawGun(p, butt.x, butt.y, angle, kind, look, recoil);
  // Elbows on the ground, hands on the gun.
  p.line(-2, -6, 4, -3, t.clothLo, 3);
  p.line(4, -3, butt.x + 8, butt.y + 1, t.cloth, 3);
  p.rect(butt.x + 8, butt.y, 3, 3, C("battleSkin"));
}

/** One man of a rifle squad, with his weapon and its brass. */
function drawRifleman(p: Painter, pose: Pose, look: Look, g: ReturnType<typeof gunPose>): void {
  const shots = shotsFor(pose, look);
  const fired = justFired(pose.ct, shots, 50);
  const recoil = g.kind === "garand" || g.kind === "carbine" || BOLT_ACTION.includes(g.kind) ? kick(pose.ct, shots[0] ?? 0, 40, 160) * 2 : fired >= 0 ? 1 : 0;
  if (g.stance === "prone") {
    drawProne(p, look, g.butt, g.angle, g.kind, recoil);
    return;
  }
  const spec = GUN[g.kind];
  const trigger = along(g.butt.x, g.butt.y, g.angle, spec.trigger - recoil);
  const fore = along(g.butt.x, g.butt.y, g.angle, spec.fore - recoil);
  // A German or Japanese rifleman works his rifle's bolt between shots.
  const bolt = BOLT_ACTION.includes(g.kind) && pose.ct !== null ? seg(pose.ct, 280, 360) - seg(pose.ct, 440, 520) : 0;
  const back = g.aiming ? { x: lerp(trigger.x, trigger.x + 3, bolt), y: lerp(trigger.y + 2, trigger.y - 3, bolt) } : { x: trigger.x, y: trigger.y + 1 };
  drawSoldier(p, 0, g.bob, g.stance, look, {
    lean: g.aiming ? 1 : 0,
    headDx: g.aiming ? 1 : 0,
    back,
    front: { x: fore.x, y: fore.y + 1 },
    weapon: () => {
      drawGun(p, g.butt.x, g.butt.y, g.angle, g.kind, look, recoil);
    },
  });
  // Brass: the Garand flicks its casing up and back; a bolt-action rifle drops it as the bolt opens.
  if (pose.ct !== null && (g.kind === "garand" || BOLT_ACTION.includes(g.kind))) {
    const ejectAt = g.kind === "garand" ? 220 : 380;
    const u = seg(pose.ct, ejectAt, ejectAt + 260);
    if (u > 0 && u < 1) {
      const from = along(g.butt.x, g.butt.y, g.angle, 13);
      p.rect(from.x - u * 9, from.y - Math.sin(u * Math.PI) * 10 + u * 8, 2, 1, C("battleBrass"));
    }
  }
}

export const infantryRig: Rig = {
  body: "soldier",
  hit: { x: 1, y: -20 },
  gearStays: (look) => look.dugIn,
  draw(p, pose, look) {
    const g = gunPose(pose, look);
    falling(p, pose.down, 0, () => drawRifleman(p, pose, look, g), { prone: g.stance === "prone" });
    if (look.dugIn) {
      if (g.stance === "prone") sandbags(p, 18, 34, 0, 8);
      else sandbags(p, -16, 16, 0, g.stance === "stand" ? 18 : 12);
    }
  },
  muzzle(pose, _shot, look): Muzzle {
    const g = gunPose({ ...pose, fire: pose.fire ?? "rifle" }, look);
    const m = along(g.butt.x, g.butt.y, g.angle, GUN[g.kind].length);
    return { x: m.x, y: m.y, angle: g.angle };
  },
};

// ---- Assault Infantry: a launcher gunner and his loader ----

/** Bazooka, Panzerschreck or Type 4 tube length, and the gunner's submachine gun. */
const launcherLength = (look: Look) => ({ us: 38, de: 34, jp: 36 })[kitOf(look)];
const assaultSmg = (look: Look): GunKind => ({ us: "thompson", de: "mp40", jp: "type100" } as const)[kitOf(look)];

export const assaultRig: Rig = {
  body: "soldier",
  hit: { x: -6, y: -18 },
  gearStays: (look) => look.dugIn,
  draw(p, pose, look) {
    const de = look.nation === "germany";
    const jp = look.nation === "japan";
    const ct = pose.fire === "bazooka" ? pose.ct : null;
    const shotAt = FIRE_TIMING.bazooka.shots[0] ?? 700;
    const recoil = kick(ct, shotAt, 40, 200) * 2;
    const smg = pose.fire === "mg";
    const g = soldierFrame(0, 0, "kneel", 1);
    const tubeY = g.top + 2;
    const tubeBack = -15 - recoil;
    const tubeLen = launcherLength(look);
    const reload = seg(ct, 0, 380);
    const tap = ct !== null && ct > 380 && ct < 560;
    const ducking = ct !== null && ct >= 520;

    // The loader crouches behind: he slides a rocket into the tube, taps the gunner's helmet to say
    // it's loaded, then ducks clear of the backblast.
    const lx = -26;
    const lStance: Stance = ducking ? "crouch" : "kneel";
    const lf = soldierFrame(lx, 0, lStance);
    const rocketAt = { x: lerp(lx + 5, tubeBack - 3, reload), y: lerp(lf.top + 8, tubeY, reload) };
    const holdingRocket = ct !== null && reload < 1;
    // Spare rockets in their carrier at his knee.
    p.rect(lx - 13, -7, 8, 7, C("battleOlive"));
    p.rect(lx - 13, -7, 8, 1, shade(C("battleOlive"), 1.3));
    p.rect(lx - 12, -10, 2, 3, C("battleSteelDark"));
    p.rect(lx - 9, -10, 2, 3, C("battleSteelDark"));
    falling(p, pose.down, lx, () => drawSoldier(p, lx, 0, lStance, look, {
      ...(ducking
        ? earsCovered(lf)
        : tap
          ? { front: { x: g.head.x - 1, y: g.head.y - 3 }, back: { x: lf.backShoulder.x + 3, y: lf.hip } }
          : holdingRocket
            ? { front: { x: rocketAt.x + 5, y: rocketAt.y + 1 }, back: { x: rocketAt.x + 1, y: rocketAt.y + 2 } }
            : { front: { x: lf.frontShoulder.x + 5, y: lf.hip - 2 } }),
      weapon: () => {
        if (holdingRocket) {
          // The rocket: warhead, body and fins.
          p.rect(rocketAt.x, rocketAt.y - 1, 8, 3, C("battleOlive"));
          p.rect(rocketAt.x + 8, rocketAt.y - 1, 3, 3, de ? C("battleSteelDark") : C("battleSteel"));
          p.px(rocketAt.x + 11, rocketAt.y, C("battleSteel"));
          p.rect(rocketAt.x - 2, rocketAt.y - 2, 2, 5, C("battleSteelDark"));
        }
      },
    }));

    // The gunner kneels with the launcher on his shoulder, or fires his submachine gun.
    if (smg) {
      const kind = assaultSmg(look);
      const fired = justFired(pose.ct, FIRE_TIMING.mg.shots, 50) >= 0 ? 1 : 0;
      const butt = { x: g.backShoulder.x - 1 - fired, y: g.top + 5 };
      falling(p, pose.down, 0, () => drawSoldier(p, 0, 0, "kneel", look, {
        lean: 1,
        headDx: 1,
        back: { x: butt.x + GUN[kind].trigger, y: butt.y + 2 },
        front: { x: butt.x + GUN[kind].fore, y: butt.y + 2 },
        weapon: () => {
          // The launcher slung across his back while he fights with the SMG.
          p.line(-14, g.top - 2, 8, g.top + 12, de || jp ? C("battleSteelDark") : look.team.lo, 3);
          drawGun(p, butt.x, butt.y, 0, kind, look);
        },
      }));
      if (look.dugIn) sandbags(p, -36, 12, 0, 10);
      return;
    }
    falling(p, pose.down, 0, () => drawSoldier(p, 0, 0, "kneel", look, {
      lean: 1,
      headDx: 1,
      back: { x: tubeBack + 17, y: tubeY + 4 },
      front: { x: tubeBack + 25, y: tubeY + 4 },
      weapon: () => {
        const steel = de || jp ? C("battleSteelDark") : look.team.lo;
        const thick = de ? 4 : 3;
        p.rect(tubeBack, tubeY - 1, tubeLen, thick, steel);
        p.rect(tubeBack, tubeY - 1, tubeLen, 1, shade(steel, 1.35));
        if (jp) {
          // Type 4 70mm: a slim tube with a pistol grip and trigger, a rear ring, and a bipod near
          // the front resting on the ground.
          p.rect(tubeBack - 1, tubeY - 2, 2, 5, C("battleSteel"));
          p.rect(tubeBack + 18, tubeY + 2, 2, 4, C("battleWood"));
          p.rect(tubeBack + 24, tubeY + 2, 2, 3, C("battleSteel"));
          p.rect(tubeBack + 28, tubeY - 3, 2, 2, C("battleSteel"));
          const legAt = { x: tubeBack + tubeLen - 7, y: tubeY + 2 };
          p.line(legAt.x, legAt.y, legAt.x - 3, 0, C("battleSteelDark"));
          p.line(legAt.x, legAt.y, legAt.x + 3, 0, C("battleSteel"));
        } else if (de) {
          // Panzerschreck: a thick tube, a blast shield with a window in front of the gunner's
          // face, a guard ring at the back and a front sight.
          p.rect(tubeBack - 1, tubeY - 2, 3, 6, C("battleSteel"));
          p.rect(tubeBack + 19, tubeY - 11, 3, 15, C("battleSteel"));
          p.rect(tubeBack + 19, tubeY - 11, 3, 1, shade(C("battleSteel"), 1.3));
          p.rect(tubeBack + 19, tubeY - 8, 1, 3, C("battleSkyLow"));
          p.rect(tubeBack + 27, tubeY - 3, 1, 2, C("battleSteel"));
          p.rect(tubeBack + 13, tubeY + 3, 2, 4, C("battleSteelDark"));
        } else {
          // Bazooka: a long slim tube, a flared wire guard at the back, a wooden shoulder stock,
          // two grips, a battery box and a ring sight at the front.
          p.rect(tubeBack - 3, tubeY - 3, 4, 7, C("battleSteel"));
          p.px(tubeBack - 3, tubeY - 3, C("battleSteelDark"));
          p.rect(tubeBack + 10, tubeY + 2, 7, 2, C("battleWood"));
          p.rect(tubeBack + 18, tubeY + 2, 2, 4, C("battleWood"));
          p.rect(tubeBack + 24, tubeY + 2, 2, 4, C("battleWood"));
          p.rect(tubeBack + 14, tubeY - 3, 3, 2, C("battleSteelDark"));
          p.rect(tubeBack + 28, tubeY - 4, 3, 4, C("battleSteelDark"));
          p.px(tubeBack + 29, tubeY - 3, C("battleSkyLow"));
          p.rect(tubeBack + tubeLen - 2, tubeY - 2, 2, 5, steel);
        }
      },
    }));
    if (look.dugIn) sandbags(p, -36, 12, 0, 10);
  },
  muzzle(pose, _shot, look): Muzzle {
    const g = soldierFrame(0, 0, "kneel", 1);
    if (pose.fire === "mg") {
      return { x: g.backShoulder.x - 1 + GUN[assaultSmg(look)].length, y: g.top + 5, angle: 0 };
    }
    return { x: launcherLength(look) - 15, y: g.top + 2, angle: 0 };
  },
};

// ---- Mortar Team: the loader drops a round down the tube, then both duck ----

const MORTAR_ANGLE = -1.1;
const MORTAR_BASE = { x: 8, y: -4 };
const MORTAR_LEN = 28;

export const mortarRig: Rig = {
  body: "soldier",
  hit: { x: 6, y: -16 },
  gearStays: () => true,
  draw(p, pose, look) {
    const ct = pose.ct;
    const shotAt = FIRE_TIMING.mortar.shots[0] ?? 430;
    const jolt = kick(ct, shotAt, 30, 120);
    const base = { x: MORTAR_BASE.x, y: MORTAR_BASE.y + jolt };
    const muzzle = along(base.x, base.y, MORTAR_ANGLE, MORTAR_LEN);
    const lift = seg(ct, 40, 250);
    const drop = seg(ct, 250, 330);
    const ducked = ct !== null && ct >= 330 && ct < 820;
    const steel = C("battleSteelDark");
    const de = look.nation === "germany";

    if (look.dugIn) sandbags(p, -40, 50, -2, 4);
    // Ammunition: an open crate with rounds standing in it, and a few laid out.
    p.rect(-36, -8, 12, 8, C("battleWood"));
    p.rect(-36, -8, 12, 1, shade(C("battleWood"), 1.3));
    p.rect(-36, -4, 12, 1, shade(C("battleWood"), 0.7));
    for (let i = 0; i < 4; i++) {
      p.rect(-35 + i * 3, -12, 2, 4, C("battleOlive"));
      p.px(-35 + i * 3, -9, C("battleBrass"));
    }

    // The assistant kneels behind the tube on the sight; he covers his ears when it fires.
    const aStance: Stance = ducked ? "crouch" : "kneel";
    const af = soldierFrame(-14, 0, aStance);
    falling(p, pose.down, -14, () => drawSoldier(p, -14, 0, aStance, look, ducked ? earsCovered(af) : { front: { x: base.x - 1, y: base.y - 12 }, back: { x: af.backShoulder.x + 4, y: af.hip - 1 } }));

    // The loader kneels on the far side, facing the tube: he lifts a round over the muzzle, lets it
    // drop, and ducks with his hands over his ears.
    const lx = 32;
    const lStance: Stance = ducked ? "crouch" : "kneel";
    const holding = ct === null || ct < 250;
    const roundAt = holding
      ? { x: lerp(lx - 10, muzzle.x, lift), y: lerp(-14, muzzle.y - 12, lift) }
      : { x: muzzle.x, y: lerp(muzzle.y - 12, muzzle.y - 2, drop) };
    const lf = soldierFrame(lx, 0, lStance);
    const head = { x: 2 * lx - lf.head.x - 6, y: lf.head.y };
    const loaderPose = ducked
      ? { back: { x: head.x + 5, y: head.y + 3 }, front: { x: head.x, y: head.y + 3 } }
      : holding
        ? { front: { x: roundAt.x + 1, y: roundAt.y + 5 }, back: { x: roundAt.x + 2, y: roundAt.y + 7 } }
        : { front: { x: muzzle.x + 4, y: muzzle.y - 4 }, back: { x: muzzle.x + 5, y: muzzle.y - 1 } };
    falling(p, pose.down, lx, () => drawSoldierFacingLeft(p, lx, 0, lStance, look, loaderPose), { facing: -1 });

    // The mortar, in front: baseplate, tube, bipod with its traversing gear, and the sight.
    p.rect(base.x - 8, base.y, 17, 4, C("battleSteel"));
    p.rect(base.x - 8, base.y + 3, 17, 1, steel);
    p.rect(base.x - 3, base.y - 2, 6, 3, steel);
    p.barrel(base.x, base.y, MORTAR_LEN, MORTAR_ANGLE, de ? 5 : 4, steel);
    p.barrel(base.x - 1, base.y - 1, MORTAR_LEN - 1, MORTAR_ANGLE, 1, C("battleSteel"));
    const lip = along(base.x, base.y, MORTAR_ANGLE, MORTAR_LEN - 1);
    p.rect(lip.x - 2, lip.y - 1, 5, 2, steel);
    const collar = along(base.x, base.y, MORTAR_ANGLE, 18);
    p.line(collar.x, collar.y, collar.x + 12, -1, steel, 2);
    p.line(collar.x, collar.y, collar.x + 7, 0, C("battleSteel"));
    p.rect(collar.x + 3, collar.y + 5, 6, 2, C("battleSteel"));
    p.rect(collar.x - 2, collar.y - 1, 5, 4, C("battleSteel"));
    p.rect(collar.x - 6, collar.y - 4, 3, 3, look.team.lo);
    p.px(collar.x - 5, collar.y - 4, C("battleSkyLow"));

    // The round, fins down: olive with a yellow band. A loader who's been hit drops it.
    if ((ct === null || ct < 330) && pose.down === undefined) {
      p.rect(roundAt.x - 1, roundAt.y, 4, 8, C("battleOlive"));
      p.px(roundAt.x, roundAt.y - 1, C("battleOlive"));
      p.px(roundAt.x + 1, roundAt.y - 1, C("battleOlive"));
      p.rect(roundAt.x - 1, roundAt.y + 2, 4, 1, C("battleBrass"));
      p.rect(roundAt.x - 2, roundAt.y + 8, 6, 1, C("battleSteel"));
      p.rect(roundAt.x - 1, roundAt.y + 9, 4, 1, C("battleSteel"));
    }
  },
  muzzle(): Muzzle {
    const m = along(MORTAR_BASE.x, MORTAR_BASE.y, MORTAR_ANGLE, MORTAR_LEN + 1);
    return { x: m.x, y: m.y, angle: MORTAR_ANGLE };
  },
};
