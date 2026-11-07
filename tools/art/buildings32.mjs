// Property buildings for the 32-pixel grid: 32 wide by 64 tall, seen from the front and a little
// above, rising into the tile behind, lit from the top left with a shadow to the lower right.
// Same rows and owner columns as buildings.mjs (docs/08-art-pipeline.md §15, §17).
import { art, compose, house, layer, put, rect } from "./depth32.mjs";
import { columns, palette, ramps } from "./buildings.mjs";

export { columns, palette, ramps };
const SIZE = 32;

const hash = (x, y, salt) => {
  let v = (x * 374761393 + y * 668265263 + salt * 2246822519) >>> 0;
  v = Math.imul(v ^ (v >>> 13), 1274126177) >>> 0;
  return (v ^ (v >>> 16)) >>> 0;
};
function grass(salt) {
  return Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => {
    const v = hash(x, y, salt) % 48;
    return v === 0 ? "h" : v === 1 ? "g" : "G";
  }).join(""));
}

/** Stone courses on a wall: faint darker lines every few rows, offset like real masonry. */
function masonry(g, x0, x1, y0, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if (g[y][x] === "W" && ((y - y0) % 3 === 2 || (x + (Math.floor((y - y0) / 3) % 2) * 2) % 5 === 0 && (y - y0) % 3 === 1)) g[y][x] = "Y";
  }
}
/** Roof tiles: rows of darker scallops across a roof in the owner's color. */
function roofTiles(g, x0, x1, y0, y1) {
  for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
    if ((g[y][x] === "M" || g[y][x] === "L") && (y - y0) % 2 === 1 && (x + y) % 3 === 0) g[y][x] = "D";
  }
}

function city() {
  const obj = layer();
  art(obj, ["KKKK", "KrrK", "KrrK", "KrrK", "KrrK", "KrrK"], 6, 27);
  house(obj, { x: 2, base: 52, w: 15, h: 13, roof: 7, door: 7 });
  masonry(obj, 3, 16, 40, 51);
  roofTiles(obj, 1, 18, 32, 38);
  house(obj, { x: 17, base: 61, w: 11, h: 10, roof: 6, door: 20 });
  masonry(obj, 18, 27, 52, 60);
  roofTiles(obj, 16, 29, 45, 50);
  return compose(grass(21), obj);
}

function factory() {
  const obj = layer();
  // Tall brick chimney, banded in the owner's color, with a wisp of smoke.
  art(obj, ["..ii..", ".iiii.", "..ii.."], 1, 6);
  art(obj, ["KKKKK", "KDDDK", "KLLLK", ...Array(26).fill("KbBbK")], 1, 10);
  house(obj, { x: 6, base: 59, w: 22, h: 12, roof: 3, windows: false });
  // Sawtooth roof: five teeth with glazing on their upright faces.
  for (let t = 0; t < 5; t++) art(obj, ["K.....", "KLL...", "cLLL..", "cMLLL.", "cMMLLK"], 6 + t * 4, 37);
  for (let y = 47; y <= 58; y++) for (let x = 7; x <= 27; x++) if (obj[y][x] === "W" || obj[y][x] === "Y") obj[y][x] = (x + (y % 2) * 2) % 4 === 0 ? "B" : "b";
  for (let x = 8; x <= 26; x += 5) rect(obj, x, 49, x + 2, 51, "c");
  rect(obj, 13, 53, 19, 58, "x");
  rect(obj, 13, 53, 19, 53, "K");
  return compose(grass(22), obj);
}

function airfield() {
  const ground = grass(23).map((row) => [...row]);
  for (let y = 20; y <= 29; y++) for (let x = 0; x < SIZE; x++) ground[y][x] = y === 20 || y === 29 ? "K" : "k";
  for (let x = 1; x < SIZE; x += 6) for (let d = 0; d < 3; d++) ground[24][x + d] = ground[25][x + d] = "f";
  const obj = layer();
  // A round-roofed hangar in the owner's color, doors open on a dark interior.
  art(obj, [
    ".....KKKKKKKK.....", "...KKLLLLLLLLKK...", "..KLLLLLMMMMMMMK..", ".KLLLLMMMMMMMMMDK.", "KLLLMMMMMMMMMMDDDK",
    "KLLMMMMMMMMMMDDDDK", "KMMMMMMMMMMMDDDDNK", "KWWWWKKKKKKKKWWYYK", "KWWWWKxxxxxxKWWYYK", "KWYWWKxxxxxxKWYYYK",
    "KWWWWKxxxxxxKWWYYK", "KYYYYKxxxxxxKYYYYK", "KKKKKKKKKKKKKKKKKK",
  ], 0, 37);
  // Control tower with a lit cab and an owner-colored roof; windsock on a pole.
  art(obj, ["KKKKKK", "KLLLLK", "KccccK", "KcKKcK", "KWWWYK", "KWWWYK", "KWYWYK", "KWWWYK", "KWWWYK", "KWWWYK", "KYYYYK", "KKKKKK"], 20, 38);
  art(obj, ["KLLLL", "KMMM.", "K....", "K....", "K....", "K....", "K...."], 27, 38);
  return compose(ground.map((r) => r.join("")), obj, 3);
}

function port() {
  const ground = Array.from({ length: SIZE }, (_, y) => Array.from({ length: SIZE }, (_, x) => {
    if (y < 15) return y === 14 ? "k" : (x + y * 3) % 7 === 0 ? "k" : "j";
    if (y === 15) return "K";
    return hash(x, y, 24) % 13 === 0 ? "f" : (x + y) % 11 === 0 ? "l" : "S";
  }));
  for (let x = 2; x < SIZE; x += 7) { ground[13][x] = "x"; ground[13][x + 1] = "x"; }
  const obj = layer();
  house(obj, { x: 2, base: 44, w: 14, h: 8, roof: 6, door: 7 });
  roofTiles(obj, 1, 17, 30, 35);
  // A lattice crane leaning over the water, its hook hanging.
  art(obj, [
    "KKKKKKKKKKKKK", "KxKxKxKxKxKxK", "KKKKKKKKKKKKK", "..KK......K..", "..KK......K..", "..KK......f..",
    ".KxxK.......", ".KxxK.......", ".KxKK.......", ".KxxK.......", ".KKxK.......", ".KxxK.......", ".KxKK.......",
    ".KxxK.......", ".KKxK.......", ".KxxK.......", "KKKKKK......",
  ], 18, 30);
  for (let x = 4; x < 18; x += 5) art(obj, ["BB", "BB", "BB", "BB", "ff"], x, 48);
  return compose(ground.map((r) => r.join("")), obj, 3);
}

function hq() {
  const obj = layer();
  // A banner on a tall pole behind the main block.
  art(obj, ["K........", "KLLLLLLLK", "KLLLLLLMK", "KMMMMMMMK", "KMMMMMMDK", "KLLLLLLLK", ...Array(30).fill("K........")], 15, 2);
  house(obj, { x: 6, base: 59, w: 20, h: 14, roof: 8, door: 14 });
  masonry(obj, 7, 25, 46, 58);
  roofTiles(obj, 5, 26, 37, 44);
  // Two round towers with pointed roofs on the front corners.
  for (const x of [0, 22]) {
    art(obj, [
      "....KK....", "...KLLK...", "...KLMK...", "..KLLMMK..", "..KLMMMK..", ".KLLMMMDK.", ".KLMMMMDK.", "KLLMMMMDDK",
      "KDDDDDDDDK", "KWWWWWWYYK", "KWWccWWYYK", "KWWccWWYYK", "KWWWWWWYYK", "KYWWWWWYYK", "KWWWWWWYYK", "KWWccWWYYK",
      "KWWWWWWYYK", "KYYYYYYYYK", "KWWWWWWYYK", "KWWWWWWYYK", "KYYYYYYYYK", "KKKKKKKKKK",
    ], x, 39);
  }
  return compose(grass(25), obj);
}

export const rows = [
  ["city", city()],
  ["factory", factory()],
  ["airfield", airfield()],
  ["port", port()],
  ["hq", hq()],
];

export const TILE_WIDTH = 32;
export const TILE_HEIGHT = 64;
for (const [name, g] of rows) {
  if (g.length !== TILE_HEIGHT || g.some((r) => r.length !== TILE_WIDTH)) throw new Error(`${name}: not 32x64`);
  for (const ch of g.join("")) if (ch !== "." && !palette[ch] && !"LMDN".includes(ch)) throw new Error(`${name}: no color for "${ch}"`);
}
