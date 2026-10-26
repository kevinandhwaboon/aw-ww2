import { parseAsciiMap } from "../../engine/map";

// Phase 0 placeholder map, 15×10 tiles (240×160 px, the GBA screen size). Legend: engine/map.ts.
export const HELLO_MAP = parseAsciiMap([
  "SSSS_.FF.~bbHHH",
  "SSS_.C.F.~.bbHH",
  "SSP_..f..~..bCH",
  "SS__=====#===Q.",
  "S__..X..o~..f..",
  "S_..FF..o~.FF.C",
  "S_.C.F...~.HH..",
  "SS_..bb..~xbb..",
  "SSS_.bbb.~.bbF.",
  "rSSS_.bb.~..FFF",
]);
