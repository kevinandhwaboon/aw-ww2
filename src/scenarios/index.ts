// The built-in scenarios, in the order the map select shows them. Each file is validated on load.

import { parseScenario, type Scenario } from "../engine/scenario";
import bocageCountry from "./bocage-country.json";
import provingGround from "./proving-ground.json";
import twinBridges from "./twin-bridges.json";

export const SCENARIOS: readonly Scenario[] = [twinBridges, bocageCountry, provingGround].map(parseScenario);
