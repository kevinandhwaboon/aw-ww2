// Which bunkers have foot soldiers inside, so the map can draw them garrisoned in that side's colors,
// as in Red Alert 2 (08-art-pipeline §15). The rule for who counts is the engine's (03-combat §4).

import { garrisonBunker } from "../engine/combat";
import type { GameState, PlayerId } from "../engine/state";

/** Bunker tiles held by Infantry, Assault Infantry or a Mortar Team: tile index → the holder's owner. */
export function garrisonedBunkers(state: GameState): Map<number, PlayerId> {
  const held = new Map<number, PlayerId>();
  for (const unit of state.units) {
    if (garrisonBunker(state, unit)) {
      held.set(unit.pos.y * state.map.width + unit.pos.x, unit.owner);
    }
  }
  return held;
}
