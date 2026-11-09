// Building the initial GameState from a scenario-style setup. Setup errors are programming or
// scenario-authoring mistakes, so they throw instead of returning a rejection.

import { NATIONS, type NationId } from "./data/nations";
import { terrainDef } from "./data/terrain";
import { UNIT_TYPE_IDS, UNITS, type UnitDef, type UnitTypeId } from "./data/units";
import { inBounds, type GameMap, type Point } from "./map";
import type { Modifier } from "./modifiers";
import { seedRng } from "./rng";
import {
  CAPTURE_POINTS,
  DEFAULT_SETTINGS,
  DEFAULT_VICTORY,
  DEFAULT_WEATHER,
  MAX_HP,
  type Facing,
  type FortificationState,
  type GameState,
  type PlayerId,
  type PropertyState,
  type Settings,
  type Unit,
  type VictoryCondition,
  type WeatherPlan,
} from "./state";
import { weatherPlanProblem } from "./weather";
import { startTurn } from "./turn";

/** What a player can build unless the scenario says otherwise: every unit (01-units availability rule). */
const DEFAULT_BUILDABLE = UNIT_TYPE_IDS;

export interface PlayerSetup {
  readonly name: string;
  readonly nation: NationId;
  readonly funds?: number;
  /** Unit types offered to this player (01-units availability rule). */
  readonly buildable?: readonly UnitTypeId[];
  /** Which way this player's units are drawn; defaults to right (08-art-pipeline §12). */
  readonly facing?: Facing;
}

/** A unit starting aboard a transport, e.g. a Bomber on a Carrier (05-supply-transport §10). */
export interface CargoSetup {
  readonly type: UnitTypeId;
  /** Internal HP, default 100. */
  readonly hp?: number;
  readonly fuel?: number;
  readonly ammo?: number;
  readonly kills?: number;
}

export interface UnitSetup extends CargoSetup {
  readonly owner: PlayerId;
  readonly pos: Point;
  /** Units starting aboard; they must be ones this unit can carry, within its capacity. */
  readonly cargo?: readonly CargoSetup[];
}

export interface GameSetup {
  readonly map: GameMap;
  /** Turn order is the order of this list. Player ids are their indexes. */
  readonly players: readonly PlayerSetup[];
  /** Owners of property tiles; property tiles not listed start neutral. */
  readonly propertyOwners?: readonly { readonly pos: Point; readonly owner: PlayerId }[];
  readonly units?: readonly UnitSetup[];
  readonly seed: number;
  readonly settings?: Partial<Settings>;
  readonly modifiers?: readonly Modifier[];
  /** How this scenario is won; defaults to HQ capture and rout. */
  readonly victory?: readonly VictoryCondition[];
  /** Clear all game and summer art unless the scenario says otherwise (12-weather §1). */
  readonly weather?: WeatherPlan;
}

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/** Objectives must be properties, and the side they're for must have someone playing it (04-economy §8). */
function checkVictory(victory: readonly VictoryCondition[], properties: readonly PropertyState[], players: readonly PlayerSetup[]): void {
  for (const condition of victory) {
    if (condition.type === "hqCapture" || condition.type === "rout") continue;
    const { type, side } = condition;
    if (!players.some((p) => NATIONS[p.nation].side === side)) throw new Error(`${type}: there's no player on the ${side} side`);
    if (type === "surviveDays") {
      if (!Number.isInteger(condition.days) || condition.days < 2) throw new Error(`${type}: "days" must be day 2 or later`);
      continue;
    }
    if (condition.properties.length === 0) throw new Error(`${type}: list at least one property`);
    for (const pos of condition.properties) {
      if (!properties.some((p) => samePoint(p.pos, pos))) throw new Error(`${type}: (${pos.x}, ${pos.y}) isn't a property`);
    }
    if (type === "holdProperties" && (!Number.isInteger(condition.days) || condition.days < 1)) {
      throw new Error(`${type}: "days" must be 1 or more`);
    }
  }
}

export function createGame(setup: GameSetup): GameState {
  const { map } = setup;
  if (setup.players.length < 2) throw new Error("A game needs at least 2 players");
  const isPlayer = (id: PlayerId) => Number.isInteger(id) && id >= 0 && id < setup.players.length;

  const properties: PropertyState[] = [];
  const fortifications: FortificationState[] = [];
  map.terrain.forEach((terrain, i) => {
    const { property, breakable } = terrainDef(terrain);
    const pos = { x: i % map.width, y: Math.floor(i / map.width) };
    if (property) properties.push({ pos, owner: null, capturePoints: CAPTURE_POINTS, capturingUnit: null });
    if (breakable) fortifications.push({ pos, hp: breakable.hp });
  });
  for (const { pos, owner } of setup.propertyOwners ?? []) {
    const index = properties.findIndex((p) => samePoint(p.pos, pos));
    const prop = properties[index];
    if (!prop) throw new Error(`No property at (${pos.x}, ${pos.y})`);
    if (!isPlayer(owner)) throw new Error(`Unknown owner ${owner} for property at (${pos.x}, ${pos.y})`);
    properties[index] = { ...prop, owner };
  }

  const units: Unit[] = [];
  // Units on the map get ids in list order; passengers come after them.
  let nextId = (setup.units ?? []).length;
  const makeUnit = (u: CargoSetup, owner: PlayerId, pos: Point, id: number, cargo: Unit[]): Unit => {
    const where = `${u.type} at (${pos.x}, ${pos.y})`;
    const def = UNITS[u.type];
    const hp = u.hp ?? MAX_HP;
    if (!Number.isInteger(hp) || hp < 1 || hp > MAX_HP) throw new Error(`Unit ${where} has invalid HP ${hp}`);
    return {
      id,
      type: u.type,
      owner,
      pos,
      hp,
      fuel: u.fuel ?? def.maxFuel,
      ammo: u.ammo ?? def.primaryWeapon?.maxAmmo ?? 0,
      kills: u.kills ?? 0,
      hasActed: false,
      cargo,
    };
  };
  for (const [index, u] of (setup.units ?? []).entries()) {
    const where = `${u.type} at (${u.pos.x}, ${u.pos.y})`;
    const def = UNITS[u.type];
    if (!inBounds(map, u.pos)) throw new Error(`Unit ${where} is outside the map`);
    if (!isPlayer(u.owner)) throw new Error(`Unit ${where} has unknown owner ${u.owner}`);
    if (units.some((other) => samePoint(other.pos, u.pos))) throw new Error(`Two units at (${u.pos.x}, ${u.pos.y})`);
    const aboard = u.cargo ?? [];
    const transport: UnitDef["transport"] = def.transport;
    if (aboard.length > (transport?.capacity ?? 0)) throw new Error(`Unit ${where} can't carry ${aboard.length} units`);
    for (const c of aboard) {
      if (!transport?.carries.includes(c.type)) throw new Error(`Unit ${where} can't carry a ${c.type}`);
    }
    const cargo = aboard.map((c) => makeUnit(c, u.owner, u.pos, nextId++, []));
    units.push(makeUnit(u, u.owner, u.pos, index, cargo));
  }

  const weather = setup.weather ?? DEFAULT_WEATHER;
  const weatherProblem = weatherPlanProblem(weather);
  if (weatherProblem) throw new Error(`weather: ${weatherProblem}`);

  const victory = setup.victory ?? DEFAULT_VICTORY;
  checkVictory(victory, properties, setup.players);

  const state: GameState = {
    map: { width: map.width, height: map.height, terrain: [...map.terrain] },
    players: setup.players.map((p, id) => ({
      id,
      name: p.name,
      nation: p.nation,
      side: NATIONS[p.nation].side,
      funds: p.funds ?? 0,
      defeated: false,
      hasFielded: units.some((u) => u.owner === id),
      buildable: p.buildable ?? DEFAULT_BUILDABLE,
      facing: p.facing ?? "right",
    })),
    units,
    properties,
    fortifications,
    day: 1,
    currentPlayer: 0,
    rng: seedRng(setup.seed),
    nextUnitId: nextId,
    modifiers: [...(setup.modifiers ?? [])],
    settings: { ...DEFAULT_SETTINGS, ...setup.settings },
    weather,
    victoryConditions: victory,
    holdStreaks: victory.map(() => 0),
    result: null,
  };
  // Day 1 is a normal turn: the first player collects income too, as in the original (04-economy §2).
  return startTurn(state).state;
}
