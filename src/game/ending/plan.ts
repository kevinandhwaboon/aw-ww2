// The campaign's ending (22-campaign §7a): the surrender aboard USS Missouri in Tokyo Bay, 2 September
// 1945, as a short code-drawn film. This is its script: the shots, how long each runs and its words.
// No DOM here, so the tests can read it.
//
// Like the commanders (06-commanders §1), it names and portrays no real person: the figures are the
// Japanese delegation, Allied officers and the Missouri's crew, never anyone in particular.

export type ShotId = "title" | "bay" | "signing" | "flyover" | "end";

export interface Shot {
  readonly id: ShotId;
  /** How long it runs, in ms. The last shot holds until the player moves on. */
  readonly length: number;
  /** The words under the picture. */
  readonly caption: string;
}

export const SHOTS: readonly Shot[] = [
  { id: "title", length: 4500, caption: "2 September 1945 · Tokyo Bay" },
  {
    id: "bay",
    length: 10000,
    caption: "The Allied fleet lies at anchor in Tokyo Bay. A launch carries the Japanese delegation out to the battleship USS Missouri.",
  },
  {
    id: "signing",
    length: 15000,
    caption: "On the Missouri's deck the Instrument of Surrender is signed: first for Japan, then for the Allied Powers.",
  },
  { id: "flyover", length: 8000, caption: "As the ceremony ends, hundreds of Allied aircraft pass over the fleet." },
  { id: "end", length: 6000, caption: "The war is over." },
];

/** When the film reaches the last shot, which then holds. */
export const ENDING_LENGTH = SHOTS.reduce((sum, s) => sum + s.length, 0);

/** The shot playing at `t` ms, and how far into it; past the end, the last shot. */
export function shotAt(t: number): { readonly shot: Shot; readonly index: number; readonly local: number } {
  let start = 0;
  for (let index = 0; index < SHOTS.length; index++) {
    const shot = SHOTS[index];
    if (!shot) break;
    if (t < start + shot.length || index === SHOTS.length - 1) return { shot, index, local: Math.max(0, t - start) };
    start += shot.length;
  }
  throw new Error("the ending has no shots");
}

/** When shot `index` starts, in ms from the beginning. */
export function shotStart(index: number): number {
  return SHOTS.slice(0, index).reduce((sum, s) => sum + s.length, 0);
}

/**
 * The signing, in ms into the signing shot: who walks to the table when, and when the pen moves.
 * Two of the delegation sign for Japan, then an Allied officer for the Allied Powers.
 */
export const SIGNERS = [
  { who: "delegateCivilian", walk: 1000, sign: 2600, back: 5200 },
  { who: "delegateMilitary", walk: 5600, sign: 7000, back: 9000 },
  { who: "alliedOfficer", walk: 9400, sign: 10800, back: 13200 },
] as const;

/** A line under the last shot: how much of the campaign the player won. */
export function summaryLine(won: number, total: number): string {
  return won >= total ? `Campaign complete: all ${total} missions won.` : `Campaign complete: ${won} of ${total} missions won.`;
}
