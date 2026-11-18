// Italian (Regio Esercito) land units at 32x32 in a top-down 3/4 view, two idle frames each, facing
// right (08-art-pipeline §17). No national insignia on vehicles, as for Germany (§12): Italian armour
// carried little more than unit numbers. What tells them apart: the deep round M33 helmet, the Carcano
// with its folding bayonet, puttees, the long Solothurn anti-tank rifle, the M13/40's riveted box and
// leaf-sprung bogies of four little wheels, the L6/40's small turret, the Semovente's squat casemate,
// the 75/27's wooden spoked wheels and the long 90/53.
import { arches, carcano, finish, grille, hands, m33Helmet, overlay, sprite, wheel, wheelsInWells } from "./kit32.mjs";

const frames = (draw) => [draw(0), draw(1)];

/**
 * A standing Italian soldier: grey-green wool, puttees wound up the calves over ankle boots, the
 * leather M1907 webbing with its two ammunition pouches on the belt, a small pack, and the M33 helmet.
 */
function fante(frame, { arms = true } = {}) {
  const s = sprite();
  const [left, right] = frame ? [8, 18] : [10, 16];
  for (const lx of [left, right]) {
    s.rect(lx, 22, lx + 4, 25, "team", 2);
    // Puttees: wound bands from the knee to the boot.
    s.rect(lx, 25, lx + 4, 28, "team", 3);
    for (let y = 25; y <= 28; y += 2) s.fill(lx, y, lx + 4, y, "team", 4);
    s.rect(lx - 1, 29, lx + 4, 31, "leather", 2);
  }
  s.rect(5, 14, 10, 21, "canvas", 3);
  s.rect(9, 15, 21, 24, "team", 1, true);
  s.line(12, 15, 12, 20, "leather", 1).line(19, 15, 19, 20, "leather", 1);
  s.fill(10, 21, 20, 22, "leather", 2);
  // The two leather cartridge pouches on the belt.
  s.fill(11, 20, 13, 22, "leather", 1).fill(17, 20, 19, 22, "leather", 1);
  s.oval(15.5, 12.5, 4.6, 3.2, "skin", 1);
  s.dot(18, 12, "metal", 4).dot(19, 12, "metal", 4).dot(17, 14, "skin", 3);
  m33Helmet(s);
  if (arms) s.rect(7, 15, 10, 22, "team", 2).rect(20, 15, 23, 21, "team", 2);
  return s;
}

function rifleman(frame) {
  return overlay(finish(fante(frame)), carcano(), hands());
}

function solothurn(frame) {
  // The Solothurn S-18/1000 anti-tank rifle on the shoulder: a long barrel with a big box muzzle
  // brake, the magazine sticking out of the left side, a padded butt and a folded bipod.
  const s = fante(frame, { arms: false });
  s.rect(20, 15, 23, 18, "team", 2);
  const body = finish(s);
  const t = sprite();
  t.rect(0, 11, 2, 16, "leather", 2);
  t.rect(3, 12, 9, 15, "metal", 2, true);
  t.rect(10, 11, 16, 14, "metal", 1, true);
  t.rect(11, 7, 14, 10, "metal", 3);
  t.rect(13, 15, 14, 18, "darkwood", 0);
  t.rect(17, 12, 28, 13, "metal", 1);
  t.rect(27, 10, 31, 15, "metal", 2);
  t.line(22, 14, 26, 15, "metal", 2);
  return overlay(body, finish(t, false), hands([[14, 18], [21, 15]]));
}

function mortar(frame) {
  // The 81mm Mod. 35 mortar: a square baseplate, the long tube and its bipod, the crew in M33s.
  const m = sprite();
  m.rect(14, 28, 25, 30, "metal", 2);
  m.line(22, 18, 27, 29, "metal", 1).line(22, 18, 24, 29, "metal", 2);
  m.bar(16, 27, 26, 4, 3, "metal", 1);
  const tube = finish(m, false);
  const s = sprite();
  if (frame === 0) {
    s.rect(1, 22, 12, 29, "team", 2);
    s.rect(0, 28, 6, 31, "leather", 3);
    s.rect(2, 13, 12, 23, "team", 1, true);
    s.oval(7, 10.5, 4, 3, "skin", 1);
    s.dot(9, 10, "metal", 4);
    m33Helmet(s, 7, 3, 8, 4.4);
    s.rect(10, 15, 16, 18, "team", 2);
    s.oval(17, 17, 1.6, 1.4, "skin", 1);
  } else {
    s.rect(1, 22, 13, 30, "team", 2);
    s.rect(0, 28, 6, 31, "leather", 3);
    s.rect(2, 17, 13, 24, "team", 1, true);
    m33Helmet(s, 8, 12, 17, 4.6);
    s.oval(3, 16, 1.6, 1.4, "skin", 1).oval(13, 16, 1.6, 1.4, "skin", 1);
  }
  return overlay(tube, finish(s));
}

function ab41(frame) {
  // The AB 41 armoured car: four big wheels far apart, an angular hull with sloped plates front and
  // back, the rear driving position's vision slit, and the L6/40's little turret with a 20mm Breda.
  const s = sprite();
  const dip = frame;
  const wheels = [[7, 26.5, 4], [24, 26.5, 4]];
  s.poly([[1, 20 + dip], [4, 17 + dip], [28, 17 + dip], [31, 20 + dip], [31, 24 + dip], [1, 24 + dip]], "team", 3);
  arches(s, wheels);
  s.poly([[2, 17 + dip], [5, 12 + dip], [26, 12 + dip], [30, 17 + dip]], "team", 1);
  s.fill(25, 14 + dip, 27, 14 + dip, "ink", 0).fill(4, 14 + dip, 5, 14 + dip, "ink", 0);
  for (let x = 6; x < 26; x += 4) s.dot(x, 13 + dip, "team", 3);
  s.poly([[10, 12 + dip], [11, 7 + dip], [20, 7 + dip], [22, 12 + dip]], "team", 2).shadow();
  s.oval(14, 9 + dip, 1.5, 1.1, "metal", 1);
  s.rect(21, 9 + dip, 31, 9 + dip, "metal", 2);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function spaTruck(frame) {
  // A SPA Dovunque 35 lorry, the army's workhorse for troops and fuel: a snub bonnet, an open cab and
  // a canvas tilt over the bed on its ribs. It stands in for the Halftrack.
  const s = sprite();
  const dip = frame;
  const wheels = [[7, 26.5, 3.5], [16, 26.5, 3.5], [26, 26.5, 3.5]];
  s.rect(1, 20 + dip, 31, 24 + dip, "team", 3);
  arches(s, wheels);
  s.rect(1, 9 + dip, 19, 20 + dip, "canvas", 2, true);
  for (let x = 4; x < 19; x += 5) s.line(x, 9 + dip, x, 20 + dip, "canvas", 3);
  s.fill(1, 9 + dip, 19, 9 + dip, "canvas", 1);
  s.rect(20, 12 + dip, 25, 20 + dip, "team", 1, true);
  s.fill(21, 13 + dip, 24, 15 + dip, "glass", 0);
  s.rect(26, 15 + dip, 31, 20 + dip, "team", 2, true);
  grille(s, 30, 31, 16 + dip, 19 + dip);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

/** Leaf-sprung bogies: four little road wheels on each, a big drive sprocket at the front. */
function bogies(s, frame, { left = 1, right = 30, top = 23, sets = [9, 20] } = {}) {
  s.rect(left, top, right, 30, "rubber", 3);
  for (let x = left + 1 + frame; x < right; x += 3) s.dot(x, top + 1, "rubber", 0);
  s.oval(right - 2, top + 2.5, 2.2, 2.2, "metal", 2);
  s.oval(left + 2, top + 2.5, 2, 2, "metal", 2);
  for (const cx of sets) {
    s.rect(cx - 5, top + 2, cx + 5, top + 3, "metal", 3);
    for (let i = 0; i < 4; i++) {
      const wx = cx - 4 + i * 2.7;
      s.oval(wx, 28.2, 1.4, 1.4, "metal", 1);
      s.dot(Math.round(wx) + (frame ? 1 : 0), 28, "metal", 3);
    }
  }
}

/** Rivet heads in a row: little lit dots on a plate. */
function rivets(s, x0, x1, y, step = 3) {
  for (let x = x0; x <= x1; x += step) s.dot(x, y, "team", 0);
}

function l640(frame) {
  // L6/40 light tank: a small, short hull on two bogies, a little six-sided turret set off to the
  // left with its long thin 20mm Breda.
  const s = sprite();
  const dip = frame;
  bogies(s, frame, { left: 3, right: 28, top: 23, sets: [10, 20] });
  s.rect(3, 17 + dip, 28, 22 + dip, "team", 3);
  rivets(s, 5, 26, 18 + dip);
  s.poly([[3, 12 + dip], [24, 12 + dip], [29, 16 + dip], [29, 17 + dip], [3, 17 + dip]], "team", 1);
  grille(s, 4, 9, 13 + dip, 16 + dip);
  s.poly([[9, 12 + dip], [10, 7 + dip], [18, 7 + dip], [20, 12 + dip]], "team", 2).shadow();
  s.oval(13, 9 + dip, 1.5, 1.1, "metal", 1);
  s.rect(19, 9 + dip, 31, 9 + dip, "metal", 2);
  return finish(s);
}

function m1340(frame) {
  // M13/40 medium tank: a tall riveted box on two leaf-sprung bogies a side, a twin machine gun in the
  // sloped bow plate, and the riveted turret with the short 47/32 gun and a coaxial MG.
  const s = sprite();
  const dip = frame;
  bogies(s, frame);
  s.rect(1, 17 + dip, 30, 22 + dip, "team", 3);
  rivets(s, 3, 28, 18 + dip);
  s.poly([[1, 10 + dip], [25, 10 + dip], [30, 14 + dip], [30, 17 + dip], [1, 17 + dip]], "team", 1);
  rivets(s, 3, 23, 11 + dip, 4);
  grille(s, 2, 7, 12 + dip, 16 + dip);
  // The twin hull MGs in the bow.
  s.rect(26, 13 + dip, 31, 13 + dip, "metal", 2).rect(26, 15 + dip, 31, 15 + dip, "metal", 2);
  s.poly([[8, 10 + dip], [9, 4 + dip], [20, 4 + dip], [22, 10 + dip]], "team", 1).shadow();
  rivets(s, 10, 19, 6 + dip, 3);
  s.oval(12, 6 + dip, 1.6, 1.2, "metal", 1);
  s.rect(21, 6 + dip, 28, 7 + dip, "metal", 2);
  s.rect(21, 8 + dip, 24, 8 + dip, "metal", 3);
  return finish(s);
}

function semovente(frame) {
  // Semovente 75/18: the M13 chassis with a low, wide riveted casemate in place of the turret, and the
  // stubby 75mm howitzer poking out of its front plate.
  const s = sprite();
  const dip = frame;
  bogies(s, frame);
  s.rect(1, 17 + dip, 30, 22 + dip, "team", 3);
  rivets(s, 3, 28, 18 + dip);
  s.poly([[1, 12 + dip], [27, 12 + dip], [30, 15 + dip], [30, 17 + dip], [1, 17 + dip]], "team", 1);
  grille(s, 2, 6, 13 + dip, 16 + dip);
  s.poly([[7, 12 + dip], [8, 7 + dip], [22, 7 + dip], [26, 12 + dip]], "team", 1).shadow();
  rivets(s, 9, 21, 8 + dip, 3);
  s.oval(11, 9 + dip, 1.5, 1.1, "metal", 1);
  s.rect(23, 9 + dip, 30, 11 + dip, "metal", 2);
  s.rect(28, 8 + dip, 30, 12 + dip, "metal", 1);
  return finish(s);
}

function cannone7527(frame) {
  // The 75/27 Mod. 1911 field gun: big wooden spoked wheels, a tall shield, a single box trail and a
  // short barrel over its recoil cylinder.
  const s = sprite();
  s.poly([[13, 21], [16, 22], [2, 30], [0, 29]], "team", 2);
  s.poly([[14, 11], [16, 10], [20, 11], [20, 22], [14, 22]], "team", 2);
  const recoil = frame ? -1 : 0;
  s.rect(8 + recoil, 15, 17 + recoil, 18, "team", 3);
  s.bar(13 + recoil, 15, 27 + recoil, 10, 3, "team", 1);
  s.shadow();
  s.oval(17, 25, 5.5, 5.5, "darkwood", 0);
  for (let a = 0; a < Math.PI; a += Math.PI / 5) s.line(17 - Math.cos(a) * 5, 25 - Math.sin(a) * 5, 17 + Math.cos(a) * 5, 25 + Math.sin(a) * 5, "wood", 0);
  s.oval(17, 25, 1.4, 1.4, "metal", 1);
  return finish(s);
}

function autocannone(frame) {
  // An autocannone: a Breda 20/65 anti-aircraft gun on the flat bed of a SPA lorry, the gunner's seat
  // on the mount. The gun swings between frames.
  const s = sprite();
  const dip = frame;
  const wheels = [[7, 26.5, 4], [25, 26.5, 4]];
  s.rect(1, 18 + dip, 31, 23 + dip, "team", 3);
  arches(s, wheels);
  s.rect(1, 15 + dip, 19, 18 + dip, "darkwood", 0, true);
  for (let x = 4; x < 19; x += 4) s.line(x, 15 + dip, x, 18 + dip, "darkwood", 2);
  s.rect(20, 11 + dip, 25, 18 + dip, "team", 1, true);
  s.fill(21, 12 + dip, 24, 13 + dip, "glass", 0);
  s.rect(26, 14 + dip, 31, 18 + dip, "team", 2, true);
  s.rect(7, 10 + dip, 13, 15 + dip, "team", 2, true).shadow();
  if (frame) s.bar(10, 11, 2, 2, 2, "metal", 2);
  else s.bar(12, 11, 25, 1, 2, "metal", 2);
  s.oval(9, 13 + dip, 1.6, 1.4, "metal", 3);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function cannone9053(frame) {
  // The 90/53: a heavy anti-aircraft gun on a cross-shaped platform with its outriggers down, the
  // very long barrel raised steeply, the breech and recuperators behind it.
  const s = sprite();
  s.rect(0, 27, 31, 29, "metal", 2);
  s.line(15, 26, 4, 31, "metal", 3).line(16, 26, 27, 31, "metal", 3);
  s.rect(12, 19, 19, 27, "metal", 2, true);
  s.rect(9, 16, 21, 21, "team", 2, true);
  const lift = frame ? -1 : 0;
  s.bar(10, 19 + lift, 31, 1 + lift, 3, "team", 1);
  s.shadow();
  s.rect(5, 17 + lift, 11, 22 + lift, "team", 3);
  s.rect(13, 14 + lift, 17, 16 + lift, "team", 3);
  wheel(s, 6, 25, 2.5, 0);
  wheel(s, 25, 25, 2.5, 0);
  return finish(s);
}

export const units = [
  { code: "IN", name: "Infantry", real: "Fante with an M33 helmet and a Carcano M91/38", frames: frames(rifleman) },
  { code: "AI", name: "Assault Infantry", real: "Guastatori with a Solothurn S-18/1000 anti-tank rifle", frames: frames(solothurn) },
  { code: "MO", name: "Mortar Team", real: "81mm Mod. 35 mortar", frames: frames(mortar) },
  { code: "RC", name: "Recon", real: "AB 41 armoured car", frames: frames(ab41) },
  { code: "HT", name: "Halftrack", real: "SPA Dovunque 35 lorry", frames: frames(spaTruck) },
  { code: "LT", name: "Light Tank", real: "L6/40", frames: frames(l640) },
  { code: "MT", name: "Medium Tank", real: "M13/40", frames: frames(m1340) },
  { code: "TD", name: "Tank Destroyer", real: "Semovente 75/18", frames: frames(semovente) },
  { code: "AR", name: "Artillery", real: "75/27 Mod. 1911 field gun", frames: frames(cannone7527) },
  { code: "AA", name: "Mobile AA", real: "Breda 20/65 on a SPA lorry (autocannone)", frames: frames(autocannone) },
  { code: "FK", name: "Flak Gun", real: "90/53 anti-aircraft gun", frames: frames(cannone9053) },
];

for (const u of units) for (const f of u.frames) {
  if (f.length !== 32 || f.some((r) => r.length !== 32)) throw new Error(`${u.code}: not 32x32`);
}
