// The campaign's ending: the surrender aboard USS Missouri (22-campaign §7a).

import { describe, expect, it } from "vitest";
import { ENDING_LENGTH, SHOTS, SIGNERS, shotAt, shotStart, summaryLine } from "../src/game/ending/plan";
import { MISSIONS } from "../src/campaign/missions";
import { campaignComplete, missionsWon, NO_PROGRESS, withWin } from "../src/campaign/progress";

describe("the campaign's ending (22-campaign §7a)", () => {
  it("plays the date, Tokyo Bay, the signing, the flyover, then the war's end, in that order", () => {
    expect(SHOTS.map((s) => s.id)).toEqual(["title", "bay", "signing", "flyover", "end"]);
    expect(SHOTS[0]?.caption).toBe("2 September 1945 · Tokyo Bay");
    expect(SHOTS[SHOTS.length - 1]?.caption).toBe("The war is over.");
    expect(SHOTS.some((s) => s.caption.includes("USS Missouri"))).toBe(true);
  });

  it("each moment of the film belongs to one shot, and past the end the last shot holds", () => {
    SHOTS.forEach((shot, i) => {
      expect(shotAt(shotStart(i)).shot.id).toBe(shot.id);
      expect(shotAt(shotStart(i) + shot.length - 1).shot.id).toBe(shot.id);
    });
    expect(shotAt(ENDING_LENGTH + 60_000).shot.id).toBe("end");
  });

  it("two of the Japanese delegation sign first, then an Allied officer, all within the signing shot", () => {
    expect(SIGNERS.map((s) => s.who)).toEqual(["delegateCivilian", "delegateMilitary", "alliedOfficer"]);
    const signing = SHOTS.find((s) => s.id === "signing");
    for (const [i, s] of SIGNERS.entries()) {
      expect(s.walk).toBeLessThan(s.sign);
      expect(s.sign).toBeLessThan(s.back);
      expect(s.back + 1400).toBeLessThanOrEqual(signing?.length ?? 0);
      const before = SIGNERS[i - 1];
      if (before) expect(s.walk).toBeGreaterThanOrEqual(before.back);
    }
  });

  it("names no real person, as the commanders don't (06-commanders §1)", () => {
    const words = SHOTS.map((s) => s.caption).join(" ");
    for (const name of ["MacArthur", "Nimitz", "Halsey", "Fraser", "Shigemitsu", "Umezu", "Hirohito", "Truman", "Wainwright", "Percival"]) {
      expect(words).not.toContain(name);
    }
  });

  it("its last line says how much of the campaign was won", () => {
    expect(summaryLine(14, 14)).toBe("Campaign complete: all 14 missions won.");
    expect(summaryLine(12, 14)).toBe("Campaign complete: 12 of 14 missions won.");
  });
});

describe("when the campaign is complete (22-campaign §7a)", () => {
  const last = MISSIONS[MISSIONS.length - 1]?.map ?? "";

  it("the campaign is complete once its last mission is won, and not before", () => {
    const allButLast = MISSIONS.slice(0, -1).reduce((p, m) => withWin(p, m.map), NO_PROGRESS);
    expect(campaignComplete(MISSIONS, allButLast)).toBe(false);
    expect(campaignComplete(MISSIONS, withWin(allButLast, last))).toBe(true);
  });

  it("counts the missions won", () => {
    expect(missionsWon(MISSIONS, NO_PROGRESS)).toBe(0);
    expect(missionsWon(MISSIONS, withWin(withWin(NO_PROGRESS, "gazala"), "not-a-mission"))).toBe(1);
  });
});
