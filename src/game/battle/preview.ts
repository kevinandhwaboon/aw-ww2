// The battle preview page (11-tech-setup §7): `?battle=demo` plays a battle for every unit in turn,
// so each one's animation can be checked without setting up a fight. `&a=mortar&d=infantry` plays
// just that matchup, over and over; `&at=forest&dt=beach` sets each side's terrain, and `&para=1`
// makes the attacking squad paratroopers with that card suit (0 spade, 1 heart, 2 diamond, 3 club).
// Press Z or click to move on to the next. `&t=1200` instead shows every matchup held at that
// moment, side by side (`&t=fire` or `&t=hit` for the first shot leaving or landing);
// `&zoom=0,150,192,72` enlarges one part of each and `&scale=1` sets the size. `&storm=all` (or
// `capture`, `garrison`) shows the storming scenes instead, and `&t=end` holds each at its outcome.
// `&drop=on` shows airborne drops.

import Phaser from "phaser";
import type { NationId } from "../../engine/data/nations";
import { TERRAIN_IDS, type TerrainId } from "../../engine/data/terrain";
import { UNIT_TYPE_IDS, type UnitTypeId } from "../../engine/data/units";
import { packColor } from "../artPack";
import { SCENE } from "./backdrops";
import { BattleScene } from "./BattleScene";
import { BattleRenderer } from "./renderer";
import { showAngledSamples } from "./angled/samples";
import type { DropPlan } from "./drop";
import { DropRenderer } from "./dropRenderer";
import type { StormPlan, StormUnit } from "./storm";
import { StormRenderer } from "./stormRenderer";
import { fireKind, type BattlePlan, type FigureKind } from "./plan";

interface Matchup {
  readonly a: UnitTypeId;
  readonly d: FigureKind;
  readonly at?: TerrainId;
  readonly dt?: TerrainId;
  readonly weapon?: "primary" | "secondary";
  readonly counter?: "primary" | "secondary";
  readonly submerged?: boolean;
  /** The attacker is a US paratrooper squad, with this card suit. */
  readonly para?: number;
}

const MATCHUPS: readonly Matchup[] = [
  { a: "infantry", d: "infantry", dt: "forest", counter: "secondary" },
  { a: "infantry", d: "infantry", at: "hills", dt: "bocage", para: 1, counter: "secondary" },
  { a: "assaultInfantry", d: "mediumTank", dt: "road", counter: "secondary" },
  { a: "mortar", d: "infantry", dt: "bocage" },
  { a: "recon", d: "infantry", weapon: "secondary", counter: "secondary" },
  { a: "lightTank", d: "recon", dt: "road" },
  { a: "mediumTank", d: "mediumTank", at: "hills", counter: "primary" },
  { a: "heavyTank", d: "tankDestroyer", counter: "primary" },
  { a: "mediumTank", d: "halftrack", weapon: "secondary" },
  { a: "artillery", d: "mediumTank", dt: "city" },
  { a: "rocketArtillery", d: "infantry", dt: "factory" },
  { a: "mobileAA", d: "fighter", counter: "primary" },
  { a: "flakGun", d: "bomber" },
  { a: "fighter", d: "transportAircraft" },
  { a: "bomber", d: "heavyTank", dt: "plains" },
  { a: "battleship", d: "destroyer", at: "sea", dt: "sea", counter: "primary" },
  { a: "destroyer", d: "submarine", at: "sea", dt: "sea", submerged: true, counter: "primary" },
  { a: "submarine", d: "battleship", at: "sea", dt: "sea" },
  { a: "torpedoBoat", d: "landingCraft", at: "sea", dt: "beach" },
  { a: "infantry", d: "bunker", dt: "bunker" },
  { a: "mediumTank", d: "infantry", dt: "bunker", weapon: "secondary", counter: "secondary" },
  { a: "mobileAA", d: "bomber", counter: "primary" },
  { a: "tankDestroyer", d: "heavyTank", counter: "primary" },
];

function planFor(m: Matchup, flip: boolean): BattlePlan {
  const attackerNation: NationId = flip ? "germany" : "us";
  const defenderNation: NationId = flip ? "us" : "germany";
  const naval = (k: FigureKind) => ["battleship", "destroyer", "submarine", "landingCraft", "torpedoBoat"].includes(k);
  const left = {
    half: "left" as const,
    kind: m.a,
    owner: flip ? 1 : 0,
    nation: attackerNation,
    terrain: m.at ?? (naval(m.a) ? "sea" : "plains"),
    hp: 10,
    submerged: false,
    paratrooper: m.para !== undefined && m.a === "infantry" && !flip,
    suit: m.para ?? 0,
  };
  const right = {
    half: "right" as const,
    kind: m.d,
    owner: m.d === "bunker" ? null : flip ? 0 : 1,
    nation: m.d === "bunker" ? null : defenderNation,
    terrain: m.dt ?? (naval(m.d) ? "sea" : "plains"),
    hp: 10,
    submerged: m.submerged === true,
    paratrooper: false,
    suit: 0,
  };
  const air = (k: FigureKind) => k === "fighter" || k === "bomber" || k === "transportAircraft";
  const strikes: BattlePlan["strikes"][number][] = [
    { from: "left", fire: fireKind(m.a, m.weapon ?? "primary", m.d, m.submerged === true), hpBefore: 10, hpAfter: m.counter ? 6 : 3, atAir: air(m.d) },
  ];
  if (m.counter && m.d !== "bunker") {
    strikes.push({ from: "right", fire: fireKind(m.d, m.counter, m.a, false), hpBefore: 10, hpAfter: 7, atAir: air(m.a) });
  }
  return { left, right, strikes };
}

/** Every matchup held at one moment, side by side, drawn without Phaser so it shows even in a background tab. */
function showFrozen(root: HTMLElement, matchups: readonly Matchup[], at: string, zoom: readonly number[], flip: boolean, scaleParam: number): void {
  const [zx = 0, zy = 0, zw = SCENE.width, zh = SCENE.height] = zoom;
  const scale = scaleParam > 0 ? scaleParam : Math.max(1, Math.floor(Math.min((window.innerWidth - 24) / zw, 4)));
  root.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;padding:8px;overflow:auto;height:100vh;box-sizing:border-box";
  for (const m of matchups) {
    const source = document.createElement("canvas");
    source.width = SCENE.width;
    source.height = SCENE.height;
    const renderer = new BattleRenderer(planFor(m, flip), source);
    const first = renderer.timeline.shots[0];
    // "fire": just as the first shot leaves; "hit": just as it lands; or a time in ms.
    const t = at === "fire" ? (first?.fireAt ?? 0) + 30 : at === "hit" ? (first?.landAt ?? 0) + 60 : Number(at);
    renderer.render(t);
    show(root, source, [zx, zy, zw, zh], scale, `${m.a} vs ${m.d}`);
  }
}

/** Shows part of a rendered scene, enlarged with nearest-neighbor. */
function show(root: HTMLElement, source: HTMLCanvasElement, [zx, zy, zw, zh]: readonly [number, number, number, number], scale: number, title: string): void {
  const view = document.createElement("canvas");
  view.width = zw * scale;
  view.height = zh * scale;
  const ctx = view.getContext("2d");
  if (!ctx) return;
  ctx.imageSmoothingEnabled = false;
  ctx.drawImage(source, zx, zy, zw, zh, 0, 0, zw * scale, zh * scale);
  view.title = title;
  root.append(view);
}

/** Storming scenes for the preview (08-art-pipeline §19): a capture of every property, and every foot unit into a bunker. */
function stormPlans(params: URLSearchParams): StormPlan[] {
  const para = params.get("para") !== null;
  /** `before` 20 is a first capture (the squad storms in); less is a follow-up (the flag goes up). */
  const make = (kind: StormPlan["kind"], unit: StormUnit, terrain: TerrainId, before: number, after: number, owner: number, nation: NationId): StormPlan => ({
    kind,
    unit,
    owner,
    nation,
    hp: 10,
    paratrooper: para && unit === "infantry" && nation === "us",
    suit: Number(params.get("para") ?? 0) % 4 || 0,
    terrain,
    before: kind === "capture" ? before : 0,
    after: kind === "capture" ? after : 0,
    captured: kind === "capture" && after === 0,
    previousOwner: kind === "capture" ? 1 - owner : null,
    previousNation: kind === "capture" ? (nation === "us" ? "germany" : "us") : null,
  });
  const only = params.get("storm");
  const plans = [
    make("capture", "infantry", "city", 20, 10, 0, "us"),
    make("capture", "infantry", "city", 10, 0, 1, "germany"),
    make("capture", "infantry", "hq", 16, 6, 0, "us"),
    make("capture", "assaultInfantry", "factory", 20, 10, 1, "germany"),
    make("capture", "infantry", "airfield", 20, 10, 0, "us"),
    make("capture", "infantry", "port", 7, 0, 1, "germany"),
    make("garrison", "infantry", "bunker", 0, 0, 0, "us"),
    make("garrison", "assaultInfantry", "bunker", 0, 0, 1, "germany"),
    make("garrison", "mortar", "bunker", 0, 0, 0, "us"),
  ];
  return only === "capture" || only === "garrison" ? plans.filter((x) => x.kind === only) : plans;
}

function startStormPreview(root: HTMLElement, params: URLSearchParams): void {
  const plans = stormPlans(params);
  const frozen = params.get("t");
  if (frozen !== null) {
    const zoom = (params.get("zoom") ?? "").split(",").filter(Boolean).map(Number);
    const [zx = 0, zy = 0, zw = SCENE.width, zh = SCENE.height] = zoom;
    const scaleParam = Number(params.get("scale") ?? 0);
    const scale = scaleParam > 0 ? scaleParam : Math.max(1, Math.floor(Math.min((window.innerWidth - 24) / zw, 4)));
    root.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;padding:8px;overflow:auto;height:100vh;box-sizing:border-box";
    for (const plan of plans) {
      const source = document.createElement("canvas");
      source.width = SCENE.width;
      source.height = SCENE.height;
      const renderer = new StormRenderer(plan, source);
      // "end": the outcome, once everyone is inside and the flags have changed.
      renderer.render(frozen === "end" ? renderer.total - 400 : Number(frozen));
      show(root, source, [zx, zy, zw, zh], scale, `${plan.kind} ${plan.terrain}`);
    }
    return;
  }
  const scene = new BattleScene();
  new Phaser.Game({ type: Phaser.AUTO, parent: root, width: window.innerWidth, height: window.innerHeight, pixelArt: true, backgroundColor: packColor("uiBg"), scale: { mode: Phaser.Scale.NONE }, scene });
  const run = async () => {
    for (let i = 0; ; i++) {
      const plan = plans[i % plans.length];
      if (!plan) return;
      const started = performance.now();
      await scene.playStorm(plan);
      if (performance.now() - started < 50) return;
    }
  };
  void run();
}

/** Airborne drops for the preview: US paratroopers from a C-47, Germans from a Ju 52. */
function startDropPreview(root: HTMLElement, params: URLSearchParams): void {
  const suit = Number(params.get("para") ?? 1) % 4 || 0;
  const plans: DropPlan[] = [
    { unit: "infantry", owner: 0, nation: "us", hp: 10, paratrooper: true, suit, terrain: "plains" },
    { unit: "infantry", owner: 1, nation: "germany", hp: 10, paratrooper: false, suit: 0, terrain: "bocage" },
    { unit: "mortar", owner: 0, nation: "us", hp: 6, paratrooper: false, suit: 0, terrain: "road" },
  ];
  const frozen = params.get("t");
  if (frozen !== null) {
    const scaleParam = Number(params.get("scale") ?? 0);
    const scale = scaleParam > 0 ? scaleParam : Math.max(1, Math.floor(Math.min((window.innerWidth - 24) / SCENE.width, 4)));
    root.style.cssText = "display:flex;flex-wrap:wrap;gap:8px;padding:8px;overflow:auto;height:100vh;box-sizing:border-box";
    for (const plan of plans) {
      const source = document.createElement("canvas");
      source.width = SCENE.width;
      source.height = SCENE.height;
      const renderer = new DropRenderer(plan, source);
      renderer.render(frozen === "end" ? renderer.total - 400 : Number(frozen));
      show(root, source, [0, 0, SCENE.width, SCENE.height], scale, `drop ${plan.nation}`);
    }
    return;
  }
  const scene = new BattleScene();
  new Phaser.Game({ type: Phaser.AUTO, parent: root, width: window.innerWidth, height: window.innerHeight, pixelArt: true, backgroundColor: packColor("uiBg"), scale: { mode: Phaser.Scale.NONE }, scene });
  const run = async () => {
    for (let i = 0; ; i++) {
      const plan = plans[i % plans.length];
      if (!plan) return;
      const started = performance.now();
      await scene.playDrop(plan);
      if (performance.now() - started < 50) return;
    }
  };
  void run();
}

export function startBattlePreview(root: HTMLElement, params: URLSearchParams): void {
  if (params.get("angled") !== null) {
    showAngledSamples(root, params);
    return;
  }
  if (params.get("drop") !== null) {
    startDropPreview(root, params);
    return;
  }
  if (params.get("storm") !== null) {
    startStormPreview(root, params);
    return;
  }
  const a = params.get("a");
  const d = params.get("d");
  const isUnit = (v: string | null): v is UnitTypeId => v !== null && (UNIT_TYPE_IDS as readonly string[]).includes(v);
  const isTerrain = (v: string | null): v is TerrainId => v !== null && (TERRAIN_IDS as readonly string[]).includes(v);
  const at = params.get("at");
  const dt = params.get("dt");
  const chosen: readonly Matchup[] = isUnit(a)
    ? [{
        a,
        d: d === "bunker" ? "bunker" : isUnit(d) ? d : "infantry",
        ...(isTerrain(at) ? { at } : {}),
        ...(isTerrain(dt) ? { dt } : {}),
        ...(params.get("para") === null ? {} : { para: Number(params.get("para")) % 4 || 0 }),
      }]
    : MATCHUPS;
  const flip = params.get("flip") === "on";
  const frozen = params.get("t");
  if (frozen !== null) {
    showFrozen(root, chosen, frozen, (params.get("zoom") ?? "").split(",").filter(Boolean).map(Number), flip, Number(params.get("scale") ?? 0));
    return;
  }
  const scene = new BattleScene();
  new Phaser.Game({
    type: Phaser.AUTO,
    parent: root,
    width: window.innerWidth,
    height: window.innerHeight,
    pixelArt: true,
    backgroundColor: packColor("uiBg"),
    scale: { mode: Phaser.Scale.NONE },
    scene,
  });
  const run = async () => {
    for (let i = 0; ; i++) {
      const m = chosen[i % chosen.length];
      if (!m) return;
      const started = performance.now();
      await scene.play(planFor(m, flip !== (Math.floor(i / chosen.length) % 2 === 1)));
      if (performance.now() - started < 50) return; // nothing played: don't spin
    }
  };
  void run();
}
