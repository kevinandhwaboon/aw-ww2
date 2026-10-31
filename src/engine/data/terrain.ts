// Terrain data, from docs/02-terrain.md sections 2–4. Pure data: balancing is an edit here.

import type { UnitCategory } from "./units";

export const MOVEMENT_TYPES = [
  "foot",
  "heavyFoot",
  "wheels",
  "tracks",
  "air",
  "sea",
  "landingCraft",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const TERRAIN_IDS = [
  "plains", "road", "bridge", "forest", "hills", "river", "bocage", "sea", "beach", "reef",
  "city", "factory", "airfield", "port", "hq",
  "bunker", "rubble", "obstacle",
] as const;
export type TerrainId = (typeof TERRAIN_IDS)[number];

/** Movement points to enter the tile; null = impassable. */
export type MoveCosts = Readonly<Record<MovementType, number | null>>;

export interface PropertyDef {
  /** Unit category built here; null if nothing can be built. */
  readonly builds: UnitCategory | null;
  /** Unit category repaired and resupplied here. */
  readonly repairs: UnitCategory;
}

export interface TerrainDef {
  readonly name: string;
  readonly defenseStars: number;
  readonly moveCost: MoveCosts;
  /** Set for properties: what they build and which unit categories they repair (04-economy §1). */
  readonly property?: PropertyDef;
  /** Fortifications/obstacles: internal HP (0–100) and the terrain left at 0 HP. */
  readonly breakable?: { readonly hp: number; readonly becomes: TerrainId };
}

const _ = null;
const costs = (
  foot: number | null,
  heavyFoot: number | null,
  wheels: number | null,
  tracks: number | null,
  air: number | null,
  sea: number | null,
  landingCraft: number | null,
): MoveCosts => ({ foot, heavyFoot, wheels, tracks, air, sea, landingCraft });

const LAND_PROPERTY = costs(1, 1, 1, 1, 1, _, _);

export const TERRAIN = {
  plains: { name: "Plains", defenseStars: 1, moveCost: costs(1, 1, 2, 1, 1, _, _) },
  road: { name: "Road", defenseStars: 0, moveCost: costs(1, 1, 1, 1, 1, _, _) },
  bridge: { name: "Bridge", defenseStars: 0, moveCost: costs(1, 1, 1, 1, 1, _, _) },
  forest: { name: "Forest", defenseStars: 2, moveCost: costs(1, 1, 3, 2, 1, _, _) },
  hills: { name: "Hills", defenseStars: 4, moveCost: costs(2, 1, _, _, 1, _, _) },
  river: { name: "River", defenseStars: 0, moveCost: costs(2, 1, _, _, 1, _, _) },
  bocage: { name: "Bocage", defenseStars: 3, moveCost: costs(1, 1, _, 3, 1, _, _) },
  sea: { name: "Sea", defenseStars: 0, moveCost: costs(_, _, _, _, 1, 1, 1) },
  beach: { name: "Beach", defenseStars: 0, moveCost: costs(1, 1, 1, 1, 1, _, 1) },
  reef: { name: "Reef", defenseStars: 1, moveCost: costs(_, _, _, _, 1, 2, 2) },
  city: { name: "City", defenseStars: 3, moveCost: LAND_PROPERTY, property: { builds: null, repairs: "land" } },
  factory: { name: "Factory", defenseStars: 3, moveCost: LAND_PROPERTY, property: { builds: "land", repairs: "land" } },
  airfield: { name: "Airfield", defenseStars: 3, moveCost: LAND_PROPERTY, property: { builds: "air", repairs: "air" } },
  port: { name: "Port", defenseStars: 3, moveCost: costs(1, 1, 1, 1, 1, 1, 1), property: { builds: "naval", repairs: "naval" } },
  hq: { name: "HQ", defenseStars: 4, moveCost: LAND_PROPERTY, property: { builds: null, repairs: "land" } },
  bunker: {
    name: "Bunker",
    defenseStars: 5,
    moveCost: costs(1, 1, 1, 1, 1, _, _),
    breakable: { hp: 100, becomes: "rubble" },
  },
  rubble: { name: "Rubble", defenseStars: 1, moveCost: costs(1, 1, 2, 1, 1, _, _) },
  obstacle: {
    name: "Obstacle",
    defenseStars: 0,
    moveCost: costs(_, _, _, _, 1, _, _),
    breakable: { hp: 100, becomes: "plains" },
  },
} as const satisfies Record<TerrainId, TerrainDef>;

export function terrainDef(id: TerrainId): TerrainDef {
  return TERRAIN[id];
}
