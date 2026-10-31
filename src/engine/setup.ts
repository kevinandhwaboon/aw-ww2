// Building the initial GameState from a scenario-style setup. Setup errors are programming or
// scenario-authoring mistakes, so they throw instead of returning a rejection.

import { NATIONS, type NationId } from "./data/nations";
import { terrainDef } from "./data/terrain";
import { UNIT_TYPE_IDS, UNITS, type UnitTypeId } from "./data/units";
import { inBounds, type GameMap, type Point } from "./map";
import type { Modifier } from "./modifiers";
import { seedRng } from "./rng";
import {
  CAPTURE_POINTS,
  DEFAULT_SETTINGS,
  MAX_HP,
  type GameState,
  type PlayerId,
  type PropertyState,
  type Settings,
  type Unit,
} from "./state";
import { startTurn } from "./turn";

/** What a player can build unless the scenario says otherwise: the units in play so far. */
const DEFAULT_BUILDABLE = UNIT_TYPE_IDS.filter((id) => UNITS[id].phase === 1);

export interface PlayerSetup {
  readonly name: string;
  readonly nation: NationId;
  readonly funds?: number;
  /** Unit types offered to this player (01-units availability rule). */
  readonly buildable?: readonly UnitTypeId[];
}

export interface UnitSetup {
  readonly type: UnitTypeId;
  readonly owner: PlayerId;
  readonly pos: Point;
  /** Internal HP, default 100. */
  readonly hp?: number;
  readonly fuel?: number;
  readonly ammo?: number;
  readonly kills?: number;
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
}

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export function createGame(setup: GameSetup): GameState {
  const { map } = setup;
  if (setup.players.length < 2) throw new Error("A game needs at least 2 players");
  const isPlayer = (id: PlayerId) => Number.isInteger(id) && id >= 0 && id < setup.players.length;

  const properties: PropertyState[] = [];
  map.terrain.forEach((terrain, i) => {
    if (!terrainDef(terrain).property) return;
    const pos = { x: i % map.width, y: Math.floor(i / map.width) };
    properties.push({ pos, owner: null, capturePoints: CAPTURE_POINTS, capturingUnit: null });
  });
  for (const { pos, owner } of setup.propertyOwners ?? []) {
    const index = properties.findIndex((p) => samePoint(p.pos, pos));
    const prop = properties[index];
    if (!prop) throw new Error(`No property at (${pos.x}, ${pos.y})`);
    if (!isPlayer(owner)) throw new Error(`Unknown owner ${owner} for property at (${pos.x}, ${pos.y})`);
    properties[index] = { ...prop, owner };
  }

  const units: Unit[] = [];
  for (const [index, u] of (setup.units ?? []).entries()) {
    const where = `${u.type} at (${u.pos.x}, ${u.pos.y})`;
    const def = UNITS[u.type];
    if (!inBounds(map, u.pos)) throw new Error(`Unit ${where} is outside the map`);
    if (!isPlayer(u.owner)) throw new Error(`Unit ${where} has unknown owner ${u.owner}`);
    if (units.some((other) => samePoint(other.pos, u.pos))) throw new Error(`Two units at (${u.pos.x}, ${u.pos.y})`);
    const hp = u.hp ?? MAX_HP;
    if (!Number.isInteger(hp) || hp < 1 || hp > MAX_HP) throw new Error(`Unit ${where} has invalid HP ${hp}`);
    units.push({
      id: index,
      type: u.type,
      owner: u.owner,
      pos: u.pos,
      hp,
      fuel: u.fuel ?? def.maxFuel,
      ammo: u.ammo ?? def.primaryWeapon?.maxAmmo ?? 0,
      kills: u.kills ?? 0,
      hasActed: false,
      cargo: [],
    });
  }

  const state: GameState = {
    map: { width: map.width, height: map.height, terrain: [...map.terrain] },
    players: setup.players.map((p, id) => ({
      id,
      name: p.name,
      nation: p.nation,
      side: NATIONS[p.nation].side,
      funds: p.funds ?? 0,
      defeated: false,
      buildable: p.buildable ?? DEFAULT_BUILDABLE,
    })),
    units,
    properties,
    day: 1,
    currentPlayer: 0,
    rng: seedRng(setup.seed),
    nextUnitId: units.length,
    modifiers: [...(setup.modifiers ?? [])],
    settings: { ...DEFAULT_SETTINGS, ...setup.settings },
  };
  // Day 1 is a normal turn: the first player collects income too, as in the original (04-economy §2).
  return startTurn(state).state;
}
