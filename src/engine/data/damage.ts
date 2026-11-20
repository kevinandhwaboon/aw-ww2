// Damage chart v0, from docs/03-combat.md section 5. Attacker = row, defender = column.
// Cells are written exactly as in the doc so they can be checked side by side:
//   "55"  = primary weapon (uses ammo)
//   "55*" = secondary weapon (machine gun etc., unlimited)
//   "—"   = cannot attack
// Unarmed units (Halftrack, Transport Aircraft, Landing Craft, Carrier, Supply Ship) have no rows.

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
  "fighter", "bomber", "diveBomber", "torpedoBomber", "battleship", "destroyer", "submarine", "torpedoBoat",
] as const satisfies readonly UnitTypeId[];
type ArmedUnitId = (typeof ARMED_UNIT_IDS)[number];

// 03-combat §5a: vs. land units
const VS_LAND_COLUMNS = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank",
  "heavyTank", "tankDestroyer", "artillery", "rocketArtillery", "mobileAA", "flakGun", "radarStation",
] as const satisfies readonly DamageTarget[];

const NONE_VS_LAND = "— — — — — — — — — — — — — —";
//                     Inf  AInf  Mor  Rec  HT   LT   MT   HvT  TD   Art  Rkt  AA   Flak Radar
const VS_LAND: Record<ArmedUnitId, string> = {
  infantry:        "55*  45*  60*  12*  14*  7*   5*   1*   6*   15*  25*  5*   25*  15*",
  assaultInfantry: "65*  55*  70*  85   75   70   55   15   60   70   85   65   85   70",
  mortar:          "75   70   75   45   40   30   15   5    25   55   60   40   60   55",
  recon:           "70*  65*  75*  35*  45*  10*  6*   1*   8*   45*  55*  4*   28*  30*",
  lightTank:       "70*  65*  75*  75   65   55   40   10   45   60   75   55   75   60",
  mediumTank:      "75*  70*  80*  85   75   70   55   15   65   70   85   65   85   70",
  heavyTank:       "105* 95*  105* 105  105  95   85   55   90   105  105  105  105  105",
  tankDestroyer:   "—    —    —    95   90   95   85   65   75   80   90   85   90   80",
  artillery:       "90   85   90   80   70   75   70   45   70   75   80   75   80   75",
  rocketArtillery: "95   90   95   90   80   85   80   55   80   80   85   85   90   80",
  mobileAA:        "105  105  105  60   50   35   25   10   30   50   45   45   55   40",
  flakGun:         NONE_VS_LAND,
  fighter:         "15   15   15   10   8    5    2    1    3    10   10   3    8    10",
  bomber:          "110  110  110  105  105  105  105  95   105  105  105  95   105  75",
  diveBomber:      "55   55   55   55   55   55   50   45   50   55   55   45   50   40",
  torpedoBomber:   NONE_VS_LAND,
  battleship:      "95   90   95   90   80   85   80   55   80   80   85   85   90   80",
  destroyer:       "50   45   50   40   35   30   20   5    20   40   50   30   45   40",
  submarine:       NONE_VS_LAND,
  torpedoBoat:     NONE_VS_LAND,
};

// 03-combat §5b: vs. air, naval and fortifications
const VS_OTHER_COLUMNS = [
  "fighter", "bomber", "transportAircraft", "diveBomber", "torpedoBomber", "battleship", "destroyer", "submarine",
  "landingCraft", "torpedoBoat", "carrier", "supplyShip", "fort",
] as const satisfies readonly DamageTarget[];

//                     Ftr  Bmr  Trn  Dive TBmr BB   DD   Sub  LC   TB   CV   Sup  Fort
const VS_OTHER: Record<ArmedUnitId, string> = {
  infantry:        "—    —    —    —    —    —    —    —    —    —    —    —    5*",
  assaultInfantry: "—    —    —    —    —    —    —    —    —    —    —    —    65",
  mortar:          "—    —    —    —    —    —    —    —    25   25   —    25   20",
  recon:           "—    —    —    —    —    —    —    —    —    —    —    —    —",
  lightTank:       "—    —    —    —    —    1    3    1    8    15   1    8    10",
  mediumTank:      "—    —    —    —    —    1    5    1    10   20   1    10   15",
  heavyTank:       "—    —    —    —    —    10   30   10   35   40   10   35   40",
  tankDestroyer:   "—    —    —    —    —    5    10   5    15   25   5    15   30",
  artillery:       "—    —    —    —    —    40   50   60   55   60   45   55   50",
  rocketArtillery: "—    —    —    —    —    55   65   85   60   75   60   60   55",
  mobileAA:        "65   75   90   75   75   —    —    —    —    —    —    —    —",
  flakGun:         "67   67   73   67   67   —    —    —    —    —    —    —    —",
  fighter:         "55   50   100  100  100  —    —    —    5    10   —    5    —",
  bomber:          "—    —    —    —    —    75   85   95   95   95   85   95   55",
  diveBomber:      "—    —    —    —    —    40   45   50   50   50   45   50   30",
  torpedoBomber:   "—    —    —    —    —    60   60   —    60   60   60   60   —",
  battleship:      "—    —    —    —    —    50   85   95   95   95   60   95   55",
  destroyer:       "55*  65*  105* 65*  65*  10   40   90   50   85   10   50   20",
  submarine:       "—    —    —    —    —    55   25   55   95   75   75   95   —",
  torpedoBoat:     "—    —    —    —    —    35   30   40   75   55   45   75   —",
};

// 03-combat §5d: return-fire AA. Battleships and Carriers fire these back at an aircraft that
// attacks them from next door, and never attack aircraft themselves. Deliberately weak.
const RETURN_FIRE_AA_COLUMNS = ["fighter", "bomber", "transportAircraft", "diveBomber", "torpedoBomber"] as const satisfies readonly DamageTarget[];

//                     Ftr  Bmr  Trn  Dive TBmr
const RETURN_FIRE_AA: Partial<Record<UnitTypeId, string>> = {
  battleship:      "10*  10*  15*  15*  15*",
  carrier:         "10*  10*  15*  15*  15*",
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

function buildReturnFireChart(): Readonly<Partial<Record<UnitTypeId, ChartRow>>> {
  const chart: Partial<Record<UnitTypeId, ChartRow>> = {};
  for (const [defender, text] of Object.entries(RETURN_FIRE_AA) as [UnitTypeId, string][]) {
    const row = {} as Record<DamageTarget, DamageEntry>;
    parseRow(row, RETURN_FIRE_AA_COLUMNS, text, defender);
    chart[defender] = row;
  }
  return chart;
}

export const RETURN_FIRE_AA_CHART = buildReturnFireChart();

/**
 * The return-fire AA entry when this defender is attacked by this aircraft, or null if it has none
 * (03-combat §5d). Never used to attack first.
 */
export function returnFireDamage(defender: UnitTypeId, attacker: UnitTypeId): DamageEntry | null {
  return RETURN_FIRE_AA_CHART[defender]?.[attacker] ?? null;
}

/** Base damage entry for attacker vs target, or null if the attacker can't hit it at all. */
export function baseDamage(attacker: UnitTypeId, target: DamageTarget): DamageEntry | null {
  return DAMAGE_CHART[attacker]?.[target] ?? null;
}
