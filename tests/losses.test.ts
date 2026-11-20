import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, UnitAction } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import { loadGame, saveGame } from "../src/engine/save";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import { lossLines } from "../src/game/losses";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const order = (unitId: number, path: Point[], action: UnitAction): Command => ({ type: "move", unitId, path, action });
const attack = (unitId: number, target: number, path: Point[] = []) => order(unitId, path, { type: "attack", target });

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result.state;
}
const run = (state: GameState, ...commands: Command[]) => commands.reduce(must, state);
const u = (type: UnitSetup["type"], owner: number, x: number, extra: Partial<UnitSetup> = {}): UnitSetup =>
  ({ type, owner, pos: P(x, 0), ...extra });
const lost = (state: GameState, player: number) => state.players[player]?.unitsLost;

describe("the tally of units lost (04-economy §8a)", () => {
  it("a new game starts with nothing lost", () => {
    const state = makeGame(["=="], [u("infantry", 0, 0), u("infantry", 1, 1)]);
    expect(lost(state, 0)).toEqual({});
    expect(lost(state, 1)).toEqual({});
  });

  it("a unit destroyed in combat is added to its owner's losses", () => {
    const state = makeGame(["==="], [u("mediumTank", 0, 0), u("infantry", 1, 1, { hp: 10 }), u("infantry", 1, 2)], { settings: { luck: false } });
    const after = run(state, attack(0, 1));
    expect(lost(after, 1)).toEqual({ infantry: 1 });
    expect(lost(after, 0)).toEqual({});
  });

  it("an attacker destroyed by the counterattack counts too", () => {
    const state = makeGame(["==="], [u("infantry", 0, 0, { hp: 10 }), u("mediumTank", 1, 1), u("infantry", 0, 2)], { settings: { luck: false } });
    const after = run(state, attack(0, 1));
    expect(lost(after, 0)).toEqual({ infantry: 1 });
  });

  it("passengers are lost along with their transport (05-supply-transport §4)", () => {
    const state = makeGame(["===="], [u("infantry", 0, 0), u("halftrack", 0, 1, { hp: 10 }), u("mediumTank", 1, 2), u("infantry", 0, 3)], { settings: { luck: false } });
    const after = run(state, order(0, [P(1, 0)], { type: "load" }), endTurn, attack(2, 1));
    expect(lost(after, 0)).toEqual({ halftrack: 1, infantry: 1 });
  });

  it("an aircraft that crashes for lack of fuel counts as lost (05-supply-transport §5)", () => {
    const state = makeGame(["==="], [u("fighter", 0, 0, { fuel: 5 }), u("infantry", 0, 1), u("infantry", 1, 2)]);
    const after = run(state, endTurn, endTurn);
    expect(after.units.some((x) => x.type === "fighter")).toBe(false);
    expect(lost(after, 0)).toEqual({ fighter: 1 });
  });

  it("units removed when their player resigns weren't destroyed, so they aren't counted (04-economy §8)", () => {
    const state = makeGame(["=="], [u("infantry", 0, 0), u("infantry", 1, 1)]);
    const after = run(state, { type: "resign" });
    expect(lost(after, 0)).toEqual({});
  });

  it("losses add up over the game", () => {
    const state = makeGame(["====="], [
      u("mediumTank", 0, 0), u("infantry", 1, 1, { hp: 10 }), u("mediumTank", 0, 2), u("infantry", 1, 3, { hp: 10 }), u("infantry", 1, 4),
    ], { settings: { luck: false } });
    const after = run(state, attack(0, 1), attack(2, 3));
    expect(lost(after, 1)).toEqual({ infantry: 2 });
  });

  it("the tally survives saving and loading, and older saves load with nothing lost", () => {
    const state = makeGame(["==="], [u("mediumTank", 0, 0), u("infantry", 1, 1, { hp: 10 }), u("infantry", 1, 2)], { settings: { luck: false } });
    const after = run(state, attack(0, 1));
    expect(lost(loadGame(saveGame(after)), 1)).toEqual({ infantry: 1 });
    const old = JSON.parse(saveGame(state)) as { state: { players: { unitsLost?: unknown }[] } };
    for (const p of old.state.players) delete p.unitsLost;
    expect(lost(loadGame(JSON.stringify(old)), 0)).toEqual({});
  });
});

describe("the losses bill on the results screen (04-economy §8a)", () => {
  it("lists one line per unit type with its count, the most expensive type first", () => {
    const base = makeGame(["=="], [u("infantry", 0, 0), u("infantry", 1, 1)]);
    const state: GameState = {
      ...base,
      players: base.players.map((p) => (p.id === 0 ? { ...p, unitsLost: { infantry: 3, heavyTank: 1, mediumTank: 2 } } : p)),
    };
    expect(lossLines(state, 0).map((l) => [l.name, l.count])).toEqual([
      ["Heavy Tank", 1],
      ["Medium Tank", 2],
      ["Infantry", 3],
    ]);
    expect(lossLines(state, 1)).toEqual([]);
  });
});
