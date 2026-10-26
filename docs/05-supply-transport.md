# Topic Doc 05: Supply and Transport

**Status:** Land rules (phase 1) decided as v0, following the original game. Air and naval rules (phase 2) sketched; details to be confirmed when phase 2 starts.
**Last updated:** 2026-10-24
**Depends on:** 00-master-design.md, 01-units.md, 02-terrain.md, 04-economy-production.md.

---

## 1. Fuel

- Each unit has `maxFuel` (01-units section 8).
- **Moving costs fuel equal to the movement cost spent** (02-terrain), not the number of tiles.
- A unit can't plan a path costing more than its remaining fuel.
- **Land units** use no fuel per day. A land unit with 0 fuel can't move but can still attack (if it has ammo or a secondary weapon), capture and be resupplied.
- **Air and naval units (phase 2)** also burn `fuelPerDay` at the start of their owner's turn. A submerged submarine burns 5 per day instead of 1. An air or naval unit that reaches 0 fuel at turn start is destroyed (crashes or sinks). This isn't a kill for veterancy.

## 2. Ammo

- Primary weapons spend 1 ammo per attack or counterattack (03-combat section 2). Secondary weapons are unlimited.
- At 0 primary ammo, the unit falls back to its secondary weapon if it has one; otherwise it can't attack or counter.

## 3. Resupply

A resupply restores fuel and ammo to maximum. It's free and doesn't heal.

| Source | When | Who |
|---|---|---|
| Owned property of the right category | Owner's turn start (with repair; 04-economy section 5) | The unit on the tile |
| Halftrack, automatic | Owner's turn start, after property repair | All friendly units orthogonally adjacent to the Halftrack |
| Halftrack, `Supply` action | After the Halftrack moves (or without moving) | All friendly units orthogonally adjacent; ends the Halftrack's action |

A carried passenger isn't resupplied by its transport.

## 4. Transport (land, phase 1)

**Halftrack:** capacity 1. Carries Infantry, Assault Infantry or Mortar Team.

- **Load:** a foot unit moves onto a friendly Halftrack with free space. This ends the foot unit's action.
- **Unload:** the Halftrack (moving first, or not) unloads its passenger onto an orthogonally adjacent tile the passenger could legally enter (terrain passable for its movement type, not occupied). This ends the Halftrack's action. The passenger **can't act** on the turn it's unloaded.
- A unit loaded this turn can be unloaded the same turn if the Halftrack hasn't acted yet (as in the original).
- **Passengers are destroyed with the transport.** They don't count as kills (03-combat section 6).
- Passengers use no fuel while carried and keep their HP, ammo, fuel and veterancy.
- A transport carrying units can't join or be joined (04-economy section 6).

## 5. Air and naval (phase 2 sketch)

To be confirmed at phase 2. Following 01-units and the original:

- **Transport Aircraft:** capacity 2 foot units. Loads only at an owned airfield. After moving, it **air-drops** passengers onto its own tile (if land) or adjacent land tiles that are empty. Dropped units can't act on the landing turn. It's reusable.
- **Landing Craft:** capacity 2 land units of any type. Loads on a port or beach. Unloads onto an adjacent Beach tile or (from a Port) an adjacent land tile. It can't unload onto other coastal land.
- **Submarine dive:** `Dive` / `Surface` actions. While submerged it is hidden from enemy targeting except by adjacent Destroyers and Submarines, and burns 5 fuel per day.
- **Destroyer** has no supply role (the original's cruiser didn't either, apart from refuelling copters, which don't exist here).
- Airfields and ports repair and resupply their own categories (04-economy section 1).

## 6. Open questions

- Phase 2 specifics: can Transport Aircraft drop onto Bocage or Hills? Can Landing Craft use a Port to load heavy units only?
- Should passenger fuel or ammo top up when a transport sits on a property?
- Air drop deviation or risk (historically drops scattered): probably not, but undecided.
