import { describe, expect, it } from "vitest";
import { baseDamage } from "../src/engine/data/damage";
import { UNIT_TYPE_IDS } from "../src/engine/data/units";
import { UNIT_GUIDE } from "../src/game/unitGuide";

/** A matchup worth naming: at least this much base damage. */
const NOTABLE = 55;

describe("build list guide agrees with the damage chart (03-combat §5)", () => {
  it.each(UNIT_TYPE_IDS)("%s is strong against what it hits hard", (type) => {
    for (const target of UNIT_GUIDE[type].strongVs) {
      expect(baseDamage(type, target)?.base ?? 0, target).toBeGreaterThanOrEqual(NOTABLE);
    }
  });

  it.each(UNIT_TYPE_IDS)("%s is weak against what hits it hard", (type) => {
    for (const attacker of UNIT_GUIDE[type].weakVs) {
      expect(baseDamage(attacker, type)?.base ?? 0, attacker).toBeGreaterThanOrEqual(NOTABLE);
    }
  });

  it("no unit is listed as both strong and weak against the same thing", () => {
    for (const type of UNIT_TYPE_IDS) {
      const { strongVs, weakVs } = UNIT_GUIDE[type];
      expect(strongVs.filter((t) => weakVs.includes(t)), type).toEqual([]);
    }
  });

  it("every unit says what threatens it", () => {
    for (const type of UNIT_TYPE_IDS) expect(UNIT_GUIDE[type].weakVs.length, type).toBeGreaterThan(0);
  });
});
