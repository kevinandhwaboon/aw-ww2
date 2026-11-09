// Generates src/scenarios/the-slot.json: a symmetric island campaign in the style of the Solomons,
// not a historical map (docs/14-scenarios-pacific.md §2). The US holds the south, Japan the north.
//
// Everything is described once, for the south half and the centre row, and `put` also stamps the
// same thing turned 180° about the centre square, so the north is an exact rotation of the south:
// terrain, property owners and starting units. Odd width and height give the map a centre square,
// where the neutral central airfield stands.
//
// Run: node tools/maps/the-slot.mjs        then: node tools/maps/overview.mjs the-slot

import { writeFileSync } from "node:fs";

const W = 29;
const H = 37;
const rot = ([x, y]) => [W - 1 - x, H - 1 - y];

const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => "S"));
/** Sets a square and its rotation. */
const put = (x, y, ch) => {
  if (grid[y]?.[x] === undefined) throw new Error(`(${x}, ${y}) is off the map`);
  const [rx, ry] = rot([x, y]);
  grid[y][x] = ch;
  grid[ry][rx] = ch;
};
/** Stamps rows of text with their top-left corner at (x0, y0). A space leaves the square as it is. */
const stamp = (x0, y0, rows) => rows.forEach((row, dy) => [...row].forEach((ch, dx) => {
  if (ch !== " ") put(x0 + dx, y0 + dy, ch);
}));

// ---- The centre (neutral) ----

// The central island, mid-Slot, with the airfield on the centre square: its aircraft reach both halves.
// The Slot splits round it into two passages.
stamp(11, 18, [
  "_C.A.C_",
  " _.=F_ ",
  "  ___  ",
]);
// Two anchorages, out on the flanks level with the centre: neutral Ports on islets, for refuelling
// and repairing ships once taken. Each is the same distance from both HQs.
stamp(4, 18, [
  "_P",
  " _",
]);

// ---- The south (US); the north is the same turned round ----

// HQ island: the capital and its major port, two Ports facing up the Slot.
stamp(9, 31, [
  "  _P_=_P_  ",
  "_.F..=..F._",
  "_Ff=====CH_",
  " _.H.Q.F._ ",
  "  _______  ",
]);
// Secondary city, on the western chain. It faces the enemy's forward port across the map.
stamp(5, 22, [
  "  ___ ",
  " _C=._",
  "_F.=H_",
  "_HF=C_",
  " _.._ ",
  "  __  ",
]);
// Forward port, on the eastern chain, its Port looking out over the Slot.
stamp(18, 21, [
  " _P_ ",
  "_.=F_",
  "_F=C_",
  "_H.._",
  " ___ ",
]);
// Airstrip outpost: a lone airfield on an islet in the south-west ocean.
stamp(2, 28, [
  " __ ",
  "_A._",
  " __ ",
]);
// Wooded islets along the chains, to break up the coast.
stamp(8, 28, ["F_", "_ "]);
stamp(21, 27, ["_F", " _"]);
// Reefs out in the flanking oceans: open water for carriers, but slower going than the Slot,
// which is kept clear.
for (const [x, y] of [[1, 21], [2, 33], [5, 31], [24, 23], [26, 31], [27, 25]]) put(x, y, "r");

const rows = grid.map((r) => r.join(""));
for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
  const [rx, ry] = rot([x, y]);
  if (grid[y][x] !== grid[ry][rx]) throw new Error(`(${x}, ${y}) doesn't match its rotation`);
}

// ---- Properties ----

const P = {
  hq: [14, 34],
  factory: [11, 33],
  port1: [12, 31],
  port2: [16, 31],
  capital: [17, 33],
  city1: [7, 23],
  city2: [9, 25],
  forwardPort: [20, 21],
  forwardCity: [21, 23],
  airstrip: [3, 29],
};
const KIND = { hq: "Q", factory: "f", port1: "P", port2: "P", capital: "C", city1: "C", city2: "C", forwardPort: "P", forwardCity: "C", airstrip: "A" };
for (const [key, [x, y]] of Object.entries(P)) {
  if (grid[y][x] !== KIND[key]) throw new Error(`${key} at (${x}, ${y}) is ${grid[y][x]}, not ${KIND[key]}`);
}
const owners = Object.values(P).flatMap((p) => [[p, 0], [rot(p), 1]]);

// ---- Forces: identical, the north's turned round ----

const south = [
  // HQ island garrison.
  ["infantry", 13, 32], ["infantry", 15, 32], ["mediumTank", 13, 34], ["artillery", 15, 34], ["mobileAA", 10, 32],
  // The secondary city.
  ["infantry", 8, 24], ["infantry", 7, 24], ["flakGun", 7, 26],
  // The forward port.
  ["infantry", 19, 22], ["artillery", 20, 23],
  // The airstrip.
  ["infantry", 4, 29],
  // Two carrier groups, one out on each flank, each Carrier with a Fighter and a strike aircraft aboard.
  ["carrier", 2, 26, [{ type: "fighter" }, { type: "diveBomber" }]], ["destroyer", 3, 24],
  ["carrier", 25, 28, [{ type: "fighter" }, { type: "torpedoBomber" }]], ["destroyer", 24, 27],
  // The battle line at the mouth of the Slot.
  ["battleship", 12, 29], ["battleship", 16, 29], ["destroyer", 11, 27], ["destroyer", 17, 27],
  ["torpedoBoat", 13, 27], ["torpedoBoat", 15, 27],
  // Landing Craft off the ports, each with two Infantry aboard.
  ["landingCraft", 12, 30, [{ type: "infantry" }, { type: "infantry" }]],
  ["landingCraft", 16, 30, [{ type: "infantry" }, { type: "infantry" }]],
];
const unit = (owner, [type, x, y, cargo]) => {
  const [ux, uy] = owner === 0 ? [x, y] : rot([x, y]);
  return { type, owner, pos: { x: ux, y: uy }, ...(cargo ? { cargo } : {}) };
};
const units = [...south.map((u) => unit(0, u)), ...south.map((u) => unit(1, u))];

// Battle scenes put the side on the left facing right (08-art-pipeline §12).
const meanX = (owner) => units.filter((u) => u.owner === owner).reduce((s, u) => s + u.pos.x, 0) / south.length;
const usOnLeft = meanX(0) < meanX(1);

const buildable = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank", "tankDestroyer",
  "artillery", "rocketArtillery", "mobileAA", "flakGun", "fighter", "bomber", "transportAircraft", "diveBomber", "torpedoBomber",
  "battleship", "destroyer", "submarine", "landingCraft", "torpedoBoat", "carrier",
];

const scenario = {
  id: "the-slot",
  name: "The Slot",
  description: "An island campaign in the style of the Solomons, not a real battle. The US holds the south, Japan the north, with the same forces. A fast channel, the Slot, runs between the two capitals past a neutral island whose airfield covers both halves; open ocean on the flanks gives carriers room to strike from the side. Take the enemy's HQ.",
  map: rows,
  players: [
    { name: "US", nation: "us", funds: 5000, buildable, ...(usOnLeft ? {} : { facing: "left" }) },
    { name: "Japan", nation: "japan", funds: 5000, buildable, ...(usOnLeft ? { facing: "left" } : {}) },
  ],
  propertyOwners: owners.map(([[x, y], owner]) => ({ pos: { x, y }, owner })),
  units,
  victory: [{ type: "hqCapture" }, { type: "rout" }],
};

const out = new URL("../../src/scenarios/the-slot.json", import.meta.url);
// Short arrays on one line, as in the other scenario files.
const json = JSON.stringify(scenario, null, 2)
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+"pos": (\{[^}]*\}),\s+"owner": (\d+)\s+\}/g, '{ "pos": $1, "owner": $2 }')
  .replace(/\{\s+"type": ("\w+"),\s+"owner": (\d+),\s+"pos": (\{[^}]*\})\s+\}/g, '{ "type": $1, "owner": $2, "pos": $3 }')
  .replace(/\{\s+"type": ("\w+")\s+\}/g, '{ "type": $1 }');
writeFileSync(out, `${json}\n`);
console.log(rows.join("\n"));
console.log(`US on the ${usOnLeft ? "left" : "right"} (mean column ${meanX(0).toFixed(2)} vs ${meanX(1).toFixed(2)})`);
