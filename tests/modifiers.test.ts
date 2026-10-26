import { describe, expect, it } from "vitest";
import { applyModifiers, type Modifier } from "../src/engine/modifiers";
import * as stats from "../src/engine/stats";
import { makeGame } from "./helpers";

const unitAt0 = (state: ReturnType<typeof makeGame>) => {
  const unit = state.units[0];
  if (!unit) throw new Error("no unit");
  return unit;
};

describe("modifier layer (00-master-design §7)", () => {
  it("with no modifiers, stats equal the base data", () => {
    const state = makeGame(["..."], [{ type: "mediumTank", owner: 0, pos: { x: 0, y: 0 } }]);
    const tank = unitAt0(state);
    expect(stats.movePoints(state, tank)).toBe(6);
    expect(stats.vision(state, tank)).toBe(2);
    expect(stats.maxFuel(state, tank)).toBe(70);
    expect(stats.maxAmmo(state, tank)).toBe(9);
    expect(stats.attackMod(state, tank)).toBe(100);
    expect(stats.defenseMod(state, tank)).toBe(100);
    expect(stats.attackRange(state, tank)).toEqual({ min: 1, max: 1 });
    expect(stats.unitCost(state, 0, "mediumTank")).toBe(8000);
  });

  it("adds are summed, then multiplied, then rounded down", () => {
    const mods: Modifier[] = [
      { source: "a", stat: "movePoints", op: "add", value: 1 },
      { source: "b", stat: "movePoints", op: "multiply", value: 1.5 },
      { source: "c", stat: "movePoints", op: "add", value: 2 },
    ];
    expect(applyModifiers(6, "movePoints", {}, mods)).toBe(13); // (6 + 1 + 2) × 1.5 = 13.5 → 13
  });

  it("a set overrides everything, the last one wins", () => {
    const mods: Modifier[] = [
      { source: "a", stat: "vision", op: "set", value: 1 },
      { source: "b", stat: "vision", op: "add", value: 5 },
      { source: "c", stat: "vision", op: "set", value: 4 },
    ];
    expect(applyModifiers(2, "vision", {}, mods)).toBe(4);
  });

  it("float error doesn't cost a point (100 × 1.15 = 115)", () => {
    expect(applyModifiers(100, "attack", {}, [{ source: "a", stat: "attack", op: "multiply", value: 1.15 }])).toBe(115);
  });

  it("stats never go below 0", () => {
    expect(applyModifiers(2, "movePoints", {}, [{ source: "a", stat: "movePoints", op: "add", value: -5 }])).toBe(0);
  });

  it("modifiers only apply to matching stats and scopes", () => {
    const mods: Modifier[] = [
      { source: "co", stat: "attack", op: "add", value: 10, scope: { players: [1] } },
      { source: "doctrine", stat: "movePoints", op: "add", value: 1, scope: { unitTypes: ["mediumTank"] } },
      { source: "mud", stat: "movePoints", op: "add", value: -1, scope: { categories: ["land"], terrain: ["plains"] } },
    ];
    const state = makeGame(
      ["..F"],
      [
        { type: "mediumTank", owner: 0, pos: { x: 0, y: 0 } },
        { type: "infantry", owner: 1, pos: { x: 2, y: 0 } },
      ],
      { modifiers: mods },
    );
    const [tank, inf] = state.units;
    if (!tank || !inf) throw new Error("missing units");
    expect(stats.attackMod(state, tank)).toBe(100); // CO bonus is player 1's
    expect(stats.attackMod(state, inf)).toBe(110);
    expect(stats.movePoints(state, tank)).toBe(6); // +1 doctrine, −1 mud on plains
    expect(stats.movePoints(state, inf)).toBe(3); // in forest: no mud, not a tank
  });

  it("cost modifiers can target one player (e.g. a cheap-units commander)", () => {
    const state = makeGame(["."], [], {
      modifiers: [{ source: "co", stat: "cost", op: "multiply", value: 0.8, scope: { players: [1] } }],
    });
    expect(stats.unitCost(state, 0, "infantry")).toBe(1000);
    expect(stats.unitCost(state, 1, "infantry")).toBe(800);
  });
});

describe("veterancy through the modifier layer (03-combat §6)", () => {
  const withKills = (kills: number) => makeGame(["."], [{ type: "infantry", owner: 0, pos: { x: 0, y: 0 }, kills }]);

  it("a rookie (0–2 kills) has attack and defense 100", () => {
    const state = withKills(2);
    expect(stats.attackMod(state, unitAt0(state))).toBe(100);
    expect(stats.defenseMod(state, unitAt0(state))).toBe(100);
  });

  it("a veteran (3+ kills) has attack and defense 110", () => {
    const state = withKills(3);
    expect(stats.attackMod(state, unitAt0(state))).toBe(110);
    expect(stats.defenseMod(state, unitAt0(state))).toBe(110);
  });

  it("an elite (9+ kills) has attack and defense 120", () => {
    const state = withKills(9);
    expect(stats.attackMod(state, unitAt0(state))).toBe(120);
    expect(stats.defenseMod(state, unitAt0(state))).toBe(120);
  });

  it("veterancy stacks with other attack modifiers", () => {
    const state = makeGame(["."], [{ type: "infantry", owner: 0, pos: { x: 0, y: 0 }, kills: 3 }], {
      modifiers: [{ source: "co", stat: "attack", op: "add", value: 10 }],
    });
    expect(stats.attackMod(state, unitAt0(state))).toBe(120);
  });
});

describe("terrain defense lookups (02-terrain)", () => {
  it("a land unit gets the stars of the tile it stands on", () => {
    const state = makeGame(["H"], [{ type: "infantry", owner: 0, pos: { x: 0, y: 0 } }]);
    expect(stats.terrainStars(state, unitAt0(state))).toBe(4);
  });

  it("air units always get 0 stars, even with modifiers (02-terrain §1)", () => {
    const state = makeGame(["H"], [{ type: "fighter", owner: 0, pos: { x: 0, y: 0 } }], {
      modifiers: [{ source: "x", stat: "terrainStars", op: "add", value: 2 }],
    });
    expect(stats.terrainStars(state, unitAt0(state))).toBe(0);
  });
});
