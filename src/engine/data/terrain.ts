// Terrain data, from docs/02-terrain.md sections 2–4. Pure data: balancing is an edit here.

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

export interface TerrainDef {
  readonly name: string;
  readonly defenseStars: number;
  readonly moveCost: MoveCosts;
  readonly isProperty: boolean;
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
  plains: { name: "Plains", defenseStars: 1, moveCost: costs(1, 1, 2, 1, 1, _, _), isProperty: false },
  road: { name: "Road", defenseStars: 0, moveCost: costs(1, 1, 1, 1, 1, _, _), isProperty: false },
  bridge: { name: "Bridge", defenseStars: 0, moveCost: costs(1, 1, 1, 1, 1, _, _), isProperty: false },
  forest: { name: "Forest", defenseStars: 2, moveCost: costs(1, 1, 3, 2, 1, _, _), isProperty: false },
  hills: { name: "Hills", defenseStars: 4, moveCost: costs(2, 1, _, _, 1, _, _), isProperty: false },
  river: { name: "River", defenseStars: 0, moveCost: costs(2, 1, _, _, 1, _, _), isProperty: false },
  bocage: { name: "Bocage", defenseStars: 3, moveCost: costs(1, 1, _, 3, 1, _, _), isProperty: false },
  sea: { name: "Sea", defenseStars: 0, moveCost: costs(_, _, _, _, 1, 1, 1), isProperty: false },
  beach: { name: "Beach", defenseStars: 0, moveCost: costs(1, 1, 1, 1, 1, _, 1), isProperty: false },
  reef: { name: "Reef", defenseStars: 1, moveCost: costs(_, _, _, _, 1, 2, 2), isProperty: false },
  city: { name: "City", defenseStars: 3, moveCost: LAND_PROPERTY, isProperty: true },
  factory: { name: "Factory", defenseStars: 3, moveCost: LAND_PROPERTY, isProperty: true },
  airfield: { name: "Airfield", defenseStars: 3, moveCost: LAND_PROPERTY, isProperty: true },
  port: { name: "Port", defenseStars: 3, moveCost: costs(1, 1, 1, 1, 1, 1, 1), isProperty: true },
  hq: { name: "HQ", defenseStars: 4, moveCost: LAND_PROPERTY, isProperty: true },
  bunker: {
    name: "Bunker",
    defenseStars: 5,
    moveCost: costs(1, 1, 1, 1, 1, _, _),
    isProperty: false,
    breakable: { hp: 100, becomes: "rubble" },
  },
  rubble: { name: "Rubble", defenseStars: 1, moveCost: costs(1, 1, 2, 1, 1, _, _), isProperty: false },
  obstacle: {
    name: "Obstacle",
    defenseStars: 0,
    moveCost: costs(_, _, _, _, 1, _, _),
    isProperty: false,
    breakable: { hp: 100, becomes: "plains" },
  },
} as const satisfies Record<TerrainId, TerrainDef>;

export function terrainDef(id: TerrainId): TerrainDef {
  return TERRAIN[id];
}
