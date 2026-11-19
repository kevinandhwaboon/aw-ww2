import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import { TERRAIN, type MovementType } from "../src/engine/data/terrain";
import { baseDamage } from "../src/engine/data/damage";
import { UNITS, type UnitTypeId } from "../src/engine/data/units";
import { NATIONS } from "../src/engine/data/nations";
import { terrainAt, type GameMap, type Point } from "../src/engine/map";
import { loadGame, saveGame } from "../src/engine/save";
import { parseScenario, type Scenario } from "../src/engine/scenario";
import { createGame } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import { moveDestinations } from "../src/engine/movement";
import { SCENARIOS } from "../src/scenarios";
import { defaultComputerPlayers } from "../src/ui/computerPlayers";
import { makeGame } from "./helpers";
import * as stats from "../src/engine/stats";

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

/** Player ids on each side, Allies first (Market Garden has two Allied players). */
const sides = (scenario: Scenario): [number[], number[]] => {
  const ids = scenario.setup.players.map((_, id) => id);
  const allied = (id: number) => NATIONS[scenario.setup.players[id]?.nation ?? "us"].side === "allies";
  return [ids.filter(allied), ids.filter((id) => !allied(id))];
};
const sideProperties = (scenario: Scenario, terrain: string, side: number[]) => side.flatMap((owner) => properties(scenario, terrain, owner));

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
  it("every built-in map is modeled on a WW2 battle: Normandy, Market Garden, El Alamein, Bastogne, Stalingrad, Kursk, Iwo Jima, The Slot, Midway and Guadalcanal", () => {
    expect(SCENARIOS.map((s) => s.id)).toEqual(["normandy", "market-garden", "el-alamein", "bastogne", "battle-of-britain", "stalingrad", "kursk", "iwo-jima", "the-slot", "midway", "guadalcanal"]);
  });

  it("have unique ids", () => {
    expect(new Set(SCENARIOS.map((s) => s.id)).size).toBe(SCENARIOS.length);
  });

  describe.each(SCENARIOS.map((s) => [s.name, s] as const))("%s", (_, scenario) => {
    it("both sides have an HQ and a factory", () => {
      for (const side of sides(scenario)) {
        expect(sideProperties(scenario, "hq", side), `players ${side.join(", ")} HQ`).toHaveLength(1);
        expect(sideProperties(scenario, "factory", side).length, `players ${side.join(", ")} factory`).toBeGreaterThan(0);
      }
    });

    it("every player starts with units", () => {
      scenario.setup.players.forEach((_, owner) => expect((scenario.setup.units ?? []).some((u) => u.owner === owner), `player ${owner}`).toBe(true));
    });

    it("infantry and tanks can reach the enemy HQ, on land or carried across the sea by Landing Craft", () => {
      const { map } = scenario.setup;
      const [allies, axis] = sides(scenario);
      const [a] = sideProperties(scenario, "hq", allies);
      const [b] = sideProperties(scenario, "hq", axis);
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
      const averageColumn = (side: number[]) => {
        const columns = units.filter((u) => side.includes(u.owner)).map((u) => u.pos.x);
        return columns.reduce((sum, x) => sum + x, 0) / columns.length;
      };
      const [allies, axis] = sides(scenario);
      const [left, right] = averageColumn(allies) < averageColumn(axis) ? [allies, axis] : [axis, allies];
      const facing = createGame({ ...scenario.setup, seed: 1 }).players.map((p) => p.facing);
      for (const id of left) expect(facing[id], `player ${id}`).toBe("right");
      for (const id of right) expect(facing[id], `player ${id}`).toBe("left");
    });
  });

  it("The Slot is a fair mirror: the map and starting units rotate onto each other", () => {
    const scenario = SCENARIOS.find((s) => s.id === "the-slot");
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
    const town = P(14, 13); // the town of Bastogne
    const roadsOut = [[0, 1], [1, 0], [0, -1], [-1, 0]].filter(([dx, dy]) => {
      const t = terrainAt(map, P(town.x + (dx ?? 0), town.y + (dy ?? 0)));
      return t === "road" || t === "bridge";
    });

    it("both sides win the same way: capture the enemy HQ or destroy every enemy unit, with no town to take or days to hold", () => {
      expect(victory).toEqual([{ type: "hqCapture" }, { type: "rout" }]);
    });

    it("the US holds the town of Bastogne at the start", () => {
      expect(terrainAt(map, town)).toBe("city");
      expect(bastogne.setup.propertyOwners).toContainEqual({ pos: town, owner: 0 });
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

  describe("Kursk (15-scenarios-eastern-front)", () => {
    const kursk = SCENARIOS.find((s) => s.id === "kursk");
    if (!kursk) throw new Error("missing scenario");
    const { map, units = [], players, victory } = kursk.setup;
    const town = P(34, 40); // Kursk
    const orel = P(30, 4);
    const prokhorovka = P(44, 60);
    const owned = (owner: number) => (kursk.setup.propertyOwners ?? []).filter((p) => p.owner === owner);
    const tiles = (terrain: string) => map.terrain.flatMap((t, i) => (t === terrain ? [P(i % map.width, Math.floor(i / map.width))] : []));

    it("is a theater map of the whole salient, 68 × 80 squares, with the Soviet Union against Germany", () => {
      expect([map.width, map.height]).toEqual([68, 80]);
      expect(players.map((p) => p.nation)).toEqual(["ussr", "germany"]);
    });

    it("the Soviet Union moves first, so it's the army green player; its first turn stands for the barrage it fired the night before the attack (08-art-pipeline §12)", () => {
      expect(players[0]?.nation).toBe("ussr");
    });

    it("Kursk is the Soviet HQ, in the salient: Germany holds ground to the north, west and south of it, and none to the east", () => {
      expect(properties(kursk, "hq", 0).map((p) => p.pos)).toEqual([town]);
      const german = owned(1).map((p) => p.pos);
      expect(german.some((p) => p.y < town.y - 15)).toBe(true);
      expect(german.some((p) => p.y > town.y + 15)).toBe(true);
      expect(german.some((p) => p.x < town.x - 15)).toBe(true);
      expect(german.every((p) => p.x < town.x + 10)).toBe(true);
    });

    it("Orel is the German HQ, behind the north pincer", () => {
      expect(properties(kursk, "hq", 1).map((p) => p.pos)).toEqual([orel]);
    });

    it("the Soviets dug in on the north and south faces: belts of bunkers and anti-tank obstacles there", () => {
      const north = (p: Point) => p.y < town.y - 6;
      const south = (p: Point) => p.y > town.y + 6;
      expect(tiles("bunker").filter(north).length).toBeGreaterThanOrEqual(20);
      expect(tiles("bunker").filter(south).length).toBeGreaterThanOrEqual(20);
      expect(tiles("obstacle").filter(north).length).toBeGreaterThanOrEqual(5);
      expect(tiles("obstacle").filter(south).length).toBeGreaterThanOrEqual(5);
    });

    it("the west face, where no attack came, has no defense belts", () => {
      expect(tiles("bunker").filter((p) => p.x < 14)).toEqual([]);
      expect(tiles("obstacle").filter((p) => p.x < 14)).toEqual([]);
    });

    it("the Soviet riflemen of the first belts start dug in, in the bunkers", () => {
      const dugIn = units.filter((u) => u.owner === 0 && terrainAt(map, u.pos) === "bunker");
      expect(dugIn.length).toBeGreaterThanOrEqual(10);
      for (const u of dugIn) expect(["infantry", "assaultInfantry", "mortar"]).toContain(u.type);
    });

    it("German tanks from both pincers can drive to Kursk: the obstacles never seal the way", () => {
      const tanks = units.filter((u) => u.owner === 1 && (u.type === "heavyTank" || u.type === "mediumTank"));
      const north = tanks.filter((u) => u.pos.y < town.y);
      const south = tanks.filter((u) => u.pos.y > town.y);
      expect(north.length).toBeGreaterThan(0);
      expect(south.length).toBeGreaterThan(north.length);
      for (const t of tanks) expect(connected(map, "tracks", t.pos, town), `${t.type} at ${t.pos.x},${t.pos.y}`).toBe(true);
    });

    it("both sides field Heavy Tanks (KV-1 and Tiger), and Germany has more of them", () => {
      const heavies = (owner: number) => units.filter((u) => u.owner === owner && u.type === "heavyTank").length;
      expect(heavies(0)).toBeGreaterThan(0);
      expect(heavies(1)).toBeGreaterThan(heavies(0));
    });

    it("Prokhorovka, where the tank armies met, is a Soviet town on the road from Belgorod", () => {
      expect(terrainAt(map, prokhorovka)).toBe("city");
      expect(kursk.setup.propertyOwners).toContainEqual({ pos: prokhorovka, owner: 0 });
      const roads = [[0, 1], [1, 0], [0, -1], [-1, 0]].filter(([dx, dy]) => terrainAt(map, P(prokhorovka.x + (dx ?? 0), prokhorovka.y + (dy ?? 0))) === "road");
      expect(roads.length).toBeGreaterThanOrEqual(2);
    });

    it("the Steppe Front's tank reserve starts far to the east, near Stary Oskol, and can drive to Prokhorovka", () => {
      const reserve = units.filter((u) => u.owner === 0 && u.pos.x >= 58 && (u.type === "mediumTank" || u.type === "lightTank"));
      expect(reserve.length).toBeGreaterThanOrEqual(3);
      for (const t of reserve) expect(connected(map, "tracks", t.pos, prokhorovka)).toBe(true);
    });

    it("the Soviet Union has the bigger income; Germany starts with more funds", () => {
      expect(owned(0).length).toBeGreaterThan(owned(1).length);
      expect(players[1]?.funds ?? 0).toBeGreaterThan(players[0]?.funds ?? 0);
    });

    it("capturing the enemy HQ is the only way to win: rout is off on a map this size", () => {
      expect(victory).toEqual([{ type: "hqCapture" }]);
    });

    it("both sides can build every land unit, Heavy Tank included, and Fighters, Bombers and Transport Aircraft, but nothing else", () => {
      const expected = [...(Object.keys(UNITS) as UnitTypeId[]).filter((t) => UNITS[t].category === "land" && !UNITS[t].neverBuilt), "fighter", "bomber", "transportAircraft"].sort();
      for (const p of players) expect([...(p.buildable ?? [])].sort()).toEqual(expected);
    });
  });

  describe("Stalingrad (15-scenarios-eastern-front §2)", () => {
    const stalingrad = SCENARIOS.find((s) => s.id === "stalingrad");
    if (!stalingrad) throw new Error("missing scenario");
    const { map, units = [], players, victory, weather } = stalingrad.setup;
    const kalach = P(27, 39);
    const beketovka = P(50, 43);
    const krasnayaSloboda = P(54, 37);
    const sovetsky = P(31, 43);
    const gumrak = P(47, 35);
    const footholds = { rynok: P(53, 32), spartanovka: P(51, 33), redOctober: P(52, 36) };
    const landings = { spartanovka: P(52, 33), redOctober: P(52, 37) };
    const mamayev = P(51, 37);
    const owners = stalingrad.setup.propertyOwners ?? [];
    const ownerAt = (p: Point) => owners.find((o) => o.pos.x === p.x && o.pos.y === p.y)?.owner;
    const tiles = (terrain: string) => map.terrain.flatMap((t, i) => (t === terrain ? [P(i % map.width, Math.floor(i / map.width))] : []));
    const unitAt = (p: Point) => units.find((u) => u.pos.x === p.x && u.pos.y === p.y);
    const near = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y) === 1;
    const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

    it("is a theater map of the city and the Don bend, 70 × 68 squares, with the Soviet Union against Germany", () => {
      expect([map.width, map.height]).toEqual([70, 68]);
      expect(players.map((p) => p.nation)).toEqual(["ussr", "germany"]);
    });

    it("the Soviet Union moves first: Operation Uranus opened with a dawn barrage", () => {
      expect(players[0]?.nation).toBe("ussr");
    });

    it("Kalach is the German HQ, east of the Don, its bridge to the west a Major Bridge that Assault Infantry can blow", () => {
      expect(properties(stalingrad, "hq", 1).map((p) => p.pos)).toEqual([kalach]);
      expect(terrainAt(map, P(kalach.x - 1, kalach.y))).toBe("majorBridge");
    });

    it("the Don's other big bridge, at Rychkovsky by Nizhne-Chirskaya, is a Major Bridge too", () => {
      expect(tiles("majorBridge")).toHaveLength(2);
    });

    it("Beketovka, just south of the city, is the Soviet HQ, and German tanks can reach it by land", () => {
      expect(properties(stalingrad, "hq", 0).map((p) => p.pos)).toEqual([beketovka]);
      const tank = units.find((u) => u.owner === 1 && u.type === "mediumTank");
      if (!tank) throw new Error("no German tank");
      expect(connected(map, "tracks", tank.pos, beketovka)).toBe(true);
    });

    it("the Volga has no bridge: nothing on foot or tracks can get from the east bank to the city", () => {
      for (const type of ["foot", "heavyFoot", "wheels", "tracks"] as const) {
        expect(connected(map, type, krasnayaSloboda, footholds.redOctober), type).toBe(false);
      }
    });

    it("the Soviets hold three footholds in the city, Rynok, Spartanovka and Red October, each with riflemen in it", () => {
      for (const [name, p] of Object.entries(footholds)) {
        expect(terrainAt(map, p), name).toBe("city");
        expect(ownerAt(p), name).toBe(0);
        expect(unitAt(p)?.type, name).toBe("infantry");
      }
    });

    it("every other city square in Stalingrad is German, and the ruins between them are rubble", () => {
      const city = owners.filter((o) => terrainAt(map, o.pos) === "city" && o.pos.x >= 50 && o.pos.x <= 53 && o.pos.y >= 32 && o.pos.y <= 41);
      const soviet = city.filter((o) => o.owner === 0).map((o) => o.pos);
      expect(soviet).toEqual(expect.arrayContaining(Object.values(footholds)));
      expect(soviet).toHaveLength(3);
      expect(city.filter((o) => o.owner === 1).length).toBeGreaterThanOrEqual(5);
      expect(tiles("rubble").length).toBeGreaterThanOrEqual(4);
    });

    it("Mamayev Kurgan is a hill in the middle of the city that nobody holds at the start", () => {
      expect(terrainAt(map, mamayev)).toBe("hills");
      expect(unitAt(mamayev)).toBeUndefined();
    });

    it("each Soviet strip in the city (Rynok–Spartanovka and Red October) has a landing beach on the river, and a Soviet Landing Craft from Krasnaya Sloboda can reach both", () => {
      expect(terrainAt(map, krasnayaSloboda)).toBe("port");
      expect(unitAt(krasnayaSloboda)).toEqual(expect.objectContaining({ type: "landingCraft", owner: 0 }));
      const byBoat = reachable(map, ["landingCraft"], krasnayaSloboda);
      expect(near(landings.spartanovka, footholds.spartanovka)).toBe(true);
      expect(near(landings.redOctober, footholds.redOctober)).toBe(true);
      for (const [name, beach] of Object.entries(landings)) {
        expect(terrainAt(map, beach), name).toBe("beach");
        expect(byBoat.has(`${beach.x},${beach.y}`), name).toBe(true);
      }
    });

    it("Germany has no port and can't build ships, so it can never cross the Volga; the Soviets build Landing Craft and no other ship", () => {
      expect(properties(stalingrad, "port", 1)).toEqual([]);
      expect((players[1]?.buildable ?? []).filter((t) => UNITS[t].category === "naval")).toEqual([]);
      expect((players[0]?.buildable ?? []).filter((t) => UNITS[t].category === "naval")).toEqual(["landingCraft"]);
    });

    it("Soviet guns on the east bank can shell the city across the river", () => {
      const cityTiles = [...tiles("rubble"), ...Object.values(footholds), ...owners.filter((o) => o.owner === 1 && terrainAt(map, o.pos) === "city").map((o) => o.pos)];
      const eastBank = units.filter((u) => u.owner === 0 && (u.type === "artillery" || u.type === "rocketArtillery") && connected(map, "tracks", u.pos, krasnayaSloboda));
      expect(eastBank.length).toBeGreaterThanOrEqual(2);
      for (const gun of eastBank) {
        const range = UNITS[gun.type].range ?? { min: 1, max: 1 };
        expect(cityTiles.some((p) => distance(p, gun.pos) >= range.min && distance(p, gun.pos) <= range.max), `${gun.type} at ${gun.pos.x},${gun.pos.y}`).toBe(true);
      }
    });

    it("both Soviet pincers can drive to Kalach and to Sovetsky, where they met: the northern from the Don bridgeheads, the southern from below the city", () => {
      const tanks = units.filter((u) => u.owner === 0 && ["mediumTank", "heavyTank", "lightTank"].includes(u.type));
      const north = tanks.filter((u) => u.pos.x < 25 && u.pos.y < 25);
      const south = tanks.filter((u) => u.pos.x > 45 && u.pos.y > 40);
      expect(north.length).toBeGreaterThanOrEqual(5);
      expect(south.length).toBeGreaterThanOrEqual(3);
      for (const t of [...north, ...south]) {
        expect(connected(map, "tracks", t.pos, kalach), `${t.type} at ${t.pos.x},${t.pos.y}`).toBe(true);
        expect(connected(map, "tracks", t.pos, sovetsky), `${t.type} at ${t.pos.x},${t.pos.y}`).toBe(true);
      }
    });

    it("Germany's factories are all outside the ring the Soviets will close: each is farther from the city than Kalach", () => {
      const factories = properties(stalingrad, "factory", 1);
      expect(factories.length).toBeGreaterThanOrEqual(3);
      for (const f of factories) expect(distance(f.pos, gumrak)).toBeGreaterThan(distance(kalach, gumrak));
    });

    it("the land bridge north of the city is fortified, but the Romanian-held Don front facing the bridgeheads has only a few bunkers", () => {
      const bunkers = tiles("bunker").filter((p) => ownerAt(p) === undefined);
      const landBridge = bunkers.filter((p) => p.x >= 36 && p.y >= 26 && p.y <= 32);
      const donFront = bunkers.filter((p) => p.x < 25 && p.y < 25);
      expect(landBridge.length).toBeGreaterThanOrEqual(6);
      expect(donFront.length).toBeGreaterThan(0);
      expect(donFront.length).toBeLessThan(landBridge.length);
    });

    it("Germany fields no Heavy Tank, as the first Tigers reached this front only in January 1943; the Soviets have a KV-1", () => {
      expect(players[1]?.buildable).not.toContain("heavyTank");
      expect(units.filter((u) => u.owner === 1 && u.type === "heavyTank")).toEqual([]);
      expect(players[0]?.buildable).toContain("heavyTank");
      expect(units.some((u) => u.owner === 0 && u.type === "heavyTank")).toBe(true);
    });

    it("the Soviets have more units and the first move; Germany has more properties and a stronger army in the city", () => {
      const count = (owner: number) => units.filter((u) => u.owner === owner).length;
      expect(count(0)).toBeGreaterThan(count(1));
      expect(owners.filter((o) => o.owner === 1).length).toBeGreaterThan(owners.filter((o) => o.owner === 0).length);
      const inCity = (owner: number) => units.filter((u) => u.owner === owner && u.pos.x >= 49 && u.pos.x <= 53 && u.pos.y >= 32 && u.pos.y <= 41).length;
      expect(inCity(1)).toBeGreaterThan(inCity(0));
    });

    it("the Soviets win by taking Kalach; Germany wins by taking Beketovka, or all three footholds in the city; rout is off", () => {
      expect(victory).toEqual([
        { type: "hqCapture" },
        { type: "captureProperties", side: "axis", properties: [footholds.rynok, footholds.spartanovka, footholds.redOctober] },
      ]);
    });

    it("it's winter: snow on the ground, snowfall on the opening days and again from day 12", () => {
      expect(weather?.season).toBe("winter");
      expect(weather?.forecast[0]).toEqual({ fromDay: 1, weather: "snow" });
      expect(weather?.forecast.at(-1)).toEqual({ fromDay: 12, weather: "snow" });
    });
  });

  describe("Battle of Britain (20-scenarios-battle-of-britain)", () => {
    const bob = SCENARIOS.find((s) => s.id === "battle-of-britain");
    if (!bob) throw new Error("missing scenario");
    const { map, units = [], players, victory, weather, modifiers = [] } = bob.setup;
    const UK = 0;
    const GERMANY = 1;
    const london = P(6, 4);
    const capBlancNez = P(19, 12);
    const dover = P(15, 8);
    const hawkinge = P(13, 8);
    const wissant = P(18, 11);
    const sheerness = P(10, 4);
    const portsmouth = P(0, 11);
    const invasionPorts = { boulogne: P(17, 13), calais: P(19, 10), dunkirk: P(23, 9) };
    const sectorStations = { northWeald: P(8, 2), hornchurch: P(8, 4), bigginHill: P(7, 6), kenley: P(6, 7), tangmere: P(2, 11) };
    const owners = bob.setup.propertyOwners ?? [];
    const ownerAt = (p: Point) => owners.find((o) => o.pos.x === p.x && o.pos.y === p.y)?.owner;
    const unitAt = (p: Point) => units.find((u) => u.pos.x === p.x && u.pos.y === p.y);
    const distance = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const count = (owner: number, type: UnitTypeId) => units.filter((u) => u.owner === owner && u.type === type).length;
    const tiles = (terrain: string) => map.terrain.flatMap((t, i) => (t === terrain ? [P(i % map.width, Math.floor(i / map.width))] : []));
    const englishSide = (p: Point) => connected(map, "foot", p, london);

    /**
     * How far an aircraft of this side can strike from an airfield on a full tank and still fly home:
     * it flies out over several days and back the same way, burning its daily fuel each morning it's
     * in the air, and attacks the square next to where it stops. Read through the modifier layer, so
     * the scenario's own rules count.
     */
    const strikeReach = (owner: number, type: UnitTypeId) => {
      const game = createGame({ ...bob.setup, seed: 1 });
      const unit = game.units.find((u) => u.owner === owner && u.type === type);
      if (!unit) throw new Error(`no ${type}`);
      const [move, tank, perDay, perSquare] = [stats.movePoints(game, unit), stats.maxFuel(game, unit), stats.fuelPerDay(game, unit), stats.fuelPerMove(game, unit)];
      let out = 0;
      for (let r = 1; r < 60; r++) {
        const days = Math.ceil(r / move);
        if (2 * r * perSquare + (2 * days - 1) * perDay <= tank) out = r;
      }
      return out + 1;
    };

    it("is a map of south-east England and the Pas-de-Calais, 27 × 21 squares of about 10 km, with the United Kingdom against Germany", () => {
      expect([map.width, map.height]).toEqual([27, 21]);
      expect(players.map((p) => p.nation)).toEqual(["uk", "germany"]);
    });

    it("London is the UK's HQ and Kesselring's command post at Cap Blanc-Nez is Germany's", () => {
      expect(properties(bob, "hq", UK).map((p) => p.pos)).toEqual([london]);
      expect(properties(bob, "hq", GERMANY).map((p) => p.pos)).toEqual([capBlancNez]);
    });

    it("the Channel has no land crossing: nothing on foot, wheels or tracks gets from France to England without a boat", () => {
      for (const type of ["foot", "heavyFoot", "wheels", "tracks"] as const) expect(connected(map, type, capBlancNez, london), type).toBe(false);
    });

    it("the RAF has six airfields: four sector stations round London and Tangmere on the south coast, each with a Fighter, and Hawkinge, the empty forward field Germany must take", () => {
      for (const [name, p] of Object.entries(sectorStations)) {
        expect(terrainAt(map, p), name).toBe("airfield");
        expect(ownerAt(p), name).toBe(UK);
        expect(unitAt(p), name).toEqual(expect.objectContaining({ type: "fighter", owner: UK }));
        if (name !== "tangmere") expect(distance(p, london), name).toBeLessThanOrEqual(4);
      }
      expect(terrainAt(map, hawkinge)).toBe("airfield");
      expect(unitAt(hawkinge)).toBeUndefined();
      expect(properties(bob, "airfield", UK)).toHaveLength(6);
    });

    it("the Luftwaffe outnumbers the RAF as in August 1940: two Fighters to every RAF Fighter, and four aircraft to every RAF aircraft", () => {
      expect([count(UK, "fighter"), count(UK, "bomber")]).toEqual([5, 1]);
      expect([count(GERMANY, "fighter"), count(GERMANY, "bomber")]).toEqual([10, 10]);
    });

    it("it's always played in fog of war, whatever the new-game box says (19-fog-of-war §1)", () => {
      expect(bob.setup.settings?.fogOfWar).toBe(true);
      expect(createGame({ ...bob.setup, seed: 1 }).settings.fogOfWar).toBe(true);
    });

    it("four Chain Home radar stations stand on the Kent and Sussex coast; together they watch the German coastal airfields and the invasion ports", () => {
      const radars = units.filter((u) => u.type === "radarStation");
      expect(radars).toHaveLength(4);
      for (const r of radars) {
        expect(r.owner).toBe(UK);
        expect(englishSide(r.pos)).toBe(true);
        expect(distance(r.pos, dover)).toBeLessThanOrEqual(8);
      }
      const watched = (p: Point) => radars.some((r) => distance(r.pos, p) <= UNITS.radarStation.airVision);
      for (const p of [wissant, capBlancNez, ...Object.values(invasionPorts)]) expect(watched(p), `${p.x},${p.y}`).toBe(true);
    });

    it("London is at the very end of a Bf 109's reach: a Fighter from Wissant, the nearest German airfield, can just strike it and fly home, and from no other German airfield", () => {
      const reach = strikeReach(GERMANY, "fighter");
      expect(distance(wissant, london)).toBe(reach);
      for (const field of properties(bob, "airfield", GERMANY)) {
        if (field.pos.x !== wissant.x || field.pos.y !== wissant.y) expect(distance(field.pos, london), `${field.pos.x},${field.pos.y}`).toBeGreaterThan(reach);
      }
    });

    it("Bombers burn 1 fuel a square here, not 2: the He 111 flew several times as far as the Bf 109, so bombers from the coastal fields can reach London", () => {
      expect(modifiers).toEqual([{ source: "scenario:bomber-range", stat: "fuelPerMove", op: "set", value: 1, scope: { unitTypes: ["bomber"] } }]);
      expect(strikeReach(GERMANY, "bomber")).toBeGreaterThanOrEqual(distance(wissant, london));
      expect(strikeReach(GERMANY, "fighter")).toBe(distance(wissant, london));
    });

    it("the RAF's Fighters on the forward airfields can strike the German coastal fields and the invasion ports and get home", () => {
      const reach = strikeReach(UK, "fighter");
      for (const target of [wissant, capBlancNez, ...Object.values(invasionPorts)]) expect(distance(hawkinge, target)).toBeLessThanOrEqual(reach);
    });

    it("the invasion barges wait empty in Boulogne, Calais and Dunkirk, and each can sail to a landing beach on the English coast", () => {
      const beaches = tiles("beach").filter(englishSide);
      expect(beaches.length).toBeGreaterThanOrEqual(3);
      for (const [name, port] of Object.entries(invasionPorts)) {
        expect(terrainAt(map, port), name).toBe("port");
        expect(unitAt(port), name).toEqual(expect.objectContaining({ type: "landingCraft", owner: GERMANY }));
        expect(unitAt(port)?.cargo ?? [], name).toEqual([]);
        const byBoat = reachable(map, ["landingCraft"], port);
        expect(beaches.some((b) => byBoat.has(`${b.x},${b.y}`)), name).toBe(true);
      }
    });

    it("German troops wait beside the invasion ports to go aboard", () => {
      const troops = units.filter((u) => u.owner === GERMANY && ["infantry", "assaultInfantry"].includes(u.type) && Object.values(invasionPorts).some((p) => distance(p, u.pos) <= 2));
      expect(troops.length).toBeGreaterThanOrEqual(6);
    });

    it("pillboxes stand behind the invasion beaches, each with riflemen in it", () => {
      const pillboxes = tiles("bunker");
      expect(pillboxes.length).toBeGreaterThanOrEqual(2);
      expect(units.filter((u) => u.type === "radarStation").every((r) => terrainAt(map, r.pos) !== "bunker" && terrainAt(map, r.pos) !== "beach")).toBe(true);
      for (const p of pillboxes) {
        expect(englishSide(p)).toBe(true);
        expect(unitAt(p), `${p.x},${p.y}`).toEqual(expect.objectContaining({ type: "infantry", owner: UK }));
      }
    });

    it("the Royal Navy's destroyers at the Nore, off Dover and at Portsmouth can all sail into the Strait of Dover", () => {
      const destroyers = units.filter((u) => u.owner === UK && u.type === "destroyer");
      expect(destroyers.length).toBeGreaterThanOrEqual(4);
      expect(unitAt(sheerness)?.type).toBe("destroyer");
      expect(unitAt(portsmouth)?.type).toBe("destroyer");
      for (const d of destroyers) expect(connected(map, "sea", d.pos, P(16, 9)), `${d.pos.x},${d.pos.y}`).toBe(true);
    });

    it("Germany builds aircraft, barges and troops, but no transport aircraft and no warships; the UK builds no landing craft", () => {
      const germany = players[GERMANY]?.buildable ?? [];
      expect(germany).toEqual(expect.arrayContaining(["fighter", "bomber", "landingCraft", "infantry"]));
      expect(germany.filter((t) => UNITS[t].category === "naval")).toEqual(["landingCraft"]);
      expect(germany).not.toContain("transportAircraft");
      const uk = players[UK]?.buildable ?? [];
      expect(uk).toEqual(expect.arrayContaining(["fighter", "bomber", "destroyer"]));
      expect(uk).not.toContain("landingCraft");
      expect(uk).not.toContain("radarStation");
    });

    it("Germany wins by taking Dover and Hawkinge, a port and an airfield on English soil, or London; the UK wins by holding out until day 15", () => {
      expect(terrainAt(map, dover)).toBe("port");
      expect(terrainAt(map, hawkinge)).toBe("airfield");
      expect(victory).toEqual([
        { type: "hqCapture" },
        { type: "captureProperties", side: "axis", properties: [dover, hawkinge] },
        { type: "surviveDays", side: "allies", days: 15 },
      ]);
    });

    it("it's summer, clear but for two spells of rain, which bring fog for the day (12-weather §3a)", () => {
      expect(weather?.season).toBe("summer");
      expect(weather?.forecast.filter((f) => f.weather === "rain").map((f) => f.fromDay)).toEqual([5, 13]);
      expect(weather?.forecast[0]).toEqual({ fromDay: 1, weather: "clear" });
    });

    it("the computer plays Germany by default (09-ai §5)", () => {
      expect(defaultComputerPlayers(bob)).toEqual([GERMANY]);
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

    it("the US base holds only four properties, to keep US income low: an HQ, a Factory, a Port and an Airfield", () => {
      const owned = (propertyOwners ?? []).filter((p) => p.owner === 0).map((p) => terrainAt(map, p.pos)).sort();
      expect(owned).toEqual(["airfield", "factory", "hq", "port"]);
    });

    it("Japan holds 9 properties, only 4 of them cities: Mount Suribachi and three villages", () => {
      const owned = (propertyOwners ?? []).filter((p) => p.owner === 1);
      expect(owned).toHaveLength(9);
      const cities = owned.filter((p) => terrainAt(map, p.pos) === "city").map((p) => p.pos);
      expect(cities).toHaveLength(4);
      expect(cities).toContainEqual(suribachi);
    });

    it("Japan wins by holding out to the start of day 18", () => {
      expect(victory).toContainEqual({ type: "surviveDays", side: "axis", days: 18 });
    });

    it("Mount Suribachi is a peak at the south-west tip, ringed by hills", () => {
      expect(suribachi.x).toBeLessThan(map.width / 4);
      expect(suribachi.y).toBeGreaterThan(map.height * 0.7);
      expect(neighbors(suribachi).filter((t) => t === "hills").length).toBeGreaterThanOrEqual(3);
    });

    const dist = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
    const tiles = (terrain: string) => map.terrain.flatMap((t, i) => (t === terrain ? [P(i % map.width, Math.floor(i / map.width))] : []));
    const bunkers = tiles("bunker");
    const usUnits = units?.filter((u) => u.owner === 0) ?? [];
    const japanese = units?.filter((u) => u.owner === 1) ?? [];
    const guns = japanese.filter((u) => UNITS[u.type].range !== null);
    const manned = bunkers.filter((b) => japanese.some((u) => u.pos.x === b.x && u.pos.y === b.y));
    // The landing beaches: the sand below the line of Airfield No. 1, from Suribachi to the neck.
    const landingBeaches = tiles("beach").filter((b) => b.y >= airfield1.y);

    it("the US starts entirely at sea: no US unit is on land, and every soldier and tank is aboard a Landing Craft", () => {
      for (const u of usUnits) expect(UNITS[u.type].category).not.toBe("land");
      for (const u of usUnits.filter((u) => UNITS[u.type].category === "naval")) expect(terrainAt(map, u.pos)).toBe("sea");
      const craft = usUnits.filter((u) => u.type === "landingCraft");
      expect(craft.length).toBeGreaterThanOrEqual(6);
      for (const c of craft) expect(c.cargo).toHaveLength(2);
      const aboard = craft.flatMap((c) => c.cargo ?? []).map((c) => c.type);
      expect(aboard).toEqual(expect.arrayContaining(["infantry", "assaultInfantry", "mediumTank"]));
    });

    it("no Landing Craft can reach a beach on day 1, so the first day is for bombardment", () => {
      const state = createGame({ ...iwo.setup, seed: 1 });
      for (const craft of state.units.filter((u) => u.type === "landingCraft")) {
        const beaches = moveDestinations(state, craft).filter((p) => terrainAt(map, p) === "beach");
        expect(beaches).toEqual([]);
      }
    });

    it("Japan is dug in behind the beaches: every beach on the island is next to a manned bunker or under a Japanese gun", () => {
      expect(landingBeaches.length).toBeGreaterThan(10);
      for (const b of tiles("beach")) {
        const nextToPillbox = manned.some((m) => dist(m, b) === 1);
        const underFire = guns.some((g) => { const r = UNITS[g.type].range; return g.type !== "flakGun" && r !== null && dist(g.pos, b) >= r.min && dist(g.pos, b) <= r.max; });
        expect({ beach: b, covered: nextToPillbox || underFire }).toEqual({ beach: b, covered: true });
      }
    });

    it("no Japanese gun can reach any US ship or aircraft at the start", () => {
      const afloat = usUnits.filter((u) => UNITS[u.type].category !== "land");
      for (const g of guns) for (const u of afloat) expect(dist(g.pos, u.pos)).toBeGreaterThan(UNITS[g.type].range?.max ?? 0);
    });

    it("each Battleship can shell a Japanese soldier in a beach bunker on day 1 without moving (03-combat §4)", () => {
      const battleships = usUnits.filter((u) => u.type === "battleship");
      expect(battleships.length).toBeGreaterThanOrEqual(3);
      const { min, max } = UNITS.battleship.range;
      for (const bb of battleships) expect(manned.some((m) => dist(bb.pos, m) >= min && dist(bb.pos, m) <= max)).toBe(true);
    });

    it("two US Carriers start offshore, each carrying two Dive Bombers (05-supply-transport §10)", () => {
      const carriers = usUnits.filter((u) => u.type === "carrier");
      expect(carriers).toHaveLength(2);
      for (const c of carriers) {
        expect(terrainAt(map, c.pos)).toBe("sea");
        expect(c.cargo?.map((x) => x.type)).toEqual(["diveBomber", "diveBomber"]);
      }
    });

    it("the US anchorage has one Airfield, standing for the Marianas: the Bombers can fly home to it, and a Bomber from it reaches a manned bunker in two turns", () => {
      const airfields = properties(iwo, "airfield", 0);
      expect(airfields).toHaveLength(1);
      const [home] = airfields;
      if (!home) throw new Error("missing airfield");
      for (const b of usUnits.filter((u) => u.type === "bomber")) expect(dist(b.pos, home.pos)).toBeLessThanOrEqual(UNITS.bomber.movePoints * 2);
      expect(manned.some((m) => dist(home.pos, m) <= UNITS.bomber.movePoints * 2 + 1)).toBe(true);
      for (const g of guns) expect(dist(g.pos, home.pos)).toBeGreaterThan(UNITS[g.type].range?.max ?? 0);
    });

    it("each Carrier's Dive Bombers and each US Bomber can reach a manned bunker on the first day", () => {
      const strikers = usUnits.filter((u) => u.type === "carrier" || u.type === "bomber");
      expect(strikers.filter((u) => u.type === "bomber")).toHaveLength(2);
      for (const s of strikers) {
        const reach = (s.type === "carrier" ? UNITS.diveBomber.movePoints : UNITS.bomber.movePoints) + 1;
        expect(manned.some((m) => dist(s.pos, m) <= reach)).toBe(true);
      }
    });

    it("Japan's soldiers start dug into bunkers, and bunkers never stand on the sand", () => {
      const infantry = japanese.filter((u) => u.type === "infantry");
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
      const [hq] = properties(iwo, "hq", 1);
      if (!hq) throw new Error("missing HQ");
      expect(landingBeaches.some((b) => connected(map, "tracks", b, hq.pos))).toBe(true);
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

  describe("Guadalcanal (14-scenarios-pacific §4)", () => {
    const guadalcanal = SCENARIOS.find((s) => s.id === "guadalcanal");
    if (!guadalcanal) throw new Error("missing scenario");
    const { map, units, victory, players, propertyOwners, settings } = guadalcanal.setup;
    const US = 0;
    const JAPAN = 1;
    const henderson = victory?.find((v) => v.type === "captureProperties")?.properties[0];
    if (!henderson) throw new Error("missing objective");
    const at = (x: number, y: number) => terrainAt(map, P(x, y));
    const all = units ?? [];
    const ofSide = (owner: number, type: UnitTypeId) => all.filter((u) => u.owner === owner && u.type === type);
    const ownerOf = (p: Point) => propertyOwners?.find((o) => o.pos.x === p.x && o.pos.y === p.y)?.owner ?? null;
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
    /** Lunga Point's roadstead: the sea square off the beach where the US unloaded. */
    const roadstead = P(25, 13);
    const homePort = (owner: number) => (propertyOwners ?? []).find((p) => p.owner === owner && terrainAt(map, p.pos) === "port" && sideIsHome(p.pos, owner));
    const sideIsHome = (p: Point, owner: number) => (owner === JAPAN ? p.x < 10 : p.x > 34);

    it("the US fights Japan and moves first, so the US is the army green player (08-art-pipeline §12)", () => {
      expect(players.map((p) => p.nation)).toEqual(["us", "japan"]);
    });

    it("Japan wins by capturing Henderson Field, held by the US at the start", () => {
      expect(victory).toContainEqual({ type: "captureProperties", side: "axis", properties: [henderson] });
      expect(terrainAt(map, henderson)).toBe("airfield");
      expect(ownerOf(henderson)).toBe(US);
    });

    it("the US wins by holding Henderson Field to the start of day 15", () => {
      expect(victory).toContainEqual({ type: "surviveDays", side: "allies", days: 15 });
    });

    it("there's no port on Guadalcanal: no ship can be refuelled anywhere on the island", () => {
      const island = reachable(map, ["foot"], henderson);
      const ports = map.terrain.flatMap((t, i) => (t === "port" ? [P(i % map.width, Math.floor(i / map.width))] : []));
      expect(ports.length).toBeGreaterThan(0);
      for (const p of ports) expect(island.has(`${p.x},${p.y}`), `port at ${p.x},${p.y}`).toBe(false);
    });

    it("the US's nearest port is Tulagi, across Ironbottom Sound, which services one ship at a time", () => {
      const tulagi = P(26, 9);
      expect(at(26, 9)).toBe("port");
      expect(ownerOf(tulagi)).toBe(US);
      expect(sailingCost(roadstead).get("26,9")).toBeLessThanOrEqual(UNITS.destroyer.movePoints);
    });

    it("both home ports are days of sailing from Lunga Point: more than two days' Destroyer move for the US, three for Japan", () => {
      const fromLunga = sailingCost(roadstead);
      const us = homePort(US);
      const jp = homePort(JAPAN);
      if (!us || !jp) throw new Error("missing home ports");
      expect(fromLunga.get(`${us.pos.x},${us.pos.y}`)).toBeGreaterThan(2 * UNITS.destroyer.movePoints);
      expect(fromLunga.get(`${jp.pos.x},${jp.pos.y}`)).toBeGreaterThan(3 * UNITS.destroyer.movePoints);
    });

    it("each side starts with a Supply Ship, and both can build more (05-supply-transport §3a)", () => {
      expect(ofSide(US, "supplyShip")).toHaveLength(1);
      expect(ofSide(JAPAN, "supplyShip")).toHaveLength(1);
      for (const p of players) expect(p.buildable).toContain("supplyShip");
    });

    it("the US Supply Ship lies off Lunga Point next to a Marine battery short of shells, so it refills them on day 1", () => {
      const [ship] = ofSide(US, "supplyShip");
      const guns = ofSide(US, "artillery").filter((a) => ship && Math.abs(a.pos.x - ship.pos.x) + Math.abs(a.pos.y - ship.pos.y) === 1);
      expect(guns).toHaveLength(1);
      const state = createGame({ ...guadalcanal.setup, seed: 1 });
      const gun = guns[0];
      if (!gun) throw new Error("no battery by the Supply Ship");
      const refilled = state.units.find((u) => u.type === "artillery" && u.pos.x === gun.pos.x && u.pos.y === gun.pos.y);
      expect(refilled?.ammo).toBe(9); // a full load of shells (01-units §8)
    });

    it("Japan's convoy destroyers have come down the Slot and are short of fuel, with their Supply Ship a day's sailing away", () => {
      const [ship] = ofSide(JAPAN, "supplyShip");
      if (!ship) throw new Error("no Japanese Supply Ship");
      const reach = sailingCost(ship.pos);
      // The convoy: the destroyers escorting the Landing Craft.
      const craft = ofSide(JAPAN, "landingCraft");
      const convoy = ofSide(JAPAN, "destroyer").filter((d) => craft.some((c) => Math.abs(c.pos.x - d.pos.x) + Math.abs(c.pos.y - d.pos.y) <= 2));
      expect(convoy.length).toBeGreaterThanOrEqual(2);
      for (const d of convoy) expect(d.fuel ?? UNITS.destroyer.maxFuel).toBeLessThan(UNITS.destroyer.maxFuel);
      for (const d of convoy) expect(reach.get(`${d.pos.x},${d.pos.y}`), `destroyer at ${d.pos.x},${d.pos.y}`).toBeLessThanOrEqual(UNITS.supplyShip.movePoints + 1);
    });

    it("Japan's two Battleships start out of gun range of Henderson Field, but can be in range after one day's sailing", () => {
      const battleships = ofSide(JAPAN, "battleship");
      expect(battleships).toHaveLength(2);
      const range = 6; // Battleship guns reach 2-6 (01-units §8)
      for (const b of battleships) {
        const d = Math.abs(b.pos.x - henderson.x) + Math.abs(b.pos.y - henderson.y);
        expect(d, `battleship at ${b.pos.x},${b.pos.y}`).toBeGreaterThan(range);
        expect(d).toBeLessThanOrEqual(range + UNITS.battleship.movePoints);
      }
    });

    it("Japan attacks the perimeter from the west, from Kokumbona, and from the south, through the jungle onto Edson's Ridge", () => {
      const onIsland = reachable(map, ["foot"], henderson);
      const troops = all.filter((u) => u.owner === JAPAN && UNITS[u.type].category === "land" && onIsland.has(`${u.pos.x},${u.pos.y}`));
      expect(troops.filter((u) => u.pos.x < 21).length).toBeGreaterThanOrEqual(6);
      expect(troops.filter((u) => u.pos.y > henderson.y + 2).length).toBeGreaterThanOrEqual(4);
      expect(at(26, 17)).toBe("ridge");
    });

    it("Kokumbona is Japan's on the island; Rekata Bay on Santa Isabel and Koli Point are neutral", () => {
      expect(at(17, 14)).toBe("city");
      expect(ownerOf(P(17, 14))).toBe(JAPAN);
      expect(at(15, 3)).toBe("port");
      expect(ownerOf(P(15, 3))).toBeNull();
      expect(at(31, 16)).toBe("city");
      expect(ownerOf(P(31, 16))).toBeNull();
    });

    it("income is 500 per property, so the starting forces do most of the fighting", () => {
      expect(settings?.incomePerProperty).toBe(500);
    });

    it("neither side builds Heavy Tanks (01-units §1)", () => {
      for (const p of players) expect(p.buildable).not.toContain("heavyTank");
    });
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

describe("Market Garden (17-scenarios-market-garden)", () => {
  const scenario = SCENARIOS.find((s) => s.id === "market-garden");
  if (!scenario) throw new Error("missing scenario");
  const { map } = scenario.setup;
  const US = 0;
  const UK = 1;
  const GERMANY = 2;
  const start = () => createGame({ ...scenario.setup, seed: 1 });
  const run = (state: GameState, ...commands: Command[]) =>
    commands.reduce((s, c) => {
      const result = apply(s, c);
      if (!result.ok) throw new Error(result.message);
      return result.state;
    }, state);
  const endTurns = (n: number): Command[] => Array.from({ length: n }, () => ({ type: "endTurn" }));
  const hold = scenario.setup.victory?.find((v) => v.type === "holdProperties");
  const [ukHq] = properties(scenario, "hq", UK);
  const [kleve] = properties(scenario, "factory", GERMANY).filter((p) => p.pos.x > map.width * 0.7);
  const [eindhoven, nijmegen, arnhem] = hold?.type === "holdProperties" ? hold.properties : [];
  if (!ukHq || !kleve || !eindhoven || !nijmegen || !arnhem) throw new Error("missing places");

  /** Tank movement points from one tile to another by the cheapest route, ignoring units; Infinity if there's none. */
  function tankRoute(from: Point, to: Point, blown: ReadonlySet<string> = new Set()): number {
    const best = new Map([[`${from.x},${from.y}`, 0]]);
    const queue: [number, Point][] = [[0, from]];
    while (queue.length > 0) {
      queue.sort((a, b) => a[0] - b[0]);
      const [cost, p] = queue.shift() ?? [0, from];
      if (p.x === to.x && p.y === to.y) return cost;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
        const q = P(p.x + dx, p.y + dy);
        if (q.x < 0 || q.y < 0 || q.x >= map.width || q.y >= map.height) continue;
        const terrain = blown.has(`${q.x},${q.y}`) ? "blownBridge" : terrainAt(map, q);
        const step = TERRAIN[terrain].moveCost.tracks;
        if (step === null || cost + step >= (best.get(`${q.x},${q.y}`) ?? Infinity)) continue;
        best.set(`${q.x},${q.y}`, cost + step);
        queue.push([cost + step, q]);
      }
    }
    return Infinity;
  }
  const majorBridges = map.terrain.flatMap((t, i) => (t === "majorBridge" ? [P(i % map.width, Math.floor(i / map.width))] : []));

  it("the US moves first, then the UK, then Germany", () => {
    expect(scenario.setup.players.map((p) => p.nation)).toEqual(["us", "uk", "germany"]);
  });

  it("the computer plays only Germany by default (09-ai §5)", () => {
    expect(defaultComputerPlayers(scenario)).toEqual([GERMANY]);
  });

  it("the Allies win by holding Eindhoven, Nijmegen and Arnhem for 2 days, whichever Allied player holds each", () => {
    const state = start();
    const owners = new Map([[`${eindhoven.x},${eindhoven.y}`, US], [`${nijmegen.x},${nijmegen.y}`, UK], [`${arnhem.x},${arnhem.y}`, UK]]);
    const held: GameState = { ...state, properties: state.properties.map((p) => ({ ...p, owner: owners.get(`${p.pos.x},${p.pos.y}`) ?? p.owner })) };
    const after = run(held, ...endTurns(6)); // to the start of day 3
    expect(after.result?.winningSide).toBe("allies");
    expect(after.result?.reason).toBe("holdProperties");
  });

  it("Germany wins at the start of day 12", () => {
    const after = run(start(), ...endTurns(33));
    expect(after.day).toBe(12);
    expect(after.result?.winningSide).toBe("axis");
    expect(after.result?.reason).toBe("surviveDays");
  });

  it("the US has no HQ, so it plays on after the UK is out", () => {
    expect(properties(scenario, "hq", US)).toEqual([]);
    const after = run(start(), { type: "endTurn" }, { type: "resign" });
    expect(after.result).toBeNull();
    expect(after.players[UK]?.defeated).toBe(true);
    expect(after.players[US]?.defeated).toBe(false);
  });

  it("Allied tanks can drive from Belgium to Arnhem with every bridge standing", () => {
    expect(tankRoute(ukHq.pos, arnhem)).toBeLessThan(Infinity);
  });

  it("the big-river crossings lie on the tanks' road north: blowing any one of at least four makes the drive to Arnhem longer", () => {
    const direct = tankRoute(ukHq.pos, arnhem);
    const onTheRoad = majorBridges.filter((b) => tankRoute(ukHq.pos, arnhem, new Set([`${b.x},${b.y}`])) > direct);
    expect(onTheRoad.length).toBeGreaterThanOrEqual(4);
  });

  it("with every Major Bridge blown, the drive to Arnhem takes a Medium Tank at least two more days, the long way round through Germany", () => {
    const direct = tankRoute(ukHq.pos, arnhem);
    const allBlown = tankRoute(ukHq.pos, arnhem, new Set(majorBridges.map((b) => `${b.x},${b.y}`)));
    expect(allBlown - direct).toBeGreaterThanOrEqual(2 * UNITS.mediumTank.movePoints);
  });

  it("Germany can reinforce Nijmegen from Kleve without crossing a Major Bridge, so blowing them doesn't cut it off", () => {
    const allBlown = new Set(majorBridges.map((b) => `${b.x},${b.y}`));
    expect(tankRoute(kleve.pos, nijmegen, allBlown)).toBeLessThan(Infinity);
  });

  it("there are ordinary bridges too, which can never be blown", () => {
    expect(map.terrain.filter((t) => t === "bridge").length).toBeGreaterThanOrEqual(4);
  });

  it("every first-lift Transport Aircraft starts loaded and out of German flak range", () => {
    const units = scenario.setup.units ?? [];
    const flakRange = UNITS.flakGun.range.max;
    const flak = units.filter((u) => u.type === "flakGun" && u.owner === GERMANY);
    const lift = units.filter((u) => u.type === "transportAircraft");
    expect(lift.length).toBeGreaterThanOrEqual(6);
    for (const plane of lift) {
      expect(plane.cargo?.length, `plane at ${plane.pos.x},${plane.pos.y}`).toBe(2);
      for (const gun of flak) expect(Math.abs(plane.pos.x - gun.pos.x) + Math.abs(plane.pos.y - gun.pos.y)).toBeGreaterThan(flakRange);
    }
  });

  it("Germany has sappers next to the Son and Nijmegen bridges, ready to blow them", () => {
    const sappers = (scenario.setup.units ?? []).filter((u) => u.type === "assaultInfantry" && u.owner === GERMANY);
    const besideBridge = sappers.filter((u) => majorBridges.some((b) => Math.abs(b.x - u.pos.x) + Math.abs(b.y - u.pos.y) <= 2));
    expect(besideBridge.length).toBeGreaterThanOrEqual(2);
  });
});

describe("El Alamein (18-scenarios-north-africa)", () => {
  const scenario = SCENARIOS.find((s) => s.id === "el-alamein");
  if (!scenario) throw new Error("missing scenario");
  const { map } = scenario.setup;
  const UK = 0;
  const GERMANY = 1;
  const ITALY = 2;
  const start = () => createGame({ ...scenario.setup, seed: 1 });
  const run = (state: GameState, ...commands: Command[]) =>
    commands.reduce((s, c) => {
      const result = apply(s, c);
      if (!result.ok) throw new Error(result.message);
      return result.state;
    }, state);
  const endTurns = (n: number): Command[] => Array.from({ length: n }, () => ({ type: "endTurn" }));
  const units = scenario.setup.units ?? [];
  const [elDaba] = properties(scenario, "hq", GERMANY);
  const [ukHq] = properties(scenario, "hq", UK);
  if (!elDaba || !ukHq) throw new Error("missing places");
  const need = <T,>(value: T | undefined, what: string): T => {
    if (value === undefined) throw new Error(`missing ${what}`);
    return value;
  };
  const at = (x: number, y: number) => (x >= 0 && y >= 0 && x < map.width && y < map.height ? terrainAt(map, P(x, y)) : undefined);

  /** The squares a land unit moving like `type` can reach from `from`, ignoring units; minefields and bunkers optionally blocked. */
  function reachable(from: Point, type: MovementType, blockBunkers: boolean): Set<string> {
    const seen = new Set([`${from.x},${from.y}`]);
    const queue = [from];
    while (queue.length > 0) {
      const p = queue.shift() ?? from;
      for (const [dx, dy] of [[0, 1], [1, 0], [0, -1], [-1, 0]] as const) {
        const t = at(p.x + dx, p.y + dy);
        if (t === undefined || TERRAIN[t].moveCost[type] === null || (blockBunkers && t === "bunker") || seen.has(`${p.x + dx},${p.y + dy}`)) continue;
        seen.add(`${p.x + dx},${p.y + dy}`);
        queue.push(P(p.x + dx, p.y + dy));
      }
    }
    return seen;
  }

  it("the UK moves first, then Germany, then Italy", () => {
    expect(scenario.setup.players.map((p) => p.nation)).toEqual(["uk", "germany", "italy"]);
  });

  it("the computer plays Germany and Italy by default (09-ai §5)", () => {
    expect(defaultComputerPlayers(scenario)).toEqual([GERMANY, ITALY]);
  });

  it("the map is drawn as desert, under clear skies all game", () => {
    expect(scenario.setup.weather?.season).toBe("desert");
    expect(scenario.setup.weather?.forecast.every((f) => f.weather === "clear")).toBe(true);
  });

  it("the Allies win at once by capturing El Daba, and Italy is out with Germany", () => {
    const state = start();
    const taken: GameState = { ...state, properties: state.properties.map((p) => (p.pos.x === elDaba.pos.x && p.pos.y === elDaba.pos.y ? { ...p, owner: UK, capturePoints: 1 } : p)) };
    // An Allied infantry finishes the capture of El Daba.
    const infantry = { ...need(state.units[0], "a unit"), id: 999, type: "infantry" as const, owner: UK, pos: elDaba.pos, hp: 100, moved: false, acted: false };
    const ready: GameState = { ...taken, properties: state.properties.map((p) => (p.pos.x === elDaba.pos.x && p.pos.y === elDaba.pos.y ? { ...p, capturePoints: 1 } : p)), units: [...state.units.filter((u) => u.pos.x !== elDaba.pos.x || u.pos.y !== elDaba.pos.y), infantry] };
    const after = run(ready, { type: "move", unitId: 999, path: [], action: { type: "capture" } });
    expect(after.result?.winningSide).toBe("allies");
    expect(after.players[ITALY]?.defeated).toBe(true);
  });

  it("the Axis wins at the start of day 15", () => {
    const after = run(start(), ...endTurns(14 * 3));
    expect(after.day).toBe(15);
    expect(after.result?.winningSide).toBe("axis");
    expect(after.result?.reason).toBe("surviveDays");
  });

  it("Italy has no HQ, so it plays on if Germany resigns", () => {
    expect(properties(scenario, "hq", ITALY)).toEqual([]);
    const after = run(start(), { type: "endTurn" }, { type: "resign" });
    expect(after.result).toBeNull();
    expect(after.players[GERMANY]?.defeated).toBe(true);
    expect(after.players[ITALY]?.defeated).toBe(false);
  });

  it("two belts of mines run from the sea to the Depression: no land route from the Allied HQ to El Daba avoids every mine and strongpoint", () => {
    expect(reachable(ukHq.pos, "tracks", true).has(`${elDaba.pos.x},${elDaba.pos.y}`)).toBe(false);
    expect(reachable(ukHq.pos, "foot", true).has(`${elDaba.pos.x},${elDaba.pos.y}`)).toBe(false);
  });

  it("the minefields are deep: at least 40 squares of mines", () => {
    expect(map.terrain.filter((t) => t === "minefield").length).toBeGreaterThanOrEqual(40);
  });

  it("no minefield lies on a road: the coast road crosses each belt at a strongpoint instead", () => {
    const roadNext = (x: number, y: number) => [[0, 1], [1, 0], [0, -1], [-1, 0]].filter(([dx = 0, dy = 0]) => at(x + dx, y + dy) === "road").length;
    const roadBunkers = map.terrain.flatMap((t, i) => (t === "bunker" && roadNext(i % map.width, Math.floor(i / map.width)) >= 2 ? [i] : []));
    expect(roadBunkers.length).toBeGreaterThanOrEqual(2);
  });

  it("the Qattara Depression closes the south: no land unit can get round the end of the line", () => {
    const bottom = map.terrain.slice((map.height - 1) * map.width);
    expect(bottom.every((t) => t === "saltMarsh")).toBe(true);
  });

  it("the ridges fought over are on the map, and tanks can cross them", () => {
    expect(map.terrain.filter((t) => t === "ridge").length).toBeGreaterThanOrEqual(10);
    expect(TERRAIN.ridge.moveCost.tracks).not.toBeNull();
  });

  it("every Axis tank starts short of fuel", () => {
    const tanks = units.filter((u) => u.owner !== UK && (u.type === "mediumTank" || u.type === "lightTank"));
    expect(tanks.length).toBeGreaterThanOrEqual(8);
    for (const tank of tanks) expect(tank.fuel ?? UNITS[tank.type].maxFuel, `${tank.type} at ${tank.pos.x},${tank.pos.y}`).toBeLessThanOrEqual(UNITS[tank.type].maxFuel / 2);
  });

  it("Allied tanks start with full tanks", () => {
    expect(units.filter((u) => u.owner === UK).every((u) => u.fuel === undefined)).toBe(true);
  });

  it("the Allies start with about as many properties as both Axis players together, and more units", () => {
    const owned = (owner: number) => (scenario.setup.propertyOwners ?? []).filter((p) => p.owner === owner).length;
    expect(owned(UK)).toBeGreaterThanOrEqual(owned(GERMANY) + owned(ITALY) - 1);
    expect(units.filter((u) => u.owner === UK).length).toBeGreaterThan(units.filter((u) => u.owner !== UK).length * 0.5);
  });

  it("Axis soldiers garrison strongpoints between the belts", () => {
    const garrisoned = units.filter((u) => u.owner !== UK && u.type === "infantry" && at(u.pos.x, u.pos.y) === "bunker");
    expect(garrisoned.length).toBeGreaterThanOrEqual(6);
    expect(new Set(garrisoned.map((u) => u.owner))).toEqual(new Set([GERMANY, ITALY]));
  });

  it("nobody can build a Heavy Tank, Rocket Artillery or a ship (01-units §7a)", () => {
    for (const player of scenario.setup.players) {
      for (const type of ["heavyTank", "rocketArtillery", "destroyer", "landingCraft", "transportAircraft"] as const) {
        expect(player.buildable ?? [], `${player.name} ${type}`).not.toContain(type);
      }
    }
  });

  it("an Italian tank in a German-held town is repaired at Italy's cost (04-economy §5)", () => {
    const state = start();
    const [town] = properties(scenario, "city", GERMANY);
    if (!town) throw new Error("no German town");
    const tank = { ...need(state.units[0], "a unit"), id: 999, type: "mediumTank" as const, owner: ITALY, pos: town.pos, hp: 50, fuel: 5 };
    const placedState: GameState = { ...state, units: [...state.units.filter((u) => u.pos.x !== town.pos.x || u.pos.y !== town.pos.y), tank] };
    const italyFunds = need(placedState.players[ITALY], "Italy").funds;
    const germanyFunds = need(placedState.players[GERMANY], "Germany").funds;
    const after = run(placedState, { type: "endTurn" }, { type: "endTurn" }); // UK, then Germany: Italy's turn starts
    const repaired = after.units.find((u) => u.id === 999);
    expect(repaired?.hp).toBe(70);
    expect(repaired?.fuel).toBe(UNITS.mediumTank.maxFuel);
    // Italy earns 1,000 for each of its 4 properties and pays 20% of the tank's 8,000 for 2 HP.
    expect(need(after.players[ITALY], "Italy").funds).toBe(italyFunds + 4 * 1000 - 1600);
    // Germany earned its income on its own turn and paid nothing for the Italian tank.
    expect(need(after.players[GERMANY], "Germany").funds).toBe(germanyFunds + 5 * 1000);
  });
});

