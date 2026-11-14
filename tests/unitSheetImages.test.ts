import { describe, expect, it } from "vitest";
import { parseArtPack } from "../src/game/artPack";
import defaultPack from "../public/assets/packs/default/pack.json";

// The sheet images themselves, read as data URLs through Vite (so this file is checked by tsconfig.json).
const images = import.meta.glob<string>("../public/assets/units/*.png", { query: "?inline", import: "default", eager: true });

/** A PNG's width and height: the first two numbers of its header chunk. */
function pngSize(dataUrl: string): [number, number] {
  const bytes = Uint8Array.from(atob(dataUrl.slice(dataUrl.indexOf(",") + 1)), (c) => c.charCodeAt(0));
  const header = new DataView(bytes.buffer);
  return [header.getUint32(16), header.getUint32(20)];
}

describe("the default pack's unit sheet images", () => {
  it("every one is as wide and tall as its views, frames and rows say (08-art-pipeline §22)", () => {
    for (const unitSheet of parseArtPack(defaultPack).unitSheets) {
      const image = images[unitSheet.path.replace("../../units/", "../public/assets/units/")];
      if (!image) throw new Error(`no image for ${unitSheet.path}`);
      const [width, height] = pngSize(image);
      expect(width, unitSheet.path).toBe(unitSheet.facings.length * unitSheet.frames * unitSheet.frameSize);
      expect(height, unitSheet.path).toBeGreaterThanOrEqual(unitSheet.rows.length * unitSheet.frameSize);
    }
  });
});
