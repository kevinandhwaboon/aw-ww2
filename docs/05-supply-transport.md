# Topic Doc 05: Supply and Transport

**Status:** Land rules (phase 1) decided as v0 and implemented, following the original game. Air and naval rules (phase 2) are decided as v0 and implemented, sections 5 to 9 (milestones 9 to 11). Carriers (section 10) are decided and implemented (2026-11-09).
**Last updated:** 2026-11-10
**Depends on:** 00-master-design.md, 01-units.md, 02-terrain.md, 04-economy-production.md.

---

## 1. Fuel

- Each unit has `maxFuel` (01-units section 8).
- **Moving costs fuel equal to the movement cost spent** (02-terrain), not the number of tiles, **times the unit's `fuelPerMove`**: 1 for land units and ships, 2 for aircraft (decided 2026-11-10, at the developer's request: aircraft burn far more under way than loitering).
- A unit can't plan a path costing more fuel than it has left.
- **The daily burn comes on top of movement.** A Fighter (5 a day) that stays put burns 5; one that flies 6 tiles burns 5 + 2 × 6 = 17.
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
- **Stacking:** one unit per tile, of any category. An aircraft can't share a tile with a ground unit. It flies over enemy ground units and ships, but enemy aircraft block its path (02-terrain §5).
- **Daily fuel:** `fuelPerDay` at the start of the owner's turn (Fighter, Dive and Torpedo Bomber 5, Bomber 8, Transport Aircraft 3; 01-units §8a), on top of 2 fuel per tile flown (§1). At 0 fuel the aircraft crashes, even with no enemy near. A crash isn't a kill. No burn on day 1 **(D1)**, and none for a unit on a property that services it, since that refuels it anyway.
- **Service:** owned airfields repair and resupply air units (04-economy §5). A Halftrack also resupplies an adjacent aircraft, since the rule covers all friendly units.
- **Defense:** air units always get 0 terrain stars (02-terrain §1).

## 6. Transport Aircraft (phase 2)

- **Capacity:** 2 foot units. It's unarmed and reusable.
- **Load:** foot units board only while the aircraft is on an owned airfield.
- **Drop:** after moving, the aircraft drops one or both passengers onto orthogonally adjacent tiles. Not onto its own tile: the aircraft is still there, and one unit per tile holds for aircraft too (02-terrain §5). This was decided on 2026-11-07, when building milestone 11 showed the earlier wording broke that rule. A tile qualifies if it's empty and the passenger could enter it. That rules out sea, but allows Hills, Bocage and River **(D2)**. There's no scatter or landing risk.
- Dropping both in one action is allowed **(D3)**. Dropped units can't act that turn, and the drop ends the aircraft's action.
- **Shot down:** passengers are lost with it and don't count as kills.

## 7. Naval units (phase 2)

- **Movement:** type `sea` covers Sea, Reef and Port. Landing Craft use `landingCraft`, which also allows Beach (02-terrain §3).
- **Daily fuel:** `fuelPerDay` at the start of the owner's turn. At 0 fuel the ship sinks. A sinking isn't a kill. No burn on day 1 **(D1)**, and none for a ship in an owned port.
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
- **Hidden (since 2026-11-14, D5):** as in the original, a submerged submarine is hidden from the other side unless one of that side's units, of any kind (aircraft too), is on a tile next to it (not diagonally). Its own side always sees it, drawn with a marker: the sprite is tinted, a wave badge sits in its top-left corner, and the tile info says "submerged" (08-art-pipeline §5). There's still no other fog of war; this is the one exception.
  - **On a shared screen** the map is drawn for the human whose turn it is (during the computer's turn, for the last human who played; with only computers playing, and once the game is over, everything shows). The enemy doesn't see a hidden submarine's moves, waits or repairs play out, and the cursor doesn't follow it. If it attacks or surfaces it appears where it ended its move.
  - **The computer** is shown the same: its view of the game leaves out the submarines it can't see (09-ai §3).
  - **Planning a move**, a hidden submarine isn't there: its tile counts as empty for move ranges and paths.
  - **Ambush:** a ship whose path runs into a hidden submarine's tile, or any unit (aircraft included) told to end its move there, stops on the last tile before it that it can stop on (an empty one, or where it started), burns fuel only for what it moved, and its turn is over: whatever it was told to do after the move doesn't happen. "AMBUSH!" shows over the submarine, which is now next to an enemy and so in view. Aircraft otherwise fly over it as over any ship. (The original's "trap".)
  - **Attacking:** a unit can only attack a submarine its player could see when giving the order. Since only Destroyers and Submarines can hit a submerged submarine, and only from next to it, this means one found by moving next to it can be attacked the following turn, not on the move that found it.
  - **Undo** is cleared when a hidden submarine comes into view, like after an attack.

## 10. Carriers (decided and built 2026-11-09)

- **Capacity:** 2 air units: Fighters, Dive Bombers or Torpedo Bombers (01-units §3). Bombers and Transport Aircraft can't board. Unarmed. (Bombers could board until 2026-11-09; that made Carriers too strong.)
- **Land (Load):** an aircraft moves onto its own player's Carrier with free space, wherever the Carrier is. This ends the aircraft's action. An aircraft that boarded this turn can't launch until next turn.
- **Move or launch, not both:** each turn a Carrier either moves or launches. Once it has moved it can't launch; once it has launched it can't move.
- **Launch:** an aircraft flies off from the Carrier's tile with its full movement and can attack that same turn, like any unit starting its turn there. Both aircraft can launch in the same turn, one after the other. A departure from the original, where carried aircraft were unloaded onto an adjacent tile and couldn't act that turn: the carrier's point was striking from beyond the enemy's reach.
- **Service at turn start:** aircraft on board burn no daily fuel, get full fuel and ammo free, and are repaired **1 displayed HP** for 10% of their cost, with the same affordability and order rules as property repair (04-economy §5). Land airfields still repair 2 HP, so they stay worth taking.
- **Sunk:** aircraft on board are lost with it and don't count as kills (§4). The Carrier itself burns fuel and sinks at 0 like any ship (§7).
- **Building:** at Ports, like other ships. A Carrier is built empty: its aircraft are built at airfields and flown aboard by the player.

## 11. Low fuel and ammo warnings (decided 2026-11-10)

Presentation only: no rule reads these. At the developer's request, a unit short of supplies shows a **flashing can** on the map, stacked up the left edge of its tile (above the capture C, if any):

- **Gas can** (a red jerrycan): fuel is empty, a quarter of a full tank or less, or, for aircraft and ships, two days' burn or less (they're lost at 0). Since 2026-11-14, at the developer's request (the warning came too late to get home), aircraft and ships also warn **as soon as one more full turn's move away from home would leave too little fuel to get back**: the fuel for a full move out plus the route back from that far (by the cheapest route over terrain, ignoring units), plus the daily burn for each night on the way. Home is the nearest owned property that refuels it (airfield, port) or, for carrier aircraft, one of the player's Carriers with room. A unit at home doesn't warn this way, and nor does one with no home it could reach anywhere on the map (Japan's port on Midway is cut off from the sea): for those only the simpler rules apply. So a Fighter a full 9 squares from its airfield already shows the can: it can still fly home, but not further out first.
- **Ammo can** (an olive can with brass rounds): a unit with a main weapon has used it up, or has a quarter or less left (rounded up). A unit that only ever holds 1 shot (the Torpedo Bomber) warns only once it's spent.

Both cans blink together, and the same numbers turn the fuel and ammo lines in the tile info box to the warning color, where they blink too. The rule is one function, `supplyWarnings` in `src/game/tileInfo.ts`.

**Seeing what's aboard.** With nothing selected, putting the cursor (or the mouse) on a transport with units aboard opens a small panel beside it showing each passenger's sprite, name and HP, with its own cans if it's short. The tile info box lists the same passengers with HP, fuel and ammo. This covers Landing Craft and Carriers, and Halftracks and Transport Aircraft too.

**Launching names the aircraft.** A Carrier's Launch item always says which aircraft it launches ("LAUNCH DIVE BOMBER"). Two different aircraft get one item each; two of a kind with different HP get one each with their HP; two identical ones share one item. While the aircraft is out on the Carrier's tile choosing where to go, a label over it says "LAUNCHING …" with its HP, fuel and ammo.

## 12. Open questions

- Should passenger fuel or ammo top up when a transport sits on a property? Working answer: no.

The decisions marked **D1 to D5** in this doc are recorded in 11-tech-setup §6.
