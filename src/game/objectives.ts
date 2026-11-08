// What the scenario's objectives are and how far each side has got, in words, for the HUD and the
// results screen, plus which tiles to mark on the map (04-economy §8). HQ capture and rout are the
// usual goals, so only the scenario-specific conditions are listed.

import type { Side } from "../engine/data/nations";
import type { Point } from "../engine/map";
import type { GameState, PlayerId, VictoryCondition } from "../engine/state";
import { sideOwnsAll } from "../engine/victory";

export interface ObjectiveLine {
  /** The first player on the side the objective is for, to color the line. */
  readonly player: PlayerId | null;
  readonly text: string;
}

const SIDE_NAMES: Record<Side, string> = { allies: "Allies", axis: "Axis" };

const marked = (count: number) =>
  count === 1 ? "the marked objective" : count === 2 ? "both marked objectives" : `all ${count} marked objectives`;
const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

function describe(state: GameState, condition: VictoryCondition, index: number): string | null {
  switch (condition.type) {
    case "hqCapture":
    case "rout":
      return null;
    case "captureProperties": {
      const { properties, side } = condition;
      const owned = properties.filter((pos) => sideOwnsAll(state, side, [pos])).length;
      return `${SIDE_NAMES[side]}: capture ${marked(properties.length)} (${owned}/${properties.length})`;
    }
    case "holdProperties": {
      const { properties, side, days } = condition;
      const held = Math.min(days, state.holdStreaks[index] ?? 0);
      return `${SIDE_NAMES[side]}: hold ${marked(properties.length)} for ${plural(days, "day")} (${held}/${days})`;
    }
    case "surviveDays":
      return `${SIDE_NAMES[condition.side]}: hold out until day ${condition.days}`;
  }
}

/** One line per scenario objective, with progress so far. Empty for a plain HQ-and-rout game. */
export function objectiveLines(state: GameState): ObjectiveLine[] {
  return state.victoryConditions.flatMap((condition, index) => {
    const text = describe(state, condition, index);
    if (text === null || !("side" in condition)) return [];
    const player = state.players.find((p) => p.side === condition.side)?.id ?? null;
    return [{ player, text }];
  });
}

/** Every property some objective names, for marking on the map. */
export function objectiveTiles(state: GameState): Point[] {
  const tiles = state.victoryConditions.flatMap((c) => ("properties" in c ? c.properties : []));
  return tiles.filter((p, i) => tiles.findIndex((q) => q.x === p.x && q.y === p.y) === i);
}
