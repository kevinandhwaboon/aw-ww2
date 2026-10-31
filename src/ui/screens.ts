// The screens around a game: title and map select (00-master-design §12, HTML full screens).

import { NATIONS } from "../engine/data/nations";
import type { Scenario } from "../engine/scenario";
import { el } from "./hud";

export interface GameOptions {
  /** Random variation in damage (03-combat §3). */
  readonly luck: boolean;
  /** Hot-seat: stop between turns until the next player says they're ready. */
  readonly passDevice: boolean;
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
  panel.append(el("h1", "title-name", "WW2 Tactics"), el("div", "title-sub", "Working title · Two players, one device"), play);
  node.append(panel);
  play.focus();
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

function showMapSelect(root: HTMLElement, scenarios: readonly Scenario[], defaults: GameOptions, onStart: OnStart): void {
  const { node, close } = screen(root);
  const panel = el("div", "panel screen-panel map-panel");
  const list = el("div", "map-list");
  const name = el("div", "panel-title");
  const details = el("div", "map-details");
  const description = el("div", "map-description");

  let chosen = scenarios[0];
  const rows = scenarios.map((scenario) => {
    const row = el("button", "build-row", scenario.name);
    row.addEventListener("click", () => choose(scenario));
    list.append(row);
    return { scenario, row };
  });

  function choose(scenario: Scenario): void {
    chosen = scenario;
    for (const { scenario: s, row } of rows) row.classList.toggle("selected", s === scenario);
    const { map, units } = scenario.setup;
    name.textContent = scenario.name;
    details.textContent = `${matchup(scenario)} · ${map.width}×${map.height} · ${units?.length ?? 0} units`;
    description.textContent = scenario.description;
  }

  const luck = checkbox("Luck in combat", defaults.luck);
  const passDevice = checkbox("Pass-the-device screen between turns", defaults.passDevice);
  const start = el("button", "btn btn-big", "Start");
  start.addEventListener("click", () => {
    if (!chosen) return;
    close();
    onStart(chosen, { luck: luck.input.checked, passDevice: passDevice.input.checked });
  });

  panel.append(
    el("div", "panel-title", "Choose a map"),
    list,
    name,
    details,
    description,
    el("div", "panel-subtitle", "Options"),
    luck.row,
    passDevice.row,
    start,
  );
  node.append(panel);
  if (chosen) choose(chosen);
  start.focus();
}
