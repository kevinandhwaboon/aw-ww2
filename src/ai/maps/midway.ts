// Midway's map AI for Japan (22-campaign §6a): Nagumo's day. Strike Midway at dawn while the
// Fighters, Submarines and the carrier screen search a fixed fan of sectors; once a US Carrier is
// found, every bomber goes for the US Carriers; once all three are sunk, Greedy plays the invasion.
//
// It knows only what Japan sees, remembers or has sunk (22-campaign §6): the search fan is the same
// whatever the US does, and nothing here reads where an unseen US unit is.

import { distance, tileInSight, type GameState, type Point, type Unit, type UnitTypeId } from "../../engine";
import { defOf, isCarrier, isLandingCraft } from "../greedyBase";
import type { MapPlan } from "../mapPlan";

/**
 * The search fan, from the Kido Butai north-west of Midway round through north, east and
 * south-east: where a 1942 search plan would send floatplanes, with no knowledge of Point Luck.
 */
export const SEARCH_POINTS: readonly Point[] = [
  { x: 21, y: 2 },
  { x: 28, y: 1 },
  { x: 34, y: 3 },
  { x: 38, y: 8 },
  { x: 38, y: 14 },
  { x: 35, y: 20 },
];

/** Midway's command post: what the spotter flies over before the dawn strike. */
export const MIDWAY: Point = { x: 22, y: 16 };

/** How many US Carriers there are to sink before the plan stands down. */
const US_CARRIERS = 3;

/** Days a searched point stays crossed off: the carriers move, so it's worth another look later. */
const SEARCH_MEMORY_DAYS = 3;

/** An attack on a US Carrier is worth this much more than its damage alone, in funds. */
export const CARRIER_STRIKE_BONUS = 30000;

/** Bombers in the air at once against Midway before the US Carriers are found; the rest are the reserve. */
export const DAWN_STRIKE = 3;

const BOMBERS: readonly UnitTypeId[] = ["bomber", "diveBomber", "torpedoBomber"];

export type MidwayPhase =
  /** No US Carrier found yet: search, and strike Midway. */
  | "search"
  /** A US Carrier is in sight or remembered: every bomber goes for the carriers. */
  | "strike"
  /** All three US Carriers are sunk: Greedy plays the invasion. */
  | "invade";

const isEnemy = (state: GameState, owner: number) => state.players[owner]?.side !== state.players[state.currentPlayer]?.side;

/** US Carriers Japan can see or remembers seeing (09-ai §4g). */
function knownCarriers(state: GameState): Unit[] {
  return state.units.filter((u) => isCarrier(u.type) && isEnemy(state, u.owner));
}

/** How many Carriers the enemy has lost: public, since Japan sank them (04-economy §8a). */
function carriersSunk(state: GameState): number {
  return state.players.filter((p) => isEnemy(state, p.id)).reduce((n, p) => n + (p.unitsLost.carrier ?? 0), 0);
}

/**
 * Whether this aircraft is taking off: while a launch is being weighed it stands on its own
 * Carrier's tile (engine launchState).
 */
function launching(state: GameState, aircraft: Unit): boolean {
  const before = state.units.find((u) => u.id === aircraft.id);
  return before !== undefined && state.units.some((c) => c.id !== before.id && c.owner === before.owner && isCarrier(c.type) && c.pos.x === before.pos.x && c.pos.y === before.pos.y);
}

export function midwayPhase(state: GameState): MidwayPhase {
  if (knownCarriers(state).length > 0) return "strike";
  return carriersSunk(state) >= US_CARRIERS ? "invade" : "search";
}

/** Japan's units that search: Fighters, Submarines, and Destroyers not escorting the invasion. */
function searchers(state: GameState): Unit[] {
  const me = state.currentPlayer;
  const convoys = state.units.filter((u) => u.owner === me && isLandingCraft(u.type));
  return state.units
    .filter((u) => u.owner === me)
    .filter((u) => u.type === "fighter" || u.type === "submarine" || (u.type === "destroyer" && !convoys.some((c) => distance(c.pos, u.pos) <= 3)))
    .sort((a, b) => a.id - b.id);
}

export function midwayPlan(): MapPlan {
  /** The day each search point was last in sight on Japan's turn. */
  const searched = new Map<number, number>();
  const pointsLeft = (state: GameState) =>
    SEARCH_POINTS.filter((_, i) => {
      const day = searched.get(i);
      return day === undefined || state.day - day >= SEARCH_MEMORY_DAYS;
    });

  return {
    name: "Midway plan",

    observe(state) {
      SEARCH_POINTS.forEach((p, i) => {
        if (tileInSight(state, p, state.currentPlayer)) searched.set(i, state.day);
      });
    },

    attackBonus(state, attacker, target) {
      const phase = midwayPhase(state);
      if (phase === "invade") return 0;
      if (phase === "search") {
        // Nagumo's reserve: once the dawn strike is in the air, the other bombers stay aboard, armed for ships.
        const airborne = state.units.filter((u) => u.owner === attacker.owner && u.id !== attacker.id && BOMBERS.includes(u.type)).length;
        const atLand = defOf(target.type).category === "land";
        return BOMBERS.includes(attacker.type) && launching(state, attacker) && atLand && airborne >= DAWN_STRIKE ? -Infinity : 0;
      }
      if (isCarrier(target.type) && isEnemy(state, target.owner)) return CARRIER_STRIKE_BONUS;
      // A bomber still aboard is kept for the US Carriers.
      return BOMBERS.includes(attacker.type) && launching(state, attacker) ? -Infinity : 0;
    },

    goals(state, unit) {
      const phase = midwayPhase(state);
      if (phase === "strike") {
        // Bombers in the air head for where a US Carrier is, or was last seen. One still aboard
        // waits there, rearmed, until a Carrier is in striking range.
        return BOMBERS.includes(unit.type) && !launching(state, unit) ? knownCarriers(state).map((c) => c.pos) : null;
      }
      if (phase === "invade") return null;
      const scouts = searchers(state);
      const rank = scouts.findIndex((u) => u.id === unit.id);
      if (rank < 0) return null;
      // The first Fighter spots for the dawn strike until there's something on Midway to hit.
      const spotter = scouts.find((u) => u.type === "fighter");
      const midwaySeen = state.units.some((u) => isEnemy(state, u.owner) && distance(u.pos, MIDWAY) <= 6);
      if (unit.id === spotter?.id && !midwaySeen) return [MIDWAY];
      // Every other searcher takes the nearest point not yet searched that no earlier one has taken.
      const left = pointsLeft(state);
      if (left.length === 0) return null;
      const taken = new Set<number>();
      for (const scout of scouts) {
        if (scout.id === spotter?.id && !midwaySeen) continue;
        const free = left.map((p, i) => ({ p, i })).filter(({ i }) => !taken.has(i) || taken.size >= left.length);
        const nearest = free.reduce((best, c) => (distance(scout.pos, c.p) < distance(scout.pos, best.p) ? c : best), free[0] ?? { p: left[0] ?? MIDWAY, i: 0 });
        if (scout.id === unit.id) return [nearest.p];
        taken.add(nearest.i);
      }
      return null;
    },
  };
}
