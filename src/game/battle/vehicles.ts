// Battle figures with wheels and tracks, guns on carriages, and the bunker (08-art-pipeline §18).
// Each nation's version follows the map art (08-art-pipeline §12, §17) and is drawn so the real
// vehicle can be told apart: a Sherman's bogies and cast turret, a Panzer IV's skirts and long gun,
// a Tiger's interleaved wheels and Zimmerit, a Willys jeep's flat hood and upright windshield, a
// Chi-Ha's bellcranks and handrail antenna. Japan's other machines (recon, halftrack, AA, guns,
// rockets) take the German shapes, which their real counterparts resembled, with Japanese crews.
// Stats never differ; only the look does. Every machine is a 3D model turned 5° toward the viewer
// (angled/models.ts, angled/vehicleModels.ts); crews are sprites drawn between the model's parts.

import { BATTLE_VIEW, drawMesh, screenAngle, screenPoint, type Face, type V3 } from "./angled/mesh";
import { TANK_MODELS, type Model, type TankKind } from "./angled/models";
import { bunker, calliope, flakGun, howitzer, m3, nebelwerfer, quadAA, r75, sdkfz251, willys, type Built } from "./angled/vehicleModels";
import { C, mix, shade, type Painter } from "./paint";
import { drawSoldier, earsCovered, sandbags, soldierFrame } from "./soldiers";
import { FIRE_TIMING } from "./timeline";
import { justFired, kick, kitOf, lerp, seg, type Look, type Muzzle, type Pose, type Pt, type Rig } from "./rig";

/** The Axis shapes: Germany's machines, which Japan's other machines also use (see the top). */
const de = (look: Look) => kitOf(look) !== "us";

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

/**
 * A crewman's head in the hatch: a US tanker helmet, German headphones over a side cap, or the
 * Japanese padded tanker's helmet with its peak.
 */
export function commander(p: Painter, x: number, y: number, look: Look): void {
  p.rect(x, y - 6, 5, 6, C("battleSkin"));
  p.px(x + 3, y - 4, C("battleInk"));
  if (kitOf(look) === "jp") {
    const pad = mix(C("battleKhaki"), C("battleLeather"), 0.4);
    p.rect(x - 1, y - 9, 6, 3, pad);
    p.rect(x + 4, y - 7, 3, 1, shade(pad, 0.7));
    p.rect(x - 1, y - 6, 2, 3, pad);
    p.px(x + 1, y - 9, shade(pad, 1.3));
  } else if (de(look)) {
    p.rect(x - 1, y - 8, 7, 2, C("battleRubber"));
    p.px(x - 1, y - 4, C("battleRubber"));
  } else {
    p.rect(x - 1, y - 9, 7, 3, C("battleLeather"));
    p.rect(x - 1, y - 6, 2, 3, C("battleLeather"));
    p.rect(x, y - 9, 4, 1, shade(C("battleLeather"), 1.3));
  }
  p.rect(x - 2, y, 9, 2, C("battleSteelDark"));
}

/** Seen from a little above, the near track sits below the model's origin: lift it onto the slot. */
const MODEL_LIFT = 6;

/** Built models, by tank kind, nation, team color and how far the gun has recoiled (whole pixels). */
const modelCache = new Map<string, Model>();

function tankModel(kind: TankKind, look: Look, recoil: number): Model {
  const key = `${kind}|${look.nation ?? ""}|${look.team.mid}|${recoil}`;
  let model = modelCache.get(key);
  if (!model) {
    model = TANK_MODELS[kind][kitOf(look)](look.team, recoil);
    modelCache.set(key, model);
  }
  return model;
}

/**
 * Tanks and tank destroyers are 3D models turned 5° toward the viewer, so turret roofs, hatches
 * and fronts show (08-art-pipeline §18). The gun recoils and the hull rocks when it fires.
 */
export function tankRig(kind: TankKind): Rig {
  return {
    body: "machine",
    hit: { x: 0, y: -18 },
    draw(p, pose, look) {
      const gun = pose.fire === "tankGun";
      const shotAt = FIRE_TIMING.tankGun.shots[0] ?? 150;
      const recoil = gun ? Math.round(kick(pose.ct, shotAt, 50, 350) * 5) : 0;
      const rock = gun ? Math.round(kick(pose.ct, shotAt, 60, 200)) : 0;
      const model = tankModel(kind, look, recoil);
      drawMesh(p, model.faces, BATTLE_VIEW, -rock, -MODEL_LIFT);
      for (const at of [...(model.commander ? [model.commander] : []), ...(model.crew ?? [])]) {
        const head = screenPoint(at, BATTLE_VIEW, -rock, -MODEL_LIFT);
        commander(p, Math.round(head.x) - 2, Math.round(head.y), look);
      }
    },
    muzzle(pose, _shot, look): Muzzle {
      const model = tankModel(kind, look, 0);
      const at = screenPoint(pose.fire === "mg" ? model.mg : model.muzzle, BATTLE_VIEW, 0, -MODEL_LIFT);
      return { x: at.x, y: at.y, angle: 0 };
    },
  };
}

// ---- Shared by the other machines ----

const V = BATTLE_VIEW;

/** Built models, by kind and everything that changes their shape (team, gun angle, recoil). */
const built = new Map<string, Built<string>>();

function memo<A extends string>(key: string, make: () => Built<A>): Built<A> {
  const cached = built.get(key) as Built<A> | undefined;
  if (cached) return cached;
  const made = make();
  built.set(key, made);
  return made;
}

const at = (v: V3, oy: number, ox = 0): Pt => screenPoint(v, V, ox, oy);
/** A model's named point, looked up by a name built at run time (a numbered barrel). */
const point = (m: Built<string>, name: string): V3 => (m.at as Readonly<Record<string, V3 | undefined>>)[name] ?? [0, 0, 0];
const mesh = (p: Painter, faces: readonly Face[] | undefined, oy: number, ox = 0) => {
  if (faces) drawMesh(p, faces, V, ox, oy);
};
/** A gun raised `elevation` radians, as an angle on screen. */
const elevationAngle = (elevation: number) => screenAngle([0, 0, 0], [Math.cos(elevation), 0, Math.sin(elevation)], V);

/** A rifleman's helmeted head and shoulders over the side of a vehicle. */
function trooper(p: Painter, x: number, y: number, look: Look): void {
  p.rect(x - 1, y - 2, 8, 4, look.team.clothLo);
  p.rect(x, y - 8, 6, 6, C("battleSkin"));
  p.px(x + 4, y - 6, C("battleInk"));
  if (kitOf(look) === "jp") {
    // Type 90 helmet, its neck flaps hanging behind.
    p.rect(x - 2, y - 8, 3, 6, mix(look.team.cloth, C("battleSand"), 0.3));
    p.rect(x, y - 11, 6, 3, look.team.lo);
    p.rect(x - 1, y - 9, 8, 1, look.team.deep);
  } else if (de(look)) {
    p.rect(x - 1, y - 11, 8, 4, look.team.lo);
    p.rect(x - 2, y - 8, 2, 3, look.team.lo);
  } else {
    p.rect(x - 1, y - 11, 8, 4, look.team.lo);
    p.rect(x - 2, y - 8, 10, 1, look.team.deep);
  }
}

// ---- Recon: a Willys jeep with a .30 cal, or a motorcycle and sidecar with an MG 34 ----

const reconBounce = (pose: Pose, look: Look) => Math.floor(pose.t / (de(look) ? 150 : 160) + pose.index) % 2;
const reconModel = (look: Look, shake: number) =>
  de(look) ? memo(`r75|${look.team.mid}|${shake}`, () => r75(look.team, shake)) : memo(`willys|${look.team.mid}|${shake}`, () => willys(look.team, shake));

export const reconRig: Rig = {
  body: "machine",
  hit: { x: 0, y: -14 },
  draw(p, pose, look) {
    const shake = pose.fire === "mg" && justFired(pose.ct, FIRE_TIMING.mg.shots, 40) >= 0 ? 1 : 0;
    const oy = -MODEL_LIFT - reconBounce(pose, look);
    if (de(look)) {
      const m = memo(`r75|${look.team.mid}|${shake}`, () => r75(look.team, shake));
      mesh(p, m.far, oy);
      // The rider in his long rubberized coat, goggles on his helmet.
      const seat = at(m.at.rider, oy);
      const bars = at(m.at.bars, oy);
      const rf = drawSoldier(p, seat.x, seat.y, "kneel", look, { lean: 3, front: bars, back: { x: bars.x - 1, y: bars.y + 1 } });
      p.rect(seat.x - 2, rf.hip - 1, 13, 7, mix(C(kitOf(look) === "jp" ? "battleKhaki" : "battleFieldGrey"), C("battleRubber"), 0.25));
      p.rect(rf.head.x + 1, rf.head.y - 3, 5, 1, C("battleSkyLow"));
      mesh(p, m.near, oy);
      const g = at(m.at.gunner, oy);
      const grip = at(m.at.grip, oy);
      const fore = at(m.at.fore, oy);
      drawSoldier(p, g.x, g.y, "crouch", look, { lean: 1, back: { x: grip.x, y: grip.y + 1 }, front: { x: fore.x, y: fore.y + 1 } });
      mesh(p, m.front, oy);
      return;
    }
    const m = memo(`willys|${look.team.mid}|${shake}`, () => willys(look.team, shake));
    mesh(p, m.far, oy);
    // The driver on the far seat, hands on the wheel.
    const T = look.team;
    const d = at(m.at.driver, oy);
    const dx = Math.round(d.x);
    const dy = Math.round(d.y);
    p.rect(dx - 1, dy - 17, 8, 10, T.clothLo);
    p.rect(dx, dy - 24, 6, 7, C("battleSkin"));
    p.px(dx + 4, dy - 22, C("battleInk"));
    p.rect(dx - 1, dy - 27, 8, 3, T.lo);
    p.rect(dx - 2, dy - 25, 10, 1, T.deep);
    p.line(dx + 4, dy - 13, dx + 9, dy - 14, T.clothLo, 2);
    p.line(dx + 9, dy - 17, dx + 7, dy - 11, C("battleRubber"), 2);
    // The gunner stands in the back behind the pedestal gun.
    const g = at(m.at.gunner, oy);
    const grip = at(m.at.grip, oy);
    const fore = at(m.at.fore, oy);
    drawSoldier(p, g.x, g.y, "stand", look, { lean: 2, back: { x: grip.x, y: grip.y + 2 }, front: { x: fore.x, y: fore.y + 2 } });
    mesh(p, m.near, oy);
  },
  muzzle(pose, _shot, look): Muzzle {
    const m = reconModel(look, 0);
    return { ...at(m.at.muzzle, -MODEL_LIFT - reconBounce(pose, look)), angle: 0 };
  },
};

// ---- Halftracks: an M3 with a .50, or a Sd.Kfz. 251 with an MG 34, the squad aboard ----

const halftrackModel = (look: Look) =>
  de(look) ? memo(`251|${look.team.mid}`, () => sdkfz251(look.team)) : memo(`m3|${look.team.mid}`, () => m3(look.team));
const halftrackBob = (pose: Pose) => Math.floor(pose.t / 170 + pose.index) % 2;

export const halftrackRig: Rig = {
  body: "machine",
  hit: { x: 0, y: -16 },
  draw(p, pose, look) {
    const oy = -MODEL_LIFT - halftrackBob(pose);
    const m = halftrackModel(look);
    mesh(p, m.far, oy);
    for (const key of ["troop0", "troop1", "troop2"]) {
      const h = at(point(m, key), oy);
      trooper(p, Math.round(h.x) - 3, Math.round(h.y), look);
    }
  },
  muzzle(pose, _shot, look): Muzzle {
    return { ...at(halftrackModel(look).at.muzzle, -MODEL_LIFT - halftrackBob(pose)), angle: 0 };
  },
};

// ---- Mobile AA: four guns on a halftrack, raised high at aircraft ----

const aaElevation = (atAir: boolean) => (atAir ? 1.05 : 0.13);

export const mobileAARig: Rig = {
  body: "machine",
  hit: { x: 0, y: -16 },
  draw(p, pose, look) {
    const elevation = aaElevation(pose.atAir);
    const shot = pose.fire === "aaGuns" ? justFired(pose.ct, FIRE_TIMING.aaGuns.shots, 45) : -1;
    const kicked = shot >= 0 ? shot % 4 : -1;
    const m = memo(`aa|${look.nation ?? ""}|${look.team.mid}|${elevation}|${kicked}`, () => quadAA(look.team, de(look), elevation, kicked));
    mesh(p, m.far, -MODEL_LIFT);
    const g = at(m.at.gunner, -MODEL_LIFT);
    commander(p, Math.round(g.x) - 2, Math.round(g.y), look);
  },
  muzzle(pose, shot, look): Muzzle {
    const elevation = aaElevation(pose.atAir);
    const m = memo(`aa|${look.nation ?? ""}|${look.team.mid}|${elevation}|-1`, () => quadAA(look.team, de(look), elevation, -1));
    return { ...at(point(m, `muzzle${shot % 4}`), -MODEL_LIFT), angle: elevationAngle(elevation) };
  },
};

// ---- Flak gun: an 88 or a 90mm on its cross-shaped platform ----

const flakElevation = (atAir: boolean) => (atAir ? 1.0 : 0.07);

export const flakRig: Rig = {
  body: "machine",
  hit: { x: 0, y: -16 },
  draw(p, pose, look) {
    const ct = pose.fire === "flak" ? pose.ct : null;
    const shots = FIRE_TIMING.flak.shots;
    const recoil = Math.round(Math.max(...shots.map((s) => kick(ct, s, 40, 260))) * 8);
    const elevation = flakElevation(pose.atAir);
    const m = memo(`flak|${look.nation ?? ""}|${look.team.mid}|${elevation}|${recoil}`, () => flakGun(look.team, de(look), elevation, recoil));
    mesh(p, m.far, -MODEL_LIFT);
    // The loader brings up the next round; the layer turns the handwheels.
    const breech = at(m.at.breech, -MODEL_LIFT);
    const reloading = ct !== null && ct > 300 && ct < 620;
    const u = seg(ct, 380, 560);
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
    const hw = at(m.at.handwheel, -MODEL_LIFT);
    const wheelTurn = Math.floor(pose.t / 200) % 2;
    drawSoldier(p, hw.x + 9, 0, "kneel", look, { lean: -3, front: { x: hw.x + 1, y: hw.y - 1 + wheelTurn }, back: { x: hw.x, y: hw.y } });
    // A spent casing kicked out of the breech.
    for (const s of shots) {
      const k = seg(ct, s + 30, s + 400);
      if (k > 0 && k < 1) p.rect(breech.x - 4 - k * 24, breech.y - Math.sin(k * Math.PI) * 10 + k * 18, 6, 2, C("battleBrass"));
    }
  },
  muzzle(pose, _shot, look): Muzzle {
    const elevation = flakElevation(pose.atAir);
    const m = memo(`flak|${look.nation ?? ""}|${look.team.mid}|${elevation}|0`, () => flakGun(look.team, de(look), elevation, 0));
    return { ...at(m.at.muzzle, -MODEL_LIFT), angle: elevationAngle(elevation) };
  },
};

// ---- Artillery: a howitzer with a loader, a gunner on the lanyard and an ammunition handler ----

const HOWITZER_ELEVATION = 0.85;
const GUN_LIFT = 7;

export const artilleryRig: Rig = {
  body: "machine",
  hit: { x: 0, y: -14 },
  draw(p, pose, look) {
    const ct = pose.fire === "howitzer" ? pose.ct : null;
    const shotAt = FIRE_TIMING.howitzer.shots[0] ?? 760;
    const recoil = Math.round(kick(ct, shotAt, 50, 420) * 7);
    const hop = Math.round(kick(ct, shotAt, 40, 120));
    const m = memo(`howitzer|${look.nation ?? ""}|${look.team.mid}|${recoil}`, () => howitzer(look.team, de(look), HOWITZER_ELEVATION, recoil));
    const oy = -GUN_LIFT - hop;
    mesh(p, m.far, oy);
    mesh(p, m.near, oy);

    // The loader carries a shell up and rams it home, steps back and covers his ears.
    const step = seg(ct, 0, 320);
    const ram = seg(ct, 320, 480);
    const clear = ct !== null && ct > 520 && ct < 1150;
    const breech = at(m.at.breech, -GUN_LIFT);
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
  muzzle(_pose, _shot, look): Muzzle {
    const m = memo(`howitzer|${look.nation ?? ""}|${look.team.mid}|0`, () => howitzer(look.team, de(look), HOWITZER_ELEVATION, 0));
    return { ...at(m.at.muzzle, -GUN_LIFT), angle: elevationAngle(HOWITZER_ELEVATION) };
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

const NEBEL_ELEVATION = 0.75;
const CALLIOPE_ELEVATION = 0.38;
const rocketModel = (look: Look) =>
  de(look)
    ? memo(`nebel|${look.team.mid}`, () => nebelwerfer(look.team, NEBEL_ELEVATION))
    : memo(`calliope|${look.team.mid}`, () => calliope(look.team, CALLIOPE_ELEVATION));
/** Which tube a rocket leaves from: six barrels on the Nebelwerfer, five rows on the Calliope rack. */
const tubeOf = (look: Look, shot: number) => `muzzle${shot % (de(look) ? 6 : 5)}`;

export const rocketRig: Rig = {
  body: "machine",
  hit: { x: 0, y: -16 },
  draw(p, pose, look) {
    const ct = pose.fire === "rockets" ? pose.ct : null;
    const shot = justFired(ct, FIRE_TIMING.rockets.shots, 60);
    const firing = ct !== null && ct < 1200;
    const m = rocketModel(look);
    if (de(look)) {
      // The Nebelwerfer's crew shelter in a foxhole with the firing cable.
      mesh(p, m.far, -GUN_LIFT);
      mesh(p, m.near, -GUN_LIFT);
      const f = soldierFrame(-54, 2, "crouch");
      sandbags(p, -66, -40, 2, 6);
      drawSoldier(p, -54, 2, "crouch", look, firing ? earsCovered(f) : { front: { x: -44, y: -8 } });
      sandbags(p, -66, -44, 4, 4);
      if (firing) p.line(-44, -4, -8, -4, C("battleRubber"));
      if (pose.index === 0) spotter(p, 46, look);
    } else {
      mesh(p, m.far, -MODEL_LIFT);
      if (pose.index === 0) spotter(p, 62, look);
    }
    if (shot >= 0) {
      const flash = at(point(m, tubeOf(look, shot)), de(look) ? -GUN_LIFT : -MODEL_LIFT);
      p.rect(flash.x - 2, flash.y - 2, 4, 4, C("battleFlash"));
    }
  },
  muzzle(_pose, shot, look): Muzzle {
    const tube = point(rocketModel(look), tubeOf(look, shot));
    return { ...at(tube, de(look) ? -GUN_LIFT : -MODEL_LIFT), angle: elevationAngle(de(look) ? NEBEL_ELEVATION : CALLIOPE_ELEVATION) };
  },
};

// ---- Bunker ----

const BUNKER_LIFT = 10;

export const bunkerRig: Rig = {
  body: "machine",
  hit: { x: 0, y: -18 },
  draw(p, pose, look) {
    const T = look.team;
    const m = memo(`bunker|${T.mid}`, () => bunker(T));
    mesh(p, m.far, -BUNKER_LIFT);
    sandbags(p, -44, 44, 0, 8);
    // Cracks and exposed rebar spread over the near wall as it loses HP.
    const cracks = 10 - pose.hp;
    for (let i = 0; i < cracks; i++) {
      const cx = -32 + ((i * 17) % 58);
      const cy = -30 + ((i * 7) % 16);
      p.line(cx, cy, cx + 3, cy + 4, T.deep);
      p.line(cx + 3, cy + 4, cx + 1, cy + 8, T.deep);
      if (i % 3 === 2) p.line(cx + 1, cy, cx + 5, cy - 3, C("battleLeather"));
    }
  },
  muzzle(_pose, _shot, look): Muzzle {
    const m = memo(`bunker|${look.team.mid}`, () => bunker(look.team));
    return { ...at(m.at.muzzle, -BUNKER_LIFT), angle: 0 };
  },
};
