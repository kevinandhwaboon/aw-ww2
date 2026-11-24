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
    map: "dunkirk",
    // Falk, the panzer commander: Army Group A's armour on the Aa (21-scenarios-dunkirk §1).
    commanders: { 1: "falk" },
    // A first guess, untuned: more money for the Luftwaffe and the panzers. Extra units wait until the
    // map's layout is settled (21-scenarios-dunkirk §2).
    advantage: { funds: { 1: 5000 }, incomePercent: 25 },
  },
  {
    map: "battle-of-britain",
    commanders: { 1: "arakawa" },
    advantage: {
      // Sea Lion's first wave is already ashore, inland of Hythe.
      units: [
        { type: "infantry", owner: 1, pos: { x: 9, y: 8 } },
        { type: "infantry", owner: 1, pos: { x: 9, y: 7 } },
        { type: "infantry", owner: 1, pos: { x: 10, y: 7 } },
        { type: "infantry", owner: 1, pos: { x: 7, y: 8 } },
        { type: "assaultInfantry", owner: 1, pos: { x: 8, y: 8 } },
        { type: "mediumTank", owner: 1, pos: { x: 10, y: 8 } },
        { type: "mediumTank", owner: 1, pos: { x: 11, y: 8 } },
        { type: "artillery", owner: 1, pos: { x: 8, y: 7 } },
        { type: "flakGun", owner: 1, pos: { x: 8, y: 9 } },
        // A fourth barge at Ostend, loaded for the second wave.
        { type: "landingCraft", owner: 1, pos: { x: 26, y: 7 }, cargo: [{ type: "infantry" }, { type: "mediumTank" }] },
      ],
      // The towns the first wave has taken, between Hythe and Ashford, and the factory at Maidstone.
      properties: [
        { pos: { x: 9, y: 6 }, owner: 1 },
        { pos: { x: 11, y: 7 }, owner: 1 },
        { pos: { x: 11, y: 10 }, owner: 1 },
        { pos: { x: 10, y: 11 }, owner: 1 },
        { pos: { x: 8, y: 11 }, owner: 1 },
      ],
      funds: { 1: 4000 },
      incomePercent: 25,
    },
  },
  {
    map: "gazala",
    // Not Falk, whose units carry less fuel: on Gazala the sweep is decided by fuel (18-scenarios-north-africa §2).
    commanders: { 2: "wendt", 3: "ferrante" },
    advantage: {
      // More armour for the sweep round Bir Hakeim, and Halftracks to keep it fuelled and carry infantry to Tobruk.
      units: [
        { type: "halftrack", owner: 2, pos: { x: 6, y: 29 }, cargo: [{ type: "infantry" }] },
        { type: "halftrack", owner: 2, pos: { x: 5, y: 29 }, cargo: [{ type: "infantry" }] },
        { type: "halftrack", owner: 2, pos: { x: 7, y: 29 }, cargo: [{ type: "infantry" }] },
        { type: "mediumTank", owner: 2, pos: { x: 6, y: 30 } },
        { type: "mediumTank", owner: 2, pos: { x: 8, y: 29 } },
        { type: "mediumTank", owner: 2, pos: { x: 5, y: 30 } },
        { type: "halftrack", owner: 2, pos: { x: 6, y: 31 }, cargo: [{ type: "infantry" }] },
        { type: "halftrack", owner: 2, pos: { x: 4, y: 30 }, cargo: [{ type: "infantry" }] },
        { type: "mediumTank", owner: 2, pos: { x: 7, y: 31 } },
        { type: "halftrack", owner: 3, pos: { x: 8, y: 31 }, cargo: [{ type: "infantry" }] },
        { type: "halftrack", owner: 3, pos: { x: 8, y: 30 }, cargo: [{ type: "infantry" }] },
        { type: "mediumTank", owner: 3, pos: { x: 7, y: 30 } },
      ],
      funds: { 2: 3000, 3: 2000 },
      incomePercent: 25,
    },
  },
  {
    map: "midway",
    commanders: { 1: "arakawa" },
    advantage: {
      // The invasion force sails with its oiler and a fourth transport.
      units: [
        { type: "supplyShip", owner: 1, pos: { x: 9, y: 19 } },
        { type: "landingCraft", owner: 1, pos: { x: 8, y: 20 }, cargo: [{ type: "infantry" }] },
      ],
    },
  },
  {
    map: "sevastopol",
    commanders: { 1: "wendt" },
    advantage: { funds: { 1: 4500 }, incomePercent: 45 },
  },
  {
    map: "guadalcanal",
    commanders: { 1: "kuramochi" },
    advantage: {
      // Kawaguchi's men already ashore at Koli Point, east of Henderson Field.
      units: [
        { type: "infantry", owner: 1, pos: { x: 30, y: 17 } },
        { type: "infantry", owner: 1, pos: { x: 30, y: 16 } },
        { type: "artillery", owner: 1, pos: { x: 31, y: 17 } },
      ],
    },
  },
  {
    map: "el-alamein",
    commanders: { 1: "falk", 2: "ferrante" },
    // The Axis already wins every AI game here: the Allied AI doesn't clear a corridor (18-scenarios-north-africa §1).
    advantage: {},
  },
  {
    map: "stalingrad",
    commanders: { 1: "wendt" },
    advantage: { funds: { 1: 3000 }, incomePercent: 25 },
  },
  {
    map: "the-slot",
    // Not Kuramochi: on this naval map his +20% for ships put Japan ahead in every game on day 20 (22-campaign §5b).
    commanders: { 1: "arakawa" },
    advantage: {
      // A Battleship and a Destroyer more off Japan's home island.
      units: [
        { type: "battleship", owner: 1, pos: { x: 14, y: 7 } },
        { type: "destroyer", owner: 1, pos: { x: 14, y: 6 } },
      ],
    },
  },
  {
    map: "kursk",
    commanders: { 1: "falk" },
    // Falk's short fuel costs Germany here (ahead on day 20 in 4 of 8 with him alone, 22-campaign §5b);
    // the standings are close enough that 5% more income makes up for it.
    advantage: { incomePercent: 5 },
  },
  {
    map: "normandy",
    commanders: { 1: "wendt" },
    advantage: {
      // The panzer reserve released at once, by Caen; and France's output behind the Atlantic Wall.
      units: [
        { type: "heavyTank", owner: 1, pos: { x: 45, y: 63 } },
        { type: "mediumTank", owner: 1, pos: { x: 44, y: 63 } },
        { type: "mediumTank", owner: 1, pos: { x: 45, y: 61 } },
        { type: "infantry", owner: 1, pos: { x: 44, y: 62 } },
        { type: "infantry", owner: 1, pos: { x: 46, y: 62 } },
        { type: "artillery", owner: 1, pos: { x: 43, y: 63 } },
      ],
      funds: { 1: 5000 },
      incomePercent: 50,
    },
  },
  {
    map: "market-garden",
    commanders: { 2: "falk" },
    // Germany already wins every AI game here: the Allied AI can't link the drops with XXX Corps (17-scenarios-market-garden).
    advantage: {},
  },
  {
    map: "bastogne",
    commanders: { 1: "falk" },
    advantage: { funds: { 1: 3000 }, incomePercent: 25 },
  },
  {
    map: "iwo-jima",
    commanders: { 1: "arakawa" },
    // Japan already wins every AI game here: the US AI doesn't take the island in time (14-scenarios-pacific §5).
    advantage: {},
  },
  {
    map: "ten-go",
    commanders: { 1: "kuramochi" },
    advantage: {
      // More of the 32nd Army in front of Shuri.
      units: [
        { type: "infantry", owner: 1, pos: { x: 5, y: 29 } },
        { type: "infantry", owner: 1, pos: { x: 4, y: 29 } },
        { type: "mediumTank", owner: 1, pos: { x: 6, y: 29 } },
        { type: "artillery", owner: 1, pos: { x: 3, y: 29 } },
        { type: "infantry", owner: 1, pos: { x: 7, y: 29 } },
        { type: "assaultInfantry", owner: 1, pos: { x: 3, y: 28 } },
        { type: "artillery", owner: 1, pos: { x: 7, y: 28 } },
        { type: "mortar", owner: 1, pos: { x: 8, y: 29 } },
        { type: "infantry", owner: 1, pos: { x: 7, y: 30 } },
        { type: "infantry", owner: 1, pos: { x: 8, y: 28 } },
        { type: "assaultInfantry", owner: 1, pos: { x: 2, y: 30 } },
        { type: "mediumTank", owner: 1, pos: { x: 8, y: 30 } },
        { type: "infantry", owner: 1, pos: { x: 7, y: 31 } },
      ],
      funds: { 1: 2000 },
      incomePercent: 25,
    },
  },
];
