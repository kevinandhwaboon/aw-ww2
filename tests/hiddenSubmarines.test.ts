import { describe, expect, it } from "vitest";
import { makeView } from "../src/ai/player";
import { apply } from "../src/engine/apply";
import type { Command, GameEvent, UnitAction } from "../src/engine/commands";
import { legalCommands } from "../src/engine/legal";
import type { Point } from "../src/engine/map";
import { moveDestinations } from "../src/engine/movement";
import type { UnitSetup } from "../src/engine/setup";
import type { GameState, Unit } from "../src/engine/state";
import { eventsSeenBy, isHiddenFrom, stateSeenBy } from "../src/engine/visibility";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });
const order = (unitId: number, path: Point[], action: UnitAction = { type: "wait" }): Command => ({ type: "move", unitId, path, action });
const row = (n: number) => P(n, 0);
const tiles = (...xs: number[]) => xs.map(row);
const u = (type: UnitSetup["type"], owner: number, x: number, y = 0): UnitSetup => ({ type, owner, pos: P(x, y) });

function must(state: GameState, command: Command) {
  const result = apply(state, command);
  if (!result.ok) throw new Error(`Rejected (${result.code}): ${result.message}`);
  return result;
}
const unit = (state: GameState, id: number): Unit => {
  const found = state.units.find((x) => x.id === id);
  if (!found) throw new Error(`No unit ${id}`);
  return found;
};
/** The same game with these units below the surface. */
const submerge = (state: GameState, ...ids: number[]): GameState => ({
  ...state,
  units: state.units.map((x) => (ids.includes(x.id) ? { ...x, submerged: true } : x)),
});
const ofType = <T extends GameEvent["type"]>(events: readonly GameEvent[], type: T) =>
  events.filter((e): e is Extract<GameEvent, { type: T }> => e.type === type);

describe("seeing submerged submarines (05-supply-transport §9)", () => {
  // Player 1's submarine at x = 4, player 0's Destroyer at x = 0.
  const game = (...extra: UnitSetup[]) => submerge(makeGame(["SSSSSSS", "SSSSSSS"], [u("submarine", 1, 4), u("destroyer", 0, 0), ...extra]), 0);

  it("a submerged submarine is hidden from the enemy while none of their units is next to it", () => {
    const state = game();
    expect(isHiddenFrom(state, unit(state, 0), 0)).toBe(true);
    expect(stateSeenBy(state, 0).units.map((x) => x.id)).toEqual([1]);
  });

  it("its own side always sees it", () => {
    const state = game();
    expect(isHiddenFrom(state, unit(state, 0), 1)).toBe(false);
    expect(stateSeenBy(state, 1)).toBe(state);
  });

  it("a submarine on the surface is seen by everyone", () => {
    const state = makeGame(["SSSSS"], [u("submarine", 1, 4), u("destroyer", 0, 0)]);
    expect(isHiddenFrom(state, unit(state, 0), 0)).toBe(false);
  });

  it("any enemy unit on a tile next to it spots it, aircraft included", () => {
    for (const spotter of [u("fighter", 0, 4, 1), u("landingCraft", 0, 3), u("destroyer", 0, 5)]) {
      const state = game(spotter);
      expect(isHiddenFrom(state, unit(state, 0), 0)).toBe(false);
    }
  });

  it("a unit two tiles away, or only diagonally next to it, doesn't spot it", () => {
    for (const far of [u("destroyer", 0, 6), u("destroyer", 0, 3, 1)]) {
      const state = game(far);
      expect(isHiddenFrom(state, unit(state, 0), 0)).toBe(true);
    }
  });
});

describe("running into a hidden submarine: ambush (05-supply-transport §9)", () => {
  const game = (...extra: UnitSetup[]) => submerge(makeGame(["SSSSSSS", "SSSSSSS"], [u("submarine", 1, 4), u("destroyer", 0, 0), ...extra]), 0);

  it("an enemy ship's move range runs through a hidden submarine's tile as if it weren't there", () => {
    const state = game();
    const reach = moveDestinations(state, unit(state, 1)).filter((p) => p.y === 0).map((p) => p.x);
    expect(reach).toEqual([0, 1, 2, 3, 4, 5, 6]);
  });

  it("a ship sailing into a hidden submarine stops on the tile before it, its turn over", () => {
    const result = must(game(), order(1, tiles(1, 2, 3, 4, 5, 6)));
    expect(unit(result.state, 1)).toMatchObject({ pos: row(3), hasActed: true });
    expect(ofType(result.events, "unitAmbushed")).toEqual([{ type: "unitAmbushed", unitId: 1, by: 0, pos: row(4) }]);
    expect(ofType(result.events, "unitMoved")[0]?.path).toEqual(tiles(0, 1, 2, 3));
  });

  it("an ambushed unit burns fuel only for the tiles it moved", () => {
    const state = game();
    const after = must(state, order(1, tiles(1, 2, 3, 4, 5, 6))).state;
    expect(unit(after, 1).fuel).toBe(unit(state, 1).fuel - 3);
  });

  it("the ambush cancels whatever the unit was ordered to do after its move", () => {
    const state = game(u("battleship", 1, 6, 1));
    const result = must(state, order(1, tiles(1, 2, 3, 4, 5, 6), { type: "attack", target: 2 }));
    expect(ofType(result.events, "combat")).toEqual([]);
    expect(ofType(result.events, "unitAmbushed")).toHaveLength(1);
  });

  it("once next to it, the ambushed ship sees the submarine, which then blocks like any enemy", () => {
    const after = must(game(), order(1, tiles(1, 2, 3))).state;
    expect(isHiddenFrom(after, unit(after, 0), 0)).toBe(false);
  });

  it("aircraft fly over a hidden submarine without being stopped", () => {
    const state = game(u("bomber", 0, 1, 1));
    const result = must(state, order(2, [P(2, 1), P(3, 1), P(4, 1), P(4, 0), P(5, 0)]));
    expect(ofType(result.events, "unitAmbushed")).toEqual([]);
    expect(unit(result.state, 2).pos).toEqual(row(5));
  });

  it("any unit trying to end its move on a hidden submarine's tile stops short, aircraft included", () => {
    const state = game(u("bomber", 0, 2));
    const result = must(state, order(2, tiles(3, 4)));
    expect(unit(result.state, 2).pos).toEqual(row(3));
    expect(ofType(result.events, "unitAmbushed")).toHaveLength(1);
  });

  it("an ambushed unit backs up past units it was passing over to the last free tile, or stays where it started", () => {
    // A Bomber over an enemy Destroyer, heading for the hidden submarine's tile.
    const state = submerge(makeGame(["SSSSSS"], [u("submarine", 1, 4), u("bomber", 0, 2), u("destroyer", 1, 3)]), 0);
    const result = must(state, order(1, tiles(3, 4)));
    expect(unit(result.state, 1)).toMatchObject({ pos: row(2), hasActed: true });
    expect(ofType(result.events, "unitMoved")).toEqual([]);
  });

  it("a unit can't attack a submarine its player couldn't see when giving the order", () => {
    // The Destroyer could reach a tile next to the submarine and attack, but can't see it to aim.
    const state = game();
    const result = apply(state, order(1, tiles(1, 2, 3), { type: "attack", target: 0 }));
    expect(result).toMatchObject({ ok: false, code: "invalidTarget" });
    const listed = legalCommands(state).filter((c) => c.type === "move" && c.action.type === "attack");
    expect(listed).toEqual([]);
  });

  it("a submarine next to one of the enemy's units can be attacked as usual", () => {
    const state = game(u("destroyer", 0, 4, 1));
    expect(apply(state, order(2, [], { type: "attack", target: 0 }))).toMatchObject({ ok: true });
  });
});

describe("what each player is shown of a hidden submarine (05-supply-transport §9, 09-ai §3)", () => {
  const game = () => {
    const start = makeGame(["SSSSSSS", "SSSSSSS"], [u("destroyer", 0, 0), u("submarine", 1, 5), u("battleship", 0, 2, 1)]);
    return submerge(must(start, { type: "endTurn" }).state, 1);
  };

  it("the AI is shown the game without the enemy submarines it can't see, and every command it's offered is accepted", () => {
    const view = makeView(must(game(), { type: "endTurn" }).state);
    expect(view.state.units.map((x) => x.id)).toEqual([0, 2]);
    for (const command of view.legalCommands()) expect(apply(must(game(), { type: "endTurn" }).state, command).ok).toBe(true);
  });

  it("the enemy doesn't watch a hidden submarine move", () => {
    const state = game();
    const result = must(state, order(1, [P(5, 1), P(4, 1)]));
    const shown = eventsSeenBy(state, result.events, 0);
    expect(shown.events).toEqual([]);
    expect(shown.before.units.map((x) => x.id)).toEqual([0, 2]);
  });

  it("a hidden submarine that attacks is shown where it ends its move, ready to fire", () => {
    const state = game();
    const result = must(state, order(1, [P(5, 1), P(4, 1), P(3, 1)], { type: "attack", target: 2 }));
    const shown = eventsSeenBy(state, result.events, 0);
    expect(shown.events.map((e) => e.type)).toEqual(["combat"]);
    expect(shown.revealed).toEqual([1]);
    expect(unit(shown.before, 1).pos).toEqual(P(3, 1));
  });

  it("its own player watches everything it does", () => {
    const state = game();
    const result = must(state, order(1, [P(5, 1), P(4, 1)]));
    expect(eventsSeenBy(state, result.events, 1).events).toEqual(result.events);
  });
});
