// Generates src/scenarios/normandy.json: southern England and Normandy across the Channel.
//
// Coastlines, rivers, roads and towns are written as real longitude/latitude points and projected
// onto the grid. The projection is stretched and squeezed in places (scale doesn't match real life):
// Normandy and the Solent get the most squares, the Channel is narrowed so a crossing takes a few
// turns, and the Kent/Calais end and inland England are squeezed.
//
// Run: node tools/maps/normandy.mjs        (writes the scenario and prints an ASCII preview)
//      node tools/maps/overview.mjs normandy  (redraws the overview picture in docs/maps)

import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------- projection

/** Piecewise-linear lookup: pairs of [real value, grid coordinate], in increasing real value. */
const piecewise = (pairs) => (v) => {
  for (let i = 0; i < pairs.length - 1; i++) {
    const [a, ga] = pairs[i];
    const [b, gb] = pairs[i + 1];
    if (v <= b || i === pairs.length - 2) return ga + ((v - a) / (b - a)) * (gb - ga);
  }
  throw new Error("unreachable");
};
const invert = (pairs) => piecewise(pairs.map(([v, g]) => [g, v]).sort((p, q) => p[0] - q[0]));

const LON = [[-2.55, 0], [0.4, 64], [2.4, 92]];
// Latitude runs north to south as y grows, so list it by grid row.
const LAT = [[52.15, 0], [51.05, 20], [50.55, 37], [49.75, 48], [49.35, 58], [49.05, 70], [48.8, 78]];
const W = 92;
const H = 78;

const lonToX = piecewise(LON);
const xToLon = invert(LON);
const latToYNeg = piecewise(LAT.map(([v, g]) => [-v, g]));
const latToY = (lat) => latToYNeg(-lat);
const yToLatNeg = invert(LAT.map(([v, g]) => [-v, g]));
const yToLat = (y) => -yToLatNeg(y);

const toGrid = ([lon, lat]) => ({ x: Math.floor(lonToX(lon)), y: Math.floor(latToY(lat)) });
const tileCenter = (x, y) => [xToLon(x + 0.5), yToLat(y + 0.5)];

// ---------------------------------------------------------------- coastlines (lon, lat)

const ENGLAND = [
  [-2.7, 52.6], [1.6, 52.6], [1.58, 52.1], [1.57, 52.08], [1.45, 52.0], [1.35, 51.95], [1.25, 51.93],
  [1.28, 51.85], [1.16, 51.78], [0.98, 51.79], [0.9, 51.74], [0.95, 51.68], [0.93, 51.58],
  [0.8, 51.53], [0.6, 51.51], [0.45, 51.47], [0.6, 51.44], [0.75, 51.43], [0.95, 51.38],
  [1.1, 51.37], [1.38, 51.39], [1.45, 51.37], [1.42, 51.32], [1.4, 51.22], [1.37, 51.14],
  [1.31, 51.12], [1.18, 51.08], [1.07, 51.06], [0.97, 50.91], [0.75, 50.93], [0.58, 50.85],
  [0.35, 50.8], [0.25, 50.73], [0.05, 50.78], [-0.14, 50.81], [-0.37, 50.8], [-0.68, 50.77],
  [-0.79, 50.72], [-0.92, 50.77], [-1.1, 50.78], [-1.2, 50.8], [-1.31, 50.81],
  // Southampton Water, a narrow inlet up to the port
  [-1.36, 50.88], [-1.4, 50.91], [-1.43, 50.89], [-1.36, 50.79],
  [-1.54, 50.74], [-1.75, 50.72], [-1.9, 50.7], [-1.95, 50.6], [-2.06, 50.58], [-2.25, 50.62],
  [-2.42, 50.6], [-2.44, 50.52], [-2.48, 50.56], [-2.52, 50.62], [-2.7, 50.66],
];

const ISLE_OF_WIGHT = [
  [-1.59, 50.66], [-1.5, 50.71], [-1.3, 50.76], [-1.1, 50.72], [-1.08, 50.68], [-1.18, 50.6],
  [-1.3, 50.575], [-1.45, 50.63],
];

const FRANCE = [
  [-1.6, 48.5], [-1.58, 49.0], [-1.62, 49.2], [-1.73, 49.33],
  [-1.82, 49.4], [-1.87, 49.5], [-1.88, 49.58], [-1.86, 49.66], [-1.95, 49.73], [-1.8, 49.7],
  [-1.62, 49.66], [-1.45, 49.7], [-1.27, 49.7], [-1.24, 49.62], [-1.27, 49.55], [-1.3, 49.5],
  [-1.22, 49.43], [-1.17, 49.37],
  // Baie des Veys: the Vire and Douve estuary between Utah and Omaha
  [-1.17, 49.33], [-1.1, 49.33], [-1.07, 49.39], [-0.99, 49.4], [-0.88, 49.375],
  [-0.75, 49.355], [-0.62, 49.345], [-0.5, 49.34], [-0.35, 49.33], [-0.25, 49.295],
  [-0.15, 49.29], [0.07, 49.36], [0.2, 49.41],
  // Seine estuary
  [0.38, 49.43], [0.38, 49.47], [0.12, 49.49], [0.07, 49.53], [0.1, 49.62], [0.2, 49.71],
  [0.37, 49.77], [0.6, 49.86], [0.9, 49.92], [1.08, 49.93], [1.38, 50.07], [1.55, 50.18],
  [1.6, 50.28], [1.58, 50.4], [1.57, 50.55], [1.6, 50.73], [1.58, 50.87], [1.75, 50.94],
  [1.86, 50.96], [2.6, 51.05], [2.6, 48.5], [-1.6, 48.5],
];

const JERSEY = [[-2.25, 49.17], [-2.25, 49.26], [-2.02, 49.24], [-2.02, 49.17]];

function inside(poly, [px, py]) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if (yi > py !== yj > py && px < ((xj - xi) * (py - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

// ---------------------------------------------------------------- grid helpers

const grid = Array.from({ length: H }, () => Array(W).fill("S"));
const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : undefined);
const set = (x, y, ch) => {
  if (at(x, y) !== undefined) grid[y][x] = ch;
};
const N4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const isLand = (ch) => ch !== undefined && ch !== "S" && ch !== "r";
const nextToSea = (x, y) => N4.some(([dx, dy]) => at(x + dx, y + dy) === "S");

/** Deterministic noise in [0, 1) for a tile and a salt, so the map is the same on every run. */
const noise = (x, y, salt) => {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

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

// ---------------------------------------------------------------- land and sea

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const c = tileCenter(x, y);
    if ([ENGLAND, ISLE_OF_WIGHT, FRANCE, JERSEY].some((p) => inside(p, c))) set(x, y, ".");
  }
}

// ---------------------------------------------------------------- countryside

const box = ([lon, lat], [w, s, e, n]) => lon >= w && lon <= e && lat >= s && lat <= n;
const near = ([lon, lat], [clon, clat], rx, ry) => ((lon - clon) / rx) ** 2 + ((lat - clat) / ry) ** 2 <= 1;

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (at(x, y) !== ".") continue;
    const c = tileCenter(x, y);
    const r = noise(x, y, 1);
    let ch = ".";
    // Normandy bocage: the Cotentin, the Bessin and the land around Saint-Lô.
    if (box(c, [-2.0, 48.8, -0.55, 49.62]) && c[1] < 49.31 + (c[0] < -1.15 ? 0.3 : 0)) ch = r < 0.55 ? "b" : r < 0.62 ? "F" : ".";
    else if (box(c, [-2.0, 49.45, -1.2, 49.75])) ch = r < 0.3 ? "b" : r < 0.4 ? "F" : ".";
    // Suisse Normande hills south of Caen, and the Pays d'Auge east of the Dives.
    else if (box(c, [-0.75, 48.8, -0.3, 49.0])) ch = r < 0.35 ? "H" : r < 0.5 ? "F" : r < 0.65 ? "b" : ".";
    else if (box(c, [0.0, 48.95, 0.5, 49.3])) ch = r < 0.25 ? "b" : r < 0.4 ? "H" : r < 0.5 ? "F" : ".";
    // Caen plain: open tank country.
    else if (box(c, [-0.55, 48.95, 0.0, 49.3])) ch = r < 0.06 ? "F" : ".";
    // Cap de la Hague hills.
    else if (box(c, [-1.95, 49.6, -1.75, 49.75])) ch = r < 0.5 ? "H" : ".";
    // Big forests.
    else if (near(c, [-1.6, 50.87], 0.18, 0.06)) ch = r < 0.8 ? "F" : "."; // New Forest
    else if (near(c, [0.05, 51.05], 0.25, 0.06)) ch = r < 0.6 ? "F" : "."; // Ashdown Forest and the Weald
    else if (near(c, [0.6, 51.08], 0.25, 0.05)) ch = r < 0.4 ? "F" : "."; // the Weald, Kent
    else if (near(c, [0.05, 51.67], 0.08, 0.04)) ch = r < 0.7 ? "F" : "."; // Epping Forest
    else if (near(c, [-0.88, 49.2], 0.08, 0.04)) ch = r < 0.8 ? "F" : "."; // Forêt de Cerisy
    else if (near(c, [0.75, 49.45], 0.12, 0.04)) ch = r < 0.7 ? "F" : "."; // Forêt de Brotonne
    else if (near(c, [1.55, 49.42], 0.18, 0.06)) ch = r < 0.7 ? "F" : "."; // Forêt de Lyons
    // Downs: chalk ridges across southern England.
    else if (Math.abs(c[1] - 50.9) < 0.04 && box(c, [-1.0, 50.8, 0.2, 51.0])) ch = r < 0.6 ? "H" : ".";
    else if (Math.abs(c[1] - (51.24 + 0.03 * c[0])) < 0.035 && box(c, [-0.85, 51.1, 1.05, 51.4])) ch = r < 0.55 ? "H" : ".";
    else if (Math.abs(c[1] - (51.68 - 0.1 * (c[0] + 0.6))) < 0.04 && box(c, [-1.0, 51.55, -0.3, 51.85])) ch = r < 0.55 ? "H" : ".";
    else if (box(c, [-2.6, 50.62, -1.95, 51.3])) ch = r < 0.15 ? "H" : r < 0.25 ? "F" : "."; // Dorset and Salisbury Plain
    // Everything else: farmland with scattered woods.
    else ch = r < 0.1 ? "F" : r < 0.13 ? "H" : ".";
    set(x, y, ch);
  }
}

// Cliffs: hills along the coast where no one lands.
const cliffs = [
  [1.15, 51.07, 1.4, 51.2], // White cliffs of Dover
  [0.15, 50.72, 0.3, 50.77], // Beachy Head
  [0.07, 49.5, 1.1, 49.95], // Pays de Caux, Étretat to Dieppe
  [-1.95, 49.6, -1.85, 49.75], // Cap de la Hague
];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const c = tileCenter(x, y);
    if (isLand(at(x, y)) && nextToSea(x, y) && cliffs.some(([w, s, e, n]) => box(c, [w - 0.03, s - 0.03, e + 0.03, n + 0.03]))) set(x, y, "H");
  }
}

// ---------------------------------------------------------------- rivers

const RIVERS = {
  thames: [[0.45, 51.46], [0.25, 51.47], [0.05, 51.5], [-0.1, 51.5], [-0.3, 51.45], [-0.55, 51.48], [-0.97, 51.46], [-1.1, 51.6], [-1.26, 51.75], [-1.4, 51.85], [-1.6, 52.0], [-1.8, 52.2]],
  seine: [[0.38, 49.45], [0.6, 49.43], [0.8, 49.48], [1.1, 49.43], [1.25, 49.3], [1.5, 49.2], [1.75, 49.1], [2.6, 49.0]],
  orne: [[-0.25, 49.28], [-0.32, 49.22], [-0.37, 49.17], [-0.4, 49.05], [-0.33, 48.92], [-0.3, 48.7]],
  dives: [[-0.12, 49.28], [-0.1, 49.15], [-0.05, 49.0], [0.0, 48.7]],
  vire: [[-1.12, 49.33], [-1.1, 49.22], [-1.09, 49.12], [-1.0, 49.0], [-0.92, 48.7]],
  douve: [[-1.15, 49.33], [-1.25, 49.31], [-1.38, 49.33], [-1.5, 49.38], [-1.6, 49.48]],
  merderet: [[-1.3, 49.31], [-1.35, 49.4], [-1.42, 49.52]],
  somme: [[1.58, 50.2], [1.83, 50.1], [2.6, 49.9]],
};
for (const points of Object.values(RIVERS)) {
  for (const p of polyline(points)) if (isLand(at(p.x, p.y))) set(p.x, p.y, "~");
}

// ---------------------------------------------------------------- towns and bases

// [name, lon, lat, kind, owner]  kind: Q hq, f factory, P port, A airfield, C city.  owner: 0 Allies, 1 Germany, null neutral.
const PLACES = [
  // England
  ["London", -0.13, 51.53, "Q", 0],
  ["Woolwich", 0.07, 51.47, "f", 0],
  ["Aldershot", -0.76, 51.25, "f", 0],
  ["Salisbury", -1.8, 51.07, "f", 0],
  ["Southampton", -1.4, 50.9, "P", 0],
  ["Portsmouth", -1.09, 50.8, "P", 0],
  ["Portland", -2.44, 50.57, "P", 0],
  ["Poole", -1.98, 50.71, "P", 0],
  ["Newhaven", 0.05, 50.79, "P", 0],
  ["Dover", 1.31, 51.12, "P", 0],
  ["Felixstowe", 1.35, 51.96, "P", 0],
  ["Tilbury", 0.37, 51.46, "P", 0],
  ["Tangmere", -0.71, 50.85, "A", 0],
  ["Biggin Hill", 0.03, 51.33, "A", 0],
  ["Manston", 1.35, 51.34, "A", 0],
  ["Winchester", -1.31, 51.06, "C", 0],
  ["Reading", -0.97, 51.45, "C", 0],
  ["Oxford", -1.26, 51.75, "C", 0],
  ["Guildford", -0.57, 51.24, "C", 0],
  ["Croydon", -0.1, 51.37, "C", 0],
  ["Watford", -0.4, 51.66, "C", 0],
  ["Brighton", -0.14, 50.83, "C", 0],
  ["Hastings", 0.58, 50.86, "C", 0],
  ["Folkestone", 1.18, 51.09, "C", 0],
  ["Canterbury", 1.08, 51.28, "C", 0],
  ["Maidstone", 0.52, 51.27, "C", 0],
  ["Chelmsford", 0.47, 51.73, "C", 0],
  ["Colchester", 0.9, 51.89, "C", 0],
  ["Ipswich", 1.15, 52.06, "C", 0],
  ["Southend", 0.71, 51.55, "C", 0],
  ["Bournemouth", -1.88, 50.73, "C", 0],
  ["Dorchester", -2.44, 50.71, "C", 0],
  ["Chichester", -0.78, 50.84, "C", 0],
  ["Basingstoke", -1.09, 51.27, "C", 0],
  ["Newbury", -1.32, 51.4, "C", 0],
  ["Luton", -0.42, 51.88, "C", 0],
  // France
  ["Falaise", -0.2, 48.89, "Q", 1],
  ["Caen", -0.37, 49.19, "f", 1],
  ["Saint-Lô", -1.09, 49.1, "f", 1],
  ["Rouen", 1.1, 49.4, "f", 1],
  ["Cherbourg", -1.62, 49.64, "P", 1],
  ["Le Havre", 0.12, 49.5, "P", 1],
  ["Dieppe", 1.08, 49.92, "P", 1],
  ["Boulogne", 1.6, 50.72, "P", 1],
  ["Calais", 1.86, 50.95, "P", 1],
  ["St Helier", -2.1, 49.19, "P", 1],
  ["Carpiquet", -0.46, 49.18, "A", 1],
  ["Abbeville", 1.83, 50.15, "A", 1],
  ["Carentan", -1.25, 49.29, "C", 1],
  ["Sainte-Mère-Église", -1.32, 49.41, "C", 1],
  ["Valognes", -1.47, 49.51, "C", 1],
  ["Bayeux", -0.7, 49.27, "C", 1],
  ["Lisieux", 0.23, 49.15, "C", 1],
  ["Évreux", 1.15, 49.02, "C", 1],
  ["Montreuil", 1.76, 50.46, "C", 1],
  ["Isigny", -1.1, 49.3, "C", null],
  ["Coutances", -1.44, 49.05, "C", null],
  ["Granville", -1.55, 48.84, "C", null],
  ["Vire", -0.89, 48.84, "C", null],
  ["Fécamp", 0.37, 49.75, "C", null],
  ["Honfleur", 0.23, 49.4, "C", null],
  ["Ouistreham", -0.26, 49.27, "C", null],
];

const placed = new Map();
const taken = new Set();
for (const [name, lon, lat, kind] of PLACES) {
  const want = toGrid([lon, lat]);
  // Ports sit on the shore, everything else inland and off rivers. Search outward for the nearest fit.
  const fits = (x, y) => {
    const ch = at(x, y);
    if (!isLand(ch) || ch === "~" || taken.has(`${x},${y}`)) return false;
    if (N4.some(([dx, dy]) => taken.has(`${x + dx},${y + dy}`))) return false;
    return kind === "P" ? nextToSea(x, y) : !nextToSea(x, y) || ["C"].includes(kind);
  };
  let spot;
  for (let r = 0; r < 6 && !spot; r++) {
    for (let dy = -r; dy <= r && !spot; dy++) {
      for (let dx = -r; dx <= r && !spot; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) === r && fits(want.x + dx, want.y + dy)) spot = { x: want.x + dx, y: want.y + dy };
      }
    }
  }
  if (!spot) throw new Error(`No room for ${name}`);
  placed.set(name, spot);
  taken.add(`${spot.x},${spot.y}`);
}

// ---------------------------------------------------------------- the Normandy shore

// Walked square by square: the first land square met coming in from the sea becomes beach or cliff.
// [coming from, start, end, terrain]. From the north the range is longitude; from the east or west, latitude.
const SHORE = [
  ["east", 49.37, 49.62, "_"], // Utah, and north past Quinéville to Saint-Vaast
  ["west", 49.0, 49.47, "_"], // west Cotentin
  ["north", -1.03, -0.93, "H"], // Pointe du Hoc: cliffs from Grandcamp to the west end of Omaha
  ["north", -0.93, -0.78, "_"], // Omaha
  ["north", -0.78, -0.61, "H"], // cliffs at Port-en-Bessin, Longues and Arromanches
  ["north", -0.61, -0.5, "_"], // Gold
  ["north", -0.5, -0.36, "_"], // Juno
  ["north", -0.36, -0.22, "_"], // Sword, to the mouth of the Orne
  ["north", -0.2, 0.07, "_"], // Cabourg to Deauville
];
const shoreColumn = new Map();
const canBecomeShore = (x, y) => [".", "b", "F", "H"].includes(at(x, y)) && !taken.has(`${x},${y}`) && nextToSea(x, y);
for (const [from, start, end, terrain] of SHORE) {
  if (from === "north") {
    for (let x = 0; x < W; x++) {
      const [lon] = tileCenter(x, 0);
      if (lon < start || lon >= end) continue;
      let y = toGrid([0, 49.5]).y;
      while (y < H && !isLand(at(x, y))) y++;
      shoreColumn.set(x, y);
      if (canBecomeShore(x, y)) set(x, y, terrain);
    }
  } else {
    // Start out at sea: east of the Cotentin is the Baie des Veys, west of it the open sea (Jersey lies further out).
    const step = from === "east" ? -1 : 1;
    for (let y = 0; y < H; y++) {
      const [, lat] = tileCenter(0, y);
      if (lat < start || lat >= end) continue;
      let x = toGrid([from === "east" ? -1.12 : -1.95, 0]).x;
      while (x >= 0 && x < W && !isLand(at(x, y))) x += step;
      if (canBecomeShore(x, y)) set(x, y, terrain);
    }
  }
}
// Bunkers on the clifftops: the Rangers' target at Pointe du Hoc, and the Longues battery.
for (const lon of [-0.99, -0.7]) {
  const x = toGrid([lon, 0]).x;
  set(x, shoreColumn.get(x), "X");
}

// ---------------------------------------------------------------- roads

/** Cheapest route between two places: follows existing roads, avoids woods and hills, crosses rivers only when it must. */
const ROAD_COST = { ".": 1, "=": 0.4, "#": 0.4, F: 2.5, b: 2.5, H: 4, "~": 12 };
function roadPath(a, b) {
  const key = (x, y) => y * W + x;
  const dist = new Map([[key(a.x, a.y), 0]]);
  const from = new Map();
  const heap = [[0, a.x, a.y]];
  const push = (item) => {
    heap.push(item);
    for (let i = heap.length - 1; i > 0; ) {
      const parent = (i - 1) >> 1;
      if (heap[parent][0] <= heap[i][0]) break;
      [heap[parent], heap[i]] = [heap[i], heap[parent]];
      i = parent;
    }
  };
  const pop = () => {
    const top = heap[0];
    const last = heap.pop();
    if (heap.length > 0) {
      heap[0] = last;
      for (let i = 0; ; ) {
        const l = 2 * i + 1;
        const r = l + 1;
        let m = i;
        if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
        if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
        if (m === i) break;
        [heap[m], heap[i]] = [heap[i], heap[m]];
        i = m;
      }
    }
    return top;
  };
  while (heap.length > 0) {
    const [d, x, y] = pop();
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
        push([nd, nx, ny]);
      }
    }
  }
  const path = [];
  for (let p = [b.x, b.y]; p; p = from.get(key(p[0], p[1]))) path.unshift({ x: p[0], y: p[1] });
  if (path[0]?.x !== a.x || path[0]?.y !== a.y) throw new Error(`No road from (${a.x}, ${a.y}) to (${b.x}, ${b.y})`);
  return path;
}

const ROADS = [
  // England
  ["London", "Watford", "Luton"],
  ["London", "Reading", "Newbury", "Winchester", "Southampton"],
  ["Reading", "Oxford"],
  ["London", "Guildford", "Aldershot", "Basingstoke", "Winchester"],
  ["Guildford", "Chichester", "Portsmouth"],
  ["London", "Croydon", "Biggin Hill"],
  ["Croydon", "Brighton", "Newhaven"],
  ["Woolwich", "Maidstone", "Canterbury", "Dover"],
  ["Canterbury", "Manston"],
  ["Woolwich", "London"],
  ["London", "Chelmsford", "Colchester", "Ipswich", "Felixstowe"],
  ["Chelmsford", "Southend"],
  ["Woolwich", "Tilbury"],
  ["Southampton", "Portsmouth"],
  ["Southampton", "Bournemouth", "Poole", "Dorchester", "Portland"],
  ["Winchester", "Salisbury", "Dorchester"],
  ["Portsmouth", "Chichester", "Tangmere", "Brighton", "Hastings", "Folkestone", "Dover"],
  ["Maidstone", "Hastings"],
  // France
  ["Cherbourg", "Valognes", "Sainte-Mère-Église", "Carentan", "Isigny", "Bayeux", "Caen"],
  ["Caen", "Carpiquet"],
  ["Caen", "Lisieux", "Rouen"],
  ["Caen", "Ouistreham"],
  ["Caen", "Falaise"],
  ["Carentan", "Saint-Lô", "Bayeux"],
  ["Saint-Lô", "Coutances", "Granville"],
  ["Saint-Lô", "Vire", "Falaise"],
  ["Caen", "Vire"],
  ["Lisieux", "Falaise"],
  ["Lisieux", "Évreux", "Rouen"],
  ["Honfleur", "Lisieux"],
  ["Le Havre", "Rouen"],
  ["Le Havre", "Fécamp", "Dieppe", "Abbeville", "Montreuil", "Boulogne", "Calais"],
  ["Rouen", "Dieppe"],
  ["Valognes", "Coutances"],
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
      else if (ch !== "#") set(p.x, p.y, "=");
    }
  }
}

// ---------------------------------------------------------------- beaches, reefs and the Atlantic Wall

// Beaches elsewhere: [west, south, east, north] boxes; shore tiles inside become beach.
const BEACHES = [
  [1.55, 50.2, 1.68, 50.68], // Pas-de-Calais beaches, where the Germans expect the landing
  [-1.38, 50.78, -1.15, 50.83], // Stokes Bay and Lee-on-the-Solent, embarkation hards
  [-1.98, 50.62, -1.92, 50.69], // Studland Bay
  [-0.7, 50.76, -0.4, 50.82], // Bognor and Littlehampton
  [1.0, 51.04, 1.12, 51.08], // Hythe
  [0.95, 51.7, 1.3, 51.86], // Clacton and Walton
];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const c = tileCenter(x, y);
    const ch = at(x, y);
    if (isLand(ch) && ch !== "~" && !taken.has(`${x},${y}`) && nextToSea(x, y) && BEACHES.some((b) => box(c, b))) set(x, y, "_");
  }
}

// Rochers du Calvados off Gold and Juno, and the Goodwin Sands off Deal.
for (const [lon, lat] of [[-0.56, 49.38], [-0.5, 49.38], [-0.44, 49.375], [1.55, 51.26], [1.57, 51.22], [1.56, 51.3]]) {
  const p = toGrid([lon, lat]);
  if (at(p.x, p.y) === "S") set(p.x, p.y, "r");
}

// Bunkers just behind the beaches and around the big ports; a few obstacles at Calais.
const BUNKERS = [
  [-1.22, 49.43], [-1.21, 49.48], // Utah
  [-0.9, 49.36], [-0.85, 49.355], // Omaha
  [-0.6, 49.33], [-0.45, 49.32], [-0.32, 49.29], // Gold, Juno, Sword
  [-1.56, 49.63], [0.15, 49.48], [1.05, 49.9], // Cherbourg, Le Havre, Dieppe
  [1.62, 50.3], [1.62, 50.5], [1.65, 50.7], [1.68, 50.85], [1.8, 50.93], // Pas-de-Calais
];
for (const [lon, lat] of BUNKERS) {
  const want = toGrid([lon, lat]);
  // The first ordinary land tile at or just inland of the point, behind the shore rather than on it.
  let spot;
  for (let dy = 0; dy <= 3 && !spot; dy++) {
    for (const dx of [0, -1, 1]) {
      const x = want.x + dx;
      const y = want.y + dy;
      if (!spot && [".", "b", "F", "H"].includes(at(x, y)) && !taken.has(`${x},${y}`) && !nextToSea(x, y)) spot = { x, y };
    }
  }
  if (spot) set(spot.x, spot.y, "X");
}
for (const [lon, lat] of [[1.64, 50.25], [1.64, 50.42], [1.66, 50.6]]) {
  const p = toGrid([lon, lat]);
  if (at(p.x, p.y) === ".") set(p.x, p.y, "o");
}

for (const [name, kind] of PLACES.map(([n, , , k]) => [n, k])) {
  const p = placed.get(name);
  set(p.x, p.y, kind);
}

// ---------------------------------------------------------------- units

const ALLIES = 0;
const AXIS = 1;
/** The nearest tile to a place that this kind of unit can stand on, skipping properties and other units. */
const used = new Set();
function standNear(name, ok) {
  const p = placed.get(name);
  for (let r = 1; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || used.has(`${x},${y}`) || taken.has(`${x},${y}`)) continue;
        if (ok(at(x, y))) return { x, y };
      }
    }
  }
  throw new Error(`No room for a unit near ${name}`);
}
const onLand = (ch) => [".", "=", "F"].includes(ch);
const units = [];
const add = (type, owner, pos) => {
  used.add(`${pos.x},${pos.y}`);
  units.push({ type, owner, pos });
};
const onBunker = (lonlat) => {
  const p = toGrid(lonlat);
  for (let r = 0; r < 4; r++) {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (at(p.x + dx, p.y + dy) === "X" && !used.has(`${p.x + dx},${p.y + dy}`)) return { x: p.x + dx, y: p.y + dy };
  }
  throw new Error(`No bunker near ${lonlat}`);
};

// Allies: a small force gathering on the south coast, one landing craft and one destroyer.
add("landingCraft", ALLIES, placed.get("Southampton"));
add("destroyer", ALLIES, placed.get("Portsmouth"));
add("infantry", ALLIES, standNear("Southampton", onLand));
add("infantry", ALLIES, standNear("Portsmouth", onLand));
add("mediumTank", ALLIES, standNear("Aldershot", onLand));
add("infantry", ALLIES, standNear("Dover", onLand));
// Germany: thin garrisons on the Atlantic Wall and a small reserve near Caen.
add("infantry", AXIS, onBunker([-1.22, 49.45]));
add("infantry", AXIS, onBunker([-0.88, 49.36]));
add("infantry", AXIS, onBunker([1.75, 50.9]));
add("infantry", AXIS, standNear("Cherbourg", onLand));
add("mediumTank", AXIS, standNear("Caen", onLand));
add("artillery", AXIS, standNear("Bayeux", onLand));

// ---------------------------------------------------------------- write

const meanX = (owner) => {
  const xs = units.filter((u) => u.owner === owner).map((u) => u.pos.x);
  return xs.reduce((s, x) => s + x, 0) / xs.length;
};
const alliesOnLeft = meanX(ALLIES) < meanX(AXIS);

const LAND = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank",
  "tankDestroyer", "artillery", "rocketArtillery", "mobileAA", "flakGun",
];
const scenario = {
  id: "normandy",
  name: "Normandy",
  description:
    "Southern England faces Normandy across the Channel. The Allies start small but England's cities and ports pay for a huge invasion force; the Germans hold the Atlantic Wall with a thin garrison. Ferry troops over in Landing Craft and capture the German HQ at Falaise. Too wide for rockets to fire across.",
  map: grid.map((row) => row.join("")),
  players: [
    {
      name: "Allies",
      nation: "us",
      funds: 10000,
      buildable: [...LAND, "fighter", "bomber", "transportAircraft", "battleship", "destroyer", "submarine", "landingCraft", "torpedoBoat"],
      ...(alliesOnLeft ? {} : { facing: "left" }),
    },
    {
      name: "Axis",
      nation: "germany",
      funds: 8000,
      buildable: [...LAND, "heavyTank", "fighter", "bomber", "transportAircraft", "destroyer", "submarine", "torpedoBoat"],
      ...(alliesOnLeft ? { facing: "left" } : {}),
    },
  ],
  propertyOwners: PLACES.filter(([, , , , owner]) => owner !== null).map(([name, , , , owner]) => ({ pos: placed.get(name), owner })),
  units,
  victory: [{ type: "hqCapture" }],
};

const json = JSON.stringify(scenario, null, 2)
  // Keep each map row, unit and owner entry on one line so the file stays readable.
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+("type": "[^"]+"),\s+("owner": \d),\s+("pos": \{[^}]+\})\s+\}/g, "{ $1, $2, $3 }")
  .replace(/\{\s+("pos": \{[^}]+\}),\s+("owner": \d)\s+\}/g, "{ $1, $2 }")
  .replace(/\[\s+((?:"[a-zA-Z]+",?\s+)+)\]/g, (_, list) => `[${list.trim().split(/,\s+/).join(", ")}]`);
writeFileSync(new URL("../../src/scenarios/normandy.json", import.meta.url), json + "\n");

console.log(grid.map((row, y) => `${String(y).padStart(2)} ${row.join("")}`).join("\n"));
const income = (owner) => scenario.propertyOwners.filter((p) => p.owner === owner).length;
console.log(`\n${W}x${H}. Properties: Allies ${income(0)}, Axis ${income(1)}, neutral ${PLACES.filter((p) => p[4] === null).length}.`);
