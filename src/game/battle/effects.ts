// Paints what flies and what it hits in a battle scene (08-art-pipeline §18): muzzle flashes, rounds,
// rockets, bombs and torpedoes in flight, impacts, explosions and smoke. Part of BattleRenderer.

import { SCENE } from "./backdrops";
import { C, mix, type Painter } from "./paint";
import type { FireKind, HalfId } from "./plan";
import type { HalfView, PlannedShot } from "./renderer";
import { lerp, type Pt } from "./rig";
import { hash, type Shot } from "./timeline";

/** Where an aerial torpedo hits the water and runs, in the shooter's half, when it flies over the sea. */
const TORPEDO_WATER_Y = SCENE.bottom - 14;
/** The part of an aerial torpedo's flight spent falling to the water, then running to the half's edge. */
const AIR_TORPEDO = { splash: 0.1, edge: 0.4 };

/** Indirect fire: how long a round takes to leave the screen, and to fall onto its target. */
const INDIRECT_MS = { up: 260, rocketUp: 420, down: 380 };

/**
 * Naval gunfire: a shell leaves along the barrel (about 20° up; guns that aren't raised fire at
 * 20° anyway), climbs for a short stretch and fades into the distance. Near the end of its flight
 * it reappears coming down at the same angle onto the target, so the target is hit well after the
 * guns fire. Speed in pixels per ms; `out` and `in` are how far it's seen going and coming.
 */
const NAVAL = { speed: 0.35, launch: 0.35, out: 70, in: 80 };
/** Depth charges: thrown clear of the stern for this long, then they sink until they go off. */
const CHARGE_THROW_MS = 520;
/** Where a depth charge goes into the water: spread in a pattern around the submarine, not all on it. */
const chargeX = (shot: Pick<Shot, "fireAt"> & { readonly target: Pt }): number => Math.round(shot.target.x + (hash(shot.fireAt, 11) - 0.5) * 40);

type Missile = "bullet" | "shell" | "rocket" | "lob" | "rocketLob" | "bomb" | "torpedo" | "airTorpedo" | "charge" | "naval";
const MISSILE: Record<FireKind, Missile> = {
  rifle: "bullet", mg: "bullet", aaGuns: "bullet", planeGuns: "bullet", bazooka: "rocket", tankGun: "shell",
  flak: "shell", deckGun: "naval", navalGuns: "naval", mortar: "lob", howitzer: "lob", rockets: "rocketLob",
  bombs: "bomb", diveBomb: "bomb", aerialTorpedo: "airTorpedo", depthCharges: "charge", torpedo: "torpedo",
};
export type Blast = "small" | "medium" | "large";
export const BLAST: Record<FireKind, Blast> = {
  rifle: "small", mg: "small", aaGuns: "small", planeGuns: "small", bazooka: "medium", tankGun: "medium",
  flak: "medium", deckGun: "medium", mortar: "medium", howitzer: "large", rockets: "large", bombs: "large",
  diveBomb: "large", aerialTorpedo: "large", navalGuns: "large", depthCharges: "large", torpedo: "large",
};
const BLAST_MS: Record<Blast, number> = { small: 260, medium: 650, large: 950 };
/** Muzzle flash size in pixels; 0 for weapons that don't flash. */
const FLASH: Record<FireKind, number> = {
  rifle: 3, mg: 3, aaGuns: 3, planeGuns: 3, bazooka: 5, tankGun: 8, flak: 8, deckGun: 6, mortar: 5,
  howitzer: 11, rockets: 5, bombs: 0, diveBomb: 0, aerialTorpedo: 0, navalGuns: 13, depthCharges: 3, torpedo: 0,
};
/** Weapons whose blast kicks up dust along the ground in front of them. */
const GROUND_BLAST = new Set<FireKind>(["tankGun", "howitzer", "flak"]);

export class BattleEffects {
  constructor(
    private readonly p: Painter,
    private readonly halves: Record<HalfId, HalfView>,
    private readonly shots: readonly PlannedShot[],
    private readonly slot: (h: HalfView, i: number) => Pt,
  ) {}

  puff(at: Pt, r: number, alpha: number, dark = false): void {
    if (alpha <= 0) return;
    const { ctx } = this.p;
    ctx.save();
    ctx.globalAlpha = Math.min(1, alpha);
    this.p.disc(at.x, at.y, r, dark ? C("battleSmokeDark") : C("battleSmoke"));
    this.p.disc(at.x - r / 3, at.y - r / 3, r / 2, dark ? mix(C("battleSmokeDark"), C("battleSmoke"), 0.4) : C("battleCloud"));
    ctx.restore();
  }

  explosion(at: Pt, age: number, size: Blast, surface: "ground" | "water" | "air" | "metal", seed: number): void {
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
  drawShooterEffects(h: HalfView, t: number): void {
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

  drawImpact(shot: PlannedShot, t: number): void {
    const age = t - shot.landAt;
    if (age < 0 || age > BLAST_MS[BLAST[shot.fire]]) return;
    const surface = shot.atAir
      ? "air"
      : shot.targetBody === "ship" || shot.fire === "torpedo" || shot.fire === "aerialTorpedo" || shot.fire === "depthCharges"
        ? "water"
        : shot.targetBody === "machine"
          ? "metal"
          : "ground";
    const at = shot.targetView === "underwater" ? shot.target : surface === "water" ? { x: shot.fire === "depthCharges" ? chargeX(shot) : shot.target.x, y: shot.targetBase.y + 1 } : surface === "ground" && BLAST[shot.fire] === "small" ? { x: shot.target.x, y: shot.targetBase.y - 4 } : shot.target;
    this.explosion(at, age, BLAST[shot.fire], shot.targetView === "underwater" ? "water" : surface, shot.fireAt);
  }

  /** The half's aircraft fly over the sea, so the sky backdrop shows water under them. */
  private overWater(half: HalfId): boolean {
    const terrain = this.halves[half].data.terrain;
    return terrain === "sea" || terrain === "reef";
  }

  /**
   * Where a shot is at progress u (0 to 1) and which way it's heading. Indirect fire leaves along
   * the barrel and arcs down onto the target, so a howitzer's flat barrel gives a flat arc and a
   * mortar's steep tube a high one. Ground fire at aircraft climbs out of its own half along the
   * barrel and comes up under the target from below. Bombs fall out of the bottom of their half and
   * in at the top of the other.
   */
  private missileAt(shot: PlannedShot, u: number, kind: Missile): { at: Pt; dir: Pt; fade?: number } | null {
    const m = shot.muzzle;
    const target = kind === "torpedo" || kind === "airTorpedo" ? { x: shot.target.x, y: shot.targetBase.y + 2 } : shot.target;
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
    if (kind === "airTorpedo" && this.overWater(shot.from)) {
      // Dropped from wave-top height: it falls into the sea under the aircraft, runs just under the
      // surface to the edge of the shooter's half, then on across the target's half to the ship.
      const entry = { x: m.x + side * 8, y: TORPEDO_WATER_Y };
      if (u < AIR_TORPEDO.splash) {
        const k = u / AIR_TORPEDO.splash;
        return { at: { x: lerp(m.x, entry.x, k), y: lerp(m.y, entry.y, k * k) }, dir: { x: side, y: 1 } };
      }
      if (u < AIR_TORPEDO.edge) {
        const k = (u - AIR_TORPEDO.splash) / (AIR_TORPEDO.edge - AIR_TORPEDO.splash);
        return { at: { x: lerp(entry.x, SCENE.half - side * 2, k), y: entry.y }, dir: { x: side, y: 0 } };
      }
      const k = (u - AIR_TORPEDO.edge) / (1 - AIR_TORPEDO.edge);
      return { at: { x: lerp(SCENE.half + side * 4, target.x, k), y: target.y }, dir: { x: side, y: 0 } };
    }
    if (kind === "airTorpedo") {
      // Dropped over land (an aircraft on an airfield by the shore): it falls out of the bottom of
      // the shooter's half, then runs in just under the surface from the edge of the target's half.
      if (u < 0.3) {
        const k = u / 0.3;
        return { at: { x: m.x + side * 20 * k, y: lerp(m.y, SCENE.bottom + 10, k * k) }, dir: { x: side, y: 1 } };
      }
      if (u < 0.4) return null;
      const k = (u - 0.4) / 0.6;
      return { at: { x: lerp(SCENE.half + side * 4, target.x, k), y: target.y }, dir: { x: side, y: 0 } };
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
    if (kind === "naval") {
      const total = shot.landAt - shot.fireAt;
      const elapsed = u * total;
      const raised = Math.atan2(-shot.heading.y, Math.abs(shot.heading.x));
      const launch = raised > 0.15 ? raised : NAVAL.launch;
      const climb = { x: side * Math.cos(launch), y: -Math.sin(launch) };
      const gone = elapsed * NAVAL.speed;
      if (gone <= NAVAL.out) return { at: { x: m.x + climb.x * gone, y: m.y + climb.y * gone }, dir: climb, fade: Math.min(1, (NAVAL.out - gone) / 25) };
      // Coming down onto the target at the angle it went up, seen only over the target's half.
      const left = (total - elapsed) * NAVAL.speed;
      if (left > NAVAL.in) return null;
      const fall = { x: side * Math.cos(launch), y: Math.sin(launch) };
      const at = { x: target.x - fall.x * left, y: target.y - fall.y * left };
      if (side === 1 ? at.x < SCENE.half + 2 : at.x > SCENE.half - 2) return null;
      return { at, dir: fall, fade: Math.min(1, (NAVAL.in - left) / 25) };
    }
    if (kind === "charge") {
      // Thrown in an arc onto the water over the submarine, then sinking onto it.
      const total = shot.landAt - shot.fireAt;
      const elapsed = u * total;
      const surface = shot.targetView === "underwater" ? SCENE.top + 3 : shot.targetBase.y + 1;
      const entry = { x: chargeX(shot), y: surface };
      const depth = shot.targetView === "underwater" ? target : { x: entry.x, y: shot.targetBase.y + 16 };
      if (elapsed >= CHARGE_THROW_MS) {
        const k = (elapsed - CHARGE_THROW_MS) / Math.max(1, total - CHARGE_THROW_MS);
        return { at: { x: lerp(entry.x, depth.x, k) + Math.sin(elapsed / 90) * 1, y: lerp(entry.y, depth.y, k) }, dir: { x: 0, y: 1 } };
      }
      const k = elapsed / CHARGE_THROW_MS;
      const c = { x: (m.x + entry.x) / 2, y: Math.min(m.y, entry.y) - 60 };
      const v = 1 - k;
      const at = { x: v * v * m.x + 2 * v * k * c.x + k * k * entry.x, y: v * v * m.y + 2 * v * k * c.y + k * k * entry.y };
      const dx = 2 * v * (c.x - m.x) + 2 * k * (entry.x - c.x);
      const dy = 2 * v * (c.y - m.y) + 2 * k * (entry.y - c.y);
      const len = Math.hypot(dx, dy) || 1;
      return { at, dir: { x: dx / len, y: dy / len } };
    }
    const len = Math.hypot(target.x - m.x, target.y - m.y) || 1;
    return { at: { x: lerp(m.x, target.x, u), y: lerp(m.y, target.y, u) }, dir: { x: (target.x - m.x) / len, y: (target.y - m.y) / len } };
  }

  drawMissile(shot: PlannedShot, t: number): void {
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
    } else if (kind === "shell" || kind === "naval") {
      const big = shot.fire === "navalGuns";
      // Naval shells fade as they go out of sight into the distance, and in as they come down.
      p.ctx.save();
      p.ctx.globalAlpha *= here.fade ?? 1;
      p.line(at.x - dir.x * (big ? 12 : 9), at.y - dir.y * (big ? 12 : 9), at.x, at.y, C("battleTracer"), big ? 3 : 2);
      p.px(at.x, at.y, C("battleFlash"));
      p.ctx.restore();
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
    } else if (kind === "airTorpedo" && dir.y > 0) {
      // Falling from the aircraft, still level: a long dark body with a fin at the back.
      p.rect(at.x - 5, at.y - 1, 10, 2, C("battleSteelDark"));
      p.rect(dir.x > 0 ? at.x - 6 : at.x + 5, at.y - 2, 1, 4, C("battleSteelDark"));
      p.rect(at.x - 5, at.y - 1, 10, 1, C("battleSteel"));
    } else if (kind === "torpedo" || kind === "airTorpedo") {
      if (kind === "airTorpedo" && this.overWater(shot.from) && u < AIR_TORPEDO.splash + 0.12) {
        // The splash where it went in, falling back.
        const entry = this.missileAt(shot, AIR_TORPEDO.splash, kind)?.at ?? at;
        const k = (u - AIR_TORPEDO.splash) / 0.12;
        const h = 9 * Math.sin(Math.min(1, k * 1.4) * Math.PI);
        p.ellipse(entry.x, entry.y - h / 2, 3 + k * 4, h / 2 + 1, C("battleFoam"));
        p.rect(entry.x - 6 - k * 6, entry.y, 12 + k * 12, 1, C("battleFoam"));
      }
      // A dark shape just under the surface and a line of bubbles behind it.
      p.rect(at.x - 4, at.y, 8, 2, C("battleSeaDeep"));
      const side = dir.x > 0 ? 1 : -1;
      for (let k = 1; k < 10; k++) if ((k + Math.floor(t / 60)) % 2 === 0) p.px(at.x - side * k * 4, at.y - 1, C("battleFoam"));
    } else if (kind === "charge") {
      const sinking = (t - shot.fireAt) >= CHARGE_THROW_MS;
      // A dark drum; once in the water it trails bubbles, and it splashes as it goes in.
      p.rect(at.x - 2, at.y - 2, 5, 4, sinking ? C("battleSeaDeep") : C("battleSteelDark"));
      if (!sinking) p.rect(at.x - 2, at.y - 2, 5, 1, C("battleSteel"));
      if (sinking) {
        const since = t - shot.fireAt - CHARGE_THROW_MS;
        for (let k = 1; k < 6; k++) if ((k + Math.floor(t / 80)) % 2 === 0) p.px(at.x + (k % 2 === 0 ? 1 : -1), at.y - 2 - k * 3, C("battleFoam"));
        if (since < 420 && shot.targetView !== "underwater") {
          // The splash as it goes in, and rings spreading on the surface after.
          const u = since / 420;
          const h = 18 * Math.sin(Math.min(1, u * 1.6) * Math.PI);
          const surface = shot.targetBase.y + 1;
          if (h > 0) {
            p.rect(at.x - 3, surface - h, 6, h, C("battleFoam"));
            p.rect(at.x - 5, surface - h * 0.5, 10, h * 0.5, C("battleSeaLight"));
          }
          for (let k = 0; k < 4; k++) p.px(at.x + (k - 1.5) * 4 * (1 + u * 2), surface - h * 0.8 - 2 + u * 10, C("battleFoam"));
          p.line(at.x - 4 - u * 10, surface + 1, at.x + 4 + u * 10, surface + 1, C("battleFoam"));
        }
      }
    } else {
      // A shell or mortar round: a dark body with a glowing tracer behind it.
      p.rect(at.x - 1, at.y - 1, 3, 3, C("battleSteelDark"));
      p.line(at.x - dir.x * 5, at.y - dir.y * 5, at.x - dir.x * 2, at.y - dir.y * 2, C("battleTracer"), 2);
      p.px(at.x - dir.x * 6, at.y - dir.y * 6, C("battleFire"));
    }
  }
}
