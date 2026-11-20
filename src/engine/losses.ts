// Each player's tally of units lost, by type, for the results screen (04-economy §8a).
// Counted from a command's events, so every way a unit can die is listed in one place.

import type { GameEvent } from "./commands";
import type { UnitTypeId } from "./data/units";
import type { GameState, PlayerId, Unit, UnitId } from "./state";

function findUnit(units: readonly Unit[], id: UnitId): Unit | undefined {
  for (const unit of units) {
    if (unit.id === id) return unit;
    const inside = findUnit(unit.cargo, id);
    if (inside) return inside;
  }
  return undefined;
}

/** A unit and everything it carries, since passengers die with their transport (05-supply-transport §4). */
const withCargo = (unit: Unit): Unit[] => [unit, ...unit.cargo.flatMap(withCargo)];

/**
 * Adds the units a command destroyed to their owners' tallies: units killed in combat and aircraft
 * that crashed, each with its passengers. Units removed because their player was defeated weren't
 * destroyed, and a unit merged into another by a join wasn't either.
 */
export function recordLosses(before: GameState, after: GameState, events: readonly GameEvent[]): GameState {
  const dead: { readonly type: UnitTypeId; readonly owner: PlayerId }[] = [];
  const add = (id: UnitId, type: UnitTypeId, owner: PlayerId) => {
    const unit = findUnit(before.units, id);
    dead.push(...(unit ? withCargo(unit) : [{ type, owner }]));
  };
  for (const event of events) {
    if (event.type === "combat") {
      if (event.attacker.destroyed) add(event.attacker.unitId, event.attacker.type, event.attacker.owner);
      if (event.defender.destroyed) add(event.defender.unitId, event.defender.type, event.defender.owner);
    } else if (event.type === "unitOutOfFuel") {
      add(event.unitId, event.unitType, event.owner);
    }
  }
  if (dead.length === 0) return after;
  return {
    ...after,
    players: after.players.map((player) => {
      const mine = dead.filter((u) => u.owner === player.id);
      if (mine.length === 0) return player;
      const unitsLost: Partial<Record<UnitTypeId, number>> = { ...player.unitsLost };
      for (const { type } of mine) unitsLost[type] = (unitsLost[type] ?? 0) + 1;
      return { ...player, unitsLost };
    }),
  };
}
