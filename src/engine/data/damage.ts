// Damage chart v0, from docs/03-combat.md section 5. Attacker = row, defender = column.
// Cells are written exactly as in the doc so they can be checked side by side:
//   "55"  = primary weapon (uses ammo)
//   "55*" = secondary weapon (machine gun etc., unlimited)
//   "—"   = cannot attack
// Unarmed units (Halftrack, Transport Aircraft, Landing Craft) have no rows.

import type { UnitTypeId } from "./units";

/** A unit type, or a fortification/obstacle (03-combat §4). */
export type DamageTarget = UnitTypeId | "fort";

export interface DamageEntry {
  readonly weapon: "primary" | "secondary";
  /** Base damage % for a full-HP attacker vs a full-HP defender on 0-star terrain. */
  readonly base: number;
}

export const ARMED_UNIT_IDS = [
  "infantry", "assaultInfantry", "mortar", "recon", "lightTank", "mediumTank", "heavyTank",
  "tankDestroyer", "artillery", "rocketArtillery", "mobileAA", "flakGun",
  "fighter", "bomber", "battleship", "destroyer", "submarine", "torpedoBoat",
] as const satisfies readonly UnitTypeId[];
type ArmedUnitId = (typeof ARMED_UNIT_IDS)[number];

// 03-combat §5a: vs. land units
const VS_LAND_COLUMNS = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank",
  "heavyTank", "tankDestroyer", "artillery", "rocketArtillery", "mobileAA", "flakGun",
] as const satisfies readonly DamageTarget[];

const NONE_VS_LAND = "— — — — — — — — — — — — —";
//                     Inf  AInf  Mor  Rec  HT   LT   MT   HvT  TD   Art  Rkt  AA   Flak
const VS_LAND: Record<ArmedUnitId, string> = {
  infantry:        "55*  45*  60*  12*  14*  7*   5*   1*   6*   15*  25*  5*   25*",
  assaultInfantry: "65*  55*  70*  85   75   70   55   15   60   70   85   65   85",
  mortar:          "75   70   75   45   40   30   15   5    25   55   60   40   60",
  recon:           "70*  65*  75*  35*  45*  10*  6*   1*   8*   45*  55*  4*   28*",
  lightTank:       "70*  65*  75*  75   65   55   40   10   45   60   75   55   75",
  mediumTank:      "75*  70*  80*  85   75   70   55   15   65   70   85   65   85",
  heavyTank:       "105* 95*  105* 105  105  95   85   55   90   105  105  105  105",
  tankDestroyer:   "—    —    —    95   90   95   85   65   75   80   90   85   90",
  artillery:       "90   85   90   80   70   75   70   45   70   75   80   75   80",
  rocketArtillery: "95   90   95   90   80   85   80   55   80   80   85   85   90",
  mobileAA:        "105  105  105  60   50   35   25   10   30   50   45   45   55",
  flakGun:         NONE_VS_LAND,
  fighter:         "15   15   15   10   8    5    2    1    3    10   10   3    8",
  bomber:          "110  110  110  105  105  105  105  95   105  105  105  95   105",
  battleship:      "95   90   95   90   80   85   80   55   80   80   85   85   90",
  destroyer:       "50   45   50   40   35   30   20   5    20   40   50   30   45",
  submarine:       NONE_VS_LAND,
  torpedoBoat:     NONE_VS_LAND,
};

// 03-combat §5b: vs. air, naval and fortifications
const VS_OTHER_COLUMNS = [
  "fighter", "bomber", "transportAircraft", "battleship", "destroyer", "submarine",
  "landingCraft", "torpedoBoat", "fort",
] as const satisfies readonly DamageTarget[];

//                     Ftr  Bmr  Trn  BB   DD   Sub  LC   TB   Fort
const VS_OTHER: Record<ArmedUnitId, string> = {
  infantry:        "—    —    —    —    —    —    —    —    5*",
  assaultInfantry: "—    —    —    —    —    —    —    —    65",
  mortar:          "—    —    —    —    —    —    25   25   20",
  recon:           "—    —    —    —    —    —    —    —    —",
  lightTank:       "—    —    —    1    3    1    8    15   10",
  mediumTank:      "—    —    —    1    5    1    10   20   15",
  heavyTank:       "—    —    —    10   30   10   35   40   40",
  tankDestroyer:   "—    —    —    5    10   5    15   25   30",
  artillery:       "—    —    —    40   50   60   55   60   50",
  rocketArtillery: "—    —    —    55   65   85   60   75   55",
  mobileAA:        "65   75   90   —    —    —    —    —    —",
  flakGun:         "100  100  110  —    —    —    —    —    —",
  fighter:         "55   100  100  —    —    —    5    10   —",
  bomber:          "—    —    —    75   85   95   95   95   55",
  battleship:      "—    —    —    50   85   95   95   95   55",
  destroyer:       "55*  65*  105* 10   40   90   50   85   20",
  submarine:       "—    —    —    55   25   55   95   75   —",
  torpedoBoat:     "—    —    —    35   30   40   75   55   —",
};

type ChartRow = Readonly<Partial<Record<DamageTarget, DamageEntry>>>;

function parseCell(cell: string, where: string): DamageEntry | null {
  if (cell === "—") return null;
  const match = /^(\d+)(\*?)$/.exec(cell);
  if (!match) throw new Error(`Bad damage chart cell "${cell}" at ${where}`);
  return { weapon: match[2] === "*" ? "secondary" : "primary", base: Number(match[1]) };
}

function parseRow(row: Record<DamageTarget, DamageEntry>, columns: readonly DamageTarget[], text: string, attacker: string): void {
  const cells = text.trim().split(/\s+/);
  if (cells.length !== columns.length) {
    throw new Error(`Damage chart row ${attacker} has ${cells.length} cells, expected ${columns.length}`);
  }
  columns.forEach((column, i) => {
    const entry = parseCell(cells[i] ?? "", `${attacker} vs ${column}`);
    if (entry) row[column] = entry;
  });
}

function buildChart(): Readonly<Partial<Record<UnitTypeId, ChartRow>>> {
  const chart: Partial<Record<UnitTypeId, ChartRow>> = {};
  for (const attacker of ARMED_UNIT_IDS) {
    const row = {} as Record<DamageTarget, DamageEntry>;
    parseRow(row, VS_LAND_COLUMNS, VS_LAND[attacker], attacker);
    parseRow(row, VS_OTHER_COLUMNS, VS_OTHER[attacker], attacker);
    chart[attacker] = row;
  }
  return chart;
}

export const DAMAGE_CHART = buildChart();

/** Base damage entry for attacker vs target, or null if the attacker can't hit it at all. */
export function baseDamage(attacker: UnitTypeId, target: DamageTarget): DamageEntry | null {
  return DAMAGE_CHART[attacker]?.[target] ?? null;
}
