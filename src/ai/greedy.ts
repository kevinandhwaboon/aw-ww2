// The first AI, "Greedy" (09-ai §4). Each unit in turn picks its best-scoring legal command, with no
// lookahead and no plan across units. Then it builds, then it ends the turn. Scores are in funds;
// the weights are data (ai/weights.ts).
//
// It's stateless: every call looks at the state afresh and returns one command, so saves, undo and
// replays need nothing extra (09-ai §3). The one exception is fog of war, where it remembers enemies
// it has seen (ai/memory.ts), a hint lost on reload. Ties go to the first candidate, so it's deterministic.

import {
  displayHp,
  distance,
  fogToday,
  launchable,
  launchProblem,
  launchState,
  movementBudget,
  stats,
  terrainAt,
  tileInSight,
  unitAt,
  unitCommands,
  unloadTiles,
  type Command,
  type GameState,
  type Point,
  type Unit,
} from "../engine";
import {
  HOLD,
  IDLE,
  type LaunchCommand,
  type MoveCommand,
  type Plan,
  type Scored,
  defOf,
  isAirTransport,
  isCarrier,
  isLandingCraft,
  isSupplyShip,
  samePoint,
} from "./greedyBase";
import { ProductionBrain } from "./greedyProduction";
import { EnemyMemory } from "./memory";
import type { MapPlan } from "./mapPlan";
import type { AiPlayer } from "./player";
import { EASY_WEIGHTS, GREEDY_WEIGHTS, type GreedyWeights } from "./weights";

export function greedyAi(weights: GreedyWeights = GREEDY_WEIGHTS, mapPlan: MapPlan | null = null): AiPlayer {
  // Each Greedy player remembers the enemies it has seen in fog of war (09-ai §4g).
  const memory = new EnemyMemory(weights.memoryDays);
  const level = weights === EASY_WEIGHTS ? "Greedy (Easy)" : "Greedy";
  return {
    name: mapPlan ? `${level}, ${mapPlan.name}` : level,
    chooseCommand: (view) => {
      const believed = memory.believe(view.state, view.me);
      mapPlan?.observe?.(believed);
      return chooseCommand(believed, weights, mapPlan);
    },
  };
}

/** The Greedy AI's next command for the current player, following a map plan if it has one (22-campaign §6). */
export function chooseCommand(state: GameState, weights: GreedyWeights = GREEDY_WEIGHTS, mapPlan: MapPlan | null = null): Command {
  const brain = new Brain(state, weights, mapPlan);
  const launch = brain.launch() ?? brain.scoutLaunch();
  if (launch) return launch;
  const next = brain.nextUnit();
  if (next) return brain.bestCommand(next).command;
  return brain.build() ?? { type: "endTurn" };
}

class Brain extends ProductionBrain {
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
    const ghosts = this.ghosts();
    if (range) {
      const direct = defOf(unit.type).canMoveAndFire;
      const reach = (direct ? movementBudget(this.state, unit) : 0) + range.max;
      // Indirect fire goes first, so targets are softened before direct-fire units close in (09-ai §4c).
      // Only enemies it can see: one it only remembers can't be attacked until it's seen again (09-ai §4g).
      const inReach = (e: Unit) => this.canHurt(unit.type, e) && distance(unit.pos, e.pos) <= reach && !ghosts.includes(e);
      if (this.enemies.some(inReach)) return direct && this.w.indirectFirst ? 0.5 : 0;
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
        const { command, score } = new Brain(out, this.w, this.mapPlan).bestCommand(flying);
        if (command.action.type !== "attack" || command.path.length === 0 || score <= 0) continue;
        if (!best || score > best.score) {
          best = { command: { type: "launch", carrierId: carrier.id, unitId: aircraft.id, path: command.path, action: command.action }, score };
        }
      }
    }
    return best?.command ?? null;
  }

  /**
   * A map plan's scout (22-campaign §6): an aircraft aboard a Carrier that the plan gives somewhere
   * to go takes off toward it, though there's nothing to attack. Only once no attack launch is left,
   * and only when the flight makes progress and doesn't leave it short of fuel to get back.
   */
  scoutLaunch(): LaunchCommand | null {
    const plan = this.mapPlan;
    if (!plan?.goals) return null;
    for (const carrier of this.state.units) {
      if (carrier.owner !== this.me || !isCarrier(carrier.type)) continue;
      for (const aircraft of launchable(carrier)) {
        if (launchProblem(this.state, carrier, aircraft.id) !== null) continue;
        const out = launchState(this.state, carrier.id, aircraft.id);
        const flying = out?.units.find((u) => u.id === aircraft.id);
        if (!out || !flying || !plan.goals(out, flying)) continue;
        const { command, score } = new Brain(out, this.w, this.mapPlan).bestCommand(flying);
        const end = command.path[command.path.length - 1];
        if (!end || samePoint(end, carrier.pos) || score <= 0 || command.action.type === "load") continue;
        return { type: "launch", carrierId: carrier.id, unitId: aircraft.id, path: command.path, action: command.action };
      }
    }
    return null;
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

  /**
   * Whether a loaded transport that lacks the fuel for its trip should go home to refuel first: only
   * when a full tank, less the way back out from home, is clearly more than it has now. So one that
   * set out on a full tank keeps going.
   */
  private shouldTopUp(unit: Unit, homeward: number, fuelHome: number): boolean {
    if (!this.w.topUpTransports || !Number.isFinite(homeward) || homeward === 0 || unit.fuel < fuelHome) return false;
    return unit.fuel < stats.maxFuel(this.state, unit) - fuelHome - 3 * stats.fuelPerDay(this.state, unit);
  }

  private plan(unit: Unit): Plan {
    // Heading home off the map (23-survival §5c): make for the nearest square on its edge.
    if (unit.homeward === true) return this.advance(unit, this.mapEdge(), "mapEdge");
    const def = defOf(unit.type);
    const home = this.repairTiles(unit);
    // A transport with passengers presses on while it has the fuel to land them and get back to one
    // of our ports or airfields, or once the landing is nearer than home and within reach, rather
    // than turning for home just short of it (09-ai §4b, §4c).
    if ((isLandingCraft(unit.type) || isAirTransport(unit.type)) && unit.cargo.length > 0) {
      const ferry = this.planFerry(unit);
      if (ferry.kind === "idle" && ferry.hold) return ferry;
      if (ferry.kind === "advance") {
        const here = this.index(unit.pos);
        const trip = this.distances(unit, ferry.goals, `trip${unit.id}`)[here] ?? Infinity;
        const homeward = home.length > 0 ? (this.distances(unit, home, "repair")[here] ?? Infinity) : Infinity;
        const back = home.length > 0 ? trip + homeward : 0;
        const fuelFor = (steps: number) =>
          stats.moveFuel(this.state, unit, steps) + Math.ceil(steps / Math.max(1, stats.movePoints(this.state, unit))) * stats.fuelPerDay(this.state, unit);
        if (unit.fuel >= fuelFor(trip + back) || (trip <= homeward && unit.fuel >= fuelFor(trip))) return ferry;
        // Not the fuel for this trip: top up first, when a port or airfield would leave it with
        // clearly more than it has now (09-ai §4d). One that has just refuelled goes regardless.
        if (this.shouldTopUp(unit, homeward, fuelFor(homeward))) return { kind: "retreat", dist: this.distances(unit, home, "repair") };
      }
    }
    const homeward = this.headingHome(unit, home);
    if (homeward) return { kind: "retreat", dist: homeward };

    // A map plan's orders come next (22-campaign §6).
    const ordered = this.mapPlan?.goals?.(this.state, unit);
    if (ordered) return this.advance(unit, ordered, `plan${unit.id}:${ordered.map((p) => this.index(p)).join(",")}`);

    if (isLandingCraft(unit.type) || isAirTransport(unit.type)) {
      // An empty transport under half a tank refuels before it goes to collect anyone (09-ai §4d).
      if (this.w.topUpTransports && unit.cargo.length === 0 && home.length > 0 && unit.fuel < stats.maxFuel(this.state, unit) / 2) {
        const dist = this.distances(unit, home, "repair");
        const homeward = dist[this.index(unit.pos)] ?? Infinity;
        if (homeward > 0 && Number.isFinite(homeward)) return { kind: "retreat", dist };
      }
      return this.planFerry(unit);
    }
    if (isCarrier(unit.type)) return this.planCarrier(unit);
    if (isSupplyShip(unit.type)) return this.planSupplyShip(unit);

    // The guard of an objective we have to keep goes to stand on it, and stays (09-ai §4d).
    const post = this.guardPosts().get(unit.id);
    if (post) return post.x === unit.pos.x && post.y === unit.pos.y ? HOLD : this.advance(unit, [post], `post${unit.id}`);

    // A land unit with nothing left to do on its landmass heads for a transport (09-ai §4b).
    if (this.isStranded(unit)) {
      const rides = this.rideTiles(unit);
      if (rides.length > 0) return { kind: "advance", goals: rides, dist: this.distances(unit, rides, `rides${unit.id}`), embark: true };
    }

    // A Halftrack posted to a unit that can't get to a property to rearm stays beside it (09-ai §4j),
    // off the track where it can, so it doesn't stand in a Railway Gun's way.
    const charge = def.specialActions.includes("resupply") && def.category === "land" ? this.supplyPosts().get(unit.id) : undefined;
    if (charge) {
      if (distance(unit.pos, charge.pos) === 1) return HOLD;
      const free = this.neighbors(charge.pos).filter((p) => {
        const occupant = unitAt(this.state, p);
        return (!occupant || occupant.id === unit.id) && stats.moveCost(this.state, unit, terrainAt(this.state.map, p)) !== null;
      });
      const offTrack = free.filter((p) => terrainAt(this.state.map, p) !== "railway");
      const goals = offTrack.length > 0 ? offTrack : free;
      if (goals.length > 0) return this.advance(unit, goals, `post${unit.id}`);
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

    // In fog of war our scout drives to the edge of what we can see, on the enemy's side (09-ai §4g).
    // It still takes a good shot on the way: attacks are scored against its move as for any unit.
    if (this.scoutIds().has(unit.id)) {
      const frontier = this.scoutTiles(unit);
      if (frontier.length > 0) return this.advance(unit, frontier, `scout${unit.id}`);
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
    // Nothing to shoot at: land units push on toward enemy properties; aircraft and ships wait,
    // except in fog of war, where an armed one goes looking near the enemy's properties (09-ai §4g).
    if (def.category === "land") return this.advance(unit, this.enemyProperties(), "enemyProperties");
    if (range && fogToday(this.state) && this.w.patrolInFog) return this.advance(unit, this.patrolTiles(unit), `patrol:${unit.type}`);
    return IDLE;
  }

  /**
   * A Supply Ship (09-ai §4f) sails to the nearest of our units it can reach that needs it: ships low
   * on fuel, short of ammo or damaged, and land units on the shore nearly out of fuel or ammo. A ship
   * already out of fuel comes first, since it loses HP every day it stays dry (05-supply-transport §7).
   * With nobody in need it keeps company with our warships, so it's at hand when they are. Out of supplies,
   * it goes back to a port to refill them (05-supply-transport §3b).
   */
  private planSupplyShip(unit: Unit): Plan {
    if (unit.ammo <= 0) {
      const ports = this.repairTiles(unit);
      return ports.length > 0 ? { kind: "retreat", dist: this.distances(unit, ports, "repair") } : IDLE;
    }
    const mine = this.state.units.filter((u) => u.owner === this.me && u.id !== unit.id && !isSupplyShip(u.type));
    const needs = (u: Unit) => {
      const def = defOf(u.type);
      if (def.category === "air") return false;
      // Land units only when they're nearly dry: they mostly have Halftracks and cities.
      if (def.category === "land") return u.fuel <= stats.maxFuel(this.state, u) / 4 || (def.primaryWeapon !== null && u.ammo === 0);
      const short = u.fuel <= stats.maxFuel(this.state, u) * this.w.supplyFuelShare || u.ammo < stats.maxAmmo(this.state, u);
      return short || displayHp(u.hp) < 10;
    };
    const reachable = (u: Unit) => this.neighbors(u.pos).filter((p) => {
      const occupant = unitAt(this.state, p);
      return (!occupant || occupant.id === unit.id) && stats.moveCost(this.state, unit, terrainAt(this.state.map, p)) !== null;
    });
    const dry = mine.filter((u) => defOf(u.type).category === "naval" && u.fuel === 0).flatMap(reachable);
    const rescue = this.advance(unit, dry, `rescue${unit.id}`);
    // Only if it can get there: otherwise it helps whoever else it can reach.
    if (rescue.kind === "advance" && Number.isFinite(rescue.dist[this.index(unit.pos)] ?? Infinity)) return rescue;
    const wanting = mine.filter(needs).flatMap(reachable);
    if (wanting.length > 0) return this.advance(unit, wanting, `supply${unit.id}`);
    const fleet = mine.filter((u) => defOf(u.type).category === "naval" && defOf(u.type).range !== null).flatMap(reachable);
    return fleet.length > 0 ? this.advance(unit, fleet, `fleet${unit.id}`) : IDLE;
  }

  /**
   * The distances home if this unit should head there now, or null: at 3 HP or less, out of ammo with
   * no second weapon, or with fuel only just enough for the trip (09-ai §4, §4b).
   */
  protected headingHome(unit: Unit, home: readonly Point[] = this.repairTiles(unit)): Float64Array | null {
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

  /**
   * Where an armed aircraft or ship with nothing in sight patrols to in fog of war (09-ai §4g): the
   * enemy's properties and the squares next to them that it can enter, so ships come in along the
   * coast. Out of the AI's sight, since there's nothing to look for where it can already see.
   */
  private patrolTiles(unit: Unit): Point[] {
    const tiles = new Map<number, Point>();
    for (const property of this.enemyProperties()) {
      for (const p of [property, ...this.neighbors(property)]) {
        if (tileInSight(this.state, p, this.me) || stats.moveCost(this.state, unit, terrainAt(this.state.map, p)) === null) continue;
        tiles.set(this.index(p), p);
      }
    }
    return [...tiles.values()];
  }

  /**
   * Where a scout heads (09-ai §4g): the tiles just out of sight, next to ones we can see, that it
   * can enter and that are nearer the enemy's properties than it is now. Going there shows us
   * what's beyond, so the edge moves on ahead of it.
   */
  private scoutTiles(unit: Unit): Point[] {
    const { width, height } = this.state.map;
    const theirs = this.enemyProperties();
    const nearest = (p: Point) => theirs.reduce((best, q) => Math.min(best, distance(p, q)), Infinity);
    const ahead = nearest(unit.pos);
    const tiles: Point[] = [];
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const p = { x, y };
        if (tileInSight(this.state, p, this.me) || !this.neighbors(p).some((q) => tileInSight(this.state, q, this.me))) continue;
        if (stats.moveCost(this.state, unit, terrainAt(this.state.map, p)) === null) continue;
        if (theirs.length > 0 && nearest(p) >= ahead) continue;
        tiles.push(p);
      }
    }
    return tiles;
  }

  /** Every square on the map's edge, where a unit heading home leaves (23-survival §5c). */
  private mapEdge(): Point[] {
    const { width, height } = this.state.map;
    const edge: Point[] = [];
    for (let x = 0; x < width; x++) edge.push({ x, y: 0 }, { x, y: height - 1 });
    for (let y = 1; y < height - 1; y++) edge.push({ x: 0, y }, { x: width - 1, y });
    return edge;
  }

  protected advance(unit: Unit, goals: readonly Point[], key: string, offsets?: readonly number[]): Plan {
    if (goals.length === 0) return IDLE;
    return { kind: "advance", goals, dist: this.distances(unit, goals, key, false, offsets), embark: false };
  }

}

/** For tests: every candidate for this unit with its score, best first. */
export function scoreUnitCommands(state: GameState, unit: Unit, weights: GreedyWeights = GREEDY_WEIGHTS, mapPlan: MapPlan | null = null): Scored[] {
  return new Brain(state, weights, mapPlan).scoredCommands(unit);
}
