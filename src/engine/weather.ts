// Weather (docs/12-weather.md). The day's weather comes from the scenario's forecast and the day
// number, and works only through the modifier layer: it adds to terrain movement costs.

import { TERRAIN, TERRAIN_IDS, type MovementType, type TerrainId } from "./data/terrain";
import { WEATHER, WEATHER_IDS, type WeatherId } from "./data/weather";
import type { Modifier } from "./modifiers";
import type { GameState, WeatherPlan } from "./state";

/** The weather on a day: the forecast's last entry starting on or before it (12-weather §4). */
export function weatherOn(state: Pick<GameState, "weather" | "day">, day: number = state.day): WeatherId {
  let weather: WeatherId = "clear";
  for (const entry of state.weather.forecast) if (entry.fromDay <= day) weather = entry.weather;
  return weather;
}

/** A modifier that turns a clear-weather cost into this weather's cost, so other modifiers still stack on top. */
function costChange(weather: WeatherId, terrain: TerrainId, movementType: MovementType, cost: number): Modifier | null {
  const base = TERRAIN[terrain].moveCost[movementType];
  if (base === null || base === cost) return null;
  return {
    source: `weather:${weather}`,
    stat: "moveCost",
    op: "add",
    value: cost - base,
    scope: { terrain: [terrain], movementTypes: [movementType] },
  };
}

function buildModifiers(weather: WeatherId): readonly Modifier[] {
  const def = WEATHER[weather];
  const out: Modifier[] = [];
  const moveCost: Partial<Record<TerrainId, Partial<Record<MovementType, number>>>> = def.moveCost;
  for (const terrain of TERRAIN_IDS) {
    for (const [movementType, cost] of Object.entries(moveCost[terrain] ?? {}) as [MovementType, number][]) {
      const m = costChange(weather, terrain, movementType, cost);
      if (m) out.push(m);
    }
    if (def.airMoveCost !== null) {
      const m = costChange(weather, terrain, "air", def.airMoveCost);
      if (m) out.push(m);
    }
  }
  return out;
}

// The modifiers only depend on the weather type, so they're worked out once.
const MODIFIERS = Object.fromEntries(WEATHER_IDS.map((id) => [id, buildModifiers(id)])) as Record<WeatherId, readonly Modifier[]>;

/** Modifiers from today's weather. */
export function weatherModifiers(state: Pick<GameState, "weather" | "day">): readonly Modifier[] {
  return MODIFIERS[weatherOn(state)];
}

/** Why a weather plan is invalid, or null if it's fine (12-weather §6). */
export function weatherPlanProblem(plan: WeatherPlan): string | null {
  const [first] = plan.forecast;
  if (!first) return "the forecast needs at least one entry";
  if (first.fromDay !== 1) return "the forecast must start on day 1";
  for (let i = 1; i < plan.forecast.length; i++) {
    const prev = plan.forecast[i - 1];
    const entry = plan.forecast[i];
    if (prev && entry && !(entry.fromDay > prev.fromDay)) return "forecast start days must rise";
  }
  if (plan.forecast.some((e) => !Number.isInteger(e.fromDay))) return "forecast start days must be whole numbers";
  return null;
}
