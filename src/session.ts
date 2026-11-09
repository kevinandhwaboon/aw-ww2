// One game in progress: the current state, the Phaser map, the HTML panels, and the loop that sends
// commands to the engine and plays back what happened.

import Phaser from "phaser";
import { aiStep, type AiPlayer } from "./ai/player";
import { apply } from "./engine/apply";
import type { Command } from "./engine/commands";
import { inBounds, terrainAt, type Point } from "./engine/map";
import { createGame, type GameSetup } from "./engine/setup";
import { unitAt, type GameState } from "./engine/state";
import { packColor } from "./game/artPack";
import { BattleScene } from "./game/battle/BattleScene";
import { InputController } from "./game/controller";
import { MapScene } from "./game/MapScene";
import { TILE_SIZE } from "./game/placeholderTiles";
import { viewSize } from "./game/viewport";
import { playerColors } from "./game/placeholderUnits";
import {
  createBanner,
  createBuildMenu,
  createDebugPanel,
  createHandoff,
  createHud,
  createResultsScreen,
  createTileInfo,
  createUnitPanel,
} from "./ui/hud";

export interface SessionOptions {
  readonly gameRoot: HTMLElement;
  readonly uiRoot: HTMLElement;
  readonly setup: GameSetup;
  /** Hot-seat: stop between turns until the next player says they're ready. */
  readonly passDevice: boolean;
  /** Attacks play as split-screen battle scenes (08-art-pipeline §18) instead of on the map. */
  readonly battleScenes: boolean;
  /** Also shows the unit and debug panels (11-tech-setup §7). */
  readonly debug: boolean;
  /** The AI playing each player, by player id; null for a human (09-ai §5). */
  readonly ais: readonly (AiPlayer | null)[];
  readonly onNewGame: () => void;
}

/** Pause before each AI unit acts, so its moves can be followed (09-ai §5). */
const AI_PAUSE_MS = 250;

export function startSession({ gameRoot, uiRoot, setup, passDevice, battleScenes, debug, ais, onNewGame }: SessionOptions): void {
  let state: GameState = createGame(setup);
  let cursor: Point = { x: 0, y: 0 };
  /**
   * States before each action this turn, for Undo. A playtesting convenience: cleared at End Turn and
   * by any attack, because luck reveals information that a redo could exploit.
   */
  let history: GameState[] = [];

  const width = state.map.width * TILE_SIZE;
  const height = state.map.height * TILE_SIZE;

  const hud = createHud(uiRoot);
  const tileInfoPanel = createTileInfo(uiRoot);
  const unitPanel = debug ? createUnitPanel(uiRoot) : null;
  const debugPanel = debug ? createDebugPanel(uiRoot) : null;
  const banner = createBanner(uiRoot);
  const handoff = createHandoff(uiRoot);
  const buildMenu = createBuildMenu(uiRoot, () => state);
  const results = createResultsScreen(uiRoot);

  const scene = new MapScene({
    state,
    onCursorMove: (tile) => {
      cursor = tile;
      showCursorInfo();
    },
  });

  const battle = new BattleScene();
  scene.setBattlePlayer(battleScenes ? battle : null);

  const controller = new InputController({ getState: () => state, dispatch, view: scene, buildMenu });
  /** During the computer's turn the map can be looked at, but no orders given (09-ai §5). */
  const aiTurn = () => state.result === null && ais[state.currentPlayer] != null;
  const humans = setup.players.filter((_, id) => ais[id] == null).length;
  scene.setHandlers({
    onCursorMove: (tile) => controller.onCursorMove(tile),
    nextCursor: (from, step) => controller.nextCursor(from, step),
    onConfirm: (tile) => {
      if (!aiTurn()) controller.onConfirm(tile);
    },
    onCancel: () => {
      if (!aiTurn()) controller.onCancel();
    },
    onMenuChoice: (id) => {
      if (!aiTurn()) controller.onMenuChoice(id);
    },
    onPeekStart: (tile) => controller.onPeekStart(tile),
    onPeekEnd: () => controller.onPeekEnd(),
  });

  function showCursorInfo(): void {
    if (!inBounds(state.map, cursor)) return;
    const onLeft = scene.tileInLeftHalf(cursor);
    hud.update(state, onLeft);
    tileInfoPanel.show(state, cursor, onLeft);
    unitPanel?.show(state, unitAt(state, cursor));
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
    const attacked = command.type === "move" && (command.action.type === "attack" || command.action.type === "attackFort");
    const revealsInformation = command.type === "endTurn" || attacked;
    history = revealsInformation || result.state.result ? [] : [...history, state];
    await scene.playEvents(result.events);
    const previous = state;
    state = result.state;
    debugPanel?.logEvents(state, previous, result.events);
    render();
    for (const event of result.events) {
      if (event.type === "weatherChanged") {
        await banner.show(event.weather === "snow" ? "Snow is falling" : "The skies clear", packColor("uiInk"));
        continue;
      }
      if (event.type !== "turnStarted") continue;
      const player = state.players[event.player];
      if (!player) continue;
      const income = result.events.find((e) => e.type === "incomeReceived");
      const earned = income ? ` +${income.amount.toLocaleString("en-US")}` : "";
      scene.setCursor(turnStartTile(state, player.id));
      const color = playerColors(player.id)[0];
      // The pass-the-device screen only matters between two people (09-ai §5).
      if (passDevice && humans > 1 && ais[player.id] == null) await handoff.show(`Day ${event.day} · ${player.name}`, earned ? `Income${earned}` : "", color);
      else await banner.show(`Day ${event.day} · ${player.name}${earned}`, color);
    }
    render();
    if (state.result) {
      controller.finish();
      results.show(state, onNewGame);
    }
    if (aiTurn()) void runAi();
    return true;
  }

  let aiRunning = false;

  /**
   * Plays the computer's turns, one command at a time, each animated like a human's. A misbehaving
   * AI has its turn ended for it, and the problem is logged (09-ai §3).
   */
  async function runAi(): Promise<void> {
    if (aiRunning) return;
    aiRunning = true;
    controller.reset();
    try {
      let sent = 0;
      for (let ai = ais[state.currentPlayer]; ai && !state.result; ai = ais[state.currentPlayer]) {
        const step = await aiStep(state, ai, sent);
        const command = step.command;
        if (step.bug) {
          console.error(`AI bug: ${step.bug}`);
          debugPanel?.logNote(`AI bug: ${step.bug}`);
        }
        if (command.type === "move") {
          const unit = state.units.find((u) => u.id === command.unitId);
          if (unit) scene.setCursor(unit.pos);
          await new Promise((resolve) => setTimeout(resolve, AI_PAUSE_MS));
        }
        sent = command.type === "endTurn" ? 0 : sent + 1;
        await dispatch(command);
      }
    } finally {
      aiRunning = false;
    }
  }

  function undo(): void {
    const previous = history[history.length - 1];
    if (!previous || controller.busy) return;
    controller.reset();
    history = history.slice(0, -1);
    state = previous;
    debugPanel?.logNote("Undo: last move taken back");
    render();
  }

  function render(): void {
    scene.setState(state);
    debugPanel?.update(state);
    showCursorInfo();
  }

  window.addEventListener("keydown", (event) => {
    if (event.target instanceof HTMLElement && ["INPUT", "TEXTAREA", "BUTTON"].includes(event.target.tagName)) return;
    if (event.key === "u" || event.key === "U" || ((event.metaKey || event.ctrlKey) && event.key === "z")) {
      event.preventDefault();
      if (!aiTurn()) undo();
    } else if (event.key === "e" || event.key === "E") {
      if (!aiTurn()) controller.endTurn();
    }
  });

  /**
   * Whole-number zoom so pixels stay crisp (00-master-design §14), filling the window, but never so
   * small that squares are hard to read: past that the view scrolls (00-master-design §12).
   */
  const fitWindow = () => viewSize({ width: window.innerWidth, height: window.innerHeight }, { width, height });

  // The canvas is as big as it shows on screen and the scene's camera does the enlarging, so art
  // finer than one pixel per map pixel (32-pixel units) keeps its detail (08-art-pipeline §17).
  let view = fitWindow();
  scene.setPixelScale(view.zoom);
  scene.setCursor(turnStartTile(state, state.currentPlayer));
  const game = new Phaser.Game({
    type: Phaser.AUTO,
    parent: gameRoot,
    width: view.width,
    height: view.height,
    pixelArt: true,
    backgroundColor: packColor("uiBg"),
    scale: { mode: Phaser.Scale.NONE },
    scene: [scene, battle],
  });

  render();
  if (aiTurn()) void runAi();
  window.addEventListener("resize", () => {
    const next = fitWindow();
    if (next.zoom === view.zoom && next.width === view.width && next.height === view.height) return;
    view = next;
    game.scale.resize(view.width, view.height);
    scene.setPixelScale(view.zoom);
  });
}

/** Where a player's turn starts the cursor: on their HQ, or their first unit if they have none. */
function turnStartTile(state: GameState, player: number): Point {
  const hq = state.properties.find((p) => p.owner === player && terrainAt(state.map, p.pos) === "hq");
  return hq?.pos ?? state.units.find((u) => u.owner === player)?.pos ?? { x: 0, y: 0 };
}
