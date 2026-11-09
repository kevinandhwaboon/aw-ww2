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
import { joinProblem, launchable, launchState, loadProblem, supplyTargets, unloadTiles } from "../engine/transport";
import { unitName } from "./artPack";
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
  /**
   * Draws this state in place of the game's until it's called with null or a new game state is shown:
   * an aircraft out on its Carrier's tile while it's being launched (05-supply-transport §10).
   */
  showPreviewState(state: GameState | null): void;
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

/** A passenger and the tile chosen for it, not yet sent to the engine. */
interface PlannedUnload {
  readonly passenger: UnitId;
  readonly to: Point;
}

/** An aircraft being launched from a Carrier: it's out on the Carrier's tile until the move is sent. */
interface Launching {
  readonly carrierId: UnitId;
  readonly unitId: UnitId;
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
  /** Choosing where to unload a passenger; `first` is set while placing the second of two. */
  | ({ readonly kind: "unloading"; readonly passenger: UnitId; readonly tiles: readonly Point[]; readonly first?: PlannedUnload } & Aimed)
  /** One passenger placed: unload the other too, or Wait to land just the first. */
  | ({ readonly kind: "unloadMenu"; readonly first: PlannedUnload } & Aimed)
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
const LAUNCH: MenuItem = { id: "launch", label: "LAUNCH" };
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
  /** Set while an aircraft is being launched: the game is then seen with it out on the Carrier's tile. */
  private launching: Launching | undefined;

  constructor(private readonly deps: ControllerDeps) {}

  /** The game as the player sees it: with the aircraft out on its Carrier while one is being launched. */
  private state(): GameState {
    const state = this.deps.getState();
    const launching = this.launching;
    return (launching && launchState(state, launching.carrierId, launching.unitId)) ?? state;
  }

  /** Drops the launch context and goes back to drawing the real game. */
  private endLaunch(): void {
    if (!this.launching) return;
    this.launching = undefined;
    this.deps.view.showPreviewState(null);
  }

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
    this.endLaunch();
    this.mode = { kind: "idle" };
  }

  /**
   * Where an arrow key takes the cursor. While choosing a destination it stays inside the move
   * range. While choosing a target or an unload tile it only steps between the choices.
   */
  nextCursor(from: Point, step: Point): Point {
    const mode = this.mode;
    const { map } = this.state();
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
    const state = this.state();
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
        if (mode.tiles.some((t) => t.x === tile.x && t.y === tile.y)) this.placePassenger(mode, tile);
        return;
      case "unloadMenu":
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
        if (this.launching) {
          this.backToCarrier(this.launching.carrierId);
          return;
        }
        this.reset();
        return;
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
      case "unloading":
        if (mode.first) {
          this.deps.view.clearRange();
          this.openUnloadMenu(mode, mode.first);
          return;
        }
        this.deps.view.clearRange();
        this.openMenu(mode);
        this.cursorToDestination(mode);
        return;
      case "unloadMenu":
      case "targeting":
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
    const state = this.state();
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
    if (mode.kind === "unloadMenu") {
      if (id === "unload") this.startUnloading(mode, this.unloadable(mode, mode.first)[0]?.id, mode.first);
      else if (id === "wait") void this.commit(mode, { type: "unload", ...mode.first });
      else if (id === "cancel") this.onCancel();
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
    else if (id === "unload") this.startUnloading(mode, this.unloadable(mode)[0]?.id);
    else if (id.startsWith("unload:")) this.startUnloading(mode, Number(id.slice("unload:".length)));
    else if (id === "launch") this.startLaunch(mode.unitId, this.launchable(mode)[0]?.id);
    else if (id.startsWith("launch:")) this.startLaunch(mode.unitId, Number(id.slice("launch:".length)));
    else if (id === "fire") this.startTargeting(mode);
  }

  /** Your unit on this tile, if it can still act this turn. */
  private readyUnitAt(tile: Point): Unit | undefined {
    const state = this.state();
    const unit = unitAt(state, tile);
    return unit && unit.owner === state.currentPlayer && !unit.hasActed ? unit : undefined;
  }

  private selectAt(tile: Point): void {
    const unit = this.readyUnitAt(tile);
    if (unit) {
      const state = this.state();
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
    const state = this.state();
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
    const state = this.state();
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
    // A launched aircraft has to fly off its Carrier's tile (05-supply-transport §10).
    if (this.launching && tile.x === unit.pos.x && tile.y === unit.pos.y) return;
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
    const unit = this.state().units.find((u) => u.id === unitId);
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
    const host = unitAt(this.state(), tile);
    if (!host || host.id === unit.id) return [];
    return [...(loadProblem(this.state(), unit, host) === null ? [LOAD] : []), ...(joinProblem(unit, host) === null ? [JOIN] : [])];
  }

  /** What the unit could do on an empty tile, besides Wait. */
  private actionItems(unit: Unit, at: Point, canFire: boolean): MenuItem[] {
    const { state, moved } = this.afterMove(unit, at);
    return [
      ...(canFire ? [FIRE] : []),
      ...(captureProblem(state, moved) === null ? [CAPTURE] : []),
      ...this.unloadItems(this.unloadable({ unitId: unit.id, path: [at] })),
      ...this.launchItems(at.x === unit.pos.x && at.y === unit.pos.y ? this.launchable({ unitId: unit.id, path: [] }) : []),
      ...(supplyTargets(state, moved).length > 0 ? [SUPPLY] : []),
      ...(diveProblem(moved) === null ? [DIVE] : []),
      ...(surfaceProblem(moved) === null ? [SURFACE] : []),
    ];
  }

  /** The game as it would be with the unit at its destination, for checking what it can do there. */
  private afterMove(unit: Unit, at: Point): { state: GameState; moved: Unit } {
    const state = this.state();
    const moved = { ...unit, pos: at };
    return { state: { ...state, units: state.units.map((u) => (u.id === unit.id ? moved : u)) }, moved };
  }

  /**
   * UNLOAD, or one UNLOAD per passenger when two different units are aboard, so the player picks
   * who goes first (05-supply-transport §8, D3).
   */
  private unloadItems(passengers: readonly Unit[]): MenuItem[] {
    const [first, second] = passengers;
    if (!first) return [];
    if (!second || second.type === first.type) return [UNLOAD];
    return passengers.map((p) => ({ id: `unload:${p.id}`, label: `UNLOAD ${unitName(p.type).toUpperCase()}` }));
  }

  /** Passengers that could be unloaded where the transport is about to stop, after any already placed. */
  private unloadable(chosen: Pick<Chosen, "unitId" | "path">, placed?: PlannedUnload): Unit[] {
    const unit = this.state().units.find((u) => u.id === chosen.unitId);
    if (!unit) return [];
    return unit.cargo.filter((p) => p.id !== placed?.passenger && this.unloadTilesFor(chosen, p.id, placed).length > 0);
  }

  /** Where this passenger could go, leaving out a tile already chosen for the other one. */
  private unloadTilesFor(chosen: Pick<Chosen, "unitId" | "path">, passengerId: UnitId, placed?: PlannedUnload): Point[] {
    const unit = this.state().units.find((u) => u.id === chosen.unitId);
    const passenger = unit?.cargo.find((c) => c.id === passengerId);
    if (!unit || !passenger) return [];
    const { state, moved } = this.afterMove(unit, chosen.path[chosen.path.length - 1] ?? unit.pos);
    return unloadTiles(state, moved, passenger).filter((t) => !placed || t.x !== placed.to.x || t.y !== placed.to.y);
  }

  private startUnloading(mode: Aimed, passengerId: UnitId | undefined, first?: PlannedUnload): void {
    const { view } = this.deps;
    if (passengerId === undefined) return;
    const tiles = this.unloadTilesFor(mode, passengerId, first);
    const start = tiles[0];
    if (!start) return;
    view.closeMenu();
    const { unitId, reach, path, targets, forts } = mode;
    this.mode = { kind: "unloading", unitId, reach, path, targets, forts, passenger: passengerId, tiles, ...(first ? { first } : {}) };
    view.showRanges([{ tiles, kind: "move" }]);
    view.setCursor(start);
  }

  /** A tile was chosen: send the order, or ask about the other passenger if it could land too. */
  private placePassenger(mode: Extract<Mode, { kind: "unloading" }>, to: Point): void {
    const placed = { passenger: mode.passenger, to };
    if (mode.first) {
      void this.commit(mode, { type: "unload", ...mode.first, second: placed });
      return;
    }
    if (this.unloadable(mode, placed).length > 0) {
      this.deps.view.clearRange();
      this.openUnloadMenu(mode, placed);
      return;
    }
    void this.commit(mode, { type: "unload", ...placed });
  }

  private openUnloadMenu(mode: Aimed, first: PlannedUnload): void {
    const { unitId, reach, path, targets, forts } = mode;
    this.mode = { kind: "unloadMenu", unitId, reach, path, targets, forts, first };
    this.deps.view.setCursor(first.to);
    this.deps.view.openMenu(first.to, [UNLOAD, WAIT, CANCEL]);
  }

  /** LAUNCH, or one LAUNCH per aircraft type when a Fighter and a Bomber are aboard (05-supply-transport §10). */
  private launchItems(aircraft: readonly Unit[]): MenuItem[] {
    const [first, second] = aircraft;
    if (!first) return [];
    if (!second || second.type === first.type) return [LAUNCH];
    return aircraft.map((a) => ({ id: `launch:${a.id}`, label: `LAUNCH ${unitName(a.type).toUpperCase()}` }));
  }

  /** Aircraft that can take off from this Carrier now: only while it stays where it is. */
  private launchable(chosen: Pick<Chosen, "unitId" | "path">): Unit[] {
    if (chosen.path.length > 0) return [];
    const carrier = this.state().units.find((u) => u.id === chosen.unitId);
    return carrier ? launchable(carrier) : [];
  }

  /** The aircraft comes out onto the Carrier's tile and is selected to move like any unit. */
  private startLaunch(carrierId: UnitId, unitId: UnitId | undefined): void {
    if (unitId === undefined) return;
    const { view } = this.deps;
    const preview = launchState(this.deps.getState(), carrierId, unitId);
    const aircraft = preview?.units.find((u) => u.id === unitId);
    if (!preview || !aircraft) return;
    view.closeMenu();
    view.resetPreview();
    this.launching = { carrierId, unitId };
    view.showPreviewState(preview);
    const reach = reachableTiles(preview, aircraft);
    this.mode = { kind: "selected", unitId, reach, path: [] };
    view.showRanges([{ tiles: [...reach.keys()].map((i) => tilePoint(preview, i)), kind: "move" }]);
    view.showPath(aircraft.pos, []);
    view.setCursor(aircraft.pos);
  }

  /** Cancelled a launch: back to the Carrier's menu, the aircraft back aboard. */
  private backToCarrier(carrierId: UnitId): void {
    const { view } = this.deps;
    view.clearRange();
    view.clearPath();
    this.endLaunch();
    const state = this.state();
    const carrier = state.units.find((u) => u.id === carrierId);
    if (!carrier) {
      this.reset();
      return;
    }
    view.setCursor(carrier.pos);
    this.openMenu({ unitId: carrierId, reach: reachableTiles(state, carrier), path: [], targets: [], forts: [] });
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
    const unit = this.state().units.find((u) => u.id === chosen.unitId);
    if (unit) this.deps.view.setCursor(chosen.path[chosen.path.length - 1] ?? unit.pos);
  }

  private showForecastAt(mode: Extract<Mode, { kind: "targeting" }>, tile: Point): void {
    const { view } = this.deps;
    const state = this.state();
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
    const state = this.state();
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
    const launching = this.launching;
    const command: Command = launching
      ? { type: "launch", carrierId: launching.carrierId, unitId: chosen.unitId, path: chosen.path, action }
      : { type: "move", unitId: chosen.unitId, path: chosen.path, action };
    // The launch preview stays drawn while the move plays; the new game state replaces it.
    this.launching = undefined;
    const ok = await this.deps.dispatch(command);
    this.release();
    if (!ok) {
      if (launching) view.showPreviewState(null);
      this.reset();
    }
  }

  /** Back to idle after a command, unless that command ended the game. */
  private release(): void {
    if (this.mode.kind === "busy") this.mode = { kind: "idle" };
  }
}
