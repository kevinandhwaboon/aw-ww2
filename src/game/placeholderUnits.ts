// Placeholder unit markers until real sprites exist (08-art-pipeline): a team-colored badge with a
// 2-letter code, plus small HP and veterancy overlays.

import type { UnitTypeId } from "../engine/data/units";
import type { VeterancyLevel } from "../engine/data/veterancy";
import { drawPixelText, GLYPH_HEIGHT, textWidth } from "./pixelFont";
import { TILE_SIZE } from "./placeholderTiles";

export const UNIT_CODES: Record<UnitTypeId, string> = {
  infantry: "IN", assaultInfantry: "AI", mortar: "MO", recon: "RC", halftrack: "HT",
  lightTank: "LT", mediumTank: "MT", heavyTank: "HV", tankDestroyer: "TD",
  artillery: "AR", rocketArtillery: "RK", mobileAA: "AA", flakGun: "FK",
  fighter: "FT", bomber: "BM", transportAircraft: "TA",
  battleship: "BB", destroyer: "DD", submarine: "SS", landingCraft: "LC", torpedoBoat: "TB",
};

/** Team colors by player index: [fill, outline]. */
export const PLAYER_COLORS: readonly (readonly [string, string])[] = [
  ["#3a6fd8", "#1a3270"],
  ["#c8463a", "#5e1a14"],
  ["#4a9a40", "#1e4418"],
  ["#d8a030", "#6a4a10"],
];

function canvas(width: number, height: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement("canvas");
  c.width = width;
  c.height = height;
  const ctx = c.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  return [c, ctx];
}

export function playerColors(player: number): readonly [string, string] {
  const colors = PLAYER_COLORS[player % PLAYER_COLORS.length];
  if (!colors) throw new Error("No player colors defined");
  return colors;
}

/** 16×16 marker: outlined team-colored badge with the unit code in white. */
export function drawUnitMarker(type: UnitTypeId, player: number): HTMLCanvasElement {
  const [c, ctx] = canvas(TILE_SIZE, TILE_SIZE);
  const [fill, outline] = playerColors(player);
  ctx.fillStyle = outline;
  ctx.fillRect(1, 3, 14, 11);
  ctx.fillRect(2, 2, 12, 13);
  ctx.fillStyle = fill;
  ctx.fillRect(2, 4, 12, 9);
  ctx.fillRect(3, 3, 10, 11);
  ctx.fillStyle = "#ffffff";
  const code = UNIT_CODES[type];
  drawPixelText(ctx, code, Math.floor((TILE_SIZE - textWidth(code)) / 2), 6);
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
