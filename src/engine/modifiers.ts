// The modifier layer (00-master-design §7). Every stat lookup passes through applyModifiers, so
// commanders, doctrines, weather and scenario rules can be added later as data.
//
// Modifiers are plain serializable data. For one stat, they combine in a fixed order:
//   1. all "add" values are summed onto the base,
//   2. the result is multiplied by every "multiply" value,
//   3. a "set" replaces the result (the last matching "set" wins),
// then the result is rounded down and clamped at 0. Stats are always whole numbers.

import type { MovementType, TerrainId } from "./data/terrain";
import type { UnitCategory, UnitTypeId } from "./data/units";

export const MODIFIABLE_STATS = [
  "movePoints", "vision",
  /** How far a unit sees enemy aircraft beyond its vision (19-fog-of-war §2a); 0 for most units. */
  "airVision",
  "cost", "maxFuel", "maxAmmo", "fuelPerDay",
  /** Fuel per movement point spent (05-supply-transport §1). */
  "fuelPerMove",
  /** Movement points to enter a tile; the context's terrain is the tile being entered. */
  "moveCost",
  "minRange", "maxRange",
  /** Percentage, base 100 (03-combat §1). */
  "attack",
  /** Percentage, base 100 (03-combat §1). */
  "defense",
  /** Defense stars the unit gets from the terrain it stands on. */
  "terrainStars",
  /** A player's funds per day from all owned properties. */
  "income",
  /** Displayed HP a unit repairs per turn on a property that repairs it (04-economy §5). */
  "repairHp",
  /** Kills at which a unit becomes a Veteran, and an Elite (03-combat §6). */
  "veteranKills", "eliteKills",
] as const;
export type ModifiableStat = (typeof MODIFIABLE_STATS)[number];

export type PlayerId = number;

/**
 * A unit's part in a fight (03-combat §2): it started it, or it is the one attacked. Its attack
 * while "answered" is its counterattack; its defense while "started" is against that counter.
 */
export type FightRole = "started" | "answered";

/** Which lookups a modifier applies to. Every listed field must match; omitted fields match anything. */
export interface ModifierScope {
  readonly players?: readonly PlayerId[];
  readonly unitTypes?: readonly UnitTypeId[];
  readonly categories?: readonly UnitCategory[];
  readonly terrain?: readonly TerrainId[];
  readonly movementTypes?: readonly MovementType[];
  /** Only in a fight, and only for the unit that started it or the one that was attacked. */
  readonly fight?: readonly FightRole[];
  /** Only in a fight against one of these unit types, or a unit of one of these categories. */
  readonly opponentTypes?: readonly UnitTypeId[];
  readonly opponentCategories?: readonly UnitCategory[];
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
  readonly movementType?: MovementType;
  /** Set only while working out a fight. A fortification as the opponent leaves the opponent fields unset. */
  readonly fight?: FightRole;
  readonly opponentType?: UnitTypeId;
  readonly opponentCategory?: UnitCategory;
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
    fieldMatches(scope.terrain, ctx.terrain) &&
    fieldMatches(scope.movementTypes, ctx.movementType) &&
    fieldMatches(scope.fight, ctx.fight) &&
    fieldMatches(scope.opponentTypes, ctx.opponentType) &&
    fieldMatches(scope.opponentCategories, ctx.opponentCategory)
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
