// Campaign progress (22-campaign §2): which missions have been won, kept on the device apart from the
// autosave. Pure: storage is passed in, so the rules can be tested without a browser.

import type { GameState } from "../engine/state";
import type { CampaignMission } from "./missions";

/** Anything that stores text by name, like localStorage. */
export interface ProgressStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const CAMPAIGN_KEY = "ww2-tactics.campaign";
const PROGRESS_VERSION = 1;

export interface CampaignProgress {
  /** The maps of the missions won, in the order they were first won. */
  readonly won: readonly string[];
}

export const NO_PROGRESS: CampaignProgress = { won: [] };

export type MissionStatus = "won" | "open" | "locked";

/**
 * A mission is open when it's the first, or the one before it has been won; a mission once won can
 * always be played again (22-campaign §2).
 */
export function missionStatus(missions: readonly CampaignMission[], progress: CampaignProgress, index: number): MissionStatus {
  const mission = missions[index];
  if (!mission) return "locked";
  if (progress.won.includes(mission.map)) return "won";
  const before = missions[index - 1];
  return !before || progress.won.includes(before.map) ? "open" : "locked";
}

/** The campaign is complete once its last mission is won (22-campaign §7a): then the ending can be watched again. */
export function campaignComplete(missions: readonly CampaignMission[], progress: CampaignProgress): boolean {
  const last = missions[missions.length - 1];
  return last !== undefined && progress.won.includes(last.map);
}

/** How many of these missions have been won. */
export function missionsWon(missions: readonly CampaignMission[], progress: CampaignProgress): number {
  return missions.filter((m) => progress.won.includes(m.map)).length;
}

/** Whether this finished game wins the mission: the Allies are among the winners (22-campaign §2). */
export function alliesWon(state: GameState): boolean {
  return state.result?.winningSide === "allies";
}

/** Progress with this mission won. */
export function withWin(progress: CampaignProgress, map: string): CampaignProgress {
  return progress.won.includes(map) ? progress : { won: [...progress.won, map] };
}

/** The progress kept on this device; none when there's nothing kept, or it can't be read. */
export function readProgress(store: ProgressStore | null): CampaignProgress {
  try {
    const text = store?.getItem(CAMPAIGN_KEY) ?? null;
    if (text === null) return NO_PROGRESS;
    const saved: unknown = JSON.parse(text);
    if (typeof saved !== "object" || saved === null) return NO_PROGRESS;
    const { version, won } = saved as { version?: unknown; won?: unknown };
    if (version !== PROGRESS_VERSION || !Array.isArray(won) || !won.every((m) => typeof m === "string")) return NO_PROGRESS;
    return { won };
  } catch {
    return NO_PROGRESS;
  }
}

/** Keeps the progress; false when storage is missing, blocked or full. */
export function writeProgress(store: ProgressStore | null, progress: CampaignProgress): boolean {
  if (!store) return false;
  try {
    store.setItem(CAMPAIGN_KEY, JSON.stringify({ version: PROGRESS_VERSION, won: progress.won }));
    return true;
  } catch {
    return false;
  }
}
