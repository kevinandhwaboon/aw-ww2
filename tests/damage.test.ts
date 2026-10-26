import { describe, expect, it } from "vitest";
import { ARMED_UNIT_IDS, baseDamage, DAMAGE_CHART } from "../src/engine/data/damage";
import { UNITS, UNIT_TYPE_IDS } from "../src/engine/data/units";

describe("damage chart (03-combat §5)", () => {
  it("has a row for every armed unit and none for unarmed ones", () => {
    for (const id of UNIT_TYPE_IDS) {
      const armed = UNITS[id].primaryWeapon !== null || UNITS[id].secondaryWeapon !== null;
      expect(DAMAGE_CHART[id] !== undefined, id).toBe(armed);
    }
    expect([...ARMED_UNIT_IDS].sort()).toEqual(
      UNIT_TYPE_IDS.filter((id) => UNITS[id].range !== null).sort(),
    );
  });

  it("every entry uses a weapon the attacker actually has", () => {
    for (const attacker of ARMED_UNIT_IDS) {
      for (const [target, entry] of Object.entries(DAMAGE_CHART[attacker] ?? {})) {
        const weapon = entry.weapon === "primary" ? UNITS[attacker].primaryWeapon : UNITS[attacker].secondaryWeapon;
        expect(weapon, `${attacker} vs ${target}`).not.toBeNull();
      }
    }
  });

  it("matches the doc for spot-checked cells", () => {
    expect(baseDamage("infantry", "infantry")).toEqual({ weapon: "secondary", base: 55 });
    expect(baseDamage("mediumTank", "mediumTank")).toEqual({ weapon: "primary", base: 55 });
    expect(baseDamage("mediumTank", "infantry")).toEqual({ weapon: "secondary", base: 75 });
    expect(baseDamage("bomber", "infantry")).toEqual({ weapon: "primary", base: 110 });
    expect(baseDamage("destroyer", "transportAircraft")).toEqual({ weapon: "secondary", base: 105 });
    expect(baseDamage("fighter", "torpedoBoat")).toEqual({ weapon: "primary", base: 10 });
  });

  it("Tank Destroyer beats a Heavy Tank striking first, but takes 90 back (03-combat §5c)", () => {
    expect(baseDamage("tankDestroyer", "heavyTank")?.base).toBe(65);
    expect(baseDamage("heavyTank", "tankDestroyer")?.base).toBe(90);
  });

  it("Tank Destroyer has no weapon against infantry (03-combat §5c)", () => {
    for (const target of ["infantry", "assaultInfantry", "mortar"] as const) {
      expect(baseDamage("tankDestroyer", target)).toBeNull();
    }
  });

  it("Assault Infantry is the best ground unit against fortifications (03-combat §5c)", () => {
    const ground = ARMED_UNIT_IDS.filter((id) => UNITS[id].category === "land" && id !== "assaultInfantry");
    for (const id of ground) expect(baseDamage(id, "fort")?.base ?? 0, id).toBeLessThan(65);
    expect(baseDamage("assaultInfantry", "fort")).toEqual({ weapon: "primary", base: 65 });
  });

  it("Fighter strafing is at most 15 against any ground unit (03-combat §5c)", () => {
    for (const target of UNIT_TYPE_IDS.filter((id) => UNITS[id].category === "land")) {
      expect(baseDamage("fighter", target)?.base ?? 0, target).toBeLessThanOrEqual(15);
    }
  });

  it("Flak Gun only attacks air units; Submarine and Torpedo Boat only attack ships", () => {
    for (const target of UNIT_TYPE_IDS) {
      const category = UNITS[target].category;
      if (category !== "air") expect(baseDamage("flakGun", target), target).toBeNull();
      if (category !== "naval") {
        expect(baseDamage("submarine", target), target).toBeNull();
        expect(baseDamage("torpedoBoat", target), target).toBeNull();
      }
    }
  });
});
