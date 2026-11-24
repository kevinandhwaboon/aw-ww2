# Topic Doc 24: Crete (Survival)

**Status:** designed (v0 draft), 2026-11-24, at the developer's request: the second Survival map (23-survival), after Wake Island. First drafted the same day as a battle map for the empty 1941 slot; the developer moved it to Survival because the real battle was a German win, a siege the defender lost. **Not built.** Needs one new rule, **arrivals that land only at an airfield their side holds** (§5), and a new wave pattern set (§4). Forces and numbers are first guesses.
**Last updated:** 2026-11-24
**Depends on:** 23-survival (the mode and its rules), 01-units (Transport Aircraft, availability rule), 02-terrain (§4a Major Bridge), 05-supply-transport §6 (airborne drops), 09-ai (§4k map plans), 19-fog-of-war. **Feeds:** 00-master-design §8 and §19, 23-survival §5a and §11.

---

## 1. Why Crete

Crete was on Survival's list of later maps (23-survival §11) as "airborne waves landing on the airfields you lose". It plays differently from Wake Island:

- **The waves come from the air.** On Wake almost every attack comes from the sea onto the south beaches. On Crete most waves are paratroops, dropped by Transport Aircraft beside whatever they're aiming for, anywhere along 140 km of coast.
- **Losing an airfield makes the waves bigger.** While the UK holds all three airfields, Germany can only parachute troops in: few, scattered and worn by the drop. Once Germany takes one, the 5th Mountain Division lands on it every day (§5). The player's first choice each day is which airfields to hold and what to spend holding them.
- **The player has no sky.** The UK can't build aircraft (§2 "Build lists"). Its defence against the Luftwaffe is Flak Guns, Mobile AA and its navy. Wake's game turns on keeping its Fighters alive; here there are none to keep.
- **Many fronts.** Wake is one small atoll. Crete is a long island with three airfields far apart, so the player decides what to give up.

The 1941 slot in Skirmish and the Campaign stays empty (00-master-design §19).

## 2. Crete (`crete`)

### The history it follows

After Greece fell in April 1941, the British, New Zealand, Australian and Greek troops evacuated from the mainland joined the garrison of Crete: about 32,000 Commonwealth soldiers and 10,000 Greeks under the New Zealander Bernard Freyberg (Creforce), short of guns, transport and radios. The RAF withdrew its last fighters on 19 May. British codebreakers had read the German plan, Operation Merkur, so Freyberg knew it would come by air, against the three airfields at Maleme, Rethymno and Heraklion.

- **20 May:** the German 7th Air Division dropped in two lifts, in the morning on Maleme and on Prison Valley near Chania, in the afternoon on Rethymno and Heraklion. The paratroops came down among the defenders in the olive groves and were cut to pieces; by evening none of the airfields was taken. That night the 22nd New Zealand Battalion, out of touch with its companies, pulled back from **Hill 107**, which overlooked Maleme.
- **21 May:** Germany crash-landed Ju 52s on Maleme under artillery fire and began flying in the 5th Mountain Division. That night the Royal Navy caught the first seaborne convoy of fishing boats (caiques) north of Crete and scattered it; the second turned back on the 22nd. By day the Luftwaffe hunted the fleet: in a week it sank three cruisers and six destroyers.
- **22–25 May:** the counter-attack on Maleme failed. Fed through the airfield, the Germans pushed east. **Galatas** fell on the 25th.
- **27 May:** Chania and Souda Bay were lost, and Creforce began its retreat over the White Mountains to Sphakia. From there and from Heraklion the navy took off about 16,500 men by 1 June. Rethymno, cut off, surrendered on 30 May.

Germany lost about 4,000 dead and more than 200 aircraft, about 150 of them Ju 52s. Hitler never ordered another large airborne operation.

### Area and scale

- **About 40 × 22 squares of about 4 km**, north up: Crete from Kastelli in the west to Heraklion in the east (about 140 km, 35 squares), with about 5 squares of sea to the north and south.
- **The edges stand for** the Greek mainland and its airfields (north and west), the Dodecanese (east), and Egypt and the fleet's base at Alexandria (south).
- A Transport Aircraft or a Bomber arriving on the north edge reaches the coast on its next turn, so a wave gives one turn's warning, as on Wake (23-survival §3). A Landing Craft takes a day longer.

### Places

| | United Kingdom | Neutral |
|---|---|---|
| West | **Maleme** (Airfield), Kastelli (City), Galatas (City) | |
| Centre | **Chania** (**HQ**, Creforce headquarters), **Souda Bay** (Port, and a **Factory**: the base depot, a liberty so the player can build land units), Georgioupolis (City), Sphakia (City, south coast) | |
| East | **Rethymno** (Airfield, and a City for the town), **Heraklion** (Airfield, and a Port for the harbour) | |

- 12 properties, all the UK's, at the usual 1,000 a day. Germany starts with none, and earns nothing from those it captures (§5, as 23-survival §5d).
- **If Germany takes Chania**, Crete has fallen.

### Terrain

- **The White Mountains** fill the west-centre of the island and **Mount Ida** the centre: **Hills**, impassable to tanks and wheels. Only the coast road links the three airfields; one track runs south over the mountains from Vrysses to Sphakia.
- **Hill 107**: a single Hills square just south of Maleme airfield. A unit on it overlooks the airfield (foot soldiers on Hills see 3 squares further, 19-fog-of-war §2), and Artillery behind it reaches the airfield square.
- **Olive groves and vineyards** cover the coastal plain round Maleme, Galatas, Rethymno and Heraklion: **Forest**, which hides units in fog of war.
- **Prison Valley**, south-west of Galatas: Plains, with the Agia prison as a **Bunker**.
- **The Tavronitis**, a dry riverbed just west of Maleme, is a River; its iron bridge on the coast road is a **Major Bridge** (02-terrain §4a).
- **Roads:** the north coast road, Kastelli–Maleme–Chania–Souda–Georgioupolis–Rethymno–Heraklion; Chania to Alikianos through Prison Valley; Vrysses to Sphakia.
- **Beaches** at Kastelli bay, from Maleme to Platanias (where the caiques were meant to land), at Georgioupolis, east of Heraklion, and at Sphakia.

### Starting forces (19 May, the day before the drops)

- **United Kingdom** (5,000 funds), moving first. The New Zealand, Australian and Greek troops are drawn with the UK's art, as the French are at Dunkirk (21-scenarios-dunkirk §1); the briefing names them.
  - **Maleme** (5th New Zealand Brigade): 2 Infantry on Hill 107 and beside it, 1 Infantry on the airfield, a Mobile AA (Bofors), a Medium Tank (two Matildas), an Artillery.
  - **Galatas and Prison Valley** (New Zealand and Greek): 3 Infantry, a Light Tank (3rd Hussars).
  - **Chania and Souda Bay:** 2 Infantry, one on the HQ; a Flak Gun (the 3.7-inch guns at Souda); an Artillery.
  - **Rethymno** (Australian and Greek): 2 Infantry, an Artillery.
  - **Heraklion** (14th Brigade, Australian 2/4th, Greek): 3 Infantry, a Medium Tank, a Mobile AA.
  - **The fleet:** 2 Destroyers south of Crete (the cruiser and destroyer forces) and a Torpedo Boat (10th MTB Flotilla) at Souda Bay.
- **Germany:** nothing. Every German unit comes in a wave.

### Build lists

- **United Kingdom:** every land unit the UK has art for except the Heavy Tank (no Churchill before 1942) and the never-built ones; Destroyer and Torpedo Boat. **No aircraft**: the RAF had left Crete, and having none is what makes this map different (§8, Q1).
- **Germany:** nothing (23-survival §5d).

### Weather and fog

- Clear all game.
- Fog of war is the player's choice, off by default, as on Wake (23-survival §10, Q5).

## 3. The waves of the invasion (19–28 May)

The first ten waves follow history. "Arrives" is the start of Germany's turn on that day; the units **can't act that turn**, so the player sees each wave for one turn before it strikes. Day 1 is 19 May.

| Wave | Arrives | Strikes | Name | Units | From |
|---|---|---|---|---|---|
| 1 | Day 1 | Day 2 (20 May) | The morning lift | 5 Transport Aircraft carrying 7 Infantry, an Assault Infantry (the glider pioneers) and a Mortar Team, for Maleme and Prison Valley; 3 Bombers and a Fighter | North, west half |
| 2 | Day 2 | Day 3 | The afternoon lift | 4 Transport Aircraft carrying 7 Infantry and a Mortar Team, for Rethymno and Heraklion; 2 Bombers | North, east half |
| 3 | Day 3 | Day 4 (22 May) | The first mountain troops | **Air-landed** (§5): 3 Infantry and a Mortar Team | The first airfield Germany holds |
| 4 | Day 3 | Day 5 | The Maleme convoy | 2 Landing Craft carrying 2 Infantry, a Light Tank and an Artillery; a Torpedo Boat (the Italian Lupo) | North |
| 5 | Day 4 | Day 5 | Mountain troops | **Air-landed:** 3 Infantry, an Artillery (mountain guns) | Airfield |
| 6 | Day 4 | Day 5 | Hunting the fleet | 4 Bombers and a Fighter | North |
| 7 | Day 5 | Day 6 | Mountain troops | **Air-landed:** 3 Infantry, a Mobile AA (2 cm flak) | Airfield |
| 8 | Day 6 | Day 7 (25 May) | Galatas | **Air-landed:** 3 Infantry, an Assault Infantry, a Mortar Team; 4 Bombers and 2 Fighters | Airfield; north |
| 9 | Day 7 | Day 8 | The second drop | 4 Transport Aircraft carrying 6 Infantry and 2 Assault Infantry | North |
| 10 | Day 9 | Day 10 (28 May) | Sitia | 2 Landing Craft carrying 2 Infantry and 2 Light Tanks (the Italian landing, drawn German); a Torpedo Boat | East |

- **Air-landed waves** land at the first airfield Germany holds, in the order Maleme, Heraklion, Rethymno, on the airfield and the squares round it. **While the UK holds all three, they wait** (§5). The ones that waited all land on the day Germany first takes an airfield, as far as there's room. Holding every airfield is the player's way to keep the waves small; losing one opens the gate.
- **Raiders go home:** Bombers, Fighters and Transport Aircraft fly for **2 turns** after they arrive, then turn for home (`sortieTurns: 2`, 23-survival §5c), unless they land at an airfield Germany has captured. Landing Craft leave once they've unloaded (`leavesWhenEmpty`).
- **The relief:** on day 8 (26 May), **Layforce** lands at Souda Bay (2 Assault Infantry, the commandos landed from the fast minelayer Abdiel), and the carrier **Formidable** arrives on the south edge with 2 Fighters aboard (Fulmars): the UK's only aircraft, and only while the Carrier survives.
- **History's mark:** "Chania fell on 27 May 1941, day 9". Holding the HQ to the start of day 10 is "**Held longer than history**".
- **Numbers are a first guess**, to be tuned by self-play (§7).

## 4. Endless waves (day 11 onwards)

As on Wake (23-survival §4), from the same generator: a new wave every 2 days (days 11, 13, 15 …), the first worth about as much as wave 10, each later one **12% more**. They use a new pattern set, **`aegean`** (data in `src/engine/data/waves.ts`, beside `pacific`):

| Pattern | What it spends the budget on | From |
|---|---|---|
| Parachute drop | Transport Aircraft full of Infantry, Assault Infantry and Mortar Teams, with a Fighter escort | North or west |
| Air landing | Infantry, Mortar Teams, Artillery, Mobile AA, landing at an airfield Germany holds (§5) | Airfields only |
| Raid | Bombers, with Fighters | North, west or east |
| Convoy | Landing Craft with foot soldiers, Light Tanks and Artillery, with Torpedo Boats | North or east |
| Combined (from wave 15) | A drop with a raid, or an air landing with a convoy | Two of the above |

- **Air landing is picked only while Germany holds a Cretan airfield** when the wave is generated. Otherwise its weight goes to the others. That's the generator reading the game state, as it already does for the unit cap (a small change: §5).
- **Edges:** north, west and east from the start. The south, the fleet's route from Alexandria, opens to Germany from wave 15.
- **UK convoys:** every fourth endless wave (13, 17, 21 …), a UK convoy arrives on the south edge the same day: a Destroyer and a Landing Craft with 2 Infantry, as the navy ran men and supplies in from Alexandria.
- **Unit cap:** Germany has at most 60 units on the map, as on Wake.

## 5. New rules

Everything else is Survival as built (23-survival §5): `rout` for the UK only, so Germany never loses; raiders going home; Germany getting nothing from what it captures (no income, no building), though its aircraft can land and refuel at a captured airfield.

### Arrivals that need an airfield (new)

An extension of arrivals (23-survival §5a), recorded there too. Today an arrival has one entry zone. Now it can have **several zones in order, each of which can need a property**:

```json
{ "day": 4, "player": 1, "wave": 5, "name": "Mountain troops",
  "zones": [
    { "needs": { "x": 7, "y": 9 }, "zone": [ "…Maleme airfield, then the squares round it…" ] },
    { "needs": { "x": 35, "y": 12 }, "zone": [ "…Heraklion airfield…" ] },
    { "needs": { "x": 22, "y": 13 }, "zone": [ "…Rethymno airfield…" ] }
  ],
  "units": [ "…" ] }
```

- **A zone with `needs` is open only while the arriving player's side owns that property**, checked when the arrival comes, at the start of that player's turn.
- **Units go to the first open zone**, each on the first free square there it can stand on, in the zone's order. When that zone is full, the rest go on to the next open zone.
- **Units that find no open zone with room wait** and try again at the start of that player's next turn, exactly as a unit does today when its zone is full.
- **A zone without `needs`** works as today, and the old single `zone` is still read as one zone with no `needs`, so Wake Island doesn't change.
- **Ownership is by side**, as for victory conditions (04-economy §8).
- **The file is refused** if a `needs` square isn't a property.
- **Event:** `unitsArrived` gains the property, so the banner can say "Wave 5: Mountain troops land at Maleme".
- **The forecast** for an air-landed wave says where it would land today, or "waiting for an airfield".
- **Why it's general:** any map can use it for reinforcements that need a port or a railhead.

### The generator reads the airfields (new, small)

A pattern can be marked `needsHeldProperty`: it's left out of the draw unless the attacker's side owns one of the properties its zones need. Used for Air landing (§4).

## 6. The computer

- **Germany** plays the survival map plan (23-survival §6) with one change, **the airfields first**: until Germany holds a Cretan airfield, the objective for its land units and its drops is the UK airfield with the fewest UK units it has seen within 3 squares, not the HQ. Once it holds one, the objective is Chania, as on Wake, and two units stay on the held airfield.
- **Transport Aircraft** drop beside the objective, avoiding squares a seen UK anti-aircraft unit can fire on that turn when another drop square is free. Greedy's drops (09-ai §4b) do the rest.
- **Raiders** prefer Flak Guns and Mobile AA, then ships, then units on the objective.
- **The UK** can be played by the standard AI with the defender's plan (23-survival §6), for tuning only. It should also count the three airfields as worth defending, or self-play will give them up and test nothing.

## 7. Tuning

- **Target:** as on Wake (23-survival §8), the standard AI playing the UK falls within a few days of history (Chania on day 9). A careful human should hold longer.
- Measured with `npm run selfplay -- --maps crete`.
- **The levers,** in order: the size of the drops and how many Transport Aircraft the anti-aircraft guns can reach; the size of the air-landed waves; the UK's starting funds and units; the first endless wave's budget.

## 8. Decisions for the developer

None is needed for v0. The doc's answer for now is in brackets.

| # | Question | v0 answer | Notes |
|---|---|---|---|
| Q1 | Can the player build aircraft? | **No** | The heart of the map: the Luftwaffe owned the sky. Wake's player builds Fighters; here the player answers with Flak Guns, Mobile AA and ships. Formidable's two Fulmars are the one exception |
| Q2 | Air-landed waves while the UK holds every airfield: wait, or be lost? | **Wait** | The existing rule for a full zone. They pile up and land together, which makes losing the first airfield hurt, as Maleme did |
| Q3 | Fog of war? | **The player's choice, off by default**, as on Wake | The forecast says what's coming. Fog would make the drops land blind, as in 1941 |
| Q4 | Germany's commander? | **None**, as on Wake | |
| Q5 | Should the record also count units evacuated from Sphakia, with Dunkirk's `evacuateUnits` (21-scenarios-dunkirk)? | **No** | Survival scores waves and days, the same on every map |

## 9. Build plan

| # | Engine | Presentation |
|---|---|---|
| C1 | Zones that need a property (§5), and `needsHeldProperty` for patterns; the self-play state checker learns them. Tests | The banner and forecast name the airfield, or "waiting for an airfield" |
| C2 | The `aegean` pattern set (§4) | — |
| C3 | The Crete map (`tools/maps/crete.mjs` from real longitude and latitude, its overview picture) and its scripted waves; it joins `SURVIVAL_SCENARIOS` and `src/survival/maps.ts` (history's mark) | The Survival screen lists it, with its terrain sketch and briefing |
| C4 | — | Germany's airfields-first plan (§6); self-play tuning (§7) |

### Tests to write

Rule tests (23-survival §5a):
- "An arrival that needs an airfield lands there while its side owns it"
- "An arrival whose airfield is held by the enemy waits and lands once its side takes it"
- "An arrival goes to the first listed zone its side holds"
- "When the first zone is full, the rest of the arrival goes on to the next zone its side holds"
- "An ally's property opens a zone too"
- "An arrival with a single zone and no condition works as before"
- "A file is refused if a zone needs a square that isn't a property"
- "The arrival event names the property it landed at"
- "A pattern that needs a held property isn't picked while the attacker holds none"

Map tests ("Crete (24-survival-crete)"):
- "The UK loses when Germany captures Chania, and Germany never loses"
- "Germany starts with no units and builds nothing"
- "The UK can't build aircraft"
- "No air-landed wave arrives while the UK holds all three airfields"
- "Air-landed waves land at Maleme once Germany holds it"
- "The morning lift's Transport Aircraft reach Maleme the turn after they arrive"
- "Hill 107 is a Hills square next to Maleme airfield"
- "Only the coast road links the three airfields for tanks"
- "The Tavronitis bridge is a Major Bridge"
- "Formidable arrives on day 8 with two Fighters, and Layforce lands at Souda Bay"
- "Germany's waves never enter from the south edge before wave 15"
- "History's mark is Chania on day 9"

## 10. Art

- **Nothing new is needed.** The summer season draws the map. Germany's Transport Aircraft is already a Ju 52, its Landing Craft the 1940 barge (standing for the caiques); its Bomber stands for the Ju 87 and Ju 88.
- **Optional:** German paratroopers (Fallschirmjäger, the rimless helmet and smock) as a variant of the German Infantry for drop waves; a caique for the Landing Craft; a Stuka.
- **The Survival screen picture:** parachutes opening over olive groves below the White Mountains, with Ju 52s overhead. Aircraft carry the Balkenkreuz only; no swastika on the tails (00-master-design §6).

## 11. Known gaps

- **No night.** The navy owned the sea by night and ran south before dawn; here every day is the same.
- **Cruisers are Destroyers.** No gliders (01-units §7): the glider landings are drops like the rest.
- **Air-landing costs no aircraft.** In 1941 many Ju 52s were wrecked landing on Maleme under fire.
- **No Greek, New Zealand or Australian nation.** Their troops are drawn British.
- **The Souda Bay factory is a liberty**, like Wake's Camp 2: Creforce couldn't raise new troops.
- **Balance is a first guess**, untested.
