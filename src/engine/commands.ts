// Commands describe what a player wants to do; events describe what happened (00-master-design §11).
// Humans (via the UI) and AIs send the same commands. More command types arrive milestone by milestone.

import type { UnitTypeId } from "./data/units";
import type { VeterancyLevel } from "./data/veterancy";
import type { Point } from "./map";
import type { GameState, PlayerId, UnitId } from "./state";

/** What a unit does at the end of its move. */
export type UnitAction =
  | { readonly type: "wait" }
  | { readonly type: "attack"; readonly target: UnitId }
  | { readonly type: "capture" }
  /** Board the transport on the destination tile. */
  | { readonly type: "load" }
  /** Merge into the damaged unit of the same type on the destination tile. */
  | { readonly type: "join" }
  /** Unload a passenger onto a tile next to the transport's destination. */
  | { readonly type: "unload"; readonly passenger: UnitId; readonly to: Point }
  /** Refill the fuel and ammo of adjacent friendly units. */
  | { readonly type: "supply" };

/** One shot in a combat. `damage` is the internal HP actually removed. */
export interface CombatStrike {
  readonly weapon: "primary" | "secondary";
  readonly luck: number;
  readonly damage: number;
}

/** A unit's situation after a combat, with enough detail to describe it once it's destroyed. */
export interface Combatant {
  readonly unitId: UnitId;
  readonly type: UnitTypeId;
  readonly owner: PlayerId;
  readonly pos: Point;
  /** Internal HP after the combat. */
  readonly hp: number;
  readonly destroyed: boolean;
  /** The veterancy level reached through this combat, if it went up. */
  readonly promotedTo: VeterancyLevel | null;
}

export type Command =
  /**
   * Move a unit along a path, then perform an action, as one atomic step (as in the original,
   * a move isn't final until an action is chosen; the UI previews it until then).
   * `path` lists the tiles stepped onto, excluding the start; empty = act without moving.
   */
  | { readonly type: "move"; readonly unitId: UnitId; readonly path: readonly Point[]; readonly action: UnitAction }
  /** Build a unit on an empty production property the current player owns. */
  | { readonly type: "build"; readonly unitType: UnitTypeId; readonly pos: Point }
  | { readonly type: "endTurn" };

export type CommandType = Command["type"];

export type GameEvent =
  /** `path` includes the start tile. */
  | { readonly type: "unitMoved"; readonly unitId: UnitId; readonly path: readonly Point[]; readonly fuelUsed: number }
  | { readonly type: "unitWaited"; readonly unitId: UnitId }
  /** The whole attack as one result, played back by the UI; `counter` is null if there wasn't one. */
  | {
      readonly type: "combat";
      readonly attacker: Combatant;
      readonly defender: Combatant;
      readonly attack: CombatStrike;
      readonly counter: CombatStrike | null;
    }
  /** A capture that hasn't finished yet; `capturePoints` is what's left. */
  | { readonly type: "captureProgress"; readonly pos: Point; readonly unitId: UnitId; readonly capturePoints: number }
  | {
      readonly type: "propertyCaptured";
      readonly pos: Point;
      readonly unitId: UnitId;
      readonly player: PlayerId;
      readonly previousOwner: PlayerId | null;
    }
  | {
      readonly type: "unitBuilt";
      readonly unitId: UnitId;
      readonly unitType: UnitTypeId;
      readonly owner: PlayerId;
      readonly pos: Point;
      readonly cost: number;
    }
  | { readonly type: "unitLoaded"; readonly unitId: UnitId; readonly transportId: UnitId }
  | { readonly type: "unitUnloaded"; readonly unitId: UnitId; readonly transportId: UnitId; readonly pos: Point }
  /** `hp` is the merged unit's internal HP; `refund` is funds returned for excess HP. */
  | { readonly type: "unitJoined"; readonly unitId: UnitId; readonly targetId: UnitId; readonly hp: number; readonly refund: number }
  /** `funds` is the player's total afterwards. */
  | { readonly type: "incomeReceived"; readonly player: PlayerId; readonly amount: number; readonly funds: number }
  /** `hp` is displayed HP restored. */
  | { readonly type: "unitRepaired"; readonly unitId: UnitId; readonly hp: number; readonly cost: number }
  | { readonly type: "unitResupplied"; readonly unitId: UnitId }
  | { readonly type: "turnEnded"; readonly player: PlayerId }
  | { readonly type: "dayStarted"; readonly day: number }
  | { readonly type: "turnStarted"; readonly player: PlayerId; readonly day: number };

export type RejectionCode =
  /** Not a well-formed command (e.g. from a hand-written AI module). */
  | "invalidCommand"
  | "unitNotFound"
  | "notYourUnit"
  | "unitAlreadyActed"
  | "invalidPath"
  | "invalidTarget"
  | "cannotCapture"
  | "cannotBuild"
  | "cannotLoad"
  | "cannotUnload"
  | "cannotJoin"
  | "cannotSupply";

export type ApplyResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly code: RejectionCode; readonly message: string };
