import { el } from "./dom";
import { menuKeys } from "./menuKeys";

/** Hot-seat: a full screen between turns, so players can swap seats. Resolves when they're ready. */
export function createHandoff(root: HTMLElement): { show: (title: string, detail: string, color: string) => Promise<void> } {
  const screen = el("div", "screen");
  screen.hidden = true;
  root.append(screen);
  return {
    show(title, detail, color) {
      return new Promise((resolve) => {
        const heading = el("div", "results-title", title);
        heading.style.color = color;
        const ready = el("button", "btn btn-big", "Ready");
        ready.addEventListener("click", () => {
          ready.blur(); // so the keyboard goes back to the map
          screen.hidden = true;
          resolve();
        });
        const panel = el("div", "panel screen-panel");
        panel.append(heading, el("div", "results-reason", detail || "Your turn"), ready);
        screen.replaceChildren(panel);
        screen.hidden = false;
        ready.focus();
        menuKeys(panel, [ready]);
      });
    },
  };
}

/** A big centered message shown briefly, e.g. at the start of each turn. */
export function createBanner(root: HTMLElement): { show: (text: string, color: string) => Promise<void> } {
  const banner = el("div", "banner");
  banner.hidden = true;
  root.append(banner);
  return {
    async show(text, color) {
      banner.textContent = text;
      banner.style.borderColor = color;
      banner.style.color = color;
      banner.hidden = false;
      await new Promise((resolve) => setTimeout(resolve, 900));
      banner.hidden = true;
    },
  };
}
