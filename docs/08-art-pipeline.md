# Topic Doc 08: Art Assets and Pipeline

**Status:** Asset list complete. US and German land unit sprites are approved and drawn in the game (section 12), terrain, buildings and fortifications are drawn in the game (sections 14–15), and art can be swapped with art packs (section 13). Everything else is still open.
**Last updated:** 2026-11-06
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
- The split-screen battle cutscene (phase 3): terrain backgrounds, large battle sprites, and fire and impact effects.
- Phone layout (phase 3).

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

- **Sheet layout (Q13):** `public/assets/units/{nation}-land-{team}.png`, 32 pixels wide, with 2 frames across and one row per unit in section 4 order: IN, AI, MO, RC, HT, LT, MT, HV, TD, AR, RK, AA, FK. A nation with no art for a unit leaves that row empty, so the US HV row is blank. `{nation}` is a two-letter code: `us` or `de`.
- **Team colors:** only the 3 body colors change per team. Wheels, tracks, skin and the star stay the same. All team sheets are placeholders until Q4 is decided, including whether a red unit keeps a white US star. The blue and red sheets are used in the game; `us-land-olive.png` and `de-land-grey.png` show each nation's natural color and aren't used yet.
- **Naming:** Allies and Axis are the sides. Germany and German are the nation. Wehrmacht is only a description of equipment or uniforms, not a label.
- **German insignia (Q11):** the HUD shows a black Balkenkreuz on grey as Germany's flag. German sprites still carry no national insignia until the rest of Q11 is decided. Camouflage patches fill the space the US star takes, and the sides differ by silhouette.
- **Preview:** `docs/art/us-land-units.png` and `docs/art/de-land-units.png` show every unit.

**Art choices that differ from the rules (art only, stats don't change):**
- The US Recon is a Willys jeep, chosen because it can't be mistaken for a tank.
- The Halftrack shows a .50 cal, though the unit is unarmed in the rules (01-units).
- The US Rocket Artillery is the tracked T34 Calliope, though the unit moves on wheels in the rules.
- The German Recon is a Zündapp motorcycle with sidecar, chosen so it can't be mistaken for a tank or the jeep.
- The German Halftrack shows an MG 34, though the unit is unarmed in the rules.
- The German Rocket Artillery, a Nebelwerfer 41, is a towed launcher with no engine, though the unit moves on its own in the rules.

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

**Owner colors:** the sheet has one row per property and one column per owner: neutral, blue, red, green, gold. Neutral is weathered slate grey. A captured property switches column at once.

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

- **Source:** `tools/art/kit32.mjs` (shared shapes, helmets, rifles and running gear), `us-units32.mjs` and `de-units32.mjs`. Sprites are built from shapes, then outlined and lit from the top left automatically.
- **Wheels** on the jeep, sidecar and halftracks sit in wheel wells: the body wraps round their top half.
- **View:** you look down on the vehicle: the whole hull top, the turret from above, the near side as a band, and the near track along the bottom. The far track isn't drawn, so it doesn't read as straight top-down.
- **Sheets:** `public/assets/units/{nation}-land-32-{team}.png`, 64 pixels wide, 2 frames across, one row per unit in section 4 order. The US sheet adds four rows after the Flak Gun: the paratrooper with a spade, heart, diamond and club.
- **Previews:** `docs/art/us-land-units-32.png` and `docs/art/de-land-units-32.png`.

**Infantry** is the unit that matters most, so it's drawn to be unmistakable:

| Side | Helmet | Rifle |
|---|---|---|
| US | The M1: a rounded dome, widest at the rim, with chinstraps | M1 Garand: deep wooden stock, receiver with the clip on top, gas cylinder under the barrel |
| Germany | The Stahlhelm: a taller crown and a skirt flaring over the ears and neck | Kar98k: dark stock, bolt handle, long barrel |

**Paratroopers:** a US Infantry unit dropped by a Transport Aircraft is drawn as a 101st Airborne paratrooper: an M1 carbine instead of the Garand, and a card suit on the helmet, as the 101st's regiments marked theirs. It acts exactly like any other Infantry. The rules engine records that the unit was air-dropped (01-units §5); the art picks the suit from the unit's id, so each paratrooper keeps his suit all game. The suit is always white; only its shape changes. Only the US has this look.

In a pack, a sheet's `paratroopers` lists the rows for an air-dropped Infantry (13–16 on the US sheets); the game picks one by unit id.

- **Aircraft** (`tools/art/air-naval32.mjs`): seen from above and a little behind, the far wing short above the fuselage and the near wing larger below it. They bob and their propellers spin. US: P-51, B-26, C-47. Germany: Bf 109, Ju 88, and a Ju 52 with its ribbed skin.
- **Ships:** the deck from above, the hull side as a band, and foam at the bow and a wake that shift between frames. US: USS Texas, Fletcher, Gato, LCT, PT boat. Germany fields only a Z-class destroyer, a Type VII U-boat and an S-boot, so its Battleship and Landing Craft rows are empty (section 4: both are rare).
- **Air and naval sheets:** `public/assets/units/{nation}-air-32-{team}.png` (rows FT, BM, TA) and `{nation}-naval-32-{team}.png` (rows BB, DD, SS, LC, TB). Previews: `docs/art/us-air-naval-32.png` and `docs/art/de-air-naval-32.png`.
- **Terrain and buildings** (`tools/art/terrain32.mjs`, `buildings32.mjs`, `depth32.mjs`): tiles are 32 wide by 64 tall, the bottom 32 rows being the map cell and the top 32 room to rise. They use the same sheet layouts as sections 14–15, so tile numbers don't change. Grass has tufts and flowers, roads have wheel ruts, rivers have sandy banks, and buildings have stone courses and tiled roofs. Sheets: `public/assets/terrain/terrain-32.png` and `buildings-32.png`.
- **Pack fields:** terrain and building sheets take `tileWidth` (16 or 32). `tileHeight` is the width, or twice it for art that rises into the tile behind.

