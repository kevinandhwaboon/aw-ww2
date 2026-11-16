import { describe, expect, it } from "vitest";
import { stateProblems } from "../src/ai/invariants";
import type { AiPlayer } from "../src/ai/player";
import { randomAi, selfPlay } from "../src/ai/selfplay";
import { createGame } from "../src/engine/setup";
import type { GameState, Unit } from "../src/engine/state";
import { SCENARIOS } from "../src/scenarios";
import { makeGame } from "./helpers";

const P = (x: number, y: number) => ({ x, y });

/** A sound little game: an infantry squad and a Halftrack each, a city between them. */
const sound = () =>
  makeGame(["..C.."], [
    { type: "infantry", owner: 0, pos: P(0, 0) },
    { type: "halftrack", owner: 0, pos: P(1, 0) },
    { type: "infantry", owner: 1, pos: P(4, 0) },
  ]);

const withUnit = (state: GameState, index: number, change: Partial<Unit>): GameState => ({
  ...state,
  units: state.units.map((u, i) => (i === index ? { ...u, ...change } : u)),
});

describe("the state checker (09-ai §7)", () => {
  it("finds nothing wrong with a fresh game on any built-in map", () => {
    expect(stateProblems(sound())).toEqual([]);
    for (const scenario of SCENARIOS) {
      expect(stateProblems(createGame({ ...scenario.setup, seed: 1 })), scenario.id).toEqual([]);
    }
  });

  it("reports two units on one tile", () => {
    expect(stateProblems(withUnit(sound(), 1, { pos: P(0, 0) }))).toEqual(["two units on tile 0,0"]);
  });

  it("reports a unit with no HP left, or with more fuel or ammo than it can hold", () => {
    expect(stateProblems(withUnit(sound(), 0, { hp: 0 }))).toEqual(["infantry #0 at 0,0 has 0 HP"]);
    expect(stateProblems(withUnit(sound(), 1, { fuel: 46 }))).toEqual(["halftrack #1 at 1,0 has 46 fuel (max 45)"]);
    expect(stateProblems(withUnit(sound(), 0, { ammo: 1 }))).toEqual(["infantry #0 at 0,0 has 1 ammo (max 0)"]);
  });

  it("reports a transport carrying too many units, or a unit it can't carry", () => {
    const state = sound();
    const squad = (id: number): Unit => ({ ...(state.units[0] as Unit), id });
    const tank: Unit = { ...(state.units[1] as Unit), id: 3 };
    expect(stateProblems({ ...withUnit(state, 1, { cargo: [squad(3), squad(4)] }), nextUnitId: 5 })).toEqual([
      "halftrack #1 at 1,0 carries 2 units, over its capacity",
    ]);
    expect(stateProblems({ ...withUnit(state, 1, { cargo: [tank] }), nextUnitId: 4 })).toEqual([
      "halftrack #1 at 1,0 carries a halftrack, which it can't",
    ]);
  });

  it("reports funds below zero", () => {
    const state = sound();
    const broke = { ...state, players: state.players.map((p) => (p.id === 1 ? { ...p, funds: -100 } : p)) };
    expect(stateProblems(broke)).toEqual(["player 1 has -100 funds"]);
  });

  it("reports a property that is partly captured with nobody capturing it", () => {
    const state = sound();
    const half = { ...state, properties: state.properties.map((p) => ({ ...p, capturePoints: 10 })) };
    expect(stateProblems(half)).toEqual(["the property at 2,0 is partly captured with nobody capturing it"]);
  });

  it("reports a bridge being rebuilt by a unit that isn't standing on it (02-terrain §4a)", () => {
    const state = makeGame([".!."], [{ type: "assaultInfantry", owner: 0, pos: P(0, 0) }, { type: "infantry", owner: 1, pos: P(2, 0) }]);
    const lost = { ...state, bridgeWorks: [{ pos: P(1, 0), points: 10, unit: 0 }] };
    expect(stateProblems(lost)).toEqual(["the bridge at 1,0 is being rebuilt by unit #0, which isn't standing on it"]);
  });

  it("reports a game that should be over: only one side left and no result", () => {
    const state = sound();
    const alone = { ...state, players: state.players.map((p) => (p.id === 1 ? { ...p, defeated: true } : p)) };
    expect(stateProblems(alone)).toEqual(["only one side is left but the game isn't over"]);
  });
});

describe("self-play (09-ai §7)", () => {
  const start = (id: string, seed: number) => {
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) throw new Error(`no scenario ${id}`);
    return createGame({ ...scenario.setup, seed });
  };
  const randoms = (state: GameState, seed: number) => state.players.map((p) => randomAi(seed * 100 + p.id));

  for (const scenario of SCENARIOS) {
    it(`${scenario.id}: 3 days of random legal play never reach an impossible state, and every legal command is accepted`, async () => {
      const state = start(scenario.id, 1);
      const report = await selfPlay(state, randoms(state, 1), 3, { checkLegal: true });
      expect(report.problems).toEqual([]);
      expect(report.state.result !== null || report.state.day > 3).toBe(true);
    }, 120_000);
  }

  it("same seeds, same game: a random game replays exactly", async () => {
    const play = () => selfPlay(sound(), randoms(sound(), 9), 12);
    const [first, second] = [await play(), await play()];
    expect(second.commands).toEqual(first.commands);
    expect(second.state).toEqual(first.state);
  });

  it("an AI bug is reported with its day and player, and the game goes on", async () => {
    const cheat: AiPlayer = { name: "Cheat", chooseCommand: () => ({ type: "build", unitType: "heavyTank", pos: P(0, 0) }) };
    const report = await selfPlay(sound(), [cheat, randomAi(1)], 2);
    expect(report.problems.map((p) => [p.kind, p.day, p.player])).toEqual([["aiBug", 1, 0], ["aiBug", 2, 0]]);
    expect(report.state.day).toBe(3);
  });

  it("an impossible state stops the game at once and is reported with the command it followed", async () => {
    const broken = withUnit(sound(), 1, { pos: P(0, 0) });
    const report = await selfPlay(broken, [randomAi(1), randomAi(2)], 5);
    expect(report.problems).toEqual([{ kind: "invariant", commandIndex: 0, day: 1, player: 0, text: "two units on tile 0,0" }]);
    expect(report.commands).toEqual([]);
  });
});
