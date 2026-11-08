// What the info box says about a tile. Stars come from the same stat the damage formula uses.

import { TERRAIN } from "../engine/data/terrain";
import { terrainAt, type Point } from "../engine/map";
import { UNITS } from "../engine/data/units";
import { CAPTURE_POINTS, propertyAt, unitAt, type GameState, type PlayerId } from "../engine/state";
import * as stats from "../engine/stats";
import { terrainName, unitName } from "./artPack";
import { objectiveTiles } from "./objectives";

/** An amount left out of the most the unit can hold. `low`: worth a warning color. */
export interface Supply {
  readonly left: number;
  readonly max: number;
  readonly low: boolean;
}

export interface TileInfo {
  readonly terrain: string;
  readonly stars: number;
  /** `cargo`: the names of the units aboard a transport, or null if it isn't one. */
  /** `ammo`: null for a unit with no primary weapon (05-supply-transport). */
  readonly unit: {
    readonly name: string;
    readonly owner: PlayerId;
    readonly cargo: readonly string[] | null;
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
          cargo: UNITS[unit.type].transport ? unit.cargo.map((c) => unitName(c.type)) : null,
          // Fuel is low when it runs out within two turns of daily burn, the same rule as the map's F badge.
          fuel: {
            left: unit.fuel,
            max: stats.maxFuel(state, unit),
            low: unit.fuel === 0 || (stats.fuelPerDay(state, unit) > 0 && unit.fuel <= stats.fuelPerDay(state, unit) * 2),
          },
          ammo: UNITS[unit.type].primaryWeapon ? { left: unit.ammo, max: stats.maxAmmo(state, unit), low: unit.ammo === 0 } : null,
        }
      : null,
    capture: property ? { left: property.capturePoints, total: CAPTURE_POINTS } : null,
    objective: objectiveTiles(state).some((p) => p.x === tile.x && p.y === tile.y),
  };
}
