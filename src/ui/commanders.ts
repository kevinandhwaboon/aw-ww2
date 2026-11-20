// Commanders on screen (06-commanders §5): their portraits, the choice on the map select and the
// Commanders screen. Words come from the engine's commander data, names and art from the art pack.

import { type Branch, COMMANDER_IDS, COMMANDERS, type CommanderId } from "../engine/data/commanders";
import { NATIONS, type NationId } from "../engine/data/nations";
import type { GameState, PlayerId } from "../engine/state";
import { commanderName } from "../game/artPack";
import { commanderPortraitUrl } from "../game/loadArtPack";
import { el } from "./dom";
import { drawFlag } from "./flag";
import { menuKeys } from "./menuKeys";

const SIDE_NAMES = { allies: "Allies", axis: "Axis" } as const;
const BRANCH_NAMES: Record<Branch, string> = { tanks: "Tanks", infantry: "Infantry", naval: "Naval", air: "Air" };

/** "Naval · United States": the branch and nation a commander comes from. */
export const commanderOrigin = (id: CommanderId): string => `${BRANCH_NAMES[COMMANDERS[id].branch]} · ${NATIONS[COMMANDERS[id].nation].name}`;
const sideOf = (id: CommanderId) => NATIONS[COMMANDERS[id].nation].side;

/** A commander's portrait from the art pack, or nothing if the pack has none. */
export function commanderPortrait(id: CommanderId, crop: "full" | "bust"): HTMLImageElement | null {
  const url = commanderPortraitUrl(id, crop);
  if (url === null) return null;
  const image = el("img", `commander-${crop}`);
  image.src = url;
  image.alt = "";
  return image;
}

/** A commander's bonuses and drawback on one line. */
export const commanderSummary = (id: CommanderId): string => {
  const { bonuses, drawback } = COMMANDERS[id];
  return `${bonuses.join(" · ")} · But: ${drawback}`;
};

export interface CommanderPicker {
  readonly button: HTMLButtonElement;
  readonly row: HTMLElement;
  readonly chosen: CommanderId | null;
}

/**
 * The players screen's commander choice for one player: Left and Right (or a click, or Z) step
 * through No commander and each commander the player may have, with what the chosen one does
 * written underneath.
 */
export function commanderPicker(playerName: string, allowed: readonly CommanderId[], initial: CommanderId | null): CommanderPicker {
  const choices: (CommanderId | null)[] = [null, ...allowed];
  let index = Math.max(0, choices.indexOf(initial));
  const row = el("div", "commander-pick");
  const button = el("button", "list-row commander-pick-button");
  const summary = el("div", "commander-pick-summary");
  const chosen = () => choices[index] ?? null;
  const show = () => {
    const id = chosen();
    const portrait = id === null ? null : commanderPortrait(id, "bust");
    const label = el("span", "commander-pick-label");
    label.append(el("span", undefined, id === null ? "No commander" : `Commander: ${commanderName(id)}`));
    if (id !== null) label.append(el("span", "commander-pick-origin", commanderOrigin(id)));
    button.title = `Change ${playerName}'s commander`;
    button.replaceChildren(
      el("span", "commander-pick-arrow", "◂"),
      ...(portrait ? [portrait] : [el("span", "commander-bust commander-none")]),
      label,
      el("span", "commander-pick-arrow commander-pick-next", "▸"),
    );
    summary.textContent = id === null ? "No bonuses and no drawback." : commanderSummary(id);
  };
  const step = (by: number) => {
    index = (index + by + choices.length) % choices.length;
    show();
  };
  button.addEventListener("click", () => step(1));
  // Left and Right change the commander; the screen's own keys never see them, so the focus stays here.
  button.addEventListener("keydown", (event) => {
    const by = event.key === "ArrowRight" ? 1 : event.key === "ArrowLeft" ? -1 : 0;
    if (by === 0) return;
    event.preventDefault();
    event.stopPropagation();
    step(by);
  });
  show();
  row.append(button, summary);
  return {
    button,
    row,
    get chosen() {
      return chosen();
    },
  };
}

export interface CommandersScreen {
  /** Shows every commander with `viewer`'s own selected. `onClose` runs when the player leaves. */
  open(state: GameState, viewer: PlayerId, onClose?: () => void): void;
  readonly isOpen: boolean;
}

/** The Commanders screen: the list of every commander, Allies then Axis, and the selected one's details. */
export function createCommandersScreen(root: HTMLElement): CommandersScreen {
  const screen = el("div", "screen commanders-screen");
  screen.hidden = true;
  root.append(screen);

  return {
    get isOpen() {
      return !screen.hidden;
    },
    open(state, viewer, onClose) {
      const close = () => {
        if (screen.hidden) return;
        if (document.activeElement instanceof HTMLElement) document.activeElement.blur(); // keys go back to the map
        screen.hidden = true;
        screen.replaceChildren();
        onClose?.();
      };
      // Fetch every full portrait now, so moving through the list never shows an empty frame.
      for (const id of COMMANDER_IDS) commanderPortrait(id, "full");
      const own = state.players[viewer]?.commander;
      const panel = el("div", "panel screen-panel commanders-panel");
      const list = el("div", "commanders-list");
      const details = el("div", "commander-details");

      const flagsOf = (id: CommanderId): NationId[] => state.players.filter((p) => p.commander === id).map((p) => p.nation);
      const rows = new Map<CommanderId, HTMLButtonElement>();
      const select = (id: CommanderId) => {
        for (const [other, row] of rows) row.classList.toggle("selected", other === id);
        details.replaceChildren(...detailLines(id, state));
      };
      for (const side of ["allies", "axis"] as const) {
        list.append(el("div", "panel-subtitle", SIDE_NAMES[side]));
        for (const id of COMMANDER_IDS.filter((c) => sideOf(c) === side)) {
          const row = el("button", "list-row commander-row");
          const portrait = commanderPortrait(id, "bust");
          const flags = el("span", "commander-flags");
          flags.append(...flagsOf(id).map(drawFlag));
          const name = el("span", "commander-row-name");
          name.append(el("span", undefined, commanderName(id)), el("span", "commander-row-origin", commanderOrigin(id)));
          row.append(...(portrait ? [portrait] : []), name, flags);
          row.addEventListener("focus", () => select(id));
          row.addEventListener("click", () => select(id));
          rows.set(id, row);
          list.append(row);
        }
      }

      const done = el("button", "btn", "Close");
      done.addEventListener("click", close);
      const body = el("div", "commanders-body");
      body.append(list, details);
      panel.append(el("div", "panel-title", "Commanders"));
      if (own === undefined) {
        panel.append(el("div", "commanders-note", `${state.players[viewer]?.name ?? "This player"} is playing without a commander.`));
      }
      panel.append(body, done);
      screen.replaceChildren(panel);
      screen.onclick = (event) => {
        if (event.target === screen) close();
      };
      screen.hidden = false;

      const first = own ?? COMMANDER_IDS[0];
      select(first);
      rows.get(first)?.focus();
      menuKeys(panel, [...rows.values(), done], close);
    },
  };
}

/** Everything about one commander, in the words of 06-commanders §3. */
function detailLines(id: CommanderId, state: GameState): HTMLElement[] {
  const def = COMMANDERS[id];
  const portrait = commanderPortrait(id, "full");
  const text = el("div", "commander-text");
  const bonuses = el("ul", "commander-bonuses");
  bonuses.append(...def.bonuses.map((bonus) => el("li", undefined, bonus)));
  const drawback = el("ul", "commander-drawback");
  drawback.append(el("li", undefined, def.drawback));
  const holders = state.players.filter((p) => p.commander === id).map((p) => p.name);
  text.append(
    el("div", "commander-name", commanderName(id)),
    el("div", "commander-origin", `${commanderOrigin(id)} · ${SIDE_NAMES[sideOf(id)]}`),
    ...(holders.length > 0 ? [el("div", "commander-holders", `In this battle: commands ${holders.join(" and ")}`)] : []),
    el("div", "commander-style", def.style),
    el("div", "panel-subtitle", "Bonuses"),
    bonuses,
    el("div", "panel-subtitle", "Drawback"),
    drawback,
  );
  return [...(portrait ? [portrait] : []), text];
}
