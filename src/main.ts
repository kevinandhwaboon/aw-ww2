import Phaser from "phaser";
import { apply } from "./engine/apply";
import type { Command } from "./engine/commands";
import { inBounds, terrainAt, type Point } from "./engine/map";
import { createGame } from "./engine/setup";
import { unitAt, type GameState } from "./engine/state";
import { InputController } from "./game/controller";
import { MapScene } from "./game/MapScene";
import { HELLO_SETUP } from "./game/maps/hello";
import { TILE_SIZE } from "./game/placeholderTiles";
import { playerColors } from "./game/placeholderUnits";
import { createBanner, createDebugPanel, createTerrainPanel, createTurnBar, createUnitPanel } from "./ui/hud";
import "./ui/style.css";

let state: GameState = createGame(HELLO_SETUP);
let cursor: Point = { x: 0, y: 0 };
/**
 * States before each move this turn, for Undo. A playtesting convenience: cleared at End Turn, and
 * later milestones must clear it after anything that reveals new information (e.g. luck rolls).
 */
let history: GameState[] = [];
let playing = false;

const width = state.map.width * TILE_SIZE;
const height = state.map.height * TILE_SIZE;

const gameRoot = document.getElementById("game");
const uiRoot = document.getElementById("ui");
if (!gameRoot || !uiRoot) throw new Error("index.html is missing #game or #ui");

const turnBar = createTurnBar(uiRoot, { onEndTurn: endTurn, onUndo: undo });
const unitPanel = createUnitPanel(uiRoot);
const terrainPanel = createTerrainPanel(uiRoot);
const debugPanel = createDebugPanel(uiRoot);
const banner = createBanner(uiRoot);

const scene = new MapScene({
  state,
  onCursorMove: (tile) => {
    cursor = tile;
    showCursorInfo();
  },
});

const controller = new InputController({ getState: () => state, dispatch, view: scene });
scene.setHandlers({
  onCursorMove: (tile) => controller.onCursorMove(tile),
  onConfirm: (tile) => controller.onConfirm(tile),
  onCancel: () => controller.onCancel(),
  onMenuChoice: (id) => controller.onMenuChoice(id),
});

function showCursorInfo(): void {
  if (!inBounds(state.map, cursor)) return;
  terrainPanel.show(terrainAt(state.map, cursor));
  unitPanel.show(state, unitAt(state, cursor));
}

/**
 * The only way the UI changes the game: send a command to the engine, animate its events while
 * input is locked, then show the new state.
 */
async function dispatch(command: Command): Promise<boolean> {
  const result = apply(state, command);
  if (!result.ok) {
    console.warn(`Command rejected (${result.code}): ${result.message}`);
    return false;
  }
  history = command.type === "endTurn" ? [] : [...history, state];
  playing = true;
  turnBar.update(state, { canUndo: false, busy: true }); // don't re-render the map: it would undo the move preview
  await scene.playEvents(result.events);
  state = result.state;
  debugPanel.logEvents(state, result.events);
  render();
  for (const event of result.events) {
    if (event.type !== "turnStarted") continue;
    const player = state.players[event.player];
    if (player) await banner.show(`Day ${event.day} · ${player.name}`, playerColors(player.id)[0]);
  }
  playing = false;
  render();
  return true;
}

function endTurn(): void {
  if (playing || controller.busy) return;
  controller.reset();
  void dispatch({ type: "endTurn" });
}

function undo(): void {
  const previous = history[history.length - 1];
  if (!previous || playing || controller.busy) return;
  controller.reset();
  history = history.slice(0, -1);
  state = previous;
  debugPanel.logNote("Undo: last move taken back");
  render();
}

function render(): void {
  scene.setState(state);
  turnBar.update(state, { canUndo: history.length > 0, busy: playing });
  debugPanel.update(state);
  showCursorInfo();
}

window.addEventListener("keydown", (event) => {
  if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "BUTTON"].includes(event.target.tagName)) return;
  if (event.key === "u" || event.key === "U" || ((event.metaKey || event.ctrlKey) && event.key === "z")) {
    event.preventDefault();
    undo();
  } else if (event.key === "e" || event.key === "E") {
    endTurn();
  }
});

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
