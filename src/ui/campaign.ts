// The campaign screen (22-campaign §7): the missions in order with won, open or locked, and for the
// one picked its briefing, what the computer has been given, the Allied commanders and Start.

import { advantageLines } from "../campaign/describe";
import type { CampaignMission } from "../campaign/missions";
import { missionStatus, type CampaignProgress, type MissionStatus } from "../campaign/progress";
import { axisPlayers } from "../campaign/setup";
import type { CommanderId } from "../engine/data/commanders";
import { NATIONS } from "../engine/data/nations";
import type { Scenario } from "../engine/scenario";
import { commanderName, unitName } from "../game/artPack";
import { commandersFor } from "../urlOptions";
import { commanderPicker, type CommanderPicker } from "./commanders";
import { el } from "./dom";
import type { GameOptions } from "./gameOptions";
import { menuKeys } from "./menuKeys";
import { BATTLE_PLACES, THEATERS } from "./theaters";

/** A mission with the map it's played on: the mission's own scenario, advantage included. */
export interface CampaignEntry {
  readonly mission: CampaignMission;
  readonly scenario: Scenario;
}

const MARK: Record<MissionStatus, string> = { won: "Won", open: "", locked: "Locked" };

function checkbox(label: string, checked: boolean): { row: HTMLElement; input: HTMLInputElement } {
  const row = el("label", "option");
  const input = el("input");
  input.type = "checkbox";
  input.checked = checked;
  row.append(input, label);
  return { row, input };
}

/**
 * The game options for a campaign mission (22-campaign §3): the computer plays every Axis player at
 * Normal, the player picks the Allied commanders, Luck and Battle scenes; fog is the map's own.
 */
export function campaignOptions(scenario: Scenario, commanders: readonly (CommanderId | null)[], luck: boolean, battleScenes: boolean): GameOptions {
  const axis = axisPlayers(scenario);
  return {
    luck,
    fog: false,
    passDevice: false,
    battleScenes,
    computer: axis,
    level: "normal",
    commanders: scenario.setup.players.map((_, id) => {
      const wanted = axis.includes(id) ? null : (commanders[id] ?? null);
      const nation = scenario.setup.players[id]?.nation;
      return nation && wanted && commandersFor(nation).includes(wanted) ? wanted : null;
    }),
  };
}

export function showCampaign(
  root: HTMLElement,
  entries: readonly CampaignEntry[],
  progress: CampaignProgress,
  defaults: GameOptions,
  onStart: (entry: CampaignEntry, options: GameOptions) => void,
  onBack: () => void,
  initial?: string,
): void {
  const node = el("div", "screen");
  root.append(node);
  const close = () => node.remove();
  const panel = el("div", "panel screen-panel map-select campaign");
  const list = el("div", "map-list campaign-list");
  const brief = el("div", "map-brief campaign-brief");
  const body = el("div", "map-select-body");
  body.append(list, brief);
  panel.append(el("div", "panel-title", "Campaign"), el("div", "screen-hint", "↑ ↓ mission · Z choose · X back"), body);
  node.append(panel);

  const missions = entries.map((e) => e.mission);
  const rows: HTMLButtonElement[] = [];
  /** The commanders chosen, kept as the player looks from mission to mission. */
  let commanders: readonly (CommanderId | null)[] = defaults.commanders;
  let luck = defaults.luck;
  let battleScenes = defaults.battleScenes;
  let briefControls: HTMLElement[] = [];
  /** Keeps what was chosen on the briefing shown, before another replaces it. */
  let rememberShown = () => {};

  function choose(index: number): void {
    const entry = entries[index];
    if (!entry) return;
    rememberShown();
    rows.forEach((row, i) => row.classList.toggle("selected", i === index));
    const { mission, scenario } = entry;
    const status = missionStatus(missions, progress, index);
    const place = BATTLE_PLACES[scenario.id];
    const axis = axisPlayers(scenario);

    const pickers: { id: number; picker: CommanderPicker }[] = [];
    const players = el("div", "player-options");
    scenario.setup.players.forEach((player, id) => {
      if (axis.includes(id)) return;
      const allowed = commandersFor(player.nation);
      const wanted = commanders[id] ?? null;
      const picker = commanderPicker(player.name, allowed, allowed.find((c) => c === wanted) ?? null);
      players.append(el("div", "player-name", `${player.name} (${NATIONS[player.nation].name})`), picker.row);
      pickers.push({ id, picker });
    });
    const luckBox = checkbox("Luck in combat", luck);
    const scenesBox = checkbox("Battle scenes", battleScenes);
    const remember = () => {
      const next = [...commanders];
      for (const { id, picker } of pickers) next[id] = picker.chosen;
      commanders = next;
      luck = luckBox.input.checked;
      battleScenes = scenesBox.input.checked;
    };
    rememberShown = remember;

    const before = entries[index - 1];
    const start = el("button", "btn btn-big", status === "locked" ? `Win ${before?.scenario.name ?? "the mission before"} to unlock` : "Start");
    start.disabled = status === "locked";
    start.addEventListener("click", () => {
      if (start.disabled) return;
      remember();
      close();
      onStart(entry, campaignOptions(scenario, commanders, luck, battleScenes));
    });

    const enemy = el("div", "campaign-enemy");
    for (const line of advantageLines(scenario, mission, { unit: unitName, commander: commanderName })) enemy.append(el("div", undefined, line));
    brief.replaceChildren(
      el("div", "panel-title", `${index + 1}. ${scenario.name}`),
      el("div", "map-where", place ? `${place.where} · ${place.when} · ${THEATERS[place.theater].name}` : ""),
      el("div", "map-description", scenario.description),
      el("div", "panel-subtitle", "The enemy"),
      enemy,
      el("div", "panel-subtitle", "Your commanders"),
      players,
      el("div", "panel-subtitle", "Options"),
      luckBox.row,
      scenesBox.row,
      start,
    );
    briefControls = [...pickers.map((p) => p.picker.button), luckBox.input, scenesBox.input, ...(start.disabled ? [] : [start])];
  }

  entries.forEach((entry, index) => {
    const status = missionStatus(missions, progress, index);
    const row = el("button", `list-row campaign-row ${status}`);
    const place = BATTLE_PLACES[entry.scenario.id];
    row.append(el("span", undefined, `${index + 1}. ${entry.scenario.name}`), el("span", "campaign-mark", MARK[status] || (place?.when ?? "")));
    row.addEventListener("focus", () => choose(index));
    // Z, or a click on the mission already picked, moves on to its briefing.
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

  // Start on the mission asked for, or the furthest one open.
  const askedFor = entries.findIndex((e) => e.mission.map === initial);
  const furthest = missions.reduce((best, _, i) => (missionStatus(missions, progress, i) === "open" ? i : best), 0);
  const first = askedFor >= 0 ? askedFor : furthest;
  choose(first);
  rows[first]?.focus();
}
