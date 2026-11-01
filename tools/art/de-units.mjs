// German land unit roster. No national insignia until 08-art-pipeline Q11 is decided: camouflage
// patches fill the space the US star takes, and the sides differ by silhouette.
import {
  blank, compose, howitzerTrail, howitzerWheel, mortarTube, shortTracks, stack, swaying,
  tankTracks, validate, vehicle,
} from "./sprite-kit.mjs";

// Small road wheels, as on the Panzer IV and StuG.
const smallWheels = [
  [".KrtrtrtrtrtrtK.", "KtWhWhWhWhWhWhtK", "KthWhWhWhWhWhWtK", ".KrtrtrtrtrtrtK.", "..KKKKKKKKKKKK.."],
  [".KtrtrtrtrtrtrK.", "KthWhWhWhWhWhWtK", "KtWhWhWhWhWhWhtK", ".KtrtrtrtrtrtrK.", "..KKKKKKKKKKKK.."],
];
// Big overlapping road wheels, as on the Tiger.
const interleaved = [
  ["KrtrtrtrtrtrtrtK", "KtWWWhWWWhWWWhtK", "KtWhWWWhWWWhWWtK", "KrtrtrtrtrtrtrtK", ".KKKKKKKKKKKKKK."],
  ["KtrtrtrtrtrtrtrK", "KtWhWWWhWWWhWWtK", "KtWWWhWWWhWWWhtK", "KtrtrtrtrtrtrtrK", ".KKKKKKKKKKKKKK."],
];
const halfInterleaved = [
  [".KrtrtrtrtKKKKKK", "KtWWWhWWWtK..KK.", "KtWhWWWhWtK.KWWK", ".KrtrtrtrK..KWhK", "..KKKKKKK....KK."],
  [".KtrtrtrtrKKKKKK", "KtWhWWWhWtK..KK.", "KtWWWhWWWtK.KWhK", ".KtrtrtrtK..KWWK", "..KKKKKKK....KK."],
];
const bikeWheels = [
  ["..KKDDDDDDDDKK..", "..KKK......KKK..", ".KWWWK....KWWWK.", ".KWhWK....KWhWK.", "..KKK......KKK.."],
  ["..KKDDDDDDDDKK..", "..KKK......KKK..", ".KhWWK....KhWWK.", ".KWWhK....KWWhK.", "..KKK......KKK.."],
];

// The Stahlhelm flares down over the ears, unlike the round US helmet.
const stahlhelm = [".....KKKK.......", "....KLLLLK......", "...KLMMMMLK.....", "...KMKKKKKK....."];
const bootsA = ["....KMMDMK......", "....KKKKKK......", "...KKKK.KKKK...."];
const bootsB = ["....KMMDMK......", "...KKK..KKK.....", "..KKKK...KKKK..."];

function onFoot(upper) {
  return [stack([...upper, ...bootsA]), stack([...upper, ...bootsB])];
}

const schreckTroop = onFoot([
  ...stahlhelm,
  "....KKooKoK.....", "KKKKKKKKKKKKKKK.", "KWWWWWWWWWWWWWWK", "KhhhhhhhhhhhhhhK", "KKKKKKKKKKKKKKK.",
  "...KLMMoKKK.....", "...KMMDMK.......", "...KKMMMKK......",
]);
// The Panzerschreck's blast shield, with its small window.
const blastShield = stack([
  "..........KKKK..", "..........KWWK..", "..........KccK..", "..........KWWK..", "..........KWWK..",
  "..........KWWK..", "..........KWWK..", "..........KWWK..", "..........KWWK..", "..........KWWK..",
  "..........KKKK..", blank, blank, blank, blank,
]);

const mortarAim = [
  ".KKKK...........", "KLLLLK..........", "KLMMMMLK........", "KMKKKKKK........",
  ".KKooKoK........", "..KoooK.........", ".KLMMMooK.......", ".KMMDMKK........",
  ".KMMKKKK........", ".KMMKKKKK.......", ".KKKKKKKK.......",
];
const mortarDuck = [
  "...KKKK.........", "..KLLLLK........", ".KLMMMMLK.......", ".KMKKKKKK.......",
  ".KLLKoooK.......", "KLMMMMooK.......", "KMMDMMKK........", "KKKKKKKK........",
];

const leFHBarrel = [
  "...........KKKK.", "........KKKLLMK.", "......KKLLLMMDK.", ".....KLLLMMMKKK.",
  ".....KLMMMKK....", ".....KMMKK......", ".....KKK........",
  blank, blank, blank, blank, blank, blank, blank,
];
const leFHShield = [
  ".........KKK....", ".........KMK....", ".........KMK....", ".........KMK....",
  ".........KDK....", ".........KDK....", ".........KDK....", blank, blank, blank, blank, blank,
];

// Six barrels, tilted up, on a post that stays joined to the carriage as they lift.
const nebelTubes = [
  "............KKKK", "..........KKWWhK", "........KKWWKKWK", "......KKWWKKWWKK",
  "....KKWWKKWWhK..", "...KWWKKWWhKK...", "...KhKKhhKK.....", "....KKKK........",
];
const nebelBase = [
  ".......KMK......", ".......KMK......", ".......KMK......", "...KKKKKKKKK....", "..KMMMMKWWWK....",
  ".KMMDKKKWhWK....", ".KDKK..KWWWK.KK.", "KKK.....KKK..KMK", ".............KKK",
];

const flakGunsRight = ["...........KK.KK", "..........KK.KK.", ".........KK.KK.."];
const flakGunsLeft = ["KK.KK...........", ".KK.KK..........", "..KK.KK........."];
const flakBed = [
  ".....KKKKKKK....", ".....KMMMMMK....", "..KKKKKKKKKKK...", ".KLLLLLLLLLKKKK.", ".KMDDMMMDMKLLLLK",
  ".KMMMMDDMMKMMMMK", ".KDDDDDDDDDDDDDK",
];

const flakMount = [
  "...KKKKKKKKKK...", "...KMMMMMMMMK...", "..KKKKKKKKKKKK..", ".KWWK.KKKK.KWWK.", ".KKKK......KKKK.",
];
const eightyEightBarrel = [
  ".............KKK", "...........KKWWK", ".........KKLLWWK", ".......KKLLMMKKK", ".....KKLLMMKK...",
  "....KLLLMMKK....", "...KLLLMMK......", "..KMMMMMMK......", "..KKKKKKKK......", ".......KDK......",
  blank, blank, blank, blank,
];
const eightyEightShield = [
  ".........KKK....", "........KMMK....", "........KMMK....", "........KDDK....", "........KDDK....",
  ".........KKK....", blank, blank, blank, blank,
];

export const units = [
  {
    code: "IN", name: "Infantry", real: "Rifleman with Kar98k", ground: "plains",
    frames: onFoot([
      ...stahlhelm,
      "....KKooKoK.....", ".....KoooK......", "....KLLMMK.....K", ".KbbbKWKoobbbKK.",
      ".KbbKMMDoobbK...", "..KKMDDDKKKK....", "...KKMMMKK......",
    ]),
  },
  {
    code: "AI", name: "Assault Infantry", real: "Panzerschreck team", ground: "plains",
    frames: schreckTroop.map((grid) => compose({ grid }, { grid: blastShield })),
  },
  {
    code: "MO", name: "Mortar Team", real: "Granatwerfer 34", ground: "plains",
    frames: [
      compose({ grid: stack(mortarTube) }, { grid: stack(mortarAim) }),
      compose({ grid: stack(mortarTube) }, { grid: stack(mortarDuck) }),
    ],
  },
  {
    code: "RC", name: "Recon", real: "Zündapp KS 750 with sidecar", ground: "plains",
    frames: vehicle(
      [
        "...KKKK.........", "..KLLLLK........", ".KLMMMMLK.KKK...", ".KMKKKKKK.KLLK..",
        ".KKooKoK..KoK...", "...KMMMKKKWWWWWK", "..KLMMMooKMDKK..", "..KKKKKKKKKKKKK.",
        ".KLLLLLLLLLLLLK.", ".KMMDDMMMMDMMK..",
      ],
      bikeWheels,
    ),
  },
  {
    code: "HT", name: "Halftrack", real: "Sd.Kfz. 251 with MG 34", ground: "plains",
    frames: vehicle(
      [
        ".......KKK......", ".......KMKKKKKK.", ".....KKKMKWWWWK.", "...KKKKKKKKKKK..",
        "..KDDDDDDDDLLK..", "..KLLLLLLLLLLLK.", ".KMMDDMMMMDMMLLK", ".KMMMMMDDMMMMMLK",
        ".KDDDDDDDDDDDDDK",
      ],
      halfInterleaved,
    ),
  },
  {
    code: "LT", name: "Light Tank", real: "Panzer II", ground: "plains",
    frames: vehicle(
      [
        ".....KKK........", "...KKKKKKK......", "...KLLLLMKKKKKK.", "...KLMMMDWWWWWK.", "...KMMMDKKKKKKK.",
        ".KKKKKKKKKKK....", ".KLLLLLLLLLK....", ".KMDDMMMDMLK....", ".KDDDDDDDDDK....",
      ],
      shortTracks,
      "..KKKKKKKKK.....",
    ).map((grid) => compose({ grid, dx: 1 })),
  },
  {
    code: "MT", name: "Medium Tank", real: "Panzer IV", ground: "plains",
    frames: vehicle(
      [
        "....KKK.........", "...KKKKKKKKK....", "..KLLLLLLLLKKKKK", "..KLLMMMMMDLLWWK", "..KMMMMMMDKKKKKK",
        "..KKKKKKKKKKKK..", ".KLLLLLLLLLLLLK.", ".KMMDDMMMMDDMMMK", ".KMMMMMDDMMMMMMK", ".KDDDDDDDDDDDDDK",
      ],
      smallWheels,
    ),
  },
  {
    code: "HV", name: "Heavy Tank", real: "Tiger", ground: "plains",
    frames: vehicle(
      [
        "...KKKK.........", ".KKKKKKKKKKK..KK", "KLLLLLLLLLLKKKWW", "KLLMMMMMMMDLLLWW", "KMMMMMMMMDKKKKWW",
        "KKKKKKKKKKKKKKKK", "KLLLLLLLLLLLLLLK", "KMMDDMMMMMDDMMMK", "KMMMMMDDMMMMMMMK", "KDDDDDDDDDDDDDDK",
      ],
      interleaved,
      ".KKKKKKKKKKKKKK.",
    ),
  },
  {
    code: "TD", name: "Tank Destroyer", real: "StuG III", ground: "plains",
    frames: vehicle(
      [
        ".....KK.........", "...KKKKKKK...KK.", "..KLLLLLLLKKKWWK", "..KLLMMMMDLLLWWK", "..KMMMMMDKKKKWWK",
        ".KKKKKKKKKKK.KK.", ".KLMDDMMMMDMMLK.", ".KDDDDDDDDDDDDDK",
      ],
      smallWheels,
    ),
  },
  {
    code: "AR", name: "Artillery", real: "leFH 18", ground: "plains",
    frames: swaying(
      [{ grid: stack(howitzerTrail) }, { grid: stack(leFHShield) }],
      leFHBarrel,
      { dx: -1 },
    ).map((grid) => compose({ grid }, { grid: stack(howitzerWheel) })),
  },
  {
    code: "RK", name: "Rocket Artillery", real: "Nebelwerfer 41", ground: "plains",
    frames: swaying(nebelBase, [...nebelTubes, ...Array(7).fill(blank)]),
  },
  {
    code: "AA", name: "Mobile AA", real: "Flakvierling 38 on Sd.Kfz. 7/1", ground: "plains",
    frames: [
      vehicle([...flakGunsRight, ...flakBed], halfInterleaved)[0],
      vehicle([...flakGunsLeft, ...flakBed], halfInterleaved)[1],
    ],
  },
  {
    code: "FK", name: "Flak Gun", real: "88mm Flak", ground: "plains",
    frames: swaying(
      [{ grid: stack(eightyEightShield) }, { grid: stack(flakMount) }],
      eightyEightBarrel.concat(blank),
    ),
  },
];

validate(units);
