import { defineConfig } from "vitest/config";

export default defineConfig({
  // Relative asset paths so the build works under any GitHub Pages sub-path.
  base: "./",
  // Phaser alone is ~1.3 MB minified; that's expected for a game bundle.
  build: { chunkSizeWarningLimit: 2000 },
  test: {
    include: ["tests/**/*.test.ts"],
  },
});
