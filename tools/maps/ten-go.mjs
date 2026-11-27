// Generates src/scenarios/ten-go.json: Operation Ten-Go, Yamato's sortie to Okinawa, April 1945
// (docs/14-scenarios-pacific.md §6).
//
// About 20 nautical miles a square, north up. The Bungo Strait, between Kyushu and Shikoku, is at the
// top right; Kyushu's south coast, Tanegashima and Yakushima below it; the Amami islands run south-west
// towards Okinawa at the bottom left. Okinawa is drawn far larger than life (about four times), as
// Midway's atoll is, so its land battle has room: the US beachhead at Yontan and Kadena on the west
// coast, the 32nd Army's line at Shuri to the south.
//
// The real battle was hopelessly one-sided, so Japan's goal is the beachhead, not the fleet battle:
// Japan wins by retaking both airfields, which the 32nd Army can only do with Yamato's guns in range.
// The US wins by holding them to the start of day 12. Always in fog of war, so the US has to find the
// fleet first. Japan's ships start with fuel to reach Okinawa, not to come home.
//
// Run: node tools/maps/ten-go.mjs        then: node tools/maps/overview.mjs ten-go

import { writeFileSync } from "node:fs";

const W = 22;
const H = 32;

const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => "S"));
const set = (x, y, ch) => {
  if (grid[y]?.[x] === undefined) throw new Error(`(${x}, ${y}) is off the map`);
  grid[y][x] = ch;
};
/** Stamps rows of text with their top-left corner at (x0, y0). A space leaves the square as it is. */
const stamp = (x0, y0, rows) => rows.forEach((row, dy) => [...row].forEach((ch, dx) => {
  if (ch !== " ") set(x0 + dx, y0 + dy, ch);
}));

// ---- Kyushu ----
// Japan's base in the north-east corner stands for Tokuyama and Kure, where the fleet sailed from, at
// the head of the Bungo Strait. Kanoya, the main kamikaze base, is on the Osumi peninsula in the south.
// Kagoshima Bay cuts in between the Satsuma and Osumi peninsulas.
stamp(10, 0, [
  "_FHFfQ",
  "_HFFCP",
  "_FHHF_",
  "_.HFF_",
  "_.FHF_",
  "_.=HF_",
  "__S.A_",
  " _S_._",
]);

// ---- Shikoku, the east side of the Bungo Strait, down to Cape Ashizuri ----
stamp(18, 0, [
  "_FHH",
  "_HHF",
  " _F_",
  "  _ ",
]);

// ---- Tanegashima and Yakushima, south of the Osumi Strait ----
stamp(14, 9, [
  "_",
  "F",
  "_",
]);
stamp(11, 10, [
  "_H",
  "__",
]);

// ---- The Tokara islands and the Amami islands, running south-west towards Okinawa ----
for (const [x, y] of [[10, 12], [11, 13]]) set(x, y, "r");
stamp(10, 14, [
  " __",
  "_FH_",
  " __ ",
]);
stamp(9, 17, ["_"]); // Tokunoshima
stamp(8, 18, ["r"]); // Okinoerabu's reef

// ---- Okinawa, drawn about four times life size ----
// The hills and forest of Kunigami in the north, the Motobu peninsula and Nago, the Ishikawa isthmus,
// the Hagushi beaches on the west coast with Yontan airfield to the north of the Bishi river and Kadena
// to the south, open ground, and the 32nd Army's bunker line on the Shuri heights, with Naha's harbor,
// at the south edge.
stamp(0, 19, [
  "       ___ ",
  "      _HHF_",
  "     _FHHF_",
  "  __FCHFF_ ",
  " _FHF.FF_  ",
  "  __..F_   ",
  "   _A..F_  ",
  "   _..=.F_ ",
  "   _A=..F_ ",
  "   _...FF_ ",
  "   _.=.F_  ",
  "  _XXXXH_  ",
  "  PHC..F_  ",
]);

// ---- The US base, in the south-east corner, standing for Ulithi ----
stamp(17, 27, [
  "  ___",
  " _P.f",
  " _.Q.",
  "  _C.",
  "   __",
]);

const rows = grid.map((r) => r.join(""));

// ---- Properties ----

const P = {
  yontan: [4, 25], // Yontan airfield: an objective
  kadena: [4, 27], // Kadena airfield: an objective
  shuri: [4, 31], // Shuri, the 32nd Army's headquarters
  naha: [2, 31], // Naha's harbor
  nago: [5, 22], // Nago: neutral
  kanoya: [14, 6], // Kanoya airfield
  jpHq: [15, 0], jpFactory: [14, 0], jpPort: [15, 1], jpCity: [14, 1],
  usHq: [20, 29], usFactory: [21, 28], usPort: [19, 28], usCity: [20, 30],
};
const KIND = {
  yontan: "A", kadena: "A", shuri: "C", naha: "P", nago: "C", kanoya: "A",
  jpHq: "Q", jpFactory: "f", jpPort: "P", jpCity: "C", usHq: "Q", usFactory: "f", usPort: "P", usCity: "C",
};
for (const [key, [x, y]] of Object.entries(P)) {
  if (grid[y][x] !== KIND[key]) throw new Error(`${key} at (${x}, ${y}) is ${grid[y][x]}, not ${KIND[key]}`);
}
const US = 0;
const JAPAN = 1;
const owners = [
  [P.jpHq, JAPAN], [P.jpFactory, JAPAN], [P.jpPort, JAPAN], [P.jpCity, JAPAN], [P.kanoya, JAPAN], [P.shuri, JAPAN], [P.naha, JAPAN],
  [P.usHq, US], [P.usFactory, US], [P.usPort, US], [P.usCity, US], [P.yontan, US], [P.kadena, US],
];

// ---- Forces, the evening of 6 April 1945 ----

const unit = (owner) => (type, x, y, extra = {}) => {
  const { cargo, ...rest } = extra;
  return { type, owner, pos: { x, y }, ...rest, ...(cargo ? { cargo: cargo.map((t) => ({ type: t })) } : {}) };
};
const us = unit(US);
const jp = unit(JAPAN);

// Fuel for the trip out: enough to reach gun range of the beachhead with a few days to spare, not to
// come home.
const BATTLESHIP_FUEL = 45;
const DESTROYER_FUEL = 50;

const units = [
  // ---- Japan ----
  // The Surface Special Attack Force, leaving the Bungo Strait: Yamato and its screen (Yahagi and the
  // eight destroyers, paired up; the game has no Cruiser).
  jp("battleship", 16, 2, { fuel: BATTLESHIP_FUEL }), // Yamato
  jp("destroyer", 17, 2, { fuel: DESTROYER_FUEL }), // Yahagi
  jp("destroyer", 16, 3, { fuel: DESTROYER_FUEL }),
  jp("destroyer", 17, 1, { fuel: DESTROYER_FUEL }),
  jp("destroyer", 16, 1, { fuel: DESTROYER_FUEL }),
  // Kanoya: the only fighters that could have covered the fleet. Historically almost none did.
  jp("fighter", 14, 6), jp("fighter", 14, 5),
  // The 32nd Army on the Shuri line, garrisoning a row of bunkers with its guns on the heights behind:
  // strong enough to hold, not to break through alone. It held Shuri for two months.
  jp("infantry", 3, 30), jp("infantry", 4, 30), jp("infantry", 5, 30), jp("assaultInfantry", 6, 30),
  jp("mortar", 3, 31), jp("artillery", 4, 31), jp("artillery", 6, 31), jp("infantry", 5, 31),
  // The home garrison.
  jp("infantry", 14, 1),

  // ---- US ----
  // Task Force 58, east of the Amami islands, out of reach of Kanoya's fighters and of the Bungo
  // Strait. Each Carrier's two aircraft stand for its whole air group.
  us("carrier", 17, 14, { cargo: ["diveBomber", "torpedoBomber"] }),
  us("carrier", 18, 15, { cargo: ["fighter", "torpedoBomber"] }),
  us("carrier", 16, 16, { cargo: ["fighter", "diveBomber"] }),
  us("battleship", 18, 13), us("destroyer", 16, 14), us("destroyer", 19, 15), us("destroyer", 17, 17),
  // Off the Hagushi beaches: Admiral Deyo's old battleships, ready to meet Yamato if the aircraft
  // failed, the destroyer screen, the transports and the supply ships.
  us("battleship", 1, 25), us("destroyer", 1, 27),
  us("landingCraft", 2, 26, { cargo: ["infantry"] }), us("supplyShip", 2, 27),
  // Ashore: the beachhead at Yontan and Kadena.
  us("infantry", 4, 25), us("infantry", 4, 27), us("infantry", 5, 27),
  us("mediumTank", 5, 26), us("mediumTank", 6, 27), us("artillery", 5, 25),
  us("flakGun", 6, 26),
  // Submarines on picket south of the Bungo Strait: Threadfin and Hackleback, which saw the fleet
  // leave. They start just out of torpedo reach, close enough to see it come out.
  us("submarine", 17, 10), us("submarine", 20, 7),
  // The home garrison at Ulithi.
  us("infantry", 21, 29),
];

// ---- Build lists ----
// Both sides: everything but the Heavy Tank (01-units §1).
const buildable = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "supplyTruck", "lightTank", "mediumTank", "tankDestroyer",
  "artillery", "rocketArtillery", "mobileAA", "flakGun", "fighter", "bomber", "transportAircraft", "diveBomber", "torpedoBomber",
  "battleship", "destroyer", "submarine", "landingCraft", "torpedoBoat", "carrier", "supplyShip",
];

const scenario = {
  id: "ten-go",
  name: "Ten-Go",
  description: "April 1945. The US has landed on Okinawa and taken the Yontan and Kadena airfields. Japan sends the battleship Yamato and its last destroyers, with no air cover and fuel for one way, to shell the beachhead while the 32nd Army counter-attacks. Always in fog of war: US carrier aircraft must find the fleet before it arrives. Japan wins by retaking both airfields; the US wins by holding them to the start of day 12.",
  map: rows,
  players: [
    { name: "US", nation: "us", funds: 2000, buildable, facing: "left" },
    { name: "Japan", nation: "japan", funds: 2000, buildable },
  ],
  propertyOwners: owners.map(([[x, y], owner]) => ({ pos: { x, y }, owner })),
  units,
  victory: [
    { type: "hqCapture" },
    { type: "rout" },
    { type: "captureProperties", side: "axis", properties: [P.yontan, P.kadena].map(([x, y]) => ({ x, y })) },
    { type: "surviveDays", side: "allies", days: 12 },
  ],
  // Always played in fog of war: the US has to find the fleet (19-fog-of-war §1).
  settings: { incomePerProperty: 500, fogOfWar: true },
  // Low cloud on day 4, standing for the overcast of 7 April: with fog already on, rain's effect is
  // that every unit sees 1 square less (12-weather §3a).
  weather: {
    season: "summer",
    forecast: [
      { fromDay: 1, weather: "clear" },
      { fromDay: 4, weather: "rain" },
      { fromDay: 5, weather: "clear" },
    ],
  },
};

const out = new URL("../../src/scenarios/ten-go.json", import.meta.url);
// Short arrays on one line, as in the other scenario files.
const json = JSON.stringify(scenario, null, 2)
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+"pos": (\{[^}]*\}),\s+"owner": (\d+)\s+\}/g, '{ "pos": $1, "owner": $2 }')
  .replace(/\{\s+"type": ("\w+"),\s+"owner": (\d+),\s+"pos": (\{[^}]*\})\s+\}/g, '{ "type": $1, "owner": $2, "pos": $3 }')
  .replace(/\{\s+"type": ("\w+")\s+\}/g, '{ "type": $1 }')
  .replace(/\{\s+("fromDay": \d+),\s+("weather": "[a-z]+")\s+\}/g, "{ $1, $2 }");
writeFileSync(out, `${json}\n`);

const unitAt = new Map(units.map((u) => [`${u.pos.x},${u.pos.y}`, u.owner === US ? "u" : "j"]));
console.log(rows.map((row, y) => `${String(y).padStart(2)} ${[...row].map((ch, x) => unitAt.get(`${x},${y}`) ?? ch).join("")}`).join("\n"));
