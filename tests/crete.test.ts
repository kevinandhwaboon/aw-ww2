import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, GameEvent } from "../src/engine/commands";
import { TERRAIN } from "../src/engine/data/terrain";
import { WAVE_PATTERNS } from "../src/engine/data/waves";
import { buildOptions } from "../src/engine/economy";
import { terrainAt, type Point } from "../src/engine/map";
import { createGame } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { SCENARIOS, SURVIVAL_SCENARIOS } from "../src/scenarios";
import { SURVIVAL_MAPS } from "../src/survival/maps";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const UK = 0;
const GERMANY = 1;

const crete = SURVIVAL_SCENARIOS.find((s) => s.id === "crete");
if (!crete) throw new Error("missing scenario");
const { map, units, players, propertyOwners, victory, arrivals, waveGenerator } = crete.setup;
const start = () => createGame({ ...crete.setup, seed: 1 });
const germanArrivals = (arrivals ?? []).filter((a) => a.player === GERMANY);

const MALEME = P(7, 9);
const CHANIA = P(11, 9);
const KASTELLI = P(4, 10);
const HERAKLION = P(34, 13);

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

/** Whether a tank can drive from one square to the other (02-terrain §3). */
function tankRoute(from: Point, to: Point): boolean {
  const seen = new Set([`${from.x},${from.y}`]);
  const queue = [from];
  while (queue.length > 0) {
    const p = queue.shift() as Point;
    if (p.x === to.x && p.y === to.y) return true;
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]] as const) {
      const n = P(p.x + dx, p.y + dy);
      if (n.x < 0 || n.y < 0 || n.x >= map.width || n.y >= map.height || seen.has(`${n.x},${n.y}`)) continue;
      if (TERRAIN[terrainAt(map, n)].moveCost.tracks === null) continue;
      seen.add(`${n.x},${n.y}`);
      queue.push(n);
    }
  }
  return false;
}

describe("Crete (24-survival-crete)", () => {
  it("is the UK against Germany, the UK moving first (24-survival-crete §2)", () => {
    expect(players.map((p) => p.nation)).toEqual(["uk", "germany"]);
  });

  it("is a survival map, not a Skirmish one, and history's mark is Chania on day 9 (24-survival-crete §1, §3)", () => {
    expect(SCENARIOS.some((s) => s.id === "crete")).toBe(false);
    expect(SURVIVAL_MAPS.find((m) => m.map === "crete")).toMatchObject({ defender: UK, attacker: GERMANY, historyDays: 9, historyLine: "Chania fell on 27 May 1941, day 9" });
  });

  it("the UK holds all twelve properties: Chania, three airfields, two ports, the depot and five towns; Germany none (24-survival-crete §2)", () => {
    const owned = (propertyOwners ?? []).map((o) => [terrainAt(map, o.pos), o.owner] as const);
    expect(owned.every(([, owner]) => owner === UK)).toBe(true);
    expect(owned.map(([terrain]) => terrain).sort()).toEqual(["airfield", "airfield", "airfield", "city", "city", "city", "city", "city", "factory", "hq", "port", "port"]);
    expect(terrainAt(map, CHANIA)).toBe("hq");
    expect(terrainAt(map, MALEME)).toBe("airfield");
    expect(terrainAt(map, HERAKLION)).toBe("airfield");
  });

  it("the UK earns half the usual income, 6,000 a day, and Germany nothing (24-survival-crete §2)", () => {
    const state = start();
    expect(stats.propertyIncome(state, UK)).toBe(6000);
    expect(stats.propertyIncome(state, GERMANY)).toBe(0);
  });

  it("Germany starts with no units, and earns and builds nothing even from what it captures (24-survival-crete §2)", () => {
    expect((units ?? []).filter((u) => u.owner === GERMANY)).toEqual([]);
    const state = start();
    const port = state.properties.find((p) => terrainAt(map, p.pos) === "port");
    if (!port) throw new Error("no port");
    const captured: GameState = { ...state, properties: state.properties.map((p) => (p === port ? { ...p, owner: GERMANY } : p)) };
    expect(stats.propertyIncome(captured, GERMANY)).toBe(0);
    expect(buildOptions({ ...captured, currentPlayer: GERMANY }, port.pos)).toEqual([]);
  });

  it("the UK can't build aircraft (24-survival-crete §8, Q1)", () => {
    const buildable = players[UK]?.buildable ?? [];
    expect(buildable.length).toBeGreaterThan(0);
    for (const air of ["fighter", "bomber", "transportAircraft", "diveBomber", "torpedoBomber"] as const) expect(buildable).not.toContain(air);
  });

  it("the UK loses when Germany takes Chania or it has no units left, and Germany never loses (24-survival-crete §5)", () => {
    expect(victory).toEqual([{ type: "hqCapture" }, { type: "rout", side: "allies" }]);
    const { state } = play(start(), 1);
    expect(state.players[GERMANY]?.defeated).toBe(false);
  });

  it("Hill 107 is a Hills square overlooking Maleme airfield, held by New Zealand infantry (24-survival-crete §2)", () => {
    const hill = P(MALEME.x, MALEME.y + 1);
    expect(terrainAt(map, hill)).toBe("hills");
    expect((units ?? []).find((u) => u.pos.x === hill.x && u.pos.y === hill.y)).toMatchObject({ type: "infantry", owner: UK });
  });

  it("the coast road crosses the Tavronitis, just west of Maleme, on a Major Bridge (24-survival-crete §2)", () => {
    expect(terrainAt(map, P(MALEME.x - 1, MALEME.y))).toBe("majorBridge");
  });

  it("a tank can drive from Kastelli to Heraklion along the north coast (24-survival-crete §2)", () => {
    expect(tankRoute(KASTELLI, HERAKLION)).toBe(true);
  });

  it("paratroops arrive already aboard Transport Aircraft, which fly home once they've dropped them (24-survival-crete §3)", () => {
    const lifts = germanArrivals.flatMap((a) => a.units).filter((u) => u.type === "transportAircraft");
    expect(lifts.length).toBeGreaterThan(20);
    expect(lifts.every((u) => (u.cargo ?? []).length === 2 && u.leavesWhenEmpty === true)).toBe(true);
  });

  it("Germany's tanks and guns come only by sea, since a Transport Aircraft carries foot soldiers (24-survival-crete §3)", () => {
    const aboard = (type: string) => germanArrivals.flatMap((a) => a.units).filter((u) => u.type === type).flatMap((u) => (u.cargo ?? []).map((c) => c.type));
    expect(aboard("transportAircraft").every((t) => t === "infantry" || t === "assaultInfantry" || t === "mortar")).toBe(true);
    expect(aboard("landingCraft")).toContain("lightTank");
    expect(aboard("landingCraft")).toContain("artillery");
  });

  it("the morning lift comes in off Maleme, within one flight of the airfield (24-survival-crete §3)", () => {
    const morning = germanArrivals.find((a) => a.wave === 1);
    const transportMove = 8;
    const lifts = morning?.units.filter((u) => u.type === "transportAircraft").length ?? 0;
    // Each Transport takes the next square of the zone; it drops from a square next to the airfield.
    for (const p of morning?.zone.slice(0, lifts) ?? []) expect(Math.abs(p.x - MALEME.x) + Math.abs(p.y - MALEME.y) - 1).toBeLessThanOrEqual(transportMove + 1);
  });

  it("the ten waves of the invasion arrive on history's days (24-survival-crete §3)", () => {
    const { events } = play(start(), 9);
    const firstDay = new Map<number, number>();
    for (const e of events) if (e.type === "unitsArrived" && e.player === GERMANY && e.wave !== undefined && !firstDay.has(e.wave)) firstDay.set(e.wave, e.day);
    expect([...firstDay].sort(([a], [b]) => a - b)).toEqual([
      [1, 1],
      [2, 2],
      [3, 3],
      [4, 3],
      [5, 4],
      [6, 4],
      [7, 5],
      [8, 6],
      [9, 7],
      [10, 9],
    ]);
  });

  it("Layforce lands at Souda Bay and Formidable arrives with two Fighters on day 8 (24-survival-crete §3)", () => {
    const { events } = play(start(), 8);
    const relief = events.filter((e) => e.type === "unitsArrived" && e.player === UK);
    expect(relief.map((e) => (e.type === "unitsArrived" ? [e.day, e.name] : []))).toEqual([
      [8, "Layforce"],
      [8, "Formidable"],
    ]);
    const formidable = (arrivals ?? []).find((a) => a.name === "Formidable");
    expect(formidable?.units).toEqual([{ type: "carrier", cargo: [{ type: "fighter" }, { type: "fighter" }] }]);
  });

  it("the endless waves begin with wave 11 on day 11, from the Aegean set (24-survival-crete §4)", () => {
    expect(waveGenerator).toMatchObject({ player: GERMANY, patterns: "aegean", firstWave: 11, firstDay: 11, everyDays: 2, growth: 0.12 });
  });

  it("Germany's waves don't come from the south, the fleet's route from Alexandria, before wave 15 (24-survival-crete §4)", () => {
    expect(waveGenerator?.edges.find((e) => e.name === "south")?.fromWave).toBe(15);
    expect(germanArrivals.every((a) => a.from !== "south")).toBe(true);
  });

  it("the Aegean waves bring no warships: the Royal Navy owned the sea (24-survival-crete §4)", () => {
    const types = WAVE_PATTERNS.aegean.flatMap((p) => p.parts.flatMap((part) => part.units.map((u) => u.type)));
    for (const ship of ["destroyer", "battleship", "submarine", "torpedoBoat", "carrier"] as const) expect(types).not.toContain(ship);
    expect(germanArrivals.flatMap((a) => a.units).some((u) => u.type === "torpedoBoat" || u.type === "destroyer")).toBe(false);
  });
});
