// What the map select's moving picture plays (featureShot.ts): the battle or drop plan for a map's
// featured unit, in the colors of the player who plays that nation on the map. Free of the DOM so
// tests can check it.

import type { NationId } from "../engine/data/nations";
import type { Scenario } from "../engine/scenario";
import { drawnAs } from "../game/artPack";
import type { DropPlan } from "../game/battle/drop";
import { fireKind, isFort, type BattleHalf, type BattlePlan, type FigureKind } from "../game/battle/plan";
import type { FeatureShot, ShotSide } from "./theaters";

const AIR: readonly FigureKind[] = ["fighter", "bomber", "transportAircraft", "diveBomber", "torpedoBomber"];

/** Which player of the map plays this nation, so the figure wears that player's colors. */
const ownerOf = (scenario: Scenario, nation: NationId | null): number | null => {
  if (nation === null) return null;
  const found = scenario.setup.players.findIndex((p) => p.nation === nation);
  return found >= 0 ? found : 0;
};

function half(scenario: Scenario, side: ShotSide, which: "left" | "right"): BattleHalf {
  const fort = isFort(side.kind);
  return {
    half: which,
    kind: side.kind,
    owner: fort ? null : ownerOf(scenario, side.nation),
    nation: fort ? null : drawnAs(side.nation),
    terrain: side.terrain,
    hp: 10,
    submerged: false,
    paratrooper: side.paratrooper === true,
    suit: 1,
  };
}

/** The battle a preview shows: the attack lands, and the defender fires back if it can. */
export function shotPlan(scenario: Scenario, shot: Extract<FeatureShot, { kind: "battle" }>): BattlePlan {
  const { attacker, defender } = shot;
  if (isFort(attacker.kind)) throw new Error("A fortification can't attack");
  const strikes: BattlePlan["strikes"][number][] = [
    { from: "left", fire: fireKind(attacker.kind, shot.weapon, defender.kind), hpBefore: 10, hpAfter: shot.counter ? 7 : 4, atAir: AIR.includes(defender.kind) },
  ];
  if (shot.counter && !isFort(defender.kind)) {
    strikes.push({ from: "right", fire: fireKind(defender.kind, shot.counter, attacker.kind), hpBefore: 10, hpAfter: 8, atAir: AIR.includes(attacker.kind) });
  }
  return { left: half(scenario, attacker, "left"), right: half(scenario, defender, "right"), strikes };
}

export function dropPlan(scenario: Scenario, shot: Extract<FeatureShot, { kind: "drop" }>): DropPlan {
  return {
    unit: shot.unit,
    owner: ownerOf(scenario, shot.nation) ?? 0,
    nation: drawnAs(shot.nation),
    hp: 10,
    paratrooper: true,
    suit: 1,
    terrain: shot.terrain,
  };
}
