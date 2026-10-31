import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import { attackTargets } from "../src/engine/combat";
import type { Command, GameEvent } from "../src/engine/commands";
import { UNITS } from "../src/engine/data/units";
import { buildOptions, buildProblem, captureProblem } from "../src/engine/economy";
import type { Point } from "../src/engine/map";
import { canEndOn, reachableTiles, cheapestPath } from "../src/engine/movement";
import { createGame, type UnitSetup } from "../src/engine/setup";
import { parseAsciiMap } from "../src/engine/map";
import { CAPTURE_POINTS, MAX_HP, propertyAt, type GameState } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { joinProblem, loadProblem, supplyTargets, unloadTiles } from "../src/engine/transport";
import { deepFreeze, makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const capture = (unitId: number, path: Point[] = []): Command => ({ type: "move", unitId, path, action: { type: "capture" } });
const wait = (unitId: number, path: Point[] = []): Command => ({ type: "move", unitId, path, action: { type: "wait" } });
const attack = (unitId: number, target: number, path: Point[] = []): Command => ({ type: "move", unitId, path, action: { type: "attack", target } });
const build = (unitType: Extract<Command, { type: "build" }>["unitType"], pos: Point): Command => ({ type: "build", unitType, pos });

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}
const run = (state: GameState, ...commands: Command[]) => commands.reduce((s, c) => must(s, c).state, state);
const funds = (state: GameState, player: number) => state.players[player]?.funds;
const eventsOf = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe("income (04-economy §1–2)", () => {
  const game = () => makeGame(["CfQ.CC"], [], {
    propertyOwners: [
      { pos: P(0, 0), owner: 0 },
      { pos: P(1, 0), owner: 0 },
      { pos: P(2, 0), owner: 0 },
      { pos: P(4, 0), owner: 1 },
    ],
  });

  it("the first player collects 1,000 per property at the start of day 1", () => {
    expect(funds(game(), 0)).toBe(3000);
  });

  it("the other player hasn't collected until their own turn starts", () => {
    const state = game();
    expect(funds(state, 1)).toBe(0);
    expect(funds(run(state, endTurn), 1)).toBe(1000);
  });

  it("income arrives each turn and adds up", () => {
    expect(funds(run(game(), endTurn, endTurn), 0)).toBe(6000);
  });

  it("neutral and enemy properties pay nothing", () => {
    const { events } = must(game(), endTurn);
    expect(eventsOf(events, "incomeReceived")).toEqual([{ type: "incomeReceived", player: 1, amount: 1000, funds: 1000 }]);
  });

  it("a player with no properties gets no income event", () => {
    const state = makeGame(["."]);
    expect(eventsOf(must(state, endTurn).events, "incomeReceived")).toEqual([]);
  });

  it("income per property is a scenario setting", () => {
    const state = makeGame(["C"], [], { propertyOwners: [{ pos: P(0, 0), owner: 0 }], settings: { incomePerProperty: 2500 } });
    expect(funds(state, 0)).toBe(2500);
  });

  it("income goes through the modifier layer", () => {
    const state = makeGame(["C"], [], {
      propertyOwners: [{ pos: P(0, 0), owner: 0 }],
      modifiers: [{ source: "co", stat: "income", op: "multiply", value: 1.5, scope: { players: [0] } }],
    });
    expect(funds(state, 0)).toBe(1500);
  });
});

describe("capture (04-economy §3)", () => {
  const onCity = (unit: Partial<UnitSetup> & { type: UnitSetup["type"] } = { type: "infantry" }) =>
    makeGame(["C.."], [{ owner: 0, pos: P(0, 0), ...unit }]);

  it("subtracts the unit's displayed HP from the capture points", () => {
    const { state, events } = must(onCity(), capture(0));
    expect(propertyAt(state, P(0, 0))).toMatchObject({ capturePoints: 10, owner: null, capturingUnit: 0 });
    expect(events).toEqual([{ type: "captureProgress", pos: P(0, 0), unitId: 0, capturePoints: 10 }]);
  });

  it("a full-HP Infantry captures in 2 turns", () => {
    const after = run(onCity(), capture(0), endTurn, endTurn, capture(0));
    expect(propertyAt(after, P(0, 0))).toEqual({ pos: P(0, 0), owner: 0, capturePoints: CAPTURE_POINTS, capturingUnit: null });
  });

  it("a damaged unit takes longer: 5 HP needs 4 turns", () => {
    let state = onCity({ type: "infantry", hp: 50 });
    for (let turn = 0; turn < 3; turn++) state = run(state, capture(0), endTurn, endTurn);
    expect(propertyAt(state, P(0, 0))).toMatchObject({ owner: null, capturePoints: 5 });
    expect(propertyAt(run(state, capture(0)), P(0, 0))?.owner).toBe(0);
  });

  it("uses displayed HP, rounded up: 41 internal HP counts as 5", () => {
    expect(propertyAt(run(onCity({ type: "infantry", hp: 41 }), capture(0)), P(0, 0))?.capturePoints).toBe(15);
  });

  it("the unit can move onto the property and capture in the same turn", () => {
    const state = makeGame([".C."], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    const { state: after, events } = must(state, capture(0, [P(1, 0)]));
    expect(events.map((e) => e.type)).toEqual(["unitMoved", "captureProgress"]);
    expect(after.units[0]).toMatchObject({ pos: P(1, 0), hasActed: true });
  });

  it("the capture event names the previous owner", () => {
    const state = makeGame(["C"], [{ type: "infantry", owner: 0, pos: P(0, 0), hp: 100 }], {
      propertyOwners: [{ pos: P(0, 0), owner: 1 }],
    });
    const after = run(state, capture(0), endTurn, endTurn);
    expect(must(after, capture(0)).events).toEqual([
      { type: "propertyCaptured", pos: P(0, 0), unitId: 0, player: 0, previousOwner: 1 },
    ]);
  });

  it("Assault Infantry can capture; vehicles and Mortar Teams can't", () => {
    expect(apply(onCity({ type: "assaultInfantry" }), capture(0)).ok).toBe(true);
    expect(apply(onCity({ type: "mediumTank" }), capture(0))).toMatchObject({ ok: false, code: "cannotCapture" });
    expect(apply(onCity({ type: "mortar" }), capture(0))).toMatchObject({ ok: false, code: "cannotCapture" });
  });

  it("can't capture a non-property or your own side's property", () => {
    expect(apply(makeGame(["."], [{ type: "infantry", owner: 0, pos: P(0, 0) }]), capture(0)))
      .toMatchObject({ ok: false, code: "cannotCapture" });
    const own = makeGame(["C"], [{ type: "infantry", owner: 0, pos: P(0, 0) }], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    expect(apply(own, capture(0))).toMatchObject({ ok: false, code: "cannotCapture" });
  });

  it("progress stays across turns while the unit stays, even if it just waits", () => {
    const state = run(onCity(), capture(0), endTurn, endTurn, wait(0), endTurn, endTurn);
    expect(propertyAt(state, P(0, 0))?.capturePoints).toBe(10);
  });

  it("progress resets when the capturing unit leaves", () => {
    const state = run(onCity(), capture(0), endTurn, endTurn, wait(0, [P(1, 0)]));
    expect(propertyAt(state, P(0, 0))).toMatchObject({ capturePoints: CAPTURE_POINTS, capturingUnit: null });
  });

  it("progress resets when the capturing unit is destroyed", () => {
    const state = makeGame(["C="], [
      { type: "infantry", owner: 0, pos: P(0, 0), hp: 10 },
      { type: "heavyTank", owner: 1, pos: P(1, 0) },
    ]);
    const after = run(state, capture(0), endTurn, attack(1, 0));
    expect(after.units.map((u) => u.id)).toEqual([1]);
    expect(propertyAt(after, P(0, 0))).toMatchObject({ capturePoints: CAPTURE_POINTS, capturingUnit: null });
  });

  it("a captured property pays its new owner next turn", () => {
    const state = run(onCity(), capture(0), endTurn, endTurn, capture(0), endTurn, endTurn);
    expect(funds(state, 0)).toBe(1000);
  });
});

describe("build (04-economy §4)", () => {
  const factory = (playerFunds = 10_000, extra: UnitSetup[] = []) => makeGame(["fCA."], extra, {
    players: [{ name: "A", nation: "us", funds: playerFunds }, { name: "B", nation: "germany" }],
    propertyOwners: [
      { pos: P(0, 0), owner: 0 },
      { pos: P(1, 0), owner: 0 },
      { pos: P(2, 0), owner: 0 },
    ],
    settings: { incomePerProperty: 0 },
  });

  it("creates a full-strength rookie and charges its cost", () => {
    const { state, events } = must(factory(), build("mediumTank", P(0, 0)));
    expect(state.units[0]).toMatchObject({ type: "mediumTank", owner: 0, pos: P(0, 0), hp: 100, fuel: 70, ammo: 9, kills: 0 });
    expect(funds(state, 0)).toBe(2000);
    expect(events).toEqual([{ type: "unitBuilt", unitId: 0, unitType: "mediumTank", owner: 0, pos: P(0, 0), cost: 8000 }]);
  });

  it("the new unit can't act until its owner's next turn", () => {
    const state = run(factory(), build("infantry", P(0, 0)));
    expect(apply(state, wait(0))).toMatchObject({ ok: false, code: "unitAlreadyActed" });
    expect(apply(run(state, endTurn, endTurn), wait(0)).ok).toBe(true);
  });

  it("each new unit gets a fresh id", () => {
    const state = run(factory(20_000, [{ type: "infantry", owner: 1, pos: P(3, 0) }]), build("infantry", P(0, 0)));
    expect(state.units.map((u) => u.id)).toEqual([0, 1]);
    expect(state.nextUnitId).toBe(2);
  });

  it("rejects builds the player can't afford", () => {
    expect(apply(factory(7999), build("mediumTank", P(0, 0)))).toMatchObject({ ok: false, code: "cannotBuild" });
    expect(apply(factory(8000), build("mediumTank", P(0, 0))).ok).toBe(true);
  });

  it("rejects building on an occupied factory", () => {
    const state = factory(10_000, [{ type: "infantry", owner: 1, pos: P(0, 0) }]);
    expect(apply(state, build("infantry", P(0, 0)))).toMatchObject({ ok: false, code: "cannotBuild" });
  });

  it("rejects building where nothing is built, or on someone else's property", () => {
    expect(apply(factory(), build("infantry", P(1, 0)))).toMatchObject({ ok: false, code: "cannotBuild" });
    expect(apply(factory(), build("infantry", P(3, 0)))).toMatchObject({ ok: false, code: "cannotBuild" });
    const enemy = makeGame(["f"], [], { propertyOwners: [{ pos: P(0, 0), owner: 1 }], players: [{ name: "A", nation: "us", funds: 9000 }, { name: "B", nation: "germany" }] });
    expect(apply(enemy, build("infantry", P(0, 0)))).toMatchObject({ ok: false, code: "cannotBuild" });
  });

  it("factories build land units and airfields build air units", () => {
    const state = makeGame(["fA"], [], {
      players: [{ name: "A", nation: "us", funds: 50_000, buildable: ["infantry", "fighter"] }, { name: "B", nation: "germany" }],
      propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(1, 0), owner: 0 }],
    });
    expect(apply(state, build("fighter", P(0, 0)))).toMatchObject({ ok: false, code: "cannotBuild" });
    expect(apply(state, build("infantry", P(1, 0)))).toMatchObject({ ok: false, code: "cannotBuild" });
    expect(apply(state, build("fighter", P(1, 0))).ok).toBe(true);
  });

  it("scenarios limit what a nation can build, e.g. no US Heavy Tank (01-units §1)", () => {
    const state = makeGame(["f"], [], {
      players: [{ name: "A", nation: "us", funds: 50_000, buildable: ["mediumTank"] }, { name: "B", nation: "germany" }],
      propertyOwners: [{ pos: P(0, 0), owner: 0 }],
    });
    expect(apply(state, build("heavyTank", P(0, 0)))).toMatchObject({ ok: false, code: "cannotBuild" });
    expect(apply(state, build("mediumTank", P(0, 0))).ok).toBe(true);
  });

  it("by default players can only build units from the phases in play", () => {
    expect(buildProblem(factory(50_000), "flakGun", P(0, 0))).toMatch(/available/);
  });

  it("a scenario's unit cap stops further builds", () => {
    const state = makeGame([".f"], [{ type: "infantry", owner: 0, pos: P(0, 0) }], {
      players: [{ name: "A", nation: "us", funds: 5000 }, { name: "B", nation: "germany" }],
      propertyOwners: [{ pos: P(1, 0), owner: 0 }],
      settings: { unitCap: 1 },
    });
    expect(apply(state, build("infantry", P(1, 0)))).toMatchObject({ ok: false, code: "cannotBuild" });
  });

  it("cost modifiers change what building charges", () => {
    const state = makeGame(["f"], [], {
      players: [{ name: "A", nation: "us", funds: 1000 }, { name: "B", nation: "germany" }],
      propertyOwners: [{ pos: P(0, 0), owner: 0 }],
      modifiers: [{ source: "co", stat: "cost", op: "multiply", value: 0.8 }],
      settings: { incomePerProperty: 0 },
    });
    expect(funds(run(state, build("infantry", P(0, 0))), 0)).toBe(200);
  });

  it("rejects malformed build commands from untyped code", () => {
    const bad = (command: unknown) => apply(factory(), command as Command);
    expect(bad({ type: "build", unitType: "toString", pos: P(0, 0) })).toMatchObject({ ok: false, code: "invalidCommand" });
    expect(bad({ type: "build", unitType: "infantry", pos: "here" })).toMatchObject({ ok: false, code: "invalidCommand" });
    expect(bad({ type: "build", unitType: "infantry", pos: P(99, 0) })).toMatchObject({ ok: false, code: "invalidCommand" });
  });

  it("the build menu lists what can be built here, cheapest first, marking what's too expensive", () => {
    const options = buildOptions(factory(4000), P(0, 0));
    expect(options[0]).toEqual({ type: "infantry", cost: 1000, affordable: true });
    expect(options.find((o) => o.type === "mediumTank")).toEqual({ type: "mediumTank", cost: 8000, affordable: false });
    expect(options.map((o) => o.cost)).toEqual([...options.map((o) => o.cost)].sort((a, b) => a - b));
    expect(options).toHaveLength(12);
  });

  it("the build menu is empty where nothing can be built", () => {
    expect(buildOptions(factory(), P(1, 0))).toEqual([]);
    expect(buildOptions(factory(), P(3, 0))).toEqual([]);
    expect(buildOptions(factory(10_000, [{ type: "infantry", owner: 0, pos: P(0, 0) }]), P(0, 0))).toEqual([]);
  });

  it("everything the menu marks affordable is accepted by the engine", () => {
    const state = factory(9000);
    for (const option of buildOptions(state, P(0, 0))) {
      expect(apply(state, build(option.type, P(0, 0))).ok, option.type).toBe(option.affordable);
    }
  });
});

describe("repair and resupply (04-economy §5)", () => {
  /** Damaged unit of player 1 on player 1's property; the turn then passes to player 1. */
  const repairing = (
    terrain: string,
    unit: Partial<UnitSetup> & { type: UnitSetup["type"] },
    playerFunds: number,
    owner: number | null = 1,
  ) => {
    const state = makeGame([terrain], [{ owner: 1, pos: P(0, 0), ...unit }], {
      players: [{ name: "A", nation: "us" }, { name: "B", nation: "germany", funds: playerFunds }],
      ...(owner === null ? {} : { propertyOwners: [{ pos: P(0, 0), owner }] }),
      settings: { incomePerProperty: 0 },
    });
    return must(state, endTurn);
  };

  it("heals 2 displayed HP for 20% of the unit's cost", () => {
    const { state, events } = repairing("C", { type: "mediumTank", hp: 50 }, 5000);
    expect(state.units[0]?.hp).toBe(70);
    expect(funds(state, 1)).toBe(5000 - 1600);
    expect(eventsOf(events, "unitRepaired")).toEqual([{ type: "unitRepaired", unitId: 0, hp: 2, cost: 1600 }]);
  });

  it("caps at 10 HP, charging only for what's healed", () => {
    const { state } = repairing("C", { type: "mediumTank", hp: 90 }, 5000);
    expect(state.units[0]?.hp).toBe(100);
    expect(funds(state, 1)).toBe(5000 - 800);
  });

  it("a unit showing 10 HP isn't repaired or charged", () => {
    const { state, events } = repairing("C", { type: "mediumTank", hp: 95 }, 5000);
    expect(state.units[0]?.hp).toBe(95);
    expect(funds(state, 1)).toBe(5000);
    expect(eventsOf(events, "unitRepaired")).toEqual([]);
  });

  it("heals only 1 HP if 2 isn't affordable", () => {
    const { state } = repairing("C", { type: "mediumTank", hp: 50 }, 1000);
    expect(state.units[0]?.hp).toBe(60);
    expect(funds(state, 1)).toBe(200);
  });

  it("no funds means no healing, but fuel and ammo are still free", () => {
    const { state, events } = repairing("C", { type: "mediumTank", hp: 50, fuel: 3, ammo: 1 }, 0);
    expect(state.units[0]).toMatchObject({ hp: 50, fuel: 70, ammo: 9 });
    expect(eventsOf(events, "unitRepaired")).toEqual([]);
    expect(eventsOf(events, "unitResupplied")).toEqual([{ type: "unitResupplied", unitId: 0 }]);
  });

  it("a full-HP unit is still resupplied", () => {
    const { state } = repairing("C", { type: "mediumTank", fuel: 10 }, 0);
    expect(state.units[0]?.fuel).toBe(70);
  });

  it("nothing happens on neutral or enemy properties, or open ground", () => {
    expect(repairing("C", { type: "mediumTank", hp: 50, fuel: 3 }, 5000, null).state.units[0]).toMatchObject({ hp: 50, fuel: 3 });
    expect(repairing("C", { type: "mediumTank", hp: 50, fuel: 3 }, 5000, 0).state.units[0]).toMatchObject({ hp: 50, fuel: 3 });
    expect(repairing(".", { type: "mediumTank", hp: 50, fuel: 3 }, 5000, null).state.units[0]).toMatchObject({ hp: 50, fuel: 3 });
  });

  it("land units aren't repaired on airfields", () => {
    expect(repairing("A", { type: "mediumTank", hp: 50, fuel: 3 }, 5000).state.units[0]).toMatchObject({ hp: 50, fuel: 3 });
  });

  it("factories and the HQ repair land units too", () => {
    expect(repairing("f", { type: "infantry", hp: 50 }, 5000).state.units[0]?.hp).toBe(70);
    expect(repairing("Q", { type: "infantry", hp: 50 }, 5000).state.units[0]?.hp).toBe(70);
  });

  it("the turn's income can pay for repairs", () => {
    const state = makeGame(["C"], [{ type: "infantry", owner: 1, pos: P(0, 0), hp: 50 }], {
      propertyOwners: [{ pos: P(0, 0), owner: 1 }],
    });
    const after = must(state, endTurn).state;
    expect(after.units[0]?.hp).toBe(70);
    expect(funds(after, 1)).toBe(1000 - 200);
  });

  it("repairs run in row-major order, so short funds always run out the same way", () => {
    const state = makeGame(["..C", "C.."], [
      { type: "infantry", owner: 1, pos: P(0, 1), hp: 50 }, // listed first, but on the lower row
      { type: "infantry", owner: 1, pos: P(2, 0), hp: 50 },
    ], {
      players: [{ name: "A", nation: "us" }, { name: "B", nation: "germany", funds: 200 }],
      propertyOwners: [{ pos: P(2, 0), owner: 1 }, { pos: P(0, 1), owner: 1 }],
      settings: { incomePerProperty: 0 },
    });
    const after = must(state, endTurn).state;
    expect(after.units.map((u) => u.hp)).toEqual([50, 70]);
    expect(funds(after, 1)).toBe(0);
  });

  it("repairing doesn't touch veterancy", () => {
    expect(repairing("C", { type: "infantry", hp: 50, kills: 4 }, 5000).state.units[0]?.kills).toBe(4);
  });
});

describe("random playthroughs", () => {
  /** Every legal command for the current player: a representative sample of what the UI can send. */
  function legalCommands(state: GameState): Command[] {
    const commands: Command[] = [endTurn];
    for (const unit of state.units) {
      if (unit.owner !== state.currentPlayer || unit.hasActed) continue;
      const reach = reachableTiles(state, unit);
      for (const i of reach.keys()) {
        const dest = P(i % state.map.width, Math.floor(i / state.map.width));
        const path = cheapestPath(state, reach, dest) ?? [];
        const moved = { ...unit, pos: dest };
        if (!canEndOn(state, unit, dest)) {
          const host = state.units.find((u) => u.pos.x === dest.x && u.pos.y === dest.y);
          if (host && loadProblem(moved, host) === null) commands.push({ type: "move", unitId: unit.id, path, action: { type: "load" } });
          if (host && joinProblem(moved, host) === null) commands.push({ type: "move", unitId: unit.id, path, action: { type: "join" } });
          continue;
        }
        const afterMove = { ...state, units: state.units.map((u) => (u.id === unit.id ? moved : u)) };
        if (supplyTargets(afterMove, moved).length > 0) commands.push({ type: "move", unitId: unit.id, path, action: { type: "supply" } });
        for (const passenger of moved.cargo) {
          for (const to of unloadTiles(afterMove, moved, passenger)) {
            commands.push({ type: "move", unitId: unit.id, path, action: { type: "unload", passenger: passenger.id, to } });
          }
        }
        commands.push(wait(unit.id, path));
        if (captureProblem(state, moved) === null) commands.push(capture(unit.id, path));
        for (const target of attackTargets(state, moved, path.length > 0)) commands.push(attack(unit.id, target.id, path));
      }
    }
    for (const property of state.properties) {
      for (const option of buildOptions(state, property.pos)) {
        if (option.affordable) commands.push(build(option.type, property.pos));
      }
    }
    return commands;
  }

  const MAP = parseAsciiMap(["f.C.F.=.C", ".F..b..C.", "C..H.=.F.", ".=.C..F.f"]);
  const start = (seed: number) => createGame({
    map: MAP,
    players: [{ name: "A", nation: "us", funds: 6000 }, { name: "B", nation: "germany", funds: 6000 }],
    propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(8, 3), owner: 1 }],
    units: [
      { type: "infantry", owner: 0, pos: P(1, 0) },
      { type: "mediumTank", owner: 0, pos: P(0, 1) },
      { type: "artillery", owner: 0, pos: P(1, 1) },
      { type: "halftrack", owner: 0, pos: P(2, 1) },
      { type: "infantry", owner: 0, pos: P(2, 0), hp: 60 },
      { type: "infantry", owner: 1, pos: P(7, 3) },
      { type: "infantry", owner: 1, pos: P(6, 3), hp: 40 },
      { type: "halftrack", owner: 1, pos: P(6, 2) },
      { type: "lightTank", owner: 1, pos: P(8, 2) },
      { type: "recon", owner: 1, pos: P(7, 2) },
    ],
    seed,
  });

  function checkInvariants(state: GameState): void {
    const tiles = new Set(state.units.map((u) => `${u.pos.x},${u.pos.y}`));
    expect(tiles.size, "two units on one tile").toBe(state.units.length);
    const everyone = state.units.flatMap((u) => [u, ...u.cargo]);
    expect(new Set(everyone.map((u) => u.id)).size, "duplicate unit ids").toBe(everyone.length);
    for (const unit of state.units) {
      expect(unit.cargo.length, "over capacity").toBeLessThanOrEqual(UNITS[unit.type].transport?.capacity ?? 0);
    }
    for (const player of state.players) {
      expect(player.funds).toBeGreaterThanOrEqual(0);
      expect(Number.isInteger(player.funds)).toBe(true);
    }
    for (const unit of state.units) {
      expect(unit.hp).toBeGreaterThan(0);
      expect(unit.hp).toBeLessThanOrEqual(MAX_HP);
      expect(Number.isInteger(unit.hp)).toBe(true);
      expect(unit.fuel).toBeGreaterThanOrEqual(0);
      expect(unit.fuel).toBeLessThanOrEqual(stats.maxFuel(state, unit));
      expect(unit.ammo).toBeGreaterThanOrEqual(0);
      expect(unit.ammo).toBeLessThanOrEqual(stats.maxAmmo(state, unit));
      expect(unit.id).toBeLessThan(state.nextUnitId);
    }
    for (const property of state.properties) {
      expect(property.capturePoints).toBeGreaterThan(0);
      expect(property.capturePoints).toBeLessThanOrEqual(CAPTURE_POINTS);
      if (property.capturingUnit === null) {
        expect(property.capturePoints).toBe(CAPTURE_POINTS);
      } else {
        const unit = state.units.find((u) => u.id === property.capturingUnit);
        expect(unit?.pos).toEqual(property.pos);
      }
    }
  }

  const playthrough = fc.record({
    seed: fc.integer(),
    choices: fc.array(fc.nat(), { minLength: 40, maxLength: 120 }),
  });

  it("every legal command is accepted and the game never reaches an impossible state", () => {
    fc.assert(fc.property(playthrough, ({ seed, choices }) => {
      let state = start(seed);
      for (const choice of choices) {
        if (state.result) break;
        const commands = legalCommands(state);
        const command = commands[choice % commands.length];
        if (!command) throw new Error("no command");
        state = must(state, command).state;
        checkInvariants(state);
      }
    }), { numRuns: 15 });
  });

  it("a recorded game replays to exactly the same state, and survives saving as JSON", () => {
    fc.assert(fc.property(playthrough, ({ seed, choices }) => {
      let state = deepFreeze(start(seed));
      const log: Command[] = [];
      for (const choice of choices) {
        if (state.result) break;
        const commands = legalCommands(state);
        const command = commands[choice % commands.length];
        if (!command) throw new Error("no command");
        log.push(command);
        state = deepFreeze(must(state, command).state);
      }
      expect(log.reduce((s, c) => must(s, c).state, start(seed))).toEqual(state);
      expect(JSON.parse(JSON.stringify(state))).toEqual(state);
    }), { numRuns: 10 });
  });

  it("random play really does reach combat, captures, builds, repairs, transport and joining", () => {
    const seen = new Set<string>();
    for (let seed = 0; seed < 12; seed++) {
      let state = start(seed);
      let dice = seed + 1;
      for (let step = 0; step < 300 && !state.result; step++) {
        const commands = legalCommands(state);
        dice = (dice * 48271) % 2147483647; // simple repeatable dice, independent of the game's RNG
        const command = commands[dice % commands.length];
        if (!command) throw new Error("no command");
        const result = must(state, command);
        state = result.state;
        for (const event of result.events) seen.add(event.type);
      }
    }
    for (const type of [
      "combat", "captureProgress", "propertyCaptured", "unitBuilt", "unitRepaired", "incomeReceived",
      "unitLoaded", "unitUnloaded", "unitJoined", "unitResupplied",
    ]) {
      expect(seen, type).toContain(type);
    }
  });
});
