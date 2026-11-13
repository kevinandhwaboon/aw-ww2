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
import { handheldViewSize, viewSize } from "./game/viewport";
import { mountPad, type PadInput } from "./ui/pad";
import { playerColors } from "./game/placeholderUnits";
import { createBuildMenu } from "./ui/buildMenu";
import { createDebugPanel } from "./ui/debugPanel";
import { createHud } from "./ui/hud";
import { createBanner, createHandoff } from "./ui/overlays";
import { createResultsScreen } from "./ui/results";
import { createTileInfo } from "./ui/tileInfoPanel";
import { createUnitPanel } from "./ui/unitPanel";

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
  /** Phone held upright: a handheld-style screen with an on-screen game pad under it. */
  readonly pad: boolean;
  readonly onNewGame: () => void;
}

/** A game in progress, as seen from outside. */
export interface Session {
  /**
   * Ends the game for good: stops the computer, removes the page listeners, the map canvas, the game
   * pad and everything in uiRoot, so another game can start on the same page.
   */
  end(): void;
}

/** Pause before each AI unit acts, so its moves can be followed (09-ai §5). */
const AI_PAUSE_MS = 250;

export function startSession({ gameRoot, uiRoot, setup, passDevice, battleScenes, debug, ais, pad, onNewGame }: SessionOptions): Session {
  /** Aborted by end(): removes every listener the session added to the page. */
  const listening = new AbortController();
  let ended = false;
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

  const controller = new InputController({
    getState: () => state,
    // The controller frees itself just after an order plays out; refresh the cursor info once it has.
    dispatch: async (command) => {
      const ok = await dispatch(command);
      setTimeout(showCursorInfo, 0);
      return ok;
    },
    view: scene,
    buildMenu,
  });
  /** During the computer's turn the map can be looked at, but no orders given (09-ai §5). */
  const aiTurn = () => state.result === null && ais[state.currentPlayer] != null;
  const humans = setup.players.filter((_, id) => ais[id] == null).length;
  scene.setHandlers({
    onCursorMove: (tile) => controller.onCursorMove(tile),
    nextCursor: (from, step) => controller.nextCursor(from, step),
    onConfirm: (tile) => {
      if (!aiTurn()) controller.onConfirm(tile);
      showCursorInfo();
    },
    onCancel: () => {
      if (!aiTurn()) controller.onCancel();
      showCursorInfo();
    },
    onMenuChoice: (id) => {
      if (!aiTurn()) controller.onMenuChoice(id);
      showCursorInfo();
    },
    onPeekStart: (tile) => {
      controller.onPeekStart(tile);
      showCursorInfo();
    },
    onPeekEnd: () => {
      controller.onPeekEnd();
      showCursorInfo();
    },
  });

  function showCursorInfo(): void {
    if (!inBounds(state.map, cursor)) return;
    const onLeft = scene.tileInLeftHalf(cursor);
    hud.update(state, onLeft);
    // While an aircraft is out on its Carrier being launched, the panel describes it.
    tileInfoPanel.show(scene.shownState(), cursor, onLeft);
    unitPanel?.show(state, unitAt(state, cursor));
    refreshCargoPeek();
  }

  /** A transport under the cursor shows who is aboard, while nothing is selected (05-supply-transport §4). */
  function refreshCargoPeek(): void {
    scene.showCargoPeek(controller.idle && inBounds(state.map, cursor) ? cursor : null);
  }

  /**
   * The only way the UI changes the game: send a command to the engine, animate its events while
   * input is locked, then show the new state.
   */
  async function dispatch(command: Command): Promise<boolean> {
    if (ended) return false;
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
      for (let ai = ais[state.currentPlayer]; ai && !state.result && !ended; ai = ais[state.currentPlayer]) {
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
  }, { signal: listening.signal });

  /**
   * Whole-number zoom so pixels stay crisp (00-master-design §14), filling the window, but never so
   * small that squares are hard to read: past that the view scrolls (00-master-design §12).
   */
  // With the game pad the screen is a box above the pad, drawn in the phone's own pixels.
  const unmountPad = pad ? mountPad(uiRoot, padInput(scene)) : null;
  const fitWindow = () =>
    pad
      ? handheldViewSize(gameRoot.getBoundingClientRect(), { width, height }, window.devicePixelRatio)
      : viewSize({ width: window.innerWidth, height: window.innerHeight }, { width, height });
  const canvasZoom = () => (pad ? 1 / window.devicePixelRatio : 1); // canvas pixels per CSS pixel

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
    scale: { mode: Phaser.Scale.NONE, zoom: canvasZoom() },
    scene: [scene, battle],
  });

  render();
  if (aiTurn()) void runAi();
  window.addEventListener("resize", () => {
    const next = fitWindow();
    if (next.zoom === view.zoom && next.width === view.width && next.height === view.height) return;
    view = next;
    game.scale.resize(view.width, view.height);
    game.scale.setZoom(canvasZoom());
    scene.setPixelScale(view.zoom);
  }, { signal: listening.signal });

  return {
    end() {
      if (ended) return;
      ended = true;
      listening.abort();
      unmountPad?.();
      game.destroy(true); // the scenes remove their own listeners as they're destroyed
      uiRoot.replaceChildren();
    },
  };
}

/** Where a player's turn starts the cursor: on their HQ, or their first unit if they have none. */
function turnStartTile(state: GameState, player: number): Point {
  const hq = state.properties.find((p) => p.owner === player && terrainAt(state.map, p.pos) === "hq");
  return hq?.pos ?? state.units.find((u) => u.owner === player)?.pos ?? { x: 0, y: 0 };
}

/**
 * Where an on-screen pad button goes: to the menu that has the focus, as the key it stands for,
 * otherwise straight to the map. A button left focused on a screen that's now hidden doesn't count.
 */
function padInput(scene: MapScene): PadInput {
  const focusedMenu = (): HTMLElement | null => {
    const focused = document.activeElement;
    if (!(focused instanceof HTMLElement) || focused === document.body) return null;
    if (focused.getClientRects().length > 0) return focused;
    focused.blur();
    return null;
  };
  const send = (target: HTMLElement, type: "keydown" | "keyup", key: string, repeat: boolean) =>
    target.dispatchEvent(new KeyboardEvent(type, { key, repeat, bubbles: true, cancelable: true }));
  return {
    press(key, repeat) {
      const menu = focusedMenu();
      if (menu) send(menu, "keydown", key, repeat);
      else scene.pressKey(key, repeat);
    },
    release(key) {
      const menu = focusedMenu();
      if (menu) send(menu, "keyup", key, false);
      else scene.releaseKey(key);
    },
  };
}
