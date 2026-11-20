// The campaign (22-campaign): the missions and their order, the computer's advantage, and progress.

import { describe, expect, it } from "vitest";
import { advantageLines } from "../src/campaign/describe";
import { MISSIONS, type CampaignMission } from "../src/campaign/missions";
import { alliesWon, CAMPAIGN_KEY, missionStatus, NO_PROGRESS, readProgress, withWin, writeProgress, type ProgressStore } from "../src/campaign/progress";
import { axisPlayers, missionScenario } from "../src/campaign/setup";
import { NATIONS } from "../src/engine/data/nations";
import { COMMANDERS } from "../src/engine/data/commanders";
import type { Scenario } from "../src/engine/scenario";
import { createGame } from "../src/engine/setup";
import { propertyIncome } from "../src/engine/stats";
import type { GameState } from "../src/engine/state";
import { SCENARIOS } from "../src/scenarios";

const scenarioOf = (map: string): Scenario => {
  const scenario = SCENARIOS.find((s) => s.id === map);
  if (!scenario) throw new Error(`no map ${map}`);
  return scenario;
};
const start = (scenario: Scenario): GameState => createGame({ ...scenario.setup, seed: 1 });

function memoryStore(): ProgressStore & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return { items, getItem: (key) => items.get(key) ?? null, setItem: (key, value) => void items.set(key, value) };
}

describe("the missions (22-campaign §2)", () => {
  it("every built-in map is one campaign mission, and no mission is on a map that isn't built", () => {
    expect(MISSIONS.map((m) => m.map).sort()).toEqual(SCENARIOS.map((s) => s.id).sort());
  });

  it("the missions come in the order the battles were fought", () => {
    expect(MISSIONS.map((m) => m.map)).toEqual([
      "battle-of-britain",
      "gazala",
      "midway",
      "sevastopol",
      "guadalcanal",
      "el-alamein",
      "stalingrad",
      "the-slot",
      "kursk",
      "normandy",
      "market-garden",
      "bastogne",
      "iwo-jima",
      "ten-go",
    ]);
  });

  it("every mission starts: the game accepts every extra unit and property", () => {
    for (const mission of MISSIONS) expect(() => missionScenario(scenarioOf(mission.map), mission), mission.map).not.toThrow();
  });
});

describe("who plays what (22-campaign §3)", () => {
  it("on every map the first player, who moves first, is on the Allied side, and the computer has every Axis player", () => {
    for (const scenario of SCENARIOS) {
      expect(NATIONS[scenario.setup.players[0]?.nation ?? "germany"].side, scenario.id).toBe("allies");
      const axis = axisPlayers(scenario);
      expect(axis.length, scenario.id).toBeGreaterThan(0);
      expect(axis.every((id) => NATIONS[scenario.setup.players[id]?.nation ?? "us"].side === "axis")).toBe(true);
    }
  });

  it("every Axis player has a fixed commander of their own side, and no Allied player has one chosen for them", () => {
    for (const mission of MISSIONS) {
      const game = start(missionScenario(scenarioOf(mission.map), mission));
      for (const player of game.players) {
        if (player.side === "axis") {
          expect(player.commander, `${mission.map} ${player.name}`).toBeDefined();
          expect(NATIONS[COMMANDERS[player.commander ?? "falk"].nation].side).toBe("axis");
        } else expect(player.commander, `${mission.map} ${player.name}`).toBeUndefined();
      }
    }
  });
});

describe("the computer's advantage (22-campaign §4)", () => {
  it("the campaign never changes the map, the victory conditions, the settings or the Allies' starting forces and funds", () => {
    for (const mission of MISSIONS) {
      const base = scenarioOf(mission.map);
      const campaign = missionScenario(base, mission);
      expect(campaign.setup.map).toEqual(base.setup.map);
      expect(campaign.setup.victory).toEqual(base.setup.victory);
      expect(campaign.setup.settings).toEqual(base.setup.settings);
      const axis = axisPlayers(base);
      const allied = (s: Scenario) => (s.setup.units ?? []).filter((u) => !axis.includes(u.owner));
      expect(allied(campaign), mission.map).toEqual(allied(base));
      base.setup.players.forEach((p, id) => {
        if (!axis.includes(id)) expect(campaign.setup.players[id]?.funds ?? 0, `${mission.map} ${p.name}`).toBe(p.funds ?? 0);
      });
    }
  });

  it("extra funds and units go to the Axis player named, on top of what the map gives them", () => {
    const mission: CampaignMission = {
      map: "midway",
      commanders: { 1: "kuramochi" },
      advantage: { funds: { 1: 5000 }, units: [{ type: "carrier", owner: 1, pos: { x: 15, y: 8 }, cargo: [{ type: "diveBomber" }] }] },
    };
    const base = scenarioOf("midway");
    const game = start(missionScenario(base, mission));
    expect(game.players[1]?.funds).toBe((base.setup.players[1]?.funds ?? 0) + 5000);
    const extra = game.units.find((u) => u.pos.x === 15 && u.pos.y === 8);
    expect(extra?.type).toBe("carrier");
    expect(extra?.owner).toBe(1);
    expect(extra?.cargo.map((c) => c.type)).toEqual(["diveBomber"]);
  });

  it("more income is a percentage on each Axis player's daily income, through the modifier layer, and leaves the Allies' alone", () => {
    const mission: CampaignMission = { map: "gazala", commanders: {}, advantage: { incomePercent: 50 } };
    const base = start(scenarioOf("gazala"));
    const game = start(missionScenario(scenarioOf("gazala"), mission));
    for (const player of game.players) {
      const expected = player.side === "axis" ? propertyIncome(base, player.id) * 1.5 : propertyIncome(base, player.id);
      expect(propertyIncome(game, player.id), player.name).toBe(expected);
    }
  });

  it("an extra property starts the Axis player's instead of the Allies'", () => {
    const base = scenarioOf("midway");
    const airstrip = { x: 27, y: 16 };
    const game = start(missionScenario(base, { map: "midway", commanders: {}, advantage: { properties: [{ pos: airstrip, owner: 1 }] } }));
    expect(game.properties.find((p) => p.pos.x === airstrip.x && p.pos.y === airstrip.y)?.owner).toBe(1);
  });

  it("a mission can't give anything to an Allied player", () => {
    const base = scenarioOf("midway");
    expect(() => missionScenario(base, { map: "midway", commanders: {}, advantage: { funds: { 0: 1000 } } })).toThrow(/isn't on the Axis side/);
    expect(() => missionScenario(base, { map: "midway", commanders: { 0: "harlan" }, advantage: {} })).toThrow(/isn't on the Axis side/);
    expect(() =>
      missionScenario(base, { map: "midway", commanders: {}, advantage: { units: [{ type: "infantry", owner: 0, pos: { x: 22, y: 17 } }] } }),
    ).toThrow(/isn't on the Axis side/);
  });

  it("a mission with an extra unit where the game can't put it fails by name", () => {
    const base = scenarioOf("midway");
    // A tank in open ocean.
    expect(() => missionScenario(base, { map: "midway", commanders: {}, advantage: { units: [{ type: "mediumTank", owner: 1, pos: { x: 5, y: 5 } }] } })).toThrow(
      /campaign mission midway/,
    );
  });

  it("extra units are only types that nation fielded on the map: ones it can build there or already has", () => {
    const base = scenarioOf("battle-of-britain");
    // Germany has no warships on the Battle of Britain map (20-scenarios-battle-of-britain).
    expect(() => missionScenario(base, { map: "battle-of-britain", commanders: {}, advantage: { units: [{ type: "destroyer", owner: 1, pos: { x: 22, y: 5 } }] } })).toThrow(
      /doesn't field a destroyer/,
    );
  });

  it("the briefing counts units in plain English: 6 Infantry and 2 Artillery, but 2 Medium Tanks", () => {
    const mission: CampaignMission = {
      map: "midway",
      commanders: {},
      advantage: {
        units: [
          { type: "infantry", owner: 1, pos: { x: 0, y: 0 } },
          { type: "infantry", owner: 1, pos: { x: 1, y: 0 } },
          { type: "artillery", owner: 1, pos: { x: 2, y: 0 } },
          { type: "artillery", owner: 1, pos: { x: 3, y: 0 } },
          { type: "mediumTank", owner: 1, pos: { x: 4, y: 0 } },
          { type: "mediumTank", owner: 1, pos: { x: 5, y: 0 } },
        ],
      },
    };
    const names = { unit: (t: string) => ({ infantry: "Infantry", artillery: "Artillery", mediumTank: "Medium Tank" })[t] ?? t, commander: () => "" };
    expect(advantageLines(scenarioOf("midway"), mission, names)[0]).toContain("2 Infantry, 2 Artillery and 2 Medium Tanks more");
  });

  it("the briefing says what the computer has been given, player by player", () => {
    const mission: CampaignMission = {
      map: "gazala",
      commanders: { 2: "falk" },
      advantage: { funds: { 2: 3000 }, incomePercent: 25, units: [{ type: "mediumTank", owner: 2, pos: { x: 0, y: 0 } }, { type: "mediumTank", owner: 2, pos: { x: 1, y: 0 } }] },
    };
    const names = { unit: () => "Tank", commander: () => "Konrad Falk" };
    const scenario = scenarioOf("gazala");
    const [germany, italy] = axisPlayers(scenario).map((id) => scenario.setup.players[id]?.name ?? "");
    expect(advantageLines(scenario, mission, names)).toEqual([
      `${germany ?? ""}, under Konrad Falk: 2 Tanks more, 3,000 more funds and 25% more income.`,
      `${italy ?? ""}: 25% more income.`,
    ]);
  });
});

describe("progress (22-campaign §2)", () => {
  const index = (map: string) => MISSIONS.findIndex((m) => m.map === map);

  it("at first only the first mission is open", () => {
    expect(MISSIONS.map((_, i) => missionStatus(MISSIONS, NO_PROGRESS, i))).toEqual(MISSIONS.map((_, i) => (i === 0 ? "open" : "locked")));
  });

  it("winning a mission opens the next, and a mission won can always be played again", () => {
    const progress = withWin(NO_PROGRESS, "battle-of-britain");
    expect(missionStatus(MISSIONS, progress, index("battle-of-britain"))).toBe("won");
    expect(missionStatus(MISSIONS, progress, index("gazala"))).toBe("open");
    expect(missionStatus(MISSIONS, progress, index("midway"))).toBe("locked");
  });

  it("a mission counts as won only when the Allies are among the winners", () => {
    const game = start(scenarioOf("midway"));
    expect(alliesWon(game)).toBe(false);
    expect(alliesWon({ ...game, result: { winningSide: "allies", winners: [0], reason: "surviveDays" } })).toBe(true);
    expect(alliesWon({ ...game, result: { winningSide: "axis", winners: [1], reason: "captureProperties" } })).toBe(false);
  });

  it("progress is kept on the device apart from the autosave, and survives a reload", () => {
    const store = memoryStore();
    writeProgress(store, withWin(withWin(NO_PROGRESS, "battle-of-britain"), "gazala"));
    expect([...store.items.keys()]).toEqual([CAMPAIGN_KEY]);
    expect(readProgress(store).won).toEqual(["battle-of-britain", "gazala"]);
  });

  it("winning the same mission twice counts it once", () => {
    expect(withWin(withWin(NO_PROGRESS, "gazala"), "gazala").won).toEqual(["gazala"]);
  });

  it("missing or damaged progress is no progress, not an error", () => {
    expect(readProgress(null)).toEqual(NO_PROGRESS);
    const store = memoryStore();
    store.setItem(CAMPAIGN_KEY, "{not json");
    expect(readProgress(store)).toEqual(NO_PROGRESS);
    store.setItem(CAMPAIGN_KEY, JSON.stringify({ version: 1, won: [3] }));
    expect(readProgress(store)).toEqual(NO_PROGRESS);
  });
});
