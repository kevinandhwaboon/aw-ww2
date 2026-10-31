// Combat rules (03-combat). Used both by apply() to resolve attacks and by the UI for target
// highlights and the damage forecast, so what the forecast promises is what the engine does.
//
// Functions take the attacker as it will be when it fires: at its destination, after moving.

import type { CombatStrike, GameEvent } from "./commands";
import { baseDamage, type DamageEntry, type DamageTarget } from "./data/damage";
import { terrainDef } from "./data/terrain";
import { UNITS } from "./data/units";
import { veterancyFor } from "./data/veterancy";
import { inBounds, type Point } from "./map";
import { moveDestinations, tileIndex, tilePoint } from "./movement";
import { nextInt, type RngState } from "./rng";
import { displayHp, fortAt, unitAt, type GameState, type Unit } from "./state";
import * as stats from "./stats";

export const MAX_LUCK = 9;

export function distance(a: Point, b: Point): number {
  return Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
}

/**
 * The weapon a unit would use against a target type, or null if it can't attack it now (03-combat §2).
 * The chart gives one weapon per pairing, so a unit out of primary ammo can only attack targets the
 * chart lists a secondary-weapon value for.
 */
export function chooseWeapon(unit: Unit, targetType: DamageTarget): DamageEntry | null {
  const entry = baseDamage(unit.type, targetType);
  if (!entry) return null;
  return entry.weapon === "primary" && unit.ammo <= 0 ? null : entry;
}

export interface DamageInputs {
  readonly base: number;
  readonly attackMod: number;
  readonly luck: number;
  /** Displayed HP, 1–10. */
  readonly attackerHp: number;
  readonly defenseMod: number;
  readonly terrainStars: number;
  /** Displayed HP, 1–10. */
  readonly defenderHp: number;
}

/**
 * The damage formula (03-combat §1), in internal HP:
 *   (base × attackMod/100 + luck) × (attackerHP/10) × ((200 − defenseMod − stars × defenderHP)/100)
 * rounded down, never below 0. Computed in whole numbers so float error can't change a result.
 */
export function damageFormula(i: DamageInputs): number {
  const attack = i.base * i.attackMod + i.luck * 100;
  const defense = 200 - i.defenseMod - i.terrainStars * i.defenderHp;
  return Math.max(0, Math.floor((attack * i.attackerHp * defense) / 100_000));
}

function damageWith(state: GameState, attacker: Unit, defender: Unit, entry: DamageEntry, luck: number): number {
  return damageFormula({
    base: entry.base,
    attackMod: stats.attackMod(state, attacker),
    luck,
    attackerHp: displayHp(attacker.hp),
    defenseMod: stats.defenseMod(state, defender),
    terrainStars: stats.terrainStars(state, defender),
    defenderHp: displayHp(defender.hp),
  });
}

function sameSide(state: GameState, a: Unit, b: Unit): boolean {
  return state.players[a.owner]?.side === state.players[b.owner]?.side;
}

/** Why the attacker can't fire on this tile from where it stands, or null if it can. */
function rangeProblem(state: GameState, attacker: Unit, target: Point, moved: boolean): string | null {
  if (moved && !UNITS[attacker.type].canMoveAndFire) return "indirect units can't move and fire";
  const range = stats.attackRange(state, attacker);
  if (!range) return "the unit is unarmed";
  const d = distance(attacker.pos, target);
  if (d < range.min || d > range.max) return `the target is ${d} tiles away, outside range ${range.min}–${range.max}`;
  return null;
}

/** Why the attacker can't hit this defender from where it stands, or null if it can. */
export function targetProblem(state: GameState, attacker: Unit, defender: Unit, moved: boolean): string | null {
  if (sameSide(state, attacker, defender)) return "the target is on your side";
  const problem = rangeProblem(state, attacker, defender.pos, moved);
  if (problem) return problem;
  if (!chooseWeapon(attacker, defender.type)) return "no usable weapon against that target";
  return null;
}

/**
 * Why the attacker can't hit a fortification on this tile, or null if it can. Pass the state with
 * the attacker already moved, since a unit can step off a bunker and then shell it (03-combat §4).
 */
export function fortTargetProblem(state: GameState, attacker: Unit, pos: Point, moved: boolean): string | null {
  if (!fortAt(state, pos)) return "there is no fortification there";
  if (unitAt(state, pos)) return "it's occupied, so attack the unit instead";
  const problem = rangeProblem(state, attacker, pos, moved);
  if (problem) return problem;
  if (!chooseWeapon(attacker, "fort")) return "no usable weapon against fortifications";
  return null;
}

/** Empty fortifications and obstacles this attacker can hit. Pass the state with the attacker moved. */
export function fortTargets(state: GameState, attacker: Unit, moved: boolean): Point[] {
  return state.fortifications.map((f) => f.pos).filter((pos) => fortTargetProblem(state, attacker, pos, moved) === null);
}

/** Enemy units this attacker can hit from where it stands. */
export function attackTargets(state: GameState, attacker: Unit, moved: boolean): Unit[] {
  return state.units.filter((u) => u.id !== attacker.id && targetProblem(state, attacker, u, moved) === null);
}

/** Every tile the unit could fire on this turn, moving first if it's able to (for threat ranges). */
export function threatTiles(state: GameState, unit: Unit): Point[] {
  const range = stats.attackRange(state, unit);
  if (!range) return [];
  const origins = UNITS[unit.type].canMoveAndFire ? moveDestinations(state, unit) : [unit.pos];
  const tiles = new Set<number>();
  for (const from of origins) {
    for (let dy = -range.max; dy <= range.max; dy++) {
      const reach = range.max - Math.abs(dy);
      for (let dx = -reach; dx <= reach; dx++) {
        const p = { x: from.x + dx, y: from.y + dy };
        if (distance(from, p) >= range.min && inBounds(state.map, p)) tiles.add(tileIndex(state, p));
      }
    }
  }
  return [...tiles].sort((a, b) => a - b).map((i) => tilePoint(state, i));
}

/**
 * Whether a defender that survived hits back (03-combat §2): only direct-fire units, only against
 * an adjacent attacker, and only with a usable weapon. Indirect units never counter or get countered.
 */
export function canCounter(state: GameState, attacker: Unit, defender: Unit): boolean {
  const range = stats.attackRange(state, defender);
  return (
    range !== null &&
    range.min === 1 &&
    distance(attacker.pos, defender.pos) === 1 &&
    chooseWeapon(defender, attacker.type) !== null
  );
}

export interface CombatForecast {
  readonly weapon: DamageEntry["weapon"];
  /** Damage to the defender, in internal HP (%), at lowest and highest luck. */
  readonly attack: { readonly min: number; readonly max: number };
  /** Damage back to the attacker, or null if there's no counter whatever the luck. */
  readonly counter: { readonly min: number; readonly max: number } | null;
  /** The defender dies at highest luck. */
  readonly canKill: boolean;
  /** The defender dies whatever the luck. */
  readonly certainKill: boolean;
  /** The counter can destroy the attacker at highest luck. */
  readonly counterCanKill: boolean;
  /** The counter destroys the attacker whatever the luck. */
  readonly counterCertainKill: boolean;
}

/**
 * Expected result of an attack (03-combat §2), or null if the attacker has no weapon for it. The
 * counter's range covers both luck rolls: most damage when the defender took the least, and vice versa.
 */
export function forecast(state: GameState, attacker: Unit, defender: Unit): CombatForecast | null {
  const entry = chooseWeapon(attacker, defender.type);
  if (!entry) return null;
  const luckCap = state.settings.luck ? MAX_LUCK : 0;
  const min = damageWith(state, attacker, defender, entry, 0);
  const max = damageWith(state, attacker, defender, entry, luckCap);
  const canKill = max >= defender.hp;
  const certainKill = min >= defender.hp;

  let counter: CombatForecast["counter"] = null;
  const counterEntry = chooseWeapon(defender, attacker.type);
  if (!certainKill && counterEntry && canCounter(state, attacker, defender)) {
    const strongest = damageWith(state, { ...defender, hp: defender.hp - min }, attacker, counterEntry, luckCap);
    const weakest = canKill ? 0 : damageWith(state, { ...defender, hp: defender.hp - max }, attacker, counterEntry, 0);
    counter = { min: weakest, max: strongest };
  }
  return {
    weapon: entry.weapon,
    attack: { min, max },
    counter,
    canKill,
    certainKill,
    counterCanKill: counter !== null && counter.max >= attacker.hp,
    counterCertainKill: counter !== null && counter.min >= attacker.hp,
  };
}

function fortDamage(state: GameState, attacker: Unit, pos: Point, entry: DamageEntry, luck: number): number {
  const terrain = state.map.terrain[tileIndex(state, pos)];
  if (terrain === undefined) throw new Error(`(${pos.x}, ${pos.y}) is outside the map`);
  return damageFormula({
    base: entry.base,
    attackMod: stats.attackMod(state, attacker),
    luck,
    attackerHp: displayHp(attacker.hp),
    defenseMod: stats.fortDefenseMod(state, terrain),
    terrainStars: 0,
    defenderHp: displayHp(fortAt(state, pos)?.hp ?? 0),
  });
}

/** Expected result of attacking a fortification. They never counter (03-combat §4). */
export function fortForecast(state: GameState, attacker: Unit, pos: Point): CombatForecast | null {
  const entry = chooseWeapon(attacker, "fort");
  const fort = fortAt(state, pos);
  if (!entry || !fort) return null;
  const min = fortDamage(state, attacker, pos, entry, 0);
  const max = fortDamage(state, attacker, pos, entry, state.settings.luck ? MAX_LUCK : 0);
  return {
    weapon: entry.weapon,
    attack: { min, max },
    counter: null,
    canKill: max >= fort.hp,
    certainKill: min >= fort.hp,
    counterCanKill: false,
    counterCertainKill: false,
  };
}

/**
 * Resolves an attack on a fortification (03-combat §4). `attacker` is the moved unit, already in
 * state; validity has been checked by the caller. Breaking one replaces the tile's terrain and
 * doesn't count as a kill.
 */
export function resolveFortAttack(
  state: GameState,
  attacker: Unit,
  pos: Point,
): { state: GameState; event: Extract<GameEvent, { type: "fortAttacked" }> } {
  const entry = chooseWeapon(attacker, "fort");
  const fort = fortAt(state, pos);
  const index = tileIndex(state, pos);
  const terrain = state.map.terrain[index];
  if (!entry || !fort || terrain === undefined) throw new Error(`Can't attack a fortification at (${pos.x}, ${pos.y})`);

  const roll = state.settings.luck ? nextInt(state.rng, 0, MAX_LUCK) : { value: 0, rng: state.rng };
  const damage = Math.min(fort.hp, fortDamage(state, attacker, pos, entry, roll.value));
  const hp = fort.hp - damage;
  const fired = fire(attacker, entry);
  const becomes = hp === 0 ? (terrainDef(terrain).breakable?.becomes ?? null) : null;

  return {
    state: {
      ...state,
      rng: roll.rng,
      units: state.units.map((u) => (u.id === fired.id ? fired : u)),
      map: becomes ? { ...state.map, terrain: state.map.terrain.map((t, i) => (i === index ? becomes : t)) } : state.map,
      fortifications: state.fortifications.flatMap((f) => (f !== fort ? [f] : hp > 0 ? [{ ...f, hp }] : [])),
    },
    event: {
      type: "fortAttacked",
      attackerId: attacker.id,
      attackerPos: attacker.pos,
      pos,
      attack: { weapon: entry.weapon, luck: roll.value, damage },
      hp,
      becomes,
    },
  };
}

function strike(
  state: GameState,
  rng: RngState,
  attacker: Unit,
  defender: Unit,
  entry: DamageEntry,
): { strike: CombatStrike; rng: RngState } {
  const roll = state.settings.luck ? nextInt(rng, 0, MAX_LUCK) : { value: 0, rng };
  const damage = Math.min(defender.hp, damageWith(state, attacker, defender, entry, roll.value));
  return { strike: { weapon: entry.weapon, luck: roll.value, damage }, rng: roll.rng };
}

const fire = (unit: Unit, entry: DamageEntry): Unit =>
  entry.weapon === "primary" ? { ...unit, ammo: unit.ammo - 1 } : unit;

function creditKill(unit: Unit): { unit: Unit; promotedTo: ReturnType<typeof veterancyFor>["level"] | null } {
  const before = veterancyFor(unit.kills).level;
  const after = veterancyFor(unit.kills + 1).level;
  return { unit: { ...unit, kills: unit.kills + 1 }, promotedTo: after === before ? null : after };
}

/**
 * Resolves an attack (03-combat §2). `attacker` is the moved unit, already in state; validity has
 * been checked by the caller. Each attack and each counter rolls its own luck.
 */
export function resolveCombat(
  state: GameState,
  attacker: Unit,
  defender: Unit,
): { state: GameState; event: Extract<GameEvent, { type: "combat" }> } {
  const entry = chooseWeapon(attacker, defender.type);
  if (!entry) throw new Error(`${attacker.type} has no weapon against ${defender.type}`);

  const attack = strike(state, state.rng, attacker, defender, entry);
  let rng = attack.rng;
  let a = fire(attacker, entry);
  let d: Unit = { ...defender, hp: defender.hp - attack.strike.damage };

  let counter: CombatStrike | null = null;
  const counterEntry = chooseWeapon(d, a.type);
  if (d.hp > 0 && counterEntry && canCounter(state, a, d)) {
    const hit = strike(state, rng, d, a, counterEntry);
    rng = hit.rng;
    counter = hit.strike;
    a = { ...a, hp: a.hp - hit.strike.damage };
    d = fire(d, counterEntry);
  }

  let attackerPromotion = null;
  let defenderPromotion = null;
  if (d.hp === 0) {
    const credited = creditKill(a);
    a = credited.unit;
    attackerPromotion = credited.promotedTo;
  } else if (a.hp === 0) {
    const credited = creditKill(d);
    d = credited.unit;
    defenderPromotion = credited.promotedTo;
  }

  const units = state.units
    .map((u) => (u.id === a.id ? a : u.id === d.id ? d : u))
    .filter((u) => u.hp > 0);

  return {
    state: { ...state, units, rng },
    event: {
      type: "combat",
      attacker: { unitId: a.id, type: a.type, owner: a.owner, pos: a.pos, hp: a.hp, destroyed: a.hp === 0, promotedTo: attackerPromotion },
      defender: { unitId: d.id, type: d.type, owner: d.owner, pos: d.pos, hp: d.hp, destroyed: d.hp === 0, promotedTo: defenderPromotion },
      attack: attack.strike,
      counter,
    },
  };
}
