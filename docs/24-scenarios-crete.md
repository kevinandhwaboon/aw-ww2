# Topic Doc 24: Crete

**Status:** designed (v0 draft), 2026-11-24, at the developer's request, to fill the empty 1941 slot on the map select after Moscow was turned down (15-scenarios-eastern-front §4). **Not built.** Needs one new rule: **arrivals that land only at an airfield their side holds** (§1 "The new rule", an extension of 23-survival §5a). Forces and numbers are first guesses.
**Last updated:** 2026-11-24
**Depends on:** 01-units (Transport Aircraft, availability rule), 02-terrain (§4a Major Bridge), 04-economy-production §8 (victory conditions), 05-supply-transport §6 (airborne drops), 19-fog-of-war, 22-campaign, 23-survival §5a (arrivals). **Feeds:** 00-master-design §8 and §19, 22-campaign §2.

---

## 1. Crete (`crete`)

### Why this map

Moscow was turned down because nothing in how it played was new: winter roads, a road hub, towns to take and a day to hold out to were all on built maps already. Crete was chosen over Beda Fomm, the hunt for the Bismarck, Malaya, Kiev, Crusader, Pearl Harbor and Hong Kong because it passes that test:

- **The attacker starts with no front line.** Every German soldier on Crete arrives by air, a few at a time, onto ground the defender already holds and can see coming. No other map starts this way. On Market Garden the drops support a ground advance from the south and the fight is over bridges; here the drops are the whole attack.
- **It's a race for one airfield.** Until Germany holds an airfield on the island, only what its Transport Aircraft can drop arrives. Once it holds one, the 5th Mountain Division lands there every day (the new rule). The defender wins outright by holding all three airfields together for three days. Both sides fight over the same three squares from the first turn.
- **Each side owns one element.** The UK is stronger on the ground and rules the sea, but has no aircraft. Germany owns the sky and nothing else. Every Royal Navy ship that comes near the north coast by day is in reach of German Bombers; every German convoy that sails is in reach of the Royal Navy.
- **It fills 1941**, between the Battle of Britain (August 1940) and Gazala (May 1942).

### The history it follows

After Greece fell in April 1941, the British, New Zealand, Australian and Greek troops evacuated from the mainland joined the garrison of Crete: about 32,000 Commonwealth soldiers and 10,000 Greeks under the New Zealander Bernard Freyberg (Creforce), short of guns, transport and radios. The RAF withdrew its last fighters on 19 May. British codebreakers had read the German plan, Operation Merkur, so Freyberg knew it would come by air, against the three airfields at Maleme, Rethymno and Heraklion.

On **20 May** the German 7th Air Division dropped in two lifts: in the morning on Maleme and on Prison Valley near Chania, in the afternoon on Rethymno and Heraklion. The paratroops came down among the defenders in the olive groves and were cut to pieces; by evening none of the airfields was taken. That night the 22nd New Zealand Battalion, out of touch with its companies, pulled back from **Hill 107**, which overlooked Maleme airfield.

On **21 May** Germany crash-landed Ju 52s on Maleme under artillery fire and began flying in the 5th Mountain Division. That night the Royal Navy caught the first seaborne convoy of commandeered fishing boats (caiques) north of Crete and scattered it; the second turned back on the 22nd. But by day the Luftwaffe hunted the fleet: in a week it sank the cruisers Gloucester, Fiji and Calcutta and six destroyers and damaged two battleships and the carrier Formidable.

The counter-attack on Maleme on the night of the 21st failed. Fed through the airfield, the Germans pushed east: **Galatas** fell on 25 May, Chania and Souda Bay were lost on the 27th, and Creforce retreated over the White Mountains to **Sphakia** on the south coast. From there and from Heraklion the navy took off about 16,500 men by 1 June. Rethymno, cut off, surrendered on 30 May. Germany had lost about 4,000 dead and more than 200 aircraft. Hitler never ordered another large airborne operation.

### Area and scale

- **About 46 × 28 squares of about 4 km**, north up. Crete from Kastelli in the west to Heraklion in the east (about 140 km, 35 squares), the Sea of Crete to the north, the Libyan Sea to the south.
- **The Aegean is pulled in.** Southern Greece really lies 100 to 300 km north of Crete; here the north edge is a strip of land four squares deep standing for it: the Peloponnese in the west, Attica in the middle, and the island of Milos north of Rethymno. Each German airfield is **about 8 or 9 squares** from the nearest Cretan airfield, so a Transport Aircraft (move 8) reaches the coast the day it takes off and is back to reload the day after. In 1941 a Ju 52 flew several sorties a day; one round trip every two days is the game's rhythm.
- **Egypt is pulled in too.** Alexandria, the fleet's base, is a Port on a small block of land in the south-east corner, about 12 squares from Heraklion, as Midway's bases are pulled in (14-scenarios-pacific §3).
- The coastline comes from Natural Earth, as on the other generated maps, with the sea squeezed.

### Players

- **United Kingdom** (Allies), moving first. The **New Zealand, Australian and Greek** troops are folded into the UK's army and drawn with its art, as the French are at Dunkirk (21-scenarios-dunkirk §1) and El Alamein. The briefing names them.
- **Germany** (Axis). The Italian torpedo boats that escorted the caique convoys are drawn German. Italy's own landing at Sitia on 28 May was east of the map and is left out.

### Places

| | United Kingdom | Germany |
|---|---|---|
| HQ | **Chania** (Creforce headquarters) | Athens |
| Airfields | **Maleme, Rethymno, Heraklion** (the objectives) | Molaoi (Peloponnese), Eleusis, Tanagra (Attica) |
| Ports | Souda Bay, Heraklion, Alexandria (south-east corner) | Piraeus, Milos |
| Factories | none | Corinth |
| Cities | Kastelli, Platanias, Galatas, Alikianos, Georgioupolis, Rethymno, Heraklion, Sphakia, Tymbaki | Sparta, Nauplia, Megara, Monemvasia, Kythera |

- **The UK has no factory**, as Creforce had no way to raise troops on the island. It builds only ships, at Souda Bay, Heraklion and Alexandria.
- **The UK can't build aircraft** (the build list leaves them out), so its three Cretan airfields build nothing while it holds them. If Germany takes one, Germany can build Fighters, Bombers and Transport Aircraft there and refuel and rearm its aircraft on Crete, as JG 77's Bf 109s did from Maleme after 22 May. That's the normal airfield rule (04-economy §1).
- **If Germany takes Chania**, the UK loses at once (`hqCapture`).

### Terrain

- **The White Mountains** (Lefka Ori) fill the west-centre of the island and **Mount Ida** (Psiloritis) the centre: **Hills**, impassable to tanks and wheels. Only the coast road links the three airfields; the one track south over the mountains runs from Vrysses to Sphakia.
- **Hill 107**: a single Hills square just south of Maleme airfield. A unit on it overlooks the airfield (foot soldiers on Hills see 3 squares further, 19-fog-of-war §2), and Artillery behind it reaches the airfield square.
- **Olive groves and vineyards** cover the coastal plain round Maleme, Galatas, Rethymno and Heraklion: **Forest**, which hides units in fog of war. That's where the paratroops landed among defenders they couldn't see.
- **Prison Valley**, the open basin south-west of Galatas, is Plains, with the Agia prison as a **Bunker** (the 3rd Parachute Regiment's base).
- **Rivers:** the **Tavronitis**, a dry riverbed just west of Maleme, where the Assault Regiment gathered; its iron bridge on the coast road is a **Major Bridge** (02-terrain §4a). The Platanias river east of Maleme too.
- **Roads:** the north coast road, Kastelli–Maleme–Chania–Souda–Georgioupolis–Rethymno–Heraklion; Chania to Alikianos through Prison Valley; the mountain track Vrysses–Sphakia.
- **Beaches** at Kastelli bay, along the coast from Maleme to Platanias (where the caiques were meant to land), at Georgioupolis, east of Heraklion, and at Sphakia on the south coast. Landing Craft load and unload there (05-supply-transport §8).
- **Islands:** Kythera and Antikythera in the north-west, Milos in the north (a German Port), Gramvousa off Crete's north-west tip.

### Starting forces (first guess)

**United Kingdom** (10,000 funds, 45 units: 37 on land, 8 ships). No aircraft.

- **Maleme** (5th New Zealand Brigade): 2 Infantry on Hill 107 and the Hills beside it, 1 Infantry on the airfield, 2 Infantry east of it at Pirgos; a Mobile AA (Bofors) beside the airfield; a Medium Tank (two Matildas of 7th Royal Tank Regiment); an Artillery.
- **Kastelli:** 1 Infantry (the 1st Greek Regiment).
- **Galatas and Prison Valley** (4th and 10th New Zealand Brigades, 6th and 8th Greek Regiments): 4 Infantry, a Light Tank (3rd Hussars), an Artillery.
- **Chania and Souda Bay** (Creforce, the Marines' MNBDO, the Welch Regiment): 3 Infantry, one on the HQ; a Flak Gun (the 3.7-inch guns at Souda); a Mobile AA; an Artillery (the coast guns).
- **Georgioupolis:** 2 Infantry (Australian 2/7th and 2/8th Battalions).
- **Rethymno** (Australian 2/1st and 2/11th, 4th and 5th Greek): 3 Infantry, a Medium Tank, an Artillery.
- **Heraklion** (14th Brigade: Black Watch, Leicesters, York and Lancasters, Argylls; Australian 2/4th; 3rd and 7th Greek): 5 Infantry, a Medium Tank, a Light Tank, an Artillery, a Mobile AA.
- **Mediterranean Fleet**, south of Crete by day, as in 1941: a Battleship (Warspite) south-west of Kastelli; 4 Destroyers (the cruiser and destroyer forces) in the Libyan Sea, two south of Chania and two south of Heraklion; 2 Destroyers at Alexandria; a Torpedo Boat (the 10th MTB Flotilla) at Souda Bay. Cruisers are Destroyers here (§2).

**Arriving:**
- **Day 7 (26 May), at Souda Bay:** Layforce, 2 Assault Infantry (commandos landed from the fast minelayer Abdiel).
- **Day 7, at the south-east edge:** the carrier **Formidable** with 2 Fighters (Fulmars), the UK's only aircraft.

**Germany** (15,000 funds, 50 units).

- **On Crete, from the morning drops** (Group West, already landed, worn):
  - **West of Maleme**, in the Tavronitis riverbed (the Assault Regiment): 2 Infantry at 7 HP and an Assault Infantry at 8 HP (the glider pioneers).
  - **Below Hill 107**, dropped among the New Zealanders: 2 Infantry at 4 HP.
  - **Prison Valley** (3rd Parachute Regiment), in and round the prison bunker: 3 Infantry at 7 HP and a Mortar Team.
  - **Akrotiri**, east of Chania: 1 Infantry at 3 HP (the gliders that landed beside the anti-aircraft guns).
- **In the air, the afternoon lift** (Group East): 4 Transport Aircraft, loaded, 4 or 5 squares off the north coast, out of reach of the UK's anti-aircraft guns on the UK's first turn. Two north of Rethymno carry 3 Infantry and a Mortar Team; two north of Heraklion carry 3 Infantry and an Assault Infantry.
- **On the mainland:** 4 more Transport Aircraft, empty, on Molaoi, Eleusis and Tanagra, with 4 Infantry and a Mortar Team beside them for the next lifts.
- **Luftwaffe** (VIII Air Corps): 5 Fighters (Bf 109s and 110s) and 6 Bombers (Ju 87s, Ju 88s and Do 17s together, since Germany has no Dive Bomber art: 08-art-pipeline §17) on the mainland airfields.
- **The sea convoys:** at Milos, 2 Landing Craft (the caique flotillas), one carrying an Infantry and a Light Tank (a Panzer II of the 5th Panzer Division), the other an Infantry and an Artillery, with a Torpedo Boat (the Italian Lupo). At Piraeus, a third Landing Craft, empty.

**Arriving: the 5th Mountain Division, flown in** (the new rule): each day it lands at the first airfield Germany holds, in the order Maleme, Heraklion, Rethymno, or waits until Germany holds one.

| Day | Date | Units |
|---|---|---|
| 2 | 21 May | 2 Infantry, a Mortar Team |
| 3 | 22 May | 3 Infantry, an Artillery (mountain guns) |
| 4 | 23 May | 3 Infantry, a Mobile AA (2 cm flak) |
| 5 | 24 May | 3 Infantry, a Mortar Team |
| 6 | 25 May | 2 Infantry, an Artillery |
| 7 | 26 May | 3 Infantry |
| 8 | 27 May | 2 Infantry, an Assault Infantry |

24 units over a week if Germany holds an airfield from day 2, as it did; none while it doesn't.

### The new rule: arrivals that need an airfield

An extension of arrivals (23-survival §5a), recorded there too. Today an arrival has one entry zone. Now it can have **several zones in order, each of which can need a property**:

```json
{ "day": 2, "player": 1, "name": "5th Mountain Division",
  "zones": [
    { "needs": { "x": 9, "y": 14 }, "zone": [ "…Maleme airfield, then the squares round it…" ] },
    { "needs": { "x": 40, "y": 17 }, "zone": [ "…Heraklion airfield…" ] },
    { "needs": { "x": 26, "y": 18 }, "zone": [ "…Rethymno airfield…" ] }
  ],
  "units": [ "…" ] }
```

- **A zone with `needs` is open only while the arriving player's side owns that property**, checked when the arrival comes, at the start of that player's turn.
- **Units go to the first open zone**, each on the first free square there it can stand on, in the zone's order. When that zone is full, the rest go on to the next open zone.
- **Units that find no open zone with room wait** and try again at the start of that player's next turn, exactly as a unit does today when its zone is full. So the waves of days when Germany held no airfield all land together once it takes one, as far as there's room.
- **A zone without `needs`** works as today, and the old single `zone` is still read as one zone with no `needs`, so existing scenarios don't change.
- **Ownership is by side**, as for victory conditions (04-economy §8).
- **The file is refused** if a `needs` square isn't a property.
- **Event:** `unitsArrived` gains the zone's property, so the banner can say "5th Mountain Division lands at Maleme".
- **Why it's general:** any map can use it for reinforcements that need a port or a railhead, such as Kursk's Steppe Front (15-scenarios-eastern-front §1) only arriving while the railhead is held.

### How it plays

- **The UK's first turn** is the counter-attack the New Zealanders never made: the worn paratroops round Maleme and in Prison Valley are in reach. Clearing them before the afternoon lift lands is the UK's best start; Germany's dropped units can't be resupplied or repaired except on properties they capture.
- **The airfield race.** Germany needs an Infantry on an airfield for two of its turns (one with a worn unit) to capture it, and a UK unit standing on the airfield stops the capture. A Transport Aircraft must drop beside the airfield, so the UK's Mobile AA and Flak Gun guarding it (the Bofors at Heraklion shot down many Ju 52s) make every drop a gamble.
- **After Germany takes an airfield,** reinforcements land on it every day. Units standing on the squares round the airfield fill its zone, so the UK can still choke the landings by fighting on the airfield's edge, or retake the airfield and stop them.
- **The UK wins quickly** by holding all three airfields for three days in a row (earliest at the start of day 4). Germany must take one by day 3 and keep it, or win the next one back.
- **The sea:** German Landing Craft from Milos bring what aircraft can't (a tank, guns) but need two days at sea. UK Destroyers hunt them. The Battleship can shell Maleme from the sea (range 2 to 6). Any ship that ends its turn within reach of the German Bombers risks being sunk; ships must come in, strike and get back south, and rearm at Souda Bay, which the Bombers can also reach, or at distant Alexandria. In 1941 Gloucester and Fiji were sunk after running out of anti-aircraft ammunition.
- **Germany's choices:** where to drop (on the airfield's defenders or out of their reach and walk in), whether to risk the convoys, and whether to send its Bombers after ships or against the defenders of an airfield.

### Fog of war

**Always on** (`settings.fogOfWar`, 19-fog-of-war §1), as on the Battle of Britain, Midway, Gazala and Ten-Go. German intelligence expected about 5,000 defenders and found 40,000, hidden in the olive groves; the paratroops dropped blind. The UK's codebreaking is its starting position: it's already standing on the drop zones.

### Turn order

The UK moves first, as the Allies do on every built-in map. Day 1 is **20 May**, the afternoon after the morning drops.

### Weather

**Clear every day** (summer season). There's no forecast to set: a scenario with none is Clear all game (12-weather §1).

### Build lists

- **United Kingdom:** Destroyer, Torpedo Boat. No land units (no factory), no aircraft (the RAF had left), no Battleship, Carrier, Submarine, Supply Ship or Landing Craft.
- **Germany:** Infantry, Assault Infantry, Mortar Team, Recon, Light Tank, Medium Tank, Artillery, Mobile AA, Flak Gun; Fighter, Bomber, Transport Aircraft; Landing Craft, Torpedo Boat. No Heavy Tank, Tank Destroyer or Rocket Artillery (none in Greece in 1941), and no Halftrack (none reached Crete). No Destroyer (none in the Aegean in May 1941).

### Victory

- **Germany:** capture **Chania**, the UK HQ (`hqCapture`).
- **United Kingdom:** hold **Maleme, Rethymno and Heraklion airfields** together for **3 days** in a row (`holdProperties`). Or still be in the game when **day 14** starts (`surviveDays`): 2 June, the day after the island fell.
- Rout as usual. Resign is always available.
- **Following history,** Germany wins on about day 9 (Chania, 28 May).
- The day-14 deadline is a backstop, not the heart of the map: Moscow was turned down partly for a hold-to-a-day goal. The airfield goal is what decides most games, and it pushes the UK to attack rather than sit.

### Skirmish (two equal players)

Either side can be played by a person or the computer. Fair here doesn't mean symmetric: the UK is strong on day 1 and weakens, Germany is weak on day 1 and grows once it holds an airfield. The levers, in order: the HP of the paratroops already down; the number of loaded and waiting Transport Aircraft; the size of the mountain division's waves; the 3 days of the airfield goal; the UK's funds and the income per property (a scenario setting, 04-economy §1), which decide how many Destroyers the UK can afford to lose.

**The computer as the UK** needs nothing new: the objective pull (09-ai §4i) draws its units to hold the three airfields, the properties it wins by holding, and the standard AI attacks the paratroops in reach. **As Germany** it needs a map plan (below): left alone, Greedy drops its troops toward Chania, the HQ, not the airfields, and its Bombers have no reason to prefer ships near Crete.

### Map AI: the Merkur plan (`src/ai/maps/crete.ts`, 22-campaign §6)

Used in both Skirmish and Campaign, built from the parts of the objective plan (22-campaign §6b), as Gazala's sweep is.

1. **The objectives are the airfields first.** Until Germany holds one Cretan airfield, the target for drops and ground units is the UK airfield with the fewest UK units it has seen within 3 squares. Once it holds one, the targets are Chania and Souda Bay; drops and arrivals near the held airfield guard it with two units.
2. **Transports:** a loaded Transport Aircraft drops its troops beside the target airfield, avoiding squares any seen UK anti-aircraft unit can fire on that turn when another drop square is free; an empty one flies home to the nearest German airfield, loads, and goes again.
3. **Convoys:** a loaded Landing Craft sails only if no UK Destroyer it has seen is within 8 squares of its path, for the beach nearest the airfield Germany holds (or nearest the target, before that).
4. **Bombers:** first any UK ship within 6 squares of Crete, then the units on or next to the target airfield.

### Campaign (the player as the UK)

Following 22-campaign §4–§6. The computer plays Germany, with the advantage all in its starting setup; the map, the victory conditions and the UK forces are unchanged.

- **Where it goes in the chain:** between the Battle of Britain (August 1940) and Gazala (May 1942), as **"Crete, May 1941"**. With Dunkirk built, the chain opens Dunkirk, the Battle of Britain, Crete, Gazala. It's the player's first mission defending against an airborne invasion, and the first without aircraft of their own until day 7.
- **Commander:** **Jakob Wendt** for Germany (foot soldiers +15% attack and defence; Mortar Teams +1 move; air units cost 10% more). The whole German army on Crete is foot soldiers, and the paratroops were Germany's best infantry. Not **Konrad Falk** (Germany has almost no tanks here, and his 20% less ammo would cut the Mortar Teams and Bombers), not **Kenji Arakawa** (his bonus is for Dive and Torpedo Bombers, which Germany doesn't have here).
- **Advantage (first guess), in proportion to the Battle of Britain and Ten-Go:**
  - **Extra units:** the morning drops landed better, so 2 more Infantry (full HP) and a Mortar Team west of Maleme; a fifth loaded Transport Aircraft north of Heraklion carrying 2 Infantry; a third loaded Landing Craft at Milos with an Infantry and a Light Tank; 2 more Bombers on the mainland.
  - **+3,000 funds, +25% income.**
  - **The Merkur plan** (above).
- **Target:** the standard AI playing the UK wins about one game in four (22-campaign §5). Tune the extra units first (22-campaign §5a: units move the result, money mostly doesn't).

### How it's tuned

1. **Skirmish first:** `npm run selfplay` on Crete, seeds 1–20, the standard AI as the UK and the Merkur plan as Germany. Aim for UK wins about half the time, with some UK wins by the airfield goal and German wins by Chania.
2. **Then the campaign:** `npm run selfplay -- --campaign` with the advantage above, toward one UK AI win in four.
3. Record both results in this section and in 22-campaign §5.

### Art

- **Nothing new is needed.** The summer season draws the map. Germany's Transport Aircraft is already a Ju 52, its Landing Craft the 1940 barge (standing for the caiques).
- **Older equipment is drawn as later models**, as on other maps: the UK's Medium Tank stands for the Matilda, the Light Tank for the Vickers Mk VI, the Bomber for the Ju 87 and Ju 88.
- **Optional:** German paratroopers (Fallschirmjäger, the rimless helmet and smock) as a variant of the German Infantry sheet for this map; a caique (a wooden fishing boat with a sail) for Germany's Landing Craft; a Stuka, which would let Germany field Dive Bombers here.
- **The map select** features parachutes opening over olive groves below the White Mountains, with Ju 52s overhead. Aircraft carry the Balkenkreuz only; no swastika on the tails (00-master-design §6).

### How it's made

`tools/maps/crete.mjs` generates the scenario (arrivals included) from real longitude and latitude points for the coast, the towns, the airfields, Hill 107, the mountains, the olive groves and the roads, with the Aegean squeezed so the German airfields are 8 or 9 squares from the Cretan ones and Alexandria pulled into the south-east corner. It lists each airfield's arrival zone: the airfield square, then the squares round it, nearest first. `tools/maps/overview.mjs crete` draws the overview picture.

### Build order

1. **Engine:** zones that need a property for arrivals: types, file parsing and checks, the placement rule, the property in `unitsArrived`; the self-play state checker learns it.
2. **Map:** the generator and scenario file, with the starting units' HP, the arrivals and the victory conditions.
3. **Scenario tests** (below), then `npm run check`.
4. **AI:** the Merkur plan.
5. **Skirmish tuning:** `npm run selfplay` on Crete and every other map, then tune as above.
6. **Campaign:** the mission entry in `src/campaign/missions.ts`, placed after the Battle of Britain; tune it.
7. **Map select:** the world-map dot on Crete and the featured picture; the overview picture in this doc.

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

Scenario tests ("Crete (24-scenarios-crete §1)"):
- "The map is about 46 × 28, the UK against Germany, the UK moves first, and fog is always on"
- "Chania is the UK HQ and Athens the German HQ"
- "Germany wins by capturing Chania"
- "The UK wins by holding Maleme, Rethymno and Heraklion airfields for 3 days in a row"
- "The UK wins at the start of day 14"
- "The UK has no aircraft at the start and can build only Destroyers and Torpedo Boats"
- "Germany has no land unit on the mainland able to reach Crete except by air or sea"
- "The 5th Mountain Division doesn't land while the UK holds all three airfields"
- "The 5th Mountain Division lands at Maleme once Germany holds it"
- "Every German airfield is at most 9 squares from a Cretan airfield"
- "The loaded Transport Aircraft start out of reach of every UK anti-aircraft unit"
- "Hill 107 is a Hills square next to Maleme airfield"
- "Only the coast road links the three airfields for tanks"
- "The Tavronitis bridge is a Major Bridge"
- "Germany can't build a Heavy Tank, a Halftrack or a Destroyer"
- "Formidable arrives on day 7 with two Fighters, and Layforce lands at Souda Bay"

Campaign tests (22-campaign):
- "The Crete mission comes after the Battle of Britain and before Gazala"
- "On the Crete mission the computer plays Germany with Jakob Wendt"

### Questions for the developer

None is needed for v0. The doc's answer for now is in brackets.

1. **Night.** The real battle had a rhythm the game can't show: the Royal Navy owned the sea by night and ran south before dawn; the Luftwaffe owned it by day. A day/night rule is an open question in the master doc (§18). [v0: no night. The ships' range and fuel do the work: they come in, strike and leave.]
2. **Waves that wait.** Should a mountain-division wave that finds no airfield held wait for one, as written, or be lost? Waiting means the waves pile up and land together when Germany finally takes an airfield. [v0: wait, the existing rule for a full zone. The UK's three-day airfield goal ends the game before many can pile up.]
3. **An evacuation ending.** Should the UK also be able to win, or soften a loss, by evacuating units from Sphakia, with Dunkirk's `evacuateUnits` (21-scenarios-dunkirk)? It would make the end of the battle playable but repeat Dunkirk. [v0: no.]
4. **Survival.** Crete was on the list of later Survival maps (23-survival §11). [v0: it's a battle map instead; a Survival version could share the map later.]

## 2. Known gaps

- **No night**, as above.
- **Cruisers are Destroyers.** The cruisers that did most of the fighting have no unit of their own.
- **No gliders** (deferred, 01-units §7). The glider landings of the Assault Regiment are drops like the rest.
- **Air-landing costs no aircraft.** In 1941 Germany lost about 150 Ju 52s in the battle, many of them wrecked landing on Maleme under fire; arrivals here use no Transport Aircraft.
- **The Hill 107 withdrawal isn't scripted.** The UK player decides whether to hold the hill.
- **No Greek, New Zealand or Australian nation.** Their troops are drawn British.
- **Italy's landing at Sitia** (28 May) is east of the map.
- **Stukas are Bombers**, until Germany has Dive Bomber art.
- **Balance is a first guess**, untested.
