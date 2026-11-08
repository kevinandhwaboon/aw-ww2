import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import { attackTargets } from "../src/engine/combat";
import type { Command, GameEvent, UnitAction } from "../src/engine/commands";
import { UNITS } from "../src/engine/data/units";
import { buildOptions } from "../src/engine/economy";
import type { Point } from "../src/engine/map";
import { moveDestinations } from "../src/engine/movement";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState, Unit } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const order = (unitId: number, path: Point[], action: UnitAction): Command => ({ type: "move", unitId, path, action });
const wait = (unitId: number, path: Point[] = []) => order(unitId, path, { type: "wait" });
const attack = (unitId: number, target: number, path: Point[] = []) => order(unitId, path, { type: "attack", target });

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}
const run = (state: GameState, ...commands: Command[]) => commands.reduce((s, c) => must(s, c).state, state);
/** Passes the turn back to player 0: the point where their daily fuel burns. */
const nextRound = (state: GameState) => must(must(state, endTurn).state, endTurn);
const byId = (state: GameState, id: number): Unit | undefined => state.units.find((u) => u.id === id);

const u = (type: UnitSetup["type"], owner: number, x: number, extra: Partial<UnitSetup> = {}): UnitSetup =>
  ({ type, owner, pos: P(x, 0), ...extra });

describe("flying (05-supply-transport §5)", () => {
  it("aircraft pay 1 per tile over any terrain, including sea, hills and obstacles", () => {
    const state = makeGame(["=SHo~b.=="], [u("fighter", 0, 0)]);
    const reach = moveDestinations(state, state.units[0] as Unit).map((p) => p.x);
    expect(reach).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8]);
  });

  it("flying over the sea spends fuel like any other move", () => {
    const state = makeGame(["=SS="], [u("bomber", 0, 0)]);
    expect(byId(run(state, wait(0, [P(1, 0), P(2, 0), P(3, 0)])), 0)?.fuel).toBe(96);
  });

  it("an aircraft can end its move over the sea", () => {
    const state = makeGame(["=S"], [u("fighter", 0, 0)]);
    expect(byId(run(state, wait(0, [P(1, 0)])), 0)?.pos).toEqual(P(1, 0));
  });

  it("aircraft fly over enemy ground units and ships, but can't stop on them (02-terrain §5)", () => {
    const state = makeGame(["==S="], [u("fighter", 0, 0), u("infantry", 1, 1), u("destroyer", 1, 2)]);
    const reach = moveDestinations(state, state.units[0] as Unit).map((p) => p.x);
    expect(reach).toEqual([0, 3]); // over the Infantry and the Destroyer, landing beyond them
  });

  it("an aircraft surrounded by enemy Infantry can still fly out (02-terrain §5)", () => {
    const state = makeGame(["...", "...", "..."], [
      { type: "fighter", owner: 0, pos: P(1, 1) },
      ...[P(1, 0), P(0, 1), P(2, 1), P(1, 2)].map((pos) => ({ type: "infantry" as const, owner: 1, pos })),
    ]);
    expect(moveDestinations(state, state.units[0] as Unit)).toContainEqual(P(0, 0));
  });

  it("enemy aircraft still block aircraft", () => {
    const state = makeGame(["===="], [u("fighter", 0, 0), u("fighter", 1, 1)]);
    expect(moveDestinations(state, state.units[0] as Unit).map((p) => p.x)).toEqual([0]);
  });

  it("enemy aircraft still block ground units, as in the original", () => {
    const state = makeGame(["==="], [u("mediumTank", 0, 0), u("fighter", 1, 1)]);
    expect(moveDestinations(state, state.units[0] as Unit).map((p) => p.x)).toEqual([0]);
  });

  it("friendly units can be passed through, and there's one unit per tile (02-terrain §5)", () => {
    const friendly = makeGame(["==="], [u("fighter", 0, 0), u("infantry", 0, 1)]);
    expect(moveDestinations(friendly, friendly.units[0] as Unit).map((p) => p.x)).toEqual([0, 2]);
  });

  it("aircraft get no terrain defense (02-terrain §1)", () => {
    const state = makeGame(["H"], [u("fighter", 0, 0)]);
    expect(stats.terrainStars(state, state.units[0] as Unit)).toBe(0);
  });
});

describe("daily fuel (05-supply-transport §5, 04-economy §2)", () => {
  const fighter = (fuel: number, terrain = ".") => makeGame([terrain], [u("fighter", 0, 0, { fuel })]);

  it("aircraft burn fuel at the start of each of their owner's turns", () => {
    expect(byId(nextRound(fighter(50)).state, 0)?.fuel).toBe(45); // Fighter: 5 per turn
  });

  it("Transport Aircraft burn less than Fighters", () => {
    const state = makeGame(["."], [u("transportAircraft", 0, 0, { fuel: 50 })]);
    expect(byId(nextRound(state).state, 0)?.fuel).toBe(46);
  });

  it("nothing burns on day 1 (D1)", () => {
    expect(byId(fighter(50), 0)?.fuel).toBe(50);
    const axis = makeGame(["."], [u("fighter", 1, 0, { fuel: 50 })]);
    expect(byId(must(axis, endTurn).state, 0)?.fuel).toBe(50); // the second player's first turn
  });

  it("fuel doesn't burn during the other player's turn", () => {
    expect(byId(must(fighter(50), endTurn).state, 0)?.fuel).toBe(50);
  });

  it("land units burn nothing per day", () => {
    const state = makeGame(["."], [u("mediumTank", 0, 0, { fuel: 50 })]);
    expect(byId(nextRound(state).state, 0)?.fuel).toBe(50);
  });

  it("an aircraft that runs out crashes", () => {
    const { state, events } = nextRound(fighter(5));
    expect(state.units).toEqual([]);
    expect(events).toContainEqual({ type: "unitOutOfFuel", unitId: 0, unitType: "fighter", owner: 0, pos: P(0, 0) });
  });

  it("it also crashes when it has less fuel than the burn", () => {
    expect(nextRound(fighter(3)).state.units).toEqual([]);
  });

  it("one more point of fuel keeps it in the air", () => {
    expect(byId(nextRound(fighter(6)).state, 0)?.fuel).toBe(1);
  });

  it("a crash isn't anyone's kill (05-supply-transport §1)", () => {
    const state = makeGame(["=="], [u("fighter", 0, 0, { fuel: 5 }), u("mobileAA", 1, 1)]);
    expect(byId(nextRound(state).state, 1)?.kills).toBe(0);
  });

  it("a crash happens before income, in the doc's order (04-economy §2)", () => {
    const state = makeGame(["C="], [u("fighter", 0, 1, { fuel: 5 })], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    const types = nextRound(state).events.map((e: GameEvent) => e.type);
    expect(types.indexOf("unitOutOfFuel")).toBeLessThan(types.indexOf("incomeReceived"));
  });

  it("the last unit crashing routs its owner at the end of the turn (04-economy §8)", () => {
    const state = makeGame(["=="], [u("fighter", 0, 0, { fuel: 5 }), u("infantry", 1, 1)]);
    const afterCrash = nextRound(state).state;
    expect(afterCrash.result).toBeNull();
    expect(must(afterCrash, endTurn).state.result).toMatchObject({ winningSide: "axis", reason: "rout" });
  });

  it("fuel burn goes through the modifier layer", () => {
    const state = makeGame(["."], [u("fighter", 0, 0, { fuel: 50 })], {
      modifiers: [{ source: "drop tanks", stat: "fuelPerDay", op: "add", value: -2 }],
    });
    expect(byId(nextRound(state).state, 0)?.fuel).toBe(47);
  });
});

describe("airfields (04-economy §1, §5)", () => {
  const owned = (terrain: string, unit: UnitSetup, funds = 50_000) => makeGame([terrain], [unit], {
    players: [{ name: "A", nation: "us", funds }, { name: "B", nation: "germany" }],
    propertyOwners: [{ pos: P(0, 0), owner: 0 }],
    settings: { incomePerProperty: 0 },
  });

  it("an aircraft on its own airfield burns nothing, so it can't crash there", () => {
    const { state, events } = nextRound(owned("A", u("fighter", 0, 0, { fuel: 3 })));
    expect(byId(state, 0)?.fuel).toBe(99);
    expect(events.map((e) => e.type)).not.toContain("unitOutOfFuel");
  });

  it("airfields repair and resupply air units", () => {
    // Serviced at the start of day 1, then again on day 2.
    const state = nextRound(owned("A", u("bomber", 0, 0, { hp: 50, fuel: 20, ammo: 1 }))).state;
    expect(byId(state, 0)).toMatchObject({ hp: 90, fuel: 99, ammo: 9 });
  });

  it("repair costs 10% of the unit's cost per HP, as for land units", () => {
    // 2 HP on day 1 and 2 HP on day 2, at 2,200 per HP for a 22,000 Bomber.
    expect(nextRound(owned("A", u("bomber", 0, 0, { hp: 50 }), 10_000)).state.players[0]?.funds).toBe(10_000 - 8800);
  });

  it("cities don't service aircraft, so one parked there still burns fuel", () => {
    const state = nextRound(owned("C", u("fighter", 0, 0, { fuel: 50, hp: 50 }))).state;
    expect(byId(state, 0)).toMatchObject({ fuel: 45, hp: 50 });
  });

  it("an enemy airfield doesn't service aircraft either", () => {
    const state = makeGame(["A"], [u("fighter", 0, 0, { fuel: 50 })], { propertyOwners: [{ pos: P(0, 0), owner: 1 }] });
    expect(byId(nextRound(state).state, 0)?.fuel).toBe(45);
  });

  it("airfields build Fighters, Bombers and Transport Aircraft, which can't act until next turn", () => {
    const state = owned("A", u("infantry", 1, 0, { pos: P(0, 0) }));
    const empty: GameState = { ...state, units: [] };
    expect(buildOptions(empty, P(0, 0)).map((o) => o.type)).toEqual(["transportAircraft", "fighter", "bomber"]);
    const built = run(empty, { type: "build", unitType: "bomber", pos: P(0, 0) });
    expect(built.units[0]).toMatchObject({ type: "bomber", hasActed: true, fuel: 99, ammo: 9 });
  });

  it("infantry can capture an airfield", () => {
    const state = makeGame(["A="], [u("infantry", 0, 0), u("infantry", 1, 1)], { propertyOwners: [{ pos: P(0, 0), owner: 1 }] });
    const capture = order(0, [], { type: "capture" });
    const after = run(state, capture, endTurn, endTurn, capture);
    expect(after.properties[0]?.owner).toBe(0);
  });

  it("a Halftrack refuels an adjacent aircraft (05-supply-transport §5)", () => {
    const state = makeGame(["==.", "..."], [u("halftrack", 0, 0), { type: "fighter", owner: 0, pos: P(2, 1), fuel: 50 }]);
    const after = run(state, order(0, [P(1, 0), P(2, 0)], { type: "supply" }));
    expect(byId(after, 1)?.fuel).toBe(99);
  });
});

describe("air combat (03-combat §5)", () => {
  const luckless = { settings: { luck: false } };

  it("Fighters beat Bombers, and Bombers can't hit back or attack air at all", () => {
    const state = makeGame(["=="], [u("fighter", 0, 0), u("bomber", 1, 1)], luckless);
    const { events } = must(state, attack(0, 1));
    expect(events).toContainEqual(expect.objectContaining({ type: "combat", counter: null }));
    expect(attackTargets(state, { ...(state.units[1] as Unit) }, false)).toEqual([]);
  });

  it("Bombers hit ground units hard", () => {
    const state = makeGame(["=="], [u("bomber", 0, 0), u("mediumTank", 1, 1)], luckless);
    expect(must(state, attack(0, 1)).state.units.map((x) => x.id)).toEqual([0]); // 105 on 0 stars
  });

  it("Fighters strafe weakly: at most 15 against ground units", () => {
    const state = makeGame(["=="], [u("fighter", 0, 0), u("infantry", 1, 1)], luckless);
    expect(byId(run(state, attack(0, 1)), 1)?.hp).toBe(85);
  });

  it("ground units with no anti-air weapon can't touch aircraft", () => {
    const state = makeGame(["=="], [u("mediumTank", 0, 0), u("fighter", 1, 1)]);
    expect(apply(state, attack(0, 1))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("a Mobile AA shoots aircraft down, and terrain doesn't protect them", () => {
    const state = makeGame(["=H"], [u("mobileAA", 0, 0), u("fighter", 1, 1)], luckless);
    expect(byId(run(state, attack(0, 1)), 1)?.hp).toBe(35); // 65 with 0 stars, even over hills
  });

  it("aircraft can attack from over the sea", () => {
    const state = makeGame(["S="], [u("bomber", 0, 0), u("infantry", 1, 1)]);
    expect(apply(state, attack(0, 1)).ok).toBe(true);
  });

  it("Bombers can break fortifications; Fighters can't (03-combat §5b)", () => {
    const bomber = makeGame(["=X"], [u("bomber", 0, 0)], luckless);
    expect(run(bomber, order(0, [], { type: "attackFort", target: P(1, 0) })).fortifications[0]?.hp).toBe(45);
    const fighter = makeGame(["=X"], [u("fighter", 0, 0)]);
    expect(apply(fighter, order(0, [], { type: "attackFort", target: P(1, 0) }))).toMatchObject({ ok: false, code: "invalidTarget" });
  });
});

describe("Flak Gun (01-units §2)", () => {
  const luckless = { settings: { luck: false } };
  const flak = (x: number, target: UnitSetup["type"] = "fighter") =>
    makeGame(["======="], [u("flakGun", 0, 0), u(target, 1, x)], luckless);

  it("is a land unit built at a factory", () => {
    expect(UNITS.flakGun).toMatchObject({ category: "land", movementType: "tracks", movePoints: 3 });
    const state = makeGame(["f"], [], {
      players: [{ name: "A", nation: "us", funds: 11_000 }, { name: "B", nation: "germany" }],
      propertyOwners: [{ pos: P(0, 0), owner: 0 }],
    });
    expect(buildOptions(state, P(0, 0)).map((o) => o.type)).toContain("flakGun");
  });

  it("hits aircraft at range 3–5", () => {
    for (const x of [3, 4, 5]) expect(apply(flak(x), attack(0, 1)).ok, `range ${x}`).toBe(true);
    for (const x of [1, 2, 6]) expect(apply(flak(x), attack(0, 1)).ok, `range ${x}`).toBe(false);
  });

  it("destroys a full-strength Fighter in one hit", () => {
    expect(byId(run(flak(4), attack(0, 1)), 1)).toBeUndefined();
  });

  it("can't attack ground units", () => {
    expect(apply(flak(4, "mediumTank"), attack(0, 1))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("can't move and fire", () => {
    expect(apply(flak(4), attack(0, 1, [P(1, 0)]))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("is never countered, and never counters", () => {
    const fired = must(flak(4), attack(0, 1));
    expect(fired.events).toContainEqual(expect.objectContaining({ type: "combat", counter: null }));
    const state = makeGame(["=="], [u("bomber", 1, 0), u("flakGun", 0, 1)], luckless);
    const passed = must(state, endTurn).state;
    const hit = must(passed, attack(0, 1));
    expect(hit.events).toContainEqual(expect.objectContaining({ type: "combat", counter: null }));
  });
});
