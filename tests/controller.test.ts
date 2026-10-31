import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import { forecastLines, InputController, type MapView, type MenuItem, type RangeLayer } from "../src/game/controller";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });

/** A MapView that records what it was told to show, plus a controller driving a real engine. */
function setup(rows: string[], units: UnitSetup[]) {
  let state: GameState = makeGame(rows, units, { settings: { luck: false } });
  const seen = {
    ranges: [] as readonly RangeLayer[],
    menu: null as readonly MenuItem[] | null,
    forecast: null as readonly string[] | null,
    cursor: null as Point | null,
    commands: [] as Command[],
  };
  const view: MapView = {
    showRanges: (layers) => { seen.ranges = layers; },
    clearRange: () => { seen.ranges = []; },
    showPath: () => undefined,
    clearPath: () => undefined,
    previewMove: () => Promise.resolve(),
    resetPreview: () => undefined,
    openMenu: (_, items) => { seen.menu = items; },
    closeMenu: () => { seen.menu = null; },
    setCursor: (tile) => { seen.cursor = tile; },
    showForecast: (_, lines) => { seen.forecast = lines; },
    clearForecast: () => { seen.forecast = null; },
  };
  const controller = new InputController({
    getState: () => state,
    dispatch: (command) => {
      seen.commands.push(command);
      const result = apply(state, command);
      if (result.ok) state = result.state;
      return Promise.resolve(result.ok);
    },
    view,
  });
  const labels = () => seen.menu?.map((i) => i.id);
  /** Lets the controller's awaited preview finish. */
  const settle = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  return { controller, seen, labels, settle, getState: () => state };
}

describe("action menu", () => {
  it("offers Fire when an enemy is in range after moving", async () => {
    const { controller, labels, settle } = setup(["===="], [
      { type: "mediumTank", owner: 0, pos: P(0, 0) },
      { type: "infantry", owner: 1, pos: P(2, 0) },
    ]);
    controller.onConfirm(P(0, 0));
    controller.onConfirm(P(1, 0));
    await settle();
    expect(labels()).toEqual(["fire", "wait", "cancel"]);
  });

  it("has no Fire when nothing is in range", async () => {
    const { controller, labels, settle } = setup(["====="], [
      { type: "mediumTank", owner: 0, pos: P(0, 0) },
      { type: "infantry", owner: 1, pos: P(4, 0) },
    ]);
    controller.onConfirm(P(0, 0));
    controller.onConfirm(P(1, 0));
    await settle();
    expect(labels()).toEqual(["wait", "cancel"]);
  });

  it("indirect units only get Fire if they stayed put", async () => {
    const units: UnitSetup[] = [
      { type: "artillery", owner: 0, pos: P(0, 0) },
      { type: "infantry", owner: 1, pos: P(3, 0) },
    ];
    const moved = setup(["====="], units);
    moved.controller.onConfirm(P(0, 0));
    moved.controller.onConfirm(P(1, 0));
    await moved.settle();
    expect(moved.labels()).toEqual(["wait", "cancel"]);

    const stayed = setup(["====="], units);
    stayed.controller.onConfirm(P(0, 0));
    stayed.controller.onConfirm(P(0, 0));
    await stayed.settle();
    expect(stayed.labels()).toEqual(["fire", "wait", "cancel"]);
  });
});

describe("targeting", () => {
  const start = async () => {
    const game = setup(["===="], [
      { type: "mediumTank", owner: 0, pos: P(0, 0) },
      { type: "mediumTank", owner: 1, pos: P(2, 0) },
    ]);
    game.controller.onConfirm(P(0, 0));
    game.controller.onConfirm(P(1, 0));
    await game.settle();
    game.controller.onMenuChoice("fire");
    return game;
  };

  it("Fire highlights targets, jumps the cursor to one and shows its forecast", async () => {
    const { seen } = await start();
    expect(seen.menu).toBeNull();
    expect(seen.ranges).toEqual([{ tiles: [P(2, 0)], kind: "attack" }]);
    expect(seen.cursor).toEqual(P(2, 0));
    expect(seen.forecast).toEqual(["DMG 55%", "BACK 27%"]);
  });

  it("the forecast clears away from a target", async () => {
    const { controller, seen } = await start();
    controller.onCursorMove(P(3, 0));
    expect(seen.forecast).toBeNull();
  });

  it("confirming a target sends one attack command with the path", async () => {
    const { controller, seen, settle } = await start();
    controller.onConfirm(P(2, 0));
    await settle();
    expect(seen.commands).toEqual([{ type: "move", unitId: 0, path: [P(1, 0)], action: { type: "attack", target: 1 } }]);
  });

  it("confirming an empty tile does nothing", async () => {
    const { controller, seen, settle } = await start();
    controller.onConfirm(P(3, 0));
    await settle();
    expect(seen.commands).toEqual([]);
  });

  it("cancel goes back to the action menu without moving the turn on", async () => {
    const { controller, seen, labels } = await start();
    controller.onCancel();
    expect(labels()).toEqual(["fire", "wait", "cancel"]);
    expect(seen.ranges).toEqual([]);
    expect(seen.forecast).toBeNull();
    expect(seen.commands).toEqual([]);
  });
});

describe("enemy threat range", () => {
  it("shows where an enemy can move and, in red, what it can hit beyond that", () => {
    const { controller, seen } = setup(["======"], [
      { type: "infantry", owner: 1, pos: P(0, 0) },
      { type: "mediumTank", owner: 0, pos: P(5, 0) },
    ]);
    controller.onConfirm(P(0, 0));
    const [move, attack] = seen.ranges;
    expect(move?.kind).toBe("inspect");
    expect(move?.tiles).toHaveLength(4); // its own tile + 3 tiles of movement
    expect(attack).toEqual({ tiles: [P(4, 0)], kind: "attack" });
  });
});

describe("forecast text", () => {
  const base = {
    weapon: "primary" as const,
    attack: { min: 55, max: 64 },
    counter: { min: 20, max: 27 },
    canKill: false,
    certainKill: false,
    counterCanKill: false,
    counterCertainKill: false,
  };

  it("shows damage ranges", () => {
    expect(forecastLines(base)).toEqual(["DMG 55-64%", "BACK 20-27%"]);
  });

  it("flags a possible kill and a certain kill", () => {
    expect(forecastLines({ ...base, canKill: true })[0]).toBe("DMG 55-64% KILL?");
    expect(forecastLines({ ...base, canKill: true, certainKill: true, counter: null })).toEqual(["DMG 55-64% KILL", "NO COUNTER"]);
  });

  it("warns when the counter could destroy your own unit", () => {
    expect(forecastLines({ ...base, counterCanKill: true })[1]).toBe("BACK 20-27% KILL?");
    expect(forecastLines({ ...base, counterCanKill: true, counterCertainKill: true })[1]).toBe("BACK 20-27% KILL");
  });
});
