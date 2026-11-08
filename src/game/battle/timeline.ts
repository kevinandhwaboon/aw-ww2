// When everything in a battle scene happens (08-art-pipeline §18): when each figure fires, when each
// shot lands, when HP ticks down and when figures fall. Pure data, so the order of events is tested
// without drawing anything.

import { figureCount, squadWeapon, type BattleHalf, type BattlePlan, type FireKind, type HalfId } from "./plan";

/** How a weapon fires: one cycle of its animation, when shots leave in it, and how long they fly. */
export interface FireTiming {
  /** Length of one firing cycle of the animation, in ms. */
  readonly cycle: number;
  /** When each shot leaves the muzzle, from the start of a cycle. */
  readonly shots: readonly number[];
  readonly cycles: number;
  /** From leaving the muzzle to landing. */
  readonly flight: number;
  /** Delay between one figure starting to fire and the next, so a squad doesn't fire in lockstep. */
  readonly stagger: number;
}

/**
 * Indirect fire (mortars, howitzers, rockets) flies for well over a second: up out of sight, a
 * pause while it's overhead, then down onto the target.
 */
export const FIRE_TIMING: Record<FireKind, FireTiming> = {
  rifle: { cycle: 650, shots: [180], cycles: 2, flight: 240, stagger: 110 },
  mg: { cycle: 900, shots: [100, 170, 240, 310, 380, 450], cycles: 1, flight: 220, stagger: 150 },
  bazooka: { cycle: 1300, shots: [700], cycles: 1, flight: 380, stagger: 220 },
  mortar: { cycle: 950, shots: [430], cycles: 2, flight: 1300, stagger: 260 },
  tankGun: { cycle: 1000, shots: [150], cycles: 1, flight: 200, stagger: 260 },
  howitzer: { cycle: 1400, shots: [760], cycles: 1, flight: 1500, stagger: 300 },
  rockets: { cycle: 1300, shots: [150, 280, 410, 540, 670, 800], cycles: 1, flight: 1400, stagger: 220 },
  aaGuns: { cycle: 900, shots: [80, 150, 220, 290, 360, 430, 500, 570], cycles: 1, flight: 200, stagger: 120 },
  flak: { cycle: 1000, shots: [150, 650], cycles: 1, flight: 300, stagger: 250 },
  planeGuns: { cycle: 800, shots: [100, 170, 240, 310, 380, 450], cycles: 1, flight: 230, stagger: 150 },
  bombs: { cycle: 1100, shots: [200, 350, 500, 650], cycles: 1, flight: 750, stagger: 200 },
  navalGuns: { cycle: 1400, shots: [150, 550, 950], cycles: 1, flight: 500, stagger: 0 },
  deckGun: { cycle: 900, shots: [150, 550], cycles: 1, flight: 300, stagger: 200 },
  depthCharges: { cycle: 1000, shots: [150, 400, 650], cycles: 1, flight: 700, stagger: 250 },
  torpedo: { cycle: 1200, shots: [300], cycles: 1, flight: 900, stagger: 300 },
};

/** Infantry fire by soldier: riflemen fire single shots, the SMG and the squad automatic fire bursts. */
const SQUAD_TIMING: Record<"smg" | "lmg", FireTiming> = {
  smg: { cycle: 650, shots: [150, 200, 250], cycles: 2, flight: 220, stagger: 110 },
  lmg: { cycle: 650, shots: [100, 150, 200, 250, 300, 350], cycles: 2, flight: 220, stagger: 110 },
};

/** How one figure fires: its unit's weapon, except for Infantry, where each soldier's weapon decides. */
export function figureTiming(fire: FireKind, half: Pick<BattleHalf, "kind" | "nation" | "paratrooper">, figure: number): FireTiming {
  if (fire === "rifle" && half.kind === "infantry") {
    const weapon = squadWeapon(figure, half.nation, half.paratrooper);
    if (weapon !== "rifle") return SQUAD_TIMING[weapon];
  }
  return FIRE_TIMING[fire];
}

export const SCENE_MS = { intro: 450, between: 250, settle: 650, outro: 300 };

export interface Shot {
  readonly strike: number;
  readonly from: HalfId;
  readonly shooterFigure: number;
  /** When it leaves the muzzle and lands, from the scene's start. */
  readonly fireAt: number;
  readonly landAt: number;
  /** The figure it lands on. */
  readonly targetFigure: number;
  /** This shot takes the target figure down. */
  readonly kills: boolean;
}

export interface StrikeTiming {
  readonly from: HalfId;
  readonly fire: FireKind;
  readonly start: number;
  readonly end: number;
  /** When each figure starts its firing cycles; one entry per shooting figure. */
  readonly figureStarts: readonly number[];
  /** Figures the target shows before and after. */
  readonly targetFiguresBefore: number;
  readonly targetFiguresAfter: number;
  readonly hpBefore: number;
  readonly hpAfter: number;
}

export interface Timeline {
  readonly strikes: readonly StrikeTiming[];
  /** Every shot, sorted by landing time. */
  readonly shots: readonly Shot[];
  /** When the last strike has settled and the scene starts closing. */
  readonly settled: number;
  readonly total: number;
}

/** A fixed pseudo-random pick, so the same battle always looks the same. */
export function hash(...values: number[]): number {
  let h = 2166136261;
  for (const v of values) {
    h ^= v | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return (h >>> 0) / 4294967296;
}

export function buildTimeline(plan: BattlePlan): Timeline {
  const hp: Record<HalfId, number> = { left: plan.left.hp, right: plan.right.hp };
  const kindOf = (half: HalfId) => (half === "left" ? plan.left.kind : plan.right.kind);
  const strikes: StrikeTiming[] = [];
  const shots: Shot[] = [];
  let at = SCENE_MS.intro;

  plan.strikes.forEach((strike, index) => {
    const target: HalfId = strike.from === "left" ? "right" : "left";
    const timing = FIRE_TIMING[strike.fire];
    const shooters = figureCount(kindOf(strike.from), hp[strike.from]);
    const before = figureCount(kindOf(target), strike.hpBefore);
    const after = figureCount(kindOf(target), strike.hpAfter);

    const figureStarts = Array.from({ length: shooters }, (_, f) => at + f * timing.stagger);
    const strikeShots: Omit<Shot, "targetFigure" | "kills">[] = [];
    figureStarts.forEach((figureStart, f) => {
      const own = figureTiming(strike.fire, strike.from === "left" ? plan.left : plan.right, f);
      for (let c = 0; c < own.cycles; c++) {
        for (const offset of own.shots) {
          const fireAt = figureStart + c * own.cycle + offset;
          strikeShots.push({ strike: index, from: strike.from, shooterFigure: f, fireAt, landAt: fireAt + own.flight });
        }
      }
    });
    strikeShots.sort((a, b) => a.landAt - b.landAt);

    // Figures fall from the back of the formation (the highest numbers) as shots land, spread
    // evenly over the strike so the last one falls with the last shot.
    const deaths = before - after;
    const killAt = new Map<number, number>();
    for (let k = 0; k < deaths; k++) {
      const shotIndex = Math.max(0, Math.round(((k + 1) * strikeShots.length) / deaths) - 1);
      killAt.set(shotIndex, before - 1 - k);
    }
    strikeShots.forEach((shot, i) => {
      const victim = killAt.get(i);
      // Other shots land on a figure still standing when they land.
      const standing = before - [...killAt.entries()].filter(([j]) => j < i).length;
      const targetFigure = victim ?? Math.floor(hash(index, i, 7) * Math.max(1, standing));
      shots.push({ ...shot, targetFigure, kills: victim !== undefined });
    });

    const lastLand = strikeShots.reduce((m, s) => Math.max(m, s.landAt), at);
    const lastCycle = figureStarts.reduce((m, s) => Math.max(m, s + timing.cycle * timing.cycles), at);
    const end = Math.max(lastLand + 350, lastCycle);
    strikes.push({
      from: strike.from,
      fire: strike.fire,
      start: at,
      end,
      figureStarts,
      targetFiguresBefore: before,
      targetFiguresAfter: after,
      hpBefore: strike.hpBefore,
      hpAfter: strike.hpAfter,
    });
    hp[target] = strike.hpAfter;
    at = end + SCENE_MS.between;
  });

  shots.sort((a, b) => a.landAt - b.landAt);
  const settled = at - SCENE_MS.between + SCENE_MS.settle;
  return { strikes, shots, settled, total: settled + SCENE_MS.outro };
}

/** The HP a half shows at time t: it ticks down as each shot of a strike against it lands. */
export function hpAt(timeline: Timeline, half: HalfId, startHp: number, t: number): number {
  let hp = startHp;
  timeline.strikes.forEach((strike, index) => {
    if (strike.from === half || t < strike.start) return;
    const own = timeline.shots.filter((s) => s.strike === index);
    const landed = own.filter((s) => s.landAt <= t).length;
    const lost = strike.hpBefore - strike.hpAfter;
    hp = own.length === 0 ? strike.hpAfter : strike.hpBefore - Math.round((lost * landed) / own.length);
  });
  return hp;
}

/** When each of a half's figures falls, or undefined if it lives through the scene. */
export function deathTimes(timeline: Timeline, half: HalfId): Map<number, number> {
  const times = new Map<number, number>();
  for (const shot of timeline.shots) {
    if (shot.kills && shot.from !== half) times.set(shot.targetFigure, shot.landAt);
  }
  return times;
}
