import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import { TERRAIN, type MovementType, type TerrainId } from "../src/engine/data/terrain";
import { UNITS, type UnitTypeId } from "../src/engine/data/units";
import { terrainAt, type Point } from "../src/engine/map";
import { createGame } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import { SCENARIOS } from "../src/scenarios";
import { defaultComputerPlayers } from "../src/ui/computerPlayers";
import { weatherOn } from "../src/engine/weather";

// Scenario rules for Dunkirk (21-scenarios-dunkirk §1).
const scenario = SCENARIOS.find((s) => s.id === "dunkirk");
if (!scenario) throw new Error("missing scenario");
const { map, units = [], players, victory = [], propertyOwners = [] } = scenario.setup;
const UK = 0;
const GERMANY = 1;
const P = (x: number, y: number): Point => ({ x, y });
const key = (p: Point) => `${p.x},${p.y}`;
const FOOT: readonly UnitTypeId[] = ["infantry", "assaultInfantry", "mortar"];

const dunkirk = P(17, 20);
const saintOmer = P(13, 31);
const bergues = P(19, 23);
const evacuation = victory.find((c) => c.type === "evacuateUnits");
if (evacuation?.type !== "evacuateUnits") throw new Error("no evacuation");
const zone = new Set(evacuation.zone.map(key));
const squares = map.terrain.map((terrain, i) => ({ terrain, pos: P(i % map.width, Math.floor(i / map.width)) }));
const N4 = [P(0, 1), P(1, 0), P(0, -1), P(-1, 0)];
const neighbors = (p: Point) => N4.map((d) => P(p.x + d.x, p.y + d.y)).filter((q) => q.x >= 0 && q.y >= 0 && q.x < map.width && q.y < map.height);

/** Squares reachable from `from` over terrain this movement type can cross, never entering `blocked`. */
function reachable(from: Point, type: MovementType, blocked: (p: Point, terrain: TerrainId) => boolean = () => false): Set<string> {
  const seen = new Set([key(from)]);
  const queue = [from];
  for (let p = queue.shift(); p; p = queue.shift()) {
    for (const q of neighbors(p)) {
      const terrain = terrainAt(map, q);
      if (seen.has(key(q)) || TERRAIN[terrain].moveCost[type] === null || blocked(q, terrain)) continue;
      seen.add(key(q));
      queue.push(q);
    }
  }
  return seen;
}

/** The pocket: what a soldier at Dunkirk can reach without crossing a canal, a bridge, a flood, or Bergues in the line. */
const pocket = reachable(dunkirk, "foot", (p, t) => t === "river" || t === "bridge" || t === "majorBridge" || t === "saltMarsh" || t === "bunker" || key(p) === key(bergues));

describe("Dunkirk (21-scenarios-dunkirk)", () => {
  it("the UK wins by evacuating 10 foot units to England", () => {
    expect(evacuation).toMatchObject({ side: "allies", count: 10, unitTypes: FOOT });
    // The zone is England: every square of it is land, and none of it is on the Continent.
    expect(evacuation.zone.every((p) => terrainAt(map, p) !== "sea")).toBe(true);
    expect(zone.has(key(dunkirk))).toBe(false);
  });

  it("Germany wins by holding out to the start of day 9", () => {
    expect(victory).toContainEqual({ type: "surviveDays", side: "axis", days: 9 });
    let state: GameState = createGame({ ...scenario.setup, seed: 1 });
    while (!state.result) {
      const result = apply(state, { type: "endTurn" });
      if (!result.ok) throw new Error(result.message);
      state = result.state;
    }
    expect(state.day).toBe(9);
    expect(state.result).toMatchObject({ winningSide: "axis", reason: "surviveDays" });
  });

  it("Germany wins by capturing Dunkirk, the UK's HQ", () => {
    expect(victory).toContainEqual({ type: "hqCapture" });
    expect(terrainAt(map, dunkirk)).toBe("hq");
    expect(propertyOwners).toContainEqual({ pos: dunkirk, owner: UK });
    expect(terrainAt(map, saintOmer)).toBe("hq");
    expect(propertyOwners).toContainEqual({ pos: saintOmer, owner: GERMANY });
  });

  it("the UK starts with 24 foot units and has to bring home 10 of them", () => {
    const foot = units.filter((u) => u.owner === UK && FOOT.includes(u.type));
    expect(foot).toHaveLength(24);
    expect(evacuation.count / foot.length).toBeCloseTo(10 / 24, 2);
  });

  it("the UK can't build land units and has no factory", () => {
    const buildable = players[UK]?.buildable ?? [];
    expect(buildable.some((t) => UNITS[t].category === "land")).toBe(false);
    const ukFactories = propertyOwners.filter((p) => p.owner === UK && terrainAt(map, p.pos) === "factory");
    expect(ukFactories).toEqual([]);
  });

  it("a Landing Craft takes two days to sail from any beach in the pocket to the English shore, so it spends a night at sea", () => {
    // The fewest Landing Craft moves from a beach to an English beach or port, over sea (Reef costs 2).
    const sail = (from: Point): number => {
      const cost = new Map([[key(from), 0]]);
      const open = [from];
      let best = Infinity;
      while (open.length > 0) {
        open.sort((a, b) => (cost.get(key(a)) ?? 0) - (cost.get(key(b)) ?? 0));
        const p = open.shift();
        if (!p) break;
        const here = cost.get(key(p)) ?? 0;
        if (zone.has(key(p)) && ["beach", "port"].includes(terrainAt(map, p))) best = Math.min(best, here);
        for (const q of neighbors(p)) {
          const terrain = terrainAt(map, q);
          const step = TERRAIN[terrain].moveCost.landingCraft;
          // Out to sea and in to England: not along the French shore.
          if (step === null || (terrain === "beach" && !zone.has(key(q)))) continue;
          if (here + step < (cost.get(key(q)) ?? Infinity)) {
            cost.set(key(q), here + step);
            open.push(q);
          }
        }
      }
      return best;
    };
    const move = UNITS.landingCraft.movePoints;
    const beaches = squares.filter((s) => s.terrain === "beach" && pocket.has(key(s.pos)));
    expect(beaches.length).toBeGreaterThanOrEqual(6);
    for (const { pos } of beaches) {
      const moves = sail(pos);
      expect(moves, `from (${pos.x}, ${pos.y})`).toBeGreaterThan(move);
      expect(moves, `from (${pos.x}, ${pos.y})`).toBeLessThanOrEqual(2 * move);
    }
  });

  it("every bridge into the pocket is a Major Bridge the Royal Engineers can blow", () => {
    const intoPocket = squares.filter((s) => (s.terrain === "bridge" || s.terrain === "majorBridge") && neighbors(s.pos).some((q) => pocket.has(key(q))));
    expect(intoPocket.length).toBeGreaterThanOrEqual(2);
    for (const { terrain, pos } of intoPocket) expect(terrain, `(${pos.x}, ${pos.y})`).toBe("majorBridge");
  });

  it("German tanks can reach Dunkirk only over a bridge or through Bergues, not across the flooded polders", () => {
    const gravelines = P(10, 21);
    const open = reachable(gravelines, "tracks");
    expect(open.has(key(dunkirk))).toBe(true);
    const sealed = reachable(gravelines, "tracks", (p, t) => t === "majorBridge" || key(p) === key(bergues) || terrainAt(map, p) === "bunker");
    expect(sealed.has(key(dunkirk))).toBe(false);
    // The polders are flooded, and nothing on land can cross them.
    expect(squares.filter((s) => s.terrain === "saltMarsh").length).toBeGreaterThanOrEqual(8);
    for (const type of ["foot", "heavyFoot", "tracks", "wheels"] as const) expect(TERRAIN.saltMarsh.moveCost[type]).toBeNull();
  });

  it("Bergues stands in the line with a bunker in its old walls, held by Infantry", () => {
    expect(terrainAt(map, bergues)).toBe("city");
    const walls = neighbors(bergues).find((p) => terrainAt(map, p) === "bunker");
    expect(walls).toBeDefined();
    expect(units.find((u) => walls && key(u.pos) === key(walls))).toMatchObject({ type: "infantry", owner: UK });
  });

  it("the weather follows 28 May to 4 June: rain on days 1 and 3, clear the rest", () => {
    const state = createGame({ ...scenario.setup, seed: 1 });
    expect([1, 2, 3, 4, 5, 6, 7, 8].map((day) => weatherOn(state, day))).toEqual(["rain", "clear", "rain", "clear", "clear", "clear", "clear", "clear"]);
  });

  it("the computer plays only Germany by default", () => {
    expect(defaultComputerPlayers(scenario)).toEqual([GERMANY]);
  });
});
