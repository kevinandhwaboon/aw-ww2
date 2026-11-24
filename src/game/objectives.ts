// What the scenario's objectives are and how far each side has got, in words, for the HUD and the
// results screen, plus which tiles to mark on the map (04-economy §8). HQ capture and rout are the
// usual goals, so only the scenario-specific conditions are listed.

import type { Side } from "../engine/data/nations";
import type { Point } from "../engine/map";
import type { GameState, PlayerId, VictoryCondition } from "../engine/state";
import { sideOwnsAll } from "../engine/victory";
import { nextWave } from "../engine/waves";

export interface ObjectiveLine {
  /** The first player on the side the objective is for, to color the line. */
  readonly player: PlayerId | null;
  readonly text: string;
}

/** Unit types that march, so an evacuation of only these says "foot units". */
const FOOT: readonly string[] = ["infantry", "assaultInfantry", "mortar"];

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
    case "evacuateUnits": {
      const done = Math.min(condition.count, state.evacuated[index] ?? 0);
      const who = condition.unitTypes?.every((t) => FOOT.includes(t)) === true ? "foot units" : "units";
      return `${SIDE_NAMES[condition.side]}: evacuate ${condition.count} ${who} to the shaded area (${done}/${condition.count})`;
    }
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

/** Every square some evacuation names, for shading on the map (21-scenarios-dunkirk §1). */
export function evacuationTiles(state: GameState): Point[] {
  return state.victoryConditions.flatMap((c) => (c.type === "evacuateUnits" ? c.zone : []));
}

/** "south", "south and west", "south, west and north". */
function listed(words: readonly string[]): string {
  const last = words[words.length - 1] ?? "";
  return words.length <= 1 ? last : `${words.slice(0, -1).join(", ")} and ${last}`;
}

/**
 * On a map with waves (23-survival §4): the wave reached and the forecast for the next one, e.g.
 * "Wave 4 · Next: day 7, Air raid from the south". Empty on maps without waves.
 */
export function waveLines(state: GameState): ObjectiveLine[] {
  const next = nextWave(state);
  const first = next[0];
  if (state.wave === 0 && !first) return [];
  const parts: string[] = [];
  if (state.wave > 0) parts.push(`Wave ${state.wave}`);
  if (first) {
    const edges = next.flatMap((a) => (a.from === undefined ? [] : [a.from])).filter((e, i, all) => all.indexOf(e) === i);
    const what = first.name ?? `wave ${first.wave ?? ""}`;
    parts.push(`Next: day ${first.day}, ${what}${edges.length > 0 ? ` from the ${listed(edges)}` : ""}`);
  }
  return [{ player: first?.player ?? null, text: parts.join(" · ") }];
}
