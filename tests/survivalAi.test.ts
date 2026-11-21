// The computer bringing the waves on a survival map (23-survival §6): Greedy driving on the
// defender's HQ, its aircraft going first for the guns and aircraft that shoot them down.

import { describe, expect, it } from "vitest";
import { survivalAi } from "../src/ai/maps";
import { AIR_DEFENCE_BONUS, enemyHqs, HQ_BLOCKER_BONUS, hqBlockers, survivalPlan } from "../src/ai/maps/survival";
import { chooseCommand } from "../src/ai/greedy";
import type { AiPlayer } from "../src/ai/player";
import { selfPlay } from "../src/ai/selfplay";
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

describe("an aircraft parked on the HQ (23-survival §6)", () => {
  /** The US HQ at the east end of an island; open sea to the west for Japan's ships. */
  const ISLAND = ["SSSSSSSSSSSSSSSS", "SSSSSSSS......Q.", "SSSSSSSS........"];
  const HQ = { x: 14, y: 1 };
  const islandGame = (units: readonly UnitSetup[]): GameState => ({
    ...createGame({
      map: parseAsciiMap(ISLAND),
      players: [
        { name: "US", nation: "us" },
        { name: "Japan", nation: "japan", buildable: [] },
      ],
      propertyOwners: [{ pos: HQ, owner: 0 }],
      units,
      victory: [{ type: "hqCapture" }, { type: "rout", side: "allies" }],
      seed: 1,
    }),
    currentPlayer: 1,
  });
  const parked: UnitSetup = { type: "fighter", owner: 0, pos: HQ };

  it("a unit standing on the HQ is what stops the capture, so it draws every attack that can reach it (23-survival §6)", () => {
    const state = islandGame([parked, { type: "mobileAA", owner: 1, pos: { x: 12, y: 1 } }]);
    const [fighter, aa] = state.units;
    if (!fighter || !aa) throw new Error("missing units");
    expect(hqBlockers(state).map((u) => u.id)).toEqual([fighter.id]);
    expect(survivalPlan("test").attackBonus?.(state, aa, fighter)).toBe(HQ_BLOCKER_BONUS);
  });

  it("fighters and anti-aircraft are sent for an aircraft parked on the HQ; units that can't hit it aren't (23-survival §6)", () => {
    const state = islandGame([
      parked,
      { type: "fighter", owner: 1, pos: { x: 2, y: 0 } },
      { type: "mobileAA", owner: 1, pos: { x: 9, y: 2 } },
      { type: "bomber", owner: 1, pos: { x: 3, y: 0 } },
      { type: "infantry", owner: 1, pos: { x: 9, y: 1 } },
    ]);
    const plan = survivalPlan("test");
    const goal = (type: string) => {
      const unit = state.units.find((u) => u.owner === 1 && u.type === type);
      if (!unit) throw new Error(`no ${type}`);
      return plan.goals?.(state, unit);
    };
    expect(goal("fighter")).toEqual([HQ]);
    expect(goal("mobileAA")).toEqual([HQ]);
    // A bomber can't hit an aircraft; infantry still heads for the HQ to capture it once it's clear.
    expect(goal("bomber")).toBeNull();
    expect(goal("infantry")).toEqual([HQ]);
  });

  it("a fighter aboard a Carrier takes off to go for an aircraft parked on the HQ (23-survival §6)", () => {
    const state = islandGame([parked, { type: "carrier", owner: 1, pos: { x: 0, y: 1 }, cargo: [{ type: "fighter" }] }]);
    const command = chooseCommand(state, undefined, survivalPlan("test"));
    expect(command.type).toBe("launch");
  });

  it("Japan shoots down an aircraft parked on the HQ with a Carrier's fighters (23-survival §6)", async () => {
    // The US just leaves its fighter on the HQ, turn after turn.
    const parkedPlayer: AiPlayer = { name: "parked", chooseCommand: () => ({ type: "endTurn" }) };
    const start = { ...islandGame([parked, { type: "carrier", owner: 1, pos: { x: 0, y: 1 }, cargo: [{ type: "fighter" }, { type: "fighter" }] }, { type: "infantry", owner: 1, pos: { x: 9, y: 1 } }]), currentPlayer: 0 };
    const report = await selfPlay(start, [parkedPlayer, survivalAi()], 15);
    expect(report.problems).toEqual([]);
    // The parked fighter is shot down; it was the US's last unit, so the US is out.
    expect(report.state.players[0]?.unitsLost).toMatchObject({ fighter: 1 });
    expect(report.state.result?.winningSide).toBe("axis");
  });

  it("once the parked aircraft is shot down, Japan's infantry captures the HQ (23-survival §6)", async () => {
    const parkedPlayer: AiPlayer = { name: "parked", chooseCommand: () => ({ type: "endTurn" }) };
    // A US Submarine out at sea, which nothing here can hit, keeps the US in the game until the HQ falls.
    const units: UnitSetup[] = [parked, { type: "submarine", owner: 0, pos: { x: 15, y: 0 } }, { type: "mobileAA", owner: 1, pos: { x: 9, y: 2 } }, { type: "infantry", owner: 1, pos: { x: 9, y: 1 } }];
    const report = await selfPlay({ ...islandGame(units), currentPlayer: 0 }, [parkedPlayer, survivalAi()], 15);
    expect(report.problems).toEqual([]);
    expect(report.state.result).toMatchObject({ winningSide: "axis", reason: "hqCapture" });
  });

  it("Japan shoots down an aircraft parked on the HQ with Mobile AA brought ashore (23-survival §6)", async () => {
    const parkedPlayer: AiPlayer = { name: "parked", chooseCommand: () => ({ type: "endTurn" }) };
    const start = { ...islandGame([parked, { type: "mobileAA", owner: 1, pos: { x: 9, y: 2 } }, { type: "infantry", owner: 1, pos: { x: 9, y: 1 } }]), currentPlayer: 0 };
    const report = await selfPlay(start, [parkedPlayer, survivalAi()], 15);
    expect(report.problems).toEqual([]);
    // The parked fighter is shot down; it was the US's last unit, so the US is out.
    expect(report.state.players[0]?.unitsLost).toMatchObject({ fighter: 1 });
    expect(report.state.result?.winningSide).toBe("axis");
  });
});
