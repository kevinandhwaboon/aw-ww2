// Public API of the rules engine. Presentation and AI code import from here.

export { apply } from "./apply";
export type {
  ApplyResult,
  Combatant,
  CombatStrike,
  Command,
  CommandType,
  GameEvent,
  RejectionCode,
  UnitAction,
} from "./commands";
export {
  attackTargets,
  canCounter,
  chooseWeapon,
  damageFormula,
  distance,
  forecast,
  fortForecast,
  fortTargetProblem,
  fortTargets,
  targetProblem,
  threatTiles,
  MAX_LUCK,
  type CombatForecast,
  type DamageInputs,
} from "./combat";
export {
  canEndOn,
  checkPath,
  cheapestPath,
  moveDestinations,
  movementBudget,
  reachableTiles,
  type PathCheck,
  type Reach,
} from "./movement";
export { buildOptions, buildProblem, captureProblem, propertyDefAt, type BuildOption } from "./economy";
export { createGame, type GameSetup, type PlayerSetup, type UnitSetup } from "./setup";
export { joinProblem, loadProblem, supplyTargets, unloadTiles } from "./transport";
export { REPAIR_HP } from "./turn";
export {
  displayHp,
  fortAt,
  propertyAt,
  unitAt,
  CAPTURE_POINTS,
  DEFAULT_SETTINGS,
  DEFAULT_VICTORY,
  MAX_HP,
  type DefeatReason,
  type FortificationState,
  type GameResult,
  type GameState,
  type Player,
  type PlayerId,
  type PropertyState,
  type Settings,
  type Unit,
  type UnitId,
  type VictoryCondition,
} from "./state";
export * as stats from "./stats";
export type { Modifier, ModifierScope, ModifiableStat, StatContext } from "./modifiers";
export { parseAsciiMap, terrainAt, inBounds, type GameMap, type Point } from "./map";
export { TERRAIN, TERRAIN_IDS, type TerrainId, type MovementType } from "./data/terrain";
export { UNITS, UNIT_TYPE_IDS, type UnitTypeId, type UnitDef, type UnitCategory } from "./data/units";
export { baseDamage, DAMAGE_CHART, type DamageEntry, type DamageTarget } from "./data/damage";
export { veterancyFor, VETERANCY, type VeterancyLevel } from "./data/veterancy";
export { NATIONS, type NationId, type Side } from "./data/nations";
