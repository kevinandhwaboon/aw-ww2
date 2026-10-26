import { describe, expect, it } from "vitest";
import { UNITS, UNIT_TYPE_IDS } from "../src/engine/data/units";

const phase1 = UNIT_TYPE_IDS.filter((id) => UNITS[id].phase === 1);

describe("unit roster (01-units)", () => {
  it("has 13 land, 3 air and 5 naval unit types (01-units §2–4)", () => {
    const count = (category: string) => UNIT_TYPE_IDS.filter((id) => UNITS[id].category === category).length;
    expect(count("land")).toBe(13);
    expect(count("air")).toBe(3);
    expect(count("naval")).toBe(5);
  });

  it("the phase 1 MVP has the 12 land units, everything else is phase 2 (01-units §2)", () => {
    expect(phase1).toHaveLength(12);
    for (const id of phase1) expect(UNITS[id].category).toBe("land");
    expect(UNITS.flakGun.phase).toBe(2);
  });

  it("matches the v0 stat table for a few units (01-units §8)", () => {
    expect(UNITS.infantry).toMatchObject({ cost: 1000, movePoints: 3, movementType: "foot", vision: 2, maxFuel: 99 });
    expect(UNITS.mediumTank).toMatchObject({ cost: 8000, movePoints: 6, movementType: "tracks", maxFuel: 70 });
    expect(UNITS.mediumTank.primaryWeapon.maxAmmo).toBe(9);
    expect(UNITS.heavyTank).toMatchObject({ cost: 15000, movePoints: 4, maxFuel: 50 });
    expect(UNITS.rocketArtillery).toMatchObject({ cost: 14000, movementType: "wheels", range: { min: 3, max: 5 } });
    expect(UNITS.fighter).toMatchObject({ cost: 20000, movePoints: 9, fuelPerDay: 5 });
  });

  it("only Infantry and Assault Infantry can capture (01-units §2)", () => {
    expect(UNIT_TYPE_IDS.filter((id) => UNITS[id].canCapture)).toEqual(["infantry", "assaultInfantry"]);
  });

  it("indirect units have minimum range above 1 and can't move and fire (01-units §9)", () => {
    for (const id of UNIT_TYPE_IDS) {
      const { range, canMoveAndFire } = UNITS[id];
      if (range) expect(canMoveAndFire, id).toBe(range.min === 1);
    }
    expect(UNITS.mortar.range).toEqual({ min: 2, max: 2 });
    expect(UNITS.artillery.range).toEqual({ min: 2, max: 3 });
  });

  it("unarmed units have no weapons and no range (01-units §8)", () => {
    for (const id of ["halftrack", "transportAircraft", "landingCraft"] as const) {
      expect(UNITS[id]).toMatchObject({ primaryWeapon: null, secondaryWeapon: null, range: null });
    }
  });

  it("Halftrack carries 1 foot unit, Transport Aircraft 2 foot units, Landing Craft 2 land units (01-units §5)", () => {
    expect(UNITS.halftrack.transport).toEqual({ capacity: 1, carries: ["infantry", "assaultInfantry", "mortar"] });
    expect(UNITS.transportAircraft.transport.capacity).toBe(2);
    expect(UNITS.transportAircraft.transport.carries).toEqual(["infantry", "assaultInfantry", "mortar"]);
    expect(UNITS.landingCraft.transport.capacity).toBe(2);
    expect(UNITS.landingCraft.transport.carries).toContain("heavyTank");
    expect(UNITS.landingCraft.transport.carries).not.toContain("fighter");
  });

  it("land units burn no fuel per day; air and naval units do (05-supply-transport §1)", () => {
    for (const id of UNIT_TYPE_IDS) {
      const { category, fuelPerDay } = UNITS[id];
      if (category === "land") expect(fuelPerDay, id).toBe(0);
      else expect(fuelPerDay, id).toBeGreaterThan(0);
    }
  });
});
