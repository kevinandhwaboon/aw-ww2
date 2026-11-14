// Generates src/scenarios/iwo-jima.json: the island of Iwo Jima in February 1945 (docs/14-scenarios-pacific.md).
// The island's outline is a polygon in map squares (about 300 m each), traced from the real map with
// north up: Mount Suribachi at the south-west tip, the narrow neck behind the landing beaches, the
// airfields across the middle and the rocky Motoyama plateau in the north. Features are stamped on
// top in order, so later ones win.
//
// Run: node tools/maps/iwo-jima.mjs        then: node tools/maps/overview.mjs iwo-jima

import { writeFileSync } from "node:fs";

const W = 36;
const H = 26;

// The coast, clockwise from Mount Suribachi.
const ISLAND = [
  [2.5, 22.5], [2.5, 20], [4.5, 18.2], [7, 17], [9, 15.5], [10.5, 13.5], [11.5, 11], [13, 8.5], [15, 6.5],
  [17, 4.5], [19.5, 2.6], [23, 2], [26.5, 2.3], [29.5, 3.6], [31.5, 5.5], [31.8, 7.5], [30.5, 9.5],
  [28.5, 11], [26, 12.2], [23, 13.3], [20, 14.6], [17, 16.3], [14, 18], [11, 19.6], [8.5, 21], [6.5, 22.5], [4.5, 23.5],
];

// The US staging area: a stand-in for the transport groups offshore, south-east of the island, where
// reinforcements are built, and for the Marianas, whose bombers fly from its Airfield. The fleet
// itself is real ships (see Forces).
const ANCHORAGE = [[28, 19], [34, 19], [34, 24], [28, 24]];

function inside(poly, x, y) {
  let hit = false;
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i];
    const [xj, yj] = poly[j];
    if ((yi > y) !== (yj > y) && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) hit = !hit;
  }
  return hit;
}

const grid = Array.from({ length: H }, (_, y) => Array.from({ length: W }, (_, x) => {
  if (inside(ISLAND, x + 0.5, y + 0.5)) return ".";
  if (inside(ANCHORAGE, x + 0.5, y + 0.5)) return ".";
  return "S";
}));
const isLand = (x, y) => grid[y]?.[x] !== undefined && grid[y][x] !== "S";
const set = (x, y, ch) => {
  if (grid[y]?.[x] === undefined) throw new Error(`(${x}, ${y}) is off the map`);
  grid[y][x] = ch;
};
const each = (cells, ch) => cells.forEach(([x, y]) => set(x, y, ch));

// ---- The island ----

// Black volcanic sand: every land square touching the sea on the south-east and west coasts, below
// the plateau. The north coast is cliffs, drawn as Hills further down.
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  if (!inside(ISLAND, x + 0.5, y + 0.5)) continue;
  const coast = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => !isLand(x + dx, y + dy));
  if (coast && y >= 9) set(x, y, "_");
}

// Rough ground of ash and broken rock (Rubble) over the north, scrub (Forest) in the hollows.
const rough = [
  [17, 5], [18, 4], [21, 3], [25, 3], [28, 4], [29, 5], [16, 7], [19, 6], [23, 6], [26, 7], [29, 8],
  [14, 10], [16, 9], [27, 9], [24, 11], [21, 12],
];
each(rough, "x");
each([[20, 5], [24, 4], [27, 5], [15, 8], [22, 10], [26, 10], [18, 12], [13, 12], [23, 8]], "F");

// The Motoyama plateau and the ridges of the north: Hill 382, Turkey Knob, the Amphitheater,
// Hill 362A, Nishi Ridge and the cliffs above the north coast.
each([
  [19, 3], [20, 3], [22, 3], [23, 3], [26, 3], [27, 3], [18, 5], [30, 6], [30, 7], [31, 7], [17, 6],
  [24, 8], [25, 8], [25, 9], [24, 9], [23, 9], [22, 7], [21, 7], [16, 8], [17, 8], [27, 6], [28, 6],
  [28, 7], [26, 4], [29, 4], [21, 4], [25, 5], [20, 9],
], "H");

// Mount Suribachi: a steep cone at the south-west tip, ringed with guns and caves.
each([[3, 20], [4, 19], [3, 21], [5, 21], [4, 22], [5, 20], [3, 22]], "H");

// Roads: round the island's middle, linking the airfields and villages.
each([
  [9, 18], [10, 17], [11, 16], [12, 15], [12, 14], [13, 14], [14, 13], [15, 12], [16, 11], [17, 11], [18, 10],
  [19, 10], [20, 10], [21, 9], [22, 9], [22, 8], [23, 7], [24, 7], [24, 6], [25, 6], [26, 6], [26, 5],
  [19, 8], [19, 7], [20, 6], [21, 5], [22, 5], [22, 4], [18, 9], [17, 9], [16, 10], [6, 19], [7, 19], [8, 18],
], "=");

// Properties.
const P = {
  suribachi: [4, 21], // The summit: an observation post, drawn as a City (see the doc)
  airfield1: [13, 13],
  airfield2: [19, 9],
  airfield3: [25, 7],
  motoyama: [21, 6],
  nishi: [16, 6],
  kita: [24, 3],
  depot: [23, 5], // The Japanese supply depot: their only Factory
  hq: [20, 4], // Kuribayashi's command post, in a cave near Kitano Point
  usHq: [31, 22],
  usFactory: [30, 21],
  usPort: [28, 20],
  usAirfield: [28, 19], // Stands for the bomber bases in the Marianas
};
set(...P.suribachi, "C");
set(...P.airfield1, "A");
set(...P.airfield2, "A");
set(...P.airfield3, "A");
// Minami and Higashi were removed on 2026-11-14 to cut Japan's income (14-scenarios-pacific §1).
for (const v of ["motoyama", "nishi", "kita"]) set(...P[v], "C");
set(...P.depot, "f");
set(...P.hq, "Q");
set(...P.usHq, "Q");
set(...P.usFactory, "f");
set(...P.usPort, "P");
set(...P.usAirfield, "A");
// The runways run on from each airfield as open ground.
each([[12, 13], [14, 12], [18, 10], [20, 8], [26, 8]], ".");

// Bunkers: pillboxes and blockhouses behind the beaches, on the flanks of Suribachi, round the
// airfields and all through the northern ridges. Never on the sand.
const bunkers = [
  [5, 19], [6, 20], [7, 18], [9, 16], [10, 15], [12, 12], [14, 14], [15, 13], [17, 10], [18, 11],
  [20, 11], [22, 11], [21, 8], [25, 10], [23, 4], [19, 5], [27, 7], [17, 7], [15, 9], [29, 6],
  // The beach line: a pillbox one square inland all along the landing beaches, from below Suribachi
  // to the East Boat Basin, one above the west beach, and one more on Suribachi's slope. Each
  // overlooks the sand, so landing craft have to come in under its guns.
  [10, 18], [12, 17], [14, 16], [16, 15], [17, 14], [19, 13], [22, 12], [8, 17], [4, 20],
  // Pillboxes above the west beach by Airfield No. 1 and the East Boat Basin.
  [11, 13], [24, 11],
];
each(bunkers, "X");
// The US anchorage is land in the game but stands for ships: keep it plain apart from its properties.

const rows = grid.map((r) => r.join(""));
for (const [x, y] of bunkers) if (grid[y][x] !== "X") throw new Error(`bunker at ${x},${y} overwritten`);

// ---- Forces ----

const us = (type, x, y, extra = {}) => ({ type, owner: 0, pos: { x, y }, ...extra });
const jp = (type, x, y, extra = {}) => ({ type, owner: 1, pos: { x, y }, ...extra });
// The US starts entirely afloat: no one is ashore on day 1. The Landing Craft wait two turns out from
// the beaches (more than a Landing Craft's 6 squares), so the first day can only be bombardment and
// the approach. Every Japanese gun is out of range of every US ship at the start.
const units = [
  // The bombardment group: three Battleships within their 6-square reach of the beach line, and two
  // Destroyers.
  us("battleship", 14, 20), us("battleship", 18, 18), us("battleship", 22, 16),
  us("destroyer", 16, 19), us("destroyer", 20, 17),
  // Two Carriers, each with two Dive Bombers that can reach a beach bunker on day 1
  // (05-supply-transport §10). Japan has no ships here, so no Torpedo Bombers.
  us("carrier", 26, 15, { cargo: [{ type: "diveBomber" }, { type: "diveBomber" }] }),
  us("carrier", 24, 16, { cargo: [{ type: "diveBomber" }, { type: "diveBomber" }] }),
  // Two Bombers flown in from the Marianas, already over the sea. They fly back to the anchorage
  // Airfield (the Marianas) to refuel and rearm, two turns each way.
  us("bomber", 23, 17), us("bomber", 21, 19),
  // The landing force, all aboard six Landing Craft: five Infantry, three Assault Infantry, two
  // Medium Tanks, an Artillery and a Halftrack.
  us("landingCraft", 19, 21, { cargo: [{ type: "infantry" }, { type: "infantry" }] }),
  us("landingCraft", 21, 20, { cargo: [{ type: "assaultInfantry" }, { type: "assaultInfantry" }] }),
  us("landingCraft", 23, 19, { cargo: [{ type: "infantry" }, { type: "infantry" }] }),
  us("landingCraft", 20, 22, { cargo: [{ type: "mediumTank" }, { type: "mediumTank" }] }),
  us("landingCraft", 22, 21, { cargo: [{ type: "infantry" }, { type: "assaultInfantry" }] }),
  us("landingCraft", 24, 20, { cargo: [{ type: "artillery" }, { type: "halftrack" }] }),
  // Mount Suribachi's garrison.
  jp("infantry", 5, 19), jp("mortar", 4, 20), jp("artillery", 6, 19), jp("infantry", 6, 20),
  // The beach line: every pillbox behind the sand is manned, with guns and mortars behind it whose
  // fire falls on the beaches.
  jp("infantry", 8, 17), jp("infantry", 10, 18), jp("assaultInfantry", 12, 17), jp("infantry", 14, 16),
  jp("infantry", 16, 15), jp("assaultInfantry", 17, 14), jp("infantry", 19, 13), jp("infantry", 22, 12),
  jp("mortar", 11, 17), jp("artillery", 13, 15), jp("artillery", 16, 13), jp("mortar", 20, 12),
  // Guns on Suribachi's summit, and covering the west beach and the East Boat Basin, so there's no
  // unguarded stretch of sand to land on instead.
  jp("artillery", 4, 21), jp("infantry", 11, 13), jp("artillery", 13, 11), jp("infantry", 24, 11),
  jp("artillery", 26, 9),
  // The airfield line and the neck.
  jp("infantry", 10, 15), jp("infantry", 12, 12), jp("assaultInfantry", 14, 14), jp("flakGun", 15, 11),
  jp("mortar", 17, 10), jp("infantry", 18, 11),
  // The northern defenses, Kuribayashi's main line: the Meat Grinder round Hill 382 and Motoyama.
  jp("infantry", 20, 11), jp("infantry", 22, 11), jp("infantry", 21, 8), jp("infantry", 25, 10),
  jp("rocketArtillery", 22, 6), jp("rocketArtillery", 26, 5), jp("artillery", 24, 7), jp("mortar", 23, 9),
  jp("flakGun", 19, 7), jp("assaultInfantry", 17, 7),
  // Baron Nishi's 26th Tank Regiment, dug in near Airfield No. 2.
  jp("mediumTank", 21, 9), jp("mediumTank", 18, 9), jp("lightTank", 16, 9),
];

const owners = [
  [P.usHq, 0], [P.usFactory, 0], [P.usPort, 0], [P.usAirfield, 0],
  [P.suribachi, 1], [P.airfield1, 1], [P.airfield2, 1], [P.airfield3, 1], [P.motoyama, 1],
  [P.nishi, 1], [P.kita, 1], [P.depot, 1], [P.hq, 1],
];

const scenario = {
  id: "iwo-jima",
  name: "Iwo Jima",
  description: "February 1945. The US fleet lies off a small volcanic island with the Marines still aboard their landing craft. Japan's garrison is dug into bunkers and caves from end to end, its guns trained on the black sand beaches: shell and bomb the beach line before going in. The US wins by taking Mount Suribachi and Airfields No. 1 and No. 2, or Japan's HQ. Japan wins by holding out to the start of day 18.",
  map: rows,
  players: [
    {
      name: "US",
      nation: "us",
      funds: 6000,
      buildable: [
        "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank", "tankDestroyer",
        "artillery", "rocketArtillery", "mobileAA", "flakGun", "fighter", "bomber", "transportAircraft", "diveBomber", "torpedoBomber",
        "battleship", "destroyer", "submarine", "landingCraft", "torpedoBoat", "carrier",
      ],
      facing: "left",
    },
    {
      name: "Japan",
      nation: "japan",
      funds: 3000,
      buildable: ["infantry", "assaultInfantry", "mortar", "lightTank", "mediumTank", "artillery", "rocketArtillery", "flakGun"],
    },
  ],
  propertyOwners: owners.map(([[x, y], owner]) => ({ pos: { x, y }, owner })),
  units: units.map((u) => ({ ...u })),
  victory: [
    { type: "hqCapture" },
    { type: "rout" },
    {
      type: "captureProperties",
      side: "allies",
      properties: [P.suribachi, P.airfield1, P.airfield2].map(([x, y]) => ({ x, y })),
    },
    { type: "surviveDays", side: "axis", days: 18 },
  ],
};

const out = new URL("../../src/scenarios/iwo-jima.json", import.meta.url);
// Short arrays on one line, as in the other scenario files.
const json = JSON.stringify(scenario, null, 2)
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+"pos": (\{[^}]*\}),\s+"owner": (\d+)\s+\}/g, '{ "pos": $1, "owner": $2 }')
  .replace(/\{\s+"type": ("\w+"),\s+"owner": (\d+),\s+"pos": (\{[^}]*\})\s+\}/g, '{ "type": $1, "owner": $2, "pos": $3 }')
  .replace(/\{\s+"type": ("\w+")\s+\}/g, '{ "type": $1 }');
writeFileSync(out, `${json}\n`);
console.log(rows.join("\n"));
