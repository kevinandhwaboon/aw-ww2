// The single entry point for changing the game: apply(state, command) → new state + events,
// or a rejection. Pure and deterministic: never mutates its input, uses only state.rng for luck.

import { resolveCombat, targetProblem } from "./combat";
import type { ApplyResult, Command, GameEvent, RejectionCode, UnitAction } from "./commands";
import { UNIT_TYPE_IDS } from "./data/units";
import { applyBuild, applyCapture, buildProblem, captureProblem, clearAbandonedCaptures } from "./economy";
import { inBounds, type Point } from "./map";
import { checkPath } from "./movement";
import { unitAt, type GameState, type PlayerId, type Unit } from "./state";
import {
  applyJoin,
  applyLoad,
  applySupply,
  applyUnload,
  joinProblem,
  loadProblem,
  supplyTargets,
  unloadTiles,
} from "./transport";
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
  const a = action as { type?: unknown; target?: unknown; passenger?: unknown; to?: unknown } | null;
  switch (a?.type) {
    case "wait":
    case "capture":
    case "load":
    case "join":
    case "supply":
      return true;
    case "attack":
      return Number.isInteger(a.target);
    case "unload":
      return Number.isInteger(a.passenger) && isPoint(a.to);
    default:
      return false;
  }
}

function move(state: GameState, command: Extract<Command, { type: "move" }>): ApplyResult {
  const { unitId, path, action } = command;
  if (!Array.isArray(path) || !path.every(isPoint)) return reject("invalidCommand", "path must be a list of {x, y} points");
  if (!isAction(action)) return reject("invalidCommand", `Unknown action: ${JSON.stringify(action)}`);

  const unit = state.units.find((u) => u.id === unitId);
  if (!unit) return reject("unitNotFound", `No unit with id ${String(unitId)}`);
  if (unit.owner !== state.currentPlayer) return reject("notYourUnit", `Unit ${unitId} belongs to player ${unit.owner}`);
  if (unit.hasActed) return reject("unitAlreadyActed", `Unit ${unitId} has already acted this turn`);

  // Load and Join end on a friendly unit; every other action needs an empty tile.
  const boarding = action.type === "load" || action.type === "join";
  const check = checkPath(state, unit, path, { throughOnly: boarding });
  if (!check.ok) return reject("invalidPath", check.reason);

  const events: GameEvent[] = [];
  const end = path[path.length - 1] ?? unit.pos;
  if (path.length > 0) {
    events.push({ type: "unitMoved", unitId, path: [unit.pos, ...path], fuelUsed: check.cost });
  }

  const moved: Unit = { ...unit, pos: end, fuel: unit.fuel - check.cost, hasActed: true };

  if (boarding) {
    const host = path.length > 0 ? unitAt(state, end) : undefined;
    const code = action.type === "load" ? "cannotLoad" : "cannotJoin";
    if (!host) return reject(code, "move onto the unit first");
    const problem = action.type === "load" ? loadProblem(moved, host) : joinProblem(moved, host);
    if (problem) return reject(code, problem);
    const result = action.type === "load" ? applyLoad(state, moved, host) : applyJoin(state, moved, host);
    return { ok: true, state: clearAbandonedCaptures(result.state), events: [...events, result.event] };
  }

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

  if (action.type === "unload") {
    const passenger = moved.cargo.find((c) => c.id === action.passenger);
    if (!passenger) return reject("cannotUnload", `Unit ${action.passenger} isn't aboard`);
    const { to } = action;
    if (!unloadTiles(afterMove, moved, passenger).some((p) => p.x === to.x && p.y === to.y)) {
      return reject("cannotUnload", `Can't unload onto (${to.x}, ${to.y})`);
    }
    const unloaded = applyUnload(afterMove, moved, passenger, to);
    return { ok: true, state: unloaded.state, events: [...events, unloaded.event] };
  }

  if (action.type === "supply") {
    const targets = supplyTargets(afterMove, moved);
    if (targets.length === 0) return reject("cannotSupply", "no adjacent unit needs supplying");
    const supplied = applySupply(afterMove, targets);
    return { ok: true, state: supplied.state, events: [...events, ...supplied.events] };
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
