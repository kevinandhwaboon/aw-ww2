import js from "@eslint/js";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.strictTypeChecked,
  {
    languageOptions: {
      globals: globals.browser,
      parserOptions: {
        projectService: { allowDefaultProject: ["eslint.config.js"] },
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      "@typescript-eslint/restrict-template-expressions": ["error", { allowNumber: true }],
      "@typescript-eslint/no-confusing-void-expression": ["error", { ignoreArrowShorthand: true }],
    },
  },
  {
    files: ["eslint.config.js"],
    ...tseslint.configs.disableTypeChecked,
  },
  {
    // The rules engine stays pure: no rendering, no DOM, no hidden randomness or clock
    // (00-master-design §11, CLAUDE.md).
    files: ["src/engine/**/*.ts"],
    languageOptions: { globals: {} },
    rules: {
      "no-restricted-imports": [
        "error",
        {
          patterns: [
            { group: ["phaser", "phaser/*"], message: "The engine must not depend on Phaser." },
            { group: ["**/game/**", "**/ui/**", "**/main"], message: "The engine must not import presentation code." },
          ],
        },
      ],
      "no-restricted-properties": [
        "error",
        { object: "Math", property: "random", message: "Use the seeded RNG in GameState." },
      ],
      "no-restricted-globals": [
        "error",
        { name: "Date", message: "The engine must be deterministic; no clock access." },
        { name: "window", message: "No DOM in the engine." },
        { name: "document", message: "No DOM in the engine." },
      ],
    },
  },
);
