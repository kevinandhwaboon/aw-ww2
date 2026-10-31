import { terrainDef } from "../engine/data/terrain";
import { UNITS } from "../engine/data/units";
import { veterancyFor } from "../engine/data/veterancy";
import type { Combatant, GameEvent } from "../engine/commands";
import type { Modifier } from "../engine/modifiers";
import { terrainAt, type Point } from "../engine/map";
import { CAPTURE_POINTS, displayHp, propertyAt, type GameState, type Unit } from "../engine/state";
import * as stats from "../engine/stats";
import type { BuildMenu } from "../game/controller";
import { playerColors } from "../game/placeholderUnits";

function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const stars = (n: number) => (n > 0 ? "★".repeat(n) : "–");

/** HTML overlay panel showing the terrain under the cursor, with its owner and capture progress. */
export function createTerrainPanel(root: HTMLElement): { show: (state: GameState, tile: Point) => void } {
  const panel = el("div", "panel terrain-panel");
  const name = el("div", "panel-title");
  const starRow = el("div", "stars");
  const owner = el("div", "terrain-owner");
  panel.append(name, starRow, owner);
  root.append(panel);

  return {
    show(state, tile) {
      const def = terrainDef(terrainAt(state.map, tile));
      name.textContent = def.name;
      starRow.textContent = stars(def.defenseStars);
      starRow.title = `Defense: ${def.defenseStars}`;
      const property = propertyAt(state, tile);
      owner.hidden = !property;
      if (!property) return;
      const holder = property.owner === null ? undefined : state.players[property.owner];
      const capture = property.capturePoints < CAPTURE_POINTS ? ` · capture ${property.capturePoints}/${CAPTURE_POINTS}` : "";
      owner.textContent = `${holder?.name ?? "Neutral"}${capture}`;
      owner.style.color = holder ? playerColors(holder.id)[0] : "";
    },
  };
}

/** Day, whose turn it is, funds, Undo and End Turn, and a one-line controls hint. */
export function createTurnBar(
  root: HTMLElement,
  actions: { onEndTurn: () => void; onUndo: () => void },
): { update: (state: GameState, ui: { canUndo: boolean; busy: boolean }) => void } {
  const bar = el("div", "panel turn-bar");
  const row = el("div", "turn-row");
  const day = el("span", "turn-day");
  const player = el("span", "turn-player");
  const funds = el("span", "turn-funds");
  const button = (label: string, title: string, onClick: () => void) => {
    const b = el("button", "btn", label);
    b.title = title;
    b.addEventListener("click", () => {
      b.blur(); // so Space/Enter go to the map, not this button
      onClick();
    });
    return b;
  };
  const undo = button("Undo", "Undo the last move this turn (U)", actions.onUndo);
  const endTurn = button("End Turn", "End your turn (E)", actions.onEndTurn);
  row.append(day, player, funds, undo, endTurn);
  const hint = el(
    "div",
    "turn-hint",
    "Click a unit, then a blue tile, then choose an action. Click your empty factory to build. Hold X or right-click on a unit to see its range; they cancel too.",
  );
  bar.append(row, hint);
  root.append(bar);

  return {
    update(state, ui) {
      const current = state.players[state.currentPlayer];
      if (!current) return;
      day.textContent = `Day ${state.day}`;
      player.textContent = `${current.name} (${current.nation.toUpperCase()})`;
      player.style.color = playerColors(current.id)[0];
      funds.textContent = `Funds ${current.funds.toLocaleString("en-US")} (+${stats.propertyIncome(state, current.id).toLocaleString("en-US")}/day)`;
      undo.disabled = !ui.canUndo || ui.busy;
      endTurn.disabled = ui.busy;
    },
  };
}

/** The factory's list of units: a scrolling HTML list, as decided in 00-master-design §12. */
export function createBuildMenu(root: HTMLElement): BuildMenu {
  const panel = el("div", "panel build-menu");
  panel.hidden = true;
  root.append(panel);

  return {
    open(options, onPick, onCancel) {
      const title = el("div", "panel-title", "Build");
      const list = el("div", "build-list");
      const buttons = options.map((option) => {
        const row = el("button", "build-row");
        row.disabled = !option.affordable;
        row.append(el("span", undefined, UNITS[option.type].name), el("span", "build-cost", option.cost.toLocaleString("en-US")));
        row.addEventListener("click", () => onPick(option.type));
        list.append(row);
        return row;
      });
      const cancel = el("button", "btn", "Cancel");
      cancel.addEventListener("click", onCancel);
      panel.replaceChildren(title, list, cancel);
      panel.hidden = false;

      // Arrow keys walk the affordable rows and Cancel; Enter and Space activate as usual.
      const focusable = [...buttons.filter((b) => !b.disabled), cancel];
      focusable[0]?.focus();
      panel.onkeydown = (event) => {
        const step = event.key === "ArrowDown" ? 1 : event.key === "ArrowUp" ? -1 : 0;
        if (step === 0) return;
        event.preventDefault();
        const current = focusable.indexOf(document.activeElement as HTMLButtonElement);
        focusable[(current + step + focusable.length) % focusable.length]?.focus();
      };
    },
    close() {
      panel.hidden = true;
      panel.replaceChildren();
    },
  };
}

/** A big centered message shown briefly, e.g. at the start of each turn. */
export function createBanner(root: HTMLElement): { show: (text: string, color: string) => Promise<void> } {
  const banner = el("div", "banner");
  banner.hidden = true;
  root.append(banner);
  return {
    async show(text, color) {
      banner.textContent = text;
      banner.style.borderColor = color;
      banner.style.color = color;
      banner.hidden = false;
      await new Promise((resolve) => setTimeout(resolve, 900));
      banner.hidden = true;
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
      if (unit.cargo.length > 0) {
        row("Carrying", unit.cargo.map((c) => `${UNITS[c.type].name} (${displayHp(c.hp)} HP)`).join(", "));
      }

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

function describeEvent(state: GameState, previous: GameState, e: GameEvent): string {
  const name = (id: number) => state.players[id]?.name ?? `Player ${id}`;
  const unitName = (id: number) => {
    // Boarded and merged units are gone from the map by now, so look in cargo and the previous state too.
    const everyone = [...state.units, ...state.units.flatMap((u) => u.cargo), ...previous.units];
    const unit = everyone.find((u) => u.id === id);
    return unit ? `${name(unit.owner)} ${UNITS[unit.type].name} #${id}` : `unit #${id}`;
  };
  switch (e.type) {
    case "unitMoved": {
      const end = e.path[e.path.length - 1];
      const tiles = e.path.length - 1;
      return `${unitName(e.unitId)} moved ${tiles} tile${tiles === 1 ? "" : "s"} to (${end?.x}, ${end?.y}), fuel −${e.fuelUsed}`;
    }
    case "unitWaited":
      return `${unitName(e.unitId)} waits`;
    case "combat": {
      const who = (c: Combatant) => `${name(c.owner)} ${UNITS[c.type].name}`;
      const tag = (c: Combatant) => (c.destroyed ? " (destroyed)" : c.promotedTo ? ` (now ${c.promotedTo})` : "");
      const counter = e.counter ? `, counter ${e.counter.damage}% (luck ${e.counter.luck})` : ", no counter";
      return `${who(e.attacker)}${tag(e.attacker)} hit ${who(e.defender)}${tag(e.defender)} for ${e.attack.damage}% (luck ${e.attack.luck})${counter}`;
    }
    case "unitLoaded":
      return `${unitName(e.unitId)} boarded ${unitName(e.transportId)}`;
    case "unitUnloaded":
      return `${unitName(e.unitId)} unloaded at (${e.pos.x}, ${e.pos.y})`;
    case "unitJoined":
      return `${unitName(e.targetId)} absorbed a unit, now ${displayHp(e.hp)} HP${e.refund > 0 ? `, refund ${e.refund.toLocaleString("en-US")}` : ""}`;
    case "captureProgress":
      return `${unitName(e.unitId)} is capturing (${e.pos.x}, ${e.pos.y}): ${e.capturePoints} left`;
    case "propertyCaptured":
      return `${name(e.player)} captured (${e.pos.x}, ${e.pos.y})${e.previousOwner === null ? "" : ` from ${name(e.previousOwner)}`}`;
    case "unitBuilt":
      return `${name(e.owner)} built ${UNITS[e.unitType].name} for ${e.cost.toLocaleString("en-US")}`;
    case "incomeReceived":
      return `${name(e.player)} earned ${e.amount.toLocaleString("en-US")} (funds ${e.funds.toLocaleString("en-US")})`;
    case "unitRepaired":
      return `${unitName(e.unitId)} repaired +${e.hp} HP for ${e.cost.toLocaleString("en-US")}`;
    case "unitResupplied":
      return `${unitName(e.unitId)} resupplied`;
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
