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
import { el, screenTitle } from "./dom";
import type { GameOptions } from "./gameOptions";
import { menuKeys } from "./menuKeys";
import { BATTLE_PLACES, project, THEATERS, type BattlePlace } from "./theaters";
import { WorldMap } from "./worldMap";

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
  onEnding: (() => void) | null = null,
): void {
  const node = el("div", "screen");
  root.append(node);
  // The world map, as on the map select: a dot for every mission, and the camera flies to the
  // theater of the one picked, so walking the chain hops round the world in the order of the war.
  const world = new WorldMap();
  const close = () => {
    world.stop();
    node.remove();
  };
  const panel = el("div", "panel screen-panel map-select campaign");
  const mapFrame = el("div", "world-map");
  const labels = el("div", "world-labels");
  mapFrame.append(world.canvas, labels);
  const list = el("div", "map-list campaign-list");
  list.style.setProperty("--rows", String(Math.ceil(entries.length / 2)));
  // Progress is kept on this device after every win (22-campaign §2); say so, and how far it goes.
  const wonCount = entries.filter((e) => progress.won.includes(e.mission.map)).length;
  const saved = el("div", "campaign-saved", `${wonCount} of ${entries.length} missions won · progress is saved on this device`);
  const left = el("div", "map-select-left");
  left.append(mapFrame, list, saved);
  // Once the last mission is won, the ending can be watched again (22-campaign §7a).
  const ending = onEnding ? el("button", "list-row campaign-ending", "Watch the ending: Tokyo Bay, 2 September 1945") : null;
  if (ending && onEnding) {
    ending.addEventListener("click", () => {
      close();
      onEnding();
    });
    left.append(ending);
  }
  const brief = el("div", "map-brief campaign-brief");
  const body = el("div", "map-select-body");
  body.append(left, brief);
  panel.append(
    screenTitle("Campaign", () => {
      close();
      onBack();
    }),
    el("div", "screen-hint", "↑ ↓ mission · Z choose · X back"), body);
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
  /** The mission whose briefing is shown; -1 before the first. */
  let shown = -1;
  const labelFor: { label: HTMLButtonElement; place: BattlePlace }[] = [];

  function placeLabels(): void {
    const view = world.currentView;
    for (const { label, place } of labelFor) {
      const at = project(view, place.lon, place.lat);
      label.style.left = `${(at.x * 100).toFixed(2)}%`;
      label.style.top = `${(at.y * 100).toFixed(2)}%`;
      label.hidden = at.x < 0 || at.x > 1 || at.y < 0 || at.y > 1;
    }
  }
  world.onMove = placeLabels;

  function choose(index: number): void {
    const entry = entries[index];
    if (!entry || index === shown) return;
    rememberShown();
    const first = shown < 0;
    const from = BATTLE_PLACES[entries[shown]?.scenario.id ?? ""]?.theater;
    shown = index;
    rows.forEach((row, i) => row.classList.toggle("selected", i === index));
    labelFor.forEach(({ label }, i) => label.classList.toggle("selected", i === index));
    const { mission, scenario } = entry;
    const status = missionStatus(missions, progress, index);
    const place = BATTLE_PLACES[scenario.id];
    const axis = axisPlayers(scenario);
    world.setDots(
      entries.flatMap((e) => {
        const at = BATTLE_PLACES[e.scenario.id];
        return at ? [{ id: e.scenario.id, lon: at.lon, lat: at.lat }] : [];
      }),
      scenario.id,
    );
    if (place && (first || place.theater !== from)) world.flyTo(THEATERS[place.theater].view, first);

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
    if (place) {
      const label = el("button", `world-label campaign-label ${status} ${place.label ?? ""}`, `${index + 1}. ${entry.scenario.name}`);
      label.tabIndex = -1;
      label.addEventListener("click", () => {
        if (index === shown) briefControls[0]?.focus();
        else rows[index]?.focus();
      });
      labels.append(label);
      labelFor.push({ label, place });
    }
  });

  placeLabels();
  // The ending button is walked with the missions, after the last one.
  if (ending) ending.addEventListener("keydown", (event) => {
    if (event.key === "ArrowUp") {
      event.preventDefault();
      event.stopPropagation();
      rows[rows.length - 1]?.focus();
    } else if (["x", "X", "Escape", "Backspace"].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      close();
      onBack();
    } else if (["z", "Z", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      event.stopPropagation();
      ending.click();
    }
  });
  rows[rows.length - 1]?.addEventListener("keydown", (event) => {
    if (event.key === "ArrowDown" && ending) {
      event.preventDefault();
      event.stopPropagation();
      ending.focus();
    }
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
