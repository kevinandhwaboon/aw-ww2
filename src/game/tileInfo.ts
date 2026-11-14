// What the info box says about a tile. Stars come from the same stat the damage formula uses.

import { TERRAIN } from "../engine/data/terrain";
import { terrainAt, type Point } from "../engine/map";
import { UNITS, unitDef } from "../engine/data/units";
import { propertyDefAt } from "../engine/economy";
import { CAPTURE_POINTS, displayHp, propertyAt, unitAt, type GameState, type PlayerId, type Unit } from "../engine/state";
import * as stats from "../engine/stats";
import { terrainName, unitName } from "./artPack";
import { objectiveTiles } from "./objectives";

/** An amount left out of the most the unit can hold. `low`: worth a warning color. */
export interface Supply {
  readonly left: number;
  readonly max: number;
  readonly low: boolean;
}

/** One unit aboard a transport, as the info box lists it. */
export interface Passenger {
  readonly name: string;
  /** Displayed HP, 1–10. */
  readonly hp: number;
  readonly fuel: Supply;
  readonly ammo: Supply | null;
}

/**
 * When a unit is short of fuel or ammo, for the flashing can badges on the map and the warning color
 * in the info box (05-supply-transport §11). Presentation only: no rule reads it.
 * - Fuel: empty, a quarter of a tank or less, or (aircraft and ships) two days' burn or less, or
 *   too little to fly or sail one more full turn away from home and still get back.
 * - Ammo: a unit with a main weapon that has used it up, or has a quarter or less left (rounded up),
 *   counting a single shot still left as full.
 */
export function supplyWarnings(state: GameState, unit: Unit): { readonly fuel: boolean; readonly ammo: boolean } {
  const maxFuel = stats.maxFuel(state, unit);
  const burn = stats.fuelPerDay(state, unit);
  const fuel = unit.fuel === 0 || unit.fuel <= Math.floor(maxFuel / 4) || (burn > 0 && unit.fuel <= burn * 2) || tooFarFromHome(state, unit);
  const maxAmmo = stats.maxAmmo(state, unit);
  const armed = UNITS[unit.type].primaryWeapon !== null;
  const ammo = armed && (unit.ammo === 0 || (unit.ammo < maxAmmo && unit.ammo <= Math.ceil(maxAmmo / 4)));
  return { fuel, ammo };
}

/**
 * For aircraft and ships, which are lost when their fuel runs out (05-supply-transport §11): whether
 * one more full turn's move away from home, and that night's burn, would leave too little fuel to get
 * back to the nearest place that refuels it (never while it's there). Home is an owned airfield or port, or (for carrier
 * aircraft) one of the player's Carriers with room. Units aboard a transport are refuelled there, and
 * with no home it could reach anywhere on the map there's nothing to measure against: neither warns this way.
 */
function tooFarFromHome(state: GameState, unit: Unit): boolean {
  const burn = stats.fuelPerDay(state, unit);
  if (burn === 0 || !state.units.some((u) => u.id === unit.id)) return false;
  const home = homeTiles(state, unit);
  if (home.size === 0) return false;
  const moves = Math.max(1, stats.movePoints(state, unit));
  const distance = costToNearest(state, unit, home);
  // Home already (refuelled at the start of its turn), or no way there at all: nothing to measure.
  if (distance === null || distance === 0) return false;
  const far = distance + moves;
  // Out one more full move, burn a night, then back from that far: a night's burn for each turn but the last.
  const needed = stats.moveFuel(state, unit, moves + far) + burn + (Math.ceil(far / moves) - 1) * burn;
  return unit.fuel < needed;
}

/** Tile indexes where this aircraft or ship would be refuelled (05-supply-transport §3, §10). */
function homeTiles(state: GameState, unit: Unit): Set<number> {
  const category = UNITS[unit.type].category;
  const home = new Set<number>();
  for (const p of state.properties) {
    if (p.owner === unit.owner && propertyDefAt(state, p.pos)?.repairs === category) home.add(p.pos.y * state.map.width + p.pos.x);
  }
  for (const carrier of state.units) {
    const room = unitDef(carrier.type).transport;
    if (carrier.owner !== unit.owner || !unitDef(carrier.type).specialActions.includes("launch") || !room) continue;
    if (room.carries.includes(unit.type) && carrier.cargo.length < room.capacity) home.add(carrier.pos.y * state.map.width + carrier.pos.x);
  }
  return home;
}

/** The movement points to the nearest of these tiles by the cheapest route over terrain, ignoring units; null if there's none. */
function costToNearest(state: GameState, unit: Unit, goals: ReadonlySet<number>): number | null {
  const { width, height, terrain } = state.map;
  const start = unit.pos.y * width + unit.pos.x;
  const best = new Map<number, number>([[start, 0]]);
  const buckets: number[][] = [[start]];
  for (let cost = 0; cost < buckets.length; cost++) {
    for (const i of buckets[cost] ?? []) {
      if (best.get(i) !== cost) continue;
      if (goals.has(i)) return cost;
      const x = i % width;
      const y = Math.floor(i / width);
      for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]] as const) {
        if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
        const next = ny * width + nx;
        const id = terrain[next];
        const step = id === undefined ? null : stats.moveCost(state, unit, id);
        if (step === null) continue;
        const total = cost + step;
        if (total >= (best.get(next) ?? Infinity)) continue;
        best.set(next, total);
        (buckets[total] ??= []).push(next);
      }
    }
  }
  return null;
}

function supplies(state: GameState, unit: Unit): { fuel: Supply; ammo: Supply | null } {
  const low = supplyWarnings(state, unit);
  return {
    fuel: { left: unit.fuel, max: stats.maxFuel(state, unit), low: low.fuel },
    ammo: UNITS[unit.type].primaryWeapon ? { left: unit.ammo, max: stats.maxAmmo(state, unit), low: low.ammo } : null,
  };
}

export interface TileInfo {
  readonly terrain: string;
  readonly stars: number;
  /** `cargo`: the units aboard a transport, or null if it isn't one (05-supply-transport §4). */
  /** `ammo`: null for a unit with no primary weapon (05-supply-transport). */
  readonly unit: {
    readonly name: string;
    readonly owner: PlayerId;
    readonly cargo: readonly Passenger[] | null;
    readonly fuel: Supply;
    readonly ammo: Supply | null;
  } | null;
  /** Capture points a property has left, out of the total (04-economy §3); null for other terrain. */
  readonly capture: { readonly left: number; readonly total: number } | null;
  /** A property some scenario objective names (04-economy §8). */
  readonly objective: boolean;
}

export function tileInfo(state: GameState, tile: Point): TileInfo {
  const id = terrainAt(state.map, tile);
  const unit = unitAt(state, tile);
  const stars = unit ? stats.terrainStars(state, unit) : TERRAIN[id].defenseStars;
  const property = propertyAt(state, tile);
  return {
    terrain: terrainName(id),
    stars,
    unit: unit
      ? {
          name: unit.submerged === true ? `${unitName(unit.type)} (submerged)` : unitName(unit.type),
          owner: unit.owner,
          cargo: UNITS[unit.type].transport
            ? unit.cargo.map((c) => ({ name: unitName(c.type), hp: displayHp(c.hp), ...supplies(state, c) }))
            : null,
          // Low supplies use the same rule as the map's flashing can badges.
          ...supplies(state, unit),
        }
      : null,
    capture: property ? { left: property.capturePoints, total: CAPTURE_POINTS } : null,
    objective: objectiveTiles(state).some((p) => p.x === tile.x && p.y === tile.y),
  };
}
