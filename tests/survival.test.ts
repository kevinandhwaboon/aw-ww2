import { describe, expect, it } from "vitest";
import { SURVIVAL_MAPS } from "../src/survival/maps";
import {
  beatHistory,
  bestRun,
  describeRun,
  isBetter,
  ordinal,
  placeOf,
  readRecords,
  runOf,
  SURVIVAL_KEY,
  TOP_RUNS,
  withRun,
  writeRecords,
  type RecordedRun,
  type RecordStore,
  type SurvivalRecords,
} from "../src/survival/record";
import { makeGame } from "./helpers";

/** Storage kept in memory, like localStorage. */
function memoryStore(): RecordStore & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) };
}

const wake = SURVIVAL_MAPS.find((m) => m.map === "wake-island");
if (!wake) throw new Error("missing survival map");

const run = (wave: number, days: number, date = "2026-11-21"): RecordedRun => ({ wave, days, date, commander: null });
/** A table filled by adding these runs in order. */
const tableOf = (...runs: RecordedRun[]): SurvivalRecords => runs.reduce<SurvivalRecords>((records, r) => withRun(records, "wake-island", r), {});

describe("The survival high scores (23-survival §5e)", () => {
  it("a game's run is the highest wave that has arrived and the day it reached (23-survival §5e)", () => {
    const state = { ...makeGame(["."], [{ type: "infantry", owner: 0, pos: { x: 0, y: 0 } }]), wave: 11, day: 20 };
    expect(runOf(state)).toEqual({ wave: 11, days: 20 });
    expect(describeRun(runOf(state))).toBe("Reached wave 11, held 20 days");
  });

  it("a run is better with more waves, or as many waves and more days (23-survival §5e)", () => {
    expect(isBetter({ wave: 10, days: 18 }, { wave: 9, days: 30 })).toBe(true);
    expect(isBetter({ wave: 9, days: 17 }, { wave: 9, days: 16 })).toBe(true);
    expect(isBetter({ wave: 9, days: 16 }, { wave: 9, days: 16 })).toBe(false);
    expect(isBetter({ wave: 8, days: 40 }, { wave: 9, days: 15 })).toBe(false);
    expect(isBetter({ wave: 1, days: 1 }, undefined)).toBe(true);
  });

  it("each map keeps its runs best first, with the date and the commander (23-survival §5e)", () => {
    const records = tableOf(run(9, 16, "2026-11-20"), { ...run(12, 22, "2026-11-21"), commander: "harlan" }, run(10, 18));
    expect(records["wake-island"]?.map((r) => [r.wave, r.days])).toEqual([
      [12, 22],
      [10, 18],
      [9, 16],
    ]);
    expect(bestRun(records, "wake-island")).toMatchObject({ wave: 12, date: "2026-11-21", commander: "harlan" });
  });

  it("only the ten best runs are kept (23-survival §5e)", () => {
    const records = tableOf(...Array.from({ length: 12 }, (_, i) => run(i + 1, 10)));
    expect(records["wake-island"]).toHaveLength(TOP_RUNS);
    expect(records["wake-island"]?.at(-1)?.wave).toBe(3);
    // A run worse than all ten isn't added at all.
    expect(withRun(records, "wake-island", run(1, 5))).toBe(records);
  });

  it("the results say where a run placed: a new best, or its place in the top ten (23-survival §5e)", () => {
    const records = tableOf(run(12, 22), run(10, 18));
    expect(placeOf(records, "wake-island", { wave: 13, days: 24 })).toBe(1);
    expect(placeOf(records, "wake-island", { wave: 11, days: 20 })).toBe(2);
    // A tie places after the run already there.
    expect(placeOf(records, "wake-island", { wave: 10, days: 18 })).toBe(3);
    expect(placeOf({}, "wake-island", { wave: 1, days: 1 })).toBe(1);
    const full = tableOf(...Array.from({ length: 10 }, () => run(20, 30)));
    expect(placeOf(full, "wake-island", { wave: 5, days: 9 })).toBeNull();
    expect([1, 2, 3, 4, 11, 12, 13, 21, 22].map(ordinal)).toEqual(["1st", "2nd", "3rd", "4th", "11th", "12th", "13th", "21st", "22nd"]);
  });

  it("holding past day 16 at Wake beats history (23-survival §3)", () => {
    expect(beatHistory(wake, { wave: 9, days: 16 })).toBe(false);
    expect(beatHistory(wake, { wave: 10, days: 17 })).toBe(true);
  });

  it("the high scores are kept on the device and read back (23-survival §5e)", () => {
    const store = memoryStore();
    expect(readRecords(store)).toEqual({});
    const records = tableOf(run(12, 22), run(9, 16));
    expect(writeRecords(store, records)).toBe(true);
    expect(store.items.has(SURVIVAL_KEY)).toBe(true);
    expect(readRecords(store)).toEqual(records);
  });

  it("a best run saved before the table reads back as the table's only run (23-survival §5e)", () => {
    const store = memoryStore();
    store.setItem(SURVIVAL_KEY, JSON.stringify({ version: 1, best: { "wake-island": { wave: 11, days: 20 } } }));
    expect(readRecords(store)).toEqual({ "wake-island": [{ wave: 11, days: 20, date: "", commander: null }] });
  });

  it("damaged or blocked storage reads as no high scores and never stops the game (23-survival §5e)", () => {
    const store = memoryStore();
    store.setItem(SURVIVAL_KEY, "{not json");
    expect(readRecords(store)).toEqual({});
    expect(readRecords(null)).toEqual({});
    expect(writeRecords(null, {})).toBe(false);
    const blocked: RecordStore = {
      getItem: () => {
        throw new Error("blocked");
      },
      setItem: () => {
        throw new Error("blocked");
      },
    };
    expect(readRecords(blocked)).toEqual({});
    expect(writeRecords(blocked, {})).toBe(false);
  });
});
