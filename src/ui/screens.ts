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

export function showMapSelect(root: HTMLElement, scenarios: readonly Scenario[], defaults: GameOptions, onStart: OnStart): void {
  const { node, close } = screen(root);
  const panel = el("div", "panel screen-panel map-panel");
  const list = el("div", "map-list");
  const name = el("div", "panel-title");
  const details = el("div", "map-details");
  const description = el("div", "map-description");

  let chosen = scenarios[0];
  const rows = scenarios.map((scenario) => {
    const row = el("button", "list-row", scenario.name);
    row.addEventListener("focus", () => choose(scenario));
    row.addEventListener("click", () => {
      choose(scenario);
      start.focus();
    });
    list.append(row);
    return { scenario, row };
  });
  const chosenRow = () => rows.find(({ scenario }) => scenario === chosen)?.row;

  /** Z picks a map and moves on to Start, so walking down to the options doesn't change it. */
  function choose(scenario: Scenario): void {
    chosen = scenario;
    for (const { scenario: s, row } of rows) row.classList.toggle("selected", s === scenario);
    const { map, units } = scenario.setup;
    name.textContent = scenario.name;
    details.textContent = `${matchup(scenario)} · ${map.width}×${map.height} · ${units?.length ?? 0} units`;
    description.textContent = scenario.description;
    showPlayers(scenario);
  }

  const players = el("div", "player-options");
  let computerBoxes: HTMLInputElement[] = [];
  let commanderPickers: CommanderPicker[] = [];
  let shownFor: Scenario | undefined;
  /**
   * One "Computer plays …" box and one commander choice per player of the chosen map
   * (06-commanders §5). Coming back to the same map keeps what was picked.
   */
  function showPlayers(scenario: Scenario): void {
    if (scenario === shownFor) return;
    shownFor = scenario;
    const chosenIds = defaults.computer ?? defaultComputerPlayers(scenario);
    players.replaceChildren();
    computerBoxes = [];
    commanderPickers = [];
    scenario.setup.players.forEach((player, id) => {
      const box = checkbox(`Computer plays ${player.name} (${NATIONS[player.nation].name})`, chosenIds.includes(id));
      const allowed = commandersFor(player.nation);
      const wanted = defaults.commanders[id] ?? null;
      const picker = commanderPicker(player.name, allowed, wanted !== null && allowed.includes(wanted) ? wanted : null);
      players.append(box.row, picker.row);
      computerBoxes.push(box.input);
      commanderPickers.push(picker);
    });
  }
  /** The players' boxes and commander buttons, in the order they show. */
  const playerControls = (): HTMLElement[] => computerBoxes.flatMap((box, id) => [box, ...(commanderPickers[id] ? [commanderPickers[id].button] : [])]);

  const luck = checkbox("Luck in combat", defaults.luck);
  const passDevice = checkbox("Pass-the-device screen between turns", defaults.passDevice);
  const battleScenes = checkbox("Battle scenes", defaults.battleScenes);
  const easy = checkbox("Easy computer opponent", defaults.level === "easy");
  const start = el("button", "btn btn-big", "Start");
  start.addEventListener("click", () => {
    if (!chosen) return;
    close();
    const computer = computerBoxes.flatMap((box, id) => (box.checked ? [id] : []));
    onStart(chosen, {
      luck: luck.input.checked,
      passDevice: passDevice.input.checked,
      battleScenes: battleScenes.input.checked,
      computer,
      level: easy.input.checked ? "easy" : "normal",
      commanders: commanderPickers.map((picker) => picker.chosen),
    });
  });

  panel.append(
    el("div", "panel-title", "Choose a map"),
    list,
    name,
    details,
    description,
    el("div", "panel-subtitle", "Players"),
    players,
    easy.row,
    el("div", "panel-subtitle", "Options"),
    luck.row,
    passDevice.row,
    battleScenes.row,
    start,
  );
  node.append(panel);
  if (chosen) choose(chosen);
  chosenRow()?.focus();
  // Arrows pick a map straight away; Z moves on to Start, and Up from there reaches the options.
  menuKeys(
    panel,
    () => {
      const mapRows = rows.map(({ row }) => row);
      const onList = mapRows.some((row) => row === document.activeElement);
      return onList ? mapRows : [chosenRow(), ...playerControls(), easy.input, luck.input, passDevice.input, battleScenes.input, start].flatMap((item) => item ?? []);
    },
    () => {
      close();
      showTitleScreen(root, scenarios, defaults, onStart);
    },
  );
}
