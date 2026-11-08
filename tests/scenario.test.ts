import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import { TERRAIN, type MovementType } from "../src/engine/data/terrain";
import { UNITS } from "../src/engine/data/units";
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

/** Every tile a unit of one of these movement types could ever reach from a starting tile, ignoring other units. */
function reachable(map: GameMap, types: readonly MovementType[], from: Point): Set<string> {
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [from];
  for (let p = queue.shift(); p; p = queue.shift()) {
    for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
      const q = P(p.x + dx, p.y + dy);
      if (q.x < 0 || q.y < 0 || q.x >= map.width || q.y >= map.height || seen.has(`${q.x},${q.y}`)) continue;
      const costs = TERRAIN[terrainAt(map, q)].moveCost;
      if (types.every((type) => costs[type] === null)) continue;
      seen.add(`${q.x},${q.y}`);
      queue.push(q);
    }
  }
  return seen;
}

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

    it("infantry and tanks can reach the enemy HQ, on land or carried across the sea by Landing Craft", () => {
      const { map } = scenario.setup;
      const [a] = properties(scenario, "hq", 0);
      const [b] = properties(scenario, "hq", 1);
      if (!a || !b) throw new Error("missing HQ");
      for (const type of ["foot", "tracks"] as const) {
        const byLand = connected(map, type, a.pos, b.pos);
        const bySea = reachable(map, [type, "landingCraft"], a.pos).has(`${b.pos.x},${b.pos.y}`);
        expect(byLand || bySea, type).toBe(true);
      }
    });

    it("starts a game that can be played", () => {
      const state = createGame({ ...scenario.setup, seed: 1 });
      const after = apply(state, { type: "endTurn" });
      expect(after.ok).toBe(true);
    });

    it("the side starting on the left faces right, and the side starting on the right faces left (08-art-pipeline §12)", () => {
      const units = scenario.setup.units ?? [];
      const averageColumn = (owner: number) => {
        const columns = units.filter((u) => u.owner === owner).map((u) => u.pos.x);
        return columns.reduce((sum, x) => sum + x, 0) / columns.length;
      };
      const [left, right] = averageColumn(0) < averageColumn(1) ? [0, 1] : [1, 0];
      const facing = createGame({ ...scenario.setup, seed: 1 }).players.map((p) => p.facing);
      expect(facing[left]).toBe("right");
      expect(facing[right]).toBe("left");
    });
  });

  it.each(["twin-bridges", "contested-skies", "narrow-sea"])("%s is a fair mirror: the map and starting units rotate onto each other", (id) => {
    const scenario = SCENARIOS.find((s) => s.id === id);
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

  describe("Normandy", () => {
    const normandy = SCENARIOS.find((s) => s.id === "normandy");
    if (!normandy) throw new Error("missing scenario");
    const { map, units } = normandy.setup;
    const [alliedHq] = properties(normandy, "hq", 0);
    const [germanHq] = properties(normandy, "hq", 1);
    if (!alliedHq || !germanHq) throw new Error("missing HQ");
    const france = reachable(map, ["foot"], germanHq.pos);
    const tiles = (keep: (p: Point, key: string) => boolean) =>
      map.terrain.map((_, i) => P(i % map.width, Math.floor(i / map.width))).filter((p) => keep(p, `${p.x},${p.y}`));
    const isLand = (p: Point) => TERRAIN[terrainAt(map, p)].moveCost.foot !== null;

    it("is a large theater map, bigger than 80 by 70 squares (00-master-design §8)", () => {
      expect(map.width).toBeGreaterThan(80);
      expect(map.height).toBeGreaterThan(70);
    });

    it("England and France are split by the Channel: no one can walk from London to the German HQ", () => {
      expect(france.has(`${alliedHq.pos.x},${alliedHq.pos.y}`)).toBe(false);
    });

    it("the Channel is wider than Rocket Artillery range, so rockets can't fire from one coast to the other (01-units §8)", () => {
      const range = UNITS.rocketArtillery.range.max;
      const french = tiles((p, key) => france.has(key) && isLand(p));
      const otherLand = tiles((p, key) => !france.has(key) && isLand(p));
      // Jersey counts with the English side here, which only makes the check stricter.
      let closest = Infinity;
      for (const a of french) for (const b of otherLand) closest = Math.min(closest, Math.abs(a.x - b.x) + Math.abs(a.y - b.y));
      expect(closest).toBeGreaterThan(range);
    });

    it("England's cities and ports pay the Allies at least half as much again as the Germans earn", () => {
      const owned = (owner: number) => (normandy.setup.propertyOwners ?? []).filter((p) => p.owner === owner).length;
      expect(owned(0)).toBeGreaterThanOrEqual(owned(1) * 1.5);
    });

    it("both sides start small, with at most 8 units each", () => {
      for (const owner of [0, 1]) expect((units ?? []).filter((u) => u.owner === owner).length).toBeLessThanOrEqual(8);
    });

    it("the Allies start with a Landing Craft and both sides have ports to build more ships", () => {
      expect((units ?? []).some((u) => u.owner === 0 && u.type === "landingCraft")).toBe(true);
      for (const owner of [0, 1]) expect(properties(normandy, "port", owner).length).toBeGreaterThan(0);
    });

    const neighbors = (p: Point) => [P(p.x, p.y - 1), P(p.x + 1, p.y), P(p.x, p.y + 1), P(p.x - 1, p.y)];
    const inMap = (p: Point) => p.x >= 0 && p.y >= 0 && p.x < map.width && p.y < map.height;
    const onShore = (p: Point) => neighbors(p).some((q) => inMap(q) && terrainAt(map, q) === "sea");

    it("the French coast has plenty of beaches to land on, not just a handful of squares", () => {
      const frenchBeaches = tiles((p, key) => france.has(key) && terrainAt(map, p) === "beach");
      expect(frenchBeaches.length).toBeGreaterThanOrEqual(30);
    });

    it("some bunkers stand on clifftops with cliffs beside them, as at Pointe du Hoc", () => {
      const clifftop = tiles((p, key) => {
        if (!france.has(key) || terrainAt(map, p) !== "bunker" || !onShore(p)) return false;
        return neighbors(p).some((q) => inMap(q) && terrainAt(map, q) === "hills" && onShore(q));
      });
      expect(clifftop.length).toBeGreaterThanOrEqual(2);
    });

    it("the game ends by capturing the enemy HQ, not by wiping out units", () => {
      expect(normandy.setup.victory).toEqual([{ type: "hqCapture" }]);
    });
  });

  it("the coastal map gives each side a port and starts both with a Destroyer and a Submarine (11-tech-setup §6, milestone 10)", () => {
    const scenario = SCENARIOS.find((s) => s.id === "narrow-sea");
    if (!scenario) throw new Error("missing scenario");
    for (const owner of [0, 1]) {
      expect(properties(scenario, "port", owner), `player ${owner} port`).toHaveLength(1);
      const ships = (scenario.setup.units ?? []).filter((u) => u.owner === owner).map((u) => u.type);
      expect(ships).toEqual(expect.arrayContaining(["destroyer", "submarine"]));
    }
  });

  it("the amphibious map gives the Allies a Landing Craft and a Transport Aircraft, and the Axis bunkers above the beaches (11-tech-setup §6, milestone 11)", () => {
    const scenario = SCENARIOS.find((s) => s.id === "beachhead");
    if (!scenario) throw new Error("missing scenario");
    const { map, units } = scenario.setup;
    const allied = (units ?? []).filter((u) => u.owner === 0).map((u) => u.type);
    expect(allied).toEqual(expect.arrayContaining(["landingCraft", "transportAircraft"]));
    const axisOnBunkers = (units ?? []).filter((u) => u.owner === 1 && terrainAt(map, u.pos) === "bunker");
    expect(axisOnBunkers.length).toBeGreaterThan(0);
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

  it("units face right unless the map says otherwise (08-art-pipeline §12)", () => {
    const { setup } = parseScenario(valid());
    expect(createGame({ ...setup, seed: 1 }).players.map((p) => p.facing)).toEqual(["right", "right"]);
  });

  it("a map can set which way each player's units face (08-art-pipeline §12)", () => {
    const players = [{ name: "A", nation: "us" }, { name: "B", nation: "germany", facing: "left" }];
    const { setup } = parseScenario({ ...valid(), players });
    expect(createGame({ ...setup, seed: 1 }).players.map((p) => p.facing)).toEqual(["right", "left"]);
  });

  it("facing is only drawn: a battle plays out the same whichever way units face (08-art-pipeline §12)", () => {
    const battle = (facing: string) => {
      const units = [{ type: "mediumTank", owner: 0, pos: P(0, 1) }, { type: "mediumTank", owner: 1, pos: P(1, 1) }];
      const players = [{ name: "A", nation: "us", facing }, { name: "B", nation: "germany", facing }];
      const { setup } = parseScenario({ ...valid(), players, units });
      const result = apply(createGame({ ...setup, seed: 7 }), { type: "move", unitId: 0, path: [], action: { type: "attack", target: 1 } });
      if (!result.ok) throw new Error(result.message);
      return { units: result.state.units, events: result.events };
    };
    expect(battle("left")).toEqual(battle("right"));
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
    ["a bad facing", { players: [{ name: "A", nation: "us", facing: "up" }, { name: "B", nation: "germany" }] }, /"facing" must be left or right/],
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
