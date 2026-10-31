// Saving and loading a game as text (00-master-design §11). GameState is plain data, so this is
// mostly JSON, plus a version number so old saves can be recognized once the format changes.

import type { GameState } from "./state";

const SAVE_VERSION = 1;

export function saveGame(state: GameState): string {
  return JSON.stringify({ version: SAVE_VERSION, state });
}

/** Restores a saved game, or throws an Error if the text isn't a save this version can read. */
export function loadGame(text: string): GameState {
  let saved: { version?: unknown; state?: unknown } | null;
  try {
    saved = JSON.parse(text) as typeof saved;
  } catch (error) {
    throw new Error("This save file is damaged", { cause: error });
  }
  if (saved?.version !== SAVE_VERSION) throw new Error(`Unsupported save version: ${String(saved?.version)}`);
  if (typeof saved.state !== "object" || saved.state === null) throw new Error("This save file has no game in it");
  return saved.state as GameState;
}
