// The map-specific AIs (22-campaign §6), by map. A map without one plays plain Greedy.

import { greedyAi } from "../greedy";
import type { MapPlan } from "../mapPlan";
import type { AiPlayer } from "../player";
import { GREEDY_WEIGHTS } from "../weights";
import { midwayPlan } from "./midway";
import { objectivePlan } from "./objectives";

/** A fresh plan for each game, since a plan may keep hints such as where it has searched. */
const PLANS: Readonly<Record<string, () => MapPlan>> = {
  midway: midwayPlan,
  // Rommel's drive on Tobruk.
  gazala: () => objectivePlan("Tobruk plan"),
  // The 32nd Army's counterattack on the airfields.
  "ten-go": () => objectivePlan("Okinawa plan"),
};

export function hasMapPlan(map: string): boolean {
  return Object.hasOwn(PLANS, map);
}

/** The computer for a campaign mission on this map: Greedy at Normal, with the map's plan if it has one. */
export function campaignAi(map: string): AiPlayer {
  const plan = Object.hasOwn(PLANS, map) ? PLANS[map]?.() : undefined;
  return greedyAi(GREEDY_WEIGHTS, plan ?? null);
}
