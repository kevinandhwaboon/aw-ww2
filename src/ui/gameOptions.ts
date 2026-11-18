// The choices made on the new-game screens (06-commanders §5). No DOM here, so the autosave and its
// tests can use it (11-tech-setup §3j).

import type { AiLevel } from "../ai/weights";
import type { CommanderId } from "../engine/data/commanders";

export interface GameOptions {
  /** Random variation in damage (03-combat §3). */
  readonly luck: boolean;
  /** Each side sees only what its units see (19-fog-of-war). */
  readonly fog: boolean;
  /** Hot-seat: stop between turns until the next player says they're ready. */
  readonly passDevice: boolean;
  /** Attacks play as split-screen battle scenes (08-art-pipeline §18). */
  readonly battleScenes: boolean;
  /** Player ids the computer plays (09-ai §5). On the map select, null means everyone not on the first player's side. */
  readonly computer: readonly number[] | null;
  /** How well the computer plays (09-ai §4c). */
  readonly level: AiLevel;
  /** Each player's commander, in player order; null or missing is no commander (06-commanders §5). */
  readonly commanders: readonly (CommanderId | null)[];
}
