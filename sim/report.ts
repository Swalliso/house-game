// The sim's report (§8): cumulative Wow at each milestone (p10, p50, p90), survival per
// milestone, win rate, lot fill, fence use and the enclosure probe, as console tables; the
// target suggestion (D-044); and from M3 the economy: how often each good is offered, bought,
// and in winning runs, budget left unspent, and fixture and tool use with their weekly gain.

import type { Content } from '../src/rules/index.ts';
import type { RunRecord } from './simulate.ts';

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * (p / 100);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

const fmt = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '–');
const pct = (n: number, of: number) => (of === 0 ? '–' : `${((n * 100) / of).toFixed(0)}%`);

function table(rows: (string | number)[][]): string {
  const cells = rows.map((r) => r.map(String));
  const widths = cells[0]!.map((_, c) => Math.max(...cells.map((r) => r[c]!.length)));
  return cells
    .map((r, i) => {
      const line = r
        .map((v, c) => (c === 0 ? v.padEnd(widths[c]!) : v.padStart(widths[c]!)))
        .join('  ');
      return i === 0 ? `${line}\n${widths.map((w) => '─'.repeat(w)).join('  ')}` : line;
    })
    .join('\n');
}

export interface Summary {
  runs: number;
  /** Fraction of runs that met each milestone. */
  survival: number[];
  winRate: number;
  /** Runs that ended at each milestone (index = milestone failed at, 0-based). */
  failedAt: number[];
  enclosureMedian: number | null;
}

export function summarize(content: Content, records: readonly RunRecord[]): Summary {
  const phases = content.balance.phases.length;
  const survival = Array.from(
    { length: phases },
    (_, k) => records.filter((r) => r.cleared > k).length / Math.max(1, records.length),
  );
  const failedAt = Array.from({ length: phases }, () => 0);
  for (const r of records) if (r.result === 'lost') failedAt[Math.min(r.cleared, phases - 1)]!++;
  const probes = records.flatMap((r) => (r.enclosure ? [r.enclosure.placements] : []));
  return {
    runs: records.length,
    survival,
    winRate: records.filter((r) => r.result === 'won').length / Math.max(1, records.length),
    failedAt,
    enclosureMedian: probes.length > 0 ? percentile(probes, 50) : null,
  };
}

export function report(content: Content, records: readonly RunRecord[], title: string): string {
  const phases = content.balance.phases;
  const out: string[] = [`\n${title}: ${records.length} runs`];
  const rows: (string | number)[][] = [
    ['Milestone', 'Target', 'Reached', 'Met', 'p10', 'p50', 'p90', 'On time', 'Early', 'Overtime'],
  ];
  phases.forEach((p, k) => {
    const at = records.flatMap((r) => r.milestones.filter((m) => m.phase === k));
    const scores = at.map((m) => m.score);
    const met = at.filter((m) => m.result !== 'failed').length;
    rows.push([
      `${k + 1}. ${p.name}`,
      fmt(p.target),
      at.length,
      pct(met, records.length),
      fmt(percentile(scores, 10)),
      fmt(percentile(scores, 50)),
      fmt(percentile(scores, 90)),
      at.filter((m) => m.result === 'onTime').length,
      at.filter((m) => m.result === 'early').length,
      at.filter((m) => m.result === 'overtime').length,
    ]);
  });
  out.push(table(rows));
  const s = summarize(content, records);
  const n = Math.max(1, records.length);
  const avg = (f: (r: RunRecord) => number) => records.reduce((a, r) => a + f(r), 0) / n;
  const probes = records.flatMap((r) => (r.enclosure ? [r.enclosure] : []));
  const lostAt = s.failedAt
    .map((count, k) => (count > 0 ? `${k + 1}: ${count}` : ''))
    .filter(Boolean)
    .join(', ');
  out.push(
    [
      `Win rate ${pct(records.filter((r) => r.result === 'won').length, records.length)}` +
        ` · lost at milestone ${lostAt || '–'}`,
      `Overtime weeks used per run ${avg((r) => r.overtimeUsed).toFixed(2)}` +
        ` · passes ${avg((r) => r.passes).toFixed(1)} · rerolls ${avg((r) => r.rerolls).toFixed(1)}`,
      `Lot fill at the end: p50 ${percentile(
        records.map((r) => r.fillPct),
        50,
      ).toFixed(1)}%` +
        ` (p10 ${percentile(
          records.map((r) => r.fillPct),
          10,
        ).toFixed(1)}%,` +
        ` p90 ${percentile(
          records.map((r) => r.fillPct),
          90,
        ).toFixed(1)}%)`,
      `Fences: ${avg((r) => r.fencePlacements).toFixed(2)} placed per run;` +
        ` runs ending with a fenced yard ${pct(records.filter((r) => r.fencedYard > 0).length, records.length)}`,
      probes.length > 0
        ? `Enclosure cost after milestone 3 (Fence cards for the cheapest fenced yard):` +
          ` p25 ${percentile(
            probes.map((p) => p.placements),
            25,
          )}` +
          ` · p50 ${percentile(
            probes.map((p) => p.placements),
            50,
          )}` +
          ` · p75 ${percentile(
            probes.map((p) => p.placements),
            75,
          )}` +
          ` · ${pct(probes.length, records.filter((r) => r.cleared >= 3).length)} of houses can be fenced in ≤ 6` +
          ` · yard p50 ${percentile(
            probes.map((p) => p.yard),
            50,
          )} tiles`
        : 'Enclosure cost: not probed',
      `Time per run: p50 ${percentile(
        records.map((r) => r.ms),
        50,
      ).toFixed(0)} ms,` + ` max ${Math.max(...records.map((r) => r.ms)).toFixed(0)} ms`,
    ].join('\n'),
  );
  out.push(economyReport(content, records));
  return out.join('\n');
}

const avgOf = (xs: readonly number[]) =>
  xs.length === 0 ? NaN : xs.reduce((a, b) => a + b, 0) / xs.length;

/** The good's name from its key (`blueprint:fengShui` → Feng Shui). */
function goodName(content: Content, key: string): string {
  const [kind, id] = key.split(':') as [string, string];
  const table: Record<string, Record<string, { name: string }>> = {
    blueprint: content.blueprints,
    fixture: content.fixtures,
    piece: content.pieces,
    tool: content.tools,
    crate: content.crates,
    upgrade: content.upgrades,
  };
  if (kind === 'service')
    return { reroll: '+1 reroll', demolition: '+1 demolition', strike: 'Strike a card' }[id] ?? id;
  return table[kind]?.[id]?.name ?? key;
}

/** M3's economy tables: the shop, budget, fixtures, and tools. */
export function economyReport(content: Content, records: readonly RunRecord[]): string {
  const out: string[] = [];
  const n = Math.max(1, records.length);
  const wins = records.filter((r) => r.result === 'won');
  const keys = new Set<string>();
  for (const r of records) {
    Object.keys(r.economy.offered).forEach((k) => keys.add(k));
    Object.keys(r.economy.bought).forEach((k) => keys.add(k));
    Object.keys(r.economy.picked).forEach((k) => keys.add(k));
  }
  const order = ['blueprint', 'piece', 'fixture', 'tool', 'crate', 'upgrade', 'service'];
  const sorted = [...keys].sort(
    (a, b) =>
      order.indexOf(a.split(':')[0]!) - order.indexOf(b.split(':')[0]!) ||
      goodName(content, a).localeCompare(goodName(content, b)),
  );
  const sum = (f: (r: RunRecord) => number) => records.reduce((a, r) => a + f(r), 0);
  const rows: (string | number)[][] = [
    ['Good', 'Kind', 'Offered', 'Bought', 'Buy rate', 'Picked', 'Runs w/ it', 'Wins w/ it'],
  ];
  for (const key of sorted) {
    const offered = sum((r) => r.economy.offered[key] ?? 0);
    const bought = sum((r) => r.economy.bought[key] ?? 0);
    const picked = sum((r) => r.economy.picked[key] ?? 0);
    const has = (r: RunRecord) => (r.economy.bought[key] ?? 0) + (r.economy.picked[key] ?? 0) > 0;
    rows.push([
      goodName(content, key),
      key.split(':')[0]!,
      offered,
      bought,
      pct(bought, offered),
      picked,
      pct(records.filter(has).length, records.length),
      pct(wins.filter(has).length, wins.length),
    ]);
  }
  out.push(
    `\nShop: ${sum((r) => r.economy.visits)} visits, ${sum((r) => r.economy.refreshes)} refreshes`,
  );
  out.push(table(rows));
  const left = records.map((r) => r.economy.budgetLeft);
  const earned = records.map((r) => r.economy.budgetEarned);
  out.push(
    [
      `Budget earned per run: p50 ${fmt(percentile(earned, 50))} (p10 ${fmt(percentile(earned, 10))}, p90 ${fmt(percentile(earned, 90))})`,
      `Budget left unspent at the end: p50 ${fmt(percentile(left, 50))}, p90 ${fmt(percentile(left, 90))}, mean ${avgOf(left).toFixed(1)}`,
      `Shop visits left without buying (skip reward): ${pct(
        sum((r) => r.economy.skips),
        sum((r) => r.economy.visits),
      )}` + ` · goods sold per run ${(sum((r) => r.economy.sold) / n).toFixed(2)}`,
    ].join('\n'),
  );
  const fixtureRows: (string | number)[][] = [
    ['Fixture', 'Installs', 'From hand', 'From supplies', 'Avg weekly gain'],
  ];
  const fixtures = new Map<string, { hand: number; supplies: number; gains: number[] }>();
  for (const r of records) {
    for (const i of r.economy.installs) {
      const f = fixtures.get(i.id) ?? { hand: 0, supplies: 0, gains: [] };
      f[i.from]++;
      f.gains.push(i.gain);
      fixtures.set(i.id, f);
    }
  }
  for (const [id, f] of [...fixtures].sort((a, b) => b[1].gains.length - a[1].gains.length)) {
    fixtureRows.push([
      content.fixtures[id as keyof typeof content.fixtures]?.name ?? id,
      f.gains.length,
      f.hand,
      f.supplies,
      avgOf(f.gains).toFixed(1),
    ]);
  }
  out.push(
    `\nFixtures: ${(sum((r) => r.economy.installs.length) / n).toFixed(2)} installs per run`,
  );
  out.push(fixtureRows.length > 1 ? table(fixtureRows) : '(none installed)');
  const toolRows: (string | number)[][] = [['Tool', 'Uses', 'Runs using it', 'Avg weekly gain']];
  const tools = new Map<string, { gains: number[]; runs: number }>();
  for (const r of records) {
    const seen = new Set<string>();
    for (const t of r.economy.tools) {
      const e = tools.get(t.id) ?? { gains: [], runs: 0 };
      e.gains.push(t.gain);
      if (!seen.has(t.id)) {
        e.runs++;
        seen.add(t.id);
      }
      tools.set(t.id, e);
    }
  }
  for (const [id, t] of [...tools].sort((a, b) => b[1].gains.length - a[1].gains.length)) {
    toolRows.push([
      content.tools[id as keyof typeof content.tools]?.name ?? id,
      t.gains.length,
      pct(t.runs, records.length),
      avgOf(t.gains).toFixed(1),
    ]);
  }
  out.push(`\nTools: ${(sum((r) => r.economy.tools.length) / n).toFixed(2)} uses per run`);
  out.push(toolRows.length > 1 ? table(toolRows) : '(none used)');
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------
// Target suggestion (D-044, D-072, §8). Each target is α × the greedy bot's median cumulative
// Wow at that milestone. The plan's starting curve (α 0.6 rising to a flat 0.85) can't meet
// §8's criteria: greedy's spread is wide, so a flat 0.85 lets it win most runs, and any
// plateau high enough for a ~45% win rate fails it at milestone 3 a quarter of the time. So
// α is set per milestone, to a survival curve that meets the criteria:
// - milestone 1 teaches: α is low enough that random play usually passes it, so random fails
//   at milestone 2 or 3 instead;
// - greedy clears milestones 1–3 about 95% of the time;
// - then survival falls evenly to about 45% (greedy's win rate) at the last milestone.
// Survival is estimated from untargeted runs' weekly scores with overtime modelled (a missed
// milestone borrows up to two extra weeks, which shift later milestones by as much).

/** α for the teaching milestone. */
export const ALPHA_FIRST = 0.4;
/** Greedy's goal survival through each milestone after the first. */
export const SURVIVAL_GOALS: readonly number[] = [1, 0.98, 0.95, 0.85, 0.72, 0.58, 0.45];

/** Cumulative Wow at week w (1-based), extrapolating past the run's end by its last week. */
function scoreAt(weekly: readonly number[], w: number): number {
  if (w <= weekly.length) return weekly[w - 1] ?? 0;
  const last = weekly[weekly.length - 1] ?? 0;
  const step = last - (weekly[weekly.length - 2] ?? 0);
  return last + step * (w - weekly.length);
}

/** Estimated survival per milestone and win rate for these targets, from untargeted runs. */
export function estimateSurvival(
  runs: readonly RunRecord[],
  targets: readonly number[],
  weeksPerPhase: number,
  overtime: number,
): { survival: number[]; winRate: number } {
  const cleared = runs.map((r) => {
    let ot = overtime;
    let shift = 0;
    for (let k = 0; k < targets.length; k++) {
      let w = (k + 1) * weeksPerPhase + shift;
      while (scoreAt(r.weekly, w) < targets[k]! && ot > 0) {
        ot--;
        shift++;
        w++;
      }
      if (scoreAt(r.weekly, w) < targets[k]!) return k;
    }
    return targets.length;
  });
  const survival = targets.map((_, k) => cleared.filter((c) => c > k).length / runs.length);
  return { survival, winRate: survival[survival.length - 1] ?? 0 };
}

/** Rounds a target to a tidy number: nearest 5 under 100, 10 under 1,000, then 2–3 significant figures. */
export function tidy(n: number): number {
  if (n < 100) return Math.max(5, Math.round(n / 5) * 5);
  if (n < 1000) return Math.round(n / 10) * 10;
  if (n < 10000) return Math.round(n / 50) * 50;
  const unit = 10 ** (Math.floor(Math.log10(n)) - 2);
  return Math.round(n / unit) * unit;
}

export interface TargetSuggestion {
  medians: number[];
  alphas: number[];
  targets: number[];
  goals: number[];
  estimate: { survival: number[]; winRate: number };
}

export function suggestTargets(
  content: Content,
  untargeted: readonly RunRecord[],
): TargetSuggestion {
  const W = content.balance.weeksPerPhase;
  const phases = content.balance.phases.length;
  const overtime = content.balance.rules.overtime;
  const medians = Array.from({ length: phases }, (_, k) =>
    percentile(
      untargeted.map((r) => scoreAt(r.weekly, (k + 1) * W)),
      50,
    ),
  );
  const goals = Array.from(
    { length: phases },
    (_, k) => SURVIVAL_GOALS[Math.min(k, SURVIVAL_GOALS.length - 1)]!,
  );
  goals[phases - 1] = SURVIVAL_GOALS[SURVIVAL_GOALS.length - 1]!;
  const targets: number[] = [tidy(medians[0]! * ALPHA_FIRST)];
  for (let k = 1; k < phases; k++) {
    // The highest target that keeps estimated survival through milestone k at its goal.
    let lo = targets[k - 1]! + 1;
    let hi = Math.max(lo + 1, Math.ceil(medians[k]! * 4));
    const survives = (t: number) =>
      estimateSurvival(untargeted, [...targets, t], W, overtime).survival[k]! >= goals[k]!;
    if (!survives(lo)) hi = lo;
    while (hi - lo > 1) {
      const mid = Math.floor((lo + hi) / 2);
      if (survives(mid)) lo = mid;
      else hi = mid;
    }
    // Tidy, but never above what meets the goal, and always rising.
    let t = tidy(lo);
    if (t > lo) t = tidy(Math.max(targets[k - 1]! + 1, lo * 0.98));
    targets.push(Math.max(t, targets[k - 1]! + 5));
  }
  return {
    medians,
    alphas: targets.map((t, k) => t / Math.max(1, medians[k]!)),
    targets,
    goals,
    estimate: estimateSurvival(untargeted, targets, W, overtime),
  };
}
