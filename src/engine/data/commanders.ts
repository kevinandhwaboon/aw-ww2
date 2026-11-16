// Commanders, from docs/06-commanders.md section 3. Every commander is a fictional character.
// Pure data: a commander is a list of modifier-layer effects (engine/stats.ts turns them into
// modifiers for the players who have that commander). Balancing is an edit here.

import type { Modifier, ModifierScope } from "../modifiers";
import type { NationId } from "./nations";
import type { UnitTypeId } from "./units";

export const COMMANDER_IDS = [
  "harlan", "calloway", "ashdown", "tremblay", "morozov",
  "falk", "ferrante", "arakawa",
] as const;
export type CommanderId = (typeof COMMANDER_IDS)[number];

/** A modifier without its source or its players: both come from who has the commander. */
export interface CommanderEffect extends Omit<Modifier, "source" | "scope"> {
  readonly scope?: Omit<ModifierScope, "players">;
}

export interface CommanderDef {
  readonly name: string;
  /** The nation the commander comes from. They serve any nation on that nation's side (06-commanders §2). */
  readonly nation: NationId;
  readonly style: string;
  /** The bonuses and the drawback in words, as 06-commanders §3 gives them. */
  readonly bonuses: readonly string[];
  readonly drawback: string;
  readonly effects: readonly CommanderEffect[];
}

// Unit classes (06-commanders §2).
const TANKS = ["lightTank", "mediumTank", "heavyTank"] as const satisfies readonly UnitTypeId[];
const FOOT_SOLDIERS = ["infantry", "assaultInfantry"] as const satisfies readonly UnitTypeId[];
const INDIRECT_FIRE = ["mortar", "artillery", "rocketArtillery"] as const satisfies readonly UnitTypeId[];
const BOMBERS = ["bomber", "diveBomber", "torpedoBomber"] as const satisfies readonly UnitTypeId[];
const CARRIER_BOMBERS = ["diveBomber", "torpedoBomber"] as const satisfies readonly UnitTypeId[];

export const COMMANDERS = {
  harlan: {
    name: "Walt Harlan",
    nation: "us",
    style: "Never stops moving, and keeps his machines running. Would sooner attack again than wait for the guns.",
    bonuses: ["Tanks +1 move", "Every unit repairs 1 extra HP per turn on a property that repairs it"],
    drawback: "Indirect fire −10% attack",
    effects: [
      { stat: "movePoints", op: "add", value: 1, scope: { unitTypes: TANKS } },
      { stat: "repairHp", op: "add", value: 1 },
      { stat: "attack", op: "add", value: -10, scope: { unitTypes: INDIRECT_FIRE } },
    ],
  },
  calloway: {
    name: "Dale Calloway",
    nation: "us",
    style: "A patient admiral. Keeps his ships moving and brings them home.",
    bonuses: ["Ships +1 move and +10% defense"],
    drawback: "Tanks −10% attack",
    effects: [
      { stat: "movePoints", op: "add", value: 1, scope: { categories: ["naval"] } },
      { stat: "defense", op: "add", value: 10, scope: { categories: ["naval"] } },
      { stat: "attack", op: "add", value: -10, scope: { unitTypes: TANKS } },
    ],
  },
  ashdown: {
    name: "Hugh Ashdown",
    nation: "uk",
    style: "Methodical. Attacks only after the guns have done their work, and then with infantry.",
    bonuses: ["Indirect fire +15% attack", "Foot soldiers +10% attack"],
    drawback: "Tanks −1 move",
    effects: [
      { stat: "attack", op: "add", value: 15, scope: { unitTypes: INDIRECT_FIRE } },
      { stat: "attack", op: "add", value: 10, scope: { unitTypes: FOOT_SOLDIERS } },
      { stat: "movePoints", op: "add", value: -1, scope: { unitTypes: TANKS } },
    ],
  },
  tremblay: {
    name: "Luc Tremblay",
    nation: "canada",
    style: "An inventor who carries his infantry forward under armor. His troops learn fast.",
    bonuses: ["Halftracks +1 move", "Units reach Veteran at 2 kills and Elite at 5"],
    drawback: "Air units −10% attack",
    effects: [
      { stat: "movePoints", op: "add", value: 1, scope: { unitTypes: ["halftrack"] } },
      { stat: "veteranKills", op: "set", value: 2 },
      { stat: "eliteKills", op: "set", value: 5 },
      { stat: "attack", op: "add", value: -10, scope: { categories: ["air"] } },
    ],
  },
  morozov: {
    name: "Stepan Morozov",
    nation: "ussr",
    style: "Wins by weight of numbers, and fights for a city street by street.",
    bonuses: ["All units cost 10% less", "Foot soldiers +20% attack in Cities"],
    drawback: "All units −10% defense",
    effects: [
      { stat: "cost", op: "multiply", value: 0.9 },
      { stat: "attack", op: "add", value: 20, scope: { unitTypes: FOOT_SOLDIERS, terrain: ["city"] } },
      { stat: "defense", op: "add", value: -10 },
    ],
  },
  falk: {
    name: "Konrad Falk",
    nation: "germany",
    style: "Bold, fast strikes that outrun his supply columns.",
    bonuses: ["Tanks and Tank Destroyers +15% attack when they start the fight", "Recon +1 move"],
    drawback: "All units carry 20% less fuel and ammo",
    effects: [
      { stat: "attack", op: "add", value: 15, scope: { unitTypes: [...TANKS, "tankDestroyer"], fight: ["started"] } },
      { stat: "movePoints", op: "add", value: 1, scope: { unitTypes: ["recon"] } },
      { stat: "maxFuel", op: "multiply", value: 0.8 },
      { stat: "maxAmmo", op: "multiply", value: 0.8 },
    ],
  },
  ferrante: {
    name: "Aldo Ferrante",
    nation: "italy",
    style: "A patient defender. Lets the ground do the work and makes an attacker pay for every step.",
    bonuses: ["All units +15% defense on Hills, Ridges and Cities", "All units +20% attack on counterattacks"],
    drawback: "All units −10% attack when they start the fight",
    effects: [
      { stat: "defense", op: "add", value: 15, scope: { terrain: ["hills", "ridge", "city"] } },
      { stat: "attack", op: "add", value: 20, scope: { fight: ["answered"] } },
      { stat: "attack", op: "add", value: -10, scope: { fight: ["started"] } },
    ],
  },
  arakawa: {
    name: "Kenji Arakawa",
    nation: "japan",
    style: "Strikes first from the air, and digs in deep on the ground.",
    bonuses: [
      "Dive Bombers and Torpedo Bombers +1 move and +10% attack",
      "Land units on Bunkers and Hills +25% defense against indirect fire, ships and bombers",
    ],
    drawback: "Tanks −1 move",
    effects: [
      { stat: "movePoints", op: "add", value: 1, scope: { unitTypes: CARRIER_BOMBERS } },
      { stat: "attack", op: "add", value: 10, scope: { unitTypes: CARRIER_BOMBERS } },
      { stat: "defense", op: "add", value: 25, scope: { categories: ["land"], terrain: ["bunker", "hills"], opponentTypes: [...INDIRECT_FIRE, ...BOMBERS] } },
      { stat: "defense", op: "add", value: 25, scope: { categories: ["land"], terrain: ["bunker", "hills"], opponentCategories: ["naval"] } },
      { stat: "movePoints", op: "add", value: -1, scope: { unitTypes: TANKS } },
    ],
  },
} as const satisfies Record<CommanderId, CommanderDef>;

export function commanderDef(id: CommanderId): CommanderDef {
  return COMMANDERS[id];
}
