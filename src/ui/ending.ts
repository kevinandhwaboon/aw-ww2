// The campaign's ending on screen (22-campaign §7a): the film full screen, its caption under it.
// Z (or a click) moves on to the next shot; X skips to the end; on the last shot Z finishes.

import { EndingRenderer } from "../game/ending/renderer";
import { SHOTS, shotAt, shotStart } from "../game/ending/plan";
import { el } from "./dom";

/** Plays the ending; `summary` is a line under the last shot. `onDone` runs once it's over. */
export function showEnding(root: HTMLElement, summary: string, onDone: () => void): void {
  const node = el("div", "screen ending");
  const canvas = el("canvas", "ending-canvas");
  const caption = el("div", "ending-caption");
  const line = el("div", "ending-summary");
  const hint = el("div", "screen-hint ending-hint", "Z next · X skip");
  node.append(canvas, caption, line, hint);
  root.append(node);
  node.tabIndex = -1;
  node.focus();

  const renderer = new EndingRenderer(canvas);
  let offset = 0;
  let started = performance.now();
  let frame = 0;
  let shown = -1;
  let done = false;
  const now = () => performance.now() - started + offset;
  const last = SHOTS.length - 1;

  const finish = () => {
    if (done) return;
    done = true;
    cancelAnimationFrame(frame);
    node.remove();
    onDone();
  };
  /** Jumps to the start of shot `index`. */
  const jump = (index: number) => {
    offset = shotStart(Math.min(index, last));
    started = performance.now();
  };
  const next = () => {
    const { index } = shotAt(now());
    if (index >= last) finish();
    else jump(index + 1);
  };

  const tick = () => {
    const t = now();
    renderer.render(t);
    const { shot, index } = shotAt(t);
    if (index !== shown) {
      shown = index;
      caption.textContent = shot.caption;
      caption.classList.toggle("ending-title", shot.id === "title" || shot.id === "end");
      line.textContent = shot.id === "end" ? summary : "";
      hint.textContent = index >= last ? "Z continue" : "Z next · X skip";
    }
    frame = requestAnimationFrame(tick);
  };
  frame = requestAnimationFrame(tick);

  node.addEventListener("click", next);
  node.addEventListener("keydown", (event) => {
    event.stopPropagation();
    if (event.repeat) return;
    if (["z", "Z", "Enter", " "].includes(event.key)) {
      event.preventDefault();
      next();
    } else if (["x", "X", "Escape", "Backspace"].includes(event.key)) {
      event.preventDefault();
      if (shotAt(now()).index >= last) finish();
      else jump(last);
    }
  });
}
