import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, UnitAction } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import { loadGame, saveGame } from "../src/engine/save";
import { parseScenario } from "../src/engine/scenario";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState, VictoryCondition } from "../src/engine/state";
import { objectiveLines } from "../src/game/objectives";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const order = (unitId: number, path: Point[], action: UnitAction = { type: "wait" }): Command => ({ type: "move", unitId, path, action });

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}
const run = (state: GameState, ...commands: Command[]) => commands.reduce((s, c) => must(s, c).state, state);
const u = (type: UnitSetup["type"], owner: number, x: number, y = 0, extra: Partial<UnitSetup> = {}): UnitSetup => ({ type, owner, pos: P(x, y), ...extra });

/** Evacuate foot units (or, with `anyType`, every land unit) to the two left-hand squares; the game is won at `count`. */
const evacuation = (count = 5, anyType = false): VictoryCondition => ({
  type: "evacuateUnits",
  side: "allies",
  count,
  zone: [P(0, 0), P(1, 0)],
  ...(anyType ? {} : { unitTypes: ["infantry", "assaultInfantry", "mortar"] }),
});

/** A strip of plains: the zone is (0,0) and (1,0); a German Infantry far to the right keeps Germany in the game. */
const strip = (units: UnitSetup[], victory: VictoryCondition[] = [evacuation()]) =>
  makeGame(["........"], [...units, u("infantry", 1, 7)], { victory: [...victory, { type: "rout" }] });

describe("evacuateUnits (04-economy §8, 21-scenarios-dunkirk §1)", () => {
  it("a foot unit unloaded onto an evacuation square is removed and counted", () => {
    // A Landing Craft on the beach at (2,0), next to the zone, with Infantry aboard.
    const state = makeGame(["._.S....", "SSSSSSSS"], [u("landingCraft", 0, 1, 1, { cargo: [{ type: "infantry" }] }), u("infantry", 1, 7)], {
      victory: [evacuation(5), { type: "rout" }],
    });
    const passenger = state.units[0]?.cargo[0]?.id ?? -1;
    const { state: after, events } = must(state, order(0, [P(1, 0)], { type: "unload", passenger, to: P(0, 0) }));
    expect(after.units.some((x) => x.id === passenger)).toBe(false);
    expect(after.evacuated[0]).toBe(1);
    expect(events.at(-1)).toEqual({ type: "unitEvacuated", unitId: passenger, unitType: "infantry", owner: 0, pos: P(0, 0), counted: true, total: 1 });
  });

  it("a unit that walks onto an evacuation square is evacuated too", () => {
    const after = run(strip([u("infantry", 0, 3)]), order(0, [P(2, 0), P(1, 0)]));
    expect(after.units.map((x) => x.owner)).toEqual([1]);
    expect(after.evacuated[0]).toBe(1);
  });

  it("a unit type not in the list is removed but not counted", () => {
    const { state, events } = must(strip([u("lightTank", 0, 3)]), order(0, [P(2, 0), P(1, 0)]));
    expect(state.units.some((x) => x.owner === 0)).toBe(false);
    expect(state.evacuated[0]).toBe(0);
    expect(events.at(-1)).toMatchObject({ type: "unitEvacuated", unitType: "lightTank", counted: false, total: 0 });
  });

  it("with no unit types listed, every land unit counts", () => {
    const after = run(strip([u("lightTank", 0, 3)], [evacuation(5, true)]), order(0, [P(2, 0), P(1, 0)]));
    expect(after.evacuated[0]).toBe(1);
  });

  it("a 1-HP unit counts as one unit", () => {
    const after = run(strip([u("infantry", 0, 2, 0, { hp: 5 })]), order(0, [P(1, 0)]));
    expect(after.evacuated[0]).toBe(1);
  });

  it("the side wins the moment its count reaches the target", () => {
    const state = strip([u("infantry", 0, 2), u("infantry", 0, 3)], [evacuation(2)]);
    const first = run(state, order(0, [P(1, 0)]));
    expect(first.result).toBeNull();
    const { state: after, events } = must(first, order(1, [P(2, 0), P(1, 0)]));
    expect(after.result).toEqual({ winningSide: "allies", winners: [0], reason: "evacuateUnits" });
    expect(events.map((e) => e.type).slice(-3)).toEqual(["unitEvacuated", "playerDefeated", "gameOver"]);
  });

  it("an evacuated unit isn't counted as a loss", () => {
    const after = run(strip([u("infantry", 0, 2)]), order(0, [P(1, 0)]));
    expect(after.players[0]?.unitsLost).toEqual({});
  });

  it("an evacuated side's last unit leaving doesn't rout it while it can still win", () => {
    // Rout only counts units on the map, so a side that has taken everyone home has no units; that's a
    // rout at the end of the turn unless the evacuation already won. Here it hasn't (1 of 5).
    const after = run(strip([u("infantry", 0, 2), u("infantry", 0, 4)]), order(0, [P(1, 0)]), endTurn);
    expect(after.result).toBeNull();
  });

  it("an enemy unit on an evacuation square isn't evacuated", () => {
    const state = makeGame(["........"], [u("infantry", 0, 6), u("infantry", 1, 2)], { victory: [evacuation(), { type: "rout" }] });
    const after = run(state, endTurn, order(1, [P(1, 0)]));
    expect(after.units.find((x) => x.owner === 1)?.pos).toEqual(P(1, 0));
    expect(after.evacuated[0]).toBe(0);
  });

  it("a unit built on an evacuation square isn't evacuated", () => {
    const state = makeGame(["f......."], [u("infantry", 0, 4), u("infantry", 1, 7)], {
      victory: [evacuation(), { type: "rout" }],
      players: [{ name: "Allies", nation: "us", funds: 1000 }, { name: "Axis", nation: "germany" }],
      propertyOwners: [{ pos: P(0, 0), owner: 0 }],
    });
    const after = run(state, { type: "build", unitType: "infantry", pos: P(0, 0) });
    expect(after.units.some((x) => x.pos.x === 0 && x.owner === 0)).toBe(true);
    expect(after.evacuated[0]).toBe(0);
  });

  it("allies add to the same count", () => {
    const state = makeGame(["........"], [u("infantry", 0, 2), u("infantry", 1, 3), u("infantry", 2, 7)], {
      victory: [evacuation(2), { type: "rout" }],
      players: [{ name: "US", nation: "us" }, { name: "UK", nation: "uk" }, { name: "Germany", nation: "germany" }],
    });
    const after = run(state, order(0, [P(1, 0)]), endTurn, order(1, [P(2, 0), P(1, 0)]));
    expect(after.evacuated[0]).toBe(2);
    expect(after.result?.winningSide).toBe("allies");
  });

  it("the HUD shows how many have been evacuated out of the target", () => {
    const after = run(strip([u("infantry", 0, 2)], [evacuation(15)]), order(0, [P(1, 0)]));
    expect(objectiveLines(after).map((l) => l.text)).toEqual(["Allies: evacuate 15 foot units to the shaded area (1/15)"]);
  });

  it("the count survives saving and loading, and older saves start at none", () => {
    const after = run(strip([u("infantry", 0, 2)]), order(0, [P(1, 0)]));
    expect(loadGame(saveGame(after)).evacuated).toEqual([1, 0]);
    const old = JSON.parse(saveGame(after)) as { state: Record<string, unknown> };
    delete old.state.evacuated;
    expect(loadGame(JSON.stringify(old)).evacuated).toEqual([0, 0]);
  });

  describe("a file is refused", () => {
    const file = (condition: Record<string, unknown>) => ({
      id: "test",
      name: "Test",
      description: "A test scenario",
      map: ["Q..", "...", "..Q"],
      players: [{ name: "A", nation: "us" }, { name: "B", nation: "germany" }],
      units: [{ type: "infantry", owner: 0, pos: P(1, 1) }],
      victory: [{ type: "evacuateUnits", side: "allies", count: 3, zone: [P(0, 2)], ...condition }],
    });

    it("if the count is under 1", () => {
      expect(() => parseScenario(file({ count: 0 }))).toThrow(/"count" must be 1 or more/);
    });

    it("if the zone is empty", () => {
      expect(() => parseScenario(file({ zone: [] }))).toThrow(/at least one zone square/);
    });

    it("if a listed unit type doesn't exist", () => {
      expect(() => parseScenario(file({ unitTypes: ["infantry", "cavalry"] }))).toThrow(/unknown unit type "cavalry"/);
    });

    it("but a sound one loads", () => {
      expect(parseScenario(file({ unitTypes: ["infantry"] })).setup.victory?.[0]).toMatchObject({ type: "evacuateUnits", count: 3 });
    });
  });
});
