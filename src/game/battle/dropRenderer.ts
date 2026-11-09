// Paints one frame of the airborne drop scene (08-art-pipeline §20): the transport crossing the sky,
// men jumping from the door on static lines, canopies snapping open, the descent, the landing roll,
// and the squad on its feet among the collapsed chutes. A pure function of time.

import { terrainName, unitName } from "../artPack";
import { drawPixelText, GLYPH_HEIGHT, textWidth } from "../pixelFont";
import { playerColors } from "../placeholderUnits";
import { transportRig } from "./airNaval";
import { drawBackdrop, SCENE } from "./backdrops";
import type { Cutscene } from "./BattleScene";
import { DOOR_OFFSET, dropLength, DROP_MS, jumpTimes, PLANE, planeX, type DropPlan } from "./drop";
import { C, mix, Painter, shade, teamShades } from "./paint";
import { clamp01, lerp, seg, type Look, type Pt } from "./rig";
import { drawGun, drawSoldier, GUN, soldierFrame, squadGun } from "./soldiers";
import { hash } from "./timeline";

const BOX = { w: 200, h: 120, ox: 100, oy: 90 };

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

export class DropRenderer implements Cutscene {
  private readonly p: Painter;
  private readonly fig: Painter;
  private readonly figCanvas: HTMLCanvasElement;
  private readonly sil: CanvasRenderingContext2D;
  private readonly silCanvas: HTMLCanvasElement;
  private readonly text = new Map<string, HTMLCanvasElement>();
  private readonly look: Look;
  private readonly jumps: readonly { exit: number; land: number }[];
  private readonly length: { settled: number; total: number };

  constructor(
    readonly plan: DropPlan,
    canvasEl: HTMLCanvasElement,
  ) {
    const ctx = canvasEl.getContext("2d");
    if (!ctx) throw new Error("2D canvas not available");
    ctx.imageSmoothingEnabled = false;
    this.p = new Painter(ctx);
    const [fc, fctx] = canvas(BOX.w, BOX.h);
    this.figCanvas = fc;
    this.fig = new Painter(fctx);
    const [sc, sctx] = canvas(BOX.w, BOX.h);
    this.silCanvas = sc;
    this.sil = sctx;
    this.look = {
      team: teamShades(plan.owner, plan.nation),
      nation: plan.nation,
      paratrooper: plan.paratrooper,
      suit: plan.suit,
      submerged: false,
      dugIn: false,
      beached: false,
    };
    this.jumps = jumpTimes(plan);
    this.length = dropLength(plan);
  }

  get total(): number {
    return this.length.total;
  }

  opacity(t: number): number {
    return Math.min(clamp01(t / 150), 1 - seg(t, this.length.settled, this.length.total));
  }

  /** Where man i lands: spread across the drop zone in loose ranks. */
  private landing(i: number): Pt {
    return { x: 70 + i * 34 + Math.round((hash(i, 11) - 0.5) * 16), y: 186 + (i % 3) * 12 };
  }

  /** Where man i hangs at time t during the descent, swaying under his canopy. */
  private descent(i: number, t: number, exit: number): { at: Pt; canopy: number } {
    const door = { x: exit < 0 ? 0 : planeX(exit) + DOOR_OFFSET, y: PLANE.y + 6 };
    const since = t - exit;
    if (since < DROP_MS.freefall) {
      // Out of the door, falling and drifting back in the slipstream; the static line pays out.
      const k = since / DROP_MS.freefall;
      return { at: { x: door.x - 14 * k, y: door.y + 20 * k * k }, canopy: 0 };
    }
    const opening = clamp01((since - DROP_MS.freefall) / DROP_MS.open);
    const afterOpen = Math.max(0, since - DROP_MS.freefall - DROP_MS.open);
    const k = clamp01(afterOpen / DROP_MS.descend);
    const start = { x: door.x - 14, y: door.y + 20 + opening * 10 };
    const land = this.landing(i);
    const sway = Math.sin(t / 260 + i) * 3 * (1 - k);
    return { at: { x: lerp(start.x, land.x, k) + sway, y: lerp(start.y, land.y, k) }, canopy: opening };
  }

  render(t: number): void {
    const { ctx } = this.p;
    const p = this.p;
    ctx.save();
    ctx.fillStyle = C("battlePanel");
    ctx.fillRect(0, 0, SCENE.width, SCENE.height);
    ctx.beginPath();
    ctx.rect(0, SCENE.top, SCENE.width, SCENE.bottom - SCENE.top);
    ctx.clip();
    const ground = this.plan.terrain === "hills" || this.plan.terrain === "bunker" ? "plains" : this.plan.terrain;
    drawBackdrop(p, 0, ground, "land", t, 1);
    drawBackdrop(p, SCENE.half, ground, "land", t, 1);

    // Collapsed chutes on the ground, under everything else.
    this.jumps.forEach((j, i) => {
      if (t < j.land) return;
      const land = this.landing(i);
      const k = seg(t, j.land, j.land + 400);
      const silk = mix(C("battleStar"), C("battleSand"), this.plan.nation === "germany" ? 0.6 : 0.25);
      p.ellipse(land.x - 14 - k * 6, land.y - 2 + k * 2, 12 - k * 2, 5 - k * 2.5, silk);
      p.ellipse(land.x - 16 - k * 6, land.y - 3 + k * 2, 6, 2, shade(silk, 0.85));
    });

    // Men in the air and on the ground, back to front.
    const order = this.jumps.map((_, i) => i).sort((a, b) => this.landing(a).y - this.landing(b).y);
    for (const i of order) this.drawJumper(i, t);
    this.drawPlane(t);
    ctx.restore();
    this.drawPanels(t);
  }

  private drawPlane(t: number): void {
    const x = planeX(t);
    if (x < -80 || x > SCENE.width + 80) return;
    const pose = { t, index: 0, fire: null, ct: null, atAir: false, hp: this.plan.hp };
    this.stamp({ x, y: PLANE.y }, () => transportRig.draw(this.fig, pose, this.look));
    // The open door, and the static lines still trailing from it.
    const door = { x: Math.round(x + DOOR_OFFSET), y: PLANE.y };
    this.p.rect(door.x - 2, door.y - 4, 5, 8, C("battleInk"));
    for (const j of this.jumps) {
      const since = t - j.exit;
      if (since > 0 && since < 900) {
        const len = Math.min(26, since / 8);
        this.p.line(door.x, door.y + 2, door.x - len, door.y + 3 + len * 0.5, shade(C("battleSand"), 0.8));
      }
    }
  }

  private drawJumper(i: number, t: number): void {
    const jump = this.jumps[i];
    if (!jump || t < jump.exit) return;
    const look = this.look;
    if (t >= jump.land) {
      // Landed: a roll, then up on his feet with his weapon ready.
      const land = this.landing(i);
      const rolling = t < jump.land + 350;
      this.stamp(land, () => {
        if (rolling) {
          drawSoldier(this.fig, 0, 0, "crouch", look, {});
          return;
        }
        const kind = this.plan.unit === "infantry" ? squadGun(i, look) : look.nation === "germany" ? "kar98" : look.nation === "japan" ? "arisaka" : "carbine";
        const f = soldierFrame(0, 0, "stand");
        const butt = { x: f.frontShoulder.x - 4, y: f.hip + 1 };
        const along = (d: number): Pt => ({ x: butt.x + Math.cos(-1.0) * d, y: butt.y + Math.sin(-1.0) * d });
        drawSoldier(this.fig, 0, 0, "stand", look, {
          back: along(GUN[kind].trigger),
          front: along(GUN[kind].fore),
          weapon: () => drawGun(this.fig, butt.x, butt.y, -1.0, kind, look),
        });
      });
      return;
    }
    const { at, canopy } = this.descent(i, t, jump.exit);
    const p = this.p;
    if (canopy > 0) {
      // The canopy and its rigging lines, opening from a streamer into a full dome.
      const w = 3 + canopy * 19;
      const h = 2 + canopy * 11;
      const top = { x: at.x, y: at.y - 50 - canopy * 18 };
      const silk = mix(C("battleStar"), C("battleSand"), this.plan.nation === "germany" ? 0.6 : 0.25);
      for (const dx of [-w, -w / 2, w / 2, w]) p.line(top.x + dx, top.y + 1, at.x + (dx > 0 ? 2 : -2), at.y - 36, shade(silk, 0.7));
      // Only the upper half of each ellipse: a dome.
      p.ctx.save();
      p.ctx.beginPath();
      p.ctx.rect(top.x - w - 2, top.y - h - 2, w * 2 + 4, h + 3);
      p.ctx.clip();
      p.ellipse(top.x, top.y + 1, w + 1, h + 1, C("battleInk"));
      p.ellipse(top.x, top.y + 1, w, h, silk);
      p.ellipse(top.x - w / 3, top.y - h / 4, w / 2, h / 2, shade(silk, 1.08));
      for (let g = -2; g <= 2; g++) p.line(top.x + (g * w) / 3, top.y - h + 1, top.x + (g * w) / 2.4, top.y, shade(silk, 0.85));
      p.ctx.restore();
      p.rect(top.x - w, top.y, w * 2, 1, shade(silk, 0.7));
    }
    this.stamp(at, () => {
      const f = soldierFrame(0, 0, "stand");
      // Hands up on the risers; under the dome his legs hang together.
      drawSoldier(this.fig, 0, 0, "stand", look, {
        back: { x: f.backShoulder.x - 1, y: f.top - 9 },
        front: { x: f.frontShoulder.x + 1, y: f.top - 9 },
        weapon: () => {
          // The reserve chute on his chest and a leg bag.
          this.fig.rect(f.frontShoulder.x - 1, f.top + 6, 5, 5, mix(C("battleOlive"), C("battleSand"), 0.3));
          this.fig.rect(-1, f.hip + 3, 5, 7, C("battleOlive"));
        },
      });
    });
  }

  /** Draws a figure with its dark outline at a point on the scene. */
  private stamp(at: Pt, draw: () => void): void {
    const f = this.fig;
    f.ctx.clearRect(0, 0, BOX.w, BOX.h);
    f.ctx.save();
    f.ctx.translate(BOX.ox, BOX.oy);
    draw();
    f.ctx.restore();
    const s = this.sil;
    s.clearRect(0, 0, BOX.w, BOX.h);
    s.globalCompositeOperation = "source-over";
    s.drawImage(this.figCanvas, 0, 0);
    s.globalCompositeOperation = "source-in";
    s.fillStyle = C("battleInk");
    s.fillRect(0, 0, BOX.w, BOX.h);
    s.globalCompositeOperation = "source-over";
    const { ctx } = this.p;
    ctx.save();
    ctx.translate(Math.round(at.x), Math.round(at.y));
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) ctx.drawImage(this.silCanvas, -BOX.ox + ox, -BOX.oy + oy);
    ctx.drawImage(this.figCanvas, -BOX.ox, -BOX.oy);
    ctx.restore();
  }

  // ---- Panels ----

  private textCanvas(text: string, color: string): HTMLCanvasElement {
    const key = `${color}|${text}`;
    const cached = this.text.get(key);
    if (cached) return cached;
    const [c, ctx] = canvas(Math.max(1, textWidth(text)), GLYPH_HEIGHT);
    ctx.fillStyle = color;
    drawPixelText(ctx, text, 0, 0);
    this.text.set(key, c);
    return c;
  }

  private drawText(text: string, x: number, y: number, color: string, scale: number, align: "left" | "right" | "center"): void {
    const safe = text.toUpperCase().replace(/[^A-Z0-9 %+?-]/g, "");
    const c = this.textCanvas(safe, color);
    const w = c.width * scale;
    const left = align === "left" ? x : align === "right" ? x - w : x - Math.round(w / 2);
    this.p.ctx.drawImage(c, left, y, w, c.height * scale);
  }

  private drawPanels(t: number): void {
    const p = this.p;
    const plan = this.plan;
    const fill = playerColors(plan.owner)[0];
    p.rect(0, 0, SCENE.width, SCENE.top, C("battlePanel"));
    p.rect(0, SCENE.top - 3, SCENE.width, 2, fill);
    this.drawText(unitName(plan.unit), 6, 3, C("labelText"), 2, "left");
    this.drawText(terrainName(plan.terrain), SCENE.width - 6, 3, C("labelText"), 2, "right");
    p.rect(0, SCENE.bottom, SCENE.width, SCENE.height - SCENE.bottom, C("battlePanel"));
    p.rect(0, SCENE.bottom, SCENE.width, 1, fill);
    this.drawText(`HP ${plan.hp}`, 6, SCENE.bottom + 5, C("labelText"), 2, "left");
    const lastLanding = Math.max(...this.jumps.map((j) => j.land), 0);
    if (t > lastLanding + 400) {
      const words = "LANDED";
      const w = textWidth(words) * 3 + 16;
      p.rect(SCENE.width / 2 - w / 2, 28, w, GLYPH_HEIGHT * 3 + 12, C("battlePanel"));
      p.rect(SCENE.width / 2 - w / 2, 28, w, 2, fill);
      this.drawText(words, SCENE.width / 2, 34, C("labelGold"), 3, "center");
    }
  }
}
