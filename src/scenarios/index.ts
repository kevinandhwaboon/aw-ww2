// The built-in scenarios, in the order the map select shows them. Each file is validated on load.
// Only maps modeled on WW2 battles (00-master-design §8).

import { parseScenario, type Scenario } from "../engine/scenario";
import bastogne from "./bastogne.json";
import battleOfBritain from "./battle-of-britain.json";
import elAlamein from "./el-alamein.json";
import guadalcanal from "./guadalcanal.json";
import iwoJima from "./iwo-jima.json";
import kursk from "./kursk.json";
import marketGarden from "./market-garden.json";
import midway from "./midway.json";
import normandy from "./normandy.json";
import sevastopol from "./sevastopol.json";
import stalingrad from "./stalingrad.json";
import tenGo from "./ten-go.json";
import theSlot from "./the-slot.json";

export const SCENARIOS: readonly Scenario[] = [normandy, marketGarden, elAlamein, bastogne, battleOfBritain, stalingrad, sevastopol, kursk, iwoJima, theSlot, midway, guadalcanal, tenGo].map(parseScenario);
