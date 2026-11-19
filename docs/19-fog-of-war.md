# Topic Doc 19: Fog of War

**Status:** v0 decided 2026-11-17 at the developer's request: an option on the map select screen, following the original game's rules (default rule) except where marked **(differs)**. Rain brings fog for the day (12-weather §3a, since 2026-11-17).
**Last updated:** 2026-11-19 (§1 maps always in fog, §2a radar)
**Depends on:** 01-units §8 (vision stats), 02-terrain (hiding terrain), 05-supply-transport §9 (hidden submarines, ambush), 00-master-design §7 (modifier layer). **Feeds:** 09-ai (what the computer sees), 12-weather §3a (rain).

---

## 1. Principles

1. **Optional, per game.** "Fog of war" is a checkbox on the players screen of a new game, off by default, like "Luck in combat". `?fog=on` in the URL turns it on too. **A scenario can make fog permanent** (`settings.fogOfWar`, since 2026-11-19, for the Battle of Britain): the box then shows ticked and can't be unticked, labeled "always on for this map", and the game has fog whatever was chosen. No other map sets it. The choice is saved with the game (`settings.fogOfWar`). **Rain** brings fog for that day even when the option is off (12-weather §3a).
2. **Each side sees only what its own units see.** Allies on the same side share what they see.
3. **The engine knows everything; players and the computer don't.** The screen and the AI both work from the game as their side sees it (09-ai rule 3: no cheating), the same mechanism hidden submarines already use (05-supply-transport §9).
4. **Original's rules by default.** Vision is a plain count of steps, with no line of sight, as in the original.
5. **Fog off changes nothing.** Without fog everything is visible, except submerged submarines (05-supply-transport §9), exactly as before.

## 2. What a side sees

A tile is **in sight** of a side when any of these is true:

- **A unit of that side on the map** is within its **vision** of the tile, counted in steps up, down, left and right (not diagonally). Its own tile counts. Vision is the unit's stat (01-units §8), read through the modifier layer, so a commander or weather effect can change it later.
- **Foot soldiers on Hills see 3 further** (+3 vision): Infantry, Assault Infantry and Mortar Teams (the `foot` and `heavyFoot` movement types). The original's mountain bonus. It's a built-in modifier (`terrain:hills`), so it shows in the unit panel.
- **A property the side owns** is in sight itself (that tile only).

**Units aboard a transport see nothing** until they're unloaded, as in the original.

An enemy unit on a tile in sight is seen, unless it is hiding (§3).

## 2a. Radar (decided and built 2026-11-19)

At the developer's request, for the Battle of Britain (20-scenarios-battle-of-britain). The **Radar Station** (01-units §2a) has a second, longer sight just for aircraft:

- **Enemy aircraft within its air vision (10 squares, counted in steps like vision) are seen**, wherever they fly. Ground units and ships there aren't: Chain Home tracked raids, not troops or boats. Its ordinary vision is 1.
- **The squares it watches stay in the fog.** They're drawn dark and the tile info says Fog; only the aircraft over them show. So a radar shows where a raid is, not what's under it.
- **Rain doesn't blind it**: the weather's −1 applies to vision, not air vision (12-weather §3a). Radar saw through cloud.
- Air vision is a stat (`airVision`), read through the modifier layer like vision.
- **The enemy has to find a Radar Station** before attacking it, like any unit: it's hidden in the fog until one of their units has it in sight.

## 3. Hiding

- **Forest, Bocage and Reef hide units.** An enemy unit on one of them is seen only by a side with a unit right next to it (not diagonally), however far its units can otherwise see. A Reef hides ships. (02-terrain marks these tiles.)
- **Ridge doesn't hide.** It's low, open, raised ground: easy to see onto. Nor does it give foot soldiers the Hills bonus. (Decided 2026-11-17.)
- **Aircraft never hide.** An aircraft over a Forest is seen like one over Plains.
- **Submerged submarines** keep their own rule (05-supply-transport §9): seen only from next to them, with or without fog, wherever they are.
- A side always sees its own units and its allies' units.

## 4. Always shown

Terrain, fortifications and their HP, Major Bridges blown and rebuilt, **who owns each property**, players' funds and the day's weather are shown to everyone, fog or not, as in the original.

Not shown: units in the fog, and the **capture progress** of a property being captured by a unit the side can't see (it shows as untouched).

## 5. Giving orders in the fog

Everything follows from one rule already used for submarines: **an order is judged by what its player could see when giving it.**

- **Moving:** a unit the player can't see isn't there as far as planning a move goes: its tile counts as empty for move ranges and paths.
- **Ambush (the original's "trap"):** a unit whose path runs into an enemy it couldn't see, or that is told to end its move on one, stops on the last tile before it that it can stop on, burns fuel only for what it moved, and its turn is over. "AMBUSH!" shows over the enemy, which is now next to it and so in sight. Same rule as 05-supply-transport §9, now for every unit. Aircraft still fly over enemy ground units and ships, so they're only ambushed by an enemy aircraft on their path, or by ending their move on a hidden unit.
- **Unloading onto a hidden enemy** is an ambush too: that passenger stays aboard, "AMBUSH!" shows, and the transport's turn is over. A first passenger already unloaded stays unloaded.
- **Attacking a unit:** only one the player could see when giving the order. **(differs)** In the original a unit that moved next to a hidden one could then fire on it. Here the move and the attack are one order, so to hit a unit hidden in a Forest, first move another unit next to it (spot it), then attack with a second unit. A Recon or any cheap unit makes a good spotter.
- **Attacking a fortification** in the fog is allowed: a fortification is terrain, always shown. If a unit the player can't see is inside, the shot still hits the fortification and the unit inside isn't touched. (If the unit inside can be seen, attack it instead, as without fog: 03-combat.)
- Loading, joining and supplying only involve the player's own side, which is always seen.

## 6. Fire from the fog

A unit that attacks from a tile the defender's side can't see **stays hidden**, as in the original: artillery firing from the fog shows only its hit. Direct attackers are next to their target, so they're always seen.

## 7. On screen

- **Tiles out of sight are drawn darker** (the art pack's `fog` color laid over them). Terrain and property colors still show through.
- The map is drawn for **the human whose turn it is**, as for submarines (05-supply-transport §9): during the computer's turn, for the last human who played; with only computers playing, and once the game is over, everything shows and there's no fog drawn.
- **The enemy's moves play out only where they can be seen.** A unit coming out of the fog appears on the first tile in sight and walks from there; a unit walking into the fog walks to its last tile in sight and is gone. (A path that dips out of sight and back in shows the whole stretch between.) Something that happens entirely in the fog doesn't show at all.
- **Hot-seat:** with fog on, or rain anywhere in the forecast, and two or more humans, the pass-the-device screen between turns is always used, whatever its own checkbox says, so nobody sees the other's view.
- **Undo** is cleared by any move that brings a tile into sight that wasn't before, so a move can't be taken back once it has shown something. In practice most moves in the fog can't be undone. (The original has no undo at all.)
- The tile info for a tile out of sight says **Fog**.

## 8. The computer

- It sees exactly what its side sees (09-ai §3), no more.
- Since 2026-11-17 the Greedy AI remembers enemies it saw for a day, and its aircraft and ships patrol toward the enemy's properties when there's nothing in sight (09-ai §4g). It keeps a Recon as a scout, building one if it has none, which drives to the edge of what its side can see. It doesn't deliberately spot units hidden in Forests for its other units: that was tried and made it play worse (09-ai §4g).

## 9. Later

- Commanders with vision bonuses (06-commanders §3 dropped them while vision did nothing).
- AI spotting before attacking into hiding terrain, done in a way that helps (§8, 09-ai §4g).
- Last-seen markers for enemy units (not in the original).
