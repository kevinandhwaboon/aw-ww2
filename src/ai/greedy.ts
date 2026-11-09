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
  movementBudget,
  propertyAt,
  propertyDefAt,
  stats,
  supplyTargets,
  terrainAt,
  unitAt,
  unitCommands,
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
import { GREEDY_WEIGHTS, type GreedyWeights } from "./weights";

type MoveCommand = Extract<Command, { type: "move" }>;

/** Units the first AI never builds: it can't plan landings or drops yet (09-ai §4, D9). */
const NEVER_BUILT: ReadonlySet<UnitTypeId> = new Set(["landingCraft", "transportAircraft"]);

export function greedyAi(weights: GreedyWeights = GREEDY_WEIGHTS): AiPlayer {
  return { name: "Greedy", chooseCommand: (view) => chooseCommand(view.state, weights) };
}

/** The Greedy AI's next command for the current player. */
export function chooseCommand(state: GameState, weights: GreedyWeights = GREEDY_WEIGHTS): Command {
  const brain = new Brain(state, weights);
  const next = brain.nextUnit();
  if (next) return brain.bestCommand(next).command;
  return brain.build() ?? { type: "endTurn" };
}

/** What a unit is trying to do this turn, which decides how its destination is scored. */
type Plan =
  /** Nothing useful to do: stay put. */
  | { readonly kind: "idle" }
  /** Head for the nearest of these tiles. `dist` gives the movement points from each tile to the nearest one. */
  | { readonly kind: "advance"; readonly goals: readonly Point[]; readonly dist: Float64Array }
  /** Head home to a property that repairs and resupplies it. */
  | { readonly kind: "retreat"; readonly dist: Float64Array };

export interface Scored {
  readonly command: MoveCommand;
  readonly score: number;
}

class Brain {
  private readonly me: number;
  private readonly enemies: readonly Unit[];
  private readonly distCache = new Map<string, Float64Array>();

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
    if (UNITS[unit.type].transport) return 3;
    const range = stats.attackRange(this.state, unit);
    if (range) {
      const reach = (UNITS[unit.type].canMoveAndFire ? movementBudget(this.state, unit) : 0) + range.max;
      if (this.enemies.some((e) => this.canHurt(unit.type, e) && distance(unit.pos, e.pos) <= reach)) return 0;
    }
    if (UNITS[unit.type].canCapture) {
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
    return best;
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
    const def: UnitDef = UNITS[unit.type];
    const home = this.repairTiles(unit);
    if (home.length > 0) {
      const dist = this.distances(unit, home, "repair");
      const fromHere = dist[this.index(unit.pos)] ?? Infinity;
      const burn = stats.fuelPerDay(this.state, unit);
      const lowFuel = burn > 0 && unit.fuel < fromHere + this.w.fuelSafetyDays * burn;
      const noAmmo = def.primaryWeapon !== null && unit.ammo === 0 && def.secondaryWeapon === null;
      const hurt = displayHp(unit.hp) <= this.w.retreatHp;
      if ((lowFuel || noAmmo || hurt) && Number.isFinite(fromHere)) return { kind: "retreat", dist };
    }

    // Landing Craft and Transport Aircraft wait for a later AI (D9).
    if (def.specialActions.includes("unloadOnBeach") || def.specialActions.includes("airDrop")) return { kind: "idle" };

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
    if (range && targets.length > 0) {
      if (def.canMoveAndFire) return this.advance(unit, targets.map((e) => e.pos), `targets:${unit.type}`);
      // Indirect fire: head for tiles that have an enemy in range, not for the enemy itself.
      const firing = this.firingTiles(unit, targets, range);
      return this.advance(unit, firing, `firing:${unit.type}`);
    }
    // Nothing to shoot at: land units push on toward enemy properties; aircraft and ships wait.
    if (def.category === "land") return this.advance(unit, this.enemyProperties(), "enemyProperties");
    return { kind: "idle" };
  }

  private advance(unit: Unit, goals: readonly Point[], key: string): Plan {
    if (goals.length === 0) return { kind: "idle" };
    return { kind: "advance", goals, dist: this.distances(unit, goals, key) };
  }

  private score(unit: Unit, plan: Plan, command: MoveCommand): number {
    const dest = command.path[command.path.length - 1] ?? unit.pos;
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
        const far = plan.kind === "advance" && (plan.dist[this.index(unit.pos)] ?? 0) > this.w.boardTurns * stats.movePoints(this.state, unit);
        return host && !host.hasActed && far ? this.w.boardValue : -Infinity;
      }
      case "unload": {
        const passenger = unit.cargo.find((c) => c.id === action.passenger);
        if (!passenger) return -Infinity;
        const goals = this.capturable(passenger);
        if (goals.length === 0) return position + this.w.unloadValue / 2;
        const steps = this.distances(passenger, goals, `capturable${passenger.id}`)[this.index(action.to)] ?? Infinity;
        return Number.isFinite(steps) ? position + this.w.unloadValue - this.w.unloadPerStep * steps : -Infinity;
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
        return here === there ? this.w.stayBonus : 0;
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
    return (
      (dealt / 100) * targetCost -
      this.w.counterLoss * (taken / 100) * this.cost(moved) +
      kill * targetCost +
      (capturing ? this.w.stopCaptureBonus : 0)
    );
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
   * One build, or null when there's nothing worth building (09-ai §4): first enough capture-capable
   * units, then whatever best counters what the enemy has fielded, scored from the damage chart.
   * Funds are shared out over the free production sites, so one site doesn't take everything.
   */
  build(): Command | null {
    const sites = this.state.properties
      .map((p) => ({ pos: p.pos, options: buildOptions(this.state, p.pos).filter((o) => !NEVER_BUILT.has(o.type) && buildProblem(this.state, o.type, p.pos) === null) }))
      .filter((s) => s.options.length > 0);
    const funds = this.state.players[this.me]?.funds ?? 0;
    const share = funds / Math.max(1, sites.length);
    for (const { pos, options } of sites) {
      if (propertyDefAt(this.state, pos)?.builds === "land" && this.needsCapturers()) {
        const capturer = options.find((o) => UNITS[o.type].canCapture);
        if (capturer) return { type: "build", unitType: capturer.type, pos };
      }
      const cheapest = options[0]?.cost ?? 0;
      let best: { type: UnitTypeId; score: number } | null = null;
      for (const option of options) {
        if (option.cost > Math.max(share, cheapest)) continue;
        const score = this.buildScore(option.type, option.cost);
        if (score > 0 && (!best || score > best.score)) best = { type: option.type, score };
      }
      if (best) return { type: "build", unitType: best.type, pos };
    }
    return null;
  }

  private needsCapturers(): boolean {
    const mine = this.state.units.flatMap((u) => (u.owner === this.me ? [u, ...u.cargo] : []));
    const capturers = mine.filter((u) => UNITS[u.type].canCapture).length;
    const toTake = this.state.properties.filter((p) => p.owner === null || this.isEnemy(p.owner)).length;
    const wanted = Math.min(this.w.maxCapturers, Math.max(this.w.minCapturers, Math.ceil(toTake / this.w.propertiesPerCapturer)));
    return capturers < wanted;
  }

  /**
   * How well a unit type does against the enemy's army: for each enemy unit, the value of the damage
   * it would deal minus the value of the damage it would take, averaged, then divided by the square
   * root of its cost, which balances quality against numbers. Before the enemy fields anything, it's
   * scored against what they could build.
   */
  private buildScore(type: UnitTypeId, cost: number): number {
    const fielded = this.enemies.flatMap((e) => [e, ...e.cargo]).map((e) => ({ type: e.type, weight: e.hp / 100, cost: this.cost(e) }));
    const opponents = fielded.length > 0
      ? fielded
      : this.state.players
          .filter((p) => this.isEnemy(p.id))
          .flatMap((p) => p.buildable.map((t) => ({ type: t, weight: 1, cost: stats.unitCost(this.state, p.id, t) })));
    if (opponents.length === 0) return 0;
    let total = 0;
    let weights = 0;
    for (const enemy of opponents) {
      const dealt = baseDamage(type, enemy.type)?.base ?? 0;
      const taken = baseDamage(enemy.type, type)?.base ?? 0;
      total += enemy.weight * ((dealt / 100) * enemy.cost - this.w.buildRisk * (taken / 100) * cost);
      weights += enemy.weight;
    }
    return weights > 0 ? total / weights / Math.sqrt(cost) : 0;
  }

  // ---- Helpers -------------------------------------------------------------------------------

  private isEnemy(owner: number): boolean {
    return this.state.players[owner]?.side !== this.state.players[this.me]?.side;
  }

  private cost(unit: Unit): number {
    return stats.unitCost(this.state, unit.owner, unit.type);
  }

  private index(p: Point): number {
    return p.y * this.state.map.width + p.x;
  }

  /** Whether this unit type has a weapon against that enemy at all, ignoring ammo. */
  private canHurt(type: UnitTypeId, enemy: Unit): boolean {
    return baseDamage(type, enemy.type) !== null && (enemy.submerged !== true || UNITS[type].attacksSubmerged);
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

  private enemyProperties(): Point[] {
    return this.state.properties.filter((p) => p.owner !== null && this.isEnemy(p.owner)).map((p) => p.pos);
  }

  private isObjective(p: Point): boolean {
    return this.state.victoryConditions.some(
      (c) => (c.type === "captureProperties" || c.type === "holdProperties") && c.properties.some((q) => q.x === p.x && q.y === p.y),
    );
  }

  /** Our properties that repair this unit's category and are free (or under it). */
  private repairTiles(unit: Unit): Point[] {
    const category = UNITS[unit.type].category;
    return this.state.properties
      .filter((p) => p.owner === this.me && propertyDefAt(this.state, p.pos)?.repairs === category)
      .filter((p) => {
        const occupant = unitAt(this.state, p.pos);
        return !occupant || occupant.id === unit.id;
      })
      .map((p) => p.pos);
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
   */
  private distances(unit: Unit, goals: readonly Point[], key: string, breakForts = false): Float64Array {
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
    for (const g of goals) {
      const i = this.index(g);
      if (i < 0 || i >= size || isGoal[i]) continue;
      isGoal[i] = 1;
      dist[i] = 0;
      queue.push(0, i);
    }
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
