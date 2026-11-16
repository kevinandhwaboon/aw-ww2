import { describe, expect, it } from "vitest";
import { parseAsciiMap } from "../src/engine/map";
import type { TerrainSheet } from "../src/game/artPack";
import { beachCorners, beachWaterMask, bridgeRunsAcross, joinMask, portOpening, shorePieces, terrainLayers, variantFor } from "../src/game/terrainTiles";

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

describe("terrain tiles: Major and Blown Bridges (02-terrain §4a, 08-art-pipeline §14)", () => {
  const withMajor: TerrainSheet = { ...sheet, majorBridges: { horizontal: 78, vertical: 79 }, blownBridges: { horizontal: 80, vertical: 81 } };
  const across = (bridge: string) => parseAsciiMap([".~.", `=${bridge}=`, ".~."]);

  it("a Major Bridge draws its steel deck over the river, and joins the road and river like a bridge", () => {
    expect(terrainLayers(across("%"), 1, 1, withMajor)).toEqual([
      { kind: "sheet", tile: 32 + (N | S) },
      { kind: "sheet", tile: 78 },
    ]);
    expect(joinMask(parseAsciiMap(["..~", ".=%", "..~"]), 1, 1, ["road", "majorBridge"])).toBe(E);
  });

  it("a Blown Bridge draws its wreck over the river piece", () => {
    expect(terrainLayers(across("!"), 1, 1, withMajor)).toEqual([
      { kind: "sheet", tile: 32 + (N | S) },
      { kind: "sheet", tile: 80 },
    ]);
  });

  it("a pack without them draws a Major Bridge as a plain bridge and a Blown Bridge as river", () => {
    expect(terrainLayers(across("%"), 1, 1, sheet)).toEqual([
      { kind: "sheet", tile: 32 + (N | S) },
      { kind: "sheet", tile: 48 },
    ]);
    expect(terrainLayers(across("!"), 1, 1, sheet)).toEqual([{ kind: "sheet", tile: 32 + (N | S) }]);
  });

  it("a river flows under a Major Bridge and past a Blown Bridge", () => {
    const map = parseAsciiMap(["~", "%", "~", "!", "~"]);
    expect(terrainLayers(map, 0, 2, withMajor)[0]).toEqual({ kind: "sheet", tile: 32 + (N | S) });
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

describe("terrain tiles: beaches run down into the sea (08-art-pipeline §14)", () => {
  const withBeaches: TerrainSheet = { ...sheet, tiles: { ...sheet.tiles, beach: [11, 12] }, beach: 58 };

  it("each side of a beach that faces open sea is drawn as water", () => {
    const map = parseAsciiMap([
      "SSS",
      "._S",
      "...",
    ]);
    expect(beachWaterMask(map, 1, 1)).toBe(N | E);
    expect(terrainLayers(map, 1, 1, withBeaches)).toEqual([{ kind: "sheet", tile: 58 + (N | E) }]);
  });

  it("rivers, ports and land beside a beach stay sand", () => {
    const map = parseAsciiMap([
      ".~.",
      "P__",
      "...",
    ]);
    expect(beachWaterMask(map, 1, 1)).toBe(0);
  });

  it("a beach with no sea beside it is all sand, in its usual variants", () => {
    const map = parseAsciiMap([
      "...",
      "._.",
      "...",
    ]);
    const [layer] = terrainLayers(map, 1, 1, withBeaches);
    expect([{ kind: "sheet", tile: 11 }, { kind: "sheet", tile: 12 }]).toContainEqual(layer);
  });

  it("sea touching only a corner rounds into the sand there, carrying on the beaches' waterline", () => {
    const map = parseAsciiMap([
      "__S",
      "__.",
    ]);
    // The beach at the bottom left of the corner: sea only to its north-east, beaches north and east.
    expect(beachCorners(map, 1, 1)).toEqual([0]);
    expect(terrainLayers(map, 1, 1, withBeaches)).toContainEqual({ kind: "sheet", tile: 58 + 16 });
  });

  it("no corner rounds in where only land is beside it", () => {
    const map = parseAsciiMap([
      "..S",
      "._.",
    ]);
    expect(beachCorners(map, 1, 1)).toEqual([]);
  });

  it("sea makes no foam against a beach drawn half sea, so it never looks walled off", () => {
    const map = parseAsciiMap([
      "S_",
      "SS",
    ]);
    expect(shorePieces(map, 0, 0, true)).toEqual([]);
    expect(terrainLayers(map, 0, 0, withBeaches)).toEqual([{ kind: "sheet", tile: 9 }]);
  });

  it("a pack without half-sea beaches keeps the foam against them", () => {
    const map = parseAsciiMap([
      "S_",
    ]);
    expect(shorePieces(map, 0, 0)).toEqual([1]);
  });
});

describe("terrain tiles: ports open onto the sea (08-art-pipeline §15)", () => {
  it("sea makes no foam against a port, whose harbor runs straight into it", () => {
    const map = parseAsciiMap([
      "SP",
      "SS",
    ]);
    expect(shorePieces(map, 0, 0)).toEqual([]);
    expect(shorePieces(map, 1, 1)).toEqual([]);
  });

  it("a port's harbor opens to the side facing open sea", () => {
    const map = parseAsciiMap([
      "...",
      ".PS",
      "...",
    ]);
    expect(portOpening(map, 1, 1)).toBe("E");
  });

  it("with sea on several sides, the harbor opens to the side with the most sea around it", () => {
    const map = parseAsciiMap([
      ".S..",
      ".P..",
      "SSSS",
      "SSSS",
    ]);
    expect(portOpening(map, 1, 1)).toBe("S");
    const north = parseAsciiMap([
      "SSSS",
      "SSSS",
      ".P..",
      ".S..",
    ]);
    expect(portOpening(north, 1, 2)).toBe("N");
  });

  it("a port with no open sea beside it opens south, the way it's usually drawn", () => {
    const map = parseAsciiMap([
      ".~.",
      ".P.",
      "...",
    ]);
    expect(portOpening(map, 1, 1)).toBe("S");
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
