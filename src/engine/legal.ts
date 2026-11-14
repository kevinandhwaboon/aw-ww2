// Every command the current player could send right now (09-ai §2). AIs choose from this list, and
// the random-playthrough tests send random picks from it, so "listed" must always mean "accepted".
//
// It's representative rather than exhaustive in one way: an Unload lists each passenger and tile on
// its own, not every pairing of two passengers in one action (05-supply-transport §6, D3).
// Carrier launches are listed since 2026-11-13 (05-supply-transport §10).

import { attackTargets, fortTargets } from "./combat";
import type { Command } from "./commands";
import { buildOptions, buildProblem, captureProblem } from "./economy";
import { canEndOn, cheapestPath, reachableTiles, tilePoint } from "./movement";
import type { GameState, Unit } from "./state";
import { diveProblem, surfaceProblem } from "./submarine";
import { isHiddenFrom } from "./visibility";
import { joinProblem, launchable, launchProblem, launchState, loadProblem, supplyTargets, unloadTiles } from "./transport";

type MoveCommand = Extract<Command, { type: "move" }>;

/** Every legal command for the current player, ending with End Turn. Empty once the game is over. */
export function legalCommands(state: GameState): Command[] {
  if (state.result) return [];
  const commands: Command[] = [];
  for (const unit of state.units) {
    if (unit.owner !== state.currentPlayer) continue;
    if (!unit.hasActed) commands.push(...unitCommands(state, unit));
    commands.push(...launchCommands(state, unit));
  }
  commands.push(...buildCommands(state));
  commands.push({ type: "endTurn" });
  return commands;
}

/** Every legal move-and-act command for one ready unit of the current player, by cheapest path. */
export function unitCommands(state: GameState, unit: Unit): Command[] {
  if (state.result || unit.owner !== state.currentPlayer || unit.hasActed) return [];
  const commands: Command[] = [];
  const reach = reachableTiles(state, unit);
  const move = (path: MoveCommand["path"], action: MoveCommand["action"]) => commands.push({ type: "move", unitId: unit.id, path, action });

  for (const i of reach.keys()) {
    const dest = tilePoint(state, i);
    const path = cheapestPath(state, reach, dest) ?? [];
    const moved: Unit = { ...unit, pos: dest };
    if (!canEndOn(state, unit, dest)) {
      const host = state.units.find((u) => u.pos.x === dest.x && u.pos.y === dest.y);
      if (host && loadProblem(state, moved, host) === null) move(path, { type: "load" });
      if (host && joinProblem(moved, host) === null) move(path, { type: "join" });
      continue;
    }
    const afterMove: GameState = { ...state, units: state.units.map((u) => (u.id === unit.id ? moved : u)) };
    const moving = path.length > 0;
    move(path, { type: "wait" });
    for (const target of attackTargets(afterMove, moved, moving)) {
      // Only what the player could see when giving the order (05-supply-transport §9).
      if (!isHiddenFrom(state, target, unit.owner)) move(path, { type: "attack", target: target.id });
    }
    for (const target of fortTargets(afterMove, moved, moving)) move(path, { type: "attackFort", target });
    if (captureProblem(afterMove, moved) === null) move(path, { type: "capture" });
    if (supplyTargets(afterMove, moved).length > 0) move(path, { type: "supply" });
    for (const passenger of moved.cargo) {
      for (const to of unloadTiles(afterMove, moved, passenger)) move(path, { type: "unload", passenger: passenger.id, to });
    }
    if (diveProblem(moved) === null) move(path, { type: "dive" });
    if (surfaceProblem(moved) === null) move(path, { type: "surface" });
  }
  return commands;
}

/**
 * Every legal launch from this Carrier (05-supply-transport §10): each aircraft aboard that can take
 * off, with every move-and-act command it would have from the Carrier's tile, except staying there.
 */
export function launchCommands(state: GameState, carrier: Unit): Command[] {
  if (state.result || carrier.owner !== state.currentPlayer) return [];
  const commands: Command[] = [];
  for (const aircraft of launchable(carrier)) {
    if (launchProblem(state, carrier, aircraft.id) !== null) continue;
    const out = launchState(state, carrier.id, aircraft.id);
    const flying = out?.units.find((u) => u.id === aircraft.id);
    if (!out || !flying) continue;
    for (const command of unitCommands(out, flying)) {
      if (command.type !== "move" || command.path.length === 0) continue;
      commands.push({ type: "launch", carrierId: carrier.id, unitId: aircraft.id, path: command.path, action: command.action });
    }
  }
  return commands;
}

/** Every affordable unit the current player could build, on every free production property. */
export function buildCommands(state: GameState): Command[] {
  const commands: Command[] = [];
  for (const property of state.properties) {
    for (const option of buildOptions(state, property.pos)) {
      if (buildProblem(state, option.type, property.pos) === null) {
        commands.push({ type: "build", unitType: option.type, pos: property.pos });
      }
    }
  }
  return commands;
}
