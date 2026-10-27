// The modifier layer (00-master-design §7). Every stat lookup passes through applyModifiers, so
// commanders, doctrines, weather and scenario rules can be added later as data.
//
// Modifiers are plain serializable data. For one stat, they combine in a fixed order:
//   1. all "add" values are summed onto the base,
//   2. the result is multiplied by every "multiply" value,
//   3. a "set" replaces the result (the last matching "set" wins),
// then the result is rounded down and clamped at 0. Stats are always whole numbers.

import type { TerrainId } from "./data/terrain";
import type { UnitCategory, UnitTypeId } from "./data/units";

export const MODIFIABLE_STATS = [
  "movePoints", "vision", "cost", "maxFuel", "maxAmmo", "fuelPerDay",
  /** Movement points to enter a tile; the context's terrain is the tile being entered. */
  "moveCost",
  "minRange", "maxRange",
  /** Percentage, base 100 (03-combat §1). */
  "attack",
  /** Percentage, base 100 (03-combat §1). */
  "defense",
  /** Defense stars the unit gets from the terrain it stands on. */
  "terrainStars",
] as const;
export type ModifiableStat = (typeof MODIFIABLE_STATS)[number];

export type PlayerId = number;

/** Which lookups a modifier applies to. Every listed field must match; omitted fields match anything. */
export interface ModifierScope {
  readonly players?: readonly PlayerId[];
  readonly unitTypes?: readonly UnitTypeId[];
  readonly categories?: readonly UnitCategory[];
  readonly terrain?: readonly TerrainId[];
}

export interface Modifier {
  /** Where it comes from, for debugging and UI, e.g. "veterancy:veteran" or "co:patton". */
  readonly source: string;
  readonly stat: ModifiableStat;
  readonly op: "add" | "multiply" | "set";
  readonly value: number;
  readonly scope?: ModifierScope;
}

/** What a stat is being looked up for. */
export interface StatContext {
  readonly player?: PlayerId;
  readonly unitType?: UnitTypeId;
  readonly category?: UnitCategory;
  readonly terrain?: TerrainId;
}

/** Whether a modifier's scope covers this lookup (ignores which stat it modifies). */
export function modifierApplies(modifier: Modifier, ctx: StatContext): boolean {
  return matches(modifier.scope, ctx);
}

function matches(scope: ModifierScope | undefined, ctx: StatContext): boolean {
  if (!scope) return true;
  const fieldMatches = <T>(allowed: readonly T[] | undefined, actual: T | undefined) =>
    allowed === undefined || (actual !== undefined && allowed.includes(actual));
  return (
    fieldMatches(scope.players, ctx.player) &&
    fieldMatches(scope.unitTypes, ctx.unitType) &&
    fieldMatches(scope.categories, ctx.category) &&
    fieldMatches(scope.terrain, ctx.terrain)
  );
}

export function applyModifiers(
  base: number,
  stat: ModifiableStat,
  ctx: StatContext,
  modifiers: readonly Modifier[],
): number {
  let sum = 0;
  let factor = 1;
  let set: number | undefined;
  for (const m of modifiers) {
    if (m.stat !== stat || !matches(m.scope, ctx)) continue;
    if (m.op === "add") sum += m.value;
    else if (m.op === "multiply") factor *= m.value;
    else set = m.value;
  }
  const value = set ?? (base + sum) * factor;
  // The epsilon keeps float error from rounding e.g. 100 × 1.15 = 114.99999… down to 114.
  return Math.max(0, Math.floor(value + 1e-9));
}
