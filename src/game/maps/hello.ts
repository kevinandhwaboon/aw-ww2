import { parseAsciiMap } from "../../engine/map";
import type { GameSetup } from "../../engine/setup";

// Phase 0 placeholder map, 15×10 tiles (240×160 px, the GBA screen size). Legend: engine/map.ts.
export const HELLO_MAP = parseAsciiMap([
  "SSSS_.FF.~bbHHH",
  "SSS_.C.F.~.bbHH",
  "SSP_..f..~..bCH",
  "SS__=====#===Q.",
  "S__..X..o~..f..",
  "S_..FF..o~.FF.C",
  "S_.Q.F.C.~CHH..",
  "SS_..bb..~xbb..",
  "SSS_.bbb.~.bbF.",
  "rSSS_.bb.~..FFF",
]);

/**
 * Debug demo on the hello map: a few units per side, some damaged or veteran, one modifier, and
 * neutral cities to fight over. The US can't build Heavy Tanks or Rocket Artillery here, as an
 * example of the availability rule (01-units §1).
 */
export const HELLO_SETUP: GameSetup = {
  map: HELLO_MAP,
  players: [
    {
      name: "Allies",
      nation: "us",
      funds: 5000,
      buildable: [
        "infantry", "assaultInfantry", "mortar", "recon", "halftrack",
        "lightTank", "mediumTank", "tankDestroyer", "artillery", "mobileAA",
      ],
    },
    { name: "Axis", nation: "germany", funds: 5000 },
  ],
  propertyOwners: [
    { pos: { x: 5, y: 1 }, owner: 0 },
    { pos: { x: 6, y: 2 }, owner: 0 },
    { pos: { x: 3, y: 6 }, owner: 0 },
    { pos: { x: 13, y: 2 }, owner: 1 },
    { pos: { x: 13, y: 3 }, owner: 1 },
    { pos: { x: 12, y: 4 }, owner: 1 },
  ],
  units: [
    { type: "infantry", owner: 0, pos: { x: 5, y: 3 } },
    { type: "assaultInfantry", owner: 0, pos: { x: 5, y: 4 }, kills: 4 }, // veteran, in the bunker
    { type: "mediumTank", owner: 0, pos: { x: 7, y: 3 } },
    { type: "artillery", owner: 0, pos: { x: 4, y: 5 }, ammo: 4 }, // low on shells, for the Halftrack to resupply
    { type: "recon", owner: 0, pos: { x: 6, y: 1 }, hp: 64 },
    { type: "halftrack", owner: 0, pos: { x: 2, y: 5 } },
    { type: "infantry", owner: 1, pos: { x: 10, y: 3 } },
    { type: "infantry", owner: 1, pos: { x: 11, y: 2 }, hp: 47 },
    { type: "heavyTank", owner: 1, pos: { x: 11, y: 4 } },
    { type: "tankDestroyer", owner: 1, pos: { x: 13, y: 6 } },
    { type: "mortar", owner: 1, pos: { x: 12, y: 7 }, kills: 9 }, // elite, in bocage
    { type: "rocketArtillery", owner: 1, pos: { x: 14, y: 4 } },
    { type: "mobileAA", owner: 1, pos: { x: 10, y: 1 } },
  ],
  seed: 2026,
  modifiers: [
    {
      source: "demo: Axis heavy armor doctrine",
      stat: "movePoints",
      op: "add",
      value: 1,
      scope: { players: [1], unitTypes: ["heavyTank", "tankDestroyer"] },
    },
  ],
};
