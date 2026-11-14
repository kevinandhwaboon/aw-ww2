import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import { attackTargets, forecast, fortForecast, fortTargets, garrisonBunker, MAX_LUCK } from "../src/engine/combat";
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
const attack = (unitId: number, target: number, path: Point[] = []): Command => ({ type: "move", unitId, path, action: { type: "attack", target } });
const combatEvent = (events: readonly GameEvent[]) => {
  const event = events.find((e): e is Extract<GameEvent, { type: "combat" }> => e.type === "combat");
  if (!event) throw new Error("no combat event");
  return event;
};
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

  it("a vehicle on a bunker is hit directly, and gets the bunker's 5 stars", () => {
    const state = game(["=X"], [u("assaultInfantry", 0), u("mediumTank", 1, { owner: 1 })]);
    const { state: after } = must(state, attack(0, 1));
    expect(after.units[1]?.hp).toBe(73); // 55 × (200 − 100 − 50) / 100 = 27 damage
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

describe("garrisoned bunkers: the attacker must break the bunker (03-combat §4)", () => {
  const garrisoned = (attacker: UnitSetup["type"] = "assaultInfantry") =>
    game(["=X"], [u(attacker, 0), u("infantry", 1, { owner: 1 })]);

  it("Infantry, Assault Infantry and Mortar Teams in a bunker are a garrison; vehicles aren't", () => {
    for (const type of ["infantry", "assaultInfantry", "mortar"] as const) {
      const state = game(["X"], [u(type, 0)]);
      expect(garrisonBunker(state, state.units[0] as Unit), type).toBeDefined();
    }
    const tank = game(["X"], [u("mediumTank", 0)]);
    expect(garrisonBunker(tank, tank.units[0] as Unit)).toBeUndefined();
  });

  it("an attack on a garrison hits the bunker instead, with the bunker's HP and defense", () => {
    const { state, events } = must(garrisoned(), attack(0, 1));
    expect(fortAt(state, P(1, 0))?.hp).toBe(35); // Assault Infantry vs Fort: 65, no terrain stars
    expect(state.units[1]?.hp).toBe(100);
    expect(events).toContainEqual(expect.objectContaining({ type: "combat", bunker: { pos: P(1, 0), hp: 35, becomes: null } }));
  });

  it("the garrison fires back at full strength while the bunker stands", () => {
    const { state, events } = must(garrisoned(), attack(0, 1));
    expect(state.units[0]?.hp).toBe(55); // a 10 HP Infantry vs Assault Infantry: 45
    expect(combatEvent(events).counter?.damage).toBe(45);
  });

  it("when the bunker breaks, the garrison dies with it, and that counts as a kill", () => {
    const state = game(["==X"], [u("artillery", 0), u("infantry", 2, { owner: 1 })]);
    const shell = attack(0, 1);
    const once = run(state, shell, endTurn, endTurn);
    expect(fortAt(once, P(2, 0))?.hp).toBe(50); // Artillery vs Fort: 50
    const { state: after, events } = must(once, shell);
    expect(terrainAt(after.map, P(2, 0))).toBe("rubble");
    expect(after.units.map((x) => x.id)).toEqual([0]);
    expect(after.units[0]?.kills).toBe(1);
    expect(combatEvent(events).defender.destroyed).toBe(true);
    expect(combatEvent(events).bunker).toEqual({ pos: P(2, 0), hp: 0, becomes: "rubble" });
  });

  it("a unit with no weapon against fortifications can't attack a garrison", () => {
    const state = garrisoned("recon");
    expect(attackTargets(state, state.units[0] as Unit, false)).toEqual([]);
    expect(apply(state, attack(0, 1))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("the forecast shows the damage to the bunker and the garrison's full-strength counter", () => {
    const state = garrisoned();
    expect(forecast(state, state.units[0] as Unit, state.units[1] as Unit)).toMatchObject({
      attack: { min: 65, max: 65 },
      counter: { min: 45, max: 45 },
      canKill: false,
    });
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

  it("rubble gives far less cover than a bunker (02-terrain §4)", () => {
    const state = twoHits(["=X"], 1).state;
    const moved = run(state, endTurn, endTurn, { type: "move", unitId: 0, path: [P(1, 0)], action: { type: "wait" } });
    expect(stats.terrainStars(moved, moved.units[0] as Unit)).toBe(1);
  });

  it("a destroyed bunker is gone for good: soldiers on the rubble are no garrison and are hit directly", () => {
    const state = twoHits(["=X"], 1).state;
    const moved = run(state, endTurn, endTurn, { type: "move", unitId: 0, path: [P(1, 0)], action: { type: "wait" } });
    expect(garrisonBunker(moved, moved.units[0] as Unit)).toBeUndefined();
    expect(fortAt(moved, P(1, 0))).toBeUndefined();
    expect(terrainAt(moved.map, P(1, 0))).toBe("rubble");
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
