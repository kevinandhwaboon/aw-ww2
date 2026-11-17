// Weather data, from docs/12-weather.md. Pure data: balancing is an edit here.

import type { MovementType, TerrainId } from "./terrain";

export const WEATHER_IDS = ["clear", "snow", "rain"] as const;
export type WeatherId = (typeof WEATHER_IDS)[number];

/** Whether the map is drawn snowy, or as desert (08-art-pipeline §21). Art only: no rule reads it (12-weather §1). */
export const SEASONS = ["summer", "winter", "desert"] as const;
export type Season = (typeof SEASONS)[number];

/** Movement points to enter a tile in this weather, only where it differs from 02-terrain §3. */
export type WeatherMoveCosts = Readonly<Partial<Record<TerrainId, Readonly<Partial<Record<MovementType, number>>>>>>;

export interface WeatherDef {
  readonly name: string;
  /** Movement types not listed for a terrain keep their clear-weather cost. */
  readonly moveCost: WeatherMoveCosts;
  /** Cost for air units to enter any tile, or null to leave air movement alone. */
  readonly airMoveCost: number | null;
  /** Added to every unit's vision (12-weather §3a). */
  readonly vision: number;
  /** Fog of war for the day, even in a game without it (12-weather §3a, 19-fog-of-war). */
  readonly fog: boolean;
}

export const WEATHER = {
  clear: { name: "Clear", moveCost: {}, airMoveCost: null, vision: 0, fog: false },
  // 12-weather §3: the original game's snow table, mapped onto this game's movement types.
  snow: {
    name: "Snow",
    moveCost: {
      plains: { foot: 2, wheels: 3, tracks: 2 },
      forest: { foot: 2, wheels: 4, tracks: 3 },
      ridge: { foot: 2, wheels: 4, tracks: 3 }, // Forest's, as its clear costs are (02-terrain §4b)
      hills: { foot: 4, heavyFoot: 2 },
      bocage: { foot: 2, tracks: 4 },
      rubble: { foot: 2, wheels: 3, tracks: 2 },
      sea: { sea: 2, landingCraft: 2 },
      port: { sea: 2, landingCraft: 2 },
      beach: { landingCraft: 2 },
    },
    airMoveCost: 2,
    vision: 0,
    fog: false,
  },
  // 12-weather §3a: the original game's rain. Mud slows wheels and tracks on Plains and Forest (and
  // the terrain that moves like them, as for snow); foot soldiers, aircraft and ships are unaffected.
  // It brings fog of war, and every unit sees 1 square less.
  rain: {
    name: "Rain",
    moveCost: {
      plains: { wheels: 3, tracks: 2 },
      forest: { wheels: 4, tracks: 3 },
      ridge: { wheels: 4, tracks: 3 },
      bocage: { tracks: 4 },
      rubble: { wheels: 3, tracks: 2 },
    },
    airMoveCost: null,
    vision: -1,
    fog: true,
  },
} as const satisfies Record<WeatherId, WeatherDef>;
