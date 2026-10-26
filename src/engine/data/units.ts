// Unit data, from docs/01-units.md section 8 (provisional v0 stats) and section 9 (schema).
// Pure data: balancing is an edit here. All values are read through the modifier layer (engine/stats.ts).

import type { MovementType } from "./terrain";

export const UNIT_TYPE_IDS = [
  // Land (phase 1 MVP)
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack",
  "lightTank", "mediumTank", "heavyTank", "tankDestroyer",
  "artillery", "rocketArtillery", "mobileAA",
  // Land (phase 2)
  "flakGun",
  // Air (phase 2)
  "fighter", "bomber", "transportAircraft",
  // Naval (phase 2)
  "battleship", "destroyer", "submarine", "landingCraft", "torpedoBoat",
] as const;
export type UnitTypeId = (typeof UNIT_TYPE_IDS)[number];

export type UnitCategory = "land" | "air" | "naval";
export type SpecialAction = "resupply" | "airDrop" | "dive" | "unloadOnBeach";

export interface UnitDef {
  readonly name: string;
  readonly category: UnitCategory;
  /** Roadmap phase the unit arrives in (00-master-design §4). */
  readonly phase: 1 | 2;
  readonly cost: number;
  readonly movePoints: number;
  readonly movementType: MovementType;
  readonly vision: number;
  readonly maxFuel: number;
  /** Fuel burned at the start of each of the owner's turns (air and naval only). */
  readonly fuelPerDay: number;
  /** Uses ammo. null = no primary weapon. */
  readonly primaryWeapon: { readonly name: string; readonly maxAmmo: number } | null;
  /** Unlimited ammo. null = no secondary weapon. */
  readonly secondaryWeapon: { readonly name: string } | null;
  /** Attack range in tiles; null = unarmed. Direct fire is 1–1. */
  readonly range: { readonly min: number; readonly max: number } | null;
  /** false for indirect-fire units: they can't move and attack in the same turn. */
  readonly canMoveAndFire: boolean;
  readonly canCapture: boolean;
  readonly transport: { readonly capacity: number; readonly carries: readonly UnitTypeId[] } | null;
  readonly specialActions: readonly SpecialAction[];
}

/** Units that Halftracks and Transport Aircraft can carry (01-units §5). */
export const FOOT_UNITS = ["infantry", "assaultInfantry", "mortar"] as const satisfies readonly UnitTypeId[];

/** Everything a Landing Craft can carry: any land unit (01-units §5). */
export const LAND_UNITS = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack",
  "lightTank", "mediumTank", "heavyTank", "tankDestroyer",
  "artillery", "rocketArtillery", "mobileAA", "flakGun",
] as const satisfies readonly UnitTypeId[];

const DIRECT = { min: 1, max: 1 } as const;

/** Defaults shared by most units; each entry overrides what differs. */
const BASE = {
  phase: 1,
  fuelPerDay: 0,
  primaryWeapon: null,
  secondaryWeapon: null,
  range: DIRECT,
  canMoveAndFire: true,
  canCapture: false,
  transport: null,
  specialActions: [],
} as const;

export const UNITS = {
  // ---- Land, phase 1 ----
  infantry: {
    ...BASE, name: "Infantry", category: "land", cost: 1000, movePoints: 3, movementType: "foot",
    vision: 2, maxFuel: 99, secondaryWeapon: { name: "Rifle/MG" }, canCapture: true,
  },
  assaultInfantry: {
    ...BASE, name: "Assault Infantry", category: "land", cost: 3000, movePoints: 2, movementType: "heavyFoot",
    vision: 2, maxFuel: 70, primaryWeapon: { name: "Bazooka", maxAmmo: 3 }, secondaryWeapon: { name: "MG" },
    canCapture: true,
  },
  mortar: {
    ...BASE, name: "Mortar Team", category: "land", cost: 3000, movePoints: 2, movementType: "heavyFoot",
    vision: 2, maxFuel: 70, primaryWeapon: { name: "Mortar", maxAmmo: 3 }, range: { min: 2, max: 2 },
    canMoveAndFire: false,
  },
  recon: {
    ...BASE, name: "Recon", category: "land", cost: 4000, movePoints: 8, movementType: "wheels",
    vision: 5, maxFuel: 80, secondaryWeapon: { name: "MG" },
  },
  halftrack: {
    ...BASE, name: "Halftrack", category: "land", cost: 5000, movePoints: 6, movementType: "tracks",
    vision: 1, maxFuel: 70, range: null, transport: { capacity: 1, carries: FOOT_UNITS },
    specialActions: ["resupply"],
  },
  lightTank: {
    ...BASE, name: "Light Tank", category: "land", cost: 6000, movePoints: 7, movementType: "tracks",
    vision: 3, maxFuel: 70, primaryWeapon: { name: "Gun", maxAmmo: 9 }, secondaryWeapon: { name: "MG" },
  },
  mediumTank: {
    ...BASE, name: "Medium Tank", category: "land", cost: 8000, movePoints: 6, movementType: "tracks",
    vision: 2, maxFuel: 70, primaryWeapon: { name: "Gun", maxAmmo: 9 }, secondaryWeapon: { name: "MG" },
  },
  heavyTank: {
    ...BASE, name: "Heavy Tank", category: "land", cost: 15000, movePoints: 4, movementType: "tracks",
    vision: 1, maxFuel: 50, primaryWeapon: { name: "Gun", maxAmmo: 8 }, secondaryWeapon: { name: "MG" },
  },
  tankDestroyer: {
    ...BASE, name: "Tank Destroyer", category: "land", cost: 9000, movePoints: 5, movementType: "tracks",
    vision: 2, maxFuel: 60, primaryWeapon: { name: "AT gun", maxAmmo: 6 },
  },
  artillery: {
    ...BASE, name: "Artillery", category: "land", cost: 6000, movePoints: 5, movementType: "tracks",
    vision: 1, maxFuel: 50, primaryWeapon: { name: "Howitzer", maxAmmo: 9 }, range: { min: 2, max: 3 },
    canMoveAndFire: false,
  },
  rocketArtillery: {
    ...BASE, name: "Rocket Artillery", category: "land", cost: 14000, movePoints: 5, movementType: "wheels",
    vision: 1, maxFuel: 50, primaryWeapon: { name: "Rockets", maxAmmo: 5 }, range: { min: 3, max: 5 },
    canMoveAndFire: false,
  },
  mobileAA: {
    ...BASE, name: "Mobile AA", category: "land", cost: 8000, movePoints: 6, movementType: "tracks",
    vision: 2, maxFuel: 60, primaryWeapon: { name: "AA guns", maxAmmo: 9 },
  },

  // ---- Land, phase 2 ----
  flakGun: {
    ...BASE, phase: 2, name: "Flak Gun", category: "land", cost: 11000, movePoints: 3, movementType: "tracks",
    vision: 2, maxFuel: 50, primaryWeapon: { name: "Flak", maxAmmo: 6 }, range: { min: 3, max: 5 },
    canMoveAndFire: false,
  },

  // ---- Air, phase 2 ----
  fighter: {
    ...BASE, phase: 2, name: "Fighter", category: "air", cost: 20000, movePoints: 9, movementType: "air",
    vision: 2, maxFuel: 99, fuelPerDay: 5, primaryWeapon: { name: "Guns", maxAmmo: 9 },
  },
  bomber: {
    ...BASE, phase: 2, name: "Bomber", category: "air", cost: 22000, movePoints: 7, movementType: "air",
    vision: 2, maxFuel: 99, fuelPerDay: 5, primaryWeapon: { name: "Bombs", maxAmmo: 9 },
  },
  transportAircraft: {
    ...BASE, phase: 2, name: "Transport Aircraft", category: "air", cost: 10000, movePoints: 8,
    movementType: "air", vision: 2, maxFuel: 99, fuelPerDay: 4, range: null,
    transport: { capacity: 2, carries: FOOT_UNITS }, specialActions: ["airDrop"],
  },

  // ---- Naval, phase 2 ----
  battleship: {
    ...BASE, phase: 2, name: "Battleship", category: "naval", cost: 28000, movePoints: 5, movementType: "sea",
    vision: 2, maxFuel: 99, fuelPerDay: 1, primaryWeapon: { name: "Main guns", maxAmmo: 9 },
    range: { min: 2, max: 6 }, canMoveAndFire: false,
  },
  destroyer: {
    ...BASE, phase: 2, name: "Destroyer", category: "naval", cost: 16000, movePoints: 6, movementType: "sea",
    vision: 3, maxFuel: 99, fuelPerDay: 1, primaryWeapon: { name: "Guns/depth charges", maxAmmo: 9 },
    secondaryWeapon: { name: "AA guns" },
  },
  submarine: {
    // Burns 5 fuel/day instead of 1 while submerged (05-supply-transport §1).
    ...BASE, phase: 2, name: "Submarine", category: "naval", cost: 20000, movePoints: 5, movementType: "sea",
    vision: 5, maxFuel: 60, fuelPerDay: 1, primaryWeapon: { name: "Torpedoes", maxAmmo: 6 },
    specialActions: ["dive"],
  },
  landingCraft: {
    ...BASE, phase: 2, name: "Landing Craft", category: "naval", cost: 12000, movePoints: 6,
    movementType: "landingCraft", vision: 1, maxFuel: 99, fuelPerDay: 1, range: null,
    transport: { capacity: 2, carries: LAND_UNITS }, specialActions: ["unloadOnBeach"],
  },
  torpedoBoat: {
    ...BASE, phase: 2, name: "Torpedo Boat", category: "naval", cost: 8000, movePoints: 7, movementType: "sea",
    vision: 3, maxFuel: 60, fuelPerDay: 1, primaryWeapon: { name: "Torpedoes", maxAmmo: 4 },
    secondaryWeapon: { name: "MG" },
  },
} as const satisfies Record<UnitTypeId, UnitDef>;

export function unitDef(type: UnitTypeId): UnitDef {
  return UNITS[type];
}
