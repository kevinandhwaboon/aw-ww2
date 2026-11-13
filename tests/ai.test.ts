import { describe, expect, it } from "vitest";
import { chooseCommand, greedyAi } from "../src/ai/greedy";
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

  it("leaves Landing Craft and Transport Aircraft where they are, and never builds them (D9)", () => {
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

describe("AI vs AI on the built-in maps (09-ai §7)", () => {
  const start = (id: string, seed = 7) => {
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) throw new Error(`no scenario ${id}`);
    return createGame({ ...scenario.setup, seed });
  };
  const everyone = (state: GameState) => state.players.map(() => greedy);

  // Maps where both sides can reach each other by land. On the others, winning needs landings,
  // which the first AI doesn't attempt yet (D9).
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
