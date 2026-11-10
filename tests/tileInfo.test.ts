import { describe, expect, it } from "vitest";
import { apply } from "../src/engine/apply";
import type { Point } from "../src/engine/map";
import { tileInfo } from "../src/game/tileInfo";
import { makeGame } from "./helpers";

const P = (x: number, y: number): Point => ({ x, y });

describe("tile info box (00-master-design §12)", () => {
  it("names the terrain and its defense, with no unit on an empty tile", () => {
    const state = makeGame(["f."]);
    const info = tileInfo(state, P(1, 0));
    expect(info.unit).toBeNull();
    expect(info.terrain).toBe("Plains");
    expect(tileInfo(state, P(0, 0)).stars).toBeGreaterThanOrEqual(0);
  });

  it("names the unit on the tile and who owns it", () => {
    const state = makeGame(["."], [{ type: "infantry", owner: 1, pos: P(0, 0) }]);
    expect(tileInfo(state, P(0, 0)).unit).toMatchObject({ name: "Infantry", owner: 1, cargo: null });
  });

  it("says when a submarine is submerged (05-supply-transport §9)", () => {
    const state = makeGame(["S"], [{ type: "submarine", owner: 0, pos: P(0, 0) }]);
    expect(tileInfo(state, P(0, 0)).unit?.name).toBe("Submarine");
    const dived = { ...state, units: state.units.map((u) => ({ ...u, submerged: true })) };
    expect(tileInfo(dived, P(0, 0)).unit?.name).toBe("Submarine (submerged)");
  });

  it("a transport lists the units aboard (05-supply-transport §8)", () => {
    const state = makeGame(["._."], [
      { type: "landingCraft", owner: 0, pos: P(1, 0) },
      { type: "infantry", owner: 0, pos: P(0, 0) },
      { type: "mediumTank", owner: 0, pos: P(2, 0) },
    ]);
    expect(tileInfo(state, P(1, 0)).unit?.cargo).toEqual([]);
    const board = (s: typeof state, unitId: number) => {
      const result = apply(s, { type: "move", unitId, path: [P(1, 0)], action: { type: "load" } });
      if (!result.ok) throw new Error(result.message);
      return result.state;
    };
    const cargo = tileInfo(board(board(state, 1), 2), P(1, 0)).unit?.cargo;
    expect(cargo?.map((c) => c.name)).toEqual(["Infantry", "Medium Tank"]);
  });

  it("hovering a Landing Craft or Carrier shows each unit aboard with its HP, fuel and ammo", () => {
    const fresh = makeGame(["S"], [{ type: "carrier", owner: 0, pos: P(0, 0), cargo: [{ type: "fighter", hp: 70 }, { type: "torpedoBomber" }] }]);
    // Drained after setup: the Carrier's turn-start service would otherwise top the Fighter up.
    const state = { ...fresh, units: fresh.units.map((u) => ({ ...u, cargo: u.cargo.map((c, i) => (i === 0 ? { ...c, fuel: 12, ammo: 1 } : c)) })) };
    expect(tileInfo(state, P(0, 0)).unit?.cargo).toEqual([
      { name: "Fighter", hp: 7, fuel: { left: 12, max: 80, low: true }, ammo: { left: 1, max: 2, low: true } },
      { name: "Torpedo Bomber", hp: 10, fuel: { left: 70, max: 70, low: false }, ammo: { left: 1, max: 1, low: false } },
    ]);
  });

  it("a unit that isn't a transport has no cargo line", () => {
    const state = makeGame(["."], [{ type: "mediumTank", owner: 0, pos: P(0, 0) }]);
    expect(tileInfo(state, P(0, 0)).unit?.cargo).toBeNull();
  });

  it("a property shows the capture points it has left out of 20 (04-economy §3)", () => {
    const state = makeGame(["C."], [{ type: "infantry", owner: 0, pos: P(1, 0) }]);
    expect(tileInfo(state, P(0, 0)).capture).toEqual({ left: 20, total: 20 });
    const result = apply(state, { type: "move", unitId: 0, path: [P(0, 0)], action: { type: "capture" } });
    if (!result.ok) throw new Error(result.message);
    expect(tileInfo(result.state, P(0, 0)).capture).toEqual({ left: 10, total: 20 }); // full-strength Infantry takes 10
  });

  it("terrain that isn't a property has no capture points", () => {
    expect(tileInfo(makeGame(["F"]), P(0, 0)).capture).toBeNull();
  });

  it("shows the terrain's defense stars (02-terrain §1)", () => {
    expect(tileInfo(makeGame(["F"]), P(0, 0)).stars).toBe(2);
  });

  it("an aircraft gets no defense from terrain (02-terrain §1)", () => {
    const state = makeGame(["F"], [{ type: "fighter", owner: 0, pos: P(0, 0) }]);
    expect(tileInfo(state, P(0, 0))).toMatchObject({ stars: 0 });
  });

  it("shows a unit's fuel and ammo left out of the most it can carry (05-supply-transport §1, §2)", () => {
    const state = makeGame(["."], [{ type: "mediumTank", owner: 1, pos: P(0, 0) }]);
    const tank = state.units[0];
    if (!tank) throw new Error("no tank");
    const used = { ...state, units: [{ ...tank, fuel: tank.fuel - 10, ammo: tank.ammo - 2 }] };
    const unit = tileInfo(used, P(0, 0)).unit;
    expect(unit?.fuel).toEqual({ left: tank.fuel - 10, max: tank.fuel, low: false });
    expect(unit?.ammo).toEqual({ left: tank.ammo - 2, max: tank.ammo, low: false });
  });

  it("a unit with no main weapon shows no ammo (05-supply-transport §2)", () => {
    const state = makeGame(["."], [{ type: "infantry", owner: 0, pos: P(0, 0) }]);
    expect(tileInfo(state, P(0, 0)).unit?.ammo).toBeNull();
  });

  it("flags ammo as low once it is used up (05-supply-transport §2)", () => {
    const state = makeGame(["."], [{ type: "mediumTank", owner: 0, pos: P(0, 0) }]);
    const empty = { ...state, units: state.units.map((u) => ({ ...u, ammo: 0 })) };
    expect(tileInfo(empty, P(0, 0)).unit?.ammo?.low).toBe(true);
  });

  it("flags fuel as low for an aircraft within two turns of running dry, like the map's gas can (05-supply-transport §11)", () => {
    const state = makeGame(["."], [{ type: "bomber", owner: 0, pos: P(0, 0) }]);
    expect(tileInfo(state, P(0, 0)).unit?.fuel.low).toBe(false);
    const withFuel = (fuel: number) => ({ ...state, units: state.units.map((u) => ({ ...u, fuel })) });
    expect(tileInfo(withFuel(17), P(0, 0)).unit?.fuel.low).toBe(false);
    expect(tileInfo(withFuel(16), P(0, 0)).unit?.fuel.low).toBe(true); // two days at 8 a day
  });

  it("flags fuel as low for any unit down to a quarter of its tank (05-supply-transport §11)", () => {
    const state = makeGame(["."], [{ type: "mediumTank", owner: 0, pos: P(0, 0) }]);
    const withFuel = (fuel: number) => ({ ...state, units: state.units.map((u) => ({ ...u, fuel })) });
    expect(tileInfo(withFuel(8), P(0, 0)).unit?.fuel.low).toBe(false);
    expect(tileInfo(withFuel(7), P(0, 0)).unit?.fuel.low).toBe(true); // 30 / 4, rounded down
  });

  it("flags ammo as low at a quarter or less, but a single torpedo still loaded is a full load (05-supply-transport §11)", () => {
    const tank = makeGame(["."], [{ type: "mediumTank", owner: 0, pos: P(0, 0), ammo: 4 }]);
    expect(tileInfo(tank, P(0, 0)).unit?.ammo?.low).toBe(false);
    const short = makeGame(["."], [{ type: "mediumTank", owner: 0, pos: P(0, 0), ammo: 3 }]);
    expect(tileInfo(short, P(0, 0)).unit?.ammo?.low).toBe(true); // 9 / 4, rounded up
    const fighter = makeGame(["."], [{ type: "fighter", owner: 0, pos: P(0, 0), ammo: 1 }]);
    expect(tileInfo(fighter, P(0, 0)).unit?.ammo?.low).toBe(true);
    const torpedo = makeGame(["."], [{ type: "torpedoBomber", owner: 0, pos: P(0, 0) }]);
    expect(tileInfo(torpedo, P(0, 0)).unit?.ammo?.low).toBe(false);
  });

  it("says when a property is a scenario objective (04-economy §8)", () => {
    const state = makeGame(["C.C"]);
    const withObjective = { ...state, victoryConditions: [{ type: "captureProperties" as const, side: "allies" as const, properties: [P(0, 0)] }] };
    expect(tileInfo(withObjective, P(0, 0)).objective).toBe(true);
    expect(tileInfo(withObjective, P(2, 0)).objective).toBe(false);
  });
});
