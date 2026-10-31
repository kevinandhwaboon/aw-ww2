import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import type { UnitTypeId } from "../src/engine/data/units";
import type { BuildOption } from "../src/engine/economy";
import type { Point } from "../src/engine/map";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import { forecastLines, InputController, type BuildMenu, type MapView, type MenuItem, type RangeLayer } from "../src/game/controller";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });

/** A MapView that records what it was told to show, plus a controller driving a real engine. */
function setup(rows: string[], units: UnitSetup[], owners: { pos: Point; owner: number }[] = []) {
  let state: GameState = makeGame(rows, units, {
    settings: { luck: false },
    players: [{ name: "A", nation: "us", funds: 5000 }, { name: "B", nation: "germany" }],
    propertyOwners: owners,
  });
  const seen = {
    ranges: [] as readonly RangeLayer[],
    menu: null as readonly MenuItem[] | null,
    forecast: null as readonly string[] | null,
    cursor: null as Point | null,
    commands: [] as Command[],
  };
  const built = { options: null as readonly BuildOption[] | null, pick: null as ((type: UnitTypeId) => void) | null };
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
  const buildMenu: BuildMenu = {
    open: (options, onPick) => { built.options = options; built.pick = onPick; },
    close: () => { built.options = null; built.pick = null; },
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
    buildMenu,
  });
  const labels = () => seen.menu?.map((i) => i.id);
  /** Lets the controller's awaited preview finish. */
  const settle = async () => {
    for (let i = 0; i < 10; i++) await Promise.resolve();
  };
  return { controller, seen, built, labels, settle, getState: () => state };
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

describe("capture and build", () => {
  it("offers Capture to infantry on a property that isn't theirs", async () => {
    const { controller, labels, settle } = setup([".C."], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    controller.onConfirm(P(0, 0));
    controller.onConfirm(P(1, 0));
    await settle();
    expect(labels()).toEqual(["capture", "wait", "cancel"]);
  });

  it("doesn't offer Capture to vehicles or on your own property", async () => {
    const tank = setup([".C."], [{ type: "mediumTank", owner: 0, pos: P(0, 0) }]);
    tank.controller.onConfirm(P(0, 0));
    tank.controller.onConfirm(P(1, 0));
    await tank.settle();
    expect(tank.labels()).toEqual(["wait", "cancel"]);

    const own = setup([".C."], [{ type: "infantry", owner: 0, pos: P(0, 0) }], [{ pos: P(1, 0), owner: 0 }]);
    own.controller.onConfirm(P(0, 0));
    own.controller.onConfirm(P(1, 0));
    await own.settle();
    expect(own.labels()).toEqual(["wait", "cancel"]);
  });

  it("choosing Capture sends one capture command", async () => {
    const { controller, seen, settle } = setup([".C."], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    controller.onConfirm(P(0, 0));
    controller.onConfirm(P(1, 0));
    await settle();
    controller.onMenuChoice("capture");
    await settle();
    expect(seen.commands).toEqual([{ type: "move", unitId: 0, path: [P(1, 0)], action: { type: "capture" } }]);
  });

  it("clicking your own empty factory opens the build list", () => {
    const { controller, built } = setup(["f."], [], [{ pos: P(0, 0), owner: 0 }]);
    controller.onConfirm(P(0, 0));
    expect(built.options?.[0]).toMatchObject({ type: "infantry", cost: 1000 });
  });

  it("clicking an enemy factory, a city or open ground doesn't", () => {
    const { controller, built } = setup(["fC."], [], [{ pos: P(0, 0), owner: 1 }, { pos: P(1, 0), owner: 0 }]);
    for (const tile of [P(0, 0), P(1, 0), P(2, 0)]) controller.onConfirm(tile);
    expect(built.options).toBeNull();
  });

  it("picking a unit closes the list and sends one build command", async () => {
    const { controller, built, seen, settle } = setup(["f."], [], [{ pos: P(0, 0), owner: 0 }]);
    controller.onConfirm(P(0, 0));
    built.pick?.("infantry");
    await settle();
    expect(built.options).toBeNull();
    expect(seen.commands).toEqual([{ type: "build", unitType: "infantry", pos: P(0, 0) }]);
  });

  it("cancel closes the build list", () => {
    const { controller, built } = setup(["f."], [], [{ pos: P(0, 0), owner: 0 }]);
    controller.onConfirm(P(0, 0));
    controller.onCancel();
    expect(built.options).toBeNull();
  });
});

describe("transport, supply and join", () => {
  const onto = async (game: ReturnType<typeof setup>, from: Point, to: Point) => {
    game.controller.onConfirm(from);
    game.controller.onConfirm(to);
    await game.settle();
  };

  it("moving onto your own Halftrack offers Load", async () => {
    const game = setup(["=="], [{ type: "infantry", owner: 0, pos: P(0, 0) }, { type: "halftrack", owner: 0, pos: P(1, 0) }]);
    await onto(game, P(0, 0), P(1, 0));
    expect(game.labels()).toEqual(["load", "cancel"]);
    game.controller.onMenuChoice("load");
    await game.settle();
    expect(game.seen.commands[0]).toMatchObject({ action: { type: "load" } });
  });

  it("moving onto a damaged unit of the same type offers Join", async () => {
    const game = setup(["=="], [{ type: "infantry", owner: 0, pos: P(0, 0) }, { type: "infantry", owner: 0, pos: P(1, 0), hp: 50 }]);
    await onto(game, P(0, 0), P(1, 0));
    expect(game.labels()).toEqual(["join", "cancel"]);
  });

  it("other friendly units can be passed through but not stopped on", async () => {
    const game = setup(["=="], [{ type: "infantry", owner: 0, pos: P(0, 0) }, { type: "mediumTank", owner: 0, pos: P(1, 0) }]);
    await onto(game, P(0, 0), P(1, 0));
    expect(game.labels()).toBeUndefined();
  });

  it("Unload lets you pick a highlighted tile", async () => {
    const game = setup(["==="], [{ type: "infantry", owner: 0, pos: P(0, 0) }, { type: "halftrack", owner: 0, pos: P(1, 0) }]);
    await onto(game, P(0, 0), P(1, 0));
    game.controller.onMenuChoice("load");
    await game.settle();
    await onto(game, P(1, 0), P(1, 0));
    expect(game.labels()).toEqual(["unload", "wait", "cancel"]);
    game.controller.onMenuChoice("unload");
    expect(game.seen.menu).toBeNull();
    expect(game.seen.ranges).toEqual([{ tiles: [P(2, 0), P(0, 0)], kind: "move" }]);
    game.controller.onConfirm(P(1, 0)); // not a highlighted tile: nothing happens
    expect(game.seen.commands).toHaveLength(1);
    game.controller.onConfirm(P(2, 0));
    await game.settle();
    expect(game.seen.commands[1]).toMatchObject({ action: { type: "unload", passenger: 0, to: P(2, 0) } });
  });

  it("cancelling Unload goes back to the action menu", async () => {
    const game = setup(["==="], [{ type: "infantry", owner: 0, pos: P(0, 0) }, { type: "halftrack", owner: 0, pos: P(1, 0) }]);
    await onto(game, P(0, 0), P(1, 0));
    game.controller.onMenuChoice("load");
    await game.settle();
    await onto(game, P(1, 0), P(1, 0));
    game.controller.onMenuChoice("unload");
    game.controller.onCancel();
    expect(game.labels()).toEqual(["unload", "wait", "cancel"]);
  });

  it("offers Supply next to a friendly unit that needs it", async () => {
    const game = setup(["===="], [{ type: "halftrack", owner: 0, pos: P(0, 0) }, { type: "mediumTank", owner: 0, pos: P(2, 0), ammo: 1 }]);
    await onto(game, P(0, 0), P(1, 0));
    expect(game.labels()).toEqual(["supply", "wait", "cancel"]);
  });
});

describe("after the game ends", () => {
  it("all input is ignored and the map is cleared", () => {
    const { controller, seen } = setup(["======"], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    controller.onConfirm(P(0, 0));
    expect(seen.ranges).toHaveLength(1);
    controller.finish();
    expect(seen.ranges).toEqual([]);
    expect(controller.busy).toBe(true);
    controller.onConfirm(P(0, 0));
    controller.onPeekStart(P(0, 0));
    expect(seen.ranges).toEqual([]);
  });

  it("a command that ends the game leaves input locked", async () => {
    const { controller, seen, settle } = setup([".C."], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    controller.onConfirm(P(0, 0));
    controller.onConfirm(P(1, 0));
    await settle();
    controller.onMenuChoice("wait");
    controller.finish(); // as main.ts does while the command is finishing
    await settle();
    expect(controller.busy).toBe(true);
    expect(seen.commands).toHaveLength(1);
  });
});

describe("hold X or right-click", () => {
  const units: UnitSetup[] = [
    { type: "infantry", owner: 0, pos: P(0, 0) },
    { type: "mediumTank", owner: 1, pos: P(5, 0) },
  ];

  it("shows your own unit's range until released", () => {
    const { controller, seen } = setup(["======"], units);
    controller.onPeekStart(P(0, 0));
    expect(seen.ranges.map((r) => r.kind)).toEqual(["inspect", "attack"]);
    expect(seen.ranges[1]?.tiles).toEqual([P(4, 0)]);
    controller.onPeekEnd();
    expect(seen.ranges).toEqual([]);
  });

  it("shows an enemy unit's range too", () => {
    const { controller, seen } = setup(["======"], units);
    controller.onPeekStart(P(5, 0));
    expect(seen.ranges[0]?.tiles.length).toBeGreaterThan(1);
  });

  it("does nothing on an empty tile", () => {
    const { controller, seen } = setup(["======"], units);
    controller.onPeekStart(P(2, 0));
    expect(seen.ranges).toEqual([]);
  });

  it("still cancels when a unit is selected, and doesn't then show a range", () => {
    const { controller, seen } = setup(["======"], units);
    controller.onConfirm(P(0, 0));
    expect(seen.ranges).toHaveLength(1);
    controller.onPeekStart(P(0, 0));
    expect(seen.ranges).toEqual([]);
  });

  it("still backs out of the action menu", async () => {
    const { controller, labels, seen, settle } = setup(["======"], units);
    controller.onConfirm(P(0, 0));
    controller.onConfirm(P(1, 0));
    await settle();
    controller.onPeekStart(P(1, 0));
    expect(labels()).toBeUndefined();
    expect(seen.ranges).toHaveLength(1); // back to the blue move range
  });

  it("releasing doesn't disturb a selection", () => {
    const { controller, seen } = setup(["======"], units);
    controller.onConfirm(P(0, 0));
    controller.onPeekEnd();
    expect(seen.ranges).toHaveLength(1);
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
