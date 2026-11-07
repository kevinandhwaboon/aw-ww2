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
    menuSelected: 0,
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
    openMenu: (_, items, selected = 0) => { seen.menu = items; seen.menuSelected = selected; },
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
    for (const tile of [P(0, 0), P(1, 0), P(2, 0)]) {
      controller.onConfirm(tile);
      controller.onCancel();
    }
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

describe("submarines (05-supply-transport §9)", () => {
  const endTurn = async (game: ReturnType<typeof setup>, emptyTile: Point) => {
    game.controller.onConfirm(emptyTile);
    game.controller.onMenuChoice("endTurn");
    await game.settle();
  };

  it("a surfaced submarine's menu offers Dive, and a submerged one's offers Surface", async () => {
    const game = setup(["SS."], [{ type: "submarine", owner: 0, pos: P(0, 0) }]);
    game.controller.onConfirm(P(0, 0));
    game.controller.onConfirm(P(1, 0));
    await game.settle();
    expect(game.labels()).toEqual(["dive", "wait", "cancel"]);
    game.controller.onMenuChoice("dive");
    await game.settle();
    expect(game.seen.commands[0]).toMatchObject({ path: [P(1, 0)], action: { type: "dive" } });

    await endTurn(game, P(2, 0));
    await endTurn(game, P(2, 0));
    game.controller.onConfirm(P(1, 0));
    game.controller.onConfirm(P(1, 0));
    await game.settle();
    expect(game.labels()).toEqual(["surface", "wait", "cancel"]);
  });

  it("other ships get neither", async () => {
    const game = setup(["SS"], [{ type: "destroyer", owner: 0, pos: P(0, 0) }]);
    game.controller.onConfirm(P(0, 0));
    game.controller.onConfirm(P(1, 0));
    await game.settle();
    expect(game.labels()).toEqual(["wait", "cancel"]);
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
    expect(seen.forecast).toEqual(["DMG 55%"]);
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

describe("attacking fortifications", () => {
  const nextToBunker = async (units: UnitSetup[] = [{ type: "assaultInfantry", owner: 0, pos: P(0, 0) }]) => {
    const game = setup(["==X"], units);
    game.controller.onConfirm(P(0, 0));
    game.controller.onConfirm(P(1, 0));
    await game.settle();
    return game;
  };

  it("offers Fire next to an empty bunker, even with no enemy around", async () => {
    expect((await nextToBunker()).labels()).toEqual(["fire", "wait", "cancel"]);
  });

  it("doesn't offer Fire to a unit with no weapon for it", async () => {
    expect((await nextToBunker([{ type: "recon", owner: 0, pos: P(0, 0) }])).labels()).toEqual(["wait", "cancel"]);
  });

  it("highlights the bunker and forecasts the damage, calling a kill a BREAK", async () => {
    const { controller, seen } = await nextToBunker();
    controller.onMenuChoice("fire");
    expect(seen.ranges).toEqual([{ tiles: [P(2, 0)], kind: "attack" }]);
    expect(seen.forecast).toEqual(["DMG 65%"]);
  });

  it("confirming sends an attackFort command", async () => {
    const { controller, seen, settle } = await nextToBunker();
    controller.onMenuChoice("fire");
    controller.onConfirm(P(2, 0));
    await settle();
    expect(seen.commands).toEqual([{ type: "move", unitId: 0, path: [P(1, 0)], action: { type: "attackFort", target: P(2, 0) } }]);
  });

  it("a unit stepping off a bunker can fire back at it", async () => {
    const game = setup(["=X"], [{ type: "assaultInfantry", owner: 0, pos: P(1, 0) }]);
    game.controller.onConfirm(P(1, 0));
    game.controller.onConfirm(P(0, 0));
    await game.settle();
    expect(game.labels()).toEqual(["fire", "wait", "cancel"]);
  });

  it("uses BREAK in place of KILL when the hit could destroy it", () => {
    const f = { weapon: "primary" as const, attack: { min: 65, max: 74 }, counter: null, canKill: true, certainKill: false, counterCanKill: false, counterCertainKill: false };
    expect(forecastLines(f, "BREAK")[0]).toBe("DMG 65-74% BREAK?");
  });
});

describe("turn menu (11-tech-setup §3c)", () => {
  const units: UnitSetup[] = [
    { type: "infantry", owner: 0, pos: P(0, 0) },
    { type: "infantry", owner: 1, pos: P(5, 0) },
  ];

  it("Z on an empty tile opens the menu with Resign, then End Turn highlighted last", () => {
    const { controller, seen, labels } = setup(["======"], units);
    controller.onConfirm(P(2, 0));
    expect(labels()).toEqual(["resign", "endTurn"]);
    expect(seen.menuSelected).toBe(1);
  });

  it("Z on an enemy unit opens the menu too", () => {
    const { controller, labels } = setup(["======"], units);
    controller.onConfirm(P(5, 0));
    expect(labels()).toEqual(["resign", "endTurn"]);
  });

  it("Z on your unit that has already moved opens the menu instead of selecting it", async () => {
    const { controller, seen, labels, settle } = setup(["======"], units);
    controller.onConfirm(P(0, 0));
    controller.onConfirm(P(1, 0));
    await settle();
    controller.onMenuChoice("wait");
    await settle();
    controller.onConfirm(P(1, 0));
    expect(labels()).toEqual(["resign", "endTurn"]);
    expect(seen.ranges).toEqual([]);
  });

  it("Z on your ready unit still selects it, with no menu", () => {
    const { controller, seen } = setup(["======"], units);
    controller.onConfirm(P(0, 0));
    expect(seen.menu).toBeNull();
    expect(seen.ranges[0]?.kind).toBe("move");
  });

  it("Z on your empty factory still opens the build list, with no menu", () => {
    const { controller, seen, built } = setup(["f."], [], [{ pos: P(0, 0), owner: 0 }]);
    controller.onConfirm(P(0, 0));
    expect(built.options).not.toBeNull();
    expect(seen.menu).toBeNull();
  });

  it("Z on your factory with a spent unit on it opens the menu", async () => {
    const { controller, built, labels, settle } = setup(["f."], [{ type: "infantry", owner: 0, pos: P(1, 0) }], [{ pos: P(0, 0), owner: 0 }]);
    controller.onConfirm(P(1, 0));
    controller.onConfirm(P(0, 0));
    await settle();
    controller.onMenuChoice("wait");
    await settle();
    controller.onConfirm(P(0, 0));
    expect(built.options).toBeNull();
    expect(labels()).toEqual(["resign", "endTurn"]);
  });

  it("End Turn sends one endTurn command and closes the menu", async () => {
    const { controller, seen, settle, getState } = setup(["======"], units);
    controller.onConfirm(P(2, 0));
    controller.onMenuChoice("endTurn");
    await settle();
    expect(seen.commands).toEqual([{ type: "endTurn" }]);
    expect(seen.menu).toBeNull();
    expect(getState().currentPlayer).toBe(1);
  });

  it("input is held until End Turn has finished playing", async () => {
    const { controller, seen, settle } = setup(["======"], units);
    controller.onConfirm(P(2, 0));
    controller.onMenuChoice("endTurn");
    expect(controller.busy).toBe(true);
    controller.onConfirm(P(2, 0));
    expect(seen.menu).toBeNull();
    await settle();
    expect(controller.busy).toBe(false);
  });

  it("cancel closes the menu without ending the turn", () => {
    const { controller, seen } = setup(["======"], units);
    controller.onConfirm(P(2, 0));
    controller.onCancel();
    expect(seen.menu).toBeNull();
    expect(seen.commands).toEqual([]);
  });

  it("Resign asks first, with Keep Playing highlighted", () => {
    const { controller, seen, labels } = setup(["======"], units);
    controller.onConfirm(P(2, 0));
    controller.onMenuChoice("resign");
    expect(labels()).toEqual(["keepPlaying", "resignNow"]);
    expect(seen.menuSelected).toBe(0);
    expect(seen.commands).toEqual([]);
  });

  it("Resign Now sends one resign command", async () => {
    const { controller, seen, settle, getState } = setup(["======"], units);
    controller.onConfirm(P(2, 0));
    controller.onMenuChoice("resign");
    controller.onMenuChoice("resignNow");
    await settle();
    expect(seen.commands).toEqual([{ type: "resign" }]);
    expect(getState().result?.reason).toBe("resign");
  });

  it("Keep Playing and cancel both go back to the menu, End Turn highlighted", () => {
    const { controller, seen, labels } = setup(["======"], units);
    controller.onConfirm(P(2, 0));
    for (const back of [() => controller.onMenuChoice("keepPlaying"), () => controller.onCancel()]) {
      controller.onMenuChoice("resign");
      back();
      expect(labels()).toEqual(["resign", "endTurn"]);
      expect(seen.menuSelected).toBe(1);
    }
  });

  it("Z outside a selected unit's range drops the selection without opening the menu", () => {
    const { controller, seen } = setup(["======"], units);
    controller.onConfirm(P(0, 0));
    controller.onConfirm(P(4, 0));
    expect(seen.menu).toBeNull();
    expect(seen.ranges).toEqual([]);
  });

  it("Z on another ready unit outside the range switches to it", () => {
    const { controller, seen } = setup(["======"], [
      { type: "infantry", owner: 0, pos: P(0, 0) },
      { type: "infantry", owner: 0, pos: P(5, 0) },
    ]);
    controller.onConfirm(P(0, 0));
    controller.onConfirm(P(5, 0));
    expect(seen.ranges[0]?.tiles).toContainEqual(P(5, 0));
    expect(seen.ranges[0]?.tiles).not.toContainEqual(P(0, 0));
  });

  it("the E shortcut ends the turn from any state, dropping a selection", async () => {
    const { controller, seen, settle } = setup(["======"], units);
    controller.onConfirm(P(0, 0));
    controller.endTurn();
    await settle();
    expect(seen.commands).toEqual([{ type: "endTurn" }]);
    expect(seen.ranges).toEqual([]);
  });
});

describe("enemy threat range", () => {
  it("holding X shows where an enemy can move and, in red, what it can hit beyond that", () => {
    const { controller, seen } = setup(["======"], [
      { type: "infantry", owner: 1, pos: P(0, 0) },
      { type: "mediumTank", owner: 0, pos: P(5, 0) },
    ]);
    controller.onPeekStart(P(0, 0));
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

  it("shows only the damage you'd deal, never the counter (03-combat §1)", () => {
    expect(forecastLines(base)).toEqual(["DMG 55-64%"]);
    expect(forecastLines({ ...base, counterCanKill: true, counterCertainKill: true })).toEqual(["DMG 55-64%"]);
  });

  it("flags a possible kill and a certain kill", () => {
    expect(forecastLines({ ...base, canKill: true })).toEqual(["DMG 55-64% KILL?"]);
    expect(forecastLines({ ...base, canKill: true, certainKill: true, counter: null })).toEqual(["DMG 55-64% KILL"]);
  });
});

describe("cursor limits (11-tech-setup §3c)", () => {
  const RIGHT = P(1, 0);
  const LEFT = P(-1, 0);
  const DOWN = P(0, 1);

  it("moves freely with nothing selected", () => {
    const { controller } = setup(["====="], []);
    expect(controller.nextCursor(P(1, 0), RIGHT)).toEqual(P(2, 0));
  });

  it("stops at the edge of a selected unit's move range", () => {
    const { controller } = setup(["========"], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    controller.onConfirm(P(0, 0));
    expect(controller.nextCursor(P(2, 0), RIGHT)).toEqual(P(3, 0));
    expect(controller.nextCursor(P(3, 0), RIGHT)).toEqual(P(3, 0)); // 3 move points
  });

  it("can't leave the map at the end of a row and wrap onto the next one", () => {
    const { controller } = setup(["==", "=="], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    controller.onConfirm(P(0, 0));
    expect(controller.nextCursor(P(1, 0), RIGHT)).toEqual(P(1, 0));
  });

  it("is held still while a unit walks", async () => {
    const { controller, settle } = setup(["===="], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    controller.onConfirm(P(0, 0));
    controller.onConfirm(P(1, 0));
    expect(controller.nextCursor(P(1, 0), RIGHT)).toEqual(P(1, 0));
    await settle();
  });

  const twoTargets = async () => {
    const game = setup(["===", "===", "==="], [
      { type: "mediumTank", owner: 0, pos: P(1, 1) },
      { type: "infantry", owner: 1, pos: P(1, 0) },
      { type: "infantry", owner: 1, pos: P(2, 1) },
    ]);
    game.controller.onConfirm(P(1, 1));
    game.controller.onConfirm(P(1, 1));
    await game.settle();
    game.controller.onMenuChoice("fire");
    return game;
  };

  it("while firing, arrows only step between the targets, in both directions", async () => {
    const { controller, seen } = await twoTargets();
    const first = seen.cursor ?? P(0, 0);
    const second = controller.nextCursor(first, RIGHT);
    expect(second).not.toEqual(first);
    expect(controller.nextCursor(second, DOWN)).toEqual(first);
    expect(controller.nextCursor(first, LEFT)).toEqual(second);
  });

  it("with one target, arrows leave the cursor on it", async () => {
    const { controller, seen, settle } = setup(["===="], [
      { type: "mediumTank", owner: 0, pos: P(0, 0) },
      { type: "infantry", owner: 1, pos: P(1, 0) },
    ]);
    controller.onConfirm(P(0, 0));
    controller.onConfirm(P(0, 0));
    await settle();
    controller.onMenuChoice("fire");
    expect(seen.cursor).toEqual(P(1, 0));
    expect(controller.nextCursor(P(1, 0), DOWN)).toEqual(P(1, 0));
  });

  it("cancelling Fire puts the cursor back on the unit, so it's inside the range again", async () => {
    const { controller, seen } = await twoTargets();
    controller.onCancel();
    expect(seen.cursor).toEqual(P(1, 1));
  });
});
