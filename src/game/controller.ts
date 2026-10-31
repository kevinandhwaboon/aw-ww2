// Turns player input into engine commands: a small state machine over select → move preview →
// action menu → targeting → command. Knows nothing about Phaser: it talks to the map through
// MapView, so the rules for what a click means live here and the drawing lives in MapScene.

import { attackTargets, forecast, threatTiles, type CombatForecast } from "../engine/combat";
import type { Command, UnitAction } from "../engine/commands";
import { UNITS, type UnitTypeId } from "../engine/data/units";
import { buildOptions, captureProblem, type BuildOption } from "../engine/economy";
import type { Point } from "../engine/map";
import { canEndOn, cheapestPath, reachableTiles, tilePoint, type Reach } from "../engine/movement";
import { unitAt, type GameState, type Unit, type UnitId } from "../engine/state";
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
  openMenu(at: Point, items: readonly MenuItem[]): void;
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

type Mode =
  | { readonly kind: "idle" }
  /** Looking at an enemy unit's threat range. */
  | { readonly kind: "inspect" }
  | ({ readonly kind: "selected" } & Chosen)
  | ({ readonly kind: "menu"; readonly targets: readonly Unit[] } & Chosen)
  | ({ readonly kind: "targeting"; readonly targets: readonly Unit[] } & Chosen)
  /** Choosing where to unload a passenger. */
  | ({
      readonly kind: "unloading";
      readonly targets: readonly Unit[];
      readonly passenger: UnitId;
      readonly tiles: readonly Point[];
    } & Chosen)
  /** The factory build list is open. */
  | { readonly kind: "building" }
  /** Hold X or right-click: showing a unit's range until released. */
  | { readonly kind: "peeking" }
  /** Animating or waiting for the engine: input is ignored. */
  | { readonly kind: "busy" };

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
const WAIT: MenuItem = { id: "wait", label: "WAIT" };
const CANCEL: MenuItem = { id: "cancel", label: "CANCEL" };

const percent = ({ min, max }: { min: number; max: number }) => (min === max ? `${min}%` : `${min}-${max}%`);

/** The damage forecast as short lines for the map panel. */
export function forecastLines(f: CombatForecast): string[] {
  const kill = f.certainKill ? " KILL" : f.canKill ? " KILL?" : "";
  const killed = f.counterCertainKill ? " KILL" : f.counterCanKill ? " KILL?" : "";
  return [`DMG ${percent(f.attack)}${kill}`, f.counter ? `BACK ${percent(f.counter)}${killed}` : "NO COUNTER"];
}

export class InputController {
  private mode: Mode = { kind: "idle" };

  constructor(private readonly deps: ControllerDeps) {}

  get busy(): boolean {
    return this.mode.kind === "busy";
  }

  /** Drops any selection, e.g. before End Turn or after an undo. */
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
      case "inspect":
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
        return;
      }
      case "unloading":
        if (mode.tiles.some((t) => t.x === tile.x && t.y === tile.y)) {
          void this.commit(mode, { type: "unload", passenger: mode.passenger, to: tile });
        }
        return;
      case "menu":
      case "busy":
        return;
    }
  }

  onCancel(): void {
    const mode = this.mode;
    switch (mode.kind) {
      case "selected":
      case "inspect":
      case "building":
      case "peeking":
        this.reset();
        return;
      case "menu":
        this.backToSelection(mode);
        return;
      case "targeting":
      case "unloading":
        this.deps.view.clearRange();
        this.deps.view.clearForecast();
        this.openMenu(mode);
        return;
      case "idle":
      case "busy":
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
    if (mode.kind !== "menu") return;
    if (id === "cancel") this.backToSelection(mode);
    else if (id === "wait") void this.commit(mode, { type: "wait" });
    else if (id === "capture") void this.commit(mode, { type: "capture" });
    else if (id === "load") void this.commit(mode, { type: "load" });
    else if (id === "join") void this.commit(mode, { type: "join" });
    else if (id === "supply") void this.commit(mode, { type: "supply" });
    else if (id === "unload") this.startUnloading(mode);
    else if (id === "fire") this.startTargeting(mode);
  }

  private selectAt(tile: Point): void {
    const state = this.deps.getState();
    const unit = unitAt(state, tile);
    if (!unit) {
      this.openBuildMenu(tile);
      return;
    }
    const reach = reachableTiles(state, unit);
    const tiles = [...reach.keys()].map((i) => tilePoint(state, i));
    if (unit.owner === state.currentPlayer) {
      if (unit.hasActed) return;
      this.mode = { kind: "selected", unitId: unit.id, reach, path: [] };
      this.deps.view.showRanges([{ tiles, kind: "move" }]);
      this.deps.view.showPath(unit.pos, []);
    } else {
      this.mode = { kind: "inspect" };
      this.deps.view.showRanges(this.threatLayers(state, unit, reach, tiles));
    }
  }

  /** Clicking your own empty factory opens its build list. */
  private openBuildMenu(pos: Point): void {
    const options = buildOptions(this.deps.getState(), pos);
    if (options.length === 0) return;
    this.mode = { kind: "building" };
    this.deps.buildMenu.open(
      options,
      (unitType) => void this.commitBuild(unitType, pos),
      () => this.reset(),
    );
  }

  private async commitBuild(unitType: UnitTypeId, pos: Point): Promise<void> {
    this.deps.buildMenu.close();
    this.mode = { kind: "busy" };
    await this.deps.dispatch({ type: "build", unitType, pos });
    this.mode = { kind: "idle" };
  }

  /** Where an enemy can move, and in red what it can hit beyond that. */
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

    // Clicking outside the range drops the selection and treats the click as a fresh one.
    if (!reach.has(tile.y * state.map.width + tile.x)) {
      this.reset();
      this.selectAt(tile);
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
    const targets = attackTargets(state, { ...unit, pos: tile }, path.length > 0);
    this.openMenu({ unitId, reach, path, targets });
  }

  private openMenu(chosen: Chosen & { readonly targets: readonly Unit[] }): void {
    const { unitId, reach, path, targets } = chosen;
    const unit = this.deps.getState().units.find((u) => u.id === unitId);
    if (!unit) {
      this.reset();
      return;
    }
    this.mode = { kind: "menu", unitId, reach, path, targets };
    const at = path[path.length - 1] ?? unit.pos;
    const boarding = this.boardingItems(unit, at);
    const items = boarding.length > 0 ? [...boarding, CANCEL] : [...this.actionItems(unit, at, targets), WAIT, CANCEL];
    this.deps.view.openMenu(at, items);
  }

  /** LOAD and/or JOIN, if `tile` holds a friendly unit this one can board or merge with. */
  private boardingItems(unit: Unit, tile: Point): MenuItem[] {
    const host = unitAt(this.deps.getState(), tile);
    if (!host || host.id === unit.id) return [];
    return [...(loadProblem(unit, host) === null ? [LOAD] : []), ...(joinProblem(unit, host) === null ? [JOIN] : [])];
  }

  /** What the unit could do on an empty tile, besides Wait. */
  private actionItems(unit: Unit, at: Point, targets: readonly Unit[]): MenuItem[] {
    const { state, moved } = this.afterMove(unit, at);
    const passenger = moved.cargo[0];
    return [
      ...(targets.length > 0 ? [FIRE] : []),
      ...(captureProblem(state, moved) === null ? [CAPTURE] : []),
      ...(passenger && unloadTiles(state, moved, passenger).length > 0 ? [UNLOAD] : []),
      ...(supplyTargets(state, moved).length > 0 ? [SUPPLY] : []),
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
    const first = mode.targets[0];
    if (!first) return;
    view.closeMenu();
    const targeting = { ...mode, kind: "targeting" as const };
    this.mode = targeting;
    view.showRanges([{ tiles: mode.targets.map((t) => t.pos), kind: "attack" }]);
    view.setCursor(first.pos);
    this.showForecastAt(targeting, first.pos);
  }

  private showForecastAt(mode: Extract<Mode, { kind: "targeting" }>, tile: Point): void {
    const { view } = this.deps;
    const state = this.deps.getState();
    const target = mode.targets.find((t) => t.pos.x === tile.x && t.pos.y === tile.y);
    const unit = state.units.find((u) => u.id === mode.unitId);
    const end = mode.path[mode.path.length - 1];
    const result = target && unit ? forecast(state, end ? { ...unit, pos: end } : unit, target) : null;
    if (target && result) view.showForecast(target.pos, forecastLines(result));
    else view.clearForecast();
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
    this.mode = { kind: "idle" };
    if (!ok) this.reset();
  }
}
