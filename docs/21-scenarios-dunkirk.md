# Topic Doc 21: Dunkirk

**Status:** designed (v0 draft), 2026-11-20, at the developer's request, to fill the empty 1940 slot on the map select. **Not built.** Needs one new rule: the `evacuateUnits` victory condition (04-economy §8). Forces and numbers are first guesses.
**Last updated:** 2026-11-20
**Depends on:** 01-units (Landing Craft, availability rule), 02-terrain (§4a Major Bridge, §4b Salt Marsh), 04-economy-production §8 (victory conditions), 05-supply-transport §8 (landings), 09-ai (§4h landings, new evacuation goal), 12-weather (rain). **Feeds:** 00-master-design §8 and §19.

---

## 1. Dunkirk (`dunkirk`)

### Developer decisions (2026-11-20)

- **The UK wins by evacuating a number of units**, with a new victory condition (§1 "Victory", 04-economy §8).
- **No Halt Order.** The German armour on the Aa canal starts free to attack on day 1. In 1940 it stood still from 24 to 26 May; here it doesn't, and that's balanced by the evacuation target, not by a scripted pause.

### Why this map

- **It fills 1940** (00-master-design §8): before it, the only map before 1942 was the Battle of Britain.
- **It's the first map where Germany is winning the campaign.** Every other German side defends, or attacks and loses.
- **It's a new kind of game: escape.** The UK can't win by holding ground. Every soldier it ships home is one fewer holding the perimeter, so each turn it chooses between the beach and the line. Germany doesn't need to destroy the BEF, only to stop enough of it leaving in time.

### The history it follows

In May 1940 the German armour broke through the Ardennes and drove to the Channel at Abbeville, cutting off the British Expeditionary Force, the French First Army and the Belgian army in Flanders. By 26 May the BEF was falling back to the only port left, Dunkirk, inside a perimeter along the canals from Gravelines to Nieuport. That evening the Royal Navy began **Operation Dynamo**, expecting to bring back 45,000 men.

On **28 May** the Belgian army surrendered, opening the eastern flank, and British troops raced to close the gap at Nieuport. Dunkirk's docks were wrecked by bombing and burning oil tanks, so ships loaded from the East Mole, a long breakwater, and from the beaches at Malo-les-Bains, Bray-Dunes and La Panne, where soldiers waded out to small boats. Hundreds of "little ships" (fishing boats, pleasure steamers, lifeboats and yachts) carried them out to destroyers and personnel ships. The shortest crossing, Route Z, ran past the German guns at Calais, so ships went the long way round the sandbanks.

The Luftwaffe bombed the beaches and the ships whenever the weather allowed. On **1 June** it sank the destroyers Keith, Basilisk and Havant, and daylight sailings stopped. The RAF flew from Kent to cover the beaches, often out of sight of the troops below. The French rearguard held the shrinking perimeter to the end. When Dunkirk fell on **4 June**, about 338,000 men had been brought away, some 120,000 of them French; almost all the BEF's guns, tanks and lorries were left behind, and about 40,000 French soldiers were captured.

### Area and scale

- **About 36 × 30 squares**, north up. From Calais in the west to Nieuport in the east, from the Kent coast (Margate to Folkestone) in the north to Saint-Omer, Hazebrouck and Ypres in the south.
- **Land is about 2.5 km a square**, so the perimeter, about 45 km of coast and 10 to 15 km deep, is 18 by 5 squares, and Cassel is 11 squares from Dunkirk.
- **The Channel is narrowed**, as on the Normandy map (10-scenarios-normandy §1): from the beaches to Dover or Ramsgate is at most **6 squares of sea**, so a loaded Landing Craft (move 6) leaves a beach and reaches England the same day. In 1940 a crossing took 3 to 9 hours; one round trip every two days is the game's rhythm, standing for several sailings.
- The coastline comes from Natural Earth, as on the other generated maps, with the Channel squeezed.

### Players

- **United Kingdom** (Allies), moving first. The **French** troops in the pocket (XVI Corps on the west flank, the rearguard) are folded into the UK's army and drawn with its art, as at El Alamein (18-scenarios-north-africa §1, "Why the Free French are folded in"). A France nation is left for later (§2).
- **Germany** (Axis). The computer plays Germany by default (09-ai §5); a human plays the UK.
- **Belgium** isn't on the map: the game starts on 28 May, the day it surrendered, with the gap it left at Nieuport.

### Places

| | United Kingdom | Germany |
|---|---|---|
| HQ | **Dunkirk** (the town, beside its port) | Saint-Omer |
| Ports | Dunkirk (the East Mole); Dover, Ramsgate (England) | Calais |
| Airfields | Manston, Hawkinge (England) | Saint-Omer–Longuenesse |
| Factories | none | Saint-Omer, Hazebrouck |
| Cities | Bergues, Furnes, La Panne, Bray-Dunes, Malo-les-Bains, Hondschoote, Poperinge, Cassel; Deal, Margate, Canterbury, Folkestone (England) | Gravelines, Watten, Ypres, Dixmude |
| Neutral | Nieuport, Wormhout, Armentières | |

- **The UK has no factory.** It can't build a soldier, as the BEF couldn't: what's in the pocket is all there is. It builds ships at Dover and Ramsgate and aircraft at Manston and Hawkinge.
- **The UK HQ is in the pocket.** If Germany takes Dunkirk, the UK loses at once (`hqCapture`): the fall of Dunkirk ended the evacuation.
- **Dunkirk's port** is a Port square on the coast beside the HQ, standing for the East Mole: Landing Craft load there without needing a beach.

### Terrain

- **Flat Flanders plains** with few woods. The **Flemish hills**, Mont Cassel and Mont des Cats, are Hills, with Cassel, the strongpoint the 145th Brigade held until 29 May, on the first.
- **The canals are Rivers.** The Aa (Gravelines–Watten–Saint-Omer), the Colme, the **Bergues–Furnes canal** (the perimeter line) and the Yser (Nieuport–Dixmude–Ypres), with Bridges at the towns. The bridges on the Bergues–Furnes canal and the Yser are **Major Bridges** (02-terrain §4a): the UK's Royal Engineers (Assault Infantry) can blow them, as the BEF did.
- **The flooded polders are Salt Marsh** (02-terrain §4b): impassable to land units. The French opened the sluices and flooded **Les Moëres**, between Bergues and Hondschoote, and the land along the Yser. They narrow the German attack to the roads and the canal banks. It needs a flooded-fields tile (§1 "Art").
- **Beaches** along the whole coast from Malo-les-Bains to La Panne, and at Gravelines and Calais. Landing Craft load there (05-supply-transport §8). The Kent coast has no beaches; ships unload at Dover and Ramsgate.
- **The Flemish banks:** a line of **Reef** squares offshore, with gaps. Reef costs ships 2 and hides them (02-terrain), so the sandbanks shape the routes:
  - **Route Z**, the shortest, runs west along the coast past Gravelines and Calais, within range of German Artillery there.
  - **Route Y** goes east, out through a gap off Nieuport and back round: safe from the guns but a day longer.
  - **Route X**, through the middle of the banks, is the compromise: one square of Reef to cross.
- **Bergues** has a **Bunker** in its old walls. Bunkers have HP and break under fire (03-combat §4).

### Starting forces (first guess)

**United Kingdom** (12,000 funds, 49 units: 33 on land, 12 ships, 4 aircraft). Foot units are what counts for evacuation (§1 "Victory"); there are **24**.

- **In the perimeter:**
  - West, Mardyck to Bergues (French XVI Corps): 4 Infantry, 1 Artillery; 1 Infantry in the Bergues bunker.
  - On the Bergues–Furnes canal (BEF I and II Corps): 8 Infantry, 1 Assault Infantry (Royal Engineers), 2 Mortar Teams, 2 Artillery, 1 Light Tank.
  - On the beaches, waiting to embark: 4 Infantry at Malo, Bray-Dunes and La Panne. A Mobile AA (Bofors) at Bray-Dunes and a Flak Gun (3.7-inch) at Dunkirk.
- **Outside, falling back:** 1 Infantry in Cassel; 3 Infantry, a Halftrack (Bren carriers) and a Light Tank on the Poperinge road; a Recon (12th Lancers) racing for the Nieuport gap.
- **Royal Navy:** 5 Destroyers (2 at Dover, 1 in the Downs off Deal, 2 off Dunkirk); **6 Landing Craft** (2 at Dover, 2 at Ramsgate, 1 on the beach at Malo and 1 at La Panne, empty); 1 Torpedo Boat (MTB) at Dover.
- **RAF, 11 Group:** 3 Fighters (Manston, Hawkinge, and one beside Manston), 1 Bomber (Blenheims) at Manston.

**Germany** (15,000 funds, 45 units: 32 on land, 11 aircraft, 2 boats).

- **West, Army Group A on the Aa:** at Calais, 1 Infantry and 1 Artillery (the guns on Route Z); at Gravelines, 2 Medium Tanks, 1 Light Tank, 2 Infantry; at Watten and Saint-Omer, 2 Medium and 2 Light Tanks, 2 Halftracks, 3 Infantry, 1 Artillery.
- **South, before Cassel and Hazebrouck:** 3 Infantry, 1 Assault Infantry, 1 Artillery, 1 Medium Tank.
- **East, Army Group B from Belgium:** at Ypres, 3 Infantry, 1 Assault Infantry, 1 Mortar Team, 1 Artillery; at Dixmude, 2 Infantry and 1 Recon, heading for Nieuport.
- **Luftwaffe:** 5 Fighters and 6 Bombers on and around Saint-Omer. The Bombers stand for the Ju 87 and He 111 together, since Germany has no Stuka art yet (08-art-pipeline §17).
- **Kriegsmarine:** 2 Torpedo Boats (S-boats) at Calais. In 1940 they came from Ostend and Flushing and sank the destroyer Wakeful.

The UK starts with a few more units than Germany but far fewer guns and tanks, and most of its army is foot soldiers it means to take home.

### How it plays

- **The arithmetic:** a Landing Craft carries 2 units and makes a round trip every two days (load and cross one day, sail back the next), so it brings home about 1 unit a day. Six craft over 8 days can carry about 45 at best, before losses. The UK can build more at Dover and Ramsgate (12,000 each), but its income is small.
- **The UK's dilemma:** every Infantry on a boat is one fewer on the canal. The vehicles and guns don't count, so they're the natural rearguard, as in 1940, when the guns were spiked and the lorries burned.
- **Germany's choices:** break the perimeter and take Dunkirk (an outright win), or let the Luftwaffe sink the boats and run the clock down. The Bombers do 95% to a Landing Craft (03-combat §5c) and can't be fought off by the boats, only by RAF Fighters and the Destroyers' AA.
- **Without the Halt Order** the panzers on the Aa are 4 squares from Bergues on day 1. The UK's first turns go to holding the west flank and blowing the canal bridges.

### Fog of war

Off by default, and the player chooses (19-fog-of-war §1). Both sides knew where the other was; what mattered was weather and guns, not surprise.

### Turn order

The UK moves first, as the Allies do on every built-in map. Day 1 is **28 May**.

### Weather

**Summer**, following the 1940 days:

| Day | Date | Weather | Why |
|---|---|---|---|
| 1 | 28 May | Rain | Low cloud and rain kept the Luftwaffe away most of the day |
| 2 | 29 May | Clear | Heavy raids in the afternoon |
| 3 | 30 May | Rain | Mist and the smoke of the burning oil tanks |
| 4–8 | 31 May – 4 June | Clear | Clear skies; on 1 June the Luftwaffe's heaviest day |

Rain gives fog of war for the day and makes every unit see 1 square less (12-weather §3a), which hides the boats from the Bombers.

### Build lists

- **United Kingdom:** Destroyer, Landing Craft (the personnel ships and little ships), Torpedo Boat; Fighter, Bomber. No land units: it has no factory, and none is offered. No Battleship, Carrier, Submarine or Supply Ship.
- **Germany:** Infantry, Assault Infantry (the pioneers), Mortar Team, Recon, Halftrack, Light and Medium Tank, Artillery, Mobile AA, Flak Gun; Fighter, Bomber; Torpedo Boat (at Calais). No Heavy Tank, Tank Destroyer or Rocket Artillery (none in 1940), and no Dive Bomber (no Stuka art).

### Victory

- **United Kingdom:** evacuate **15 foot units** (`evacuateUnits`, below), about 60% of the 24 it starts with. Or capture Saint-Omer.
- **Germany:** still be in the game when **day 9** starts (`surviveDays`): 5 June, the day after Dunkirk fell. Or capture **Dunkirk**, the UK HQ (`hqCapture`).
- Rout as usual. Resign is always available.

### The `evacuateUnits` victory condition (new, decided 2026-11-20)

Recorded in 04-economy §8, where the victory conditions live. In short:

```json
{ "type": "evacuateUnits", "side": "allies", "count": 15,
  "unitTypes": ["infantry", "assaultInfantry", "mortarTeam"],
  "zone": [{ "x": 3, "y": 2 }, "…every land square of England…"] }
```

- **The zone** is a list of squares; the generator lists every land square of England.
- **A unit is evacuated** when one of the side's land units **ends up on a zone square** by any means: unloaded from a Landing Craft (the usual way), moved there, or dropped from a Transport Aircraft. It's **removed from the map** at once and **counted**. It came home, so it isn't a loss (04-economy §8a).
- **Only the listed unit types count.** On Dunkirk, only foot soldiers: the army came home without its guns and vehicles. A Light Tank shipped to Dover is removed but not counted. Leaving out `unitTypes` counts every land unit.
- **Any HP counts as one unit**: a 1-HP Infantry counts the same as a full one.
- **A unit built on a zone square** doesn't count: it never left. (On Dunkirk none can be, as the UK has no factory.)
- **Checked after each command.** The moment the count reaches the target, the side wins, as with `captureProperties`.
- **Allies count together**, as ownership does for the other conditions: on a 2-vs-2 map, units of either Allied player add to the same count.

### Computer opponent

- **As Germany** (the default) the computer needs nothing new: it attacks toward Dunkirk, a capture objective (09-ai §4i), and its Bombers hit ships.
- **As the UK** it needs an **evacuation goal** (09-ai, new): foot units score for moving toward an empty Landing Craft on a beach or port; a loaded Landing Craft scores for moving toward the zone and unloading onto it; an empty one heads back to the nearest beach with foot units waiting. Vehicles and guns get no pull to the beach. Without this the computer won't evacuate at all, and self-play can't test the map.

### Art

- **Flooded fields** (Salt Marsh in this map's art): green-brown fields under still, grey water with drowned hedgerows and a farm roof. A per-map tile like the desert season (08-art-pipeline §21).
- **The UK's Landing Craft** is drawn as an LCT, which didn't exist until late 1940. A "little ship" (a motor yacht or paddle steamer) for this map is optional extra art.
- **German tanks** are drawn as later models; Panzer II, Panzer 38(t) and Panzer III art is optional.
- **The RAF Bomber** is drawn as a Lancaster, as on the Battle of Britain map (20-scenarios-battle-of-britain §2).
- **The evacuation** shown on screen: the evacuated unit marches off its square and fades, with "Evacuated" floating over it; the HUD shows "Evacuated 7 / 15" for both players; the zone is shaded on the map like objectives; the results screen adds "Evacuated ×15" under the losses.
- **The map select** features soldiers wading out from the beach to a small boat, with destroyers offshore.

### How it's made

`tools/maps/dunkirk.mjs` generates the scenario from real longitude and latitude points, as for the Battle of Britain map, with the Channel squeezed so the crossing is 6 squares. It lists the zone. `tools/maps/overview.mjs dunkirk` draws the overview picture.

### Build order

1. **Engine:** the `evacuateUnits` condition: type, file parsing and checks, the count kept per side in `GameState`, removal and an `unitEvacuated` event; the self-play state checker learns the count.
2. **Presentation:** the HUD counter, zone shading, the march-off animation, the results line.
3. **AI:** the evacuation goal above.
4. **Map:** generator, scenario file, overview picture, flooded-fields tile.
5. **Checks:** `npm run check`, then `npm run selfplay` on Dunkirk and every other map. Tune the target and the forces from computer-vs-computer results.

### Tests to write

Rule tests (04-economy §8):
- "A foot unit unloaded onto an evacuation square is removed and counted"
- "A unit that walks onto an evacuation square is evacuated too"
- "A unit type not in the list is removed but not counted"
- "With no unit types listed, every land unit counts"
- "A 1-HP unit counts as one unit"
- "The side wins the moment its count reaches the target"
- "An evacuated unit isn't counted as a loss"
- "An enemy unit on an evacuation square isn't evacuated"
- "A unit built on an evacuation square isn't evacuated"
- "Allies add to the same count"
- "A file is refused if the count is under 1, the zone is empty, or a listed unit type doesn't exist"

Scenario tests ("Dunkirk"):
- "The UK wins by evacuating 15 foot units"
- "Germany wins at the start of day 9"
- "Germany wins by capturing Dunkirk"
- "The UK starts with 24 foot units, so 15 is about 60% of them"
- "The UK can't build land units"
- "A Landing Craft can sail from every beach in the perimeter to Dover or Ramsgate in one day"
- "Route Z passes within range of the German Artillery at Calais"
- "Every bridge on the Bergues–Furnes canal is a Major Bridge"
- "No German land unit can reach Dunkirk across the flooded polders"
- "The weather follows 28 May to 4 June: rain on days 1 and 3"
- "The computer plays only Germany by default"

## 2. Known gaps

- **No Halt Order** (developer decision, 2026-11-20): the German armour attacks from day 1, which makes the map harder for the UK than 1940 was. The target of 15 is set with that in mind.
- **No night.** Most of the lift after 1 June sailed at night, out of the Luftwaffe's reach; here every day is the same. Rain days are the only cover.
- **No France nation.** The French rearguard is drawn British, and the 40,000 French soldiers left behind aren't a separate count.
- **Little ships aren't their own unit.** The Landing Craft stands for everything from a destroyer's whaler to a cross-Channel steamer. Destroyers carried most of the men in 1940 but carry nobody here.
- **The Lille pocket** (the French First Army, which held seven German divisions until 31 May) is off the map to the south.
- **The Mole and the beaches load the same.** In 1940 the Mole took far more men a day than the beaches.
- **Balance is a first guess**, untested.
