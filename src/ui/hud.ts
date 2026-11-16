import type { CommanderId } from "../engine/data/commanders";
import type { NationId } from "../engine/data/nations";
import type { GameState } from "../engine/state";
import { weatherOn } from "../engine/weather";
import { weatherName } from "../game/artPack";
import { objectiveLines, type ObjectiveLine } from "../game/objectives";
import { playerColors } from "../game/placeholderUnits";
import type { SoundLevel } from "../game/sound/settings";
import { commanderPortrait } from "./commanders";
import { el } from "./dom";
import { drawFlag } from "./flag";

/** What the HUD's sound button needs (16-sound §8). */
export interface SoundControl {
  readonly level: SoundLevel;
  /** Off → Low → Medium → High → Off. */
  cycle(): void;
  onChange(listener: (level: SoundLevel) => void): () => void;
}

const SOUND_ICONS: Record<SoundLevel, string> = { off: "🔇", low: "🔈", medium: "🔉", high: "🔊" };
const SOUND_NAMES: Record<SoundLevel, string> = { off: "Off", low: "Low", medium: "Medium", high: "High" };

/** The sound button: shows the level, and each click moves to the next one. */
function soundButton(control: SoundControl): HTMLButtonElement {
  const button = el("button", "hud-sound");
  // Never takes the keyboard focus, so Z, X and the arrows keep going to the map.
  button.tabIndex = -1;
  const show = (level: SoundLevel) => {
    button.textContent = SOUND_ICONS[level];
    button.title = `Sound: ${SOUND_NAMES[level]} (click to change, M to mute)`;
    button.setAttribute("aria-label", button.title);
  };
  show(control.level);
  control.onChange(show);
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => control.cycle());
  return button;
}

/** The button that opens the Commanders screen, on anyone's turn (06-commanders §5). */
function commandersButton(onClick: () => void): HTMLButtonElement {
  const button = el("button", "hud-sound", "🎖");
  button.tabIndex = -1;
  button.title = "Commanders (C)";
  button.setAttribute("aria-label", button.title);
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", onClick);
  return button;
}

/**
 * The current player's flag, their commander's head beside it (06-commanders §5), the day and their
 * funds. Sits on the side of the map away from the cursor.
 */
export function createHud(root: HTMLElement, sound: SoundControl, onCommanders: () => void): { update: (state: GameState, cursorOnLeft: boolean) => void } {
  const hud = el("div", "panel hud");
  const flag = el("span", "hud-flag");
  const commander = el("span", "hud-commander");
  const day = el("span", "hud-day");
  const weather = el("span", "hud-weather");
  const funds = el("span", "hud-funds");
  const objectives = el("div", "hud-objectives");
  // The portrait stands as tall as the flag row and the funds row together, to their left.
  const rows = el("div", "hud-rows");
  rows.append(flag, day, weather, funds, commandersButton(onCommanders), soundButton(sound));
  hud.append(commander, rows, objectives);
  root.append(hud);
  let shownNation: NationId | undefined;
  let shownCommander: CommanderId | null | undefined;

  return {
    update(state, cursorOnLeft) {
      const current = state.players[state.currentPlayer];
      if (!current) return;
      if (current.nation !== shownNation) {
        shownNation = current.nation;
        flag.replaceChildren(drawFlag(current.nation));
      }
      const leader = current.commander ?? null;
      if (leader !== shownCommander) {
        shownCommander = leader;
        const portrait = leader === null ? null : commanderPortrait(leader, "head");
        commander.replaceChildren(...(portrait ? [portrait] : []));
        commander.hidden = portrait === null;
        hud.classList.toggle("hud-with-commander", portrait !== null);
      }
      day.textContent = `Day ${state.day}`;
      const today = weatherOn(state);
      weather.textContent = `${today === "snow" ? "❄" : "☀"} ${weatherName(today)}`;
      weather.dataset.weather = today;
      funds.textContent = `Funds ${current.funds.toLocaleString("en-US")}`;
      const lines = objectiveLines(state);
      objectives.hidden = lines.length === 0;
      objectives.replaceChildren(...lines.map(objectiveElement));
      hud.classList.toggle("hud-right", cursorOnLeft);
    },
  };
}

/** A scenario objective as a line of text in its side's color. */
export function objectiveElement({ player, text }: ObjectiveLine): HTMLElement {
  const line = el("div", "objective", text);
  if (player !== null) line.style.color = playerColors(player)[0];
  return line;
}
