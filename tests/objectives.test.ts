import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import type { GameState } from "../src/engine/state";
import { objectiveLines, objectiveTiles } from "../src/game/objectives";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const run = (state: GameState, ...commands: Command[]) =>
  commands.reduce((s, c) => {
    const result = apply(s, c);
    if (!result.ok) throw new Error(result.message);
    return result.state;
  }, state);

describe("objectives shown to the players (04-economy §8)", () => {
  const game = () =>
    makeGame(["CCf."], [{ type: "infantry", owner: 0, pos: P(3, 0) }, { type: "infantry", owner: 1, pos: P(2, 0) }], {
      propertyOwners: [{ pos: P(0, 0), owner: 1 }, { pos: P(1, 0), owner: 0 }, { pos: P(2, 0), owner: 1 }],
      victory: [
        { type: "hqCapture" },
        { type: "captureProperties", side: "allies", properties: [P(0, 0), P(1, 0)] },
        { type: "holdProperties", side: "axis", properties: [P(0, 0)], days: 3 },
        { type: "surviveDays", side: "axis", days: 10 },
      ],
    });

  it("lists each scenario objective with its progress, colored by side", () => {
    expect(objectiveLines(game())).toEqual([
      { player: 0, text: "Allies: capture both marked objectives (1/2)" },
      { player: 1, text: "Axis: hold the marked objective for 3 days (0/3)" },
      { player: 1, text: "Axis: hold out until day 10" },
    ]);
  });

  it("the hold count goes up at the start of each day the objectives are held", () => {
    expect(objectiveLines(run(game(), endTurn, endTurn))[1]?.text).toBe("Axis: hold the marked objective for 3 days (1/3)");
  });

  it("a plain game with HQ capture and rout lists nothing", () => {
    expect(objectiveLines(makeGame(["Q.Q"]))).toEqual([]);
  });

  it("marks every objective property once on the map", () => {
    expect(objectiveTiles(game())).toEqual([P(0, 0), P(1, 0)]);
  });
});
