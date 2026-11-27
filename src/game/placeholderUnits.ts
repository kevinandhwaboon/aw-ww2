// Placeholder unit markers until real sprites exist (08-art-pipeline): a team-colored badge with a
// 2-letter code, plus small HP and veterancy overlays.

import { UNITS, type UnitTypeId } from "../engine/data/units";
import type { VeterancyLevel } from "../engine/data/veterancy";
import { activePack, playerArt } from "./artPack";
import { drawPixelText, GLYPH_HEIGHT, textWidth } from "./pixelFont";
import { TILE_SIZE } from "./placeholderTiles";

export const UNIT_CODES: Record<UnitTypeId, string> = {
  infantry: "IN", assaultInfantry: "AI", mortar: "MO", recon: "RC", halftrack: "HT", supplyTruck: "ST",
  lightTank: "LT", mediumTank: "MT", heavyTank: "HV", tankDestroyer: "TD",
  artillery: "AR", rocketArtillery: "RK", mobileAA: "AA", flakGun: "FK", radarStation: "RD", railwayGun: "RG",
  fighter: "FT", bomber: "BM", transportAircraft: "TA", diveBomber: "DB", torpedoBomber: "TR",
  battleship: "BB", destroyer: "DD", submarine: "SS", landingCraft: "LC", torpedoBoat: "TB", carrier: "CV", supplyShip: "SP",
};


function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  return [c, ctx];
}

/** A player's fill and outline in the game being played: their nation's color (08-art-pipeline §12). */
export function playerColors(player: number): readonly [string, string] {
  const art = playerArt(activePack(), player);
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

/** A jerrycan with the embossed X on its side: orange when fuel is low, red when it's empty (05-supply-transport §11). */
export function drawFuelCanBadge(empty: boolean): HTMLCanvasElement {
  const colors = activePack().colors;
  return pixelIcon([
    "..OOOO.",
    ".OLOLOO",
    "OOOOOLO",
    "OBLBLBO",
    "OBBLBBO",
    "OBLBLBO",
    "OBBBBBO",
    "OOOOOOO",
  ], empty ? colors.fuelCanEmpty : colors.fuelCan, empty ? "#ffb0a0" : "#ffd8a0");
}

/**
 * An ammo can with three brass rounds standing in it: the low-ammo warning. Once it's empty, a red
 * cross is drawn over it (05-supply-transport §11).
 */
export function drawAmmoCanBadge(empty: boolean): HTMLCanvasElement {
  const colors = activePack().colors;
  const c = pixelIcon([
    ".O.O.O.",
    "OYOYOYO",
    "OYOYOYO",
    "OOOOOOO",
    "OBBBBBO",
    "OLLLLLO",
    "OBBBBBO",
    "OOOOOOO",
  ], colors.ammoCan, "#c8d088");
  if (!empty) return c;
  // An X corner to corner over the can's 7×7 lower part: rows 1–7.
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  ctx.fillStyle = colors.ammoCanCross;
  for (let i = 0; i < 7; i++) {
    ctx.fillRect(i, 1 + i, 1, 1);
    ctx.fillRect(6 - i, 1 + i, 1, 1);
  }
  return c;
}

/** A cross-braced wooden supply crate, shown over a unit as it's refuelled and rearmed (04-economy §2). */
export function drawSupplyCrateBadge(): HTMLCanvasElement {
  const body = activePack().colors.supplyCrate;
  return pixelIcon([
    "OOOOOOOOO",
    "OLBBBBBLO",
    "OBLBBBLBO",
    "OBBLBLBBO",
    "OBBBLBBBO",
    "OBBLBLBBO",
    "OBLBBBLBO",
    "OLBBBBBLO",
    "OOOOOOOOO",
  ], body, "#e0b870");
}

/**
 * Veterancy chevrons: one for Veteran, three for Elite (03-combat §6). Point up, like a sergeant's
 * stripes, with nothing behind them: the unit shows through between the stripes.
 */
export function drawVeterancyBadge(level: Exclude<VeterancyLevel, "rookie">): HTMLCanvasElement {
  const count = level === "elite" ? 3 : 1;
  const [c, ctx] = canvas(5, count * 2 + 1);
  ctx.fillStyle = "#f0d040";
  for (let i = 0; i < count; i++) {
    // A "^" shape: 5 wide, 3 tall; chevrons stack every 2 rows.
    for (const [x, dy] of [[0, 2], [1, 1], [2, 0], [3, 1], [4, 2]] as const) ctx.fillRect(x, i * 2 + dy, 1, 1);
  }
  return c;
}
