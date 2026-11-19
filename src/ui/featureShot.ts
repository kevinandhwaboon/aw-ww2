// The map select's moving picture (00-master-design §12): the battle scene of the unit a map is
// about, looped and cropped to a letterbox, with a slow camera drift. Drawn with the battle scenes'
// own canvas renderers (08-art-pipeline §18, §20), so it needs no Phaser game.

import type { Scenario } from "../engine/scenario";
import { setGameNations } from "../game/artPack";
import { SCENE } from "../game/battle/backdrops";
import { setBattleWeather } from "../game/battle/colors";
import { DropRenderer } from "../game/battle/dropRenderer";
import { BattleRenderer } from "../game/battle/renderer";
import { drawSnowfall } from "../game/battle/snowfall";
import { dropPlan, shotPlan } from "./featurePlan";
import type { FeatureShot } from "./theaters";

/** How far the camera drifts sideways over one loop, in scene pixels. */
const DRIFT = 10;

/**
 * Plays `shot` for `scenario` on `view` until stopped. The canvas is sized to the crop; CSS scales
 * it up with nearest-neighbor pixels.
 */
export function playFeatureShot(view: HTMLCanvasElement, scenario: Scenario, shot: FeatureShot): () => void {
  const season = scenario.setup.weather?.season ?? "summer";
  const snowing = season === "winter";
  const setup = () => {
    // The scene reads the game's nations and weather; the game sets both again when it starts.
    setGameNations(scenario.setup.players.map((p) => p.nation));
    setBattleWeather({ season, snowing, raining: false });
  };
  setup();
  const source = document.createElement("canvas");
  source.width = SCENE.width;
  source.height = SCENE.height;
  const renderer = shot.kind === "battle" ? new BattleRenderer(shotPlan(scenario, shot), source) : new DropRenderer(dropPlan(scenario, shot), source);
  const [cx, cy, cw, ch] = shot.crop;
  view.width = cw;
  view.height = ch;
  const ctx = view.getContext("2d");
  const sourceCtx = source.getContext("2d");
  if (!ctx || !sourceCtx) return () => {};
  ctx.imageSmoothingEnabled = false;
  // Loop the action, not the fade-out at the end.
  const loop = Math.max(1000, renderer.total - 300);
  const started = performance.now();
  let frame = 0;
  const draw = (now: number) => {
    const t = (now - started) % loop;
    setup();
    renderer.render(t);
    if (snowing) drawSnowfall(sourceCtx, t);
    // The camera eases from one side to the other and back, a whole pixel at a time.
    const sway = (1 - Math.cos(((now - started) / (loop * 2)) * Math.PI * 2)) / 2;
    const x = Math.max(0, Math.min(SCENE.width - cw, Math.round(cx - DRIFT / 2 + sway * DRIFT)));
    ctx.drawImage(source, x, cy, cw, ch, 0, 0, cw, ch);
    frame = requestAnimationFrame(draw);
  };
  frame = requestAnimationFrame(draw);
  return () => cancelAnimationFrame(frame);
}
