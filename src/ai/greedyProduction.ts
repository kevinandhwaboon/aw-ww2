// What the Greedy AI builds (09-ai §4, §4a, §4b).

import {
  baseDamage,
  buildOptions,
  fogInGame,
  buildProblem,
  distance,
  inBounds,
  propertyAt,
  propertyDefAt,
  stats,
  unitAt,
  type Command,
  type Point,
  type Unit,
  type UnitCategory,
  type UnitTypeId,
} from "../engine";
import {
  type Opponent,
  defOf,
  isLandingCraft,
} from "./greedyBase";
import { LandingBrain } from "./greedyLandings";

/** An armed land unit that can't move and fire in the same turn: Mortar Team, Artillery, Rocket Artillery, Flak Gun. */
const isIndirect = (type: UnitTypeId) => defOf(type).category === "land" && defOf(type).range !== null && !defOf(type).canMoveAndFire;

export abstract class ProductionBrain extends LandingBrain {
  /** Distances home to repair and resupply, or null when the unit needn't go (in ai/greedy.ts). */
  protected abstract headingHome(unit: Unit, home?: readonly Point[]): Float64Array | null;

  /**
   * One build, or null when there's nothing worth building (09-ai §4, §4a): first enough
   * capture-capable units, then whatever best counters the enemy units that matter to this site,
   * scored from the damage chart. Funds are shared out over the free production sites, so one site
   * doesn't take everything; a site an enemy could reach soon may spend it all, and always builds.
   */
  build(): Command | null {
    // Transports first: a Landing Craft or Transport Aircraft for stranded units (09-ai §4b). While
    // one is wanted but too dear, its cost is kept back from the other sites until it can be bought.
    let reserve = 0;
    for (const property of this.state.properties) {
      const transport = this.transportWanted(property.pos);
      if (!transport) continue;
      if (buildProblem(this.state, transport.type, property.pos) === null) return { type: "build", unitType: transport.type, pos: property.pos };
      reserve = Math.max(reserve, transport.cost);
    }

    // A Supply Ship for the fleet (09-ai §4f), at the first port that can build one.
    for (const property of this.state.properties) {
      if (this.supplyShipWanted(property.pos)) return { type: "build", unitType: "supplyShip", pos: property.pos };
    }

    // A scout in fog of war (09-ai §4g), at the first factory that can build one.
    const scout = this.scoutWanted();
    if (scout) return scout;

    // Everything else is chosen among armed units; transports, Supply Ships and scouts only by the rules above.
    const sites = this.state.properties
      .map((p) => ({ pos: p.pos, options: buildOptions(this.state, p.pos).filter((o) => defOf(o.type).range !== null && buildProblem(this.state, o.type, p.pos) === null) }))
      .filter((s) => s.options.length > 0);
    const funds = Math.max(0, (this.state.players[this.me]?.funds ?? 0) - reserve);
    const share = funds / Math.max(1, sites.length);
    for (const { pos, options } of sites) {
      if (this.w.keepSitesForService && this.neededForService(pos)) continue;
      const threatened = this.enemies.some((e) => this.nearThreat(e, pos));
      // Never into the funds kept back for a transport (09-ai §4h): before, every site could still buy one unit.
      const budget = threatened ? funds : Math.min(funds, Math.max(share, options[0]?.cost ?? 0));
      const opponents = this.opponentsFor(pos);
      const capturers = propertyDefAt(this.state, pos)?.builds === "land" ? this.capturersNeeded() : "enough";
      const capturersOnly = capturers === "belowMinimum" && options.some((o) => o.cost <= budget && defOf(o.type).canCapture);
      const mix = this.armyMix(propertyDefAt(this.state, pos)?.builds ?? "land");
      // Enough artillery: no more indirect fire while it's already its full share of the land army.
      const directOnly = mix.indirectShare >= this.w.maxIndirectShare && options.some((o) => o.cost <= budget && !isIndirect(o.type));
      let best: { type: UnitTypeId; score: number } | null = null;
      for (const option of options) {
        const canCapture = defOf(option.type).canCapture;
        if (option.cost > budget || (capturersOnly && !canCapture) || (directOnly && isIndirect(option.type))) continue;
        const bonus = canCapture && capturers !== "enough" ? this.w.capturerBonus : 0;
        const raw = this.buildScore(option.type, option.cost, budget, pos, opponents, bonus);
        // A mixed army: the more of this type we already have, the less another one is worth.
        const keep = Math.max(0.1, 1 - this.w.mixWeight * (mix.shares.get(option.type) ?? 0));
        const score = raw > 0 ? raw * keep : raw / keep;
        if ((score > 0 || threatened || capturersOnly) && (!best || score > best.score)) best = { type: option.type, score };
      }
      if (best) return { type: "build", unitType: best.type, pos };
    }
    return null;
  }

  /**
   * What our army of this kind (land, air or naval) is made of, passengers included: each type's
   * share of the units, and the share that is indirect fire (09-ai §4d).
   */
  protected armyMix(category: UnitCategory): { shares: ReadonlyMap<UnitTypeId, number>; indirectShare: number; count: number } {
    const mine = this.state.units.flatMap((u) => (u.owner === this.me ? [u, ...u.cargo] : [])).filter((u) => defOf(u.type).category === category);
    const shares = new Map<UnitTypeId, number>();
    for (const u of mine) shares.set(u.type, (shares.get(u.type) ?? 0) + 1 / mine.length);
    const indirect = mine.filter((u) => isIndirect(u.type)).length;
    return { shares, indirectShare: mine.length > 0 ? indirect / mine.length : 0, count: mine.length };
  }

  /**
   * Whether one of our aircraft or ships is coming in to this airfield or port for fuel, ammo or
   * repairs and could get there within two turns: then it's kept free rather than built on, or the
   * new unit would be standing there when it arrives (09-ai §4c).
   */
  protected neededForService(site: Point): boolean {
    const repairs = propertyDefAt(this.state, site)?.repairs;
    if (repairs !== "air" && repairs !== "naval") return false;
    return this.state.units.some(
      (u) =>
        u.owner === this.me &&
        defOf(u.type).category === repairs &&
        distance(u.pos, site) <= 2 * stats.movePoints(this.state, u) &&
        this.headingHome(u) !== null,
    );
  }

  /**
   * The transport this free production site should build for our stranded units, if any: a Landing
   * Craft at a port while there are more than two of them per craft we own, or a Transport Aircraft
   * at an airfield when stranded foot soldiers can walk to it and we have none.
   */
  protected transportWanted(site: Point): { type: UnitTypeId; cost: number } | null {
    const type = propertyDefAt(this.state, site)?.builds === "naval" ? "landingCraft" : propertyDefAt(this.state, site)?.builds === "air" ? "transportAircraft" : null;
    // A site one of our own units stands on for the moment (a ship in for fuel) still counts, so the
    // funds are kept back for it rather than spent elsewhere meanwhile (09-ai §4h).
    const occupant = unitAt(this.state, site);
    if (!type || propertyAt(this.state, site)?.owner !== this.me || (occupant && occupant.owner !== this.me)) return null;
    if (!(this.state.players[this.me]?.buildable ?? []).includes(type)) return null;
    const option = { cost: stats.unitCost(this.state, this.me, type) };
    const carries = defOf(type).transport?.carries ?? [];
    const waiting = this.waiting().filter((u) => carries.includes(u.type));
    // A spent craft, too low on fuel to get home, can't fetch anyone: it doesn't count (09-ai §4h).
    const owned = this.state.units.filter((u) => u.owner === this.me && u.type === type && !this.spent(u)).length;
    const wanted =
      type === "landingCraft"
        ? owned < this.w.maxLandingCraft && owned * this.w.strandedPerCraft < waiting.length && this.pickup(this.phantom(type, site)) !== null
        : owned < this.w.maxAirTransports &&
          waiting.some((u) => defOf(u.type).canCapture && this.connected(u.type, u.pos, site) && this.canFly(this.phantom(type, site), site, u));
    return wanted ? { type, cost: option.cost } : null;
  }

  /**
   * Whether this free port should build a Supply Ship now (09-ai §4f): one for every few warships we
   * have, up to a few, when we can afford it here.
   */
  /**
   * In a game with fog of war, or rain coming, a scout when we have fewer than `scoutsInFog` (09-ai §4g): the cheapest unit
   * that can scout, at the first site that can build it. Not while we're short of the minimum of
   * capture-capable units, which come first.
   */
  protected scoutWanted(): Command | null {
    if (!fogInGame(this.state) || this.w.scoutsInFog <= 0) return null;
    const have = this.state.units.flatMap((u) => (u.owner === this.me ? [u, ...u.cargo] : [])).filter((u) => this.isScoutType(u.type)).length;
    if (have >= this.w.scoutsInFog || this.capturersNeeded() === "belowMinimum") return null;
    for (const property of this.state.properties) {
      const options = buildOptions(this.state, property.pos)
        .filter((o) => this.isScoutType(o.type) && buildProblem(this.state, o.type, property.pos) === null)
        .sort((a, b) => a.cost - b.cost);
      const cheapest = options[0];
      if (cheapest) return { type: "build", unitType: cheapest.type, pos: property.pos };
    }
    return null;
  }

  protected supplyShipWanted(site: Point): boolean {
    if (propertyDefAt(this.state, site)?.builds !== "naval" || buildProblem(this.state, "supplyShip", site) !== null) return false;
    if (this.w.keepSitesForService && this.neededForService(site)) return false;
    const mine = this.state.units.filter((u) => u.owner === this.me);
    const warships = mine.filter((u) => defOf(u.type).category === "naval" && defOf(u.type).range !== null).length;
    const supplyShips = mine.filter((u) => u.type === "supplyShip").length;
    return supplyShips < Math.min(this.w.maxSupplyShips, Math.floor(warships / this.w.warshipsPerSupplyShip));
  }

  /** Whether we have, or could build, Landing Craft to carry land units from this site's landmass overseas. */
  protected canShipFrom(type: UnitTypeId, site: Point): boolean {
    if (defOf(type).category !== "land" || defOf(type).transport) return false;
    const mine = this.state.players[this.me];
    const sealift =
      this.state.units.some((u) => u.owner === this.me && isLandingCraft(u.type)) ||
      ((mine?.buildable.includes("landingCraft") ?? false) && this.state.properties.some((p) => p.owner === this.me && propertyDefAt(this.state, p.pos)?.builds === "naval"));
    return sealift && this.loadableTiles().some((tile) => this.connected(type, site, tile));
  }

  /**
   * Whether we have enough capture-capable units: below the minimum, a land site builds only them;
   * between the minimum and the wanted count (one per three properties still to take, up to 8),
   * they get a bonus (09-ai §4, §4a).
   */
  protected capturersNeeded(): "belowMinimum" | "belowWanted" | "enough" {
    const mine = this.state.units.flatMap((u) => (u.owner === this.me ? [u, ...u.cargo] : []));
    const capturers = mine.filter((u) => defOf(u.type).canCapture).length;
    const toTake = this.state.properties.filter((p) => p.owner === null || this.isEnemy(p.owner)).length;
    const wanted = Math.min(this.w.maxCapturers, Math.max(this.w.minCapturers, Math.ceil(toTake / this.w.propertiesPerCapturer)));
    // The minimum grows with the army, so a big one can still take and hold ground (09-ai §4d).
    const land = mine.filter((u) => defOf(u.type).category === "land").length;
    const minimum = Math.max(this.w.minCapturers, Math.ceil(this.w.capturerShare * land));
    return capturers < minimum ? "belowMinimum" : capturers < wanted ? "belowWanted" : "enough";
  }

  /**
   * The enemy units a build at this site is weighed against (09-ai §4a): each counts by its HP, 3×
   * when it could reach the site soon, and less the more our units near it can already hurt it
   * (unless our units already cover every enemy). Before the enemy fields anything, it's what they
   * could build, with no position.
   */
  protected opponentsFor(site: Point): Opponent[] {
    const fielded = this.enemies.flatMap((e) =>
      [e, ...e.cargo].map((u) => {
        const weight = (u.hp / 100) * (this.nearThreat(e, site) ? this.w.nearThreatWeight : 1);
        return { type: u.type, cost: this.cost(u), weight, uncovered: weight * (1 - this.coverage(u, e.pos)), pos: e.pos };
      }),
    );
    // When our units already cover every enemy, coverage is ignored, so building doesn't stop.
    const allCovered = fielded.every((o) => o.uncovered <= 0);
    if (fielded.length > 0) return fielded.map((o) => ({ ...o, weight: allCovered ? o.weight : o.uncovered }));
    return this.state.players
      .filter((p) => this.isEnemy(p.id))
      .flatMap((p) => p.buildable.map((t) => ({ type: t, weight: 1, cost: stats.unitCost(this.state, p.id, t), pos: null })));
  }

  /**
   * How well a unit type built at this site does against the opponents it could reach from there:
   * for each, the value of the damage it would deal minus the value of the damage it would take,
   * averaged by weight. Then divided by the square root of the larger of its cost and the site's
   * budget: every unit the budget pays for is compared on value alone, since a site builds one unit a
   * turn whatever it costs, so cheap units only win when money is the limit (09-ai §4a).
   */
  protected buildScore(type: UnitTypeId, cost: number, budget: number, site: Point, opponents: readonly Opponent[], bonus: number): number {
    let total = 0;
    let weights = 0;
    for (const enemy of opponents) {
      // An enemy it could only get at by sea counts for less; one it can't get at, for nothing.
      const reach = enemy.pos === null || this.canReachFrom(type, site, enemy.pos) ? 1 : this.canShipFrom(type, site) ? this.w.overseasWeight : 0;
      const dealt = reach * (baseDamage(type, enemy.type)?.base ?? 0);
      const taken = baseDamage(enemy.type, type)?.base ?? 0;
      total += enemy.weight * ((dealt / 100) * enemy.cost - this.w.buildRisk * (taken / 100) * cost);
      weights += enemy.weight;
    }
    return weights > 0 ? (total / weights + bonus) / Math.sqrt(Math.max(cost, budget)) : 0;
  }

  /**
   * Whether this enemy could reach the site within a few turns: straight-line distance, not the
   * path, against its movement plus its attack range (09-ai §4a).
   */
  protected nearThreat(enemy: Unit, site: Point): boolean {
    const reach = this.w.threatTurns * stats.movePoints(this.state, enemy) + (stats.attackRange(this.state, enemy)?.max ?? 0);
    return distance(enemy.pos, site) <= reach;
  }

  /**
   * How much of this enemy our units can already deal with, 0 to 1: each of our units that could
   * reach it within a few turns covers its base damage against it, scaled by its HP (09-ai §4a).
   */
  protected coverage(enemy: Unit, at: Point): number {
    let covered = 0;
    for (const mine of this.state.units) {
      if (mine.owner !== this.me) continue;
      const base = baseDamage(mine.type, enemy.type)?.base;
      if (base === undefined || (enemy.submerged === true && !defOf(mine.type).attacksSubmerged)) continue;
      const reach = this.w.threatTurns * stats.movePoints(this.state, mine) + (stats.attackRange(this.state, mine)?.max ?? 0);
      if (distance(mine.pos, at) <= reach) covered += (base / 100) * (mine.hp / 100);
      if (covered >= 1) return 1;
    }
    return covered;
  }

  /**
   * Whether a unit of this type built at the site could ever attack a unit at `target`: its movement
   * type can travel from the site to a tile with the target in its attack range. Aircraft reach
   * everywhere (09-ai §4a).
   */
  protected canReachFrom(type: UnitTypeId, site: Point, target: Point): boolean {
    const def = defOf(type);
    if (def.category === "air") return true;
    const range = stats.attackRange(this.state, this.phantom(type, site));
    if (!range) return false;
    for (let dy = -range.max; dy <= range.max; dy++) {
      const spread = range.max - Math.abs(dy);
      for (let dx = -spread; dx <= spread; dx++) {
        const p = { x: target.x + dx, y: target.y + dy };
        if (!inBounds(this.state.map, p) || distance(p, target) < range.min) continue;
        if (this.connected(type, site, p)) return true;
      }
    }
    return false;
  }

}
