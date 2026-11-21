import { describe, expect, it } from "vitest";
import { SCENARIOS, SURVIVAL_SCENARIOS } from "../src/scenarios";
import { shotPlan } from "../src/ui/featurePlan";
import { TITLE_MODES } from "../src/ui/titleModes";

describe("The title screen's ways to play (00-master-design §12)", () => {
  it("offers Campaign, Skirmish and Survival, in that order", () => {
    expect(TITLE_MODES.map((m) => m.name)).toEqual(["Campaign", "Skirmish", "Survival"]);
  });

  it("each way to play says what it is", () => {
    for (const mode of TITLE_MODES) expect(mode.description.length).toBeGreaterThan(40);
  });

  it("each moving picture is drawn with a real map and plays a battle scene", () => {
    for (const mode of TITLE_MODES) {
      const scenario = [...SCENARIOS, ...SURVIVAL_SCENARIOS].find((s) => s.id === mode.scenario);
      expect(scenario, mode.id).toBeDefined();
      if (!scenario || mode.shot.kind !== "battle") continue;
      const plan = shotPlan(scenario, mode.shot);
      expect(plan.strikes.length).toBeGreaterThan(0);
    }
  });

  it("each moving picture's nations fight on its map", () => {
    for (const mode of TITLE_MODES) {
      const scenario = [...SCENARIOS, ...SURVIVAL_SCENARIOS].find((s) => s.id === mode.scenario);
      if (!scenario || mode.shot.kind !== "battle") continue;
      const nations = scenario.setup.players.map((p) => p.nation);
      for (const side of [mode.shot.attacker, mode.shot.defender]) if (side.nation) expect(nations, mode.id).toContain(side.nation);
    }
  });
});
