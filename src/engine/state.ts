// GameState: the complete game, as plain serializable data (00-master-design §11).
// Never mutated in place: apply() returns a new state.

import type { NationId, Side } from "./data/nations";
import type { TerrainId } from "./data/terrain";
import type { UnitTypeId } from "./data/units";
import type { Point } from "./map";
import type { Modifier, PlayerId } from "./modifiers";
import type { RngState } from "./rng";

export type { PlayerId };
export type UnitId = number;

/** Internal HP of a full-health unit. Displayed HP is internal ÷ 10, rounded up (03-combat §1). */
export const MAX_HP = 100;

export interface Player {
  readonly id: PlayerId;
  readonly name: string;
  readonly side: Side;
  readonly nation: NationId;
  readonly funds: number;
  readonly defeated: boolean;
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
}

export interface PropertyState {
  readonly pos: Point;
  /** null = neutral. */
  readonly owner: PlayerId | null;
  /** 20 when untouched (04-economy §3). */
  readonly capturePoints: number;
}

export interface Settings {
  /** false = luck always 0 (03-combat §3). */
  readonly luck: boolean;
  /** Funds per owned property per day (04-economy §1). */
  readonly incomePerProperty: number;
}

export const DEFAULT_SETTINGS: Settings = { luck: true, incomePerProperty: 1000 };

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
  readonly day: number;
  /** Index into players of whose turn it is. */
  readonly currentPlayer: PlayerId;
  readonly rng: RngState;
  readonly nextUnitId: UnitId;
  /** Scenario, commander and weather modifiers. Veterancy is derived from units, not stored here. */
  readonly modifiers: readonly Modifier[];
  readonly settings: Settings;
}

/** HP as shown to players, 0–10 (03-combat §1). */
export function displayHp(hp: number): number {
  return Math.ceil(hp / 10);
}

export function unitAt(state: GameState, p: Point): Unit | undefined {
  return state.units.find((u) => u.pos.x === p.x && u.pos.y === p.y);
}

export function propertyAt(state: GameState, p: Point): PropertyState | undefined {
  return state.properties.find((prop) => prop.pos.x === p.x && prop.pos.y === p.y);
}
