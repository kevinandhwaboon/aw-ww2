// Transport, supply, joining and Carrier launches (05-supply-transport §3–4, §6, §8, §10, 04-economy §6). Used both by apply() and
// by the UI for menus, so what the menus offer is exactly what the engine accepts.
//
// Passengers live inside their transport (`cargo`), not in GameState.units. So they can't be
// targeted, aren't repaired, and are destroyed with the transport without counting as kills.

import type { GameEvent } from "./commands";
import { unitDef } from "./data/units";
import { inBounds, terrainAt, type Point } from "./map";
import { tileIndex } from "./movement";
import { displayHp, propertyAt, unitAt, type GameState, type Unit } from "./state";
import * as stats from "./stats";
import { isHiddenFrom } from "./visibility";

const NEIGHBORS: readonly Point[] = [
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

const neighborsOf = (state: GameState, p: Point): Point[] =>
  NEIGHBORS.map((n) => ({ x: p.x + n.x, y: p.y + n.y })).filter((q) => inBounds(state.map, q));

function replaceUnits(state: GameState, remove: Unit, keep: Unit): GameState {
  return { ...state, units: state.units.filter((u) => u.id !== remove.id).map((u) => (u.id === keep.id ? keep : u)) };
}

/**
 * Why a Landing Craft can't take units on or off where it stands, or null if it can: it has to be on
 * a Beach, or on a Port that isn't the enemy's (05-supply-transport §8). Other transports can anywhere.
 */
function landingSpotProblem(state: GameState, transport: Unit): string | null {
  if (!unitDef(transport.type).specialActions.includes("unloadOnBeach")) return null;
  const terrain = terrainAt(state.map, transport.pos);
  const owner = propertyAt(state, transport.pos)?.owner ?? null;
  if (terrain === "beach" || (terrain === "port" && (owner === null || owner === transport.owner))) return null;
  return "a Landing Craft loads and unloads only on a Beach or a friendly or neutral Port";
}

/** Transport Aircraft take passengers on only at their owner's airfield, though they drop anywhere (05-supply-transport §6). */
function airfieldProblem(state: GameState, transport: Unit): string | null {
  if (!unitDef(transport.type).specialActions.includes("airDrop")) return null;
  const onOwnAirfield = terrainAt(state.map, transport.pos) === "airfield" && propertyAt(state, transport.pos)?.owner === transport.owner;
  return onOwnAirfield ? null : "units board a Transport Aircraft only at your own airfield";
}

/** Why this unit can't board that transport, or null if it can. */
export function loadProblem(state: GameState, unit: Unit, transport: Unit): string | null {
  const rules = unitDef(transport.type).transport;
  if (!rules) return "that unit isn't a transport";
  if (transport.owner !== unit.owner) return "you can only board your own transports";
  if (!rules.carries.includes(unit.type)) return "this unit doesn't fit in that transport";
  if (transport.cargo.length >= rules.capacity) return "the transport is full";
  if (unit.cargo.length > 0) return "a transport carrying units can't board another transport"; // D4
  return landingSpotProblem(state, transport) ?? airfieldProblem(state, transport);
}

/** Puts the moved unit inside the transport. Its action is over (05-supply-transport §4). */
export function applyLoad(state: GameState, unit: Unit, transport: Unit): { state: GameState; event: GameEvent } {
  const loaded: Unit = { ...transport, cargo: [...transport.cargo, { ...unit, pos: transport.pos, hasActed: true }] };
  return {
    state: replaceUnits(state, unit, loaded),
    event: { type: "unitLoaded", unitId: unit.id, transportId: transport.id },
  };
}

/**
 * Tiles this passenger could be unloaded onto: next to the transport, passable for it, and empty as
 * far as its player can see from `view`, the state the order is given from. Unloading onto an enemy
 * they couldn't see is an ambush (19-fog-of-war §5). Never the transport's own tile, even for an
 * aircraft, since one unit per tile still holds (02-terrain §5).
 */
export function unloadTiles(state: GameState, transport: Unit, passenger: Unit, view: GameState = state): Point[] {
  // A Carrier's aircraft launch instead (05-supply-transport §10).
  if (isCarrier(transport) || landingSpotProblem(state, transport)) return [];
  return neighborsOf(state, transport.pos).filter((p) => {
    const terrain = state.map.terrain[tileIndex(state, p)];
    const occupant = unitAt(state, p);
    const seen = occupant !== undefined && !isHiddenFrom(view, occupant, transport.owner);
    return terrain !== undefined && !seen && stats.moveCost(state, passenger, terrain) !== null;
  });
}

/** Unloads a passenger, who can't act this turn (05-supply-transport §4). */
export function applyUnload(state: GameState, transport: Unit, passenger: Unit, to: Point): { state: GameState; event: GameEvent } {
  const emptied: Unit = { ...transport, cargo: transport.cargo.filter((c) => c.id !== passenger.id) };
  const dropped = unitDef(transport.type).movementType === "air";
  const landed: Unit = { ...passenger, pos: to, hasActed: true, ...(dropped ? { airDropped: true } : {}) };
  return {
    state: { ...state, units: [...state.units.map((u) => (u.id === transport.id ? emptied : u)), landed].sort((a, b) => a.id - b.id) },
    event: { type: "unitUnloaded", unitId: passenger.id, transportId: transport.id, pos: to },
  };
}

/**
 * Whether this unit hands out a limited number of resupplies, kept in its ammo count: Supply Trucks
 * and Supply Ships (05-supply-transport §3b).
 */
export function usesSupplyLoads(unit: Unit): boolean {
  return unitDef(unit.type).supplyLoads !== null;
}

/**
 * Short of fuel or ammo, and something this supply unit can refill (05-supply-transport §3, §3a, §5):
 * a Supply Truck refills land units only, a Supply Ship land units and ships. Aircraft never: they have
 * to fly home to an airfield or Carrier. Another supply unit's loads only refill at a property (§3b), so
 * for one of those only its fuel counts.
 */
function needsSupply(state: GameState, supplier: Unit, unit: Unit): boolean {
  const category = unitDef(unit.type).category;
  if (category === "air" || (category === "naval" && unitDef(supplier.type).category !== "naval")) return false;
  return unit.fuel < stats.maxFuel(state, unit) || (!usesSupplyLoads(unit) && unit.ammo < stats.maxAmmo(state, unit));
}

/**
 * Friendly units next to this supply unit that are short of fuel or ammo: land units for a Supply Truck,
 * land units and ships for a Supply Ship, never aircraft (05-supply-transport §3, §3a). None from a
 * supply unit with no loads left (§3b).
 */
export function supplyTargets(state: GameState, supplier: Unit): Unit[] {
  if (!unitDef(supplier.type).specialActions.includes("resupply")) return [];
  if (usesSupplyLoads(supplier) && supplier.ammo <= 0) return [];
  const side = state.players[supplier.owner]?.side;
  return neighborsOf(state, supplier.pos)
    .map((p) => unitAt(state, p))
    .filter((u): u is Unit => u !== undefined && state.players[u.owner]?.side === side && needsSupply(state, supplier, u));
}

/**
 * Whether this ship lies next to one of its own player's Supply Ships, which repairs it at the start
 * of the turn (05-supply-transport §3a). Only ships, and only the Supply Ship's own player's. Repairs
 * are paid for in funds, so they don't need the Supply Ship to have loads left (§3b).
 */
export function besideSupplyShip(state: GameState, unit: Unit): boolean {
  if (unitDef(unit.type).category !== "naval") return false;
  return neighborsOf(state, unit.pos).some((p) => {
    const other = unitAt(state, p);
    return other !== undefined && other.owner === unit.owner && unitDef(other.type).specialActions.includes("repairShips");
  });
}

/**
 * The supplier refills these units' fuel and ammo (another Supply Ship's fuel only: its loads refill
 * only at a port). Free; doesn't heal. A Supply Ship spends one load on it, however many units it
 * tops up (05-supply-transport §3b).
 */
export function applySupply(state: GameState, supplier: Unit, targets: readonly Unit[]): { state: GameState; events: GameEvent[] } {
  if (targets.length === 0) return { state, events: [] };
  const ids = new Set(targets.map((t) => t.id));
  const spends = usesSupplyLoads(supplier);
  const units = state.units.map((u) => {
    if (ids.has(u.id)) return { ...u, fuel: stats.maxFuel(state, u), ammo: usesSupplyLoads(u) ? u.ammo : stats.maxAmmo(state, u) };
    return spends && u.id === supplier.id ? { ...u, ammo: Math.max(0, u.ammo - 1) } : u;
  });
  return {
    state: { ...state, units },
    events: targets.map((t) => ({ type: "unitResupplied", unitId: t.id })),
  };
}

/** Why this unit can't join that one, or null if it can (04-economy §6). */
export function joinProblem(unit: Unit, target: Unit): string | null {
  if (target.owner !== unit.owner) return "you can only join your own units";
  if (target.type !== unit.type) return "units must be the same type to join";
  if (displayHp(target.hp) >= 10) return "that unit is at full strength";
  if (unit.cargo.length > 0 || target.cargo.length > 0) return "a transport carrying units can't join";
  return null;
}

/**
 * Merges the moved unit into the target (04-economy §6, 03-combat §6): displayed HP adds up to 10,
 * excess HP is refunded, fuel and ammo add up to their maximum, and the merged unit keeps the kills
 * of whichever contributed more HP (the higher count on a tie). The result has acted this turn.
 */
export function applyJoin(state: GameState, unit: Unit, target: Unit): { state: GameState; event: GameEvent } {
  const mine = displayHp(unit.hp);
  const theirs = displayHp(target.hp);
  const total = mine + theirs;
  const kills = mine === theirs ? Math.max(unit.kills, target.kills) : mine > theirs ? unit.kills : target.kills;
  const refund = Math.max(0, total - 10) * Math.floor(stats.unitCost(state, unit.owner, unit.type) / 10);
  const merged: Unit = {
    ...target,
    hp: Math.min(10, total) * 10,
    fuel: Math.min(stats.maxFuel(state, target), unit.fuel + target.fuel),
    ammo: Math.min(stats.maxAmmo(state, target), unit.ammo + target.ammo),
    kills,
    hasActed: true,
  };
  const joined = replaceUnits(state, unit, merged);
  return {
    state: { ...joined, players: joined.players.map((p) => (p.id === unit.owner ? { ...p, funds: p.funds + refund } : p)) },
    event: { type: "unitJoined", unitId: unit.id, targetId: target.id, hp: merged.hp, refund },
  };
}

// ---- Carriers (05-supply-transport §10) ----

const isCarrier = (unit: Unit) => unitDef(unit.type).specialActions.includes("launch");

/** Aircraft aboard this Carrier that can take off now: not ones that landed this turn. */
export function launchable(carrier: Unit): Unit[] {
  return isCarrier(carrier) ? carrier.cargo.filter((c) => !c.hasActed) : [];
}

/** Why this aircraft can't take off from that Carrier now, or null if it can. */
export function launchProblem(state: GameState, carrier: Unit, passengerId: number): string | null {
  if (!isCarrier(carrier)) return "only a Carrier launches aircraft";
  if (carrier.owner !== state.currentPlayer) return "that Carrier isn't yours";
  if (carrier.hasActed) return "a Carrier that has moved this turn can't launch";
  const passenger = carrier.cargo.find((c) => c.id === passengerId);
  if (!passenger) return "that aircraft isn't aboard";
  if (passenger.hasActed) return "an aircraft that landed this turn can't take off until next turn";
  return null;
}

/**
 * The game with the aircraft out on the Carrier's tile, ready to move, and the Carrier marked as
 * launched so it can't move this turn. The aircraft is listed last, so it's drawn over the Carrier.
 * Not a legal state on its own (two units share a tile): the launch move takes the aircraft away.
 */
export function launchState(state: GameState, carrierId: number, passengerId: number): GameState | null {
  const carrier = state.units.find((u) => u.id === carrierId);
  const passenger = carrier?.cargo.find((c) => c.id === passengerId);
  if (!carrier || !passenger) return null;
  const emptied: Unit = { ...carrier, cargo: carrier.cargo.filter((c) => c.id !== passengerId), launched: true };
  const aircraft: Unit = { ...passenger, pos: carrier.pos, hasActed: false };
  return { ...state, units: [...state.units.filter((u) => u.id !== carrierId).concat(emptied).sort((a, b) => a.id - b.id), aircraft] };
}
