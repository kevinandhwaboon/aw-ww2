// What each side can see (19-fog-of-war, 05-supply-transport §9). Without fog of war everything is
// visible except a submerged submarine, which the other side sees only while one of its units is next
// to it. With fog, each side sees only the tiles its units and properties see.

import type { GameEvent } from "./commands";
import type { Side } from "./data/nations";
import { terrainDef } from "./data/terrain";
import { UNITS } from "./data/units";
import type { Point } from "./map";
import { CAPTURE_POINTS, type GameState, type PlayerId, type Unit, type UnitId } from "./state";
import * as stats from "./stats";
import { fogToday } from "./weather";

const sideOf = (state: GameState, player: PlayerId): Side | undefined => state.players[player]?.side;

/** How well a side sees a tile. */
const OUT_OF_SIGHT = 0;
const IN_SIGHT = 1;
/** Next to (or under) one of the side's units: close enough to see into hiding terrain (19-fog-of-war §3). */
const CLOSE = 2;

const STEPS: readonly Point[] = [
  { x: 0, y: 0 },
  { x: 0, y: -1 },
  { x: 1, y: 0 },
  { x: 0, y: 1 },
  { x: -1, y: 0 },
];

// GameState is never changed in place, so what a side sees can be worked out once per state and side.
// Moves and the AI ask about many tiles of the same state.
interface Sight {
  /** Each tile's sight level, in row-major order. */
  readonly tiles: Uint8Array;
  /** 1 where the side's radar sees aircraft (19-fog-of-war §2a), whatever the tile's sight level. */
  readonly air: Uint8Array;
}
const sightCache = new WeakMap<GameState, Map<Side | undefined, Sight>>();

/** Marks every tile within `range` steps of p. */
function markDiamond(tiles: Uint8Array, width: number, height: number, p: Point, range: number, level: number): void {
  for (let dy = -range; dy <= range; dy++) {
    const y = p.y + dy;
    if (y < 0 || y >= height) continue;
    const across = range - Math.abs(dy);
    for (let x = Math.max(0, p.x - across); x <= Math.min(width - 1, p.x + across); x++) {
      const i = y * width + x;
      if ((tiles[i] ?? 0) < level) tiles[i] = level;
    }
  }
}

/**
 * What this side sees (19-fog-of-war §2): each tile is in sight within each of its units' vision,
 * counted in steps, and on its own properties; close next to its units. Units aboard a transport see
 * nothing. Separately, the tiles where its radar sees aircraft (§2a).
 */
function sightOf(state: GameState, side: Side | undefined): Sight {
  let bySide = sightCache.get(state);
  const cached = bySide?.get(side);
  if (cached) return cached;
  const { width, height } = state.map;
  const tiles = new Uint8Array(width * height);
  const air = new Uint8Array(width * height);
  for (const property of state.properties) {
    if (property.owner !== null && sideOf(state, property.owner) === side) tiles[property.pos.y * width + property.pos.x] = IN_SIGHT;
  }
  for (const unit of state.units) {
    if (sideOf(state, unit.owner) !== side) continue;
    markDiamond(tiles, width, height, unit.pos, stats.vision(state, unit), IN_SIGHT);
    const radar = stats.airVision(state, unit);
    if (radar > 0) markDiamond(air, width, height, unit.pos, radar, 1);
    for (const step of STEPS) {
      const x = unit.pos.x + step.x;
      const y = unit.pos.y + step.y;
      if (x >= 0 && x < width && y >= 0 && y < height) tiles[y * width + x] = CLOSE;
    }
  }
  const sight = { tiles, air };
  if (!bySide) sightCache.set(state, (bySide = new Map<Side | undefined, Sight>()));
  bySide.set(side, sight);
  return sight;
}

/**
 * The squares where this unit sees enemy aircraft by radar (19-fog-of-war §2a): every tile within its
 * air vision, counted in steps, in row-major order. Empty for a unit without radar. For showing the
 * player how far a Radar Station sees.
 */
export function airSightTiles(state: GameState, unit: Unit): Point[] {
  const range = stats.airVision(state, unit);
  if (range <= 0) return [];
  const { width, height } = state.map;
  const tiles = new Uint8Array(width * height);
  markDiamond(tiles, width, height, unit.pos, range, 1);
  const out: Point[] = [];
  tiles.forEach((v, i) => {
    if (v === 1) out.push({ x: i % width, y: Math.floor(i / width) });
  });
  return out;
}

const isAir = (unit: Unit) => UNITS[unit.type].category === "air";

/** Whether any unit of this side is on a tile next to p (not diagonally). Fast enough without fog. */
function sideIsNextTo(state: GameState, side: Side | undefined, p: Point): boolean {
  return state.units.some((u) => sideOf(state, u.owner) === side && Math.abs(u.pos.x - p.x) + Math.abs(u.pos.y - p.y) === 1);
}

/**
 * Whether this unit is hidden from the viewer. Without fog of war: a submerged submarine of the
 * other side with none of the viewer's side's units next to it (05-supply-transport §9). With fog:
 * also any unit of the other side on a tile out of the viewer's side's sight, or on hiding terrain
 * (Forest, Bocage, Reef) with none of their units next to it, unless it's an aircraft (19-fog-of-war §3).
 */
export function isHiddenFrom(state: GameState, unit: Unit, viewer: PlayerId): boolean {
  const side = sideOf(state, viewer);
  if (sideOf(state, unit.owner) === side) return false;
  if (!fogToday(state)) return unit.submerged === true && !sideIsNextTo(state, side, unit.pos);
  const i = unit.pos.y * state.map.width + unit.pos.x;
  const sight = sightOf(state, side);
  const level = sight.tiles[i] ?? OUT_OF_SIGHT;
  if (unit.submerged === true) return level < CLOSE;
  // Radar sees aircraft out of sight, though not the tile they fly over (19-fog-of-war §2a).
  if (isAir(unit)) return level === OUT_OF_SIGHT && sight.air[i] !== 1;
  if (level === OUT_OF_SIGHT) return true;
  const terrain = state.map.terrain[i];
  return terrain !== undefined && terrainDef(terrain).hidesUnits === true && level < CLOSE;
}

/**
 * The tiles the viewer's side has in sight, by tile index (19-fog-of-war §2), or null without fog of
 * war, when every tile is. A tile in sight can still hide a unit (§3).
 */
export function tilesInSight(state: GameState, viewer: PlayerId): ReadonlySet<number> | null {
  if (!fogToday(state)) return null;
  const sight = sightOf(state, sideOf(state, viewer)).tiles;
  const out = new Set<number>();
  sight.forEach((level, i) => {
    if (level !== OUT_OF_SIGHT) out.add(i);
  });
  return out;
}

/** Whether the viewer's side has this tile in sight (always, without fog of war). */
export function tileInSight(state: GameState, p: Point, viewer: PlayerId): boolean {
  if (!fogToday(state)) return true;
  return (sightOf(state, sideOf(state, viewer)).tiles[p.y * state.map.width + p.x] ?? OUT_OF_SIGHT) !== OUT_OF_SIGHT;
}

/**
 * Whether going from `before` to `after` showed the viewer something they couldn't see: a tile coming
 * into sight, or a hidden unit coming into view. Undo is cleared then (19-fog-of-war §7).
 */
export function revealsAnything(before: GameState, after: GameState, viewer: PlayerId): boolean {
  if (fogToday(before)) {
    const was = sightOf(before, sideOf(before, viewer)).tiles;
    const now = sightOf(after, sideOf(after, viewer)).tiles;
    if (now.some((level, i) => level !== OUT_OF_SIGHT && was[i] === OUT_OF_SIGHT)) return true;
  }
  const hidden = hiddenUnitIds(before, viewer);
  return after.units.some((u) => hidden.has(u.id) && !isHiddenFrom(after, u, viewer));
}

/**
 * The game as the viewer sees it: the same state without the units hidden from them, and without the
 * capture or bridge-building progress of those units (19-fog-of-war §4). The screen and the AI plan
 * from this; commands still go to the engine with the real state.
 */
export function stateSeenBy(state: GameState, viewer: PlayerId): GameState {
  const hidden = hiddenUnitIds(state, viewer);
  if (hidden.size === 0) return state;
  const unseenWork = (unit: UnitId | null) => unit !== null && hidden.has(unit);
  return {
    ...state,
    units: state.units.filter((u) => !hidden.has(u.id)),
    properties: state.properties.some((p) => unseenWork(p.capturingUnit))
      ? state.properties.map((p) => (unseenWork(p.capturingUnit) ? { ...p, capturePoints: CAPTURE_POINTS, capturingUnit: null } : p))
      : state.properties,
    bridgeWorks: state.bridgeWorks.some((w) => unseenWork(w.unit)) ? state.bridgeWorks.filter((w) => !unseenWork(w.unit)) : state.bridgeWorks,
  };
}

/** The ids of the units hidden from the viewer. */
export function hiddenUnitIds(state: GameState, viewer: PlayerId): ReadonlySet<UnitId> {
  return new Set(state.units.filter((u) => isHiddenFrom(state, u, viewer)).map((u) => u.id));
}

/** The unit an event is only about, for events that don't show another unit: waits, repairs and the like. */
function soleSubject(event: GameEvent): UnitId | null {
  switch (event.type) {
    case "unitWaited":
    case "unitRepaired":
    case "unitResupplied":
    case "unitOutOfFuel":
    case "unitStranded":
    case "unitAdrift":
    case "unitDived":
    case "unitLeft":
    case "unitEvacuated":
    case "unitHomeward":
    case "captureProgress":
    case "propertyCaptured":
    case "bridgeRebuildProgress":
      return event.unitId;
    default:
      return null;
  }
}

/**
 * What the viewer gets to watch of a command's events (19-fog-of-war §7, 05-supply-transport §9).
 * `before` and `after` are the real states either side of the command.
 *
 * - A move plays only where the unit can be seen: a unit coming out of hiding appears on the first
 *   tile of its path in sight and walks from there; one going into hiding walks to its last tile in
 *   sight (and is gone when the new state is drawn).
 * - Events only about a unit the viewer can't see (waits, repairs, captures) are left out.
 * - A hidden unit that shows itself (it surfaces, or ambushes a unit) is put into `before` where it
 *   is, so the scene can draw it there; `revealed` lists every unit put into `before`.
 * - A unit firing from out of sight stays hidden: its combat event is kept, but it isn't put into
 *   `before` (19-fog-of-war §6).
 */
export function eventsSeenBy(
  before: GameState,
  after: GameState,
  events: readonly GameEvent[],
  viewer: PlayerId,
): { readonly before: GameState; readonly events: readonly GameEvent[]; readonly revealed: readonly UnitId[] } {
  const hidden = hiddenUnitIds(before, viewer);
  const seenBefore = stateSeenBy(before, viewer);
  if (hidden.size === 0 && !fogToday(before)) return { before: seenBefore, events, revealed: [] };

  /** Units put into `before` where the viewer first sees them. */
  const placed = new Map<UnitId, Unit>();
  /** Units that walked out of sight: what they do next isn't shown. */
  const gone = new Set<UnitId>();
  const afterUnit = (id: UnitId) => after.units.find((u) => u.id === id);
  const beforeUnit = (id: UnitId): Unit | undefined =>
    before.units.find((u) => u.id === id) ?? before.units.flatMap((u) => u.cargo).find((c) => c.id === id);
  /** The unit carrying this one in `before`, if it's aboard something. */
  const carrierOf = (id: UnitId) => before.units.find((u) => u.cargo.some((c) => c.id === id));
  const isOnScreen = (id: UnitId): boolean => {
    if (gone.has(id)) return false;
    if (placed.has(id)) return true;
    const carrier = carrierOf(id);
    if (carrier) return isOnScreen(carrier.id);
    return before.units.some((u) => u.id === id) && !hidden.has(id);
  };
  /** Shows a unit the viewer couldn't see before, where it is now, if they can see it now. */
  const bringOnScreen = (id: UnitId): boolean => {
    if (isOnScreen(id)) return true;
    const now = afterUnit(id);
    const was = beforeUnit(id);
    if (!now || !was || isHiddenFrom(after, now, viewer)) return false;
    placed.set(id, { ...was, pos: now.pos });
    return true;
  };

  const shown: GameEvent[] = [];
  for (const event of events) {
    switch (event.type) {
      case "unitMoved": {
        const unit = beforeUnit(event.unitId);
        if (!unit) continue;
        // Seen from where the viewer's side stands as the move starts.
        const inView = event.path.map((p) => !isHiddenFrom(before, { ...unit, pos: p }, viewer));
        const first = inView.indexOf(true);
        const last = inView.lastIndexOf(true);
        if (first < 0) {
          gone.add(unit.id);
          continue;
        }
        const start = event.path[first];
        if (start && (first > 0 || !isOnScreen(unit.id))) placed.set(unit.id, { ...unit, pos: start });
        if (last > first) shown.push({ ...event, path: event.path.slice(first, last + 1) });
        if (last < event.path.length - 1) gone.add(unit.id);
        continue;
      }
      case "unitLaunched":
        if (isOnScreen(event.carrierId)) shown.push(event);
        continue;
      case "combat": {
        const attacker = bringOnScreen(event.attacker.unitId);
        const defender = bringOnScreen(event.defender.unitId);
        if (attacker || defender) shown.push(event);
        continue;
      }
      case "fortAttacked":
        if (isOnScreen(event.attackerId) || tileInSight(before, event.pos, viewer)) shown.push(event);
        continue;
      case "unitAmbushed":
        if (bringOnScreen(event.by) || bringOnScreen(event.unitId)) shown.push(event);
        continue;
      case "unitSurfaced":
        if (bringOnScreen(event.unitId)) shown.push(event);
        continue;
      case "unitBuilt": {
        const built = afterUnit(event.unitId);
        if (built && !isHiddenFrom(after, built, viewer)) shown.push(event);
        continue;
      }
      case "unitsArrived": {
        // The banner always shows, since the forecast is public (23-survival §4); only units in sight are named.
        const seen = event.units.filter((u) => {
          const unit = afterUnit(u.unitId);
          return unit !== undefined && !isHiddenFrom(after, unit, viewer);
        });
        shown.push({ ...event, units: seen });
        continue;
      }
      case "unitLoaded":
        if (isOnScreen(event.unitId) || isOnScreen(event.transportId)) shown.push(event);
        continue;
      case "unitUnloaded": {
        const landed = afterUnit(event.unitId);
        if (isOnScreen(event.transportId) && landed && !isHiddenFrom(after, landed, viewer)) shown.push(event);
        continue;
      }
      case "unitJoined":
        if (isOnScreen(event.targetId)) shown.push(event);
        continue;
      default: {
        const subject = soleSubject(event);
        if (subject === null || isOnScreen(subject)) shown.push(event);
      }
    }
  }
  if (placed.size === 0) return { before: seenBefore, events: shown, revealed: [] };
  const units = [...seenBefore.units.filter((u) => !placed.has(u.id)), ...placed.values()].sort((a, b) => a.id - b.id);
  return { before: { ...seenBefore, units }, events: shown, revealed: [...placed.keys()] };
}
