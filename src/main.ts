import type { Scenario } from "./engine/scenario";
import { loadArtPack } from "./game/loadArtPack";
import { SCENARIOS } from "./scenarios";
import { startSession } from "./session";
import { defaultComputerPlayers, showTitleScreen, type GameOptions } from "./ui/screens";
import { greedyAi } from "./ai/greedy";
import { weightsFor } from "./ai/weights";
import { setPolish } from "./game/battle/angled/mesh";
import { parseUrlOptions } from "./urlOptions";
import "./ui/style.css";

const url = parseUrlOptions(new URLSearchParams(window.location.search));
setPolish(url.polish);

const gameRoot = document.getElementById("game");
const uiRoot = document.getElementById("ui");
if (!gameRoot || !uiRoot) throw new Error("index.html is missing #game or #ui");

const smallTouchScreen = window.matchMedia("(pointer: coarse)").matches && Math.min(window.innerWidth, window.innerHeight) < 600;
const padLayout = url.pad ?? smallTouchScreen;

const defaults: GameOptions = {
  luck: url.luck,
  passDevice: url.passDevice,
  battleScenes: url.battleScenes,
  computer: url.computer,
  level: url.level,
};

function start(game: HTMLElement, ui: HTMLElement, scenario: Scenario, options: GameOptions): void {
  startSession({
    gameRoot: game,
    uiRoot: ui,
    setup: {
      ...scenario.setup,
      seed: url.seed ?? Math.floor(Math.random() * 2 ** 32),
      settings: { ...scenario.setup.settings, luck: options.luck },
    },
    passDevice: options.passDevice,
    battleScenes: options.battleScenes,
    ais: scenario.setup.players.map((_, id) => ((options.computer ?? defaultComputerPlayers(scenario)).includes(id) ? greedyAi(weightsFor(options.level)) : null)),
    debug: url.debug,
    pad: padLayout,
    onNewGame: () => window.location.reload(),
  });
}

await loadArtPack(url.pack);

const direct = SCENARIOS.find((s) => s.id === url.map);
if (url.battleDemo) {
  const { startBattlePreview } = await import("./game/battle/preview");
  startBattlePreview(gameRoot, new URLSearchParams(window.location.search));
} else if (direct) start(gameRoot, uiRoot, direct, defaults);
else showTitleScreen(uiRoot, SCENARIOS, defaults, (scenario, options) => start(gameRoot, uiRoot, scenario, options));
