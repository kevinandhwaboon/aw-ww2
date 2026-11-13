// The first AI, "Greedy" (09-ai §4). Each unit in turn picks its best-scoring legal command, with no
// lookahead and no plan across units. Then it builds, then it ends the turn. Scores are in funds;
// the weights are data (ai/weights.ts).
//
// It's stateless: every call looks at the state afresh and returns one command, so saves, undo and
// replays need nothing extra (09-ai §3). Ties go to the first candidate, so it's deterministic.

import {
  displayHp,
  distance,
  launchable,
  launchProblem,
  launchState,
  movementBudget,
  stats,
  unitCommands,
  unloadTiles,
  type Command,
  type GameState,
  type Point,
  type Unit,
} from "../engine";
import {
  IDLE,
  type LaunchCommand,
  type MoveCommand,
  type Plan,
  type Scored,
  defOf,
  isAirTransport,
  isCarrier,
  isLandingCraft,
  samePoint,
} from "./greedyBase";
import { ProductionBrain } from "./greedyProduction";
import type { AiPlayer } from "./player";
import { EASY_WEIGHTS, GREEDY_WEIGHTS, type GreedyWeights } from "./weights";

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

  protected advance(unit: Unit, goals: readonly Point[], key: string, offsets?: readonly number[]): Plan {
    if (goals.length === 0) return IDLE;
    return { kind: "advance", goals, dist: this.distances(unit, goals, key, false, offsets), embark: false };
  }

}

/** For tests: every candidate for this unit with its score, best first. */
export function scoreUnitCommands(state: GameState, unit: Unit, weights: GreedyWeights = GREEDY_WEIGHTS): Scored[] {
  return new Brain(state, weights).scoredCommands(unit);
}
