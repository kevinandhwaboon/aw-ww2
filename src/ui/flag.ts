import type { NationId } from "../engine/data/nations";
import { FLAG_COLORS, FLAGS } from "../game/placeholderFlags";
import { el } from "./dom";

/** A nation's small flag, drawn pixel for pixel. */
export function drawFlag(nation: NationId): HTMLCanvasElement {
  const rows = FLAGS[nation];
  const canvas = el("canvas", "flag");
  canvas.width = rows[0]?.length ?? 0;
  canvas.height = rows.length;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("2D canvas not available");
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      ctx.fillStyle = FLAG_COLORS[row.charAt(x)] ?? "";
      ctx.fillRect(x, y, 1, 1);
    }
  });
  return canvas;
}
