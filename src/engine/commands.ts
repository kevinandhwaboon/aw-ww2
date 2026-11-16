// Commands describe what a player wants to do; events describe what happened (00-master-design §11).
// Humans (via the UI) and AIs send the same commands. More command types arrive milestone by milestone.

import type { TerrainId } from "./data/terrain";
import type { UnitTypeId } from "./data/units";
import type { VeterancyLevel } from "./data/veterancy";
import type { WeatherId } from "./data/weather";
import type { Point } from "./map";
import type { DefeatReason, GameResult, GameState, PlayerId, UnitId } from "./state";

/** What a unit does at the end of its move. */
export type UnitAction =
  | { readonly type: "wait" }
  | { readonly type: "attack"; readonly target: UnitId }
  /** Attack the empty fortification or obstacle on this tile (03-combat §4). */
  | { readonly type: "attackFort"; readonly target: Point }
  | { readonly type: "capture" }
  /** Board the transport on the destination tile. */
  | { readonly type: "load" }
  /** Merge into the damaged unit of the same type on the destination tile. */
  | { readonly type: "join" }
  /**
   * Unload a passenger onto a tile next to the transport's destination. `second` unloads the other
   * passenger in the same action (05-supply-transport §6, §8, D3).
   */
  | {
      readonly type: "unload";
      readonly passenger: UnitId;
      readonly to: Point;
      readonly second?: { readonly passenger: UnitId; readonly to: Point };
    }
  /** Refill the fuel and ammo of adjacent friendly units. */
  | { readonly type: "supply" }
  /** A submarine goes below the surface, or comes back up (05-supply-transport §9). */
  | { readonly type: "dive" }
  | { readonly type: "surface" }
  /** Assault Infantry blows the Major Bridge it stands on (02-terrain §4a). */
  | { readonly type: "blowBridge" }
  /** Assault Infantry works on rebuilding the Blown Bridge it stands on (02-terrain §4a). */
  | { readonly type: "rebuildBridge" };

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
  /**
   * An aircraft takes off from a Carrier that hasn't moved this turn, then moves and acts like any
   * move (05-supply-transport §10). `path` starts next to the Carrier and can't be empty.
   */
  | {
      readonly type: "launch";
      readonly carrierId: UnitId;
      readonly unitId: UnitId;
      readonly path: readonly Point[];
      readonly action: UnitAction;
    }
  /** Build a unit on an empty production property the current player owns. */
  | { readonly type: "build"; readonly unitType: UnitTypeId; readonly pos: Point }
  | { readonly type: "endTurn" }
  /** The current player gives up (04-economy §8). */
  | { readonly type: "resign" };

export type CommandType = Command["type"];

export type GameEvent =
  /** `path` includes the start tile. */
  | { readonly type: "unitMoved"; readonly unitId: UnitId; readonly path: readonly Point[]; readonly fuelUsed: number }
  | { readonly type: "unitWaited"; readonly unitId: UnitId }
  /**
   * The unit ran into an enemy it couldn't see (a submerged submarine, at `pos`) and stopped short,
   * its turn over (05-supply-transport §9). Follows the unitMoved event for the part it did move.
   */
  | { readonly type: "unitAmbushed"; readonly unitId: UnitId; readonly by: UnitId; readonly pos: Point }
  /** The whole attack as one result, played back by the UI; `counter` is null if there wasn't one. */
  | {
      readonly type: "combat";
      readonly attacker: Combatant;
      readonly defender: Combatant;
      /** `damage` went to the defender, or to its bunker when it was garrisoned. */
      readonly attack: CombatStrike;
      readonly counter: CombatStrike | null;
      /**
       * Set when the defender was garrisoned in a bunker (03-combat §4): the attack hit the bunker,
       * which has `hp` left. If it broke (`becomes` is the terrain left), the garrison died with it.
       */
      readonly bunker?: { readonly pos: Point; readonly hp: number; readonly becomes: TerrainId | null };
    }
  /** `hp` is what the fortification has left; `becomes` is the terrain left behind if it broke. */
  | {
      readonly type: "fortAttacked";
      readonly attackerId: UnitId;
      readonly attackerPos: Point;
      readonly pos: Point;
      readonly attack: CombatStrike;
      readonly hp: number;
      readonly becomes: TerrainId | null;
    }
  /** The Major Bridge at `pos` was blown and is now a Blown Bridge (02-terrain §4a). Not a kill. */
  | { readonly type: "bridgeBlown"; readonly unitId: UnitId; readonly pos: Point }
  /** Work on the Blown Bridge at `pos` that hasn't finished yet; `points` is what's left. */
  | { readonly type: "bridgeRebuildProgress"; readonly unitId: UnitId; readonly pos: Point; readonly points: number }
  /** The Blown Bridge at `pos` stands again as a Major Bridge. */
  | { readonly type: "bridgeRebuilt"; readonly unitId: UnitId; readonly pos: Point }
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
  /** An aircraft took off from a Carrier at `pos`; its move follows (05-supply-transport §10). */
  | { readonly type: "unitLaunched"; readonly unitId: UnitId; readonly carrierId: UnitId; readonly pos: Point }
  /** `hp` is the merged unit's internal HP; `refund` is funds returned for excess HP. */
  | { readonly type: "unitJoined"; readonly unitId: UnitId; readonly targetId: UnitId; readonly hp: number; readonly refund: number }
  /** `funds` is the player's total afterwards. */
  | { readonly type: "incomeReceived"; readonly player: PlayerId; readonly amount: number; readonly funds: number }
  /** `hp` is displayed HP restored. The unit may be an aircraft aboard a Carrier (05-supply-transport §10). */
  | { readonly type: "unitRepaired"; readonly unitId: UnitId; readonly hp: number; readonly cost: number }
  | { readonly type: "unitResupplied"; readonly unitId: UnitId }
  | { readonly type: "unitDived"; readonly unitId: UnitId }
  | { readonly type: "unitSurfaced"; readonly unitId: UnitId }
  /** An air unit ran out of fuel at turn start and crashed (05-supply-transport §5). */
  | {
      readonly type: "unitOutOfFuel";
      readonly unitId: UnitId;
      readonly unitType: UnitTypeId;
      readonly owner: PlayerId;
      readonly pos: Point;
    }
  /**
   * A ship's tank ran dry at turn start. It stays where it is, unable to move until it's refuelled; a
   * submerged submarine also surfaces, with its own unitSurfaced event first (05-supply-transport §7).
   */
  | { readonly type: "unitStranded"; readonly unitId: UnitId; readonly pos: Point }
  | { readonly type: "playerDefeated"; readonly player: PlayerId; readonly reason: DefeatReason }
  | { readonly type: "gameOver"; readonly result: GameResult }
  | { readonly type: "turnEnded"; readonly player: PlayerId }
  | { readonly type: "dayStarted"; readonly day: number }
  /** The weather is different from yesterday's (12-weather §4). */
  | { readonly type: "weatherChanged"; readonly day: number; readonly weather: WeatherId }
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
  | "cannotLaunch"
  | "cannotJoin"
  | "cannotSupply"
  | "cannotDive"
  | "cannotSurface"
  | "cannotBlowBridge"
  | "cannotRebuildBridge"
  /** The game has ended: nothing more can be done. */
  | "gameOver";

export type ApplyResult =
  | { readonly ok: true; readonly state: GameState; readonly events: readonly GameEvent[] }
  | { readonly ok: false; readonly code: RejectionCode; readonly message: string };
