import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, GameEvent } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import { moveDestinations } from "../src/engine/movement";
import { loadGame, saveGame } from "../src/engine/save";
import { parseScenario } from "../src/engine/scenario";
import type { UnitSetup } from "../src/engine/setup";
import { DEFAULT_WEATHER, type GameState, type WeatherPlan } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { weatherOn } from "../src/engine/weather";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const SNOW: WeatherPlan = { season: "winter", forecast: [{ fromDay: 1, weather: "snow" }] };
const endTurn: Command = { type: "endTurn" };

function solo(rows: string[], type: UnitSetup["type"], weather: WeatherPlan = SNOW): GameState {
  return makeGame(rows, [{ type, owner: 0, pos: P(0, 0) }], { weather });
}

/** How far right along row 0 the unit at (0, 0) can go. */
function reach(state: GameState): number {
  const unit = state.units[0];
  if (!unit) throw new Error("no unit");
  return Math.max(...moveDestinations(state, unit).filter((p) => p.y === 0).map((p) => p.x));
}

function endTurns(state: GameState, count: number): { state: GameState; events: GameEvent[] } {
  let current = state;
  const events: GameEvent[] = [];
  for (let i = 0; i < count; i++) {
    const result = apply(current, endTurn);
    if (!result.ok) throw new Error(result.message);
    current = result.state;
    events.push(...result.events);
  }
  return { state: current, events };
}

describe("snow slows movement (12-weather §3)", () => {
  it("infantry pays 2 per plains tile in snow instead of 1", () => {
    expect(reach(solo([".......", "......."], "infantry", DEFAULT_WEATHER))).toBe(3);
    expect(reach(solo([".......", "......."], "infantry"))).toBe(1); // 3 move: one plains tile costs 2
  });

  it("tanks pay 2 per plains tile and 3 per forest tile in snow", () => {
    const tank = (rows: string[]) => {
      const state = solo(rows, "mediumTank");
      const unit = state.units[0];
      if (!unit) throw new Error("no unit");
      return [stats.moveCost(state, unit, "plains"), stats.moveCost(state, unit, "forest")];
    };
    expect(tank(["...."])).toEqual([2, 3]);
  });

  it("wheels pay 3 per plains tile and 4 per forest tile in snow", () => {
    const state = solo(["...."], "recon");
    const unit = state.units[0];
    if (!unit) throw new Error("no unit");
    expect([stats.moveCost(state, unit, "plains"), stats.moveCost(state, unit, "forest")]).toEqual([3, 4]);
  });

  it("roads, bridges and towns cost the same in snow, so armor keeps to the roads", () => {
    expect(reach(solo(["=======", "......."], "mediumTank"))).toBe(6);
    const state = solo(["=#C"], "mediumTank");
    const unit = state.units[0];
    if (!unit) throw new Error("no unit");
    expect(["road", "bridge", "city"].map((t) => stats.moveCost(state, unit, t as "road"))).toEqual([1, 1, 1]);
  });

  it("heavy foot is only slowed in the hills, where it pays 2", () => {
    const state = solo(["..H"], "assaultInfantry");
    const unit = state.units[0];
    if (!unit) throw new Error("no unit");
    expect([stats.moveCost(state, unit, "plains"), stats.moveCost(state, unit, "forest"), stats.moveCost(state, unit, "hills")]).toEqual([1, 1, 2]);
  });

  it("infantry pays 4 to climb hills in snow", () => {
    const state = solo(["H"], "infantry");
    const unit = state.units[0];
    if (!unit) throw new Error("no unit");
    expect(stats.moveCost(state, unit, "hills")).toBe(4);
  });

  it("aircraft pay 2 for every tile in snow, which halves how far they fly", () => {
    expect(reach(solo(["A..........", "..........."], "fighter", DEFAULT_WEATHER))).toBe(9);
    expect(reach(solo(["A..........", "..........."], "fighter"))).toBe(4); // 9 move, 2 per tile
  });

  it("ships pay 2 per sea tile in snow", () => {
    const state = solo(["P SSSS"], "destroyer");
    const unit = state.units[0];
    if (!unit) throw new Error("no unit");
    expect(stats.moveCost(state, unit, "sea")).toBe(2);
  });

  it("snow never makes impassable terrain passable: tanks still can't enter hills", () => {
    const state = solo([".H"], "mediumTank");
    const unit = state.units[0];
    if (!unit) throw new Error("no unit");
    expect(stats.moveCost(state, unit, "hills")).toBeNull();
  });

  it("snow doesn't change combat, vision or fuel", () => {
    const clear = solo(["..."], "mediumTank", DEFAULT_WEATHER);
    const snow = solo(["..."], "mediumTank");
    const [c, s] = [clear.units[0], snow.units[0]];
    if (!c || !s) throw new Error("no unit");
    for (const look of [stats.attackMod, stats.defenseMod, stats.vision, stats.movePoints, stats.maxFuel, stats.terrainStars]) {
      expect(look(snow, s)).toBe(look(clear, c));
    }
  });

  it("a scenario modifier still stacks on top of snow", () => {
    const state = makeGame(["..."], [{ type: "infantry", owner: 0, pos: P(0, 0) }], {
      weather: SNOW,
      modifiers: [{ source: "mud", stat: "moveCost", op: "add", value: 1, scope: { terrain: ["plains"] } }],
    });
    const unit = state.units[0];
    if (!unit) throw new Error("no unit");
    expect(stats.moveCost(state, unit, "plains")).toBe(3);
  });

  it("modifiers can be limited to movement types", () => {
    const state = makeGame(["..."], [{ type: "infantry", owner: 0, pos: P(0, 0) }, { type: "mediumTank", owner: 0, pos: P(1, 0) }], {
      modifiers: [{ source: "test", stat: "moveCost", op: "add", value: 5, scope: { movementTypes: ["tracks"] } }],
    });
    const [infantry, tank] = state.units;
    if (!infantry || !tank) throw new Error("no unit");
    expect([stats.moveCost(state, infantry, "plains"), stats.moveCost(state, tank, "plains")]).toEqual([1, 6]);
  });
});

describe("the forecast (12-weather §1, §4)", () => {
  const BULGE: WeatherPlan = { season: "winter", forecast: [{ fromDay: 1, weather: "snow" }, { fromDay: 3, weather: "clear" }] };

  it("a scenario without a forecast is clear all game", () => {
    const state = makeGame(["Q.Q"]);
    expect(state.weather).toEqual(DEFAULT_WEATHER);
    expect(weatherOn(state)).toBe("clear");
  });

  it("the weather follows the forecast day by day", () => {
    const state = makeGame(["Q.Q"], [], { weather: BULGE });
    expect([1, 2, 3, 4, 10].map((day) => weatherOn(state, day))).toEqual(["snow", "snow", "clear", "clear", "clear"]);
  });

  it("when the weather changes at the start of a day, a weatherChanged event follows dayStarted", () => {
    const start = makeGame(["Q.Q"], [], { weather: BULGE });
    const toDay2 = endTurns(start, 2);
    expect(toDay2.state.day).toBe(2);
    expect(toDay2.events.some((e) => e.type === "weatherChanged")).toBe(false);
    const toDay3 = endTurns(toDay2.state, 2);
    const types = toDay3.events.map((e) => e.type);
    expect(types.indexOf("weatherChanged")).toBe(types.indexOf("dayStarted") + 1);
    expect(toDay3.events).toContainEqual({ type: "weatherChanged", day: 3, weather: "clear" });
  });

  it("units move at normal speed once the skies clear", () => {
    const start = makeGame([".......", "......."], [{ type: "infantry", owner: 0, pos: P(0, 0) }], { weather: BULGE });
    expect(reach(start)).toBe(1);
    expect(reach(endTurns(start, 4).state)).toBe(3);
  });

  it("the season is only art: summer and winter play the same", () => {
    const winter = solo(["......."], "infantry", { season: "winter", forecast: [{ fromDay: 1, weather: "clear" }] });
    expect(reach(winter)).toBe(3);
  });

  it("rejects a forecast that doesn't start on day 1 or whose days don't rise", () => {
    expect(() => makeGame(["Q.Q"], [], { weather: { season: "summer", forecast: [{ fromDay: 2, weather: "snow" }] } })).toThrow(/day 1/);
    expect(() =>
      makeGame(["Q.Q"], [], { weather: { season: "summer", forecast: [{ fromDay: 1, weather: "snow" }, { fromDay: 1, weather: "clear" }] } }),
    ).toThrow(/rise/);
  });
});

describe("weather in scenario files and saves (12-weather §6)", () => {
  const valid = {
    id: "test",
    name: "Test",
    description: "A test scenario",
    map: ["Qf.", "...", ".fQ"],
    players: [{ name: "A", nation: "us" }, { name: "B", nation: "germany" }],
    propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(2, 2), owner: 1 }],
    units: [],
  };

  it("reads the season and forecast", () => {
    const { setup } = parseScenario({ ...valid, weather: { season: "winter", forecast: [{ fromDay: 1, weather: "snow" }, { fromDay: 4, weather: "clear" }] } });
    expect(setup.weather).toEqual({ season: "winter", forecast: [{ fromDay: 1, weather: "snow" }, { fromDay: 4, weather: "clear" }] });
  });

  it("a winter map with no forecast is clear", () => {
    expect(parseScenario({ ...valid, weather: { season: "winter" } }).setup.weather).toEqual({ season: "winter", forecast: [{ fromDay: 1, weather: "clear" }] });
  });

  it("rejects unknown weather and seasons", () => {
    expect(() => parseScenario({ ...valid, weather: { forecast: [{ fromDay: 1, weather: "hail" }] } })).toThrow(/unknown weather/);
    expect(() => parseScenario({ ...valid, weather: { season: "spring" } })).toThrow(/season/);
  });

  it("a save from before weather existed loads as clear all game", () => {
    const state = makeGame(["Q.Q"]);
    const old = Object.fromEntries(Object.entries(state).filter(([key]) => key !== "weather"));
    expect(loadGame(JSON.stringify({ version: 1, state: old })).weather).toEqual(DEFAULT_WEATHER);
    expect(loadGame(saveGame(state))).toEqual(state);
  });
});
