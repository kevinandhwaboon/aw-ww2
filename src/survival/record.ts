// The survival high scores (23-survival §5e): how far a game got, and the ten best runs on each map,
// kept on the device apart from the autosave and the campaign. Pure: storage and today's date are
// passed in, so the rules can be tested without a browser or a clock.

import type { CommanderId } from "../engine/data/commanders";
import type { GameState } from "../engine/state";
import type { SurvivalMap } from "./maps";

/** Anything that stores text by name, like localStorage. */
export interface RecordStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

export const SURVIVAL_KEY = "ww2-tactics.survival";
const RECORD_VERSION = 2;

/** How many runs each map's table keeps. */
export const TOP_RUNS = 10;

/** How far a game got: the wave reached, then the days held. */
export interface SurvivalRun {
  readonly wave: number;
  readonly days: number;
}

/** A run in the high-score table: when it was played and under which commander. */
export interface RecordedRun extends SurvivalRun {
  /** The day it was played, as YYYY-MM-DD; empty for a run kept from before the table had dates. */
  readonly date: string;
  /** The defender's commander; null for none. */
  readonly commander: CommanderId | null;
}

/** Each map's best runs, best first, by scenario id. */
export type SurvivalRecords = Readonly<Record<string, readonly RecordedRun[]>>;

/** The run a game stands at: the highest wave that has arrived, and the day it's on (23-survival §5e). */
export function runOf(state: GameState): SurvivalRun {
  return { wave: state.wave, days: state.day };
}

/** Whether a run beats another: more waves, or as many waves and more days. */
export function isBetter(run: SurvivalRun, than: SurvivalRun | undefined): boolean {
  return !than || run.wave > than.wave || (run.wave === than.wave && run.days > than.days);
}

/** A map's best run, if it has been played. */
export function bestRun(records: SurvivalRecords, map: string): RecordedRun | undefined {
  return records[map]?.[0];
}

/**
 * Where this run would place in the map's table, 1 for a new best, or null if it wouldn't make the
 * top ten. A run that only ties one already there places after it.
 */
export function placeOf(records: SurvivalRecords, map: string, run: SurvivalRun): number | null {
  const place = (records[map] ?? []).filter((kept) => !isBetter(run, kept)).length + 1;
  return place <= TOP_RUNS ? place : null;
}

/** The records with this run in the map's table, if it makes the top ten. */
export function withRun(records: SurvivalRecords, map: string, run: RecordedRun): SurvivalRecords {
  const place = placeOf(records, map, run);
  if (place === null) return records;
  const table = [...(records[map] ?? [])];
  table.splice(place - 1, 0, run);
  return { ...records, [map]: table.slice(0, TOP_RUNS) };
}

/** Whether a run held out longer than the real garrison did (23-survival §3). */
export function beatHistory(map: SurvivalMap, run: SurvivalRun): boolean {
  return run.days > map.historyDays;
}

/** "Reached wave 11, held 20 days". */
export function describeRun(run: SurvivalRun): string {
  return `Reached wave ${run.wave}, held ${run.days} day${run.days === 1 ? "" : "s"}`;
}

/** "1st", "2nd", "3rd", "4th" … for a place in the table. */
export function ordinal(place: number): string {
  const suffix = place % 100 >= 11 && place % 100 <= 13 ? "th" : (["th", "st", "nd", "rd"][place % 10] ?? "th");
  return `${place}${suffix}`;
}

const isRun = (value: unknown): value is SurvivalRun => {
  const run = value as { wave?: unknown; days?: unknown } | null;
  return typeof run === "object" && run !== null && Number.isInteger(run.wave) && Number.isInteger(run.days);
};

/** A kept run, with what an older or damaged entry is missing filled in. */
function recorded(value: unknown): RecordedRun | null {
  if (!isRun(value)) return null;
  const { date, commander } = value as { date?: unknown; commander?: unknown };
  return {
    wave: value.wave,
    days: value.days,
    date: typeof date === "string" ? date : "",
    commander: typeof commander === "string" ? (commander as CommanderId) : null,
  };
}

/**
 * The tables kept on this device; none when there are none, or they can't be read. A save from
 * before the table (version 1, one best run per map) reads as a table of that one run.
 */
export function readRecords(store: RecordStore | null): SurvivalRecords {
  try {
    const saved = JSON.parse(store?.getItem(SURVIVAL_KEY) ?? "null") as { version?: unknown; best?: unknown; runs?: unknown } | null;
    if (saved?.version === 1 && typeof saved.best === "object" && saved.best !== null) {
      return Object.fromEntries(Object.entries(saved.best).flatMap(([map, run]) => {
        const kept = recorded(run);
        return kept ? [[map, [kept]]] : [];
      }));
    }
    if (saved?.version !== RECORD_VERSION || typeof saved.runs !== "object" || saved.runs === null) return {};
    return Object.fromEntries(Object.entries(saved.runs).flatMap(([map, runs]) => {
      if (!Array.isArray(runs)) return [];
      const kept = runs.flatMap((run) => recorded(run) ?? []);
      kept.sort((a, b) => (isBetter(a, b) ? -1 : isBetter(b, a) ? 1 : 0));
      return [[map, kept.slice(0, TOP_RUNS)]];
    }));
  } catch {
    return {};
  }
}

/** Keeps the tables; false when storage is missing, blocked or full. */
export function writeRecords(store: RecordStore | null, records: SurvivalRecords): boolean {
  if (!store) return false;
  try {
    store.setItem(SURVIVAL_KEY, JSON.stringify({ version: RECORD_VERSION, runs: records }));
    return true;
  } catch {
    return false;
  }
}
