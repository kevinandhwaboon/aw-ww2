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
  counterWeapon,
  chooseWeapon,
  damageFormula,
  distance,
  forecast,
  fortForecast,
  fortTargetProblem,
  fortTargets,
  garrisonBunker,
  targetProblem,
  threatTiles,
  weaponAgainst,
  MAX_LUCK,
  type CombatForecast,
  type DamageInputs,
} from "./combat";
export {
  ambushOnPath,
  canEndOn,
  checkPath,
  cheapestPath,
  moveDestinations,
  movementBudget,
  reachableTiles,
  type PathCheck,
  type Reach,
} from "./movement";
export { buildOptions, buildProblem, captureProblem, propertyDefAt, servicesUnit, type BuildOption } from "./economy";
export { buildCommands, launchCommands, legalCommands, unitCommands } from "./legal";
export { blowProblem, bridgeWorkAt, rebuildProblem } from "./bridges";
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
export { fogInGame, fogToday, weatherOn } from "./weather";
export { eventsSeenBy, hiddenUnitIds, isHiddenFrom, revealsAnything, stateSeenBy, tileInSight, tilesInSight } from "./visibility";
export * as stats from "./stats";
export type { FightRole, Modifier, ModifierScope, ModifiableStat, StatContext } from "./modifiers";
export { COMMANDERS, COMMANDER_IDS, commanderDef, type CommanderDef, type CommanderId } from "./data/commanders";
export { parseAsciiMap, terrainAt, inBounds, type GameMap, type Point } from "./map";
export { TERRAIN, TERRAIN_IDS, type TerrainId, type TerrainDef, type MovementType } from "./data/terrain";
export { UNITS, UNIT_TYPE_IDS, type UnitTypeId, type UnitDef, type UnitCategory } from "./data/units";
export { baseDamage, DAMAGE_CHART, type DamageEntry, type DamageTarget } from "./data/damage";
export { veterancyFor, VETERANCY, type VeterancyLevel } from "./data/veterancy";
export { WEATHER, WEATHER_IDS, SEASONS, type WeatherId, type Season } from "./data/weather";
export { NATIONS, type NationId, type Side } from "./data/nations";
