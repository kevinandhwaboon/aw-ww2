// Commands describe what a player wants to do; events describe what happened (00-master-design §11).
// Humans (via the UI) and AIs send the same commands. More command types arrive milestone by milestone.

import type { GameState, PlayerId } from "./state";

export type Command = { readonly type: "endTurn" };

export type CommandType = Command["type"];

export type GameEvent =
  | { readonly type: "turnEnded"; readonly player: PlayerId }
  | { readonly type: "dayStarted"; readonly day: number }
  | { readonly type: "turnStarted"; readonly player: PlayerId; readonly day: number };

export type RejectionCode =
  /** Not a well-formed command (e.g. from a hand-written AI module). */
  | "invalidCommand";

export type ApplyResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly code: RejectionCode; readonly message: string };
