import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import { canCounter } from "../src/engine/combat";
import type { Command, UnitAction } from "../src/engine/commands";
import { baseDamage } from "../src/engine/data/damage";
import { buildOptions } from "../src/engine/economy";
import { UNIT_TYPE_IDS, UNITS } from "../src/engine/data/units";
import type { Point } from "../src/engine/map";
import type { UnitSetup } from "../src/engine/setup";
import { legalCommands } from "../src/engine/legal";
import { launchable, unloadTiles } from "../src/engine/transport";
import type { GameState, Unit } from "../src/engine/state";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const WAIT: UnitAction = { type: "wait" };
const order = (unitId: number, path: Point[], action: UnitAction = WAIT): Command => ({ type: "move", unitId, path, action });
const launch = (carrierId: number, unitId: number, path: Point[], action: UnitAction = WAIT): Command =>
  ({ type: "launch", carrierId, unitId, path, action });

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}
const run = (state: GameState, ...commands: Command[]) => commands.reduce((s, c) => must(s, c).state, state);
const byId = (state: GameState, id: number): Unit | undefined => state.units.find((u) => u.id === id);

const u = (type: UnitSetup["type"], owner: number, x: number, extra: Partial<UnitSetup> = {}): UnitSetup =>
  ({ type, owner, pos: P(x, 0), ...extra });
const bombers = { cargo: [{ type: "diveBomber" as const }, { type: "diveBomber" as const }] };

/**
 * A strip of sea then land: a US Carrier at x=1 carrying two Dive Bombers (ids 2 and 3), and a German
 * Medium Tank ashore at x=7 (id 1). Luck off so damage is exact.
 */
function game(carrier: Partial<UnitSetup> = bombers, extra: UnitSetup[] = [], funds = 50000): GameState {
  return makeGame(["SSSS......"], [u("carrier", 0, 1, carrier), u("mediumTank", 1, 7), ...extra], {
    settings: { luck: false },
    players: [{ name: "US", nation: "us", funds }, { name: "Germany", nation: "germany" }],
  });
}

describe("launching from a Carrier (05-supply-transport §10)", () => {
  it("an aircraft flies off the Carrier with its full move and attacks the same turn", () => {
    const { state, events } = must(game(), launch(0, 2, [P(2, 0), P(3, 0), P(4, 0), P(5, 0), P(6, 0)], { type: "attack", target: 1 }));
    expect(events.map((e) => e.type)).toEqual(["unitLaunched", "unitMoved", "combat"]);
    expect(byId(state, 2)?.pos).toEqual(P(6, 0));
    expect(byId(state, 1)?.hp).toBeLessThan(100);
    expect(byId(state, 0)?.cargo.map((c) => c.id)).toEqual([3]);
  });

  it("both aircraft can launch in the same turn, and then the Carrier is done", () => {
    const state = run(game(), launch(0, 2, [P(2, 0), P(3, 0)]), launch(0, 3, [P(0, 0)]));
    expect(byId(state, 0)?.cargo).toEqual([]);
    expect(byId(state, 2)?.pos).toEqual(P(3, 0));
    expect(byId(state, 3)?.pos).toEqual(P(0, 0));
    expect(byId(state, 0)?.hasActed).toBe(true);
  });

  it("a Carrier can't move after launching", () => {
    const state = run(game(), launch(0, 2, [P(2, 0)]));
    expect(apply(state, order(0, [P(0, 0)]))).toMatchObject({ ok: false, code: "unitAlreadyActed" });
  });

  it("a Carrier that has launched can still launch the other aircraft or wait where it is", () => {
    const state = run(game(), launch(0, 2, [P(2, 0)]));
    expect(apply(state, launch(0, 3, [P(0, 0)])).ok).toBe(true);
    expect(apply(state, order(0, [])).ok).toBe(true);
  });

  it("the list of legal commands includes every launch, and the engine accepts each one (09-ai §2)", () => {
    const state = game();
    const launches = legalCommands(state).filter((c) => c.type === "launch");
    expect(launches.some((c) => c.unitId === 2 && c.action.type === "attack")).toBe(true);
    expect(launches.some((c) => c.unitId === 3 && c.action.type === "wait")).toBe(true);
    for (const command of launches) expect(apply(state, command).ok).toBe(true);
  });

  it("no launch is listed once the Carrier has moved", () => {
    const state = run(game(), order(0, [P(0, 0)]));
    expect(legalCommands(state).filter((c) => c.type === "launch")).toEqual([]);
  });

  it("a Carrier can't launch after moving", () => {
    const state = run(game(), order(0, [P(0, 0)]));
    expect(apply(state, launch(0, 2, [P(1, 0)]))).toMatchObject({ ok: false, code: "cannotLaunch" });
  });

  it("a Carrier that launched can move again on its next turn", () => {
    const state = run(game(), launch(0, 2, [P(2, 0), P(3, 0)]), endTurn, endTurn);
    expect(apply(state, order(0, [P(0, 0)])).ok).toBe(true);
  });

  it("an aircraft that just landed can't launch until next turn", () => {
    const landed = run(game({}, [u("fighter", 0, 3)]), order(2, [P(2, 0), P(1, 0)], { type: "load" }));
    expect(byId(landed, 0)?.cargo.map((c) => c.id)).toEqual([2]);
    expect(launchable(byId(landed, 0) as Unit)).toEqual([]);
    expect(apply(landed, launch(0, 2, [P(2, 0)]))).toMatchObject({ ok: false, code: "cannotLaunch" });
    const nextTurn = run(landed, endTurn, endTurn);
    expect(apply(nextTurn, launch(0, 2, [P(2, 0)])).ok).toBe(true);
  });

  it("an aircraft can't take off without leaving the Carrier's tile", () => {
    expect(apply(game(), launch(0, 2, []))).toMatchObject({ ok: false, code: "cannotLaunch" });
    expect(apply(game(), launch(0, 2, [P(2, 0), P(1, 0)]))).toMatchObject({ ok: false, code: "cannotLaunch" });
  });

  it("you can't launch from another player's Carrier", () => {
    const state = run(game(), endTurn);
    expect(apply(state, launch(0, 2, [P(2, 0)]))).toMatchObject({ ok: false, code: "cannotLaunch" });
  });
});

describe("landing on a Carrier (05-supply-transport §10)", () => {
  it("a Carrier holds 2 aircraft: Fighters, Dive Bombers or Torpedo Bombers", () => {
    expect(UNITS.carrier.transport).toEqual({ capacity: 2, carries: ["fighter", "diveBomber", "torpedoBomber"] });
    const full = game(bombers, [u("fighter", 0, 3)]);
    expect(apply(full, order(2, [P(2, 0), P(1, 0)], { type: "load" }))).toMatchObject({ ok: false, code: "cannotLoad" });
  });

  it("a regular Bomber can't land on a Carrier", () => {
    const state = game({}, [u("bomber", 0, 3)]);
    expect(apply(state, order(2, [P(2, 0), P(1, 0)], { type: "load" }))).toMatchObject({ ok: false, code: "cannotLoad" });
  });

  it("Transport Aircraft can't board a Carrier", () => {
    const state = game({}, [u("transportAircraft", 0, 3)]);
    expect(apply(state, order(2, [P(2, 0), P(1, 0)], { type: "load" }))).toMatchObject({ ok: false, code: "cannotLoad" });
  });

  it("a Carrier can't Unload: its aircraft launch instead", () => {
    const state = game();
    const carrier = byId(state, 0) as Unit;
    const bomber = carrier.cargo[0] as Unit;
    expect(unloadTiles(state, carrier, bomber)).toEqual([]);
    expect(apply(state, order(0, [], { type: "unload", passenger: 2, to: P(2, 0) }))).toMatchObject({ ok: false, code: "cannotUnload" });
  });
});

describe("service aboard a Carrier (05-supply-transport §10)", () => {
  const damaged = { cargo: [{ type: "diveBomber" as const, hp: 50, fuel: 3, ammo: 0 }] };

  it("aircraft aboard are repaired 1 HP a day for 10% of their cost", () => {
    // The game starts with the US turn, so the first repair is already done.
    const start = game(damaged, [], 50000);
    expect(byId(start, 0)?.cargo[0]?.hp).toBe(60);
    expect(start.players[0]?.funds).toBe(50000 - 1400);
    const nextTurn = run(start, endTurn, endTurn);
    expect(byId(nextTurn, 0)?.cargo[0]?.hp).toBe(70);
    expect(nextTurn.players[0]?.funds).toBe(50000 - 2800);
  });

  it("aircraft aboard get full fuel and ammo free, and burn no daily fuel", () => {
    const poor = game(damaged, [], 0);
    expect(byId(poor, 0)?.cargo[0]).toMatchObject({ hp: 50, fuel: UNITS.diveBomber.maxFuel, ammo: UNITS.diveBomber.primaryWeapon.maxAmmo });
    const later = run(poor, endTurn, endTurn, endTurn, endTurn);
    expect(byId(later, 0)?.cargo[0]?.fuel).toBe(UNITS.diveBomber.maxFuel);
  });

  it("the turn-start repair is shown over the aircraft (a unitRepaired event for it)", () => {
    const { events } = must(run(game(damaged), endTurn), endTurn);
    expect(events).toContainEqual({ type: "unitRepaired", unitId: 2, hp: 1, cost: 1400 });
  });
});

describe("a Carrier in combat (05-supply-transport §10, 03-combat §5b)", () => {
  it("aircraft aboard are lost when the Carrier sinks, and don't count as kills", () => {
    const state = makeGame(["SSS"], [u("carrier", 0, 0, { ...bombers, hp: 10 }), u("bomber", 1, 1)], {
      settings: { luck: false },
      players: [{ name: "US", nation: "us" }, { name: "Germany", nation: "germany" }],
    });
    const after = run(state, endTurn, order(1, [], { type: "attack", target: 0 }));
    expect(byId(after, 0)).toBeUndefined();
    expect(after.units.some((x) => x.id === 2 || x.id === 3)).toBe(false);
    expect(byId(after, 1)?.kills).toBe(1);
  });

  it("the Carrier is unarmed: it never attacks or counters", () => {
    for (const target of [...UNIT_TYPE_IDS, "fort" as const]) expect(baseDamage("carrier", target)).toBeNull();
    const state = makeGame(["SS"], [u("carrier", 0, 0), u("bomber", 1, 1)]);
    expect(canCounter(state, byId(state, 1) as Unit, byId(state, 0) as Unit)).toBe(false);
  });

  it("torpedoes and bombs hurt a Carrier most: Bomber 85, Submarine 75, Torpedo Bomber 60, Battleship 60, Dive Bomber 45, Torpedo Boat 45, Destroyer 10", () => {
    const vsCarrier = (attacker: Parameters<typeof baseDamage>[0]) => baseDamage(attacker, "carrier")?.base;
    expect(["bomber", "submarine", "torpedoBomber", "battleship", "diveBomber", "torpedoBoat", "destroyer"].map((a) => vsCarrier(a as Parameters<typeof baseDamage>[0])))
      .toEqual([85, 75, 60, 60, 45, 45, 10]);
  });

  it("Fighters can't attack a Carrier, and artillery shells it at 45, rockets at 60", () => {
    expect(baseDamage("fighter", "carrier")).toBeNull();
    expect(baseDamage("artillery", "carrier")?.base).toBe(45);
    expect(baseDamage("rocketArtillery", "carrier")?.base).toBe(60);
  });
});

describe("a Carrier's place in the roster (01-units §4)", () => {
  it("costs 40,000, moves 5 by sea and is built at Ports", () => {
    expect(UNITS.carrier).toMatchObject({ cost: 40000, movePoints: 5, movementType: "sea", category: "naval" });
  });

  it("a Carrier is built empty: its aircraft are built at airfields and flown aboard", () => {
    const state = makeGame(["P"], [], { players: [{ name: "US", nation: "us", funds: 50000 }, { name: "Germany", nation: "germany" }], propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    const built = run(state, { type: "build", unitType: "carrier", pos: P(0, 0) });
    expect(built.units[0]).toMatchObject({ type: "carrier", cargo: [] });
  });

  it("a scenario can start aircraft aboard a Carrier, numbered after the units on the map", () => {
    const carrier = byId(game(), 0);
    expect(carrier?.cargo.map((c) => [c.id, c.type, c.pos])).toEqual([[2, "diveBomber", P(1, 0)], [3, "diveBomber", P(1, 0)]]);
    expect(game().nextUnitId).toBe(4);
  });

  it("a scenario can't put a unit aboard that the transport can't carry", () => {
    expect(() => game({ cargo: [{ type: "transportAircraft" }] })).toThrow(/can't carry/);
    expect(() => game({ cargo: [{ type: "bomber" }] })).toThrow(/can't carry/);
    expect(() => game({ cargo: [{ type: "diveBomber" }, { type: "diveBomber" }, { type: "fighter" }] })).toThrow(/can't carry/);
  });
});

describe("carrier aircraft (05-supply-transport §10, 01-units §3)", () => {
  type Attacker = Parameters<typeof baseDamage>[0];
  const players = [{ name: "US", nation: "us" as const, funds: 50000 }, { name: "Japan", nation: "japan" as const }];
  const air = (owner: number) => ({ settings: { luck: false }, players, propertyOwners: [{ pos: P(0, 0), owner }] });
  const atSea = { settings: { luck: false }, players };

  it("Dive and Torpedo Bombers are built at airfields, not at Ports", () => {
    const airfield = makeGame(["A"], [], air(0));
    expect(buildOptions(airfield, P(0, 0)).map((o) => o.type)).toEqual(expect.arrayContaining(["diveBomber", "torpedoBomber"]));
    const port = makeGame(["P"], [], air(0));
    expect(buildOptions(port, P(0, 0)).map((o) => o.type)).not.toContain("diveBomber");
  });

  it("a Dive Bomber costs 14,000, carries 2 bombs and moves 6, one less than a Bomber", () => {
    expect(UNITS.diveBomber).toMatchObject({ cost: 14000, movePoints: 6, primaryWeapon: { maxAmmo: 2 } });
    expect(UNITS.bomber.movePoints).toBe(7);
  });

  it("a Dive Bomber hits about half as hard as a Bomber, against everything a Bomber can hit", () => {
    for (const target of [...UNIT_TYPE_IDS, "fort" as const]) {
      const bomber = baseDamage("bomber", target)?.base;
      const dive = baseDamage("diveBomber", target)?.base;
      expect(dive === undefined, target).toBe(bomber === undefined);
      if (bomber !== undefined && dive !== undefined) {
        expect(dive, target).toBeLessThanOrEqual(Math.ceil(bomber * 0.55));
        expect(dive, target).toBeGreaterThanOrEqual(Math.floor(bomber * 0.4));
      }
    }
  });

  it("a Torpedo Bomber costs 16,000, moves 6 and carries 1 torpedo", () => {
    expect(UNITS.torpedoBomber).toMatchObject({ cost: 16000, movePoints: 6, primaryWeapon: { maxAmmo: 1 } });
  });

  it("a Torpedo Bomber attacks only ships on the surface: never land units, aircraft, submarines or fortifications", () => {
    const hits = [...UNIT_TYPE_IDS, "fort" as const].filter((t) => baseDamage("torpedoBomber", t) !== null);
    expect(hits.sort()).toEqual(["battleship", "carrier", "destroyer", "landingCraft", "torpedoBoat"]);
    for (const ship of hits) expect(baseDamage("torpedoBomber", ship)?.base).toBe(60);
  });

  it("one torpedo no longer sinks a full-strength ship: it hits for 60, halved from 120 on 2026-11-14 (03-combat §5b)", () => {
    for (const ship of ["carrier", "battleship"] as const) {
      const state = makeGame(["SSS"], [u("torpedoBomber", 0, 0), u(ship, 1, 2)], atSea);
      const after = run(state, order(0, [P(1, 0)], { type: "attack", target: 1 }));
      expect(byId(after, 1)?.hp).toBe(40);
      expect(byId(after, 0)?.ammo).toBe(0);
    }
  });

  it("two torpedoes sink a full-strength Carrier", () => {
    const state = makeGame(["SSS", "SSS"], [u("torpedoBomber", 0, 0), u("torpedoBomber", 0, 0, { pos: P(2, 1) }), u("carrier", 1, 2)], atSea);
    const after = run(state, order(0, [P(1, 0)], { type: "attack", target: 2 }), order(1, [], { type: "attack", target: 2 }));
    expect(byId(after, 2)).toBeUndefined();
  });

  it("with its torpedo gone, a Torpedo Bomber can't attack until it's resupplied", () => {
    const state = makeGame(["SSSS"], [u("torpedoBomber", 0, 0, { ammo: 0 }), u("destroyer", 1, 2)], atSea);
    expect(apply(state, order(0, [P(1, 0)], { type: "attack", target: 1 }))).toMatchObject({ ok: false });
  });

  it("Fighters, Mobile AA, Flak and Destroyers hit carrier aircraft as hard as they hit Bombers", () => {
    for (const attacker of ["fighter", "mobileAA", "flakGun", "destroyer"] as Attacker[]) {
      for (const plane of ["diveBomber", "torpedoBomber"] as const) {
        expect(baseDamage(attacker, plane), `${attacker} vs ${plane}`).toEqual(baseDamage(attacker, "bomber"));
      }
    }
  });
});
