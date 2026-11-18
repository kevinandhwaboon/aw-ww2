// The autosave (11-tech-setup §3j): the game in progress, kept on the device after every order, so
// a page that reloads (a phone dropping a background tab, say) can carry on where it left off.
// One slot. Pure: storage is passed in, so the rules can be tested without a browser.

import type { AiLevel } from "./ai/weights";
import { loadGame, saveGame } from "./engine/save";
import type { GameState } from "./engine/state";
import type { GameOptions } from "./ui/gameOptions";

/** The device's autosave, under this name. */
export const AUTOSAVE_KEY = "ww2-tactics.autosave";

/** Bumped when what's kept around the game changes; the game itself has its own version (src/engine/save.ts). */
const AUTOSAVE_VERSION = 1;

/** Anything that stores text by name, like localStorage. */
export interface SaveStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
  removeItem(key: string): void;
}

/** A game to carry on: the map it's on, the choices made before it started, and the game itself. */
export interface Autosave {
  readonly scenarioId: string;
  /** Who the computer plays and how well, the pass-the-device screen and battle scenes: none of it is in the game state. */
  readonly options: GameOptions;
  readonly state: GameState;
}

/**
 * Keeps the game, or forgets it once it's over: a finished game has nothing to carry on. False when
 * storage is missing, blocked or full: the game goes on, it just won't survive a reload.
 */
export function writeAutosave(store: SaveStore | null, save: Autosave): boolean {
  if (save.state.result) {
    clearAutosave(store);
    return true;
  }
  if (!store) return false;
  try {
    store.setItem(AUTOSAVE_KEY, encodeAutosave(save));
    return true;
  } catch {
    return false;
  }
}

/** The game to carry on, or null when there's none, or what's kept can't be read. */
export function readAutosave(store: SaveStore | null, scenarioIds: readonly string[]): Autosave | null {
  try {
    return decodeAutosave(store?.getItem(AUTOSAVE_KEY) ?? null, scenarioIds);
  } catch {
    return null;
  }
}

export function clearAutosave(store: SaveStore | null): void {
  try {
    store?.removeItem(AUTOSAVE_KEY);
  } catch {
    // Nothing to do: blocked storage holds no save either.
  }
}

export function encodeAutosave({ scenarioId, options, state }: Autosave): string {
  return JSON.stringify({ version: AUTOSAVE_VERSION, scenarioId, options, game: saveGame(state) });
}

/**
 * Reads an autosave back. Null for anything that isn't one this version can carry on: damaged
 * text, an older format, a map no longer in the game, or a game that's already over.
 */
export function decodeAutosave(text: string | null, scenarioIds: readonly string[]): Autosave | null {
  if (text === null) return null;
  let saved: unknown;
  try {
    saved = JSON.parse(text);
  } catch {
    return null;
  }
  if (!isRecord(saved) || saved.version !== AUTOSAVE_VERSION) return null;
  const { scenarioId, options, game } = saved;
  if (typeof scenarioId !== "string" || !scenarioIds.includes(scenarioId)) return null;
  if (!isGameOptions(options) || typeof game !== "string") return null;
  let state: GameState;
  try {
    state = loadGame(game);
  } catch {
    return null;
  }
  if (state.result) return null;
  return { scenarioId, options, state };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

const AI_LEVELS: readonly AiLevel[] = ["easy", "normal"];

function isGameOptions(value: unknown): value is GameOptions {
  if (!isRecord(value)) return false;
  const { luck, fog, passDevice, battleScenes, computer, level, commanders } = value;
  return (
    typeof luck === "boolean" &&
    typeof fog === "boolean" &&
    typeof passDevice === "boolean" &&
    typeof battleScenes === "boolean" &&
    (computer === null || (Array.isArray(computer) && computer.every((id) => typeof id === "number"))) &&
    AI_LEVELS.some((l) => l === level) &&
    Array.isArray(commanders) &&
    commanders.every((c) => c === null || typeof c === "string")
  );
}
