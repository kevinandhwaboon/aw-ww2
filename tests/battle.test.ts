import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Command, GameEvent } from "../src/engine/commands";
import type { UnitTypeId } from "../src/engine/data/units";
import type { Point } from "../src/engine/map";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState } from "../src/engine/state";
import { figureCount, fireKind, planCombat, planFortAttack, squadWeapon, type BattlePlan } from "../src/game/battle/plan";
import { buildTimeline, deathTimes, FIRE_TIMING, figureTiming, hpAt } from "../src/game/battle/timeline";
import { BATTLE_VIEW, project } from "../src/game/battle/angled/mesh";
import { TANK_MODELS } from "../src/game/battle/angled/models";
import { bunker, calliope, flakGun, howitzer, m3, nebelwerfer, quadAA, r75, sdkfz251, willys } from "../src/game/battle/angled/vehicleModels";
import { FALL_MS, fallAt } from "../src/game/battle/fall";
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

  it("every naval unit is one ship at any HP", () => {
    for (const kind of ["battleship", "destroyer", "submarine", "landingCraft", "torpedoBoat"] as const) {
      expect(figureCount(kind, 10)).toBe(1);
      expect(figureCount(kind, 2)).toBe(1);
    }
  });
});

describe("an infantry squad's weapons (08-art-pipeline §18)", () => {
  const squad = (nation: "us" | "germany" | "japan", paratrooper = false) => Array.from({ length: 8 }, (_, i) => squadWeapon(i, nation, paratrooper));
  const count = (weapons: string[], weapon: string) => weapons.filter((w) => w === weapon).length;

  it("a German squad is six riflemen, a squad leader with an MP 40 and an MG 42", () => {
    const de = squad("germany");
    expect([count(de, "rifle"), count(de, "smg"), count(de, "lmg")]).toEqual([6, 1, 1]);
  });

  it("a Japanese squad is six riflemen with Arisakas, a squad leader with a Type 100 and a Type 99 light machine gun", () => {
    const jp = squad("japan");
    expect([count(jp, "rifle"), count(jp, "smg"), count(jp, "lmg")]).toEqual([6, 1, 1]);
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
    expect(fireKind("mediumTank", "primary", "mediumTank")).toBe("tankGun");
    expect(fireKind("mediumTank", "secondary", "infantry")).toBe("mg");
  });

  it("a Destroyer drops depth charges on a submarine, surfaced or submerged, and uses its deck gun on other ships", () => {
    expect(fireKind("destroyer", "primary", "submarine")).toBe("depthCharges");
    expect(fireKind("destroyer", "primary", "destroyer")).toBe("deckGun");
  });

  it("a Mortar Team lobs mortar rounds and Assault Infantry fires its launcher", () => {
    expect(fireKind("mortar", "primary", "infantry")).toBe("mortar");
    expect(fireKind("assaultInfantry", "primary", "mediumTank")).toBe("bazooka");
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

  it("ships fight at long range: naval shells, torpedoes and depth charges take over a second to arrive", () => {
    for (const fire of ["navalGuns", "deckGun", "torpedo", "depthCharges"] as const) expect(FIRE_TIMING[fire].flight).toBeGreaterThanOrEqual(1000);
  });

  it("a strike that does no damage still plays its shots and takes no figures", () => {
    const timeline = buildTimeline(plan(false, 10));
    expect(timeline.shots.length).toBeGreaterThan(0);
    expect(deathTimes(timeline, "right").size).toBe(0);
  });
});

describe("tanks drawn turned 5° toward the viewer (08-art-pipeline §18)", () => {
  const team = { hi: "#88aaff", mid: "#4466cc", lo: "#334488", deep: "#223366", cloth: "#556677", clothLo: "#445566" };
  const kinds = ["light", "medium", "heavy", "td"] as const;

  it("every tank and tank destroyer has its own model for the US and for Germany", () => {
    for (const kind of kinds) {
      const us = TANK_MODELS[kind].us(team);
      const de = TANK_MODELS[kind].de(team);
      expect(us.faces.length).toBeGreaterThan(20);
      expect(de.faces.length).toBeGreaterThan(20);
      expect(TANK_MODELS[kind].us).not.toBe(TANK_MODELS[kind].de);
    }
  });

  it("each gun points forward, ahead of the hull's middle, and slides back when it recoils", () => {
    for (const kind of kinds) {
      for (const make of [TANK_MODELS[kind].us, TANK_MODELS[kind].de]) {
        const still = make(team).muzzle;
        const recoiled = make(team, 4).muzzle;
        expect(still[0]).toBeGreaterThan(20);
        expect(recoiled[0]).toBe(still[0] - 4);
      }
    }
  });

  it("at 5° the view is mostly side-on: a tank's length on screen is nearly its full length", () => {
    const tip = project([40, 0, 0], BATTLE_VIEW).x;
    expect(tip).toBeGreaterThan(39);
    expect(Math.round((-BATTLE_VIEW.yaw * 180) / Math.PI)).toBe(5);
  });
});

describe("the other land machines drawn turned 5° too (08-art-pipeline §18)", () => {
  const team = { hi: "#88aaff", mid: "#4466cc", lo: "#334488", deep: "#223366", cloth: "#556677", clothLo: "#445566" };
  const all = (m: { far: readonly unknown[]; near: readonly unknown[]; front?: readonly unknown[] }) => m.far.length + m.near.length + (m.front?.length ?? 0);

  it("recon, halftracks, Mobile AA, flak guns, howitzers and rocket launchers each have a US and a German model", () => {
    const pairs = [
      [willys(team), r75(team)],
      [m3(team), sdkfz251(team)],
      [quadAA(team, false, 1, -1), quadAA(team, true, 1, -1)],
      [flakGun(team, false, 1, 0), flakGun(team, true, 1, 0)],
      [howitzer(team, false, 0.85, 0), howitzer(team, true, 0.85, 0)],
      [calliope(team, 0.38), nebelwerfer(team, 0.75)],
    ] as const;
    for (const [us, de] of pairs) {
      expect(all(us)).toBeGreaterThan(20);
      expect(all(de)).toBeGreaterThan(20);
      expect(all(us)).not.toBe(all(de));
    }
    expect(all(bunker(team))).toBeGreaterThan(20);
  });

  it("anti-aircraft guns point high at aircraft and nearly level at ground targets", () => {
    const high = quadAA(team, false, 1.05, -1).at.muzzle0;
    const low = quadAA(team, false, 0.13, -1).at.muzzle0;
    expect(high[2]).toBeGreaterThan(low[2] + 15);
    expect(flakGun(team, true, 1, 0).at.muzzle[2]).toBeGreaterThan(flakGun(team, true, 0.07, 0).at.muzzle[2] + 30);
  });

  it("howitzers and rocket launchers are raised, so their rounds leave climbing", () => {
    const gun = howitzer(team, false, 0.85, 0);
    expect(gun.at.muzzle[2]).toBeGreaterThan(gun.at.breech[2] + 30);
    expect(nebelwerfer(team, 0.75).at.muzzle0[2]).toBeGreaterThan(30);
    expect(calliope(team, 0.38).at.muzzle4[2]).toBeGreaterThan(calliope(team, 0.38).at.muzzle0[2]);
  });

  it("every barrel of a quad mount and every Nebelwerfer tube fires from its own muzzle", () => {
    const quad = quadAA(team, true, 1, -1).at;
    expect(new Set([quad.muzzle0, quad.muzzle1, quad.muzzle2, quad.muzzle3].map((m) => m.join())).size).toBe(4);
    const nebel = nebelwerfer(team, 0.75).at;
    expect(new Set([nebel.muzzle0, nebel.muzzle1, nebel.muzzle2, nebel.muzzle3, nebel.muzzle4, nebel.muzzle5].map((m) => m.join())).size).toBe(6);
  });
});

describe("soldiers falling in battle scenes (08-art-pipeline §18)", () => {
  it("a man who is hit topples onto his back about his own feet, so the mortar or sandbags beside him stay put", () => {
    expect(fallAt(0, false).angle).toBeGreaterThan(0);
    expect(fallAt(400, false).angle).toBeCloseTo(Math.PI / 2);
    expect(fallAt(400, false).sink).toBe(0);
  });

  it("a man lying prone slumps where he lies instead of toppling", () => {
    expect(fallAt(400, true).angle).toBe(0);
    expect(fallAt(400, true).sink).toBeGreaterThan(0);
  });

  it("fallen men fade out by the time the scene moves on", () => {
    expect(fallAt(100, false).alpha).toBe(1);
    expect(fallAt(FALL_MS, false).alpha).toBe(0);
    expect(fallAt(FALL_MS, true).alpha).toBe(0);
  });
});
