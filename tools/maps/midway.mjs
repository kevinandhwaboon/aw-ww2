// Generates src/scenarios/midway.json: the Battle of Midway, 4 June 1942 (docs/14-scenarios-pacific.md §3).
//
// A theater map of open ocean, about 30 nautical miles a square, so a carrier strike (launch, fly 6,
// attack the next square) reaches about 7 squares, roughly the real 200 miles. Midway atoll is drawn
// far larger than life (it's under a square across in truth) so it has room for its two islands,
// its lagoon and its reef. North is up.
//
// The US moves first, as every built-in map puts the US first (it's the army green player): its day-1
// turn stands for the night before the battle and the dawn searches. Japan's four carriers start
// within strike range of Midway, so Japan's first turn is the dawn strike, and the three US carriers
// wait north-east of the atoll ("Point Luck"), one move from striking range. Nothing can reach either
// side's carriers from where the units start, and Midway's aircraft can't reach the Japanese ones.
//
// Run: node tools/maps/midway.mjs        then: node tools/maps/overview.mjs midway

import { writeFileSync } from "node:fs";

const W = 40;
const H = 28;

const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => "S"));
const set = (x, y, ch) => {
  if (grid[y]?.[x] === undefined) throw new Error(`(${x}, ${y}) is off the map`);
  grid[y][x] = ch;
};
/** Stamps rows of text with their top-left corner at (x0, y0). A space leaves the square as it is. */
const stamp = (x0, y0, rows) => rows.forEach((row, dy) => [...row].forEach((ch, dx) => {
  if (ch !== " ") set(x0 + dx, y0 + dy, ch);
}));

// ---- Midway atoll ----
// A ring of reef round the lagoon, open to the south by a channel between the two islands: Sand
// Island to the west (the Marine command post and the harbor, where the seaplanes and PT boats
// were) and Eastern Island to the east (the airstrip). Beaches all round: the invasion can come
// ashore anywhere. Ships cross the reef at double cost.
const ATOLL = [21, 13];
stamp(...ATOLL, [
  " rrrrrr ",
  "rSSSSSSr",
  "_.X_S_X_",
  "_C.PS.A_",
  "__._S__ ",
  " ___S   ",
]);

// Kure Atoll, a reef and a sandbar two squares west-north-west of Midway, on the invasion's way in.
stamp(16, 12, [
  " r ",
  "r_r",
  " r ",
]);

// The Northwestern Hawaiian Islands, a broken chain of reefs and sandy islets running from Midway
// towards Pearl Harbor in the south-east corner: Pearl and Hermes Reef, Lisianski, Laysan, Maro
// Reef and French Frigate Shoals, much compressed.
for (const [x, y] of [[30, 18], [31, 18], [32, 20], [34, 21], [35, 21], [33, 23], [36, 19]]) set(x, y, "r");
stamp(32, 19, ["_"]);
stamp(33, 21, ["_"]);
stamp(34, 22, ["_"]);

// ---- The bases ----
// Japan's base in the south-west corner stands for the forward bases at Wake and Saipan, the US
// base in the south-east corner for Pearl Harbor. Both are far closer than the real ones; they give
// each side an HQ and somewhere to build. Japan gets no airfield: its carrier air groups were
// irreplaceable, and it can only fly from Midway's airstrip once it takes it.
stamp(0, 21, [
  "___  ",
  ".fP_ ",
  ".Q.__",
  "FC.._",
  "...F_",
  "F.___",
  "___  ",
]);
stamp(35, 21, [
  "   __",
  "  _P.",
  " __.f",
  " _.Q.",
  "  _CF",
  "   _.",
  "   __",
]);

const rows = grid.map((r) => r.join(""));

// ---- Properties ----

const P = {
  sandCity: [22, 16], // The Marine command post on Sand Island: an objective
  sandPort: [24, 16], // Sand Island's harbor and seaplane base
  airfield: [27, 16], // Eastern Island's airstrip: an objective
  jpHq: [1, 23], jpFactory: [1, 22], jpPort: [2, 22], jpCity: [1, 24],
  usHq: [38, 24], usFactory: [39, 23], usPort: [38, 22], usCity: [38, 25],
};
const KIND = { sandCity: "C", sandPort: "P", airfield: "A", jpHq: "Q", jpFactory: "f", jpPort: "P", jpCity: "C", usHq: "Q", usFactory: "f", usPort: "P", usCity: "C" };
for (const [key, [x, y]] of Object.entries(P)) {
  if (grid[y][x] !== KIND[key]) throw new Error(`${key} at (${x}, ${y}) is ${grid[y][x]}, not ${KIND[key]}`);
}
const US = 0;
const JAPAN = 1;
const owners = [
  [P.jpHq, JAPAN], [P.jpFactory, JAPAN], [P.jpPort, JAPAN], [P.jpCity, JAPAN],
  [P.usHq, US], [P.usFactory, US], [P.usPort, US], [P.usCity, US],
  [P.sandCity, US], [P.sandPort, US], [P.airfield, US],
];

// ---- Forces ----
// Each Carrier's two aircraft stand for its whole air group.

const jp = (type, x, y, cargo) => ({ type, owner: JAPAN, pos: { x, y }, ...(cargo ? { cargo: cargo.map((t) => ({ type: t })) } : {}) });
const us = (type, x, y, cargo) => ({ type, owner: US, pos: { x, y }, ...(cargo ? { cargo: cargo.map((t) => ({ type: t })) } : {}) });

const units = [
  // The Kido Butai, Nagumo's carrier striking force, north-west of Midway at dawn: every Carrier's
  // strike aircraft can reach Sand Island, but none of Midway's aircraft or PT boats can reach the
  // carriers on day 1. Their Torpedo Bombers can't hit land: they're the reserve, held back for ships.
  jp("carrier", 20, 11, ["fighter", "torpedoBomber"]), // Akagi
  jp("carrier", 21, 10, ["diveBomber", "torpedoBomber"]), // Kaga
  jp("carrier", 19, 12, ["fighter", "diveBomber"]), // Soryu
  jp("carrier", 22, 9, ["diveBomber", "torpedoBomber"]), // Hiryu
  jp("battleship", 19, 10), jp("battleship", 21, 8), // Haruna, Kirishima: out of gun range of Midway
  jp("destroyer", 21, 12), jp("destroyer", 23, 10), jp("destroyer", 18, 10), // Tone, Chikuma and the screen
  // The Main Body, Yamamoto's battleships, two days behind.
  jp("battleship", 11, 5), jp("battleship", 12, 4), jp("destroyer", 13, 5),
  // The invasion force from the south-west: transports with the landing troops, a battleship and
  // destroyers for the bombardment.
  jp("landingCraft", 8, 19, ["infantry", "assaultInfantry"]),
  jp("landingCraft", 9, 20, ["infantry", "assaultInfantry"]),
  jp("landingCraft", 8, 21, ["infantry", "infantry"]),
  jp("battleship", 7, 20), jp("destroyer", 10, 19), jp("destroyer", 10, 21),
  // I-168, on the way between Pearl Harbor and Midway. It later sank the Yorktown.
  jp("submarine", 30, 22),
  // The home garrison.
  jp("infantry", 2, 23),

  // Task Force 16 (Enterprise, Hornet) and Task Force 17 (Yorktown) at Point Luck, north-east of
  // Midway. Enterprise's Dive Bombers sank Akagi and Kaga, Yorktown's sank Soryu; Hornet's Torpedo
  // Bombers (Torpedo 8) found the enemy first and were cut down.
  us("carrier", 31, 6, ["diveBomber", "diveBomber"]), // Enterprise
  us("carrier", 32, 7, ["fighter", "torpedoBomber"]), // Hornet
  us("carrier", 29, 4, ["diveBomber", "torpedoBomber"]), // Yorktown
  us("destroyer", 30, 7), us("destroyer", 33, 6), us("destroyer", 30, 3), // cruisers and destroyers
  // Midway's own air group, on Eastern Island: Marine fighters, B-17s, Marine dive bombers and the
  // new Avengers.
  us("fighter", 27, 16), us("bomber", 28, 15), us("diveBomber", 28, 16), us("torpedoBomber", 26, 17),
  // The 6th Marine Defense Battalion: riflemen in the bunkers and the command post, the coastal
  // guns (Artillery) and the anti-aircraft guns (Flak).
  us("infantry", 23, 15), us("infantry", 22, 16), us("infantry", 27, 15),
  us("artillery", 22, 15), us("flakGun", 26, 16),
  // PT boats at the Sand Island harbor.
  us("torpedoBoat", 24, 16),
  // Submarines on picket: Nautilus north-east of the Japanese carriers, and another west of Midway
  // on the invasion's way in.
  us("submarine", 27, 6), us("submarine", 17, 18),
  // The home garrison at Pearl Harbor.
  us("infantry", 37, 24),
];

// ---- Day-1 reach, printed for tuning ----
// An attack reaches movement + range for units that can move and fire, and just the range for
// those that can't (Artillery, Battleships). An aircraft aboard a Carrier launches from its square.
const STATS = {
  fighter: [9, 1], bomber: [7, 1], diveBomber: [6, 1], torpedoBomber: [6, 1], battleship: [0, 6], destroyer: [6, 1],
  submarine: [5, 1], torpedoBoat: [7, 1], infantry: [3, 1], assaultInfantry: [2, 1], artillery: [0, 3], flakGun: [0, 5],
};
const reach = (type) => (STATS[type] ? STATS[type][0] + STATS[type][1] : 0);
const dist = (a, b) => Math.abs(a.x - b.x) + Math.abs(a.y - b.y);
const strikers = (owner) => units.filter((u) => u.owner === owner).flatMap((u) => [u, ...(u.cargo ?? []).map((c) => ({ ...c, owner, pos: u.pos }))]);
const report = (target) => {
  const threats = strikers(1 - target.owner).filter((a) => dist(a.pos, target.pos) <= reach(a.type));
  return threats.map((a) => `${a.type}@${a.pos.x},${a.pos.y}`).join(" ");
};

const buildable = (extra) => [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "lightTank", "mediumTank", "tankDestroyer",
  "artillery", "rocketArtillery", "mobileAA", "flakGun", "fighter", "bomber", "transportAircraft", "diveBomber", "torpedoBomber",
  "battleship", "destroyer", "submarine", "landingCraft", "torpedoBoat", "carrier",
].filter((t) => !extra.includes(t));

const scenario = {
  id: "midway",
  name: "Midway",
  description: "June 1942. Japan's four carriers close on Midway to strike it at dawn and clear the way for an invasion, but three US carriers are waiting to the north-east. Japan wins by taking Midway's command post and airfield; the US wins by holding Midway to the start of day 12. Whichever carriers move into striking range first are the ones exposed.",
  map: rows,
  players: [
    { name: "US", nation: "us", funds: 2000, buildable: buildable(["heavyTank"]), facing: "left" },
    { name: "Japan", nation: "japan", funds: 2000, buildable: buildable(["heavyTank"]) },
  ],
  propertyOwners: owners.map(([[x, y], owner]) => ({ pos: { x, y }, owner })),
  units,
  victory: [
    { type: "hqCapture" },
    { type: "rout" },
    { type: "captureProperties", side: "axis", properties: [P.sandCity, P.airfield].map(([x, y]) => ({ x, y })) },
    { type: "surviveDays", side: "allies", days: 12 },
  ],
  settings: { incomePerProperty: 500 },
};

const out = new URL("../../src/scenarios/midway.json", import.meta.url);
// Short arrays on one line, as in the other scenario files.
const json = JSON.stringify(scenario, null, 2)
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+"pos": (\{[^}]*\}),\s+"owner": (\d+)\s+\}/g, '{ "pos": $1, "owner": $2 }')
  .replace(/\{\s+"type": ("\w+"),\s+"owner": (\d+),\s+"pos": (\{[^}]*\})\s+\}/g, '{ "type": $1, "owner": $2, "pos": $3 }')
  .replace(/\{\s+"type": ("\w+")\s+\}/g, '{ "type": $1 }');
writeFileSync(out, `${json}\n`);
console.log(rows.join("\n"));
if (process.argv.includes("--reach")) {
  for (const u of units) {
    const threats = report(u);
    if (threats) console.log(`${u.owner === JAPAN ? "JP" : "US"} ${u.type}@${u.pos.x},${u.pos.y} <- ${threats}`);
  }
}
