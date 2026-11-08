// Snow drifting down over a battle scene while it snows (12-weather §5, 08-art-pipeline §21).
// A function of time only, so a frozen preview frame shows the same flakes as the playing scene.

import { packColor } from "../artPack";
import { SCENE } from "./backdrops";

const FLAKES = 140;

export function drawSnowfall(ctx: CanvasRenderingContext2D, t: number): void {
  const flake = packColor("snowfall");
  const shadow = packColor("snowfallShadow");
  for (let i = 0; i < FLAKES; i++) {
    const fall = 0.02 + ((i * 13) % 5) * 0.006; // pixels per millisecond
    const y = ((((i * 104729) % 997) / 997) * SCENE.height + t * fall) % SCENE.height;
    const drift = (((i * 7919) % 1009) / 1009) * SCENE.width + Math.sin(t / 700 + i) * 4 - t * 0.008;
    const x = ((drift % SCENE.width) + SCENE.width) % SCENE.width;
    const size = i % 5 === 0 ? 2 : 1;
    // A faint shadow below each flake, so it shows over snowy ground as well as over the sky.
    ctx.fillStyle = shadow;
    ctx.globalAlpha = 0.3;
    ctx.fillRect(Math.round(x) + 1, Math.round(y) + 1, size, size);
    ctx.fillStyle = flake;
    ctx.globalAlpha = i % 3 === 0 ? 0.95 : 0.75;
    ctx.fillRect(Math.round(x), Math.round(y), size, size);
  }
  ctx.globalAlpha = 1;
}
