// A campaign mission as a game to start (22-campaign §3, §4): the map's scenario with the computer's
// advantage added. Pure: no DOM, so the tests and the self-play tool use it as the game does.

import { COMMANDERS } from "../engine/data/commanders";
import { NATIONS } from "../engine/data/nations";
import type { Modifier } from "../engine/modifiers";
import type { Scenario } from "../engine/scenario";
import { terrainAt } from "../engine/map";
import { createGame } from "../engine/setup";
import { unitAt, type GameState } from "../engine/state";
import * as stats from "../engine/stats";
import type { CampaignMission } from "./missions";

const samePoint = (a: { x: number; y: number }, b: { x: number; y: number }) => a.x === b.x && a.y === b.y;

/** The player ids on the Axis side, which the computer always plays in the campaign (22-campaign §3). */
export function axisPlayers(scenario: Scenario): number[] {
  return scenario.setup.players.flatMap((p, id) => (NATIONS[p.nation].side === "axis" ? [id] : []));
}

/**
 * The mission's scenario: the map's own setup, plus the computer's extra units, properties, funds,
 * income and commanders (22-campaign §4). The map, the victory conditions and the Allies' forces
 * are untouched. Throws, naming the mission, if the advantage gives anything to an Allied player
 * or puts something where the game can't start with it.
 */
export function missionScenario(scenario: Scenario, mission: CampaignMission): Scenario {
  const where = `campaign mission ${mission.map}`;
  if (scenario.id !== mission.map) throw new Error(`${where}: played on ${mission.map}, not ${scenario.id}`);
  const axis = axisPlayers(scenario);
  const { advantage } = mission;
  const owners = [
    ...(advantage.units ?? []).map((u) => u.owner),
    ...(advantage.properties ?? []).map((p) => p.owner),
    ...Object.keys(advantage.funds ?? {}).map(Number),
    ...Object.keys(mission.commanders).map(Number),
  ];
  const notAxis = owners.find((id) => !axis.includes(id));
  if (notAxis !== undefined) throw new Error(`${where}: player ${notAxis} isn't on the Axis side`);
  for (const [id, commander] of Object.entries(mission.commanders)) {
    const nation = scenario.setup.players[Number(id)]?.nation;
    if (nation && NATIONS[COMMANDERS[commander].nation].side !== NATIONS[nation].side) throw new Error(`${where}: ${commander} can't command player ${id}`);
  }
  // Only unit types the nation fielded on this map: ones it can build here or already has (00-master-design §6).
  for (const extra of advantage.units ?? []) {
    const fielded = new Set([
      ...(scenario.setup.players[extra.owner]?.buildable ?? []),
      ...(scenario.setup.units ?? []).filter((u) => u.owner === extra.owner).flatMap((u) => [u.type, ...(u.cargo ?? []).map((c) => c.type)]),
    ]);
    const odd = [extra.type, ...(extra.cargo ?? []).map((c) => c.type)].find((type) => !fielded.has(type));
    if (odd) throw new Error(`${where}: player ${extra.owner} doesn't field a ${odd} on this map`);
  }

  const { setup } = scenario;
  const players = setup.players.map((player, id) => {
    const commander = mission.commanders[id];
    const extra = advantage.funds?.[id] ?? 0;
    return { ...player, funds: (player.funds ?? 0) + extra, ...(commander ? { commander } : {}) };
  });
  const taken = advantage.properties ?? [];
  const propertyOwners = [...(setup.propertyOwners ?? []).filter((p) => !taken.some((t) => samePoint(t.pos, p.pos))), ...taken];
  const income: Modifier[] =
    advantage.incomePercent === undefined || advantage.incomePercent === 0
      ? []
      : [{ source: "campaign:income", stat: "income", op: "multiply", value: 1 + advantage.incomePercent / 100, scope: { players: axis } }];
  const missionSetup = {
    ...setup,
    players,
    propertyOwners,
    units: [...(setup.units ?? []), ...(advantage.units ?? [])],
    modifiers: [...(setup.modifiers ?? []), ...income],
  };
  // createGame checks every unit and property; a mission that can't start fails here, by name.
  let game: GameState;
  try {
    game = createGame({ ...missionSetup, seed: 1 });
  } catch (error) {
    throw new Error(`${where}: ${error instanceof Error ? error.message : String(error)}`, { cause: error });
  }
  // The engine leaves it to scenarios to put units only where they can stand; the campaign checks its own.
  for (const extra of advantage.units ?? []) {
    const unit = unitAt(game, extra.pos);
    if (!unit || stats.moveCost(game, unit, terrainAt(game.map, extra.pos)) === null) {
      throw new Error(`${where}: a ${extra.type} can't stand at (${extra.pos.x}, ${extra.pos.y})`);
    }
  }
  return { ...scenario, setup: missionSetup };
}
