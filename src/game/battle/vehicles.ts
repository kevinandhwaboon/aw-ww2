// Battle figures with wheels and tracks, guns on carriages, and the bunker (08-art-pipeline §18).
// Each nation's version follows the map art (08-art-pipeline §12, §17) and is drawn so the real
// vehicle can be told apart: a Sherman's bogies and cast turret, a Panzer IV's skirts and long gun,
// a Tiger's interleaved wheels and Zimmerit, a Willys jeep's flat hood and upright windshield.
// Stats never differ; only the look does.

import { C, mix, shade, type Painter } from "./paint";
import { drawSoldier, earsCovered, sandbags, soldierFrame } from "./soldiers";
import { FIRE_TIMING } from "./timeline";
import { along, justFired, kick, lerp, seg, type Look, type Muzzle, type Pose, type Pt, type Rig } from "./rig";

const de = (look: Look) => look.nation === "germany";

/** A white star, the US vehicle marking. */
export function star(p: Painter, cx: number, cy: number): void {
  const s = C("battleStar");
  p.rect(cx - 3, cy - 1, 7, 1, s);
  p.rect(cx - 2, cy, 5, 1, s);
  p.rect(cx - 1, cy - 3, 3, 2, s);
  p.px(cx, cy - 4, s);
  p.rect(cx - 2, cy + 1, 2, 1, s);
  p.rect(cx + 1, cy + 1, 2, 1, s);
  p.px(cx - 3, cy + 2, s);
  p.px(cx + 3, cy + 2, s);
}

/** German vehicles carry no insignia (08-art-pipeline §12); camouflage blotches fill the space. */
function camo(p: Painter, x: number, y: number, w: number, h: number, look: Look, seed: number): void {
  const blot = mix(look.team.lo, C("battleOlive"), 0.5);
  for (let i = 0; i < Math.max(2, Math.floor(w / 13)); i++) {
    const bx = x + ((i * 13 + seed * 7) % Math.max(1, w - 6));
    const by = y + ((i * 5 + seed) % Math.max(1, h - 3));
    p.rect(bx, by, 6, 2, blot);
    p.rect(bx + 1, by + 2, 3, 1, blot);
  }
}

/** A rubber-tired wheel with a hub, or a spoked one. */
function wheel(p: Painter, cx: number, cy: number, r: number, style: "tire" | "spoked", t: number): void {
  p.disc(cx, cy, r, C("battleRubber"));
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2;
    p.px(cx + Math.cos(a) * (r - 0.5), cy + Math.sin(a) * (r - 0.5), shade(C("battleRubber"), 1.8));
  }
  p.disc(cx, cy, r - 2, style === "spoked" ? C("battleSteelDark") : C("battleSteel"));
  if (style === "spoked") {
    const a0 = (t / 90) % (Math.PI / 3);
    for (let i = 0; i < 6; i++) {
      const e = along(cx, cy, a0 + (i * Math.PI) / 3, r - 2);
      p.line(cx, cy, e.x, e.y, C("battleSteel"));
    }
  } else {
    p.disc(cx, cy, r - 4, shade(C("battleSteel"), 0.85));
  }
  p.rect(cx - 1, cy - 1, 2, 2, C("battleSteelDark"));
}

/** A tank road wheel: rubber rim, steel disc, hub. */
function roadWheel(p: Painter, cx: number, cy: number, r: number, tone = 1): void {
  p.disc(cx, cy, r, C("battleRubber"));
  p.disc(cx, cy, r - 1.2, shade(C("battleSteel"), tone));
  if (r >= 4) p.disc(cx, cy, r - 2.6, shade(C("battleSteel"), tone * 0.85));
  p.px(cx, cy, C("battleSteelDark"));
}

// ---- Tanks and tank destroyers ----

type Suspension = "vvss" | "stuart" | "smallPairs" | "pz2" | "pz3" | "interleaved" | "churchill";
type TurretShape = "cast" | "box" | "stuart" | "small" | "horseshoe" | "open";
type Extra =
  | "star" | "bowMg" | "roofMg50" | "roofMg30" | "cupola" | "spareTracks" | "spareWheels" | "smokeDischargers"
  | "zimmerit" | "mufflers" | "towCable" | "panniers" | "antenna" | "sandShields" | "counterweight" | "mgShield";

interface TankSpec {
  readonly len: number;
  readonly hullH: number;
  readonly trackH: number;
  readonly glacis: number;
  readonly suspension: Suspension;
  readonly skirts?: boolean;
  /** Track runs up the hull side, as on the Churchill. */
  readonly tallTrack?: boolean;
  readonly turret: { readonly x: number; readonly w: number; readonly h: number; readonly shape: TurretShape } | null;
  /** A fixed casemate with the gun in its front, like the StuG. */
  readonly casemate?: { readonly x: number; readonly w: number; readonly h: number };
  readonly gun: { readonly len: number; readonly w: number; readonly brake?: boolean; readonly sleeve?: boolean };
  readonly extras: readonly Extra[];
}

const TANKS: Record<"light" | "medium" | "heavy" | "td", { us: TankSpec; de: TankSpec }> = {
  light: {
    // M5 Stuart: tall and narrow, a sloped glacis, a 37mm with its long recoil sleeve.
    us: { len: 54, hullH: 13, trackH: 11, glacis: 13, suspension: "stuart", turret: { x: -3, w: 21, h: 12, shape: "stuart" }, gun: { len: 22, w: 2, sleeve: true }, extras: ["star", "bowMg", "roofMg30", "sandShields"] },
    // Panzer II: small, five big road wheels, a 20mm autocannon and a cupola.
    de: { len: 50, hullH: 11, trackH: 11, glacis: 7, suspension: "pz2", turret: { x: -5, w: 19, h: 10, shape: "small" }, gun: { len: 17, w: 2 }, extras: ["cupola", "antenna", "spareWheels"] },
  },
  medium: {
    // M4 Sherman: high cast hull, VVSS bogies, a rounded cast turret, spare tracks on the glacis.
    us: { len: 70, hullH: 16, trackH: 13, glacis: 18, suspension: "vvss", turret: { x: 2, w: 27, h: 13, shape: "cast" }, gun: { len: 28, w: 3 }, extras: ["star", "bowMg", "roofMg50", "spareTracks", "sandShields"] },
    // Panzer IV: boxy hull, eight small road wheels, side skirts, a long 75 with a muzzle brake.
    de: { len: 72, hullH: 14, trackH: 12, glacis: 5, suspension: "smallPairs", skirts: true, turret: { x: 0, w: 28, h: 12, shape: "box" }, gun: { len: 40, w: 2, brake: true }, extras: ["cupola", "spareTracks", "spareWheels", "bowMg", "antenna", "mufflers"] },
  },
  heavy: {
    // Churchill: long, its track running up the hull sides, square escape doors in the panniers.
    us: { len: 84, hullH: 12, trackH: 24, glacis: 3, suspension: "churchill", tallTrack: true, turret: { x: 8, w: 25, h: 13, shape: "box" }, gun: { len: 28, w: 3 }, extras: ["star", "panniers", "bowMg"] },
    // Tiger I: a big box, interleaved wheels, Zimmerit paste, smoke dischargers, the 88.
    de: { len: 88, hullH: 18, trackH: 14, glacis: 4, suspension: "interleaved", turret: { x: -2, w: 38, h: 15, shape: "horseshoe" }, gun: { len: 50, w: 3, brake: true }, extras: ["cupola", "smokeDischargers", "zimmerit", "mufflers", "towCable", "bowMg"] },
  },
  td: {
    // M10: sloped hull, an open pentagonal turret with counterweights, a long 3-inch gun.
    us: { len: 72, hullH: 15, trackH: 13, glacis: 20, suspension: "vvss", turret: { x: 0, w: 29, h: 11, shape: "open" }, gun: { len: 42, w: 2 }, extras: ["star", "counterweight", "roofMg50", "sandShields"] },
    // StuG III: low casemate, no turret, the gun in a rounded mantlet, skirts and a cupola.
    de: { len: 70, hullH: 10, trackH: 12, glacis: 5, suspension: "pz3", skirts: true, turret: null, casemate: { x: -6, w: 44, h: 11 }, gun: { len: 36, w: 2, brake: true }, extras: ["cupola", "mgShield", "spareWheels"] },
  },
};

interface TankGeometry {
  readonly hullTop: number;
  readonly gunAt: Pt;
  readonly mgAt: Pt;
  readonly top: number;
}

function tankGeometry(s: TankSpec): TankGeometry {
  const hullTop = -s.trackH - s.hullH + (s.tallTrack ? 8 : 0);
  if (s.turret) {
    const top = hullTop - s.turret.h;
    return {
      hullTop,
      top,
      gunAt: { x: s.turret.x + s.turret.w / 2 + 2, y: top + Math.floor(s.turret.h * 0.45) },
      mgAt: { x: s.len / 2 - Math.max(3, s.glacis / 2), y: hullTop + 4 },
    };
  }
  const c = s.casemate ?? { x: 0, w: 20, h: 8 };
  const top = hullTop - c.h;
  return { hullTop, top, gunAt: { x: c.x + c.w / 2 + 2, y: top + Math.floor(c.h * 0.55) }, mgAt: { x: c.x + 4, y: top - 4 } };
}

/** The track: rubber-blocked links, a toothed drive sprocket at the front and an idler at the back. */
function trackRun(p: Painter, x0: number, x1: number, h: number): void {
  const rubber = C("battleRubber");
  const r = h / 2;
  p.rect(x0 + r, -h, x1 - x0 - h, h, rubber);
  p.disc(x0 + r, -r, r, rubber);
  p.disc(x1 - r, -r, r, rubber);
  for (let x = x0 + r; x < x1 - r; x += 3) {
    p.px(x, -1, C("battleSteelDark"));
    p.px(x + 1, -1, shade(rubber, 1.6));
    p.px(x, -h, C("battleSteelDark"));
    p.px(x + 1, -h, shade(rubber, 1.6));
  }
  // Drive sprocket with teeth.
  const sx = x1 - r;
  p.disc(sx, -r, r - 1.5, C("battleSteelDark"));
  for (let k = 0; k < 10; k++) {
    const a = (k / 10) * Math.PI * 2;
    p.px(sx + Math.cos(a) * (r - 1), -r + Math.sin(a) * (r - 1), C("battleSteel"));
  }
  p.disc(sx, -r, Math.max(1, r - 4), C("battleSteel"));
  // Idler.
  roadWheel(p, x0 + r, -r, r - 1.5, 0.9);
}

function suspension(p: Painter, s: TankSpec): void {
  const x0 = -s.len / 2;
  const x1 = s.len / 2;
  const h = s.trackH;
  trackRun(p, x0, x1, h);
  const span0 = x0 + h * 0.75;
  const span1 = x1 - h * 0.75;
  const span = span1 - span0;
  const returnRoller = (x: number) => p.disc(x, -h + 1.5, 1.6, C("battleSteel"));
  switch (s.suspension) {
    case "vvss":
    case "stuart": {
      // Volute-spring bogies: two wheels each, a bracket and a return roller on top.
      const bogies = s.suspension === "vvss" ? 3 : 2;
      const r = s.suspension === "vvss" ? 4.5 : 4;
      const end = s.suspension === "stuart" ? span1 - 2 : span1;
      for (let b = 0; b < bogies; b++) {
        const bx = span0 + ((end - span0) * (b + 0.5)) / bogies;
        p.poly([[bx - 6, -h + 2], [bx + 6, -h + 2], [bx + 7, -h + 7], [bx - 7, -h + 7]], C("battleSteelDark"));
        p.rect(bx - 2, -h + 5, 4, 3, C("battleSteel"));
        roadWheel(p, bx - 5, -r - 0.5, r);
        roadWheel(p, bx + 5, -r - 0.5, r);
        returnRoller(bx + 1);
      }
      if (s.suspension === "stuart") roadWheel(p, x0 + 6, -5, 5, 0.9);
      break;
    }
    case "smallPairs": {
      // Panzer IV: eight small wheels in leaf-sprung pairs and four return rollers.
      for (let i = 0; i < 8; i++) roadWheel(p, span0 + (span * (i + 0.5)) / 8, -4, 3.6);
      for (let i = 0; i < 4; i++) {
        const bx = span0 + (span * (i + 0.5)) / 4;
        p.rect(bx - 4, -9, 8, 2, C("battleSteelDark"));
        returnRoller(bx);
      }
      break;
    }
    case "pz2":
    case "pz3": {
      const n = s.suspension === "pz2" ? 5 : 6;
      const r = s.suspension === "pz2" ? 5 : 4.6;
      for (let i = 0; i < n; i++) {
        const cx = span0 + (span * (i + 0.5)) / n;
        p.line(cx, -r - 1, cx - 4, -h + 3, C("battleSteelDark"), 2);
        roadWheel(p, cx, -r - 0.5, r);
      }
      for (let i = 0; i < (s.suspension === "pz2" ? 4 : 3); i++) returnRoller(span0 + (span * (i + 0.5)) / (s.suspension === "pz2" ? 4 : 3));
      break;
    }
    case "interleaved": {
      // Tiger: big wheels overlapping in two layers.
      const n = 8;
      for (let i = 1; i < n; i += 2) roadWheel(p, span0 + (span * (i + 0.5)) / n, -6.5, 6.5, 0.8);
      for (let i = 0; i < n; i += 2) roadWheel(p, span0 + (span * (i + 0.5)) / n, -6.5, 6.5, 1);
      break;
    }
    case "churchill": {
      for (let i = 0; i < 11; i++) roadWheel(p, span0 + (span * (i + 0.5)) / 11, -3, 2.8);
      break;
    }
  }
}

/** A crewman's head in the hatch: a US tanker helmet, or German headphones over a side cap. */
function commander(p: Painter, x: number, y: number, look: Look): void {
  p.rect(x, y - 6, 5, 6, C("battleSkin"));
  p.px(x + 3, y - 4, C("battleInk"));
  if (de(look)) {
    p.rect(x - 1, y - 8, 7, 2, C("battleRubber"));
    p.px(x - 1, y - 4, C("battleRubber"));
  } else {
    p.rect(x - 1, y - 9, 7, 3, C("battleLeather"));
    p.rect(x - 1, y - 6, 2, 3, C("battleLeather"));
    p.rect(x, y - 9, 4, 1, shade(C("battleLeather"), 1.3));
  }
  p.rect(x - 2, y, 9, 2, C("battleSteelDark"));
}

/** Draws a tank's chassis and turret; `recoil` slides the gun back. */
function drawTank(p: Painter, s: TankSpec, look: Look, recoil: number, seed: number): void {
  const T = look.team;
  const g = tankGeometry(s);
  const half = s.len / 2;
  const has = (e: Extra) => s.extras.includes(e);
  const trackTop = -s.trackH;
  const hullBottom = s.tallTrack ? g.hullTop + s.hullH : trackTop;

  if (has("mufflers")) {
    p.rect(-half - 4, g.hullTop + 2, 4, 7, C("battleSteelDark"));
    p.rect(-half - 4, g.hullTop + 2, 4, 1, C("battleRubber"));
  }
  suspension(p, s);
  if (s.tallTrack) {
    // Churchill: the track's upper run along the hull, side panniers and an escape door.
    p.rect(-half + 2, g.hullTop + s.hullH, s.len - 4, 5, C("battleRubber"));
    for (let x = -half + 3; x < half - 3; x += 3) p.px(x, g.hullTop + s.hullH, C("battleSteelDark"));
    p.rect(-half + 6, trackTop + 4, s.len - 12, 9, T.mid);
    p.rect(-half + 6, trackTop + 4, s.len - 12, 1, T.hi);
    p.rect(-6, trackTop + 5, 9, 7, T.lo);
    p.rect(-5, trackTop + 6, 7, 5, T.mid);
    for (let x = -half + 10; x < -10; x += 4) p.rect(x, trackTop + 7, 2, 4, T.lo);
  }

  // Fenders, hull and glacis.
  p.rect(-half - 1, hullBottom - 1, s.len + 2, 2, T.lo);
  p.poly(
    [
      [-half + 1, hullBottom],
      [-half + 2, g.hullTop + 2],
      [-half + 5, g.hullTop],
      [half - s.glacis, g.hullTop],
      [half, hullBottom - 3],
      [half, hullBottom],
    ],
    T.mid,
  );
  p.rect(-half + 5, g.hullTop, s.len - s.glacis - 5, 1, T.hi);
  p.line(half - s.glacis, g.hullTop, half, hullBottom - 3, T.hi);
  p.rect(-half + 2, hullBottom - 3, s.len - 2, 2, T.lo);
  if (has("zimmerit")) {
    // Ridged anti-magnetic paste over the hull sides.
    for (let x = -half + 4; x < half - s.glacis; x += 2) p.line(x, g.hullTop + 3, x, hullBottom - 4, shade(T.mid, 0.88));
  }
  if (s.skirts) {
    p.rect(-half + 3, trackTop - 3, s.len - 6, 1, C("battleSteelDark"));
    for (let x = -half + 4; x < half - 6; x += 11) {
      p.rect(x, trackTop - 2, 10, Math.ceil(s.trackH / 2) + 2, mix(T.lo, T.mid, 0.45));
      p.rect(x, trackTop - 2, 10, 1, T.mid);
    }
  }
  if (has("sandShields")) p.rect(-half + 4, trackTop - 1, s.len - 12, 2, T.lo);
  // Hull details: tools, tow cable, spare wheels, exhaust, driver's visor and bow machine gun.
  p.rect(-half + 6, g.hullTop + 3, 9, 1, C("battleWood"));
  p.rect(-half + 15, g.hullTop + 3, 2, 2, C("battleSteelDark"));
  if (has("towCable")) {
    for (let x = -half + 18; x < half - s.glacis - 4; x += 4) p.px(x, g.hullTop + 5 + ((x / 4) % 2), C("battleSteelDark"));
  }
  if (has("spareWheels")) {
    roadWheel(p, -half + 4, g.hullTop - 2, 3.5);
    roadWheel(p, -half + 10, g.hullTop - 2, 3.5);
  }
  if (has("bowMg")) {
    p.disc(g.mgAt.x - 1, g.mgAt.y + 1, 2, C("battleSteelDark"));
    p.rect(g.mgAt.x, g.mgAt.y, 4, 1, C("battleSteelDark"));
  }
  p.rect(half - s.glacis + 1, g.hullTop + 1, 3, 2, C("battleInk"));
  if (has("spareTracks")) {
    for (let k = 0; k < 3; k++) {
      const at = along(half - s.glacis + 3, g.hullTop + 2, Math.atan2(s.hullH - 3, s.glacis), 3 + k * 4);
      p.rect(at.x, at.y, 3, 3, C("battleRubber"));
    }
  }
  if (de(look)) camo(p, -half + 6, g.hullTop + 3, s.len - s.glacis - 10, s.hullH - 4, look, seed);
  else if (has("star")) star(p, s.tallTrack ? -half + 20 : -half + s.len * 0.36, (s.tallTrack ? trackTop + 8 : g.hullTop + s.hullH / 2) + 0);

  // Gun first, so the mantlet covers its root.
  const gunStart = { x: g.gunAt.x - 2 - recoil, y: g.gunAt.y };
  const gy = gunStart.y - Math.floor(s.gun.w / 2);
  p.rect(gunStart.x, gy, s.gun.len, s.gun.w, C("battleSteelDark"));
  p.rect(gunStart.x, gy, s.gun.len, 1, C("battleSteel"));
  p.rect(gunStart.x, gy - 1, Math.floor(s.gun.len * 0.35), s.gun.w + 2, C("battleSteelDark"));
  if (s.gun.sleeve) p.rect(gunStart.x, gy - 1, Math.floor(s.gun.len * 0.55), s.gun.w + 2, C("battleSteelDark"));
  const end = gunStart.x + s.gun.len;
  if (s.gun.brake) {
    p.rect(end - 5, gy - 1, 2, s.gun.w + 2, C("battleSteelDark"));
    p.rect(end - 2, gy - 1, 2, s.gun.w + 2, C("battleSteelDark"));
  }

  if (s.turret) {
    const tr = s.turret;
    const tx = tr.x - tr.w / 2;
    const top = g.top;
    switch (tr.shape) {
      case "cast":
        p.poly([[tx, g.hullTop], [tx + 1, top + 4], [tx + 5, top], [tx + tr.w - 7, top], [tx + tr.w, top + 5], [tx + tr.w + 1, g.hullTop]], T.mid);
        p.poly([[tx + 1, g.hullTop], [tx + 2, top + 5], [tx + 5, top + 1], [tx + 7, top + 1], [tx + 5, g.hullTop]], T.lo);
        break;
      case "horseshoe":
        p.poly([[tx, g.hullTop], [tx + 1, top + 3], [tx + 4, top], [tx + tr.w - 2, top], [tx + tr.w, top + 2], [tx + tr.w, g.hullTop]], T.mid);
        for (let x = tx + 3; x < tx + tr.w - 2; x += 2) p.line(x, top + 3, x, g.hullTop - 2, shade(T.mid, 0.88));
        p.rect(tx - 5, top + 4, 6, 6, T.lo);
        break;
      case "open":
        // Open-topped, sloped turret: the crew's helmets show over the rim.
        p.poly([[tx, g.hullTop], [tx + 4, top + 2], [tx + tr.w - 4, top + 2], [tx + tr.w + 3, g.hullTop]], T.mid);
        commander(p, tx + 8, top + 2, look);
        commander(p, tx + 16, top + 3, look);
        p.rect(tx + 2, top + 2, tr.w - 4, 1, T.hi);
        break;
      case "stuart":
        p.poly([[tx, g.hullTop], [tx + 2, top], [tx + tr.w - 3, top], [tx + tr.w + 1, g.hullTop]], T.mid);
        break;
      case "small":
      case "box":
        p.poly([[tx, g.hullTop], [tx, top + 1], [tx + 2, top], [tx + tr.w - 4, top], [tx + tr.w, top + 4], [tx + tr.w, g.hullTop]], T.mid);
        if (tr.shape === "box") {
          // Side hatch doors and a vision port.
          p.rect(tx + 8, top + 3, 4, tr.h - 5, T.lo);
          p.rect(tx + 13, top + 3, 4, tr.h - 5, T.lo);
          p.px(tx + tr.w - 6, top + 4, C("battleInk"));
        }
        break;
    }
    if (tr.shape !== "open") p.rect(tx + 3, top, tr.w - 7, 1, T.hi);
    p.rect(tx + 1, g.hullTop - 2, tr.w, 2, T.lo);
    // Turret skirts on the Panzer IV.
    if (s.skirts && tr.shape === "box") {
      p.rect(tx - 4, top + 3, tr.w + 1, tr.h - 4, mix(T.lo, T.mid, 0.45));
      p.rect(tx - 4, top + 3, tr.w + 1, 1, T.mid);
      p.rect(tx + 4, top + 6, 3, 3, T.lo);
    }
    // Mantlet and coaxial machine gun.
    p.rect(tx + tr.w - 1, g.gunAt.y - 4, 5, 8, T.lo);
    p.rect(tx + tr.w - 1, g.gunAt.y - 4, 5, 1, T.mid);
    p.px(tx + tr.w + 4, g.gunAt.y + 2, C("battleInk"));
    if (has("smokeDischargers")) for (let k = 0; k < 3; k++) p.rect(tx + tr.w - 6 + k * 2, top - 2, 2, 3, C("battleSteelDark"));
    if (has("counterweight")) {
      p.rect(tx - 8, top + 3, 9, 7, T.lo);
      for (let k = 0; k < 3; k++) p.px(tx - 6 + k * 3, top + 5, C("battleSteelDark"));
    }
    // Hatches, cupola and the commander.
    if (tr.shape !== "open") {
      if (has("cupola")) {
        p.rect(tx + 3, top - 4, 9, 4, T.lo);
        for (let k = 0; k < 3; k++) p.px(tx + 4 + k * 3, top - 3, C("battleInk"));
        commander(p, tx + 5, top - 4, look);
      } else {
        p.rect(tx + 4, top - 2, 9, 2, T.lo);
        commander(p, tx + 6, top - 2, look);
      }
    }
    if (has("roofMg50")) {
      p.rect(tx + 2, top - 6, 2, 5, C("battleSteelDark"));
      p.rect(tx, top - 8, 16, 2, C("battleSteelDark"));
      p.rect(tx + 4, top - 9, 3, 1, C("battleSteelDark"));
    }
    if (has("roofMg30")) {
      p.rect(tx + tr.w - 6, top - 5, 1, 5, C("battleSteelDark"));
      p.rect(tx + tr.w - 9, top - 6, 11, 1, C("battleSteelDark"));
    }
    if (has("antenna")) p.line(tx + 2, top, tx - 4, top - 22, C("battleSteelDark"));
    if (de(look)) camo(p, tx + 3, top + 2, tr.w - 6, tr.h - 3, look, seed + 3);
  } else if (s.casemate) {
    const c = s.casemate;
    const cx = c.x - c.w / 2;
    p.poly([[cx, g.hullTop], [cx + 3, g.top], [cx + c.w - 7, g.top], [cx + c.w + 2, g.hullTop]], T.mid);
    p.rect(cx + 3, g.top, c.w - 10, 1, T.hi);
    // The rounded "pig's head" mantlet.
    p.disc(cx + c.w, g.gunAt.y, 5, T.lo);
    p.disc(cx + c.w - 1, g.gunAt.y - 1, 3, T.mid);
    if (has("cupola")) {
      p.rect(cx + 6, g.top - 4, 9, 4, T.lo);
      commander(p, cx + 8, g.top - 4, look);
      p.line(cx + 12, g.top - 10, cx + 14, g.top - 15, C("battleSteelDark"));
    }
    if (has("mgShield")) {
      p.rect(cx + 20, g.top - 7, 2, 7, T.lo);
      p.rect(cx + 18, g.top - 6, 10, 1, C("battleSteelDark"));
    }
    if (de(look)) camo(p, cx + 4, g.top + 2, c.w - 10, c.h - 3, look, seed + 5);
  }
}

export function tankRig(kind: keyof typeof TANKS): Rig {
  const spec = (look: Look) => (de(look) ? TANKS[kind].de : TANKS[kind].us);
  return {
    body: "machine",
    hit: { x: 0, y: -18 },
    draw(p, pose, look) {
      const gun = pose.fire === "tankGun";
      const shotAt = FIRE_TIMING.tankGun.shots[0] ?? 150;
      const recoil = gun ? kick(pose.ct, shotAt, 50, 350) * 5 : 0;
      const rock = gun ? Math.round(kick(pose.ct, shotAt, 60, 200)) : 0;
      p.ctx.save();
      p.ctx.translate(-rock, 0);
      drawTank(p, spec(look), look, recoil, pose.index);
      p.ctx.restore();
    },
    muzzle(pose, _shot, look): Muzzle {
      const s = spec(look);
      const g = tankGeometry(s);
      if (pose.fire === "mg") return { x: g.mgAt.x + 4, y: g.mgAt.y, angle: 0 };
      return { x: g.gunAt.x - 2 + s.gun.len, y: g.gunAt.y, angle: 0 };
    },
  };
}

// ---- Recon: a Willys jeep with a .30 cal, or a motorcycle and sidecar with an MG 34 ----

const JEEP_MG = { x: 0, y: -34 };

function jeep(p: Painter, pose: Pose, look: Look, shake: number): void {
  const T = look.team;
  const bounce = Math.floor(pose.t / 160 + pose.index) % 2;
  const y = -bounce;
  // Spare wheel on the back.
  wheel(p, -33, y - 16, 7, "tire", 0);
  // The gunner stands in the back behind the pedestal; the tub hides his legs.
  drawSoldier(p, -15 - shake, y - 6, "stand", look, {
    lean: 2,
    back: { x: JEEP_MG.x - 7 - shake, y: y + JEEP_MG.y + 3 },
    front: { x: JEEP_MG.x - 1 - shake, y: y + JEEP_MG.y + 2 },
  });
  // Pedestal mount and the M1919 .30 cal: perforated barrel jacket, ammo can on the side.
  p.rect(-4, y + JEEP_MG.y + 2, 3, 14, C("battleSteelDark"));
  const mx = JEEP_MG.x - 9 - shake;
  p.rect(mx, y + JEEP_MG.y - 1, 13, 4, C("battleSteelDark"));
  p.rect(mx + 1, y + JEEP_MG.y - 1, 11, 1, C("battleSteel"));
  p.rect(mx + 13, y + JEEP_MG.y, 13, 2, C("battleSteelDark"));
  for (let x = mx + 14; x < mx + 25; x += 2) p.px(x, y + JEEP_MG.y, C("battleInk"));
  p.rect(mx + 3, y + JEEP_MG.y + 3, 6, 5, C("battleOlive"));
  // Driver behind the windshield, hands on the wheel.
  p.rect(-1, y - 30, 8, 10, T.clothLo);
  p.rect(0, y - 37, 6, 7, C("battleSkin"));
  p.px(4, y - 35, C("battleInk"));
  p.rect(-1, y - 40, 8, 3, T.lo);
  p.rect(-2, y - 38, 10, 1, T.deep);
  p.line(4, y - 26, 9, y - 27, T.clothLo, 2);
  p.line(9, y - 30, 7, y - 24, C("battleRubber"), 2);
  // The tub: flat sides with the cut-out beside the seats, the cowl, a flat hood.
  p.poly([[-31, y - 22], [-6, y - 22], [-3, y - 17], [3, y - 17], [6, y - 22], [32, y - 22], [33, y - 10], [-31, y - 10]], T.mid);
  p.rect(-31, y - 22, 25, 1, T.hi);
  p.rect(6, y - 22, 26, 1, T.hi);
  p.rect(-31, y - 11, 64, 1, T.lo);
  p.rect(-31, y - 22, 2, 12, T.lo);
  // The grille's vertical slots and a headlight at the nose.
  p.rect(32, y - 22, 3, 12, T.lo);
  for (let k = 0; k < 5; k++) p.px(33, y - 20 + k * 2, C("battleInk"));
  p.rect(33, y - 21, 2, 2, C("battleSkyLow"));
  // Flat fenders sticking out over the wheels, a step under the door.
  p.rect(10, y - 15, 26, 2, T.lo);
  p.rect(10, y - 15, 26, 1, T.mid);
  p.rect(-30, y - 15, 22, 2, T.lo);
  p.rect(-7, y - 12, 12, 1, C("battleSteelDark"));
  // Upright windshield frame with its glass.
  p.rect(7, y - 35, 2, 13, T.lo);
  p.rect(7, y - 35, 8, 2, T.lo);
  p.rect(9, y - 33, 5, 11, mix(C("battleSkyLow"), T.lo, 0.2));
  p.px(10, y - 32, C("battleStar"));
  // Jerrycan and shovel on the back, a whip antenna.
  p.rect(-28, y - 21, 5, 7, C("battleOlive"));
  p.line(-28, y - 21, -24, y - 15, shade(C("battleOlive"), 0.7));
  p.line(-20, y - 18, -8, y - 18, C("battleWood"));
  p.rect(-8, y - 19, 3, 2, C("battleSteel"));
  p.line(-30, y - 22, -34, y - 52, C("battleSteelDark"));
  star(p, 20, y - 18);
  wheel(p, -18, y - 7, 7, "tire", 0);
  wheel(p, 23, y - 7, 7, "tire", 0);
}

function motorcycle(p: Painter, pose: Pose, look: Look, shake: number): void {
  const T = look.team;
  const bounce = Math.floor(pose.t / 150 + pose.index) % 2;
  const y = -bounce;
  const coat = mix(C("battleFieldGrey"), C("battleRubber"), 0.25);
  // The bike: spoked wheels, frame, fuel tank, saddle, telescopic fork, headlight.
  wheel(p, -18, y - 7, 7, "spoked", pose.t);
  wheel(p, 18, y - 7, 7, "spoked", pose.t);
  p.line(-18, y - 7, 0, y - 16, C("battleSteelDark"), 2);
  p.line(0, y - 16, 18, y - 7, C("battleSteelDark"), 2);
  p.rect(-4, y - 20, 14, 5, T.mid);
  p.rect(-4, y - 20, 14, 1, T.hi);
  p.rect(-12, y - 19, 7, 2, C("battleLeather"));
  p.rect(-6, y - 14, 8, 6, C("battleSteelDark"));
  p.line(13, y - 22, 18, y - 7, C("battleSteel"), 2);
  p.rect(14, y - 23, 4, 4, C("battleSteelDark"));
  p.px(17, y - 22, C("battleSkyLow"));
  p.rect(9, y - 27, 8, 1, C("battleSteelDark"));
  // The rider in his long rubberized coat, goggles on his helmet.
  const rf = drawSoldier(p, -6, y - 10, "kneel", look, { lean: 3, front: { x: 13, y: y - 27 }, back: { x: 12, y: y - 26 } });
  p.rect(-8, rf.hip - 1, 13, 7, coat);
  p.rect(rf.head.x + 1, rf.head.y - 3, 5, 1, C("battleSkyLow"));
  // The sidecar on the near side, with its spare wheel and the gunner behind his MG 34.
  wheel(p, -2, y - 5, 5, "spoked", pose.t);
  const gx = 5 - shake;
  drawSoldier(p, -14, y - 9, "crouch", look, {
    lean: 1,
    back: { x: gx - 4, y: y - 20 },
    front: { x: gx + 3, y: y - 21 },
    weapon: () => {
      p.rect(gx - 8, y - 22, 9, 3, C("battleRubber"));
      p.rect(gx + 1, y - 22, 14, 2, C("battleSteelDark"));
      for (let x = gx + 3; x < gx + 13; x += 2) p.px(x, y - 22, C("battleInk"));
      p.rect(gx + 9, y - 24, 2, 2, C("battleSteelDark"));
      p.line(gx + 4, y - 20, gx + 7, y - 15, C("battleSteelDark"));
    },
  });
  p.poly([[-26, y - 5], [-28, y - 15], [8, y - 15], [16, y - 10], [12, y - 4]], T.mid);
  p.rect(-26, y - 15, 32, 1, T.hi);
  p.rect(-22, y - 10, 28, 2, T.lo);
  p.disc(-26, y - 12, 4, C("battleRubber"));
  p.disc(-26, y - 12, 2, C("battleSteel"));
}

export const reconRig: Rig = {
  body: "machine",
  hit: { x: 0, y: -14 },
  draw(p, pose, look) {
    const shake = pose.fire === "mg" && justFired(pose.ct, FIRE_TIMING.mg.shots, 40) >= 0 ? 1 : 0;
    if (de(look)) motorcycle(p, pose, look, shake);
    else jeep(p, pose, look, shake);
  },
  muzzle(pose, _shot, look): Muzzle {
    const bounce = Math.floor(pose.t / (de(look) ? 150 : 160) + pose.index) % 2;
    if (de(look)) return { x: 20, y: -22 - bounce, angle: 0 };
    return { x: JEEP_MG.x + 16, y: JEEP_MG.y - bounce, angle: 0 };
  },
};

// ---- Halftracks (and the chassis under the US Mobile AA) ----

function halftrackBody(p: Painter, look: Look, t: number, troops: boolean): void {
  const T = look.team;
  if (de(look)) {
    // Sd.Kfz. 251: angled armor plates, interleaved road wheels, curved front fenders, a Notek light.
    trackRun(p, -34, 10, 12);
    for (let i = 1; i < 6; i += 2) roadWheel(p, -28 + i * 6.5, -6, 5.5, 0.8);
    for (let i = 0; i < 6; i += 2) roadWheel(p, -28 + i * 6.5, -6, 5.5, 1);
    if (troops) for (let i = 0; i < 3; i++) p.rect(-26 + i * 9, -32, 7, 4, T.lo);
    p.poly([[-34, -12], [-32, -28], [4, -28], [16, -21], [34, -17], [36, -11]], T.mid);
    p.rect(-32, -28, 36, 1, T.hi);
    p.line(4, -28, 16, -21, T.hi);
    p.line(16, -21, 34, -17, T.hi);
    p.rect(-33, -14, 69, 2, T.lo);
    for (const vx of [-24, -10, 6]) p.rect(vx, -24, 4, 1, C("battleInk"));
    p.rect(-30, -19, 9, 4, T.lo);
    p.rect(-18, -19, 9, 4, T.lo);
    p.rect(30, -18, 2, 2, C("battleSteelDark"));
    p.poly([[16, -12], [20, -17], [32, -17], [36, -12]], T.lo);
    wheel(p, 26, -7, 7, "spoked", t);
    camo(p, -30, -26, 32, 8, look, 1);
    return;
  }
  // M3: a box body, an armored cab with its windshield shutter up, a hood with louvres, a winch
  // roller on the bumper, headlights with brush guards.
  trackRun(p, -32, 6, 12);
  for (let i = 0; i < 4; i++) roadWheel(p, -24 + i * 7, -5, 4.5);
  if (troops) for (let i = 0; i < 3; i++) p.rect(-28 + i * 10, -31, 7, 4, T.lo);
  p.rect(-34, -27, 42, 15, T.mid);
  p.rect(-34, -27, 42, 1, T.hi);
  p.rect(-34, -14, 42, 2, T.lo);
  for (let x = -30; x < 6; x += 6) p.px(x, -22, T.lo);
  p.rect(6, -28, 12, 16, T.mid);
  p.rect(7, -28, 10, 3, C("battleSteelDark"));
  p.rect(8, -25, 8, 3, C("battleSkyLow"));
  p.rect(18, -21, 15, 9, T.mid);
  p.rect(18, -21, 15, 1, T.hi);
  for (let x = 20; x < 30; x += 2) p.px(x, -18, T.lo);
  p.rect(32, -21, 2, 9, C("battleSteelDark"));
  p.rect(30, -23, 3, 2, C("battleSkyLow"));
  p.line(29, -24, 34, -22, C("battleSteelDark"));
  p.disc(37, -12, 3, C("battleSteel"));
  p.disc(37, -12, 1.5, C("battleSteelDark"));
  p.disc(25, -10, 8, T.lo);
  wheel(p, 25, -7, 7, "tire", t);
  star(p, -14, -20);
}

export const halftrackRig: Rig = {
  body: "machine",
  hit: { x: 0, y: -16 },
  draw(p, pose, look) {
    const bob = Math.floor(pose.t / 170 + pose.index) % 2;
    p.ctx.save();
    p.ctx.translate(0, -bob);
    halftrackBody(p, look, pose.t, true);
    // The squad's machine gun: a .50 on the ring mount, or an MG 34 behind its shield.
    if (de(look)) {
      p.rect(2, -35, 3, 8, C("battleSteel"));
      p.rect(-4, -32, 18, 2, C("battleSteelDark"));
      p.rect(-7, -33, 4, 3, C("battleRubber"));
    } else {
      p.rect(4, -33, 14, 2, C("battleSteelDark"));
      p.rect(7, -36, 11, 3, C("battleSteelDark"));
      p.rect(18, -35, 11, 1, C("battleSteel"));
    }
    p.ctx.restore();
  },
  muzzle(): Muzzle {
    return { x: 29, y: -35, angle: 0 };
  },
};

// ---- Mobile AA: four guns on a halftrack, aimed high at aircraft ----

const AA_PIVOT = { x: -14, y: -33 };
const aaAngle = (atAir: boolean) => (atAir ? -1.0 : -0.12);
const aaBarrel = (look: Look) => (de(look) ? 24 : 20);
/** The four barrels' offsets from the mount, across the line of fire. */
const AA_OFFSETS = [-3, -1, 2, 4] as const;

export const mobileAARig: Rig = {
  body: "machine",
  hit: { x: 0, y: -16 },
  draw(p, pose, look) {
    const T = look.team;
    halftrackBody(p, look, pose.t, false);
    const angle = aaAngle(pose.atAir);
    const shot = pose.fire === "aaGuns" ? justFired(pose.ct, FIRE_TIMING.aaGuns.shots, 45) : -1;
    const jitter = shot >= 0 ? 1 : 0;
    const steel = C("battleSteelDark");
    // The mount, and the gunner's head between the guns.
    p.rect(AA_PIVOT.x - 10, AA_PIVOT.y + 4, 22, 5, T.lo);
    commander(p, AA_PIVOT.x - 3, AA_PIVOT.y + 2, look);
    AA_OFFSETS.forEach((off, i) => {
      const recoil = shot >= 0 && shot % 4 === i ? 2 : 0;
      const start = along(AA_PIVOT.x + 2 - Math.sin(angle) * off, AA_PIVOT.y + Math.cos(angle) * off, angle, -recoil);
      const end = p.barrel(start.x, start.y, aaBarrel(look), angle, 1, i % 2 ? C("battleSteel") : steel);
      // Flash hiders on the German 20mm guns, perforated jackets on the .50s.
      if (de(look)) p.rect(end.x - 1, end.y - 1, 2, 2, steel);
    });
    p.rect(AA_PIVOT.x - 2 - jitter, AA_PIVOT.y - 2, 8, 8, steel);
    if (de(look)) {
      // Flakvierling 38: a big flat shield.
      p.poly([[AA_PIVOT.x + 8, AA_PIVOT.y - 10], [AA_PIVOT.x + 11, AA_PIVOT.y - 10], [AA_PIVOT.x + 11, AA_PIVOT.y + 8], [AA_PIVOT.x + 8, AA_PIVOT.y + 8]], T.mid);
      p.rect(AA_PIVOT.x + 8, AA_PIVOT.y - 10, 3, 1, T.hi);
    } else {
      // Maxson mount: ammunition chests either side and armored wings.
      p.rect(AA_PIVOT.x - 10, AA_PIVOT.y - 1, 6, 6, C("battleOlive"));
      p.rect(AA_PIVOT.x + 6, AA_PIVOT.y + 1, 6, 6, C("battleOlive"));
      p.rect(AA_PIVOT.x - 10, AA_PIVOT.y - 1, 6, 1, shade(C("battleOlive"), 1.3));
      p.rect(AA_PIVOT.x - 12, AA_PIVOT.y + 2, 2, 7, T.lo);
    }
  },
  muzzle(pose, shot, look): Muzzle {
    const angle = aaAngle(pose.atAir);
    const off = AA_OFFSETS[shot % 4] ?? 0;
    const m = along(AA_PIVOT.x + 2 - Math.sin(angle) * off, AA_PIVOT.y + Math.cos(angle) * off, angle, aaBarrel(look));
    return { x: m.x, y: m.y, angle };
  },
};

// ---- Flak gun: an 88 or a 90mm on its cross-shaped platform ----

const FLAK_PIVOT = { x: 0, y: -24 };
const flakAngle = (atAir: boolean) => (atAir ? -0.95 : -0.06);
const FLAK_LEN = 56;
const FLAK_BACK = 14;

export const flakRig: Rig = {
  body: "machine",
  hit: { x: 0, y: -16 },
  draw(p, pose, look) {
    const T = look.team;
    const ct = pose.fire === "flak" ? pose.ct : null;
    const shots = FIRE_TIMING.flak.shots;
    const recoil = Math.max(...shots.map((s) => kick(ct, s, 40, 260))) * 8;
    const angle = flakAngle(pose.atAir);
    // Platform with outriggers and jack pads, pedestal and carriage.
    p.rect(-38, -6, 76, 4, T.lo);
    p.rect(-38, -6, 76, 1, T.mid);
    p.rect(-41, -2, 7, 2, C("battleSteelDark"));
    p.rect(34, -2, 7, 2, C("battleSteelDark"));
    p.rect(-10, -8, 20, 4, T.mid);
    p.rect(-6, -22, 12, 16, T.mid);
    p.rect(-6, -22, 12, 1, T.hi);
    p.rect(-8, -26, 16, 5, T.lo);
    // Barrel with the recuperators above and below it, breech block behind.
    const start = along(FLAK_PIVOT.x, FLAK_PIVOT.y, angle, -FLAK_BACK - recoil);
    p.barrel(start.x, start.y, FLAK_LEN + FLAK_BACK, angle, 3, C("battleSteelDark"));
    p.barrel(start.x, start.y - 1, FLAK_LEN + FLAK_BACK, angle, 1, C("battleSteel"));
    const upper = along(FLAK_PIVOT.x - Math.sin(angle) * -4, FLAK_PIVOT.y + Math.cos(angle) * -4, angle, -10);
    p.barrel(upper.x, upper.y, 30, angle, 2, T.lo);
    const lower = along(FLAK_PIVOT.x - Math.sin(angle) * 4, FLAK_PIVOT.y + Math.cos(angle) * 4, angle, -8);
    p.barrel(lower.x, lower.y, 24, angle, 2, T.lo);
    p.rect(start.x - 4, start.y - 4, 8, 8, C("battleSteelDark"));
    p.rect(start.x - 4, start.y - 4, 8, 1, C("battleSteel"));
    if (de(look)) {
      // The 88's gun shield.
      p.poly([[9, -40], [14, -40], [14, -12], [9, -10]], T.mid);
      p.rect(9, -40, 5, 1, T.hi);
      p.rect(10, -30, 2, 3, C("battleInk"));
    } else {
      // The 90mm's fuze setter box.
      p.rect(-20, -16, 6, 8, T.lo);
    }
    // Loader with the next round; the layer at the handwheels.
    const reloading = ct !== null && ct > 300 && ct < 620;
    const u = seg(ct, 380, 560);
    const breech = along(FLAK_PIVOT.x, FLAK_PIVOT.y, angle, -FLAK_BACK - 4);
    const shellAt = { x: lerp(-34, breech.x - 8, u), y: lerp(-24, breech.y, u) };
    drawSoldier(p, -30, 0, "stand", look, {
      front: reloading || ct === null ? { x: shellAt.x + 12, y: shellAt.y + 1 } : { x: -24, y: -14 },
      back: reloading || ct === null ? { x: shellAt.x + 3, y: shellAt.y + 2 } : { x: -32, y: -14 },
      weapon: () => {
        if (reloading || ct === null) {
          p.rect(shellAt.x, shellAt.y, 12, 3, C("battleBrass"));
          p.rect(shellAt.x + 12, shellAt.y, 4, 3, C("battleSteelDark"));
          p.px(shellAt.x + 16, shellAt.y + 1, C("battleSteelDark"));
        }
      },
    });
    const wheelTurn = Math.floor(pose.t / 200) % 2;
    drawSoldier(p, 20, 0, "kneel", look, { lean: -3, front: { x: 13, y: -18 + wheelTurn }, back: { x: 12, y: -17 } });
    p.disc(12, -17, 3, C("battleSteelDark"));
    p.disc(12, -17, 1, C("battleSteel"));
    // A spent casing kicked out of the breech.
    for (const s of shots) {
      const k = seg(ct, s + 30, s + 400);
      if (k > 0 && k < 1) p.rect(breech.x - 4 - k * 24, breech.y - Math.sin(k * Math.PI) * 10 + k * 18, 6, 2, C("battleBrass"));
    }
  },
  muzzle(pose): Muzzle {
    const angle = flakAngle(pose.atAir);
    const m = along(FLAK_PIVOT.x, FLAK_PIVOT.y, angle, FLAK_LEN);
    return { x: m.x, y: m.y, angle };
  },
};

// ---- Artillery: a howitzer with a loader, a gunner on the lanyard and an ammunition handler ----

const HOWITZER_PIVOT = { x: 4, y: -28 };
const HOWITZER_ANGLE = -0.8;
const HOWITZER_LEN = 44;
const HOWITZER_BACK = 16;

export const artilleryRig: Rig = {
  body: "machine",
  hit: { x: 0, y: -14 },
  draw(p, pose, look) {
    const T = look.team;
    const ct = pose.fire === "howitzer" ? pose.ct : null;
    const shotAt = FIRE_TIMING.howitzer.shots[0] ?? 760;
    const recoil = kick(ct, shotAt, 50, 420) * 7;
    const hop = Math.round(kick(ct, shotAt, 40, 120));

    // Ready rounds in their box by the trail.
    p.rect(-62, -7, 12, 7, C("battleWood"));
    p.rect(-62, -7, 12, 1, shade(C("battleWood"), 1.3));
    for (let i = 0; i < 3; i++) p.rect(-61 + i * 4, -11, 3, 4, C("battleBrass"));

    p.ctx.save();
    p.ctx.translate(0, -hop);
    // Split trail with spades.
    p.line(-2, -15, -50, -2, T.lo, 5);
    p.line(-2, -16, -50, -3, T.mid, 1);
    p.rect(-55, -6, 6, 6, C("battleSteelDark"));
    // Barrel with the recuperator underneath, the cradle and the breech block.
    const start = along(HOWITZER_PIVOT.x, HOWITZER_PIVOT.y, HOWITZER_ANGLE, -HOWITZER_BACK - recoil);
    p.barrel(start.x, start.y, HOWITZER_LEN + HOWITZER_BACK, HOWITZER_ANGLE, 5, C("battleSteelDark"));
    p.barrel(start.x, start.y - 2, HOWITZER_LEN + HOWITZER_BACK, HOWITZER_ANGLE, 1, C("battleSteel"));
    const rec = along(HOWITZER_PIVOT.x - Math.sin(HOWITZER_ANGLE) * 5, HOWITZER_PIVOT.y + Math.cos(HOWITZER_ANGLE) * 5, HOWITZER_ANGLE, -12);
    p.barrel(rec.x, rec.y, 38, HOWITZER_ANGLE, 4, T.lo);
    p.barrel(rec.x, rec.y - 1, 38, HOWITZER_ANGLE, 1, T.mid);
    // Equilibrator spring and the breech block with its handle.
    p.line(-4, -18, rec.x + 10, rec.y + 2, C("battleSteel"), 2);
    p.rect(start.x - 5, start.y - 5, 10, 10, C("battleSteelDark"));
    p.rect(start.x - 5, start.y - 5, 10, 1, C("battleSteel"));
    p.line(start.x - 5, start.y + 5, start.x - 9, start.y + 9, C("battleSteel"));
    if (de(look)) {
      // leFH 18: a muzzle brake, a tall shield with a notch, pressed-steel spoked wheels.
      const m = along(start.x, start.y, HOWITZER_ANGLE, HOWITZER_LEN + HOWITZER_BACK);
      p.rect(m.x - 4, m.y - 4, 5, 8, C("battleSteelDark"));
      p.poly([[7, -52], [15, -52], [15, -14], [7, -11]], T.mid);
      p.rect(7, -52, 8, 1, T.hi);
      p.rect(8, -44, 6, 4, C("battleInk"));
      wheel(p, 0, -14, 14, "spoked", 0);
    } else {
      // M2A1 105mm: a low, angled shield, rubber tires and a hand-spike on the trail.
      p.poly([[7, -44], [14, -47], [14, -13], [7, -11]], T.mid);
      p.rect(7, -44, 7, 1, T.hi);
      p.line(-36, -6, -40, -14, C("battleWood"), 2);
      wheel(p, 0, -14, 14, "tire", 0);
    }
    p.ctx.restore();

    // The loader carries a shell up and rams it home, steps back and covers his ears.
    const step = seg(ct, 0, 320);
    const ram = seg(ct, 320, 480);
    const clear = ct !== null && ct > 520 && ct < 1150;
    const breech = along(HOWITZER_PIVOT.x, HOWITZER_PIVOT.y, HOWITZER_ANGLE, -HOWITZER_BACK - 2);
    const lx = clear ? -40 : lerp(-40, -28, step);
    const lStance = clear ? "crouch" : "stand";
    const lf = soldierFrame(lx, 0, lStance);
    const shell = { x: lerp(lx + 4, breech.x - 2, ram), y: lerp(lf.top + 7, breech.y + 1, ram) };
    const carrying = ct === null || ram < 1;
    drawSoldier(p, lx, 0, lStance, look, {
      ...(clear
        ? earsCovered(lf)
        : carrying
          ? { front: { x: shell.x + 9, y: shell.y + 2 }, back: { x: shell.x + 3, y: shell.y + 3 } }
          : { front: { x: breech.x - 2, y: breech.y + 2 } }),
      weapon: () => {
        if (carrying && ct !== null) {
          p.rect(shell.x, shell.y, 9, 4, C("battleBrass"));
          p.rect(shell.x + 9, shell.y, 4, 4, C("battleOlive"));
          p.px(shell.x + 13, shell.y + 1, C("battleOlive"));
        }
      },
    });
    // The gunner kneels by the trail and jerks the lanyard.
    const pull = kick(ct, shotAt - 40, 40, 300) * 4;
    const hand = { x: -16 - pull, y: -18 };
    drawSoldier(p, -14, 0, "kneel", look, { front: hand, back: { x: -18, y: -14 } });
    if (ct !== null && ct > 560) p.line(hand.x, hand.y, breech.x, breech.y + 2, C("battleLeather"));
  },
  muzzle(): Muzzle {
    const m = along(HOWITZER_PIVOT.x, HOWITZER_PIVOT.y, HOWITZER_ANGLE, HOWITZER_LEN);
    return { x: m.x, y: m.y, angle: HOWITZER_ANGLE };
  },
};

// ---- Rocket Artillery: a Calliope rack on a Sherman, or a Nebelwerfer ----

/**
 * The rocket unit's forward observer: one soldier, kneeling out in front of the lead launcher,
 * watching the target through binoculars, with a field telephone.
 */
function spotter(p: Painter, x: number, look: Look): void {
  const f = soldierFrame(x, 0, "kneel", 1);
  const eye = { x: f.head.x + 1 + 6, y: f.head.y + 2 };
  drawSoldier(p, x, 0, "kneel", look, {
    lean: 1,
    headDx: 1,
    back: { x: eye.x - 1, y: eye.y + 2 },
    front: { x: eye.x + 1, y: eye.y + 3 },
    weapon: () => {
      p.rect(eye.x - 1, eye.y - 1, 5, 3, C("battleRubber"));
      p.px(eye.x + 3, eye.y - 1, C("battleSkyLow"));
      p.px(eye.x + 3, eye.y + 1, C("battleSkyLow"));
    },
  });
  // Field telephone in its leather case at his knee.
  p.rect(x - 12, -6, 6, 6, C("battleLeather"));
  p.rect(x - 11, -5, 4, 2, C("battleSteelDark"));
  p.line(x - 12, -1, x - 30, 0, C("battleRubber"));
}

const NEBEL_PIVOT = { x: 2, y: -22 };
const NEBEL_ANGLE = -0.7;
const CALLIOPE = { x: 2, y: -52, angle: -0.35 };

export const rocketRig: Rig = {
  body: "machine",
  hit: { x: 0, y: -16 },
  draw(p, pose, look) {
    const T = look.team;
    const ct = pose.fire === "rockets" ? pose.ct : null;
    const shot = justFired(ct, FIRE_TIMING.rockets.shots, 60);
    const firing = ct !== null && ct < 1200;
    if (de(look)) {
      // Nebelwerfer 41: six barrels in a ring on a light two-wheeled carriage, fired by a crew
      // sheltering in a foxhole with the firing cable.
      p.line(0, -10, -30, -1, T.lo, 3);
      p.rect(-33, -4, 4, 4, C("battleSteelDark"));
      for (let i = 0; i < 3; i++) {
        const off = (i - 1) * 5;
        const start = along(NEBEL_PIVOT.x - Math.sin(NEBEL_ANGLE) * off, NEBEL_PIVOT.y + Math.cos(NEBEL_ANGLE) * off, NEBEL_ANGLE, -12);
        p.barrel(start.x, start.y, 32, NEBEL_ANGLE, 4, i === 1 ? C("battleSteel") : C("battleSteelDark"));
        p.barrel(start.x, start.y - 1, 32, NEBEL_ANGLE, 1, shade(C("battleSteel"), 1.15));
        for (const d of [6, 22]) {
          const band = along(start.x, start.y, NEBEL_ANGLE, d);
          p.rect(band.x - 1, band.y - 3, 3, 6, T.lo);
        }
        const mouth = along(start.x, start.y, NEBEL_ANGLE, 32);
        p.px(mouth.x, mouth.y, C("battleInk"));
      }
      p.rect(NEBEL_PIVOT.x - 4, NEBEL_PIVOT.y - 2, 8, 12, T.mid);
      wheel(p, 0, -8, 8, "spoked", 0);
      const f = soldierFrame(-54, 2, "crouch");
      sandbags(p, -66, -40, 2, 6);
      drawSoldier(p, -54, 2, "crouch", look, firing ? earsCovered(f) : { front: { x: -44, y: -8 } });
      sandbags(p, -66, -44, 4, 4);
      if (firing) p.line(-44, -4, -8, -4, C("battleRubber"));
      if (pose.index === 0) spotter(p, 46, look);
      return;
    }
    // T34 Calliope: a Sherman with a 60-tube launcher over its turret, tied to the gun barrel.
    if (pose.index === 0) spotter(p, 58, look);
    drawTank(p, TANKS.medium.us, look, 0, pose.index);
    const rack = (dx: number, dy: number): Pt => {
      const a = CALLIOPE.angle;
      return { x: CALLIOPE.x + Math.cos(a) * dx - Math.sin(a) * dy, y: CALLIOPE.y + Math.sin(a) * dx + Math.cos(a) * dy };
    };
    const corners = [rack(-26, 0), rack(26, 0), rack(26, 20), rack(-26, 20)];
    p.poly(corners.map((c) => [c.x, c.y] as const), T.lo);
    p.line(corners[0]?.x ?? 0, corners[0]?.y ?? 0, corners[1]?.x ?? 0, corners[1]?.y ?? 0, T.hi);
    for (let row = 0; row < 5; row++) {
      for (let col = 0; col < 13; col++) {
        const at = rack(-24 + col * 4, 2 + row * 4);
        p.rect(at.x, at.y, 2, 2, C("battleInk"));
        p.px(at.x, at.y, C("battleSteel"));
      }
    }
    const frontTube = rack(26, 10);
    p.line(frontTube.x, frontTube.y, 30, -30, C("battleSteelDark"), 2);
    p.line(rack(-18, 20).x, rack(-18, 20).y, -8, -36, C("battleSteelDark"), 2);
    if (shot >= 0) {
      const flash = rack(26, 3 + (shot % 5) * 4);
      p.rect(flash.x - 1, flash.y - 1, 4, 4, C("battleFlash"));
    }
  },
  muzzle(_pose, shot, look): Muzzle {
    if (de(look)) {
      const off = ((shot % 3) - 1) * 5;
      const m = along(NEBEL_PIVOT.x - Math.sin(NEBEL_ANGLE) * off, NEBEL_PIVOT.y + Math.cos(NEBEL_ANGLE) * off, NEBEL_ANGLE, 20);
      return { x: m.x, y: m.y, angle: NEBEL_ANGLE };
    }
    const a = CALLIOPE.angle;
    const dy = 3 + (shot % 5) * 4;
    return { x: CALLIOPE.x + Math.cos(a) * 28 - Math.sin(a) * dy, y: CALLIOPE.y + Math.sin(a) * 28 + Math.cos(a) * dy, angle: a };
  },
};

// ---- Bunker ----

export const bunkerRig: Rig = {
  body: "machine",
  hit: { x: 0, y: -18 },
  draw(p, pose, look) {
    const T = look.team;
    // Thick concrete with a stepped roof, an embrasure with a gun barrel in it, and a steel door.
    p.poly([[-42, 0], [-38, -26], [-30, -34], [30, -34], [38, -26], [42, 0]], T.mid);
    p.rect(-30, -34, 60, 2, T.hi);
    p.rect(-26, -38, 44, 4, T.lo);
    p.rect(-26, -38, 44, 1, T.mid);
    p.poly([[-38, -26], [-30, -34], [-30, 0], [-42, 0]], T.lo);
    for (let y = -30; y < -2; y += 6) p.rect(-29, y, 66, 1, shade(T.mid, 0.9));
    p.rect(-4, -22, 32, 6, C("battleInk"));
    p.rect(-4, -16, 32, 1, T.hi);
    p.rect(14, -20, 22, 2, C("battleSteelDark"));
    p.rect(-24, -20, 9, 18, C("battleSteelDark"));
    p.rect(-24, -20, 9, 1, C("battleSteel"));
    p.px(-17, -11, C("battleSteel"));
    // Camouflage netting over the roof.
    for (let x = -26; x < 18; x += 6) p.disc(x, -38, 3, mix(C("battleTreeDark"), T.mid, 0.3));
    sandbags(p, -44, 44, 0, 8);
    // Cracks and exposed rebar grow as it loses HP.
    const cracks = 10 - pose.hp;
    for (let i = 0; i < cracks; i++) {
      const cx = -26 + ((i * 17) % 52);
      const cy = -32 + ((i * 7) % 18);
      p.line(cx, cy, cx + 3, cy + 4, T.deep);
      p.line(cx + 3, cy + 4, cx + 1, cy + 8, T.deep);
      if (i % 3 === 2) p.line(cx + 1, cy, cx + 5, cy - 3, C("battleLeather"));
    }
  },
  muzzle(): Muzzle {
    return { x: 36, y: -19, angle: 0 };
  },
};
