// Small helpers shared by the HTML overlay panels (00-master-design §12).

export function el<K extends keyof HTMLElementTagNameMap>(tag: K, className?: string, text?: string): HTMLElementTagNameMap[K] {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text !== undefined) node.textContent = text;
  return node;
}

/** Terrain defense as stars, or a dash for none. */
export const stars = (n: number) => (n > 0 ? "★".repeat(n) : "–");
