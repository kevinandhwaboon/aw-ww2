// What the computer remembers of enemy units it saw in fog of war (09-ai §4g, 19-fog-of-war §8).
//
// A hint, not part of the game: it lives in the AI player object, so it's lost if the game is
// reloaded, and the AI then plays from what it sees, as it would anyway (09-ai §3).

import { fogToday, isHiddenFrom, unitAt, type GameState, type PlayerId, type Unit, type UnitId } from "../engine";

interface Sighting {
  readonly unit: Unit;
  /** The day it was last seen. */
  readonly day: number;
}

export class EnemyMemory {
  private readonly byPlayer = new Map<PlayerId, Map<UnitId, Sighting>>();

  /** `days`: how long an enemy is remembered after it was last seen; 0 remembers nothing. */
  constructor(private readonly days: number) {}

  /**
   * The game as player `me` believes it is: what it sees, plus each enemy unit it saw within the
   * last `days` days and can't see now, where it last saw it. An enemy is forgotten once the AI can
   * see the tile it was on and it isn't there. Only on a day with fog of war; otherwise the state as given.
   *
   * A remembered unit is only ever on a tile the AI can't see into, so the engine's helpers treat it
   * as hidden: moves can pass through it and it can't be attacked, as for any hidden unit, and every
   * command the AI picks is one the engine accepts.
   */
  believe(state: GameState, me: PlayerId): GameState {
    if (!fogToday(state) || this.days <= 0) return state;
    const side = state.players[me]?.side;
    let memory = this.byPlayer.get(me);
    if (!memory) this.byPlayer.set(me, (memory = new Map<UnitId, Sighting>()));
    const present = new Set<UnitId>();
    for (const unit of state.units) {
      present.add(unit.id);
      if (state.players[unit.owner]?.side !== side) memory.set(unit.id, { unit, day: state.day });
    }
    const remembered: Unit[] = [];
    for (const [id, { unit, day }] of memory) {
      if (present.has(id)) continue;
      const forgotten = state.day - day > this.days || unitAt(state, unit.pos) !== undefined || !isHiddenFrom(state, unit, me);
      if (forgotten) memory.delete(id);
      else remembered.push(unit);
    }
    if (remembered.length === 0) return state;
    return { ...state, units: [...state.units, ...remembered].sort((a, b) => a.id - b.id) };
  }
}
