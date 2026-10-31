import type { Scenario } from "./engine/scenario";
import { SCENARIOS } from "./scenarios";
import { startSession } from "./session";
import { showTitleScreen, type GameOptions } from "./ui/screens";
import "./ui/style.css";

// URL options for testing (11-tech-setup §7):
//   ?map=bocage-country  skips the menus and starts that scenario
//   ?seed=123            fixes the luck rolls
//   ?luck=off            turns luck off
//   ?handoff=off         skips the pass-the-device screen
const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get("seed") ?? NaN);

const gameRoot = document.getElementById("game");
const uiRoot = document.getElementById("ui");
if (!gameRoot || !uiRoot) throw new Error("index.html is missing #game or #ui");

const defaults: GameOptions = { luck: params.get("luck") !== "off", passDevice: params.get("handoff") !== "off" };

function start(game: HTMLElement, ui: HTMLElement, scenario: Scenario, options: GameOptions): void {
  startSession({
    gameRoot: game,
    uiRoot: ui,
    setup: {
      ...scenario.setup,
      seed: Number.isFinite(seedParam) ? seedParam : Math.floor(Math.random() * 2 ** 32),
      settings: { ...scenario.setup.settings, luck: options.luck },
    },
    passDevice: options.passDevice,
    onNewGame: () => window.location.reload(),
  });
}

const direct = SCENARIOS.find((s) => s.id === params.get("map"));
if (direct) start(gameRoot, uiRoot, direct, defaults);
else showTitleScreen(uiRoot, SCENARIOS, defaults, (scenario, options) => start(gameRoot, uiRoot, scenario, options));
