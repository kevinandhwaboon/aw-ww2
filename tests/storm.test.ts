import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, GameEvent } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import type { GameState } from "../src/engine/state";
import { dropLength, jumpTimes, planDrop } from "../src/game/battle/drop";
import { capturePointsAt, flagHeight, isFollowUp, planCapture, planGarrison, stormLength, stormRunners, stormTimes, type StormPlan } from "../src/game/battle/storm";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });

function run(state: GameState, command: Command): { state: GameState; events: readonly GameEvent[] } {
  const result = apply(state, command);
  if (!result.ok) throw new Error(result.message);
  return result;
}

const capture = (unitId: number, path: Point[] = []): Command => ({ type: "move", unitId, path, action: { type: "capture" } });
const wait = (unitId: number, path: Point[]): Command => ({ type: "move", unitId, path, action: { type: "wait" } });

function captureEvent(events: readonly GameEvent[]) {
  const event = events.find((e): e is Extract<GameEvent, { type: "captureProgress" | "propertyCaptured" }> => e.type === "captureProgress" || e.type === "propertyCaptured");
  if (!event) throw new Error("No capture event");
  return event;
}

describe("capture scenes (08-art-pipeline §19)", () => {
  it("a capture scene counts down from 20 to what the engine left: a full squad takes 10", () => {
    const state = makeGame([".C"], [{ owner: 0, pos: P(1, 0), type: "infantry" }]);
    const plan = planCapture(state, captureEvent(run(state, capture(0)).events));
    expect(plan).toMatchObject({ kind: "capture", before: 20, after: 10, captured: false });
  });

  it("the second turn of a capture starts from where the first left off and completes it", () => {
    const start = makeGame([".C"], [{ owner: 0, pos: P(1, 0), type: "infantry" }], { propertyOwners: [{ pos: P(1, 0), owner: 1 }] });
    const halfway = run(start, capture(0)).state;
    const nextTurn = run(run(halfway, { type: "endTurn" }).state, { type: "endTurn" }).state;
    const plan = planCapture(nextTurn, captureEvent(run(nextTurn, capture(0)).events));
    expect(plan).toMatchObject({ before: 10, after: 0, captured: true, previousOwner: 1, previousNation: "germany" });
  });

  it("the capture count ends exactly at the engine's number once the last soldier is inside", () => {
    const state = makeGame([".C"], [{ owner: 0, pos: P(1, 0), type: "infantry", hp: 70 }]);
    const plan = planCapture(state, captureEvent(run(state, capture(0)).events));
    if (!plan) throw new Error("No plan");
    const lastIn = Math.max(...stormTimes(plan).map((t) => t.enter));
    expect(capturePointsAt(plan, 0)).toBe(20);
    expect(capturePointsAt(plan, lastIn)).toBe(13);
    expect(capturePointsAt(plan, stormLength(plan).total)).toBe(13);
  });
});

describe("follow-up captures (08-art-pipeline §19)", () => {
  const plan = (before: number, after: number): StormPlan => ({
    kind: "capture", unit: "infantry", owner: 0, nation: "us", hp: 10, paratrooper: false, suit: 0,
    terrain: "city", before, after, captured: after === 0, previousOwner: 1, previousNation: "germany",
  });

  it("the first capture turn storms the building; later turns raise the flag instead, with no one running in", () => {
    expect(isFollowUp(plan(20, 10))).toBe(false);
    expect(stormTimes(plan(20, 10)).length).toBeGreaterThan(0);
    expect(isFollowUp(plan(10, 0))).toBe(true);
    expect(stormTimes(plan(10, 0))).toHaveLength(0);
  });

  it("the captor's flag goes up as far as the points taken: halfway at 10 left, to the top when captured", () => {
    expect(flagHeight(20)).toBe(0);
    expect(flagHeight(10)).toBe(0.5);
    expect(flagHeight(0)).toBe(1);
  });

  it("during a follow-up the count drops steadily from where it was to the engine's number", () => {
    const p = plan(14, 4);
    const end = stormLength(p).total;
    expect(capturePointsAt(p, 0)).toBe(14);
    expect(capturePointsAt(p, end / 2)).toBeLessThan(14);
    expect(capturePointsAt(p, end)).toBe(4);
  });
});

describe("airborne drops (08-art-pipeline §20)", () => {
  /** A transport on its owner's airfield takes an Infantry squad aboard, then lets it out next door. */
  function dropped(transportType: "transportAircraft" | "halftrack") {
    const start = makeGame(["A."], [
      { owner: 0, pos: P(0, 0), type: transportType },
      { owner: 0, pos: P(1, 0), type: "infantry" },
    ], { propertyOwners: [{ pos: P(0, 0), owner: 0 }] });
    const loaded = run(start, { type: "move", unitId: 1, path: [P(0, 0)], action: { type: "load" } }).state;
    const unload: Command = { type: "move", unitId: 0, path: [], action: { type: "unload", passenger: 1, to: P(1, 0) } };
    const event = run(loaded, unload).events.find((e): e is Extract<GameEvent, { type: "unitUnloaded" }> => e.type === "unitUnloaded");
    if (!event) throw new Error("No unload");
    return planDrop(loaded, event);
  }

  it("soldiers leaving a Transport Aircraft jump; US Infantry jump as paratroopers", () => {
    expect(dropped("transportAircraft")).toMatchObject({ unit: "infantry", paratrooper: true });
  });

  it("soldiers leaving a halftrack just get out: no drop scene", () => {
    expect(dropped("halftrack")).toBeNull();
  });

  it("men jump one after another, every one lands, and the scene ends after the last landing", () => {
    const plan = { unit: "infantry" as const, owner: 0, nation: "us" as const, hp: 10, paratrooper: true, suit: 1, terrain: "plains" as const };
    const jumps = jumpTimes(plan);
    expect(jumps).toHaveLength(8);
    jumps.forEach((j, i) => {
      expect(j.land).toBeGreaterThan(j.exit);
      if (i > 0) expect(j.exit).toBeGreaterThan(jumps[i - 1]?.exit ?? 0);
    });
    expect(dropLength(plan).settled).toBeGreaterThan(Math.max(...jumps.map((j) => j.land)));
  });
});

describe("going into a bunker (08-art-pipeline §19)", () => {
  it("foot soldiers moving onto a bunker play a garrison scene", () => {
    const state = makeGame([".X"], [{ owner: 0, pos: P(0, 0), type: "infantry" }]);
    const { events } = run(state, wait(0, [P(1, 0)]));
    expect(planGarrison(state, 0, P(0, 0), P(1, 0), events)?.kind).toBe("garrison");
  });

  it("vehicles on a bunker, and soldiers moving anywhere else, play nothing", () => {
    const state = makeGame([".X."], [
      { owner: 0, pos: P(0, 0), type: "mediumTank" },
      { owner: 0, pos: P(2, 0), type: "infantry" },
    ]);
    expect(planGarrison(state, 0, P(0, 0), P(1, 0), [])).toBeNull();
    expect(planGarrison(state, 1, P(2, 0), P(0, 0), [])).toBeNull();
  });

  it("a soldier already inside the bunker doesn't storm it again", () => {
    const state = makeGame(["X"], [{ owner: 0, pos: P(0, 0), type: "infantry" }]);
    expect(planGarrison(state, 0, P(0, 0), P(0, 0), [])).toBeNull();
  });

  it("each man of a mortar or launcher team runs in, so a full Mortar Team shows six runners", () => {
    const plan: StormPlan = {
      kind: "garrison", unit: "mortar", owner: 0, nation: "us", hp: 10, paratrooper: false, suit: 0,
      terrain: "bunker", before: 0, after: 0, captured: false, previousOwner: null, previousNation: null,
    };
    expect(stormRunners(plan)).toBe(6);
    expect(stormRunners({ ...plan, unit: "infantry" })).toBe(8);
  });
});
