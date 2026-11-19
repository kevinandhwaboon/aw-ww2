// Generates src/scenarios/stalingrad.json: Stalingrad and the Don bend, 19 November 1942, the
// morning of Operation Uranus.
//
// Towns, rivers, roads and the front line are written as real longitude/latitude points and
// projected onto the grid (each square is about 2.9 km across and tall), as at Kursk. The Volga is a
// column of water with no bridge; the city is a strip of rubble along its west bank with named
// squares, three of them Soviet footholds with a landing beach each. Roads are routed between towns
// along the cheapest path. Scenario design: docs/15-scenarios-eastern-front.md §2.
//
// Run: node tools/maps/stalingrad.mjs           (writes the scenario and prints an ASCII preview)
//      node tools/maps/overview.mjs stalingrad  (redraws the overview picture in docs/maps)

import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------- projection

const WEST = 42.45;
const EAST = 45.25;
const NORTH = 49.7;
const SOUTH = 47.95;
const W = 70;
const H = 68;

const toGrid = ([lon, lat]) => ({
  x: Math.min(W - 1, Math.max(0, Math.floor(((lon - WEST) / (EAST - WEST)) * W))),
  y: Math.min(H - 1, Math.max(0, Math.floor(((NORTH - lat) / (NORTH - SOUTH)) * H))),
});
const tileCenter = (x, y) => [WEST + ((x + 0.5) / W) * (EAST - WEST), NORTH - ((y + 0.5) / H) * (NORTH - SOUTH)];
const rowOf = (lat) => toGrid([WEST, lat]).y;

// ---------------------------------------------------------------- grid helpers

const grid = Array.from({ length: H }, () => Array(W).fill("."));
const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : undefined);
const set = (x, y, ch) => {
  if (at(x, y) !== undefined) grid[y][x] = ch;
};
const N4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** Deterministic noise in [0, 1) for a tile and a salt, so the map is the same on every run. */
const noise = (x, y, salt) => {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** Noise that clumps: half from 2×2 blocks, half from the tile, so woods come in patches. */
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

// ---------------------------------------------------------------- the Volga

// The river's channel from north to south: past Dubovka, the city, Krasnoarmeysk, then turning
// south-east past Svetly Yar and Raigorod. One square wide (the river was 1.5–2 km across).
const VOLGA = [
  [45.12, 49.7], [44.98, 49.4], [44.84, 49.08], [44.72, 48.93], [44.64, 48.86], [44.6, 48.8],
  [44.575, 48.74], [44.565, 48.68], [44.575, 48.63], [44.6, 48.56], [44.64, 48.51], [44.8, 48.485],
  [44.96, 48.44], [45.25, 48.38],
];
for (const p of polyline(VOLGA)) set(p.x, p.y, "S");
// Sarpinsky island: south of the city the Volga splits round a long island, its main channel on the
// east side. Opposite Beketovka and Krasnoarmeysk.
for (let y = rowOf(48.62); y <= rowOf(48.52); y++) {
  const west = grid[y].indexOf("S");
  set(west + 1, y, ".");
  set(west + 2, y, "S");
}
/** The westernmost Volga square in a row, or -1. */
const volgaX = (y) => grid[y].indexOf("S");

// ---------------------------------------------------------------- the front, 19 November 1942

// German-held ground (with the Romanian armies on its flanks): the Don's south bank west of
// Kletskaya with two Soviet bridgeheads cut out of it, the 6th Army's land bridge from the Don to the
// Volga, the whole west bank of the Volga through the city to Kuporosnoe, and the line south past
// the Sarpa lakes. Everything west of that is German; the rest is Soviet. The three Soviet footholds
// in the city are carved out by hand below.
const GERMAN = [
  [42.45, 49.585], [42.62, 49.57], // the Don's south bank, west of Serafimovich
  [42.62, 49.43], [42.8, 49.38], [42.95, 49.44], // the Serafimovich bridgehead
  [43.0, 49.38], // the Don between the bridgeheads
  [43.0, 49.26], [43.12, 49.16], [43.3, 49.17], [43.36, 49.26], // the Kletskaya bridgehead
  [43.65, 49.225], [43.86, 49.105], [43.91, 49.0], // the Don's south bank round the small bend
  [44.05, 48.965], [44.3, 48.93], [44.5, 48.9], [44.66, 48.88], // the land bridge to the Volga at Latashanka
  [44.6, 48.8], [44.575, 48.74], [44.565, 48.68], [44.57, 48.64], // down the Volga through the city
  [44.5, 48.625], [44.4, 48.6], [44.32, 48.48], [44.38, 48.32], [44.4, 48.18], [44.42, 47.95], // south past the lakes
  [42.45, 47.95],
];
const germanTile = (x, y) => inside(GERMAN, tileCenter(x, y));

// ---------------------------------------------------------------- rivers

const RIVERS = {
  // The Don: east past Serafimovich and Kletskaya, round the small bend, south past Vertyachy to
  // Kalach, then south-west past Nizhne-Chirskaya.
  don: [
    [42.45, 49.6], [42.74, 49.58], [42.92, 49.46], [43.06, 49.33], [43.35, 49.28], [43.65, 49.245],
    [43.88, 49.125], [43.93, 49.0], [43.8, 48.94], [43.66, 48.9], [43.56, 48.82], [43.51, 48.69],
    [43.36, 48.55], [43.13, 48.38], [42.97, 48.17], [42.82, 47.95],
  ],
  // The Chir: down the west past Oblivskaya and Surovikino into the Don at Nizhne-Chirskaya.
  chir: [[42.45, 48.5], [42.55, 48.535], [42.72, 48.585], [42.87, 48.59], [43.0, 48.49], [43.11, 48.4]],
  // The Akhtuba, the Volga's side channel on the east bank, past Srednyaya Akhtuba and Leninsk.
  akhtuba: [[44.72, 48.84], [44.82, 48.76], [44.92, 48.68], [45.05, 48.62], [45.16, 48.57], [45.25, 48.5]],
  // The Karpovka and the Rossoshka, inside what became the pocket.
  karpovka: [[44.25, 48.6], [44.1, 48.66], [43.95, 48.68], [43.8, 48.68], [43.62, 48.65]],
  rossoshka: [[44.15, 48.92], [44.12, 48.8], [44.05, 48.7]],
  // The Kurtlak and the Tsaritsa in the north-west, behind the Romanian line.
  kurtlak: [[42.62, 49.32], [42.75, 49.22], [42.9, 49.1], [43.05, 48.98]],
  // The Ilovlya, down to the Don past Ilovlya.
  ilovlya: [[44.05, 49.7], [44.0, 49.45], [43.95, 49.25], [43.9, 49.13]],
};
const riverTiles = new Set();
const donTiles = new Set();
for (const [name, points] of Object.entries(RIVERS)) {
  for (const p of polyline(points)) {
    if (at(p.x, p.y) === "S") continue;
    set(p.x, p.y, "~");
    riverTiles.add(`${p.x},${p.y}`);
    if (name === "don") donTiles.add(`${p.x},${p.y}`);
  }
}
const nearRiver = (x, y) => N8.some(([dx, dy]) => riverTiles.has(`${x + dx},${y + dy}`));
const nearDon = (x, y, r) => {
  for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (donTiles.has(`${x + dx},${y + dy}`)) return true;
  return false;
};

// ---------------------------------------------------------------- the Sarpa lakes

// Salt lakes in a chain south of the city, water squares not joined to the Volga. The southern
// pincer attacked through the gaps between them.
const LAKES = [[44.36, 48.03, 0.05, 0.035], [44.47, 48.14, 0.04, 0.03], [44.56, 48.04, 0.05, 0.04], [44.62, 48.23, 0.035, 0.03]];
const near = ([lon, lat], [clon, clat], rx, ry) => ((lon - clon) / rx) ** 2 + ((lat - clat) / ry) ** 2 <= 1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const c = tileCenter(x, y);
    if (at(x, y) === "." && LAKES.some(([lon, lat, rx, ry]) => near(c, [lon, lat], rx, ry))) set(x, y, "S");
  }
}

// ---------------------------------------------------------------- countryside

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (at(x, y) !== ".") continue;
    const c = tileCenter(x, y);
    const r = clumpy(x, y, 1);
    const east = volgaX(y) >= 0 && x > volgaX(y);
    let ch;
    // The Volga's east bank: the wooded floodplain between the Volga and the Akhtuba.
    if (east && c[0] < 44.95 && c[1] > 48.45) ch = r < 0.35 ? "F" : ".";
    // The Don's high west bank: steep, cut by ravines. Woods in the valley.
    else if (nearDon(x, y, 1)) ch = r < 0.28 ? "d" : r < 0.45 ? "F" : ".";
    // Woods along the smaller rivers.
    else if (nearRiver(x, y)) ch = r < 0.18 ? "F" : r < 0.24 ? "d" : ".";
    // The steppe: open, rolling, nearly treeless, cut by the dry ravines (balkas).
    else ch = r < 0.05 ? "d" : r < 0.075 ? "F" : ".";
    set(x, y, ch);
  }
}

// ---------------------------------------------------------------- the city

// Stalingrad: about 13 squares of rubble along the Volga's west bank, one column wide in the north
// and south and two through the middle. Named squares are placed by latitude on the bank column
// (the square just west of the river) or one in from it.
const CITY_NORTH = 48.875;
const CITY_SOUTH = 48.635;
const bankX = (y) => volgaX(y) - 1;
const cityTiles = new Set();
for (let y = rowOf(CITY_NORTH); y <= rowOf(CITY_SOUTH); y++) {
  const wide = tileCenter(0, y)[1] < 48.85 && tileCenter(0, y)[1] > 48.66;
  for (let x = bankX(y) - (wide ? 1 : 0); x <= bankX(y); x++) {
    set(x, y, "x");
    cityTiles.add(`${x},${y}`);
  }
}
const SOVIET = 0;
const GERMANY = 1;
/** [name, lat, column (0 bank, 1 one in), terrain, owner or null] */
const CITY = [
  ["Rynok", 48.86, 0, "C", SOVIET],
  ["Spartanovka landing", 48.84, 0, "_", null],
  ["Spartanovka", 48.84, 1, "C", SOVIET],
  ["Tractor Factory", 48.81, 0, "C", GERMANY],
  ["Barrikady", 48.785, 0, "C", GERMANY],
  ["Red October", 48.762, 0, "C", SOVIET],
  ["Red October landing", 48.74, 0, "_", null],
  ["Mamayev Kurgan", 48.74, 1, "H", null],
  ["Central Station", 48.71, 0, "C", GERMANY],
  ["Grain Elevator", 48.685, 0, "C", GERMANY],
  ["Kuporosnoe", 48.645, 0, "C", GERMANY],
];
const placed = new Map();
const taken = new Set();
for (const [name, lat, col, ch] of CITY) {
  const y = rowOf(lat);
  const x = bankX(y) - col;
  if (!cityTiles.has(`${x},${y}`) || at(x, y) !== "x") throw new Error(`${name} doesn't fit the city at (${x}, ${y})`);
  set(x, y, ch);
  placed.set(name, { x, y });
  taken.add(`${x},${y}`);
}
// The Soviet footholds' squares and the landings behind them are Soviet ground; so are the
// fortified buildings beside them. Everything else in the city is German.
const SOVIET_CITY = new Set();
for (const name of ["Rynok", "Spartanovka", "Spartanovka landing", "Red October", "Red October landing"]) {
  const p = placed.get(name);
  SOVIET_CITY.add(`${p.x},${p.y}`);
}
/** The square one in from a foothold, for its fortified buildings (a bunker). */
const behind = (name) => ({ x: placed.get(name).x - 1, y: placed.get(name).y });
for (const p of [behind("Rynok"), behind("Red October")]) {
  set(p.x, p.y, "X");
  SOVIET_CITY.add(`${p.x},${p.y}`);
}
const sideOf = (x, y) => (SOVIET_CITY.has(`${x},${y}`) ? SOVIET : germanTile(x, y) ? GERMANY : SOVIET);

// ---------------------------------------------------------------- towns and bases

// [name, lon, lat, kind, owner]  kind: Q hq, f factory, A airfield, P port, C city.
const PLACES = [
  // Soviet: the north, the Don bridgeheads and the Don Front
  ["Serafimovich", 42.74, 49.55, "f", SOVIET],
  ["Kletskaya", 43.06, 49.3, "f", SOVIET],
  ["Ilovlya", 44.0, 49.3, "f", SOVIET],
  ["Kachalinskaya airfield", 44.05, 49.1, "A", SOVIET],
  ["Kotluban", 44.15, 49.03, "C", SOVIET],
  ["Yerzovka", 44.62, 48.97, "C", SOVIET],
  ["Sirotinskaya", 43.62, 49.32, "C", SOVIET],
  // Soviet: the east bank
  ["Krasnaya Sloboda", 44.6, 48.7, "P", SOVIET],
  ["Srednyaya Akhtuba", 44.88, 48.71, "C", SOVIET],
  ["Leninsk airfield", 45.18, 48.7, "A", SOVIET],
  // Soviet: south of the city
  ["Beketovka", 44.47, 48.59, "Q", SOVIET],
  ["Krasnoarmeysk", 44.55, 48.51, "f", SOVIET],
  ["Svetly Yar", 44.78, 48.44, "C", SOVIET],
  ["Raigorod", 44.95, 48.39, "C", SOVIET],
  ["Malye Derbety", 44.68, 47.98, "C", SOVIET],
  // Germany: Kalach, the Don and the Chir
  ["Kalach", 43.54, 48.69, "Q", GERMANY],
  ["Surovikino", 42.86, 48.61, "f", GERMANY],
  ["Nizhne-Chirskaya", 43.08, 48.37, "f", GERMANY],
  ["Oblivskaya airfield", 42.52, 48.53, "A", GERMANY],
  ["Sovetsky", 43.72, 48.57, "C", GERMANY],
  ["Golubinsky", 43.6, 48.84, "C", GERMANY],
  ["Vertyachy", 43.74, 48.96, "C", GERMANY],
  // Germany: the land bridge and round the city
  ["Pitomnik airfield", 44.22, 48.74, "A", GERMANY],
  ["Gumrak airfield", 44.37, 48.78, "A", GERMANY],
  ["Karpovka", 44.0, 48.7, "C", GERMANY],
  ["Marinovka", 43.82, 48.71, "C", GERMANY],
  ["Gorodishche", 44.46, 48.81, "C", GERMANY],
  ["Orlovka", 44.47, 48.86, "C", GERMANY],
  // Germany: the Romanian 3rd Army's sector, behind the Don
  ["Perelazovsky", 42.7, 49.17, "C", GERMANY],
  ["Raspopinskaya", 42.98, 49.33, "C", GERMANY],
  ["Verkhne-Buzinovka", 43.3, 49.05, "C", GERMANY],
  ["Manoilin", 43.0, 49.03, "C", GERMANY],
  // Germany: the south, the Romanian 4th Army and the 4th Panzer Army
  ["Abganerovo", 44.18, 48.12, "f", GERMANY],
  ["Plodovitoe", 44.2, 48.3, "C", GERMANY],
  ["Tinguta", 44.22, 48.42, "C", GERMANY],
];

for (const [name, lon, lat, kind, owner] of PLACES) {
  const want = toGrid([lon, lat]);
  // Off rivers and water, on its own side of the front, never right next to another place. A port
  // must touch the Volga.
  const fits = (x, y) => {
    const ch = at(x, y);
    if (ch === undefined || !".Fd".includes(ch) || taken.has(`${x},${y}`)) return false;
    if (sideOf(x, y) !== owner) return false;
    if (kind === "P" && !N4.some(([dx, dy]) => at(x + dx, y + dy) === "S")) return false;
    return !N4.some(([dx, dy]) => taken.has(`${x + dx},${y + dy}`));
  };
  let spot;
  for (let r = 0; r < 5 && !spot; r++) {
    for (let dy = -r; dy <= r && !spot; dy++) {
      for (let dx = -r; dx <= r && !spot; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && fits(want.x + dx, want.y + dy)) spot = { x: want.x + dx, y: want.y + dy };
      }
    }
  }
  if (!spot) throw new Error(`No room for ${name}`);
  placed.set(name, spot);
  taken.add(`${spot.x},${spot.y}`);
  set(spot.x, spot.y, kind);
}

// ---------------------------------------------------------------- roads

/** Cheapest route between two places: follows existing roads, avoids woods and ridges, crosses rivers only when it must. */
const ROAD_COST = { ".": 1, "=": 0.4, "#": 0.4, "%": 0.4, F: 2.2, d: 3, x: 1.2, "~": 10 };
function roadPath(a, b) {
  const key = (x, y) => y * W + x;
  const dist = new Map([[key(a.x, a.y), 0]]);
  const from = new Map();
  const open = [[0, a.x, a.y]];
  while (open.length > 0) {
    open.sort((p, q) => p[0] - q[0]);
    const [d, x, y] = open.shift();
    if (x === b.x && y === b.y) break;
    if (d > (dist.get(key(x, y)) ?? Infinity)) continue;
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      const isEnd = nx === b.x && ny === b.y;
      const step = isEnd ? 1 : taken.has(`${nx},${ny}`) ? undefined : ROAD_COST[at(nx, ny)];
      if (step === undefined) continue;
      // A river is crossed straight, never followed: no two river squares in a row.
      if (at(nx, ny) === "~" && at(x, y) === "~") continue;
      const nd = d + step;
      if (nd < (dist.get(key(nx, ny)) ?? Infinity)) {
        dist.set(key(nx, ny), nd);
        from.set(key(nx, ny), [x, y]);
        open.push([nd, nx, ny]);
      }
    }
  }
  const path = [];
  for (let p = [b.x, b.y]; p; p = from.get(key(p[0], p[1]))) path.unshift({ x: p[0], y: p[1] });
  if (path[0]?.x !== a.x || path[0]?.y !== a.y) throw new Error(`No road from (${a.x}, ${a.y}) to (${b.x}, ${b.y})`);
  return path;
}

// The main axes first, so the lesser roads join them.
const ROADS = [
  // The 6th Army's lifeline: Surovikino over the Don at Kalach, then east to the city.
  ["Surovikino", "Kalach", "Marinovka", "Karpovka", "Pitomnik airfield", "Gumrak airfield", "Gorodishche"],
  // The northern pincer's roads: Serafimovich and Kletskaya south to Kalach.
  ["Serafimovich", "Perelazovsky", "Manoilin", "Golubinsky", "Kalach"],
  ["Kletskaya", "Verkhne-Buzinovka", "Golubinsky"],
  ["Raspopinskaya", "Perelazovsky"],
  ["Serafimovich", "Raspopinskaya", "Kletskaya", "Sirotinskaya", "Ilovlya"],
  // The land bridge and the Don Front behind it.
  ["Vertyachy", "Golubinsky"],
  ["Vertyachy", "Orlovka", "Gorodishche"],
  ["Ilovlya", "Kachalinskaya airfield", "Kotluban", "Yerzovka"],
  // The south: the railway from the city through Tinguta and Abganerovo, and the road to Sovetsky.
  ["Beketovka", "Krasnoarmeysk", "Svetly Yar", "Raigorod"],
  ["Tinguta", "Plodovitoe", "Abganerovo"],
  ["Tinguta", "Sovetsky", "Kalach"],
  ["Nizhne-Chirskaya", "Sovetsky"],
  ["Surovikino", "Nizhne-Chirskaya"],
  ["Surovikino", "Oblivskaya airfield"],
  ["Krasnoarmeysk", "Malye Derbety"],
  ["Plodovitoe", "Malye Derbety"],
  ["Karpovka", "Tinguta"],
  // The east bank: from the landing opposite the city to the Akhtuba and Leninsk.
  ["Krasnaya Sloboda", "Srednyaya Akhtuba", "Leninsk airfield"],
];
for (const route of ROADS) {
  for (let i = 1; i < route.length; i++) {
    const a = placed.get(route[i - 1]);
    const b = placed.get(route[i]);
    if (!a || !b) throw new Error(`Unknown place on road ${route.join(" - ")}`);
    for (const p of roadPath(a, b)) {
      const ch = at(p.x, p.y);
      if (taken.has(`${p.x},${p.y}`)) continue;
      if (ch === "~") set(p.x, p.y, "#");
      else if (ch === "x") continue; // the city stays rubble: its streets are wrecked
      else if (ch !== "#") set(p.x, p.y, "=");
    }
  }
}

// The Don bridges at Kalach and Rychkovsky (by Nizhne-Chirskaya) are Major Bridges: Assault
// Infantry can blow them (02-terrain §4a). In 1942 the Kalach bridge was taken intact.
const majorBridges = [];
for (const name of ["Kalach", "Nizhne-Chirskaya"]) {
  const p = placed.get(name);
  let best;
  for (const key of donTiles) {
    const [x, y] = key.split(",").map(Number);
    if (at(x, y) !== "#") continue;
    const d = Math.abs(x - p.x) + Math.abs(y - p.y);
    if (d <= 4 && (!best || d < best.d)) best = { x, y, d };
  }
  if (!best) throw new Error(`No Don bridge near ${name}`);
  set(best.x, best.y, "%");
  majorBridges.push({ x: best.x, y: best.y });
}

// ---------------------------------------------------------------- fortifications

/** How far each square is from the front: 4-step distance to the nearest land square on the other side. */
const frontDistance = (() => {
  const land = (x, y) => at(x, y) !== undefined && at(x, y) !== "S";
  const dist = Array.from({ length: H }, () => Array(W).fill(Infinity));
  const queue = [];
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!land(x, y)) continue;
      if (N4.some(([dx, dy]) => land(x + dx, y + dy) && sideOf(x + dx, y + dy) !== sideOf(x, y))) {
        dist[y][x] = 0;
        queue.push([x, y]);
      }
    }
  }
  for (let i = 0; i < queue.length; i++) {
    const [x, y] = queue[i];
    for (const [dx, dy] of N4) {
      const nx = x + dx;
      const ny = y + dy;
      if (!land(nx, ny) || sideOf(nx, ny) !== sideOf(x, y) || dist[ny][nx] <= dist[y][x] + 1) continue;
      dist[ny][nx] = dist[y][x] + 1;
      queue.push([nx, ny]);
    }
  }
  return (x, y) => dist[y][x];
})();

// German bunkers along the land bridge, the line the Don Front attacked again and again; a few
// opposite each Soviet bridgehead on the Don, none behind. Never on a road, river or town.
const landBridge = (x, y) => {
  const [lon, lat] = tileCenter(x, y);
  return lon > 43.95 && lon < 44.55 && lat > 48.86;
};
const bridgeheads = (x, y) => {
  const [lon, lat] = tileCenter(x, y);
  return lon < 43.4 && lat > 49.1;
};
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (sideOf(x, y) !== GERMANY || !".Fd".includes(at(x, y)) || frontDistance(x, y) > 1) continue;
    const r = noise(x, y, 7);
    if (landBridge(x, y) && r < (frontDistance(x, y) === 0 ? 0.55 : 0.2)) set(x, y, "X");
    else if (bridgeheads(x, y) && frontDistance(x, y) === 0 && r < 0.2) set(x, y, "X");
  }
}

// ---------------------------------------------------------------- starting forces

// Where armies gather that aren't at a town: the two Don bridgeheads, south of the river, so their
// tanks attack without crossing it; and the gaps between the Sarpa lakes, where the 51st Army struck.
for (const [name, lon, lat] of [["Serafimovich bridgehead", 42.8, 49.47], ["Kletskaya bridgehead", 43.18, 49.23], ["the lakes", 44.5, 48.27]]) {
  placed.set(name, toGrid([lon, lat]));
}

const used = new Set();
const groundOk = (ch) => [".", "=", "F", "d"].includes(ch);
const cityOk = (ch) => ["x", "."].includes(ch);
/** The nearest free tile to a place that suits `ok` and is on `side`'s ground, skipping properties and other units. */
function standNear(name, side, ok = groundOk) {
  const p = placed.get(name);
  for (let r = 1; r < 11; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || used.has(`${x},${y}`) || taken.has(`${x},${y}`)) continue;
        if (at(x, y) !== undefined && ok(at(x, y)) && sideOf(x, y) === side) return { x, y };
      }
    }
  }
  throw new Error(`No room for a unit near ${name}`);
}
const units = [];
const add = (type, owner, pos) => {
  if (used.has(`${pos.x},${pos.y}`)) throw new Error(`Two units at (${pos.x}, ${pos.y})`);
  used.add(`${pos.x},${pos.y}`);
  units.push({ type, owner, pos });
};
const inTown = (type, owner, name) => add(type, owner, placed.get(name));
const outside = (type, owner, name, ok) => add(type, owner, standNear(name, owner, ok));
/** East of the Volga, on the bank opposite the city, at the water's edge so the guns reach across. */
function eastBank(type, name) {
  const p = placed.get(name);
  let best;
  for (let y = 0; y < H; y++) {
    for (let x = volgaX(y) + 1; x < W; x++) {
      if (volgaX(y) < 0 || used.has(`${x},${y}`) || taken.has(`${x},${y}`) || !groundOk(at(x, y))) continue;
      if (!N4.some(([dx, dy]) => at(x + dx, y + dy) === "S")) continue;
      const d = Math.abs(x - p.x) + Math.abs(y - p.y);
      if (!best || d < best.d) best = { x, y, d };
    }
  }
  add(type, SOVIET, { x: best.x, y: best.y });
}

// Soviet Union. The northern pincer out of the Serafimovich bridgehead: the 5th Tank Army.
outside("mediumTank", SOVIET, "Serafimovich bridgehead");
outside("mediumTank", SOVIET, "Serafimovich bridgehead");
outside("mediumTank", SOVIET, "Serafimovich bridgehead");
outside("heavyTank", SOVIET, "Serafimovich bridgehead");
outside("lightTank", SOVIET, "Serafimovich bridgehead");
outside("infantry", SOVIET, "Serafimovich bridgehead");
outside("infantry", SOVIET, "Serafimovich bridgehead");
outside("infantry", SOVIET, "Serafimovich bridgehead");
outside("infantry", SOVIET, "Serafimovich bridgehead");
outside("artillery", SOVIET, "Serafimovich bridgehead");
outside("artillery", SOVIET, "Serafimovich bridgehead");
outside("rocketArtillery", SOVIET, "Serafimovich bridgehead");
// The Kletskaya bridgehead: the 21st Army and the 4th Tank Corps.
outside("mediumTank", SOVIET, "Kletskaya bridgehead");
outside("mediumTank", SOVIET, "Kletskaya bridgehead");
outside("infantry", SOVIET, "Kletskaya bridgehead");
outside("infantry", SOVIET, "Kletskaya bridgehead");
outside("infantry", SOVIET, "Kletskaya bridgehead");
outside("artillery", SOVIET, "Kletskaya bridgehead");
outside("mortar", SOVIET, "Kletskaya bridgehead");
// The Don Front, facing the land bridge from Kotluban.
outside("infantry", SOVIET, "Kotluban");
outside("infantry", SOVIET, "Kotluban");
outside("infantry", SOVIET, "Yerzovka");
outside("infantry", SOVIET, "Kotluban");
outside("artillery", SOVIET, "Kotluban");
outside("artillery", SOVIET, "Yerzovka");
outside("mediumTank", SOVIET, "Kotluban");
// The 62nd Army in the city: riflemen holding each foothold, a storm group and mortars in the
// fortified buildings behind.
inTown("infantry", SOVIET, "Rynok");
inTown("infantry", SOVIET, "Spartanovka");
inTown("infantry", SOVIET, "Red October");
add("assaultInfantry", SOVIET, behind("Red October"));
add("mortar", SOVIET, behind("Rynok"));
// The east bank: the massed guns that fired across the river, and the boats that crossed it.
inTown("landingCraft", SOVIET, "Krasnaya Sloboda");
eastBank("infantry", "Krasnaya Sloboda");
eastBank("artillery", "Krasnaya Sloboda");
eastBank("artillery", "Krasnaya Sloboda");
eastBank("rocketArtillery", "Krasnaya Sloboda");
// The southern pincer round Krasnoarmeysk and the lakes: the 57th and 51st Armies with the 13th
// and 4th Mechanized Corps.
outside("mediumTank", SOVIET, "Krasnoarmeysk");
outside("mediumTank", SOVIET, "Krasnoarmeysk");
outside("mediumTank", SOVIET, "the lakes");
outside("lightTank", SOVIET, "the lakes");
outside("infantry", SOVIET, "Krasnoarmeysk");
outside("infantry", SOVIET, "the lakes");
outside("infantry", SOVIET, "the lakes");
outside("artillery", SOVIET, "Krasnoarmeysk");
outside("rocketArtillery", SOVIET, "the lakes");
// Beketovka: the 64th Army.
inTown("infantry", SOVIET, "Beketovka");
outside("infantry", SOVIET, "Beketovka");
outside("artillery", SOVIET, "Beketovka");
// The air armies.
inTown("fighter", SOVIET, "Leninsk airfield");
inTown("bomber", SOVIET, "Kachalinskaya airfield");

// Germany. The 6th Army in the city: storm pioneers, riflemen, a few tanks and assault guns among
// the ruins, guns and mortars behind.
outside("assaultInfantry", GERMANY, "Tractor Factory", cityOk);
outside("assaultInfantry", GERMANY, "Barrikady", cityOk);
outside("assaultInfantry", GERMANY, "Mamayev Kurgan", cityOk);
inTown("infantry", GERMANY, "Tractor Factory");
inTown("infantry", GERMANY, "Barrikady");
inTown("infantry", GERMANY, "Central Station");
outside("infantry", GERMANY, "Kuporosnoe", cityOk);
outside("mediumTank", GERMANY, "Gorodishche");
outside("mediumTank", GERMANY, "Central Station", cityOk);
outside("tankDestroyer", GERMANY, "Grain Elevator", cityOk);
outside("artillery", GERMANY, "Gorodishche");
outside("artillery", GERMANY, "Gumrak airfield");
outside("mortar", GERMANY, "Barrikady", cityOk);
outside("mortar", GERMANY, "Central Station", cityOk);
outside("rocketArtillery", GERMANY, "Gumrak airfield");
outside("flakGun", GERMANY, "Pitomnik airfield");
// The land bridge: infantry in the bunkers, a few tanks behind.
add("infantry", GERMANY, standNear("Orlovka", GERMANY, (ch) => ch === "X"));
add("infantry", GERMANY, standNear("Vertyachy", GERMANY, (ch) => ch === "X"));
add("infantry", GERMANY, standNear("Orlovka", GERMANY, (ch) => ch === "X"));
outside("mediumTank", GERMANY, "Orlovka");
outside("mediumTank", GERMANY, "Vertyachy");
outside("artillery", GERMANY, "Orlovka");
// The Don front in the north-west (the Romanian 3rd Army): thin infantry, a light tank, little
// anti-tank; the 48th Panzer Corps in reserve near Perelazovsky.
add("infantry", GERMANY, standNear("Raspopinskaya", GERMANY, (ch) => ch === "X"));
outside("infantry", GERMANY, "Raspopinskaya");
outside("infantry", GERMANY, "Raspopinskaya");
outside("infantry", GERMANY, "Verkhne-Buzinovka");
outside("infantry", GERMANY, "Manoilin");
outside("artillery", GERMANY, "Raspopinskaya");
outside("lightTank", GERMANY, "Verkhne-Buzinovka");
outside("mediumTank", GERMANY, "Perelazovsky");
outside("lightTank", GERMANY, "Perelazovsky");
// The south (the Romanian 4th Army and the 4th Panzer Army); the 29th Motorized Division behind.
outside("infantry", GERMANY, "Tinguta");
outside("infantry", GERMANY, "Tinguta");
outside("infantry", GERMANY, "Plodovitoe");
outside("infantry", GERMANY, "Abganerovo");
outside("artillery", GERMANY, "Plodovitoe");
outside("halftrack", GERMANY, "Plodovitoe");
outside("mediumTank", GERMANY, "Plodovitoe");
// Kalach: a weak guard on the bridge.
inTown("infantry", GERMANY, "Kalach");
// The Luftwaffe: fighters and bombers, and the transports that would try to fly the airlift.
inTown("fighter", GERMANY, "Pitomnik airfield");
inTown("bomber", GERMANY, "Gumrak airfield");
inTown("bomber", GERMANY, "Oblivskaya airfield");
outside("transportAircraft", GERMANY, "Oblivskaya airfield");

// ---------------------------------------------------------------- write

const LAND = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank", "heavyTank",
  "tankDestroyer", "artillery", "rocketArtillery", "mobileAA", "flakGun",
];
const AIR = ["fighter", "bomber", "transportAircraft"];
const FOOTHOLDS = ["Rynok", "Spartanovka", "Red October"];
const owners = [
  ...CITY.filter(([, , , , owner]) => owner !== null).map(([name, , , , owner]) => ({ pos: placed.get(name), owner })),
  ...PLACES.map(([name, , , , owner]) => ({ pos: placed.get(name), owner })),
];
const scenario = {
  id: "stalingrad",
  name: "Stalingrad",
  description:
    "November 1942. The German 6th Army holds nearly all of Stalingrad, but the Soviets still cling to three footholds on the Volga, fed by boats from the far bank. Its flanks along the Don are thin. The Soviets strike from the north-west and the south to meet at Kalach and close the ring. Germany wins by taking Beketovka or the last three footholds in the city; the Soviet Union wins by taking Kalach.",
  map: grid.map((row) => row.join("")),
  players: [
    { name: "Soviet Union", nation: "ussr", funds: 6000, buildable: [...LAND, ...AIR, "landingCraft"] },
    { name: "Germany", nation: "germany", funds: 4000, buildable: [...LAND.filter((t) => t !== "heavyTank"), ...AIR], facing: "left" },
  ],
  propertyOwners: owners,
  units,
  // HQ capture, plus Germany's own goal: clear the city's last Soviet footholds. Rout is off on a map
  // this size (15-scenarios-eastern-front §2, Victory).
  victory: [
    { type: "hqCapture" },
    { type: "captureProperties", side: "axis", properties: FOOTHOLDS.map((name) => placed.get(name)) },
  ],
  weather: {
    season: "winter",
    forecast: [
      { fromDay: 1, weather: "snow" },
      { fromDay: 3, weather: "clear" },
      { fromDay: 7, weather: "snow" },
      { fromDay: 9, weather: "clear" },
      { fromDay: 12, weather: "snow" },
    ],
  },
};

const json = JSON.stringify(scenario, null, 2)
  // Keep each map row, unit and owner entry on one line so the file stays readable.
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+("type": "[^"]+"),\s+("owner": \d),\s+("pos": \{[^}]+\})\s+\}/g, "{ $1, $2, $3 }")
  .replace(/\{\s+("pos": \{[^}]+\}),\s+("owner": \d)\s+\}/g, "{ $1, $2 }")
  .replace(/\{\s+("fromDay": \d+),\s+("weather": "[a-z]+")\s+\}/g, "{ $1, $2 }")
  .replace(/\[\s+((?:"[a-zA-Z]+",?\s+)+)\]/g, (_, list) => `[${list.trim().split(/,\s+/).join(", ")}]`);
writeFileSync(new URL("../../src/scenarios/stalingrad.json", import.meta.url), json + "\n");

console.log(grid.map((row, y) => `${String(y).padStart(2)} ${row.join("")}`).join("\n"));
const count = (owner) => owners.filter((p) => p.owner === owner).length;
const bunkers = grid.flat().filter((ch) => ch === "X").length;
console.log(`\n${W}x${H}. Properties: Soviet ${count(SOVIET)}, Germany ${count(GERMANY)}. Bunkers ${bunkers}. Major bridges ${JSON.stringify(majorBridges)}.`);
console.log(`Units: Soviet ${units.filter((u) => u.owner === SOVIET).length}, Germany ${units.filter((u) => u.owner === GERMANY).length}.`);
for (const [name] of [...CITY, ...PLACES]) console.log(`${name}: (${placed.get(name).x}, ${placed.get(name).y})`);
