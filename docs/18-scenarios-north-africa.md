# Topic Doc 18: North Africa Scenarios

**Status:** built (v0) on 2026-11-15. Balance untested.
**Last updated:** 2026-11-15
**Depends on:** 00-master-design.md §6 and §8, 01-units.md (availability rule), 02-terrain.md §4 and §4b (Minefield, Ridge, Salt Marsh), 03-combat.md §4 (attacking fortifications), 04-economy-production.md §5 and §8 (ally repair, victory conditions), 08-art-pipeline.md §21 (seasons).

---

## 1. Second El Alamein (`el-alamein`)

![Overview](maps/el-alamein.png)

Sand is open desert, brown squares are minefields, tan squares ridges, white the salt marsh of the Qattara Depression, grey bunkers. Army green properties are the UK's, red the Axis's (German or Italian). The inner mark shows the kind: yellow factory, white airfield, black HQ. Dark squares are starting units.

### Why this map

At the developer's request, the first North Africa map. Second El Alamein was chosen over Gazala, Crusader, Kasserine and Torch. It fills these gaps in the built-in maps:
- No map so far is in the **desert**. It needs a desert art season (§1 "Art") and three new terrains (02-terrain §4b).
- No map so far is a **set-piece breakthrough through minefields**, cleared square by square by sappers.
- **Italy** joins the Axis as a nation, as the second Axis player (§1 "Players"). For now it borrows Germany's art.
- No map so far has the attacker's enemy **starved of fuel**.

### The history it follows

By October 1942 the Axis advance on Egypt had stopped 100 km west of Alexandria, at the railway halt of El Alamein. Here the desert narrows to a 65 km neck between the sea and the **Qattara Depression**, a sunken salt marsh that tanks couldn't cross. There was no open flank to go round, unlike every earlier desert battle. Panzerarmee Afrika, about half German and half Italian, dug in behind two belts of mines, the "Devil's Gardens", about half a million mines in all, with infantry strongpoints between them. Its armour waited behind, in German and Italian pairs in the north and south. Its fuel ran low as British aircraft and submarines sank the tankers crossing from Italy.

Montgomery's **Eighth Army** was British, Australian, New Zealand, South African and Indian, with a Free French and a Greek brigade. It outnumbered the Axis about two to one in men and tanks and had plenty of fuel. On the night of 23 October (**Operation Lightfoot**) a barrage from about 880 guns opened, and infantry with sappers cleared two corridors through the mines in the north, with the armour following behind. A diversion went in in the south, where the Free French attacked Himeimat. A week of grinding followed around Kidney Ridge and along the coast, where the Australians pushed north. On 2 November **Operation Supercharge** broke through at Tel el Aqqaqir. The Axis had too little fuel to move its armour or get it away. On 4 November Rommel ordered the retreat west along the coast road.

### Area and scale

- **36 × 32 squares**, about 3 km wide and 3.3 km tall each, with north up.
- It runs from El Daba (west) to El Hammam (east), and from the coast (north) to the Qattara Depression (south). That is roughly 28.35°E to 29.45°E and 30.15°N to 31.10°N.
- It's generated from real longitude and latitude, like Bastogne and Market Garden.
- From the second minefield belt to El Daba is about 10 squares along the coast road: two days for a Medium Tank (move 6) once through the mines, with nobody in the way. The Depression fills the bottom five rows.

### Players

Three players, in this turn order:

1. **UK** (Allies): the whole Eighth Army. The Australian, New Zealand, South African and Indian divisions and the Free French and Greek brigades are folded in, as the Poles are on Market Garden. Its units are drawn with the UK art.
2. **Germany** (Axis): the Afrika Korps (15th and 21st Panzer), the 90th and 164th Light Divisions, and the Ramcke paratroop brigade.
3. **Italy** (Axis): the Littorio and Ariete armoured divisions, the Trieste and Trento motorized divisions, the Bologna, Brescia and Pavia infantry divisions, and the Folgore paratroopers.

- **The Allies move first,** as on every built-in map, and they're the attacker here. Allied players stay the first player and army green.
- **Each Axis player has its own funds, properties and build list.** An ally's property repairs and resupplies your units at your cost (04-economy §5). So Italian tanks refuel in German-held places and the other way round, as the mixed German and Italian line did.
- **Italy has no HQ.** It's out only if every Italian unit is destroyed (as the US on Market Garden).
- **By default the computer plays Germany and Italy** (09-ai §5), so one person plays the Allies with one turn a day.

#### Why the Free French are folded in

The Free French at El Alamein were two brigades (about 5,000 men) and a flying column, out of an Eighth Army of about 195,000. They took part in XIII Corps' diversion in the south: on the night of 23 October they attacked the Himeimat heights, were thrown back by the Folgore and German armour, and lost Lieutenant-Colonel Amilakhvari. It was a brave but small part of the battle, so a separate Free French player would add a second Allied turn every day for a brigade's worth of units. The Commonwealth divisions were a much bigger share (four of the ten divisions and about half the infantry), so the "UK" player is really the Eighth Army. A Free French nation, borrowing the UK art like Canada, can be added later if a map needs it (Bir Hakeim at Gazala would).

### Italy as a nation

- **New nation `italy`**, on the Axis side, named "Italy".
- **It borrows Germany's art** for now (`ART_LOANS`, as Canada borrows the UK's). Italian units look like German ones. Its own art is a later session (§2).
- **Color:** blue, Italy's azzurro (as built, 2026-11-15). Borrowing Germany's color too would have made Germany and Italy match, so by the usual rule both would have lost their color and Germany would no longer wear field grey. Germany's sheets already come in blue, so no new art was needed. Italy can get a color of its own with its own art.
- **Flag (HUD and capture flag):** a plain green, white and red vertical tricolour. Never the Savoy crest of the wartime flag, and never the fasces (00-master-design §6).
- **Unit types it fielded** (availability rule, 01-units §1): Infantry, Assault Infantry (the *guastatori* combat engineers), Mortar Team, Recon (AB 41 armoured car), Halftrack (standing in for its trucks), Light Tank (L6/40), Medium Tank (M13/40, M14/41), Tank Destroyer (Semovente 75/18, 47/32), Artillery (75/27, 100/17), Mobile AA (truck-mounted 20 mm), Flak Gun (90/53), Fighter (C.202) and Bomber (SM.79). No Heavy Tank, no Rocket Artillery, no carrier aircraft. It had a navy, but this map has no ships.

### Places

| | UK | Germany | Italy |
|---|---|---|---|
| HQ | El Hammam (Eighth Army's rear) | El Daba (Panzerarmee's rear) | none |
| Factories | El Imayid (the railhead dumps), El Alamein station | Ghazal station | Bab el Qattara |
| Airfields | Two landing grounds near the east edge (the Desert Air Force) | El Daba | |
| Cities | Alam Halfa, Deir el Ragil, Samaket Gaballa, Ruweisat Station | Sidi Abd el Rahman, Tel el Mampsra | Deir el Qatani, El Mreir, Qaret el Abd |

- **El Daba**, Germany's HQ, is the Allied objective.
- **Few real towns:** the desert inland had almost none. Most properties stand for supply dumps, camps and railway halts, drawn as towns.
- **Income:** the UK starts with 9 properties, Germany 5 and Italy 4, so the Allies earn as much as both Axis players together (9,000 a day each side) and start with more units (43 against 38). That stands for the buildup from Alexandria.
- **No neutral properties:** every square of the neck was held, as at Kursk.

### The front, 23 October 1942

- The Axis forward edge runs from **Tel el Eisa** on the coast, south past the west foot of **Miteiriya Ridge** and **Ruweisat Ridge**, through **Deir el Munassib**, to **Qaret el Himeimat** at the edge of the Depression.
- **Two minefield belts** (02-terrain §4b) run the whole length of the front, from the coast to the Depression:
  - The **first belt** is one square deep and unbroken.
  - The **second belt** is one square deep, two squares behind the first. It has three one-square gaps (a quarter, half and three quarters of the way down the front), each with a Bunker just behind it, for Axis counterattacks.
  - Between the belts stand **Bunkers**, the infantry strongpoints: one every third row, six in all.
- The belts are drawn as 4-connected lines, so there's never a diagonal gap. As built they hold 51 squares of mines and 11 Bunkers (two on the coast road, six strongpoints, three behind the gaps).
- **No minefield on a road.** The coast road and railway get a Bunker where they cross each belt instead, and the Australians' push along the coast has to break it.
- **Allied lines** face the belts from two or three squares east, with no mines of their own on the map.

### Terrain

- Mostly **Plains**, drawn as hard desert ("good going"): open tank country.
- **Ridge** (new, 02-terrain §4b): Miteiriya, Kidney, Ruweisat, Alam Halfa and Tel el Aqqaqir. Low ridges a tank could cross, giving hull-down cover. Fought over for days.
- **Hills:** only Qaret el Himeimat, the hill at the south end of the line, which tanks couldn't climb.
- **Salt Marsh** (new, 02-terrain §4b): the Qattara Depression along the south edge, impassable to every land unit, so the line can't be turned.
- **Road:** the coast road (Via Balbia) along the shore, plus the Rahman track and a few desert tracks. The railway runs beside the coast road and is drawn as part of it.
- **Sea** along the north edge. No ports, beaches or ships.
- **Minefields** and **Bunkers** as above.

### Starting forces

All units are first guesses, scaled to the map as on the other maps.

- **UK** (5,000 funds):
  - **XXX Corps**, north (9th Australian, 51st Highland, 2nd New Zealand, 1st South African): six Infantry, three Assault Infantry (the sappers who cleared the corridors), two Mortar Teams, four Artillery (the barrage) and two Medium Tanks (Valentines in infantry support).
  - **X Corps** (1st and 10th Armoured), behind XXX Corps: five Medium Tanks (Shermans, Grants and Crusaders), a Light Tank, two Halftracks each carrying Infantry, a Recon, a Tank Destroyer and a Mobile AA.
  - **4th Indian Division** on Ruweisat Ridge: two Infantry.
  - **XIII Corps**, south (7th Armoured, 44th and 50th Divisions, the Free French): two Medium Tanks, a Light Tank, three Infantry, an Assault Infantry, an Artillery and a Recon.
  - **Desert Air Force:** two Fighters and two Bombers on the landing grounds.
- **Germany** (2,000 funds):
  - **164th Light Division** in the northern line: an Infantry in each of the coast road's two Bunkers, an Infantry in the northernmost strongpoint, and a Mortar Team, beside the Italians.
  - **15th Panzer**, north behind the belts: two Medium Tanks and an Artillery.
  - **21st Panzer**, south behind the belts: two Medium Tanks.
  - **90th Light Division** near Ghazal: two Infantry, an Assault Infantry and a Halftrack.
  - **Ramcke Brigade** in the centre of the line: an Infantry in the middle strongpoint and one behind it.
  - **Anti-tank screen:** two Tank Destroyers (the 88s and Marders) behind the second belt in the north.
  - **El Daba:** a Flak Gun, two Fighters and a Bomber.
- **Italy** (2,000 funds):
  - **Trento, Bologna, Brescia and Pavia** in the line between the belts: four Infantry in the strongpoints, two Mortar Teams and two Artillery behind them.
  - **Littorio**, north behind the belts, paired with 15th Panzer: two Medium Tanks.
  - **Ariete**, south behind the belts, paired with 21st Panzer: two Medium Tanks.
  - **Trieste**, in reserve near Rahman: an Infantry and a Light Tank.
  - **Folgore**, at the south end facing Himeimat: two Infantry and an Assault Infantry.
- **Axis tanks start short of fuel:** Medium Tanks at 12 of 30, Light Tanks at 11 of 28. That's about two full moves, so shifting the armour from south to north costs most of a tank, as it did. Halftracks and owned properties refuel them as usual.

### Supply

No new supply rule. The desert's long supply lines are shown through the map, under the existing rules (05-supply-transport §1, §3):
- **Land units refuel only on owned properties** (or an ally's) **or next to a Halftrack.** There are few properties and they're far apart, so tanks that drive far from them need Halftracks bringing fuel behind them.
- **The Axis starts short of fuel** (above), and has fewer properties and Halftracks than the Allies.
- **The Allies are well supplied:** more properties, more Halftracks, full tanks.
- A capturable **Supply Dump** property (refuels but no income, no repair) was considered and left out: it isn't in the original game, and here the Axis shortage is shown well enough by starting fuel.

### Weather and season

- Clear all game.
- **Desert season** (08-art-pipeline §21, generalized from winter): sand-colored terrain and buildings and sand battle scenes, all game. Art only.

### Build lists

- **UK:** every land unit except the Heavy Tank (only a handful of Churchills fought, as a trial) and Rocket Artillery (01-units §7a), plus Fighter and Bomber.
- **Germany:** every land unit except the Heavy Tank (the first Tigers reached Africa in Tunisia, a month later) and Rocket Artillery, plus Fighter and Bomber.
- **Italy:** the unit types in "Italy as a nation" above.
- No ships and no Transport Aircraft for anyone.

### Victory

- **The Allies win by capturing El Daba**, Germany's HQ (`captureProperties` for the Allies, so it ends the game for the whole Axis at once, Italy included). That is the breakout.
- **The Axis wins by holding out to the start of day 15** (`surviveDays`). The real battle took 12 days.
- **Both sides** also win by capturing the enemy HQ or destroying every enemy unit (`hqCapture`, `rout`). Capturing El Daba as HQ capture alone would only knock out Germany, leaving Italy playing on, which is why the Allied condition is `captureProperties`.

### Computer opponent

- The Greedy AI already attacks fortifications and plans its paths as if breakable ones were gone (09-ai), so it can clear minefields with no new rule.
- **As built, AI vs AI, the Axis always wins** (seeds 1 to 4, all on day 15, with no engine or AI problem): the Allied AI clears only 5 to 7 of the 51 minefield squares, scattered along the belt rather than a corridor, and never gets its armour through. Teaching it to concentrate on a corridor is later AI work (§2).

### Art

- **Desert season** (built as a third season beside summer and winter, with `desertPath` sheets, 08-art-pipeline §21):
  - **Terrain sheet** with the same layout: sand and gravel for grass, pale tracks for roads, low rocky ridges, a dry escarpment for Hills, scrub (camel thorn) where a forest tile would be, sea with pale sand at the shore.
  - **Building sheet:** flat-roofed whitewashed buildings, railway halts, tented camps and dumps. Roofs or awnings keep the owner's color.
  - **Battle scenes:** sand ground and dust, a pale hot sky, no trees.
- **New terrain tiles** in every season sheet (summer, winter, desert): Minefield (wire on pickets with yellow warning triangles), Ridge, Salt Marsh (cracked white salt crust with dark wet patches). As built: 08-art-pipeline §21.
- **Italy** borrows Germany's art for now. Its own art is a later session (§2).
- **UK art** is 1944 equipment (Firefly, Achilles). Desert-era tanks (Crusader, Grant, Valentine) are optional extra art, not needed for v0.

### How it's made

- `tools/maps/el-alamein.mjs` generates the scenario file from real longitude and latitude for the coast, the places, the ridges, the front line and the Depression's edge, as `market-garden.mjs` does. It lays the two minefield belts along the front line, checks that no land route from the Allied HQ to El Daba avoids every mine and Bunker, and checks that every Allied unit starts east of the first belt and every Axis unit west of it. `tools/maps/overview.mjs el-alamein` draws `docs/maps/el-alamein.png`.
- Tests: `tests/desertTerrain.test.ts` (the three terrains and the season) and `tests/scenario.test.ts`, "El Alamein".
- It comes third on the map select, after Market Garden.

### Build order (done)

1. **Engine:** the Minefield, Ridge and Salt Marsh terrain data (02-terrain §4b), map letters for them, and the self-play state checker allowing fortifications on Minefield squares. The `italy` nation.
2. **Presentation:** desert season art (terrain, buildings, battle colors), the three new tiles, Italy's flag and its art loan from Germany.
3. **Map:** the generator, the scenario file and its overview picture.
4. **Checks:** `npm run check`, then `npm run selfplay` on El Alamein and every other map.

### Tests

Rule tests (02-terrain §4b):
- "A minefield blocks every land unit, but aircraft fly over it"
- "A minefield is cleared by attacking it and becomes Plains"
- "Assault Infantry clears a minefield square in two attacks"
- "Clearing a minefield isn't a kill"
- "A ridge gives 2 defense stars and lets tanks cross at 2 movement points"
- "The salt marsh blocks every land unit, but aircraft fly over it"
- "Snow costs on a ridge are the forest's"

Scenario tests ("El Alamein"):
- "The UK moves first, then Germany, then Italy"
- "The computer plays Germany and Italy by default"
- "The Allies win at once by capturing El Daba, and Italy is out with Germany"
- "The Axis wins at the start of day 15"
- "Two minefield belts run unbroken from the coast to the Depression, apart from the second belt's gaps"
- "No minefield lies on a road"
- "No land unit can get round the south end of the line"
- "Every Axis tank starts short of fuel"
- "Italy fields no Heavy Tank or Rocket Artillery"
- "An Italian tank in a German-held town is repaired at Italy's cost" (04-economy §5)

## 2. Known gaps and later work

- **Italian art** (map sprites with front and back views, battle figures and models): Carcano infantry with the M33 helmet, Bersaglieri plumes, *guastatori*, Breda mortar, AB 41, L6/40, M13/40, Semovente 75/18, 75/27, the 20 mm Breda and the 90/53, C.202 and SM.79, plus Italy's own nation color. A follow-up session, as for the UK.
- **Free French** are folded into the UK (§1 "Why the Free French are folded in"). A nation borrowing the UK art can be added for a map where they matter more.
- **No fog of war:** Montgomery's deception plan (Operation Bertram: dummy tanks and a fake pipeline in the south) and the surprise of the night attack can't be shown.
- **No night:** Lightfoot was a night attack under a full moon.
- **The Allied AI doesn't make corridors** (§1 "Computer opponent"), so AI vs AI the Axis always wins.
- **Capture scenes** still show European town squares, factories and harbors behind the sand.
- **Minefields are cleared by attacking them,** like the original's pipe seams, rather than by a sapper action or casualties from crossing them.
- **The Commonwealth** plays under the UK name and art.
- Balance is a first guess: starting funds, the Axis starting fuel, the day 15 limit and the minefield depth all need playtesting.
