# Topic Doc 11: Tech Setup and Build Plan

**Status:** Decided. Phase 0 done (live at https://kevinandhwaboon.github.io/aw-ww2/). Phase 1 milestones 1 (engine skeleton), 2 (movement), 3 (combat), 4 (economy), All of Phase 1 is done: milestones 1 to 8.
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
- **Undo** is a playtesting convenience, not a game rule: it restores the state before your last action this turn. It's cleared at End Turn and by any attack, because luck reveals information a redo could exploit.

## 3c. Controls (current)

| Action | Mouse | Keyboard |
|---|---|---|
| Move cursor | Move the mouse | Arrow keys |
| Select unit / choose destination / choose menu item | Left click | Z, Enter or Space |
| Cancel | Right click, or click outside the menu | X, Esc or Backspace |
| Show any unit's move and threat range | Hold right click on it, with nothing selected | Hold X on it, with nothing selected |
| Fire at a target | FIRE in the menu, then click a red target | Z on FIRE, arrow keys, Z on the target |
| Capture a property | CAPTURE in the menu | Z on CAPTURE |
| Build a unit | Click your empty factory, then a unit | Z on the factory, arrow keys, Enter |
| Load or join | Move onto your Halftrack or a damaged unit of the same type, then LOAD or JOIN | The same with arrow keys and Z |
| Unload | UNLOAD in the menu, then click a blue tile | Z on UNLOAD, arrow keys, Z on the tile |
| Show an enemy's move and threat range | Click the enemy | Z on the enemy |
| Undo last move this turn | Undo button | U or Cmd/Ctrl+Z |
| End turn | End Turn button | E |
| Resign | Resign button, then click again to confirm | None |

## 3d. Combat notes (milestone 3)

- **`src/engine/combat.ts`** holds the combat rules and is shared by the engine and the UI, so the forecast, target highlights and real results can't disagree. A property test checks that actual damage always falls inside the forecast.
- **Attack** is another end action on the Move command: `{ type: "attack", target }`. The attacker fires from its destination; indirect units need an empty path.
- **Damage is computed in whole numbers** (the formula in 03-combat §1, multiplied out), so float error can't change a result.
- **One weapon per chart cell:** a unit out of primary ammo can only attack targets the chart gives a secondary (`*`) value for. So a Medium Tank with no shells can still hit infantry but can't hit tanks at all.
- **The combat event** carries the whole result (both strikes, luck, final HP, destruction, promotions). `damage` is the HP actually removed, so overkill is capped. The UI plays it back as a nudge, flash, floating number and explosion, then a promotion label.
- **Threat range:** clicking an enemy shows where it can move (orange) and what it can hit beyond that (red). Indirect units show only their range from where they stand.

## 3e. Economy notes (milestone 4)

- **`src/engine/turn.ts`** runs the start of every turn in 04-economy §2's order: income, then repair and resupply, then units become ready. `createGame` runs it too, so the first player collects income on day 1.
- **`src/engine/economy.ts`** holds capture and build rules, shared by the engine and the menus, so a menu never offers something the engine would reject.
- **Capture** is an end action on Move, and `build` is its own command. Properties record which unit is capturing them, so progress resets if that unit leaves or dies.
- **Availability:** each player has a `buildable` list, set by the scenario. The default is every unit in the phases built so far. The demo map leaves Heavy Tank and Rocket Artillery out for the US.
- **Not yet:** capturing an HQ only changes its owner until milestone 6 adds victory checks. Halftrack automatic resupply comes in milestone 5, and daily fuel for air and naval units in phase 2.

## 3f. Transport notes (milestone 5)

- **`src/engine/transport.ts`** holds load, unload, supply and join, shared by the engine and the menus.
- **Passengers live inside their transport** (`unit.cargo`), not in `GameState.units`. So they can't be targeted, aren't repaired, and die with the transport without counting as kills. A unit that boards also counts as leaving any property it was capturing.
- **Load and Join** are the only end actions that stop on an occupied tile; every other action still needs an empty one.
- **Hold to see a range:** with nothing selected, holding X or the right mouse button on any unit shows where it can move and what it can hit. With something selected, they cancel as before. Clicking an enemy still shows its range until the next click.

## 3g. Win conditions (milestone 6)

- **`src/engine/victory.ts`** holds them. A scenario lists its `victory` conditions (default: `hqCapture` and `rout`). Each condition is a rule saying when it's checked and who it defeats, so new kinds such as hold objectives or survive N turns are new entries.
- **When they're checked:** HQ capture straight after the capture; rout at the end of each turn, as 04-economy §8 says. So a player whose last unit dies still finishes that turn.
- **Resign** is a command for the current player, available in every scenario.
- **Once `state.result` is set**, `apply` rejects every command with `gameOver`, and the UI locks input and shows the results screen.
- **New Game** reloads the page for now. Choosing a map comes with the game shell in milestone 8.

## 3h. Fortifications (milestone 7)

- **`GameState.fortifications`** lists each standing Bunker and Obstacle with its HP. Terrain lives in state, so breaking one replaces the tile.
- **Attacking one** is the `attackFort` end action on Move, targeting a tile. Its rules are in `src/engine/combat.ts`, next to unit combat, and the menus and the forecast use the same code.
- **The UI draws a damaged fortification's HP** like a unit's, and redraws any tile whose terrain changed.

## 3i. Game shell (milestone 8)

- **`src/main.ts`** shows the title screen or, with `?map=`, starts straight away. **`src/session.ts`** is one game in progress. **`src/ui/screens.ts`** has the title and map select.
- **Hot-seat:** with the pass-the-device option on, a full screen waits between turns until the next player presses Ready. With it off, the turn banner shows instead.
- **Luck seeds** are random for each new game unless `?seed=` fixes one. They're not part of a scenario file.
- **Saving:** `saveGame` and `loadGame` in `src/engine/save.ts` work and are tested, but no screen uses them yet, since save/load isn't in the MVP (00-master-design §5).

## 4. Data files

- Unit stats, terrain and the damage chart are **typed TypeScript data** (`as const satisfies UnitDef` etc.), not raw JSON. They're still pure data with no logic, but typos and missing fields fail the build.
- Scenarios are JSON files in `src/scenarios/`, validated when loaded by `src/engine/scenario.ts`. A bad file fails with a message naming the scenario and the problem. To add one, write the file and list it in `src/scenarios/index.ts`.
- Maps are currently written as text rows in the scenario file, using the legend in `src/engine/map.ts`. **Tiled is deferred** until real tile art exists (08-art-pipeline), because Tiled needs a tileset image and our tiles are still drawn in code.
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

### Phase 2: Systems

Rules: 05-supply-transport §5–9, 04-economy §8, 09-ai. Each milestone ends playable.

| # | Milestone | Engine | Presentation |
|---|---|---|---|
| 9 | Air | Air units, daily fuel and crashing, airfield build and repair, Flak Gun | Air markers, a map with an airfield |
| 10 | Naval | Ships, daily fuel and sinking, port build and repair, Dive and Surface | Ship markers, submerged marker, a coastal map |
| 11 | Landings and drops | Unload action takes one or two passengers; Landing Craft beach rules; Transport Aircraft drops | Multi-unload flow, drop tiles, a small amphibious map |
| 12 | Victory conditions | `captureProperties`, `holdProperties`, `surviveDays` | Objectives shown in-game and on the results screen |
| 13 | CO hooks | Modifier scopes that depend on the target (for example attack vs infantry); luck modifiers (03-combat §7) | Modifier list in the unit panel |
| 14 | AI interface | `legalCommands`, `AiView`, session support for AI players, command limit | Human or AI choice per player, locked input during AI turns |
| 15 | First AI | The Greedy AI (09-ai §4), AI vs AI tests, a performance benchmark | Playable single-player on every map |

Air and naval rules come first because the AI has to handle them. The Normandy theater stays in phase 4.

### Phase 2 decisions

All accepted on 2026-10-31.

| # | Decision | Answer | Note |
|---|---|---|---|
| D1 | Do air and naval units burn fuel on day 1? | No | I remember the original skipping day 1, but couldn't confirm it |
| D2 | Can Transport Aircraft drop onto Hills, Bocage and River? | Yes, anywhere foot units can enter | The original has no equivalent. Bocage drops were historically real |
| D3 | Can a transport unload both passengers in one action? | Yes | Not confirmed for the original, but one at a time would make a two-unit craft much weaker |
| D4 | Can a loaded Halftrack board a Landing Craft? | No | Simpler rules. Not confirmed for the original |
| D5 | Are submerged submarines hidden from the enemy? | No: shown to everyone with a marker | The original hides them, but both players share a screen and there's no fog of war. Real hiding belongs with fog of war |
| D6 | Is the victory condition list right? | Yes: capture, hold, survive | Enough for "hold Bastogne for 10 turns" and Normandy |
| D7 | Should the order stay air, naval, landings, then AI? | Yes | The alternative is AI first, on land only, so single-player arrives sooner but has to be extended twice |
| D8 | Should the AI run in a Web Worker from the start? | No: main thread now, with an async interface | Workers matter once community AIs exist |
| D9 | Should the first AI use Landing Craft and Transport Aircraft? | No | Amphibious planning is much harder and comes after a solid basic AI |

A playable deathmatch exists after milestone 3: the first real playtest.

## 7. Debug aids

- A toggleable rules-debug overlay: current state as JSON, RNG seed, command log. **Exists since milestone 1:** the hello map runs a demo game (`src/game/maps/hello.ts`) with a turn bar and End Turn button, a unit panel showing engine-computed stats and the modifiers affecting them, and a collapsible Debug panel (event log + state JSON).
- `npm run test:ui`: Vitest's browser UI, for reading and rerunning the rule tests.
- URL parameters: `?map=bocage-country` skips the menus and starts that scenario, `?seed=123` fixes the luck rolls, `?luck=off` turns luck off, `?handoff=off` skips the pass-the-device screen.
