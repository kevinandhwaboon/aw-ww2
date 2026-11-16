import { describe, expect, it } from "vitest";
import { NATIONS, type NationId } from "../src/engine/data/nations";
import { FLAGS } from "../src/game/placeholderFlags";

describe("HUD flags", () => {
  it("every nation has a flag, all the same size", () => {
    for (const nation of Object.keys(NATIONS) as NationId[]) {
      expect(FLAGS[nation]).toHaveLength(9);
      for (const row of FLAGS[nation]) expect(row).toHaveLength(16);
    }
  });
});

describe("Italy's flag (00-master-design §6)", () => {
  it("is the plain green, white and red tricolour: three equal-ish bands and nothing else, no crest", () => {
    for (const row of FLAGS.italy) expect(row).toBe("VVVVVWWWWWWRRRRR");
  });
});
