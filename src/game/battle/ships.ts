// Battle figures for ships (08-art-pipeline §18): one ship per unit, a 3D model turned 5° toward the
// viewer like the land machines (angled/shipModels.ts). Waves run along the hull from bow to stern,
// with a bow wave in front and a wake behind, so the ship always looks under way.

import { BATTLE_VIEW, drawMesh, screenAngle, screenPoint, type V3 } from "./angled/mesh";
import {
  beamAt, daihatsu, fletcher, gato, gyoraitei, iBoat, iowa, kagero, lct, ptBoat, sBoot, typeVII, waterline, yamato, zerstorer,
  type Launch, type Salvo, type ShipModel,
} from "./angled/shipModels";
import { C, mix, type Painter } from "./paint";
import { FIRE_TIMING } from "./timeline";
import { justFired, kick, kitOf, type Look, type Muzzle, type Pose, type Rig } from "./rig";

const V = BATTLE_VIEW;

/** Built models, by kind and everything that changes their shape (team, recoil, a torpedo sliding out). */
const cache = new Map<string, ShipModel>();
function memo(key: string, make: () => ShipModel): ShipModel {
  let m = cache.get(key);
  if (!m) {
    m = make();
    cache.set(key, m);
  }
  return m;
}

const bob = (pose: Pose) => Math.round(Math.sin(pose.t / 600 + pose.index * 1.7));

/** The ship, layer by layer, then the guard rails along the near deck edge. */
function drawShip(p: Painter, m: ShipModel, oy: number, look: Look): void {
  for (const layer of m.layers) drawMesh(p, layer, V, 0, oy);
  if (m.deck) {
    const rail = mix(look.team.hi, C("battleStar"), 0.3);
    let prev: { x: number; y: number } | null = null;
    for (const s of m.deck) {
      if (s.b < 1) continue;
      const q = screenPoint([s.x, -s.b, s.top + 1.4], V, 0, oy);
      if (prev) p.line(Math.round(prev.x), Math.round(prev.y), Math.round(q.x), Math.round(q.y), rail);
      prev = q;
    }
  }
}

/** Heads and helmets of the troops riding in a landing craft. */
function troops(p: Painter, m: ShipModel, oy: number, look: Look): void {
  for (const at of m.troops) {
    const h = screenPoint(at, V, 0, oy);
    const x = Math.round(h.x);
    const y = Math.round(h.y);
    p.rect(x, y - 2, 4, 2, C("battleSkin"));
    if (kitOf(look) === "jp") {
      p.rect(x - 1, y - 4, 5, 2, mix(look.team.cloth, C("battleKhaki"), 0.5));
      p.px(x - 1, y - 2, mix(look.team.cloth, C("battleSand"), 0.3));
    } else {
      p.rect(x - 1, y - 4, 6, 2, look.team.lo);
      p.px(x - 1, y - 2, look.team.deep);
    }
  }
}

const hash = (a: number, b: number) => {
  const s = Math.sin(a * 127.1 + b * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

interface WaveStyle {
  /** How fast the water runs past the hull, in pixels a second. */
  readonly speed: number;
  /** How high the bow wave piles up. */
  readonly bowWave: number;
}

/**
 * The sea along the near side of the hull: a band of water whose crest rises and falls in waves
 * that run from bow to stern, flecked with foam that streams aft, a bow wave piling up against the
 * stem with spray, and a churned wake behind the stern. Drawn over the hull's foot at the water level,
 * so the ship rides in the sea instead of sitting on it. A ship that's going down, or a craft run
 * aground, gets only the gently moving surface.
 */
function waves(p: Painter, m: ShipModel, oy: number, t: number, style: WaveStyle, moving: boolean, upTo = Infinity): void {
  const { bow, stern } = waterline(m.water);
  const end = Math.min(bow, upTo);
  const run = moving ? (t * style.speed) / 1000 : t / 400;
  const sea = C("battleSea");
  const light = C("battleSeaLight");
  const foam = C("battleFoam");
  const crestAt = (x: number) => Math.sin((x + run) / 5) * 1.25 + Math.sin((x * 0.55 + run * 0.8) / 2.7) * 0.5;
  const pileAt = (x: number) => (moving ? Math.max(0, 1 - (bow - x) / 18) * 2.6 * style.bowWave : 0);
  const line = new Map<number, { y: number; top: number }>();
  for (let x = Math.floor(stern); x <= Math.ceil(end); x++) {
    const w = screenPoint([x, -beamAt(m.water, x), 0], V, 0, oy);
    const sx = Math.round(w.x);
    const wy = Math.round(w.y);
    const crest = crestAt(x);
    const pile = pileAt(x);
    const top = wy - Math.max(0, Math.round(1.4 + crest + pile));
    // Down past the clip line under the hull (the renderer cuts ships off 3 below the waterline), so
    // the keel never shows however the ship bobs.
    p.rect(sx, top, 1, Math.max(wy + 5, 5) - top, sea);
    p.px(sx, top, crest + pile > 0.9 ? foam : light);
    if (crest < -0.6) p.px(sx, top + 2, light);
    line.set(sx, { y: wy, top });
  }
  if (!moving) return;
  // Foam streaming aft along the hull.
  const length = Math.max(1, end - stern);
  for (let k = 0; k * 15 < length; k++) {
    const x0 = Math.round(end - ((run * 1.15 + k * 15 + hash(k, 3) * 7) % length));
    const dash = 3 + Math.floor(hash(k, 5) * 4);
    for (let i = 0; i < dash; i++) {
      const at = line.get(x0 + i);
      if (at) p.px(x0 + i, at.top + 1, foam);
    }
  }
  // The bow wave curling off the stem, and spray thrown up by it.
  const b = screenPoint([bow, -beamAt(m.water, bow), 0], V, 0, oy);
  const bx = Math.round(b.x);
  const by = Math.round(b.y);
  const f = Math.floor(t / 90);
  const tall = Math.round(2 + 2.5 * style.bowWave);
  for (let i = 0; i < tall; i++) p.px(bx + 1 + Math.round(i * 0.7), by - tall + i + 1, foam);
  p.rect(bx - 3, by + 1, 6 + Math.round(style.bowWave * 3), 1, foam);
  p.rect(bx + 2, by + 3, 4 + Math.round(style.bowWave * 2), 1, light);
  for (let i = 0; i < 2 + Math.round(style.bowWave * 2); i++) {
    if (hash(i, f) > 0.45) p.px(bx - 2 + Math.round(hash(i, f + 7) * 7), by - tall - 1 - Math.round(hash(i, f + 3) * 3 * style.bowWave), foam);
  }
  // The wake churning behind the stern.
  const s = screenPoint([stern, -beamAt(m.water, stern), 0], V, 0, oy);
  const sx = Math.round(s.x);
  const sy = Math.round(s.y);
  const wf = Math.floor(t / 80);
  p.rect(sx - 16, sy + 1, 16, 1, light);
  for (let i = 1; i < 18; i++) if (hash(i, wf) > 0.35) p.px(sx - i, sy - 1 + Math.floor(hash(i, wf + 1) * 3), foam);
}

/** A ship rig: draws the model for this moment, and the sea along its hull. */
function shipRig(opts: {
  hit: { x: number; y: number };
  style: WaveStyle;
  model(pose: Pose, look: Look): ShipModel;
  rest(look: Look): ShipModel;
  /** Extra vertical motion: a battleship rolling as it fires. */
  roll?(pose: Pose): number;
  /** Ships run aground or under the sea sit still; the rest bob on the swell. */
  still?(look: Look): boolean;
  muzzle(pose: Pose, shot: number, look: Look, m: ShipModel): V3;
  /** A point further along the barrel that fires, so the shot leaves the way the barrel points. */
  aim?(pose: Pose, shot: number, look: Look, m: ShipModel): V3 | undefined;
}): Rig {
  const oyOf = (pose: Pose, look: Look, m: ShipModel) => m.lift + (opts.still?.(look) ? 0 : bob(pose)) + Math.round(opts.roll?.(pose) ?? 0);
  return {
    body: "ship",
    hit: opts.hit,
    draw(p, pose, look) {
      const m = opts.model(pose, look);
      const oy = oyOf(pose, look, m);
      drawShip(p, m, oy, look);
      troops(p, m, oy, look);
    },
    water(p, pose, look, alive) {
      const m = opts.rest(look);
      if (look.beached) {
        waves(p, m, m.lift, pose.t, opts.style, false, waterline(m.water).stern + 30);
        return;
      }
      waves(p, m, m.lift, pose.t, opts.style, alive);
    },
    muzzle(pose, shot, look): Muzzle {
      const m = opts.rest(look);
      const from = opts.muzzle(pose, shot, look, m);
      const at = screenPoint(from, V, 0, oyOf(pose, look, m));
      const aim = opts.aim?.(pose, shot, look, m);
      return aim ? { x: at.x, y: at.y, angle: screenAngle(from, aim, V) } : { x: at.x, y: at.y };
    },
  };
}

const team = (look: Look) => `${look.nation ?? ""}|${look.team.mid}`;

// ---- Battleship: turrets fire salvo by salvo; the ship rolls ----

const NO_SALVO: Salvo = { firing: -1, recoil: 0 };

function battleship(look: Look, salvo: Salvo): ShipModel {
  return memo(`bb|${team(look)}|${salvo.firing}|${salvo.recoil}`, () => (kitOf(look) === "jp" ? yamato(look.team, salvo) : iowa(look.team, salvo)));
}

function salvoOf(pose: Pose): Salvo {
  if (pose.fire !== "navalGuns" || pose.ct === null) return NO_SALVO;
  const ct = pose.ct;
  const firing = FIRE_TIMING.navalGuns.shots.findIndex((s) => ct >= s && ct < s + 260);
  if (firing < 0) return NO_SALVO;
  return { firing, recoil: Math.round(kick(ct, FIRE_TIMING.navalGuns.shots[firing] ?? 0, 40, 220) * 3) };
}

export const battleshipRig: Rig = shipRig({
  hit: { x: 0, y: -20 },
  style: { speed: 20, bowWave: 1 },
  model: (pose, look) => battleship(look, salvoOf(pose)),
  rest: (look) => battleship(look, NO_SALVO),
  roll(pose) {
    const ct = pose.fire === "navalGuns" ? pose.ct : null;
    return Math.max(...FIRE_TIMING.navalGuns.shots.map((s) => kick(ct, s, 60, 300)));
  },
  muzzle: (_pose, shot, _look, m) => m.at[`gun${Math.min(shot, 2)}`] ?? [80, 0, 18],
  aim: (_pose, shot, _look, m) => m.at[`aim${Math.min(shot, 2)}`],
});

// ---- Destroyer: the forward guns fire in turn; depth charges roll off the stern ----

function destroyer(look: Look, gun: Salvo): ShipModel {
  const kit = kitOf(look);
  return memo(`dd|${team(look)}|${gun.firing}|${gun.recoil}`, () => (kit === "jp" ? kagero(look.team, gun) : kit === "de" ? zerstorer(look.team, gun) : fletcher(look.team, gun)));
}

function deckGunOf(pose: Pose): Salvo {
  if (pose.fire !== "deckGun" || pose.ct === null) return NO_SALVO;
  const ct = pose.ct;
  const firing = FIRE_TIMING.deckGun.shots.findIndex((s) => ct >= s && ct < s + 240);
  if (firing < 0) return NO_SALVO;
  return { firing, recoil: Math.round(kick(ct, FIRE_TIMING.deckGun.shots[firing] ?? 0, 40, 200) * 2) };
}

export const destroyerRig: Rig = shipRig({
  hit: { x: 0, y: -14 },
  style: { speed: 28, bowWave: 1.3 },
  model: (pose, look) => destroyer(look, deckGunOf(pose)),
  rest: (look) => destroyer(look, NO_SALVO),
  muzzle(pose, shot, _look, m) {
    if (pose.fire === "depthCharges") return m.at.charges ?? [-74, 0, 10];
    if (pose.fire === "aaGuns") return m.at.aa ?? [0, 0, 14];
    return m.at[`gun${shot % 2}`] ?? [60, 0, 12];
  },
});

// ---- Submarine: torpedoes leave the bow under the surface ----

function submarine(look: Look): ShipModel {
  const kit = kitOf(look);
  return memo(`ss|${team(look)}`, () => (kit === "jp" ? iBoat(look.team) : kit === "de" ? typeVII(look.team) : gato(look.team)));
}

export const submarineRig: Rig = shipRig({
  hit: { x: 0, y: -6 },
  style: { speed: 16, bowWave: 0.8 },
  model: (_pose, look) => submarine(look),
  rest: (look) => submarine(look),
  muzzle: (_pose, _shot, _look, m) => m.at.torpedo ?? [60, 0, -1],
});

// ---- Landing Craft: unarmed; run aground, its ramp is down on the sand ----

function landingCraft(look: Look): ShipModel {
  const kit = kitOf(look);
  return memo(`lc|${team(look)}|${look.beached}`, () => (kit === "jp" ? daihatsu(look.team, look.beached) : lct(look.team, kit, look.beached)));
}

export const landingCraftRig: Rig = shipRig({
  hit: { x: 0, y: -10 },
  style: { speed: 10, bowWave: 0.7 },
  model: (_pose, look) => landingCraft(look),
  rest: (look) => landingCraft(look),
  still: (look) => look.beached,
  muzzle: () => [0, 0, 6],
});

// ---- Torpedo boat: a torpedo slides out and drops; with the secondary weapon its guns fire ----

function launchOf(pose: Pose): Launch {
  const ct = pose.fire === "torpedo" ? pose.ct : null;
  if (ct === null) return { slide: 0, launched: false };
  return { slide: Math.round(Math.min(6, Math.max(0, (ct - 100) / 30))), launched: ct > (FIRE_TIMING.torpedo.shots[0] ?? 300) };
}

function torpedoBoat(look: Look, launch: Launch, shake: number): ShipModel {
  const kit = kitOf(look);
  return memo(`tb|${team(look)}|${launch.slide}|${launch.launched}|${shake}`, () =>
    kit === "jp" ? gyoraitei(look.team, launch, shake) : kit === "de" ? sBoot(look.team, launch, shake) : ptBoat(look.team, launch, shake),
  );
}

const READY: Launch = { slide: 0, launched: false };

export const torpedoBoatRig: Rig = shipRig({
  hit: { x: 0, y: -8 },
  style: { speed: 42, bowWave: 1.8 },
  model(pose, look) {
    const shake = pose.fire === "mg" && justFired(pose.ct, FIRE_TIMING.mg.shots, 40) >= 0 ? 1 : 0;
    return torpedoBoat(look, launchOf(pose), shake);
  },
  rest: (look) => torpedoBoat(look, READY, 0),
  muzzle(pose, _shot, look, m) {
    if (pose.fire === "mg") return m.at.mg ?? [0, 0, 10];
    // The torpedo leaves from wherever it has slid to.
    const at = torpedoBoat(look, { ...launchOf(pose), launched: false }, 0).at.torpedo ?? [30, 0, 8];
    return [at[0], at[1], at[2] - 3];
  },
});

