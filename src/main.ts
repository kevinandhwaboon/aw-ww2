import Phaser from "phaser";
import { terrainAt } from "./engine/map";
import { MapScene } from "./game/MapScene";
import { HELLO_MAP } from "./game/maps/hello";
import { TILE_SIZE } from "./game/placeholderTiles";
import { createTerrainPanel } from "./ui/hud";
import "./ui/style.css";

const map = HELLO_MAP;
const width = map.width * TILE_SIZE;
const height = map.height * TILE_SIZE;

const gameRoot = document.getElementById("game");
const uiRoot = document.getElementById("ui");
if (!gameRoot || !uiRoot) throw new Error("index.html is missing #game or #ui");

const terrainPanel = createTerrainPanel(uiRoot);

/** Largest whole-number scale that fits the window, so pixels stay crisp (00-master-design §14). */
function integerZoom(): number {
  return Math.max(1, Math.floor(Math.min(window.innerWidth / width, window.innerHeight / height)));
}

const game = new Phaser.Game({
  type: Phaser.AUTO,
  parent: gameRoot,
  width,
  height,
  pixelArt: true,
  backgroundColor: "#101018",
  scale: { mode: Phaser.Scale.NONE, zoom: integerZoom() },
  scene: new MapScene({
    map,
    onCursorMove: (tile) => terrainPanel.show(terrainAt(map, tile)),
  }),
});

window.addEventListener("resize", () => game.scale.setZoom(integerZoom()));
