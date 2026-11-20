// Generates src/scenarios/sevastopol.json: the siege of Sevastopol, 7 June 1942, the morning the
// infantry assault of Operation Störfang began, after five days of bombardment.
//
// The coast, Severnaya Bay, the front line, rivers, the railway, towns and forts are written as real
// longitude/latitude points and projected onto the grid (each square is about 1.5 km), as at Stalingrad.
// The railway runs from the north-east edge through Bakhchisaray to the city, with the Gustav's firing
// spur off it near Bakhchisaray. Roads are routed between towns along the cheapest path.
// Scenario design: docs/15-scenarios-eastern-front.md §3.
//
// Run: node tools/maps/sevastopol.mjs           (writes the scenario and prints an ASCII preview)
//      node tools/maps/overview.mjs sevastopol  (redraws the overview picture in docs/maps)

import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------- projection

const WEST = 33.36;
const EAST = 33.92;
const NORTH = 44.8;
const SOUTH = 44.47;
const W = 30;
const H = 24;

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

// ---------------------------------------------------------------- coast and Severnaya Bay

// The land: the west coast from the Kacha's mouth south past the Belbek's to the north side of the
// bay; across the bay's mouth; the Khersones peninsula round its cape; the south coast past Cape
// Fiolent to Balaklava, then off the south edge; and everything east of that.
const LAND = [
  [33.556, 44.8], [33.546, 44.78], [33.553, 44.74], [33.548, 44.7], [33.556, 44.686], [33.549, 44.662], [33.535, 44.642],
  [33.505, 44.632], // the north side of the bay's mouth
  [33.49, 44.612], [33.455, 44.611], [33.425, 44.604], [33.395, 44.598], [33.37, 44.586], // Kazachya and Kamyshovaya bays
  [33.378, 44.566], [33.41, 44.548], [33.445, 44.53], [33.475, 44.512], [33.5, 44.502], // the cape and Fiolent
  [33.54, 44.499], [33.575, 44.498], [33.605, 44.49], [33.63, 44.47], // Balaklava
  [33.95, 44.44], [33.95, 44.85], [33.556, 44.85],
];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (!inside(LAND, tileCenter(x, y))) set(x, y, "S");

// Severnaya Bay: one row of water from the open sea east to Inkerman, splitting the north side from
// the city. No bridge.
for (let x = 9; x <= 14; x++) set(x, 13, "S");

// ---------------------------------------------------------------- the front, 7 June 1942

// German-held ground: everything north-east of an arc from the coast just north of the Belbek's
// mouth, east along the Belbek valley's north side, south over the Mekenzie heights to the Chernaya
// near Chorgun, and south-west to the coast east of Balaklava. Everything inside the arc is Soviet.
const GERMAN = [
  [33.5, 44.85], [33.5, 44.706], [33.6, 44.706], [33.655, 44.7], [33.69, 44.672], [33.705, 44.64],
  [33.7, 44.6], [33.685, 44.57], [33.66, 44.545], [33.64, 44.52], [33.625, 44.495], [33.62, 44.44],
  [33.95, 44.44], [33.95, 44.85],
];
const SOVIET = 0;
const GERMANY = 1;
const sideOf = (x, y) => (inside(GERMAN, tileCenter(x, y)) ? GERMANY : SOVIET);

// ---------------------------------------------------------------- rivers

const RIVERS = {
  // The Kacha: from the hills east of Bakhchisaray north-west to the sea.
  kacha: [[33.92, 44.7], [33.85, 44.722], [33.78, 44.745], [33.7, 44.765], [33.62, 44.774], [33.556, 44.778]],
  // The Belbek: down its valley past Duvankoi to the sea at Lyubimovka. The front ran along it.
  belbek: [[33.92, 44.625], [33.84, 44.645], [33.76, 44.664], [33.7, 44.68], [33.64, 44.689], [33.59, 44.692], [33.556, 44.687]],
  // The Chernaya: north from the Baydar valley past Chorgun into the head of Severnaya Bay at
  // Inkerman, its last squares straight north so the railway crosses it cleanly.
  chernaya: [[33.8, 44.47], [33.74, 44.5], [33.7, 44.528], [33.67, 44.552], [33.645, 44.575], tileCenter(14, 15), tileCenter(14, 13)],
};
const riverTiles = new Set();
for (const points of Object.values(RIVERS)) {
  for (const p of polyline(points)) {
    if (at(p.x, p.y) === "S") continue;
    set(p.x, p.y, "~");
    riverTiles.add(`${p.x},${p.y}`);
  }
}
const nearRiver = (x, y) => N8.some(([dx, dy]) => riverTiles.has(`${x + dx},${y + dy}`));

// ---------------------------------------------------------------- the railway

// The line from Simferopol, in grid squares so it runs in straight stretches and crosses each river
// square-on: in along the north edge past Bakhchisaray, south over the Kacha, west to the Belbek
// valley, south over the Belbek at Duvankoi and down the Mekenzie heights, then west along the bay's
// south shore over the Chernaya at Inkerman to Sevastopol station. A Railway square over a river is
// the line's bridge (02-terrain §4c).
const RAILWAY = [[29, 0], [25, 0], [25, 6], [18, 6], [18, 9], [16, 9], [16, 14], [9, 14]];
const railTiles = [];
for (let i = 1; i < RAILWAY.length; i++) {
  const [ax, ay] = RAILWAY[i - 1];
  const [bx, by] = RAILWAY[i];
  for (const p of line({ x: ax, y: ay }, { x: bx, y: by }).slice(i === 1 ? 0 : 1)) {
    if (at(p.x, p.y) === "S") throw new Error(`The railway runs into the sea at (${p.x}, ${p.y})`);
    set(p.x, p.y, "R");
    railTiles.push(p);
  }
}
// The Gustav's firing spur: a short dead end west off the line below Bakhchisaray, where the gun stood
// on its own track.
const spur = [{ x: 24, y: 2 }, { x: 23, y: 2 }];
for (const p of spur) {
  if (!".Fd".includes(at(p.x, p.y))) throw new Error(`The Gustav's spur runs over ${at(p.x, p.y)} at (${p.x}, ${p.y})`);
  set(p.x, p.y, "R");
}
// Every square where the line meets a river is a clean crossing: water on two opposite sides and
// land on the other two, so it reads as a bridge.
const water = (x, y) => ["~", "S"].includes(at(x, y));
for (const p of [...railTiles, ...spur]) {
  const touching = N4.filter(([dx, dy]) => water(p.x + dx, p.y + dy));
  if (touching.length === 0) continue;
  const ns = water(p.x, p.y - 1) && water(p.x, p.y + 1) && !water(p.x - 1, p.y) && !water(p.x + 1, p.y);
  const ew = water(p.x - 1, p.y) && water(p.x + 1, p.y) && !water(p.x, p.y - 1) && !water(p.x, p.y + 1);
  if (riverTiles.has(`${p.x},${p.y}`) && !ns && !ew) throw new Error(`The railway crosses a river untidily at (${p.x}, ${p.y})`);
}
const crossings = [...railTiles].filter((p) => riverTiles.has(`${p.x},${p.y}`));

// ---------------------------------------------------------------- countryside

const between = ([lon, lat], w, e, s, n) => lon >= w && lon <= e && lat >= s && lat <= n;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (at(x, y) !== ".") continue;
    const c = tileCenter(x, y);
    const r = clumpy(x, y, 1);
    let ch;
    // The Mekenzie heights between the Belbek and the head of the bay: wooded hills.
    if (between(c, 33.6, 33.73, 44.615, 44.675)) ch = r < 0.42 ? "F" : r < 0.58 ? "H" : ".";
    // The mountains behind Balaklava and round the Baydar valley.
    else if (between(c, 33.64, 33.95, 44.44, 44.535)) ch = r < 0.38 ? "H" : r < 0.66 ? "F" : ".";
    // The foothills east of the Belbek and Chernaya: woods and steep ground.
    else if (between(c, 33.74, 33.95, 44.535, 44.7)) ch = r < 0.28 ? "F" : r < 0.4 ? "H" : r < 0.46 ? "d" : ".";
    // The Khersones plateau west of the city: open ground with a few ravines.
    else if (c[0] < 33.5 && c[1] < 44.61) ch = r < 0.06 ? "d" : ".";
    // Woods along the rivers.
    else if (nearRiver(x, y)) ch = r < 0.2 ? "F" : ".";
    // The rest: orchards, vineyards and rolling ground with ravines (balkas).
    else ch = r < 0.12 ? "F" : r < 0.2 ? "d" : ".";
    set(x, y, ch);
  }
}
// The Sapun Ridge east of the city, the last natural wall, and the Fedyukhin heights in front of it
// over the Chernaya.
for (const p of polyline([[33.585, 44.548], [33.59, 44.565], [33.603, 44.586]])) if (".Fd".includes(at(p.x, p.y))) set(p.x, p.y, "H");
for (const p of polyline([[33.632, 44.543], [33.641, 44.56]])) if (".Fd".includes(at(p.x, p.y))) set(p.x, p.y, "H");

// ---------------------------------------------------------------- towns and bases

// [name, lon, lat, kind, owner]  kind: Q hq, f factory, A airfield, C city.
const PLACES = [
  // Soviet: the city and the fortress area
  ["Sevastopol", 33.52, 44.6, "Q", SOVIET],
  ["Korabelnaya", 33.55, 44.59, "f", SOVIET],
  ["Inkerman", 33.612, 44.6, "f", SOVIET],
  ["Khersones airfield", 33.4, 44.585, "A", SOVIET],
  ["Kulikovo Pole airfield", 33.5, 44.57, "A", SOVIET],
  ["Severnaya", 33.53, 44.635, "C", SOVIET],
  ["Lyubimovka", 33.56, 44.675, "C", SOVIET],
  ["Mekenzievy Gory", 33.635, 44.65, "C", SOVIET],
  ["Balaklava", 33.598, 44.505, "C", SOVIET],
  // Germany: Bakhchisaray, the Belbek and Kacha valleys, the Chernaya and the Baydar valley
  ["Bakhchisaray", 33.865, 44.76, "Q", GERMANY],
  ["Duvankoi", 33.72, 44.67, "f", GERMANY],
  ["Baydary", 33.79, 44.48, "f", GERMANY],
  ["Kacha airfield", 33.57, 44.765, "A", GERMANY],
  ["Mamashai", 33.6, 44.735, "C", GERMANY],
  ["Aranchi", 33.72, 44.725, "C", GERMANY],
  ["Kamyshly", 33.665, 44.69, "C", GERMANY],
  ["Chorgun", 33.69, 44.54, "C", GERMANY],
  ["Shuli", 33.74, 44.57, "C", GERMANY],
];

const placed = new Map();
const taken = new Set();
for (const [name, lon, lat, kind, owner] of PLACES) {
  const want = toGrid([lon, lat]);
  // On open ground, on its own side of the front, never on the railway, never right next to another place.
  const fits = (x, y) => {
    const ch = at(x, y);
    if (ch === undefined || !".FdH".includes(ch) || taken.has(`${x},${y}`)) return false;
    if (sideOf(x, y) !== owner) return false;
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

/** Cheapest route between two places: follows existing roads, crosses the railway, avoids woods and hills. */
const ROAD_COST = { ".": 1, "=": 0.4, "#": 0.4, R: 0.8, F: 2.2, d: 3, H: 6, "~": 10 };
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

const ROADS = [
  // The Simferopol road: Bakhchisaray down to Duvankoi and over the Mekenzie heights to Inkerman.
  ["Bakhchisaray", "Aranchi", "Duvankoi", "Mekenzievy Gory", "Inkerman", "Korabelnaya", "Sevastopol"],
  // The coast road through the north side: Kacha, Lyubimovka, Severnaya.
  ["Kacha airfield", "Lyubimovka", "Severnaya"],
  ["Kacha airfield", "Mamashai", "Kamyshly", "Duvankoi"],
  ["Bakhchisaray", "Mamashai"],
  // The south: the Yalta road from the Baydar valley past Chorgun, over the Sapun Ridge to the city;
  // Balaklava's road to the city; and the road out to the Khersones peninsula.
  ["Baydary", "Shuli", "Chorgun", "Inkerman"],
  ["Chorgun", "Balaklava", "Sevastopol"],
  ["Sevastopol", "Kulikovo Pole airfield", "Khersones airfield"],
  ["Shuli", "Duvankoi"],
];
for (const route of ROADS) {
  for (let i = 1; i < route.length; i++) {
    const a = placed.get(route[i - 1]);
    const b = placed.get(route[i]);
    if (!a || !b) throw new Error(`Unknown place on road ${route.join(" - ")}`);
    for (const p of roadPath(a, b)) {
      const ch = at(p.x, p.y);
      if (taken.has(`${p.x},${p.y}`) || ch === "R") continue;
      if (ch === "~") set(p.x, p.y, "#");
      else if (ch !== "#") set(p.x, p.y, "=");
    }
  }
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

const fortOk = (x, y) => ".FdH".includes(at(x, y)) && !taken.has(`${x},${y}`);
/** The nearest square to a point where a fort can stand on the Soviet side. */
function fortNear(lon, lat) {
  const want = toGrid([lon, lat]);
  for (let r = 0; r < 4; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = want.x + dx;
        const y = want.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || at(x, y) === undefined) continue;
        if (fortOk(x, y) && sideOf(x, y) === SOVIET) return { x, y };
      }
    }
  }
  throw new Error(`No room for a fort near ${lon}, ${lat}`);
}
// The named forts and coastal batteries, placed approximately (15-scenarios-eastern-front §3).
const FORTS = [
  ["Maxim Gorky I", 33.566, 44.664],
  ["Stalin", 33.625, 44.64],
  ["Molotov", 33.6, 44.664],
  ["Cheka", 33.58, 44.682],
  ["Volga", 33.612, 44.675],
  ["Siberia", 33.58, 44.652],
  ["GPU", 33.645, 44.665],
  ["Lenin", 33.6, 44.638],
  ["Ural", 33.56, 44.645],
  ["Maxim Gorky II", 33.39, 44.592],
];
const forts = new Map();
for (const [name, lon, lat] of FORTS) {
  const p = fortNear(lon, lat);
  set(p.x, p.y, "X");
  forts.set(name, p);
  taken.add(`${p.x},${p.y}`);
}
// Field works in belts along the Soviet side of the front, as at Kursk: the front row and the one
// behind it. In the north the named forts already make the belt, so only a few more there; more on
// the Chernaya and before the Sapun Ridge in the south-east.
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (sideOf(x, y) !== SOVIET || !fortOk(x, y) || frontDistance(x, y) > 1) continue;
    const north = tileCenter(x, y)[1] > 44.625;
    const r = noise(x, y, 7);
    if (r < (north ? 0.12 : frontDistance(x, y) === 0 ? 0.5 : 0.3)) set(x, y, "X");
  }
}

// ---------------------------------------------------------------- starting forces

// Where armies gather that aren't at a town.
for (const [name, lon, lat] of [
  ["the Belbek front", 33.62, 44.712],
  ["the Mekenzie front", 33.715, 44.635],
  ["the Chernaya front", 33.69, 44.56],
  ["the Sapun Ridge", 33.6, 44.57],
  ["the north side", 33.59, 44.655],
]) placed.set(name, toGrid([lon, lat]));

const used = new Set();
const groundOk = (ch) => [".", "=", "F", "d"].includes(ch);
/** The nearest free tile to a place that suits `ok` and is on `side`'s ground, skipping properties and other units. */
function standNear(name, side, ok = groundOk) {
  const p = placed.get(name) ?? forts.get(name);
  for (let r = 1; r < 9; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || used.has(`${x},${y}`) || (taken.has(`${x},${y}`) && at(x, y) !== "X")) continue;
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
const inFort = (type, name) => add(type, SOVIET, forts.get(name));
const outside = (type, owner, name, ok) => add(type, owner, standNear(name, owner, ok));
const bunker = (ch) => ch === "X";
/** Into a field work near the place if one is free, otherwise dug in on open ground beside it. */
const dugIn = (type, name) => {
  try {
    add(type, SOVIET, standNear(name, SOVIET, bunker));
  } catch {
    outside(type, SOVIET, name);
  }
};

// Soviet Union: the Coastal Army. The forts' garrisons and the coastal batteries.
inFort("artillery", "Maxim Gorky I");
inFort("artillery", "Maxim Gorky II");
for (const name of ["Stalin", "Molotov", "Cheka", "Volga", "GPU", "Siberia"]) inFort("infantry", name);
inFort("mortar", "Lenin");
inFort("assaultInfantry", "Ural");
// Field works on the Mekenzie and Chernaya fronts and before the Sapun Ridge.
dugIn("infantry", "the Mekenzie front");
dugIn("infantry", "the Mekenzie front");
dugIn("infantry", "the Chernaya front");
dugIn("infantry", "the Chernaya front");
dugIn("mortar", "the Chernaya front");
// Behind the lines: reserves, guns and the few tanks.
outside("infantry", SOVIET, "the north side");
outside("assaultInfantry", SOVIET, "Mekenzievy Gory");
outside("artillery", SOVIET, "the north side");
outside("artillery", SOVIET, "the Sapun Ridge");
outside("artillery", SOVIET, "Inkerman");
outside("infantry", SOVIET, "the Sapun Ridge");
outside("infantry", SOVIET, "Balaklava");
outside("lightTank", SOVIET, "Severnaya");
outside("lightTank", SOVIET, "Korabelnaya");
outside("mortar", SOVIET, "Balaklava");
inTown("infantry", SOVIET, "Sevastopol");
// The naval infantry holding the dockyard and the Inkerman galleries, the way round the head of the bay.
inTown("infantry", SOVIET, "Korabelnaya");
inTown("assaultInfantry", SOVIET, "Inkerman");
outside("artillery", SOVIET, "Korabelnaya");
inTown("infantry", SOVIET, "Balaklava");
inTown("infantry", SOVIET, "Lyubimovka");
outside("flakGun", SOVIET, "Sevastopol");
outside("halftrack", SOVIET, "Korabelnaya");
// What was left of the air force on the Khersones peninsula.
inTown("fighter", SOVIET, "Khersones airfield");
inTown("bomber", SOVIET, "Kulikovo Pole airfield");

// Germany: the 11th Army. The Gustav on its spur, the ammunition train beside it, and flak guarding it.
const gustav = spur[spur.length - 1];
add("railwayGun", GERMANY, gustav);
const beside = N4.map(([dx, dy]) => ({ x: gustav.x + dx, y: gustav.y + dy })).find((p) => groundOk(at(p.x, p.y)) && !used.has(`${p.x},${p.y}`) && !taken.has(`${p.x},${p.y}`));
if (!beside) throw new Error("No room for the Gustav's Halftrack");
add("halftrack", GERMANY, beside);
placed.set("the Gustav", gustav);
outside("flakGun", GERMANY, "the Gustav");
// LIV Corps in the north, across the Belbek toward the forts and the bay.
outside("infantry", GERMANY, "the Belbek front");
outside("infantry", GERMANY, "the Belbek front");
outside("infantry", GERMANY, "the Belbek front");
outside("assaultInfantry", GERMANY, "the Belbek front");
outside("assaultInfantry", GERMANY, "the Belbek front");
outside("tankDestroyer", GERMANY, "the Belbek front");
outside("tankDestroyer", GERMANY, "Kamyshly");
outside("mediumTank", GERMANY, "Mamashai");
outside("artillery", GERMANY, "Mamashai");
outside("artillery", GERMANY, "Kamyshly");
outside("rocketArtillery", GERMANY, "Mamashai");
outside("rocketArtillery", GERMANY, "Kamyshly");
outside("mortar", GERMANY, "the Belbek front");
inTown("infantry", GERMANY, "Kamyshly");
// The centre, the Romanian Mountain Corps, on the Mekenzie heights.
outside("infantry", GERMANY, "the Mekenzie front");
outside("infantry", GERMANY, "the Mekenzie front");
outside("artillery", GERMANY, "Duvankoi");
// XXX Corps in the south-east, toward the Sapun Ridge and Balaklava.
outside("infantry", GERMANY, "the Chernaya front");
outside("infantry", GERMANY, "the Chernaya front");
outside("assaultInfantry", GERMANY, "the Chernaya front");
outside("tankDestroyer", GERMANY, "Chorgun");
outside("artillery", GERMANY, "Shuli");
outside("rocketArtillery", GERMANY, "Shuli");
inTown("infantry", GERMANY, "Chorgun");
// The VIII Air Corps round Kacha.
inTown("bomber", GERMANY, "Kacha airfield");
outside("bomber", GERMANY, "Kacha airfield");
outside("fighter", GERMANY, "Kacha airfield");

// ---------------------------------------------------------------- write

const LAND_UNITS = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank",
  "tankDestroyer", "artillery", "rocketArtillery", "mobileAA", "flakGun",
];
const owners = PLACES.map(([name, , , , owner]) => ({ pos: placed.get(name), owner }));
const scenario = {
  id: "sevastopol",
  name: "Sevastopol",
  description:
    "June 1942. After five days of bombardment, the German 11th Army storms the fortress of Sevastopol. Its 80 cm railway gun, Schwerer Gustav, can break a fort with one shell, but it only moves on the railway, a square a turn, and needs a Halftrack beside it to stay fed. Germany wins by taking Sevastopol; the Soviet Union wins by holding out to day 20 or taking Bakhchisaray.",
  map: grid.map((row) => row.join("")),
  players: [
    { name: "Soviet Union", nation: "ussr", funds: 2000, buildable: [...LAND_UNITS, "fighter", "bomber"] },
    { name: "Germany", nation: "germany", funds: 4000, buildable: [...LAND_UNITS, "fighter", "bomber", "transportAircraft"], facing: "left" },
  ],
  propertyOwners: owners,
  units,
  // HQ capture, and the Soviet Union's own goal: hold out to day 20. Rout is off (15-scenarios-eastern-front §3).
  victory: [{ type: "hqCapture" }, { type: "surviveDays", side: "allies", days: 20 }],
  weather: { season: "summer", forecast: [{ fromDay: 1, weather: "clear" }] },
};

const json = JSON.stringify(scenario, null, 2)
  // Keep each map row, unit and owner entry on one line so the file stays readable.
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+("type": "[^"]+"),\s+("owner": \d),\s+("pos": \{[^}]+\})\s+\}/g, "{ $1, $2, $3 }")
  .replace(/\{\s+("pos": \{[^}]+\}),\s+("owner": \d)\s+\}/g, "{ $1, $2 }")
  .replace(/\{\s+("fromDay": \d+),\s+("weather": "[a-z]+")\s+\}/g, "{ $1, $2 }")
  .replace(/\[\s+((?:"[a-zA-Z]+",?\s+)+)\]/g, (_, list) => `[${list.trim().split(/,\s+/).join(", ")}]`);
writeFileSync(new URL("../../src/scenarios/sevastopol.json", import.meta.url), json + "\n");

console.log(grid.map((row, y) => `${String(y).padStart(2)} ${row.join("")}`).join("\n"));
const count = (owner) => owners.filter((p) => p.owner === owner).length;
const bunkers = grid.flat().filter((ch) => ch === "X").length;
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
console.log(`\n${W}x${H}. Properties: Soviet ${count(SOVIET)}, Germany ${count(GERMANY)}. Bunkers ${bunkers}.`);
console.log(`Units: Soviet ${units.filter((u) => u.owner === SOVIET).length}, Germany ${units.filter((u) => u.owner === GERMANY).length}.`);
console.log(`Gustav at (${gustav.x}, ${gustav.y}): Maxim Gorky I ${dist(gustav, forts.get("Maxim Gorky I"))}, Sevastopol ${dist(gustav, placed.get("Sevastopol"))}.`);
for (const [name] of PLACES) console.log(`${name}: (${placed.get(name).x}, ${placed.get(name).y})`);
for (const [name, p] of forts) console.log(`Fort ${name}: (${p.x}, ${p.y})`);
console.log(`Rail crossings: ${crossings.map((p) => `(${p.x}, ${p.y})`).join(" ")}`);
