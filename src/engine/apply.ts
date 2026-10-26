// The single entry point for changing the game: apply(state, command) → new state + events,
// or a rejection. Pure and deterministic: never mutates its input, uses only state.rng for luck.

import type { ApplyResult, Command, GameEvent } from "./commands";
import type { GameState, PlayerId } from "./state";

export function apply(state: GameState, command: Command): ApplyResult {
  // Commands may come from untyped JavaScript (custom AIs), so check the shape at runtime too.
  const type = (command as { type?: unknown } | null)?.type;
  switch (type) {
    case "endTurn":
      return endTurn(state);
    default:
      return { ok: false, code: "invalidCommand", message: `Unknown command type: ${String(type)}` };
  }
}

function endTurn(state: GameState): ApplyResult {
  const events: GameEvent[] = [{ type: "turnEnded", player: state.currentPlayer }];
  const next = nextActivePlayer(state);
  let day = state.day;
  if (next <= state.currentPlayer) {
    day += 1;
    events.push({ type: "dayStarted", day });
  }
  const started = startTurn({ ...state, day, currentPlayer: next });
  return { ok: true, state: started.state, events: [...events, ...started.events] };
}

/** The next player in turn order who hasn't been defeated (wrapping around). */
function nextActivePlayer(state: GameState): PlayerId {
  const count = state.players.length;
  for (let step = 1; step <= count; step++) {
    const candidate = (state.currentPlayer + step) % count;
    if (!state.players[candidate]?.defeated) return candidate;
  }
  return state.currentPlayer;
}

/**
 * Start-of-turn sequence for state.currentPlayer (04-economy §2). Milestone 1 only readies units;
 * fuel burn, income, repair and resupply are added in later milestones, in the doc's order.
 */
function startTurn(state: GameState): { state: GameState; events: GameEvent[] } {
  const player = state.currentPlayer;
  const units = state.units.map((u) => (u.owner === player && u.hasActed ? { ...u, hasActed: false } : u));
  return {
    state: { ...state, units },
    events: [{ type: "turnStarted", player, day: state.day }],
  };
}
