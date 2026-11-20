// Who is ahead in a game that hasn't ended (22-campaign §5b): for tuning maps where AI vs AI games
// rarely finish. Pure, like the rest of the AI code.

import { stats, type GameState } from "../engine";
import type { Side } from "../engine/data/nations";

/** Days of income a side's properties count for, so holding ground (HQs and objectives are properties) counts too. */
export const INCOME_DAYS = 5;

/**
 * Each side's standing: the value of its army at its present strength (passengers included), plus
 * its funds, plus `INCOME_DAYS` days of income from its properties at the map's rate. The rate is
 * the map's, not the player's, so a campaign bonus on income only counts once it's been spent.
 */
export function standing(state: GameState): Record<Side, number> {
  const score: Record<Side, number> = { allies: 0, axis: 0 };
  for (const player of state.players) {
    const army = state.units
      .filter((u) => u.owner === player.id)
      .reduce((sum, u) => sum + [u, ...u.cargo].reduce((n, x) => n + (stats.unitCost(state, player.id, x.type) * x.hp) / 100, 0), 0);
    const owned = state.properties.filter((p) => p.owner === player.id).length;
    score[player.side] += army + player.funds + INCOME_DAYS * owned * state.settings.incomePerProperty;
  }
  return score;
}

/** The side ahead: the winner if the game is over, otherwise the one with the higher standing. */
export function sideAhead(state: GameState): Side {
  if (state.result) return state.result.winningSide;
  const score = standing(state);
  return score.axis > score.allies ? "axis" : "allies";
}
