import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import { TERRAIN, type MovementType } from "../src/engine/data/terrain";
import { terrainAt, type GameMap, type Point } from "../src/engine/map";
import { loadGame, saveGame } from "../src/engine/save";
import { parseScenario, type Scenario } from "../src/engine/scenario";
import { createGame } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import { SCENARIOS } from "../src/scenarios";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });

const valid = () => ({
  id: "test",
  name: "Test",
  description: "A test scenario",
  map: ["Qf.", "...", ".fQ"],
  players: [{ name: "A", nation: "us", funds: 1000 }, { name: "B", nation: "germany" }],
  propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(2, 2), owner: 1 }],
  units: [{ type: "infantry", owner: 0, pos: P(1, 1) }],
});

const properties = (scenario: Scenario, terrain: string, owner: number) => {
  const { map, propertyOwners } = scenario.setup;
  return (propertyOwners ?? []).filter((p) => p.owner === owner && terrainAt(map, p.pos) === terrain);
};

/** Whether a unit of this movement type could ever travel between two tiles, ignoring other units. */
function connected(map: GameMap, type: MovementType, from: Point, to: Point): boolean {
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [from];
  for (let p = queue.shift(); p; p = queue.shift()) {
    if (p.x === to.x && p.y === to.y) return true;
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
      const q = P(p.x + dx, p.y + dy);
      if (q.x < 0 || q.y < 0 || q.x >= map.width || q.y >= map.height || seen.has(`${q.x},${q.y}`)) continue;
      if (TERRAIN[terrainAt(map, q)].moveCost[type] === null) continue;
      seen.add(`${q.x},${q.y}`);
      queue.push(q);
    }
  }
  return false;
}

describe("built-in scenarios (00-master-design §8)", () => {
  it("there are at least 3, one of them bocage country (11-tech-setup §6)", () => {
    expect(SCENARIOS.length).toBeGreaterThanOrEqual(3);
    expect(SCENARIOS.map((s) => s.id)).toContain("bocage-country");
  });

  it("have unique ids", () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  describe.each(SCENARIOS.map((s) => [s.name, s] as const))("%s", (_, scenario) => {
    it("both sides have an HQ and a factory", () => {
      for (const owner of [0, 1]) {
        expect(properties(scenario, "hq", owner), `player ${owner} HQ`).toHaveLength(1);
        expect(properties(scenario, "factory", owner).length, `player ${owner} factory`).toBeGreaterThan(0);
      }
    });

    it("both sides start with units", () => {
      for (const owner of [0, 1]) expect((scenario.setup.units ?? []).some((u) => u.owner === owner)).toBe(true);
    });

    it("infantry can walk, and tanks can drive, from one side to the other", () => {
      const { map } = scenario.setup;
      const [a] = properties(scenario, "hq", 0);
      const [b] = properties(scenario, "hq", 1);
      if (!a || !b) throw new Error("missing HQ");
      expect(connected(map, "foot", a.pos, b.pos)).toBe(true);
      expect(connected(map, "tracks", a.pos, b.pos)).toBe(true);
    });

    it("starts a game that can be played", () => {
      const state = createGame({ ...scenario.setup, seed: 1 });
      const after = apply(state, { type: "endTurn" });
      expect(after.ok).toBe(true);
    });
  });

  it("Twin Bridges is a fair mirror: the map and starting units rotate onto each other", () => {
    const scenario = SCENARIOS.find((s) => s.id === "twin-bridges");
    if (!scenario) throw new Error("missing scenario");
    const { map, units, propertyOwners } = scenario.setup;
    expect(map.terrain).toEqual([...map.terrain].reverse());
    const rotate = (p: Point) => P(map.width - 1 - p.x, map.height - 1 - p.y);
    const side = (owner: number) => (units ?? []).filter((u) => u.owner === owner);
    const key = (type: string, p: Point) => `${type}@${p.x},${p.y}`;
    expect(side(1).map((u) => key(u.type, u.pos)).sort()).toEqual(side(0).map((u) => key(u.type, rotate(u.pos))).sort());
    const owned = (owner: number) => (propertyOwners ?? []).filter((p) => p.owner === owner);
    expect(owned(1).map((p) => key("p", p.pos)).sort()).toEqual(owned(0).map((p) => key("p", rotate(p.pos))).sort());
  });

  it("the demo keeps the US from building Heavy Tanks, as the availability rule requires (01-units §1)", () => {
    const scenario = SCENARIOS.find((s) => s.id === "proving-ground");
    expect(scenario?.setup.players[0]?.buildable).not.toContain("heavyTank");
  });
});

describe("the scenario file format", () => {
  it("reads a valid file", () => {
    const scenario = parseScenario(valid());
    expect(scenario).toMatchObject({ id: "test", name: "Test", description: "A test scenario" });
    expect(scenario.setup.map).toMatchObject({ width: 3, height: 3 });
    expect(createGame({ ...scenario.setup, seed: 1 }).players[0]?.funds).toBe(2000); // HQ income on day 1
  });

  it("victory conditions, settings and modifiers are optional and carried through", () => {
    const { setup } = parseScenario({
      ...valid(),
      victory: [{ type: "rout" }],
      settings: { luck: false, incomePerProperty: 500, unitCap: 10 },
      modifiers: [{ source: "mud", stat: "moveCost", op: "add", value: 1 }],
    });
    expect(setup.victory).toEqual([{ type: "rout" }]);
    expect(setup.settings).toEqual({ luck: false, incomePerProperty: 500, unitCap: 10 });
    expect(setup.modifiers).toHaveLength(1);
  });

  it.each([
    ["no id", { id: "" }, /"id" must be text/],
    ["a bad map", { map: ["..", "."] }, /Row 1/],
    ["an unknown map character", { map: ["?"] }, /Unknown map character/],
    ["an unknown nation", { players: [{ name: "A", nation: "atlantis" }, { name: "B", nation: "us" }] }, /unknown nation/],
    ["only one player", { players: [{ name: "A", nation: "us" }] }, /at least 2 players/],
    ["an unknown unit type", { units: [{ type: "dragon", owner: 0, pos: P(1, 1) }] }, /unknown unit type dragon/],
    ["a unit off the map", { units: [{ type: "infantry", owner: 0, pos: P(9, 9) }] }, /outside the map/],
    ["two units on a tile", { units: [{ type: "infantry", owner: 0, pos: P(1, 1) }, { type: "recon", owner: 1, pos: P(1, 1) }] }, /Two units/],
    ["a unit on terrain it can't enter", { map: ["QfS", "...", ".fQ"], units: [{ type: "infantry", owner: 0, pos: P(2, 0) }] }, /can't stand on sea/],
    ["an owner who doesn't exist", { units: [{ type: "infantry", owner: 5, pos: P(1, 1) }] }, /unknown owner/],
    ["a property owner on open ground", { propertyOwners: [{ pos: P(1, 1), owner: 0 }] }, /No property/],
    ["an unknown victory condition", { victory: [{ type: "conquest" }] }, /must be hqCapture or rout/],
    ["negative funds", { players: [{ name: "A", nation: "us", funds: -1 }, { name: "B", nation: "uk" }] }, /whole number/],
    ["a bad modifier", { modifiers: [{ source: "x", stat: "charisma", op: "add", value: 1 }] }, /unknown stat/],
    ["a bad build list", { players: [{ name: "A", nation: "us", buildable: ["dragon"] }, { name: "B", nation: "germany" }] }, /unknown unit type/],
  ])("rejects %s, naming the scenario and the problem", (_, change, message) => {
    const attempt = () => parseScenario({ ...valid(), ...change });
    expect(attempt).toThrow(message);
    expect(attempt).toThrow(/Invalid scenario/);
  });

  it("rejects things that aren't scenarios at all", () => {
    expect(() => parseScenario(null)).toThrow(/must be an object/);
    expect(() => parseScenario([])).toThrow(/must be an object/);
  });
});

describe("saving and loading (00-master-design §11)", () => {
  const endTurn: Command = { type: "endTurn" };
  const must = (state: GameState, command: Command) => {
    const result = apply(state, command);
    if (!result.ok) throw new Error(result.message);
    return result.state;
  };

  it("a saved game comes back exactly as it was", () => {
    const state = must(makeGame(["C=Q"], [{ type: "infantry", owner: 0, pos: P(0, 0), hp: 60 }], { seed: 9 }), endTurn);
    expect(loadGame(saveGame(state))).toEqual(state);
  });

  it("a loaded game plays on identically, including its luck", () => {
    const state = makeGame(["=="], [
      { type: "mediumTank", owner: 0, pos: P(0, 0) },
      { type: "mediumTank", owner: 1, pos: P(1, 0) },
    ], { seed: 9 });
    const attack: Command = { type: "move", unitId: 0, path: [], action: { type: "attack", target: 1 } };
    expect(must(loadGame(saveGame(state)), attack)).toEqual(must(state, attack));
  });

  it("rejects damaged files and unknown versions", () => {
    expect(() => loadGame("not json")).toThrow(/damaged/);
    expect(() => loadGame(JSON.stringify({ version: 99, state: {} }))).toThrow(/Unsupported save version/);
    expect(() => loadGame(JSON.stringify({ version: 1 }))).toThrow(/no game/);
  });
});
