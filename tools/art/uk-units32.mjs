// United Kingdom (British Army) land units at 32x32 in a top-down 3/4 view, two idle frames each,
// facing right (08-art-pipeline §17). Canada borrows these. Vehicles carry the RAF roundel where US
// vehicles carry the star; it's the only marking (§12). The Brodie helmet's wide flat brim, the
// Lee-Enfield with its spike bayonet, the '37 pattern webbing's big chest pouches, the PIAT, the
// Churchill's tracks running up over its hull sides and the Firefly's long 17-pounder tell them apart.
// Plus the 1st Airborne: a Denison smock and a Sten, under the airborne helmet or the red beret.
import {
  arches, brodie, finish, grille, hands, leeEnfield, overlay, paraHelmet, redBeret, roundel, roundelMark, sprite, sten, track, wheel,
  wheelsInWells,
} from "./kit32.mjs";
import { stuart } from "./us-units32.mjs";

const frames = (draw) => [draw(0), draw(1)];

/**
 * A standing British soldier: battledress, short web anklets over the boots, the '37 pattern
 * webbing with its two big basic pouches on the chest and a small pack high on the back, and the
 * headgear drawn by the given function. `smock` paints the Denison smock's brushstroke camouflage.
 */
function tommy(frame, { head = brodie, arms = true, smock = false } = {}) {
  const s = sprite();
  const [left, right] = frame ? [8, 18] : [10, 16];
  for (const lx of [left, right]) {
    s.rect(lx, 22, lx + 4, 27, "team", 2);
    s.rect(lx, 27, lx + 4, 28, "canvas", 1);
    s.rect(lx - 1, 29, lx + 4, 31, "leather", 3);
  }
  s.rect(5, 13, 10, 19, "canvas", 2, true);
  s.rect(9, 15, 21, 24, "team", 1, true);
  if (smock) for (const [x, y] of [[10, 17], [13, 22], [16, 16], [19, 20], [11, 20], [17, 23]]) s.fill(x, y, x + 1, y, "canvas", 3).dot(x + 2, y + 1, "team", 3);
  s.line(12, 15, 12, 20, "canvas", 1).line(19, 15, 19, 20, "canvas", 1);
  s.fill(10, 21, 20, 22, "canvas", 2);
  // The two basic pouches on the chest.
  s.rect(17, 16, 20, 19, "canvas", 1);
  s.rect(13, 16, 15, 19, "canvas", 1);
  s.oval(15.5, 12.5, 4.6, 3.2, "skin", 1);
  s.dot(18, 12, "metal", 4).dot(19, 12, "metal", 4).dot(17, 14, "skin", 3);
  head(s);
  if (arms) s.rect(7, 15, 10, 22, "team", 2).rect(20, 15, 23, 21, "team", 2);
  return s;
}

function rifleman(frame) {
  return overlay(finish(tommy(frame)), leeEnfield(), hands());
}

/** The 1st Airborne: a Denison smock and a Sten, under the airborne helmet or the red beret. */
function paratrooper(head) {
  return (frame) => overlay(finish(tommy(frame, { head, smock: true })), sten(), hands([[12, 22.5], [21, 22]]));
}

function piat(frame) {
  // The PIAT on the shoulder: a fat steel body with a padded butt at the back, the open trough at
  // the front with the big round-nosed bomb in it, and the monopod hanging down.
  const s = tommy(frame, { arms: false });
  s.rect(20, 15, 23, 18, "team", 2);
  const body = finish(s);
  const t = sprite();
  t.rect(0, 10, 3, 15, "leather", 1);
  t.rect(3, 10, 19, 15, "metal", 2, true);
  t.fill(3, 10, 19, 10, "metal", 1);
  t.rect(14, 16, 15, 18, "darkwood", 0);
  t.rect(20, 11, 24, 14, "metal", 3);
  t.oval(27, 12.5, 3.5, 2.6, "team", 2);
  t.dot(30, 12, "team", 0);
  t.line(22, 15, 25, 24, "metal", 2);
  return overlay(body, finish(t, false), hands([[15, 18], [21, 15]]));
}

function mortar(frame) {
  // The 3-inch mortar: a square baseplate, the tube and its bipod, steep.
  const m = sprite();
  m.rect(13, 28, 25, 30, "metal", 2);
  m.line(22, 18, 27, 29, "metal", 1).line(22, 18, 24, 29, "metal", 2);
  m.bar(16, 27, 25, 5, 3, "metal", 1);
  const tube = finish(m, false);
  const s = sprite();
  if (frame === 0) {
    s.rect(1, 22, 12, 29, "team", 2);
    s.rect(0, 28, 6, 31, "leather", 3);
    s.rect(2, 13, 12, 23, "team", 1, true);
    s.rect(8, 15, 10, 18, "canvas", 1);
    s.oval(7, 10.5, 4, 3, "skin", 1);
    s.dot(9, 10, "metal", 4);
    brodie(s, 7, 4, 8, 4);
    s.rect(10, 15, 16, 18, "team", 2);
    s.oval(17, 17, 1.6, 1.4, "skin", 1);
  } else {
    s.rect(1, 22, 13, 30, "team", 2);
    s.rect(0, 28, 6, 31, "leather", 3);
    s.rect(2, 17, 13, 24, "team", 1, true);
    brodie(s, 8, 13, 17, 4.5);
    s.oval(3, 16, 1.6, 1.4, "skin", 1).oval(13, 16, 1.6, 1.4, "skin", 1);
  }
  return overlay(tube, finish(s));
}

function daimler(frame) {
  // The Daimler armoured car: four big wheels evenly spaced, a low hull sloping down at both ends,
  // and a small round-fronted turret with the 2-pounder.
  const s = sprite();
  const dip = frame;
  const wheels = [[8, 26.5, 4], [22, 26.5, 4]];
  s.poly([[1, 19 + dip], [5, 16 + dip], [27, 16 + dip], [31, 19 + dip], [31, 24 + dip], [1, 24 + dip]], "team", 3);
  arches(s, wheels);
  s.poly([[2, 16 + dip], [6, 11 + dip], [25, 11 + dip], [30, 16 + dip]], "team", 1);
  s.fill(25, 13 + dip, 27, 14 + dip, "ink", 0);
  roundel(s, 15, 19 + dip);
  s.rect(9, 6 + dip, 20, 12 + dip, "team", 1, true).shadow();
  s.oval(12, 8 + dip, 1.6, 1.2, "metal", 1);
  s.rect(20, 8 + dip, 30, 9 + dip, "metal", 2);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function carrier(frame) {
  // The Universal Carrier: a small, very low open box on tracks, a Horstmann bogie of two wheels and
  // a single wheel each side, the driver and the gunner in their Brodies, the Bren poking out front.
  const s = sprite();
  const dip = frame;
  track(s, frame, { left: 2, right: 29, top: 24, wheels: [8, 13, 22], r: 2.8 });
  s.rect(2, 19 + dip, 29, 24 + dip, "team", 3);
  roundel(s, 8, 21 + dip);
  s.poly([[2, 15 + dip], [24, 15 + dip], [30, 19 + dip], [2, 19 + dip]], "team", 1);
  s.fill(5, 16 + dip, 21, 18 + dip, "team", 4);
  // Two crew, heads and helmets over the side.
  for (const hx of [11, 18]) {
    s.oval(hx, 14 + dip, 2.4, 1.8, "skin", 1);
    brodie(s, hx, 9 + dip, 12 + dip, 2.8);
  }
  s.rect(23, 15 + dip, 31, 16 + dip, "metal", 2);
  s.rect(24, 12 + dip, 26, 14 + dip, "metal", 3);
  return finish(s);
}

function firefly(frame) {
  // Sherman Firefly: the Sherman hull, the turret with the radio box welded to its back, and the
  // long 17-pounder with its muzzle brake reaching past the nose.
  const s = sprite();
  const dip = frame;
  track(s, frame);
  s.rect(1, 18 + dip, 30, 23 + dip, "team", 3);
  roundel(s, 15, 20 + dip);
  s.rect(1, 8 + dip, 30, 17 + dip, "team", 1, true);
  grille(s, 3, 8, 10 + dip, 15 + dip);
  s.rect(25, 9 + dip, 30, 17 + dip, "team", 2);
  s.rect(3, 8 + dip, 7, 12 + dip, "team", 2, true).shadow();
  s.oval(12, 10 + dip, 7, 5.5, "team", 1, true).shadow();
  s.oval(10, 8 + dip, 2, 1.5, "metal", 1);
  s.rect(17, 9 + dip, 20, 12 + dip, "team", 2);
  s.rect(20, 10 + dip, 31, 11 + dip, "team", 1).shadow();
  s.rect(28, 9 + dip, 30, 12 + dip, "team", 2);
  return finish(s);
}

function churchill(frame) {
  // Churchill: a long box with the tracks running up over the hull sides, eleven little road wheels
  // under the panniers, a square escape door in the pannier, and a slab-sided turret with its 75.
  const s = sprite();
  const dip = frame;
  s.poly([[0, 16], [3, 13], [29, 13], [31, 15], [31, 28], [29, 30], [2, 30], [0, 27]], "rubber", 3);
  for (let x = 2 + frame; x < 30; x += 3) s.dot(x, 14, "rubber", 0);
  for (let i = 0; i < 9; i++) {
    s.oval(3.5 + i * 3.1, 28, 1.5, 1.4, "metal", 1);
    s.dot(3.5 + i * 3.1 + (frame ? 1 : 0), 28, "metal", 3);
  }
  s.rect(3, 16 + dip, 28, 25 + dip, "team", 2, true);
  s.rect(12, 18 + dip, 16, 23 + dip, "team", 3);
  s.dot(15, 20 + dip, "metal", 0);
  roundel(s, 22, 20 + dip);
  s.rect(2, 9 + dip, 29, 13 + dip, "team", 1, true);
  grille(s, 3, 8, 10 + dip, 12 + dip);
  s.rect(10, 3 + dip, 20, 10 + dip, "team", 1, true).shadow();
  s.oval(13, 5 + dip, 1.8, 1.3, "metal", 1);
  s.rect(20, 5 + dip, 23, 8 + dip, "team", 2);
  s.rect(23, 6 + dip, 30, 7 + dip, "team", 1).shadow();
  return finish(s);
}

function achilles(frame) {
  // Achilles: the M10's hull and open turret, the long 17-pounder and its muzzle brake.
  const s = sprite();
  const dip = frame;
  track(s, frame);
  s.poly([[1, 18 + dip], [30, 18 + dip], [29, 23 + dip], [2, 23 + dip]], "team", 3);
  roundel(s, 13, 20 + dip);
  s.rect(1, 10 + dip, 30, 17 + dip, "team", 1, true);
  grille(s, 3, 7, 12 + dip, 16 + dip);
  s.poly([[5, 5 + dip], [16, 5 + dip], [18, 9 + dip], [16, 14 + dip], [5, 14 + dip], [3, 9 + dip]], "team", 1).shadow();
  s.fill(7, 7 + dip, 14, 12 + dip, "team", 4);
  s.oval(9, 9 + dip, 2, 1.5, "team", 3);
  s.rect(1, 8 + dip, 3, 11 + dip, "team", 2);
  s.rect(18, 8 + dip, 31, 9 + dip, "team", 1).shadow();
  s.rect(28, 7 + dip, 31, 10 + dip, "team", 2);
  return finish(s);
}

function twentyFivePounder(frame) {
  // The 25-pounder: the round firing platform under its wheels, a single box trail, a small shield
  // with a curved top, and the short barrel with its muzzle brake.
  const s = sprite();
  s.oval(17, 29.5, 9, 1.8, "metal", 2);
  s.poly([[14, 21], [17, 22], [3, 30], [0, 29]], "team", 2);
  s.oval(1.5, 29, 1.5, 1.2, "metal", 3);
  s.poly([[15, 12], [17, 11], [19, 12], [19, 23], [15, 23]], "team", 2);
  const recoil = frame ? -1 : 0;
  s.rect(9 + recoil, 15, 18 + recoil, 18, "team", 3);
  s.bar(14 + recoil, 15, 27 + recoil, 9, 3, "team", 1);
  s.shadow();
  s.rect(26 + recoil, 7, 29 + recoil, 12, "team", 2);
  wheel(s, 17, 24, 5, 0);
  return finish(s);
}

function landMattress(frame) {
  // The Land Mattress: thirty-two tubes in a box frame on a light two-wheeled carriage, raised
  // toward the front. The frame lifts a pixel between frames.
  const s = sprite();
  s.line(16, 24, 2, 30, "team", 2).line(16, 25, 3, 31, "team", 3);
  const lift = frame ? -1 : 0;
  s.poly([[3, 17 + lift], [27, 6 + lift], [29, 12 + lift], [5, 23 + lift]], "metal", 2);
  for (let i = 1; i < 4; i++) s.line(3 + i * 0.5, 17 + i * 1.5 + lift, 27 + i * 0.5, 6 + i * 1.5 + lift, "metal", 4);
  for (let x = 6; x <= 26; x += 4) s.line(x, 18 - (x - 3) * 0.46 + lift, x + 1, 23 - (x - 3) * 0.46 + lift, "metal", 3);
  s.shadow();
  for (let i = 0; i < 4; i++) s.dot(28, 7 + i * 1.5 + lift, "metal", 4);
  s.rect(13, 18, 19, 22, "team", 2);
  wheel(s, 16, 25, 4.5, frame);
  return finish(s);
}

function crusaderAA(frame) {
  // Crusader AA Mk II: the long, low Crusader hull on five big Christie road wheels, an open-topped
  // turret with twin 20mm Oerlikons, which swing between frames.
  const s = sprite();
  const dip = frame;
  s.rect(0, 22, 31, 30, "rubber", 3);
  for (let x = 1 + frame; x < 31; x += 3) s.dot(x, 23, "rubber", 0);
  for (let i = 0; i < 5; i++) {
    s.oval(3.5 + i * 6, 26.5, 3, 3, "metal", 1);
    s.dot(3.5 + i * 6 + (frame ? 1 : -1), 26, "metal", 3);
  }
  s.rect(0, 17 + dip, 31, 22 + dip, "team", 3);
  roundel(s, 23, 19 + dip);
  s.poly([[0, 10 + dip], [27, 10 + dip], [31, 14 + dip], [31, 17 + dip], [0, 17 + dip]], "team", 1);
  grille(s, 1, 7, 11 + dip, 15 + dip);
  s.poly([[9, 5 + dip], [20, 5 + dip], [22, 8 + dip], [20, 12 + dip], [9, 12 + dip], [7, 8 + dip]], "team", 1).shadow();
  s.fill(11, 7 + dip, 18, 10 + dip, "team", 4);
  const guns = frame ? [[10, 7], [2, 1]] : [[19, 7], [29, 0]];
  for (let i = 0; i < 2; i++) s.bar(guns[0][0], guns[0][1] + i * 2 + dip, guns[1][0], guns[1][1] + i * 2 + dip, 1, "metal", 2);
  return finish(s);
}

function bofors(frame) {
  // The Bofors 40mm: a four-wheeled carriage with its outriggers down, the mount and the gun raised,
  // the cone flash hider at the muzzle and a clip of rounds standing up out of the breech.
  const s = sprite();
  s.rect(1, 26, 30, 28, "metal", 2);
  s.line(8, 27, 2, 31, "metal", 3).line(23, 27, 29, 31, "metal", 3);
  wheel(s, 6, 25, 3, 0);
  wheel(s, 25, 25, 3, 0);
  s.rect(10, 19, 21, 26, "team", 2, true);
  const lift = frame ? -1 : 0;
  s.bar(11, 18 + lift, 26, 5 + lift, 2, "team", 1);
  s.shadow();
  s.poly([[25, 4 + lift], [29, 1 + lift], [31, 4 + lift], [27, 7 + lift]], "metal", 2);
  s.rect(11, 13 + lift, 14, 17 + lift, "metal", 1);
  s.fill(11, 13 + lift, 14, 13 + lift, "wood", 1);
  s.rect(7, 18, 10, 21, "team", 3);
  return finish(s);
}

export const units = [
  { code: "IN", name: "Infantry", real: "Tommy with a Lee-Enfield No. 4", frames: frames(rifleman) },
  { code: "AI", name: "Assault Infantry", real: "PIAT team", frames: frames(piat) },
  { code: "MO", name: "Mortar Team", real: "3-inch mortar", frames: frames(mortar) },
  { code: "RC", name: "Recon", real: "Daimler armoured car", frames: frames(daimler) },
  { code: "HT", name: "Halftrack", real: "Universal Carrier", frames: frames(carrier) },
  { code: "LT", name: "Light Tank", real: "Stuart", frames: frames((f) => stuart(f, roundelMark)) },
  { code: "MT", name: "Medium Tank", real: "Sherman Firefly", frames: frames(firefly) },
  { code: "HV", name: "Heavy Tank", real: "Churchill", frames: frames(churchill) },
  { code: "TD", name: "Tank Destroyer", real: "Achilles (17-pounder M10)", frames: frames(achilles) },
  { code: "AR", name: "Artillery", real: "25-pounder", frames: frames(twentyFivePounder) },
  { code: "RK", name: "Rocket Artillery", real: "Land Mattress", frames: frames(landMattress) },
  { code: "AA", name: "Mobile AA", real: "Crusader AA Mk II", frames: frames(crusaderAA) },
  { code: "FK", name: "Flak Gun", real: "Bofors 40mm", frames: frames(bofors) },
];

/** The 1st Airborne, one row per headgear. A dropped UK Infantry unit picks one by its id. */
export const paratroopers = [
  { code: "IN-helmet", head: "helmet", name: "Paratrooper (helmet)", real: "1st Airborne, airborne helmet and Sten", frames: frames(paratrooper(paraHelmet)) },
  { code: "IN-beret", head: "beret", name: "Paratrooper (red beret)", real: "1st Airborne, red beret and Sten", frames: frames(paratrooper((s) => redBeret(s))) },
];

for (const u of [...units, ...paratroopers]) for (const f of u.frames) {
  if (f.length !== 32 || f.some((r) => r.length !== 32)) throw new Error(`${u.code}: not 32x32`);
}
