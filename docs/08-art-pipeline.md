# Topic Doc 08: Art Assets and Pipeline

**Status:** Asset list complete. US land unit sprites are approved and drawn in the game (section 12), and art can be swapped with art packs (section 13). Everything else is still open. Game mechanics are paused at milestone 10 while visuals are worked on.
**Last updated:** 2026-11-01
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

Each is 16×16 unless noted. Today every terrain is a single flat tile.

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

**Connected sets:** tiles that change shape based on their neighbors. A road needs roughly 16 pieces (straights, corners, T-junctions, crossing, ends). Coastlines need more if corners are smoothed, up to 47. The game doesn't choose connected tiles yet, so that code comes with this art.

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

Owned properties use team color, which today is a small flag in the tile's corner.

## 4. Units (map sprites)

21 types, 16×16. The two-letter code is what the placeholder shows today.

**Land**

| Code | Unit | Allied examples | Axis examples |
|---|---|---|---|
| IN | Infantry | GI, Tommy | Wehrmacht rifleman |
| AI | Assault Infantry | Bazooka team, assault engineers | Panzerschreck team, Pioniere |
| MO | Mortar Team | US/UK mortar team | Granatwerfer team |
| RC | Recon | Willys jeep, Daimler | Sd.Kfz. 234 |
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
| Submerged | Marker for submarines (milestone 10) |

## 6. Map UI (drawn in the game canvas)

| Item | Needs | Notes |
|---|---|---|
| Cursor | 1–2 frames | Tile outline today |
| Move range | Tile tint | Blue overlay today |
| Threat range | Tile tints | Orange for move, red for attack today |
| Path arrow | About 10 pieces | Straights, corners and 4 arrowheads |
| Action menu | Panel frame, pointer, highlight | FIRE, CAPTURE, LOAD, JOIN, UNLOAD, SUPPLY, WAIT, CANCEL |
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
- Pixel font: `src/game/pixelFont.ts`
- Drawing and effects: `src/game/MapScene.ts`
- HTML panels and screens: `src/ui/`
- Finished art: `public/assets/`
- Unit pixel grids and the script that renders them: `tools/art/`

## 12. Unit sprites as built

Answers so far to section 9. Questions not listed here are still open.

- **Method (Q1):** pixel grids written as data, rendered to PNG by `npm run art`. The grids are the source; don't hand-edit the PNGs.
- **Facing (Q7):** all units face right. Whether they flip by side is still open.
- **Animation (Q8):** every unit has 2 idle frames that alternate, so it looks alive while the game is idle. There are no separate movement frames. What moves depends on the unit:

| Unit | Idle animation |
|---|---|
| Vehicles | Hull bobs 1 pixel; treads or wheels shift |
| Infantry, Assault Infantry | Step in place |
| Mortar Team | Crew aims, then ducks |
| Artillery | Barrel recoils 1 pixel |
| Flak Gun | Barrel lifts 1 pixel |
| Mobile AA | Turret swings from forward to back |

- **Sheet layout (Q13):** `public/assets/units/{nation}-land-{team}.png`, 32 pixels wide, with 2 frames across and one row per unit in section 4 order: IN, AI, MO, RC, HT, LT, MT, HV, TD, AR, RK, AA, FK. A nation with no art for a unit leaves that row empty, so the US HV row is blank.
- **Team colors:** only the 3 body colors change per team. Wheels, tracks, skin and the star stay the same. The olive, blue and red sheets are placeholders until Q4 is decided, including whether a red unit keeps a white US star.
- **Preview:** `docs/art/us-land-units.png` shows every approved unit.

**Art choices that differ from the rules (art only, stats don't change):**
- The US Recon is a Willys jeep, chosen because it can't be mistaken for a tank.
- The Halftrack shows a .50 cal, though the unit is unarmed in the rules (01-units).
- The US Rocket Artillery is the tracked T34 Calliope, though the unit moves on wheels in the rules.

**Not done yet:** US air and naval units are first drafts in `tools/art/us-units.mjs`, not exported.

## 13. Art packs

All art, colors and display names come from an **art pack**, so the game's look can be swapped without touching code or rebuilding. Art never affects the rules.

**To make a pack:** create `public/assets/packs/{your-pack}/pack.json`, using lowercase letters, numbers and hyphens for the folder name, and open the game with `?pack=your-pack`. `public/assets/packs/night-ops/` is a small working example.

Only `name` is required. Anything else you leave out keeps the built-in look, so a pack can change one color or everything. A file that won't load, or a pack with a mistake in it, logs a warning in the browser console and the game carries on.

| Field | What it does |
|---|---|
| `name` | The pack's name |
| `players` | One entry per player: `team`, `fill` and `outline`. `team` picks that player's unit sheets |
| `colors` | Any of the color names in `src/game/artPack.ts`, as `"#rrggbb"`: panels, ranges, path arrow, menus, effects |
| `unitSheets` | Sprite sheets: `nation`, `team`, `path`, `frames` and `rows` |
| `terrain` | One sheet: `path`, and `tiles` giving a tile number per terrain. Tiles are numbered left to right, top to bottom |
| `unitNames` | Display names by unit id, such as `"mediumTank": "Sherman"` |
| `terrainNames` | Display names by terrain id |

**Unit sheets** use 16×16 frames, with one row per unit and idle frames running across. `rows` lists the unit on each row from the top, using `null` for an empty row. A sheet covers one nation and one team. A unit with no art for its nation and team keeps its placeholder, so German units never borrow American sprites.

**Paths** are relative to the pack's folder. Web addresses and absolute paths are refused.

**The default pack** (`public/assets/packs/default/`) is the game's normal look. It points at the sheets `npm run art` writes to `public/assets/units/`. If the art tool's row order changes, `rows` in the pack has to change with it.

**Not in packs yet:** the 3×5 map font, the HP and veterancy badges, property flags, and menu words like FIRE. They can follow as that art gets made.
