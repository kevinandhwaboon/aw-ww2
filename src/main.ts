import type { Scenario } from "./engine/scenario";
import { loadArtPack } from "./game/loadArtPack";
import { SCENARIOS, SURVIVAL_SCENARIOS } from "./scenarios";
import { SURVIVAL_MAPS } from "./survival/maps";
import { beatHistory, bestRun, describeRun, ordinal, placeOf, readRecords, runOf, withRun, writeRecords } from "./survival/record";
import { showSurvival, type SurvivalEntry } from "./ui/survival";
import { startSession } from "./session";
import { defaultComputerPlayers, showMapSelect, showTitleScreen, type GameOptions, type ResumeChoice, type TitleChoices } from "./ui/screens";
import { campaignAi, survivalAi, survivalDefenderAi } from "./ai/maps";
import { MISSIONS } from "./campaign/missions";
import { alliesWon, campaignComplete, missionStatus, missionsWon, readProgress, withWin, writeProgress } from "./campaign/progress";
import { missionScenario } from "./campaign/setup";
import { showCampaign, type CampaignEntry } from "./ui/campaign";
import { showEnding } from "./ui/ending";
import { summaryLine } from "./game/ending/plan";
import { greedyAi } from "./ai/greedy";
import { weightsFor } from "./ai/weights";
import { setPolish } from "./game/battle/angled/mesh";
import { parseUrlOptions, withCommanders, withNations } from "./urlOptions";
import { sounds } from "./game/sound/player";
import "./ui/style.css";
import { readAutosave, writeAutosave, type Autosave } from "./autosave";
import { createGame } from "./engine/setup";
import type { GameState } from "./engine/state";
import { startGamepad } from "./ui/gamepad";

const url = parseUrlOptions(new URLSearchParams(window.location.search));
setPolish(url.polish);
if (!url.sound) sounds.forceOff();

const gameRoot = document.getElementById("game");
const uiRoot = document.getElementById("ui");
if (!gameRoot || !uiRoot) throw new Error("index.html is missing #game or #ui");

const smallTouchScreen = window.matchMedia("(pointer: coarse)").matches && Math.min(window.innerWidth, window.innerHeight) < 600;
const padLayout = url.pad ?? smallTouchScreen;
// A game controller (Xbox pad, ROG Ally) plays like the keyboard: A is Z, B is X (11-tech-setup §3c).
startGamepad();

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
const scenarioIds = [...SCENARIOS, ...SURVIVAL_SCENARIOS].map((s) => s.id);
/** A failed autosave is logged once, not after every move. */
let autosaveWarned = false;

/** Every campaign mission with its own scenario, advantage included (22-campaign §2, §4). */
const campaign: readonly CampaignEntry[] = MISSIONS.flatMap((mission) => {
  const scenario = SCENARIOS.find((s) => s.id === mission.map);
  return scenario ? [{ mission, scenario: missionScenario(scenario, mission) }] : [];
});

/** Every survival map with its scenario (23-survival §2). */
const survivalMaps: readonly SurvivalEntry[] = SURVIVAL_MAPS.flatMap((survival) => {
  const scenario = SURVIVAL_SCENARIOS.find((s) => s.id === survival.map);
  return scenario ? [{ survival, scenario }] : [];
});

/** What the results screen says after a campaign mission (22-campaign §7). */
function missionNote(entry: CampaignEntry, state: GameState): string {
  if (!alliesWon(state)) return "Mission lost. Try it again from the Campaign.";
  const next = campaign[campaign.indexOf(entry) + 1];
  return next ? `Mission won. ${next.scenario.name} is open.` : "Mission won. The campaign is complete.";
}

/** The title screen's choices besides Skirmish, with this game to carry on, if any. */
function titleChoices(game: HTMLElement, ui: HTMLElement, resume: ResumeChoice | null): TitleChoices {
  return {
    campaign: () => openCampaign(game, ui, resume),
    survival: () => openSurvival(game, ui, resume),
    resume,
    showcase: SURVIVAL_SCENARIOS,
    notes: titleNotes(),
  };
}

/** The player's progress under each way to play on the title screen. */
function titleNotes(): { campaign?: string; survival?: string } {
  const missions = campaign.map((e) => e.mission);
  const won = missionsWon(missions, readProgress(store));
  const records = readRecords(store);
  const best = survivalMaps.flatMap((e) => {
    const run = bestRun(records, e.scenario.id);
    return run ? [`${e.scenario.name}: wave ${run.wave}`] : [];
  });
  return {
    ...(won > 0 ? { campaign: `${won} of ${missions.length} missions won` } : {}),
    ...(best.length > 0 ? { survival: `Best · ${best.join(" · ")}` } : {}),
  };
}

const backToTitle = (game: HTMLElement, ui: HTMLElement, resume: ResumeChoice | null) => () =>
  showTitleScreen(ui, SCENARIOS, defaults, (scenario, options) => start(game, ui, scenario, options), titleChoices(game, ui, resume));

/** The Survival screen (23-survival §7); X goes back to the title. */
function openSurvival(game: HTMLElement, ui: HTMLElement, resume: ResumeChoice | null, at?: string): void {
  showSurvival(
    ui,
    survivalMaps,
    readRecords(store),
    defaults,
    (entry, options) => start(game, ui, entry.scenario, options, undefined, undefined, entry),
    backToTitle(game, ui, resume),
    at,
  );
}

/** The high scores before this game, kept so the results can say where it placed. */
let bestBefore: ReturnType<typeof readRecords> = {};

/** What the results screen says after a survival game (23-survival §5e, §7). */
function survivalNote(entry: SurvivalEntry, state: GameState): string {
  const run = runOf(state);
  const lines = [describeRun(run)];
  const place = placeOf(bestBefore, entry.scenario.id, run);
  if (place === 1) lines.push("New best");
  else if (place !== null) lines.push(`${ordinal(place)} best run`);
  lines.push(beatHistory(entry.survival, run) ? `Held longer than history: ${entry.survival.historyLine}` : `History: ${entry.survival.historyLine}`);
  return lines.join(" · ");
}

/** The campaign screen; X goes back to the title. `at` picks the mission it opens on. */
function openCampaign(game: HTMLElement, ui: HTMLElement, resume: ResumeChoice | null, at?: string): void {
  const progress = readProgress(store);
  const missions = campaign.map((e) => e.mission);
  showCampaign(
    ui,
    campaign,
    progress,
    defaults,
    (entry, options) => start(game, ui, entry.scenario, options, undefined, entry),
    () => showTitleScreen(ui, SCENARIOS, defaults, (scenario, options) => start(game, ui, scenario, options), titleChoices(game, ui, resume)),
    at,
    // Once the campaign is complete its ending can be watched again (22-campaign §7a).
    campaignComplete(missions, progress) ? () => playEnding(ui, () => openCampaign(game, ui, resume, at)) : null,
  );
}

/** The campaign's ending, the surrender on the Missouri (22-campaign §7a), then `then`. */
function playEnding(ui: HTMLElement, then: () => void): void {
  const missions = campaign.map((e) => e.mission);
  showEnding(ui, summaryLine(missionsWon(missions, readProgress(store)), missions.length), then);
}

/** Whether this game is the campaign's last mission, won. */
const wonTheWar = (mission: CampaignEntry | undefined, state: GameState | null): boolean =>
  mission !== undefined && mission === campaign[campaign.length - 1] && state !== null && alliesWon(state);

/**
 * Starts a new game on this map, or, given the autosave, carries that one on. A campaign mission
 * (`mission`) has the campaign's computer, counts a win, and goes back to the campaign afterwards.
 */
function start(
  game: HTMLElement,
  ui: HTMLElement,
  scenario: Scenario,
  options: GameOptions,
  saved?: Autosave,
  mission?: CampaignEntry,
  survival?: SurvivalEntry,
): void {
  if (survival) bestBefore = readRecords(store);
  /** Whether this game's run is already in the high scores. */
  let recorded = saved?.state.result != null;
  const computer = options.computer ?? defaultComputerPlayers(scenario);
  /** The game as it last stood, so what comes after it can depend on how it ended. */
  let latest: GameState | null = saved?.state ?? null;
  const session = startSession({
    gameRoot: game,
    uiRoot: ui,
    game: saved?.state ?? newGame(scenario, options),
    resumed: saved !== undefined,
    onChange: (state) => {
      latest = state;
      const mode = mission ? { campaign: true as const } : survival ? { survival: true as const } : {};
      if (!writeAutosave(store, { scenarioId: scenario.id, options, state, ...mode }) && !autosaveWarned) {
        autosaveWarned = true;
        console.warn("Couldn't autosave the game: browser storage is blocked or full");
      }
      if (mission && alliesWon(state)) writeProgress(store, withWin(readProgress(store), mission.mission.map));
      // The run joins the map's high scores once the game is over, once (23-survival §5e).
      if (survival && state.result && !recorded) {
        recorded = true;
        const commander = state.players[survival.survival.defender]?.commander ?? null;
        const run = { ...runOf(state), date: new Date().toISOString().slice(0, 10), commander };
        writeRecords(store, withRun(readRecords(store), scenario.id, run));
      }
    },
    passDevice: options.passDevice,
    battleScenes: options.battleScenes,
    ais: scenario.setup.players.map((_, id) => {
      if (!computer.includes(id)) return null;
      if (mission) return campaignAi(scenario.id);
      // The waves play the survival plan (23-survival §6); the defender, if the computer plays it, plain Greedy.
      if (survival && id === survival.survival.attacker) return survivalAi();
      if (survival && id === survival.survival.defender) return survivalDefenderAi();
      return greedyAi(weightsFor(options.level));
    }),
    debug: url.debug,
    pad: padLayout,
    ...(mission
      ? {
          afterGame: {
            // Winning the last mission goes on to the ending (22-campaign §7a).
            label: (state: GameState) => (wonTheWar(mission, state) ? "Continue" : "Campaign"),
            note: (state: GameState) => missionNote(mission, state),
          },
        }
      : survival
        ? {
            afterGame: {
              label: () => "Survival",
              note: (state: GameState) => survivalNote(survival, state),
              heading: () => survival.survival.fallen,
            },
          }
        : {}),
    // Back to the campaign, the Survival screen or the map select, keeping the options just played with.
    onNewGame: () => {
      session.end();
      if (mission && wonTheWar(mission, latest)) {
        playEnding(ui, () => openCampaign(game, ui, null, mission.mission.map));
      } else if (mission) {
        // Opens on the next mission when this one was just won.
        const progress = readProgress(store);
        const i = campaign.indexOf(mission);
        const next = campaign[i + 1];
        const at = next && missionStatus(campaign.map((e) => e.mission), progress, i + 1) !== "locked" ? next : mission;
        openCampaign(game, ui, null, at.mission.map);
      } else if (survival) {
        openSurvival(game, ui, null, scenario.id);
      } else showMapSelect(ui, SCENARIOS, options, (next, nextOptions) => start(game, ui, next, nextOptions), titleChoices(game, ui, null));
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
// ?map= also opens a survival map, as a survival game (23-survival §7).
const directSurvival = survivalMaps.find((e) => e.scenario.id === url.map);
if (url.battleDemo) {
  const { startBattlePreview } = await import("./game/battle/preview");
  startBattlePreview(gameRoot, new URLSearchParams(window.location.search));
} else if (direct) start(gameRoot, uiRoot, direct, defaults);
else if (directSurvival) start(gameRoot, uiRoot, directSurvival.scenario, defaults, undefined, undefined, directSurvival);
else if (url.ending) {
  // ?ending=on: the campaign's ending on its own, for checking it (11-tech-setup §7).
  playEnding(uiRoot, () => showTitleScreen(uiRoot, SCENARIOS, defaults, (scenario, options) => start(gameRoot, uiRoot, scenario, options), titleChoices(gameRoot, uiRoot, null)));
} else {
  // The title screen offers Continue when a game was left unfinished on this device.
  const saved = readAutosave(store, scenarioIds);
  const savedScenario = saved && [...SCENARIOS, ...SURVIVAL_SCENARIOS].find((s) => s.id === saved.scenarioId);
  const savedSurvival = saved?.survival ? survivalMaps.find((e) => e.scenario.id === saved.scenarioId) : undefined;
  const savedMission = saved?.campaign ? campaign.find((e) => e.mission.map === saved.scenarioId) : undefined;
  const resume =
    saved && savedScenario
      ? {
          label: `${savedMission ? "Campaign: " : savedSurvival ? "Survival: " : ""}${savedScenario.name} · Day ${saved.state.day}`,
          go: () => start(gameRoot, uiRoot, savedMission?.scenario ?? savedScenario, saved.options, saved, savedMission, savedSurvival),
        }
      : null;
  showTitleScreen(uiRoot, SCENARIOS, defaults, (scenario, options) => start(gameRoot, uiRoot, scenario, options), titleChoices(gameRoot, uiRoot, resume));
}
