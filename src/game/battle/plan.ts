// What a battle scene shows (08-art-pipeline §18): which unit stands on which half, how many figures
// each shows, which weapon fires, and the HP before and after each strike. Worked out from the
// combat event the engine already decided, so the scene can never change an outcome.

import type { GameEvent } from "../../engine/commands";
import { drawnAs } from "../artPack";
import type { NationId } from "../../engine/data/nations";
import type { TerrainId } from "../../engine/data/terrain";
import { UNITS, type UnitTypeId } from "../../engine/data/units";
import { terrainAt, type Point } from "../../engine/map";
import { displayHp, type GameState, type PlayerId } from "../../engine/state";

export type HalfId = "left" | "right";

/**
 * The fortifications a battle scene can show as the target of an attack (02-terrain §4, §4b), each
 * with its own figure: a Bunker, a Minefield, or an Obstacle (dragon's teeth).
 */
export const FORT_FIGURES = ["bunker", "minefield", "obstacle"] as const;
export type FortFigure = (typeof FORT_FIGURES)[number];

/** What a battle figure is: a unit type, or the fortification being shot at. */
export type FigureKind = UnitTypeId | FortFigure;

export const isFort = (kind: FigureKind): kind is FortFigure => (FORT_FIGURES as readonly string[]).includes(kind);

/** The figure an attacked fortification shows, from the terrain it stands on. */
export function fortFigure(terrain: TerrainId): FortFigure {
  return terrain === "minefield" || terrain === "obstacle" ? terrain : "bunker";
}

/**
 * How a weapon looks when it fires, which sets the shooter's animation, what flies across and
 * what it does when it lands.
 */
export type FireKind =
  | "rifle"
  | "mg"
  | "bazooka"
  | "mortar"
  | "tankGun"
  | "howitzer"
  | "rockets"
  | "aaGuns"
  | "flak"
  | "planeGuns"
  | "bombs"
  | "diveBomb"
  | "aerialTorpedo"
  | "navalGuns"
  | "deckGun"
  | "depthCharges"
  | "torpedo";

export interface BattleHalf {
  readonly half: HalfId;
  readonly kind: FigureKind;
  /** Null for a fortification, which no one owns. */
  readonly owner: PlayerId | null;
  readonly nation: NationId | null;
  /** The terrain the unit stands on, which sets the half's background. */
  readonly terrain: TerrainId;
  /** Displayed HP (1–10) when the scene opens. */
  readonly hp: number;
  readonly submerged: boolean;
  /** US Infantry dropped by a Transport Aircraft: drawn as 101st Airborne paratroopers. */
  readonly paratrooper: boolean;
  /** A paratrooper's helmet card suit (0 spade, 1 heart, 2 diamond, 3 club), picked by unit id as on the map. */
  readonly suit: number;
}

export interface BattleStrike {
  readonly from: HalfId;
  readonly fire: FireKind;
  /** The target's displayed HP before and after this strike. */
  readonly hpBefore: number;
  readonly hpAfter: number;
  /** The target is an aircraft, so shots go up. */
  readonly atAir: boolean;
}

export interface BattlePlan {
  readonly left: BattleHalf;
  readonly right: BattleHalf;
  /** The attack, then the counter if there was one. */
  readonly strikes: readonly BattleStrike[];
}

/** Most figures each kind shows at full HP. */
const MAX_FIGURES: Record<FigureKind, number> = {
  infantry: 8,
  assaultInfantry: 4,
  mortar: 3,
  recon: 5,
  halftrack: 5,
  lightTank: 5,
  mediumTank: 5,
  heavyTank: 5,
  tankDestroyer: 5,
  artillery: 5,
  rocketArtillery: 5,
  mobileAA: 5,
  flakGun: 5,
  // Three Chain Home masts; one falls for each third of its HP lost.
  radarStation: 3,
  // One gun: Schwerer Gustav.
  railwayGun: 1,
  fighter: 4,
  bomber: 3,
  transportAircraft: 3,
  diveBomber: 3,
  torpedoBomber: 3,
  battleship: 1,
  destroyer: 1,
  submarine: 1,
  landingCraft: 1,
  torpedoBoat: 1,
  carrier: 1,
  supplyShip: 1,
  bunker: 1,
  // A minefield shows six stretches of fence and mines; each goes up as HP falls.
  minefield: 6,
  // Nine dragon's teeth in three rows; they crack and topple as HP falls.
  obstacle: 9,
};

/** What each soldier of an Infantry squad carries, front of the formation first. */
export type SquadWeapon = "rifle" | "smg" | "lmg";

/**
 * A squad is mostly riflemen, as real WW2 squads were. The fifth man carries the squad's automatic
 * weapon (a BAR, an MG 42, a Type 99, a DP or a Bren), lying prone. The squad leader, second in
 * line, has a submachine gun (Thompson, MP 40, Type 100, PPSh-41 or Sten); a US or Soviet squad has a
 * second one, and paratroopers, who carried more of them, another. The rest carry rifles (Garand,
 * Kar98k, Arisaka, Mosin or Lee-Enfield; US paratroopers the M1 carbine). A British section, like
 * a German or Japanese squad, has one submachine gun.
 */
export function squadWeapon(figure: number, nation: NationId | null, paratrooper = false): SquadWeapon {
  if (figure === 4) return "lmg";
  if (figure === 1) return "smg";
  const oneSmg = nation === "germany" || nation === "japan" || nation === "uk" || nation === "canada" || nation === "italy";
  if (!oneSmg && figure === 5) return "smg";
  if (paratrooper && figure === 3) return "smg";
  return "rifle";
}

/**
 * Figures shown for a displayed HP: the most a kind shows, scaled down with HP and rounded up, so
 * any unit still alive shows at least one figure and a full-strength unit shows them all.
 */
export function figureCount(kind: FigureKind, hp: number): number {
  if (hp <= 0) return 0;
  return Math.ceil((Math.min(hp, 10) * MAX_FIGURES[kind]) / 10);
}

/** How the weapon that fired looks, from the shooter, the weapon slot the engine used, and the target. */
export function fireKind(shooter: UnitTypeId, weapon: "primary" | "secondary", target: FigureKind): FireKind {
  const primary = weapon === "primary";
  switch (shooter) {
    case "infantry":
      return "rifle";
    case "assaultInfantry":
      return primary ? "bazooka" : "mg";
    case "mortar":
      return "mortar";
    case "lightTank":
    case "mediumTank":
    case "heavyTank":
      return primary ? "tankGun" : "mg";
    case "tankDestroyer":
      return "tankGun";
    case "artillery":
    case "railwayGun":
      return "howitzer";
    case "rocketArtillery":
      return "rockets";
    case "mobileAA":
      return "aaGuns";
    case "flakGun":
      return "flak";
    case "fighter":
      return "planeGuns";
    case "bomber":
      return "bombs";
    case "diveBomber":
      return "diveBomb";
    case "torpedoBomber":
      return "aerialTorpedo";
    case "battleship":
      return primary ? "navalGuns" : "aaGuns";
    case "destroyer":
      if (!primary) return "aaGuns";
      return target === "submarine" ? "depthCharges" : "deckGun";
    case "submarine":
      return "torpedo";
    case "torpedoBoat":
      return primary ? "torpedo" : "mg";
    // Unarmed units never fire; MG is a safe look if data ever changes.
    case "recon":
    case "halftrack":
    case "transportAircraft":
    case "landingCraft":
    case "supplyShip":
    case "radarStation":
      return "mg";
    // Its only weapon: return-fire AA (03-combat §5d).
    case "carrier":
      return "aaGuns";
  }
}

/** Fire that arcs up out of the shooter's half and falls into the target's. */
export function isIndirect(fire: FireKind): boolean {
  return fire === "mortar" || fire === "howitzer" || fire === "rockets" || fire === "bombs" || fire === "diveBomb" || fire === "aerialTorpedo" || fire === "depthCharges";
}

const isAir = (kind: FigureKind) => !isFort(kind) && UNITS[kind].category === "air";

/**
 * Which half a side stands on: the side whose army faces right stands on the left, so the two face
 * each other as on the map (08-art-pipeline §12). If both face the same way, the attacker is on the left.
 */
function halves(state: GameState, attackerOwner: PlayerId, defenderOwner: PlayerId | null): { attacker: HalfId; defender: HalfId } {
  const facing = (owner: PlayerId | null) => (owner === null ? null : (state.players[owner]?.facing ?? null));
  const a = facing(attackerOwner);
  const d = facing(defenderOwner);
  const attackerOnRight = a === "left" && d !== "left";
  return attackerOnRight ? { attacker: "right", defender: "left" } : { attacker: "left", defender: "right" };
}

function half(state: GameState, id: HalfId, kind: FigureKind, owner: PlayerId | null, pos: Point, hp: number, unitId: number | null): BattleHalf {
  const unit = unitId === null ? undefined : state.units.find((u) => u.id === unitId);
  return {
    half: id,
    kind,
    owner,
    nation: owner === null ? null : drawnAs(state.players[owner]?.nation ?? null),
    terrain: terrainAt(state.map, pos),
    hp,
    submerged: unit?.submerged === true,
    paratrooper: kind === "infantry" && unit?.airDropped === true,
    suit: unitId === null ? 0 : unitId % 4,
  };
}

/**
 * The plan for a unit-on-unit combat. `state` is the state before the combat, which still holds
 * both units at their old HP.
 */
export function planCombat(state: GameState, event: Extract<GameEvent, { type: "combat" }>): BattlePlan {
  const { attacker, defender, attack, counter } = event;
  const side = halves(state, attacker.owner, defender.owner);
  const before = (id: number, fallback: number) => state.units.find((u) => u.id === id)?.hp ?? fallback;
  const attackerHp = displayHp(before(attacker.unitId, attacker.hp));
  // A garrison's bar shows its bunker, which took the hit (03-combat §4).
  const bunker = event.bunker;
  const defenderHp = displayHp(bunker ? bunker.hp + attack.damage : before(defender.unitId, defender.hp + attack.damage));

  const a = half(state, side.attacker, attacker.type, attacker.owner, attacker.pos, attackerHp, attacker.unitId);
  const d = half(state, side.defender, defender.type, defender.owner, defender.pos, defenderHp, defender.unitId);

  const strikes: BattleStrike[] = [
    {
      from: side.attacker,
      fire: fireKind(attacker.type, attack.weapon, defender.type),
      hpBefore: defenderHp,
      hpAfter: displayHp(bunker ? bunker.hp : defender.hp),
      atAir: isAir(defender.type),
    },
  ];
  if (counter) {
    strikes.push({
      from: side.defender,
      fire: fireKind(defender.type, counter.weapon, attacker.type),
      hpBefore: attackerHp,
      hpAfter: displayHp(attacker.hp),
      atAir: isAir(attacker.type),
    });
  }
  return side.attacker === "left" ? { left: a, right: d, strikes } : { left: d, right: a, strikes };
}

/**
 * The plan for an attack on a fortification (02-terrain §4, §4b): a Bunker, a Minefield or an
 * Obstacle, each shown as itself. A fortification never fires back.
 */
export function planFortAttack(state: GameState, event: Extract<GameEvent, { type: "fortAttacked" }>): BattlePlan | null {
  const attacker = state.units.find((u) => u.id === event.attackerId);
  if (!attacker) return null;
  const side = halves(state, attacker.owner, null);
  const fortBefore = displayHp(event.hp + event.attack.damage);
  const a = half(state, side.attacker, attacker.type, attacker.owner, event.attackerPos, displayHp(attacker.hp), attacker.id);
  const fort = fortFigure(terrainAt(state.map, event.pos));
  const d = half(state, side.defender, fort, null, event.pos, fortBefore, null);
  const strikes: BattleStrike[] = [
    {
      from: side.attacker,
      fire: fireKind(attacker.type, event.attack.weapon, fort),
      hpBefore: fortBefore,
      hpAfter: displayHp(event.hp),
      atAir: false,
    },
  ];
  return side.attacker === "left" ? { left: a, right: d, strikes } : { left: d, right: a, strikes };
}
