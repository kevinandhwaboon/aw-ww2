// Reads the page stylesheet, so it needs Vite's types and is left out of the engine typecheck
// (tsconfig.engine.json); the app typecheck (tsconfig.json) still covers it.

import { describe, expect, it } from "vitest";
import { BUILT_IN_PACK, PAGE_COLORS } from "../src/game/artPack";
import pageStyles from "../src/ui/style.css?raw";

describe("page colors (08-art-pipeline §13)", () => {
  const rootRule = /:root\s*\{([^}]*)\}/.exec(pageStyles)?.[1] ?? "";
  const cssDefault = (variable: string) => new RegExp(`${variable}:\\s*(#[0-9a-fA-F]{6})\\s*;`).exec(rootRule)?.[1];

  it("every color variable in the page styles is set from the art pack", () => {
    const declared = [...rootRule.matchAll(/(--[\w-]+):\s*#/g)].map((m) => m[1]);
    expect(declared.sort()).toEqual(Object.keys(PAGE_COLORS).sort());
  });

  it("the page's colors before a pack loads match the built-in pack", () => {
    for (const [variable, key] of Object.entries(PAGE_COLORS)) {
      expect(cssDefault(variable), variable).toBe(BUILT_IN_PACK.colors[key]);
    }
  });
});
