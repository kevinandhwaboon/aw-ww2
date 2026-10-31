// Turns player input into engine commands: a small state machine over select → move preview →
// action menu → command. Knows nothing about Phaser: it talks to the map through MapView, so the
// rules for what a click means live here and the drawing lives in MapScene.

import type { Command } from "../engine/commands";
import type { Point } from "../engine/map";
import { canEndOn, cheapestPath, reachableTiles, tilePoint, type Reach } from "../engine/movement";
import { unitAt, type GameState, type UnitId } from "../engine/state";
import { extendPath } from "./pathBuilder";

export type RangeKind = "move" | "inspect";

export interface MenuItem {
  readonly id: string;
  readonly label: string;
}

/** What the controller needs from the map view. */
export interface MapView {
  showRange(tiles: readonly Point[], kind: RangeKind): void;
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
}

type Mode =
  | { readonly kind: "idle" }
  /** Looking at an enemy unit's move range. */
  | { readonly kind: "inspect" }
  | { readonly kind: "selected"; readonly unitId: UnitId; readonly reach: ReadonlyMap<number, Reach>; readonly path: Point[] }
  | { readonly kind: "menu"; readonly unitId: UnitId; readonly reach: ReadonlyMap<number, Reach>; readonly path: Point[] }
  /** Animating or waiting for the engine: input is ignored. */
  | { readonly kind: "busy" };

export interface ControllerDeps {
  getState(): GameState;
  /** Applies a command and plays its events. Resolves to whether the engine accepted it. */
  dispatch(command: Command): Promise<boolean>;
  view: MapView;
}

const ACTION_MENU: readonly MenuItem[] = [
  { id: "wait", label: "WAIT" },
  { id: "cancel", label: "CANCEL" },
];

export class InputController {
  private mode: Mode = { kind: "idle" };

  constructor(private readonly deps: ControllerDeps) {}

  get busy(): boolean {
    return this.mode.kind === "busy";
  }

  /** Drops any selection, e.g. before End Turn or after an undo. */
  reset(): void {
    const { view } = this.deps;
    view.closeMenu();
    view.clearRange();
    view.clearPath();
    view.resetPreview();
    this.mode = { kind: "idle" };
  }

  onCursorMove(tile: Point): void {
    const mode = this.mode;
    if (mode.kind !== "selected") return;
    const state = this.deps.getState();
    const unit = state.units.find((u) => u.id === mode.unitId);
    if (!unit) return;
    const path = extendPath(state, unit, mode.reach, mode.path, tile);
    this.mode = { ...mode, path };
    this.deps.view.showPath(unit.pos, path);
  }

  onConfirm(tile: Point): void {
    switch (this.mode.kind) {
      case "idle":
        this.selectAt(tile);
        return;
      case "inspect":
        this.reset();
        this.selectAt(tile);
        return;
      case "selected":
        void this.chooseDestination(tile);
        return;
      case "menu":
      case "busy":
        return;
    }
  }

  onCancel(): void {
    switch (this.mode.kind) {
      case "selected":
      case "inspect":
        this.reset();
        return;
      case "menu":
        this.backToSelection(this.mode);
        return;
      case "idle":
      case "busy":
        return;
    }
  }

  onMenuChoice(id: string): void {
    if (this.mode.kind !== "menu") return;
    if (id === "cancel") {
      this.backToSelection(this.mode);
      return;
    }
    if (id === "wait") void this.commit(this.mode.unitId, this.mode.path);
  }

  private selectAt(tile: Point): void {
    const state = this.deps.getState();
    const unit = unitAt(state, tile);
    if (!unit) return;
    const reach = reachableTiles(state, unit);
    const tiles = [...reach.keys()].map((i) => tilePoint(state, i));
    if (unit.owner === state.currentPlayer) {
      if (unit.hasActed) return;
      this.mode = { kind: "selected", unitId: unit.id, reach, path: [] };
      this.deps.view.showRange(tiles, "move");
      this.deps.view.showPath(unit.pos, []);
    } else {
      this.mode = { kind: "inspect" };
      this.deps.view.showRange(tiles, "inspect");
    }
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
    if (!canEndOn(state, unit, tile)) return; // e.g. a friendly unit's tile: can pass, can't stop

    const end = this.mode.path[this.mode.path.length - 1] ?? unit.pos;
    const path = end.x === tile.x && end.y === tile.y ? this.mode.path : (cheapestPath(state, reach, tile) ?? []);

    this.mode = { kind: "busy" };
    this.deps.view.clearRange();
    this.deps.view.clearPath();
    await this.deps.view.previewMove(unitId, [unit.pos, ...path]);
    this.mode = { kind: "menu", unitId, reach, path };
    this.deps.view.openMenu(tile, ACTION_MENU);
  }

  private backToSelection(mode: Extract<Mode, { kind: "menu" }>): void {
    const { view } = this.deps;
    const unit = this.deps.getState().units.find((u) => u.id === mode.unitId);
    view.closeMenu();
    view.resetPreview();
    if (!unit) {
      this.reset();
      return;
    }
    this.mode = { kind: "selected", unitId: mode.unitId, reach: mode.reach, path: mode.path };
    view.showRange([...mode.reach.keys()].map((i) => tilePoint(this.deps.getState(), i)), "move");
    view.showPath(unit.pos, mode.path);
  }

  private async commit(unitId: UnitId, path: Point[]): Promise<void> {
    this.deps.view.closeMenu();
    this.mode = { kind: "busy" };
    const ok = await this.deps.dispatch({ type: "move", unitId, path, action: { type: "wait" } });
    this.mode = { kind: "idle" };
    if (!ok) this.reset();
  }
}
