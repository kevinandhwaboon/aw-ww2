// Major Bridges: blowing and rebuilding them (02-terrain §4a). Used both by apply() and by the UI
// for menus, so what the menus offer is exactly what the engine accepts.

import type { GameEvent } from "./commands";
import { terrainDef, type TerrainId } from "./data/terrain";
import { unitDef } from "./data/units";
import { terrainAt, type Point } from "./map";
import { tileIndex } from "./movement";
import { displayHp, type BridgeWork, type GameState, type Unit } from "./state";

const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

function setTerrain(state: GameState, pos: Point, terrain: TerrainId): GameState {
  const index = tileIndex(state, pos);
  return { ...state, map: { ...state.map, terrain: state.map.terrain.map((t, i) => (i === index ? terrain : t)) } };
}

/** Why this unit can't blow a bridge where it stands, or null if it can. */
export function blowProblem(state: GameState, unit: Unit): string | null {
  if (!unitDef(unit.type).specialActions.includes("demolish")) return "only Assault Infantry carries demolition charges";
  if (!terrainDef(terrainAt(state.map, unit.pos)).demolition) return "there's no bridge here that can be blown";
  return null;
}

/** Blows the bridge under the unit (validated by the caller). */
export function applyBlow(state: GameState, unit: Unit): { state: GameState; event: GameEvent } {
  const demolition = terrainDef(terrainAt(state.map, unit.pos)).demolition;
  if (!demolition) throw new Error(`No bridge to blow at (${unit.pos.x}, ${unit.pos.y})`);
  return { state: setTerrain(state, unit.pos, demolition.becomes), event: { type: "bridgeBlown", unitId: unit.id, pos: unit.pos } };
}

/** Why this unit can't work on rebuilding a bridge where it stands, or null if it can. */
export function rebuildProblem(state: GameState, unit: Unit): string | null {
  if (!unitDef(unit.type).specialActions.includes("demolish")) return "only Assault Infantry can rebuild a bridge";
  if (!terrainDef(terrainAt(state.map, unit.pos)).rebuild) return "there's no blown bridge here";
  return null;
}

/** The rebuild work on this tile, if any. */
export function bridgeWorkAt(state: GameState, pos: Point): BridgeWork | undefined {
  return state.bridgeWorks.find((w) => samePoint(w.pos, pos));
}

/** One rebuild action, like a capture: subtracts the unit's displayed HP from the points left (validated by the caller). */
export function applyRebuild(state: GameState, unit: Unit): { state: GameState; event: GameEvent } {
  const rebuild = terrainDef(terrainAt(state.map, unit.pos)).rebuild;
  if (!rebuild) throw new Error(`No blown bridge at (${unit.pos.x}, ${unit.pos.y})`);
  const work = bridgeWorkAt(state, unit.pos);
  const points = (work?.points ?? rebuild.points) - displayHp(unit.hp);
  const others = state.bridgeWorks.filter((w) => w !== work);
  if (points <= 0) {
    return {
      state: { ...setTerrain(state, unit.pos, rebuild.becomes), bridgeWorks: others },
      event: { type: "bridgeRebuilt", unitId: unit.id, pos: unit.pos },
    };
  }
  return {
    state: { ...state, bridgeWorks: [...others, { pos: unit.pos, points, unit: unit.id }] },
    event: { type: "bridgeRebuildProgress", unitId: unit.id, pos: unit.pos, points },
  };
}

/** Drops rebuild work whose unit has left the tile or been destroyed: progress is lost (02-terrain §4a). */
export function clearAbandonedBridgeWork(state: GameState): GameState {
  const kept = state.bridgeWorks.filter((w) => {
    const unit = state.units.find((u) => u.id === w.unit);
    return unit !== undefined && samePoint(unit.pos, w.pos);
  });
  return kept.length === state.bridgeWorks.length ? state : { ...state, bridgeWorks: kept };
}
