// Weather data, from docs/12-weather.md. Pure data: balancing is an edit here.

import type { MovementType, TerrainId } from "./terrain";

export const WEATHER_IDS = ["clear", "snow"] as const;
export type WeatherId = (typeof WEATHER_IDS)[number];

/** Whether the map is drawn snowy. Art only: no rule reads it (12-weather §1). */
export const SEASONS = ["summer", "winter"] as const;
export type Season = (typeof SEASONS)[number];

/** Movement points to enter a tile in this weather, only where it differs from 02-terrain §3. */
export type WeatherMoveCosts = Readonly<Partial<Record<TerrainId, Readonly<Partial<Record<MovementType, number>>>>>>;

export interface WeatherDef {
  readonly name: string;
  /** Movement types not listed for a terrain keep their clear-weather cost. */
  readonly moveCost: WeatherMoveCosts;
  /** Cost for air units to enter any tile, or null to leave air movement alone. */
  readonly airMoveCost: number | null;
}

export const WEATHER = {
  clear: { name: "Clear", moveCost: {}, airMoveCost: null },
  // 12-weather §3: the original game's snow table, mapped onto this game's movement types.
  snow: {
    name: "Snow",
    moveCost: {
      plains: { foot: 2, wheels: 3, tracks: 2 },
      forest: { foot: 2, wheels: 4, tracks: 3 },
      hills: { foot: 4, heavyFoot: 2 },
      bocage: { foot: 2, tracks: 4 },
      rubble: { foot: 2, wheels: 3, tracks: 2 },
      sea: { sea: 2, landingCraft: 2 },
      port: { sea: 2, landingCraft: 2 },
      beach: { landingCraft: 2 },
    },
    airMoveCost: 2,
  },
} as const satisfies Record<WeatherId, WeatherDef>;
