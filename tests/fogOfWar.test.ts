import { describe, expect, it } from "vitest";
import { makeView } from "../src/ai/player";
import { apply } from "../src/engine/apply";
import type { Command, GameEvent, UnitAction } from "../src/engine/commands";
import { legalCommands } from "../src/engine/legal";
import type { Point } from "../src/engine/map";
import { moveDestinations } from "../src/engine/movement";
import { loadGame, saveGame } from "../src/engine/save";
import type { GameSetup, UnitSetup } from "../src/engine/setup";
import type { GameState, Unit } from "../src/engine/state";
import * as stats from "../src/engine/stats";
import { eventsSeenBy, isHiddenFrom, revealsAnything, stateSeenBy, tileInSight, tilesInSight } from "../src/engine/visibility";
import { makeGame } from "./helpers";

// Fog of war (19-fog-of-war). Player 0 (US, Allies) and player 1 (Germany, Axis) unless a test says otherwise.

const P = (x: number, y: number): Point => ({ x, y });
const u = (type: UnitSetup["type"], owner: number, x: number, y = 0, extra: Partial<UnitSetup> = {}): UnitSetup => ({ type, owner, pos: P(x, y), ...extra });
const order = (unitId: number, path: Point[], action: UnitAction = { type: "wait" }): Command => ({ type: "move", unitId, path, action });
const row = (from: number, to: number, y = 0) => Array.from({ length: Math.abs(to - from) }, (_, i) => P(from < to ? from + i + 1 : from - i - 1, y));
const endTurn: Command = { type: "endTurn" };

/** A game with fog of war on and luck off. */
const fog = (rows: string[], units: UnitSetup[], extra: Partial<Omit<GameSetup, "map" | "units">> = {}) =>
  makeGame(rows, units, { ...extra, settings: { luck: false, fogOfWar: true, ...extra.settings } });

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
/** Whether player 0 can see unit `id`. */
const seen = (state: GameState, id: number, viewer = 0) => !isHiddenFrom(state, unit(state, id), viewer);
const types = (events: readonly GameEvent[]) => events.map((e) => e.type);

describe("what a side sees in fog of war (19-fog-of-war §2)", () => {
  it("without fog of war every unit is seen, however far away", () => {
    const state = makeGame([".........."], [u("infantry", 0, 0), u("infantry", 1, 9)]);
    expect(seen(state, 1)).toBe(true);
    expect(tilesInSight(state, 0)).toBeNull();
  });

  it("a unit sees the tiles within its vision, counted in steps up, down, left and right", () => {
    // Infantry has vision 2 (01-units §8).
    const state = fog(["......", "......", "......"], [u("infantry", 0, 0)]);
    expect(tileInSight(state, P(2, 0), 0)).toBe(true);
    expect(tileInSight(state, P(1, 1), 0)).toBe(true);
    expect(tileInSight(state, P(3, 0), 0)).toBe(false);
    expect(tileInSight(state, P(2, 1), 0)).toBe(false);
  });

  it("an enemy within a unit's vision is seen; one beyond it is hidden", () => {
    const state = fog(["......"], [u("infantry", 0, 0), u("infantry", 1, 2), u("infantry", 1, 3)]);
    expect(seen(state, 1)).toBe(true);
    expect(seen(state, 2)).toBe(false);
  });

  it("a Recon sees 5 tiles away", () => {
    const state = fog([".......", "......."], [u("recon", 0, 0), u("infantry", 1, 5), u("infantry", 1, 6)]);
    expect(seen(state, 1)).toBe(true);
    expect(seen(state, 2)).toBe(false);
  });

  it("each side sees with its own units only: the enemy is hidden from you, and you from the enemy", () => {
    const state = fog(["......."], [u("recon", 0, 0), u("infantry", 1, 5)]);
    expect(seen(state, 1, 0)).toBe(true);
    expect(seen(state, 0, 1)).toBe(false);
  });

  it("foot soldiers on Hills see 3 further: Infantry, Assault Infantry and Mortar Teams", () => {
    for (const type of ["infantry", "assaultInfantry", "mortar"] as const) {
      const state = fog(["H......"], [u(type, 0, 0), u("infantry", 1, 5), u("infantry", 1, 6)]);
      expect(stats.vision(state, unit(state, 0))).toBe(5);
      expect(seen(state, 1)).toBe(true);
      expect(seen(state, 2)).toBe(false);
    }
  });

  it("the Hills bonus is for foot soldiers only: an aircraft over Hills sees as far as anywhere", () => {
    const state = fog(["H......"], [u("fighter", 0, 0), u("infantry", 1, 3)]);
    expect(stats.vision(state, unit(state, 0))).toBe(2);
    expect(seen(state, 1)).toBe(false);
  });

  it("a side sees the properties it owns, even far from its units", () => {
    const state = fog(["........C"], [u("infantry", 0, 0), u("infantry", 1, 8)], { propertyOwners: [{ pos: P(8, 0), owner: 0 }] });
    expect(tileInSight(state, P(8, 0), 0)).toBe(true);
    expect(tileInSight(state, P(7, 0), 0)).toBe(false);
    expect(seen(state, 1)).toBe(true);
  });

  it("units aboard a transport see nothing", () => {
    // The Halftrack sees 1 tile; the Infantry aboard would see 2.
    const state = fog(["......"], [u("halftrack", 0, 0, 0, { cargo: [{ type: "infantry" }] }), u("infantry", 1, 2)]);
    expect(seen(state, 1)).toBe(false);
  });

  it("allies on the same side share what they see", () => {
    const state = fog(["........."], [u("infantry", 0, 0), u("recon", 1, 3), u("infantry", 2, 8)], {
      players: [
        { name: "US", nation: "us" },
        { name: "UK", nation: "uk" },
        { name: "Germany", nation: "germany" },
      ],
    });
    expect(seen(state, 2, 0)).toBe(true);
  });
});

describe("hiding in fog of war (19-fog-of-war §3)", () => {
  it("Forest, Bocage and Reef hide units from a side with none of its units next to them", () => {
    for (const terrain of ["F", "b"]) {
      const state = fog([`...${terrain}..`], [u("recon", 0, 0), u("infantry", 1, 3)]);
      expect(tileInSight(state, P(3, 0), 0)).toBe(true);
      expect(seen(state, 1)).toBe(false);
    }
    const reef = fog(["SSrSS"], [u("destroyer", 0, 0), u("destroyer", 1, 2)]);
    expect(seen(reef, 1)).toBe(false);
  });

  it("a unit right next to a hiding unit sees it", () => {
    const state = fog(["..F.."], [u("infantry", 0, 1), u("infantry", 1, 2)]);
    expect(seen(state, 1)).toBe(true);
    const reef = fog(["SrSS"], [u("destroyer", 0, 0), u("destroyer", 1, 1)]);
    expect(seen(reef, 1)).toBe(true);
  });

  it("only diagonally next to it isn't close enough", () => {
    const state = fog(["....", ".F.."], [u("recon", 0, 0), u("infantry", 1, 1, 1)]);
    expect(seen(state, 1)).toBe(false);
  });

  it("a Ridge doesn't hide units", () => {
    const state = fog(["...d.."], [u("recon", 0, 0), u("infantry", 1, 3)]);
    expect(seen(state, 1)).toBe(true);
  });

  it("aircraft over a Forest aren't hidden", () => {
    const state = fog(["...F.."], [u("recon", 0, 0), u("fighter", 1, 3)]);
    expect(seen(state, 1)).toBe(true);
  });

  it("a submerged submarine is still seen only from next to it, even in plain sight (05-supply-transport §9)", () => {
    const start = fog(["SSSSS"], [u("destroyer", 0, 0), u("submarine", 1, 2)]);
    const state = { ...start, units: start.units.map((x) => (x.id === 1 ? { ...x, submerged: true } : x)) };
    expect(seen(state, 1)).toBe(false);
    const close = { ...state, units: state.units.map((x) => (x.id === 0 ? { ...x, pos: P(1, 0) } : x)) };
    expect(seen(close, 1)).toBe(true);
  });

  it("a side always sees its own units, wherever they are", () => {
    const state = fog(["F....."], [u("infantry", 0, 0), u("infantry", 1, 5)]);
    expect(seen(state, 0, 0)).toBe(true);
  });
});

describe("what's always shown in fog of war (19-fog-of-war §4)", () => {
  it("the game shown to a side leaves out the enemy units it can't see", () => {
    const state = fog(["......"], [u("infantry", 0, 0), u("infantry", 1, 1), u("infantry", 1, 5)]);
    expect(stateSeenBy(state, 0).units.map((x) => x.id)).toEqual([0, 1]);
  });

  it("who owns a property is shown, but not the capture progress of a unit out of sight", () => {
    const start = fog(["......C"], [u("infantry", 0, 0), u("infantry", 1, 6)], { propertyOwners: [{ pos: P(6, 0), owner: 1 }] });
    const capturing = {
      ...start,
      properties: start.properties.map((p) => ({ ...p, capturePoints: 10, capturingUnit: 1 })),
    };
    const shown = stateSeenBy(capturing, 0).properties[0];
    expect(shown).toMatchObject({ owner: 1, capturePoints: 20, capturingUnit: null });
  });

  it("the fog setting is kept when a game is saved and loaded; saves from before fog have it off", () => {
    const state = fog(["..."], [u("infantry", 0, 0)]);
    expect(loadGame(saveGame(state)).settings.fogOfWar).toBe(true);
    const old = JSON.parse(saveGame(state)) as { state: { settings: Record<string, unknown> } };
    delete old.state.settings.fogOfWar;
    expect(loadGame(JSON.stringify(old)).settings.fogOfWar).toBe(false);
  });
});

describe("giving orders in fog of war (19-fog-of-war §5)", () => {
  // Player 0's Medium Tank (vision 2) at x = 0; player 1's Infantry hidden in the Forest at x = 4.
  const game = (...extra: UnitSetup[]) => fog(["....F...", "........"], [u("mediumTank", 0, 0), u("infantry", 1, 4), ...extra]);

  it("a move range runs through a hidden enemy's tile as if it were empty", () => {
    const state = game();
    expect(moveDestinations(state, unit(state, 0))).toContainEqual(P(4, 0));
  });

  it("running into a hidden enemy is an ambush: the unit stops on the tile before it, its turn over", () => {
    const state = game();
    const result = must(state, order(0, row(0, 5)));
    expect(unit(result.state, 0)).toMatchObject({ pos: P(3, 0), hasActed: true });
    expect(result.events.find((e) => e.type === "unitAmbushed")).toMatchObject({ unitId: 0, by: 1, pos: P(4, 0) });
  });

  it("an ambushed unit's order after the move doesn't happen", () => {
    // Two tiles away the Infantry has the Forest in sight, but can't see into it.
    const state = fog(["....FC.."], [u("infantry", 0, 2), u("infantry", 1, 4)]);
    const result = must(state, order(0, row(2, 5), { type: "capture" }));
    expect(types(result.events)).toEqual(["unitMoved", "unitAmbushed"]);
    expect(result.state.properties[0]?.capturingUnit).toBeNull();
  });

  it("a unit can't attack a hidden unit on the move that finds it", () => {
    const state = game();
    const result = apply(state, order(0, row(0, 3), { type: "attack", target: 1 }));
    expect(result).toMatchObject({ ok: false, code: "invalidTarget" });
  });

  it("once one unit has moved next to it and spotted it, another can attack it the same turn", () => {
    const state = game(u("recon", 0, 3, 1));
    const spotted = must(state, order(2, [P(4, 1)])).state;
    expect(seen(spotted, 1)).toBe(true);
    const attack = must(spotted, order(0, row(0, 3), { type: "attack", target: 1 }));
    expect(types(attack.events)).toContain("combat");
  });

  it("unloading onto a hidden enemy is an ambush: the passenger stays aboard and the transport's turn is over", () => {
    const state = fog(["....F..."], [u("halftrack", 0, 0, 0, { cargo: [{ type: "infantry" }] }), u("infantry", 1, 4)]);
    const command = order(0, row(0, 3), { type: "unload", passenger: 2, to: P(4, 0) });
    expect(legalCommands(state)).toContainEqual(command);
    const result = must(state, command);
    expect(unit(result.state, 0)).toMatchObject({ pos: P(3, 0), hasActed: true });
    expect(unit(result.state, 0).cargo.map((c) => c.id)).toEqual([2]);
    expect(result.events.find((e) => e.type === "unitAmbushed")).toMatchObject({ unitId: 0, by: 1, pos: P(4, 0) });
  });

  it("a fortification can be shelled in the fog; a hidden unit inside isn't touched", () => {
    // Artillery sees 1 tile; the garrisoned Bunker is 2 away, out of sight.
    const units = [u("artillery", 0, 0), u("infantry", 1, 2)];
    const command = order(0, [], { type: "attackFort", target: P(2, 0) });
    const result = must(fog(["..X"], units), command);
    expect(result.state.fortifications[0]?.hp).toBeLessThan(100);
    expect(unit(result.state, 1).hp).toBe(100);
    // Without fog the unit inside is seen, so the shot has to be at it instead (03-combat §4).
    expect(apply(makeGame(["..X"], units, { settings: { luck: false } }), command).ok).toBe(false);
  });

  it("every command offered in the fog is accepted, and the AI is shown only what its side sees (09-ai §3)", () => {
    const start = fog(
      ["....F...", "..X.b...", "C......."],
      [
        u("lightTank", 0, 0),
        u("halftrack", 0, 0, 1, { cargo: [{ type: "infantry" }] }),
        u("artillery", 0, 0, 2),
        u("infantry", 1, 4),
        u("infantry", 1, 2, 1),
        u("infantry", 1, 4, 1),
        u("recon", 1, 7, 2),
      ],
    );
    const view = makeView(start);
    // The Light Tank (vision 3) sees the Infantry on the Bunker, not the ones in the Forest and
    // Bocage, nor the far Recon.
    const enemies = view.state.units.filter((x) => x.owner === 1).map((x) => x.pos);
    expect(enemies).toEqual([P(2, 1)]);
    for (const command of view.legalCommands()) expect(apply(start, command).ok).toBe(true);
  });
});

describe("fire from the fog (19-fog-of-war §6)", () => {
  it("artillery firing from out of sight stays hidden: its target's side sees the hit, not the shooter", () => {
    // Player 0's Infantry sees 2 tiles; player 1's Artillery fires from 3 away, spotted for by a
    // Recon 5 away.
    const state = must(fog(["......", "......"], [u("infantry", 0, 0), u("artillery", 1, 3), u("recon", 1, 4, 1)]), endTurn).state;
    const result = must(state, order(1, [], { type: "attack", target: 0 }));
    const shown = eventsSeenBy(state, result.state, result.events, 0);
    expect(types(shown.events)).toEqual(["combat"]);
    expect(shown.revealed).toEqual([]);
    expect(shown.before.units.map((x) => x.id)).toEqual([0]);
  });
});

describe("watching the enemy move in fog of war (19-fog-of-war §7)", () => {
  // Player 0's Infantry at x = 0 sees x = 0 to 2. Player 1 moves a Recon along the row.
  const game = (reconAt: number) => must(fog(["=========="], [u("infantry", 0, 0), u("recon", 1, reconAt)]), endTurn).state;

  it("an enemy coming out of the fog appears on the first tile in sight and walks from there", () => {
    const state = game(6);
    const result = must(state, order(1, row(6, 1)));
    const shown = eventsSeenBy(state, result.state, result.events, 0);
    const move = shown.events.find((e) => e.type === "unitMoved");
    expect(move).toMatchObject({ path: [P(2, 0), P(1, 0)] });
    expect(shown.revealed).toEqual([1]);
    expect(unit(shown.before, 1).pos).toEqual(P(2, 0));
  });

  it("an enemy walking into the fog walks to its last tile in sight, and what it does there isn't shown", () => {
    const state = game(1);
    const result = must(state, order(1, row(1, 6)));
    const shown = eventsSeenBy(state, result.state, result.events, 0);
    expect(shown.events).toEqual([{ type: "unitMoved", unitId: 1, path: [P(1, 0), P(2, 0)], fuelUsed: 5 }]);
    expect(stateSeenBy(result.state, 0).units.map((x) => x.id)).toEqual([0]);
  });

  it("a move made entirely in the fog isn't shown at all", () => {
    const state = game(9);
    const result = must(state, order(1, row(9, 5)));
    expect(eventsSeenBy(state, result.state, result.events, 0).events).toEqual([]);
  });

  it("its own player watches everything", () => {
    const state = game(9);
    const result = must(state, order(1, row(9, 5)));
    expect(eventsSeenBy(state, result.state, result.events, 1).events).toEqual(result.events);
  });

  it("a move that brings a tile into sight shows something new, so Undo is cleared; one that doesn't, doesn't", () => {
    const state = fog([".........."], [u("infantry", 0, 0)]);
    const forward = must(state, order(0, [P(1, 0)]));
    expect(revealsAnything(state, forward.state, 0)).toBe(true);
    const stay = must(state, order(0, []));
    expect(revealsAnything(state, stay.state, 0)).toBe(false);
    const clear = makeGame([".........."], [u("infantry", 0, 0)]);
    expect(revealsAnything(clear, must(clear, order(0, [P(1, 0)])).state, 0)).toBe(false);
  });
});

describe("radar (19-fog-of-war §2a)", () => {
  // A Radar Station (UK) at the west end of a long row; German units further east. Player 0 is the UK.
  const radarGame = (units: UnitSetup[], extra: Partial<Omit<GameSetup, "map" | "units">> = {}) =>
    fog([".............."], [u("radarStation", 0, 0), ...units], {
      players: [{ name: "UK", nation: "uk" }, { name: "Germany", nation: "germany" }],
      ...extra,
    });

  it("a Radar Station sees enemy aircraft 10 squares away", () => {
    const state = radarGame([u("bomber", 1, 10), u("fighter", 1, 11)]);
    expect(seen(state, 1)).toBe(true);
    expect(seen(state, 2)).toBe(false);
  });

  it("it sees ground units and ships only right next to it: radar tracked raids, not troops", () => {
    const state = radarGame([u("infantry", 1, 1), u("infantry", 1, 3)]);
    expect(seen(state, 1)).toBe(true);
    expect(seen(state, 2)).toBe(false);
  });

  it("the squares it watches stay in the fog: an aircraft shows over them, the ground under it doesn't", () => {
    const state = radarGame([u("bomber", 1, 6)]);
    expect(seen(state, 1)).toBe(true);
    expect(tileInSight(state, P(6, 0), 0)).toBe(false);
  });

  it("rain doesn't blind it: it still sees aircraft 10 squares away on a rainy day (12-weather §3a)", () => {
    const state = radarGame([u("bomber", 1, 10)], { weather: { season: "summer", forecast: [{ fromDay: 1, weather: "rain" }] } });
    expect(stats.vision(state, unit(state, 0))).toBe(0);
    expect(seen(state, 1)).toBe(true);
  });

  it("the other side sees a Radar Station only once one of its units has it in sight", () => {
    const far = radarGame([u("bomber", 1, 8)]);
    expect(seen(far, 0, 1)).toBe(false);
    const close = radarGame([u("bomber", 1, 2)]);
    expect(seen(close, 0, 1)).toBe(true);
  });

  it("it can't move, and German Bombers knock it out in two attacks: 75% base damage, a little less on Plains (03-combat §5c)", () => {
    const state = radarGame([u("bomber", 1, 1)]);
    expect(moveDestinations(state, unit(state, 0)).filter((p) => p.x !== 0 || p.y !== 0)).toEqual([]);
    const germanTurn = must(state, endTurn).state;
    const raid = must(germanTurn, order(1, [], { type: "attack", target: 0 }));
    expect(unit(raid.state, 0).hp).toBe(33);
    const nextRaid = must(must(must(raid.state, endTurn).state, endTurn).state, order(1, [], { type: "attack", target: 0 }));
    expect(nextRaid.state.units.some((x) => x.id === 0)).toBe(false);
  });
});
