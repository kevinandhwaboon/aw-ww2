// Diving and surfacing (05-supply-transport §9). Both are end actions, so a submarine can move first.

import { unitDef } from "./data/units";
import type { Unit } from "./state";

/** Why this unit can't dive, or null if it can. */
export function diveProblem(unit: Unit): string | null {
  if (!unitDef(unit.type).specialActions.includes("dive")) return "only submarines can dive";
  if (unit.submerged === true) return "it's already submerged";
  return null;
}

/** Why this unit can't surface, or null if it can. */
export function surfaceProblem(unit: Unit): string | null {
  return unit.submerged === true ? null : "it isn't submerged";
}
