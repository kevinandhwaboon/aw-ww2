// The map select's world map, theaters, featured battle scenes and terrain sketches (00-master-design §12).

import { describe, expect, it } from "vitest";
import { parseAsciiMap } from "../src/engine/map";
import { SCENARIOS } from "../src/scenarios";
import { shotPlan } from "../src/ui/featurePlan";
import { sketchMap } from "../src/ui/terrainSketch";
import { BATTLE_PLACES, between, project, THEATERS, VIEW_ASPECT, WORLD_VIEW, type BattlePlace } from "../src/ui/theaters";

/** A battle scene's canvas size (08-art-pipeline §18). */
const SCENE = { width: 384, height: 240 };

const placeOf = (id: string): BattlePlace => {
  const place = BATTLE_PLACES[id];
  if (!place) throw new Error(`no place for ${id}`);
  return place;
};

describe("world map and theaters (00-master-design §12)", () => {
  it("every built-in map has a place on the world map, filed under a theater", () => {
    for (const scenario of SCENARIOS) expect(THEATERS[placeOf(scenario.id).theater], scenario.id).toBeDefined();
  });

  it("every battle's dot shows inside its theater's view, and on the whole-world view", () => {
    for (const scenario of SCENARIOS) {
      const place = placeOf(scenario.id);
      for (const view of [THEATERS[place.theater].view, WORLD_VIEW]) {
        const { x, y } = project(view, place.lon, place.lat);
        expect(x, scenario.id).toBeGreaterThan(0.03);
        expect(x, scenario.id).toBeLessThan(0.97);
        expect(y, scenario.id).toBeGreaterThan(0.03);
        expect(y, scenario.id).toBeLessThan(0.97);
      }
    }
  });

  it("Midway, across the date line, sits east of Iwo Jima on the Pacific view rather than wrapping to the far west", () => {
    const pacific = THEATERS.pacific.view;
    expect(project(pacific, placeOf("midway").lon, placeOf("midway").lat).x).toBeGreaterThan(project(pacific, placeOf("iwo-jima").lon, placeOf("iwo-jima").lat).x);
  });

  it("the camera's flight between two views starts on the first and ends on the second, keeping the map's shape", () => {
    const from = THEATERS.westernEurope.view;
    const to = THEATERS.pacific.view;
    expect(between(from, to, 0)).toEqual(expect.objectContaining({ west: from.west, width: from.width }));
    const end = between(from, to, 1);
    expect(end.west).toBeCloseTo(to.west);
    expect(end.north).toBeCloseTo(to.north);
    expect(end.width).toBeCloseTo(to.width);
    const middle = between(from, to, 0.5);
    expect(middle.width).toBeGreaterThan(from.width);
    expect(middle.width).toBeLessThan(to.width);
    expect(VIEW_ASPECT).toBe(2.4);
  });
});

describe("featured battle scene", () => {
  it("each map's featured unit is from a nation that plays on that map", () => {
    for (const scenario of SCENARIOS) {
      const { shot } = placeOf(scenario.id);
      const nations = scenario.setup.players.map((p) => p.nation);
      const shown = shot.kind === "drop" ? [shot.nation] : [shot.attacker.nation, shot.defender.nation].filter((n) => n !== null);
      for (const nation of shown) expect(nations, scenario.id).toContain(nation);
    }
  });

  it("each crop stays inside the battle scene and has the letterbox shape", () => {
    for (const scenario of SCENARIOS) {
      const [x, y, w, h] = placeOf(scenario.id).shot.crop;
      expect(x >= 0 && y >= 0 && x + w <= SCENE.width && y + h <= SCENE.height, scenario.id).toBe(true);
      expect(w / h, scenario.id).toBeCloseTo(VIEW_ASPECT, 1);
    }
  });

  it("the featured figures wear the colors of the player who plays their nation on that map", () => {
    const kursk = SCENARIOS.find((s) => s.id === "kursk");
    const { shot } = placeOf("kursk");
    if (!kursk || shot.kind !== "battle") throw new Error("Kursk should feature a battle");
    const plan = shotPlan(kursk, shot);
    expect(plan.left.owner).toBe(0); // the Soviet Union is Kursk's first player
    expect(plan.right.owner).toBe(1);
    expect(plan.strikes.map((s) => s.from)).toEqual(["left", "right"]);
  });
});

describe("terrain sketch", () => {
  const sketch = (rows: string[], cells: number) => sketchMap(parseAsciiMap(rows), cells);

  it("covers the whole map, one cell per block of squares", () => {
    const s = sketch(["......", "......", "......", "......"], 3);
    expect(s.cellSize).toBe(2);
    expect([s.columns, s.rows]).toEqual([3, 2]);
    expect(s.cells).toHaveLength(6);
  });

  it("a block that's half sea or more is sea; less than half is land", () => {
    expect(sketch(["SS", ".."], 1).cells).toEqual(["sea"]);
    expect(sketch(["S.", ".."], 1).cells).toEqual(["land"]);
  });

  it("a river crossing a block keeps it a river, so rivers stay unbroken lines", () => {
    expect(sketch(["....", "....", "~~~~", "...."], 1).cells).toEqual(["river"]);
  });

  it("a narrow channel of water between two banks, like the Volga, stays water; a strip of coast doesn't", () => {
    expect(sketch(["..S.", "..S.", ".S..", ".S.."], 1).cells).toEqual(["sea"]);
    expect(sketch(["...S", "...S", "...S", "...S"], 1).cells).toEqual(["land"]);
  });

  it("forest or hills covering two fifths of a block make it forest or hills", () => {
    expect(sketch(["FF..", "FF..", "....", "...."], 1).cells).toEqual(["land"]);
    expect(sketch(["FFFF", "FFF.", "....", "...."], 1).cells).toEqual(["forest"]);
    expect(sketch(["HHHH", "HHH.", "....", "...."], 1).cells).toEqual(["hills"]);
  });

  it("roads and towns are just land at this scale", () => {
    expect(sketch(["==", "CC"], 1).cells).toEqual(["land"]);
  });

  it("Midway's sketch is open ocean and Normandy's shows the Channel, the Seine and the bocage", () => {
    const of = (id: string) => {
      const scenario = SCENARIOS.find((s) => s.id === id);
      if (!scenario) throw new Error(id);
      return sketchMap(scenario.setup.map).cells;
    };
    const midway = of("midway");
    expect(midway.filter((c) => c === "sea").length / midway.length).toBeGreaterThan(0.85);
    const normandy = of("normandy");
    for (const feature of ["sea", "land", "river", "forest"] as const) expect(normandy).toContain(feature);
  });
});
