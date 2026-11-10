// Placeholder unit markers until real sprites exist (08-art-pipeline): a team-colored badge with a
// 2-letter code, plus small HP and veterancy overlays.

import { UNITS, type UnitTypeId } from "../engine/data/units";
import type { VeterancyLevel } from "../engine/data/veterancy";
import { activePack } from "./artPack";
import { drawPixelText, GLYPH_HEIGHT, textWidth } from "./pixelFont";
import { TILE_SIZE } from "./placeholderTiles";

export const UNIT_CODES: Record<UnitTypeId, string> = {
  infantry: "IN", assaultInfantry: "AI", mortar: "MO", recon: "RC", halftrack: "HT",
  lightTank: "LT", mediumTank: "MT", heavyTank: "HV", tankDestroyer: "TD",
  artillery: "AR", rocketArtillery: "RK", mobileAA: "AA", flakGun: "FK",
  fighter: "FT", bomber: "BM", transportAircraft: "TA", diveBomber: "DB", torpedoBomber: "TR",
  battleship: "BB", destroyer: "DD", submarine: "SS", landingCraft: "LC", torpedoBoat: "TB", carrier: "CV",
};


function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  return [c, ctx];
}

export function playerColors(player: number): readonly [string, string] {
  const { players } = activePack();
  const art = players[player % players.length];
  if (!art) throw new Error("No player colors defined");
  return [art.fill, art.outline];
}

/** 16×16 marker: outlined team-colored badge with the unit code in white. */
export function drawUnitMarker(type: UnitTypeId, player: number): HTMLCanvasElement {
  const [c, ctx] = canvas(TILE_SIZE, TILE_SIZE);
  const [fill, outline] = playerColors(player);
  const air = UNITS[type].category === "air";
  if (air) {
    // A shadow on the ground and a winged outline, so aircraft read as flying over the tile.
    ctx.fillStyle = "rgba(0, 0, 0, 0.35)";
    ctx.fillRect(3, 13, 10, 2);
    ctx.fillStyle = outline;
    ctx.fillRect(0, 4, 16, 6);
    ctx.fillRect(3, 1, 10, 12);
    ctx.fillStyle = fill;
    ctx.fillRect(1, 5, 14, 4);
    ctx.fillRect(4, 2, 8, 10);
  } else {
    ctx.fillStyle = outline;
    ctx.fillRect(1, 3, 14, 11);
    ctx.fillRect(2, 2, 12, 13);
    ctx.fillStyle = fill;
    ctx.fillRect(2, 4, 12, 9);
    ctx.fillRect(3, 3, 10, 11);
  }
  ctx.fillStyle = "#ffffff";
  const code = UNIT_CODES[type];
  drawPixelText(ctx, code, Math.floor((TILE_SIZE - textWidth(code)) / 2), air ? 4 : 6);
  return c;
}

/** Small HP number (1–9) on a dark background, shown when a unit is damaged. */
export function drawHpBadge(hp: number): HTMLCanvasElement {
  const text = String(hp);
  const [c, ctx] = canvas(textWidth(text) + 2, GLYPH_HEIGHT + 2);
  ctx.fillStyle = "#101018";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#ffffff";
  drawPixelText(ctx, text, 1, 1);
  return c;
}

/** One wave on a dark background, marking a submerged submarine (05-supply-transport §9). */
export function drawSubmergedBadge(): HTMLCanvasElement {
  const [c, ctx] = canvas(7, 5);
  ctx.fillStyle = "#101018";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = activePack().colors.submerged;
  // A "~" 7 wide: up, then down.
  for (const [x, y] of [[0, 2], [1, 1], [2, 1], [3, 2], [4, 3], [5, 3], [6, 2]] as const) ctx.fillRect(x, y, 1, 1);
  return c;
}

/**
 * Draws a small pixel icon from rows of letters: `O` the dark outline, `B` the body color, `L` a
 * lighter shade of it, `Y` brass, `.` clear.
 */
function pixelIcon(rows: readonly string[], body: string, light: string): HTMLCanvasElement {
  const [c, ctx] = canvas(rows[0]?.length ?? 0, rows.length);
  const colors: Record<string, string> = { O: "#101018", B: body, L: light, Y: "#f0c040" };
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const color = colors[row.charAt(x)];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return c;
}

/** A jerrycan with the embossed X on its side: the low-fuel warning (05-supply-transport §11). */
export function drawFuelCanBadge(): HTMLCanvasElement {
  const body = activePack().colors.fuelCan;
  return pixelIcon([
    "..OOOO.",
    ".OLOLOO",
    "OOOOOLO",
    "OBLBLBO",
    "OBBLBBO",
    "OBLBLBO",
    "OBBBBBO",
    "OOOOOOO",
  ], body, "#ffb0a0");
}

/** An ammo can with three brass rounds standing in it: the low-ammo warning (05-supply-transport §11). */
export function drawAmmoCanBadge(): HTMLCanvasElement {
  const body = activePack().colors.ammoCan;
  return pixelIcon([
    ".O.O.O.",
    "OYOYOYO",
    "OYOYOYO",
    "OOOOOOO",
    "OBBBBBO",
    "OLLLLLO",
    "OBBBBBO",
    "OOOOOOO",
  ], body, "#c8d088");
}

/** Veterancy chevrons: one for Veteran, three for Elite (03-combat §6). */
export function drawVeterancyBadge(level: Exclude<VeterancyLevel, "rookie">): HTMLCanvasElement {
  const count = level === "elite" ? 3 : 1;
  const [c, ctx] = canvas(5, count * 2 + 1);
  ctx.fillStyle = "#101018";
  ctx.fillRect(0, 0, c.width, c.height);
  ctx.fillStyle = "#f0d040";
  for (let i = 0; i < count; i++) {
    // A "V" shape: 5 wide, 3 tall; chevrons stack every 2 rows.
    for (const [x, dy] of [[0, 0], [1, 1], [2, 2], [3, 1], [4, 0]] as const) ctx.fillRect(x, i * 2 + dy, 1, 1);
  }
  return c;
}
