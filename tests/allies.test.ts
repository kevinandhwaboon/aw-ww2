import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, GameEvent } from "../src/engine/commands";
import { buildProblem } from "../src/engine/economy";
import type { Point } from "../src/engine/map";
import type { PlayerSetup, UnitSetup } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { defaultComputerPlayers } from "../src/ui/computerPlayers";
import { makeGame } from "./helpers";

// Two players on one side, first needed on Market Garden (17-scenarios-market-garden §1 "Players").

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };

function run(state: GameState, ...commands: Command[]): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (const command of commands) {
    const result = apply(current, command);
    if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

/** US (0) and UK (1) are Allies, Germany (2) is Axis. Nobody earns income, so funds only move for repairs. */
const allied = (rows: string[], units: UnitSetup[], owners: { pos: Point; owner: number }[]) =>
  makeGame(rows, units, {
    players: [
      { name: "US", nation: "us", funds: 5000 },
      { name: "UK", nation: "uk", funds: 5000 },
      { name: "Germany", nation: "germany", funds: 5000 },
    ],
    propertyOwners: owners,
    settings: { incomePerProperty: 0 },
  });

const funds = (state: GameState, player: number) => state.players[player]?.funds;
const unit = (state: GameState, id: number) => state.units.find((u) => u.id === id);

describe("two players on one side: repair and resupply (04-economy §5)", () => {
  it("a British tank in a US-held town is repaired at the UK's cost", () => {
    const state = allied(["C..."], [{ type: "mediumTank", owner: 1, pos: P(0, 0), hp: 50, fuel: 5 }, { type: "infantry", owner: 2, pos: P(3, 0) }], [
      { pos: P(0, 0), owner: 0 },
    ]);
    const after = run(state, endTurn).state; // the UK's turn starts
    expect(unit(after, 0)?.hp).toBe(70);
    expect(unit(after, 0)?.fuel).toBe(30);
    expect(funds(after, 1)).toBe(5000 - 1600);
    expect(funds(after, 0)).toBe(5000);
  });

  it("an enemy's town doesn't repair or resupply", () => {
    const state = allied(["C..."], [{ type: "mediumTank", owner: 1, pos: P(0, 0), hp: 50, fuel: 5 }, { type: "infantry", owner: 2, pos: P(3, 0) }], [
      { pos: P(0, 0), owner: 2 },
    ]);
    const after = run(state, endTurn).state;
    expect(unit(after, 0)?.hp).toBe(50);
    expect(unit(after, 0)?.fuel).toBe(5);
  });

  it("an aircraft on an ally's airfield is refuelled there, so it can't run dry parked on it (05-supply-transport §5)", () => {
    const state = allied(["A..."], [{ type: "fighter", owner: 1, pos: P(0, 0), fuel: 20 }, { type: "infantry", owner: 2, pos: P(3, 0) }], [
      { pos: P(0, 0), owner: 0 },
    ]);
    const { state: after, events } = run(state, endTurn, endTurn, endTurn, endTurn); // to the UK's day-2 turn
    expect(after.day).toBe(2);
    expect(events.some((e) => e.type === "unitOutOfFuel")).toBe(false);
    const fighter = unit(after, 0);
    expect(fighter && fighter.fuel).toBe(fighter && stats.maxFuel(after, fighter));
  });

  it("you still can't build at an ally's factory", () => {
    const state = allied(["f..."], [{ type: "infantry", owner: 2, pos: P(3, 0) }], [{ pos: P(0, 0), owner: 0 }]);
    const ukTurn = run(state, endTurn).state;
    expect(buildProblem(ukTurn, "infantry", P(0, 0))).toBe("you don't own a property here");
  });

  it("you can't capture an ally's town (04-economy §3)", () => {
    const state = allied(["C..."], [{ type: "infantry", owner: 1, pos: P(0, 0) }, { type: "infantry", owner: 2, pos: P(3, 0) }], [{ pos: P(0, 0), owner: 0 }]);
    const ukTurn = run(state, endTurn).state;
    const result = apply(ukTurn, { type: "move", unitId: 0, path: [], action: { type: "capture" } });
    expect(result.ok).toBe(false);
  });
});

describe("two players on one side: who the computer plays (09-ai §5)", () => {
  const scenario = (nations: PlayerSetup["nation"][]) => ({ setup: { players: nations.map((nation) => ({ name: nation, nation })) } });

  it("the computer plays only Germany by default when the US and the UK are both Allies", () => {
    expect(defaultComputerPlayers(scenario(["us", "uk", "germany"]))).toEqual([2]);
  });

  it("with one player a side, the computer plays the second player, as before", () => {
    expect(defaultComputerPlayers(scenario(["us", "japan"]))).toEqual([1]);
    expect(defaultComputerPlayers(scenario(["ussr", "germany"]))).toEqual([1]);
  });
});
