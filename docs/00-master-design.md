# Master Design Doc: WW2 Turn-Based Tactics (working title TBD)

**Status:** Big-picture decisions made. Units, combat, terrain, economy, land supply and tech setup decided as v0. Phase 0 (setup) in progress.
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
| **3: Content and polish** | Commanders, battle cutscene (staged), more scenarios, better art, mobile phone layout |
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

- Two sides: **Allies** and **Axis**. Specific nations per scenario (for example US, UK, Canada vs. Germany for Normandy).
- **Units are generic in stats** (Light Tank, Heavy Tank, Fighter, etc.) and **identical in capability regardless of side**. Their art mirrors real WW2 equipment per nation (for example a Sherman vs. a Panzer IV for the same unit type).
- **Historical asymmetry comes from availability, not stats.** A nation has art for a unit type only if it historically fielded an equivalent, and scenarios only offer a nation the unit types it has art for (for example no US Heavy Tank in Normandy).
- Later, commanders may modify a side's unit performance, as COs did in the original.
- **No Nazi or political symbols.** Sides are identified by color and equipment silhouettes. Any national insignia use is a future decision (TBD); the swastika is never used.
- MVP historical detail is limited to the units themselves. Briefings, real names, dates and so on come later.
- Unit roster: see **01-units.md**. 13 land units (12 in MVP, Flak Gun in phase 2), 3 air, 5 naval.

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
- Large-map needs (to be designed later): zoom, minimap, jump-to-unit, "next idle unit" cycling, multi-turn move orders, possibly reserve areas or a lighter buildup phase to reduce turn tedium.

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
| In-battle contextual menus | Fire / Capture / Wait / Load, damage forecast | **Canvas (Phaser)**, pixel style |
| HUD panels | Terrain info (defense), unit info (HP/fuel/ammo), day counter, funds | **HTML overlay** |
| Full screens | Title, scenario select, briefing, results, settings | **HTML overlay** |

- HTML UI is styled retro: a shared pixel font (open-licensed), pixel-art panel frames via CSS `border-image`, crisp image scaling, and a shared palette with the canvas UI.
- Input between layers must be handled so taps on menus don't also hit the map.
- Mobile and touch considerations (for later): no hover (info follows selection), menus placed away from the finger, tap targets around 44px on screen, pan/pinch-zoom coexisting with tap-to-select, top/bottom layout in portrait.
- Factory build menu: **HTML** (it's a scrolling list).

## 13. Combat presentation (staged)

- **MVP:** combat plays on the map. The attacker nudges toward the target, a flash/explosion shows on the defender, a floating damage number appears, then the counterattack plays the same way.
- **Later:** a split-screen battle cutscene as a separate Phaser scene. Terrain backgrounds, larger battle sprites, unit count reflecting HP, fire/impact/explosion effects, HP bar drain. Begin with static sprites + code-driven motion + particles; add full animated art unit by unit, falling back to the simple version where art is missing.
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
- Art pipeline details (palette, sheet layout, naming): **TBD** (topic doc).

## 15. AI opponent

- Not in the MVP. MVP is hot-seat PvP.
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
| 05-supply-transport.md | **Land rules v0 decided**; air and naval sketched for phase 2 |
| 06-commanders.md | TBD |
| 07-ui-ux.md | TBD: screen flows, controls, mobile |
| 08-art-pipeline.md | TBD |
| 09-ai.md | TBD |
| 10-scenarios-normandy.md | TBD (phase 4) |
| 11-tech-setup.md | **Decided**: tooling, repo layout, engine boundary, testing, phased build plan |

## 18. Open questions

- Working title
- Unit scale and theater map dimensions
- Tuning provisional unit stats (01-units v0) after playtesting
- Real generals vs. doctrines for COs
- National insignia policy (beyond "no Nazi or political symbols")
- Weather? Day/night? (not yet discussed)
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
