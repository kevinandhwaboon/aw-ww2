// Aircraft and ships at 32x32, top-down 3/4 view, facing right, two idle frames each
// (docs/08-art-pipeline.md §17). Aircraft bob and their propellers spin; ships rock and their
// bow wave and wake shift. Germany only gets ships its navy fielded here (01-units §4). Japanese
// aircraft carry the hinomaru; ships carry no marking.
import { finish, hinomaru, sprite, star } from "./kit32.mjs";

const frames = (draw) => [draw(0), draw(1)];

/** Camouflage patches painted into the current shape. */
function camo(s, spots) {
  for (const [x0, y0, x1, y1] of spots) s.fill(x0, y0, x1, y1, "team", 3);
}

/**
 * An aircraft seen from above and a little behind: the far wing foreshortened above the fuselage,
 * the near wing larger below it, a tailplane and fin, a canopy, and a spinning propeller.
 */
function plane(frame, o) {
  const s = sprite();
  const lift = frame ? -1 : 0;
  const y = (v) => v + lift;
  const c = o.centre ?? 14;
  // Far wing and far tailplane, behind the fuselage.
  s.poly(o.farWing.map(([px, py]) => [px, y(py)]), "team", 2);
  if (o.farEngine) for (const ex of o.farEngine) s.rect(ex, y(c - 7), ex + 5, y(c - 5), "team", 2, true);
  s.poly([[o.tail + 1, y(c - 1)], [o.tail + 6, y(c - 1)], [o.tail + 5, y(c - 4)], [o.tail + 2, y(c - 4)]], "team", 2);
  // Fuselage: thick at the wing, tapering to the tail, rounded nose.
  s.poly([[o.tail, y(c - 1)], [o.nose - 3, y(c - o.girth)], [o.nose, y(c - 1)], [o.nose, y(c + 1)], [o.nose - 3, y(c + o.girth)], [o.tail, y(c + 2)]], "team", 1);
  if (o.ribs) for (let x = o.tail + 3; x < o.nose - 3; x += 2) s.line(x, y(c - o.girth + 1), x, y(c + o.girth - 1), "team", 2);
  if (o.windows) for (let x = o.windows[0]; x <= o.windows[1]; x += 2) s.dot(x, y(c - 1), "glass", 0);
  if (o.camo) camo(s, o.camo.map(([a, b, cc, d]) => [a, y(b), cc, y(d)]));
  if (o.bodySun) hinomaru(s, o.bodySun[0], y(c), 1.5);
  s.fill(o.canopy[0], y(c - o.girth + 1), o.canopy[1], y(c - 1), "glass", 0);
  if (o.glassNose) s.fill(o.nose - 3, y(c - 1), o.nose - 1, y(c), "glass", 0);
  // Fin standing up from the tail.
  s.poly([[o.tail, y(c - 1)], [o.tail + 5, y(c - 1)], [o.tail + 2, y(c - o.fin)], [o.tail, y(c - o.fin)]], "team", 0);
  // Near wing and tailplane, in front of the fuselage.
  s.poly(o.nearWing.map(([px, py]) => [px, y(py)]), "team", 1);
  if (o.star) star(s, o.star[0], y(o.star[1]));
  if (o.sun) hinomaru(s, o.sun[0], y(o.sun[1]), o.sun[2] ?? 2.5);
  if (o.wingCamo) camo(s, o.wingCamo.map(([a, b, cc, d]) => [a, y(b), cc, y(d)]));
  s.poly([[o.tail + 1, y(c + 2)], [o.tail + 6, y(c + 2)], [o.tail + 5, y(c + 6)], [o.tail + 1, y(c + 6)]], "team", 1);
  if (o.gear) for (const gx of o.gear) s.rect(gx, y(c + 3), gx + 1, y(c + 5), "rubber", 3);
  // A bomb or torpedo slung under the fuselage, drawn over the near wing root.
  if (o.store) s.rect(o.store[0], y(c + 3), o.store[1], y(c + 4), "metal", 3);
  // Engines on the near wing, each with its own propeller.
  const props = [];
  if (o.nearEngine) for (const ex of o.nearEngine) {
    s.rect(ex, y(c + 4), ex + 6, y(c + 7), "team", 2, true);
    props.push([ex + 7, c + 5.5, 4]);
  }
  if (o.farEngine) for (const ex of o.farEngine) props.push([ex + 6, c - 6, 3]);
  if (o.noseProp) props.push([o.nose + 1, c, o.noseProp]);
  // Propeller blur: a tall disc in one frame, a short one in the other.
  for (const [px, py, r] of props) {
    const reach = frame ? r * 0.55 : r;
    s.shape();
    s.line(px, y(py - reach), px, y(py + reach), "metal", 0);
    s.dot(px - 1, y(py), "metal", 3);
  }
  return finish(s);
}

/**
 * A ship seen from above and a little to the side: the deck, the hull side as a band below it,
 * foam at the bow and a wake at the stern that shift between frames, and the ship rocks a pixel.
 */
function ship(frame, o) {
  const s = sprite();
  const rock = frame;
  const y = (v) => v + rock;
  const { stern, bow, deck, side } = o;
  // Hull side band, with the waterline at its foot.
  s.poly([[stern, y(deck + o.beam)], [bow - 4, y(deck + o.beam)], [bow, y(deck + o.beam / 2)], [bow - 3, y(deck + o.beam + side)], [stern + 1, y(deck + o.beam + side)]], "team", 3);
  // Deck: a long pointed plane.
  s.poly([[stern, y(deck)], [bow - 6, y(deck)], [bow, y(deck + o.beam / 2)], [bow - 6, y(deck + o.beam)], [stern, y(deck + o.beam)]], "team", 1);
  if (o.wellDeck) s.fill(o.wellDeck[0], y(deck + 2), o.wellDeck[1], y(deck + o.beam - 2), "team", 4);
  if (o.camo) camo(s, o.camo.map(([a, b, c, d]) => [a, y(b), c, y(d)]));
  if (o.star) star(s, o.star[0], y(o.star[1]));
  // Superstructure, funnels, turrets with barrels pointing forward, masts.
  for (const [x0, y0, x1, y1] of o.blocks ?? []) s.rect(x0, y(y0), x1, y(y1), "team", 0, true).shadow();
  for (const [fx, fy] of o.funnels ?? []) s.oval(fx, y(fy), 1.8, 1.6, "team", 3).shadow();
  for (const [tx, ty, len, r = 2.2] of o.turrets ?? []) {
    s.oval(tx, y(ty), r, r * 0.8, "team", 1, true).shadow();
    s.rect(tx + r, y(ty - 0.5), tx + r + len, y(ty), "metal", 2);
  }
  for (const [mx, my, h] of o.masts ?? []) s.line(mx, y(my), mx, y(my - h), "metal", 2);
  // Bow wave and stern wake.
  s.shape();
  const water = deck + o.beam + side + 1;
  for (let x = stern - 2; x <= bow + 1; x++) if ((x + frame) % 3 !== 0 && (x < stern + 4 || x > bow - 6)) s.dot(x, water, "card", 0);
  for (let x = Math.max(0, stern - 4); x < stern; x++) if ((x + frame) % 2 === 0) s.dot(x, water - 2 - ((x + frame) % 3), "card", 0);
  return finish(s);
}

/**
 * A carrier: a hull band under a flat flight deck that runs almost bow to stern, a dashed white
 * centerline, aircraft parked aft, and the island on the near (starboard) side. Same rock, bow
 * wave and wake as the other ships.
 */
function carrier(frame, o) {
  const s = sprite();
  const y = (v) => v + frame;
  const deck = 11, beam = 10, side = 4;
  const near = deck + beam;
  s.poly([[2, y(near)], [27, y(near)], [31, y(near - 3)], [29, y(near + side)], [3, y(near + side)]], "team", 3);
  if (o.sideFunnels) for (const fx of o.sideFunnels) s.oval(fx, y(near + 1), 1.4, 1.6, "team", 2).shadow();
  s.poly([[1, y(deck)], [27, y(deck)], [31, y(deck + 3)], [31, y(near - 3)], [27, y(near)], [1, y(near)]], o.deck, 1);
  for (let x = 3; x <= 28; x += 4) s.fill(x, y(deck + 5), x + 1, y(deck + 5), "card", 0);
  for (const ex of o.elevators) s.fill(ex, y(deck + 2), ex + 2, y(deck + 3), o.deck, 3);
  // Aircraft parked aft: fuselage along the deck, wings across it.
  for (const [px, py] of [[4, deck + 2], [4, deck + 7], [9, deck + 2], [9, deck + 7]]) {
    s.rect(px - 1, y(py + 1), px + 2, y(py + 1), "team", 0);
    s.fill(px + 1, y(py), px + 1, y(py + 2), "team", 0);
  }
  // The island standing up from the near deck edge, with its funnel and mast.
  const [ix0, ix1] = o.island;
  s.rect(ix0, y(near - 7), ix1, y(near - 1), "team", 1, true).shadow();
  s.fill(ix0 + 1, y(near - 5), ix1 - 1, y(near - 5), "glass", 0);
  s.rect(ix0 + 1, y(near - 9), ix1 - 2, y(near - 7), "team", 0, true).shadow();
  if (o.funnel !== undefined) s.oval(o.funnel, y(near - 8), 1.6, 1.4, "team", 3).shadow();
  s.shape().line(ix0 + 2, y(near - 10), ix0 + 2, y(near - 10 - o.mast), "metal", 2);
  s.shape();
  const water = near + side + 1;
  for (let x = 0; x <= 31; x++) if ((x + frame) % 3 !== 0 && (x < 5 || x > 26)) s.dot(x, water, "card", 0);
  for (let x = 0; x < 3; x++) if ((x + frame) % 2 === 0) s.dot(x, water - 2 - ((x + frame) % 3), "card", 0);
  return finish(s);
}

// ---- US aircraft ----
const p51 = (f) => plane(f, {
  tail: 2, nose: 27, girth: 3, fin: 7, canopy: [17, 20], noseProp: 4,
  farWing: [[12, 12], [20, 12], [17, 6], [17, 6]], nearWing: [[11, 16], [21, 16], [18, 27], [15, 27]], star: [13, 20],
});
const b26 = (f) => plane(f, {
  tail: 1, nose: 30, girth: 3, fin: 9, canopy: [21, 24], glassNose: true,
  farWing: [[12, 12], [22, 12], [19, 4], [17, 4]], nearWing: [[11, 16], [23, 16], [20, 29], [16, 29]], star: [14, 22],
  farEngine: [16], nearEngine: [16],
});
const c47 = (f) => plane(f, {
  tail: 1, nose: 29, girth: 4, fin: 9, canopy: [24, 26], windows: [8, 20],
  farWing: [[11, 11], [22, 11], [19, 3], [16, 3]], nearWing: [[10, 17], [23, 17], [20, 30], [15, 30]], star: [13, 23],
  farEngine: [17], nearEngine: [17],
});

// Carrier aircraft (05-supply-transport §10): single radial engine, a long canopy for the crew.
const sbd = (f) => plane(f, {
  tail: 3, nose: 27, girth: 3, fin: 7, canopy: [13, 21], noseProp: 4, store: [14, 18],
  farWing: [[12, 12], [21, 12], [18, 6], [16, 6]], nearWing: [[11, 16], [22, 16], [19, 26], [15, 26]], star: [15, 20],
});
const avenger = (f) => plane(f, {
  tail: 2, nose: 27, girth: 4, fin: 8, canopy: [12, 22], noseProp: 4, store: [9, 21],
  farWing: [[12, 11], [22, 11], [19, 4], [16, 4]], nearWing: [[11, 17], [23, 17], [20, 28], [15, 28]], star: [15, 22],
});

// ---- German aircraft ----
const bf109 = (f) => plane(f, {
  tail: 2, nose: 28, girth: 2, fin: 7, canopy: [16, 19], noseProp: 4,
  farWing: [[13, 13], [20, 13], [17, 7], [18, 7]], nearWing: [[12, 16], [21, 16], [18, 26], [16, 26]],
  camo: [[6, 12, 9, 13], [20, 14, 23, 15]], wingCamo: [[14, 19, 16, 21], [16, 23, 18, 24]],
});
const ju88 = (f) => plane(f, {
  tail: 1, nose: 29, girth: 3, fin: 8, canopy: [24, 28], glassNose: true,
  farWing: [[11, 12], [21, 12], [18, 4], [16, 4]], nearWing: [[10, 16], [22, 16], [19, 29], [15, 29]],
  farEngine: [15], nearEngine: [15], camo: [[5, 13, 9, 14]], wingCamo: [[13, 22, 16, 24]],
});
const ju52 = (f) => plane(f, {
  tail: 1, nose: 28, girth: 4, fin: 8, canopy: [23, 25], ribs: true, noseProp: 4, gear: [16, 21],
  farWing: [[10, 11], [22, 11], [19, 3], [15, 3]], nearWing: [[9, 17], [23, 17], [20, 30], [14, 30]],
  farEngine: [16], nearEngine: [16],
});

// ---- US ships ----
const texas = (f) => ship(f, {
  stern: 1, bow: 31, deck: 12, beam: 8, side: 4,
  turrets: [[8, 15, 5], [12, 15, 4], [22, 15, 5], [26, 15, 4]],
  blocks: [[14, 11, 19, 17]], funnels: [[17, 13]], masts: [[15, 11, 8], [20, 12, 6]],
});
const fletcher = (f) => ship(f, {
  stern: 2, bow: 31, deck: 14, beam: 5, side: 3,
  turrets: [[6, 16, 3, 1.6], [25, 16, 3, 1.6], [22, 16, 2, 1.4]],
  blocks: [[17, 13, 21, 18]], funnels: [[12, 16], [15, 16]], masts: [[19, 13, 7]],
});
const gato = (f) => ship(f, {
  stern: 2, bow: 31, deck: 17, beam: 4, side: 2,
  blocks: [[14, 13, 18, 19]], turrets: [[21, 18, 2, 1.2]], masts: [[16, 13, 6], [17, 13, 4]],
});
const lct = (f) => ship(f, {
  stern: 2, bow: 29, deck: 13, beam: 8, side: 4, wellDeck: [8, 26],
  blocks: [[2, 10, 7, 20]], masts: [[4, 10, 6]], star: [15, 15],
});
const ptBoat = (f) => ship(f, {
  stern: 6, bow: 28, deck: 16, beam: 4, side: 3,
  blocks: [[14, 14, 19, 19]], turrets: [[10, 17, 2, 1.2], [23, 17, 2, 1.2]], masts: [[16, 14, 5]],
});

const essex = (f) => carrier(f, { deck: "metal", elevators: [12, 25], island: [16, 22], funnel: 21, mast: 3 });

// ---- German ships ----
const zClass = (f) => ship(f, {
  stern: 1, bow: 31, deck: 14, beam: 5, side: 3,
  turrets: [[5, 16, 3, 1.8], [26, 16, 3, 1.8]], camo: [[8, 15, 11, 17], [21, 15, 23, 17]],
  blocks: [[18, 12, 22, 18]], funnels: [[11, 16], [15, 16]], masts: [[20, 12, 8]],
});
const uBoat = (f) => ship(f, {
  stern: 2, bow: 31, deck: 17, beam: 4, side: 2,
  blocks: [[12, 12, 17, 19]], turrets: [[22, 18, 2, 1.2], [10, 16, 1, 1]], masts: [[14, 12, 5]],
});
const eBoat = (f) => ship(f, {
  stern: 4, bow: 30, deck: 16, beam: 4, side: 3,
  blocks: [[18, 13, 22, 19]], turrets: [[9, 17, 2, 1.2], [25, 17, 2, 1.2]], camo: [[11, 17, 14, 18]], masts: [[20, 13, 5]],
});

// ---- Japanese aircraft ----
const zero = (f) => plane(f, {
  tail: 2, nose: 27, girth: 3, fin: 6, canopy: [14, 20], noseProp: 4,
  farWing: [[11, 12], [21, 12], [18, 5], [15, 5]], nearWing: [[10, 16], [22, 16], [19, 28], [14, 28]], sun: [16, 22], bodySun: [7],
});
const betty = (f) => plane(f, {
  tail: 1, nose: 30, girth: 4, fin: 8, canopy: [22, 25], glassNose: true,
  farWing: [[12, 11], [22, 11], [19, 3], [16, 3]], nearWing: [[11, 17], [23, 17], [20, 30], [15, 30]], sun: [17, 25, 2],
  farEngine: [17], nearEngine: [17], bodySun: [7],
});
const ki57 = (f) => plane(f, {
  tail: 1, nose: 29, girth: 4, fin: 8, canopy: [24, 26], windows: [9, 19],
  farWing: [[11, 11], [22, 11], [19, 3], [16, 3]], nearWing: [[10, 17], [23, 17], [20, 30], [15, 30]], sun: [16, 26, 2],
  farEngine: [17], nearEngine: [17],
});

const val = (f) => plane(f, {
  tail: 3, nose: 27, girth: 3, fin: 7, canopy: [12, 21], noseProp: 4, gear: [19], store: [14, 17],
  farWing: [[12, 12], [21, 12], [18, 6], [16, 6]], nearWing: [[11, 16], [22, 16], [19, 26], [15, 26]], sun: [16, 21, 2], bodySun: [7],
});
const kate = (f) => plane(f, {
  tail: 2, nose: 28, girth: 3, fin: 7, canopy: [10, 22], noseProp: 4, store: [9, 21],
  farWing: [[12, 11], [22, 11], [19, 4], [16, 4]], nearWing: [[11, 17], [23, 17], [20, 28], [15, 28]], sun: [17, 23, 2], bodySun: [6],
});

// ---- Japanese ships ----
const yamato = (f) => ship(f, {
  stern: 1, bow: 31, deck: 12, beam: 8, side: 4,
  turrets: [[23, 16, 5, 2.6], [19, 15, 4, 2.4], [6, 16, 4, 2.6]],
  blocks: [[12, 9, 16, 18]], funnels: [[11, 14]], masts: [[14, 9, 9], [9, 12, 5]],
});
const kagero = (f) => ship(f, {
  stern: 2, bow: 31, deck: 14, beam: 5, side: 3,
  turrets: [[25, 16, 3, 1.8], [7, 16, 3, 1.8], [10, 16, 3, 1.8]],
  blocks: [[20, 13, 23, 18]], funnels: [[17, 16], [13, 16]], masts: [[21, 13, 7]],
});
const iBoat = (f) => ship(f, {
  stern: 1, bow: 31, deck: 17, beam: 4, side: 2,
  blocks: [[12, 12, 16, 19]], turrets: [[22, 18, 2, 1.3]], masts: [[14, 12, 6]],
});
const daihatsu = (f) => ship(f, {
  stern: 4, bow: 28, deck: 14, beam: 7, side: 4, wellDeck: [10, 25],
  blocks: [[4, 12, 9, 19]], masts: [[6, 12, 4]],
});
const gyoraitei = (f) => ship(f, {
  stern: 6, bow: 28, deck: 16, beam: 4, side: 3,
  blocks: [[15, 14, 19, 19]], turrets: [[11, 17, 2, 1.2]], masts: [[17, 14, 4]],
});

const shokaku = (f) => carrier(f, { deck: "wood", elevators: [11, 17, 25], island: [21, 25], mast: 3, sideFunnels: [15, 18] });

export const usAir = [
  { code: "FT", name: "Fighter", real: "P-51 Mustang", frames: frames(p51) },
  { code: "BM", name: "Bomber", real: "B-26 Marauder", frames: frames(b26) },
  { code: "TA", name: "Transport Aircraft", real: "C-47 Skytrain", frames: frames(c47) },
  { code: "DB", name: "Dive Bomber", real: "SBD Dauntless", frames: frames(sbd) },
  { code: "TR", name: "Torpedo Bomber", real: "TBF Avenger", frames: frames(avenger) },
];
export const usNaval = [
  { code: "BB", name: "Battleship", real: "USS Texas", frames: frames(texas) },
  { code: "DD", name: "Destroyer", real: "Fletcher class", frames: frames(fletcher) },
  { code: "SS", name: "Submarine", real: "Gato class", frames: frames(gato) },
  { code: "LC", name: "Landing Craft", real: "LCT", frames: frames(lct) },
  { code: "TB", name: "Torpedo Boat", real: "PT boat", frames: frames(ptBoat) },
  { code: "CV", name: "Carrier", real: "Essex class", frames: frames(essex) },
];
export const deAir = [
  { code: "FT", name: "Fighter", real: "Bf 109", frames: frames(bf109) },
  { code: "BM", name: "Bomber", real: "Ju 88", frames: frames(ju88) },
  { code: "TA", name: "Transport Aircraft", real: "Ju 52", frames: frames(ju52) },
];
export const deNaval = [
  { code: "DD", name: "Destroyer", real: "Z-class", frames: frames(zClass) },
  { code: "SS", name: "Submarine", real: "Type VII U-boat", frames: frames(uBoat) },
  { code: "TB", name: "Torpedo Boat", real: "S-boot (E-boat)", frames: frames(eBoat) },
];

export const jpAir = [
  { code: "FT", name: "Fighter", real: "A6M Zero", frames: frames(zero) },
  { code: "BM", name: "Bomber", real: "G4M (Betty)", frames: frames(betty) },
  { code: "TA", name: "Transport Aircraft", real: "Ki-57 (Topsy)", frames: frames(ki57) },
  { code: "DB", name: "Dive Bomber", real: "D3A (Val)", frames: frames(val) },
  { code: "TR", name: "Torpedo Bomber", real: "B5N (Kate)", frames: frames(kate) },
];
export const jpNaval = [
  { code: "BB", name: "Battleship", real: "Yamato class", frames: frames(yamato) },
  { code: "DD", name: "Destroyer", real: "Kagero class", frames: frames(kagero) },
  { code: "SS", name: "Submarine", real: "I-boat (Type B1)", frames: frames(iBoat) },
  { code: "LC", name: "Landing Craft", real: "Daihatsu", frames: frames(daihatsu) },
  { code: "TB", name: "Torpedo Boat", real: "Gyoraitei", frames: frames(gyoraitei) },
  { code: "CV", name: "Carrier", real: "Shōkaku class", frames: frames(shokaku) },
];

for (const u of [...usAir, ...usNaval, ...deAir, ...deNaval, ...jpAir, ...jpNaval]) for (const f of u.frames) {
  if (f.length !== 32 || f.some((r) => r.length !== 32)) throw new Error(`${u.code}: not 32x32`);
}
