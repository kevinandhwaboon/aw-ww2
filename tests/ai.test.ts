import { describe, expect, it } from "vitest";
import { chooseCommand, greedyAi, scoreUnitCommands } from "../src/ai/greedy";
import { EASY_WEIGHTS, GREEDY_WEIGHTS, weightsFor } from "../src/ai/weights";
import { aiStep, COMMAND_LIMIT, makeView, playMatch, type AiPlayer } from "../src/ai/player";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import { baseDamage } from "../src/engine/data/damage";
import { UNITS, type UnitTypeId } from "../src/engine/data/units";
import { legalCommands } from "../src/engine/legal";
import type { Point } from "../src/engine/map";
import { createGame } from "../src/engine/setup";
import { propertyAt, type GameState, type Unit } from "../src/engine/state";
import { SCENARIOS } from "../src/scenarios";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const greedy = greedyAi();

/** The unit of this type and owner (there's only one in these scenarios). */
function find(state: GameState, type: Unit["type"], owner: number): Unit {
  const unit = state.units.find((u) => u.type === type && u.owner === owner);
  if (!unit) throw new Error(`no ${type} for player ${owner}`);
  return unit;
}

function destination(state: GameState, command: Command): Point | null {
  if (command.type !== "move") return null;
  return command.path[command.path.length - 1] ?? state.units.find((u) => u.id === command.unitId)?.pos ?? null;
}

/** Lets the Greedy AI play the current player's whole turn; returns the state and what it sent. */
/** Has every unit of the current player wait in place, so the next command is a build or End Turn. */
function waitAll(start: GameState): GameState {
  let state = start;
  for (const unit of start.units.filter((u) => u.owner === start.currentPlayer)) {
    const next = apply(state, { type: "move", unitId: unit.id, path: [], action: { type: "wait" } });
    if (next.ok) state = next.state;
  }
  return state;
}

/** Three infantry of ours, enough capture-capable units that building isn't forced to infantry. */
const threeInfantry = (y: number) => [1, 2, 3].map((x) => ({ type: "infantry" as const, owner: 0, pos: P(x, y) }));

/** What the AI builds next, once its units have acted. */
function nextBuild(state: GameState): UnitTypeId | null {
  const command = chooseCommand(waitAll(state));
  return command.type === "build" ? command.unitType : null;
}

async function playTurn(start: GameState): Promise<{ state: GameState; commands: Command[] }> {
  let state = start;
  const commands: Command[] = [];
  for (let sent = 0; ; sent++) {
    const step = await aiStep(state, greedy, sent);
    expect(step.bug).toBeNull();
    commands.push(step.command);
    state = step.state;
    if (step.command.type === "endTurn") return { state, commands };
  }
}

describe("the AI interface (09-ai §2–3)", () => {
  it("an AI sees the whole game except the luck generator, so it can't predict luck rolls", () => {
    const state = makeGame(["...."], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    const view = makeView(state);
    expect(view.state.rng).not.toBe(state.rng);
    expect({ ...view.state, rng: state.rng }).toEqual(state);
    expect(view.me).toBe(0);
  });

  it("an AI is offered exactly the commands a human could send, ending with End Turn", () => {
    const state = makeGame(["f..."], [{ type: "infantry", owner: 0, pos: P(1, 0) }], {
      propertyOwners: [{ pos: P(0, 0), owner: 0 }],
    });
    const commands = makeView(state).legalCommands();
    expect(commands.at(-1)).toEqual({ type: "endTurn" });
    for (const command of commands) expect(apply(state, command).ok).toBe(true);
  });

  it("an AI that sends a rejected command has its turn ended, and it's reported as an AI bug", async () => {
    const state = makeGame(["...."], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    const broken: AiPlayer = { name: "Broken", chooseCommand: () => ({ type: "move", unitId: 99, path: [], action: { type: "wait" } }) };
    const step = await aiStep(state, broken, 0);
    expect(step.command).toEqual({ type: "endTurn" });
    expect(step.state.currentPlayer).toBe(1);
    expect(step.bug).toMatch(/rejected/);
  });

  it("an AI that crashes has its turn ended, and it's reported as an AI bug", async () => {
    const state = makeGame(["...."], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    const crashing: AiPlayer = { name: "Crashing", chooseCommand: () => { throw new Error("oops"); } };
    const step = await aiStep(state, crashing, 0);
    expect(step.state.currentPlayer).toBe(1);
    expect(step.bug).toMatch(/oops/);
  });

  it(`an AI that sends ${COMMAND_LIMIT} commands in one turn without ending it has its turn ended for it`, async () => {
    const state = makeGame(["...."], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    const step = await aiStep(state, greedy, COMMAND_LIMIT);
    expect(step.command).toEqual({ type: "endTurn" });
    expect(step.bug).toMatch(/without ending its turn/);
  });
});

describe("the Greedy AI (09-ai §4)", () => {
  it("takes a free kill", () => {
    const state = makeGame(["....."], [
      { type: "infantry", owner: 0, pos: P(0, 0) },
      { type: "infantry", owner: 1, pos: P(3, 0), hp: 10 },
    ]);
    const target = find(state, "infantry", 1);
    expect(chooseCommand(state)).toMatchObject({ type: "move", action: { type: "attack", target: target.id } });
  });

  it("hits the more expensive of two targets", () => {
    const state = makeGame([".....", ".....", "....."], [
      { type: "mediumTank", owner: 0, pos: P(2, 1) },
      { type: "infantry", owner: 1, pos: P(0, 0) },
      { type: "artillery", owner: 1, pos: P(4, 2) },
    ]);
    const artillery = find(state, "artillery", 1);
    expect(chooseCommand(state)).toMatchObject({ action: { type: "attack", target: artillery.id } });
  });

  it("doesn't attack when the trade is clearly bad: infantry leaves a Heavy Tank alone", () => {
    const state = makeGame([".....", ".....", "....."], [
      { type: "infantry", owner: 0, pos: P(1, 1) },
      { type: "heavyTank", owner: 1, pos: P(2, 1) },
    ]);
    const command = chooseCommand(state);
    expect(command.type === "move" && command.action.type).not.toBe("attack");
  });

  it("captures an undefended HQ and wins the game", async () => {
    const state = makeGame(["Q....Q"], [{ type: "infantry", owner: 0, pos: P(3, 0) }], {
      propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(5, 0), owner: 1 }],
    });
    const result = await playMatch(state, [greedy, greedy], 10);
    expect(result.bugs).toEqual([]);
    expect(result.state.result).toMatchObject({ winners: [0], reason: "hqCapture" });
  });

  it("sends capturers to different properties rather than all to the same one", async () => {
    const state = makeGame(["C.....C", ".......", "Q.....Q"], [
      { type: "infantry", owner: 0, pos: P(3, 0) },
      { type: "infantry", owner: 0, pos: P(3, 2) },
    ], { propertyOwners: [{ pos: P(0, 2), owner: 1 }, { pos: P(6, 2), owner: 1 }] });
    const { state: after } = await playTurn(state);
    const capturing = after.properties.filter((p) => p.capturingUnit !== null || p.owner === 0);
    expect(capturing.length).toBe(2);
  });

  it("retreats to a property it owns for repairs at 3 HP or less", () => {
    const state = makeGame(["C.....", "......", "......"], [
      { type: "mediumTank", owner: 0, pos: P(4, 1), hp: 30 },
      { type: "infantry", owner: 1, pos: P(5, 2) },
    ], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    expect(destination(state, chooseCommand(state))).toEqual(P(0, 0));
  });

  it("an aircraft low on fuel heads back to its airfield", () => {
    const state = makeGame(["A.........", ".........."], [
      { type: "fighter", owner: 0, pos: P(9, 1), fuel: 20 },
      { type: "fighter", owner: 1, pos: P(9, 0) },
    ], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    expect(destination(state, chooseCommand(state))?.x).toBeLessThan(9);
  });

  it("an infantry squad far from any property boards a ready Halftrack, which carries it forward", async () => {
    const state = makeGame(["=================C"], [
      { type: "infantry", owner: 0, pos: P(0, 0) },
      { type: "halftrack", owner: 0, pos: P(1, 0) },
    ]);
    const { commands, state: after } = await playTurn(state);
    expect(commands.some((c) => c.type === "move" && c.action.type === "load")).toBe(true);
    const halftrack = find(after, "halftrack", 0);
    const infantry = after.units.find((u) => u.type === "infantry") ?? halftrack.cargo[0];
    expect(infantry?.pos.x).toBeGreaterThan(3);
  });

  it("builds capture-capable infantry first when it has too few units that can capture", () => {
    const state = makeGame(["f...C"], [{ type: "mediumTank", owner: 1, pos: P(3, 0) }], {
      players: [{ name: "Allies", nation: "us", funds: 20000 }, { name: "Axis", nation: "germany" }],
      propertyOwners: [{ pos: P(0, 0), owner: 0 }],
    });
    const command = chooseCommand(state);
    expect(command).toMatchObject({ type: "build", pos: P(0, 0) });
    expect(command.type === "build" && UNITS[command.unitType].canCapture).toBe(true);
  });

  it("with enough infantry, builds what hits the enemy's army hardest: anti-tank against Heavy Tanks", () => {
    const state = makeGame(["f.....", "......"], [
      { type: "infantry", owner: 0, pos: P(1, 1), hp: 100 },
      { type: "infantry", owner: 0, pos: P(2, 1) },
      { type: "infantry", owner: 0, pos: P(3, 1) },
      { type: "heavyTank", owner: 1, pos: P(5, 0) },
      { type: "heavyTank", owner: 1, pos: P(5, 1) },
    ], {
      players: [{ name: "Allies", nation: "us", funds: 20000 }, { name: "Axis", nation: "germany" }],
      propertyOwners: [{ pos: P(0, 0), owner: 0 }],
    });
    let current = state;
    for (const unit of state.units.filter((u) => u.owner === 0)) {
      const next = apply(current, { type: "move", unitId: unit.id, path: [], action: { type: "wait" } });
      if (next.ok) current = next.state;
    }
    const command = chooseCommand(current);
    expect(command.type).toBe("build");
    if (command.type !== "build") return;
    expect(UNITS[command.unitType].canCapture).toBe(false);
    expect(baseDamage(command.unitType, "heavyTank")?.base ?? 0).toBeGreaterThanOrEqual(50);
  });

  it("with no stranded units to collect, a Landing Craft stays where it is and none is built", () => {
    const state = makeGame(["P.SSS", "SSSSS"], [{ type: "landingCraft", owner: 0, pos: P(2, 0) }], {
      players: [{ name: "Allies", nation: "us", funds: 50000, buildable: ["landingCraft"] }, { name: "Axis", nation: "germany" }],
      propertyOwners: [{ pos: P(0, 0), owner: 0 }],
    });
    expect(chooseCommand(state)).toMatchObject({ type: "move", path: [], action: { type: "wait" } });
    const after = apply(state, { type: "move", unitId: 0, path: [], action: { type: "wait" } });
    expect(after.ok && chooseCommand(after.state)).toEqual({ type: "endTurn" });
  });

  it("every command it sends is legal (09-ai §1)", () => {
    const state = makeGame(["f.C.F.=.C", ".F.ob..C.", "C..HX=.F.", ".=.C..F.f"], [
      { type: "infantry", owner: 0, pos: P(1, 0) },
      { type: "mediumTank", owner: 0, pos: P(0, 1) },
      { type: "artillery", owner: 0, pos: P(1, 1) },
      { type: "halftrack", owner: 0, pos: P(2, 1) },
      { type: "infantry", owner: 1, pos: P(7, 3) },
      { type: "lightTank", owner: 1, pos: P(8, 2) },
    ], { propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(8, 3), owner: 1 }] });
    let current = state;
    for (let i = 0; i < 200 && !current.result; i++) {
      const command = chooseCommand(current);
      expect(legalCommands(current)).toContainEqual(command);
      const result = apply(current, command);
      if (!result.ok) throw new Error(result.message);
      current = result.state;
    }
  });
});

describe("Greedy v2: threat-aware production (09-ai §4a)", () => {
  const rich = { players: [{ name: "Allies", nation: "us" as const, funds: 30000 }, { name: "Axis", nation: "germany" as const }] };
  const ownFactory = { propertyOwners: [{ pos: P(0, 0), owner: 0 }] };
  const wide = (rows: number) => Array.from({ length: rows }, (_, y) => (y === 0 ? "f" : ".") + ".".repeat(23));

  it("builds anti-air when an enemy Bomber is near its factory, even with six Heavy Tanks far away", () => {
    const state = makeGame(wide(3), [
      ...threeInfantry(2),
      { type: "bomber", owner: 1, pos: P(4, 0) },
      ...[0, 1, 2].flatMap((y) => [22, 23].map((x) => ({ type: "heavyTank" as const, owner: 1, pos: P(x, y) }))),
    ], { ...rich, ...ownFactory });
    const built = nextBuild(state);
    expect(built).not.toBeNull();
    expect(baseDamage(built ?? "infantry", "bomber")?.base ?? 0).toBeGreaterThanOrEqual(50);
  });

  it("a threat near the factory counts more than one far away: a Heavy Tank on the doorstep beats a distant Bomber", () => {
    const state = makeGame(wide(3), [
      ...threeInfantry(2),
      { type: "heavyTank", owner: 1, pos: P(4, 0) },
      { type: "bomber", owner: 1, pos: P(23, 2) },
    ], { ...rich, ...ownFactory });
    const built = nextBuild(state);
    expect(baseDamage(built ?? "infantry", "heavyTank")?.base ?? 0).toBeGreaterThanOrEqual(50);
  });

  it("doesn't build anti-air for a Bomber that two Mobile AA by the factory already cover: it answers the tank instead", () => {
    const units = [
      ...threeInfantry(2),
      { type: "bomber" as const, owner: 1, pos: P(5, 0) },
      { type: "mediumTank" as const, owner: 1, pos: P(6, 1) },
    ];
    const uncovered = nextBuild(makeGame(wide(3), units, { ...rich, ...ownFactory }));
    expect(baseDamage(uncovered ?? "infantry", "bomber")?.base ?? 0).toBeGreaterThanOrEqual(50);

    const twoMobileAA = [P(1, 1), P(0, 1)].map((pos) => ({ type: "mobileAA" as const, owner: 0, pos }));
    const covered = nextBuild(makeGame(wide(3), [...units, ...twoMobileAA], { ...rich, ...ownFactory }));
    expect(covered).not.toBeNull();
    expect(baseDamage(covered ?? "infantry", "bomber")).toBeNull();
    expect(baseDamage(covered ?? "infantry", "mediumTank")?.base ?? 0).toBeGreaterThanOrEqual(50);
  });

  it("a port only builds ships against enemies it can reach by sea: none from a lake", () => {
    // Our port at the right end; the enemy Destroyer sails the sea on the left.
    const lake = ["SSSS..............PS", "SSSS...............S"];
    const open = ["SSSSSSSSSSSSSSSSSSPS", "SSSS...............S"];
    const setup = { ...rich, propertyOwners: [{ pos: P(18, 0), owner: 0 }] };
    const destroyer = [{ type: "destroyer" as const, owner: 1, pos: P(0, 0) }];
    expect(chooseCommand(makeGame(lake, destroyer, setup))).toEqual({ type: "endTurn" });
    expect(chooseCommand(makeGame(open, destroyer, setup))).toMatchObject({ type: "build", pos: P(18, 0) });
  });

  it("a factory an enemy could reach soon always builds something, even when nothing trades well", () => {
    const infantryOnly = { players: [{ name: "Allies", nation: "us" as const, funds: 30000, buildable: ["infantry" as const] }, { name: "Axis", nation: "germany" as const }] };
    const far = makeGame(wide(3), [...threeInfantry(2), { type: "heavyTank", owner: 1, pos: P(23, 0) }], { ...infantryOnly, ...ownFactory });
    expect(nextBuild(far)).toBeNull();
    const near = makeGame(wide(3), [...threeInfantry(2), { type: "heavyTank", owner: 1, pos: P(5, 0) }], { ...infantryOnly, ...ownFactory });
    expect(nextBuild(near)).toBe("infantry");
  });

  it("with plenty of funds and one factory, buys a strong unit rather than the cheapest", () => {
    const state = makeGame(wide(3), [
      ...threeInfantry(2),
      { type: "mediumTank", owner: 1, pos: P(23, 0) },
      { type: "mediumTank", owner: 1, pos: P(23, 1) },
    ], { players: [{ name: "Allies", nation: "us", funds: 50000 }, { name: "Axis", nation: "germany" }], ...ownFactory });
    const built = nextBuild(state);
    expect(built).not.toBeNull();
    expect(UNITS[built ?? "infantry"].cost).toBeGreaterThanOrEqual(6000);
  });

  it("moves a unit off its own factory so it can build there", () => {
    const state = makeGame(["f....", "....."], [
      { type: "infantry", owner: 0, pos: P(0, 0) },
      { type: "infantry", owner: 1, pos: P(1, 0), hp: 40 },
    ], ownFactory);
    const command = chooseCommand(state);
    expect(command).toMatchObject({ type: "move", action: { type: "attack" } });
    expect(destination(state, command)).not.toEqual(P(0, 0));
  });
});

describe("Greedy v2: landings, drops and carriers (09-ai §4b)", () => {
  const twoIslands = ["..._SSSS_..Q", "..._SSSS_..."];
  const enemyHq = { propertyOwners: [{ pos: P(11, 0), owner: 1 }] };
  const unloads = (commands: readonly Command[]) => commands.flatMap((c) => (c.type === "move" && c.action.type === "unload" ? [c.action] : []));

  it("a stranded infantry squad boards a Landing Craft, is carried across and landed, and takes the enemy HQ", async () => {
    const state = makeGame(twoIslands, [
      { type: "infantry", owner: 0, pos: P(0, 0) },
      { type: "landingCraft", owner: 0, pos: P(5, 1) },
    ], enemyHq);
    const result = await playMatch(state, [greedy, greedy], 12);
    expect(result.bugs).toEqual([]);
    expect(result.state.result).toMatchObject({ winners: [0], reason: "hqCapture" });
  });

  it("a Landing Craft waits for a second unit that can reach it soon, then lands both in one action", async () => {
    const state = makeGame(twoIslands, [
      { type: "infantry", owner: 0, pos: P(2, 0) },
      { type: "infantry", owner: 0, pos: P(0, 1) },
      { type: "landingCraft", owner: 0, pos: P(3, 0) },
    ], enemyHq);
    const dayOne = await playMatch(state, [greedy, greedy], 1);
    const waitingCraft = find(dayOne.state, "landingCraft", 0);
    expect(waitingCraft.pos).toEqual(P(3, 0));
    expect(waitingCraft.cargo.length).toBe(1);

    const later = await playMatch(state, [greedy, greedy], 8);
    expect(later.bugs).toEqual([]);
    expect(unloads(later.commands).some((u) => u.second !== undefined)).toBe(true);
    expect(later.state.units.filter((u) => u.type === "infantry" && u.pos.x >= 9).length).toBe(2);
  });

  it("a unit with something still to do on its own island doesn't board", async () => {
    const state = makeGame(["C.._SSSS_..Q", "..._SSSS_..."], [
      { type: "infantry", owner: 0, pos: P(2, 0) },
      { type: "landingCraft", owner: 0, pos: P(3, 0) },
    ], enemyHq);
    const { commands } = await playTurn(state);
    expect(commands.some((c) => c.type === "move" && c.action.type === "load")).toBe(false);
  });

  it("builds a Landing Craft at its port when its troops have no way across by land, and not when they can walk", () => {
    const setup = { players: [{ name: "Allies", nation: "us" as const, funds: 30000 }, { name: "Axis", nation: "germany" as const }], propertyOwners: [{ pos: P(3, 0), owner: 0 }, { pos: P(11, 0), owner: 1 }] };
    const troops = [0, 1, 2].map((x) => ({ type: "infantry" as const, owner: 0, pos: P(x, 1) }));
    expect(nextBuild(makeGame(["...PSSSS_..Q", "..._SSSS_..."], troops, setup))).toBe("landingCraft");
    expect(nextBuild(makeGame(["...PSSSS_..Q", "............"], troops, setup))).not.toBe("landingCraft");
  });

  it("keeps its funds for a Landing Craft it can't afford yet, rather than spending them at the factory", () => {
    const setup = { players: [{ name: "Allies", nation: "us" as const, funds: 9000 }, { name: "Axis", nation: "germany" as const }], propertyOwners: [{ pos: P(3, 0), owner: 0 }, { pos: P(0, 0), owner: 0 }, { pos: P(11, 0), owner: 1 }] };
    const troops = [0, 1, 2].map((x) => ({ type: "infantry" as const, owner: 0, pos: P(x, 1) }));
    const state = makeGame(["f..PSSSS_..Q", "..._SSSS_..."], [...troops, { type: "mediumTank", owner: 1, pos: P(10, 1) }], setup);
    expect(nextBuild(state)).toBeNull();
  });

  it("builds an army to ship overseas: with Landing Craft enough, the factory answers enemy tanks across the water", () => {
    const setup = { players: [{ name: "Allies", nation: "us" as const, funds: 20000 }, { name: "Axis", nation: "germany" as const }], propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(11, 0), owner: 1 }] };
    const state = makeGame(["f.._SSSS_..Q", "..._SSSS_..."], [
      ...[0, 1, 2].map((x) => ({ type: "infantry" as const, owner: 0, pos: P(x, 1) })),
      { type: "landingCraft", owner: 0, pos: P(4, 0) },
      { type: "landingCraft", owner: 0, pos: P(4, 1) },
      { type: "mediumTank", owner: 1, pos: P(10, 0) },
      { type: "mediumTank", owner: 1, pos: P(10, 1) },
    ], setup);
    const built = nextBuild(state);
    expect(built).not.toBeNull();
    expect(UNITS[built ?? "infantry"].category).toBe("land");
    expect(baseDamage(built ?? "infantry", "mediumTank")?.base ?? 0).toBeGreaterThanOrEqual(50);
  });

  it("infantry boards a Transport Aircraft at its airfield, is dropped beside the enemy HQ and takes it", async () => {
    const state = makeGame(["A...SSSS...Q", "....SSSS...."], [
      { type: "infantry", owner: 0, pos: P(1, 0) },
      { type: "transportAircraft", owner: 0, pos: P(0, 0) },
    ], { propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(11, 0), owner: 1 }] });
    const result = await playMatch(state, [greedy, greedy], 8);
    expect(result.bugs).toEqual([]);
    expect(result.state.result).toMatchObject({ winners: [0], reason: "hqCapture" });
    expect(unloads(result.commands).length).toBe(1);
  });

  it("builds a Transport Aircraft at its airfield for infantry cut off by water, when it has none", () => {
    const setup = { players: [{ name: "Allies", nation: "us" as const, funds: 30000 }, { name: "Axis", nation: "germany" as const }], propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(11, 0), owner: 1 }] };
    const troops = [1, 2, 3].map((x) => ({ type: "infantry" as const, owner: 0, pos: P(x, 1) }));
    expect(nextBuild(makeGame(["A...SSSS...Q", "....SSSS...."], troops, setup))).toBe("transportAircraft");
    const withOne = [...troops, { type: "transportAircraft" as const, owner: 0, pos: P(3, 0) }];
    expect(nextBuild(makeGame(["A...SSSS...Q", "....SSSS...."], withOne, setup))).not.toBe("transportAircraft");
  });

  it("an aircraft heads home while it still has fuel for the trip, counting the daily burn on the way", () => {
    // 18 tiles from its airfield: 36 fuel to fly, plus 2 days' burn of 5. With 55 it must turn back now.
    const state = makeGame(["A" + ".".repeat(39)], [
      { type: "fighter", owner: 0, pos: P(18, 0), fuel: 55 },
      { type: "fighter", owner: 1, pos: P(39, 0) },
    ], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    expect(destination(state, chooseCommand(state))?.x).toBeLessThan(18);
  });

  it("a ship doesn't sail on past the point it could still get home from", () => {
    // 14 tiles from port with 30 fuel: 4 more tiles out still leaves enough to return, 5 doesn't.
    const state = makeGame(["P" + "S".repeat(39)], [
      { type: "torpedoBoat", owner: 0, pos: P(14, 0), fuel: 30 },
      { type: "destroyer", owner: 1, pos: P(39, 0) },
    ], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    const x = destination(state, chooseCommand(state))?.x ?? 99;
    expect(x).toBeGreaterThan(14);
    expect(x).toBeLessThanOrEqual(18);
  });

  const sea = (width: number) => ["S".repeat(width), "S".repeat(width), "S".repeat(width)];
  const carrier = (pos: Point) => ({ type: "carrier" as const, owner: 0, pos, cargo: [{ type: "torpedoBomber" as const }] });

  it("a Carrier launches its Torpedo Bomber at an enemy Battleship within reach", () => {
    const state = makeGame(sea(10), [carrier(P(0, 1)), { type: "battleship", owner: 1, pos: P(5, 1) }]);
    const battleship = find(state, "battleship", 1);
    expect(chooseCommand(state)).toMatchObject({ type: "launch", action: { type: "attack", target: battleship.id } });
  });

  it("with nothing in reach it keeps its aircraft aboard and the Carrier sails closer, stopping short of the enemy", async () => {
    const state = makeGame(sea(24), [carrier(P(0, 1)), { type: "battleship", owner: 1, pos: P(23, 1) }]);
    const { commands, state: after } = await playTurn(state);
    expect(commands.some((c) => c.type === "launch")).toBe(false);
    const moved = find(after, "carrier", 0);
    expect(moved.pos.x).toBeGreaterThan(0);
    expect(moved.cargo.length).toBe(1);
  });

  it("an aircraft out of ammo lands on a Carrier with room", () => {
    const state = makeGame(sea(24), [
      { type: "torpedoBomber", owner: 0, pos: P(4, 1), ammo: 0 },
      { type: "carrier", owner: 0, pos: P(1, 1) },
      { type: "battleship", owner: 1, pos: P(23, 1) },
    ]);
    const command = chooseCommand(state);
    expect(command).toMatchObject({ type: "move", action: { type: "load" } });
    expect(destination(state, command)).toEqual(P(1, 1));
  });
});

describe("Greedy v3: coordination, fuel and difficulty (09-ai §4c)", () => {
  /** The score of this unit's attack on that target from where it stands. */
  const attackScore = (state: GameState, unit: Unit, targetId: number, weights = GREEDY_WEIGHTS) =>
    scoreUnitCommands(state, unit, weights).find((c) => c.command.path.length === 0 && c.command.action.type === "attack" && c.command.action.target === targetId)?.score ?? NaN;
  /** The score of this unit moving to that tile and waiting. */
  const waitScore = (state: GameState, unit: Unit, to: Point, weights = GREEDY_WEIGHTS) =>
    scoreUnitCommands(state, unit, weights).find((c) => c.command.action.type === "wait" && (c.command.path.at(-1) ?? unit.pos).x === to.x && (c.command.path.at(-1) ?? unit.pos).y === to.y)?.score ?? NaN;
  const acted = (state: GameState, id: number): GameState => ({ ...state, units: state.units.map((u) => (u.id === id ? { ...u, hasActed: true } : u)) });

  it("focus fire: hitting a unit is worth more when a friend who hasn't acted yet could finish it off", () => {
    const state = makeGame([".....", "....."], [
      { type: "infantry", owner: 0, pos: P(1, 0) },
      { type: "mediumTank", owner: 0, pos: P(1, 1) },
      { type: "infantry", owner: 1, pos: P(2, 0), hp: 60 },
    ], { settings: { luck: false } });
    const [infantry, tank, target] = state.units;
    if (!infantry || !tank || !target) throw new Error("setup");
    const together = attackScore(state, infantry, target.id);
    const alone = attackScore(acted(state, tank.id), infantry, target.id);
    expect(together - alone).toBeCloseTo(GREEDY_WEIGHTS.focusKillBonus * UNITS.infantry.cost);
  });

  it("artillery fires before a tank moves in, though the tank is the more valuable unit", () => {
    const state = makeGame(["......", "......"], [
      { type: "mediumTank", owner: 0, pos: P(1, 0) },
      { type: "artillery", owner: 0, pos: P(1, 1) },
      { type: "mediumTank", owner: 1, pos: P(4, 1) },
    ]);
    const first = chooseCommand(state);
    expect(first).toMatchObject({ type: "move", unitId: find(state, "artillery", 0).id, action: { type: "attack" } });
    const easyFirst = chooseCommand(state, EASY_WEIGHTS);
    expect(easyFirst).toMatchObject({ type: "move", unitId: find(state, "mediumTank", 0).id });
  });

  it("the look ahead: ending a move where the enemy can fire next turn costs a tenth of what the unit stands to lose there", () => {
    // The enemy Medium Tank at x=14 can reach x=8 and fire on x=7. Our artillery at x=5 can move to x=7 or stay back at x=6.
    // Road all the way, so no terrain stars soften the hit.
    const state = makeGame(["==============="], [
      { type: "artillery", owner: 0, pos: P(5, 0) },
      { type: "mediumTank", owner: 1, pos: P(14, 0) },
    ], { settings: { luck: false } });
    const artillery = find(state, "artillery", 0);
    const blind = { ...GREEDY_WEIGHTS, dangerWeight: 0 };
    expect(waitScore(state, artillery, P(6, 0))).toBeCloseTo(waitScore(state, artillery, P(6, 0), blind));
    const hit = baseDamage("mediumTank", "artillery")?.base ?? 0;
    const expected = GREEDY_WEIGHTS.dangerWeight * (hit / 100) * UNITS.artillery.cost;
    expect(waitScore(state, artillery, P(7, 0), blind) - waitScore(state, artillery, P(7, 0))).toBeCloseTo(expected);
  });

  it("a Torpedo Boat doesn't sail past the point of no return to hit a ship worth no more than itself", () => {
    // 14 tiles from port with 30 fuel, and an enemy Torpedo Boat 6 tiles further out.
    const state = makeGame(["P" + "S".repeat(39)], [
      { type: "torpedoBoat", owner: 0, pos: P(14, 0), fuel: 30 },
      { type: "torpedoBoat", owner: 1, pos: P(21, 0) },
    ], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    const command = chooseCommand(state);
    expect(command.type === "move" && command.action.type).not.toBe("attack");
    const reckless = chooseCommand(state, { ...GREEDY_WEIGHTS, noReturnOwnValue: 0, noReturnPenalty: 0 });
    expect(reckless).toMatchObject({ type: "move", action: { type: "attack" } });
  });

  it("a ship low on fuel still moves toward its port, even with none to spare", () => {
    const state = makeGame(["P" + "S".repeat(39)], [
      { type: "torpedoBoat", owner: 0, pos: P(9, 0), fuel: 13 },
      { type: "destroyer", owner: 1, pos: P(39, 0) },
    ], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    expect(destination(state, chooseCommand(state))?.x).toBeLessThan(9);
  });

  it("a port isn't built on while one of our ships is coming in to it for fuel", () => {
    const setup = { players: [{ name: "Allies", nation: "us" as const, funds: 30000 }, { name: "Axis", nation: "germany" as const }], propertyOwners: [{ pos: P(0, 0), owner: 0 }] };
    const units = (fuel: number) => [
      { type: "torpedoBoat" as const, owner: 0, pos: P(6, 0), fuel },
      { type: "destroyer" as const, owner: 1, pos: P(12, 0) },
    ];
    expect(nextBuild(makeGame(["P" + "S".repeat(12)], units(8), setup))).toBeNull();
    expect(nextBuild(makeGame(["P" + "S".repeat(12)], units(50), setup))).not.toBeNull();
  });

  it("an empty Landing Craft goes into our own port to collect stranded units", async () => {
    const state = makeGame(["..PSSSSS_..Q", "...SSSSS_..."], [
      { type: "infantry", owner: 0, pos: P(1, 0) },
      { type: "landingCraft", owner: 0, pos: P(4, 0) },
    ], { propertyOwners: [{ pos: P(2, 0), owner: 0 }, { pos: P(11, 0), owner: 1 }] });
    const { state: after } = await playTurn(state);
    const craft = find(after, "landingCraft", 0);
    expect(craft.pos).toEqual(P(2, 0));
  });

  it("a loaded Landing Craft nearer its landing than its port lands its troops rather than turning back for fuel", () => {
    // 3 tiles from the beach and 20 from port, with 15 fuel: not enough to land and get home, enough to land.
    const state = makeGame(["P" + "S".repeat(22) + "_.Q"], [
      { type: "landingCraft", owner: 0, pos: P(20, 0), fuel: 15, cargo: [{ type: "infantry" }] },
    ], { propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(25, 0), owner: 1 }] });
    const command = chooseCommand(state);
    expect(command).toMatchObject({ type: "move", action: { type: "unload", to: P(24, 0) } });
  });

  it("a Transport Aircraft doesn't take on infantry, and isn't built, for a drop it couldn't fly back from", async () => {
    const far = ["A." + "S".repeat(56) + ".Q", ".." + "S".repeat(56) + ".."];
    const setup = { players: [{ name: "Allies", nation: "us" as const, funds: 30000 }, { name: "Axis", nation: "germany" as const }], propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(59, 0), owner: 1 }] };
    const waiting = makeGame(far, [{ type: "infantry", owner: 0, pos: P(1, 0) }, { type: "transportAircraft", owner: 0, pos: P(0, 0) }], setup);
    const { commands } = await playTurn(waiting);
    expect(commands.some((c) => c.type === "move" && c.action.type === "load")).toBe(false);
    const troops = [P(1, 0), P(1, 1), P(0, 1)].map((pos) => ({ type: "infantry" as const, owner: 0, pos }));
    expect(nextBuild(makeGame(far, troops, setup))).not.toBe("transportAircraft");
  });

  const islands = ["...._SSSSS_..Q", "...._SSSSS_...", "...._SSSSS_..."];
  const enemyHq = { propertyOwners: [{ pos: P(13, 0), owner: 1 }] };

  it("massed landings: a loaded Landing Craft waits while another beside it is still loading, and they leave together", async () => {
    const state = makeGame(islands, [
      { type: "landingCraft", owner: 0, pos: P(4, 0), cargo: [{ type: "infantry" }, { type: "infantry" }] },
      { type: "landingCraft", owner: 0, pos: P(4, 2), cargo: [{ type: "infantry" }] },
      { type: "infantry", owner: 0, pos: P(0, 2) },
    ], enemyHq);
    const full = state.units.find((u) => u.cargo.length === 2);
    if (!full) throw new Error("setup");
    const dayOne = await playMatch(state, [greedy, greedy], 1);
    expect(dayOne.state.units.find((u) => u.id === full.id)?.pos).toEqual(P(4, 0));
    const dayTwo = await playMatch(state, [greedy, greedy], 2);
    const craft = dayTwo.state.units.filter((u) => u.type === "landingCraft");
    expect(craft.every((c) => c.pos.x > 4)).toBe(true);

    const easy = greedyAi(EASY_WEIGHTS);
    const alone = await playMatch(state, [easy, easy], 1);
    expect(alone.state.units.find((u) => u.id === full.id)?.pos.x).toBeGreaterThan(4);
  });

  it("escorts: a Destroyer with nothing to shoot nearby sails with a loaded Landing Craft, not off to a distant enemy", () => {
    const state = makeGame(["S".repeat(30), "S".repeat(30), "_".repeat(29) + "Q"], [
      { type: "landingCraft", owner: 0, pos: P(3, 0), cargo: [{ type: "infantry" }] },
      { type: "destroyer", owner: 0, pos: P(3, 1) },
      { type: "torpedoBoat", owner: 1, pos: P(29, 0) },
    ], { propertyOwners: [{ pos: P(29, 2), owner: 1 }] });
    const destroyer = find(state, "destroyer", 0);
    const best = scoreUnitCommands(state, destroyer)[0]?.command;
    const unescorted = scoreUnitCommands(state, destroyer, { ...GREEDY_WEIGHTS, escortsPerCraft: 0 })[0]?.command;
    // The craft makes for the beach along the bottom row, and its escort keeps to the row beside it;
    // without the escort rule the Destroyer heads along the top row for the enemy boat.
    expect(best && destination(state, best)?.y).toBe(1);
    expect(unescorted && destination(state, unescorted)?.y).toBe(0);
  });

  it("a garrison of two stays on the HQ's island when the enemy could invade, and nobody stays when it can't", async () => {
    const map = ["Q..._SSSSS_..Q", "...._SSSSS_...", "...._SSSSS_..."];
    const troops = [P(1, 0), P(1, 1), P(3, 0), P(3, 1)].map((pos) => ({ type: "infantry" as const, owner: 0, pos }));
    const craft = [P(4, 0), P(4, 1)].map((pos) => ({ type: "landingCraft" as const, owner: 0, pos }));
    const owners = { propertyOwners: [{ pos: P(0, 0), owner: 0 }, { pos: P(13, 0), owner: 1 }] };
    const boarded = async (enemyBuilds: readonly UnitTypeId[], enemyUnits: Parameters<typeof makeGame>[1]) => {
      const state = makeGame(map, [...troops, ...craft, ...(enemyUnits ?? [])], {
        ...owners,
        players: [{ name: "Allies", nation: "us" }, { name: "Axis", nation: "germany", buildable: enemyBuilds }],
      });
      const { commands } = await playTurn(state);
      return commands.filter((c) => c.type === "move" && c.action.type === "load").length;
    };
    expect(await boarded(["infantry"], [{ type: "landingCraft", owner: 1, pos: P(9, 2) }])).toBe(2);
    expect(await boarded(["infantry"], [])).toBe(4);
  });

  it("Easy is the same AI without coordination: no focus fire, look ahead, waves, escorts or garrison", () => {
    expect(weightsFor("normal")).toBe(GREEDY_WEIGHTS);
    expect(weightsFor("easy")).toMatchObject({ focusKillBonus: 0, dangerWeight: 0, indirectFirst: false, waveSize: 1, escortsPerCraft: 0, garrisonSize: 0 });
    expect(greedyAi(weightsFor("easy")).name).toBe("Greedy (Easy)");
  });

  it("Normal beats Easy from either side on Twin Bridges and Bocage Country", async () => {
    const normal = greedyAi(weightsFor("normal"));
    const easy = greedyAi(weightsFor("easy"));
    let wins = 0;
    for (const id of ["twin-bridges", "bocage-country"]) {
      const scenario = SCENARIOS.find((s) => s.id === id);
      if (!scenario) throw new Error(id);
      for (const seat of [0, 1]) {
        const state = createGame({ ...scenario.setup, seed: 1 });
        const result = await playMatch(state, state.players.map((p) => (p.id === seat ? normal : easy)), 60);
        expect(result.bugs).toEqual([]);
        if (result.state.result?.winners.includes(seat)) wins++;
      }
    }
    expect(wins).toBeGreaterThanOrEqual(3);
  }, 120_000);
});

describe("AI vs AI on the built-in maps (09-ai §7)", () => {
  const start = (id: string, seed = 7) => {
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) throw new Error(`no scenario ${id}`);
    return createGame({ ...scenario.setup, seed });
  };
  const everyone = (state: GameState) => state.players.map(() => greedy);

  // Maps where both sides can reach each other by land. On the others, winning needs landings: the
  // AI makes them (09-ai §4b), but those games often run past 40 days.
  const LAND_MAPS = ["twin-bridges", "bocage-country", "crossroads", "bastogne", "iwo-jima", "proving-ground"];

  for (const id of LAND_MAPS) {
    it(`${id}: a game between AIs ends with a winner within 40 days, with no AI bugs`, async () => {
      const result = await playMatch(start(id), everyone(start(id)), 40);
      expect(result.bugs).toEqual([]);
      expect(result.state.result).not.toBeNull();
    }, 60_000);
  }

  for (const scenario of SCENARIOS.filter((s) => !LAND_MAPS.includes(s.id))) {
    it(`${scenario.id}: AIs play 10 days with no AI bugs`, async () => {
      const result = await playMatch(start(scenario.id), everyone(start(scenario.id)), 10);
      expect(result.bugs).toEqual([]);
      expect(result.state.day).toBeGreaterThan(10);
    }, 60_000);
  }

  /** How many of these commands land passengers from this kind of transport, and how many are launches. */
  const tally = (start: GameState, commands: readonly Command[]) => {
    let state = start;
    const count = { landings: 0, drops: 0, launches: 0 };
    for (const command of commands) {
      const mover = command.type === "move" ? state.units.find((u) => u.id === command.unitId) : undefined;
      if (command.type === "launch") count.launches++;
      if (command.type === "move" && command.action.type === "unload" && mover?.type === "landingCraft") count.landings++;
      if (command.type === "move" && command.action.type === "unload" && mover?.type === "transportAircraft") count.drops++;
      const result = apply(state, command);
      if (!result.ok) throw new Error(result.message);
      state = result.state;
    }
    return count;
  };

  it("iwo-jima: the US launches its Dive Bombers and lands reinforcements from Landing Craft (09-ai §4b)", async () => {
    const state = start("iwo-jima");
    const result = await playMatch(state, everyone(state), 15);
    const count = tally(state, result.commands);
    expect(result.bugs).toEqual([]);
    expect(count.launches).toBeGreaterThan(0);
    expect(count.landings).toBeGreaterThan(0);
  }, 60_000);

  it("the-slot: both sides land on other islands, and properties change hands (09-ai §4b)", async () => {
    const state = start("the-slot");
    const result = await playMatch(state, everyone(state), 25);
    const count = tally(state, result.commands);
    expect(result.bugs).toEqual([]);
    expect(count.launches).toBeGreaterThan(0);
    expect(count.landings).toBeGreaterThan(5);
    const taken = result.state.properties.filter((p) => { const before = propertyAt(state, p.pos)?.owner ?? null; return before !== null && p.owner !== before; });
    expect(taken.length).toBeGreaterThan(0);
  }, 120_000);

  it("same seed, same game: an AI vs AI game replays exactly", async () => {
    const first = await playMatch(start("bocage-country", 3), everyone(start("bocage-country")), 15);
    const second = await playMatch(start("bocage-country", 3), everyone(start("bocage-country")), 15);
    expect(second.commands).toEqual(first.commands);
    expect(second.state).toEqual(first.state);
  });

  it("thinks for under 100 ms per command on the largest map, Normandy (09-ai §6)", async () => {
    const state = start("normandy");
    const t0 = Date.now();
    const result = await playMatch(state, everyone(state), 5);
    const perCommand = (Date.now() - t0) / result.commands.length;
    expect(perCommand).toBeLessThan(100);
  }, 60_000);

  it("captures properties along the way: an AI game on Twin Bridges changes some owners", async () => {
    const state = start("twin-bridges");
    const result = await playMatch(state, everyone(state), 10);
    const changed = result.state.properties.filter((p) => propertyAt(state, p.pos)?.owner !== p.owner);
    expect(changed.length).toBeGreaterThan(0);
  });
});
