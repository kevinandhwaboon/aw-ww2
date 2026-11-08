// Which bunkers have foot soldiers inside, so the map can draw them garrisoned in that side's colors,
// as in Red Alert 2 (08-art-pipeline §15). Drawing only: no rule reads it.

import { FOOT_UNITS, type UnitTypeId } from "../engine/data/units";
import { terrainAt } from "../engine/map";
import type { GameState, PlayerId } from "../engine/state";

const FOOT: readonly UnitTypeId[] = FOOT_UNITS;

/** Bunker tiles held by Infantry, Assault Infantry or a Mortar Team: tile index → the holder's owner. */
export function garrisonedBunkers(state: GameState): Map<number, PlayerId> {
  const held = new Map<number, PlayerId>();
  for (const unit of state.units) {
    if (FOOT.includes(unit.type) && terrainAt(state.map, unit.pos) === "bunker") {
      held.set(unit.pos.y * state.map.width + unit.pos.x, unit.owner);
    }
  }
  return held;
}
