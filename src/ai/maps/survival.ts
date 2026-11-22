// The attacker's plan on a survival map (23-survival §6): drive on the defender's HQ. Land units,
// fighting or capturing, head for the enemy HQ they can walk to, and units that can't capture keep off
// it so the capturers can get on; Landing Craft land them with Greedy's own landing plan (09-ai §4b).
// Aircraft go first for what keeps the defender in the air: Flak Guns, Mobile AA and its aircraft.
// A unit standing on the HQ, which no capturer can get past (an aircraft parked there can't be hit by
// infantry), draws every attack that can reach it, and every unit that can hit it is sent for it:
// fighters, launched from their Carriers if need be, and anti-aircraft.
// It knows only what any attacker would: the map, its own units and what it sees.

import { baseDamage, propertyAt, stats, terrainAt, unitAt, UNITS, type GameState, type Point, type Unit, type UnitTypeId } from "../../engine";
import { isCarrier } from "../greedyBase";
import type { MapPlan } from "../mapPlan";
import { reachable } from "./objectives";

/** An aircraft's attack on one of these is worth this much more, in funds (23-survival §6). */
export const AIR_DEFENCE_BONUS = 6000;

/** An attack on a unit standing on the HQ is worth this much more, in funds: it's all that stops the capture. */
export const HQ_BLOCKER_BONUS = 20000;

/**
 * How close to the enemy HQ a Carrier sails and stays, in squares: near enough for its aircraft to
 * strike anything parked on the HQ and come back aboard to rearm, launched or not (23-survival §6).
 */
export const CARRIER_STATION = 5;

/** What the raiders go for first: the guns that shoot them down. */
const AIR_DEFENCE: readonly UnitTypeId[] = ["flakGun", "mobileAA"];

const key = (p: Point) => `${p.x},${p.y}`;

/** The HQs of the other side: the attacker's objective (23-survival §5b). */
export function enemyHqs(state: GameState): Point[] {
  const me = state.players[state.currentPlayer];
  if (!me) return [];
  return state.properties.flatMap((p) => {
    if (p.owner === null || terrainAt(state.map, p.pos) !== "hq") return [];
    return state.players[p.owner]?.side === me.side ? [] : [p.pos];
  });
}

/** Enemy units standing on the HQs the attacker must take (23-survival §6). */
export function hqBlockers(state: GameState): Unit[] {
  const me = state.players[state.currentPlayer];
  return enemyHqs(state).flatMap((p) => {
    const unit = unitAt(state, p);
    return unit && state.players[unit.owner]?.side !== me?.side ? [unit] : [];
  });
}

/** Whether this unit's weapons can damage that one at all (03-combat §5). */
const canHit = (attacker: Unit, target: Unit) => baseDamage(attacker.type, target.type) !== null;

/** The squares a Carrier can be on within CARRIER_STATION of an enemy HQ. */
export function carrierStation(state: GameState, carrier: Unit): Point[] {
  const hqs = enemyHqs(state);
  const out: Point[] = [];
  for (const hq of hqs) {
    for (let y = hq.y - CARRIER_STATION; y <= hq.y + CARRIER_STATION; y++) {
      for (let x = hq.x - CARRIER_STATION; x <= hq.x + CARRIER_STATION; x++) {
        if (x < 0 || y < 0 || x >= state.map.width || y >= state.map.height) continue;
        if (Math.abs(x - hq.x) + Math.abs(y - hq.y) > CARRIER_STATION) continue;
        const terrain = terrainAt(state.map, { x, y });
        if (stats.moveCost(state, carrier, terrain) !== null && !out.some((p) => p.x === x && p.y === y)) out.push({ x, y });
      }
    }
  }
  return out;
}

export function survivalPlan(name: string): MapPlan {
  /** Whether a movement type can walk from a square to an HQ: terrain only changes with bridges. */
  const cache = new Map<string, boolean>();
  return {
    name,

    goals(state, unit) {
      // Carriers take station off the HQ, so their aircraft are always within reach of it.
      if (isCarrier(unit.type)) {
        const station = carrierStation(state, unit);
        return station.length > 0 ? station : null;
      }
      // Something parked on the HQ that this unit can hit: go for it, whatever kind of unit it is.
      const blocking = hqBlockers(state).filter((b) => canHit(unit, b) && b.owner !== unit.owner);
      if (blocking.length > 0) return blocking.map((b) => b.pos);
      const def = UNITS[unit.type];
      if (def.category !== "land" || def.transport) return null;
      if (!def.canCapture && def.primaryWeapon === null) return null;
      const targets = enemyHqs(state).filter((p) => {
        const k = `${def.movementType}|${key(unit.pos)}|${key(p)}`;
        let ok = cache.get(k);
        if (ok === undefined) {
          ok = reachable(state, unit, p);
          cache.set(k, ok);
        }
        return ok;
      });
      return targets.length > 0 ? targets : null;
    },

    keepOff(state, unit) {
      return UNITS[unit.type].canCapture ? [] : enemyHqs(state).filter((p) => propertyAt(state, p) !== undefined);
    },

    attackBonus(state, attacker: Unit, target: Unit) {
      const onHq = enemyHqs(state).some((p) => p.x === target.pos.x && p.y === target.pos.y);
      const blocker = onHq ? HQ_BLOCKER_BONUS : 0;
      if (UNITS[attacker.type].category !== "air") return blocker;
      return blocker + (AIR_DEFENCE.includes(target.type) || UNITS[target.type].category === "air" ? AIR_DEFENCE_BONUS : 0);
    },
  };
}

/** An attack on an enemy on or next to our own HQ is worth this much more; on one capturing it, twice that. */
export const HQ_DEFENCE_BONUS = 15000;

/** How close to our HQ an enemy land unit has to be before our land units turn back for it. */
export const HQ_ALARM_RANGE = 4;

/** Our own HQs: what the defender must keep (23-survival §6). */
function ownHqs(state: GameState): Point[] {
  const me = state.players[state.currentPlayer];
  return state.properties.flatMap((p) => (p.owner !== null && state.players[p.owner]?.side === me?.side && terrainAt(state.map, p.pos) === "hq" ? [p.pos] : []));
}

const steps = (a: Point, b: Point) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

/**
 * The defender's plan on a survival map, for when the computer plays it, as self-play does to tune
 * the waves (23-survival §6, §8): keep the HQ. Enemies on or next to it draw every attack that can
 * reach them, most of all one capturing it; when an enemy land unit is within a few squares of it,
 * our armed land units turn back for it. Everything else is Greedy as usual.
 */
export function survivalDefencePlan(name: string): MapPlan {
  return {
    name,

    goals(state, unit) {
      const def = UNITS[unit.type];
      if (def.category !== "land" || def.transport || def.primaryWeapon === null && def.secondaryWeapon === null) return null;
      const me = state.players[state.currentPlayer];
      const hqs = ownHqs(state);
      const threats = state.units.filter(
        (u) => state.players[u.owner]?.side !== me?.side && UNITS[u.type].category === "land" && hqs.some((hq) => steps(hq, u.pos) <= HQ_ALARM_RANGE) && baseDamage(unit.type, u.type) !== null,
      );
      return threats.length > 0 ? threats.map((u) => u.pos) : null;
    },

    attackBonus(state, _attacker, target) {
      const hqs = ownHqs(state);
      const capturing = state.properties.some((p) => p.capturingUnit === target.id && hqs.some((hq) => hq.x === p.pos.x && hq.y === p.pos.y));
      if (capturing) return 2 * HQ_DEFENCE_BONUS;
      return hqs.some((hq) => steps(hq, target.pos) <= 1) ? HQ_DEFENCE_BONUS : 0;
    },
  };
}
