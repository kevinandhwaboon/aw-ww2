// The built-in scenarios, in the order the map select shows them. Each file is validated on load.

import { parseScenario, type Scenario } from "../engine/scenario";
import bastogne from "./bastogne.json";
import beachhead from "./beachhead.json";
import bocageCountry from "./bocage-country.json";
import contestedSkies from "./contested-skies.json";
import crossroads from "./crossroads.json";
import iwoJima from "./iwo-jima.json";
import narrowSea from "./narrow-sea.json";
import normandy from "./normandy.json";
import provingGround from "./proving-ground.json";
import theSlot from "./the-slot.json";
import twinBridges from "./twin-bridges.json";

export const SCENARIOS: readonly Scenario[] = [twinBridges, bocageCountry, crossroads, contestedSkies, narrowSea, beachhead, normandy, bastogne, iwoJima, theSlot, provingGround].map(parseScenario);
