// Seeded random numbers (03-combat §3). The whole generator state is one 32-bit integer stored in
// GameState, so the same state + the same commands always give the same results.
// Algorithm: mulberry32 — small, fast, good enough for game luck rolls.

/** RNG state: an unsigned 32-bit integer. */
export type RngState = number;

/** Normalizes any number (e.g. a user-entered seed) into a valid RNG state. */
export function seedRng(seed: number): RngState {
  return Math.trunc(seed) >>> 0;
}

/** A float in [0, 1) and the next RNG state. */
export function nextFloat(rng: RngState): { value: number; rng: RngState } {
  const next = (rng + 0x6d2b79f5) >>> 0;
  let t = next;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return { value: ((t ^ (t >>> 14)) >>> 0) / 4294967296, rng: next };
}

/** An integer in [min, max] (inclusive) and the next RNG state. */
export function nextInt(rng: RngState, min: number, max: number): { value: number; rng: RngState } {
  if (!Number.isInteger(min) || !Number.isInteger(max) || max < min) {
    throw new Error(`Invalid range [${min}, ${max}]`);
  }
  const { value, rng: next } = nextFloat(rng);
  return { value: min + Math.floor(value * (max - min + 1)), rng: next };
}
