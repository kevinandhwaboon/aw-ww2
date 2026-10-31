// The single entry point for changing the game: apply(state, command) → new state + events,
// or a rejection. Pure and deterministic: never mutates its input, uses only state.rng for luck.

import { resolveCombat, targetProblem } from "./combat";
import type { ApplyResult, Command, GameEvent, RejectionCode, UnitAction } from "./commands";
import { UNIT_TYPE_IDS } from "./data/units";
import { applyBuild, applyCapture, buildProblem, captureProblem, clearAbandonedCaptures } from "./economy";
import { inBounds, type Point } from "./map";
import { checkPath } from "./movement";
import type { GameState, PlayerId, Unit } from "./state";
import { startTurn } from "./turn";

const reject = (code: RejectionCode, message: string): ApplyResult => ({ ok: false, code, message });

export function apply(state: GameState, command: Command): ApplyResult {
  // Commands may come from untyped JavaScript (custom AIs), so check the shape at runtime too.
  const type = (command as { type?: unknown } | null)?.type;
  switch (type) {
    case "move":
      return move(state, command as Extract<Command, { type: "move" }>);
    case "build":
      return build(state, command as Extract<Command, { type: "build" }>);
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
  return a?.type === "wait" || a?.type === "capture" || (a?.type === "attack" && Number.isInteger(a.target));
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
  const afterMove = clearAbandonedCaptures({ ...state, units: state.units.map((u) => (u.id === unitId ? moved : u)) });

  if (action.type === "wait") {
    return { ok: true, state: afterMove, events: [...events, { type: "unitWaited", unitId }] };
  }

  if (action.type === "capture") {
    const problem = captureProblem(afterMove, moved);
    if (problem) return reject("cannotCapture", `Can't capture: ${problem}`);
    const capture = applyCapture(afterMove, moved);
    return { ok: true, state: capture.state, events: [...events, capture.event] };
  }

  const defender = afterMove.units.find((u) => u.id === action.target);
  if (!defender) return reject("invalidTarget", `No unit with id ${action.target}`);
  const problem = targetProblem(afterMove, moved, defender, path.length > 0);
  if (problem) return reject("invalidTarget", `Can't attack unit ${action.target}: ${problem}`);
  const combat = resolveCombat(afterMove, moved, defender);
  return { ok: true, state: clearAbandonedCaptures(combat.state), events: [...events, combat.event] };
}

function build(state: GameState, command: Extract<Command, { type: "build" }>): ApplyResult {
  const { unitType, pos } = command;
  if (!isPoint(pos) || !inBounds(state.map, pos) || !UNIT_TYPE_IDS.includes(unitType)) {
    return reject("invalidCommand", "build needs a known unit type and a position on the map");
  }
  const problem = buildProblem(state, unitType, pos);
  if (problem) return reject("cannotBuild", `Can't build: ${problem}`);
  const built = applyBuild(state, unitType, pos);
  return { ok: true, state: built.state, events: [built.event] };
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
