// Paints one frame of a battle scene (08-art-pipeline §18) onto a small canvas, as a pure function of
// time: the two halves with their backgrounds, every figure in its pose, what's in flight, impacts,
// casualties, and the HP panels. The Phaser scene scales the canvas up with nearest-neighbor.

import { UNITS } from "../../engine/data/units";
import { terrainName, unitName } from "../artPack";
import { drawPixelText, GLYPH_HEIGHT, textWidth } from "../pixelFont";
import { playerColors } from "../placeholderUnits";
import { bomberRig, battleshipRig, destroyerRig, fighterRig, landingCraftRig, submarineRig, torpedoBoatRig, transportRig } from "./airNaval";
import { backdropView, drawBackdrop, SCENE, type BackdropView } from "./backdrops";
import { C, mix, Painter, teamShades } from "./paint";
import { figureCount, type BattleHalf, type BattlePlan, type FigureKind, type FireKind, type HalfId } from "./plan";
import { clamp01, lerp, seg, type Look, type Pose, type Pt, type Rig } from "./rig";
import { assaultRig, infantryRig, mortarRig } from "./soldiers";
import { buildTimeline, deathTimes, figureTiming, hash, hpAt, SCENE_MS, type Shot, type Timeline } from "./timeline";
import { artilleryRig, bunkerRig, flakRig, halftrackRig, mobileAARig, reconRig, rocketRig, tankRig } from "./vehicles";

const RIGS: Record<FigureKind, Rig> = {
  infantry: infantryRig,
  assaultInfantry: assaultRig,
  mortar: mortarRig,
  recon: reconRig,
  halftrack: halftrackRig,
  lightTank: tankRig("light"),
  mediumTank: tankRig("medium"),
  heavyTank: tankRig("heavy"),
  tankDestroyer: tankRig("td"),
  artillery: artilleryRig,
  rocketArtillery: rocketRig,
  mobileAA: mobileAARig,
  flakGun: flakRig,
  fighter: fighterRig,
  bomber: bomberRig,
  transportAircraft: transportRig,
  battleship: battleshipRig,
  destroyer: destroyerRig,
  submarine: submarineRig,
  landingCraft: landingCraftRig,
  torpedoBoat: torpedoBoatRig,
  bunker: bunkerRig,
};

const pt = (x: number, y: number): Pt => ({ x, y });

/**
 * Where each figure stands, measured from the half's outer edge toward the middle. Figure 0 is at
 * the front and falls last; the back of the formation falls first. Rows further back are higher on
 * the screen and drawn first, so the formation has depth.
 */
const SLOTS: Record<FigureKind, readonly Pt[]> = {
  // Front rank kneels, the automatic weapon lies prone at the front, the rest stand behind.
  infantry: [pt(116, 216), pt(76, 208), pt(36, 216), pt(132, 190), pt(140, 220), pt(94, 184), pt(52, 180), pt(112, 166)],
  assaultInfantry: [pt(70, 216), pt(146, 204), pt(84, 184), pt(150, 168)],
  mortar: [pt(64, 214), pt(142, 196), pt(76, 174)],
  // Every vehicle and gun unit shows five at full strength, in two staggered columns and five ranks.
  recon: [pt(44, 218), pt(152, 208), pt(54, 195), pt(146, 182), pt(48, 169)],
  halftrack: [pt(40, 218), pt(148, 208), pt(50, 195), pt(142, 182), pt(44, 169)],
  lightTank: [pt(32, 218), pt(145, 208), pt(42, 195), pt(139, 182), pt(36, 169)],
  mediumTank: [pt(42, 218), pt(132, 208), pt(52, 195), pt(126, 182), pt(46, 169)],
  heavyTank: [pt(50, 218), pt(118, 208), pt(60, 195), pt(112, 182), pt(54, 169)],
  tankDestroyer: [pt(42, 218), pt(130, 208), pt(52, 195), pt(124, 182), pt(46, 169)],
  artillery: [pt(64, 218), pt(148, 208), pt(74, 195), pt(142, 182), pt(68, 169)],
  rocketArtillery: [pt(66, 218), pt(144, 208), pt(76, 195), pt(138, 182), pt(70, 169)],
  mobileAA: [pt(40, 218), pt(148, 208), pt(50, 195), pt(142, 182), pt(44, 169)],
  flakGun: [pt(44, 218), pt(132, 208), pt(54, 195), pt(126, 182), pt(48, 169)],
  fighter: [pt(100, 118), pt(146, 76), pt(58, 160), pt(56, 58)],
  bomber: [pt(100, 104), pt(118, 172), pt(76, 52)],
  transportAircraft: [pt(100, 104), pt(118, 172), pt(76, 52)],
  battleship: [pt(100, 204)],
  destroyer: [pt(76, 210), pt(118, 176)],
  submarine: [pt(78, 208), pt(118, 176)],
  landingCraft: [pt(92, 210), pt(104, 176)],
  torpedoBoat: [pt(52, 214), pt(132, 202), pt(78, 184), pt(146, 170)],
  bunker: [pt(96, 208)],
};
const SUBMERGED_SLOTS: readonly Pt[] = [pt(84, 190), pt(118, 120)];

/** Half-width of the shadow a figure casts on the ground; 0 for aircraft and ships. */
const SHADOW: Record<FigureKind, number> = {
  infantry: 11, assaultInfantry: 26, mortar: 24, recon: 26, halftrack: 34, lightTank: 28, mediumTank: 34,
  heavyTank: 42, tankDestroyer: 34, artillery: 30, rocketArtillery: 32, mobileAA: 34, flakGun: 34,
  fighter: 0, bomber: 0, transportAircraft: 0, battleship: 0, destroyer: 0, submarine: 0, landingCraft: 0, torpedoBoat: 0,
  bunker: 40,
};
/** Half-width of the foam line where a ship meets the water. */
const WATERLINE: Partial<Record<FigureKind, number>> = { battleship: 84, destroyer: 50, submarine: 48, landingCraft: 40, torpedoBoat: 28 };

/** Indirect fire: how long a round takes to leave the screen, and to fall onto its target. */
const INDIRECT_MS = { up: 260, rocketUp: 420, down: 380 };

type Missile = "bullet" | "shell" | "rocket" | "lob" | "rocketLob" | "bomb" | "torpedo" | "charge";
const MISSILE: Record<FireKind, Missile> = {
  rifle: "bullet", mg: "bullet", aaGuns: "bullet", planeGuns: "bullet", bazooka: "rocket", tankGun: "shell",
  flak: "shell", deckGun: "shell", navalGuns: "shell", mortar: "lob", howitzer: "lob", rockets: "rocketLob",
  bombs: "bomb", depthCharges: "charge", torpedo: "torpedo",
};
type Blast = "small" | "medium" | "large";
const BLAST: Record<FireKind, Blast> = {
  rifle: "small", mg: "small", aaGuns: "small", planeGuns: "small", bazooka: "medium", tankGun: "medium",
  flak: "medium", deckGun: "medium", mortar: "medium", howitzer: "large", rockets: "large", bombs: "large",
  navalGuns: "large", depthCharges: "large", torpedo: "large",
};
const BLAST_MS: Record<Blast, number> = { small: 260, medium: 650, large: 950 };
/** Muzzle flash size in pixels; 0 for weapons that don't flash. */
const FLASH: Record<FireKind, number> = {
  rifle: 3, mg: 3, aaGuns: 3, planeGuns: 3, bazooka: 5, tankGun: 8, flak: 8, deckGun: 6, mortar: 5,
  howitzer: 11, rockets: 5, bombs: 0, navalGuns: 13, depthCharges: 3, torpedo: 0,
};
/** Weapons whose blast kicks up dust along the ground in front of them. */
const GROUND_BLAST = new Set<FireKind>(["tankGun", "howitzer", "flak"]);

interface HalfView {
  readonly data: BattleHalf;
  readonly rig: Rig;
  readonly look: Look;
  readonly view: BackdropView;
  readonly slots: readonly Pt[];
  readonly figures: number;
  readonly deaths: Map<number, number>;
  readonly x0: number;
  readonly dir: 1 | -1;
  readonly fill: string;
}

interface PlannedShot extends Shot {
  readonly fire: FireKind;
  readonly muzzle: Pt;
  /** The barrel's direction as the shot leaves, in scene coordinates. */
  readonly heading: Pt;
  /** Fired from the ground at an aircraft: it climbs out of its half and comes up under the target. */
  readonly upward: boolean;
  readonly target: Pt;
  /** The target's ground or waterline, for torpedoes. */
  readonly targetBase: Pt;
  readonly atAir: boolean;
  readonly targetBody: Rig["body"];
  readonly targetView: BackdropView;
}

const FIGURE_BOX = { w: 200, h: 170, ox: 100, oy: 110 };

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

const FOOT = new Set<FigureKind>(["infantry", "assaultInfantry", "mortar"]);
const isNaval = (kind: FigureKind) => kind !== "bunker" && UNITS[kind].category === "naval";
const isAirKind = (kind: FigureKind) => kind !== "bunker" && UNITS[kind].category === "air";

export class BattleRenderer {
  readonly timeline: Timeline;
  private readonly p: Painter;
  private readonly halves: Record<HalfId, HalfView>;
  private readonly shots: readonly PlannedShot[];
  private readonly fig: Painter;
  private readonly figCanvas: HTMLCanvasElement;
  private readonly sil: CanvasRenderingContext2D;
  private readonly silCanvas: HTMLCanvasElement;
  private readonly text = new Map<string, HTMLCanvasElement>();

  constructor(
    readonly plan: BattlePlan,
    readonly canvasEl: HTMLCanvasElement,
  ) {
    const ctx = canvasEl.getContext("2d");
    if (!ctx) throw new Error("2D canvas not available");
    ctx.imageSmoothingEnabled = false;
    this.p = new Painter(ctx);
    const [fc, fctx] = canvas(FIGURE_BOX.w, FIGURE_BOX.h);
    this.figCanvas = fc;
    this.fig = new Painter(fctx);
    const [sc, sctx] = canvas(FIGURE_BOX.w, FIGURE_BOX.h);
    this.silCanvas = sc;
    this.sil = sctx;
    this.timeline = buildTimeline(plan);
    this.halves = { left: this.halfView(plan.left), right: this.halfView(plan.right) };
    this.shots = this.timeline.shots.map((s) => this.planShot(s));
  }

  get total(): number {
    return this.timeline.total;
  }

  /** How opaque the whole scene is: it fades in and out over the map. */
  opacity(t: number): number {
    return Math.min(clamp01(t / 150), 1 - seg(t, this.timeline.settled, this.timeline.total));
  }

  private halfView(data: BattleHalf): HalfView {
    const look: Look = {
      team: teamShades(data.owner, data.nation),
      nation: data.nation,
      paratrooper: data.paratrooper,
      suit: data.suit,
      submerged: data.submerged,
      dugIn: data.terrain === "bunker" && FOOT.has(data.kind),
      beached: data.kind === "landingCraft" && data.terrain === "beach",
    };
    const view = backdropView(isAirKind(data.kind), isNaval(data.kind), data.submerged, data.terrain);
    const left = data.half === "left";
    const figures = figureCount(data.kind, data.hp);
    return {
      data,
      rig: RIGS[data.kind],
      look,
      view,
      slots: data.submerged ? SUBMERGED_SLOTS : SLOTS[data.kind],
      figures,
      deaths: deathTimes(this.timeline, data.half),
      x0: left ? 0 : SCENE.half,
      dir: left ? 1 : -1,
      fill: data.owner === null ? C("battleConcrete") : playerColors(data.owner)[0],
    };
  }

  private slot(h: HalfView, i: number): Pt {
    const s = h.slots[i] ?? h.slots[0] ?? pt(96, 200);
    return { x: h.dir === 1 ? s.x : SCENE.width - s.x, y: s.y };
  }

  private pose(h: HalfView, i: number, t: number): Pose {
    const index = this.timeline.strikes.findIndex((s) => s.from === h.data.half && t >= s.start && t < s.end);
    const strike = this.timeline.strikes[index];
    let ct: number | null = null;
    let fire: FireKind | null = null;
    let atAir = false;
    if (strike) {
      fire = strike.fire;
      atAir = this.plan.strikes[index]?.atAir ?? false;
      const start = strike.figureStarts[i];
      const timing = figureTiming(strike.fire, h.data, i);
      if (start !== undefined && t >= start && t < start + timing.cycle * timing.cycles) ct = (t - start) % timing.cycle;
    }
    return { t, index: i, fire, ct, atAir, hp: hpAt(this.timeline, h.data.half, h.data.hp, t) };
  }

  private planShot(shot: Shot): PlannedShot {
    const from = this.halves[shot.from];
    const to = this.halves[shot.from === "left" ? "right" : "left"];
    const strike = this.timeline.strikes[shot.strike];
    const fire = strike?.fire ?? "rifle";
    const timing = figureTiming(fire, from.data, shot.shooterFigure);
    const start = strike?.figureStarts[shot.shooterFigure] ?? shot.fireAt;
    const ct = (shot.fireAt - start) % timing.cycle;
    const shotIndex = Math.max(0, timing.shots.indexOf(ct));
    const atAir = this.plan.strikes[shot.strike]?.atAir ?? false;
    const pose: Pose = { t: shot.fireAt, index: shot.shooterFigure, fire, ct, atAir, hp: 10 };
    const m = from.rig.muzzle(pose, shotIndex, from.look);
    const origin = this.slot(from, shot.shooterFigure);
    const base = this.slot(to, shot.targetFigure);
    // Shots that don't take a figure down land around it, not all on one pixel.
    const spread = shot.kills ? 0 : 1;
    const jx = Math.round((hash(shot.fireAt, 3) - 0.5) * 14 * spread);
    const jy = Math.round((hash(shot.fireAt, 5) - 0.5) * 8 * spread);
    const muzzle = { x: origin.x + from.dir * m.x, y: origin.y + m.y };
    const upward = atAir && from.rig.body !== "air";
    // Rounds fired up at an aircraft burst under its belly.
    const target = upward
      ? { x: base.x + jx, y: base.y + to.rig.hit.y + 6 + Math.abs(jy) }
      : { x: base.x + to.dir * to.rig.hit.x + jx, y: base.y + to.rig.hit.y + jy };
    const angle = m.angle ?? Math.atan2(target.y - muzzle.y, Math.abs(target.x - muzzle.x));
    return {
      ...shot,
      fire,
      atAir,
      muzzle,
      heading: { x: from.dir * Math.cos(angle), y: Math.sin(angle) },
      upward,
      target,
      targetBase: base,
      targetBody: to.rig.body,
      targetView: to.view,
    };
  }

  // ---- A frame ----

  render(t: number): void {
    const { ctx } = this.p;
    ctx.save();
    ctx.globalAlpha = 1;
    ctx.fillStyle = C("battlePanel");
    ctx.fillRect(0, 0, SCENE.width, SCENE.height);
    const slide = 1 - Math.pow(1 - clamp01(t / SCENE_MS.intro), 3);
    for (const h of [this.halves.left, this.halves.right]) {
      ctx.save();
      ctx.translate(Math.round(-h.dir * (1 - slide) * SCENE.half), 0);
      this.renderHalf(h, t);
      this.renderPanels(h, t);
      ctx.restore();
    }
    // What's in flight crosses the line between the halves.
    ctx.save();
    ctx.beginPath();
    ctx.rect(0, SCENE.top, SCENE.width, SCENE.bottom - SCENE.top);
    ctx.clip();
    for (const shot of this.shots) this.drawMissile(shot, t);
    ctx.restore();
    this.p.rect(SCENE.half - 1, 0, 2, SCENE.height, C("battleInk"));
    ctx.restore();
  }

  private renderHalf(h: HalfView, t: number): void {
    const { ctx } = this.p;
    ctx.save();
    ctx.beginPath();
    ctx.rect(h.x0, SCENE.top, SCENE.half, SCENE.bottom - SCENE.top);
    ctx.clip();
    const shake = this.shakeAt(h, t);
    ctx.translate(shake, Math.round(shake / 2));
    drawBackdrop(this.p, h.x0, h.data.terrain, h.view, t, h.dir);

    const order = Array.from({ length: h.figures }, (_, i) => i).sort((a, b) => this.slot(h, a).y - this.slot(h, b).y);
    if (SHADOW[h.data.kind] > 0) {
      ctx.save();
      ctx.globalAlpha = 0.28;
      for (const i of order) {
        const died = h.deaths.get(i);
        if (died !== undefined && h.rig.body === "soldier" && t > died + 1100 && !h.rig.gearStays?.(h.look)) continue;
        const s = this.slot(h, i);
        this.p.ellipse(s.x - h.dir * 2, s.y, SHADOW[h.data.kind], 3, C("battleInk"));
      }
      ctx.restore();
    }
    for (const i of order) this.drawFigure(h, i, t);
    for (const i of order) this.drawWreckage(h, i, t);
    this.drawShooterEffects(h, t);
    for (const shot of this.shots) if (shot.from !== h.data.half) this.drawImpact(shot, t);
    ctx.restore();
  }

  private shakeAt(h: HalfView, t: number): number {
    const big = this.shots.some((s) => s.from !== h.data.half && BLAST[s.fire] === "large" && t >= s.landAt && t < s.landAt + 180);
    const death = h.rig.body !== "soldier" && [...h.deaths.values()].some((d) => t >= d && t < d + 220);
    if (!big && !death) return 0;
    return Math.round((hash(Math.floor(t / 40), 77) - 0.5) * 4);
  }

  // ---- Figures ----

  private drawFigure(h: HalfView, i: number, t: number): void {
    const died = h.deaths.get(i);
    const age = died === undefined ? -1 : t - died;
    if (age > 1100 && h.rig.body === "soldier" && !h.rig.gearStays?.(h.look)) return;
    if (age > 1400 && h.rig.body === "air") return;
    const pose = this.pose(h, i, t);
    const alive = age < 0;
    const flash = alive && this.shots.some((s) => s.from !== h.data.half && s.targetFigure === i && t >= s.landAt && t < s.landAt + 70 && s.landAt < (died ?? Infinity));

    const f = this.fig.ctx;
    f.clearRect(0, 0, FIGURE_BOX.w, FIGURE_BOX.h);
    f.save();
    f.translate(FIGURE_BOX.ox, FIGURE_BOX.oy);
    h.rig.draw(this.fig, alive ? pose : { ...pose, fire: null, ct: null, down: age }, h.look);
    f.restore();
    const tint = (color: string, alpha: number) => {
      f.save();
      f.globalCompositeOperation = "source-atop";
      f.globalAlpha = alpha;
      f.fillStyle = color;
      f.fillRect(0, 0, FIGURE_BOX.w, FIGURE_BOX.h);
      f.restore();
    };
    if (flash) tint(C("battleFlash"), 0.6);
    if (!alive && h.rig.body !== "soldier") tint(C("battleInk"), 0.55);

    const s = this.sil;
    s.clearRect(0, 0, FIGURE_BOX.w, FIGURE_BOX.h);
    s.globalCompositeOperation = "source-over";
    s.drawImage(this.figCanvas, 0, 0);
    s.globalCompositeOperation = "source-in";
    s.fillStyle = C("battleInk");
    s.fillRect(0, 0, FIGURE_BOX.w, FIGURE_BOX.h);
    s.globalCompositeOperation = "source-over";

    const at = this.slot(h, i);
    let dy = 0;
    let rotate = 0;
    // Soldiers draw their own fall; see Rig.gearStays.
    if (!alive) {
      if (h.rig.body === "air") {
        dy = Math.pow(age / 1000, 2) * 170;
        rotate = Math.min(0.7, age / 900);
      } else if (h.rig.body === "ship") {
        dy = Math.min(12, age / 90);
      }
    }
    const { ctx } = this.p;
    ctx.save();
    if (h.rig.body === "ship" && h.view !== "underwater") {
      ctx.beginPath();
      ctx.rect(h.x0, 0, SCENE.half, at.y + 3);
      ctx.clip();
    }
    ctx.translate(at.x, Math.round(at.y + dy));
    ctx.scale(h.dir, 1);
    ctx.rotate(rotate);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      ctx.drawImage(this.silCanvas, -FIGURE_BOX.ox + ox, -FIGURE_BOX.oy + oy);
    }
    ctx.drawImage(this.figCanvas, -FIGURE_BOX.ox, -FIGURE_BOX.oy);
    ctx.restore();
    const foam = WATERLINE[h.data.kind] ?? 0;
    if (h.rig.body === "ship" && h.view === "sea" && alive) this.p.rect(at.x - foam, at.y + 2, foam * 2, 1, C("battleFoam"));
  }

  /** Fire and smoke over machines that were knocked out; aircraft trail smoke as they fall. */
  private drawWreckage(h: HalfView, i: number, t: number): void {
    const died = h.deaths.get(i);
    if (died === undefined || t < died || h.rig.body === "soldier") return;
    const age = t - died;
    const at = this.slot(h, i);
    const hit = { x: at.x + h.dir * h.rig.hit.x, y: at.y + h.rig.hit.y };
    this.explosion(hit, age, "large", h.rig.body === "ship" ? "water" : "ground", i);
    if (h.rig.body === "air") {
      for (let k = 0; k < 8; k++) {
        const back = age - k * 70;
        if (back < 0) continue;
        const y = hit.y + Math.pow(back / 1000, 2) * 170;
        this.puff({ x: hit.x - h.dir * k * 4, y }, 3 + k * 0.6, 0.6 - k * 0.06, true);
      }
      return;
    }
    const sink = h.rig.body === "ship" ? Math.min(12, age / 90) : 0;
    if (age > 200) {
      for (let k = 0; k < 3; k++) {
        const fx = hit.x + (k - 1) * 5;
        const flicker = Math.floor((t + k * 37) / 70) % 3;
        this.p.rect(fx - 1, hit.y + sink - 3 - flicker, 3, 3 + flicker, k === 1 ? C("battleTracer") : C("battleFire"));
      }
      for (let k = 0; k < 6; k++) {
        const life = (t - died + k * 200) % 1200;
        const u = life / 1200;
        this.puff({ x: hit.x + Math.sin(u * 3 + k) * 3 + u * 10, y: hit.y + sink - 6 - u * 46 }, 3 + u * 8, 0.75 * (1 - u), true);
      }
    }
  }

  // ---- Effects ----

  private puff(at: Pt, r: number, alpha: number, dark = false): void {
    if (alpha <= 0) return;
    const { ctx } = this.p;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    this.p.disc(at.x, at.y, r, dark ? C("battleSmokeDark") : C("battleSmoke"));
    this.p.disc(at.x - r / 3, at.y - r / 3, r / 2, dark ? mix(C("battleSmokeDark"), C("battleSmoke"), 0.4) : C("battleCloud"));
    ctx.restore();
  }

  private explosion(at: Pt, age: number, size: Blast, surface: "ground" | "water" | "air" | "metal", seed: number): void {
    const dur = BLAST_MS[size];
    if (age < 0 || age > dur) return;
    const u = age / dur;
    const scale = size === "large" ? 1.7 : size === "medium" ? 1 : 0.4;
    if (surface === "water") {
      const h = (size === "large" ? 40 : size === "medium" ? 24 : 7) * Math.sin(Math.min(1, u * 1.3) * Math.PI);
      const w = size === "large" ? 10 : size === "medium" ? 6 : 2;
      this.p.rect(at.x - w / 2, at.y - h, w, h, C("battleFoam"));
      this.p.rect(at.x - w / 2 - 2, at.y - h * 0.6, w + 4, h * 0.6, C("battleSeaLight"));
      this.p.rect(at.x - w / 2, at.y - h, w, h * 0.5, C("battleFoam"));
      if (u < 0.15 && size !== "small") this.p.disc(at.x, at.y - 4, 5 * scale, C("battleFlash"));
      return;
    }
    if (size === "small") {
      if (surface === "metal") {
        for (let k = 0; k < 4; k++) {
          const a = hash(seed, k, 1) * Math.PI * 2;
          this.p.px(at.x + Math.cos(a) * u * 8, at.y + Math.sin(a) * u * 8, C("battleTracer"));
        }
      } else if (surface === "air") {
        this.puff(at, 2 + u * 3, 1 - u, true);
      } else {
        this.puff({ x: at.x, y: at.y + 6 - u * 6 }, 2 + u * 3, 0.9 * (1 - u));
        this.p.px(at.x - 2 + u * -3, at.y + 4 - u * 8, C("battleDirt"));
        this.p.px(at.x + 2 + u * 3, at.y + 3 - u * 7, C("battleDirt"));
      }
      return;
    }
    // Flash, fireball, then a smoke cloud; debris flies out.
    if (age < 70) this.p.disc(at.x, at.y, 8 * scale, C("battleFlash"));
    else if (age < 260) {
      const r = (6 + (age - 70) / 40) * scale;
      this.p.disc(at.x, at.y, r, C("battleFire"));
      this.p.disc(at.x - 1, at.y - 1, r * 0.55, C("battleTracer"));
    }
    if (age > 150) this.puff({ x: at.x, y: at.y - u * 16 * scale }, (6 + u * 8) * scale, 0.9 * (1 - u), surface === "metal" || surface === "air");
    if (surface !== "air") {
      for (let k = 0; k < 6; k++) {
        const vx = (hash(seed, k, 2) - 0.5) * 60 * scale;
        const vy = -(30 + hash(seed, k, 3) * 40) * scale;
        const s = age / 1000;
        const x = at.x + vx * s;
        const y = at.y + vy * s + 160 * s * s;
        if (s < 0.6) this.p.rect(x, y, 2, 2, surface === "metal" ? C("battleSteelDark") : C("battleDirt"));
      }
    }
  }

  /** Flashes, smoke and dust around the side that's firing. Flashes point the way the barrel does. */
  private drawShooterEffects(h: HalfView, t: number): void {
    for (const shot of this.shots) {
      if (shot.from !== h.data.half) continue;
      const age = t - shot.fireAt;
      if (age < 0 || age > 1600) continue;
      const m = shot.muzzle;
      const size = FLASH[shot.fire];
      const angle = Math.atan2(shot.heading.y, shot.heading.x);
      if (size > 0 && age < 90) {
        const s = age < 45 ? size : size * 0.6;
        const tip = { x: m.x + Math.cos(angle) * s * 1.6, y: m.y + Math.sin(angle) * s * 1.6 };
        this.p.line(m.x, m.y, tip.x, tip.y, C("battleFire"), Math.max(1, Math.round(s / 3)));
        this.p.disc(m.x + Math.cos(angle) * s * 0.5, m.y + Math.sin(angle) * s * 0.5, s * 0.55, C("battleFlash"));
        this.p.line(m.x - Math.sin(angle) * s * 0.7, m.y + Math.cos(angle) * s * 0.7, m.x + Math.sin(angle) * s * 0.7, m.y - Math.cos(angle) * s * 0.7, C("battleFire"));
      }
      if (size >= 5 && age < 900) {
        const u = age / 900;
        this.puff({ x: m.x + Math.cos(angle) * 6 * u - h.dir * u * 4, y: m.y + Math.sin(angle) * 6 * u - u * 10 }, 2 + u * size * 0.8, 0.8 * (1 - u));
      }
      if (GROUND_BLAST.has(shot.fire) && !shot.atAir && age < 700) {
        const u = age / 700;
        const ground = this.slot(h, shot.shooterFigure).y;
        for (let k = 0; k < 3; k++) this.puff({ x: m.x + h.dir * (k * 6 - 4) + h.dir * u * 10, y: ground - 3 - u * 4 }, 3 + u * 6, 0.7 * (1 - u));
      }
      if (shot.fire === "bazooka" && age < 1000) {
        // Backblast out of the rear of the tube.
        const u = age / 1000;
        const rear = { x: m.x - h.dir * 38, y: m.y };
        if (age < 80) this.p.disc(rear.x, rear.y, 5, C("battleFlash"));
        for (let k = 0; k < 4; k++) this.puff({ x: rear.x - h.dir * (k * 5 + u * 18), y: rear.y - u * 6 }, 3 + k + u * 6, 0.8 * (1 - u));
      }
      if (shot.fire === "rockets" && age < 1600) {
        // Rockets leave a dense cloud behind the launcher.
        const u = age / 1600;
        this.puff({ x: m.x - h.dir * (16 + u * 20), y: m.y + 4 - u * 8 }, 5 + u * 9, 0.75 * (1 - u));
      }
      if ((shot.fire === "mg" || shot.fire === "aaGuns" || shot.fire === "planeGuns" || shot.fire === "rifle") && age < 300 && h.rig.body !== "air") {
        const u = age / 300;
        this.p.px(m.x - h.dir * (12 + u * 4), m.y + u * 12 - Math.sin(u * Math.PI) * 4, C("battleBrass"));
      }
    }
  }

  private drawImpact(shot: PlannedShot, t: number): void {
    const age = t - shot.landAt;
    if (age < 0 || age > BLAST_MS[BLAST[shot.fire]]) return;
    const surface = shot.atAir
      ? "air"
      : shot.targetBody === "ship" || shot.fire === "torpedo" || shot.fire === "depthCharges"
        ? "water"
        : shot.targetBody === "machine"
          ? "metal"
          : "ground";
    const at = surface === "water" ? { x: shot.target.x, y: shot.targetBase.y + 1 } : surface === "ground" && BLAST[shot.fire] === "small" ? { x: shot.target.x, y: shot.targetBase.y - 4 } : shot.target;
    this.explosion(at, age, BLAST[shot.fire], shot.targetView === "underwater" ? "water" : surface, shot.fireAt);
  }

  /**
   * Where a shot is at progress u (0 to 1) and which way it's heading. Indirect fire leaves along
   * the barrel and arcs down onto the target, so a howitzer's flat barrel gives a flat arc and a
   * mortar's steep tube a high one. Ground fire at aircraft climbs out of its own half along the
   * barrel and comes up under the target from below. Bombs fall out of the bottom of their half and
   * in at the top of the other.
   */
  private missileAt(shot: PlannedShot, u: number, kind: Missile): { at: Pt; dir: Pt } | null {
    const m = shot.muzzle;
    const target = kind === "torpedo" ? { x: shot.target.x, y: shot.targetBase.y + 2 } : shot.target;
    const side = target.x > m.x ? 1 : -1;
    if (kind === "bomb") {
      if (u < 0.42) {
        const k = u / 0.42;
        return { at: { x: m.x + side * 12 * k, y: lerp(m.y, SCENE.bottom + 10, k * k) }, dir: { x: 0.2 * side, y: 1 } };
      }
      if (u < 0.58) return null;
      const k = (u - 0.58) / 0.42;
      return { at: { x: lerp(target.x - side * 30, target.x, k), y: lerp(SCENE.top - 12, target.y, k * k) }, dir: { x: 0.3 * side, y: 1 } };
    }
    if (shot.upward) {
      // Out along the barrel until it leaves the shooter's half, then up from under the target.
      const hx = shot.heading.x;
      const hy = Math.min(-0.05, shot.heading.y);
      const toTop = (m.y - (SCENE.top - 6)) / -hy;
      const edge = SCENE.half;
      const toEdge = hx === 0 ? Infinity : (edge - m.x) / hx;
      const out = Math.max(0, Math.min(toTop, toEdge > 0 ? toEdge : Infinity));
      const entry = { x: target.x - side * 14, y: SCENE.bottom + 6 };
      const inLen = Math.hypot(target.x - entry.x, target.y - entry.y);
      const split = out / (out + inLen);
      if (u < split) {
        const d = u * (out + inLen);
        return { at: { x: m.x + hx * d, y: m.y + hy * d }, dir: { x: hx, y: hy } };
      }
      const k = (u - split) / (1 - split);
      return { at: { x: lerp(entry.x, target.x, k), y: lerp(entry.y, target.y, k) }, dir: { x: (target.x - entry.x) / inLen, y: (target.y - entry.y) / inLen } };
    }
    if (kind === "lob" || kind === "rocketLob") {
      // Up and out of sight along the barrel, a pause while it's overhead, then down from high above.
      const total = shot.landAt - shot.fireAt;
      const elapsed = u * total;
      const up = kind === "rocketLob" ? INDIRECT_MS.rocketUp : INDIRECT_MS.up;
      if (elapsed <= up) {
        const hy = Math.min(-0.15, shot.heading.y);
        const reach = (m.y - (SCENE.top - 14)) / -hy;
        const k = elapsed / up;
        const d = reach * k * (0.6 + 0.4 * k);
        const at = { x: m.x + shot.heading.x * d, y: m.y + hy * d };
        // On the way up a round stays on its own side: it leaves the shooter's half, not into the other.
        if (side === 1 ? at.x > SCENE.half - 2 : at.x < SCENE.half + 2) return null;
        return { at, dir: { x: shot.heading.x, y: hy } };
      }
      if (elapsed < total - INDIRECT_MS.down) return null;
      const steep = Math.max(Math.abs(Math.atan2(shot.heading.y, Math.abs(shot.heading.x))), 1.15);
      const fall = { x: side * Math.cos(steep), y: Math.sin(steep) };
      const drop = (target.y - (SCENE.top - 14)) / fall.y;
      const k = (elapsed - (total - INDIRECT_MS.down)) / INDIRECT_MS.down;
      const d = drop * (1 - k * k);
      const at = { x: target.x - fall.x * d, y: target.y - fall.y * d };
      // Coming down, it appears only over the target's half.
      if (side === 1 ? at.x < SCENE.half + 2 : at.x > SCENE.half - 2) return null;
      return { at, dir: fall };
    }
    if (kind === "charge") {
      const hx = Math.abs(shot.heading.x) < 0.15 ? 0.15 * side : shot.heading.x;
      const reach = Math.abs(target.x - m.x) / 2 / Math.abs(hx);
      const c = { x: m.x + hx * reach, y: m.y + shot.heading.y * reach };
      const v = 1 - u;
      const at = { x: v * v * m.x + 2 * v * u * c.x + u * u * target.x, y: v * v * m.y + 2 * v * u * c.y + u * u * target.y };
      const dx = 2 * v * (c.x - m.x) + 2 * u * (target.x - c.x);
      const dy = 2 * v * (c.y - m.y) + 2 * u * (target.y - c.y);
      const len = Math.hypot(dx, dy) || 1;
      return { at, dir: { x: dx / len, y: dy / len } };
    }
    const len = Math.hypot(target.x - m.x, target.y - m.y) || 1;
    return { at: { x: lerp(m.x, target.x, u), y: lerp(m.y, target.y, u) }, dir: { x: (target.x - m.x) / len, y: (target.y - m.y) / len } };
  }

  private drawMissile(shot: PlannedShot, t: number): void {
    if (t < shot.fireAt || t > shot.landAt) return;
    const u = (t - shot.fireAt) / (shot.landAt - shot.fireAt);
    const kind = MISSILE[shot.fire];
    const here = this.missileAt(shot, u, kind);
    if (!here) return;
    const { at, dir } = here;
    const p = this.p;
    const trail = (count: number, gap: number, start: number) => {
      for (let k = 1; k < count; k++) {
        const back = this.missileAt(shot, Math.max(0, u - (k * gap) / 1000), kind);
        if (back) this.puff({ x: back.at.x, y: back.at.y - k * 0.3 }, start + k * 0.5, 0.65 - k * (0.6 / count));
      }
    };
    if (kind === "bullet") {
      p.line(at.x - dir.x * 5, at.y - dir.y * 5, at.x, at.y, C("battleTracer"));
    } else if (kind === "shell") {
      p.line(at.x - dir.x * 9, at.y - dir.y * 9, at.x, at.y, C("battleTracer"), 2);
      p.px(at.x, at.y, C("battleFlash"));
    } else if (kind === "rocket") {
      p.line(at.x - dir.x * 6, at.y - dir.y * 6, at.x, at.y, C("battleSteelDark"), 2);
      p.rect(at.x - dir.x * 8 - 1, at.y - dir.y * 8 - 1, 3, 3, C("battleFire"));
      trail(7, 12, 1.5);
    } else if (kind === "rocketLob") {
      p.line(at.x - dir.x * 5, at.y - dir.y * 5, at.x, at.y, C("battleSteelDark"), 2);
      p.px(at.x - dir.x * 6, at.y - dir.y * 6, C("battleFire"));
      trail(8, 18, 2);
    } else if (kind === "bomb") {
      p.ellipse(at.x, at.y, 2, 4, C("battleSteelDark"));
      p.rect(at.x - 2, at.y - 6, 4, 1, C("battleSteelDark"));
    } else if (kind === "torpedo") {
      // A dark shape just under the surface and a line of bubbles behind it.
      p.rect(at.x - 4, at.y, 8, 2, C("battleSeaDeep"));
      const side = dir.x > 0 ? 1 : -1;
      for (let k = 1; k < 10; k++) if ((k + Math.floor(t / 60)) % 2 === 0) p.px(at.x - side * k * 4, at.y - 1, C("battleFoam"));
    } else {
      // A shell or mortar round: a dark body with a glowing tracer behind it.
      p.rect(at.x - 1, at.y - 1, 3, 3, C("battleSteelDark"));
      p.line(at.x - dir.x * 5, at.y - dir.y * 5, at.x - dir.x * 2, at.y - dir.y * 2, C("battleTracer"), 2);
      p.px(at.x - dir.x * 6, at.y - dir.y * 6, C("battleFire"));
    }
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

  private drawText(text: string, x: number, y: number, color: string, scale: number, alignRight: boolean): void {
    const safe = text.toUpperCase().replace(/[^A-Z0-9 %+?-]/g, "");
    const c = this.textCanvas(safe, color);
    const w = c.width * scale;
    this.p.ctx.drawImage(c, alignRight ? x - w : x, y, w, c.height * scale);
  }

  private renderPanels(h: HalfView, t: number): void {
    const p = this.p;
    const right = h.dir === -1;
    const edge = right ? h.x0 + SCENE.half - 6 : h.x0 + 6;
    p.rect(h.x0, 0, SCENE.half, SCENE.top, C("battlePanel"));
    p.rect(h.x0, SCENE.top - 3, SCENE.half, 2, h.fill);
    const name = h.data.kind === "bunker" ? terrainName("bunker") : unitName(h.data.kind);
    this.drawText(name, edge, 3, C("labelText"), 2, right);

    p.rect(h.x0, SCENE.bottom, SCENE.half, SCENE.height - SCENE.bottom, C("battlePanel"));
    p.rect(h.x0, SCENE.bottom, SCENE.half, 1, h.fill);
    const hp = hpAt(this.timeline, h.data.half, h.data.hp, t);
    this.drawText(`HP ${hp}`, edge, SCENE.bottom + 5, C("labelText"), 2, right);
    for (let i = 0; i < 10; i++) {
      const x = right ? h.x0 + SCENE.half - 66 - (i + 1) * 11 : h.x0 + 66 + i * 11;
      p.rect(x, SCENE.bottom + 6, 9, 8, C("battleInk"));
      if (i < hp) p.rect(x + 1, SCENE.bottom + 7, 7, 6, h.fill);
    }
  }
}
