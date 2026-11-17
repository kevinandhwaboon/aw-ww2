import { describe, expect, it } from "vitest";
import { chooseCommand, greedyAi } from "../src/ai/greedy";
import { EnemyMemory } from "../src/ai/memory";
import { aiStep, makeView } from "../src/ai/player";
import { GREEDY_WEIGHTS, type GreedyWeights } from "../src/ai/weights";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import type { GameSetup, UnitSetup } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import { makeGame } from "./helpers";

// The Greedy AI in fog of war (09-ai §4g, 19-fog-of-war §8).

const P = (x: number, y: number): Point => ({ x, y });
const u = (type: UnitSetup["type"], owner: number, x: number, y = 0): UnitSetup => ({ type, owner, pos: P(x, y) });
const fog = (rows: string[], units: UnitSetup[], extra: Partial<Omit<GameSetup, "map" | "units">> = {}) =>
  makeGame(rows, units, { ...extra, settings: { luck: false, fogOfWar: true, ...extra.settings } });

function must(state: GameState, command: Command): GameState {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result.state;
}
/** The same game with unit `id` moved to p (as if it had moved during the enemy's turn). */
const moveUnit = (state: GameState, id: number, p: Point): GameState => ({
  ...state,
  units: state.units.map((x) => (x.id === id ? { ...x, pos: p } : x)),
});
const ids = (state: GameState) => state.units.map((x) => x.id);
const posOf = (state: GameState, id: number) => state.units.find((x) => x.id === id)?.pos;

describe("the computer remembers enemies it saw in fog of war (09-ai §4g)", () => {
  // Player 0's Infantry at x = 0 sees x = 0 to 2. Player 1's Tank starts in sight at x = 2.
  const game = () => fog(["..........", ".........."], [u("infantry", 0, 0), u("mediumTank", 1, 2)]);

  it("an enemy that drops out of sight is remembered where it was last seen", () => {
    const memory = new EnemyMemory(3);
    const start = game();
    memory.believe(makeView(start).state, 0);
    // Our Infantry steps back, and the Tank's old tile is out of sight too.
    const later = moveUnit(moveUnit(start, 1, P(8, 0)), 0, P(0, 1));
    const believed = memory.believe(makeView(later).state, 0);
    expect(makeView(later).state.units.map((x) => x.id)).toEqual([0]);
    expect(ids(believed)).toEqual([0, 1]);
    expect(posOf(believed, 1)).toEqual(P(2, 0));
  });

  it("it's forgotten once the computer can see that tile and it isn't there", () => {
    const memory = new EnemyMemory(3);
    const start = game();
    memory.believe(makeView(start).state, 0);
    // The enemy left x = 2 (now out of sight, at x = 8) while our Infantry still watches x = 2.
    memory.believe(makeView(moveUnit(start, 1, P(8, 0))).state, 0);
    const watched = moveUnit(moveUnit(start, 1, P(8, 0)), 0, P(1, 0));
    expect(ids(memory.believe(makeView(watched).state, 0))).toEqual([0]);
  });

  it("it's forgotten after the number of days in the weights", () => {
    const memory = new EnemyMemory(2);
    const start = game();
    memory.believe(makeView(start).state, 0);
    // Our Infantry walks off; the enemy's tile is now out of sight too.
    const away = moveUnit(moveUnit(start, 1, P(9, 1)), 0, P(0, 1));
    expect(ids(memory.believe(makeView({ ...away, day: 3 }).state, 0))).toEqual([0, 1]);
    expect(ids(memory.believe(makeView({ ...away, day: 4 }).state, 0))).toEqual([0]);
  });

  it("without fog of war there's nothing to remember: the computer sees everything", () => {
    const memory = new EnemyMemory(3);
    const clear = makeGame([".........."], [u("infantry", 0, 0), u("mediumTank", 1, 2)]);
    const state = makeView(clear).state;
    expect(memory.believe(state, 0)).toBe(state);
  });

  it("every command the computer picks while remembering an enemy is accepted by the engine", async () => {
    const ai = greedyAi();
    let state = game();
    // The computer plays player 0 and sees the Tank; then the Tank slips away into the fog.
    for (let i = 0; i < 3 && state.currentPlayer === 0; i++) {
      const step = await aiStep(state, ai, i);
      expect(step.bug).toBeNull();
      state = step.state;
    }
    state = must(moveUnit(state, 1, P(9, 1)), { type: "endTurn" });
    for (let i = 0; i < 5 && state.currentPlayer === 0; i++) {
      const step = await aiStep(state, ai, i);
      expect(step.bug).toBeNull();
      state = step.state;
    }
  });
});

describe("patrols in fog of war (09-ai §4g)", () => {
  // Player 0's Fighter has nothing in sight it can hurt; player 1 holds a City far to the east.
  const state = makeGame(["..............C"], [u("fighter", 0, 0), u("infantry", 1, 14)], {
    propertyOwners: [{ pos: P(14, 0), owner: 1 }],
    settings: { luck: false, fogOfWar: true },
  });
  const destination = (weights: GreedyWeights) => {
    const command = chooseCommand(makeView(state).state, weights);
    return command.type === "move" ? (command.path[command.path.length - 1] ?? P(0, 0)) : null;
  };

  it("an armed aircraft with nothing in sight to go after heads for the enemy's properties, rather than waiting", () => {
    expect(destination(GREEDY_WEIGHTS)?.x).toBeGreaterThan(0);
    expect(destination({ ...GREEDY_WEIGHTS, patrolInFog: false })).toEqual(P(0, 0));
  });
});
