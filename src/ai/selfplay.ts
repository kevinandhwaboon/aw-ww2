// The self-play harness (09-ai §7): plays whole games with no screen and checks the engine after
// every command. Any problem it finds comes with the seed and the commands that led to it, so the
// game can be replayed exactly and turned into a test.
//
// Pure, like the engine: no DOM, no Phaser, no Math.random, no clock.

import { apply, legalCommands, loadGame, saveGame, type Command, type GameState, type PlayerId } from "../engine";
import { nextInt, seedRng } from "../engine/rng";
import { stateProblems } from "./invariants";
import { aiStep, type AiPlayer } from "./player";

/** An AI that picks any legal command at random. Its own seed decides its choices, so games replay. */
export function randomAi(seed: number): AiPlayer {
  let rng = seedRng(seed);
  return {
    name: "Random",
    chooseCommand(view) {
      const commands = view.legalCommands();
      const roll = nextInt(rng, 0, commands.length - 1);
      rng = roll.rng;
      return commands[roll.value] ?? { type: "endTurn" };
    },
  };
}

export type SelfPlayProblemKind =
  /** The AI threw, sent a rejected command or never ended its turn. */
  | "aiBug"
  /** The engine threw instead of answering. */
  | "crash"
  /** The state after the command is impossible (see invariants.ts). */
  | "invariant"
  /** The state changed when saved and loaded again. */
  | "save"
  /** A command the engine listed as legal was rejected, or made it throw. */
  | "legal";

export interface SelfPlayProblem {
  readonly kind: SelfPlayProblemKind;
  /** How many commands had been applied before the one that went wrong. */
  readonly commandIndex: number;
  readonly day: number;
  readonly player: PlayerId;
  readonly text: string;
}

export interface SelfPlayOptions {
  /** At the start of every turn, also try every command the engine lists as legal. Slower. */
  readonly checkLegal?: boolean;
}

export interface SelfPlayReport {
  readonly state: GameState;
  readonly commands: readonly Command[];
  /** Empty for a clean game. An engine problem stops the game; AI bugs don't. */
  readonly problems: readonly SelfPlayProblem[];
}

function sameData(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (typeof a !== "object" || typeof b !== "object" || a === null || b === null) return false;
  if (Array.isArray(a) !== Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  const keys = Object.keys(left);
  return keys.length === Object.keys(right).length && keys.every((key) => key in right && sameData(left[key], right[key]));
}

const describeError = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Every legal command that the engine then refuses or chokes on. */
function legalProblems(state: GameState): string[] {
  const problems: string[] = [];
  for (const command of legalCommands(state)) {
    try {
      const result = apply(state, command);
      if (!result.ok) problems.push(`legal command ${JSON.stringify(command)} was rejected (${result.code}): ${result.message}`);
    } catch (error) {
      problems.push(`legal command ${JSON.stringify(command)} crashed the engine: ${describeError(error)}`);
    }
  }
  return problems;
}

/**
 * Plays a game until it ends or day `lastDay` would start, like playMatch, checking the engine as
 * it goes. `players` gives each player's AI by player id.
 */
export async function selfPlay(
  start: GameState,
  players: readonly AiPlayer[],
  lastDay: number,
  options: SelfPlayOptions = {},
): Promise<SelfPlayReport> {
  let state = start;
  const commands: Command[] = [];
  const problems: SelfPlayProblem[] = [];
  let sent = 0;
  let turnStart = true;
  const report = (kind: SelfPlayProblemKind, texts: readonly string[]) => {
    for (const text of texts) problems.push({ kind, commandIndex: commands.length, day: state.day, player: state.currentPlayer, text });
  };
  const broken = () => problems.some((p) => p.kind !== "aiBug");

  report("invariant", stateProblems(state));
  while (!broken() && !state.result && state.day <= lastDay) {
    const ai = players[state.currentPlayer];
    if (!ai) throw new Error(`No AI for player ${state.currentPlayer}`);
    if (turnStart) {
      const saved = loadGame(saveGame(state));
      if (!sameData(saved, state)) report("save", ["the game is not the same after saving and loading"]);
      if (options.checkLegal) report("legal", legalProblems(state));
      if (broken()) break;
    }
    let step;
    try {
      step = await aiStep(state, ai, sent);
    } catch (error) {
      report("crash", [describeError(error)]);
      break;
    }
    if (step.bug) report("aiBug", [step.bug]);
    report("invariant", stateProblems(step.state));
    commands.push(step.command);
    turnStart = step.command.type === "endTurn";
    sent = turnStart ? 0 : sent + 1;
    state = step.state;
  }
  return { state, commands, problems };
}
