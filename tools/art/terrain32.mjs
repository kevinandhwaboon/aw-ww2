// Terrain tiles for the 32-pixel grid: 32 wide by 64 tall, same sheet order as terrain.mjs
// (docs/08-art-pipeline.md §14, §17). Flat ground fills the bottom 32 rows; trees, hills, hedges and
// fortifications rise into the top 32 and cast shadows to the lower right.
import { art, compose, flat, layer, put, rect } from "./depth32.mjs";
import { palette } from "./terrain.mjs";

export { palette };
const SIZE = 32;

const hash = (x, y, salt = 0) => {
  let v = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177) >>> 0;
  return (v ^ (v >>> 16)) >>> 0;
};
const fill = (ch) => Array.from({ length: SIZE }, () => Array(SIZE).fill(ch));
const toRows = (g) => g.map((r) => r.join(""));
const inTile = (x, y) => x >= 0 && y >= 0 && x < SIZE && y < SIZE;

/** Grass with blades and tufts: light tips over darker roots, scattered by a fixed hash. */
function grass(salt) {
  const g = fill("G");
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const v = hash(x, y, salt) % 48;
    if (v === 0 && y > 0) { g[y][x] = "g"; g[y - 1][x] = "h"; }
    else if (v === 1) g[y][x] = "g";
  }
  return g;
}

function plains(salt, flowers) {
  const g = grass(salt);
  for (let i = 0; i < 6; i++) {
    const x = 2 + (hash(i, salt, 7) % 27), y = 3 + (hash(salt, i, 9) % 26);
    // A tuft: three blades.
    g[y][x] = "g"; g[y][x + 1] = "g"; g[y][x - 1] = "g";
    g[y - 1][x] = "h"; g[y - 2][x] = "h"; g[y - 1][x - 1] = "h";
  }
  for (let i = 0; i < flowers; i++) {
    const x = 2 + (hash(i, salt, 11) % 28), y = 2 + (hash(salt, i, 13) % 28);
    g[y][x] = i % 2 ? "i" : "f";
  }
  return toRows(g);
}

// A broadleaf tree, lit from the top left: four greens over a short trunk.
const tree = [
  "....OOOOOO....", "..OOVVVVTTOO..", ".OVVVVVTTTTTO.", "OVVVVVTTTTTTTO", "OVVVTTTTTTTTUO", "OVVTTTTTTTTUUO",
  "OVTTTTTTTTUUUO", "OTTTTTTTTUUUUO", ".OTTTTTTUUUUO.", "..OUTTUUUUUO..", "...OOUUUUOO...", ".....OnnO.....",
  ".....OnnO.....", ".....OnnO.....",
];
function forest(spots, salt) {
  const obj = layer();
  for (const [x, y] of [...spots].sort((p, q) => p[1] - q[1])) art(obj, tree, x, y);
  return compose(toRows(grass(salt)), obj);
}

// Grassy domes lit from the top left, rising above the cell.
function hills(mounds, salt) {
  const obj = layer();
  for (const [cx, base, rx, ry] of mounds) {
    const shade = [];
    for (let y = base - ry; y <= base; y++) for (let x = cx - rx; x <= cx + rx; x++) {
      const nx = (x - cx) / rx, ny = (y - base) / ry;
      if (nx * nx + ny * ny > 1) continue;
      const light = -(nx * 0.75 + ny * 0.55);
      shade.push([x, y, light > 0.62 ? "h" : light > 0.38 ? "q" : light > 0.0 ? "w" : light > -0.3 ? "u" : "Q"]);
    }
    const inside = new Set(shade.map(([x, y]) => `${x},${y}`));
    for (const [x, y, ch] of shade) {
      const edge = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !inside.has(`${x + dx},${y + dy}`));
      put(obj, x, y, edge ? "Q" : ch);
    }
    // Grass tufts catching the light on the slopes.
    for (let i = 0; i < 6; i++) {
      const tx = cx - rx / 2 + (hash(i, cx, 5) % Math.max(1, rx)), ty = base - ry / 2 + (hash(cx, i, 6) % Math.max(1, ry / 2));
      if (inside.has(`${Math.round(tx)},${Math.round(ty)}`)) put(obj, tx, ty, "h");
    }
  }
  return compose(toRows(grass(salt)), obj);
}

// A small field enclosed by raised hedgerows: leafy top, darker face toward the viewer, a gate.
function bocage(gate, extra, salt) {
  const obj = layer();
  const leaf = (x, y) => {
    const v = hash(x, y, salt + 3) % 7;
    put(obj, x, y, v === 0 ? "y" : v < 3 ? "E" : v < 5 ? "T" : "e");
  };
  const band = (x0, y0, x1, y1) => {
    for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) leaf(x, y);
    rect(obj, x0, y1 + 1, x1, y1 + 2, "e");
  };
  band(0, 27, 31, 31);
  band(0, 56, 31, 60);
  band(0, 27, 4, 60);
  band(27, 27, 31, 60);
  for (const [x0, y0, x1, y1] of extra) band(x0, y0 + 32, x1, y1 + 32);
  const [gx0, gy0, gx1, gy1] = gate;
  rect(obj, gx0, gy0 + 32, gx1, gy1 + 32, ".");
  return compose(toRows(grass(salt)), obj, 3);
}

// Open water with wave crests that drift right between frames.
function water(salt, frame) {
  const g = fill("S");
  for (let i = 0; i < 9; i++) {
    const x = (hash(i, salt, 1) % 28) + frame * 3, y = 2 + (hash(i, salt, 2) % 28);
    for (let d = 0; d < 5; d++) {
      const xx = (x + d) % SIZE;
      g[y][xx] = d === 0 || d === 4 ? "l" : "f";
      if (d > 0 && d < 4) g[y + 1][xx] = "s";
    }
  }
  return g;
}

const rock = ["...KKKK...", "..KjjjkK..", ".KjjjkkkK.", "KjjkkkkkkK", "KkkkkkkkKK", ".KKkkkKK..", "...KKK...."];
function reef(frame) {
  const g = water(5, frame);
  for (const [x, y] of [[3, 5], [18, 15], [20, 3], [6, 20]]) {
    rock.forEach((row, ry) => [...row].forEach((ch, rx) => { if (ch !== "." && inTile(x + rx, y + ry)) g[y + ry][x + rx] = ch; }));
    for (let d = 0; d < 10; d++) if ((d + frame) % 2 === 0 && inTile(x + d, y + 7)) g[y + 7][x + d] = "f";
  }
  return toRows(g);
}

function beach(salt, pebbles) {
  const g = fill("a");
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    // Wind ripples: faint diagonal bands of darker sand.
    if ((x + y * 2 + salt) % 9 === 0 && hash(x, y, salt) % 3) g[y][x] = "A";
    else if (hash(x, y, salt) % 40 === 0) g[y][x] = "i";
  }
  for (const [x, y] of pebbles) { g[y][x] = "j"; g[y][x + 1] = "k"; g[y + 1][x] = "k"; g[y + 1][x + 1] = "K"; }
  return toRows(g);
}

// Directions in mask order: N=1, E=2, S=4, W=8.
const DIRS = [[0, -1], [1, 0], [0, 1], [-1, 0]];
function channel(mask, lo, hi) {
  const on = fill(false);
  const box = (x0, y0, x1, y1) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) on[y][x] = true; };
  box(lo, lo, hi, hi);
  if (mask & 1) box(lo, 0, hi, hi);
  if (mask & 2) box(lo, lo, SIZE - 1, hi);
  if (mask & 4) box(lo, lo, hi, SIZE - 1);
  if (mask & 8) box(0, lo, hi, hi);
  return on;
}
const touches = (on, x, y, want) => DIRS.some(([dx, dy]) => inTile(x + dx, y + dy) && on[y + dy][x + dx] === want);
const nearEdge = (on, x, y) => DIRS.some(([dx, dy]) => inTile(x + 2 * dx, y + 2 * dy) && !on[y + 2 * dy][x + 2 * dx]);

// A dirt road: a dark verge, a lighter crown, and two wheel ruts.
function road(mask) {
  const g = grass(40 + mask);
  const on = channel(mask, 6, 25);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (!on[y][x]) continue;
    if (touches(on, x, y, false)) g[y][x] = "r";
    else if (nearEdge(on, x, y)) g[y][x] = "R";
    else g[y][x] = hash(x, y, 60 + mask) % 11 === 0 ? "r" : hash(x, y, 61) % 7 === 0 ? "p" : "R";
  }
  // Ruts run along each arm.
  const rut = (x, y) => { if (on[y]?.[x] && !touches(on, x, y, false)) g[y][x] = "r"; };
  const [n0, n1] = [mask & 1 ? 0 : 9, mask & 4 ? SIZE - 1 : 22];
  const [w0, w1] = [mask & 8 ? 0 : 9, mask & 2 ? SIZE - 1 : 22];
  if (mask & 5) for (let i = n0; i <= n1; i++) { rut(11, i); rut(20, i); }
  if (mask & 10) for (let i = w0; i <= w1; i++) { rut(i, 11); rut(i, 20); }
  return toRows(g);
}

// A river: a dark bank, darker water at the edges, ripples stepping along the flow each frame.
function river(mask, frame) {
  const g = grass(80 + mask);
  const on = channel(mask, 8, 23);
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    if (on[y][x]) {
      const ripple = (x * 3 + y * 5 + frame * 4) % 17 === 0;
      g[y][x] = touches(on, x, y, false) ? "s" : nearEdge(on, x, y) ? "S" : ripple ? "f" : (x + y + frame) % 13 === 0 ? "l" : "S";
    } else if (touches(on, x, y, true)) g[y][x] = "u";
    else if (DIRS.some(([dx, dy]) => inTile(x + 2 * dx, y + 2 * dy) && on[y + 2 * dy][x + 2 * dx])) g[y][x] = "a";
  }
  return toRows(g);
}

// A plank bridge with rails and posts, drawn over the river piece; everything else transparent.
function bridge(horizontal) {
  const g = fill(".");
  for (let a = 0; a < SIZE; a++) for (let b = 5; b <= 26; b++) {
    const [x, y] = horizontal ? [a, b] : [b, a];
    const rail = b === 5 || b === 26 || b === 6 || b === 25;
    const post = rail && a % 6 === 0;
    g[y][x] = post ? "x" : rail ? (b === 5 || b === 26 ? "x" : "B") : a % 5 === 4 ? "B" : "b";
  }
  return toRows(g);
}

// A Major Bridge (02-terrain §4a): a steel girder bridge with a paved deck, drawn over the river
// piece, so it reads apart from the plank Bridge at a glance. Heavy grey girders run along both
// sides with a zigzag of lattice bracing, and cross beams show through the deck's edges.
function girderSide(b, a) {
  if (b === 3 || b === 28) return "K";
  if (b === 4 || b === 27) return "j";
  if (b === 5 || b === 26) return ((a + (b === 5 ? 0 : 4)) % 8 < 4 ? (a % 4 === (b === 5 ? 0 : 3) ? "K" : "k") : "k");
  return "K";
}
function majorBridge(horizontal) {
  const g = fill(".");
  for (let a = 0; a < SIZE; a++) for (let b = 3; b <= 28; b++) {
    const [x, y] = horizontal ? [a, b] : [b, a];
    if (b <= 6 || b >= 25) g[y][x] = girderSide(b, a);
    else if (a % 8 === 0) g[y][x] = "k"; // cross beams
    else if (b === 15 || b === 16) g[y][x] = a % 6 < 3 ? "p" : "R"; // a painted center line
    else g[y][x] = hash(a, b, 70) % 9 === 0 ? "r" : "R";
  }
  return toRows(g);
}

// A Blown Bridge (02-terrain §4a): the girder stubs still stand at both banks, the middle spans lie
// broken in the river, so the water shows through between them.
function blownBridge(horizontal) {
  const whole = majorBridge(horizontal).map((r) => [...r]);
  const g = fill(".");
  for (let a = 0; a < SIZE; a++) for (let b = 3; b <= 28; b++) {
    const [x, y] = horizontal ? [a, b] : [b, a];
    // The stubs: jagged ends where the charges cut the girders.
    const cut = a < 6 + (hash(b, 1, 71) % 3) || a > SIZE - 7 - (hash(b, 2, 72) % 3);
    if (cut) g[y][x] = whole[y][x];
  }
  // Fallen girders and slabs, tilted in the water.
  const debris = [[10, 9, 7, 1], [15, 20, 6, -1], [12, 14, 3, 1], [19, 8, 4, 0], [20, 23, 3, 1]];
  for (const [a0, b0, len, slope] of debris) for (let i = 0; i < len; i++) {
    const a = a0 + i, b = b0 + Math.round((i * slope) / 2);
    for (const [da, db, ch] of [[0, 0, "K"], [0, 1, "k"], [0, -1, "j"]]) {
      const [x, y] = horizontal ? [a + da, b + db] : [b + db, a + da];
      if (inTile(x, y)) g[y][x] = ch;
    }
  }
  return toRows(g);
}

// Shore foam over sea next to land: edges N, E, S, W, then outer corners NE, SE, SW, NW.
function shoreEdge(dir, frame) {
  const g = fill(".");
  for (let a = 0; a < SIZE; a++) for (let depth = 0; depth < 6; depth++) {
    let ch = null;
    if (depth < 2) ch = "f";
    else if (depth === 2) ch = (a + frame) % 3 === 0 ? "l" : "f";
    else if (depth === 3) ch = (a + frame) % 4 < 2 ? "l" : null;
    else if ((a + frame * 2) % 6 === 0) ch = "l";
    if (!ch) continue;
    const [x, y] = [[a, depth], [SIZE - 1 - depth, a], [a, SIZE - 1 - depth], [depth, a]][dir];
    g[y][x] = ch;
  }
  return toRows(g);
}
function shoreCorner(corner, frame) {
  const g = fill(".");
  const flipX = corner === 0 || corner === 1, flipY = corner === 1 || corner === 2;
  const pattern = ["fffl", "ffl.", "fl..", frame ? "l..." : "...."];
  pattern.forEach((row, y) => [...row].forEach((ch, x) => {
    if (ch !== ".") g[flipY ? SIZE - 1 - y : y][flipX ? SIZE - 1 - x : x] = ch;
  }));
  return toRows(g);
}

// Beach pieces that are half sand, half sea (08-art-pipeline §14): one for each mask of sides that
// face open water (N=1, E=2, S=4, W=8), then four inner corners drawn over a piece where water
// touches only diagonally (NE, SE, SW, NW). The waterline sits exactly halfway at every tile edge,
// so neighboring pieces always meet; it only bends and wobbles inside the tile.
const HALF = SIZE / 2;
/** How far the sea reaches into the tile from a water side; less when the opposite side is water too, to leave a spit. */
const reach = (mask, side, opposite) => (mask & opposite ? 11 : HALF) * (mask & side ? 1 : 0);
/** A gentle wave along the waterline, zero at both tile edges so pieces always line up. */
const wobble = (t) => 1.2 * Math.sin((4 * Math.PI * t) / SIZE);
const CORNERS = [[SIZE, 0], [SIZE, SIZE], [0, SIZE], [0, 0]];

/** How far into the water each pixel is: above 0 is sea, below 0 sand. */
function wetness(mask, bites, x, y) {
  let e = -Infinity;
  if (mask) {
    const r = 5;
    const n = reach(mask, 1, 4), east = reach(mask, 2, 8), s = reach(mask, 4, 1), w = reach(mask, 8, 2);
    // The sand as a rectangle with rounded corners where two water sides meet.
    const x0 = mask & 8 ? w + r : -Infinity, x1 = mask & 2 ? SIZE - east - r : Infinity;
    const y0 = mask & 1 ? n + r : -Infinity, y1 = mask & 4 ? SIZE - s - r : Infinity;
    const dx = Math.max(x0 - x, 0, x - x1), dy = Math.max(y0 - y, 0, y - y1);
    e = Math.hypot(dx, dy) - r - (dy >= dx ? wobble(x) : wobble(y));
  }
  bites.forEach((on, i) => {
    if (!on) return;
    const [cx, cy] = CORNERS[i];
    const angle = Math.atan2(Math.abs(y - cy), Math.abs(x - cx));
    e = Math.max(e, HALF + 1.2 * Math.sin(4 * angle) - Math.hypot(x - cx, y - cy));
  });
  return e;
}

function shoreline(mask, bites, frame, overlay) {
  const sea = water(3, frame);
  const sand = beach(10, []).map((row) => [...row]);
  const g = fill(".");
  // The surf runs up the sand and back between frames.
  const foam = frame ? -0.7 : 0;
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const e = wetness(mask, bites, x + 0.5, y + 0.5);
    let ch;
    if (e > 4.5) ch = sea[y][x];
    else if (e > 1.7 + foam) ch = (x + y * 3 + frame) % 5 === 0 ? "f" : "l";
    else if (e > foam) ch = "f";
    else if (e > -1.8) ch = "A";
    else ch = overlay ? null : sand[y][x];
    if (ch) g[y][x] = ch;
  }
  return toRows(g);
}

// A concrete pillbox: lit top, front face with a firing slit, banked with sandbags and earth.
function bunker() {
  const obj = layer();
  art(obj, [
    "......KKKKKKKKKKKKKKKK......", "....KKjjjjjjjjjjjjjjjjKK....", "...KjjjjjjjjjjjjjjjjjjjkK...", "..KjjjjjjjjjjjjjjjjjjjjkkK..",
    "..KkkkkkkkkkkkkkkkkkkkkkkK..", "..KkkKKKKKKKKKKKKKKKKKkkkK..", "..KkkKKKKKKKKKKKKKKKKKkkkK..", "..KkkkkkkkkkkkkkkkkkkkkkkK..",
    ".KkkkkkkkkkkkkkkkkkkkkkkkkK.", "KAAKKKKKKKKKKKKKKKKKKKKKKAAK", "KaAAaAAaAAuuuuuuuuuuAAaAAaAK", ".KKKKKKKKKKKKKKKKKKKKKKKKKK.",
  ], 2, 44);
  return compose(toRows(grass(30)), obj);
}

function rubble() {
  const ground = grass(31);
  for (let y = 5; y < 30; y++) for (let x = 2; x < 30; x++) if (hash(x, y, 32) % 3) ground[y][x] = hash(x, y, 33) % 4 ? "A" : "u";
  const obj = layer();
  art(obj, ["KKKKKK..", "KjjkkkK.", "KjkkkkKK", ".KKKKKK."], 4, 38);
  art(obj, ["...KKKK", "..KjjkK", ".KjkkkK", "KjkkkkK", "KKKKKK."], 18, 44);
  art(obj, ["KKK..", "KjkK.", "KkkK.", "KKK.."], 8, 52);
  art(obj, ["x....", ".x...", "..xx.", "....x"], 20, 35);
  art(obj, ["x..x", ".xx.", ".x.."], 3, 56);
  return compose(toRows(ground), obj, 3);
}

// Dragon's teeth: staggered rows of concrete pyramids, lit on the left face.
function obstacle() {
  const obj = layer();
  const tooth = ["...KK...", "..KjkK..", ".KjjkkK.", ".KjjkkK.", "KjjjkkkK", "KKKKKKKK"];
  for (const [x, y] of [[1, 28], [11, 28], [21, 28], [5, 39], [15, 39], [25, 39], [1, 50], [11, 50], [21, 50]]) art(obj, tooth, x, y);
  return compose(toRows(grass(34)), obj, 3);
}

const still = (rows) => [rows, rows];
const moving = (draw) => [draw(0), draw(1)];

// Same order as terrain.mjs, so a pack's tile numbers stay the same at either size.
export const layout = [
  ["plains", still(plains(1, 0))], ["plains", still(plains(2, 2))], ["plains", still(plains(3, 0))],
  ["forest", still(forest([[1, 20], [16, 18], [7, 32], [19, 34]], 4))],
  ["forest", still(forest([[0, 26], [12, 20], [18, 30], [5, 37]], 5))],
  ["hills", still(hills([[15, 61, 16, 27]], 6))],
  ["hills", still(hills([[10, 57, 11, 22], [22, 63, 10, 18]], 7))],
  ["bocage", still(bocage([12, 24, 19, 31], [], 8))],
  ["bocage", still(bocage([0, 12, 4, 17], [[14, 4, 17, 27]], 9))],
  ["sea", moving((f) => toRows(water(3, f)))],
  ["reef", moving(reef)],
  ["beach", still(beach(10, [[8, 12], [22, 24]]))],
  ["beach", still(beach(11, [[18, 6]]))],
  ["bunker", still(bunker())], ["rubble", still(rubble())], ["obstacle", still(obstacle())],
  ...Array.from({ length: 16 }, (_, mask) => [`road-${mask}`, still(road(mask))]),
  ...Array.from({ length: 16 }, (_, mask) => [`river-${mask}`, moving((f) => river(mask, f))]),
  ["bridge-horizontal", still(bridge(true))], ["bridge-vertical", still(bridge(false))],
  ...[0, 1, 2, 3].map((d) => [`shore-${"NESW"[d]}`, moving((f) => shoreEdge(d, f))]),
  ...[0, 1, 2, 3].map((c) => [`shore-${["NE", "SE", "SW", "NW"][c]}`, moving((f) => shoreCorner(c, f))]),
  // Added 2026-11-14 after the 16-pixel sheet's layout, so only this sheet has them.
  ...Array.from({ length: 16 }, (_, mask) => [`beach-${mask}`, moving((f) => shoreline(mask, [], f, false))]),
  ...[0, 1, 2, 3].map((c) => [`beach-${["NE", "SE", "SW", "NW"][c]}`, moving((f) => shoreline(0, [0, 1, 2, 3].map((i) => i === c), f, true))]),
  // Added 2026-11-15: Major Bridges, standing and blown (02-terrain §4a), drawn over the river piece.
  ["majorBridge-horizontal", still(majorBridge(true))], ["majorBridge-vertical", still(majorBridge(false))],
  ["blownBridge-horizontal", still(blownBridge(true))], ["blownBridge-vertical", still(blownBridge(false))],
];

for (const entry of layout) entry[1] = entry[1].map((rows) => (rows.length === SIZE ? flat(rows) : rows));

export const ACROSS = 8;
export const FRAMES = 2;
export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 64;

for (const [name, frames] of layout) for (const rows of frames) {
  if (rows.length !== TILE_HEIGHT || rows.some((r) => r.length !== TILE_WIDTH)) throw new Error(`${name}: not 32x64`);
  for (const ch of rows.join("")) if (ch !== "." && !palette[ch]) throw new Error(`${name}: no color for "${ch}"`);
}
