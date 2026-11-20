// The page's URL options for testing (11-tech-setup §7), read into plain values. Pure: no window, no
// randomness, so the rules for each option can be tested directly.
//
//   ?map=bastogne        skips the menus and starts that scenario
//   ?seed=123            fixes the luck rolls
//   ?luck=off            turns luck off
//   ?fog=on              turns fog of war on (19-fog-of-war)
//   ?weather=rain        that weather every day, in place of the scenario's forecast (12-weather): clear, snow or rain
//   ?handoff=off         skips the pass-the-device screen
//   ?battle=off          plays attacks on the map instead of as battle scenes
//   ?battle=demo         the battle preview page (src/game/battle/preview.ts)
//   ?ending=on           plays the campaign's ending, the surrender on the Missouri (22-campaign §7a)
//   ?polish=off          battle machines drawn without the polish pass (08-art-pipeline §18)
//   ?pack=night-ops      uses that art pack (08-art-pipeline §13)
//   ?debug=on            shows the unit and debug panels
//   ?ai=1                the computer plays these players (comma-separated ids; ?ai=0,1 watches AI vs AI,
//                        ?ai=none is all human). Without it, the computer plays everyone not on the first player's side.
//   ?level=easy          the computer plays on Easy (09-ai §4c); Normal without it
//   ?pad=on / ?pad=off   forces the phone game-pad layout on or off (on by default on small touch screens)
//   ?sound=off           starts with sound off, without changing the saved sound level (16-sound §8)
//   ?nations=uk,germany  each player fields that nation instead of the scenario's, in player order, to
//                        see a nation's art on any map (art only; what a player can build stays the
//                        scenario's). Blanks and unknown names keep the scenario's nation.
//   ?commanders=harlan,falk  each player fights under that commander, in player order (06-commanders).
//                        Blanks, unknown names and commanders of the other side mean no commander.

import type { AiLevel } from "./ai/weights";
import { COMMANDER_IDS, COMMANDERS, type CommanderId } from "./engine/data/commanders";
import { NATIONS, type NationId } from "./engine/data/nations";
import { WEATHER_IDS, type WeatherId } from "./engine/data/weather";

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
  readonly fog: boolean;
  /** Weather for every day in place of the scenario's forecast; null keeps the forecast. */
  readonly weather: WeatherId | null;
  readonly passDevice: boolean;
  readonly battleScenes: boolean;
  /** Show the battle preview page instead of a game. */
  readonly battleDemo: boolean;
  /** Play the campaign's ending straight away (22-campaign §7a). */
  readonly ending: boolean;
  readonly polish: boolean;
  readonly pack: string;
  readonly debug: boolean;
  /** Player ids the computer plays; null means the default (everyone not on the first player's side). */
  readonly computer: readonly number[] | null;
  readonly level: AiLevel;
  /** Forces the phone game-pad layout on or off; null decides by the screen. */
  readonly pad: boolean | null;
  /** False: start this visit with sound off. */
  readonly sound: boolean;
  /** Nations to field instead of the scenario's, in player order; null keeps that player's. */
  readonly nations: readonly (NationId | null)[];
  /** Each player's commander, in player order; null is no commander. */
  readonly commanders: readonly (CommanderId | null)[];
}

export function parseUrlOptions(params: UrlParams): UrlOptions {
  const seed = params.get("seed")?.trim() ?? "";
  const ai = params.get("ai");
  const pad = params.get("pad");
  return {
    map: params.get("map"),
    seed: seed !== "" && Number.isFinite(Number(seed)) ? Number(seed) : null,
    luck: params.get("luck") !== "off",
    fog: params.get("fog") === "on",
    weather: WEATHER_IDS.find((id) => id === params.get("weather")) ?? null,
    passDevice: params.get("handoff") !== "off",
    battleScenes: params.get("battle") !== "off",
    battleDemo: params.get("battle") === "demo",
    ending: params.get("ending") === "on",
    polish: params.get("polish") !== "off",
    pack: params.get("pack") ?? "default",
    debug: params.get("debug") === "on",
    computer: ai === null ? null : ai === "none" ? [] : playerIds(ai),
    level: params.get("level") === "easy" ? "easy" : "normal",
    pad: pad === "on" ? true : pad === "off" ? false : null,
    sound: params.get("sound") !== "off",
    nations: (params.get("nations") || null)
      ?.split(",")
      .map((name) => {
        const n = name.trim();
        return Object.hasOwn(NATIONS, n) ? (n as NationId) : null;
      }) ?? [],
    commanders: (params.get("commanders") || null)
      ?.split(",")
      .map((name) => {
        const n = name.trim();
        return COMMANDER_IDS.includes(n as CommanderId) ? (n as CommanderId) : null;
      }) ?? [],
  };
}

/** The commanders a nation may fight under: those of its own side, in roster order (06-commanders §2). */
export const commandersFor = (nation: NationId): CommanderId[] =>
  COMMANDER_IDS.filter((id) => NATIONS[COMMANDERS[id].nation].side === NATIONS[nation].side);

/**
 * The scenario's players, each under the commander chosen for them, if any. A commander of the
 * other side is dropped: they serve only their own side (06-commanders §2).
 */
export function withCommanders<P extends { readonly nation: NationId }>(
  players: readonly P[],
  commanders: readonly (CommanderId | null)[],
): (P & { readonly commander?: CommanderId })[] {
  return players.map((player, i) => {
    const commander = commanders[i];
    return commander && commandersFor(player.nation).includes(commander) ? { ...player, commander } : player;
  });
}

/** The scenario's players, each fielding the nation `?nations=` gives it, if any. */
export function withNations<P extends { readonly nation: NationId }>(players: readonly P[], nations: readonly (NationId | null)[]): P[] {
  return players.map((player, i) => {
    const nation = nations[i];
    return nation ? { ...player, nation } : player;
  });
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
