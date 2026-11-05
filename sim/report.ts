// The sim's report (§8, M2 version): cumulative Wow at each milestone (p10, p50, p90), survival
// per milestone, win rate, lot fill, fence use and the enclosure probe, as console tables; and
// the target suggestion (D-044).

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
      const line = r.map((v, c) => (c === 0 ? v.padEnd(widths[c]!) : v.padStart(widths[c]!))).join('  ');
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
      `Lot fill at the end: p50 ${percentile(records.map((r) => r.fillPct), 50).toFixed(1)}%` +
        ` (p10 ${percentile(records.map((r) => r.fillPct), 10).toFixed(1)}%,` +
        ` p90 ${percentile(records.map((r) => r.fillPct), 90).toFixed(1)}%)`,
      `Fences: ${avg((r) => r.fencePlacements).toFixed(2)} placed per run;` +
        ` runs ending with a fenced yard ${pct(records.filter((r) => r.fencedYard > 0).length, records.length)}`,
      probes.length > 0
        ? `Enclosure cost after milestone 3 (Fence cards for the cheapest fenced yard):` +
          ` p25 ${percentile(probes.map((p) => p.placements), 25)}` +
          ` · p50 ${percentile(probes.map((p) => p.placements), 50)}` +
          ` · p75 ${percentile(probes.map((p) => p.placements), 75)}` +
          ` · ${pct(probes.length, records.filter((r) => r.cleared >= 3).length)} of houses can be fenced in ≤ 6` +
          ` · yard p50 ${percentile(probes.map((p) => p.yard), 50)} tiles`
        : 'Enclosure cost: not probed',
      `Time per run: p50 ${percentile(records.map((r) => r.ms), 50).toFixed(0)} ms,` +
        ` max ${Math.max(...records.map((r) => r.ms)).toFixed(0)} ms`,
    ].join('\n'),
  );
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------
// Target suggestion (D-044, §8): each target is α × the greedy bot's median cumulative Wow at
// that milestone, with α rising from about 0.6 (the first milestone teaches) to a plateau by
// milestones 4–5. The plateau is calibrated so greedy wins about 45% of runs, estimated from
// the untargeted runs' weekly scores with overtime modelled (a missed milestone borrows up to
// two extra weeks, which shift later milestones by as much).

export const ALPHA_START = 0.6;

export function alphaCurve(plateau: number, phases: number): number[] {
  return Array.from({ length: phases }, (_, k) =>
    k >= 4 ? plateau : ALPHA_START + ((plateau - ALPHA_START) * k) / 4,
  );
}

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
  estimate: { survival: number[]; winRate: number };
}

export function suggestTargets(
  content: Content,
  untargeted: readonly RunRecord[],
  goalWinRate = 0.45,
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
  const build = (plateau: number) => {
    const alphas = alphaCurve(plateau, phases);
    const targets = medians.map((m, k) => tidy(m * alphas[k]!));
    // Targets must rise.
    for (let k = 1; k < targets.length; k++) {
      if (targets[k]! <= targets[k - 1]!) targets[k] = tidy(targets[k - 1]! * 1.1 + 5);
    }
    return { alphas, targets, estimate: estimateSurvival(untargeted, targets, W, overtime) };
  };
  // Bisect the plateau: a higher α means harder targets and a lower win rate.
  let lo = 0.6;
  let hi = 1.4;
  for (let i = 0; i < 30; i++) {
    const mid = (lo + hi) / 2;
    if (build(mid).estimate.winRate > goalWinRate) lo = mid;
    else hi = mid;
  }
  const plateau = Math.round(((lo + hi) / 2) * 100) / 100;
  return { medians, ...build(plateau) };
}
