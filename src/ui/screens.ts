// The screens around a game: title, map select and players (00-master-design §12, HTML full screens).

import { NATIONS } from "../engine/data/nations";
import type { Scenario } from "../engine/scenario";
import { commandersFor } from "../urlOptions";
import { commanderPicker, type CommanderPicker } from "./commanders";
import { defaultComputerPlayers } from "./computerPlayers";
import { el } from "./dom";
import type { GameOptions } from "./gameOptions";
import { menuKeys } from "./menuKeys";
import { playFeatureShot } from "./featureShot";
import { drawSketch, featureColor, featureName } from "./sketchCanvas";
import { sketchMap, SKETCH_FEATURES } from "./terrainSketch";
import { BATTLE_PLACES, project, THEATER_IDS, THEATERS, type BattlePlace, type TheaterId } from "./theaters";
import { WorldMap } from "./worldMap";

export { defaultComputerPlayers };
export type { GameOptions };

type OnStart = (scenario: Scenario, options: GameOptions) => void;

function screen(root: HTMLElement): { node: HTMLElement; close: () => void } {
  const node = el("div", "screen");
  root.append(node);
  return { node, close: () => node.remove() };
}

/** A game left unfinished on this device (11-tech-setup §3j): what to call it, and how to carry it on. */
export interface ResumeChoice {
  readonly label: string;
  readonly go: () => void;
}

export function showTitleScreen(root: HTMLElement, scenarios: readonly Scenario[], defaults: GameOptions, onStart: OnStart, resume: ResumeChoice | null = null): void {
  const { node, close } = screen(root);
  const panel = el("div", "panel screen-panel title-panel");
  const play = el("button", "btn btn-big", "New Game");
  play.addEventListener("click", () => {
    close();
    showMapSelect(root, scenarios, defaults, onStart, undefined, resume);
  });
  panel.append(el("h1", "title-name", "WW2"), el("div", "title-sub", "Play the computer, or a friend on one device"));
  const buttons = [play];
  if (resume) {
    // Continue comes first, so Z on the title screen carries the game on.
    const carryOn = el("button", "btn btn-big", "Continue");
    carryOn.addEventListener("click", () => {
      close();
      resume.go();
    });
    panel.append(carryOn, el("div", "title-sub", resume.label));
    buttons.unshift(carryOn);
  }
  panel.append(play);
  node.append(panel);
  buttons[0]?.focus();
  menuKeys(panel, buttons);
}

function matchup(scenario: Scenario): string {
  return scenario.setup.players.map((p) => NATIONS[p.nation].name).join(" vs ");
}

function checkbox(label: string, checked: boolean): { row: HTMLElement; input: HTMLInputElement } {
  const row = el("label", "option");
  const input = el("input");
  input.type = "checkbox";
  input.checked = checked;
  row.append(input, label);
  return { row, input };
}

/** A built-in map with the place it was fought; maps without one aren't on the world map. */
interface Placed {
  readonly scenario: Scenario;
  readonly place: BattlePlace;
}

/**
 * Step one of a new game: the map, picked on a world map (00-master-design §12). Left and Right
 * switch theater and the camera flies there; Up and Down pick a battle in it, which shows its terrain
 * sketch and the unit it's about in a battle scene; Z (or a second click) moves on to the players
 * screen and X goes back to the title.
 */
export function showMapSelect(
  root: HTMLElement,
  scenarios: readonly Scenario[],
  defaults: GameOptions,
  onStart: OnStart,
  initial?: Scenario,
  resume: ResumeChoice | null = null,
): void {
  const { node, close: closeScreen } = screen(root);
  const placed: Placed[] = scenarios.flatMap((scenario) => {
    const place = BATTLE_PLACES[scenario.id];
    return place ? [{ scenario, place }] : [];
  });
  const theaters = THEATER_IDS.filter((id) => placed.some((p) => p.place.theater === id));
  const panel = el("div", "panel screen-panel map-select");

  // Theater tabs along the top.
  const tabs = el("div", "theater-tabs");
  const tabButtons = new Map<TheaterId, HTMLButtonElement>();
  for (const id of theaters) {
    const tab = el("button", "theater-tab", THEATERS[id].name);
    tab.tabIndex = -1;
    tab.addEventListener("click", () => {
      showTheater(id);
    });
    tabs.append(tab);
    tabButtons.set(id, tab);
  }

  // The world map, with a label beside each dot and the theater's battles listed under it.
  const world = new WorldMap();
  const mapFrame = el("div", "world-map");
  const labels = el("div", "world-labels");
  mapFrame.append(world.canvas, labels);
  const list = el("div", "map-list");
  const left = el("div", "map-select-left");
  left.append(mapFrame, list);

  // The briefing: name, where and when, the moving picture, the terrain sketch, and the facts.
  const name = el("div", "panel-title");
  const whereWhen = el("div", "map-where");
  const shotCanvas = el("canvas", "feature-shot");
  const shotCaption = el("div", "feature-caption");
  const shotFrame = el("div", "feature-frame");
  shotFrame.append(shotCanvas, shotCaption);
  const sketchCanvas = el("canvas", "terrain-sketch");
  const legend = el("div", "sketch-legend");
  const sketchFrame = el("div", "sketch-frame");
  sketchFrame.append(sketchCanvas, legend);
  const details = el("div", "map-details");
  const description = el("div", "map-description");
  const next = el("button", "btn btn-big map-next", "Choose this battle");
  next.tabIndex = -1;
  const brief = el("div", "map-brief");
  brief.append(name, whereWhen, shotFrame, sketchFrame, details, description, next);

  const body = el("div", "map-select-body");
  body.append(left, brief);
  panel.append(el("div", "panel-title", "Choose a battle"), el("div", "screen-hint", "← → theater · ↑ ↓ battle · Z choose · X back"), tabs, body);
  node.append(panel);

  let theater: TheaterId = theaters[0] ?? "europe";
  let chosen: Placed | undefined;
  let stopShot: () => void = () => {};
  /** The battle last picked in each theater, so coming back finds it again. */
  const lastIn = new Map<TheaterId, Placed>();
  const rows = new Map<Placed, HTMLButtonElement>();
  const labelFor = new Map<Placed, HTMLButtonElement>();

  const close = () => {
    stopShot();
    world.stop();
    closeScreen();
  };
  const confirm = () => {
    if (!chosen) return;
    const { scenario } = chosen;
    close();
    showPlayerSelect(root, scenarios, scenario, defaults, onStart, resume);
  };
  next.addEventListener("click", confirm);

  const inTheater = () => placed.filter((p) => p.place.theater === theater);

  function placeLabels(): void {
    const view = world.currentView;
    for (const [p, label] of labelFor) {
      const at = project(view, p.place.lon, p.place.lat);
      label.style.left = `${(at.x * 100).toFixed(2)}%`;
      label.style.top = `${(at.y * 100).toFixed(2)}%`;
      label.hidden = at.x < 0 || at.x > 1 || at.y < 0 || at.y > 1;
    }
  }
  world.onMove = placeLabels;

  function showTheater(id: TheaterId, pick?: Placed, instant = false): void {
    theater = id;
    for (const [tid, tab] of tabButtons) tab.classList.toggle("selected", tid === id);
    world.flyTo(THEATERS[id].view, instant);
    list.replaceChildren();
    labels.replaceChildren();
    rows.clear();
    labelFor.clear();
    const here = inTheater();
    for (const p of here) {
      const row = el("button", "list-row", p.scenario.name);
      row.addEventListener("click", () => {
        if (chosen === p) confirm();
        else choose(p);
      });
      list.append(row);
      rows.set(p, row);
      const label = el("button", `world-label ${p.place.label ?? ""}`, p.scenario.name);
      label.tabIndex = -1;
      label.addEventListener("click", () => {
        if (chosen === p) confirm();
        else choose(p);
      });
      labels.append(label);
      labelFor.set(p, label);
    }
    placeLabels();
    // Every battle anywhere keeps its dot, so the world view on the way shows them all.
    const first = pick ?? lastIn.get(id) ?? here[0];
    if (first) choose(first);
  }

  function choose(p: Placed): void {
    chosen = p;
    lastIn.set(p.place.theater, p);
    world.setDots(
      placed.map((q) => ({ id: q.scenario.id, lon: q.place.lon, lat: q.place.lat })),
      p.scenario.id,
    );
    for (const [q, row] of rows) row.classList.toggle("selected", q === p);
    for (const [q, label] of labelFor) label.classList.toggle("selected", q === p);
    rows.get(p)?.focus();
    const { scenario, place } = p;
    const { map, units } = scenario.setup;
    const season = scenario.setup.weather?.season ?? "summer";
    name.textContent = scenario.name;
    whereWhen.textContent = `${place.where} · ${place.when}`;
    details.textContent = `${matchup(scenario)} · ${map.width}×${map.height} · ${units?.length ?? 0} units`;
    description.textContent = scenario.description;
    shotCaption.textContent = place.feature;
    stopShot();
    stopShot = playFeatureShot(shotCanvas, scenario, place.shot);
    const sketch = sketchMap(map);
    drawSketch(sketchCanvas, sketch, season);
    legend.replaceChildren(
      ...SKETCH_FEATURES.filter((f) => sketch.cells.includes(f)).map((f) => {
        const item = el("span", "legend-item");
        const swatch = el("span", "legend-swatch");
        swatch.style.background = featureColor(f, season);
        item.append(swatch, featureName(f));
        return item;
      }),
    );
  }

  panel.onkeydown = (event) => {
    event.stopPropagation();
    const { key } = event;
    if (key === "ArrowLeft" || key === "ArrowRight") {
      event.preventDefault();
      const i = theaters.indexOf(theater);
      const nextTheater = theaters[(i + (key === "ArrowRight" ? 1 : -1) + theaters.length) % theaters.length];
      if (nextTheater && nextTheater !== theater) showTheater(nextTheater);
    } else if (key === "ArrowUp" || key === "ArrowDown") {
      event.preventDefault();
      const here = inTheater();
      const i = chosen ? here.indexOf(chosen) : -1;
      const p = here[(i + (key === "ArrowDown" ? 1 : -1) + here.length) % here.length];
      if (p) choose(p);
    } else if (["z", "Z", "Enter", " "].includes(key)) {
      event.preventDefault();
      if (!event.repeat) confirm();
    } else if (["x", "X", "Escape", "Backspace"].includes(key)) {
      event.preventDefault();
      if (!event.repeat) {
        close();
        showTitleScreen(root, scenarios, defaults, onStart, resume);
      }
    }
  };

  const start = placed.find((p) => p.scenario === initial) ?? placed[0];
  if (start) showTheater(start.place.theater, start, true);
}

/**
 * Step two of a new game: who plays each side and under which commander (06-commanders §5), then
 * the options and Start. Up and Down walk every control, Left and Right change the commander in
 * focus, and X goes back to the maps with everything chosen here kept.
 */
export function showPlayerSelect(
  root: HTMLElement,
  scenarios: readonly Scenario[],
  scenario: Scenario,
  defaults: GameOptions,
  onStart: OnStart,
  resume: ResumeChoice | null = null,
): void {
  const { node, close } = screen(root);
  const panel = el("div", "panel screen-panel map-panel");

  const chosenIds = defaults.computer ?? defaultComputerPlayers(scenario);
  const players = el("div", "player-options");
  const computerBoxes: HTMLInputElement[] = [];
  const commanderPickers: CommanderPicker[] = [];
  scenario.setup.players.forEach((player, id) => {
    const allowed = commandersFor(player.nation);
    const wanted = defaults.commanders[id] ?? null;
    const picker = commanderPicker(player.name, allowed, wanted !== null && allowed.includes(wanted) ? wanted : null);
    const box = checkbox(`Computer plays ${player.name}`, chosenIds.includes(id));
    players.append(el("div", "player-name", `${player.name} (${NATIONS[player.nation].name})`), picker.row, box.row);
    computerBoxes.push(box.input);
    commanderPickers.push(picker);
  });

  const luck = checkbox("Luck in combat", defaults.luck);
  const fog = checkbox("Fog of war", defaults.fog);
  const passDevice = checkbox("Pass-the-device screen between turns", defaults.passDevice);
  const battleScenes = checkbox("Battle scenes", defaults.battleScenes);
  const easy = checkbox("Easy computer opponent", defaults.level === "easy");
  const options = (): GameOptions => ({
    luck: luck.input.checked,
    fog: fog.input.checked,
    passDevice: passDevice.input.checked,
    battleScenes: battleScenes.input.checked,
    computer: computerBoxes.flatMap((box, id) => (box.checked ? [id] : [])),
    level: easy.input.checked ? "easy" : "normal",
    commanders: commanderPickers.map((picker) => picker.chosen),
  });
  const start = el("button", "btn btn-big", "Start");
  start.addEventListener("click", () => {
    close();
    onStart(scenario, options());
  });

  panel.append(
    el("div", "panel-title", scenario.name),
    el("div", "screen-hint", "↑ ↓ move · ← → change commander · Z choose · X back to maps"),
    players,
    easy.row,
    el("div", "panel-subtitle", "Options"),
    luck.row,
    fog.row,
    passDevice.row,
    battleScenes.row,
    start,
  );
  node.append(panel);
  // Starts on the first commander; Up from there wraps round to Start.
  commanderPickers[0]?.button.focus();
  menuKeys(
    panel,
    [
      ...commanderPickers.flatMap((picker, id) => [picker.button, ...(computerBoxes[id] ? [computerBoxes[id]] : [])]),
      easy.input,
      luck.input,
      fog.input,
      passDevice.input,
      battleScenes.input,
      start,
    ],
    () => {
      close();
      showMapSelect(root, scenarios, options(), onStart, scenario, resume);
    },
  );
}
