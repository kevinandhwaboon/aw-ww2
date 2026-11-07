// Property buildings as 16x16 pixel grids: Normandy village stone, team-colored roofs and banners.
// L/M/D is the owner's ramp, swapped per column of the sheet. Layout: docs/08-art-pipeline.md §15.
import { palette as terrainPalette } from "./terrain.mjs";

const SIZE = 16;

export const palette = {
  ...terrainPalette,
  W: "#ece4cc", Y: "#c8bc9c", Z: "#8e8468", // stone walls: light, shade, dark
  c: "#a8d8e8", // glass
};

// Owner ramps, in sheet column order. Neutral is weathered slate.
export const columns = ["neutral", "blue", "red", "green", "gold"];
export const ramps = {
  neutral: { L: "#c4c6c8", M: "#8e9296", D: "#5e6266" },
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
const grid = (ch) => Array.from({ length: SIZE }, () => Array(SIZE).fill(ch));
const toRows = (g) => g.map((r) => r.join(""));
const put = (g, x, y, ch) => {
  if (x >= 0 && y >= 0 && x < SIZE && y < SIZE) g[y][x] = ch;
};
const rect = (g, x0, y0, x1, y1, ch) => {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(g, x, y, ch);
};
const art = (g, rows, ox, oy) => rows.forEach((row, y) => [...row].forEach((ch, x) => {
  if (ch !== ".") put(g, ox + x, oy + y, ch);
}));

function grass(salt) {
  const g = grid("G");
  for (let y = 0; y < SIZE; y++) for (let x = 0; x < SIZE; x++) {
    const v = hash(x, y, salt) % 40;
    if (v === 0) g[y][x] = "h";
    else if (v === 1) g[y][x] = "g";
  }
  return g;
}

// A stone house: pitched roof in the owner's color, windows, and an optional door.
function house(g, x0, x1, roofTop, wallTop, bottom, door) {
  rect(g, x0 + 1, roofTop, x1 - 1, roofTop, "K");
  for (let y = roofTop + 1; y < wallTop - 1; y++) {
    put(g, x0, y, "K");
    put(g, x1, y, "K");
    rect(g, x0 + 1, y, x1 - 1, y, y === roofTop + 1 ? "L" : "M");
  }
  rect(g, x0 - 1, wallTop - 1, x1 + 1, wallTop - 1, "D");
  put(g, x0 - 1, wallTop - 1, "K");
  put(g, x1 + 1, wallTop - 1, "K");
  for (let y = wallTop; y <= bottom; y++) {
    put(g, x0, y, "K");
    put(g, x1, y, "K");
    rect(g, x0 + 1, y, x1 - 1, y, y === bottom ? "K" : y === bottom - 1 ? "Y" : "W");
  }
  for (let x = x0 + 2; x <= x1 - 2; x += 3) {
    put(g, x, wallTop + 1, "c");
    put(g, x, wallTop + 2, "K");
  }
  if (door !== undefined) rect(g, door, bottom - 3, door + 1, bottom - 1, "B");
}

function city() {
  const g = grass(21);
  art(g, ["KK", "Kr", "Kr"], 3, 1);
  house(g, 1, 9, 3, 8, 14, 4);
  house(g, 9, 14, 7, 11, 14, 11);
  return toRows(g);
}

function factory() {
  const g = grass(22);
  // Brick chimney with a band of the owner's color near the top.
  art(g, ["KKK", "KDK", "KbK", "KbK", "KBK", "KbK", "KbK", "KbK"], 1, 0);
  // Sawtooth roof: three teeth, glazing on each upright face.
  for (let t = 0; t < 3; t++) {
    const x = 4 + t * 4;
    art(g, ["K...", "KL..", "cLL.", "cMLK", "DDDD"], x, 3);
  }
  rect(g, 3, 8, 15, 14, "b");
  rect(g, 3, 8, 15, 8, "D");
  rect(g, 3, 14, 15, 14, "K");
  for (let x = 3; x <= 15; x += 12) rect(g, x, 8, x, 14, "K");
  for (let x = 5; x <= 13; x += 3) rect(g, x, 10, x + 1, 10, "c");
  rect(g, 8, 11, 10, 13, "B");
  rect(g, 4, 12, 14, 12, "B");
  rect(g, 8, 11, 10, 13, "x");
  return toRows(g);
}

function airfield() {
  const g = grass(23);
  // Runway across the bottom half, with a dashed centre line.
  rect(g, 0, 10, 15, 14, "k");
  rect(g, 0, 10, 15, 10, "K");
  rect(g, 0, 14, 15, 14, "K");
  for (let x = 1; x < SIZE; x += 4) rect(g, x, 12, x + 1, 12, "f");
  // Round-roofed hangar in the owner's color.
  art(g, [
    "..KKKKK..", ".KLLLLLK.", "KLLMMMMLK", "KMMMMMMDK", "KWWKKKWWK", "KWWKxKWWK", "KKKKKKKKK",
  ], 0, 2);
  // Windsock on a pole.
  art(g, ["KLL", "KDD.", "K", "K", "K", "K"], 12, 2);
  return toRows(g);
}

function port() {
  const g = grid("S");
  for (let y = 9; y < SIZE; y++) for (let x = 0; x < SIZE; x++) if (hash(x, y, 24) % 11 === 0) g[y][x] = "l";
  // Quay along the top, warehouse on it, and a crane over the water.
  rect(g, 0, 0, 15, 8, "j");
  rect(g, 0, 8, 15, 8, "K");
  rect(g, 0, 7, 15, 7, "k");
  for (let x = 1; x < SIZE; x += 5) put(g, x, 7, "x");
  house(g, 1, 8, 0, 4, 7, 4);
  art(g, ["KKKKKK", "...KxK", "...K.K", "...KxK", "...K.K", "...KxK", "...KKK", "...K.K", "..KK.KK"], 9, 0);
  art(g, ["K", "K", "K", "f"], 9, 1);
  // Pier posts standing in the water.
  for (let x = 2; x < 9; x += 3) art(g, ["B", "B", "f"], x, 9);
  return toRows(g);
}

function hq() {
  const g = grass(25);
  // A chateau: two towers with pointed roofs, a main block, and a tall banner.
  house(g, 3, 12, 4, 8, 14, 7);
  for (const x of [1, 12]) {
    art(g, ["..K..", ".KLK.", "KLMMK", "KMMDK", "KWWWK", "KWcWK", "KWKWK", "KWWWK", "KYYYK", "KKKKK"], x - 1, 5);
  }
  art(g, ["K....", "KLLLK", "KMMMK", "KLLLK", "K....", "K....", "K...."], 7, 0);
  return toRows(g);
}

// Rows of the sheet, top to bottom.
export const rows = [
  ["city", city()],
  ["factory", factory()],
  ["airfield", airfield()],
  ["port", port()],
  ["hq", hq()],
];

for (const [name, g] of rows) {
  if (g.length !== SIZE || g.some((r) => r.length !== SIZE)) throw new Error(`${name}: not 16x16`);
  for (const ch of g.join("")) if (!palette[ch] && !"LMD".includes(ch)) throw new Error(`${name}: no color for "${ch}"`);
}
