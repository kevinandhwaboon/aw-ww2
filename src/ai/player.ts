// The AI interface (09-ai §2–3). An AI is a player: it sees the game and sends the same commands a
// human does, one at a time, through apply(). It has no special access and no rule exceptions.
//
// Like the engine, AI code is pure: no DOM, no Phaser, no Math.random, no clock.

import { apply, legalCommands, type Command, type GameEvent, type GameState, type PlayerId } from "../engine";

/** What an AI is shown on its turn. */
export interface AiView {
  /** The whole game, except that the luck generator is hidden, so luck rolls can't be predicted (09-ai §3). */
  readonly state: GameState;
  /** The player this AI controls; always the current player. */
  readonly me: PlayerId;
  /** Every command the engine would accept right now. */
  legalCommands(): Command[];
}

export interface AiPlayer {
  readonly name: string;
  /** The next command for the current player. Called repeatedly until it returns End Turn. */
  chooseCommand(view: AiView): Command | Promise<Command>;
}

/** The RNG value an AI sees in place of the real one (09-ai §3). */
const HIDDEN_RNG = 0;

export function makeView(state: GameState): AiView {
  const hidden: GameState = { ...state, rng: HIDDEN_RNG };
  return { state: hidden, me: state.currentPlayer, legalCommands: () => legalCommands(hidden) };
}

/** Most commands an AI may send in one turn before the session ends its turn for it (09-ai §3). */
export const COMMAND_LIMIT = 300;

export interface AiStep {
  readonly command: Command;
  readonly state: GameState;
  readonly events: readonly GameEvent[];
  /** Set when the AI misbehaved: it threw, sent a rejected command, or ran past the limit. Its turn was ended instead. */
  readonly bug: string | null;
}

/**
 * Asks the AI for the current player's next command and applies it. `sentThisTurn` counts the
 * commands this AI has already sent this turn. A misbehaving AI never breaks the game: its turn is
 * ended and the problem reported as an AI bug (09-ai §1, §3).
 */
export async function aiStep(state: GameState, ai: AiPlayer, sentThisTurn: number): Promise<AiStep> {
  const endTurn = (bug: string): AiStep => {
    const command: Command = { type: "endTurn" };
    const result = apply(state, command);
    if (!result.ok) throw new Error(`End Turn was rejected (${result.code}): ${result.message}`);
    return { command, state: result.state, events: result.events, bug };
  };
  if (sentThisTurn >= COMMAND_LIMIT) return endTurn(`${ai.name} sent ${COMMAND_LIMIT} commands without ending its turn`);
  let command: Command;
  try {
    command = await ai.chooseCommand(makeView(state));
  } catch (error) {
    return endTurn(`${ai.name} failed: ${error instanceof Error ? error.message : String(error)}`);
  }
  const result = apply(state, command);
  if (!result.ok) return endTurn(`${ai.name} sent a rejected command (${result.code}): ${result.message}`);
  return { command, state: result.state, events: result.events, bug: null };
}

export interface MatchResult {
  readonly state: GameState;
  readonly commands: readonly Command[];
  readonly bugs: readonly string[];
}

/**
 * Plays a game with no screen until it ends or day `lastDay` would start. `players` gives each
 * player's AI by player id. For AI-vs-AI tests and tournaments (09-ai §7).
 */
export async function playMatch(start: GameState, players: readonly AiPlayer[], lastDay: number): Promise<MatchResult> {
  let state = start;
  const commands: Command[] = [];
  const bugs: string[] = [];
  let sent = 0;
  while (!state.result && state.day <= lastDay) {
    const ai = players[state.currentPlayer];
    if (!ai) throw new Error(`No AI for player ${state.currentPlayer}`);
    const step = await aiStep(state, ai, sent);
    commands.push(step.command);
    if (step.bug) bugs.push(`Day ${state.day}, player ${state.currentPlayer}: ${step.bug}`);
    sent = step.command.type === "endTurn" ? 0 : sent + 1;
    state = step.state;
  }
  return { state, commands, bugs };
}
