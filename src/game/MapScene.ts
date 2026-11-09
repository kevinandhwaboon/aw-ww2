import Phaser from "phaser";
import type { Combatant, GameEvent } from "../engine/commands";
import { veterancyFor } from "../engine/data/veterancy";
import { terrainAt, type Point } from "../engine/map";
import { displayHp, type GameState, type PlayerId, type Unit, type UnitId } from "../engine/state";
import * as stats from "../engine/stats";
import { weatherOn } from "../engine/weather";
import type { BattlePlayer } from "./battle/BattleScene";
import { setBattleWeather } from "./battle/colors";
import { planCombat, planFortAttack } from "./battle/plan";
import { planDrop } from "./battle/drop";
import { planCapture, planGarrison } from "./battle/storm";
import { activePack, findPropertyArt, findUnitArt, packColor, packColorNumber, type ColorKey } from "./artPack";
import type { MapView, MenuItem, RangeKind, RangeLayer } from "./controller";
import { garrisonedBunkers } from "./garrison";
import { objectiveTiles } from "./objectives";
import { packFileUrl } from "./loadArtPack";
import { drawPixelText, GLYPH_HEIGHT, textWidth } from "./pixelFont";
import { drawPlaceholderTileset, tileIndex, TILE_SIZE } from "./placeholderTiles";
import { terrainLayers } from "./terrainTiles";
import { clampScroll, FOLLOW_MARGIN_SQUARES, inLeftHalf, revealScroll, type Scroll, type Size } from "./viewport";
import { drawHpBadge, drawSubmergedBadge, drawUnitMarker, drawVeterancyBadge, playerColors } from "./placeholderUnits";

/** What the scene reports to whoever handles input (the InputController, wired up in main.ts). */
export interface MapInputHandlers {
  onCursorMove(tile: Point): void;
  /** Where an arrow key takes the cursor from `from`. */
  nextCursor(from: Point, step: Point): Point;
  onConfirm(tile: Point): void;
  onCancel(): void;
  onMenuChoice(id: string): void;
  /** X or the right mouse button went down. */
  onPeekStart(tile: Point): void;
  /** X or the right mouse button was released. */
  onPeekEnd(): void;
}

export interface MapSceneOptions {
  readonly state: GameState;
  /** Called when the cursor moves to a new tile (for the info panels). */
  readonly onCursorMove: (tile: Point) => void;
}

const MOVE_MS_PER_TILE = 70;
const RANGE_COLORS: Record<RangeKind, ColorKey> = { move: "rangeMove", inspect: "rangeInspect", attack: "rangeAttack" };
const MENU = { pad: 3, itemHeight: GLYPH_HEIGHT + 4 };
const IDLE_FRAMES_PER_SECOND = 3;
/** Unit shadows fall to the lower right, like the terrain's (08-art-pipeline §16). */
const UNIT_SHADOW_OFFSET = { x: 2, y: 1 };
const UNIT_SHADOW_ALPHA = 0.35;
const unitSheetKey = (sheet: number) => `pack-units-${sheet}`;
const TERRAIN_SHEET_KEY = "pack-terrain";
const PROPERTY_SHEET_KEY = "pack-properties";
/** Winter versions of the two sheets, same layouts (08-art-pipeline §21). */
const winterKey = (key: string) => `${key}-winter`;
/** How long each frame of moving water shows. */
const TERRAIN_FRAME_MS = 600;
const terrainFrameKey = (frame: number) => `terrain-frame-${frame}`;
/** Changes when any building changes hands or any bunker is garrisoned or left, so the map repaints. */
const ownerKey = (state: GameState) =>
  `${state.properties.map((p) => p.owner ?? "-").join(",")}|${[...garrisonedBunkers(state)].map(([tile, owner]) => `${tile}:${owner}`).join(",")}`;
const COMBAT_MS = { nudge: 70, flash: 140, float: 480, explode: 260 };
/** How long the view takes to pan to the cursor or to the next thing that happens. */
const PAN_MS = { cursor: 90, action: 220 };

/** What a shot lands on: a unit, or just a tile for a fortification. */
interface StrikeTarget {
  readonly pos: Point;
  readonly unitId?: UnitId;
}

const center = (p: Point) => ({ x: p.x * TILE_SIZE + TILE_SIZE / 2, y: p.y * TILE_SIZE + TILE_SIZE / 2 });

/**
 * Draws the map, units, move ranges, the path arrow and the action menu, and plays engine events
 * as animations. Presentation only: it reports input and never decides outcomes.
 */
export class MapScene extends Phaser.Scene implements MapView {
  private state: GameState;
  private handlers?: MapInputHandlers;
  private cursorTile: Point = { x: 0, y: 0 };

  private terrainImage?: Phaser.GameObjects.Image;
  private terrainFrames = 1;
  /** Canvas pixels per map pixel for the painted terrain: 2 when a sheet is drawn for the 32-pixel grid. */
  private terrainResolution = 1;
  private terrainFrame = 0;
  private placeholderTiles?: HTMLCanvasElement;
  private drawnTerrain: GameState["map"]["terrain"] = [];
  private cursor?: Phaser.GameObjects.Graphics;
  private rangeLayer?: Phaser.GameObjects.Graphics;
  private stateLayer?: Phaser.GameObjects.Container;
  /** Who owned each property when the terrain was last painted, since buildings are painted with it. */
  private drawnOwners = "";
  private pathLayer?: Phaser.GameObjects.Graphics;
  private unitSprites = new Map<UnitId, Phaser.GameObjects.Container>();
  /** Each unit's sprite inside its container, and the units drawn inside a garrisoned bunker. */
  private unitImages = new Map<UnitId, Phaser.GameObjects.Image | Phaser.GameObjects.Sprite>();
  private garrisoned = new Set<UnitId>();
  private previewed: UnitId | undefined;
  /** A state drawn in place of the game's, e.g. an aircraft out on its Carrier while it's launched. */
  private preview: GameState | undefined;
  private menu:
    | { container: Phaser.GameObjects.Container; items: readonly MenuItem[]; rect: Phaser.Geom.Rectangle; selected: number }
    | undefined;
  private forecastPanel: Phaser.GameObjects.Container | undefined;
  private pixelScale = 1;
  private created = false;
  /** Plays attacks as split-screen battle scenes (08-art-pipeline §18); null plays them on the map. */
  private battle: BattlePlayer | null = null;

  constructor(private readonly options: MapSceneOptions) {
    super("map");
    this.state = options.state;
  }

  setBattlePlayer(player: BattlePlayer | null): void {
    this.battle = player;
  }

  /**
   * Screen pixels per map pixel. The scene is drawn at screen resolution rather than enlarged
   * afterwards, so 32-pixel unit art keeps its detail inside a 16-pixel square (08-art-pipeline §17).
   */
  setPixelScale(scale: number): void {
    this.pixelScale = scale;
    if (!this.created) return; // create() applies it
    this.cameras.main.setSize(this.scale.width, this.scale.height).setOrigin(0, 0).setZoom(scale);
    this.scrollTo(this.scroll);
    void this.revealTiles([this.cursorTile], 0);
  }

  // ---- The view: which part of a large map is on screen (00-master-design §12) ----

  private scroll: Scroll = { x: 0, y: 0 };
  private panTween: Phaser.Tweens.Tween | undefined;

  /** The visible part of the map, in map pixels. */
  private viewSize(): Size {
    return { width: this.scale.width / this.pixelScale, height: this.scale.height / this.pixelScale };
  }

  private mapSize(): Size {
    return { width: this.state.map.width * TILE_SIZE, height: this.state.map.height * TILE_SIZE };
  }

  /** The part of the map on screen, in map pixels: menus and panels stay inside it. */
  private visibleRect(): { left: number; top: number; right: number; bottom: number } {
    const view = this.viewSize();
    return { left: this.scroll.x, top: this.scroll.y, right: this.scroll.x + view.width, bottom: this.scroll.y + view.height };
  }

  /** Whether a tile is in the left half of what's on screen, so panels can sit on the other side. */
  tileInLeftHalf(tile: Point): boolean {
    if (!this.created) return tile.x < this.state.map.width / 2;
    return inLeftHalf(tile.x * TILE_SIZE + TILE_SIZE / 2, this.scroll.x, this.viewSize().width);
  }

  /** Moves the view at once, kept inside the map and on whole screen pixels. */
  private scrollTo(target: Scroll): void {
    const clamped = clampScroll(target, this.viewSize(), this.mapSize());
    const snap = (v: number) => Math.round(v * this.pixelScale) / this.pixelScale;
    this.scroll = { x: snap(clamped.x), y: snap(clamped.y) };
    this.cameras.main.setScroll(this.scroll.x, this.scroll.y);
  }

  /**
   * Pans just far enough to show these tiles with a margin, or not at all if they're in view. Tiles
   * that don't fit the view together show the last one. Resolves when the pan finishes.
   */
  private revealTiles(tiles: readonly Point[], ms: number): Promise<void> {
    if (!this.created || tiles.length === 0) return Promise.resolve();
    const xs = tiles.map((t) => t.x * TILE_SIZE);
    const ys = tiles.map((t) => t.y * TILE_SIZE);
    const box = { x: Math.min(...xs), y: Math.min(...ys), width: Math.max(...xs) - Math.min(...xs) + TILE_SIZE, height: Math.max(...ys) - Math.min(...ys) + TILE_SIZE };
    const view = this.viewSize();
    const last = tiles[tiles.length - 1];
    const fits = box.width <= view.width && box.height <= view.height;
    const target = fits || !last ? box : { x: last.x * TILE_SIZE, y: last.y * TILE_SIZE, width: TILE_SIZE, height: TILE_SIZE };
    const next = revealScroll(this.scroll, view, this.mapSize(), target, FOLLOW_MARGIN_SQUARES * TILE_SIZE);
    return this.panTo(next, ms);
  }

  private panTo(target: Scroll, ms: number): Promise<void> {
    const from = this.scroll;
    if (target.x === from.x && target.y === from.y) return Promise.resolve();
    this.panTween?.stop();
    this.panTween = undefined;
    if (ms <= 0) {
      this.scrollTo(target);
      this.viewMoved();
      return Promise.resolve();
    }
    const position = { ...from };
    return new Promise((resolve) => {
      this.panTween = this.tweens.add({
        targets: position,
        x: target.x,
        y: target.y,
        duration: ms,
        ease: "Sine.easeOut",
        onUpdate: () => this.scrollTo(position),
        onComplete: () => {
          this.viewMoved();
          resolve();
        },
        onStop: () => resolve(),
      });
    });
  }

  /** The panels pick their side from where the cursor is on screen, which a pan changes. */
  private viewMoved(): void {
    this.options.onCursorMove(this.cursorTile);
  }

  setHandlers(handlers: MapInputHandlers): void {
    this.handlers = handlers;
  }

  preload(): void {
    // A file that fails to load just isn't in the texture cache, so that art falls back to placeholders.
    this.load.on("loaderror", (file: { key: string }) => console.warn(`Art pack file failed to load: ${file.key}`));
    const pack = activePack();
    pack.unitSheets.forEach((sheet, i) => {
      this.load.spritesheet(unitSheetKey(i), packFileUrl(sheet.path), { frameWidth: sheet.frameSize, frameHeight: sheet.frameSize });
    });
    if (pack.terrain) {
      this.load.image(TERRAIN_SHEET_KEY, packFileUrl(pack.terrain.path));
      if (pack.terrain.winterPath) this.load.image(winterKey(TERRAIN_SHEET_KEY), packFileUrl(pack.terrain.winterPath));
    }
    if (pack.properties) {
      this.load.image(PROPERTY_SHEET_KEY, packFileUrl(pack.properties.path));
      if (pack.properties.winterPath) this.load.image(winterKey(PROPERTY_SHEET_KEY), packFileUrl(pack.properties.winterPath));
    }
  }

  /** The sheet to draw from: its winter version on a winter map, if the pack has one (12-weather §5). */
  private seasonal(key: string): string {
    const winter = winterKey(key);
    return this.state.weather.season === "winter" && this.textures.exists(winter) ? winter : key;
  }

  private sheetImage(key: string): (CanvasImageSource & { width: number; height: number }) | null {
    return this.textures.exists(key) ? (this.textures.get(key).getSourceImage() as CanvasImageSource & { width: number; height: number }) : null;
  }

  /**
   * Paints the whole map's terrain and buildings into one canvas per animation frame: the pack's
   * tiles where it has them (08-art-pipeline §14–17), placeholders everywhere else. Rows go top to
   * bottom, so anything tall in front overlaps the row behind it. Art drawn for the 32-pixel grid is
   * painted at double resolution and the image scaled back into 16-pixel squares, keeping its detail.
   */
  private paintTerrain(): void {
    const { map } = this.state;
    const placeholders = (this.placeholderTiles ??= drawPlaceholderTileset());
    const pack = activePack();
    const source = pack.terrain ? this.sheetImage(this.seasonal(TERRAIN_SHEET_KEY)) : null;
    const sheet = source ? pack.terrain : null;
    const frames = sheet?.frames ?? 1;
    const wide = sheet?.tileWidth ?? TILE_SIZE;
    const tall = sheet?.tileHeight ?? TILE_SIZE;
    const across = source ? Math.floor(source.width / wide) : 1;
    const tilesPerFrame = source ? across * Math.floor(source.height / tall / frames) : 0;
    const buildings = pack.properties ? this.sheetImage(this.seasonal(PROPERTY_SHEET_KEY)) : null;
    const buildingWidth = pack.properties?.tileWidth ?? TILE_SIZE;
    const buildingHeight = pack.properties?.tileHeight ?? TILE_SIZE;
    const res = Math.max(source ? wide : TILE_SIZE, buildings ? buildingWidth : TILE_SIZE) / TILE_SIZE;
    const cell = TILE_SIZE * res;
    const owners = new Map<number, PlayerId | null>([
      ...this.state.properties.map((p) => [p.pos.y * map.width + p.pos.x, p.owner] as const),
      ...this.garrisonArt(),
    ]);
    for (let frame = 0; frame < frames; frame++) {
      const key = terrainFrameKey(frame);
      const texture = this.textures.exists(key)
        ? (this.textures.get(key) as Phaser.Textures.CanvasTexture)
        : this.textures.createCanvas(key, map.width * cell, map.height * cell);
      if (!texture) throw new Error("Failed to create the terrain canvas");
      const ctx = texture.getContext();
      ctx.imageSmoothingEnabled = false;
      ctx.clearRect(0, 0, map.width * cell, map.height * cell);
      for (let y = 0; y < map.height; y++) {
        for (let x = 0; x < map.width; x++) {
          for (const layer of terrainLayers(map, x, y, sheet)) {
            if (layer.kind === "placeholder") {
              ctx.drawImage(placeholders, tileIndex(layer.terrain) * TILE_SIZE, 0, TILE_SIZE, TILE_SIZE, x * cell, y * cell, cell, cell);
            } else if (source) {
              const n = layer.tile + frame * tilesPerFrame;
              const sx = (n % across) * wide, sy = Math.floor(n / across) * tall;
              const h = (tall * cell) / wide;
              ctx.drawImage(source, sx, sy, wide, tall, x * cell, (y + 1) * cell - h, cell, h);
            }
          }
          const owner = owners.get(y * map.width + x);
          const building = buildings && owner !== undefined ? findPropertyArt(pack, terrainAt(map, { x, y }), owner) : null;
          if (buildings && building !== null && pack.properties) {
            const sx = (building % pack.properties.columns.length) * buildingWidth;
            const sy = Math.floor(building / pack.properties.columns.length) * buildingHeight;
            const h = (buildingHeight * cell) / buildingWidth;
            ctx.drawImage(buildings, sx, sy, buildingWidth, buildingHeight, x * cell, (y + 1) * cell - h, cell, h);
          }
        }
      }
      texture.refresh();
    }
    this.terrainFrames = frames;
    this.terrainResolution = res;
    this.drawnTerrain = map.terrain;
    this.drawnOwners = ownerKey(this.state);
  }

  create(): void {
    this.created = true;
    this.setPixelScale(this.pixelScale);
    this.paintTerrain();
    this.terrainImage = this.add.image(0, 0, terrainFrameKey(0)).setOrigin(0).setScale(1 / this.terrainResolution);
    if (this.terrainFrames > 1) {
      this.time.addEvent({
        delay: TERRAIN_FRAME_MS,
        loop: true,
        callback: () => {
          this.terrainFrame = (this.terrainFrame + 1) % this.terrainFrames;
          this.terrainImage?.setTexture(terrainFrameKey(this.terrainFrame));
        },
      });
    }

    // Draw order, bottom to top: terrain and buildings, range, flags + units, path arrow, cursor, menu.
    this.rangeLayer = this.add.graphics();
    this.stateLayer = this.add.container(0, 0);
    this.pathLayer = this.add.graphics();
    this.snowLayer = this.add.graphics();
    this.cursor = this.add.graphics();
    this.renderState();
    this.drawCursor();
    this.options.onCursorMove(this.cursorTile);

    // A mouse wheel or two-finger trackpad swipe scrolls the view.
    this.input.on("wheel", (_pointer: Phaser.Input.Pointer, _over: unknown, dx: number, dy: number) => {
      this.scrollTo({ x: this.scroll.x + dx / this.pixelScale, y: this.scroll.y + dy / this.pixelScale });
      this.viewMoved();
    });
    this.input.mouse?.disableContextMenu();
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer));
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer));
    this.input.on("pointerup", () => this.handlers?.onPeekEnd());
    this.input.on("pointerupoutside", () => this.handlers?.onPeekEnd());
    this.game.events.on("blur", () => this.handlers?.onPeekEnd()); // a release we'd otherwise never see
    // Not Phaser's keyboard events: they replay earlier keys when several land in one frame.
    window.addEventListener("keydown", (event) => this.onKey(event));
    window.addEventListener("keyup", (event) => this.releaseKey(event.key));
  }

  private snowLayer?: Phaser.GameObjects.Graphics;

  /**
   * Snow falling over the visible part of the map while it snows (12-weather §5). Each flake's place
   * is a function of the time, so nothing is stored between frames.
   */
  override update(time: number): void {
    const layer = this.snowLayer;
    if (!layer) return;
    layer.clear();
    if (weatherOn(this.state) !== "snow") return;
    const view = this.cameras.main.worldView;
    const color = packColorNumber("snowfall");
    const shadow = packColorNumber("snowfallShadow");
    const flakes = Math.round((view.width * view.height) / 700);
    for (let i = 0; i < flakes; i++) {
      const seedX = ((i * 7919) % 1009) / 1009;
      const seedY = ((i * 104729) % 997) / 997;
      const fall = 0.012 + ((i * 31) % 7) * 0.002; // map pixels per millisecond
      const y = (seedY * view.height + time * fall) % view.height;
      const sway = Math.sin(time / 900 + i) * 3;
      const x = (((seedX * view.width + time * 0.004 + sway) % view.width) + view.width) % view.width;
      const size = i % 4 === 0 ? 1 : 0.5;
      // A faint shadow below each flake, so it shows over snowy ground as well as over trees.
      layer.fillStyle(shadow, 0.35);
      layer.fillRect(view.x + x + size / 2, view.y + y + size, size, size);
      layer.fillStyle(color, 0.95);
      layer.fillRect(view.x + x, view.y + y, size, size);
    }
  }

  /** Shows a new game state. Safe to call before the scene has been created. */
  setState(state: GameState): void {
    this.state = state;
    this.previewed = undefined;
    this.preview = undefined;
    this.renderState();
  }

  // ---- Input ----

  private tileAt(worldX: number, worldY: number): Point {
    const { map } = this.state;
    return {
      x: Phaser.Math.Clamp(Math.floor(worldX / TILE_SIZE), 0, map.width - 1),
      y: Phaser.Math.Clamp(Math.floor(worldY / TILE_SIZE), 0, map.height - 1),
    };
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (this.menu) {
      const index = this.menuIndexAt(pointer.worldX, pointer.worldY);
      if (index !== null) this.highlightMenuItem(index);
      return;
    }
    this.setCursor(this.tileAt(pointer.worldX, pointer.worldY), false);
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown()) {
      const tile = this.tileAt(pointer.worldX, pointer.worldY);
      if (!this.menu) this.setCursor(tile, false);
      this.handlers?.onPeekStart(tile);
      return;
    }
    if (this.menu) {
      const index = this.menuIndexAt(pointer.worldX, pointer.worldY);
      const item = index === null ? undefined : this.menu.items[index];
      if (item) this.handlers?.onMenuChoice(item.id);
      else this.handlers?.onCancel();
      return;
    }
    const tile = this.tileAt(pointer.worldX, pointer.worldY);
    this.setCursor(tile, false);
    this.handlers?.onConfirm(tile);
  }

  private onKey(event: KeyboardEvent): void {
    // While an HTML menu has focus, the keyboard belongs to it. Cmd/Ctrl+Z is Undo, not Z.
    if (document.activeElement instanceof HTMLButtonElement || event.metaKey || event.ctrlKey) return;
    if (this.pressKey(event.key, event.repeat)) event.preventDefault();
  }

  /** A key press from the keyboard or the on-screen pad. Returns whether the map used it. */
  pressKey(key: string, repeat: boolean): boolean {
    const arrows: Record<string, Point> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    const step = arrows[key];
    if (step) {
      if (this.menu) {
        if (step.y !== 0) this.highlightMenuItem((this.menu.selected + step.y + this.menu.items.length) % this.menu.items.length);
      } else if (this.handlers) {
        this.setCursor(this.handlers.nextCursor(this.cursorTile, step));
      }
      return true;
    }
    if (["z", "Z", "Enter", " "].includes(key)) {
      if (repeat) return true; // holding Z must not open a menu and then pick from it
      const item = this.menu?.items[this.menu.selected];
      if (item) this.handlers?.onMenuChoice(item.id);
      else this.handlers?.onConfirm(this.cursorTile);
      return true;
    }
    if (key === "x" || key === "X") {
      if (!repeat) this.handlers?.onPeekStart(this.cursorTile);
      return true;
    }
    if (key === "Escape" || key === "Backspace") {
      this.handlers?.onCancel();
      return true;
    }
    return false;
  }

  /** A key let go: letting go of X ends a peek at a unit's range. */
  releaseKey(key: string): void {
    if (key === "x" || key === "X") this.handlers?.onPeekEnd();
  }

  /** Moves the cursor. Unless it followed the mouse, the view pans to keep it on screen. */
  setCursor(tile: Point, follow = true): void {
    const { map } = this.state;
    const x = Phaser.Math.Clamp(tile.x, 0, map.width - 1);
    const y = Phaser.Math.Clamp(tile.y, 0, map.height - 1);
    if (follow) void this.revealTiles([{ x, y }], PAN_MS.cursor);
    if (x === this.cursorTile.x && y === this.cursorTile.y) return;
    this.cursorTile = { x, y };
    this.drawCursor();
    this.options.onCursorMove(this.cursorTile);
    this.handlers?.onCursorMove(this.cursorTile);
  }

  private drawCursor(): void {
    if (!this.cursor) return;
    const { x, y } = this.cursorTile;
    this.cursor.clear();
    this.cursor.lineStyle(1, packColorNumber("cursor"), 1);
    this.cursor.strokeRect(x * TILE_SIZE + 0.5, y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  }

  // ---- MapView: ranges, path arrow, preview, menu ----

  showRanges(layers: readonly RangeLayer[]): void {
    const g = this.rangeLayer;
    if (!g) return;
    g.clear();
    for (const { tiles, kind } of layers) {
      g.fillStyle(packColorNumber(RANGE_COLORS[kind]), 0.5);
      for (const t of tiles) g.fillRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      // Thin grid lines inside the range keep individual tiles readable.
      g.lineStyle(1, packColorNumber("rangeGrid"), 0.35);
      for (const t of tiles) g.strokeRect(t.x * TILE_SIZE + 0.5, t.y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
    }
  }

  clearRange(): void {
    this.rangeLayer?.clear();
  }

  showPath(start: Point, path: readonly Point[]): void {
    const g = this.pathLayer;
    if (!g) return;
    g.clear();
    if (path.length === 0) return;
    const points = [start, ...path].map(center);
    // Outline pass, then fill pass, so the arrow reads on any terrain.
    for (const [color, thickness, headGrow] of [[packColorNumber("pathOutline"), 6, 1.5], [packColorNumber("pathFill"), 4, 0]] as const) {
      g.fillStyle(color, 1);
      for (let i = 1; i < points.length; i++) {
        const a = points[i - 1];
        const b = points[i];
        if (!a || !b) continue;
        const half = thickness / 2;
        g.fillRect(Math.min(a.x, b.x) - half, Math.min(a.y, b.y) - half, Math.abs(a.x - b.x) + thickness, Math.abs(a.y - b.y) + thickness);
      }
      const last = points[points.length - 1];
      const prev = points[points.length - 2];
      if (!last || !prev) continue;
      const dx = Math.sign(last.x - prev.x);
      const dy = Math.sign(last.y - prev.y);
      const tip = 6 + headGrow;
      const wing = 5 + headGrow;
      g.fillTriangle(
        last.x + dx * tip, last.y + dy * tip,
        last.x - dx * 1 - dy * wing, last.y - dy * 1 - dx * wing,
        last.x - dx * 1 + dy * wing, last.y - dy * 1 + dx * wing,
      );
    }
  }

  clearPath(): void {
    this.pathLayer?.clear();
  }

  async previewMove(unitId: UnitId, fullPath: readonly Point[]): Promise<void> {
    this.previewed = unitId;
    await this.walk(unitId, fullPath);
  }

  showPreviewState(state: GameState | null): void {
    if (state === null && this.preview === undefined) return;
    this.previewed = undefined;
    this.preview = state ?? undefined;
    this.renderState();
  }

  resetPreview(): void {
    if (this.previewed === undefined) return;
    const unit = (this.preview ?? this.state).units.find((u) => u.id === this.previewed);
    const sprite = this.unitSprites.get(this.previewed);
    if (unit && sprite) sprite.setPosition(unit.pos.x * TILE_SIZE, unit.pos.y * TILE_SIZE);
    // Back inside its bunker, a garrisoned soldier is hidden again.
    if (this.garrisoned.has(this.previewed)) this.unitImages.get(this.previewed)?.setVisible(false);
    this.previewed = undefined;
  }

  openMenu(at: Point, items: readonly MenuItem[], selected = 0): void {
    this.closeMenu();
    const width = Math.max(...items.map((i) => textWidth(i.label))) + MENU.pad * 2 + 5;
    const height = items.length * MENU.itemHeight + MENU.pad * 2 - 2;
    const view = this.visibleRect();
    let x = (at.x + 1) * TILE_SIZE + 2;
    if (x + width > view.right) x = at.x * TILE_SIZE - width - 2;
    const y = Phaser.Math.Clamp(at.y * TILE_SIZE, view.top, view.bottom - height);

    const container = this.add.container(x, y);
    this.menu = { container, items, rect: new Phaser.Geom.Rectangle(x, y, width, height), selected };
    this.drawMenu();
  }

  closeMenu(): void {
    this.menu?.container.destroy();
    this.menu = undefined;
  }

  showForecast(at: Point, lines: readonly string[]): void {
    this.clearForecast();
    const lineHeight = GLYPH_HEIGHT + 2;
    const width = Math.max(...lines.map(textWidth)) + 6;
    const height = lines.length * lineHeight + 4;
    const view = this.visibleRect();
    const x = Phaser.Math.Clamp(at.x * TILE_SIZE + (TILE_SIZE - width) / 2, view.left, view.right - width);
    const above = at.y * TILE_SIZE - height - 2;
    const y = above >= view.top ? above : (at.y + 1) * TILE_SIZE + 2;

    const panel = this.add.container(Math.round(x), y);
    const g = this.add.graphics();
    g.fillStyle(packColorNumber("menuBorder"), 1);
    g.fillRect(0, 0, width, height);
    g.fillStyle(packColorNumber("menuBg"), 1);
    g.fillRect(1, 1, width - 2, height - 2);
    panel.add(g);
    lines.forEach((line, i) => {
      panel.add(this.add.image(3, 3 + i * lineHeight, this.textTexture(line, packColor("menuInk"))).setOrigin(0));
    });
    this.forecastPanel = panel;
  }

  clearForecast(): void {
    this.forecastPanel?.destroy();
    this.forecastPanel = undefined;
  }

  private menuIndexAt(worldX: number, worldY: number): number | null {
    const menu = this.menu;
    if (!menu || !menu.rect.contains(worldX, worldY)) return null;
    const index = Math.floor((worldY - menu.rect.y - MENU.pad + 1) / MENU.itemHeight);
    return index >= 0 && index < menu.items.length ? index : null;
  }

  private highlightMenuItem(index: number): void {
    if (!this.menu || this.menu.selected === index) return;
    this.menu.selected = index;
    this.drawMenu();
  }

  private drawMenu(): void {
    const menu = this.menu;
    if (!menu) return;
    const { container, items, rect, selected } = menu;
    container.removeAll(true);
    const g = this.add.graphics();
    g.fillStyle(packColorNumber("menuBorder"), 1);
    g.fillRect(0, 0, rect.width, rect.height);
    g.fillStyle(packColorNumber("menuBg"), 1);
    g.fillRect(1, 1, rect.width - 2, rect.height - 2);
    g.fillStyle(packColorNumber("menuHighlight"), 1);
    g.fillRect(1, MENU.pad - 1 + selected * MENU.itemHeight, rect.width - 2, MENU.itemHeight);
    // A small pointer next to the highlighted item.
    g.fillStyle(packColorNumber("menuBorder"), 1);
    const py = MENU.pad + 1 + selected * MENU.itemHeight;
    g.fillTriangle(2, py, 2, py + 4, 4, py + 2);
    container.add(g);
    items.forEach((item, i) => {
      container.add(this.add.image(MENU.pad + 4, MENU.pad + 1 + i * MENU.itemHeight, this.textTexture(item.label, packColor("menuInk"))).setOrigin(0));
    });
  }

  /** A texture of pixel text, optionally with a 1px outline so it reads on any terrain. */
  private textTexture(text: string, color: string, outline?: string): string {
    return this.texture(`text-${color}-${outline ?? ""}-${text}`, () => {
      const pad = outline ? 1 : 0;
      const c = document.createElement("canvas");
      c.width = textWidth(text) + pad * 2;
      c.height = GLYPH_HEIGHT + pad * 2;
      const ctx = c.getContext("2d");
      if (!ctx) throw new Error("2D canvas not available");
      if (outline) {
        ctx.fillStyle = outline;
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1]] as const) drawPixelText(ctx, text, pad + dx, pad + dy);
      }
      ctx.fillStyle = color;
      drawPixelText(ctx, text, pad, pad);
      return c;
    });
  }

  // ---- Event playback ----

  /** Animates engine events. Call before setState(newState); resolves when the animations finish. */
  async playEvents(events: readonly GameEvent[]): Promise<void> {
    setBattleWeather({ season: this.state.weather.season, snowing: weatherOn(this.state) === "snow" });
    for (const event of events) {
      await this.revealTiles(this.eventTiles(event), PAN_MS.action);
      if (event.type === "unitLaunched" && !this.unitSprites.has(event.unitId)) {
        // Takes off from the Carrier's tile, unless the launch preview already put it there.
        const aircraft = this.state.units.find((u) => u.id === event.carrierId)?.cargo.find((c) => c.id === event.unitId);
        if (aircraft) this.addUnitSprite({ ...aircraft, pos: event.pos, hasActed: false });
      }
      if (event.type === "unitMoved") {
        await this.walk(event.unitId, event.path);
        await this.playGarrison(event.unitId, event.path[0] ?? null, event.path[event.path.length - 1], events);
      }
      if (event.type === "unitUnloaded") {
        // A Transport Aircraft's passengers jump (08-art-pipeline §20); others may go into a bunker.
        const drop = this.battle && planDrop(this.state, event);
        if (this.battle && drop) await this.battle.playDrop(drop);
        else await this.playGarrison(event.unitId, null, event.pos, events);
      }
      if (event.type === "combat") await this.playCombat(event);
      if (event.type === "fortAttacked") {
        const plan = this.battle && planFortAttack(this.state, event);
        if (this.battle && plan) await this.battle.play(plan);
        else {
          const shooter = { unitId: event.attackerId, pos: event.attackerPos };
          await this.playStrike(shooter, { pos: event.pos }, event.attack.damage, event.hp === 0);
        }
      }
      if (event.type === "captureProgress" || event.type === "propertyCaptured") {
        // A capture plays as a storming scene when scenes are on (08-art-pipeline §19), else as a label.
        const plan = this.battle && planCapture(this.state, event);
        if (this.battle && plan) await this.battle.playStorm(plan);
        else if (event.type === "captureProgress") await this.floatLabel(event.pos, `${event.capturePoints} LEFT`, packColor("labelText"));
        else await this.floatLabel(event.pos, "CAPTURED", packColor("labelGold"));
      }
      if (event.type === "unitOutOfFuel") {
        const lost = { pos: event.pos, unitId: event.unitId };
        await Promise.all([this.explode(lost), this.floatLabel(event.pos, "OUT OF FUEL", packColor("labelWarning"))]);
      }
      if (event.type === "unitJoined") {
        const target = this.state.units.find((u) => u.id === event.targetId);
        if (target) await this.floatLabel(target.pos, "JOINED", packColor("labelText"));
      }
      if (event.type === "unitDived" || event.type === "unitSurfaced") {
        // The sprite has already walked to where the submarine dived or surfaced.
        const sprite = this.unitSprites.get(event.unitId);
        const tile = sprite && { x: Math.round(sprite.x / TILE_SIZE), y: Math.round(sprite.y / TILE_SIZE) };
        if (tile) await this.floatLabel(tile, event.type === "unitDived" ? "DIVE" : "SURFACE", packColor("submerged"));
      }
    }
    await Promise.all(this.repairLabels(events));
  }

  /** Foot soldiers going into a bunker play a storming scene, when scenes are on (08-art-pipeline §19). */
  private async playGarrison(unitId: UnitId, from: Point | null, to: Point | undefined, events: readonly GameEvent[]): Promise<void> {
    if (!this.battle || !to) return;
    const plan = planGarrison(this.state, unitId, from, to, events);
    if (plan) await this.battle.playStorm(plan);
  }

  /** Where an event happens, so the view can pan to it first. Repairs at turn start don't pan. */
  private eventTiles(event: GameEvent): Point[] {
    switch (event.type) {
      case "unitMoved":
        return event.path.slice(0, 1);
      case "combat":
        return [event.attacker.pos, event.defender.pos];
      case "fortAttacked":
        return [event.attackerPos, event.pos];
      case "captureProgress":
      case "propertyCaptured":
      case "unitOutOfFuel":
      case "unitLaunched":
        return [event.pos];
      case "unitJoined": {
        const target = this.state.units.find((u) => u.id === event.targetId);
        return target ? [target.pos] : [];
      }
      default:
        return [];
    }
  }

  /** "+2" over repaired units and "SUPPLY" over units only resupplied, all at once. */
  private repairLabels(events: readonly GameEvent[]): Promise<void>[] {
    const repaired = new Set<UnitId>();
    const labels: Promise<void>[] = [];
    // Aircraft aboard a Carrier are serviced there, so their labels show over the Carrier.
    const over = (unitId: UnitId, text: string, color: string) => {
      const unit = this.state.units.find((u) => u.id === unitId || u.cargo.some((c) => c.id === unitId));
      if (unit) labels.push(this.floatLabel(unit.pos, text, color));
    };
    for (const event of events) {
      if (event.type !== "unitRepaired") continue;
      repaired.add(event.unitId);
      over(event.unitId, `+${event.hp}`, packColor("labelGreen"));
    }
    for (const event of events) {
      if (event.type === "unitResupplied" && !repaired.has(event.unitId)) over(event.unitId, "SUPPLY", packColor("labelBlue"));
    }
    return labels;
  }

  /**
   * The attack, then the counter if there was one, then any promotions (00-master-design §13): as a
   * battle scene when they're on, otherwise on the map. After a battle scene, a destroyed unit
   * still blows up on the map so it's clear which one is gone.
   */
  private async playCombat(event: Extract<GameEvent, { type: "combat" }>): Promise<void> {
    const { attacker, defender, attack, counter } = event;
    if (this.battle) {
      await this.battle.play(planCombat(this.state, event));
      const lost = [attacker, defender].filter((u) => u.destroyed).map((u) => this.explode({ pos: u.pos, unitId: u.unitId }));
      await Promise.all(lost);
    } else {
      await this.playStrike(attacker, defender, attack.damage, counter === null && defender.destroyed);
      if (counter) await this.playStrike(defender, attacker, counter.damage, attacker.destroyed);
    }
    for (const unit of [attacker, defender]) {
      if (unit.promotedTo) await this.floatLabel(unit.pos, unit.promotedTo.toUpperCase(), packColor("labelGold"));
    }
  }

  /** The shooter nudges toward its target, which flashes and shows the damage. */
  private async playStrike(
    shooter: Pick<Combatant, "unitId" | "pos">,
    target: StrikeTarget,
    damage: number,
    destroyed: boolean,
  ): Promise<void> {
    const sprite = this.unitSprites.get(shooter.unitId);
    if (sprite) {
      const { x, y } = sprite;
      const dx = Math.sign(target.pos.x - shooter.pos.x) * 3;
      const dy = Math.sign(target.pos.y - shooter.pos.y) * 3;
      await this.tween(sprite, { x: x + dx, y: y + dy }, COMBAT_MS.nudge);
      await this.tween(sprite, { x, y }, COMBAT_MS.nudge);
    }
    const flash = this.add.rectangle(target.pos.x * TILE_SIZE, target.pos.y * TILE_SIZE, TILE_SIZE, TILE_SIZE, packColorNumber("flash")).setOrigin(0);
    await this.tween(flash, { alpha: 0 }, COMBAT_MS.flash);
    flash.destroy();
    await Promise.all([
      this.floatLabel(target.pos, `-${damage}`, packColor("labelText")),
      destroyed ? this.explode(target) : Promise.resolve(),
    ]);
  }

  private async explode(target: StrikeTarget): Promise<void> {
    const { x, y } = center(target.pos);
    const blast = this.add.rectangle(x, y, 8, 8, packColorNumber("blast"));
    const sprite = target.unitId === undefined ? undefined : this.unitSprites.get(target.unitId);
    await Promise.all([
      this.tween(blast, { scaleX: 2.5, scaleY: 2.5, alpha: 0 }, COMBAT_MS.explode),
      sprite ? this.tween(sprite, { alpha: 0 }, COMBAT_MS.explode) : Promise.resolve(),
    ]);
    blast.destroy();
  }

  /** Text that rises from a tile and fades out. */
  private async floatLabel(tile: Point, text: string, color: string): Promise<void> {
    const { x, y } = center(tile);
    const label = this.add.image(x, y, this.textTexture(text, color, packColor("labelOutline")));
    await this.tween(label, { y: y - 9, alpha: 0 }, COMBAT_MS.float);
    label.destroy();
  }

  private tween(target: object, props: Record<string, number>, duration: number): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ targets: target, ...props, duration, onComplete: () => resolve() });
    });
  }

  /** Tweens a unit marker tile by tile along a path. Skips if it's already at the end (previewed). */
  private async walk(unitId: UnitId, fullPath: readonly Point[]): Promise<void> {
    const sprite = this.unitSprites.get(unitId);
    const end = fullPath[fullPath.length - 1];
    if (!sprite || !end) return;
    if (sprite.x === end.x * TILE_SIZE && sprite.y === end.y * TILE_SIZE) return;
    // A soldier leaving a garrisoned bunker comes out into view.
    this.unitImages.get(unitId)?.setVisible(true);
    for (const p of fullPath.slice(1)) {
      // The view keeps pace with the unit, so a long move never walks off screen.
      await Promise.all([
        this.revealTiles([p], MOVE_MS_PER_TILE),
        new Promise<void>((resolve) => {
          this.tweens.add({
            targets: sprite,
            x: p.x * TILE_SIZE,
            y: p.y * TILE_SIZE,
            duration: MOVE_MS_PER_TILE,
            onComplete: () => resolve(),
          });
        }),
      ]);
    }
  }

  // ---- Rendering game state ----

  /** Draws the game state, or the preview state while one is shown. */
  private renderState(): void {
    const real = this.state;
    this.state = this.preview ?? real;
    try {
      this.drawState();
    } finally {
      this.state = real;
    }
  }

  private drawState(): void {
    const layer = this.stateLayer;
    if (!layer) return;
    layer.removeAll(true);
    this.unitSprites.clear();
    this.unitImages.clear();
    this.redrawChangedTerrain();
    const garrisons = this.garrisonArt();
    this.garrisoned = new Set(this.state.units.filter((u) => garrisons.has(u.pos.y * this.state.map.width + u.pos.x)).map((u) => u.id));

    // Buildings are painted with the terrain in their owner's colors. Any property without building
    // art shows its owner with a small team-colored flag in the tile's top-left corner.
    const hasSheet = this.textures.exists(PROPERTY_SHEET_KEY);
    const flags = this.add.graphics();
    for (const prop of this.state.properties) {
      if (prop.owner === null) continue;
      if (hasSheet && findPropertyArt(activePack(), terrainAt(this.state.map, prop.pos), prop.owner) !== null) continue;
      const [fill, outline] = playerColors(prop.owner);
      const x = prop.pos.x * TILE_SIZE;
      const y = prop.pos.y * TILE_SIZE;
      flags.fillStyle(Phaser.Display.Color.HexStringToColor(outline).color, 1);
      flags.fillRect(x + 1, y + 1, 1, 7);
      flags.fillRect(x + 2, y + 1, 5, 4);
      flags.fillStyle(Phaser.Display.Color.HexStringToColor(fill).color, 1);
      flags.fillRect(x + 2, y + 2, 4, 2);
    }
    layer.add(flags);

    // Properties a scenario objective names get gold corner marks (04-economy §8): corners rather
    // than a full box, so they never read as the cursor or a selection.
    const objectives = this.add.graphics().fillStyle(packColorNumber("objective"), 1);
    const arm = 4;
    for (const { x, y } of objectiveTiles(this.state)) {
      const left = x * TILE_SIZE;
      const top = y * TILE_SIZE;
      const right = left + TILE_SIZE;
      const bottom = top + TILE_SIZE;
      for (const [cx, dx] of [[left, 1], [right, -1]] as const) {
        for (const [cy, dy] of [[top, 1], [bottom, -1]] as const) {
          objectives.fillRect(dx > 0 ? cx : cx - arm, dy > 0 ? cy : cy - 1, arm, 1);
          objectives.fillRect(dx > 0 ? cx : cx - 1, dy > 0 ? cy : cy - arm, 1, arm);
        }
      }
    }
    layer.add(objectives);

    // Damaged fortifications show their HP like units do, in the tile's bottom-left corner.
    for (const fort of this.state.fortifications) {
      const hp = displayHp(fort.hp);
      if (hp >= 10) continue;
      const badge = this.texture(`hp-${hp}`, () => drawHpBadge(hp));
      layer.add(this.add.image(fort.pos.x * TILE_SIZE, (fort.pos.y + 1) * TILE_SIZE, badge).setOrigin(0, 1));
    }

    for (const unit of this.state.units) this.addUnitSprite(unit);
  }

  /** A unit's sprite with its badges, added to the state layer. */
  private addUnitSprite(unit: Unit): void {
    const layer = this.stateLayer;
    if (!layer) return;
    const sprite = this.add.container(unit.pos.x * TILE_SIZE, unit.pos.y * TILE_SIZE);
    // A soldier in a garrisoned bunker is drawn as the bunker itself; only its badges show.
    const inside = this.garrisoned.has(unit.id);
    const shadow = inside ? null : this.unitShadow(unit);
    if (shadow) sprite.add(shadow);
    const image = this.unitImage(unit).setVisible(!inside);
    sprite.add(image);
    this.unitImages.set(unit.id, image);

    const hp = displayHp(unit.hp);
    if (hp < 10) sprite.add(this.add.image(TILE_SIZE, TILE_SIZE, this.texture(`hp-${hp}`, () => drawHpBadge(hp))).setOrigin(1));
    if (this.state.properties.some((p) => p.capturingUnit === unit.id)) {
      sprite.add(this.add.image(0, TILE_SIZE, this.textTexture("C", packColor("labelText"), packColor("labelOutline"))).setOrigin(0, 1));
    }
    // Aircraft and ships within two turns of running dry show a warning.
    const burn = stats.fuelPerDay(this.state, unit);
    if (burn > 0 && unit.fuel <= burn * 2) {
      sprite.add(this.add.image(0, TILE_SIZE, this.textTexture("F", packColor("labelWarning"), packColor("labelOutline"))).setOrigin(0, 1));
    }
    // A transport carrying units shows a small marker.
    if (unit.cargo.length > 0) sprite.add(this.add.image(0, 0, this.textTexture("+", packColor("labelText"), packColor("labelOutline"))).setOrigin(0));
    // So does a submerged submarine, in the same corner, which a submarine never otherwise uses.
    if (unit.submerged === true) sprite.add(this.add.image(0, 0, this.texture("submerged", drawSubmergedBadge)).setOrigin(0));
    const { level } = veterancyFor(unit.kills);
    if (level !== "rookie") {
      sprite.add(this.add.image(TILE_SIZE, 0, this.texture(`vet-${level}`, () => drawVeterancyBadge(level))).setOrigin(1, 0));
    }
    layer.add(sprite);
    this.unitSprites.set(unit.id, sprite);
  }

  /**
   * The unit's sprite from the art pack, animated until it has acted, or its placeholder marker.
   * Sprites are mirrored for a player the map faces left. Markers aren't: their letters would read backwards.
   * A submerged submarine is tinted, as if seen through the water.
   */
  private unitImage(unit: Unit): Phaser.GameObjects.Image | Phaser.GameObjects.Sprite {
    const image = this.untintedUnitImage(unit);
    return unit.submerged === true ? image.setTint(packColorNumber("submerged")) : image;
  }

  private untintedUnitImage(unit: Unit): Phaser.GameObjects.Image | Phaser.GameObjects.Sprite {
    const player = this.state.players[unit.owner];
    const art = player ? findUnitArt(activePack(), player.nation, unit.owner, unit.type, unit) : null;
    if (!art || !this.textures.exists(unitSheetKey(art.sheet))) {
      const marker = this.add.image(0, 0, this.texture(`unit-${unit.type}-${unit.owner}`, () => drawUnitMarker(unit.type, unit.owner)));
      return marker.setOrigin(0).setAlpha(unit.hasActed ? 0.5 : 1);
    }
    const key = unitSheetKey(art.sheet);
    const sprite = this.add.sprite(0, 0, key, art.row * art.frames)
      .setOrigin(0)
      .setScale(TILE_SIZE / art.frameSize)
      .setFlipX(player?.facing === "left");
    if (unit.hasActed) return sprite.setAlpha(0.5);
    return sprite.play(this.idleAnimation(key, art));
  }

  /**
   * A dark copy of the unit's sprite, offset to the lower right. Drawn in the game rather than in the
   * sheet so it still falls to the right when the sprite is mirrored. Placeholder markers and
   * submerged submarines have none.
   */
  private unitShadow(unit: Unit): Phaser.GameObjects.Sprite | null {
    if (unit.submerged === true) return null;
    const player = this.state.players[unit.owner];
    const art = player ? findUnitArt(activePack(), player.nation, unit.owner, unit.type, unit) : null;
    if (!art || !this.textures.exists(unitSheetKey(art.sheet))) return null;
    const key = unitSheetKey(art.sheet);
    const shadow = this.add.sprite(UNIT_SHADOW_OFFSET.x, UNIT_SHADOW_OFFSET.y, key, art.row * art.frames)
      .setOrigin(0)
      .setScale(TILE_SIZE / art.frameSize)
      .setFlipX(player?.facing === "left")
      .setTint(packColorNumber("unitShadow"))
      .setTintMode(Phaser.TintModes.FILL)
      .setAlpha(unit.hasActed ? UNIT_SHADOW_ALPHA / 2 : UNIT_SHADOW_ALPHA);
    return unit.hasActed ? shadow : shadow.play(this.idleAnimation(key, art));
  }

  private idleAnimation(key: string, art: { row: number; frames: number }): string {
    const animation = `${key}-row-${art.row}`;
    if (!this.anims.exists(animation)) {
      const first = art.row * art.frames;
      const frames = this.anims.generateFrameNumbers(key, { start: first, end: first + art.frames - 1 });
      this.anims.create({ key: animation, frames, frameRate: IDLE_FRAMES_PER_SECOND, repeat: -1 });
    }
    return animation;
  }

  /**
   * Bunkers with soldiers inside that the art pack can draw garrisoned (08-art-pipeline §15), by tile.
   * Without that art the bunker stays plain and the soldier is drawn on top as usual.
   */
  private garrisonArt(): Map<number, PlayerId> {
    const pack = activePack();
    if (!pack.properties || !this.textures.exists(PROPERTY_SHEET_KEY)) return new Map();
    return new Map([...garrisonedBunkers(this.state)].filter(([, owner]) => findPropertyArt(pack, "bunker", owner) !== null));
  }

  /** Terrain can change in play: a destroyed bunker becomes rubble (02-terrain §4). */
  private redrawChangedTerrain(): void {
    // A change can alter its neighbors' joins too, so repaint the lot: it's one pass over the map.
    const { terrain } = this.state.map;
    if (terrain.some((id, i) => id !== this.drawnTerrain[i]) || ownerKey(this.state) !== this.drawnOwners) this.paintTerrain();
  }

  /** Returns a texture key, generating the texture the first time it's needed. */
  private texture(key: string, draw: () => HTMLCanvasElement): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, draw());
    return key;
  }
}
