// The survival record (23-survival §5e): how far a game got, and the best run on each map, kept on
// the device apart from the autosave and the campaign. Pure: storage is passed in, so the rules can be
// tested without a browser.

import type { GameState } from "../engine/state";
import type { SurvivalMap } from "./maps";

/** Anything that stores text by name, like localStorage. */
export interface RecordStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SURVIVAL_KEY = "ww2-tactics.survival";
const RECORD_VERSION = 1;

/** How far a game got: the wave reached, then the days held. */
export interface SurvivalRun {
  readonly wave: number;
  readonly days: number;
}

/** The best run on each map, by scenario id. */
export type SurvivalRecords = Readonly<Record<string, SurvivalRun>>;

/** The run a game stands at: the highest wave that has arrived, and the day it's on (23-survival §5e). */
export function runOf(state: GameState): SurvivalRun {
  return { wave: state.wave, days: state.day };
}

/** Whether a run beats another: more waves, or as many waves and more days. */
export function isBetter(run: SurvivalRun, than: SurvivalRun | undefined): boolean {
  return !than || run.wave > than.wave || (run.wave === than.wave && run.days > than.days);
}

/** The records with this run kept, if it's the map's best. */
export function withRun(records: SurvivalRecords, map: string, run: SurvivalRun): SurvivalRecords {
  return isBetter(run, records[map]) ? { ...records, [map]: run } : records;
}

/** Whether a run held out longer than the real garrison did (23-survival §3). */
export function beatHistory(map: SurvivalMap, run: SurvivalRun): boolean {
  return run.days > map.historyDays;
}

/** "Reached wave 11, held 20 days". */
export function describeRun(run: SurvivalRun): string {
  return `Reached wave ${run.wave}, held ${run.days} day${run.days === 1 ? "" : "s"}`;
}

const isRun = (value: unknown): value is SurvivalRun => {
  const run = value as { wave?: unknown; days?: unknown } | null;
  return typeof run === "object" && run !== null && Number.isInteger(run.wave) && Number.isInteger(run.days);
};

/** The records kept on this device; none when there are none, or they can't be read. */
export function readRecords(store: RecordStore | null): SurvivalRecords {
  try {
    const saved = JSON.parse(store?.getItem(SURVIVAL_KEY) ?? "null") as { version?: unknown; best?: unknown } | null;
    if (saved?.version !== RECORD_VERSION || typeof saved.best !== "object" || saved.best === null) return {};
    return Object.fromEntries(Object.entries(saved.best).filter(([, run]) => isRun(run)));
  } catch {
    return {};
  }
}

/** Keeps the records; false when storage is missing, blocked or full. */
export function writeRecords(store: RecordStore | null, records: SurvivalRecords): boolean {
  if (!store) return false;
  try {
    store.setItem(SURVIVAL_KEY, JSON.stringify({ version: RECORD_VERSION, best: records }));
    return true;
  } catch {
    return false;
  }
}
