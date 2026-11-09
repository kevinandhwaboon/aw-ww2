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
  /** Air and naval units head home once their fuel is within this many days' burn of what it takes to get there. */
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
  /** Fewest capture-capable units to keep before building anything else. */
  readonly minCapturers: number;
  /** Most capture-capable units the "one per N properties" rule asks for. */
  readonly maxCapturers: number;
  /** Want one capture-capable unit per this many properties still to take. */
  readonly propertiesPerCapturer: number;
  /** How much the enemy's damage to a unit type counts against building it. */
  readonly buildRisk: number;
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
};
