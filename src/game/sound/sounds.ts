// Which sounds play, and when (16-sound). Pure data and pure functions: the browser part that
// actually plays them is player.ts. Sound never affects the rules; it plays what the engine decided.

import type { GameEvent } from "../../engine/commands";
import { FOOT_UNITS, type UnitTypeId } from "../../engine/data/units";
import { DROP_MS, jumpTimes, type DropPlan } from "../battle/drop";
import { squadWeapon, type BattlePlan, type FigureKind, type FireKind, type HalfId } from "../battle/plan";
import { coverFigures, coverShotTimes, isFollowUp, lastInside, stormTimes, type StormPlan } from "../battle/storm";
import { hash, type Timeline } from "../battle/timeline";
import { moveStyle } from "../facing";

/** Every sound the game can play (16-sound §4). An art pack names files for these ids. */
export const SOUND_IDS = [
  "fireRifle",
  "fireMg",
  "fireBazooka",
  "fireMortar",
  "fireCannon",
  "fireHowitzer",
  "fireRockets",
  "bombWhistle",
  "waterSplash",
  "impactBullet",
  "impactShell",
  "explosion",
  "moveFoot",
  "moveWheels",
  "moveTracks",
  "moveAir",
  "moveNaval",
  "chute",
  "captured",
  "built",
  "alert",
  "supply",
  "turnStart",
  "gameOver",
  "uiSelect",
  "uiCancel",
] as const;

export type SoundId = (typeof SOUND_IDS)[number];

/** How loud each sound plays, before the player's volume setting (16-sound §5). */
export const SOUND_VOLUME: Record<SoundId, number> = {
  fireRifle: 0.5,
  fireMg: 0.35,
  fireBazooka: 0.6,
  fireMortar: 0.6,
  fireCannon: 0.7,
  fireHowitzer: 0.8,
  fireRockets: 0.5,
  bombWhistle: 0.3,
  waterSplash: 0.55,
  impactBullet: 0.2,
  impactShell: 0.55,
  explosion: 0.8,
  moveFoot: 0.4,
  moveWheels: 0.25,
  moveTracks: 0.25,
  moveAir: 0.25,
  moveNaval: 0.25,
  chute: 0.4,
  captured: 0.35,
  built: 0.5,
  alert: 0.3,
  supply: 0.3,
  turnStart: 0.3,
  gameOver: 0.4,
  uiSelect: 0.15,
  uiCancel: 0.15,
};

/** The sound of each weapon firing (16-sound §4). Infantry's automatic weapons fire `fireMg` instead. */
export const FIRE_SOUND: Record<FireKind, SoundId> = {
  rifle: "fireRifle",
  mg: "fireMg",
  bazooka: "fireBazooka",
  mortar: "fireMortar",
  tankGun: "fireCannon",
  howitzer: "fireHowitzer",
  rockets: "fireRockets",
  aaGuns: "fireMg",
  flak: "fireCannon",
  planeGuns: "fireMg",
  bombs: "bombWhistle",
  diveBomb: "bombWhistle",
  aerialTorpedo: "waterSplash",
  navalGuns: "fireHowitzer",
  deckGun: "fireCannon",
  depthCharges: "waterSplash",
  torpedo: "waterSplash",
};

/** The sound of each weapon's shot landing, and how loud relative to the sound's own volume. */
export const IMPACT_SOUND: Record<FireKind, { readonly sound: SoundId; readonly volume: number }> = {
  rifle: { sound: "impactBullet", volume: 1 },
  mg: { sound: "impactBullet", volume: 1 },
  bazooka: { sound: "impactShell", volume: 1 },
  mortar: { sound: "impactShell", volume: 1 },
  tankGun: { sound: "impactShell", volume: 1 },
  howitzer: { sound: "explosion", volume: 0.7 },
  rockets: { sound: "explosion", volume: 0.6 },
  aaGuns: { sound: "impactBullet", volume: 1 },
  flak: { sound: "impactShell", volume: 0.8 },
  planeGuns: { sound: "impactBullet", volume: 1 },
  bombs: { sound: "explosion", volume: 0.7 },
  diveBomb: { sound: "explosion", volume: 0.7 },
  aerialTorpedo: { sound: "explosion", volume: 0.7 },
  navalGuns: { sound: "explosion", volume: 0.7 },
  deckGun: { sound: "impactShell", volume: 1 },
  depthCharges: { sound: "explosion", volume: 0.6 },
  torpedo: { sound: "explosion", volume: 0.7 },
};

/** Anything destroyed explodes at full volume and a little deeper than a shell landing (16-sound §4). */
export const DESTROYED = { sound: "explosion", volume: 1.25, detune: -300 } as const satisfies { sound: SoundId; volume: number; detune: number };

/** Vehicles on tracks clank; everything else on the ground with an engine rolls on wheels. */
const TRACKED: readonly UnitTypeId[] = ["lightTank", "mediumTank", "heavyTank", "tankDestroyer"];

/** The loop that plays while a unit moves on the map (16-sound §3). */
export function moveSound(type: UnitTypeId): SoundId {
  switch (moveStyle(type)) {
    case "foot":
      return "moveFoot";
    case "air":
      return "moveAir";
    case "naval":
      return "moveNaval";
    case "vehicle":
      return TRACKED.includes(type) ? "moveTracks" : "moveWheels";
  }
}

/** The sound for a map event that has one of its own, played as the event plays (16-sound §3). */
export function mapEventSound(event: GameEvent): SoundId | null {
  switch (event.type) {
    case "unitBuilt":
      return "built";
    case "unitAmbushed":
      return "alert";
    case "unitDived":
    case "unitSurfaced":
      return "waterSplash";
    default:
      return null;
  }
}

/** One sound to play at a moment in a scene. */
export interface SoundCue {
  /** When, in ms from the scene's start. */
  readonly at: number;
  readonly sound: SoundId;
  /** Relative to the sound's own volume (SOUND_VOLUME). */
  readonly volume: number;
  /** -1 full left to 1 full right. */
  readonly pan: number;
  /** Pitch change in cents (100 = a semitone). */
  readonly detune: number;
  /** 0 to 1: which of the sound's files plays, when the pack gives several (16-sound §5). */
  readonly variant: number;
  /** Loop the sound for this long, in ms, instead of playing it once. */
  readonly loopFor?: number;
}

/** The same sound starting sooner than this after itself is dropped (16-sound §5). */
export const SAME_SOUND_GAP_MS = 40;
/** How far a shot's pitch may move either way, in cents: 0.6 of a semitone (16-sound §5). */
export const PITCH_SPREAD_CENTS = 60;
/** Where the two halves of a battle scene are heard. */
const HALF_PAN: Record<HalfId, number> = { left: -0.35, right: 0.35 };

/**
 * Puts cues in time order and drops any that starts less than SAME_SOUND_GAP_MS after a kept cue of
 * the same sound. When two clash, the louder one is kept, at the earlier time.
 */
export function thinCues(cues: readonly SoundCue[]): SoundCue[] {
  const sorted = cues.map((cue, i) => ({ cue, i })).sort((a, b) => a.cue.at - b.cue.at || a.i - b.i);
  const kept: SoundCue[] = [];
  const last = new Map<SoundId, number>();
  for (const { cue } of sorted) {
    const index = last.get(cue.sound);
    const previous = index === undefined ? undefined : kept[index];
    if (index !== undefined && previous && cue.at - previous.at < SAME_SOUND_GAP_MS) {
      if (cue.volume > previous.volume) kept[index] = { ...cue, at: previous.at };
      continue;
    }
    last.set(cue.sound, kept.length);
    kept.push(cue);
  }
  return kept;
}

/** A small pitch change and a variant pick, fixed by the values given, so a scene always sounds the same. */
function vary(...seed: number[]): Pick<SoundCue, "detune" | "variant"> {
  return { detune: Math.round((hash(...seed, 11) * 2 - 1) * PITCH_SPREAD_CENTS), variant: hash(...seed, 13) };
}

const isSoldier = (kind: FigureKind): boolean => (FOOT_UNITS as readonly string[]).includes(kind);

/**
 * A battle scene's sounds (16-sound §3): each shot as it leaves the muzzle, its impact as it lands,
 * and an explosion when a shot knocks out a machine or a bunker. Soldiers fall without one.
 */
export function battleCues(plan: BattlePlan, timeline: Timeline): SoundCue[] {
  const cues: SoundCue[] = [];
  timeline.shots.forEach((shot, i) => {
    const strike = plan.strikes[shot.strike];
    if (!strike) return;
    const shooter = plan[shot.from];
    const target = plan[shot.from === "left" ? "right" : "left"];
    const automatic = strike.fire === "rifle" && shooter.kind === "infantry"
      && squadWeapon(shot.shooterFigure, shooter.nation, shooter.paratrooper) !== "rifle";
    const fire = automatic ? "fireMg" : FIRE_SOUND[strike.fire];
    const impact = IMPACT_SOUND[strike.fire];
    if (shot.kills && !isSoldier(target.kind)) {
      cues.push({ at: shot.landAt, sound: DESTROYED.sound, volume: DESTROYED.volume, pan: HALF_PAN[target.half], ...vary(i, 3), detune: DESTROYED.detune });
    }
    cues.push({ at: shot.fireAt, sound: fire, volume: 1, pan: HALF_PAN[shooter.half], ...vary(i, 1) });
    cues.push({ at: shot.landAt, sound: impact.sound, volume: impact.volume, pan: HALF_PAN[target.half], ...vary(i, 2) });
  });
  return thinCues(cues);
}

/**
 * A capture or bunker scene's sounds (16-sound §3): the cover men's rifle shots, footsteps as each
 * soldier sets off, and the "captured" tune as the flags change when the capture completes.
 */
export function stormCues(plan: StormPlan): SoundCue[] {
  const cues: SoundCue[] = [];
  const times = stormTimes(plan);
  for (let i = 0; i < coverFigures(plan); i++) {
    coverShotTimes(times, i).forEach((at, k) => cues.push({ at, sound: "fireRifle", volume: 1, pan: -0.3, ...vary(i, k, 4) }));
  }
  times.forEach((time, i) => cues.push({ at: time.start, sound: "moveFoot", volume: 0.7, pan: 0, ...vary(i, 5) }));
  if (plan.captured) {
    // The flags start to change as the last man goes in, or as a follow-up's flag reaches the top.
    const at = lastInside(plan) + (isFollowUp(plan) ? 0 : 200);
    cues.push({ at, sound: "captured", volume: 1, pan: 0, detune: 0, variant: 0 });
  }
  return thinCues(cues);
}

/** An airborne drop's sounds (16-sound §3): the plane's engine while it crosses, and each canopy opening. */
export function dropCues(plan: DropPlan): SoundCue[] {
  const cues: SoundCue[] = [
    { at: DROP_MS.intro, sound: "moveAir", volume: 1, pan: 0, detune: 0, variant: 0, loopFor: DROP_MS.cross },
  ];
  jumpTimes(plan).forEach((jump, i) => {
    cues.push({ at: jump.exit + DROP_MS.freefall, sound: "chute", volume: 1, pan: 0, ...vary(i, 6) });
  });
  return thinCues(cues);
}

/** The cues that fall after `from` and up to and including `to`: what to play as a scene's clock moves on. */
export function cuesBetween(cues: readonly SoundCue[], from: number, to: number): SoundCue[] {
  return cues.filter((cue) => cue.at > from && cue.at <= to);
}
