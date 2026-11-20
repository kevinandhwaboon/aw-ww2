import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, GameEvent } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import { parseScenario } from "../src/engine/scenario";
import type { GameSetup } from "../src/engine/setup";
import type { Arrival, ArrivingUnit, GameState, WaveGenerator } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { generateWaves, waveBudget } from "../src/engine/waves";
import { waveLines } from "../src/game/objectives";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };

/** A small island in a sea, with an edge on each side. The east edge opens to the waves at wave 15. */
const ROWS = ["SSSSSSSSSSSS", "SSSSSSSSSSSS", "SSSS....SSSS", "SSSS....SSSS", "SSSSSSSSSSSS", "SSSSSSSSSSSS"];
const row = (y: number) => Array.from({ length: 12 }, (_, x) => P(x, y));
const column = (x: number) => Array.from({ length: 6 }, (_, y) => P(x, y));

const GENERATOR: WaveGenerator = {
  player: 1,
  patterns: "pacific",
  firstWave: 1,
  firstDay: 2,
  everyDays: 2,
  budget: 60000,
  growth: 0.12,
  edges: [
    { name: "north", zone: row(0) },
    { name: "south", zone: row(5) },
    { name: "west", zone: column(0) },
    { name: "east", zone: column(11), fromWave: 15 },
  ],
  convoy: { player: 0, fromWave: 4, every: 4, edge: "east", units: [{ type: "supplyShip" }] },
};

const setup = (overrides: Partial<Omit<GameSetup, "map" | "units">> = {}): Partial<Omit<GameSetup, "map" | "units">> => ({
  players: [
    { name: "US", nation: "us" },
    { name: "Japan", nation: "japan" },
  ],
  victory: [{ type: "hqCapture" }, { type: "rout", side: "allies" }],
  waveGenerator: GENERATOR,
  ...overrides,
});

const game = (overrides: Partial<Omit<GameSetup, "map" | "units">> = {}) =>
  makeGame(ROWS, [{ type: "infantry", owner: 0, pos: P(5, 2) }], setup(overrides));

/** Every event as both players end their turns for this many days. */
function play(state: GameState, days: number): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let current = state;
  for (let i = 0; i < 2 * days; i++) {
    const result = apply(current, endTurn);
    if (!result.ok) throw new Error(result.message);
    events.push(...result.events);
    current = result.state;
  }
  return { state: current, events };
}

/** The arrivals generated for this wave (and its convoy), as if the wave before it had just arrived. */
const generated = (state: GameState, wave: number): Arrival[] => [...generateWaves({ ...state, wave: wave - 1, arrivals: [] }).arrivals];

const everyUnit = (arrivals: readonly Arrival[]): ArrivingUnit[] => arrivals.flatMap((a) => a.units);
const valueOf = (state: GameState, unit: ArrivingUnit): number =>
  stats.unitCost(state, 1, unit.type) + (unit.cargo ?? []).reduce((sum, c) => sum + valueOf(state, c), 0);

const SEEDS = Array.from({ length: 30 }, (_, i) => i + 1);
const gameWithSeed = (seed: number) => game({ seed });

describe("Endless waves (23-survival §4)", () => {
  it("the first generated wave is known from the start of the game (23-survival §4)", () => {
    const coming = game().arrivals;
    expect(coming.length).toBeGreaterThan(0);
    expect(coming.every((a) => a.wave === 1 && a.day === 2 && a.player === 1)).toBe(true);
  });

  it("the same seed generates the same endless waves (23-survival §4)", () => {
    expect(play(gameWithSeed(7), 9).state.arrivals).toEqual(play(gameWithSeed(7), 9).state.arrivals);
    expect(play(gameWithSeed(7), 9).events).toEqual(play(gameWithSeed(7), 9).events);
  });

  it("different seeds bring different kinds of wave (23-survival §4)", () => {
    const names = new Set(SEEDS.map((seed) => gameWithSeed(seed).arrivals[0]?.name));
    expect(names.size).toBeGreaterThan(2);
  });

  it("endless waves come on fixed days, every few days from the first (23-survival §4, §10 Q1)", () => {
    // A small budget, so the waves never fill their edges: these test units never move away.
    const arrived = play(game({ waveGenerator: { ...GENERATOR, budget: 20000, growth: 0 } }), 9).events.flatMap((e) => (e.type === "unitsArrived" && e.player === 1 ? [[e.wave, e.day]] : []));
    const firstDays = new Map<number | undefined, number>();
    for (const [wave, day] of arrived) if (!firstDays.has(wave)) firstDays.set(wave, day as number);
    expect([...firstDays]).toEqual([
      [1, 2],
      [2, 4],
      [3, 6],
      [4, 8],
    ]);
  });

  it("the next wave is generated when the one before it arrives, so it is always known (23-survival §4)", () => {
    // Wave 1 arrives on Japan's turn on day 2.
    const { state } = play(game(), 1);
    expect(state.arrivals.map((a) => a.wave)).not.toContain(2);
    const afterWave1 = apply(state, endTurn);
    if (!afterWave1.ok) throw new Error(afterWave1.message);
    expect(afterWave1.state.wave).toBe(1);
    const coming = afterWave1.state.arrivals.filter((a) => a.player === 1);
    expect(coming.length).toBeGreaterThan(0);
    expect(coming.every((a) => a.wave === 2 && a.day === 4)).toBe(true);
  });

  it("each endless wave's budget is 12% more than the one before (23-survival §4)", () => {
    expect([1, 2, 3, 11].map((wave) => waveBudget(GENERATOR, wave))).toEqual([60000, 67200, 75264, Math.round(60000 * 1.12 ** 10)]);
  });

  it("a wave's units, with their passengers, never cost more than its budget (23-survival §4)", () => {
    const state = game();
    for (const seed of SEEDS) {
      for (const wave of [1, 5, 12, 20]) {
        const units = everyUnit(generated({ ...state, rng: seed }, wave).filter((a) => a.player === 1));
        expect(units.length).toBeGreaterThan(0);
        const value = units.reduce((sum, u) => sum + valueOf(state, u), 0);
        expect(value).toBeLessThanOrEqual(waveBudget(GENERATOR, wave));
      }
    }
  });

  it("waves never enter from an edge before the wave it opens on (23-survival §4)", () => {
    const state = game();
    const japanFromEast = (wave: number) =>
      SEEDS.some((seed) => generated({ ...state, rng: seed }, wave).some((a) => a.player === 1 && a.from === "east"));
    for (const wave of [1, 6, 14]) expect(japanFromEast(wave)).toBe(false);
    expect([15, 16, 17, 18].some(japanFromEast)).toBe(true);
  });

  it("each group of a wave comes from a different edge where it can (23-survival §4)", () => {
    const state = game();
    for (const seed of SEEDS) {
      const groups = generated({ ...state, rng: seed }, 20).filter((a) => a.player === 1);
      expect(new Set(groups.map((a) => a.from)).size).toBe(groups.length);
    }
  });

  it("raids bring Fighters only from wave 12, and combined assaults come only from wave 14 (23-survival §4)", () => {
    const state = game();
    const waves = (wave: number) => SEEDS.map((seed) => generated({ ...state, rng: seed }, wave));
    const raids = (wave: number) => waves(wave).filter((w) => w[0]?.name === "Air raid");
    expect(raids(11).flatMap(everyUnit).some((u) => u.type === "fighter")).toBe(false);
    expect(raids(12).flatMap(everyUnit).some((u) => u.type === "fighter")).toBe(true);
    expect(waves(13).some((w) => w[0]?.name === "Combined assault")).toBe(false);
    expect(waves(14).some((w) => w[0]?.name === "Combined assault")).toBe(true);
  });

  it("land-based raiders in a generated wave go home after two turns, carrier aircraft don't (23-survival §3, §5c)", () => {
    const state = game();
    const units = SEEDS.flatMap((seed) => everyUnit(generated({ ...state, rng: seed }, 12).filter((a) => a.player === 1)));
    expect(units.filter((u) => u.type === "bomber").every((u) => u.sortieTurns === 2)).toBe(true);
    const carried = units.filter((u) => u.type === "carrier").flatMap((u) => u.cargo ?? []);
    expect(carried.length).toBeGreaterThan(0);
    expect(carried.every((c) => c.sortieTurns === undefined)).toBe(true);
  });

  it("a convoy arrives for the defender with every fourth wave from its first (23-survival §4)", () => {
    const state = game();
    const convoy = (wave: number) => generated(state, wave).filter((a) => a.player === 0);
    expect(convoy(3)).toEqual([]);
    expect(convoy(4)).toEqual([{ day: 8, player: 0, name: "Convoy", from: "east", zone: column(11), units: [{ type: "supplyShip" }] }]);
    expect(convoy(5)).toEqual([]);
    expect(convoy(8)).toHaveLength(1);
  });

  it("a wave's units over the waves' unit cap wait for room (23-survival §4)", () => {
    const state = game({ waveGenerator: { ...GENERATOR, unitCap: 2 } });
    const { state: after } = play(state, 2);
    expect(after.units.filter((u) => u.owner === 1).reduce((n, u) => n + 1 + u.cargo.length, 0)).toBeLessThanOrEqual(2);
    expect(after.arrivals.some((a) => a.wave === 1)).toBe(true);
  });

  it("generated waves follow the map's own scripted waves (23-survival §3, §4)", () => {
    const scripted: Arrival = { day: 1, player: 1, wave: 1, name: "The noon raid", zone: row(5), units: [{ type: "bomber", sortieTurns: 2 }] };
    const state = game({ arrivals: [scripted], waveGenerator: { ...GENERATOR, firstWave: 2 } });
    expect(state.arrivals).toEqual([scripted]);
    const result = apply(state, endTurn);
    if (!result.ok) throw new Error(result.message);
    expect(result.state.wave).toBe(1);
    const coming = result.state.arrivals;
    expect(coming.length).toBeGreaterThan(0);
    expect(coming.every((a) => a.wave === 2 && a.day === 2)).toBe(true);
  });
});

describe("The wave forecast (23-survival §4)", () => {
  it("the HUD shows the wave reached and the next wave's day, kind and edge (23-survival §4)", () => {
    const next: Arrival = { day: 7, player: 1, wave: 5, name: "Air raid", from: "south", zone: row(5), units: [{ type: "bomber" }] };
    const state = { ...game(), wave: 4, arrivals: [next] };
    expect(waveLines(state)).toEqual([{ player: 1, text: "Wave 4 · Next: day 7, Air raid from the south" }]);
  });

  it("a wave in groups names every edge it comes from (23-survival §4)", () => {
    const group = (from: string): Arrival => ({ day: 9, player: 1, wave: 6, name: "Combined assault", from, zone: row(5), units: [{ type: "bomber" }] });
    const state = { ...game(), wave: 5, arrivals: [group("south"), group("west"), group("north")] };
    expect(waveLines(state)[0]?.text).toBe("Wave 5 · Next: day 9, Combined assault from the south, west and north");
  });

  it("a map without waves shows no wave line (23-survival §4)", () => {
    expect(waveLines(makeGame(["...."], [{ type: "infantry", owner: 0, pos: P(0, 0) }]))).toEqual([]);
  });
});

describe("Waves in scenario files (23-survival §4)", () => {
  const scenario = (waves: Record<string, unknown>) => ({
    id: "waves-test",
    name: "Waves test",
    description: "A test",
    map: ROWS,
    players: [
      { name: "US", nation: "us" },
      { name: "Japan", nation: "japan" },
    ],
    units: [{ type: "infantry", owner: 0, pos: { x: 5, y: 2 } }],
    victory: [{ type: "hqCapture" }, { type: "rout", side: "allies" }],
    waves,
  });
  const WAVES = { ...GENERATOR, edges: GENERATOR.edges.map((e) => ({ ...e })) };

  it("a scenario file can describe its endless waves (23-survival §4)", () => {
    expect(parseScenario(scenario(WAVES)).setup.waveGenerator).toEqual(GENERATOR);
  });

  it("a scenario file is refused if its waves name an unknown pattern set, have no open edge or a convoy edge that isn't there (23-survival §4)", () => {
    expect(() => parseScenario(scenario({ ...WAVES, patterns: "arctic" }))).toThrow(/pattern set/);
    expect(() => parseScenario(scenario({ ...WAVES, edges: [{ name: "east", zone: column(11), fromWave: 15 }] }))).toThrow(/no edge is open/);
    expect(() => parseScenario(scenario({ ...WAVES, convoy: { ...GENERATOR.convoy, edge: "nowhere" } }))).toThrow(/convoy/);
    expect(() => parseScenario(scenario({ ...WAVES, everyDays: 0 }))).toThrow(/everyDays/);
  });
});
