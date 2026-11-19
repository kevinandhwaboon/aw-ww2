# Master Design Doc: WW2

**Status:** Big-picture decisions made. Units, combat, terrain, economy, land supply and tech setup decided as v0. Phases 0 and 1 are done. Phase 2 is under way, with milestones 9 (air), 10 (naval), 11 (landings and drops), 12 (victory conditions), 14 (AI interface) 15 (the Greedy AI), 16 (Greedy v2) and 17 (Greedy v3) done. Milestone 13 (CO hooks) was done on 2026-11-16: the commander rules are in the engine, their screens are still to do.
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
- The game is called **WW2** (since 2026-11-18). The title must never include "Advance Wars".
- **Default rule for open choices:** when a game-mechanics decision is unclear, follow the original game's mechanism unless there's a clear reason not to.

## 4. Phased roadmap

| Phase | Content |
|---|---|
| **0: Setup** | Repo, tooling, CLAUDE.md, CI, deploy pipeline, test map |
| **1: Core MVP** | Hot-seat player vs. player on small test maps. Land units, terrain, movement, combat, capture, income, production, fuel/ammo, win conditions. Map-level combat effects only. |
| **2: Systems** | Air and naval units, transports and amphibious unloading, modifier layer (CO hooks), scenario-defined victory conditions, the pluggable AI interface and a first basic AI |
| **3: Content and polish** | Commanders, battle cutscene art (a code-drawn version exists since 2026-11-07), more scenarios, better art, mobile phone layout |
| **4: Normandy theater** | Full Normandy + southeastern England theater map and scenario |
| **Later / maybe** | Save/load slots and save files, campaign mode, custom community AIs, online multiplayer. (Fog of war moved in on 2026-11-17 as an option: 19-fog-of-war; an autosave of the game in progress on 2026-11-18: 11-tech-setup §3j) |

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

- Fog of war, as an option on the new-game screen (19-fog-of-war, since 2026-11-17)

**Out for now:**
- Online multiplayer
- Save/load with slots or files (the architecture should make it easy to add later). One autosave of the game in progress is in (11-tech-setup §3j)
- Battle cutscene (deferred; see section 13)
- Full phone playability (deferred; tablet and desktop first)

## 6. Factions and historical presentation

- Two sides: **Allies** and **Axis**. Specific nations per scenario (for example US, UK, Canada vs. Germany for Normandy, or the US vs. Japan for Iwo Jima). Nations so far: US, UK, Canada, Soviet Union (Allies); Germany and Japan (Axis). The US, the UK, the Soviet Union, Germany and Japan have their own art; Canada uses the UK's art and color (since 2026-11-15; before, the UK and Canada used the US art). **Italy** (Axis, since 2026-11-15, for El Alamein) has its own art since 2026-11-18, in blue, its azzurro (18-scenarios-north-africa).
- Nations are named for the country, never one service: "US", not "US Army", since US forces include Marines and the Navy.
- **Units are generic in stats** (Light Tank, Heavy Tank, Fighter, etc.) and **identical in capability regardless of side**. Their art mirrors real WW2 equipment per nation (for example a Sherman vs. a Panzer IV for the same unit type).
- **Historical asymmetry comes from availability, not stats.** A nation has art for a unit type only if it historically fielded an equivalent, and scenarios only offer a nation the unit types it has art for (for example no US Heavy Tank in Normandy).
- Later, commanders may modify a side's unit performance, as COs did in the original.
- **No Nazi or political symbols.** Sides are identified by color and equipment silhouettes. Any national insignia use is a future decision (TBD); the swastika is never used. Japan is shown only with its national flag, the plain red disc (hinomaru), on its HUD flag and its aircraft; the rising-sun ensign is never used.
- MVP historical detail is limited to the units themselves. Briefings, real names, dates and so on come later.
- Unit roster: see **01-units.md**. 13 land units (12 in MVP, Flak Gun in phase 2), 5 air (Dive and Torpedo Bombers added for Carriers), 7 naval (the Carrier added for the Pacific, the Supply Ship for supply at sea).

## 7. Commanders (COs)

- **Commanders are fictional** (decided 2026-11-15, see **06-commanders.md**). Every commander is an original character; no real person is named or portrayed. Real generals under rules, and real generals under thinly changed names, were both considered and rejected.
- **Eight commanders: one from each nation, and a second American for the navy.** A player may fight under any commander of their own side, never the other side's, or under **no commander**, which is the default and plays as the game did before commanders. A commander has always-on bonuses and one always-on drawback, built on unit classes and terrain.
- Each has a code-drawn portrait from the waist up in an officer's uniform of their nation; its head shows in the turn bar beside the flag. A **COMMANDERS** item in the turn menu lists every commander with the player's own selected (06-commanders §5).
- **The rules engine includes a modifier layer from day one.** Movement, attack, defense, cost, vision and similar values pass through modifiers, so a commander is data. Milestone 13 (CO hooks) adds the scopes the roster needs (06-commanders §6).
- The rules (milestone 13) and the screens (06-commanders §5) are built, both 2026-11-16: commanders are picked on the map select. Commander powers, and whether scenarios can fix commanders, are open (06-commanders §7).
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
- **Since 2026-11-14 only maps modeled on WW2 battles ship**, at the developer's request: Normandy, Market Garden and El Alamein (both added 2026-11-15), Bastogne, Kursk (added 2026-11-14), Iwo Jima, The Slot (the Solomons around Guadalcanal, kept though its layout is symmetric rather than historical), Midway and Guadalcanal (added 2026-11-16). The test and demo maps (Twin Bridges, Bocage Country, Crossroads, Contested Skies, Narrow Sea, Beachhead, Proving Ground) were removed.

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
| Tile info | Terrain name, defense stars, whether the tile is a scenario objective, a property's capture points left, the name of any unit on the tile, with its nation's flag beside it (since 2026-11-16), and its fuel and ammo left (shown for every side; a value that is out, or fuel within two turns of running dry, is in the accent color), and what a transport is carrying, in a bottom corner away from the cursor | **HTML overlay** |
| Full screens | Title, scenario select, briefing, results, settings | **HTML overlay** |

- HTML UI is styled retro: a shared pixel font (open-licensed), pixel-art panel frames via CSS `border-image`, crisp image scaling, and a shared palette with the canvas UI.
- Input between layers must be handled so taps on menus don't also hit the map.
- Mobile and touch considerations (for later): no hover (info follows selection), menus placed away from the finger, tap targets around 44px on screen, pan/pinch-zoom coexisting with tap-to-select, top/bottom layout in portrait.
- Factory build menu: **HTML** (it's a scrolling list). Each row shows the unit's sprite, cost, role, and what it's strong and weak against. The guide is written by hand in `src/game/unitGuide.ts`, and a test checks it against the damage chart.
- The whole game plays from the keyboard, title screen to results (11-tech-setup §3c). The mouse still works but is never required.

**Map select (since 2026-11-18):** new games pick a battle on a world map, filed by theater: Western Europe, the Eastern Front, North Africa and the Pacific. More theaters and battles will join later; a theater is a name and a view of the world map in `src/ui/theaters.ts`.

- The world map is real coastlines (Natural Earth, public domain, turned into `src/ui/worldLand.ts` by `tools/maps/world-land.mjs`) drawn as chunky pixels at one fixed low resolution, so it matches the game's pixel art at any zoom. Each battle is a dot where it was fought, with its name beside it; the chosen one blinks inside corner brackets like the map cursor.
- Changing theater flies the camera there; between distant theaters it pulls back to the whole world on the way. The whole-world view is centered on the Old World and the Pacific so that no battle sits on the map's seam (Midway is east of the date line).
- Picking a battle, before confirming it, shows its briefing: name, where and when, a moving picture, a terrain sketch, the matchup and the description.
- The **moving picture** is the battle scene (§13) of the unit the map is about, looped, cropped close in a letterbox, with a slow camera drift: Landing Craft at Normandy, paratroopers dropping at Market Garden, heavy tanks in the snow at Bastogne, tank against tank at Kursk, sappers in the minefields at El Alamein, Assault Infantry against bunkers at Iwo Jima, carriers at Midway, battleships shelling the airfield at Guadalcanal, destroyers in the Slot. Which unit and which crop is data in `src/ui/theaters.ts`.
- The **terrain sketch** is a briefing chart, not a shrunken map: a coarse grid (about 22 cells on the long side), each cell showing what most of its block of squares is: sea, land, forest, hills, river or salt marsh, colored for the map's season. Sea wins a block that's half sea or more; a river crossing a block keeps it a river so rivers stay unbroken; forest, hills or marsh need two fifths of the block; roads, towns and works are just land.
- Keys: Left and Right change theater, Up and Down pick a battle, Z goes on to players and commanders, X back to the title. With the mouse, clicking a battle (in the list or on the map) picks it and clicking it again goes on.

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

- Not in the MVP. MVP is hot-seat PvP. The first AI, Greedy, was built on 2026-11-09 (09-ai). Greedy v2 (milestone 16, built 2026-11-13) adds threat-aware production, then landings, drops and carriers (09-ai §4a, §4b). Greedy v3 (milestone 17, same day) adds focus fire, a one-turn look ahead, massed and escorted landings, and a choice of Easy or Normal (09-ai §4c).
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
| 06-commanders.md | **Rules and screens built**: eight fictional commanders, one from each nation and a US admiral, usable by their whole side, or no commander; portraits drawn; powers still open |
| 07-ui-ux.md | TBD: screen flows, controls, mobile |
| 08-art-pipeline.md | **Asset list done**; how to make the art is undecided |
| 09-ai.md | **v0 built**: AI interface, rules for AIs, the first Greedy AI |
| 10-scenarios-normandy.md | **First theater map (v0)**: southern England and Normandy, 92 × 78; balance untested |
| 11-tech-setup.md | **Decided**: tooling, repo layout, engine boundary, testing, phased build plan |
| 12-weather.md | **v0 decided**: Clear, Snow and Rain, set per scenario as a forecast, following the original; rain brings fog of war for the day |
| 13-scenarios-ardennes.md | **First Ardennes map (v0)**: Bastogne, 40 × 30, snow then clear; balance untested |
| 14-scenarios-pacific.md | **Four Pacific maps (v0)**: Iwo Jima (36 × 26, an opposed landing from the sea), The Slot (29 × 37, symmetric), Midway (40 × 28, a carrier battle) and Guadalcanal (42 × 24, holding an airfield supplied by sea); balance untested |
| 15-scenarios-eastern-front.md | **First Eastern Front map (v0)**: Kursk, a 68 × 80 theater map of the whole salient, the Soviet Union against Germany; balance untested |
| 16-sound.md | **v0 built with placeholder sounds**: what makes a sound, licensing (CC0 or CC-BY with credits), sounds in art packs, the sound level; real sounds still to pick |
| 17-scenarios-market-garden.md | **Built (v0)**: Market Garden, 32 × 44, airborne drops and bridges that can be blown and rebuilt (02-terrain §4a), the US and the UK as two Allied players against Germany |
| 18-scenarios-north-africa.md | **Built (v0)**: Second El Alamein, 36 × 32, the UK against Germany and Italy through two minefield belts, a desert art season, and Minefield, Ridge and Salt Marsh terrain (02-terrain §4b) |
| 19-fog-of-war.md | **v0 decided**: optional fog following the original's rules; Forest, Bocage and Reef hide units; rain later |

## 18. Open questions

- Working title
- Unit scale and theater map dimensions (first answer: the Normandy map is 92 × 78, see 10-scenarios-normandy)
- Tuning provisional unit stats (01-units v0) after playtesting
- Commander powers, and whether scenarios can fix commanders (06-commanders §7)
- National insignia policy (beyond "no Nazi or political symbols")
- Day/night? (not yet discussed). Weather: v0 decided (12-weather), rain since 2026-11-17; random weather left open
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
| 2026-10-31 | Submerged submarines stay visible with a marker until fog of war exists, a deliberate change from the original (reversed 2026-11-14: hidden unless an enemy is next to them) |
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
| 2026-11-13 | Milestone 17, Greedy v3, at the developer's request (09-ai §4c): everything left open after milestone 16 except commander personalities. Artillery fires first, attacks that set up a kill are worth more, and a light one-turn look ahead counts what a unit stands to lose where it ends its move. Loaded Landing Craft leave in waves with warship escorts, and two units garrison the HQ's island when the enemy could invade. Ships no longer strand themselves for an attack worth less than they are, and ports aren't built on while a ship is coming in for fuel. The map select screen gets an "Easy computer opponent" box (`?level=easy`): Easy is the same AI with coordination off, under the same rules and with no handicap |
| 2026-11-13 | Midway map (14-scenarios-pacific §3): June 1942, 40 × 28 squares of ocean at about 30 nautical miles a square, so a carrier strike reaches about 7 squares. Midway atoll is drawn enlarged: Sand Island (command post and harbor) and Eastern Island (airstrip) inside a reef ring. Japan's four Carriers start north-west of Midway, able to strike Sand Island; three US Carriers wait north-east at Point Luck, one move from striking range; nothing can reach either side's Carriers from the start. Japan wins by capturing the command post and airfield, the US by holding out to day 12. Half income (500 a property), Japan has no airfield. The US moves first, as on every built-in map, so it stays the army green player; Japan's first turn is the dawn strike. No fog of war yet. The map overview tool colors by side, not player order |
| 2026-11-14 | At the developer's request: the **Torpedo Bomber** hits surface ships for 60, halved from 120, so one torpedo no longer sinks a full-strength Carrier (03-combat §5b). The **low fuel warning** comes sooner for aircraft and ships: as soon as one more full turn away from home would leave too little fuel to get back (05-supply-transport §11). **Submerged submarines are hidden** from the other side unless one of its units is next to them, as in the original, reversing D5 (2026-10-31): the screen shows the game as the human whose turn it is sees it, the computer is shown the same, and a unit that runs into a hidden submarine is ambushed: it stops short and its turn ends (05-supply-transport §9) |
| 2026-11-14 | At the developer's request: a **Carrier's range is its aircraft's**: its threat range shows every tile its aircraft could strike if launched from where it is (05-supply-transport §10). **Battleships and Carriers get very limited AA**: they fire back at aircraft that attack them from next door, at 10–15% (a Destroyer's AA is 55–105), never first, no ammo (03-combat §2, §5d). **Bombers carry 70 fuel** (was 50), and **Dive Bombers carry 1 bomb** (was 2) (01-units §8). **Only maps modeled on WW2 battles remain**: Normandy, Bastogne, Iwo Jima, The Slot and Midway; Twin Bridges, Bocage Country, Crossroads, Contested Skies, Narrow Sea, Beachhead and Proving Ground are removed (§8) |
| 2026-11-14 | At the developer's request, **Bastogne is plain defeat for both sides**: capture the enemy HQ or destroy every enemy unit. Germany no longer wins by taking Bastogne, nor the US by holding out to day 12 (13-scenarios-ardennes). AI vs AI games there now run 59 to over 80 days (09-ai §7) |
| 2026-11-14 | At the developer's request, **the Soviet Union gets its own art** (08-art-pipeline §12, §18): Red Army land units (SSh-40 helmet, the greatcoat roll worn across the chest, Mosin, PTRD anti-tank rifle team as Assault Infantry, BA-64, ZiS-42, T-70, T-34/76, KV-1 as its Heavy Tank, SU-152 as its Tank Destroyer, M-30, Katyusha, quad Maxim, 52-K) and aircraft (Yak-9, Il-2 Sturmovik as its Bomber, Li-2). No ships for now, and no Dive or Torpedo Bomber: those are carrier aircraft and the USSR had no carriers, as Germany gets none (01-units §2). **Its marking is the plain red star**, white-edged on aircraft: on vehicles, aircraft and the HUD and capture flag, which is a red star on a plain green field. The hammer and sickle is never drawn. In battle scenes its jeep, halftrack, Mobile AA and guns use the US shapes, which it received under Lend-Lease, with the red star; its tanks, Katyusha, soldiers and aircraft are its own. Battle preview: `&allies=ussr` |
| 2026-11-14 | **Kursk map** (15-scenarios-eastern-front), at the developer's request: July 1943, a 68 × 80 theater map of the whole salient (about 3.5–4 km a square), generated from real coordinates with the 4 July front line as a polygon. The Soviet Union (HQ Kursk, 25 properties) against Germany (HQ Orel, 18 properties). Soviet defense belts of bunkers and anti-tank obstacles behind the north and south faces, never on roads; none on the west face. Both pincers start in place, the Steppe Front's tank reserve near Stary Oskol. HQ capture only, as on Normandy. The Soviet Union moves first and is army green: **every built-in map puts the Allies first** (the US on all the others) |
| 2026-11-14 | At the developer's request, **each army wears its own nation's color** instead of a color by player slot, so no army is red: the US olive drab, Germany field grey, Japan khaki, the Soviet Union 4BO green. It covers sprites, battle scenes, owned buildings and the panels. Two players who would wear the same color (or a nation with no color of its own) fall back to the first free slot color: army green, red, blue, gold (08-art-pipeline §12, §13, §15) |
| 2026-11-14 | At the developer's request, **Iwo Jima opens with the US entirely afloat** and Japan dug in harder, so the player must bombard before landing (14-scenarios-pacific §1). Every US soldier and tank starts aboard six Landing Craft more than a turn from the beaches; three Battleships, two Destroyers, two Carriers with Dive Bombers and two Bombers (flown in from the Marianas, unable to refuel until an airfield is taken) can strike on day 1, out of reach of every Japanese gun. Japan gets a manned beach line of pillboxes plus mortars and artillery, so every beach on the island is under fire: 40 units (was 23) and 31 bunkers (was 20). Japan now holds out to day 18 (was 15) |
| 2026-11-14 | At the developer's request, **the Iwo Jima anchorage gets an Airfield again, standing for the Marianas** (14-scenarios-pacific §1): the US Bombers fly home to it to refuel and rearm, about two turns each way, and the US can build aircraft there from day 1 |
| 2026-11-14 | At the developer's request, **US income on Iwo Jima is cut by removing the anchorage's second Port**: the US starts with 4 properties (HQ, Factory, Port, Airfield), 4,000 a day. A half-income modifier was tried first and dropped: income is set by the properties on the map, not a special rule |
| 2026-11-14 | At the developer's request: **Japan has a third fewer cities on Iwo Jima** (Minami and Higashi removed: 4 cities and 9 properties, was 6 and 11), to cut its income (14-scenarios-pacific §1). **Bombers burn 4 fuel a day** (was 8), on every map (01-units §8a), so they can fly longer runs, such as Iwo Jima's from the Marianas airfield |
| 2026-11-14 | At the developer's request, **units turn to face the way they move and look like they're moving** on the map, as in the original (08-art-pipeline §22): left and right show the side view (mirrored for left), down shows the unit's front and up its back, and it goes back to side on, facing its side's way, when it stops. Every unit of every nation gets front and back views, two frames each, generated in `tools/art/facings32.mjs`. While moving, frames play four times as fast, soldiers hop and vehicles bump once a square, vehicles kick up dust and ships leave foam; a move takes 90 ms a square (was 70). Pack sheets list their views in a new `facings` field |
| 2026-11-14 | At the developer's request, **Halftracks no longer resupply aircraft**: an aircraft has to fly back to an owned airfield (or a Carrier, for carrier aircraft) to refuel and rearm (05-supply-transport §3, §5). Ships and land units are still resupplied by an adjacent Halftrack |
| 2026-11-14 | At the developer's request, **beaches are drawn half sea, half sand**, the half facing the sea as water with surf, chosen from the tiles around (rounded corners and inner corners included), and **a port's harbor opens toward the sea beside it** (north, east, south or west). Sea no longer draws a line of foam against ports or beaches, which made them look walled off (08-art-pipeline §14, §15). Drawing only: no rule changes |
| 2026-11-14 | At the developer's request, **a garrisoned bunker must be destroyed to get at the soldiers inside** (03-combat §4): attacks on Infantry, Assault Infantry or a Mortar Team in a bunker hit the bunker, with its HP and defense (the `Fort` column; units without one can't attack a garrison). The garrison fires back at full strength while the bunker stands, and dies with it when it breaks (a kill for the attacker). Vehicles on a bunker are still hit directly, with its 5 stars |
| 2026-11-14 | **A destroyed bunker is gone for good**: its Rubble can never be rebuilt, repaired or garrisoned. Rubble was briefly set to 0 defense stars, then kept at 1 at the developer's request (02-terrain §4) |
| 2026-11-15 | At the developer's request, **sound effects** (16-sound). Sound plays events the engine already decided and never affects the rules; only what the player can see is heard. Battle, capture and drop scenes play each shot as it leaves the muzzle, its impact as it lands, and an explosion when a machine or bunker is knocked out (soldiers fall without one); units moving on the map play a loop for how they move (footsteps, wheels, tracks, propellers, ships' engines); turn start, game over, building, captures, ambushes and the controls have short cues. **Licensing:** CC0 preferred, CC-BY with credit; nothing non-commercial or "no redistribution", because the public repo hands out every file; every file listed in `public/assets/sounds/CREDITS.md`. Sounds are named in the art pack (`sounds`), downloaded with the art rather than streamed. A sound button in the HUD (Off, Low, Medium, High, saved on the device), M to mute, `?sound=off`. For now every sound is a placeholder made by `npm run sounds` from tones and noise; real recorded sounds are next |
| 2026-11-15 | At the developer's request, **Fighters and Bombers can fly two full days out from an airfield and two days back** on a full tank (01-units §8a). The Fighter's tank goes from 80 to 90 to meet it; the Bomber (70) already did |
| 2026-11-15 | Milestone 18, Greedy v4, at the developer's request (09-ai §4d). A mixed army: a unit type is worth less to build the more of it we have, indirect fire is capped at a third of the land army, the minimum of capture-capable units grows to a quarter of it, and the enemy's damage counts half as much against buying expensive units. Guarded objectives: the defenders of a property the enemy must capture don't sail away, and one stands on it (on Midway the US AI used to ship the Marines off). Landing Craft and Transport Aircraft refuel before a trip they lack the fuel for. Easy has none of the first two |
| 2026-11-15 | At the developer's request, a **self-play harness** for finding engine bugs without playing (09-ai §7): a state checker run after every command of an AI game, a Random AI, 3 days of random play on every built-in map in the test suite, and `npm run selfplay` for large batches, which saves any failing game with its seed and commands. Also a Claude Code Stop hook (`.claude/hooks/check-on-stop.sh`) that runs `npm run check` when a session finishes with uncommitted code changes and sends a failure back to be fixed |
| 2026-11-15 | **The United Kingdom gets its own art** (08-art-pipeline §12, §17, §18), for the Market Garden map's two Allied players. Map sprites, front and back views, battle figures and 3D models for every unit type the UK fielded, all 21: Tommy with a Brodie helmet and Lee-Enfield, PIAT team, 3-inch mortar, Daimler armoured car, Universal Carrier (the Halftrack), Stuart, Sherman Firefly, Churchill (Heavy Tank), Achilles, 25-pounder, Land Mattress (Rocket Artillery), Crusader AA, Bofors (Flak Gun), Spitfire, Lancaster, Dakota, Fairey Barracuda, Fairey Swordfish, HMS Warspite, Tribal, T-class submarine, LCT, Vosper MTB and HMS Illustrious (the UK's Carrier is no longer the Essex). An air-dropped UK Infantry is the 1st Airborne: a Denison smock and a Sten, under the airborne helmet or the red beret, picked by unit id. The RAF roundel is the only marking, on vehicles where the US carries its star. **New nation color:** British Service Colour No. 2 brown (`brown`), so a US and a UK player never match; buildings get a brown column. **Canada borrows the UK's art and color** (`ART_LOANS` in the art pack); a game with both UK and Canadian players gives both a slot color, by the usual rule. `?nations=uk,germany` makes each player field that nation on any map, to see a nation's art |
| 2026-11-15 | At the developer's request, **Market Garden is the next map** (17-scenarios-market-garden, designed, not built): September 1944, 32 × 44, Leopoldsburg to Apeldoorn. The US (101st and 82nd Airborne) and the UK (XXX Corps and the 1st Airborne) as two Allied players, the first map with two players on one side, against Germany; the UK gets its own sprites and battle scenes. Paratroopers start in their aircraft and are dropped on turn 1. The Allies win by holding Eindhoven, Nijmegen and Arnhem together for 2 days, and Germany by holding out to day 12. New terrain **Major Bridge** (02-terrain §4a): Assault Infantry standing on one can blow it, leaving a Blown Bridge that moves like River, and can rebuild it like a capture (20 points, two turns at full strength). It can't be shot down. Ordinary Bridges are unchanged and can never be blown, so no existing map changes |
| 2026-11-15 | At the developer's request, for **two players on one side** (first needed on Market Garden; not built yet): **an ally's property repairs and resupplies your units**, paid from your own funds, and aircraft and ships on an ally's airfield or port burn no daily fuel. You still can't build at or capture an ally's property (04-economy §5). **By default the computer plays everyone not on the first player's side**, rather than everyone but the first player, so one person plays both the US and the UK on Market Garden (09-ai §5). Neither changes any existing map |
| 2026-11-15 | **Market Garden built** (17-scenarios-market-garden), with Major Bridges (02-terrain §4a), ally repair (04-economy §5), the computer playing the other side by default (09-ai §5) and Greedy blowing and rebuilding bridges (09-ai §4e). The map is 32 × 44 with eight Major Bridges; it comes second on the map select, after Normandy. In AI vs AI games Germany wins every time so far; balance for human players is untested |
| 2026-11-15 | At the developer's request, **Second El Alamein is the first North Africa map** (18-scenarios-north-africa, designed, not built), chosen over Gazala, Crusader, Kasserine and Torch: October 1942, about 36 × 32 squares of about 3 km, El Daba to El Hammam, the coast to the Qattara Depression. The UK (the whole Eighth Army, with the Commonwealth divisions and the Free French folded in) moves first and attacks; Germany and **Italy, a new Axis nation**, are two Axis players, played by the computer by default. Italy borrows Germany's art for now and flies a plain tricolour, never the Savoy crest or the fasces. The Allies win by capturing El Daba (Germany's HQ), the Axis by holding out to day 15. Axis tanks start short of fuel; supply is shown through few, far-apart properties, with no new supply rule. **Three new terrains** (02-terrain §4b): **Minefield** (the Obstacle's rules, in two belts along the whole front), **Ridge** (Forest's numbers: low ridges tanks can cross) and **Salt Marsh** (the Qattara Depression, impassable to land units). A **desert season** draws the map and battle scenes in sand, as the winter season draws snow (08-art-pipeline §21) |
| 2026-11-15 | **El Alamein built** (18-scenarios-north-africa), third on the map select. **Italy** is a nation on the Axis side; it borrows Germany's map sprites and battle figures and wears blue, its azzurro, so Germany keeps field grey on a map with both (a borrowed grey would have cost both their color). Its flag is the plain tricolour. **Minefield, Ridge and Salt Marsh** terrain (02-terrain §4b, map letters `m`, `d`, `z`) and the **desert season** (08-art-pipeline §21: `desertPath` sheets, desert battle colors, dunes for treelines). The map has two 4-connected minefield belts, 51 squares, from the sea to the Depression. AI vs AI, the Axis wins every game on day 15: the Allied AI clears a few mine squares but makes no corridor |
| 2026-11-15 | **Commanders are fictional** (06-commanders), decided by the developer after weighing real generals. Real commanders on every side carry controversy, the character treatment risks glamorizing Axis officers, and thinly changed names would leave the person recognizable. Rules: unrelated names, no one-to-one stand-ins, style in place of biography, original portraits, military characters only, the same treatment for every nation. **Two commanders per nation**, each with one always-on bonus and one always-on drawback as modifier data. A v0 roster of 14 with placeholder names is designed, not built; it needs milestone 13 (CO hooks). Commander powers are not designed |
| 2026-11-15 | At the developer's request the commander roster is cut from 14 to **seven, one from each nation**, with each pair's effects merged (06-commanders §3). **A commander serves a side, not a nation**: any Allied commander for any Allied nation, any Axis commander for any Axis nation, never across. **No commander** is always a choice and the default, for a plain game. **Portraits** are 32 × 32, drawn in code (`tools/art/commanders.mjs`, `docs/art/commanders/`). Designed for when it is built: the portrait sits in the turn bar beside the flag, and the turn menu gains **COMMANDERS** above RESIGN and END TURN, a screen listing every commander with the current player's own already selected. No game code yet |
| 2026-11-16 | At the developer's request, an eighth commander: **Dale Calloway, a US admiral and the naval specialist** (Ships +1 move and +10% defense; Tanks −10% attack), so the Allies have five and the Axis three. **Portraits are redrawn at 48 × 64 from the waist up**, each in an officer's uniform of their nation in its real colors (06-commanders §4), still with no Nazi or political symbols; a 32 × 32 head crop is for the turn bar. **No commander is built on vision** until the game has fog of war: Falk's Recon bonus is +1 move |
| 2026-11-16 | **Milestone 13, CO hooks, built** (06-commanders §6): all eight commanders work in the engine. A player has an optional commander from their own side; the engine derives that player's modifiers from it at lookup time and stores nothing else. The modifier layer gains scopes for who started the fight and for the opponent, and three new values: HP repaired on a property, and the kills for Veteran and Elite. Rulings: a garrisoned bunker defends as its holder would, "in Cities" means City terrain only, Falk's units start with their smaller tanks and racks, and percentages add to the formula's attack and defense values as veterancy does. Luck modifiers are not built, since no commander uses luck. `npm run selfplay -- --commanders` plays every player under a commander. The screens (pick a commander, the turn bar portrait, COMMANDERS in the turn menu) are next |
| 2026-11-16 | **Commander screens built** (06-commanders §5). Each player's commander is picked on the map select with a button that steps through No commander and their side's commanders. The head shows in the turn bar left of the flag, as tall as the flag and funds rows together (the developer's request). COMMANDERS is the first item in the turn menu. Choices not in the design: closing the screen returns to the turn menu on COMMANDERS so a stray Z can't end the turn; a medal button in the turn bar and the C key open it at any time, which is how it is offered during the computer's turn, and then it selects the watcher's commander; portraits and commander display names are part of the art pack; `?commanders=` sets them from the address |
| 2026-11-16 | At the developer's request, a **Supply Ship**, the gap in the naval roster: land units had the Halftrack and carrier aircraft their Carrier, but ships could only refuel in port (01-units §4, 05-supply-transport §3a). Following the original's naval supply boat: at the start of its owner's turn it refuels and rearms every friendly unit next to it except aircraft, as a Halftrack does, and has the same Supply action; and it repairs its own player's ships next to it 1 HP a day for 10% of their cost, as a Carrier repairs its aircraft. It carries nothing (the Landing Craft does that). 10,000, moves 5, 99 fuel at 1 a day, vision 1, unarmed, as easy to sink as a Landing Craft (03-combat §5b). Art for the US (Cimarron-class oiler), UK (Dale-class RFA oiler) and Japan (Kazahaya); Germany none yet (08-art-pipeline §17, §18). For a ship, a square next to a friendly Supply Ship counts as home for the low fuel warning (05-supply-transport §11) and for the AI (09-ai §4f), which builds one per four warships, up to two. Offered on The Slot and Midway as well as the new map |
| 2026-11-16 | **Guadalcanal map** (14-scenarios-pacific §4), at the developer's request, built for the Supply Ship: October 1942, 42 × 24 squares of about 5 km. The US holds Henderson Field with no port on the island; its ships refuel at Tulagi or at sea. Japan's convoy comes down the Slot (pulled in to run from the west) short of fuel with a Supply Ship; its battleships close in to shell the airfield; the Sendai Division attacks from the west and, through the jungle, from the south onto Edson's Ridge. Rekata Bay and Koli Point are neutral. Japan wins by taking Henderson Field, the US by holding it to the start of day 15. Half income. AI vs AI the US holds every game |
| 2026-11-16 | At the developer's request, **Halftracks no longer resupply ships**, only land units (05-supply-transport §3, §7): a ship refuels and rearms at an owned port or next to a friendly Supply Ship. And **ship fuel is rescaled to the real ships' endurance** (01-units §8a): the days a ship can sail at full speed on a full tank follow the square root of its real endurance at cruising speed, so the order and gaps between classes are kept but small craft stay usable. Battleship 80 (was 99), Carrier 85 (99), Submarine 90 (80), Destroyer 65 (80), Landing Craft 35 (70), Torpedo Boat 20 (50); the Supply Ship keeps 99. Daily burns are unchanged |
| 2026-11-16 | At the developer's request, **ships no longer sink when they run out of fuel** (05-supply-transport §7), a departure from the original: like a land unit, a ship at 0 fuel is stranded where it is, unable to move until a port or Supply Ship refuels it, but can still attack, launch aircraft or resupply. A submerged submarine that runs dry surfaces and can't dive again until refuelled (§9). Aircraft still crash. And **Supply Ships carry 5 supplies** (05-supply-transport §3b), kept as their ammo count: each resupply (a start-of-turn round that tops anyone up, or a Supply action) spends one, however many units it refills; only a port refills them, never another Supply Ship, so two can't keep each other and their fleet supplied forever. Repairs, paid in funds, don't need supplies. The tile info shows "Supplies", and the ammo can warns at 2 or fewer. The AI sends an empty Supply Ship back to port and doesn't count on one for its ships (09-ai §4f) |
| 2026-11-16 | At the developer's request, **a new game is two screens, each usable from the keyboard alone** (06-commanders §5): the map, then players and commanders with the options and Start. Menus are designed for keyboard first; the mouse is a convenience. On the players screen Left and Right change the commander in focus, and X goes back to the maps keeping the choices. Replaces the single map select screen, where the commander choice was awkward to reach without a mouse |
| 2026-11-17 | At the developer's request, **fog of war** (19-fog-of-war), an option on the new-game screen (off by default), not a scenario setting. The original's rules: each side sees within its units' vision, counted in steps, plus its own properties; foot soldiers on Hills +3 vision; Forest, **Bocage** (hedgerows, made for ambushes) and Reef hide units from anyone not next to them; **Ridge doesn't hide** (low, open, raised ground); aircraft never hide. Running into a hidden unit is an ambush for every unit, and so is unloading onto one. Orders are judged by what the player saw when giving them, so a unit hidden in a Forest must be spotted by one unit before another can attack it (differs from the original). Units firing from the fog stay hidden. With two or more humans the pass-the-device screen is always used; Undo is cleared by any move that brings a tile into sight. Rain is left for later |
| 2026-11-17 | At the developer's request, **Rain** (12-weather §3a), following the original game: fog of war for the day even in a game without it, every unit sees 1 square less, and mud raises wheel and track costs on Plains, Forest, Ridge, Bocage and Rubble as in the original (foot, air and sea unaffected). A game with rain in its forecast always uses the pass-the-device screen between humans. Kursk gets rain on days 3 and 8 for the summer thunderstorms. `?weather=` in the URL sets any weather for testing |
| 2026-11-18 | At the developer's request, an **autosave** (11-tech-setup §3j), so a page reload (a phone dropping a background tab) doesn't lose the game: one slot in the browser's storage, written after every order, and a Continue button on the title screen. It keeps the game state and the new-game choices that aren't in it (computer players and level, pass-the-device, battle scenes). A reload loses Undo history and the AI's memory of enemies seen in fog. A hot-seat game resumes behind the pass-the-device screen. Save slots and save files stay for later |
| 2026-11-17 | At the developer's request, **the computer keeps up the pressure from the sea** (09-ai §4h): a Landing Craft or Transport Aircraft too low on fuel to get home no longer counts against building another, funds kept back for a transport aren't spent elsewhere, and landings aim at the properties the side wins by capturing. Before, the computer landed one wave and then left its fresh troops idle at home |
| 2026-11-17 | At the developer's request, **the computer's land units are drawn toward the scenario's objectives** (09-ai §4i): a small score for each step nearer the nearest capture or hold objective not yet held, half the pull of a unit's own goal, with no pull on HQ-only maps. A stronger pull and one that grows toward the deadline were tried and made things worse. Objectives move the attacker slightly closer but change no results: what's missing is massing and roles, the planning layer |
| 2026-11-16 | At the developer's request, **a beach's sand flares out to the corner of full land beside it** (08-art-pipeline §14): where sea on one side of a beach meets plains, forest or other full land on the side next to it, the waterline sweeps out to that tile's corner instead of meeting it halfway, which left a quarter of sand beside a full tile on Guadalcanal's capes. Drawing only; no rule changes |
| 2026-11-16 | At the developer's request: **the tile info box shows the flag of a unit's nation** beside its name (§12). **Depth charges are dropped, not thrown** (08-art-pipeline §18): in the battle scene they roll off the destroyer's stern into its wake, and are then seen sinking onto the submarine. And **the Hills battle backdrop is a mountainside**: a bare rock crag with ranges of jagged peaks behind, replacing the rounded grassy crest, which read as a mound. The map tile and the rules for Hills are unchanged |
| 2026-11-16 | At the developer's request, **veterancy chevrons point up and have no dark box behind them** (08-art-pipeline §5): gold stripes drawn straight over the unit's corner |
| 2026-11-18 | At the developer's request ("the minefields look like bunkers in the animation"), **minefields and obstacles have their own battle-scene targets** (08-art-pipeline §18): attacking a Minefield shows wire on pickets, yellow warning signs and buried mines that go off stretch by stretch as its HP drops; attacking an Obstacle shows rows of dragon's teeth that crack and topple. The name over the half is the terrain's. Drawing only; no rule changes |
| 2026-11-18 | At the developer's request, **Italy gets its own art** (08-art-pipeline §12, §18), replacing the loan of Germany's: map sprites with front and back views for every unit type it fielded (Carcano and M33 helmet, Solothurn anti-tank rifle, 81mm mortar, AB 41, SPA lorry as its Halftrack, L6/40, M13/40, Semovente 75/18, 75/27, a Breda 20/65 autocannone, the 90/53, the C.202, SM.79 and SM.82), and battle scenes with its own soldiers (Carcano, MAB 38, Breda 30), tank crews in the *casco da carrista*, 3D L6/40, M13/40 and Semovente models, the AB 41 and its aircraft; its lorry, guns and AA take the German shapes, as Japan's do. No national marking on vehicles; aircraft carry only the white fuselage band and the plain white rudder cross, never the fasces or the Savoy crest. Italy keeps blue, its azzurro |
| 2026-11-18 | At the developer's request, **the game is called WW2**, and **the map select is a world map by theater** (§12): Western Europe, the Eastern Front, North Africa and the Pacific, a dot where each battle was fought, and a camera that flies between theaters. The battle picked but not yet confirmed shows a terrain sketch of its big geographic features (not a shrunken map) and, cropped like a film still, the battle scene of the unit the map is about. Real coastlines come from Natural Earth (public domain) through the `world-atlas` package, turned once into a committed file. Presentation only; no rule changes |
