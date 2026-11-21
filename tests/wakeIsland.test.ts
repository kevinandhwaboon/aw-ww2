import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, GameEvent } from "../src/engine/commands";
import { buildOptions } from "../src/engine/economy";
import { terrainAt, type Point } from "../src/engine/map";
import { createGame } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { SCENARIOS, SURVIVAL_SCENARIOS } from "../src/scenarios";
import { SURVIVAL_MAPS } from "../src/survival/maps";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const US = 0;
const JAPAN = 1;

const wake = SURVIVAL_SCENARIOS.find((s) => s.id === "wake-island");
if (!wake) throw new Error("missing scenario");
const { map, units, players, propertyOwners, victory, arrivals, waveGenerator } = wake.setup;
const all = units ?? [];
const start = () => createGame({ ...wake.setup, seed: 1 });

/** Both players end their turns, without moving, for this many days; with every event. */
function play(state: GameState, days: number): { state: GameState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  let current = state;
  for (let i = 0; i < 2 * days && !current.result; i++) {
    const result = apply(current, endTurn);
    if (!result.ok) throw new Error(result.message);
    events.push(...result.events);
    current = result.state;
  }
  return { state: current, events };
}

describe("Wake Island (23-survival §2)", () => {
  it("is the US against Japan, the US moving first (23-survival §2)", () => {
    expect(players.map((p) => p.nation)).toEqual(["us", "japan"]);
  });

  it("is a survival map, not a Skirmish one (23-survival §1)", () => {
    expect(SCENARIOS.some((s) => s.id === "wake-island")).toBe(false);
    expect(SURVIVAL_MAPS.find((m) => m.map === "wake-island")).toMatchObject({ defender: US, attacker: JAPAN, historyDays: 16 });
  });

  it("the US holds all six properties: HQ, airfield, factory, port and two cities; Japan none (23-survival §2)", () => {
    const owned = (propertyOwners ?? []).map((o) => [terrainAt(map, o.pos), o.owner]);
    expect(owned.every(([, owner]) => owner === US)).toBe(true);
    expect(owned.map(([terrain]) => terrain).sort()).toEqual(["airfield", "city", "city", "factory", "hq", "port"]);
  });

  it("the three 5-inch batteries are Artillery in bunkers (23-survival §2)", () => {
    const batteries = all.filter((u) => u.type === "artillery");
    expect(batteries).toHaveLength(3);
    expect(batteries.every((u) => terrainAt(map, u.pos) === "bunker")).toBe(true);
  });

  it("the US starts with VMF-211's four Wildcats, three Flak Guns, the Marines and a Submarine (23-survival §2)", () => {
    const count = (type: string) => all.filter((u) => u.owner === US && u.type === type).length;
    expect([count("fighter"), count("flakGun"), count("infantry"), count("assaultInfantry"), count("submarine")]).toEqual([4, 3, 4, 1, 1]);
  });

  it("Japan starts with only two Supply Ships, one off the south of the atoll and one off the north (23-survival §2)", () => {
    const japanese = all.filter((u) => u.owner === JAPAN);
    expect(japanese.map((u) => u.type)).toEqual(["supplyShip", "supplyShip"]);
    const atollMiddle = map.height / 2;
    expect(japanese.some((u) => u.pos.y > atollMiddle + 5)).toBe(true);
    expect(japanese.some((u) => u.pos.y < atollMiddle - 5)).toBe(true);
  });

  it("Japan's Supply Ships carry 30 loads, since Japan has no port to refill them at (23-survival §2)", () => {
    const state = start();
    const oilers = state.units.filter((u) => u.owner === JAPAN && u.type === "supplyShip");
    expect(oilers.map((u) => [u.ammo, stats.maxAmmo(state, u)])).toEqual([
      [30, 30],
      [30, 30],
    ]);
    // The US's own Supply Ships keep the usual 5.
    const usOiler = { ...oilers[0], owner: US } as (typeof oilers)[number];
    expect(stats.maxAmmo(state, usOiler)).toBe(5);
  });

  it("the landing beaches are on the south shores of Wilkes and Wake (23-survival §2)", () => {
    const beaches: Point[] = [];
    for (let y = 0; y < map.height; y++) for (let x = 0; x < map.width; x++) if (terrainAt(map, P(x, y)) === "beach") beaches.push(P(x, y));
    expect(beaches.length).toBeGreaterThan(8);
    expect(new Set(beaches.map((b) => b.y)).size).toBe(1);
    const hq = (propertyOwners ?? []).find((o) => terrainAt(map, o.pos) === "hq");
    expect(beaches[0]?.y).toBeGreaterThan(hq?.pos.y ?? Infinity);
  });

  it("Japan earns nothing and builds nothing, even from a property it captures (23-survival §5d)", () => {
    const state = start();
    const port = state.properties.find((p) => terrainAt(map, p.pos) === "port");
    if (!port) throw new Error("no port");
    const captured: GameState = { ...state, properties: state.properties.map((p) => (p === port ? { ...p, owner: JAPAN } : p)) };
    expect(stats.propertyIncome(captured, JAPAN)).toBe(0);
    expect(buildOptions({ ...captured, currentPlayer: JAPAN }, port.pos)).toEqual([]);
    expect(play(captured, 2).state.players[JAPAN]?.funds).toBe(0);
  });

  it("the US loses when Japan captures the HQ or it has no units left, and Japan never loses (23-survival §5b)", () => {
    expect(victory).toEqual([{ type: "hqCapture" }, { type: "rout", side: "allies" }]);
    // Japan is still in the game before its first raid, with only its Supply Ships.
    const { state } = play(start(), 1);
    expect(state.players[JAPAN]?.defeated).toBe(false);
  });

  it("the nine waves of the siege arrive on history's days (23-survival §3)", () => {
    const { events } = play(start(), 16);
    const firstDay = new Map<number, number>();
    for (const e of events) if (e.type === "unitsArrived" && e.player === JAPAN && e.wave !== undefined && !firstDay.has(e.wave)) firstDay.set(e.wave, e.day);
    expect([...firstDay].slice(0, 9)).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 5],
      [5, 7],
      [6, 9],
      [7, 11],
      [8, 13],
      [9, 15],
    ]);
  });

  it("the first landing comes with four Destroyers and two Landing Craft of naval infantry (23-survival §3)", () => {
    const first = arrivals?.find((a) => a.wave === 3);
    expect(first?.name).toBe("The first landing");
    expect(first?.units.map((u) => [u.type, (u.cargo ?? []).map((c) => c.type)])).toEqual([
      ["destroyer", []],
      ["destroyer", []],
      ["destroyer", []],
      ["destroyer", []],
      ["landingCraft", ["infantry", "infantry"]],
      ["landingCraft", ["infantry", "infantry"]],
    ]);
  });

  it("the second landing brings an anti-aircraft gun ashore with the naval infantry (23-survival §3, §6)", () => {
    const second = arrivals?.find((a) => a.wave === 9);
    const cargo = (second?.units ?? []).flatMap((u) => u.cargo ?? []).map((c) => c.type);
    expect(cargo).toContain("mobileAA");
    expect(cargo.filter((t) => t === "infantry" || t === "assaultInfantry").length).toBeGreaterThanOrEqual(16);
  });

  it("the raids from the Marshalls go home after two turns (23-survival §3, §5c)", () => {
    const raiders = (arrivals ?? []).filter((a) => a.player === JAPAN).flatMap((a) => a.units).filter((u) => u.type === "bomber");
    expect(raiders.length).toBeGreaterThan(0);
    expect(raiders.every((u) => u.sortieTurns === 2)).toBe(true);
  });

  it("the carriers come from the west on day 13, their aircraft staying with them (23-survival §3)", () => {
    const carriers = arrivals?.find((a) => a.wave === 8);
    expect(carriers).toMatchObject({ day: 13, from: "west", name: "Carrier Division 2" });
    const aboard = (carriers?.units ?? []).flatMap((u) => u.cargo ?? []);
    expect(aboard.map((u) => u.type).sort()).toEqual(["diveBomber", "diveBomber", "fighter", "fighter"]);
    expect(aboard.every((u) => u.sortieTurns === undefined)).toBe(true);
  });

  it("Task Force 14 arrives for the US on the east edge on day 15 (23-survival §3, §10 Q4)", () => {
    const { events } = play(start(), 15);
    const relief = events.find((e) => e.type === "unitsArrived" && e.player === US);
    expect(relief).toMatchObject({ day: 15, name: "Task Force 14" });
    const types = relief?.type === "unitsArrived" ? relief.units.map((u) => u.unitType).sort() : [];
    expect(types).toEqual(["carrier", "destroyer", "landingCraft", "supplyShip"]);
  });

  it("the endless waves begin with wave 10 on day 17, known once the second landing arrives (23-survival §4)", () => {
    expect(waveGenerator).toMatchObject({ player: JAPAN, firstWave: 10, firstDay: 17, everyDays: 2, growth: 0.12, unitCap: 60 });
    const beforeWave9 = play(start(), 14).state;
    expect(beforeWave9.arrivals.some((a) => a.wave === 10)).toBe(false);
    const { state } = play(start(), 15);
    expect(state.wave).toBe(9);
    expect(state.arrivals.filter((a) => a.wave === 10).every((a) => a.day === 17)).toBe(true);
    expect(state.arrivals.some((a) => a.wave === 10)).toBe(true);
  });

  it("Japan's waves don't come from the east, the US supply route, before wave 15 (23-survival §4)", () => {
    expect(waveGenerator?.edges.find((e) => e.name === "east")?.fromWave).toBe(15);
    expect((arrivals ?? []).filter((a) => a.player === JAPAN).every((a) => a.from !== "east")).toBe(true);
  });

  it("a raid from the south edge reaches the south shore on the turn after it arrives (23-survival §2)", () => {
    const south = waveGenerator?.edges.find((e) => e.name === "south");
    const shoreRow = Math.max(...(propertyOwners ?? []).map((o) => o.pos.y));
    const bomberMove = 7;
    // A bomber strikes from the square next to its target.
    expect(south?.zone.every((p) => p.y - (shoreRow + 1) <= bomberMove)).toBe(true);
  });
});
