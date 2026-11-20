// The campaign's ending drawn (22-campaign §7a): Tokyo Bay under Mount Fuji, the Missouri at anchor,
// the signing on her deck and the flyover, in the battle scenes' pixel style and colors
// (08-art-pipeline §18). Every color is an art-pack color, through the battle scenes' C().

import { setGameNations } from "../artPack";
import { drawBackdrop, SCENE } from "../battle/backdrops";
import { setBattleWeather } from "../battle/colors";
import { C, mix, Painter, shade, teamShades } from "../battle/paint";
import type { Look, Pose } from "../battle/rig";
import { battleshipRig, destroyerRig } from "../battle/ships";
import { SHOTS, SIGNERS, shotAt, type ShotId } from "./plan";

const { width: W, height: H, top: TOP, bottom: BOTTOM } = SCENE;

/** Fade in and out over this many ms at the edges of each shot. */
const FADE = 600;

const ease = (u: number) => (u <= 0 ? 0 : u >= 1 ? 1 : u * u * (3 - 2 * u));
const hash = (i: number, salt: number) => {
  const s = Math.sin(i * 127.1 + salt * 311.7) * 43758.5453;
  return s - Math.floor(s);
};

/** The US Navy's ships, in haze grey rather than the US player's army green. */
function navyLook(): Look {
  return { team: teamShades(null, "us"), nation: "us", paratrooper: false, suit: 0, submerged: false, dugIn: false, beached: false };
}

const restPose = (t: number, index: number): Pose => ({ t, index, fire: null, ct: null, atAir: false, hp: 10 });

export class EndingRenderer {
  private readonly p: Painter;

  constructor(readonly canvas: HTMLCanvasElement) {
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext("2d");
    if (!ctx) throw new Error("2D canvas not available");
    ctx.imageSmoothingEnabled = false;
    this.p = new Painter(ctx);
  }

  /** Draws the film at `t` ms. */
  render(t: number): void {
    // The ships and uniforms are the US's and Japan's; a clear morning, as it was.
    setGameNations(["us", "japan"]);
    setBattleWeather({ season: "summer", snowing: false, raining: false });
    const { shot, local } = shotAt(t);
    const { ctx } = this.p;
    ctx.save();
    ctx.fillStyle = C("battlePanel");
    ctx.fillRect(0, 0, W, H);
    ctx.beginPath();
    ctx.rect(0, TOP, W, BOTTOM - TOP);
    ctx.clip();
    this.draw(shot.id, local);
    ctx.restore();
    // Black bars top and bottom, and a fade at each cut.
    const last = shot === SHOTS[SHOTS.length - 1];
    const fade = Math.min(1, local / FADE, last ? 1 : (shot.length - local) / FADE);
    if (fade < 1) {
      ctx.save();
      ctx.globalAlpha = 1 - Math.max(0, fade);
      ctx.fillStyle = C("battlePanel");
      ctx.fillRect(0, 0, W, H);
      ctx.restore();
    }
  }

  private draw(id: ShotId, t: number): void {
    switch (id) {
      case "title":
      case "end":
        this.dawnSky(t, id === "end" ? 0.55 : 0.85);
        return;
      case "bay":
        this.bay(t);
        return;
      case "signing":
        this.signing(t);
        return;
      case "flyover":
        this.flyover(t);
        return;
    }
  }

  // ---- The title and end cards: the bay at first light, darkened behind the words ----

  private dawnSky(t: number, dim: number): void {
    this.bay(t, false);
    const { ctx } = this.p;
    ctx.save();
    ctx.globalAlpha = dim;
    ctx.fillStyle = C("battlePanel");
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
  }

  // ---- Tokyo Bay: the fleet at anchor, Fuji beyond, the launch coming out ----

  private bay(t: number, launch = true): void {
    const { p } = this;
    drawBackdrop(p, 0, "sea", "sea", t, 1);
    drawBackdrop(p, SCENE.half, "sea", "sea", t, 1);
    const horizon = SCENE.horizon - 6;
    this.fuji(300, horizon);
    // Ships of the fleet, small on the horizon.
    for (let i = 0; i < 9; i++) {
      const x = 12 + i * 42 + hash(i, 4) * 18;
      if (x > 250 && x < 350) continue;
      const len = 10 + hash(i, 7) * 14;
      p.rect(x, horizon - 2, len, 2, mix(C("battleSteelDark"), C("battleSkyLow"), 0.35));
      p.rect(x + len * 0.4, horizon - 4, 3, 2, mix(C("battleSteelDark"), C("battleSkyLow"), 0.35));
    }
    // A destroyer standing by, further out.
    const ctx = p.ctx;
    ctx.save();
    ctx.translate(60, horizon + 22);
    ctx.scale(0.45, 0.45);
    destroyerRig.draw(p, restPose(t, 1), navyLook());
    ctx.restore();
    // The Missouri, at anchor.
    ctx.save();
    ctx.translate(200, 186);
    battleshipRig.draw(p, restPose(t, 0), navyLook());
    ctx.restore();
    if (launch) this.launch(t);
  }

  private fuji(cx: number, base: number): void {
    const { p } = this;
    const far = mix(C("battleSeaDeep"), C("battleSkyLow"), 0.55);
    p.poly([[cx - 90, base], [cx - 14, base - 46], [cx + 14, base - 46], [cx + 90, base]], far);
    p.poly([[cx - 14, base - 46], [cx + 14, base - 46], [cx + 26, base - 34], [cx + 12, base - 30], [cx + 2, base - 36], [cx - 10, base - 31], [cx - 26, base - 34]], C("battleSnow"));
  }

  /** The launch, from the left to the battleship's side, with the delegation's top hats aboard. */
  private launch(t: number): void {
    const { p } = this;
    const u = ease(Math.min(1, t / 8500));
    const x = 6 + u * 150;
    const y = 208 + Math.round(Math.sin(t / 300));
    p.poly([[x, y - 4], [x + 26, y - 4], [x + 30, y - 1], [x + 26, y + 2], [x + 2, y + 2]], C("battleSteel"));
    p.rect(x + 6, y - 7, 10, 3, shade(C("battleSteel"), 0.8));
    for (let i = 0; i < 4; i++) {
      p.rect(x + 7 + i * 4, y - 10, 2, 3, i < 2 ? C("battleInk") : C("battleKhaki"));
      p.px(x + 7 + i * 4, y - 7, C("battleSkin"));
    }
    if (u < 1) for (let i = 0; i < 6; i++) p.px(x - 2 - i * 3, y + 1 - (i % 2), C("battleFoam"));
  }

  // ---- The deck: the table, the delegation, the Allied officers, the crew on the turret ----

  private signing(t: number): void {
    const { p } = this;
    const deck = 150;
    // Sky and sea beyond the rail.
    for (let i = 0; i < 6; i++) p.rect(0, TOP + i * 12, W, 12, mix(C("battleSkyTop"), C("battleSkyLow"), i / 5));
    p.rect(0, TOP + 72, W, deck - TOP - 72, C("battleSea"));
    this.fuji(320, TOP + 72);
    // The turret and its great guns over the scene, on the left.
    p.rect(-10, 60, 120, 52, shade(C("battleSteel"), 0.9));
    p.rect(-10, 60, 120, 4, C("battleSteel"));
    for (let i = 0; i < 3; i++) p.line(100, 74 + i * 10, 250, 50 + i * 10, shade(C("battleSteel"), 0.75), 4);
    // The crew along the turret top and the rail.
    for (let i = 0; i < 14; i++) this.figure(4 + i * 7, 60, "sailor", 0, 0.7);
    // Deck planking: scrubbed teak.
    const teak = mix(C("battleWood"), C("battleSand"), 0.45);
    p.rect(0, deck - 40, W, BOTTOM - deck + 40, teak);
    for (let y = deck - 36; y < BOTTOM; y += 5) p.rect(0, y, W, 1, shade(teak, 0.86));
    p.rect(0, deck - 42, W, 2, C("battleSteelDark"));
    // Ranks of Allied officers behind and to the left.
    for (let i = 0; i < 12; i++) this.figure(122 + i * 11, deck - 12, i % 3 === 2 ? "alliedUk" : "allied", 0, 0.85);
    for (let i = 0; i < 6; i++) this.figure(40 + i * 12, deck + 6, i % 2 ? "alliedUk" : "allied", 0, 1);
    // The table with its cloth, and the documents on it.
    const tx = 168;
    const ty = deck + 22;
    p.rect(tx, ty, 64, 4, mix(C("battleGrass"), C("battleInk"), 0.35));
    p.rect(tx, ty + 4, 64, 10, mix(C("battleGrass"), C("battleInk"), 0.5));
    p.rect(tx + 4, ty + 14, 2, 10, C("battleWood"));
    p.rect(tx + 58, ty + 14, 2, 10, C("battleWood"));
    p.rect(tx + 14, ty - 1, 12, 2, C("battleStar"));
    p.rect(tx + 38, ty - 1, 12, 2, C("battleStar"));
    // The delegation, standing to the right; each signer walks to the table, signs and goes back.
    const home = [
      { x: 266, kind: "civilian" as const },
      { x: 280, kind: "civilian" as const },
      { x: 294, kind: "japanese" as const },
      { x: 308, kind: "japanese" as const },
      { x: 322, kind: "japanese" as const },
    ];
    const signer = (i: number) => SIGNERS[i];
    const walkX = (from: number, to: number, s: { walk: number; sign: number; back: number }) => {
      if (t < s.walk || t > s.back + 1400) return { x: from, bend: 0 };
      if (t < s.sign) return { x: from + (to - from) * ease((t - s.walk) / (s.sign - s.walk)), bend: 0 };
      if (t < s.back) return { x: to, bend: 1 };
      return { x: to + (from - to) * ease((t - s.back) / 1400), bend: 0 };
    };
    home.forEach((d, i) => {
      const s = i === 0 ? signer(0) : i === 2 ? signer(1) : undefined;
      const at = s ? walkX(d.x, tx + 54, s) : { x: d.x, bend: 0 };
      this.figure(at.x, ty + 18, d.kind, at.bend, 1);
      if (at.bend) this.pen(at.x - 6, ty - 1, t);
    });
    // An Allied officer signs last, from the left.
    const allied = signer(2);
    if (allied) {
      const at = walkX(138, tx + 12, allied);
      this.figure(at.x, ty + 18, "allied", at.bend, 1);
      if (at.bend) this.pen(at.x + 4, ty - 1, t);
    }
  }

  /** The pen moving across a page, and a line of ink left behind it. */
  private pen(x: number, y: number, t: number): void {
    const { p } = this;
    const u = (t / 90) % 8;
    p.line(x + u, y - 4, x + u + 2, y, C("battleInk"));
    p.rect(x, y, Math.round(u), 1, C("battleInk"));
  }

  /**
   * One standing figure, feet at (x, y), drawn small: an Allied officer in khaki or British brown, a
   * sailor in white, one of the Japanese delegation in a morning coat and top hat or in uniform.
   * `bend` leans him over the table to sign.
   */
  private figure(x: number, y: number, kind: "allied" | "alliedUk" | "sailor" | "civilian" | "japanese", bend: number, scale: number): void {
    const { p } = this;
    const s = (v: number) => Math.max(1, Math.round(v * scale));
    const coat =
      kind === "allied" ? mix(C("battleKhaki"), C("battleOlive"), 0.4)
      : kind === "alliedUk" ? C("battleBrown")
      : kind === "sailor" ? C("battleStar")
      : kind === "civilian" ? C("battleInk")
      : C("battleKhaki");
    const legs = kind === "civilian" ? C("battleSteel") : shade(coat, 0.8);
    const lean = Math.round(bend * 4 * scale);
    const legH = s(9);
    const bodyH = s(9);
    p.rect(x - s(2), y - legH, s(2), legH, legs);
    p.rect(x + s(1) - 1, y - legH, s(2), legH, legs);
    p.rect(x - s(3) - lean, y - legH - bodyH, s(6), bodyH, coat);
    if (kind === "civilian") p.rect(x - s(1) - lean, y - legH - bodyH, s(2), s(4), C("battleStar"));
    const headY = y - legH - bodyH - s(4);
    p.rect(x - s(2) - lean, headY, s(4), s(4), C("battleSkin"));
    if (kind === "civilian") {
      p.rect(x - s(2) - lean, headY - s(5), s(4), s(5), C("battleInk"));
      p.rect(x - s(3) - lean, headY - s(1), s(6), s(1), C("battleInk"));
    } else if (kind === "sailor") {
      p.rect(x - s(2) - lean, headY - s(1), s(4), s(1), C("battleStar"));
    } else {
      p.rect(x - s(3) - lean, headY - s(1), s(6), s(2), shade(coat, 0.7));
    }
  }

  // ---- The flyover: formation after formation crossing the sky over the fleet ----

  private flyover(t: number): void {
    const { p } = this;
    drawBackdrop(p, 0, "sea", "air", t, 1);
    drawBackdrop(p, SCENE.half, "sea", "air", t, 1);
    // The fleet at anchor far below.
    const sea = BOTTOM - 26;
    for (let i = 0; i < 7; i++) {
      const x = 20 + i * 52 + hash(i, 13) * 20;
      const len = 14 + hash(i, 17) * 16;
      p.rect(x, sea + 8 + (i % 3) * 5, len, 2, mix(C("battleConcrete"), C("battleSeaDeep"), 0.3));
      p.rect(x + len * 0.4, sea + 6 + (i % 3) * 5, 4, 2, mix(C("battleConcrete"), C("battleSeaDeep"), 0.3));
    }
    // Formations of five in a V, wave after wave, in four bands of height; every third wave heavy bombers.
    for (let f = 0; f < 12; f++) {
      const band = f % 4;
      const big = f % 3 === 2;
      const speed = big ? 0.04 : 0.055;
      const x = -40 + (t - Math.floor(f / 4) * 2200 - band * 500) * speed;
      const y = TOP + 22 + band * 30;
      const gap = big ? 16 : 11;
      for (let k = 0; k < 5; k++) {
        const side = k === 0 ? 0 : k % 2 ? 1 : -1;
        const back = Math.ceil(k / 2);
        this.plane(x - back * gap, y + side * back * (gap - 4), big);
      }
    }
  }

  /** An aircraft seen from below, far off: fuselage, wings and tail. */
  private plane(x: number, y: number, big: boolean): void {
    if (x < -20 || x > W + 20) return;
    const { p } = this;
    const c = C("battleSteelDark");
    if (big) {
      p.rect(x - 6, y, 12, 2, c);
      p.rect(x, y - 6, 2, 14, c);
      p.rect(x - 6, y - 2, 1, 6, c);
      return;
    }
    p.rect(x - 3, y, 6, 1, c);
    p.rect(x, y - 3, 1, 7, c);
    p.rect(x - 3, y - 1, 1, 3, c);
  }
}
