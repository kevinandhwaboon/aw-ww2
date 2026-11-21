// The title screen's ways to play (00-master-design §12): each with its description and the moving
// picture it loops, a battle scene drawn with the map select's own feature shots (featureShot.ts).
// Typed data with no logic. Free of the DOM so tests can check it.

import type { FeatureShot } from "./theaters";

export type TitleModeId = "campaign" | "skirmish" | "survival";

export interface TitleMode {
  readonly id: TitleModeId;
  readonly name: string;
  /** What the mode is, in a sentence or two. */
  readonly description: string;
  /** The map whose nations and season the moving picture is drawn with. */
  readonly scenario: string;
  /** What the moving picture shows, in words, under it. */
  readonly caption: string;
  /** The whole battle scene, both sides, so each picture reads as a fight. */
  readonly shot: FeatureShot;
}

/** Both halves of the battle scene (384 × 240), without the sky above or the ground's edge below. */
const WIDE: readonly [number, number, number, number] = [0, 74, 384, 134];

export const TITLE_MODES: readonly TitleMode[] = [
  {
    id: "campaign",
    name: "Campaign",
    description: "Lead the Allies through the war, battle by battle, from the Battle of Britain to Okinawa, against a stronger computer. Win a mission to open the next.",
    scenario: "normandy",
    caption: "Normandy, June 1944",
    shot: {
      kind: "battle",
      attacker: { kind: "mediumTank", nation: "us", terrain: "plains" },
      defender: { kind: "infantry", nation: "germany", terrain: "bocage" },
      weapon: "primary",
      counter: "secondary",
      crop: WIDE,
    },
  },
  {
    id: "skirmish",
    name: "Skirmish",
    description: "Any battle, either side. Pick a map on the world map and play the computer, or a friend on one device.",
    scenario: "kursk",
    caption: "Kursk, July 1943",
    shot: {
      kind: "battle",
      attacker: { kind: "mediumTank", nation: "ussr", terrain: "plains" },
      defender: { kind: "heavyTank", nation: "germany", terrain: "plains" },
      weapon: "primary",
      counter: "primary",
      crop: WIDE,
    },
  },
  {
    id: "survival",
    name: "Survival",
    description: "Hold your HQ against waves of raids and landings that grow until it falls. How long can you outlast history?",
    scenario: "wake-island",
    caption: "Wake Island, December 1941",
    shot: {
      kind: "battle",
      attacker: { kind: "artillery", nation: "us", terrain: "beach" },
      defender: { kind: "destroyer", nation: "japan", terrain: "sea" },
      weapon: "primary",
      counter: null,
      crop: WIDE,
    },
  },
];
