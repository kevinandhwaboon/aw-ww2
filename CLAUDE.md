# CLAUDE.md

A turn-based WW2 tactics game in the browser, inspired by Advance Wars mechanics. TypeScript + Phaser 4 + Vite, static site on GitHub Pages.

## Read first

- `docs/00-master-design.md` is the hub: vision, architecture, decision log. Topic docs (`docs/01-…` to `docs/11-…`) hold the detailed rules.
- **The docs are the source of truth for game rules.** If code and docs disagree, the docs win. If a rule isn't in the docs, it hasn't been decided: ask, or follow the original game's mechanism (the project's default rule) and record the choice in the relevant topic doc and the master decision log.
- `docs/11-tech-setup.md` has the repo layout and the phased build plan. Check which milestone is current before starting work.

## Who you're working with

The developer is an experienced software engineer, new to game development, and **mostly does not read the code**. They review by reading test names and by playing the deployed build. So:

- Quality comes from strict types, tests and playable builds, not code review.
- When finishing work, say what to try in the game to see the change.
- Keep test names readable as plain-language rules.

## Architecture rules (non-negotiable)

- `src/engine/` is the pure rules engine: **no DOM, no Phaser, no `Math.random`, no `Date`**. Its tsconfig has no DOM library and ESLint blocks forbidden imports. Don't work around either.
- Engine API: `apply(state, command) → { state, events }` or a typed rejection. `GameState` is plain serializable data, never mutated in place.
- All randomness uses the seeded RNG stored in `GameState`.
- Every stat lookup (move, attack, defense, cost, vision, …) goes through the modifier layer, even while no modifiers exist.
- Game data (units, terrain, damage chart) lives in `src/engine/data/` as typed data with no logic. Balancing is a data edit.
- The presentation layer (`src/game/` Phaser, `src/ui/` HTML overlay) only draws state, plays events and turns input into commands. It never decides outcomes.

## Testing

- Every rule gets an engine test whose name states the behavior in plain language and cites the doc section, e.g. `it("indirect units are never countered (03-combat §2)")`.
- Prefer small scenario tests: ASCII map + units → commands → assertions on state and events.
- Run `npm run check` (typecheck, lint, tests) before calling work done.

## Commands

- `npm run dev`: local dev server
- `npm run check`: typecheck + lint + tests
- `npm test`: tests only
- `npm run build`: production build into `dist/`

## Conventions

- TypeScript strict, plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes`. No `any`.
- Pin dependency versions exactly.
- Original art and names only: no Nintendo names, art or UI copies. No Nazi or political symbols.
