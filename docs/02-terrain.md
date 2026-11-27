# Topic Doc 02: Terrain

**Status:** v0 decided. Values follow the original game (default rule) except where marked **(new)**. Expect tuning after playtesting.
**Last updated:** 2026-11-19 (§4c Railway and the `rail` movement type)
**Depends on:** 00-master-design.md, 01-units.md, 03-combat.md. **Feeds:** 04-economy-production (properties), 05-supply-transport (unloading, beaches), map making.

---

## 1. Principles

1. Terrain has two jobs: **movement cost** (per movement type) and **defense stars** (used in the damage formula, 03-combat section 1).
2. All terrain values live in data files and pass through the modifier layer (weather: 12-weather; COs later).
3. Air units always get 0 defense stars, whatever the terrain under them.
4. Names are generic and WW2-flavored, not copied from the original.

## 2. Movement types

| Movement type | Original equivalent | Used by |
|---|---|---|
| `foot` | Infantry | Infantry |
| `heavyFoot` | Mech | Assault Infantry, Mortar Team |
| `wheels` | Tires | Recon, Supply Truck, Rocket Artillery |
| `tracks` | Treads | Halftrack, all tanks, Tank Destroyer, Artillery, Mobile AA, Flak Gun |
| `air` | Air | All air units (phase 2) |
| `sea` | Ship | Battleship, Destroyer, Submarine, Torpedo Boat, Carrier, Supply Ship (phase 2) |
| `landingCraft` | Transport (Lander) | Landing Craft (phase 2) |
| `rail` **(new)** | — | Railway Gun (scenario only). Enters Railway squares only (§4c) |

## 3. Terrain table (v0)

Movement cost is movement points spent to **enter** the tile. `—` = impassable.

| Terrain | Stars | foot | heavyFoot | wheels | tracks | air | sea | landingCraft | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Plains | 1 | 1 | 1 | 2 | 1 | 1 | — | — | |
| Road | 0 | 1 | 1 | 1 | 1 | 1 | — | — | |
| Bridge | 0 | 1 | 1 | 1 | 1 | 1 | — | — | Over river; same as road |
| Forest | 2 | 1 | 1 | 3 | 2 | 1 | — | — | Hides units in fog of war (19-fog-of-war §3) |
| Hills | 4 | 2 | 1 | — | — | 1 | — | — | Original's mountains, renamed for WW2 Europe. Foot soldiers here get +3 vision (19-fog-of-war §2) |
| River | 0 | 2 | 1 | — | — | 1 | — | — | |
| Bocage **(new)** | 3 | 1 | 1 | — | 3 | 1 | — | — | Hedgerow country. Great cover, blocks wheels, slows tracks. Hides units in fog of war |
| Sea | 0 | — | — | — | — | 1 | 1 | 1 | |
| Beach | 0 | 1 | 1 | 1 | 1 | 1 | — | 1 | Original's shoal. Landing Craft must stand here, or on a Port, to load or unload (05-supply-transport §8) |
| Reef | 1 | — | — | — | — | 1 | 2 | 2 | Hides ships in fog of war |
| City | 3 | 1 | 1 | 1 | 1 | 1 | — | — | Property |
| Factory | 3 | 1 | 1 | 1 | 1 | 1 | — | — | Property; builds land units |
| Airfield | 3 | 1 | 1 | 1 | 1 | 1 | — | — | Property; builds air units (phase 2) |
| Port | 3 | 1 | 1 | 1 | 1 | 1 | 1 | 1 | Property; builds naval units (phase 2) |
| HQ | 4 | 1 | 1 | 1 | 1 | 1 | — | — | Property; capturing it wins (04-economy) |

**Bocage** is the one new terrain in MVP. It exists for the Normandy-flavored test map and has no original equivalent. Infantry are strongest there; tanks crawl and wheeled units can't enter. (Historically, tanks needed hedge cutters to cross; a later CO or doctrine modifier could represent that.)

## 4. Fortifications and obstacles

Fortifications and obstacles are terrain objects with HP, similar to the original's breakable pipe seams. Combat rules for attacking them are in 03-combat section 4.

| Terrain | Stars | foot | heavyFoot | wheels | tracks | air | HP (internal) | Becomes at 0 HP |
|---|---|---|---|---|---|---|---|---|
| Bunker **(new)** | 5 | 1 | 1 | 1 | 1 | 1 | 100 | Rubble |
| Rubble **(new)** | 1 | 1 | 1 | 2 | 1 | 1 | — | — |
| Obstacle **(new)** | 0 | — | — | — | — | 1 | 100 | Plains (or Beach for a beach obstacle) |

- **Bunker:** occupiable. It has the highest defense in the game (5 stars, one more than HQ) but only matters when a unit sits in it. It can be attacked only when empty (03-combat section 4), except that foot soldiers inside are a garrison: attacks on them hit the bunker, and they die with it when it breaks (03-combat section 4, since 2026-11-14).
- **Rubble:** a destroyed bunker, gone for good: it can't be rebuilt, repaired or garrisoned. 1 defense star, like plains. Slightly worse than plains for wheels.
- **Obstacle:** anti-tank obstacles, dragon's teeth, beach obstacles. Impassable to all land units, like a pipe seam. It doesn't block attacks or line of fire (there is no line of fire in this game). Air units fly over it.
- **Damage to fortifications** comes from the `Fort` column of the damage chart (03-combat section 5b). Assault Infantry is the best ground unit against them.
- Phase 1 includes Bunker, Rubble and Obstacle on land. Beach obstacles arrive with naval units in phase 2.

## 4a. Major bridges: blowing and rebuilding **(new)** (decided and built 2026-11-15)

Decided at the developer's request for Market Garden (17-scenarios-market-garden). The original game has no bridges that can be destroyed. This is a **new, separate terrain type**. Ordinary **Bridge** tiles are not changed and can never be blown: every existing map keeps its bridges exactly as they are. A map maker uses Major Bridge only where blowing a bridge is part of the battle.

| Terrain | Stars | foot | heavyFoot | wheels | tracks | air | sea | landingCraft | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Major Bridge | 0 | 1 | 1 | 1 | 1 | 1 | — | — | Moves like Bridge. Can be blown |
| Blown Bridge | 0 | 2 | 1 | — | — | 1 | — | — | Moves like River. Can be rebuilt |

- **Blow Bridge** is an action for **Assault Infantry** (sappers, Pioniere) that ends its move on a Major Bridge. The tile becomes a Blown Bridge at once. The unit stays where it is (heavy foot can stand on a Blown Bridge) and its action ends. It uses no ammo. Either side can blow any Major Bridge: a defender can blow one to stop an attack, and an attacker can blow one to cover a flank.
- **Only Assault Infantry can do it.** Plain Infantry has no demolition charges. This is the one exception to 01-units §6 ("no special engineering action"). There, engineering is otherwise expressed through the damage chart.
- **A Major Bridge can't be damaged by fire.** It has no HP and isn't in the damage chart, so artillery, bombers and battleships can't knock it down. It is only ever blown from the spot. Historically big road bridges very rarely fell to shelling or bombing, and a bridge that could be shot down from across the river would leave no crossing standing.
- **Rebuild Bridge** is an action for Assault Infantry standing on a Blown Bridge, and it works like capture (04-economy §3). Each time, the unit adds its displayed HP to the tile's rebuild progress. At **20** the tile becomes a Major Bridge again, so a full-strength unit needs two turns. That stands for a Bailey bridge, which took Royal Engineers about 12 hours at Son. Progress is lost if the unit moves off, is loaded or is destroyed, as with capture. Either side can rebuild. A rebuilt bridge can be blown again.
- **Blown Bridge** is its own terrain, not River, so the map remembers there was a bridge there. It gets its own wreck art (fallen spans in the river), and tile info says it can be rebuilt. For movement, defense and weather (12-weather §3) it counts as River.
- **Tile info** on a Major Bridge says "Can be blown by Assault Infantry". On a Blown Bridge it says "Can be rebuilt by Assault Infantry" and shows the rebuild progress, as capture progress is shown.
- **Events:** blowing plays an explosion on the tile with a sound, and a finished rebuild plays a short build cue (16-sound). Neither counts as a kill.
- **Modifier layer:** both terrains' movement costs and stars go through the modifier layer like every other terrain (§1).
- **As built:** in scenario map text a Major Bridge is `%` and a Blown Bridge `!`. Rebuild progress is kept in the game state (`bridgeWorks`) and saved with the game. The action menu says BLOW BRIDGE and REBUILD. Art packs can give `majorBridges` and `blownBridges` tiles (08-art-pipeline §13); a pack without them draws a Major Bridge with the plain Bridge deck and a Blown Bridge as bare river.

## 4b. Desert terrain: Minefield, Ridge and Salt Marsh **(new)** (decided and built 2026-11-15)

Decided at the developer's request for El Alamein (18-scenarios-north-africa). The original game has no desert terrain. Open desert is ordinary **Plains** drawn with the desert season's art (08-art-pipeline §21), since most of the Western Desert was firm "good going". Three new terrains cover what Plains and Hills can't. No existing map uses them, so no existing map changes.

| Terrain | Stars | foot | heavyFoot | wheels | tracks | air | sea | landingCraft | HP (internal) | Becomes at 0 HP |
|---|---|---|---|---|---|---|---|---|---|---|
| Minefield | 0 | — | — | — | — | 1 | — | — | 100 | Plains |
| Ridge | 2 | 1 | 1 | 3 | 2 | 1 | — | — | | |
| Salt Marsh | 0 | — | — | — | — | 1 | — | — | | |

- **Minefield** has exactly the **Obstacle's** rules (§4), following the original's breakable pipe seams: impassable to land units, attacked like any fortification through the damage chart's `Fort` column (03-combat §4), and cleared to Plains at 0 HP. Clearing one isn't a kill. Assault Infantry (65 vs. `Fort`) clears a square in two attacks, Artillery (50) in two. It's a separate terrain from Obstacle only so it has its own name and art. A minefield you can enter and take damage from was considered and left out: the original has nothing like it.
- **Ridge** has **Forest's** numbers: a low desert ridge (Miteiriya, Ruweisat) that tanks could cross and use for hull-down cover, unlike Hills, which block vehicles. In snow it costs what Forest costs (12-weather §3).
- **Salt Marsh** is impassable to every land unit, like Sea, but isn't water, so ships can't enter it either. It's the Qattara Depression, which closed the south end of the El Alamein line.
- **Modifier layer:** all three go through the modifier layer like every other terrain (§1).
- **As built (2026-11-15):** in scenario map text a Minefield is `m`, a Ridge `d` and Salt Marsh `z`. Art packs give them tiles under `minefield`, `ridge` and `saltMarsh` (08-art-pipeline §21); the AI already plans its routes as if a breakable obstacle were gone, so it attacks minefields with no new rule.

## 4c. Railway and rail movement **(new)** (decided 2026-11-19)

Decided at the developer's request for Sevastopol (15-scenarios-eastern-front §3) and the Railway Gun (01-units §2b). The original game has nothing like it.

| Terrain | Stars | foot | heavyFoot | wheels | tracks | air | sea | landingCraft | rail |
|---|---|---|---|---|---|---|---|---|---|
| Railway | 0 | 1 | 1 | 1 | 1 | 1 | — | — | 1 |

- **Railway** is a railway line. For every other unit it's exactly a **Road**: the trackbed is firm, open ground. Where a line crosses a river, the Railway square is its bridge, and everyone crosses there as on a road bridge. A line can't be blown or cut (yet).
- **`rail` is a new movement type**, used only by the Railway Gun. It can enter **Railway squares and nothing else**: every other terrain is impassable to it, properties included. So a map maker decides exactly where a railway gun can go by where the track runs.
- **Weather doesn't change rail costs**: a train runs in snow and rain (12-weather §3 has no rail entries).
- **Modifier layer:** Railway's costs and stars go through the modifier layer like every other terrain (§1).
- **As built:** in scenario map text a Railway is `R`. Art packs draw it as a ballasted track that joins up with neighboring Railway squares, as roads do (08-art-pipeline §14).

## 5. Movement rules

Following the original:

- A unit may move along any path whose total entry cost ≤ its move points, also limited by its remaining fuel.
- **Fuel cost** equals the movement cost spent (05-supply-transport).
- **Enemy units block** movement: a unit can't enter or pass through an enemy-occupied tile. **Except (new):** aircraft fly over enemy ground units and ships, so a ring of Infantry can't trap a plane. Enemy aircraft still block aircraft and ground units, as in the original.
- **Friendly units** can be passed through, but a unit can't end its move on a friendly unit unless it is loading into a transport or joining (04-economy, 05-supply-transport).
- A unit can always choose not to move (move 0) and still act.
- **One unit per tile, of any category.** An aircraft over a tile blocks a ground unit from ending there, and the reverse. Load and Join are the only exceptions (05-supply-transport §5).
- Movement is all-or-nothing within the turn: a unit moves once, then acts or waits. Running into an enemy hidden by fog of war is an ambush: the move stops short and the turn is over (19-fog-of-war §5).

## 6. Map edges and data

- Maps are rectangular grids of 16×16-pixel tiles.
- Each tile has exactly one terrain type. Properties additionally have an owner (a player or neutral) and capture progress (04-economy).
- Fortification and obstacle tiles store their current HP.
- Map files (from Tiled) reference terrain by `id`. The engine never reads tile art; art is chosen by the presentation layer, including auto-tiling (roads, rivers and coastlines picking connecting sprites).

## 7. Open questions

- Tuning: is Bocage 3 stars too strong? Is Bunker 5 stars right?
- Weather (snow, rain) changing movement costs: not discussed yet.
- Whether fortifications should exist in factory-built (non-historical) test maps at all, or only in scenarios.
- Coastal cliffs for Normandy (impassable to landing): phase 4.
