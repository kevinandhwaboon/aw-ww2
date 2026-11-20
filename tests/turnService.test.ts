import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import { turnServiceSteps } from "../src/game/turnService";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };

/** Player 1's units on a row of player 1's cities; the turn then passes to player 1. */
function startOfTurn(row: string, units: readonly (Partial<UnitSetup> & { type: UnitSetup["type"]; pos: Point })[], funds = 20000) {
  const before = makeGame([row], units.map((u) => ({ owner: 1, ...u })), {
    players: [{ name: "A", nation: "us" }, { name: "B", nation: "germany", funds }],
    propertyOwners: Array.from(row).flatMap((c, x) => (c === "C" ? [{ pos: P(x, 0), owner: 1 }] : [])),
    settings: { incomePerProperty: 0 },
  });
  const result = apply(before, endTurn);
  if (!result.ok) throw new Error(result.message);
  return { before, after: result.state, service: turnServiceSteps(before, result.state, result.events) };
}

const hpOf = (state: GameState, id: number) => state.units.find((u) => u.id === id)?.hp;
const fundsOf = (state: GameState) => state.players[state.currentPlayer]?.funds;

describe("turn-start repair and resupply play one unit at a time (04-economy §2, 00-master-design §12)", () => {
  it("each serviced unit is its own step, in the order the engine serviced them", () => {
    const { service } = startOfTurn("C.C", [
      { type: "mediumTank", pos: P(2, 0), hp: 50 },
      { type: "infantry", pos: P(0, 0), hp: 50 },
    ]);
    expect(service.steps.map((s) => s.pos)).toEqual([P(0, 0), P(2, 0)]);
  });

  it("before the first step, nobody is repaired and the funds aren't spent yet", () => {
    const { service } = startOfTurn("C", [{ type: "mediumTank", pos: P(0, 0), hp: 50 }], 5000);
    expect(hpOf(service.start, 0)).toBe(50);
    expect(fundsOf(service.start)).toBe(5000);
  });

  it("a repair raises the HP one point at a time while the funds go down, ending where the engine did", () => {
    const { after, service } = startOfTurn("C", [{ type: "mediumTank", pos: P(0, 0), hp: 50 }], 5000);
    const [step] = service.steps;
    expect(step).toMatchObject({ repairedHp: 2, cost: 1600, resupplied: false });
    expect(step?.frames.map((f) => [hpOf(f, 0), fundsOf(f)])).toEqual([
      [60, 4200],
      [70, 3400],
    ]);
    expect(step?.frames.at(-1)).toEqual(after);
  });

  it("a unit only resupplied is one step with its fuel and ammo refilled", () => {
    const { before, after, service } = startOfTurn("C", [{ type: "mediumTank", pos: P(0, 0), fuel: 3, ammo: 1 }]);
    expect(service.start.units[0]).toMatchObject({ fuel: 3, ammo: 1 });
    expect(service.steps).toHaveLength(1);
    expect(service.steps[0]).toMatchObject({ repairedHp: 0, resupplied: true });
    expect(service.steps[0]?.frames).toEqual([after]);
    expect(before.units[0]?.fuel).toBe(3);
  });

  it("a unit both repaired and resupplied is a single step", () => {
    const { service } = startOfTurn("C", [{ type: "mediumTank", pos: P(0, 0), hp: 50, fuel: 3 }]);
    expect(service.steps).toHaveLength(1);
    expect(service.steps[0]).toMatchObject({ repairedHp: 2, resupplied: true });
  });

  it("units next to a Halftrack are resupplied after the property repairs (05-supply-transport §3)", () => {
    const { service } = startOfTurn("C..", [
      { type: "halftrack", pos: P(1, 0) },
      { type: "lightTank", pos: P(2, 0), fuel: 3 },
      { type: "mediumTank", pos: P(0, 0), hp: 50 },
    ]);
    expect(service.steps.map((s) => [s.pos, s.repairedHp, s.resupplied])).toEqual([
      [P(0, 0), 2, false],
      [P(2, 0), 0, true],
    ]);
  });

  it("nothing to show when no unit needed anything", () => {
    const { after, service } = startOfTurn("C", [{ type: "mediumTank", pos: P(0, 0) }]);
    expect(service.steps).toEqual([]);
    expect(service.start).toEqual(after);
  });
});
