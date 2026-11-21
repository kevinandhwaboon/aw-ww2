// Generates src/scenarios/wake-island.json: Wake Island, 8–23 December 1941, the first Survival map
// (docs/23-survival.md §2–§4).
//
// About 300 m a square, north up. The atoll is drawn close to true size: Wake's V, pointing south-east
// to Peacock Point, with Wilkes at the end of its south arm and Peale at the end of its north arm,
// round a shallow lagoon. A reef rings it, with beaches on the south shores where Japan landed both
// times. The open sea round it is pulled in: the south edge stands for the Marshalls, where the raids
// and the invasion fleets came from, the west and north for the open Pacific and the carriers, and the
// east for the route from Pearl Harbor.
//
// Japan holds nothing and earns nothing: every Japanese unit comes in a wave (§5d). The first nine
// waves follow history (§3); after them the engine generates one every 2 days (§4).
//
// Run: node tools/maps/wake-island.mjs        then: node tools/maps/overview.mjs wake-island

import { writeFileSync } from "node:fs";

const W = 34;
const H = 28;

const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => "S"));
const at = (x, y) => grid[y]?.[x];
const set = (x, y, ch) => {
  if (at(x, y) === undefined) throw new Error(`(${x}, ${y}) is off the map`);
  grid[y][x] = ch;
};
const box = (x0, y0, x1, y1, ch) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, ch);
};

// ---- The islands, as scrub (Forest) first ----
// Peale, the north arm's west end, with Toki Point at its west tip.
box(9, 9, 16, 10, "F");
// Wake's north arm, from Heel Point stepping down to the south-east...
box(18, 9, 21, 10, "F");
box(21, 10, 23, 11, "F");
box(23, 11, 25, 12, "F");
// ...its east side, where the airfield is...
box(25, 12, 28, 16, "F");
// ...Peacock Point, the south-east corner, and the south arm running west to the Wilkes channel.
box(13, 17, 28, 19, "F");
// Wilkes, with Kuku Point at its west tip.
box(6, 17, 11, 19, "F");

const isLand = (x, y) => "F.=X_CfAPQ#".includes(at(x, y) ?? "S");

// ---- The lagoon, too shallow for ships: Reef inside the atoll ----
for (let y = 11; y <= 16; y++) for (let x = 7; x <= 25; x++) if (!isLand(x, y)) set(x, y, "r");
box(6, 11, 8, 16, "r");
box(17, 9, 17, 10, "r");

// ---- Open ground, the road and the runway ----
box(13, 17, 27, 17, "."); // the lagoon shore of the south arm
box(14, 18, 26, 18, "="); // the road along the south arm
box(26, 12, 26, 16, "="); // the road up the east side
box(27, 13, 27, 16, "."); // the runway
box(19, 9, 21, 9, "."); // Camp 2's clearing at Heel Point
box(10, 10, 15, 10, "="); // the road across Peale
box(7, 18, 10, 18, "."); // the new channel works on Wilkes

// ---- The channels: a bridge to Peale, and the Wilkes channel with the contractors' boat basin ----
set(17, 10, "#");
set(12, 17, "r");
set(12, 18, "#");

// ---- A reef round the whole atoll: every sea square touching land or the lagoon ----
const ring = [];
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (at(x, y) !== "S") continue;
  for (let dy = -1; dy <= 1; dy++) for (let dx = -1; dx <= 1; dx++) {
    const n = at(x + dx, y + dy);
    if (n && n !== "S" && !ring.some(([rx, ry]) => rx === x && ry === y)) ring.push([x, y]);
  }
}
for (const [x, y] of ring) set(x, y, "r");

// ---- The landing beaches, on the south shores of Wilkes and Wake ----
box(7, 19, 10, 19, "_");
box(14, 19, 24, 19, "_");

// ---- Properties ----
const P = {
  hq: [20, 18], // Devereux's command post
  airfield: [27, 15],
  camp1: [14, 18], // Camp 1, by the Wilkes channel
  camp2: [20, 9], // Camp 2: the contractors' camp and workshops at Heel Point
  port: [12, 19], // the boat basin at the Wilkes channel
  panAm: [13, 9], // the Pan American station on Peale
};
const KIND = { hq: "Q", airfield: "A", camp1: "C", camp2: "f", port: "P", panAm: "C" };
for (const [key, [x, y]] of Object.entries(P)) set(x, y, KIND[key]);

// ---- The gun positions: the three 5-inch batteries ----
const BATTERY = { a: [28, 18], l: [6, 18], b: [9, 9] }; // Peacock Point, Kuku Point, Toki Point
for (const [x, y] of Object.values(BATTERY)) set(x, y, "X");

const rows = grid.map((r) => r.join(""));

const US = 0;
const JAPAN = 1;

// ---- The US, 8 December 1941 ----
const unit = (type, x, y, extra = {}) => ({ type, owner: US, pos: { x, y }, ...extra });
const units = [
  // VMF-211: the four Wildcats that were in the air when the first raid caught the rest on the ground.
  unit("fighter", 27, 15), unit("fighter", 27, 14), unit("fighter", 27, 16), unit("fighter", 26, 15),
  // The 5-inch batteries, dug in: A at Peacock Point, L at Kuku Point on Wilkes, B at Toki Point on Peale.
  unit("artillery", ...BATTERY.a), unit("artillery", ...BATTERY.l), unit("artillery", ...BATTERY.b),
  // The 3-inch anti-aircraft batteries: by the airfield, at Peacock Point and on Peale.
  unit("flakGun", 26, 13), unit("flakGun", 27, 19), unit("flakGun", 15, 10),
  // The Marines: one on Wilkes, one on Peale, two on Wake, and a reserve by the command post.
  unit("infantry", 8, 18), unit("infantry", 11, 10), unit("infantry", 16, 18), unit("infantry", 24, 18),
  unit("assaultInfantry", 20, 17),
  // Triton, on patrol to the south when the war began.
  unit("submarine", 18, 24),
];

// ---- Where the waves come in: two rows or columns along each edge, nearest the middle first ----
const edge = (name, cells, fromWave) => ({
  name,
  zone: cells.map(([x, y]) => ({ x, y })),
  ...(fromWave === undefined ? {} : { fromWave }),
});
const alongX = (y) => Array.from({ length: W }, (_, x) => [x, y]).sort(([a], [b]) => Math.abs(a - W / 2) - Math.abs(b - W / 2));
const alongY = (x) => Array.from({ length: H }, (_, y) => [x, y]).sort(([, a], [, b]) => Math.abs(a - H / 2) - Math.abs(b - H / 2));
const EDGES = {
  south: edge("south", [...alongX(H - 1), ...alongX(H - 2)]),
  west: edge("west", [...alongY(0), ...alongY(1)]),
  north: edge("north", [...alongX(0), ...alongX(1)]),
  // The US supply route: Japan comes this way only from wave 15 (§4).
  east: edge("east", [...alongY(W - 1), ...alongY(W - 2)], 15),
};

// ---- The siege, 8–23 December (§3): units arrive at the start of Japan's turn and strike on its next ----
const raid = (n) => Array.from({ length: n }, () => ({ type: "bomber", sortieTurns: 2 }));
const ships = (type, n, extra = {}) => Array.from({ length: n }, () => ({ type, ...extra }));
const craft = (...cargo) => ({ type: "landingCraft", cargo: cargo.map((type) => ({ type })) });
const wave = (n, day, name, from, units) => ({ day, player: JAPAN, wave: n, name, zone: EDGES[from].zone, from, units });
const arrivals = [
  // The 36 bombers from Roi that caught VMF-211 on the ground at noon.
  wave(1, 1, "The noon raid", "south", raid(3)),
  wave(2, 2, "Daily raid", "south", raid(3)),
  // Kajioka's first attempt, beaten off on 11 December: cruisers and destroyers (as Destroyers) and
  // the transports with the naval infantry.
  wave(3, 3, "The first landing", "south", [...ships("destroyer", 4), craft("infantry", "infantry"), craft("infantry", "infantry")]),
  wave(4, 5, "Raid and submarines", "south", [...raid(3), ...ships("submarine", 2)]),
  wave(5, 7, "Daily raid", "south", raid(4)),
  wave(6, 9, "Raid and bombardment", "south", [...raid(3), ...ships("destroyer", 2)]),
  wave(7, 11, "Daily raid", "south", raid(5)),
  // Sōryū and Hiryū, detached on the way home from Pearl Harbor, from 21 December.
  wave(8, 13, "Carrier Division 2", "west", [
    { type: "carrier", cargo: [{ type: "fighter" }, { type: "diveBomber" }] },
    { type: "carrier", cargo: [{ type: "fighter" }, { type: "diveBomber" }] },
    ...ships("destroyer", 2),
  ]),
  // 23 December: about 1,500 naval infantry, three times the first landing, with the four heavy
  // cruisers of Cruiser Division 6 (as Battleships) and the destroyers in support.
  wave(9, 15, "The second landing", "south", [
    ...ships("battleship", 4),
    ...ships("destroyer", 6),
    craft("infantry", "infantry"), craft("infantry", "infantry"), craft("infantry", "infantry"),
    craft("infantry", "infantry"), craft("infantry", "infantry"), craft("infantry", "assaultInfantry"),
    craft("assaultInfantry", "assaultInfantry"), craft("assaultInfantry", "assaultInfantry"),
  ]),
  // The relief that never came, here allowed to arrive (§10 Q4): Saratoga with VMF-221's fighters,
  // the oiler Neches, and Tangier with Marines and guns.
  {
    day: 15,
    player: US,
    name: "Task Force 14",
    zone: EDGES.east.zone,
    from: "east",
    units: [
      { type: "carrier", cargo: [{ type: "fighter" }, { type: "fighter" }] },
      { type: "supplyShip" },
      craft("infantry", "artillery"),
      { type: "destroyer" },
    ],
  },
];

// ---- After history: the endless waves (§4) ----
const waves = {
  player: JAPAN,
  patterns: "pacific",
  firstWave: 10,
  firstDay: 17,
  everyDays: 2,
  budget: 180000,
  growth: 0.12,
  edges: Object.values(EDGES),
  unitCap: 60,
  convoy: { player: US, fromWave: 13, every: 4, edge: "east", units: [{ type: "supplyShip" }, craft("infantry", "infantry")] },
};

// ---- Build lists ----
// The US: every unit it has art for, except the never-built ones and the Heavy Tank (§2).
const buildable = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank", "tankDestroyer",
  "artillery", "rocketArtillery", "mobileAA", "flakGun", "fighter", "bomber", "transportAircraft", "diveBomber", "torpedoBomber",
  "battleship", "destroyer", "submarine", "landingCraft", "torpedoBoat", "carrier", "supplyShip",
];

const scenario = {
  id: "wake-island",
  name: "Wake Island",
  description: "December 1941. Four hundred Marines, a dozen Wildcats and six coastal guns hold a coral atoll in the middle of the Pacific. Bombers come from the Marshalls almost every day, then the invasion fleets, then the carriers. Hold the command post as long as you can: the waves never stop, and the real garrison fell on 23 December, day 16.",
  map: rows,
  players: [
    { name: "US", nation: "us", funds: 3000, buildable, facing: "left" },
    // Japan holds nothing, earns nothing and builds nothing: every unit comes in a wave (§5d).
    { name: "Japan", nation: "japan", funds: 0, buildable: [] },
  ],
  propertyOwners: Object.values(P).map(([x, y]) => ({ pos: { x, y }, owner: US })),
  units,
  victory: [{ type: "hqCapture" }, { type: "rout", side: "allies" }],
  modifiers: [{ source: "survival", stat: "income", op: "set", value: 0, scope: { players: [JAPAN] } }],
  arrivals,
  waves,
};

const out = new URL("../../src/scenarios/wake-island.json", import.meta.url);
// Short arrays on one line, as in the other scenario files.
const json = JSON.stringify(scenario, null, 2)
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+"pos": (\{[^}]*\}),\s+"owner": (\d+)\s+\}/g, '{ "pos": $1, "owner": $2 }')
  .replace(/\{\s+"type": ("\w+"),\s+"owner": (\d+),\s+"pos": (\{[^}]*\})\s+\}/g, '{ "type": $1, "owner": $2, "pos": $3 }')
  .replace(/\{\s+"type": ("\w+")\s+\}/g, '{ "type": $1 }')
  .replace(/\{\s+"type": ("\w+"),\s+"sortieTurns": (\d+)\s+\}/g, '{ "type": $1, "sortieTurns": $2 }');
writeFileSync(out, `${json}\n`);
console.log(rows.join("\n"));
