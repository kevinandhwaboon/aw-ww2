// Commands describe what a player wants to do; events describe what happened (00-master-design §11).
// Humans (via the UI) and AIs send the same commands. More command types arrive milestone by milestone.

import type { Point } from "./map";
import type { GameState, PlayerId, UnitId } from "./state";

/**
 * What a unit does at the end of its move. Milestone 2 has only Wait; Attack, Capture, Load,
 * Unload, Join and Supply arrive in later milestones.
 */
export type UnitAction = { readonly type: "wait" };

export type Command =
  /**
   * Move a unit along a path, then perform an action, as one atomic step (as in the original,
   * a move isn't final until an action is chosen; the UI previews it until then).
   * `path` lists the tiles stepped onto, excluding the start; empty = act without moving.
   */
  | { readonly type: "move"; readonly unitId: UnitId; readonly path: readonly Point[]; readonly action: UnitAction }
  | { readonly type: "endTurn" };

export type CommandType = Command["type"];

export type GameEvent =
  /** `path` includes the start tile. */
  | { readonly type: "unitMoved"; readonly unitId: UnitId; readonly path: readonly Point[]; readonly fuelUsed: number }
  | { readonly type: "unitWaited"; readonly unitId: UnitId }
  | { readonly type: "turnEnded"; readonly player: PlayerId }
  | { readonly type: "dayStarted"; readonly day: number }
  | { readonly type: "turnStarted"; readonly player: PlayerId; readonly day: number };

export type RejectionCode =
  /** Not a well-formed command (e.g. from a hand-written AI module). */
  | "invalidCommand"
  | "unitNotFound"
  | "notYourUnit"
  | "unitAlreadyActed"
  | "invalidPath";

export type ApplyResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly code: RejectionCode; readonly message: string };
