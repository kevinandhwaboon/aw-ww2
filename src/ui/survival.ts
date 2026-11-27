// The Survival screen (23-survival §7): the survival maps with each one's best run and history's
// mark, and for the one picked its briefing, the defender's commander, the options and Start.

import type { CommanderId } from "../engine/data/commanders";
import { NATIONS } from "../engine/data/nations";
import type { Scenario } from "../engine/scenario";
import type { SurvivalMap } from "../survival/maps";
import { commanderName } from "../game/artPack";
import { bestRun, describeRun, TOP_RUNS, type SurvivalRecords } from "../survival/record";
import { commandersFor } from "../urlOptions";
import { commanderPicker } from "./commanders";
import { el, screenTitle } from "./dom";
import type { GameOptions } from "./gameOptions";
import { menuKeys } from "./menuKeys";
import { drawSketch, featureColor, featureName } from "./sketchCanvas";
import { sketchMap, SKETCH_FEATURES } from "./terrainSketch";

/** A survival map with its scenario. */
export interface SurvivalEntry {
  readonly survival: SurvivalMap;
  readonly scenario: Scenario;
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
 * The options for a survival game (23-survival §7): the computer brings the waves at Normal, the
 * player picks the defender's commander, Luck, Battle scenes and Fog of war (off unless ticked).
 */
export function survivalOptions(entry: SurvivalEntry, commander: CommanderId | null, luck: boolean, battleScenes: boolean, fog: boolean): GameOptions {
  const { defender, attacker } = entry.survival;
  const nation = entry.scenario.setup.players[defender]?.nation;
  const allowed = nation && commander && commandersFor(nation).includes(commander) ? commander : null;
  return {
    luck,
    fog,
    passDevice: false,
    battleScenes,
    computer: [attacker],
    level: "normal",
    commanders: entry.scenario.setup.players.map((_, id) => (id === defender ? allowed : null)),
  };
}

/** A map's high-score table: place, wave, days, commander and date, best first (23-survival §5e). */
function highScores(records: SurvivalRecords, map: string): HTMLElement {
  const runs = records[map] ?? [];
  const box = el("div");
  box.append(el("div", "panel-subtitle", "High scores"));
  if (runs.length === 0) {
    box.append(el("div", "receipt-none", "No runs yet: be the first to hold out"));
    return box;
  }
  const table = el("table", "stat-table survival-table");
  const header = el("tr");
  for (const label of ["", "Wave", "Days", "Commander", "Date"]) header.append(el("th", undefined, label));
  table.append(header);
  runs.forEach((run, i) => {
    const tr = el("tr");
    tr.append(
      el("td", undefined, String(i + 1)),
      el("td", undefined, String(run.wave)),
      el("td", undefined, String(run.days)),
      el("td", undefined, run.commander ? commanderName(run.commander) : "None"),
      el("td", undefined, run.date || "—"),
    );
    table.append(tr);
  });
  box.append(table);
  return box;
}

export function showSurvival(
  root: HTMLElement,
  entries: readonly SurvivalEntry[],
  records: SurvivalRecords,
  defaults: GameOptions,
  onStart: (entry: SurvivalEntry, options: GameOptions) => void,
  onBack: () => void,
  initial?: string,
): void {
  const node = el("div", "screen");
  root.append(node);
  const close = () => node.remove();
  const panel = el("div", "panel screen-panel map-select survival");
  const list = el("div", "map-list");
  const left = el("div", "map-select-left");
  // The picked map's high scores (23-survival §5e), under the list of maps.
  const scores = el("div", "survival-scores");
  left.append(list, scores, el("div", "campaign-saved", `The ${TOP_RUNS} best runs on each map are saved on this device`));
  const brief = el("div", "map-brief");
  const body = el("div", "map-select-body");
  body.append(left, brief);
  panel.append(
    screenTitle("Survival", () => {
      close();
      onBack();
    }),
    el("div", "screen-hint", "↑ ↓ map · Z choose · X back"),
    el("div", "title-sub", "Hold your HQ against waves that grow until it falls"),
    body,
  );
  node.append(panel);

  const rows: HTMLButtonElement[] = [];
  let commander: CommanderId | null = null;
  let luck = defaults.luck;
  let battleScenes = defaults.battleScenes;
  let fog = false;
  let briefControls: HTMLElement[] = [];
  let shown = -1;

  function choose(index: number): void {
    const entry = entries[index];
    if (!entry || index === shown) return;
    shown = index;
    rows.forEach((row, i) => row.classList.toggle("selected", i === index));
    const { survival, scenario } = entry;
    const defender = scenario.setup.players[survival.defender];
    const allowed = defender ? commandersFor(defender.nation) : [];
    const picker = commanderPicker(defender?.name ?? "", allowed, allowed.find((c) => c === commander) ?? null);
    const luckBox = checkbox("Luck in combat", luck);
    const scenesBox = checkbox("Battle scenes", battleScenes);
    const fogBox = checkbox("Fog of war", fog);
    const best = bestRun(records, scenario.id);
    scores.replaceChildren(highScores(records, scenario.id));

    const sketchCanvas = el("canvas", "terrain-sketch");
    const legend = el("div", "sketch-legend");
    const sketchFrame = el("div", "sketch-frame");
    sketchFrame.append(sketchCanvas, legend);
    const season = scenario.setup.weather?.season ?? "summer";
    const sketch = sketchMap(scenario.setup.map);
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

    const start = el("button", "btn btn-big", "Start");
    start.addEventListener("click", () => {
      commander = picker.chosen;
      luck = luckBox.input.checked;
      battleScenes = scenesBox.input.checked;
      fog = fogBox.input.checked;
      close();
      onStart(entry, survivalOptions(entry, commander, luck, battleScenes, fog));
    });

    brief.replaceChildren(
      el("div", "panel-title", scenario.name),
      el("div", "map-where", `Best: ${best ? describeRun(best) : "not played yet"} · History: ${survival.historyLine}`),
      sketchFrame,
      el("div", "map-description", scenario.description),
      el("div", "panel-subtitle", "Your commander"),
      el("div", "player-name", `${defender?.name ?? ""} (${defender ? NATIONS[defender.nation].name : ""})`),
      picker.row,
      el("div", "panel-subtitle", "Options"),
      luckBox.row,
      scenesBox.row,
      fogBox.row,
      start,
    );
    briefControls = [picker.button, luckBox.input, scenesBox.input, fogBox.input, start];
  }

  entries.forEach((entry, index) => {
    const best = bestRun(records, entry.scenario.id);
    const row = el("button", "list-row campaign-row");
    row.append(el("span", undefined, entry.scenario.name), el("span", "campaign-mark", best ? `Wave ${best.wave}` : ""));
    row.addEventListener("focus", () => choose(index));
    row.addEventListener("click", () => {
      if (row.classList.contains("selected")) briefControls[0]?.focus();
      else choose(index);
    });
    list.append(row);
    rows.push(row);
  });

  menuKeys(list, rows, () => {
    close();
    onBack();
  });
  menuKeys(brief, () => briefControls, () => rows.find((r) => r.classList.contains("selected"))?.focus());

  const asked = entries.findIndex((e) => e.scenario.id === initial);
  const first = Math.max(0, asked);
  choose(first);
  rows[first]?.focus();
}
