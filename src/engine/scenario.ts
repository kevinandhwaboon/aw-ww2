// The scenario file format (00-master-design §8, 11-tech-setup §4): JSON read from outside the type
// system, so everything is checked when it's loaded and a bad file fails with a clear message.

import { NATIONS, type NationId } from "./data/nations";
import { TERRAIN } from "./data/terrain";
import { UNIT_TYPE_IDS, UNITS, type UnitTypeId } from "./data/units";
import { parseAsciiMap, terrainAt, type Point } from "./map";
import { MODIFIABLE_STATS, type Modifier, type ModifiableStat } from "./modifiers";
import { createGame, type GameSetup, type PlayerSetup, type UnitSetup } from "./setup";
import type { Settings, VictoryCondition } from "./state";

export interface Scenario {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  /** Everything needed to start a game, apart from the luck seed. */
  readonly setup: Omit<GameSetup, "seed">;
}

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const isCount = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

const fail = (message: string): never => {
  throw new Error(message);
};

function text(raw: Json, key: string, where: string): string {
  const value = raw[key];
  return typeof value === "string" && value.length > 0 ? value : fail(`${where}: "${key}" must be text`);
}

function list(raw: Json, key: string, where: string): unknown[] {
  const value = raw[key];
  return Array.isArray(value) ? value : fail(`${where}: "${key}" must be a list`);
}

function count(raw: Json, key: string, where: string): number {
  const value = raw[key];
  return isCount(value) ? value : fail(`${where}: "${key}" must be a whole number`);
}

/** Copies an optional whole-number field only if present, as exactOptionalPropertyTypes needs. */
function optionalCounts<K extends string>(raw: Json, keys: readonly K[], where: string): Partial<Record<K, number>> {
  const out: Partial<Record<K, number>> = {};
  for (const key of keys) if (raw[key] !== undefined) out[key] = count(raw, key, where);
  return out;
}

const isUnitType = (value: unknown): value is UnitTypeId => UNIT_TYPE_IDS.includes(value as UnitTypeId);

function point(value: unknown, where: string): Point {
  if (!isObject(value)) return fail(`${where}: "pos" must have x and y`);
  return { x: count(value, "x", where), y: count(value, "y", where) };
}

function parsePlayer(raw: unknown, index: number): PlayerSetup {
  const where = `player ${index}`;
  if (!isObject(raw)) return fail(`${where}: must be an object`);
  const nation = raw.nation as NationId;
  if (typeof raw.nation !== "string" || !Object.hasOwn(NATIONS, nation)) return fail(`${where}: unknown nation ${String(raw.nation)}`);
  const buildable = raw.buildable === undefined ? undefined : list(raw, "buildable", where);
  const bad = buildable?.find((type) => !isUnitType(type));
  if (bad !== undefined) return fail(`${where}: unknown unit type ${JSON.stringify(bad)}`);
  return {
    name: text(raw, "name", where),
    nation,
    ...optionalCounts(raw, ["funds"], where),
    ...(buildable ? { buildable: buildable as UnitTypeId[] } : {}),
  };
}

function parseUnit(raw: unknown, index: number): UnitSetup {
  const where = `unit ${index}`;
  if (!isObject(raw)) return fail(`${where}: must be an object`);
  if (!isUnitType(raw.type)) return fail(`${where}: unknown unit type ${String(raw.type)}`);
  return {
    type: raw.type,
    owner: count(raw, "owner", where),
    pos: point(raw.pos, where),
    ...optionalCounts(raw, ["hp", "fuel", "ammo", "kills"], where),
  };
}

function parseVictory(raw: unknown, index: number): VictoryCondition {
  if (isObject(raw) && (raw.type === "hqCapture" || raw.type === "rout")) return { type: raw.type };
  return fail(`victory ${index}: must be hqCapture or rout`);
}

function parseModifier(raw: unknown, index: number): Modifier {
  const where = `modifier ${index}`;
  if (!isObject(raw)) return fail(`${where}: must be an object`);
  const stat = raw.stat as ModifiableStat;
  if (!MODIFIABLE_STATS.includes(stat)) return fail(`${where}: unknown stat ${String(raw.stat)}`);
  const { op, value, scope } = raw;
  if (op !== "add" && op !== "multiply" && op !== "set") return fail(`${where}: unknown op ${String(op)}`);
  if (typeof value !== "number") return fail(`${where}: "value" must be a number`);
  if (scope !== undefined && !isObject(scope)) return fail(`${where}: "scope" must be an object`);
  return { source: text(raw, "source", where), stat, op, value, ...(scope ? { scope } : {}) };
}

function parseSettings(raw: unknown): Partial<Settings> {
  if (!isObject(raw)) return fail(`"settings" must be an object`);
  if (raw.luck !== undefined && typeof raw.luck !== "boolean") return fail(`settings: "luck" must be true or false`);
  return {
    ...(raw.luck === undefined ? {} : { luck: raw.luck }),
    ...optionalCounts(raw, ["incomePerProperty", "unitCap"], "settings"),
  };
}

function parseSetup(raw: Json): Omit<GameSetup, "seed"> {
  const rows = list(raw, "map", "scenario");
  if (!rows.every((row) => typeof row === "string")) return fail(`"map" must be a list of text rows`);
  const propertyOwners = (raw.propertyOwners === undefined ? [] : list(raw, "propertyOwners", "scenario")).map((entry, i) => {
    const where = `propertyOwners ${i}`;
    return isObject(entry) ? { pos: point(entry.pos, where), owner: count(entry, "owner", where) } : fail(`${where}: must be an object`);
  });
  return {
    map: parseAsciiMap(rows),
    players: list(raw, "players", "scenario").map(parsePlayer),
    propertyOwners,
    units: list(raw, "units", "scenario").map(parseUnit),
    ...(raw.victory === undefined ? {} : { victory: list(raw, "victory", "scenario").map(parseVictory) }),
    ...(raw.modifiers === undefined ? {} : { modifiers: list(raw, "modifiers", "scenario").map(parseModifier) }),
    ...(raw.settings === undefined ? {} : { settings: parseSettings(raw.settings) }),
  };
}

/** Units have to stand on terrain they could enter. Air units fly over anything. */
function checkPlacement({ map, units }: Omit<GameSetup, "seed">): void {
  for (const unit of units ?? []) {
    const terrain = terrainAt(map, unit.pos);
    if (TERRAIN[terrain].moveCost[UNITS[unit.type].movementType] === null) {
      fail(`${unit.type} at (${unit.pos.x}, ${unit.pos.y}) can't stand on ${terrain}`);
    }
  }
}

/** Reads a scenario file, or throws an Error saying what's wrong with it. */
export function parseScenario(raw: unknown): Scenario {
  const label = isObject(raw) && typeof raw.id === "string" ? raw.id : "(unnamed)";
  try {
    if (!isObject(raw)) return fail("a scenario must be an object");
    const setup = parseSetup(raw);
    // createGame has its own checks (owners, overlapping units, HP, bounds).
    createGame({ ...setup, seed: 0 });
    checkPlacement(setup);
    return {
      id: text(raw, "id", "scenario"),
      name: text(raw, "name", "scenario"),
      description: text(raw, "description", "scenario"),
      setup,
    };
  } catch (error) {
    throw new Error(`Invalid scenario ${label}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
}
