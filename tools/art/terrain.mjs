// Terrain tiles as 16x16 pixel grids. Roads, rivers and shorelines are built from parts so every
// neighbor combination stays consistent. Sheet layout and joining rules: docs/08-art-pipeline.md §14.

const SIZE = 16;

export const palette = {
  G: "#8cc25a", g: "#74a848", h: "#a4d470", // grass
  T: "#3f8a3a", U: "#2a6430", V: "#62a848", n: "#5a4028", O: "#1c3a20", // trees
  q: "#b4cc72", w: "#8aa850", u: "#5e7a38", Q: "#3e5428", // hills
  e: "#2e4a22", E: "#456c2e", y: "#6a9440", // hedges
  S: "#3f86c8", s: "#3576b4", l: "#6aa8e0", f: "#e8f4f8", // water
  k: "#8a8a7a", K: "#4e4e44", j: "#b4b2a0", // rock
  a: "#e8d7a0", A: "#cdb67e", i: "#f6ecc8", // sand
  R: "#c8bc98", r: "#9a8c66", p: "#ddd4b4", // road
  b: "#a0804e", B: "#6e5434", x: "#3a2c1c", // bridge
};

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

const tree = [
  "..OOO..", ".OVVTO.", "OVVTTTO", "OVTTTUO", "OTTTUUO", ".OUUUO.", "..OnO..",
];
function stamp(g, art, ox, oy) {
  art.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== "." && inTile(ox + x, oy + y)) g[oy + y][ox + x] = ch;
  }));
}
function forest(spots, salt) {
  const g = grass(salt);
  for (const [x, y] of spots) stamp(g, tree, x, y);
  return toRows(g);
}

// A grassy mound lit from the top left, with a dark outline.
function hills(mounds, salt) {
  const g = grass(salt);
  for (const [cx, base, rx, ry] of mounds) {
    const shade = [];
    for (let y = base - ry; y <= base; y++) {
      for (let x = cx - rx; x <= cx + rx; x++) {
        const nx = (x - cx) / rx, ny = (y - base) / ry;
        if (nx * nx + ny * ny > 1 || !inTile(x, y)) continue;
        const light = -(nx * 0.7 + ny * 0.7);
        shade.push([x, y, light > 0.45 ? "q" : light > -0.15 ? "w" : "u"]);
      }
    }
    const inside = new Set(shade.map(([x, y]) => `${x},${y}`));
    for (const [x, y, ch] of shade) {
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inside.has(`${x + dx},${y + dy}`));
      g[y][x] = edge && y < base ? "Q" : ch;
    }
  }
  return toRows(g);
}

// A small field enclosed by hedgerows on every side, so it reads as hedge country and not woods.
// A gap in the hedge marks a gate; extra hedges split the field.
function bocage(gate, extra, salt) {
  const g = grass(salt);
  const hedge = (x, y) => {
    if (!inTile(x, y)) return;
    const v = hash(x, y, salt + 3) % 6;
    g[y][x] = v === 0 ? "y" : v < 3 ? "e" : "E";
  };
  for (let a = 0; a < SIZE; a++) {
    const depth = (side) => 2 + (hash(a, side, salt) % 2);
    for (let d = 0; d < depth(0); d++) hedge(a, d);
    for (let d = 0; d < depth(1); d++) hedge(SIZE - 1 - d, a);
    for (let d = 0; d < depth(2); d++) hedge(a, SIZE - 1 - d);
    for (let d = 0; d < depth(3); d++) hedge(d, a);
  }
  for (const [x0, y0, x1, y1] of extra) {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) hedge(x, y);
  }
  const [gx0, gy0, gx1, gy1] = gate;
  for (let y = gy0; y <= gy1; y++) for (let x = gx0; x <= gx1; x++) g[y][x] = "G";
  return toRows(g);
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

// A concrete pillbox with a firing slit, banked with earth and sandbags.
function bunker() {
  const g = grass(30);
  stamp(g, [
    "....KKKKKKKK....", "...KjjjjjjjjK...", "..KjkkkkkkkkkK..", "..KkKKKKKKKKkK..",
    "..KkkkkkkkkkkK..", ".KkkkkkkkkkkkkK.", "AKKKKKKKKKKKKKKA", "AAuuuuuuuuuuuuAA",
  ], 0, 5);
  return toRows(g);
}

// What a destroyed bunker leaves: broken slabs and twisted rebar on scorched earth.
function rubble() {
  const g = grass(31);
  for (let y = 3; y < 15; y++) for (let x = 1; x < 15; x++) if (hash(x, y, 32) % 3) g[y][x] = hash(x, y, 33) % 4 ? "A" : "u";
  stamp(g, ["KKKK.", "KjkkK", ".KKKK"], 2, 4);
  stamp(g, ["..KKK", ".KjkK", "KkkkK", "KKKK."], 9, 7);
  stamp(g, ["KKK", "KkK", "KKK"], 4, 10);
  stamp(g, ["x..", ".x.", ".xx"], 10, 2);
  stamp(g, ["x.x", ".x."], 1, 12);
  return toRows(g);
}

// Dragon's teeth: staggered rows of concrete pyramids.
function obstacle() {
  const g = grass(34);
  const tooth = ["..K..", ".KjK.", "KjkkK", "KKKKK"];
  for (const [x, y] of [[0, 1], [5, 1], [10, 1], [2, 6], [7, 6], [12, 6], [0, 11], [5, 11], [10, 11]]) stamp(g, tooth, x, y);
  return toRows(g);
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
  const on = channel(mask, 5, 10);
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
  ["forest", still(forest([[1, 1], [8, 0], [4, 7], [10, 8]], 4))],
  ["forest", still(forest([[0, 4], [6, 1], [9, 6], [3, 9]], 5))],
  ["hills", still(hills([[8, 14, 7, 9]], 6))],
  ["hills", still(hills([[5, 13, 5, 7], [11, 15, 5, 8]], 7))],
  ["bocage", still(bocage([6, 13, 9, 15], [], 8))],
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

export const ACROSS = 8;
export const FRAMES = 2;

for (const entry of layout) {
  if (!entry) continue;
  const [name, frames] = entry;
  for (const rows of frames) {
    if (rows.length !== SIZE || rows.some((r) => r.length !== SIZE)) throw new Error(`${name}: not 16x16`);
    for (const ch of rows.join("")) if (ch !== "." && !palette[ch]) throw new Error(`${name}: no color for "${ch}"`);
  }
}
