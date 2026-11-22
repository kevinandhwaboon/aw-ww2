import { NO_KEYS_HELD, readControllers, type PadSnapshot } from "./gamepadKeys";

/**
 * Starts listening to controllers for the life of the page. Keys go where a real key press would:
 * to the focused element (a menu button), or the page itself, and bubble up from there.
 */
export function startGamepad(): void {
  if (typeof navigator.getGamepads !== "function") return;
  let state = NO_KEYS_HELD;
  const snapshots = (): PadSnapshot[] =>
    navigator.getGamepads().flatMap((pad) =>
      pad && pad.connected ? [{ pressed: pad.buttons.map((b) => b.pressed), axes: pad.axes }] : [],
    );
  const tick = (now: number) => {
    const read = readControllers(state, snapshots(), now);
    state = read.state;
    for (const action of read.actions) {
      const target = document.activeElement instanceof HTMLElement ? document.activeElement : document.body;
      target.dispatchEvent(new KeyboardEvent(action.type, { key: action.key, repeat: action.repeat, bubbles: true, cancelable: true }));
    }
    window.requestAnimationFrame(tick);
  };
  window.requestAnimationFrame(tick);
}
