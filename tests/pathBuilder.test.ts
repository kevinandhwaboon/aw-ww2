import { describe, expect, it } from "vitest";
import type { Point } from "../src/engine/map";
import { reachableTiles } from "../src/engine/movement";
import { extendPath } from "../src/game/pathBuilder";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });

describe("path arrow while dragging the cursor", () => {
  const state = makeGame([".....", ".....", "....."], [
    { type: "infantry", owner: 0, pos: P(0, 0) },
    { type: "infantry", owner: 0, pos: P(1, 1) },
  ]);
  const unit = state.units[0];
  if (!unit) throw new Error("no unit");
  const reach = reachableTiles(state, unit);
  const drag = (...tiles: Point[]) => tiles.reduce<Point[]>((path, t) => extendPath(state, unit, reach, path, t), []);

  it("follows the cursor tile by tile", () => {
    expect(drag(P(0, 1), P(0, 2), P(1, 2))).toEqual([P(0, 1), P(0, 2), P(1, 2)]);
  });

  it("cuts back when the cursor returns to a tile already in the path", () => {
    expect(drag(P(1, 0), P(2, 0), P(1, 0))).toEqual([P(1, 0)]);
  });

  it("clears when the cursor returns to the unit", () => {
    expect(drag(P(1, 0), P(2, 0), P(0, 0))).toEqual([]);
  });

  it("can pass over a friendly unit", () => {
    expect(drag(P(1, 0), P(1, 1), P(1, 2))).toEqual([P(1, 0), P(1, 1), P(1, 2)]);
  });

  it("switches to the cheapest path when following the cursor would cost too much", () => {
    // 3 move points: (1,0) (2,0) (2,1) already costs 3; stepping on to (1,1) would cost 4,
    // so the arrow reroutes along the cheapest path to (1,1) instead.
    expect(drag(P(1, 0), P(2, 0), P(2, 1), P(1, 1))).toEqual([P(1, 0), P(1, 1)]);
  });

  it("ignores the cursor outside the move range", () => {
    expect(drag(P(1, 0), P(4, 2))).toEqual([P(1, 0)]);
  });
});
