// Art packs (08-art-pipeline §13): a folder with a pack.json that says what the game looks like.
// Every field is optional, and anything a pack leaves out falls back to the built-in look, so a
// pack can replace one unit or everything. Art never affects the rules.

import { COMMANDER_IDS, COMMANDERS, type CommanderId } from "../engine/data/commanders";
import { NATIONS, type NationId } from "../engine/data/nations";
import { TERRAIN, TERRAIN_IDS, terrainDef, type TerrainId } from "../engine/data/terrain";
import { WEATHER, type WeatherId } from "../engine/data/weather";
import { UNIT_TYPE_IDS, UNITS, type UnitTypeId } from "../engine/data/units";
import type { Unit } from "../engine/state";
import { SOUND_IDS, type SoundId } from "./sound/sounds";

const BUILT_IN_COLORS = {
  // HTML panels and screens
  uiBg: "#101018",
  uiPanel: "#f4ecd8",
  uiInk: "#2a2418",
  uiBorder: "#4a3c28",
  uiAccent: "#c84030",
  uiHighlight: "#e8c070",
  // The phone game pad and the box behind its game screen (00-master-design §12)
  padBody: "#3b3f2a",
  padBodyEdge: "#23261a",
  padKey: "#1d1f17",
  padKeyPressed: "#4a4e38",
  padInk: "#e9e2c8",
  padAction: "#8a3324",
  padActionPressed: "#b0503a",
  padScreen: "#000000",
  // Map overlays
  cursor: "#ffffff",
  rangeMove: "#7ec8ff",
  rangeInspect: "#ffc070",
  rangeAttack: "#ff4030",
  // How far a Radar Station sees aircraft: the green of a radar screen (19-fog-of-war §2a)
  rangeRadar: "#60f080",
  rangeGrid: "#ffffff",
  pathFill: "#f8f0d0",
  pathOutline: "#1a2438",
  // Canvas menus
  menuBg: "#f4ecd8",
  menuBorder: "#4a3c28",
  menuInk: "#2a2418",
  menuHighlight: "#e8c070",
  // The corner marks on a property a scenario objective names (04-economy §8)
  objective: "#f0d040",
  // A submerged submarine: its sprite is tinted this color, and its badge drawn in it (05-supply-transport §9)
  submerged: "#78b0f0",
  // Laid over tiles out of sight in fog of war (19-fog-of-war §7)
  fog: "#0a1020",
  // Effects and floating labels
  flash: "#ffffff",
  blast: "#ffa030",
  // Dust kicked up behind vehicles and foam behind ships as they move on the map (08-art-pipeline §22)
  moveDust: "#d8c49a",
  moveFoam: "#e8f4ff",
  labelText: "#ffffff",
  labelOutline: "#101018",
  // Shadow under unit sprites
  unitShadow: "#1c3412",
  // Snow falling over the map and battle scenes while it snows (12-weather §5)
  snowfall: "#ffffff",
  snowfallShadow: "#4a5a78",
  // Rain falling over the map and battle scenes while it rains (12-weather §5)
  rainfall: "#b8cce0",
  labelGold: "#f0d040",
  labelGreen: "#80f080",
  labelBlue: "#a0d8ff",
  labelWarning: "#ffa030",
  // The flashing low-supply badges on the map (05-supply-transport §11): a red jerrycan, an olive ammo can
  fuelCan: "#d83a28",
  ammoCan: "#6a7440",
  // The supply crate that pops up over a unit refuelled and rearmed at the start of its turn (04-economy §2)
  supplyCrate: "#a87838",
  // Battle scenes (08-art-pipeline §18): backgrounds
  battleSkyTop: "#5888d0",
  battleSkyLow: "#a8c8e8",
  battleCloud: "#f0f4f8",
  battleGrass: "#5c9a3c",
  battleGrassLight: "#86bc54",
  battleGrassDark: "#3c6c2c",
  battleDirt: "#8a6a44",
  battleRoad: "#a89070",
  battleSand: "#e0cc90",
  battleSea: "#2c68b0",
  battleSeaLight: "#5898d8",
  battleSeaDeep: "#163c70",
  battleFoam: "#e8f4ff",
  battleTree: "#2e6a30",
  battleTreeDark: "#1c4420",
  battleHill: "#7a9a4c",
  battleStone: "#d8ccb0",
  battleRoof: "#9a4a34",
  battleConcrete: "#9a9888",
  // Battle scenes on winter maps (12-weather §5): these stand in for the grass, tree, hill and road
  // colors above, and the overcast sky for the clear one while it snows.
  battleSnow: "#dfe6ee",
  battleSnowLight: "#f8fbff",
  battleSnowDark: "#b2c0d2",
  battleSnowDirt: "#8a7c6a",
  battleSnowRoad: "#b4aa9a",
  battleSnowHill: "#c8d2de",
  battleWinterTree: "#24483a",
  battleWinterTreeDark: "#14302a",
  battleOvercastTop: "#7e8898",
  battleOvercastLow: "#c2c8d2",
  // Battle scenes on desert maps (08-art-pipeline §21): sand and gravel for the grass, camel thorn for
  // trees, a pale hot sky; and the desert terrain (02-terrain §4b): mine signs and the salt crust.
  battleDesert: "#d6bc84",
  battleDesertLight: "#ecdab0",
  battleDesertDark: "#a88c58",
  battleDesertDirt: "#9a7a4c",
  battleDesertRoad: "#c8b48a",
  battleDesertHill: "#b89a64",
  battleDesertScrub: "#7a7a48",
  battleDesertScrubDark: "#56562e",
  battleDesertSkyTop: "#7aa4d0",
  battleDesertSkyLow: "#e4dccc",
  battleMineSign: "#e8c020",
  battleSalt: "#ece8de",
  battleSaltDark: "#b4ac9a",
  // Battle scenes: figures and materials
  battleOlive: "#5c6038",
  battleFieldGrey: "#5e665c",
  // The IJA uniform's khaki drab, and the red of Japan's hinomaru marking
  battleKhaki: "#8a7c4c",
  battleSun: "#c8202c",
  // British battledress and Service Colour No. 2 brown, the RAF roundel's blue (its red is battleSun),
  // and the Airborne's maroon beret
  battleBrown: "#6e5a3c",
  battleRoundel: "#2c3c8c",
  battleBeret: "#7e2030",
  // Italy's khaki drill for the desert (the sahariana), toned with the team color like the others
  battleSahariana: "#a4925e",
  battleSteel: "#5a5e60",
  battleSteelDark: "#33363a",
  battleRubber: "#26262a",
  battleSkin: "#e0a880",
  battleWood: "#8a5a30",
  battleLeather: "#5a3c22",
  battleBrass: "#e0b040",
  battleStar: "#f4f0e4",
  battleInk: "#141418",
  // Battle scenes, polish (08-art-pipeline §18): shadows lean toward the shade tint; lit faces get
  // lighter and turn a little toward the light tint's hue
  battleShadeTint: "#1c2048",
  battleLightTint: "#fff0c8",
  // Goggle lenses on tank commanders (polish)
  battleLens: "#8cc0dc",
  // Battle scenes: effects and panels
  battleFlash: "#fff8c0",
  battleFire: "#ff8020",
  battleTracer: "#ffe060",
  battleSmoke: "#c8c4bc",
  battleSmokeDark: "#56524c",
  battlePanel: "#101018",
  worldSea: "#1e3a5c",
  worldSeaShallow: "#2c5478",
  worldGrid: "#2a4a70",
  worldLand: "#c8b88a",
  worldLandShade: "#a8976a",
  worldCoast: "#5a4a30",
  worldDot: "#f0d040",
  worldDotOther: "#e8e0c8",
  worldDotOutline: "#101018",
  sketchGrid: "#2a2418",
} as const;

export type ColorKey = keyof typeof BUILT_IN_COLORS;

/** The page's CSS color variables (ui/style.css) and the pack color each one is set from at startup. */
export const PAGE_COLORS: Readonly<Record<string, ColorKey>> = {
  "--bg": "uiBg",
  "--panel-bg": "uiPanel",
  "--panel-ink": "uiInk",
  "--panel-border": "uiBorder",
  "--accent": "uiAccent",
  "--highlight": "uiHighlight",
  "--pad-body": "padBody",
  "--pad-body-edge": "padBodyEdge",
  "--pad-key": "padKey",
  "--pad-key-pressed": "padKeyPressed",
  "--pad-ink": "padInk",
  "--pad-action": "padAction",
  "--pad-action-pressed": "padActionPressed",
  "--pad-screen": "padScreen",
};

/** How a player's units are colored, and which sheets they use. */
export interface PlayerArt {
  /** Matches a unit sheet's `team`. */
  readonly team: string;
  readonly fill: string;
  readonly outline: string;
}

/**
 * How a unit's sprite shows it (08-art-pipeline §22): from the side, drawn facing right and mirrored
 * for left; from the front, coming toward you (moving down the map); or from the back, going away
 * (moving up the map).
 */
export type UnitView = "side" | "down" | "up";
export const UNIT_VIEWS: readonly UnitView[] = ["side", "down", "up"];

/**
 * A sprite sheet of square frames: one row per unit, with frames running across. Frames are 16 or
 * 32 pixels; either way a unit fills one map square (08-art-pipeline §17). Each view in `facings`
 * takes `frames` columns, in that order (§22).
 */
export interface UnitSheet {
  readonly nation: NationId;
  readonly team: string;
  /** Relative to the pack's folder. */
  readonly path: string;
  /** Animation frames per view. */
  readonly frames: number;
  /** The views each row holds, left to right; always starts with "side". */
  readonly facings: readonly UnitView[];
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
  readonly connected: Readonly<Partial<Record<ConnectedTerrain, number>>>;
  /** Bridge decks drawn over a river piece. */
  readonly bridges: BridgeTiles | null;
  /** Major Bridge decks drawn over a river piece (02-terrain §4a). Without them, the Bridge deck is used. */
  readonly majorBridges?: BridgeTiles;
  /** Blown Bridge wrecks drawn over a river piece (02-terrain §4a). Without them, a Blown Bridge is drawn as river. */
  readonly blownBridges?: BridgeTiles;
  /** A railway's girder span drawn over a river piece where the line crosses one (02-terrain §4c). */
  readonly railBridges?: BridgeTiles;
  /** First of 8 shore pieces drawn over sea next to land: edges N, E, S, W, then corners NE, SE, SW, NW. */
  readonly shore?: number;
  /**
   * First of 20 beach pieces, half sea on the sides facing open water: 16 in mask order of those sides
   * (N=1, E=2, S=4, W=8; 0 is all sand), then 4 inner corners drawn over one, NE, SE, SW, NW. Without
   * it, beaches are drawn all sand from `tiles`.
   */
  readonly beach?: number;
  /**
   * First of 32 beach flare pieces, drawn over a beach piece where sea on one side meets full land on
   * the side beside it: the sand sweeps out to the land's corner. 8 for each corner NE, SE, SW, NW
   * (see `beachFlares` in terrainTiles.ts for the order). Without it, the waterline meets the land halfway.
   */
  readonly beachFlares?: number;
  /** The same layout drawn in snow, for winter maps (08-art-pipeline §21). Relative to the pack's folder. */
  readonly winterPath?: string;
  /** The same layout drawn as desert, for desert maps (08-art-pipeline §21). Relative to the pack's folder. */
  readonly desertPath?: string;
}

/** A bridge's two pieces: running left to right, and top to bottom. */
export interface BridgeTiles {
  readonly horizontal: number;
  readonly vertical: number;
}

/** A property sheet row: a property (or "bunker"), optionally with the side it opens to. */
export type PropertyRow = TerrainId | `${TerrainId}:${"N" | "E" | "S" | "W"}`;

/** Buildings for owned properties: one row per property, one column per owner (08-art-pipeline §15). */
export interface PropertySheet {
  /** Relative to the pack's folder. */
  readonly path: string;
  /** The owner each column is for: "neutral", or a player's `team`. */
  readonly columns: readonly string[];
  /**
   * The property on each row, top to bottom, or "bunker" for a bunker with Infantry inside. A row
   * named like "port:E" draws that property when it opens to that side: a port's harbor faces the
   * sea beside it (08-art-pipeline §15). The plain "port" row is the one opening south.
   */
  readonly rows: readonly PropertyRow[];
  /** 16, or 32 for art drawn for the 32-pixel grid and scaled into a square (08-art-pipeline §17). */
  readonly tileWidth: 16 | 32;
  /** The tile width, or twice it for buildings that rise into the tile behind (08-art-pipeline §16). */
  readonly tileHeight: number;
  /** The same layout standing on snow, for winter maps (08-art-pipeline §21). Relative to the pack's folder. */
  readonly winterPath?: string;
  /** The same layout drawn as desert buildings on sand, for desert maps (08-art-pipeline §21). Relative to the pack's folder. */
  readonly desertPath?: string;
}

export interface ArtPack {
  readonly name: string;
  /** Colors by player slot: used when a player's nation has no natural color, or two players would share one. */
  readonly players: readonly PlayerArt[];
  /** Each nation's natural color, which its army wears whichever player fields it (08-art-pipeline §12). */
  readonly nationColors: Readonly<Partial<Record<NationId, PlayerArt>>>;
  readonly colors: Readonly<Record<ColorKey, string>>;
  readonly unitSheets: readonly UnitSheet[];
  readonly terrain: TerrainSheet | null;
  readonly properties: PropertySheet | null;
  readonly unitNames: Readonly<Partial<Record<UnitTypeId, string>>>;
  readonly terrainNames: Readonly<Partial<Record<TerrainId, string>>>;
  /**
   * The folder of commander portraits, relative to the pack's folder: `<id>.png` from the waist up
   * and `<id>-head.png` for the turn bar (06-commanders §4). Null: commanders show by name alone.
   */
  readonly commanderPortraits: string | null;
  readonly commanderNames: Readonly<Partial<Record<CommanderId, string>>>;
  /** Files for each sound id, relative to the pack's folder; several are variants to pick from (16-sound §7). */
  readonly sounds: Readonly<Partial<Record<SoundId, readonly string[]>>>;
}

/** The look when no pack loads: everything drawn in code. */
export const BUILT_IN_PACK: ArtPack = {
  name: "Built-in",
  players: [
    // Player 1 is army green: the US, the first player on every built-in map (08-art-pipeline §12).
    { team: "olive", fill: "#64783a", outline: "#2a3818" },
    { team: "red", fill: "#c8463a", outline: "#5e1a14" },
    { team: "blue", fill: "#3a6fd8", outline: "#1a3270" },
    { team: "gold", fill: "#d8a030", outline: "#6a4a10" },
  ],
  // What each army actually wore and painted its vehicles: US olive drab, German field grey, Japanese
  // khaki, Soviet 4BO protective green, British Service Colour No. 2 brown (08-art-pipeline §12).
  // Canada borrows the UK's (ART_LOANS). Italy wears blue, its azzurro, so it never matches Germany on
  // a map with both (18-scenarios-north-africa §1).
  nationColors: {
    us: { team: "olive", fill: "#64783a", outline: "#2a3818" },
    uk: { team: "brown", fill: "#765c3e", outline: "#33261a" },
    germany: { team: "grey", fill: "#747b72", outline: "#333834" },
    japan: { team: "khaki", fill: "#9a8648", outline: "#463a1e" },
    ussr: { team: "green4bo", fill: "#52643a", outline: "#222c18" },
    italy: { team: "blue", fill: "#3a6fd8", outline: "#1a3270" },
  },
  colors: BUILT_IN_COLORS,
  unitSheets: [],
  terrain: null,
  properties: null,
  unitNames: {},
  terrainNames: {},
  commanderPortraits: null,
  commanderNames: {},
  sounds: {},
};

type Json = Record<string, unknown>;

const isObject = (value: unknown): value is Json => typeof value === "object" && value !== null && !Array.isArray(value);
const isHexColor = (value: unknown): value is string => typeof value === "string" && /^#[0-9a-fA-F]{6}$/.test(value);
const isUnitType = (value: unknown): value is UnitTypeId => UNIT_TYPE_IDS.includes(value as UnitTypeId);
const isCommander = (value: unknown): value is CommanderId => COMMANDER_IDS.includes(value as CommanderId);
const isTerrain = (value: unknown): value is TerrainId => TERRAIN_IDS.includes(value as TerrainId);
const isUnitView = (value: unknown): value is UnitView => UNIT_VIEWS.includes(value as UnitView);
const isSoundId = (value: unknown): value is SoundId => SOUND_IDS.includes(value as SoundId);

/** Packs load files from their own folder. Web addresses and absolute paths aren't allowed. */
const isRelativePath = (value: unknown): value is string =>
  typeof value === "string" && value.length > 0 && !value.startsWith("/") && !/^[a-z][a-z0-9+.-]*:/i.test(value);

const fail = (message: string): never => {
  throw new Error(message);
};

function parsePlayerArt(entry: unknown, where: string): PlayerArt {
  if (!isObject(entry)) return fail(`${where} must be an object`);
  const { team, fill, outline } = entry;
  if (typeof team !== "string" || team === "") return fail(`${where} needs a team`);
  if (!isHexColor(fill) || !isHexColor(outline)) return fail(`${where} needs fill and outline colors like "#3a6fd8"`);
  return { team, fill, outline };
}

function parsePlayers(raw: unknown): PlayerArt[] {
  if (!Array.isArray(raw) || raw.length === 0) return fail(`"players" must be a list`);
  return raw.map((entry: unknown, i) => parsePlayerArt(entry, `player ${i}`));
}

function parseNationColors(raw: unknown): Partial<Record<NationId, PlayerArt>> {
  if (!isObject(raw)) return fail(`"nationColors" must be an object`);
  const colors: Partial<Record<NationId, PlayerArt>> = {};
  for (const [nation, entry] of Object.entries(raw)) {
    if (!Object.hasOwn(NATIONS, nation)) return fail(`nationColors: unknown nation "${nation}"`);
    colors[nation as NationId] = parsePlayerArt(entry, `nationColors: ${nation}`);
  }
  return colors;
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
  const { nation, team, path, frames, rows, frameSize = 16, paratroopers = [], facings = ["side"] } = raw;
  if (typeof nation !== "string" || !Object.hasOwn(NATIONS, nation)) return fail(`${where}: unknown nation ${String(nation)}`);
  if (typeof team !== "string" || team === "") return fail(`${where} needs a team`);
  if (!isRelativePath(path)) return fail(`${where}: "path" must be a file in the pack`);
  if (!Number.isInteger(frames) || (frames as number) < 1) return fail(`${where}: "frames" must be a whole number`);
  if (!Array.isArray(rows)) return fail(`${where}: "rows" must be a list`);
  const bad: unknown = rows.find((row: unknown) => row !== null && !isUnitType(row));
  if (bad !== undefined) return fail(`${where}: unknown unit type ${JSON.stringify(bad)}`);
  if (!isTileHeight(frameSize)) return fail(`${where}: "frameSize" must be 16 or 32`);
  if (!Array.isArray(paratroopers) || !paratroopers.every(isTileNumber)) return fail(`${where}: "paratroopers" must be a list of row numbers`);
  if (
    !Array.isArray(facings) || facings[0] !== "side" || !facings.every(isUnitView) || new Set(facings).size !== facings.length
  ) {
    return fail(`${where}: "facings" must list "side" first, then any of "down" and "up", once each`);
  }
  return {
    nation: nation as NationId,
    team,
    path,
    frames: frames as number,
    facings,
    rows: rows as (UnitTypeId | null)[],
    frameSize,
    paratroopers,
  };
}


/** Terrain drawn as 16 pieces that join their neighbors, like roads. */
export type ConnectedTerrain = "road" | "river" | "railway";
const CONNECTED: readonly string[] = ["road", "river", "railway"] satisfies readonly ConnectedTerrain[];

function parseTerrainSheet(raw: unknown): TerrainSheet {
  if (!isObject(raw)) return fail(`"terrain" must be an object`);
  const { path, tiles, frames = 1, tileWidth = 16, connected = {}, bridges, majorBridges, blownBridges, railBridges, shore, beach, beachFlares, winterPath, desertPath } = raw;
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
    if (!CONNECTED.includes(terrain)) return fail(`terrain: only road, river and railway can be connected, not "${terrain}"`);
    if (!isTileNumber(first)) return fail(`terrain: connected "${terrain}" must be a whole number`);
  }
  const bridgeTiles = (name: string, value: unknown): BridgeTiles | undefined => {
    if (value === undefined) return undefined;
    if (!isObject(value) || !isTileNumber(value.horizontal) || !isTileNumber(value.vertical)) {
      return fail(`terrain: "${name}" needs whole numbers for horizontal and vertical`);
    }
    return { horizontal: value.horizontal, vertical: value.vertical };
  };
  const plain = bridgeTiles("bridges", bridges);
  const major = bridgeTiles("majorBridges", majorBridges);
  const blown = bridgeTiles("blownBridges", blownBridges);
  const rail = bridgeTiles("railBridges", railBridges);
  if (shore !== undefined && !isTileNumber(shore)) return fail(`terrain: "shore" must be a whole number`);
  if (beach !== undefined && !isTileNumber(beach)) return fail(`terrain: "beach" must be a whole number`);
  if (beachFlares !== undefined && !isTileNumber(beachFlares)) return fail(`terrain: "beachFlares" must be a whole number`);
  if (winterPath !== undefined && !isRelativePath(winterPath)) return fail(`terrain: "winterPath" must be a file in the pack`);
  if (desertPath !== undefined && !isRelativePath(desertPath)) return fail(`terrain: "desertPath" must be a file in the pack`);
  return {
    path,
    frames: frames as number,
    tileWidth: tileWidth as 16 | 32,
    tileHeight: tileHeight as number,
    tiles: parsedTiles,
    connected,
    bridges: plain ?? null,
    ...(major === undefined ? {} : { majorBridges: major }),
    ...(blown === undefined ? {} : { blownBridges: blown }),
    ...(rail === undefined ? {} : { railBridges: rail }),
    ...(shore === undefined ? {} : { shore }),
    ...(beach === undefined ? {} : { beach }),
    ...(beachFlares === undefined ? {} : { beachFlares }),
    ...(winterPath === undefined ? {} : { winterPath }),
    ...(desertPath === undefined ? {} : { desertPath }),
  };
}

function parsePropertySheet(raw: unknown): PropertySheet {
  if (!isObject(raw)) return fail(`"properties" must be an object`);
  const { path, columns, rows, tileWidth = 16, winterPath, desertPath } = raw;
  const { tileHeight = tileWidth } = raw;
  if (!isRelativePath(path)) return fail(`properties: "path" must be a file in the pack`);
  if (!Array.isArray(columns) || columns.length === 0 || !columns.every((c) => typeof c === "string" && c !== "")) {
    return fail(`properties: "columns" must be a list of owner names`);
  }
  if (!Array.isArray(rows)) return fail(`properties: "rows" must be a list`);
  const sizeProblem = tileSizeProblem(tileWidth, tileHeight);
  if (sizeProblem) return fail(`properties: ${sizeProblem}`);
  // A "bunker" row is the bunker drawn garrisoned, in the colors of the side holding it.
  const isRow = (row: unknown): row is PropertyRow => {
    if (typeof row !== "string") return false;
    const [base, side, ...rest] = row.split(":");
    if (rest.length > 0 || (side !== undefined && !["N", "E", "S", "W"].includes(side))) return false;
    return isTerrain(base) && (base === "bunker" || terrainDef(base).property !== undefined);
  };
  const bad: unknown = rows.find((row: unknown) => !isRow(row));
  if (bad !== undefined) return fail(`properties: ${JSON.stringify(bad)} isn't a property or "bunker"`);
  if (winterPath !== undefined && !isRelativePath(winterPath)) return fail(`properties: "winterPath" must be a file in the pack`);
  if (desertPath !== undefined && !isRelativePath(desertPath)) return fail(`properties: "desertPath" must be a file in the pack`);
  return {
    path,
    columns: columns as string[],
    rows: rows as PropertyRow[],
    tileWidth: tileWidth as 16 | 32,
    tileHeight: tileHeight as number,
    ...(winterPath === undefined ? {} : { winterPath }),
    ...(desertPath === undefined ? {} : { desertPath }),
  };
}

function parseNames<K extends string>(raw: unknown, isKey: (key: unknown) => key is K, label: string): Partial<Record<K, string>> {
  if (!isObject(raw)) return fail(`"${label}" must be an object`);
  for (const [key, value] of Object.entries(raw)) {
    if (!isKey(key)) return fail(`${label}: unknown id "${key}"`);
    if (typeof value !== "string" || value === "") return fail(`${label}: the name for "${key}" must be text`);
  }
  return raw as Partial<Record<K, string>>;
}

/** Sound ids to a file, or a list of files to pick from (16-sound §7). */
function parseSounds(raw: unknown): Partial<Record<SoundId, string[]>> {
  if (!isObject(raw)) return fail(`"sounds" must be an object`);
  const sounds: Partial<Record<SoundId, string[]>> = {};
  for (const [id, files] of Object.entries(raw)) {
    if (!isSoundId(id)) return fail(`sounds: unknown sound "${id}"`);
    const list: unknown[] = Array.isArray(files) ? files : [files];
    if (list.length === 0 || !list.every(isRelativePath)) return fail(`sounds: "${id}" must be a file in the pack, or a list of them`);
    sounds[id] = list;
  }
  return sounds;
}

/** Reads a pack.json, or throws an Error saying what's wrong with it. */
export function parseArtPack(raw: unknown): ArtPack {
  if (!isObject(raw)) return fail("a pack must be an object");
  if (typeof raw.name !== "string" || raw.name === "") return fail(`a pack needs a "name"`);
  const { players, nationColors, colors, unitSheets, terrain, properties, unitNames, terrainNames, sounds, commanderPortraits, commanderNames } = raw;
  if (commanderPortraits !== undefined && !(isRelativePath(commanderPortraits) && commanderPortraits.endsWith("/"))) {
    return fail(`"commanderPortraits" must be a folder in the pack, ending in "/"`);
  }
  if (unitSheets !== undefined && !Array.isArray(unitSheets)) return fail(`"unitSheets" must be a list`);
  return {
    name: raw.name,
    players: players === undefined ? BUILT_IN_PACK.players : parsePlayers(players),
    nationColors: nationColors === undefined ? BUILT_IN_PACK.nationColors : parseNationColors(nationColors),
    colors: colors === undefined ? BUILT_IN_COLORS : parseColors(colors),
    unitSheets: ((unitSheets ?? []) as unknown[]).map(parseUnitSheet),
    terrain: terrain === undefined ? null : parseTerrainSheet(terrain),
    properties: properties === undefined ? null : parsePropertySheet(properties),
    unitNames: unitNames === undefined ? {} : parseNames(unitNames, isUnitType, "unitNames"),
    terrainNames: terrainNames === undefined ? {} : parseNames(terrainNames, isTerrain, "terrainNames"),
    commanderPortraits: commanderPortraits ?? null,
    commanderNames: commanderNames === undefined ? {} : parseNames(commanderNames, isCommander, "commanderNames"),
    sounds: sounds === undefined ? {} : parseSounds(sounds),
  };
}

/** A sprite's location in a pack: which sheet and which row, and the views and frames the row holds. */
export interface UnitArt {
  readonly sheet: number;
  readonly row: number;
  readonly frames: number;
  readonly frameSize: 16 | 32;
  readonly facings: readonly UnitView[];
}

/**
 * The sheet frame number for one frame of one view of a unit. A view the sheet doesn't have falls
 * back to the side view (08-art-pipeline §22).
 */
export function unitFrame(art: UnitArt, view: UnitView, frame = 0): number {
  const column = Math.max(0, art.facings.indexOf(view)) * art.frames + frame;
  return art.row * art.frames * art.facings.length + column;
}

/**
 * Nations drawn with another nation's art when a pack has none of their own (00-master-design §6):
 * Canada fields the UK's sprites, battle figures and color. (Italy borrowed Germany's until it got
 * its own on 2026-11-18.)
 */
export const ART_LOANS: Readonly<Partial<Record<NationId, NationId>>> = { canada: "uk" };

/**
 * The nation whose equipment battle scenes draw for this one: the nation it borrows art from, if
 * any. Flags still show the nation's own flag.
 */
export const drawnAs = (nation: NationId | null): NationId | null => (nation === null ? null : (ART_LOANS[nation] ?? nation));

/** The nations whose art can draw this one: its own first, then the one it borrows from. */
const artNations = (nation: NationId): NationId[] => {
  const loan = ART_LOANS[nation];
  return loan ? [nation, loan] : [nation];
};

/** A nation's natural color in a pack: its own, or the one of the nation it borrows art from. */
const naturalColor = (pack: ArtPack, nation: NationId): PlayerArt | undefined =>
  artNations(nation).map((n) => pack.nationColors[n]).find((art) => art !== undefined);

/**
 * Each player's colors for a game between these nations, in player order (08-art-pipeline §12). A
 * player wears their nation's natural color unless another player would wear the same one (two
 * American players, say); then they take the first slot color, starting from their own slot, that
 * nobody else is wearing. A nation with no natural color does the same.
 */
export function assignPlayerArt(pack: ArtPack, nations: readonly NationId[]): PlayerArt[] {
  const natural = nations.map((nation) => naturalColor(pack, nation));
  const unique = natural.map((art) => (art && natural.filter((other) => other?.team === art.team).length === 1 ? art : undefined));
  const taken = new Set(unique.flatMap((art) => (art ? [art.team] : [])));
  return unique.map((art, player) => {
    if (art) return art;
    const slots = pack.players.length;
    for (let i = 0; i < slots; i++) {
      const slot = pack.players[(player + i) % slots];
      if (slot && !taken.has(slot.team)) {
        taken.add(slot.team);
        return slot;
      }
    }
    return slotArt(pack, player);
  });
}

const slotArt = (pack: ArtPack, player: number): PlayerArt => {
  const art = pack.players[player % pack.players.length];
  if (!art) throw new Error("No player colors defined");
  return art;
};

/** The nations in the game being played, in player order. Empty until a game starts. */
let gameNations: readonly NationId[] = [];

/** Called when a game starts, so every player is drawn in their nation's colors. */
export function setGameNations(nations: readonly NationId[]): void {
  gameNations = nations;
}

/** A player's colors in the game being played; before a game starts, their slot's colors. */
export const playerArt = (pack: ArtPack, player: number): PlayerArt =>
  assignPlayerArt(pack, gameNations)[player] ?? slotArt(pack, player);

/**
 * Which frame of the buildings sheet draws this property for this owner (null = unowned), or null to
 * keep the placeholder and its corner flag. `opens` picks the row drawn opening that way, if the sheet
 * has one (a port's harbor, 08-art-pipeline §15).
 */
export function findPropertyArt(
  pack: ArtPack,
  terrain: TerrainId,
  owner: number | null,
  opens?: "N" | "E" | "S" | "W",
): number | null {
  const sheet = pack.properties;
  if (!sheet) return null;
  const column = sheet.columns.indexOf(owner === null ? "neutral" : playerArt(pack, owner).team);
  const facing = opens === undefined ? -1 : sheet.rows.indexOf(`${terrain}:${opens}`);
  const row = facing >= 0 ? facing : sheet.rows.indexOf(terrain);
  return column < 0 || row < 0 ? null : row * sheet.columns.length + column;
}

/**
 * Where to find this unit's art for this nation and player, or null to use the placeholder. Pass the
 * unit itself to get its own look: an air-dropped Infantry is a paratrooper, its look picked by id.
 * A nation with no sheets of its own uses those of the nation it borrows art from (ART_LOANS).
 */
export function findUnitArt(
  pack: ArtPack,
  nation: NationId,
  player: number,
  type: UnitTypeId,
  unit?: Pick<Unit, "id" | "airDropped">,
): UnitArt | null {
  const { team } = playerArt(pack, player);
  // A nation's own sheets first; failing those, the sheets of the nation it borrows art from.
  for (const artNation of artNations(nation)) {
    for (const [sheet, def] of pack.unitSheets.entries()) {
      if (def.nation !== artNation || def.team !== team) continue;
      const paratrooper = type === "infantry" && unit?.airDropped && def.paratroopers.length > 0
        ? def.paratroopers[unit.id % def.paratroopers.length]
        : undefined;
      const row = paratrooper ?? def.rows.indexOf(type);
      if (row >= 0) return { sheet, row, frames: def.frames, frameSize: def.frameSize, facings: def.facings };
    }
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
export const commanderName = (id: CommanderId): string => active.commanderNames[id] ?? COMMANDERS[id].name;
export const weatherName = (id: WeatherId): string => WEATHER[id].name;
