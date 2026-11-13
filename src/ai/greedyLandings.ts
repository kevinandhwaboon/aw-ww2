// Landings, drops and carriers for the Greedy AI (09-ai §4b).

import {
  baseDamage,
  displayHp,
  distance,
  forecast,
  fortForecast,
  inBounds,
  movementBudget,
  threatTiles,
  propertyAt,
  propertyDefAt,
  stats,
  supplyTargets,
  terrainAt,
  unitAt,
  type GameState,
  type Point,
  type Unit,
  type UnitTypeId,
} from "../engine";
import {
  HOLD,
  IDLE,
  type MoveCommand,
  NO_TILES,
  type Plan,
  defOf,
  isAirTransport,
  isCarrier,
  isLandingCraft,
  samePoint,
  BrainBase,
} from "./greedyBase";
import type { GreedyWeights } from "./weights";

export abstract class LandingBrain extends BrainBase {
  /** Head for the nearest of these goals (in ai/greedy.ts). */
  protected abstract advance(unit: Unit, goals: readonly Point[], key: string, offsets?: readonly number[]): Plan;

  /**
   * A Landing Craft or Transport Aircraft. Empty, it goes to where stranded units can board and
   * waits. With passengers, it waits for any more that are close, then carries them to where they
   * can get at their goal.
   */
  protected planFerry(unit: Unit): Plan {
    const capacity = defOf(unit.type).transport?.capacity ?? 0;
    const first = unit.cargo[0];
    if (!first) {
      const pickup = this.pickup(unit);
      if (!pickup) return IDLE;
      return samePoint(pickup, unit.pos) ? HOLD : this.advance(unit, [pickup], `pickup${unit.id}`);
    }
    if (unit.cargo.length < capacity && this.canBoardAt(unit.type, unit.pos) && this.moreComing(unit)) return HOLD;

    const goals = this.goalsFor(first);
    if (goals.length === 0) return IDLE;
    if (isAirTransport(unit.type)) {
      // Fly to a tile beside the goal, to drop the passenger right on it.
      const beside = new Map<number, Point>();
      for (const goal of goals) for (const n of this.neighbors(goal)) beside.set(this.index(n), n);
      return this.advance(unit, [...beside.values()], `drop${unit.id}`);
    }
    // Every beach or port the passenger could walk on from: nearer by sea and nearer its goal is better.
    const land = this.distances(first, goals, `goals${first.id}`);
    const perStep = stats.movePoints(this.state, unit) / Math.max(1, stats.movePoints(this.state, first));
    const landings: Point[] = [];
    const offsets: number[] = [];
    for (const tile of this.loadableTiles()) {
      const occupant = unitAt(this.state, tile);
      if (occupant && occupant.id !== unit.id) continue;
      const walk = Math.min(...this.neighbors(tile).map((n) => land[this.index(n)] ?? Infinity));
      if (!Number.isFinite(walk)) continue;
      landings.push(tile);
      offsets.push(walk * perStep);
    }
    // Massed landings: still at the boarding tile, it waits for the rest of the wave (09-ai §4c).
    const atHome = this.canBoardAt(unit.type, unit.pos) && !landings.some((l) => samePoint(l, unit.pos));
    if (atHome && this.waitsForWave(unit)) return HOLD;
    return this.advance(unit, landings, `landing${unit.id}`, offsets);
  }

  /** Whether this transport is still taking passengers on: it has room and stranded units are coming. */
  protected stillLoading(transport: Unit): boolean {
    const capacity = defOf(transport.type).transport?.capacity ?? 0;
    if (transport.cargo.length >= capacity) return false;
    if (transport.cargo.length === 0) {
      // An empty one counts only once it's about to arrive, so a far-off craft doesn't hold up the wave.
      const pickup = this.pickup(transport);
      return pickup !== null && distance(transport.pos, pickup) <= stats.movePoints(this.state, transport);
    }
    return this.canBoardAt(transport.type, transport.pos) && this.moreComing(transport);
  }

  /**
   * Whether this loaded Landing Craft should hold for others nearby that are still loading, so they
   * land together. It goes once enough craft are ready, or nobody nearby is still loading.
   */
  protected waitsForWave(craft: Unit): boolean {
    if (this.w.waveSize <= 1) return false;
    const others = this.state.units.filter(
      (u) => u.owner === this.me && u.id !== craft.id && isLandingCraft(u.type) && distance(u.pos, craft.pos) <= this.w.waveRadius,
    );
    const ready = 1 + others.filter((o) => o.cargo.length > 0 && !this.stillLoading(o)).length;
    return ready < this.w.waveSize && others.some((o) => this.stillLoading(o));
  }

  /**
   * Escorts (09-ai §4c): for each loaded Landing Craft on its way, the nearest warships not heading
   * home. Each sails for the craft's landing unless it has something to shoot nearer by.
   */
  protected escorts(): ReadonlyMap<number, Unit> {
    if (this.escortCache) return this.escortCache;
    const assigned = new Map<number, Unit>();
    if (this.w.escortsPerCraft > 0) {
      const craft = this.state.units.filter((u) => u.owner === this.me && isLandingCraft(u.type) && u.cargo.length > 0 && !this.canBoardAt(u.type, u.pos));
      const warships = this.state.units.filter((u) => u.owner === this.me && defOf(u.type).category === "naval" && defOf(u.type).range !== null);
      for (const c of craft) {
        const nearest = warships
          .filter((w) => !assigned.has(w.id) && this.connected(w.type, w.pos, c.pos))
          .sort((a, b) => distance(a.pos, c.pos) - distance(b.pos, c.pos) || a.id - b.id);
        for (const w of nearest.slice(0, this.w.escortsPerCraft)) assigned.set(w.id, c);
      }
    }
    this.escortCache = assigned;
    return assigned;
  }

  /**
   * A Carrier with aircraft aboard sails to within their flying range of something they can hit, and
   * no closer. It launches from there next turn: a Carrier moves or launches, not both.
   */
  protected planCarrier(unit: Unit): Plan {
    if (unit.cargo.length === 0) return IDLE;
    const targets = this.enemies.filter((e) => unit.cargo.some((c) => this.canHurt(c.type, e)));
    if (targets.length === 0) return IDLE;
    const strike = Math.min(...unit.cargo.map((c) => stats.movePoints(this.state, c)));
    const tiles = this.firingTiles(unit, targets, { min: Math.max(1, strike - this.w.carrierStandoff), max: strike });
    return this.advance(unit, tiles, `strike${unit.id}`);
  }

  /** Whether an enemy that can hurt this unit could attack it on this tile next turn. */
  protected inDanger(unit: Unit, at: Point): boolean {
    return this.enemies.some((e) => {
      if (baseDamage(e.type, unit.type) === null) return false;
      const range = stats.attackRange(this.state, e);
      if (!range) return false;
      const reach = (defOf(e.type).canMoveAndFire ? stats.movePoints(this.state, e) : 0) + range.max;
      return distance(e.pos, at) <= reach;
    });
  }

  /**
   * A land unit is stranded when its landmass holds nothing for it: no property to take and no
   * enemy land unit it can hurt, while somewhere else does.
   */
  protected isStranded(unit: Unit): boolean {
    const def = defOf(unit.type);
    if (def.category !== "land" || def.transport || this.garrison().has(unit.id)) return false;
    const label = this.label(unit.type, unit.pos);
    const goals = this.goalLabels(unit.type);
    return label >= 0 && goals.size > 0 && !goals.has(label);
  }

  /**
   * The home garrison (09-ai §4c): the few land units nearest our HQ on its landmass. They stay,
   * so the HQ isn't left empty when everyone else sails. None is kept when no enemy could invade.
   */
  protected garrison(): ReadonlySet<number> {
    if (this.garrisonCache) return this.garrisonCache;
    const ids = new Set<number>();
    const hq = this.state.properties.find((p) => p.owner === this.me && terrainAt(this.state.map, p.pos) === "hq");
    if (hq && this.w.garrisonSize > 0 && this.enemyCanInvade()) {
      const local = this.state.units
        .filter((u) => u.owner === this.me && defOf(u.type).category === "land" && !defOf(u.type).transport && this.connected(u.type, u.pos, hq.pos))
        .sort((a, b) => distance(a.pos, hq.pos) - distance(b.pos, hq.pos) || a.id - b.id);
      for (const u of local.slice(0, this.w.garrisonSize)) ids.add(u.id);
    }
    this.garrisonCache = ids;
    return ids;
  }

  /** Whether any enemy has, or could build, a Landing Craft or Transport Aircraft. */
  protected enemyCanInvade(): boolean {
    const carries = (type: UnitTypeId) => isLandingCraft(type) || isAirTransport(type);
    return (
      this.enemies.some((e) => carries(e.type)) ||
      this.state.players.some((p) => this.isEnemy(p.id) && p.buildable.some((t) => carries(t) && this.state.properties.some((q) => q.owner === p.id && propertyDefAt(this.state, q.pos)?.builds === defOf(t).category)))
    );
  }

  /** The landmasses, for this unit type's movement, that hold something for it to take or fight. */
  protected goalLabels(type: UnitTypeId): ReadonlySet<number> {
    const cached = this.goalLabelCache.get(type);
    if (cached) return cached;
    const labels = this.components(type);
    const found = new Set<number>();
    const add = (p: Point) => {
      const label = labels[this.index(p)] ?? -1;
      if (label >= 0) found.add(label);
    };
    for (const property of this.state.properties) {
      const wanted = property.owner === null ? defOf(type).canCapture : this.isEnemy(property.owner);
      if (wanted) add(property.pos);
    }
    for (const enemy of this.enemies) {
      if (defOf(enemy.type).category !== "land" || baseDamage(type, enemy.type) === null) continue;
      add(enemy.pos);
      for (const n of this.neighbors(enemy.pos)) add(n);
    }
    this.goalLabelCache.set(type, found);
    return found;
  }

  /** Our stranded units that are fit to travel: the ones transports come for. */
  protected waiting(): readonly Unit[] {
    this.waitingCache ??= this.state.units.filter((u) => u.owner === this.me && displayHp(u.hp) > this.w.retreatHp && this.isStranded(u));
    return this.waitingCache;
  }

  /** Whether units can board this kind of transport while it stands on this tile (05-supply-transport §6, §8). */
  protected canBoardAt(transport: UnitTypeId, at: Point): boolean {
    const terrain = terrainAt(this.state.map, at);
    const owner = propertyAt(this.state, at)?.owner ?? null;
    if (isAirTransport(transport)) return terrain === "airfield" && owner === this.me;
    return terrain === "beach" || (terrain === "port" && (owner === null || owner === this.me));
  }

  /** Every Beach, and every Port that isn't the enemy's: where a Landing Craft loads and unloads. */
  protected loadableTiles(): readonly Point[] {
    if (this.loadableCache) return this.loadableCache;
    const tiles: Point[] = [];
    const { width, height } = this.state.map;
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) if (this.canBoardAt("landingCraft", { x, y })) tiles.push({ x, y });
    }
    this.loadableCache = tiles;
    return tiles;
  }

  /**
   * Where this transport should collect stranded units, or null if none are waiting for it: the free
   * boarding tile that costs it and the nearest of them the fewest turns to reach, taken together.
   */
  protected pickup(transport: Unit): Point | null {
    const key = `${transport.id}|${this.index(transport.pos)}`;
    const cached = this.pickupCache.get(key);
    if (cached !== undefined) return cached;
    const carries = defOf(transport.type).transport?.carries ?? [];
    const waiting = this.waiting().filter((u) => carries.includes(u.type));
    let best: { tile: Point; cost: number } | null = null;
    if (waiting.length > 0) {
      const fromTransport = this.distances(transport, [transport.pos], `from${key}`);
      const tiles = isAirTransport(transport.type) ? this.state.properties.filter((p) => this.canBoardAt(transport.type, p.pos)).map((p) => p.pos) : this.loadableTiles();
      for (const tile of tiles) {
        const occupant = unitAt(this.state, tile);
        const travel = fromTransport[this.index(tile)] ?? Infinity;
        if ((occupant && occupant.id !== transport.id) || !Number.isFinite(travel)) continue;
        let walk = Infinity;
        for (const u of waiting) {
          if (!this.connected(u.type, u.pos, tile) || (isAirTransport(transport.type) && !this.canFly(transport, tile, u))) continue;
          walk = Math.min(walk, distance(u.pos, tile) / stats.movePoints(this.state, u));
        }
        // A craft waiting in a port keeps our ships from refuelling there: a beach is preferred.
        const inPort = isLandingCraft(transport.type) && terrainAt(this.state.map, tile) === "port" ? 1 : 0;
        const cost = travel / stats.movePoints(this.state, transport) + walk + inPort;
        if (Number.isFinite(cost) && (!best || cost < best.cost)) best = { tile, cost };
      }
    }
    this.pickupCache.set(key, best?.tile ?? null);
    return best?.tile ?? null;
  }

  /**
   * Whether a Transport Aircraft could fly this unit from this tile to its goal and back: on a full
   * tank from one of our airfields, or else on the fuel it has. It never loads for a drop out of range.
   */
  protected canFly(transport: Unit, from: Point, passenger: Unit): boolean {
    const goals = this.goalsFor(passenger);
    if (goals.length === 0) return false;
    // There and back: an aircraft that couldn't return would be lost with every drop.
    const trip = 2 * Math.min(...goals.map((g) => distance(from, g)));
    const fuel = this.canBoardAt(transport.type, from) ? stats.maxFuel(this.state, transport) : transport.fuel;
    const days = Math.ceil(trip / Math.max(1, stats.movePoints(this.state, transport)));
    return fuel >= stats.moveFuel(this.state, transport, trip) + days * stats.fuelPerDay(this.state, transport);
  }

  /** Whether a stranded unit that fits is close enough to this transport that it's worth waiting for. */
  protected moreComing(transport: Unit): boolean {
    const carries = defOf(transport.type).transport?.carries ?? [];
    return this.waiting().some(
      (u) =>
        carries.includes(u.type) &&
        this.connected(u.type, u.pos, transport.pos) &&
        distance(u.pos, transport.pos) <= this.w.boardWaitTurns * stats.movePoints(this.state, u),
    );
  }

  /**
   * Where a stranded unit can board: each of our Landing Craft and Transport Aircraft with room that
   * stands where it can load, or else the pickup tile an empty one is heading for.
   */
  protected rideTiles(unit: Unit): Point[] {
    const tiles = new Map<number, Point>();
    for (const t of this.state.units) {
      const rules = defOf(t.type).transport;
      if (t.owner !== this.me || !rules || !(isLandingCraft(t.type) || isAirTransport(t.type))) continue;
      if (!rules.carries.includes(unit.type) || t.cargo.length >= rules.capacity) continue;
      const tile = this.canBoardAt(t.type, t.pos) ? t.pos : t.cargo.length === 0 ? this.pickup(t) : null;
      if (!tile || !this.connected(unit.type, unit.pos, tile)) continue;
      if (isAirTransport(t.type) && !this.canFly(t, tile, unit)) continue;
      tiles.set(this.index(tile), tile);
    }
    return [...tiles.values()];
  }

  /** What a passenger is after once it's ashore: properties to take, or else enemies and their properties. */
  protected goalsFor(passenger: Unit): Point[] {
    if (defOf(passenger.type).canCapture) {
      const properties = this.capturable(passenger);
      if (properties.length > 0) return properties;
    }
    const targets = this.enemies.filter((e) => defOf(e.type).category === "land" && this.canHurt(passenger.type, e)).map((e) => e.pos);
    return [...targets, ...this.enemyProperties()];
  }

  /**
   * Value of unloading this passenger onto this tile: more the nearer its goal, and nothing where it
   * couldn't reach one. A Transport Aircraft drops only within a turn's walk of the goal.
   */
  protected unloadScore(transport: Unit, passenger: Unit, to: Point): number {
    const goals = this.goalsFor(passenger);
    if (goals.length === 0) return this.w.unloadValue / 2;
    const steps = this.distances(passenger, goals, `goals${passenger.id}`)[this.index(to)] ?? Infinity;
    if (!Number.isFinite(steps)) return -Infinity;
    if (isAirTransport(transport.type) && steps > this.w.dropWithinTurns * stats.movePoints(this.state, passenger)) return -Infinity;
    return this.w.unloadValue - this.w.unloadPerStep * steps;
  }

  protected neighbors(p: Point): Point[] {
    return [{ x: p.x, y: p.y - 1 }, { x: p.x + 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x - 1, y: p.y }].filter((q) => inBounds(this.state.map, q));
  }

  protected score(unit: Unit, plan: Plan, command: MoveCommand): number {
    const dest = command.path[command.path.length - 1] ?? unit.pos;
    // Standing on our own production site blocks building there (09-ai §4a). Boarding a transport
    // leaves the tile, and a unit retreating there for repairs is allowed to stay.
    const staying = command.action.type !== "load";
    const holding = plan.kind === "idle" && plan.hold;
    // A transport going in to its pickup tile is allowed onto a port or airfield of ours.
    const collecting = plan.kind === "advance" && unit.cargo.length === 0 && (isLandingCraft(unit.type) || isAirTransport(unit.type)) && plan.goals.some((g) => samePoint(g, dest));
    const blocks = staying && plan.kind !== "retreat" && !holding && !collecting && this.isOwnProductionSite(dest);
    // A unit waiting for a Landing Craft keeps off the tile the craft is coming to.
    const inTheWay = staying && plan.kind === "advance" && plan.embark && plan.goals.some((g) => samePoint(g, dest));
    const exposed = isCarrier(unit.type) && this.inDanger(unit, dest);
    const delivering = unit.cargo.length > 0 && (isLandingCraft(unit.type) || isAirTransport(unit.type));
    const danger = this.w.dangerWeight > 0 && staying && !delivering && !this.pressing() ? this.w.dangerWeight * this.danger(unit, dest) : 0;
    return (
      this.actionScore(unit, plan, command, dest) -
      (blocks || inTheWay ? this.w.blockSitePenalty : 0) -
      (exposed ? this.w.carrierDangerPenalty : 0) -
      danger -
      (staying && this.pastReturn(unit, plan, command, dest) ? Math.max(this.w.noReturnPenalty, this.w.noReturnOwnValue * this.worth(unit)) : 0)
    );
  }

  /**
   * Whether this move would leave an aircraft or ship without the fuel to get home: what's left after
   * the move is less than the distance home from there plus the daily burn on the way (09-ai §4b).
   * A transport carrying passengers to their landing is judged before it sets out instead, and a unit
   * that couldn't get home anyway is free to move.
   */
  protected pastReturn(unit: Unit, plan: Plan, command: MoveCommand, dest: Point): boolean {
    const burn = stats.fuelPerDay(this.state, unit);
    if (burn <= 0 || command.path.length === 0) return false;
    if (unit.cargo.length > 0 && plan.kind === "advance" && (isLandingCraft(unit.type) || isAirTransport(unit.type))) return false;
    const home = this.repairTiles(unit);
    if (home.length === 0) return false;
    const homeward = this.distances(unit, home, "repair");
    const mp = Math.max(1, stats.movePoints(this.state, unit));
    const needFrom = (tile: Point) => {
      const back = homeward[this.index(tile)] ?? Infinity;
      return stats.moveFuel(this.state, unit, back) + Math.ceil(back / mp) * burn;
    };
    // A unit that can't get home even from where it stands has nothing to lose by moving, and a
    // move that brings it nearer home is never the problem.
    if (!Number.isFinite(needFrom(dest)) || unit.fuel <= needFrom(unit.pos)) return false;
    if ((homeward[this.index(dest)] ?? Infinity) < (homeward[this.index(unit.pos)] ?? Infinity)) return false;
    let spent = 0;
    for (const step of command.path) spent += stats.moveCost(this.state, unit, terrainAt(this.state.map, step)) ?? 0;
    // Keep some days' burn in hand: the way home may be blocked, or the port taken when it arrives.
    return unit.fuel - stats.moveFuel(this.state, unit, spent) <= needFrom(dest) + this.w.fuelReserveDays * burn;
  }

  protected actionScore(unit: Unit, plan: Plan, command: MoveCommand, dest: Point): number {
    const moved: Unit = { ...unit, pos: dest, hasActed: true };
    const afterMove: GameState = { ...this.state, units: this.state.units.map((u) => (u.id === unit.id ? moved : u)) };
    const position = this.positionScore(unit, moved, plan);
    const { action } = command;
    switch (action.type) {
      case "wait":
        return position;
      case "attack": {
        const target = afterMove.units.find((u) => u.id === action.target);
        return target ? position + this.attackScore(afterMove, moved, target) : -Infinity;
      }
      case "attackFort":
        return position + this.fortScore(afterMove, unit, moved, plan, action.target);
      case "capture":
        return position + this.captureScore(moved);
      case "load": {
        const host = unitAt(this.state, dest);
        if (!host) return -Infinity;
        // An aircraft lands on a Carrier to refuel, rearm and repair, or when it has nothing to do.
        if (isCarrier(host.type)) return plan.kind === "retreat" ? position : plan.kind === "idle" ? 2 * this.w.stayBonus : -Infinity;
        // Only stranded units board a Landing Craft or Transport Aircraft, and only a Halftrack otherwise.
        const embarking = plan.kind === "advance" && plan.embark;
        if (isLandingCraft(host.type) || isAirTransport(host.type)) return embarking ? position + this.w.boardValue : -Infinity;
        const far = plan.kind === "advance" && (plan.dist[this.index(unit.pos)] ?? 0) > this.w.boardTurns * stats.movePoints(this.state, unit);
        return !host.hasActed && far && !embarking ? this.w.boardValue : -Infinity;
      }
      case "unload": {
        const passenger = unit.cargo.find((c) => c.id === action.passenger);
        return passenger ? position + this.unloadScore(unit, passenger, action.to) : -Infinity;
      }
      case "supply":
        return position + this.w.supplyPerUnit * supplyTargets(afterMove, moved).length;
      case "join":
        return this.w.join;
      case "dive":
        return -Infinity;
      case "surface":
        return position + this.w.reachRepairBonus;
    }
  }

  /** How good the destination is: closer to the goal, and on terrain with more defense stars. */
  protected positionScore(unit: Unit, moved: Unit, plan: Plan): number {
    const here = this.index(unit.pos);
    const there = this.index(moved.pos);
    switch (plan.kind) {
      case "idle":
        // A transport holding for passengers doesn't leave, whatever else it could do elsewhere.
        return here === there ? this.w.stayBonus : plan.hold ? -Infinity : 0;
      case "retreat": {
        const from = plan.dist[here] ?? Infinity;
        const to = plan.dist[there] ?? Infinity;
        return this.w.retreatPerStep * (from - to) + (to === 0 ? this.w.reachRepairBonus : 0) + this.terrainScore(moved);
      }
      case "advance": {
        const from = plan.dist[here] ?? Infinity;
        const to = plan.dist[there] ?? Infinity;
        const progress = !Number.isFinite(from) ? 0 : Number.isFinite(to) ? from - to : -10;
        return this.w.advancePerStep * progress + this.terrainScore(moved);
      }
    }
  }

  protected terrainScore(moved: Unit): number {
    return (this.w.starValue * stats.terrainStars(this.state, moved) * displayHp(moved.hp)) / 10;
  }

  /**
   * Value of the damage dealt minus the value of the expected counter, at the forecast's midpoint,
   * plus a bonus for a kill (09-ai §4). Value of damage = damage % × the unit's cost.
   */
  protected attackScore(afterMove: GameState, moved: Unit, target: Unit): number {
    const f = forecast(afterMove, moved, target);
    if (!f) return -Infinity;
    const dealt = Math.min(target.hp, (f.attack.min + f.attack.max) / 2);
    const taken = f.counter ? Math.min(moved.hp, (f.counter.min + f.counter.max) / 2) : 0;
    const targetCost = this.cost(target);
    const kill = f.certainKill ? this.w.certainKillBonus : f.canKill ? this.w.possibleKillBonus : 0;
    const capturing = this.state.properties.some((p) => p.capturingUnit === target.id && p.owner !== null && !this.isEnemy(p.owner));
    // Focus fire: a hit that doesn't kill is worth more when our other ready units could finish the job.
    const others = f.certainKill || this.w.focusKillBonus <= 0 ? 0 : this.followUp(target).reduce((sum, o) => sum + (o.id === moved.id ? 0 : o.damage), 0);
    const focus = others > 0 && dealt + others >= target.hp ? this.w.focusKillBonus : 0;
    return (
      (dealt / 100) * targetCost -
      this.w.counterLoss * (taken / 100) * this.cost(moved) +
      (kill + focus) * targetCost +
      (capturing ? this.w.stopCaptureBonus : 0)
    );
  }

  /** Whether our army is worth so much more than the enemy's that it should press on regardless of risk. */
  protected pressing(): boolean {
    if (this.pressCache === null) {
      const mine = this.state.units.reduce((sum, u) => sum + (u.owner === this.me ? this.worth(u) : 0), 0);
      const theirs = this.enemies.reduce((sum, u) => sum + this.worth(u), 0);
      this.pressCache = mine >= this.w.pressRatio * theirs;
    }
    return this.pressCache;
  }

  /** Rough damage, in HP out of 100, of this attacker type and strength against a defender on terrain with these stars. */
  protected estimate(attacker: Unit, defender: Unit, stars: number): number {
    const base = baseDamage(attacker.type, defender.type)?.base ?? 0;
    return (base * displayHp(attacker.hp) * (100 - stars * displayHp(defender.hp))) / 1000;
  }

  /** What each of our units that hasn't acted could do to this enemy this turn, roughly (09-ai §4c). */
  protected followUp(target: Unit): readonly { id: number; damage: number }[] {
    const cached = this.followUpCache.get(target.id);
    if (cached) return cached;
    const stars = stats.terrainStars(this.state, target);
    const list: { id: number; damage: number }[] = [];
    for (const u of this.state.units) {
      if (u.owner !== this.me || u.hasActed || !this.canHurt(u.type, target)) continue;
      const range = stats.attackRange(this.state, u);
      if (!range) continue;
      const gap = distance(u.pos, target.pos);
      const inReach = defOf(u.type).canMoveAndFire ? gap <= movementBudget(this.state, u) + range.max : gap >= range.min && gap <= range.max;
      if (inReach) list.push({ id: u.id, damage: this.estimate(u, target, stars) });
    }
    this.followUpCache.set(target.id, list);
    return list;
  }

  /**
   * The look ahead (09-ai §4c): what this unit stands to lose next turn if it ends its move on this
   * tile, in funds. The enemy units that could fire on the tile are found with the engine's own
   * threat ranges; the two hardest hits are counted.
   */
  protected danger(unit: Unit, dest: Point): number {
    const key = `${unit.id}|${this.index(dest)}`;
    const cached = this.dangerCache.get(key);
    if (cached !== undefined) return cached;
    const at = this.index(dest);
    const moved: Unit = { ...unit, pos: dest };
    const stars = stats.terrainStars({ ...this.state, units: this.state.units.map((u) => (u.id === unit.id ? moved : u)) }, moved);
    const hits: number[] = [];
    for (const enemy of this.enemies) {
      if (!this.canHurt(enemy.type, unit) || !this.threatened(enemy, unit).has(at)) continue;
      hits.push(this.estimate(enemy, unit, stars));
    }
    hits.sort((a, b) => b - a);
    const lost = Math.min(unit.hp, hits.slice(0, this.w.dangerAttackers).reduce((sum, h) => sum + h, 0));
    const value = (lost / 100) * this.worth({ ...unit, hp: 100 });
    this.dangerCache.set(key, value);
    return value;
  }

  /** The tiles this enemy could fire on next turn, or none if it's too far off to matter to this unit. */
  protected threatened(enemy: Unit, unit: Unit): ReadonlySet<number> {
    const range = stats.attackRange(this.state, enemy);
    if (!range) return NO_TILES;
    const far = movementBudget(this.state, unit) + stats.movePoints(this.state, enemy) + range.max;
    if (distance(enemy.pos, unit.pos) > far) return NO_TILES;
    let tiles = this.threatTileCache.get(enemy.id);
    if (!tiles) {
      tiles = new Set(threatTiles(this.state, enemy).map((p) => this.index(p)));
      this.threatTileCache.set(enemy.id, tiles);
    }
    return tiles;
  }

  /** Fortifications are only worth shooting when they block the way to the goal (09-ai §4). */
  protected fortScore(afterMove: GameState, unit: Unit, moved: Unit, plan: Plan, target: Point): number {
    const f = fortForecast(afterMove, moved, target);
    if (!f || plan.kind !== "advance") return -Infinity;
    const here = this.index(unit.pos);
    const withoutForts = this.distances(unit, plan.goals, `${plan.goals.length}:${plan.goals.map((g) => this.index(g)).join(",")}`, true);
    const blocked = (withoutForts[here] ?? Infinity) + 2 < (plan.dist[here] ?? Infinity);
    return blocked ? (this.w.blockingFortValue * Math.min(100, (f.attack.min + f.attack.max) / 2)) / 100 : -Infinity;
  }

  protected captureScore(moved: Unit): number {
    const property = propertyAt(this.state, moved.pos);
    if (!property) return -Infinity;
    const terrain = terrainAt(this.state.map, moved.pos);
    const base = terrain in this.w.capture ? this.w.capture[terrain as keyof GreedyWeights["capture"]] : 0;
    const finishes = property.capturePoints - displayHp(moved.hp) <= 0;
    return base + (finishes ? this.w.finishCaptureBonus : 0) + (this.isObjective(moved.pos) ? this.w.objectiveBonus : 0);
  }

}
