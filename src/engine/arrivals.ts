// Units that arrive during the game, and raiders that go home (23-survival §5a, §5c). Waves in
// Survival are arrivals, but any scenario can use them for reinforcements.

import type { GameEvent } from "./commands";
import { UNITS, type UnitDef } from "./data/units";
import { clearAbandonedCaptures, servicesUnit } from "./economy";
import { inBounds, type GameMap, type Point } from "./map";
import { tileIndex } from "./movement";
import { MAX_HP, unitAt, type Arrival, type ArrivingUnit, type GameState, type PlayerId, type Unit } from "./state";
import * as stats from "./stats";

/** Why this arrival can't be in a scenario, or null if it can. */
export function arrivalProblem(arrival: Arrival, map: GameMap, playerCount: number): string | null {
  const { day, player, wave, zone, units } = arrival;
  if (!Number.isInteger(day) || day < 1) return `"day" must be day 1 or later`;
  if (!Number.isInteger(player) || player < 0 || player >= playerCount) return `unknown player ${player}`;
  if (wave !== undefined && (!Number.isInteger(wave) || wave < 1)) return `"wave" must be 1 or more`;
  if (zone.length === 0) return "list at least one square in the zone";
  const outside = zone.find((p) => !inBounds(map, p));
  if (outside) return `(${outside.x}, ${outside.y}) is outside the map`;
  if (units.length === 0) return "list at least one unit";
  for (const unit of units) {
    const problem = unitProblem(unit);
    if (problem) return problem;
  }
  return null;
}

/** Why this arriving unit can't be in a scenario, or null if it can. */
export function unitProblem(unit: ArrivingUnit): string | null {
  const transport: UnitDef["transport"] = UNITS[unit.type].transport;
  const hp = unit.hp ?? MAX_HP;
  if (!Number.isInteger(hp) || hp < 1 || hp > MAX_HP) return `${unit.type} has invalid HP ${hp}`;
  const { sortieTurns } = unit;
  if (sortieTurns !== undefined && (!Number.isInteger(sortieTurns) || sortieTurns < 1)) return `${unit.type}: "sortieTurns" must be 1 or more`;
  const aboard = unit.cargo ?? [];
  if (aboard.length > (transport?.capacity ?? 0)) return `${unit.type} can't carry ${aboard.length} units`;
  for (const passenger of aboard) {
    if (!transport?.carries.includes(passenger.type)) return `${unit.type} can't carry a ${passenger.type}`;
    const problem = unitProblem(passenger);
    if (problem) return problem;
  }
  return null;
}

/** How many units a player has, passengers included, as the unit cap counts them (04-economy §4). */
const fielded = (state: GameState, player: PlayerId) =>
  state.units.filter((u) => u.owner === player).reduce((n, u) => n + 1 + u.cargo.length, 0);

const size = (unit: ArrivingUnit) => 1 + (unit.cargo?.length ?? 0);

/** The unit as it enters the map: full unless the scenario says less, and done for this turn. */
function makeUnit(state: GameState, setup: ArrivingUnit, owner: PlayerId, pos: Point, nextId: () => number): Unit {
  const id = nextId();
  const cargo = (setup.cargo ?? []).map((c) => makeUnit(state, c, owner, pos, nextId));
  const base: Unit = {
    id,
    type: setup.type,
    owner,
    pos,
    hp: setup.hp ?? MAX_HP,
    fuel: 0,
    ammo: 0,
    kills: setup.kills ?? 0,
    hasActed: true,
    cargo,
    ...(setup.sortieTurns === undefined ? {} : { sortie: setup.sortieTurns }),
  };
  const fuel = stats.maxFuel(state, base);
  const ammo = stats.maxAmmo(state, base);
  return { ...base, fuel: Math.min(setup.fuel ?? fuel, fuel), ammo: Math.min(setup.ammo ?? ammo, ammo) };
}

/** A square a unit could stand on: empty, and terrain it can enter. Aircraft fly over anything. */
function canArriveOn(state: GameState, unit: ArrivingUnit, pos: Point, owner: PlayerId): boolean {
  if (unitAt(state, pos)) return false;
  const terrain = state.map.terrain[tileIndex(state, pos)];
  const probe: Unit = { id: -1, type: unit.type, owner, pos, hp: MAX_HP, fuel: 0, ammo: 0, kills: 0, hasActed: true, cargo: [] };
  return terrain !== undefined && stats.moveCost(state, probe, terrain) !== null;
}

/**
 * At the start of the current player's turn, after it has readied its units: everything due for this
 * player by today comes onto the map, each unit on the first free square of its zone that it can
 * stand on, within the unit cap. What finds no room waits for this player's next turn. Arriving units
 * can't act until then, like a unit just built (23-survival §5a).
 */
export function arriveUnits(state: GameState, events: GameEvent[]): GameState {
  const player = state.currentPlayer;
  if (!state.arrivals.some((a) => a.player === player && a.day <= state.day)) return state;
  let current = state;
  let nextUnitId = state.nextUnitId;
  const nextId = () => nextUnitId++;
  const arrivals: Arrival[] = [];
  for (const arrival of state.arrivals) {
    if (arrival.player !== player || arrival.day > state.day) {
      arrivals.push(arrival);
      continue;
    }
    const waiting: ArrivingUnit[] = [];
    const placed: Unit[] = [];
    for (const setup of arrival.units) {
      // The game's unit cap, and the arrival's own if it has one (23-survival §4).
      const caps = [current.settings.unitCap, arrival.unitCap ?? null].filter((c) => c !== null);
      const cap = caps.length > 0 ? Math.min(...caps) : null;
      const pos = arrival.zone.find((p) => canArriveOn(current, setup, p, player));
      if (!pos || (cap !== null && fielded(current, player) + size(setup) > cap)) {
        waiting.push(setup);
        continue;
      }
      const unit = makeUnit(current, setup, player, pos, nextId);
      placed.push(unit);
      current = { ...current, units: [...current.units, unit] };
    }
    if (waiting.length > 0) arrivals.push({ ...arrival, units: waiting });
    if (placed.length === 0) continue;
    events.push({
      type: "unitsArrived",
      player,
      day: state.day,
      ...(arrival.wave === undefined ? {} : { wave: arrival.wave }),
      ...(arrival.name === undefined ? {} : { name: arrival.name }),
      units: placed.map((u) => ({ unitId: u.id, unitType: u.type, pos: u.pos })),
    });
    if (arrival.wave !== undefined && arrival.wave > current.wave) current = { ...current, wave: arrival.wave };
  }
  return {
    ...current,
    arrivals,
    nextUnitId,
    players: current.players.map((p) => (p.id === player && !p.hasFielded && fielded(current, player) > 0 ? { ...p, hasFielded: true } : p)),
  };
}

/**
 * At the very start of the current player's turn: raiders that have used up their turns go home,
 * with whatever they carry, and the rest count one turn down. A raider on a property of its side
 * that services it has found a base, and stays like any unit. Going home isn't a loss (23-survival §5c).
 */
export function sendRaidersHome(state: GameState, events: GameEvent[]): GameState {
  const player = state.currentPlayer;
  if (!state.units.some((u) => u.owner === player && u.sortie !== undefined)) return state;
  const units: Unit[] = [];
  for (const unit of state.units) {
    if (unit.owner !== player || unit.sortie === undefined) {
      units.push(unit);
    } else if (servicesUnit(state, unit.pos, unit)) {
      units.push(withoutSortie(unit));
    } else if (unit.sortie <= 0) {
      events.push({ type: "unitLeft", unitId: unit.id, unitType: unit.type, owner: unit.owner, pos: unit.pos });
    } else {
      units.push({ ...unit, sortie: unit.sortie - 1 });
    }
  }
  return clearAbandonedCaptures({ ...state, units });
}

/** A raider that has landed somewhere it can stay (23-survival §5c). */
export function withoutSortie(unit: Unit): Unit {
  if (unit.sortie === undefined) return unit;
  const stays = { ...unit };
  delete (stays as { sortie?: number }).sortie;
  return stays;
}
