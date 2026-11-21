// The endless waves of a survival map (23-survival §4). Each wave is generated from the map's
// pattern set with the game's seeded RNG when the wave before it arrives, so it is always known in
// advance (the forecast) and the same seed always gives the same waves. Generated waves are ordinary
// arrivals (engine/arrivals.ts).

import { WAVE_PATTERNS, WAVE_PATTERN_SET_IDS, type WavePattern, type WaveUnitEntry } from "./data/waves";
import { unitProblem } from "./arrivals";
import { inBounds, type GameMap } from "./map";
import { nextFloat, type RngState } from "./rng";
import type { Arrival, ArrivingUnit, ConvoyPlan, GameState, PlayerId, WaveEdge, WaveGenerator } from "./state";
import * as stats from "./stats";

/** A generated wave's value in funds: the first one's budget, `growth` bigger each wave after. */
export function waveBudget(generator: WaveGenerator, wave: number): number {
  return Math.round(generator.budget * (1 + generator.growth) ** (wave - generator.firstWave));
}

/** The day a generated wave is due (23-survival §4, §10 Q1: on fixed days). */
export function waveDay(generator: WaveGenerator, wave: number): number {
  return generator.firstDay + (wave - generator.firstWave) * generator.everyDays;
}

/** Whether a generated wave has a convoy for the defender with it. */
export function hasConvoy(convoy: ConvoyPlan, wave: number): boolean {
  return wave >= convoy.fromWave && (wave - convoy.fromWave) % convoy.every === 0;
}

const isWhole = (n: number, least: number) => Number.isInteger(n) && n >= least;

/** Why this generator can't be in a scenario, or null if it can. */
export function generatorProblem(generator: WaveGenerator, map: GameMap, playerCount: number): string | null {
  const { player, firstWave, firstDay, everyDays, budget, growth, edges, unitCap, convoy } = generator;
  const isPlayer = (id: PlayerId) => isWhole(id, 0) && id < playerCount;
  if (!isPlayer(player)) return `unknown player ${player}`;
  if (!WAVE_PATTERN_SET_IDS.includes(generator.patterns)) return `unknown pattern set ${generator.patterns}`;
  if (!isWhole(firstWave, 1)) return `"firstWave" must be 1 or more`;
  if (!isWhole(firstDay, 1)) return `"firstDay" must be day 1 or later`;
  if (!isWhole(everyDays, 1)) return `"everyDays" must be 1 or more`;
  if (!(budget > 0) || !Number.isFinite(budget)) return `"budget" must be more than 0`;
  if (!(growth >= 0) || !Number.isFinite(growth)) return `"growth" can't be negative`;
  if (unitCap !== undefined && !isWhole(unitCap, 1)) return `"unitCap" must be 1 or more`;
  if (edges.length === 0) return "list at least one edge";
  for (const edge of edges) {
    if (edges.filter((e) => e.name === edge.name).length > 1) return `two edges are called ${edge.name}`;
    if (edge.zone.length === 0) return `edge ${edge.name}: list at least one square`;
    const outside = edge.zone.find((p) => !inBounds(map, p));
    if (outside) return `edge ${edge.name}: (${outside.x}, ${outside.y}) is outside the map`;
    if (edge.fromWave !== undefined && !isWhole(edge.fromWave, 1)) return `edge ${edge.name}: "fromWave" must be 1 or more`;
  }
  if (openEdges(generator, firstWave).length === 0) return `no edge is open for wave ${firstWave}`;
  if (convoy) {
    if (!isPlayer(convoy.player)) return `convoy: unknown player ${convoy.player}`;
    if (!isWhole(convoy.fromWave, 1) || !isWhole(convoy.every, 1)) return `convoy: "fromWave" and "every" must be 1 or more`;
    if (!edges.some((e) => e.name === convoy.edge)) return `convoy: no edge called ${convoy.edge}`;
    if (convoy.units.length === 0) return "convoy: list at least one unit";
    for (const unit of convoy.units) {
      const problem = unitProblem(unit);
      if (problem) return `convoy: ${problem}`;
    }
  }
  return null;
}

const openEdges = (generator: WaveGenerator, wave: number) => generator.edges.filter((e) => (e.fromWave ?? 1) <= wave);

/** Picks one of `items` by the RNG, each as likely as its weight. */
function pick<T>(items: readonly T[], weight: (item: T) => number, rng: RngState): { item: T | undefined; rng: RngState } {
  const total = items.reduce((sum, item) => sum + weight(item), 0);
  const roll = nextFloat(rng);
  let left = roll.value * total;
  for (const item of items) {
    left -= weight(item);
    if (left < 0) return { item, rng: roll.rng };
  }
  return { item: items[items.length - 1], rng: roll.rng };
}

/**
 * The units a pattern buys with this wave's budget, group by group, and the edge each group comes
 * from: a different open edge for each where the pattern allows it. Each entry gets its share of the
 * budget (shares of the entries in play scaled to add up to 1) and buys as many whole units, with
 * their passengers, as that pays for, at the waves' player's prices (the modifier layer). What's left
 * over then buys more, one unit at a time, biggest share first, while any entry is still affordable,
 * so a wave is never empty while its budget can pay for any of its units.
 */
function buyWave(state: GameState, generator: WaveGenerator, pattern: WavePattern, wave: number, rng: RngState) {
  const budget = waveBudget(generator, wave);
  const inPlay = (entry: { readonly fromWave?: number }) => (entry.fromWave ?? 1) <= wave;
  const cost = (type: ArrivingUnit["type"]) => stats.unitCost(state, generator.player, type);
  const open = openEdges(generator, wave);
  const used = new Set<string>();
  let current = rng;

  const groups: { edge: WaveEdge; units: ArrivingUnit[] }[] = [];
  const entries: { entry: WaveUnitEntry; group: number; price: number; count: number }[] = [];
  for (const part of pattern.parts) {
    const allowed = open.filter((e) => part.edges.includes(e.name));
    const fresh = allowed.filter((e) => !used.has(e.name));
    const choices = fresh.length > 0 ? fresh : allowed.length > 0 ? allowed : open;
    const chosen = pick(choices, () => 1, current);
    current = chosen.rng;
    if (!chosen.item) continue;
    used.add(chosen.item.name);
    groups.push({ edge: chosen.item, units: [] });
    for (const entry of part.units.filter(inPlay)) {
      const price = cost(entry.type) + (entry.cargo ?? []).reduce((sum, type) => sum + cost(type), 0);
      if (price > 0) entries.push({ entry, group: groups.length - 1, price, count: 0 });
    }
  }

  const totalShare = entries.reduce((sum, e) => sum + e.entry.share, 0);
  let left = budget;
  for (const e of entries) {
    e.count = totalShare > 0 ? Math.floor((budget * e.entry.share) / totalShare / e.price) : 0;
    left -= e.count * e.price;
  }
  const byShare = [...entries].sort((a, b) => b.entry.share - a.entry.share);
  for (let bought = true; bought; ) {
    bought = false;
    for (const e of byShare) {
      if (e.price > left) continue;
      e.count++;
      left -= e.price;
      bought = true;
    }
  }

  for (const { entry, group, count } of entries) {
    const unit: ArrivingUnit = {
      type: entry.type,
      ...(entry.cargo ? { cargo: entry.cargo.map((type) => ({ type })) } : {}),
      ...(entry.sortieTurns === undefined ? {} : { sortieTurns: entry.sortieTurns }),
      ...(entry.leavesWhenEmpty ? { leavesWhenEmpty: true } : {}),
    };
    for (let i = 0; i < count; i++) groups[group]?.units.push(unit);
  }
  return { groups: groups.filter((g) => g.units.length > 0), rng: current };
}

/**
 * Makes sure the next wave is known: once no wave of the generator's player is still to come, the
 * next generated wave is added to the arrivals, with the defender's convoy when one is due
 * (23-survival §4). Runs at the start of every turn, after arrivals.
 */
export function generateWaves(state: GameState): GameState {
  const generator = state.waveGenerator;
  if (!generator) return state;
  const comingWave = state.arrivals.some((a) => a.player === generator.player && a.wave !== undefined && a.wave > state.wave);
  if (comingWave) return state;
  const wave = Math.max(state.wave + 1, generator.firstWave);
  const day = waveDay(generator, wave);
  const patterns = WAVE_PATTERNS[generator.patterns].filter((p) => (p.fromWave ?? 1) <= wave && p.weight > 0);
  const chosen = pick(patterns, (p) => p.weight, state.rng);
  if (!chosen.item) return { ...state, rng: chosen.rng };
  const bought = buyWave(state, generator, chosen.item, wave, chosen.rng);
  const arrivals: Arrival[] = bought.groups.map(({ edge, units }) => ({
    day,
    player: generator.player,
    wave,
    name: chosen.item?.name ?? "",
    from: edge.name,
    zone: edge.zone,
    units,
    ...(generator.unitCap === undefined ? {} : { unitCap: generator.unitCap }),
  }));
  const { convoy } = generator;
  const convoyEdge = convoy && generator.edges.find((e) => e.name === convoy.edge);
  if (convoy && convoyEdge && hasConvoy(convoy, wave)) {
    arrivals.push({ day, player: convoy.player, name: convoy.name ?? "Convoy", from: convoyEdge.name, zone: convoyEdge.zone, units: convoy.units });
  }
  return { ...state, rng: bought.rng, arrivals: [...state.arrivals, ...arrivals] };
}

/** The next wave still to come, for the forecast (23-survival §4): the earliest by wave number. */
export function nextWave(state: GameState): readonly Arrival[] {
  const coming = state.arrivals.filter((a) => a.wave !== undefined && a.wave > state.wave);
  const first = Math.min(...coming.map((a) => a.wave ?? Infinity));
  return coming.filter((a) => a.wave === first);
}
