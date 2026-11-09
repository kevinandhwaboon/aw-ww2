// A tank commander standing up in his hatch (08-art-pipeline §18 "Polish"). He comes up out of a
// hatch ring, its lid swung open behind him, shoulders and one arm out over the rim, wearing his
// nation's tanker headgear with goggles pushed up: US: the M1938 tanker helmet, its padded ribs and
// ear flaps. Germany: the side cap under headphones, goggles on the cap and a throat microphone.
// Japan: the cork tanker's helmet with its ribs and short peak. Faces right; the hatch rim's
// centre is at (x, y). The same crewman in a steel helmet mans guns (`headgear: "helmet"`).

import { C, mix, shade, type Painter } from "./paint";
import { kitOf, type Look } from "./rig";
import { helmet } from "./soldiers";

export interface CommanderOptions {
  /** Draw the hatch ring and its open lid: false for crew in an open-topped turret. */
  readonly hatch: boolean;
  /** Tanker headgear with goggles (the default), or a soldier's steel helmet for gun crews. */
  readonly headgear?: "tanker" | "helmet";
}

/** The tanker's jacket: US tan zip jacket, German black wrap jacket, Japanese khaki. Gun crews wear the uniform. */
function jacketOf(look: Look, headgear: "tanker" | "helmet"): string {
  if (headgear === "helmet") return look.team.cloth;
  const kit = kitOf(look);
  if (kit === "de") return mix(C("battleInk"), C("battleFieldGrey"), 0.3);
  if (kit === "jp") return C("battleKhaki");
  return mix(C("battleSand"), C("battleOlive"), 0.45);
}

export function tankCommander(p: Painter, x: number, y: number, look: Look, opts: CommanderOptions = { hatch: true }): void {
  const kit = kitOf(look);
  const ink = C("battleInk");
  const skin = C("battleSkin");
  const skinLo = shade(skin, 0.78);
  const headgear = opts.headgear ?? "tanker";
  const jacket = jacketOf(look, headgear);
  const jacketHi = shade(jacket, 1.25);
  const jacketLo = shade(jacket, 0.72);
  const rim = look.team.lo;
  const rimHi = look.team.hi;

  if (opts.hatch) {
    // The open lid, hinged at the back of the ring and standing up behind him.
    p.poly([[x - 6, y], [x - 3, y], [x - 6, y - 10], [x - 9, y - 9]], look.team.mid);
    p.line(x - 9, y - 9, x - 6, y - 10, rimHi);
    p.line(x - 6, y - 10, x - 3, y - 1, shade(look.team.mid, 0.75));
    p.rect(x - 7, y - 6, 1, 2, C("battleSteelDark"));
    // The ring and the dark hatchway inside it.
    p.ellipse(x, y, 6, 2.6, rim);
    p.ellipse(x, y - 0.3, 4.6, 1.7, ink);
    p.rect(x - 4, y - 2, 6, 1, rimHi);
  }

  // Shoulders and chest, coming up out of the hatch.
  p.rect(x - 4, y - 6, 8, 6, jacket);
  p.rect(x - 4, y - 6, 8, 1, jacketHi);
  p.rect(x - 4, y - 5, 1, 5, jacketHi);
  p.rect(x + 3, y - 5, 1, 5, jacketLo);
  // The collar, and the jacket's front: the US zip, the German wrap's lapel.
  p.rect(x - 1, y - 6, 3, 1, kit === "de" ? jacketHi : jacketLo);
  if (headgear === "tanker" && kit === "us") p.rect(x + 1, y - 5, 1, 4, jacketLo);
  if (headgear === "tanker" && kit === "de") p.line(x - 1, y - 5, x + 2, y - 2, jacketHi);
  // The near arm, out over the rim with the hand resting on it.
  p.rect(x + 3, y - 5, 3, 2, jacket);
  p.rect(x + 5, y - 4, 2, 3, jacketLo);
  p.rect(x + 6, y - 2, 2, 2, skin);
  p.px(x + 7, y - 1, skinLo);

  // Neck and face, looking ahead.
  p.rect(x - 1, y - 8, 3, 2, skinLo);
  p.rect(x - 2, y - 13, 5, 5, skin);
  p.px(x + 3, y - 11, skin); // nose
  p.px(x + 3, y - 9, skinLo); // chin
  p.px(x + 2, y - 12, ink); // eye
  p.px(x + 1, y - 13, skinLo); // brow
  p.rect(x - 2, y - 13, 1, 5, skinLo); // the side of the head, away from the light
  p.px(x + 1, y - 9, skinLo); // mouth

  // Headgear, with goggles pushed up on the brow (their lenses catch the light).
  const lens = (lx: number, ly: number) => {
    p.rect(lx - 1, ly, 3, 2, ink);
    p.px(lx, ly, C("battleLens"));
    p.px(lx + 1, ly, C("battleLightTint"));
  };
  if (headgear === "helmet") {
    // A soldier's steel helmet, as the infantry wear it (soldiers.ts), over a face 6 wide.
    p.px(x + 3, y - 13, skin);
    helmet(p, x - 2, y - 13, look);
  } else if (kit === "de") {
    // Side cap, then the headphone band over it and an earpiece over the ear.
    const cap = mix(C("battleInk"), C("battleFieldGrey"), 0.25);
    p.rect(x - 3, y - 16, 6, 3, cap);
    p.rect(x + 3, y - 15, 1, 2, cap);
    p.rect(x - 3, y - 16, 5, 1, shade(cap, 1.5));
    p.rect(x - 4, y - 14, 7, 1, C("battleLeather")); // goggle strap round the cap
    lens(x + 2, y - 15);
    p.rect(x - 3, y - 17, 3, 1, C("battleRubber")); // headphone band
    p.rect(x - 4, y - 16, 1, 4, C("battleRubber"));
    p.rect(x - 4, y - 12, 3, 3, C("battleRubber")); // earpiece
    p.px(x - 3, y - 12, shade(C("battleRubber"), 1.6));
    p.rect(x - 1, y - 8, 3, 1, C("battleRubber")); // throat microphone strap
  } else {
    // A padded tanker's helmet: a ribbed dome with ear flaps; Japan's has a short peak.
    const hat = kit === "jp" ? mix(C("battleKhaki"), C("battleLeather"), 0.35) : mix(C("battleLeather"), C("battleOlive"), 0.35);
    const hatHi = shade(hat, 1.35);
    const hatLo = shade(hat, 0.7);
    p.rect(x - 3, y - 17, 6, 4, hat);
    p.rect(x - 2, y - 18, 4, 1, hat);
    p.rect(x - 2, y - 18, 3, 1, hatHi);
    p.rect(x - 3, y - 17, 1, 3, hatHi);
    for (const rx of [x - 1, x + 1]) p.rect(rx, y - 17, 1, 3, hatLo); // padded ribs
    p.rect(x + 3, y - 15, 1, 2, hatLo);
    p.rect(x - 4, y - 14, 3, 5, hat); // ear flap
    p.rect(x - 4, y - 14, 1, 5, hatLo);
    p.px(x - 2, y - 10, hatLo);
    if (kit === "jp") p.rect(x + 2, y - 14, 3, 1, hatLo); // peak
    p.rect(x - 3, y - 15, 5, 1, C("battleLeather")); // goggle strap
    lens(x + 2, y - 16);
  }

  if (opts.hatch) {
    // The front of the ring comes up over his waist.
    p.rect(x - 5, y, 11, 1, rim);
    p.rect(x - 4, y + 1, 9, 1, rim);
    p.rect(x - 3, y + 2, 7, 1, shade(rim, 0.75));
    p.rect(x - 4, y, 5, 1, rimHi);
  }
}
