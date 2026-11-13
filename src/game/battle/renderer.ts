// Paints one frame of a battle scene (08-art-pipeline §18) onto a small canvas, as a pure function of
// time: the two halves with their backgrounds, every figure in its pose, what's in flight, impacts,
// casualties, and the HP panels. The Phaser scene scales the canvas up with nearest-neighbor.

import { UNITS } from "../../engine/data/units";
import { terrainName, unitName } from "../artPack";
import { drawPixelText, GLYPH_HEIGHT, textWidth } from "../pixelFont";
import { playerColors } from "../placeholderUnits";
import { bomberRig, diveBomberRig, fighterRig, torpedoBomberRig, transportRig } from "./airNaval";
import { battleshipRig, carrierRig, destroyerRig, landingCraftRig, submarineRig, torpedoBoatRig } from "./ships";
import { backdropView, drawBackdrop, SCENE, type BackdropView } from "./backdrops";
import { polished } from "./angled/mesh";
import { rimLight } from "./colors";
import { BLAST, BattleEffects } from "./effects";
import { C, mix, Painter, ShadowPainter, teamShades } from "./paint";
import { figureCount, type BattleHalf, type BattlePlan, type FigureKind, type FireKind, type HalfId } from "./plan";
import { clamp01, seg, type Look, type Pose, type Pt, type Rig } from "./rig";
import { assaultRig, infantryRig, mortarRig } from "./soldiers";
import { buildTimeline, deathTimes, figureTiming, hash, hpAt, SCENE_MS, torpedoRun, type Shot, type Timeline } from "./timeline";
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
  diveBomber: diveBomberRig,
  torpedoBomber: torpedoBomberRig,
  battleship: battleshipRig,
  destroyer: destroyerRig,
  submarine: submarineRig,
  landingCraft: landingCraftRig,
  torpedoBoat: torpedoBoatRig,
  carrier: carrierRig,
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
  diveBomber: [pt(100, 110), pt(120, 170), pt(74, 56)],
  torpedoBomber: [pt(100, 120), pt(122, 176), pt(76, 64)],
  // Each naval unit is one ship.
  battleship: [pt(98, 204)],
  destroyer: [pt(98, 204)],
  submarine: [pt(98, 202)],
  landingCraft: [pt(96, 206)],
  torpedoBoat: [pt(100, 204)],
  carrier: [pt(98, 204)],
  bunker: [pt(96, 208)],
};
const SUBMERGED_SLOTS: readonly Pt[] = [pt(96, 182)];

/** Half-width of the shadow a figure casts on the ground; 0 for aircraft and ships. */
const SHADOW: Record<FigureKind, number> = {
  infantry: 11, assaultInfantry: 26, mortar: 24, recon: 26, halftrack: 34, lightTank: 28, mediumTank: 34,
  heavyTank: 42, tankDestroyer: 34, artillery: 30, rocketArtillery: 32, mobileAA: 34, flakGun: 34,
  fighter: 0, bomber: 0, transportAircraft: 0, diveBomber: 0, torpedoBomber: 0, battleship: 0, destroyer: 0, submarine: 0, landingCraft: 0, torpedoBoat: 0, carrier: 0,
  bunker: 40,
};

/**
 * A Torpedo Bomber's run (08-art-pipeline §18): at the bottom of its dive the aircraft flies at this
 * height, just over the water band of the sky backdrop, and this far forward of its place.
 */
const TORPEDO_SKIM = { y: SCENE.bottom - 42, forward: 16, spreadFrom: 120 };

export interface HalfView {
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

export interface PlannedShot extends Shot {
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
/**
 * Polish edge lighting reads a figure back pixel by pixel, so it only reads the part a figure can
 * reach: a soldier (with his rifle, launcher or mortar, standing or falling) stays inside this box.
 */
const SOLDIER_REACH = { x: FIGURE_BOX.ox - 62, y: FIGURE_BOX.oy - 82, w: 140, h: 96 };

function canvas(w: number, h: number, readBack = false): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d", { willReadFrequently: readBack });
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
  /** Polish: the machines' cast shadows for one half, gathered before they're laid on the ground. */
  private readonly shade: ShadowPainter;
  private readonly shadeCanvas: HTMLCanvasElement;
  private readonly text = new Map<string, HTMLCanvasElement>();
  private readonly effects: BattleEffects;

  constructor(
    readonly plan: BattlePlan,
    readonly canvasEl: HTMLCanvasElement,
  ) {
    const ctx = canvasEl.getContext("2d");
    if (!ctx) throw new Error("2D canvas not available");
    ctx.imageSmoothingEnabled = false;
    this.p = new Painter(ctx);
    const [fc, fctx] = canvas(FIGURE_BOX.w, FIGURE_BOX.h, true);
    this.figCanvas = fc;
    this.fig = new Painter(fctx);
    const [sc, sctx] = canvas(FIGURE_BOX.w, FIGURE_BOX.h);
    this.silCanvas = sc;
    this.sil = sctx;
    const [hc, hctx] = canvas(SCENE.width, SCENE.height);
    this.shadeCanvas = hc;
    this.shade = new ShadowPainter(hctx, C("battleShadeTint"));
    this.timeline = buildTimeline(plan);
    this.halves = { left: this.halfView(plan.left), right: this.halfView(plan.right) };
    this.shots = this.timeline.shots.map((s) => this.planShot(s));
    this.effects = new BattleEffects(this.p, this.halves, this.shots, (h, i) => this.slot(h, i));
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
    const run = this.swoop(from, shot.shooterFigure, pose);
    const rest = this.slot(from, shot.shooterFigure);
    const origin = { x: rest.x + run.dx, y: rest.y + run.dy };
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
    for (const shot of this.shots) this.effects.drawMissile(shot, t);
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
    if (SHADOW[h.data.kind] > 0 && (h.rig.body === "machine" || h.rig.body === "soldier") && polished()) this.castShadows(h, order, t);
    else if (SHADOW[h.data.kind] > 0) {
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
    this.effects.drawShooterEffects(h, t);
    for (const shot of this.shots) if (shot.from !== h.data.half) this.effects.drawImpact(shot, t);
    ctx.restore();
  }

  /**
   * Polish (08-art-pipeline §18): each machine casts its own shape on the ground, in the shade tint
   * at half strength, gathered on one layer first so overlapping shadows don't darken twice. A
   * wreck keeps its shadow. Soldiers cast their sprite, laid down on the ground the same way: the
   * higher a part of him, the further forward and toward the viewer its shadow falls.
   */
  private castShadows(h: HalfView, order: readonly number[], t: number): void {
    const s = this.shade.ctx;
    s.clearRect(0, 0, SCENE.width, SCENE.height);
    for (const i of order) {
      const at = this.slot(h, i);
      const died = h.deaths.get(i);
      const age = died === undefined ? -1 : t - died;
      const pose = this.pose(h, i, t);
      const shown = age < 0 ? pose : { ...pose, fire: null, ct: null, down: age };
      s.save();
      s.translate(at.x, at.y);
      s.scale(h.dir, 1);
      if (h.rig.body === "soldier") {
        if (age > 1100 && !h.rig.gearStays?.(h.look)) {
          s.restore();
          continue;
        }
        const f = this.fig.ctx;
        f.clearRect(0, 0, FIGURE_BOX.w, FIGURE_BOX.h);
        f.save();
        f.translate(FIGURE_BOX.ox, FIGURE_BOX.oy);
        h.rig.draw(this.fig, shown, h.look);
        f.restore();
        // Height up the sprite becomes distance along the ground: forward (x) and down (toward us).
        s.transform(1, 0, -0.55, -0.36, 0, 0);
        s.drawImage(this.figCanvas, -FIGURE_BOX.ox, -FIGURE_BOX.oy);
      } else {
        h.rig.draw(this.shade, shown, h.look);
      }
      s.restore();
    }
    // Whatever was drawn (sprites included, should a rig paint one directly) becomes plain shadow.
    s.save();
    s.globalCompositeOperation = "source-in";
    s.fillStyle = this.shade.shadowColor;
    s.fillRect(0, 0, SCENE.width, SCENE.height);
    s.restore();
    const { ctx } = this.p;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.drawImage(this.shadeCanvas, 0, 0);
    ctx.restore();
  }

  private shakeAt(h: HalfView, t: number): number {
    const big = this.shots.some((s) => s.from !== h.data.half && BLAST[s.fire] === "large" && t >= s.landAt && t < s.landAt + 180);
    const death = h.rig.body !== "soldier" && [...h.deaths.values()].some((d) => t >= d && t < d + 220);
    if (!big && !death) return 0;
    return Math.round((hash(Math.floor(t / 40), 77) - 0.5) * 4);
  }

  // ---- Figures ----

  /**
   * How far a figure is off its place: a Torpedo Bomber on its attack run dives toward the water,
   * forward toward the enemy, and pitches its nose down and then up (`pitch`, radians, nose down).
   */
  private swoop(h: HalfView, i: number, pose: Pose): { dx: number; dy: number; pitch: number } {
    if (pose.fire !== "aerialTorpedo" || h.rig.body !== "air") return { dx: 0, dy: 0, pitch: 0 };
    const { depth, pitch } = torpedoRun(pose.ct);
    const rest = this.slot(h, i);
    // Aircraft further back in the formation skim a little higher, so the three don't bunch up.
    const skim = TORPEDO_SKIM.y + (rest.y - TORPEDO_SKIM.spreadFrom) * 0.1;
    return { dx: h.dir * depth * TORPEDO_SKIM.forward, dy: depth * Math.max(0, skim - rest.y), pitch };
  }

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
    const polish = polished();
    // Polish: sprite figures (soldiers, aircraft) get the lit and shaded edges the 3D models have.
    if (polish && (h.rig.body === "soldier" || h.rig.body === "air")) {
      const r = h.rig.body === "soldier" ? SOLDIER_REACH : { x: 0, y: 0, w: FIGURE_BOX.w, h: FIGURE_BOX.h };
      const img = f.getImageData(r.x, r.y, r.w, r.h);
      rimLight(img.data, r.w, r.h, C("battleLightTint"), C("battleShadeTint"));
      f.putImageData(img, r.x, r.y);
    }
    if (flash) tint(C("battleFlash"), 0.6);
    if (!alive && h.rig.body !== "soldier") tint(C("battleInk"), 0.55);

    const s = this.sil;
    s.clearRect(0, 0, FIGURE_BOX.w, FIGURE_BOX.h);
    s.globalCompositeOperation = "source-over";
    s.drawImage(this.figCanvas, 0, 0);
    s.globalCompositeOperation = "source-in";
    s.fillStyle = polish ? mix(h.look.team.deep, C("battleShadeTint"), 0.6) : C("battleInk");
    s.fillRect(0, 0, FIGURE_BOX.w, FIGURE_BOX.h);
    s.globalCompositeOperation = "source-over";

    const run = alive ? this.swoop(h, i, pose) : { dx: 0, dy: 0, pitch: 0 };
    const rest = this.slot(h, i);
    const at = { x: rest.x + run.dx, y: rest.y + run.dy };
    let dy = 0;
    let rotate = run.pitch;
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
    if (h.rig.water && (h.view === "sea" || h.view === "shore")) {
      ctx.save();
      ctx.translate(at.x, at.y);
      ctx.scale(h.dir, 1);
      h.rig.water(this.p, pose, h.look, alive);
      ctx.restore();
    }
  }

  /** Fire and smoke over machines that were knocked out; aircraft trail smoke as they fall. */
  private drawWreckage(h: HalfView, i: number, t: number): void {
    const died = h.deaths.get(i);
    if (died === undefined || t < died || h.rig.body === "soldier") return;
    const age = t - died;
    const at = this.slot(h, i);
    const hit = { x: at.x + h.dir * h.rig.hit.x, y: at.y + h.rig.hit.y };
    this.effects.explosion(hit, age, "large", h.rig.body === "ship" ? "water" : "ground", i);
    if (h.rig.body === "air") {
      for (let k = 0; k < 8; k++) {
        const back = age - k * 70;
        if (back < 0) continue;
        const y = hit.y + Math.pow(back / 1000, 2) * 170;
        this.effects.puff({ x: hit.x - h.dir * k * 4, y }, 3 + k * 0.6, 0.6 - k * 0.06, true);
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
        this.effects.puff({ x: hit.x + Math.sin(u * 3 + k) * 3 + u * 10, y: hit.y + sink - 6 - u * 46 }, 3 + u * 8, 0.75 * (1 - u), true);
      }
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
