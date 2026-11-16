// Generates src/scenarios/market-garden.json: Operation Market Garden, September 1944.
//
// Towns, rivers and canals are written as real longitude/latitude points and projected onto the grid
// (each square is about 2.8 km). Roads are routed between towns along the cheapest path, so they
// cross rivers only where they must. The crossings on the road from Neerpelt to Arnhem, plus Best and
// the Oosterbeek railway bridge, are Major Bridges that can be blown (02-terrain §4a); every other
// crossing is an ordinary Bridge. Scenario design: docs/17-scenarios-market-garden.md.
//
// Run: node tools/maps/market-garden.mjs           (writes the scenario and prints an ASCII preview)
//      node tools/maps/overview.mjs market-garden  (redraws the overview picture in docs/maps)

import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------- projection

const WEST = 5.2;
const EAST = 6.4;
const NORTH = 52.22;
const SOUTH = 51.1;
const W = 32;
const H = 44;

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

// ---------------------------------------------------------------- rivers and canals

const RIVERS = {
  // The Meuse–Escaut canal along the Belgian front, crossed at Joe's bridge by Neerpelt.
  meuseEscaut: [[5.2, 51.2], [5.3, 51.203], [5.4, 51.21], [5.5, 51.203], [5.62, 51.19], [5.8, 51.18]],
  // The Wilhelmina canal, past Best and Son to Aarle-Rixtel.
  wilhelmina: [[5.2, 51.56], [5.3, 51.537], [5.39, 51.522], [5.49, 51.522], [5.64, 51.52]],
  // The Zuid-Willemsvaart, from 's-Hertogenbosch past Veghel and Helmond to the Belgian border.
  zuidWillemsvaart: [[5.3, 51.71], [5.42, 51.665], [5.55, 51.62], [5.6, 51.565], [5.64, 51.52], [5.67, 51.46], [5.72, 51.36], [5.77, 51.27], [5.8, 51.18]],
  // The Maas, north from Roermond past Venlo, then west past Grave to 's-Hertogenbosch.
  maas: [[5.86, 51.1], [5.99, 51.19], [6.17, 51.37], [6.13, 51.5], [6.02, 51.6], [5.96, 51.68], [5.88, 51.75], [5.74, 51.78], [5.62, 51.81], [5.5, 51.81], [5.38, 51.775], [5.2, 51.75]],
  // The Maas–Waal canal, crossed at Heumen.
  maasWaal: [[5.85, 51.76], [5.83, 51.8], [5.81, 51.83], [5.8, 51.86]],
  // The Rhine from Emmerich, and the Waal past Nijmegen to Tiel.
  waal: [[6.4, 51.8], [6.25, 51.83], [6.1, 51.862], [5.95, 51.866], [5.865, 51.862], [5.75, 51.872], [5.6, 51.882], [5.43, 51.89], [5.2, 51.875]],
  // The Nederrijn, from the split at Pannerden past Arnhem, Oosterbeek and Wageningen.
  nederrijn: [[6.06, 51.866], [6.04, 51.91], [6.0, 51.945], [5.95, 51.965], [5.91, 51.972], [5.855, 51.974], [5.8, 51.966], [5.66, 51.958], [5.57, 51.954], [5.4, 51.958], [5.2, 51.965]],
  // The IJssel, north-east from Arnhem past Doesburg and Zutphen.
  ijssel: [[5.98, 51.955], [6.05, 51.99], [6.13, 52.03], [6.17, 52.08], [6.19, 52.14], [6.17, 52.22]],
};
/** Which river each river square belongs to (the first one drawn wins). */
const riverOf = new Map();
for (const [name, points] of Object.entries(RIVERS)) {
  for (const p of polyline(points)) {
    set(p.x, p.y, "~");
    if (!riverOf.has(key(p))) riverOf.set(key(p), name);
  }
}

// ---------------------------------------------------------------- countryside

const near = ([lon, lat], [clon, clat], rx, ry) => ((lon - clon) / rx) ** 2 + ((lat - clat) / ry) ** 2 <= 1;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (at(x, y) !== ".") continue;
    const c = tileCenter(x, y);
    const [lon, lat] = c;
    const r = clumpy(x, y, 1);
    let ch;
    // The Groesbeek heights, which the 82nd had to hold, and the ridge along the Nederrijn at Oosterbeek.
    if (near(c, [5.94, 51.775], 0.05, 0.022)) ch = r < 0.6 ? "H" : "F";
    else if (near(c, [5.76, 51.985], 0.1, 0.012)) ch = r < 0.35 ? "H" : r < 0.75 ? "F" : ".";
    // The Reichswald, east of Groesbeek.
    else if (near(c, [6.04, 51.75], 0.08, 0.04)) ch = r < 0.75 ? "F" : ".";
    // The wooded Veluwe, north of the Nederrijn and west of the IJssel.
    else if (lat > 51.985 && lon > 5.6 && lon < 6.08) ch = r < 0.55 ? "F" : ".";
    // The Peel, east of Helmond.
    else if (near(c, [5.85, 51.43], 0.12, 0.09)) ch = r < 0.4 ? "F" : ".";
    // The Belgian Kempen: heath and pine.
    else if (lat < 51.3) ch = r < 0.32 ? "F" : ".";
    // Flat Dutch farmland and polder, with a few woods.
    else ch = r < 0.1 ? "F" : ".";
    set(x, y, ch);
  }
}

// ---------------------------------------------------------------- towns and bases

const US = 0;
const UK = 1;
const GERMANY = 2;

// [name, lon, lat, kind, owner]  kind: Q hq, f factory, A airfield, C city.  owner: a player, or null neutral.
// A few towns are nudged a little off their real spot, so that at 2.8 km a square the river still runs
// between them where it really does: Nijmegen south of the Waal, Oosterbeek apart from Arnhem.
const PLACES = [
  // The UK: Belgium behind the Meuse–Escaut canal, and the Neerpelt bridgehead.
  ["Leopoldsburg", 5.257, 51.117, "Q", UK],
  ["Lommel", 5.31, 51.23, "f", UK],
  ["Neerpelt", 5.43, 51.23, "C", UK],
  ["UK airfield", 5.24, 51.15, "A", UK],
  // The US: an airfield standing for the bases in England.
  ["US airfield", 5.24, 51.25, "A", US],
  // Germany: its HQ and factories, Deelen airfield, and the towns it held.
  ["Doetinchem", 6.29, 51.965, "Q", GERMANY],
  ["Kleve", 6.14, 51.79, "f", GERMANY],
  ["Ede", 5.66, 52.04, "f", GERMANY],
  ["'s-Hertogenbosch", 5.3, 51.69, "f", GERMANY],
  ["Deelen", 5.87, 52.06, "A", GERMANY],
  ["Arnhem", 5.925, 51.99, "C", GERMANY],
  ["Nijmegen", 5.87, 51.815, "C", GERMANY],
  ["Valkenswaard", 5.46, 51.35, "C", GERMANY],
  ["Best", 5.39, 51.505, "C", GERMANY],
  ["Elst", 5.85, 51.92, "C", GERMANY],
  ["Venlo", 6.17, 51.4, "C", GERMANY],
  ["Apeldoorn", 5.97, 52.2, "C", GERMANY],
  // Between the lines: the Dutch towns under the drop zones.
  ["Eindhoven", 5.48, 51.44, "f", null],
  ["Son", 5.49, 51.51, "C", null],
  ["Veghel", 5.55, 51.605, "C", null],
  ["Uden", 5.62, 51.66, "C", null],
  ["Grave", 5.74, 51.755, "C", null],
  ["Oss", 5.52, 51.765, "C", null],
  ["Groesbeek", 5.94, 51.79, "C", null],
  ["Oosterbeek", 5.815, 51.99, "C", null],
  ["Wageningen", 5.665, 51.975, "C", null],
  ["Helmond", 5.66, 51.48, "C", null],
];

const placed = new Map();
const taken = new Set();
for (const [name, lon, lat] of PLACES) {
  const want = toGrid([lon, lat]);
  // Off rivers, and never right next to another place. Search outward for the nearest fit.
  const fits = (x, y) => {
    const ch = at(x, y);
    if (ch === undefined || ch === "~" || taken.has(`${x},${y}`)) return false;
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

// Driel, on the south bank opposite Oosterbeek: not a property, just where the railway bridge lands.
placed.set("Driel", toGrid([5.77, 51.95]));
// Zutphen, on the east bank of the IJssel, where Germany's road from Apeldoorn crosses.
placed.set("Zutphen", toGrid([6.23, 52.13]));

/** Cheapest route between two places: follows existing roads, avoids woods and ridges, crosses rivers only when it must. */
const ROAD_COST = { ".": 1, "=": 0.4, "#": 0.4, "%": 0.4, F: 2.2, H: 5, "~": 10 };
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
      // A river is crossed straight, never followed: no two river squares in a row.
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

/** Roads whose river crossings are Major Bridges: the ones whose fate decided the battle (17-scenarios-market-garden §1). */
const MAJOR_ROADS = [
  // "Hell's Highway": XXX Corps' one road north.
  ["Neerpelt", "Valkenswaard", "Eindhoven", "Son", "Veghel", "Uden", "Grave", "Nijmegen", "Elst", "Arnhem"],
  // Best, on the Wilhelmina canal west of Son.
  ["Best", "'s-Hertogenbosch"],
  // The Oosterbeek railway bridge, drawn as a road crossing to Driel.
  ["Oosterbeek", "Driel"],
];
/** Every other road. Their crossings are ordinary Bridges, mostly Germany's reinforcement routes. */
const ROADS = [
  ["Driel", "Elst"],
  ["Leopoldsburg", "Neerpelt"],
  ["Leopoldsburg", "UK airfield"],
  ["Leopoldsburg", "Lommel", "Neerpelt"],
  ["US airfield", "Lommel"],
  ["Eindhoven", "Best"],
  ["Eindhoven", "Helmond", "Venlo"],
  ["'s-Hertogenbosch", "Veghel"],
  ["'s-Hertogenbosch", "Oss", "Grave"],
  ["Nijmegen", "Groesbeek", "Kleve"],
  ["Kleve", "Venlo"],
  ["Kleve", "Doetinchem"],
  ["Arnhem", "Oosterbeek", "Wageningen", "Ede"],
  ["Ede", "Deelen"],
  ["Arnhem", "Deelen", "Apeldoorn"],
  // Crosses the Nederrijn east of Arnhem, near Pannerden, where the 10th SS crossed by ferry.
  ["Arnhem", "Doetinchem"],
  ["Apeldoorn", "Zutphen", "Doetinchem"],
];

const roadTiles = (route) => {
  const tiles = [];
  for (let i = 1; i < route.length; i++) {
    const a = placed.get(route[i - 1]);
    const b = placed.get(route[i]);
    if (!a || !b) throw new Error(`Unknown place on road ${route.join(" - ")}`);
    tiles.push(...roadPath(a, b));
  }
  return tiles;
};
const lay = (route, bridge) => {
  for (const p of roadTiles(route)) {
    const ch = at(p.x, p.y);
    if (taken.has(key(p))) continue;
    if (ch === "~") {
      set(p.x, p.y, bridge);
      if (process.env.DEBUG_BRIDGES) console.log(`${route.join(" - ")} crosses at (${p.x}, ${p.y})`);
    }
    else if (ch !== "#" && ch !== "%") set(p.x, p.y, "=");
  }
};
// The decisive roads first, so the others join them rather than crossing the rivers elsewhere.
for (const route of MAJOR_ROADS) lay(route, "%");
for (const route of ROADS) lay(route, "#");

// ---------------------------------------------------------------- starting forces

const used = new Set();
const groundOk = (ch) => [".", "=", "F"].includes(ch);
/** The nearest free tile to a place that a ground unit can stand on, skipping properties and other units. */
function standNear(name) {
  const p = placed.get(name);
  for (let r = 1; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        const x = p.x + dx;
        const y = p.y + dy;
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || used.has(`${x},${y}`) || taken.has(`${x},${y}`)) continue;
        if (groundOk(at(x, y))) return { x, y };
      }
    }
  }
  throw new Error(`No room for a unit near ${name}`);
}
/** The free tile nearest to an offset from a place, for aircraft, which can be over anything. */
function airNear(name, dx, dy) {
  const p = placed.get(name);
  const want = { x: p.x + dx, y: p.y + dy };
  for (let r = 0; r < 4; r++) {
    for (let oy = -r; oy <= r; oy++) {
      for (let ox = -r; ox <= r; ox++) {
        const x = want.x + ox;
        const y = want.y + oy;
        if (Math.max(Math.abs(ox), Math.abs(oy)) !== r || at(x, y) === undefined || used.has(`${x},${y}`)) continue;
        return { x, y };
      }
    }
  }
  throw new Error(`No room for an aircraft near ${name}`);
}
const units = [];
const add = (type, owner, pos, extra = {}) => {
  if (used.has(key(pos))) throw new Error(`Two units at (${pos.x}, ${pos.y})`);
  used.add(key(pos));
  units.push({ type, owner, pos, ...extra });
};
const inTown = (type, owner, name, extra) => add(type, owner, placed.get(name), extra);
const outside = (type, owner, name, extra) => add(type, owner, standNear(name), extra);
const lift = (owner, name, dx, dy, cargo) => add("transportAircraft", owner, airNear(name, dx, dy), { cargo: cargo.map((type) => ({ type })) });
/** A Major Bridge on the main road next to a place, for the Pioniere waiting to blow it. */
function besideBridge(type, owner, name) {
  const p = placed.get(name);
  let best;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (at(x, y) !== "%") continue;
    const d = Math.abs(x - p.x) + Math.abs(y - p.y);
    if (!best || d < best.d) best = { x, y, d };
  }
  const free = (q) => groundOk(at(q.x, q.y)) && !used.has(key(q)) && !taken.has(key(q));
  const ring = (r) => {
    const out = [];
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (Math.abs(dx) + Math.abs(dy) === r) out.push({ x: best.x + dx, y: best.y + dy });
    return out;
  };
  const spot = [1, 2].flatMap(ring).find(free);
  if (!spot) throw new Error(`No room beside the bridge at ${name}`);
  add(type, owner, spot);
}

// The US: the 101st and 82nd Airborne in their aircraft, short of the drop zones, plus the glider lift.
lift(US, "Son", -3, 2, ["infantry", "infantry"]);
lift(US, "Son", -4, 0, ["infantry", "mortar"]);
lift(US, "Grave", -3, 2, ["infantry", "infantry"]);
lift(US, "Grave", -4, 0, ["infantry", "assaultInfantry"]);
lift(US, "US airfield", 0, 0, ["infantry", "infantry"]);

// The UK: XXX Corps in the Neerpelt bridgehead, the 1st Airborne west of Oosterbeek, the Polish lift and fighter cover.
for (const type of ["mediumTank", "mediumTank", "mediumTank", "mediumTank", "lightTank", "recon", "artillery", "artillery", "infantry", "infantry", "assaultInfantry", "assaultInfantry", "mobileAA"]) {
  outside(type, UK, "Neerpelt");
}
outside("halftrack", UK, "Neerpelt", { cargo: [{ type: "infantry" }] });
outside("halftrack", UK, "Neerpelt", { cargo: [{ type: "infantry" }] });
lift(UK, "Arnhem", -8, 1, ["infantry", "assaultInfantry"]);
lift(UK, "Arnhem", -8, 3, ["infantry", "mortar"]);
lift(UK, "UK airfield", 0, 0, ["infantry", "infantry"]);
add("fighter", UK, airNear("UK airfield", 1, 0));
add("fighter", UK, airNear("UK airfield", 0, 1));

// Germany.
// Kampfgruppe Walther across the road at Valkenswaard.
inTown("infantry", GERMANY, "Valkenswaard");
outside("infantry", GERMANY, "Valkenswaard");
outside("assaultInfantry", GERMANY, "Valkenswaard");
outside("tankDestroyer", GERMANY, "Valkenswaard");
outside("artillery", GERMANY, "Valkenswaard");
// The 59th Division at Best.
inTown("infantry", GERMANY, "Best");
outside("infantry", GERMANY, "Best");
outside("artillery", GERMANY, "Best");
// Pioniere ready to blow the Son bridge.
besideBridge("assaultInfantry", GERMANY, "Son");
// Kampfgruppe Henke in Nijmegen.
inTown("infantry", GERMANY, "Nijmegen");
besideBridge("assaultInfantry", GERMANY, "Nijmegen");
outside("flakGun", GERMANY, "Nijmegen");
// Arnhem, and the SS training battalion near Oosterbeek.
inTown("infantry", GERMANY, "Arnhem");
outside("flakGun", GERMANY, "Arnhem");
outside("infantry", GERMANY, "Oosterbeek");
outside("mortar", GERMANY, "Oosterbeek");
// Deelen airfield.
outside("flakGun", GERMANY, "Deelen");
add("fighter", GERMANY, placed.get("Deelen"));
add("fighter", GERMANY, airNear("Deelen", 0, -1));
// The 9th SS Hohenstaufen, north-east of Arnhem.
outside("recon", GERMANY, "Apeldoorn");
outside("halftrack", GERMANY, "Apeldoorn", { cargo: [{ type: "assaultInfantry" }] });
outside("halftrack", GERMANY, "Deelen", { cargo: [{ type: "assaultInfantry" }] });
outside("mediumTank", GERMANY, "Apeldoorn");
outside("artillery", GERMANY, "Apeldoorn");
outside("mobileAA", GERMANY, "Apeldoorn");
// The 10th SS Frundsberg, toward Doetinchem.
outside("mediumTank", GERMANY, "Doetinchem");
outside("infantry", GERMANY, "Doetinchem");
outside("infantry", GERMANY, "Doetinchem");
outside("assaultInfantry", GERMANY, "Doetinchem");
outside("artillery", GERMANY, "Doetinchem");
// Corps Feldt in the Reichswald.
outside("infantry", GERMANY, "Kleve");
outside("infantry", GERMANY, "Kleve");
outside("lightTank", GERMANY, "Kleve");
// The 15th Army at 's-Hertogenbosch.
outside("infantry", GERMANY, "'s-Hertogenbosch");
outside("infantry", GERMANY, "'s-Hertogenbosch");

// The first lift must start out of every German Flak Gun's reach (range 3–5), so it isn't shot down
// before it drops (17-scenarios-market-garden §1).
const FLAK_RANGE = 5;
for (const plane of units.filter((u) => u.type === "transportAircraft")) {
  for (const flak of units.filter((u) => u.type === "flakGun")) {
    const d = Math.abs(plane.pos.x - flak.pos.x) + Math.abs(plane.pos.y - flak.pos.y);
    if (d <= FLAK_RANGE) throw new Error(`A Transport Aircraft at (${plane.pos.x}, ${plane.pos.y}) starts in flak range`);
  }
}

// ---------------------------------------------------------------- write

const LAND = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank",
  "tankDestroyer", "artillery", "rocketArtillery", "mobileAA", "flakGun",
];
const scenario = {
  id: "market-garden",
  name: "Market Garden",
  description:
    "September 1944. Paratroopers drop to seize the bridges over a chain of canals and rivers, and British tanks race up one road from Belgium to cross them, all the way to the Rhine at Arnhem. The US and the UK are both Allied players; drop the paratroopers on turn 1. German sappers can blow the big bridges, and Assault Infantry can rebuild them. The Allies win by holding Eindhoven, Nijmegen and Arnhem together for 2 days; Germany wins by holding out to the start of day 12.",
  map: grid.map((row) => row.join("")),
  players: [
    { name: "US", nation: "us", funds: 2000, buildable: ["infantry", "assaultInfantry", "mortar", "recon", "fighter", "transportAircraft"] },
    {
      name: "UK",
      nation: "uk",
      funds: 6000,
      buildable: [...LAND.filter((t) => t !== "rocketArtillery"), "fighter", "bomber", "transportAircraft"],
    },
    { name: "Germany", nation: "germany", funds: 3000, buildable: [...LAND, "heavyTank", "fighter"], facing: "left" },
  ],
  propertyOwners: PLACES.filter(([, , , , owner]) => owner !== null).map(([name, , , , owner]) => ({ pos: placed.get(name), owner })),
  units,
  victory: [
    { type: "hqCapture" },
    { type: "rout" },
    { type: "holdProperties", side: "allies", properties: ["Eindhoven", "Nijmegen", "Arnhem"].map((n) => placed.get(n)), days: 2 },
    { type: "surviveDays", side: "axis", days: 12 },
  ],
};

const json = JSON.stringify(scenario, null, 2)
  // Keep each map row, unit and owner entry on one line so the file stays readable.
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+"type": "([a-zA-Z]+)"\s+\}/g, '{ "type": "$1" }')
  .replace(/\[\s+(\{ "type": "[a-zA-Z]+" \}),\s+(\{ "type": "[a-zA-Z]+" \})\s+\]/g, "[$1, $2]")
  .replace(/\[\s+(\{ "type": "[a-zA-Z]+" \})\s+\]/g, "[$1]")
  .replace(/\{\s+("type": "[^"]+"),\s+("owner": \d),\s+("pos": \{[^}]+\})(?:,\s+("cargo": \[[^\]]*\]))?\s+\}/g, (_, a, b, c, d) => `{ ${[a, b, c, d].filter(Boolean).join(", ")} }`)
  .replace(/\{\s+("pos": \{[^}]+\}),\s+("owner": \d)\s+\}/g, "{ $1, $2 }")
  .replace(/\[\s+((?:"[a-zA-Z]+",?\s+)+)\]/g, (_, list) => `[${list.trim().split(/,\s+/).join(", ")}]`);
writeFileSync(new URL("../../src/scenarios/market-garden.json", import.meta.url), json + "\n");

console.log(grid.map((row, y) => `${String(y).padStart(2)} ${row.join("")}`).join("\n"));
const income = (owner) => scenario.propertyOwners.filter((p) => p.owner === owner).length;
console.log(`\n${W}x${H}. Properties: US ${income(US)}, UK ${income(UK)}, Germany ${income(GERMANY)}, neutral ${PLACES.filter((p) => p[4] === null).length}.`);
const crossings = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (at(x, y) === "%" || at(x, y) === "#") crossings.push(`${at(x, y) === "%" ? "Major" : "plain"} bridge over ${riverOf.get(`${x},${y}`)} at (${x}, ${y})`);
}
console.log(crossings.join("\n"));
for (const [name] of PLACES) console.log(`${name}: (${placed.get(name).x}, ${placed.get(name).y})`);
