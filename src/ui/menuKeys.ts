/**
 * Runs an HTML menu from the keyboard with the same keys as the map: arrows move between `items`,
 * Z, Enter or Space choose the focused one, and X, Esc or Backspace cancel. The menu keeps these
 * keys to itself, so the map behind it doesn't react.
 */
export function menuKeys(panel: HTMLElement, items: readonly HTMLElement[], onCancel?: () => void): void {
  panel.onkeydown = (event) => {
    event.stopPropagation();
    const { key, target } = event;
    const step = key === "ArrowDown" || key === "ArrowRight" ? 1 : key === "ArrowUp" || key === "ArrowLeft" ? -1 : 0;
    if (step !== 0) {
      event.preventDefault();
      const current = items.indexOf(target as HTMLElement);
      items[(current + step + items.length) % items.length]?.focus();
    } else if (["z", "Z", "Enter", " "].includes(key)) {
      event.preventDefault();
      if (!event.repeat && target instanceof HTMLElement) target.click();
    } else if (["x", "X", "Escape", "Backspace"].includes(key)) {
      event.preventDefault();
      if (!event.repeat) onCancel?.();
    }
  };
}
