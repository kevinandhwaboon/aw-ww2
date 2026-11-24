// The kinds of endless wave a survival map can send, and what each spends its budget on
// (23-survival §4). Typed data with no logic: balancing the waves is an edit here. The rules that
// turn a pattern into units are in engine/waves.ts.

import type { UnitTypeId } from "./units";

/** Units of one kind in a wave, bought with a share of the wave's budget. */
export interface WaveUnitEntry {
  readonly type: UnitTypeId;
  /** This entry's share of the whole wave's budget. Shares are scaled so the entries in play add up to 1. */
  readonly share: number;
  /** Passengers aboard each one, paid for out of the same share. */
  readonly cargo?: readonly UnitTypeId[];
  /** Land-based aircraft fly this many turns, then go home (23-survival §5c). */
  readonly sortieTurns?: number;
  /** Only in waves from this one on. */
  readonly fromWave?: number;
  /** A transport that turns for home once it has unloaded (23-survival §5c). */
  readonly leavesWhenEmpty?: true;
}

/** One group of a wave, arriving together from one edge. */
export interface WavePart {
  /** The edges it may come from, by the names the map gives them. */
  readonly edges: readonly string[];
  readonly units: readonly WaveUnitEntry[];
}

export interface WavePattern {
  readonly id: string;
  /** Shown in the banner and the forecast. */
  readonly name: string;
  /** How often it's picked, against the other patterns in play. */
  readonly weight: number;
  /** Only from this wave on. */
  readonly fromWave?: number;
  /** Each part comes from a different edge where it can. */
  readonly parts: readonly WavePart[];
}

/** Land-based raiders fly two turns after the turn they arrive (23-survival §3). */
const RAID_SORTIE = 2;

/**
 * Warships covering a landing or a bombardment stay five turns, then sail home, so they don't pile up
 * wave after wave (23-survival §4). A Carrier's escort stays with it.
 */
const SHIP_SORTIE = 5;

/** Japan's waves in the central Pacific (23-survival §4), for Wake Island. */
const PACIFIC: readonly WavePattern[] = [
  {
    id: "raid",
    name: "Air raid",
    weight: 3,
    parts: [
      {
        edges: ["south", "west"],
        units: [
          { type: "bomber", share: 0.7, sortieTurns: RAID_SORTIE },
          { type: "fighter", share: 0.3, sortieTurns: RAID_SORTIE, fromWave: 12 },
        ],
      },
    ],
  },
  {
    id: "landing",
    name: "Landing",
    weight: 3,
    parts: [
      {
        edges: ["south", "west"],
        units: [
          { type: "destroyer", share: 0.15, sortieTurns: SHIP_SORTIE },
          { type: "landingCraft", share: 0.5, cargo: ["infantry", "infantry"], leavesWhenEmpty: true },
          // Anti-aircraft ashore, so an aircraft parked on the HQ can't hold it alone (23-survival §6).
          // Enough of the budget for at least one in the smallest landing.
          { type: "landingCraft", share: 0.15, cargo: ["mobileAA", "infantry"], leavesWhenEmpty: true },
          { type: "landingCraft", share: 0.1, cargo: ["assaultInfantry", "mortar"], fromWave: 12, leavesWhenEmpty: true },
          { type: "landingCraft", share: 0.1, cargo: ["lightTank", "infantry"], fromWave: 12, leavesWhenEmpty: true },
        ],
      },
    ],
  },
  {
    id: "bombardment",
    name: "Bombardment",
    weight: 2,
    parts: [
      {
        edges: ["south", "west", "north", "east"],
        units: [
          { type: "battleship", share: 0.75, sortieTurns: SHIP_SORTIE },
          { type: "destroyer", share: 0.25, sortieTurns: SHIP_SORTIE },
        ],
      },
    ],
  },
  {
    id: "carrierStrike",
    name: "Carrier strike",
    weight: 2,
    parts: [
      {
        edges: ["west", "north"],
        units: [
          { type: "carrier", share: 0.55, cargo: ["fighter", "diveBomber"] },
          { type: "carrier", share: 0.3, cargo: ["torpedoBomber", "diveBomber"] },
          { type: "destroyer", share: 0.15 },
        ],
      },
    ],
  },
  {
    id: "wolfPack",
    name: "Wolf pack",
    weight: 1,
    parts: [
      {
        edges: ["south", "west", "north", "east"],
        units: [
          { type: "submarine", share: 0.7 },
          { type: "torpedoBoat", share: 0.3 },
        ],
      },
    ],
  },
  {
    id: "combined",
    name: "Combined assault",
    weight: 3,
    fromWave: 14,
    parts: [
      {
        edges: ["south", "west"],
        units: [
          { type: "destroyer", share: 0.1, sortieTurns: SHIP_SORTIE },
          { type: "landingCraft", share: 0.2, cargo: ["infantry", "infantry"], leavesWhenEmpty: true },
          { type: "landingCraft", share: 0.1, cargo: ["assaultInfantry", "lightTank"], leavesWhenEmpty: true },
          { type: "landingCraft", share: 0.1, cargo: ["mobileAA", "infantry"], leavesWhenEmpty: true },
        ],
      },
      { edges: ["south", "west", "north"], units: [{ type: "bomber", share: 0.3, sortieTurns: RAID_SORTIE }] },
      { edges: ["south", "west", "north", "east"], units: [{ type: "battleship", share: 0.2, sortieTurns: SHIP_SORTIE }] },
    ],
  },
];

/**
 * Germany's waves over Crete (24-survival-crete §4): mostly paratroops, arriving already aboard
 * Transport Aircraft that fly home once they've dropped them; raids; and caique convoys bringing
 * what aircraft can't carry. No warships: the Royal Navy owned the sea, and an escort that reached a
 * captured port would stay there for good (23-survival §5c) and block it for the convoys.
 */
const AEGEAN: readonly WavePattern[] = [
  {
    id: "drop",
    name: "Parachute drop",
    weight: 4,
    parts: [
      {
        edges: ["north", "west"],
        units: [
          { type: "transportAircraft", share: 0.55, cargo: ["infantry", "infantry"], leavesWhenEmpty: true },
          { type: "transportAircraft", share: 0.2, cargo: ["assaultInfantry", "mortar"], leavesWhenEmpty: true },
          { type: "fighter", share: 0.25, sortieTurns: RAID_SORTIE },
        ],
      },
    ],
  },
  {
    id: "raid",
    name: "Air raid",
    weight: 2,
    parts: [
      {
        edges: ["north", "west", "east"],
        units: [
          { type: "bomber", share: 0.7, sortieTurns: RAID_SORTIE },
          { type: "fighter", share: 0.3, sortieTurns: RAID_SORTIE },
        ],
      },
    ],
  },
  {
    id: "convoy",
    name: "Convoy",
    weight: 2,
    parts: [
      {
        edges: ["north", "east"],
        units: [
          { type: "landingCraft", share: 0.45, cargo: ["infantry", "infantry"], leavesWhenEmpty: true },
          { type: "landingCraft", share: 0.3, cargo: ["lightTank", "infantry"], leavesWhenEmpty: true },
          { type: "landingCraft", share: 0.25, cargo: ["artillery", "mobileAA"], leavesWhenEmpty: true },
        ],
      },
    ],
  },
  {
    id: "combined",
    name: "Combined assault",
    weight: 3,
    fromWave: 15,
    parts: [
      {
        edges: ["north", "west"],
        units: [
          { type: "transportAircraft", share: 0.3, cargo: ["infantry", "infantry"], leavesWhenEmpty: true },
          { type: "transportAircraft", share: 0.1, cargo: ["assaultInfantry", "mortar"], leavesWhenEmpty: true },
        ],
      },
      { edges: ["north", "west", "east", "south"], units: [{ type: "bomber", share: 0.3, sortieTurns: RAID_SORTIE }] },
      {
        edges: ["north", "east", "south"],
        units: [
          { type: "landingCraft", share: 0.2, cargo: ["lightTank", "infantry"], leavesWhenEmpty: true },
          { type: "landingCraft", share: 0.1, cargo: ["infantry", "infantry"], leavesWhenEmpty: true },
        ],
      },
    ],
  },
];

export const WAVE_PATTERNS = { pacific: PACIFIC, aegean: AEGEAN } as const satisfies Record<string, readonly WavePattern[]>;

export type WavePatternSetId = keyof typeof WAVE_PATTERNS;

export const WAVE_PATTERN_SET_IDS = Object.keys(WAVE_PATTERNS) as WavePatternSetId[];
