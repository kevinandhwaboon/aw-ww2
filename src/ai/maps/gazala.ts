// Gazala's map AI for the Axis (22-campaign §6d): Rommel's sweep. The assault force goes round the
// south end of the minefield at Bir Hakeim instead of into it, then drives on Tobruk, with its
// Supply Trucks keeping up with the tanks that are lowest on fuel so the armour doesn't run dry,
// as it did for the standard AI, and Halftracks carrying their infantry round with it. It knows the map and its own units, nothing hidden (22-campaign §6).

import { distance, stats, type GameState, type Point, type Unit } from "../../engine";
import { defOf, isSupplyTruck } from "../greedyBase";
import type { MapPlan } from "../mapPlan";
import { objectivePlan } from "./objectives";

/** Past the south end of the minefield, south-east of Bir Hakeim: where the sweep turns north. */
export const SWEEP_POINT: Point = { x: 21, y: 28 };

/** The minefield line runs down column 12 to 17; a unit east of this has gone round it. */
export const LINE_EAST = 18;

/** Units south of this row and west of the line are the assault force; the rest hold the line. */
export const ASSAULT_SOUTH_OF = 18;

/** A Supply Truck goes to the vehicles below this share of a full tank first. */
const LOW_FUEL = 0.5;

const isVehicle = (unit: Unit) => {
  const def = defOf(unit.type);
  return (def.movementType === "tracks" || def.movementType === "wheels") && !def.specialActions.includes("resupply");
};

/** Whether this unit is round the line already, or is part of the assault force that should go round. */
function inTheSweep(unit: Unit): "round" | "going" | null {
  if (unit.pos.x >= LINE_EAST) return "round";
  return unit.pos.y >= ASSAULT_SOUTH_OF ? "going" : null;
}

export function gazalaPlan(): MapPlan {
  const drive = objectivePlan("Tobruk plan");
  return {
    name: "Rommel's sweep",

    goals(state: GameState, unit: Unit) {
      const def = defOf(unit.type);
      if (def.category !== "land") return null;
      // A Supply Truck keeps up with the armour in the sweep, the thirstiest first. Out of supplies,
      // the standard plan sends it back to a property to refill (09-ai §4j).
      if (isSupplyTruck(unit.type)) {
        if (unit.ammo <= 0) return null;
        const armour = state.units.filter((u) => u.owner === unit.owner && u.id !== unit.id && isVehicle(u) && inTheSweep(u) !== null);
        if (armour.length === 0) return null;
        const share = (u: Unit) => u.fuel / Math.max(1, stats.maxFuel(state, u));
        const thirsty = armour.filter((u) => share(u) < LOW_FUEL);
        const near = (thirsty.length > 0 ? thirsty : armour).sort((a, b) => distance(unit.pos, a.pos) - distance(unit.pos, b.pos)).slice(0, 3);
        return near.map((u) => u.pos);
      }
      const where = inTheSweep(unit);
      if (where === "going") return [SWEEP_POINT];
      if (where !== "round") return null;
      // A loaded Halftrack round the line carries its infantry on to the objective.
      if (def.transport && unit.cargo.length > 0) {
        const passenger = unit.cargo[0];
        return passenger ? (drive.goals?.(state, { ...passenger, pos: unit.pos }) ?? null) : null;
      }
      return drive.goals?.(state, unit) ?? null;
    },

    keepOff(state, unit) {
      return drive.keepOff?.(state, unit) ?? [];
    },
  };
}
