import { describe, expect, it } from "vitest";
import { parseAsciiMap } from "../src/engine/map";
import type { TerrainSheet } from "../src/game/artPack";
import { bridgeRunsAcross, joinMask, shorePieces, terrainLayers, variantFor } from "../src/game/terrainTiles";

const N = 1, E = 2, S = 4, W = 8;
const ROAD = ["road", "bridge"] as const;
const RIVER = ["river", "bridge", "sea", "reef"] as const;

const sheet: TerrainSheet = {
  path: "terrain.png",
  frames: 2,
  tileWidth: 16,
  tileHeight: 32,
  tiles: { plains: [0, 1, 2], forest: [3, 4], sea: [9], reef: [10] },
  connected: { road: 16, river: 32 },
  bridges: { horizontal: 48, vertical: 49 },
  shore: 50,
};

describe("terrain tiles: roads and rivers join their neighbors (08-art-pipeline §14)", () => {
  it("a road joins roads and bridges on each side", () => {
    const map = parseAsciiMap([
      ".=.",
      "===",
      ".#.",
    ]);
    expect(joinMask(map, 1, 1, ROAD)).toBe(N | E | S | W);
  });

  it("a road ignores terrain it can't join, like forest or a city", () => {
    const map = parseAsciiMap([
      "F=C",
    ]);
    expect(joinMask(map, 1, 0, ROAD)).toBe(0);
  });

  it("a road at the map's edge runs straight on past the border", () => {
    const map = parseAsciiMap([
      ".=.",
      ".=.",
    ]);
    expect(joinMask(map, 1, 0, ROAD)).toBe(N | S);
    expect(joinMask(map, 1, 1, ROAD)).toBe(N | S);
  });

  it("a road turning a corner at the map's edge keeps its turn", () => {
    const map = parseAsciiMap([
      "==",
      ".=",
    ]);
    expect(joinMask(map, 1, 0, ROAD)).toBe(S | W);
  });

  it("a road along the map's edge doesn't turn off the map", () => {
    const map = parseAsciiMap([
      "===",
      "...",
    ]);
    expect(joinMask(map, 1, 0, ROAD)).toBe(E | W);
  });

  it("a river flows into the sea and under bridges", () => {
    const map = parseAsciiMap([
      ".~.",
      ".#.",
      ".~.",
      "SSS",
    ]);
    expect(joinMask(map, 1, 2, RIVER)).toBe(N | S);
  });

  it("a road picks the joined piece for its neighbors", () => {
    const map = parseAsciiMap([
      "...",
      "==.",
      ".=.",
      "...",
    ]);
    expect(terrainLayers(map, 1, 1, sheet)).toEqual([{ kind: "sheet", tile: 16 + (S | W) }]);
  });
});

describe("terrain tiles: bridges (08-art-pipeline §14)", () => {
  it("a bridge with water above and below runs left to right", () => {
    const map = parseAsciiMap([
      ".~.",
      "=#=",
      ".~.",
    ]);
    expect(bridgeRunsAcross(map, 1, 1)).toBe(true);
  });

  it("a bridge with water left and right runs top to bottom", () => {
    const map = parseAsciiMap([
      ".=.",
      "~#~",
      ".=.",
    ]);
    expect(bridgeRunsAcross(map, 1, 1)).toBe(false);
  });

  it("a bridge draws its deck over the river piece beneath it", () => {
    const map = parseAsciiMap([
      ".~.",
      "=#=",
      ".~.",
    ]);
    expect(terrainLayers(map, 1, 1, sheet)).toEqual([
      { kind: "sheet", tile: 32 + (N | S) },
      { kind: "sheet", tile: 48 },
    ]);
  });
});

describe("terrain tiles: shoreline (08-art-pipeline §14)", () => {
  it("sea next to land gets foam on each side that touches land", () => {
    const map = parseAsciiMap([
      ".S.",
      "SSS",
      "SSS",
    ]);
    // Land to the west and east of the top-middle sea cell.
    expect(shorePieces(map, 1, 0)).toEqual([1, 3]);
  });

  it("a corner of foam shows where land touches only diagonally", () => {
    const map = parseAsciiMap([
      "SS.",
      "SSS",
      "SSS",
    ]);
    // The centre cell has land only to its north-east.
    expect(shorePieces(map, 1, 1)).toEqual([4]);
  });

  it("no corner shows where a side piece already covers that corner", () => {
    const map = parseAsciiMap([
      "S..",
      "SSS",
    ]);
    // Land north and north-east of the bottom-middle cell: the north edge covers the corner.
    expect(shorePieces(map, 1, 1)).toEqual([0]);
  });

  it("rivers, bridges, reefs and the map's edge never make foam", () => {
    const map = parseAsciiMap([
      "~#r",
      "SSS",
    ]);
    expect(shorePieces(map, 1, 1)).toEqual([]);
    expect(shorePieces(map, 0, 1)).toEqual([]);
  });

  it("sea draws its water tile, then the foam pieces on top", () => {
    const map = parseAsciiMap([
      "S.",
    ]);
    expect(terrainLayers(map, 0, 0, sheet)).toEqual([
      { kind: "sheet", tile: 9 },
      { kind: "sheet", tile: 50 + 1 },
    ]);
  });
});

describe("terrain tiles: variants and fallbacks (08-art-pipeline §14)", () => {
  it("a cell always picks the same variant", () => {
    expect(variantFor(7, 3, 3)).toBe(variantFor(7, 3, 3));
  });

  it("variants spread across a field instead of repeating one tile", () => {
    const picks = new Set<number>();
    for (let x = 0; x < 6; x++) for (let y = 0; y < 6; y++) picks.add(variantFor(x, y, 3));
    expect([...picks].sort()).toEqual([0, 1, 2]);
  });

  it("terrain the sheet doesn't cover keeps its placeholder", () => {
    const map = parseAsciiMap(["C"]);
    expect(terrainLayers(map, 0, 0, sheet)).toEqual([{ kind: "placeholder", terrain: "city" }]);
  });

  it("with no terrain sheet, every cell keeps its placeholder", () => {
    const map = parseAsciiMap(["=S"]);
    expect(terrainLayers(map, 0, 0, null)).toEqual([{ kind: "placeholder", terrain: "road" }]);
    expect(terrainLayers(map, 1, 0, null)).toEqual([{ kind: "placeholder", terrain: "sea" }]);
  });

  it("a pack with one tile per terrain still works, with no joined pieces", () => {
    const simple: TerrainSheet = { path: "t.png", frames: 1, tileWidth: 16, tileHeight: 16, tiles: { road: [1] }, connected: {}, bridges: null };
    const map = parseAsciiMap(["=="]);
    expect(terrainLayers(map, 0, 0, simple)).toEqual([{ kind: "sheet", tile: 1 }]);
  });
});
