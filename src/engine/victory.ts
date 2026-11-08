// Win and defeat (04-economy §8, 00-master-design §8). Each scenario lists its victory conditions;
// every condition is a rule here, so a new kind is a new entry. A condition that makes a side win
// does it by defeating everyone on the other side.

import type { GameEvent } from "./commands";
import { clearAbandonedCaptures } from "./economy";
import type { Point } from "./map";
import { tileIndex } from "./movement";
import type { Side } from "./data/nations";
import { propertyAt, type DefeatReason, type GameState, type PlayerId, type VictoryCondition } from "./state";

/** A property that just changed hands. */
interface Captured {
  readonly pos: Point;
  readonly previousOwner: PlayerId | null;
}

/** When a condition is checked, and which players it defeats. `index` is its place in the scenario's list. */
interface VictoryRule<C extends VictoryCondition> {
  afterCapture?(state: GameState, captured: Captured, condition: C): PlayerId[];
  atTurnEnd?(state: GameState, condition: C): PlayerId[];
  atDayStart?(state: GameState, condition: C, index: number): PlayerId[];
}

type Rules = { [K in VictoryCondition["type"]]: VictoryRule<Extract<VictoryCondition, { type: K }>> };

const sideOf = (state: GameState, player: PlayerId | null) => (player === null ? undefined : state.players[player]?.side);

/** Everyone still playing who isn't on this side: who loses when the side wins. */
const everyoneBut = (state: GameState, side: Side) => state.players.filter((p) => !p.defeated && p.side !== side).map((p) => p.id);

/** Whether players on this side own every one of these properties. */
export function sideOwnsAll(state: GameState, side: Side, properties: readonly Point[]): boolean {
  return properties.every((pos) => sideOf(state, propertyAt(state, pos)?.owner ?? null) === side);
}

const RULES: Rules = {
  /** Losing your HQ loses the game at once (04-economy §3). */
  hqCapture: {
    afterCapture(state, { pos, previousOwner }) {
      return previousOwner !== null && state.map.terrain[tileIndex(state, pos)] === "hq" ? [previousOwner] : [];
    },
  },
  /**
   * No units left at the end of any turn loses, but only for a player who has had some, so
   * empty-start maps still work (04-economy §8). Passengers ride inside their transport, so a
   * player's last units can't be hiding in one that was destroyed.
   */
  rout: {
    atTurnEnd(state) {
      return state.players
        .filter((p) => !p.defeated && p.hasFielded && !state.units.some((u) => u.owner === p.id))
        .map((p) => p.id);
    },
  },
  /** Owning every listed property wins at once. */
  captureProperties: {
    afterCapture(state, _captured, { side, properties }) {
      return sideOwnsAll(state, side, properties) ? everyoneBut(state, side) : [];
    },
  },
  /** Holding them at the start of enough days in a row wins; the count is kept in holdStreaks. */
  holdProperties: {
    atDayStart(state, { side, days }, index) {
      return (state.holdStreaks[index] ?? 0) >= days ? everyoneBut(state, side) : [];
    },
  },
  /** Still being in the game when the day comes wins. */
  surviveDays: {
    atDayStart(state, { side, days }) {
      const inGame = state.players.some((p) => !p.defeated && p.side === side);
      return inGame && state.day >= days ? everyoneBut(state, side) : [];
    },
  },
};

type Outcome = { state: GameState; events: GameEvent[] };

type Check = (rule: VictoryRule<VictoryCondition>, condition: VictoryCondition, index: number) => PlayerId[] | undefined;

function runRules(state: GameState, check: Check): Outcome {
  let current = state;
  const events: GameEvent[] = [];
  for (const [index, condition] of state.victoryConditions.entries()) {
    if (current.result) break;
    // Each rule only ever receives its own kind of condition.
    const rule = RULES[condition.type] as VictoryRule<VictoryCondition>;
    const losers = check(rule, condition, index) ?? [];
    const defeated = defeatPlayers(current, losers, condition.type);
    current = defeated.state;
    events.push(...defeated.events);
  }
  return { state: current, events };
}

export function checkAfterCapture(state: GameState, captured: Captured): Outcome {
  return runRules(state, (rule, condition) => rule.afterCapture?.(state, captured, condition));
}

export function checkAtTurnEnd(state: GameState): Outcome {
  return runRules(state, (rule, condition) => rule.atTurnEnd?.(state, condition));
}

/** At the start of each day from day 2: update the hold counts, then check day-based conditions. */
export function checkAtDayStart(state: GameState): Outcome {
  const holdStreaks = state.victoryConditions.map((condition, i) =>
    condition.type === "holdProperties" && sideOwnsAll(state, condition.side, condition.properties) ? (state.holdStreaks[i] ?? 0) + 1 : 0,
  );
  const counted = { ...state, holdStreaks };
  return runRules(counted, (rule, condition, index) => rule.atDayStart?.(counted, condition, index));
}

/**
 * Takes players out of the game. As in the original, their units are removed and their properties
 * become neutral. The game ends once only one side has players left.
 */
export function defeatPlayers(state: GameState, losers: readonly PlayerId[], reason: DefeatReason): Outcome {
  if (losers.length === 0) return { state, events: [] };
  const out = new Set(losers);
  const afterDefeat = clearAbandonedCaptures({
    ...state,
    players: state.players.map((p) => (out.has(p.id) ? { ...p, defeated: true } : p)),
    units: state.units.filter((u) => !out.has(u.owner)),
    properties: state.properties.map((p) => (p.owner !== null && out.has(p.owner) ? { ...p, owner: null } : p)),
  });
  const events: GameEvent[] = losers.map((player) => ({ type: "playerDefeated", player, reason }));

  const remaining = afterDefeat.players.filter((p) => !p.defeated);
  const sides = new Set(remaining.map((p) => p.side));
  const [winningSide] = sides;
  if (sides.size !== 1 || !winningSide) return { state: afterDefeat, events };

  const result = { winningSide, winners: remaining.map((p) => p.id), reason };
  return { state: { ...afterDefeat, result }, events: [...events, { type: "gameOver", result }] };
}
