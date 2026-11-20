import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, GameEvent } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import { loadGame, saveGame } from "../src/engine/save";
import { parseScenario } from "../src/engine/scenario";
import type { GameSetup, UnitSetup } from "../src/engine/setup";
import type { Arrival, GameState } from "../src/engine/state";
import { eventsSeenBy } from "../src/engine/visibility";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const wait = (unitId: number, path: Point[] = []): Command => ({ type: "move", unitId, path, action: { type: "wait" } });

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}
const run = (state: GameState, ...commands: Command[]) => commands.reduce((s, c) => must(s, c).state, state);
/** Every event from a run of commands, in order. */
const eventsOf = (state: GameState, ...commands: Command[]) => {
  const events: GameEvent[] = [];
  commands.reduce((s, c) => {
    const result = must(s, c);
    events.push(...result.events);
    return result.state;
  }, state);
  return events;
};

/** Whole days: both players end their turn this many times. */
const days = (n: number) => Array.from({ length: 2 * n }, () => endTurn);

/** The Allies' infantry stays at the west end, so nobody is routed. */
const allied: UnitSetup = { type: "infantry", owner: 0, pos: P(0, 0) };

const game = (rows: string[], arrivals: Arrival[], units: UnitSetup[] = [allied], overrides: Partial<Omit<GameSetup, "map" | "units">> = {}) =>
  makeGame(rows, units, { arrivals, ...overrides });

const axisUnits = (state: GameState) => state.units.filter((u) => u.owner === 1);

describe("Arrivals (23-survival §5a)", () => {
  it("a scheduled arrival appears in its entry zone at the start of its player's turn (23-survival §5a)", () => {
    const state = game(["....SS"], [{ day: 1, player: 1, wave: 3, name: "The first landing", zone: [P(5, 0)], units: [{ type: "destroyer" }] }]);
    expect(axisUnits(state)).toEqual([]);
    const { state: after, events } = must(state, endTurn);
    expect(axisUnits(after).map((u) => [u.type, u.pos])).toEqual([["destroyer", P(5, 0)]]);
    expect(events).toContainEqual({
      type: "unitsArrived",
      player: 1,
      day: 1,
      wave: 3,
      name: "The first landing",
      units: [{ unitId: 1, unitType: "destroyer", pos: P(5, 0) }],
    });
    expect(after.arrivals).toEqual([]);
  });

  it("units don't arrive before their day (23-survival §5a)", () => {
    const state = game(["....SS"], [{ day: 3, player: 1, zone: [P(5, 0)], units: [{ type: "destroyer" }] }]);
    expect(axisUnits(run(state, ...days(1), endTurn))).toEqual([]);
    expect(axisUnits(run(state, ...days(2), endTurn))).toHaveLength(1);
  });

  it("an arrival for the first player on day 1 is on the map from the start (23-survival §5a)", () => {
    const state = game(["....SS"], [{ day: 1, player: 0, zone: [P(4, 0)], units: [{ type: "destroyer" }] }]);
    expect(state.units.map((u) => [u.owner, u.type])).toEqual([
      [0, "infantry"],
      [0, "destroyer"],
    ]);
  });

  it("arriving units can't act on the turn they arrive (23-survival §5a)", () => {
    const state = run(game(["....SS"], [{ day: 1, player: 0, zone: [P(4, 0)], units: [{ type: "destroyer" }] }]));
    const destroyer = state.units.find((u) => u.type === "destroyer");
    expect(destroyer?.hasActed).toBe(true);
    expect(apply(state, wait(1))).toMatchObject({ ok: false, code: "unitAlreadyActed" });
    expect(run(state, ...days(1)).units.find((u) => u.type === "destroyer")?.hasActed).toBe(false);
  });

  it("each unit takes the first free square of the zone that it can stand on (23-survival §5a)", () => {
    const state = game(
      ["S...."],
      [{ day: 1, player: 1, zone: [P(0, 0), P(1, 0), P(2, 0), P(3, 0)], units: [{ type: "infantry" }, { type: "infantry" }] }],
      [allied, { type: "infantry", owner: 0, pos: P(2, 0) }],
    );
    // (0, 0) is sea and (2, 0) is taken, so infantry lands on (1, 0) and (3, 0).
    expect(axisUnits(run(state, endTurn)).map((u) => u.pos)).toEqual([P(1, 0), P(3, 0)]);
  });

  it("an arrival with no free square waits for the next turn (23-survival §5a)", () => {
    const state = game(["....."], [{ day: 1, player: 1, zone: [P(4, 0)], units: [{ type: "infantry" }, { type: "infantry" }] }]);
    const first = run(state, endTurn);
    expect(axisUnits(first)).toHaveLength(1);
    expect(first.arrivals).toEqual([{ day: 1, player: 1, zone: [P(4, 0)], units: [{ type: "infantry" }] }]);
    // The first one moves off the square next turn, and the second comes on at the turn after.
    const second = run(first, endTurn, endTurn, wait(1, [P(3, 0)]), endTurn, endTurn);
    expect(axisUnits(second).map((u) => u.pos)).toEqual([P(3, 0), P(4, 0)]);
    expect(second.arrivals).toEqual([]);
  });

  it("arrivals keep within the unit cap, and the rest wait (23-survival §5a, 04-economy §4)", () => {
    const state = game(["....."], [{ day: 1, player: 1, zone: [P(3, 0), P(4, 0)], units: [{ type: "infantry" }, { type: "infantry" }] }], [allied], {
      settings: { unitCap: 1 },
    });
    const after = run(state, endTurn);
    expect(axisUnits(after)).toHaveLength(1);
    expect(after.arrivals[0]?.units).toHaveLength(1);
  });

  it("a Landing Craft arrives with its passengers aboard (23-survival §5a)", () => {
    const state = game(["..._S"], [{ day: 1, player: 1, zone: [P(4, 0)], units: [{ type: "landingCraft", cargo: [{ type: "infantry" }, { type: "assaultInfantry" }] }] }]);
    const craft = axisUnits(run(state, endTurn))[0];
    expect(craft?.cargo.map((c) => [c.type, c.owner])).toEqual([
      ["infantry", 1],
      ["assaultInfantry", 1],
    ]);
  });

  it("an arrival can come in short of fuel, but never with more than a full tank (23-survival §5a)", () => {
    const state = game(["....SS"], [{ day: 1, player: 1, zone: [P(4, 0), P(5, 0)], units: [{ type: "destroyer", fuel: 20 }, { type: "destroyer", fuel: 999 }] }]);
    expect(axisUnits(run(state, endTurn)).map((u) => u.fuel)).toEqual([20, 65]);
  });

  it("the wave reached is the highest wave number that has arrived (23-survival §5e)", () => {
    const state = game(["....SS"], [
      { day: 1, player: 1, wave: 1, zone: [P(5, 0)], units: [{ type: "destroyer" }] },
      { day: 2, player: 1, wave: 2, zone: [P(4, 0)], units: [{ type: "destroyer" }] },
    ]);
    expect(state.wave).toBe(0);
    expect(run(state, endTurn).wave).toBe(1);
    expect(run(state, ...days(1), endTurn).wave).toBe(2);
  });

  it("a player whose first units arrive in a wave can be routed once they are all gone (04-economy §8)", () => {
    const state = game(["....."], [{ day: 1, player: 1, zone: [P(4, 0)], units: [{ type: "infantry" }] }]);
    expect(state.players[1]?.hasFielded).toBe(false);
    expect(run(state, endTurn).players[1]?.hasFielded).toBe(true);
  });

  it("in fog of war, the wave's banner shows but only units in sight are named (23-survival §4, 19-fog-of-war §7)", () => {
    const state = game(["..........SS"], [{ day: 1, player: 1, wave: 1, zone: [P(11, 0)], units: [{ type: "destroyer" }] }], [allied], {
      settings: { fogOfWar: true },
    });
    const result = must(state, endTurn);
    const shown = eventsSeenBy(state, result.state, result.events, 0).events.find((e) => e.type === "unitsArrived");
    expect(shown).toMatchObject({ wave: 1, units: [] });
  });
});

describe("Raiders go home (23-survival §5c)", () => {
  const raid = (units: Arrival["units"]): Arrival => ({ day: 1, player: 1, zone: [P(4, 0), P(3, 0)], units });

  it("a raider flies for its sortie turns, then goes home at the start of the next one (23-survival §5c)", () => {
    const state = game(["....."], [raid([{ type: "bomber", sortieTurns: 2 }])]);
    // Arrives on day 1, flies on days 2 and 3, and leaves at the start of Japan's turn on day 4.
    expect(axisUnits(run(state, ...days(3)))).toHaveLength(1);
    const events = eventsOf(state, ...days(3), endTurn);
    expect(events).toContainEqual({ type: "unitLeft", unitId: 1, unitType: "bomber", owner: 1, pos: P(4, 0) });
    expect(axisUnits(run(state, ...days(3), endTurn))).toEqual([]);
  });

  it("a raider that goes home isn't counted as a loss (23-survival §5c, 04-economy §8a)", () => {
    const state = game(["....."], [raid([{ type: "bomber", sortieTurns: 1 }])]);
    expect(run(state, ...days(3)).players[1]?.unitsLost).toEqual({});
  });

  it("a raider goes home with the units it carries (23-survival §5c)", () => {
    const state = game(["....."], [raid([{ type: "transportAircraft", sortieTurns: 1, cargo: [{ type: "infantry" }] }])]);
    const after = run(state, ...days(2), endTurn);
    expect(axisUnits(after)).toEqual([]);
    expect(after.players[1]?.unitsLost).toEqual({});
  });

  it("a raider that lands on its own side's airfield stays (23-survival §5c)", () => {
    const state = game(["...A."], [raid([{ type: "bomber", sortieTurns: 1 }])], [allied], { propertyOwners: [{ pos: P(3, 0), owner: 1 }] });
    const landed = run(state, endTurn, endTurn, endTurn, wait(1, [P(3, 0)]), ...days(5));
    expect(axisUnits(landed).map((u) => [u.type, u.sortie])).toEqual([["bomber", undefined]]);
  });

  it("a raider that lands on a Carrier stays (23-survival §5c)", () => {
    const state = game(["..SSS"], [raid([{ type: "fighter", sortieTurns: 1 }])], [allied, { type: "carrier", owner: 1, pos: P(2, 0) }]);
    const aboard = run(state, endTurn, endTurn, endTurn, { type: "move", unitId: 2, path: [P(3, 0), P(2, 0)], action: { type: "load" } }, ...days(5));
    const carrier = axisUnits(aboard).find((u) => u.type === "carrier");
    expect(carrier?.cargo.map((c) => [c.type, c.sortie])).toEqual([["fighter", undefined]]);
  });

  it("units arriving without a sortie stay as long as any unit (23-survival §5c)", () => {
    const state = game(["....."], [raid([{ type: "infantry" }])]);
    expect(axisUnits(run(state, ...days(6)))).toHaveLength(1);
  });
});

describe("A rout limited to one side (23-survival §5b)", () => {
  const routAllies = { victory: [{ type: "hqCapture" as const }, { type: "rout" as const, side: "allies" as const }] };

  it("a rout limited to the Allies doesn't defeat an Axis player with no units (23-survival §5b)", () => {
    const state = game(["....."], [{ day: 1, player: 1, zone: [P(4, 0)], units: [{ type: "bomber", sortieTurns: 1 }] }], [allied], routAllies);
    // The bomber goes home on day 3, leaving the Axis with nothing on the map.
    const after = run(state, ...days(4));
    expect(axisUnits(after)).toEqual([]);
    expect(after.result).toBeNull();
    expect(after.players[1]?.defeated).toBe(false);
  });

  it("a rout limited to the Allies still defeats the Allies when they have no units left (23-survival §5b)", () => {
    const state = makeGame(["....."], [{ type: "infantry", owner: 0, pos: P(0, 0), hp: 10 }, { type: "mediumTank", owner: 1, pos: P(1, 0) }], routAllies);
    const after = run(state, endTurn, { type: "move", unitId: 1, path: [], action: { type: "attack", target: 0 } }, endTurn);
    expect(after.result).toMatchObject({ winningSide: "axis", reason: "rout" });
  });
});

describe("Arrivals in scenario files and saves (23-survival §5a)", () => {
  const scenario = (extra: Record<string, unknown>) => ({
    id: "wave-test",
    name: "Wave test",
    description: "A test",
    map: ["....SS"],
    players: [
      { name: "US", nation: "us" },
      { name: "Japan", nation: "japan" },
    ],
    units: [{ type: "infantry", owner: 0, pos: { x: 0, y: 0 } }],
    ...extra,
  });

  it("a scenario file can list arrivals and a rout for one side (23-survival §5a, §5b)", () => {
    const parsed = parseScenario(
      scenario({
        victory: [{ type: "hqCapture" }, { type: "rout", side: "allies" }],
        arrivals: [{ day: 2, player: 1, wave: 1, name: "Raid", from: "south", unitCap: 30, zone: [{ x: 5, y: 0 }], units: [{ type: "bomber", sortieTurns: 2, fuel: 30 }] }],
      }),
    );
    expect(parsed.setup.victory).toEqual([{ type: "hqCapture" }, { type: "rout", side: "allies" }]);
    expect(parsed.setup.arrivals).toEqual([
      { day: 2, player: 1, wave: 1, unitCap: 30, name: "Raid", from: "south", zone: [P(5, 0)], units: [{ type: "bomber", sortieTurns: 2, fuel: 30 }] },
    ]);
  });

  it("a scenario file is refused if an arrival has an empty zone, a square off the map or a sortie of 0 (23-survival §5a)", () => {
    const arrival = { day: 1, player: 1, zone: [{ x: 5, y: 0 }], units: [{ type: "bomber" }] };
    expect(() => parseScenario(scenario({ arrivals: [{ ...arrival, zone: [] }] }))).toThrow(/zone/);
    expect(() => parseScenario(scenario({ arrivals: [{ ...arrival, zone: [{ x: 9, y: 0 }] }] }))).toThrow(/outside the map/);
    expect(() => parseScenario(scenario({ arrivals: [{ ...arrival, units: [{ type: "bomber", sortieTurns: 0 }] }] }))).toThrow(/sortieTurns/);
    expect(() => parseScenario(scenario({ arrivals: [{ ...arrival, player: 2 }] }))).toThrow(/unknown player/);
  });

  it("units still to arrive are kept in a save (23-survival §5a)", () => {
    const state = game(["....SS"], [{ day: 3, player: 1, zone: [P(5, 0)], units: [{ type: "destroyer" }] }]);
    expect(loadGame(saveGame(state)).arrivals).toEqual(state.arrivals);
  });

  it("a save from before arrivals loads with none coming and no wave yet (23-survival §5a)", () => {
    const old: Record<string, unknown> = { ...game(["....."], []) };
    delete old.arrivals;
    delete old.wave;
    const loaded = loadGame(JSON.stringify({ version: 1, state: old }));
    expect(loaded.arrivals).toEqual([]);
    expect(loaded.wave).toBe(0);
  });
});
