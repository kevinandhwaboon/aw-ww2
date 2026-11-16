# Topic Doc 17: Market Garden Scenarios

**Status:** designed (v0), not built yet. Balance untested.
**Last updated:** 2026-11-15
**Depends on:** 00-master-design.md §8, 01-units.md (availability rule), 02-terrain.md §4a (Major Bridges), 04-economy-production.md §8 (victory conditions), 05-supply-transport.md §6 (Transport Aircraft drops).

---

## 1. Market Garden (`market-garden`)

### Why this map

At the developer's request, this is the next map after Kursk, and smaller than it. It fills three gaps in the built-in maps:
- No map so far is built around **airborne drops**. Transport Aircraft exist but no map depends on them.
- No map so far is led by **British** forces.
- No map so far makes **rivers and bridges** the thing being fought over. That needs the new Major Bridge rule (02-terrain §4a).
- No map so far has **two players on one side**. Here the US and the UK are separate Allied players (§1 "Players"). The UK gets its own sprites and battle scenes for this map (§1 "How it's made").

### The history it follows

In September 1944 Montgomery tried to end the war by Christmas by jumping the Rhine. **Market** was the largest airborne drop yet: the US 101st Airborne near Eindhoven, the US 82nd at Grave and Nijmegen, and the British 1st Airborne, with a Polish brigade, at Arnhem. They were to seize the bridges over a chain of canals and rivers. **Garden** was the British XXX Corps, which was to drive 100 km up a single road from the Belgian border and cross on those bridges, reaching Arnhem in two to four days.

The Germans blew the Son bridge as the 101st reached it, and the advance waited a night for a Bailey bridge. Grave and the Heumen canal bridge were taken intact. The Nijmegen road bridge held out until 20 September, when US paratroopers crossed the Waal in boats under fire. At Arnhem the 1st Airborne landed 10 km from its bridge, out of fear of the flak around it. Only one battalion reached the bridge, and the Oosterbeek railway bridge was blown in its face. Two SS panzer divisions were refitting nearby. The battalion at the bridge held it for four days. XXX Corps, attacked all along "Hell's Highway", never got past the polder north of Nijmegen. On 25 September what was left of the 1st Airborne was ferried back south across the Rhine.

### Area and scale

- **32 × 44 squares**, about 2.8 km each, with north up and even scale.
- It runs from Leopoldsburg in Belgium (south) to Apeldoorn (north), and from 's-Hertogenbosch (west) to Kleve and Doetinchem in Germany (east). That is roughly 5.20°E to 6.40°E and 51.10°N to 52.22°N.
- It's generated from real longitude and latitude, like Bastogne.
- From Neerpelt to Arnhem is about 36 squares along the road: six to seven days for a Medium Tank (move 6) with nobody in the way.

### Players

Three players, in this turn order:

1. **US** (Allies): the 101st and 82nd Airborne. They move first, as the drops came in about an hour before XXX Corps attacked. That also keeps the US first and army green, as on every other built-in map.
2. **UK** (Allies): XXX Corps, the 1st Airborne and the Polish brigade.
3. **Germany** (Axis).

- **Each Allied player has its own funds, properties and build list.** The US earns from the towns its paratroopers take. The UK earns from Belgium and from what XXX Corps and the 1st Airborne take. An ally's property can't be captured (04-economy §3, by side).
- **The US has no HQ.** It's out only if every US unit is destroyed. If the UK loses its HQ, the UK is out and the US plays on alone (04-economy §8).
- **Victory is by side** (04-economy §8): an objective held by either Allied player counts for the Allies.
- **An ally's property repairs and resupplies your units**, paid from your own funds (04-economy §5, decided 2026-11-15). So XXX Corps tanks can refuel and repair in a town US paratroopers took, which makes linking up with them worth something.
- **By default the computer plays everyone not on the first player's side** (09-ai §5, decided 2026-11-15). So one person plays both the US and the UK against a computer Germany. The map select's "Computer plays …" boxes still allow any mix, such as two people playing co-op as the US and the UK.

### Places

| | US | UK | Germany | Neutral |
|---|---|---|---|---|
| HQ | none | Leopoldsburg (XXX Corps' assembly area) | Doetinchem (II SS Panzer Corps) | |
| Factories | | Lommel | Kleve, Ede, 's-Hertogenbosch | **Eindhoven** (the Philips works) |
| Airfield | US airfield, south-west corner | UK airfield, south-west corner | Deelen | |
| Cities | | Neerpelt ("Joe's bridge" bridgehead) | **Arnhem**, **Nijmegen**, Valkenswaard, Best, Elst, Venlo, Apeldoorn | Son, Veghel, Uden, Grave, Oss, Groesbeek, Oosterbeek, Wageningen, Helmond |

Objectives are in **bold**. The two Allied airfields stand for the bases in England, like Iwo Jima's Marianas airfield.

- **Income:** the US starts with 1 property and the UK with 4, against Germany's 12, so the Allies start far poorer. The neutral Dutch towns lie under the drop zones, though. Paratroopers who capture them swing the income within a few days, mostly to the US. Eindhoven is a neutral Factory, so whoever takes it can build halfway up the road. If the US takes it, US paratroopers get a place to build on the ground.
- Germany starts owning Arnhem and Nijmegen, as it did, with small garrisons and flak.

### Rivers and bridges

From south to north, every waterway crosses the road, so every few squares the advance meets a crossing.

| Waterway | Crossing on the main road | Kind | What happened |
|---|---|---|---|
| Meuse–Escaut canal | Neerpelt (Joe's bridge) | Bridge | Already held by XXX Corps |
| Wilhelmina canal | Son | **Major Bridge** | Blown by the Germans, rebuilt as a Bailey bridge |
| Wilhelmina canal | Best (side road) | **Major Bridge** | Blown |
| Zuid-Willemsvaart canal | Veghel | **Major Bridge** | Taken intact |
| Maas | Grave | **Major Bridge** | Taken intact |
| Maas–Waal canal | Heumen | **Major Bridge** | Taken intact |
| Waal | Nijmegen road bridge | **Major Bridge** | Taken intact on 20 September |
| Nederrijn | Arnhem road bridge | **Major Bridge** | Held by the British at its north end for four days |
| Nederrijn | Oosterbeek railway bridge | **Major Bridge** | Blown in front of the British |
| Maas | Venlo | Bridge | Germany's route from the south-east |
| IJssel | Doesburg, Zutphen | Bridge | Germany's routes from the east |

- The Major Bridges are the bridges whose fate decided the battle. The other crossings, which are mostly Germany's own reinforcement roads, are ordinary Bridges that can't be blown.
- Rivers are one square wide. Blowing a one-square bridge cuts it.
- The main road ("Hell's Highway") runs Neerpelt, Valkenswaard, Eindhoven, Son, Veghel, Uden, Grave, Nijmegen, Elst, Arnhem. There are a few side roads, but no other way north across the rivers without a bridge.
- Germany can reach Nijmegen from Kleve along the south bank of the Waal. So even with the Arnhem bridge blown, Germany can reinforce Nijmegen, as the 10th SS did by ferry at Pannerden.

### Terrain

- Mostly **Plains**: flat Dutch and Belgian farmland and polder, so the rivers, not hills, make the map.
- **Forest:** the Reichswald east of Groesbeek, the wooded Veluwe north and west of Arnhem and Oosterbeek, the Peel east of Helmond, and patches of Belgian heath and pine in the south.
- **Hills:** only the Groesbeek heights, which the 82nd had to hold, and the low ridge along the Nederrijn at Oosterbeek and Wageningen.
- **The Island** (the Betuwe, between the Waal and the Nederrijn) is open plain with only the main road through Elst. Historically tanks on its raised road were easy targets. There is no dyke terrain to show that (see Known gaps).

### Starting forces

All units are first guesses, scaled to the map as on the other maps.

The first-lift Transport Aircraft start loaded, short of the drop zones and out of flak range. Each player makes its drops on turn 1, and so chooses how close to the bridges to drop.

- **US** (2,000 funds):
  - **101st Airborne:** two Transport Aircraft south-west of Son, carrying three Infantry and a Mortar Team.
  - **82nd Airborne:** two Transport Aircraft south-west of Grave, carrying three Infantry and an Assault Infantry.
  - **Second lift:** a Transport Aircraft on the US airfield carrying two Infantry (the glider infantry).
- **UK** (6,000 funds):
  - **XXX Corps** in the Neerpelt bridgehead: four Medium Tanks (Guards Armoured Shermans), a Light Tank, a Recon (Household Cavalry), two Artillery, two Halftracks each carrying Infantry, two Infantry, two Assault Infantry (Royal Engineers with bridging gear) and a Mobile AA.
  - **1st Airborne:** two Transport Aircraft over the heath west of Oosterbeek, carrying two Infantry, an Assault Infantry (1st Parachute Squadron RE) and a Mortar Team. They start about 8 squares from the Arnhem bridge. That's in reach, but dropping next to it leaves the aircraft inside the Arnhem flak's range for Germany's turn: the planners' real dilemma.
  - **Second lift:** a Transport Aircraft on the UK airfield carrying two Infantry (the Polish brigade).
  - Two Fighters on the UK airfield (Spitfires and Typhoons).
- At move 8 the second-lift aircraft reach Nijmegen around day 3 and Arnhem around day 4. Historically the second lift came on day 2 and the Poles on day 5.
- **Germany** (3,000 funds):
  - **Kampfgruppe Walther** across the road at Valkenswaard: two Infantry, an Assault Infantry, a Tank Destroyer and an Artillery.
  - **59th Division** at Best: two Infantry and an Artillery.
  - **Son:** an Assault Infantry next to the Son bridge, ready to blow it.
  - **Nijmegen** (Kampfgruppe Henke): an Infantry, an Assault Infantry by the road bridge and a Flak Gun.
  - **Arnhem and Oosterbeek:** an Infantry and a Flak Gun in Arnhem. An SS training battalion, an Infantry and a Mortar Team, near Oosterbeek, where Krafft's battalion stopped the 1st Airborne's march.
  - **Deelen:** a Flak Gun and two Fighters.
  - **9th SS Hohenstaufen**, north-east of Arnhem: a Recon (Gräbner's battalion, which drove south over the Arnhem bridge and came back), two Halftracks carrying Assault Infantry, a Medium Tank, an Artillery and a Mobile AA.
  - **10th SS Frundsberg**, toward Doetinchem: a Medium Tank, two Infantry, an Assault Infantry and an Artillery.
  - **The Reichswald** (Corps Feldt) at Kleve: two Infantry and a Light Tank.
  - **15th Army** at 's-Hertogenbosch: two Infantry.

### Weather

- Clear all game. In reality, fog over England held up the later lifts and air support, but the game has no weather that grounds aircraft yet (12-weather).

### Build lists

- **US** (airborne): Infantry, Assault Infantry, Mortar Team and Recon (airborne jeeps), plus Fighter (the P-47s that flew support) and Transport Aircraft. No tanks or artillery: the airborne divisions had none.
- **UK:** every land unit except the Heavy Tank and Rocket Artillery (01-units §7a), plus Fighter, Bomber and Transport Aircraft.
- No ships for anyone: there's no sea on the map.
- **Germany:** every land unit, including the Heavy Tank (the Tigers of Heavy Panzer Battalion 506 arrived during the battle) and the Flak Gun, plus the Fighter. No Bombers.

### Victory

- **Allies win by holding Eindhoven, Nijmegen and Arnhem together for 2 days in a row** (`holdProperties`). That's Montgomery's carpet from the border to the Rhine. Holding, not just capturing, gives Germany a chance to counterattack. Without it the paratroopers alone could take the three towns before XXX Corps arrives.
- **Germany wins by holding out to the start of day 12** (`surviveDays`). The real battle lasted 9 days.
- **Both sides** also win by capturing the enemy HQ or destroying every enemy unit (`hqCapture`, `rout`).
- The Allies don't need the bridges intact to win. Paratroopers can take Arnhem from the north bank, as the 1st Airborne tried to. But without the bridges, tanks, artillery and supply can't reach them, so the towns are hard to hold for 2 days.

### Computer opponent

- The Greedy AI already handles Transport Aircraft (09-ai §4b), so it can make the first-lift drops.
- **It doesn't yet know about blowing and rebuilding bridges.** A first rule, to be finalized in 09-ai when built:
  - **Blow** a Major Bridge if an enemy land unit could cross it next turn and none of our land units needs it within the next two turns.
  - **Rebuild** a Blown Bridge if one of our land units that can't cross is waiting within a turn of it.
  - Weights live in `src/ai/weights.ts` like every other AI score.
- AI vs AI must end within the day limit on every game (day 12 at the latest), with no AI bug, as on Iwo Jima and Midway (09-ai §7).

### How it's made

- `tools/maps/market-garden.mjs` will generate the scenario file from real longitude and latitude for towns, rivers, canals and forests, the same way as `bastogne.mjs`. `tools/maps/overview.mjs market-garden` will draw `docs/maps/market-garden.png`.
- **Art needed:**
  - A Major Bridge (a steel truss bridge, visibly different from the ordinary Bridge, in the same road and river pieces) and a Blown Bridge (fallen spans in the river), each in summer and winter sheets (08-art-pipeline §14, §21).
  - **UK art**, for every unit type the UK can field (the availability rule, 01-units §1), as the US, Germany, Japan and the Soviet Union have: map sprites with front, back and side views (08-art-pipeline §17, §22) and battle-scene figures and models (§18). Examples: Tommy with a Brodie helmet and Lee-Enfield, red-beret paratroopers (the UK's version of the US paratrooper look), PIAT team, 3-inch mortar, Daimler armoured car, Universal Carrier, Stuart, Sherman Firefly, Achilles tank destroyer, 25-pounder, Crusader AA, Spitfire, Lancaster, Dakota, and the Churchill for maps that offer the Heavy Tank. The UK also needs its own color, so a US player and a UK player don't wear the same one (08-art-pipeline §12). Canada can keep borrowing the UK art.
  - Until the UK art exists, the UK player uses the US art in a slot color (08-art-pipeline §12).

### Build order

0. **Two players on a side:** repair on an ally's property (04-economy §5) and the computer playing the other side by default (09-ai §5).
1. **Engine:** Major Bridge and Blown Bridge terrain data, Blow Bridge and Rebuild Bridge commands, rebuild progress in `GameState`, legal commands for both. The self-play state checker learns that rebuild progress exists only under an Assault Infantry.
2. **Presentation:** bridge art, the two action menu items, tile info lines, the explosion and the rebuild cue.
3. **Map:** the generator, the scenario file and its overview picture.
4. **AI:** the blow and rebuild rule above.
5. **Checks:** `npm run check`, then `npm run selfplay` on Market Garden and every other map.

### Tests to write

Rule tests (02-terrain §4a):
- "Assault Infantry on a Major Bridge can blow it, and it becomes a Blown Bridge"
- "Infantry can't blow a bridge: only Assault Infantry carries charges"
- "An ordinary Bridge can never be blown"
- "Blowing a bridge needs the Assault Infantry standing on it, not next to it"
- "A Major Bridge can't be damaged by fire, so no unit can attack it"
- "Vehicles can't enter a Blown Bridge, but soldiers can wade it as a River"
- "Assault Infantry rebuilds a Blown Bridge like a capture: 20 points, its HP each turn"
- "A full-strength Assault Infantry rebuilds a bridge in two turns"
- "Rebuild progress is lost when the Assault Infantry leaves"
- "A rebuilt bridge is a Major Bridge again and can be blown again"
- "Snow costs on a Blown Bridge are the River's"
- "Blowing a bridge isn't a kill"

Scenario tests ("Market Garden"):
- "The Allies win by holding Eindhoven, Nijmegen and Arnhem for 2 days, whichever Allied player holds each"
- "The US plays on after the UK loses its HQ"
- "The US moves first, then the UK, then Germany"
- "A British tank in a US-held town is repaired at the UK's cost" (04-economy §5)
- "The computer plays only Germany by default" (09-ai §5)
- "Germany wins at the start of day 12"
- "Every crossing on the road from Neerpelt to Arnhem is a Major Bridge"
- "Germany's reinforcement crossings at Venlo, Doesburg and Zutphen can't be blown"
- "Every first-lift Transport Aircraft starts out of German flak range"
- "Allied tanks can drive from Neerpelt to Arnhem with every bridge standing"
- "With the Waal bridge blown, Allied tanks can't reach Arnhem"

## 2. Known gaps

- Balance is a first guess: starting funds, the 2-day hold, the day 12 limit, Germany's 12 starting properties and the size of the first lift all need playtesting.
- **No gliders** (deferred, 01-units §7), so the airborne divisions' jeeps and anti-tank guns aren't on the map.
- **No dyke terrain:** the Island's raised roads, where tanks were easy targets, play as ordinary road and plain.
- **No weather that grounds aircraft:** the fog that delayed the later lifts isn't modeled.
- **The Polish brigade** is folded into the UK player. There is no Polish nation.
- **One person playing two Allied players** takes two turns a day. With the pass-the-device screen on, it shows between the US and UK turns too. It can be turned off on the map select.
- **No ferries:** the Driel ferry and the evacuation across the Rhine aren't possible except by wading the Blown Bridge or a river as foot soldiers.
