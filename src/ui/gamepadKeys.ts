/**
 * Game controllers (an Xbox pad, the ROG Ally's built-in controls, …) through the browser's Gamepad
 * API (11-tech-setup §3c). Each button stands for a keyboard key and is sent as that key, so the
 * page reacts exactly as it would to the keyboard: A is Z, B is X, the D-pad and left stick are
 * the arrow keys. The controller never decides anything itself.
 *
 * This file is the pure part (no DOM, so tests check it without a browser); gamepad.ts reads the
 * controllers and sends the keys.
 */

/** Holding a direction moves again after this long, then every REPEAT_MS (as the on-screen pad). */
export const REPEAT_DELAY_MS = 280;
export const REPEAT_MS = 110;
/** How far the stick must lean before it counts as a direction. */
export const STICK_DEADZONE = 0.5;

/** Buttons in the browser's "standard" controller layout (the Xbox layout). */
const BUTTON_KEYS: readonly (readonly [index: number, key: string])[] = [
  [0, "z"], // A: select, OK
  [1, "x"], // B: back; hold for a unit's range
  [12, "ArrowUp"],
  [13, "ArrowDown"],
  [14, "ArrowLeft"],
  [15, "ArrowRight"],
];

const DIRECTIONS = new Set(["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"]);

/** What a controller looks like at one moment: which buttons are down and where the stick leans. */
export interface PadSnapshot {
  readonly pressed: readonly boolean[];
  readonly axes: readonly number[];
}

/** The keys held down so far, each with when it next repeats (directions only). */
export interface ControllerState {
  readonly held: Readonly<Record<string, number>>;
}

export interface KeyAction {
  readonly type: "keydown" | "keyup";
  readonly key: string;
  readonly repeat: boolean;
}

export const NO_KEYS_HELD: ControllerState = { held: {} };

/** The keys a controller is holding: its mapped buttons plus the left stick's strongest direction. */
export function keysDown(pads: readonly PadSnapshot[]): Set<string> {
  const keys = new Set<string>();
  for (const pad of pads) {
    for (const [index, key] of BUTTON_KEYS) if (pad.pressed[index]) keys.add(key);
    const x = pad.axes[0] ?? 0;
    const y = pad.axes[1] ?? 0;
    if (Math.max(Math.abs(x), Math.abs(y)) < STICK_DEADZONE) continue;
    if (Math.abs(x) > Math.abs(y)) keys.add(x > 0 ? "ArrowRight" : "ArrowLeft");
    else keys.add(y > 0 ? "ArrowDown" : "ArrowUp");
  }
  return keys;
}

/**
 * One look at the controllers: a key goes down when its button is first pressed, comes up when it
 * is let go, and a held direction presses again after a pause, then steadily.
 */
export function readControllers(
  before: ControllerState,
  pads: readonly PadSnapshot[],
  now: number,
): { state: ControllerState; actions: KeyAction[] } {
  const down = keysDown(pads);
  const actions: KeyAction[] = [];
  const held: Record<string, number> = {};
  for (const key of Object.keys(before.held)) {
    if (!down.has(key)) actions.push({ type: "keyup", key, repeat: false });
  }
  for (const key of down) {
    const next = before.held[key];
    if (next === undefined) {
      actions.push({ type: "keydown", key, repeat: false });
      held[key] = now + REPEAT_DELAY_MS;
    } else if (DIRECTIONS.has(key) && now >= next) {
      actions.push({ type: "keydown", key, repeat: true });
      held[key] = now + REPEAT_MS;
    } else {
      held[key] = next;
    }
  }
  return { state: { held }, actions };
}
