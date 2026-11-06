// The headless sim (implementation-plan.md §8, D-044, D-089): npm run sim -- --help
//
// Plays runs with a bot through the rules' own apply(), in Node, and prints the report. Modes:
// - the default: one bot on seeds PREFIX-0, PREFIX-1, … and its report;
// - --check: §8's starting criteria, from greedy, random, novice, and greedy completing early
//   whenever it can, all on the same held-out seeds (check-*, never the sim-* seeds the target
//   fit uses), then greedy's report;
// - --ban and --gift: a paired A/B on the same seeds, for questions like "is this good a
//   must-buy?". A ban takes the good off the shelves; a gift hands it over at a shop, against a
//   placebo (a debug action that changes nothing) at the same moment, so both arms take the
//   same number of actions and the bot's streams stay in step;
// - --suggest-targets: sets the milestone targets in src/content/balance.ts from untargeted
//   greedy runs (D-044, D-072), then runs --check's bots against them on held-out seeds, next
//   to what the fit estimated;
// - --bench: the benchmark gate (§4, Performance): one greedy run on the densest-terrain lot of
//   50 seeds takes under a second. It also runs after any greedy report, unless --no-gate.
// A run that throws (a SimError: a bot error, an illegal action, or a step cap) is printed with
// its run code and left out of the reports; the others go on, and the exit code is 1.

import { readFileSync, writeFileSync } from 'node:fs';
import { performance } from 'node:perf_hooks';
import { parseArgs } from 'node:util';
import {
  CONTENT,
  createRules,
  type Action,
  type Content,
  type Good,
  type Rng,
  type Rules,
  type RunState,
  type ServiceId,
} from '../src/rules/index.ts';
import {
  makeGreedy,
  POLICIES,
  type EarlyMode,
  type GreedyOptions,
  type Policy,
  type StrikeMode,
} from './policies/index.ts';
import {
  criteriaReport,
  fmtRate,
  percentile,
  report,
  suggestTargets,
  type TargetSuggestion,
} from './report.ts';
import { SimError, simulateRun, type RunRecord } from './simulate.ts';

const HELP = `npm run sim -- [options]

  --runs N            runs per bot, or per arm of an A/B (default 200)
  --seed PREFIX       seeds are PREFIX-0, PREFIX-1, … (default "sim"; "check" for --check
                      and --suggest-targets)
  --policy NAME       random | novice | greedy (default greedy)
  --early MODE        greedy completes milestones early: never (default) | always |
                      last (only when that saves exactly one week)
  --strikes MODE      greedy buys the strike service: none (default) | fixed (Driveway,
                      Fence, Hallway, Doghouse, then Sapling, as the M3 bot did)

One of these modes, or none:
  --check             §8's starting criteria on held-out seeds: greedy, random, novice, and
                      greedy with --early always, on the same seeds; then greedy's report
  --ban KIND:ID       paired A/B: the same seeds with the good on offer and without it.
                      Repeatable. KIND: blueprint, tool, upgrade, crate, or service (a
                      service is priced out of reach). Example: --ban blueprint:fengShui
  --gift KIND:ID      paired A/B: the good given free at a shop, against a placebo at the
                      same moment. KIND: blueprint, piece, fixture, tool, or upgrade
  --gift-shop K       the shop --gift gives it at, 1–6 (default 1)
  --suggest-targets   set the 7 milestone targets in src/content/balance.ts from untargeted
                      greedy runs on --fit-seed, then run --check's bots against them on
                      --seed, next to what the fit estimated
  --fit-seed PREFIX   the seeds the fit uses (default "sim"); must differ from --seed
  --dry-run           with --suggest-targets: print the targets and the check, write nothing
  --bench             only the benchmark gate: one greedy run on the densest of 50 lots < 1 s

  --no-gate           skip the benchmark gate after greedy's report
  --json FILE         also write every run's record as JSON: an array, or an object of
                      arrays by arm for --check, --ban, --gift, and --suggest-targets
  --help              this text

The same seeds and options always give the same results. Exit code 1: a run failed (its
run code is printed; open it with ?run=) or the benchmark gate failed. 2: bad options.
--check's verdicts are printed, and never change the exit code.`;

const BALANCE_FILE = new URL('../src/content/balance.ts', import.meta.url);
const GATE_MS = 1000;
const EARLY_MODES: readonly EarlyMode[] = ['never', 'always', 'last'];
const STRIKE_MODES: readonly StrikeMode[] = ['none', 'fixed'];
const SERVICES: readonly ServiceId[] = ['reroll', 'demolition', 'strike'];
const BAN_KINDS = ['blueprint', 'tool', 'upgrade', 'crate', 'service'] as const;
const GIFT_KINDS = ['blueprint', 'piece', 'fixture', 'tool', 'upgrade'] as const;
/** A price no run can reach: a banned service stays on the shelf but is never bought. */
const OUT_OF_REACH = 999;
/** Failed runs printed in full; the rest are counted. */
const FAILURES_SHOWN = 5;

/** A bad command line: printed with a pointer to --help, exit code 2. */
class UsageError extends Error {}

interface Failure {
  arm: string;
  seed: string;
  message: string;
  runCode: string | null;
}

/** One run's result, for arms that look at more than the record. */
type RunResult = ReturnType<typeof simulateRun>;

const seedsFor = (prefix: string, runs: number) =>
  Array.from({ length: runs }, (_, i) => `${prefix}-${i}`);
const seedRange = (seeds: readonly string[]) =>
  seeds.length === 1 ? seeds[0]! : `${seeds[0]}…${seeds.at(-1)}`;

/**
 * Plays every seed with a fresh policy from `make` (the gift arms keep per-run state). A run
 * that throws is added to `failures` and skipped, so one bad seed doesn't lose the report.
 */
function runMany(
  rules: Rules,
  seeds: readonly string[],
  make: () => Policy,
  arm: string,
  failures: Failure[],
  onRun?: (result: RunResult, policy: Policy) => void,
): RunRecord[] {
  const out: RunRecord[] = [];
  const tty = process.stderr.isTTY === true;
  seeds.forEach((seed, i) => {
    const policy = make();
    try {
      const result = simulateRun(rules, seed, policy);
      out.push(result.record);
      onRun?.(result, policy);
    } catch (e) {
      failures.push(
        e instanceof SimError
          ? { arm, seed, message: e.message, runCode: e.runCode }
          : { arm, seed, message: e instanceof Error ? e.message : String(e), runCode: null },
      );
    }
    if (tty && (i + 1) % 25 === 0) process.stderr.write(`  ${arm}: ${i + 1}/${seeds.length}\r`);
  });
  if (tty) process.stderr.write(' '.repeat(40) + '\r');
  return out;
}

function printFailures(failures: readonly Failure[]): void {
  if (failures.length === 0) return;
  console.error(
    `\n${failures.length} run${failures.length === 1 ? '' : 's'} failed and ` +
      `${failures.length === 1 ? 'is' : 'are'} left out of the reports:`,
  );
  for (const f of failures.slice(0, FAILURES_SHOWN)) {
    console.error(`  [${f.arm}] ${f.message}`);
    if (f.runCode) console.error(`    run code: ${f.runCode}`);
  }
  if (failures.length > FAILURES_SHOWN) {
    console.error(`  … and ${failures.length - FAILURES_SHOWN} more`);
  }
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

// ---------------------------------------------------------------------------------------
// Goods named on the command line: kind:id, checked against the content.

type BanKind = (typeof BAN_KINDS)[number];
interface Named<K extends string> {
  kind: K;
  id: string;
}

const TABLES = {
  blueprint: (c: Content) => c.blueprints,
  piece: (c: Content) => c.pieces,
  fixture: (c: Content) => c.fixtures,
  tool: (c: Content) => c.tools,
  upgrade: (c: Content) => c.upgrades,
  crate: (c: Content) => c.crates,
  service: () => Object.fromEntries(SERVICES.map((s) => [s, true])),
} as const;

function parseGood<K extends string>(
  flag: string,
  text: string,
  kinds: readonly K[],
  content: Content,
  why: string,
): Named<K> {
  const [kind, id, ...rest] = text.split(':');
  if (!kind || !id || rest.length > 0) {
    throw new UsageError(`${flag} takes KIND:ID, like blueprint:fengShui (got "${text}").`);
  }
  if (!(kinds as readonly string[]).includes(kind)) {
    throw new UsageError(`${flag} takes ${kinds.join(', ')} (got "${kind}"). ${why}`);
  }
  const table = TABLES[kind as keyof typeof TABLES](content);
  if (!Object.hasOwn(table, id)) {
    const ids = Object.keys(table).join(', ');
    throw new UsageError(`There's no ${kind} "${id}". ${kind} ids: ${ids}.`);
  }
  return { kind: kind as K, id };
}

/**
 * The content with these goods off the shelves. Blueprints and tools are marked not offered,
 * which also keeps them out of the Housewarming crate, crates, and the Old Shed. Upgrades and
 * crates are only ever sold, so they're removed. A service stays on the shelf at a price no
 * run can reach.
 */
function withBans(content: Content, bans: readonly Named<BanKind>[]): Content {
  let c = content;
  for (const { kind, id } of bans) {
    if (kind === 'blueprint') {
      const def = c.blueprints[id as keyof Content['blueprints']];
      c = { ...c, blueprints: { ...c.blueprints, [id]: { ...def, offered: false } } };
    } else if (kind === 'tool') {
      const def = c.tools[id as keyof Content['tools']];
      c = { ...c, tools: { ...c.tools, [id]: { ...def, offered: false } } };
    } else if (kind === 'upgrade') {
      const { [id]: _, ...rest } = c.upgrades as Record<string, unknown>;
      c = { ...c, upgrades: rest as Content['upgrades'] };
    } else if (kind === 'crate') {
      const { [id]: _, ...rest } = c.crates as Record<string, unknown>;
      c = { ...c, crates: rest as Content['crates'] };
    } else {
      const shop = c.balance.shop;
      const price = { base: OUT_OF_REACH, step: 0, max: OUT_OF_REACH };
      c = {
        ...c,
        balance: { ...c.balance, shop: { ...shop, services: { ...shop.services, [id]: price } } },
      };
    }
  }
  return c;
}

const PLACEBO: Action = { t: 'debug', op: 'addBudget', amount: 0 };

interface GiftPolicy extends Policy {
  /** Whether the gift went in (false: the run ended first, or there was no room for it). */
  given(): boolean;
}

/**
 * The bot, but at shop `shop`, once no crate is open, it first takes the gift (or, with no
 * gift or no room for it, the placebo). The arms match action for action until then, so the
 * step-keyed bot streams line up.
 */
function withGift(base: Policy, good: Good | null, shop: number): GiftPolicy {
  let done = false;
  let given = false;
  return {
    name: base.name,
    label: base.label ?? base.name,
    given: () => given,
    act(rules: Rules, s: RunState, rng: Rng): Action {
      if (!done && s.screen === 'shop' && s.offers?.shop?.number === shop && !s.offers.pick) {
        done = true;
        if (good) {
          const gift: Action = { t: 'debug', op: 'giveGood', good };
          try {
            rules.apply(s, gift);
            given = true;
            return gift;
          } catch {
            // No room (full slots, or a blueprint it already holds): the placebo instead.
          }
        }
        return PLACEBO;
      }
      return base.act(rules, s, rng);
    },
  };
}

/** Whether the run still holds a gifted blueprint or upgrade at the end. */
function holds(s: RunState, good: Good): boolean {
  if (good.kind === 'blueprint') return s.blueprints.some((b) => b.id === good.id);
  if (good.kind === 'upgrade') return s.upgrades.includes(good.id);
  return false;
}

// ---------------------------------------------------------------------------------------
// The paired comparison for --ban and --gift.

const pts = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;
const signed = (x: number, digits: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x).toFixed(digits)}`;

/** Mean and 95% interval of paired differences. */
function meanInterval(xs: readonly number[]): { mean: number; lo: number; hi: number } {
  const n = xs.length;
  const mean = xs.reduce((a, b) => a + b, 0) / Math.max(1, n);
  const sd = Math.sqrt(xs.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, n - 1));
  const half = n > 1 ? (1.96 * sd) / Math.sqrt(n) : NaN;
  return { mean, lo: mean - half, hi: mean + half };
}

/**
 * Treatment against control on the same seeds. Win rates with their intervals, then the
 * paired difference: only seeds won by one arm and not the other carry information, so the
 * interval is on those discordant pairs (as McNemar's test), not on two separate rates.
 */
function pairedReport(
  title: string,
  subtitle: string,
  names: readonly [string, string],
  treatment: readonly RunRecord[],
  control: readonly RunRecord[],
  extra: readonly string[] = [],
): string {
  const bySeed = new Map(control.map((r) => [r.seed, r]));
  const pairs = treatment.flatMap((a) => {
    const b = bySeed.get(a.seed);
    return b ? [[a, b] as const] : [];
  });
  const n = pairs.length;
  const out = [`\n${title}`, `${subtitle}, ${n} paired seeds`];
  if (n === 0) return [...out, '(no seeds finished in both arms)'].join('\n');
  const [tName, cName] = names;
  const won = (r: RunRecord) => r.result === 'won';
  const rate = (side: 0 | 1, hit: (r: RunRecord) => boolean) =>
    fmtRate(pairs.filter((p) => hit(p[side])).length, n);
  const w = Math.max(tName.length, cName.length);
  out.push(`  ${'Win rate'.padEnd(22)}${tName.padEnd(w)}  ${rate(0, won)}`);
  out.push(`  ${''.padEnd(22)}${cName.padEnd(w)}  ${rate(1, won)}`);
  const m3 = (r: RunRecord) => r.cleared >= 3;
  out.push(`  ${'Clears milestones 1–3'.padEnd(22)}${tName.padEnd(w)}  ${rate(0, m3)}`);
  out.push(`  ${''.padEnd(22)}${cName.padEnd(w)}  ${rate(1, m3)}`);
  const up = pairs.filter(([a, b]) => won(a) && !won(b)).length;
  const down = pairs.filter(([a, b]) => !won(a) && won(b)).length;
  const diff = (up - down) / n;
  const se = Math.sqrt(Math.max(0, up + down - (up - down) ** 2 / n)) / n;
  const [lo, hi] = [diff - 1.96 * se, diff + 1.96 * se];
  out.push(
    `Win rate, ${tName} − ${cName}: ${pts(diff)} points [${pts(lo)}, ${pts(hi)}]`,
    `  ${up} seed${up === 1 ? '' : 's'} won only with ${tName}, ${down} only with ${cName}`,
  );
  const cleared = meanInterval(pairs.map(([a, b]) => a.cleared - b.cleared));
  out.push(
    `Milestones cleared per run: ${signed(cleared.mean, 2)} ` +
      `[${signed(cleared.lo, 2)}, ${signed(cleared.hi, 2)}]`,
  );
  const logs = meanInterval(
    pairs.map(([a, b]) => Math.log(Math.max(1, a.finalScore) / Math.max(1, b.finalScore))),
  );
  const ratio = percentile(
    pairs.map(([a, b]) => a.finalScore / Math.max(1, b.finalScore)),
    50,
  );
  out.push(
    `Final Wow, ${tName} ÷ ${cName}: ×${Math.exp(logs.mean).toFixed(3)} ` +
      `[${Math.exp(logs.lo).toFixed(3)}–${Math.exp(logs.hi).toFixed(3)}] (geometric mean), ` +
      `p50 ${ratio.toFixed(3)}`,
  );
  const alike = pairs.filter(
    ([a, b]) => a.result === b.result && a.weekly.join() === b.weekly.join(),
  ).length;
  out.push(`Seeds that played out the same in both arms: ${alike} of ${n}`);
  out.push(...extra);
  out.push(
    lo <= 0 && hi >= 0
      ? 'The win-rate interval includes 0: no difference shown at this many runs.'
      : `The win-rate interval excludes 0: ${tName} ${diff > 0 ? 'wins more' : 'wins less'}.`,
  );
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------
// The benchmark gate and the target writer.

/** §4: one greedy run on the densest-terrain lot of 50 seeds, under a second. */
function benchmarkGate(rules: Rules): { ok: boolean; record: RunRecord | null } {
  let densest = '';
  let most = -1;
  for (let i = 0; i < 50; i++) {
    const seed = `bench-${i}`;
    const lot = rules.newRun({ seed, crewId: 'generalContractor', mode: 'standard' }).house.lot;
    const terrain = lot.terrain.filter((t) => t !== null).length;
    if (terrain > most) [densest, most] = [seed, terrain];
  }
  try {
    simulateRun(rules, 'bench-warmup', POLICIES.greedy!, { probePhase: null, maxWeeks: 8 });
    const start = performance.now();
    const { record } = simulateRun(rules, densest, POLICIES.greedy!, { probePhase: null });
    const ms = performance.now() - start;
    const ok = ms < GATE_MS;
    console.log(
      `\nBenchmark gate: one greedy run on ${densest} (${most} terrain tiles, the densest of 50), ` +
        `${record.weeks} weeks: ${ms.toFixed(0)} ms — ${ok ? 'PASS' : 'FAIL'} (limit ${GATE_MS} ms)`,
    );
    return { ok, record };
  } catch (e) {
    console.error(`\nBenchmark gate: FAIL, the run threw: ${e instanceof Error ? e.message : e}`);
    if (e instanceof SimError) console.error(`  run code: ${e.runCode}`);
    return { ok: false, record: null };
  }
}

function writeTargets(
  file: URL | string,
  s: TargetSuggestion,
  runs: number,
  fitSeed: string,
): void {
  const text = readFileSync(file, 'utf8');
  const start = text.indexOf('  // sim:targets:start');
  const end = text.indexOf('  // sim:targets:end');
  if (start < 0 || end < 0) throw new Error('balance.ts has lost its sim:targets markers');
  const lines = [
    '  // sim:targets:start',
    `  // From \`npm run sim -- --suggest-targets --runs ${runs}\` (D-072, D-089): α × the`,
    `  // greedy bot's median cumulative Wow at each milestone on seeds ${fitSeed}-*, with α set`,
    `  // so greedy's estimated survival follows ` +
      `${s.goals.map((g) => `${Math.round(g * 100)}%`).join(', ')}.`,
    '  phases: [',
    ...CONTENT.balance.phases.map(
      (p, k) =>
        `    { name: '${p.name}', target: ${s.targets[k]} }, // median ${Math.round(s.medians[k]!)}, α ${s.alphas[k]!.toFixed(2)}`,
    ),
    '  ],',
  ];
  writeFileSync(file, text.slice(0, start) + lines.join('\n') + '\n' + text.slice(end));
}

// ---------------------------------------------------------------------------------------
// The modes.

interface Options {
  runs: number;
  /** Seeds are `${prefix}-0`, `${prefix}-1`, … */
  prefix: string;
  seeds: string[];
  /** The seed prefix the target fit uses: "sim", unless --fit-seed says otherwise. */
  fitSeed: string;
  greedy: GreedyOptions;
  failures: Failure[];
  json: Record<string, readonly RunRecord[]>;
}

const greedyLabel = (opts: GreedyOptions) => makeGreedy(opts).label!;

/**
 * §8's criteria from greedy, random, novice, and greedy early always, on the same seeds: the
 * criteria, then `between` (if any), then greedy's report.
 */
function check(rules: Rules, o: Options, between?: (greedy: RunRecord[]) => string): void {
  const { content } = rules;
  const arms = {
    greedy: runMany(rules, o.seeds, () => makeGreedy(o.greedy), 'greedy', o.failures),
    random: runMany(rules, o.seeds, () => POLICIES.random!, 'random', o.failures),
    novice: runMany(rules, o.seeds, () => POLICIES.novice!, 'novice', o.failures),
    earlyAlways: runMany(
      rules,
      o.seeds,
      () => makeGreedy({ ...o.greedy, early: 'always' }),
      'greedy, early always',
      o.failures,
    ),
  };
  Object.assign(o.json, arms);
  const labels = [
    greedyLabel(o.greedy),
    'random',
    'novice',
    greedyLabel({ ...o.greedy, early: 'always' }),
  ];
  const held = o.prefix !== o.fitSeed;
  console.log(
    `\nCheck on seeds ${seedRange(o.seeds)}` +
      `${held ? ' (held out from the target fit)' : ', the seeds the target fit uses'}, ` +
      `${o.runs} runs each:\n  ${labels.slice(0, -1).join(', ')}, and ${labels.at(-1)}`,
  );
  console.log(criteriaReport(content, arms));
  if (between) console.log(between(arms.greedy));
  console.log(report(content, arms.greedy, greedyLabel(o.greedy)));
}

/** What the fit estimated for greedy's survival, against held-out greedy runs. */
function survivalAgainstFit(s: TargetSuggestion, greedy: readonly RunRecord[], fitSeed: string) {
  const n = greedy.length;
  const rows = CONTENT.balance.phases.map((p, k) => {
    const met = greedy.filter((r) => r.cleared > k).length;
    return (
      `  ${`${k + 1}. ${p.name}`.padEnd(21)} ${s.targets[k]!.toLocaleString('en-US').padStart(7)}` +
      `  ${`${Math.round(s.goals[k]! * 100)}%`.padStart(4)}` +
      `  ${`${(s.estimate.survival[k]! * 100).toFixed(1)}%`.padStart(9)}  ${fmtRate(met, n)}`
    );
  });
  return [
    `\nGreedy survival with these targets: the fit's estimate (seeds ${fitSeed}-*) and held out`,
    `  ${'Milestone'.padEnd(21)} ${'Target'.padStart(7)}  Goal  Estimated  Held out`,
    ...rows,
  ].join('\n');
}

function suggest(o: Options, dryRun: boolean): Rules {
  const { fitSeed } = o;
  const fitSeeds = seedsFor(fitSeed, o.runs);
  // Untargeted: every target 0, so no run ends early and the median curve is complete.
  const free = createRules(
    withTargets(
      CONTENT,
      CONTENT.balance.phases.map(() => 0),
    ),
  );
  console.log(
    `Suggesting targets from ${o.runs} untargeted greedy runs on seeds ${seedRange(fitSeeds)}…`,
  );
  const untargeted = runMany(free, fitSeeds, () => makeGreedy(o.greedy), 'fit', o.failures);
  o.json.untargeted = untargeted;
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
  if (dryRun) console.log('--dry-run: src/content/balance.ts is unchanged.');
  else {
    writeTargets(BALANCE_FILE, s, o.runs, fitSeed);
    console.log('Wrote the targets to src/content/balance.ts.');
  }
  const tuned = createRules(withTargets(CONTENT, s.targets));
  check(tuned, o, (greedy) => survivalAgainstFit(s, greedy, fitSeed));
  return tuned;
}

type Values = ReturnType<typeof parse>['values'];

function parse(args: readonly string[]) {
  return parseArgs({
    args: [...args],
    options: {
      runs: { type: 'string', default: '200' },
      policy: { type: 'string' },
      seed: { type: 'string' },
      early: { type: 'string' },
      strikes: { type: 'string' },
      check: { type: 'boolean', default: false },
      ban: { type: 'string', multiple: true },
      gift: { type: 'string' },
      'gift-shop': { type: 'string' },
      'suggest-targets': { type: 'boolean', default: false },
      'fit-seed': { type: 'string' },
      'dry-run': { type: 'boolean', default: false },
      bench: { type: 'boolean', default: false },
      'no-gate': { type: 'boolean', default: false },
      json: { type: 'string' },
      help: { type: 'boolean', default: false },
    },
  });
}

function oneOf<T extends string>(flag: string, value: string | undefined, of: readonly T[]) {
  if (value === undefined) return undefined;
  if (!(of as readonly string[]).includes(value)) {
    throw new UsageError(`${flag} takes ${of.join(', ')} (got "${value}").`);
  }
  return value as T;
}

function run(values: Values): number {
  const modes = [
    values.check && '--check',
    values.ban && '--ban',
    values.gift !== undefined && '--gift',
    values['suggest-targets'] && '--suggest-targets',
    values.bench && '--bench',
  ].filter((m): m is string => typeof m === 'string');
  if (modes.length > 1) throw new UsageError(`Pick one mode, not ${modes.join(' and ')}.`);
  const mode = modes[0] ?? null;
  const runs = Number(values.runs);
  if (!Number.isInteger(runs) || runs < 1) throw new UsageError('--runs needs a whole number ≥ 1.');
  const early = oneOf('--early', values.early, EARLY_MODES);
  const strikes = oneOf('--strikes', values.strikes, STRIKE_MODES);
  const greedyOpts: GreedyOptions = { ...(early && { early }), ...(strikes && { strikes }) };
  const policyName = values.policy ?? 'greedy';
  if (!Object.hasOwn(POLICIES, policyName)) {
    throw new UsageError(
      `Unknown policy "${policyName}". Try ${Object.keys(POLICIES).join(', ')}.`,
    );
  }
  const held = mode === '--check' || mode === '--suggest-targets';
  if ((held || mode === '--bench') && values.policy !== undefined) {
    throw new UsageError(`${mode} picks its own bots, so it doesn't take --policy.`);
  }
  if (held && early !== undefined) {
    throw new UsageError(
      `${mode} picks its own early-completion modes, so it doesn't take --early.`,
    );
  }
  if (mode === '--bench' && (early !== undefined || strikes !== undefined)) {
    throw new UsageError('--bench times the default greedy bot.');
  }
  if (policyName !== 'greedy' && (early !== undefined || strikes !== undefined)) {
    throw new UsageError('--early and --strikes are greedy options.');
  }
  if (values['gift-shop'] !== undefined && mode !== '--gift') {
    throw new UsageError('--gift-shop goes with --gift.');
  }
  if ((values['fit-seed'] !== undefined || values['dry-run']) && mode !== '--suggest-targets') {
    throw new UsageError('--fit-seed and --dry-run go with --suggest-targets.');
  }
  const prefix = values.seed ?? (held ? 'check' : 'sim');
  const fitSeed = values['fit-seed'] ?? 'sim';
  if (mode === '--suggest-targets' && fitSeed === prefix) {
    throw new UsageError(
      `--seed and --fit-seed are both "${prefix}": the check must run on seeds the fit didn't use.`,
    );
  }

  const rules = createRules(CONTENT);
  const o: Options = {
    runs,
    prefix,
    seeds: seedsFor(prefix, runs),
    fitSeed,
    greedy: greedyOpts,
    failures: [],
    json: {},
  };
  let gateRules: Rules | null = null;
  let records: RunRecord[] | null = null;

  if (mode === '--bench') {
    const gate = benchmarkGate(rules);
    if (gate.record) records = [gate.record];
    writeJson(values.json, records, o);
    return gate.ok ? 0 : 1;
  } else if (mode === '--check') {
    check(rules, o);
    gateRules = rules;
  } else if (mode === '--suggest-targets') {
    gateRules = suggest(o, values['dry-run']);
  } else if (mode === '--ban' || mode === '--gift') {
    const base = policyName === 'greedy' ? makeGreedy(greedyOpts) : POLICIES[policyName]!;
    if (mode === '--ban') banAB(rules, base, values.ban ?? [], o);
    else giftAB(rules, base, values.gift!, values['gift-shop'], o);
    if (policyName === 'greedy') gateRules = rules;
  } else {
    const policy = policyName === 'greedy' ? makeGreedy(greedyOpts) : POLICIES[policyName]!;
    records = runMany(rules, o.seeds, () => policy, policy.label ?? policy.name, o.failures);
    console.log(report(CONTENT, records, policy.label ?? policy.name));
    if (policyName === 'greedy') gateRules = rules;
  }

  writeJson(values.json, records, o);
  printFailures(o.failures);
  let code = o.failures.length > 0 ? 1 : 0;
  if (gateRules && !values['no-gate'] && !benchmarkGate(gateRules).ok) code = 1;
  return code;
}

/** --ban: the same seeds with the goods off the shelves, against the content as it is. */
function banAB(rules: Rules, base: Policy, texts: readonly string[], o: Options): void {
  const bans = texts.map((b) =>
    parseGood('--ban', b, BAN_KINDS, CONTENT, 'Pieces and fixtures are drawn as cards too.'),
  );
  for (const { kind, id } of bans) {
    const def =
      kind === 'blueprint'
        ? CONTENT.blueprints[id as keyof Content['blueprints']]
        : kind === 'tool'
          ? CONTENT.tools[id as keyof Content['tools']]
          : null;
    if (def && !def.offered) throw new UsageError(`${kind}:${id} isn't on offer anyway.`);
  }
  const label = base.label ?? base.name;
  const banned = createRules(withBans(CONTENT, bans));
  const what = bans.map((b) => `${b.kind}:${b.id}`).join(', ');
  const ban = runMany(banned, o.seeds, () => base, 'ban', o.failures);
  const control = runMany(rules, o.seeds, () => base, 'control', o.failures);
  Object.assign(o.json, { ban, control });
  console.log(
    pairedReport(
      `Paired A/B: ban ${what} vs control`,
      `${label} on seeds ${seedRange(o.seeds)}`,
      ['ban', 'control'],
      ban,
      control,
    ),
  );
  console.log(report(banned.content, ban, `${label}, ban ${what}`));
}

/** --gift: the same seeds with the good given at a shop, against the placebo. */
function giftAB(
  rules: Rules,
  base: Policy,
  text: string,
  shopText: string | undefined,
  o: Options,
): void {
  const { kind, id } = parseGood('--gift', text, GIFT_KINDS, CONTENT, 'giveGood gives these.');
  const shops = CONTENT.balance.phases.length - 1;
  const shop = shopText === undefined ? 1 : Number(shopText);
  if (!Number.isInteger(shop) || shop < 1 || shop > shops) {
    throw new UsageError(`--gift-shop takes a shop from 1 to ${shops}.`);
  }
  const label = base.label ?? base.name;
  const good = { kind, id } as Good;
  const what = `${kind}:${id} at shop ${shop}`;
  let given = 0;
  let kept = 0;
  const count = (result: RunResult, policy: Policy) => {
    if (!(policy as GiftPolicy).given()) return;
    given++;
    if (holds(result.state, good)) kept++;
  };
  const gift = runMany(rules, o.seeds, () => withGift(base, good, shop), 'gift', o.failures, count);
  const placebo = runMany(rules, o.seeds, () => withGift(base, null, shop), 'placebo', o.failures);
  Object.assign(o.json, { gift, placebo });
  const tracked = kind === 'blueprint' || kind === 'upgrade';
  const note =
    `Gift given in ${given} of ${gift.length} runs` +
    (tracked ? `, still held at the end in ${kept}` : '') +
    (given < gift.length ? ` (the others ended before shop ${shop} or had no room)` : '');
  console.log(
    pairedReport(
      `Paired A/B: gift ${what} vs placebo`,
      `${label} on seeds ${seedRange(o.seeds)}`,
      ['gift', 'placebo'],
      gift,
      placebo,
      [note],
    ),
  );
  console.log(report(CONTENT, gift, `${label}, gift ${what}`));
}

/** --json: the one bot's records as an array, or every arm's as an object of arrays. */
function writeJson(file: string | undefined, records: RunRecord[] | null, o: Options): void {
  if (!file) return;
  const data = records ?? o.json;
  writeFileSync(file, JSON.stringify(data, null, 1));
  const count = records
    ? records.length
    : Object.values(o.json).reduce((a, rs) => a + rs.length, 0);
  console.log(`Wrote ${count} run record${count === 1 ? '' : 's'} to ${file}.`);
}

function main(argv: readonly string[]): number {
  try {
    const { values } = parse(argv);
    if (values.help) {
      console.log(HELP);
      return 0;
    }
    return run(values);
  } catch (e) {
    const usage =
      e instanceof UsageError ||
      (e instanceof Error && (e as { code?: string }).code?.startsWith('ERR_PARSE_ARGS'));
    if (!usage) throw e;
    console.error(`${(e as Error).message}\nSee npm run sim -- --help.`);
    return 2;
  }
}

if (import.meta.main) process.exitCode = main(process.argv.slice(2));

// For scratch checks and tests; `npm run sim` runs main() only when this is the entry point.
export { main, pairedReport, withBans, withGift, writeTargets };
