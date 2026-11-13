import { el } from "./dom";

/**
 * The on-screen game pad for phones held upright (phone prototype): a direction pad and the Z and X
 * buttons under the game screen. Each button stands for the same key as on the keyboard, and the
 * page decides where that key goes (an open menu or the map). The pad never decides anything itself.
 */

/** Holding a direction moves again after this long, then every REPEAT_MS. */
const REPEAT_DELAY_MS = 280;
const REPEAT_MS = 110;

export interface PadInput {
  /** A button went down (repeat: it's being held and fires again). */
  press(key: string, repeat: boolean): void;
  /** A button came back up. */
  release(key: string): void;
}

interface PadKey {
  readonly key: string;
  readonly label: string;
  readonly hint?: string;
  readonly className: string;
  readonly repeats: boolean;
}

const DIRECTIONS: readonly PadKey[] = [
  { key: "ArrowUp", label: "Up", className: "pad-up", repeats: true },
  { key: "ArrowLeft", label: "Left", className: "pad-left", repeats: true },
  { key: "ArrowRight", label: "Right", className: "pad-right", repeats: true },
  { key: "ArrowDown", label: "Down", className: "pad-down", repeats: true },
];

const ACTIONS: readonly PadKey[] = [
  { key: "x", label: "X", hint: "Back · Hold: range", className: "pad-x", repeats: false },
  { key: "z", label: "Z", hint: "Select · OK", className: "pad-z", repeats: false },
];

/** Shows the pad and lays the page out as a handheld: status on top, game screen, info, pad. */
export function mountPad(root: HTMLElement, input: PadInput): void {
  document.body.classList.add("pad-layout");
  const pad = el("div", "pad");
  // If a press ever fails, the reason shows on the pad instead of the button silently doing nothing.
  const problem = el("div", "pad-problem");
  problem.hidden = true;
  const safely = (action: () => void) => {
    try {
      action();
    } catch (error) {
      problem.textContent = `Button error: ${error instanceof Error ? error.message : String(error)}`;
      problem.hidden = false;
    }
  };
  const guarded: PadInput = {
    press: (key, repeat) => safely(() => input.press(key, repeat)),
    release: (key) => safely(() => input.release(key)),
  };
  const dpad = el("div", "pad-dpad");
  for (const k of DIRECTIONS) dpad.append(padButton(k, guarded));
  dpad.append(el("div", "pad-hub"));
  const actions = el("div", "pad-actions");
  for (const k of ACTIONS) actions.append(padButton(k, guarded));
  pad.append(problem, dpad, actions);
  root.append(pad);
}

function padButton(spec: PadKey, input: PadInput): HTMLElement {
  // A div, not a button: a button would take the focus away from the menu the key is meant for.
  const button = el("div", `pad-btn ${spec.className}`);
  button.append(el("span", "pad-label", spec.label));
  if (spec.hint) button.append(el("span", "pad-hint", spec.hint));
  let timer: number | undefined;
  let down = false;

  const start = () => {
    if (down) return;
    down = true;
    button.classList.add("pressed");
    input.press(spec.key, false);
    buzz();
    if (!spec.repeats) return;
    const again = () => {
      input.press(spec.key, true);
      timer = window.setTimeout(again, REPEAT_MS);
    };
    timer = window.setTimeout(again, REPEAT_DELAY_MS);
  };
  const stop = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    if (!down) return;
    down = false;
    button.classList.remove("pressed");
    input.release(spec.key);
  };

  // Fingers: touch events, the most dependable input on iPhones. Cancelling them stops the page
  // from scrolling, zooming or selecting text, and stops the mouse events a tap would also send.
  const touchOptions = { passive: false } as const;
  button.addEventListener("touchstart", (event) => { event.preventDefault(); start(); }, touchOptions);
  button.addEventListener("touchend", (event) => { event.preventDefault(); stop(); }, touchOptions);
  button.addEventListener("touchcancel", stop);
  // A mouse, for trying the layout on a computer with ?pad=on.
  button.addEventListener("mousedown", (event) => { event.preventDefault(); start(); });
  button.addEventListener("mouseup", stop);
  button.addEventListener("mouseleave", stop);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  return button;
}

/**
 * A short buzz on phones that allow it (Android). iPhones don't, and some browsers throw instead of
 * ignoring it, so it goes after the press and can never stop one.
 */
function buzz(): void {
  try {
    if ("vibrate" in navigator) navigator.vibrate(8);
  } catch {
    // No buzz on this phone.
  }
}
