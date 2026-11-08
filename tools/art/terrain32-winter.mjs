// Winter terrain for the 32-pixel grid (docs/08-art-pipeline.md §21): the same sheet layout as
// terrain32.mjs, so a pack's tile numbers work for both. Most tiles are the summer drawings in a
// winter palette (snow for grass, snowy hills and hedges, packed snow on the roads with muddy ruts,
// cold water); the forests are redrawn as snow-laden firs, as in the Ardennes.
import { compose, layer, put } from "./depth32.mjs";
import { withShade } from "./depth.mjs";
import { palette as summer } from "./terrain.mjs";
import { ACROSS, FRAMES, layout as summerLayout, TILE_HEIGHT, TILE_WIDTH } from "./terrain32.mjs";

export { ACROSS, FRAMES, TILE_HEIGHT, TILE_WIDTH };
const SIZE = 32;

// Shadows on snow fall blue, not green.
const SNOW_SHADOW = [0x2c, 0x3c, 0x64];

export const palette = withShade(
  {
    ...Object.fromEntries(Object.entries(summer).filter(([ch]) => !"1234567890!#@".includes(ch))),
    G: "#e6ecf2", g: "#c6d2de", h: "#fbfdff", // snow: drifts, dimples, glints
    T: "#2c5a40", U: "#1c3e30", V: "#3f7452", n: "#4a3424", O: "#10261c", // fir needles and trunks
    v: "#f4f8fc", z: "#bccadb", // snow lying on branches
    q: "#e8eef4", w: "#bfcad8", u: "#8494aa", Q: "#3e4a5e", // snowy hills, and the river banks
    e: "#2a3e2a", E: "#3e5a3a", y: "#eef3f8", // hedges dusted with snow
    S: "#33618c", s: "#284f76", l: "#6f97bc", f: "#e4f0f6", // cold water, ice at the edges
    a: "#dde5ee", A: "#c2ccd8", i: "#f6f9fc", // snow over sand
    R: "#cdc6b8", r: "#7a6650", p: "#e2ddd2", // packed, dirty snow and muddy ruts
    b: "#a08a6a", B: "#6a5640", x: "#3a2c1c", // bridge planks
  },
  SNOW_SHADOW,
  0.3,
);

const hash = (x, y, salt = 0) => {
  let v = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177) >>> 0;
  return (v ^ (v >>> 16)) >>> 0;
};

/** Snow cover: a few dimples and glints scattered by a fixed hash. */
function snow(salt) {
  return Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => {
    const v = hash(x, y, salt) % 40;
    return v === 0 ? "g" : v === 1 ? "h" : "G";
  }).join(""));
}

/**
 * A fir in three tiers, lit from the top left: snow lies along the top of each tier's left side,
 * needles darken toward the right, and a short trunk shows under the lowest tier.
 */
function fir(obj, cx, base, height) {
  const tierCount = 3;
  const top = base - height;
  const trunkTop = base - 2;
  put(obj, cx, trunkTop, "n"); put(obj, cx, trunkTop + 1, "n"); put(obj, cx - 1, trunkTop + 1, "O"); put(obj, cx + 1, trunkTop + 1, "O");
  put(obj, cx, base, "O");
  for (let t = 0; t < tierCount; t++) {
    const y0 = Math.round(top + (t * height) / 4.2);
    const y1 = Math.round(top + ((t + 1.6) * height) / 4.2);
    const maxHalf = 2.5 + t * 1.9;
    for (let y = y0; y <= Math.min(y1, trunkTop - 1); y++) {
      const half = Math.max(0.6, ((y - y0 + 1) / (y1 - y0 + 1)) * maxHalf);
      for (let x = Math.floor(cx - half); x <= Math.ceil(cx + half); x++) {
        const d = x - cx;
        if (Math.abs(d) > half + 0.25) continue;
        const edge = Math.abs(d) > half - 0.75 || y === y1;
        const rel = d / Math.max(1, half);
        let ch;
        if (edge) ch = y === y1 && d < 0 && hash(x, y, 3) % 2 ? "z" : "O";
        else if (y - y0 < 2 + t && rel < 0.15) ch = "v";
        else if (y === y1 - 1 && rel < -0.2) ch = "v";
        else if (rel < -0.35) ch = "V";
        else if (rel < 0.3) ch = "T";
        else ch = "U";
        if (ch === "v" && rel > -0.1 && hash(x, y, 9) % 3 === 0) ch = "z";
        put(obj, x, y, ch);
      }
    }
  }
  put(obj, cx, top - 1, "O");
}

function forest(trees, salt) {
  const obj = layer();
  for (const [x, base, h] of [...trees].sort((p, q) => p[1] - q[1])) fir(obj, x, base, h);
  return compose(snow(salt), obj);
}

/**
 * Snowy ridges: the summer domes' shading in snow colors, broken by dark rock outcrops on the shaded
 * side and a few small firs on the lower slopes, so they read as hills and not as drifts.
 */
function hills(mounds, salt) {
  const obj = layer();
  for (const [cx, base, rx, ry] of mounds) {
    const inside = new Set();
    const cells = [];
    for (let y = base - ry; y <= base; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const nx = (x - cx) / rx, ny = (y - base) / ry;
      if (nx * nx + ny * ny > 1) continue;
      inside.add(`${x},${y}`);
      cells.push([x, y, nx, ny]);
    }
    for (const [x, y, nx, ny] of cells) {
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inside.has(`${x + dx},${y + dy}`));
      const light = -(nx * 0.75 + ny * 0.55);
      let ch = light > 0.62 ? "h" : light > 0.38 ? "q" : light > 0.0 ? "w" : light > -0.3 ? "u" : "Q";
      // Rock shows through where the slope is steep and in shadow.
      if (!edge && nx > 0.1 && ny < -0.25 && hash(x >> 1, y >> 1, salt + cx) % 5 === 0) ch = hash(x, y, salt) % 3 ? "K" : "k";
      put(obj, x, y, edge ? "Q" : ch);
    }
    for (let i = 0; i < 3; i++) {
      const fx = cx - rx + 3 + (hash(i, cx, salt) % Math.max(1, 2 * rx - 6));
      const fy = base - 1 - (hash(cx, i, salt) % 4);
      if (inside.has(`${fx},${fy - 8}`)) fir(obj, fx, fy, 9);
    }
  }
  return compose(snow(salt), obj);
}

const still = (rows) => [rows, rows];
const FIRS = {
  // [x, base row, height], drawn back to front.
  3: [[7, 44, 20], [22, 42, 22], [14, 56, 23], [26, 58, 18], [4, 60, 16]],
  4: [[5, 48, 22], [17, 40, 20], [27, 50, 19], [12, 60, 21], [24, 62, 15]],
};

const HILLS = {
  // Same mounds as the summer tiles: [center x, base row, x radius, y radius].
  5: [[15, 61, 16, 27]],
  6: [[10, 57, 11, 22], [22, 63, 10, 18]],
};

export const layout = summerLayout.map(([name, frames], i) => {
  if (FIRS[i]) return [name, still(forest(FIRS[i], 20 + i))];
  if (HILLS[i]) return [name, still(hills(HILLS[i], 30 + i))];
  return [name, frames];
});

for (const [name, frames] of layout) for (const rows of frames) {
  if (rows.length !== TILE_HEIGHT || rows.some((r) => r.length !== TILE_WIDTH)) throw new Error(`${name}: not 32x64`);
  for (const ch of rows.join("")) if (ch !== "." && !palette[ch]) throw new Error(`winter ${name}: no color for "${ch}"`);
}
