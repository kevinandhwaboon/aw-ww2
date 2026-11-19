// Generates src/scenarios/battle-of-britain.json: south-east England and the Pas-de-Calais,
// August–September 1940, the Luftwaffe against RAF Fighter Command.
//
// The coastline comes from the Natural Earth 1:50m land outline (the `world-atlas` dev dependency,
// public domain); towns, airfields, rivers, the Downs and roads are real longitude/latitude points
// projected onto the grid. Each square is about 10 km, so that London sits at the very end of a
// Bf 109's reach from the Pas-de-Calais, as it did in 1940. Scenario design:
// docs/20-scenarios-battle-of-britain.md.
//
// Run: node tools/maps/battle-of-britain.mjs           (writes the scenario and prints an ASCII preview)
//      node tools/maps/battle-of-britain.mjs --reach   (also prints how far each airfield is from the targets)
//      node tools/maps/overview.mjs battle-of-britain  (redraws the overview picture in docs/maps)

import { readFileSync, writeFileSync } from "node:fs";

// ---------------------------------------------------------------- projection

const WEST = -1.15;
const NORTH = 51.95;
const LON_STEP = 0.16; // about 11 km at 51° N
const LAT_STEP = 0.0925; // about 10 km
const W = 27;
const H = 21;
const EAST = WEST + W * LON_STEP;
const SOUTH = NORTH - H * LAT_STEP;

const toGrid = ([lon, lat]) => ({
  x: Math.min(W - 1, Math.max(0, Math.floor((lon - WEST) / LON_STEP))),
  y: Math.min(H - 1, Math.max(0, Math.floor((NORTH - lat) / LAT_STEP))),
});
const pointAt = (fx, fy) => [WEST + fx * LON_STEP, NORTH - fy * LAT_STEP];
const tileCenter = (x, y) => pointAt(x + 0.5, y + 0.5);

// ---------------------------------------------------------------- grid helpers

const grid = Array.from({ length: H }, () => Array(W).fill("S"));
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

// ---------------------------------------------------------------- land and sea

// Natural Earth land rings that touch the map: Great Britain and the Continent.
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
const nearby = rings.filter((r) => r.some(([lon, lat]) => lon > WEST - 1 && lon < EAST + 1 && lat > SOUTH - 1 && lat < NORTH + 1));
const isLand = (p) => nearby.filter((r) => inside(r, p)).length % 2 === 1;

// A square is land when most of it is: five sample points, three needed.
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    const samples = [[0.5, 0.5], [0.25, 0.25], [0.75, 0.25], [0.25, 0.75], [0.75, 0.75]];
    const hits = samples.filter(([dx, dy]) => isLand(pointAt(x + dx, y + dy))).length;
    if (hits >= 3) set(x, y, ".");
  }
}
/** Which shore a land square is on: England is north-west of the Channel, the Continent south-east. */
const isEngland = (x, y) => {
  const [lon, lat] = tileCenter(x, y);
  return lat > 50.95 + (lon - 1.5) * 0.35 || lon < 1.0;
};

// The Thames: the tidal estuary is open water up to Gravesend, so ships reach Sheerness and the
// river's mouth splits Essex from Kent; above London it's a river.
for (const p of polyline([[0.3, 51.45], [1.3, 51.45]])) set(p.x, p.y, "S");
const RIVERS = {
  thames: [[-1.15, 51.45], [0.3, 51.45]],
  // The Somme, down past Abbeville to its bay.
  somme: [[1.62, 50.2], [1.83, 50.1], [2.1, 50.02]],
  // The Medway, north past Maidstone to the estuary at Sheerness.
  medway: [[0.4, 51.18], [0.52, 51.28], [0.55, 51.38]],
};
const riverTiles = new Set();
for (const points of Object.values(RIVERS)) {
  for (const p of polyline(points)) {
    if (at(p.x, p.y) !== ".") continue;
    set(p.x, p.y, "~");
    riverTiles.add(`${p.x},${p.y}`);
  }
}

// ---------------------------------------------------------------- hills, downs and woods

// The North and South Downs are chalk ridges (Ridge, 02-terrain §4b: cover, but tanks can cross);
// the Weald between them is wooded. The white cliffs at Dover and Folkestone, Beachy Head and Cap
// Gris-Nez are Hills: no boat lands under them.
const NORTH_DOWNS = [[-0.75, 51.24], [-0.4, 51.25], [-0.1, 51.27], [0.2, 51.3], [0.5, 51.32], [0.85, 51.24], [1.05, 51.18]];
const SOUTH_DOWNS = [[-1.0, 50.98], [-0.6, 50.92], [-0.25, 50.89], [0.1, 50.84]];
for (const p of [...polyline(NORTH_DOWNS), ...polyline(SOUTH_DOWNS)]) if (at(p.x, p.y) === ".") set(p.x, p.y, "d");

for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (at(x, y) !== ".") continue;
    const [lon, lat] = tileCenter(x, y);
    const r = clumpy(x, y, 3);
    // The Weald: the old forest between the Downs.
    const weald = lon > -0.6 && lon < 0.9 && lat > 50.93 && lat < 51.2;
    if (weald ? r < 0.45 : r < 0.12) set(x, y, "F");
  }
}

// ---------------------------------------------------------------- places

const UK = 0;
const GERMANY = 1;
// [name, lon, lat, kind, owner]  kind: Q hq, f factory, A airfield, P port, C city.
const PLACES = [
  // The United Kingdom. London, and RAF Fighter Command's 11 Group: four sector stations round
  // London, Tangmere on the south coast, and Hawkinge, the forward field Germany must take.
  ["London", -0.12, 51.5, "Q", UK],
  ["North Weald", 0.15, 51.72, "A", UK],
  ["Hornchurch", 0.21, 51.54, "A", UK],
  ["Biggin Hill", 0.03, 51.32, "A", UK],
  ["Kenley", -0.09, 51.3, "A", UK],
  ["Tangmere", -0.71, 50.85, "A", UK],
  ["Hawkinge", 1.15, 51.11, "A", UK],
  // The Royal Navy's Channel ports.
  ["Dover", 1.31, 51.12, "P", UK],
  ["Sheerness", 0.76, 51.44, "P", UK],
  ["Portsmouth", -1.09, 50.8, "P", UK],
  ["Newhaven", 0.06, 50.79, "P", UK],
  // Home Forces' depots.
  ["Aldershot", -0.76, 51.25, "f", UK],
  ["Maidstone", 0.52, 51.27, "f", UK],
  // Towns.
  ["Canterbury", 1.08, 51.28, "C", UK],
  ["Folkestone", 1.18, 51.08, "C", UK],
  ["Ashford", 0.87, 51.15, "C", UK],
  ["Hastings", 0.57, 50.86, "C", UK],
  ["Eastbourne", 0.28, 50.77, "C", UK],
  ["Brighton", -0.14, 50.82, "C", UK],
  ["Chelmsford", 0.47, 51.74, "C", UK],
  ["Rye", 0.73, 50.95, "C", UK],
  // Germany. Luftflotte 2 in the Pas-de-Calais and Flanders, the invasion ports of Operation Sea
  // Lion, and Kesselring's command post at Cap Blanc-Nez.
  ["Cap Blanc-Nez", 1.72, 50.93, "Q", GERMANY],
  ["Wissant", 1.67, 50.86, "A", GERMANY],
  ["Saint-Omer", 2.25, 50.75, "A", GERMANY],
  ["Le Touquet", 1.6, 50.52, "A", GERMANY],
  ["Abbeville", 1.83, 50.14, "A", GERMANY],
  ["Lille", 3.06, 50.6, "A", GERMANY],
  ["Arras", 2.78, 50.29, "A", GERMANY],
  ["Boulogne", 1.6, 50.73, "P", GERMANY],
  ["Calais", 1.86, 50.96, "P", GERMANY],
  ["Dunkirk", 2.37, 51.04, "P", GERMANY],
  ["Ostend", 2.92, 51.23, "P", GERMANY],
  ["Hazebrouck", 2.53, 50.72, "f", GERMANY],
  ["Montreuil", 1.76, 50.46, "C", GERMANY],
  ["Hesdin", 2.03, 50.37, "C", GERMANY],
  ["Béthune", 2.64, 50.53, "C", GERMANY],
  ["Ypres", 2.88, 50.85, "C", GERMANY],
  ["Bruges", 3.22, 51.2, "C", GERMANY],
  ["Doullens", 2.34, 50.16, "C", GERMANY],
];

const placed = new Map();
const taken = new Set();
// Ports first, as they need a square on the shore; then airfields, HQs, factories and towns.
const ORDER = "PAQfC";
for (const [name, lon, lat, kind, owner] of [...PLACES].sort((a, b) => ORDER.indexOf(a[3]) - ORDER.indexOf(b[3]))) {
  const want = toGrid([lon, lat]);
  // On its own shore, on open ground, never next to another place. A port must touch the sea.
  const fits = (x, y) => {
    const ch = at(x, y);
    if (ch === undefined || !".Fd".includes(ch) || taken.has(`${x},${y}`)) return false;
    if (isEngland(x, y) !== (owner === UK)) return false;
    if (kind === "P" && !N4.some(([dx, dy]) => at(x + dx, y + dy) === "S")) return false;
    return !N4.some(([dx, dy]) => taken.has(`${x + dx},${y + dy}`));
  };
  let spot;
  for (let r = 0; r < 3 && !spot; r++) {
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
  placed.set(name, spot);
  taken.add(`${spot.x},${spot.y}`);
  set(spot.x, spot.y, kind);
}

// ---------------------------------------------------------------- coasts

// The white cliffs between Folkestone and Dover, Beachy Head and Cap Gris-Nez: Hills, where no boat
// lands. Placed after the towns, so a port keeps its square on the shore.
const CLIFFS = [[1.25, 51.1], [0.2, 50.75], [1.6, 50.87]];
for (const c of CLIFFS) {
  const want = toGrid(c);
  let best;
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      if (!".Fd".includes(at(x, y)) || taken.has(`${x},${y}`) || !N4.some(([dx, dy]) => at(x + dx, y + dy) === "S")) continue;
      const d = Math.abs(x - want.x) + Math.abs(y - want.y);
      if (d <= 2 && (!best || d < best.d)) best = { x, y, d };
    }
  }
  if (best) set(best.x, best.y, "H");
}

// Operation Sea Lion's landing beaches ran from Folkestone west to Brighton; the Continent's coast
// from the Somme to Ostend is dunes and beach. Elsewhere the shore is ordinary ground, where a
// Landing Craft can't unload (05-supply-transport §8).
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (!".Fd".includes(at(x, y)) || !N4.some(([dx, dy]) => at(x + dx, y + dy) === "S")) continue;
    const [lon] = tileCenter(x, y);
    const england = isEngland(x, y);
    const seaLionBeach = england && tileCenter(x, y)[1] < 51.12 && lon > -0.25 && lon < 1.2;
    const deal = england && lon > 1.3 && tileCenter(x, y)[1] > 51.15 && tileCenter(x, y)[1] < 51.3;
    if (seaLionBeach || deal || !england) set(x, y, "_");
  }
}

// ---------------------------------------------------------------- roads

const ROAD_COST = { ".": 1, "=": 0.4, "#": 0.4, _: 1.5, F: 2, d: 2.5, "~": 8, H: 6 };
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
      const step = isEnd ? 1 : taken.has(`${nx},${ny}`) ? 3 : ROAD_COST[at(nx, ny)];
      if (step === undefined) continue;
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
  // The roads from London to the Channel coast: Watling Street to Dover, the Folkestone road, and
  // the roads to Brighton and Portsmouth.
  ["London", "Maidstone", "Canterbury", "Dover"],
  ["Maidstone", "Ashford", "Folkestone"],
  ["London", "Brighton"],
  ["London", "Portsmouth"],
  // The Continent: the coast road from the Somme to Bruges, and the roads inland to Lille and Arras.
  ["Abbeville", "Montreuil", "Boulogne", "Cap Blanc-Nez", "Calais", "Dunkirk", "Ostend", "Bruges"],
  ["Calais", "Saint-Omer", "Hazebrouck", "Lille"],
  ["Hazebrouck", "Béthune", "Arras"],
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
      else if (ch !== "#" && ch !== "H") set(p.x, p.y, "=");
    }
  }
}

// ---------------------------------------------------------------- fortifications

// Pillboxes behind the invasion beaches: the coast crust of 1940, a Bunker just inland of every
// second beach square from Folkestone to Brighton. Bombers and Assault Infantry can knock them down
// (03-combat §4); boats still land on the beach in front.
const beaches = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === "_" && isEngland(x, y)) beaches.push({ x, y });
beaches.sort((a, b) => b.x - a.x || a.y - b.y).forEach((p, i) => {
  if (i % 2 !== 0) return;
  const inland = N4.map(([dx, dy]) => ({ x: p.x + dx, y: p.y + dy })).find((q) => ".Fd".includes(at(q.x, q.y) ?? "S") && !taken.has(`${q.x},${q.y}`));
  if (inland) set(inland.x, inland.y, "X");
});

// ---------------------------------------------------------------- starting forces

const used = new Set();
const ok = {
  land: (ch) => [".", "=", "F", "d", "_", "X"].includes(ch),
  sea: (ch) => ch === "S",
};
/** The nearest free square to a place that suits `fits`, skipping properties and other units. */
function near(name, fits, owner) {
  const p = placed.get(name);
  for (let r = 1; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (Math.abs(dx) + Math.abs(dy) !== r || used.has(`${x},${y}`) || taken.has(`${x},${y}`)) continue;
        if (at(x, y) === undefined || !fits(at(x, y))) continue;
        if (owner !== undefined && at(x, y) !== "S" && isEngland(x, y) !== (owner === UK)) continue;
        return { x, y };
      }
    }
  }
  throw new Error(`No room for a unit near ${name}`);
}
const units = [];
const add = (type, owner, pos, extra = {}) => {
  if (used.has(`${pos.x},${pos.y}`)) throw new Error(`Two units at (${pos.x}, ${pos.y})`);
  used.add(`${pos.x},${pos.y}`);
  units.push({ type, owner, pos, ...extra });
};
const on = (type, owner, name, extra) => add(type, owner, placed.get(name), extra);
const by = (type, owner, name, fits = ok.land) => add(type, owner, near(name, fits, owner));

// RAF Fighter Command, 11 Group, outnumbered about two to one in fighters: Hurricanes and Spitfires
// (both the Fighter) on the sector stations; Hawkinge, the forward field, empty. Blenheims (the
// Bomber) of Bomber Command for the invasion barges.
for (const field of ["North Weald", "Hornchurch", "Biggin Hill", "Kenley", "Tangmere"]) on("fighter", UK, field);
by("bomber", UK, "Hornchurch", ok.land);
// Chain Home: four radar stations on the Kent and Sussex coast, which see aircraft far out over the
// Channel (19-fog-of-war §2a). They can't move and are never rebuilt.
for (const [name, lon, lat] of [["Dover radar", 1.33, 51.16], ["Dunkirk radar", 0.98, 51.29], ["Rye radar", 0.65, 50.9], ["Pevensey radar", 0.33, 50.84]]) {
  placed.set(name, toGrid([lon, lat]));
  const p = placed.get(name);
  const fits = (ch) => ok.land(ch) && ch !== "X" && ch !== "_";
  add("radarStation", UK, at(p.x, p.y) !== undefined && fits(at(p.x, p.y)) && !taken.has(`${p.x},${p.y}`) && !used.has(`${p.x},${p.y}`) ? p : near(name, fits, UK));
}
// Anti-Aircraft Command: 3.7-inch guns (the Flak Gun) round London and Dover, Bofors (Mobile AA) by
// Hawkinge and Canterbury.
by("flakGun", UK, "London");
by("flakGun", UK, "Dover");
by("mobileAA", UK, "Hawkinge");
by("mobileAA", UK, "Canterbury");
// The Royal Navy: destroyers at the Nore, in the Downs off Dover and at Portsmouth, ready to fall
// on any invasion fleet; an MTB at Dover.
on("destroyer", UK, "Sheerness");
by("destroyer", UK, "Dover", ok.sea);
by("destroyer", UK, "Dover", ok.sea);
on("destroyer", UK, "Portsmouth");
by("destroyer", UK, "Newhaven", ok.sea);
on("torpedoBoat", UK, "Dover");
// Home Forces: thin on the ground after Dunkirk. Infantry in the beach pillboxes and the coast
// towns, a few guns and tanks behind.
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (at(x, y) === "X") add("infantry", UK, { x, y });
on("infantry", UK, "Folkestone");
by("infantry", UK, "Dover");
by("artillery", UK, "Folkestone");
by("lightTank", UK, "Ashford");
on("infantry", UK, "London");

// The Luftwaffe, Luftflotte 2, outnumbering the RAF two to one in fighters and four to one in all: Bf 109s on the coastal fields of the
// Pas-de-Calais, Bf 110s (also the Fighter) further back; He 111s, Do 17s and Ju 88s (the Bomber)
// inland.
for (const field of ["Wissant", "Saint-Omer", "Le Touquet"]) on("fighter", GERMANY, field);
for (const field of ["Wissant", "Wissant", "Saint-Omer", "Cap Blanc-Nez", "Le Touquet", "Abbeville", "Lille"]) by("fighter", GERMANY, field);
for (const field of ["Abbeville", "Lille", "Arras"]) on("bomber", GERMANY, field);
for (const field of ["Saint-Omer", "Arras", "Lille", "Abbeville", "Arras", "Le Touquet", "Saint-Omer"]) by("bomber", GERMANY, field);
by("flakGun", GERMANY, "Wissant");
// Operation Sea Lion: the barges gathering in the Channel ports, and the first wave camped behind
// them. The S-boats (Torpedo Boat) at sea off Boulogne and Calais.
for (const port of ["Boulogne", "Calais", "Dunkirk"]) on("landingCraft", GERMANY, port);
by("torpedoBoat", GERMANY, "Boulogne", ok.sea);
by("torpedoBoat", GERMANY, "Calais", ok.sea);
by("infantry", GERMANY, "Boulogne");
by("infantry", GERMANY, "Boulogne");
by("infantry", GERMANY, "Calais");
by("infantry", GERMANY, "Calais");
by("assaultInfantry", GERMANY, "Calais");
by("infantry", GERMANY, "Dunkirk");
by("assaultInfantry", GERMANY, "Dunkirk");
by("lightTank", GERMANY, "Boulogne");
on("infantry", GERMANY, "Cap Blanc-Nez");

// ---------------------------------------------------------------- reach (for tuning)

if (process.argv.includes("--reach")) {
  const d = (a, b) => Math.abs(placed.get(a).x - placed.get(b).x) + Math.abs(placed.get(a).y - placed.get(b).y);
  for (const from of ["Wissant", "Saint-Omer", "Le Touquet", "Abbeville", "Lille", "Arras"]) {
    console.log(`${from}: ` + ["London", "Biggin Hill", "Kenley", "Hornchurch", "North Weald", "Hawkinge", "Dover", "Sheerness", "Tangmere"].map((to) => `${to} ${d(from, to)}`).join(", "));
  }
  for (const from of ["Biggin Hill", "Hornchurch", "Hawkinge", "Tangmere"]) {
    console.log(`${from}: ` + ["Cap Blanc-Nez", "Wissant", "Calais", "Boulogne", "Saint-Omer", "Lille"].map((to) => `${to} ${d(from, to)}`).join(", "));
  }
}

// ---------------------------------------------------------------- write

const AIR = ["fighter", "bomber"];
const owners = PLACES.map(([name, , , , owner]) => ({ pos: placed.get(name), owner }));
const scenario = {
  id: "battle-of-britain",
  name: "Battle of Britain",
  description:
    "August 1940. The Luftwaffe, two fighters to every one of the RAF's, must win the skies over southern England before Operation Sea Lion can cross the Channel. Always in fog of war: the RAF sees the raids coming only through its Chain Home radar stations on the coast, which spot aircraft far out over the Channel. Find and bomb them and the RAF is blind. Germany wins by taking Dover and Hawkinge, or London; the United Kingdom wins by holding out until day 15, when the autumn weather ends the invasion season.",
  map: grid.map((row) => row.join("")),
  players: [
    {
      name: "United Kingdom",
      nation: "uk",
      funds: 10000,
      buildable: ["infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank", "tankDestroyer", "artillery", "mobileAA", "flakGun", ...AIR, "destroyer", "torpedoBoat"],
    },
    {
      name: "Germany",
      nation: "germany",
      funds: 20000,
      buildable: ["infantry", "assaultInfantry", "mortar", "lightTank", "mediumTank", "artillery", "mobileAA", "flakGun", ...AIR, "landingCraft"],
      facing: "left",
    },
  ],
  propertyOwners: owners,
  units,
  // Always played in fog of war: the RAF sees raids coming only by radar (19-fog-of-war §1).
  settings: { fogOfWar: true },
  victory: [
    { type: "hqCapture" },
    { type: "captureProperties", side: "axis", properties: [placed.get("Dover"), placed.get("Hawkinge")] },
    { type: "surviveDays", side: "allies", days: 15 },
  ],
  // Bombers had several times the Bf 109's range: on this map they burn 1 fuel a square, not 2, so
  // they can reach London and get home. Fighters keep the usual 2, which puts London at the very
  // end of a Bf 109's reach.
  modifiers: [{ source: "scenario:bomber-range", stat: "fuelPerMove", op: "set", value: 1, scope: { unitTypes: ["bomber"] } }],
  weather: {
    season: "summer",
    forecast: [
      { fromDay: 1, weather: "clear" },
      { fromDay: 5, weather: "rain" },
      { fromDay: 7, weather: "clear" },
      { fromDay: 13, weather: "rain" },
      { fromDay: 14, weather: "clear" },
    ],
  },
};

const json = JSON.stringify(scenario, null, 2)
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+("type": "[^"]+"),\s+("owner": \d),\s+("pos": \{[^}]+\})\s+\}/g, "{ $1, $2, $3 }")
  .replace(/\{\s+("pos": \{[^}]+\}),\s+("owner": \d)\s+\}/g, "{ $1, $2 }")
  .replace(/\{\s+("fromDay": \d+),\s+("weather": "[a-z]+")\s+\}/g, "{ $1, $2 }")
  .replace(/\[\s+((?:"[a-zA-Z]+",?\s+)+)\]/g, (_, list) => `[${list.trim().split(/,\s+/).join(", ")}]`);
writeFileSync(new URL("../../src/scenarios/battle-of-britain.json", import.meta.url), json + "\n");

const unitAt = new Map(units.map((u) => [`${u.pos.x},${u.pos.y}`, u.owner === UK ? "u" : "g"]));
console.log(grid.map((row, y) => `${String(y).padStart(2)} ${row.map((ch, x) => unitAt.get(`${x},${y}`) ?? ch).join("")}`).join("\n"));
console.log("\n" + grid.map((row, y) => `${String(y).padStart(2)} ${row.join("")}`).join("\n"));
const count = (owner) => owners.filter((p) => p.owner === owner).length;
console.log(`\n${W}x${H}, ${WEST.toFixed(2)}..${EAST.toFixed(2)} E, ${SOUTH.toFixed(2)}..${NORTH.toFixed(2)} N. Properties: UK ${count(UK)}, Germany ${count(GERMANY)}.`);
console.log(`Units: UK ${units.filter((u) => u.owner === UK).length}, Germany ${units.filter((u) => u.owner === GERMANY).length}.`);
for (const [name] of PLACES) console.log(`${name}: (${placed.get(name).x}, ${placed.get(name).y})`);
