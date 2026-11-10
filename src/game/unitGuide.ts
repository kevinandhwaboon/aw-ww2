// The build list's short guide to each unit. Written by hand, because the highest numbers in the
// damage chart don't always show what a unit is for. A test checks every entry against the chart.

import type { UnitTypeId } from "../engine/data/units";

export interface UnitGuide {
  readonly role: string;
  readonly strongVs: readonly UnitTypeId[];
  readonly weakVs: readonly UnitTypeId[];
}

export const UNIT_GUIDE: Readonly<Record<UnitTypeId, UnitGuide>> = {
  infantry: { role: "Cheap. Captures property", strongVs: ["mortar"], weakVs: ["recon", "mediumTank", "mobileAA"] },
  assaultInfantry: { role: "Captures. Breaks armor and fortifications", strongVs: ["lightTank", "mediumTank", "tankDestroyer"], weakVs: ["recon", "mortar", "mobileAA"] },
  mortar: { role: "Indirect fire at range 2. Crosses rough ground", strongVs: ["infantry", "assaultInfantry"], weakVs: ["recon", "lightTank", "mediumTank"] },
  recon: { role: "Fast scout", strongVs: ["infantry", "mortar"], weakVs: ["lightTank", "mediumTank", "tankDestroyer"] },
  halftrack: { role: "Unarmed. Carries one foot unit and resupplies", strongVs: [], weakVs: ["assaultInfantry", "lightTank", "mediumTank"] },
  lightTank: { role: "Cheap, fast armor", strongVs: ["infantry", "recon"], weakVs: ["assaultInfantry", "mediumTank", "tankDestroyer"] },
  mediumTank: { role: "Main battle tank", strongVs: ["infantry", "recon", "lightTank"], weakVs: ["assaultInfantry", "heavyTank", "tankDestroyer"] },
  heavyTank: { role: "Breakthrough armor. Slow and thirsty", strongVs: ["lightTank", "mediumTank", "artillery"], weakVs: ["tankDestroyer", "bomber"] },
  tankDestroyer: { role: "Anti-armor. No machine gun", strongVs: ["lightTank", "mediumTank", "heavyTank"], weakVs: ["assaultInfantry", "artillery", "bomber"] },
  artillery: { role: "Indirect fire at range 2-3. Can't move and fire", strongVs: ["infantry", "mortar", "recon"], weakVs: ["lightTank", "mediumTank", "bomber"] },
  rocketArtillery: { role: "Indirect fire at range 3-5. Fragile", strongVs: ["infantry", "mortar", "recon"], weakVs: ["lightTank", "mediumTank", "bomber"] },
  mobileAA: { role: "Air defense that also shreds infantry", strongVs: ["fighter", "bomber", "infantry"], weakVs: ["mediumTank", "heavyTank", "tankDestroyer"] },
  flakGun: { role: "Long-range air defense. Air targets only", strongVs: ["fighter", "bomber", "transportAircraft"], weakVs: ["lightTank", "mediumTank", "artillery"] },
  fighter: { role: "Hunts aircraft. 2 rounds of ammo", strongVs: ["bomber", "transportAircraft"], weakVs: ["mobileAA", "flakGun"] },
  bomber: { role: "Heavy strikes on land and sea. 2 bomb loads, short range", strongVs: ["mediumTank", "heavyTank", "battleship"], weakVs: ["fighter", "flakGun"] },
  transportAircraft: { role: "Unarmed. Flies foot units in", strongVs: [], weakVs: ["fighter", "flakGun"] },
  diveBomber: { role: "Light strikes on land and sea. Flies from Carriers. 2 bombs", strongVs: ["infantry", "artillery", "rocketArtillery"], weakVs: ["fighter", "flakGun"] },
  torpedoBomber: { role: "Sinks ships. Flies from Carriers. 1 torpedo", strongVs: ["battleship", "carrier", "destroyer"], weakVs: ["fighter", "flakGun"] },
  battleship: { role: "Long-range naval guns", strongVs: ["infantry", "destroyer"], weakVs: ["submarine", "bomber"] },
  destroyer: { role: "Escort. Hunts submarines", strongVs: ["submarine", "torpedoBoat"], weakVs: ["battleship", "bomber"] },
  submarine: { role: "Ambushes ships", strongVs: ["battleship", "landingCraft"], weakVs: ["destroyer", "bomber"] },
  landingCraft: { role: "Unarmed. Carries land units to the beach", strongVs: [], weakVs: ["submarine", "torpedoBoat", "bomber"] },
  torpedoBoat: { role: "Cheap ship killer", strongVs: ["landingCraft"], weakVs: ["destroyer", "bomber"] },
  carrier: { role: "Unarmed. Carries 2 Fighters, Dive or Torpedo Bombers, which take off and strike the same turn", strongVs: [], weakVs: ["submarine", "torpedoBomber"] },
};
