// "Drive on the objective" (22-campaign §6b): a simple map plan for maps where the computer has to
// take a place to win and the standard AI fights whatever is nearest instead. Its land units head for
// the objectives their side must capture, and its other units keep off those squares so the
// capturers can get on. It knows only the map and the victory conditions, which every player knows.

import { propertyAt, stats, terrainAt, UNITS, type GameState, type Point, type Unit } from "../../engine";
import type { MapPlan } from "../mapPlan";

const key = (p: Point) => `${p.x},${p.y}`;

/** The objectives the current player's side still has to capture or hold, and doesn't own yet. */
export function objectivesToTake(state: GameState): Point[] {
  const me = state.players[state.currentPlayer];
  if (!me) return [];
  return state.victoryConditions.flatMap((c) => {
    if ((c.type !== "captureProperties" && c.type !== "holdProperties") || c.side !== me.side) return [];
    return c.properties.filter((p) => {
      const owner = propertyAt(state, p)?.owner ?? null;
      return owner === null || state.players[owner]?.side !== me.side;
    });
  });
}

/** Whether a unit like this could get from where it is to the square over the terrain, ignoring other units. */
function reachable(state: GameState, unit: Unit, to: Point): boolean {
  const { width, height } = state.map;
  const seen = new Uint8Array(width * height);
  const stack: Point[] = [unit.pos];
  seen[unit.pos.y * width + unit.pos.x] = 1;
  for (let p = stack.pop(); p; p = stack.pop()) {
    if (p.x === to.x && p.y === to.y) return true;
    for (const q of [{ x: p.x + 1, y: p.y }, { x: p.x - 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x, y: p.y - 1 }]) {
      if (q.x < 0 || q.y < 0 || q.x >= width || q.y >= height || seen[q.y * width + q.x]) continue;
      seen[q.y * width + q.x] = 1;
      if (stats.moveCost(state, unit, terrainAt(state.map, q)) !== null) stack.push(q);
    }
  }
  return false;
}

export function objectivePlan(name: string): MapPlan {
  /** Whether a movement type can walk to an objective from a square, kept for the game: terrain only changes with bridges. */
  const cache = new Map<string, boolean>();
  return {
    name,

    goals(state, unit) {
      const def = UNITS[unit.type];
      if (def.category !== "land" || def.transport) return null;
      if (!def.canCapture && def.primaryWeapon === null) return null;
      const targets = objectivesToTake(state).filter((p) => {
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
      // Only a unit that can capture should stand on an objective: anything else blocks the capture.
      return UNITS[unit.type].canCapture ? [] : objectivesToTake(state);
    },
  };
}
