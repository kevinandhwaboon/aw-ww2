// Shared helpers for unit sprites: 16x16 pixel grids, two idle frames each, all facing right.
// K outline, L/M/D team ramp, t/r tread, W/h metal, S star, o skin, b/B wood, c glass, f foam, P prop.

export const SIZE = 16;
export const blank = ".".repeat(SIZE);

// Stacks rows so the sprite's bottom edge sits on the tile's bottom edge.
export const stack = (rows) => [...Array(SIZE - rows.length).fill(blank), ...rows];
export const pad = (rows, n) => [...Array(n - rows.length).fill(blank), ...rows];

// Draws layers on top of each other, each moved by dx, dy.
export function compose(...layers) {
  const out = Array.from({ length: SIZE }, () => Array(SIZE).fill("."));
  for (const { grid, dx = 0, dy = 0 } of layers) {
    grid.forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch !== "." && out[y + dy]?.[x + dx] !== undefined) out[y + dy][x + dx] = ch;
    }));
  }
  return out.map((r) => r.join(""));
}

export const tankTracks = [
  [".KrtrtrtrtrtrtK.", "KtWWtWWtWWtWWttK", "KtWhtWhtWhtWhttK", ".KrtrtrtrtrtrtK.", "..KKKKKKKKKKKK.."],
  [".KtrtrtrtrtrtrK.", "KtWhtWhtWhtWhttK", "KtWWtWWtWWtWWttK", ".KtrtrtrtrtrtrK.", "..KKKKKKKKKKKK.."],
];
export const shortTracks = [
  [".KrtrtrtrtrK....", "KtWWtWWtWWtK....", "KtWhtWhtWhtK....", ".KKKKKKKKKK....."],
  [".KtrtrtrtrtK....", "KtWhtWhtWhtK....", "KtWWtWWtWWtK....", ".KKKKKKKKKK....."],
];
export const halfTracks = [
  [".KrtrtrtrtKKKKKK", "KtWWtWWttK...KK.", "KtWhtWhttK..KWWK", ".KrtrtrtrK..KWhK", "..KKKKKKK....KK."],
  [".KtrtrtrtrKKKKKK", "KtWhtWhttK...KK.", "KtWWtWWttK..KWhK", ".KtrtrtrtK..KWWK", "..KKKKKKK....KK."],
];

// A vehicle: hull rests on its running gear and bobs 1px between frames.
export function vehicle(body, gear, gap = "..KKKKKKKKKKKK..") {
  return [stack([...body, ...gear[0]]), stack([...body, gap, ...gear[1]])];
}

export const mortarTube = [
  "...........KKKK.", "...........KWhK.", "..........KWhK..", "..........KWhK..",
  ".........KWhK...", ".........KWhK...", "........KWhK....", "........KWhK....",
  ".......KWhKK....", ".......KWhK.K...", "......KWhK...K..", "......KWhK....K.",
  "....KKKKKKKK...K", "....KKKKKKKK...K",
];

export const howitzerTrail = [
  ".....KKKK.......", "....KMMMMK......", "...KMMMMDK......", "..KMMDDKK.......",
  ".KDDDKK.........", "KKKKK...........",
];
export const howitzerWheel = [
  ".........KKK....", "........KtttK...", ".......KttWttK..", ".......KtWhWtK..",
  ".......KttWttK..", "........KtttK...", ".........KKK....",
];

// Parts that sway: the moving layer lifts 1px in the second frame over a fixed base.
export function swaying(base, moving, shift = { dy: -1 }) {
  const m = stack(moving);
  const under = typeof base[0] === "string" ? [{ grid: stack(base) }] : base;
  return [compose(...under, { grid: m }), compose(...under, { grid: m, ...shift })];
}

export function validate(units) {
  const allowed = new Set([...".KLMDtrWhSobBcfP"]);
  for (const u of units) {
    for (const f of u.frames) {
      if (f.length !== SIZE) throw new Error(`${u.code}: ${f.length} rows`);
      f.forEach((r, i) => {
        if (r.length !== SIZE) throw new Error(`${u.code} row ${i}: "${r}" is ${r.length} wide`);
        for (const ch of r) if (!allowed.has(ch)) throw new Error(`${u.code}: bad "${ch}"`);
      });
    }
  }
}
