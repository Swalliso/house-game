// The sim's report (§8), for a set of runs with one policy: cumulative Wow at each milestone
// (p10, p50, p90), survival per milestone and the win rate, overtime, and lot fill; then the
// M3 and M4 reports: each piece's offers, dead cards, picks, Wow share and clusters; the score
// layers and flat points by source; house siting; early completion per milestone; fences, with
// the enclosure probe next to the draw odds; and the economy (each good offered, bought, in
// crates, and what the bot can't value; budget; fixtures and tools; strikes; bonus rerolls).
// criteria() checks §8's starting criteria. The target suggestion (D-044) is at the end.
//
// Rates carry a Wilson 95% interval and n. At 200 runs a win rate is about ±7 points, so a
// smaller difference between two sets of runs is noise until more runs, or paired seeds, say
// otherwise. Kept to about 100 columns for a terminal.

import type { Content } from '../src/rules/index.ts';
import { SCORE_LABELS } from '../src/content/labels.ts';
import { BOT_BLIND } from './policies/shop.ts';
import type { RunRecord } from './simulate.ts';

export function percentile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const idx = (sorted.length - 1) * (p / 100);
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo]! + (sorted[hi]! - sorted[lo]!) * (idx - lo);
}

/** The nearest-rank quantile, for whole-number data: always one of the values. */
export function rankQuantile(values: readonly number[], p: number): number {
  if (values.length === 0) return NaN;
  const sorted = [...values].sort((a, b) => a - b);
  const at = Math.ceil((p / 100) * sorted.length) - 1;
  return sorted[Math.min(sorted.length - 1, Math.max(0, at))]!;
}

/** The Wilson score interval for k successes in n (95% at the default z). */
export function wilson(k: number, n: number, z = 1.96): { p: number; lo: number; hi: number } {
  if (n <= 0) return { p: NaN, lo: 0, hi: 1 };
  const p = k / n;
  const z2 = z * z;
  const denom = 1 + z2 / n;
  const center = (p + z2 / (2 * n)) / denom;
  const half = (z * Math.sqrt((p * (1 - p)) / n + z2 / (4 * n * n))) / denom;
  return { p, lo: Math.max(0, center - half), hi: Math.min(1, center + half) };
}

const pc1 = (x: number) => (x * 100).toFixed(1);

/** A rate with one decimal, its Wilson 95% interval, and n: '43.5% [36.8–50.4] n=200'. */
export function fmtRate(k: number, n: number): string {
  if (n <= 0) return '– n=0';
  const w = wilson(k, n);
  return `${pc1(w.p)}% [${pc1(w.lo)}–${pc1(w.hi)}] n=${n}`;
}

const fmt = (n: number) => (Number.isFinite(n) ? Math.round(n).toLocaleString('en-US') : '–');
const pct = (n: number, of: number) => (of === 0 ? '–' : `${((n * 100) / of).toFixed(0)}%`);
const pct1 = (n: number, of: number) => (of === 0 ? '–' : `${pc1(n / of)}%`);
const fix = (n: number, digits: number) => (Number.isFinite(n) ? n.toFixed(digits) : '–');
const sumOf = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);
const avgOf = (xs: readonly number[]) => (xs.length === 0 ? NaN : sumOf(xs) / xs.length);

/**
 * A console table. The first row is the header; columns in `left` align left, the rest right;
 * a row with a single cell is a section heading, printed as is.
 */
function table(rows: readonly (readonly (string | number)[])[], left: readonly number[] = [0]) {
  const cells = rows.map((r) => r.map(String));
  const full = cells.filter((r, i) => i === 0 || r.length > 1);
  const widths = cells[0]!.map((_, c) => Math.max(...full.map((r) => (r[c] ?? '').length)));
  return cells
    .map((r, i) => {
      if (i > 0 && r.length === 1) return r[0]!;
      const line = r
        .map((v, c) => (left.includes(c) ? v.padEnd(widths[c]!) : v.padStart(widths[c]!)))
        .join('  ')
        .trimEnd();
      return i === 0 ? `${line}\n${widths.map((w) => '─'.repeat(w)).join('  ')}` : line;
    })
    .join('\n');
}

/** Whether the run resolved milestone k (1-based): met it, or ended there. */
const resolved = (r: RunRecord, k: number) => r.milestones.some((m) => m.phase === k - 1);

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
  const n = records.length;
  const out: string[] = [`\n${title}: ${n} runs`];
  out.push(
    'Milestones (Wow p10/p50/p90: runs that reached it, at resolution; Met, On time: all runs)',
  );
  const rows: (string | number)[][] = [
    ['Milestone', 'Target', 'Reached', 'Met', '95% CI', 'p10', 'p50', 'p90', 'On time', 'Overtime'],
  ];
  phases.forEach((p, k) => {
    const at = records.flatMap((r) => r.milestones.filter((m) => m.phase === k));
    const scores = at.map((m) => m.score);
    const met = at.filter((m) => m.result !== 'failed').length;
    const w = wilson(met, n);
    // Targets differ by client (targetPct): show the median of the runs' own.
    const targets = at.map((m) => m.target);
    rows.push([
      `${k + 1}. ${p.name}`,
      fmt(targets.length > 0 ? percentile(targets, 50) : p.target),
      at.length,
      pct1(met, n),
      n === 0 ? '–' : `${pc1(w.lo)}–${pc1(w.hi)}`,
      fmt(percentile(scores, 10)),
      fmt(percentile(scores, 50)),
      fmt(percentile(scores, 90)),
      pct1(at.filter((m) => m.result === 'onTime').length, n),
      at.filter((m) => m.result === 'overtime').length,
    ]);
  });
  out.push(table(rows));
  const s = summarize(content, records);
  const avg = (f: (r: RunRecord) => number) => sumOf(records.map(f)) / Math.max(1, n);
  const lostAt = s.failedAt
    .map((count, k) => (count > 0 ? `${k + 1}: ${count}` : ''))
    .filter(Boolean)
    .join(', ');
  const exhausted = records.filter((r) => r.overtimeExhausted);
  const fill = records.map((r) => r.fillPct);
  const ms = records.map((r) => r.ms);
  out.push(
    [
      `Win rate ${fmtRate(records.filter((r) => r.result === 'won').length, n)}` +
        ` · lost at milestone ${lostAt || '–'}`,
      `Overtime weeks used per run ${avg((r) => r.overtimeUsed).toFixed(2)}` +
        ` · passes ${avg((r) => r.passes).toFixed(1)} · rerolls ${avg((r) => r.rerolls).toFixed(1)}`,
      `Runs that used every overtime week: ${fmtRate(exhausted.length, n)},` +
        ` ${exhausted.filter((r) => r.result === 'won').length} of them won`,
      `Lot fill at the end: p50 ${fix(percentile(fill, 50), 1)}%` +
        ` (p10 ${fix(percentile(fill, 10), 1)}%, p90 ${fix(percentile(fill, 90), 1)}%)`,
      `Time per run: p50 ${fix(percentile(ms, 50), 0)} ms, max ${fix(Math.max(...ms), 0)} ms`,
    ].join('\n'),
  );
  out.push(piecesReport(content, records));
  out.push(houseReport(content, records));
  out.push(clientsReport(content, records));
  out.push(changeOrdersReport(content, records));
  out.push(crewsReport(content, records));
  out.push(layersReport(records));
  out.push(sitingReport(records));
  out.push(earlyReport(content, records));
  out.push(fenceReport(records));
  out.push(economyReport(content, records));
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------
// The house report (house-systems-review.md, Appendix; D-093): what the finished houses look
// like, for wins and for all runs, beside the review's option B column. Then the checklist's
// lines: how often each held, and when it first did.

const share = (rs: readonly RunRecord[], f: (r: RunRecord) => boolean) =>
  rs.length === 0 ? '–' : `${Math.round((rs.filter(f).length * 100) / rs.length)}%`;
const median = (rs: readonly RunRecord[], f: (r: RunRecord) => number, digits = 0) =>
  rs.length === 0 ? '–' : fix(percentile(rs.map(f), 50), digits);
const mean = (rs: readonly RunRecord[], f: (r: RunRecord) => number, digits = 1) =>
  rs.length === 0 ? '–' : fix(avgOf(rs.map(f)), digits);

export function houseReport(content: Content, records: readonly RunRecord[]): string {
  const wins = records.filter((r) => r.result === 'won');
  const cols = (f: (rs: readonly RunRecord[]) => string) => [f(wins), f(records)];
  const H = (r: RunRecord) => r.house;
  const phases = content.balance.phases.length;
  const rows: (string | number)[][] = [
    ['The house (systems review)', `Wins (${wins.length})`, `All (${records.length})`],
    ['The look'],
    ['  Glance test passed (H1g, H2, H3)', ...cols((rs) => share(rs, (r) => H(r).glance))],
    ['  A compact outline (H1g)', ...cols((rs) => share(rs, (r) => H(r).h1g))],
    ['  No yard inside the house (H2)', ...cols((rs) => share(rs, (r) => H(r).h2))],
    ['  One of each shared room (H3)', ...cols((rs) => share(rs, (r) => H(r).h3))],
    ['  Visible repeats', ...cols((rs) => share(rs, (r) => H(r).visibleRepeats))],
    ["  research.md's plausibility check", ...cols((rs) => share(rs, (r) => H(r).plausible))],
    ['  Corners, median', ...cols((rs) => median(rs, (r) => H(r).corners))],
    ['  Fill, median', ...cols((rs) => median(rs, (r) => H(r).fill, 2))],
    ['  Yard pieces wedged in the box, mean', ...cols((rs) => mean(rs, (r) => H(r).wedged))],
    ['The household'],
    ['  No household', ...cols((rs) => share(rs, (r) => H(r).noHousehold))],
    ['  Bathroom ratio held', ...cols((rs) => share(rs, (r) => H(r).bathroomRatio))],
    ['  Bedrooms per run', ...cols((rs) => mean(rs, (r) => H(r).bedrooms))],
    ['  Rooms, median', ...cols((rs) => median(rs, (r) => H(r).rooms))],
    ['  Tiny houses (8 or fewer rooms)', ...cols((rs) => share(rs, (r) => H(r).tiny))],
    [
      '  Kitchens / Living / Dining, mean',
      ...cols((rs) =>
        rs.length === 0
          ? '–'
          : `${fix(avgOf(rs.map((r) => H(r).kitchens)), 1)} / ${fix(avgOf(rs.map((r) => H(r).livingRooms)), 1)} / ${fix(avgOf(rs.map((r) => H(r).diningRooms)), 1)}`,
      ),
    ],
    ['The yard'],
    ['  Outdoor rooms beside the house (Y1)', ...cols((rs) => share(rs, (r) => H(r).y1))],
    ['  One yard type 4+ times', ...cols((rs) => share(rs, (r) => H(r).yardRepeat >= 4))],
    ['  3+ Treehouses', ...cols((rs) => share(rs, (r) => H(r).treehouses >= 3))],
    ['  3+ outbuildings', ...cols((rs) => share(rs, (r) => H(r).outbuildings >= 3))],
    ['  A fenced yard at the end', ...cols((rs) => share(rs, (r) => r.fencedYard > 0))],
    ['The feel'],
    [
      '  Room pieces by milestone, mean',
      ...cols((rs) =>
        rs.length === 0
          ? '–'
          : Array.from({ length: phases }, (_, k) =>
              fix(avgOf(rs.map((r) => r.build.roomsByPhase[k] ?? 0)), 1),
            ).join(' '),
      ),
    ],
    [
      '  House-building plays, weeks 17–28',
      ...cols((rs) =>
        mean(rs, (r) => r.build.late.rooms + r.build.late.arrivals + r.build.late.renovations),
      ),
    ],
    ['    rooms from the hand', ...cols((rs) => mean(rs, (r) => r.build.late.rooms))],
    ["    the arrivals' rooms", ...cols((rs) => mean(rs, (r) => r.build.late.arrivals))],
    ['    Renovations', ...cols((rs) => mean(rs, (r) => r.build.late.renovations))],
    [
      '    yard, fixtures, Hallways, passes',
      ...cols((rs) =>
        rs.length === 0
          ? '–'
          : ['yard', 'fixtures', 'hallways', 'passes']
              .map((k) =>
                fix(avgOf(rs.map((r) => r.build.late[k as keyof RunRecord['build']['late']])), 1),
              )
              .join(' / '),
      ),
    ],
    ['  Renovations per run', ...cols((rs) => mean(rs, (r) => r.build.renovations))],
    ['  Big weeks, median', ...cols((rs) => median(rs, (r) => r.build.bigWeeks))],
    [
      '  Wow from pieces placed in milestones 1–2',
      ...cols((rs) => {
        const total = sumOf(rs.map((r) => r.layers.comfort + r.layers.charm + r.layers.sparkle));
        return total === 0
          ? '–'
          : `${Math.round((sumOf(rs.map((r) => r.build.earlyPieceWow)) * 100) / total)}%`;
      }),
    ],
    [
      `  ${SCORE_LABELS.mult}'s share of the Wow, median`,
      ...cols((rs) =>
        median(rs, (r) => {
          const t = r.layers.comfort + r.layers.charm + r.layers.sparkle;
          return t === 0 ? 0 : (r.layers.charm * 100) / t;
        }),
      ).map((v) => (v === '–' ? v : `${v}%`)),
    ],
  ];
  const dead = records.filter((r) => r.build.dead);
  if (dead.length > 0) {
    const deadCount = (rs: readonly RunRecord[]) =>
      mean(
        rs.filter((r) => r.build.dead),
        (r) => sumOf(Object.values(r.build.dead!).map((d) => d.dead)),
      );
    const deadShare = (rs: readonly RunRecord[], type: string) => {
      const ds = rs.flatMap((r) => (r.build.dead?.[type] ? [r.build.dead[type]] : []));
      const o = sumOf(ds.map((d) => d.offered));
      return o === 0 ? '–' : `${Math.round((sumOf(ds.map((d) => d.dead)) * 100) / o)}%`;
    };
    rows.push(
      ['The cost'],
      ['  Dead cards per run (best play < a pass)', ...cols(deadCount)],
      ['  Dead Kitchen cards', ...cols((rs) => deadShare(rs, 'kitchen'))],
    );
  }
  const out = ['\n' + table(rows)];
  // The checklist's lines, by client (each client's lines differ in their numbers).
  const byClient = groupBy(records, (r) => r.client);
  const lines: (string | number)[][] = [
    [
      'Checklist line',
      'Held at the end (wins)',
      'Held at the end (all)',
      'Weeks held',
      'First held, p50',
    ],
  ];
  for (const [client, rs] of byClient) {
    const def = content.clients[client as keyof typeof content.clients];
    if (!def) continue;
    const w = rs.filter((r) => r.result === 'won');
    lines.push([`${def.name} (${rs.length} runs)`]);
    for (const spec of def.specs) {
      const tallies = sumOf(rs.map((r) => r.build.tallies));
      const held = sumOf(rs.map((r) => r.build.specWeeks[spec.id] ?? 0));
      const first = rs.flatMap((r) =>
        r.build.specFirst[spec.id] ? [r.build.specFirst[spec.id]!] : [],
      );
      lines.push([
        `  ${spec.name}`,
        share(w, (r) => r.build.specEnd[spec.id] === true),
        share(rs, (r) => r.build.specEnd[spec.id] === true),
        tallies === 0 ? '–' : `${Math.round((held * 100) / tallies)}%`,
        first.length === 0 ? 'never' : `week ${fix(percentile(first, 50), 0)}`,
      ]);
    }
  }
  if (lines.length > 1) out.push(table(lines));
  return out.join('\n\n');
}

function groupBy<K>(records: readonly RunRecord[], key: (r: RunRecord) => K): Map<K, RunRecord[]> {
  const out = new Map<K, RunRecord[]>();
  for (const r of records) {
    const k = key(r);
    let list = out.get(k);
    if (!list) out.set(k, (list = []));
    list.push(r);
  }
  return out;
}

/** One row per client or crew: how its runs went (§8: per-client piece mixes and win rates). */
function groupReport(
  content: Content,
  records: readonly RunRecord[],
  title: string,
  key: (r: RunRecord) => string,
  name: (k: string) => string,
): string {
  const groups = groupBy(records, key);
  if (groups.size < 2) return '';
  const rows: (string | number)[][] = [
    [
      title,
      'Runs',
      'Win rate [95%]',
      'Wow p50',
      'Budget p50',
      'Renov.',
      'Glance',
      'Plaus.',
      'Treeh.',
      'Treeh. Wow',
    ],
  ];
  const mixes: string[] = [];
  for (const [k, rs] of groups) {
    const won = rs.filter((r) => r.result === 'won').length;
    const w = wilson(won, rs.length);
    const pieces = summarizePieces(content, rs);
    const tree = pieces.find((p) => p.id === 'treehouse');
    rows.push([
      name(k),
      rs.length,
      `${pc1(w.p)}% [${pc1(w.lo)}–${pc1(w.hi)}]`,
      fmt(
        percentile(
          rs.map((r) => r.finalScore),
          50,
        ),
      ),
      fmt(
        percentile(
          rs.map((r) => r.economy.budgetEarned),
          50,
        ),
      ),
      fix(avgOf(rs.map((r) => r.build.renovations)), 1),
      share(rs, (r) => r.house.glance),
      share(rs, (r) => r.house.plausible),
      fix(avgOf(rs.map((r) => r.house.treehouses)), 1),
      tree ? `${(tree.wowShare * 100).toFixed(1)}%` : '–',
    ]);
    const top = [...pieces]
      .sort((a, b) => b.placed - a.placed)
      .slice(0, 8)
      .map((p) => `${p.name} ${fix(p.placed, 1)}`)
      .join(', ');
    mixes.push(`  ${name(k)}: ${top}`);
  }
  return ['\n' + table(rows), `${title} piece mix (placed per run, most first):`, ...mixes].join(
    '\n',
  );
}

export function clientsReport(content: Content, records: readonly RunRecord[]): string {
  return groupReport(
    content,
    records,
    'By client',
    (r) => r.client,
    (k) => content.clients[k as keyof typeof content.clients]?.name ?? k,
  );
}

/**
 * M4b, D-144: change orders by client. An offer shows two orders and one is picked. Per order:
 * how often it was on an offer, the share of those it was picked, and of the times picked, the
 * share met (a request) or kept (a restriction) at its milestone; "open" counts runs that
 * ended before it resolved. Then the offers by the kinds on them, and which kind was picked.
 */
export function changeOrdersReport(content: Content, records: readonly RunRecord[]): string {
  const rows: (string | number)[][] = [
    ['Change orders by client', 'Offered', 'Picked', 'Met or kept', 'Missed or broken', 'Open'],
  ];
  for (const [client, rs] of groupBy(records, (r) => r.client)) {
    const def = content.clients[client as keyof typeof content.clients];
    const offers = rs.flatMap((r) => r.changeOrders ?? []);
    if (!def || offers.length === 0) continue;
    rows.push([`${def.name} (${rs.length} runs, ${offers.length} offers)`]);
    const ids = [...new Set(offers.flatMap((o) => [o.id, ...(o.passedOver ?? [])]))];
    for (const id of ids) {
      const co = content.changeOrders[id];
      const taken = offers.filter((o) => o.id === id);
      const shown = taken.length + offers.filter((o) => o.passedOver?.includes(id)).length;
      const good = taken.filter((o) => o.result === 'met' || o.result === 'kept').length;
      const bad = taken.filter((o) => o.result === 'missed' || o.result === 'broken').length;
      const phase = co.kind === 'phase';
      rows.push([
        `  ${co.name} (${co.kind})`,
        shown,
        pct(taken.length, shown),
        phase ? '–' : pct(good, taken.length),
        phase ? '–' : pct(bad, taken.length),
        taken.filter((o) => o.result === undefined).length,
      ]);
    }
  }
  if (rows.length === 1) return '';
  return '\n' + table(rows) + offerKindsReport(content, records);
}

/**
 * D-144: the offers by the kinds of order on them ("phase / request"), and for a mixed offer
 * how often the first-named kind was the one picked.
 */
function offerKindsReport(content: Content, records: readonly RunRecord[]): string {
  const ORDER = ['phase', 'request', 'restriction'];
  const offers = records.flatMap((r) => r.changeOrders ?? []);
  const groups = new Map<string, { n: number; first: number }>();
  for (const o of offers) {
    const picked = content.changeOrders[o.id].kind;
    const kinds = [picked, ...(o.passedOver ?? []).map((id) => content.changeOrders[id].kind)];
    kinds.sort((a, b) => ORDER.indexOf(a) - ORDER.indexOf(b));
    const key = kinds.length === 1 ? `${kinds[0]}, alone` : kinds.join(' / ');
    const g = groups.get(key) ?? { n: 0, first: 0 };
    g.n++;
    if (picked === kinds[0]) g.first++;
    groups.set(key, g);
  }
  const rows: (string | number)[][] = [
    ['Change-order offers by kind', 'Offers', 'Share', 'Picked the first-named'],
  ];
  for (const [key, g] of [...groups].sort((a, b) => b[1].n - a[1].n)) {
    const [first, second] = key.split(' / ');
    const mixed = second !== undefined && second !== first;
    rows.push([`  ${key}`, g.n, pct(g.n, offers.length), mixed ? pct(g.first, g.n) : '–']);
  }
  return '\n' + table(rows);
}

export function crewsReport(content: Content, records: readonly RunRecord[]): string {
  return groupReport(
    content,
    records,
    'By crew',
    (r) => r.crew,
    (k) => content.crews[k as keyof typeof content.crews]?.name ?? k,
  );
}

// ---------------------------------------------------------------------------------------
// Pieces (§8: per-piece pick rate, score share, and dead-card rate).

export interface PieceSummary {
  id: string;
  name: string;
  /** Per run. */
  offered: number;
  placed: number;
  /** Fractions (NaN when there's nothing to divide by). */
  dead: number;
  /** Placed ÷ offered; can pass 1, since reserve pieces and crates add placements. */
  pick: number;
  /** Placed ÷ offered with a legal spot. */
  fitPick: number;
  /** Of all tallied Wow. */
  wowShare: number;
  /** Wow per piece placed. */
  wowPerCopy: number;
  zeroWeeks: number;
  clustered: number;
  /** Runs that struck its type. */
  struck: number;
}

/** Every piece offered or placed, by Wow share. */
export function summarizePieces(content: Content, records: readonly RunRecord[]): PieceSummary[] {
  const n = Math.max(1, records.length);
  const totalWow = sumOf(records.map((r) => r.layers.comfort + r.layers.charm + r.layers.sparkle));
  const sums = new Map<string, RunRecord['pieces'][string]>();
  for (const r of records) {
    for (const [id, p] of Object.entries(r.pieces)) {
      const a = sums.get(id);
      if (!a) {
        sums.set(id, { ...p });
        continue;
      }
      a.offered += p.offered;
      a.dead += p.dead;
      a.placed += p.placed;
      a.earned += p.earned;
      a.wow += p.wow;
      a.pieceWeeks += p.pieceWeeks;
      a.zeroWeeks += p.zeroWeeks;
      a.unmetWeeks += p.unmetWeeks;
      a.clusteredWeeks += p.clusteredWeeks;
    }
  }
  const pieces = content.pieces as Readonly<
    Record<string, Content['pieces'][keyof Content['pieces']]>
  >;
  const ratio = (a: number, b: number) => (b === 0 ? NaN : a / b);
  return [...sums]
    .filter(([, p]) => p.offered > 0 || p.placed > 0)
    .map(([id, p]): PieceSummary => {
      const root = pieces[id]?.countsAs ?? id;
      return {
        id,
        name: pieces[id]?.name ?? id,
        offered: p.offered / n,
        placed: p.placed / n,
        dead: ratio(p.dead, p.offered),
        pick: ratio(p.placed, p.offered),
        fitPick: ratio(p.placed, p.offered - p.dead),
        wowShare: ratio(p.wow, totalWow),
        wowPerCopy: ratio(p.wow, p.placed),
        zeroWeeks: ratio(p.zeroWeeks, p.pieceWeeks),
        clustered: ratio(p.clusteredWeeks, p.pieceWeeks),
        struck: records.filter((r) => r.struck.some((x) => x.type === root)).length / n,
      };
    })
    .sort(
      (a, b) =>
        (b.wowShare || 0) - (a.wowShare || 0) ||
        b.offered - a.offered ||
        a.name.localeCompare(b.name),
    );
}

const asPct = (x: number, digits = 0) =>
  Number.isFinite(x) ? `${(x * 100).toFixed(digits)}%` : '–';

function piecesReport(content: Content, records: readonly RunRecord[]): string {
  const rows: (string | number)[][] = [
    [
      'Piece',
      'Offered',
      'Dead',
      'Pick',
      'Fit pick',
      'Placed',
      'Share',
      'Wow/copy',
      'Zero',
      'Cluster',
      'Struck',
    ],
  ];
  const summary = summarizePieces(content, records);
  for (const p of summary) {
    rows.push([
      p.name,
      p.offered.toFixed(2),
      asPct(p.dead),
      asPct(p.pick),
      asPct(p.fitPick),
      p.placed.toFixed(2),
      asPct(p.wowShare, 1),
      fmt(p.wowPerCopy),
      asPct(p.zeroWeeks),
      p.clustered > 0 ? asPct(p.clustered) : '',
      p.struck > 0 ? asPct(p.struck) : '',
    ]);
  }
  // The sets' Points belong to no one piece: their share gets its own row, so Share sums to 100%.
  if (summary.length > 0) {
    const tallied = sumOf(records.map((r) => r.layers.comfort + r.layers.charm + r.layers.sparkle));
    const sets = tallied === 0 ? NaN : sumOf(records.map((r) => r.setWow)) / tallied;
    rows.push(['(set bonuses)', '', '', '', '', '', asPct(sets, 1), '', '', '', '']);
  }
  return [
    '\nPieces (offered: cards in each week’s first hand)',
    rows.length > 1 ? table(rows) : '(none offered)',
    'Offered and Placed: per run. Dead: offered with no legal spot. Pick: placed ÷ offered;',
    'Fit pick: ÷ offered with a spot. Share: of all Wow. Zero: piece-weeks earning nothing.',
    'Cluster: piece-weeks touching the same type. Struck: runs that struck the type.',
    'Shares follow what each piece earns itself: an aura or a link shows on the piece it boosts,',
    'a Sapling’s Tree counts as a lot feature, and a set’s bonus is the (set bonuses) row.',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------
// Score layers (D-019, D-078) and flat points by source.

export interface Share {
  /** Of the pooled total over every run. */
  share: number;
  /** Per run. */
  p10: number;
  p50: number;
  p90: number;
}

function shares<K extends string>(
  records: readonly RunRecord[],
  keys: readonly K[],
  get: (r: RunRecord) => Readonly<Record<K, number>>,
): Record<K, Share> {
  const total = sumOf(records.map((r) => sumOf(keys.map((k) => get(r)[k]))));
  const out = {} as Record<K, Share>;
  for (const k of keys) {
    const perRun = records.flatMap((r) => {
      const all = sumOf(keys.map((j) => get(r)[j]));
      return all === 0 ? [] : [get(r)[k] / all];
    });
    out[k] = {
      share: total === 0 ? NaN : sumOf(records.map((r) => get(r)[k])) / total,
      p10: percentile(perRun, 10),
      p50: percentile(perRun, 50),
      p90: percentile(perRun, 90),
    };
  }
  return out;
}

const LAYERS = ['comfort', 'charm', 'sparkle'] as const;
const SOURCES = ['terrain', 'street', 'piece', 'plain', 'sets'] as const;

/** Each layer's share of the tallied Wow. */
export function summarizeLayers(records: readonly RunRecord[]) {
  return shares(records, LAYERS, (r) => r.layers);
}

/** Each source's share of the flat points (piece lines, plus the sets' Points). */
export function summarizeSources(records: readonly RunRecord[]) {
  return shares(records, SOURCES, (r) => r.sources);
}

function layersReport(records: readonly RunRecord[]): string {
  const layers = summarizeLayers(records);
  const names: Record<(typeof LAYERS)[number], string> = {
    comfort: `${SCORE_LABELS.points} (Points)`,
    charm: `${SCORE_LABELS.mult} (what +Mult adds)`,
    sparkle: `${SCORE_LABELS.xMult} (what ×Mult adds)`,
  };
  const row = (name: string, x: Share) => [
    name,
    asPct(x.share, 1),
    asPct(x.p10),
    asPct(x.p50),
    asPct(x.p90),
  ];
  const layerRows = [['Score layer', `Share of ${SCORE_LABELS.total}`, 'Run p10', 'p50', 'p90']];
  for (const k of LAYERS) layerRows.push(row(names[k], layers[k]));
  const sources = summarizeSources(records);
  const sourceNames: Record<(typeof SOURCES)[number], string> = {
    terrain: 'Lot features',
    street: 'The street',
    piece: 'Other pieces',
    plain: 'No tile or piece',
    sets: 'Sets’ Points',
  };
  const sourceRows = [['Flat points by source', 'Share', 'Run p10', 'p50', 'p90']];
  for (const k of SOURCES) sourceRows.push(row(sourceNames[k], sources[k]));
  return [
    '\n' + table(layerRows),
    '',
    table(sourceRows),
    'A line caused by several things is split evenly between them; penalties count as negative.',
    '"No tile or piece": steady earnings, blueprints’ grants, the sunny side, front and fenced yards.',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------
// House siting (§8): rows from the street, the street-edge row being 0.

const BANDS: readonly { name: string; min: number; max: number }[] = [
  { name: '0–3 rows', min: 0, max: 3 },
  { name: '4–9 rows', min: 4, max: 9 },
  { name: '10+ rows', min: 10, max: Infinity },
];

function sitingReport(records: readonly RunRecord[]): string {
  const first = records.map((r) => r.siting.firstRow).filter(Number.isFinite);
  const indoor = records.flatMap((r) =>
    r.siting.firstIndoorRow === null ? [] : [r.siting.firstIndoorRow],
  );
  const gaps = records.flatMap((r) => (r.siting.frontGap === null ? [] : [r.siting.frontGap]));
  const q = (xs: number[]) => [
    fix(rankQuantile(xs, 10), 0),
    fix(rankQuantile(xs, 50), 0),
    fix(rankQuantile(xs, 90), 0),
    xs.length,
  ];
  const rows: (string | number)[][] = [
    ['House siting (rows from the street)', 'p10', 'p50', 'p90', 'n'],
    ['First piece placed', ...q(first)],
    ['First indoor piece', ...q(indoor)],
    ['Front gap at the end (indoor)', ...q(gaps)],
  ];
  const bands: (string | number)[][] = [['Front gap at the end', 'Win rate']];
  for (const band of BANDS) {
    const runs = records.filter(
      (r) =>
        r.siting.frontGap !== null &&
        r.siting.frontGap >= band.min &&
        r.siting.frontGap <= band.max,
    );
    bands.push([band.name, fmtRate(runs.filter((r) => r.result === 'won').length, runs.length)]);
  }
  const none = records.filter((r) => r.siting.frontGap === null);
  if (none.length > 0) {
    bands.push([
      'No indoor piece',
      fmtRate(none.filter((r) => r.result === 'won').length, none.length),
    ]);
  }
  return [
    '\n' + table(rows),
    `Runs ending with a piece on the street-edge row: ${fmtRate(
      records.filter((r) => r.siting.touchesStreet).length,
      records.length,
    )}`,
    table(bands, [0, 1]),
  ].join('\n');
}

// ---------------------------------------------------------------------------------------
// Early completion (§8: its choices and payoff, per phase).

function earlyReport(content: Content, records: readonly RunRecord[]): string {
  const labels = [...new Set(records.map((r) => r.label))].join(', ') || 'these runs';
  const taken = records.flatMap((r) => r.early);
  if (taken.length === 0) return `\nEarly completion: never taken by ${labels}`;
  const rows: (string | number)[][] = [
    ['Early completion', 'Reached', 'Taken', 'Weeks saved', 'Bonus Wow', 'Bonus budget'],
  ];
  content.balance.phases.forEach((p, k) => {
    const reached = records.filter((r) => resolved(r, k + 1)).length;
    const at = taken.filter((e) => e.phase === k);
    rows.push([
      `${k + 1}. ${p.name}`,
      reached,
      `${at.length} (${pct(at.length, reached)})`,
      fix(avgOf(at.map((e) => e.weeksSaved)), 2),
      fix(avgOf(at.map((e) => e.score)), 1),
      fix(avgOf(at.map((e) => e.budget)), 1),
    ]);
  });
  return [
    `\n${table(rows)}`,
    `Early completions per run ${(taken.length / Math.max(1, records.length)).toFixed(2)}` +
      ` (${labels})`,
    'Weeks saved, Bonus Wow, and Bonus budget are means over the milestones taken early.',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------
// Fences (§8: a fenced yard costs greedy 2–3 placements on a typical lot).

export interface FenceStats {
  /** The enclosure probe's Fence-card count, over runs it found a yard for. */
  probes: number[];
  /** Fence-type cards offered through milestone 3, over runs that resolved it. */
  byM3: number[];
  /** The same through milestone 4. */
  byM4: number[];
  /** Runs with a probe that resolved milestone 4, and those offered at least the probe's count. */
  covered: { k: number; n: number };
}

export function fenceStats(records: readonly RunRecord[]): FenceStats {
  const through = (r: RunRecord, k: number) => sumOf(r.wallOffers.slice(0, k));
  const withProbe = records.filter((r) => r.enclosure !== null && resolved(r, 4));
  return {
    probes: records.flatMap((r) => (r.enclosure ? [r.enclosure.placements] : [])),
    byM3: records.filter((r) => resolved(r, 3)).map((r) => through(r, 3)),
    byM4: records.filter((r) => resolved(r, 4)).map((r) => through(r, 4)),
    covered: {
      k: withProbe.filter((r) => through(r, 4) >= r.enclosure!.placements).length,
      n: withProbe.length,
    },
  };
}

function fenceReport(records: readonly RunRecord[]): string {
  const n = records.length;
  const f = fenceStats(records);
  const avg = sumOf(records.map((r) => r.fencePlacements)) / Math.max(1, n);
  const out = [
    `\nFences: ${avg.toFixed(2)} placed per run; runs ending with a fenced yard ` +
      pct1(records.filter((r) => r.fencedYard > 0).length, n),
  ];
  if (f.probes.length > 0) {
    const yards = records.flatMap((r) => (r.enclosure ? [r.enclosure.yard] : []));
    out.push(
      `Enclosure probe after milestone 3 (Fence cards for the cheapest fenced yard), n=${f.probes.length}:`,
      `  p25 ${rankQuantile(f.probes, 25)} · p50 ${rankQuantile(f.probes, 50)}` +
        ` · p75 ${rankQuantile(f.probes, 75)}` +
        ` · one card ${pct1(f.probes.filter((p) => p === 1).length, f.probes.length)}` +
        ` · yard p50 ${rankQuantile(yards, 50)} tiles`,
      `  ${pct(f.probes.length, records.filter((r) => r.cleared >= 3).length)} of the houses` +
        ` that met milestone 3 can be fenced with 6 cards or fewer`,
    );
  } else {
    out.push('Enclosure probe: not probed');
  }
  const atLeast2 = (xs: number[]) => pct1(xs.filter((x) => x >= 2).length, xs.length);
  out.push(
    'Fence-type cards offered in the weeks’ first hands:',
    `  by milestone 3: p50 ${fix(rankQuantile(f.byM3, 50), 0)}, 2 or more in` +
      ` ${atLeast2(f.byM3)} of ${f.byM3.length} runs`,
    `  by milestone 4: p50 ${fix(rankQuantile(f.byM4, 50), 0)}, 2 or more in` +
      ` ${atLeast2(f.byM4)} of ${f.byM4.length} runs`,
    `  by milestone 4, at least the probe’s count: ${fmtRate(f.covered.k, f.covered.n)}`,
  );
  return out.join('\n');
}

// ---------------------------------------------------------------------------------------
// The economy (M3).

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

/** A card type's name (a piece's root type, or a fixture). */
function typeName(content: Content, id: string): string {
  const pieces = content.pieces as Readonly<Record<string, { name: string }>>;
  const fixtures = content.fixtures as Readonly<Record<string, { name: string }>>;
  return pieces[id]?.name ?? fixtures[id]?.name ?? id;
}

/** Policies that shop with sim/policies/shop.ts, so BOT_BLIND applies to them. */
const SHOP_BOT_POLICIES: readonly string[] = ['greedy'];
/** The Bot column's width: longer reasons are printed in full under the table. */
const BOT_COLUMN = 22;

const KIND_HEADINGS: Readonly<Record<string, string>> = {
  blueprint: 'Blueprints',
  piece: 'Pieces',
  fixture: 'Fixtures',
  tool: 'Tools',
  crate: 'Crates',
  upgrade: 'Upgrades',
  service: 'Services',
};

/** M3's economy tables: the shop, budget, strikes, rerolls, fixtures, and tools. */
export function economyReport(content: Content, records: readonly RunRecord[]): string {
  const out: string[] = [];
  const n = Math.max(1, records.length);
  const wins = records.filter((r) => r.result === 'won');
  const keys = new Set<string>();
  for (const r of records) {
    Object.keys(r.economy.offered).forEach((k) => keys.add(k));
    Object.keys(r.economy.bought).forEach((k) => keys.add(k));
    Object.keys(r.economy.picked).forEach((k) => keys.add(k));
    Object.keys(r.economy.inCrates).forEach((k) => keys.add(k));
  }
  const order = Object.keys(KIND_HEADINGS);
  const sorted = [...keys].sort(
    (a, b) =>
      order.indexOf(a.split(':')[0]!) - order.indexOf(b.split(':')[0]!) ||
      goodName(content, a).localeCompare(goodName(content, b)),
  );
  const sum = (f: (r: RunRecord) => number) => sumOf(records.map(f));
  const used = new Set(records.flatMap((r) => r.economy.tools.map((t) => t.id)));
  // BOT_BLIND describes the shop bot (sim/policies/shop.ts), which greedy and its variants use.
  const shopBot = records.some((r) => SHOP_BOT_POLICIES.includes(r.policy));
  /** Reasons too long for the Bot column (it would pass ~100 columns) go under the table. */
  const notes: string[] = [];
  const rows: (string | number)[][] = [
    ['Good', 'Shelf', 'Bought', 'Rate', 'Crates', 'Kept', 'Runs', 'Wins', 'Bot'],
  ];
  let kind = '';
  for (const key of sorted) {
    const k = key.split(':')[0]!;
    if (k !== kind) {
      kind = k;
      rows.push([`${KIND_HEADINGS[k] ?? k}:`]);
    }
    const offered = sum((r) => r.economy.offered[key] ?? 0);
    const bought = sum((r) => r.economy.bought[key] ?? 0);
    const has = (r: RunRecord) => (r.economy.bought[key] ?? 0) + (r.economy.picked[key] ?? 0) > 0;
    const neverUsed = k === 'tool' && bought > 0 && !used.has(key.slice(k.length + 1));
    let bot = (shopBot ? BOT_BLIND[key] : undefined) ?? (neverUsed ? 'bought, never used' : '');
    if (bot.length > BOT_COLUMN) {
      notes.push(`  ${goodName(content, key)}: ${bot}`);
      bot = 'see below';
    }
    rows.push([
      goodName(content, key),
      offered,
      bought,
      pct(bought, offered),
      sum((r) => r.economy.inCrates[key] ?? 0),
      sum((r) => r.economy.picked[key] ?? 0),
      pct(records.filter(has).length, records.length),
      pct(wins.filter(has).length, wins.length),
      bot,
    ]);
  }
  out.push(
    `\nShop: ${sum((r) => r.economy.visits)} visits, ${sum((r) => r.economy.refreshes)} refreshes`,
  );
  out.push(table(rows, [0, 8]));
  if (notes.length > 0) out.push(['Bot, in full:', ...notes].join('\n'));
  out.push(
    [
      'Shelf: times on offer (each visit and refresh). Crates: shown in an opened crate. Kept: picked',
      'from one. Runs, Wins: runs and wins that held it. Bot: why the bot never values or uses it.',
      'Wins is confounded: longer runs visit more shops, so common goods look strong. Ask strength',
      'questions with --ban or --gift on paired seeds.',
    ].join('\n'),
  );
  const left = records.map((r) => r.economy.budgetLeft);
  const earned = records.map((r) => r.economy.budgetEarned);
  const spendable = records.map((r) => r.economy.budgetEarned - r.economy.finalReward);
  const atLeave = records.flatMap((r) => r.economy.budgetAtLeave);
  out.push(
    [
      `Budget earned per run: p50 ${fmt(percentile(earned, 50))} (p10 ${fmt(percentile(earned, 10))},` +
        ` p90 ${fmt(percentile(earned, 90))})`,
      `Spendable (less the last milestone’s budget, which no shop follows): p50` +
        ` ${fmt(percentile(spendable, 50))} (p10 ${fmt(percentile(spendable, 10))},` +
        ` p90 ${fmt(percentile(spendable, 90))})`,
      `Budget held when leaving a shop: p50 ${fmt(percentile(atLeave, 50))},` +
        ` p90 ${fmt(percentile(atLeave, 90))} (${atLeave.length} visits)`,
      `Budget left unspent at the end: p50 ${fmt(percentile(left, 50))},` +
        ` p90 ${fmt(percentile(left, 90))}, mean ${fix(avgOf(left), 1)}`,
      `Shop visits left without buying (skip reward): ${pct(
        sum((r) => r.economy.skips),
        sum((r) => r.economy.visits),
      )}` + ` · goods sold per run ${(sum((r) => r.economy.sold) / n).toFixed(2)}`,
      `Bonus rerolls per run: bought ${(sum((r) => r.economy.bonusRerollsBought) / n).toFixed(2)}` +
        ` · used ${(sum((r) => r.economy.bonusRerollsUsed) / n).toFixed(2)}` +
        ` · held at the end ${(sum((r) => r.economy.bonusRerollsHeld) / n).toFixed(2)}`,
    ].join('\n'),
  );
  out.push(strikesReport(content, records));
  out.push(fixturesReport(content, records));
  out.push(toolsReport(content, records));
  return out.join('\n');
}

function strikesReport(content: Content, records: readonly RunRecord[]): string {
  const byType = new Map<string, { strikes: number; runs: number; firstShop: number[] }>();
  for (const r of records) {
    const seen = new Set<string>();
    for (const s of r.struck) {
      const t = byType.get(s.type) ?? { strikes: 0, runs: 0, firstShop: [] };
      t.strikes++;
      if (!seen.has(s.type)) {
        seen.add(s.type);
        t.runs++;
        t.firstShop.push(s.shop);
      }
      byType.set(s.type, t);
    }
  }
  if (byType.size === 0) return 'Strikes: none bought';
  const rows: (string | number)[][] = [['Struck type', 'Strikes', 'Runs', 'First at shop (p50)']];
  for (const [type, t] of [...byType].sort((a, b) => b[1].runs - a[1].runs)) {
    rows.push([
      typeName(content, type),
      t.strikes,
      pct1(t.runs, records.length),
      rankQuantile(t.firstShop, 50),
    ]);
  }
  return `\n${table(rows)}`;
}

function fixturesReport(content: Content, records: readonly RunRecord[]): string {
  const n = Math.max(1, records.length);
  const rows: (string | number)[][] = [
    ['Fixture', 'Installs', 'From hand', 'From supplies', 'Gain that week', 'Gain × weeks left'],
  ];
  const fixtures = new Map<
    string,
    { hand: number; supplies: number; gains: number[]; lasting: number[] }
  >();
  for (const r of records) {
    for (const i of r.economy.installs) {
      const f = fixtures.get(i.id) ?? { hand: 0, supplies: 0, gains: [], lasting: [] };
      f[i.from]++;
      f.gains.push(i.gain);
      f.lasting.push(i.gain * i.weeksLeft);
      fixtures.set(i.id, f);
    }
  }
  for (const [id, f] of [...fixtures].sort((a, b) => b[1].gains.length - a[1].gains.length)) {
    rows.push([
      content.fixtures[id as keyof typeof content.fixtures]?.name ?? id,
      f.gains.length,
      f.hand,
      f.supplies,
      fix(avgOf(f.gains), 1),
      fix(avgOf(f.lasting), 0),
    ]);
  }
  const installs = sumOf(records.map((r) => r.economy.installs.length));
  return [
    `\nFixtures: ${(installs / n).toFixed(2)} installs per run`,
    rows.length > 1 ? table(rows) : '(none installed)',
  ].join('\n');
}

function toolsReport(content: Content, records: readonly RunRecord[]): string {
  const n = Math.max(1, records.length);
  const rows: (string | number)[][] = [
    ['Tool', 'Uses', 'Runs using it', 'Held at end', 'Gain that week', 'Gain × weeks left'],
  ];
  const tools = new Map<
    string,
    { gains: number[]; lasting: number[]; runs: number; held: number }
  >();
  const entry = (id: string) => {
    const e = tools.get(id) ?? { gains: [], lasting: [], runs: 0, held: 0 };
    tools.set(id, e);
    return e;
  };
  for (const r of records) {
    const seen = new Set<string>();
    for (const t of r.economy.tools) {
      const e = entry(t.id);
      e.gains.push(t.gain);
      e.lasting.push(t.gain * t.weeksLeft);
      if (!seen.has(t.id)) {
        e.runs++;
        seen.add(t.id);
      }
    }
    for (const id of new Set(r.economy.heldAtEnd)) entry(id).held++;
  }
  const defs = content.tools as Readonly<Record<string, Content['tools'][keyof Content['tools']]>>;
  for (const [id, t] of [...tools].sort(
    (a, b) => b[1].gains.length - a[1].gains.length || b[1].held - a[1].held,
  )) {
    // Remodel Plans lasts the run; the other tools act on one week (or once).
    const lasting = defs[id]?.use.kind === 'levelSet';
    rows.push([
      defs[id]?.name ?? id,
      t.gains.length,
      pct(t.runs, records.length),
      pct(t.held, records.length),
      fix(avgOf(t.gains), 1),
      lasting ? fix(avgOf(t.lasting), 0) : '–',
    ]);
  }
  const uses = sumOf(records.map((r) => r.economy.tools.length));
  return [
    `\nTools: ${(uses / n).toFixed(2)} uses per run`,
    rows.length > 1 ? table(rows) : '(none used or held)',
  ].join('\n');
}

// ---------------------------------------------------------------------------------------
// §8's starting criteria. Each verdict goes by the point estimate; `sure` says the 95% interval
// sits entirely on the same side of the line, so more runs wouldn't be expected to flip it.

export interface CriteriaInput {
  greedy?: readonly RunRecord[];
  random?: readonly RunRecord[];
  novice?: readonly RunRecord[];
  /** Greedy with early completion always taken, on the same seeds as `greedy` (never). */
  earlyAlways?: readonly RunRecord[];
}

export interface Criterion {
  id: string;
  text: string;
  measured: string;
  verdict: 'PASS' | 'FAIL' | 'NOT MEASURED';
  sure: boolean;
}

/** PASS when the estimate is in [min, max]; sure when the interval [lo, hi] agrees. */
function judge(
  est: number,
  lo: number,
  hi: number,
  min: number,
  max: number,
): Pick<Criterion, 'verdict' | 'sure'> {
  const pass = est >= min && est <= max;
  return {
    verdict: pass ? 'PASS' : 'FAIL',
    sure: pass ? lo >= min && hi <= max : hi < min || lo > max,
  };
}

function rateCriterion(
  id: string,
  text: string,
  runs: readonly RunRecord[] | undefined,
  who: string,
  hit: (r: RunRecord) => boolean,
  min: number,
  max = 1,
): Criterion {
  if (!runs || runs.length === 0) {
    return { id, text, measured: `no ${who} runs`, verdict: 'NOT MEASURED', sure: false };
  }
  const k = runs.filter(hit).length;
  const w = wilson(k, runs.length);
  return { id, text, measured: fmtRate(k, runs.length), ...judge(w.p, w.lo, w.hi, min, max) };
}

/** A distribution-free 95% interval for the median of whole numbers, from order statistics. */
function medianInterval(values: readonly number[]): { est: number; lo: number; hi: number } {
  const sorted = [...values].sort((a, b) => a - b);
  const n = sorted.length;
  const half = (1.96 * Math.sqrt(n)) / 2;
  const at = (rank: number) => sorted[Math.min(n, Math.max(1, rank)) - 1]!;
  return {
    est: rankQuantile(sorted, 50),
    lo: at(Math.floor(n / 2 - half)),
    hi: at(Math.ceil(n / 2 + half) + 1),
  };
}

/**
 * Early completion always vs never: the difference in win rate, in points, with a 95% interval.
 * Paired by seed when the seeds match (the variants share greedy's streams), else unpaired.
 */
function earlyDifference(
  always: readonly RunRecord[],
  never: readonly RunRecord[],
): { diff: number; lo: number; hi: number; n: string; ratio: number } {
  const bySeed = new Map(never.map((r) => [r.seed, r]));
  const pairs = always.flatMap((a) => {
    const b = bySeed.get(a.seed);
    return b ? [[a, b] as const] : [];
  });
  const won = (r: RunRecord) => (r.result === 'won' ? 1 : 0);
  if (pairs.length > 0) {
    const m = pairs.length;
    const up = pairs.filter(([a, b]) => won(a) > won(b)).length;
    const down = pairs.filter(([a, b]) => won(a) < won(b)).length;
    const diff = (up - down) / m;
    const se = Math.sqrt(Math.max(0, up + down - (up - down) ** 2 / m)) / m;
    return {
      diff,
      lo: diff - 1.96 * se,
      hi: diff + 1.96 * se,
      n: `paired by seed, n=${m}: ${up} won only with always, ${down} only with never`,
      ratio: percentile(
        pairs.map(([a, b]) => a.finalScore / Math.max(1, b.finalScore)),
        50,
      ),
    };
  }
  const p1 = avgOf(always.map(won));
  const p2 = avgOf(never.map(won));
  const se = Math.sqrt((p1 * (1 - p1)) / always.length + (p2 * (1 - p2)) / never.length);
  return {
    diff: p1 - p2,
    lo: p1 - p2 - 1.96 * se,
    hi: p1 - p2 + 1.96 * se,
    n: `unpaired, n=${always.length} and ${never.length}`,
    ratio:
      percentile(
        always.map((r) => r.finalScore),
        50,
      ) /
      Math.max(
        1,
        percentile(
          never.map((r) => r.finalScore),
          50,
        ),
      ),
  };
}

export function criteria(content: Content, input: CriteriaInput): Criterion[] {
  const { greedy, random, novice, earlyAlways } = input;
  const phases = content.balance.phases.length;
  const out: Criterion[] = [];
  out.push(
    rateCriterion(
      'random-fails-by-3',
      `random fails by milestone 3: ≥ 95% of runs lose at or before it`,
      random,
      'random',
      (r) => r.result === 'lost' && r.cleared < Math.min(3, phases),
      0.95,
    ),
  );
  out.push(
    novice && novice.length > 0
      ? rateCriterion(
          'milestone-1-teaches',
          'milestone 1 teaches: novice passes it in ≥ 90% of runs',
          novice,
          'novice',
          (r) => r.cleared >= 1,
          0.9,
        )
      : rateCriterion(
          'milestone-1-teaches',
          'milestone 1 teaches: random passes it in ≥ 50% of runs (no novice runs given)',
          random,
          'random or novice',
          (r) => r.cleared >= 1,
          0.5,
        ),
  );
  out.push(
    rateCriterion(
      'greedy-clears-1-3',
      'greedy clears milestones 1–3 in 92–98% of runs',
      greedy,
      'greedy',
      (r) => r.cleared >= 3,
      0.92,
      0.98,
    ),
  );
  out.push(
    rateCriterion(
      'greedy-wins',
      'greedy wins 40–50% of runs',
      greedy,
      'greedy',
      (r) => r.result === 'won',
      0.4,
      0.5,
    ),
  );
  const earlyText =
    'early completion is a live choice: greedy wins within 10 points, always vs never';
  if (greedy && greedy.length > 0 && earlyAlways && earlyAlways.length > 0) {
    const d = earlyDifference(earlyAlways, greedy);
    const winRate = (rs: readonly RunRecord[]) =>
      pc1(rs.filter((r) => r.result === 'won').length / rs.length);
    const pts = (x: number) => `${x >= 0 ? '+' : '−'}${Math.abs(x * 100).toFixed(1)}`;
    out.push({
      id: 'early-live',
      text: earlyText,
      measured:
        `always ${winRate(earlyAlways)}% vs never ${winRate(greedy)}%: ${pts(d.diff)} points` +
        ` [${pts(d.lo)}, ${pts(d.hi)}]\n${d.n}\nfinal score, always ÷ never: p50 ${fix(d.ratio, 2)}`,
      ...judge(d.diff, d.lo, d.hi, -0.1, 0.1),
    });
  } else {
    out.push({
      id: 'early-live',
      text: earlyText,
      measured: 'needs greedy and early-always runs on the same seeds',
      verdict: 'NOT MEASURED',
      sure: false,
    });
  }
  const fenceText =
    'fences pay their way: probe p50 2–3; ≥ 50% of runs see that many by milestone 4';
  const f = greedy ? fenceStats(greedy) : null;
  if (f && f.probes.length > 0 && f.covered.n > 0) {
    const med = medianInterval(f.probes);
    const share = wilson(f.covered.k, f.covered.n);
    const a = judge(med.est, med.lo, med.hi, 2, 3);
    const b = judge(share.p, share.lo, share.hi, 0.5, 1);
    const pass = a.verdict === 'PASS' && b.verdict === 'PASS';
    out.push({
      id: 'fences-pay',
      text: fenceText,
      measured:
        `enclosure probe p50 ${med.est} Fence cards [${med.lo}–${med.hi}] n=${f.probes.length}\n` +
        `offered their probe’s count by milestone 4: ${fmtRate(f.covered.k, f.covered.n)}`,
      verdict: pass ? 'PASS' : 'FAIL',
      sure: pass
        ? a.sure && b.sure
        : (a.verdict === 'FAIL' && a.sure) || (b.verdict === 'FAIL' && b.sure),
    });
  } else {
    out.push({
      id: 'fences-pay',
      text: fenceText,
      measured: 'needs greedy runs with the enclosure probe that reach milestone 4',
      verdict: 'NOT MEASURED',
      sure: false,
    });
  }
  const notMeasured = (id: string, text: string, why: string): Criterion => ({
    id,
    text,
    measured: why,
    verdict: 'NOT MEASURED',
    sure: false,
  });
  out.push(
    notMeasured('planner-wins', 'planner wins about 75% of runs', 'no planner bot yet (M6)'),
    notMeasured(
      'no-must-buy',
      'no must-buy: no blueprint, upgrade, or tool in more than about 60% of planner wins',
      'needs the planner; until then, compare --ban kind:id on paired seeds',
    ),
  );
  out.push(spreadCriterion(content, greedy));
  return out;
}

/** §8: no Core client or crew more than about 15 points of greedy's win rate from the others. */
function spreadCriterion(content: Content, greedy: readonly RunRecord[] | undefined): Criterion {
  const text = 'no Core client or crew is more than about 15 points of win rate from the others';
  const id = 'client-crew-spread';
  if (!greedy || greedy.length === 0) {
    return { id, text, measured: 'no greedy runs', verdict: 'NOT MEASURED', sure: false };
  }
  const parts: string[] = [];
  let worst = 0;
  let sure = true;
  let groupsSeen = 0;
  for (const [label, key, names] of [
    ['clients', (r: RunRecord) => r.client, content.clients],
    ['crews', (r: RunRecord) => r.crew, content.crews],
  ] as const) {
    const groups = groupBy(greedy, key as (r: RunRecord) => string);
    if (groups.size < 2) continue;
    groupsSeen++;
    const rates = [...groups].map(([k, rs]) => {
      const w = wilson(rs.filter((r) => r.result === 'won').length, rs.length);
      const name = (names as Record<string, { name: string }>)[k]?.name ?? k;
      return { name, ...w, n: rs.length };
    });
    const hi = rates.reduce((a, b) => (b.p > a.p ? b : a));
    const lo = rates.reduce((a, b) => (b.p < a.p ? b : a));
    const spread = hi.p - lo.p;
    worst = Math.max(worst, spread);
    // Sure when even the intervals' near ends are within 15 points (or past it, for a fail).
    if (spread <= 0.15) sure &&= hi.hi - lo.lo <= 0.15;
    else sure &&= hi.lo - lo.hi > 0.15;
    parts.push(
      `${label}: ${rates.map((r) => `${r.name} ${pc1(r.p)}% (n=${r.n})`).join(', ')}; spread ` +
        `${(spread * 100).toFixed(1)} points`,
    );
  }
  if (groupsSeen === 0) {
    return {
      id,
      text,
      measured: 'one client and one crew in these runs (use --client all, --crew all)',
      verdict: 'NOT MEASURED',
      sure: false,
    };
  }
  return { id, text, measured: parts.join('\n'), verdict: worst <= 0.15 ? 'PASS' : 'FAIL', sure };
}

export function criteriaReport(content: Content, input: CriteriaInput): string {
  const lines = [
    "\n§8 starting criteria (verdict by the estimate; 'unsure' when the 95% interval crosses the line)",
  ];
  for (const c of criteria(content, input)) {
    const verdict =
      c.verdict === 'NOT MEASURED' ? c.verdict : c.sure ? c.verdict : `${c.verdict}, unsure`;
    lines.push(`${verdict.padEnd(14)}${c.text}`);
    for (const m of c.measured.split('\n')) lines.push(`${' '.repeat(14)}${m}`);
  }
  return lines.join('\n');
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

/**
 * α for the teaching milestone. M4a's house rules raise greedy's first-milestone median to
 * about 70, and at 0.4 (a target of 30) the novice bot passes only 85% (§8 wants 90%), so it's
 * a fifth: about 15, where the systems review kept it.
 */
export const ALPHA_FIRST = 0.2;
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
