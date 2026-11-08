// The battle preview page (11-tech-setup §7): `?battle=demo` plays a battle for every unit in turn,
// so each one's animation can be checked without setting up a fight. `&a=mortar&d=infantry` plays
// just that matchup, over and over; `&at=forest&dt=beach` sets each side's terrain, and `&para=1`
// makes the attacking squad paratroopers with that card suit (0 spade, 1 heart, 2 diamond, 3 club).
// Press Z or click to move on to the next. `&t=1200` instead shows every matchup held at that
// moment, side by side (`&t=fire` or `&t=hit` for the first shot leaving or landing);
// `&zoom=0,150,192,72` enlarges one part of each and `&scale=1` sets the size.

import Phaser from "phaser";
import type { NationId } from "../../engine/data/nations";
import { TERRAIN_IDS, type TerrainId } from "../../engine/data/terrain";
import { UNIT_TYPE_IDS, type UnitTypeId } from "../../engine/data/units";
import { packColor } from "../artPack";
import { SCENE } from "./backdrops";
import { BattleScene } from "./BattleScene";
import { BattleRenderer } from "./renderer";
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
    const view = document.createElement("canvas");
    view.width = zw * scale;
    view.height = zh * scale;
    const ctx = view.getContext("2d");
    if (!ctx) return;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(source, zx, zy, zw, zh, 0, 0, zw * scale, zh * scale);
    view.title = `${m.a} vs ${m.d}`;
    root.append(view);
  }
}

export function startBattlePreview(root: HTMLElement, params: URLSearchParams): void {
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
