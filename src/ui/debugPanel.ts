import type { GameEvent } from "../engine/commands";
import type { GameState } from "../engine/state";
import { el } from "./dom";
import { describeEvent } from "./eventText";

/**
 * Pretty JSON of the state with the map moved last and its terrain printed one map row per line,
 * so players and units are near the top. Still valid JSON.
 */
function stateJson(state: GameState): string {
  const { map, ...rest } = state;
  const rows: string[] = [];
  for (let y = 0; y < map.height; y++) {
    rows.push("      " + map.terrain.slice(y * map.width, (y + 1) * map.width).map((t) => JSON.stringify(t)).join(", "));
  }
  const mapJson = `{\n    "width": ${map.width},\n    "height": ${map.height},\n    "terrain": [\n${rows.join(",\n")}\n    ]\n  }`;
  return JSON.stringify({ ...rest, map: "__MAP__" }, null, 2).replace('"__MAP__"', mapJson);
}

/** Collapsible debug panel: full game state as JSON and the event log (11-tech-setup §7). */
export function createDebugPanel(root: HTMLElement): {
  update: (state: GameState) => void;
  logEvents: (state: GameState, previous: GameState, events: readonly GameEvent[]) => void;
  logNote: (text: string) => void;
} {
  const panel = el("details", "panel debug-panel");
  const summary = el("summary", "panel-title", "Debug");
  const logTitle = el("div", "panel-subtitle", "Event log (newest first)");
  const log = el("ul", "event-log");
  const stateTitle = el("div", "panel-subtitle", "Game state (JSON)");
  const json = el("pre", "state-json");
  panel.append(summary, logTitle, log, stateTitle, json);
  root.append(panel);

  return {
    update(state) {
      json.textContent = stateJson(state);
    },
    logEvents(state, previous, events) {
      for (const e of events) log.prepend(el("li", undefined, describeEvent(state, previous, e)));
      while (log.children.length > 50) log.lastElementChild?.remove();
    },
    logNote(text) {
      log.prepend(el("li", "muted", text));
    },
  };
}
