// Stat lookups. Game logic reads unit and terrain numbers ONLY through these functions, never
// from the data tables directly, so every value passes through the modifier layer.

import { TERRAIN, type TerrainId } from "./data/terrain";
import { UNITS, type UnitTypeId } from "./data/units";
import { veterancyFor } from "./data/veterancy";
import { applyModifiers, type ModifiableStat, type Modifier, type PlayerId, type StatContext } from "./modifiers";
import type { GameState, Unit } from "./state";

/** Modifiers that come from the unit itself rather than from GameState (currently veterancy). */
export function unitModifiers(unit: Unit): Modifier[] {
  const vet = veterancyFor(unit.kills);
  if (vet.attackBonus === 0 && vet.defenseBonus === 0) return [];
  const source = `veterancy:${vet.level}`;
  return [
    { source, stat: "attack", op: "add", value: vet.attackBonus },
    { source, stat: "defense", op: "add", value: vet.defenseBonus },
  ];
}

function typeContext(player: PlayerId, type: UnitTypeId, terrain?: TerrainId): StatContext {
  const ctx = { player, unitType: type, category: UNITS[type].category };
  return terrain === undefined ? ctx : { ...ctx, terrain };
}

function unitContext(state: GameState, unit: Unit): StatContext {
  return typeContext(unit.owner, unit.type, terrainUnder(state, unit));
}

function terrainUnder(state: GameState, unit: Unit): TerrainId {
  const id = state.map.terrain[unit.pos.y * state.map.width + unit.pos.x];
  if (id === undefined) throw new Error(`Unit ${unit.id} is outside the map`);
  return id;
}

function unitStat(state: GameState, unit: Unit, stat: ModifiableStat, base: number): number {
  return applyModifiers(base, stat, unitContext(state, unit), [...state.modifiers, ...unitModifiers(unit)]);
}

export function movePoints(state: GameState, unit: Unit): number {
  return unitStat(state, unit, "movePoints", UNITS[unit.type].movePoints);
}

export function vision(state: GameState, unit: Unit): number {
  return unitStat(state, unit, "vision", UNITS[unit.type].vision);
}

export function maxFuel(state: GameState, unit: Unit): number {
  return unitStat(state, unit, "maxFuel", UNITS[unit.type].maxFuel);
}

export function maxAmmo(state: GameState, unit: Unit): number {
  return unitStat(state, unit, "maxAmmo", UNITS[unit.type].primaryWeapon?.maxAmmo ?? 0);
}

export function fuelPerDay(state: GameState, unit: Unit): number {
  return unitStat(state, unit, "fuelPerDay", UNITS[unit.type].fuelPerDay);
}

/** Attack range in tiles, or null for unarmed units. */
export function attackRange(state: GameState, unit: Unit): { min: number; max: number } | null {
  const range = UNITS[unit.type].range;
  if (!range) return null;
  const min = unitStat(state, unit, "minRange", range.min);
  return { min, max: Math.max(min, unitStat(state, unit, "maxRange", range.max)) };
}

/** attackMod in the damage formula, base 100 (03-combat §1). */
export function attackMod(state: GameState, unit: Unit): number {
  return unitStat(state, unit, "attack", 100);
}

/** defenseMod in the damage formula, base 100 (03-combat §1). */
export function defenseMod(state: GameState, unit: Unit): number {
  return unitStat(state, unit, "defense", 100);
}

/** Defense stars the unit gets where it stands. Air units always get 0 (02-terrain §1). */
export function terrainStars(state: GameState, unit: Unit): number {
  if (UNITS[unit.type].category === "air") return 0;
  return unitStat(state, unit, "terrainStars", TERRAIN[terrainUnder(state, unit)].defenseStars);
}

/** What a player pays to build a unit type. */
export function unitCost(state: GameState, player: PlayerId, type: UnitTypeId): number {
  return applyModifiers(UNITS[type].cost, "cost", typeContext(player, type), state.modifiers);
}
