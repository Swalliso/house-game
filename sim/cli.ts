// The headless sim (implementation-plan.md §8): npm run sim -- --help
//
// Plays runs with a bot through the rules' own apply(), in Node, and prints the report. With
// --suggest-targets it sets the milestone targets in src/content/balance.ts from the greedy
// bot's median curve (D-044). The benchmark gate (§4, Performance) checks that one greedy run
// takes under a second on the densest-terrain lot of 50 seeds.

import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import { CONTENT, createRules, type Content, type Rules } from '../src/rules/index.ts';
import { POLICIES, type Policy } from './policies/index.ts';
import { report, suggestTargets, type TargetSuggestion } from './report.ts';
import { simulateRun, type RunRecord } from './simulate.ts';

const HELP = `npm run sim -- [options]

  --runs N            runs per policy (default 200)
  --policy NAME       random | greedy (default greedy)
  --seed PREFIX       seeds are PREFIX-0, PREFIX-1, … (default "sim")
  --suggest-targets   set the 7 milestone targets in src/content/balance.ts from the greedy
                      bot's median curve, then report greedy and random against them
  --bench             only the benchmark gate: one greedy run on the densest of 50 lots < 1 s
  --no-gate           skip the benchmark gate
  --json FILE         also write every run's record as JSON, for spreadsheets
  --help              this text

Same seed and policy always give the same results.`;

const BALANCE_FILE = new URL('../src/content/balance.ts', import.meta.url);
const GATE_MS = 1000;

function runMany(rules: Rules, policy: Policy, runs: number, prefix: string): RunRecord[] {
  const out: RunRecord[] = [];
  for (let i = 0; i < runs; i++) {
    out.push(simulateRun(rules, `${prefix}-${i}`, policy).record);
    if ((i + 1) % 25 === 0) process.stderr.write(`  ${policy.name}: ${i + 1}/${runs}\r`);
  }
  process.stderr.write(' '.repeat(40) + '\r');
  return out;
}

function withTargets(content: Content, targets: readonly number[]): Content {
  return {
    ...content,
    balance: {
      ...content.balance,
      phases: content.balance.phases.map((p, k) => ({ ...p, target: targets[k]! })),
    },
  };
}

/** §4: one greedy run on the densest-terrain lot of 50 seeds, under a second. */
function benchmarkGate(rules: Rules): boolean {
  let densest = '';
  let most = -1;
  for (let i = 0; i < 50; i++) {
    const seed = `bench-${i}`;
    const lot = rules.newRun({ seed, crewId: 'generalContractor', mode: 'standard' }).house.lot;
    const terrain = lot.terrain.filter((t) => t !== null).length;
    if (terrain > most) [densest, most] = [seed, terrain];
  }
  simulateRun(rules, 'bench-warmup', POLICIES.greedy!, { probePhase: null, maxWeeks: 8 });
  const start = performance.now();
  const { record } = simulateRun(rules, densest, POLICIES.greedy!, { probePhase: null });
  const ms = performance.now() - start;
  const ok = ms < GATE_MS;
  console.log(
    `\nBenchmark gate: one greedy run on ${densest} (${most} terrain tiles, the densest of 50), ` +
      `${record.weeks} weeks: ${ms.toFixed(0)} ms — ${ok ? 'PASS' : 'FAIL'} (limit ${GATE_MS} ms)`,
  );
  return ok;
}

function writeTargets(s: TargetSuggestion, runs: number): void {
  const text = readFileSync(BALANCE_FILE, 'utf8');
  const start = text.indexOf('  // sim:targets:start');
  const end = text.indexOf('  // sim:targets:end');
  if (start < 0 || end < 0) throw new Error('balance.ts has lost its sim:targets markers');
  const lines = [
    '  // sim:targets:start',
    `  // From \`npm run sim -- --suggest-targets --runs ${runs}\` (D-072): α × the greedy bot's`,
    `  // median cumulative Wow at each milestone, with α set so greedy's estimated survival`,
    `  // follows ${s.goals.map((g) => `${Math.round(g * 100)}%`).join(', ')}.`,
    '  phases: [',
    ...CONTENT.balance.phases.map(
      (p, k) =>
        `    { name: '${p.name}', target: ${s.targets[k]} }, // median ${Math.round(s.medians[k]!)}, α ${s.alphas[k]!.toFixed(2)}`,
    ),
    '  ],',
  ];
  writeFileSync(BALANCE_FILE, text.slice(0, start) + lines.join('\n') + '\n' + text.slice(end));
}

function main(): number {
  const { values } = parseArgs({
    options: {
      runs: { type: 'string', default: '200' },
      policy: { type: 'string', default: 'greedy' },
      seed: { type: 'string', default: 'sim' },
      'suggest-targets': { type: 'boolean', default: false },
      bench: { type: 'boolean', default: false },
      'no-gate': { type: 'boolean', default: false },
      json: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
  if (values.help) {
    console.log(HELP);
    return 0;
  }
  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1) {
    console.error('--runs needs a whole number ≥ 1');
    return 2;
  }
  const policy = POLICIES[values.policy];
  if (!policy) {
    console.error(`Unknown policy "${values.policy}". Try random or greedy.`);
    return 2;
  }
  const rules = createRules(CONTENT);
  if (values.bench) return benchmarkGate(rules) ? 0 : 1;

  if (values['suggest-targets']) {
    // Untargeted: every target 0, so no run ends early and the median curve is complete.
    const free = createRules(
      withTargets(
        CONTENT,
        CONTENT.balance.phases.map(() => 0),
      ),
    );
    console.log(`Suggesting targets from ${runs} untargeted greedy runs…`);
    const untargeted = runMany(free, POLICIES.greedy!, runs, values.seed);
    const s = suggestTargets(CONTENT, untargeted);
    console.log(
      CONTENT.balance.phases
        .map(
          (p, k) =>
            `  ${k + 1}. ${p.name.padEnd(18)} median ${Math.round(s.medians[k]!).toLocaleString('en-US').padStart(8)}` +
            `  α ${s.alphas[k]!.toFixed(2)}  target ${s.targets[k]!.toLocaleString('en-US').padStart(8)}` +
            `  (est. ${Math.round(s.estimate.survival[k]! * 100)}% get this far; goal ${Math.round(s.goals[k]! * 100)}%)`,
        )
        .join('\n'),
    );
    writeTargets(s, runs);
    console.log('Wrote the targets to src/content/balance.ts.');
    const tuned = createRules(withTargets(CONTENT, s.targets));
    const content = tuned.content;
    console.log(report(content, runMany(tuned, POLICIES.greedy!, runs, values.seed), 'greedy'));
    console.log(report(content, runMany(tuned, POLICIES.random!, runs, values.seed), 'random'));
    return values['no-gate'] || benchmarkGate(tuned) ? 0 : 1;
  }

  const records = runMany(rules, policy, runs, values.seed);
  console.log(report(CONTENT, records, policy.name));
  if (values.json) {
    writeFileSync(values.json, JSON.stringify(records, null, 1));
    console.log(`Wrote ${records.length} run records to ${values.json}.`);
  }
  if (policy.name === 'greedy' && !values['no-gate']) return benchmarkGate(rules) ? 0 : 1;
  return 0;
}

process.exitCode = main();
