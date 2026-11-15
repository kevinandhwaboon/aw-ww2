# Topic Doc 16: Sound

**Status:** v0 decided and built with placeholder sounds (2026-11-15). Real recorded sounds are still to pick (section 9).
**Last updated:** 2026-11-15
**Depends on:** 00-master-design.md (sections 11, 13), 08-art-pipeline.md (sections 13, 18–20, 22).

Sound effects only, for now: gunfire, explosions, units moving, and a few short cues for the game's own events. No music yet (section 10).

---

## 1. Rules

- **Sound never affects the rules.** Like art, sound plays events the engine has already decided. It lives in the presentation layer (`src/game/sound/`), and the engine knows nothing about it.
- **Only what the player can see makes a sound.** Sounds play from the same events the screen plays, after hidden units are filtered out (05-supply-transport §9), so a hidden submarine moving is never heard.
- **The same battle always sounds the same.** Which variant of a sound plays, and its small pitch change, come from a fixed hash of the shot, as the battle scene's looks do (08-art-pipeline §18). No randomness.
- **Silence is always allowed.** A sound that's missing, or won't load, or a browser that blocks audio, never stops or slows the game.

## 2. Licensing

The repository is public, so anyone can download every sound file from it. That rules out licenses that forbid handing out the raw files.

| License | Allowed? |
|---|---|
| CC0 (public domain) | **Yes, preferred.** No credit needed, but we still list the source |
| CC-BY (attribution) | Yes, with the author and link in the credits file |
| Sounds we make ourselves (the placeholder generator, sfxr-style tools) | Yes |
| CC-BY-NC (non-commercial), CC-BY-ND (no changes) | No |
| "Royalty-free, but no redistribution" (Sonniss GDC bundles, Pixabay, ZapSplat, BBC Sound Effects) | No: a public repo redistributes the files |

**Every sound file is listed** in `public/assets/sounds/CREDITS.md`: file name, where it came from (URL), author and license. A file not in the list doesn't go in.

**Good sources:** Kenney.nl (CC0), OpenGameArt.org (filter to CC0), Freesound.org (filter to CC0 or CC-BY; needs a free account to download).

## 3. What makes a sound

### Battle scenes (08-art-pipeline §18–20)

Sounds follow the scene's own timeline, so they land on the frame where the thing happens.

| Moment | Sound |
|---|---|
| A figure fires | Its weapon's firing sound (section 4), when the shot leaves the muzzle |
| A shot lands | The weapon's impact sound, if it has one |
| A machine (vehicle, aircraft, ship) or a bunker is knocked out | An explosion, as the shot that kills it lands |
| A soldier falls | Nothing extra |
| Capture: the cover men fire | A rifle shot each time one fires |
| Capture: soldiers run in, or go into a bunker | Footsteps as each one sets off |
| Capture completed | The "captured" tune as the flags change |
| Airborne drop | The plane's engine while it crosses, and a canopy snapping open for each man |

Shots from the left half are heard a little to the left and shots landing on the right half a little to the right. Skipping a scene stops its sounds.

### On the map

| Moment | Sound |
|---|---|
| A unit moves | A loop for how it moves, for as long as it moves: footsteps (foot soldiers), wheels (jeeps, halftracks, trucks, towed guns), tracks (tanks, tank destroyers), propellers (aircraft), engine and wake (ships) |
| An attack plays on the map (battle scenes off) | The attacker's firing sound, the impact on the target, and an explosion if it's destroyed; then the same for the counter |
| A unit is destroyed after a battle scene, or runs out of fuel | An explosion |
| A property is captured (battle scenes off) | The "captured" tune |
| A unit is built | A short clank |
| A submarine dives or surfaces | A splash |
| A unit is ambushed | An alert |
| Units are repaired or resupplied at turn start | One soft chime, however many units |

### The game and the controls

| Moment | Sound |
|---|---|
| A turn starts (with the Day banner) | A short two-note call |
| The game ends | A short fanfare |
| Z, Enter, a click or a menu choice | A soft click |
| X or Escape (cancel) | A lower click |

Moving the cursor makes no sound.

## 4. Sound list

Each sound has an id, which is what an art pack names (section 7). Several weapons share a sound.

| Sound id | Used for |
|---|---|
| `fireRifle` | Rifles: Infantry riflemen, cover fire in captures |
| `fireMg` | Machine guns, one per shot: submachine guns, light machine guns, the `mg`, `aaGuns` and `planeGuns` weapons |
| `fireBazooka` | `bazooka` |
| `fireMortar` | `mortar` |
| `fireCannon` | `tankGun`, `flak`, `deckGun` |
| `fireHowitzer` | `howitzer`, `navalGuns` |
| `fireRockets` | `rockets` |
| `bombWhistle` | `bombs`, `diveBomb` (when the bomb leaves the aircraft) |
| `waterSplash` | `torpedo`, `aerialTorpedo`, `depthCharges` (as they hit the water); submarines diving and surfacing |
| `impactBullet` | Landing shots of rifles and machine guns |
| `impactShell` | Landing shots of `bazooka`, `tankGun`, `flak`, `deckGun`, `mortar` |
| `explosion` | Landing shots of `howitzer`, `rockets`, `bombs`, `diveBomb`, `navalGuns`, torpedoes and depth charges (a little quieter); anything destroyed (full volume, a little deeper) |
| `moveFoot`, `moveWheels`, `moveTracks`, `moveAir`, `moveNaval` | Moving on the map (loops), footsteps in captures, the plane in drops |
| `chute` | A parachute opening |
| `captured`, `built`, `alert`, `supply` | Map events (section 3) |
| `turnStart`, `gameOver` | Turn and game |
| `uiSelect`, `uiCancel` | Controls |

Which weapon uses which sound is data in `src/game/sound/sounds.ts`, next to how loud each one plays.

## 5. Mixing

- **The same sound starting less than 40 ms after itself is dropped.** A squad firing together, or a machine gun burst, would otherwise stack dozens of copies into a loud smear.
- **Each shot's pitch moves up or down by up to 0.6 of a semitone**, fixed by the shot, so a burst doesn't sound like one sample repeated.
- **Sound ids with several files** (section 7) pick one per shot the same way.

## 6. Files and delivery

- Sound files are ordinary static files next to the game on GitHub Pages. They are **downloaded with the art when a game starts, not streamed**, and the browser keeps them for the next visit. Short effects need to play the instant they're asked for, which streaming can't do.
- **Format:** WAV for the placeholders. Real sounds should be MP3 (every browser plays it), mono, kept short. A full set should stay under about 1 MB.
- Browsers only allow sound after the player has clicked, tapped or pressed a key on the page. Nothing that happens before that is heard, and the game doesn't wait for it.

## 7. Sounds in art packs

Sounds come from the active art pack (08-art-pipeline §13), the same way sprites do, so changing a sound is a data edit and needs no rebuild.

| Field | What it does |
|---|---|
| `sounds` | Sound ids (section 4) to a file, or a list of files to pick from (section 5). Paths are relative to the pack's folder, like every pack path |

A sound id the pack leaves out is silent. The default pack points at the files in `public/assets/sounds/`.

## 8. Controls

- **Sound button** in the HUD: each click goes Off → Low → Medium → High → Off. The level is saved on the device. It starts at Medium.
- **M** turns sound off, and on again at the level it was at.
- `?sound=off` starts with sound off without changing the saved level (11-tech-setup §7).

## 9. Placeholder sounds

Until real sounds are picked, every sound id has a placeholder made by `npm run sounds` (`tools/audio/placeholders.mjs`). It builds each one from tones and noise, written as WAV into `public/assets/sounds/`, and always makes exactly the same files. They are ours, so they carry no license conditions. They sound like an old console's effects: good enough to check timing and balance, not the final sound.

**To replace one:** put the new file in `public/assets/sounds/`, point the sound id at it in `public/assets/packs/default/pack.json`, and add it to `CREDITS.md`.

## 10. Not done yet

Real recorded sounds; background music (a track a few MB long, which could stream instead of downloading first); sounds in the battle preview page; aircraft engines heard during battle scenes; different sounds per nation (an MG 42 against a Browning); a separate volume for effects and music.
