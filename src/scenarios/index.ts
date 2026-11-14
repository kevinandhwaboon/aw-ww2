// The built-in scenarios, in the order the map select shows them. Each file is validated on load.
// Only maps modeled on WW2 battles (00-master-design §8).

import { parseScenario, type Scenario } from "../engine/scenario";
import bastogne from "./bastogne.json";
import iwoJima from "./iwo-jima.json";
import midway from "./midway.json";
import normandy from "./normandy.json";
import theSlot from "./the-slot.json";

export const SCENARIOS: readonly Scenario[] = [normandy, bastogne, iwoJima, theSlot, midway].map(parseScenario);
