import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import { damageFormula, forecast } from "../src/engine/combat";
import type { GameEvent } from "../src/engine/commands";
import { BRANCHES, COMMANDER_IDS, COMMANDERS, type CommanderId } from "../src/engine/data/commanders";
import { NATIONS, type NationId } from "../src/engine/data/nations";
import type { Point } from "../src/engine/map";
import type { GameSetup, UnitSetup } from "../src/engine/setup";
import type { GameState, Unit } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });

interface Sides {
  readonly allies?: CommanderId;
  readonly axis?: CommanderId;
  readonly alliedNation?: NationId;
  readonly axisNation?: NationId;
}

/** Player 0 is Allied (the US unless stated), player 1 Axis (Germany unless stated). Luck is off, so damage is exact. */
function game(rows: string[], units: UnitSetup[], sides: Sides = {}, overrides: Partial<Omit<GameSetup, "map" | "units" | "players">> = {}): GameState {
  return makeGame(rows, units, {
    settings: { luck: false },
    players: [
      { name: "Allies", nation: sides.alliedNation ?? "us", ...(sides.allies ? { commander: sides.allies } : {}) },
      { name: "Axis", nation: sides.axisNation ?? "germany", ...(sides.axis ? { commander: sides.axis } : {}) },
    ],
    ...overrides,
  });
}

function unit(state: GameState, id: number): Unit {
  const found = state.units.find((u) => u.id === id);
  if (!found) throw new Error(`no unit ${id}`);
  return found;
}

/** The lowest damage unit `a` would do attacking unit `d`. With luck off it is the exact damage. */
function attackDamage(state: GameState, a = 0, d = 1): number {
  const f = forecast(state, unit(state, a), unit(state, d));
  if (!f) throw new Error("no weapon");
  return f.attack.min;
}

function counterDamage(state: GameState, a = 0, d = 1): number {
  const f = forecast(state, unit(state, a), unit(state, d));
  if (!f?.counter) throw new Error("no counter");
  return f.counter.min;
}

describe("commanders: who may have one (06-commanders §2)", () => {
  it("a player with no commander has no commander modifiers", () => {
    const state = game(["..."], [{ type: "mediumTank", owner: 0, pos: P(0, 0) }]);
    expect(state.players[0]?.commander).toBeUndefined();
    expect(stats.commanderModifiers(state)).toEqual([]);
    expect(stats.movePoints(state, unit(state, 0))).toBe(6);
  });

  it("a commander serves any nation on their own side", () => {
    const state = game(["..."], [{ type: "mediumTank", owner: 0, pos: P(0, 0) }], { allies: "harlan", alliedNation: "uk" });
    expect(state.players[0]?.commander).toBe("harlan");
    expect(stats.movePoints(state, unit(state, 0))).toBe(7);
  });

  it("a commander never serves the other side", () => {
    expect(() => game(["..."], [], { allies: "falk" })).toThrow(/own side/);
    expect(() => game(["..."], [], { axis: "harlan" })).toThrow(/own side/);
  });

  it("two players on one side may have the same commander", () => {
    const state = makeGame(["...."], [], {
      players: [
        { name: "US", nation: "us", commander: "ashdown" },
        { name: "UK", nation: "uk", commander: "ashdown" },
        { name: "Germany", nation: "germany" },
      ],
    });
    expect(state.players.map((p) => p.commander)).toEqual(["ashdown", "ashdown", undefined]);
  });

  it("a commander's effects apply only to their own player's units", () => {
    const state = game(
      ["...."],
      [
        { type: "mediumTank", owner: 0, pos: P(0, 0) },
        { type: "mediumTank", owner: 1, pos: P(3, 0) },
      ],
      { allies: "harlan" },
    );
    expect(stats.movePoints(state, unit(state, 0))).toBe(7);
    expect(stats.movePoints(state, unit(state, 1))).toBe(6);
  });

  it("there are six Allied commanders and five Axis, each with bonuses and one drawback (06-commanders §3)", () => {
    const sides = COMMANDER_IDS.map((id) => NATIONS[COMMANDERS[id].nation].side);
    expect(sides.filter((s) => s === "allies")).toHaveLength(6);
    expect(sides.filter((s) => s === "axis")).toHaveLength(5);
    for (const id of COMMANDER_IDS) {
      expect(COMMANDERS[id].bonuses.length).toBeGreaterThan(0);
      expect(COMMANDERS[id].drawback).not.toBe("");
    }
  });

  it("each side has a tanks, an infantry, a naval and an air commander (06-commanders §2)", () => {
    for (const side of ["allies", "axis"] as const) {
      const branches = new Set(COMMANDER_IDS.filter((id) => NATIONS[COMMANDERS[id].nation].side === side).map((id) => COMMANDERS[id].branch));
      expect([...branches].sort()).toEqual([...BRANCHES].sort());
    }
  });
});

describe("Walt Harlan (06-commanders §3)", () => {
  it("his tanks move 1 further", () => {
    const state = game(
      ["....."],
      [
        { type: "lightTank", owner: 0, pos: P(0, 0) },
        { type: "mediumTank", owner: 0, pos: P(1, 0) },
        { type: "heavyTank", owner: 0, pos: P(2, 0) },
        { type: "recon", owner: 0, pos: P(3, 0) },
      ],
      { allies: "harlan" },
    );
    expect([0, 1, 2, 3].map((id) => stats.movePoints(state, unit(state, id)))).toEqual([8, 7, 5, 8]);
  });

  it("his units repair 3 HP per turn on a property, not 2", () => {
    const setup = (allies?: CommanderId) =>
      game(["C.."], [{ type: "infantry", owner: 0, pos: P(0, 0), hp: 50 }], allies ? { allies } : {}, { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    // The first turn starts as the game is made, so the repair has already happened.
    expect(unit(setup(), 0).hp).toBe(70);
    expect(unit(setup("harlan"), 0).hp).toBe(80);
  });

  it("his indirect fire attacks at −10%", () => {
    const state = game(
      ["..."],
      [
        { type: "artillery", owner: 0, pos: P(0, 0) },
        { type: "mortar", owner: 0, pos: P(1, 0) },
        { type: "infantry", owner: 0, pos: P(2, 0) },
      ],
      { allies: "harlan" },
    );
    expect([0, 1, 2].map((id) => stats.attackMod(state, unit(state, id)))).toEqual([90, 90, 100]);
  });
});

describe("Dale Calloway (06-commanders §3)", () => {
  it("his ships move 1 further and defend at +10%", () => {
    const state = game(["SS."], [{ type: "destroyer", owner: 0, pos: P(0, 0) }], { allies: "calloway" });
    expect(stats.movePoints(state, unit(state, 0))).toBe(7);
    expect(stats.defenseMod(state, unit(state, 0))).toBe(110);
  });

  it("his tanks attack at −10%, his other land units as usual", () => {
    const state = game(
      ["..."],
      [
        { type: "mediumTank", owner: 0, pos: P(0, 0) },
        { type: "tankDestroyer", owner: 0, pos: P(1, 0) },
      ],
      { allies: "calloway" },
    );
    expect(stats.attackMod(state, unit(state, 0))).toBe(90);
    expect(stats.attackMod(state, unit(state, 1))).toBe(100);
  });
});

describe("Hugh Ashdown (06-commanders §3)", () => {
  it("his indirect fire attacks at +15% and his foot soldiers at +10%", () => {
    const state = game(
      ["....."],
      [
        { type: "artillery", owner: 0, pos: P(0, 0) },
        { type: "rocketArtillery", owner: 0, pos: P(1, 0) },
        { type: "mortar", owner: 0, pos: P(2, 0) },
        { type: "infantry", owner: 0, pos: P(3, 0) },
        { type: "assaultInfantry", owner: 0, pos: P(4, 0) },
      ],
      { allies: "ashdown" },
    );
    expect([0, 1, 2, 3, 4].map((id) => stats.attackMod(state, unit(state, id)))).toEqual([115, 115, 115, 110, 110]);
  });

  it("his tanks move 1 less", () => {
    const state = game(["..."], [{ type: "mediumTank", owner: 0, pos: P(0, 0) }], { allies: "ashdown" });
    expect(stats.movePoints(state, unit(state, 0))).toBe(5);
  });
});

describe("Luc Tremblay (06-commanders §3)", () => {
  it("his Halftracks move 1 further", () => {
    const state = game(["..."], [{ type: "halftrack", owner: 0, pos: P(0, 0) }], { allies: "tremblay" });
    expect(stats.movePoints(state, unit(state, 0))).toBe(7);
  });

  it("his units are Veterans at 2 kills and Elite at 5, others at 3 and 9 (03-combat §6)", () => {
    const state = game(
      ["...."],
      [
        { type: "mediumTank", owner: 0, pos: P(0, 0), kills: 2 },
        { type: "mediumTank", owner: 0, pos: P(1, 0), kills: 5 },
        { type: "mediumTank", owner: 1, pos: P(2, 0), kills: 2 },
        { type: "mediumTank", owner: 1, pos: P(3, 0), kills: 5 },
      ],
      { allies: "tremblay" },
    );
    expect([0, 1, 2, 3].map((id) => stats.veterancy(state, unit(state, id)).level)).toEqual(["veteran", "elite", "rookie", "veteran"]);
    expect(stats.attackMod(state, unit(state, 0))).toBe(110);
    expect(stats.defenseMod(state, unit(state, 1))).toBe(120);
  });

  it("his unit is promoted to Veteran by its second kill", () => {
    const state = game(
      [".."],
      [
        { type: "mediumTank", owner: 0, pos: P(0, 0), kills: 1 },
        { type: "infantry", owner: 1, pos: P(1, 0), hp: 10 },
      ],
      { allies: "tremblay" },
    );
    const result = apply(state, { type: "move", unitId: 0, path: [], action: { type: "attack", target: 1 } });
    if (!result.ok) throw new Error(result.message);
    const combat = result.events.find((e): e is Extract<GameEvent, { type: "combat" }> => e.type === "combat");
    expect(combat?.attacker.promotedTo).toBe("veteran");
  });

  it("his air units attack at −10%", () => {
    const state = game(["..."], [{ type: "fighter", owner: 0, pos: P(0, 0) }], { allies: "tremblay" });
    expect(stats.attackMod(state, unit(state, 0))).toBe(90);
  });
});

describe("Stepan Morozov (06-commanders §3)", () => {
  it("his units cost 10% less", () => {
    const state = game(["..."], [], { allies: "morozov" });
    expect(stats.unitCost(state, 0, "infantry")).toBe(900);
    expect(stats.unitCost(state, 0, "mediumTank")).toBe(7200);
    expect(stats.unitCost(state, 1, "mediumTank")).toBe(8000);
  });

  it("his foot soldiers attack at +20% from a City, and nowhere else", () => {
    const state = game(
      ["C.C"],
      [
        { type: "infantry", owner: 0, pos: P(0, 0) },
        { type: "assaultInfantry", owner: 0, pos: P(1, 0) },
        { type: "mediumTank", owner: 0, pos: P(2, 0) },
      ],
      { allies: "morozov" },
    );
    expect([0, 1, 2].map((id) => stats.attackMod(state, unit(state, id)))).toEqual([120, 100, 100]);
  });

  it("his units defend at −10%", () => {
    const state = game(["..."], [{ type: "mediumTank", owner: 0, pos: P(0, 0) }], { allies: "morozov" });
    expect(stats.defenseMod(state, unit(state, 0))).toBe(90);
  });
});

describe("Konrad Falk (06-commanders §3)", () => {
  const tanks = (axis?: CommanderId) =>
    game(
      [".."],
      [
        { type: "mediumTank", owner: 0, pos: P(0, 0) },
        { type: "mediumTank", owner: 1, pos: P(1, 0) },
      ],
      axis ? { axis } : {},
    );

  it("his tanks and Tank Destroyers attack at +15% when they start the fight", () => {
    const state = tanks("falk");
    // Medium Tank on Medium Tank is 55 base; the defender is at full HP on Plains (1 star).
    const expected = damageFormula({ base: 55, attackMod: 115, luck: 0, attackerHp: 10, defenseMod: 100, terrainStars: 1, defenderHp: 10 });
    expect(attackDamage(state, 1, 0)).toBe(expected);
    expect(attackDamage(state, 1, 0)).toBeGreaterThan(attackDamage(tanks(), 1, 0));
    const td = game(["..."], [{ type: "tankDestroyer", owner: 1, pos: P(0, 0) }, { type: "mediumTank", owner: 0, pos: P(1, 0) }], { axis: "falk" });
    expect(stats.attackMod(td, unit(td, 0), { role: "started", opponent: unit(td, 1) })).toBe(115);
  });

  it("his tanks get nothing extra on a counterattack", () => {
    expect(counterDamage(tanks("falk"), 0, 1)).toBe(counterDamage(tanks(), 0, 1));
  });

  it("the attack does what the forecast says", () => {
    const state = { ...tanks("falk"), currentPlayer: 1 };
    const promised = forecast(state, unit(state, 1), unit(state, 0));
    const result = apply(state, { type: "move", unitId: 1, path: [], action: { type: "attack", target: 0 } });
    if (!result.ok) throw new Error(result.message);
    const combat = result.events.find((e): e is Extract<GameEvent, { type: "combat" }> => e.type === "combat");
    expect(combat?.attack.damage).toBe(promised?.attack.min);
    expect(combat?.counter?.damage).toBe(promised?.counter?.min);
  });

  it("his Recon moves 1 further", () => {
    const state = game(["..."], [{ type: "recon", owner: 1, pos: P(0, 0) }], { axis: "falk" });
    expect(stats.movePoints(state, unit(state, 0))).toBe(9);
  });

  it("his units carry 20% less fuel and ammo, from the start", () => {
    const state = game(["..."], [{ type: "mediumTank", owner: 1, pos: P(0, 0) }], { axis: "falk" });
    const tank = unit(state, 0);
    expect(stats.maxFuel(state, tank)).toBe(24);
    expect(stats.maxAmmo(state, tank)).toBe(7);
    expect(tank.fuel).toBe(24);
    expect(tank.ammo).toBe(7);
  });

  it("a unit a scenario starts low on fuel keeps that amount, but never more than it can carry", () => {
    const state = game(
      ["..."],
      [
        { type: "mediumTank", owner: 1, pos: P(0, 0), fuel: 10 },
        { type: "mediumTank", owner: 1, pos: P(1, 0), fuel: 28 },
      ],
      { axis: "falk" },
    );
    expect([unit(state, 0).fuel, unit(state, 1).fuel]).toEqual([10, 24]);
  });
});

describe("Aldo Ferrante (06-commanders §3)", () => {
  it("his units defend at +15% on Hills, Ridges and Cities, and nowhere else", () => {
    const state = game(
      ["HdC."],
      [0, 1, 2, 3].map((x) => ({ type: "infantry" as const, owner: 1, pos: P(x, 0) })),
      { axis: "ferrante" },
    );
    expect([0, 1, 2, 3].map((id) => stats.defenseMod(state, unit(state, id)))).toEqual([115, 115, 115, 100]);
  });

  const tanks = (axis?: CommanderId) =>
    game(
      [".."],
      [
        { type: "mediumTank", owner: 0, pos: P(0, 0) },
        { type: "mediumTank", owner: 1, pos: P(1, 0) },
      ],
      axis ? { axis } : {},
    );

  it("his units counterattack at +20%", () => {
    const state = tanks("ferrante");
    expect(stats.attackMod(state, unit(state, 1), { role: "answered", opponent: unit(state, 0) })).toBe(120);
    expect(counterDamage(state, 0, 1)).toBeGreaterThan(counterDamage(tanks(), 0, 1));
  });

  it("his units attack at −10% when they start the fight", () => {
    const state = tanks("ferrante");
    expect(stats.attackMod(state, unit(state, 1), { role: "started", opponent: unit(state, 0) })).toBe(90);
    expect(attackDamage(state, 1, 0)).toBeLessThan(attackDamage(tanks(), 1, 0));
  });
});

describe("Kenji Arakawa (06-commanders §3)", () => {
  it("his Dive Bombers and Torpedo Bombers move 1 further and attack at +10%", () => {
    const state = game(
      ["..."],
      [
        { type: "diveBomber", owner: 1, pos: P(0, 0) },
        { type: "torpedoBomber", owner: 1, pos: P(1, 0) },
        { type: "bomber", owner: 1, pos: P(2, 0) },
      ],
      { axis: "arakawa" },
    );
    expect([0, 1, 2].map((id) => stats.movePoints(state, unit(state, id)))).toEqual([7, 7, 7]);
    expect([0, 1, 2].map((id) => stats.attackMod(state, unit(state, id)))).toEqual([110, 110, 100]);
  });

  it("his land units on Hills defend at +25% against indirect fire, ships and bombers, and as usual against the rest", () => {
    const state = game(
      ["H....S"],
      [
        { type: "mediumTank", owner: 1, pos: P(0, 0) },
        { type: "artillery", owner: 0, pos: P(1, 0) },
        { type: "bomber", owner: 0, pos: P(2, 0) },
        { type: "mediumTank", owner: 0, pos: P(3, 0) },
        { type: "fighter", owner: 0, pos: P(4, 0) },
        { type: "battleship", owner: 0, pos: P(5, 0) },
      ],
      { axis: "arakawa" },
    );
    const against = (id: number) => stats.defenseMod(state, unit(state, 0), { role: "answered", opponent: unit(state, id) });
    expect([1, 2, 3, 4, 5].map(against)).toEqual([125, 125, 100, 100, 125]);
  });

  it("the bonus is only on Bunkers and Hills", () => {
    const state = game(
      ["..."],
      [
        { type: "mediumTank", owner: 1, pos: P(0, 0) },
        { type: "artillery", owner: 0, pos: P(2, 0) },
      ],
      { axis: "arakawa" },
    );
    expect(stats.defenseMod(state, unit(state, 0), { role: "answered", opponent: unit(state, 1) })).toBe(100);
  });

  it("a bunker his soldiers hold takes less from artillery, and the same as ever from a tank (06-commanders §6)", () => {
    const shelled = (axis?: CommanderId) =>
      game(
        ["..X"],
        [
          { type: "artillery", owner: 0, pos: P(0, 0) },
          { type: "infantry", owner: 1, pos: P(2, 0) },
        ],
        axis ? { axis } : {},
      );
    const stormed = (axis?: CommanderId) =>
      game(
        [".X"],
        [
          { type: "mediumTank", owner: 0, pos: P(0, 0) },
          { type: "infantry", owner: 1, pos: P(1, 0) },
        ],
        axis ? { axis } : {},
      );
    expect(attackDamage(shelled("arakawa"))).toBeLessThan(attackDamage(shelled()));
    expect(attackDamage(stormed("arakawa"))).toBe(attackDamage(stormed()));
  });

  it("his tanks move 1 less", () => {
    const state = game(["..."], [{ type: "lightTank", owner: 1, pos: P(0, 0) }], { axis: "arakawa" });
    expect(stats.movePoints(state, unit(state, 0))).toBe(6);
  });
});

describe("Rhys Penhallow (06-commanders §3)", () => {
  it("his air units attack and defend at +10%, his land units as usual", () => {
    const state = game(
      ["..."],
      [
        { type: "fighter", owner: 0, pos: P(0, 0) },
        { type: "bomber", owner: 0, pos: P(1, 0) },
        { type: "mediumTank", owner: 0, pos: P(2, 0) },
      ],
      { allies: "penhallow" },
    );
    expect([0, 1, 2].map((id) => stats.attackMod(state, unit(state, id)))).toEqual([110, 110, 100]);
    expect([0, 1, 2].map((id) => stats.defenseMod(state, unit(state, id)))).toEqual([110, 110, 100]);
  });

  it("his Fighters move 1 further, his Bombers as usual", () => {
    const state = game(
      [".."],
      [
        { type: "fighter", owner: 0, pos: P(0, 0) },
        { type: "bomber", owner: 0, pos: P(1, 0) },
      ],
      { allies: "penhallow" },
    );
    expect([0, 1].map((id) => stats.movePoints(state, unit(state, id)))).toEqual([10, 7]);
  });

  it("his ships attack at −10%", () => {
    const state = game(["S"], [{ type: "destroyer", owner: 0, pos: P(0, 0) }], { allies: "penhallow" });
    expect(stats.attackMod(state, unit(state, 0))).toBe(90);
  });
});

describe("Jakob Wendt (06-commanders §3)", () => {
  it("his foot soldiers attack and defend at +15%, his tanks as usual", () => {
    const state = game(
      ["..."],
      [
        { type: "infantry", owner: 1, pos: P(0, 0) },
        { type: "assaultInfantry", owner: 1, pos: P(1, 0) },
        { type: "mediumTank", owner: 1, pos: P(2, 0) },
      ],
      { axis: "wendt" },
    );
    expect([0, 1, 2].map((id) => stats.attackMod(state, unit(state, id)))).toEqual([115, 115, 100]);
    expect([0, 1, 2].map((id) => stats.defenseMod(state, unit(state, id)))).toEqual([115, 115, 100]);
  });

  it("an attack on his infantry does less damage", () => {
    const fight = (axis?: CommanderId) =>
      game(
        [".."],
        [
          { type: "mediumTank", owner: 0, pos: P(0, 0) },
          { type: "infantry", owner: 1, pos: P(1, 0) },
        ],
        axis ? { axis } : {},
      );
    expect(attackDamage(fight("wendt"))).toBeLessThan(attackDamage(fight()));
  });

  it("his Mortar Teams move 1 further", () => {
    const state = game(["..."], [{ type: "mortar", owner: 1, pos: P(0, 0) }], { axis: "wendt" });
    expect(stats.movePoints(state, unit(state, 0))).toBe(3);
  });

  it("his air units cost 10% more, everything else as usual", () => {
    const state = game(["..."], [], { axis: "wendt" });
    expect(stats.unitCost(state, 1, "fighter")).toBe(22000);
    expect(stats.unitCost(state, 1, "infantry")).toBe(1000);
    expect(stats.unitCost(state, 0, "fighter")).toBe(20000);
  });
});

describe("Isao Kuramochi (06-commanders §3)", () => {
  const ships = (axis?: CommanderId) =>
    game(
      ["SS"],
      [
        { type: "destroyer", owner: 0, pos: P(0, 0) },
        { type: "destroyer", owner: 1, pos: P(1, 0) },
      ],
      axis ? { axis } : {},
    );

  it("his ships attack at +20% when they start the fight", () => {
    const state = ships("kuramochi");
    expect(stats.attackMod(state, unit(state, 1), { role: "started", opponent: unit(state, 0) })).toBe(120);
    expect(attackDamage(state, 1, 0)).toBeGreaterThan(attackDamage(ships(), 1, 0));
  });

  it("his ships get nothing extra on a counterattack", () => {
    expect(counterDamage(ships("kuramochi"), 0, 1)).toBe(counterDamage(ships(), 0, 1));
  });

  it("his Submarines and Torpedo Boats move 1 further, his Battleships as usual", () => {
    const state = game(
      ["SSS"],
      [
        { type: "submarine", owner: 1, pos: P(0, 0) },
        { type: "torpedoBoat", owner: 1, pos: P(1, 0) },
        { type: "battleship", owner: 1, pos: P(2, 0) },
      ],
      { axis: "kuramochi", axisNation: "japan" },
    );
    expect([0, 1, 2].map((id) => stats.movePoints(state, unit(state, id)))).toEqual([6, 8, 5]);
  });

  it("his foot soldiers attack at −10%", () => {
    const state = game(["..."], [{ type: "infantry", owner: 1, pos: P(0, 0) }], { axis: "kuramochi" });
    expect(stats.attackMod(state, unit(state, 0))).toBe(90);
  });
});
