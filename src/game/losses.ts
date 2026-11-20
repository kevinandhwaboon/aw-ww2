// A player's lost units as receipt lines for the results screen (04-economy §8a): one line per unit
// type, the costliest first.

import { UNIT_TYPE_IDS, type UnitTypeId } from "../engine/data/units";
import type { GameState, PlayerId } from "../engine/state";
import { unitCost } from "../engine/stats";
import { unitName } from "./artPack";

export interface LossLine {
  readonly type: UnitTypeId;
  readonly name: string;
  readonly count: number;
}

/** What `player` lost, by type, most expensive first; ties keep the unit list's order. */
export function lossLines(state: GameState, player: PlayerId): LossLine[] {
  const lost = state.players[player]?.unitsLost ?? {};
  return UNIT_TYPE_IDS.flatMap((type) => {
    const count = lost[type] ?? 0;
    return count > 0 ? [{ type, name: unitName(type), count, cost: unitCost(state, player, type) }] : [];
  })
    .sort((a, b) => b.cost - a.cost)
    .map(({ type, name, count }) => ({ type, name, count }));
}
