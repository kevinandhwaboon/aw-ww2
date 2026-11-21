// The computer bringing the waves on a survival map (23-survival §6): Greedy driving on the
// defender's HQ, its aircraft going first for the guns and aircraft that shoot them down.

import { describe, expect, it } from "vitest";
import { survivalAi } from "../src/ai/maps";
import { AIR_DEFENCE_BONUS, enemyHqs, survivalPlan } from "../src/ai/maps/survival";
import { parseAsciiMap } from "../src/engine/map";
import { createGame, type UnitSetup } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";

/** The US HQ at the right; a sea channel cuts off the top row. */
const rows = ["SSSSSSSS", "........", "......CQ"];
const game = (units: readonly UnitSetup[]): GameState => ({
  ...createGame({
    map: parseAsciiMap(rows),
    players: [
      { name: "US", nation: "us" },
      { name: "Japan", nation: "japan" },
    ],
    propertyOwners: [{ pos: { x: 7, y: 2 }, owner: 0 }, { pos: { x: 6, y: 2 }, owner: 0 }],
    units,
    victory: [{ type: "hqCapture" }, { type: "rout", side: "allies" }],
    seed: 1,
  }),
  currentPlayer: 1,
});
const US_GUNS: UnitSetup[] = [
  { type: "flakGun", owner: 0, pos: { x: 3, y: 1 } },
  { type: "infantry", owner: 0, pos: { x: 4, y: 1 } },
];

describe("the waves' plan on a survival map (23-survival §6)", () => {
  it("the waves' objective is the defender's HQ (23-survival §6)", () => {
    expect(enemyHqs(game(US_GUNS))).toEqual([{ x: 7, y: 2 }]);
  });

  it("the waves' land units, fighting or capturing, head for the defender's HQ (23-survival §6)", () => {
    const state = game([...US_GUNS, { type: "infantry", owner: 1, pos: { x: 0, y: 2 } }, { type: "lightTank", owner: 1, pos: { x: 0, y: 1 } }]);
    const plan = survivalPlan("test");
    for (const unit of state.units.filter((u) => u.owner === 1)) expect(plan.goals?.(state, unit)).toEqual([{ x: 7, y: 2 }]);
  });

  it("ships and aircraft are left to the usual AI, which lands troops on its own (23-survival §6)", () => {
    const state = game([...US_GUNS, { type: "destroyer", owner: 1, pos: { x: 2, y: 0 } }, { type: "bomber", owner: 1, pos: { x: 0, y: 1 } }]);
    const plan = survivalPlan("test");
    for (const unit of state.units.filter((u) => u.owner === 1)) expect(plan.goals?.(state, unit)).toBeNull();
  });

  it("units that can't capture keep off the HQ, so they don't block a capturer (23-survival §6)", () => {
    const state = game([...US_GUNS, { type: "infantry", owner: 1, pos: { x: 0, y: 2 } }, { type: "lightTank", owner: 1, pos: { x: 0, y: 1 } }]);
    const plan = survivalPlan("test");
    const [infantry, tank] = state.units.filter((u) => u.owner === 1);
    if (!infantry || !tank) throw new Error("no units");
    expect(plan.keepOff?.(state, infantry)).toEqual([]);
    expect(plan.keepOff?.(state, tank)).toEqual([{ x: 7, y: 2 }]);
  });

  it("the raiders go first for Flak Guns and aircraft (23-survival §6)", () => {
    const state = game([...US_GUNS, { type: "fighter", owner: 0, pos: { x: 5, y: 1 } }, { type: "bomber", owner: 1, pos: { x: 2, y: 1 } }, { type: "infantry", owner: 1, pos: { x: 0, y: 2 } }]);
    const plan = survivalPlan("test");
    const bomber = state.units.find((u) => u.type === "bomber");
    const [flak, infantry, fighter] = state.units.filter((u) => u.owner === 0);
    const japaneseInfantry = state.units.find((u) => u.owner === 1 && u.type === "infantry");
    if (!bomber || !flak || !infantry || !fighter || !japaneseInfantry) throw new Error("missing units");
    expect(plan.attackBonus?.(state, bomber, flak)).toBe(AIR_DEFENCE_BONUS);
    expect(plan.attackBonus?.(state, bomber, fighter)).toBe(AIR_DEFENCE_BONUS);
    expect(plan.attackBonus?.(state, bomber, infantry)).toBe(0);
    // Troops on the ground fight as usual.
    expect(plan.attackBonus?.(state, japaneseInfantry, flak)).toBe(0);
  });

  it("the survival computer is Greedy with the survival plan (23-survival §6)", () => {
    expect(survivalAi().name).toBe("Greedy, Survival plan");
  });
});
