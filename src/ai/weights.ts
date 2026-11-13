// The Greedy AI's scoring weights (09-ai §4), kept as data with no logic, so tuning it, or giving a
// commander a personality later, is a data edit. Scores are in funds, the same unit as unit costs.

export interface GreedyWeights {
  /** How much the value of the expected counter-damage counts against an attack. */
  readonly counterLoss: number;
  /** Bonus for an attack sure to destroy the target, as a share of the target's cost. */
  readonly certainKillBonus: number;
  /** Bonus for an attack that destroys the target with good luck, as a share of its cost. */
  readonly possibleKillBonus: number;
  /** Bonus for hitting an enemy that is capturing one of our properties. */
  readonly stopCaptureBonus: number;
  /** Value of capturing each kind of property, per action. */
  readonly capture: { readonly hq: number; readonly factory: number; readonly airfield: number; readonly port: number; readonly city: number };
  /** Extra value when the action finishes the capture. */
  readonly finishCaptureBonus: number;
  /** Extra value when the property is a scenario objective (04-economy §8). */
  readonly objectiveBonus: number;
  /** Value of each movement point closer to the unit's goal. */
  readonly advancePerStep: number;
  /** The same while retreating for repair or supplies. */
  readonly retreatPerStep: number;
  /** Bonus for ending a retreat on a property that repairs the unit. */
  readonly reachRepairBonus: number;
  /** Retreat at this displayed HP or less. */
  readonly retreatHp: number;
  /** Air and naval units head home once their fuel is within this many days' burn of what the trip home takes (distance plus the daily burn on the way). */
  readonly fuelSafetyDays: number;
  /** Value of each defense star at the destination, at full HP. */
  readonly starValue: number;
  /** Value of staying put for a unit with nothing useful to do, so it doesn't wander. */
  readonly stayBonus: number;
  /** Value of fully destroying a fortification that blocks the way to the unit's goal. */
  readonly blockingFortValue: number;
  /** Value of each neighbour resupplied. */
  readonly supplyPerUnit: number;
  /** Value of boarding a Halftrack when the goal is far away. */
  readonly boardValue: number;
  /** A goal is "far" when it's more than this many turns' movement away. */
  readonly boardTurns: number;
  /** Value of unloading a passenger right on its goal, less `unloadPerStep` for each movement point away. */
  readonly unloadValue: number;
  readonly unloadPerStep: number;
  /** Value of merging two damaged units: negative, as it's rarely worth an action. */
  readonly join: number;
  /** Fewest capture-capable units to keep before building anything else. Above it, up to the wanted count, they get `capturerBonus`. */
  readonly minCapturers: number;
  /** Most capture-capable units the "one per N properties" rule asks for. */
  readonly maxCapturers: number;
  /** Want one capture-capable unit per this many properties still to take. */
  readonly propertiesPerCapturer: number;
  /** How much the enemy's damage to a unit type counts against building it. */
  readonly buildRisk: number;
  /** Score lost by a unit ending its move on one of our own production sites, which blocks building there (09-ai §4a). */
  readonly blockSitePenalty: number;
  /** An enemy is a near threat when it could reach a production site within this many turns (09-ai §4a). */
  readonly threatTurns: number;
  /** How much more a near threat counts than a distant enemy when choosing what to build (09-ai §4a). */
  readonly nearThreatWeight: number;
  /** A transport taking passengers on waits for any that could reach it within this many turns (09-ai §4b). */
  readonly boardWaitTurns: number;
  /** Build another Landing Craft while there are more than this many stranded units per craft we own. */
  readonly strandedPerCraft: number;
  /** Most Landing Craft and Transport Aircraft the AI keeps. */
  readonly maxLandingCraft: number;
  readonly maxAirTransports: number;
  /** A Transport Aircraft drops a passenger only within this many turns' walk of its goal. */
  readonly dropWithinTurns: number;
  /** How much an enemy a land unit could only reach by sea counts when choosing what to build, against one it can walk to. */
  readonly overseasWeight: number;
  /** Least score lost by an aircraft or ship moving to where it wouldn't have the fuel left to get home. */
  readonly noReturnPenalty: number;
  /** The same as a share of what the unit is worth, when that's more: going past the point of no return loses the unit (09-ai §4c). */
  readonly noReturnOwnValue: number;
  /** Loaded Landing Craft leave together: one waits at its boarding tile while another within `waveRadius` is still loading, until this many are ready (09-ai §4c). 1 = never wait. */
  readonly waveSize: number;
  readonly waveRadius: number;
  /** Warships with nothing to shoot nearby that sail with each loaded Landing Craft (09-ai §4c). */
  readonly escortsPerCraft: number;
  /** Land units that stay on the HQ's landmass however little there is to do there (09-ai §4c). */
  readonly garrisonSize: number;
  /** Indirect-fire units shoot before direct-fire units move in, so targets are softened first (09-ai §4c). */
  readonly indirectFirst: boolean;
  /** Bonus for hitting a target our other ready units could finish off this turn, as a share of its cost (09-ai §4c). */
  readonly focusKillBonus: number;
  /**
   * How much the damage the enemy could do to a unit next turn, where it ends its move, counts against
   * the move (09-ai §4c). Kept low: at 0.25 and above both sides hang back and games stop finishing.
   */
  readonly dangerWeight: number;
  /** The look ahead is switched off once our army is worth this many times the enemy's: far ahead, it presses rather than hangs back (09-ai §4c). */
  readonly pressRatio: number;
  /** How many enemy attackers that estimate counts on one tile. */
  readonly dangerAttackers: number;
  /** Days of fuel burn an aircraft or ship keeps in hand on top of what the trip home needs (09-ai §4c). */
  readonly fuelReserveDays: number;
  /** Leave a port or airfield unbuilt while one of our units is coming in to it for fuel or repairs (09-ai §4c). */
  readonly keepSitesForService: boolean;
  /** Score lost by a Carrier ending its move where an enemy that can hurt it could attack next turn. */
  readonly carrierDangerPenalty: number;
  /** A Carrier closes to within its aircraft's flying range of a target, and no nearer than this many tiles less. */
  readonly carrierStandoff: number;
  /** Bonus value of a capture-capable unit while we have fewer than the capture rule wants, above the minimum. */
  readonly capturerBonus: number;
}

export const GREEDY_WEIGHTS: GreedyWeights = {
  counterLoss: 1,
  certainKillBonus: 0.5,
  possibleKillBonus: 0.15,
  stopCaptureBonus: 1500,
  capture: { hq: 8000, factory: 3500, airfield: 3000, port: 3000, city: 2500 },
  finishCaptureBonus: 2000,
  objectiveBonus: 4000,
  advancePerStep: 120,
  retreatPerStep: 300,
  reachRepairBonus: 1500,
  retreatHp: 3,
  fuelSafetyDays: 3,
  starValue: 60,
  stayBonus: 10,
  blockingFortValue: 1500,
  supplyPerUnit: 400,
  boardValue: 800,
  boardTurns: 2,
  unloadValue: 1800,
  unloadPerStep: 150,
  join: -300,
  minCapturers: 3,
  maxCapturers: 8,
  propertiesPerCapturer: 3,
  buildRisk: 0.5,
  blockSitePenalty: 2500,
  threatTurns: 2,
  nearThreatWeight: 3,
  capturerBonus: 1500,
  boardWaitTurns: 2,
  strandedPerCraft: 2,
  maxLandingCraft: 6,
  maxAirTransports: 1,
  dropWithinTurns: 1,
  overseasWeight: 0.5,
  noReturnPenalty: 5000,
  noReturnOwnValue: 1,
  waveSize: 3,
  waveRadius: 8,
  escortsPerCraft: 2,
  garrisonSize: 2,
  indirectFirst: true,
  focusKillBonus: 0.25,
  dangerWeight: 0.1,
  pressRatio: 2,
  dangerAttackers: 2,
  fuelReserveDays: 2,
  keepSitesForService: true,
  carrierDangerPenalty: 3000,
  carrierStandoff: 2,
};

/** The levels the player can choose for the computer (09-ai §4c). */
export type AiLevel = "easy" | "normal";

/**
 * Easy is the same AI, by the same rules and with no handicap: it doesn't coordinate (no focus fire,
 * no look ahead, no waves, escorts or garrison), doesn't weigh nearby threats more when building,
 * and counts only half of the damage it will take back when it attacks.
 */
export const EASY_WEIGHTS: GreedyWeights = {
  ...GREEDY_WEIGHTS,
  counterLoss: 0.5,
  nearThreatWeight: 1,
  indirectFirst: false,
  focusKillBonus: 0,
  dangerWeight: 0,
  waveSize: 1,
  escortsPerCraft: 0,
  garrisonSize: 0,
};

export function weightsFor(level: AiLevel): GreedyWeights {
  return level === "easy" ? EASY_WEIGHTS : GREEDY_WEIGHTS;
}
