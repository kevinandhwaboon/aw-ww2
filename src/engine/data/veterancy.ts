// Veterancy, from docs/03-combat.md section 6.

export type VeterancyLevel = "rookie" | "veteran" | "elite";

export interface VeterancyDef {
  readonly level: VeterancyLevel;
  readonly minKills: number;
  /** Added to attackMod / defenseMod (base 100) through the modifier layer. */
  readonly attackBonus: number;
  readonly defenseBonus: number;
}

/** Ordered from lowest to highest. */
export const VETERANCY: readonly VeterancyDef[] = [
  { level: "rookie", minKills: 0, attackBonus: 0, defenseBonus: 0 },
  { level: "veteran", minKills: 3, attackBonus: 10, defenseBonus: 10 },
  { level: "elite", minKills: 9, attackBonus: 20, defenseBonus: 20 },
];

/**
 * The level for a kill count. `minKills` replaces the table's own kill counts, by level, for a
 * player whose units are promoted sooner or later (06-commanders); game rules get it from
 * stats.veterancy, which reads those counts through the modifier layer.
 */
export function veterancyFor(kills: number, minKills: Partial<Record<VeterancyLevel, number>> = {}): VeterancyDef {
  let result = VETERANCY[0];
  for (const def of VETERANCY) if (kills >= (minKills[def.level] ?? def.minKills)) result = def;
  if (!result) throw new Error("VETERANCY table is empty");
  return result;
}
