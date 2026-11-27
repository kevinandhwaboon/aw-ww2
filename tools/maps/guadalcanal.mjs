// Generates src/scenarios/guadalcanal.json: Guadalcanal, October 1942 (docs/14-scenarios-pacific.md §4).
//
// About 5 km a square, north up. Guadalcanal's north coast from Cape Esperance to Koli Point is drawn
// to scale; everything further away is pulled in. The Slot, the channel down which Japan ran its
// destroyer convoys (the "Tokyo Express"), comes in from the west between Santa Isabel and the New
// Georgia islands instead of from the north-west, and Japan's base at its far end stands for the
// Shortlands, Buin and Rabaul. The US base in the south-east corner stands for Espiritu Santo and
// Nouméa. Ironbottom Sound lies between Guadalcanal and the Florida Islands, with Tulagi on their
// south shore and Savo Island at its western mouth.
//
// The map is about supply. The US holds Henderson Field with no port on Guadalcanal: its ships refuel
// at Tulagi, one at a time, or at a Supply Ship off Lunga Point. Japan's ships are four or five days'
// sailing from home: its convoy brings a Supply Ship, and Rekata Bay on Santa Isabel is a neutral port
// half way down the Slot for whoever takes it.
//
// Run: node tools/maps/guadalcanal.mjs        then: node tools/maps/overview.mjs guadalcanal

import { writeFileSync } from "node:fs";

const W = 42;
const H = 24;

const grid = Array.from({ length: H }, () => Array.from({ length: W }, () => "S"));
const set = (x, y, ch) => {
  if (grid[y]?.[x] === undefined) throw new Error(`(${x}, ${y}) is off the map`);
  grid[y][x] = ch;
};
/** Stamps rows of text with their top-left corner at (x0, y0). A space leaves the square as it is. */
const stamp = (x0, y0, rows) => rows.forEach((row, dy) => [...row].forEach((ch, dx) => {
  if (ch !== " ") set(x0 + dx, y0 + dy, ch);
}));

// ---- Japan's base, at the far end of the Slot: the Shortlands, Buin and Rabaul ----
stamp(0, 0, [
  "FFHF__",
  "F__   ",
  "_     ",
]);
stamp(0, 5, [
  "___  ",
  "F.._ ",
  "fQ.P ",
  "CA.._",
  "F.F._",
  "HF._ ",
  "___  ",
]);

// ---- Santa Isabel, the north side of the Slot, with Rekata Bay's seaplane anchorage ----
stamp(7, 0, [
  "_FFFHHHFFFFFHHFFF_",
  "__FFHHFFFF.FFFF__ ",
  "  __FF.._.FF___   ",
  "     ___P__       ",
]);

// ---- The New Georgia islands, the south side of the Slot, and the Russell Islands ----
stamp(0, 14, [
  "__     ",
  "FF_    ",
  "HFF_   ",
  "FHFF__ ",
  "FFHFFF_",
  "_FFHF_ ",
  " __F_  ",
  "   _   ",
]);
stamp(8, 15, [
  "_F_",
  " _ ",
]);

// ---- Savo Island, at the western mouth of Ironbottom Sound ----
stamp(13, 9, [
  " _ ",
  "_H_",
  " _ ",
]);

// ---- The Florida Islands, with Tulagi's anchorage and PT-boat base on their south shore ----
stamp(21, 4, [
  "   __FF_   ",
  " __FFHHF__ ",
  "_FFHHF.F.__",
  " __F..F__  ",
  "   ___     ",
  "     P     ",
]);

// ---- Malaita, across Indispensable Strait ----
stamp(35, 0, [
  "_FFFHFF",
  "_FHHFF_",
  "__FHF_ ",
  " _FF_  ",
  "  __   ",
]);

// ---- Guadalcanal ----
// The north coast: Cape Esperance at the west tip, Tassafaronga's beaches where Japan landed, Kokumbona
// (Japan's headquarters on the island) and Point Cruz, the Matanikau River, the US perimeter round
// Lunga Point and Henderson Field, the Lunga River, Edson's Ridge south of the airfield, the Tenaru
// (Alligator Creek), and Koli Point. The coast track is a road, bridged over the Matanikau and the
// Lunga. Jungle and the mountains of the interior run down to the south coast.
stamp(11, 13, [
  " ________~_             ",
  " F====C==#=___~___      ",
  " FF.F....~=C==#===____  ",
  " FHFFF.FF~X..F~A..~.CF_ ",
  " _FHFFFHH~XF..~d.F~F.F_ ",
  "  _FHHFFH~FFHF~dFF~FFF._",
  "   _HHFHHHHFHHFHFFFHFF_ ",
  "    _HHHHFHHHHHHFHHF__  ",
  "      __FHHFFHHHFF__    ",
  "        ________        ",
]);

// ---- The US base, standing for Espiritu Santo and Nouméa ----
stamp(37, 17, [
  "  ___",
  " _.F.",
  "P.fQ.",
  "_.A.C",
  " _F.F",
  "  _H.",
  "   __",
]);

const rows = grid.map((r) => r.join(""));

// ---- Properties ----

const P = {
  henderson: [26, 16], // Henderson Field: the objective
  lunga: [22, 15], // The Marine perimeter at Lunga Point
  tulagi: [26, 9], // Tulagi: the US anchorage and PT-boat base
  kokumbona: [17, 14], // Japan's headquarters on Guadalcanal
  koli: [31, 16], // Koli Point: neutral
  rekata: [15, 3], // Rekata Bay: a neutral port half way down the Slot
  jpHq: [1, 7], jpFactory: [0, 7], jpPort: [3, 7], jpCity: [0, 8], jpAirfield: [1, 8],
  usHq: [40, 19], usFactory: [39, 19], usPort: [37, 19], usCity: [41, 20], usAirfield: [39, 20],
};
const KIND = {
  henderson: "A", lunga: "C", tulagi: "P", kokumbona: "C", koli: "C", rekata: "P",
  jpHq: "Q", jpFactory: "f", jpPort: "P", jpCity: "C", jpAirfield: "A",
  usHq: "Q", usFactory: "f", usPort: "P", usCity: "C", usAirfield: "A",
};
for (const [key, [x, y]] of Object.entries(P)) {
  if (grid[y][x] !== KIND[key]) throw new Error(`${key} at (${x}, ${y}) is ${grid[y][x]}, not ${KIND[key]}`);
}
const US = 0;
const JAPAN = 1;
const owners = [
  [P.jpHq, JAPAN], [P.jpFactory, JAPAN], [P.jpPort, JAPAN], [P.jpCity, JAPAN], [P.jpAirfield, JAPAN], [P.kokumbona, JAPAN],
  [P.usHq, US], [P.usFactory, US], [P.usPort, US], [P.usCity, US], [P.usAirfield, US],
  [P.henderson, US], [P.lunga, US], [P.tulagi, US],
];

// ---- Forces, mid-October 1942 ----

const unit = (owner) => (type, x, y, extra = {}) => {
  const { cargo, ...rest } = extra;
  return { type, owner, pos: { x, y }, ...rest, ...(cargo ? { cargo: cargo.map((t) => ({ type: t })) } : {}) };
};
const us = unit(US);
const jp = unit(JAPAN);

const units = [
  // ---- US ----
  // The Cactus Air Force at Henderson Field: Marine Wildcats and Dauntlesses.
  us("fighter", 26, 16), us("diveBomber", 27, 17),
  // The 1st Marine Division's perimeter: the Matanikau line, Lunga Point, Edson's Ridge, the 11th
  // Marines' guns (short of shells: one is on the beach for the Supply Ship to refill) and the
  // 90mm anti-aircraft guns by the airfield.
  us("infantry", 21, 16), us("infantry", 21, 17), us("infantry", 22, 15), us("infantry", 26, 17),
  us("assaultInfantry", 23, 16), us("mortar", 22, 17),
  us("artillery", 22, 16, { ammo: 3 }), us("artillery", 24, 14, { ammo: 2 }),
  us("lightTank", 27, 15), us("flakGun", 27, 16),
  // Off Lunga Point: the cargo ships unloading (a Supply Ship), the Army's 164th Infantry arriving
  // (a Landing Craft), and their destroyer screen.
  us("supplyShip", 24, 13), us("landingCraft", 27, 13, { cargo: ["infantry", "infantry"] }),
  us("destroyer", 22, 12), us("destroyer", 29, 13),
  // Task Force 64 coming up the channel from the south-east: Washington and its escort.
  us("battleship", 35, 14), us("destroyer", 36, 15),
  // Tulagi: PT boats and the garrison.
  us("torpedoBoat", 26, 9), us("torpedoBoat", 27, 10), us("infantry", 25, 8),
  // Espiritu Santo: the B-17s, and a garrison.
  us("bomber", 39, 20), us("infantry", 38, 18),

  // ---- Japan ----
  // The 17th Army round Kokumbona and Point Cruz, west of the Matanikau: the Sendai Division's
  // infantry, a tank company, the mortars, and the 150mm howitzers ("Pistol Pete") within range of
  // the Marines' Matanikau line.
  jp("infantry", 17, 14), jp("infantry", 18, 15), jp("infantry", 19, 17), jp("infantry", 15, 14),
  jp("assaultInfantry", 19, 14), jp("lightTank", 16, 14), jp("mortar", 19, 16),
  jp("artillery", 19, 15), jp("artillery", 18, 16),
  // The Sendai Division's main attack, cut through the jungle along the Maruyama Road to strike the
  // perimeter from the south, at Edson's Ridge, as on 24-25 October.
  jp("infantry", 22, 19), jp("infantry", 24, 19), jp("infantry", 27, 19), jp("assaultInfantry", 25, 19), jp("mortar", 23, 19),
  // Kawaguchi's and Shoji's men east of the perimeter, towards Koli Point.
  jp("infantry", 32, 17), jp("infantry", 32, 16),
  // The Tokyo Express off the Russells, a night's run from Guadalcanal: destroyers, two transports
  // with reinforcements, and a Supply Ship for the destroyers' fuel and the troops' rations and shells.
  // The destroyers have already come down the Slot and are short of fuel.
  jp("destroyer", 10, 12, { fuel: 36 }), jp("destroyer", 11, 10, { fuel: 36 }),
  jp("landingCraft", 11, 11, { fuel: 20, cargo: ["infantry", "artillery"] }),
  jp("landingCraft", 12, 12, { fuel: 20, cargo: ["infantry", "assaultInfantry"] }),
  jp("supplyShip", 9, 11),
  // The bombardment force: Kongō and Haruna, which shelled Henderson Field on the night of 13 October,
  // with a destroyer, north of Savo.
  // One day's sailing from range of the airfield: they close in on Japan's first turn and fire on its second.
  jp("battleship", 20, 11, { fuel: 60 }), jp("battleship", 21, 10, { fuel: 60 }), jp("destroyer", 19, 10, { fuel: 40 }),
  // A submarine on the US supply route, as I-19 and I-26 were.
  jp("submarine", 35, 17),
  // Rabaul's air groups: Zeros and Bettys, a long flight from Guadalcanal. A home garrison.
  jp("fighter", 1, 8), jp("bomber", 2, 8), jp("infantry", 2, 7),
];

// ---- Build lists ----
// Both sides: everything but the Heavy Tank, which neither fielded here (01-units §1).
const buildable = [
  "infantry", "assaultInfantry", "mortar", "recon", "halftrack", "supplyTruck", "lightTank", "mediumTank", "tankDestroyer",
  "artillery", "rocketArtillery", "mobileAA", "flakGun", "fighter", "bomber", "transportAircraft", "diveBomber", "torpedoBomber",
  "battleship", "destroyer", "submarine", "landingCraft", "torpedoBoat", "carrier", "supplyShip",
];

const scenario = {
  id: "guadalcanal",
  name: "Guadalcanal",
  description: "October 1942. The Marines hold Henderson Field, but there's no port on Guadalcanal: every shell and every drop of fuel comes by sea. Japan runs troops down the Slot by night and sends its battleships to shell the airfield. Japan wins by taking Henderson Field; the US wins by holding it to the start of day 15. Supply Ships keep a fleet at sea.",
  map: rows,
  players: [
    { name: "US", nation: "us", funds: 3000, buildable, facing: "left" },
    { name: "Japan", nation: "japan", funds: 3000, buildable },
  ],
  propertyOwners: owners.map(([[x, y], owner]) => ({ pos: { x, y }, owner })),
  units,
  victory: [
    { type: "hqCapture" },
    { type: "rout" },
    { type: "captureProperties", side: "axis", properties: [P.henderson].map(([x, y]) => ({ x, y })) },
    { type: "surviveDays", side: "allies", days: 15 },
  ],
  settings: { incomePerProperty: 500 },
};

const out = new URL("../../src/scenarios/guadalcanal.json", import.meta.url);
// Short arrays on one line, as in the other scenario files.
const json = JSON.stringify(scenario, null, 2)
  .replace(/\{\s+"x": (\d+),\s+"y": (\d+)\s+\}/g, '{ "x": $1, "y": $2 }')
  .replace(/\{\s+"pos": (\{[^}]*\}),\s+"owner": (\d+)\s+\}/g, '{ "pos": $1, "owner": $2 }')
  .replace(/\{\s+"type": ("\w+"),\s+"owner": (\d+),\s+"pos": (\{[^}]*\})\s+\}/g, '{ "type": $1, "owner": $2, "pos": $3 }')
  .replace(/\{\s+"type": ("\w+")\s+\}/g, '{ "type": $1 }');
writeFileSync(out, `${json}\n`);
console.log(rows.join("\n"));
