// The map-specific AIs (22-campaign §6), by map. A map without one plays plain Greedy.

import { greedyAi } from "../greedy";
import type { MapPlan } from "../mapPlan";
import type { AiPlayer } from "../player";
import { GREEDY_WEIGHTS } from "../weights";
import { battleOfBritainPlan } from "./battleOfBritain";
import { gazalaPlan } from "./gazala";
import { midwayPlan } from "./midway";
import { objectivePlan } from "./objectives";
import { survivalPlan } from "./survival";

/** A fresh plan for each game, since a plan may keep hints such as where it has searched. */
const PLANS: Readonly<Record<string, () => MapPlan>> = {
  midway: midwayPlan,
  // Sea Lion: break the Navy and the radar from the air, then land together on Dover and Hawkinge.
  "battle-of-britain": battleOfBritainPlan,
  // Rommel's sweep round Bir Hakeim, kept supplied, then on to Tobruk.
  gazala: gazalaPlan,
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

/**
 * The computer bringing the waves on a survival map (23-survival §6): Greedy at Normal, driving on
 * the defender's HQ. Used only in Survival, as map plans are only in the Campaign.
 */
export function survivalAi(): AiPlayer {
  return greedyAi(GREEDY_WEIGHTS, survivalPlan("Survival plan"));
}
