import type { Scenario } from "./engine/scenario";
import { loadArtPack } from "./game/loadArtPack";
import { SCENARIOS } from "./scenarios";
import { startSession } from "./session";
import { defaultComputerPlayers, showMapSelect, showTitleScreen, type GameOptions } from "./ui/screens";
import { greedyAi } from "./ai/greedy";
import { weightsFor } from "./ai/weights";
import { setPolish } from "./game/battle/angled/mesh";
import { parseUrlOptions, withCommanders, withNations } from "./urlOptions";
import { sounds } from "./game/sound/player";
import "./ui/style.css";
import { readAutosave, writeAutosave, type Autosave } from "./autosave";
import { createGame } from "./engine/setup";
import type { GameState } from "./engine/state";

const url = parseUrlOptions(new URLSearchParams(window.location.search));
setPolish(url.polish);
if (!url.sound) sounds.forceOff();

const gameRoot = document.getElementById("game");
const uiRoot = document.getElementById("ui");
if (!gameRoot || !uiRoot) throw new Error("index.html is missing #game or #ui");

const smallTouchScreen = window.matchMedia("(pointer: coarse)").matches && Math.min(window.innerWidth, window.innerHeight) < 600;
const padLayout = url.pad ?? smallTouchScreen;

const defaults: GameOptions = {
  luck: url.luck,
  fog: url.fog,
  passDevice: url.passDevice,
  battleScenes: url.battleScenes,
  computer: url.computer,
  level: url.level,
  commanders: url.commanders,
};

/** Where the autosave is kept (11-tech-setup §3j); null where the browser blocks storage. */
const store = (() => {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
})();
const scenarioIds = SCENARIOS.map((s) => s.id);
/** A failed autosave is logged once, not after every move. */
let autosaveWarned = false;

/** Starts a new game on this map, or, given the autosave, carries that one on. */
function start(game: HTMLElement, ui: HTMLElement, scenario: Scenario, options: GameOptions, saved?: Autosave): void {
  const session = startSession({
    gameRoot: game,
    uiRoot: ui,
    game: saved?.state ?? newGame(scenario, options),
    resumed: saved !== undefined,
    onChange: (state) => {
      if (!writeAutosave(store, { scenarioId: scenario.id, options, state }) && !autosaveWarned) {
        autosaveWarned = true;
        console.warn("Couldn't autosave the game: browser storage is blocked or full");
      }
    },
    passDevice: options.passDevice,
    battleScenes: options.battleScenes,
    ais: scenario.setup.players.map((_, id) => ((options.computer ?? defaultComputerPlayers(scenario)).includes(id) ? greedyAi(weightsFor(options.level)) : null)),
    debug: url.debug,
    pad: padLayout,
    // Back to the map select, keeping the options just played with.
    onNewGame: () => {
      session.end();
      showMapSelect(ui, SCENARIOS, options, (next, nextOptions) => start(game, ui, next, nextOptions));
    },
  });
}

function newGame(scenario: Scenario, options: GameOptions): GameState {
  return createGame({
    ...scenario.setup,
    players: withCommanders(withNations(scenario.setup.players, url.nations), options.commanders),
    seed: url.seed ?? Math.floor(Math.random() * 2 ** 32),
    // A map that always has fog (the Battle of Britain) keeps it whatever the box said (19-fog-of-war §1).
    settings: { ...scenario.setup.settings, luck: options.luck, fogOfWar: options.fog || scenario.setup.settings?.fogOfWar === true },
    // ?weather= replaces the forecast for testing; the map keeps its season's art (12-weather).
    ...(url.weather === null
      ? {}
      : { weather: { season: scenario.setup.weather?.season ?? "summer", forecast: [{ fromDay: 1, weather: url.weather }] } }),
  });
}

await loadArtPack(url.pack);

const direct = SCENARIOS.find((s) => s.id === url.map);
if (url.battleDemo) {
  const { startBattlePreview } = await import("./game/battle/preview");
  startBattlePreview(gameRoot, new URLSearchParams(window.location.search));
} else if (direct) start(gameRoot, uiRoot, direct, defaults);
else {
  // The title screen offers Continue when a game was left unfinished on this device.
  const saved = readAutosave(store, scenarioIds);
  const savedScenario = saved && SCENARIOS.find((s) => s.id === saved.scenarioId);
  const resume = saved && savedScenario ? { label: `${savedScenario.name} · Day ${saved.state.day}`, go: () => start(gameRoot, uiRoot, savedScenario, saved.options, saved) } : null;
  showTitleScreen(uiRoot, SCENARIOS, defaults, (scenario, options) => start(gameRoot, uiRoot, scenario, options), resume);
}
