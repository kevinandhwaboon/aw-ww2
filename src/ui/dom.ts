// Small helpers shared by the HTML overlay panels (00-master-design §12).

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Terrain defense as stars, or a dash for none. */
export const stars = (n: number) => (n > 0 ? "★".repeat(n) : "–");

/**
 * A screen's title with a Back button before it, which does what X does. Phones have no keyboard and
 * no game pad on the menus, so without it a tap could never leave a screen.
 */
export function screenTitle(title: string | HTMLElement, onBack: () => void): HTMLElement {
  const row = el("div", "screen-top");
  const back = el("button", "btn screen-back", "‹ Back");
  back.type = "button";
  back.tabIndex = -1; // the arrow keys walk the screen's own choices, not this
  back.addEventListener("click", onBack);
  row.append(back, typeof title === "string" ? el("div", "panel-title", title) : title);
  return row;
}
