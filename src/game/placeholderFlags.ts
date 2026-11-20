// Small national flags for the HUD. Placeholder art, and deliberately free of political symbols:
// the Soviet flag is a white-edged red star on a plain green field (no hammer and sickle), Germany shows the Balkenkreuz, its wartime military marking, and
// Japan shows its national flag, the plain red disc, never the rising-sun ensign. Italy shows the plain
// tricolour, never the Savoy crest or the fasces. Free France shows the plain French tricolour, without
// the Cross of Lorraine.

import type { NationId } from "../engine/data/nations";

export const FLAG_COLORS: Readonly<Record<string, string>> = {
  R: "#b22234",
  W: "#f2efe0",
  B: "#2a3a7c",
  G: "#e0b030",
  K: "#1a1a16",
  A: "#8a8d86",
  O: "#4e5c34",
  V: "#1f7a3e",
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
    "OOOOOOOOOOOOOOOO",
    "OOOOOOOWOOOOOOOO",
    "OOOOOOWRWOOOOOOO",
    "OOOOWWRRRWWOOOOO",
    "OOOWRRRRRRRWOOOO",
    "OOOOWRRRRRWOOOOO",
    "OOOOWRRWRRWOOOOO",
    "OOOOOWWOWWOOOOOO",
    "OOOOOOOOOOOOOOOO",
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
  // Free France: the plain blue, white and red vertical tricolour.
  freeFrance: [
    "BBBBBWWWWWWRRRRR",
    "BBBBBWWWWWWRRRRR",
    "BBBBBWWWWWWRRRRR",
    "BBBBBWWWWWWRRRRR",
    "BBBBBWWWWWWRRRRR",
    "BBBBBWWWWWWRRRRR",
    "BBBBBWWWWWWRRRRR",
    "BBBBBWWWWWWRRRRR",
    "BBBBBWWWWWWRRRRR",
  ],
  // Italy: the plain green, white and red tricolour, never the Savoy crest of the wartime flag.
  italy: [
    "VVVVVWWWWWWRRRRR",
    "VVVVVWWWWWWRRRRR",
    "VVVVVWWWWWWRRRRR",
    "VVVVVWWWWWWRRRRR",
    "VVVVVWWWWWWRRRRR",
    "VVVVVWWWWWWRRRRR",
    "VVVVVWWWWWWRRRRR",
    "VVVVVWWWWWWRRRRR",
    "VVVVVWWWWWWRRRRR",
  ],
};
