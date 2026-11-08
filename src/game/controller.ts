// Turns player input into engine commands: a small state machine over select → move preview →
// action menu → targeting → command. Knows nothing about Phaser: it talks to the map through
// MapView, so the rules for what a click means live here and the drawing lives in MapScene.

import { attackTargets, forecast, fortForecast, fortTargets, threatTiles, type CombatForecast } from "../engine/combat";
import type { Command, UnitAction } from "../engine/commands";
import { UNITS, type UnitTypeId } from "../engine/data/units";
import { buildOptions, captureProblem, type BuildOption } from "../engine/economy";
import { inBounds, type Point } from "../engine/map";
import { canEndOn, cheapestPath, reachableTiles, tilePoint, type Reach } from "../engine/movement";
import { unitAt, type GameState, type Unit, type UnitId } from "../engine/state";
import { diveProblem, surfaceProblem } from "../engine/submarine";
import { joinProblem, loadProblem, supplyTargets, unloadTiles } from "../engine/transport";
import { extendPath } from "./pathBuilder";

export type RangeKind = "move" | "inspect" | "attack";

export interface RangeLayer {
  readonly tiles: readonly Point[];
  readonly kind: RangeKind;
}

export interface MenuItem {
  readonly id: string;
  readonly label: string;
}

/** What the controller needs from the map view. */
export interface MapView {
  /** Replaces the highlighted tiles; later layers draw over earlier ones. */
  showRanges(layers: readonly RangeLayer[]): void;
  clearRange(): void;
  /** Draws the path arrow from start along path (path excludes start). */
  showPath(start: Point, path: readonly Point[]): void;
  clearPath(): void;
  /** Walks the unit's marker along the path (start included) without changing game state. */
  previewMove(unitId: UnitId, fullPath: readonly Point[]): Promise<void>;
  /** Puts any previewed unit back where the game state says it is. */
  resetPreview(): void;
  /** Opens the menu with the item at index `selected` highlighted (the first item by default). */
  openMenu(at: Point, items: readonly MenuItem[], selected?: number): void;
  closeMenu(): void;
  setCursor(tile: Point): void;
  /** Shows a small text panel next to a tile. */
  showForecast(at: Point, lines: readonly string[]): void;
  clearForecast(): void;
}

/** The factory's list of units to build (an HTML panel, 00-master-design §12). */
export interface BuildMenu {
  open(options: readonly BuildOption[], onPick: (type: UnitTypeId) => void, onCancel: () => void): void;
  close(): void;
}

interface Chosen {
  readonly unitId: UnitId;
  readonly reach: ReadonlyMap<number, Reach>;
  readonly path: Point[];
}

/** A chosen move plus what the unit could fire on from there. */
interface Aimed extends Chosen {
  readonly targets: readonly Unit[];
  readonly forts: readonly Point[];
}

type Mode =
  | { readonly kind: "idle" }
  | ({ readonly kind: "selected" } & Chosen)
  | ({ readonly kind: "menu" } & Aimed)
  | ({ readonly kind: "targeting" } & Aimed)
  /** Choosing where to unload a passenger. */
  | ({ readonly kind: "unloading"; readonly passenger: UnitId; readonly tiles: readonly Point[] } & Aimed)
  /** The factory build list is open. */
  | { readonly kind: "building" }
  /** The End Turn and Resign menu, opened on any tile with no unit ready to move. */
  | { readonly kind: "turnMenu"; readonly at: Point }
  /** Resigning can't be undone, so it asks first. */
  | { readonly kind: "confirmResign"; readonly at: Point }
  /** Hold X or right-click: showing a unit's range until released. */
  | { readonly kind: "peeking" }
  /** Animating or waiting for the engine: input is ignored. */
  | { readonly kind: "busy" }
  /** The game has ended: input is ignored for good. */
  | { readonly kind: "over" };

export interface ControllerDeps {
  getState(): GameState;
  /** Applies a command and plays its events. Resolves to whether the engine accepted it. */
  dispatch(command: Command): Promise<boolean>;
  view: MapView;
  buildMenu: BuildMenu;
}

const FIRE: MenuItem = { id: "fire", label: "FIRE" };
const CAPTURE: MenuItem = { id: "capture", label: "CAPTURE" };
const LOAD: MenuItem = { id: "load", label: "LOAD" };
const JOIN: MenuItem = { id: "join", label: "JOIN" };
const UNLOAD: MenuItem = { id: "unload", label: "UNLOAD" };
const SUPPLY: MenuItem = { id: "supply", label: "SUPPLY" };
const DIVE: MenuItem = { id: "dive", label: "DIVE" };
const SURFACE: MenuItem = { id: "surface", label: "SURFACE" };
const WAIT: MenuItem = { id: "wait", label: "WAIT" };
const CANCEL: MenuItem = { id: "cancel", label: "CANCEL" };
const RESIGN: MenuItem = { id: "resign", label: "RESIGN" };
const END_TURN: MenuItem = { id: "endTurn", label: "END TURN" };
const KEEP_PLAYING: MenuItem = { id: "keepPlaying", label: "KEEP PLAYING" };
const RESIGN_NOW: MenuItem = { id: "resignNow", label: "RESIGN NOW" };

const percent = ({ min, max }: { min: number; max: number }) => (min === max ? `${min}%` : `${min}-${max}%`);

/** The damage forecast as short lines for the map panel. `killWord` is what destroying the target is called. */
export function forecastLines(f: CombatForecast, killWord = "KILL"): string[] {
  const kill = f.certainKill ? ` ${killWord}` : f.canKill ? ` ${killWord}?` : "";
  return [`DMG ${percent(f.attack)}${kill}`];
}

const targetTiles = ({ targets, forts }: Aimed): Point[] => [...targets.map((t) => t.pos), ...forts];

/** The next tile in the list, or the previous one for up and left, wrapping around. */
function stepThrough(tiles: readonly Point[], from: Point, step: Point): Point {
  const current = tiles.findIndex((t) => t.x === from.x && t.y === from.y);
  const next = (current + step.x + step.y + tiles.length) % tiles.length;
  return tiles[next] ?? from;
}

export class InputController {
  private mode: Mode = { kind: "idle" };

  constructor(private readonly deps: ControllerDeps) {}

  get busy(): boolean {
    return this.mode.kind === "busy" || this.mode.kind === "over";
  }

  /** The game has ended: clears the map and ignores all further input. */
  finish(): void {
    this.reset();
    this.mode = { kind: "over" };
  }

  /** Ends the turn, dropping any selection. Ignored while something is playing. */
  endTurn(): void {
    if (!this.busy) void this.issue({ type: "endTurn" });
  }

  /** Drops any selection, e.g. after an undo. */
  reset(): void {
    const { view, buildMenu } = this.deps;
    view.closeMenu();
    view.clearRange();
    view.clearPath();
    view.clearForecast();
    view.resetPreview();
    buildMenu.close();
    this.mode = { kind: "idle" };
  }

  /**
   * Where an arrow key takes the cursor. While choosing a destination it stays inside the move
   * range. While choosing a target or an unload tile it only steps between the choices.
   */
  nextCursor(from: Point, step: Point): Point {
    const mode = this.mode;
    const { map } = this.deps.getState();
    const to = { x: from.x + step.x, y: from.y + step.y };
    switch (mode.kind) {
      case "selected":
        return inBounds(map, to) && mode.reach.has(to.y * map.width + to.x) ? to : from;
      case "targeting":
        return stepThrough(targetTiles(mode), from, step);
      case "unloading":
        return stepThrough(mode.tiles, from, step);
      case "busy":
      case "over":
        return from;
      default:
        return to;
    }
  }

  onCursorMove(tile: Point): void {
    const mode = this.mode;
    if (mode.kind === "targeting") {
      this.showForecastAt(mode, tile);
      return;
    }
    if (mode.kind !== "selected") return;
    const state = this.deps.getState();
    const unit = state.units.find((u) => u.id === mode.unitId);
    if (!unit) return;
    const path = extendPath(state, unit, mode.reach, mode.path, tile);
    this.mode = { ...mode, path };
    this.deps.view.showPath(unit.pos, path);
  }

  onConfirm(tile: Point): void {
    const mode = this.mode;
    switch (mode.kind) {
      case "idle":
        this.selectAt(tile);
        return;
      case "building":
      case "peeking":
        this.reset();
        this.selectAt(tile);
        return;
      case "selected":
        void this.chooseDestination(tile);
        return;
      case "targeting": {
        const target = mode.targets.find((t) => t.pos.x === tile.x && t.pos.y === tile.y);
        if (target) void this.commit(mode, { type: "attack", target: target.id });
        else if (mode.forts.some((f) => f.x === tile.x && f.y === tile.y)) void this.commit(mode, { type: "attackFort", target: tile });
        return;
      }
      case "unloading":
        if (mode.tiles.some((t) => t.x === tile.x && t.y === tile.y)) {
          void this.commit(mode, { type: "unload", passenger: mode.passenger, to: tile });
        }
        return;
      case "menu":
      case "turnMenu":
      case "confirmResign":
      case "busy":
      case "over":
        return;
    }
  }

  onCancel(): void {
    const mode = this.mode;
    switch (mode.kind) {
      case "selected":
      case "building":
      case "peeking":
      case "turnMenu":
        this.reset();
        return;
      case "confirmResign":
        this.openTurnMenu(mode.at);
        return;
      case "menu":
        this.backToSelection(mode);
        return;
      case "targeting":
      case "unloading":
        this.deps.view.clearRange();
        this.deps.view.clearForecast();
        this.openMenu(mode);
        this.cursorToDestination(mode);
        return;
      case "idle":
      case "busy":
      case "over":
        return;
    }
  }

  /**
   * X or the right mouse button went down. With nothing selected it shows the range of the unit
   * under the cursor, yours or the enemy's, until released; otherwise it cancels as usual.
   */
  onPeekStart(tile: Point): void {
    if (this.mode.kind !== "idle") {
      this.onCancel();
      return;
    }
    const state = this.deps.getState();
    const unit = unitAt(state, tile);
    if (!unit) return;
    const reach = reachableTiles(state, unit);
    const tiles = [...reach.keys()].map((i) => tilePoint(state, i));
    this.mode = { kind: "peeking" };
    this.deps.view.showRanges(this.threatLayers(state, unit, reach, tiles));
  }

  onPeekEnd(): void {
    if (this.mode.kind === "peeking") this.reset();
  }

  onMenuChoice(id: string): void {
    const mode = this.mode;
    if (mode.kind === "turnMenu") {
      if (id === "endTurn") this.endTurn();
      else if (id === "resign") this.openConfirmResign(mode.at);
      return;
    }
    if (mode.kind === "confirmResign") {
      if (id === "resignNow") void this.issue({ type: "resign" });
      else if (id === "keepPlaying") this.openTurnMenu(mode.at);
      return;
    }
    if (mode.kind !== "menu") return;
    if (id === "cancel") this.backToSelection(mode);
    else if (id === "wait") void this.commit(mode, { type: "wait" });
    else if (id === "capture") void this.commit(mode, { type: "capture" });
    else if (id === "load") void this.commit(mode, { type: "load" });
    else if (id === "join") void this.commit(mode, { type: "join" });
    else if (id === "supply") void this.commit(mode, { type: "supply" });
    else if (id === "dive") void this.commit(mode, { type: "dive" });
    else if (id === "surface") void this.commit(mode, { type: "surface" });
    else if (id === "unload") this.startUnloading(mode);
    else if (id === "fire") this.startTargeting(mode);
  }

  /** Your unit on this tile, if it can still act this turn. */
  private readyUnitAt(tile: Point): Unit | undefined {
    const state = this.deps.getState();
    const unit = unitAt(state, tile);
    return unit && unit.owner === state.currentPlayer && !unit.hasActed ? unit : undefined;
  }

  private selectAt(tile: Point): void {
    const unit = this.readyUnitAt(tile);
    if (unit) {
      const state = this.deps.getState();
      const reach = reachableTiles(state, unit);
      this.mode = { kind: "selected", unitId: unit.id, reach, path: [] };
      this.deps.view.showRanges([{ tiles: [...reach.keys()].map((i) => tilePoint(state, i)), kind: "move" }]);
      this.deps.view.showPath(unit.pos, []);
    } else if (!this.openBuildMenu(tile)) {
      this.openTurnMenu(tile);
    }
  }

  /** Opens the build list if this is your own empty factory. Returns whether it did. */
  private openBuildMenu(pos: Point): boolean {
    const state = this.deps.getState();
    const options = unitAt(state, pos) ? [] : buildOptions(state, pos);
    if (options.length === 0) return false;
    this.mode = { kind: "building" };
    this.deps.buildMenu.open(
      options,
      (unitType) => void this.commitBuild(unitType, pos),
      () => this.reset(),
    );
    return true;
  }

  /** End Turn comes last and is highlighted, so it's one press away. */
  private openTurnMenu(at: Point): void {
    const items = [RESIGN, END_TURN];
    this.mode = { kind: "turnMenu", at };
    this.deps.view.openMenu(at, items, items.length - 1);
  }

  private openConfirmResign(at: Point): void {
    this.mode = { kind: "confirmResign", at };
    this.deps.view.openMenu(at, [KEEP_PLAYING, RESIGN_NOW]);
  }

  /** Sends a command that isn't about one unit, holding input until it has played out. */
  private async issue(command: Command): Promise<void> {
    this.reset();
    this.mode = { kind: "busy" };
    await this.deps.dispatch(command);
    this.release();
  }

  private async commitBuild(unitType: UnitTypeId, pos: Point): Promise<void> {
    this.deps.buildMenu.close();
    this.mode = { kind: "busy" };
    await this.deps.dispatch({ type: "build", unitType, pos });
    this.release();
  }

  /** Where a unit can move, and in red what it can hit beyond that. */
  private threatLayers(state: GameState, unit: Unit, reach: ReadonlyMap<number, Reach>, tiles: readonly Point[]): RangeLayer[] {
    const threat = threatTiles(state, unit);
    const beyondMove = UNITS[unit.type].canMoveAndFire
      ? threat.filter((p) => !reach.has(p.y * state.map.width + p.x))
      : threat;
    return [{ tiles, kind: "inspect" }, { tiles: beyondMove, kind: "attack" }];
  }

  private async chooseDestination(tile: Point): Promise<void> {
    if (this.mode.kind !== "selected") return;
    const { unitId, reach } = this.mode;
    const state = this.deps.getState();
    const unit = state.units.find((u) => u.id === unitId);
    if (!unit) {
      this.reset();
      return;
    }

    // Outside the range: drops the selection, picking up another ready unit if there's one there.
    if (!reach.has(tile.y * state.map.width + tile.x)) {
      this.reset();
      if (this.readyUnitAt(tile)) this.selectAt(tile);
      return;
    }
    // A friendly unit's tile: you can pass through it, but only stop to board or join it.
    if (!canEndOn(state, unit, tile) && this.boardingItems(unit, tile).length === 0) return;

    const end = this.mode.path[this.mode.path.length - 1] ?? unit.pos;
    const path = end.x === tile.x && end.y === tile.y ? this.mode.path : (cheapestPath(state, reach, tile) ?? []);

    this.mode = { kind: "busy" };
    this.deps.view.clearRange();
    this.deps.view.clearPath();
    await this.deps.view.previewMove(unitId, [unit.pos, ...path]);
    const { state: moved, moved: at } = this.afterMove(unit, tile);
    const targets = attackTargets(state, at, path.length > 0);
    this.openMenu({ unitId, reach, path, targets, forts: fortTargets(moved, at, path.length > 0) });
  }

  private openMenu(aimed: Aimed): void {
    const { unitId, reach, path, targets, forts } = aimed;
    const unit = this.deps.getState().units.find((u) => u.id === unitId);
    if (!unit) {
      this.reset();
      return;
    }
    this.mode = { kind: "menu", unitId, reach, path, targets, forts };
    const at = path[path.length - 1] ?? unit.pos;
    const boarding = this.boardingItems(unit, at);
    const items = boarding.length > 0 ? [...boarding, CANCEL] : [...this.actionItems(unit, at, targets.length + forts.length > 0), WAIT, CANCEL];
    this.deps.view.openMenu(at, items);
  }

  /** LOAD and/or JOIN, if `tile` holds a friendly unit this one can board or merge with. */
  private boardingItems(unit: Unit, tile: Point): MenuItem[] {
    const host = unitAt(this.deps.getState(), tile);
    if (!host || host.id === unit.id) return [];
    return [...(loadProblem(unit, host) === null ? [LOAD] : []), ...(joinProblem(unit, host) === null ? [JOIN] : [])];
  }

  /** What the unit could do on an empty tile, besides Wait. */
  private actionItems(unit: Unit, at: Point, canFire: boolean): MenuItem[] {
    const { state, moved } = this.afterMove(unit, at);
    const passenger = moved.cargo[0];
    return [
      ...(canFire ? [FIRE] : []),
      ...(captureProblem(state, moved) === null ? [CAPTURE] : []),
      ...(passenger && unloadTiles(state, moved, passenger).length > 0 ? [UNLOAD] : []),
      ...(supplyTargets(state, moved).length > 0 ? [SUPPLY] : []),
      ...(diveProblem(moved) === null ? [DIVE] : []),
      ...(surfaceProblem(moved) === null ? [SURFACE] : []),
    ];
  }

  /** The game as it would be with the unit at its destination, for checking what it can do there. */
  private afterMove(unit: Unit, at: Point): { state: GameState; moved: Unit } {
    const state = this.deps.getState();
    const moved = { ...unit, pos: at };
    return { state: { ...state, units: state.units.map((u) => (u.id === unit.id ? moved : u)) }, moved };
  }

  private startUnloading(mode: Extract<Mode, { kind: "menu" }>): void {
    const { view } = this.deps;
    const unit = this.deps.getState().units.find((u) => u.id === mode.unitId);
    if (!unit) return;
    const { state, moved } = this.afterMove(unit, mode.path[mode.path.length - 1] ?? unit.pos);
    const passenger = moved.cargo[0];
    if (!passenger) return;
    const tiles = unloadTiles(state, moved, passenger);
    const first = tiles[0];
    if (!first) return;
    view.closeMenu();
    this.mode = { ...mode, kind: "unloading", passenger: passenger.id, tiles };
    view.showRanges([{ tiles, kind: "move" }]);
    view.setCursor(first);
  }

  private startTargeting(mode: Extract<Mode, { kind: "menu" }>): void {
    const { view } = this.deps;
    const tiles = targetTiles(mode);
    const first = tiles[0];
    if (!first) return;
    view.closeMenu();
    const targeting = { ...mode, kind: "targeting" as const };
    this.mode = targeting;
    view.showRanges([{ tiles, kind: "attack" }]);
    view.setCursor(first);
    this.showForecastAt(targeting, first);
  }

  /** Back from a target or unload tile to where the unit is about to act. */
  private cursorToDestination(chosen: Chosen): void {
    const unit = this.deps.getState().units.find((u) => u.id === chosen.unitId);
    if (unit) this.deps.view.setCursor(chosen.path[chosen.path.length - 1] ?? unit.pos);
  }

  private showForecastAt(mode: Extract<Mode, { kind: "targeting" }>, tile: Point): void {
    const { view } = this.deps;
    const state = this.deps.getState();
    const target = mode.targets.find((t) => t.pos.x === tile.x && t.pos.y === tile.y);
    const unit = state.units.find((u) => u.id === mode.unitId);
    const end = mode.path[mode.path.length - 1];
    const attacker = unit && end ? { ...unit, pos: end } : unit;
    const isFort = mode.forts.some((f) => f.x === tile.x && f.y === tile.y);
    if (attacker && target) {
      const result = forecast(state, attacker, target);
      if (result) view.showForecast(tile, forecastLines(result));
    } else if (attacker && isFort) {
      const result = fortForecast(state, attacker, tile);
      if (result) view.showForecast(tile, forecastLines(result, "BREAK"));
    } else {
      view.clearForecast();
    }
  }

  private backToSelection(mode: Extract<Mode, { kind: "menu" }>): void {
    const { view } = this.deps;
    const state = this.deps.getState();
    const unit = state.units.find((u) => u.id === mode.unitId);
    view.closeMenu();
    view.resetPreview();
    if (!unit) {
      this.reset();
      return;
    }
    this.mode = { kind: "selected", unitId: mode.unitId, reach: mode.reach, path: mode.path };
    view.showRanges([{ tiles: [...mode.reach.keys()].map((i) => tilePoint(state, i)), kind: "move" }]);
    view.showPath(unit.pos, mode.path);
  }

  private async commit(chosen: Chosen, action: UnitAction): Promise<void> {
    const { view } = this.deps;
    view.closeMenu();
    view.clearRange();
    view.clearForecast();
    this.mode = { kind: "busy" };
    const ok = await this.deps.dispatch({ type: "move", unitId: chosen.unitId, path: chosen.path, action });
    this.release();
    if (!ok) this.reset();
  }

  /** Back to idle after a command, unless that command ended the game. */
  private release(): void {
    if (this.mode.kind === "busy") this.mode = { kind: "idle" };
  }
}
