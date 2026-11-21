// The attacker's plan on a survival map (23-survival §6): drive on the defender's HQ. Land units,
// fighting or capturing, head for the enemy HQ they can walk to, and units that can't capture keep off
// it so the capturers can get on; Landing Craft land them with Greedy's own landing plan (09-ai §4b).
// Aircraft go first for what keeps the defender in the air: Flak Guns, Mobile AA and its aircraft.
// It knows only what any attacker would: the map, its own units and what it sees.

import { propertyAt, terrainAt, UNITS, type GameState, type Point, type Unit, type UnitTypeId } from "../../engine";
import type { MapPlan } from "../mapPlan";
import { reachable } from "./objectives";

/** An aircraft's attack on one of these is worth this much more, in funds (23-survival §6). */
export const AIR_DEFENCE_BONUS = 6000;

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

export function survivalPlan(name: string): MapPlan {
  /** Whether a movement type can walk from a square to an HQ: terrain only changes with bridges. */
  const cache = new Map<string, boolean>();
  return {
    name,

    goals(state, unit) {
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

    attackBonus(_state, attacker: Unit, target: Unit) {
      if (UNITS[attacker.type].category !== "air") return 0;
      return AIR_DEFENCE.includes(target.type) || UNITS[target.type].category === "air" ? AIR_DEFENCE_BONUS : 0;
    },
  };
}
