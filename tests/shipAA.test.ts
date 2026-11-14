import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import { attackTargets, canCounter, forecast } from "../src/engine/combat";
import type { Command, GameEvent } from "../src/engine/commands";
import { baseDamage, RETURN_FIRE_AA_CHART } from "../src/engine/data/damage";
import { UNIT_TYPE_IDS, UNITS, type UnitTypeId } from "../src/engine/data/units";
import type { Point } from "../src/engine/map";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState, Unit } from "../src/engine/state";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const AIRCRAFT = UNIT_TYPE_IDS.filter((t) => UNITS[t].category === "air");

/** US unit 0 at x=0 attacks Japanese unit 1 at x=1, at sea, with luck off so damage is exact. */
function duel(a: Partial<UnitSetup> & { type: UnitTypeId }, d: Partial<UnitSetup> & { type: UnitTypeId }): GameState {
  return makeGame(["SS"], [{ owner: 0, pos: P(0, 0), ...a }, { owner: 1, pos: P(1, 0), ...d }], {
    settings: { luck: false },
    players: [{ name: "US", nation: "us" }, { name: "Japan", nation: "japan" }],
  });
}

function fight(state: GameState) {
  const command: Command = { type: "move", unitId: 0, path: [], action: { type: "attack", target: 1 } };
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  const combat = result.events.find((e): e is Extract<GameEvent, { type: "combat" }> => e.type === "combat");
  if (!combat) throw new Error("No combat event");
  return { state: result.state, combat };
}

const unit = (state: GameState, id: number) => state.units.find((u) => u.id === id) as Unit;

describe("return-fire AA on Battleships and Carriers (03-combat §2, §5d)", () => {
  it("only Battleships and Carriers have it", () => {
    const withAA = UNIT_TYPE_IDS.filter((t) => UNITS[t].returnFireAA !== null);
    expect(withAA).toEqual(["battleship", "carrier"]);
    expect(Object.keys(RETURN_FIRE_AA_CHART).sort()).toEqual(withAA);
  });

  it("it is very light: at most 15% against any aircraft, far below a Destroyer's AA", () => {
    for (const ship of ["battleship", "carrier"] as const) {
      for (const aircraft of AIRCRAFT) {
        const entry = RETURN_FIRE_AA_CHART[ship]?.[aircraft];
        expect(entry?.weapon, `${ship} vs ${aircraft}`).toBe("secondary");
        expect(entry?.base ?? 0, `${ship} vs ${aircraft}`).toBeLessThanOrEqual(15);
        expect(entry?.base ?? 0).toBeLessThan(baseDamage("destroyer", aircraft)?.base ?? 0);
      }
    }
  });

  it("a Battleship fires back at a Dive Bomber that bombs it: 40% in, then 15% at the Battleship's reduced 6 HP is 9% back", () => {
    const { state, combat } = fight(duel({ type: "diveBomber" }, { type: "battleship" }));
    expect(combat.attack.damage).toBe(40);
    expect(combat.counter).toMatchObject({ weapon: "secondary", damage: 9 });
    expect(unit(state, 0).hp).toBe(91);
  });

  it("a Carrier fires back at a Torpedo Bomber: 60% in, then 15% at the Carrier's reduced 4 HP is 6% back", () => {
    const { state, combat } = fight(duel({ type: "torpedoBomber" }, { type: "carrier" }));
    expect(combat.attack.damage).toBe(60);
    expect(combat.counter).toMatchObject({ weapon: "secondary", damage: 6 });
    expect(unit(state, 0).hp).toBe(94);
  });

  it("the damage forecast shows the return fire", () => {
    const state = duel({ type: "diveBomber" }, { type: "battleship" });
    expect(forecast(state, unit(state, 0), unit(state, 1))?.counter).toEqual({ min: 9, max: 9 });
  });

  it("it needs no ammo: a Battleship with its main guns empty still fires back, and keeps 0 ammo", () => {
    const { state, combat } = fight(duel({ type: "diveBomber" }, { type: "battleship", ammo: 0 }));
    expect(combat.counter?.damage).toBe(9);
    expect(unit(state, 1).ammo).toBe(0);
  });

  it("it never fires first: Battleships and Carriers can't attack aircraft, even next to them", () => {
    for (const ship of ["battleship", "carrier"] as const) {
      for (const aircraft of AIRCRAFT) expect(baseDamage(ship, aircraft), `${ship} vs ${aircraft}`).toBeNull();
      const state = duel({ type: ship }, { type: "fighter" });
      expect(attackTargets(state, unit(state, 0), false)).toEqual([]);
    }
  });

  it("it only fires at aircraft: a Battleship still never counters ships, and a Carrier never counters anything else", () => {
    const vsBattleship = duel({ type: "destroyer" }, { type: "battleship" });
    expect(canCounter(vsBattleship, unit(vsBattleship, 0), unit(vsBattleship, 1))).toBe(false);
    const vsCarrier = duel({ type: "submarine" }, { type: "carrier" });
    expect(canCounter(vsCarrier, unit(vsCarrier, 0), unit(vsCarrier, 1))).toBe(false);
  });

  it("a ship sunk by the strike doesn't fire back", () => {
    const { combat } = fight(duel({ type: "bomber" }, { type: "carrier", hp: 50 }));
    expect(combat.defender.destroyed).toBe(true);
    expect(combat.counter).toBeNull();
  });
});
