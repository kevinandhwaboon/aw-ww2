// US land units at 32x32 in a top-down 3/4 view, two idle frames each, facing right.
// Plus the 101st Airborne rifleman: an M1 carbine and a card suit on his helmet (08-art-pipeline §17).
import {
  arches, carbine, finish, wheelsInWells, garand, grille, hands, m1Helmet, overlay, shift, soldier, sprite, star, SUITS, track, wheel,
} from "./kit32.mjs";

const frames = (draw) => [draw(0), draw(1)];

function rifleman(frame) {
  return overlay(finish(soldier(frame)), garand(), hands());
}

/** A paratrooper: the card suit of his regiment on the helmet side, and an M1 carbine. */
function paratrooper(suit) {
  return (frame) => {
    const s = soldier(frame);
    SUITS[suit].forEach((row, y) => [...row].forEach((ch, x) => {
      if (ch === "S") s.dot(9 + x, 4 + y, "card", 0);
    }));
    return overlay(finish(s), carbine(), hands([[11, 23], [19, 22.5]]));
  };
}

function bazooka(frame) {
  const s = soldier(frame, { arms: false });
  s.rect(20, 15, 23, 18, "team", 2);
  const body = finish(s);
  // The M1 bazooka on the shoulder: a long steel tube with a flared mouth at the back.
  const t = sprite();
  t.rect(0, 9, 3, 15, "metal", 1);
  t.rect(3, 10, 31, 14, "metal", 1, true);
  t.fill(3, 10, 31, 10, "metal", 0);
  t.rect(17, 15, 18, 18, "darkwood", 0);
  t.rect(28, 9, 31, 15, "metal", 2);
  return overlay(body, finish(t, false), hands([[18, 18], [24, 16]]));
}

function mortar(frame) {
  // The tube on its baseplate and bipod, straight and steep.
  const m = sprite();
  m.rect(14, 28, 24, 30, "metal", 2);
  m.line(22, 18, 27, 29, "metal", 1).line(22, 18, 24, 29, "metal", 2);
  m.bar(16, 27, 25, 5, 3, "metal", 1);
  const tube = finish(m, false);
  // The crew: kneeling and aiming, or ducking with hands over the helmet.
  const s = sprite();
  if (frame === 0) {
    s.rect(1, 22, 12, 29, "team", 2);
    s.rect(0, 28, 6, 31, "leather", 2);
    s.rect(2, 13, 12, 23, "team", 1, true);
    s.oval(7, 10.5, 4, 3, "skin", 1);
    s.dot(9, 10, "metal", 4);
    m1Helmet(s, 7, 2, 8, 5.5);
    s.rect(10, 15, 16, 18, "team", 2);
    s.oval(17, 17, 1.6, 1.4, "skin", 1);
  } else {
    s.rect(1, 22, 13, 30, "team", 2);
    s.rect(0, 28, 6, 31, "leather", 2);
    s.rect(2, 17, 13, 24, "team", 1, true);
    m1Helmet(s, 8, 10, 18);
    s.oval(4, 15, 1.6, 1.4, "skin", 1).oval(12, 15, 1.6, 1.4, "skin", 1);
  }
  return overlay(tube, finish(s));
}

function jeep(frame) {
  const s = sprite();
  const dip = frame;
  const wheels = [[7, 26, 4], [24, 26, 4]];
  // Body: a low tub coming down over the wheels, and a long flat hood with the star on top.
  s.rect(1, 17 + dip, 30, 26 + dip, "team", 3);
  arches(s, wheels);
  s.rect(1, 12 + dip, 30, 18 + dip, "team", 1, true);
  star(s, 20, 13 + dip);
  // Open cab: seats and the driver in his M1 helmet; folded windshield; radio whip at the back.
  s.rect(4, 12 + dip, 14, 17 + dip, "team", 4);
  s.oval(10, 10 + dip, 3, 2, "skin", 1);
  m1Helmet(s, 10, 4 + dip, 9 + dip, 4.5);
  s.rect(15, 9 + dip, 16, 17 + dip, "metal", 2);
  s.line(2, 0, 3, 13 + dip, "metal", 3);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function halftrack(frame) {
  const s = sprite();
  const dip = frame;
  track(s, frame, { left: 1, right: 19, wheels: [4.5, 9.5, 14.5] });
  const wheels = [[26, 26.5, 4]];
  // Armored body: open troop compartment at the back, hood with a radiator grille at the front.
  s.rect(1, 17 + dip, 30, 22 + dip, "team", 3);
  s.fill(21, 23 + dip, 30, 26 + dip, "team", 3);
  arches(s, wheels);
  star(s, 8, 17 + dip);
  s.rect(1, 9 + dip, 21, 17 + dip, "team", 1, true);
  s.fill(3, 11 + dip, 19, 15 + dip, "team", 4);
  s.rect(21, 12 + dip, 30, 17 + dip, "team", 1, true);
  grille(s, 24, 29, 13 + dip, 16 + dip);
  // The M2 .50 cal on its ring: a boxy receiver, spade grips, and a heavy barrel with a cooling jacket.
  s.rect(9, 4 + dip, 14, 8 + dip, "metal", 2);
  s.rect(7, 5 + dip, 8, 7 + dip, "metal", 3);
  s.rect(15, 5 + dip, 24, 7 + dip, "metal", 1);
  for (let x = 16; x <= 22; x += 2) s.dot(x, 6 + dip, "metal", 4);
  s.rect(25, 5 + dip, 31, 6 + dip, "metal", 2);
  s.rect(11, 9 + dip, 12, 11 + dip, "metal", 3);
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function stuart(frame) {
  const s = sprite();
  const dip = frame;
  track(s, frame, { left: 4, right: 26, wheels: [8, 13, 18, 23] });
  s.rect(4, 18 + dip, 26, 23 + dip, "team", 3);
  star(s, 12, 18 + dip);
  s.rect(4, 10 + dip, 26, 17 + dip, "team", 1, true);
  grille(s, 6, 9, 12 + dip, 16 + dip);
  // Small turret and a short 37mm gun.
  s.rect(10, 6 + dip, 19, 13 + dip, "team", 1, true).shadow();
  s.oval(13, 8 + dip, 1.6, 1.2, "metal", 1);
  s.rect(19, 9 + dip, 28, 10 + dip, "team", 1).shadow();
  return finish(s);
}

function sherman(frame) {
  const s = sprite();
  const dip = frame;
  track(s, frame);
  s.rect(1, 18 + dip, 30, 23 + dip, "team", 3);
  star(s, 12, 18 + dip);
  s.rect(1, 8 + dip, 30, 17 + dip, "team", 1, true);
  grille(s, 3, 8, 10 + dip, 15 + dip);
  s.rect(25, 9 + dip, 30, 17 + dip, "team", 2);
  s.rect(26, 11 + dip, 28, 13 + dip, "team", 2);
  // Rounded cast turret, hatch, .30 cal on the cupola, mantlet and 75mm gun.
  s.oval(14, 10 + dip, 7.5, 6, "team", 1, true).shadow();
  s.oval(11.5, 8 + dip, 2.2, 1.6, "metal", 1);
  s.rect(13, 5 + dip, 19, 6 + dip, "metal", 2);
  s.rect(20, 9 + dip, 23, 13 + dip, "team", 2);
  s.rect(23, 10 + dip, 31, 12 + dip, "team", 1).shadow();
  return finish(s);
}

function wolverine(frame) {
  const s = sprite();
  const dip = frame;
  track(s, frame);
  // Low hull with sloped sides.
  s.poly([[1, 18 + dip], [30, 18 + dip], [29, 23 + dip], [2, 23 + dip]], "team", 3);
  star(s, 10, 18 + dip);
  s.rect(1, 10 + dip, 30, 17 + dip, "team", 1, true);
  grille(s, 3, 7, 12 + dip, 16 + dip);
  // Open-topped turret at the back: you see the crew space inside. Long 3-inch gun.
  s.poly([[8, 5 + dip], [19, 5 + dip], [21, 9 + dip], [19, 14 + dip], [8, 14 + dip], [6, 9 + dip]], "team", 1).shadow();
  s.fill(10, 7 + dip, 17, 12 + dip, "team", 4);
  s.oval(12, 9 + dip, 2, 1.5, "team", 3);
  s.rect(21, 8 + dip, 31, 10 + dip, "team", 1).shadow();
  s.rect(29, 7 + dip, 31, 11 + dip, "team", 2);
  return finish(s);
}

function howitzer(frame) {
  const s = sprite();
  // Split trail running back to its spades on the ground.
  s.poly([[13, 21], [16, 21], [4, 30], [0, 30]], "team", 2);
  s.poly([[14, 22], [17, 22], [10, 31], [6, 31]], "team", 3);
  // Gun shield, then the barrel on its cradle, which recoils a pixel in the second frame.
  s.rect(15, 12, 19, 24, "team", 2, true);
  const recoil = frame ? -1 : 0;
  s.rect(9 + recoil, 13, 18 + recoil, 17, "team", 3);
  s.bar(14 + recoil, 13, 30 + recoil, 6, 3, "team", 1);
  s.shadow();
  s.rect(28 + recoil, 4, 31 + recoil, 8, "team", 2);
  wheel(s, 17, 25, 5, 0);
  return finish(s);
}

function calliope(frame) {
  const s = sprite();
  const dip = frame;
  track(s, frame);
  s.rect(1, 19 + dip, 30, 23 + dip, "team", 3);
  star(s, 12, 19 + dip);
  s.rect(1, 12 + dip, 30, 18 + dip, "team", 1, true);
  s.oval(14, 13 + dip, 6, 4, "team", 1, true);
  // The rocket rack above the turret: a grid of tube mouths seen end-on.
  s.rect(2, 1 + dip, 27, 10 + dip, "metal", 2);
  for (let y = 2; y <= 8; y += 3) for (let x = 3; x <= 25; x += 3) s.fill(x, y + dip, x + 1, y + 1 + dip, "metal", 4);
  s.shadow();
  s.rect(21, 13 + dip, 31, 14 + dip, "team", 1);
  return finish(s);
}

function quadFifty(frame) {
  const s = sprite();
  const dip = frame;
  track(s, frame, { left: 1, right: 19, wheels: [4.5, 9.5, 14.5] });
  const wheels = [[26, 26.5, 4]];
  s.rect(1, 17 + dip, 30, 22 + dip, "team", 3);
  s.fill(21, 23 + dip, 30, 26 + dip, "team", 3);
  arches(s, wheels);
  star(s, 6, 17 + dip);
  s.rect(1, 11 + dip, 21, 17 + dip, "team", 1, true);
  s.rect(21, 13 + dip, 30, 17 + dip, "team", 1, true);
  grille(s, 24, 29, 14 + dip, 16 + dip);
  // The M45 quad mount: armored shield, four .50 cal barrels. It swings between frames.
  s.rect(6, 6 + dip, 16, 13 + dip, "team", 2, true).shadow();
  const guns = frame ? [[6, 8], [0, 2]] : [[16, 8], [28, 0]];
  for (let i = 0; i < 4; i++) {
    const off = i * 1.6;
    s.bar(guns[0][0], guns[0][1] + off + dip, guns[1][0], guns[1][1] + off + dip, 1, "metal", 2);
  }
  wheelsInWells(s, wheels, frame);
  return finish(s);
}

function ninetyMil(frame) {
  const s = sprite();
  // Cruciform platform on outriggers, the mount, and a long barrel pointing steeply up.
  s.rect(2, 26, 29, 28, "metal", 2);
  s.rect(13, 22, 18, 31, "metal", 3);
  s.rect(9, 18, 22, 26, "team", 2, true);
  const lift = frame ? -1 : 0;
  s.bar(12, 18 + lift, 28, 1 + lift, 3, "team", 1);
  s.shadow();
  s.rect(9, 15, 15, 20, "team", 3);
  return finish(s);
}

export const units = [
  { code: "IN", name: "Infantry", real: "GI with M1 Garand", frames: frames(rifleman) },
  { code: "AI", name: "Assault Infantry", real: "Bazooka team", frames: frames(bazooka) },
  { code: "MO", name: "Mortar Team", real: "US M2 mortar", frames: frames(mortar) },
  { code: "RC", name: "Recon", real: "Willys jeep", frames: frames(jeep) },
  { code: "HT", name: "Halftrack", real: "M3 with M2 .50 cal", frames: frames(halftrack) },
  { code: "LT", name: "Light Tank", real: "M5 Stuart", frames: frames(stuart) },
  { code: "MT", name: "Medium Tank", real: "M4 Sherman", frames: frames(sherman) },
  { code: "TD", name: "Tank Destroyer", real: "M10 Wolverine", frames: frames(wolverine) },
  { code: "AR", name: "Artillery", real: "M2 howitzer", frames: frames(howitzer) },
  { code: "RK", name: "Rocket Artillery", real: "T34 Calliope", frames: frames(calliope) },
  { code: "AA", name: "Mobile AA", real: "M16 quad .50", frames: frames(quadFifty) },
  { code: "FK", name: "Flak Gun", real: "90mm M1", frames: frames(ninetyMil) },
];

/** The 101st Airborne rifleman, one per card suit. A dropped US Infantry unit picks one by its id. */
export const paratroopers = ["spade", "heart", "diamond", "club"].map((suit) => ({
  code: `IN-${suit}`, name: `Paratrooper (${suit})`, real: "101st Airborne with M1 carbine", frames: frames(paratrooper(suit)),
}));

for (const u of [...units, ...paratroopers]) for (const f of u.frames) {
  if (f.length !== 32 || f.some((r) => r.length !== 32)) throw new Error(`${u.code}: not 32x32`);
}
export { shift };
