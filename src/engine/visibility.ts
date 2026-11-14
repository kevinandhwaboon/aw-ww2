// What each side can see (05-supply-transport §9). There's no fog of war yet: everything is visible
// except a submerged submarine, which the other side sees only while one of its units is next to it.

import type { GameEvent } from "./commands";
import type { GameState, PlayerId, Unit, UnitId } from "./state";

const sideOf = (state: GameState, player: PlayerId) => state.players[player]?.side;

/**
 * Whether this unit is hidden from the viewer: a submerged submarine of the other side with none of
 * the viewer's side's units on a tile next to it (05-supply-transport §9).
 */
export function isHiddenFrom(state: GameState, unit: Unit, viewer: PlayerId): boolean {
  if (unit.submerged !== true) return false;
  const side = sideOf(state, viewer);
  if (sideOf(state, unit.owner) === side) return false;
  return !state.units.some(
    (u) => sideOf(state, u.owner) === side && Math.abs(u.pos.x - unit.pos.x) + Math.abs(u.pos.y - unit.pos.y) === 1,
  );
}

/**
 * The game as the viewer sees it: the same state without the units hidden from them. The screen and
 * the AI plan from this; commands still go to the engine with the real state.
 */
export function stateSeenBy(state: GameState, viewer: PlayerId): GameState {
  const units = state.units.filter((u) => !isHiddenFrom(state, u, viewer));
  return units.length === state.units.length ? state : { ...state, units };
}

/** The ids of the units hidden from the viewer. */
export function hiddenUnitIds(state: GameState, viewer: PlayerId): ReadonlySet<UnitId> {
  return new Set(state.units.filter((u) => isHiddenFrom(state, u, viewer)).map((u) => u.id));
}

/** The unit an event is only about, for events that don't show another unit: moves, waits, repairs and the like. */
function soleSubject(event: GameEvent): UnitId | null {
  switch (event.type) {
    case "unitMoved":
    case "unitWaited":
    case "unitRepaired":
    case "unitResupplied":
    case "unitOutOfFuel":
    case "unitDived":
      return event.unitId;
    default:
      return null;
  }
}

/**
 * What the viewer gets to watch of a command's events (05-supply-transport §9). Events that only
 * concern a unit hidden from them before the command (a submerged submarine moving, waiting, being
 * repaired) are left out. A hidden unit that shows itself (it attacks, surfaces, or ambushes a unit)
 * is put into `before` where it ends its move, so the scene can draw it there; `revealed` lists them.
 */
export function eventsSeenBy(
  before: GameState,
  events: readonly GameEvent[],
  viewer: PlayerId,
): { readonly before: GameState; readonly events: readonly GameEvent[]; readonly revealed: readonly UnitId[] } {
  const hidden = hiddenUnitIds(before, viewer);
  if (hidden.size === 0) return { before: stateSeenBy(before, viewer), events, revealed: [] };
  const shown: GameEvent[] = [];
  const revealed = new Set<UnitId>();
  const endOfMove = new Map<UnitId, GameEvent & { type: "unitMoved" }>();
  for (const event of events) {
    const subject = soleSubject(event);
    if (subject !== null && hidden.has(subject)) {
      if (event.type === "unitMoved") endOfMove.set(subject, event);
      continue;
    }
    if (event.type === "combat") {
      for (const id of [event.attacker.unitId, event.defender.unitId]) if (hidden.has(id)) revealed.add(id);
    }
    if (event.type === "unitSurfaced" && hidden.has(event.unitId)) revealed.add(event.unitId);
    if (event.type === "unitAmbushed" && hidden.has(event.by)) revealed.add(event.by);
    shown.push(event);
  }
  const units = before.units.flatMap((u) => {
    if (!hidden.has(u.id)) return [u];
    if (!revealed.has(u.id)) return [];
    const path = endOfMove.get(u.id)?.path;
    return [{ ...u, pos: path?.[path.length - 1] ?? u.pos }];
  });
  return { before: { ...before, units }, events: shown, revealed: [...revealed] };
}
