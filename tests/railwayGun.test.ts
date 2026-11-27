import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import { attackTargets } from "../src/engine/combat";
import type { Command } from "../src/engine/commands";
import { UNITS, UNIT_TYPE_IDS } from "../src/engine/data/units";
import { buildOptions } from "../src/engine/economy";
import { terrainAt, type Point } from "../src/engine/map";
import { moveDestinations } from "../src/engine/movement";
import type { UnitSetup } from "../src/engine/setup";
import { fortAt, type GameState, type Unit } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { makeGame } from "./helpers";

// The Railway Gun (01-units §2b) and the Railway terrain it runs on (02-terrain §4c).
// "R" is a Railway square. The Railway Gun belongs to player 1 (Germany) unless a test says otherwise.

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const run = (state: GameState, ...commands: Command[]) =>
  commands.reduce((s, c) => {
    const result = apply(s, c);
    if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
    return result.state;
  }, state);
const unitOf = (state: GameState, type: UnitSetup["type"]): Unit => {
  const unit = state.units.find((u) => u.type === type);
  if (!unit) throw new Error(`no ${type}`);
  return unit;
};
/** Units on a map, luck off. Player 0 moves first. */
const game = (rows: string[], units: UnitSetup[]) => makeGame(rows, units, { settings: { luck: false } });
const gun = (pos: Point, extra: Partial<UnitSetup> = {}): UnitSetup => ({ type: "railwayGun", owner: 0, pos, ...extra });
const reaches = (state: GameState, type: UnitSetup["type"], p: Point) =>
  moveDestinations(state, unitOf(state, type)).some((q) => q.x === p.x && q.y === p.y);
const fire = (state: GameState, target: Point): Command => {
  const defender = state.units.find((u) => u.pos.x === target.x && u.pos.y === target.y);
  if (!defender) throw new Error("nothing to fire at");
  return { type: "move", unitId: unitOf(state, "railwayGun").id, path: [], action: { type: "attack", target: defender.id } };
};

describe("the Railway terrain (02-terrain §4c)", () => {
  it("a Railway square has no defense stars, like a road", () => {
    const state = game(["R......."], [{ type: "infantry", owner: 0, pos: P(0, 0) }, { type: "infantry", owner: 1, pos: P(7, 0) }]);
    expect(stats.terrainStars(state, unitOf(state, "infantry"))).toBe(0);
  });

  it("every other land unit moves along a railway as along a road, wheels included", () => {
    const state = game(["R...", "...."], [{ type: "recon", owner: 0, pos: P(1, 1) }, { type: "infantry", owner: 1, pos: P(3, 1) }]);
    const recon = unitOf(state, "recon");
    expect(stats.moveCost(state, recon, "railway")).toBe(1);
    expect(stats.moveCost(state, recon, "railway")).toBe(stats.moveCost(state, recon, "road"));
    for (const type of ["infantry", "assaultInfantry", "halftrack", "mediumTank"] as const) {
      const s = game(["R...", "...."], [{ type, owner: 0, pos: P(1, 1) }, { type: "infantry", owner: 1, pos: P(3, 1) }]);
      expect(stats.moveCost(s, unitOf(s, type), "railway"), type).toBe(1);
    }
  });

  it("a railway is its own bridge: vehicles cross a river where the line does", () => {
    const state = game(["~~~", ".R.", "~~~"], [{ type: "mediumTank", owner: 0, pos: P(0, 1) }, { type: "infantry", owner: 1, pos: P(2, 2) }]);
    expect(reaches(state, "mediumTank", P(2, 1))).toBe(true);
  });

  it("aircraft fly over a railway as over anything else", () => {
    const state = game(["R.."], [{ type: "fighter", owner: 0, pos: P(1, 0) }, { type: "infantry", owner: 1, pos: P(2, 0) }]);
    expect(reaches(state, "fighter", P(0, 0))).toBe(true);
  });
});

describe("Railway Gun movement (01-units §2b)", () => {
  it("can only move onto Railway squares", () => {
    const state = game(["....", "RR..", "...."], [gun(P(0, 1)), { type: "infantry", owner: 1, pos: P(3, 2) }]);
    expect(moveDestinations(state, unitOf(state, "railwayGun"))).toEqual([P(0, 1), P(1, 1)]);
  });

  it("moves at most one square of track a turn", () => {
    const state = game(["RRRR", "...."], [gun(P(0, 0)), { type: "infantry", owner: 1, pos: P(3, 1) }]);
    expect(reaches(state, "railwayGun", P(1, 0))).toBe(true);
    expect(reaches(state, "railwayGun", P(2, 0))).toBe(false);
  });

  it("can't move onto a road, a bridge or a property, even one the line runs into", () => {
    for (const ch of ["=", "#", "C", "f", "Q", "."]) {
      const state = game([`R${ch}R`, "..."], [gun(P(0, 0)), { type: "infantry", owner: 1, pos: P(2, 1) }]);
      expect(reaches(state, "railwayGun", P(1, 0)), ch).toBe(false);
    }
  });

  it("can't get past a unit standing on the track ahead of it", () => {
    const state = game(["RRR", "..."], [gun(P(0, 0)), { type: "infantry", owner: 1, pos: P(1, 0) }]);
    expect(reaches(state, "railwayGun", P(1, 0))).toBe(false);
  });

  it("no transport can carry it", () => {
    for (const type of UNIT_TYPE_IDS) expect(UNITS[type].transport?.carries ?? [], type).not.toContain("railwayGun");
  });
});

describe("Railway Gun fire (01-units §2b, 03-combat §5)", () => {
  const line = "R" + ".".repeat(21);

  it("hits targets 3 to 20 squares away, and nothing nearer or farther", () => {
    for (const [x, ok] of [[1, false], [2, false], [3, true], [20, true], [21, false]] as const) {
      const state = game([line], [gun(P(0, 0)), { type: "infantry", owner: 1, pos: P(x, 0) }]);
      expect(attackTargets(state, unitOf(state, "railwayGun"), false).length, `distance ${x}`).toBe(ok ? 1 : 0);
    }
  });

  it("can't move and fire in the same turn", () => {
    const state = game(["RR" + ".".repeat(5)], [gun(P(0, 0)), { type: "infantry", owner: 1, pos: P(6, 0) }]);
    expect(attackTargets(state, unitOf(state, "railwayGun"), true)).toEqual([]);
  });

  it("one full-strength shot destroys a full-strength Medium Tank on open ground", () => {
    const state = game([line], [gun(P(0, 0)), { type: "mediumTank", owner: 1, pos: P(10, 0) }]);
    const after = run(state, fire(state, P(10, 0)));
    expect(after.units.some((u) => u.type === "mediumTank")).toBe(false);
  });

  it("one shot leaves a full-strength unit on Hills on 2 HP", () => {
    const state = game(["R...H......."], [gun(P(0, 0)), { type: "infantry", owner: 1, pos: P(4, 0) }]);
    const after = run(state, fire(state, P(4, 0)));
    expect(unitOf(after, "infantry").hp).toBe(22); // 130 × (200 − 100 − 4 × 10) / 100 = 78
  });

  it("one shot breaks a full bunker, and the garrison inside dies with it (03-combat §4)", () => {
    const state = game(["R....X...."], [gun(P(0, 0)), { type: "infantry", owner: 1, pos: P(5, 0) }]);
    const after = run(state, fire(state, P(5, 0)));
    expect(fortAt(after, P(5, 0))).toBeUndefined();
    expect(terrainAt(after.map, P(5, 0))).toBe("rubble");
    expect(after.units.some((u) => u.owner === 1)).toBe(false);
  });

  it("one shot breaks an empty bunker too", () => {
    const state = game(["R....X....", ".........."], [gun(P(0, 0)), { type: "infantry", owner: 1, pos: P(9, 1) }]);
    const after = run(state, { type: "move", unitId: unitOf(state, "railwayGun").id, path: [], action: { type: "attackFort", target: P(5, 0) } });
    expect(terrainAt(after.map, P(5, 0))).toBe("rubble");
  });

  it("is never fired back at", () => {
    // A Heavy Tank on Hills survives the shot (130 × 0.6 = 78) but can't reach back 3 squares.
    const state = game(["R..H" + ".".repeat(5)], [gun(P(0, 0)), { type: "heavyTank", owner: 1, pos: P(3, 0) }]);
    const after = run(state, fire(state, P(3, 0)));
    expect(unitOf(after, "heavyTank").hp).toBe(22);
    expect(unitOf(after, "railwayGun").hp).toBe(100);
  });

  it("can't hit aircraft", () => {
    const state = game([line], [gun(P(0, 0)), { type: "bomber", owner: 1, pos: P(5, 0) }]);
    expect(attackTargets(state, unitOf(state, "railwayGun"), false)).toEqual([]);
  });

  it("can fire every turn", () => {
    const state = game([line], [gun(P(0, 0)), { type: "heavyTank", owner: 1, pos: P(10, 0), hp: 100 }, { type: "heavyTank", owner: 1, pos: P(12, 0) }]);
    const once = run(state, fire(state, P(10, 0)), endTurn, endTurn);
    const twice = run(once, fire(once, P(12, 0)));
    expect(twice.units.filter((u) => u.type === "heavyTank").length).toBe(0);
  });
});

describe("Railway Gun shells and rearming (01-units §2b, 05-supply-transport §3)", () => {
  const line = "RR" + ".".repeat(10);

  it("carries 3 shells", () => {
    const state = game([line], [gun(P(0, 0)), { type: "infantry", owner: 1, pos: P(11, 0) }]);
    expect(unitOf(state, "railwayGun").ammo).toBe(3);
    expect(stats.maxAmmo(state, unitOf(state, "railwayGun"))).toBe(3);
  });

  it("with no shells left it can't fire at all", () => {
    const state = game([line], [gun(P(0, 0), { ammo: 0 }), { type: "infantry", owner: 1, pos: P(11, 0) }]);
    expect(attackTargets(state, unitOf(state, "railwayGun"), false)).toEqual([]);
  });

  it("each shot spends one shell", () => {
    const state = game([line], [gun(P(0, 0)), { type: "infantry", owner: 1, pos: P(11, 0) }]);
    expect(unitOf(run(state, fire(state, P(11, 0))), "railwayGun").ammo).toBe(2);
  });

  it("a Supply Truck next to it rearms it at the start of its owner's turn", () => {
    const state = game([line, "............"], [gun(P(0, 0), { ammo: 0 }), { type: "supplyTruck", owner: 0, pos: P(0, 1) }, { type: "infantry", owner: 1, pos: P(11, 1) }]);
    const next = run(state, endTurn, endTurn);
    expect(unitOf(next, "railwayGun").ammo).toBe(3);
  });

  it("without a Supply Truck next to it, it stays empty", () => {
    const state = game([line, "............"], [gun(P(0, 0), { ammo: 0 }), { type: "supplyTruck", owner: 0, pos: P(3, 1) }, { type: "infantry", owner: 1, pos: P(11, 1) }]);
    expect(unitOf(run(state, endTurn, endTurn), "railwayGun").ammo).toBe(0);
  });
});

describe("the Railway Gun is never built (01-units §2b)", () => {
  it("no factory offers it, even to a player with no build list", () => {
    const state = makeGame(["f."], [], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    expect(buildOptions(state, P(0, 0)).map((o) => o.type)).not.toContain("railwayGun");
    expect(apply(state, { type: "build", unitType: "railwayGun", pos: P(0, 0) }).ok).toBe(false);
  });
});
