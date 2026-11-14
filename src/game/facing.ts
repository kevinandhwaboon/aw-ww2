// Which way a unit's sprite shows it while it moves on the map (08-art-pipeline §22). Presentation
// only: no rule reads facing.

import { UNITS, type UnitTypeId } from "../engine/data/units";
import type { Point } from "../engine/map";
import type { UnitView } from "./artPack";

/** The way one step of a move goes, in screen terms. */
export type StepDirection = "left" | "right" | "up" | "down";

/** The direction of one step between neighboring squares, or null if it doesn't move. */
export function stepDirection(from: Point, to: Point): StepDirection | null {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  if (dx === 0 && dy === 0) return null;
  if (Math.abs(dx) >= Math.abs(dy)) return dx > 0 ? "right" : "left";
  return dy > 0 ? "down" : "up";
}

/** A sprite pose: which view to show, and whether to mirror it. */
export interface Pose {
  readonly view: UnitView;
  readonly flipX: boolean;
}

/**
 * How a unit moving this way is drawn: the side view facing the way it goes when moving left or
 * right; the front view coming down the map and the back view going up. A sheet without the front
 * or back view keeps the side view, facing the player's way (`restingFlip`).
 */
export function movingPose(direction: StepDirection, views: readonly UnitView[], restingFlip: boolean): Pose {
  if (direction === "left" || direction === "right") return { view: "side", flipX: direction === "left" };
  return views.includes(direction) ? { view: direction, flipX: false } : { view: "side", flipX: restingFlip };
}

/** How a unit's move looks: soldiers step and hop, vehicles bump and raise dust, ships leave foam. */
export type MoveStyle = "foot" | "vehicle" | "air" | "naval";

export function moveStyle(type: UnitTypeId): MoveStyle {
  const unit = UNITS[type];
  if (unit.category === "air") return "air";
  if (unit.category === "naval") return "naval";
  return unit.movementType === "foot" || unit.movementType === "heavyFoot" ? "foot" : "vehicle";
}
