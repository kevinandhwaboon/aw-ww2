// GameState: the complete game, as plain serializable data (00-master-design §11).
// Never mutated in place: apply() returns a new state.

import type { NationId, Side } from "./data/nations";
import type { TerrainId } from "./data/terrain";
import type { UnitTypeId } from "./data/units";
import type { Season, WeatherId } from "./data/weather";
import type { Point } from "./map";
import type { Modifier, PlayerId } from "./modifiers";
import type { RngState } from "./rng";

export type { PlayerId };
export type UnitId = number;

/** Internal HP of a full-health unit. Displayed HP is internal ÷ 10, rounded up (03-combat §1). */
export const MAX_HP = 100;

/** Something a scenario can be won by (00-master-design §8, 04-economy §8). Rules are in engine/victory.ts. */
export type VictoryCondition =
  | { readonly type: "hqCapture" }
  | { readonly type: "rout" }
  /** `side` wins as soon as it owns every listed property. */
  | { readonly type: "captureProperties"; readonly side: Side; readonly properties: readonly Point[] }
  /** `side` wins once it has owned every listed property at the start of `days` days in a row. */
  | { readonly type: "holdProperties"; readonly side: Side; readonly properties: readonly Point[]; readonly days: number }
  /** `side` wins if it still has a player in the game when day `days` starts. */
  | { readonly type: "surviveDays"; readonly side: Side; readonly days: number };

/** The default for a scenario that doesn't say otherwise (04-economy §8). */
export const DEFAULT_VICTORY: readonly VictoryCondition[] = [{ type: "hqCapture" }, { type: "rout" }];

/** Why a player lost. Resigning is always possible, whatever the scenario. */
export type DefeatReason = VictoryCondition["type"] | "resign";

export interface GameResult {
  readonly winningSide: Side;
  readonly winners: readonly PlayerId[];
  readonly reason: DefeatReason;
}

/** Capture points of an untouched property (04-economy §3). */
export const CAPTURE_POINTS = 20;

/** Which way units are drawn on screen. Art faces right, so "left" mirrors it. */
export type Facing = "left" | "right";

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly side: Side;
  readonly nation: NationId;
  readonly funds: number;
  readonly defeated: boolean;
  /** Has had at least one unit, so losing them all counts as a rout (04-economy §8). */
  readonly hasFielded: boolean;
  /** Unit types this player may build, set per scenario (01-units availability rule). */
  readonly buildable: readonly UnitTypeId[];
  /** Set per scenario (08-art-pipeline §12). Only drawing reads this; no rule does. */
  readonly facing: Facing;
}

export interface Unit {
  readonly id: UnitId;
  readonly type: UnitTypeId;
  readonly owner: PlayerId;
  readonly pos: Point;
  /** Internal HP, 0–100. */
  readonly hp: number;
  readonly fuel: number;
  /** Primary weapon ammo (0 for units without one). */
  readonly ammo: number;
  /** Enemy units destroyed; veterancy level is derived from it (03-combat §6). */
  readonly kills: number;
  /** True once the unit has acted this turn. Reset at the start of its owner's turn. */
  readonly hasActed: boolean;
  /** Passengers. They aren't in GameState.units until unloaded (05-supply-transport §4). */
  readonly cargo: readonly Unit[];
  /**
   * Set once a Transport Aircraft drops this unit (01-units §5). No rule reads it: it only lets the
   * art show paratroopers (08-art-pipeline §17).
   */
  readonly airDropped?: true;
  /** A submarine below the surface (05-supply-transport §9). Missing until it first dives. */
  readonly submerged?: boolean;
}

export interface PropertyState {
  readonly pos: Point;
  /** null = neutral. */
  readonly owner: PlayerId | null;
  /** CAPTURE_POINTS when untouched (04-economy §3). */
  readonly capturePoints: number;
  /** The unit partway through capturing this property; progress resets if it leaves or dies. */
  readonly capturingUnit: UnitId | null;
}

/** A fortification or obstacle still standing; it leaves this list when broken (02-terrain §4). */
export interface FortificationState {
  readonly pos: Point;
  /** Internal HP. Displayed like unit HP. */
  readonly hp: number;
}

export interface Settings {
  /** false = luck always 0 (03-combat §3). */
  readonly luck: boolean;
  /** Funds per owned property per day (04-economy §1). */
  readonly incomePerProperty: number;
  /** Most units a player may have; null = no limit (04-economy §4). */
  readonly unitCap: number | null;
}

/** From `fromDay` on, the weather is `weather` (12-weather §4). */
export interface ForecastEntry {
  readonly fromDay: number;
  readonly weather: WeatherId;
}

/** The scenario's weather plan (12-weather §1, §6). */
export interface WeatherPlan {
  /** Art only: whether the map is drawn snowy. No rule reads it. */
  readonly season: Season;
  /** Starts on day 1, start days rising. */
  readonly forecast: readonly ForecastEntry[];
}

/** Clear all game, summer art: a scenario that says nothing about weather. */
export const DEFAULT_WEATHER: WeatherPlan = { season: "summer", forecast: [{ fromDay: 1, weather: "clear" }] };

export const DEFAULT_SETTINGS: Settings = { luck: true, incomePerProperty: 1000, unitCap: null };

export interface GameState {
  readonly map: {
    readonly width: number;
    readonly height: number;
    /** Row-major terrain. Part of state because fortifications can be destroyed (02-terrain §4). */
    readonly terrain: readonly TerrainId[];
  };
  readonly players: readonly Player[];
  /** Ordered by id. */
  readonly units: readonly Unit[];
  /** One entry per property tile, in row-major order. */
  readonly properties: readonly PropertyState[];
  /** One entry per standing fortification or obstacle, in row-major order. */
  readonly fortifications: readonly FortificationState[];
  readonly day: number;
  /** Index into players of whose turn it is. */
  readonly currentPlayer: PlayerId;
  readonly rng: RngState;
  readonly nextUnitId: UnitId;
  /** Scenario, commander and weather modifiers. Veterancy is derived from units, not stored here. */
  readonly modifiers: readonly Modifier[];
  readonly settings: Settings;
  /** The day's weather comes from this plan and the day number (engine/weather.ts). */
  readonly weather: WeatherPlan;
  readonly victoryConditions: readonly VictoryCondition[];
  /**
   * For each victory condition, by index: the days in a row a holdProperties condition's side has
   * owned all its properties at the start of the day. Always 0 for other conditions.
   */
  readonly holdStreaks: readonly number[];
  /** Set once the game is over; no more commands are accepted after that. */
  readonly result: GameResult | null;
}

/** HP as shown to players, 0–10 (03-combat §1). */
export function displayHp(hp: number): number {
  return Math.ceil(hp / 10);
}

export function unitAt(state: GameState, p: Point): Unit | undefined {
  return state.units.find((u) => u.pos.x === p.x && u.pos.y === p.y);
}

export function fortAt(state: GameState, p: Point): FortificationState | undefined {
  return state.fortifications.find((f) => f.pos.x === p.x && f.pos.y === p.y);
}

export function propertyAt(state: GameState, p: Point): PropertyState | undefined {
  return state.properties.find((prop) => prop.pos.x === p.x && prop.pos.y === p.y);
}
