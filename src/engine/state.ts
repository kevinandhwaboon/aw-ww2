// GameState: the complete game, as plain serializable data (00-master-design §11).
// Never mutated in place: apply() returns a new state.

import type { CommanderId } from "./data/commanders";
import type { NationId, Side } from "./data/nations";
import type { TerrainId } from "./data/terrain";
import type { UnitTypeId } from "./data/units";
import type { WavePatternSetId } from "./data/waves";
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
  /** No units left loses; with `side`, only that side's players can lose this way (23-survival §5b). */
  | { readonly type: "rout"; readonly side?: Side }
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
  /** The commander this player fights under, from their own side; missing = none (06-commanders §2). */
  readonly commander?: CommanderId;
  /** Units this player has lost, by type, for the results screen (04-economy §8a). */
  readonly unitsLost: Readonly<Partial<Record<UnitTypeId, number>>>;
}

export interface Unit {
  readonly id: UnitId;
  readonly type: UnitTypeId;
  readonly owner: PlayerId;
  readonly pos: Point;
  /** Internal HP, 0–100. */
  readonly hp: number;
  readonly fuel: number;
  /** Primary weapon ammo, or a Supply Ship's supply loads (05-supply-transport §3b); 0 for other units. */
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
  /**
   * A Carrier that has launched aircraft this turn, so it can't move (05-supply-transport §10).
   * Cleared at the start of its owner's turn.
   */
  readonly launched?: true;
  /**
   * A raider from a base off the map: how many more of its owner's turns it stays before it goes home
   * at the start of the next one (23-survival §5c). Missing for every other unit, and dropped once it
   * reaches a Carrier or a property of its side that services it.
   */
  readonly sortie?: number;
}

/** A unit that arrives during the game, described like a starting unit (23-survival §5a). */
export interface ArrivingUnit {
  readonly type: UnitTypeId;
  /** Internal HP, default 100. */
  readonly hp?: number;
  /** Default: a full tank or full ammo, as the unit's commander allows. */
  readonly fuel?: number;
  readonly ammo?: number;
  readonly kills?: number;
  /** Passengers, arriving aboard. */
  readonly cargo?: readonly ArrivingUnit[];
  /** A raider: turns it stays on the map after it arrives before going home (23-survival §5c). */
  readonly sortieTurns?: number;
}

/**
 * Units due to arrive at the start of `player`'s turn on `day`, each on the first free square of
 * `zone` it can stand on (23-survival §5a). Units that find no room wait, and the arrival stays in
 * the list until all of them are on the map.
 */
export interface Arrival {
  readonly day: number;
  readonly player: PlayerId;
  /** Survival's wave number, for the record (23-survival §5e). */
  readonly wave?: number;
  /** Shown in the banner, e.g. "The first landing". */
  readonly name?: string;
  /** The edge it comes from, for the forecast, e.g. "south" (23-survival §4). */
  readonly from?: string;
  /** Most units its player may have when these arrive; the rest wait (23-survival §4). */
  readonly unitCap?: number;
  /** Entry squares, in the order they fill. */
  readonly zone: readonly Point[];
  /** Units still to arrive. */
  readonly units: readonly ArrivingUnit[];
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

/** A Blown Bridge partway through being rebuilt (02-terrain §4a). Progress is lost if the unit leaves or dies. */
export interface BridgeWork {
  readonly pos: Point;
  /** Points still needed; the bridge stands again at 0. */
  readonly points: number;
  readonly unit: UnitId;
}

export interface Settings {
  /** false = luck always 0 (03-combat §3). */
  readonly luck: boolean;
  /** Funds per owned property per day (04-economy §1). */
  readonly incomePerProperty: number;
  /** Most units a player may have; null = no limit (04-economy §4). */
  readonly unitCap: number | null;
  /** Each side sees only what its units see (19-fog-of-war). */
  readonly fogOfWar: boolean;
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

/** A named edge of a survival map: where waves come in (23-survival §4). */
export interface WaveEdge {
  readonly name: string;
  /** Entry squares, in the order they fill. */
  readonly zone: readonly Point[];
  /** Generated waves come from here only from this wave on. */
  readonly fromWave?: number;
}

/** Supplies for the defender on some generated waves' days (23-survival §4). */
export interface ConvoyPlan {
  readonly player: PlayerId;
  /** Comes with this generated wave, and every `every` waves after it. */
  readonly fromWave: number;
  readonly every: number;
  /** The name of the edge it comes in on. */
  readonly edge: string;
  readonly name?: string;
  readonly units: readonly ArrivingUnit[];
}

/**
 * The endless waves of a survival map (23-survival §4): from `firstWave` on, one every `everyDays`
 * days from `firstDay`, each generated by the seeded RNG from the pattern set, with a budget `growth`
 * times bigger than the one before. Each is generated when the wave before it arrives, so the next
 * wave is always known.
 */
export interface WaveGenerator {
  readonly player: PlayerId;
  readonly patterns: WavePatternSetId;
  readonly firstWave: number;
  readonly firstDay: number;
  readonly everyDays: number;
  /** The first generated wave's value in funds. */
  readonly budget: number;
  /** 0.12 = each wave 12% bigger than the one before. */
  readonly growth: number;
  readonly edges: readonly WaveEdge[];
  /** Most units the waves' player may have; units over it wait. */
  readonly unitCap?: number;
  readonly convoy?: ConvoyPlan;
}

/** Clear all game, summer art: a scenario that says nothing about weather. */
export const DEFAULT_WEATHER: WeatherPlan = { season: "summer", forecast: [{ fromDay: 1, weather: "clear" }] };

export const DEFAULT_SETTINGS: Settings = { luck: true, incomePerProperty: 1000, unitCap: null, fogOfWar: false };

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
  /** Blown Bridges being rebuilt, in no particular order (02-terrain §4a). */
  readonly bridgeWorks: readonly BridgeWork[];
  readonly day: number;
  /** Index into players of whose turn it is. */
  readonly currentPlayer: PlayerId;
  readonly rng: RngState;
  readonly nextUnitId: UnitId;
  /** Scenario modifiers. Commanders, weather and veterancy are derived (engine/stats.ts), not stored here. */
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
  /** Units still to arrive, in the scenario's order (23-survival §5a). */
  readonly arrivals: readonly Arrival[];
  /** The highest wave number that has arrived, 0 before any (23-survival §5e). */
  readonly wave: number;
  /** A survival map's endless waves (23-survival §4). */
  readonly waveGenerator?: WaveGenerator;
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
