# Topic Doc 03: Combat

**Status:** Rules decided. Provisional v0 damage chart and veterancy values set; expect tuning after playtesting.
**Last updated:** 2026-10-31
**Depends on:** 00-master-design.md, 01-units.md. **Feeds:** 02-terrain (defense stars, fortification HP), 06-commanders (modifiers).

**Guiding rule:** when a design choice is open, follow the original game's mechanism unless there's a clear reason not to.

---

## 1. Damage formula

Same structure as the original game:

```
damage% = (base × attackMod/100 + luck) × (attackerHP / 10) × ((200 − defenseMod − terrainStars × defenderHP) / 100)
```

| Term | Meaning |
|---|---|
| `base` | Base damage from the damage chart (section 5), for a full-HP attacker vs. a full-HP defender on 0-star terrain |
| `attackMod` | 100 by default. Raised or lowered by the modifier layer (veterancy, COs, weather later) |
| `luck` | Seeded random value, 0–9 (section 3) |
| `attackerHP` | Attacker's displayed HP (1–10) |
| `defenseMod` | 100 by default. Raised by veterancy, COs, etc. |
| `terrainStars` | Defender tile's defense stars (02-terrain). Air units always use 0 |
| `defenderHP` | Defender's displayed HP (1–10) |

**Consequences (intended, as in the original):**
- Damage is absolute: 75% always removes 7.5 HP, whatever the defender has left.
- A weakened attacker hits proportionally weaker.
- Terrain protects full-HP units well and battered units poorly (1% per star per HP point).
- Striking first is a large advantage, and focus fire snowballs.

**HP and rounding:**
- HP is stored internally as 0–100 and displayed as 1–10 (displayed = internal ÷ 10, rounded up).
- Final damage is rounded down to a whole internal HP point. Damage can't go below 0.
- A unit at 0 internal HP is destroyed.

## 2. Attack sequence and counterattacks

1. Attacker picks a target within range (after moving, if it's a direct unit; indirect units cannot move and fire).
2. Weapon choice: the **primary weapon** is used if it has ammo and the chart has a primary value vs. the target. Otherwise the **secondary weapon** (unlimited) is used if the chart has a secondary value. If neither, the attack isn't allowed. Only primary shots spend 1 ammo.
3. Damage is applied to the defender.
4. **Counterattack** happens if all of these hold:
   - the defender survived;
   - the defender is a direct-fire unit (range 1) and the attacker is adjacent;
   - the defender has a usable weapon vs. the attacker (same weapon-choice rule; counters spend ammo too).
   The counter uses the defender's **reduced** HP and gets its own luck roll.
5. Indirect units never counterattack, and are never countered when they fire.
6. The engine emits a single combat result event (damage dealt, counter damage, destroyed units, ammo spent, veterancy changes) for the presentation layer to play back.

**Damage forecast:** before confirming, the player sees the expected damage range (minimum and maximum luck) for the attack and the likely counter.

## 3. Luck

- Luck is a random integer **0–9** added to the base percentage, as in the original.
- **Seeded:** the RNG state lives in `GameState`. Every roll advances it. The same state plus the same commands always produce the same result, so replays, undo and tests stay deterministic.
- Each attack and each counter rolls separately.
- No luck is applied when the chart has no value ("—") for that pairing.
- A **"no luck" setting** (luck always 0) exists for testing and for players who want it.

## 4. Fortifications and obstacles

- Fortifications and obstacles have HP (10 displayed / 100 internal) and are attacked like units (similar to the original's breakable pipe seams).
- They belong to nobody: any unit with a `Fort` value in the chart can attack any empty one, on either side of the front.
- **A fortification can only be attacked when it's empty.** If a unit occupies it, attacks target the unit, which receives the fortification's terrain defense. To take a bunker: dislodge the defender, then demolish the bunker so it can't be reoccupied.
- When attacked, a fortification gets no terrain defense, never counterattacks, and has no veterancy. Luck applies.
- At 0 HP it becomes its broken or cleared terrain (defined in 02-terrain).
- Destroying a fortification does **not** count as a kill for veterancy.

## 5. Damage chart (v0, provisional)

Values are `base` damage percentages. **Attacker = row, defender = column.**
- Plain number = primary weapon (uses ammo).
- `*` = secondary weapon (machine gun etc., unlimited).
- `—` = cannot attack.

Values come from the original game where a unit maps cleanly (Infantry, Assault Infantry ≈ Mech, Recon, Halftrack ≈ APC, Medium Tank ≈ Tank, Heavy Tank ≈ Md Tank, Artillery, Rocket Artillery, Mobile AA ≈ Anti-Air, Flak Gun ≈ Missiles, Bomber, Battleship, Submarine) and from intuition for new ones (Mortar Team, Light Tank, Tank Destroyer, Destroyer, Torpedo Boat, Fighter strafing, fortifications).

Unarmed units (Halftrack, Transport Aircraft, Landing Craft) have no attack rows.

**Abbreviations:** Inf = Infantry, AInf = Assault Infantry, Mor = Mortar Team, Rec = Recon, HT = Halftrack, LT = Light Tank, MT = Medium Tank, HvT = Heavy Tank, TD = Tank Destroyer, Art = Artillery, Rkt = Rocket Artillery, AA = Mobile AA, Flak = Flak Gun, Ftr = Fighter, Bmr = Bomber, Trn = Transport Aircraft, BB = Battleship, DD = Destroyer, Sub = Submarine, LC = Landing Craft, TB = Torpedo Boat, Fort = fortification/obstacle.

### 5a. Vs. land units

| Attacker ↓ / Defender → | Inf | AInf | Mor | Rec | HT | LT | MT | HvT | TD | Art | Rkt | AA | Flak |
|---|---|---|---|---|---|---|---|---|---|---|---|---|---|
| Inf | 55* | 45* | 60* | 12* | 14* | 7* | 5* | 1* | 6* | 15* | 25* | 5* | 25* |
| AInf | 65* | 55* | 70* | 85 | 75 | 70 | 55 | 15 | 60 | 70 | 85 | 65 | 85 |
| Mor | 75 | 70 | 75 | 45 | 40 | 30 | 15 | 5 | 25 | 55 | 60 | 40 | 60 |
| Rec | 70* | 65* | 75* | 35* | 45* | 10* | 6* | 1* | 8* | 45* | 55* | 4* | 28* |
| LT | 70* | 65* | 75* | 75 | 65 | 55 | 40 | 10 | 45 | 60 | 75 | 55 | 75 |
| MT | 75* | 70* | 80* | 85 | 75 | 70 | 55 | 15 | 65 | 70 | 85 | 65 | 85 |
| HvT | 105* | 95* | 105* | 105 | 105 | 95 | 85 | 55 | 90 | 105 | 105 | 105 | 105 |
| TD | — | — | — | 95 | 90 | 95 | 85 | 65 | 75 | 80 | 90 | 85 | 90 |
| Art | 90 | 85 | 90 | 80 | 70 | 75 | 70 | 45 | 70 | 75 | 80 | 75 | 80 |
| Rkt | 95 | 90 | 95 | 90 | 80 | 85 | 80 | 55 | 80 | 80 | 85 | 85 | 90 |
| AA | 105 | 105 | 105 | 60 | 50 | 35 | 25 | 10 | 30 | 50 | 45 | 45 | 55 |
| Flak | — | — | — | — | — | — | — | — | — | — | — | — | — |
| Ftr | 15 | 15 | 15 | 10 | 8 | 5 | 2 | 1 | 3 | 10 | 10 | 3 | 8 |
| Bmr | 110 | 110 | 110 | 105 | 105 | 105 | 105 | 95 | 105 | 105 | 105 | 95 | 105 |
| BB | 95 | 90 | 95 | 90 | 80 | 85 | 80 | 55 | 80 | 80 | 85 | 85 | 90 |
| DD | 50 | 45 | 50 | 40 | 35 | 30 | 20 | 5 | 20 | 40 | 50 | 30 | 45 |
| Sub | — | — | — | — | — | — | — | — | — | — | — | — | — |
| TB | — | — | — | — | — | — | — | — | — | — | — | — | — |

### 5b. Vs. air, naval and fortifications

| Attacker ↓ / Defender → | Ftr | Bmr | Trn | BB | DD | Sub | LC | TB | Fort |
|---|---|---|---|---|---|---|---|---|---|
| Inf | — | — | — | — | — | — | — | — | 5* |
| AInf | — | — | — | — | — | — | — | — | 65 |
| Mor | — | — | — | — | — | — | 25 | 25 | 20 |
| Rec | — | — | — | — | — | — | — | — | — |
| LT | — | — | — | 1 | 3 | 1 | 8 | 15 | 10 |
| MT | — | — | — | 1 | 5 | 1 | 10 | 20 | 15 |
| HvT | — | — | — | 10 | 30 | 10 | 35 | 40 | 40 |
| TD | — | — | — | 5 | 10 | 5 | 15 | 25 | 30 |
| Art | — | — | — | 40 | 50 | 60 | 55 | 60 | 50 |
| Rkt | — | — | — | 55 | 65 | 85 | 60 | 75 | 55 |
| AA | 65 | 75 | 90 | — | — | — | — | — | — |
| Flak | 100 | 100 | 110 | — | — | — | — | — | — |
| Ftr | 55 | 100 | 100 | — | — | — | 5 | 10 | — |
| Bmr | — | — | — | 75 | 85 | 95 | 95 | 95 | 55 |
| BB | — | — | — | 50 | 85 | 95 | 95 | 95 | 55 |
| DD | 55* | 65* | 105* | 10 | 40 | 90 | 50 | 85 | 20 |
| Sub | — | — | — | 55 | 25 | 55 | 95 | 75 | — |
| TB | — | — | — | 35 | 30 | 40 | 75 | 55 | — |

### 5c. Notes on the chart

- **Tank Destroyer** beats tanks when it strikes first (vs. Heavy Tank 65 vs. Heavy Tank's 90 return fire) but has no weapon vs. infantry, so Assault Infantry (60) and artillery are its counters.
- **Heavy Tank** wins most fights but is slow and expensive; its answers are Tank Destroyers, Bombers, Battleships and massed indirect fire.
- **Fighter** strafing is deliberately weak (≤15) and uses the same ammo as its air-to-air guns.
- **Assault Infantry** is the best ground unit vs. fortifications (65).
- **Submerged submarines** can only be attacked by Destroyers and Submarines (dive rules in 05-supply-transport §9). That includes counters: a unit that can't attack one can't counter it either.
- **Ships in port** get the Port's 3 stars. Ships at sea get 0, and on Reef 1 (02-terrain §3).
- Land units can attack ships only when adjacent (coastal tiles); indirect units use their normal range.

## 6. Veterancy (combat experience)

Inspired by Red Alert 2's three-level system. Kills raise a unit's level, and each level is a modifier in the modifier layer.

| Level | Badge | Reached at | Attack | Defense |
|---|---|---|---|---|
| Rookie | none | Start | +0% | +0% |
| Veteran | 1 chevron | 3 kills | +10% | +10% |
| Elite | 3 chevrons | 9 kills | +20% | +20% |

- Elite is purely a bigger bonus than Veteran; it has no extra perks.
- In the formula: Veteran = `attackMod` 110, `defenseMod` 110; Elite = 120 / 120.
- **A kill** is destroying an enemy unit with any attack: direct, indirect, or a counterattack. Passengers destroyed along with a transport do not add kills (only the transport counts). Fortifications don't count.
- The unit stores a **kill count**; its level is derived from it. Levels never go down, and healing or resupplying doesn't affect them.
- The badge shows on the map sprite and in the unit info panel. Level-ups are part of the combat result event.
- Implementation cost is low: one field on the unit, two modifier entries, a sprite badge.

### Joining units

Joining follows the original game: two damaged units of the same type merge into one, HP is added (capped at 10), excess HP is refunded as funds, and fuel and ammo are added (capped at max).

**Veterancy on join:** the merged unit takes the kill count of **whichever unit contributed more HP**. On a tie, it keeps the higher kill count.

- Represents replacements diluting (or being absorbed into) an experienced unit.
- Example: Elite at 7 HP + Rookie at 3 HP → Elite at 10 HP. Elite at 3 HP + Rookie at 8 HP → Rookie at 10 HP.
- Stops the exploit of topping up a battered Elite with fresh troops for free, while still rewarding keeping veterans alive.

## 7. Out of scope for MVP

- Flanking, suppression, armor facing.
- Luck variants (bad luck, CO-driven luck) belong to 06-commanders.

## 8. Open questions

- Tuning the v0 chart and veterancy bonuses after playtesting.
- Terrain defense stars per terrain, including fortifications (02-terrain).
