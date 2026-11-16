// Commander portraits (docs/06-commanders.md §4): 48x64 pixel figures from the waist up, one per
// commander, each in an officer's uniform of their nation, plus a 32x32 head crop for the turn bar
// and a sheet for the docs. Every commander is fictional; nothing here is drawn from a real person.
// Uniforms carry no Nazi or political symbols (00-master-design §6).
// Run: node tools/art/commanders.mjs
import { mkdirSync } from "node:fs";
import { canvas, rgba, savePng } from "./png.mjs";

const W = 48, H = 64;
const OUT = "docs/art/commanders";
const INK = "#1a1a16";
const GOLD = "#e0b030", GOLD_D = "#a87c1c", SILVER = "#c8ccc8", WHITE = "#f4f0e4";
const LEATHER = { l: "#a06a3a", m: "#7a4e28", d: "#4e3018" };
const BLACK_LEATHER = { l: "#4a4a48", m: "#2a2a28", d: "#161614" };

const SKIN = {
  fair: { l: "#f2caa0", m: "#dca878", d: "#b07c54", lip: "#a85c4c" },
  ruddy: { l: "#eeb890", m: "#d4946c", d: "#a4684a", lip: "#9c4c40" },
  tan: { l: "#e4b484", m: "#c89460", d: "#986c44", lip: "#8c5040" },
};
const CLOTH = {
  // US Army olive drab service wool, and the Navy's blue-black.
  oliveDrab: { l: "#7c7848", m: "#5c5a34", d: "#403e24" },
  navy: { l: "#34394c", m: "#22263a", d: "#141722" },
  // British and Canadian khaki serge.
  serge: { l: "#a8905c", m: "#847044", d: "#5c4e2e" },
  // Soviet khaki-green cotton.
  soviet: { l: "#8c9060", m: "#686c42", d: "#484c2c" },
  // German field grey, with the dark green collar.
  fieldGrey: { l: "#8c948a", m: "#687068", d: "#485048" },
  bottleGreen: { l: "#3c5444", m: "#2a3c30", d: "#1c2820" },
  // Italian grey-green.
  greyGreen: { l: "#98a08c", m: "#747c68", d: "#525a48" },
  // Japanese khaki.
  jpKhaki: { l: "#b09c5c", m: "#8c7a40", d: "#64562c" },
  fur: { l: "#b0a898", m: "#847c6e", d: "#5a5448" },
  white: { l: "#fcfaf2", m: "#e8e4d8", d: "#c0bcb0" },
  black: { l: "#4a4a48", m: "#2a2a28", d: "#161614" },
  helmet: { l: "#7c8450", m: "#5a6238", d: "#3c4224" },
};
const HAIR = { dark: "#3a2c20", black: "#22201e", sandy: "#b89454", grey: "#a8a49a", brown: "#6a4a2c" };

function portrait(spec) {
  const px = Array.from({ length: H }, () => Array(W).fill(null));
  const set = (x, y, c) => { if (x >= 0 && y >= 0 && x < W && y < H && c) px[y][x] = c; };
  const rect = (x0, y0, x1, y1, c) => { for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) set(x, y, c); };
  const row = (y, x0, x1, c) => rect(x0, y, x1, y, c);
  const col = (x, y0, y1, c) => rect(x, y0, x, y1, c);
  const oval = (cx, cy, rx, ry, c, keep = () => true) => {
    for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
      if (((x - cx) / rx) ** 2 + ((y - cy) / ry) ** 2 <= 1 && keep(x, y)) set(x, y, c);
    }
  };
  const skin = SKIN[spec.skin], cloth = CLOTH[spec.cloth], hat = CLOTH[spec.hatCloth ?? spec.cloth];
  const hair = HAIR[spec.hair];
  const u = spec.uniform;

  // ---- Torso: shoulders, chest and upper arms, lit from the top left. ----
  const half = (y) => (y <= 31 ? 10 : y === 32 ? 13 : y === 33 ? 16 : y === 34 ? 17 : 18);
  for (let y = 31; y < H; y++) {
    const w = half(y);
    for (let x = 24 - w; x <= 23 + w; x++) set(x, y, x >= 36 ? cloth.d : x <= 7 ? cloth.l : cloth.m);
  }
  row(31, 14, 20, cloth.l); row(32, 11, 16, cloth.l);
  // Arms hang at the sides.
  col(12, 38, H - 1, cloth.d); col(35, 38, H - 1, cloth.d);
  // Light falling off across the chest.
  for (let y = 36; y < H; y++) for (let x = 33; x <= 34; x++) set(x, y, cloth.d);

  // Neck.
  rect(20, 25, 27, 32, skin.d);
  rect(20, 25, 23, 30, skin.m);

  // Collar and front.
  if (u.collar === "open") {
    // Open lapels over a shirt and tie.
    const apex = u.apex ?? 44;
    for (let y = 30; y <= apex; y++) {
      const h = ((apex - y) / (apex - 30)) * 5 + 0.5;
      for (let x = Math.ceil(23.5 - h); x <= Math.floor(23.5 + h); x++) set(x, y, u.shirt);
      // Lapels either side of the opening.
      const lx = Math.ceil(23.5 - h) - 1, rx = Math.floor(23.5 + h) + 1;
      rect(lx - 2, y, lx, y, cloth.l); set(lx - 3, y, cloth.d);
      rect(rx, y, rx + 2, y, cloth.m); set(rx + 3, y, cloth.d);
    }
    // Lapel notches.
    row(36, 14, 16, cloth.d); row(36, 31, 33, cloth.d);
    // Shirt collar points and the tie.
    rect(19, 30, 21, 32, u.shirtCollar ?? u.shirt); rect(26, 30, 28, 32, u.shirtCollar ?? u.shirt);
    set(19, 33, u.shirtShade ?? INK); set(28, 33, u.shirtShade ?? INK);
    rect(22, 31, 25, 33, u.tie);
    rect(23, 34, 24, apex - 1, u.tie);
    col(24, 34, apex - 1, u.tieShade ?? u.tie);
  } else {
    // Closed collar, standing or turned down.
    const collar = CLOTH[u.collarCloth ?? spec.cloth];
    rect(18, 29, 29, 32, collar.m);
    row(29, 18, 29, collar.l);
    row(33, 18, 29, cloth.d);
    col(23, 29, 32, collar.d);
    if (u.collar === "fall") { set(18, 33, collar.m); set(19, 33, collar.m); set(28, 33, collar.m); set(29, 33, collar.m); }
  }
  if (u.collarTabs) { rect(19, 30, 21, 31, u.collarTabs); rect(26, 30, 28, 31, u.collarTabs); }
  if (u.collarBars) for (const x of [19, 21, 26, 28]) col(x, 30, 31, u.collarBars);
  if (u.collarStars) { set(20, 30, u.collarStars); set(27, 30, u.collarStars); }
  if (u.lapelPatch) { rect(16, 33, 18, 35, u.lapelPatch); rect(29, 33, 31, 35, u.lapelPatch); }
  if (u.lapelDiscs) { rect(16, 33, 17, 34, u.lapelDiscs); rect(30, 33, 31, 34, u.lapelDiscs); }

  // The line where the coat closes, and its buttons.
  const top = u.collar === "open" ? (u.apex ?? 44) + 1 : 34;
  const end = u.placketTo ?? H - 1;
  if (!u.double) col(24, top, end, cloth.d);
  if (u.double) {
    // Double-breasted: the front wraps over, with two rows of buttons.
    for (let y = top; y < H; y++) set(Math.min(26, 24 + Math.floor((y - top) / 6)), y, cloth.d);
    for (const y of u.buttons) for (const x of [17, 29]) { rect(x, y, x + 1, y + 1, u.buttonColor); set(x + 1, y + 1, u.buttonShade); }
  } else if (u.buttons) {
    for (const y of u.buttons) { rect(23, y, 24, y + 1, u.buttonColor); set(24, y + 1, u.buttonShade); }
  }

  // Breast pockets, with a flap and a button; pleated on some uniforms.
  if (u.pockets) {
    for (const x0 of [14, 27]) {
      const y0 = u.pockets.y ?? 41;
      rect(x0, y0, x0 + 6, y0 + 7, x0 > 20 ? cloth.m : cloth.l);
      rect(x0, y0, x0 + 6, y0 + 2, cloth.m);
      row(y0 + 2, x0, x0 + 6, cloth.d);
      if (u.pockets.scalloped) { set(x0, y0 + 2, cloth.m); set(x0 + 6, y0 + 2, cloth.m); set(x0 + 3, y0 + 3, cloth.d); }
      if (u.pockets.pleat) col(x0 + 3, y0 + 3, y0 + 7, cloth.d);
      col(x0 - 1, y0, y0 + 7, cloth.d); col(x0 + 7, y0, y0 + 7, cloth.d); row(y0 + 8, x0, x0 + 6, cloth.d);
      set(x0 + 3, y0 + 1, u.buttonColor ?? cloth.d);
    }
  }
  // Medal ribbons over the wearer's left pocket.
  if (u.ribbons) u.ribbons.forEach((r, i) => [...r].forEach((ch, j) => {
    const color = { r: "#b03030", b: "#2c4a9c", y: GOLD, g: "#3c7a3c", w: WHITE, p: "#7a3c8c", o: "#d87a2c" }[ch];
    set(27 + j, (u.pockets?.y ?? 41) - 3 - i * 2, color); set(27 + j, (u.pockets?.y ?? 41) - 4 - i * 2, color);
  }));
  if (u.medal) { rect(28, 37, 30, 38, "#b03030"); rect(28, 39, 30, 39, GOLD); set(29, 40, GOLD); set(28, 40, GOLD_D); set(30, 40, GOLD_D); }

  // Shoulder boards or straps.
  if (u.boards) {
    rect(8, 33, 14, 34, u.boards); rect(33, 33, 39, 34, u.boards);
    if (u.boardEdge) { row(35, 8, 14, u.boardEdge); row(35, 33, 39, u.boardEdge); }
    if (u.boardPips) { set(10, 33, u.boardPips); set(12, 33, u.boardPips); set(35, 33, u.boardPips); set(37, 33, u.boardPips); }
  }
  // A waistband, for the short jackets that end at the waist.
  if (u.waistband) {
    rect(12, 57, 35, 60, cloth.l); row(57, 12, 35, cloth.d); row(61, 12, 35, cloth.d);
    rect(13, 62, 34, H - 1, cloth.d);
    rect(26, 58, 28, 59, u.buckle ?? SILVER);
  }
  // A leather belt, and a cross strap over the wearer's right shoulder.
  if (u.belt) {
    const b = u.belt.leather;
    if (u.belt.strap) for (let i = 0; i <= 22; i++) { const x = 13 + i, y = 34 + i; set(x, y, b.l); set(x + 1, y, b.m); set(x + 2, y, b.d); }
    rect(12, 56, 35, 59, b.m); row(56, 12, 35, b.l); row(59, 12, 35, b.d);
    rect(22, 55, 25, 60, u.belt.buckle); rect(23, 57, 24, 58, u.belt.buckleInner ?? b.d);
  }
  // Gold lace on the cuffs.
  if (u.cuffLace) for (const y of u.cuffLace) { row(y, 6, 11, GOLD); row(y, 36, 41, GOLD_D); }
  // Field glasses hung round the neck.
  if (u.binoculars) {
    for (let i = 0; i < 10; i++) { set(19 - Math.floor(i / 5), 33 + i, INK); set(28 + Math.floor(i / 5), 33 + i, INK); }
    rect(18, 43, 22, 49, BLACK_LEATHER.m); rect(25, 43, 29, 49, BLACK_LEATHER.m); rect(23, 44, 24, 46, BLACK_LEATHER.l);
    col(18, 43, 49, BLACK_LEATHER.l); col(25, 43, 49, BLACK_LEATHER.l);
    row(49, 18, 22, "#6a8ca0"); row(49, 25, 29, "#6a8ca0");
  }
  if (u.scarf) { rect(19, 28, 28, 31, u.scarf); rect(20, 32, 27, 33, u.scarf); row(31, 19, 28, u.scarfShade); }

  // ---- Head. ----
  const jaw = spec.jaw ?? 0; // 1 = square, -1 = lean
  oval(23.5, 17, jaw < 0 ? 7.5 : 8.2, 10.4, skin.m);
  if (jaw > 0) { rect(16, 17, 31, 25, skin.m); set(16, 25, null); set(31, 25, null); px[25][16] = px[25][31] = null; }
  for (let y = 6; y <= 28; y++) for (let x = 14; x <= 33; x++) {
    if (px[y][x] !== skin.m) continue;
    if (x >= 29) px[y][x] = skin.d;
    else if (x <= 20 && y <= 21 && x + y <= 38) px[y][x] = skin.l;
  }
  // Shadow under the chin onto the neck.
  row(28, 20, 27, skin.d);
  // Ears.
  rect(14, 16, 15, 20, skin.m); col(15, 17, 19, skin.d);
  rect(32, 16, 33, 20, skin.d);
  // Hair at the temples.
  if (hair) {
    rect(15, 11, 16, 15, hair); rect(31, 11, 32, 15, hair);
    if (spec.sideburns) { rect(16, 16, 16, 18, hair); rect(31, 16, 31, 18, hair); }
  }

  // Face.
  const brow = spec.browColor ?? hair ?? INK;
  const by = spec.sternBrows ? 14 : 13;
  row(by, 18, 22, brow); row(by, 25, 29, brow);
  if (spec.sternBrows) { set(18, 13, brow); set(29, 13, brow); set(22, 15, brow); set(25, 15, brow); }
  else { set(18, 14, brow); set(29, 14, brow); }
  // Eyes: a lid line, the white and the iris.
  row(15, 19, 21, skin.d); row(15, 26, 28, skin.d);
  set(19, 16, WHITE); set(20, 16, spec.eyes ?? "#3a2c20"); set(21, 16, WHITE);
  set(26, 16, WHITE); set(27, 16, spec.eyes ?? "#3a2c20"); set(28, 16, WHITE);
  row(17, 19, 21, skin.m); row(17, 26, 28, skin.d);
  // Nose.
  col(24, 16, 20, skin.d); row(21, 22, 25, skin.d); set(23, 20, skin.l); set(22, 20, skin.l);
  // Mouth.
  if (spec.mouth === "grin") { row(23, 20, 27, skin.lip); row(24, 21, 26, WHITE); row(25, 21, 26, skin.lip); set(19, 22, skin.d); set(28, 22, skin.d); }
  else if (spec.mouth === "smile") { row(24, 21, 26, skin.lip); set(20, 23, skin.lip); set(27, 23, skin.lip); row(25, 22, 25, skin.d); }
  else { row(24, 21, 26, skin.lip); row(25, 22, 25, skin.d); }
  if (spec.lines) { col(19, 20, 22, skin.d); col(28, 20, 22, skin.d); set(18, 18, skin.d); set(29, 18, skin.d); }
  if (spec.moustache) { row(22, 20, 27, spec.moustache); row(23, 19, 22, spec.moustache); row(23, 25, 28, spec.moustache); }
  const isSkin = (c) => c === skin.m || c === skin.d || c === skin.l;
  if (spec.stubble) for (let y = 21; y <= 28; y++) for (let x = 15; x <= 32; x++) {
    if (isSkin(px[y][x]) && (x + y) % 2 === 0 && !(y >= 23 && y <= 25 && x >= 20 && x <= 27) && (y >= 23 || x <= 18 || x >= 29)) px[y][x] = spec.stubble;
  }
  if (spec.beard) {
    for (let y = 22; y <= 29; y++) for (let x = 14; x <= 33; x++) {
      if (isSkin(px[y][x]) && !(y <= 25 && x >= 21 && x <= 26) && (y >= 24 || x <= 18 || x >= 29)) px[y][x] = x >= 29 ? spec.beardShade : spec.beard;
    }
    row(22, 20, 27, spec.beard); rect(22, 27, 25, 30, spec.beard); row(29, 21, 26, spec.beardShade);
  }
  if (spec.glasses) {
    for (const x0 of [18, 25]) { row(14, x0, x0 + 4, INK); row(18, x0, x0 + 4, INK); col(x0, 14, 18, INK); col(x0 + 4, 14, 18, INK); set(x0 + 1, 15, "#dcecf0"); }
    row(15, 23, 24, INK); row(15, 15, 17, INK); row(15, 30, 32, INK);
  }
  if (spec.cigar) { rect(26, 24, 33, 25, "#7a4e28"); row(24, 26, 33, "#a06a3a"); rect(34, 24, 34, 25, "#e86a2c"); set(36, 22, "#c8c4b8"); set(37, 20, "#c8c4b8"); set(36, 18, "#dcd8cc"); set(38, 17, "#dcd8cc"); }

  // ---- Headgear. ----
  const badge = spec.badge;
  switch (spec.hat) {
    case "helmet": {
      const dome = (x, y) => y <= 13;
      oval(23.5, 11.5, 12, 9.5, hat.m, dome);
      oval(21, 9, 8, 6, hat.l, (x, y) => y <= 9);
      oval(23.5, 11.5, 12, 9.5, hat.d, (x, y) => y <= 13 && x >= 31);
      row(13, 12, 35, hat.d); row(14, 13, 34, INK);
      // Goggles pushed up on the helmet.
      rect(14, 8, 33, 8, "#5a4a30");
      rect(16, 7, 22, 10, "#3a3830"); rect(25, 7, 31, 10, "#3a3830");
      rect(17, 8, 21, 9, "#a8d8e8"); rect(26, 8, 30, 9, "#a8d8e8"); set(17, 8, WHITE); set(26, 8, WHITE);
      // Chin strap.
      col(15, 15, 24, "#5a4a30"); col(32, 15, 24, "#4a3a24");
      break;
    }
    case "peaked": {
      // A wide crown, a band with a badge, and a shining peak.
      oval(23.5, 6.5, 14, 5.5, hat.m);
      oval(20, 5, 9, 3, hat.l);
      oval(23.5, 6.5, 14, 5.5, hat.d, (x) => x >= 33);
      rect(14, 9, 33, 12, spec.band ?? hat.d);
      row(9, 14, 33, spec.bandEdge ?? spec.band ?? hat.d);
      if (spec.chinStrap) row(12, 14, 33, spec.chinStrap);
      rect(13, 13, 34, 13, INK); rect(14, 14, 33, 14, "#2e2c26"); row(13, 16, 24, "#5a5850");
      if (badge) { rect(22, 8, 25, 11, badge); set(22, 8, null); set(25, 8, null); px[8][22] = px[8][25] = spec.band ?? hat.d; rect(23, 6, 24, 7, badge); }
      break;
    }
    case "beret": {
      oval(22, 8, 13, 6.5, hat.m);
      oval(19, 6, 8, 3.5, hat.l);
      oval(12.5, 12, 5, 4.5, hat.m);
      oval(22, 8, 13, 6.5, hat.d, (x, y) => x >= 31 && y >= 8);
      rect(15, 13, 33, 14, hat.d); row(14, 15, 33, INK);
      if (badge) { rect(27, 8, 29, 11, badge); set(28, 7, badge); }
      break;
    }
    case "fur": {
      // Fur cap with the ear flaps tied up over the crown.
      rect(13, 3, 34, 13, hat.m); row(2, 15, 32, hat.m);
      rect(13, 3, 22, 6, hat.l); rect(31, 3, 34, 13, hat.d);
      rect(12, 8, 13, 15, hat.m); rect(34, 8, 35, 15, hat.d);
      row(8, 13, 34, hat.d);
      for (let y = 3; y <= 13; y++) for (let x = 13; x <= 34; x++) if ((x * 7 + y * 3) % 5 === 0) set(x, y, y < 8 ? hat.m : hat.d);
      for (let x = 13; x <= 34; x += 2) set(x, 14, hat.d);
      // A plain star: a point, the arms, two legs.
      if (badge) { rect(23, 9, 24, 9, badge); rect(21, 10, 26, 10, badge); rect(22, 11, 25, 11, badge); rect(21, 12, 22, 12, badge); rect(25, 12, 26, 12, badge); }
      break;
    }
    case "field": {
      // Soft field cap with a cloth peak.
      rect(14, 4, 33, 12, hat.m); row(3, 16, 31, hat.m);
      rect(14, 4, 21, 7, hat.l); rect(30, 4, 33, 12, hat.d);
      row(10, 14, 33, hat.d);
      row(13, 14, 33, hat.d); rect(15, 14, 32, 14, hat.m); row(14, 27, 32, hat.d);
      if (spec.capButtons) { set(23, 8, spec.capButtons); set(24, 8, spec.capButtons); set(23, 11, spec.capButtons); set(24, 11, spec.capButtons); }
      if (badge) { rect(23, 6, 24, 6, badge); rect(22, 7, 25, 7, badge); rect(23, 8, 24, 8, badge); set(22, 9, badge); set(25, 9, badge); }
      if (spec.capBand) { rect(14, 11, 33, 12, spec.capBand); }
      break;
    }
    case "alpine": {
      // Felt mountain hat with a brim, a band and a tall feather.
      oval(23.5, 9, 10, 8, hat.m, (x, y) => y <= 13);
      oval(21, 6, 6, 3.5, hat.l);
      oval(23.5, 9, 10, 8, hat.d, (x, y) => y <= 13 && x >= 30);
      rect(14, 11, 33, 12, "#2e2c26");
      rect(9, 13, 38, 14, hat.m); row(14, 10, 37, hat.d); row(13, 9, 20, hat.l);
      for (let i = 0; i < 12; i++) { set(15 - Math.floor(i / 2), 11 - i, "#22201e"); set(16 - Math.floor(i / 2), 11 - i, "#4a4844"); }
      if (badge) { rect(22, 6, 25, 9, badge); set(22, 6, hat.m); set(25, 6, hat.m); }
      break;
    }
  }

  // Dark outline around the whole figure.
  const solid = px.map((r) => r.map((c) => c !== null));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (solid[y][x]) continue;
    if ([[1, 0], [-1, 0], [0, 1], [0, -1]].some(([dx, dy]) => solid[y + dy]?.[x + dx])) px[y][x] = INK;
  }
  // Background: a plain two-tone panel in the commander's color, and a frame.
  const [topColor, bottomColor] = spec.bg;
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (px[y][x] === null) px[y][x] = y < 36 ? topColor : bottomColor;
    if (x === 0 || y === 0 || x === W - 1 || y === H - 1) px[y][x] = INK;
  }
  return px;
}

const KHAKI_SHIRT = "#c8b47c", KHAKI_TIE = "#8a7848";
const brownBelt = (strap) => ({ leather: LEATHER, buckle: GOLD, strap });

export const COMMANDERS = [
  {
    // US Army: steel helmet, the short olive drab field jacket, khaki shirt and tie.
    id: "harlan", name: "Walt Harlan", skin: "ruddy", cloth: "oliveDrab", hair: "brown", jaw: 1,
    hat: "helmet", hatCloth: "helmet", mouth: "grin", cigar: true, eyes: "#3c5a7c",
    uniform: { collar: "open", apex: 42, shirt: KHAKI_SHIRT, tie: KHAKI_TIE, tieShade: "#6c5c34", lapelDiscs: GOLD,
      pockets: { y: 43 }, buttonColor: GOLD, buttonShade: GOLD_D, placketTo: 56, ribbons: ["rbyg", "bwro"], waistband: true, buckle: GOLD,
      boards: "#7c7848", boardPips: SILVER },
    bg: ["#c8d0a8", "#a4b07c"],
  },
  {
    // US Navy: white-topped cap, double-breasted blue-black coat with gold buttons and cuff lace.
    id: "calloway", name: "Dale Calloway", skin: "fair", cloth: "navy", hair: "grey", lines: true,
    hat: "peaked", hatCloth: "white", band: "#22263a", chinStrap: GOLD, badge: GOLD, eyes: "#3c5a7c",
    uniform: { collar: "open", apex: 43, shirt: WHITE, shirtShade: "#c0bcb0", tie: "#16161c", double: true,
      buttons: [46, 51, 56], buttonColor: GOLD, buttonShade: GOLD_D, ribbons: ["rbywg", "bwrob", "ygwbr"], cuffLace: [56, 57, 60, 61] },
    bg: ["#c4d4e4", "#98b0c8"],
  },
  {
    // British Army: khaki service dress, staff cap with a red band, red collar patches, cross-belt.
    id: "ashdown", name: "Hugh Ashdown", skin: "fair", cloth: "serge", hair: "grey", lines: true,
    hat: "peaked", band: "#b03030", bandEdge: "#8c2424", badge: GOLD, moustache: "#c8c4b8", eyes: "#4a5a6c",
    uniform: { collar: "open", apex: 44, shirt: KHAKI_SHIRT, tie: KHAKI_TIE, tieShade: "#6c5c34", lapelPatch: "#b03030",
      buttons: [46, 51], buttonColor: GOLD, buttonShade: GOLD_D, pockets: { y: 42, pleat: true }, ribbons: ["rbyw", "gwrb"],
      belt: brownBelt(true), boards: "#a8905c", boardPips: GOLD },
    bg: ["#dcc8a8", "#bca47c"],
  },
  {
    // Canadian Army: battledress blouse and a black armoured-corps beret, shirt and tie.
    id: "tremblay", name: "Luc Tremblay", skin: "fair", cloth: "serge", hair: "dark", jaw: -1,
    hat: "beret", hatCloth: "black", badge: SILVER, glasses: true, mouth: "smile",
    uniform: { collar: "open", apex: 39, shirt: KHAKI_SHIRT, tie: KHAKI_TIE, tieShade: "#6c5c34",
      pockets: { y: 42, pleat: true }, buttonColor: "#5c4e2e", placketTo: 56, waistband: true, buckle: SILVER,
      boards: "#a8905c", boardPips: GOLD, ribbons: ["rwb"] },
    bg: ["#e8d4b0", "#ccb488"],
  },
  {
    // Red Army: fur cap with a plain red star, khaki tunic with a standing collar and gold shoulder boards.
    id: "morozov", name: "Stepan Morozov", skin: "ruddy", cloth: "soviet", hair: "dark", jaw: 1,
    hat: "fur", hatCloth: "fur", badge: "#c03028", sternBrows: true, stubble: "#c08862",
    uniform: { collar: "stand", buttons: [35, 40, 45], buttonColor: GOLD, buttonShade: GOLD_D, placketTo: 48,
      pockets: { y: 42 }, boards: GOLD, boardEdge: "#c03028", boardPips: WHITE, medal: true, belt: brownBelt(true) },
    bg: ["#b8c4a0", "#94a078"],
  },
  {
    // German Army: field grey tunic with a dark green collar and plain collar bars, soft field cap,
    // scarf and field glasses. No eagle and no other emblem.
    id: "falk", name: "Konrad Falk", skin: "fair", cloth: "fieldGrey", hair: "sandy", jaw: -1, eyes: "#4a6c8c",
    hat: "field", capButtons: SILVER, sideburns: true, lines: true,
    uniform: { collar: "fall", collarCloth: "bottleGreen", collarBars: SILVER, buttons: [36, 41, 46, 51], buttonColor: SILVER, buttonShade: "#8a8e8a",
      pockets: { y: 41, pleat: true, scalloped: true }, boards: SILVER, boardEdge: "#2a3c30",
      belt: { leather: BLACK_LEATHER, buckle: SILVER, buckleInner: "#8a8e8a" }, binoculars: true },
    bg: ["#b4c0cc", "#8a98a8"],
  },
  {
    // Italian Army: grey-green tunic, mountain troops' hat with a feather, green collar flames, cross-belt.
    id: "ferrante", name: "Aldo Ferrante", skin: "tan", cloth: "greyGreen", hair: "black",
    hat: "alpine", badge: GOLD, moustache: "#22201e", mouth: "smile",
    uniform: { collar: "open", apex: 43, shirt: "#a8b09c", tie: "#3a4034", lapelPatch: "#2c7a44",
      buttons: [45, 50], buttonColor: GOLD, buttonShade: GOLD_D, pockets: { y: 42, scalloped: true }, ribbons: ["bwb", "rgy"],
      belt: brownBelt(true), boards: "#98a08c", boardPips: GOLD },
    bg: ["#bcd0ec", "#90acd8"],
  },
  {
    // Japanese Army: khaki tunic with a turned-down collar and red collar patches, field cap with a
    // plain star, cross-belt.
    id: "arakawa", name: "Kenji Arakawa", skin: "tan", cloth: "jpKhaki", hair: "grey",
    hat: "field", badge: GOLD, capBand: "#64562c", sternBrows: true, browColor: "#5a5650", beard: "#b8b4aa", beardShade: "#8c887e",
    uniform: { collar: "fall", collarTabs: "#c03028", collarStars: GOLD, buttons: [36, 41, 46, 51], buttonColor: GOLD, buttonShade: GOLD_D,
      pockets: { y: 41, scalloped: true }, belt: brownBelt(true), ribbons: ["ryr"] },
    bg: ["#ecdcb4", "#d0b888"],
  },
];

function blit(target, grid, ox, oy, scale, crop = { x: 0, y: 0, w: W, h: H }) {
  for (let y = 0; y < crop.h; y++) for (let x = 0; x < crop.w; x++) {
    const color = rgba(grid[crop.y + y][crop.x + x]);
    for (let sy = 0; sy < scale; sy++) for (let sx = 0; sx < scale; sx++) {
      target.px.set(color, ((oy + y * scale + sy) * target.w + ox + x * scale + sx) * 4);
    }
  }
}

mkdirSync(OUT, { recursive: true });
const SCALE = 3, GAP = 8;
// The turn bar shows only the head: a 32x32 crop with its own frame.
const HEAD = { x: 8, y: 0, w: 32, h: 32 };
const sheet = canvas(COMMANDERS.length * (W * SCALE + GAP) + GAP, H * SCALE + GAP * 2);
sheet.px.fill(255);
COMMANDERS.forEach((spec, i) => {
  const grid = portrait(spec);
  const one = canvas(W, H);
  blit(one, grid, 0, 0, 1);
  savePng(one, `${OUT}/${spec.id}.png`);
  const big = canvas(W * SCALE, H * SCALE);
  blit(big, grid, 0, 0, SCALE);
  savePng(big, `${OUT}/${spec.id}-x3.png`);
  const headGrid = grid.map((r) => [...r]);
  for (let k = 0; k < 32; k++) {
    headGrid[HEAD.y + 31][HEAD.x + k] = INK; headGrid[HEAD.y + k][HEAD.x] = INK; headGrid[HEAD.y + k][HEAD.x + 31] = INK;
  }
  const head = canvas(32, 32);
  blit(head, headGrid, 0, 0, 1, HEAD);
  savePng(head, `${OUT}/${spec.id}-head.png`);
  blit(sheet, grid, GAP + i * (W * SCALE + GAP), GAP, SCALE);
});
savePng(sheet, `${OUT}/sheet.png`);
console.log(`Wrote ${COMMANDERS.length} portraits to ${OUT}/`);
