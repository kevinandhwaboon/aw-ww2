// Aircraft and ships at 32x32, top-down 3/4 view, facing right, two idle frames each
// (docs/08-art-pipeline.md §17). Aircraft bob and their propellers spin; ships rock and their
// bow wave and wake shift. Germany only gets ships its navy fielded here (01-units §4). Japanese
// aircraft carry the hinomaru, Soviet aircraft the white-edged red star, German aircraft the
// Balkenkreuz (never the swastika on the fin); ships carry no marking.
// The USSR gets aircraft and one boat: the Volga Flotilla's armored boat as its Landing Craft, for
// Stalingrad; no carrier aircraft, as it had no carriers.
// Italian aircraft carry only the white fuselage band and the white rudder cross.
// British aircraft carry the RAF roundel; the Swordfish is a biplane, the Lancaster has four engines
// and twin fins.
import { balkenkreuz, finish, hinomaru, redStar, roundel, sprite, star } from "./kit32.mjs";
import { specViews } from "./facings32.mjs";

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
  if (o.bodyStar) redStar(s, o.bodyStar[0], y(c - 2), true);
  s.fill(o.canopy[0], y(c - o.girth + 1), o.canopy[1], y(c - 1), "glass", 0);
  if (o.glassNose) s.fill(o.nose - 3, y(c - 1), o.nose - 1, y(c), "glass", 0);
  if (o.bodyRoundel) roundel(s, o.bodyRoundel[0], y(c - 0.5), 2.2);
  // Italy: the white band round the rear fuselage that Axis aircraft wore in the Mediterranean.
  if (o.whiteBand) s.fill(o.whiteBand[0], y(c - o.girth + 1), o.whiteBand[0] + 1, y(c + 1), "star", 0);
  // Fin standing up from the tail; twin fins stand at the tailplane's tips instead.
  if (o.twinFin) {
    s.rect(o.tail + 1, y(c - o.fin), o.tail + 3, y(c - 3), "team", 0, true);
    s.rect(o.tail + 2, y(c + 1), o.tail + 4, y(c + 6), "team", 0, true);
  } else s.poly([[o.tail, y(c - 1)], [o.tail + 5, y(c - 1)], [o.tail + 2, y(c - o.fin)], [o.tail, y(c - o.fin)]], "team", 0);
  // Italy: the plain white cross on the rudder, without the Savoy crest (08-art-pipeline §12).
  if (o.tailCross) {
    s.fill(o.tail, y(c - o.fin + 3), o.tail + 2, y(c - o.fin + 3), "star", 0);
    s.fill(o.tail + 1, y(c - o.fin + 1), o.tail + 1, y(c - 2), "star", 0);
  }
  // The SM.79's hump: the gun position on top of the fuselage behind the cockpit.
  if (o.hump) {
    s.rect(o.hump[0], y(c - o.girth - 2), o.hump[1], y(c - o.girth), "team", 1, true);
    s.fill(o.hump[0] + 1, y(c - o.girth - 2), o.hump[1] - 1, y(c - o.girth - 2), "glass", 0);
  }
  // A biplane's upper wing, high over the fuselage on its struts.
  if (o.biplane) {
    for (const sx of [o.biplane[0] + 1, o.biplane[1] - 2]) s.line(sx, y(c - 7), sx + 1, y(c + 3), "metal", 2);
    s.rect(o.biplane[0], y(c - 9), o.biplane[1], y(c - 7), "team", 1, true);
  }
  // Near wing and tailplane, in front of the fuselage.
  s.poly(o.nearWing.map(([px, py]) => [px, y(py)]), "team", 1);
  if (o.star) star(s, o.star[0], y(o.star[1]));
  if (o.sun) hinomaru(s, o.sun[0], y(o.sun[1]), o.sun[2] ?? 2.5);
  if (o.redStar) redStar(s, o.redStar[0], y(o.redStar[1]), true);
  if (o.roundel) roundel(s, o.roundel[0], y(o.roundel[1]), 2.6);
  if (o.wingCamo) camo(s, o.wingCamo.map(([a, b, cc, d]) => [a, y(b), cc, y(d)]));
  if (o.cross) balkenkreuz(s, o.cross[0] - 2, y(o.cross[1]) - 2, 5);
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

/** A unit drawn from a spec: called with a frame it draws the side view; it keeps its spec for the other views. */
const def = (kind, o) => Object.assign((f) => ({ plane, ship, carrier })[kind](f, o), { kind, spec: o });
/** Front and rear views from the same spec (facings32.mjs). */
const views = (d) => specViews(d.kind, d.spec);

// ---- US aircraft ----
const p51 = def("plane", {
  tail: 2, nose: 27, girth: 3, fin: 7, canopy: [17, 20], noseProp: 4,
  farWing: [[12, 12], [20, 12], [17, 6], [17, 6]], nearWing: [[11, 16], [21, 16], [18, 27], [15, 27]], star: [13, 20],
});
const b26 = def("plane", {
  tail: 1, nose: 30, girth: 3, fin: 9, canopy: [21, 24], glassNose: true,
  farWing: [[12, 12], [22, 12], [19, 4], [17, 4]], nearWing: [[11, 16], [23, 16], [20, 29], [16, 29]], star: [14, 22],
  farEngine: [16], nearEngine: [16],
});
const c47 = def("plane", {
  tail: 1, nose: 29, girth: 4, fin: 9, canopy: [24, 26], windows: [8, 20],
  farWing: [[11, 11], [22, 11], [19, 3], [16, 3]], nearWing: [[10, 17], [23, 17], [20, 30], [15, 30]], star: [13, 23],
  farEngine: [17], nearEngine: [17],
});

// Carrier aircraft (05-supply-transport §10): single radial engine, a long canopy for the crew.
const sbd = def("plane", {
  tail: 3, nose: 27, girth: 3, fin: 7, canopy: [13, 21], noseProp: 4, store: [14, 18],
  farWing: [[12, 12], [21, 12], [18, 6], [16, 6]], nearWing: [[11, 16], [22, 16], [19, 26], [15, 26]], star: [15, 20],
});
const avenger = def("plane", {
  tail: 2, nose: 27, girth: 4, fin: 8, canopy: [12, 22], noseProp: 4, store: [9, 21],
  farWing: [[12, 11], [22, 11], [19, 4], [16, 4]], nearWing: [[11, 17], [23, 17], [20, 28], [15, 28]], star: [15, 22],
});

// ---- German aircraft ----
const bf109 = def("plane", {
  tail: 2, nose: 28, girth: 2, fin: 7, canopy: [16, 19], noseProp: 4,
  farWing: [[13, 13], [20, 13], [17, 7], [18, 7]], nearWing: [[12, 16], [21, 16], [18, 26], [16, 26]],
  camo: [[13, 12, 15, 13], [20, 14, 23, 15]], wingCamo: [[17, 24, 18, 25]], cross: [16, 19],
});
const ju88 = def("plane", {
  tail: 1, nose: 29, girth: 3, fin: 8, canopy: [24, 28], glassNose: true,
  farWing: [[11, 12], [21, 12], [18, 4], [16, 4]], nearWing: [[10, 16], [22, 16], [19, 29], [15, 29]],
  farEngine: [15], nearEngine: [15], camo: [[11, 13, 15, 14]], cross: [17, 25],
});
const ju52 = def("plane", {
  tail: 1, nose: 28, girth: 4, fin: 8, canopy: [23, 25], ribs: true, noseProp: 4, gear: [16, 21],
  farWing: [[10, 11], [22, 11], [19, 3], [15, 3]], nearWing: [[9, 17], [23, 17], [20, 30], [14, 30]],
  farEngine: [16], nearEngine: [16], cross: [17, 25],
});

// ---- Italian aircraft (Regia Aeronautica) ----
// White fuselage band and white rudder cross only: never the fasces roundels or the Savoy crest.
const c202 = def("plane", {
  tail: 2, nose: 28, girth: 2, fin: 7, canopy: [16, 19], noseProp: 4, whiteBand: [7], tailCross: true,
  farWing: [[12, 13], [20, 13], [18, 7], [16, 7]], nearWing: [[11, 16], [21, 16], [19, 26], [15, 26]],
  camo: [[9, 12, 11, 13], [21, 14, 23, 15]], wingCamo: [[14, 20, 16, 21], [17, 23, 18, 24]],
});
const sm79 = def("plane", {
  tail: 1, nose: 29, girth: 3, fin: 8, canopy: [21, 24], noseProp: 3, hump: [17, 21], whiteBand: [6], tailCross: true,
  farWing: [[11, 12], [22, 12], [19, 3], [16, 3]], nearWing: [[10, 16], [23, 16], [20, 29], [15, 29]],
  farEngine: [14], nearEngine: [13], camo: [[9, 12, 12, 13], [24, 14, 26, 15]], wingCamo: [[15, 21, 18, 23]],
});
const sm82 = def("plane", {
  tail: 1, nose: 29, girth: 4, fin: 9, canopy: [24, 26], windows: [9, 20], noseProp: 4, gear: [16, 21], whiteBand: [6], tailCross: true,
  farWing: [[10, 11], [22, 11], [19, 2], [15, 2]], nearWing: [[9, 17], [23, 17], [20, 30], [14, 30]],
  farEngine: [15], nearEngine: [15],
});

// ---- US ships ----
const texas = def("ship", {
  stern: 1, bow: 31, deck: 12, beam: 8, side: 4,
  turrets: [[8, 15, 5], [12, 15, 4], [22, 15, 5], [26, 15, 4]],
  blocks: [[14, 11, 19, 17]], funnels: [[17, 13]], masts: [[15, 11, 8], [20, 12, 6]],
});
const fletcher = def("ship", {
  stern: 2, bow: 31, deck: 14, beam: 5, side: 3,
  turrets: [[6, 16, 3, 1.6], [25, 16, 3, 1.6], [22, 16, 2, 1.4]],
  blocks: [[17, 13, 21, 18]], funnels: [[12, 16], [15, 16]], masts: [[19, 13, 7]],
});
const gato = def("ship", {
  stern: 2, bow: 31, deck: 17, beam: 4, side: 2,
  blocks: [[14, 13, 18, 19]], turrets: [[21, 18, 2, 1.2]], masts: [[16, 13, 6], [17, 13, 4]],
});
const lct = def("ship", {
  stern: 2, bow: 29, deck: 13, beam: 8, side: 4, wellDeck: [8, 26],
  blocks: [[2, 10, 7, 20]], masts: [[4, 10, 6]], star: [15, 15],
});
const ptBoat = def("ship", {
  stern: 6, bow: 28, deck: 16, beam: 4, side: 3,
  blocks: [[14, 14, 19, 19]], turrets: [[10, 17, 2, 1.2], [23, 17, 2, 1.2]], masts: [[16, 14, 5]],
});

const essex = def("carrier", { deck: "metal", elevators: [12, 25], island: [16, 22], funnel: 21, mast: 3 });

// ---- Supply Ships (05-supply-transport §3a): fleet oilers, the bridge amidships, the funnel aft, ----
// ---- and kingposts for the fuelling booms along the tank deck. ----
// US: a Cimarron class. UK: a Dale class RFA oiler. Japan: the Kazahaya, its bridge further forward.
const cimarron = def("ship", {
  stern: 1, bow: 31, deck: 13, beam: 6, side: 3,
  blocks: [[18, 10, 22, 18], [2, 11, 8, 18]], funnels: [[5, 12]], masts: [[13, 13, 6], [26, 13, 6], [20, 10, 6]],
});
const dale = def("ship", {
  stern: 1, bow: 31, deck: 13, beam: 6, side: 3,
  blocks: [[17, 11, 21, 18], [2, 11, 8, 18]], funnels: [[5, 12]], masts: [[12, 13, 5], [25, 13, 5]],
});
const kazahaya = def("ship", {
  stern: 1, bow: 31, deck: 13, beam: 6, side: 3,
  blocks: [[14, 10, 18, 18], [2, 11, 8, 18]], funnels: [[5, 11], [5, 13]], masts: [[16, 10, 8], [24, 13, 6]],
});

// ---- German ships ----
const zClass = def("ship", {
  stern: 1, bow: 31, deck: 14, beam: 5, side: 3,
  turrets: [[5, 16, 3, 1.8], [26, 16, 3, 1.8]], camo: [[8, 15, 11, 17], [21, 15, 23, 17]],
  blocks: [[18, 12, 22, 18]], funnels: [[11, 16], [15, 16]], masts: [[20, 12, 8]],
});
const uBoat = def("ship", {
  stern: 2, bow: 31, deck: 17, beam: 4, side: 2,
  blocks: [[12, 12, 17, 19]], turrets: [[22, 18, 2, 1.2], [10, 16, 1, 1]], masts: [[14, 12, 5]],
});
// Sea Lion barge (Prahm): a Rhine barge converted for the invasion of England in 1940, long, low and
// blunt, with a concrete floor in its open hold and a ramp cut into the bow. The German Landing Craft.
const prahm = def("ship", {
  stern: 1, bow: 30, deck: 14, beam: 7, side: 3, wellDeck: [7, 26],
  blocks: [[2, 11, 6, 20]], masts: [[4, 11, 5]],
});
const eBoat = def("ship", {
  stern: 4, bow: 30, deck: 16, beam: 4, side: 3,
  blocks: [[18, 13, 22, 19]], turrets: [[9, 17, 2, 1.2], [25, 17, 2, 1.2]], camo: [[11, 17, 14, 18]], masts: [[20, 13, 5]],
});

// ---- Japanese aircraft ----
const zero = def("plane", {
  tail: 2, nose: 27, girth: 3, fin: 6, canopy: [14, 20], noseProp: 4,
  farWing: [[11, 12], [21, 12], [18, 5], [15, 5]], nearWing: [[10, 16], [22, 16], [19, 28], [14, 28]], sun: [16, 22], bodySun: [7],
});
const betty = def("plane", {
  tail: 1, nose: 30, girth: 4, fin: 8, canopy: [22, 25], glassNose: true,
  farWing: [[12, 11], [22, 11], [19, 3], [16, 3]], nearWing: [[11, 17], [23, 17], [20, 30], [15, 30]], sun: [17, 25, 2],
  farEngine: [17], nearEngine: [17], bodySun: [7],
});
const ki57 = def("plane", {
  tail: 1, nose: 29, girth: 4, fin: 8, canopy: [24, 26], windows: [9, 19],
  farWing: [[11, 11], [22, 11], [19, 3], [16, 3]], nearWing: [[10, 17], [23, 17], [20, 30], [15, 30]], sun: [16, 26, 2],
  farEngine: [17], nearEngine: [17], bodySun: [6],
});

const val = def("plane", {
  tail: 3, nose: 27, girth: 3, fin: 7, canopy: [12, 21], noseProp: 4, gear: [19], store: [14, 17],
  farWing: [[12, 12], [21, 12], [18, 6], [16, 6]], nearWing: [[11, 16], [22, 16], [19, 26], [15, 26]], sun: [16, 21, 2], bodySun: [7],
});
const kate = def("plane", {
  tail: 2, nose: 28, girth: 3, fin: 7, canopy: [10, 22], noseProp: 4, store: [9, 21],
  farWing: [[12, 11], [22, 11], [19, 4], [16, 4]], nearWing: [[11, 17], [23, 17], [20, 28], [15, 28]], sun: [17, 23, 2], bodySun: [6],
});

// ---- Soviet aircraft ----
const yak9 = def("plane", {
  tail: 2, nose: 28, girth: 2, fin: 7, canopy: [15, 19], noseProp: 4,
  farWing: [[12, 13], [20, 13], [17, 7], [16, 7]], nearWing: [[11, 16], [21, 16], [18, 27], [15, 27]], redStar: [14, 18],
  bodyStar: [5],
});
// The Il-2 Sturmovik: a single big engine in an armored nose, a long canopy for pilot and gunner,
// wheel fairings under the wings and bombs under the centre section. The Soviet Bomber: the plane
// that attacked German tanks at Kursk.
const il2 = def("plane", {
  tail: 2, nose: 28, girth: 3, fin: 7, canopy: [13, 20], noseProp: 4, gear: [17, 21], store: [12, 17],
  farWing: [[11, 12], [22, 12], [19, 5], [16, 5]], nearWing: [[10, 16], [23, 16], [20, 28], [15, 28]], redStar: [15, 19],
  bodyStar: [4],
});
const li2 = def("plane", {
  tail: 1, nose: 29, girth: 4, fin: 9, canopy: [24, 26], windows: [8, 20],
  farWing: [[11, 11], [22, 11], [19, 3], [16, 3]], nearWing: [[10, 17], [23, 17], [20, 30], [15, 30]], redStar: [15, 21],
  farEngine: [17], nearEngine: [17], bodyStar: [4],
});

// ---- Soviet boats ----
// Project 1125 armored boat (bronekater) of the Volga Flotilla: a short, beamy river hull, a tank
// turret on the foredeck, an armored wheelhouse, and an open deck aft where it carried troops across
// to the city. The Soviet Landing Craft.
const bronekater = def("ship", {
  stern: 3, bow: 29, deck: 14, beam: 7, side: 4, wellDeck: [5, 14],
  blocks: [[15, 11, 19, 19]], turrets: [[24, 17, 3, 2.2]], masts: [[17, 11, 4]],
});

// ---- British aircraft ----
// Spitfire: slim, the elliptical wing, a long pointed nose and a bubble canopy.
const spitfire = def("plane", {
  tail: 2, nose: 28, girth: 2, fin: 7, canopy: [15, 18], noseProp: 4,
  farWing: [[11, 13], [20, 13], [18, 9], [15, 7], [13, 8]], nearWing: [[10, 16], [21, 16], [20, 21], [17, 27], [14, 27], [11, 22]],
  roundel: [15, 21], bodyRoundel: [7],
});
// Lancaster: a long fuselage, four engines on a big wing, a glazed nose, a turret on the spine and twin fins.
const lancaster = def("plane", {
  tail: 1, nose: 30, girth: 3, fin: 8, canopy: [21, 25], glassNose: true, twinFin: true,
  farWing: [[11, 12], [22, 12], [19, 2], [16, 2]], nearWing: [[10, 16], [23, 16], [21, 30], [15, 30]], roundel: [16, 26],
  farEngine: [13, 18], nearEngine: [11, 17], bodyRoundel: [6],
});
// The Dakota: the C-47 in RAF colors.
const dakota = def("plane", {
  tail: 1, nose: 29, girth: 4, fin: 9, canopy: [24, 26], windows: [8, 20],
  farWing: [[11, 11], [22, 11], [19, 3], [16, 3]], nearWing: [[10, 17], [23, 17], [20, 30], [15, 30]], roundel: [16, 23],
  farEngine: [17], nearEngine: [17], bodyRoundel: [5],
});
// Fairey Barracuda: a deep fuselage, a long glazed canopy, a bomb under the belly. Fleet Air Arm.
const barracuda = def("plane", {
  tail: 2, nose: 27, girth: 4, fin: 8, canopy: [11, 21], noseProp: 4, store: [13, 18], gear: [19],
  farWing: [[12, 11], [21, 11], [18, 5], [16, 5]], nearWing: [[11, 16], [22, 16], [19, 26], [15, 26]], roundel: [16, 21], bodyRoundel: [6],
});
// Fairey Swordfish: a fabric biplane, open cockpits, fixed legs and a torpedo between them.
const swordfish = def("plane", {
  tail: 2, nose: 27, girth: 3, fin: 7, canopy: [14, 14], noseProp: 4, store: [9, 21], gear: [18, 21], biplane: [10, 23],
  farWing: [[13, 13], [20, 13], [19, 10], [14, 10]], nearWing: [[11, 16], [22, 16], [21, 22], [12, 22]], roundel: [16, 19], bodyRoundel: [6],
});

// ---- British ships ----
// HMS Warspite: four twin 15-inch turrets, two forward and two aft, the tall tower bridge, one funnel.
const warspite = def("ship", {
  stern: 1, bow: 31, deck: 12, beam: 8, side: 4,
  turrets: [[6, 15, 4, 2.2], [10, 15, 3, 2.2], [21, 15, 3, 2.2], [25, 15, 4, 2.2]],
  blocks: [[14, 9, 18, 17]], funnels: [[13, 13]], masts: [[16, 9, 9], [11, 12, 5]],
});
// Tribal class: four twin 4.7-inch mounts, two forward, two aft, a tall bridge and two funnels.
const tribal = def("ship", {
  stern: 2, bow: 31, deck: 14, beam: 5, side: 3,
  turrets: [[6, 16, 3, 1.6], [9, 16, 2, 1.6], [22, 16, 2, 1.6], [25, 16, 3, 1.6]],
  blocks: [[18, 13, 21, 18]], funnels: [[12, 16], [15, 16]], masts: [[19, 13, 7]],
});
// T-class submarine: the big bulged bow of its external torpedo tubes, the conning tower, a deck gun.
const tClass = def("ship", {
  stern: 2, bow: 31, deck: 17, beam: 4, side: 2,
  blocks: [[13, 13, 17, 19]], turrets: [[20, 18, 2, 1.2]], masts: [[15, 13, 5]],
});
const ukLct = def("ship", {
  stern: 2, bow: 29, deck: 13, beam: 8, side: 4, wellDeck: [8, 26],
  blocks: [[2, 10, 7, 20]], masts: [[4, 10, 6]],
});
// Vosper MTB: a hard-chined planing hull, a small bridge, torpedo tubes along the deck edges.
const mtb = def("ship", {
  stern: 6, bow: 28, deck: 16, beam: 4, side: 3,
  blocks: [[15, 14, 19, 19]], turrets: [[9, 17, 2, 1.2], [24, 17, 2, 1.2]], masts: [[17, 14, 5]],
});
// HMS Illustrious: an armored flight deck closing in the hangar, a small island with one funnel.
const illustrious = def("carrier", { deck: "metal", elevators: [10, 24], island: [17, 21], funnel: 20, mast: 2 });

// ---- Japanese ships ----
const yamato = def("ship", {
  stern: 1, bow: 31, deck: 12, beam: 8, side: 4,
  turrets: [[23, 16, 5, 2.6], [19, 15, 4, 2.4], [6, 16, 4, 2.6]],
  blocks: [[12, 9, 16, 18]], funnels: [[11, 14]], masts: [[14, 9, 9], [9, 12, 5]],
});
const kagero = def("ship", {
  stern: 2, bow: 31, deck: 14, beam: 5, side: 3,
  turrets: [[25, 16, 3, 1.8], [7, 16, 3, 1.8], [10, 16, 3, 1.8]],
  blocks: [[20, 13, 23, 18]], funnels: [[17, 16], [13, 16]], masts: [[21, 13, 7]],
});
const iBoat = def("ship", {
  stern: 1, bow: 31, deck: 17, beam: 4, side: 2,
  blocks: [[12, 12, 16, 19]], turrets: [[22, 18, 2, 1.3]], masts: [[14, 12, 6]],
});
const daihatsu = def("ship", {
  stern: 4, bow: 28, deck: 14, beam: 7, side: 4, wellDeck: [10, 25],
  blocks: [[4, 12, 9, 19]], masts: [[6, 12, 4]],
});
const gyoraitei = def("ship", {
  stern: 6, bow: 28, deck: 16, beam: 4, side: 3,
  blocks: [[15, 14, 19, 19]], turrets: [[11, 17, 2, 1.2]], masts: [[17, 14, 4]],
});

const shokaku = def("carrier", { deck: "wood", elevators: [11, 17, 25], island: [21, 25], mast: 3, sideFunnels: [15, 18] });

export const usAir = [
  { code: "FT", name: "Fighter", real: "P-51 Mustang", frames: frames(p51), views: views(p51) },
  { code: "BM", name: "Bomber", real: "B-26 Marauder", frames: frames(b26), views: views(b26) },
  { code: "TA", name: "Transport Aircraft", real: "C-47 Skytrain", frames: frames(c47), views: views(c47) },
  { code: "DB", name: "Dive Bomber", real: "SBD Dauntless", frames: frames(sbd), views: views(sbd) },
  { code: "TR", name: "Torpedo Bomber", real: "TBF Avenger", frames: frames(avenger), views: views(avenger) },
];
export const usNaval = [
  { code: "BB", name: "Battleship", real: "USS Texas", frames: frames(texas), views: views(texas) },
  { code: "DD", name: "Destroyer", real: "Fletcher class", frames: frames(fletcher), views: views(fletcher) },
  { code: "SS", name: "Submarine", real: "Gato class", frames: frames(gato), views: views(gato) },
  { code: "LC", name: "Landing Craft", real: "LCT", frames: frames(lct), views: views(lct) },
  { code: "TB", name: "Torpedo Boat", real: "PT boat", frames: frames(ptBoat), views: views(ptBoat) },
  { code: "CV", name: "Carrier", real: "Essex class", frames: frames(essex), views: views(essex) },
  { code: "SP", name: "Supply Ship", real: "Cimarron-class fleet oiler", frames: frames(cimarron), views: views(cimarron) },
];
export const deAir = [
  { code: "FT", name: "Fighter", real: "Bf 109", frames: frames(bf109), views: views(bf109) },
  { code: "BM", name: "Bomber", real: "Ju 88", frames: frames(ju88), views: views(ju88) },
  { code: "TA", name: "Transport Aircraft", real: "Ju 52", frames: frames(ju52), views: views(ju52) },
];
export const deNaval = [
  { code: "DD", name: "Destroyer", real: "Z-class", frames: frames(zClass), views: views(zClass) },
  { code: "SS", name: "Submarine", real: "Type VII U-boat", frames: frames(uBoat), views: views(uBoat) },
  { code: "LC", name: "Landing Craft", real: "Sea Lion barge (Prahm)", frames: frames(prahm), views: views(prahm) },
  { code: "TB", name: "Torpedo Boat", real: "S-boot (E-boat)", frames: frames(eBoat), views: views(eBoat) },
];

export const itAir = [
  { code: "FT", name: "Fighter", real: "Macchi C.202 Folgore", frames: frames(c202), views: views(c202) },
  { code: "BM", name: "Bomber", real: "SM.79 Sparviero", frames: frames(sm79), views: views(sm79) },
  { code: "TA", name: "Transport Aircraft", real: "SM.82 Marsupiale", frames: frames(sm82), views: views(sm82) },
];

export const suAir = [
  { code: "FT", name: "Fighter", real: "Yak-9", frames: frames(yak9), views: views(yak9) },
  { code: "BM", name: "Bomber", real: "Il-2 Sturmovik", frames: frames(il2), views: views(il2) },
  { code: "TA", name: "Transport Aircraft", real: "Li-2", frames: frames(li2), views: views(li2) },
];
export const suNaval = [
  { code: "LC", name: "Landing Craft", real: "Project 1125 armored boat", frames: frames(bronekater), views: views(bronekater) },
];

export const ukAir = [
  { code: "FT", name: "Fighter", real: "Spitfire", frames: frames(spitfire), views: views(spitfire) },
  { code: "BM", name: "Bomber", real: "Avro Lancaster", frames: frames(lancaster), views: views(lancaster) },
  { code: "TA", name: "Transport Aircraft", real: "Dakota (RAF C-47)", frames: frames(dakota), views: views(dakota) },
  { code: "DB", name: "Dive Bomber", real: "Fairey Barracuda", frames: frames(barracuda), views: views(barracuda) },
  { code: "TR", name: "Torpedo Bomber", real: "Fairey Swordfish", frames: frames(swordfish), views: views(swordfish) },
];
export const ukNaval = [
  { code: "BB", name: "Battleship", real: "HMS Warspite", frames: frames(warspite), views: views(warspite) },
  { code: "DD", name: "Destroyer", real: "Tribal class", frames: frames(tribal), views: views(tribal) },
  { code: "SS", name: "Submarine", real: "T class", frames: frames(tClass), views: views(tClass) },
  { code: "LC", name: "Landing Craft", real: "LCT", frames: frames(ukLct), views: views(ukLct) },
  { code: "TB", name: "Torpedo Boat", real: "Vosper MTB", frames: frames(mtb), views: views(mtb) },
  { code: "CV", name: "Carrier", real: "HMS Illustrious", frames: frames(illustrious), views: views(illustrious) },
  { code: "SP", name: "Supply Ship", real: "Dale-class RFA oiler", frames: frames(dale), views: views(dale) },
];

export const jpAir = [
  { code: "FT", name: "Fighter", real: "A6M Zero", frames: frames(zero), views: views(zero) },
  { code: "BM", name: "Bomber", real: "G4M (Betty)", frames: frames(betty), views: views(betty) },
  { code: "TA", name: "Transport Aircraft", real: "Ki-57 (Topsy)", frames: frames(ki57), views: views(ki57) },
  { code: "DB", name: "Dive Bomber", real: "D3A (Val)", frames: frames(val), views: views(val) },
  { code: "TR", name: "Torpedo Bomber", real: "B5N (Kate)", frames: frames(kate), views: views(kate) },
];
export const jpNaval = [
  { code: "BB", name: "Battleship", real: "Yamato class", frames: frames(yamato), views: views(yamato) },
  { code: "DD", name: "Destroyer", real: "Kagero class", frames: frames(kagero), views: views(kagero) },
  { code: "SS", name: "Submarine", real: "I-boat (Type B1)", frames: frames(iBoat), views: views(iBoat) },
  { code: "LC", name: "Landing Craft", real: "Daihatsu", frames: frames(daihatsu), views: views(daihatsu) },
  { code: "TB", name: "Torpedo Boat", real: "Gyoraitei", frames: frames(gyoraitei), views: views(gyoraitei) },
  { code: "CV", name: "Carrier", real: "Shōkaku class", frames: frames(shokaku), views: views(shokaku) },
  { code: "SP", name: "Supply Ship", real: "Kazahaya (fleet oiler)", frames: frames(kazahaya), views: views(kazahaya) },
];

for (const u of [...usAir, ...usNaval, ...deAir, ...deNaval, ...suAir, ...suNaval, ...ukAir, ...ukNaval, ...jpAir, ...jpNaval]) for (const f of u.frames) {
  if (f.length !== 32 || f.some((r) => r.length !== 32)) throw new Error(`${u.code}: not 32x32`);
}
