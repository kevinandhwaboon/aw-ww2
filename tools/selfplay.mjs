// Batch self-play (09-ai §7): plays many AI games with no screen, checks the engine after every
// command, and prints what happened. Every problem is saved as a file that replays the game.
//
//   npm run selfplay                                   every map, seeds 1-3, Greedy vs Greedy, 30 days
//   npm run selfplay -- --maps midway,kursk --seeds 1-20 --days 40
//   npm run selfplay -- --players random --deep        random legal play, trying every legal command each turn
//   npm run selfplay -- --commanders                   every player under a commander of their side, picked by seed (06-commanders)
//   npm run selfplay -- --fog                          with fog of war on (19-fog-of-war)
//   npm run selfplay -- --campaign                     the campaign missions (22-campaign §5): the Allies as --players,
//                                                      the Axis as the campaign's computer, with its advantage and map AI
//   npm run selfplay -- --standing --days 20           also say which side is ahead when the games stop (22-campaign §5b):
//                                                      the winner, or the higher army value + funds + 5 days' income
//
// Exits with 1 if any game had a problem, so a script or an agent can loop on it.

import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { parseArgs } from "node:util";
import { createServer } from "vite";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const failuresDir = join(root, "selfplay-failures");

const { values: args } = parseArgs({
  options: {
    maps: { type: "string", default: "all" },
    seeds: { type: "string", default: "1-3" },
    days: { type: "string", default: "30" },
    players: { type: "string", default: "greedy" },
    deep: { type: "boolean", default: false },
    commanders: { type: "boolean", default: false },
    fog: { type: "boolean", default: false },
    campaign: { type: "boolean", default: false },
    standing: { type: "boolean", default: false },
  },
});

function seedList(text) {
  const range = /^(\d+)-(\d+)$/.exec(text);
  if (range) return Array.from({ length: Number(range[2]) - Number(range[1]) + 1 }, (_, i) => Number(range[1]) + i);
  return text.split(",").map(Number);
}

const lastDay = Number(args.days);
const seeds = seedList(args.seeds);
if (!Number.isInteger(lastDay) || lastDay < 1 || seeds.length === 0 || seeds.some((s) => !Number.isInteger(s))) {
  console.error("Usage: npm run selfplay -- [--maps a,b] [--seeds 1-5 | 1,4,9] [--days 30] [--players greedy|easy|random] [--deep] [--commanders] [--fog] [--campaign] [--standing]");
  process.exit(2);
}

// Vite loads the TypeScript sources the same way the tests do; nothing is built or served.
const server = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false } });
let failed = 0;
try {
  const { SCENARIOS: SKIRMISH, SURVIVAL_SCENARIOS } = await server.ssrLoadModule("/src/scenarios/index.ts");
  // The survival maps are played too (23-survival §8); their report adds the waves reached.
  const SCENARIOS = [...SKIRMISH, ...SURVIVAL_SCENARIOS];
  const { createGame, COMMANDER_IDS, COMMANDERS, NATIONS } = await server.ssrLoadModule("/src/engine/index.ts");
  // With --commanders, each player gets a commander of their own side; the seed and seat decide which.
  const withCommanders = (setup, seed) => ({
    ...setup,
    players: setup.players.map((p, i) => {
      const own = COMMANDER_IDS.filter((id) => NATIONS[COMMANDERS[id].nation].side === NATIONS[p.nation].side);
      return { ...p, commander: own[(seed + i) % own.length] };
    }),
  });
  const { selfPlay, randomAi } = await server.ssrLoadModule("/src/ai/selfplay.ts");
  const { greedyAi } = await server.ssrLoadModule("/src/ai/greedy.ts");
  const { weightsFor } = await server.ssrLoadModule("/src/ai/weights.ts");
  const { MISSIONS } = await server.ssrLoadModule("/src/campaign/missions.ts");
  const { missionScenario, axisPlayers } = await server.ssrLoadModule("/src/campaign/setup.ts");
  const { campaignAi, survivalAi, survivalDefenderAi } = await server.ssrLoadModule("/src/ai/maps/index.ts");
  const { SURVIVAL_MAPS } = await server.ssrLoadModule("/src/survival/maps.ts");
  const { sideAhead } = await server.ssrLoadModule("/src/ai/standing.ts");

  const makeAi = { greedy: () => greedyAi(), easy: () => greedyAi(weightsFor("easy")), random: (seed, id) => randomAi(seed * 100 + id) }[args.players];
  if (!makeAi) throw new Error(`Unknown --players ${args.players}: use greedy, easy or random`);
  const picked = args.maps === "all" ? SCENARIOS : args.maps.split(",").map((id) => {
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) throw new Error(`Unknown map ${id}: use ${SCENARIOS.map((s) => s.id).join(", ")}`);
    return scenario;
  });
  // With --campaign, each map is played as its campaign mission, in campaign order.
  const scenarios = args.campaign
    ? MISSIONS.flatMap((m) => picked.filter((s) => s.id === m.map).map((s) => missionScenario(s, m)))
    : picked;

  rmSync(failuresDir, { recursive: true, force: true });
  console.log(`${args.players} vs ${args.campaign ? "the campaign's computer" : args.players}, ${seeds.length} seed(s), up to day ${lastDay}${args.commanders ? ", with commanders" : ""}${args.fog ? ", fog of war" : ""}${args.deep ? ", trying every legal command each turn" : ""}\n`);
  for (const scenario of scenarios) {
    const wins = new Map();
    const ahead = new Map();
    const endDays = [];
    const wavesReached = [];
    let commands = 0;
    let problems = 0;
    const t0 = performance.now();
    for (const seed of seeds) {
      const setup = args.commanders ? withCommanders(scenario.setup, seed) : scenario.setup;
      const start = createGame({ ...setup, seed, ...(args.fog ? { settings: { ...setup.settings, fogOfWar: true } } : {}) });
      const axis = args.campaign ? axisPlayers(scenario) : [];
      // On a survival map the waves always play the survival plan, as in the game (23-survival §6).
      // The defender, when it's Greedy, keeps its HQ with the survival defence plan.
      const survivalMap = SURVIVAL_MAPS.find((m) => m.map === scenario.id);
      const ais = start.players.map((p) => {
        if (axis.includes(p.id)) return campaignAi(scenario.id);
        if (p.id === survivalMap?.attacker) return survivalAi();
        if (p.id === survivalMap?.defender && args.players === "greedy") return survivalDefenderAi();
        return makeAi(seed, p.id);
      });
      const report = await selfPlay(start, ais, lastDay, { checkLegal: args.deep });
      commands += report.commands.length;
      ahead.set(sideAhead(report.state), (ahead.get(sideAhead(report.state)) ?? 0) + 1);
      if (report.state.waveGenerator) wavesReached.push(report.state.wave);
      if (report.state.result) {
        endDays.push(report.state.day);
        const side = report.state.result.winningSide;
        wins.set(side, (wins.get(side) ?? 0) + 1);
      }
      if (report.problems.length > 0) {
        problems++;
        failed++;
        mkdirSync(failuresDir, { recursive: true });
        const file = join(failuresDir, `${scenario.id}-${args.players}-seed${seed}.json`);
        writeFileSync(file, JSON.stringify({ map: scenario.id, campaign: args.campaign, seed, players: args.players, commanders: args.commanders ? start.players.map((p) => p.commander) : null, fog: args.fog, lastDay, problems: report.problems, commands: report.commands }, null, 1));
        const first = report.problems[0];
        console.log(`  PROBLEM ${scenario.id} seed ${seed}: [${first.kind}] day ${first.day}, player ${first.player}, command ${first.commandIndex}: ${first.text}`);
        if (report.problems.length > 1) console.log(`    and ${report.problems.length - 1} more, in ${file}`);
      }
    }
    const seconds = ((performance.now() - t0) / 1000).toFixed(1);
    const won = [...wins].map(([side, n]) => `${side} ${n}`).join(", ") || "none";
    const days = endDays.length ? `, ending day ${Math.min(...endDays)}-${Math.max(...endDays)}` : "";
    const waveText = wavesReached.length ? `; waves reached ${Math.min(...wavesReached)}-${Math.max(...wavesReached)}` : "";
    const standingText = args.standing ? `; ahead at the end: ${[...ahead].map(([side, n]) => `${side} ${n}`).join(", ")}` : "";
    console.log(`${scenario.id.padEnd(12)} ${endDays.length}/${seeds.length} games ended (wins: ${won}${days})${waveText}${standingText}; ${commands} commands, ${problems} with problems, ${seconds}s`);
  }
} finally {
  await server.close();
}
console.log(failed === 0 ? "\nNo problems found." : `\n${failed} game(s) had problems. Replay files are in selfplay-failures/.`);
process.exit(failed === 0 ? 0 : 1);
