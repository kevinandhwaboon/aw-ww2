import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
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
    expect(tileInfo(state, P(0, 0)).unit).toEqual({ name: "Infantry", owner: 1, cargo: null });
  });

  it("says when a submarine is submerged (05-supply-transport §9)", () => {
    const state = makeGame(["S"], [{ type: "submarine", owner: 0, pos: P(0, 0) }]);
    expect(tileInfo(state, P(0, 0)).unit?.name).toBe("Submarine");
    const dived = { ...state, units: state.units.map((u) => ({ ...u, submerged: true })) };
    expect(tileInfo(dived, P(0, 0)).unit?.name).toBe("Submarine (submerged)");
  });

  it("a transport lists the units aboard (05-supply-transport §8)", () => {
    const state = makeGame(["._."], [
      { type: "landingCraft", owner: 0, pos: P(1, 0) },
      { type: "infantry", owner: 0, pos: P(0, 0) },
      { type: "mediumTank", owner: 0, pos: P(2, 0) },
    ]);
    expect(tileInfo(state, P(1, 0)).unit?.cargo).toEqual([]);
    const board = (s: typeof state, unitId: number) => {
      const result = apply(s, { type: "move", unitId, path: [P(1, 0)], action: { type: "load" } });
      if (!result.ok) throw new Error(result.message);
      return result.state;
    };
    expect(tileInfo(board(board(state, 1), 2), P(1, 0)).unit?.cargo).toEqual(["Infantry", "Medium Tank"]);
  });

  it("a unit that isn't a transport has no cargo line", () => {
    const state = makeGame(["."], [{ type: "mediumTank", owner: 0, pos: P(0, 0) }]);
    expect(tileInfo(state, P(0, 0)).unit?.cargo).toBeNull();
  });

  it("a property shows the capture points it has left out of 20 (04-economy §3)", () => {
    const state = makeGame(["C."], [{ type: "infantry", owner: 0, pos: P(1, 0) }]);
    expect(tileInfo(state, P(0, 0)).capture).toEqual({ left: 20, total: 20 });
    const result = apply(state, { type: "move", unitId: 0, path: [P(0, 0)], action: { type: "capture" } });
    if (!result.ok) throw new Error(result.message);
    expect(tileInfo(result.state, P(0, 0)).capture).toEqual({ left: 10, total: 20 }); // full-strength Infantry takes 10
  });

  it("terrain that isn't a property has no capture points", () => {
    expect(tileInfo(makeGame(["F"]), P(0, 0)).capture).toBeNull();
  });

  it("shows the terrain's defense stars (02-terrain §1)", () => {
    expect(tileInfo(makeGame(["F"]), P(0, 0)).stars).toBe(2);
  });

  it("an aircraft gets no defense from terrain (02-terrain §1)", () => {
    const state = makeGame(["F"], [{ type: "fighter", owner: 0, pos: P(0, 0) }]);
    expect(tileInfo(state, P(0, 0))).toMatchObject({ stars: 0 });
  });
});
