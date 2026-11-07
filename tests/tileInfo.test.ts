import { describe, expect, it } from "vitest";
import type { Point } from "../src/engine/map";
import { tileInfo } from "../src/game/tileInfo";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });

describe("tile info box (00-master-design §12)", () => {
  it("names the terrain and its defense, with no unit on an empty tile", () => {
    const state = makeGame(["f."]);
    const info = tileInfo(state, P(1, 0));
    expect(info.unit).toBeNull();
    expect(info.terrain).toBe("Plains");
    expect(tileInfo(state, P(0, 0)).stars).toBeGreaterThanOrEqual(0);
  });

  it("names the unit on the tile and who owns it", () => {
    const state = makeGame(["."], [{ type: "infantry", owner: 1, pos: P(0, 0) }]);
    expect(tileInfo(state, P(0, 0)).unit).toEqual({ name: "Infantry", owner: 1 });
  });

  it("says when a submarine is submerged (05-supply-transport §9)", () => {
    const state = makeGame(["S"], [{ type: "submarine", owner: 0, pos: P(0, 0) }]);
    expect(tileInfo(state, P(0, 0)).unit?.name).toBe("Submarine");
    const dived = { ...state, units: state.units.map((u) => ({ ...u, submerged: true })) };
    expect(tileInfo(dived, P(0, 0)).unit?.name).toBe("Submarine (submerged)");
  });

  it("shows the terrain's defense stars (02-terrain §1)", () => {
    expect(tileInfo(makeGame(["F"]), P(0, 0)).stars).toBe(2);
  });

  it("an aircraft gets no defense from terrain (02-terrain §1)", () => {
    const state = makeGame(["F"], [{ type: "fighter", owner: 0, pos: P(0, 0) }]);
    expect(tileInfo(state, P(0, 0))).toMatchObject({ stars: 0 });
  });
});
