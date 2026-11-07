// Helpers for tiles drawn with depth: 16 wide by 32 tall, where the bottom 16 rows are the map
// cell and the top 16 are room for anything that rises above it. Light comes from the top left,
// so shadows fall to the lower right. Rules: docs/08-art-pipeline.md §16.

export const WIDTH = 16;
export const HEIGHT = 32;
/** The first row of the map cell. Everything above it overlaps the tile behind. */
export const CELL = 16;

// Shadow darkens whatever ground it falls on. Each ground color has a shaded twin, written with its
// own character so the sheets stay fully opaque on the ground.
const SHADOW = [0x1c, 0x34, 0x12];
const SHADOW_STRENGTH = 0.42;
const SHADE = { G: "1", g: "2", h: "3", a: "4", A: "5", i: "6", j: "7", k: "8", S: "9", l: "0", u: "!", r: "#", f: "@" };

/** Adds the shaded twin of each ground color to a palette. */
export function withShade(palette) {
  const out = { ...palette };
  for (const [base, twin] of Object.entries(SHADE)) {
    const hex = palette[base];
    if (!hex) continue;
    const mixed = [1, 3, 5].map((i, k) => {
      const v = parseInt(hex.slice(i, i + 2), 16);
      return Math.round(v * (1 - SHADOW_STRENGTH) + SHADOW[k] * SHADOW_STRENGTH).toString(16).padStart(2, "0");
    });
    out[twin] = `#${mixed.join("")}`;
  }
  return out;
}

/** An empty 16x32 layer. */
export const layer = () => Array.from({ length: HEIGHT }, () => Array(WIDTH).fill("."));

export const put = (g, x, y, ch) => {
  if (x >= 0 && y >= 0 && x < WIDTH && y < HEIGHT) g[y][x] = ch;
};
export const rect = (g, x0, y0, x1, y1, ch) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, ch);
};
export const art = (g, rows, ox, oy) => rows.forEach((row, y) => [...row].forEach((ch, x) => {
  if (ch !== ".") put(g, ox + x, oy + y, ch);
}));

/**
 * Builds a finished tile: the 16x16 ground in the cell, the object's shadow falling to the lower
 * right across the ground, then the object itself.
 */
export function compose(ground, object, reach = 3) {
  const g = layer();
  ground.forEach((row, y) => [...row].forEach((ch, x) => put(g, x, CELL + y, ch)));
  const solid = (x, y) => object[y]?.[x] !== undefined && object[y][x] !== ".";
  for (let y = 0; y < HEIGHT; y++) {
    for (let x = 0; x < WIDTH; x++) {
      if (!solid(x, y)) continue;
      for (let k = 1; k <= reach; k++) {
        const tx = x + k, ty = y + Math.ceil(k / 2);
        if (ty >= CELL && ty < HEIGHT && tx < WIDTH && !solid(tx, ty)) g[ty][tx] = SHADE[g[ty][tx]] ?? g[ty][tx];
      }
    }
  }
  object.forEach((row, y) => row.forEach((ch, x) => {
    if (ch !== ".") g[y][x] = ch;
  }));
  return g.map((r) => r.join(""));
}

/** A flat 16x16 tile placed in the cell, with nothing above it. */
export const flat = (rows) => [...Array(CELL).fill(".".repeat(WIDTH)), ...rows];

/**
 * A building seen from the front and a little above: a front wall, a side wall receding up and to
 * the right, and a pitched roof in the owner's color (L light, M mid, D dark).
 */
export function house(g, { x, base, w, h, d = 2, roof = 3, door, windows = true }) {
  const top = base - h + 1;
  // Side wall, shaded, stepping up one row per column as it recedes.
  for (let i = 0; i < d; i++) {
    const cx = x + w + i;
    for (let y = top - i - 1; y <= base - i - 1; y++) put(g, cx, y, i === d - 1 ? "K" : "Y");
    put(g, cx, base - i, "K");
  }
  // Front wall.
  rect(g, x, top, x + w - 1, base, "W");
  for (let y = top; y <= base; y++) put(g, x, y, "K");
  rect(g, x, base, x + w - 1, base, "K");
  rect(g, x + 1, base - 1, x + w - 1, base - 1, "Y");
  if (windows) for (let wx = x + 2; wx < x + w - 1; wx += 3) {
    put(g, wx, top + 1, "c");
    put(g, wx, top + 2, "K");
  }
  if (door !== undefined) rect(g, door, base - 3, door + 1, base - 1, "B");
  // Roof: front slope over the wall, running back over the side wall.
  for (let r = 0; r < roof; r++) {
    const y = top - 1 - r;
    const ch = r === 0 ? "D" : r === roof - 1 ? "L" : "M";
    rect(g, x - 1, y, x + w - 1, y, ch);
    put(g, x - 1, y, "K");
    for (let i = 0; i < d; i++) put(g, x + w + i, y - i - 1, r === roof - 1 ? "M" : "D");
  }
  const ridge = top - 1 - roof;
  rect(g, x - 1, ridge, x + w - 1, ridge, "K");
  for (let i = 0; i < d; i++) put(g, x + w + i, ridge - i - 1, "K");
  put(g, x + w + d - 1, ridge - d + roof, "K");
}
