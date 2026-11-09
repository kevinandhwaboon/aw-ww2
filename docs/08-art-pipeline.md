# Topic Doc 08: Art Assets and Pipeline

**Status:** Asset list complete. US and German land unit sprites are approved and drawn in the game (section 12), terrain, buildings and fortifications are drawn in the game (sections 14–15), and art can be swapped with art packs (section 13). Battle scenes are built with figures drawn in code (section 18). Everything else is still open.
**Last updated:** 2026-11-07
**Depends on:** 00-master-design.md (sections 3, 6, 12, 13, 14), 01-units.md, 02-terrain.md.

This doc is written to start a new conversation on its own: it lists everything the game needs drawn, and the questions to answer before generating any of it.

---

## 1. The brief

- A turn-based WW2 tactics game in the browser, with mechanics inspired by the GBA-era Advance Wars games.
- **Style:** pixel art, GBA-era. Not the style of the recent remake.
- **Size:** 16×16 map tiles, shown at whole-number zoom with crisp, nearest-neighbor scaling. The test map is 15×10 tiles (240×160, the GBA screen). Later maps are much larger.
- **All art must be original.** Nothing copied or traced from Nintendo's games, including names, characters, UI layouts or sprites.
- **No Nazi or political symbols, ever.** The swastika is never used. Sides are told apart by color and equipment silhouette. Any other national insignia is an open decision (section 9).
- **Units mirror real WW2 equipment,** but stats are identical across nations. A Sherman and a Panzer IV are the same Medium Tank with different art.
- **Art is swappable.** Everything today is a placeholder drawn in code, so art can replace it piece by piece as long as sheet layouts stay consistent.

## 2. Terrain (map tiles)

Each is 16×16 unless noted. The tiles in this section are drawn and in the game (section 14). Properties, fortifications and rubble still use placeholders.

| Terrain | Needs | Notes |
|---|---|---|
| Plains | 1–3 variants | Most common tile, so variation matters |
| Forest | 1–3 variants | |
| Hills | 1–2 variants | Replaces mountains; low Normandy-style hills, not peaks |
| Bocage | 1–3 variants | Hedgerow country, the signature Normandy terrain. Has to read differently from Forest |
| Sea | 1 base, animated | 2–4 frames of water |
| Reef | 1 | Rocks in the sea |
| Road | Connected set | See below |
| River | Connected set, animated | See below |
| Bridge | 2 (horizontal, vertical) | Over river |
| Beach | Connected set | Where sand meets sea and land. The key tile for landings |
| Coastline | Connected set | Where sea meets land directly |

**Connected sets:** tiles that change shape based on their neighbors. A road needs roughly 16 pieces (straights, corners, T-junctions, crossing, ends). Coastlines need more if corners are smoothed, up to 47. Section 14 has how the game picks them.

## 3. Properties and fortifications

| Item | Needs | Notes |
|---|---|---|
| City | 1 sprite, 5 colorings | Neutral plus 4 player colors |
| Factory | 1 sprite, 5 colorings | |
| Airfield | 1 sprite, 5 colorings | |
| Port | 1 sprite, 5 colorings | Sits on the shoreline |
| HQ | 1 sprite, 5 colorings | Must stand out from a City |
| Bunker | 1, optionally damaged versions | Damaged state currently shows as an HP number |
| Rubble | 1 | What a destroyed Bunker becomes |
| Obstacle | 1 | Dragon's teeth or similar |
| Beach obstacle | 1 | For phase 2 landings |

Properties, Bunker, Rubble and Obstacle are drawn and in the game (section 15). The beach obstacle and damaged bunker versions aren't drawn yet.

## 4. Units (map sprites)

21 types, 16×16. The two-letter code is what the placeholder shows today.

**Land**

| Code | Unit | Allied examples | Axis examples |
|---|---|---|---|
| IN | Infantry | GI, Tommy | Wehrmacht rifleman |
| AI | Assault Infantry | Bazooka team, assault engineers | Panzerschreck team, Pioniere |
| MO | Mortar Team | US/UK mortar team | Granatwerfer team |
| RC | Recon | Willys jeep, Daimler | Zündapp KS 750 with sidecar, Sd.Kfz. 234 |
| HT | Halftrack | M3 | Sd.Kfz. 251 |
| LT | Light Tank | M5 Stuart | Panzer II |
| MT | Medium Tank | Sherman | Panzer IV |
| HV | Heavy Tank | Churchill (UK only) | Tiger |
| TD | Tank Destroyer | M10 | StuG III |
| AR | Artillery | M2 howitzer | leFH 18 |
| RK | Rocket Artillery | Calliope, Land Mattress | Nebelwerfer |
| AA | Mobile AA | M16 quad .50 | Flakvierling |
| FK | Flak Gun | 90mm AA | 88mm Flak |

**Air**

| Code | Unit | Allied examples | Axis examples |
|---|---|---|---|
| FT | Fighter | Spitfire, P-51 | Bf 109, Fw 190 |
| BM | Bomber | B-26, Lancaster | Ju 88 |
| TA | Transport Aircraft | C-47, Dakota | Ju 52 |

**Naval** (rules not built yet, milestone 10)

| Code | Unit | Allied examples | Axis examples |
|---|---|---|---|
| BB | Battleship | HMS Warspite, USS Texas | Rare; depends on scenario |
| DD | Destroyer | Fletcher, Tribal | Z-class |
| SS | Submarine | Allied subs | U-boat |
| LC | Landing Craft | LCT, LST | Rare |
| TB | Torpedo Boat | PT boat, MTB | E-boat |

**Sprite count depends on a decision (section 9).** One sprite per unit type is 21. One per side is about 40. One per nation (US, UK, Canada, USSR, Germany) is far more, and is limited by the availability rule: a nation only needs art for units it historically fielded.

**Per sprite, also decide:** which way it faces, idle frames, and movement frames. Units that have acted currently dim to half opacity, which needs no extra art. Team color is meant to be a palette swap, so 4 player colors don't multiply the drawing work.

## 5. Unit overlays

Small marks drawn on top of unit sprites. All of these exist today as placeholders.

| Item | Needs |
|---|---|
| HP number | Digits 1–9, shown when a unit is damaged |
| Veterancy badges | Veteran (1 chevron), Elite (3 chevrons) |
| Capturing | C badge |
| Carrying passengers | + badge |
| Low fuel warning | F badge |
| Submerged | A wave badge in the top-left corner, plus the sprite tinted with the pack's `submerged` color. Placeholder badge drawn in code today |

## 6. Map UI (drawn in the game canvas)

| Item | Needs | Notes |
|---|---|---|
| Cursor | 1–2 frames | Tile outline today |
| Move range | Tile tint | Blue overlay today |
| Threat range | Tile tints | Orange for move, red for attack today |
| Path arrow | About 10 pieces | Straights, corners and 4 arrowheads |
| Action menu | Panel frame, pointer, highlight | FIRE, CAPTURE, LOAD, JOIN, UNLOAD (or UNLOAD plus a unit name), SUPPLY, DIVE, SURFACE, WAIT, CANCEL, RESIGN, END TURN, KEEP PLAYING, RESIGN NOW |
| Forecast panel | Panel frame | "DMG 71-80%" style text |
| Pixel font | 1 full font | Open-licensed, with letters, digits and % - + ? |
| Floating numbers | Uses the pixel font | Damage, capture and repair labels |

## 7. HTML screens and panels

These are HTML, styled to look like the pixel art. Today they're plain colored boxes in a monospace font.

| Item | Needs |
|---|---|
| Panel frame | One pixel-art frame, as a CSS `border-image` |
| Buttons | Normal, hover, disabled |
| Title screen | Logo and background. The title itself is undecided (section 9) |
| Map select | A thumbnail per map, which could be generated from the map data |
| Turn bar | Icons for day and funds |
| Terrain panel | Small terrain icon, defense star icon |
| Unit panel | Unit portrait or icon, stat icons |
| Build list | A small icon per unit |
| Pass-the-device screen | Background or framing |
| Results screen | Victory and defeat treatment |
| Favicon | 1 |

## 8. Effects

Today's are simple flashes and tweens.

| Item | Needs |
|---|---|
| Hit flash | On the target |
| Explosion | Small and large, 4–6 frames |
| Muzzle flash | Direct-fire shots |
| Indirect fire | Shell or rocket impact |
| Smoke | Destroyed vehicles, optional |
| Bunker destroyed | Crumble or blast |
| Aircraft crash, ship sinking | Out of fuel, or destroyed |
| Capture | Flag raising |
| Repair, resupply | Small sparkle or icon |

**Later, not part of this round:**
- Commander portraits (phase 3).
- Phone layout (phase 3).

The split-screen battle scene came forward from phase 3 and is built (section 18).

## 9. Questions for the art conversation

**How to make it**
1. Which method? 00-master-design §14 compares two: pixel grids written as data and rendered to PNG by a script (exact grid, easy edits, weaker on detail), or AI image tools followed by downscaling, palette snapping and cleanup in Aseprite or LibreSprite (richer, but more manual). A mix may suit: data for tiles and icons, images for portraits.
2. Which tools will you use and pay for, if any?

**Style**
3. What's the master palette, and how many colors? A shared palette is what makes GBA art look coherent.
4. What are the team colors? Blue and red are placeholders. Side colors should work with the palette swap and shouldn't imply politics.
5. What reference style do you want, described in words rather than copied from a game?

**Scope**
6. Generic, per side, or per nation unit art? This sets the size of the job: about 21, 40 or many more sprites.
7. Which way do units face, and do they flip by side?
8. How many animation frames per unit: static, 2-frame idle, or full movement?
9. Can tall tiles overlap the tile above, as hills and tall buildings do in many tile games? It looks better but changes draw order.
10. How far do connected tiles go? 16 pieces or the full 47 for coastlines?

**Rules**
11. What's the national insignia policy (00-master-design §18)? Stars and roundels are easy; the German cross needs a decision. The swastika is never used.
12. What's the game's title? It's needed for the logo, and it must not include "Advance Wars".

**Technical**
13. What are the sprite sheet layout and file naming? These need agreeing once the method is chosen, so art can be swapped without code changes.

## 10. Suggested first step

Make a small test set before committing to a method: Plains, Road, Forest, Sea, City, Infantry and Medium Tank in two team colors. Put them on a real map and judge how it reads at game zoom. That proves the style, palette and team colors cheaply, and then the rest of this list follows from a known recipe.

## 11. Where the art goes in the code

- Placeholder terrain: `src/game/placeholderTiles.ts`
- Placeholder units and overlays: `src/game/placeholderUnits.ts`
- Placeholder HUD flags: `src/game/placeholderFlags.ts`
- Pixel font: `src/game/pixelFont.ts`
- Drawing and effects: `src/game/MapScene.ts`
- HTML panels and screens: `src/ui/`
- Finished art: `public/assets/`
- Unit pixel grids and the script that renders them: `tools/art/`

## 12. Unit sprites as built

Answers so far to section 9. Questions not listed here are still open.

- **Method (Q1):** pixel grids written as data, rendered to PNG by `npm run art`. The grids are the source; don't hand-edit the PNGs.
- **Facing (Q7):** all sprites are drawn facing right, and each map decides which way each player's units face. Set `"facing": "left"` on a player in the scenario file to mirror that player's sprites; the default is right. On the built-in maps, a side that starts on the left faces right and a side that starts on the right faces left, so the armies face each other, and a test checks this against the starting units' average column. Facing doesn't change while a unit moves, and no rule reads it. Mirroring means no second set of art, but it also means unit art can't carry lettering, which would read backwards. Badges and placeholder markers are never mirrored, for the same reason.
- **Animation (Q8):** every unit has 2 idle frames that alternate, so it looks alive while the game is idle. There are no separate movement frames. What moves depends on the unit:

| Unit | Idle animation |
|---|---|
| Vehicles | Hull bobs 1 pixel; treads or wheels shift |
| Infantry, Assault Infantry | Step in place |
| Mortar Team | Crew aims, then ducks |
| Artillery | Barrel recoils 1 pixel |
| Flak Gun | Barrel lifts 1 pixel |
| Mobile AA | Turret swings from forward to back |

- **Sheet layout (Q13):** `public/assets/units/{nation}-land-{team}.png`, 32 pixels wide, with 2 frames across and one row per unit in section 4 order: IN, AI, MO, RC, HT, LT, MT, HV, TD, AR, RK, AA, FK. A nation with no art for a unit leaves that row empty, so the US and Japanese HV rows are blank. `{nation}` is a two-letter code: `us`, `de` or `jp`.
- **Team colors:** only the body colors change per team. Wheels, tracks, skin, the star and the hinomaru stay the same. **Since 2026-11-08 the first player is army green** (team `olive`), the second red and the third blue; every built-in map puts the US first, so the US is army green. Every nation's sheets are rendered in all three, so any player can field any nation. The `grey` (Germany) and `khaki` (Japan) sheets show each nation's natural color and aren't used yet. Buildings get an army green column too (section 15).
- **Naming:** Allies and Axis are the sides. Germany and German are the nation. Wehrmacht is only a description of equipment or uniforms, not a label.
- **German insignia (Q11):** the HUD shows a black Balkenkreuz on grey as Germany's flag. German sprites still carry no national insignia until the rest of Q11 is decided. Camouflage patches fill the space the US star takes, and the sides differ by silhouette.
- **Japanese insignia (Q11):** Japan's HUD flag is its national flag, the plain red disc. Japanese aircraft carry the same disc (the hinomaru) in a thin white ring, as the US carries its star. Land units and ships carry no marking. The rising-sun ensign is never drawn: it's widely seen as a political symbol.
- **Preview:** `docs/art/us-land-units.png` and `docs/art/de-land-units.png` show every unit.

**Art choices that differ from the rules (art only, stats don't change):**
- The US Recon is a Willys jeep, chosen because it can't be mistaken for a tank.
- The Halftrack shows a .50 cal, though the unit is unarmed in the rules (01-units).
- The US Rocket Artillery is the tracked T34 Calliope, though the unit moves on wheels in the rules.
- The German Recon is a Zündapp motorcycle with sidecar, chosen so it can't be mistaken for a tank or the jeep.
- The German Halftrack shows an MG 34, though the unit is unarmed in the rules.
- The German Rocket Artillery, a Nebelwerfer 41, is a towed launcher with no engine, though the unit moves on its own in the rules.
- Japan's Recon is the Type 97 motorcycle with sidecar; its Assault Infantry carries the Type 4 70mm rocket launcher, Japan's late-war bazooka; its Rocket Artillery, the Type 4 20cm launcher, and its Artillery, the Type 91 howitzer, are towed or static, though the units move on their own in the rules.

**Not done yet:** US air and naval units are first drafts in `tools/art/us-units.mjs`, not exported. German air and naval units aren't drawn.

## 13. Art packs

All art, colors and display names come from an **art pack**, so the game's look can be swapped without touching code or rebuilding. Art never affects the rules.

**To make a pack:** create `public/assets/packs/{your-pack}/pack.json`, using lowercase letters, numbers and hyphens for the folder name, and open the game with `?pack=your-pack`. `public/assets/packs/night-ops/` is a small working example.

Only `name` is required. Anything else you leave out keeps the built-in look, so a pack can change one color or everything. A file that won't load, or a pack with a mistake in it, logs a warning in the browser console and the game carries on.

| Field | What it does |
|---|---|
| `name` | The pack's name |
| `players` | One entry per player: `team`, `fill` and `outline`. `team` picks that player's unit sheets |
| `colors` | Any of the color names in `src/game/artPack.ts`, as `"#rrggbb"`: panels, ranges, path arrow, menus, effects |
| `unitSheets` | Sprite sheets: `nation`, `team`, `path`, `frames` and `rows`, and optionally `frameSize` (16 or 32, default 16) and `paratroopers` (section 17) |
| `terrain` | One sheet: `path`, `tiles`, and optionally `frames`, `connected`, `bridges` and `shore` (section 14). Tiles are numbered left to right, top to bottom |
| `unitNames` | Display names by unit id, such as `"mediumTank": "Sherman"` |
| `properties` | Buildings for properties: `path`, `columns` and `rows` (section 15) |
| `terrainNames` | Display names by terrain id |

**Unit sheets** use 16×16 or 32×32 frames (`frameSize`); either way a unit fills one map square, with one row per unit and idle frames running across. Draw units facing right: maps mirror them when a side faces left (section 12). `rows` lists the unit on each row from the top, using `null` for an empty row. A sheet covers one nation and one team. A unit with no art for its nation and team keeps its placeholder, so German units never borrow American sprites.

**Paths** are relative to the pack's folder. Web addresses and absolute paths are refused.

**The default pack** (`public/assets/packs/default/`) is the game's normal look. It points at the sheets `npm run art` writes to `public/assets/units/`. If the art tool's row order changes, `rows` in the pack has to change with it.

**Not in packs yet:** the 3×5 map font, the HP and veterancy badges, the placeholder corner flags, HUD national flags, and menu words like FIRE. They can follow as that art gets made.

## 14. Terrain tiles

The terrain tiles are pixel grids in `tools/art/terrain.mjs`. `npm run art` renders them to `public/assets/terrain/terrain.png`, and the default pack points at that sheet. Properties are on their own sheet (section 15). Bunker, Rubble and Obstacle are terrain tiles 13–15.

**Answers to section 9:**
- **Tall tiles (Q9):** yes, since 2026-11-06. Trees, hills, hedges, fortifications and buildings rise into the tile behind (section 16).
- **Connected tiles (Q10):** roads and rivers have 16 pieces each. Coastlines are 8 foam pieces layered over sea, which gives the same result as the full 47 without drawing 47 tiles. Land next to the sea doesn't change.

**How the game picks tiles:**

| Terrain | What's drawn |
|---|---|
| Plains, Forest, Hills, Bocage, Beach | One of several variants, picked by map position. A cell always gets the same one |
| Road | The piece matching which sides join a road or bridge. Roads are 10 pixels wide, most of the tile |
| River | The piece matching which sides join a river, bridge, sea or reef, so rivers flow into the sea |
| Bridge | The river piece beneath it, with a deck on top. Water above or below means the deck runs left to right, otherwise top to bottom |
| Sea, Reef | The water tile, then foam along each side that touches land. A foam corner shows where land touches only diagonally. Rivers, bridges, reefs and the map's edge count as water |

A road or river that dead-ends at the map's edge runs straight on past it. One that turns or branches at the edge keeps its shape.

**Animation:** sea, reef, rivers and shore foam have 2 frames, swapped every 0.6 seconds. Everything else repeats the same tile in both frames.

**Bocage** is a small field with hedgerows on all four sides, so a patch of bocage reads as hedge country. Forest is round trees, so the two can't be confused.

**Sheet layout:** 8 tiles across, each 16 wide by 32 tall (section 16). The sheet holds one panel per animation frame, stacked top to bottom, each with the same layout:

| Tiles | What |
|---|---|
| 0–2 | Plains |
| 3–4 | Forest |
| 5–6 | Hills |
| 7–8 | Bocage |
| 9 | Sea |
| 10 | Reef |
| 11–12 | Beach |
| 13 | Bunker |
| 14 | Rubble |
| 15 | Obstacle (dragon's teeth) |
| 16–31 | Road, by neighbor mask: N=1, E=2, S=4, W=8, added together |
| 32–47 | River, by the same mask |
| 48–49 | Bridge deck: left to right, top to bottom |
| 50–57 | Shore foam: edges N, E, S, W, then corners NE, SE, SW, NW |

**Pack fields** for a terrain sheet. Only `path` and `tiles` are required, so a pack with one tile per terrain still works:

| Field | What it does |
|---|---|
| `tiles` | Terrain to a tile number, or a list of numbers for variants |
| `frames` | How many animation panels the sheet holds. Default 1 |
| `tileHeight` | 16, or 32 for tiles that rise into the tile behind. Default 16 |
| `connected` | `road` and `river`: the first of their 16 pieces |
| `bridges` | `horizontal` and `vertical` deck tiles, drawn over the river piece |
| `shore` | The first of the 8 foam pieces |

## 15. Buildings

Properties are pixel grids in `tools/art/buildings.mjs`, rendered by `npm run art` to `public/assets/terrain/buildings.png`. The style is a Normandy village: cream stone walls with a roof, banner or trim in the owner's color.

| Property | Look |
|---|---|
| City | Two stone houses with a chimney |
| Factory | Brick shed with a sawtooth roof and a tall chimney |
| Airfield | Round-roofed hangar and windsock beside a runway |
| Port | Warehouse and crane on a quay, with pier posts in the water |
| HQ | A chateau with two towers and a tall banner, so it stands out from a City |

**Owner colors:** the sheet has one row per property and one column per owner: neutral, army green (`olive`), red, blue, green, gold. Neutral is weathered slate grey. A captured property switches column at once.

**Corner flags:** a property drawn from the sheet shows no corner flag, since its colors show the owner. A property with no art for its owner's team keeps the placeholder and its flag.

**Garrisoned bunkers:** a bunker with Infantry, Assault Infantry or a Mortar Team inside is drawn garrisoned, as in Red Alert 2: the firing slit boarded up in the holder's color and their flag on the roof. The soldier itself is hidden inside, though its HP and veterancy badges still show, and it reappears when it walks out. Vehicles on a bunker are drawn as usual. The art is a "bunker" row in the 32-pixel buildings sheet (`garrisonedBunker` in `tools/art/buildings32.mjs`), drawn on a clear background over the bunker tile. A pack without that row keeps plain bunkers and shows the soldier on top. Drawing only: no rule reads it.

**Draw order:** buildings are painted with the terrain, row by row, below the move and attack range tints, so ranges still show on them.

**Pack field** `properties`:

| Field | What it does |
|---|---|
| `path` | The buildings sheet |
| `columns` | The owner each column is for: `neutral`, or a player's `team` |
| `rows` | The property on each row, top to bottom |
| `tileHeight` | 16, or 32 for buildings that rise into the tile behind. Default 16 |

**Fortifications** are terrain tiles, not buildings, because no one owns them: a concrete pillbox for the Bunker, broken slabs and rebar for Rubble, and rows of dragon's teeth for the Obstacle. A unit standing on a bunker covers most of it, as before.

**Not done yet:** damaged bunker versions (damage shows as an HP number), and the phase 2 beach obstacle.

## 16. Depth and shadows

Terrain and buildings are drawn so the map looks solid rather than flat, using the same general techniques as GBA-era tactics games. The art itself is original.

- **Tall tiles:** every terrain and building tile is 16 wide by 32 tall. The bottom 16 rows are the map cell. The top 16 are room for anything that rises above it, and that part overlaps the tile behind.
- **Draw order:** the map is painted one row at a time from the top, so a tree, hill or building in front covers the bottom of the row behind it. Units, ranges, the cursor and menus still draw on top of everything.
- **View:** buildings are seen from the front and a little above: a front wall, a side wall receding to the right, and a roof.
- **Light** comes from the top left. Lit faces are lighter and faces turned away are darker.
- **Shadows** fall to the lower right, inside the object's own cell. A shadow darkens whatever ground it lands on, so the sheets stay fully opaque on the ground.
- **What rises:** Forest, Hills, Bocage hedges, Bunker, Rubble, Obstacle and every building. Plains, roads, rivers, bridges, beach, sea and reef stay flat.
- **Units** stay inside their 16×16 cell. Each one casts a shadow: a dark copy of its sprite, 2 pixels right and 1 down. The game draws it, not the sheet, so it falls to the right even when a unit is mirrored. The shadow color is `unitShadow` in the pack's colors.
- **Unit shading:** US land sprites are lit on the top edge of their team-colored body and shaded on the right edge. German sprites don't have this yet.
- **The map's top row:** anything rising from the top row is cut off at the map's edge.

The helpers for this are in `tools/art/depth.mjs`.

## 17. Art at 32 pixels

Every unit is drawn at 32×32 in a top-down 3/4 view, with five shades per team color, and terrain and buildings are drawn at 32 pixels per square too. **The game uses them since 2026-11-07,** without changing the map: a square is still 16 map pixels and the same size on screen. The game draws at screen resolution and scales the 32-pixel art down to fit a square, so its detail shows instead of being lost. Terrain and buildings are painted at double resolution, then scaled the same way. At an odd zoom (3×, 5×) each art pixel covers 1.5 or 2.5 screen pixels, so pixel edges are slightly uneven; at an even zoom they're exact. The 16-pixel sheets stay in `public/assets/` but no shipped pack uses them.

- **Source:** `tools/art/kit32.mjs` (shared shapes, helmets, rifles and running gear), `us-units32.mjs`, `de-units32.mjs` and `jp-units32.mjs`. Sprites are built from shapes, then outlined and lit from the top left automatically.
- **Wheels** on the jeep, sidecar and halftracks sit in wheel wells: the body wraps round their top half.
- **View:** you look down on the vehicle: the whole hull top, the turret from above, the near side as a band, and the near track along the bottom. The far track isn't drawn, so it doesn't read as straight top-down.
- **Sheets:** `public/assets/units/{nation}-land-32-{team}.png`, 64 pixels wide, 2 frames across, one row per unit in section 4 order. The US sheet adds four rows after the Flak Gun: the paratrooper with a spade, heart, diamond and club.
- **Previews:** `docs/art/us-land-units-32.png`, `docs/art/de-land-units-32.png` and `docs/art/jp-land-units-32.png`.
- **Japan (IJA):** a rifleman with the Type 99 Arisaka at port arms and its long bayonet fixed, the Type 90 helmet with cloth neck flaps hanging behind, puttees; the Type 4 70mm rocket launcher on its bipod; the Type 97 81mm mortar; the Type 97 motorcycle and sidecar; the Type 1 Ho-Ha halftrack; the Type 95 Ha-Go (bellcrank suspension, big side muffler, small offset turret); the Type 97 Shinhoto Chi-Ha (riveted hull, long 47mm, handrail antenna round the turret); the Type 1 Ho-Ni I (open shield, 75mm); the Type 91 10cm howitzer on spoked wheels; the Type 4 20cm rocket launcher; a Type 98 20mm on a Type 94 truck; the Type 88 75mm AA gun. No Heavy Tank.

**Infantry** is the unit that matters most, so it's drawn to be unmistakable:

| Side | Helmet | Rifle |
|---|---|---|
| US | The M1: a rounded dome, widest at the rim, with chinstraps | M1 Garand: deep wooden stock, receiver with the clip on top, gas cylinder under the barrel |
| Germany | The Stahlhelm: a taller crown and a skirt flaring over the ears and neck | Kar98k: dark stock, bolt handle, long barrel |
| Japan | The Type 90: a low, round dome with a narrow rim, cloth neck flaps hanging behind | Type 99 Arisaka at port arms with the long Type 30 bayonet fixed |

**Paratroopers:** a US Infantry unit dropped by a Transport Aircraft is drawn as a 101st Airborne paratrooper: an M1 carbine instead of the Garand, and a card suit on the helmet, as the 101st's regiments marked theirs. It acts exactly like any other Infantry. The rules engine records that the unit was air-dropped (01-units §5); the art picks the suit from the unit's id, so each paratrooper keeps his suit all game. The suit is always white; only its shape changes. Only the US has this look.

In a pack, a sheet's `paratroopers` lists the rows for an air-dropped Infantry (13–16 on the US sheets); the game picks one by unit id.

- **Aircraft** (`tools/art/air-naval32.mjs`): seen from above and a little behind, the far wing short above the fuselage and the near wing larger below it. They bob and their propellers spin. US: P-51, B-26, C-47. Germany: Bf 109, Ju 88, and a Ju 52 with its ribbed skin. Japan: A6M Zero, G4M and Ki-57, each with the hinomaru on the fuselage and wing.
- **Ships:** the deck from above, the hull side as a band, and foam at the bow and a wake that shift between frames. US: USS Texas (battle scenes show an Iowa since 2026-11-09, section 18), Fletcher, Gato, LCT, PT boat. Germany fields only a Z-class destroyer, a Type VII U-boat and an S-boot, so its Battleship and Landing Craft rows are empty (section 4: both are rare). Japan (IJN): a Yamato-class battleship, a Kagero-class destroyer, an I-boat, a Daihatsu landing craft and a Gyoraitei torpedo boat.
- **Air and naval sheets:** `public/assets/units/{nation}-air-32-{team}.png` (rows FT, BM, TA) and `{nation}-naval-32-{team}.png` (rows BB, DD, SS, LC, TB). Previews: `docs/art/us-air-naval-32.png`, `docs/art/de-air-naval-32.png` and `docs/art/jp-air-naval-32.png`.
- **Terrain and buildings** (`tools/art/terrain32.mjs`, `buildings32.mjs`, `depth32.mjs`): tiles are 32 wide by 64 tall, the bottom 32 rows being the map cell and the top 32 room to rise. They use the same sheet layouts as sections 14–15, so tile numbers don't change. Grass has tufts and flowers, roads have wheel ruts, rivers have sandy banks, and buildings have stone courses and tiled roofs. Sheets: `public/assets/terrain/terrain-32.png` and `buildings-32.png`.
- **Pack fields:** terrain and building sheets take `tileWidth` (16 or 32). `tileHeight` is the width, or twice it for art that rises into the tile behind.


## 18. Battle scenes

**Since 2026-11-07,** every attack plays as a split-screen battle scene before the map updates, in the style of the original game's battle animations. The art is original. The scene only shows what the engine already decided (00-master-design §13): the combat event carries the damage, the counter and who was destroyed, and the scene plays it back.

**Layout.** The screen splits down the middle, with the horizon a little above the middle of each half so formations have room to stand in depth. A unit on Hills stands on the hill's grassy, rocky crest, with the valley far below in the haze behind it: small fields, hedgerows, a road and a village. The side whose army faces right on the map stands on the left half, so the two face each other; if both face the same way, the attacker is on the left. Each half shows the unit's name at the top, its HP and 10 HP pips at the bottom, and a background for the terrain the unit stands on: fields and a treeline for Plains, trees for Forest, a hilltop (see Layout), a hedgerow bank for Bocage, houses for a City, a sawtooth factory, a hangar for an Airfield, a quay and crane for a Port, sand with the sea behind and beach obstacles for a Beach, open water for Sea and Reef. The Factory is a brick hall with a sawtooth roof of skylights, arched windows and a loading door, a banded chimney trailing smoke, a water tower, a gantry crane, crates and a railway siding. Aircraft fight against open sky. A submerged submarine fights underwater.

**Order.** The halves slide in, the attacker fires, its shots fly across and land, HP ticks down as each one lands, and figures fall. Then the defender counterattacks the same way if the engine says it did. The scene fades out and the map shows the result. A unit destroyed in the scene also blows up on the map, so it's clear which one is gone. Z, X, Enter, Space, Escape or a click skips the scene.

**Figures show HP.** A unit shows several figures, fewer as it loses HP: the most it shows, scaled by HP out of 10 and rounded up, so a unit with 1 HP still shows one.

| Unit | Figures at 10 HP |
|---|---|
| Infantry | 8 soldiers: the front three kneel, the squad's automatic weapon lies prone at the front, the rest stand |
| Every vehicle and gun: Recon, Halftrack, Light, Medium and Heavy Tank, Tank Destroyer, Artillery, Rocket Artillery, Mobile AA, Flak Gun | 5, in two staggered columns |
| Assault Infantry, Fighter | 4 (Assault Infantry: launcher teams of gunner and loader) |
| Mortar Team, Bomber, Transport Aircraft | 3 (Mortar Team: crews of loader and assistant) |
| Every naval unit: Battleship, Destroyer, Submarine, Landing Craft, Torpedo Boat; Bunker | 1 (since 2026-11-09 each naval unit is one larger, more detailed ship; before, Destroyers, Submarines and Landing Craft showed 2 and Torpedo Boats 4) |

Figures fall from the back of the formation first, as the shots that take them land. Soldiers topple over and fade (a prone gunner slumps where he lies). Each man falls about his own feet; the gear around him stays where it is, so a Mortar Team's tube and its ammunition crate stay upright with the crew lying beside them, and a dug-in squad's sandbags stay put on a bunker (since 2026-11-08; before, the whole team rotated with its mortar); vehicles and guns blow up, go dark and keep burning; aircraft fall out of the sky trailing smoke; ships burn and settle.

**Infantry squads** carry what real squads did: mostly riflemen (Garand or Kar98k; the M1 carbine for paratroopers), the squad's automatic weapon (a BAR or an MG 42) fired prone off its bipod, and submachine guns. A German squad has one MP 40, the squad leader's. A US squad has two Thompsons, drawn as the drum-fed M1928 with its vertical foregrip; paratroopers carry a third. Riflemen fire single shots; the submachine guns and the automatic weapon fire bursts.

**Paratroopers.** US Infantry dropped by a Transport Aircraft (01-units §5) fights as 101st Airborne paratroopers: the tan M1942 jump suit toned with the team color, brown jump boots with a knife strapped to one, bulging cargo pockets, a musette bag instead of a pack, a scrim-netted helmet with the regiment's card suit on it, M1 carbines and the extra Thompson. The suit is the same one the map shows for that unit, picked by unit id: spade, heart, diamond or club.

**Dug in.** Infantry, Assault Infantry and Mortar Teams on a Bunker fight from behind sandbags, with a concrete casemate, camouflage netting and barbed wire behind them.

**Detail.** Battle figures are much larger than map sprites: a standing soldier is about 44 pixels tall, a tank 50 to 90 pixels long. Each unit's animation shows what makes it different:

| Unit | When it fires |
|---|---|
| Infantry | The squad aims and fires in a ragged volley. US riflemen eject Garand brass; German riflemen work the Kar98k's bolt between shots; the SMG and the BAR or MG 42 fire bursts |
| Assault Infantry | The loader slides a rocket into the tube, taps the gunner's helmet and ducks; the rocket leaves with a backblast. Bazooka for the US, Panzerschreck with its blast shield for Germany. With the secondary weapon the gunner slings the launcher and fires his SMG |
| Mortar Team | The loader lifts a round over the muzzle and lets it drop; both crew duck with their hands over their ears; the round arcs high and falls on the other half |
| Recon | The gunner behind the jeep's .30 cal (or the sidecar gunner on the German motorcycle) fires bursts |
| Tanks, Tank Destroyer | The gun recoils, the hull rocks, dust kicks up in front. With the secondary weapon, the hull machine gun fires instead |
| Artillery | The loader carries a shell up and rams it home, steps back covering his ears, and the gunner pulls the lanyard; the barrel recoils and the gun hops |
| Rocket Artillery | Six rockets ripple out with smoke trails and leave a cloud behind the launcher: a Calliope rack on a Sherman, or a Nebelwerfer fired from a sandbagged foxhole. A forward observer kneels out in front of the lead launcher, watching the target through binoculars, with a field telephone |
| Mobile AA, Flak Gun | Barrels fire in turn, aimed high at aircraft and flat at ground targets; the Flak Gun's loader brings the next round and the spent casing flies out |
| Fighter | Wing guns (and the Bf 109's nose guns) fire tracers |
| Bomber | The bomb bay opens and bombs fall out of the bottom of the half, then onto the target |
| Battleship | Turrets fire salvo by salvo, with huge flashes; the ship rolls |
| Destroyer | Deck guns fire; against a submarine, surfaced or submerged, it throws depth charges from the stern |
| Submarine, Torpedo Boat | Torpedoes run just under the surface with a trail of bubbles |

Halftracks, Transport Aircraft and Landing Craft are unarmed in the rules (01-units), so they only ever take fire.

**What flies.** Every shot leaves the muzzle in the direction the barrel points, and the flash points the same way. Direct fire flies straight across the line between the halves. Indirect fire (mortars, artillery, rockets) is fired high: the round leaves fast along the raised barrel and climbs out of the top of the screen, there's a pause of about a second while it's overhead, and then it drops steeply onto the target from high above. On the way up it shows only over the firing half, and coming down only over the target's half. Ships fight at long range, so their fire takes a while to arrive (since 2026-11-09, at the developer's request). Naval shells (Battleship and Destroyer guns) leave along the barrel about 20° up, climb a short way and fade into the distance, then reappear well over a second later coming down at the same angle onto the target. A battleship's main guns are raised so every barrel looks 20° up on screen, all three turrets alike, so all three salvos fly the same way. Torpedoes run the whole way across, more slowly. Depth charges arc from the destroyer's stern and splash into the water in a pattern around the submarine, then sink for about a second before they go off. Ground fire at aircraft (Mobile AA, Flak Gun, or any other) climbs out of the top of its own half along the barrel and comes up into the other half from below, bursting under the aircraft. Bombs drop out of the bottom of their half and in at the top of the other.

**Landings.** A Landing Craft on a Beach is drawn run aground: sea toward the half's outer edge, sand toward the middle, the stern in the water and the bow ramp down on the sand.

**Nations.** Figures follow the map art (sections 12 and 17), with the details that tell the real equipment apart:

- **Soldiers.** US: the netted M1 helmet, canvas leggings, khaki web belt, a pack with a blanket roll and entrenching tool. Germany: the Stahlhelm, jackboots, Y-straps, the fluted gas-mask canister, a bread bag, and a stick grenade in the belt. Japan: the Type 90 helmet with its neck flaps, puttees, a small pack with the blanket rolled in a horseshoe over it, two leather cartridge boxes and a bayonet scabbard. Paratroopers carry the M1 carbine and a card suit on the helmet. Tank crews wear US tanker helmets, German headphones, or the Japanese padded tanker's helmet.
- **Japanese small arms:** riflemen carry the Arisaka with its long bayonet and work the bolt between shots; the squad leader has a Type 100 submachine gun, and the squad's automatic weapon is the Type 99 light machine gun, its curved magazine standing up out of the top. A Japanese squad, like a German one, has one submachine gun. Assault Infantry fire the Type 4 70mm rocket launcher from its bipod.
- **Japanese machines:** the Type 95 Ha-Go (bellcrank suspension in pairs, side muffler, small turret set to the left with a rear MG), the Type 97 Shinhoto Chi-Ha (riveted hull, long 47mm, the handrail antenna round the turret) and the Type 1 Ho-Ni I (an open three-sided shield round a 75mm) are their own 5° models. Japan's other machines take the German shapes their real counterparts resembled (the sidecar motorcycle, the open armored halftrack, the cross-platform AA gun, the shielded howitzer, the rocket launcher) with Japanese crews and khaki-toned coats. Japan has no Heavy Tank; the Chi-Ha stands in if one is ever drawn.
- **US vehicles** carry a white star: the Sherman (VVSS bogies, cast turret, .50 cal on the roof, spare track on the glacis), the Stuart (tall and narrow, a trailing idler, a 37mm in its recoil sleeve), the Churchill (track up the hull sides, escape doors), the M10 (open turret with counterweights), the Willys jeep (flat hood and fenders, upright windshield, spare wheel, whip antenna), the M3 halftrack (winch roller, armored windshield shutter), the M16 (Maxson quad .50s with ammunition chests), the M2A1 105mm and the 90mm AA gun, and the Calliope.
- **German vehicles** carry camouflage and no insignia: the Panzer IV (skirts, eight small road wheels, cupola, long 75 with a muzzle brake, spare road wheels), the Panzer II, the Tiger (Zimmerit, interleaved wheels, smoke dischargers, the 88), the StuG III (low casemate, rounded mantlet, MG shield), the motorcycle with sidecar and its rider in a long coat, the Sd.Kfz. 251, the Flakvierling behind its shield, the leFH 18, the 88 with its shield, and the Nebelwerfer.
- **Aircraft**: Allied aircraft carry D-Day invasion stripes; the P-51 its exhaust stacks and belly scoop, the Bf 109 its supercharger intake and wing radiators. The Zero has its long glazed canopy and round radial cowling, the G4M its cigar fuselage with glazed nose and tail cone; Japanese aircraft carry the hinomaru. Ships: see "Ships are 3D models too" below.
- Other Allied nations use the US look until they get their own.

**Colors.** Uniforms and hulls are the team color toned toward olive (Allies), field grey (Germany) or khaki (Japan, `battleKhaki`), so soldiers still read as soldiers. The hinomaru's red is `battleSun`. Every other color comes from the art pack: the `battle…` colors in `src/game/artPack.ts` (sky, grass, sea, steel, skin, wood, flash, fire, smoke and so on), which a pack can override like any other color.

**Tanks and tank destroyers are seen turned 5° toward the viewer** (since 2026-11-08; the developer compared 5°, 10°, 15°, 20° and 47° samples and chose 5°). The view stays almost side-on, but the turret roof, hatches, the top of the hull and a sliver of the front show, so a cast Sherman turret reads round and a Tiger's reads as a slab. The camera also looks down about 24°. They're 3D models built from boxes, sloped plates, cylinders and wheels (`src/game/battle/angled/`), lit from the upper left, painted back to front as crisp pixel polygons with inked edges, markings drawn on top, and outlined like every figure. On the right half the picture is mirrored, as for every figure. Models: US M5 Stuart, M4 Sherman, Churchill and M10; German Panzer II, Panzer IV, Tiger I and StuG III; Japanese Type 95 Ha-Go, Type 97 Shinhoto Chi-Ha and Type 1 Ho-Ni I. Samples: `docs/art/angled/`; `?battle=demo&angled=on&deg=10` shows them at any angle.

**Since 2026-11-08 every other land machine is drawn the same way** (at the developer's request): Recon (US Willys jeep with a pedestal .30 cal; German R75 motorcycle with the sidecar on the near side and an MG 34 on its nose), Halftrack (M3 with a .50 on the ring mount; Sd.Kfz. 251 with angled plates and an MG 34 behind its shield, the squad's helmets showing over the side), Mobile AA (M16 with the Maxson quad .50s; a Sd.Kfz. 251 carrying the Flakvierling's four 20mm guns behind their shield, all four in a 2-by-2 block that tilts up at aircraft), Flak Gun (90mm and 88mm on the cross-shaped platform), Artillery (M2A1 105mm and leFH 18, the split trail opened out, shield wings swept back), Rocket Artillery (T34 Calliope: the Sherman model with the 60-tube rack, tube ends on the front and sides; Nebelwerfer 41: six barrels in a ring) and the bunker (sloped concrete walls, roof netting, the gun in an embrasure on the front wall). Guns are raised to their firing angle in 3D, so each round leaves along its barrel. Crews stay sprites: a model is split into parts drawn behind and in front of its crew, so a jeep's tub hides its gunner's legs and a sidecar hides its gunner's. Foot soldiers stay side-on. `?battle=demo&angled=on&sample=machines` shows every machine at rest.

**Ships are 3D models too** (since 2026-11-09, at the developer's request), turned 5° and lit like the land machines, one ship per unit. The US Battleship is an Iowa-class battleship (it was the USS Texas): a long narrow hull with a clipper bow and sheer forward, three triple 16-inch turrets (two forward, the second superfiring, the aft one swung out toward the enemy), the tower bridge round the conning tower with a main-battery director on top, two tall stacks with a mast between them, five twin 5-inch mounts a side, 40mm quads, and two catapults with a floatplane and a crane on the fantail, in two-tone Measure 22 (dark hull below the lowest deck line, lighter above). The other ships: US Fletcher (five single 5-inch gunhouses, Mk 37 director, two raked stacks with black caps, quintuple torpedo mounts, depth-charge racks), Gato (round pressure hull mostly under water, deck casing with limber holes, periscope shears, 20mm platforms, deck gun), an LCT carrying two Shermans and their crews behind its side walls, and an Elco PT boat (twin .50 tubs, four torpedo tubes, radar dome). Germany: a 1936A Zerstörer (high Atlantic bow, twin 15cm turret forward, tripod mast, capped funnels, splinter camouflage, mine rails), a Type VII (saddle tanks, the "winter garden" flak platform, 88mm deck gun, net cutter), an S-boot (torpedo tubes opening at the bow, rounded armored bridge, mottled), and a landing craft on the LCT hull carrying Panzer IVs. Japan: the Yamato (deep flared bow, the deck stepping down to the quarterdeck, three triple 46cm turrets, a 15.5cm turret superfiring over the second, the tall stepped tower with its 15m rangefinder, one big raked funnel, the tripod mainmast, twin 12.7cm mounts, the aircraft deck), a Kagero (raised forecastle, enclosed twin turrets, tall layered bridge, raked funnels, shielded torpedo mounts), a B1-type I-boat (aircraft hangar forward of the tower, catapult to the bow), a Daihatsu carrying a Ha-Go, and a small torpedo boat with torpedoes on side racks. Ships carry no insignia. Superstructures, turrets and mounts are a lighter shade of the team color than the hull, so they stand out. Main guns are raised about 20° and recoil salvo by salvo; a destroyer's forward guns fire in turn; a torpedo slides out of its tube before it drops.

**Ships are always under way.** Along the near side of every ship afloat, the sea rises over the foot of the hull in waves that run from bow to stern, flecked with foam streaming aft; a bow wave piles up against the stem and throws spray, and a churned wake trails the stern. The ship bobs on the swell while the waves keep the water level, so the waterline moves. A ship going down still sits in the water but the waves stop running past it. A Landing Craft run aground has only the water lapping round its stern. Faster ships run faster water: the PT boat's waves race past and its bow wave is biggest. `?battle=demo&a=destroyer&d=submarine&sub=on` shows a submerged submarine.

**How it's built.** The figures are drawn in code, not from sprite sheets: `src/game/battle/`. Each unit is a *rig*, a function that draws it at any moment of its animation from simple shapes (rectangles, lines, discs, polygons) on a 384×240 canvas, which is scaled up with nearest-neighbor so it stays pixel art. Figures get a dark outline. `plan.ts` and `timeline.ts` decide what happens when, and are tested; `soldiers.ts`, `vehicles.ts`, `airNaval.ts` (aircraft) and `ships.ts` hold the rigs; `backdrops.ts` the backgrounds; `renderer.ts` puts a frame together. Sprite-sheet battle art in packs can replace rigs unit by unit later (00-master-design §13); nothing in the pack format covers it yet.

**Option.** "Battle scenes" on the map select screen, on by default. `?battle=off` turns them off. Off, attacks play on the map as before. The same option covers captures and bunkers (section 19).

**Preview.** `?battle=demo` plays a battle for every unit in turn; `&a=mortar&d=infantry` plays one matchup, and `&at=…&dt=…` sets each side's terrain. `&t=fire` holds every matchup at its first shot, side by side, and `&zoom=x,y,w,h` enlarges a part of each. `&axis=japan` puts Japan in Germany's place (11-tech-setup §7).

**Not done yet:** separate art for UK, Canadian and Soviet units; sound; a faster speed setting; pack-supplied battle sprites.

## 19. Storming scenes: captures and bunkers

**Since 2026-11-08,** two non-combat moments play as cut-in scenes, in the same style as battle scenes (section 18) and under the same "Battle scenes" option: an Infantry or Assault Infantry unit capturing a property, and foot soldiers going into a bunker. Like battle scenes they only show what the engine decided, can be skipped the same way, and fall back to the map's floating labels when scenes are off. No other non-combat action gets a scene (decided 2026-11-08).

**Layout.** One full-width view: open fields on the left, the building on the right, a track to its door. The top panel names the unit and the property; the bottom panel shows the capture count (20 pips in the old owner's color) or, for a bunker, the unit's HP.

**The buildings,** drawn large:

| Property | Look | Way in |
|---|---|---|
| City | A Normandy town: rooftops and a church spire behind, and on a cobbled square the mairie with its clock, a half-timbered house, and a café with a striped awning and tables | The mairie's arched door |
| HQ | A chateau with dormers and two round towers with conical roofs | Double door under a pediment |
| Factory | Brick hall with a sawtooth roof of skylights, a banded chimney trailing smoke | Sliding door rolled half open |
| Airfield | Curved-roof hangar with a control cabin, a tail fin in the dark interior; the runway in front, with its centre line, threshold bars and edge lights, and a windsock | Across the runway, through the open hangar doors |
| Port | Quayside warehouse with a loading hoist and a crane | Wooden warehouse door |
| Bunker | Concrete casemate with camouflage netting and sandbags | Steel door in its side |

**Capturing.** The squad runs in from the left in lanes, one soldier at a time, and goes through the door; the count drops as each one gets inside, ending on the engine's number. For Infantry, the two front soldiers first kneel and fire at the windows (muzzle flashes, tracers, breaking glass) while the rest run past, then follow them in. One figure per soldier, as in battle scenes (an Infantry squad at 10 HP is 8 runners); Mortar and launcher teams show both men of each team. Riflemen carry their weapon at port arms, launcher gunners the tube on the shoulder, mortar crews the tube and the baseplate. When everyone is inside:
- **A capture that completes:** the old owner's flag comes down (none for a neutral property), the captor's goes all the way up, and "CAPTURED" appears.
- **A capture still in progress:** the old flag stays at the top, the captor's goes part of the way up below it, as far as the points taken (halfway at 10 left), and the scene shows how many points are left, such as "10 LEFT".

**Follow-up turns.** Only the first turn of a capture storms the building. On later turns the squad already holds it: one soldier hauls the captor's flag up the pole hand over hand while two stand guard, from where it was to where the new count puts it, and the count drops as it rises. When it reaches the top the old flag comes down and the guards raise their rifles.

Capture flags fly from a tall flagpole on the square in front of the building, drawn at twice the size of the bunker's, so the flags read clearly.

**Going into a bunker** plays when Infantry, Assault Infantry or a Mortar Team moves onto a bunker or is unloaded onto one. Nothing plays for a unit already inside, for one that only stops there to board a transport, or for vehicles. The soldiers run in through the steel door; the firing slit is boarded up in their color, rifle barrels poke out, their flag goes up on the roof (the garrisoned look, section 15), and "GARRISONED" appears.

**Flags** are the nations' HUD flags (`src/game/placeholderFlags.ts`), with a streamer in the player's color underneath so two players of one nation can be told apart.

**How it's built.** `src/game/battle/storm.ts` plans the scene from the engine's event and the state before it, and times it; it's pure and tested (`tests/storm.test.ts`). `stormRenderer.ts` draws it. The same Phaser scene that plays battles plays these.

**Preview.** `?battle=demo&storm=all` plays every storming scene in turn (`storm=capture` or `storm=garrison` for one kind); `&t=end` shows each at its outcome, side by side.

## 20. Airborne drops

**Since 2026-11-08,** a Transport Aircraft unloading soldiers (05-supply-transport §6) plays as a static-line jump, under the same "Battle scenes" option and skip keys. One scene per passenger dropped.

- **The plane** (the C-47 with invasion stripes, or the Ju 52) flies across the sky from left to right with its door open.
- **The jump:** as the door passes over the drop zone the men go out one after another, one figure per soldier as in section 19 (a full Infantry squad is 8 men). Each falls a moment in the slipstream while his static line pays out from the door, then his canopy snaps open from a streamer into a full dome on its rigging lines.
- **The descent:** they drift down and back, swaying under their canopies, hands up on the risers, a reserve chute on the chest and a leg bag.
- **Landing:** each hits the ground in a roll, his chute collapsing beside him, then stands with his weapon ready. "LANDED" appears once the last man is down.
- **Who jumps:** US Infantry jump as 101st Airborne paratroopers (section 18), as the map shows them once they've landed. German soldiers jump in their own uniforms from the Ju 52. Mortar and launcher teams jump too.
- **The ground** is the terrain of the tile they land on.

`src/game/battle/drop.ts` plans and times it (tested in `tests/storm.test.ts`); `dropRenderer.ts` draws it. Preview: `?battle=demo&drop=on`, with `&t=end` for the landed squads.


## 21. Winter art

**Since 2026-11-08,** a scenario whose weather says `"season": "winter"` (12-weather §6) is drawn in snow from start to finish, even after the skies clear. Only drawing reads the season.

- **Map tiles:** the pack's terrain and building sheets can each name a `winterPath`, a second sheet with **the same layout**, so every tile number works for both. A winter map draws from the winter sheets; a pack without them draws its summer sheets.
- **The default pack's winter terrain** (`tools/art/terrain32-winter.mjs`, rendered by `npm run art` to `terrain-32-winter.png`): snow for grass, with blue shadows instead of green; packed, dirty snow on the roads with muddy ruts; cold dark water with ice at the banks; hedges dusted with snow. Forests are redrawn as **snow-laden firs**, as in the Ardennes, and hills as snowy ridges with dark rock showing on the steep, shaded side and a few small firs.
- **Winter buildings** (`buildings-32-winter.png`) are the summer buildings standing on snow. Roofs keep the owner's color, so ownership still reads at a glance.
- **Battle scenes on a winter map** swap the ground, dirt, road, hill and tree colors for winter ones (`battleSnow…` and `battleWinterTree…` in the pack's colors). While it **snows**, the sky is overcast grey and snow drifts down over the whole scene; under clear skies the sky is blue over the snow.
- **Snowfall over the map** while it snows: light flakes drift down over the visible part of the map, under the cursor and menus. Color `snowfall`.
