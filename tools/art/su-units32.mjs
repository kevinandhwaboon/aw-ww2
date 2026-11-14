// Soviet (Red Army) land units at 32x32 in a top-down 3/4 view, two idle frames each, facing right
// (08-art-pipeline §17). Vehicles carry a small red star on the turret or cab, as many did; no hammer
// and sickle anywhere (§12). The SSh-40 helmet, the greatcoat roll worn across the chest, the Mosin
// with its spike bayonet, the T-34's big Christie road wheels and the Katyusha's rails tell them apart.
import { arches, finish, grille, hands, overlay, redStar, sprite, track, wheel, wheelsInWells } from "./kit32.mjs";

const frames = (draw) => [draw(0), draw(1)];

/**
 * The SSh-40 helmet: a tall, round dome with a short rim that flares out a little all round, worn
 * low over the ears.
 */
export function ssh40(s, cx = 15.5, top = 2, rim = 10, half = 6.8) {
  s.shape();
  for (let y = top; y < rim; y++) {
    for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
      const dx = (x - cx) / half, dy = (y - rim) / (rim - top);
      if (dx * dx + dy * dy > 1) continue;
      const lit = dx * 0.7 + dy * 0.7;
      s.dot(x, y, "team", lit < -0.55 ? 0 : lit < 0 ? 1 : 2);
    }
  }
  // The flared rim, a pixel wider than the dome on each side.
  for (let x = Math.round(cx - half - 1); x <= Math.round(cx + half + 1); x++) s.dot(x, rim, "team", 3);
}

/**
 * A standing Red Army soldier: tall boots, a gymnastyorka tunic with a belt, a small sack instead
 * of a pack, the rolled greatcoat slung from one shoulder across the chest, and the SSh-40.
 */
function soldier(frame, { arms = true, roll = true } = {}) {
  const s = sprite();
  const [left, right] = frame ? [8, 18] : [10, 16];
  for (const lx of [left, right]) {
    s.rect(lx, 22, lx + 4, 25, "team", 2);
    s.rect(lx - 1, 26, lx + 4, 31, "leather", 2);
  }
  s.rect(6, 16, 10, 21, "canvas", 2);
  s.rect(9, 15, 21, 24, "team", 1, true);
  s.fill(10, 21, 20, 22, "leather", 2);
  s.dot(15, 21, "metal", 1);
  if (roll) {
    // The skatka: the greatcoat rolled into a thick ring over the left shoulder.
    s.shape();
    for (let i = 0; i <= 10; i++) {
      const x = 9 + i * 1.1, y = 15 + i * 0.75;
      s.dot(x, y, "canvas", 2).dot(x, y + 1, "canvas", 3).dot(x + 1, y, "canvas", 1);
    }
  }
  s.oval(15.5, 12.5, 4.6, 3.2, "skin", 1);
  s.dot(18, 12, "metal", 4).dot(19, 12, "metal", 4).dot(17, 14, "skin", 3);
  ssh40(s);
  if (arms) s.rect(7, 15, 10, 22, "team", 2).rect(20, 15, 23, 21, "team", 2);
  return s;
}

/** The Mosin-Nagant 91/30 at port arms, angled up, with its long spike bayonet fixed. */
function mosin() {
  const r = sprite();
  r.bar(3, 28, 12, 21, 3, "wood", 1);
  r.bar(12, 20, 16, 17, 2, "metal", 2);
  r.line(14, 21, 15, 23, "metal", 0);
  r.bar(16, 17, 24, 11, 2, "wood", 0);
  r.bar(24, 11, 27, 8, 1, "metal", 1);
  r.line(27, 8, 31, 4, "metal", 0);
  return finish(r, false);
}

function rifleman(frame) {
  return overlay(finish(soldier(frame)), mosin(), hands([[12, 22], [20, 17]]));
}

function ptrd(frame) {
  // The PTRD-41 anti-tank rifle: a very long barrel with a box muzzle brake, a padded butt and a
  // bipod, carried on the shoulder.
  const s = soldier(frame, { arms: false, roll: false });
  s.rect(20, 15, 23, 18, "team", 2);
  const body = finish(s);
  const t = sprite();
  t.rect(2, 12, 9, 15, "wood", 1, true);
  t.rect(0, 11, 2, 16, "leather", 2);
  t.rect(10, 12, 16, 14, "metal", 2);
  t.rect(13, 15, 14, 18, "darkwood", 0);
  t.rect(17, 12, 29, 13, "metal", 1);
  t.rect(28, 11, 31, 14, "metal", 2);
  t.line(21, 14, 19, 22, "metal", 2).line(22, 14, 25, 22, "metal", 2);
  return overlay(body, finish(t, false), hands([[14, 18], [21, 15]]));
}

function mortar(frame) {
  // The 82-PM-41: a round baseplate, a straight tube and its bipod.
  const m = sprite();
  m.oval(19, 29, 5.5, 1.6, "metal", 2);
  m.line(22, 18, 27, 29, "metal", 1).line(22, 18, 24, 29, "metal", 2);
  m.bar(16, 27, 25, 5, 3, "metal", 1);
  const tube = finish(m, false);
  const s = sprite();
  if (frame === 0) {
    s.rect(1, 22, 12, 26, "team", 2);
    s.rect(0, 26, 6, 31, "leather", 2);
    s.rect(2, 13, 12, 23, "team", 1, true);
    s.oval(7, 10.5, 4, 3, "skin", 1);
    s.dot(9, 10, "metal", 4);
    ssh40(s, 7, 2, 8, 5);
    s.rect(10, 15, 16, 18, "team", 2);
    s.oval(17, 17, 1.6, 1.4, "skin", 1);
  } else {
    s.rect(1, 22, 13, 27, "team", 2);
    s.rect(0, 26, 6, 31, "leather", 2);
    s.rect(2, 17, 13, 24, "team", 1, true);
    ssh40(s, 8, 9, 16, 5.5);
    s.oval(4, 16, 1.6, 1.4, "skin", 1).oval(12, 16, 1.6, 1.4, "skin", 1);
  }
  return overlay(tube, finish(s));
}

function ba64(frame) {
  // BA-64: a small four-wheeled armored car, all sloped plates, with an open-topped little turret
  // and a DT machine gun.
  const s = sprite();
  const dip = frame;
  const wheels = [[8, 26.5, 4], [23, 26.5, 4]];
  s.poly([[3, 18 + dip], [27, 18 + dip], [31, 22 + dip], [30, 25 + dip], [2, 25 + dip]], "team", 3);
  arches(s, wheels);
  s.poly([[4, 18 + dip], [8, 11 + dip], [22, 11 + dip], [29, 18 + dip]], "team", 1);
  s.fill(21, 13 + dip, 23, 14 + dip, "ink", 0);
  s.poly([[10, 11 + dip], [12, 6 + dip], [19, 6 + dip], [21, 11 + dip]], "team", 2).shadow();
  s.fill(12, 6 + dip, 19, 6 + dip, "team", 4);
  s.rect(19, 8 + dip, 27, 8 + dip, "metal", 2);
  redStar(s, 11, 13 + dip);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function zis42(frame) {
  // ZiS-42: the ZiS-5 truck on a half-track, with its rounded bonnet, open cab and a wooden bed.
  const s = sprite();
  const dip = frame;
  track(s, frame, { left: 1, right: 17, wheels: [4, 9, 14] });
  const wheels = [[25, 26.5, 4]];
  s.rect(1, 18 + dip, 31, 22 + dip, "team", 3);
  arches(s, wheels);
  s.rect(1, 11 + dip, 18, 18 + dip, "darkwood", 0, true);
  for (let x = 4; x < 18; x += 4) s.line(x, 11 + dip, x, 18 + dip, "darkwood", 2);
  s.rect(18, 9 + dip, 23, 18 + dip, "team", 1, true);
  s.fill(19, 10 + dip, 22, 12 + dip, "glass", 0);
  s.poly([[23, 13 + dip], [28, 13 + dip], [31, 16 + dip], [31, 18 + dip], [23, 18 + dip]], "team", 1);
  grille(s, 29, 30, 15 + dip, 17 + dip);
  redStar(s, 8, 12 + dip);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

/** Christie suspension: five big road wheels with no return rollers, and the track sagging over them. */
function christie(s, frame, { left = 0, right = 31 } = {}) {
  s.rect(left, 22, right, 31, "rubber", 3);
  for (let x = left + 1 + frame; x < right; x += 3) s.dot(x, 23, "rubber", 0);
  const step = (right - left - 6) / 4;
  for (let i = 0; i < 5; i++) {
    const cx = left + 3 + i * step;
    s.oval(cx, 27, 3.3, 3.3, "metal", 1);
    s.oval(cx, 27, 1.2, 1.2, "metal", 3);
    s.dot(cx + (frame ? 1 : -1), 25, "rubber", 2);
  }
}

function t70(frame) {
  // T-70: small and low, a steep glacis, a one-man turret set to the left with the 45mm.
  const s = sprite();
  const dip = frame;
  track(s, frame, { left: 3, right: 28, wheels: [7, 12, 17, 22], r: 2.4 });
  s.rect(3, 18 + dip, 28, 23 + dip, "team", 3);
  s.poly([[3, 12 + dip], [22, 12 + dip], [29, 18 + dip], [3, 18 + dip]], "team", 1);
  grille(s, 4, 8, 13 + dip, 16 + dip);
  s.poly([[9, 7 + dip], [18, 7 + dip], [20, 12 + dip], [8, 12 + dip]], "team", 1).shadow();
  s.oval(12, 8 + dip, 1.5, 1, "team", 3);
  s.rect(20, 9 + dip, 29, 9 + dip, "metal", 2);
  redStar(s, 10, 13 + dip);
  return finish(s);
}

function t34(frame) {
  // T-34/76 (1943): sloped hull sides and glacis, the five Christie wheels, the hexagonal turret
  // with its two round roof hatches, the 76mm, and spare fuel tanks on the hull side.
  const s = sprite();
  const dip = frame;
  christie(s, frame);
  s.poly([[0, 16 + dip], [26, 16 + dip], [31, 21 + dip], [31, 23 + dip], [0, 23 + dip]], "team", 3);
  s.rect(3, 17 + dip, 7, 20 + dip, "team", 2);
  s.rect(9, 17 + dip, 13, 20 + dip, "team", 2);
  s.poly([[0, 9 + dip], [22, 9 + dip], [30, 16 + dip], [0, 16 + dip]], "team", 1);
  grille(s, 1, 6, 10 + dip, 15 + dip);
  // Hexagonal turret, a little forward of centre.
  s.poly([[10, 3 + dip], [20, 3 + dip], [23, 7 + dip], [21, 13 + dip], [9, 13 + dip], [8, 7 + dip]], "team", 1).shadow();
  s.oval(13, 5 + dip, 1.6, 1.2, "team", 3).oval(17, 5 + dip, 1.6, 1.2, "team", 3);
  s.rect(22, 7 + dip, 31, 8 + dip, "metal", 2);
  s.rect(21, 6 + dip, 23, 9 + dip, "team", 2);
  redStar(s, 11, 8 + dip);
  return finish(s);
}

function kv1(frame) {
  // KV-1: a big slab-sided box on six small road wheels with return rollers, a huge turret and the
  // 76mm, filling the tile.
  const s = sprite();
  const dip = frame;
  track(s, frame, { left: 0, right: 31, top: 22, wheels: [3, 8, 13, 18, 23, 28], r: 2.2 });
  for (const rx of [6, 15, 24]) s.oval(rx, 23, 1, 1, "metal", 2);
  s.rect(0, 16 + dip, 31, 22 + dip, "team", 3);
  for (let x = 2; x < 31; x += 5) s.dot(x, 17 + dip, "team", 1);
  s.rect(0, 7 + dip, 31, 15 + dip, "team", 1, true);
  grille(s, 1, 6, 9 + dip, 14 + dip);
  s.rect(26, 9 + dip, 30, 11 + dip, "team", 2);
  s.poly([[7, 2 + dip], [21, 2 + dip], [23, 5 + dip], [23, 13 + dip], [6, 13 + dip], [6, 5 + dip]], "team", 1).shadow();
  s.oval(10, 4 + dip, 2, 1.5, "team", 3);
  s.rect(23, 6 + dip, 31, 8 + dip, "metal", 2);
  s.rect(22, 5 + dip, 24, 9 + dip, "team", 2);
  redStar(s, 12, 7 + dip);
  return finish(s);
}

function su152(frame) {
  // SU-152: the KV chassis with a tall armored box at the front and the short, thick 152mm
  // howitzer coming out of a big round mantlet. New at Kursk.
  const s = sprite();
  const dip = frame;
  track(s, frame, { left: 0, right: 31, top: 22, wheels: [3, 8, 13, 18, 23, 28], r: 2.2 });
  s.rect(0, 16 + dip, 31, 22 + dip, "team", 3);
  for (let x = 2; x < 31; x += 5) s.dot(x, 17 + dip, "team", 1);
  s.rect(0, 11 + dip, 31, 15 + dip, "team", 1, true);
  grille(s, 1, 6, 12 + dip, 14 + dip);
  s.poly([[9, 3 + dip], [24, 3 + dip], [27, 8 + dip], [27, 15 + dip], [9, 15 + dip]], "team", 1).shadow();
  s.oval(13, 5 + dip, 1.8, 1.3, "team", 3);
  s.oval(26, 10 + dip, 3, 3, "team", 2).shadow();
  s.rect(28, 8 + dip, 31, 11 + dip, "metal", 2);
  redStar(s, 15, 8 + dip);
  return finish(s);
}

function m30(frame) {
  // 122mm M-30 howitzer: a split trail, a wide shield with a wavy top edge, a fairly long barrel
  // over its recoil cylinders, and spoked wheels.
  const s = sprite();
  s.poly([[13, 21], [16, 21], [3, 30], [0, 30]], "team", 2);
  s.poly([[14, 22], [17, 22], [10, 31], [6, 31]], "team", 3);
  s.poly([[14, 12], [19, 10], [20, 24], [14, 24]], "team", 2);
  const recoil = frame ? -1 : 0;
  s.rect(7 + recoil, 15, 18 + recoil, 18, "team", 3);
  s.bar(14 + recoil, 15, 29 + recoil, 7, 3, "team", 1);
  s.shadow();
  s.oval(17, 25, 5, 5, "rubber", 3);
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) s.line(17, 25, 17 + dx, 25 + dy, "metal", 2);
  s.oval(17, 25, 1.4, 1.4, "metal", 1);
  return finish(s);
}

function katyusha(frame) {
  // BM-13 Katyusha on a ZiS-6 truck: a long frame of launch rails over the bed, raised toward the
  // front over the cab, rockets slung under them.
  const s = sprite();
  const dip = frame;
  const wheels = [[6, 26.5, 3.6], [13, 26.5, 3.6], [25, 26.5, 3.6]];
  s.rect(1, 19 + dip, 31, 23 + dip, "team", 3);
  arches(s, wheels);
  s.rect(21, 11 + dip, 26, 19 + dip, "team", 1, true);
  s.fill(22, 12 + dip, 25, 14 + dip, "glass", 0);
  s.poly([[26, 15 + dip], [30, 15 + dip], [31, 19 + dip], [26, 19 + dip]], "team", 1);
  redStar(s, 22, 15 + dip);
  // The rails: eight bars stacked, tilted up toward the front. They lift a pixel between frames.
  const lift = frame ? -1 : 0;
  s.shape();
  for (let i = 0; i < 4; i++) s.line(1, 16 - i * 1.5 + dip, 24, 9 - i * 1.5 + lift + dip, "metal", i % 2 ? 2 : 1);
  s.shape();
  for (let x = 4; x <= 20; x += 4) s.dot(x, 17 - (x / 24) * 7 + dip, "team", 3);
  s.rect(3, 15 + dip, 6, 19 + dip, "metal", 3);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function gazQuad(frame) {
  // A GAZ-AA truck with the quad Maxim mount on its bed: four water-jacketed guns side by side.
  // The mount swings between frames.
  const s = sprite();
  const dip = frame;
  const wheels = [[7, 26.5, 3.8], [25, 26.5, 3.8]];
  s.rect(1, 19 + dip, 31, 23 + dip, "team", 3);
  arches(s, wheels);
  s.rect(1, 15 + dip, 18, 19 + dip, "darkwood", 0, true);
  for (let x = 4; x < 18; x += 4) s.line(x, 15 + dip, x, 19 + dip, "darkwood", 2);
  s.rect(19, 11 + dip, 25, 19 + dip, "team", 1, true);
  s.fill(20, 12 + dip, 24, 14 + dip, "glass", 0);
  s.poly([[25, 15 + dip], [29, 15 + dip], [31, 18 + dip], [31, 19 + dip], [25, 19 + dip]], "team", 1);
  redStar(s, 20, 15 + dip);
  s.rect(7, 10 + dip, 12, 16 + dip, "metal", 3, true).shadow();
  const guns = frame ? [[8, 11], [1, 5]] : [[11, 11], [22, 5]];
  for (let i = 0; i < 4; i++) {
    const off = i * 1.5;
    s.bar(guns[0][0], guns[0][1] + off + dip, guns[1][0], guns[1][1] + off + dip, 1, "team", 1);
  }
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function k52(frame) {
  // 52-K 85mm AA gun: a cross-shaped platform on four outriggers, the mount and a long barrel with
  // a muzzle brake, steeply raised.
  const s = sprite();
  s.rect(1, 27, 30, 29, "metal", 2);
  s.line(15, 26, 5, 31, "metal", 3).line(16, 26, 26, 31, "metal", 3);
  s.rect(12, 19, 19, 27, "metal", 2, true);
  s.rect(8, 15, 22, 21, "team", 2, true);
  const lift = frame ? -1 : 0;
  s.bar(10, 18 + lift, 29, 3 + lift, 3, "team", 1);
  s.shadow();
  s.rect(27, 2 + lift, 31, 5 + lift, "metal", 2);
  s.rect(5, 16 + lift, 10, 20 + lift, "team", 3);
  wheel(s, 23, 25, 2.5, 0);
  return finish(s);
}

export const units = [
  { code: "IN", name: "Infantry", real: "Rifleman with Mosin-Nagant 91/30 and bayonet", frames: frames(rifleman) },
  { code: "AI", name: "Assault Infantry", real: "PTRD-41 anti-tank rifle team", frames: frames(ptrd) },
  { code: "MO", name: "Mortar Team", real: "82-PM-41 mortar", frames: frames(mortar) },
  { code: "RC", name: "Recon", real: "BA-64 armored car", frames: frames(ba64) },
  { code: "HT", name: "Halftrack", real: "ZiS-42 half-track truck", frames: frames(zis42) },
  { code: "LT", name: "Light Tank", real: "T-70", frames: frames(t70) },
  { code: "MT", name: "Medium Tank", real: "T-34/76 (1943)", frames: frames(t34) },
  { code: "HV", name: "Heavy Tank", real: "KV-1", frames: frames(kv1) },
  { code: "TD", name: "Tank Destroyer", real: "SU-152", frames: frames(su152) },
  { code: "AR", name: "Artillery", real: "122mm M-30 howitzer", frames: frames(m30) },
  { code: "RK", name: "Rocket Artillery", real: "BM-13 Katyusha on a ZiS-6", frames: frames(katyusha) },
  { code: "AA", name: "Mobile AA", real: "Quad Maxim on a GAZ-AA", frames: frames(gazQuad) },
  { code: "FK", name: "Flak Gun", real: "52-K 85mm AA gun", frames: frames(k52) },
];

for (const u of units) for (const f of u.frames) {
  if (f.length !== 32 || f.some((r) => r.length !== 32)) throw new Error(`${u.code}: not 32x32`);
}
