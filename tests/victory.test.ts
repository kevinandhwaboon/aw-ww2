import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import { parseAsciiMap } from "../src/engine/map";
import { createGame, type GameSetup, type UnitSetup } from "../src/engine/setup";
import { propertyAt, type GameState } from "../src/engine/state";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const resign: Command = { type: "resign" };
const capture = (unitId: number): Command => ({ type: "move", unitId, path: [], action: { type: "capture" } });
const attack = (unitId: number, target: number): Command => ({ type: "move", unitId, path: [], action: { type: "attack", target } });

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}
const run = (state: GameState, ...commands: Command[]) => commands.reduce((s, c) => must(s, c).state, state);

const u = (type: UnitSetup["type"], owner: number, x: number, extra: Partial<UnitSetup> = {}): UnitSetup =>
  ({ type, owner, pos: P(x, 0), ...extra });

/** Infantry standing on the enemy HQ, with the enemy keeping a unit elsewhere. */
const onHq = (overrides: Partial<Omit<GameSetup, "map" | "units">> = {}) =>
  makeGame(["Q=C"], [u("infantry", 0, 0), u("infantry", 1, 2)], {
    propertyOwners: [{ pos: P(0, 0), owner: 1 }, { pos: P(2, 0), owner: 1 }],
    ...overrides,
  });

describe("HQ capture (04-economy §3, §8)", () => {
  it("capturing the enemy HQ ends the game at once", () => {
    const { state, events } = must(run(onHq(), capture(0), endTurn, endTurn), capture(0));
    expect(state.result).toEqual({ winningSide: "allies", winners: [0], reason: "hqCapture" });
    expect(events).toEqual([
      { type: "propertyCaptured", pos: P(0, 0), unitId: 0, player: 0, previousOwner: 1 },
      { type: "playerDefeated", player: 1, reason: "hqCapture" },
      { type: "gameOver", result: state.result },
    ]);
  });

  it("a half-finished capture doesn't end anything", () => {
    expect(run(onHq(), capture(0)).result).toBeNull();
  });

  it("capturing a neutral HQ just takes the property", () => {
    const state = makeGame(["Q="], [u("infantry", 0, 0), u("infantry", 1, 1)]);
    const after = run(state, capture(0), endTurn, endTurn, capture(0));
    expect(after.result).toBeNull();
    expect(propertyAt(after, P(0, 0))?.owner).toBe(0);
  });

  it("capturing an ordinary city doesn't end the game", () => {
    const state = makeGame(["C=Q"], [u("infantry", 0, 0), u("infantry", 1, 2)], {
      propertyOwners: [{ pos: P(0, 0), owner: 1 }, { pos: P(2, 0), owner: 1 }],
    });
    expect(run(state, capture(0), endTurn, endTurn, capture(0)).result).toBeNull();
  });

  it("a scenario without the HQ condition keeps playing after an HQ falls (00-master-design §8)", () => {
    const state = onHq({ victory: [{ type: "rout" }] });
    expect(run(state, capture(0), endTurn, endTurn, capture(0)).result).toBeNull();
  });
});

describe("rout (04-economy §8)", () => {
  const duel = (overrides: Partial<Omit<GameSetup, "map" | "units">> = {}) =>
    makeGame(["==="], [u("heavyTank", 0, 0), u("infantry", 1, 1, { hp: 10 })], { settings: { luck: false }, ...overrides });

  it("a player with no units left loses at the end of the turn, not during it", () => {
    const afterKill = must(duel(), attack(0, 1));
    expect(afterKill.state.result).toBeNull();
    const { state, events } = must(afterKill.state, endTurn);
    expect(state.result).toEqual({ winningSide: "allies", winners: [0], reason: "rout" });
    expect(events.map((e) => e.type)).toEqual(["turnEnded", "playerDefeated", "gameOver"]);
  });

  it("the game doesn't go on to another turn after a rout", () => {
    const state = run(duel(), attack(0, 1), endTurn);
    expect(state.currentPlayer).toBe(0);
    expect(state.day).toBe(1);
  });

  it("losing your last unit to a counterattack counts too", () => {
    const state = makeGame(["=="], [u("infantry", 0, 0, { hp: 10 }), u("heavyTank", 1, 1)], { settings: { luck: false } });
    const after = run(state, attack(0, 1), endTurn);
    expect(after.result).toMatchObject({ winningSide: "axis", reason: "rout" });
  });

  it("a player who has never had a unit isn't routed, so empty-start maps work", () => {
    const state = makeGame(["f="], [], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    expect(run(state, endTurn, endTurn).result).toBeNull();
  });

  it("a player who starts with nothing but builds a unit can be routed after losing it", () => {
    const state = makeGame(["f=="], [u("heavyTank", 1, 1)], {
      players: [{ name: "A", nation: "us", funds: 1000 }, { name: "B", nation: "germany" }],
      propertyOwners: [{ pos: P(0, 0), owner: 0 }],
      settings: { luck: false, incomePerProperty: 0 },
    });
    const built = run(state, { type: "build", unitType: "infantry", pos: P(0, 0) }, endTurn);
    const hit = run(built, attack(0, 1), endTurn, endTurn, attack(0, 1), endTurn);
    expect(hit.result).toMatchObject({ winningSide: "axis", reason: "rout" });
  });

  it("losing your last transport with your last unit aboard is a rout", () => {
    const state = makeGame(["==="], [u("infantry", 0, 0), u("halftrack", 0, 1, { hp: 10 }), u("heavyTank", 1, 2)], {
      settings: { luck: false },
    });
    const loaded: Command = { type: "move", unitId: 0, path: [P(1, 0)], action: { type: "load" } };
    expect(run(state, loaded, endTurn, attack(2, 1), endTurn).result).toMatchObject({ winningSide: "axis", reason: "rout" });
  });

  it("a player with a passenger aboard a surviving transport is still in the game", () => {
    const state = makeGame(["==="], [u("infantry", 0, 0), u("halftrack", 0, 1), u("heavyTank", 1, 2)]);
    const loaded: Command = { type: "move", unitId: 0, path: [P(1, 0)], action: { type: "load" } };
    expect(run(state, loaded, endTurn).result).toBeNull();
  });

  it("a scenario without the rout condition keeps playing", () => {
    expect(run(duel({ victory: [{ type: "hqCapture" }] }), attack(0, 1), endTurn).result).toBeNull();
  });
});

describe("resign (04-economy §8)", () => {
  it("the current player can resign at any time, and the other side wins", () => {
    const { state, events } = must(onHq(), resign);
    expect(state.result).toEqual({ winningSide: "axis", winners: [1], reason: "resign" });
    expect(events.map((e) => e.type)).toEqual(["playerDefeated", "gameOver"]);
  });

  it("works in any scenario, even with no victory conditions", () => {
    expect(run(onHq({ victory: [] }), resign).result).toMatchObject({ reason: "resign" });
  });
});

describe("defeated players (00-master-design §8, as in the original)", () => {
  const threePlayers = () => createGame({
    map: parseAsciiMap(["C=C=Q"]),
    players: [{ name: "US", nation: "us" }, { name: "UK", nation: "uk" }, { name: "Axis", nation: "germany" }],
    propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(2, 0), owner: 1 }, { pos: P(4, 0), owner: 2 }],
    units: [u("infantry", 0, 1), u("infantry", 1, 3), u("infantry", 2, 4)],
    seed: 1,
  });

  it("their units are removed and their properties go neutral", () => {
    const state = run(threePlayers(), resign);
    expect(state.units.map((x) => x.owner)).toEqual([1, 2]);
    expect(propertyAt(state, P(0, 0))?.owner).toBeNull();
  });

  it("the game goes on while their ally is still in it, and the turn passes", () => {
    const state = run(threePlayers(), resign);
    expect(state.result).toBeNull();
    expect(state.currentPlayer).toBe(1);
  });

  it("the game ends when the last player on a side is out, and all survivors on the other side win", () => {
    const state = run(threePlayers(), endTurn, endTurn, resign);
    expect(state.result).toEqual({ winningSide: "allies", winners: [0, 1], reason: "resign" });
  });

  it("defeated players are skipped in the turn order", () => {
    const state = run(threePlayers(), resign, endTurn);
    expect(state.currentPlayer).toBe(2);
  });
});

describe("after the game ends", () => {
  it("no more commands are accepted", () => {
    const over = run(onHq(), resign);
    for (const command of [endTurn, resign, capture(0), { type: "build", unitType: "infantry", pos: P(1, 0) } as Command]) {
      expect(apply(over, command)).toMatchObject({ ok: false, code: "gameOver" });
    }
  });

  it("the result survives saving as JSON", () => {
    const over = run(onHq(), resign);
    expect(JSON.parse(JSON.stringify(over))).toEqual(over);
  });
});
