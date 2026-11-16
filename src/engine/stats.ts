// Stat lookups. Game logic reads unit and terrain numbers ONLY through these functions, never
// from the data tables directly, so every value passes through the modifier layer.

import { commanderDef } from "./data/commanders";
import { TERRAIN, type TerrainId } from "./data/terrain";
import { UNITS, type UnitTypeId } from "./data/units";
import { VETERANCY, veterancyFor, type VeterancyDef } from "./data/veterancy";
import { applyModifiers, modifierApplies, type FightRole, type ModifiableStat, type Modifier, type PlayerId, type StatContext } from "./modifiers";
import type { GameState, Player, Unit } from "./state";
import { weatherModifiers } from "./weather";

/** A fight a stat is being worked out for: the unit's part in it, and who it faces (a unit, or a fortification). */
export interface Fight {
  readonly role: FightRole;
  readonly opponent: Unit | "fort";
}

const killsFor = (level: VeterancyDef["level"]): number => VETERANCY.find((v) => v.level === level)?.minKills ?? 0;

/** The unit's veterancy level (03-combat §6). The kill counts for each level pass through the modifier layer. */
export function veterancy(state: GameState, unit: Unit): VeterancyDef {
  return veterancyAt(state, unit, unit.kills);
}

/** The level this unit would have with `kills` kills. */
export function veterancyAt(state: GameState, unit: Unit, kills: number): VeterancyDef {
  return veterancyWith(unitContext(state, unit), compiledModifiers(state), kills);
}

function veterancyWith(ctx: StatContext, compiled: StateModifiers, kills: number): VeterancyDef {
  // Nobody has changed the kill counts in most games, so skip the lookups then: this runs for every stat.
  if (!compiled.changesVeterancy) return veterancyFor(kills);
  const mods = compiled.all;
  return veterancyFor(kills, {
    veteran: applyModifiers(killsFor("veteran"), "veteranKills", ctx, mods),
    elite: applyModifiers(killsFor("elite"), "eliteKills", ctx, mods),
  });
}

/** Modifiers that come from the unit itself rather than from GameState (currently veterancy). */
export function unitModifiers(state: GameState, unit: Unit): Modifier[] {
  return veterancyModifiers(veterancy(state, unit));
}

function veterancyModifiers(vet: VeterancyDef): Modifier[] {
  if (vet.attackBonus === 0 && vet.defenseBonus === 0) return [];
  const source = `veterancy:${vet.level}`;
  return [
    { source, stat: "attack", op: "add", value: vet.attackBonus },
    { source, stat: "defense", op: "add", value: vet.defenseBonus },
  ];
}

const commanderCache = new WeakMap<readonly Player[], readonly Modifier[]>();

/**
 * Each player's commander as modifiers that apply to that player alone (06-commanders §2). Derived
 * from the players, not stored, so a saved game holds only who commands whom.
 */
export function commanderModifiers(state: GameState): readonly Modifier[] {
  const cached = commanderCache.get(state.players);
  if (cached) return cached;
  const mods = state.players.flatMap((p) =>
    p.commander === undefined
      ? []
      : commanderDef(p.commander).effects.map((e): Modifier => ({ ...e, source: `co:${p.commander}`, scope: { ...e.scope, players: [p.id] } })),
  );
  commanderCache.set(state.players, mods);
  return mods;
}

interface StateModifiers {
  readonly players: readonly Player[];
  readonly day: number;
  readonly weather: GameState["weather"];
  readonly all: readonly Modifier[];
  /** Whether any of them changes the kills a veterancy level takes. */
  readonly changesVeterancy: boolean;
}

// Stat lookups are the hottest code in the engine (the AI makes millions), so the list is built once
// and reused until one of the things it is derived from changes. A game's scenario modifiers never
// change, so they key the cache.
const stateModifierCache = new WeakMap<readonly Modifier[], StateModifiers>();

function compiledModifiers(state: GameState): StateModifiers {
  const cached = stateModifierCache.get(state.modifiers);
  if (cached && cached.players === state.players && cached.day === state.day && cached.weather === state.weather) return cached;
  const all = [...state.modifiers, ...commanderModifiers(state), ...weatherModifiers(state)];
  const fresh: StateModifiers = {
    players: state.players,
    day: state.day,
    weather: state.weather,
    all,
    changesVeterancy: all.some((m) => m.stat === "veteranKills" || m.stat === "eliteKills"),
  };
  stateModifierCache.set(state.modifiers, fresh);
  return fresh;
}

/** Scenario modifiers, the players' commanders and today's weather: everything stored in or derived from GameState. */
function stateModifiers(state: GameState): readonly Modifier[] {
  return compiledModifiers(state).all;
}

function typeContext(player: PlayerId, type: UnitTypeId, terrain?: TerrainId): StatContext {
  const def = UNITS[type];
  const ctx = { player, unitType: type, category: def.category, movementType: def.movementType };
  return terrain === undefined ? ctx : { ...ctx, terrain };
}

function unitContext(state: GameState, unit: Unit, fight?: Fight): StatContext {
  const ctx = typeContext(unit.owner, unit.type, terrainUnder(state, unit));
  if (!fight) return ctx;
  if (fight.opponent === "fort") return { ...ctx, fight: fight.role };
  return { ...ctx, fight: fight.role, opponentType: fight.opponent.type, opponentCategory: UNITS[fight.opponent.type].category };
}

function terrainUnder(state: GameState, unit: Unit): TerrainId {
  const id = state.map.terrain[unit.pos.y * state.map.width + unit.pos.x];
  if (id === undefined) throw new Error(`Unit ${unit.id} is outside the map`);
  return id;
}

/** Every modifier currently affecting this unit (any stat), for UI and debugging. */
export function modifiersAffecting(state: GameState, unit: Unit): Modifier[] {
  const ctx = unitContext(state, unit);
  return [...stateModifiers(state), ...unitModifiers(state, unit)].filter((m) => modifierApplies(m, ctx));
}

function unitStat(state: GameState, unit: Unit, stat: ModifiableStat, base: number, fight?: Fight): number {
  const compiled = compiledModifiers(state);
  const ctx = unitContext(state, unit, fight);
  const own = veterancyModifiers(veterancyWith(ctx, compiled, unit.kills));
  return applyModifiers(base, stat, ctx, own.length > 0 ? [...compiled.all, ...own] : compiled.all);
}

export function movePoints(state: GameState, unit: Unit): number {
  return unitStat(state, unit, "movePoints", UNITS[unit.type].movePoints);
}

export function vision(state: GameState, unit: Unit): number {
  return unitStat(state, unit, "vision", UNITS[unit.type].vision);
}

export function maxFuel(state: GameState, unit: Unit): number {
  return unitStat(state, unit, "maxFuel", UNITS[unit.type].maxFuel);
}

/**
 * The ammo count a unit type carries before modifiers: its primary weapon's, or for a Supply Ship its
 * supply loads (05-supply-transport §3b); 0 for anything else.
 */
export function baseMaxAmmo(type: UnitTypeId): number {
  const def = UNITS[type];
  return def.primaryWeapon?.maxAmmo ?? def.supplyLoads ?? 0;
}

export function maxAmmo(state: GameState, unit: Unit): number {
  return unitStat(state, unit, "maxAmmo", baseMaxAmmo(unit.type));
}

/** Fuel burned at the start of the owner's turn. A submerged submarine burns more (05-supply-transport §9). */
export function fuelPerDay(state: GameState, unit: Unit): number {
  const def = UNITS[unit.type];
  const base = unit.submerged ? (def.fuelPerDaySubmerged ?? def.fuelPerDay) : def.fuelPerDay;
  return unitStat(state, unit, "fuelPerDay", base);
}

/** Fuel spent per movement point when the unit moves, on top of any daily burn (05-supply-transport §1). */
export function fuelPerMove(state: GameState, unit: Unit): number {
  return Math.max(1, unitStat(state, unit, "fuelPerMove", UNITS[unit.type].fuelPerMove));
}

/** Fuel a move costing `cost` movement points burns. */
export function moveFuel(state: GameState, unit: Unit, cost: number): number {
  return cost * fuelPerMove(state, unit);
}

/** Attack range in tiles, or null for unarmed units. */
export function attackRange(state: GameState, unit: Unit): { min: number; max: number } | null {
  const range = UNITS[unit.type].range;
  if (!range) return null;
  const min = unitStat(state, unit, "minRange", range.min);
  return { min, max: Math.max(min, unitStat(state, unit, "maxRange", range.max)) };
}

/**
 * attackMod in the damage formula, base 100 (03-combat §1). Pass the fight when working one out, so
 * modifiers that depend on who started it or on the opponent apply; without it they don't.
 */
export function attackMod(state: GameState, unit: Unit, fight?: Fight): number {
  return unitStat(state, unit, "attack", 100, fight);
}

/** defenseMod in the damage formula, base 100 (03-combat §1). Pass the fight as for attackMod. */
export function defenseMod(state: GameState, unit: Unit, fight?: Fight): number {
  return unitStat(state, unit, "defense", 100, fight);
}

/**
 * defenseMod for a fortification being attacked, base 100. It gets no terrain stars (03-combat §4).
 * A garrisoned bunker defends as its garrison's owner would: their commander and scenario modifiers
 * apply to it, against this attacker, but nothing of the soldiers' own (veterancy) does (06-commanders §6).
 */
export function fortDefenseMod(state: GameState, terrain: TerrainId, garrison?: { readonly unit: Unit; readonly attacker: Unit }): number {
  const ctx = garrison ? unitContext(state, garrison.unit, { role: "answered", opponent: garrison.attacker }) : { terrain };
  return applyModifiers(100, "defense", ctx, stateModifiers(state));
}

/** Displayed HP this unit repairs per turn on a property that repairs it (04-economy §5). */
export function repairHp(state: GameState, unit: Unit, base: number): number {
  return unitStat(state, unit, "repairHp", base);
}

/** Defense stars the unit gets where it stands. Air units always get 0 (02-terrain §1). */
export function terrainStars(state: GameState, unit: Unit): number {
  if (UNITS[unit.type].category === "air") return 0;
  return unitStat(state, unit, "terrainStars", TERRAIN[terrainUnder(state, unit)].defenseStars);
}

/**
 * Movement points this unit spends to enter a tile of the given terrain, or null if it can't
 * (02-terrain §3). Modifiers can change the cost but never make impassable terrain passable,
 * and a passable tile always costs at least 1.
 */
export function moveCost(state: GameState, unit: Unit, terrain: TerrainId): number | null {
  const base = TERRAIN[terrain].moveCost[UNITS[unit.type].movementType];
  if (base === null) return null;
  const ctx = typeContext(unit.owner, unit.type, terrain);
  return Math.max(1, applyModifiers(base, "moveCost", ctx, [...stateModifiers(state), ...unitModifiers(state, unit)]));
}

/** What a player pays to build a unit type. */
export function unitCost(state: GameState, player: PlayerId, type: UnitTypeId): number {
  return applyModifiers(UNITS[type].cost, "cost", typeContext(player, type), stateModifiers(state));
}

/** What a player earns at the start of each of their turns (04-economy §1). */
export function propertyIncome(state: GameState, player: PlayerId): number {
  const owned = state.properties.filter((p) => p.owner === player).length;
  return applyModifiers(owned * state.settings.incomePerProperty, "income", { player }, stateModifiers(state));
}
