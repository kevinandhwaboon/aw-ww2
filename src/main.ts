import type { Scenario } from "./engine/scenario";
import { loadArtPack } from "./game/loadArtPack";
import { SCENARIOS } from "./scenarios";
import { startSession } from "./session";
import { defaultComputerPlayers, showTitleScreen, type GameOptions } from "./ui/screens";
import { greedyAi } from "./ai/greedy";
import "./ui/style.css";

// URL options for testing (11-tech-setup §7):
//   ?map=bocage-country  skips the menus and starts that scenario
//   ?seed=123            fixes the luck rolls
//   ?luck=off            turns luck off
//   ?handoff=off         skips the pass-the-device screen
//   ?battle=off          plays attacks on the map instead of as battle scenes
//   ?battle=demo         the battle preview page (src/game/battle/preview.ts)
//   ?pack=night-ops      uses that art pack (08-art-pipeline §13)
//   ?debug=on            shows the unit and debug panels
//   ?ai=1                the computer plays these players (comma-separated ids; ?ai=0,1 watches AI vs AI,
//                        ?ai=none is all human). Without it, the computer plays everyone but the first player.
//   ?pad=on / ?pad=off   forces the phone game-pad layout on or off (on by default on small touch screens)
const params = new URLSearchParams(window.location.search);
const seedParam = Number(params.get("seed") ?? NaN);
const aiParam = params.get("ai");
const computerParam = aiParam === null ? null : aiParam === "none" ? [] : aiParam.split(",").map(Number).filter(Number.isInteger);

const gameRoot = document.getElementById("game");
const uiRoot = document.getElementById("ui");
if (!gameRoot || !uiRoot) throw new Error("index.html is missing #game or #ui");

const padParam = params.get("pad");
const smallTouchScreen = window.matchMedia("(pointer: coarse)").matches && Math.min(window.innerWidth, window.innerHeight) < 600;
const padLayout = padParam === "on" || (padParam !== "off" && smallTouchScreen);

const defaults: GameOptions = {
  luck: params.get("luck") !== "off",
  passDevice: params.get("handoff") !== "off",
  battleScenes: params.get("battle") !== "off",
  computer: computerParam,
};

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
    battleScenes: options.battleScenes,
    ais: scenario.setup.players.map((_, id) => ((options.computer ?? defaultComputerPlayers(scenario)).includes(id) ? greedyAi() : null)),
    debug: params.get("debug") === "on",
    pad: padLayout,
    onNewGame: () => window.location.reload(),
  });
}

await loadArtPack(params.get("pack") ?? "default");

const direct = SCENARIOS.find((s) => s.id === params.get("map"));
if (params.get("battle") === "demo") {
  const { startBattlePreview } = await import("./game/battle/preview");
  startBattlePreview(gameRoot, params);
} else if (direct) start(gameRoot, uiRoot, direct, defaults);
else showTitleScreen(uiRoot, SCENARIOS, defaults, (scenario, options) => start(gameRoot, uiRoot, scenario, options));
