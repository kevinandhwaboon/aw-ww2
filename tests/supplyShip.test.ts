import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import { attackTargets } from "../src/engine/combat";
import type { Command, GameEvent, UnitAction } from "../src/engine/commands";
import { baseDamage } from "../src/engine/data/damage";
import { UNITS } from "../src/engine/data/units";
import { buildOptions } from "../src/engine/economy";
import type { Point } from "../src/engine/map";
import type { GameSetup, UnitSetup } from "../src/engine/setup";
import type { GameState, Unit } from "../src/engine/state";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const order = (unitId: number, path: Point[], action: UnitAction): Command => ({ type: "move", unitId, path, action });

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}
/** Passes the turn back to player 0: the start of their next turn, when the Supply Ship works. */
const nextRound = (state: GameState) => {
  const first = must(state, endTurn);
  const second = must(first.state, endTurn);
  return { state: second.state, events: second.events };
};
const unit = (state: GameState, id: number): Unit => {
  const found = state.units.find((x) => x.id === id);
  if (!found) throw new Error(`No unit ${id}`);
  return found;
};
const ofType = (events: readonly GameEvent[], type: GameEvent["type"]) => events.filter((e) => e.type === type);

const u = (type: UnitSetup["type"], owner: number, x: number, y = 0, extra: Partial<UnitSetup> = {}): UnitSetup =>
  ({ type, owner, pos: P(x, y), ...extra });

const funded = (funds: number): Partial<GameSetup> => ({
  players: [
    { name: "Allies", nation: "us", funds },
    { name: "Axis", nation: "japan", funds },
  ],
  settings: { incomePerProperty: 0 },
});

describe("the Supply Ship (01-units §4, 05-supply-transport §3a)", () => {
  it("is an unarmed ship that costs 10,000, moves 5 and carries 99 fuel, burning 1 a day (01-units §8)", () => {
    const def = UNITS.supplyShip;
    expect(def).toMatchObject({ category: "naval", cost: 10000, movePoints: 5, maxFuel: 99, fuelPerDay: 1, primaryWeapon: null, secondaryWeapon: null, range: null, transport: null });
    const state = makeGame(["SS"], [u("supplyShip", 0, 0), u("destroyer", 1, 1)]);
    expect(attackTargets(state, unit(state, 0), false)).toEqual([]);
  });

  it("ports build it, like any other ship (04-economy §1)", () => {
    const state = makeGame(["P"], [], { ...funded(50_000), propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    expect(buildOptions(state, P(0, 0)).map((o) => o.type)).toContain("supplyShip");
    expect(unit(must(state, { type: "build", unitType: "supplyShip", pos: P(0, 0) }).state, 0).type).toBe("supplyShip");
  });

  it("at the start of its owner's turn it refuels and rearms every friendly ship next to it, at sea, for free", () => {
    const state = makeGame(["SSS"], [u("supplyShip", 0, 1), u("destroyer", 0, 0, 0, { fuel: 10, ammo: 2 }), u("battleship", 0, 2, 0, { fuel: 20, ammo: 0 })], funded(0));
    const { state: after, events } = nextRound(state);
    expect(unit(after, 1)).toMatchObject({ fuel: 65, ammo: 9 });
    expect(unit(after, 2)).toMatchObject({ fuel: 80, ammo: 9 });
    expect(ofType(events, "unitResupplied").map((e) => (e as { unitId: number }).unitId).sort()).toEqual([1, 2]);
  });

  it("refuels and rearms land units on the shore next to it too, like a Halftrack (05-supply-transport §3)", () => {
    const state = makeGame(["S_."], [u("supplyShip", 0, 0), u("artillery", 0, 1, 0, { ammo: 0, fuel: 3 })]);
    expect(unit(nextRound(state).state, 1)).toMatchObject({ ammo: 9, fuel: 40 });
  });

  it("never refuels aircraft: they have to fly home to an airfield or Carrier (05-supply-transport §5)", () => {
    const state = makeGame(["SS"], [u("supplyShip", 0, 0), u("fighter", 0, 1, 0, { fuel: 60, ammo: 0 })]);
    expect(unit(nextRound(state).state, 1).ammo).toBe(0);
  });

  it("doesn't reach ships two squares away or diagonally", () => {
    const state = makeGame(["SSS", "SSS"], [u("supplyShip", 0, 0), u("destroyer", 0, 2, 0, { ammo: 1 }), u("destroyer", 0, 1, 1, { ammo: 1 })]);
    const after = nextRound(state).state;
    expect(unit(after, 1).ammo).toBe(1);
    expect(unit(after, 2).ammo).toBe(1);
  });

  it("repairs each of its own player's ships next to it 1 HP a day, for 10% of the ship's cost per HP, as a Carrier repairs its aircraft", () => {
    const state = makeGame(["SS"], [u("supplyShip", 0, 0), u("destroyer", 0, 1, 0, { hp: 50 })], funded(10_000));
    // Once as the game starts with player 0's turn on day 1, and again on their next turn.
    const { state: after, events } = nextRound(state);
    expect(unit(after, 1).hp).toBe(70);
    expect(ofType(events, "unitRepaired")).toEqual([{ type: "unitRepaired", unitId: 1, hp: 1, cost: 1600 }]); // Destroyer: 16,000
    expect(after.players[0]?.funds).toBe(10_000 - 2 * 1600);
  });

  it("repairs only as far as its player can pay, in row-major order (04-economy §5)", () => {
    // 2,000 pays for one Destroyer HP (1,600): the one further up and left gets it.
    const state = makeGame(["SSS"], [u("supplyShip", 0, 1), u("destroyer", 0, 0, 0, { hp: 50 }), u("destroyer", 0, 2, 0, { hp: 50 })], funded(2000));
    const after = nextRound(state).state;
    expect([unit(after, 1).hp, unit(after, 2).hp]).toEqual([60, 50]);
  });

  it("doesn't repair land units next to it, only ships", () => {
    const state = makeGame(["S_"], [u("supplyShip", 0, 0), u("mediumTank", 0, 1, 0, { hp: 50 })], funded(10_000));
    expect(unit(nextRound(state).state, 1).hp).toBe(50);
  });

  it("doesn't repair an ally's ships: each player pays for their own repairs (04-economy §5)", () => {
    const state = makeGame(["SS"], [u("supplyShip", 0, 0), u("destroyer", 1, 1, 0, { hp: 50, ammo: 1 })], {
      players: [
        { name: "US", nation: "us", funds: 10_000 },
        { name: "UK", nation: "uk", funds: 10_000 },
        { name: "Japan", nation: "japan", funds: 10_000 },
      ],
      settings: { incomePerProperty: 0 },
    });
    const [first, second, third] = [endTurn, endTurn, endTurn];
    const after = [first, second, third].reduce((s, c) => must(s, c).state, state);
    expect(unit(after, 1)).toMatchObject({ hp: 50, ammo: 9 }); // resupplied as an ally, never repaired
  });

  it("doesn't repair itself", () => {
    const state = makeGame(["SS"], [u("supplyShip", 0, 0, 0, { hp: 50 })], funded(10_000));
    expect(unit(nextRound(state).state, 0).hp).toBe(50);
  });

  it("a ship in port next to a Supply Ship gets the port's 2 HP a day, not 3", () => {
    const state = makeGame(["PS"], [u("destroyer", 0, 0, 0, { hp: 50 }), u("supplyShip", 0, 1)], {
      ...funded(10_000),
      propertyOwners: [{ pos: P(0, 0), owner: 0 }],
    });
    expect(unit(nextRound(state).state, 0).hp).toBe(90); // day 1 and the next turn: 2 + 2
  });

  it("next to two Supply Ships a ship is still repaired only 1 HP a day", () => {
    const state = makeGame(["SSS"], [u("supplyShip", 0, 0), u("destroyer", 0, 1, 0, { hp: 50 }), u("supplyShip", 0, 2)], funded(10_000));
    expect(unit(nextRound(state).state, 1).hp).toBe(70); // day 1 and the next turn: 1 + 1
  });

  it("the Supply action refuels and rearms neighbors after it moves, ending its turn, but repairs nobody", () => {
    const state = makeGame(["SSS"], [u("supplyShip", 0, 0), u("destroyer", 0, 2, 0, { fuel: 10, ammo: 1, hp: 50 })], funded(10_000));
    const { state: after, events } = must(state, order(0, [P(1, 0)], { type: "supply" }));
    expect(unit(after, 1)).toMatchObject({ fuel: 65, ammo: 9, hp: 50 });
    expect(unit(after, 0)).toMatchObject({ pos: P(1, 0), hasActed: true });
    expect(events.map((e) => e.type)).toEqual(["unitMoved", "unitResupplied"]);
  });

  it("doesn't supply or repair enemy ships", () => {
    const state = makeGame(["SS"], [u("supplyShip", 0, 0), u("destroyer", 1, 1, 0, { ammo: 1, hp: 50 })], funded(10_000));
    expect(unit(nextRound(state).state, 1)).toMatchObject({ ammo: 1, hp: 50 });
  });

  it("is as easy to sink as a Landing Craft: Submarines, Bombers and Battleships hit it for 95 (03-combat §5b)", () => {
    for (const attacker of ["submarine", "bomber", "battleship", "torpedoBoat", "destroyer", "torpedoBomber"] as const) {
      expect(baseDamage(attacker, "supplyShip"), attacker).toEqual(baseDamage(attacker, "landingCraft"));
    }
    expect(baseDamage("submarine", "supplyShip")?.base).toBe(95);
  });
});

describe("Supply Ship supplies (05-supply-transport §3b)", () => {
  /** Two of player 0's Destroyers on either side of their Supply Ship, at sea. */
  const fleet = (ship: Partial<UnitSetup> = {}, destroyer: Partial<UnitSetup> = {}) =>
    makeGame(["SSS"], [u("supplyShip", 0, 1, 0, ship), u("destroyer", 0, 0, 0, destroyer), u("destroyer", 0, 2, 0, destroyer)], funded(10_000));

  it("carries 5 supplies, kept as its ammo count", () => {
    expect(UNITS.supplyShip.supplyLoads).toBe(5);
    expect(unit(fleet(), 0).ammo).toBe(5);
  });

  it("each start-of-turn resupply spends one supply, however many ships it tops up", () => {
    // Day 1 burns no fuel, so nobody needs anything; the next turn both Destroyers have burned 2.
    const after = nextRound(fleet()).state;
    expect(unit(after, 1).fuel).toBe(65);
    expect(unit(after, 2).fuel).toBe(65);
    expect(unit(after, 0).ammo).toBe(4);
  });

  it("a turn when nobody next to it needs anything costs nothing", () => {
    const state = makeGame(["SSS"], [u("supplyShip", 0, 1)]);
    expect(unit(nextRound(state).state, 0).ammo).toBe(5);
  });

  it("the Supply action spends one supply too", () => {
    const state = makeGame(["SSS"], [u("supplyShip", 0, 0), u("destroyer", 0, 2, 0, { fuel: 10 })]);
    expect(unit(must(state, order(0, [P(1, 0)], { type: "supply" })).state, 0).ammo).toBe(4);
  });

  it("with no supplies left it refuels and rearms nobody, and has no Supply action", () => {
    const state = fleet({ ammo: 0 }, { fuel: 10, ammo: 1 });
    const after = nextRound(state).state;
    expect(unit(after, 1)).toMatchObject({ fuel: 8, ammo: 1 });
    expect(ofType(nextRound(state).events, "unitResupplied")).toEqual([]);
    const refused = apply(state, order(0, [], { type: "supply" }));
    expect(refused.ok ? null : refused.code).toBe("cannotSupply");
  });

  it("with no supplies left it still repairs its own ships: repairs are paid for in funds (05-supply-transport §3a)", () => {
    const after = nextRound(fleet({ ammo: 0 }, { hp: 50 })).state;
    expect(unit(after, 1).hp).toBe(70);
  });

  it("two Supply Ships top up each other's fuel but never each other's supplies, so they can't keep each other going forever", () => {
    const pair = makeGame(["SS"], [u("supplyShip", 0, 0, 0, { ammo: 2 }), u("supplyShip", 0, 1, 0, { ammo: 2 })]);
    const once = nextRound(pair).state;
    expect([unit(once, 0), unit(once, 1)].map((s) => [s.fuel, s.ammo])).toEqual([[99, 1], [99, 1]]);
    const dry = nextRound(nextRound(once).state).state;
    expect([unit(dry, 0), unit(dry, 1)].map((s) => [s.fuel, s.ammo])).toEqual([[98, 0], [98, 0]]);
  });

  it("an owned port refills its supplies, as it refuels any ship (04-economy §5)", () => {
    const state = makeGame(["PS"], [u("supplyShip", 0, 0, 0, { ammo: 0 })], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    expect(unit(nextRound(state).state, 0).ammo).toBe(5);
  });

  it("a ship stranded with no fuel is refuelled next to it and can sail again (05-supply-transport §7)", () => {
    const after = nextRound(fleet({}, { fuel: 0 })).state;
    expect(unit(after, 1).fuel).toBe(65);
  });

  it("its supplies are a stat like any other: a commander's or scenario's ammo modifier changes them too", () => {
    const state = makeGame(["S"], [u("supplyShip", 0, 0)], { modifiers: [{ source: "test", stat: "maxAmmo", op: "add", value: -2 }] });
    expect(unit(state, 0).ammo).toBe(3);
  });
});
