import { describe, expect, it } from "vitest";
import { TERRAIN } from "../src/engine/data/terrain";
import { UNITS } from "../src/engine/data/units";
import {
  activePack,
  BUILT_IN_PACK,
  findPropertyArt,
  findUnitArt,
  packColor,
  packColorNumber,
  parseArtPack,
  setActivePack,
  terrainName,
  unitName,
} from "../src/game/artPack";
import defaultPack from "../public/assets/packs/default/pack.json";
import nightOps from "../public/assets/packs/night-ops/pack.json";

const sheet = (extra: object = {}) => ({
  nation: "us",
  team: "blue",
  path: "units.png",
  frames: 2,
  rows: ["infantry", null, "mediumTank"],
  ...extra,
});

describe("art pack files (08-art-pipeline §13)", () => {
  it("a pack only needs a name; everything else falls back to the built-in look", () => {
    expect(parseArtPack({ name: "Empty" })).toEqual({ ...BUILT_IN_PACK, name: "Empty" });
  });

  it("colors can be partly replaced, keeping the rest", () => {
    const pack = parseArtPack({ name: "x", colors: { rangeMove: "#112233" } });
    expect(pack.colors.rangeMove).toBe("#112233");
    expect(pack.colors.pathFill).toBe(BUILT_IN_PACK.colors.pathFill);
  });

  it("reads players, unit sheets, terrain and names", () => {
    const pack = parseArtPack({
      name: "Full",
      players: [{ team: "green", fill: "#00ff00", outline: "#003300" }],
      unitSheets: [sheet()],
      terrain: { path: "terrain.png", tiles: { plains: 0, sea: 3 } },
      unitNames: { mediumTank: "Sherman" },
      terrainNames: { bocage: "Hedgerows" },
    });
    expect(pack.players).toHaveLength(1);
    expect(pack.unitSheets[0]?.rows).toEqual(["infantry", null, "mediumTank"]);
    expect(pack.terrain?.tiles).toEqual({ plains: [0], sea: [3] });
    expect(pack.unitNames.mediumTank).toBe("Sherman");
    expect(pack.terrainNames.bocage).toBe("Hedgerows");
  });

  it("reads terrain variants, joined pieces, bridges, shore and animation frames (08-art-pipeline §13)", () => {
    const pack = parseArtPack({
      name: "x",
      terrain: {
        path: "t.png",
        frames: 2,
        tiles: { plains: [0, 1, 2], sea: 9 },
        connected: { road: 16, river: 32 },
        bridges: { horizontal: 48, vertical: 49 },
        shore: 50,
      },
    });
    expect(pack.terrain).toEqual({
      path: "t.png",
      frames: 2,
      tileHeight: 16,
      tiles: { plains: [0, 1, 2], sea: [9] },
      connected: { road: 16, river: 32 },
      bridges: { horizontal: 48, vertical: 49 },
      shore: 50,
    });
  });

  it.each([
    ["a bad color", { colors: { cursor: "red" } }, /must look like/],
    ["an unknown color", { colors: { sparkle: "#ffffff" } }, /unknown color/],
    ["a player with no colors", { players: [{ team: "blue" }] }, /fill and outline/],
    ["no players", { players: [] }, /must be a list/],
    ["an unknown nation", { unitSheets: [sheet({ nation: "atlantis" })] }, /unknown nation/],
    ["an unknown unit", { unitSheets: [sheet({ rows: ["dragon"] })] }, /unknown unit type/],
    ["zero frames", { unitSheets: [sheet({ frames: 0 })] }, /whole number/],
    ["a frame size other than 16 or 32", { unitSheets: [sheet({ frameSize: 24 })] }, /16 or 32/],
    ["paratrooper rows that aren't row numbers", { unitSheets: [sheet({ paratroopers: ["spade"] })] }, /row numbers/],
    ["an unknown terrain", { terrain: { path: "t.png", tiles: { lava: 0 } } }, /unknown terrain/],
    ["an empty variant list", { terrain: { path: "t.png", tiles: { plains: [] } } }, /list of them/],
    ["a connected terrain that can't join", { terrain: { path: "t.png", tiles: {}, connected: { forest: 0 } } }, /only road and river/],
    ["a bridge without both directions", { terrain: { path: "t.png", tiles: {}, bridges: { horizontal: 1 } } }, /horizontal and vertical/],
    ["zero terrain frames", { terrain: { path: "t.png", tiles: {}, frames: 0 } }, /whole number/],
    ["a tile height that isn't 16 or 32", { terrain: { path: "t.png", tiles: {}, tileHeight: 24 } }, /16 or 32/],
    ["an unknown unit name", { unitNames: { dragon: "Puff" } }, /unknown id/],
    ["an empty name", { unitNames: { infantry: "" } }, /must be text/],
  ])("rejects %s", (_, change, message) => {
    expect(() => parseArtPack({ name: "x", ...change })).toThrow(message);
  });

  it.each([
    ["a web address", "https://example.com/units.png"],
    ["another scheme", "data:image/png;base64,AAAA"],
    ["an absolute path", "/etc/units.png"],
  ])("won't load art from %s", (_, path) => {
    expect(() => parseArtPack({ name: "x", unitSheets: [sheet({ path })] })).toThrow(/file in the pack/);
  });

  it("rejects things that aren't packs at all", () => {
    expect(() => parseArtPack({})).toThrow(/needs a "name"/);
    expect(() => parseArtPack(null)).toThrow(/must be an object/);
  });
});

describe("the packs that ship with the game", () => {
  it("both parse", () => {
    expect(parseArtPack(defaultPack).name).toBe("Default");
    expect(parseArtPack(nightOps).name).toBe("Night Ops");
  });

  it("the default pack's rows match the land sheet layout (08-art-pipeline §12)", () => {
    expect(parseArtPack(defaultPack).unitSheets[0]?.rows).toEqual([
      "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank",
      null, // the US has no Heavy Tank
      "tankDestroyer", "artillery", "rocketArtillery", "mobileAA", "flakGun",
    ]);
  });

  it("the shipped packs use the 32-pixel unit sheets, with paratroopers on the US ones (08-art-pipeline §17)", () => {
    for (const raw of [defaultPack, nightOps]) {
      for (const unitSheet of parseArtPack(raw).unitSheets) {
        expect(unitSheet.frameSize).toBe(32);
        expect(unitSheet.path).toContain("-32-");
        expect(unitSheet.paratroopers).toEqual(unitSheet.nation === "us" ? [13, 14, 15, 16] : []);
      }
    }
  });
});

describe("finding a unit's art", () => {
  const pack = parseArtPack({
    name: "x",
    players: [
      { team: "blue", fill: "#000000", outline: "#000000" },
      { team: "red", fill: "#000000", outline: "#000000" },
    ],
    unitSheets: [sheet(), sheet({ team: "red", path: "red.png" })],
  });

  it("picks the sheet for the unit's nation and its player's team", () => {
    expect(findUnitArt(pack, "us", 0, "mediumTank")).toEqual({ sheet: 0, row: 2, frames: 2, frameSize: 16 });
    expect(findUnitArt(pack, "us", 1, "infantry")).toEqual({ sheet: 1, row: 0, frames: 2, frameSize: 16 });
  });

  it("an air-dropped Infantry is drawn as a paratrooper, its suit picked by unit id (08-art-pipeline §17)", () => {
    const airborne = parseArtPack({ name: "x", unitSheets: [sheet({ paratroopers: [5, 6, 7, 8] })] });
    expect(findUnitArt(airborne, "us", 0, "infantry", { id: 9, airDropped: true })?.row).toBe(6);
    expect(findUnitArt(airborne, "us", 0, "infantry", { id: 12, airDropped: true })?.row).toBe(5);
  });

  it("Infantry that wasn't air-dropped, or a sheet without paratroopers, keeps the normal Infantry look", () => {
    const airborne = parseArtPack({ name: "x", unitSheets: [sheet({ paratroopers: [5, 6, 7, 8] })] });
    expect(findUnitArt(airborne, "us", 0, "infantry", { id: 9 })?.row).toBe(0);
    expect(findUnitArt(pack, "us", 0, "infantry", { id: 9, airDropped: true })?.row).toBe(0);
  });

  it("a different nation gets no art, so German units don't use American sprites", () => {
    expect(findUnitArt(pack, "germany", 0, "mediumTank")).toBeNull();
  });

  it("a unit with no row, or an empty row, gets no art", () => {
    expect(findUnitArt(pack, "us", 0, "fighter")).toBeNull();
    expect(findUnitArt(pack, "us", 0, "heavyTank")).toBeNull();
  });

  it("the built-in pack has no art for anything", () => {
    expect(findUnitArt(BUILT_IN_PACK, "us", 0, "infantry")).toBeNull();
  });
});

describe("the active pack", () => {
  const withPack = (raw: object, check: () => void) => {
    const before = activePack();
    setActivePack(parseArtPack(raw));
    try {
      check();
    } finally {
      setActivePack(before);
    }
  };

  it("pack names replace unit and terrain names, and the rest keep the rules' names", () => {
    withPack({ name: "x", unitNames: { mediumTank: "Sherman" }, terrainNames: { bocage: "Hedgerows" } }, () => {
      expect(unitName("mediumTank")).toBe("Sherman");
      expect(unitName("infantry")).toBe(UNITS.infantry.name);
      expect(terrainName("bocage")).toBe("Hedgerows");
      expect(terrainName("plains")).toBe(TERRAIN.plains.name);
    });
  });

  it("pack names change only what's shown, never the rules", () => {
    withPack({ name: "x", unitNames: { mediumTank: "Sherman" } }, () => {
      expect(UNITS.mediumTank.name).toBe("Medium Tank");
    });
  });

  it("colors are available as text and as numbers", () => {
    withPack({ name: "x", colors: { blast: "#112233" } }, () => {
      expect(packColor("blast")).toBe("#112233");
      expect(packColorNumber("blast")).toBe(0x112233);
    });
  });
});

describe("art packs: buildings (08-art-pipeline §15)", () => {
  const properties = { path: "b.png", columns: ["neutral", "blue", "red"], rows: ["city", "factory", "hq"] };
  const pack = parseArtPack({
    name: "x",
    players: [
      { team: "blue", fill: "#3a6fd8", outline: "#1a3270" },
      { team: "red", fill: "#c8463a", outline: "#5e1a14" },
      { team: "purple", fill: "#8040c0", outline: "#301050" },
    ],
    properties,
  });

  it("tiles are 16 tall unless a sheet says 32, for art that rises into the tile behind (08-art-pipeline §16)", () => {
    expect(pack.properties?.tileHeight).toBe(16);
    expect(parseArtPack({ name: "x", properties: { ...properties, tileHeight: 32 } }).properties?.tileHeight).toBe(32);
  });

  it("an unowned property uses the neutral column", () => {
    expect(findPropertyArt(pack, "factory", null)).toBe(3 + 0);
  });

  it("an owned property uses its owner's team column", () => {
    expect(findPropertyArt(pack, "hq", 1)).toBe(6 + 2);
  });

  it("an owner whose team has no column keeps the placeholder and flag", () => {
    expect(findPropertyArt(pack, "city", 2)).toBeNull();
  });

  it("a property the sheet doesn't draw keeps the placeholder", () => {
    expect(findPropertyArt(pack, "airfield", 0)).toBeNull();
  });

  it("a pack with no buildings keeps every placeholder", () => {
    expect(findPropertyArt(parseArtPack({ name: "x" }), "city", 0)).toBeNull();
  });

  it.each([
    ["a row that isn't a property", { ...properties, rows: ["forest"] }, /isn't a property/],
    ["no columns", { ...properties, columns: [] }, /owner names/],
  ])("rejects %s", (_, change, message) => {
    expect(() => parseArtPack({ name: "x", properties: change })).toThrow(message);
  });
});
