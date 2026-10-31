import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import { createGame } from "../src/engine/setup";
import { parseAsciiMap } from "../src/engine/map";
import { displayHp, type GameState } from "../src/engine/state";
import { deepFreeze, makeGame } from "./helpers";

function mustApply(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected: ${result.message}`);
  return result;
}

const endTurn: Command = { type: "endTurn" };

describe("createGame", () => {
  it("starts on day 1 with player 0 to move", () => {
    const state = makeGame(["..."]);
    expect(state.day).toBe(1);
    expect(state.currentPlayer).toBe(0);
  });

  it("derives each player's side from their nation (00-master-design §6)", () => {
    const state = makeGame(["."]);
    expect(state.players.map((p) => p.side)).toEqual(["allies", "axis"]);
  });

  it("units start at full HP, fuel and ammo, as rookies, ready to act", () => {
    const state = makeGame(["..."], [{ type: "mediumTank", owner: 0, pos: { x: 1, y: 0 } }]);
    expect(state.units[0]).toMatchObject({ hp: 100, fuel: 70, ammo: 9, kills: 0, hasActed: false });
  });

  it("units without a primary weapon have 0 ammo", () => {
    const state = makeGame(["."], [{ type: "infantry", owner: 0, pos: { x: 0, y: 0 } }]);
    expect(state.units[0]?.ammo).toBe(0);
  });

  it("every property tile becomes a property, neutral with 20 capture points unless given an owner (04-economy §1, §3)", () => {
    const state = makeGame(["C.f", "..Q"], [], { propertyOwners: [{ pos: { x: 2, y: 1 }, owner: 1 }] });
    expect(state.properties).toEqual([
      { pos: { x: 0, y: 0 }, owner: null, capturePoints: 20, capturingUnit: null },
      { pos: { x: 2, y: 0 }, owner: null, capturePoints: 20, capturingUnit: null },
      { pos: { x: 2, y: 1 }, owner: 1, capturePoints: 20, capturingUnit: null },
    ]);
  });

  it("rejects invalid setups", () => {
    const map = parseAsciiMap(["C.."]);
    const players = [{ name: "A", nation: "us" }, { name: "B", nation: "germany" }] as const;
    const at = (x: number) => ({ x, y: 0 });
    expect(() => createGame({ map, players: [players[0]], seed: 1 })).toThrow(/at least 2 players/);
    expect(() => createGame({ map, players, seed: 1, propertyOwners: [{ pos: at(1), owner: 0 }] })).toThrow(/No property/);
    expect(() => createGame({ map, players, seed: 1, propertyOwners: [{ pos: at(0), owner: 5 }] })).toThrow(/Unknown owner/);
    expect(() => createGame({ map, players, seed: 1, units: [{ type: "infantry", owner: 0, pos: at(3) }] })).toThrow(/outside/);
    expect(() => createGame({ map, players, seed: 1, units: [{ type: "infantry", owner: 2, pos: at(0) }] })).toThrow(/unknown owner/);
    expect(() =>
      createGame({
        map, players, seed: 1,
        units: [{ type: "infantry", owner: 0, pos: at(1) }, { type: "recon", owner: 1, pos: at(1) }],
      }),
    ).toThrow(/Two units/);
    expect(() => createGame({ map, players, seed: 1, units: [{ type: "infantry", owner: 0, pos: at(0), hp: 0 }] })).toThrow(/invalid HP/);
  });
});

describe("displayed HP (03-combat §1)", () => {
  it("is internal HP ÷ 10, rounded up", () => {
    expect(displayHp(100)).toBe(10);
    expect(displayHp(91)).toBe(10);
    expect(displayHp(90)).toBe(9);
    expect(displayHp(1)).toBe(1);
    expect(displayHp(0)).toBe(0);
  });
});

describe("EndTurn", () => {
  it("passes the turn to the next player", () => {
    const { state, events } = mustApply(makeGame(["."]), endTurn);
    expect(state.currentPlayer).toBe(1);
    expect(state.day).toBe(1);
    expect(events).toEqual([
      { type: "turnEnded", player: 0 },
      { type: "turnStarted", player: 1, day: 1 },
    ]);
  });

  it("starts a new day when the last player ends their turn", () => {
    const afterP0 = mustApply(makeGame(["."]), endTurn).state;
    const { state, events } = mustApply(afterP0, endTurn);
    expect(state.currentPlayer).toBe(0);
    expect(state.day).toBe(2);
    expect(events).toEqual([
      { type: "turnEnded", player: 1 },
      { type: "dayStarted", day: 2 },
      { type: "turnStarted", player: 0, day: 2 },
    ]);
  });

  it("skips defeated players", () => {
    const three = createGame({
      map: parseAsciiMap(["."]),
      players: [{ name: "A", nation: "us" }, { name: "B", nation: "germany" }, { name: "C", nation: "uk" }],
      seed: 1,
    });
    const state: GameState = { ...three, players: three.players.map((p) => (p.id === 1 ? { ...p, defeated: true } : p)) };
    expect(mustApply(state, endTurn).state.currentPlayer).toBe(2);
  });

  it("readies the next player's units, and only theirs", () => {
    const base = makeGame([".."], [
      { type: "infantry", owner: 0, pos: { x: 0, y: 0 } },
      { type: "infantry", owner: 1, pos: { x: 1, y: 0 } },
    ]);
    const state: GameState = { ...base, units: base.units.map((u) => ({ ...u, hasActed: true })) };
    const next = mustApply(state, endTurn).state;
    expect(next.units.map((u) => u.hasActed)).toEqual([true, false]);
  });
});

describe("apply", () => {
  it("rejects malformed commands, e.g. from a hand-written AI", () => {
    const result = apply(makeGame(["."]), { type: "teleport" } as unknown as Command);
    expect(result).toMatchObject({ ok: false, code: "invalidCommand" });
  });

  it("never mutates the state it is given", () => {
    const state = deepFreeze(makeGame([".."], [{ type: "infantry", owner: 0, pos: { x: 0, y: 0 } }]));
    expect(() => mustApply(mustApply(state, endTurn).state, endTurn)).not.toThrow();
  });

  it("state survives a JSON round trip unchanged (save/load and replays rely on this)", () => {
    const state = makeGame(["C.Q"], [{ type: "recon", owner: 1, pos: { x: 1, y: 0 }, hp: 47, kills: 4 }], {
      modifiers: [{ source: "co", stat: "attack", op: "add", value: 10, scope: { players: [0] } }],
    });
    const after = mustApply(state, endTurn).state;
    expect(JSON.parse(JSON.stringify(after))).toEqual(after);
  });

  it("the same state and commands always produce the same result", () => {
    fc.assert(fc.property(fc.integer(), fc.nat(12), (seed, turns) => {
      const run = () => {
        let state = makeGame(["C..", ".Q."], [{ type: "infantry", owner: 0, pos: { x: 1, y: 0 } }], { seed });
        const events = [];
        for (let i = 0; i < turns; i++) {
          const r = mustApply(state, endTurn);
          state = r.state;
          events.push(...r.events);
        }
        return { state, events };
      };
      expect(run()).toEqual(run());
    }));
  });
});
