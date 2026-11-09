// Property buildings, 16 wide by 32 tall: seen from the front and a little above, rising into the
// tile behind, lit from the top left with a shadow to the lower right. Normandy village stone, with
// roofs and banners in the owner's color (L/M/D, swapped per sheet column). Layout: 08-art-pipeline §15–16.
import { art, compose, house, layer, put, rect } from "./depth.mjs";
import { palette as terrainPalette } from "./terrain.mjs";

const SIZE = 16;

export const palette = {
  ...terrainPalette,
  W: "#ece4cc", Y: "#c2b694", Z: "#8e8468", // stone walls: light, shade, dark
  c: "#a8d8e8", // glass
};

// Owner ramps, in sheet column order. Neutral is weathered slate.
export const columns = ["neutral", "olive", "red", "blue", "green", "gold"];
export const ramps = {
  neutral: { L: "#c4c6c8", M: "#8e9296", D: "#5e6266" },
  olive: { L: "#8ea25e", M: "#64783a", D: "#435428" },
  blue: { L: "#7fb0e8", M: "#3f74c4", D: "#274a8c" },
  red: { L: "#ec8a70", M: "#c4482f", D: "#842c20" },
  green: { L: "#94d47c", M: "#4e9c40", D: "#2e6228" },
  gold: { L: "#f2d276", M: "#d8a030", D: "#8a6418" },
};

const hash = (x, y, salt) => {
  let v = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177) >>> 0;
  return (v ^ (v >>> 16)) >>> 0;
};

// 16x16 ground for the cell.
function grass(salt) {
  return Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => {
    const v = hash(x, y, salt) % 40;
    return v === 0 ? "h" : v === 1 ? "g" : "G";
  }).join(""));
}

function city() {
  const obj = layer();
  // Chimney on the back house.
  art(obj, ["KK", "Kr", "Kr", "Kr"], 3, 13);
  house(obj, { x: 1, base: 26, w: 7, h: 6, roof: 4, door: 3 });
  house(obj, { x: 8, base: 30, w: 5, h: 5, roof: 3, door: 9 });
  return compose(grass(21), obj);
}

function factory() {
  const obj = layer();
  // Tall brick chimney behind, banded in the owner's color near the top.
  art(obj, ["KKK", "KDK", ...Array(14).fill("KbK")], 1, 9);
  house(obj, { x: 3, base: 29, w: 10, h: 6, roof: 2, windows: false });
  // Sawtooth roof: three teeth with glazing on their upright faces.
  for (let t = 0; t < 3; t++) art(obj, ["K...", "KL..", "cLL.", "cMLK"], 3 + t * 3, 17);
  rect(obj, 4, 25, 12, 25, "c");
  for (let x = 6; x <= 12; x += 3) put(obj, x, 25, "K");
  rect(obj, 6, 26, 8, 28, "x");
  for (let y = 24; y <= 28; y++) for (let x = 4; x <= 12; x++) if (obj[y][x] === "W") obj[y][x] = "b";
  return compose(grass(22), obj);
}

function airfield() {
  const ground = grass(23).map((row) => [...row]);
  // Runway across the front of the cell, with a dashed centre line.
  for (let y = 10; y <= 14; y++) for (let x = 0; x < SIZE; x++) ground[y][x] = y === 10 || y === 14 ? "K" : "k";
  for (let x = 1; x < SIZE; x += 4) ground[12][x] = ground[12][x + 1] = "f";
  const obj = layer();
  // A round-roofed hangar in the owner's color, open at the front.
  art(obj, [
    "...KKKKK...", "..KLLLLLKK.", ".KLLLMMMMDK", "KLLMMMMMDDK", "KMMMMMMDDK.", "KWWKKKKWYK.", "KWWKxxKWYK.", "KKKKKKKKKK.",
  ], 0, 17);
  // Control tower with a lit cab.
  art(obj, ["KKKK", "KLLK", "KccK", "KWYK", "KWYK", "KWYK", "KWYK", "KKKK"], 11, 16);
  return compose(ground.map((r) => r.join("")), obj, 2);
}

function port() {
  const ground = Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => {
    if (y < 8) return y === 7 ? "k" : "j";
    if (y === 8) return "K";
    return hash(x, y, 24) % 11 === 0 ? "l" : "S";
  }));
  for (let x = 1; x < SIZE; x += 5) ground[7][x] = "x";
  const obj = layer();
  house(obj, { x: 1, base: 22, w: 7, h: 4, roof: 3, door: 4 });
  // A crane leaning out over the water.
  art(obj, [
    "KKKKKKK", "KxxxxxK", ".KK..K.", "..K..f.", "..K....", ".KxK...", ".KxK...", ".KxK...", ".KxK...", ".KxK...",
    ".KxK...", "KKKKK..",
  ], 9, 11);
  // Pier posts standing in the water.
  for (let x = 2; x < 9; x += 3) art(obj, ["B", "B", "f"], x, 25);
  return compose(ground.map((r) => r.join("")), obj, 2);
}

function hq() {
  const obj = layer();
  // A banner on a tall pole, behind the main block.
  art(obj, ["K....", "KLLLK", "KMMMK", "KLLLK", ...Array(12).fill("K....")], 7, 2);
  house(obj, { x: 3, base: 29, w: 9, h: 7, roof: 4, door: 6 });
  // Two towers with pointed roofs on the front corners.
  for (const x of [0, 11]) {
    art(obj, [
      "..K..", ".KLK.", ".KLMK", "KLMMK", "KMMDK", "KWWYK", "KWcYK", "KWWYK", "KWKYK", "KWWYK", "KWWYK", "KYYYK", "KKKKK",
    ], x, 18);
  }
  return compose(grass(25), obj);
}

// Rows of the sheet, top to bottom.
export const rows = [
  ["city", city()],
  ["factory", factory()],
  ["airfield", airfield()],
  ["port", port()],
  ["hq", hq()],
];

export const TILE_HEIGHT = 32;

for (const [name, g] of rows) {
  if (g.length !== TILE_HEIGHT || g.some((r) => r.length !== SIZE)) throw new Error(`${name}: not 16x32`);
  for (const ch of g.join("")) if (ch !== "." && !palette[ch] && !"LMD".includes(ch)) throw new Error(`${name}: no color for "${ch}"`);
}
