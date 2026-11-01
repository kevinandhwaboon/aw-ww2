// US unit roster. Land units are approved. Air and naval units are first drafts, not yet exported to sheets.
import {
  blank, compose, halfTracks, howitzerTrail, howitzerWheel, mortarTube, shortTracks, stack, swaying,
  tankTracks, validate, vehicle,
} from "./sprite-kit.mjs";

const SIZE = 16;
const pad = (rows, n) => [...Array(n - rows.length).fill(blank), ...rows];

const jeepWheels = [
  [".KDDSDSKKKKDDDK.", "..KKK......KKK..", ".KWWWK....KWWWK.", ".KWhWK....KWhWK.", "..KKK......KKK.."],
  [".KDDSDSKKKKDDDK.", "..KKK......KKK..", ".KhWWK....KhWWK.", ".KWWhK....KWWhK.", "..KKK......KKK.."],
];

// The turret traverses: its guns point up and forward, then up and back.
const aaGunsRight = ["............K.K.", "...........K.K..", "..........K.K..."];
const aaGunsLeft = [".K.K............", "..K.K...........", "...K.K.........."];
const aaHull = [
  "......KKKKKK....", "..KKKKKLLMKKK...", ".KDDDDDDDDLLKKK.", ".KLLLLSLLLLLLLLK",
  ".KMSSSSSMMMMMMLK", ".KMMSSSMMMMMMMDK", ".KDDSDSDDDDDDDDK",
];

const helmet = [".....KKKK.......", "....KLLLLK......", "....KMMMMLK.....", "...KKKKKKKK....."];
const walkA = ["....KMMDMK......", "....KMKKMK......", "...KKKK.KKKK...."];
const walkB = ["....KMMDMK......", "...KMK..KMK.....", "..KKKK...KKKK..."];

function onFoot(upper) {
  return [stack([...upper, ...walkA]), stack([...upper, ...walkB])];
}

const mortarAim = [
  ".KKKK...........", "KLLLLK..........", "KMMMMLK.........", "KKKKKKKK........",
  "..KooKoK........", "..KoooK.........", ".KLMMMooK.......", ".KMMDMKK........",
  ".KMMKMMK........", ".KMMKKMMK.......", ".KKKKKKKK.......",
];
const mortarDuck = [
  "...KKKK.........", "..KLLLLK........", "..KMMMMLK.......", ".KKKKKKKKK......",
  ".KLLKoooK.......", "KLMMMMooK.......", "KMMDMMKK........", "KKKKKKKK........",
];

const howitzerBarrel = [
  ".............KKK", "..........KKKLLK", ".......KKKLLLMMK", ".....KKLLLMMMKKK",
  "....KLLLMMMKKK..", "....KMMMKKK.....", "....KKKK........",
  blank, blank, blank, blank, blank, blank, blank,
];
const howitzerShield = [
  "...........K....", "..........KMK...", "..........KMK...", "..........KDK...",
  "..........KDK...", "..........KDK...", blank, blank, blank, blank, blank, blank,
];
// An aircraft: whole plane bobs, propeller blur swaps between long and short.
function aircraft(body, propA, propB) {
  const plane = pad(body, 13);
  const at = (rows, y) => [...Array(y).fill(blank), ...rows, ...Array(SIZE - y - rows.length).fill(blank)];
  return [
    compose({ grid: at(plane, 2) }, { grid: at(propA, 2) }),
    compose({ grid: at(plane, 1) }, { grid: at(propB, 1) }),
  ];
}

// A ship: hull rocks 1px, foam along the waterline swaps.
function ship(body, foamA, foamB) {
  const hull = stack(body);
  return [
    compose({ grid: hull }, { grid: stack(foamA) }),
    compose({ grid: hull, dy: -1 }, { grid: stack(foamB) }),
  ];
}

export const units = [
  {
    code: "IN", name: "Infantry", real: "GI with M1 Garand", ground: "plains",
    frames: onFoot([
      ...helmet,
      ".....KooKoK.....", ".....KoooK......", "....KLLMMK.....K", ".KBBbKKKooBBBbKK",
      ".KbbKMMDoobbbK..", "..KKMMMDKKKK....", "...KKMMMKK......",
    ]),
  },
  {
    code: "AI", name: "Assault Infantry", real: "Bazooka team", ground: "plains",
    frames: onFoot([
      ...helmet,
      ".....KooKoK.....", "KKKKKKKKKKKKKKK.", "KWWWWWWWWWWWWWWK", "KhhhhhhhhhhhhhhK", "KKKKKKKKKKKKKKK.",
      "...KLMMoKKK.....", "...KMMDMK.......", "...KKMMMKK......",
    ]),
  },
  {
    code: "MO", name: "Mortar Team", real: "US M2 mortar", ground: "plains",
    frames: [
      compose({ grid: stack(mortarTube) }, { grid: stack(mortarAim) }),
      compose({ grid: stack(mortarTube) }, { grid: stack(mortarDuck) }),
    ],
  },
  {
    code: "RC", name: "Recon", real: "Willys jeep", ground: "plains",
    frames: vehicle(
      [
        ".K..............", ".K..............", ".K.....KKK......", ".K....KLLLK.K...",
        ".K...KKKKKKKcK..", ".K.....KoKK.cK..", ".K.KKKKMMKKKcKK.", "..KLLLSLLLLLLLLK",
        "..KMSSSSSMMMMMMK", "..KMMSSSMMMMMMDK",
      ],
      jeepWheels,
    ),
  },
  {
    code: "HT", name: "Halftrack", real: "M3 with M2 .50 cal", ground: "plains",
    frames: vehicle(
      [
        "....KKKKKKK.....", "..K.KWWWWWhKKKKK", "..KKKhhhhhhWhWhK", "....KKKKKKKKKKKK",
        "..KKKKKKKKKK....", ".KDDDDDDDDLLKKK.", ".KLLLLSLLLLLLLLK", ".KMSSSSSMMMMMMLK",
        ".KMMSSSMMMMMMMDK", ".KDDSDSDDDDDDDDK",
      ],
      halfTracks,
    ),
  },
  {
    code: "LT", name: "Light Tank", real: "M5 Stuart", ground: "plains",
    frames: vehicle(
      [
        "....KKKK........", "...KLLLLKKKKK...", "...KLMMMDLLLK...", "...KMMMDKKKKK...",
        "..KKKKKKKKK.....", ".KLLLLSLLLLK....", ".KMSSSSSMLLK....", ".KMMSSSMMMLLK...",
        ".KDDSDSDDDDDK...",
      ],
      shortTracks,
      "..KKKKKKKKK.....",
    ).map((grid) => compose({ grid, dx: 1 })),
  },
  {
    code: "MT", name: "Medium Tank", real: "M4 Sherman", ground: "plains",
    frames: vehicle(
      [
        ".....KKhWWWWWWK.", "......KKhK......", "....KLLLLMMKKKKK", "....KLLMMMMDLLLK", "....KMMMMMDKKKKK",
        "..KKKKKKKKKKKK..", ".KLLLLSLLLLLLLK.", ".KMMSSSSSMMMLLLK", ".KMMMSSSMMMMMLLK", ".KDDDSDSDDDDDDDK",
      ],
      tankTracks,
    ),
  },
  {
    code: "TD", name: "Tank Destroyer", real: "M10 Wolverine", ground: "plains",
    frames: vehicle(
      [
        "..KKKKK......KK.", ".KLLLLMKKKKKKWWK", ".KLMMMDLLLLLLWWK", ".KMMMDKKKKKKKWWK",
        ".KKKKKKKKKKK.KK.", "...KLLLSLLLLLLK.", "..KMMSSSSSMMMLLK",
        "..KMMMSSSMMMMLLK", "..KDDDSDSDDDDDDK",
      ],
      tankTracks,
    ),
  },
  {
    code: "AR", name: "Artillery", real: "M2 howitzer", ground: "plains",
    frames: swaying(
      [{ grid: stack(howitzerTrail) }, { grid: stack(howitzerShield) }],
      howitzerBarrel,
      { dx: -1 },
    ).map((grid) => compose({ grid }, { grid: stack(howitzerWheel) })),
  },
  {
    code: "RK", name: "Rocket Artillery", real: "T34 Calliope", ground: "plains",
    frames: vehicle(
      [
        ".........KKKKKK.", "....KKKKKrrrrrrK", "..KKrrrrrttttttK", ".KrrrtttttKKKKK.", ".KKKKKKKKKK.....",
        "..KKKLLLLMMKK...", ".KLLLLSLLLLLLLK.", ".KMMSSSSSMMMLLLK", ".KMMMSSSMMMMMLLK", ".KDDDSDSDDDDDDDK",
      ],
      tankTracks,
    ),
  },
  {
    code: "AA", name: "Mobile AA", real: "M16 quad .50", ground: "plains",
    frames: [
      vehicle([...aaGunsRight, ...aaHull], halfTracks)[0],
      vehicle([...aaGunsLeft, ...aaHull], halfTracks)[1],
    ],
  },
  {
    code: "FK", name: "Flak Gun", real: "90mm M1", ground: "plains",
    frames: swaying(
      [
        "....KKKKKKKK....", "...KMMMMMMMMK...", "...KDDDDDDDDK...", "..KKKKKKKKKKKK..",
        ".KKK..KKKK..KKK.", "KWWK........KWWK",
      ],
      [
        ".............KK.", "............KLK.", "...........KLK..", "..........KLK...",
        ".........KLK....", "........KLMK....", ".......KLMK.....", "......KLMMK.....",
        ".....KLMMK......", "....KLMMMK......", blank, blank, blank, blank, blank,
      ],
    ),
  },
  {
    code: "FT", name: "Fighter", real: "P-51 Mustang", ground: "plains",
    frames: aircraft(
      [
        blank, blank, ".KK.............", ".KLK......KK....", ".KLLK....KccK...", ".KLLLKKKKccccK..",
        ".KLLLLSLLLLLLLK.", ".KMSSSSSMMMMMMK.", "..KMSSSMMMMMMMK.", "...KSDSMMMMDDK..",
        "....KKKKDDDDDK..", "........KDDDK...", ".........KKK....",
      ],
      [blank, blank, blank, blank, "...............P", "...............P", "...............P", "...............P", "...............P", "...............P"],
      [blank, blank, blank, blank, blank, blank, "...............P", "...............P", "...............P"],
    ),
  },
  {
    code: "BM", name: "Bomber", real: "B-26 Marauder", ground: "plains",
    frames: aircraft(
      [
        blank, "KK..............", "KLK.............", "KLLK............", "KLLLK....KKK....",
        "KLLLLKKKKcccK...", ".KLLLSLLLLLLLKK.", ".KMSSSSSMMMMMccK", ".KMMSSSMMMMMMccK", "..KMSDSMMMMMMMK.",
        "...KKKKKKLLLLLK.", ".......KMMMMMMK.", "........KKKKKK..",
      ],
      [blank, blank, blank, blank, blank, blank, blank, blank, blank, "...............P", "...............P", "...............P", "...............P"],
      [blank, blank, blank, blank, blank, blank, blank, blank, blank, blank, "...............P", "...............P", blank],
    ),
  },
  {
    code: "TA", name: "Transport Aircraft", real: "C-47 Skytrain", ground: "plains",
    frames: aircraft(
      [
        blank, "KK..............", "KLK.............", "KLLK.....KKK....", "KLLLKKKKKcccKK..",
        ".KLLLLLLLLLLLLK.", ".KMcMcMcMcMMMMMK", ".KMMMMSMMMMMMMMK", "..KSSSSSMMMMMDK.", "...KSSSMKKLLLLK.",
        "...KSDSKKMMMMDK.", "....KKK..KKKKK..", blank,
      ],
      [blank, blank, blank, blank, blank, blank, blank, blank, blank, "...............P", "...............P", "...............P"],
      [blank, blank, blank, blank, blank, blank, blank, blank, blank, blank, "...............P", blank],
    ),
  },
  {
    code: "BB", name: "Battleship", real: "USS Texas", ground: "sea",
    frames: ship(
      [
        ".......K........", ".......KK.......", "......KLLK......", ".....KLMMLK.....",
        "..KKKKKLMLKKKKK.", ".KLLLKMMMMMKLLLK", "KKKKKKKKKKKKKKKK", "KLLLLLLLLLLLLLLK",
        ".KMMMMMMMMMMMMK.", ".KDDDDDDDDDDDK..", "..KKKKKKKKKKK...", blank, blank,
      ],
      ["f.ff....f..ff...", ".f....ff......f."],
      [".f..ff....f...f.", "f...f....ff...f."],
    ),
  },
  {
    code: "DD", name: "Destroyer", real: "Fletcher class", ground: "sea",
    frames: ship(
      [
        ".........K......", ".........K......", ".......KKKK.....", "..KK..KLLLK.KK..",
        ".KLLKKKMMMKKLLK.", "KKKKKKKKKKKKKKKK", "KLLLLLLLLLLLLLLK", ".KMMMMMMMMMMMK..",
        "..KDDDDDDDDDK...", "...KKKKKKKKK....", blank, blank,
      ],
      ["f..ff....f...f..", "..f....ff...f..."],
      ["..f...f....ff...", "f...ff....f....."],
    ),
  },
  {
    code: "SS", name: "Submarine", real: "Gato class", ground: "sea",
    frames: ship(
      [
        ".........K......", ".....KKKKKK.....", "....KLLLLLLK....", "...KLMMMMMMLK...",
        ".KKKKKKKKKKKKKK.", "KLLLLLLLLLLLLLLK", "KMMMMMMMMMMMMMMK", ".KDDDDDDDDDDDDK.",
        "..KKKKKKKKKKKK..", blank, blank,
      ],
      ["f...ff...f...ff.", "..f.....ff......"],
      ["..ff...f....f...", "f....f.....f...."],
    ),
  },
  {
    code: "LC", name: "Landing Craft", real: "LCT", ground: "sea",
    frames: ship(
      [
        "...KKK..........", "...KcK..........", "..KLLK..........", "..KLLK.........K",
        "KKKKKKKKKKKKKKKK", "KLLLDDDDDDDDDLKK", "KLLLLLLLLLLLLLK.", "KMMMMMMMMMMMMMK.",
        "KDDDDDDDDDDDDDK.", "KKKKKKKKKKKKKK..", blank, blank,
      ],
      ["f...ff...f......", "..f.....ff......"],
      ["..ff...f....f...", "f....f.....f...."],
    ),
  },
  {
    code: "TB", name: "Torpedo Boat", real: "PT boat", ground: "sea",
    frames: ship(
      [
        "........K.......", "........K.......", ".......KKKK.....", "......KccLLK....",
        "..KKKKKLLLLKKKKK", "KKLLLLLLLLLLLLLK", "KMMMMMMMMMMMMKK.", "KDDDDDDDDDDKK...",
        ".KKKKKKKKKK.....", blank, blank,
      ],
      ["ff.f...f...ff...", ".f...ff.........."],
      ["f.ff....ff...f..", "..f.f....f......."],
    ),
  },
];

validate(units);
