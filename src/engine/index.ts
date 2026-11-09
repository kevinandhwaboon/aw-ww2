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
export { loadGame, saveGame } from "./save";
export { parseScenario, type Scenario } from "./scenario";
export { createGame, type GameSetup, type PlayerSetup, type UnitSetup } from "./setup";
export { joinProblem, launchable, launchProblem, launchState, loadProblem, supplyTargets, unloadTiles } from "./transport";
export { diveProblem, surfaceProblem } from "./submarine";
export { CARRIER_REPAIR_HP, REPAIR_HP } from "./turn";
export {
  displayHp,
  fortAt,
  propertyAt,
  unitAt,
  CAPTURE_POINTS,
  DEFAULT_SETTINGS,
  DEFAULT_VICTORY,
  DEFAULT_WEATHER,
  MAX_HP,
  type DefeatReason,
  type Facing,
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
  type ForecastEntry,
  type WeatherPlan,
} from "./state";
export { weatherOn } from "./weather";
export * as stats from "./stats";
export type { Modifier, ModifierScope, ModifiableStat, StatContext } from "./modifiers";
export { parseAsciiMap, terrainAt, inBounds, type GameMap, type Point } from "./map";
export { TERRAIN, TERRAIN_IDS, type TerrainId, type MovementType } from "./data/terrain";
export { UNITS, UNIT_TYPE_IDS, type UnitTypeId, type UnitDef, type UnitCategory } from "./data/units";
export { baseDamage, DAMAGE_CHART, type DamageEntry, type DamageTarget } from "./data/damage";
export { veterancyFor, VETERANCY, type VeterancyLevel } from "./data/veterancy";
export { WEATHER, WEATHER_IDS, SEASONS, type WeatherId, type Season } from "./data/weather";
export { NATIONS, type NationId, type Side } from "./data/nations";
