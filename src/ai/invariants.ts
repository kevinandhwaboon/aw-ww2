// Things that must be true of every GameState, whatever the players do (09-ai §7). The self-play
// harness checks them after every command; a broken one is an engine bug, not an AI bug.
//
// Pure, like the engine: no DOM, no Phaser, no Math.random, no clock.

import { inBounds, stats, terrainAt, CAPTURE_POINTS, MAX_HP, UNITS, type GameState, type Unit, type UnitDef } from "../engine";

const at = (unit: Unit) => `${unit.type} #${unit.id} at ${unit.pos.x},${unit.pos.y}`;

/** Every way this state is impossible, in plain words. Empty for a sound state. */
export function stateProblems(state: GameState): string[] {
  const problems: string[] = [];
  const check = (ok: boolean, problem: string) => {
    if (!ok) problems.push(problem);
  };
  const playerIds = new Set(state.players.map((p) => p.id));

  // Units on the map.
  const tiles = new Set<string>();
  for (const unit of state.units) {
    const key = `${unit.pos.x},${unit.pos.y}`;
    check(!tiles.has(key), `two units on tile ${key}`);
    tiles.add(key);
    check(inBounds(state.map, unit.pos), `${at(unit)} is off the map`);
  }

  // Every unit, passengers included.
  const everyone = state.units.flatMap((u) => [u, ...u.cargo]);
  const ids = new Set<number>();
  for (const unit of everyone) {
    check(!ids.has(unit.id), `two units share id ${unit.id}`);
    ids.add(unit.id);
    check(unit.id < state.nextUnitId, `${at(unit)} has an id the game hasn't handed out yet`);
    check(playerIds.has(unit.owner), `${at(unit)} belongs to unknown player ${unit.owner}`);
    check(Number.isInteger(unit.hp) && unit.hp > 0 && unit.hp <= MAX_HP, `${at(unit)} has ${unit.hp} HP`);
    check(
      Number.isInteger(unit.fuel) && unit.fuel >= 0 && unit.fuel <= stats.maxFuel(state, unit),
      `${at(unit)} has ${unit.fuel} fuel (max ${stats.maxFuel(state, unit)})`,
    );
    check(
      Number.isInteger(unit.ammo) && unit.ammo >= 0 && unit.ammo <= stats.maxAmmo(state, unit),
      `${at(unit)} has ${unit.ammo} ammo (max ${stats.maxAmmo(state, unit)})`,
    );
    check(Number.isInteger(unit.kills) && unit.kills >= 0, `${at(unit)} has ${unit.kills} kills`);
    const transport: UnitDef["transport"] = UNITS[unit.type].transport;
    check(unit.cargo.length <= (transport?.capacity ?? 0), `${at(unit)} carries ${unit.cargo.length} units, over its capacity`);
    for (const passenger of unit.cargo) {
      check(transport?.carries.includes(passenger.type) ?? false, `${at(unit)} carries a ${passenger.type}, which it can't`);
      check(passenger.owner === unit.owner, `${at(unit)} carries another player's ${passenger.type}`);
      check(passenger.cargo.length === 0, `${at(unit)} carries a ${passenger.type} that itself has passengers`);
    }
    check(unit.submerged !== true || UNITS[unit.type].fuelPerDaySubmerged !== null, `${at(unit)} is submerged but can't dive`);
  }

  for (const player of state.players) {
    check(Number.isInteger(player.funds) && player.funds >= 0, `player ${player.id} has ${player.funds} funds`);
  }

  for (const fort of state.fortifications) {
    const where = `${fort.pos.x},${fort.pos.y}`;
    check(fort.hp > 0 && fort.hp <= MAX_HP, `the fortification at ${where} has ${fort.hp} HP`);
    check(/bunker|obstacle/.test(terrainAt(state.map, fort.pos)), `a fortification at ${where} stands on ${terrainAt(state.map, fort.pos)}`);
  }

  for (const property of state.properties) {
    const where = `${property.pos.x},${property.pos.y}`;
    check(property.owner === null || playerIds.has(property.owner), `the property at ${where} belongs to unknown player ${property.owner ?? "?"}`);
    check(
      property.capturePoints > 0 && property.capturePoints <= CAPTURE_POINTS,
      `the property at ${where} has ${property.capturePoints} capture points`,
    );
    if (property.capturingUnit === null) {
      check(property.capturePoints === CAPTURE_POINTS, `the property at ${where} is partly captured with nobody capturing it`);
    } else {
      const capturer = state.units.find((u) => u.id === property.capturingUnit);
      check(
        capturer?.pos.x === property.pos.x && capturer.pos.y === property.pos.y,
        `the property at ${where} is being captured by unit #${property.capturingUnit}, which isn't standing on it`,
      );
      check(capturer?.owner !== property.owner, `the property at ${where} is being captured by its own owner`);
    }
  }

  check(Number.isInteger(state.day) && state.day >= 1, `it is day ${state.day}`);
  check(state.holdStreaks.length === state.victoryConditions.length, "the hold streaks don't match the victory conditions");
  const current = state.players[state.currentPlayer];
  check(current !== undefined, `it is unknown player ${state.currentPlayer}'s turn`);
  if (state.result) {
    check(state.result.winners.length > 0, "the game is over with no winner");
    for (const winner of state.result.winners) {
      check(state.players[winner]?.defeated === false, `player ${winner} both won and was defeated`);
    }
  } else {
    check(current?.defeated !== true, `it is defeated player ${state.currentPlayer}'s turn`);
    const sides = new Set(state.players.filter((p) => !p.defeated).map((p) => p.side));
    check(sides.size >= 2, "only one side is left but the game isn't over");
  }
  return problems;
}
