# Topic Doc 11: Tech Setup and Build Plan

**Status:** Decided. Phase 0 done (live at https://kevinandhwaboon.github.io/aw-ww2/). Phase 1 milestones 1 (engine skeleton) and 2 (movement) done.
**Last updated:** 2026-10-24
**Depends on:** 00-master-design.md (sections 10, 11, 16).

---

## 1. Tooling

| Area | Choice | Why |
|---|---|---|
| Runtime / package manager | Node.js LTS + npm | Standard; no extra tools |
| Language | TypeScript, `strict` plus `noUncheckedIndexedAccess` and `exactOptionalPropertyTypes` | Strongest compile-time safety net for AI-written code |
| Build / dev server | Vite | Fast, simple, static output |
| Game framework | Phaser 4 (pinned exact version) | Presentation only |
| Unit tests | **Vitest** | Native to Vite, same config, fast |
| Property tests | fast-check (from milestone 1) | Invariants and determinism over random command sequences |
| Browser tests | Playwright (later, once there's UI to test) | Smoke tests of the deployed game |
| Lint | ESLint (typescript-eslint) | Enforces the engine boundary (section 3) |
| CI | GitHub Actions: typecheck, lint, test, build | Every push and pull request |
| Deploy | GitHub Pages via Actions, on push to `main` | Every merged change is playable at a URL |

## 2. Repo layout

```
/
├─ CLAUDE.md                 standing build instructions
├─ docs/                     design docs (source of truth for rules)
├─ index.html                page shell: canvas container + HTML overlay root
├─ src/
│  ├─ engine/                PURE rules engine: no DOM, no Phaser
│  │  ├─ data/               unit, terrain, damage chart as typed data
│  │  └─ ...
│  ├─ game/                  Phaser scenes: map rendering, input → commands, event playback
│  ├─ ui/                    HTML/CSS overlay: HUD, menus, screens
│  └─ main.ts                wires engine, Phaser and UI together
├─ tests/                    engine tests (*.test.ts), mirroring src/engine
├─ public/assets/            sprite sheets, fonts, maps (Tiled JSON)
├─ tools/                    scripts (sprite generation, map conversion)
└─ .github/workflows/        CI and deploy
```

## 3. Engine boundary (enforced, not by convention)

- `src/engine` has its own `tsconfig` with **no DOM library**, so any use of `window`, `document` or browser APIs fails to compile.
- ESLint forbids `src/engine` from importing `phaser` or anything in `src/game` or `src/ui`.
- The engine is deterministic: no `Math.random`, no `Date`. All randomness comes from the seeded RNG stored in `GameState`.
- Engine API: `apply(state, command) → { state, events }` (or a typed rejection). State is plain serializable data and is never mutated in place.
- Public API: `src/engine/index.ts`. Presentation and AI code import only from there.

## 3a. Engine design notes (milestone 1)

- **RNG:** mulberry32. Its whole state is one unsigned 32-bit integer in `GameState.rng`, so it serializes exactly.
- **Modifier layer:** game logic reads unit and terrain numbers only through `src/engine/stats.ts`, never from the data tables. A modifier is data: `{ source, stat, op: add | multiply | set, value, scope? }`. For one stat, adds are summed onto the base, then multiplies apply, then a set overrides (last wins). The result is rounded down and never below 0.
  - Scenario, commander and weather modifiers live in `GameState.modifiers`. Veterancy isn't stored; it's derived from each unit's kill count at lookup time.
  - Scopes can limit a modifier to players, unit types, unit categories and the terrain the unit stands on.
- **Damage chart:** stored as row strings that match the tables in 03-combat §5 cell for cell ("55", "55*", "—"), so the doc and the data can be compared side by side. It's parsed and validated when the module loads.
- **Player ids** are indexes into `GameState.players`, which is also the turn order.
- **Setup errors** (bad scenario data) throw. **Command errors** (illegal moves) return a typed rejection.

## 3b. Engine and UI design notes (milestone 2)

- **Move is one atomic command:** `{ type: "move", unitId, path, action }`. The path lists the tiles stepped onto (excluding the start; empty = act in place), and `action` is what the unit does at the end (`wait` for now; attack, capture, load, join, unload and supply plug in later). As in the original, a move isn't final until an action is chosen. The UI previews the move locally, and only the chosen action sends a command.
- **Pathfinding** lives in `src/engine/movement.ts` and is shared by the engine (validation) and the UI (ranges, path arrow), so they can't disagree. A unit's budget is min(move points, fuel). Enemy units block; friendly units (same side) can be passed through but not stopped on.
- **Terrain costs are a modifiable stat** (`moveCost`, scoped by the terrain being entered), so weather or commanders can change them later. Modifiers can't make impassable terrain passable, and a passable tile always costs at least 1.
- **Path arrow** (`src/game/pathBuilder.ts`): follows the cursor tile by tile while affordable, cuts back when retraced, otherwise snaps to the cheapest path.
- **Input** (`src/game/controller.ts`): a state machine (idle → selected → menu → busy) that talks to the map through a `MapView` interface, so input rules and drawing are separate.
- **Event playback:** after the engine accepts a command, the UI animates its events with input locked, then shows the new state. At the start of each turn a banner names the player.
- **Undo** is a playtesting convenience, not a game rule: it restores the state before the last move this turn. It's cleared at End Turn, and must also be cleared after anything that reveals new information (combat luck, in milestone 3).

## 3c. Controls (current)

| Action | Mouse | Keyboard |
|---|---|---|
| Move cursor | Move the mouse | Arrow keys |
| Select unit / choose destination / choose menu item | Left click | Z, Enter or Space |
| Cancel | Right click, or click outside the menu | X, Esc or Backspace |
| Show an enemy's move range | Click the enemy | Z on the enemy |
| Undo last move this turn | Undo button | U or Cmd/Ctrl+Z |
| End turn | End Turn button | E |

## 4. Data files

- Unit stats, terrain and the damage chart are **typed TypeScript data** (`as const satisfies UnitDef` etc.), not raw JSON. They're still pure data with no logic, but typos and missing fields fail the build.
- Scenarios and maps are JSON (Tiled export plus a scenario file), validated when loaded.
- Tests build maps from small ASCII grids for readability.

## 5. Testing approach

- Each rule is written first as a **plain-language behavior spec**, used as the test name (for example "indirect units are never countered"), traceable to a design doc section.
- Engine tests are scenario-style: given a small map and units, apply commands, check the state and events.
- Property tests: HP stays within 0–100, funds never go negative, replaying the same commands from the same seed gives identical state.
- The developer reviews the spec list against the design docs, then plays the deployed build.

## 6. Build plan

### Phase 0: Setup
1. Git repo, Vite + strict TS + Phaser + Vitest + ESLint scaffold.
2. `CLAUDE.md` with standing rules.
3. CI and GitHub Pages deploy workflows.
4. "Hello map": a placeholder 16×16 tile grid rendered at integer scale, with HTML overlay root. Done = live URL.

### Phase 1: Core MVP (each milestone ends playable)

| # | Milestone | Engine | Presentation |
|---|---|---|---|
| 1 | Engine skeleton | `GameState`, `apply`, seeded RNG, modifier pipeline (all stat lookups pass through it), unit + terrain + damage data | — |
| 2 | Move | Pathfinding per movement type, fuel, enemy blocking, `Move` / `Wait` / `EndTurn`, undo last move | Cursor, move range, path arrow, event playback queue with input lock |
| 3 | Fight | Damage formula, weapon choice, ammo, counters, indirect fire, luck + no-luck option, forecast | Attack range, action menu, forecast, on-map hit effects |
| 4 | Economy | Capture, income, `Build`, repair and resupply on properties | HTML HUD (funds, day, terrain and unit info), HTML build menu |
| 5 | Supply and transport | Halftrack load / unload / supply, join, veterancy | Load/unload flow, veterancy badges |
| 6 | Win conditions | Pluggable victory checks: HQ capture, rout, resign | Results screen |
| 7 | Fortifications | Bunker / Obstacle HP, attack-only-when-empty, broken states | Fortification HP display |
| 8 | Game shell | Scenario format, 2–3 small test maps (one bocage-flavored), state serialization | Title, map select, hot-seat "pass the device" screen |

A playable deathmatch exists after milestone 3: the first real playtest.

## 7. Debug aids

- A toggleable rules-debug overlay: current state as JSON, RNG seed, command log. **Exists since milestone 1:** the hello map runs a demo game (`src/game/maps/hello.ts`) with a turn bar and End Turn button, a unit panel showing engine-computed stats and the modifiers affecting them, and a collapsible Debug panel (event log + state JSON).
- `npm run test:ui`: Vitest's browser UI, for reading and rerunning the rule tests.
- A URL parameter to load a specific test map and seed.
