# Topic Doc 01: Units

**Status:** Roster and roles decided. Provisional v0 stats set (section 8); expect them to change after playtesting. Damage values live in 03-combat.
**Last updated:** 2026-10-24
**Depends on:** 00-master-design.md. **Feeds:** 02-terrain (movement types, fortifications), 03-combat (damage chart), 05-supply-transport (transport and resupply rules).

---

## 1. Principles

1. **Every unit has a distinct job.** Each unit is either a counter to something or a tool (capture, transport, supply). No unit is just "a slightly better version" of another.
2. **Stats are identical across sides.** A Medium Tank is the same unit whether the art is a Sherman or a Panzer IV.
3. **Historical asymmetry comes from availability, not stats.** Each scenario defines which unit types each side can build and which it starts with.
4. **Availability rule:** a nation has art for a unit type only if it historically fielded an equivalent, and a scenario only offers a nation the unit types it has art for. Example: the US has no Heavy Tank in Normandy; the UK has one (Churchill); Germany has one (Tiger).
5. **Generic military names only.** No names from the original game (no "Mech", "Md Tank", "Neotank", "Lander", "B-Copter", etc.).

## 2. Land units (12 in phase 1 MVP, plus Flak Gun in phase 2)

| Unit | Role | Movement type (tentative) | Key traits | Allied / Axis art examples |
|---|---|---|---|---|
| Infantry | Cheap, captures, holds terrain | Foot | Can capture. Can be carried by Halftrack, Transport Aircraft, Landing Craft | GI, Tommy / Wehrmacht rifleman |
| Assault Infantry | Anti-armor and engineering infantry | Heavy foot (slower) | Can capture. Strong vs. armor and vs. fortifications/obstacles (see section 6). Costs more than Infantry | Bazooka team, assault engineers / Panzerschreck team, Pioniere |
| Mortar Team | Short-range indirect fire | Heavy foot (slower than Infantry) | Indirect, range exactly 2. Low ammo (~3). Cannot capture. Fits in all infantry transports, including Transport Aircraft | US/UK mortar team / Granatwerfer team |
| Recon | Fast scout, kills infantry | Wheels | High movement and vision. Weak vs. armor | M8 Greyhound, Daimler / Sd.Kfz. 234 |
| Halftrack | Infantry transport and resupply | Tracks | Carries 1 foot unit. Resupplies fuel/ammo to adjacent units. Unarmed | M3 / Sd.Kfz. 251 |
| Light Tank | Cheap, fast armor | Tracks | Good vs. infantry and light vehicles | M5 Stuart / Panzer II |
| Medium Tank | Main battle unit | Tracks | Balanced attack and defense | Sherman / Panzer IV |
| Heavy Tank | Expensive breakthrough armor | Tracks | Strong armor, slow, fuel-hungry. Availability limited by nation | Churchill (UK) / Tiger |
| Tank Destroyer | Anti-armor specialist | Tracks | High damage vs. armor, weak defense. No machine gun, so poor vs. infantry | M10 / StuG III |
| Artillery | Indirect fire | Tracks | Indirect, range 2–3 | M2 howitzer / leFH 18 |
| Rocket Artillery | Long-range indirect fire | Wheels | Indirect, range 3–5. Expensive, fragile. Mainly German and Soviet; limited Western Allied availability (see section 7a) | Calliope, Land Mattress / Nebelwerfer |
| Mobile AA | Air defense | Tracks | Strong vs. aircraft and infantry, weak vs. tanks | M16 quad .50 / Flakvierling |
| Flak Gun (phase 2) | Long-range air defense | Tracks (towed; slow) | Indirect, attacks air units only, long range. Cannot move and fire. Arrives with air units in phase 2 | 90mm AA / 88mm Flak |

### Mortar Team vs. Artillery

| | Mortar Team | Artillery |
|---|---|---|
| Range | Exactly 2 | 2–3 |
| Movement | Heavy foot; can cross forest and hills | Tracks |
| Transportable | Halftrack, Transport Aircraft, Landing Craft | Landing Craft only |
| Ammo | Low (~3) | Normal |
| Cost | Cheap | Mid |

## 3. Air units (phase 2)

| Unit | Role | Key traits | Allied / Axis art examples |
|---|---|---|---|
| Fighter | Air superiority, light ground attack | Strong vs. air units. Can attack ground units with very limited effectiveness (strafing). Burns fuel each day | Spitfire, P-51 / Bf 109, Fw 190 |
| Bomber | Air-to-ground strike | The only dedicated air-to-ground unit. Heavy damage vs. ground and naval units. Cannot attack air | B-26, Lancaster / Ju 88 |
| Transport Aircraft | Airborne drops | Carries 2 foot units, reusable (see section 5). Unarmed | C-47, Dakota / Ju 52 |

## 4. Naval units (phase 2)

| Unit | Role | Key traits | Allied / Axis art examples |
|---|---|---|---|
| Battleship | Shore bombardment | Long-range indirect fire vs. land and sea | HMS Warspite, USS Texas / (rare; scenario-dependent) |
| Destroyer | Escort | Hunts submarines, anti-air, close bombardment | Fletcher, Tribal / Z-class |
| Submarine | Anti-ship | Can dive (hidden while submerged). Attacks ships only | Allied subs / U-boat |
| Landing Craft | Amphibious transport | Carries 2 land units of any type. Unloads onto beach tiles. Unarmed | LCT, LST / (rare) |
| Torpedo Boat | Cheap anti-ship raider | Fast, fragile | PT boat, MTB / E-boat (S-boot) |

Carrier: not included (mainly a Pacific unit). Revisit if a Pacific scenario is added.

## 5. Transport rules (summary; details in 05-supply-transport)

| Transport | Capacity | Can carry | Unload |
|---|---|---|---|
| Halftrack | 1 | Infantry, Assault Infantry, Mortar Team | Adjacent land tile |
| Transport Aircraft | 2 | Infantry, Assault Infantry, Mortar Team | Airborne drop (below) |
| Landing Craft | 2 | Any land unit | Adjacent beach tile (or land tile adjacent to its port/shoal position, TBD in 02-terrain) |

**Airborne drops (Transport Aircraft):**
- There is no separate Paratrooper unit. Any foot unit can be air-dropped.
- Foot units load at an airfield.
- After moving, the aircraft drops its passengers onto its own tile or adjacent tiles.
- Units cannot drop onto water or occupied tiles.
- Dropped units cannot act on the turn they land.
- The aircraft is reusable: it flies back to an airfield to refuel and load again.
- Possible later addition: a one-way **Glider** for specific scenarios that can carry a light vehicle. Not planned for now.

## 6. Fortifications, obstacles and engineering

- **Fortifications are terrain** with a large defense bonus (decided). They do nothing on their own; the defending player must place units on them. Atlantic Wall positions are only dangerous when occupied.
- **Clearing works like attacking**, similar to the original's breakable pipe seams. Fortifications and obstacles are terrain objects with HP. Units attack them; at 0 HP they become broken or cleared terrain.
- There is no separate engineer unit or special engineering action. Engineering is expressed through the damage chart: **Assault Infantry deals high damage to fortifications and obstacles.**
- To settle in 02-terrain: which units can attack these objects, their HP, what the broken versions become, and how attacking an occupied fortification works (attack the unit, the fortification, or both).

## 7. Cut or deferred

| Unit | Decision | Reason |
|---|---|---|
| Separate Engineer unit | Cut | Folded into Assault Infantry |
| Anti-tank gun | Cut | Overlaps with Tank Destroyer and Assault Infantry |
| Separate Paratrooper unit | Cut | Any foot unit can be air-dropped |
| Glider | Deferred | Possible scenario-specific addition |
| Carrier | Deferred | Pacific only |
| Fighter-Bomber | Cut | Fighters get weak ground attack; Bombers cover ground strike |

## 7a. Rocket artillery availability (historical note)

Rocket artillery was common on the Eastern Front: the Soviets (Katyusha) and Germans (Nebelwerfer, including Werfer units in Normandy) used it heavily. The Western Allies used it far less: the US Calliope saw limited use from summer 1944, the British Land Mattress from late 1944, and rocket-firing landing craft supported the D-Day beaches. Under the availability rule, Germany and the USSR get Rocket Artillery freely; US and UK availability is limited and decided per scenario.

## 8. Provisional stats (v0)

These are starting points for the first playable build, based on the original game's values and intuition. **They will be tuned after playtesting.** All numbers live in data files, so changing them is a data edit.

**Baseline assumptions:**
- Funds use the original's scale: a city pays about 1,000 per day, Infantry costs 1,000.
- Unit HP is 10 (displayed), as in the original.
- "—" means the unit has no weapon of that kind.
- Primary weapons use ammo; secondary weapons (machine guns, rifles) are unlimited.

### Land (phase 1 MVP)

| Unit | Cost | Move | Movement type | Vision | Fuel | Primary (ammo) | Secondary | Range |
|---|---|---|---|---|---|---|---|---|
| Infantry | 1,000 | 3 | Foot | 2 | 99 | — | Rifle/MG | 1 |
| Assault Infantry | 3,000 | 2 | Heavy foot | 2 | 70 | Bazooka (3) | MG | 1 |
| Mortar Team | 3,000 | 2 | Heavy foot | 2 | 70 | Mortar (3) | — | 2 |
| Recon | 4,000 | 8 | Wheels | 5 | 80 | — | MG | 1 |
| Halftrack | 5,000 | 6 | Tracks | 1 | 70 | — | — | — |
| Light Tank | 6,000 | 7 | Tracks | 3 | 70 | Gun (9) | MG | 1 |
| Medium Tank | 8,000 | 6 | Tracks | 2 | 70 | Gun (9) | MG | 1 |
| Tank Destroyer | 9,000 | 5 | Tracks | 2 | 60 | AT gun (6) | — | 1 |
| Heavy Tank | 15,000 | 4 | Tracks | 1 | 50 | Gun (8) | MG | 1 |
| Artillery | 6,000 | 5 | Tracks | 1 | 50 | Howitzer (9) | — | 2–3 |
| Rocket Artillery | 14,000 | 5 | Wheels | 1 | 50 | Rockets (5) | — | 3–5 |
| Mobile AA | 8,000 | 6 | Tracks | 2 | 60 | AA guns (9) | — | 1 |

### Air and naval (phase 2, rougher)

| Unit | Cost | Move | Vision | Fuel | Fuel/day | Primary (ammo) | Secondary | Range | Carries |
|---|---|---|---|---|---|---|---|---|---|
| Flak Gun (land) | 11,000 | 3 (tracks) | 2 | 50 | — | Flak (6) | — | 3–5 | — |
| Fighter | 20,000 | 9 | 2 | 99 | 5 | Guns (9) | — | 1 | — |
| Bomber | 22,000 | 7 | 2 | 99 | 5 | Bombs (9) | — | 1 | — |
| Transport Aircraft | 10,000 | 8 | 2 | 99 | 4 | — | — | — | 2 foot |
| Battleship | 28,000 | 5 | 2 | 99 | 1 | Main guns (9) | — | 2–6 | — |
| Destroyer | 16,000 | 6 | 3 | 99 | 1 | Guns/depth charges (9) | AA guns | 1 | — |
| Submarine | 20,000 | 5 | 5 | 60 | 1 (5 dived) | Torpedoes (6) | — | 1 | — |
| Landing Craft | 12,000 | 6 | 1 | 99 | 1 | — | — | — | 2 land |
| Torpedo Boat | 8,000 | 7 | 3 | 60 | 1 | Torpedoes (4) | MG | 1 | — |

Fighter ground attack (strafing) uses the same guns, with very low damage values in the damage chart.

### Reasoning behind the main choices

- **Tank ladder:** Light (6k, fast, scouting armor) → Medium (8k, the workhorse, like the original's basic tank) → Heavy (15k, slow, thirsty, like the original's medium tank). The jump to Heavy is deliberately steep so it stays rare.
- **Tank Destroyer** costs a bit more than a Medium Tank and beats it, but has no machine gun and weaker defense, so cheap Infantry or Mortars can wear it down.
- **Mortar Team** costs the same as Assault Infantry: half the price of Artillery, with shorter range, little ammo and foot movement, but it can go where vehicles can't and ride in transports.
- **Recon** keeps the original's high movement and vision; it's the scouting unit for later fog of war.
- **Halftrack** stays unarmed for now; it is a transport and supply unit, not a fighter.

## 9. Unit stat schema (for data files)

Every unit type in the data files defines:

- `id`, display name, category (land / air / naval)
- `cost`
- `movePoints`, `movementType` (foot, heavyFoot, wheels, tracks, air, sea, landingCraft; costs per terrain in 02-terrain)
- `vision`
- `maxFuel`, `fuelPerDay` (air and naval)
- `primaryWeapon` + `maxAmmo` (may be none)
- `secondaryWeapon` (unlimited ammo; may be none)
- `attackRange` (min–max; direct = 1–1)
- `canMoveAndFire` (false for all indirect units)
- `canCapture`
- `transport`: capacity and allowed unit types (if any)
- `specialActions`: e.g. resupply, airDrop, dive, unloadOnBeach
- Per-nation art references (sprite keys), used to apply the availability rule

All values pass through the modifier layer (master doc section 7).

## 10. Open questions

- Tuning the v0 stats through playtesting.
- Movement type list and terrain costs (02-terrain).
- Damage chart, including vs. fortifications and obstacles (03-combat).
- Can Heavy Tank fuel use or Rocket Artillery fragility be expressed through existing stats, or do they need special rules?
- Which nations get art for which unit types (full matrix), especially Axis naval units and Allied heavy armor.
