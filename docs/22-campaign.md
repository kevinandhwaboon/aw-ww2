# Topic Doc 22: Campaign and Skirmish

**Status:** v0 decided and built 2026-11-20. Every built map is a campaign mission with an advantage for the computer, tuned by self-play to the target (§5): by wins on the maps where AI games finish, by who is ahead on day 20 on the five big maps (§5b). Map AIs on the Battle of Britain (§6c), Gazala (§6d), Midway (§6a) and Ten-Go (§6b).
**Last updated:** 2026-11-20
**Depends on:** 00-master-design.md (§8, §15), 06-commanders.md, 09-ai.md, 11-tech-setup.md §3j. **Feeds:** every scenario doc (each map's campaign setup is listed here, §5).

---

## 1. Two ways to play

The title screen offers **Campaign**, **Skirmish** and, when a game was left unfinished, **Continue**.

- **Skirmish** is the game as it was before this doc: pick any map on the world map, choose who the computer plays (or play a friend on one device), commanders and options. Skirmish maps are balanced by AI vs AI play, so the two sides are roughly even for two equal players. Nothing about Skirmish changed except its name and where it sits in the menu.
- **Campaign** is the player against the computer, always as the **Allies**, on the same maps, in history's order. Because no computer opponent is as good as a careful human, **the computer starts with a numerical advantage** on every mission (§4), and a mission can have an AI written for that map alone (§6).
- A third way, **Survival**, is on the title screen too (23-survival): hold an HQ against growing waves until it falls.

## 2. The missions and their order

One chain in date order, across every theater (decided 2026-11-20). Winning a mission unlocks the next; the first is always open. A mission already won can be played again at any time. Losing a mission just means trying again: there's no penalty and nothing carries over between missions (no units, funds or score).

| # | Mission | When | The computer plays |
|---|---|---|---|
| 1 | Dunkirk | May–June 1940 | Germany |
| 2 | Battle of Britain | August 1940 | Germany |
| 3 | Gazala | May–June 1942 | Germany, Italy |
| 4 | Midway | June 1942 | Japan |
| 5 | Sevastopol | June 1942 | Germany |
| 6 | Guadalcanal | October 1942 | Japan |
| 7 | El Alamein | October 1942 | Germany, Italy |
| 8 | Stalingrad | November 1942 | Germany |
| 9 | The Slot | 1943 | Japan |
| 10 | Kursk | July 1943 | Germany |
| 11 | Normandy | June 1944 | Germany |
| 12 | Market Garden | September 1944 | Germany |
| 13 | Bastogne | December 1944 | Germany |
| 14 | Iwo Jima | February 1945 | Japan |
| 15 | Ten-Go | April 1945 | Japan |

Dunkirk (21-scenarios-dunkirk) went first when it was built, 2026-11-24. A new map joins the chain at its date.

- **Progress** is kept on the device (`localStorage`, `ww2-tactics.campaign`): the missions won, saved the moment a mission is won. It's separate from the autosave, so starting a Skirmish never loses campaign progress, and Continue on a campaign game still counts the win. A mission part-played is kept by the autosave (11-tech-setup §3j), and Continue on the title screen carries it on. The campaign screen says how many missions are won and that progress is saved on this device (since 2026-11-20, at the developer's request).
- A mission counts as won when the game ends with the Allies among the winners.

## 3. Who plays what

- **The player plays every Allied player**, the computer every Axis player. On Market Garden (US and UK) and Gazala (UK and Free France) one person plays both Allied players, as Skirmish already does by default.
- **Commanders:** the player picks one for each Allied player (or none), as in Skirmish. **Each mission gives the computer a fixed commander** for each Axis player, as part of its advantage (§5).
- **Options:** Luck in combat and Battle scenes are the player's choice. Fog of war is the map's own setting (always on where the map says so, 19-fog-of-war §1, otherwise off). The pass-the-device screen is off: there's only one person. The computer always plays at Normal: the mission's setup is the difficulty, and there's no Easy/Normal/Hard choice (decided 2026-11-20: one hand-tuned setup per mission is simpler to balance and test).

## 4. The computer's advantage

The advantage is all in **the starting setup**, never in rule exceptions: the computer still follows every rule, sees only what its units see in fog of war, and gets no hidden information (09-ai §1, §3; decided 2026-11-20, "it must scout"). Each mission can give the Axis any mix of:

- **Extra units**, placed on the map like the scenario's own (including aboard transports and Carriers).
- **Extra properties**: properties that start the Axis's instead of neutral or the Allies'.
- **Extra funds** at the start.
- **More income**: a percentage on each Axis player's daily income, through the modifier layer (the `income` stat).
- **A commander** for each Axis player (§3).

The campaign never changes the map's terrain, its victory conditions or the Allies' starting forces, so the battle stays the one the scenario doc describes, with a stronger enemy.

The data is in `src/campaign/missions.ts`, one entry per mission, with no logic: balancing is a data edit. `src/campaign/setup.ts` turns a mission into the game's setup, and checks it (every extra unit on a free square it can stand on, every extra property a real property).

## 5. How each mission is tuned

**Target (decided 2026-11-20): the standard AI playing the Allies wins about one game in four** against the campaign setup and the computer's own AI. A careful human plays far better than the standard AI, so a human should win most missions with some thought, and lose when careless.

Measured with `npm run selfplay -- --campaign` (09-ai §7), which plays the campaign setups with the standard AI as the Allies and the campaign's AI as the Axis, and reports the Allied win rate. Maps where AI vs AI games don't finish (Normandy, Kursk, The Slot, Bastogne: the AIs stall) can't be measured that way; they get a first-guess advantage in proportion to the others, marked "untested" below.

| # | Mission | Axis commander | Advantage | Result (measured 2026-11-20): Allied AI wins, or who is ahead on day 20 |
|---|---|---|---|---|
| 1 | Dunkirk | Konrad Falk | +5,000 funds; +25% income. A first guess; extra units may come once the map's layout settles | 3 of 8 (Skirmish: 12 of 20) |
| 2 | Battle of Britain | Kenji Arakawa | Sea Lion's first wave ashore inland of Hythe (4 Infantry, an Assault Infantry, 2 Medium Tanks, an Artillery, a Flak Gun); a fourth barge at Ostend loaded with an Infantry and a Medium Tank; Maidstone's factory and four Kent towns start German; +4,000 funds; +25% income; the Sea Lion plan (§6c) | 5 of 20 |
| 3 | Gazala | Jakob Wendt (Germany), Aldo Ferrante (Italy) | More for the sweep round Bir Hakeim: 4 Medium Tanks, 5 Halftracks carrying Infantry and 2 Supply Trucks for Germany, a Medium Tank and 2 Halftracks carrying Infantry for Italy; +3,000 and +2,000 funds; +25% income; Rommel's sweep (§6d). Not Falk, whose units carry 20% less fuel: here fuel decides the battle | 4 of 20 |
| 4 | Midway | Kenji Arakawa | The invasion force's oiler (a Supply Ship) and a fourth Landing Craft with an Infantry; the Midway plan (§6a) | 4 of 20 |
| 5 | Sevastopol | Jakob Wendt | +4,500 funds; +45% income | 4 of 20 |
| 6 | Guadalcanal | Isao Kuramochi | Two Infantry and an Artillery already ashore at Koli Point, east of Henderson Field | 6 of 20 |
| 7 | El Alamein | Konrad Falk, Aldo Ferrante | None: the Axis already wins every AI game (the Allied AI doesn't clear a corridor, 18-scenarios-north-africa §1) | 0 of 12 |
| 8 | Stalingrad | Jakob Wendt | +3,000 funds; +25% income | Ahead on day 20: the computer 7 of 8 (6 of them Axis wins by day 12) |
| 9 | The Slot | Kenji Arakawa | A Battleship and a Destroyer more off Japan's home island. Not Kuramochi: his ships' +20% put Japan ahead in 8 of 8 even with no other advantage | Ahead on day 20: the computer 10 of 12 (Skirmish: 3 of 8) |
| 10 | Kursk | Konrad Falk | +5% income, to make up for Falk's short fuel (with him alone, 4 of 8; with +10%, 8 of 8) | Ahead on day 20: the computer 9 of 12 (Skirmish, no commanders: 6 of 8) |
| 11 | Normandy | Jakob Wendt | The panzer reserve by Caen at once (a Heavy Tank, 2 Medium Tanks, 2 Infantry, an Artillery); +5,000 funds; +50% income, since Normandy is a production race and the Allies hold 36 properties to Germany's 19 | Ahead on day 20: the computer 9 of 12 (Skirmish: 0 of 8) |
| 12 | Market Garden | Konrad Falk | None: Germany already wins every AI game (the Allied AI can't link the drops with XXX Corps, 17-scenarios-market-garden) | 0 of 4 (Skirmish) |
| 13 | Bastogne | Konrad Falk | +3,000 funds; +25% income | Ahead on day 20: the computer 7 of 8 (Skirmish: 0 of 8) |
| 14 | Iwo Jima | Kenji Arakawa | None: Japan already wins every AI game | 0 of 8 (Skirmish) |
| 15 | Ten-Go | Isao Kuramochi | 13 more of the 32nd Army in front of Shuri (6 Infantry, 2 Assault Infantry, 2 Medium Tanks, 2 Artillery, a Mortar Team); +2,000 funds; +25% income; the Okinawa plan (§6b) | 5 of 20 |

Seeds 1–20 (1–12 or 1–8 where marked), standard AI at Normal as the Allies: a 40-day limit for wins, and day 20 for who is ahead on the big maps (§5b).

### 5a. What tuning found

- **Units and bases move the result; money mostly doesn't**, except on production maps. On Midway, Guadalcanal and Ten-Go, extra funds and income changed nothing measurable; the extra units decided it. On Normandy, a buildup race, income decided it, steeply: +25% put Germany ahead in 1 of 8, +50% in 8 of 8. Sevastopol, a straight siege, tuned with funds and income alone, also steeply: +4,000 and +40% gave the Allies 10 of 20, +5,000 and +50% gave them 1 of 20.
- **The computer can't spend money on some maps.** On the Battle of Britain, Germany ended the game with tens of thousands unspent (95,600 in one game). Part of it was a fault in the standard AI, which kept every airfield free while any aircraft was heading home to one; that's fixed for every game (09-ai §4l). The rest is the map: Germany has more aircraft than airfields and one factory, so extra money can't become units there.
- **More units can make a map AI worse.** An extra Carrier at Midway (Zuikaku) took Japan from 6 of 12 wins to none, and two extra Submarines to 1 of 12, because both found the US carriers sooner and the strike phase then stopped all attacks on Midway. The fix was in the invasion: without the oiler, Japan's Landing Craft ran dry after landing on Sand Island and never crossed to Eastern Island's airfield.
- **The plan mattered more than the numbers on the first two missions.** With extra units alone the Allied AI still won 10 of 12 on the Battle of Britain and 12 of 12 on Gazala. With their map AIs (§6c, §6d) and a few more units, 5 and 4 of 20.
- **The commander matters.** Konrad Falk's drawback (20% less fuel and ammo) left Gazala's panzers starting with 24 fuel and running dry halfway to Tobruk; Gazala uses Jakob Wendt instead.

### 5b. Who is ahead on day 20 (for the big maps)

On maps where AI vs AI games rarely end within 40 days, tuning counts **who is ahead on day 20** instead (decided 2026-11-20): the winner if the game is over, otherwise the side with the higher **standing**, which is its army's value at its present strength (passengers included), plus its funds, plus five days of its income (so ground held counts, HQs and objectives included). `npm run selfplay -- --campaign --standing --days 20` reports it (`src/ai/standing.ts`). The target is the same in spirit: the computer ahead in about three games in four.

## 6. Map-specific AIs

A mission can have its own AI for the computer, written for that map. It's still a player under 09-ai's rules (it sends commands through the engine, it sees only what its side sees, and the engine rejects anything illegal); what it adds is a plan that the general AI can't work out on its own, usually the history's.

- **How it's built:** a map AI is the standard Greedy AI (09-ai §4) with a **map plan**: hooks Greedy consults while it scores moves. A plan can send a unit somewhere else (its goals), add to or forbid an attack (a bonus by target), and launch an aircraft from a Carrier to scout. Everything else is Greedy as usual, so a map AI only has to say what's special about its map. The code is in `src/ai/maps/`, one file per map.
- **What it may know:** only what a human in its place would: the map, its own forces, what it sees, what it remembers seeing, and what it has sunk or destroyed (each player's losses are public, 04-economy §8a). A search plan is a fixed pattern of where to look, the same whatever the enemy does; it never reads where hidden enemy units are.
- **Where they're used:** only in the Campaign for now. Skirmish keeps the standard AI, so Skirmish balance doesn't change.

### 6a. Midway: Japan (built 2026-11-20)

The plan follows Nagumo's day (14-scenarios-pacific §3), as decided 2026-11-20: strike Midway at dawn and search at the same time, then turn everything on the US carriers once they're found.

1. **Search.** Japan's Fighters, Submarines and the Kido Butai's Destroyers each take a sector of a fixed search fan to the north, east and south-east of the carriers, and fly or sail to its next point not yet in sight. A Fighter launches from its Carrier to search even with nothing to attack (Greedy alone launches only to attack), and comes home to land as usual when its fuel runs low. One Fighter goes over Midway first, to spot for the dawn strike.
2. **Dawn strike on Midway.** Until a US Carrier is found, the bombers attack whatever they can see on and around Midway, as Greedy would, but only three at a time (`DAWN_STRIKE`): once three bombers are in the air, the others stay aboard, armed for ships, as Nagumo's reserve was.
3. **Carriers found.** From the moment a US Carrier is in sight or remembered (09-ai §4g), **every Japanese bomber goes for the US Carriers**: an attack on a Carrier scores a large bonus, a carrier-borne bomber doesn't launch at anything else, and aircraft in the air head for the last place a US Carrier was seen. The search stops; the Fighters escort.
4. **Carriers sunk.** Once all three US Carriers are lost (Japan knows: it sank them), the plan has nothing more to add, and Greedy plays the invasion of Midway as usual.

The invasion force sails with Greedy's own landing plan from the start (09-ai §4b).

### 6b. Drive on the objective (built 2026-11-20)

A simple plan for maps where the computer must take a place to win and the standard AI fights whatever is nearest instead (`src/ai/maps/objectives.ts`). Its land units, fighting or capturing, head for the objectives their side still has to capture and can walk to; and its units that can't capture keep off those squares, so they don't stand on an objective and block the infantry (seen on the Battle of Britain, where German aircraft sat over Dover and Hawkinge). It knows only the map and the victory conditions, which every player knows.

Used on Ten-Go (the two airfields), where it's enough: the 32nd Army takes both airfields in some games. It was the first plan for Gazala too, where the armour headed for Tobruk by the shortest way, through the minefield line, and stalled (§6d replaced it). It was tried on the Battle of Britain and made Germany weaker (12 of 12 Allied wins against 10 of 12 without it): its troops walked into the defences of Dover and Hawkinge one at a time (§6c replaced it). Its parts are reused by both.

### 6c. The Battle of Britain: Germany, Sea Lion (built 2026-11-20)

Sea Lion as planned: the Luftwaffe first, then the barges (20-scenarios-battle-of-britain).

1. **The air war.** Until the Royal Navy has lost 4 warships (`SHIPS_TO_SINK`; Germany knows, it sank them), the barges stay in their ports, and an attack on a warship or a Radar Station scores a bonus, so the bombers go for the Navy and the radar.
2. **The invasion.** Once the Navy is broken, or on day 9 at the latest (`LAST_SAILING_DAY`, so there's time before day 15), the barges sail with Greedy's own massed landings (09-ai §4c), land units drive on Dover and Hawkinge (§6b), units that can't capture keep off them, and attacks near the objectives score a bonus.

Measured (seeds 1–20): sailing earlier (3 warships, day 7) made it worse, 14 Allied wins; waiting for 5 warships and day 9, 7. With the fourth barge, 5.

### 6d. Gazala: the Axis, Rommel's sweep (built 2026-11-20)

The sweep round the south end of the line, kept supplied (18-scenarios-north-africa §2).

- **The assault force** (the Axis units south of row 18 and west of the minefield) first heads for a point past the south end of the minefield, south-east of Bir Hakeim (`SWEEP_POINT`), instead of into the line. Once east of the line it drives on Tobruk (§6b).
- **Supply Trucks** (empty Halftracks until 2026-11-27) follow the tanks in the sweep that are lowest on fuel (below half a tank), the nearest first: the engine refills every land unit next to a Supply Truck at the start of the turn (05-supply-transport §3), so the armour doesn't run dry. One out of supplies goes back to a property to refill (09-ai §4j).
- **Loaded Halftracks** carry their Infantry round with the armour and on to Tobruk, since tanks can't capture.
- The infantry facing the north of the line plays Greedy as before.

With the sweep alone (and the old forward force), the armour reached Tobruk on day 12 but nothing could capture it; with Halftracks carrying infantry, the Allied AI wins 6 of 12, and with the units in the table 4 of 20.

## 7. Screens

- **Title:** Campaign, Skirmish, Survival, and Continue when there's a game to carry on; each mode is a card with a moving picture and what it is (00-master-design §12). Continue works for either kind of game; a campaign game carried on still unlocks the next mission when won.
- **Campaign screen:** the map select's world map (00-master-design §12) with a numbered label on every mission's dot (locked ones dimmed), and under it the missions in order in two columns, each with a mark for won, open or locked (the date for the open one). Picking a mission flies the camera to its theater, pulling back to the whole world on the way between distant ones, so walking the chain hops round the world in the order of the war (added 2026-11-20 at the developer's request). Picking an open mission shows its briefing (the scenario's description, then a line on what the computer has been given), the Allied commander choice for each Allied player, Luck and Battle scenes, and Start. Up and Down walk the missions, Z picks, X goes back to the title.
- **Results:** after a campaign mission, the results screen names the mission won and the one unlocked, with **Campaign** (back to the campaign screen) in place of New Game; after the last mission, won, **Continue** plays the ending (§7a).
- **Skirmish** is the map select and players screens unchanged (06-commanders §5, 09-ai §5).

### 7a. The ending: the surrender on the Missouri (built 2026-11-20)

At the developer's request, winning the last mission ends the campaign with a short film of **the surrender aboard USS Missouri in Tokyo Bay, 2 September 1945**, about 40 seconds, code-drawn in the battle scenes' pixel style and art-pack colors (08-art-pipeline §18). The script is `src/game/ending/plan.ts`, the drawing `src/game/ending/renderer.ts`.

1. **The date:** "2 September 1945 · Tokyo Bay", over the bay at first light.
2. **Tokyo Bay:** the Allied fleet at anchor under Mount Fuji, ships along the horizon and a destroyer standing by; the Missouri (the Iowa-class model the battle scenes use, in haze grey) at anchor; a launch carries the Japanese delegation out to her.
3. **The signing:** on the Missouri's teak deck under her turret and great guns, her crew lining the turret top, ranks of Allied officers, the table with its green cloth and two copies of the Instrument of Surrender. Two of the Japanese delegation (one in morning coat and top hat, one in uniform) walk to the table in turn and sign; then an Allied officer signs for the Allied Powers.
4. **The flyover:** wave after wave of aircraft in V formations, heavy bombers among them, cross the sky over the fleet.
5. **The end:** "The war is over.", and under it how much of the campaign was won.

- **No real person is named or portrayed**, as for the commanders (06-commanders §1): the figures are the delegation, Allied officers and the crew, never anyone in particular (a test checks the words). No flags are drawn.
- **When it plays:** after the results of the last mission, won (the results button says Continue); then the campaign screen. Once the campaign is complete, **Watch the ending** under the missions plays it again. `?ending=on` plays it on its own (11-tech-setup §7).
- **Controls:** Z or a click moves on to the next shot, X skips to the last; on the last, Z (or X) carries on.

## 8. Known gaps and later

- No difficulty choice; if the tuned missions turn out too hard or too easy for people, a difficulty that scales the extra funds and units is the natural next step.
- Map AIs: the Battle of Britain, Gazala and Midway have full plans; Ten-Go the simple objective plan. The others play the standard AI with more units.
- The big maps are tuned by who is ahead on day 20 (§5b), a stand-in for who would win: they need checking by play.
- No briefing art, no story between missions, no carry-over.
- The campaign maps can't be played as the Axis; that's what Skirmish is for.
