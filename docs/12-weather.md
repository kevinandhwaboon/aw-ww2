# Topic Doc 12: Weather

**Status:** v0 decided. Snow follows the original game's movement costs (default rule). Expect tuning after playtesting.
**Last updated:** 2026-11-08
**Depends on:** 00-master-design.md §7 (modifier layer), 02-terrain.md. **Feeds:** scenarios (13-scenarios-ardennes), 08-art-pipeline §21 (winter art).

---

## 1. Principles

1. Weather covers the whole map and lasts a whole day. Everyone plays the same day under the same sky.
2. **The scenario sets the weather in advance as a forecast**, a list of "from day N, the weather is X". There's no random weather in v0, so a player can plan around what's coming, and history can be followed (snow, then clear skies over Bastogne on 23 December). The original's random weather is a possible later option.
3. A scenario with no forecast is Clear all game.
4. Weather works only through the modifier layer: it adds to terrain movement costs, it never changes data tables. A commander or doctrine modifier can later stack on top of it.
5. **Snow on the ground is art, not a rule.** A scenario can say its map is in winter, and the map and battle scenes are then drawn snowy even under clear skies (§4). Only the day's weather changes movement.

## 2. Weather types

| Weather | Effect |
|---|---|
| **Clear** | None. The terrain table in 02-terrain §3 applies as written. |
| **Snow** | Higher movement costs for most units (§3). Combat, vision, fuel and income are unchanged. |

Rain is left for later: in the original's later games rain brings fog of war, which this game doesn't have yet (00-master-design §4).

## 3. Snow movement costs

Movement points to enter a tile in Snow. Only the cells that change from 02-terrain §3 are listed; everything else stays as in the clear-weather table, and impassable terrain stays impassable. Values follow the original game's snow table, mapped onto this game's movement types and new terrain.

| Terrain | foot | heavyFoot | wheels | tracks | air | sea | landingCraft |
|---|---|---|---|---|---|---|---|
| Plains | **2** | 1 | **3** | **2** | **2** | | |
| Forest | **2** | 1 | **4** | **3** | **2** | | |
| Hills | **4** | **2** | — | — | **2** | | |
| Bocage | **2** | 1 | — | **4** | **2** | | |
| Rubble | **2** | 1 | **3** | **2** | **2** | | |
| Sea | | | | | **2** | **2** | **2** |
| Port | 1 | 1 | 1 | 1 | **2** | **2** | **2** |
| Beach | 1 | 1 | 1 | 1 | **2** | | **2** |
| Every other tile | unchanged | unchanged | unchanged | unchanged | **2** | unchanged | unchanged |

What it means in play:

- **Roads, bridges and towns cost the same as in clear weather**, so in snow armor has to stay on the roads. Crossroad towns matter more.
- Foot soldiers (Infantry) slow down off-road; heavy foot (Assault Infantry, Mortar Team) only in the hills, as Mech does in the original.
- **Every tile costs aircraft 2**, which halves how far they fly. They still burn the same fuel per day.
- Ships pay double on open water and in port.

## 4. When the weather changes

- The weather for a day is the forecast's last entry whose start day is that day or earlier.
- It changes as a new day starts, before the first player's turn: a `weatherChanged` event is raised with the new weather, after the `dayStarted` event. Day 1 raises no event; the starting weather is simply shown.
- A unit's moves are worked out with the weather of the day it moves in. Nothing is recalculated for units that already moved.

## 5. Showing the weather

- The HUD shows the day's weather next to the day number.
- When the weather changes, a short banner names the new weather.
- Snow falls over the map and in battle scenes while it's snowing.
- A winter scenario's map uses the art pack's winter terrain and buildings (08-art-pipeline §21), and its battle scenes use snowy ground and trees. Under Snow the battle sky is overcast and snow falls; under Clear the sky is blue over the snow.

## 6. Scenario format

```json
"weather": {
  "season": "winter",
  "forecast": [{ "fromDay": 1, "weather": "snow" }, { "fromDay": 6, "weather": "clear" }]
}
```

- `season`: `"summer"` (default) or `"winter"`. Drawing only.
- `forecast`: optional; the first entry must start on day 1, and start days must rise.

## 7. Open questions

- Random weather as a scenario or game option.
- Rain, once fog of war exists.
- Whether Snow should cost more fuel (some later games in the series did this) or slow supply.
