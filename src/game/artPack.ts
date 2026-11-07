// Art packs (08-art-pipeline §13): a folder with a pack.json that says what the game looks like.
// Every field is optional, and anything a pack leaves out falls back to the built-in look, so a
// pack can replace one unit or everything. Art never affects the rules.

import { NATIONS, type NationId } from "../engine/data/nations";
import { TERRAIN, TERRAIN_IDS, terrainDef, type TerrainId } from "../engine/data/terrain";
import { UNIT_TYPE_IDS, UNITS, type UnitTypeId } from "../engine/data/units";
import type { Unit } from "../engine/state";

const BUILT_IN_COLORS = {
  // HTML panels and screens
  uiBg: "#101018",
  uiPanel: "#f4ecd8",
  uiInk: "#2a2418",
  uiBorder: "#4a3c28",
  uiAccent: "#c84030",
  uiHighlight: "#e8c070",
  // Map overlays
  cursor: "#ffffff",
  rangeMove: "#7ec8ff",
  rangeInspect: "#ffc070",
  rangeAttack: "#ff4030",
  rangeGrid: "#ffffff",
  pathFill: "#f8f0d0",
  pathOutline: "#1a2438",
  // Canvas menus
  menuBg: "#f4ecd8",
  menuBorder: "#4a3c28",
  menuInk: "#2a2418",
  menuHighlight: "#e8c070",
  // A submerged submarine: its sprite is tinted this color, and its badge drawn in it (05-supply-transport §9)
  submerged: "#78b0f0",
  // Effects and floating labels
  flash: "#ffffff",
  blast: "#ffa030",
  labelText: "#ffffff",
  labelOutline: "#101018",
  // Shadow under unit sprites
  unitShadow: "#1c3412",
  labelGold: "#f0d040",
  labelGreen: "#80f080",
  labelBlue: "#a0d8ff",
  labelWarning: "#ffa030",
} as const;

export type ColorKey = keyof typeof BUILT_IN_COLORS;

/** How a player's units are colored, and which sheets they use. */
export interface PlayerArt {
  /** Matches a unit sheet's `team`. */
  readonly team: string;
  readonly fill: string;
  readonly outline: string;
}

/**
 * A sprite sheet of square frames: one row per unit, with idle frames running across. Frames are
 * 16 or 32 pixels; either way a unit fills one map square (08-art-pipeline §17).
 */
export interface UnitSheet {
  readonly nation: NationId;
  readonly team: string;
  /** Relative to the pack's folder. */
  readonly path: string;
  /** Idle animation frames per row. */
  readonly frames: number;
  /** The unit on each row, top to bottom; null for an empty row. */
  readonly rows: readonly (UnitTypeId | null)[];
  /** Frame width and height in pixels: 16 or 32. */
  readonly frameSize: 16 | 32;
  /** Rows for an Infantry unit dropped by a Transport Aircraft, one picked per unit (08-art-pipeline §17). */
  readonly paratroopers: readonly number[];
}

/** A sheet of 16×16 tiles, numbered left to right, top to bottom (08-art-pipeline §13–14). */
export interface TerrainSheet {
  /** Relative to the pack's folder. */
  readonly path: string;
  /** Animation frames: the sheet is this many same-layout panels stacked top to bottom. */
  readonly frames: number;
  /** 16, or 32 for art drawn for the 32-pixel grid and scaled into a square (08-art-pipeline §17). */
  readonly tileWidth: 16 | 32;
  /** The tile width, or twice it for tiles that rise into the tile behind (08-art-pipeline §16). */
  readonly tileHeight: number;
  /** Tile numbers per terrain. Several are variants, picked by map position. */
  readonly tiles: Readonly<Partial<Record<TerrainId, readonly number[]>>>;
  /** First of 16 joined pieces, in neighbor-mask order (N=1, E=2, S=4, W=8). */
  readonly connected: Readonly<Partial<Record<"road" | "river", number>>>;
  /** Bridge decks drawn over a river piece. */
  readonly bridges: { readonly horizontal: number; readonly vertical: number } | null;
  /** First of 8 shore pieces drawn over sea next to land: edges N, E, S, W, then corners NE, SE, SW, NW. */
  readonly shore?: number;
}

/** Buildings for owned properties: one row per property, one column per owner (08-art-pipeline §15). */
export interface PropertySheet {
  /** Relative to the pack's folder. */
  readonly path: string;
  /** The owner each column is for: "neutral", or a player's `team`. */
  readonly columns: readonly string[];
  /** The property on each row, top to bottom. */
  readonly rows: readonly TerrainId[];
  /** 16, or 32 for art drawn for the 32-pixel grid and scaled into a square (08-art-pipeline §17). */
  readonly tileWidth: 16 | 32;
  /** The tile width, or twice it for buildings that rise into the tile behind (08-art-pipeline §16). */
  readonly tileHeight: number;
}

export interface ArtPack {
  readonly name: string;
  readonly players: readonly PlayerArt[];
  readonly colors: Readonly<Record<ColorKey, string>>;
  readonly unitSheets: readonly UnitSheet[];
  readonly terrain: TerrainSheet | null;
  readonly properties: PropertySheet | null;
  readonly unitNames: Readonly<Partial<Record<UnitTypeId, string>>>;
  readonly terrainNames: Readonly<Partial<Record<TerrainId, string>>>;
}

/** The look when no pack loads: everything drawn in code. */
export const BUILT_IN_PACK: ArtPack = {
  name: "Built-in",
  players: [
    { team: "blue", fill: "#3a6fd8", outline: "#1a3270" },
    { team: "red", fill: "#c8463a", outline: "#5e1a14" },
    { team: "green", fill: "#4a9a40", outline: "#1e4418" },
    { team: "gold", fill: "#d8a030", outline: "#6a4a10" },
  ],
  colors: BUILT_IN_COLORS,
  unitSheets: [],
  terrain: null,
  properties: null,
  unitNames: {},
  terrainNames: {},
};

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const isHexColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
const isUnitType = (value: unknown): value is UnitTypeId => UNIT_TYPE_IDS.includes(value as UnitTypeId);
const isTerrain = (value: unknown): value is TerrainId => TERRAIN_IDS.includes(value as TerrainId);

/** Packs load files from their own folder. Web addresses and absolute paths aren't allowed. */
const isRelativePath = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && !value.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(value);

const fail = (message: string): never => {
  throw new Error(message);
};

function parsePlayers(raw: unknown): PlayerArt[] {
  if (!Array.isArray(raw) || raw.length === 0) return fail(`"players" must be a list`);
  return raw.map((entry: unknown, i) => {
    if (!isObject(entry)) return fail(`player ${i} must be an object`);
    const { team, fill, outline } = entry;
    if (typeof team !== "string" || team === "") return fail(`player ${i} needs a team`);
    if (!isHexColor(fill) || !isHexColor(outline)) return fail(`player ${i} needs fill and outline colors like "#3a6fd8"`);
    return { team, fill, outline };
  });
}

function parseColors(raw: unknown): Record<ColorKey, string> {
  if (!isObject(raw)) return fail(`"colors" must be an object`);
  const colors: Record<string, string> = { ...BUILT_IN_COLORS };
  for (const [key, value] of Object.entries(raw)) {
    if (!(key in BUILT_IN_COLORS)) return fail(`unknown color "${key}"`);
    if (!isHexColor(value)) return fail(`color "${key}" must look like "#3a6fd8"`);
    colors[key] = value;
  }
  return colors;
}

const isTileHeight = (value: unknown): value is 16 | 32 => value === 16 || value === 32;
/** A tile is as tall as it is wide, or twice as tall when it rises into the tile behind. */
const tileSizeProblem = (width: unknown, height: unknown): string | null => {
  if (!isTileHeight(width)) return `"tileWidth" must be 16 or 32`;
  return height === width || height === width * 2 ? null : `"tileHeight" must be ${width} or ${width * 2}`;
};

const isTileNumber = (value: unknown): value is number => Number.isInteger(value) && (value as number) >= 0;

function parseUnitSheet(raw: unknown, index: number): UnitSheet {
  const where = `unit sheet ${index}`;
  if (!isObject(raw)) return fail(`${where} must be an object`);
  const { nation, team, path, frames, rows, frameSize = 16, paratroopers = [] } = raw;
  if (typeof nation !== "string" || !Object.hasOwn(NATIONS, nation)) return fail(`${where}: unknown nation ${String(nation)}`);
  if (typeof team !== "string" || team === "") return fail(`${where} needs a team`);
  if (!isRelativePath(path)) return fail(`${where}: "path" must be a file in the pack`);
  if (!Number.isInteger(frames) || (frames as number) < 1) return fail(`${where}: "frames" must be a whole number`);
  if (!Array.isArray(rows)) return fail(`${where}: "rows" must be a list`);
  const bad: unknown = rows.find((row: unknown) => row !== null && !isUnitType(row));
  if (bad !== undefined) return fail(`${where}: unknown unit type ${JSON.stringify(bad)}`);
  if (!isTileHeight(frameSize)) return fail(`${where}: "frameSize" must be 16 or 32`);
  if (!Array.isArray(paratroopers) || !paratroopers.every(isTileNumber)) return fail(`${where}: "paratroopers" must be a list of row numbers`);
  return { nation: nation as NationId, team, path, frames: frames as number, rows: rows as (UnitTypeId | null)[], frameSize, paratroopers };
}


function parseTerrainSheet(raw: unknown): TerrainSheet {
  if (!isObject(raw)) return fail(`"terrain" must be an object`);
  const { path, tiles, frames = 1, tileWidth = 16, connected = {}, bridges, shore } = raw;
  const { tileHeight = tileWidth } = raw;
  if (!isRelativePath(path)) return fail(`terrain: "path" must be a file in the pack`);
  if (!isObject(tiles)) return fail(`terrain: "tiles" must be an object`);
  if (!Number.isInteger(frames) || (frames as number) < 1) return fail(`terrain: "frames" must be a whole number`);
  const sizeProblem = tileSizeProblem(tileWidth, tileHeight);
  if (sizeProblem) return fail(`terrain: ${sizeProblem}`);
  const parsedTiles: Partial<Record<TerrainId, number[]>> = {};
  for (const [terrain, tile] of Object.entries(tiles)) {
    if (!isTerrain(terrain)) return fail(`terrain: unknown terrain "${terrain}"`);
    const list: unknown[] = Array.isArray(tile) ? tile : [tile];
    if (list.length === 0 || !list.every(isTileNumber)) return fail(`terrain: tile for "${terrain}" must be a whole number or a list of them`);
    parsedTiles[terrain] = list;
  }
  if (!isObject(connected)) return fail(`terrain: "connected" must be an object`);
  for (const [terrain, first] of Object.entries(connected)) {
    if (terrain !== "road" && terrain !== "river") return fail(`terrain: only road and river can be connected, not "${terrain}"`);
    if (!isTileNumber(first)) return fail(`terrain: connected "${terrain}" must be a whole number`);
  }
  if (bridges !== undefined && (!isObject(bridges) || !isTileNumber(bridges.horizontal) || !isTileNumber(bridges.vertical))) {
    return fail(`terrain: "bridges" needs whole numbers for horizontal and vertical`);
  }
  if (shore !== undefined && !isTileNumber(shore)) return fail(`terrain: "shore" must be a whole number`);
  return {
    path,
    frames: frames as number,
    tileWidth: tileWidth as 16 | 32,
    tileHeight: tileHeight as number,
    tiles: parsedTiles,
    connected,
    bridges: bridges === undefined ? null : { horizontal: bridges.horizontal as number, vertical: bridges.vertical as number },
    ...(shore === undefined ? {} : { shore }),
  };
}

function parsePropertySheet(raw: unknown): PropertySheet {
  if (!isObject(raw)) return fail(`"properties" must be an object`);
  const { path, columns, rows, tileWidth = 16 } = raw;
  const { tileHeight = tileWidth } = raw;
  if (!isRelativePath(path)) return fail(`properties: "path" must be a file in the pack`);
  if (!Array.isArray(columns) || columns.length === 0 || !columns.every((c) => typeof c === "string" && c !== "")) {
    return fail(`properties: "columns" must be a list of owner names`);
  }
  if (!Array.isArray(rows)) return fail(`properties: "rows" must be a list`);
  const sizeProblem = tileSizeProblem(tileWidth, tileHeight);
  if (sizeProblem) return fail(`properties: ${sizeProblem}`);
  const bad: unknown = rows.find((row: unknown) => !isTerrain(row) || terrainDef(row).property === undefined);
  if (bad !== undefined) return fail(`properties: ${JSON.stringify(bad)} isn't a property`);
  return { path, columns: columns as string[], rows: rows as TerrainId[], tileWidth: tileWidth as 16 | 32, tileHeight: tileHeight as number };
}

function parseNames<K extends string>(raw: unknown, isKey: (key: unknown) => key is K, label: string): Partial<Record<K, string>> {
  if (!isObject(raw)) return fail(`"${label}" must be an object`);
  for (const [key, value] of Object.entries(raw)) {
    if (!isKey(key)) return fail(`${label}: unknown id "${key}"`);
    if (typeof value !== "string" || value === "") return fail(`${label}: the name for "${key}" must be text`);
  }
  return raw as Partial<Record<K, string>>;
}

/** Reads a pack.json, or throws an Error saying what's wrong with it. */
export function parseArtPack(raw: unknown): ArtPack {
  if (!isObject(raw)) return fail("a pack must be an object");
  if (typeof raw.name !== "string" || raw.name === "") return fail(`a pack needs a "name"`);
  const { players, colors, unitSheets, terrain, properties, unitNames, terrainNames } = raw;
  if (unitSheets !== undefined && !Array.isArray(unitSheets)) return fail(`"unitSheets" must be a list`);
  return {
    name: raw.name,
    players: players === undefined ? BUILT_IN_PACK.players : parsePlayers(players),
    colors: colors === undefined ? BUILT_IN_COLORS : parseColors(colors),
    unitSheets: ((unitSheets ?? []) as unknown[]).map(parseUnitSheet),
    terrain: terrain === undefined ? null : parseTerrainSheet(terrain),
    properties: properties === undefined ? null : parsePropertySheet(properties),
    unitNames: unitNames === undefined ? {} : parseNames(unitNames, isUnitType, "unitNames"),
    terrainNames: terrainNames === undefined ? {} : parseNames(terrainNames, isTerrain, "terrainNames"),
  };
}

/** A sprite's location in a pack: which sheet and which row. */
export interface UnitArt {
  readonly sheet: number;
  readonly row: number;
  readonly frames: number;
  readonly frameSize: 16 | 32;
}

/**
 * Which frame of the buildings sheet draws this property for this owner (null = unowned), or null to
 * keep the placeholder and its corner flag.
 */
export function findPropertyArt(pack: ArtPack, terrain: TerrainId, owner: number | null): number | null {
  const sheet = pack.properties;
  if (!sheet) return null;
  const column = sheet.columns.indexOf(owner === null ? "neutral" : (pack.players[owner % pack.players.length]?.team ?? ""));
  const row = sheet.rows.indexOf(terrain);
  return column < 0 || row < 0 ? null : row * sheet.columns.length + column;
}

/**
 * Where to find this unit's art for this nation and player, or null to use the placeholder. Pass the
 * unit itself to get its own look: an air-dropped Infantry is a paratrooper, its suit picked by id.
 */
export function findUnitArt(
  pack: ArtPack,
  nation: NationId,
  player: number,
  type: UnitTypeId,
  unit?: Pick<Unit, "id" | "airDropped">,
): UnitArt | null {
  const team = pack.players[player % pack.players.length]?.team;
  for (const [sheet, def] of pack.unitSheets.entries()) {
    if (def.nation !== nation || def.team !== team) continue;
    const paratrooper = type === "infantry" && unit?.airDropped && def.paratroopers.length > 0
      ? def.paratroopers[unit.id % def.paratroopers.length]
      : undefined;
    const row = paratrooper ?? def.rows.indexOf(type);
    if (row >= 0) return { sheet, row, frames: def.frames, frameSize: def.frameSize };
  }
  return null;
}

let active: ArtPack = BUILT_IN_PACK;

/** The pack in use. Set once at startup, before anything is drawn. */
export const activePack = (): ArtPack => active;

export function setActivePack(pack: ArtPack): void {
  active = pack;
}

export const packColor = (key: ColorKey): string => active.colors[key];

/** A pack color as the number Phaser's drawing calls expect. */
export const packColorNumber = (key: ColorKey): number => parseInt(active.colors[key].slice(1), 16);

/** The name shown for a unit: the pack's, or the rules' own. */
export const unitName = (type: UnitTypeId): string => active.unitNames[type] ?? UNITS[type].name;

export const terrainName = (id: TerrainId): string => active.terrainNames[id] ?? TERRAIN[id].name;
