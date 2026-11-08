// The airborne drop scene (08-art-pipeline §20): a Transport Aircraft unloading soldiers is drawn as a
// static-line jump. The plane crosses the sky, the men jump one after another, their chutes snap open,
// they drift down and land. Worked out from the engine's unload event; pure data, tested.

import type { GameEvent } from "../../engine/commands";
import type { NationId } from "../../engine/data/nations";
import type { TerrainId } from "../../engine/data/terrain";
import { FOOT_UNITS, type UnitTypeId } from "../../engine/data/units";
import { terrainAt } from "../../engine/map";
import { displayHp, type GameState, type PlayerId, type Unit } from "../../engine/state";
import { soldierCount, type StormUnit } from "./storm";

export interface DropPlan {
  readonly unit: StormUnit;
  readonly owner: PlayerId;
  readonly nation: NationId | null;
  /** Displayed HP (1–10). */
  readonly hp: number;
  /** US Infantry jumping is drawn as 101st Airborne paratroopers, as it is on the map once landed. */
  readonly paratrooper: boolean;
  readonly suit: number;
  /** Where they land. */
  readonly terrain: TerrainId;
}

const isFoot = (type: UnitTypeId): type is StormUnit => (FOOT_UNITS as readonly UnitTypeId[]).includes(type);

/** The scene for a passenger leaving a Transport Aircraft; null for any other unload. */
export function planDrop(state: GameState, event: Extract<GameEvent, { type: "unitUnloaded" }>): DropPlan | null {
  const transport = state.units.find((u) => u.id === event.transportId);
  if (!transport || transport.type !== "transportAircraft") return null;
  const passenger: Unit | undefined = transport.cargo.find((c) => c.id === event.unitId);
  if (!passenger || !isFoot(passenger.type)) return null;
  const nation = state.players[passenger.owner]?.nation ?? null;
  return {
    unit: passenger.type,
    owner: passenger.owner,
    nation,
    hp: displayHp(passenger.hp),
    // The engine marks the unit air-dropped as it lands; the map then draws US Infantry as paratroopers.
    paratrooper: passenger.type === "infantry" && nation === "us",
    suit: passenger.id % 4,
    terrain: terrainAt(state.map, event.pos),
  };
}

export const DROP_MS = { intro: 400, cross: 2800, gap: 170, freefall: 170, open: 260, descend: 1700, settle: 1000, outro: 300 } as const;

/** Where the plane flies: in from the left edge, out past the right. */
export const PLANE = { y: 50, from: -70, to: 460 } as const;
/** The door is this far behind the plane's middle; men go when it passes this point. */
export const DOOR_OFFSET = -22;
const FIRST_JUMP_X = 64;

/** The plane's middle at time t. */
export function planeX(t: number): number {
  const u = (t - DROP_MS.intro) / DROP_MS.cross;
  return PLANE.from + (PLANE.to - PLANE.from) * u;
}

/** When each man jumps and lands: one after another as the door passes over the drop zone. */
export function jumpTimes(plan: DropPlan): { readonly exit: number; readonly land: number }[] {
  const speed = (PLANE.to - PLANE.from) / DROP_MS.cross;
  const firstExit = DROP_MS.intro + (FIRST_JUMP_X - DOOR_OFFSET - PLANE.from) / speed;
  return Array.from({ length: soldierCount(plan.unit, plan.hp) }, (_, i) => {
    const exit = firstExit + i * DROP_MS.gap;
    return { exit, land: exit + DROP_MS.freefall + DROP_MS.open + DROP_MS.descend };
  });
}

export function dropLength(plan: DropPlan): { settled: number; total: number } {
  const lastLanding = Math.max(...jumpTimes(plan).map((j) => j.land), DROP_MS.intro + DROP_MS.cross);
  const settled = lastLanding + DROP_MS.settle;
  return { settled, total: settled + DROP_MS.outro };
}
