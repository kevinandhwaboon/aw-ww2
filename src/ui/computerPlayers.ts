// Who the computer plays by default (09-ai §5). No DOM here, so engine-side tests can check it.

import { NATIONS } from "../engine/data/nations";
import type { PlayerSetup } from "../engine/setup";

/**
 * Who the computer plays unless the player says otherwise: everyone not on the first player's side
 * (09-ai §5), so one person plays both Allied players on a map with two of them.
 */
export function defaultComputerPlayers(scenario: { readonly setup: { readonly players: readonly PlayerSetup[] } }): number[] {
  const side = (id: number) => {
    const nation = scenario.setup.players[id]?.nation;
    return nation === undefined ? undefined : NATIONS[nation].side;
  };
  return scenario.setup.players.map((_, id) => id).filter((id) => side(id) !== side(0));
}
