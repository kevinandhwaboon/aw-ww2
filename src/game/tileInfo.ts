// What the info box says about a tile. Stars come from the same stat the damage formula uses.

import { TERRAIN } from "../engine/data/terrain";
import { terrainAt, type Point } from "../engine/map";
import { UNITS } from "../engine/data/units";
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
 * - Fuel: empty, a quarter of a tank or less, or (aircraft and ships) two days' burn or less.
 * - Ammo: a unit with a main weapon that has used it up, or has a quarter or less left (rounded up),
 *   counting a single shot still left as full.
 */
export function supplyWarnings(state: GameState, unit: Unit): { readonly fuel: boolean; readonly ammo: boolean } {
  const maxFuel = stats.maxFuel(state, unit);
  const burn = stats.fuelPerDay(state, unit);
  const fuel = unit.fuel === 0 || unit.fuel <= Math.floor(maxFuel / 4) || (burn > 0 && unit.fuel <= burn * 2);
  const maxAmmo = stats.maxAmmo(state, unit);
  const armed = UNITS[unit.type].primaryWeapon !== null;
  const ammo = armed && (unit.ammo === 0 || (unit.ammo < maxAmmo && unit.ammo <= Math.ceil(maxAmmo / 4)));
  return { fuel, ammo };
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
