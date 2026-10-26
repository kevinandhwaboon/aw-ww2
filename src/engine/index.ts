// Public API of the rules engine. Presentation and AI code import from here.

export { apply } from "./apply";
export type { ApplyResult, Command, CommandType, GameEvent, RejectionCode } from "./commands";
export { createGame, CAPTURE_POINTS, type GameSetup, type PlayerSetup, type UnitSetup } from "./setup";
export {
  displayHp,
  propertyAt,
  unitAt,
  DEFAULT_SETTINGS,
  MAX_HP,
  type GameState,
  type Player,
  type PlayerId,
  type PropertyState,
  type Settings,
  type Unit,
  type UnitId,
} from "./state";
export * as stats from "./stats";
export type { Modifier, ModifierScope, ModifiableStat, StatContext } from "./modifiers";
export { parseAsciiMap, terrainAt, inBounds, type GameMap, type Point } from "./map";
export { TERRAIN, TERRAIN_IDS, type TerrainId, type MovementType } from "./data/terrain";
export { UNITS, UNIT_TYPE_IDS, type UnitTypeId, type UnitDef, type UnitCategory } from "./data/units";
export { baseDamage, DAMAGE_CHART, type DamageEntry, type DamageTarget } from "./data/damage";
export { veterancyFor, VETERANCY, type VeterancyLevel } from "./data/veterancy";
export { NATIONS, type NationId, type Side } from "./data/nations";
