# Master Design Doc: WW2 Turn-Based Tactics (working title TBD)

**Status:** Big-picture decisions made. Units, combat, terrain, economy, land supply and tech setup decided as v0. Phases 0 and 1 are done. Phase 2 is under way, with milestones 9 (air), 10 (naval), 11 (landings and drops), 12 (victory conditions), 14 (AI interface) 15 (the Greedy AI) and 16 (Greedy v2) done. Milestone 13 (CO hooks) is still to do.
**Last updated:** 2026-10-24
**How to use this doc:** This is the hub. Every chat in this project should read it first. Detailed topics get their own docs (see Topic Doc Index). If a decision isn't written here or in a topic doc, it hasn't been made.

---

## 1. Vision

A turn-based, grid-based military strategy game inspired by the mechanics and feel of Advance Wars (GBA era), re-imagined with World War II units, nations and battles. It runs in a web browser so any platform can play it. The long-term goal is to recreate major WW2 battles and campaigns, culminating in a theater-scale Normandy scenario.

## 2. Project goals

The two goals are equally weighted:

1. **Learn AI-assisted development**: see how building software with AI differs from traditional pre-AI software engineering. The developer is an experienced software engineer, new to game development, and will mostly not read the code. Quality is ensured through types, automated tests and playtesting.
2. **Have a game worth playing.**

## 3. Inspiration and IP boundaries

- We borrow **mechanics and feel**: grid map, unit matchups, capturing cities for income, factories, turn structure, CO-style powers.
- We do **not** use Nintendo's art, unit names, commander characters, music, title, or UI layouts copied pixel-for-pixel. All art and names are original.
- The working title must not include "Advance Wars". Title TBD.
- **Default rule for open choices:** when a game-mechanics decision is unclear, follow the original game's mechanism unless there's a clear reason not to.

## 4. Phased roadmap

| Phase | Content |
|---|---|
| **0: Setup** | Repo, tooling, CLAUDE.md, CI, deploy pipeline, test map |
| **1: Core MVP** | Hot-seat player vs. player on small test maps. Land units, terrain, movement, combat, capture, income, production, fuel/ammo, win conditions. Map-level combat effects only. |
| **2: Systems** | Air and naval units, transports and amphibious unloading, modifier layer (CO hooks), scenario-defined victory conditions, the pluggable AI interface and a first basic AI |
| **3: Content and polish** | Commanders, battle cutscene art (a code-drawn version exists since 2026-11-07), more scenarios, better art, mobile phone layout |
| **4: Normandy theater** | Full Normandy + southeastern England theater map and scenario |
| **Later / maybe** | Fog of war, save/load, campaign mode, custom community AIs, online multiplayer |

The Normandy theater is the north star, but it's designed and built **last**, after the core gameplay is proven on small maps.

## 5. Gameplay: in and out

**In (target feature set):**
- Turn-based, square-grid map
- Unit types with rock-paper-scissors matchups (damage chart)
- Terrain with movement costs and defense bonuses
- Capturing properties (cities, factories, ports, airfields, HQ) for income
- Building units at production properties
- Fuel and ammo
- Commanders with special powers (post-MVP; see section 7)
- Player vs. player hot-seat (same device, taking turns), as the MVP
- Player vs. AI (post-MVP, pluggable)

**Out for now:**
- Fog of war (may return later)
- Online multiplayer
- Save/load (the architecture should make it easy to add later)
- Battle cutscene (deferred; see section 13)
- Full phone playability (deferred; tablet and desktop first)

## 6. Factions and historical presentation

- Two sides: **Allies** and **Axis**. Specific nations per scenario (for example US, UK, Canada vs. Germany for Normandy, or the US vs. Japan for Iwo Jima). Nations so far: US, UK, Canada, Soviet Union (Allies); Germany and Japan (Axis). Only the US, Germany and Japan have their own art yet.
- Nations are named for the country, never one service: "US", not "US Army", since US forces include Marines and the Navy.
- **Units are generic in stats** (Light Tank, Heavy Tank, Fighter, etc.) and **identical in capability regardless of side**. Their art mirrors real WW2 equipment per nation (for example a Sherman vs. a Panzer IV for the same unit type).
- **Historical asymmetry comes from availability, not stats.** A nation has art for a unit type only if it historically fielded an equivalent, and scenarios only offer a nation the unit types it has art for (for example no US Heavy Tank in Normandy).
- Later, commanders may modify a side's unit performance, as COs did in the original.
- **No Nazi or political symbols.** Sides are identified by color and equipment silhouettes. Any national insignia use is a future decision (TBD); the swastika is never used. Japan is shown only with its national flag, the plain red disc (hinomaru), on its HUD flag and its aircraft; the rising-sun ensign is never used.
- MVP historical detail is limited to the units themselves. Briefings, real names, dates and so on come later.
- Unit roster: see **01-units.md**. 13 land units (12 in MVP, Flak Gun in phase 2), 5 air (Dive and Torpedo Bombers added for Carriers), 6 naval (the Carrier added for the Pacific).

## 7. Commanders (COs): deferred, hook built early

- Not in the MVP.
- **The rules engine includes a modifier layer from day one.** Movement, attack, defense, cost, vision and similar values pass through modifiers so COs, doctrines, weather or scenario rules can be added as data later.
- Open design question: **real generals vs. doctrines vs. fictional archetypes.**
  - Real generals map well to CO-style powers (examples: Patton for aggressive armor and mobility; Montgomery for methodical set-piece battle, artillery and defense; Rommel for bold mobile warfare with risk; Zhukov for massed artillery and cheap units; Rundstedt/Model for defense in depth and counterattacks).
  - Conventions if real generals are used: military commanders only, no political leaders, no glorification, case-by-case care for commanders with war-crimes history.
  - Alternative: doctrine-based powers ("Combined Arms Breakthrough", "Methodical Battle", "Deep Battle"), optionally attached to names later.
- Commander AI personalities (section 15) can use the same modifier and behavior hooks.

## 8. Scenarios

- Scenarios **start historically accurate** (forces and positions) and **play out freely**.
- Later, scenarios can add objectives, scripted events, reinforcement schedules and turn limits that push toward history (for example "hold Bastogne for 10 turns").
- **Victory conditions are defined per scenario** (eliminate, capture HQ, capture/hold objectives, survive N turns, etc.). This is required to balance asymmetric historical battles.
- **First major scenario: Normandy (combined arms)**, built in phase 4.
  - Theater map covering the whole Normandy region **and southeastern England**, to represent the Allied buildup of ground, naval and air forces.
  - Asymmetric: large Allied buildup vs. limited German forces (most German effort was on the Eastern Front). German strengths come from fortifications (Atlantic Wall), bocage terrain, defensive positions and arriving reinforcements.
  - **Fortifications are terrain** with a large defense bonus. They do nothing unless the defender places units on them. Fortifications and obstacles have HP and are cleared by attacking them (like the original's pipe seams); Assault Infantry is strong against them.
- Phase 1 test maps are small and need not be historical. An inland Normandy-flavored map (for example bocage country) is a good bridge.

## 9. Map and unit scale

- Unit scale should match the original's abstract feel (not explicitly divisional). **TBD and expected to be tuned.**
- Known tension: a theater-scale map at the original's unit scale means many tiles and/or many units. Movement ranges, Channel crossing time and unit counts must be designed together.
- Large maps scroll (section 12, "Camera"). Still to design: minimap, jump-to-unit, "next idle unit" cycling, multi-turn move orders, possibly reserve areas or a lighter buildup phase to reduce turn tedium.

## 10. Technology

| Area | Choice |
|---|---|
| Language | **TypeScript** (strict). Types are a safety net for AI-written code. |
| Game framework | **Phaser 4** (presentation layer only) |
| Build tool | **Vite** |
| Map editor | **Tiled** (maps exported as JSON, loaded by Phaser) |
| Non-map UI | **HTML/CSS overlay** (see section 12) |
| Tests | Vitest for the rules engine, fast-check property tests, Playwright browser tests later (11-tech-setup) |
| Hosting | **Static site, no server.** All code runs in the browser. GitHub Pages (free). |
| Version control | Git / GitHub |

**Why Phaser over Godot:** web-first; strong large-tilemap support; code-first (everything is text an AI can write and change, with no editor-clicking); stays in the TypeScript/npm world; lets custom AIs be plain JS/TS modules. Godot was considered and rejected for this project because C# web export is still experimental, GDScript is a new language, web builds are heavier, and editor-centric work suits AI-assisted development less.

**No server needed:** a turn-based game with no online play or cloud saves is purely static files. A server only becomes relevant for online multiplayer or cloud saves; local saves can use browser storage.

## 11. Architecture

The core principle: **the game rules are completely separate from rendering.**

```
┌────────────────────────────────────────────────┐
│ Presentation (Phaser + HTML overlay)           │
│  - draws state, plays animation queue          │
│  - turns taps/clicks into Commands             │
│  - never decides outcomes                      │
└───────────────▲───────────────────┬────────────┘
       events   │                   │ commands
┌───────────────┴───────────────────▼────────────┐
│ Rules engine (pure TypeScript, NO Phaser)      │
│  - GameState = plain data                      │
│  - apply(state, command) -> newState + events  │
│  - deterministic, fully unit-tested            │
│  - modifier layer (COs, doctrines, weather)    │
└───────────────▲───────────────────┬────────────┘
                │ commands          │ state
┌───────────────┴───────────────────▼────────────┐
│ Players: Human (via UI) | AI (pluggable)       │
└────────────────────────────────────────────────┘
        Data: units, damage chart, terrain,
        scenarios = JSON/data files, not code
```

- **GameState** is plain, serializable data: map, units, properties, funds, turn and day, current player.
- **Commands** describe actions: `Move`, `Attack`, `Capture`, `Build`, `Load`, `Unload`, `Wait`, `EndTurn`, etc.
- **Events** describe what happened ("unit moved along path", "attack resolved: dealt X, countered Y, defender destroyed"). The presentation layer plays events as an animation queue while input is locked.
- **Data-driven:** unit stats, the damage chart, terrain properties and scenarios live in data files. Balancing means editing data.
- **Benefits:** pluggable AI (same command interface as humans), easy saves (serialize state or replay commands), replays, undo, a path to online play, and highly testable logic.
- **Modifier layer** in from day one (section 7).
- Rules engine is a separate module/package with no Phaser dependency.

## 12. UI: Option C (hybrid)

UI falls into four categories:

| Category | Examples | Rendered in |
|---|---|---|
| Map-anchored | Cursor, movement/attack range highlights, path arrow, unit HP numbers, damage popups | **Canvas (Phaser)** |
| In-battle contextual menus | Fire / Capture / Wait / Load, turn menu (Resign / End Turn), damage forecast | **Canvas (Phaser)**, pixel style |
| HUD | Current player's flag, day counter, funds, on the side of the map away from the cursor | **HTML overlay** |
| Tile info | Terrain name, defense stars, whether the tile is a scenario objective, a property's capture points left, the name of any unit on the tile with its fuel and ammo left (shown for every side; a value that is out, or fuel within two turns of running dry, is in the accent color), and what a transport is carrying, in a bottom corner away from the cursor | **HTML overlay** |
| Full screens | Title, scenario select, briefing, results, settings | **HTML overlay** |

- HTML UI is styled retro: a shared pixel font (open-licensed), pixel-art panel frames via CSS `border-image`, crisp image scaling, and a shared palette with the canvas UI.
- Input between layers must be handled so taps on menus don't also hit the map.
- Mobile and touch considerations (for later): no hover (info follows selection), menus placed away from the finger, tap targets around 44px on screen, pan/pinch-zoom coexisting with tap-to-select, top/bottom layout in portrait.
- Factory build menu: **HTML** (it's a scrolling list). Each row shows the unit's sprite, cost, role, and what it's strong and weak against. The guide is written by hand in `src/game/unitGuide.ts`, and a test checks it against the damage chart.
- The whole game plays from the keyboard, title screen to results (11-tech-setup §3c). The mouse still works but is never required.

**Camera (large maps):**

- The map zooms up to fill the window, in whole-number steps so pixels stay crisp (section 14). It never zooms below **3×** (a square is 48 screen pixels). A map too big to fit at 3× keeps 3× and the view scrolls. Small maps look exactly as before.
- Moving the cursor with the keyboard scrolls the view, keeping **2 squares** between the cursor and the edge where the map allows. Moving it with the mouse doesn't scroll.
- A mouse wheel or a two-finger trackpad swipe scrolls the view.
- Before anything plays (a move, an attack, a capture), the view pans to show it, and it follows a moving unit square by square. Repairs at the start of a turn don't pan.
- Each turn starts with the cursor on that player's HQ (or their first unit if they have no HQ), and the view pans there.
- Menus and the damage forecast stay inside the visible part of the map. The HUD and tile info sit on the side of the screen away from the cursor, judged within the view, not the whole map.
- Not yet: edge scrolling, dragging the map, a minimap.

## 13. Combat presentation (staged)

- **MVP:** combat plays on the map. The attacker nudges toward the target, a flash/explosion shows on the defender, a floating damage number appears, then the counterattack plays the same way.
- **Built 2026-11-07** (ahead of phase 3, at the developer's request): a split-screen battle scene, as a separate Phaser scene drawn over the map, with code-drawn figures whose animations show what's distinctive about each unit. Skippable, and can be turned off. Details: 08-art-pipeline §18. The original plan follows.
- **Built 2026-11-08:** captures and foot soldiers going into a bunker also play as cut-in scenes, with the squad storming the building (08-art-pipeline §19), and a Transport Aircraft unloading plays as a static-line jump (08-art-pipeline §20).
- **Plan:** a split-screen battle cutscene as a separate Phaser scene. Terrain backgrounds, larger battle sprites, unit count reflecting HP, fire/impact/explosion effects, HP bar drain. Begin with static sprites + code-driven motion + particles; add full animated art unit by unit, falling back to the simple version where art is missing.
- **Requirement from day one:** the rules engine emits combat as a result event that the presentation plays back. The cutscene can never affect outcomes, so skip and "animations off" options come for free.

## 14. Art

- **Pixel art, GBA-era style.** Not the remake's style.
- **16×16 tiles**, the same resolution as the original, even though maps are much larger.
- Integer scaling with crisp (nearest-neighbor) rendering.
- Unit art mirrors real WW2 equipment per nation; capabilities stay generic.
- Team colors via palette swap.
- **Production approach:**
  - Claude can generate sprites as data (pixel grids with palettes) rendered to PNG sprite sheets by script. Exact grid, consistent palette, easy edits and color swaps. Good for map sprites and placeholders; weaker for large detailed sprites.
  - General AI image tools produce richer images but usually not on a true pixel grid, so they need downscaling, palette snapping and cleanup (Aseprite / LibreSprite). A cleanup script can automate part of this.
  - Art is swappable as long as sprite sheet layouts stay consistent.
- Art pipeline details (sheet layout, naming, animation): 08-art-pipeline §12. Palette: **TBD**.

## 15. AI opponent

- Not in the MVP. MVP is hot-seat PvP. The first AI, Greedy, was built on 2026-11-09 (09-ai). Greedy v2 (milestone 16, built 2026-11-13) adds threat-aware production, then landings, drops and carriers (09-ai §4a, §4b).
- **Pluggable from the start:** an AI receives game state and returns commands through the same interface a human uses.
- Long-term: AIs that mimic real commanders' tendencies, and users can write their own custom AIs as plain JS/TS modules.
- Must stay efficient enough for theater-scale unit counts.

## 16. Development workflow

- **Design** happens in claude.ai chats inside this project. One chat per topic.
- **Docs are the project's memory.** Chats don't see each other; they see project instructions and knowledge. At the end of each topic chat, update the master doc (decision log) and the relevant topic doc.
- **Building** happens in **Claude Code** inside the git repo. At that point design docs move into the repo's `docs/` folder, and a `CLAUDE.md` at the repo root holds standing build instructions.
- The developer reviews by playing, not by reading code. Quality comes from strict TypeScript, rules-engine unit tests written from plain-language behavior specs, browser tests for UI, and frequent playable builds deployed to GitHub Pages.

## 17. Topic doc index (planned)

| Doc | Status |
|---|---|
| 00-master-design.md | This doc |
| 01-units.md | **Roster, roles and provisional v0 stats decided.** Tune after playtesting |
| 02-terrain.md | **v0 decided** (original game's values; Hills, Bocage, Bunker, Rubble, Obstacle added) |
| 03-combat.md | **Rules decided; v0 damage chart and veterancy set.** Tune after playtesting |
| 04-economy-production.md | **v0 decided** (original game's income, capture, build, repair, join) |
| 05-supply-transport.md | **v0 decided**: land rules built; air, naval, landings and submarines for phase 2 |
| 06-commanders.md | TBD |
| 07-ui-ux.md | TBD: screen flows, controls, mobile |
| 08-art-pipeline.md | **Asset list done**; how to make the art is undecided |
| 09-ai.md | **v0 built**: AI interface, rules for AIs, the first Greedy AI |
| 10-scenarios-normandy.md | **First theater map (v0)**: southern England and Normandy, 92 × 78; balance untested |
| 11-tech-setup.md | **Decided**: tooling, repo layout, engine boundary, testing, phased build plan |
| 12-weather.md | **v0 decided**: Clear and Snow, set per scenario as a forecast; snow uses the original's movement costs |
| 13-scenarios-ardennes.md | **First Ardennes map (v0)**: Bastogne, 40 × 30, snow then clear; balance untested |
| 14-scenarios-pacific.md | **First Pacific map (v0)**: Iwo Jima, 36 × 26, the US vs. Japan; balance untested |

## 18. Open questions

- Working title
- Unit scale and theater map dimensions (first answer: the Normandy map is 92 × 78, see 10-scenarios-normandy)
- Tuning provisional unit stats (01-units v0) after playtesting
- Real generals vs. doctrines for COs
- National insignia policy (beyond "no Nazi or political symbols")
- Day/night? (not yet discussed). Weather: v0 decided (12-weather); random weather and rain left open
- Tuning v0 terrain values (Bocage, Bunker stars) after playtesting

## 19. Decision log

| Date | Decision |
|---|---|
| 2026-10-24 | WW2 re-imagining of Advance Wars mechanics; original art and names, no Nintendo IP |
| 2026-10-24 | Browser game, static hosting (GitHub Pages), no server |
| 2026-10-24 | MVP: hot-seat PvP; AI pluggable and post-MVP |
| 2026-10-24 | Include COs, fuel/ammo, production; exclude fog of war for now |
| 2026-10-24 | COs deferred past MVP; modifier layer built from day one |
| 2026-10-24 | Generic unit stats, identical across sides; art mirrors real equipment |
| 2026-10-24 | No Nazi/political symbols |
| 2026-10-24 | Scenarios start accurate, play out freely; per-scenario victory conditions |
| 2026-10-24 | Normandy (+ SE England) theater is the north star, built last (phase 4) |
| 2026-10-24 | GBA-style pixel art, 16×16 tiles; not the remake style |
| 2026-10-24 | Tech: TypeScript + Phaser 4 + Vite + Tiled; Godot rejected |
| 2026-10-24 | Rules engine pure TS, separate from rendering; command/event architecture |
| 2026-10-24 | UI Option C: canvas for map + battle menus, HTML overlay for HUD and screens |
| 2026-10-24 | Battle cutscene deferred; map-level combat effects in MVP; result-event design from day one |
| 2026-10-24 | Phone-sized playability deferred; desktop/tablet first |
| 2026-10-24 | Workflow: topic chats in this project, docs as memory, Claude Code for building |
| 2026-10-24 | Unit roster set (01-units): 13 land (12 MVP + Flak Gun), 3 air, 5 naval. Generic names only |
| 2026-10-24 | Fighter-Bomber cut; Fighters can attack ground units with very limited effectiveness; Flak Gun is a ground unit |
| 2026-10-24 | Rocket Artillery kept; freely available to Germany/USSR, limited for US/UK per scenario |
| 2026-10-24 | Provisional v0 unit stats set from the original game's scale and intuition; to be tuned after playtesting |
| 2026-10-24 | Default rule: when a mechanics choice is open, follow the original game |
| 2026-10-24 | Combat (03-combat): original damage formula, counterattack and weapon-choice rules |
| 2026-10-24 | Luck: seeded random 0–9 per attack, RNG state in GameState; "no luck" option |
| 2026-10-24 | Fortifications can only be attacked when empty; destroying one isn't a kill |
| 2026-10-24 | Provisional v0 damage chart for all land, air and naval units plus fortifications |
| 2026-10-24 | Veterancy: Rookie / Veteran (3 kills, +10% atk/def) / Elite (9 kills, +20%, no extra perks); on join, kill count of the unit contributing more HP |
| 2026-10-24 | Availability rule: nations only get unit types they historically fielded; scenarios offer only those |
| 2026-10-24 | No separate Paratrooper unit: reusable Transport Aircraft carries 2 foot units and air-drops them. Glider deferred |
| 2026-10-24 | Engineers folded into Assault Infantry; anti-tank gun cut; carrier deferred |
| 2026-10-24 | Mortar Team added: foot indirect unit, range exactly 2, low ammo, transportable |
| 2026-10-24 | Fortifications are terrain (defense bonus, must be occupied to matter); fortifications/obstacles have HP and are cleared by attacking, like pipe seams |
| 2026-10-24 | Terrain, economy and land supply (02, 04, 05): original game's rules as v0. Hills replace mountains; Bocage, Bunker, Rubble and Obstacle added |
| 2026-10-24 | Tech setup (11): Vitest + fast-check, Playwright later; engine boundary enforced by tsconfig (no DOM) and ESLint; typed TS data files; GitHub Actions CI + Pages deploy |
| 2026-10-24 | Factory build menu is HTML |
| 2026-10-26 | Modifier layer combines per stat as add → multiply → set, rounded down, never below 0; veterancy derived from kills at lookup (11-tech-setup §3a) |
| 2026-10-26 | Move is one atomic command (path + end action), previewed locally in the UI until an action is chosen; terrain move cost is a modifiable stat; friendly (same-side) units can be passed through, not stopped on (11-tech-setup §3b) |
| 2026-10-26 | Undo (last move this turn) exists as a playtesting convenience; cleared at End Turn and after anything that reveals information |
| 2026-10-31 | Combat implemented (03-combat): attack is an end action on Move; damage computed in whole numbers; forecast and engine share one code path (11-tech-setup §3d) |
| 2026-10-31 | A unit out of primary ammo can only attack targets with a secondary value in the chart (03-combat wins over the looser wording in 05-supply §2, now corrected) |
| 2026-10-31 | Undo is cleared by any attack as well as End Turn; `?seed=` and `?luck=off` URL options for testing |
| 2026-10-31 | Economy implemented (04-economy): turn start runs income, then repair and resupply, then readies units, including day 1 for the first player; capture is an end action on Move; build is its own command (11-tech-setup §3e) |
| 2026-10-31 | A unit showing 10 HP is not repaired or charged, even at 91–99 internal HP; only neutral and enemy-side properties can be captured; each player has a scenario-set buildable list |
| 2026-10-31 | Undo now covers any action this turn except attacks, since capture and build reveal nothing |
| 2026-10-31 | Transport, supply and joining implemented (05, 04-economy §6): passengers live inside the transport; Load and Join are the only end actions that stop on an occupied tile (11-tech-setup §3f) |
| 2026-10-31 | Joining and boarding are limited to your own player's units; Supply needs a unit that actually needs it; automatic supply reaches same-side allies |
| 2026-10-31 | Hold X or right-click with nothing selected shows any unit's move and threat range, as in the original; they still cancel when something is selected |
| 2026-10-31 | Win conditions implemented (04-economy §8): scenarios list conditions, default HQ capture and rout; HQ capture ends the game at once, rout is checked at the end of each turn; resign is always available (11-tech-setup §3g) |
| 2026-10-31 | Defeated players' units are removed and their properties go neutral, as in the original; the game ends when one side remains and all its surviving players win |
| 2026-10-31 | Fortifications implemented (03-combat §4, 02-terrain §4): attacking one is an end action on Move; they belong to nobody, so either side can attack any empty one (11-tech-setup §3h) |
| 2026-10-31 | Game shell implemented: title, map select, pass-the-device screen; three scenarios (Twin Bridges, Bocage Country, Proving Ground). Phase 1 complete (11-tech-setup §3i) |
| 2026-10-31 | Scenarios are validated JSON with maps as text rows; Tiled is deferred until real tile art exists, since it needs a tileset image |
| 2026-10-31 | Phase 2 design accepted: air, naval, landings and submarines (05 §5–9), three new victory conditions (04 §8), the AI (09), and milestones 9–15 (11-tech-setup §6) |
| 2026-10-31 | Landing Craft must stand on a Beach or Port tile to load or unload, as in the original; one unit per tile of any category |
| 2026-10-31 | No daily fuel burn on day 1; Transport Aircraft drop anywhere foot units can enter; a transport can unload both passengers in one action; no transports inside transports |
| 2026-10-31 | Submerged submarines stay visible with a marker until fog of war exists, a deliberate change from the original |
| 2026-10-31 | Phase 2 order: air, naval, landings, victory conditions, CO hooks, then the AI. AI runs on the main thread behind an async interface; the first AI doesn't use Landing Craft or Transport Aircraft |
| 2026-11-01 | Air units implemented (milestone 9). Air and naval units on a property that services them burn no daily fuel, so an aircraft can't crash while parked on its own airfield |
| 2026-11-01 | Mechanics paused at milestone 10 to work on visuals; the full art asset list is in 08-art-pipeline |
| 2026-11-01 | Unit art is pixel grids rendered to PNG by script. Units face right and alternate 2 idle frames. US land sprites approved; the US Recon is a Willys jeep (08-art-pipeline §12) |
| 2026-11-01 | Art packs: art, colors and display names load from a pack.json at startup, every field optional, with placeholders for anything missing; `?pack=` picks one (08-art-pipeline §13) |
| 2026-11-01 | Allies and Axis name the sides; Germany and German name the nation; Wehrmacht is never a label. German land sprites carry no national insignia until that decision is made (08-art-pipeline §12) |
| 2026-11-01 | Unit facing belongs to the map, not the nation or art pack: each scenario sets `facing` per player (default right), so a side starting on the left faces right and a side starting on the right faces left. Sprites are mirrored; facing is fixed while moving and is never read by a rule (08-art-pipeline §12) |
| 2026-11-01 | Full keyboard play. Following the original game, Z on any tile with no unit ready to move opens a turn menu: Resign, then End Turn, highlighted by default. Your own empty factory still opens the build list. Z or a click on an enemy no longer shows its range; hold X or right-click instead (11-tech-setup §3c) |
| 2026-11-01 | The HUD is only the current player's flag, the day and their funds. The unit, terrain and debug panels moved behind `?debug=on`; the Undo, End Turn and Resign buttons are gone, with U and E kept as shortcuts (11-tech-setup §3c, §7) |
| 2026-11-01 | HUD flags are placeholders with no political symbols. Germany shows a black Balkenkreuz on grey, its wartime military marking, since the real 1935–45 flag is banned here and black, white and red has far-right associations today. The Soviet flag is a plain star. German sprites still carry no insignia (08-art-pipeline §12) |
| 2026-11-01 | The attack forecast shows only the damage you'd deal, not the counter (03-combat §1) |
| 2026-11-01 | A tile info box shows the terrain, its defense stars and any unit's name, with no percentages. Air units show no stars. It replaces the debug-only terrain panel, so property owners and capture progress are no longer listed there |
| 2026-11-01 | Arrow keys are limited to the move range while a unit is selected, and to the choices while firing or unloading (11-tech-setup §3c) |
| 2026-11-06 | Terrain art: variants by map position, 16-piece roads and rivers, bridge decks over rivers, and shore foam layered on sea instead of 47 coastline tiles. Water animates in 2 frames; tiles never overlap the one above (08-art-pipeline §14) |
| 2026-11-06 | Buildings show their owner by roof and banner color, from a sheet with one column per owner, and replace the corner flag. Buildings draw under range tints; fortifications are terrain tiles (08-art-pipeline §15) |
| 2026-11-06 | Reversed: tall tiles now rise into the tile behind. Terrain and buildings are 16×32, painted row by row from the top, lit from the top left with shadows to the lower right (08-art-pipeline §16) |
| 2026-11-06 | Roads widened to 10 pixels. Units cast an in-game shadow to the lower right, so it stays correct when mirrored; US land sprites shaded to match the terrain's light (08-art-pipeline §16) |
| 2026-11-07 | Units redrawn at 32×32 in a top-down 3/4 view (art only until the map moves to a 32-pixel grid). US Infantry dropped by a Transport Aircraft is drawn as a 101st Airborne paratrooper with a card-suit helmet and M1 carbine; the engine records air drops but no rule reads it (08-art-pipeline §17) |
| 2026-11-07 | The game shows the 32×32 units without changing the map: squares stay 16 map pixels and the same size on screen, the game draws at screen resolution and scales units to fit a square. Air-dropped US Infantry shows as paratroopers (08-art-pipeline §17) |
| 2026-11-07 | Aircraft, ships, terrain and buildings drawn at 32 pixels and shown in the game, painted at double resolution into 16-pixel squares. Germany gets no Battleship or Landing Craft art (08-art-pipeline §17) |
| 2026-11-07 | Large maps scroll: zoom to fit the window but never below 3×, beyond that a scrolling view that follows the keyboard cursor and pans to each move and attack; each turn starts on the player's HQ (section 12, Camera) |
| 2026-11-07 | First Normandy theater map built ahead of phase 4: 92 × 78, southern England to Normandy with non-uniform scale, the Channel wider than rocket range, Allied income about double Germany's, small starting forces, HQ capture as the only victory condition. German HQ at Falaise. Generated by script from real coordinates (10-scenarios-normandy) |
| 2026-11-07 | Normandy map: most of the real sandy coast is now beach, not just the five D-Day sectors; cliffs from Pointe du Hoc to Omaha and from Port-en-Bessin to Arromanches; clifftop bunkers at Pointe du Hoc and Longues; other bunkers sit behind the beaches (10-scenarios-normandy §1) |
| 2026-11-07 | Naval units implemented (milestone 10). Warships are buildable at ports by default; Landing Craft waits for beach landings in milestone 11. Submarines Dive and Surface as end actions; submerged, they burn 5 fuel a day and only Destroyers and Submarines can attack them or hit back at them. A submerged submarine is drawn tinted with a wave badge, visible to both players (D5). New coastal map: Narrow Sea |
| 2026-11-07 | Landings and drops implemented (milestone 11). Every unit is buildable by default. One Unload action can land both passengers (D3). Landing Craft load and unload only on a Beach or a friendly or neutral Port; Transport Aircraft load only on their owner's airfield. A transport carrying units can't board another (D4). Transport Aircraft drop onto adjacent tiles only, not their own, since one unit per tile holds (05-supply-transport §6). New amphibious map: Beachhead |
| 2026-11-07 | Aircraft fly over enemy ground units and ships (a departure from the original, where surrounding a plane with Infantry trapped it). Enemy aircraft still block. One unit per tile still holds (02-terrain §5) |
| 2026-11-07 | The tile info box shows a property's capture points left ("Capture 12/20") and what a transport is carrying. A bunker with foot soldiers inside is drawn garrisoned in their side's colors, Red Alert 2 style, with the soldier hidden inside (08-art-pipeline §15) |
| 2026-11-07 | Scenario victory conditions implemented (milestone 12): captureProperties, holdProperties and surviveDays. A side wins by defeating everyone on the other side; hold counts start on day 2 and reset when any objective is lost. Objectives get a gold frame, are listed with progress in the HUD and on the results screen. New map: Crossroads (04-economy §8) |
| 2026-11-07 | Battle scenes brought forward from phase 3: every attack plays as a split-screen scene, attacker first, then the counter. Figures are drawn in code with per-unit animations (the mortar crew drops a round and ducks, the artillery loader rams a shell before the lanyard is pulled), figure counts follow HP, and HP pips tick down as shots land. The side facing right stands on the left. Skippable; "Battle scenes" option, on by default (08-art-pipeline §18) |
| 2026-11-07 | Battle scenes revised after playtest: more figures (Infantry 8, most vehicles 3–4), soldiers enlarged to about 44 pixels with a real squad mix (riflemen, an SMG, a prone BAR or MG 42), dug-in sandbag positions on bunkers, shots leaving along the barrel on arcs that match it, anti-aircraft fire hitting aircraft from below, a Willys-style jeep, a detailed factory, Landing Craft beached half on the sand, and more identifying detail on every vehicle and aircraft (08-art-pipeline §18) |
| 2026-11-08 | Battle scenes, second playtest: tank platoons show 5 tanks (heavy tanks 4); units on Hills stand on a crest over the valley; US squads carry two Thompsons (paratroopers three); paratroopers get their own look with the card suit the map shows; mortars, artillery and rockets fire high, out of sight for about a second, then drop steeply onto the target (08-art-pipeline §18) |
| 2026-11-08 | Non-combat cut-in scenes: a capture shows the squad storming the building, the count dropping as each soldier gets in, and the flags changing when it completes; foot soldiers going into a bunker show them running in and the bunker garrisoned. Same "Battle scenes" option and skip keys. The developer chose no other non-combat scenes (building, loading, supply, diving, fuel) (08-art-pipeline §19) |
| 2026-11-08 | Scene feedback: every vehicle and gun unit shows 5 at full HP; rocket units have a forward observer with binoculars; indirect rounds show only over the firing half going up and the target's half coming down; City captures show a town square; Airfield captures show the runway; only the first capture turn storms the building, later turns raise the captor's flag to match the points taken; Transport Aircraft unloading plays as a static-line paratrooper jump (08-art-pipeline §18–20) |
| 2026-11-08 | Battle scenes: tanks and tank destroyers are drawn as 3D models turned 5° toward the viewer, looking down about 24°, so turret roofs and fronts show; chosen over 10°, 15°, 20° and 47° samples. Everything else stays side-on for now (08-art-pipeline §18) |
| 2026-11-08 | Battle scenes: every other land machine (recon, halftracks, Mobile AA, flak guns, artillery, rocket artillery) and the bunker get 5° models too; foot soldiers stay side-on. A fallen soldier topples about his own feet and leaves his mortar or sandbags standing (08-art-pipeline §18) |
| 2026-11-08 | Objective marker changed from a gold frame to gold corner marks, since a full box read as a second cursor. The tile info box marks objectives and shows a unit's fuel and ammo left, for every side (04-economy §8, 00-master-design §12) |
| 2026-11-08 | Weather (12-weather): Clear and Snow, the same for the whole map for a whole day, set by the scenario in advance as a forecast; no random weather in v0. Snow adds to movement costs through the modifier layer, using the original game's snow table (roads and towns unchanged, aircraft pay 2 per tile). Rain waits for fog of war. Modifiers can now be scoped by movement type |
| 2026-11-08 | A scenario can say its map is in winter: snowy map tiles and battle scenes all game, even under clear skies, since snow stays on the ground. Art only; packs give a winter version of the terrain and building sheets with the same layout (08-art-pipeline §21) |
| 2026-11-08 | Bastogne map (13-scenarios-ardennes): the Ardennes in December 1944, 40 × 30. Germany attacks with a bigger army whose tanks start short of fuel and has no aircraft; it wins by taking Bastogne or the US HQ at Arlon. The US wins by holding out to day 12. Snow until day 5, clear from day 6 |
| 2026-11-08 | The US is army green: the first player's color in the built-in pack is now army green (was blue), and every built-in map puts the US first. Blue moves to the third player. Each nation's sheets come in army green, red and blue (08-art-pipeline §12) |
| 2026-11-08 | Player names are the nation, not one service: "US Army" becomes "US", since the US fields Marines and the Navy too (00-master-design §6) |
| 2026-11-08 | Japan joins the Axis as a nation, with its own map sprites and battle scenes modeled on IJA and IJN equipment: Arisaka with bayonet, Type 90 helmet, Ha-Go, Chi-Ha, Ho-Ni, A6M Zero, G4M, Yamato, Kagero. Japan fielded no heavy tank, so it gets no Heavy Tank art and scenarios don't offer it one (01-units §1). Its aircraft and HUD flag carry the plain hinomaru; the rising-sun ensign is never used (08-art-pipeline §12, §18) |
| 2026-11-08 | Iwo Jima map (14-scenarios-pacific): February 1945, 36 × 26. The US starts with its first wave ashore and wins by taking Mount Suribachi and Airfields No. 1 and No. 2, or Japan's HQ; Japan, dug into bunkers, wins by holding out to day 15. A US anchorage off the south-east corner stands in for the fleet's transport area |
| 2026-11-09 | Battle scenes: every naval unit is one larger ship, a 3D model turned 5° like the land machines, with more detail; the US Battleship becomes an Iowa-class battleship. Waves run along every hull from bow to stern, with a bow wave and a wake, so ships always look under way (08-art-pipeline §18) |
| 2026-11-09 | Naval fire takes time to arrive in battle scenes: shells leave the screen and fall in over a second later, torpedoes run slower, depth charges sink before they go off. A Destroyer uses depth charges on any submarine, surfaced or not (it used its deck gun on a surfaced one), at the developer's request (08-art-pipeline §18) |
| 2026-11-09 | Phone game-pad layout, a prototype (§12): on a small touch screen held upright (or with `?pad=on`), the top of the screen is a 3:2 game screen the width of the phone, drawn in the phone's own pixels at about 15 squares across, with day and funds above it and square info below; the bottom is an on-screen pad with Up, Down, Left, Right and the Z and X buttons, which send the same keys as the keyboard. Holding a direction repeats it. `?pad=off` turns it off |
| 2026-11-09 | Single-player: the Greedy AI (09-ai §4) is built, ahead of milestone 13 (CO hooks), which is still to do. The map select has a "Computer plays …" box per player, and by default the computer plays everyone but the first player. AIs live in `src/ai/` under the engine's purity rules, see the state with the RNG hidden, and choose from the engine's new `legalCommands`. A rejected command, a crash or 300 commands in one turn ends the AI's turn and is logged as an AI bug |
| 2026-11-09 | Greedy's scores are in funds and its weights are data (`src/ai/weights.ts`), so tuning and future commander personalities are data edits. Details not in the original design (09-ai §4 "As built"): capturers spread out over properties, indirect fire heads for firing positions, aircraft and ships head home on low fuel, submarines never dive, and it never builds Landing Craft or Transport Aircraft (D9). AI vs AI games end with a winner on every land map; maps that need landings stall until the AI learns them |
| 2026-11-09 | Carrier added (01-units §4, 05-supply-transport §10). It carries 2 Fighters or Bombers and each turn either moves or launches, not both; it can launch both aircraft in one turn, and they fly off and attack that same turn (a departure from the original). Aircraft aboard get fuel and ammo free and 1 HP a day at the normal repair price. Unarmed; aircraft aboard sink with it. Iwo Jima loses the anchorage Airfield and gets two Carriers with two Bombers each instead |
| 2026-11-09 | Carrier built: engine launch order and Carrier service, Essex (US/UK) and Shōkaku (Japan) map sprites and battle-scene models, the Launch item in a Carrier's menu (the aircraft comes out on the Carrier's tile, then moves and acts like any unit), and Iwo Jima's two Carriers with two Bombers each. Scenarios can now start units aboard a transport (`cargo` on a unit) |
| 2026-11-09 | Carriers toned down, at the developer's request: they cost 40,000 (was 30,000), are built empty, and carry Fighters plus two new carrier aircraft instead of Bombers: the **Dive Bomber** (14,000, moves 6, 2 bombs, about half a Bomber's damage) and the **Torpedo Bomber** (16,000, moves 6, 1 torpedo, 120% against surface ships only, not submarines). Both are built at airfields; US, UK and Japan only. Iwo Jima's Carriers start with two Dive Bombers each (01-units §3, 03-combat §5, 05-supply-transport §10) |
| 2026-11-09 | Battle machines get a polish pass, at the developer's request after comparing our tanks with detailed fan pixel art (08-art-pipeline §18 "Polish"): five shades per color (cool shadows, lit faces lighter without losing saturation), bright plate edges and dark creases, rivets, a cast shadow in each machine's own shape, a navy outline, and tank commanders standing up out of their hatches in tanker headgear with goggles. On by default; `?polish=off` shows the old look |
| 2026-11-09 | Polish extended to sprite figures at the developer's request (08-art-pipeline §18): soldiers and aircraft get lit and shaded edges, all figures a navy outline and cool-leaning team shades, soldiers cast their own shape as a shadow, and the Mobile AA gunner becomes a full crewman in a steel helmet. `?polish=off` still shows the old look |
| 2026-11-09 | The Slot map (14-scenarios-pacific §2): a symmetric island campaign in the style of the Solomons, not historical, 29 × 37. US in the south, Japan in the north, with identical forces and islands (the north is the south turned 180°): an HQ island with a major port, a secondary city, a forward port and an airstrip each; a neutral centre with an airfield and two anchorages; a reef-free channel (the Slot) between the HQs and open ocean on the flanks. The game has no Cruiser, so the concept's cruisers are Destroyers (the original's Cruiser role) and its destroyers Torpedo Boats |
| 2026-11-10 | Fuel and ammo rebalanced at the developer's request (01-units §8a): fuel follows each machine's real range (land: road range in km ÷ 3, capped at 99; heavy tanks 40, medium 60, light 55, foot soldiers and jeeps 99), and air and naval tanks and daily burn follow real endurance (Destroyers and Torpedo Boats burn 2 a day, Transport Aircraft 3). Fighters and Bombers carry 2 ammo (were 9); Bombers carry 50 fuel (half) and burn 8 a day idling, the most of any aircraft. Bastogne's German tanks start at 24/40 and 34/60 |
| 2026-11-10 | Supply warnings and cargo display (05-supply-transport §11): flashing gas and ammo cans replace the F badge, from one rule shared with the info box; a panel beside a transport under the cursor shows its passengers' sprites, names and HP; a Carrier's Launch item names the aircraft, and a "LAUNCHING …" label stays over it while it's out |
| 2026-11-10 | Battle and capture scenes (08-art-pipeline §18, §19): Ports become harbors (lighthouse on a breakwater, moored freighter, gantry crane, bollards, dock railway, gulls), and Torpedo Bombers dive to skim the water, drop level, and climb away; over the sea the sky backdrop shows water beneath aircraft |
| 2026-11-10 | At the developer's request: every land unit's fuel is halved (Infantry 50, Medium Tank 30, Heavy Tank 20, rounding halves up; Bastogne's German tanks 12/20 and 17/30), and moving burns fuel at a per-unit rate on top of the daily burn: aircraft 2 per tile flown, land units and ships 1 per movement point (`fuelPerMove`, a modifiable stat; 01-units §8a, 05-supply-transport §1) |
| 2026-11-13 | Milestone 16, Greedy v2, at the developer's request (09-ai §4a, §4b): part 1, threat-aware production, built. Units step off their own production sites; when choosing a build, enemies within 2 turns of the site count 3×, enemies our units nearby already hurt count less, and only enemies the unit could reach from that site count; a threatened site always builds. So a Bomber near a factory makes it build anti-air. Part 2, the AI using Landing Craft, Transport Aircraft and Carriers (lifting D9), is next |
| 2026-11-13 | Milestone 16, part 2 (09-ai §4b), lifting D9: the AI uses Landing Craft, Transport Aircraft and Carriers. Land units with nothing left to do on their landmass board a craft at a beach or port (or an aircraft at an airfield) and are landed where their goal is nearest; craft wait for a second passenger and unload both at once; ports build craft while troops are waiting; Carriers launch only to attack and otherwise sail to striking range; aircraft land back on Carriers. The engine's legal command list now includes launches. Aircraft and ships head home counting the daily burn on the way, and don't move past the point they could get home from. AI vs AI on The Slot and Normandy now has landings, but those games still rarely end within 40 days: massed landings, escorts and garrisons are left for a later AI |
