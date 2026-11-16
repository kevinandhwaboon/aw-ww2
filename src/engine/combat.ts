// Combat rules (03-combat). Used both by apply() to resolve attacks and by the UI for target
// highlights and the damage forecast, so what the forecast promises is what the engine does.
//
// Functions take the attacker as it will be when it fires: at its destination, after moving.

import type { CombatStrike, GameEvent } from "./commands";
import { baseDamage, returnFireDamage, type DamageEntry, type DamageTarget } from "./data/damage";
import { terrainDef, type TerrainId } from "./data/terrain";
import { FOOT_UNITS, unitDef, UNITS, type UnitTypeId } from "./data/units";
import type { VeterancyLevel } from "./data/veterancy";
import { inBounds, terrainAt, type Point } from "./map";
import type { FightRole } from "./modifiers";
import { moveDestinations, tileIndex, tilePoint } from "./movement";
import { nextInt, type RngState } from "./rng";
import { displayHp, fortAt, unitAt, type FortificationState, type GameState, type Unit } from "./state";
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

const FOOT: readonly UnitTypeId[] = FOOT_UNITS;

/**
 * The bunker shielding this unit, or undefined if it isn't garrisoned (03-combat §4): Infantry,
 * Assault Infantry or a Mortar Team in a standing bunker. Attacks on a garrison hit the bunker.
 */
export function garrisonBunker(state: GameState, unit: Unit): FortificationState | undefined {
  if (!FOOT.includes(unit.type) || terrainAt(state.map, unit.pos) !== "bunker") return undefined;
  return fortAt(state, unit.pos);
}

/**
 * The weapon the attacker would use on this defender, or null if it has none (03-combat §2, §4).
 * Against a garrison it fires at the bunker, so it needs a weapon against fortifications.
 */
export function weaponAgainst(state: GameState, attacker: Unit, defender: Unit): DamageEntry | null {
  return chooseWeapon(attacker, garrisonBunker(state, defender) ? "fort" : defender.type);
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

/**
 * Damage from one shot. `role` is the shooter's part in the fight: "started" for the attack,
 * "answered" for the counterattack, so modifiers that depend on it apply (06-commanders §6).
 */
function damageWith(state: GameState, attacker: Unit, defender: Unit, entry: DamageEntry, luck: number, role: FightRole): number {
  return damageFormula({
    base: entry.base,
    attackMod: stats.attackMod(state, attacker, { role, opponent: defender }),
    luck,
    attackerHp: displayHp(attacker.hp),
    defenseMod: stats.defenseMod(state, defender, { role: role === "started" ? "answered" : "started", opponent: attacker }),
    terrainStars: stats.terrainStars(state, defender),
    defenderHp: displayHp(defender.hp),
  });
}

/** Only some units can reach a submerged submarine, to attack it or to counter it (03-combat §5c). */
function canReach(attacker: Unit, defender: Unit): boolean {
  return defender.submerged !== true || UNITS[attacker.type].attacksSubmerged;
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
  if (!weaponAgainst(state, attacker, defender)) {
    return garrisonBunker(state, defender) ? "it's garrisoned, and this unit has no weapon against the bunker" : "no usable weapon against that target";
  }
  if (!canReach(attacker, defender)) return "this unit can't attack a submerged submarine";
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

/**
 * Every tile the unit could fire on this turn, moving first if it's able to (for threat ranges).
 * A Carrier's range is its aircraft's: every tile they could strike if launched from where it is
 * now (05-supply-transport §10).
 */
export function threatTiles(state: GameState, unit: Unit): Point[] {
  const tiles = new Set<number>();
  addThreatTiles(state, unit, tiles);
  if (unitDef(unit.type).specialActions.includes("launch")) {
    for (const aircraft of unit.cargo) addThreatTiles(state, { ...aircraft, pos: unit.pos }, tiles);
  }
  return [...tiles].sort((a, b) => a - b).map((i) => tilePoint(state, i));
}

function addThreatTiles(state: GameState, unit: Unit, tiles: Set<number>): void {
  const range = stats.attackRange(state, unit);
  if (!range) return;
  const origins = UNITS[unit.type].canMoveAndFire ? moveDestinations(state, unit) : [unit.pos];
  for (const from of origins) {
    for (let dy = -range.max; dy <= range.max; dy++) {
      const reach = range.max - Math.abs(dy);
      for (let dx = -reach; dx <= reach; dx++) {
        const p = { x: from.x + dx, y: from.y + dy };
        if (distance(from, p) >= range.min && inBounds(state.map, p)) tiles.add(tileIndex(state, p));
      }
    }
  }
}

/**
 * The weapon a defender that survived hits back with, or null if it doesn't (03-combat §2): only
 * against an adjacent attacker it can reach. Direct-fire units use their usual weapon; indirect units
 * never counter, except that a unit with return-fire AA (Battleship, Carrier) fires it back at an
 * aircraft that attacked it (03-combat §5d).
 */
export function counterWeapon(state: GameState, attacker: Unit, defender: Unit): DamageEntry | null {
  if (distance(attacker.pos, defender.pos) !== 1 || !canReach(defender, attacker)) return null;
  const range = stats.attackRange(state, defender);
  const usual = range !== null && range.min === 1 ? chooseWeapon(defender, attacker.type) : null;
  if (usual) return usual;
  if (UNITS[attacker.type].category !== "air" || !UNITS[defender.type].returnFireAA) return null;
  return returnFireDamage(defender.type, attacker.type);
}

/** Whether a defender that survived hits back (03-combat §2, §5d). */
export function canCounter(state: GameState, attacker: Unit, defender: Unit): boolean {
  return counterWeapon(state, attacker, defender) !== null;
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
  const bunker = garrisonBunker(state, defender);
  if (bunker) return garrisonForecast(state, attacker, defender, bunker);
  const entry = chooseWeapon(attacker, defender.type);
  if (!entry) return null;
  const luckCap = state.settings.luck ? MAX_LUCK : 0;
  const min = damageWith(state, attacker, defender, entry, 0, "started");
  const max = damageWith(state, attacker, defender, entry, luckCap, "started");
  const canKill = max >= defender.hp;
  const certainKill = min >= defender.hp;

  let counter: CombatForecast["counter"] = null;
  const counterEntry = counterWeapon(state, attacker, defender);
  if (!certainKill && counterEntry) {
    const strongest = damageWith(state, { ...defender, hp: defender.hp - min }, attacker, counterEntry, luckCap, "answered");
    const weakest = canKill ? 0 : damageWith(state, { ...defender, hp: defender.hp - max }, attacker, counterEntry, 0, "answered");
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

/**
 * An attack on a garrison (03-combat §4): the damage goes to the bunker, with the bunker's HP and
 * defense. The soldiers inside are unhurt, so they fire back at full strength unless it breaks.
 */
function garrisonForecast(state: GameState, attacker: Unit, defender: Unit, bunker: FortificationState): CombatForecast | null {
  const entry = chooseWeapon(attacker, "fort");
  if (!entry) return null;
  const luckCap = state.settings.luck ? MAX_LUCK : 0;
  const min = fortDamage(state, attacker, bunker, entry, 0, defender);
  const max = fortDamage(state, attacker, bunker, entry, luckCap, defender);
  const canKill = max >= bunker.hp;
  const certainKill = min >= bunker.hp;
  const counterEntry = certainKill ? null : counterWeapon(state, attacker, defender);
  const counter = counterEntry
    ? { min: canKill ? 0 : damageWith(state, defender, attacker, counterEntry, 0, "answered"), max: damageWith(state, defender, attacker, counterEntry, luckCap, "answered") }
    : null;
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

/** Damage to a fortification. `garrison` is the unit inside a bunker, if any: the bunker defends as its owner would. */
function fortDamage(state: GameState, attacker: Unit, fort: FortificationState, entry: DamageEntry, luck: number, garrison?: Unit): number {
  const terrain = state.map.terrain[tileIndex(state, fort.pos)];
  if (terrain === undefined) throw new Error(`(${fort.pos.x}, ${fort.pos.y}) is outside the map`);
  return damageFormula({
    base: entry.base,
    attackMod: stats.attackMod(state, attacker, { role: "started", opponent: "fort" }),
    luck,
    attackerHp: displayHp(attacker.hp),
    defenseMod: stats.fortDefenseMod(state, terrain, garrison ? { unit: garrison, attacker } : undefined),
    terrainStars: 0,
    defenderHp: displayHp(fort.hp),
  });
}

/** The state with this fortification down to `hp`, replaced by its broken terrain at 0. */
function damageFort(state: GameState, fort: FortificationState, hp: number): { state: GameState; becomes: TerrainId | null } {
  const index = tileIndex(state, fort.pos);
  const terrain = state.map.terrain[index];
  if (terrain === undefined) throw new Error(`(${fort.pos.x}, ${fort.pos.y}) is outside the map`);
  const becomes = hp === 0 ? (terrainDef(terrain).breakable?.becomes ?? null) : null;
  return {
    state: {
      ...state,
      map: becomes ? { ...state.map, terrain: state.map.terrain.map((t, i) => (i === index ? becomes : t)) } : state.map,
      fortifications: state.fortifications.flatMap((f) => (f !== fort ? [f] : hp > 0 ? [{ ...f, hp }] : [])),
    },
    becomes,
  };
}

/** Expected result of attacking a fortification. They never counter (03-combat §4). */
export function fortForecast(state: GameState, attacker: Unit, pos: Point): CombatForecast | null {
  const entry = chooseWeapon(attacker, "fort");
  const fort = fortAt(state, pos);
  if (!entry || !fort) return null;
  const min = fortDamage(state, attacker, fort, entry, 0);
  const max = fortDamage(state, attacker, fort, entry, state.settings.luck ? MAX_LUCK : 0);
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
  if (!entry || !fort) throw new Error(`Can't attack a fortification at (${pos.x}, ${pos.y})`);

  const roll = state.settings.luck ? nextInt(state.rng, 0, MAX_LUCK) : { value: 0, rng: state.rng };
  const damage = Math.min(fort.hp, fortDamage(state, attacker, fort, entry, roll.value));
  const hp = fort.hp - damage;
  const fired = fire(attacker, entry);
  const broken = damageFort({ ...state, rng: roll.rng, units: state.units.map((u) => (u.id === fired.id ? fired : u)) }, fort, hp);
  const becomes = broken.becomes;

  return {
    state: broken.state,
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
  role: FightRole,
): { strike: CombatStrike; rng: RngState } {
  const roll = state.settings.luck ? nextInt(rng, 0, MAX_LUCK) : { value: 0, rng };
  const damage = Math.min(defender.hp, damageWith(state, attacker, defender, entry, roll.value, role));
  return { strike: { weapon: entry.weapon, luck: roll.value, damage }, rng: roll.rng };
}

/** A shot at a garrison's bunker, using the bunker's HP and defense (03-combat §4). */
function strikeFort(state: GameState, attacker: Unit, fort: FortificationState, entry: DamageEntry, garrison: Unit): { strike: CombatStrike; rng: RngState } {
  const roll = state.settings.luck ? nextInt(state.rng, 0, MAX_LUCK) : { value: 0, rng: state.rng };
  const damage = Math.min(fort.hp, fortDamage(state, attacker, fort, entry, roll.value, garrison));
  return { strike: { weapon: entry.weapon, luck: roll.value, damage }, rng: roll.rng };
}

const fire = (unit: Unit, entry: DamageEntry): Unit =>
  entry.weapon === "primary" ? { ...unit, ammo: unit.ammo - 1 } : unit;

function creditKill(state: GameState, unit: Unit): { unit: Unit; promotedTo: VeterancyLevel | null } {
  const before = stats.veterancy(state, unit).level;
  const after = stats.veterancyAt(state, unit, unit.kills + 1).level;
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
  const entry = weaponAgainst(state, attacker, defender);
  if (!entry) throw new Error(`${attacker.type} has no weapon against ${defender.type}`);

  // A garrison's bunker takes the hit; the soldiers inside are lost only if it breaks (03-combat §4).
  const bunker = garrisonBunker(state, defender);
  const attack = bunker ? strikeFort(state, attacker, bunker, entry, defender) : strike(state, state.rng, attacker, defender, entry, "started");
  let rng = attack.rng;
  let a = fire(attacker, entry);
  const bunkerHp = bunker ? bunker.hp - attack.strike.damage : null;
  let d: Unit = { ...defender, hp: bunkerHp === null ? defender.hp - attack.strike.damage : bunkerHp === 0 ? 0 : defender.hp };

  let counter: CombatStrike | null = null;
  const counterEntry = counterWeapon(state, a, d);
  if (d.hp > 0 && counterEntry) {
    const hit = strike(state, rng, d, a, counterEntry, "answered");
    rng = hit.rng;
    counter = hit.strike;
    a = { ...a, hp: a.hp - hit.strike.damage };
    d = fire(d, counterEntry);
  }

  let attackerPromotion = null;
  let defenderPromotion = null;
  if (d.hp === 0) {
    const credited = creditKill(state, a);
    a = credited.unit;
    attackerPromotion = credited.promotedTo;
  } else if (a.hp === 0) {
    const credited = creditKill(state, d);
    d = credited.unit;
    defenderPromotion = credited.promotedTo;
  }

  const units = state.units
    .map((u) => (u.id === a.id ? a : u.id === d.id ? d : u))
    .filter((u) => u.hp > 0);
  const after = bunker && bunkerHp !== null ? damageFort({ ...state, units, rng }, bunker, bunkerHp) : null;

  return {
    state: after?.state ?? { ...state, units, rng },
    event: {
      type: "combat",
      attacker: { unitId: a.id, type: a.type, owner: a.owner, pos: a.pos, hp: a.hp, destroyed: a.hp === 0, promotedTo: attackerPromotion },
      defender: { unitId: d.id, type: d.type, owner: d.owner, pos: d.pos, hp: d.hp, destroyed: d.hp === 0, promotedTo: defenderPromotion },
      attack: attack.strike,
      counter,
      ...(bunker && bunkerHp !== null ? { bunker: { pos: bunker.pos, hp: bunkerHp, becomes: after?.becomes ?? null } } : {}),
    },
  };
}
