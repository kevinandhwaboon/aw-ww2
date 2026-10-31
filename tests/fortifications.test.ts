import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import { fortForecast, fortTargets, MAX_LUCK } from "../src/engine/combat";
import type { Command, GameEvent } from "../src/engine/commands";
import type { Point } from "../src/engine/map";
import { terrainAt } from "../src/engine/map";
import { moveDestinations } from "../src/engine/movement";
import type { UnitSetup } from "../src/engine/setup";
import { fortAt, MAX_HP, type GameState, type Unit } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { deepFreeze, makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const endTurn: Command = { type: "endTurn" };
const hit = (unitId: number, target: Point, path: Point[] = []): Command => ({
  type: "move",
  unitId,
  path,
  action: { type: "attackFort", target },
});

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}
const run = (state: GameState, ...commands: Command[]) => commands.reduce((s, c) => must(s, c).state, state);
const fortEvent = (events: readonly GameEvent[]) => {
  const event = events.find((e): e is Extract<GameEvent, { type: "fortAttacked" }> => e.type === "fortAttacked");
  if (!event) throw new Error("no fortAttacked event");
  return event;
};

const u = (type: UnitSetup["type"], x: number, extra: Partial<UnitSetup> = {}): UnitSetup =>
  ({ type, owner: 0, pos: P(x, 0), ...extra });

/** Luck off unless stated, so results are exact. */
const game = (rows: string[], units: UnitSetup[], luck = false) => makeGame(rows, units, { settings: { luck } });

describe("fortifications start with HP (02-terrain §4, 03-combat §4)", () => {
  it("every bunker and obstacle on the map starts at 100 HP", () => {
    const state = game(["X.o"], []);
    expect(state.fortifications).toEqual([{ pos: P(0, 0), hp: 100 }, { pos: P(2, 0), hp: 100 }]);
  });
});

describe("attacking a fortification (03-combat §4)", () => {
  it("damage comes from the chart's Fort column, with no terrain defense", () => {
    const { state, events } = must(game(["=X"], [u("assaultInfantry", 0)]), hit(0, P(1, 0)));
    expect(fortAt(state, P(1, 0))?.hp).toBe(35); // Assault Infantry vs Fort: 65
    expect(fortEvent(events)).toMatchObject({ attack: { weapon: "primary", luck: 0, damage: 65 }, hp: 35, becomes: null });
  });

  it("a weakened attacker does proportionally less", () => {
    expect(fortAt(run(game(["=X"], [u("assaultInfantry", 0, { hp: 50 })]), hit(0, P(1, 0))), P(1, 0))?.hp).toBe(68); // 65 × 0.5 = 32
  });

  it("veterancy raises the damage", () => {
    expect(fortAt(run(game(["=X"], [u("assaultInfantry", 0, { kills: 3 })]), hit(0, P(1, 0))), P(1, 0))?.hp).toBe(29); // 71.5
  });

  it("the primary weapon spends ammo; a secondary weapon doesn't", () => {
    const after = run(game(["=X"], [u("assaultInfantry", 0)]), hit(0, P(1, 0)));
    expect(after.units[0]?.ammo).toBe(2);
    const rifle = run(game(["=X"], [u("infantry", 0)]), hit(0, P(1, 0)));
    expect(fortAt(rifle, P(1, 0))?.hp).toBe(95); // Infantry vs Fort: 5*
  });

  it("luck applies", () => {
    const state = makeGame(["=X"], [u("assaultInfantry", 0)], { seed: 7 });
    const { attack } = fortEvent(must(state, hit(0, P(1, 0))).events);
    expect(attack.damage).toBe(65 + attack.luck);
    expect(must(state, hit(0, P(1, 0))).state.rng).not.toBe(state.rng);
  });

  it("the unit can move and then attack, and that ends its action", () => {
    const state = game(["==X"], [u("assaultInfantry", 0)]);
    const { state: after, events } = must(state, hit(0, P(2, 0), [P(1, 0)]));
    expect(events.map((e) => e.type)).toEqual(["unitMoved", "fortAttacked"]);
    expect(after.units[0]).toMatchObject({ pos: P(1, 0), hasActed: true });
  });

  it("indirect units use their normal range, and can't move and fire", () => {
    const state = game(["=====X"], [u("artillery", 3)]);
    expect(fortAt(run(state, hit(0, P(5, 0))), P(5, 0))?.hp).toBe(50);
    expect(apply(game(["======X"], [u("artillery", 3)]), hit(0, P(6, 0), [P(4, 0)])))
      .toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("fortifications never counterattack", () => {
    const { state, events } = must(game(["=X"], [u("infantry", 0)]), hit(0, P(1, 0)));
    expect(state.units[0]?.hp).toBe(100);
    expect(events).toHaveLength(1);
  });

  it("either side can demolish a bunker, even an empty one nobody owns", () => {
    const state = game(["=X="], [u("assaultInfantry", 0), u("assaultInfantry", 2, { owner: 1 })]);
    expect(fortAt(run(state, hit(0, P(1, 0)), endTurn, hit(1, P(1, 0))), P(1, 0))).toBeUndefined();
  });

  it("obstacles are attacked the same way", () => {
    expect(fortAt(run(game(["=o"], [u("assaultInfantry", 0)]), hit(0, P(1, 0))), P(1, 0))?.hp).toBe(35);
  });

  it("damage goes through the modifier layer", () => {
    const state = makeGame(["=X"], [u("assaultInfantry", 0)], {
      settings: { luck: false },
      modifiers: [{ source: "concrete", stat: "defense", op: "add", value: 20, scope: { terrain: ["bunker"] } }],
    });
    expect(fortAt(run(state, hit(0, P(1, 0))), P(1, 0))?.hp).toBe(48); // 65 × 0.8 = 52
  });
});

describe("occupied fortifications (03-combat §4)", () => {
  const occupied = () => game(["=X"], [u("assaultInfantry", 0), u("infantry", 1, { owner: 1 })]);

  it("can't be attacked while a unit is on them, friend or foe", () => {
    expect(apply(occupied(), hit(0, P(1, 0)))).toMatchObject({ ok: false, code: "invalidTarget" });
    const friendly = game(["=X"], [u("assaultInfantry", 0), u("infantry", 1)]);
    expect(apply(friendly, hit(0, P(1, 0)))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("attacks hit the unit instead, which gets the bunker's 5 stars", () => {
    const state = occupied();
    const { state: after } = must(state, { type: "move", unitId: 0, path: [], action: { type: "attack", target: 1 } });
    expect(after.units[1]?.hp).toBe(68); // 65 × (200 − 100 − 50) / 100 = 32 damage
    expect(fortAt(after, P(1, 0))?.hp).toBe(100);
  });

  it("once the defender is gone, the bunker can be demolished", () => {
    const state = game(["=X", "=="], [u("assaultInfantry", 0), u("infantry", 1)]);
    expect(fortTargets(state, state.units[0] as Unit, false)).toEqual([]);
    const after = run(state, { type: "move", unitId: 1, path: [P(1, 1)], action: { type: "wait" } });
    expect(fortTargets(after, after.units[0] as Unit, false)).toEqual([P(1, 0)]);
  });

  it("a unit can step off a bunker and attack it the same turn", () => {
    const state = game(["=X="], [u("assaultInfantry", 1)]);
    expect(fortAt(run(state, hit(0, P(1, 0), [P(0, 0)])), P(1, 0))?.hp).toBe(35);
  });

  it("a damaged bunker still gives its full 5 stars", () => {
    const state = game(["=X", "=="], [u("assaultInfantry", 0), { type: "infantry", owner: 0, pos: P(1, 1) }]);
    const after = run(state, hit(0, P(1, 0)), endTurn, endTurn, { type: "move", unitId: 1, path: [P(1, 0)], action: { type: "wait" } });
    expect(fortAt(after, P(1, 0))?.hp).toBe(35);
    expect(stats.terrainStars(after, after.units[1] as Unit)).toBe(5);
  });
});

describe("breaking fortifications (02-terrain §4, 03-combat §4)", () => {
  const twoHits = (rows: string[], x: number) => {
    const state = game(rows, [u("assaultInfantry", 0)]);
    return must(run(state, hit(0, P(x, 0)), endTurn, endTurn), hit(0, P(x, 0)));
  };

  it("a bunker at 0 HP becomes rubble", () => {
    const { state, events } = twoHits(["=X"], 1);
    expect(terrainAt(state.map, P(1, 0))).toBe("rubble");
    expect(fortAt(state, P(1, 0))).toBeUndefined();
    expect(fortEvent(events)).toMatchObject({ hp: 0, becomes: "rubble", attack: { damage: 35 } }); // only the HP that was left
  });

  it("an obstacle at 0 HP becomes plains, which opens the way through", () => {
    const state = game(["=o="], [u("assaultInfantry", 0)]);
    const unit = state.units[0] as Unit;
    expect(moveDestinations(state, unit)).not.toContainEqual(P(2, 0));
    const after = run(state, hit(0, P(1, 0)), endTurn, endTurn, hit(0, P(1, 0)), endTurn, endTurn);
    expect(terrainAt(after.map, P(1, 0))).toBe("plains");
    expect(moveDestinations(after, after.units[0] as Unit)).toContainEqual(P(2, 0));
  });

  it("rubble can't be attacked", () => {
    const { state } = twoHits(["=X"], 1);
    const next = run(state, endTurn, endTurn);
    expect(apply(next, hit(0, P(1, 0)))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("rubble gives far less cover than a bunker", () => {
    const state = twoHits(["=X"], 1).state;
    const moved = run(state, endTurn, endTurn, { type: "move", unitId: 0, path: [P(1, 0)], action: { type: "wait" } });
    expect(stats.terrainStars(moved, moved.units[0] as Unit)).toBe(1);
  });

  it("breaking one doesn't count as a kill", () => {
    expect(twoHits(["=X"], 1).state.units[0]?.kills).toBe(0);
  });
});

describe("who can attack (03-combat §5b)", () => {
  it("only targets the chart has a Fort value for: Recon can't", () => {
    expect(apply(game(["=X"], [u("recon", 0)]), hit(0, P(1, 0)))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("a unit out of ammo can't use a primary weapon on it", () => {
    expect(apply(game(["=X"], [u("assaultInfantry", 0, { ammo: 0 })]), hit(0, P(1, 0))))
      .toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("rejects tiles with no fortification, or out of range", () => {
    expect(apply(game(["=="], [u("assaultInfantry", 0)]), hit(0, P(1, 0)))).toMatchObject({ ok: false, code: "invalidTarget" });
    expect(apply(game(["==X"], [u("assaultInfantry", 0)]), hit(0, P(2, 0)))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("rejects malformed targets from untyped code", () => {
    const bad = { type: "move", unitId: 0, path: [], action: { type: "attackFort", target: "there" } } as unknown as Command;
    expect(apply(game(["=X"], [u("assaultInfantry", 0)]), bad)).toMatchObject({ ok: false, code: "invalidCommand" });
  });
});

describe("forecast", () => {
  it("shows the damage range and no counter", () => {
    const state = makeGame(["=X"], [u("assaultInfantry", 0)]);
    expect(fortForecast(state, state.units[0] as Unit, P(1, 0))).toMatchObject({
      attack: { min: 65, max: 65 + MAX_LUCK },
      counter: null,
      canKill: false,
    });
  });

  it("flags when the hit could break it", () => {
    const first = run(makeGame(["=X"], [u("assaultInfantry", 0)], { seed: 7 }), hit(0, P(1, 0)));
    expect(fortForecast(first, first.units[0] as Unit, P(1, 0))).toMatchObject({ canKill: true, certainKill: true });
  });
});

describe("fortification properties", () => {
  const attackers = ["assaultInfantry", "infantry", "mortar", "mediumTank", "heavyTank", "artillery"] as const;

  it("HP only ever goes down, within the forecast, and the state stays pure", () => {
    fc.assert(fc.property(
      fc.constantFrom(...attackers),
      fc.integer({ min: 1, max: MAX_HP }),
      fc.nat(10),
      fc.integer(),
      (type, hp, kills, seed) => {
        const x = type === "mortar" || type === "artillery" ? 2 : 1;
        const state = deepFreeze(makeGame(["=".repeat(x) + "X"], [u(type, 0, { hp, kills })], { seed }));
        const forecast = fortForecast(state, state.units[0] as Unit, P(x, 0));
        const { state: after, events } = must(state, hit(0, P(x, 0)));
        const { attack } = fortEvent(events);
        expect(attack.damage).toBeGreaterThanOrEqual(forecast?.attack.min ?? Infinity);
        expect(attack.damage).toBeLessThanOrEqual(forecast?.attack.max ?? -1);
        expect(fortAt(after, P(x, 0))?.hp).toBe(100 - attack.damage);
      },
    ));
  });
});
