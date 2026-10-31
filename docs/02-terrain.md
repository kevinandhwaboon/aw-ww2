# Topic Doc 02: Terrain

**Status:** v0 decided. Values follow the original game (default rule) except where marked **(new)**. Expect tuning after playtesting.
**Last updated:** 2026-10-31
**Depends on:** 00-master-design.md, 01-units.md, 03-combat.md. **Feeds:** 04-economy-production (properties), 05-supply-transport (unloading, beaches), map making.

---

## 1. Principles

1. Terrain has two jobs: **movement cost** (per movement type) and **defense stars** (used in the damage formula, 03-combat section 1).
2. All terrain values live in data files and pass through the modifier layer (weather, COs later).
3. Air units always get 0 defense stars, whatever the terrain under them.
4. Names are generic and WW2-flavored, not copied from the original.

## 2. Movement types

| Movement type | Original equivalent | Used by |
|---|---|---|
| `foot` | Infantry | Infantry |
| `heavyFoot` | Mech | Assault Infantry, Mortar Team |
| `wheels` | Tires | Recon, Rocket Artillery |
| `tracks` | Treads | Halftrack, all tanks, Tank Destroyer, Artillery, Mobile AA, Flak Gun |
| `air` | Air | All air units (phase 2) |
| `sea` | Ship | Battleship, Destroyer, Submarine, Torpedo Boat (phase 2) |
| `landingCraft` | Transport (Lander) | Landing Craft (phase 2) |

## 3. Terrain table (v0)

Movement cost is movement points spent to **enter** the tile. `—` = impassable.

| Terrain | Stars | foot | heavyFoot | wheels | tracks | air | sea | landingCraft | Notes |
|---|---|---|---|---|---|---|---|---|---|
| Plains | 1 | 1 | 1 | 2 | 1 | 1 | — | — | |
| Road | 0 | 1 | 1 | 1 | 1 | 1 | — | — | |
| Bridge | 0 | 1 | 1 | 1 | 1 | 1 | — | — | Over river; same as road |
| Forest | 2 | 1 | 1 | 3 | 2 | 1 | — | — | |
| Hills | 4 | 2 | 1 | — | — | 1 | — | — | Original's mountains, renamed for WW2 Europe |
| River | 0 | 2 | 1 | — | — | 1 | — | — | |
| Bocage **(new)** | 3 | 1 | 1 | — | 3 | 1 | — | — | Hedgerow country. Great cover, blocks wheels, slows tracks |
| Sea | 0 | — | — | — | — | 1 | 1 | 1 | |
| Beach | 0 | 1 | 1 | 1 | 1 | 1 | — | 1 | Original's shoal. Landing Craft must stand here, or on a Port, to load or unload (05-supply-transport §8) |
| Reef | 1 | — | — | — | — | 1 | 2 | 2 | |
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

- **Bunker:** occupiable. It has the highest defense in the game (5 stars, one more than HQ) but only matters when a unit sits in it. It can be attacked only when empty (03-combat section 4).
- **Rubble:** a destroyed bunker. Plains-like, slightly worse for wheels.
- **Obstacle:** anti-tank obstacles, dragon's teeth, beach obstacles. Impassable to all land units, like a pipe seam. It doesn't block attacks or line of fire (there is no line of fire in this game). Air units fly over it.
- **Damage to fortifications** comes from the `Fort` column of the damage chart (03-combat section 5b). Assault Infantry is the best ground unit against them.
- Phase 1 includes Bunker, Rubble and Obstacle on land. Beach obstacles arrive with naval units in phase 2.

## 5. Movement rules

Following the original:

- A unit may move along any path whose total entry cost ≤ its move points, also limited by its remaining fuel.
- **Fuel cost** equals the movement cost spent (05-supply-transport).
- **Enemy units block** movement: a unit can't enter or pass through an enemy-occupied tile.
- **Friendly units** can be passed through, but a unit can't end its move on a friendly unit unless it is loading into a transport or joining (04-economy, 05-supply-transport).
- A unit can always choose not to move (move 0) and still act.
- **One unit per tile, of any category.** An aircraft over a tile blocks a ground unit from ending there, and the reverse. Load and Join are the only exceptions (05-supply-transport §5).
- Movement is all-or-nothing within the turn: a unit moves once, then acts or waits. (Fog-of-war ambush interruptions are not relevant while fog of war is out.)

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
