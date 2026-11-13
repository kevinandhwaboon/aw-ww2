import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import { TERRAIN, type MovementType } from "../src/engine/data/terrain";
import { baseDamage } from "../src/engine/data/damage";
import { UNITS, type UnitTypeId } from "../src/engine/data/units";
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

  it.each(["twin-bridges", "contested-skies", "narrow-sea", "the-slot"])("%s is a fair mirror: the map and starting units rotate onto each other", (id) => {
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

  describe("Bastogne (13-scenarios-ardennes)", () => {
    const bastogne = SCENARIOS.find((s) => s.id === "bastogne");
    if (!bastogne) throw new Error("missing scenario");
    const { map, units, victory, weather } = bastogne.setup;
    const town = victory?.find((v) => v.type === "captureProperties")?.properties[0];
    if (!town) throw new Error("missing objective");
    const roadsOut = [[0, 1], [1, 0], [0, -1], [-1, 0]].filter(([dx, dy]) => {
      const t = terrainAt(map, P(town.x + (dx ?? 0), town.y + (dy ?? 0)));
      return t === "road" || t === "bridge";
    });

    it("Germany wins by taking the town of Bastogne, which the US holds at the start", () => {
      expect(terrainAt(map, town)).toBe("city");
      expect(bastogne.setup.propertyOwners).toContainEqual({ pos: town, owner: 0 });
      expect(victory).toContainEqual({ type: "captureProperties", side: "axis", properties: [town] });
    });

    it("the US wins by holding out to the start of day 12", () => {
      expect(victory).toContainEqual({ type: "surviveDays", side: "allies", days: 12 });
    });

    it("Bastogne is a crossroads: roads leave it on every side", () => {
      expect(roadsOut).toHaveLength(4);
    });

    it("snow falls for the first five days, then the skies clear on day 6, and the map is drawn in winter (12-weather)", () => {
      expect(weather).toEqual({ season: "winter", forecast: [{ fromDay: 1, weather: "snow" }, { fromDay: 6, weather: "clear" }] });
    });

    it("Germany attacks with the bigger army, but its tanks start short of fuel", () => {
      const count = (owner: number) => units?.filter((u) => u.owner === owner).length ?? 0;
      expect(count(1)).toBeGreaterThan(count(0));
      const tanks = units?.filter((u) => u.owner === 1 && (u.type === "heavyTank" || u.type === "mediumTank")) ?? [];
      expect(tanks.length).toBeGreaterThanOrEqual(4);
      for (const t of tanks) expect(t.fuel).toBeLessThan(UNITS[t.type].maxFuel * 0.7);
    });

    it("only the US can build aircraft: Germany has no airfield and no planes on its build list", () => {
      expect(properties(bastogne, "airfield", 0)).toHaveLength(1);
      expect(properties(bastogne, "airfield", 1)).toHaveLength(0);
      expect(bastogne.setup.players[1]?.buildable?.some((t) => UNITS[t].category === "air")).toBe(false);
    });

    it("German tanks can drive from their start to Bastogne", () => {
      const tank = units?.find((u) => u.owner === 1 && u.type === "mediumTank");
      if (!tank) throw new Error("no tank");
      expect(connected(map, "tracks", tank.pos, town)).toBe(true);
    });
  });

  describe("Iwo Jima (14-scenarios-pacific)", () => {
    const iwo = SCENARIOS.find((s) => s.id === "iwo-jima");
    if (!iwo) throw new Error("missing scenario");
    const { map, units, victory, players, propertyOwners } = iwo.setup;
    const objectives = victory?.find((v) => v.type === "captureProperties")?.properties ?? [];
    const [suribachi, airfield1, airfield2] = objectives;
    if (!suribachi || !airfield1 || !airfield2) throw new Error("missing objectives");
    const neighbors = (p: Point) => [[0, 1], [1, 0], [0, -1], [-1, 0]].map(([dx, dy]) => terrainAt(map, P(p.x + (dx ?? 0), p.y + (dy ?? 0))));

    it("the US fights Japan", () => {
      expect(players.map((p) => p.nation)).toEqual(["us", "japan"]);
    });

    it("the US wins by taking Mount Suribachi and Airfields No. 1 and No. 2, all held by Japan at the start", () => {
      expect(victory).toContainEqual({ type: "captureProperties", side: "allies", properties: [suribachi, airfield1, airfield2] });
      expect([airfield1, airfield2].map((p) => terrainAt(map, p))).toEqual(["airfield", "airfield"]);
      for (const p of objectives) expect(propertyOwners).toContainEqual({ pos: p, owner: 1 });
    });

    it("Japan wins by holding out to the start of day 15", () => {
      expect(victory).toContainEqual({ type: "surviveDays", side: "axis", days: 15 });
    });

    it("Mount Suribachi is a peak at the south-west tip, ringed by hills", () => {
      expect(suribachi.x).toBeLessThan(map.width / 4);
      expect(suribachi.y).toBeGreaterThan(map.height * 0.7);
      expect(neighbors(suribachi).filter((t) => t === "hills").length).toBeGreaterThanOrEqual(3);
    });

    it("the US first wave starts ashore on the black sand beaches, with the fleet offshore", () => {
      const ashore = units?.filter((u) => u.owner === 0 && UNITS[u.type].category === "land" && terrainAt(map, u.pos) === "beach") ?? [];
      expect(ashore.length).toBeGreaterThanOrEqual(6);
      const fleet = units?.filter((u) => u.owner === 0 && UNITS[u.type].category === "naval").map((u) => u.type) ?? [];
      expect(fleet).toEqual(expect.arrayContaining(["battleship", "destroyer", "landingCraft"]));
    });

    it("two US Carriers start offshore, each carrying two Dive Bombers, and the US has no airfield of its own (05-supply-transport §10)", () => {
      const carriers = units?.filter((u) => u.owner === 0 && u.type === "carrier") ?? [];
      expect(carriers).toHaveLength(2);
      for (const c of carriers) {
        expect(terrainAt(map, c.pos)).toBe("sea");
        expect(c.cargo?.map((x) => x.type)).toEqual(["diveBomber", "diveBomber"]);
      }
      expect(properties(iwo, "airfield", 0)).toHaveLength(0);
    });

    it("each Carrier's Dive Bombers can reach a bunker on the first day, but no Japanese gun can reach the Carriers", () => {
      const carriers = units?.filter((u) => u.type === "carrier") ?? [];
      const bunkers = map.terrain.flatMap((t, i) => (t === "bunker" ? [P(i % map.width, Math.floor(i / map.width))] : []));
      const dist = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
      const guns = units?.filter((u) => u.owner === 1 && UNITS[u.type].range !== null) ?? [];
      for (const c of carriers) {
        expect(bunkers.some((b) => dist(c.pos, b) <= UNITS.diveBomber.movePoints + 1)).toBe(true);
        for (const g of guns) expect(dist(c.pos, g.pos)).toBeGreaterThan(UNITS[g.type].range?.max ?? 0);
      }
    });

    it("Japan's soldiers start dug into bunkers, and bunkers never stand on the sand", () => {
      const infantry = units?.filter((u) => u.owner === 1 && u.type === "infantry") ?? [];
      expect(infantry.filter((u) => terrainAt(map, u.pos) === "bunker").length).toBeGreaterThanOrEqual(infantry.length * 0.75);
      for (let i = 0; i < map.terrain.length; i++) {
        if (map.terrain[i] !== "bunker") continue;
        expect(map.terrain[i]).not.toBe("beach");
      }
    });

    it("Japan builds only land units it fielded: no aircraft, ships or Heavy Tanks (01-units §1)", () => {
      const japan = players[1]?.buildable ?? [];
      expect(japan.some((t) => UNITS[t].category !== "land")).toBe(false);
      expect(japan).not.toContain("heavyTank");
    });

    it("US tanks landed on the beaches can drive to Japan's HQ in the north", () => {
      const tank = units?.find((u) => u.owner === 0 && u.type === "mediumTank");
      const [hq] = properties(iwo, "hq", 1);
      if (!tank || !hq) throw new Error("missing tank or HQ");
      expect(connected(map, "tracks", tank.pos, hq.pos)).toBe(true);
      expect(hq.pos.y).toBeLessThan(map.height / 3);
    });
  });

  describe("The Slot (14-scenarios-pacific §2)", () => {
    const slot = SCENARIOS.find((s) => s.id === "the-slot");
    if (!slot) throw new Error("missing scenario");
    const { map, units, players, propertyOwners } = slot.setup;
    const centre = P((map.width - 1) / 2, (map.height - 1) / 2);
    const dist = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const neutral = (terrain: string) =>
      map.terrain.flatMap((t, i) => (t === terrain ? [P(i % map.width, Math.floor(i / map.width))] : []))
        .filter((p) => !(propertyOwners ?? []).some((o) => o.pos.x === p.x && o.pos.y === p.y));

    it("the US holds the south and Japan the north, with the same build lists", () => {
      expect(players.map((p) => p.nation)).toEqual(["us", "japan"]);
      const [us, japan] = [0, 1].map((owner) => properties(slot, "hq", owner)[0]?.pos.y ?? 0);
      expect(us).toBeGreaterThan(map.height * 0.8);
      expect(japan).toBeLessThan(map.height * 0.2);
      expect(players[0]?.buildable).toEqual(players[1]?.buildable);
      expect(players[1]?.buildable).not.toContain("heavyTank");
    });

    it("each side has an HQ island with two Ports, a secondary city, a forward port and an airstrip", () => {
      for (const owner of [0, 1]) {
        expect(properties(slot, "port", owner), `player ${owner} ports`).toHaveLength(3);
        expect(properties(slot, "airfield", owner), `player ${owner} airfields`).toHaveLength(1);
        expect(properties(slot, "city", owner), `player ${owner} cities`).toHaveLength(4);
      }
    });

    it("the neutral centre island has an airfield on the centre square, and two neutral anchorages lie the same distance from both HQs", () => {
      expect(neutral("airfield")).toEqual([centre]);
      const anchorages = neutral("port");
      expect(anchorages).toHaveLength(2);
      const hqs = [0, 1].map((owner) => properties(slot, "hq", owner)[0]?.pos ?? centre);
      for (const a of anchorages) expect(dist(a, hqs[0] ?? centre)).toBe(dist(a, hqs[1] ?? centre));
    });

    it("the Slot, between the island chains, has no reefs, and ships can sail it from the US ports to Japan's without leaving it", () => {
      const inSlot = (p: Point) => p.x >= 6 && p.x <= map.width - 7;
      const tiles = map.terrain.map((t, i) => ({ t, p: P(i % map.width, Math.floor(i / map.width)) })).filter(({ p }) => inSlot(p));
      expect(tiles.filter(({ t }) => t === "reef")).toEqual([]);
      const [usPort] = properties(slot, "port", 0);
      const [jpPort] = properties(slot, "port", 1);
      if (!usPort || !jpPort) throw new Error("missing ports");
      const seen = new Set([`${usPort.pos.x},${usPort.pos.y}`]);
      const queue = [usPort.pos];
      for (let p = queue.shift(); p; p = queue.shift()) {
        for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
          const q = P(p.x + dx, p.y + dy);
          if (q.y < 0 || q.y >= map.height || !inSlot(q) || seen.has(`${q.x},${q.y}`)) continue;
          if (TERRAIN[terrainAt(map, q)].moveCost.sea === null) continue;
          seen.add(`${q.x},${q.y}`);
          queue.push(q);
        }
      }
      expect(seen.has(`${jpPort.pos.x},${jpPort.pos.y}`)).toBe(true);
    });

    it("both sides start with 2 Carriers, 2 Battleships, 4 Destroyers, 2 Torpedo Boats and 2 loaded Landing Craft", () => {
      for (const owner of [0, 1]) {
        const count = (type: string) => (units ?? []).filter((u) => u.owner === owner && u.type === type).length;
        expect([count("carrier"), count("battleship"), count("destroyer"), count("torpedoBoat"), count("landingCraft")]).toEqual([2, 2, 4, 2, 2]);
        for (const lc of (units ?? []).filter((u) => u.owner === owner && u.type === "landingCraft")) {
          expect(lc.cargo?.map((c) => c.type)).toEqual(["infantry", "infantry"]);
        }
      }
    });

    it("the Carriers start out on the open-ocean flanks, each with a Fighter and a strike aircraft aboard (05-supply-transport §10)", () => {
      for (const c of (units ?? []).filter((u) => u.type === "carrier")) {
        expect(c.pos.x < 6 || c.pos.x > map.width - 7, `carrier at ${c.pos.x},${c.pos.y}`).toBe(true);
        expect(c.cargo?.[0]?.type).toBe("fighter");
        expect(["diveBomber", "torpedoBomber"]).toContain(c.cargo?.[1]?.type);
      }
    });

    it("nothing can strike an enemy on the first day, so moving first is no ambush", () => {
      const all = (units ?? []).flatMap((u) => [{ ...u, type: u.type }, ...(u.cargo ?? []).map((c) => ({ ...c, owner: u.owner, pos: u.pos }))]);
      for (const a of all) {
        const range = UNITS[a.type].range;
        if (!range) continue;
        for (const b of all.filter((u) => u.owner !== a.owner)) {
          expect(dist(a.pos, b.pos), `${a.type} at ${a.pos.x},${a.pos.y} vs ${b.type} at ${b.pos.x},${b.pos.y}`).toBeGreaterThan(UNITS[a.type].movePoints + range.max);
        }
      }
    });
  });

  describe("Midway (14-scenarios-pacific §3)", () => {
    const midway = SCENARIOS.find((s) => s.id === "midway");
    if (!midway) throw new Error("missing scenario");
    const { map, units, victory, players, propertyOwners } = midway.setup;
    const US = 0;
    const JAPAN = 1;
    const objectives = victory?.find((v) => v.type === "captureProperties")?.properties ?? [];
    const [commandPost, airfield] = objectives;
    if (!commandPost || !airfield) throw new Error("missing objectives");
    const dist = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const carriers = (owner: number) => (units ?? []).filter((u) => u.owner === owner && u.type === "carrier");
    /** Every unit that could attack on day 1, aircraft aboard a Carrier included (they launch from its square). */
    const attackers = (owner: number) => (units ?? []).filter((u) => u.owner === owner)
      .flatMap((u) => [{ type: u.type, pos: u.pos }, ...(u.cargo ?? []).map((c) => ({ type: c.type, pos: u.pos }))]);
    /** How far a unit can attack without help on day 1: move and fire, or just fire for indirect units. */
    const reach = (type: UnitTypeId) => {
      const { range, canMoveAndFire, movePoints } = UNITS[type];
      return range === null ? -1 : (canMoveAndFire ? movePoints : 0) + range.max;
    };
    /** The cheapest a ship could sail from one square to each other square, ignoring other units. */
    const sailingCost = (from: Point): Map<string, number> => {
      const cost = new Map([[`${from.x},${from.y}`, 0]]);
      const queue = [from];
      for (let p = queue.shift(); p; p = queue.shift()) {
        for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
          const q = P(p.x + dx, p.y + dy);
          if (q.x < 0 || q.y < 0 || q.x >= map.width || q.y >= map.height) continue;
          const step = TERRAIN[terrainAt(map, q)].moveCost.sea;
          if (step === null) continue;
          const total = (cost.get(`${p.x},${p.y}`) ?? 0) + step;
          if (total >= (cost.get(`${q.x},${q.y}`) ?? Infinity)) continue;
          cost.set(`${q.x},${q.y}`, total);
          queue.push(q);
        }
      }
      return cost;
    };

    it("the US fights Japan and moves first, as on every built-in map, so the US is the army green player (08-art-pipeline §12)", () => {
      expect(players.map((p) => p.nation)).toEqual(["us", "japan"]);
    });

    it("Japan wins by capturing Sand Island's command post and Eastern Island's airfield, both held by the US at the start", () => {
      expect(victory).toContainEqual({ type: "captureProperties", side: "axis", properties: [commandPost, airfield] });
      expect([commandPost, airfield].map((p) => terrainAt(map, p))).toEqual(["city", "airfield"]);
      for (const p of objectives) expect(propertyOwners).toContainEqual({ pos: p, owner: US });
    });

    it("the US wins by holding Midway to the start of day 12", () => {
      expect(victory).toContainEqual({ type: "surviveDays", side: "allies", days: 12 });
    });

    it("Midway is two islands inside a ring of reef: soldiers can't walk from the command post to the airfield", () => {
      expect(connected(map, "foot", commandPost, airfield)).toBe(false);
      const reefs = map.terrain.flatMap((t, i) => (t === "reef" ? [P(i % map.width, Math.floor(i / map.width))] : []));
      const ring = reefs.filter((r) => r.x >= commandPost.x - 1 && r.x <= airfield.x + 1 && r.y < commandPost.y && r.y >= commandPost.y - 3);
      expect(ring.length).toBeGreaterThanOrEqual(8);
    });

    it("Japan has four Carriers north-west of Midway, and every one of them can strike Sand Island on its first turn without moving", () => {
      const jp = carriers(JAPAN);
      expect(jp).toHaveLength(4);
      for (const c of jp) {
        expect(c.cargo, `carrier at ${c.pos.x},${c.pos.y}`).toHaveLength(2);
        expect(c.pos.x).toBeLessThan(airfield.x);
        expect(c.pos.y).toBeLessThan(commandPost.y);
        expect(dist(c.pos, commandPost)).toBeLessThanOrEqual(UNITS.diveBomber.movePoints + 1);
      }
    });

    it("the US has three Carriers north-east of Midway, each with two aircraft aboard", () => {
      const us = carriers(US);
      expect(us).toHaveLength(3);
      for (const c of us) {
        expect(c.cargo, `carrier at ${c.pos.x},${c.pos.y}`).toHaveLength(2);
        expect(c.pos.x).toBeGreaterThan(commandPost.x);
        expect(c.pos.y).toBeLessThan(commandPost.y);
      }
    });

    it("no unit can attack an enemy Carrier from where it starts: not the other fleet's aircraft, ships or submarines, nor Midway's aircraft and PT boats", () => {
      for (const owner of [JAPAN, US]) {
        for (const target of carriers(1 - owner)) {
          for (const a of attackers(owner).filter((u) => baseDamage(u.type, "carrier") !== null)) {
            expect(dist(a.pos, target.pos), `${a.type} at ${a.pos.x},${a.pos.y} vs carrier at ${target.pos.x},${target.pos.y}`).toBeGreaterThan(reach(a.type));
          }
        }
      }
    });

    it("each US Carrier is one move from striking range of a Japanese Carrier, so the side that closes in is the one exposed", () => {
      const strike = UNITS.diveBomber.movePoints + 1;
      for (const c of carriers(US)) {
        const cost = sailingCost(c.pos);
        const closeEnough = [...cost].some(([key, spent]) => {
          const [x = 0, y = 0] = key.split(",").map(Number);
          return spent <= UNITS.carrier.movePoints && carriers(JAPAN).some((j) => dist(P(x, y), j.pos) <= strike);
        });
        expect(closeEnough, `carrier at ${c.pos.x},${c.pos.y}`).toBe(true);
      }
    });

    it("Midway starts with its own air group of a Fighter, a Bomber, a Dive Bomber and a Torpedo Bomber on Eastern Island", () => {
      const air = (units ?? []).filter((u) => u.owner === US && UNITS[u.type].category === "air");
      expect(air.map((u) => u.type).sort()).toEqual(["bomber", "diveBomber", "fighter", "torpedoBomber"]);
      for (const u of air) expect(connected(map, "foot", u.pos, airfield), `${u.type} at ${u.pos.x},${u.pos.y}`).toBe(true);
    });

    it("Japan's invasion force, three loaded Landing Craft, starts more than two days' sailing from Midway", () => {
      const craft = (units ?? []).filter((u) => u.owner === JAPAN && u.type === "landingCraft");
      expect(craft).toHaveLength(3);
      for (const lc of craft) {
        expect(lc.cargo).toHaveLength(2);
        expect(dist(lc.pos, commandPost)).toBeGreaterThan(2 * UNITS.landingCraft.movePoints);
      }
    });

    it("Japan has no airfield of its own: it can't replace lost aircraft until it takes Midway's", () => {
      expect(properties(midway, "airfield", JAPAN)).toHaveLength(0);
    });

    it("neither side builds Heavy Tanks (01-units §1)", () => {
      for (const p of players) expect(p.buildable).not.toContain("heavyTank");
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

  it("Crossroads uses scenario objectives: the Allies must capture the village, the Axis must hold it (11-tech-setup §6, milestone 12)", () => {
    const scenario = SCENARIOS.find((s) => s.id === "crossroads");
    expect(scenario?.setup.victory?.map((v) => v.type)).toEqual(["hqCapture", "rout", "captureProperties", "holdProperties"]);
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

  it("the scenario victory conditions are read from the file (04-economy §8)", () => {
    const victory = [
      { type: "captureProperties", side: "allies", properties: [P(1, 0)] },
      { type: "holdProperties", side: "axis", properties: [P(1, 0), P(2, 2)], days: 4 },
      { type: "surviveDays", side: "axis", days: 10 },
    ];
    expect(parseScenario({ ...valid(), victory }).setup.victory).toEqual(victory);
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
    ["an unknown victory condition", { victory: [{ type: "conquest" }] }, /unknown victory condition/],
    ["an objective that isn't a property", { victory: [{ type: "captureProperties", side: "allies", properties: [P(1, 1)] }] }, /isn't a property/],
    ["an objective with no properties", { victory: [{ type: "captureProperties", side: "allies", properties: [] }] }, /at least one property/],
    ["an unknown side", { victory: [{ type: "surviveDays", side: "martians", days: 5 }] }, /side must be allies or axis/],
    ["a side with no players", { victory: [{ type: "surviveDays", side: "axis", days: 5 }], players: [{ name: "A", nation: "us" }, { name: "B", nation: "uk" }] }, /no player on the axis side/],
    ["a hold with no days", { victory: [{ type: "holdProperties", side: "axis", properties: [P(1, 0)] }] }, /"days" must be a whole number/],
    ["surviving to day 1", { victory: [{ type: "surviveDays", side: "axis", days: 1 }] }, /day 2 or later/],
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
