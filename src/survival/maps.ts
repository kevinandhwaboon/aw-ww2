// The survival maps (23-survival §1, §2), with what the screens say about each one's history. Typed
// data with no logic, like the campaign's missions.

export interface SurvivalMap {
  /** The scenario's id. */
  readonly map: string;
  /** Who defends: the player the person plays. */
  readonly defender: number;
  /** Who brings the waves: the computer. */
  readonly attacker: number;
  /** How many days the real garrison held (23-survival §3): holding longer beats history. */
  readonly historyDays: number;
  /** History's mark, as the screens show it. */
  readonly historyLine: string;
  /** The game's end, as the results screen's heading says it. */
  readonly fallen: string;
}

export const SURVIVAL_MAPS: readonly SurvivalMap[] = [
  {
    map: "wake-island",
    defender: 0,
    attacker: 1,
    historyDays: 16,
    historyLine: "Wake fell on 23 December 1941, day 16",
    fallen: "Wake has fallen",
  },
  {
    map: "crete",
    defender: 0,
    attacker: 1,
    historyDays: 9,
    historyLine: "Chania fell on 27 May 1941, day 9",
    fallen: "Crete has fallen",
  },
];
