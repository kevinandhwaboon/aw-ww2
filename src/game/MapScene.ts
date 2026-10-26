import Phaser from "phaser";
import type { GameMap, Point } from "../engine/map";
import { drawPlaceholderTileset, tileIndex, TILE_SIZE } from "./placeholderTiles";

export interface MapSceneOptions {
  readonly map: GameMap;
  /** Called when the cursor moves to a new tile. */
  readonly onCursorMove: (tile: Point) => void;
}

/** Draws the map and a tile cursor. Presentation only: it reports input, never decides outcomes. */
export class MapScene extends Phaser.Scene {
  private cursor?: Phaser.GameObjects.Graphics;
  private cursorTile: Point = { x: 0, y: 0 };

  constructor(private readonly options: MapSceneOptions) {
    super("map");
  }

  create(): void {
    const { map } = this.options;
    this.textures.addCanvas("terrain", drawPlaceholderTileset());

    const data: number[][] = [];
    for (let y = 0; y < map.height; y++) {
      data.push(map.terrain.slice(y * map.width, (y + 1) * map.width).map(tileIndex));
    }
    const tilemap = this.make.tilemap({ data, tileWidth: TILE_SIZE, tileHeight: TILE_SIZE });
    const tileset = tilemap.addTilesetImage("terrain");
    if (!tileset) throw new Error("Failed to create terrain tileset");
    tilemap.createLayer(0, tileset, 0, 0);

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

  private moveCursorTo(worldX: number, worldY: number): void {
    const { map } = this.options;
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
