// What the info box says about a tile. Stars come from the same stat the damage formula uses.

import { TERRAIN } from "../engine/data/terrain";
import { terrainAt, type Point } from "../engine/map";
import { UNITS } from "../engine/data/units";
import { CAPTURE_POINTS, propertyAt, unitAt, type GameState, type PlayerId } from "../engine/state";
import * as stats from "../engine/stats";
import { terrainName, unitName } from "./artPack";

export interface TileInfo {
  readonly terrain: string;
  readonly stars: number;
  /** `cargo`: the names of the units aboard a transport, or null if it isn't one. */
  readonly unit: { readonly name: string; readonly owner: PlayerId; readonly cargo: readonly string[] | null } | null;
  /** Capture points a property has left, out of the total (04-economy §3); null for other terrain. */
  readonly capture: { readonly left: number; readonly total: number } | null;
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
        }
      : null,
    capture: property ? { left: property.capturePoints, total: CAPTURE_POINTS } : null,
  };
}
