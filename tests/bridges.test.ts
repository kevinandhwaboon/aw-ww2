import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, GameEvent } from "../src/engine/commands";
import { legalCommands } from "../src/engine/legal";
import { terrainAt, type Point } from "../src/engine/map";
import { loadGame, saveGame } from "../src/engine/save";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { makeGame } from "./helpers";

// Major Bridges: blowing and rebuilding them (02-terrain §4a). "%" is a Major Bridge, "!" a Blown Bridge.

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const act = (unitId: number, type: "blowBridge" | "rebuildBridge", path: Point[] = []): Command => ({ type: "move", unitId, path, action: { type } });

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

/** A river running down the middle, crossed by one bridge; an enemy infantry far off keeps the game going. */
const river = (bridge: "%" | "!" | "#", units: UnitSetup[]) =>
  makeGame([".~.....", `.${bridge}.....`, ".~....."], [...units, { type: "infantry", owner: 1, pos: P(6, 0) }]);

describe("blowing a Major Bridge (02-terrain §4a)", () => {
  it("Assault Infantry on a Major Bridge can blow it, and it becomes a Blown Bridge", () => {
    const state = river("%", [{ type: "assaultInfantry", owner: 0, pos: P(0, 1) }]);
    const { state: after, events } = run(state, act(0, "blowBridge", [P(1, 1)]));
    expect(terrainAt(after.map, P(1, 1))).toBe("blownBridge");
    expect(events).toContainEqual({ type: "bridgeBlown", unitId: 0, pos: P(1, 1) });
    expect(after.units[0]?.pos).toEqual(P(1, 1));
  });

  it("Infantry can't blow a bridge: only Assault Infantry carries charges", () => {
    const state = river("%", [{ type: "infantry", owner: 0, pos: P(1, 1) }]);
    const result = apply(state, act(0, "blowBridge"));
    expect(result.ok || result.code).toBe("cannotBlowBridge");
  });

  it("an ordinary Bridge can never be blown", () => {
    const state = river("#", [{ type: "assaultInfantry", owner: 0, pos: P(1, 1) }]);
    const result = apply(state, act(0, "blowBridge"));
    expect(result.ok || result.code).toBe("cannotBlowBridge");
  });

  it("blowing a bridge needs the Assault Infantry standing on it, not next to it", () => {
    const state = river("%", [{ type: "assaultInfantry", owner: 0, pos: P(2, 1) }]);
    expect(apply(state, act(0, "blowBridge")).ok).toBe(false);
  });

  it("either side can blow a bridge", () => {
    const state = makeGame([".%."], [{ type: "infantry", owner: 0, pos: P(0, 0) }, { type: "assaultInfantry", owner: 1, pos: P(1, 0) }]);
    const { state: after } = run(state, endTurn, act(1, "blowBridge"));
    expect(terrainAt(after.map, P(1, 0))).toBe("blownBridge");
  });

  it("a Major Bridge can't be damaged by fire, so no unit can attack it", () => {
    const state = river("%", [{ type: "artillery", owner: 0, pos: P(3, 1) }]);
    expect(legalCommands(state).some((c) => c.type === "move" && c.action.type === "attackFort")).toBe(false);
  });

  it("a Major Bridge moves like a Bridge", () => {
    const state = river("%", [{ type: "mediumTank", owner: 0, pos: P(0, 1) }]);
    const tank = state.units[0];
    expect(tank && stats.moveCost(state, tank, "majorBridge")).toBe(tank && stats.moveCost(state, tank, "bridge"));
  });

  it("vehicles can't enter a Blown Bridge, but soldiers can wade it as a River", () => {
    const state = river("!", [{ type: "mediumTank", owner: 0, pos: P(0, 1) }, { type: "infantry", owner: 0, pos: P(0, 0) }]);
    const [tank, soldier] = state.units;
    expect(tank && stats.moveCost(state, tank, "blownBridge")).toBeNull();
    expect(soldier && stats.moveCost(state, soldier, "blownBridge")).toBe(soldier && stats.moveCost(state, soldier, "river"));
    expect(apply(state, { type: "move", unitId: 0, path: [P(1, 1)], action: { type: "wait" } }).ok).toBe(false);
  });

  it("blowing a bridge isn't a kill", () => {
    const state = river("%", [{ type: "assaultInfantry", owner: 0, pos: P(1, 1) }]);
    expect(run(state, act(0, "blowBridge")).state.units[0]?.kills).toBe(0);
  });

  it("the legal command list offers Blow Bridge on a Major Bridge, and only to Assault Infantry", () => {
    const state = river("%", [{ type: "assaultInfantry", owner: 0, pos: P(0, 1) }, { type: "infantry", owner: 0, pos: P(2, 1) }]);
    const blows = legalCommands(state).filter((c) => c.type === "move" && c.action.type === "blowBridge");
    expect(blows).toEqual([act(0, "blowBridge", [P(1, 1)])]);
  });
});

describe("rebuilding a Blown Bridge (02-terrain §4a)", () => {
  it("Assault Infantry rebuilds a Blown Bridge like a capture: 20 points, less its HP each turn", () => {
    const state = river("!", [{ type: "assaultInfantry", owner: 0, pos: P(1, 1), hp: 70 }]);
    const { state: after, events } = run(state, act(0, "rebuildBridge"));
    expect(events).toContainEqual({ type: "bridgeRebuildProgress", unitId: 0, pos: P(1, 1), points: 13 });
    expect(after.bridgeWorks).toEqual([{ pos: P(1, 1), points: 13, unit: 0 }]);
    expect(terrainAt(after.map, P(1, 1))).toBe("blownBridge");
  });

  it("a full-strength Assault Infantry rebuilds a bridge in two turns", () => {
    const state = river("!", [{ type: "assaultInfantry", owner: 0, pos: P(1, 1) }]);
    const first = run(state, act(0, "rebuildBridge"));
    expect(terrainAt(first.state.map, P(1, 1))).toBe("blownBridge");
    const { state: after, events } = run(first.state, endTurn, endTurn, act(0, "rebuildBridge"));
    expect(terrainAt(after.map, P(1, 1))).toBe("majorBridge");
    expect(events).toContainEqual({ type: "bridgeRebuilt", unitId: 0, pos: P(1, 1) });
    expect(after.bridgeWorks).toEqual([]);
  });

  it("rebuild progress is lost when the Assault Infantry leaves", () => {
    const state = river("!", [{ type: "assaultInfantry", owner: 0, pos: P(1, 1) }]);
    const { state: after } = run(state, act(0, "rebuildBridge"), endTurn, endTurn, {
      type: "move",
      unitId: 0,
      path: [P(1, 0)],
      action: { type: "wait" },
    });
    expect(after.bridgeWorks).toEqual([]);
  });

  it("only Assault Infantry can rebuild a bridge", () => {
    const state = river("!", [{ type: "infantry", owner: 0, pos: P(1, 1) }]);
    const result = apply(state, act(0, "rebuildBridge"));
    expect(result.ok || result.code).toBe("cannotRebuildBridge");
  });

  it("a rebuilt bridge is a Major Bridge again and can be blown again", () => {
    const state = river("!", [{ type: "assaultInfantry", owner: 0, pos: P(1, 1) }]);
    const rebuilt = run(state, act(0, "rebuildBridge"), endTurn, endTurn, act(0, "rebuildBridge"), endTurn, endTurn).state;
    const { state: after } = run(rebuilt, act(0, "blowBridge"));
    expect(terrainAt(after.map, P(1, 1))).toBe("blownBridge");
  });

  it("a game with a bridge being rebuilt survives saving and loading", () => {
    const state = run(river("!", [{ type: "assaultInfantry", owner: 0, pos: P(1, 1) }]), act(0, "rebuildBridge")).state;
    expect(loadGame(saveGame(state))).toEqual(state);
  });

  it("a save from before Major Bridges loads with no bridge being rebuilt", () => {
    const state = river("%", []);
    const old = JSON.stringify({ version: 1, state }).replace(',"bridgeWorks":[]', "");
    expect(old).not.toContain("bridgeWorks");
    expect(loadGame(old).bridgeWorks).toEqual([]);
  });
});

describe("Major Bridges in snow (12-weather §3)", () => {
  it("snow costs on a Blown Bridge are the River's, and on a Major Bridge the Bridge's", () => {
    const state = makeGame([".!%#~"], [{ type: "infantry", owner: 0, pos: P(0, 0) }, { type: "infantry", owner: 1, pos: P(4, 0) }], {
      weather: { season: "winter", forecast: [{ fromDay: 1, weather: "snow" }] },
    });
    const soldier = state.units[0];
    if (!soldier) throw new Error("no soldier");
    expect(stats.moveCost(state, soldier, "blownBridge")).toBe(stats.moveCost(state, soldier, "river"));
    expect(stats.moveCost(state, soldier, "majorBridge")).toBe(stats.moveCost(state, soldier, "bridge"));
  });
});
