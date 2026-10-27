import Phaser from "phaser";
import type { GameEvent } from "../engine/commands";
import { veterancyFor } from "../engine/data/veterancy";
import type { Point } from "../engine/map";
import { displayHp, type GameState, type UnitId } from "../engine/state";
import type { MapView, MenuItem, RangeKind } from "./controller";
import { drawPixelText, GLYPH_HEIGHT, textWidth } from "./pixelFont";
import { drawPlaceholderTileset, tileIndex, TILE_SIZE } from "./placeholderTiles";
import { drawHpBadge, drawUnitMarker, drawVeterancyBadge, playerColors } from "./placeholderUnits";

/** What the scene reports to whoever handles input (the InputController, wired up in main.ts). */
export interface MapInputHandlers {
  onCursorMove(tile: Point): void;
  onConfirm(tile: Point): void;
  onCancel(): void;
  onMenuChoice(id: string): void;
}

export interface MapSceneOptions {
  readonly state: GameState;
  /** Called when the cursor moves to a new tile (for the info panels). */
  readonly onCursorMove: (tile: Point) => void;
}

const MOVE_MS_PER_TILE = 70;
const RANGE_COLORS: Record<RangeKind, number> = { move: 0x7ec8ff, inspect: 0xff7060 };
const MENU = { pad: 3, itemHeight: GLYPH_HEIGHT + 4, ink: "#2a2418", bg: 0xf4ecd8, border: 0x4a3c28, highlight: 0xe8c070 };

const center = (p: Point) => ({ x: p.x * TILE_SIZE + TILE_SIZE / 2, y: p.y * TILE_SIZE + TILE_SIZE / 2 });

/**
 * Draws the map, units, move ranges, the path arrow and the action menu, and plays engine events
 * as animations. Presentation only: it reports input and never decides outcomes.
 */
export class MapScene extends Phaser.Scene implements MapView {
  private state: GameState;
  private handlers?: MapInputHandlers;
  private cursorTile: Point = { x: 0, y: 0 };

  private cursor?: Phaser.GameObjects.Graphics;
  private rangeLayer?: Phaser.GameObjects.Graphics;
  private stateLayer?: Phaser.GameObjects.Container;
  private pathLayer?: Phaser.GameObjects.Graphics;
  private unitSprites = new Map<UnitId, Phaser.GameObjects.Container>();
  private previewed: UnitId | undefined;
  private menu:
    | { container: Phaser.GameObjects.Container; items: readonly MenuItem[]; rect: Phaser.Geom.Rectangle; selected: number }
    | undefined;

  constructor(private readonly options: MapSceneOptions) {
    super("map");
    this.state = options.state;
  }

  setHandlers(handlers: MapInputHandlers): void {
    this.handlers = handlers;
  }

  create(): void {
    const { map } = this.state;
    this.textures.addCanvas("terrain", drawPlaceholderTileset());
    const data: number[][] = [];
    for (let y = 0; y < map.height; y++) {
      data.push(map.terrain.slice(y * map.width, (y + 1) * map.width).map(tileIndex));
    }
    const tilemap = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage("terrain");
    if (!tileset) throw new Error("Failed to create terrain tileset");
    tilemap.createLayer(0, tileset, 0, 0);

    // Draw order, bottom to top: terrain, range, flags + units, path arrow, cursor, menu.
    this.rangeLayer = this.add.graphics();
    this.stateLayer = this.add.container(0, 0);
    this.pathLayer = this.add.graphics();
    this.cursor = this.add.graphics();
    this.renderState();
    this.drawCursor();
    this.options.onCursorMove(this.cursorTile);

    this.input.mouse?.disableContextMenu();
    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => this.onPointerMove(pointer));
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => this.onPointerDown(pointer));
    this.input.keyboard?.on("keydown", (event: KeyboardEvent) => this.onKey(event));
  }

  /** Shows a new game state. Safe to call before the scene has been created. */
  setState(state: GameState): void {
    this.state = state;
    this.previewed = undefined;
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
    this.setCursor(this.tileAt(pointer.worldX, pointer.worldY));
  }

  private onPointerDown(pointer: Phaser.Input.Pointer): void {
    if (pointer.rightButtonDown()) {
      this.handlers?.onCancel();
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
    this.setCursor(tile);
    this.handlers?.onConfirm(tile);
  }

  private onKey(event: KeyboardEvent): void {
    const arrows: Record<string, Point> = {
      ArrowUp: { x: 0, y: -1 },
      ArrowDown: { x: 0, y: 1 },
      ArrowLeft: { x: -1, y: 0 },
      ArrowRight: { x: 1, y: 0 },
    };
    const step = arrows[event.key];
    if (step) {
      event.preventDefault();
      if (this.menu) {
        if (step.y !== 0) this.highlightMenuItem((this.menu.selected + step.y + this.menu.items.length) % this.menu.items.length);
      } else {
        this.setCursor({ x: this.cursorTile.x + step.x, y: this.cursorTile.y + step.y });
      }
      return;
    }
    if (["z", "Z", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      const item = this.menu?.items[this.menu.selected];
      if (item) this.handlers?.onMenuChoice(item.id);
      else this.handlers?.onConfirm(this.cursorTile);
      return;
    }
    if (["x", "X", "Escape", "Backspace"].includes(event.key)) {
      event.preventDefault();
      this.handlers?.onCancel();
    }
  }

  private setCursor(tile: Point): void {
    const { map } = this.state;
    const x = Phaser.Math.Clamp(tile.x, 0, map.width - 1);
    const y = Phaser.Math.Clamp(tile.y, 0, map.height - 1);
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
    this.cursor.lineStyle(1, 0xffffff, 1);
    this.cursor.strokeRect(x * TILE_SIZE + 0.5, y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  }

  // ---- MapView: ranges, path arrow, preview, menu ----

  showRange(tiles: readonly Point[], kind: RangeKind): void {
    const g = this.rangeLayer;
    if (!g) return;
    g.clear();
    g.fillStyle(RANGE_COLORS[kind], 0.5);
    for (const t of tiles) g.fillRect(t.x * TILE_SIZE, t.y * TILE_SIZE, TILE_SIZE, TILE_SIZE);
    // Thin grid lines inside the range keep individual tiles readable.
    g.lineStyle(1, 0xffffff, 0.35);
    for (const t of tiles) g.strokeRect(t.x * TILE_SIZE + 0.5, t.y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
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
    for (const [color, thickness, headGrow] of [[0x1a2438, 6, 1.5], [0xf8f0d0, 4, 0]] as const) {
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

  resetPreview(): void {
    if (this.previewed === undefined) return;
    const unit = this.state.units.find((u) => u.id === this.previewed);
    const sprite = this.unitSprites.get(this.previewed);
    if (unit && sprite) sprite.setPosition(unit.pos.x * TILE_SIZE, unit.pos.y * TILE_SIZE);
    this.previewed = undefined;
  }

  openMenu(at: Point, items: readonly MenuItem[]): void {
    this.closeMenu();
    const width = Math.max(...items.map((i) => textWidth(i.label))) + MENU.pad * 2 + 5;
    const height = items.length * MENU.itemHeight + MENU.pad * 2 - 2;
    const mapW = this.state.map.width * TILE_SIZE;
    const mapH = this.state.map.height * TILE_SIZE;
    let x = (at.x + 1) * TILE_SIZE + 2;
    if (x + width > mapW) x = at.x * TILE_SIZE - width - 2;
    const y = Phaser.Math.Clamp(at.y * TILE_SIZE, 0, mapH - height);

    const container = this.add.container(x, y);
    this.menu = { container, items, rect: new Phaser.Geom.Rectangle(x, y, width, height), selected: 0 };
    this.drawMenu();
  }

  closeMenu(): void {
    this.menu?.container.destroy();
    this.menu = undefined;
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
    g.fillStyle(MENU.border, 1);
    g.fillRect(0, 0, rect.width, rect.height);
    g.fillStyle(MENU.bg, 1);
    g.fillRect(1, 1, rect.width - 2, rect.height - 2);
    g.fillStyle(MENU.highlight, 1);
    g.fillRect(1, MENU.pad - 1 + selected * MENU.itemHeight, rect.width - 2, MENU.itemHeight);
    // A small pointer next to the highlighted item.
    g.fillStyle(MENU.border, 1);
    const py = MENU.pad + 1 + selected * MENU.itemHeight;
    g.fillTriangle(2, py, 2, py + 4, 4, py + 2);
    container.add(g);
    items.forEach((item, i) => {
      const key = this.texture(`menu-${item.label}`, () => {
        const c = document.createElement("canvas");
        c.width = textWidth(item.label);
        c.height = GLYPH_HEIGHT;
        const ctx = c.getContext("2d");
        if (!ctx) throw new Error("2D canvas not available");
        ctx.fillStyle = MENU.ink;
        drawPixelText(ctx, item.label, 0, 0);
        return c;
      });
      container.add(this.add.image(MENU.pad + 4, MENU.pad + 1 + i * MENU.itemHeight, key).setOrigin(0));
    });
  }

  // ---- Event playback ----

  /** Animates engine events. Call before setState(newState); resolves when the animations finish. */
  async playEvents(events: readonly GameEvent[]): Promise<void> {
    for (const event of events) {
      if (event.type === "unitMoved") await this.walk(event.unitId, event.path);
    }
  }

  /** Tweens a unit marker tile by tile along a path. Skips if it's already at the end (previewed). */
  private async walk(unitId: UnitId, fullPath: readonly Point[]): Promise<void> {
    const sprite = this.unitSprites.get(unitId);
    const end = fullPath[fullPath.length - 1];
    if (!sprite || !end) return;
    if (sprite.x === end.x * TILE_SIZE && sprite.y === end.y * TILE_SIZE) return;
    for (const p of fullPath.slice(1)) {
      await new Promise<void>((resolve) => {
        this.tweens.add({
          targets: sprite,
          x: p.x * TILE_SIZE,
          y: p.y * TILE_SIZE,
          duration: MOVE_MS_PER_TILE,
          onComplete: () => resolve(),
        });
      });
    }
  }

  // ---- Rendering game state ----

  private renderState(): void {
    const layer = this.stateLayer;
    if (!layer) return;
    layer.removeAll(true);
    this.unitSprites.clear();

    // Property ownership: a small team-colored flag in the tile's top-left corner.
    const flags = this.add.graphics();
    for (const prop of this.state.properties) {
      if (prop.owner === null) continue;
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

    for (const unit of this.state.units) {
      const sprite = this.add.container(unit.pos.x * TILE_SIZE, unit.pos.y * TILE_SIZE);
      const marker = this.add
        .image(0, 0, this.texture(`unit-${unit.type}-${unit.owner}`, () => drawUnitMarker(unit.type, unit.owner)))
        .setOrigin(0);
      if (unit.hasActed) marker.setAlpha(0.5);
      sprite.add(marker);

      const hp = displayHp(unit.hp);
      if (hp < 10) sprite.add(this.add.image(TILE_SIZE, TILE_SIZE, this.texture(`hp-${hp}`, () => drawHpBadge(hp))).setOrigin(1));
      const { level } = veterancyFor(unit.kills);
      if (level !== "rookie") {
        sprite.add(this.add.image(TILE_SIZE, 0, this.texture(`vet-${level}`, () => drawVeterancyBadge(level))).setOrigin(1, 0));
      }
      layer.add(sprite);
      this.unitSprites.set(unit.id, sprite);
    }
  }

  /** Returns a texture key, generating the texture the first time it's needed. */
  private texture(key: string, draw: () => HTMLCanvasElement): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, draw());
    return key;
  }
}
