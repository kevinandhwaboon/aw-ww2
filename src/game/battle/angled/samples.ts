// Sample images for the three-quarter battle view prototype: `?battle=demo&angled=on`. Not part of
// the game. Shows the old side view next to the three-quarter view, a battle scene mocked up in
// the three-quarter view, a close-up of the turrets, every other machine (`&sample=machines`) and the
// bunker (`&sample=bunker`).

import { packColor } from "../../artPack";
import { drawPixelText, GLYPH_HEIGHT, textWidth } from "../../pixelFont";
import { playerColors } from "../../placeholderUnits";
import { drawBackdrop, SCENE } from "../backdrops";
import { C, Painter, teamShades } from "../paint";
import type { Look, Pose } from "../rig";
import type { Rig } from "../rig";
import { artilleryRig, bunkerRig, flakRig, halftrackRig, mobileAARig, reconRig, rocketRig, tankRig } from "../vehicles";
import { drawMesh, screenPoint, BATTLE_VIEW, type View } from "./mesh";
import { panzerIV, sherman, tiger, type Model } from "./models";

const US = { team: teamShades(0, "us"), nation: "us", paratrooper: false, suit: 0, submerged: false, dugIn: false, beached: false } as const satisfies Look;
const DE = { team: teamShades(1, "germany"), nation: "germany", paratrooper: false, suit: 0, submerged: false, dugIn: false, beached: false } as const satisfies Look;
const IDLE: Pose = { t: 0, index: 0, fire: null, ct: null, atAir: false, hp: 10 };

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

/** Draws a figure on its own canvas, then onto the scene with a dark outline. */
function stamp(target: CanvasRenderingContext2D, x: number, y: number, draw: (p: Painter) => void): void {
  const [fig, fctx] = canvas(320, 200);
  fctx.translate(160, 140);
  draw(new Painter(fctx));
  const [sil, sctx] = canvas(320, 200);
  sctx.drawImage(fig, 0, 0);
  sctx.globalCompositeOperation = "source-in";
  sctx.fillStyle = C("battleInk");
  sctx.fillRect(0, 0, 320, 200);
  for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) target.drawImage(sil, Math.round(x) - 160 + ox, Math.round(y) - 140 + oy);
  target.drawImage(fig, Math.round(x) - 160, Math.round(y) - 140);
}

/** A crewman's head in the hatch: a US tanker helmet or German headphones. */
function head(p: Painter, x: number, y: number, look: Look): void {
  p.rect(x - 2, y - 6, 5, 6, C("battleSkin"));
  p.px(x + 1, y - 4, C("battleInk"));
  p.rect(x - 3, y - 8, 7, 3, look.nation === "germany" ? C("battleRubber") : C("battleLeather"));
}

/** The view the samples use; `&deg=10` turns the figures 10 degrees toward the viewer. */
let view: View = BATTLE_VIEW;
const degreesOf = (v: View) => Math.round((-v.yaw * 180) / Math.PI);
const turned = (degrees: number): View => ({ ...BATTLE_VIEW, yaw: (-degrees * Math.PI) / 180 });

function angledTank(target: CanvasRenderingContext2D, model: Model, look: Look, x: number, y: number, flip: boolean, firing = false, scale = 1): void {
  stamp(target, x, y, (p) => {
    drawMesh(p, model.faces, view, 0, 0, flip, scale);
    for (const at of [...(model.commander ? [model.commander] : []), ...(model.crew ?? [])]) {
      const c = screenPoint(at, view, 0, 0, flip, scale);
      head(p, c.x, c.y, look);
    }
  });
  if (firing) {
    const p = new Painter(target);
    const m = screenPoint(model.muzzle, view, x, y, flip, scale);
    const dir = flip ? -1 : 1;
    p.disc(m.x + dir * 4, m.y + 1, 5, C("battleFlash"));
    p.line(m.x, m.y, m.x + dir * 13, m.y + 3, C("battleFire"), 2);
    p.disc(m.x + dir * 2, m.y - 4, 4, C("battleSmoke"));
  }
}

function text(ctx: CanvasRenderingContext2D, words: string, x: number, y: number, scale: number, color: string, align: "left" | "right" | "center" = "left"): void {
  const [c, tctx] = canvas(Math.max(1, textWidth(words)), GLYPH_HEIGHT);
  tctx.fillStyle = color;
  drawPixelText(tctx, words, 0, 0);
  const w = c.width * scale;
  const left = align === "left" ? x : align === "right" ? x - w : x - w / 2;
  ctx.drawImage(c, left, y, w, c.height * scale);
}

function ground(ctx: CanvasRenderingContext2D): void {
  const p = new Painter(ctx);
  ctx.fillStyle = C("battlePanel");
  ctx.fillRect(0, 0, SCENE.width, SCENE.height);
  drawBackdrop(p, 0, "plains", "land", 0, 1);
  drawBackdrop(p, SCENE.half, "plains", "land", 0, 1);
}

/** Sample 1: the current side view above, the three-quarter view below, same three tanks. */
function comparison(): HTMLCanvasElement {
  const [c, ctx] = canvas(SCENE.width, SCENE.height);
  ground(ctx);
  const p = new Painter(ctx);
  p.rect(0, 0, SCENE.width, 16, C("battlePanel"));
  text(ctx, "SIDE VIEW - NOW", 6, 4, 2, C("labelText"));
  p.rect(0, 116, SCENE.width, 14, C("battlePanel"));
  text(ctx, `TURNED ${degreesOf(view)} DEGREES - PROPOSED`, 6, 119, 2, C("labelGold"));
  stamp(ctx, 60, 104, (q) => tankRig("medium").draw(q, IDLE, US));
  stamp(ctx, 186, 104, (q) => tankRig("medium").draw(q, IDLE, DE));
  stamp(ctx, 318, 104, (q) => tankRig("heavy").draw(q, IDLE, DE));
  angledTank(ctx, sherman(US.team), US, 60, 200, false);
  angledTank(ctx, panzerIV(DE.team), DE, 186, 202, false);
  angledTank(ctx, tiger(DE.team), DE, 314, 204, false);
  return c;
}

/** Sample 2: a battle scene in the three-quarter view: five Shermans firing on five Tigers. */
function battle(): HTMLCanvasElement {
  const [c, ctx] = canvas(SCENE.width, SCENE.height);
  ground(ctx);
  const left: [number, number][] = [[52, 166], [124, 180], [44, 194], [116, 208], [56, 222]];
  const right: [number, number][] = [[58, 164], [126, 178], [52, 194], [120, 208], [62, 222]];
  left.forEach(([x, y], i) => angledTank(ctx, sherman(US.team), US, x, y - 6, false, i === 3));
  right.forEach(([x, y]) => angledTank(ctx, tiger(DE.team), DE, SCENE.width - x, y - 6, true));
  const p = new Painter(ctx);
  p.rect(SCENE.half - 1, 0, 2, SCENE.height, C("battleInk"));
  for (const [x0, owner, name, align] of [[0, 0, "MEDIUM TANK", "left"], [SCENE.half, 1, "HEAVY TANK", "right"]] as const) {
    p.rect(x0, 0, SCENE.half, SCENE.top, C("battlePanel"));
    p.rect(x0, SCENE.top - 3, SCENE.half, 2, playerColors(owner)[0]);
    text(ctx, name, align === "left" ? x0 + 6 : x0 + SCENE.half - 6, 3, 2, C("labelText"), align);
    p.rect(x0, SCENE.bottom, SCENE.half, SCENE.height - SCENE.bottom, C("battlePanel"));
    text(ctx, "HP 10", align === "left" ? x0 + 6 : x0 + SCENE.half - 6, SCENE.bottom + 5, 2, C("labelText"), align);
  }
  return c;
}

/** Sample 3: the turrets up close, a Sherman and a Tiger facing each other. */
function closeUp(): HTMLCanvasElement {
  const [c, ctx] = canvas(SCENE.width, SCENE.height);
  ground(ctx);
  angledTank(ctx, sherman(US.team), US, 96, 196, false, false, 1.7);
  angledTank(ctx, tiger(DE.team), DE, 290, 200, true, false, 1.5);
  return c;
}

/** The same three tanks at several angles, one row each, with the side view on top for reference. */
function angles(): HTMLCanvasElement {
  const [c, ctx] = canvas(SCENE.width, SCENE.height);
  ground(ctx);
  const p = new Painter(ctx);
  const saved = view;
  const rows = [0, 5, 10, 15];
  rows.forEach((degrees, row) => {
    const y = 62 + row * 52;
    p.rect(0, y - 46, 30, 12, C("battlePanel"));
    text(ctx, `${degrees}`, 4, y - 43, 2, degrees === 0 ? C("labelText") : C("labelGold"));
    view = turned(degrees);
    angledTank(ctx, sherman(US.team), US, 82, y, false);
    angledTank(ctx, panzerIV(DE.team), DE, 196, y, false);
    angledTank(ctx, tiger(DE.team), DE, 316, y, false);
  });
  view = saved;
  return c;
}

/** Every machine other than the tanks, US above German, at rest: `&sample=machines`. */
function machines(): HTMLCanvasElement {
  const [c, ctx] = canvas(600, 350);
  ctx.fillStyle = C("battleGrass");
  ctx.fillRect(0, 0, 600, 350);
  const rigs: [Rig, Partial<Pose>][] = [[reconRig, {}], [halftrackRig, {}], [mobileAARig, { atAir: true }], [flakRig, { atAir: true }], [artilleryRig, {}], [rocketRig, { index: 1 }]];
  [US, DE].forEach((look, nation) => {
    rigs.forEach(([rig, pose], i) => {
      const x = 90 + (i % 3) * 200;
      const y = 80 + nation * 170 + (i >= 3 ? 80 : 0);
      stamp(ctx, x, y, (q) => rig.draw(q, { ...IDLE, ...pose }, look));
    });
  });
  return c;
}

/** The bunker and its defenders, at rest and knocked out: `&sample=bunker`. */
function fort(): HTMLCanvasElement {
  const [c, ctx] = canvas(SCENE.width, SCENE.height);
  ground(ctx);
  const neutral: Look = { ...US, team: teamShades(null, null), nation: null };
  stamp(ctx, 96, 200, (q) => bunkerRig.draw(q, IDLE, neutral));
  stamp(ctx, 280, 200, (q) => bunkerRig.draw(q, { ...IDLE, hp: 3 }, neutral));
  return c;
}

export function showAngledSamples(root: HTMLElement, params: URLSearchParams): void {
  const scale = Math.max(1, Number(params.get("scale") ?? 2));
  const only = params.get("sample");
  const deg = Number(params.get("deg") ?? NaN);
  view = Number.isFinite(deg) ? turned(deg) : BATTLE_VIEW;
  root.style.cssText = `display:flex;flex-wrap:wrap;gap:8px;padding:8px;overflow:auto;height:100vh;box-sizing:border-box;background:${packColor("uiBg")}`;
  const samples: [string, () => HTMLCanvasElement][] = [["compare", comparison], ["battle", battle], ["closeup", closeUp], ["angles", angles], ["machines", machines], ["bunker", fort]];
  for (const [name, make] of samples) {
    if (only && only !== name) continue;
    const source = make();
    const [view, vctx] = canvas(source.width * scale, source.height * scale);
    vctx.drawImage(source, 0, 0, source.width * scale, source.height * scale);
    view.title = name;
    root.append(view);
  }
}
