// The Battle of Britain's map AI for Germany (22-campaign §6c): Sea Lion as planned. First the
// Luftwaffe breaks the Royal Navy and the radar while the barges wait in port; then the invasion
// goes over together and drives on Dover and Hawkinge. Germany knows only what it sees and what it
// has sunk (22-campaign §6).

import { distance, propertyDefAt, type GameState, type Unit, type UnitTypeId } from "../../engine";
import { isLandingCraft } from "../greedyBase";
import type { MapPlan } from "../mapPlan";
import { objectivePlan, objectivesToTake } from "./objectives";

/** Royal Navy warships to sink before the barges sail (of 5 Destroyers and a Torpedo Boat). */
export const SHIPS_TO_SINK = 5;

/** The day the invasion sails whatever the Navy has left: the season is running out (day 15 ends it). */
export const LAST_SAILING_DAY = 9;

/** An attack on a warship or a radar station before the invasion is worth this much more, in funds. */
export const AIR_WAR_BONUS = 8000;

/** In the invasion, an attack on a unit this close to an objective is worth this much more. */
export const BEACHHEAD_BONUS = 6000;

const WARSHIPS: readonly UnitTypeId[] = ["destroyer", "torpedoBoat", "battleship", "submarine"];

export type SeaLionPhase = "airWar" | "invasion";

const isEnemy = (state: GameState, owner: number) => state.players[owner]?.side !== state.players[state.currentPlayer]?.side;

/** Enemy warships sunk so far: public, since Germany sank them (04-economy §8a). */
function shipsSunk(state: GameState): number {
  return state.players.filter((p) => isEnemy(state, p.id)).reduce((n, p) => n + WARSHIPS.reduce((m, t) => m + (p.unitsLost[t] ?? 0), 0), 0);
}

export function seaLionPhase(state: GameState): SeaLionPhase {
  return shipsSunk(state) >= SHIPS_TO_SINK || state.day >= LAST_SAILING_DAY ? "invasion" : "airWar";
}

export function battleOfBritainPlan(): MapPlan {
  const drive = objectivePlan("Sea Lion plan");
  const ownPorts = (state: GameState) =>
    state.properties.filter((p) => p.owner === state.currentPlayer && propertyDefAt(state, p.pos)?.builds === "naval").map((p) => p.pos);
  return {
    name: "Sea Lion plan",

    attackBonus(state, _attacker, target) {
      if (!isEnemy(state, target.owner)) return 0;
      if (seaLionPhase(state) === "airWar") return WARSHIPS.includes(target.type) || target.type === "radarStation" ? AIR_WAR_BONUS : 0;
      return objectivesToTake(state).some((p) => distance(p, target.pos) <= 3) ? BEACHHEAD_BONUS : 0;
    },

    goals(state, unit: Unit) {
      if (seaLionPhase(state) === "invasion") return drive.goals?.(state, unit) ?? null;
      // The barges wait in port, loaded, until the Channel is clear.
      if (isLandingCraft(unit.type)) {
        const ports = ownPorts(state);
        const nearest = ports.reduce<(typeof ports)[number] | null>((best, p) => (!best || distance(unit.pos, p) < distance(unit.pos, best) ? p : best), null);
        return nearest ? [nearest] : null;
      }
      return null;
    },

    keepOff(state, unit) {
      return drive.keepOff?.(state, unit) ?? [];
    },
  };
}
