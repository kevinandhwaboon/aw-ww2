import { describe, expect, it } from "vitest";
import { AUTOSAVE_KEY, clearAutosave, decodeAutosave, encodeAutosave, readAutosave, writeAutosave, type Autosave, type SaveStore } from "../src/autosave";
import { apply } from "../src/engine/apply";
import type { Command } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import type { GameOptions } from "../src/ui/gameOptions";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const u = (type: UnitSetup["type"], owner: number, x: number, y = 0): UnitSetup => ({ type, owner, pos: P(x, y) });

/** Storage kept in memory, like localStorage. */
function memoryStore(): SaveStore & { readonly items: Map<string, string> } {
  const items = new Map<string, string>();
  return {
    items,
    getItem: (key) => items.get(key) ?? null,
    setItem: (key, value) => void items.set(key, value),
    removeItem: (key) => void items.delete(key),
  };
}

/** Storage the browser refuses, as in some private windows. */
const blockedStore: SaveStore = {
  getItem: () => {
    throw new Error("blocked");
  },
  setItem: () => {
    throw new Error("blocked");
  },
  removeItem: () => {
    throw new Error("blocked");
  },
};

const options: GameOptions = {
  luck: true,
  fog: false,
  passDevice: true,
  battleScenes: false,
  computer: [1],
  level: "easy",
  commanders: [null, null],
};

const ids = ["bastogne", "normandy"];

/** Infantry facing each other, with luck on, so an attack rolls the seeded dice. */
const game = (): GameState => makeGame(["...."], [u("infantry", 0, 0), u("infantry", 1, 1)]);
const attack: Command = { type: "move", unitId: 0, path: [], action: { type: "attack", target: 1 } };
const endTurn: Command = { type: "endTurn" };

function play(state: GameState, ...commands: Command[]): GameState {
  return commands.reduce((s, command) => {
    const result = apply(s, command);
    if (!result.ok) throw new Error(result.message);
    return result.state;
  }, state);
}

describe("autosave (11-tech-setup §3j)", () => {
  it("a game kept on the device comes back as it was, with the map and the options chosen before it started", () => {
    const store = memoryStore();
    const state = play(game(), attack);
    writeAutosave(store, { scenarioId: "bastogne", options, state });
    expect(readAutosave(store, ids)).toEqual({ scenarioId: "bastogne", options, state });
  });

  it("a campaign mission's autosave remembers it's a campaign game, so a win carried on still counts (22-campaign §2)", () => {
    const store = memoryStore();
    const state = game();
    writeAutosave(store, { scenarioId: "bastogne", options, state, campaign: true });
    expect(readAutosave(store, ids)?.campaign).toBe(true);
    writeAutosave(store, { scenarioId: "bastogne", options, state });
    expect(readAutosave(store, ids)?.campaign).toBeUndefined();
  });

  it("a survival game's autosave remembers it's a survival game, so it goes back to the Survival screen (23-survival §7)", () => {
    const store = memoryStore();
    const state = game();
    writeAutosave(store, { scenarioId: "bastogne", options, state, survival: true });
    expect(readAutosave(store, ids)?.survival).toBe(true);
    writeAutosave(store, { scenarioId: "bastogne", options, state });
    expect(readAutosave(store, ids)?.survival).toBeUndefined();
  });

  it("a carried-on game plays on exactly as it would have without the reload, luck rolls included", () => {
    const store = memoryStore();
    writeAutosave(store, { scenarioId: "bastogne", options, state: game() });
    const resumed = readAutosave(store, ids);
    expect(resumed).not.toBeNull();
    if (!resumed) return;
    expect(play(resumed.state, attack, endTurn)).toEqual(play(game(), attack, endTurn));
  });

  it("each save replaces the last: there is one slot", () => {
    const store = memoryStore();
    writeAutosave(store, { scenarioId: "bastogne", options, state: game() });
    writeAutosave(store, { scenarioId: "normandy", options, state: play(game(), endTurn) });
    expect(store.items.size).toBe(1);
    expect(readAutosave(store, ids)?.scenarioId).toBe("normandy");
  });

  it("a game that's over is forgotten, so there's nothing to continue", () => {
    const store = memoryStore();
    writeAutosave(store, { scenarioId: "bastogne", options, state: game() });
    const over: GameState = { ...game(), result: { winningSide: "allies", winners: [0], reason: "resign" } };
    writeAutosave(store, { scenarioId: "bastogne", options, state: over });
    expect(store.items.has(AUTOSAVE_KEY)).toBe(false);
    expect(readAutosave(store, ids)).toBeNull();
  });

  it("with nothing saved there's nothing to continue", () => {
    expect(readAutosave(memoryStore(), ids)).toBeNull();
    expect(readAutosave(null, ids)).toBeNull();
  });

  it("a save on a map no longer in the game is ignored", () => {
    const text = encodeAutosave({ scenarioId: "bastogne", options, state: game() });
    expect(decodeAutosave(text, ["normandy"])).toBeNull();
  });

  it("damaged or unrecognized saves are ignored rather than breaking the title screen", () => {
    const good: Autosave = { scenarioId: "bastogne", options, state: game() };
    const parsed = JSON.parse(encodeAutosave(good)) as Record<string, unknown>;
    const variant = (change: Record<string, unknown>) => JSON.stringify({ ...parsed, ...change });
    expect(decodeAutosave("{not json", ids)).toBeNull();
    expect(decodeAutosave("null", ids)).toBeNull();
    expect(decodeAutosave(variant({ version: 99 }), ids)).toBeNull();
    expect(decodeAutosave(variant({ game: "{}" }), ids)).toBeNull();
    expect(decodeAutosave(variant({ options: { ...options, level: "impossible" } }), ids)).toBeNull();
    expect(decodeAutosave(variant({ options: { ...options, passDevice: "yes" } }), ids)).toBeNull();
  });

  it("storage the browser blocks or that is full never stops the game", () => {
    expect(writeAutosave(blockedStore, { scenarioId: "bastogne", options, state: game() })).toBe(false);
    expect(writeAutosave(null, { scenarioId: "bastogne", options, state: game() })).toBe(false);
    expect(readAutosave(blockedStore, ids)).toBeNull();
    expect(() => clearAutosave(blockedStore)).not.toThrow();
  });
});
