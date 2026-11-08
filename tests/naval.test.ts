import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import { attackTargets } from "../src/engine/combat";
import type { Command, GameEvent, UnitAction } from "../src/engine/commands";
import { buildOptions, buildProblem } from "../src/engine/economy";
import type { Point } from "../src/engine/map";
import { moveDestinations } from "../src/engine/movement";
import type { GameSetup, UnitSetup } from "../src/engine/setup";
import type { GameState, Unit } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const order = (unitId: number, path: Point[], action: UnitAction): Command => ({ type: "move", unitId, path, action });
const wait = (unitId: number, path: Point[] = []) => order(unitId, path, { type: "wait" });
const attack = (unitId: number, target: number, path: Point[] = []) => order(unitId, path, { type: "attack", target });
const dive = (unitId: number, path: Point[] = []) => order(unitId, path, { type: "dive" });
const surface = (unitId: number, path: Point[] = []) => order(unitId, path, { type: "surface" });

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}
const run = (state: GameState, ...commands: Command[]) => commands.reduce((s, c) => must(s, c).state, state);
/** Passes the turn back to player 0: the point where their daily fuel burns. */
const nextRound = (state: GameState) => must(must(state, endTurn).state, endTurn);
const byId = (state: GameState, id: number): Unit | undefined => state.units.find((u) => u.id === id);
const unit = (state: GameState, id: number): Unit => {
  const found = byId(state, id);
  if (!found) throw new Error(`No unit ${id}`);
  return found;
};
const ofType = (events: readonly GameEvent[], type: GameEvent["type"]) => events.filter((e) => e.type === type);
/** The counterattack in the combat among these events: null if the defender couldn't hit back. */
function counterIn(events: readonly GameEvent[]) {
  const combat = events.find((e) => e.type === "combat");
  if (!combat) throw new Error("no combat happened");
  return combat.counter;
}

const u = (type: UnitSetup["type"], owner: number, x: number, extra: Partial<UnitSetup> = {}): UnitSetup =>
  ({ type, owner, pos: P(x, 0), ...extra });

const rich: Partial<GameSetup> = {
  players: [
    { name: "Allies", nation: "us", funds: 100_000 },
    { name: "Axis", nation: "germany", funds: 100_000 },
  ],
};

describe("sailing (05-supply-transport §7)", () => {
  it("ships sail on Sea, Reef and Port, but never onto Beach or land", () => {
    const state = makeGame(["SrPS_."], [u("destroyer", 0, 0)]);
    expect(moveDestinations(state, unit(state, 0)).map((p) => p.x)).toEqual([0, 1, 2, 3]);
  });

  it("a ship gets the Port's 3 defense stars, 1 on Reef, and none at sea (03-combat §5c)", () => {
    const state = makeGame(["PrS"], [u("destroyer", 0, 0), u("destroyer", 0, 1), u("destroyer", 0, 2)]);
    expect(state.units.map((s) => stats.terrainStars(state, s))).toEqual([3, 1, 0]);
  });
});

describe("daily fuel for ships (05-supply-transport §7, 04-economy §2)", () => {
  it("ships burn 1 fuel at the start of each of their owner's turns", () => {
    const state = makeGame(["S"], [u("destroyer", 0, 0, { fuel: 50 })]);
    expect(byId(nextRound(state).state, 0)?.fuel).toBe(49);
  });

  it("a ship that runs out of fuel sinks, and the sinking isn't anyone's kill", () => {
    const state = makeGame(["SS"], [u("destroyer", 0, 0, { fuel: 1 }), u("destroyer", 1, 1)]);
    const { state: after, events } = nextRound(state);
    expect(byId(after, 0)).toBeUndefined();
    expect(ofType(events, "unitOutOfFuel")).toEqual([{ type: "unitOutOfFuel", unitId: 0, unitType: "destroyer", owner: 0, pos: P(0, 0) }]);
    expect(byId(after, 1)?.kills).toBe(0);
  });

  it("a ship in its own port burns nothing, so it can't sink there", () => {
    const state = makeGame(["P"], [u("destroyer", 0, 0, { fuel: 1 })], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    expect(byId(nextRound(state).state, 0)?.fuel).toBe(99); // and the port refuels it
  });

  it("an enemy port doesn't service ships, so one parked there still burns fuel", () => {
    const state = makeGame(["P"], [u("destroyer", 0, 0, { fuel: 50 })], { propertyOwners: [{ pos: P(0, 0), owner: 1 }] });
    expect(byId(nextRound(state).state, 0)?.fuel).toBe(49);
  });
});

describe("ports (04-economy §1, §5)", () => {
  const port = (units: UnitSetup[] = [], owner = 0) =>
    makeGame(["P.f"], units, { ...rich, propertyOwners: [{ pos: P(0, 0), owner }, { pos: P(2, 0), owner }] });

  it("ports build warships, which can't act until their owner's next turn", () => {
    const built = must(port(), { type: "build", unitType: "destroyer", pos: P(0, 0) });
    const ship = built.state.units.find((s) => s.type === "destroyer");
    expect(ship?.pos).toEqual(P(0, 0));
    expect(apply(built.state, wait(ship?.id ?? -1)).ok).toBe(false);
  });

  it("by default a port offers every ship, the Landing Craft included", () => {
    expect(buildOptions(port(), P(0, 0)).map((o) => o.type).sort()).toEqual(["battleship", "destroyer", "landingCraft", "submarine", "torpedoBoat"]);
  });

  it("ports build only ships, and factories never build ships", () => {
    const state = port();
    expect(buildProblem(state, "infantry", P(0, 0))).toMatch(/builds naval units/);
    expect(buildProblem(state, "destroyer", P(2, 0))).toMatch(/builds land units/);
  });

  it("ports repair and resupply ships", () => {
    const state = port([u("destroyer", 0, 0, { hp: 50, fuel: 10, ammo: 2 })]);
    // +2 HP on day 1, when the game starts with player 0's turn, and +2 again on their next turn.
    expect(byId(nextRound(state).state, 0)).toMatchObject({ hp: 90, fuel: 99, ammo: 9 });
  });

  it("repair costs 10% of the ship's cost per HP, as for land units", () => {
    const state = port([u("destroyer", 0, 0, { hp: 50 })]);
    const repaired = ofType(nextRound(state).events, "unitRepaired");
    expect(repaired).toEqual([{ type: "unitRepaired", unitId: 0, hp: 2, cost: 3200 }]); // Destroyer: 16,000
  });

  it("infantry can capture a port, but ships can't capture (05-supply-transport §7)", () => {
    const land = makeGame(["P."], [u("infantry", 0, 1)]);
    expect(ofType(must(land, order(0, [P(0, 0)], { type: "capture" })).events, "captureProgress")).toHaveLength(1);
    const sea = makeGame(["PS"], [u("destroyer", 0, 1)]);
    const result = apply(sea, order(0, [P(0, 0)], { type: "capture" }));
    expect(result.ok ? null : result.code).toBe("cannotCapture");
  });

  it("a Halftrack on the shore resupplies an adjacent ship (05-supply-transport §7)", () => {
    const state = makeGame(["._S"], [u("halftrack", 0, 0), u("destroyer", 0, 2, { fuel: 10, ammo: 1 })]);
    expect(byId(run(state, order(0, [P(1, 0)], { type: "supply" })), 1)).toMatchObject({ fuel: 99, ammo: 9 });
  });
});

describe("submarines (05-supply-transport §9)", () => {
  const rejection = (state: GameState, command: Command) => {
    const result = apply(state, command);
    return result.ok ? null : result.code;
  };

  it("a submarine starts surfaced", () => {
    const state = makeGame(["S"], [u("submarine", 0, 0)]);
    expect(unit(state, 0).submerged ?? false).toBe(false);
  });

  it("a submarine can move and then dive, and surface again on a later turn", () => {
    const state = makeGame(["SS"], [u("submarine", 0, 0)]);
    const dived = must(state, dive(0, [P(1, 0)]));
    expect(unit(dived.state, 0)).toMatchObject({ pos: P(1, 0), submerged: true, hasActed: true });
    expect(ofType(dived.events, "unitDived")).toEqual([{ type: "unitDived", unitId: 0 }]);
    const surfaced = must(nextRound(dived.state).state, surface(0, [P(0, 0)]));
    expect(unit(surfaced.state, 0).submerged ?? false).toBe(false);
    expect(ofType(surfaced.events, "unitSurfaced")).toEqual([{ type: "unitSurfaced", unitId: 0 }]);
  });

  it("only submarines can dive", () => {
    const state = makeGame(["S"], [u("destroyer", 0, 0)]);
    expect(rejection(state, dive(0))).toBe("cannotDive");
  });

  it("a submarine can't dive while submerged, or surface while surfaced", () => {
    const state = makeGame(["S"], [u("submarine", 0, 0)]);
    expect(rejection(state, surface(0))).toBe("cannotSurface");
    expect(rejection(nextRound(run(state, dive(0))).state, dive(0))).toBe("cannotDive");
  });

  it("a submerged submarine burns 5 fuel a day instead of 1", () => {
    const state = makeGame(["S"], [u("submarine", 0, 0, { fuel: 50 })]);
    expect(byId(nextRound(state).state, 0)?.fuel).toBe(49);
    expect(byId(nextRound(run(state, dive(0))).state, 0)?.fuel).toBe(45);
  });

  it("a submerged submarine with 5 fuel or less sinks at the start of its owner's turn", () => {
    const state = makeGame(["SS"], [u("submarine", 0, 0, { fuel: 5 }), u("destroyer", 1, 1)]);
    expect(byId(nextRound(run(state, dive(0))).state, 0)).toBeUndefined();
  });

  it("submerged fuel burn goes through the modifier layer", () => {
    const state = makeGame(["S"], [u("submarine", 0, 0, { fuel: 50 })], {
      modifiers: [{ source: "test", stat: "fuelPerDay", op: "add", value: 1 }],
    });
    expect(byId(nextRound(run(state, dive(0))).state, 0)?.fuel).toBe(44);
  });

  describe("who can hit a submerged submarine (03-combat §5c)", () => {
    // Player 0's submarine at (1,1), with Axis ships and a Bomber next to it and a Battleship 3 tiles off.
    const setup = () =>
      makeGame(["SSSSS", "SSSSS", "SSSSS"], [
        { type: "submarine", owner: 0, pos: P(1, 1) },
        { type: "torpedoBoat", owner: 1, pos: P(0, 1) },
        { type: "destroyer", owner: 1, pos: P(2, 1) },
        { type: "battleship", owner: 1, pos: P(4, 1) },
        { type: "bomber", owner: 1, pos: P(1, 0) },
        { type: "submarine", owner: 1, pos: P(1, 2) },
      ]);
    const canHit = (state: GameState, attackerId: number) => attackTargets(state, unit(state, attackerId), false).some((t) => t.id === 0);

    it("anything that can hit ships can attack a surfaced submarine", () => {
      const state = must(setup(), endTurn).state;
      expect([1, 2, 3, 4, 5].map((id) => canHit(state, id))).toEqual([true, true, true, true, true]);
    });

    it("only Destroyers and Submarines can attack a submerged submarine", () => {
      const state = must(run(setup(), dive(0)), endTurn).state;
      // Torpedo Boat, Destroyer, Battleship, Bomber, Submarine
      expect([1, 2, 3, 4, 5].map((id) => canHit(state, id))).toEqual([false, true, false, false, true]);
    });

    it("a unit that can't attack a submerged submarine can't hit back at one either", () => {
      const surfacedAttack = must(nextRound(setup()).state, attack(0, 1));
      expect(counterIn(surfacedAttack.events)).not.toBeNull();
      const submergedAttack = must(nextRound(run(setup(), dive(0))).state, attack(0, 1));
      expect(counterIn(submergedAttack.events)).toBeNull();
    });

    it("a submerged submarine can still attack, and stays submerged", () => {
      const after = must(nextRound(run(setup(), dive(0))).state, attack(0, 1)).state;
      expect(unit(after, 0).submerged).toBe(true);
    });

    it("a Destroyer attacking a submerged submarine still takes its return fire", () => {
      const result = must(must(run(setup(), dive(0)), endTurn).state, attack(2, 0));
      expect(counterIn(result.events)).not.toBeNull();
    });
  });

  it("submarines attack ships only, never land units", () => {
    const state = makeGame(["S_"], [u("submarine", 0, 0), u("infantry", 1, 1)]);
    expect(attackTargets(state, unit(state, 0), false)).toEqual([]);
  });
});

describe("naval gunnery (01-units §4, 03-combat §2)", () => {
  it("a Battleship shells targets 2 to 6 tiles away", () => {
    const state = makeGame(["S.......", "S......."], [
      u("battleship", 0, 0),
      u("infantry", 1, 1),
      u("infantry", 1, 2),
      u("infantry", 1, 6),
      u("infantry", 1, 7),
    ]);
    expect(attackTargets(state, unit(state, 0), false).map((t) => t.pos.x)).toEqual([2, 6]);
  });

  it("a Battleship can't move and fire in the same turn", () => {
    const state = makeGame(["SS..."], [u("battleship", 0, 0), u("infantry", 1, 3)]);
    expect(apply(state, attack(0, 1, [P(1, 0)])).ok).toBe(false);
  });
});
