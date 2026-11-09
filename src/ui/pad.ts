import { el } from "./hud";

/**
 * The on-screen game pad for phones held upright (phone prototype): a direction pad and the Z and X
 * buttons under the game screen. Each button sends the same key the keyboard would, so the map and
 * every menu already know what to do with it. It never decides anything itself.
 */

/** Holding a direction moves again after this long, then every REPEAT_MS. */
const REPEAT_DELAY_MS = 280;
const REPEAT_MS = 110;

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
export function mountPad(root: HTMLElement): void {
  document.body.classList.add("pad-layout");
  const pad = el("div", "pad");
  const dpad = el("div", "pad-dpad");
  for (const k of DIRECTIONS) dpad.append(padButton(k));
  dpad.append(el("div", "pad-hub"));
  const actions = el("div", "pad-actions");
  for (const k of ACTIONS) actions.append(padButton(k));
  pad.append(dpad, actions);
  root.append(pad);
}

function padButton(spec: PadKey): HTMLElement {
  // A div, not a button: a button would take the focus away from the menu the key is meant for.
  const button = el("div", `pad-btn ${spec.className}`);
  button.append(el("span", "pad-label", spec.label));
  if (spec.hint) button.append(el("span", "pad-hint", spec.hint));
  let timer: number | undefined;
  const stop = () => {
    if (timer !== undefined) window.clearTimeout(timer);
    timer = undefined;
    if (!button.classList.contains("pressed")) return;
    button.classList.remove("pressed");
    send("keyup", spec.key, false);
  };
  button.addEventListener("pointerdown", (event) => {
    event.preventDefault();
    button.setPointerCapture(event.pointerId);
    button.classList.add("pressed");
    if ("vibrate" in navigator) navigator.vibrate(8); // Android only; iPhones have no web vibration
    send("keydown", spec.key, false);
    if (!spec.repeats) return;
    const again = () => {
      send("keydown", spec.key, true);
      timer = window.setTimeout(again, REPEAT_MS);
    };
    timer = window.setTimeout(again, REPEAT_DELAY_MS);
  });
  button.addEventListener("pointerup", stop);
  button.addEventListener("pointercancel", stop);
  button.addEventListener("contextmenu", (event) => event.preventDefault());
  return button;
}

/** Sent to whatever has the focus (an open menu), else the page, so it reaches the map. */
function send(type: "keydown" | "keyup", key: string, repeat: boolean): void {
  const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
  target.dispatchEvent(new KeyboardEvent(type, { key, repeat, bubbles: true, cancelable: true }));
}
