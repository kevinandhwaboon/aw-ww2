// Batch self-play (09-ai §7): plays many AI games with no screen, checks the engine after every
// command, and prints what happened. Every problem is saved as a file that replays the game.
//
//   npm run selfplay                                   every map, seeds 1-3, Greedy vs Greedy, 30 days
//   npm run selfplay -- --maps midway,kursk --seeds 1-20 --days 40
//   npm run selfplay -- --players random --deep        random legal play, trying every legal command each turn
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
  console.error("Usage: npm run selfplay -- [--maps a,b] [--seeds 1-5 | 1,4,9] [--days 30] [--players greedy|easy|random] [--deep]");
  process.exit(2);
}

// Vite loads the TypeScript sources the same way the tests do; nothing is built or served.
const server = await createServer({ root, logLevel: "error", appType: "custom", server: { middlewareMode: true, hmr: false, ws: false } });
let failed = 0;
try {
  const { SCENARIOS } = await server.ssrLoadModule("/src/scenarios/index.ts");
  const { createGame } = await server.ssrLoadModule("/src/engine/index.ts");
  const { selfPlay, randomAi } = await server.ssrLoadModule("/src/ai/selfplay.ts");
  const { greedyAi } = await server.ssrLoadModule("/src/ai/greedy.ts");
  const { weightsFor } = await server.ssrLoadModule("/src/ai/weights.ts");

  const makeAi = { greedy: () => greedyAi(), easy: () => greedyAi(weightsFor("easy")), random: (seed, id) => randomAi(seed * 100 + id) }[args.players];
  if (!makeAi) throw new Error(`Unknown --players ${args.players}: use greedy, easy or random`);
  const scenarios = args.maps === "all" ? SCENARIOS : args.maps.split(",").map((id) => {
    const scenario = SCENARIOS.find((s) => s.id === id);
    if (!scenario) throw new Error(`Unknown map ${id}: use ${SCENARIOS.map((s) => s.id).join(", ")}`);
    return scenario;
  });

  rmSync(failuresDir, { recursive: true, force: true });
  console.log(`${args.players} vs ${args.players}, ${seeds.length} seed(s), up to day ${lastDay}${args.deep ? ", trying every legal command each turn" : ""}\n`);
  for (const scenario of scenarios) {
    const wins = new Map();
    const endDays = [];
    let commands = 0;
    let problems = 0;
    const t0 = performance.now();
    for (const seed of seeds) {
      const start = createGame({ ...scenario.setup, seed });
      const report = await selfPlay(start, start.players.map((p) => makeAi(seed, p.id)), lastDay, { checkLegal: args.deep });
      commands += report.commands.length;
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
        writeFileSync(file, JSON.stringify({ map: scenario.id, seed, players: args.players, lastDay, problems: report.problems, commands: report.commands }, null, 1));
        const first = report.problems[0];
        console.log(`  PROBLEM ${scenario.id} seed ${seed}: [${first.kind}] day ${first.day}, player ${first.player}, command ${first.commandIndex}: ${first.text}`);
        if (report.problems.length > 1) console.log(`    and ${report.problems.length - 1} more, in ${file}`);
      }
    }
    const seconds = ((performance.now() - t0) / 1000).toFixed(1);
    const won = [...wins].map(([side, n]) => `${side} ${n}`).join(", ") || "none";
    const days = endDays.length ? `, ending day ${Math.min(...endDays)}-${Math.max(...endDays)}` : "";
    console.log(`${scenario.id.padEnd(12)} ${endDays.length}/${seeds.length} games ended (wins: ${won}${days}); ${commands} commands, ${problems} with problems, ${seconds}s`);
  }
} finally {
  await server.close();
}
console.log(failed === 0 ? "\nNo problems found." : `\n${failed} game(s) had problems. Replay files are in selfplay-failures/.`);
process.exit(failed === 0 ? 0 : 1);
