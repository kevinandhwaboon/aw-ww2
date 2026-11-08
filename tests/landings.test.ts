import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, UnitAction } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState, Unit } from "../src/engine/state";
import { unloadTiles } from "../src/engine/transport";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const order = (unitId: number, path: Point[], action: UnitAction): Command => ({ type: "move", unitId, path, action });
const load = (unitId: number, path: Point[]) => order(unitId, path, { type: "load" });
const unload = (unitId: number, passenger: number, to: Point, path: Point[] = []) =>
  order(unitId, path, { type: "unload", passenger, to });
/** Unloads two passengers in one action (D3). */
const unloadBoth = (unitId: number, first: [number, Point], second: [number, Point], path: Point[] = []) =>
  order(unitId, path, { type: "unload", passenger: first[0], to: first[1], second: { passenger: second[0], to: second[1] } });

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}
const run = (state: GameState, ...commands: Command[]) => commands.reduce((s, c) => must(s, c).state, state);
const nextRound = (state: GameState) => run(state, endTurn, endTurn);
const byId = (state: GameState, id: number): Unit | undefined => state.units.find((u) => u.id === id);
const unit = (state: GameState, id: number): Unit => {
  const found = byId(state, id);
  if (!found) throw new Error(`No unit ${id}`);
  return found;
};
const rejection = (state: GameState, command: Command) => {
  const result = apply(state, command);
  return result.ok ? null : result.code;
};

const u = (type: UnitSetup["type"], owner: number, x: number, y = 0): UnitSetup => ({ type, owner, pos: P(x, y) });

describe("unloading two passengers at once (05-supply-transport §6, §8, D3)", () => {
  // A Landing Craft (0) on the beach at (1,1), with Infantry (1) and a Medium Tank (2) beside it.
  const loaded = () =>
    run(
      makeGame(["...", "._S", "..."], [u("landingCraft", 0, 1, 1), u("infantry", 0, 1, 0), u("mediumTank", 0, 0, 1)]),
      load(1, [P(1, 1)]),
      load(2, [P(1, 1)]),
    );

  it("a transport with two passengers can unload both in one action", () => {
    const { state, events } = must(loaded(), unloadBoth(0, [1, P(1, 2)], [2, P(0, 1)]));
    expect(byId(state, 1)?.pos).toEqual(P(1, 2));
    expect(byId(state, 2)?.pos).toEqual(P(0, 1));
    expect(byId(state, 0)).toMatchObject({ cargo: [], hasActed: true });
    expect(events.filter((e) => e.type === "unitUnloaded")).toHaveLength(2);
  });

  it("both unloaded units can't act that turn", () => {
    const state = run(loaded(), unloadBoth(0, [1, P(1, 2)], [2, P(0, 1)]));
    expect(rejection(state, order(1, [], { type: "wait" }))).toBe("unitAlreadyActed");
    expect(rejection(state, order(2, [], { type: "wait" }))).toBe("unitAlreadyActed");
  });

  it("it can still unload just one, keeping the other aboard", () => {
    const state = run(loaded(), unload(0, 2, P(0, 1)));
    expect(unit(state, 0).cargo.map((c) => c.id)).toEqual([1]);
  });

  it("the second passenger can't land where the first did", () => {
    expect(rejection(loaded(), unloadBoth(0, [1, P(1, 2)], [2, P(1, 2)]))).toBe("cannotUnload");
  });

  it("the same passenger can't be unloaded twice", () => {
    expect(rejection(loaded(), unloadBoth(0, [1, P(1, 2)], [1, P(0, 1)]))).toBe("cannotUnload");
  });

  it("rejects a malformed second unload from untyped code", () => {
    const action = { type: "unload", passenger: 1, to: P(1, 2), second: { passenger: 2 } };
    const bad = { type: "move", unitId: 0, path: [], action } as unknown as Command;
    expect(rejection(loaded(), bad)).toBe("invalidCommand");
  });
});

describe("Landing Craft (05-supply-transport §8)", () => {
  it("carries any two land units, vehicles included", () => {
    const state = run(
      makeGame(["._."], [u("landingCraft", 0, 1), u("heavyTank", 0, 0), u("artillery", 0, 2)]),
      load(1, [P(1, 0)]),
      load(2, [P(1, 0)]),
    );
    expect(unit(state, 0).cargo.map((c) => c.type)).toEqual(["heavyTank", "artillery"]);
  });

  it("units board on a Beach, or on a friendly or neutral Port, but not an enemy Port", () => {
    const atPort = (owner: number | null) =>
      makeGame(["P."], [u("landingCraft", 0, 0), u("infantry", 0, 1)], owner === null ? {} : { propertyOwners: [{ pos: P(0, 0), owner }] });
    expect(rejection(atPort(0), load(1, [P(0, 0)]))).toBeNull();
    expect(rejection(atPort(null), load(1, [P(0, 0)]))).toBeNull();
    expect(rejection(atPort(1), load(1, [P(0, 0)]))).toBe("cannotLoad");
  });

  it("drives onto the beach and unloads onto the land beside it", () => {
    // The craft beaches and the Infantry boards; next turn it sails out; the turn after, it lands again.
    const start = makeGame([".._S"], [u("infantry", 0, 1), u("landingCraft", 0, 3)]);
    const boarded = run(start, order(1, [P(2, 0)], { type: "wait" }), load(0, [P(2, 0)]));
    const sailed = run(nextRound(boarded), order(1, [P(3, 0)], { type: "wait" }));
    const landed = run(nextRound(sailed), unload(1, 0, P(1, 0), [P(2, 0)]));
    expect(byId(landed, 0)?.pos).toEqual(P(1, 0));
  });

  it("it can't unload from the open sea, even next to the shore", () => {
    const state = run(makeGame(["._S"], [u("infantry", 0, 0), u("landingCraft", 0, 1)]), load(0, [P(1, 0)]));
    const atSea = nextRound(state);
    expect(unloadTiles(atSea, { ...unit(atSea, 1), pos: P(2, 0) }, unit(atSea, 1).cargo[0] as Unit)).toEqual([]);
    expect(rejection(atSea, unload(1, 0, P(1, 0), [P(2, 0)]))).toBe("cannotUnload");
  });

  it("an empty Halftrack can board, but a Halftrack carrying a passenger can't (D4)", () => {
    const game = () => makeGame(["=._"], [u("infantry", 0, 0), u("halftrack", 0, 1), u("landingCraft", 0, 2)]);
    expect(rejection(game(), load(1, [P(2, 0)]))).toBeNull();
    const carrying = run(game(), load(0, [P(1, 0)]));
    expect(rejection(carrying, load(1, [P(2, 0)]))).toBe("cannotLoad");
  });

  it("ships can't board", () => {
    const state = makeGame(["_S"], [u("landingCraft", 0, 0), u("destroyer", 0, 1)]);
    expect(rejection(state, load(1, [P(0, 0)]))).not.toBeNull();
  });
});

describe("Transport Aircraft drops (05-supply-transport §6, 01-units §5)", () => {
  /** A Transport Aircraft (0) on an airfield at (0,0), with Infantry (1) and an Assault Infantry (2) beside it. */
  const game = (airfieldOwner: number | null = 0) =>
    makeGame(
      ["A...H...", "...S.b..", "....~..."],
      [u("transportAircraft", 0, 0), u("infantry", 0, 1), u("assaultInfantry", 0, 0, 1)],
      airfieldOwner === null ? {} : { propertyOwners: [{ pos: P(0, 0), owner: airfieldOwner }] },
    );
  const boarded = () => nextRound(run(game(), load(1, [P(0, 0)]), load(2, [P(0, 0)])));
  const flight = [P(1, 0), P(2, 0), P(3, 0), P(4, 0), P(4, 1)];

  it("foot units board only while the aircraft is on its owner's airfield", () => {
    expect(rejection(game(0), load(1, [P(0, 0)]))).toBeNull();
    expect(rejection(game(null), load(1, [P(0, 0)]))).toBe("cannotLoad");
    expect(rejection(game(1), load(1, [P(0, 0)]))).toBe("cannotLoad");
    const elsewhere = makeGame(["..", ".."], [u("transportAircraft", 0, 0), u("infantry", 0, 1)]);
    expect(rejection(elsewhere, load(1, [P(0, 0)]))).toBe("cannotLoad");
  });

  it("vehicles can't board", () => {
    const state = makeGame(["A."], [u("transportAircraft", 0, 0), u("recon", 0, 1)], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    expect(rejection(state, load(1, [P(0, 0)]))).toBe("cannotLoad");
  });

  it("after flying, it can drop onto Hills, Bocage and River, but never into the sea (D2)", () => {
    const state = boarded();
    const aircraft = { ...unit(state, 0), pos: P(4, 1) };
    const passenger = aircraft.cargo[0] as Unit;
    expect(unloadTiles(state, aircraft, passenger)).toEqual([P(4, 0), P(5, 1), P(4, 2)]);
  });

  it("it can't drop onto the tile it's flying over, since one unit per tile still holds (02-terrain §5)", () => {
    const state = boarded();
    expect(rejection(state, unload(0, 1, P(4, 1), flight))).toBe("cannotUnload");
  });

  it("it drops both passengers in one action, and they can't act until next turn (D3)", () => {
    const state = run(boarded(), unloadBoth(0, [1, P(4, 0)], [2, P(5, 1)], flight));
    expect(byId(state, 1)).toMatchObject({ pos: P(4, 0), hasActed: true, airDropped: true });
    expect(byId(state, 2)).toMatchObject({ pos: P(5, 1), hasActed: true, airDropped: true });
    expect(rejection(state, order(1, [], { type: "wait" }))).toBe("unitAlreadyActed");
  });

  it("it can't drop onto an occupied tile", () => {
    const state = run(boarded(), unload(0, 1, P(4, 0), flight));
    expect(rejection(state, order(2, [], { type: "wait" }))).not.toBeNull(); // still aboard
    const blocked = nextRound(state);
    expect(rejection(blocked, unload(0, 2, P(4, 0)))).toBe("cannotUnload");
  });
});
