// The campaign's map AIs (22-campaign §6). Midway's for Japan (§6a): search and strike Midway, then
// every bomber for the US Carriers once they're found, then the invasion. It sees only what Japan
// sees. And the simple "drive on the objective" plan (§6b).

import { describe, expect, it } from "vitest";
import { campaignAi, hasMapPlan } from "../src/ai/maps";
import { CARRIER_STRIKE_BONUS, midwayPhase, midwayPlan, SEARCH_POINTS } from "../src/ai/maps/midway";
import { objectivePlan } from "../src/ai/maps/objectives";
import { AIR_WAR_BONUS, battleOfBritainPlan, LAST_SAILING_DAY, seaLionPhase, SHIPS_TO_SINK } from "../src/ai/maps/battleOfBritain";
import { gazalaPlan, LINE_EAST, SWEEP_POINT } from "../src/ai/maps/gazala";
import { greedyAi } from "../src/ai/greedy";
import { aiStep, makeView } from "../src/ai/player";
import { selfPlay } from "../src/ai/selfplay";
import { INCOME_DAYS, sideAhead, standing } from "../src/ai/standing";
import { UNITS } from "../src/engine/data/units";
import { MISSIONS } from "../src/campaign/missions";
import { missionScenario } from "../src/campaign/setup";
import { apply } from "../src/engine/apply";
import { launchState } from "../src/engine/transport";
import { parseAsciiMap } from "../src/engine/map";
import { createGame, type GameSetup, type UnitSetup } from "../src/engine/setup";
import type { GameState, Unit } from "../src/engine/state";
import { SCENARIOS } from "../src/scenarios";

const makeSetup = (rows: readonly string[], units: readonly UnitSetup[]): GameSetup => ({
  map: parseAsciiMap(rows),
  players: [
    { name: "Allies", nation: "us" },
    { name: "Axis", nation: "germany" },
  ],
  units,
  seed: 1,
});

const US = 0;
const JAPAN = 1;

function midwayGame(): GameState {
  const scenario = SCENARIOS.find((s) => s.id === "midway");
  const mission = MISSIONS.find((m) => m.map === "midway");
  if (!scenario || !mission) throw new Error("no Midway");
  return createGame({ ...missionScenario(scenario, mission).setup, seed: 1 });
}

/** The game on Japan's first turn, the US having done nothing. */
function japansFirstTurn(): GameState {
  const result = apply(midwayGame(), { type: "endTurn" });
  if (!result.ok) throw new Error(result.message);
  return result.state;
}

const usCarrier = (state: GameState): Unit => {
  const carrier = state.units.find((u) => u.owner === US && u.type === "carrier");
  if (!carrier) throw new Error("no US Carrier");
  return carrier;
};

/** Japan's view, with one US Carrier moved into sight next to the Kido Butai. */
function carrierFound(state: GameState): GameState {
  const carrier = usCarrier(state);
  const moved = { ...carrier, pos: { x: 24, y: 10 } };
  return makeView({ ...state, units: state.units.map((u) => (u.id === carrier.id ? moved : u)) }).state;
}

describe("Midway's map AI for Japan (22-campaign §6a)", () => {
  it("the campaign has map AIs on the Battle of Britain, Gazala, Midway and Ten-Go, and plain Greedy elsewhere", () => {
    for (const map of ["battle-of-britain", "gazala", "midway", "ten-go"]) expect(hasMapPlan(map), map).toBe(true);
    expect(hasMapPlan("normandy")).toBe(false);
    expect(campaignAi("battle-of-britain").name).toMatch(/Sea Lion plan/);
    expect(campaignAi("gazala").name).toMatch(/Rommel's sweep/);
    expect(campaignAi("ten-go").name).toMatch(/Okinawa plan/);
    expect(campaignAi("midway").name).toMatch(/Midway plan/);
    expect(campaignAi("normandy").name).toBe("Greedy");
  });

  it("it sees only what Japan sees: at the start the US Carriers are hidden, so it's searching (22-campaign §6)", () => {
    const view = makeView(japansFirstTurn()).state;
    expect(view.units.some((u) => u.owner === US && u.type === "carrier")).toBe(false);
    expect(midwayPhase(view)).toBe("search");
  });

  it("the search fan is fixed points on the map, set before the game and the same in every game", () => {
    expect(SEARCH_POINTS.length).toBeGreaterThan(0);
    const game = midwayGame();
    for (const p of SEARCH_POINTS) {
      expect(p.x).toBeLessThan(game.map.width);
      expect(p.y).toBeLessThan(game.map.height);
    }
  });

  it("on its first turn a Fighter takes off to search or spot, though nothing is in reach to attack", async () => {
    let state = japansFirstTurn();
    const ai = campaignAi("midway");
    const launched: string[] = [];
    for (let sent = 0; state.currentPlayer === JAPAN && sent < 300; sent++) {
      const before = state;
      const step = await aiStep(state, ai, sent);
      expect(step.bug).toBeNull();
      const { command } = step;
      if (command.type === "launch") {
        const aircraft = before.units.flatMap((u) => u.cargo).find((c) => c.id === command.unitId);
        if (aircraft) launched.push(`${aircraft.type}:${command.action.type}`);
      }
      state = step.state;
    }
    expect(launched).toContain("fighter:wait");
  });

  it("once a US Carrier is found, it's what Japan strikes", () => {
    expect(midwayPhase(carrierFound(japansFirstTurn()))).toBe("strike");
  });

  it("once a US Carrier is found, an attack on a Carrier scores a large bonus and a bomber aboard won't launch at anything else", () => {
    const view = carrierFound(japansFirstTurn());
    const plan = midwayPlan();
    const carrier = view.units.find((u) => u.owner === JAPAN && u.type === "carrier" && u.cargo.some((c) => c.type === "diveBomber"));
    const bomber = carrier?.cargo.find((c) => c.type === "diveBomber");
    if (!carrier || !bomber) throw new Error("no Dive Bomber aboard");
    const out = launchState(view, carrier.id, bomber.id);
    const flying = out?.units.find((u) => u.id === bomber.id);
    if (!out || !flying) throw new Error("no launch");
    const target = usCarrier(out);
    const destroyer = { ...target, id: 9999, type: "destroyer" as const };
    expect(plan.attackBonus?.(out, flying, target)).toBe(CARRIER_STRIKE_BONUS);
    expect(plan.attackBonus?.(out, flying, destroyer)).toBe(-Infinity);
  });

  it("before any US Carrier is found, the plan leaves the dawn strike on Midway to Greedy", () => {
    const view = makeView(japansFirstTurn()).state;
    const plan = midwayPlan();
    const bomber = view.units.find((u) => u.owner === JAPAN && u.type === "carrier")?.cargo.find((c) => c.type !== "fighter");
    const marine = view.units.find((u) => u.owner === US && u.type === "infantry") ?? usCarrier(midwayGame());
    if (!bomber) throw new Error("no bomber");
    expect(plan.attackBonus?.(view, bomber, marine)).toBe(0);
  });

  it("once all three US Carriers are sunk, the plan stands down and Greedy plays the invasion", () => {
    const state = japansFirstTurn();
    const sunk: GameState = {
      ...state,
      units: state.units.filter((u) => !(u.owner === US && u.type === "carrier")),
      players: state.players.map((p) => (p.id === US ? { ...p, unitsLost: { ...p.unitsLost, carrier: 3 } } : p)),
    };
    expect(midwayPhase(sunk)).toBe("invade");
    const plan = midwayPlan();
    const fighter = sunk.units.flatMap((u) => u.cargo).find((c) => c.owner === JAPAN && c.type === "fighter");
    if (!fighter) throw new Error("no Fighter");
    expect(plan.goals?.(sunk, fighter)).toBeNull();
  });

  it("it plays a whole Midway mission against Greedy without a single AI bug", async () => {
    const start = midwayGame();
    const report = await selfPlay(start, [greedyAi(), campaignAi("midway")], 12);
    expect(report.problems).toEqual([]);
    expect(report.state.result).not.toBeNull();
  }, 60_000);
});

describe("the objective plan: drive on the objective (22-campaign §6b)", () => {
  /** A 2-player map: the Axis must capture the city at the right; a sea channel cuts off the top row. */
  const rows = [
    "SSSSSSSS",
    "........",
    "......HC",
  ];
  const game = (units: readonly UnitSetup[]): GameState =>
    createGame({
      ...makeSetup(rows, units),
      victory: [{ type: "captureProperties", side: "axis", properties: [{ x: 7, y: 2 }] }, { type: "surviveDays", side: "allies", days: 10 }],
    });

  it("land units head for the objectives their side still has to capture", () => {
    const state = { ...game([{ type: "infantry", owner: 1, pos: { x: 0, y: 2 } }, { type: "mediumTank", owner: 1, pos: { x: 0, y: 1 } }, { type: "infantry", owner: 0, pos: { x: 3, y: 1 } }]), currentPlayer: 1 };
    const plan = objectivePlan("test");
    for (const unit of state.units.filter((u) => u.owner === 1)) expect(plan.goals?.(state, unit)).toEqual([{ x: 7, y: 2 }]);
  });

  it("an objective already taken, or one a unit can't reach over land, gives it no orders", () => {
    const state = { ...game([{ type: "infantry", owner: 1, pos: { x: 0, y: 2 } }, { type: "infantry", owner: 0, pos: { x: 3, y: 1 } }]), currentPlayer: 1 };
    const taken = { ...state, properties: state.properties.map((p) => ({ ...p, owner: 1 })) };
    const plan = objectivePlan("test");
    const infantry = state.units.find((u) => u.owner === 1);
    if (!infantry) throw new Error("no infantry");
    expect(plan.goals?.(taken, infantry)).toBeNull();
    // Out at sea, nothing on land can be walked to.
    expect(plan.goals?.(state, { ...infantry, type: "destroyer", pos: { x: 2, y: 0 } })).toBeNull();
  });

  it("units that can't capture keep off the objective, so they don't block a capturer", () => {
    const state = { ...game([{ type: "infantry", owner: 1, pos: { x: 0, y: 2 } }, { type: "mediumTank", owner: 1, pos: { x: 0, y: 1 } }, { type: "infantry", owner: 0, pos: { x: 3, y: 1 } }]), currentPlayer: 1 };
    const plan = objectivePlan("test");
    const [infantry, tank] = state.units.filter((u) => u.owner === 1);
    if (!infantry || !tank) throw new Error("no units");
    expect(plan.keepOff?.(state, infantry)).toEqual([]);
    expect(plan.keepOff?.(state, tank)).toEqual([{ x: 7, y: 2 }]);
  });
});

describe("who is ahead in a game that hasn't ended (22-campaign §5b)", () => {
  const rows = ["C......C"];
  const setup = (units: readonly UnitSetup[], funds = 0): GameSetup => ({
    ...makeSetup(rows, units),
    players: [
      { name: "Allies", nation: "us", funds },
      { name: "Axis", nation: "germany" },
    ],
    propertyOwners: [{ pos: { x: 0, y: 0 }, owner: 0 }, { pos: { x: 7, y: 0 }, owner: 1 }],
  });

  it("a side's standing is its army at its present strength, plus its funds, plus five days' income", () => {
    const state = createGame(setup([{ type: "mediumTank", owner: 1, pos: { x: 6, y: 0 }, hp: 50 }], 2000));
    const tank = UNITS.mediumTank.cost;
    // The Allies move first and have already had day 1's income: 2,000 + 1,000.
    expect(standing(state)).toEqual({ allies: 3000 + INCOME_DAYS * 1000, axis: tank / 2 + INCOME_DAYS * 1000 });
  });

  it("the side with the higher standing is ahead, and a game that's over counts for its winner", () => {
    const state = createGame(setup([{ type: "mediumTank", owner: 1, pos: { x: 6, y: 0 } }]));
    expect(sideAhead(state)).toBe("axis");
    expect(sideAhead({ ...state, result: { winningSide: "allies", winners: [0], reason: "surviveDays" } })).toBe("allies");
  });
});

describe("the Battle of Britain's map AI: Sea Lion (22-campaign §6c)", () => {
  const game = (): GameState => {
    const scenario = SCENARIOS.find((s) => s.id === "battle-of-britain");
    const mission = MISSIONS.find((m) => m.map === "battle-of-britain");
    if (!scenario || !mission) throw new Error("no Battle of Britain");
    const result = apply(createGame({ ...missionScenario(scenario, mission).setup, seed: 1 }), { type: "endTurn" });
    if (!result.ok) throw new Error(result.message);
    return result.state;
  };
  const sunk = (state: GameState, ships: number): GameState => ({
    ...state,
    players: state.players.map((p) => (p.side === "allies" ? { ...p, unitsLost: { ...p.unitsLost, destroyer: ships } } : p)),
  });

  it("the barges wait in port until enough of the Royal Navy is sunk, or the season is running out", () => {
    const state = game();
    expect(seaLionPhase(state)).toBe("airWar");
    expect(seaLionPhase(sunk(state, SHIPS_TO_SINK))).toBe("invasion");
    expect(seaLionPhase({ ...state, day: LAST_SAILING_DAY })).toBe("invasion");
  });

  it("in the air war a barge's orders are to stay in its port", () => {
    const state = game();
    const barge = state.units.find((u) => u.owner === 1 && u.type === "landingCraft");
    if (!barge) throw new Error("no barge");
    expect(battleOfBritainPlan().goals?.(state, barge)).toEqual([barge.pos]);
  });

  it("before the invasion, warships and radar stations are the targets worth most", () => {
    const state = game();
    const plan = battleOfBritainPlan();
    const bomber = state.units.find((u) => u.owner === 1 && u.type === "bomber");
    const destroyer = state.units.find((u) => u.owner === 0 && u.type === "destroyer");
    const infantry = state.units.find((u) => u.owner === 0 && u.type === "infantry");
    if (!bomber || !destroyer || !infantry) throw new Error("setup");
    expect(plan.attackBonus?.(state, bomber, destroyer)).toBe(AIR_WAR_BONUS);
    expect(plan.attackBonus?.(state, bomber, infantry)).toBe(0);
  });
});

describe("Gazala's map AI: Rommel's sweep (22-campaign §6d)", () => {
  const game = (): GameState => {
    const scenario = SCENARIOS.find((s) => s.id === "gazala");
    const mission = MISSIONS.find((m) => m.map === "gazala");
    if (!scenario || !mission) throw new Error("no Gazala");
    return { ...createGame({ ...missionScenario(scenario, mission).setup, seed: 1 }), currentPlayer: 2 };
  };

  it("the assault force south of the line heads round the south end of the minefield, not into it", () => {
    const state = game();
    const tank = state.units.find((u) => u.owner === 2 && u.type === "mediumTank" && u.pos.y >= 18 && u.pos.x < LINE_EAST);
    if (!tank) throw new Error("no tank in the assault force");
    expect(gazalaPlan().goals?.(state, tank)).toEqual([SWEEP_POINT]);
  });

  it("once round the line, the armour drives on Tobruk", () => {
    const state = game();
    const tank = state.units.find((u) => u.owner === 2 && u.type === "mediumTank");
    if (!tank) throw new Error("no tank");
    expect(gazalaPlan().goals?.(state, { ...tank, pos: { x: LINE_EAST + 2, y: 25 } })).toEqual([{ x: 29, y: 9 }]);
  });

  it("an empty Halftrack goes to the tanks in the sweep that are lowest on fuel", () => {
    const state = game();
    const tanks = state.units.filter((u) => u.owner === 2 && u.type === "mediumTank" && u.pos.y >= 18);
    const thirsty = tanks[0];
    const halftrack = state.units.find((u) => u.owner === 2 && u.type === "halftrack");
    if (!thirsty || !halftrack) throw new Error("setup");
    const low: GameState = { ...state, units: state.units.map((u) => (u.id === thirsty.id ? { ...u, fuel: 3 } : u)) };
    expect(gazalaPlan().goals?.(low, { ...halftrack, cargo: [] })).toEqual([thirsty.pos]);
  });
});
