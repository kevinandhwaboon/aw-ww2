// Paints one frame of a storming scene (08-art-pipeline §19): a squad running across open ground and
// through the door of the building it's capturing, or into a bunker, with covering fire, the capture
// count ticking down, and the flags changing. A pure function of time, like the battle renderer.

import { FLAG_COLORS, FLAGS } from "../placeholderFlags";
import { terrainName, unitName } from "../artPack";
import { drawPixelText, GLYPH_HEIGHT, textWidth } from "../pixelFont";
import { playerColors } from "../placeholderUnits";
import { CAPTURE_POINTS, type PlayerId } from "../../engine/state";
import type { NationId } from "../../engine/data/nations";
import { drawBackdrop, SCENE } from "./backdrops";
import type { Cutscene } from "./BattleScene";
import { C, mix, Painter, shade, teamShades } from "./paint";
import { along, clamp01, lerp, seg, type Look, type Pt } from "./rig";
import { drawGun, drawSoldier, GUN, sandbags, soldierFrame, squadGun } from "./soldiers";
import { capturePointsAt, coverFigures, flagHeight, isFollowUp, stormLength, stormTimes, STORM_MS, type StormPlan } from "./storm";
import { hash } from "./timeline";

const BOX = { w: 120, h: 100, ox: 50, oy: 80 };
const GROUND = 200;
/** The tall flagpole on the square that a capture's flags fly from. */
const FLAGPOLE = { x: 192, top: 74, base: 206 };

/** Where the building stands, where its door is, and where its flag flies. */
interface Building {
  readonly door: Pt;
  readonly pole: Pt;
  readonly windows: readonly Pt[];
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = w;
  c.height = h;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  ctx.imageSmoothingEnabled = false;
  return [c, ctx];
}

// ---- Buildings, drawn large ----

function stoneWall(p: Painter, x: number, y: number, w: number, h: number): void {
  const stone = C("battleStone");
  p.rect(x, y, w, h, stone);
  for (let row = 0; row * 4 < h; row++) {
    p.rect(x, y + row * 4 + 3, w, 1, shade(stone, 0.88));
    for (let k = (row % 2) * 5; k < w; k += 10) p.px(x + k, y + row * 4 + 1, shade(stone, 0.85));
  }
  p.rect(x + w - 3, y, 3, h, shade(stone, 0.8));
}

function windowAt(p: Painter, x: number, y: number, w: number, h: number, shutters: boolean): void {
  if (shutters) {
    p.rect(x - 3, y, 3, h, C("battleTree"));
    p.rect(x + w, y, 3, h, C("battleTree"));
    for (let k = 1; k < h; k += 2) {
      p.px(x - 2, y + k, C("battleTreeDark"));
      p.px(x + w + 1, y + k, C("battleTreeDark"));
    }
  }
  p.rect(x, y, w, h, C("battleInk"));
  p.rect(x + 1, y + 1, Math.floor(w / 2) - 1, Math.floor(h / 2) - 1, mix(C("battleSkyLow"), C("battleInk"), 0.4));
  p.rect(x + Math.floor(w / 2), y, 1, h, C("battleStone"));
  p.rect(x, y + Math.floor(h / 2), w, 1, C("battleStone"));
  p.rect(x - 1, y + h, w + 2, 2, shade(C("battleStone"), 1.1));
}

/** A half-timbered Normandy house: white plaster between dark oak beams, a steep roof. */
function timbered(p: Painter, x: number, w: number, top: number, roof: string): void {
  const plaster = shade(C("battleStone"), 1.12);
  const beam = shade(C("battleWood"), 0.5);
  p.rect(x, top, w, GROUND - top, plaster);
  p.rect(x, top, w, 2, beam);
  p.rect(x, top + 16, w, 2, beam);
  for (let bx = x; bx <= x + w - 2; bx += 8) p.rect(bx, top, 2, GROUND - top, beam);
  for (let bx = x; bx < x + w - 8; bx += 16) p.line(bx + 2, top + 16, bx + 8, top + 2, beam, 2);
  p.poly([[x - 3, top], [x + w / 2, top - w * 0.6], [x + w + 3, top]], roof);
  windowAt(p, x + 5, top + 22, 8, 10, true);
}

/**
 * A Normandy town, not a single house: a skyline of roofs and a church spire behind, and on the
 * square in front the mairie (town hall) with its clock, a half-timbered house, and a café with a
 * striped awning. The squad storms the mairie.
 */
function townSquare(p: Painter): Building {
  const slate = mix(C("battleSteel"), C("battleSkyTop"), 0.15);
  const far = (c: string) => mix(c, C("battleSkyLow"), 0.4);
  // The rest of the town behind: rooftops and the church spire, hazy with distance.
  for (let x = 0; x < SCENE.width; x += 26) {
    const h = 14 + Math.floor(hash(x, 5) * 16);
    p.rect(x, SCENE.horizon - h, 22, h, far(C("battleStone")));
    p.poly([[x - 2, SCENE.horizon - h], [x + 11, SCENE.horizon - h - 10], [x + 24, SCENE.horizon - h]], far(hash(x, 7) > 0.5 ? slate : C("battleRoof")));
    p.rect(x + 6, SCENE.horizon - h + 5, 3, 4, far(C("battleInk")));
  }
  p.rect(150, SCENE.horizon - 58, 16, 58, far(C("battleStone")));
  p.poly([[148, SCENE.horizon - 58], [158, SCENE.horizon - 96], [168, SCENE.horizon - 58]], far(slate));
  p.rect(155, SCENE.horizon - 50, 6, 8, far(C("battleInk")));
  p.rect(157, SCENE.horizon - 104, 2, 8, far(C("battleSteelDark")));
  p.rect(154, SCENE.horizon - 101, 8, 2, far(C("battleSteelDark")));
  // The square: cobbles from the edge of town to the buildings.
  const cobble = C("battleRoad");
  p.poly([[90, GROUND + 22], [130, GROUND - 6], [SCENE.width, GROUND - 6], [SCENE.width, GROUND + 22]], cobble);
  for (let y = GROUND - 4; y < GROUND + 22; y += 3) {
    for (let x = 100 + ((y / 3) % 2) * 3; x < SCENE.width; x += 6) p.px(x, y, shade(cobble, 0.85));
  }
  // The mairie: dressed stone, tall shuttered windows, a clock in the pediment, steps to the door.
  stoneWall(p, 214, 112, 64, GROUND - 112);
  p.poly([[210, 112], [246, 92], [282, 112]], slate);
  p.disc(246, 104, 5, C("battleStone"));
  p.disc(246, 104, 4, shade(C("battleStone"), 1.15));
  p.line(246, 104, 246, 101, C("battleInk"));
  p.line(246, 104, 248, 105, C("battleInk"));
  const windows: Pt[] = [];
  for (const [wx, wy] of [[222, 124], [262, 124], [222, 156], [262, 156]] as const) {
    windowAt(p, wx, wy, 9, 16, true);
    windows.push({ x: wx + 4, y: wy + 8 });
  }
  p.rect(238, 166, 16, GROUND - 166, shade(C("battleWood"), 0.6));
  p.disc(246, 167, 8, shade(C("battleWood"), 0.6));
  p.rect(245, 166, 2, GROUND - 166, shade(C("battleWood"), 0.4));
  p.rect(234, 154, 24, 3, shade(C("battleStone"), 0.85));
  p.rect(232, GROUND - 2, 28, 3, shade(C("battleStone"), 0.7));
  // A half-timbered house, then the café with its awning, tables and a lamp post.
  timbered(p, 280, 40, 120, shade(C("battleRoof"), 0.9));
  windows.push({ x: 289, y: 147 });
  stoneWall(p, 322, 118, 62, GROUND - 118);
  p.poly([[318, 118], [353, 100], [388, 118]], slate);
  windowAt(p, 332, 128, 9, 12, true);
  windowAt(p, 360, 128, 9, 12, true);
  for (let x = 324; x < 382; x += 6) p.poly([[x, 156], [x + 6, 156], [x + 8, 166], [x + 2, 166]], x % 12 === 0 ? C("labelWarning") : C("battleStar"));
  p.rect(328, 168, 44, GROUND - 168, C("battleInk"));
  p.rect(330, 170, 18, 12, mix(C("battleSkyLow"), C("battleInk"), 0.4));
  for (const tx of [334, 358]) {
    p.rect(tx, GROUND + 2, 10, 2, shade(C("battleWood"), 0.6));
    p.rect(tx + 4, GROUND + 4, 2, 6, shade(C("battleWood"), 0.6));
  }
  p.rect(206, 150, 2, GROUND - 150, C("battleSteelDark"));
  p.rect(203, 146, 8, 5, C("battleSteelDark"));
  p.rect(204, 147, 6, 3, C("battleTracer"));
  return { door: { x: 246, y: GROUND }, pole: { x: 246, y: 92 }, windows };
}

/** An airfield's runway in front of the hangar: concrete, a dashed centre line, threshold bars. */
function runway(p: Painter): void {
  const concrete = mix(C("battleConcrete"), C("battleRoad"), 0.3);
  p.poly([[0, GROUND + 3], [30, GROUND - 4], [SCENE.width, GROUND - 4], [SCENE.width, GROUND + 3]], shade(concrete, 0.9));
  p.rect(0, GROUND + 3, SCENE.width, 19, concrete);
  p.rect(0, GROUND + 3, SCENE.width, 1, C("battleStar"));
  p.rect(0, GROUND + 21, SCENE.width, 1, C("battleStar"));
  for (let x = 40; x < SCENE.width; x += 26) p.rect(x, GROUND + 12, 14, 2, C("battleStar"));
  for (let k = 0; k < 5; k++) p.rect(6, GROUND + 5 + k * 3, 20, 2, C("battleStar"));
  for (let x = 4; x < SCENE.width; x += 32) {
    p.px(x, GROUND + 2, C("battleTracer"));
    p.px(x, GROUND + 22, C("battleTracer"));
  }
  for (let i = 0; i < 40; i++) p.px(Math.floor(hash(i, 3) * SCENE.width), GROUND + 4 + Math.floor(hash(i, 5) * 16), shade(concrete, 0.82));
  // A windsock on its mast.
  p.rect(180, 150, 1, 50, C("battleSteelDark"));
  p.poly([[181, 150], [196, 152], [196, 155], [181, 156]], C("labelWarning"));
  p.rect(186, 151, 3, 5, C("battleStar"));
}

function chateau(p: Painter): Building {
  // A chateau: a central block with a steep roof and dormers, two round towers with conical roofs.
  const slate = mix(C("battleSteel"), C("battleSkyTop"), 0.15);
  stoneWall(p, 236, 108, 112, GROUND - 108);
  p.poly([[230, 108], [246, 78], [338, 78], [354, 108]], slate);
  for (const dx of [256, 284, 312]) {
    p.rect(dx, 86, 12, 14, C("battleStone"));
    p.poly([[dx - 2, 86], [dx + 6, 78], [dx + 14, 86]], slate);
    p.rect(dx + 3, 89, 6, 8, C("battleInk"));
  }
  for (const tx of [214, 340]) {
    stoneWall(p, tx, 100, 26, GROUND - 100);
    p.poly([[tx - 3, 100], [tx + 13, 58], [tx + 29, 100]], shade(slate, 0.9));
    windowAt(p, tx + 8, 120, 10, 16, false);
    windowAt(p, tx + 8, 156, 10, 16, false);
  }
  const windows: Pt[] = [];
  for (const [wx, wy] of [[248, 120], [318, 120], [248, 156], [318, 156], [283, 120]] as const) {
    windowAt(p, wx, wy, 12, 18, true);
    windows.push({ x: wx + 6, y: wy + 9 });
  }
  // Grand double door under a pediment, steps.
  p.poly([[276, 160], [292, 150], [308, 160]], C("battleStone"));
  p.rect(280, 162, 24, GROUND - 162, shade(C("battleWood"), 0.6));
  p.rect(291, 162, 2, GROUND - 162, shade(C("battleWood"), 0.4));
  p.rect(274, GROUND - 3, 36, 3, shade(C("battleStone"), 0.75));
  return { door: { x: 292, y: GROUND }, pole: { x: 292, y: 78 }, windows };
}

function factoryHall(p: Painter, t: number): Building {
  const brick = shade(C("battleRoof"), 0.85);
  const brickLo = shade(brick, 0.75);
  const glass = mix(C("battleSkyLow"), C("battleSteel"), 0.35);
  p.rect(212, 116, 160, GROUND - 116, brick);
  for (let y = 119; y < GROUND; y += 3) p.rect(212, y, 160, 1, brickLo);
  for (let i = 0; i < 6; i++) {
    const tx = 212 + i * 27;
    p.poly([[tx, 116], [tx + 27, 116], [tx + 27, 98]], C("battleSteel"));
    p.rect(tx + 23, 99, 4, 17, glass);
    p.line(tx, 116, tx + 27, 98, shade(C("battleSteel"), 1.2));
  }
  const windows: Pt[] = [];
  for (let i = 0; i < 4; i++) {
    const wx = 282 + i * 22;
    p.rect(wx, 130, 12, 24, C("battleInk"));
    p.rect(wx + 6, 130, 1, 24, brickLo);
    p.rect(wx, 141, 12, 1, brickLo);
    p.rect(wx + 1, 131, 4, 9, glass);
    windows.push({ x: wx + 6, y: 142 });
  }
  // The big sliding door, rolled half open on its rail.
  p.rect(222, 140, 42, GROUND - 140, C("battleInk"));
  p.rect(218, 136, 60, 3, C("battleSteelDark"));
  p.rect(250, 140, 26, GROUND - 140, shade(C("battleSteel"), 0.85));
  for (let x = 252; x < 276; x += 4) p.rect(x, 141, 1, GROUND - 141, C("battleSteelDark"));
  p.rect(232, 176, 14, 8, C("battleWood"));
  // Chimney and smoke.
  p.rect(354, 40, 10, 76, brick);
  p.rect(361, 40, 3, 76, brickLo);
  for (const by of [44, 66, 88]) p.rect(353, by, 12, 2, C("battleSteelDark"));
  for (let k = 0; k < 5; k++) {
    const life = (t / 1500 + k / 5) % 1;
    p.disc(359 - life * 30, 36 - life * 22, 4 + life * 9, mix(C("battleSmokeDark"), C("battleSmoke"), life));
  }
  return { door: { x: 236, y: GROUND }, pole: { x: 216, y: 98 }, windows };
}

function hangar(p: Painter): Building {
  // A hangar with a curved roof, its doors open on a dark interior where a tail fin shows.
  const steel = C("battleSteel");
  p.rect(212, 120, 156, GROUND - 120, steel);
  p.ellipse(290, 120, 78, 34, shade(steel, 1.1));
  p.rect(212, 120, 156, 2, shade(steel, 0.8));
  for (let x = 220; x < 368; x += 8) p.rect(x, 122, 1, GROUND - 122, shade(steel, 0.85));
  p.rect(234, 132, 80, GROUND - 132, C("battleInk"));
  p.poly([[262, GROUND - 4], [272, 150], [282, 150], [284, GROUND - 4]], shade(C("battleSteel"), 0.6));
  p.rect(230, 128, 88, 4, shade(steel, 0.7));
  // Control cabin on the side.
  p.rect(330, 96, 26, 24, C("battleStone"));
  p.rect(334, 100, 18, 8, C("battleSkyLow"));
  p.rect(328, 94, 30, 3, C("battleSteelDark"));
  return { door: { x: 250, y: GROUND }, pole: { x: 343, y: 94 }, windows: [{ x: 343, y: 104 }, { x: 300, y: 112 }] };
}

function warehouse(p: Painter): Building {
  // A quayside warehouse with a loading hoist, and a crane beside it.
  stoneWall(p, 220, 112, 140, GROUND - 112);
  p.poly([[214, 112], [290, 86], [366, 112]], shade(C("battleRoof"), 0.85));
  const windows: Pt[] = [];
  for (const [wx, wy] of [[300, 126], [328, 126], [300, 160], [328, 160], [252, 124]] as const) {
    windowAt(p, wx, wy, 12, 14, false);
    windows.push({ x: wx + 6, y: wy + 7 });
  }
  p.rect(236, 150, 30, GROUND - 150, shade(C("battleWood"), 0.65));
  for (let x = 238; x < 264; x += 5) p.rect(x, 151, 1, GROUND - 151, shade(C("battleWood"), 0.45));
  p.rect(248, 100, 8, 10, C("battleSteelDark"));
  p.line(252, 110, 252, 140, C("battleSteelDark"));
  p.rect(372, 50, 4, GROUND - 50, C("battleBrass"));
  p.line(374, 52, 330, 70, C("battleBrass"), 2);
  for (let x = 220; x < 360; x += 24) p.rect(x, GROUND + 2, 4, 5, C("battleSteelDark"));
  return { door: { x: 251, y: GROUND }, pole: { x: 290, y: 86 }, windows };
}

function bunkerBlock(p: Painter, look: Look, boarded: number): Building {
  // A large concrete casemate with a steel door in its side and a firing slit facing the enemy.
  const c = C("battleConcrete");
  p.poly([[232, GROUND], [240, 132], [254, 120], [352, 120], [366, 134], [372, GROUND]], c);
  p.rect(254, 120, 98, 3, shade(c, 1.15));
  p.rect(246, 112, 90, 8, shade(c, 0.85));
  for (let x = 250; x < 334; x += 6) p.disc(x, 112, 3, mix(C("battleTreeDark"), c, 0.3));
  for (let y = 130; y < GROUND; y += 8) p.rect(244, y, 120, 1, shade(c, 0.9));
  // Steel door on the near side.
  p.rect(244, 160, 18, GROUND - 160, C("battleSteelDark"));
  p.rect(244, 160, 18, 2, C("battleSteel"));
  p.px(258, 180, C("battleSteel"));
  // The firing slit, boarded up in the holder's color once they're inside (08-art-pipeline §15).
  p.rect(304, 146, 56, 10, C("battleInk"));
  p.rect(304, 156, 56, 2, shade(c, 1.2));
  const planks = Math.round(boarded * 4);
  for (let i = 0; i < planks; i++) p.rect(306 + i * 14, 147, 12, 8, i % 2 ? look.team.lo : look.team.mid);
  sandbags(p, 226, 380, GROUND + 4, 8);
  return { door: { x: 253, y: GROUND }, pole: { x: 300, y: 112 }, windows: [{ x: 330, y: 151 }] };
}

// ---- The scene ----

export class StormRenderer implements Cutscene {
  private readonly p: Painter;
  private readonly fig: Painter;
  private readonly figCanvas: HTMLCanvasElement;
  private readonly sil: CanvasRenderingContext2D;
  private readonly silCanvas: HTMLCanvasElement;
  private readonly text = new Map<string, HTMLCanvasElement>();
  private readonly look: Look;
  private readonly times: readonly { start: number; enter: number }[];
  private readonly length: { settled: number; total: number };
  private readonly cover: number;

  constructor(
    readonly plan: StormPlan,
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
    this.times = stormTimes(plan);
    this.length = stormLength(plan);
    this.cover = coverFigures(plan);
  }

  get total(): number {
    return this.length.total;
  }

  opacity(t: number): number {
    return Math.min(clamp01(t / 150), 1 - seg(t, this.length.settled, this.length.total));
  }

  /** Where a runner starts: spread in lanes over the open ground to the left. */
  private startOf(i: number): Pt {
    if (i < this.cover) return { x: 112 + i * 40, y: 214 - i * 10 };
    const lane = i % 4;
    return { x: -16 - Math.floor(i / 4) * 22 - lane * 6, y: 218 - lane * 7 };
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
    drawBackdrop(p, 0, "plains", "land", t, 1);
    drawBackdrop(p, SCENE.half, "plains", "land", t, 1);
    const followUp = isFollowUp(this.plan);
    // When the squad is all inside (or, for a follow-up, when the flag stops rising).
    const lastIn = followUp ? STORM_MS.intro + STORM_MS.haul : Math.max(...this.times.map((x) => x.enter), 0);
    const building = this.drawBuilding(t, lastIn);
    if (this.plan.terrain === "airfield") runway(p);
    else if (this.plan.terrain !== "city") {
      // A track through the grass to the door.
      p.poly([[0, 212], [0, 222], [building.door.x + 10, GROUND + 2], [building.door.x - 10, GROUND - 1]], mix(C("battleRoad"), C("battleGrass"), 0.3));
      p.rect(building.door.x - 12, GROUND - 2, 24, 4, shade(C("battleRoad"), 0.85));
    }
    if (this.plan.kind === "capture") this.drawFlagpole();

    // Runners, back to front.
    const order = this.times.map((_, i) => i).sort((a, b) => this.posAt(a, t).y - this.posAt(b, t).y);
    for (const i of order) this.drawRunner(i, t, building);
    this.drawCoverFire(t, building);
    if (followUp) this.drawHolders(t, lastIn);
    this.drawFlags(t, lastIn, building);
    ctx.restore();
    this.drawPanels(t, lastIn);
  }

  private posAt(i: number, t: number): Pt {
    const time = this.times[i];
    const from = this.startOf(i);
    if (!time || t < time.start) return from;
    const u = clamp01((t - time.start) / (time.enter - time.start));
    const door = this.doorTarget();
    return { x: lerp(from.x, door.x, u), y: lerp(from.y, door.y, u) };
  }

  private doorTarget(): Pt {
    const doors: Record<string, Pt> = { city: { x: 246, y: GROUND }, hq: { x: 292, y: GROUND }, factory: { x: 236, y: GROUND }, airfield: { x: 250, y: GROUND }, port: { x: 251, y: GROUND } };
    return doors[this.plan.terrain] ?? { x: 253, y: GROUND };
  }

  private drawBuilding(t: number, lastIn: number): Building {
    const p = this.p;
    switch (this.plan.terrain) {
      case "hq":
        return chateau(p);
      case "factory":
        return factoryHall(p, t);
      case "airfield":
        return hangar(p);
      case "port":
        return warehouse(p);
      case "city":
        return townSquare(p);
      default:
        return bunkerBlock(p, this.look, seg(t, lastIn + 100, lastIn + 450));
    }
  }

  /** One soldier running in, kneeling to give covering fire, or gone through the door. */
  private drawRunner(i: number, t: number, building: Building): void {
    const time = this.times[i];
    if (!time || t >= time.enter) return;
    const at = this.posAt(i, t);
    const covering = i < this.cover && t < time.start;
    this.drawFigureAt(at, building.door.x + 2, () => {
      if (covering) this.drawCoverMan(i, t, building, at);
      else this.drawRunnerBody(i, t);
    });
  }

  /** Draws one figure with its dark outline and shadow, cut off past `clipRight` (a doorway). */
  private drawFigureAt(at: Pt, clipRight: number, draw: () => void, facingLeft = false): void {
    const f = this.fig;
    f.ctx.clearRect(0, 0, BOX.w, BOX.h);
    f.ctx.save();
    f.ctx.translate(BOX.ox, BOX.oy);
    draw();
    f.ctx.restore();
    // Outline, then the figure.
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
    ctx.globalAlpha = 0.28;
    this.p.ellipse(at.x - 2, at.y, 10, 3, C("battleInk"));
    ctx.globalAlpha = 1;
    // A runner reaching the door goes through it: nothing past the doorway is drawn.
    ctx.beginPath();
    ctx.rect(0, 0, clipRight, SCENE.height);
    ctx.clip();
    ctx.translate(Math.round(at.x), Math.round(at.y));
    if (facingLeft) ctx.scale(-1, 1);
    for (const [ox, oy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) ctx.drawImage(this.silCanvas, -BOX.ox + ox, -BOX.oy + oy);
    ctx.drawImage(this.figCanvas, -BOX.ox, -BOX.oy);
    ctx.restore();
  }

  private drawRunnerBody(i: number, t: number): void {
    const p = this.fig;
    const look = this.look;
    const stride = Math.floor(t / 85 + i * 1.7) % 4;
    const bob = stride % 2 === 0 ? -1 : 0;
    const f = soldierFrame(0, bob, "run");
    const de = look.nation === "germany";
    const plan = this.plan;
    if (plan.unit === "infantry") {
      // Weapon held across the chest at port arms.
      const kind = squadGun(i, look);
      const butt = { x: f.frontShoulder.x - 6, y: f.hip };
      const angle = -0.75;
      const trigger = along(butt.x, butt.y, angle, GUN[kind].trigger);
      const fore = along(butt.x, butt.y, angle, GUN[kind].fore);
      drawSoldier(p, 0, bob, "run", look, { stride, back: trigger, front: fore, weapon: () => drawGun(p, butt.x, butt.y, angle, kind, look) });
      return;
    }
    const carrier = i % 2 === 0;
    if (plan.unit === "assaultInfantry" && carrier) {
      // The gunner runs with the launcher on his shoulder.
      const y = f.top + 2;
      drawSoldier(p, 0, bob, "run", look, {
        stride,
        back: { x: f.frontShoulder.x + 4, y: y + 4 },
        front: { x: f.frontShoulder.x + 12, y: y + 4 },
        weapon: () => {
          p.rect(-14, y - 1, 34, de ? 4 : 3, de ? C("battleSteelDark") : look.team.lo);
          if (de) p.rect(6, y - 9, 3, 12, C("battleSteel"));
        },
      });
      return;
    }
    if (plan.unit === "mortar" && carrier) {
      // The mortar tube over one shoulder, the bipod folded against it.
      drawSoldier(p, 0, bob, "run", look, {
        stride,
        back: { x: f.frontShoulder.x + 2, y: f.top + 1 },
        front: { x: f.frontShoulder.x + 8, y: f.top - 3 },
        weapon: () => {
          p.line(-12, f.top + 8, 14, f.top - 8, C("battleSteelDark"), 4);
          p.line(-4, f.top + 5, 6, f.top + 2, C("battleSteel"));
        },
      });
      return;
    }
    // The other man: a baseplate or a rocket bag on his back, a rifle or carbine in his hands.
    const kind = de ? "kar98" : "carbine";
    const butt = { x: f.frontShoulder.x - 6, y: f.hip };
    drawSoldier(p, 0, bob, "run", look, {
      stride,
      back: along(butt.x, butt.y, -0.75, GUN[kind].trigger),
      front: along(butt.x, butt.y, -0.75, GUN[kind].fore),
      weapon: () => {
        if (plan.unit === "mortar") {
          p.rect(-12, f.top + 1, 6, 12, C("battleSteel"));
          p.rect(-12, f.top + 1, 6, 1, shade(C("battleSteel"), 1.2));
        } else {
          p.rect(-12, f.top + 2, 5, 10, C("battleOlive"));
          for (let k = 0; k < 3; k++) p.px(-11 + k, f.top + 1, C("battleSteelDark"));
        }
        drawGun(p, butt.x, butt.y, -0.75, kind, look);
      },
    });
  }

  /** A cover man kneels and fires at the windows while the squad runs past him. */
  private drawCoverMan(i: number, t: number, building: Building, at: Pt): void {
    const p = this.fig;
    const look = this.look;
    const kind = squadGun(i, look);
    const window = building.windows[i % Math.max(1, building.windows.length)] ?? building.door;
    const angle = Math.atan2(window.y - (at.y - 26), window.x - at.x);
    const fired = this.shotTimes(i).some((s) => t >= s && t < s + 60);
    const recoil = fired ? 2 : 0;
    const f = soldierFrame(0, 0, "kneel", 1);
    const butt = { x: f.backShoulder.x - 1, y: f.top + 5 };
    drawSoldier(p, 0, 0, "kneel", look, {
      lean: 1,
      headDx: 1,
      back: along(butt.x, butt.y, angle, GUN[kind].trigger - recoil),
      front: along(butt.x, butt.y, angle, GUN[kind].fore - recoil),
      weapon: () => drawGun(p, butt.x, butt.y, angle, kind, look, recoil),
    });
  }

  private shotTimes(i: number): number[] {
    const time = this.times[i];
    if (!time) return [];
    const shots: number[] = [];
    for (let s = STORM_MS.intro + 120 + i * 90; s < time.start - 100; s += 260) shots.push(s);
    return shots;
  }

  /** Muzzle flashes, tracers to the windows, and breaking glass. */
  private drawCoverFire(t: number, building: Building): void {
    const p = this.p;
    for (let i = 0; i < this.cover; i++) {
      const at = this.startOf(i);
      const window = building.windows[i % Math.max(1, building.windows.length)] ?? building.door;
      const kind = squadGun(i, this.look);
      const f = soldierFrame(0, 0, "kneel", 1);
      const butt = { x: at.x + f.backShoulder.x - 1, y: at.y + f.top + 5 };
      const angle = Math.atan2(window.y - butt.y, window.x - butt.x);
      const muzzle = along(butt.x, butt.y, angle, GUN[kind].length);
      for (const s of this.shotTimes(i)) {
        const age = t - s;
        if (age >= 0 && age < 60) {
          p.disc(muzzle.x + Math.cos(angle) * 2, muzzle.y + Math.sin(angle) * 2, 2.5, C("battleFlash"));
          p.line(muzzle.x, muzzle.y, muzzle.x + Math.cos(angle) * 5, muzzle.y + Math.sin(angle) * 5, C("battleFire"));
        }
        const flight = 160;
        if (age >= 0 && age < flight) {
          const u = age / flight;
          const x = lerp(muzzle.x, window.x, u);
          const y = lerp(muzzle.y, window.y, u);
          p.line(x - Math.cos(angle) * 5, y - Math.sin(angle) * 5, x, y, C("battleTracer"));
        }
        const hit = age - flight;
        if (hit >= 0 && hit < 300) {
          for (let k = 0; k < 4; k++) {
            const a = hash(s, k) * Math.PI * 2;
            p.px(window.x + Math.cos(a) * hit * 0.03, window.y + Math.sin(a) * hit * 0.02 + hit * 0.02, C("battleSkyLow"));
          }
        }
      }
    }
  }

  private flag(x: number, y: number, nation: NationId | null, owner: PlayerId | null, t: number, scale = 1): void {
    if (nation === null) return;
    const rows = FLAGS[nation];
    const p = this.p;
    rows.forEach((row, ry) => {
      for (let rx = 0; rx < row.length; rx++) {
        const color = FLAG_COLORS[row[rx] ?? ""];
        if (!color) continue;
        const wave = Math.round(Math.sin(t / 140 + rx / 3) * (rx / row.length) * 1.5 * scale);
        p.rect(x + rx * scale, y + ry * scale + wave, scale, scale, color);
      }
    });
    // A streamer in the player's color, so two players of one nation can be told apart.
    if (owner !== null) p.rect(x, y + rows.length * scale + 1, 10 * scale, 2 * scale, playerColors(owner)[0]);
  }

  /** The tall flagpole on the square that a capture's flags fly from. */
  private drawFlagpole(): void {
    const p = this.p;
    p.rect(FLAGPOLE.x - 4, FLAGPOLE.base - 4, 9, 6, C("battleStone"));
    p.rect(FLAGPOLE.x - 4, FLAGPOLE.base - 4, 9, 1, shade(C("battleStone"), 1.15));
    p.rect(FLAGPOLE.x, FLAGPOLE.top, 2, FLAGPOLE.base - FLAGPOLE.top, C("battleSteelDark"));
    p.rect(FLAGPOLE.x, FLAGPOLE.top, 1, FLAGPOLE.base - FLAGPOLE.top, C("battleSteel"));
    p.disc(FLAGPOLE.x + 1, FLAGPOLE.top - 1, 2, C("battleBrass"));
    p.line(FLAGPOLE.x + 3, FLAGPOLE.top + 2, FLAGPOLE.x + 3, FLAGPOLE.base - 8, shade(C("battleStone"), 0.9));
  }

  /** A flag on the tall pole, `height` of the way up (1 = at the top). */
  private poleFlag(height: number, nation: NationId | null, owner: PlayerId | null, t: number): void {
    const travel = FLAGPOLE.base - 26 - (FLAGPOLE.top + 2);
    this.flag(FLAGPOLE.x + 2, FLAGPOLE.top + 2 + (1 - height) * travel, nation, owner, t, 2);
  }

  /**
   * Capture flags fly from the tall pole on the square. The old owner's flag starts at the top
   * (none on a neutral property). The captor's goes up from the bottom as far as the points taken:
   * all the way, and the old one comes down, when the capture completes (08-art-pipeline §19).
   * A garrison raises its flag on the bunker's roof.
   */
  private drawFlags(t: number, lastIn: number, building: Building): void {
    const p = this.p;
    const plan = this.plan;
    if (plan.kind === "capture") {
      const followUp = isFollowUp(plan);
      const target = plan.captured ? 1 : flagHeight(plan.after);
      const rise = followUp ? seg(t, STORM_MS.intro, STORM_MS.intro + STORM_MS.haul) : seg(t, lastIn + 200, lastIn + 1000);
      const from = followUp ? flagHeight(plan.before) : 0;
      const down = plan.captured ? (followUp ? seg(t, STORM_MS.intro + STORM_MS.haul * 0.5, lastIn) : seg(t, lastIn + 100, lastIn + 700)) : 0;
      if (down < 1) this.poleFlag(1 - down, plan.previousNation, plan.previousOwner, t);
      const height = lerp(from, target, rise);
      if (followUp || rise > 0) this.poleFlag(height, plan.nation, plan.owner, t);
      return;
    }
    const { pole } = building;
    const top = pole.y - 30;
    p.rect(pole.x, top, 1, 30, C("battleSteelDark"));
    p.px(pole.x, top - 1, C("battleBrass"));
    const rise = seg(t, lastIn + 300, lastIn + 900);
    if (rise > 0) this.flag(pole.x + 1, lerp(pole.y - 12, top, rise), plan.nation, plan.owner, t);
    // Rifle barrels poke out of the boarded slit.
    if (t > lastIn + 500) for (let k = 0; k < 3; k++) p.rect(358, 149 + k * 2, 6, 1, C("battleSteelDark"));
  }

  /**
   * A follow-up capture: the squad already holds the building. One soldier hauls the flag up the
   * pole hand over hand while two stand guard; they raise their rifles when the capture completes.
   */
  private drawHolders(t: number, lastIn: number): void {
    const look = this.look;
    const hauling = t >= STORM_MS.intro && t < lastIn;
    const cheer = this.plan.captured && t > lastIn + 100;
    // The hauler stands at the pole, facing it, pulling the rope down.
    const hand = Math.floor(t / 180) % 2;
    this.drawFigureAt({ x: FLAGPOLE.x - 10, y: FLAGPOLE.base + 2 }, SCENE.width, () => {
      const f = soldierFrame(0, 0, "stand");
      const high = { x: 11, y: f.top - 10 };
      const low = { x: 11, y: f.top + 2 };
      drawSoldier(this.fig, 0, 0, "stand", look, cheer
        ? { back: { x: 4, y: f.top - 12 }, front: { x: 8, y: f.top - 14 } }
        : hauling
          ? { back: hand ? high : low, front: hand ? low : high }
          : { front: { x: 11, y: f.top + 2 } });
    });
    for (const [x, y] of [[120, GROUND + 14], [150, GROUND + 6]] as const) {
      this.drawFigureAt({ x, y }, SCENE.width, () => {
        const kind = squadGun(x === 120 ? 0 : 2, look);
        const f = soldierFrame(0, 0, "stand");
        const angle = cheer ? -1.45 : -1.0;
        const butt = cheer ? { x: f.frontShoulder.x - 2, y: f.top - 2 } : { x: f.frontShoulder.x - 4, y: f.hip + 1 };
        drawSoldier(this.fig, 0, 0, "stand", look, {
          back: along(butt.x, butt.y, angle, GUN[kind].trigger),
          front: along(butt.x, butt.y, angle, GUN[kind].fore),
          weapon: () => drawGun(this.fig, butt.x, butt.y, angle, kind, look),
        });
      });
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

  private drawText(text: string, x: number, y: number, color: string, scale: number, align: "left" | "right" | "center"): void {
    const safe = text.toUpperCase().replace(/[^A-Z0-9 %+?-]/g, "");
    const c = this.textCanvas(safe, color);
    const w = c.width * scale;
    const left = align === "left" ? x : align === "right" ? x - w : x - Math.round(w / 2);
    this.p.ctx.drawImage(c, left, y, w, c.height * scale);
  }

  private drawPanels(t: number, lastIn: number): void {
    const p = this.p;
    const plan = this.plan;
    const fill = playerColors(plan.owner)[0];
    p.rect(0, 0, SCENE.width, SCENE.top, C("battlePanel"));
    p.rect(0, SCENE.top - 3, SCENE.width, 2, fill);
    this.drawText(unitName(plan.unit), 6, 3, C("labelText"), 2, "left");
    this.drawText(terrainName(plan.terrain), SCENE.width - 6, 3, C("labelText"), 2, "right");
    p.rect(0, SCENE.bottom, SCENE.width, SCENE.height - SCENE.bottom, C("battlePanel"));
    p.rect(0, SCENE.bottom, SCENE.width, 1, fill);
    if (plan.kind === "capture") {
      const points = capturePointsAt(plan, t);
      this.drawText(`CAPTURE ${points}`, 6, SCENE.bottom + 5, C("labelText"), 2, "left");
      for (let i = 0; i < CAPTURE_POINTS; i++) {
        const x = 120 + i * 13;
        p.rect(x, SCENE.bottom + 6, 11, 8, C("battleInk"));
        if (i < points) p.rect(x + 1, SCENE.bottom + 7, 9, 6, plan.previousOwner === null ? C("battleConcrete") : playerColors(plan.previousOwner)[0]);
      }
    } else {
      this.drawText(`HP ${plan.hp}`, 6, SCENE.bottom + 5, C("labelText"), 2, "left");
    }
    // The outcome, once everyone is inside (or the flag has stopped) and the flags have moved.
    if (t > lastIn + (isFollowUp(plan) ? 300 : 900)) {
      const words = plan.kind === "garrison" ? "GARRISONED" : plan.captured ? "CAPTURED" : `${plan.after} LEFT`;
      const color = plan.captured || plan.kind === "garrison" ? C("labelGold") : C("labelText");
      const y = 34;
      const w = textWidth(words) * 3 + 16;
      p.rect(SCENE.width / 2 - w / 2, y - 6, w, GLYPH_HEIGHT * 3 + 12, C("battlePanel"));
      p.rect(SCENE.width / 2 - w / 2, y - 6, w, 2, fill);
      this.drawText(words, SCENE.width / 2, y, color, 3, "center");
    }
  }
}

