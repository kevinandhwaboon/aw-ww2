// Rain slanting down over a battle scene while it rains (12-weather §5).
// A function of time only, so a frozen preview frame shows the same drops as the playing scene.

import { packColor } from "../artPack";
import { SCENE } from "./backdrops";

const DROPS = 110;
/** How far a drop slants sideways for each pixel it falls. */
const SLANT = 0.25;

export function drawRainfall(ctx: CanvasRenderingContext2D, t: number): void {
  ctx.fillStyle = packColor("rainfall");
  for (let i = 0; i < DROPS; i++) {
    const fall = 0.25 + ((i * 13) % 5) * 0.03; // pixels per millisecond: much faster than snow
    const y = ((((i * 104729) % 997) / 997) * SCENE.height + t * fall) % SCENE.height;
    const start = (((i * 7919) % 1009) / 1009) * SCENE.width - y * SLANT;
    const x = ((start % SCENE.width) + SCENE.width) % SCENE.width;
    const length = 6 + (i % 4);
    ctx.globalAlpha = i % 3 === 0 ? 0.85 : 0.6;
    // A short slanted streak, one pixel wide.
    for (let k = 0; k < length; k++) ctx.fillRect(Math.round(x - k * SLANT), Math.round(y - k), 1, 1);
  }
  ctx.globalAlpha = 1;
}
