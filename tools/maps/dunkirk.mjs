// Generates src/scenarios/dunkirk.json: the Dunkirk pocket and the Kent coast, 28 May – 4 June 1940,
// Operation Dynamo. Scenario design: docs/21-scenarios-dunkirk.md.
//
// The Flemish coast and the land behind it come from the Natural Earth 1:50m land outline (the
// `world-atlas` dev dependency, public domain), at about 2.5 km a square; towns, canals and roads
// are real longitude/latitude points projected onto the grid. Kent can't be drawn the same way: its
// coast runs north–south, 25 to 30 squares from the beaches at this scale. So it is drawn as a strip
// across the top of the map, turned a quarter turn so its east coast (Folkestone, Dover, Deal,
// Ramsgate, Margate, from west to east) faces the beaches 10 squares away across a narrowed Channel
// (21-scenarios-dunkirk §1, "Area and scale").
//
// Run: node tools/maps/dunkirk.mjs            (writes the scenario and prints an ASCII preview)
//      node tools/maps/overview.mjs dunkirk   (redraws the overview picture in docs/maps)

import { readFileSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------- projection

const WEST = 1.73;
const NORTH = 51.4825;
const LON_STEP = 0.036; // about 2.5 km at 51° N
const LAT_STEP = 0.0225; // about 2.5 km
const W = 36;
const H = 37;
const EAST = WEST + W * LON_STEP;
const SOUTH = NORTH - H * LAT_STEP;

const toGrid = ([lon, lat]) => ({
  x: Math.min(W - 1, Math.max(0, Math.floor((lon - WEST) / LON_STEP))),
  y: Math.min(H - 1, Math.max(0, Math.floor((NORTH - lat) / LAT_STEP))),
});
const pointAt = (fx, fy) => [WEST + fx * LON_STEP, NORTH - fy * LAT_STEP];

// ---------------------------------------------------------------- grid helpers

const grid = Array.from({ length: H }, () => Array(W).fill("S"));
const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : undefined);
const set = (x, y, ch) => {
  if (at(x, y) !== undefined) grid[y][x] = ch;
};
const N4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const key = (x, y) => `${x},${y}`;

/** Deterministic noise in [0, 1) for a tile and a salt, so the map is the same on every run. */
const noise = (x, y, salt) => {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
const clumpy = (x, y, salt) => 0.55 * noise(x >> 1, y >> 1, salt + 100) + 0.45 * noise(x, y, salt);

/** 4-connected grid line, so units moving square by square can follow it. */
function line(a, b) {
  const nx = Math.abs(b.x - a.x);
  const ny = Math.abs(b.y - a.y);
  const sx = Math.sign(b.x - a.x);
  const sy = Math.sign(b.y - a.y);
  const out = [{ x: a.x, y: a.y }];
  let { x, y } = a;
  for (let ix = 0, iy = 0; ix < nx || iy < ny; ) {
    if (iy >= ny || (ix < nx && (0.5 + ix) / nx < (0.5 + iy) / ny)) {
      x += sx;
      ix++;
    } else {
      y += sy;
      iy++;
    }
    out.push({ x, y });
  }
  return out;
}
const polyline = (points) => points.map(toGrid).flatMap((p, i, all) => (i === 0 ? [p] : line(all[i - 1], p).slice(1)));

function inside(poly, [px, py]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// ---------------------------------------------------------------- the Continent

const topo = JSON.parse(readFileSync(new URL("../../node_modules/world-atlas/land-50m.json", import.meta.url), "utf8"));
const { scale, translate } = topo.transform;
const arcs = topo.arcs.map((arc) => {
  let x = 0;
  let y = 0;
  return arc.map(([dx, dy]) => {
    x += dx;
    y += dy;
    return [x * scale[0] + translate[0], y * scale[1] + translate[1]];
  });
});
const arcPoints = (i) => (i >= 0 ? arcs[i] : arcs[~i].slice().reverse());
const ringOf = (indices) => indices.flatMap((i, n) => (n === 0 ? arcPoints(i) : arcPoints(i).slice(1)));
const rings = [];
const collect = (g) => {
  if (g.type === "GeometryCollection") g.geometries.forEach(collect);
  else if (g.type === "Polygon") g.arcs.forEach((r) => rings.push(ringOf(r)));
  else if (g.type === "MultiPolygon") g.arcs.forEach((p) => p.forEach((r) => rings.push(ringOf(r))));
};
collect(topo.objects.land);
// Only the Continent: Great Britain is drawn by hand below.
const nearby = rings.filter((r) => r.some(([lon, lat]) => lon > WEST - 1 && lon < EAST + 1 && lat > SOUTH - 1 && lat < NORTH + 1) && !inside(r, [-0.12, 51.5]));
const isLand = (p) => nearby.filter((r) => inside(r, p)).length % 2 === 1;

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const samples = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    const hits = samples.filter(([dx, dy]) => isLand(pointAt(x + dx, y + dy))).length;
    if (hits >= 3) set(x, y, ".");
  }
}
const continent = new Set();
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === ".") continent.add(key(x, y));

/** The northernmost Continental square in each column: the Flemish shore. */
const shore = Array.from({ length: W }, (_, x) => {
  for (let y = 0; y < H; y++) if (continent.has(key(x, y))) return y;
  return H;
});

// ---------------------------------------------------------------- Kent

// Kent's coast runs CHANNEL + 1 rows north of the Flemish shore, smoothed, from the west edge to Margate.
// England is everything behind it, running off the top of the map toward London as the Continent
// runs off the bottom; east of Margate, the North Foreland, is the North Sea.
const KENT_EAST = 27;
/**
 * Squares of open sea between the Flemish beaches and the Kent shore. Narrowed from the real 70–80 km,
 * but wide enough that a Landing Craft (6 moves) takes two days to cross, and spends a night at sea
 * loaded, where the Luftwaffe and the S-boats can find it (21-scenarios-dunkirk §1, "Area and scale").
 */
const CHANNEL = 9;
const kentShore = Array.from({ length: W }, (_, x) => {
  if (x > KENT_EAST) return -1;
  const near = [x - 2, x - 1, x, x + 1, x + 2].map((i) => shore[Math.min(W - 1, Math.max(0, i))]);
  return Math.round(near.reduce((a, b) => a + b, 0) / near.length) - CHANNEL - 1;
});
const england = new Set();
for (let x = 0; x <= KENT_EAST; x++) {
  // The North Foreland: the coast turns north at the east end.
  const end = x >= KENT_EAST - 1 ? kentShore[x] - (x - (KENT_EAST - 2)) * 2 : kentShore[x];
  for (let y = 0; y <= end; y++) {
    set(x, y, ".");
    england.add(key(x, y));
  }
}
const isEngland = (x, y) => england.has(key(x, y));

// ---------------------------------------------------------------- canals and floods

// The canals are Rivers (21-scenarios-dunkirk §1, "Terrain"). The Aa from Saint-Omer down to the sea
// at Gravelines, the Colme from Watten toward Bergues, and the upper Yser from Ypres to Dixmude follow
// their real courses.
const CANALS = {
  aa: [[2.25, 50.74], [2.21, 50.83], [2.17, 50.93], [2.13, 51.0], [2.12, 51.02]],
  colme: [[2.21, 50.85], [2.3, 50.9], [2.37, 50.935]],
  yser: [[2.88, 50.85], [2.86, 50.95], [2.86, 51.03]],
};
const canalTiles = new Map();
const dig = (x, y, name) => {
  if (!continent.has(key(x, y)) || at(x, y) !== ".") return;
  set(x, y, "~");
  canalTiles.set(key(x, y), name);
};
for (const [name, points] of Object.entries(CANALS)) for (const p of polyline(points)) dig(p.x, p.y, name);

// The perimeter, laid square by square since it is the line the game is fought on: the Mardyck canal
// down the west face, the Bergues–Furnes canal along the south with Bergues and its walls in the
// line, and the lower Yser from Nieuport down the east face to Dixmude. Every road over it crosses on
// a Major Bridge (below).
const segments = (points) => points.flatMap((p, i) => (i === 0 ? [p] : line(points[i - 1], p).slice(1)));
const PERIMETER = {
  mardyck: segments([{ x: 15, y: 20 }, { x: 15, y: 23 }, { x: 18, y: 23 }]),
  perimeter: segments([{ x: 21, y: 23 }, { x: 22, y: 23 }, { x: 22, y: 22 }, { x: 24, y: 22 }, { x: 24, y: 20 }, { x: 26, y: 20 }, { x: 26, y: 19 }, { x: 28, y: 19 }]),
  yser: segments([{ x: 28, y: 14 }, { x: 28, y: 18 }, { x: 31, y: 18 }]),
};
for (const [name, squares] of Object.entries(PERIMETER)) for (const p of squares) dig(p.x, p.y, name);

// The flooded polders are Salt Marsh, impassable to land units (02-terrain §4b). The French opened
// the sluices: Les Moëres in front of the canal between Bergues and Hondschoote, and the land east
// of the lower Yser.
const FLOODS = [
  [20, 24], [21, 24], [22, 24], [21, 25], [22, 25], [23, 23], [25, 21], [27, 20],
  [29, 15], [29, 16], [29, 17], [30, 16], [30, 17], [30, 19], [32, 17],
];
for (const [x, y] of FLOODS) if (at(x, y) === "." && continent.has(key(x, y))) set(x, y, "z");

// ---------------------------------------------------------------- places

const UK = 0;
const GERMANY = 1;
const NEUTRAL = null;
// [name, lon, lat, kind, owner, square?]  kind: Q hq, f factory, A airfield, P port, C city. The
// pocket's towns are set to the square, so they sit on the right side of the perimeter.
const CONTINENT_PLACES = [
  // The pocket. Dunkirk is the HQ, with its port (the East Mole) on the shore beside it.
  ["Dunkirk port", 2.37, 51.06, "P", UK],
  ["Dunkirk", 2.37, 51.03, "Q", UK],
  ["Malo-les-Bains", 2.42, 51.05, "C", UK],
  ["Bray-Dunes", 2.52, 51.08, "C", UK],
  ["La Panne", 2.6, 51.1, "C", UK],
  ["Bergues", 2.43, 50.97, "C", UK, { x: 19, y: 23 }],
  ["Furnes", 2.66, 51.07, "C", UK, { x: 26, y: 18 }],
  ["Hondschoote", 2.58, 50.98, "C", UK, { x: 24, y: 24 }],
  // Outside the canal line, falling back.
  ["Poperinge", 2.73, 50.86, "C", UK],
  ["Cassel", 2.49, 50.8, "C", UK],
  // Germany: Army Group A on the Aa, Army Group B coming from Belgium.
  ["Calais", 1.86, 50.96, "P", GERMANY],
  ["Saint-Omer", 2.25, 50.75, "Q", GERMANY],
  ["Saint-Omer factory", 2.29, 50.73, "f", GERMANY],
  ["Longuenesse", 2.2, 50.73, "A", GERMANY],
  ["Hazebrouck", 2.53, 50.72, "f", GERMANY],
  ["Gravelines", 2.13, 50.98, "C", GERMANY],
  ["Watten", 2.21, 50.83, "C", GERMANY],
  ["Ypres", 2.88, 50.85, "C", GERMANY],
  ["Dixmude", 2.86, 51.03, "C", GERMANY],
  // No one's yet.
  ["Nieuport", 2.75, 51.12, "C", NEUTRAL],
  ["Wormhout", 2.47, 50.88, "C", NEUTRAL],
  ["Armentières", 2.88, 50.69, "C", NEUTRAL],
];
// Kent, by column along the turned coast and rows in from it (0 = on the shore).
const KENT_PLACES = [
  ["Folkestone", 2, 0, "C"],
  ["Hawkinge", 4, 2, "A"],
  ["Dover", 7, 0, "P"],
  ["Canterbury", 11, 4, "C"],
  ["Deal", 13, 0, "C"],
  ["Manston", 18, 2, "A"],
  ["Ramsgate", 21, 0, "P"],
  ["Margate", 25, 0, "C"],
];

const placed = new Map();
const taken = new Set();
// Where Watling Street leaves the map for London: not a place, just the end of the road.
const londonRoad = () => ({ x: Math.max(0, placed.get("Canterbury").x - 3), y: 0 });
const owners = [];
const place = (name, spot, kind, owner) => {
  placed.set(name, spot);
  taken.add(key(spot.x, spot.y));
  set(spot.x, spot.y, kind);
  if (owner !== NEUTRAL) owners.push({ pos: spot, owner });
};

for (const [name, col, depth, kind] of KENT_PLACES) {
  const y = kentShore[col] - depth;
  if (!isEngland(col, y)) throw new Error(`${name} at (${col}, ${y}) isn't in Kent`);
  place(name, { x: col, y }, kind, UK);
}

// Ports first, as they need a square on the shore; then the rest.
const ORDER = "PAQfC";
for (const [name, lon, lat, kind, owner, square] of [...CONTINENT_PLACES].sort((a, b) => (a[5] ? 0 : 1) - (b[5] ? 0 : 1) || ORDER.indexOf(a[3]) - ORDER.indexOf(b[3]))) {
  if (square) {
    if (!continent.has(key(square.x, square.y)) || ![".", "~", "z"].includes(at(square.x, square.y))) throw new Error(`${name} can't go on (${square.x}, ${square.y})`);
    place(name, square, kind, owner);
    continue;
  }
  const want = toGrid([lon, lat]);
  const fits = (x, y) => {
    if (at(x, y) !== "." || !continent.has(key(x, y)) || taken.has(key(x, y))) return false;
    if (kind === "P" && !N4.some(([dx, dy]) => at(x + dx, y + dy) === "S")) return false;
    // Dunkirk's HQ sits right behind its port, so the two can touch.
    const besidePort = name === "Dunkirk";
    return besidePort || !N4.some(([dx, dy]) => taken.has(key(x + dx, y + dy)));
  };
  let spot;
  for (let r = 0; r < 4 && !spot; r++) {
    for (let dy = -r; dy <= r && !spot; dy++) {
      for (let dx = -r; dx <= r && !spot; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && fits(want.x + dx, want.y + dy)) spot = { x: want.x + dx, y: want.y + dy };
      }
    }
  }
  if (!spot) {
    console.log(grid.map((row, y) => `${String(y).padStart(2)} ${row.join("")}`).join("\n"));
    throw new Error(`No room for ${name} near (${want.x}, ${want.y})`);
  }
  place(name, spot, kind, owner);
}

// ---------------------------------------------------------------- hills, woods, coasts

// Mont Cassel and Mont des Cats, the Flemish hills, with Cassel on the first.
const cassel = placed.get("Cassel");
for (const [dx, dy] of [[-1, 0], [1, 0], [0, 1], [-1, 1]]) if (at(cassel.x + dx, cassel.y + dy) === ".") set(cassel.x + dx, cassel.y + dy, "H");
for (const p of polyline([[2.65, 50.79], [2.68, 50.78]])) if (at(p.x, p.y) === ".") set(p.x, p.y, "H");

// Flat Flanders, with few woods: the Forest of Clairmarais by Saint-Omer, the Forest of Nieppe by
// Hazebrouck, and scattered copses. Kent has the woods of the Downs.
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (at(x, y) !== ".") continue;
    const [lon, lat] = pointAt(x + 0.5, y + 0.5);
    const r = clumpy(x, y, 7);
    const clairmarais = lon > 2.26 && lon < 2.36 && lat > 50.76 && lat < 50.8;
    const nieppe = lon > 2.55 && lon < 2.68 && lat > 50.68 && lat < 50.73;
    if (isEngland(x, y)) {
      if (r < 0.3 && y < kentShore[x] - 1) set(x, y, "F");
    } else if (clairmarais || nieppe ? r < 0.6 : r < 0.06) {
      set(x, y, "F");
    }
  }
}

// Beaches along the whole Flemish coast; the Landing Craft load there (05-supply-transport §8). On
// Kent, the shore is shingle where boats can come in, except the cliffs between Folkestone and
// Dover and at the South Foreland, which are Hills.
const touchesSea = (x, y) => N4.some(([dx, dy]) => at(x + dx, y + dy) === "S");
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!".F".includes(at(x, y)) || !touchesSea(x, y)) continue;
    set(x, y, "_");
  }
}
for (const x of [4, 5, 9]) {
  const y = kentShore[x];
  if (at(x, y) === "_") set(x, y, "H");
}

// ---------------------------------------------------------------- the Flemish banks

// A line of sandbanks (Reef) offshore, two squares out, with gaps. Reef costs ships 2 and hides them
// (02-terrain). Crossing over a bank costs a Landing Craft one move more than through a gap.
for (let x = 0; x < W; x++) {
  const y = shore[x] - 2;
  if (at(x, y) !== "S" || isEngland(x, y - 1) === false && x <= KENT_EAST && at(x, y - 1) !== "S") continue;
  if (x % 4 === 1) continue; // the gaps
  if (x >= 3 && x <= 31) set(x, y, "r");
}

// ---------------------------------------------------------------- roads

const ROAD_COST = { ".": 1, "=": 0.4, "#": 0.4, "%": 0.4, _: 1.5, F: 2, H: 3, "~": 2, z: 50 };
function roadPath(a, b) {
  const k = (x, y) => y * W + x;
  const dist = new Map([[k(a.x, a.y), 0]]);
  const from = new Map();
  const open = [[0, a.x, a.y]];
  while (open.length > 0) {
    open.sort((p, q) => p[0] - q[0]);
    const [d, x, y] = open.shift();
    if (x === b.x && y === b.y) break;
    if (d > (dist.get(k(x, y)) ?? Infinity)) continue;
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      const isEnd = nx === b.x && ny === b.y;
      const step = isEnd ? 1 : taken.has(key(nx, ny)) ? 3 : ROAD_COST[at(nx, ny)];
      if (step === undefined) continue;
      if (at(nx, ny) === "~" && at(x, y) === "~") continue;
      const nd = d + step;
      if (nd < (dist.get(k(nx, ny)) ?? Infinity)) {
        dist.set(k(nx, ny), nd);
        from.set(k(nx, ny), [x, y]);
        open.push([nd, nx, ny]);
      }
    }
  }
  const path = [];
  for (let p = [b.x, b.y]; p; p = from.get(k(p[0], p[1]))) path.unshift({ x: p[0], y: p[1] });
  if (path[0]?.x !== a.x || path[0]?.y !== a.y) throw new Error(`No road from (${a.x}, ${a.y}) to (${b.x}, ${b.y})`);
  return path;
}
const ROADS = [
  // The coast road from Calais through the pocket to Nieuport.
  ["Calais", "Gravelines", "Dunkirk", "Malo-les-Bains", "Bray-Dunes", "La Panne", "Nieuport"],
  // Inland: Calais to Saint-Omer, the Aa valley, and the roads into the pocket from the south.
  ["Calais", "Saint-Omer"],
  ["Saint-Omer", "Watten", "Bergues", "Dunkirk"],
  ["Saint-Omer", "Hazebrouck", "Cassel", "Wormhout", "Bergues"],
  ["Hazebrouck", "Armentières", "Ypres"],
  ["Cassel", "Poperinge", "Ypres"],
  ["Poperinge", "Hondschoote", "Bergues"],
  ["Ypres", "Dixmude", "Nieuport"],
  ["Dixmude", "Furnes", "La Panne"],
  ["Hondschoote", "Furnes"],
  // Kent: the coast road and Canterbury.
  ["Folkestone", "Dover", "Deal", "Ramsgate", "Margate"],
  ["Hawkinge", "Folkestone"],
  ["Dover", "Canterbury", "Manston", "Ramsgate"],
  // Watling Street, off the top of the map toward London.
  ["Canterbury", "London road"],
];
for (const route of ROADS) {
  for (let i = 1; i < route.length; i++) {
    const a = route[i - 1] === "London road" ? londonRoad() : placed.get(route[i - 1]);
    const b = route[i] === "London road" ? londonRoad() : placed.get(route[i]);
    if (!a || !b) throw new Error(`Unknown place on road ${route.join(" - ")}`);
    for (const p of roadPath(a, b)) {
      const ch = at(p.x, p.y);
      if (taken.has(key(p.x, p.y))) continue;
      if (ch === "~") {
        // The bridges on the perimeter canal and the Yser are Major Bridges: the Royal Engineers
        // blew them in 1940 (02-terrain §4a). The others are ordinary Bridges.
        const canal = canalTiles.get(key(p.x, p.y));
        set(p.x, p.y, canal === "perimeter" || canal === "yser" || canal === "mardyck" ? "%" : "#");
      } else if (ch !== "#" && ch !== "%" && ch !== "H" && ch !== "z" && ch !== "_") {
        set(p.x, p.y, "=");
      }
    }
  }
}

if (process.argv.includes("--crossings")) {
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if ("%#".includes(at(x, y))) console.log(`${at(x, y)} (${x}, ${y}) ${canalTiles.get(key(x, y))}`);
}

// Bergues's old walls: a Bunker beside the town (03-combat §4).
const bergues = placed.get("Bergues");
// In the line itself, between the town and the canal to the east.
const bunker = [[1, 0], [-1, 0], [0, 1], [0, -1]].map(([dx, dy]) => ({ x: bergues.x + dx, y: bergues.y + dy })).find((p) => at(p.x, p.y) === "." || at(p.x, p.y) === "=");
if (!bunker) throw new Error("No room for the Bergues bunker");
set(bunker.x, bunker.y, "X");
placed.set("Bergues walls", bunker);

// ---------------------------------------------------------------- starting forces

const used = new Set();
const LAND = (ch) => [".", "=", "F", "H", "_", "X"].includes(ch);
const SEA = (ch) => ch === "S";
/** The nearest free square to a place that suits `fits` and lies on the right shore. */
function near(name, fits, where = "any") {
  const p = placed.get(name);
  for (let r = 0; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (Math.abs(dx) + Math.abs(dy) !== r || used.has(key(x, y)) || (r > 0 && taken.has(key(x, y)))) continue;
        const ch = at(x, y);
        if (ch === undefined || !fits(ch, x, y)) continue;
        if (where === "england" && !isEngland(x, y)) continue;
        if (where === "continent" && !continent.has(key(x, y))) continue;
        return { x, y };
      }
    }
  }
  throw new Error(`No room for a unit near ${name}`);
}
const units = [];
const add = (type, owner, pos, extra = {}) => {
  if (used.has(key(pos.x, pos.y))) throw new Error(`Two units at (${pos.x}, ${pos.y})`);
  used.add(key(pos.x, pos.y));
  units.push({ type, owner, pos, ...extra });
};
const on = (type, owner, name) => add(type, owner, placed.get(name));
const by = (type, owner, name, fits = LAND, where = "continent") => add(type, owner, near(name, (ch, x, y) => fits(ch, x, y) && !taken.has(key(x, y)), where));
const onBeach = (type, owner, name) => by(type, owner, name, (ch) => ch === "_");
/**
 * The pocket: every Continental square reachable from Dunkirk without crossing a canal, a bridge, a
 * flood or Bergues itself, which stands in the line.
 */
const pocket = new Set();
{
  const start = placed.get("Dunkirk");
  const wall = new Set([key(bergues.x, bergues.y), key(bunker.x, bunker.y)]);
  const queue = [start];
  pocket.add(key(start.x, start.y));
  for (let p = queue.shift(); p; p = queue.shift()) {
    for (const [dx, dy] of N4) {
      const x = p.x + dx;
      const y = p.y + dy;
      const ch = at(x, y);
      if (ch === undefined || "S~%#zr".includes(ch) || !continent.has(key(x, y)) || wall.has(key(x, y)) || pocket.has(key(x, y))) continue;
      pocket.add(key(x, y));
      queue.push({ x, y });
    }
  }
}
/** Behind the canal, off the beach. */
const inPocket = () => (ch, x, y) => LAND(ch) && ch !== "_" && pocket.has(key(x, y));

// The United Kingdom: the BEF and the French XVI Corps in the pocket.
// West, Mardyck to Bergues (the French): 4 Infantry, an Artillery, and Infantry in the Bergues bunker.
add("infantry", UK, placed.get("Bergues walls"));
for (let i = 0; i < 4; i++) by("infantry", UK, i < 2 ? "Dunkirk" : "Bergues", inPocket("Bergues"));
by("artillery", UK, "Dunkirk", inPocket("Dunkirk"));
// On the Bergues–Furnes canal (BEF I and II Corps).
for (const town of ["Hondschoote", "Hondschoote", "Furnes", "Furnes", "Bergues", "Furnes", "Hondschoote", "Bergues"]) by("infantry", UK, town, inPocket(town));
by("assaultInfantry", UK, "Furnes", inPocket("Furnes"));
by("mortar", UK, "Hondschoote", inPocket("Hondschoote"));
by("mortar", UK, "Bergues", inPocket("Bergues"));
by("artillery", UK, "Bray-Dunes", inPocket("Bray-Dunes"));
by("artillery", UK, "Malo-les-Bains", inPocket("Malo-les-Bains"));
by("lightTank", UK, "Furnes", inPocket("Furnes"));
// On the beaches, waiting to embark.
onBeach("infantry", UK, "Malo-les-Bains");
onBeach("infantry", UK, "Malo-les-Bains");
onBeach("infantry", UK, "Bray-Dunes");
onBeach("infantry", UK, "La Panne");
by("mobileAA", UK, "Bray-Dunes");
by("flakGun", UK, "Dunkirk");
// Outside, falling back: Cassel's garrison, the Poperinge road, and the 12th Lancers racing for Nieuport.
on("infantry", UK, "Cassel");
for (const type of ["infantry", "infantry", "infantry", "halftrack", "lightTank"]) by(type, UK, "Poperinge");
by("recon", UK, "Furnes");

// The Royal Navy: destroyers at Dover, in the Downs off Deal and off Dunkirk; Landing Craft (the
// personnel ships and little ships) at Dover, Ramsgate and on the beaches at Malo and La Panne.
on("destroyer", UK, "Dover");
by("destroyer", UK, "Dover", SEA, "any");
by("destroyer", UK, "Deal", SEA, "any");
by("destroyer", UK, "Dunkirk port", SEA, "any");
by("destroyer", UK, "Bray-Dunes", SEA, "any");
by("landingCraft", UK, "Dover", SEA, "any");
by("landingCraft", UK, "Dover", SEA, "any");
on("landingCraft", UK, "Ramsgate");
by("landingCraft", UK, "Ramsgate", SEA, "any");
onBeach("landingCraft", UK, "Malo-les-Bains");
onBeach("landingCraft", UK, "La Panne");
by("torpedoBoat", UK, "Ramsgate", SEA, "any");
// The RAF, 11 Group: Hurricanes and Spitfires (the Fighter) and Blenheims (the Bomber).
on("fighter", UK, "Manston");
on("fighter", UK, "Hawkinge");
by("fighter", UK, "Manston", LAND, "england");
by("bomber", UK, "Canterbury", LAND, "england");

// Germany. West, Army Group A on the Aa.
by("infantry", GERMANY, "Calais");
by("artillery", GERMANY, "Calais");
for (const type of ["mediumTank", "mediumTank", "lightTank", "infantry", "infantry"]) by(type, GERMANY, "Gravelines");
for (const type of ["mediumTank", "lightTank", "halftrack", "infantry", "infantry"]) by(type, GERMANY, "Watten");
for (const type of ["mediumTank", "lightTank", "halftrack", "infantry", "artillery"]) by(type, GERMANY, "Saint-Omer");
// South, before Cassel and Hazebrouck.
for (const type of ["infantry", "infantry", "infantry", "assaultInfantry", "artillery", "mediumTank"]) by(type, GERMANY, "Hazebrouck");
// East, Army Group B from Belgium.
for (const type of ["infantry", "infantry", "infantry", "assaultInfantry", "mortar", "artillery"]) by(type, GERMANY, "Ypres");
for (const type of ["infantry", "infantry", "recon"]) by(type, GERMANY, "Dixmude");
// The Luftwaffe on and around Longuenesse: Bf 109s (the Fighter) and the Ju 87s and He 111s (the Bomber).
on("fighter", GERMANY, "Longuenesse");
for (let i = 0; i < 4; i++) by("fighter", GERMANY, "Longuenesse");
for (let i = 0; i < 6; i++) by("bomber", GERMANY, "Saint-Omer factory");
// The Kriegsmarine: S-boats (the Torpedo Boat) at Calais.
on("torpedoBoat", GERMANY, "Calais");
by("torpedoBoat", GERMANY, "Calais", SEA, "any");

// ---------------------------------------------------------------- checks

// Every perimeter beach is two days' sailing (7 to 12 Landing Craft moves) from an English square it
// can unload onto (21-scenarios-dunkirk §1, "Area and scale").
const SHIP_COST = { S: 1, r: 2, _: 1, P: 1 };
function sailDays(from) {
  const dist = new Map([[key(from.x, from.y), 0]]);
  const open = [[0, from.x, from.y]];
  let best = Infinity;
  while (open.length > 0) {
    open.sort((a, b) => a[0] - b[0]);
    const [d, x, y] = open.shift();
    if (d > (dist.get(key(x, y)) ?? Infinity)) continue;
    const ch = at(x, y);
    if (isEngland(x, y) && (ch === "_" || ch === "P")) best = Math.min(best, d);
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      const step = SHIP_COST[at(nx, ny)];
      if (step === undefined) continue;
      // A Landing Craft doesn't drive along the beach.
      if (at(nx, ny) === "_" && !isEngland(nx, ny)) continue;
      const nd = d + step;
      if (nd < (dist.get(key(nx, ny)) ?? Infinity)) {
        dist.set(key(nx, ny), nd);
        open.push([nd, nx, ny]);
      }
    }
  }
  return best;
}
const perimeterBeaches = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === "_" && pocket.has(key(x, y))) perimeterBeaches.push({ x, y });
const far = perimeterBeaches.filter((p) => sailDays(p) > 12 || sailDays(p) <= 6);
if (far.length > 0) throw new Error(`Beaches not a two-day sail from England: ${far.map((p) => `(${p.x}, ${p.y}) ${sailDays(p)}`).join(" ")}`);

// ---------------------------------------------------------------- write

const zone = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (isEngland(x, y) && at(x, y) !== "S") zone.push({ x, y });

const AIR = ["fighter", "bomber"];
const scenario = {
  id: "dunkirk",
  name: "Dunkirk",
  description:
    "28 May 1940. The British Expeditionary Force and the French First Army are trapped against the sea at Dunkirk, and the Royal Navy has begun Operation Dynamo. The United Kingdom has no factory: what is in the pocket is all there is. It wins by carrying 15 foot soldiers home to Kent in its Landing Craft, but every soldier on a boat is one fewer holding the canals. Germany wins by taking Dunkirk, or by holding out until day 9, when the last boats sailed.",
  map: grid.map((row) => row.join("")),
  players: [
    {
      name: "United Kingdom",
      nation: "uk",
      funds: 12000,
      // No land units: there's no factory, and none is offered (21-scenarios-dunkirk §1, "Build lists").
      buildable: ["destroyer", "landingCraft", "torpedoBoat", ...AIR],
      facing: "left",
    },
    {
      name: "Germany",
      nation: "germany",
      funds: 15000,
      buildable: ["infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank", "artillery", "mobileAA", "flakGun", ...AIR, "torpedoBoat"],
    },
  ],
  propertyOwners: owners,
  units,
  // Half the usual income: a week's fighting, not a campaign; the BEF could buy little.
  settings: { incomePerProperty: 500 },
  victory: [
    { type: "hqCapture" },
    { type: "rout" },
    { type: "evacuateUnits", side: "allies", count: 10, unitTypes: ["infantry", "assaultInfantry", "mortar"], zone },
    { type: "surviveDays", side: "axis", days: 9 },
  ],
  weather: {
    season: "summer",
    forecast: [
      { fromDay: 1, weather: "rain" },
      { fromDay: 2, weather: "clear" },
      { fromDay: 3, weather: "rain" },
      { fromDay: 4, weather: "clear" },
    ],
  },
};

const json = JSON.stringify(scenario, null, 2)
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+("type": "[^"]+"),\s+("owner": \d),\s+("pos": \{[^}]+\})\s+\}/g, "{ $1, $2, $3 }")
  .replace(/\{\s+("pos": \{[^}]+\}),\s+("owner": \d)\s+\}/g, "{ $1, $2 }")
  .replace(/\{\s+("fromDay": \d+),\s+("weather": "[a-z]+")\s+\}/g, "{ $1, $2 }")
  .replace(/\[\s+((?:\{ "x": \d+, "y": \d+ \},?\s+)+)\]/g, (_, list) => `[${list.trim().split(/,\s+/).join(", ")}]`)
  .replace(/\[\s+((?:"[a-zA-Z]+",?\s+)+)\]/g, (_, list) => `[${list.trim().split(/,\s+/).join(", ")}]`);
writeFileSync(new URL("../../src/scenarios/dunkirk.json", import.meta.url), json + "\n");

const unitAt = new Map(units.map((u) => [key(u.pos.x, u.pos.y), u.owner === UK ? "u" : "g"]));
console.log(grid.map((row, y) => `${String(y).padStart(2)} ${row.map((ch, x) => unitAt.get(key(x, y)) ?? ch).join("")}`).join("\n"));
console.log("\n" + grid.map((row, y) => `${String(y).padStart(2)} ${row.join("")}`).join("\n"));
const count = (owner) => owners.filter((p) => p.owner === owner).length;
const foot = units.filter((u) => u.owner === UK && ["infantry", "assaultInfantry", "mortar"].includes(u.type)).length;
console.log(`\n${W}x${H}, ${WEST.toFixed(2)}..${EAST.toFixed(2)} E, ${SOUTH.toFixed(2)}..${NORTH.toFixed(2)} N. Properties: UK ${count(UK)}, Germany ${count(GERMANY)}.`);
console.log(`Units: UK ${units.filter((u) => u.owner === UK).length} (${foot} foot), Germany ${units.filter((u) => u.owner === GERMANY).length}. Zone ${zone.length} squares.`);
console.log(`Pocket: ${pocket.size} squares. UK land units outside it: ${units.filter((u) => u.owner === UK && continent.has(key(u.pos.x, u.pos.y)) && !pocket.has(key(u.pos.x, u.pos.y))).map((u) => `${u.type}(${u.pos.x},${u.pos.y})`).join(" ")}`);
console.log(`Perimeter beaches: ${perimeterBeaches.map((p) => `(${p.x},${p.y}) ${sailDays(p)}`).join(" ")}`);
for (const [name] of [...CONTINENT_PLACES, ...KENT_PLACES]) console.log(`${name}: (${placed.get(name).x}, ${placed.get(name).y})`);
