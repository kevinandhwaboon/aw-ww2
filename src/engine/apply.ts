// The single entry point for changing the game: apply(state, command) → new state + events,
// or a rejection. Pure and deterministic: never mutates its input, uses only state.rng for luck.

import { resolveCombat, targetProblem } from "./combat";
import type { ApplyResult, Command, GameEvent, RejectionCode, UnitAction } from "./commands";
import type { Point } from "./map";
import { checkPath } from "./movement";
import type { GameState, PlayerId, Unit } from "./state";

const reject = (code: RejectionCode, message: string): ApplyResult => ({ ok: false, code, message });

export function apply(state: GameState, command: Command): ApplyResult {
  // Commands may come from untyped JavaScript (custom AIs), so check the shape at runtime too.
  const type = (command as { type?: unknown } | null)?.type;
  switch (type) {
    case "move":
      return move(state, command as Extract<Command, { type: "move" }>);
    case "endTurn":
      return endTurn(state);
    default:
      return reject("invalidCommand", `Unknown command type: ${String(type)}`);
  }
}

const isPoint = (p: unknown): p is Point =>
  typeof p === "object" && p !== null && Number.isInteger((p as Point).x) && Number.isInteger((p as Point).y);

function isAction(action: unknown): action is UnitAction {
  const a = action as { type?: unknown; target?: unknown } | null;
  return a?.type === "wait" || (a?.type === "attack" && Number.isInteger(a.target));
}

function move(state: GameState, command: Extract<Command, { type: "move" }>): ApplyResult {
  const { unitId, path, action } = command;
  if (!Array.isArray(path) || !path.every(isPoint)) return reject("invalidCommand", "path must be a list of {x, y} points");
  if (!isAction(action)) return reject("invalidCommand", `Unknown action: ${JSON.stringify(action)}`);

  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return reject("unitNotFound", `No unit with id ${String(unitId)}`);
  if (unit.owner !== state.currentPlayer) return reject("notYourUnit", `Unit ${unitId} belongs to player ${unit.owner}`);
  if (unit.hasActed) return reject("unitAlreadyActed", `Unit ${unitId} has already acted this turn`);

  const check = checkPath(state, unit, path);
  if (!check.ok) return reject("invalidPath", check.reason);

  const events: GameEvent[] = [];
  const end = path[path.length - 1] ?? unit.pos;
  if (path.length > 0) {
    events.push({ type: "unitMoved", unitId, path: [unit.pos, ...path], fuelUsed: check.cost });
  }

  const moved: Unit = { ...unit, pos: end, fuel: unit.fuel - check.cost, hasActed: true };
  const afterMove: GameState = { ...state, units: state.units.map((u) => (u.id === unitId ? moved : u)) };

  if (action.type === "wait") {
    return { ok: true, state: afterMove, events: [...events, { type: "unitWaited", unitId }] };
  }

  const defender = afterMove.units.find((u) => u.id === action.target);
  if (!defender) return reject("invalidTarget", `No unit with id ${action.target}`);
  const problem = targetProblem(afterMove, moved, defender, path.length > 0);
  if (problem) return reject("invalidTarget", `Can't attack unit ${action.target}: ${problem}`);
  const combat = resolveCombat(afterMove, moved, defender);
  return { ok: true, state: combat.state, events: [...events, combat.event] };
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
 * Start-of-turn sequence for state.currentPlayer (04-economy §2). So far it only readies units;
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
