import Phaser from "phaser";
import { veterancyFor } from "../engine/data/veterancy";
import type { Point } from "../engine/map";
import { displayHp, type GameState } from "../engine/state";
import { drawPlaceholderTileset, tileIndex, TILE_SIZE } from "./placeholderTiles";
import { drawHpBadge, drawUnitMarker, drawVeterancyBadge, playerColors } from "./placeholderUnits";

export interface MapSceneOptions {
  readonly state: GameState;
  /** Called when the cursor moves to a new tile. */
  readonly onCursorMove: (tile: Point) => void;
}

/** Draws the map, units and a tile cursor. Presentation only: it reports input, never decides outcomes. */
export class MapScene extends Phaser.Scene {
  private cursor?: Phaser.GameObjects.Graphics;
  private cursorTile: Point = { x: 0, y: 0 };
  private state: GameState;
  private stateLayer?: Phaser.GameObjects.Container;

  constructor(private readonly options: MapSceneOptions) {
    super("map");
    this.state = options.state;
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

    this.stateLayer = this.add.container(0, 0);
    this.renderState();

    this.cursor = this.add.graphics();
    this.drawCursor();
    this.options.onCursorMove(this.cursorTile);

    this.input.on("pointermove", (pointer: Phaser.Input.Pointer) => {
      this.moveCursorTo(pointer.worldX, pointer.worldY);
    });
    this.input.on("pointerdown", (pointer: Phaser.Input.Pointer) => {
      this.moveCursorTo(pointer.worldX, pointer.worldY);
    });
  }

  /** Shows a new game state. Safe to call before the scene has been created. */
  setState(state: GameState): void {
    this.state = state;
    this.renderState();
  }

  private renderState(): void {
    const layer = this.stateLayer;
    if (!layer) return;
    layer.removeAll(true);

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
      const x = unit.pos.x * TILE_SIZE;
      const y = unit.pos.y * TILE_SIZE;
      const marker = this.add
        .image(x, y, this.texture(`unit-${unit.type}-${unit.owner}`, () => drawUnitMarker(unit.type, unit.owner)))
        .setOrigin(0);
      if (unit.hasActed) marker.setAlpha(0.5);
      layer.add(marker);

      const hp = displayHp(unit.hp);
      if (hp < 10) {
        const badge = this.texture(`hp-${hp}`, () => drawHpBadge(hp));
        layer.add(this.add.image(x + TILE_SIZE, y + TILE_SIZE, badge).setOrigin(1));
      }
      const { level } = veterancyFor(unit.kills);
      if (level !== "rookie") {
        layer.add(this.add.image(x + TILE_SIZE, y, this.texture(`vet-${level}`, () => drawVeterancyBadge(level))).setOrigin(1, 0));
      }
    }
  }

  /** Returns a texture key, generating the texture the first time it's needed. */
  private texture(key: string, draw: () => HTMLCanvasElement): string {
    if (!this.textures.exists(key)) this.textures.addCanvas(key, draw());
    return key;
  }

  private moveCursorTo(worldX: number, worldY: number): void {
    const { map } = this.state;
    const x = Phaser.Math.Clamp(Math.floor(worldX / TILE_SIZE), 0, map.width - 1);
    const y = Phaser.Math.Clamp(Math.floor(worldY / TILE_SIZE), 0, map.height - 1);
    if (x === this.cursorTile.x && y === this.cursorTile.y) return;
    this.cursorTile = { x, y };
    this.drawCursor();
    this.options.onCursorMove(this.cursorTile);
  }

  private drawCursor(): void {
    if (!this.cursor) return;
    const { x, y } = this.cursorTile;
    this.cursor.clear();
    this.cursor.lineStyle(1, 0xffffff, 1);
    this.cursor.strokeRect(x * TILE_SIZE + 0.5, y * TILE_SIZE + 0.5, TILE_SIZE - 1, TILE_SIZE - 1);
  }
}
