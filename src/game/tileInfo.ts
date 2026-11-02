// What the info box says about a tile. Stars come from the same stat the damage formula uses.

import { TERRAIN } from "../engine/data/terrain";
import { terrainAt, type Point } from "../engine/map";
import { unitAt, type GameState, type PlayerId } from "../engine/state";
import * as stats from "../engine/stats";
import { terrainName, unitName } from "./artPack";

export interface TileInfo {
  readonly terrain: string;
  readonly stars: number;
  readonly unit: { readonly name: string; readonly owner: PlayerId } | null;
}

export function tileInfo(state: GameState, tile: Point): TileInfo {
  const id = terrainAt(state.map, tile);
  const unit = unitAt(state, tile);
  const stars = unit ? stats.terrainStars(state, unit) : TERRAIN[id].defenseStars;
  return {
    terrain: terrainName(id),
    stars,
    unit: unit ? { name: unitName(unit.type), owner: unit.owner } : null,
  };
}
