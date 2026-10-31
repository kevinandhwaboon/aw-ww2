import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, UnitAction } from "../src/engine/commands";
import { joinProblem, supplyTargets, unloadTiles } from "../src/engine/transport";
import type { Point } from "../src/engine/map";
import type { UnitSetup } from "../src/engine/setup";
import { CAPTURE_POINTS, propertyAt, type GameState, type Unit } from "../src/engine/state";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const order = (unitId: number, path: Point[], action: UnitAction): Command => ({ type: "move", unitId, path, action });
const load = (unitId: number, path: Point[]) => order(unitId, path, { type: "load" });
const join = (unitId: number, path: Point[]) => order(unitId, path, { type: "join" });
const supply = (unitId: number, path: Point[] = []) => order(unitId, path, { type: "supply" });
const unload = (unitId: number, passenger: number, to: Point, path: Point[] = []) =>
  order(unitId, path, { type: "unload", passenger, to });

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}
const run = (state: GameState, ...commands: Command[]) => commands.reduce((s, c) => must(s, c).state, state);
const byId = (state: GameState, id: number): Unit | undefined => state.units.find((u) => u.id === id);

const u = (type: UnitSetup["type"], owner: number, x: number, y = 0, extra: Partial<UnitSetup> = {}): UnitSetup =>
  ({ type, owner, pos: P(x, y), ...extra });

describe("loading a Halftrack (05-supply-transport §4)", () => {
  const game = () => makeGame(["====="], [u("infantry", 0, 0), u("halftrack", 0, 1), u("assaultInfantry", 0, 2), u("mediumTank", 0, 3)]);

  it("a foot unit boards by moving onto the Halftrack, which ends its action", () => {
    const { state, events } = must(game(), load(0, [P(1, 0)]));
    expect(byId(state, 0)).toBeUndefined();
    expect(byId(state, 1)?.cargo.map((c) => c.id)).toEqual([0]);
    expect(events.map((e) => e.type)).toEqual(["unitMoved", "unitLoaded"]);
  });

  it("boarding spends fuel for the move", () => {
    const { state } = must(game(), load(0, [P(1, 0)]));
    expect(byId(state, 1)?.cargo[0]?.fuel).toBe(98);
  });

  it("Assault Infantry and Mortar Teams can board too", () => {
    expect(apply(game(), load(2, [P(1, 0)])).ok).toBe(true);
  });

  it("vehicles can't board", () => {
    const state = makeGame(["=="], [u("recon", 0, 0), u("halftrack", 0, 1)]);
    expect(apply(state, load(0, [P(1, 0)]))).toMatchObject({ ok: false, code: "cannotLoad" });
  });

  it("a Halftrack holds 1 unit", () => {
    const state = run(game(), load(0, [P(1, 0)]));
    expect(apply(state, load(2, [P(1, 0)]))).toMatchObject({ ok: false, code: "cannotLoad" });
  });

  it("you can't board another player's Halftrack or a non-transport", () => {
    const state = makeGame(["=="], [u("infantry", 0, 0), u("infantry", 0, 1)]);
    expect(apply(state, load(0, [P(1, 0)]))).toMatchObject({ ok: false, code: "cannotLoad" });
  });

  it("a Load order must actually move onto a transport", () => {
    expect(apply(game(), load(0, []))).toMatchObject({ ok: false, code: "cannotLoad" });
  });

  it("other actions still can't end on a friendly unit", () => {
    expect(apply(game(), order(0, [P(1, 0)], { type: "wait" }))).toMatchObject({ ok: false, code: "invalidPath" });
  });

  it("passengers keep their HP, ammo and veterancy", () => {
    // Starts two tiles away: a Halftrack refills adjacent units at the start of its owner's turn.
    const state = makeGame(["==="], [u("assaultInfantry", 0, 0, 0, { hp: 60, ammo: 2, kills: 4 }), u("halftrack", 0, 2)]);
    expect(byId(run(state, load(0, [P(1, 0), P(2, 0)])), 1)?.cargo[0]).toMatchObject({ hp: 60, ammo: 2, kills: 4 });
  });

  it("boarding counts as leaving a property being captured", () => {
    const state = makeGame(["C="], [u("infantry", 0, 0), u("halftrack", 0, 1)]);
    const after = run(state, order(0, [], { type: "capture" }), endTurn, endTurn, load(0, [P(1, 0)]));
    expect(propertyAt(after, P(0, 0))).toMatchObject({ capturePoints: CAPTURE_POINTS, capturingUnit: null });
  });
});

describe("unloading a Halftrack (05-supply-transport §4)", () => {
  const loaded = () => run(makeGame(["===.", "=~=."], [u("infantry", 0, 0), u("halftrack", 0, 1)]), load(0, [P(1, 0)]), endTurn, endTurn);

  it("puts the passenger on an adjacent tile, ending the Halftrack's action", () => {
    const { state, events } = must(loaded(), unload(1, 0, P(2, 0)));
    expect(byId(state, 0)).toMatchObject({ pos: P(2, 0) });
    expect(byId(state, 1)).toMatchObject({ cargo: [], hasActed: true });
    expect(events).toEqual([{ type: "unitUnloaded", unitId: 0, transportId: 1, pos: P(2, 0) }]);
  });

  it("the passenger can't act on the turn it's unloaded", () => {
    const state = run(loaded(), unload(1, 0, P(2, 0)));
    expect(apply(state, order(0, [], { type: "wait" }))).toMatchObject({ ok: false, code: "unitAlreadyActed" });
    expect(apply(run(state, endTurn, endTurn), order(0, [], { type: "wait" })).ok).toBe(true);
  });

  it("the Halftrack can move first", () => {
    const { state, events } = must(loaded(), unload(1, 0, P(3, 0), [P(2, 0)]));
    expect(byId(state, 1)?.pos).toEqual(P(2, 0));
    expect(byId(state, 0)?.pos).toEqual(P(3, 0));
    expect(events.map((e) => e.type)).toEqual(["unitMoved", "unitUnloaded"]);
  });

  it("the passenger can land on the tile the Halftrack just left", () => {
    expect(apply(loaded(), unload(1, 0, P(1, 0), [P(2, 0)])).ok).toBe(true);
  });

  it("a unit can board and be unloaded the same turn, if the Halftrack hasn't acted", () => {
    const state = makeGame(["==="], [u("infantry", 0, 0), u("halftrack", 0, 1)]);
    expect(apply(run(state, load(0, [P(1, 0)])), unload(1, 0, P(2, 0))).ok).toBe(true);
  });

  it("rejects tiles that aren't adjacent or are occupied", () => {
    expect(apply(loaded(), unload(1, 0, P(3, 0)))).toMatchObject({ ok: false, code: "cannotUnload" });
    const state = makeGame(["==="], [u("infantry", 0, 0), u("halftrack", 0, 1), u("mediumTank", 0, 2)]);
    expect(apply(run(state, load(0, [P(1, 0)])), unload(1, 0, P(2, 0)))).toMatchObject({ ok: false, code: "cannotUnload" });
  });

  it("rejects terrain the passenger couldn't enter", () => {
    const state = run(makeGame(["=S="], [u("halftrack", 0, 0), u("infantry", 0, 2)]));
    const halftrack = state.units[0] as Unit;
    const passenger = state.units[1] as Unit;
    expect(unloadTiles(state, { ...halftrack, pos: P(2, 0) }, passenger)).toEqual([]);
  });

  it("rejects a passenger who isn't aboard", () => {
    expect(apply(loaded(), unload(1, 7, P(2, 0)))).toMatchObject({ ok: false, code: "cannotUnload" });
  });

  it("rejects malformed unload actions from untyped code", () => {
    const bad = { type: "move", unitId: 1, path: [], action: { type: "unload", passenger: 0, to: "east" } } as unknown as Command;
    expect(apply(loaded(), bad)).toMatchObject({ ok: false, code: "invalidCommand" });
  });
});

describe("passengers and combat (05-supply-transport §4, 03-combat §6)", () => {
  it("passengers are destroyed with the transport, and only the transport counts as a kill", () => {
    const state = makeGame(["==="], [
      u("infantry", 0, 0),
      u("halftrack", 0, 1, 0, { hp: 10 }),
      u("mediumTank", 1, 2),
    ], { settings: { luck: false } });
    const after = run(state, load(0, [P(1, 0)]), endTurn, order(2, [], { type: "attack", target: 1 }));
    expect(after.units.map((x) => x.id)).toEqual([2]);
    expect(byId(after, 2)?.kills).toBe(1);
  });

  it("passengers can't be targeted", () => {
    const state = makeGame(["==="], [u("infantry", 0, 0), u("halftrack", 0, 1), u("mediumTank", 1, 2)]);
    const after = run(state, load(0, [P(1, 0)]), endTurn);
    expect(apply(after, order(2, [], { type: "attack", target: 0 }))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("passengers aren't repaired or resupplied by a property", () => {
    const state = makeGame(["==C"], [u("infantry", 0, 0, 0, { hp: 50, fuel: 10 }), u("halftrack", 0, 2)], {
      propertyOwners: [{ pos: P(2, 0), owner: 0 }],
    });
    const after = run(state, load(0, [P(1, 0), P(2, 0)]), endTurn, endTurn);
    expect(byId(after, 1)?.cargo[0]).toMatchObject({ hp: 50, fuel: 8 });
  });

  it("the unit cap counts passengers", () => {
    const state = makeGame(["=f"], [u("infantry", 0, 0, 0)], {
      players: [{ name: "A", nation: "us", funds: 5000 }, { name: "B", nation: "germany" }],
      propertyOwners: [{ pos: P(1, 0), owner: 0 }],
      settings: { unitCap: 1 },
    });
    expect(apply(state, { type: "build", unitType: "infantry", pos: P(1, 0) })).toMatchObject({ ok: false, code: "cannotBuild" });
  });
});

describe("Halftrack supply (05-supply-transport §3)", () => {
  // The Halftrack starts out of reach and drives up: adjacent units are refilled automatically
  // at the start of its owner's turn, including day 1.
  const game = (extra: Partial<UnitSetup> = { ammo: 1, fuel: 5 }) =>
    makeGame(["====", "===="], [u("halftrack", 0, 0), u("mediumTank", 0, 2, 0, extra), u("mediumTank", 1, 1, 1, { ammo: 1 })]);
  const driveUp = (unitId = 0) => supply(unitId, [P(1, 0)]);

  it("the Supply action refills adjacent friendly units, ending the Halftrack's action", () => {
    const { state, events } = must(game(), driveUp());
    expect(byId(state, 1)).toMatchObject({ ammo: 9, fuel: 70 });
    expect(byId(state, 0)).toMatchObject({ pos: P(1, 0), hasActed: true });
    expect(events.map((e) => e.type)).toEqual(["unitMoved", "unitResupplied"]);
  });

  it("doesn't supply enemies or heal anyone", () => {
    const state = run(game({ ammo: 1, hp: 50 }), driveUp());
    expect(byId(state, 1)).toMatchObject({ ammo: 9, hp: 50 });
    expect(byId(state, 2)?.ammo).toBe(1);
  });

  it("is refused when nobody adjacent needs it, and other units can't supply", () => {
    expect(apply(game({}), driveUp())).toMatchObject({ ok: false, code: "cannotSupply" });
    expect(apply(game(), supply(1))).toMatchObject({ ok: false, code: "cannotSupply" });
  });

  it("happens automatically at the start of the owner's turn", () => {
    const state = makeGame(["==="], [u("halftrack", 1, 1), u("mediumTank", 1, 2, 0, { ammo: 1, fuel: 5 })]);
    const { state: after, events } = must(state, endTurn);
    expect(byId(after, 1)).toMatchObject({ ammo: 9, fuel: 70 });
    expect(events).toContainEqual({ type: "unitResupplied", unitId: 1 });
  });

  it("automatic supply runs after property repair, and costs nothing", () => {
    const state = makeGame(["=C="], [u("halftrack", 1, 0), u("mediumTank", 1, 1, 0, { ammo: 1, hp: 50 })], {
      players: [{ name: "A", nation: "us" }, { name: "B", nation: "germany", funds: 0 }],
      settings: { incomePerProperty: 0 },
    });
    const { events } = must(state, endTurn);
    expect(events.map((e) => e.type)).toEqual(["turnEnded", "turnStarted", "unitResupplied"]);
  });

  it("doesn't reach diagonal units", () => {
    const state = makeGame(["==", "=="], [u("halftrack", 0, 0), u("mediumTank", 0, 1, 1, { ammo: 1 })]);
    expect(supplyTargets(state, state.units[0] as Unit)).toEqual([]);
  });
});

describe("joining units (04-economy §6, 03-combat §6)", () => {
  const pair = (a: Partial<UnitSetup>, b: Partial<UnitSetup>, funds = 0) => makeGame(["=="], [
    { type: "mediumTank", owner: 0, pos: P(0, 0), ...a },
    { type: "mediumTank", owner: 0, pos: P(1, 0), ...b },
  ], {
    players: [{ name: "A", nation: "us", funds }, { name: "B", nation: "germany" }],
    settings: { incomePerProperty: 0 },
  });
  const merge = (state: GameState) => must(state, join(0, [P(1, 0)]));

  it("adds displayed HP and leaves one unit, which has acted", () => {
    const { state, events } = merge(pair({ hp: 30 }, { hp: 40 }));
    expect(state.units.map((x) => x.id)).toEqual([1]);
    expect(byId(state, 1)).toMatchObject({ hp: 70, hasActed: true });
    expect(events).toContainEqual({ type: "unitJoined", unitId: 0, targetId: 1, hp: 70, refund: 0 });
  });

  it("caps at 10 HP and refunds the excess at 10% of the unit's cost per HP", () => {
    const { state } = merge(pair({ hp: 80 }, { hp: 50 }));
    expect(byId(state, 1)?.hp).toBe(100);
    expect(state.players[0]?.funds).toBe(3 * 800);
  });

  it("adds fuel and ammo, capped at the maximum", () => {
    expect(byId(merge(pair({ fuel: 20, ammo: 2 }, { fuel: 30, ammo: 3, hp: 50 })).state, 1)).toMatchObject({ fuel: 49, ammo: 5 });
    expect(byId(merge(pair({ fuel: 60, ammo: 8 }, { fuel: 60, ammo: 8, hp: 50 })).state, 1)).toMatchObject({ fuel: 70, ammo: 9 });
  });

  it("Elite at 7 HP + Rookie at 3 HP gives an Elite at 10 HP", () => {
    expect(byId(merge(pair({ hp: 70, kills: 9 }, { hp: 30, kills: 0 })).state, 1)).toMatchObject({ hp: 100, kills: 9 });
  });

  it("Elite at 3 HP + Rookie at 8 HP gives a Rookie at 10 HP", () => {
    expect(byId(merge(pair({ hp: 30, kills: 9 }, { hp: 80, kills: 0 })).state, 1)).toMatchObject({ hp: 100, kills: 0 });
  });

  it("on a tie in HP, it keeps the higher kill count", () => {
    expect(byId(merge(pair({ hp: 50, kills: 1 }, { hp: 50, kills: 4 })).state, 1)?.kills).toBe(4);
    expect(byId(merge(pair({ hp: 50, kills: 4 }, { hp: 50, kills: 1 })).state, 1)?.kills).toBe(4);
  });

  it("can't join a unit at full strength, of another type, or another player's", () => {
    expect(apply(pair({}, { hp: 100 }), join(0, [P(1, 0)]))).toMatchObject({ ok: false, code: "cannotJoin" });
    expect(apply(pair({}, { hp: 91 }), join(0, [P(1, 0)]))).toMatchObject({ ok: false, code: "cannotJoin" }); // shows 10 HP
    expect(apply(pair({}, { type: "lightTank", hp: 50 }), join(0, [P(1, 0)]))).toMatchObject({ ok: false, code: "cannotJoin" });
  });

  it("a Join order must actually move onto the unit", () => {
    expect(apply(pair({}, { hp: 50 }), join(0, []))).toMatchObject({ ok: false, code: "cannotJoin" });
  });

  it("a transport carrying units can't join or be joined", () => {
    const state = makeGame(["==="], [u("infantry", 0, 0), u("halftrack", 0, 1, 0, { hp: 50 }), u("halftrack", 0, 2)]);
    const loaded = run(state, load(0, [P(1, 0)]));
    const [carrier, empty] = [byId(loaded, 1) as Unit, byId(loaded, 2) as Unit];
    expect(joinProblem(empty, carrier)).toMatch(/carrying/);
    expect(joinProblem(carrier, { ...empty, hp: 50 })).toMatch(/carrying/);
  });

  it("joining a unit that's capturing keeps its progress (04-economy §3)", () => {
    const state = makeGame(["C="], [u("infantry", 0, 0, 0, { hp: 50 }), u("infantry", 0, 1, 0, { hp: 50 })]);
    const started = run(state, order(0, [], { type: "capture" }), order(1, [], { type: "wait" }), endTurn, endTurn);
    const after = must(started, order(1, [P(0, 0)], { type: "join" })).state;
    expect(propertyAt(after, P(0, 0))).toMatchObject({ capturePoints: 15, capturingUnit: 0 });
  });

  it("a unit leaving a capture to join elsewhere loses that progress", () => {
    const state = makeGame(["C="], [u("infantry", 0, 0, 0, { hp: 50 }), u("infantry", 0, 1, 0, { hp: 50 })]);
    const after = run(state, order(0, [], { type: "capture" }), endTurn, endTurn, join(0, [P(1, 0)]));
    expect(propertyAt(after, P(0, 0))).toMatchObject({ capturePoints: CAPTURE_POINTS, capturingUnit: null });
  });
});
