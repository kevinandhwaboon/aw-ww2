// Terrain tiles as pixel grids, 16 wide by 32 tall (docs/08-art-pipeline.md §16): flat ground fills
// the bottom 16 rows, and trees, hills, hedges and fortifications rise into the top 16 with shadows. Roads, rivers and shorelines are built from parts so every
// neighbor combination stays consistent. Sheet layout and joining rules: docs/08-art-pipeline.md §14.

import { art, compose, flat, layer, put, rect, withShade } from "./depth.mjs";

const SIZE = 16;

export const palette = withShade({
  G: "#8cc25a", g: "#74a848", h: "#a4d470", // grass
  T: "#3f8a3a", U: "#2a6430", V: "#62a848", n: "#5a4028", O: "#1c3a20", // trees
  q: "#b4cc72", w: "#8aa850", u: "#5e7a38", Q: "#3e5428", // hills
  e: "#2e4a22", E: "#456c2e", y: "#6a9440", // hedges
  S: "#3f86c8", s: "#3576b4", l: "#6aa8e0", f: "#e8f4f8", // water
  k: "#8a8a7a", K: "#4e4e44", j: "#b4b2a0", // rock
  a: "#e8d7a0", A: "#cdb67e", i: "#f6ecc8", // sand
  R: "#c8bc98", r: "#9a8c66", p: "#ddd4b4", // road
  b: "#a0804e", B: "#6e5434", x: "#3a2c1c", // bridge
});

// Small deterministic hash, so detail looks scattered but never changes between runs.
const hash = (x, y, salt = 0) => {
  let v = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177) >>> 0;
  return (v ^ (v >>> 16)) >>> 0;
};

const fill = (ch) => Array.from({ length: SIZE }, () => Array(SIZE).fill(ch));
const toRows = (g) => g.map((r) => r.join(""));
const inTile = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;

function grass(salt) {
  const g = fill("G");
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = hash(x, y, salt) % 40;
      if (v === 0) g[y][x] = "h";
      else if (v === 1) g[y][x] = "g";
    }
  }
  return g;
}

function plains(salt) {
  const g = grass(salt);
  // A few two-pixel tufts.
  for (let i = 0; i < 3; i++) {
    const x = 1 + (hash(i, salt, 7) % 13), y = 1 + (hash(salt, i, 9) % 13);
    g[y][x] = "g";
    g[y][x + 1] = "g";
    g[y - 1][x] = "h";
  }
  return toRows(g);
}

// A round broadleaf tree, lit from the top left, on a short trunk.
const tree = [
  "..OOOO..", ".OVVVTO.", "OVVVTTTO", "OVVTTTTO", "OVTTTTUO", "OTTTTUUO", ".OTTUUO.", "..OOOO..",
  "...On...", "...On...",
];
function forest(spots, salt) {
  const obj = layer();
  // Trees further back (higher up) go down first, so nearer ones overlap them.
  for (const [x, y] of [...spots].sort((p, q) => p[1] - q[1])) art(obj, tree, x, y);
  return compose(toRows(grass(salt)), obj);
}

// Grassy domes lit from the top left, rising above the tile, with a dark outline.
function hills(mounds, salt) {
  const obj = layer();
  for (const [cx, base, rx, ry] of mounds) {
    const shade = [];
    for (let y = base - ry; y <= base; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        const nx = (x - cx) / rx, ny = (y - base) / ry;
        if (nx * nx + ny * ny > 1) continue;
        const light = -(nx * 0.75 + ny * 0.55);
        shade.push([x, y, light > 0.5 ? "q" : light > 0.05 ? "w" : "u"]);
      }
    }
    const inside = new Set(shade.map(([x, y]) => `${x},${y}`));
    for (const [x, y, ch] of shade) {
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inside.has(`${x + dx},${y + dy}`));
      put(obj, x, y, edge ? "Q" : ch);
    }
    // A few tufts catching the light near the top.
    for (let i = 0; i < 3; i++) put(obj, cx - 2 + i * 2, base - ry + 3 + (i % 2), "h");
  }
  return compose(toRows(grass(salt)), obj);
}

// A small field enclosed by raised hedgerows: a leafy top, a darker face toward the viewer, and a
// shadow on the field. A gap in the hedge is a gate; extra hedges split the field.
function bocage(gate, extra, salt) {
  const obj = layer();
  const leaf = (x, y) => {
    const v = hash(x, y, salt + 3) % 6;
    put(obj, x, y, v === 0 ? "y" : v < 3 ? "E" : "T");
  };
  const band = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) leaf(x, y);
    rect(obj, x0, y1 + 1, x1, y1 + 1, "e");
  };
  band(0, 14, 15, 16);
  band(0, 28, 15, 30);
  band(0, 14, 2, 30);
  band(13, 14, 15, 30);
  for (const [x0, y0, x1, y1] of extra) band(x0, y0 + 16, x1, y1 + 16);
  const [gx0, gy0, gx1, gy1] = gate;
  rect(obj, gx0, gy0 + 16, gx1, gy1 + 16, ".");
  return compose(toRows(grass(salt)), obj, 2);
}

// Open water with short wave marks that drift right between frames.
function water(salt, frame) {
  const g = fill("S");
  for (let i = 0; i < 4; i++) {
    const x = (hash(i, salt, 1) % 13) + frame * 2, y = 1 + (hash(i, salt, 2) % 14);
    for (let d = 0; d < 3; d++) if (inTile((x + d) % SIZE, y)) g[y][(x + d) % SIZE] = "l";
    if (inTile((x + 1) % SIZE, y + 1)) g[y + 1][(x + 1) % SIZE] = "s";
  }
  return g;
}

function stamp(g, rows, ox, oy) {
  rows.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== "." && inTile(ox + x, oy + y)) g[oy + y][ox + x] = ch;
  }));
}

const rocks = [
  ["..KKK..", ".KjjkK.", "KjkkkkK", ".KkkKK.", "..KK..."],
  ["..KK.", ".KjkK", "KkkkK", ".KKK."],
];
function reef(frame) {
  const g = water(5, frame);
  const spots = [[2, 3, 0], [9, 8, 0], [10, 2, 1], [3, 10, 1]];
  for (const [x, y, r] of spots) {
    stamp(g, rocks[r], x, y);
    // Foam laps at the base of each rock.
    const w = rocks[r][0].length, h = rocks[r].length;
    for (let d = 0; d < w; d++) {
      if ((d + frame) % 2 === 0 && inTile(x + d, y + h) && g[y + h][x + d] !== "K") g[y + h][x + d] = "f";
    }
  }
  return toRows(g);
}

function beach(salt, pebbles) {
  const g = fill("a");
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      const v = hash(x, y, salt) % 30;
      if (v === 0) g[y][x] = "A";
      else if (v === 1) g[y][x] = "i";
    }
  }
  for (const [x, y] of pebbles) {
    g[y][x] = "k";
    g[y][x + 1] = "K";
  }
  return toRows(g);
}

// A concrete pillbox: a lit top, a front face with a firing slit, a shaded side, banked with earth.
function bunker() {
  const obj = layer();
  art(obj, [
    "...KKKKKKKK.....", "..KjjjjjjjjKK...", ".KjjjjjjjjjkkK..", ".KkkkkkkkkkkkK..",
    ".KkKKKKKKKKkkK..", ".KkkkkkkkkkkK...", "AKKKKKKKKKKKKA..", "AAuuuuuuuuuuuAA.",
  ], 0, 20);
  return compose(toRows(grass(30)), obj);
}

// What a destroyed bunker leaves: broken slabs and twisted rebar on scorched earth.
function rubble() {
  const ground = grass(31);
  for (let y = 3; y < 15; y++) for (let x = 1; x < 15; x++) if (hash(x, y, 32) % 3) ground[y][x] = hash(x, y, 33) % 4 ? "A" : "u";
  const obj = layer();
  art(obj, ["KKKK.", "KjkkK", ".KKKK"], 2, 19);
  art(obj, ["..KKK", ".KjkK", "KjkkK", "KKKK."], 9, 22);
  art(obj, ["KK.", "KjK", "KKK"], 4, 26);
  art(obj, ["x..", ".x.", ".xx"], 10, 17);
  art(obj, ["x.x", ".x."], 1, 28);
  return compose(toRows(ground), obj, 2);
}

// Dragon's teeth: staggered rows of concrete pyramids, lit on the left face.
function obstacle() {
  const obj = layer();
  const tooth = ["..K..", ".KjK.", ".jjkK", "KjjkK", "KKKKK"];
  for (const [x, y] of [[0, 14], [5, 14], [10, 14], [2, 19], [7, 19], [12, 19], [0, 25], [5, 25], [10, 25]]) art(obj, tooth, x, y);
  return compose(toRows(grass(34)), obj, 2);
}

// Directions in mask order: N=1, E=2, S=4, W=8.
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];

// Marks the cells covered by a centre square plus an arm toward each connected side.
function channel(mask, lo, hi) {
  const on = fill(false);
  const box = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) on[y][x] = true;
  };
  box(lo, lo, hi, hi);
  if (mask & 1) box(lo, 0, hi, hi);
  if (mask & 2) box(lo, lo, SIZE - 1, hi);
  if (mask & 4) box(lo, lo, hi, SIZE - 1);
  if (mask & 8) box(0, lo, hi, hi);
  return on;
}
const touches = (on, x, y, want) =>
  DIRS.some(([dx, dy]) => inTile(x + dx, y + dy) && on[y + dy][x + dx] === want);

function road(mask) {
  const g = grass(40 + mask);
  const on = channel(mask, 3, 12);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (!on[y][x]) continue;
      if (touches(on, x, y, false)) g[y][x] = "r";
      else g[y][x] = hash(x, y, 60 + mask) % 9 === 0 ? "p" : "R";
    }
  }
  return toRows(g);
}

function river(mask, frame) {
  const g = grass(80 + mask);
  const on = channel(mask, 4, 11);
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (on[y][x]) {
        // Ripples step one pixel along the flow each frame.
        const ripple = (x * 3 + y * 5 + frame * 4) % 13 === 0;
        g[y][x] = touches(on, x, y, false) ? "s" : ripple ? "l" : "S";
      } else if (touches(on, x, y, true)) {
        g[y][x] = "u";
      }
    }
  }
  return toRows(g);
}

// Bridges are drawn over a river tile, so everything but the deck is transparent.
function bridge(horizontal) {
  const g = fill(".");
  for (let a = 0; a < SIZE; a++) {
    for (let b = 3; b <= 12; b++) {
      const [x, y] = horizontal ? [a, b] : [b, a];
      const rail = b === 3 || b === 12;
      const seam = a % 4 === 3;
      g[y][x] = rail ? "x" : b === 4 || b === 11 ? "B" : seam ? "B" : "b";
    }
  }
  return toRows(g);
}

// Shore foam drawn over sea tiles next to land: edges N, E, S, W, then outer corners NE, SE, SW, NW.
function shoreEdge(dir, frame) {
  const g = fill(".");
  for (let a = 0; a < SIZE; a++) {
    for (let depth = 0; depth < 3; depth++) {
      let ch = null;
      if (depth === 0) ch = "f";
      else if (depth === 1) ch = (a + frame) % 3 === 0 ? "f" : "l";
      else if ((a + frame * 2) % 4 === 0) ch = "l";
      if (!ch) continue;
      const [x, y] = [[a, depth], [SIZE - 1 - depth, a], [a, SIZE - 1 - depth], [depth, a]][dir];
      g[y][x] = ch;
    }
  }
  return toRows(g);
}
function shoreCorner(corner, frame) {
  const g = fill(".");
  const flipX = corner === 0 || corner === 1, flipY = corner === 1 || corner === 2;
  const art = ["ffl", "fl.", frame ? "l.." : "..."];
  art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch === ".") return;
    g[flipY ? SIZE - 1 - y : y][flipX ? SIZE - 1 - x : x] = ch;
  }));
  return toRows(g);
}

// Every tile as [frame 0, frame 1]. Static tiles repeat the same grid in both frames.
const still = (rows) => [rows, rows];
const moving = (draw) => [draw(0), draw(1)];

// The sheet, 8 tiles across, in the order docs/08-art-pipeline.md §14 lists. Gaps stay empty.
export const layout = [
  ["plains", still(plains(1))], ["plains", still(plains(2))], ["plains", still(plains(3))],
  ["forest", still(forest([[1, 11], [8, 10], [4, 17], [10, 18]], 4))],
  ["forest", still(forest([[0, 14], [6, 11], [9, 16], [3, 19]], 5))],
  ["hills", still(hills([[7, 30, 8, 13]], 6))],
  ["hills", still(hills([[5, 28, 6, 11], [11, 31, 5, 9]], 7))],
  ["bocage", still(bocage([6, 12, 9, 15], [], 8))],
  ["bocage", still(bocage([0, 6, 2, 8], [[7, 2, 8, 13]], 9))],
  ["sea", moving((f) => toRows(water(3, f)))],
  ["reef", moving(reef)],
  ["beach", still(beach(10, [[4, 6], [11, 12]]))],
  ["beach", still(beach(11, [[9, 3]]))],
  ["bunker", still(bunker())], ["rubble", still(rubble())], ["obstacle", still(obstacle())],
  ...Array.from({ length: 16 }, (_, mask) => [`road-${mask}`, still(road(mask))]),
  ...Array.from({ length: 16 }, (_, mask) => [`river-${mask}`, moving((f) => river(mask, f))]),
  ["bridge-horizontal", still(bridge(true))], ["bridge-vertical", still(bridge(false))],
  ...[0, 1, 2, 3].map((d) => [`shore-${"NESW"[d]}`, moving((f) => shoreEdge(d, f))]),
  ...[0, 1, 2, 3].map((c) => [`shore-${["NE", "SE", "SW", "NW"][c]}`, moving((f) => shoreCorner(c, f))]),
];

// Flat tiles sit in the bottom half; raised ones already fill all 32 rows.
for (const entry of layout) {
  if (entry) entry[1] = entry[1].map((rows) => (rows.length === SIZE ? flat(rows) : rows));
}

export const ACROSS = 8;
export const TILE_HEIGHT = 32;
export const FRAMES = 2;

for (const entry of layout) {
  if (!entry) continue;
  const [name, frames] = entry;
  for (const rows of frames) {
    if (rows.length !== TILE_HEIGHT || rows.some((r) => r.length !== SIZE)) throw new Error(`${name}: not 16x32`);
    for (const ch of rows.join("")) if (ch !== "." && !palette[ch]) throw new Error(`${name}: no color for "${ch}"`);
  }
}
