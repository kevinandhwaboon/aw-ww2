import type { DefeatReason, GameState } from "../engine/state";
import { lossLines } from "../game/losses";
import { objectiveLines } from "../game/objectives";
import { playerColors } from "../game/placeholderUnits";
import { el } from "./dom";
import { objectiveElement } from "./hud";
import { menuKeys } from "./menuKeys";

const DEFEAT_TEXT: Record<DefeatReason, string> = {
  hqCapture: "The enemy HQ was captured",
  rout: "The enemy has no units left",
  resign: "The enemy resigned",
  captureProperties: "Every objective was captured",
  holdProperties: "The objectives were held long enough",
  surviveDays: "They held out to the last day",
};

/** The end-of-game screen: who won, why, and how each player finished. */
export function createResultsScreen(root: HTMLElement): {
  show: (state: GameState, onNewGame: () => void, newGameLabel?: string, note?: string | null, heading?: string | null) => void;
} {
  const panel = el("div", "panel results");
  panel.hidden = true;
  // While viewing the final map, this is the way back to the results and New Game.
  const back = el("button", "btn results-back", "Results");
  back.hidden = true;
  menuKeys(back, [back]);
  root.append(panel, back);

  return {
    show(state, onNewGame, newGameLabel = "New Game", note = null, heading = null) {
      const { result } = state;
      if (!result) return;
      const winners = result.winners.flatMap((id) => state.players[id]?.name ?? []).join(" and ");
      const title = el("div", "results-title", heading ?? `Victory: ${winners}`);
      title.style.color = playerColors(result.winners[0] ?? 0)[0];
      // A survival game has no victory to explain: the note says how far it got (23-survival §7).
      const reason = el("div", "results-reason", `${DEFEAT_TEXT[result.reason]} on day ${state.day}.`);
      reason.hidden = heading !== null;
      // What the game won beyond itself, such as the next campaign mission (22-campaign §7).
      const won = el("div", "results-reason", note ?? "");
      won.hidden = note === null;
      const lines = objectiveLines(state);
      const objectives = el("div", "results-objectives");
      objectives.hidden = lines.length === 0;
      objectives.append(el("div", "panel-subtitle", "Objectives"), ...lines.map(objectiveElement));

      const table = el("table", "stat-table results-table");
      const header = el("tr");
      for (const label of ["", "Units", "Properties", "Funds"]) header.append(el("th", undefined, label));
      table.append(header);
      for (const player of state.players) {
        const units = state.units.filter((u) => u.owner === player.id).reduce((n, u) => n + 1 + u.cargo.length, 0);
        const properties = state.properties.filter((p) => p.owner === player.id).length;
        const tr = el("tr");
        const name = el("th", undefined, player.name);
        name.style.color = playerColors(player.id)[0];
        tr.append(name, el("td", undefined, String(units)), el("td", undefined, String(properties)), el("td", undefined, player.funds.toLocaleString("en-US")));
        table.append(tr);
      }

      // Each player's losses, itemized like a bill (04-economy §8a).
      const receipts = el("div", "results-losses");
      for (const player of state.players) {
        const lines = lossLines(state, player.id);
        const receipt = el("div", "receipt");
        const name = el("div", "receipt-name", player.name);
        name.style.color = playerColors(player.id)[0];
        receipt.append(name);
        for (const line of lines) {
          const row = el("div", "receipt-line");
          row.append(el("span", undefined, line.name), el("span", undefined, `×${line.count}`));
          receipt.append(row);
        }
        if (lines.length === 0) receipt.append(el("div", "receipt-none", "No units lost"));
        const total = el("div", "receipt-line receipt-total");
        total.append(el("span", undefined, "Units lost"), el("span", undefined, String(lines.reduce((n, l) => n + l.count, 0))));
        receipt.append(total);
        receipts.append(receipt);
      }

      const newGame = el("button", "btn", newGameLabel);
      newGame.addEventListener("click", onNewGame);
      const viewMap = el("button", "btn", "View Map");
      viewMap.addEventListener("click", () => {
        panel.hidden = true;
        back.hidden = false;
        back.focus();
      });
      back.onclick = () => {
        back.hidden = true;
        panel.hidden = false;
        newGame.focus();
      };
      const buttons = el("div", "results-buttons");
      buttons.append(newGame, viewMap);
      panel.replaceChildren(title, reason, won, objectives, table, el("div", "panel-subtitle", "Losses"), receipts, buttons);
      panel.hidden = false;
      newGame.focus();
      menuKeys(panel, [newGame, viewMap]);
    },
  };
}
