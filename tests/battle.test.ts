import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, GameEvent } from "../src/engine/commands";
import type { UnitTypeId } from "../src/engine/data/units";
import type { Point } from "../src/engine/map";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import { figureCount, fireKind, planCombat, planFortAttack, squadWeapon, type BattlePlan } from "../src/game/battle/plan";
import { buildTimeline, deathTimes, FIRE_TIMING, figureTiming, hpAt } from "../src/game/battle/timeline";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });

function duel(rows: string[], a: Partial<UnitSetup> & { type: UnitTypeId }, d: Partial<UnitSetup> & { type: UnitTypeId }, facing?: ["left" | "right", "left" | "right"]): GameState {
  return makeGame(
    rows,
    [
      { owner: 0, pos: P(0, 0), ...a },
      { owner: 1, pos: P(1, 0), ...d },
    ],
    {
      settings: { luck: false },
      ...(facing
        ? {
            players: [
              { name: "Allies", nation: "us", facing: facing[0] },
              { name: "Axis", nation: "germany", facing: facing[1] },
            ],
          }
        : {}),
    },
  );
}

function combat(state: GameState, attacker = 0, target = 1): Extract<GameEvent, { type: "combat" }> {
  const command: Command = { type: "move", unitId: attacker, path: [], action: { type: "attack", target } };
  const result = apply(state, command);
  if (!result.ok) throw new Error(result.message);
  const event = result.events.find((e): e is Extract<GameEvent, { type: "combat" }> => e.type === "combat");
  if (!event) throw new Error("No combat");
  return event;
}

describe("figures on screen (08-art-pipeline §18)", () => {
  it("a full-strength squad shows eight soldiers, and every vehicle or gun unit shows five", () => {
    expect(figureCount("infantry", 10)).toBe(8);
    for (const kind of ["recon", "halftrack", "lightTank", "mediumTank", "heavyTank", "tankDestroyer", "artillery", "rocketArtillery", "mobileAA", "flakGun"] as const) {
      expect(figureCount(kind, 10)).toBe(5);
    }
  });

  it("a unit with 1 HP left still shows one figure; a destroyed one shows none", () => {
    expect(figureCount("infantry", 1)).toBe(1);
    expect(figureCount("mediumTank", 1)).toBe(1);
    expect(figureCount("infantry", 0)).toBe(0);
  });

  it("figures drop in step with HP, rounded up: a squad at 5 HP shows four of its eight soldiers", () => {
    expect([10, 9, 8, 7, 6, 5, 4, 3, 2, 1].map((hp) => figureCount("infantry", hp))).toEqual([8, 8, 7, 6, 5, 4, 4, 3, 2, 1]);
    expect([10, 8, 6, 4, 2, 1].map((hp) => figureCount("mediumTank", hp))).toEqual([5, 4, 3, 2, 1, 1]);
  });

  it("a battleship is one ship at any HP", () => {
    expect(figureCount("battleship", 10)).toBe(1);
    expect(figureCount("battleship", 2)).toBe(1);
  });
});

describe("an infantry squad's weapons (08-art-pipeline §18)", () => {
  const squad = (nation: "us" | "germany", paratrooper = false) => Array.from({ length: 8 }, (_, i) => squadWeapon(i, nation, paratrooper));
  const count = (weapons: string[], weapon: string) => weapons.filter((w) => w === weapon).length;

  it("a German squad is six riflemen, a squad leader with an MP 40 and an MG 42", () => {
    const de = squad("germany");
    expect([count(de, "rifle"), count(de, "smg"), count(de, "lmg")]).toEqual([6, 1, 1]);
  });

  it("a US squad is mostly riflemen, with two Thompsons and a BAR", () => {
    const us = squad("us");
    expect([count(us, "rifle"), count(us, "smg"), count(us, "lmg")]).toEqual([5, 2, 1]);
  });

  it("paratroopers carry a third Thompson, and riflemen still outnumber them", () => {
    const para = squad("us", true);
    expect(count(para, "smg")).toBe(3);
    expect(count(para, "rifle")).toBeGreaterThan(count(para, "smg"));
  });

  it("riflemen fire single shots while the SMG and the automatic weapon fire bursts", () => {
    const us = { kind: "infantry" as const, nation: "us" as const, paratrooper: false };
    const rifle = figureTiming("rifle", us, 0);
    const smg = figureTiming("rifle", us, 1);
    const lmg = figureTiming("rifle", us, 4);
    expect(rifle.shots).toHaveLength(1);
    expect(smg.shots.length).toBeGreaterThan(rifle.shots.length);
    expect(lmg.shots.length).toBeGreaterThan(smg.shots.length);
  });
});

describe("which weapon the scene shows (08-art-pipeline §18)", () => {
  it("a tank fires its cannon with its primary weapon and its machine gun with its secondary", () => {
    expect(fireKind("mediumTank", "primary", "mediumTank", false)).toBe("tankGun");
    expect(fireKind("mediumTank", "secondary", "infantry", false)).toBe("mg");
  });

  it("a Destroyer drops depth charges on a submerged submarine and uses its deck gun on a surfaced one", () => {
    expect(fireKind("destroyer", "primary", "submarine", true)).toBe("depthCharges");
    expect(fireKind("destroyer", "primary", "submarine", false)).toBe("deckGun");
  });

  it("a Mortar Team lobs mortar rounds and Assault Infantry fires its launcher", () => {
    expect(fireKind("mortar", "primary", "infantry", false)).toBe("mortar");
    expect(fireKind("assaultInfantry", "primary", "mediumTank", false)).toBe("bazooka");
  });
});

describe("planning a battle scene from a combat (08-art-pipeline §18)", () => {
  it("the attacker strikes first and the defender's counter comes second", () => {
    const state = duel([".."], { type: "infantry" }, { type: "infantry" });
    const plan = planCombat(state, combat(state));
    expect(plan.strikes.map((s) => s.from)).toEqual(["left", "right"]);
    expect(plan.left.kind).toBe("infantry");
  });

  it("the scene shows HP before and after each strike, matching what the engine decided", () => {
    const state = duel([".."], { type: "mediumTank" }, { type: "infantry" });
    const event = combat(state);
    const plan = planCombat(state, event);
    const [attack] = plan.strikes;
    expect(attack?.hpBefore).toBe(10);
    expect(attack?.hpAfter).toBe(Math.ceil(event.defender.hp / 10));
  });

  it("an indirect attack has no counter in the scene, because the engine gave none (03-combat §2)", () => {
    const state = makeGame(["..."], [
      { owner: 0, pos: P(0, 0), type: "artillery" },
      { owner: 1, pos: P(2, 0), type: "infantry" },
    ], { settings: { luck: false } });
    const plan = planCombat(state, combat(state));
    expect(plan.strikes).toHaveLength(1);
  });

  it("each side stands on the half its army faces from: a side facing left is on the right", () => {
    const state = duel([".."], { type: "infantry" }, { type: "infantry" }, ["left", "right"]);
    const plan = planCombat(state, combat(state));
    expect(plan.right.owner).toBe(0);
    expect(plan.strikes[0]?.from).toBe("right");
  });

  it("each half's background is the terrain that unit stands on", () => {
    const state = duel([".F"], { type: "infantry" }, { type: "infantry" });
    const plan = planCombat(state, combat(state));
    expect(plan.left.terrain).toBe("plains");
    expect(plan.right.terrain).toBe("forest");
  });

  it("an attack on a bunker shows the bunker as the defender, and it never fires back", () => {
    const state = makeGame([".X"], [{ owner: 0, pos: P(0, 0), type: "mediumTank" }], { settings: { luck: false } });
    const result = apply(state, { type: "move", unitId: 0, path: [], action: { type: "attackFort", target: P(1, 0) } });
    if (!result.ok) throw new Error(result.message);
    const event = result.events.find((e): e is Extract<GameEvent, { type: "fortAttacked" }> => e.type === "fortAttacked");
    if (!event) throw new Error("No fort attack");
    const plan = planFortAttack(state, event);
    expect(plan?.right.kind).toBe("bunker");
    expect(plan?.strikes).toHaveLength(1);
  });
});

const plan = (counter: boolean, defenderAfter: number): BattlePlan => ({
  left: { half: "left", kind: "infantry", owner: 0, nation: "us", terrain: "plains", hp: 10, submerged: false, paratrooper: false, suit: 0 },
  right: { half: "right", kind: "infantry", owner: 1, nation: "germany", terrain: "plains", hp: 10, submerged: false, paratrooper: false, suit: 0 },
  strikes: [
    { from: "left", fire: "rifle", hpBefore: 10, hpAfter: defenderAfter, atAir: false },
    ...(counter ? [{ from: "right" as const, fire: "rifle" as const, hpBefore: 10, hpAfter: 8, atAir: false }] : []),
  ],
});

describe("the order things happen in a battle scene (08-art-pipeline §18)", () => {
  it("every attacking shot lands before the counterattack starts", () => {
    const timeline = buildTimeline(plan(true, 6));
    const [attack, counter] = timeline.strikes;
    const attackShots = timeline.shots.filter((s) => s.strike === 0);
    expect(counter).toBeDefined();
    expect(Math.max(...attackShots.map((s) => s.landAt))).toBeLessThan(counter?.start ?? 0);
    expect(attack?.end).toBeLessThanOrEqual(counter?.start ?? 0);
  });

  it("HP ticks down as shots land and ends exactly where the engine put it", () => {
    const timeline = buildTimeline(plan(false, 4));
    const [attack] = timeline.strikes;
    expect(hpAt(timeline, "right", 10, attack?.start ?? 0)).toBe(10);
    expect(hpAt(timeline, "right", 10, timeline.total)).toBe(4);
    const midway = timeline.shots[Math.floor(timeline.shots.length / 2)]?.landAt ?? 0;
    const hpMid = hpAt(timeline, "right", 10, midway);
    expect(hpMid).toBeLessThan(10);
    expect(hpMid).toBeGreaterThan(4);
  });

  it("as many figures fall as the HP loss calls for, from the back of the formation", () => {
    const timeline = buildTimeline(plan(false, 4)); // 8 soldiers down to 4
    const deaths = deathTimes(timeline, "right");
    expect([...deaths.keys()].sort()).toEqual([4, 5, 6, 7]);
  });

  it("figures that fall during the attack don't fire in the counterattack", () => {
    const timeline = buildTimeline({ ...plan(true, 4), strikes: [...plan(false, 4).strikes, { from: "right", fire: "rifle", hpBefore: 10, hpAfter: 9, atAir: false }] });
    expect(timeline.strikes[1]?.figureStarts).toHaveLength(4);
  });

  it("mortar, artillery and rocket rounds stay in the air over a second before they land", () => {
    for (const fire of ["mortar", "howitzer", "rockets"] as const) expect(FIRE_TIMING[fire].flight).toBeGreaterThanOrEqual(1200);
    expect(FIRE_TIMING.tankGun.flight).toBeLessThan(500);
  });

  it("a strike that does no damage still plays its shots and takes no figures", () => {
    const timeline = buildTimeline(plan(false, 10));
    expect(timeline.shots.length).toBeGreaterThan(0);
    expect(deathTimes(timeline, "right").size).toBe(0);
  });
});
