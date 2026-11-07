// German land units at 32x32 in a top-down 3/4 view, two idle frames each, facing right. No national
// insignia (08-art-pipeline §12): camouflage patches and silhouettes tell them apart.
import { arches, finish, grille, wheelsInWells, hands, interleavedTrack, kar98k, overlay, soldier, sprite, stahlhelm, track, wheel } from "./kit32.mjs";

const frames = (draw) => [draw(0), draw(1)];
const boots = "leather";

/** Patches of camouflage, painted into the current shape. */
function camo(s, spots) {
  for (const [x0, y0, x1, y1] of spots) s.fill(x0, y0, x1, y1, "team", 3);
}

function rifleman(frame) {
  return overlay(finish(soldier(frame, { helmet: stahlhelm, boots })), kar98k(), hands());
}

function panzerschreck(frame) {
  const s = soldier(frame, { helmet: stahlhelm, boots, arms: false });
  s.rect(20, 15, 23, 18, "team", 2);
  const body = finish(s);
  // A thick launcher tube on the shoulder, with the blast shield and its little window.
  const t = sprite();
  t.rect(0, 10, 31, 15, "metal", 2, true);
  t.fill(0, 10, 31, 10, "metal", 1);
  t.rect(20, 3, 24, 21, "metal", 1, true);
  t.fill(21, 6, 23, 8, "glass", 0);
  t.rect(15, 16, 16, 19, "darkwood", 0);
  return overlay(body, finish(t, false), hands([[16, 19], [26, 17]]));
}

function granatwerfer(frame) {
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
    stahlhelm(s, 7, 2, 8, 5);
    s.rect(10, 15, 16, 18, "team", 2);
    s.oval(17, 17, 1.6, 1.4, "skin", 1);
  } else {
    s.rect(1, 22, 13, 30, "team", 2);
    s.rect(0, 28, 6, 31, "leather", 2);
    s.rect(2, 17, 13, 24, "team", 1, true);
    stahlhelm(s, 8, 9, 16, 5.5);
    s.oval(4, 16, 1.6, 1.4, "skin", 1).oval(12, 16, 1.6, 1.4, "skin", 1);
  }
  return overlay(tube, finish(s));
}

function sidecar(frame) {
  const s = sprite();
  const dip = frame;
  const wheels = [[6, 27, 4], [24, 27, 4]];
  // The sidecar: a boat-shaped tub on the near side, mudguards over the wheels, a gunner and an
  // MG 34 on a pintle.
  s.poly([[2, 17 + dip], [26, 17 + dip], [30, 20 + dip], [29, 27 + dip], [2, 27 + dip]], "team", 2);
  arches(s, wheels);
  camo(s, [[6, 19 + dip, 9, 20 + dip], [16, 21 + dip, 20, 22 + dip]]);
  s.rect(14, 13 + dip, 23, 17 + dip, "team", 1);
  s.oval(18, 11 + dip, 2.6, 2, "skin", 1);
  stahlhelm(s, 18, 4 + dip, 9 + dip, 3.6);
  s.rect(21, 13 + dip, 31, 14 + dip, "metal", 2);
  // The rider behind, hands on the bars.
  s.rect(2, 11 + dip, 10, 17 + dip, "team", 1, true);
  s.oval(7, 9 + dip, 2.6, 2, "skin", 1);
  stahlhelm(s, 7, 2 + dip, 7 + dip, 3.6);
  s.line(10, 12 + dip, 14, 11 + dip, "metal", 1);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function sdkfz251(frame) {
  const s = sprite();
  const dip = frame;
  interleavedTrack(s, frame, { left: 1, right: 20 });
  const wheels = [[26, 26.5, 4]];
  // Angular armored body: sloped side plates, open troop compartment, a wedge-shaped nose.
  s.poly([[1, 16 + dip], [24, 16 + dip], [31, 18 + dip], [31, 26 + dip], [21, 26 + dip], [21, 22 + dip], [1, 22 + dip]], "team", 3);
  arches(s, wheels);
  camo(s, [[4, 18 + dip, 9, 19 + dip], [15, 19 + dip, 19, 20 + dip]]);
  s.rect(1, 9 + dip, 22, 16 + dip, "team", 1, true);
  s.fill(3, 11 + dip, 20, 14 + dip, "team", 4);
  s.poly([[22, 11 + dip], [27, 12 + dip], [31, 16 + dip], [22, 16 + dip]], "team", 1);
  // MG 34 behind its shield at the front of the compartment.
  s.rect(17, 6 + dip, 19, 11 + dip, "metal", 1, true);
  s.rect(19, 8 + dip, 28, 8 + dip, "metal", 2);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function panzerII(frame) {
  const s = sprite();
  const dip = frame;
  track(s, frame, { left: 4, right: 26, wheels: [8, 13, 18, 23] });
  s.rect(4, 18 + dip, 26, 23 + dip, "team", 3);
  camo(s, [[8, 19 + dip, 12, 20 + dip], [17, 21 + dip, 21, 22 + dip]]);
  s.rect(4, 11 + dip, 26, 17 + dip, "team", 1, true);
  grille(s, 6, 9, 13 + dip, 16 + dip);
  // Small turret set off to one side, a thin 20mm autocannon.
  s.rect(12, 6 + dip, 20, 13 + dip, "team", 1, true).shadow();
  s.oval(15, 8 + dip, 1.5, 1.2, "team", 3);
  s.rect(20, 9 + dip, 29, 9 + dip, "metal", 2);
  return finish(s);
}

function panzerIV(frame) {
  const s = sprite();
  const dip = frame;
  s.rect(1, 25, 30, 30, "rubber", 3);
  for (let cx = 3 + frame; cx < 30; cx += 4) s.oval(cx, 28, 1.6, 1.6, "metal", 1);
  // Armored skirts along the near side, with seams.
  s.rect(0, 18 + dip, 31, 25 + dip, "team", 2);
  for (let x = 5; x < 31; x += 6) s.line(x, 19 + dip, x, 25 + dip, "team", 4);
  camo(s, [[2, 21 + dip, 4, 23 + dip], [13, 20 + dip, 16, 22 + dip], [24, 22 + dip, 27, 23 + dip]]);
  s.rect(1, 8 + dip, 30, 17 + dip, "team", 1, true);
  grille(s, 2, 6, 10 + dip, 15 + dip);
  s.rect(24, 10 + dip, 27, 12 + dip, "team", 2);
  s.rect(24, 14 + dip, 27, 16 + dip, "team", 2);
  s.rect(3, 6 + dip, 7, 13 + dip, "team", 2);
  s.rect(7, 4 + dip, 21, 14 + dip, "team", 1, true).shadow();
  s.oval(10, 7 + dip, 2.2, 2, "team", 2);
  s.rect(21, 8 + dip, 31, 10 + dip, "team", 1).shadow();
  s.rect(28, 7 + dip, 31, 11 + dip, "team", 2);
  return finish(s);
}

function tiger(frame) {
  const s = sprite();
  const dip = frame;
  interleavedTrack(s, frame, { left: 0, right: 31, top: 21 });
  // A big slab-sided hull filling the tile, with a wide, flat box turret and the long 88.
  s.rect(0, 16 + dip, 31, 22 + dip, "team", 3);
  camo(s, [[3, 18 + dip, 7, 19 + dip], [14, 17 + dip, 18, 19 + dip], [24, 19 + dip, 28, 20 + dip]]);
  s.rect(0, 5 + dip, 31, 15 + dip, "team", 1, true);
  grille(s, 2, 7, 7 + dip, 13 + dip);
  s.rect(5, 2 + dip, 21, 13 + dip, "team", 1, true).shadow();
  s.oval(9, 5 + dip, 2.5, 2, "team", 2);
  s.rect(21, 6 + dip, 31, 8 + dip, "team", 1).shadow();
  s.rect(27, 5 + dip, 31, 9 + dip, "team", 2);
  return finish(s);
}

function stug(frame) {
  const s = sprite();
  const dip = frame;
  s.rect(1, 25, 30, 30, "rubber", 3);
  for (let cx = 3 + frame; cx < 30; cx += 4) s.oval(cx, 28, 1.6, 1.6, "metal", 1);
  s.rect(0, 19 + dip, 31, 25 + dip, "team", 2);
  for (let x = 5; x < 31; x += 6) s.line(x, 20 + dip, x, 25 + dip, "team", 4);
  s.rect(1, 12 + dip, 30, 18 + dip, "team", 1, true);
  grille(s, 2, 6, 13 + dip, 17 + dip);
  // No turret: a low armored box built onto the hull, the gun coming straight out of its front.
  s.poly([[6, 8 + dip], [22, 8 + dip], [25, 12 + dip], [25, 17 + dip], [6, 17 + dip]], "team", 1).shadow();
  camo(s, [[9, 11 + dip, 12, 12 + dip], [17, 13 + dip, 20, 14 + dip]]);
  s.oval(10, 10 + dip, 2, 1.5, "team", 2);
  s.rect(25, 12 + dip, 31, 14 + dip, "team", 1).shadow();
  s.rect(29, 11 + dip, 31, 15 + dip, "team", 2);
  return finish(s);
}

function leFH18(frame) {
  const s = sprite();
  s.poly([[13, 21], [16, 21], [4, 30], [0, 30]], "team", 2);
  s.poly([[14, 22], [17, 22], [10, 31], [6, 31]], "team", 3);
  // A tall, flat shield, and a short, thick barrel at a steeper angle than the American gun.
  s.rect(14, 9, 19, 24, "team", 2, true);
  const recoil = frame ? -1 : 0;
  s.rect(9 + recoil, 13, 18 + recoil, 17, "team", 3);
  s.bar(14 + recoil, 14, 26 + recoil, 3, 4, "team", 1);
  s.shadow();
  wheel(s, 17, 25, 5, 0);
  return finish(s);
}

function nebelwerfer(frame) {
  const s = sprite();
  s.poly([[14, 22], [17, 22], [4, 30], [0, 30]], "team", 2);
  wheel(s, 17, 25, 5, 0);
  // Six launch tubes in a ring, tilted up, seen from above so their mouths show.
  const lift = frame ? -1 : 0;
  s.oval(16, 13 + lift, 9, 8, "metal", 2, true).shadow();
  for (const [cx, cy] of [[13, 9], [19, 9], [22, 13], [19, 17], [13, 17], [10, 13]]) s.oval(cx, cy + lift, 2.2, 2, "metal", 4);
  s.oval(16, 13 + lift, 1.5, 1.5, "metal", 1);
  return finish(s);
}

function flakvierling(frame) {
  const s = sprite();
  const dip = frame;
  interleavedTrack(s, frame, { left: 1, right: 20 });
  const wheels = [[26, 26.5, 4]];
  // An Sd.Kfz. 7 with a flat bed at the back and a cab at the front.
  s.rect(1, 17 + dip, 30, 22 + dip, "team", 3);
  s.fill(21, 23 + dip, 30, 26 + dip, "team", 3);
  arches(s, wheels);
  camo(s, [[4, 19 + dip, 8, 20 + dip], [17, 18 + dip, 21, 19 + dip]]);
  s.rect(1, 12 + dip, 20, 17 + dip, "team", 2, true);
  s.rect(20, 10 + dip, 30, 17 + dip, "team", 1, true);
  s.fill(22, 11 + dip, 28, 12 + dip, "glass", 0);
  // The quad 20mm mount behind its angled shield. It swings between frames.
  s.rect(5, 5 + dip, 15, 13 + dip, "team", 1, true).shadow();
  const guns = frame ? [[5, 8], [0, 3]] : [[15, 7], [27, 0]];
  for (let i = 0; i < 4; i++) {
    const off = i * 1.7;
    s.bar(guns[0][0], guns[0][1] + off + dip, guns[1][0], guns[1][1] + off + dip, 1, "metal", 2);
  }
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function eightyEight(frame) {
  const s = sprite();
  // Cross-shaped platform, the mount, a shield, and the long 88 at a lower angle than the US 90mm.
  s.rect(1, 26, 30, 28, "metal", 2);
  s.rect(13, 22, 18, 31, "metal", 3);
  s.rect(8, 18, 22, 26, "team", 2, true);
  const lift = frame ? -1 : 0;
  s.bar(10, 19 + lift, 31, 8 + lift, 3, "team", 1);
  s.shadow();
  s.rect(28, 7 + lift, 31, 11 + lift, "team", 2);
  s.rect(14, 12, 18, 21, "team", 1, true);
  return finish(s);
}

export const units = [
  { code: "IN", name: "Infantry", real: "Rifleman with Kar98k", frames: frames(rifleman) },
  { code: "AI", name: "Assault Infantry", real: "Panzerschreck team", frames: frames(panzerschreck) },
  { code: "MO", name: "Mortar Team", real: "Granatwerfer 34", frames: frames(granatwerfer) },
  { code: "RC", name: "Recon", real: "Zündapp KS 750 with sidecar", frames: frames(sidecar) },
  { code: "HT", name: "Halftrack", real: "Sd.Kfz. 251 with MG 34", frames: frames(sdkfz251) },
  { code: "LT", name: "Light Tank", real: "Panzer II", frames: frames(panzerII) },
  { code: "MT", name: "Medium Tank", real: "Panzer IV", frames: frames(panzerIV) },
  { code: "HV", name: "Heavy Tank", real: "Tiger", frames: frames(tiger) },
  { code: "TD", name: "Tank Destroyer", real: "StuG III", frames: frames(stug) },
  { code: "AR", name: "Artillery", real: "leFH 18", frames: frames(leFH18) },
  { code: "RK", name: "Rocket Artillery", real: "Nebelwerfer 41", frames: frames(nebelwerfer) },
  { code: "AA", name: "Mobile AA", real: "Flakvierling 38 on Sd.Kfz. 7/1", frames: frames(flakvierling) },
  { code: "FK", name: "Flak Gun", real: "88mm Flak", frames: frames(eightyEight) },
];

for (const u of units) for (const f of u.frames) {
  if (f.length !== 32 || f.some((r) => r.length !== 32)) throw new Error(`${u.code}: not 32x32`);
}
