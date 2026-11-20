// A map plan (22-campaign §6): what a map-specific AI adds to Greedy. Greedy consults it while it
// scores moves; everything a plan leaves out is Greedy as usual. A plan sees only what the AI sees
// (the state it's given is the AI's view, with remembered enemies, 09-ai §4g), so it can't cheat.

import type { GameState, Point, Unit } from "../engine";

export interface MapPlan {
  readonly name: string;
  /**
   * Called with the game as the AI sees it before each command it chooses, so a plan can keep a
   * hint such as which search points it has looked at. Like the AI's memory of enemies (09-ai §4g),
   * a hint only: it's lost on reload, and the plan must still work without it.
   */
  observe?(state: GameState): void;
  /**
   * Extra score, in funds, for this unit attacking that enemy; -Infinity forbids the attack. Also
   * decides launches: an aircraft only takes off from a Carrier to attack when the attack still
   * scores above zero.
   */
  attackBonus?(state: GameState, attacker: Unit, target: Unit): number;
  /**
   * Where this unit should head instead of its usual goal, or null to leave it to Greedy. A unit
   * that's low on fuel or ammo, or badly hurt, still heads home first. An aircraft aboard a Carrier
   * with goals is launched toward them even with nothing to attack (a scout).
   */
  goals?(state: GameState, unit: Unit): readonly Point[] | null;
  /** Squares this unit shouldn't end its move on, such as an objective it can't capture and would only block. */
  keepOff?(state: GameState, unit: Unit): readonly Point[];
}
