// Saving and loading a game as text (00-master-design §11). GameState is plain data, so this is
// mostly JSON, plus a version number so old saves can be recognized once the format changes.

import { DEFAULT_WEATHER, type GameState, type Player } from "./state";

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
  // Saves from before weather existed are clear all game (12-weather §1); saves from before Major
  // Bridges have no bridge being rebuilt (02-terrain §4a); saves from before fog of war have none (19-fog-of-war).
  // Saves from before the loss tally have nothing lost yet (04-economy §8a). Saves from before
  // arrivals have none coming and no wave yet (23-survival §5a). Saves from before evacuation have
  // nobody evacuated (21-scenarios-dunkirk §1).
  const state = saved.state as Omit<GameState, "weather" | "bridgeWorks" | "settings" | "players" | "arrivals" | "wave" | "evacuated"> & {
    evacuated?: GameState["evacuated"];
    arrivals?: GameState["arrivals"];
    wave?: number;
    players: (Omit<Player, "unitsLost"> & { unitsLost?: Player["unitsLost"] })[];
    weather?: GameState["weather"];
    bridgeWorks?: GameState["bridgeWorks"];
    settings: Omit<GameState["settings"], "fogOfWar"> & { fogOfWar?: boolean };
  };
  return {
    ...state,
    players: state.players.map((p) => ({ ...p, unitsLost: p.unitsLost ?? {} })),
    weather: state.weather ?? DEFAULT_WEATHER,
    bridgeWorks: state.bridgeWorks ?? [],
    arrivals: state.arrivals ?? [],
    wave: state.wave ?? 0,
    evacuated: state.evacuated ?? state.victoryConditions.map(() => 0),
    settings: { ...state.settings, fogOfWar: state.settings.fogOfWar ?? false },
  };
}
