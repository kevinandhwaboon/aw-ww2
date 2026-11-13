// The shared layer of the Greedy AI (09-ai §4): its view of the game, caches and the map analysis
// every other layer uses. The layers stack: base → landings → production → Brain (ai/greedy.ts),
// all methods of one object, so each layer can use the ones below it.

import {
  baseDamage,
  distance,
  inBounds,
  propertyAt,
  propertyDefAt,
  stats,
  terrainAt,
  unitAt,
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
import { MinQueue } from "./minQueue";
import type { GreedyWeights } from "./weights";

export type MoveCommand = Extract<Command, { type: "move" }>;

export type LaunchCommand = Extract<Command, { type: "launch" }>;

/** A unit type's data, as the general shape rather than that one type's exact values. */
export const defOf = (type: UnitTypeId): UnitDef => UNITS[type];

export const isLandingCraft = (type: UnitTypeId) => defOf(type).specialActions.includes("unloadOnBeach");
export const isAirTransport = (type: UnitTypeId) => defOf(type).specialActions.includes("airDrop");
export const isCarrier = (type: UnitTypeId) => defOf(type).specialActions.includes("launch");
export const samePoint = (a: Point, b: Point) => a.x === b.x && a.y === b.y;

/** What a unit is trying to do this turn, which decides how its destination is scored. */
export type Plan =
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
export interface Opponent {
  readonly type: UnitTypeId;
  readonly cost: number;
  readonly weight: number;
  readonly pos: Point | null;
}

export const NO_TILES: ReadonlySet<number> = new Set();
export const IDLE: Plan = { kind: "idle", hold: false };
export const HOLD: Plan = { kind: "idle", hold: true };

export interface Scored {
  readonly command: MoveCommand;
  readonly score: number;
}

export abstract class BrainBase {
  protected readonly me: number;
  protected readonly enemies: readonly Unit[];
  protected readonly distCache = new Map<string, Float64Array>();
  protected readonly componentCache = new Map<string, Int32Array>();
  protected readonly goalLabelCache = new Map<UnitTypeId, ReadonlySet<number>>();
  protected readonly pickupCache = new Map<string, Point | null>();
  protected waitingCache: readonly Unit[] | null = null;
  protected pressCache: boolean | null = null;
  protected garrisonCache: ReadonlySet<number> | null = null;
  protected escortCache: ReadonlyMap<number, Unit> | null = null;
  protected readonly threatTileCache = new Map<number, ReadonlySet<number>>();
  protected readonly dangerCache = new Map<string, number>();
  protected readonly followUpCache = new Map<number, readonly { id: number; damage: number }[]>();
  protected loadableCache: readonly Point[] | null = null;

  constructor(
    protected readonly state: GameState,
    protected readonly w: GreedyWeights,
  ) {
    this.me = state.currentPlayer;
    this.enemies = state.units.filter((u) => this.isEnemy(u.owner));
  }

  // ---- Helpers -------------------------------------------------------------------------------

  protected isEnemy(owner: number): boolean {
    return this.state.players[owner]?.side !== this.state.players[this.me]?.side;
  }

  protected cost(unit: Unit): number {
    return stats.unitCost(this.state, unit.owner, unit.type);
  }

  /** What losing this unit now would cost: its price at its present strength, and its passengers'. */
  protected worth(unit: Unit): number {
    return (this.cost(unit) * unit.hp) / 100 + unit.cargo.reduce((sum, c) => sum + this.worth(c), 0);
  }

  protected index(p: Point): number {
    return p.y * this.state.map.width + p.x;
  }

  /** Whether this unit type has a weapon against that enemy at all, ignoring ammo. */
  protected canHurt(type: UnitTypeId, enemy: Unit): boolean {
    return baseDamage(type, enemy.type) !== null && (enemy.submerged !== true || defOf(type).attacksSubmerged);
  }

  /**
   * Properties this unit could capture: neutral or enemy, and not already being captured by another
   * of our units, so capturers spread out.
   */
  protected capturable(unit: Unit): Point[] {
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
  protected isOwnProductionSite(p: Point): boolean {
    const builds = propertyDefAt(this.state, p)?.builds;
    if (!builds || propertyAt(this.state, p)?.owner !== this.me) return false;
    return (this.state.players[this.me]?.buildable ?? []).some((t) => defOf(t).category === builds);
  }

  protected enemyProperties(): Point[] {
    return this.state.properties.filter((p) => p.owner !== null && this.isEnemy(p.owner)).map((p) => p.pos);
  }

  protected isObjective(p: Point): boolean {
    return this.state.victoryConditions.some(
      (c) => (c.type === "captureProperties" || c.type === "holdProperties") && c.properties.some((q) => q.x === p.x && q.y === p.y),
    );
  }

  /** Our properties that repair this unit's category and are free (or under it), and our Carriers with room for it. */
  protected repairTiles(unit: Unit): Point[] {
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
  protected firingTiles(unit: Unit, targets: readonly Unit[], range: { min: number; max: number }): Point[] {
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
  protected distances(unit: Unit, goals: readonly Point[], key: string, breakForts = false, offsets?: readonly number[]): Float64Array {
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

  // ---- Where units can travel ---------------------------------------------------------------

  /** A not-yet-built unit of ours, to ask the engine about its stats. */
  protected phantom(type: UnitTypeId, pos: Point): Unit {
    return { id: -1, type, owner: this.me, pos, hp: 100, fuel: 0, ammo: 0, kills: 0, hasActed: false, cargo: [] };
  }

  /**
   * The map split into the areas a unit of this type could travel within over terrain, ignoring other
   * units: each passable tile gets its area's number, and impassable tiles -1.
   */
  protected components(type: UnitTypeId): Int32Array {
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

  protected label(type: UnitTypeId, p: Point): number {
    return this.components(type)[this.index(p)] ?? -1;
  }

  /** Whether a unit of this type could travel between these two tiles over terrain. */
  protected connected(type: UnitTypeId, a: Point, b: Point): boolean {
    const label = this.label(type, a);
    return label >= 0 && label === this.label(type, b);
  }

}
