# Topic Doc 04: Economy, Production and Capture

**Status:** v0 decided. Follows the original game (default rule). Expect tuning after playtesting.
**Last updated:** 2026-10-31
**Depends on:** 00-master-design.md, 01-units.md, 02-terrain.md. **Feeds:** 05-supply-transport (repair and resupply on properties), scenarios.

---

## 1. Properties

| Property | Income/day | Builds | Repairs and resupplies | Notes |
|---|---|---|---|---|
| City | 1,000 | — | Land units | |
| Factory | 1,000 | Land units | Land units | |
| Airfield (phase 2) | 1,000 | Air units | Air units | |
| Port (phase 2) | 1,000 | Naval units | Naval units | |
| HQ | 1,000 | — | Land units | Each player has at most one. Losing it loses the game |

- Each property has an **owner**: a player or neutral.
- Income per property is a scenario setting (default 1,000), as in the original's "funds per base" option.

## 2. Turn start sequence

At the start of each player's turn, in this order (as in the original):

This includes the first player's first turn, so they collect income on day 1, as in the original.

1. **Daily fuel use** for that player's air and naval units; aircraft that run out crash, ships that run out are stranded (05-supply-transport §5, §7). None on day 1, or for units on a property that services them.
2. **Income:** add income for every property the player owns.
3. **Repair and resupply** on owned properties (section 5), then Halftrack and Supply Ship automatic resupply (05-supply-transport §3, §3a, §3b).
4. All of the player's units become ready to act.

Each event in this sequence is emitted as an engine event so the UI can show it (funds ticking up, "+2" heals).

**How step 3 is shown** (decided 2026-11-19, at the developer's request): after the Day banner, the cursor visits each unit repaired or resupplied, **one unit at a time**, in the order the engine serviced them (property repairs first, row by row, then Halftrack and Supply Ship resupply). A unit refuelled and rearmed gets a supply crate popping up over it, and its low fuel and ammo cans go away. A repaired unit's HP badge counts up one point at a time with a green "+2" rising off it, while the funds in the HUD count down by the repair cost. A unit both repaired and resupplied is one visit. Then the cursor goes back to the HQ. Only units the viewer can see are visited (19-fog-of-war §7).

## 3. Capture

- Units with `canCapture` (Infantry, Assault Infantry) can capture enemy or neutral properties.
- Every property has **capture points**: 20 when untouched.
- The `Capture` action (after moving onto the property, or without moving) subtracts the unit's **displayed HP** (1–10) from the capture points. Capturing ends the unit's action.
- At 0 or below, the property changes owner and its capture points reset to 20.
- **Progress resets to 20** if the capturing unit leaves the tile or is destroyed. Progress is kept across turns while the unit stays, and is also kept if another friendly unit joins it (same type, see section 6).
- So a full-HP Infantry captures in 2 turns; a damaged one takes longer.
- **Allied properties can't be captured:** only neutral properties and those of the other side.
- **Capturing an enemy HQ** defeats that player immediately (see 00-master-design section 8; scenarios may define other conditions). A captured HQ does not change hands as an HQ; the game ends.

## 4. Production

- The `Build` command creates a unit on an **empty** production property the player owns (Factory for land units in phase 1).
- The unit's cost is subtracted from funds; a player can't build with insufficient funds.
- The new unit has full HP, fuel and ammo, Rookie veterancy, and **can't act until the next turn**.
- Only unit types the scenario allows for that player's nation are offered (01-units, availability rule).
- Unit costs are in 01-units section 8.
- **Unit cap:** a scenario may set a maximum unit count per player (the original's unit limit). Default: no cap.

## 5. Repair

- At turn start, each of the player's units on an owned property that serves its category (section 1) is **repaired 2 displayed HP** (20 internal), capped at 10.
- A unit already showing 10 HP isn't repaired or charged, even if its internal HP is a little below 100.
- Repair costs **10% of the unit's cost per displayed HP** restored. If the player can't afford 2 HP, the unit gets 1 HP if affordable, otherwise none.
- Units are repaired in a deterministic order (row-major by position) so funds run out the same way every time.
- The same property also fully restores fuel and ammo, free of charge, even if no HP is repaired.
- **An ally's property counts as your own for repair and resupply (new)** (decided 2026-11-15, at the developer's request, for Market Garden, the first map with two players on one side; built the same day). A unit on a property owned by another player on its side is repaired and resupplied at the start of its owner's turn, exactly as on its own property, and **the repair is paid from the unit owner's funds**, never the ally's. An aircraft or ship on an ally's airfield or port also burns no daily fuel (05-supply-transport §5). This is only about service: you still can't build at an ally's factory, airfield or port, and you can't capture an ally's property (§3). No map before Market Garden has two players on one side, so none changes.
- Transported units aren't repaired, except aircraft on a Carrier, which get 1 HP a day at the same price (05-supply-transport §10).

## 6. Joining units

Follows the original (veterancy rule from 03-combat section 6):

- A unit can move onto another unit of its own player and the **same type** if the target has fewer than 10 displayed HP. This is the `Join` action and ends the moving unit's action.
- HP is added (displayed values), capped at 10. **Excess displayed HP is refunded** at 10% of the unit's cost per HP.
- Fuel and ammo are added, capped at maximum.
- Veterancy: the kill count of the unit that contributed more HP; on a tie, the higher kill count (03-combat).
- A transport carrying units can't join or be joined.
- The joined unit has acted for this turn.

## 7. Funds

- Funds are a whole number ≥ 0. Starting funds are a scenario setting (default 0, as in the original's versus maps).
- Funds are never shared between players, even on the same side, unless a scenario says so.

## 8. Defeat conditions (MVP defaults)

Scenarios define their own victory conditions (00-master-design section 8). The MVP defaults, as in the original:

- **HQ captured** → that player loses.
- **Rout:** a player who has no units left at the end of any turn loses, but only once they have had at least one unit (so empty-start maps still work).
- **Resign:** a player may resign at any time.

As in the original, a defeated player's units are removed and their properties become neutral. If they have an ally still in the game, play continues and their turns are skipped. The game ends when only one side has players left, and everyone remaining on that side wins.

### Scenario victory conditions (phase 2)

Scenarios list their conditions (00-master-design §8). HQ capture and rout already exist. Phase 2 adds three, which between them cover what's planned for historical battles:

| Condition | Meaning | Checked |
|---|---|---|
| `captureProperties` | A named side wins by owning all the listed properties, such as a town or a bridgehead | After each capture |
| `holdProperties` | A named side wins by owning all the listed properties for N consecutive days | At the start of each day |
| `surviveDays` | A named side wins if the game reaches day N with that side still in it | At the start of each day |

Scenarios without an HQ just leave out `hqCapture`. That answers the open question below.

Built in milestone 12. Details settled while building it:

- **Winning is the other side losing.** When one of these conditions is met, every player on the other side is out, so the results screen, rout and resign all work the same way.
- **Day-based checks come first.** At the start of each day, before anyone's turn starts or income is paid, `holdProperties` and `surviveDays` are checked.
- **Holding counts from day 2.** Owning the properties when the game starts isn't counted. Losing any one of them, even for part of a day, resets the count to 0 at the next day's start.
- **Ownership is by side,** so on a 2-vs-2 map an ally's property counts too.
- **The file format:** each condition lists its `side` ("allies" or "axis") and, where needed, `properties` and `days`:

```json
"victory": [
  { "type": "hqCapture" },
  { "type": "rout" },
  { "type": "captureProperties", "side": "allies", "properties": [{ "x": 6, "y": 3 }] },
  { "type": "holdProperties", "side": "axis", "properties": [{ "x": 6, "y": 3 }], "days": 8 },
  { "type": "surviveDays", "side": "axis", "days": 12 }
]
```

A file is refused if an objective isn't a property, the side has no players, or `surviveDays` is earlier than day 2.

- **On screen:** objective properties have gold corner marks (corners, not a full box, so they never look like the cursor or a selection), and the tile info box says "★ Objective" on them. The HUD lists each objective with its progress, such as "Axis: hold both marked objectives for 8 days (3/8)". The results screen shows the same list with how each one ended.

## 9. Open questions

- Tuning income vs. unit costs for small test maps.
- Phase 2: airfield and port income, and whether some properties (for example a railhead) give income only.
