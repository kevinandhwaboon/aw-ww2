// Japanese (IJA) land units at 32x32 in a top-down 3/4 view, two idle frames each, facing right
// (08-art-pipeline §17). No insignia on land units: the Type 90 helmet with its neck flaps, the
// Arisaka's long bayonet, puttees, riveted hulls, bellcrank suspension and the Chi-Ha's handrail
// antenna tell them apart. Japan fielded no heavy tank, so that row stays empty (01-units §1).
import { arches, finish, grille, hands, overlay, sprite, track, wheel, wheelsInWells } from "./kit32.mjs";

const frames = (draw) => [draw(0), draw(1)];

/**
 * The Type 90 helmet: a low, round dome with a narrow rim, worn over a cloth cap whose neck flaps
 * hang down behind (on the left, since units face right).
 */
export function type90(s, cx = 15.5, top = 3, rim = 10, half = 6.6) {
  s.shape();
  // Neck flaps first, so the dome sits over them.
  const k = half / 6.6;
  for (let y = rim - 1; y <= rim + 4; y++) {
    for (let x = Math.round(cx - half - 1); x <= Math.round(cx - half * 0.2); x++) {
      if (y > rim + 1 && x > cx - half * 0.55) continue;
      s.dot(x, y, "canvas", y === rim - 1 ? 1 : 2);
    }
  }
  s.shape();
  for (let y = top; y <= rim; y++) {
    for (let x = Math.floor(cx - half - 1); x <= Math.ceil(cx + half + 1); x++) {
      const dx = (x - cx) / half, dy = (y - (rim + 0.5)) / (rim - top + 0.5);
      if (dx * dx + dy * dy > 1) continue;
      const lit = dx * 0.7 + dy * 0.7;
      s.dot(x, y, "team", y === rim ? 3 : lit < -0.55 ? 0 : lit < 0 ? 1 : 2);
    }
  }
  // The rim sticks out a pixel at the front.
  s.dot(Math.round(cx + half + 1 * k), rim, "team", 3);
}

/**
 * A standing IJA soldier: puttees wound round the shins, short boots, a small pack with a
 * blanket roll, a belt with two front pouches, and the Type 90 helmet.
 */
function soldier(frame, { arms = true, pack = true } = {}) {
  const s = sprite();
  const [left, right] = frame ? [8, 18] : [10, 16];
  for (const lx of [left, right]) {
    s.rect(lx, 22, lx + 4, 28, "team", 2);
    for (let y = 24; y <= 28; y += 2) s.line(lx, y, lx + 4, y - 1, "team", 3);
    s.rect(lx - 1, 29, lx + 4, 31, "leather", 2);
  }
  if (pack) {
    s.rect(5, 15, 10, 22, "team", 3);
    s.rect(4, 13, 10, 15, "canvas", 1);
  }
  s.rect(9, 15, 21, 24, "team", 1, true);
  s.fill(10, 21, 20, 22, "leather", 2);
  s.fill(13, 19, 15, 20, "leather", 1).fill(17, 19, 19, 20, "leather", 1);
  s.oval(15.5, 12.5, 4.6, 3.2, "skin", 1);
  s.dot(18, 12, "metal", 4).dot(19, 12, "metal", 4).dot(17, 14, "skin", 3);
  type90(s);
  if (arms) s.rect(7, 15, 10, 22, "team", 2).rect(20, 15, 23, 21, "team", 2);
  return s;
}

/** The Type 99 Arisaka held at port arms, angled up, with the long Type 30 bayonet fixed. */
function arisaka() {
  const r = sprite();
  r.bar(3, 28, 13, 21, 3, "wood", 1);
  r.bar(13, 20, 17, 17, 2, "metal", 2);
  r.bar(17, 17, 24, 11, 2, "wood", 0);
  r.bar(24, 11, 27, 8, 1, "metal", 1);
  r.bar(27, 8, 31, 4, 1, "metal", 0);
  r.dot(15, 21, "metal", 0);
  return finish(r, false);
}

function rifleman(frame) {
  return overlay(finish(soldier(frame)), arisaka(), hands([[12, 22], [20, 17]]));
}

function rocketTeam(frame) {
  // The Type 4 70mm launcher: a slim tube on a bipod, fired from a crouch.
  const s = soldier(frame, { arms: false });
  s.rect(20, 15, 23, 18, "team", 2);
  const body = finish(s);
  const t = sprite();
  t.rect(1, 11, 31, 14, "metal", 2, true);
  t.fill(1, 11, 31, 11, "metal", 1);
  t.rect(0, 10, 2, 15, "metal", 3);
  t.rect(14, 15, 15, 18, "darkwood", 0);
  t.line(26, 15, 23, 22, "metal", 2).line(27, 15, 29, 22, "metal", 2);
  return overlay(body, finish(t, false), hands([[15, 18], [21, 15]]));
}

function mortar(frame) {
  // The Type 97 81mm: baseplate, a straight steep tube and its bipod.
  const m = sprite();
  m.rect(14, 28, 24, 30, "metal", 2);
  m.line(22, 18, 27, 29, "metal", 1).line(22, 18, 24, 29, "metal", 2);
  m.bar(16, 27, 25, 5, 3, "metal", 1);
  const tube = finish(m, false);
  const s = sprite();
  if (frame === 0) {
    s.rect(1, 22, 12, 29, "team", 2);
    s.rect(0, 28, 6, 31, "leather", 2);
    s.rect(2, 13, 12, 23, "team", 1, true);
    s.oval(7, 10.5, 4, 3, "skin", 1);
    s.dot(9, 10, "metal", 4);
    type90(s, 7, 3, 8, 5);
    s.rect(10, 15, 16, 18, "team", 2);
    s.oval(17, 17, 1.6, 1.4, "skin", 1);
  } else {
    s.rect(1, 22, 13, 30, "team", 2);
    s.rect(0, 28, 6, 31, "leather", 2);
    s.rect(2, 17, 13, 24, "team", 1, true);
    type90(s, 8, 10, 16, 5.5);
    s.oval(4, 16, 1.6, 1.4, "skin", 1).oval(12, 16, 1.6, 1.4, "skin", 1);
  }
  return overlay(tube, finish(s));
}

function rikuo(frame) {
  // The Type 97 motorcycle with its sidecar and a Type 11 light machine gun.
  const s = sprite();
  const dip = frame;
  const wheels = [[6, 27, 4], [24, 27, 4]];
  s.poly([[3, 18 + dip], [24, 18 + dip], [29, 21 + dip], [28, 27 + dip], [3, 27 + dip]], "team", 2);
  arches(s, wheels);
  s.rect(14, 13 + dip, 23, 18 + dip, "team", 1);
  s.oval(18, 11 + dip, 2.6, 2, "skin", 1);
  type90(s, 18, 5 + dip, 9 + dip, 3.4);
  s.rect(21, 13 + dip, 31, 13 + dip, "metal", 2);
  s.rect(25, 11 + dip, 27, 12 + dip, "metal", 1);
  s.rect(2, 11 + dip, 10, 17 + dip, "team", 1, true);
  s.oval(7, 9 + dip, 2.6, 2, "skin", 1);
  type90(s, 7, 3 + dip, 7 + dip, 3.4);
  s.line(10, 12 + dip, 14, 11 + dip, "metal", 1);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function hoHa(frame) {
  // Type 1 Ho-Ha: a tall, slab-sided armored halftrack with an open top and a rear door.
  const s = sprite();
  const dip = frame;
  track(s, frame, { left: 1, right: 19, wheels: [5, 10, 15] });
  const wheels = [[26, 26.5, 4]];
  s.poly([[1, 15 + dip], [22, 15 + dip], [30, 18 + dip], [31, 25 + dip], [21, 25 + dip], [21, 23 + dip], [1, 23 + dip]], "team", 3);
  arches(s, wheels);
  for (let x = 3; x < 22; x += 4) s.dot(x, 17 + dip, "team", 1);
  s.rect(1, 9 + dip, 22, 15 + dip, "team", 1, true);
  s.fill(3, 11 + dip, 20, 13 + dip, "team", 4);
  s.poly([[22, 10 + dip], [26, 11 + dip], [30, 16 + dip], [22, 16 + dip]], "team", 1);
  s.rect(18, 6 + dip, 19, 10 + dip, "metal", 2);
  s.rect(19, 7 + dip, 27, 7 + dip, "metal", 2);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

/** Bellcrank suspension: road wheels in pairs, each pair on a crank, with return rollers above. */
function bellcrank(s, frame, { left, right, pairs, top = 23 }) {
  s.rect(left, top, right, 30, "rubber", 3);
  for (let x = left + 1 + frame; x < right; x += 3) s.dot(x, top + 1, "rubber", 0);
  for (const cx of pairs) {
    s.rect(cx - 3, 25, cx + 3, 26, "metal", 3);
    s.oval(cx - 2.5, 28, 2.1, 2.1, "metal", 1);
    s.oval(cx + 2.5, 28, 2.1, 2.1, "metal", 1);
    s.dot(cx - 2 + frame, 28, "metal", 3).dot(cx + 3 - frame, 28, "metal", 3);
  }
}

function haGo(frame) {
  // Type 95 Ha-Go: small and tall, a big exhaust muffler on the hull side, a little turret set to
  // the left with the 37mm and a machine gun firing out of its back.
  const s = sprite();
  const dip = frame;
  bellcrank(s, frame, { left: 3, right: 28, pairs: [10, 21] });
  s.rect(3, 17 + dip, 28, 23 + dip, "team", 3);
  for (let x = 5; x < 28; x += 4) s.dot(x, 19 + dip, "team", 1);
  s.rect(3, 11 + dip, 28, 16 + dip, "team", 1, true);
  grille(s, 4, 8, 12 + dip, 15 + dip);
  s.rect(5, 16 + dip, 12, 18 + dip, "metal", 2);
  s.poly([[19, 9 + dip], [24, 9 + dip], [28, 14 + dip], [19, 14 + dip]], "team", 2);
  s.rect(10, 5 + dip, 18, 12 + dip, "team", 1, true).shadow();
  s.oval(13, 7 + dip, 1.6, 1.2, "team", 3);
  s.rect(18, 8 + dip, 27, 9 + dip, "metal", 2);
  s.rect(7, 9 + dip, 10, 9 + dip, "metal", 2);
  return finish(s);
}

function chiHa(frame) {
  // Type 97 Shinhoto Chi-Ha: riveted hull, six road wheels on bellcranks, the turret with the long
  // 47mm and the curved handrail antenna round its top.
  const s = sprite();
  const dip = frame;
  bellcrank(s, frame, { left: 1, right: 30, pairs: [7, 15.5, 24], top: 22 });
  s.rect(1, 16 + dip, 30, 22 + dip, "team", 3);
  for (let x = 3; x < 30; x += 3) s.dot(x, 17 + dip, "team", 1);
  s.rect(1, 9 + dip, 30, 15 + dip, "team", 1, true);
  grille(s, 2, 7, 10 + dip, 14 + dip);
  s.poly([[22, 8 + dip], [27, 8 + dip], [31, 13 + dip], [22, 13 + dip]], "team", 2);
  s.rect(9, 4 + dip, 20, 12 + dip, "team", 1, true).shadow();
  s.oval(12, 6 + dip, 1.8, 1.4, "team", 3);
  s.rect(20, 7 + dip, 31, 8 + dip, "metal", 2);
  s.rect(20, 6 + dip, 22, 9 + dip, "team", 2);
  // The handrail antenna: a hoop over the turret roof.
  s.shape();
  s.line(8, 4 + dip, 9, 2 + dip, "metal", 1).line(9, 2 + dip, 20, 2 + dip, "metal", 1).line(20, 2 + dip, 21, 4 + dip, "metal", 1);
  return finish(s);
}

function hoNi(frame) {
  // Type 1 Ho-Ni I: the Chi-Ha chassis with an open three-sided gun shield and a 75mm field gun.
  const s = sprite();
  const dip = frame;
  bellcrank(s, frame, { left: 1, right: 30, pairs: [7, 15.5, 24], top: 22 });
  s.rect(1, 16 + dip, 30, 22 + dip, "team", 3);
  for (let x = 3; x < 30; x += 3) s.dot(x, 17 + dip, "team", 1);
  s.rect(1, 11 + dip, 30, 15 + dip, "team", 1, true);
  grille(s, 2, 7, 12 + dip, 14 + dip);
  s.poly([[9, 6 + dip], [20, 6 + dip], [23, 10 + dip], [23, 15 + dip], [9, 15 + dip]], "team", 1).shadow();
  s.fill(11, 8 + dip, 19, 10 + dip, "team", 4);
  s.oval(14, 9 + dip, 1.8, 1.6, "skin", 1);
  s.rect(21, 10 + dip, 31, 11 + dip, "metal", 2);
  s.rect(28, 9 + dip, 31, 12 + dip, "metal", 1);
  return finish(s);
}

function type91(frame) {
  // Type 91 10cm howitzer: split trail, a low shield, spoked wheels.
  const s = sprite();
  s.poly([[13, 21], [16, 21], [4, 30], [0, 30]], "team", 2);
  s.poly([[14, 22], [17, 22], [10, 31], [6, 31]], "team", 3);
  s.rect(15, 12, 19, 23, "team", 2, true);
  const recoil = frame ? -1 : 0;
  s.rect(9 + recoil, 14, 18 + recoil, 18, "team", 3);
  s.bar(14 + recoil, 15, 28 + recoil, 6, 3, "team", 1);
  s.shadow();
  s.oval(17, 25, 5, 5, "darkwood", 0);
  for (const [dx, dy] of [[-3, 0], [3, 0], [0, -3], [0, 3]]) s.line(17, 25, 17 + dx, 25 + dy, "wood", 0);
  s.oval(17, 25, 1.4, 1.4, "metal", 1);
  return finish(s);
}

function type4Rocket(frame) {
  // Type 4 20cm rocket launcher: a big, fat rocket in an open trough on a low A-frame.
  const s = sprite();
  const lift = frame ? -1 : 0;
  s.line(7, 30, 12, 21, "metal", 2).line(22, 30, 19, 18, "metal", 2);
  s.rect(4, 29, 26, 30, "metal", 3);
  s.bar(2, 25 + lift, 27, 13 + lift, 3, "metal", 3);
  s.bar(5, 19 + lift, 25, 10 + lift, 6, "team", 1);
  s.shadow();
  s.poly([[24, 9 + lift], [30, 8 + lift], [27, 15 + lift]], "team", 2);
  s.poly([[2, 18 + lift], [6, 18 + lift], [7, 25 + lift], [3, 26 + lift]], "metal", 2);
  return finish(s);
}

function type98Truck(frame) {
  // A Type 94 truck with a single Type 98 20mm AA gun on the bed. The gun swings between frames.
  const s = sprite();
  const dip = frame;
  const wheels = [[7, 26.5, 4], [25, 26.5, 4]];
  s.rect(1, 18 + dip, 31, 23 + dip, "team", 3);
  arches(s, wheels);
  s.rect(1, 14 + dip, 19, 18 + dip, "darkwood", 0, true);
  for (let x = 4; x < 19; x += 4) s.line(x, 14 + dip, x, 18 + dip, "darkwood", 2);
  s.rect(20, 10 + dip, 31, 18 + dip, "team", 1, true);
  s.fill(22, 11 + dip, 28, 12 + dip, "glass", 0);
  s.rect(6, 9 + dip, 13, 15 + dip, "team", 2, true).shadow();
  if (frame) s.bar(10, 10, 3, 1, 2, "metal", 2);
  else s.bar(12, 10, 24, 1, 2, "metal", 2);
  s.oval(9, 12 + dip, 1.6, 1.4, "metal", 3);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function type88(frame) {
  // Type 88 75mm AA gun: a pedestal on five outrigger legs, the long barrel steeply raised.
  const s = sprite();
  s.rect(1, 27, 30, 29, "metal", 2);
  s.line(15, 26, 6, 31, "metal", 3).line(16, 26, 25, 31, "metal", 3);
  s.rect(12, 18, 19, 27, "metal", 2, true);
  s.rect(8, 15, 22, 21, "team", 2, true);
  const lift = frame ? -1 : 0;
  s.bar(9, 19 + lift, 30, 3 + lift, 3, "team", 1);
  s.shadow();
  s.rect(6, 17 + lift, 11, 21 + lift, "team", 3);
  wheel(s, 23, 24, 2.5, 0);
  return finish(s);
}

export const units = [
  { code: "IN", name: "Infantry", real: "Rifleman with Type 99 Arisaka and bayonet", frames: frames(rifleman) },
  { code: "AI", name: "Assault Infantry", real: "Type 4 70mm rocket launcher team", frames: frames(rocketTeam) },
  { code: "MO", name: "Mortar Team", real: "Type 97 81mm mortar", frames: frames(mortar) },
  { code: "RC", name: "Recon", real: "Type 97 motorcycle and sidecar", frames: frames(rikuo) },
  { code: "HT", name: "Halftrack", real: "Type 1 Ho-Ha", frames: frames(hoHa) },
  { code: "LT", name: "Light Tank", real: "Type 95 Ha-Go", frames: frames(haGo) },
  { code: "MT", name: "Medium Tank", real: "Type 97 Shinhoto Chi-Ha", frames: frames(chiHa) },
  { code: "TD", name: "Tank Destroyer", real: "Type 1 Ho-Ni I", frames: frames(hoNi) },
  { code: "AR", name: "Artillery", real: "Type 91 10cm howitzer", frames: frames(type91) },
  { code: "RK", name: "Rocket Artillery", real: "Type 4 20cm rocket launcher", frames: frames(type4Rocket) },
  { code: "AA", name: "Mobile AA", real: "Type 98 20mm on a Type 94 truck", frames: frames(type98Truck) },
  { code: "FK", name: "Flak Gun", real: "Type 88 75mm AA gun", frames: frames(type88) },
];

for (const u of units) for (const f of u.frames) {
  if (f.length !== 32 || f.some((r) => r.length !== 32)) throw new Error(`${u.code}: not 32x32`);
}
