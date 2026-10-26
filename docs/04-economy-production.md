# Topic Doc 04: Economy, Production and Capture

**Status:** v0 decided. Follows the original game (default rule). Expect tuning after playtesting.
**Last updated:** 2026-10-24
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

1. **Daily fuel use** for that player's air and naval units; units that run out crash or sink (05-supply-transport). Phase 2.
2. **Income:** add income for every property the player owns.
3. **Repair and resupply** on owned properties (section 5), then Halftrack automatic resupply (05-supply-transport).
4. All of the player's units become ready to act.

Each event in this sequence is emitted as an engine event so the UI can show it (funds ticking up, "+2" heals).

## 3. Capture

- Units with `canCapture` (Infantry, Assault Infantry) can capture enemy or neutral properties.
- Every property has **capture points**: 20 when untouched.
- The `Capture` action (after moving onto the property, or without moving) subtracts the unit's **displayed HP** (1–10) from the capture points. Capturing ends the unit's action.
- At 0 or below, the property changes owner and its capture points reset to 20.
- **Progress resets to 20** if the capturing unit leaves the tile or is destroyed. Progress is kept across turns while the unit stays, and is also kept if another friendly unit joins it (same type, see section 6).
- So a full-HP Infantry captures in 2 turns; a damaged one takes longer.
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
- Repair costs **10% of the unit's cost per displayed HP** restored. If the player can't afford 2 HP, the unit gets 1 HP if affordable, otherwise none.
- Units are repaired in a deterministic order (row-major by position) so funds run out the same way every time.
- The same property also fully restores fuel and ammo, free of charge, even if no HP is repaired.
- Transported units aren't repaired.

## 6. Joining units

Follows the original (veterancy rule from 03-combat section 6):

- A unit can move onto a friendly unit of the **same type** if the target has fewer than 10 displayed HP. This is the `Join` action and ends the moving unit's action.
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

## 9. Open questions

- Tuning income vs. unit costs for small test maps.
- Whether HQ-less scenarios (common in historical setups) default to rout-only.
- Phase 2: airfield and port income, and whether some properties (for example a railhead) give income only.
