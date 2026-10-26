import Phaser from "phaser";
import { apply } from "./engine/apply";
import type { Command } from "./engine/commands";
import { inBounds, terrainAt, type Point } from "./engine/map";
import { createGame } from "./engine/setup";
import { unitAt, type GameState } from "./engine/state";
import { MapScene } from "./game/MapScene";
import { HELLO_SETUP } from "./game/maps/hello";
import { TILE_SIZE } from "./game/placeholderTiles";
import { createDebugPanel, createTerrainPanel, createTurnBar, createUnitPanel } from "./ui/hud";
import "./ui/style.css";

let state: GameState = createGame(HELLO_SETUP);
let cursor: Point = { x: 0, y: 0 };

const width = state.map.width * TILE_SIZE;
const height = state.map.height * TILE_SIZE;

const gameRoot = document.getElementById("game");
const uiRoot = document.getElementById("ui");
if (!gameRoot || !uiRoot) throw new Error("index.html is missing #game or #ui");

const turnBar = createTurnBar(uiRoot, () => dispatch({ type: "endTurn" }));
const unitPanel = createUnitPanel(uiRoot);
const terrainPanel = createTerrainPanel(uiRoot);
const debugPanel = createDebugPanel(uiRoot);

const scene = new MapScene({
  state,
  onCursorMove: (tile) => {
    cursor = tile;
    showCursorInfo();
  },
});

function showCursorInfo(): void {
  if (!inBounds(state.map, cursor)) return;
  terrainPanel.show(terrainAt(state.map, cursor));
  unitPanel.show(state, unitAt(state, cursor));
}

/** The only way the UI changes the game: send a command to the engine and show the result. */
function dispatch(command: Command): void {
  const result = apply(state, command);
  if (!result.ok) {
    console.warn(`Command rejected (${result.code}): ${result.message}`);
    return;
  }
  state = result.state;
  debugPanel.logEvents(state, result.events);
  render();
}

function render(): void {
  scene.setState(state);
  turnBar.update(state);
  debugPanel.update(state);
  showCursorInfo();
}

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
  scene,
});

render();
window.addEventListener("resize", () => game.scale.setZoom(integerZoom()));
