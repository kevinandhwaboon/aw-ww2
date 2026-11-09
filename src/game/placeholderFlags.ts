// Small national flags for the HUD. Placeholder art, and deliberately free of political symbols:
// the Soviet flag is a plain star, Germany shows the Balkenkreuz, its wartime military marking, and
// Japan shows its national flag, the plain red disc, never the rising-sun ensign.

import type { NationId } from "../engine/data/nations";

export const FLAG_COLORS: Readonly<Record<string, string>> = {
  R: "#b22234",
  W: "#f2efe0",
  B: "#2a3a7c",
  G: "#e0b030",
  K: "#1a1a16",
  A: "#8a8d86",
};

/** Every nation's flag as rows of color letters, all the same size. */
export const FLAGS: Readonly<Record<NationId, readonly string[]>> = {
  us: [
    "BWBWBWBRRRRRRRRR",
    "BBWBWBBWWWWWWWWW",
    "BWBWBWBRRRRRRRRR",
    "BBWBWBBWWWWWWWWW",
    "BWBWBWBRRRRRRRRR",
    "WWWWWWWWWWWWWWWW",
    "RRRRRRRRRRRRRRRR",
    "WWWWWWWWWWWWWWWW",
    "RRRRRRRRRRRRRRRR",
  ],
  uk: [
    "WRBBBBWRRWBBBBRW",
    "BWRBBBWRRWBBBRWB",
    "BBWRBBWRRWBBRWBB",
    "WWWWWWWRRWWWWWWW",
    "RRRRRRRRRRRRRRRR",
    "WWWWWWWRRWWWWWWW",
    "BBRWBBWRRWBBWRBB",
    "BRWBBBWRRWBBBWRB",
    "RWBBBBWRRWBBBBWR",
  ],
  canada: [
    "WBWRWBWRRRRRRRRR",
    "BWWRWWBRRRRRRRRR",
    "RRRRRRRRRRRRRRRR",
    "BWWRWWBRRRRGGRRR",
    "WBWRWBWRRRGGGGRR",
    "RRRRRRRRRRGGGGRR",
    "RRRRRRRRRRGGGGRR",
    "RRRRRRRRRRRGGRRR",
    "RRRRRRRRRRRRRRRR",
  ],
  ussr: [
    "RRRRRRRRRRRRRRRR",
    "RRRRGRRRRRRRRRRR",
    "RRGGGGGRRRRRRRRR",
    "RRRGGGRRRRRRRRRR",
    "RRRGRGRRRRRRRRRR",
    "RRRRRRRRRRRRRRRR",
    "RRRRRRRRRRRRRRRR",
    "RRRRRRRRRRRRRRRR",
    "RRRRRRRRRRRRRRRR",
  ],
  germany: [
    "AAAAAWWWWWWAAAAA",
    "AAAAAWKKKKWAAAAA",
    "AAAWWWKKKKWWWAAA",
    "AAAWKKKKKKKKWAAA",
    "AAAWKKKKKKKKWAAA",
    "AAAWKKKKKKKKWAAA",
    "AAAWWWKKKKWWWAAA",
    "AAAAAWKKKKWAAAAA",
    "AAAAAWWWWWWAAAAA",
  ],
  japan: [
    "WWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWW",
    "WWWWWWRRRRWWWWWW",
    "WWWWWRRRRRRWWWWW",
    "WWWWWRRRRRRWWWWW",
    "WWWWWRRRRRRWWWWW",
    "WWWWWWRRRRWWWWWW",
    "WWWWWWWWWWWWWWWW",
    "WWWWWWWWWWWWWWWW",
  ],
};
