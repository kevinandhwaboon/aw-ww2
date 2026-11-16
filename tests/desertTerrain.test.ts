import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import { terrainAt, type Point } from "../src/engine/map";
import { moveDestinations } from "../src/engine/movement";
import type { UnitSetup } from "../src/engine/setup";
import { fortAt, type GameState, type Unit, type WeatherPlan } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { makeGame } from "./helpers";

// Desert terrain for El Alamein (02-terrain §4b). "m" is a Minefield, "d" a Ridge, "z" Salt Marsh.

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const hit = (unitId: number, target: Point, path: Point[] = []): Command => ({ type: "move", unitId, path, action: { type: "attackFort", target } });
const run = (state: GameState, ...commands: Command[]) =>
  commands.reduce((s, c) => {
    const result = apply(s, c);
    if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
    return result.state;
  }, state);
/** One unit at (0, 0), luck off; an enemy far off keeps the game going. */
const solo = (rows: string[], type: UnitSetup["type"], extra: Partial<Parameters<typeof makeGame>[2]> = {}) =>
  makeGame(rows, [{ type, owner: 0, pos: P(0, 0) }, { type: "infantry", owner: 1, pos: P((rows[0] ?? "").length - 1, rows.length - 1) }], { settings: { luck: false }, ...extra });
const first = (state: GameState): Unit => {
  const unit = state.units[0];
  if (!unit) throw new Error("no unit");
  return unit;
};
const reaches = (state: GameState, p: Point) => moveDestinations(state, first(state)).some((q) => q.x === p.x && q.y === p.y);

describe("minefields (02-terrain §4b)", () => {
  it("a minefield blocks every land unit, but aircraft fly over it", () => {
    for (const type of ["infantry", "assaultInfantry", "recon", "mediumTank"] as const) {
      expect(reaches(solo([".m.", "..."], type), P(1, 0)), type).toBe(false);
    }
    expect(reaches(solo([".m.", "..."], "fighter"), P(1, 0))).toBe(true);
  });

  it("a belt of mines with no gap stops land units getting past it at all", () => {
    expect(reaches(solo([".m.", ".m.", ".m."], "mediumTank"), P(2, 0))).toBe(false);
    expect(reaches(solo([".m.", ".m.", ".m."], "infantry"), P(2, 1))).toBe(false);
  });

  it("every minefield square starts at 100 HP, like an obstacle", () => {
    expect(makeGame(["m.o"], []).fortifications).toEqual([{ pos: P(0, 0), hp: 100 }, { pos: P(2, 0), hp: 100 }]);
  });

  it("Assault Infantry clears a minefield square in two attacks, and it becomes Plains", () => {
    const state = solo([".m.", "..."], "assaultInfantry");
    const once = run(state, hit(0, P(1, 0)));
    expect(fortAt(once, P(1, 0))?.hp).toBe(35); // Assault Infantry vs Fort: 65
    const twice = run(once, endTurn, endTurn, hit(0, P(1, 0)));
    expect(fortAt(twice, P(1, 0))).toBeUndefined();
    expect(terrainAt(twice.map, P(1, 0))).toBe("plains");
  });

  it("once a square is cleared, tanks can drive through the lane", () => {
    const state = makeGame([".m.", "..."], [{ type: "assaultInfantry", owner: 0, pos: P(0, 0) }, { type: "mediumTank", owner: 0, pos: P(0, 1) }, { type: "infantry", owner: 1, pos: P(2, 1) }], { settings: { luck: false } });
    const cleared = run(state, hit(0, P(1, 0)), endTurn, endTurn, hit(0, P(1, 0)));
    const tank = cleared.units.find((u) => u.type === "mediumTank");
    if (!tank) throw new Error("no tank");
    expect(moveDestinations(cleared, tank)).toContainEqual(P(1, 0));
  });

  it("Artillery can shell a minefield clear from range", () => {
    const state = solo(["..m", "..."], "artillery");
    expect(fortAt(run(state, hit(0, P(2, 0))), P(2, 0))?.hp).toBe(50); // Artillery vs Fort: 50
  });

  it("clearing a minefield isn't a kill", () => {
    const state = solo([".m.", "..."], "assaultInfantry");
    const cleared = run(state, hit(0, P(1, 0)), endTurn, endTurn, hit(0, P(1, 0)));
    expect(first(cleared).kills).toBe(0);
  });
});

describe("ridges (02-terrain §4b)", () => {
  it("a ridge gives 2 defense stars, like a forest", () => {
    expect(stats.terrainStars(solo(["d."], "infantry"), first(solo(["d."], "infantry")))).toBe(2);
  });

  it("tanks can cross a ridge at 2 movement points, where Hills would stop them", () => {
    const state = solo(["d.", ".."], "mediumTank");
    expect(stats.moveCost(state, first(state), "ridge")).toBe(2);
    expect(stats.moveCost(state, first(state), "hills")).toBeNull();
    expect(reaches(solo([".d.", "..."], "mediumTank"), P(2, 0))).toBe(true);
  });

  it("wheels pay 3 to climb a ridge, foot soldiers 1", () => {
    const state = solo(["d.", ".."], "recon");
    expect(stats.moveCost(state, first(state), "ridge")).toBe(3);
    const foot = solo(["d.", ".."], "infantry");
    expect(stats.moveCost(foot, first(foot), "ridge")).toBe(1);
  });

  it("snow costs on a ridge are the forest's (12-weather §3)", () => {
    const snow: WeatherPlan = { season: "winter", forecast: [{ fromDay: 1, weather: "snow" }] };
    const state = solo(["d.", ".."], "mediumTank", { weather: snow });
    expect(stats.moveCost(state, first(state), "ridge")).toBe(stats.moveCost(state, first(state), "forest"));
  });
});

describe("the salt marsh (02-terrain §4b)", () => {
  it("the salt marsh blocks every land unit, but aircraft fly over it", () => {
    for (const type of ["infantry", "assaultInfantry", "recon", "mediumTank"] as const) {
      expect(reaches(solo([".z.", "..."], type), P(1, 0)), type).toBe(false);
    }
    expect(reaches(solo([".z.", "..."], "fighter"), P(1, 0))).toBe(true);
  });

  it("the salt marsh can't be attacked or cleared: it isn't a fortification", () => {
    expect(makeGame(["z.."], []).fortifications).toEqual([]);
  });
});

describe("the desert season (08-art-pipeline §21)", () => {
  it("a desert map plays exactly like a summer one: the season is art only", () => {
    const desert: WeatherPlan = { season: "desert", forecast: [{ fromDay: 1, weather: "clear" }] };
    const summer = solo(["....", "...."], "mediumTank");
    const sandy = solo(["....", "...."], "mediumTank", { weather: desert });
    expect(moveDestinations(sandy, first(sandy))).toEqual(moveDestinations(summer, first(summer)));
  });
});
