import { describe, expect, it } from "vitest";
import { parseAsciiMap, terrainAt } from "../src/engine/map";
import { TERRAIN, TERRAIN_IDS } from "../src/engine/data/terrain";

describe("ASCII maps", () => {
  it("parses rows into a row-major terrain grid", () => {
    const map = parseAsciiMap(["..F", "=~H"]);
    expect(map.width).toBe(3);
    expect(map.height).toBe(2);
    expect(terrainAt(map, { x: 2, y: 0 })).toBe("forest");
    expect(terrainAt(map, { x: 1, y: 1 })).toBe("river");
  });

  it("ignores spaces so maps can be aligned for readability", () => {
    expect(parseAsciiMap([". . F"]).width).toBe(3);
  });

  it("rejects rows of different lengths", () => {
    expect(() => parseAsciiMap(["...", ".."])).toThrow(/Row 1/);
  });

  it("rejects unknown characters", () => {
    expect(() => parseAsciiMap([".?."])).toThrow(/Unknown map character/);
  });

  it("rejects points outside the map", () => {
    expect(() => terrainAt(parseAsciiMap(["."]), { x: 1, y: 0 })).toThrow(/outside/);
  });
});

describe("terrain data (02-terrain)", () => {
  it("wheeled units cannot enter bocage, tracks pay 3 (02-terrain §3)", () => {
    expect(TERRAIN.bocage.moveCost.wheels).toBeNull();
    expect(TERRAIN.bocage.moveCost.tracks).toBe(3);
  });

  it("only heavy foot crosses hills and rivers at cost 1 (02-terrain §3)", () => {
    expect(TERRAIN.hills.moveCost.heavyFoot).toBe(1);
    expect(TERRAIN.hills.moveCost.foot).toBe(2);
    expect(TERRAIN.river.moveCost.tracks).toBeNull();
  });

  it("bunker breaks into rubble and obstacle into plains, both at 100 HP (02-terrain §4)", () => {
    expect(TERRAIN.bunker.breakable).toEqual({ hp: 100, becomes: "rubble" });
    expect(TERRAIN.obstacle.breakable).toEqual({ hp: 100, becomes: "plains" });
  });

  it("every terrain is passable by air (02-terrain §3–4)", () => {
    for (const id of TERRAIN_IDS) expect(TERRAIN[id].moveCost.air).toBe(1);
  });
});
