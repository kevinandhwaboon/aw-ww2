// Win and defeat (04-economy §8, 00-master-design §8). Each scenario lists its victory conditions;
// every condition is a rule here, so a new kind (hold objectives, survive N turns) is a new entry.

import type { GameEvent } from "./commands";
import { clearAbandonedCaptures } from "./economy";
import type { Point } from "./map";
import { tileIndex } from "./movement";
import type { DefeatReason, GameState, PlayerId, VictoryCondition } from "./state";

/** A property that just changed hands. */
interface Captured {
  readonly pos: Point;
  readonly previousOwner: PlayerId | null;
}

/** When a condition is checked, and which players it defeats. */
interface VictoryRule {
  afterCapture?(state: GameState, captured: Captured): PlayerId[];
  atTurnEnd?(state: GameState): PlayerId[];
}

const RULES: Record<VictoryCondition["type"], VictoryRule> = {
  /** Losing your HQ loses the game at once (04-economy §3). */
  hqCapture: {
    afterCapture(state, { pos, previousOwner }) {
      return previousOwner !== null && state.map.terrain[tileIndex(state, pos)] === "hq" ? [previousOwner] : [];
    },
  },
  /**
   * No units left at the end of any turn loses, but only for a player who has had some, so
   * empty-start maps still work (04-economy §8). Passengers ride inside their transport, so a
   * player's last units can't be hiding in one that was destroyed.
   */
  rout: {
    atTurnEnd(state) {
      return state.players
        .filter((p) => !p.defeated && p.hasFielded && !state.units.some((u) => u.owner === p.id))
        .map((p) => p.id);
    },
  },
};

type Outcome = { state: GameState; events: GameEvent[] };

function runRules(state: GameState, check: (rule: VictoryRule) => PlayerId[] | undefined): Outcome {
  let current = state;
  const events: GameEvent[] = [];
  for (const condition of state.victoryConditions) {
    if (current.result) break;
    const losers = check(RULES[condition.type]) ?? [];
    const defeated = defeatPlayers(current, losers, condition.type);
    current = defeated.state;
    events.push(...defeated.events);
  }
  return { state: current, events };
}

export function checkAfterCapture(state: GameState, captured: Captured): Outcome {
  return runRules(state, (rule) => rule.afterCapture?.(state, captured));
}

export function checkAtTurnEnd(state: GameState): Outcome {
  return runRules(state, (rule) => rule.atTurnEnd?.(state));
}

/**
 * Takes players out of the game. As in the original, their units are removed and their properties
 * become neutral. The game ends once only one side has players left.
 */
export function defeatPlayers(state: GameState, losers: readonly PlayerId[], reason: DefeatReason): Outcome {
  if (losers.length === 0) return { state, events: [] };
  const out = new Set(losers);
  const afterDefeat = clearAbandonedCaptures({
    ...state,
    players: state.players.map((p) => (out.has(p.id) ? { ...p, defeated: true } : p)),
    units: state.units.filter((u) => !out.has(u.owner)),
    properties: state.properties.map((p) => (p.owner !== null && out.has(p.owner) ? { ...p, owner: null } : p)),
  });
  const events: GameEvent[] = losers.map((player) => ({ type: "playerDefeated", player, reason }));

  const remaining = afterDefeat.players.filter((p) => !p.defeated);
  const sides = new Set(remaining.map((p) => p.side));
  const [winningSide] = sides;
  if (sides.size !== 1 || !winningSide) return { state: afterDefeat, events };

  const result = { winningSide, winners: remaining.map((p) => p.id), reason };
  return { state: { ...afterDefeat, result }, events: [...events, { type: "gameOver", result }] };
}
