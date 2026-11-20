// What the campaign screen says the computer has been given (22-campaign §7), in words. Pure: the
// display names come in from the art pack, so the words follow the pack as the rest of the game does.

import type { CommanderId } from "../engine/data/commanders";
import { NATIONS } from "../engine/data/nations";
import type { UnitTypeId } from "../engine/data/units";
import type { Scenario } from "../engine/scenario";
import type { CampaignMission } from "./missions";

export interface Names {
  readonly unit: (type: UnitTypeId) => string;
  readonly commander: (id: CommanderId) => string;
}

/** "2 Medium Tanks", but "6 Infantry" and "2 Artillery": unit names ending in y are already collective. */
const plural = (n: number, name: string) => (n === 1 || name.endsWith("y") ? `${n} ${name}` : `${n} ${name}s`);
const funds = (n: number) => n.toLocaleString("en-US");

function list(parts: readonly string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  return `${parts.slice(0, -1).join(", ")} and ${parts[parts.length - 1] ?? ""}`;
}

/** One line per Axis player, saying what that player starts with beyond the map's own setup. */
export function advantageLines(scenario: Scenario, mission: CampaignMission, names: Names): string[] {
  const { advantage } = mission;
  return scenario.setup.players.flatMap((player, id) => {
    if (NATIONS[player.nation].side !== "axis") return [];
    const parts: string[] = [];
    const counts = new Map<UnitTypeId, number>();
    for (const unit of advantage.units ?? []) if (unit.owner === id) counts.set(unit.type, (counts.get(unit.type) ?? 0) + 1);
    const units = [...counts].map(([type, n]) => plural(n, names.unit(type)));
    if (units.length > 0) parts.push(`${list(units)} more`);
    const properties = (advantage.properties ?? []).filter((p) => p.owner === id).length;
    if (properties > 0) parts.push(properties === 1 ? "1 extra property" : `${properties} extra properties`);
    const extra = advantage.funds?.[id] ?? 0;
    if (extra > 0) parts.push(`${funds(extra)} more funds`);
    if ((advantage.incomePercent ?? 0) > 0) parts.push(`${advantage.incomePercent ?? 0}% more income`);
    const commander = mission.commanders[id];
    const lead = commander ? `${player.name}, under ${names.commander(commander)}` : player.name;
    return [parts.length > 0 ? `${lead}: ${list(parts)}.` : `${lead}: as history had it.`];
  });
}
