import { describe, expect, it } from "vitest";
import type { Point } from "../src/engine/map";
import type { UnitSetup } from "../src/engine/setup";
import { findPropertyArt, parseArtPack } from "../src/game/artPack";
import { garrisonedBunkers } from "../src/game/garrison";
import defaultPack from "../public/assets/packs/default/pack.json";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });

describe("garrisoned bunkers (08-art-pipeline §15)", () => {
  it("Infantry, Assault Infantry and Mortar Teams in a bunker garrison it for their side", () => {
    const units: UnitSetup[] = [
      { type: "infantry", owner: 0, pos: P(0, 0) },
      { type: "assaultInfantry", owner: 1, pos: P(1, 0) },
      { type: "mortar", owner: 0, pos: P(2, 0) },
    ];
    expect(garrisonedBunkers(makeGame(["XXX"], units))).toEqual(new Map([[0, 0], [1, 1], [2, 0]]));
  });

  it("a vehicle in a bunker, or Infantry outside one, doesn't", () => {
    const units: UnitSetup[] = [
      { type: "mediumTank", owner: 0, pos: P(0, 0) },
      { type: "infantry", owner: 0, pos: P(1, 0) },
    ];
    expect(garrisonedBunkers(makeGame(["X."], units)).size).toBe(0);
  });

  it("the default art pack draws a garrisoned bunker in every team's colors", () => {
    const pack = parseArtPack(defaultPack);
    for (const owner of pack.players.keys()) expect(findPropertyArt(pack, "bunker", owner), `player ${owner}`).not.toBeNull();
  });
});
