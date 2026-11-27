// Generates src/scenarios/gazala.json: the Battle of Gazala and the fall of Tobruk, May–June 1942.
//
// The coast, places, escarpments, the Gazala line and the Tobruk perimeter are written as real
// longitude/latitude points and projected onto the grid (each square is about 3.2 km). The Gazala
// line is one belt of mines from the sea to Bir Hakeim, with brigade boxes of Bunkers behind it; its
// south end is open desert, so the Axis can go round (18-scenarios-north-africa §2). Roads cross the
// belt and the perimeter at Bunkers, never through mines. Fog of war is always on.
//
// Run: node tools/maps/gazala.mjs           (writes the scenario and prints an ASCII preview)
//      node tools/maps/overview.mjs gazala  (redraws the overview picture in docs/maps)

import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------- projection

const WEST = 22.95;
const EAST = 24.25;
const NORTH = 32.36;
const SOUTH = 31.36;
const W = 38;
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
const manhattan = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);

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

// ---------------------------------------------------------------- sea and escarpments

// The coast, west to east: the Gulf of Bomba, Tmimi, Gazala, Tobruk, and on toward Bardia.
const COAST = [[22.9, 32.36], [23.05, 32.31], [23.2, 32.22], [23.35, 32.15], [23.55, 32.12], [23.75, 32.1], [23.93, 32.09], [24.0, 32.06], [24.1, 32.05], [24.3, 32.02]];
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const [lon, lat] = tileCenter(x, y);
    if (lat > latAt(COAST, lon)) set(x, y, "S");
  }
}

/** Steep escarpments (Hills): tanks cross only where a road climbs them. Low ones are Ridge. */
const ESCARPMENTS = {
  // The coastal escarpment between Gazala and Tobruk, just inland of the coast road.
  coastal: { ch: "H", points: [[23.45, 32.07], [23.65, 32.05], [23.85, 32.03]] },
  // South of Tobruk and El Adem, the escarpment the Trigh Capuzzo runs along.
  elAdem: { ch: "H", points: [[23.84, 31.98], [24.0, 31.97], [24.2, 31.96]] },
  sidiRezegh: { ch: "d", points: [[24.0, 31.91], [24.12, 31.9], [24.22, 31.89]] },
  rigel: { ch: "d", points: [[23.74, 31.9], [23.8, 31.91]] },
  // The low rises round the Cauldron, inside the British minefields.
  cauldron: { ch: "d", points: [[23.6, 31.82], [23.66, 31.84]] },
  aslagh: { ch: "d", points: [[23.66, 31.88], [23.7, 31.86]] },
};
for (const { ch, points } of Object.values(ESCARPMENTS)) {
  for (const p of gridLine(points.map(toGrid))) if (at(p.x, p.y) === ".") set(p.x, p.y, ch);
}

// ---------------------------------------------------------------- places

const UK = 0;
const FRANCE = 1;
const GERMANY = 2;
const ITALY = 3;

// [name, lon, lat, kind, owner]  kind: Q hq, f factory, A airfield, C city.
const PLACES = [
  // The UK: Tobruk, the airfields, and the boxes and junctions behind the Gazala line.
  ["Tobruk", 23.96, 32.07, "Q", UK],
  ["El Adem", 23.93, 31.85, "A", UK],
  ["Sidi Rezegh", 24.12, 31.94, "A", UK],
  // The railhead dumps at Belhamed, east of Tobruk: where the Eighth Army's supplies came up.
  ["Belhamed", 24.05, 32.01, "f", UK],
  ["Gazala", 23.43, 32.12, "C", UK],
  ["Acroma", 23.66, 32.0, "C", UK],
  ["Knightsbridge", 23.72, 31.94, "C", UK],
  ["Bir el Gubi", 23.81, 31.62, "C", UK],
  // Free France: Bir Hakeim, the south end of the line.
  ["Bir Hakeim", 23.49, 31.59, "C", FRANCE],
  // Germany: Panzerarmee's rear on the coast road west.
  ["Tmimi", 23.08, 32.27, "Q", GERMANY],
  ["Bomba road", 22.98, 32.3, "f", GERMANY],
  ["Tmimi airfield", 23.12, 32.2, "A", GERMANY],
  // Italy: the camps behind the line.
  ["Rotonda Segnali", 23.08, 31.83, "f", ITALY],
  ["Bir Temrad", 23.22, 32.05, "C", ITALY],
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

// ---------------------------------------------------------------- the Gazala line

/** Lays mines along a line. Roads come later and cross the mines only where they must, at a Bunker. */
const mined = [];
function mineLine(points) {
  for (const p of points) {
    const ch = at(p.x, p.y);
    if (ch === undefined || ch === "S" || taken.has(key(p))) continue;
    set(p.x, p.y, "m");
    mined.push(p);
  }
}

// From the coast at Gazala, past the South African and 50th Division boxes and Got el Ualeb, to the
// ring round Bir Hakeim.
const bh = placed.get("Bir Hakeim");
const LINE = [[23.38, 32.16], [23.38, 32.03], [23.45, 31.93], [23.53, 31.85], [23.56, 31.78], [23.53, 31.68]];
const lineEnd = { x: bh.x, y: bh.y - 3 };
mineLine(gridLine([...LINE.map(toGrid), lineEnd]));
// Bir Hakeim: a ring of mines two squares out, with Bunkers round the town inside it.
const ring = [];
for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) === 2) ring.push({ x: bh.x + dx, y: bh.y + dy });
}
mineLine(ring);
for (const [dx, dy] of [[1, 0], [0, -1], [-1, 0], [0, 1]]) {
  const p = { x: bh.x + dx, y: bh.y + dy };
  if (at(p.x, p.y) !== "S") set(p.x, p.y, "X");
}

// ---------------------------------------------------------------- roads

/** Cheapest route between two places over open desert, climbing escarpments and crossing mines only where it must. */
const ROAD_COST = { ".": 1, "=": 0.4, d: 2.5, H: 8, m: 25, X: 1 };
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
  // The Via Balbia along the coast.
  ["Bomba road", "Tmimi", "Gazala", "Tobruk", "Sidi Rezegh"],
  ["Tmimi airfield", "Tmimi"],
  // The Trigh Capuzzo, from the Axis camps through Knightsbridge to El Adem.
  ["Bir Temrad", "Knightsbridge", "El Adem", "Tobruk"],
  // The Trigh el Abd, further south, to Bir el Gubi.
  ["Rotonda Segnali", "Bir el Gubi", "El Adem"],
  // The Bir Hakeim track north to Knightsbridge and Acroma.
  ["Bir Hakeim", "Knightsbridge", "Acroma", "Gazala"],
  ["Rotonda Segnali", "Bir Temrad", "Tmimi"],
];
for (const route of ROADS) {
  for (let i = 1; i < route.length; i++) {
    const a = placed.get(route[i - 1]);
    const b = placed.get(route[i]);
    if (!a || !b) throw new Error(`Unknown place on road ${route.join(" - ")}`);
    // Where a road crosses the mines, a Bunker guards the crossing instead (as on El Alamein).
    for (const p of roadPath(a, b)) if (!taken.has(key(p))) set(p.x, p.y, at(p.x, p.y) === "m" || at(p.x, p.y) === "X" ? "X" : "=");
  }
}

/** The easternmost mined square in each row of the line: Allied units start east of it, Axis west. */
const lineX = new Map();
for (const p of mined) lineX.set(p.y, Math.max(lineX.get(p.y) ?? -1, p.x));

// Boxes: brigade strongpoints built into the minefield itself. At each, the mined squares on the box's
// row and the rows either side become Bunkers, so the line stays closed but the box holds it.
const BOXES = {
  // The 1st South African Division at Gazala.
  "Gazala box": [23.41, 32.08],
  // The 50th Division's two boxes.
  "50th Division north": [23.48, 31.96],
  "50th Division south": [23.55, 31.88],
  // The 150th Brigade at Got el Ualeb, by the Trigh el Abd: the box the Axis broke to open its lane.
  "Got el Ualeb": [23.59, 31.8],
};
const boxes = new Map();
for (const [name, ll] of Object.entries(BOXES)) {
  const c = toGrid(ll);
  const spots = mined.filter((p) => Math.abs(p.y - c.y) <= 1 && at(p.x, p.y) === "m").sort((a, b) => Math.abs(a.y - c.y) - Math.abs(b.y - c.y) || b.x - a.x).slice(0, 2);
  for (const p of spots) set(p.x, p.y, "X");
  if (spots.length < 2) throw new Error(`No room for the ${name}`);
  boxes.set(name, spots);
}

// ---------------------------------------------------------------- the Tobruk perimeter

// An old ring of mines and Bunkers round the landward side of Tobruk, about 5 squares out, with gaps
// where it was stripped to build the Gazala line.
const tobruk = placed.get("Tobruk");
const perimeter = [];
for (let dy = -5; dy <= 5; dy++) for (let dx = -5; dx <= 5; dx++) {
  if (Math.max(Math.abs(dx), Math.abs(dy)) !== 5) continue;
  const p = { x: tobruk.x + dx, y: tobruk.y + dy };
  if (at(p.x, p.y) === undefined || at(p.x, p.y) === "S") continue;
  perimeter.push(p);
}
// Round the ring, every fourth square stands empty (stripped), and a Bunker sits every so often.
perimeter.sort((a, b) => Math.atan2(a.y - tobruk.y, a.x - tobruk.x) - Math.atan2(b.y - tobruk.y, b.x - tobruk.x));
const perimeterGaps = [];
perimeter.forEach((p, i) => {
  const ch = at(p.x, p.y);
  if (taken.has(key(p))) return;
  if (ch === "=") set(p.x, p.y, "X");
  else if (i % 4 === 2) perimeterGaps.push(p);
  else if (i % 6 === 0 && (ch === "." || ch === "d")) set(p.x, p.y, "X");
  else if (ch === "." || ch === "d" || ch === "H") set(p.x, p.y, "m");
});

// ---------------------------------------------------------------- starting forces

const used = new Set();
const groundOk = (ch) => [".", "=", "d"].includes(ch);
const units = [];
const add = (type, owner, pos, extra = {}) => {
  if (used.has(key(pos))) throw new Error(`Two units at (${pos.x}, ${pos.y})`);
  used.add(key(pos));
  units.push({ type, owner, pos, ...extra });
};
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
const near = (name, dx = 0, dy = 0) => freeNear(placed.get(name).x + dx, placed.get(name).y + dy);
const at_ = (ll, dx = 0, dy = 0) => {
  const p = toGrid(ll);
  return freeNear(p.x + dx, p.y + dy);
};
const air = (name, dx, dy) => freeNear(placed.get(name).x + dx, placed.get(name).y + dy, (ch) => ch !== undefined && ch !== "S");
const inBunker = (type, owner, spots) => {
  const spot = spots.find((p) => !used.has(key(p)));
  if (!spot) throw new Error(`No empty Bunker for a ${type}`);
  add(type, owner, spot);
};
const bunkersNear = (c, r) => {
  const out = [];
  for (let y = c.y - r; y <= c.y + r; y++) for (let x = c.x - r; x <= c.x + r; x++) if (at(x, y) === "X") out.push({ x, y });
  return out;
};

// The UK.
// The 1st South African Division in the Gazala box.
for (const spot of boxes.get("Gazala box")) add("infantry", UK, spot);
add("artillery", UK, freeNear(boxes.get("Gazala box")[0].x + 2, boxes.get("Gazala box")[0].y));
// The 50th Division's boxes.
for (const name of ["50th Division north", "50th Division south"]) for (const spot of boxes.get(name).slice(0, 2)) add("infantry", UK, spot);
add("mortar", UK, freeNear(boxes.get("50th Division north")[0].x + 2, boxes.get("50th Division north")[0].y));
add("artillery", UK, freeNear(boxes.get("50th Division south")[0].x + 2, boxes.get("50th Division south")[0].y));
// The 150th Brigade at Got el Ualeb.
for (const spot of boxes.get("Got el Ualeb").slice(0, 2)) add("infantry", UK, spot);
add("artillery", UK, freeNear(boxes.get("Got el Ualeb")[0].x + 2, boxes.get("Got el Ualeb")[0].y));
add("tankDestroyer", UK, freeNear(boxes.get("Got el Ualeb")[0].x + 2, boxes.get("Got el Ualeb")[0].y + 1));
// The 201st Guards Brigade at Knightsbridge.
add("infantry", UK, near("Knightsbridge", 1, 0));
add("infantry", UK, near("Knightsbridge", 0, 1));
add("artillery", UK, near("Knightsbridge", 1, 1));
// The 1st Armoured Division near Knightsbridge.
for (let i = 0; i < 4; i++) add("mediumTank", UK, near("Knightsbridge", 3, i - 1));
add("lightTank", UK, near("Knightsbridge", 4, 2));
add("halftrack", UK, near("Knightsbridge", 2, 3), { cargo: [{ type: "infantry" }] });
// The 7th Armoured Division near Bir el Gubi.
for (let i = 0; i < 3; i++) add("mediumTank", UK, near("Bir el Gubi", 1, i - 2));
add("lightTank", UK, near("Bir el Gubi", 2, 0));
add("recon", UK, near("Bir el Gubi", -2, 0));
add("artillery", UK, near("Bir el Gubi", 2, -2));
// The 3rd Indian Motor Brigade in the open south-east of Bir Hakeim.
add("infantry", UK, freeNear(bh.x + 4, bh.y + 3));
add("infantry", UK, freeNear(bh.x + 5, bh.y + 3));
add("supplyTruck", UK, freeNear(bh.x + 4, bh.y + 4));
add("artillery", UK, freeNear(bh.x + 5, bh.y + 4));
// The 2nd South African Division in Tobruk.
add("infantry", UK, near("Tobruk", 0, 1));
add("infantry", UK, near("Tobruk", 1, 1));
add("infantry", UK, near("Tobruk", -1, 1));
add("artillery", UK, near("Tobruk", 0, 2));
add("flakGun", UK, near("Tobruk", 1, 0));
// The Desert Air Force at El Adem.
add("fighter", UK, placed.get("El Adem"));
add("fighter", UK, air("El Adem", 1, 0));
add("bomber", UK, air("Sidi Rezegh", 0, 0));

// Free France at Bir Hakeim: infantry in the Bunkers round the town, the 75s, the Bofors.
for (const spot of bunkersNear(bh, 1).slice(0, 3)) add("infantry", FRANCE, spot);
add("assaultInfantry", FRANCE, freeNear(bh.x + 1, bh.y + 1));
add("mortar", FRANCE, freeNear(bh.x - 1, bh.y - 1));
add("artillery", FRANCE, freeNear(bh.x + 1, bh.y - 1));
add("flakGun", FRANCE, freeNear(bh.x - 1, bh.y + 1));

// The Axis assault force, assembled south-west of Bir Hakeim, out of sight.
const ASSAULT = toGrid([23.17, 31.5]);
const assault = [];
const assaultAdd = (type, owner, extra = {}) => {
  const p = freeNear(ASSAULT.x + (assault.length % 5) - 2, ASSAULT.y + Math.floor(assault.length / 5) - 2);
  add(type, owner, p, extra);
  assault.push(units[units.length - 1]);
};
// The 15th and 21st Panzer.
for (let i = 0; i < 6; i++) assaultAdd("mediumTank", GERMANY);
assaultAdd("lightTank", GERMANY);
// The 90th Light.
assaultAdd("halftrack", GERMANY, { cargo: [{ type: "infantry" }] });
assaultAdd("halftrack", GERMANY, { cargo: [{ type: "infantry" }] });
assaultAdd("recon", GERMANY);
assaultAdd("artillery", GERMANY);
// The 88s.
assaultAdd("tankDestroyer", GERMANY);
assaultAdd("tankDestroyer", GERMANY);
// Ariete and Trieste.
for (let i = 0; i < 4; i++) assaultAdd("mediumTank", ITALY);
assaultAdd("lightTank", ITALY);
assaultAdd("infantry", ITALY);
assaultAdd("infantry", ITALY);
assaultAdd("artillery", ITALY);
// A supply column to keep the sweep fuelled (added 2026-11-27, when Halftracks stopped resupplying),
// on the west edge of the force, clear of the squares the campaign's extra units use (22-campaign §4).
add("supplyTruck", GERMANY, freeNear(ASSAULT.x - 3, ASSAULT.y));
assault.push(units[units.length - 1]);
// The Luftwaffe at Tmimi.
add("fighter", GERMANY, placed.get("Tmimi airfield"));
add("fighter", GERMANY, air("Tmimi airfield", 1, 0));
add("bomber", GERMANY, air("Tmimi airfield", 0, 1));
// The Italian X and XXI Corps facing the north of the line, just west of the mines.
// The X and XXI Corps' infantry just west of each box, where the box's soldiers can see it (their
// sight is 2), so the feint is the first thing the Allies see; and two more between.
for (const spots of boxes.values()) {
  const box = spots[0];
  add("infantry", ITALY, freeNear(box.x - 2, box.y));
}
for (const lat of [32.0, 31.84]) {
  const y = toGrid([23.4, lat]).y;
  const fx = Math.min(...mined.filter((p) => p.y === y).map((p) => p.x));
  add("infantry", ITALY, freeNear(fx - 1, y));
}
add("artillery", ITALY, at_([23.25, 32.0]));
add("artillery", ITALY, at_([23.3, 31.9]));
add("mortar", ITALY, at_([23.32, 32.06]));
add("fighter", ITALY, air("Tmimi airfield", -1, 0));

// ---------------------------------------------------------------- checks

const passable = (ch) => ch !== undefined && !["S", "m", "H"].includes(ch);
/** Squares a tank can reach from `start` without crossing a minefield, an escarpment or the sea. */
function reach(start, blockBunkers) {
  const seen = new Set([key(start)]);
  const queue = [start];
  while (queue.length > 0) {
    const p = queue.shift();
    for (const [dx, dy] of N4) {
      const q = { x: p.x + dx, y: p.y + dy };
      const ch = at(q.x, q.y);
      if (seen.has(key(q)) || !passable(ch) || (blockBunkers && ch === "X")) continue;
      seen.add(key(q));
      queue.push(q);
    }
  }
  return seen;
}
// 1. The line runs unbroken from the sea to Bir Hakeim: north of Bir Hakeim, nothing gets from the
//    Axis camps to the British side without crossing a mine or a box.
{
  const fromNorth = reach(placed.get("Bir Temrad"), true);
  for (const name of ["Acroma", "Knightsbridge", "Gazala"]) {
    // Only by going round the south of Bir Hakeim: block the open south to prove it.
    const southRow = bh.y + 3;
    const blocked = new Set([...fromNorth].filter((k) => Number(k.split(",")[1]) >= southRow));
    if (fromNorth.has(key(placed.get(name))) && blocked.size === 0) throw new Error(`A route through the line reaches ${name}`);
  }
}
// 2. A tank can go round the south of Bir Hakeim and reach Tobruk's perimeter through its gaps.
{
  const round = reach(ASSAULT, true);
  if (!round.has(key(placed.get("Tobruk")))) throw new Error("No way round the south of Bir Hakeim to Tobruk");
}
// 3. The assault force starts out of sight of every Allied unit and property.
const VISION = { infantry: 2, assaultInfantry: 2, mortar: 2, recon: 5, halftrack: 1, supplyTruck: 1, lightTank: 3, mediumTank: 2, tankDestroyer: 2, artillery: 1, mobileAA: 2, flakGun: 2, fighter: 2, bomber: 2 };
for (const a of assault) {
  for (const u of units.filter((v) => v.owner === UK || v.owner === FRANCE)) {
    const hillBonus = at(u.pos.x, u.pos.y) === "H" && ["infantry", "assaultInfantry", "mortar"].includes(u.type) ? 3 : 0;
    if (manhattan(a.pos, u.pos) <= VISION[u.type] + hillBonus) throw new Error(`The Axis ${a.type} at (${a.pos.x}, ${a.pos.y}) starts in sight of an Allied ${u.type}`);
  }
}
// 4. North of Bir Hakeim, Allied land units start east of the minefield and Axis ones west of it.
for (const u of units) {
  if (["fighter", "bomber"].includes(u.type) || u.pos.y >= bh.y - 2) continue;
  const row = mined.filter((m) => m.y === u.pos.y).map((m) => m.x);
  if (row.length === 0) continue;
  const allied = u.owner === UK || u.owner === FRANCE;
  if (allied && u.pos.x < Math.min(...row)) throw new Error(`An Allied ${u.type} at (${u.pos.x}, ${u.pos.y}) starts west of the line`);
  if (!allied && u.pos.x > Math.max(...row)) throw new Error(`An Axis ${u.type} at (${u.pos.x}, ${u.pos.y}) starts east of the line`);
}
// 5. Every Axis property is west of the minefield.
for (const [name, , , , owner] of PLACES) {
  if (owner !== GERMANY && owner !== ITALY) continue;
  const p = placed.get(name);
  const westmost = Math.min(...mined.map((m) => m.x));
  if (p.x >= westmost) throw new Error(`${name} is not west of the line`);
}

// ---------------------------------------------------------------- write

const LAND = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "supplyTruck", "lightTank", "mediumTank",
  "tankDestroyer", "artillery", "mobileAA", "flakGun",
];
const scenario = {
  id: "gazala",
  name: "Gazala",
  description:
    "May 1942. The Eighth Army holds a line of minefields and fortified boxes from the sea at Gazala to the Free French at Bir Hakeim, with Tobruk behind it. Somewhere in the desert to the south-west, out of sight, Rommel's armour is gathering to go round the end of the line. The fog of war is always on. The UK and Free France are both Allied players. The Axis wins by capturing Tobruk; the Allies win by holding out to the start of day 16.",
  map: grid.map((row) => row.join("")),
  players: [
    { name: "UK", nation: "uk", funds: 4000, buildable: [...LAND, "fighter", "bomber"], facing: "left" },
    { name: "Free France", nation: "freeFrance", funds: 1000, buildable: ["infantry", "assaultInfantry", "mortar", "recon", "artillery", "flakGun"], facing: "left" },
    { name: "Germany", nation: "germany", funds: 3000, buildable: [...LAND, "fighter", "bomber"] },
    { name: "Italy", nation: "italy", funds: 2000, buildable: [...LAND, "fighter", "bomber"] },
  ],
  propertyOwners: PLACES.map(([name, , , , owner]) => ({ pos: placed.get(name), owner })),
  units,
  victory: [
    { type: "hqCapture" },
    { type: "rout" },
    { type: "captureProperties", side: "axis", properties: [placed.get("Tobruk")] },
    { type: "surviveDays", side: "allies", days: 16 },
  ],
  weather: {
    season: "desert",
    forecast: [{ fromDay: 1, weather: "clear" }],
  },
  settings: {
    fogOfWar: true,
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
writeFileSync(new URL("../../src/scenarios/gazala.json", import.meta.url), json + "\n");

console.log(grid.map((row, y) => `${String(y).padStart(2)} ${row.join("")}`).join("\n"));
const income = (owner) => scenario.propertyOwners.filter((p) => p.owner === owner).length;
const count = (owner) => units.filter((u) => u.owner === owner).length;
console.log(`\n${W}x${H}. Properties: UK ${income(UK)}, Free France ${income(FRANCE)}, Germany ${income(GERMANY)}, Italy ${income(ITALY)}.`);
console.log(`Units: UK ${count(UK)}, Free France ${count(FRANCE)}, Germany ${count(GERMANY)}, Italy ${count(ITALY)}.`);
console.log(`Minefield squares: ${grid.flat().filter((c) => c === "m").length}. Bunkers: ${grid.flat().filter((c) => c === "X").length}. Perimeter gaps: ${perimeterGaps.map(key).join(" ")}`);
for (const [name] of PLACES) console.log(`${name}: (${placed.get(name).x}, ${placed.get(name).y})`);
