import fc from "fast-check";
import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import { attackTargets, canCounter, chooseWeapon, damageFormula, forecast, MAX_LUCK, threatTiles } from "../src/engine/combat";
import type { Command, GameEvent } from "../src/engine/commands";
import type { UnitTypeId } from "../src/engine/data/units";
import { UNITS } from "../src/engine/data/units";
import type { Point } from "../src/engine/map";
import type { GameSetup, UnitSetup } from "../src/engine/setup";
import { MAX_HP, type GameState, type Unit } from "../src/engine/state";
import { deepFreeze, makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const attack = (unitId: number, target: number, path: Point[] = []): Command => ({
  type: "move",
  unitId,
  path,
  action: { type: "attack", target },
});

/** Luck off unless stated, so results are exact. Attacker is unit 0, defender unit 1. */
function duel(
  rows: string[],
  a: Partial<UnitSetup> & { type: UnitTypeId },
  d: Partial<UnitSetup> & { type: UnitTypeId },
  overrides: Partial<Omit<GameSetup, "map" | "units">> = {},
): GameState {
  return makeGame(
    rows,
    [
      { owner: 0, pos: P(0, 0), ...a },
      { owner: 1, pos: P(1, 0), ...d },
    ],
    { settings: { luck: false }, ...overrides },
  );
}

function fight(state: GameState, command: Command = attack(0, 1)) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  const combat = result.events.find((e): e is Extract<GameEvent, { type: "combat" }> => e.type === "combat");
  if (!combat) throw new Error("No combat event");
  return { state: result.state, combat, events: result.events };
}

const unitById = (state: GameState, id: number): Unit | undefined => state.units.find((u) => u.id === id);

describe("damage formula (03-combat §1)", () => {
  const full = { base: 55, attackMod: 100, luck: 0, attackerHp: 10, defenseMod: 100, terrainStars: 0, defenderHp: 10 };

  it("at full HP on 0-star terrain, damage equals the chart value", () => {
    expect(damageFormula(full)).toBe(55);
  });

  it("each terrain star protects a full-HP defender by 10%, rounded down", () => {
    expect(damageFormula({ ...full, terrainStars: 1 })).toBe(49); // 55 × 0.9 = 49.5
    expect(damageFormula({ ...full, terrainStars: 3 })).toBe(38); // 55 × 0.7 = 38.5
  });

  it("terrain protects battered units less: 1% per star per HP point", () => {
    expect(damageFormula({ ...full, terrainStars: 3, defenderHp: 2 })).toBe(51); // 55 × 0.94 = 51.7
  });

  it("a weakened attacker hits proportionally weaker", () => {
    expect(damageFormula({ ...full, attackerHp: 5 })).toBe(27); // 55 × 0.5 = 27.5
    expect(damageFormula({ ...full, attackerHp: 1 })).toBe(5);
  });

  it("luck adds to the base percentage before HP and terrain scale it", () => {
    expect(damageFormula({ ...full, luck: 9 })).toBe(64);
    expect(damageFormula({ ...full, luck: 9, attackerHp: 5 })).toBe(32); // 64 × 0.5
  });

  it("veterancy raises attackMod and defenseMod: 110 / 120", () => {
    expect(damageFormula({ ...full, attackMod: 110 })).toBe(60); // 60.5
    expect(damageFormula({ ...full, defenseMod: 120 })).toBe(44); // 55 × 0.8
  });

  it("damage never goes below 0", () => {
    expect(damageFormula({ ...full, defenseMod: 300 })).toBe(0);
  });

  it("damage above 100 is possible, so a full-HP unit can die in one hit", () => {
    expect(damageFormula({ ...full, base: 110 })).toBe(110);
  });
});

describe("attack resolution (03-combat §2)", () => {
  it("damages the defender using the tile it stands on", () => {
    const { state, combat } = fight(duel(["=F"], { type: "mediumTank" }, { type: "infantry" }));
    expect(combat.attack).toEqual({ weapon: "secondary", luck: 0, damage: 60 }); // 75 × 0.8
    expect(unitById(state, 1)?.hp).toBe(40);
  });

  it("the counter uses the defender's reduced HP", () => {
    // 75 × 0.8 = 60 taken, leaving 40 HP (displays 4). Infantry vs tank is 5: 5 × 0.4 × 1.0 on road.
    const { state, combat } = fight(duel(["=F"], { type: "mediumTank" }, { type: "infantry" }));
    expect(combat.counter).toEqual({ weapon: "secondary", luck: 0, damage: 2 });
    expect(unitById(state, 0)?.hp).toBe(98);
  });

  it("direct units can move and then attack", () => {
    const state = makeGame(["===", "==="], [
      { type: "mediumTank", owner: 0, pos: P(0, 0) },
      { type: "mediumTank", owner: 1, pos: P(2, 0) },
    ], { settings: { luck: false } });
    const { state: after, events } = fight(state, attack(0, 1, [P(1, 0)]));
    expect(events.map((e) => e.type)).toEqual(["unitMoved", "combat"]);
    expect(unitById(after, 0)).toMatchObject({ pos: P(1, 0), hasActed: true, fuel: 69 });
  });

  it("the counter uses the terrain the attacker moved onto", () => {
    const state = makeGame(["=F="], [
      { type: "mediumTank", owner: 0, pos: P(0, 0) },
      { type: "mediumTank", owner: 1, pos: P(2, 0) },
    ], { settings: { luck: false } });
    const { combat } = fight(state, attack(0, 1, [P(1, 0)]));
    // Defender keeps 45 HP (5 displayed): 55 × 0.5 = 27 on road; in forest (2★ × attacker 10 HP) × 0.8 = 22.
    expect(combat.counter?.damage).toBe(22);
  });

  it("attacking ends the unit's action and doesn't emit a wait", () => {
    const { state, events } = fight(duel(["=="], { type: "mediumTank" }, { type: "infantry" }));
    expect(unitById(state, 0)?.hasActed).toBe(true);
    expect(events.map((e) => e.type)).not.toContain("unitWaited");
  });

  it("a destroyed defender is removed and doesn't counter", () => {
    const { state, combat } = fight(duel(["=="], { type: "mediumTank" }, { type: "infantry", hp: 30 }));
    expect(combat.defender).toMatchObject({ hp: 0, destroyed: true });
    expect(combat.attack.damage).toBe(30); // the HP actually removed, not the 75 rolled
    expect(combat.counter).toBeNull();
    expect(unitById(state, 1)).toBeUndefined();
  });

  it("an attacker can be destroyed by the counter", () => {
    const { state, combat } = fight(duel(["=="], { type: "infantry", hp: 5 }, { type: "heavyTank" }));
    expect(combat.attacker).toMatchObject({ hp: 0, destroyed: true });
    expect(unitById(state, 0)).toBeUndefined();
  });
});

describe("weapon choice and ammo (03-combat §2)", () => {
  const tank = (ammo: number) => duel(["=="], { type: "mediumTank", ammo }, { type: "mediumTank" });

  it("the primary weapon spends 1 ammo", () => {
    const { state, combat } = fight(tank(5));
    expect(combat.attack.weapon).toBe("primary");
    expect(unitById(state, 0)?.ammo).toBe(4);
  });

  it("secondary weapons don't use ammo", () => {
    const { state } = fight(duel(["=="], { type: "mediumTank", ammo: 5 }, { type: "infantry" }));
    expect(unitById(state, 0)?.ammo).toBe(5);
  });

  it("a counter with the primary weapon spends ammo too", () => {
    const { state } = fight(tank(5));
    expect(unitById(state, 1)?.ammo).toBe(8);
  });

  it("with no ammo, a unit can still use its secondary weapon where the chart has one", () => {
    const state = duel(["=="], { type: "mediumTank", ammo: 0 }, { type: "infantry" });
    expect(apply(state, attack(0, 1)).ok).toBe(true);
  });

  it("with no ammo, a unit can't attack targets the chart only lists for its primary weapon", () => {
    expect(apply(tank(0), attack(0, 1))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("a defender with no ammo can't counter with its primary weapon", () => {
    const { combat } = fight(duel(["=="], { type: "mediumTank" }, { type: "mediumTank", ammo: 0 }));
    expect(combat.counter).toBeNull();
  });

  it("units without a chart value can't attack that target", () => {
    const state = duel(["=="], { type: "tankDestroyer" }, { type: "infantry" });
    expect(chooseWeapon(state.units[0] as Unit, "infantry")).toBeNull();
    expect(apply(state, attack(0, 1))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("unarmed units can't attack", () => {
    expect(apply(duel(["=="], { type: "halftrack" }, { type: "infantry" }), attack(0, 1)))
      .toMatchObject({ ok: false, code: "invalidTarget" });
  });
});

describe("indirect fire (03-combat §2)", () => {
  const artillery = (distanceTiles: number) => {
    const state = makeGame(["======="], [
      { type: "artillery", owner: 0, pos: P(0, 0) },
      { type: "mediumTank", owner: 1, pos: P(distanceTiles, 0) },
    ], { settings: { luck: false } });
    return state;
  };

  it("hits targets at its range: Artillery 2–3", () => {
    expect(apply(artillery(2), attack(0, 1)).ok).toBe(true);
    expect(apply(artillery(3), attack(0, 1)).ok).toBe(true);
  });

  it("can't hit adjacent targets or targets beyond its range", () => {
    expect(apply(artillery(1), attack(0, 1))).toMatchObject({ ok: false, code: "invalidTarget" });
    expect(apply(artillery(4), attack(0, 1))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("the Mortar Team's range is exactly 2", () => {
    const mortar = (x: number) => makeGame(["====="], [
      { type: "mortar", owner: 0, pos: P(0, 0) },
      { type: "infantry", owner: 1, pos: P(x, 0) },
    ]);
    expect(apply(mortar(2), attack(0, 1)).ok).toBe(true);
    expect(apply(mortar(1), attack(0, 1)).ok).toBe(false);
    expect(apply(mortar(3), attack(0, 1)).ok).toBe(false);
  });

  it("can't move and fire", () => {
    const state = makeGame(["====="], [
      { type: "artillery", owner: 0, pos: P(0, 0) },
      { type: "mediumTank", owner: 1, pos: P(3, 0) },
    ]);
    expect(apply(state, attack(0, 1, [P(1, 0)]))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("indirect units are never countered when they fire", () => {
    expect(fight(artillery(2)).combat.counter).toBeNull();
  });

  it("indirect units never counterattack", () => {
    const { combat } = fight(duel(["=="], { type: "mediumTank" }, { type: "artillery" }));
    expect(combat.counter).toBeNull();
  });
});

describe("target validation", () => {
  const state = makeGame(["===="], [
    { type: "mediumTank", owner: 0, pos: P(0, 0) },
    { type: "infantry", owner: 0, pos: P(1, 0) },
    { type: "infantry", owner: 1, pos: P(3, 0) },
  ]);

  it("rejects friendly targets", () => {
    expect(apply(state, attack(0, 1))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("rejects direct attacks that aren't adjacent", () => {
    expect(apply(state, attack(0, 2))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("rejects unknown targets", () => {
    expect(apply(state, attack(0, 99))).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("rejects malformed attack actions from untyped code", () => {
    const bad = { type: "move", unitId: 0, path: [], action: { type: "attack", target: "them" } } as unknown as Command;
    expect(apply(state, bad)).toMatchObject({ ok: false, code: "invalidCommand" });
  });

  it("a rejected attack changes nothing, including the unit's move", () => {
    expect(apply(state, attack(0, 2, [])).ok).toBe(false);
    expect(state.units[0]).toMatchObject({ pos: P(0, 0), hasActed: false });
  });

  it("lists the targets a unit can hit from where it stands", () => {
    const game = makeGame(["===="], [
      { type: "mediumTank", owner: 0, pos: P(1, 0) },
      { type: "infantry", owner: 1, pos: P(0, 0) },
      { type: "infantry", owner: 1, pos: P(3, 0) },
    ]);
    expect(attackTargets(game, game.units[0] as Unit, false).map((u) => u.id)).toEqual([1]);
  });
});

describe("luck (03-combat §3)", () => {
  const lucky = (seed: number) => makeGame(["=="], [
    { type: "mediumTank", owner: 0, pos: P(0, 0) },
    { type: "mediumTank", owner: 1, pos: P(1, 0) },
  ], { seed });

  it("adds 0–9 to the attack, with the same seed giving the same roll", () => {
    const first = fight(lucky(7)).combat;
    expect(first.attack.luck).toBeGreaterThanOrEqual(0);
    expect(first.attack.luck).toBeLessThanOrEqual(MAX_LUCK);
    expect(first.attack.damage).toBe(55 + first.attack.luck);
    expect(fight(lucky(7)).combat).toEqual(first);
  });

  it("the attack and the counter each advance the RNG", () => {
    const state = lucky(7);
    const after = fight(state).state;
    expect(after.rng).not.toBe(state.rng);
    const noCounter = makeGame(["=="], [
      { type: "mediumTank", owner: 0, pos: P(0, 0) },
      { type: "mediumTank", owner: 1, pos: P(1, 0), hp: 10 },
    ], { seed: 7 });
    expect(fight(noCounter).state.rng).not.toBe(after.rng); // one roll vs two
  });

  it("the no-luck setting makes luck 0 and leaves the RNG alone", () => {
    const state = duel(["=="], { type: "mediumTank" }, { type: "mediumTank" });
    const { state: after, combat } = fight(state);
    expect(combat.attack.luck).toBe(0);
    expect(after.rng).toBe(state.rng);
  });

  it("different seeds eventually give different rolls", () => {
    const rolls = new Set(Array.from({ length: 40 }, (_, seed) => fight(lucky(seed)).combat.attack.luck));
    expect(rolls.size).toBeGreaterThan(3);
  });
});

describe("kills and veterancy (03-combat §6)", () => {
  it("destroying a unit counts as a kill", () => {
    const { state, combat } = fight(duel(["=="], { type: "mediumTank", kills: 1 }, { type: "infantry", hp: 10 }));
    expect(unitById(state, 0)?.kills).toBe(2);
    expect(combat.attacker.promotedTo).toBeNull();
  });

  it("the third kill promotes to Veteran, and the event says so", () => {
    const { state, combat } = fight(duel(["=="], { type: "mediumTank", kills: 2 }, { type: "infantry", hp: 10 }));
    expect(unitById(state, 0)?.kills).toBe(3);
    expect(combat.attacker.promotedTo).toBe("veteran");
  });

  it("the ninth kill promotes to Elite", () => {
    const { combat } = fight(duel(["=="], { type: "mediumTank", kills: 8 }, { type: "infantry", hp: 10 }));
    expect(combat.attacker.promotedTo).toBe("elite");
  });

  it("a kill by counterattack counts", () => {
    const { state, combat } = fight(duel(["=="], { type: "infantry", hp: 5 }, { type: "heavyTank", kills: 2 }));
    expect(unitById(state, 1)?.kills).toBe(3);
    expect(combat.defender.promotedTo).toBe("veteran");
  });

  it("a kill by indirect fire counts", () => {
    const state = makeGame(["==="], [
      { type: "artillery", owner: 0, pos: P(0, 0) },
      { type: "infantry", owner: 1, pos: P(2, 0), hp: 5 },
    ], { settings: { luck: false } });
    expect(unitById(fight(state).state, 0)?.kills).toBe(1);
  });

  it("damage without a kill adds nothing", () => {
    const { state } = fight(duel(["=="], { type: "mediumTank" }, { type: "mediumTank" }));
    expect(unitById(state, 0)?.kills).toBe(0);
  });

  it("a veteran hits harder and takes less", () => {
    const rookie = fight(duel(["=="], { type: "mediumTank" }, { type: "mediumTank" })).combat;
    const veteran = fight(duel(["=="], { type: "mediumTank", kills: 3 }, { type: "mediumTank", kills: 3 })).combat;
    expect(rookie.attack.damage).toBe(55);
    expect(veteran.attack.damage).toBe(54); // 60.5 × (200 − 110) / 100
  });
});

describe("forecast (03-combat §2)", () => {
  it("shows the damage range at lowest and highest luck", () => {
    const state = makeGame(["=="], [
      { type: "mediumTank", owner: 0, pos: P(0, 0) },
      { type: "mediumTank", owner: 1, pos: P(1, 0) },
    ]);
    expect(forecast(state, state.units[0] as Unit, state.units[1] as Unit)?.attack).toEqual({ min: 55, max: 64 });
  });

  it("with luck off, min equals max", () => {
    const state = duel(["=="], { type: "mediumTank" }, { type: "mediumTank" });
    expect(forecast(state, state.units[0] as Unit, state.units[1] as Unit)?.attack).toEqual({ min: 55, max: 55 });
  });

  it("shows the likely counter", () => {
    const state = duel(["=="], { type: "mediumTank" }, { type: "mediumTank" });
    // 55 taken leaves 45 HP (5 displayed): 55 × 0.5 = 27 back.
    expect(forecast(state, state.units[0] as Unit, state.units[1] as Unit)?.counter).toEqual({ min: 27, max: 27 });
  });

  it("has no counter when the kill is certain", () => {
    const state = duel(["=="], { type: "mediumTank" }, { type: "infantry", hp: 30 });
    const result = forecast(state, state.units[0] as Unit, state.units[1] as Unit);
    expect(result).toMatchObject({ certainKill: true, canKill: true, counter: null });
  });

  it("the counter can be 0 when the kill depends on luck", () => {
    const state = makeGame(["=="], [
      { type: "mediumTank", owner: 0, pos: P(0, 0) },
      { type: "mediumTank", owner: 1, pos: P(1, 0), hp: 60 }, // luck 0: 55 leaves 5; luck 9: 64 kills
    ]);
    const result = forecast(state, state.units[0] as Unit, state.units[1] as Unit);
    expect(result).toMatchObject({ canKill: true, certainKill: false });
    expect(result?.counter?.min).toBe(0);
  });

  it("warns when the counter would destroy a weak attacker", () => {
    const state = duel(["=="], { type: "infantry", hp: 20 }, { type: "mediumTank" });
    expect(forecast(state, state.units[0] as Unit, state.units[1] as Unit)).toMatchObject({
      counterCanKill: true,
      counterCertainKill: true,
    });
  });

  it("is null when the unit has no weapon for the target", () => {
    const state = duel(["=="], { type: "tankDestroyer" }, { type: "infantry" });
    expect(forecast(state, state.units[0] as Unit, state.units[1] as Unit)).toBeNull();
  });

  it("has no counter against indirect fire", () => {
    const state = makeGame(["==="], [
      { type: "artillery", owner: 0, pos: P(0, 0) },
      { type: "mediumTank", owner: 1, pos: P(2, 0) },
    ]);
    expect(forecast(state, state.units[0] as Unit, state.units[1] as Unit)?.counter).toBeNull();
    expect(canCounter(state, state.units[0] as Unit, state.units[1] as Unit)).toBe(false);
  });
});

describe("threat range", () => {
  it("a direct unit threatens every tile next to where it can move", () => {
    const state = makeGame([".....", ".....", "....."], [{ type: "infantry", owner: 0, pos: P(0, 1) }]);
    const tiles = threatTiles(state, state.units[0] as Unit).map((p) => `${p.x},${p.y}`);
    expect(tiles).toContain("4,1"); // moves 3, hits 1 more
    expect(tiles).not.toContain("4,0");
  });

  it("an indirect unit only threatens its range from where it stands", () => {
    const state = makeGame([".........."], [{ type: "artillery", owner: 0, pos: P(4, 0) }]);
    expect(threatTiles(state, state.units[0] as Unit).map((p) => p.x)).toEqual([1, 2, 6, 7]);
  });

  it("unarmed units threaten nothing", () => {
    const state = makeGame(["..."], [{ type: "halftrack", owner: 0, pos: P(0, 0) }]);
    expect(threatTiles(state, state.units[0] as Unit)).toEqual([]);
  });
});

describe("combat properties", () => {
  const armed = (["infantry", "assaultInfantry", "recon", "lightTank", "mediumTank", "heavyTank", "tankDestroyer", "mobileAA"] as const);
  const hp = fc.integer({ min: 1, max: MAX_HP });

  const arbitraryDuel = fc.record({
    a: fc.constantFrom(...armed),
    d: fc.constantFrom(...armed),
    aHp: hp,
    dHp: hp,
    aKills: fc.nat(10),
    dKills: fc.nat(10),
    aTerrain: fc.constantFrom(".", "=", "F", "H", "C", "X", "b"),
    dTerrain: fc.constantFrom(".", "=", "F", "H", "C", "X", "b"),
    seed: fc.integer(),
  }).map(({ a, d, aHp, dHp, aKills, dKills, aTerrain, dTerrain, seed }) => makeGame([`${aTerrain}${dTerrain}`], [
    { type: a, owner: 0, pos: P(0, 0), hp: aHp, kills: aKills },
    { type: d, owner: 1, pos: P(1, 0), hp: dHp, kills: dKills },
  ], { seed })).filter((state) => forecast(state, state.units[0] as Unit, state.units[1] as Unit) !== null);

  it("HP stays within 0–100 and destroyed units are gone", () => {
    fc.assert(fc.property(arbitraryDuel, (state) => {
      const after = fight(state).state;
      for (const u of after.units) {
        expect(u.hp).toBeGreaterThan(0);
        expect(u.hp).toBeLessThanOrEqual(MAX_HP);
        expect(u.ammo).toBeGreaterThanOrEqual(0);
      }
    }));
  });

  it("the actual result always falls inside the forecast", () => {
    fc.assert(fc.property(arbitraryDuel, (state) => {
      const [a, d] = state.units as [Unit, Unit];
      const f = forecast(state, a, d);
      const { combat } = fight(state);
      if (!f) throw new Error("filtered out");
      expect(combat.attack.damage).toBe(Math.min(d.hp, combat.attack.damage));
      if (combat.attack.damage < d.hp) {
        expect(combat.attack.damage).toBeGreaterThanOrEqual(f.attack.min);
        expect(combat.attack.damage).toBeLessThanOrEqual(f.attack.max);
      } else {
        expect(f.canKill).toBe(true);
      }
      if (combat.counter) {
        expect(f.counter).not.toBeNull();
        const taken = combat.counter.damage;
        expect(taken).toBeLessThanOrEqual(f.counter?.max ?? -1);
        if (taken < a.hp) expect(taken).toBeGreaterThanOrEqual(f.counter?.min ?? Infinity);
      }
    }));
  });

  it("damage reported equals HP actually lost", () => {
    fc.assert(fc.property(arbitraryDuel, (state) => {
      const [a, d] = state.units as [Unit, Unit];
      const { combat } = fight(state);
      expect(combat.defender.hp).toBe(d.hp - combat.attack.damage);
      expect(combat.attacker.hp).toBe(a.hp - (combat.counter?.damage ?? 0));
    }));
  });

  it("the same state and command give the same result, without mutating anything", () => {
    fc.assert(fc.property(arbitraryDuel, (state) => {
      const frozen = deepFreeze(state);
      expect(apply(frozen, attack(0, 1))).toEqual(apply(frozen, attack(0, 1)));
    }));
  });
});

describe("chart coverage in play", () => {
  it("every armed land unit can resolve an attack on every land unit the chart allows", () => {
    const land = Object.keys(UNITS).filter((id) => UNITS[id as UnitTypeId].category === "land") as UnitTypeId[];
    for (const a of land) {
      for (const d of land) {
        const state = makeGame(["======"], [
          { type: a, owner: 0, pos: P(0, 0) },
          { type: d, owner: 1, pos: P(UNITS[a].range?.min ?? 1, 0) },
        ]);
        const unit = state.units[0] as Unit;
        const canFire = chooseWeapon(unit, d) !== null && UNITS[a].range !== null;
        if (canFire) expect(apply(state, attack(0, 1)).ok, `${a} vs ${d}`).toBe(true);
      }
    }
  });
});
