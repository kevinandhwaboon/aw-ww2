import type { NationId } from "../engine/data/nations";
import type { GameState } from "../engine/state";
import { weatherOn } from "../engine/weather";
import { weatherName } from "../game/artPack";
import { objectiveLines, type ObjectiveLine } from "../game/objectives";
import { FLAG_COLORS, FLAGS } from "../game/placeholderFlags";
import { playerColors } from "../game/placeholderUnits";
import type { SoundLevel } from "../game/sound/settings";
import { el } from "./dom";

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

function drawFlag(nation: NationId): HTMLCanvasElement {
  const rows = FLAGS[nation];
  const canvas = el("canvas");
  canvas.width = rows[0]?.length ?? 0;
  canvas.height = rows.length;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      ctx.fillStyle = FLAG_COLORS[row.charAt(x)] ?? "";
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}

/** The current player's flag, the day and their funds. Sits on the side of the map away from the cursor. */
export function createHud(root: HTMLElement, sound: SoundControl): { update: (state: GameState, cursorOnLeft: boolean) => void } {
  const hud = el("div", "panel hud");
  const flag = el("span", "hud-flag");
  const day = el("span", "hud-day");
  const weather = el("span", "hud-weather");
  const funds = el("span", "hud-funds");
  const objectives = el("div", "hud-objectives");
  hud.append(flag, day, weather, funds, soundButton(sound), objectives);
  root.append(hud);
  let shownNation: NationId | undefined;

  return {
    update(state, cursorOnLeft) {
      const current = state.players[state.currentPlayer];
      if (!current) return;
      if (current.nation !== shownNation) {
        shownNation = current.nation;
        flag.replaceChildren(drawFlag(current.nation));
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
