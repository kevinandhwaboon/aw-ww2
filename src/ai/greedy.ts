// The first AI, "Greedy" (09-ai §4). Each unit in turn picks its best-scoring legal command, with no
// lookahead and no plan across units. Then it builds, then it ends the turn. Scores are in funds;
// the weights are data (ai/weights.ts).
//
// It's stateless: every call looks at the state afresh and returns one command, so saves, undo and
// replays need nothing extra (09-ai §3). Ties go to the first candidate, so it's deterministic.

import {
  baseDamage,
  buildOptions,
  buildProblem,
  displayHp,
  distance,
  forecast,
  fortForecast,
  inBounds,
  launchable,
  launchProblem,
  launchState,
  movementBudget,
  threatTiles,
  propertyAt,
  propertyDefAt,
  stats,
  supplyTargets,
  terrainAt,
  unitAt,
  unitCommands,
  unloadTiles,
  TERRAIN,
  UNITS,
  type Command,
  type GameState,
  type Point,
  type TerrainDef,
  type Unit,
  type UnitDef,
  type UnitTypeId,
} from "../engine";
import type { AiPlayer } from "./player";
import { EASY_WEIGHTS, GREEDY_WEIGHTS, type GreedyWeights } from "./weights";

type MoveCommand = Extract<Command, { type: "move" }>;

type LaunchCommand = Extract<Command, { type: "launch" }>;

/** A unit type's data, as the general shape rather than that one type's exact values. */
const defOf = (type: UnitTypeId): UnitDef => UNITS[type];

const isLandingCraft = (type: UnitTypeId) => defOf(type).specialActions.includes("unloadOnBeach");
const isAirTransport = (type: UnitTypeId) => defOf(type).specialActions.includes("airDrop");
const isCarrier = (type: UnitTypeId) => defOf(type).specialActions.includes("launch");
const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

export function greedyAi(weights: GreedyWeights = GREEDY_WEIGHTS): AiPlayer {
  return { name: weights === EASY_WEIGHTS ? "Greedy (Easy)" : "Greedy", chooseCommand: (view) => chooseCommand(view.state, weights) };
}

/** The Greedy AI's next command for the current player. */
export function chooseCommand(state: GameState, weights: GreedyWeights = GREEDY_WEIGHTS): Command {
  const brain = new Brain(state, weights);
  const launch = brain.launch();
  if (launch) return launch;
  const next = brain.nextUnit();
  if (next) return brain.bestCommand(next).command;
  return brain.build() ?? { type: "endTurn" };
}

/** What a unit is trying to do this turn, which decides how its destination is scored. */
type Plan =
  /** Nothing useful to do: stay put. `hold` marks a transport waiting where it is for passengers. */
  | { readonly kind: "idle"; readonly hold: boolean }
  /**
   * Head for the nearest of these tiles. `dist` gives the movement points from each tile to the nearest
   * one. `embark` marks a stranded unit heading for a transport, or for where one will collect it.
   */
  | { readonly kind: "advance"; readonly goals: readonly Point[]; readonly dist: Float64Array; readonly embark: boolean }
  /** Head home to a property that repairs and resupplies it. */
  | { readonly kind: "retreat"; readonly dist: Float64Array };

/** An enemy unit a build is weighed against; `pos` is null for one they could build but haven't. */
interface Opponent {
  readonly type: UnitTypeId;
  readonly cost: number;
  readonly weight: number;
  readonly pos: Point | null;
}

const NO_TILES: ReadonlySet<number> = new Set();
const IDLE: Plan = { kind: "idle", hold: false };
const HOLD: Plan = { kind: "idle", hold: true };

export interface Scored {
  readonly command: MoveCommand;
  readonly score: number;
}

class Brain {
  private readonly me: number;
  private readonly enemies: readonly Unit[];
  private readonly distCache = new Map<string, Float64Array>();
  private readonly componentCache = new Map<string, Int32Array>();
  private readonly goalLabelCache = new Map<UnitTypeId, ReadonlySet<number>>();
  private readonly pickupCache = new Map<string, Point | null>();
  private waitingCache: readonly Unit[] | null = null;
  private garrisonCache: ReadonlySet<number> | null = null;
  private escortCache: ReadonlyMap<number, Unit> | null = null;
  private readonly threatTileCache = new Map<number, ReadonlySet<number>>();
  private readonly dangerCache = new Map<string, number>();
  private readonly followUpCache = new Map<number, readonly { id: number; damage: number }[]>();
  private loadableCache: readonly Point[] | null = null;

  constructor(
    private readonly state: GameState,
    private readonly w: GreedyWeights,
  ) {
    this.me = state.currentPlayer;
    this.enemies = state.units.filter((u) => this.isEnemy(u.owner));
  }

  // ---- Who acts next -------------------------------------------------------------------------

  /**
   * Order of play (09-ai §4): units that can attack first, then capturers, then everything else,
   * with transports last so passengers can board before they leave. Most valuable first in each group.
   */
  nextUnit(): Unit | undefined {
    const ready = this.state.units.filter((u) => u.owner === this.me && !u.hasActed);
    const ranked = ready.map((unit) => ({ unit, group: this.group(unit), value: this.cost(unit) }));
    ranked.sort((a, b) => a.group - b.group || b.value - a.value || a.unit.id - b.unit.id);
    return ranked[0]?.unit;
  }

  private group(unit: Unit): number {
    if (defOf(unit.type).transport) return 3;
    const range = stats.attackRange(this.state, unit);
    if (range) {
      const direct = defOf(unit.type).canMoveAndFire;
      const reach = (direct ? movementBudget(this.state, unit) : 0) + range.max;
      // Indirect fire goes first, so targets are softened before direct-fire units close in (09-ai §4c).
      if (this.enemies.some((e) => this.canHurt(unit.type, e) && distance(unit.pos, e.pos) <= reach)) return direct && this.w.indirectFirst ? 0.5 : 0;
    }
    if (defOf(unit.type).canCapture) {
      const reach = movementBudget(this.state, unit);
      if (this.capturable(unit).some((p) => distance(unit.pos, p) <= reach)) return 1;
    }
    return 2;
  }

  // ---- Choosing a unit's command -------------------------------------------------------------

  /** The unit's highest-scoring legal command. Waiting in place is always legal, so there is one. */
  bestCommand(unit: Unit): Scored {
    const plan = this.plan(unit);
    let best: Scored | null = null;
    for (const command of unitCommands(this.state, unit)) {
      if (command.type !== "move") continue;
      const score = this.score(unit, plan, command);
      if (!best || score > best.score) best = { command, score };
    }
    if (!best) throw new Error(`Unit ${unit.id} has no legal command`);
    return this.withSecondUnload(unit, best);
  }

  /**
   * The best launch this turn, or null (09-ai §4b): an aircraft takes off from its Carrier only to
   * attack, since aboard it's refuelled, rearmed and repaired free. Launches come before any move.
   */
  launch(): LaunchCommand | null {
    let best: { command: LaunchCommand; score: number } | null = null;
    for (const carrier of this.state.units) {
      if (carrier.owner !== this.me || !isCarrier(carrier.type)) continue;
      for (const aircraft of launchable(carrier)) {
        if (launchProblem(this.state, carrier, aircraft.id) !== null) continue;
        const out = launchState(this.state, carrier.id, aircraft.id);
        const flying = out?.units.find((u) => u.id === aircraft.id);
        if (!out || !flying) continue;
        const { command, score } = new Brain(out, this.w).bestCommand(flying);
        if (command.action.type !== "attack" || command.path.length === 0 || score <= 0) continue;
        if (!best || score > best.score) {
          best = { command: { type: "launch", carrierId: carrier.id, unitId: aircraft.id, path: command.path, action: command.action }, score };
        }
      }
    }
    return best?.command ?? null;
  }

  /** A transport unloading one passenger unloads the other in the same action when it can (D3). */
  private withSecondUnload(unit: Unit, best: Scored): Scored {
    const { action } = best.command;
    const other = action.type === "unload" ? unit.cargo.find((c) => c.id !== action.passenger) : undefined;
    if (action.type !== "unload" || !other) return best;
    const dest = best.command.path[best.command.path.length - 1] ?? unit.pos;
    const moved: Unit = { ...unit, pos: dest, hasActed: true };
    const afterMove: GameState = { ...this.state, units: this.state.units.map((u) => (u.id === unit.id ? moved : u)) };
    let second: { to: Point; score: number } | null = null;
    for (const to of unloadTiles(afterMove, moved, other)) {
      if (samePoint(to, action.to)) continue;
      const score = this.unloadScore(unit, other, to);
      if (Number.isFinite(score) && (!second || score > second.score)) second = { to, score };
    }
    if (!second) return best;
    return { command: { ...best.command, action: { ...action, second: { passenger: other.id, to: second.to } } }, score: best.score + second.score };
  }

  /** Every candidate for one unit with its score, best first. For tests and the debug panel. */
  scoredCommands(unit: Unit): Scored[] {
    const plan = this.plan(unit);
    return unitCommands(this.state, unit)
      .filter((c): c is MoveCommand => c.type === "move")
      .map((command) => ({ command, score: this.score(unit, plan, command) }))
      .sort((a, b) => b.score - a.score);
  }

  private plan(unit: Unit): Plan {
    const def = defOf(unit.type);
    const home = this.repairTiles(unit);
    // A transport with passengers presses on while it has the fuel to land them and get back to one
    // of our ports or airfields, rather than turning for home just short of the landing (09-ai §4b).
    if ((isLandingCraft(unit.type) || isAirTransport(unit.type)) && unit.cargo.length > 0) {
      const ferry = this.planFerry(unit);
      if (ferry.kind === "idle" && ferry.hold) return ferry;
      if (ferry.kind === "advance") {
        const here = this.index(unit.pos);
        const trip = this.distances(unit, ferry.goals, `trip${unit.id}`)[here] ?? Infinity;
        const back = home.length > 0 ? trip + (this.distances(unit, home, "repair")[here] ?? Infinity) : 0;
        const days = Math.ceil((trip + back) / Math.max(1, stats.movePoints(this.state, unit)));
        if (unit.fuel >= stats.moveFuel(this.state, unit, trip + back) + days * stats.fuelPerDay(this.state, unit)) return ferry;
      }
    }
    const homeward = this.headingHome(unit, home);
    if (homeward) return { kind: "retreat", dist: homeward };

    if (isLandingCraft(unit.type) || isAirTransport(unit.type)) return this.planFerry(unit);
    if (isCarrier(unit.type)) return this.planCarrier(unit);

    // A land unit with nothing left to do on its landmass heads for a transport (09-ai §4b).
    if (this.isStranded(unit)) {
      const rides = this.rideTiles(unit);
      if (rides.length > 0) return { kind: "advance", goals: rides, dist: this.distances(unit, rides, `rides${unit.id}`), embark: true };
    }

    const carries = def.transport?.carries ?? [];
    if (def.transport) {
      // A Halftrack carries passengers toward properties, and otherwise stays with the foot units.
      const goals = unit.cargo.length > 0
        ? this.capturable(unit)
        : this.state.units.filter((u) => u.owner === this.me && u.id !== unit.id && carries.includes(u.type)).map((u) => u.pos);
      return this.advance(unit, goals, unit.cargo.length > 0 ? "capturable" : "passengers");
    }

    if (def.canCapture) {
      const properties = this.capturable(unit);
      if (properties.length > 0) return this.advance(unit, properties, `capturable${unit.id}`);
    }

    const targets = this.enemies.filter((e) => this.canHurt(unit.type, e));
    const range = stats.attackRange(this.state, unit);
    const convoy = this.escorts().get(unit.id);
    if (convoy) {
      // An escort stays with its convoy unless there's something to shoot within two turns.
      const fight = this.advance(unit, targets.map((e) => e.pos), `targets:${unit.type}`);
      const near = fight.kind === "advance" && (fight.dist[this.index(unit.pos)] ?? Infinity) <= 2 * stats.movePoints(this.state, unit);
      const ferry = near ? IDLE : this.planFerry(convoy);
      if (ferry.kind === "advance") return this.advance(unit, ferry.goals, `escort${unit.id}`);
    }
    if (range && targets.length > 0) {
      if (def.canMoveAndFire) return this.advance(unit, targets.map((e) => e.pos), `targets:${unit.type}`);
      // Indirect fire: head for tiles that have an enemy in range, not for the enemy itself.
      const firing = this.firingTiles(unit, targets, range);
      return this.advance(unit, firing, `firing:${unit.type}`);
    }
    // Nothing to shoot at: land units push on toward enemy properties; aircraft and ships wait.
    if (def.category === "land") return this.advance(unit, this.enemyProperties(), "enemyProperties");
    return IDLE;
  }

  /**
   * The distances home if this unit should head there now, or null: at 3 HP or less, out of ammo with
   * no second weapon, or with fuel only just enough for the trip (09-ai §4, §4b).
   */
  private headingHome(unit: Unit, home: readonly Point[] = this.repairTiles(unit)): Float64Array | null {
    if (home.length === 0) return null;
    const def = defOf(unit.type);
    const dist = this.distances(unit, home, "repair");
    const fromHere = dist[this.index(unit.pos)] ?? Infinity;
    const burn = stats.fuelPerDay(this.state, unit);
    // Fuel to get home: the distance, plus the daily burn for the days the trip takes, plus a margin.
    const daysHome = Math.ceil(fromHere / Math.max(1, stats.movePoints(this.state, unit)));
    const lowFuel = burn > 0 && unit.fuel < stats.moveFuel(this.state, unit, fromHere) + (daysHome + this.w.fuelSafetyDays) * burn;
    const noAmmo = def.primaryWeapon !== null && unit.ammo === 0 && def.secondaryWeapon === null;
    const hurt = displayHp(unit.hp) <= this.w.retreatHp;
    return (lowFuel || noAmmo || hurt) && Number.isFinite(fromHere) ? dist : null;
  }

  private advance(unit: Unit, goals: readonly Point[], key: string, offsets?: readonly number[]): Plan {
    if (goals.length === 0) return IDLE;
    return { kind: "advance", goals, dist: this.distances(unit, goals, key, false, offsets), embark: false };
  }

  // ---- Landings, drops and carriers (09-ai §4b) ----------------------------------------------

  /**
   * A Landing Craft or Transport Aircraft. Empty, it goes to where stranded units can board and
   * waits. With passengers, it waits for any more that are close, then carries them to where they
   * can get at their goal.
   */
  private planFerry(unit: Unit): Plan {
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
  private stillLoading(transport: Unit): boolean {
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
  private waitsForWave(craft: Unit): boolean {
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
  private escorts(): ReadonlyMap<number, Unit> {
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
  private planCarrier(unit: Unit): Plan {
    if (unit.cargo.length === 0) return IDLE;
    const targets = this.enemies.filter((e) => unit.cargo.some((c) => this.canHurt(c.type, e)));
    if (targets.length === 0) return IDLE;
    const strike = Math.min(...unit.cargo.map((c) => stats.movePoints(this.state, c)));
    const tiles = this.firingTiles(unit, targets, { min: Math.max(1, strike - this.w.carrierStandoff), max: strike });
    return this.advance(unit, tiles, `strike${unit.id}`);
  }

  /** Whether an enemy that can hurt this unit could attack it on this tile next turn. */
  private inDanger(unit: Unit, at: Point): boolean {
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
  private isStranded(unit: Unit): boolean {
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
  private garrison(): ReadonlySet<number> {
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
  private enemyCanInvade(): boolean {
    const carries = (type: UnitTypeId) => isLandingCraft(type) || isAirTransport(type);
    return (
      this.enemies.some((e) => carries(e.type)) ||
      this.state.players.some((p) => this.isEnemy(p.id) && p.buildable.some((t) => carries(t) && this.state.properties.some((q) => q.owner === p.id && propertyDefAt(this.state, q.pos)?.builds === defOf(t).category)))
    );
  }

  /** The landmasses, for this unit type's movement, that hold something for it to take or fight. */
  private goalLabels(type: UnitTypeId): ReadonlySet<number> {
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
  private waiting(): readonly Unit[] {
    this.waitingCache ??= this.state.units.filter((u) => u.owner === this.me && displayHp(u.hp) > this.w.retreatHp && this.isStranded(u));
    return this.waitingCache;
  }

  /** Whether units can board this kind of transport while it stands on this tile (05-supply-transport §6, §8). */
  private canBoardAt(transport: UnitTypeId, at: Point): boolean {
    const terrain = terrainAt(this.state.map, at);
    const owner = propertyAt(this.state, at)?.owner ?? null;
    if (isAirTransport(transport)) return terrain === "airfield" && owner === this.me;
    return terrain === "beach" || (terrain === "port" && (owner === null || owner === this.me));
  }

  /** Every Beach, and every Port that isn't the enemy's: where a Landing Craft loads and unloads. */
  private loadableTiles(): readonly Point[] {
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
  private pickup(transport: Unit): Point | null {
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
          if (this.connected(u.type, u.pos, tile)) walk = Math.min(walk, distance(u.pos, tile) / stats.movePoints(this.state, u));
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

  /** Whether a stranded unit that fits is close enough to this transport that it's worth waiting for. */
  private moreComing(transport: Unit): boolean {
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
  private rideTiles(unit: Unit): Point[] {
    const tiles = new Map<number, Point>();
    for (const t of this.state.units) {
      const rules = defOf(t.type).transport;
      if (t.owner !== this.me || !rules || !(isLandingCraft(t.type) || isAirTransport(t.type))) continue;
      if (!rules.carries.includes(unit.type) || t.cargo.length >= rules.capacity) continue;
      const tile = this.canBoardAt(t.type, t.pos) ? t.pos : t.cargo.length === 0 ? this.pickup(t) : null;
      if (tile && this.connected(unit.type, unit.pos, tile)) tiles.set(this.index(tile), tile);
    }
    return [...tiles.values()];
  }

  /** What a passenger is after once it's ashore: properties to take, or else enemies and their properties. */
  private goalsFor(passenger: Unit): Point[] {
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
  private unloadScore(transport: Unit, passenger: Unit, to: Point): number {
    const goals = this.goalsFor(passenger);
    if (goals.length === 0) return this.w.unloadValue / 2;
    const steps = this.distances(passenger, goals, `goals${passenger.id}`)[this.index(to)] ?? Infinity;
    if (!Number.isFinite(steps)) return -Infinity;
    if (isAirTransport(transport.type) && steps > this.w.dropWithinTurns * stats.movePoints(this.state, passenger)) return -Infinity;
    return this.w.unloadValue - this.w.unloadPerStep * steps;
  }

  private neighbors(p: Point): Point[] {
    return [{ x: p.x, y: p.y - 1 }, { x: p.x + 1, y: p.y }, { x: p.x, y: p.y + 1 }, { x: p.x - 1, y: p.y }].filter((q) => inBounds(this.state.map, q));
  }

  private score(unit: Unit, plan: Plan, command: MoveCommand): number {
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
    const danger = this.w.dangerWeight > 0 && staying && !delivering ? this.w.dangerWeight * this.danger(unit, dest) : 0;
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
  private pastReturn(unit: Unit, plan: Plan, command: MoveCommand, dest: Point): boolean {
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

  private actionScore(unit: Unit, plan: Plan, command: MoveCommand, dest: Point): number {
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
  private positionScore(unit: Unit, moved: Unit, plan: Plan): number {
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

  private terrainScore(moved: Unit): number {
    return (this.w.starValue * stats.terrainStars(this.state, moved) * displayHp(moved.hp)) / 10;
  }

  /**
   * Value of the damage dealt minus the value of the expected counter, at the forecast's midpoint,
   * plus a bonus for a kill (09-ai §4). Value of damage = damage % × the unit's cost.
   */
  private attackScore(afterMove: GameState, moved: Unit, target: Unit): number {
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

  /** Rough damage, in HP out of 100, of this attacker type and strength against a defender on terrain with these stars. */
  private estimate(attacker: Unit, defender: Unit, stars: number): number {
    const base = baseDamage(attacker.type, defender.type)?.base ?? 0;
    return (base * displayHp(attacker.hp) * (100 - stars * displayHp(defender.hp))) / 1000;
  }

  /** What each of our units that hasn't acted could do to this enemy this turn, roughly (09-ai §4c). */
  private followUp(target: Unit): readonly { id: number; damage: number }[] {
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
  private danger(unit: Unit, dest: Point): number {
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
  private threatened(enemy: Unit, unit: Unit): ReadonlySet<number> {
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
  private fortScore(afterMove: GameState, unit: Unit, moved: Unit, plan: Plan, target: Point): number {
    const f = fortForecast(afterMove, moved, target);
    if (!f || plan.kind !== "advance") return -Infinity;
    const here = this.index(unit.pos);
    const withoutForts = this.distances(unit, plan.goals, `${plan.goals.length}:${plan.goals.map((g) => this.index(g)).join(",")}`, true);
    const blocked = (withoutForts[here] ?? Infinity) + 2 < (plan.dist[here] ?? Infinity);
    return blocked ? (this.w.blockingFortValue * Math.min(100, (f.attack.min + f.attack.max) / 2)) / 100 : -Infinity;
  }

  private captureScore(moved: Unit): number {
    const property = propertyAt(this.state, moved.pos);
    if (!property) return -Infinity;
    const terrain = terrainAt(this.state.map, moved.pos);
    const base = terrain in this.w.capture ? this.w.capture[terrain as keyof GreedyWeights["capture"]] : 0;
    const finishes = property.capturePoints - displayHp(moved.hp) <= 0;
    return base + (finishes ? this.w.finishCaptureBonus : 0) + (this.isObjective(moved.pos) ? this.w.objectiveBonus : 0);
  }

  // ---- Building ------------------------------------------------------------------------------

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

    // Everything else is chosen among armed units; transports are only ever built by the rule above.
    const sites = this.state.properties
      .map((p) => ({ pos: p.pos, options: buildOptions(this.state, p.pos).filter((o) => defOf(o.type).range !== null && buildProblem(this.state, o.type, p.pos) === null) }))
      .filter((s) => s.options.length > 0);
    const funds = Math.max(0, (this.state.players[this.me]?.funds ?? 0) - reserve);
    const share = funds / Math.max(1, sites.length);
    for (const { pos, options } of sites) {
      if (this.w.keepSitesForService && this.neededForService(pos)) continue;
      const threatened = this.enemies.some((e) => this.nearThreat(e, pos));
      const budget = threatened ? funds : Math.max(share, options[0]?.cost ?? 0);
      const opponents = this.opponentsFor(pos);
      const capturers = propertyDefAt(this.state, pos)?.builds === "land" ? this.capturersNeeded() : "enough";
      const capturersOnly = capturers === "belowMinimum" && options.some((o) => o.cost <= budget && defOf(o.type).canCapture);
      let best: { type: UnitTypeId; score: number } | null = null;
      for (const option of options) {
        const canCapture = defOf(option.type).canCapture;
        if (option.cost > budget || (capturersOnly && !canCapture)) continue;
        const bonus = canCapture && capturers !== "enough" ? this.w.capturerBonus : 0;
        const score = this.buildScore(option.type, option.cost, budget, pos, opponents, bonus);
        if ((score > 0 || threatened || capturersOnly) && (!best || score > best.score)) best = { type: option.type, score };
      }
      if (best) return { type: "build", unitType: best.type, pos };
    }
    return null;
  }

  /**
   * Whether one of our aircraft or ships is coming in to this airfield or port for fuel, ammo or
   * repairs and could get there within two turns: then it's kept free rather than built on, or the
   * new unit would be standing there when it arrives (09-ai §4c).
   */
  private neededForService(site: Point): boolean {
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
  private transportWanted(site: Point): { type: UnitTypeId; cost: number } | null {
    const type = propertyDefAt(this.state, site)?.builds === "naval" ? "landingCraft" : propertyDefAt(this.state, site)?.builds === "air" ? "transportAircraft" : null;
    const option = type && buildOptions(this.state, site).find((o) => o.type === type);
    if (!type || !option) return null;
    const carries = defOf(type).transport?.carries ?? [];
    const waiting = this.waiting().filter((u) => carries.includes(u.type));
    const owned = this.state.units.filter((u) => u.owner === this.me && u.type === type).length;
    const wanted =
      type === "landingCraft"
        ? owned < this.w.maxLandingCraft && owned * this.w.strandedPerCraft < waiting.length && this.pickup(this.phantom(type, site)) !== null
        : owned < this.w.maxAirTransports && waiting.some((u) => defOf(u.type).canCapture && this.connected(u.type, u.pos, site));
    return wanted ? { type, cost: option.cost } : null;
  }

  /** Whether we have, or could build, Landing Craft to carry land units from this site's landmass overseas. */
  private canShipFrom(type: UnitTypeId, site: Point): boolean {
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
  private capturersNeeded(): "belowMinimum" | "belowWanted" | "enough" {
    const mine = this.state.units.flatMap((u) => (u.owner === this.me ? [u, ...u.cargo] : []));
    const capturers = mine.filter((u) => defOf(u.type).canCapture).length;
    const toTake = this.state.properties.filter((p) => p.owner === null || this.isEnemy(p.owner)).length;
    const wanted = Math.min(this.w.maxCapturers, Math.max(this.w.minCapturers, Math.ceil(toTake / this.w.propertiesPerCapturer)));
    return capturers < this.w.minCapturers ? "belowMinimum" : capturers < wanted ? "belowWanted" : "enough";
  }

  /**
   * The enemy units a build at this site is weighed against (09-ai §4a): each counts by its HP, 3×
   * when it could reach the site soon, and less the more our units near it can already hurt it
   * (unless our units already cover every enemy). Before the enemy fields anything, it's what they
   * could build, with no position.
   */
  private opponentsFor(site: Point): Opponent[] {
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
  private buildScore(type: UnitTypeId, cost: number, budget: number, site: Point, opponents: readonly Opponent[], bonus: number): number {
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
  private nearThreat(enemy: Unit, site: Point): boolean {
    const reach = this.w.threatTurns * stats.movePoints(this.state, enemy) + (stats.attackRange(this.state, enemy)?.max ?? 0);
    return distance(enemy.pos, site) <= reach;
  }

  /**
   * How much of this enemy our units can already deal with, 0 to 1: each of our units that could
   * reach it within a few turns covers its base damage against it, scaled by its HP (09-ai §4a).
   */
  private coverage(enemy: Unit, at: Point): number {
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
  private canReachFrom(type: UnitTypeId, site: Point, target: Point): boolean {
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

  /** A not-yet-built unit of ours, to ask the engine about its stats. */
  private phantom(type: UnitTypeId, pos: Point): Unit {
    return { id: -1, type, owner: this.me, pos, hp: 100, fuel: 0, ammo: 0, kills: 0, hasActed: false, cargo: [] };
  }

  /**
   * The map split into the areas a unit of this type could travel within over terrain, ignoring other
   * units: each passable tile gets its area's number, and impassable tiles -1.
   */
  private components(type: UnitTypeId): Int32Array {
    const key = defOf(type).movementType;
    const cached = this.componentCache.get(key);
    if (cached) return cached;
    const { width, height, terrain } = this.state.map;
    const unit = this.phantom(type, { x: 0, y: 0 });
    const passable = (i: number) => {
      const here = terrain[i];
      return here !== undefined && stats.moveCost(this.state, unit, here) !== null;
    };
    const labels = new Int32Array(width * height).fill(-1);
    let next = 0;
    for (let start = 0; start < labels.length; start++) {
      if (labels[start] !== -1 || !passable(start)) continue;
      labels[start] = next;
      const stack = [start];
      for (let i = stack.pop(); i !== undefined; i = stack.pop()) {
        const x = i % width;
        const y = (i - x) / width;
        for (const [nx, ny] of [[x, y - 1], [x + 1, y], [x, y + 1], [x - 1, y]] as const) {
          if (nx < 0 || ny < 0 || nx >= width || ny >= height) continue;
          const n = ny * width + nx;
          if (labels[n] !== -1 || !passable(n)) continue;
          labels[n] = next;
          stack.push(n);
        }
      }
      next++;
    }
    this.componentCache.set(key, labels);
    return labels;
  }

  private label(type: UnitTypeId, p: Point): number {
    return this.components(type)[this.index(p)] ?? -1;
  }

  /** Whether a unit of this type could travel between these two tiles over terrain. */
  private connected(type: UnitTypeId, a: Point, b: Point): boolean {
    const label = this.label(type, a);
    return label >= 0 && label === this.label(type, b);
  }

  // ---- Helpers -------------------------------------------------------------------------------

  private isEnemy(owner: number): boolean {
    return this.state.players[owner]?.side !== this.state.players[this.me]?.side;
  }

  private cost(unit: Unit): number {
    return stats.unitCost(this.state, unit.owner, unit.type);
  }

  /** What losing this unit now would cost: its price at its present strength, and its passengers'. */
  private worth(unit: Unit): number {
    return (this.cost(unit) * unit.hp) / 100 + unit.cargo.reduce((sum, c) => sum + this.worth(c), 0);
  }

  private index(p: Point): number {
    return p.y * this.state.map.width + p.x;
  }

  /** Whether this unit type has a weapon against that enemy at all, ignoring ammo. */
  private canHurt(type: UnitTypeId, enemy: Unit): boolean {
    return baseDamage(type, enemy.type) !== null && (enemy.submerged !== true || defOf(type).attacksSubmerged);
  }

  /**
   * Properties this unit could capture: neutral or enemy, and not already being captured by another
   * of our units, so capturers spread out.
   */
  private capturable(unit: Unit): Point[] {
    return this.state.properties
      .filter((p) => p.owner === null || this.isEnemy(p.owner))
      .filter((p) => {
        const capturer = p.capturingUnit === null ? undefined : this.state.units.find((u) => u.id === p.capturingUnit);
        return !capturer || capturer.id === unit.id || this.isEnemy(capturer.owner);
      })
      .filter((p) => stats.moveCost(this.state, unit, terrainAt(this.state.map, p.pos)) !== null)
      .map((p) => p.pos);
  }

  /** One of our own factories, airfields or ports that can build something of ours. */
  private isOwnProductionSite(p: Point): boolean {
    const builds = propertyDefAt(this.state, p)?.builds;
    if (!builds || propertyAt(this.state, p)?.owner !== this.me) return false;
    return (this.state.players[this.me]?.buildable ?? []).some((t) => defOf(t).category === builds);
  }

  private enemyProperties(): Point[] {
    return this.state.properties.filter((p) => p.owner !== null && this.isEnemy(p.owner)).map((p) => p.pos);
  }

  private isObjective(p: Point): boolean {
    return this.state.victoryConditions.some(
      (c) => (c.type === "captureProperties" || c.type === "holdProperties") && c.properties.some((q) => q.x === p.x && q.y === p.y),
    );
  }

  /** Our properties that repair this unit's category and are free (or under it), and our Carriers with room for it. */
  private repairTiles(unit: Unit): Point[] {
    const category = defOf(unit.type).category;
    const properties = this.state.properties
      .filter((p) => p.owner === this.me && propertyDefAt(this.state, p.pos)?.repairs === category)
      .filter((p) => {
        // A port or airfield one of our own units stands on still counts as home: units move off
        // production sites, so it's usually free on arrival. A city under a friend may stay taken.
        const occupant = unitAt(this.state, p.pos);
        return !occupant || occupant.id === unit.id || (this.w.keepSitesForService && category !== "land" && occupant.owner === this.me);
      })
      .map((p) => p.pos);
    const carriers = this.state.units
      .filter((u) => u.owner === this.me && isCarrier(u.type))
      .filter((u) => (defOf(u.type).transport?.carries.includes(unit.type) ?? false) && u.cargo.length < (defOf(u.type).transport?.capacity ?? 0))
      .map((u) => u.pos);
    return [...properties, ...carriers];
  }

  /** Tiles this indirect-fire unit could stand on with one of these enemies in range. */
  private firingTiles(unit: Unit, targets: readonly Unit[], range: { min: number; max: number }): Point[] {
    const tiles = new Map<number, Point>();
    for (const target of targets) {
      for (let dy = -range.max; dy <= range.max; dy++) {
        const spread = range.max - Math.abs(dy);
        for (let dx = -spread; dx <= spread; dx++) {
          const p = { x: target.pos.x + dx, y: target.pos.y + dy };
          if (!inBounds(this.state.map, p) || distance(p, target.pos) < range.min) continue;
          if (stats.moveCost(this.state, unit, terrainAt(this.state.map, p)) === null) continue;
          tiles.set(this.index(p), p);
        }
      }
    }
    return [...tiles.keys()].sort((a, b) => a - b).map((i) => tiles.get(i) ?? { x: 0, y: 0 });
  }

  /**
   * Movement points from every tile to the nearest goal for this unit, over terrain, ignoring other
   * units. A goal it can't stand on (an enemy ship, for a tank on the shore) counts as 1 to enter.
   * With `breakForts`, fortifications count as the ground they'd leave behind once destroyed.
   * `offsets` gives each goal a starting cost, for goals that aren't equally good.
   */
  private distances(unit: Unit, goals: readonly Point[], key: string, breakForts = false, offsets?: readonly number[]): Float64Array {
    const cacheKey = `${unit.type}|${unit.owner}|${breakForts ? "open" : "as-is"}|${key}`;
    const cached = this.distCache.get(cacheKey);
    if (cached) return cached;

    const { width, height, terrain } = this.state.map;
    const size = width * height;
    const enter = new Float64Array(size);
    for (let i = 0; i < size; i++) {
      const here = terrain[i];
      if (here === undefined) {
        enter[i] = Infinity;
        continue;
      }
      const def: TerrainDef = TERRAIN[here];
      const ground = breakForts && def.breakable ? def.breakable.becomes : here;
      enter[i] = stats.moveCost(this.state, unit, ground) ?? Infinity;
    }

    const dist = new Float64Array(size).fill(Infinity);
    const isGoal = new Uint8Array(size);
    const queue = new MinQueue();
    goals.forEach((g, n) => {
      const i = this.index(g);
      if (i < 0 || i >= size || isGoal[i]) return;
      isGoal[i] = 1;
      dist[i] = offsets?.[n] ?? 0;
      queue.push(dist[i] ?? 0, i);
    });
    // Backwards from the goals: stepping from tile a onto tile b costs b's entry cost.
    for (let next = queue.pop(); next; next = queue.pop()) {
      const [d, b] = next;
      if (d > (dist[b] ?? Infinity)) continue;
      const enterB = enter[b] ?? Infinity;
      const step = Number.isFinite(enterB) ? enterB : isGoal[b] ? 1 : Infinity;
      if (!Number.isFinite(step)) continue;
      const bx = b % width;
      const by = (b - bx) / width;
      for (const [ax, ay] of [[bx, by - 1], [bx + 1, by], [bx, by + 1], [bx - 1, by]] as const) {
        if (ax < 0 || ay < 0 || ax >= width || ay >= height) continue;
        const a = ay * width + ax;
        if (!Number.isFinite(enter[a] ?? Infinity)) continue;
        const candidate = d + step;
        if (candidate < (dist[a] ?? Infinity)) {
          dist[a] = candidate;
          queue.push(candidate, a);
        }
      }
    }
    this.distCache.set(cacheKey, dist);
    return dist;
  }
}

/** A small binary heap of [priority, tile], lowest priority first; ties by tile index. */
class MinQueue {
  private readonly items: [number, number][] = [];

  push(priority: number, value: number): void {
    const items = this.items;
    items.push([priority, value]);
    let i = items.length - 1;
    while (i > 0) {
      const parent = (i - 1) >> 1;
      const p = items[parent];
      const c = items[i];
      if (!p || !c || !before(c, p)) break;
      items[parent] = c;
      items[i] = p;
      i = parent;
    }
  }

  pop(): [number, number] | undefined {
    const items = this.items;
    const top = items[0];
    const last = items.pop();
    if (!top || !last || items.length === 0) return top;
    items[0] = last;
    let i = 0;
    for (;;) {
      const l = 2 * i + 1;
      const r = l + 1;
      let smallest = i;
      const li = items[l];
      const ri = items[r];
      const si = () => items[smallest] ?? last;
      if (li && before(li, si())) smallest = l;
      if (ri && before(ri, si())) smallest = r;
      if (smallest === i) return top;
      const a = items[i];
      const b = items[smallest];
      if (!a || !b) return top;
      items[i] = b;
      items[smallest] = a;
      i = smallest;
    }
  }
}

const before = (a: [number, number], b: [number, number]) => a[0] < b[0] || (a[0] === b[0] && a[1] < b[1]);

/** For tests: every candidate for this unit with its score, best first. */
export function scoreUnitCommands(state: GameState, unit: Unit, weights: GreedyWeights = GREEDY_WEIGHTS): Scored[] {
  return new Brain(state, weights).scoredCommands(unit);
}
