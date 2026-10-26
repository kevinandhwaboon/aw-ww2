import { terrainDef, type TerrainId } from "../engine/data/terrain";
import { UNITS } from "../engine/data/units";
import { veterancyFor } from "../engine/data/veterancy";
import type { GameEvent } from "../engine/commands";
import type { Modifier } from "../engine/modifiers";
import { displayHp, type GameState, type Unit } from "../engine/state";
import * as stats from "../engine/stats";
import { playerColors } from "../game/placeholderUnits";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const stars = (n: number) => (n > 0 ? "★".repeat(n) : "–");

/** HTML overlay panel showing the terrain under the cursor (00-master-design §12, HUD panels). */
export function createTerrainPanel(root: HTMLElement): { show: (id: TerrainId) => void } {
  const panel = el("div", "panel terrain-panel");
  const name = el("div", "panel-title");
  const starRow = el("div", "stars");
  panel.append(name, starRow);
  root.append(panel);

  return {
    show(id) {
      const def = terrainDef(id);
      name.textContent = def.name;
      starRow.textContent = stars(def.defenseStars);
      starRow.title = `Defense: ${def.defenseStars}`;
    },
  };
}

/** Day, whose turn it is, funds, and the End Turn button. */
export function createTurnBar(root: HTMLElement, onEndTurn: () => void): { update: (state: GameState) => void } {
  const bar = el("div", "panel turn-bar");
  const day = el("span", "turn-day");
  const player = el("span", "turn-player");
  const funds = el("span", "turn-funds");
  const button = el("button", "btn", "End Turn");
  button.addEventListener("click", onEndTurn);
  bar.append(day, player, funds, button);
  root.append(bar);

  return {
    update(state) {
      const current = state.players[state.currentPlayer];
      if (!current) return;
      day.textContent = `Day ${state.day}`;
      player.textContent = `${current.name} (${current.nation.toUpperCase()})`;
      player.style.color = playerColors(current.id)[0];
      funds.textContent = `Funds ${current.funds.toLocaleString("en-US")}`;
    },
  };
}

function describeModifier(m: Modifier): string {
  const value = m.op === "add" ? `${m.value >= 0 ? "+" : ""}${m.value}` : m.op === "multiply" ? `×${m.value}` : `=${m.value}`;
  return `${m.source}: ${m.stat} ${value}`;
}

/** Stats of the unit under the cursor, as the engine computes them (through the modifier layer). */
export function createUnitPanel(root: HTMLElement): { show: (state: GameState, unit: Unit | undefined) => void } {
  const panel = el("div", "panel unit-panel");
  panel.hidden = true;
  root.append(panel);

  return {
    show(state, unit) {
      panel.hidden = !unit;
      if (!unit) return;
      const def = UNITS[unit.type];
      const owner = state.players[unit.owner];
      const vet = veterancyFor(unit.kills);
      const range = stats.attackRange(state, unit);
      const ammo = stats.maxAmmo(state, unit);

      const rows: [string, string][] = [];
      const row = (label: string, value: number | string, base?: number) => {
        const changed = base !== undefined && typeof value === "number" && value !== base;
        rows.push([label, changed ? `${value} (base ${base})` : String(value)]);
      };
      row("HP", `${displayHp(unit.hp)} / 10  (internal ${unit.hp})`);
      row("Fuel", `${unit.fuel} / ${stats.maxFuel(state, unit)}`);
      row("Ammo", def.primaryWeapon ? `${unit.ammo} / ${ammo}  (${def.primaryWeapon.name})` : "—");
      if (def.secondaryWeapon) row("Secondary", def.secondaryWeapon.name);
      row("Move", stats.movePoints(state, unit), def.movePoints);
      row("Move type", def.movementType);
      row("Vision", stats.vision(state, unit), def.vision);
      row("Range", range ? (range.min === range.max ? `${range.min}` : `${range.min}–${range.max}`) : "—");
      row("Attack", stats.attackMod(state, unit), 100);
      row("Defense", stats.defenseMod(state, unit), 100);
      row("Terrain", stars(stats.terrainStars(state, unit)));
      row("Rank", `${vet.level} (${unit.kills} kills)`);
      row("Cost", stats.unitCost(state, unit.owner, unit.type), def.cost);
      row("Acted", unit.hasActed ? "yes" : "no");

      const title = el("div", "panel-title", def.name);
      const ownerLine = el("div", "unit-owner", `${owner?.name ?? "?"} · unit #${unit.id}`);
      ownerLine.style.color = playerColors(unit.owner)[0];
      const table = el("table", "stat-table");
      for (const [label, value] of rows) {
        const tr = el("tr");
        tr.append(el("th", undefined, label), el("td", undefined, value));
        table.append(tr);
      }
      const mods = stats.modifiersAffecting(state, unit);
      const modList = el("ul", "modifier-list");
      for (const m of mods) modList.append(el("li", undefined, describeModifier(m)));
      if (mods.length === 0) modList.append(el("li", "muted", "no modifiers"));
      panel.replaceChildren(title, ownerLine, table, el("div", "panel-subtitle", "Modifiers"), modList);
    },
  };
}

function describeEvent(state: GameState, e: GameEvent): string {
  const name = (id: number) => state.players[id]?.name ?? `Player ${id}`;
  switch (e.type) {
    case "turnEnded":
      return `${name(e.player)} ended their turn`;
    case "dayStarted":
      return `Day ${e.day} begins`;
    case "turnStarted":
      return `Turn: ${name(e.player)} (day ${e.day})`;
  }
}

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
  logEvents: (state: GameState, events: readonly GameEvent[]) => void;
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
    logEvents(state, events) {
      for (const e of events) log.prepend(el("li", undefined, describeEvent(state, e)));
      while (log.children.length > 50) log.lastElementChild?.remove();
    },
  };
}
