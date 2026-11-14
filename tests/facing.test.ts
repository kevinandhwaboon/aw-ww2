import { describe, expect, it } from "vitest";
import { moveStyle, movingPose, stepDirection } from "../src/game/facing";

const ALL_VIEWS = ["side", "down", "up"] as const;

describe("which way a moving unit faces (08-art-pipeline §22)", () => {
  it("a step to the right, left, up or down the map goes that way", () => {
    expect(stepDirection({ x: 3, y: 3 }, { x: 4, y: 3 })).toBe("right");
    expect(stepDirection({ x: 3, y: 3 }, { x: 2, y: 3 })).toBe("left");
    expect(stepDirection({ x: 3, y: 3 }, { x: 3, y: 2 })).toBe("up");
    expect(stepDirection({ x: 3, y: 3 }, { x: 3, y: 4 })).toBe("down");
  });

  it("standing still goes nowhere", () => {
    expect(stepDirection({ x: 3, y: 3 }, { x: 3, y: 3 })).toBeNull();
  });

  it("moving right shows the side view as drawn, and moving left mirrors it, whichever way the player faces at rest", () => {
    for (const restingFlip of [false, true]) {
      expect(movingPose("right", ALL_VIEWS, restingFlip)).toEqual({ view: "side", flipX: false });
      expect(movingPose("left", ALL_VIEWS, restingFlip)).toEqual({ view: "side", flipX: true });
    }
  });

  it("moving down the map shows the unit's front, coming toward you", () => {
    expect(movingPose("down", ALL_VIEWS, true)).toEqual({ view: "down", flipX: false });
  });

  it("moving up the map shows the unit's back, going away", () => {
    expect(movingPose("up", ALL_VIEWS, true)).toEqual({ view: "up", flipX: false });
  });

  it("a sheet with only side views keeps the side view, facing the player's way, when moving up or down", () => {
    expect(movingPose("down", ["side"], true)).toEqual({ view: "side", flipX: true });
    expect(movingPose("up", ["side"], false)).toEqual({ view: "side", flipX: false });
  });
});

describe("how a move looks (08-art-pipeline §22)", () => {
  it("soldiers walk, including the slow foot units", () => {
    expect(moveStyle("infantry")).toBe("foot");
    expect(moveStyle("assaultInfantry")).toBe("foot");
    expect(moveStyle("mortar")).toBe("foot");
  });

  it("tracked and wheeled units drive", () => {
    expect(moveStyle("mediumTank")).toBe("vehicle");
    expect(moveStyle("recon")).toBe("vehicle");
    expect(moveStyle("artillery")).toBe("vehicle");
  });

  it("aircraft fly and ships sail", () => {
    expect(moveStyle("fighter")).toBe("air");
    expect(moveStyle("carrier")).toBe("naval");
    expect(moveStyle("landingCraft")).toBe("naval");
  });
});
