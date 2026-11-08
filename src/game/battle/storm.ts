// Storming scenes (08-art-pipeline §19): a squad running into a building to capture it, or into a
// bunker to garrison it. Worked out from what the engine already decided, so the scene can never
// change an outcome. Pure data, tested without drawing anything.

import type { GameEvent } from "../../engine/commands";
import type { NationId } from "../../engine/data/nations";
import type { TerrainId } from "../../engine/data/terrain";
import { FOOT_UNITS, type UnitTypeId } from "../../engine/data/units";
import { terrainAt, type Point } from "../../engine/map";
import { CAPTURE_POINTS, displayHp, type GameState, type PlayerId, type Unit } from "../../engine/state";
import { figureCount } from "./plan";

export type StormUnit = (typeof FOOT_UNITS)[number];

export interface StormPlan {
  readonly kind: "capture" | "garrison";
  readonly unit: StormUnit;
  readonly owner: PlayerId;
  readonly nation: NationId | null;
  /** Displayed HP (1–10). */
  readonly hp: number;
  readonly paratrooper: boolean;
  readonly suit: number;
  /** The property being captured, or "bunker". */
  readonly terrain: TerrainId;
  /** Capture points before and after (both 0 for a garrison). After is 0 when the capture completes. */
  readonly before: number;
  readonly after: number;
  /** A completed capture: the old owner's flag comes down and the captor's goes up. */
  readonly captured: boolean;
  readonly previousOwner: PlayerId | null;
  readonly previousNation: NationId | null;
}

const isFoot = (type: UnitTypeId): type is StormUnit => (FOOT_UNITS as readonly UnitTypeId[]).includes(type);

/** A unit on the map, or aboard a transport (for one being unloaded). */
function findUnit(state: GameState, unitId: number): Unit | undefined {
  for (const unit of state.units) {
    if (unit.id === unitId) return unit;
    const aboard = unit.cargo.find((c) => c.id === unitId);
    if (aboard) return aboard;
  }
  return undefined;
}

function base(state: GameState, unit: Unit & { type: StormUnit }): Pick<StormPlan, "unit" | "owner" | "nation" | "hp" | "paratrooper" | "suit"> {
  return {
    unit: unit.type,
    owner: unit.owner,
    nation: state.players[unit.owner]?.nation ?? null,
    hp: displayHp(unit.hp),
    paratrooper: unit.type === "infantry" && unit.airDropped === true,
    suit: unit.id % 4,
  };
}

/**
 * The scene for one capture action. `state` is the state before the capture. The count starts
 * from the property's progress if this unit was already capturing it, otherwise from the full 20.
 */
export function planCapture(state: GameState, event: Extract<GameEvent, { type: "captureProgress" | "propertyCaptured" }>): StormPlan | null {
  const unit = findUnit(state, event.unitId);
  if (!unit || !isFoot(unit.type)) return null;
  const property = state.properties.find((p) => p.pos.x === event.pos.x && p.pos.y === event.pos.y);
  if (!property) return null;
  const before = property.capturingUnit === unit.id ? property.capturePoints : CAPTURE_POINTS;
  const captured = event.type === "propertyCaptured";
  const previousOwner = captured ? event.previousOwner : property.owner;
  return {
    kind: "capture",
    ...base(state, { ...unit, type: unit.type }),
    terrain: terrainAt(state.map, event.pos),
    before,
    after: captured ? 0 : event.capturePoints,
    captured,
    previousOwner,
    previousNation: previousOwner === null ? null : (state.players[previousOwner]?.nation ?? null),
  };
}

/**
 * The scene for foot soldiers going into a bunker (08-art-pipeline §15): they moved onto one, or
 * were unloaded onto one. Nothing plays for vehicles, for a unit that was already inside, for one
 * that only stops on the bunker to board a transport, or for a bunker that has been destroyed.
 */
export function planGarrison(state: GameState, unitId: number, from: Point | null, to: Point, events: readonly GameEvent[]): StormPlan | null {
  const unit = findUnit(state, unitId);
  if (!unit || !isFoot(unit.type)) return null;
  if (from && from.x === to.x && from.y === to.y) return null;
  if (terrainAt(state.map, to) !== "bunker") return null;
  if (events.some((e) => e.type === "unitLoaded" && e.unitId === unitId)) return null;
  return {
    kind: "garrison",
    ...base(state, { ...unit, type: unit.type }),
    terrain: "bunker",
    before: 0,
    after: 0,
    captured: false,
    previousOwner: null,
    previousNation: null,
  };
}

// ---- Timing ----

export const STORM_MS = { intro: 450, cover: 900, gap: 160, run: 1500, flag: 1300, outro: 300, haul: 1800 } as const;

/**
 * A capture already under way: the squad is inside, so instead of storming the building again the
 * scene shows the captor's flag being hauled up, as far as the points taken so far (08-art-pipeline §19).
 */
export const isFollowUp = (plan: StormPlan): boolean => plan.kind === "capture" && plan.before < CAPTURE_POINTS;

/** How far up the pole the captor's flag is, 0 to 1, for a capture count. */
export const flagHeight = (points: number): number => Math.max(0, Math.min(1, (CAPTURE_POINTS - points) / CAPTURE_POINTS));

/** The two front soldiers of a capturing squad kneel and give covering fire before going in last. */
export const coverFigures = (plan: StormPlan): number => (plan.kind === "capture" && plan.unit === "infantry" ? Math.min(2, figureCount(plan.unit, plan.hp)) : 0);

/** Soldiers on screen: one per man, so a mortar or launcher team shows both its men. */
export function soldierCount(unit: StormUnit, hp: number): number {
  const figures = figureCount(unit, hp);
  return unit === "infantry" ? figures : figures * 2;
}

export const stormRunners = (plan: StormPlan): number => soldierCount(plan.unit, plan.hp);

/** When each runner sets off and when he goes through the door, from the scene's start. */
export function stormTimes(plan: StormPlan): { readonly start: number; readonly enter: number }[] {
  if (isFollowUp(plan)) return [];
  const runners = stormRunners(plan);
  const cover = coverFigures(plan);
  const times: { start: number; enter: number }[] = [];
  // Everyone but the cover men runs first, back of the formation first; the cover men follow.
  let order = 0;
  for (let i = runners - 1; i >= cover; i--) times[i] = { start: STORM_MS.intro + order++ * STORM_MS.gap, enter: 0 };
  for (let i = cover - 1; i >= 0; i--) times[i] = { start: STORM_MS.intro + STORM_MS.cover + order++ * STORM_MS.gap, enter: 0 };
  return times.map((t) => ({ start: t.start, enter: t.start + STORM_MS.run }));
}

export function stormLength(plan: StormPlan): { settled: number; total: number } {
  if (isFollowUp(plan)) {
    const settled = STORM_MS.intro + STORM_MS.haul + STORM_MS.flag;
    return { settled, total: settled + STORM_MS.outro };
  }
  const lastIn = Math.max(...stormTimes(plan).map((t) => t.enter), STORM_MS.intro);
  const settled = lastIn + STORM_MS.flag;
  return { settled, total: settled + STORM_MS.outro };
}

/** The capture count shown at time t: it drops as each soldier goes in, ending at the engine's number. */
export function capturePointsAt(plan: StormPlan, t: number): number {
  if (isFollowUp(plan)) {
    const u = Math.max(0, Math.min(1, (t - STORM_MS.intro) / STORM_MS.haul));
    return plan.before - Math.round((plan.before - plan.after) * u);
  }
  const times = stormTimes(plan);
  const inside = times.filter((x) => x.enter <= t).length;
  if (times.length === 0) return plan.after;
  return plan.before - Math.round(((plan.before - plan.after) * inside) / times.length);
}
