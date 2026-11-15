import { describe, expect, it } from "vitest";
import { parseArtPack } from "../src/game/artPack";
import { SOUND_IDS } from "../src/game/sound/sounds";
import defaultPack from "../public/assets/packs/default/pack.json";

// The sound files themselves, listed through Vite (keys only; nothing is loaded), so this file is
// checked by tsconfig.json.
const soundFiles = Object.keys(import.meta.glob("../public/assets/sounds/*.wav"));

describe("the default pack's sound files (16-sound §7, §9)", () => {
  it("every sound has a file, and every file the pack names is there", () => {
    const pack = parseArtPack(defaultPack);
    for (const id of SOUND_IDS) {
      const files = pack.sounds[id] ?? [];
      expect(files.length, id).toBeGreaterThan(0);
      for (const file of files) expect(soundFiles, file).toContain(file.replace("../../sounds/", "../public/assets/sounds/"));
    }
  });
});
