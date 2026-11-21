import { describe, expect, it } from "vitest";
import { SURVIVAL_MAPS } from "../src/survival/maps";
import {
  beatHistory,
  describeRun,
  isBetter,
  readRecords,
  runOf,
  SURVIVAL_KEY,
  withRun,
  writeRecords,
  type RecordStore,
} from "../src/survival/record";
import { makeGame } from "./helpers";

/** Storage kept in memory, like localStorage. */
function memoryStore(): RecordStore & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) };
}

const wake = SURVIVAL_MAPS.find((m) => m.map === "wake-island");
if (!wake) throw new Error("missing survival map");

describe("The survival record (23-survival §5e)", () => {
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

  it("only a map's best run is kept (23-survival §5e)", () => {
    const first = withRun({}, "wake-island", { wave: 9, days: 16 });
    expect(withRun(first, "wake-island", { wave: 8, days: 20 })).toBe(first);
    expect(withRun(first, "wake-island", { wave: 10, days: 18 })).toEqual({ "wake-island": { wave: 10, days: 18 } });
  });

  it("holding past day 16 at Wake beats history (23-survival §3)", () => {
    expect(beatHistory(wake, { wave: 9, days: 16 })).toBe(false);
    expect(beatHistory(wake, { wave: 10, days: 17 })).toBe(true);
  });

  it("the best runs are kept on the device and read back (23-survival §5e)", () => {
    const store = memoryStore();
    expect(readRecords(store)).toEqual({});
    expect(writeRecords(store, { "wake-island": { wave: 12, days: 22 } })).toBe(true);
    expect(store.items.has(SURVIVAL_KEY)).toBe(true);
    expect(readRecords(store)).toEqual({ "wake-island": { wave: 12, days: 22 } });
  });

  it("damaged or blocked storage reads as no records and never stops the game (23-survival §5e)", () => {
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
