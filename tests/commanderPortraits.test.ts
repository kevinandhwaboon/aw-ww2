import { describe, expect, it } from "vitest";
import { COMMANDER_IDS } from "../src/engine/data/commanders";
import { parseArtPack } from "../src/game/artPack";
import defaultPack from "../public/assets/packs/default/pack.json";
import nightOps from "../public/assets/packs/night-ops/pack.json";

// The portrait files themselves, listed through Vite (keys only; nothing is loaded), so this file is
// checked by tsconfig.json.
const portraitFiles = Object.keys(import.meta.glob("../public/assets/commanders/*.png"));

describe("the shipped packs' commander portraits (06-commanders §4)", () => {
  it("every commander has a portrait from the waist up and a bust for lists, in both packs", () => {
    for (const raw of [defaultPack, nightOps]) {
      const folder = parseArtPack(raw).commanderPortraits;
      expect(folder).not.toBeNull();
      for (const id of COMMANDER_IDS) {
        for (const file of [`${id}.png`, `${id}-bust.png`]) {
          expect(portraitFiles, file).toContain(`${folder}${file}`.replace("../../commanders/", "../public/assets/commanders/"));
        }
      }
    }
  });
});
