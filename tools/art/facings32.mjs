// Front and rear views of every unit at 32x32 (08-art-pipeline §22): "down" is the unit coming
// toward you (moving down the map), "up" is the unit going away (moving up the map). The side
// views in the nation files face right and are mirrored for left. Same 3/4 view from above, same
// light from the top left, same two frames, which step, roll or spin, since these views are shown
// while a unit moves.
import { finish, hinomaru, overlay, redStar, sprite, star, SUITS } from "./kit32.mjs";

const CX = 15.5;
const VIEWS = ["down", "up"];

/** A straight bar of any slope, as its own shape, `width` pixels thick across its whole length. */
function thick(s, x0, y0, x1, y1, width, mat, tone) {
  s.shape();
  const steps = Math.ceil(Math.hypot(x1 - x0, y1 - y0) * 2) || 1;
  const lo = -Math.floor((width - 1) / 2), hi = Math.ceil((width - 1) / 2);
  for (let i = 0; i <= steps; i++) {
    const x = x0 + ((x1 - x0) * i) / steps, y = y0 + ((y1 - y0) * i) / steps;
    for (let dy = lo; dy <= hi; dy++) for (let dx = lo; dx <= hi; dx++) {
      if (width > 3 && Math.abs(dx - 0.5) + Math.abs(dy - 0.5) > width - 1) continue;
      s.dot(x + dx, y + dy, mat, tone);
    }
  }
  return s;
}

/** Camouflage patches painted into the current shape. */
function camo(s, spots) {
  for (const [x0, y0, x1, y1] of spots) s.fill(x0, y0, x1, y1, "team", 3);
}

// ---- Helmets, seen from the front or the back ----

/** An upper half-ellipse dome, lit on the top left. */
function dome(s, cx, top, bottom, half, toneAt = null) {
  for (let y = top; y <= bottom; y++) {
    for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
      const dx = (x - cx) / half, dy = (y - (bottom + 0.5)) / (bottom - top + 0.5);
      if (dx * dx + dy * dy > 1) continue;
      const lit = dx * 0.7 + dy * 0.7;
      s.dot(x, y, "team", toneAt?.(y) ?? (lit < -0.55 ? 0 : lit < 0 ? 1 : 2));
    }
  }
}

const span = (s, cx, y, from, to, mat, tone, k = 1) => {
  for (let x = Math.round(cx + from * k); x <= Math.round(cx + to * k); x++) s.dot(x, y, mat, tone);
};

/**
 * The four helmets of 08-art-pipeline §17 seen head-on or from behind. `rim` is the row the brim
 * sits on; the back views come down further, over the back of the head.
 */
const HELMETS = {
  /** The US M1: a rounded dome widest at the rim, chinstraps down the cheeks. */
  m1(s, view, cx, top, rim, k = 1) {
    s.shape();
    dome(s, cx, top, rim - 1, 7 * k);
    span(s, cx, rim, -7.5, 7.5, "team", 3, k);
    if (view === "back") span(s, cx, rim + 1, -6.5, 6.5, "team", 3, k);
    else for (const sx of [-5, 5]) s.line(cx + sx * k, rim + 1, cx + sx * 0.8 * k, rim + 3, "team", 4);
  },
  /** The German Stahlhelm: a tall crown, a short visor, the skirt flaring over the ears and neck. */
  stahlhelm(s, view, cx, top, rim, k = 1) {
    s.shape();
    dome(s, cx, top - 1, rim - 2, 6 * k);
    span(s, cx, rim - 1, -7, 7, "team", 2, k);
    if (view === "back") {
      span(s, cx, rim, -7.5, 7.5, "team", 3, k);
      span(s, cx, rim + 1, -8, 8, "team", 3, k);
      span(s, cx, rim + 2, -8, 8, "team", 4, k);
    } else {
      for (const [y, a, b] of [[rim, 4.5, 7.5], [rim + 1, 5.5, 8], [rim + 2, 6, 8]]) {
        span(s, cx, y, -b, -a, "team", 3, k);
        span(s, cx, y, a, b, "team", 3, k);
      }
    }
  },
  /** The Japanese Type 90: a low round dome with a narrow rim over a cloth cap's neck flaps. */
  type90(s, view, cx, top, rim, k = 1) {
    s.shape();
    if (view === "back") for (let y = rim - 1; y <= rim + 5; y++) span(s, cx, y, -6, 6, "canvas", y === rim - 1 ? 1 : 2, k);
    else for (let y = rim - 1; y <= rim + 5; y++) for (const sx of [-1, 1]) span(s, cx, y, sx < 0 ? -7.5 : 5, sx < 0 ? -5 : 7.5, "canvas", 2, k);
    s.shape();
    dome(s, cx, top + 1, rim - 1, 6.6 * k);
    span(s, cx, rim, -7, 7, "team", 3, k);
  },
  /** The Soviet SSh-40: a tall dome with a short rim flaring out all round. */
  ssh40(s, view, cx, top, rim, k = 1) {
    s.shape();
    dome(s, cx, top - 1, rim - 1, 6.8 * k);
    span(s, cx, rim, -8, 8, "team", 3, k);
    if (view === "back") span(s, cx, rim + 1, -6.5, 6.5, "team", 3, k);
  },
};

// ---- Soldiers ----

/**
 * A soldier walking toward you or away. Legs swap between frames, so he steps as he moves, and the
 * arms swing against them. Options: helmet, legs ("trousers", "puttees", "boots": tall boots),
 * kit on the back ("pack", "sack" or "none"), roll (the Soviet greatcoat ring across the chest),
 * bedroll (a blanket roll on top of the pack), suit (a paratrooper's card suit on the helmet).
 */
function soldierBody(view, frame, o, { arms = true } = {}) {
  const s = sprite();
  const back = view === "up";
  // The forward leg reaches lower on the screen coming toward you, higher going away.
  const legs = [[10, frame === 0], [17, frame === 1]];
  for (const [lx, forward] of legs) {
    // The leg stepping toward you reaches lower on the screen; going away, the one stepping off does.
    const foot = back ? (forward ? 28 : 31) : (forward ? 31 : 28);
    s.rect(lx, 22, lx + 4, foot - 2, "team", forward ? 2 : 3);
    if (o.legs === "puttees") for (let y = 24; y <= foot - 3; y += 2) s.line(lx, y, lx + 4, y, "team", 3);
    const bootTop = o.legs === "boots" ? Math.min(25, foot - 3) : foot - 2;
    s.rect(lx - (lx < 15 ? 1 : 0), bootTop, lx + 4 + (lx > 15 ? 1 : 0), foot, "leather", forward ? 2 : 3);
  }
  s.rect(9, 14, 22, 23, "team", 1, true);
  if (!back) {
    if (o.roll) {
      // The skatka: the greatcoat rolled into a ring over one shoulder and across the chest.
      s.shape();
      for (let i = 0; i <= 10; i++) s.dot(10 + i * 1.1, 14 + i * 0.75, "canvas", 2).dot(10 + i * 1.1, 15 + i * 0.75, "canvas", 3).dot(11 + i * 1.1, 14 + i * 0.75, "canvas", 1);
    } else if (o.straps !== false) {
      s.line(12, 14, 12, 20, "leather", 1).line(19, 14, 19, 20, "leather", 1);
    }
    s.fill(10, 21, 21, 22, "leather", 2);
    for (let x = 11; x <= 20; x += 3) s.fill(x, 21, x + 1, 21, "leather", 0);
  }
  if (arms) {
    // Arms swing against the legs.
    const swing = frame ? 1 : -1;
    s.rect(6, 15 + swing, 9, 22 + swing, "team", 2);
    s.rect(22, 15 - swing, 25, 22 - swing, "team", 2);
    s.oval(7.5, 23 + swing, 1.5, 1.3, "skin", 1).oval(23.5, 23 - swing, 1.5, 1.3, "skin", 1);
  }
  if (back) {
    // Kit on the back covers most of the jacket.
    if (o.kit === "pack") s.rect(10, 14, 21, 22, "team", 3, true).fill(12, 16, 19, 16, "leather", 1);
    if (o.kit === "sack") s.rect(11, 16, 20, 22, "canvas", 2, true);
    if (o.bedroll) s.rect(9, 12, 22, 14, "canvas", 1);
    if (o.roll) {
      s.shape();
      for (let i = 0; i <= 10; i++) s.dot(21 - i * 1.1, 14 + i * 0.75, "canvas", 2).dot(21 - i * 1.1, 15 + i * 0.75, "canvas", 3).dot(20 - i * 1.1, 14 + i * 0.75, "canvas", 1);
    }
    s.rect(14, 12, 17, 14, "skin", 2);
  } else {
    s.oval(CX, 12.5, 4.6, 3.4, "skin", 1);
    s.dot(13, 12, "metal", 4).dot(18, 12, "metal", 4).dot(15, 14, "skin", 3).dot(16, 14, "skin", 3);
  }
  HELMETS[o.helmet](s, back ? "back" : "front", CX, 3, 10);
  if (o.suit) {
    SUITS[o.suit].forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === "S") s.dot(14 + x, 4 + y, "card", 0);
    }));
  }
  return s;
}

/** A long arm held at port arms across the chest (front), or slung across the back (rear). */
function longArm(view, { stock = "wood", bayonet = false, short = false }) {
  const r = sprite();
  if (view === "down") {
    thick(r, 7, 27, 13, 22, 3, stock, 1);
    thick(r, 13, 22, 17, 18, 2, "metal", 2);
    thick(r, 17, 18, short ? 20 : 22, short ? 15 : 13, 2, stock, 0);
    thick(r, short ? 20 : 22, short ? 15 : 13, short ? 22 : 25, short ? 13 : 10, 1, "metal", 1);
    if (bayonet) thick(r, 25, 10, 28, 6, 1, "metal", 0);
  } else {
    thick(r, 9, 26, 13, 21, 3, stock, 1);
    thick(r, 13, 21, 23, 8, 2, stock, 0);
    thick(r, 23, 8, short ? 24 : 26, short ? 6 : 4, 1, "metal", 1);
    if (bayonet) thick(r, 26, 4, 28, 1, 1, "metal", 0);
  }
  return finish(r, false);
}

/** Hands on the weapon, over it. */
function grip(points) {
  const h = sprite();
  for (const [x, y] of points) h.oval(x, y, 1.5, 1.3, "skin", 1);
  return finish(h);
}

/** A launcher tube carried on the shoulder: muzzle toward you in front, the flared back end in the rear. */
function tube(view, { shield = false, bipod = false, width = 4 } = {}) {
  const t = sprite();
  if (view === "down") {
    thick(t, 6, 7, 15, 21, width, "metal", 2);
    t.oval(5, 5, 2.6, 2.6, "metal", 2);
    t.oval(CX, 23, 2.6, 2.4, "metal", 1).dot(CX, 23, "metal", 4);
    if (shield) t.rect(9, 13, 14, 19, "metal", 1, true).fill(10, 14, 12, 15, "glass", 0);
    if (bipod) t.line(15, 24, 12, 30, "metal", 2).line(17, 24, 19, 30, "metal", 2);
  } else {
    thick(t, 27, 4, 15, 22, width, "metal", 1);
    t.rect(12, 22, 17, 26, "metal", 2);
    t.dot(14, 24, "metal", 4);
    if (shield) t.rect(20, 9, 25, 15, "metal", 1, true);
  }
  return finish(t, false);
}

/** The PTRD-41: a very long anti-tank rifle carried over the shoulder, muzzle brake at the end. */
function ptrdRifle(view) {
  const r = sprite();
  if (view === "down") {
    thick(r, 2, 3, 9, 9, 3, "wood", 1);
    thick(r, 9, 10, 26, 25, 2, "metal", 1);
    r.rect(24, 24, 28, 27, "metal", 2);
  } else {
    thick(r, 29, 2, 12, 20, 2, "metal", 1);
    r.rect(1, 0, 4, 0, "metal", 2);
    thick(r, 12, 20, 7, 26, 3, "wood", 1);
  }
  return finish(r, false);
}

/** A mortar tube over the shoulder; from behind, the baseplate strapped on the back too. */
function mortarLoad(view) {
  const m = sprite();
  if (view === "down") {
    thick(m, 5, 4, 12, 20, 4, "metal", 1);
    m.dot(7, 5, "metal", 4);
  } else {
    m.oval(CX, 18, 5.5, 4, "metal", 2, true);
    m.dot(CX, 18, "metal", 4);
    thick(m, 26, 3, 20, 20, 4, "metal", 1);
  }
  return finish(m, false);
}

/** Soldier units: the rifleman, the anti-tank team and the mortar crew, by kind. */
function soldierUnit(o) {
  return (view, frame) => {
    const weapon = o.weapon;
    if (weapon === "rifle" || weapon === "carbine") {
      const body = finish(soldierBody(view, frame, o, { arms: view === "up" }));
      const arm = longArm(view, { stock: o.stock ?? "wood", bayonet: o.bayonet, short: weapon === "carbine" });
      if (view === "up") return overlay(body, arm);
      return overlay(finish(armsAcross(soldierBody(view, frame, o, { arms: false }), [[12, 23], [20, 16]])), arm, grip([[12, 23], [20, 16]]));
    }
    if (weapon === "tube" || weapon === "ptrd" || weapon === "mortar") {
      const load = weapon === "tube" ? tube(view, o.tube) : weapon === "ptrd" ? ptrdRifle(view) : mortarLoad(view);
      const body = finish(soldierBody(view, frame, o, { arms: view === "down" ? false : true }));
      if (view === "up") return overlay(body, load);
      const hands = weapon === "mortar" ? [[9, 15], [11, 20]] : weapon === "ptrd" ? [[10, 12], [15, 16]] : [[12, 18], [16, 23]];
      return overlay(finish(armsAcross(soldierBody(view, frame, o, { arms: false }), hands)), load, grip(hands));
    }
    throw new Error(`unknown weapon ${weapon}`);
  };
}

/** Arms reaching in to hold something in front of the chest. */
function armsAcross(s, [[lx, ly], [rx, ry]]) {
  s.rect(6, 15, 9, Math.max(17, ly - 1), "team", 2);
  thick(s, 8, Math.min(ly - 1, 20), lx, ly - 1, 3, "team", 2);
  s.rect(22, 15, 25, Math.max(17, ry), "team", 2);
  thick(s, 23, Math.min(ry + 1, 20), rx, ry - 1, 3, "team", 2);
  return s;
}

// ---- Tracked vehicles ----

/**
 * A tracked vehicle seen nose-on (down) or from the back (up): a track down each side whose treads
 * roll between frames, the hull between them, the front or rear plate as a band at the bottom, and
 * a turret or casemate on top with the gun pointing at you or away.
 *
 * o.w        half the overall width, tracks included
 * o.turret   { shape: "round" | "box" | "hex" | "open" | "casemate", w, h, y, dx, bustle }
 * o.gun      { w: barrel thickness, len, brake: muzzle brake, mantlet }
 * o.marking  "star" (US, on the engine deck), "redStar" (Soviet, on the turret), or none
 * extras: camo, rivets, skirts, spareTanks, handrail, rack (the Calliope's rockets), muffler, bowMg
 */
function tracked(o) {
  return (view, frame) => {
    const s = sprite();
    const down = view === "down";
    const dip = frame;
    const w = o.w ?? 11;
    const L = Math.round(CX - w), R = Math.round(CX + w);
    const tw = o.trackW ?? 4;
    const tTop = o.trackTop ?? 9;
    // Tracks, with tread bars that roll between frames.
    for (const x0 of [L, R - tw + 1]) {
      s.rect(x0, tTop, x0 + tw - 1, 30, "rubber", 3);
      for (let y = tTop + 1 + frame; y < 29; y += 2) s.line(x0 + 1, y, x0 + tw - 2, y, "rubber", 1);
      s.fill(x0, 28, x0 + tw - 1, 30, "metal", 3);
      if (o.skirts) s.rect(down ? x0 : x0, tTop + 2, x0 + tw - 1, 25, "team", 2, true);
    }
    const hl = L + tw - 1, hr = R - tw + 1;
    const plateTop = (o.plate ?? 24) + (down ? 0 : 1) + dip;
    // Hull top, then the front or rear plate.
    s.rect(hl, (o.hullTop ?? 8) + dip, hr, plateTop, "team", 1, true);
    if (o.camo) camo(s, o.camo.map(([a, b, c, d]) => [a, b + dip, c, d + dip]));
    if (o.rivets) for (let x = hl + 2; x < hr - 1; x += 3) s.dot(x, (o.hullTop ?? 8) + 2 + dip, "team", 3);
    if (!down) {
      // Engine deck grilles, and the US air-recognition star on it.
      for (let y = plateTop - 5; y <= plateTop - 1; y += 2) s.line(hl + 2, y, hr - 2, y, "team", 3);
      if (o.marking === "star") star(s, CX - 3.5, plateTop - 5);
    }
    s.rect(hl, plateTop, hr, 29 + dip, "team", 2);
    if (down) {
      s.dot(hl + 1, plateTop + 1, "metal", 0).dot(hr - 1, plateTop + 1, "metal", 0);
      if (o.bowMg) s.oval(hl + 4, plateTop + 2.5, 1.2, 1.2, "metal", 3);
    } else {
      // Exhausts and tail lights on the rear plate.
      for (const ex of o.exhausts ?? [hl + 3, hr - 3]) s.oval(ex, plateTop + 2.5, 1.3, 1.3, "metal", 3).dot(ex, plateTop + 2.5, "metal", 4);
      s.dot(hl + 1, plateTop + 1, "sun", 0).dot(hr - 1, plateTop + 1, "sun", 0);
    }
    if (o.spareTanks) {
      const ty = down ? (o.hullTop ?? 8) + 1 + dip : plateTop - 3;
      for (const tx of [hl + 2, hr - 2]) s.oval(tx, ty, 1.6, 2, "metal", 2);
    }
    if (o.muffler) s.oval(down ? hr - 1 : hl + 1, (down ? (o.hullTop ?? 8) + 3 : plateTop - 3) + dip, 1.5, 2.5, "metal", 2);
    turretAndGun(s, down, dip, o);
    return finish(s);
  };
}

/** A turret or casemate with its gun, and anything carried on top. */
function turretAndGun(s, down, dip, o) {
  const t = o.turret;
  const g = o.gun ?? { w: 2, len: 10 };
  const tx = CX + (t.dx ?? 0) * (down ? -1 : 1);
  // Turrets sit forward of the middle, so going away they're higher on the screen.
  const ty = (down ? t.y ?? 13 : (t.y ?? 13) - 1) + dip;
  const top = ty - t.h, bottom = ty + t.h;
  const gx0 = Math.round(tx - g.w / 2), gx1 = gx0 + g.w - 1;
  // Going away, the gun points up the screen and is drawn first, behind the turret.
  if (!down && !o.rack) {
    s.rect(gx0, top - g.len, gx1, top + 1, "team", 1).shadow();
    if (g.brake) s.rect(gx0 - 1, top - g.len, gx1 + 1, top - g.len + 1, "team", 2);
  }
  if (t.shape === "casemate") s.rect(tx - t.w, top, tx + t.w, bottom, "team", 1, true).shadow();
  else if (t.shape === "box" || t.shape === "open") s.rect(tx - t.w, top, tx + t.w, bottom, "team", 1, true).shadow();
  else if (t.shape === "hex") s.poly([[tx - t.w, ty], [tx - t.w + 2.5, top], [tx + t.w - 2.5, top], [tx + t.w, ty], [tx + t.w - 2, bottom], [tx - t.w + 2, bottom]], "team", 1).shadow();
  else s.oval(tx, ty, t.w, t.h, "team", 1, true).shadow();
  // Markings are painted into the turret before anything else covers it.
  if (!down && o.marking === "redStar") redStar(s, tx - 3, bottom - (t.bustle ? 6 : 5));
  if (o.turretCamo) camo(s, o.turretCamo.map(([a, b, c, d]) => [tx + a, ty + b, tx + c, ty + d]));
  if (t.shape === "open") s.fill(Math.round(tx - t.w + 2), top + 2, Math.round(tx + t.w - 2), bottom - (down ? 2 : 1), "team", 4);
  else if (t.shape !== "casemate" || o.hatch !== false) s.oval(tx + (down ? 2 : -2), ty - 1, 1.6, 1.2, "metal", 1);
  if (!down && t.bustle) s.rect(tx - t.w + 2, bottom, tx + t.w - 2, bottom + 2, "team", 2, true);
  if (o.counterweight && !down) s.rect(tx - 3, bottom, tx + 3, bottom + 2, "team", 2);
  if (o.handrail) {
    s.shape();
    for (let a = Math.PI * 1.05; a <= Math.PI * 1.95; a += 0.12) s.dot(tx + Math.cos(a) * (t.w + 2), ty + Math.sin(a) * (t.h + 2), "metal", 2);
  }
  if (down && !o.rack) {
    if (g.mantlet !== false) s.rect(gx0 - 2, bottom - 2, gx1 + 2, bottom + 1, "team", 2);
    s.rect(gx0, bottom, gx1, bottom + g.len, "team", 1).shadow();
    if (g.brake) s.rect(gx0 - 1, bottom + g.len - 1, gx1 + 1, bottom + g.len + 1, "team", 2);
    s.dot(Math.round(tx), bottom + g.len, "metal", 4);
  }
  if (o.rack) {
    // The Calliope's 60-tube rack over the turret: tube mouths toward you, or their back ends.
    s.rect(4, 1 + dip, 27, 9 + dip, "metal", 2);
    for (let y = 2; y <= 7; y += 3) for (let x = 5; x <= 25; x += 3) s.fill(x, y + dip, x + 1, y + 1 + dip, "metal", 4);
    s.shadow();
  }
}

// ---- Wheeled vehicles ----

/** A tyre seen from the front or back: a tall narrow oval with tread that rolls between frames. */
function tyre(s, cx, cy, ry, frame, rx = 2.3) {
  s.oval(cx, cy, rx, ry, "rubber", 3);
  for (let y = Math.round(cy - ry) + 1 + frame; y < cy + ry; y += 2) s.dot(Math.round(cx), y, "rubber", 1);
}

/**
 * A truck: front wheels, hood with its grille and the cab with a windshield coming toward you; going
 * away, the bed and its tailgate at the front with the twin rear wheels below, the cab beyond.
 * o.load: "rails" (Katyusha), "quadMg" (four Maxims), "cannon" (Type 98 20mm), "tilt" (canvas cover).
 */
function truck(o) {
  return (view, frame) => {
    const s = sprite();
    const down = view === "down";
    const d = frame;
    if (down) {
      for (const x of [6, 25]) tyre(s, x, 11, 3, frame);
      s.rect(7, 2 + d, 24, 13 + d, "team", 3, true);
      for (const x of [6, 25]) tyre(s, x, 26, 3.5, frame);
      s.rect(8, 12 + d, 23, 21 + d, "team", 1, true);
      s.fill(9, 14 + d, 22, 16 + d, "glass", 0);
      s.fill(15, 14 + d, 16, 16 + d, "team", 2);
      if (o.marking === "redStar") redStar(s, 19, 17 + d);
      s.rect(10, 21 + d, 21, 28 + d, "team", 1, true);
      for (let y = 24; y <= 27; y++) s.line(12, y + d, 19, y + d, "metal", (y % 2) * 2 + 1);
      s.dot(10, 23 + d, "metal", 0).dot(21, 23 + d, "metal", 0);
      s.oval(7.5, 23 + d, 2.5, 2, "team", 2).oval(23.5, 23 + d, 2.5, 2, "team", 2);
      load(s, o.load, true, d);
    } else {
      for (const x of [7, 24]) tyre(s, x, 5, 2.5, frame);
      s.rect(10, 1 + d, 21, 6 + d, "team", 1, true);
      s.rect(8, 5 + d, 23, 13 + d, "team", 1, true);
      s.fill(12, 9 + d, 19, 10 + d, "glass", 0);
      for (const x of [5, 26]) tyre(s, x, 26, 3.5, frame, 2.2);
      s.rect(6, 12 + d, 25, 28 + d, "team", 3, true);
      s.rect(6, 24 + d, 25, 28 + d, "team", 2);
      for (let x = 9; x <= 23; x += 4) s.line(x, 25 + d, x, 27 + d, "team", 3);
      s.dot(7, 27 + d, "sun", 0).dot(24, 27 + d, "sun", 0);
      load(s, o.load, false, d);
    }
    return finish(s);
  };
}

/** What a truck carries on its bed. */
function load(s, kind, down, d) {
  if (kind === "rails") {
    // BM-13 rails laid along the truck in travel position, over the cab.
    const [y0, y1] = down ? [1, 15] : [8, 24];
    s.rect(7, y0 + d, 24, y1 + d, "metal", 2);
    for (let x = 8; x <= 23; x += 2) s.line(x, y0 + 1 + d, x, y1 - 1 + d, "metal", 4);
    s.fill(7, (down ? y1 - 2 : y0 + 1) + d, 24, (down ? y1 - 1 : y0 + 2) + d, "metal", 1);
    s.shadow();
  } else if (kind === "quadMg") {
    // Four Maxims with their water jackets, side by side, barrels raised.
    const y = down ? 4 : 13;
    s.rect(10, y + 2 + d, 21, y + 7 + d, "metal", 2, true);
    for (let i = 0; i < 4; i++) s.rect(10 + i * 3, y - 3 + d, 11 + i * 3, y + 3 + d, "metal", 1);
    s.shadow();
  } else if (kind === "cannon") {
    const y = down ? 5 : 14;
    s.rect(11, y + d, 20, y + 6 + d, "metal", 2, true).shadow();
    s.rect(15, y - 4 + d, 16, y + 2 + d, "metal", 1);
    s.rect(12, y + 1 + d, 13, y + 4 + d, "team", 1);
  } else if (kind === "tilt") {
    const [y0, y1] = down ? [2, 12] : [12, 25];
    s.rect(7, y0 + d, 24, y1 + d, "canvas", 1, true);
    for (let x = 10; x <= 22; x += 4) s.line(x, y0 + 1 + d, x, y1 - 1 + d, "canvas", 2);
  }
}

/** The Willys jeep: low tub, flat hood with the star, folded windshield, driver in his M1. */
function jeep(view, frame) {
  const s = sprite();
  const down = view === "down", d = frame;
  for (const y of [9, 25]) for (const x of [6, 25]) tyre(s, x, y, 3.5, frame);
  s.rect(8, 5 + d, 23, 28 + d, "team", 3, true);
  if (down) {
    s.rect(9, 18 + d, 22, 28 + d, "team", 1, true);
    star(s, 12.5, 20 + d);
    s.fill(11, 27 + d, 20, 27 + d, "metal", 4);
    s.rect(8, 16 + d, 23, 17 + d, "metal", 2);
    s.fill(9, 7 + d, 22, 15 + d, "team", 4);
    s.oval(19, 11 + d, 2.6, 2, "skin", 1);
    HELMETS.m1(s, "front", 19, 6 + d, 10 + d, 0.6);
  } else {
    s.rect(9, 5 + d, 22, 13 + d, "team", 1, true);
    s.rect(8, 13 + d, 23, 14 + d, "metal", 2);
    s.fill(9, 15 + d, 22, 25 + d, "team", 4);
    HELMETS.m1(s, "back", 12, 15 + d, 19 + d, 0.6);
    s.oval(CX, 26 + d, 3.5, 2.5, "rubber", 3);
    s.oval(CX, 26 + d, 1.5, 1, "metal", 1);
    s.shape().line(22, 0, 22, 25 + d, "metal", 3);
  }
  return finish(s);
}

/** The BA-64: a small, steeply sloped armored car with an open-topped MG turret. */
function ba64(view, frame) {
  const s = sprite();
  const down = view === "down", d = frame;
  for (const y of [10, 25]) for (const x of [7, 24]) tyre(s, x, y, 3.5, frame);
  s.poly([[10, 5 + d], [21, 5 + d], [24, 12 + d], [24, 28 + d], [7, 28 + d], [7, 12 + d]], "team", 1);
  s.rect(9, (down ? 22 : 23) + d, 22, 28 + d, "team", 2);
  if (down) s.fill(12, 24 + d, 19, 24 + d, "metal", 4);
  else s.oval(CX, 26 + d, 2, 1.2, "metal", 3);
  s.poly([[11, 9 + d], [20, 9 + d], [21, 13 + d], [19, 17 + d], [12, 17 + d], [10, 13 + d]], "team", 1).shadow();
  s.fill(13, 11 + d, 18, 14 + d, "team", 4);
  redStar(s, 12.5, down ? 18 + d : 18 + d);
  s.rect(15, (down ? 15 : 4) + d, 16, (down ? 21 : 11) + d, "metal", 2);
  return finish(s);
}

/**
 * A motorcycle with a sidecar on its right: coming toward you the sidecar is on your left, going
 * away on your right. Rider and passenger in their helmets; o.mg puts an MG on the sidecar.
 */
function sidecarUnit(o) {
  return (view, frame) => {
    const s = sprite();
    const down = view === "down", d = frame;
    const bike = down ? 20 : 11, car = down ? 9 : 22;
    // Sidecar wheel and tub.
    tyre(s, car + (down ? -3 : 3), 26, 3, frame);
    s.oval(car, 20 + d, 5, 7, "team", 1, true);
    s.fill(car - 3, 15 + d, car + 3, 20 + d, "team", 4);
    // Bike: front wheel toward you, or the rear wheel and mudguard going away.
    tyre(s, bike, down ? 27 : 26, 3.5, frame);
    s.rect(bike - 2, 14 + d, bike + 2, 25 + d, "team", 2, true);
    if (down) s.rect(bike - 5, 19 + d, bike + 5, 20 + d, "metal", 2).dot(bike, 23 + d, "metal", 0);
    else s.dot(bike, 24 + d, "sun", 0);
    // Rider, then the passenger in the sidecar.
    s.rect(bike - 4, 12 + d, bike + 4, 20 + d, "team", 1, true);
    if (down) s.oval(bike, 10 + d, 3, 2.2, "skin", 1);
    HELMETS[o.helmet](s, down ? "front" : "back", bike, 4 + d, 9 + d, 0.65);
    if (down) s.oval(car, 15 + d, 2.6, 2, "skin", 1);
    s.rect(car - 3, 14 + d, car + 3, 18 + d, "team", 2);
    HELMETS[o.helmet](s, down ? "front" : "back", car, 9 + d, 13 + d, 0.6);
    if (o.mg) s.rect(car - 1, (down ? 18 : 5) + d, car, (down ? 25 : 13) + d, "metal", 2);
    return finish(s);
  };
}

// ---- Halftracks ----

/**
 * A halftrack: wheels and a narrow hood at the front, an armored body with tracks under the back.
 * Coming toward you, the hood and wheels are at the bottom with the tracks beyond; going away, the
 * rear doors and tracks are at the bottom and the hood beyond. o.gun: "m2" (.50 cal on a ring),
 * "mg34" (MG with a shield), "quad50" (the M45 quad mount), "flak4" (Flakvierling), "mg" (plain
 * MG), or none; o.cab: an unarmored truck cab and canvas tilt instead of an armored body (ZiS-42).
 */
function halftrack(o) {
  return (view, frame) => {
    const s = sprite();
    const down = view === "down", d = frame;
    const [trackY0, trackY1] = down ? [4, 20] : [13, 30];
    for (const x0 of [4, 24]) {
      s.rect(x0, trackY0, x0 + 3, trackY1, "rubber", 3);
      for (let y = trackY0 + 1 + frame; y < trackY1; y += 2) s.line(x0 + 1, y, x0 + 2, y, "rubber", 1);
    }
    if (down) {
      for (const x of [6, 25]) tyre(s, x, 26, 3.5, frame);
      if (o.cab) {
        s.rect(7, 1 + d, 24, 13 + d, "canvas", 1, true);
        for (let x = 10; x <= 22; x += 4) s.line(x, 2 + d, x, 12 + d, "canvas", 2);
        s.rect(8, 12 + d, 23, 21 + d, "team", 1, true);
        s.fill(9, 14 + d, 22, 16 + d, "glass", 0);
      } else {
        s.poly([[8, 3 + d], [23, 3 + d], [24, 20 + d], [7, 20 + d]], "team", 1);
        s.fill(10, 5 + d, 21, 14 + d, "team", 4);
        if (o.crew) for (const hx of [11, 20]) HELMETS[o.crew](s, "back", hx, 6 + d, 9 + d, 0.5);
        s.rect(7, 15 + d, 24, 20 + d, "team", 2);
        s.fill(9, 16 + d, 13, 16 + d, "metal", 4).fill(18, 16 + d, 22, 16 + d, "metal", 4);
      }
      if (o.camo) camo(s, o.camo.map(([a, b, c, e]) => [a, b + d, c, e + d]));
      s.rect(10, 20 + d, 21, 28 + d, "team", 1, true);
      for (let y = 23; y <= 27; y += 2) s.line(12, y + d, 19, y + d, "team", 3);
      s.oval(7.5, 23 + d, 2.5, 2, "team", 2).oval(23.5, 23 + d, 2.5, 2, "team", 2);
      if (o.marking === "star") star(s, 12.5, 4 + d);
      if (o.marking === "redStar") redStar(s, 19, 17 + d);
    } else {
      for (const x of [7, 24]) tyre(s, x, 5, 2.5, frame);
      s.rect(10, 0 + d, 21, 6 + d, "team", 1, true);
      if (o.cab) {
        s.rect(8, 5 + d, 23, 13 + d, "team", 1, true);
        s.fill(12, 9 + d, 19, 10 + d, "glass", 0);
        s.rect(6, 12 + d, 25, 28 + d, "canvas", 1, true);
        for (let x = 10; x <= 22; x += 4) s.line(x, 13 + d, x, 24 + d, "canvas", 2);
        s.rect(6, 24 + d, 25, 28 + d, "team", 2);
      } else {
        s.poly([[8, 6 + d], [23, 6 + d], [24, 28 + d], [7, 28 + d]], "team", 1);
        s.fill(10, 9 + d, 21, 21 + d, "team", 4);
        if (o.crew) for (const hx of [11, 20]) HELMETS[o.crew](s, "back", hx, 12 + d, 15 + d, 0.5);
        s.rect(7, 22 + d, 24, 28 + d, "team", 2);
        s.rect(13, 22 + d, 18, 28 + d, "team", 2);
        s.dot(17, 25 + d, "metal", 0);
        if (o.marking === "star") star(s, 18, 4 + d);
      }
      if (o.camo) camo(s, o.camo.map(([a, b, c, e]) => [a, b + d + 8, c, e + d + 8]));
      s.dot(7, 27 + d, "sun", 0).dot(24, 27 + d, "sun", 0);
    }
    halftrackGun(s, o.gun, down, d);
    return finish(s);
  };
}

function halftrackGun(s, gun, down, d) {
  if (!gun) return;
  if (gun === "m2" || gun === "mg34" || gun === "mg") {
    const y = down ? 9 : 14;
    s.rect(13, y + d, 18, y + 4 + d, "metal", 2, true);
    if (gun === "mg34") s.rect(11, (down ? y + 3 : y - 1) + d, 20, (down ? y + 6 : y + 1) + d, "team", 2, true);
    if (down) s.rect(15, y + 4 + d, 16, y + 11 + d, "metal", gun === "m2" ? 2 : 1);
    else s.rect(15, y - 8 + d, 16, y + d, "metal", gun === "m2" ? 2 : 1);
    if (gun === "m2" && down) s.rect(14, y + 11 + d, 17, y + 12 + d, "metal", 3);
    s.shadow();
  } else if (gun === "quad50" || gun === "flak4") {
    const y = down ? 7 : 13;
    s.rect(10, y + d, 21, y + 6 + d, gun === "quad50" ? "team" : "metal", 2, true).shadow();
    // Four barrels, raised and pointing forward.
    for (const x of [10, 12, 19, 21]) {
      if (down) s.rect(x, y + 4 + d, x, y + 11 + d, "metal", 2);
      else s.rect(x, y - 9 + d, x, y + 1 + d, "metal", 2);
    }
    s.shadow();
    if (gun === "flak4") s.rect(8, (down ? y + 5 : y - 1) + d, 23, (down ? y + 7 : y + 1) + d, "team", 2, true);
  }
}

// ---- Towed and static guns ----

/**
 * A field gun or howitzer on two wheels: coming toward you, the shield with the barrel poking at you
 * and the split trail beyond it; going away, the trail legs spread toward you and the barrel rises
 * over the shield. o.spoked: wooden spoked wheels (Type 91); o.shield; o.barrel: thickness.
 */
function fieldGun(o) {
  return (view, frame) => {
    const s = sprite();
    const down = view === "down";
    const bw = o.barrel ?? 3;
    const bx0 = Math.round(CX - bw / 2), bx1 = bx0 + bw - 1;
    const wheel = (cx) => {
      if (o.spoked) {
        s.oval(cx, 23, 2, 6, "wood", 1);
        for (let y = 19 + frame; y <= 27; y += 2) s.dot(cx, y, "wood", 3);
      } else tyre(s, cx, 23, 5.5, frame, 2.2);
    };
    if (down) {
      // Trail legs beyond the shield, then wheels, shield and the barrel toward you.
      // The trail legs closed together for towing, running away from you.
      s.poly([[13, 16], [18, 16], [17, 3], [14, 3]], "team", 3);
      s.oval(CX, 3, 1.6, 1.4, "metal", 2);
      s.rect(11, 14, 20, 20, "team", 3);
      wheel(6); wheel(25);
      if (o.shield !== false) s.rect(7, 10, 24, 20, "team", 1, true).shadow();
      s.rect(bx0 - 1, 18, bx1 + 1, 21, "team", 2);
      s.rect(bx0, 20, bx1, 26 + (o.long ? 2 : 0), "team", 1).shadow();
      s.dot(Math.round(CX), 26 + (o.long ? 2 : 0), "metal", 4);
    } else {
      s.rect(bx0, 0, bx1, 14, "team", 1).shadow();
      wheel(6); wheel(25);
      if (o.shield !== false) s.rect(7, 10, 24, 19, "team", 2, true).shadow();
      s.rect(12, 12, 19, 20, "team", 3).dot(CX, 16, "metal", 4);
      // The closed trail toward you, with the towing eye at its end.
      s.poly([[13, 18], [18, 18], [19, 29], [12, 29]], "team", 2);
      s.fill(13, 22, 18, 22, "team", 3);
      s.oval(CX, 29.5, 2, 1.5, "metal", 2);
      s.dot(CX, 29.5, "metal", 4);
    }
    return finish(s);
  };
}

/**
 * A heavy AA gun on its cruciform platform with the barrel raised steeply: coming toward you the
 * barrel is short, foreshortened, with its muzzle facing you; going away it rises long up the
 * screen. o.shield: a gun shield (88, 52-K).
 */
function flakGun(o) {
  return (view, frame) => {
    const s = sprite();
    const down = view === "down";
    const lift = frame ? -1 : 0;
    // Platform and outriggers, wheels lifted off and the bogies at front and back.
    s.rect(2, 22, 29, 25, "metal", 2);
    s.rect(13, 14, 18, 31, "metal", 3);
    tyre(s, 5, 27, 3, frame); tyre(s, 26, 27, 3, frame);
    if (down) {
      s.rect(15, 2 + lift, 16, 17, "team", 1).shadow();
      if (o.brake) s.rect(14, 2 + lift, 17, 3 + lift, "team", 2);
      s.rect(9, 14, 22, 23, "team", 2, true).shadow();
      if (o.shield) s.rect(8, 16, 23, 22, "team", 1, true);
      s.rect(14, 17, 17, 20, "team", 3).dot(CX, 18, "metal", 4);
    } else {
      s.rect(9, 14, 22, 23, "team", 2, true).shadow();
      s.rect(15, 0, 16, 16 + lift, "team", 1).shadow();
      if (o.brake) s.rect(14, 0, 17, 1, "team", 2);
      s.rect(12, 15 + lift, 19, 21 + lift, "team", 1, true);
      if (o.shield) s.rect(8, 12, 23, 14, "team", 1);
    }
    return finish(s);
  };
}

/** The Nebelwerfer 41: six tubes in a ring on a two-wheeled carriage, mouths toward you or away. */
function nebelwerfer(view, frame) {
  const s = sprite();
  const down = view === "down";
  if (!down) s.poly([[14, 18], [17, 18], [17, 31], [14, 31]], "team", 2);
  tyre(s, 5, 23, 5, frame, 2.2); tyre(s, 26, 23, 5, frame, 2.2);
  s.rect(8, 20, 23, 23, "team", 3);
  s.oval(CX, 13, 6, 5.5, "metal", 2);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const x = CX + Math.cos(a) * 6, y = 13 + Math.sin(a) * 5.5;
    s.oval(x, y, 3.2, 3, "metal", 1, true);
    s.fill(Math.round(x) - (down ? 1 : 0), Math.round(y) - (down ? 1 : 0), Math.round(x), Math.round(y), "metal", down ? 4 : 3);
  }
  return finish(s);
}

/** Japan's Type 4 20cm launcher: one big tube on a light frame, its mouth toward you or away. */
function type4Launcher(view, frame) {
  const s = sprite();
  const down = view === "down";
  s.line(8, 30, 14, 18, "metal", 2).line(23, 30, 17, 18, "metal", 2);
  tyre(s, 7, 26, 3.5, frame); tyre(s, 24, 26, 3.5, frame);
  if (down) {
    s.rect(12, 4, 19, 16, "metal", 2, true);
    s.oval(CX, 18, 5, 4.5, "metal", 1, true);
    s.oval(CX, 18, 3, 2.6, "metal", 4);
  } else {
    s.oval(CX, 14, 5, 4.5, "metal", 1, true);
    s.oval(CX, 14, 2.5, 2, "metal", 3);
    s.rect(12, 16, 19, 26, "metal", 2, true);
  }
  return finish(s);
}

// ---- Aircraft ----

/**
 * An aircraft from above heading down the screen (nose toward you) or up it (tail toward you):
 * wings across, the fuselage along the screen, the fin standing up from the tail, propeller discs
 * as blurred bars that spin between frames, and the plane bobs a pixel. Built from the same spec
 * as the side view (air-naval32.mjs).
 */
export function planeView(view, frame, o) {
  const s = sprite();
  const lift = frame ? -1 : 0;
  const down = view === "down";
  const Y = (v) => (down ? v : 31 - v) + lift;
  const big = Boolean(o.nearEngine);
  const heavy = big || o.store || (o.canopy[1] - o.canopy[0]) > 6;
  const span = big ? 14.5 : heavy ? 13.5 : 13;
  const hw = o.girth * 0.9 + 0.6;
  const tailY = 2, noseY = big ? 28 : 27;
  const wingY = big ? 11 : 12;
  const chord = heavy ? 8 : 7;
  const rect = (x0, y0, x1, y1, mat, tone, grad) => s.rect(x0, Math.min(Y(y0), Y(y1)), x1, Math.max(Y(y0), Y(y1)), mat, tone, grad);
  const poly = (pts, mat, tone) => s.poly(pts.map(([x, y]) => [x, Y(y)]), mat, tone);
  // Tailplane, wings, then the fuselage over them.
  poly([[CX - 7, tailY + 2], [CX + 7, tailY + 2], [CX + 7, tailY + 5], [CX + 2, tailY + 6], [CX - 2, tailY + 6], [CX - 7, tailY + 5]], "team", 2);
  poly([[CX - span, wingY + 1], [CX + span, wingY + 1], [CX + span, wingY + chord - 2], [CX + 3, wingY + chord], [CX - 3, wingY + chord], [CX - span, wingY + chord - 2]], "team", 1);
  if (o.ribs) for (let x = Math.round(CX - span + 2); x < CX + span - 1; x += 2) if (Math.abs(x - CX) > hw + 1) s.line(x, Y(wingY + 2), x, Y(wingY + chord - 2), "team", 2);
  if (o.wingCamo || o.camo) camo(s, [[Math.round(CX - span + 3), Math.min(Y(wingY + 2), Y(wingY + 3)), Math.round(CX - span + 6), Math.max(Y(wingY + 2), Y(wingY + 3))], [Math.round(CX + 5), Math.min(Y(wingY + 3), Y(wingY + 4)), Math.round(CX + 8), Math.max(Y(wingY + 3), Y(wingY + 4))]]);
  // Markings on the wings: the US star on the left wing, the hinomaru and red star on both.
  if (o.star) star(s, down ? CX + span - 7.5 : CX - span + 1, Math.min(Y(wingY + 2), Y(wingY + 6)));
  for (const sx of [-1, 1]) {
    if (o.sun) hinomaru(s, CX + sx * (span - 4), Y(wingY + chord / 2), 1.5);
    if (o.redStar) redStar(s, CX + sx * (span - 4.5) - 3, Math.min(Y(wingY + 2), Y(wingY + 6)), true);
  }
  // Engines on the wings, reaching forward of the leading edge.
  const props = [];
  if (big) for (const sx of [-1, 1]) {
    const ex = CX + sx * 5.5;
    rect(ex - 1.5, wingY - 1, ex + 1.5, wingY + chord + 3, "team", 2, true);
    props.push([ex, wingY + chord + 4, 3.5]);
  }
  poly([[CX - 1, tailY], [CX + 1, tailY], [CX + hw, wingY - 3], [CX + hw, noseY - 2], [CX + hw * 0.6, noseY], [CX - hw * 0.6, noseY], [CX - hw, noseY - 2], [CX - hw, wingY - 3]], "team", 1);
  if (o.bodySun) hinomaru(s, CX, Y(tailY + 5), 1.2);
  const canopyLen = Math.max(2, (o.canopy[1] - o.canopy[0]) * 0.55);
  const canopyMid = big ? noseY - 4 : wingY + 1;
  rect(CX - hw + 1, canopyMid - canopyLen / 2, CX + hw - 1, canopyMid + canopyLen / 2, "glass", 0);
  if (o.glassNose) rect(CX - 1, noseY - 1, CX + 1, noseY, "glass", 0);
  if (o.windows) for (let y = tailY + 6; y < wingY; y += 2) for (const sx of [-1, 1]) s.dot(Math.round(CX + sx * (hw - 0.5)), Y(y), "glass", 0);
  if (o.noseProp) props.push([CX, noseY + 1, o.noseProp]);
  // The fin stands up from the tail, so it always rises up the screen.
  s.shape();
  const tail = Y(tailY);
  const finH = Math.round(o.fin * 0.7);
  s.rect(14, tail - finH, 17, down ? tail + 2 : tail, "team", 0, true);
  if (o.bodyStar) redStar(s, 12.5, down ? tail - finH + 1 : tail - finH + 1, true);
  for (const [px, py, r] of props) {
    const reach = frame ? r * 0.55 : r;
    s.shape();
    s.line(px - reach, Y(py), px + reach, Y(py), "metal", 0);
  }
  return finish(s);
}

// ---- Ships ----

/**
 * A ship from above heading down the screen (bow toward you, its foam bow wave at the bottom) or up
 * it (stern toward you, the wake trailing below). Superstructure, funnels, turrets and masts come
 * from the side-view spec (air-naval32.mjs), laid out along the hull.
 */
export function shipView(view, frame, o) {
  const s = sprite();
  const down = view === "down";
  const rock = frame;
  const length = (o.bow - o.stern) * 0.85;
  const top = Math.round((31 - length) / 2) - 1, bottom = top + length;
  const T = (x) => (x - o.stern) / (o.bow - o.stern);
  // Screen row for a point along the hull: the bow at the bottom coming toward you, at the top going away.
  const Yt = (t) => (down ? top + t * (bottom - top) : bottom - t * (bottom - top)) + rock;
  const Yx = (x) => Yt(T(x));
  const hb = Math.min(7.5, Math.max(2.8, o.beam * 0.9));
  const square = Boolean(o.wellDeck);
  const outline = (shiftY) => {
    const pts = [[CX - hb, Yt(0)], [CX + hb, Yt(0)], [CX + hb, Yt(0.7)]];
    if (square) pts.push([CX + hb, Yt(1)], [CX - hb, Yt(1)]);
    else pts.push([CX + hb * 0.4, Yt(0.93)], [CX, Yt(1)], [CX - hb * 0.4, Yt(0.93)]);
    pts.push([CX - hb, Yt(0.7)]);
    return pts.map(([x, y]) => [x, y + shiftY]);
  };
  const side = Math.max(2, Math.round(o.side * 0.7));
  // Water first: the wake behind the stern, foam at the bow.
  s.shape();
  const sternY = Yt(0), bowY = Yt(1);
  const wakeDir = down ? -1 : 1;
  for (let i = 1; i <= 6; i++) {
    const y = Math.round(sternY + wakeDir * (i + (down ? 0 : side)));
    if (y < 0 || y > 31) continue;
    const spread = hb * 0.6 + i * 0.7;
    if ((i + frame) % 2 === 0) s.dot(CX - spread, y, "card", 0).dot(CX + spread, y, "card", 0);
    if ((i + frame) % 3 === 0) s.dot(CX, y, "card", 0);
  }
  // Hull side as a band below the deck, then the deck.
  s.poly(outline(side), "team", 3);
  s.poly(outline(0), "team", 1);
  if (o.wellDeck) {
    const [a, b] = [Yx(o.wellDeck[0]), Yx(o.wellDeck[1])];
    s.fill(Math.round(CX - hb + 2), Math.round(Math.min(a, b)), Math.round(CX + hb - 2), Math.round(Math.max(a, b)), "team", 4);
    // The bow ramp.
    s.fill(Math.round(CX - hb + 1), Math.round(bowY) + (down ? -1 : 0), Math.round(CX + hb - 1), Math.round(bowY) + (down ? 0 : 1), "team", 2);
  }
  if (o.camo) for (const [a, , c] of o.camo) s.fill(Math.round(CX - hb + 1), Math.round(Math.min(Yx(a), Yx(c))), Math.round(CX - 1), Math.round(Math.max(Yx(a), Yx(c))), "team", 3);
  if (o.star) star(s, CX - 3.5, Math.round((Yt(0.35) + Yt(0.65)) / 2) - 2);
  const raise = (y) => Math.round((o.deck - y) * 0.45);
  for (const [x0, y0, x1] of o.blocks ?? []) {
    const ya = Yx(x0), yb = Yx(x1);
    const y1 = Math.max(ya, yb), y0s = Math.min(ya, yb), h = raise(y0);
    const half = Math.max(1.5, hb * 0.6);
    s.rect(CX - half, y0s, CX + half, y1, "team", 2);
    s.rect(CX - half, y0s - h, CX + half, y1 - h, "team", 0, true).shadow();
    s.fill(Math.round(CX - half + 1), Math.round(y1 - h - 1), Math.round(CX + half - 1), Math.round(y1 - h - 1), "glass", 0);
  }
  for (const [fx, fy] of o.funnels ?? []) s.oval(CX, Yx(fx) - raise(fy) - 1, 1.8, 1.6, "team", 3).shadow();
  const dir = down ? 1 : -1;
  for (const [tx, , len, r = 2.2] of o.turrets ?? []) {
    const ty = Yx(tx) - 1;
    const barrel = Math.max(2, Math.round(len * 0.8));
    const [b0, b1] = dir > 0 ? [ty, ty + r + barrel] : [ty - r - barrel, ty];
    s.rect(CX - (r > 2 ? 1 : 0), b0, CX + (r > 2 ? 1 : 0), b1, "metal", 2);
    s.oval(CX, ty, r * 1.1, r * 0.9, "team", 1, true).shadow();
  }
  for (const [mx, my, h] of o.masts ?? []) s.shape().line(Math.round(CX) + 1, Yx(mx) - raise(my), Math.round(CX) + 1, Yx(mx) - raise(my) - Math.round(h * 0.7), "metal", 2);
  // Bow wave: foam curling off both sides of the bow.
  s.shape();
  for (let i = 0; i <= 4; i++) {
    const y = Math.round(bowY + (down ? side + 1 - i : -1 + i * 0) - (down ? 0 : i * 0.5));
    const x = hb * (square ? 1 : 0.3) + i * 0.9 + 0.5;
    if ((i + frame) % 2 === 0) s.dot(CX - x, y, "card", 0).dot(CX + x, y, "card", 0);
  }
  return finish(s);
}

/**
 * A carrier from above: the flight deck along the screen with its dashed centerline, elevators, and
 * aircraft parked aft, the island on the starboard edge (your left with the bow toward you, your
 * right going away), and the bow wave or the wake.
 */
export function carrierView(view, frame, o) {
  const s = sprite();
  const down = view === "down";
  const d = frame;
  const Y = (t) => (down ? 2 + t * 26 : 28 - t * 26) + d;
  const hb = 7;
  const star = down ? -1 : 1;
  // Wake behind the stern.
  s.shape();
  for (let i = 1; i <= 4; i++) {
    const y = Math.round(Y(0) + (down ? -i : i + 3));
    if (y < 0 || y > 31 || (i + frame) % 2) continue;
    s.dot(CX - 4 - i, y, "card", 0).dot(CX + 4 + i, y, "card", 0);
  }
  const deck = (shiftY, mat, tone) => s.poly([[CX - hb, Y(0) + shiftY], [CX + hb, Y(0) + shiftY], [CX + hb, Y(0.85) + shiftY], [CX + 3, Y(1) + shiftY], [CX - 3, Y(1) + shiftY], [CX - hb, Y(0.85) + shiftY]], mat, tone);
  deck(3, "team", 3);
  if (o.sideFunnels) for (const fx of o.sideFunnels) s.oval(CX + star * (hb + 0.5), Y(fx / 31), 1.4, 1.6, "team", 2).shadow();
  deck(0, o.deck, 1);
  for (let t = 0.05; t < 0.95; t += 0.14) s.fill(Math.round(CX), Math.round(Y(t)), Math.round(CX), Math.round(Y(t)) + 1, "card", 0);
  for (const ex of o.elevators) s.fill(Math.round(CX + 2), Math.round(Y(ex / 31)), Math.round(CX + 4), Math.round(Y(ex / 31)) + 1, o.deck, 3);
  // Aircraft parked aft: fuselage along the deck, wings across.
  for (const [px, t] of [[CX - 3, 0.1], [CX + 3, 0.1], [CX - 3, 0.25], [CX + 3, 0.25]]) {
    const py = Math.round(Y(t));
    s.rect(px - 2, py, px + 2, py, "team", 0);
    s.fill(Math.round(px), py - 1, Math.round(px), py + 1, "team", 0);
  }
  // The island, standing up from the starboard edge.
  const [i0, i1] = o.island.map((x) => Y(x / 31));
  const iy0 = Math.min(i0, i1), iy1 = Math.max(i0, i1);
  const ix = CX + star * (hb - 1);
  s.rect(ix - 1.5, iy0 - 3, ix + 1.5, iy1 - 3, "team", 1, true).shadow();
  s.fill(Math.round(ix - 1), Math.round(iy1 - 4), Math.round(ix + 1), Math.round(iy1 - 4), "glass", 0);
  if (o.funnel !== undefined) s.oval(ix, Y(o.funnel / 31) - 5, 1.6, 1.4, "team", 3).shadow();
  s.shape().line(Math.round(ix), iy0 - 4, Math.round(ix), iy0 - 4 - o.mast - 2, "metal", 2);
  // Bow wave.
  s.shape();
  const bow = Y(1);
  for (let i = 0; i <= 4; i++) {
    if ((i + frame) % 2) continue;
    const y = Math.round(down ? bow + 4 - i * 0.5 : bow - 1 + i * 0.3);
    s.dot(CX - 3.5 - i, y, "card", 0).dot(CX + 3.5 + i, y, "card", 0);
  }
  return finish(s);
}

// ---- Land unit specs, by nation and sheet row ----

const tank = (o) => tracked(o);

const LAND = {
  us: {
    IN: soldierUnit({ helmet: "m1", kit: "pack", weapon: "rifle" }),
    AI: soldierUnit({ helmet: "m1", kit: "pack", weapon: "tube" }),
    MO: soldierUnit({ helmet: "m1", kit: "pack", weapon: "mortar" }),
    RC: jeep,
    HT: halftrack({ gun: "m2", marking: "star", crew: "m1" }),
    LT: tank({ w: 10, turret: { shape: "box", w: 5, h: 4, y: 13 }, gun: { w: 2, len: 9 }, marking: "star" }),
    MT: tank({ w: 12, turret: { shape: "round", w: 6.5, h: 5, y: 13 }, gun: { w: 2, len: 11 }, marking: "star", bowMg: true }),
    TD: tank({ w: 12, turret: { shape: "open", w: 7, h: 5, y: 13 }, gun: { w: 2, len: 13, mantlet: false }, marking: "star", counterweight: true }),
    AR: fieldGun({}),
    RK: tank({ w: 12, turret: { shape: "round", w: 6, h: 4.5, y: 15 }, gun: { w: 2, len: 6 }, marking: "star", rack: true }),
    AA: halftrack({ gun: "quad50", marking: "star" }),
    FK: flakGun({}),
  },
  de: {
    IN: soldierUnit({ helmet: "stahlhelm", kit: "pack", weapon: "rifle", stock: "darkwood" }),
    AI: soldierUnit({ helmet: "stahlhelm", kit: "pack", weapon: "tube", tube: { shield: true } }),
    MO: soldierUnit({ helmet: "stahlhelm", kit: "pack", weapon: "mortar" }),
    RC: sidecarUnit({ helmet: "stahlhelm", mg: true }),
    HT: halftrack({ gun: "mg34", crew: "stahlhelm", camo: [[8, 16, 11, 18], [20, 4, 23, 6]] }),
    LT: tank({ w: 10, turret: { shape: "box", w: 4.5, h: 3.5, y: 13, dx: -1 }, gun: { w: 1, len: 8 }, camo: [[8, 19, 11, 21]] }),
    MT: tank({ w: 12, skirts: true, turret: { shape: "box", w: 6, h: 4.5, y: 13, bustle: true }, gun: { w: 2, len: 13, brake: true }, camo: [[9, 9, 12, 11], [19, 20, 22, 22]], turretCamo: [[-4, -2, -1, 0]] }),
    HV: tank({ w: 13, turret: { shape: "box", w: 7.5, h: 5, y: 13 }, gun: { w: 3, len: 14, brake: true }, camo: [[8, 20, 11, 22], [20, 9, 23, 11]], turretCamo: [[2, -3, 5, -1]] }),
    TD: tank({ w: 12, turret: { shape: "casemate", w: 7, h: 4, y: 15 }, gun: { w: 2, len: 11, brake: true }, camo: [[8, 9, 11, 11], [20, 20, 23, 22]] }),
    AR: fieldGun({}),
    RK: nebelwerfer,
    AA: halftrack({ gun: "flak4", crew: "stahlhelm" }),
    FK: flakGun({ shield: true, brake: true }),
  },
  jp: {
    IN: soldierUnit({ helmet: "type90", kit: "pack", bedroll: true, legs: "puttees", weapon: "rifle", bayonet: true }),
    AI: soldierUnit({ helmet: "type90", kit: "pack", bedroll: true, legs: "puttees", weapon: "tube", tube: { bipod: true, width: 3 } }),
    MO: soldierUnit({ helmet: "type90", kit: "pack", legs: "puttees", weapon: "mortar" }),
    RC: sidecarUnit({ helmet: "type90", mg: true }),
    HT: halftrack({ gun: "mg", crew: "type90" }),
    LT: tank({ w: 10, rivets: true, muffler: true, turret: { shape: "round", w: 4.5, h: 4, y: 12, dx: 2 }, gun: { w: 1, len: 8 } }),
    MT: tank({ w: 11, rivets: true, handrail: true, turret: { shape: "round", w: 5.5, h: 4.5, y: 13, dx: 1.5 }, gun: { w: 2, len: 11 } }),
    TD: tank({ w: 11, rivets: true, turret: { shape: "open", w: 6.5, h: 4, y: 15 }, gun: { w: 2, len: 10 } }),
    AR: fieldGun({ spoked: true }),
    RK: type4Launcher,
    AA: truck({ load: "cannon" }),
    FK: flakGun({}),
  },
  su: {
    IN: soldierUnit({ helmet: "ssh40", kit: "sack", roll: true, legs: "boots", weapon: "rifle", bayonet: true }),
    AI: soldierUnit({ helmet: "ssh40", kit: "sack", roll: true, legs: "boots", weapon: "ptrd" }),
    MO: soldierUnit({ helmet: "ssh40", kit: "sack", legs: "boots", weapon: "mortar" }),
    RC: ba64,
    HT: halftrack({ cab: true, marking: "redStar" }),
    LT: tank({ w: 10, turret: { shape: "box", w: 4.5, h: 4, y: 13, dx: -1.5 }, gun: { w: 2, len: 8 }, marking: "redStar" }),
    MT: tank({ w: 12, spareTanks: true, turret: { shape: "hex", w: 6.5, h: 4.5, y: 12 }, gun: { w: 2, len: 12 }, marking: "redStar" }),
    HV: tank({ w: 13, turret: { shape: "box", w: 7, h: 5, y: 13, bustle: true }, gun: { w: 2, len: 11 }, marking: "redStar" }),
    TD: tank({ w: 13, turret: { shape: "casemate", w: 8, h: 6, y: 15 }, gun: { w: 3, len: 9, brake: true }, marking: "redStar", hatch: false }),
    AR: fieldGun({ long: true }),
    RK: truck({ load: "rails", marking: "redStar" }),
    AA: truck({ load: "quadMg", marking: "redStar" }),
    FK: flakGun({ shield: true, brake: true }),
  },
};

const draw = (fn) => Object.fromEntries(VIEWS.map((view) => [view, [fn(view, 0), fn(view, 1)]]));

/** Front and rear views for a land unit, by nation code and sheet row code: { down: [f0, f1], up: [f0, f1] }. */
export function landViews(nation, code) {
  const fn = LAND[nation]?.[code];
  if (!fn) throw new Error(`no front and rear views for ${nation} ${code}`);
  return draw(fn);
}

/** The US paratrooper: the M1 carbine and his card suit, on the front and back of the helmet. */
export const paratrooperViews = (suit) => draw(soldierUnit({ helmet: "m1", kit: "pack", weapon: "carbine", suit }));

/** Front and rear views for an aircraft or ship, from its side-view spec. */
export function specViews(kind, spec) {
  const fn = kind === "plane" ? planeView : kind === "ship" ? shipView : carrierView;
  return draw((view, frame) => fn(view, frame, spec));
}
