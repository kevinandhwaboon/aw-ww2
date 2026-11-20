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
  // 02-terrain §4c: the Railway Gun. Enters Railway squares only.
  "rail",
] as const;
export type MovementType = (typeof MOVEMENT_TYPES)[number];

export const TERRAIN_IDS = [
  "plains", "road", "bridge", "forest", "hills", "river", "bocage", "sea", "beach", "reef",
  "city", "factory", "airfield", "port", "hq",
  "bunker", "rubble", "obstacle",
  "majorBridge", "blownBridge",
  "minefield", "ridge", "saltMarsh",
  "railway",
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
  /** Can be blown by a unit with the "demolish" action standing on it, leaving `becomes` (02-terrain §4a). */
  readonly demolition?: { readonly becomes: TerrainId };
  /**
   * Can be rebuilt by a unit with the "demolish" action standing on it: like a capture, it adds its
   * displayed HP each time until it reaches `points`, then the tile becomes `becomes` (02-terrain §4a).
   */
  readonly rebuild?: { readonly points: number; readonly becomes: TerrainId };
  /**
   * In fog of war, a unit here is seen only by a side with a unit right next to it; aircraft are
   * never hidden (19-fog-of-war §3).
   */
  readonly hidesUnits?: true;
  /** Extra vision for units of these movement types standing here (19-fog-of-war §2). */
  readonly visionBonus?: { readonly movementTypes: readonly MovementType[]; readonly add: number };
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
  rail: number | null = null,
): MoveCosts => ({ foot, heavyFoot, wheels, tracks, air, sea, landingCraft, rail });

const LAND_PROPERTY = costs(1, 1, 1, 1, 1, _, _);

export const TERRAIN = {
  plains: { name: "Plains", defenseStars: 1, moveCost: costs(1, 1, 2, 1, 1, _, _) },
  road: { name: "Road", defenseStars: 0, moveCost: costs(1, 1, 1, 1, 1, _, _) },
  bridge: { name: "Bridge", defenseStars: 0, moveCost: costs(1, 1, 1, 1, 1, _, _) },
  forest: { name: "Forest", defenseStars: 2, moveCost: costs(1, 1, 3, 2, 1, _, _), hidesUnits: true },
  hills: {
    name: "Hills",
    defenseStars: 4,
    moveCost: costs(2, 1, _, _, 1, _, _),
    visionBonus: { movementTypes: ["foot", "heavyFoot"], add: 3 },
  },
  river: { name: "River", defenseStars: 0, moveCost: costs(2, 1, _, _, 1, _, _) },
  bocage: { name: "Bocage", defenseStars: 3, moveCost: costs(1, 1, _, 3, 1, _, _), hidesUnits: true },
  sea: { name: "Sea", defenseStars: 0, moveCost: costs(_, _, _, _, 1, 1, 1) },
  beach: { name: "Beach", defenseStars: 0, moveCost: costs(1, 1, 1, 1, 1, _, 1) },
  reef: { name: "Reef", defenseStars: 1, moveCost: costs(_, _, _, _, 1, 2, 2), hidesUnits: true },
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
  // 02-terrain §4a: a bridge that can be blown and rebuilt. Moves like Bridge; blown, it moves like River.
  majorBridge: { name: "Major Bridge", defenseStars: 0, moveCost: costs(1, 1, 1, 1, 1, _, _), demolition: { becomes: "blownBridge" } },
  blownBridge: {
    name: "Blown Bridge",
    defenseStars: 0,
    moveCost: costs(2, 1, _, _, 1, _, _),
    rebuild: { points: 20, becomes: "majorBridge" },
  },
  // 02-terrain §4b: desert terrain for El Alamein. A Minefield has the Obstacle's rules; a Ridge has
  // Forest's numbers but doesn't hide units (19-fog-of-war §3); the Salt Marsh (the Qattara Depression) is impassable to every land unit.
  minefield: {
    name: "Minefield",
    defenseStars: 0,
    moveCost: costs(_, _, _, _, 1, _, _),
    breakable: { hp: 100, becomes: "plains" },
  },
  ridge: { name: "Ridge", defenseStars: 2, moveCost: costs(1, 1, 3, 2, 1, _, _) },
  saltMarsh: { name: "Salt Marsh", defenseStars: 0, moveCost: costs(_, _, _, _, 1, _, _) },
  // 02-terrain §4c: a railway line. A Road for everyone else (and its own bridge over a river); the
  // only terrain a rail unit can enter.
  railway: { name: "Railway", defenseStars: 0, moveCost: costs(1, 1, 1, 1, 1, _, _, 1) },
} as const satisfies Record<TerrainId, TerrainDef>;

export function terrainDef(id: TerrainId): TerrainDef {
  return TERRAIN[id];
}
