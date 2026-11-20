# Topic Doc 23: Survival

**Status:** v0 decided 2026-11-20, at the developer's request: the developer answered the six open choices (§10). Not built. Wave numbers are a first guess, to be tuned (§8).
**Last updated:** 2026-11-20
**Depends on:** 00-master-design.md (§8), 01-units.md, 04-economy-production.md (§8 victory conditions, §8a losses), 05-supply-transport.md, 09-ai.md (§4k map plans), 19-fog-of-war.md, 22-campaign.md (title screen, tuning by self-play). **Feeds:** 04-economy §8 (`rout` limited to one side), 09-ai (the waves' plan), 11-tech-setup (milestones, §9).

---

## 1. What it is

A third way to play, beside Campaign and Skirmish (22-campaign §1): **hold your HQ against waves of enemies that grow stronger, until it falls.** It follows the round-based "zombies" modes of shooter games: there is no win, only how long you lasted. The score is the **wave you reached** and the **days you held**, kept as a best record on the device.

- **One player, always the defender.** The computer brings the waves; the player builds, repairs and resupplies between them.
- **Built on a real siege.** The first waves follow history day by day. Once history's attacks run out, the waves keep coming, generated and growing (§4).
- **The same rules as every other game.** Waves are units arriving on the map. They then fight, capture, burn fuel and get resupplied under the normal rules. The new rules are how units arrive, how raiders go home, that the attacker can't be routed, and that the attacker gets nothing from what it captures (§5).
- **The first map is Wake Island, December 1941** (§2). The mode is written so other sieges can follow (Corregidor, Crete, Sevastopol; §11).

## 2. Wake Island (`wake-island`)

### The history it follows

Wake is a coral atoll in the central Pacific, three low islands round a shallow lagoon: Wake, Wilkes at its south-west tip and Peale at its north tip. In December 1941 it held about 450 Marines of the 1st Defense Battalion under Major James Devereux, with six 5-inch coastal guns and twelve 3-inch anti-aircraft guns; the twelve Wildcats of VMF-211, which had flown in on 4 December; a small Navy detachment under Commander Winfield Cunningham; and about 1,100 civilian contractors building an air and submarine base.

- **8 December** (Wake is across the date line from Pearl Harbor): 36 bombers from Roi in the Marshalls caught eight Wildcats on the ground at noon and destroyed seven. Raids then came almost every day.
- **11 December:** Rear Admiral Kajioka's invasion force (three light cruisers, six destroyers, two patrol boats and two transports with about 450 naval infantry) closed in at dawn. Devereux held his fire until the ships were close. Battery L on Wilkes sank the destroyer *Hayate*; the last four Wildcats bombed the destroyer *Kisaragi*, which blew up. Kajioka turned back. It was the first time in the war that an amphibious landing was beaten off.
- **21 December:** the carriers *Sōryū* and *Hiryū*, detached on the way home from Pearl Harbor, began striking Wake. On the 22nd the last two Wildcats were lost.
- **The relief that never came:** Task Force 14, with the carrier *Saratoga* (fighters for Wake aboard), the seaplane tender *Tangier* (Marines and ammunition) and the oiler *Neches*, was about 425 miles away on 22 December when it was ordered back.
- **23 December:** Kajioka returned with about 1,500 naval infantry, cruisers in cover and the carriers overhead. Two patrol boats were run aground on Wake's south shore and the troops landed in the dark. On Wilkes the Marines destroyed the landing force, but on Wake the line was overrun, and Cunningham surrendered that morning. **Wake held 16 days.**

### Area and scale

- **About 34 × 28 squares of about 300 m**, north up. The atoll is drawn close to true size (about 23 × 12 squares). The open sea round it is pulled in: the edges stand for the Marshalls (south), the routes from Pearl Harbor (east) and the open Pacific.
- A ship arriving on an edge reaches gun range of the atoll on its next turn, so a wave gives one turn's warning (§3).

### Places

| | US | Neutral |
|---|---|---|
| Wake | **HQ** (Devereux's command post), **Airfield**, Camp 1 (City, by the Wilkes channel), Camp 2 (**Factory**: the contractors' camp, with its workshops and heavy equipment; a liberty, so the player can build) | |
| Wilkes | **Port** (the new boat channel the contractors were dredging) | |
| Peale | Pan American station (City: the Clipper hotel and seaplane base) | |

- 6 properties, all the US's, at the usual 1,000 a day. Japan starts with none, and earns nothing from those it captures (§5d).
- **Terrain:** the islands are scrub (Forest) and open coral (Plains), with a road round Wake and across to Peale. Gun positions are Bunkers. A Reef ring surrounds the atoll, with Beaches on the south shores of Wake and Wilkes, where Japan landed both times. The lagoon is Reef: too shallow for ships, as it was.

### Starting forces (8 December, morning)

- **US** (3,000 funds), moving first:
  - **VMF-211:** 4 Fighters on and beside the airfield (the four that were in the air when the first raid hit).
  - **The 5-inch batteries:** 3 Artillery in Bunkers, at Peacock Point (Battery A, Wake's south-east corner), Kuku Point (Battery L, Wilkes) and Toki Point (Battery B, Peale). Artillery hits ships hard (03-combat §5b), so these are the coast defence.
  - **The 3-inch batteries:** 3 Flak Guns, by the airfield, at Peacock Point and on Peale.
  - **The Marines:** 4 Infantry (one on Wilkes, one on Peale, two on Wake) and an Assault Infantry in reserve by the command post.
  - **A Submarine** to the south (Triton was on patrol off Wake when the war began).
- **Japan:** only wave 1, the noon raid (§3), already on the map south of the atoll.

### Build lists

- **US:** every unit the US has art for, except the never-built ones (Radar Station, Railway Gun) and the Heavy Tank, which the US has no art for (01-units §1). It's the player's shop: what to buy is the game.
- **Japan:** nothing. Every Japanese unit comes in a wave (§5d).

### Weather and fog

- Clear all game. Fog of war is the player's choice, off by default (§10, Q5).

## 3. The waves of the siege (8–23 December)

The first nine waves follow history. "Arrives" is the start of Japan's turn on that day; the units **can't act that turn** (as if just built), so the player sees each wave for one turn before it strikes. Cruisers, which the game doesn't have, are Destroyers and Battleships, as on Guadalcanal (14-scenarios-pacific §4).

| Wave | Arrives | Strikes | Name | Units | From |
|---|---|---|---|---|---|
| 1 | At the start | Day 1 (8 Dec) | The noon raid | 3 Bombers | South |
| 2 | Day 2 | Day 3 | Daily raid | 3 Bombers | South |
| 3 | Day 3 | Day 4 (11 Dec) | The first landing | 4 Destroyers; 2 Landing Craft with 2 Infantry each | South |
| 4 | Day 5 | Day 6 | Raid and submarines | 3 Bombers, 2 Submarines | South |
| 5 | Day 7 | Day 8 | Daily raid | 4 Bombers | South |
| 6 | Day 9 | Day 10 | Raid and bombardment | 3 Bombers, 2 Destroyers | South |
| 7 | Day 11 | Day 12 | Daily raid | 5 Bombers | South |
| 8 | Day 13 | Day 14 (21 Dec) | Carrier Division 2 | 2 Carriers, each with a Fighter and a Dive Bomber; 2 Destroyers | West |
| 9 | Day 15 | Day 16 (23 Dec) | The second landing | 2 Battleships, 4 Destroyers; 4 Landing Craft with 6 Infantry and 2 Assault Infantry | South |

- **The relief force** (§10, Q4, decided: it arrives): **Task Force 14** arrives for the US on the east edge on day 15, the day it was recalled: a Carrier with 2 Fighters aboard (Saratoga, with VMF-221), a Supply Ship (Neches), a Landing Craft with an Infantry and an Artillery (Tangier), and a Destroyer. It's the game's one what-if: what if it hadn't turned back. It's two days' sailing from the atoll, so it arrives in time for the second landing only if the player brings it in fast.
- **Raiders go home.** Bombers and Fighters that come from land bases off the map fly for **2 turns** after they arrive, then return to base at the start of their third turn. They are removed, counted neither as Japanese losses nor as kills (§5c). Aircraft from a Carrier, and any that land at an airfield Japan has captured, stay, as usual.
- **History's mark:** the HUD and the results screen show "Wake fell on day 16". Holding the HQ to the start of day 17 is "**Held longer than history**".
- **Numbers are a first guess**, to be tuned by self-play (§8).

## 4. Endless waves (day 17 onwards)

After the second landing, history ends and the waves keep coming, **a new wave every 2 days** (days 17, 19, 21 …), each bigger than the last. They are generated by the engine from the game's seeded RNG (as all randomness is, 11-tech-setup §3), so the same seed gives the same waves and a replay is exact.

- **Budget:** each wave has a value in funds. Wave 10 has about as much as wave 9; each later wave has **12% more** than the one before. (Wave 9 is about 180,000; wave 20 would be about 560,000.) First guesses, in data.
- **Pattern:** each wave picks one of these, by the seeded RNG, weighted, the weights in data:

| Pattern | What it spends the budget on | From |
|---|---|---|
| Raid | Bombers, with Fighters from wave 12 | South or west |
| Landing | Destroyers and Landing Craft full of foot soldiers (Mortar Teams and Light Tanks from wave 12) | South or west |
| Bombardment | Battleships and Destroyers | Any but east |
| Carrier strike | Carriers with full decks, and Destroyers | West or north |
| Wolf pack | Submarines and Torpedo Boats, hunting ships | Any |
| Combined (from wave 14) | A landing with a raid and a bombardment together, from two edges | Two of the above |

- **Edges:** each edge has its entry squares in the map data (sea squares for ships, any edge square for aircraft). The east edge, the US's supply route, opens to Japan from wave 15.
- **US convoys:** every fourth endless wave (13, 17, 21 …), a US convoy arrives on the east edge the same day: a Supply Ship and a Landing Craft with 2 Infantry. Japan's submarines and raiders will go for it.
- **Unit cap:** Japan has at most 60 units on the map. A wave's units that would go over wait and arrive with the next wave, still counted in the wave they belong to.
- The HUD always shows **the next wave**: its day, its name or pattern and its edge, like the weather forecast (12-weather §5).

## 5. New rules

Everything else is the standard game. These are the new pieces, all in the engine.

### 5a. Arrivals (scheduled units)

- A scenario can list **arrivals**: on a given day, at the start of a given player's turn, these units appear in this **entry zone** (a named list of squares). Each unit is listed like a starting unit: type, HP, fuel, ammo and cargo (a Landing Craft arrives loaded, a Carrier with its aircraft).
- **Placement:** each unit takes the first free square of the zone that it can stand on, in the zone's listed order. If none is free, it waits and tries again at the start of that player's next turn.
- **Arriving units can't act that turn,** like a unit just built (04-economy §4).
- **The wave generator** (§4) adds the endless waves to the same list, a wave at a time, when the day before the wave starts, so the save always holds what is coming next.
- Arrivals are a general rule, not a Survival one: any scenario can use them for reinforcements, which several maps lack (Kursk's Steppe Front, Stalingrad's Winter Storm: 15-scenarios-eastern-front §1, §2).
- **Event:** `unitsArrived` (the wave's number and name, and the units), so the screen can show a banner and pan to them.

### 5b. Victory: the attacker can't be routed

- **`rout` can name a side.** `{ "type": "rout", "side": "allies" }` checks only that side's players. On Wake, Japan often has no units on the map between waves, and must not lose for it.
- **The US loses** when Japan captures the HQ or when the US has no units left (the rout, for the US only), or by resigning. **Japan never loses**, and there's no win for the US.

### 5c. Raiders go home

- A unit arrival can carry **`sortieTurns`**: after that many of its owner's turns on the map, at the start of the next one, the unit leaves the map. It's removed, not destroyed: not in the losses tally (04-economy §8a), not a kill. If it is carrying units, they go with it.
- A unit that lands on a Carrier or an airfield of its own side loses its `sortieTurns` and stays as usual.
- **Event:** `unitLeft`, so the screen can show it flying off the edge.

### 5d. Japan gets nothing from what it captures (decided 2026-11-20)

The developer's choice (§10, Q3), so the waves stay exactly as scripted and can be tuned.

- A property Japan captures becomes Japan's, so the US loses its income, its repairs and its building, and capturing the US HQ still ends the game.
- But **Japan's income is 0** (its `income` stat at -100% through the modifier layer, as the Campaign raises income, 22-campaign §4) and **its build list is empty**, so it never builds. It starts with no funds.
- Its units still get the free fuel and ammo on a property it holds (04-economy §5), but no repairs, since it can't pay for them. Its aircraft can land and refuel at a captured airfield.
- The US can take a property back by capturing it, as usual.

### 5e. The record

- `GameState` keeps the wave reached and the day. The results screen shows "**Reached wave 11, held 20 days**", history's mark (§3), and the kills as a bill of Japan's losses (like 04-economy §8a).
- **Best record per map** on the device (`localStorage`, `ww2-tactics.survival`): the best wave, then the most days. Separate from the autosave and from campaign progress, like 22-campaign §2.

## 6. The computer

- **Japan** plays Greedy (09-ai §4) with a **survival map plan** (09-ai §4k), at Normal:
  - **Drive on the HQ:** land units, fighting or capturing, head for the US HQ, using the "drive on the objective" plan (22-campaign §6b) with the HQ as the objective.
  - **Landings:** Landing Craft head for the south-shore beaches with Greedy's own landing plan (09-ai §4b).
  - **Raiders** prefer Flak Guns, aircraft and the airfield, then ships.
  - The plan knows only what a human attacker would: the map, its own units and what it sees. It doesn't know what the next waves are (it never needs to).
- **The US** can be played by the standard AI, for testing and tuning only (§8).

## 7. Screens

- **Title:** Campaign, Skirmish, **Survival**, and Continue when there's a game to carry on.
- **Survival screen:** the survival maps (Wake Island for now), each with its best record and history's mark ("Best: wave 11, 20 days · History: 16 days"). Picking one shows the briefing (§2's history, shortened), the US commander choice, Luck, Battle scenes and Fog of war (off by default), and Start.
- **In the game:** a wave counter and the next-wave forecast in the HUD ("Wave 4 · Next: day 7, a raid from the south"). When a wave arrives, a banner with its number and name ("Wave 3: The first landing"), then the camera pans to it. Arrived units are drawn and played like any other.
- **Results:** "Wake has fallen", the record (§5e), "New best" when it is one, history's mark, and the kills. Buttons: **Try again** and **Survival**.

## 8. Tuning

- **Target:** the standard AI playing the US **falls by wave 9 (the second landing) in about three games in four**. A careful human plays far better than the standard AI (22-campaign §5), so a good player should outlast history most of the time and fall a few waves later.
- Measured with `npm run selfplay -- --survival`, which reports the wave reached and the day for each seed. Tuning is a data edit: the scripted waves, the budget and growth, the pattern weights.

## 9. Build plan

Proposed as milestones, each one playable:

| # | Engine | Presentation |
|---|---|---|
| S1 | Arrivals with entry zones; `rout` by side; `sortieTurns`; the record in `GameState`. Tests | Arriving and leaving units shown; a wave banner |
| S2 | The wave generator (§4), seeded. Tests | The HUD's wave counter and forecast |
| S3 | The Wake Island map (`tools/maps/wake-island.mjs`, its picture) and its scripted waves | The title item, the Survival screen, the results screen and the best record |
| S4 | — | Japan's survival plan (§6); `selfplay --survival`; tuning to §8 |

### Tests (proposed names)

- "a scheduled arrival appears in its entry zone at the start of its player's turn (23-survival §5a)"
- "arriving units can't act on the turn they arrive (23-survival §5a)"
- "an arrival with no free square waits for the next turn (23-survival §5a)"
- "a Landing Craft arrives with its passengers aboard (23-survival §5a)"
- "a rout limited to the Allies doesn't defeat an Axis player with no units (23-survival §5b)"
- "a raider leaves the map after its sortie and isn't counted as a loss (23-survival §5c)"
- "a raider that lands on a Carrier stays (23-survival §5c)"
- "the same seed generates the same endless waves (23-survival §4)"
- "each endless wave's budget is 12% more than the one before (23-survival §4)"
- "Japan's waves never enter from the east edge before wave 15 (23-survival §4)"
- "Wake Island: the US loses when Japan captures the HQ, and Japan never loses (23-survival §2)"
- "Wake Island: Japan earns no income and builds nothing from a property it captures (23-survival §5d)"
- "Wake Island: Japan's first landing comes ashore on the south beaches (23-survival §3)"

## 10. Decisions (the developer, 2026-11-20)

| # | Question | Decided | Notes |
|---|---|---|---|
| Q1 | When do waves come? | **On fixed days** (§3, §4) | Not when the last wave is wiped out, as in the shooters. History gives the dates, and the player always knows when the next wave is due |
| Q2 | Should destroying an enemy unit pay the player a share of its cost (the shooters' points for kills)? | **No** | The player's money comes only from properties, as in every other game. A salvage stat was considered (20% or 50% of a kill's cost) |
| Q3 | What does Japan get from properties it captures? | **Nothing** (§5d) | No income and no building, so the waves stay as scripted. The US still loses what it held |
| Q4 | Task Force 14: arrive, or be recalled as in history? | **It arrives** on day 15 (§3) | The one what-if, and the mode's relief from the sea |
| Q5 | Fog of war? | **The player's choice, off by default** (§7) | The forecast already says what's coming |
| Q6 | Japan's commander? | **None**, at least at first | Tuning may add one later (§8) |

## 11. Later

- **More survival maps**, each a real siege: **Corregidor** (1942, five months, supplied by submarine), **Crete** (1941, airborne waves landing on the airfields you lose), **Sevastopol** (1941–42, the existing map, supplied by the Black Sea Fleet).
- A **Historical** setting: Task Force 14 recalled, as it was.
- A record of the best runs by commander.
