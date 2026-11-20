# Topic Doc 22: Campaign and Skirmish

**Status:** v0 decided and built 2026-11-20. Every built map is a campaign mission, each with a first-guess advantage for the computer tuned by self-play (§5); Midway has the first map-specific AI (§6).
**Last updated:** 2026-11-20
**Depends on:** 00-master-design.md (§8, §15), 06-commanders.md, 09-ai.md, 11-tech-setup.md §3j. **Feeds:** every scenario doc (each map's campaign setup is listed here, §5).

---

## 1. Two ways to play

The title screen offers **Campaign**, **Skirmish** and, when a game was left unfinished, **Continue**.

- **Skirmish** is the game as it was before this doc: pick any map on the world map, choose who the computer plays (or play a friend on one device), commanders and options. Skirmish maps are balanced by AI vs AI play, so the two sides are roughly even for two equal players. Nothing about Skirmish changed except its name and where it sits in the menu.
- **Campaign** is the player against the computer, always as the **Allies**, on the same maps, in history's order. Because no computer opponent is as good as a careful human, **the computer starts with a numerical advantage** on every mission (§4), and a mission can have an AI written for that map alone (§6).

## 2. The missions and their order

One chain in date order, across every theater (decided 2026-11-20). Winning a mission unlocks the next; the first is always open. A mission already won can be played again at any time. Losing a mission just means trying again: there's no penalty and nothing carries over between missions (no units, funds or score).

| # | Mission | When | The computer plays |
|---|---|---|---|
| 1 | Battle of Britain | August 1940 | Germany |
| 2 | Gazala | May–June 1942 | Germany, Italy |
| 3 | Midway | June 1942 | Japan |
| 4 | Sevastopol | June 1942 | Germany |
| 5 | Guadalcanal | October 1942 | Japan |
| 6 | El Alamein | October 1942 | Germany, Italy |
| 7 | Stalingrad | November 1942 | Germany |
| 8 | The Slot | 1943 | Japan |
| 9 | Kursk | July 1943 | Germany |
| 10 | Normandy | June 1944 | Germany |
| 11 | Market Garden | September 1944 | Germany |
| 12 | Bastogne | December 1944 | Germany |
| 13 | Iwo Jima | February 1945 | Japan |
| 14 | Ten-Go | April 1945 | Japan |

Dunkirk (21-scenarios-dunkirk) goes first once it's built. A new map joins the chain at its date.

- **Progress** is kept on the device (`localStorage`, `ww2-tactics.campaign`): the missions won. It's separate from the autosave, so starting a Skirmish never loses campaign progress, and Continue on a campaign game still counts the win.
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

| Mission | Axis commander | Advantage | Allied AI wins |
|---|---|---|---|
| (filled in by tuning, §5a) | | | |

### 5a. Tuning results

See the table above; each row records the seeds and day limit it was measured with.

## 6. Map-specific AIs

A mission can have its own AI for the computer, written for that map. It's still a player under 09-ai's rules (it sends commands through the engine, it sees only what its side sees, and the engine rejects anything illegal); what it adds is a plan that the general AI can't work out on its own, usually the history's.

- **How it's built:** a map AI is the standard Greedy AI (09-ai §4) with a **map plan**: hooks Greedy consults while it scores moves. A plan can send a unit somewhere else (its goals), add to or forbid an attack (a bonus by target), and launch an aircraft from a Carrier to scout. Everything else is Greedy as usual, so a map AI only has to say what's special about its map. The code is in `src/ai/maps/`, one file per map.
- **What it may know:** only what a human in its place would: the map, its own forces, what it sees, what it remembers seeing, and what it has sunk or destroyed (each player's losses are public, 04-economy §8a). A search plan is a fixed pattern of where to look, the same whatever the enemy does; it never reads where hidden enemy units are.
- **Where they're used:** only in the Campaign for now. Skirmish keeps the standard AI, so Skirmish balance doesn't change.

### 6a. Midway: Japan (built 2026-11-20)

The plan follows Nagumo's day (14-scenarios-pacific §3), as decided 2026-11-20: strike Midway at dawn and search at the same time, then turn everything on the US carriers once they're found.

1. **Search.** Japan's Fighters, Submarines and the Kido Butai's Destroyers each take a sector of a fixed search fan to the north, east and south-east of the carriers, and fly or sail to its next point not yet in sight. A Fighter launches from its Carrier to search even with nothing to attack (Greedy alone launches only to attack), and comes home to land as usual when its fuel runs low. One Fighter goes over Midway first, to spot for the dawn strike.
2. **Dawn strike on Midway.** Until a US Carrier is found, the bombers attack whatever they can see on and around Midway, as Greedy would.
3. **Carriers found.** From the moment a US Carrier is in sight or remembered (09-ai §4g), **every Japanese bomber goes for the US Carriers**: an attack on a Carrier scores a large bonus, a carrier-borne bomber doesn't launch at anything else, and aircraft in the air head for the last place a US Carrier was seen. The search stops; the Fighters escort.
4. **Carriers sunk.** Once all three US Carriers are lost (Japan knows: it sank them), the plan has nothing more to add, and Greedy plays the invasion of Midway as usual.

The invasion force sails with Greedy's own landing plan from the start (09-ai §4b).

## 7. Screens

- **Title:** Campaign, Skirmish, and Continue when there's a game to carry on. Continue works for either kind of game; a campaign game carried on still unlocks the next mission when won.
- **Campaign screen:** the missions in order, each with its date and theater, and a mark for won, open or locked. Picking an open mission shows its briefing (the scenario's description, then a line on what the computer has been given), the Allied commander choice for each Allied player, Luck and Battle scenes, and Start. Up and Down walk the missions, Z picks, X goes back to the title.
- **Results:** after a campaign mission, the results screen names the mission won and the one unlocked, with **Campaign** (back to the campaign screen) in place of New Game.
- **Skirmish** is the map select and players screens unchanged (06-commanders §5, 09-ai §5).

## 8. Known gaps and later

- No difficulty choice; if the tuned missions turn out too hard or too easy for people, a difficulty that scales the extra funds and units is the natural next step.
- Only Midway has a map AI. The next candidates are the maps where the standard AI misses the point of the battle: Gazala (opening a supply lane, 18-scenarios-north-africa §2), Market Garden and Normandy.
- No briefing art, no story between missions, no carry-over.
- The campaign maps can't be played as the Axis; that's what Skirmish is for.
