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
  /**
   * Fog of war (09-ai §4g): days an enemy unit is remembered where it was last seen; 0 remembers
   * nothing.
   */
  readonly memoryDays: number;
  /**
   * Fog of war (09-ai §4g): armed aircraft and ships with no enemy in sight to go after head for
   * the enemy's properties instead of waiting.
   */
  readonly patrolInFog: boolean;
  /**
   * Fog of war (09-ai §4g): how many scouts we keep: land units seeing at least `scoutMinVision`
   * (the Recon), which drive to the edge of what we can see on the enemy's side. Built if we have
   * fewer.
   */
  readonly scoutsInFog: number;
  readonly scoutMinVision: number;

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
  /** We want one Supply Ship for every this many of our warships at sea (09-ai §4f). */
  readonly warshipsPerSupplyShip: number;
  /** Most Supply Ships we build. */
  readonly maxSupplyShips: number;
  /** A Supply Ship sails to one of our ships once its fuel is at or below this share of a full tank. */
  readonly supplyFuelShare: number;
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
  /**
   * A mixed army (09-ai §4d): how much another unit of a type is marked down by the share of our
   * units of that kind (land, air or naval) that are already that type. 0 = not at all; 1 = worth
   * nothing once every unit is that type.
   */
  readonly mixWeight: number;
  /** Indirect-fire units aren't built once they are this share of our land units (09-ai §4d). 1 = no cap. */
  readonly maxIndirectShare: number;
  /** The minimum of capture-capable units grows with the army: at least this share of our land units (09-ai §4d). */
  readonly capturerShare: number;
  /** Land units stay on the landmass of an objective of ours the enemy must capture, and one stands on it (09-ai §4d). */
  readonly guardObjectives: boolean;
  /** Landings aim at the properties our side wins by capturing, when one can be reached from a beach (09-ai §4h). */
  readonly landOnObjectives: boolean;
  /** Score per step a land unit's move brings it nearer an objective our side has yet to take (09-ai §4i). 0 = off. */
  readonly objectivePull: number;
  /** A Landing Craft or Transport Aircraft short of fuel for its next trip refuels first (09-ai §4d). */
  readonly topUpTransports: boolean;
  /** Days of fuel burn an aircraft or ship keeps in hand on top of what the trip home needs (09-ai §4c). */
  readonly fuelReserveDays: number;
  /** Leave a port or airfield unbuilt while one of our units is coming in to it for fuel or repairs (09-ai §4c). */
  readonly keepSitesForService: boolean;
  /** Score lost by a Carrier ending its move where an enemy that can hurt it could attack next turn. */
  readonly carrierDangerPenalty: number;
  /** A Carrier closes to within its aircraft's flying range of a target, and no nearer than this many tiles less. */
  readonly carrierStandoff: number;
  /**
   * Value of blowing a Major Bridge that enemy vehicles could reach next turn while none of ours
   * needs it soon (02-terrain §4a, 09-ai §4e).
   */
  readonly blowBridge: number;
  /** Value of each rebuild action on a Blown Bridge that one of our vehicles is waiting to cross (09-ai §4e). */
  readonly rebuildBridge: number;
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
  warshipsPerSupplyShip: 4,
  maxSupplyShips: 2,
  supplyFuelShare: 0.6,
  boardValue: 800,
  boardTurns: 2,
  unloadValue: 1800,
  unloadPerStep: 150,
  join: -300,
  minCapturers: 3,
  maxCapturers: 8,
  propertiesPerCapturer: 3,
  buildRisk: 0.25,
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
  mixWeight: 1,
  maxIndirectShare: 0.34,
  capturerShare: 0.25,
  guardObjectives: true,
  landOnObjectives: true,
  objectivePull: 60,
  topUpTransports: true,
  fuelReserveDays: 2,
  keepSitesForService: true,
  carrierDangerPenalty: 3000,
  carrierStandoff: 2,
  blowBridge: 6000,
  rebuildBridge: 3000,
  memoryDays: 1,
  patrolInFog: true,
  scoutsInFog: 1,
  scoutMinVision: 4,
};

/** The levels the player can choose for the computer (09-ai §4c). */
export type AiLevel = "easy" | "normal";

/**
 * Easy is the same AI, by the same rules and with no handicap: it doesn't coordinate (no focus fire,
 * no look ahead, no waves, escorts or garrison), doesn't weigh nearby threats more when building,
 * builds the best-scoring unit over and over, leaves objectives unguarded, counts only half of
 * the damage it will take back when it attacks, and in fog of war remembers nothing it can't see
 * and keeps no scout.
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
  // Nor does it mix its army or guard objectives, and it stays shy of expensive units (09-ai §4d).
  buildRisk: 0.5,
  mixWeight: 0,
  maxIndirectShare: 1,
  capturerShare: 0,
  guardObjectives: false,
  // In fog it forgets an enemy as soon as it can't see it, and keeps no scout (09-ai §4g).
  memoryDays: 0,
  scoutsInFog: 0,
};

export function weightsFor(level: AiLevel): GreedyWeights {
  return level === "easy" ? EASY_WEIGHTS : GREEDY_WEIGHTS;
}
