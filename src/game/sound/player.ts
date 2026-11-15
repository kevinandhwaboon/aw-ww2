// Plays sounds through Phaser's sound manager (16-sound). The browser part: which sounds play and
// when is decided in sounds.ts. Anything missing or blocked is silently skipped, so sound can never
// stop or slow the game.

import type Phaser from "phaser";
import { SOUND_VOLUME, type SoundCue, type SoundId } from "./sounds";
import { LEVEL_VOLUME, loadSoundLevel, saveSoundLevel, toggleMute, type SoundLevel } from "./settings";

/** The cache key for one of a sound id's files. */
export const soundKey = (id: SoundId, variant: number): string => `sound-${id}-${variant}`;

/** The device's storage, or null where the browser blocks it. */
function deviceStorage(): Storage | null {
  try {
    return window.localStorage;
  } catch {
    return null;
  }
}

type Options = Partial<Omit<SoundCue, "at" | "sound">>;

class SoundPlayer {
  private manager: Phaser.Sound.BaseSoundManager | null = null;
  /** How many files loaded for each sound id. */
  private variants = new Map<SoundId, number>();
  private playing = new Set<Phaser.Sound.BaseSound>();
  private current: SoundLevel = loadSoundLevel(deviceStorage());
  private lastHeard: SoundLevel = this.current;
  /** `?sound=off`: off for this visit, without changing the saved level. */
  private forcedOff = false;
  private listeners = new Set<(level: SoundLevel) => void>();

  /** Called by the map scene once its files have loaded, with the count of files for each id. */
  attach(manager: Phaser.Sound.BaseSoundManager, variants: ReadonlyMap<SoundId, number>): void {
    this.manager = manager;
    this.variants = new Map(variants);
    this.applyVolume();
  }

  /** Called when the game that owns the sound manager goes away. */
  detach(): void {
    this.stopAll();
    this.manager = null;
  }

  get level(): SoundLevel {
    return this.current;
  }

  setLevel(level: SoundLevel): void {
    this.forcedOff = false;
    this.current = level;
    if (level !== "off") this.lastHeard = level;
    saveSoundLevel(deviceStorage(), level);
    this.applyVolume();
    if (level === "off") this.stopAll();
    for (const listener of this.listeners) listener(level);
  }

  /** M: off, or back on at the level it was at. */
  toggleMute(): void {
    this.setLevel(toggleMute(this.current, this.lastHeard));
  }

  /** `?sound=off` starts this visit silent; picking a level afterwards turns it back on. */
  forceOff(): void {
    this.forcedOff = true;
    this.current = "off";
    this.applyVolume();
    for (const listener of this.listeners) listener("off");
  }

  /** Called whenever the level changes; returns a function that stops listening. */
  onChange(listener: (level: SoundLevel) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  play(id: SoundId, options: Options = {}): void {
    this.start(id, options, false);
  }

  playCue(cue: SoundCue): void {
    const sound = this.start(cue.sound, cue, cue.loopFor !== undefined);
    if (sound && cue.loopFor !== undefined) window.setTimeout(() => this.stop(sound), cue.loopFor);
  }

  /** Starts a sound looping; call the function it returns to stop it. */
  loop(id: SoundId, options: Options = {}): () => void {
    const sound = this.start(id, options, true);
    return () => {
      if (sound) this.stop(sound);
    };
  }

  /** Stops everything playing, e.g. when a battle scene is skipped. */
  stopAll(): void {
    for (const sound of [...this.playing]) this.stop(sound);
  }

  private get audible(): boolean {
    return this.manager !== null && !this.manager.locked && !this.forcedOff && this.current !== "off";
  }

  private applyVolume(): void {
    if (this.manager) this.manager.volume = this.forcedOff ? 0 : LEVEL_VOLUME[this.current];
  }

  private start(id: SoundId, options: Options, loop: boolean): Phaser.Sound.BaseSound | null {
    const files = this.variants.get(id) ?? 0;
    if (!this.audible || !this.manager || files === 0) return null;
    const variant = Math.min(files - 1, Math.floor((options.variant ?? 0) * files));
    try {
      const sound = this.manager.add(soundKey(id, variant), {
        volume: SOUND_VOLUME[id] * (options.volume ?? 1),
        detune: options.detune ?? 0,
        pan: options.pan ?? 0,
        loop,
      });
      this.playing.add(sound);
      sound.once("complete", () => this.stop(sound));
      sound.play();
      return sound;
    } catch (error) {
      console.warn(`Couldn't play sound ${id}:`, error);
      return null;
    }
  }

  private stop(sound: Phaser.Sound.BaseSound): void {
    if (!this.playing.delete(sound)) return;
    sound.stop();
    sound.destroy();
  }
}

/** The one sound player, shared by the map, the battle scenes and the HUD. */
export const sounds = new SoundPlayer();
