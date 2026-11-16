// Generates src/scenarios/el-alamein.json: the Second Battle of El Alamein, October 1942.
//
// The coast, places, ridges, the Axis front line and the edge of the Qattara Depression are written
// as real longitude/latitude points and projected onto the grid (each square is about 3 km). Two
// minefield belts, the "Devil's Gardens", follow the front from the sea to the Depression, the first
// unbroken, the second with a few gaps covered by strongpoints (18-scenarios-north-africa §1). The
// coast road gets a Bunker where it crosses each belt instead of mines. Desert terrain: 02-terrain §4b.
//
// Run: node tools/maps/el-alamein.mjs           (writes the scenario and prints an ASCII preview)
//      node tools/maps/overview.mjs el-alamein  (redraws the overview picture in docs/maps)

import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------- projection

const WEST = 28.35;
const EAST = 29.45;
const NORTH = 31.08;
const SOUTH = 30.12;
const W = 36;
const H = 32;

const toGrid = ([lon, lat]) => ({
  x: Math.min(W - 1, Math.max(0, Math.floor(((lon - WEST) / (EAST - WEST)) * W))),
  y: Math.min(H - 1, Math.max(0, Math.floor(((NORTH - lat) / (NORTH - SOUTH)) * H))),
});
const tileCenter = (x, y) => [WEST + ((x + 0.5) / W) * (EAST - WEST), NORTH - ((y + 0.5) / H) * (NORTH - SOUTH)];

// ---------------------------------------------------------------- grid helpers

const grid = Array.from({ length: H }, () => Array(W).fill("."));
const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : undefined);
const set = (x, y, ch) => {
  if (at(x, y) !== undefined) grid[y][x] = ch;
};
const N4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const key = (p) => `${p.x},${p.y}`;

/** Deterministic noise in [0, 1) for a tile and a salt, so the map is the same on every run. */
const noise = (x, y, salt) => {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};

/** 4-connected grid line, so a belt of mines has no diagonal gap a unit could slip through. */
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
const gridLine = (points) => points.flatMap((p, i, all) => (i === 0 ? [p] : line(all[i - 1], p).slice(1)));
/** Linear interpolation of a [lon, lat] polyline: the latitude at a longitude. */
const latAt = (points, lon) => {
  for (let i = 1; i < points.length; i++) {
    const [x0, y0] = points[i - 1];
    const [x1, y1] = points[i];
    if (lon <= x1) return y0 + ((lon - x0) / (x1 - x0)) * (y1 - y0);
  }
  return points[points.length - 1][1];
};

// ---------------------------------------------------------------- sea, desert and the Depression

// The coast, west to east: El Daba, Sidi Abd el Rahman, Tel el Eisa, El Alamein, El Hammam.
const COAST = [[28.3, 31.06], [28.45, 31.04], [28.6, 31.0], [28.75, 30.93], [28.9, 30.88], [29.05, 30.86], [29.25, 30.865], [29.5, 30.9]];
// The northern edge of the Qattara Depression: salt marsh and soft sand south of it.
const DEPRESSION = [[28.3, 30.2], [28.5, 30.24], [28.65, 30.26], [28.85, 30.27], [29.05, 30.24], [29.25, 30.19], [29.5, 30.13]];

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const [lon, lat] = tileCenter(x, y);
    if (lat > latAt(COAST, lon)) set(x, y, "S");
    else if (lat < latAt(DEPRESSION, lon)) set(x, y, "z");
  }
}
// The Depression's rim is a broken escarpment: rock outcrops along the edge.
for (let x = 0; x < W; x++) {
  for (let y = 0; y < H; y++) {
    if (at(x, y) === "." && at(x, y + 1) === "z" && noise(x, y, 3) < 0.35) set(x, y, "H");
  }
}

// ---------------------------------------------------------------- ridges and hills

/** The low ridges fought over for days (02-terrain §4b), as lines of [lon, lat] points. */
const RIDGES = {
  miteiriya: [[28.77, 30.79], [28.83, 30.81], [28.87, 30.83]],
  kidney: [[28.72, 30.86], [28.75, 30.86]],
  aqqaqir: [[28.68, 30.84], [28.7, 30.83]],
  ruweisat: [[28.88, 30.7], [28.96, 30.71], [29.03, 30.71]],
  alamHalfa: [[29.0, 30.62], [29.06, 30.64], [29.12, 30.65]],
};
for (const points of Object.values(RIDGES)) {
  for (const p of gridLine(points.map(toGrid))) if (at(p.x, p.y) === ".") set(p.x, p.y, "d");
}
// Qaret el Himeimat: the hill at the south end of the line, which tanks couldn't climb.
for (const p of [toGrid([28.64, 30.29]), toGrid([28.67, 30.29])]) set(p.x, p.y, "H");

// ---------------------------------------------------------------- the front and the Devil's Gardens

// The Axis forward edge on 23 October, north to south: Tel el Eisa on the coast, past the west end of
// Miteiriya Ridge and the head of Ruweisat Ridge, through Deir el Munassib to Qaret el Himeimat.
const FRONT = [[28.81, 30.95], [28.81, 30.88], [28.83, 30.8], [28.85, 30.72], [28.84, 30.63], [28.81, 30.53], [28.75, 30.42], [28.69, 30.33], [28.69, 30.2]];
const belt1 = gridLine(FRONT.map(toGrid));
/** The second belt runs this many squares behind (west of) the first. */
const BELT_GAP = 3;
const belt2 = belt1.map((p) => ({ x: p.x - BELT_GAP, y: p.y }));
const inLand = (p) => at(p.x, p.y) !== undefined && at(p.x, p.y) !== "S" && at(p.x, p.y) !== "z";
/** The easternmost first-belt square in each row: the Allied side starts east of it. */
const frontX = new Map();
for (const p of belt1) if (inLand(p)) frontX.set(p.y, Math.max(frontX.get(p.y) ?? -1, p.x));
const rows = [...frontX.keys()].sort((a, b) => a - b);
const firstRow = rows[0];
const lastRow = rows[rows.length - 1];

// ---------------------------------------------------------------- places

const UK = 0;
const GERMANY = 1;
const ITALY = 2;

// [name, lon, lat, kind, owner]  kind: Q hq, f factory, A airfield, C city.
// The inland desert had almost no towns: most of these stand for railway halts, dumps and camps.
const PLACES = [
  // The UK: the Eighth Army's rear along the coast railway, its dumps and the Desert Air Force.
  ["El Hammam", 29.39, 30.84, "Q", UK],
  ["El Imayid", 29.13, 30.83, "f", UK],
  ["El Alamein", 28.96, 30.83, "f", UK],
  ["Landing Ground 1", 29.3, 30.72, "A", UK],
  ["Landing Ground 2", 29.38, 30.62, "A", UK],
  ["Alam Halfa", 29.12, 30.6, "C", UK],
  ["Deir el Ragil", 28.98, 30.5, "C", UK],
  ["Samaket Gaballa", 29.08, 30.38, "C", UK],
  ["Ruweisat Station", 29.2, 30.82, "C", UK],
  // Germany: Panzerarmee's rear on the coast.
  ["El Daba", 28.47, 31.0, "Q", GERMANY],
  ["Ghazal", 28.57, 30.97, "f", GERMANY],
  ["El Daba airfield", 28.42, 30.93, "A", GERMANY],
  ["Sidi Abd el Rahman", 28.66, 30.95, "C", GERMANY],
  ["Tel el Mampsra", 28.71, 30.89, "C", GERMANY],
  // Italy: the camps behind the centre and south of the line.
  ["Bab el Qattara", 28.62, 30.56, "f", ITALY],
  ["Deir el Qatani", 28.68, 30.72, "C", ITALY],
  ["El Mreir", 28.66, 30.64, "C", ITALY],
  ["Qaret el Abd", 28.55, 30.42, "C", ITALY],
];

const placed = new Map();
const taken = new Set();
for (const [name, lon, lat] of PLACES) {
  const want = toGrid([lon, lat]);
  const fits = (x, y) => {
    const ch = at(x, y);
    if (ch !== "." || taken.has(`${x},${y}`)) return false;
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
  taken.add(key(spot));
}
for (const [name, , , kind] of PLACES) {
  const p = placed.get(name);
  set(p.x, p.y, kind);
}

// ---------------------------------------------------------------- roads

/** Cheapest route between two places, over open desert, avoiding ridges and hills. */
const ROAD_COST = { ".": 1, "=": 0.4, d: 3, H: 6 };
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
      const step = isEnd ? 1 : taken.has(`${nx},${ny}`) ? undefined : ROAD_COST[at(nx, ny)];
      if (step === undefined) continue;
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
  // The coast road and railway, the only metalled road, from El Daba to El Hammam.
  ["El Daba", "Ghazal", "Sidi Abd el Rahman", "Tel el Mampsra", "El Alamein", "Ruweisat Station", "El Imayid", "El Hammam"],
  ["El Daba airfield", "El Daba"],
  // The Rahman track, south from the coast behind the Axis line, and the tracks to the Italian camps.
  ["Sidi Abd el Rahman", "Deir el Qatani", "El Mreir", "Bab el Qattara", "Qaret el Abd"],
  // Allied tracks from the railway south to the ridges and the southern sector.
  ["El Alamein", "Alam Halfa", "Deir el Ragil", "Samaket Gaballa"],
  ["El Imayid", "Landing Ground 1", "Landing Ground 2", "Alam Halfa"],
];
const coastRoad = new Set();
ROADS.forEach((route, n) => {
  for (let i = 1; i < route.length; i++) {
    const a = placed.get(route[i - 1]);
    const b = placed.get(route[i]);
    if (!a || !b) throw new Error(`Unknown place on road ${route.join(" - ")}`);
    for (const p of roadPath(a, b)) {
      if (n === 0) coastRoad.add(key(p));
      if (!taken.has(key(p))) set(p.x, p.y, "=");
    }
  }
});

// ---------------------------------------------------------------- lay the minefields

/** Second-belt gaps for Axis counterattacks, as rows; each is covered by a Bunker just behind it. */
const singleRow = (y) => belt2.filter((q) => q.y === y && inLand(q)).length === 1;
const GAP_ROWS = [0.25, 0.5, 0.75].map((f) => {
  const want = firstRow + (lastRow - firstRow) * f;
  const best = rows.filter(singleRow).sort((a, b) => Math.abs(a - want) - Math.abs(b - want))[0];
  if (best === undefined) throw new Error("No row for a gap in the second belt");
  return best;
});
const gaps = [];
const lay = (belt, withGaps) => {
  for (const p of belt) {
    if (!inLand(p) || taken.has(key(p))) continue;
    // The coast road gets a strongpoint where it crosses a belt, never mines (18-scenarios-north-africa §1).
    if (at(p.x, p.y) === "=") {
      set(p.x, p.y, "X");
      continue;
    }
    // A gap only where this row's belt is a single square, so it opens a real lane.
    const singleInRow = belt.filter((q) => q.y === p.y).length === 1;
    if (withGaps && GAP_ROWS.includes(p.y) && singleInRow) {
      gaps.push(p);
      set(p.x, p.y, ".");
      set(p.x - 1, p.y, "X");
      continue;
    }
    set(p.x, p.y, "m");
  }
};
lay(belt1, false);
lay(belt2, true);
if (gaps.length !== GAP_ROWS.length) throw new Error(`Only ${gaps.length} gaps in the second belt`);

// Strongpoints between the belts: a Bunker every third row, alternating squares.
const strongpoints = [];
for (const y of rows) {
  if ((y - firstRow) % 3 !== 1) continue;
  const x = frontX.get(y) - (y % 2 === 0 ? 1 : 2);
  if (at(x, y) === "." || at(x, y) === "d") {
    set(x, y, "X");
    strongpoints.push({ x, y });
  }
}

// ---------------------------------------------------------------- starting forces

const used = new Set();
const groundOk = (ch) => [".", "=", "d"].includes(ch);
const units = [];
const add = (type, owner, pos, extra = {}) => {
  if (used.has(key(pos))) throw new Error(`Two units at (${pos.x}, ${pos.y})`);
  used.add(key(pos));
  units.push({ type, owner, pos, ...extra });
};
/** The nearest free ground square to (x, y), searching outward, never in the minefields or on a property. */
function freeNear(x0, y0, ok = groundOk) {
  for (let r = 0; r < 8; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = x0 + dx;
        const y = y0 + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || used.has(`${x},${y}`) || taken.has(`${x},${y}`)) continue;
        if (ok(at(x, y))) return { x, y };
      }
    }
  }
  throw new Error(`No room for a unit near (${x0}, ${y0})`);
}
/** A row a fraction of the way down the front, from the coast (0) to the Depression (1). */
const rowAt = (f) => rows[Math.min(rows.length - 1, Math.round(f * (rows.length - 1)))];
/** A square `dx` columns east (positive) or west (negative) of the first belt, `f` of the way down the front. */
const byFront = (f, dx) => {
  const y = rowAt(f);
  return { x: frontX.get(y) + dx, y };
};
/** Allied units start east of the first belt; Axis units west of the second. */
const allied = (f, dx) => freeNear(byFront(f, dx).x, byFront(f, dx).y, (ch) => groundOk(ch));
const behindLines = (f, dx) => {
  const want = byFront(f, -BELT_GAP - dx);
  return freeNear(want.x, want.y, (ch) => groundOk(ch));
};
const near = (name, ok) => freeNear(placed.get(name).x, placed.get(name).y, ok);
const air = (name, dx, dy) => freeNear(placed.get(name).x + dx, placed.get(name).y + dy, (ch) => ch !== undefined && ch !== "S");

/** Places a unit, checking that Allied units stay east of the first belt and Axis units west of it. */
const place = (type, owner, pos, extra) => {
  const fx = frontX.get(pos.y);
  if (fx !== undefined && type !== "fighter" && type !== "bomber") {
    if (owner === UK && pos.x <= fx) throw new Error(`An Allied ${type} at (${pos.x}, ${pos.y}) starts inside the minefields`);
    if (owner !== UK && pos.x > fx) throw new Error(`An Axis ${type} at (${pos.x}, ${pos.y}) starts east of the minefields`);
  }
  add(type, owner, pos, extra);
};

// The UK. XXX Corps faces the northern belts, from the coast to Miteiriya Ridge.
[0.05, 0.12, 0.18, 0.25, 0.3, 0.36].forEach((f) => place("infantry", UK, allied(f, 1)));
[0.08, 0.2, 0.32].forEach((f) => place("assaultInfantry", UK, allied(f, 2)));
[0.14, 0.28].forEach((f) => place("mortar", UK, allied(f, 2)));
[0.06, 0.16, 0.26, 0.36].forEach((f) => place("artillery", UK, allied(f, 3)));
[0.1, 0.3].forEach((f) => place("mediumTank", UK, allied(f, 3)));
// X Corps' armour waits behind XXX Corps to pass through the corridors.
[0.05, 0.12, 0.2, 0.28, 0.36].forEach((f) => place("mediumTank", UK, allied(f, 5)));
place("lightTank", UK, allied(0.16, 6));
place("halftrack", UK, allied(0.08, 6), { cargo: [{ type: "infantry" }] });
place("halftrack", UK, allied(0.24, 6), { cargo: [{ type: "infantry" }] });
place("recon", UK, allied(0.32, 6));
place("tankDestroyer", UK, allied(0.12, 7));
place("mobileAA", UK, allied(0.22, 7));
// The 4th Indian Division on Ruweisat Ridge.
[0.46, 0.52].forEach((f) => place("infantry", UK, allied(f, 1)));
// XIII Corps in the south, with the Free French facing Himeimat.
[0.68, 0.8, 0.92].forEach((f) => place("infantry", UK, allied(f, 1)));
place("assaultInfantry", UK, allied(0.86, 2));
place("artillery", UK, allied(0.74, 3));
[0.7, 0.84].forEach((f) => place("mediumTank", UK, allied(f, 4)));
place("lightTank", UK, allied(0.78, 5));
place("recon", UK, allied(0.9, 5));
// The Desert Air Force on its landing grounds.
add("fighter", UK, placed.get("Landing Ground 1"));
add("fighter", UK, placed.get("Landing Ground 2"));
add("bomber", UK, air("Landing Ground 1", 1, 0));
add("bomber", UK, air("Landing Ground 2", 1, 0));

// Strongpoints between the belts: the Italian infantry divisions, stiffened by the 164th Light and Ramcke.
const garrisons = [...strongpoints].sort((a, b) => a.y - b.y);
const garrison = (owner, i) => {
  const spot = garrisons[i];
  if (!spot) throw new Error(`No strongpoint ${i}`);
  place("infantry", owner, spot);
};
// The coast road's strongpoints, behind each belt, held by the 164th Light.
const roadForts = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === "X" && coastRoad.has(`${x},${y}`)) roadForts.push({ x, y });
roadForts.forEach((p) => place("infantry", GERMANY, p));
// Italians in most strongpoints; Germans in the north (164th Light) and centre (Ramcke).
garrisons.forEach((_, i) => garrison(i === 0 || i === Math.floor(garrisons.length / 2) ? GERMANY : ITALY, i));

// Germany.
const LOW_MEDIUM = { fuel: 12 };
const LOW_LIGHT = { fuel: 11 };
// The 164th Light: a mortar behind the northern strongpoints.
place("mortar", GERMANY, behindLines(0.15, 1));
// The 15th Panzer behind the northern belts, and the anti-tank screen of 88s.
place("mediumTank", GERMANY, behindLines(0.2, 3), LOW_MEDIUM);
place("mediumTank", GERMANY, behindLines(0.3, 3), LOW_MEDIUM);
place("artillery", GERMANY, behindLines(0.25, 2));
place("tankDestroyer", GERMANY, behindLines(0.1, 1));
place("tankDestroyer", GERMANY, behindLines(0.28, 1));
// The Ramcke Brigade in the centre of the line.
place("infantry", GERMANY, behindLines(0.5, 1));
// The 21st Panzer behind the southern belts.
place("mediumTank", GERMANY, behindLines(0.72, 3), LOW_MEDIUM);
place("mediumTank", GERMANY, behindLines(0.8, 3), LOW_MEDIUM);
// The 90th Light near Ghazal.
place("infantry", GERMANY, near("Ghazal"));
place("infantry", GERMANY, near("Ghazal"));
place("assaultInfantry", GERMANY, near("Sidi Abd el Rahman"));
place("halftrack", GERMANY, near("Ghazal"));
// El Daba: the airfield's flak and the Luftwaffe.
place("flakGun", GERMANY, near("El Daba airfield"));
add("fighter", GERMANY, placed.get("El Daba airfield"));
add("fighter", GERMANY, air("El Daba airfield", 0, 1));
add("bomber", GERMANY, air("El Daba airfield", -1, 0));

// Italy.
// Trento, Bologna, Brescia and Pavia: mortars and artillery behind their strongpoints.
place("mortar", ITALY, behindLines(0.4, 1));
place("mortar", ITALY, behindLines(0.62, 1));
place("artillery", ITALY, behindLines(0.45, 2));
place("artillery", ITALY, behindLines(0.66, 2));
// Littorio, paired with the 15th Panzer in the north, and Ariete with the 21st in the south.
place("mediumTank", ITALY, behindLines(0.15, 4), LOW_MEDIUM);
place("mediumTank", ITALY, behindLines(0.35, 4), LOW_MEDIUM);
place("mediumTank", ITALY, behindLines(0.68, 4), LOW_MEDIUM);
place("mediumTank", ITALY, behindLines(0.86, 4), LOW_MEDIUM);
// Trieste in reserve near Rahman.
place("infantry", ITALY, near("Deir el Qatani"));
place("lightTank", ITALY, near("Sidi Abd el Rahman"), LOW_LIGHT);
// The Folgore at the south end, facing Himeimat.
place("infantry", ITALY, behindLines(0.9, 1));
place("infantry", ITALY, behindLines(0.96, 1));
place("assaultInfantry", ITALY, behindLines(0.93, 2));

// ---------------------------------------------------------------- checks

// Every land unit is blocked by the belts: no land route from the Allied side to El Daba avoids a
// mine or a Bunker. (Bunkers are passable, but each is a strongpoint that the Allies must take.)
{
  const start = placed.get("El Hammam");
  const goal = placed.get("El Daba");
  const seen = new Set([key(start)]);
  const queue = [start];
  const passable = (ch) => ch !== undefined && !["S", "z", "m", "X", "H"].includes(ch);
  while (queue.length > 0) {
    const p = queue.shift();
    for (const [dx, dy] of N4) {
      const q = { x: p.x + dx, y: p.y + dy };
      if (seen.has(key(q)) || !passable(at(q.x, q.y))) continue;
      seen.add(key(q));
      queue.push(q);
    }
  }
  // Only through the second belt's gaps, which lie behind the unbroken first belt.
  if (seen.has(key(goal))) throw new Error("A land route round the minefields reaches El Daba");
}

// ---------------------------------------------------------------- write

const LAND = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank",
  "tankDestroyer", "artillery", "mobileAA", "flakGun",
];
const scenario = {
  id: "el-alamein",
  name: "El Alamein",
  description:
    "October 1942. Between the sea and the impassable Qattara Depression, the Axis army waits behind two belts of mines, the Devil's Gardens, short of fuel. The Eighth Army must clear corridors through the mines with its sappers and break out west along the coast road. Germany and Italy are both Axis players. The Allies win by capturing El Daba; the Axis wins by holding out to the start of day 15.",
  map: grid.map((row) => row.join("")),
  players: [
    { name: "UK", nation: "uk", funds: 5000, buildable: [...LAND, "fighter", "bomber"], facing: "left" },
    { name: "Germany", nation: "germany", funds: 2000, buildable: [...LAND, "fighter", "bomber"] },
    { name: "Italy", nation: "italy", funds: 2000, buildable: [...LAND, "fighter", "bomber"] },
  ],
  propertyOwners: PLACES.map(([name, , , , owner]) => ({ pos: placed.get(name), owner })),
  units,
  victory: [
    { type: "hqCapture" },
    { type: "rout" },
    { type: "captureProperties", side: "allies", properties: [placed.get("El Daba")] },
    { type: "surviveDays", side: "axis", days: 15 },
  ],
  weather: {
    season: "desert",
    forecast: [{ fromDay: 1, weather: "clear" }],
  },
};

const json = JSON.stringify(scenario, null, 2)
  // Keep each map row, unit and owner entry on one line so the file stays readable.
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+"type": "([a-zA-Z]+)"\s+\}/g, '{ "type": "$1" }')
  .replace(/\[\s+(\{ "type": "[a-zA-Z]+" \})\s+\]/g, "[$1]")
  .replace(/\{\s+("type": "[^"]+"),\s+("owner": \d),\s+("pos": \{[^}]+\})(?:,\s+("cargo": \[[^\]]*\]))?(?:,\s+("fuel": \d+))?\s+\}/g, (_, a, b, c, d, e) => `{ ${[a, b, c, d, e].filter(Boolean).join(", ")} }`)
  .replace(/\{\s+("pos": \{[^}]+\}),\s+("owner": \d)\s+\}/g, "{ $1, $2 }")
  .replace(/\{\s+("fromDay": \d+),\s+("weather": "[a-z]+")\s+\}/g, "{ $1, $2 }")
  .replace(/\[\s+((?:"[a-zA-Z]+",?\s+)+)\]/g, (_, list) => `[${list.trim().split(/,\s+/).join(", ")}]`);
writeFileSync(new URL("../../src/scenarios/el-alamein.json", import.meta.url), json + "\n");

console.log(grid.map((row, y) => `${String(y).padStart(2)} ${row.join("")}`).join("\n"));
const income = (owner) => scenario.propertyOwners.filter((p) => p.owner === owner).length;
const count = (owner) => units.filter((u) => u.owner === owner).length;
console.log(`\n${W}x${H}. Properties: UK ${income(UK)}, Germany ${income(GERMANY)}, Italy ${income(ITALY)}. Units: UK ${count(UK)}, Germany ${count(GERMANY)}, Italy ${count(ITALY)}.`);
console.log(`Minefield squares: ${grid.flat().filter((c) => c === "m").length}. Bunkers: ${grid.flat().filter((c) => c === "X").length}. Gaps: ${gaps.map(key).join(" ")}`);
for (const [name] of PLACES) console.log(`${name}: (${placed.get(name).x}, ${placed.get(name).y})`);
