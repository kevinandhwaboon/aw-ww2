import type { NationId } from "../engine/data/nations";
import { UNITS, type UnitTypeId } from "../engine/data/units";
import { veterancyFor } from "../engine/data/veterancy";
import type { Combatant, GameEvent } from "../engine/commands";
import type { Modifier } from "../engine/modifiers";
import type { Point } from "../engine/map";
import { displayHp, type DefeatReason, type GameState, type Player, type Unit } from "../engine/state";
import * as stats from "../engine/stats";
import { activePack, findUnitArt, terrainName, unitName as unitTypeName, weatherName } from "../game/artPack";
import { weatherOn } from "../engine/weather";
import type { BuildMenu } from "../game/controller";
import { packFileUrl } from "../game/loadArtPack";
import { FLAG_COLORS, FLAGS } from "../game/placeholderFlags";
import { drawUnitMarker, playerColors } from "../game/placeholderUnits";
import { TILE_SIZE } from "../game/placeholderTiles";
import { objectiveLines, type ObjectiveLine } from "../game/objectives";
import { tileInfo, type Passenger } from "../game/tileInfo";
import { UNIT_GUIDE } from "../game/unitGuide";
import { menuKeys } from "./menuKeys";

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

const stars = (n: number) => (n > 0 ? "★".repeat(n) : "–");

/** The terrain under the cursor and its defense, and the unit there if any. Stays away from the cursor. */
/** `cursorOnLeft`: the cursor is in the left half of the screen, so the panel goes right. */
export function createTileInfo(root: HTMLElement): { show: (state: GameState, tile: Point, cursorOnLeft: boolean) => void } {
  const panel = el("div", "panel tile-info");
  const name = el("div", "panel-title");
  const defense = el("div", "tile-defense");
  const objectiveLine = el("div", "tile-objective", "★ Objective");
  const captureLine = el("div", "tile-capture");
  const unitLine = el("div", "tile-unit");
  const supplyLine = el("div", "tile-supply");
  const fuelText = el("span");
  const ammoText = el("span");
  supplyLine.append(fuelText, ammoText);
  const cargoLine = el("div", "tile-cargo");
  panel.append(name, defense, objectiveLine, captureLine, unitLine, supplyLine, cargoLine);
  root.append(panel);

  return {
    show(state, tile, cursorOnLeft) {
      const info = tileInfo(state, tile);
      name.textContent = info.terrain;
      defense.textContent = info.stars > 0 ? `Defense ${stars(info.stars)}` : "No defense";
      unitLine.hidden = !info.unit;
      unitLine.textContent = info.unit?.name ?? "";
      unitLine.style.color = info.unit ? playerColors(info.unit.owner)[0] : "";
      objectiveLine.hidden = !info.objective;
      const unit = info.unit;
      supplyLine.hidden = !unit;
      fuelText.textContent = unit ? `Fuel ${unit.fuel.left}/${unit.fuel.max}` : "";
      fuelText.classList.toggle("tile-low", unit?.fuel.low === true);
      ammoText.hidden = !unit?.ammo;
      ammoText.textContent = unit?.ammo ? `Ammo ${unit.ammo.left}/${unit.ammo.max}` : "";
      ammoText.classList.toggle("tile-low", unit?.ammo?.low === true);
      captureLine.hidden = !info.capture;
      captureLine.textContent = info.capture ? `Capture ${info.capture.left}/${info.capture.total}` : "";
      // A transport lists who is aboard, each with HP, fuel and ammo (05-supply-transport §4).
      const cargo = info.unit?.cargo;
      cargoLine.hidden = !cargo;
      cargoLine.replaceChildren(...(cargo ? cargoRows(cargo) : []));
      panel.classList.toggle("tile-info-right", cursorOnLeft);
    },
  };
}

/** "Carrying: nothing", or a heading and one row per passenger with its HP, fuel and ammo. */
function cargoRows(cargo: readonly Passenger[]): HTMLElement[] {
  if (cargo.length === 0) return [el("div", undefined, "Carrying: nothing")];
  return [
    el("div", undefined, "Carrying:"),
    ...cargo.map((p) => {
      const row = el("div", "tile-passenger");
      const fuel = el("span", p.fuel.low ? "tile-low" : undefined, `Fuel ${p.fuel.left}/${p.fuel.max}`);
      const parts: HTMLElement[] = [el("span", "tile-passenger-name", p.name), el("span", undefined, `HP ${p.hp}`), fuel];
      if (p.ammo) parts.push(el("span", p.ammo.low ? "tile-low" : undefined, `Ammo ${p.ammo.left}/${p.ammo.max}`));
      row.append(...parts);
      return row;
    }),
  ];
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
export function createHud(root: HTMLElement): { update: (state: GameState, cursorOnLeft: boolean) => void } {
  const hud = el("div", "panel hud");
  const flag = el("span", "hud-flag");
  const day = el("span", "hud-day");
  const weather = el("span", "hud-weather");
  const funds = el("span", "hud-funds");
  const objectives = el("div", "hud-objectives");
  hud.append(flag, day, weather, funds, objectives);
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

const SPRITE_SCALE = 2;

/** The unit's sprite from the art pack, facing the way it does on the map, or its placeholder marker. */
function unitPicture(player: Player | undefined, type: UnitTypeId): HTMLElement {
  const picture = el("div", "build-sprite");
  const pack = activePack();
  const art = player ? findUnitArt(pack, player.nation, player.id, type) : null;
  const sheet = art ? pack.unitSheets[art.sheet] : undefined;
  if (art && sheet) {
    const tile = TILE_SIZE * SPRITE_SCALE;
    picture.style.backgroundImage = `url("${packFileUrl(sheet.path)}")`;
    picture.style.backgroundSize = `${art.frames * tile}px auto`;
    picture.style.backgroundPosition = `0 ${-art.row * tile}px`;
    if (player?.facing === "left") picture.style.transform = "scaleX(-1)";
  } else if (player) {
    picture.append(drawUnitMarker(type, player.id));
  }
  return picture;
}

/** What the unit is for and what it beats and fears, as short lines for the build list. */
function guideLines(type: UnitTypeId): HTMLElement[] {
  const { role, strongVs, weakVs } = UNIT_GUIDE[type];
  const names = (types: readonly UnitTypeId[]) => types.map(unitTypeName).join(", ");
  return [
    el("div", "build-role", role),
    ...(strongVs.length > 0 ? [el("div", "build-strong", `Strong vs ${names(strongVs)}`)] : []),
    el("div", "build-weak", `Weak vs ${names(weakVs)}`),
  ];
}

/** The factory's list of units: a scrolling HTML list, as decided in 00-master-design §12. */
export function createBuildMenu(root: HTMLElement, getState: () => GameState): BuildMenu {
  const panel = el("div", "panel build-menu");
  panel.hidden = true;
  root.append(panel);

  return {
    open(options, onPick, onCancel) {
      const state = getState();
      const player = state.players[state.currentPlayer];
      const title = el("div", "panel-title", "Build");
      const list = el("div", "build-list");
      const buttons = options.map((option) => {
        const row = el("button", "build-row");
        row.disabled = !option.affordable;
        const heading = el("div", "build-heading");
        heading.append(el("span", "build-name", unitTypeName(option.type)), el("span", "build-cost", option.cost.toLocaleString("en-US")));
        const details = el("div", "build-details");
        details.append(heading, ...guideLines(option.type));
        row.append(unitPicture(player, option.type), details);
        row.addEventListener("click", () => onPick(option.type));
        list.append(row);
        return row;
      });
      const cancel = el("button", "btn", "Cancel");
      cancel.addEventListener("click", onCancel);
      panel.replaceChildren(title, list, cancel);
      panel.hidden = false;

      const focusable = [...buttons.filter((b) => !b.disabled), cancel];
      focusable[0]?.focus();
      menuKeys(panel, focusable, onCancel);
    },
    close() {
      panel.hidden = true;
      panel.replaceChildren();
    },
  };
}

const DEFEAT_TEXT: Record<DefeatReason, string> = {
  hqCapture: "The enemy HQ was captured",
  rout: "The enemy has no units left",
  resign: "The enemy resigned",
  captureProperties: "Every objective was captured",
  holdProperties: "The objectives were held long enough",
  surviveDays: "They held out to the last day",
};

/** Why a player is out, for the event log. */
const OUT_TEXT: Record<DefeatReason, string> = {
  hqCapture: "HQ captured",
  rout: "no units left",
  resign: "resigned",
  captureProperties: "the enemy captured every objective",
  holdProperties: "the enemy held the objectives",
  surviveDays: "the enemy held out",
};

/** A scenario objective as a line of text in its side's color. */
function objectiveElement({ player, text }: ObjectiveLine): HTMLElement {
  const line = el("div", "objective", text);
  if (player !== null) line.style.color = playerColors(player)[0];
  return line;
}

/** The end-of-game screen: who won, why, and how each player finished. */
export function createResultsScreen(root: HTMLElement): { show: (state: GameState, onNewGame: () => void) => void } {
  const panel = el("div", "panel results");
  panel.hidden = true;
  // While viewing the final map, this is the way back to the results and New Game.
  const back = el("button", "btn results-back", "Results");
  back.hidden = true;
  menuKeys(back, [back]);
  root.append(panel, back);

  return {
    show(state, onNewGame) {
      const { result } = state;
      if (!result) return;
      const winners = result.winners.flatMap((id) => state.players[id]?.name ?? []).join(" and ");
      const title = el("div", "results-title", `Victory: ${winners}`);
      title.style.color = playerColors(result.winners[0] ?? 0)[0];
      const reason = el("div", "results-reason", `${DEFEAT_TEXT[result.reason]} on day ${state.day}.`);
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

      const newGame = el("button", "btn", "New Game");
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
      panel.replaceChildren(title, reason, objectives, table, buttons);
      panel.hidden = false;
      newGame.focus();
      menuKeys(panel, [newGame, viewMap]);
    },
  };
}

/** Hot-seat: a full screen between turns, so players can swap seats. Resolves when they're ready. */
export function createHandoff(root: HTMLElement): { show: (title: string, detail: string, color: string) => Promise<void> } {
  const screen = el("div", "screen");
  screen.hidden = true;
  root.append(screen);
  return {
    show(title, detail, color) {
      return new Promise((resolve) => {
        const heading = el("div", "results-title", title);
        heading.style.color = color;
        const ready = el("button", "btn btn-big", "Ready");
        ready.addEventListener("click", () => {
          ready.blur(); // so the keyboard goes back to the map
          screen.hidden = true;
          resolve();
        });
        const panel = el("div", "panel screen-panel");
        panel.append(heading, el("div", "results-reason", detail || "Your turn"), ready);
        screen.replaceChildren(panel);
        screen.hidden = false;
        ready.focus();
        menuKeys(panel, [ready]);
      });
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
      const burn = stats.fuelPerDay(state, unit);
      row("Fuel", `${unit.fuel} / ${stats.maxFuel(state, unit)}${burn > 0 ? `  (−${burn} per turn)` : ""}`);
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
        row("Carrying", unit.cargo.map((c) => `${unitTypeName(c.type)} (${displayHp(c.hp)} HP)`).join(", "));
      }

      const title = el("div", "panel-title", unitTypeName(unit.type));
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
    return unit ? `${name(unit.owner)} ${unitTypeName(unit.type)} #${id}` : `unit #${id}`;
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
      const who = (c: Combatant) => `${name(c.owner)} ${unitTypeName(c.type)}`;
      const tag = (c: Combatant) => (c.destroyed ? " (destroyed)" : c.promotedTo ? ` (now ${c.promotedTo})` : "");
      const counter = e.counter ? `, counter ${e.counter.damage}% (luck ${e.counter.luck})` : ", no counter";
      return `${who(e.attacker)}${tag(e.attacker)} hit ${who(e.defender)}${tag(e.defender)} for ${e.attack.damage}% (luck ${e.attack.luck})${counter}`;
    }
    case "unitLoaded":
      return `${unitName(e.unitId)} boarded ${unitName(e.transportId)}`;
    case "unitLaunched":
      return `${unitName(e.unitId)} took off from ${unitName(e.carrierId)}`;
    case "unitUnloaded":
      return `${unitName(e.unitId)} unloaded at (${e.pos.x}, ${e.pos.y})`;
    case "unitJoined":
      return `${unitName(e.targetId)} absorbed a unit, now ${displayHp(e.hp)} HP${e.refund > 0 ? `, refund ${e.refund.toLocaleString("en-US")}` : ""}`;
    case "fortAttacked": {
      const outcome = e.becomes ? `destroyed, now ${terrainName(e.becomes)}` : `${displayHp(e.hp)} HP left`;
      return `${unitName(e.attackerId)} hit the fortification at (${e.pos.x}, ${e.pos.y}) for ${e.attack.damage}% (luck ${e.attack.luck}): ${outcome}`;
    }
    case "unitOutOfFuel":
      return `${name(e.owner)} ${unitTypeName(e.unitType)} ran out of fuel and was lost`;
    case "captureProgress":
      return `${unitName(e.unitId)} is capturing (${e.pos.x}, ${e.pos.y}): ${e.capturePoints} left`;
    case "propertyCaptured":
      return `${name(e.player)} captured (${e.pos.x}, ${e.pos.y})${e.previousOwner === null ? "" : ` from ${name(e.previousOwner)}`}`;
    case "unitBuilt":
      return `${name(e.owner)} built ${unitTypeName(e.unitType)} for ${e.cost.toLocaleString("en-US")}`;
    case "incomeReceived":
      return `${name(e.player)} earned ${e.amount.toLocaleString("en-US")} (funds ${e.funds.toLocaleString("en-US")})`;
    case "unitRepaired":
      return `${unitName(e.unitId)} repaired +${e.hp} HP for ${e.cost.toLocaleString("en-US")}`;
    case "unitResupplied":
      return `${unitName(e.unitId)} resupplied`;
    case "unitDived":
      return `${unitName(e.unitId)} dived`;
    case "unitSurfaced":
      return `${unitName(e.unitId)} surfaced`;
    case "playerDefeated":
      return `${name(e.player)} is out (${OUT_TEXT[e.reason]})`;
    case "gameOver":
      return `Game over: ${e.result.winners.map(name).join(" and ")} won`;
    case "turnEnded":
      return `${name(e.player)} ended their turn`;
    case "dayStarted":
      return `Day ${e.day} begins`;
    case "weatherChanged":
      return `The weather turns to ${weatherName(e.weather)}`;
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
