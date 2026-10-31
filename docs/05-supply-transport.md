# Topic Doc 05: Supply and Transport

**Status:** Land rules (phase 1) decided as v0 and implemented, following the original game. Air and naval rules (phase 2) are decided as v0, to be built in phase 2: sections 5 to 9.
**Last updated:** 2026-10-31
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
- At 0 primary ammo, the unit uses its secondary weapon against targets the damage chart gives a secondary value for (03-combat §2, §5); it can't attack or counter anything else.

## 3. Resupply

A resupply restores fuel and ammo to maximum. It's free and doesn't heal.

| Source | When | Who |
|---|---|---|
| Owned property of the right category | Owner's turn start (with repair; 04-economy section 5) | The unit on the tile |
| Halftrack, automatic | Owner's turn start, after property repair | All friendly units orthogonally adjacent to the Halftrack |
| Halftrack, `Supply` action | After the Halftrack moves (or without moving) | All friendly units orthogonally adjacent; ends the Halftrack's action |

A carried passenger isn't resupplied by its transport.

The `Supply` action is only available when at least one adjacent friendly unit is short of fuel or ammo. Automatic supply also reaches units of an allied player on the same side.

## 4. Transport (land, phase 1)

**Halftrack:** capacity 1. Carries Infantry, Assault Infantry or Mortar Team.

- **Load:** a foot unit moves onto its own player's Halftrack with free space. This ends the foot unit's action.
- **Unload:** the Halftrack (moving first, or not) unloads its passenger onto an orthogonally adjacent tile the passenger could legally enter (terrain passable for its movement type, not occupied). This ends the Halftrack's action. The passenger **can't act** on the turn it's unloaded.
- A unit loaded this turn can be unloaded the same turn if the Halftrack hasn't acted yet (as in the original).
- **Passengers are destroyed with the transport.** They don't count as kills (03-combat section 6).
- Passengers use no fuel while carried and keep their HP, ammo, fuel and veterancy.
- A transport carrying units can't join or be joined (04-economy section 6).

## 5. Air units (phase 2)

- **Movement:** type `air`, cost 1 on every tile including sea. Fuel is spent as for any unit.
- **Stacking:** one unit per tile, of any category. An aircraft can't share a tile with a ground unit, and enemy units still block its path (02-terrain §5).
- **Daily fuel:** `fuelPerDay` at the start of the owner's turn (Fighter and Bomber 5, Transport Aircraft 4). At 0 fuel the aircraft crashes, even with no enemy near. A crash isn't a kill. No burn on day 1 **(D1)**.
- **Service:** owned airfields repair and resupply air units (04-economy §5). A Halftrack also resupplies an adjacent aircraft, since the rule covers all friendly units.
- **Defense:** air units always get 0 terrain stars (02-terrain §1).

## 6. Transport Aircraft (phase 2)

- **Capacity:** 2 foot units. It's unarmed and reusable.
- **Load:** foot units board only while the aircraft is on an owned airfield.
- **Drop:** after moving, the aircraft drops one or both passengers onto its own tile or orthogonally adjacent tiles. A tile qualifies if it's empty and the passenger could enter it. That rules out sea, but allows Hills, Bocage and River **(D2)**. There's no scatter or landing risk.
- Dropping both in one action is allowed **(D3)**. Dropped units can't act that turn, and the drop ends the aircraft's action.
- **Shot down:** passengers are lost with it and don't count as kills.

## 7. Naval units (phase 2)

- **Movement:** type `sea` covers Sea, Reef and Port. Landing Craft use `landingCraft`, which also allows Beach (02-terrain §3).
- **Daily fuel:** `fuelPerDay` at the start of the owner's turn. At 0 fuel the ship sinks. A sinking isn't a kill. No burn on day 1 **(D1)**.
- **Service:** owned ports repair and resupply naval units. Halftracks resupply adjacent ships as well.
- **Capture:** ships can't capture. Ports are captured by infantry like any property.

## 8. Landing Craft (phase 2)

- **Capacity:** 2 land units of any type. Unarmed.
- **Load and unload only on a Beach tile or an owned or neutral Port.** The craft itself must stand on that tile. Being on a Sea tile next to a beach isn't enough, as in the original. So a landing means driving the craft onto the beach, where it's exposed.
- **Load:** a land unit moves onto the craft while it's on such a tile.
- **Unload:** after moving, the craft unloads one or both passengers onto orthogonally adjacent tiles they could enter **(D3)**. Unloaded units can't act that turn.
- A transport carrying units can't itself board another transport **(D4)**.

## 9. Submarines (phase 2)

- **`Dive` and `Surface`** are end actions, so a submarine can move and then change state. It starts surfaced.
- **Submerged:** burns 5 fuel per day instead of 1, and can only be attacked by Destroyers and Submarines (03-combat §5c). It can still attack, and stays submerged when it does.
- **Hidden or not:** in the original a submerged submarine is hidden unless an enemy is adjacent. We have no fog of war and both players share one screen, so submerged submarines are shown to everyone with a marker **(D5)**.

## 10. Open questions

- Should passenger fuel or ammo top up when a transport sits on a property? Working answer: no.

The decisions marked **D1 to D5** in this doc are recorded in 11-tech-setup §6.
