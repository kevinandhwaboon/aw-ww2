import { createGame, type GameSetup, type UnitSetup } from "../src/engine/setup";
import { parseAsciiMap } from "../src/engine/map";
import type { GameState } from "../src/engine/state";

/** A 2-player game (US vs Germany) on an ASCII map, with luck on and a fixed seed unless overridden. */
export function makeGame(
  rows: readonly string[],
  units: readonly UnitSetup[] = [],
  overrides: Partial<Omit<GameSetup, "map" | "units">> = {},
): GameState {
  return createGame({
    map: parseAsciiMap(rows),
    players: [
      { name: "Allies", nation: "us" },
      { name: "Axis", nation: "germany" },
    ],
    units,
    seed: 12345,
    ...overrides,
  });
}

/** Recursively freezes a value so any in-place mutation throws (ES modules run in strict mode). */
export function deepFreeze<T>(value: T): T {
  if (value !== null && typeof value === "object" && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const child of Object.values(value)) deepFreeze(child);
  }
  return value;
}
