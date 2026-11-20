// The campaign's missions (22-campaign §2, §5): one chain in date order, each a built-in map with
// the computer's advantage. Pure data: balancing a mission is an edit here.

import type { CommanderId } from "../engine/data/commanders";
import type { Point } from "../engine/map";
import type { UnitSetup } from "../engine/setup";

/**
 * What the computer gets on top of the scenario's own setup (22-campaign §4). Never a rule
 * exception: only units, properties, funds, income and commanders.
 */
export interface Advantage {
  /** Extra units, placed like the scenario's own. Every owner must be an Axis player. */
  readonly units?: readonly UnitSetup[];
  /** Properties that start this Axis player's, instead of neutral or the Allies'. */
  readonly properties?: readonly { readonly pos: Point; readonly owner: number }[];
  /** Extra funds at the start, by player id. */
  readonly funds?: Readonly<Record<number, number>>;
  /** Extra daily income for every Axis player, in percent (the modifier layer's `income`). */
  readonly incomePercent?: number;
}

export interface CampaignMission {
  /** The built-in map it's played on (a scenario id). */
  readonly map: string;
  /** The computer's commander for each Axis player, by player id (22-campaign §3). */
  readonly commanders: Readonly<Record<number, CommanderId>>;
  readonly advantage: Advantage;
}

/** Every mission, in the order they unlock: the order they were fought (22-campaign §2). The dates are the map select's (ui/theaters.ts). */
export const MISSIONS: readonly CampaignMission[] = [
  {
    map: "battle-of-britain",
    commanders: { 1: "arakawa" },
    advantage: { funds: { 1: 4000 }, incomePercent: 25 },
  },
  {
    map: "gazala",
    commanders: { 2: "falk", 3: "ferrante" },
    advantage: { funds: { 2: 3000, 3: 2000 }, incomePercent: 25 },
  },
  {
    map: "midway",
    commanders: { 1: "arakawa" },
    advantage: { funds: { 1: 2000 }, incomePercent: 25 },
  },
  {
    map: "sevastopol",
    commanders: { 1: "wendt" },
    advantage: { funds: { 1: 3000 }, incomePercent: 25 },
  },
  {
    map: "guadalcanal",
    commanders: { 1: "kuramochi" },
    advantage: { funds: { 1: 3000 }, incomePercent: 25 },
  },
  {
    map: "el-alamein",
    commanders: { 1: "falk", 2: "ferrante" },
    advantage: {},
  },
  {
    map: "stalingrad",
    commanders: { 1: "wendt" },
    advantage: { funds: { 1: 3000 }, incomePercent: 25 },
  },
  {
    map: "the-slot",
    commanders: { 1: "kuramochi" },
    advantage: { funds: { 1: 3000 }, incomePercent: 25 },
  },
  {
    map: "kursk",
    commanders: { 1: "falk" },
    advantage: { funds: { 1: 4000 }, incomePercent: 25 },
  },
  {
    map: "normandy",
    commanders: { 1: "wendt" },
    advantage: { funds: { 1: 4000 }, incomePercent: 25 },
  },
  {
    map: "market-garden",
    commanders: { 2: "falk" },
    advantage: { funds: { 2: 3000 }, incomePercent: 25 },
  },
  {
    map: "bastogne",
    commanders: { 1: "falk" },
    advantage: { funds: { 1: 3000 }, incomePercent: 25 },
  },
  {
    map: "iwo-jima",
    commanders: { 1: "arakawa" },
    advantage: {},
  },
  {
    map: "ten-go",
    commanders: { 1: "kuramochi" },
    advantage: { funds: { 1: 2000 }, incomePercent: 25 },
  },
];
