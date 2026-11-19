// Where each built-in map happened, for the map select's world map (00-master-design §12): the
// theater it's filed under, the dot on the world map, and the one unit its preview shows in a battle
// scene. Presentation data only; nothing here is read by a rule.

import type { NationId } from "../engine/data/nations";
import type { TerrainId } from "../engine/data/terrain";
import type { UnitTypeId } from "../engine/data/units";
import type { FigureKind } from "../game/battle/plan";

export const THEATER_IDS = ["westernEurope", "easternFront", "northAfrica", "pacific"] as const;
export type TheaterId = (typeof THEATER_IDS)[number];

/**
 * A part of the world map, in degrees: longitude west to east (may run past 180 for the Pacific),
 * latitude north to south. Every view is 2.4 times as wide as it is tall, the shape of the map.
 */
export interface MapView {
  readonly west: number;
  readonly north: number;
  readonly width: number;
}

export const VIEW_ASPECT = 2.4;
export const viewHeight = (view: MapView): number => view.width / VIEW_ASPECT;

/** Where a longitude/latitude falls on the map, as a fraction of its width and height (may be outside 0–1). */
export function project(view: MapView, lon: number, lat: number): { x: number; y: number } {
  return { x: (lon - view.west) / view.width, y: (view.north - lat) / viewHeight(view) };
}

/** A view part of the way from a to b, zooming evenly (by scale, not width) as it goes. */
export function between(a: MapView, b: MapView, t: number): MapView {
  const width = a.width * Math.pow(b.width / a.width, t);
  // The center moves so that it keeps pace with the zoom: fast while zoomed out, slow when close.
  const k = a.width === b.width ? t : (a.width - width) / (a.width - b.width);
  const centerX = a.west + a.width / 2 + (b.west + b.width / 2 - (a.west + a.width / 2)) * k;
  const centerY = a.north - viewHeight(a) / 2 + (b.north - viewHeight(b) / 2 - (a.north - viewHeight(a) / 2)) * k;
  return { west: centerX - width / 2, north: centerY + width / VIEW_ASPECT / 2, width };
}

export interface Theater {
  readonly id: TheaterId;
  readonly name: string;
  readonly view: MapView;
}

/** The whole world, centered on the Old World and the Pacific so no battle sits on the seam. */
export const WORLD_VIEW: MapView = { west: -30, north: 80, width: 360 };

export const THEATERS: Readonly<Record<TheaterId, Theater>> = {
  westernEurope: { id: "westernEurope", name: "Western Europe", view: { west: -12, north: 57, width: 30 } },
  easternFront: { id: "easternFront", name: "Eastern Front", view: { west: 14, north: 62, width: 48 } },
  northAfrica: { id: "northAfrica", name: "North Africa", view: { west: 4, north: 41.5, width: 36 } },
  pacific: { id: "pacific", name: "Pacific", view: { west: 110, north: 35, width: 120 } },
};

/** One side of the preview's battle scene. */
export interface ShotSide {
  readonly kind: FigureKind;
  /** Null for a fortification. */
  readonly nation: NationId | null;
  readonly terrain: TerrainId;
  /** Drawn as paratroopers (US or UK Infantry only). */
  readonly paratrooper?: boolean;
}

/**
 * The preview's moving picture: a battle scene (08-art-pipeline §18) or an airborne drop (§20),
 * cropped to the part that shows the featured unit. `crop` is x, y, width, height in scene pixels
 * (the scene is 384×240), and its shape is the preview's letterbox shape.
 */
export type FeatureShot =
  | {
      readonly kind: "battle";
      readonly attacker: ShotSide;
      readonly defender: ShotSide;
      readonly weapon: "primary" | "secondary";
      /** The defender fires back with this weapon, or doesn't. */
      readonly counter: "primary" | "secondary" | null;
      readonly crop: readonly [number, number, number, number];
    }
  | {
      readonly kind: "drop";
      readonly nation: NationId;
      readonly unit: Extract<UnitTypeId, "infantry" | "mortar">;
      readonly terrain: TerrainId;
      readonly crop: readonly [number, number, number, number];
    };

export interface BattlePlace {
  readonly theater: TheaterId;
  /** Where on Earth, in degrees east and north (the Pacific may run past 180). */
  readonly lon: number;
  readonly lat: number;
  /** Where and when, as the preview shows it. */
  readonly where: string;
  readonly when: string;
  /** Which side of its dot the name goes, when it would cover a neighbor's (default right). */
  readonly label?: "left" | "below";
  /** The unit the map is about, in words, under the preview. */
  readonly feature: string;
  readonly shot: FeatureShot;
}

/** Keyed by scenario id. Every built-in map has one (a test checks). */
export const BATTLE_PLACES: Readonly<Record<string, BattlePlace>> = {
  normandy: {
    theater: "westernEurope",
    lon: -0.8,
    lat: 49.4,
    where: "Normandy, France",
    label: "left",
    when: "June 1944",
    feature: "Landing Craft",
    shot: {
      kind: "battle",
      attacker: { kind: "artillery", nation: "germany", terrain: "hills" },
      defender: { kind: "landingCraft", nation: "us", terrain: "beach" },
      weapon: "primary",
      counter: null,
      crop: [192, 140, 192, 80],
    },
  },
  "market-garden": {
    theater: "westernEurope",
    lon: 5.9,
    lat: 52.0,
    where: "Arnhem, the Netherlands",
    when: "September 1944",
    feature: "Paratroopers",
    shot: { kind: "drop", nation: "uk", unit: "infantry", terrain: "plains", crop: [72, 24, 240, 100] },
  },
  bastogne: {
    theater: "westernEurope",
    lon: 5.7,
    lat: 50.0,
    where: "Bastogne, Belgium",
    label: "below",
    when: "December 1944",
    feature: "Heavy Tanks in the snow",
    shot: {
      kind: "battle",
      attacker: { kind: "heavyTank", nation: "germany", terrain: "road" },
      defender: { kind: "infantry", nation: "us", terrain: "forest" },
      weapon: "primary",
      counter: null,
      crop: [0, 136, 192, 80],
    },
  },
  "battle-of-britain": {
    theater: "westernEurope",
    lon: 0.6,
    lat: 51.2,
    where: "South-east England",
    label: "left",
    when: "August 1940",
    feature: "Bombers against the radar",
    shot: {
      kind: "battle",
      attacker: { kind: "bomber", nation: "germany", terrain: "plains" },
      defender: { kind: "radarStation", nation: "uk", terrain: "plains" },
      weapon: "primary",
      counter: null,
      crop: [0, 40, 384, 160],
    },
  },
  stalingrad: {
    theater: "easternFront",
    lon: 44.5,
    lat: 48.7,
    where: "Stalingrad, Soviet Union",
    when: "November 1942",
    feature: "Boats across the Volga",
    shot: {
      kind: "battle",
      attacker: { kind: "artillery", nation: "germany", terrain: "city" },
      defender: { kind: "landingCraft", nation: "ussr", terrain: "beach" },
      weapon: "primary",
      counter: null,
      crop: [192, 140, 192, 80],
    },
  },
  kursk: {
    theater: "easternFront",
    lon: 36.2,
    lat: 51.7,
    where: "Kursk, Soviet Union",
    when: "July 1943",
    feature: "Tank against tank",
    shot: {
      kind: "battle",
      attacker: { kind: "mediumTank", nation: "ussr", terrain: "plains" },
      defender: { kind: "heavyTank", nation: "germany", terrain: "plains" },
      weapon: "primary",
      counter: "primary",
      crop: [0, 136, 192, 80],
    },
  },
  "el-alamein": {
    theater: "northAfrica",
    lon: 28.9,
    lat: 30.8,
    where: "El Alamein, Egypt",
    when: "October 1942",
    feature: "Sappers in the minefields",
    shot: {
      kind: "battle",
      attacker: { kind: "assaultInfantry", nation: "uk", terrain: "plains" },
      defender: { kind: "minefield", nation: null, terrain: "minefield" },
      weapon: "primary",
      counter: null,
      crop: [0, 136, 192, 80],
    },
  },
  "iwo-jima": {
    theater: "pacific",
    lon: 141.3,
    lat: 24.8,
    where: "Iwo Jima, Japan",
    when: "February 1945",
    feature: "Assault Infantry against bunkers",
    shot: {
      kind: "battle",
      attacker: { kind: "assaultInfantry", nation: "us", terrain: "beach" },
      defender: { kind: "bunker", nation: null, terrain: "bunker" },
      weapon: "primary",
      counter: null,
      crop: [0, 136, 192, 80],
    },
  },
  midway: {
    theater: "pacific",
    lon: 182.6,
    lat: 28.2,
    where: "Midway Atoll",
    when: "June 1942",
    feature: "Carriers",
    shot: {
      kind: "battle",
      attacker: { kind: "diveBomber", nation: "us", terrain: "sea" },
      defender: { kind: "carrier", nation: "japan", terrain: "sea" },
      weapon: "primary",
      counter: "secondary",
      crop: [192, 140, 192, 80],
    },
  },
  guadalcanal: {
    theater: "pacific",
    lon: 160.0,
    lat: -9.4,
    where: "Guadalcanal, Solomon Islands",
    when: "October 1942",
    feature: "Battleships shelling the airfield",
    shot: {
      kind: "battle",
      attacker: { kind: "battleship", nation: "japan", terrain: "sea" },
      defender: { kind: "infantry", nation: "us", terrain: "airfield" },
      weapon: "primary",
      counter: null,
      crop: [0, 140, 192, 80],
    },
  },
  "the-slot": {
    theater: "pacific",
    lon: 157.3,
    lat: -7.6,
    where: "The Solomons (an invented campaign)",
    label: "left",
    when: "1943",
    feature: "Destroyers in the Slot",
    shot: {
      kind: "battle",
      attacker: { kind: "destroyer", nation: "us", terrain: "sea" },
      defender: { kind: "destroyer", nation: "japan", terrain: "sea" },
      weapon: "primary",
      counter: "primary",
      crop: [0, 140, 192, 80],
    },
  },
};
