// The page's URL options for testing (11-tech-setup §7), read into plain values. Pure: no window, no
// randomness, so the rules for each option can be tested directly.
//
//   ?map=bocage-country  skips the menus and starts that scenario
//   ?seed=123            fixes the luck rolls
//   ?luck=off            turns luck off
//   ?handoff=off         skips the pass-the-device screen
//   ?battle=off          plays attacks on the map instead of as battle scenes
//   ?battle=demo         the battle preview page (src/game/battle/preview.ts)
//   ?polish=off          battle machines drawn without the polish pass (08-art-pipeline §18)
//   ?pack=night-ops      uses that art pack (08-art-pipeline §13)
//   ?debug=on            shows the unit and debug panels
//   ?ai=1                the computer plays these players (comma-separated ids; ?ai=0,1 watches AI vs AI,
//                        ?ai=none is all human). Without it, the computer plays everyone but the first player.
//   ?level=easy          the computer plays on Easy (09-ai §4c); Normal without it
//   ?pad=on / ?pad=off   forces the phone game-pad layout on or off (on by default on small touch screens)

import type { AiLevel } from "./ai/weights";

/** Anything that looks up a URL parameter by name, like URLSearchParams. */
export interface UrlParams {
  get(name: string): string | null;
}

export interface UrlOptions {
  /** The scenario id to start straight away, skipping the menus. */
  readonly map: string | null;
  /** A fixed seed for the luck rolls; null picks a random one. */
  readonly seed: number | null;
  readonly luck: boolean;
  readonly passDevice: boolean;
  readonly battleScenes: boolean;
  /** Show the battle preview page instead of a game. */
  readonly battleDemo: boolean;
  readonly polish: boolean;
  readonly pack: string;
  readonly debug: boolean;
  /** Player ids the computer plays; null means the default (everyone but the first player). */
  readonly computer: readonly number[] | null;
  readonly level: AiLevel;
  /** Forces the phone game-pad layout on or off; null decides by the screen. */
  readonly pad: boolean | null;
}

export function parseUrlOptions(params: UrlParams): UrlOptions {
  const seed = params.get("seed")?.trim() ?? "";
  const ai = params.get("ai");
  const pad = params.get("pad");
  return {
    map: params.get("map"),
    seed: seed !== "" && Number.isFinite(Number(seed)) ? Number(seed) : null,
    luck: params.get("luck") !== "off",
    passDevice: params.get("handoff") !== "off",
    battleScenes: params.get("battle") !== "off",
    battleDemo: params.get("battle") === "demo",
    polish: params.get("polish") !== "off",
    pack: params.get("pack") ?? "default",
    debug: params.get("debug") === "on",
    computer: ai === null ? null : ai === "none" ? [] : playerIds(ai),
    level: params.get("level") === "easy" ? "easy" : "normal",
    pad: pad === "on" ? true : pad === "off" ? false : null,
  };
}

/** "0,1" → [0, 1]. Blanks and anything that isn't a whole number are skipped. */
function playerIds(list: string): number[] {
  return list
    .split(",")
    .map((part) => part.trim())
    .filter((part) => part !== "")
    .map(Number)
    .filter(Number.isInteger);
}
