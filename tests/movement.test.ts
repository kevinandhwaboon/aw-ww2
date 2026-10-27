import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import { checkPath, cheapestPath, moveDestinations, reachableTiles } from "../src/engine/movement";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState, Unit } from "../src/engine/state";
import { deepFreeze, makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });

/** Game with a single unit of the given type at (0, 0) plus any extra units. */
function solo(rows: string[], type: UnitSetup["type"], extra: UnitSetup[] = [], fuel?: number): { state: GameState; unit: Unit } {
  const state = makeGame(rows, [{ type, owner: 0, pos: P(0, 0), ...(fuel === undefined ? {} : { fuel }) }, ...extra]);
  const unit = state.units[0];
  if (!unit) throw new Error("no unit");
  return { state, unit };
}

/** Destinations as a sorted list of "x,y" strings, for readable assertions. */
const dests = (state: GameState, unit: Unit) => moveDestinations(state, unit).map((p) => `${p.x},${p.y}`);

const move = (unitId: number, path: Point[]): Command => ({ type: "move", unitId, path, action: { type: "wait" } });

function mustApply(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}

describe("move range (02-terrain §3, §5)", () => {
  it("infantry moves 3 tiles on plains", () => {
    const { state, unit } = solo([".....", "....."], "infantry");
    expect(dests(state, unit)).toEqual(["0,0", "1,0", "2,0", "3,0", "0,1", "1,1", "2,1"]);
  });

  it("wheels pay 2 per plains tile but 1 per road tile", () => {
    const plains = solo([".........."], "recon");
    expect(dests(plains.state, plains.unit)).toEqual(["0,0", "1,0", "2,0", "3,0", "4,0"]); // 8 move / 2
    const road = solo(["=========="], "recon");
    expect(dests(road.state, road.unit)).toHaveLength(9); // 8 tiles of road + start
  });

  it("tracks pay 2 to enter forest", () => {
    const { state, unit } = solo([".FFFF"], "artillery"); // 5 move: 2 + 2 = 4, the third forest costs 6
    expect(dests(state, unit)).toEqual(["0,0", "1,0", "2,0"]);
  });

  it("vehicles can't enter hills or rivers; heavy foot crosses both at cost 1", () => {
    const tank = solo([".H.", "~.."], "mediumTank");
    expect(dests(tank.state, tank.unit)).not.toContain("1,0");
    expect(dests(tank.state, tank.unit)).not.toContain("0,1");
    const assault = solo([".HHH"], "assaultInfantry"); // 2 move
    expect(dests(assault.state, assault.unit)).toEqual(["0,0", "1,0", "2,0"]);
  });

  it("foot infantry pays 2 for hills", () => {
    const { state, unit } = solo([".HH"], "infantry"); // 3 move: 2 + 2 > 3
    expect(dests(state, unit)).toEqual(["0,0", "1,0"]);
  });

  it("wheeled units can't enter bocage; tracks pay 3", () => {
    const recon = solo([".b."], "recon");
    expect(dests(recon.state, recon.unit)).toEqual(["0,0"]);
    const tank = solo(["=b.."], "mediumTank"); // 6 move: 3 + 1 + 1
    expect(dests(tank.state, tank.unit)).toEqual(["0,0", "1,0", "2,0", "3,0"]);
  });

  it("land units can't enter sea", () => {
    const { state, unit } = solo([".S."], "infantry");
    expect(dests(state, unit)).toEqual(["0,0"]);
  });

  it("an enemy unit blocks movement through its tile", () => {
    const { state, unit } = solo(["....."], "infantry", [{ type: "infantry", owner: 1, pos: P(1, 0) }]);
    expect(dests(state, unit)).toEqual(["0,0"]);
  });

  it("a friendly unit can be passed through but not stopped on", () => {
    const { state, unit } = solo(["....."], "infantry", [{ type: "infantry", owner: 0, pos: P(1, 0) }]);
    expect(dests(state, unit)).toEqual(["0,0", "2,0", "3,0"]);
  });

  it("fuel limits the range (05-supply-transport §1)", () => {
    const { state, unit } = solo(["......."], "mediumTank", [], 2);
    expect(dests(state, unit)).toEqual(["0,0", "1,0", "2,0"]);
  });

  it("a unit with no fuel can't move", () => {
    const { state, unit } = solo(["..."], "mediumTank", [], 0);
    expect(dests(state, unit)).toEqual(["0,0"]);
  });

  it("move point modifiers change the range", () => {
    const state = makeGame(["......"], [{ type: "infantry", owner: 0, pos: P(0, 0) }], {
      modifiers: [{ source: "doctrine", stat: "movePoints", op: "add", value: 2 }],
    });
    const unit = state.units[0];
    if (!unit) throw new Error("no unit");
    expect(dests(state, unit)).toHaveLength(6);
  });

  it("move cost modifiers change terrain costs, e.g. mud on plains", () => {
    const state = makeGame([".=...."], [{ type: "infantry", owner: 0, pos: P(0, 0) }], {
      modifiers: [{ source: "mud", stat: "moveCost", op: "add", value: 1, scope: { terrain: ["plains"] } }],
    });
    const unit = state.units[0];
    if (!unit) throw new Error("no unit");
    expect(dests(state, unit)).toEqual(["0,0", "1,0", "2,0"]); // road 1 + muddy plains 2 = 3; the next plains would be 5
  });

  it("the cheapest path takes the forest when that is cheaper than going around", () => {
    const { state, unit } = solo([".F.", "..."], "mediumTank");
    // Through the forest: 2 + 1 = 3. Around it: 4.
    expect(cheapestPath(state, reachableTiles(state, unit), P(2, 0))).toEqual([P(1, 0), P(2, 0)]);
  });

  it("the cheapest path goes around terrain that costs more than the detour", () => {
    const { state, unit } = solo([".bb.", "...."], "mediumTank");
    // Through the bocage: 3 + 3 + 1 = 7, over the 6 move points. Around it: 5.
    expect(cheapestPath(state, reachableTiles(state, unit), P(3, 0))).toEqual([P(0, 1), P(1, 1), P(2, 1), P(3, 1), P(3, 0)]);
  });
});

describe("path checks", () => {
  const { state, unit } = solo([".....", "....."], "infantry", [{ type: "infantry", owner: 1, pos: P(1, 1) }]);

  it("accepts a legal path and reports its cost", () => {
    expect(checkPath(state, unit, [P(1, 0), P(2, 0)])).toEqual({ ok: true, cost: 2 });
  });

  it("an empty path means staying put, costing nothing", () => {
    expect(checkPath(state, unit, [])).toEqual({ ok: true, cost: 0 });
  });

  it("rejects steps that aren't adjacent", () => {
    expect(checkPath(state, unit, [P(2, 0)])).toMatchObject({ ok: false, reason: expect.stringMatching(/not next to/) as unknown });
  });

  it("rejects steps off the map", () => {
    expect(checkPath(state, unit, [P(-1, 0)])).toMatchObject({ ok: false, reason: expect.stringMatching(/outside/) as unknown });
  });

  it("rejects paths that revisit a tile", () => {
    expect(checkPath(state, unit, [P(1, 0), P(0, 0)])).toMatchObject({ ok: false, reason: expect.stringMatching(/revisits/) as unknown });
  });

  it("rejects paths through enemies", () => {
    expect(checkPath(state, unit, [P(0, 1), P(1, 1)])).toMatchObject({ ok: false, reason: expect.stringMatching(/blocked/) as unknown });
  });

  it("rejects paths that cost more than the unit's move points", () => {
    expect(checkPath(state, unit, [P(1, 0), P(2, 0), P(3, 0), P(4, 0)])).toMatchObject({
      ok: false,
      reason: expect.stringMatching(/more than the 3/) as unknown,
    });
  });
});

describe("Move command", () => {
  const base = makeGame(["....", "...."], [
    { type: "recon", owner: 0, pos: P(0, 0) },
    { type: "infantry", owner: 1, pos: P(3, 1) },
    { type: "infantry", owner: 0, pos: P(0, 1) },
  ]);

  it("moves the unit, spends fuel equal to the movement cost, and marks it as acted", () => {
    const { state, events } = mustApply(base, move(0, [P(1, 0), P(2, 0)]));
    expect(state.units[0]).toMatchObject({ pos: P(2, 0), fuel: 80 - 4, hasActed: true });
    expect(events).toEqual([
      { type: "unitMoved", unitId: 0, path: [P(0, 0), P(1, 0), P(2, 0)], fuelUsed: 4 },
      { type: "unitWaited", unitId: 0 },
    ]);
  });

  it("waiting in place is allowed and costs no fuel", () => {
    const { state, events } = mustApply(base, move(0, []));
    expect(state.units[0]).toMatchObject({ pos: P(0, 0), fuel: 80, hasActed: true });
    expect(events).toEqual([{ type: "unitWaited", unitId: 0 }]);
  });

  it("a unit with no fuel can still wait", () => {
    const state = makeGame([".."], [{ type: "mediumTank", owner: 0, pos: P(0, 0), fuel: 0 }]);
    expect(apply(state, move(0, [])).ok).toBe(true);
    expect(apply(state, move(0, [P(1, 0)]))).toMatchObject({ ok: false, code: "invalidPath" });
  });

  it("a unit can't act twice in a turn", () => {
    const { state } = mustApply(base, move(0, [P(1, 0)]));
    expect(apply(state, move(0, [P(2, 0)]))).toMatchObject({ ok: false, code: "unitAlreadyActed" });
  });

  it("a player can't move the other player's units", () => {
    expect(apply(base, move(1, []))).toMatchObject({ ok: false, code: "notYourUnit" });
  });

  it("rejects unknown units", () => {
    expect(apply(base, move(99, []))).toMatchObject({ ok: false, code: "unitNotFound" });
  });

  it("can't end on a friendly unit", () => {
    expect(apply(base, move(0, [P(0, 1)]))).toMatchObject({ ok: false, code: "invalidPath" });
  });

  it("rejects malformed paths and actions from untyped code", () => {
    expect(apply(base, { type: "move", unitId: 0, path: "east", action: { type: "wait" } } as unknown as Command))
      .toMatchObject({ ok: false, code: "invalidCommand" });
    expect(apply(base, { type: "move", unitId: 0, path: [], action: { type: "dance" } } as unknown as Command))
      .toMatchObject({ ok: false, code: "invalidCommand" });
  });

  it("units are ready again at the start of their owner's next turn", () => {
    let state = mustApply(base, move(0, [P(1, 0)])).state;
    state = mustApply(state, { type: "endTurn" }).state;
    expect(state.units[0]?.hasActed).toBe(true); // still the other player's turn
    state = mustApply(state, { type: "endTurn" }).state;
    expect(state.units[0]?.hasActed).toBe(false);
  });

  it("never mutates the state it is given", () => {
    const frozen = deepFreeze(base);
    expect(() => mustApply(frozen, move(0, [P(1, 0)]))).not.toThrow();
  });
});

describe("movement properties", () => {
  const MAP = ["..F.H~=.", ".bb.=...", "=.F..H.F", "...b=..."];
  const types = ["infantry", "assaultInfantry", "recon", "mediumTank", "artillery", "rocketArtillery"] as const;

  const arbitraryGame = fc.record({
    type: fc.constantFrom(...types),
    x: fc.nat(7),
    y: fc.nat(3),
    fuel: fc.nat(20),
    blockers: fc.array(fc.record({ x: fc.nat(7), y: fc.nat(3), enemy: fc.boolean() }), { maxLength: 6 }),
  }).map(({ type, x, y, fuel, blockers }) => {
    const units: UnitSetup[] = [{ type: "infantry", owner: 0, pos: P(x, y), fuel }];
    // Swap in the chosen type only where it can stand; infantry can stand anywhere on this map except sea.
    if (type !== "infantry") units[0] = { type, owner: 0, pos: P(x, y), fuel };
    for (const b of blockers) {
      if (units.some((u) => u.pos.x === b.x && u.pos.y === b.y)) continue;
      units.push({ type: "infantry", owner: b.enemy ? 1 : 0, pos: P(b.x, b.y) });
    }
    return makeGame(MAP, units);
  });

  it("every destination shown in the move range is accepted by the Move command, at the cheapest cost", () => {
    fc.assert(fc.property(arbitraryGame, (state) => {
      const unit = state.units[0];
      if (!unit) throw new Error("no unit");
      const reach = reachableTiles(state, unit);
      for (const dest of moveDestinations(state, unit)) {
        const path = cheapestPath(state, reach, dest);
        expect(path).not.toBeNull();
        const result = apply(state, move(unit.id, path ?? []));
        expect(result.ok).toBe(true);
        if (result.ok) {
          const moved = result.state.units[0];
          expect(moved?.pos).toEqual(dest);
          expect(moved?.fuel).toBe(unit.fuel - (reach.get(dest.y * state.map.width + dest.x)?.cost ?? NaN));
          expect(moved?.fuel).toBeGreaterThanOrEqual(0);
        }
      }
    }));
  });

  it("no legal path leads outside the move range", () => {
    fc.assert(fc.property(
      arbitraryGame,
      fc.array(fc.constantFrom(P(0, -1), P(1, 0), P(0, 1), P(-1, 0)), { maxLength: 8 }),
      (state, steps) => {
        const unit = state.units[0];
        if (!unit) throw new Error("no unit");
        const path: Point[] = [];
        let at = unit.pos;
        for (const s of steps) {
          at = P(at.x + s.x, at.y + s.y);
          path.push(at);
        }
        if (checkPath(state, unit, path).ok) {
          expect(moveDestinations(state, unit)).toContainEqual(path[path.length - 1] ?? unit.pos);
        }
      },
    ));
  });
});
