// How a soldier goes down in a battle scene (08-art-pipeline §18), as a pure function of the time
// since he was hit. Each man topples about his own feet, so the gear around him stays where it is.

/** How long a fallen soldier stays on screen before he has faded away. */
export const FALL_MS = 1100;

export interface Fall {
  /** How far he has toppled backwards, in radians: a quarter turn is flat on his back. */
  readonly angle: number;
  /** How far a man lying prone sinks into the ground, in pixels. */
  readonly sink: number;
  readonly alpha: number;
}

const ramp = (t: number, a: number, b: number): number => Math.max(0, Math.min(1, (t - a) / (b - a)));

/** A standing or kneeling man pitches back in two jerks and lies flat; a prone man just slumps. */
export function fallAt(down: number, prone: boolean): Fall {
  if (prone) return { angle: 0, sink: Math.min(2, down / 100), alpha: 1 - ramp(down, 500, FALL_MS - 100) };
  const angle = down < 90 ? 0.5 : down < 180 ? 1.1 : Math.PI / 2;
  return { angle, sink: 0, alpha: 1 - ramp(down, 700, FALL_MS) };
}
