// Generates src/scenarios/crete.json: Crete, 19–28 May 1941, the second Survival map
// (docs/24-survival-crete.md).
//
// About 4.5 km a square, north up, from Kastelli in the west to past Heraklion in the east. The coast,
// the towns, the airfields and the mountains are written as real longitude/latitude points and
// projected onto the grid, as at Sevastopol. The edges stand for the Greek mainland and its airfields
// (north and west), the Dodecanese (east), and Egypt and Alexandria (south).
//
// Germany holds nothing and earns nothing: every German unit comes in a wave (23-survival §5d). Most
// waves are paratroops, arriving already aboard Transport Aircraft that fly home once empty. The first
// ten waves follow history; after them the engine generates one every 2 days from the `aegean` set.
//
// Run: node tools/maps/crete.mjs        then: node tools/maps/overview.mjs crete

import { writeFileSync } from "node:fs";

// ---------------------------------------------------------------- projection

const WEST = 23.45;
const EAST = 25.45;
const NORTH = 35.95;
const SOUTH = 34.95;
const W = 40;
const H = 22;

const toGrid = ([lon, lat]) => ({
  x: Math.min(W - 1, Math.max(0, Math.floor(((lon - WEST) / (EAST - WEST)) * W))),
  y: Math.min(H - 1, Math.max(0, Math.floor(((NORTH - lat) / (NORTH - SOUTH)) * H))),
});
const tileCenter = (x, y) => [WEST + ((x + 0.5) / W) * (EAST - WEST), NORTH - ((y + 0.5) / H) * (NORTH - SOUTH)];

// ---------------------------------------------------------------- grid helpers

const grid = Array.from({ length: H }, () => Array(W).fill("S"));
const at = (x, y) => (x >= 0 && y >= 0 && x < W && y < H ? grid[y][x] : undefined);
const set = (x, y, ch) => {
  if (at(x, y) === undefined) throw new Error(`(${x}, ${y}) is off the map`);
  grid[y][x] = ch;
};
const N4 = [[0, 1], [1, 0], [0, -1], [-1, 0]];
const N8 = [...N4, [1, 1], [1, -1], [-1, 1], [-1, -1]];
const isSea = (x, y) => at(x, y) === "S";
const isLand = (x, y) => at(x, y) !== undefined && !isSea(x, y);
const touchesSea = (x, y) => N8.some(([dx, dy]) => isSea(x + dx, y + dy));

/** Deterministic noise in [0, 1) for a tile and a salt, so the map is the same on every run. */
const noise = (x, y, salt) => {
  let h = (x * 374761393 + y * 668265263 + salt * 2147483647) | 0;
  h = Math.imul(h ^ (h >>> 13), 1274126177);
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
};
/** Noise that clumps, so woods and hills come in patches. */
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

// ---------------------------------------------------------------- the island

// Clockwise from Gramvousa, the north-west tip: the north coast east past the Rodopou peninsula,
// Maleme, Chania, the Akrotiri, Georgioupolis, Rethymno and Heraklion to past Malia (off the east
// edge); then back along the south coast past the Messara, Sphakia and Paleochora to Elafonisi.
const CRETE = [
  [23.57, 35.6], [23.6, 35.64], [23.63, 35.58], [23.66, 35.5], [23.7, 35.52], [23.73, 35.65], [23.77, 35.66],
  [23.78, 35.54], [23.83, 35.535], [23.93, 35.535], [24.02, 35.53], [24.07, 35.56], [24.1, 35.6], [24.17, 35.59],
  [24.21, 35.53], [24.28, 35.47], [24.27, 35.4], [24.27, 35.37], [24.4, 35.37], [24.5, 35.37], [24.62, 35.39],
  [24.78, 35.42], [24.95, 35.42], [25.05, 35.36], [25.13, 35.345], [25.3, 35.33], [25.45, 35.3], [25.6, 35.3],
  [25.6, 34.9], [24.9, 34.9], [24.75, 34.93], [24.73, 35.0], [24.75, 35.06], [24.7, 35.09], [24.55, 35.13],
  [24.4, 35.18], [24.23, 35.18], [24.14, 35.2], [24.0, 35.22], [23.81, 35.25], [23.68, 35.23], [23.54, 35.27],
  [23.53, 35.4], [23.57, 35.5],
];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) if (inside(CRETE, tileCenter(x, y))) set(x, y, ".");

// Souda Bay: a long inlet between the Akrotiri and the south shore, open to the east. The fleet's
// anchorage, and Creforce's port.
for (const [x, y] of [[13, 9], [14, 9], [15, 9]]) set(x, y, "S");

// ---------------------------------------------------------------- countryside

const between = ([lon, lat], w, e, s, n) => lon >= w && lon <= e && lat >= s && lat <= n;
for (let y = 0; y < H; y++) {
  for (let x = 0; x < W; x++) {
    if (at(x, y) !== ".") continue;
    const c = tileCenter(x, y);
    const r = clumpy(x, y, 1);
    let ch;
    // The White Mountains (Lefka Ori), west-centre: high and bare, impassable to vehicles.
    if (between(c, 23.82, 24.22, 35.22, 35.43)) ch = r < 0.8 ? "H" : "F";
    // Mount Ida (Psiloritis), the centre.
    else if (between(c, 24.62, 24.98, 35.12, 35.33)) ch = r < 0.75 ? "H" : "F";
    // The hills of the far west, behind Kastelli and down to Paleochora.
    else if (c[0] < 23.82 && c[1] < 35.45) ch = r < 0.45 ? "H" : r < 0.75 ? "F" : ".";
    // The hills between Rethymno and Mount Ida, and the Kedros south of them.
    else if (between(c, 24.3, 24.62, 35.12, 35.33)) ch = r < 0.45 ? "H" : r < 0.65 ? "F" : ".";
    // The Messara, the great plain of the south.
    else if (between(c, 24.75, 25.15, 34.9, 35.1)) ch = r < 0.12 ? "F" : ".";
    // The Heraklion hinterland: vineyards and rolling hills.
    else if (c[0] > 24.98) ch = r < 0.3 ? "F" : r < 0.42 ? "H" : ".";
    // The coastal plain on the north coast: olive groves and vineyards, where the paratroops landed
    // among defenders they couldn't see.
    else ch = r < 0.45 ? "F" : ".";
    set(x, y, ch);
  }
}

// ---------------------------------------------------------------- places

const PLACES = {
  maleme: { pos: [7, 9], kind: "A" }, // the airfield, by the Tavronitis
  kastelli: { pos: [4, 10], kind: "C" },
  galatas: { pos: [10, 10], kind: "C" },
  chania: { pos: [11, 9], kind: "Q" }, // Creforce headquarters
  souda: { pos: [13, 10], kind: "P" }, // the port on Souda Bay
  depot: { pos: [12, 10], kind: "f" }, // the base depot: a liberty, so the player can build (24-survival-crete §2)
  georgioupolis: { pos: [16, 13], kind: "C" },
  sphakia: { pos: [14, 16], kind: "C" }, // on the south coast, where Creforce was taken off
  rethymnoTown: { pos: [20, 13], kind: "C" },
  rethymno: { pos: [22, 12], kind: "A" }, // the airstrip at Pigi, east of the town
  heraklionPort: { pos: [33, 13], kind: "P" },
  heraklion: { pos: [34, 13], kind: "A" }, // the airfield east of the town
};

// ---------------------------------------------------------------- terrain features

// The Tavronitis, a dry riverbed just west of Maleme, where the Assault Regiment gathered. Its iron
// bridge on the coast road is a Major Bridge.
for (let y = 9; y <= 12; y++) set(6, y, "~");
// Hill 107, overlooking Maleme airfield from the south.
const HILL_107 = [7, 10];
set(...HILL_107, "H");
// Prison Valley, south-west of Galatas: open ground, with the Agia prison as a bunker.
for (const [x, y] of [[9, 10], [9, 11], [10, 11], [8, 11]]) set(x, y, ".");
const PRISON = [9, 11];
set(...PRISON, "X");

// ---------------------------------------------------------------- roads

const ROADS = [
  // The north coast road, Kastelli to Heraklion, the only way along the island for vehicles.
  [[4, 10], [5, 10], [5, 9], [12, 9], [12, 10], [15, 10], [15, 13], [22, 13], [22, 12], [30, 12], [30, 13], [35, 13], [35, 14], [38, 14]],
  // Chania to Alikianos through Prison Valley.
  [[10, 9], [10, 12]],
  // The mountain track from Vrysses over the White Mountains to Sphakia.
  [[14, 10], [14, 16]],
  // Heraklion south across the island to the Messara.
  [[34, 13], [34, 17], [31, 17], [31, 20]],
];
for (const road of ROADS) {
  for (let i = 1; i < road.length; i++) {
    const [ax, ay] = road[i - 1];
    const [bx, by] = road[i];
    for (const p of line({ x: ax, y: ay }, { x: bx, y: by })) {
      const ch = at(p.x, p.y);
      if (ch === "S") throw new Error(`A road runs into the sea at (${p.x}, ${p.y})`);
      if (ch === "~") set(p.x, p.y, "%"); // the Tavronitis bridge
      else if (!"X".includes(ch)) set(p.x, p.y, "=");
    }
  }
}

// ---------------------------------------------------------------- beaches

// Where Landing Craft can land: Kastelli bay, the coast from Maleme to Platanias (where the caiques
// were meant to come ashore), Georgioupolis, east of Heraklion (the way the Italians came from
// Sitia), and Sphakia on the south coast.
const BEACHES = [[3, 9], [8, 9], [9, 9], [17, 13], [18, 13], [36, 14], [37, 14], [15, 16]];
for (const [x, y] of BEACHES) {
  if (!touchesSea(x, y) || isSea(x, y)) throw new Error(`The beach at (${x}, ${y}) isn't on the shore`);
  set(x, y, "_");
}
// Crete's north coast is mostly open shore. Every other open square on it, facing the sea to the north
// or east, is a beach too, so a convoy has more than one place to land and doesn't queue offshore
// until its fuel runs out. Where the coast road runs along the shore, a beach costs the same to cross.
const PROPERTY_SQUARES = new Set(Object.values(PLACES).map(({ pos: [x, y] }) => `${x},${y}`));
for (let y = 0; y < 15; y++) {
  for (let x = 0; x < W; x++) {
    if (!".F=".includes(at(x, y)) || PROPERTY_SQUARES.has(`${x},${y}`) || (x + y) % 2 !== 0) continue;
    if (isSea(x, y - 1) || isSea(x + 1, y)) set(x, y, "_");
  }
}

// The properties last, so nothing paints over them.
for (const { pos: [x, y], kind } of Object.values(PLACES)) {
  if (isSea(x, y)) throw new Error(`A property is in the sea at (${x}, ${y})`);
  set(x, y, kind);
}
if (!touchesSea(...PLACES.souda.pos) || !touchesSea(...PLACES.heraklionPort.pos)) throw new Error("A port isn't on the shore");

const rows = grid.map((r) => r.join(""));

// ---------------------------------------------------------------- the UK, 19 May 1941

const UK = 0;
const GERMANY = 1;

const taken = new Set();
const VEHICLE_BLOCKED = "HS~r";
/** A unit on this square, or the nearest free one it can stand on. */
function unit(type, [x, y], extra = {}) {
  const vehicle = !["infantry", "assaultInfantry", "mortar"].includes(type);
  const naval = ["destroyer", "torpedoBoat"].includes(type);
  const fits = (px, py) => {
    const ch = at(px, py);
    if (ch === undefined || taken.has(`${px},${py}`)) return false;
    if (naval) return ch === "S" || (ch === "P");
    if (ch === "S") return false;
    return !(vehicle && VEHICLE_BLOCKED.includes(ch));
  };
  for (let r = 0; r < 6; r++) {
    for (let dy = -r; dy <= r; dy++) {
      for (let dx = -r; dx <= r; dx++) {
        if (Math.max(Math.abs(dx), Math.abs(dy)) !== r || !fits(x + dx, y + dy)) continue;
        taken.add(`${x + dx},${y + dy}`);
        return { type, owner: UK, pos: { x: x + dx, y: y + dy }, ...extra };
      }
    }
  }
  throw new Error(`No room for a ${type} near (${x}, ${y})`);
}

const units = [
  // Maleme, 5th New Zealand Brigade: the 22nd Battalion on Hill 107 and the airfield, the Bofors, two
  // Matildas of 7th Royal Tank Regiment, the brigade's guns.
  unit("infantry", HILL_107), unit("infantry", [8, 10]), unit("infantry", PLACES.maleme.pos),
  unit("mobileAA", [8, 9]), unit("mediumTank", [9, 9]), unit("artillery", [8, 11]),
  // Galatas and Prison Valley: New Zealand and Greek battalions, and the 3rd Hussars' light tanks.
  unit("infantry", PLACES.galatas.pos), unit("infantry", [10, 10]), unit("infantry", [9, 10]), unit("lightTank", [10, 11]),
  // Chania and Souda Bay: Creforce headquarters, the 3.7-inch guns at Souda, the coast guns.
  unit("infantry", PLACES.chania.pos), unit("infantry", PLACES.souda.pos), unit("flakGun", [12, 9]), unit("artillery", [13, 11]),
  // Rethymno: the Australian 2/1st and 2/11th Battalions and the Greek regiments.
  unit("infantry", PLACES.rethymno.pos), unit("infantry", PLACES.rethymnoTown.pos), unit("artillery", [21, 12]),
  // Heraklion: 14th Brigade, the Australian 2/4th, the Greeks; two Matildas and the Bofors.
  unit("infantry", PLACES.heraklion.pos), unit("infantry", PLACES.heraklionPort.pos), unit("infantry", [33, 12]),
  unit("mediumTank", [34, 12]), unit("mobileAA", [35, 13]),
  // The fleet, south of Crete by day, and the motor torpedo boats at Souda.
  unit("destroyer", [11, 19]), unit("destroyer", [22, 19]), unit("torpedoBoat", [14, 9]),
];

// ---------------------------------------------------------------- where the waves come in

/** Squares along the top two rows, nearest the given column first. */
const northToward = (aim) => [0, 1].flatMap((y) => Array.from({ length: W }, (_, x) => [x, y])).sort(([a, ay], [b, by]) => Math.abs(a - aim) - Math.abs(b - aim) || ay - by);
const alongX = (y) => Array.from({ length: W }, (_, x) => [x, y]).sort(([a], [b]) => Math.abs(a - W / 2) - Math.abs(b - W / 2));
const alongY = (x) => Array.from({ length: H }, (_, y) => [x, y]).sort(([, a], [, b]) => Math.abs(a - H / 2) - Math.abs(b - H / 2));
const zone = (cells) => cells.map(([x, y]) => ({ x, y }));
const edge = (name, cells, fromWave) => ({ name, zone: zone(cells), ...(fromWave === undefined ? {} : { fromWave }) });
const EDGES = {
  north: edge("north", [...alongX(0), ...alongX(1)]),
  west: edge("west", [...alongY(0), ...alongY(1)]),
  east: edge("east", [...alongY(W - 1), ...alongY(W - 2)]),
  // The fleet's route from Alexandria: Germany comes this way only from wave 15 (24-survival-crete §4).
  south: edge("south", [...alongX(H - 1), ...alongX(H - 2)], 15),
};
// The scripted lifts come in off the coast nearest where they dropped in 1941.
const NORTH_TOWARD = {
  maleme: zone(northToward(PLACES.maleme.pos[0])),
  rethymno: zone(northToward(PLACES.rethymno.pos[0])),
  heraklion: zone(northToward(PLACES.heraklion.pos[0])),
};

// ---------------------------------------------------------------- the invasion, 19–28 May

const SORTIE = 2;
const bombers = (n) => Array.from({ length: n }, () => ({ type: "bomber", sortieTurns: SORTIE }));
const fighters = (n) => Array.from({ length: n }, () => ({ type: "fighter", sortieTurns: SORTIE }));
/** A Transport Aircraft with its paratroops aboard; it flies home once it has dropped them. */
const lift = (...cargo) => ({ type: "transportAircraft", cargo: cargo.map((type) => ({ type })), leavesWhenEmpty: true });
/** A caique flotilla, as a Landing Craft that sails home once it has landed its troops. */
const caique = (...cargo) => ({ type: "landingCraft", cargo: cargo.map((type) => ({ type })), leavesWhenEmpty: true });
const wave = (n, day, name, from, zoneCells, units) => ({ day, player: GERMANY, wave: n, name, zone: zoneCells, from, units });
const arrivals = [
  // 20 May, morning: the Assault Regiment's gliders and the 3rd Parachute Regiment, on Maleme and
  // Prison Valley, with the bombers that went in first.
  wave(1, 1, "The morning lift", "north", NORTH_TOWARD.maleme, [
    lift("infantry", "assaultInfantry"), lift("infantry", "infantry"), lift("infantry", "infantry"),
    lift("infantry", "mortar"), lift("infantry", "infantry"),
    ...bombers(3), ...fighters(1),
  ]),
  // 20 May, afternoon: the 1st and 2nd Parachute Regiments, on Rethymno and Heraklion.
  wave(2, 2, "The afternoon lift", "north", NORTH_TOWARD.heraklion, [
    lift("infantry", "infantry"), lift("infantry", "mortar"), lift("infantry", "infantry"), lift("infantry", "infantry"),
    ...bombers(2),
  ]),
  // 21 May on: the 5th Mountain Division, flown in. In 1941 its Ju 52s landed on Maleme; here they
  // drop their troops like the paratroops (24-survival-crete §3).
  wave(3, 3, "The first mountain troops", "north-west", NORTH_TOWARD.maleme, [lift("infantry", "infantry"), lift("infantry", "infantry"), lift("infantry", "mortar")]),
  // The first caique convoy, scattered by the Royal Navy on the night of 21 May.
  wave(4, 3, "The Maleme convoy", "north", NORTH_TOWARD.maleme, [caique("infantry", "lightTank"), caique("infantry", "artillery")]),
  wave(5, 4, "Mountain troops", "north-west", NORTH_TOWARD.maleme, [lift("infantry", "infantry"), lift("infantry", "infantry"), lift("infantry", "assaultInfantry")]),
  wave(6, 4, "Hunting the fleet", "north", NORTH_TOWARD.rethymno, [...bombers(4), ...fighters(1)]),
  wave(7, 5, "Mountain troops", "north-west", NORTH_TOWARD.maleme, [lift("infantry", "infantry"), lift("infantry", "infantry"), lift("infantry", "mortar")]),
  // 25 May: the attack on Galatas, with the heaviest raids of the battle.
  wave(8, 6, "Galatas", "north-west", NORTH_TOWARD.maleme, [
    lift("infantry", "infantry"), lift("infantry", "infantry"), lift("infantry", "assaultInfantry"), lift("infantry", "mortar"),
    ...bombers(4), ...fighters(2),
  ]),
  wave(9, 7, "The second drop", "north", NORTH_TOWARD.rethymno, [
    lift("infantry", "infantry"), lift("infantry", "assaultInfantry"), lift("infantry", "infantry"), lift("infantry", "assaultInfantry"), lift("infantry", "infantry"),
  ]),
  // 28 May: the Italian landing at Sitia, from the Dodecanese (drawn German, 24-survival-crete §2).
  wave(10, 9, "Sitia", "east", EDGES.east.zone, [caique("infantry", "lightTank"), caique("infantry", "lightTank")]),
  // 26 May: the relief. Layforce, landed at Souda Bay from the fast minelayer Abdiel, and the carrier
  // Formidable with two Fulmars, the only aircraft the UK has.
  {
    day: 8,
    player: UK,
    name: "Layforce",
    zone: zone([PLACES.depot.pos, [13, 11], [12, 11], [14, 11]]),
    from: "Souda Bay",
    units: [{ type: "assaultInfantry" }, { type: "assaultInfantry" }],
  },
  {
    day: 8,
    player: UK,
    name: "Formidable",
    zone: EDGES.south.zone,
    from: "south",
    units: [{ type: "carrier", cargo: [{ type: "fighter" }, { type: "fighter" }] }],
  },
];

// ---------------------------------------------------------------- after history: the endless waves

const waves = {
  player: GERMANY,
  patterns: "aegean",
  firstWave: 11,
  firstDay: 11,
  everyDays: 2,
  budget: 260000,
  growth: 0.12,
  edges: Object.values(EDGES),
  unitCap: 90,
  // The navy's runs in from Alexandria with men and supplies.
  convoy: { player: UK, fromWave: 13, every: 4, edge: "south", units: [{ type: "destroyer" }, { type: "landingCraft", cargo: [{ type: "infantry" }, { type: "infantry" }] }] },
};

// ---------------------------------------------------------------- build lists

// The UK: every land unit it has art for except the Heavy Tank, and the light ships. No aircraft: the
// RAF had left, and the Luftwaffe owns the sky (24-survival-crete §8, Q1).
const buildable = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "supplyTruck", "lightTank", "mediumTank", "tankDestroyer",
  "artillery", "rocketArtillery", "mobileAA", "flakGun", "destroyer", "torpedoBoat",
];

const scenario = {
  id: "crete",
  name: "Crete",
  description: "May 1941. New Zealand, Australian, Greek and British troops, short of guns and with no aircraft at all, hold Crete against Germany's paratroops. They come by air, a lift at a time, onto the airfields at Maleme, Rethymno and Heraklion, then by sea. Hold Creforce headquarters at Chania as long as you can: the waves never stop, and Chania fell on 27 May, day 9.",
  map: rows,
  players: [
    { name: "UK", nation: "uk", funds: 0, buildable, facing: "right" },
    // Germany holds nothing, earns nothing and builds nothing: every unit comes in a wave.
    { name: "Germany", nation: "germany", funds: 0, buildable: [] },
  ],
  propertyOwners: Object.values(PLACES).map(({ pos: [x, y] }) => ({ pos: { x, y }, owner: UK })),
  units,
  victory: [{ type: "hqCapture" }, { type: "rout", side: "allies" }],
  modifiers: [
    { source: "survival", stat: "income", op: "set", value: 0, scope: { players: [GERMANY] } },
    // Creforce was cut off and short of everything: its 12 properties earn half the usual, 6,000 a
    // day, about what Wake's 6 earn.
    { source: "survival", stat: "income", op: "multiply", value: 0.5, scope: { players: [UK] } },
  ],
  arrivals,
  waves,
};

const out = new URL("../../src/scenarios/crete.json", import.meta.url);
// Short arrays on one line, as in the other scenario files.
const json = JSON.stringify(scenario, null, 2)
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+"pos": (\{[^}]*\}),\s+"owner": (\d+)\s+\}/g, '{ "pos": $1, "owner": $2 }')
  .replace(/\{\s+"type": ("\w+"),\s+"owner": (\d+),\s+"pos": (\{[^}]*\})\s+\}/g, '{ "type": $1, "owner": $2, "pos": $3 }')
  .replace(/\{\s+"type": ("\w+")\s+\}/g, '{ "type": $1 }')
  .replace(/\{\s+"type": ("\w+"),\s+"sortieTurns": (\d+)\s+\}/g, '{ "type": $1, "sortieTurns": $2 }');
writeFileSync(out, `${json}\n`);
console.log(rows.map((r, y) => `${String(y).padStart(2)} ${r}`).join("\n"));
console.log("   " + Array.from({ length: W }, (_, x) => x % 10).join(""));
