// The screens around a game: title and map select (00-master-design §12, HTML full screens).

import type { AiLevel } from "../ai/weights";
import type { CommanderId } from "../engine/data/commanders";
import { NATIONS } from "../engine/data/nations";
import type { Scenario } from "../engine/scenario";
import { commandersFor } from "../urlOptions";
import { commanderPicker, type CommanderPicker } from "./commanders";
import { defaultComputerPlayers } from "./computerPlayers";
import { el } from "./dom";
import { menuKeys } from "./menuKeys";

export { defaultComputerPlayers };

export interface GameOptions {
  /** Random variation in damage (03-combat §3). */
  readonly luck: boolean;
  /** Hot-seat: stop between turns until the next player says they're ready. */
  readonly passDevice: boolean;
  /** Attacks play as split-screen battle scenes (08-art-pipeline §18). */
  readonly battleScenes: boolean;
  /** Player ids the computer plays (09-ai §5). On the map select, null means everyone not on the first player's side. */
  readonly computer: readonly number[] | null;
  /** How well the computer plays (09-ai §4c). */
  readonly level: AiLevel;
  /** Each player's commander, in player order; null or missing is no commander (06-commanders §5). */
  readonly commanders: readonly (CommanderId | null)[];
}


type OnStart = (scenario: Scenario, options: GameOptions) => void;

function screen(root: HTMLElement): { node: HTMLElement; close: () => void } {
  const node = el("div", "screen");
  root.append(node);
  return { node, close: () => node.remove() };
}

export function showTitleScreen(root: HTMLElement, scenarios: readonly Scenario[], defaults: GameOptions, onStart: OnStart): void {
  const { node, close } = screen(root);
  const panel = el("div", "panel screen-panel title-panel");
  const play = el("button", "btn btn-big", "New Game");
  play.addEventListener("click", () => {
    close();
    showMapSelect(root, scenarios, defaults, onStart);
  });
  panel.append(el("h1", "title-name", "WW2 Tactics"), el("div", "title-sub", "Working title · Play the computer, or a friend on one device"), play);
  node.append(panel);
  play.focus();
  menuKeys(panel, [play]);
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

/**
 * Step one of a new game: the map. Arrows walk the list and Z picks, which moves on to the players
 * screen. Nothing else on this screen takes the focus, so it works from the keyboard alone.
 */
export function showMapSelect(root: HTMLElement, scenarios: readonly Scenario[], defaults: GameOptions, onStart: OnStart, initial?: Scenario): void {
  const { node, close } = screen(root);
  const panel = el("div", "panel screen-panel map-panel");
  const list = el("div", "map-list");
  const name = el("div", "panel-title");
  const details = el("div", "map-details");
  const description = el("div", "map-description");

  const rows = scenarios.map((scenario) => {
    const row = el("button", "list-row", scenario.name);
    row.addEventListener("focus", () => show(scenario));
    row.addEventListener("click", () => {
      close();
      showPlayerSelect(root, scenarios, scenario, defaults, onStart);
    });
    list.append(row);
    return { scenario, row };
  });

  function show(scenario: Scenario): void {
    for (const { scenario: s, row } of rows) row.classList.toggle("selected", s === scenario);
    const { map, units } = scenario.setup;
    name.textContent = scenario.name;
    details.textContent = `${matchup(scenario)} · ${map.width}×${map.height} · ${units?.length ?? 0} units`;
    description.textContent = scenario.description;
  }

  panel.append(el("div", "panel-title", "Choose a map"), el("div", "screen-hint", "↑ ↓ pick a map · Z next: players and commanders · X back"), list, name, details, description);
  node.append(panel);
  const first = rows.find(({ scenario }) => scenario === initial) ?? rows[0];
  if (first) show(first.scenario);
  first?.row.focus();
  menuKeys(
    panel,
    rows.map(({ row }) => row),
    () => {
      close();
      showTitleScreen(root, scenarios, defaults, onStart);
    },
  );
}

/**
 * Step two of a new game: who plays each side and under which commander (06-commanders §5), then
 * the options and Start. Up and Down walk every control, Left and Right change the commander in
 * focus, and X goes back to the maps with everything chosen here kept.
 */
export function showPlayerSelect(root: HTMLElement, scenarios: readonly Scenario[], scenario: Scenario, defaults: GameOptions, onStart: OnStart): void {
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
  const passDevice = checkbox("Pass-the-device screen between turns", defaults.passDevice);
  const battleScenes = checkbox("Battle scenes", defaults.battleScenes);
  const easy = checkbox("Easy computer opponent", defaults.level === "easy");
  const options = (): GameOptions => ({
    luck: luck.input.checked,
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
      passDevice.input,
      battleScenes.input,
      start,
    ],
    () => {
      close();
      showMapSelect(root, scenarios, options(), onStart, scenario);
    },
  );
}
