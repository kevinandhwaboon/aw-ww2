import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { nextInt, seedRng, type RngState } from "../src/engine/rng";

function rolls(seed: number, count: number): number[] {
  let rng: RngState = seedRng(seed);
  const out: number[] = [];
  for (let i = 0; i < count; i++) {
    const r = nextInt(rng, 0, 9);
    out.push(r.value);
    rng = r.rng;
  }
  return out;
}

describe("seeded RNG (03-combat §3)", () => {
  it("the same seed always gives the same sequence", () => {
    fc.assert(fc.property(fc.integer(), (seed) => {
      expect(rolls(seed, 20)).toEqual(rolls(seed, 20));
    }));
  });

  it("different seeds give different sequences", () => {
    expect(rolls(1, 20)).not.toEqual(rolls(2, 20));
  });

  it("integers stay within the inclusive range", () => {
    fc.assert(fc.property(fc.integer(), fc.integer({ min: -50, max: 50 }), fc.nat(100), (seed, min, span) => {
      const { value } = nextInt(seedRng(seed), min, min + span);
      expect(value).toBeGreaterThanOrEqual(min);
      expect(value).toBeLessThanOrEqual(min + span);
      expect(Number.isInteger(value)).toBe(true);
    }));
  });

  it("luck rolls 0–9 hit every value with roughly even frequency", () => {
    const counts = new Array<number>(10).fill(0);
    for (const v of rolls(42, 10_000)) counts[v] = (counts[v] ?? 0) + 1;
    for (const c of counts) expect(c).toBeGreaterThan(850);
  });

  it("the state is always a 32-bit unsigned integer, so it serializes exactly", () => {
    fc.assert(fc.property(fc.double(), (seed) => {
      const { rng } = nextInt(seedRng(Number.isFinite(seed) ? seed : 0), 0, 9);
      expect(rng >>> 0).toBe(rng);
    }));
  });
});
