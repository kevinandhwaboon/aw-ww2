// Kit for 32x32 unit sprites in a top-down 3/4 view (docs/08-art-pipeline.md §17). Sprites are
// painted as shapes made of materials; finish() then outlines each shape against what it covers and
// bevels it, lit from the top left. All units face right.

export const N = 32;

// Material ramps, light to dark. "team" is swapped per owner (H, L, M, D, N in the team ramp).
const MATERIALS = {
  team: ["H", "L", "M", "D", "N"],
  metal: ["X", "W", "p", "h", "t"],
  rubber: ["p", "r", "h", "t", "t"],
  skin: ["o", "o", "q", "q", "x"],
  wood: ["B", "B", "b", "b", "x"],
  darkwood: ["b", "b", "x", "x", "x"],
  leather: ["B", "b", "x", "x", "x"],
  canvas: ["i", "a", "A", "A", "x"],
  star: ["S", "S", "S", "S", "S"],
  sun: ["e", "e", "e", "e", "e"],
  card: ["S", "S", "S", "S", "S"],
  ink: ["k", "k", "k", "k", "k"],
  glass: ["c", "c", "c", "c", "c"],
};

/** Fixed colors shared by every team. */
export const fixedColors = {
  K: "#16160f", t: "#2e2c26", r: "#6a665a", p: "#8e8a7c", W: "#9c9888", h: "#4a473e", X: "#c4c0b0",
  S: "#f2efe0", o: "#ecc090", q: "#c08a5c", b: "#7a4e28", B: "#b07a42", x: "#4a3a24",
  i: "#e6dab4", a: "#c8b88c", A: "#9c8c64", k: "#1e1e1e", c: "#a8d8e8", e: "#c03028",
};

/** Five-tone team ramps. */
export const teamRamps = {
  // Army green: the US color since 2026-11-08 (08-art-pipeline §12).
  olive: { H: "#b8c890", L: "#8ea25e", M: "#64783a", D: "#435428", N: "#2a3818" },
  khaki: { H: "#e2d29a", L: "#c4ae6c", M: "#9a8648", D: "#6c5c30", N: "#463a1e" },
  grey: { H: "#c6ccc2", L: "#a2a89e", M: "#747b72", D: "#4e554f", N: "#333834" },
  blue: { H: "#a8d0f8", L: "#7fb0e8", M: "#4a7fcc", D: "#2c5296", N: "#1a3264" },
  red: { H: "#f8b49c", L: "#ec8a70", M: "#c9503a", D: "#8c3022", N: "#5a1c14" },
};

/** A blank sprite to paint shapes into. Each rect/oval starts a new shape with its own outline. */
export function sprite() {
  const cells = Array.from({ length: N }, () => Array(N).fill(null));
  let part = 0;
  const put = (x, y, mat, tone) => {
    x = Math.round(x);
    y = Math.round(y);
    if (x >= 0 && y >= 0 && x < N && y < N) cells[y][x] = { mat, tone, part };
  };
  return {
    cells,
    shape() { part += 1; return this; },
    /** A box. With grad, the half away from the light is a tone darker. */
    rect(x0, y0, x1, y1, mat, tone, grad = false) {
      this.shape();
      const span = x1 - x0 + (y1 - y0);
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) {
        put(x, y, mat, grad && x - x0 + (y - y0) > span * 0.55 ? tone + 1 : tone);
      }
      return this;
    },
    /** An ellipse. With grad, lit on the top left and shaded on the bottom right. */
    oval(cx, cy, rx, ry, mat, tone, grad = false) {
      this.shape();
      for (let y = Math.floor(cy - ry); y <= Math.ceil(cy + ry); y++) {
        for (let x = Math.floor(cx - rx); x <= Math.ceil(cx + rx); x++) {
          const dx = (x - cx) / rx, dy = (y - cy) / ry;
          if (dx * dx + dy * dy > 1) continue;
          const lit = dx * 0.7 + dy * 0.7;
          put(x, y, mat, grad && lit > 0.25 ? tone + 1 : grad && lit < -0.45 ? tone - 1 : tone);
        }
      }
      return this;
    },
    /** A filled polygon from [x, y] corners. */
    poly(points, mat, tone) {
      this.shape();
      const ys = points.map((p) => p[1]);
      for (let y = Math.floor(Math.min(...ys)); y <= Math.ceil(Math.max(...ys)); y++) {
        for (let x = 0; x < N; x++) {
          let inside = false;
          for (let i = 0, j = points.length - 1; i < points.length; j = i++) {
            const [xi, yi] = points[i], [xj, yj] = points[j];
            if ((yi > y + 0.5) !== (yj > y + 0.5) && x + 0.5 < ((xj - xi) * (y + 0.5 - yi)) / (yj - yi) + xi) inside = !inside;
          }
          if (inside) put(x, y, mat, tone);
        }
      }
      return this;
    },
    /** A thick straight bar, like a gun barrel, as its own shape. */
    bar(x0, y0, x1, y1, width, mat, tone) {
      this.shape();
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0)) * 2;
      for (let i = 0; i <= steps; i++) {
        const x = x0 + ((x1 - x0) * i) / steps, y = y0 + ((y1 - y0) * i) / steps;
        for (let w = 0; w < width; w++) put(x, y + w, mat, w === 0 ? tone - 1 : tone);
      }
      return this;
    },
    /** Details inside the current shape, with no outline of their own. */
    fill(x0, y0, x1, y1, mat, tone) {
      for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) put(x, y, mat, tone);
      return this;
    },
    dot(x, y, mat, tone) { put(x, y, mat, tone); return this; },
    line(x0, y0, x1, y1, mat, tone) {
      const steps = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
      for (let i = 0; i <= steps; i++) put(x0 + ((x1 - x0) * i) / steps, y0 + ((y1 - y0) * i) / steps, mat, tone);
      return this;
    },
    /** The current shape shades what lies under it, down and to the right. */
    shadow() {
      const shaded = new Set();
      for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
        if (cells[y][x]?.part !== part) continue;
        for (const [dx, dy] of [[1, 1], [2, 1], [2, 2]]) {
          const t = cells[y + dy]?.[x + dx];
          const key = (y + dy) * N + x + dx;
          if (t && t.part < part && !shaded.has(key)) { t.tone += 1; shaded.add(key); }
        }
      }
      return this;
    },
  };
}

/**
 * Turns painted shapes into color letters. Shapes are outlined where they meet empty space, and,
 * with inner on, where they cover an earlier shape. Then each is bevelled: lit edge top left,
 * shaded edge bottom right.
 */
export function finish(s, inner = true) {
  const at = (x, y) => s.cells[y]?.[x] ?? null;
  return s.cells.map((row, y) => row.map((c, x) => {
    if (!c) return ".";
    const neighbors = [at(x - 1, y), at(x + 1, y), at(x, y - 1), at(x, y + 1)];
    if (neighbors.some((n) => !n || (inner && n.part < c.part))) return "K";
    const ramp = MATERIALS[c.mat];
    if (!ramp) throw new Error(`unknown material ${c.mat}`);
    if (c.mat === "star" || c.mat === "sun" || c.mat === "card" || c.mat === "ink" || c.mat === "glass") return ramp[0];
    let tone = c.tone;
    const ul = at(x - 1, y - 1), dr = at(x + 1, y + 1);
    if (!ul || ul.part !== c.part) tone -= 1;
    if (!dr || dr.part !== c.part) tone += 1;
    return ramp[Math.max(0, Math.min(ramp.length - 1, tone))];
  }).join(""));
}

/** Stacks finished layers: anything not "." in a later layer wins. */
export const overlay = (...layers) => layers.reduce((base, top) =>
  base.map((row, y) => [...row].map((ch, x) => (top[y][x] !== "." ? top[y][x] : ch)).join("")));

/** Moves a finished layer down (positive dy) or up. */
export const shift = (grid, dx, dy) => grid.map((_, y) =>
  Array.from({ length: N }, (_, x) => grid[y - dy]?.[x - dx] ?? ".").join(""));

// ---- Running gear ----

/** The near track: a rubber run with its top showing and road wheels that turn between frames. */
export function track(s, frame, { left = 1, right = 30, top = 23, wheels = [5, 10.5, 16, 21.5, 27], r = 2.5 } = {}) {
  s.rect(left, top, right, 30, "rubber", 3);
  for (let x = left + 1 + frame; x < right; x += 3) s.dot(x, top + 1, "rubber", 0);
  for (const cx of wheels) {
    s.oval(cx, 27.5, r, r, "metal", 1);
    const hx = Math.round(cx);
    s.dot(hx + (frame ? 1 : 0), 27, "metal", 3).dot(hx + (frame ? 0 : 1), 28, "metal", 3);
  }
}

/** Big overlapping road wheels, as on the Tiger and German halftracks. */
export function interleavedTrack(s, frame, { left = 1, right = 30, top = 22 } = {}) {
  s.rect(left, top, right, 30, "rubber", 3);
  for (let x = left + 1 + frame; x < right; x += 3) s.dot(x, top + 1, "rubber", 0);
  for (let cx = left + 3; cx < right - 1; cx += 4) {
    s.oval(cx, 27, 3, 3, "metal", (cx / 4) % 2 ? 1 : 2);
    s.dot(cx + (frame ? 1 : -1), 27, "metal", 3);
  }
}

/** A tyre seen from the side, with a hub that turns between frames. */
export function wheel(s, cx, cy, r, frame) {
  s.oval(cx, cy, r, r, "rubber", 3);
  s.oval(cx, cy, r * 0.5, r * 0.5, "metal", 1);
  s.dot(cx + (frame ? 1 : -1), cy, "metal", 3);
}

/**
 * Wheels set into the bodywork: a dark arch is cut into the current shape (the body) over each
 * wheel, and the wheels are drawn last, so the body wraps round their top half instead of riding
 * above them. Call arches right after the body, and wheelsInWells at the end.
 */
export function arches(s, wheels) {
  for (const [cx, cy, r] of wheels) {
    for (let a = 0; a <= Math.PI; a += 0.08) s.dot(cx + Math.cos(a) * (r + 1), cy - Math.sin(a) * (r + 1), "team", 4);
  }
}
export function wheelsInWells(s, wheels, frame) {
  for (const [cx, cy, r] of wheels) wheel(s, cx, cy, r, frame);
}

/** Five-point star, white, painted into the current shape. */
export function star(s, x, y) {
  for (const [dx, dy] of [[3, 0], [2, 1], [3, 1], [4, 1], [0, 2], [1, 2], [2, 2], [3, 2], [4, 2], [5, 2], [6, 2], [1, 3], [2, 3], [3, 3], [4, 3], [5, 3], [1, 4], [2, 4], [4, 4], [5, 4]]) {
    s.dot(x + dx, y + dy, "star", 0);
  }
}

/**
 * The hinomaru, Japan's aircraft marking: a red disc in a thin white ring, painted into the current
 * shape. The plain national disc only; the rising-sun ensign is never drawn (08-art-pipeline §12).
 */
export function hinomaru(s, cx, cy, r = 2.5) {
  for (let y = Math.floor(cy - r - 1); y <= Math.ceil(cy + r + 1); y++) {
    for (let x = Math.floor(cx - r - 1); x <= Math.ceil(cx + r + 1); x++) {
      const d = Math.hypot(x - cx, y - cy);
      if (d <= r) s.dot(x, y, "sun", 0);
      else if (d <= r + 1) s.dot(x, y, "star", 0);
    }
  }
}

/** Engine grilles on a rear deck: dark slats every other row. */
export function grille(s, x0, x1, y0, y1) {
  for (let y = y0; y <= y1; y += 2) s.line(x0, y, x1, y, "team", 3);
}

// ---- Soldiers ----

/** The US M1 helmet: a rounded dome, widest at the rim, with the rim as a darker band. */
export function m1Helmet(s, cx = 15.5, top = 2, rim = 10, half = 7.2) {
  s.shape();
  for (let y = top; y <= rim; y++) {
    for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
      const dx = (x - cx) / half, dy = (y - (rim + 0.5)) / (rim - top + 0.5);
      if (dx * dx + dy * dy > 1) continue;
      const lit = dx * 0.7 + dy * 0.7;
      s.dot(x, y, "team", y >= rim - (half > 5 ? 1 : 0) ? 3 : lit < -0.55 ? 0 : lit < 0 ? 1 : 2);
    }
  }
}

/**
 * The German Stahlhelm: a tall crown, a short visor at the front, and a skirt that flares out and
 * down over the ears and the back of the neck. Faces right, so the back is on the left.
 */
export function stahlhelm(s, cx = 15.5, top = 2, rim = 10, half = 6) {
  s.shape();
  const k = half / 6;
  const crownBottom = rim - 2;
  for (let y = top; y <= crownBottom; y++) {
    for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
      const dx = (x - cx) / half, dy = (y - (crownBottom + 0.5)) / (crownBottom - top + 0.5);
      if (dx * dx + dy * dy > 1) continue;
      const lit = dx * 0.7 + dy * 0.7;
      s.dot(x, y, "team", lit < -0.55 ? 0 : lit < 0 ? 1 : 2);
    }
  }
  // Skirt rows: [from, to] relative to the centre. Wide at first, then only the back flares down.
  const spans = [[-7, 6.5], [-7.5, 6.5], [-8, 3], [-8, -1], [-7.5, -3.5]];
  spans.forEach(([from, to], i) => {
    for (let x = Math.round(cx + from * k); x <= Math.round(cx + to * k); x++) s.dot(x, crownBottom + 1 + i, "team", i === 0 ? 2 : 3);
  });
}

/**
 * A standing soldier in a 3/4 view: legs that step between frames, a pack, a jacket with
 * suspenders and a belt of pouches, a face, and the helmet drawn by the given function.
 */
export function soldier(frame, { helmet = m1Helmet, pack = true, boots = "leather", belt = true, arms = true } = {}) {
  const s = sprite();
  const [left, right] = frame ? [8, 18] : [10, 16];
  for (const lx of [left, right]) {
    s.rect(lx, 22, lx + 4, 28, "team", 2);
    s.rect(lx - 1, 28, lx + 4, 31, boots, 2);
  }
  if (pack) s.rect(5, 14, 10, 23, "team", 3);
  s.rect(9, 15, 21, 24, "team", 1, true);
  if (belt) {
    s.line(11, 15, 11, 20, "leather", 1).line(19, 15, 19, 20, "leather", 1);
    s.fill(10, 21, 20, 22, "leather", 2);
    for (let x = 10; x <= 19; x += 3) s.fill(x, 21, x + 1, 21, "leather", 0);
  }
  s.oval(15.5, 12.5, 4.6, 3.2, "skin", 1);
  s.dot(18, 12, "metal", 4).dot(19, 12, "metal", 4).dot(17, 14, "skin", 3);
  helmet(s);
  if (arms) s.rect(7, 15, 10, 22, "team", 2).rect(20, 15, 23, 21, "team", 2);
  return s;
}

/** Hands holding a long arm at the waist, drawn over the weapon. */
export function hands(at = [[10, 23], [21, 22.5]]) {
  const h = sprite();
  for (const [x, y] of at) h.oval(x, y, 1.5, 1.3, "skin", 1);
  return finish(h);
}

/** The M1 Garand: deep wooden stock, receiver with the clip on top, handguard, gas cylinder, sight. */
export function garand(dy = 3) {
  const r = sprite();
  r.rect(0, 18 + dy, 0, 22 + dy, "metal", 1);
  r.rect(1, 18 + dy, 8, 21 + dy, "wood", 0, true);
  r.rect(1, 22 + dy, 4, 22 + dy, "wood", 1);
  r.rect(9, 18 + dy, 11, 20 + dy, "wood", 0);
  r.rect(12, 17 + dy, 17, 20 + dy, "metal", 1, true);
  r.rect(13, 16 + dy, 16, 16 + dy, "metal", 0);
  r.rect(18, 17 + dy, 24, 18 + dy, "wood", 0);
  r.rect(18, 19 + dy, 26, 20 + dy, "wood", 1);
  r.rect(25, 17 + dy, 31, 18 + dy, "metal", 0);
  r.rect(27, 19 + dy, 31, 19 + dy, "metal", 2);
  r.rect(30, 15 + dy, 30, 16 + dy, "metal", 1);
  return finish(r, false);
}

/** The M1 carbine: short and light, slim stock, curved magazine under the receiver. */
export function carbine(dy = 3) {
  const r = sprite();
  r.rect(3, 18 + dy, 3, 21 + dy, "metal", 1);
  r.rect(4, 18 + dy, 9, 20 + dy, "wood", 0, true);
  r.rect(10, 18 + dy, 12, 19 + dy, "wood", 0);
  r.rect(13, 17 + dy, 17, 19 + dy, "metal", 1);
  r.poly([[14, 20 + dy], [17, 20 + dy], [16, 24 + dy], [14, 23 + dy]], "metal", 2);
  r.rect(18, 17 + dy, 22, 19 + dy, "wood", 0);
  r.rect(23, 17 + dy, 27, 17 + dy, "metal", 0);
  r.rect(26, 16 + dy, 26, 16 + dy, "metal", 1);
  return finish(r, false);
}

/** The Kar98k: long dark stock, bolt handle sticking out, a shorter handguard, long barrel. */
export function kar98k(dy = 3) {
  const r = sprite();
  r.rect(0, 18 + dy, 0, 21 + dy, "metal", 2);
  r.rect(1, 18 + dy, 9, 21 + dy, "darkwood", 0, true);
  r.rect(10, 18 + dy, 12, 20 + dy, "darkwood", 0);
  r.rect(13, 17 + dy, 18, 19 + dy, "metal", 2);
  r.line(16, 20 + dy, 17, 22 + dy, "metal", 0);
  r.rect(19, 17 + dy, 25, 19 + dy, "darkwood", 1);
  r.rect(26, 17 + dy, 31, 18 + dy, "metal", 1);
  r.rect(30, 16 + dy, 30, 16 + dy, "metal", 1);
  return finish(r, false);
}

/** A card suit painted white on the side of a helmet: the 101st Airborne's regimental marks. */
export const SUITS = {
  spade: ["..S..", ".SSS.", "SSSSS", "SSSSS", "..S.."],
  heart: [".S.S.", "SSSSS", "SSSSS", ".SSS.", "..S.."],
  diamond: ["..S..", ".SSS.", "SSSSS", ".SSS.", "..S.."],
  club: ["..S..", ".SSS.", "SSSSS", "..S..", ".SSS."],
};
