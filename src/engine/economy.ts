// Capture and production (04-economy §3–4). Used both by apply() and by the UI for menus, so what
// the menus offer is exactly what the engine accepts.

import type { GameEvent } from "./commands";
import { terrainDef, type PropertyDef } from "./data/terrain";
import { UNITS, type UnitTypeId } from "./data/units";
import type { Point } from "./map";
import { tileIndex } from "./movement";
import { CAPTURE_POINTS, displayHp, MAX_HP, propertyAt, unitAt, type GameState, type Unit } from "./state";
import * as stats from "./stats";

/** The rules for the property on this tile, if there is one. */
export function propertyDefAt(state: GameState, p: Point): PropertyDef | undefined {
  const terrain = state.map.terrain[tileIndex(state, p)];
  return terrain === undefined ? undefined : terrainDef(terrain).property;
}

/** Why this unit can't capture where it stands, or null if it can. */
export function captureProblem(state: GameState, unit: Unit): string | null {
  if (!UNITS[unit.type].canCapture) return "this unit can't capture";
  const property = propertyAt(state, unit.pos);
  if (!property) return "there is no property here";
  const owner = property.owner === null ? undefined : state.players[property.owner];
  if (owner && owner.side === state.players[unit.owner]?.side) return "it already belongs to your side";
  return null;
}

/** One capture action: subtracts the unit's displayed HP from the property's capture points. */
export function applyCapture(state: GameState, unit: Unit): { state: GameState; event: GameEvent } {
  const property = propertyAt(state, unit.pos);
  if (!property) throw new Error(`No property at (${unit.pos.x}, ${unit.pos.y})`);
  const remaining = property.capturePoints - displayHp(unit.hp);
  const captured = remaining <= 0;
  const updated = captured
    ? { ...property, owner: unit.owner, capturePoints: CAPTURE_POINTS, capturingUnit: null }
    : { ...property, capturePoints: remaining, capturingUnit: unit.id };
  return {
    state: { ...state, properties: state.properties.map((p) => (p === property ? updated : p)) },
    event: captured
      ? { type: "propertyCaptured", pos: property.pos, unitId: unit.id, player: unit.owner, previousOwner: property.owner }
      : { type: "captureProgress", pos: property.pos, unitId: unit.id, capturePoints: remaining },
  };
}

/** Resets capture progress whose capturing unit has left the tile or been destroyed (04-economy §3). */
export function clearAbandonedCaptures(state: GameState): GameState {
  const abandoned = (capturingUnit: number, pos: Point) => {
    const unit = state.units.find((u) => u.id === capturingUnit);
    return !unit || unit.pos.x !== pos.x || unit.pos.y !== pos.y;
  };
  const properties = state.properties.map((p) =>
    p.capturingUnit !== null && abandoned(p.capturingUnit, p.pos)
      ? { ...p, capturePoints: CAPTURE_POINTS, capturingUnit: null }
      : p,
  );
  return { ...state, properties };
}

export interface BuildOption {
  readonly type: UnitTypeId;
  readonly cost: number;
  readonly affordable: boolean;
}

/** Why the current player can't build this unit here, or null if they can. */
export function buildProblem(state: GameState, unitType: UnitTypeId, pos: Point): string | null {
  const player = state.players[state.currentPlayer];
  if (!player) return "there is no current player";
  const property = propertyAt(state, pos);
  if (property?.owner !== player.id) return "you don't own a property here";
  const builds = propertyDefAt(state, pos)?.builds;
  if (!builds) return "nothing can be built here";
  if (builds !== UNITS[unitType].category) return `this property builds ${builds} units`;
  if (!player.buildable.includes(unitType)) return "this unit isn't available to your nation here";
  if (unitAt(state, pos)) return "the tile is occupied";
  const cap = state.settings.unitCap;
  if (cap !== null && state.units.filter((u) => u.owner === player.id).length >= cap) return `you're at the ${cap}-unit limit`;
  if (player.funds < stats.unitCost(state, player.id, unitType)) return "you can't afford it";
  return null;
}

/** What the current player could build on this tile, cheapest first, including what they can't afford yet. */
export function buildOptions(state: GameState, pos: Point): BuildOption[] {
  const player = state.players[state.currentPlayer];
  const builds = propertyDefAt(state, pos)?.builds;
  if (!player || !builds || propertyAt(state, pos)?.owner !== player.id || unitAt(state, pos)) return [];
  return player.buildable
    .filter((type) => UNITS[type].category === builds)
    .map((type) => {
      const cost = stats.unitCost(state, player.id, type);
      return { type, cost, affordable: player.funds >= cost };
    })
    .sort((a, b) => a.cost - b.cost);
}

/** Creates the unit (validated by the caller). It can't act until its owner's next turn (04-economy §4). */
export function applyBuild(state: GameState, unitType: UnitTypeId, pos: Point): { state: GameState; event: GameEvent } {
  const player = state.currentPlayer;
  const cost = stats.unitCost(state, player, unitType);
  const draft: Unit = {
    id: state.nextUnitId,
    type: unitType,
    owner: player,
    pos,
    hp: MAX_HP,
    fuel: 0,
    ammo: 0,
    kills: 0,
    hasActed: true,
  };
  const unit = { ...draft, fuel: stats.maxFuel(state, draft), ammo: stats.maxAmmo(state, draft) };
  return {
    state: {
      ...state,
      units: [...state.units, unit],
      nextUnitId: state.nextUnitId + 1,
      players: state.players.map((p) => (p.id === player ? { ...p, funds: p.funds - cost } : p)),
    },
    event: { type: "unitBuilt", unitId: unit.id, unitType, owner: player, pos, cost },
  };
}
