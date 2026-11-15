// The sound level the player picks (16-sound §8): saved on the device, so it carries over between
// games and visits. Pure: storage is passed in, so the rules can be tested.

export const SOUND_LEVELS = ["off", "low", "medium", "high"] as const;
export type SoundLevel = (typeof SOUND_LEVELS)[number];

/** How loud each level plays everything. */
export const LEVEL_VOLUME: Record<SoundLevel, number> = { off: 0, low: 0.3, medium: 0.6, high: 1 };

/** Where to start when nothing is saved, or what's saved can't be read. */
export const DEFAULT_SOUND_LEVEL: SoundLevel = "medium";

/** The device's saved setting, under this name. */
export const SOUND_STORAGE_KEY = "ww2-tactics.sound";

/** The sound button goes Off → Low → Medium → High → Off. */
export function nextSoundLevel(level: SoundLevel): SoundLevel {
  return SOUND_LEVELS[(SOUND_LEVELS.indexOf(level) + 1) % SOUND_LEVELS.length] ?? DEFAULT_SOUND_LEVEL;
}

export function parseSoundLevel(saved: string | null): SoundLevel {
  return SOUND_LEVELS.find((level) => level === saved) ?? DEFAULT_SOUND_LEVEL;
}

/** Anything that stores text by name, like localStorage. */
export interface TextStore {
  getItem(key: string): string | null;
  setItem(key: string, value: string): void;
}

/** The saved level. Storage that's missing or blocked (a private window, say) just gives the default. */
export function loadSoundLevel(store: TextStore | null): SoundLevel {
  try {
    return parseSoundLevel(store?.getItem(SOUND_STORAGE_KEY) ?? null);
  } catch {
    return DEFAULT_SOUND_LEVEL;
  }
}

export function saveSoundLevel(store: TextStore | null, level: SoundLevel): void {
  try {
    store?.setItem(SOUND_STORAGE_KEY, level);
  } catch {
    // Not saved: it still applies for this visit.
  }
}

/** M turns sound off, and back on at the level it was at before (Medium if it was never on). */
export function toggleMute(level: SoundLevel, lastHeard: SoundLevel): SoundLevel {
  if (level !== "off") return "off";
  return lastHeard === "off" ? DEFAULT_SOUND_LEVEL : lastHeard;
}
