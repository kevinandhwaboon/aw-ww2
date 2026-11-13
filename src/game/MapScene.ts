import Phaser from "phaser";
import type { GameEvent } from "../engine/commands";
import { veterancyFor } from "../engine/data/veterancy";
import { terrainAt, type Point } from "../engine/map";
import { displayHp, unitAt, type GameState, type PlayerId, type Unit, type UnitId } from "../engine/state";
import { weatherOn } from "../engine/weather";
import type { BattlePlayer } from "./battle/BattleScene";
import { activePack, findPropertyArt, findUnitArt, packColor, packColorNumber, unitName, type ColorKey } from "./artPack";
import type { MapView, MenuItem, RangeKind, RangeLayer } from "./controller";
import { garrisonedBunkers } from "./garrison";
import { center, MapPlayback } from "./mapPlayback";
import { objectiveTiles } from "./objectives";
import { packFileUrl } from "./loadArtPack";
import { drawPixelText, GLYPH_HEIGHT, textWidth } from "./pixelFont";
import { drawPlaceholderTileset, tileIndex, TILE_SIZE } from "./placeholderTiles";
import { terrainLayers } from "./terrainTiles";
import { clampScroll, FOLLOW_MARGIN_SQUARES, inLeftHalf, revealScroll, type Scroll, type Size } from "./viewport";
import { drawAmmoCanBadge, drawFuelCanBadge, drawHpBadge, drawSubmergedBadge, drawUnitMarker, drawVeterancyBadge, playerColors } from "./placeholderUnits";
import { supplyWarnings } from "./tileInfo";

/** How long one blink of the low-supply cans takes, on and off. */
const WARNING_BLINK_MS = 900;

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

const RANGE_COLORS: Record<RangeKind, ColorKey> = { move: "rangeMove", inspect: "rangeInspect", attack: "rangeAttack" };
const MENU = { pad: 3, itemHeight: GLYPH_HEIGHT + 4 };
const IDLE_FRAMES_PER_SECOND = 3;
/** How long the view takes to pan to the cursor. */
const CURSOR_PAN_MS = 90;
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
  private readonly playback = new MapPlayback({
    scene: this,
    state: () => this.state,
    battle: () => this.battle,
    unitSprites: this.unitSprites,
    unitImages: this.unitImages,
    addUnitSprite: (unit) => this.addUnitSprite(unit),
    revealTiles: (tiles, ms) => this.revealTiles(tiles, ms),
    textTexture: (text, color, outline) => this.textTexture(text, color, outline),
  });

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
    // They're removed when the game is destroyed, so an ended game doesn't hear the next one's keys.
    const keys = new AbortController();
    window.addEventListener("keydown", (event) => this.onKey(event), { signal: keys.signal });
    window.addEventListener("keyup", (event) => this.releaseKey(event.key), { signal: keys.signal });
    this.events.once(Phaser.Scenes.Events.DESTROY, () => keys.abort());
  }

  private snowLayer?: Phaser.GameObjects.Graphics;
  /** The panel listing a transport's passengers while the cursor is on it. */
  private cargoPeek: Phaser.GameObjects.Container | undefined;
  /** The cans in that panel, which blink with the map's. */
  private peekBadges: Phaser.GameObjects.Image[] = [];
  /** The flashing gas and ammo cans on the map, redrawn with the state. */
  private warningBadges: Phaser.GameObjects.Image[] = [];

  /**
   * Snow falling over the visible part of the map while it snows (12-weather §5). Each flake's place
   * is a function of the time, so nothing is stored between frames.
   */
  override update(time: number): void {
    // Low-supply cans blink together: on for most of the beat, off briefly, so they catch the eye.
    const on = time % WARNING_BLINK_MS < WARNING_BLINK_MS * 0.65;
    for (const badge of this.warningBadges) badge.setVisible(on);
    for (const badge of this.peekBadges) badge.setVisible(on);
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
    if (follow) void this.revealTiles([{ x, y }], CURSOR_PAN_MS);
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
    await this.playback.walk(unitId, fullPath);
  }

  /** The game as drawn: the preview while one is shown (an aircraft out on its Carrier), else the real one. */
  shownState(): GameState {
    return this.preview ?? this.state;
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
    const g = this.panelBox(width, height);
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

  /**
   * With the cursor on a transport that has units aboard (a Landing Craft, Carrier, Halftrack or
   * Transport Aircraft), a small panel beside it shows each passenger's sprite, name and HP, with
   * the flashing cans if it's short of fuel or ammo (05-supply-transport §4, §11). null hides it.
   */
  showCargoPeek(tile: Point | null): void {
    this.cargoPeek?.destroy();
    this.cargoPeek = undefined;
    this.peekBadges = [];
    if (!tile) return;
    const state = this.preview ?? this.state;
    const host = unitAt(state, tile);
    if (!host || host.cargo.length === 0) return;
    const rowHeight = TILE_SIZE + 2;
    const labels = host.cargo.map((p) => ({ name: unitName(p.type).toUpperCase(), hp: `HP ${displayHp(p.hp)}` }));
    const textColumn = Math.max(...labels.map((l) => Math.max(textWidth(l.name), textWidth(l.hp))));
    const width = TILE_SIZE + textColumn + 9;
    const height = host.cargo.length * rowHeight + 4;
    const view = this.visibleRect();
    let x = (tile.x + 1) * TILE_SIZE + 2;
    if (x + width > view.right) x = tile.x * TILE_SIZE - width - 2;
    const y = Phaser.Math.Clamp(tile.y * TILE_SIZE - 2, view.top, view.bottom - height);

    const panel = this.add.container(Math.round(x), Math.round(y));
    const g = this.panelBox(width, height);
    panel.add(g);
    host.cargo.forEach((passenger, i) => {
      const top = 2 + i * rowHeight;
      const row = this.add.container(2, top);
      row.add(this.untintedUnitImage({ ...passenger, hasActed: false }));
      const low = supplyWarnings(state, passenger);
      let bottom = TILE_SIZE;
      for (const [warn, key, draw] of [[low.fuel, "fuel-can", drawFuelCanBadge], [low.ammo, "ammo-can", drawAmmoCanBadge]] as const) {
        if (!warn) continue;
        const can = this.add.image(0, bottom, this.texture(key, draw)).setOrigin(0, 1);
        row.add(can);
        this.peekBadges.push(can);
        bottom -= can.height;
      }
      panel.add(row);
      const label = labels[i];
      if (!label) return;
      panel.add(this.add.image(TILE_SIZE + 5, top + 2, this.textTexture(label.name, packColor("menuInk"))).setOrigin(0));
      panel.add(this.add.image(TILE_SIZE + 5, top + GLYPH_HEIGHT + 4, this.textTexture(label.hp, packColor("menuInk"))).setOrigin(0));
    });
    this.cargoPeek = panel;
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
    const g = this.panelBox(rect.width, rect.height);
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

  /** A menu-colored box with a 1-pixel border, for the action menu and the map's small panels. */
  private panelBox(width: number, height: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.fillStyle(packColorNumber("menuBorder"), 1);
    g.fillRect(0, 0, width, height);
    g.fillStyle(packColorNumber("menuBg"), 1);
    g.fillRect(1, 1, width - 2, height - 2);
    return g;
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

  // ---- Event playback (mapPlayback.ts) ----

  /** Animates engine events. Call before setState(newState); resolves when the animations finish. */
  playEvents(events: readonly GameEvent[]): Promise<void> {
    return this.playback.playEvents(events);
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
    this.warningBadges = [];
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
    // The left edge stacks up from the bottom: the capture C, then flashing gas and ammo cans for a
    // unit short of fuel or ammo (05-supply-transport §11).
    let bottom = TILE_SIZE;
    if (this.state.properties.some((p) => p.capturingUnit === unit.id)) {
      const c = this.add.image(0, bottom, this.textTexture("C", packColor("labelText"), packColor("labelOutline"))).setOrigin(0, 1);
      sprite.add(c);
      bottom -= c.height;
    }
    const low = supplyWarnings(this.state, unit);
    for (const [warn, key, draw] of [[low.fuel, "fuel-can", drawFuelCanBadge], [low.ammo, "ammo-can", drawAmmoCanBadge]] as const) {
      if (!warn) continue;
      const can = this.add.image(0, bottom, this.texture(key, draw)).setOrigin(0, 1);
      sprite.add(can);
      this.warningBadges.push(can);
      bottom -= can.height;
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
