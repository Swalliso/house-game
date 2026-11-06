// The sim report's math (§8, §9): percentiles, tidy targets, and the survival estimate behind
// --suggest-targets; Wilson intervals and rate formatting, §8's criteria verdicts on synthetic
// runs, the per-piece and score-layer aggregation on hand-made records, a whole report from a
// synthetic record, and one real run whose record adds up.

import { describe, expect, it } from 'vitest';
import { CONTENT, rules } from '../src/rules/index.ts';
import { POLICIES } from './policies/index.ts';
import { BOT_BLIND } from './policies/shop.ts';
import {
  criteria,
  criteriaReport,
  estimateSurvival,
  fmtRate,
  percentile,
  report,
  summarizeLayers,
  summarizePieces,
  summarizeSources,
  tidy,
  wilson,
  type Criterion,
} from './report.ts';
import { simulateRun, type PieceStats, type RunRecord } from './simulate.ts';

const PHASES = CONTENT.balance.phases.length;

function piece(over: Partial<PieceStats> = {}): PieceStats {
  return {
    offered: 0,
    dead: 0,
    placed: 0,
    earned: 0,
    wow: 0,
    pieceWeeks: 0,
    zeroWeeks: 0,
    unmetWeeks: 0,
    clusteredWeeks: 0,
    ...over,
  };
}

/** A synthetic run: `cleared` milestones met, then (unless it won) a failed one. */
function run(seed: string, cleared: number, over: Partial<RunRecord> = {}): RunRecord {
  const won = cleared >= PHASES;
  const milestones: RunRecord['milestones'] = [];
  for (let k = 0; k < Math.min(PHASES, cleared + 1); k++) {
    milestones.push({
      phase: k,
      result: k < cleared ? 'onTime' : 'failed',
      score: 100 * (k + 1),
      target: CONTENT.balance.phases[k]!.target,
    });
  }
  return {
    seed,
    policy: 'greedy',
    label: 'greedy',
    result: won ? 'won' : 'lost',
    cleared,
    milestones,
    weekly: [10, 30, 60, 100],
    weeks: 4 * (cleared + 1),
    placements: 4,
    passes: 0,
    rerolls: 0,
    fencePlacements: 0,
    fillPct: 10,
    fencedYard: 0,
    overtimeUsed: 0,
    overtimeExhausted: false,
    enclosure: null,
    economy: {
      offered: {},
      bought: {},
      picked: {},
      inCrates: {},
      sold: 0,
      refreshes: 0,
      skips: 0,
      visits: 0,
      budgetEarned: 0,
      budgetLeft: 0,
      finalReward: 0,
      budgetAtLeave: [],
      heldAtEnd: [],
      bonusRerollsBought: 0,
      bonusRerollsUsed: 0,
      bonusRerollsHeld: 0,
      installs: [],
      tools: [],
    },
    pieces: {},
    layers: { comfort: 0, charm: 0, sparkle: 0 },
    sources: { terrain: 0, street: 0, piece: 0, plain: 0, sets: 0 },
    setWow: 0,
    siting: { firstRow: 5, firstIndoorRow: 5, frontGap: 5, touchesStreet: false },
    early: [],
    struck: [],
    wallOffers: Array.from({ length: PHASES }, () => 0),
    finalScore: 1000,
    ms: 1,
    ...over,
  };
}

/** n runs: the first `k` clear `hit` milestones, the rest `miss`. */
function runs(prefix: string, n: number, k: number, hit: number, miss: number): RunRecord[] {
  return Array.from({ length: n }, (_, i) => run(`${prefix}-${i}`, i < k ? hit : miss));
}

const find = (cs: Criterion[], id: string) => {
  const c = cs.find((x) => x.id === id);
  if (!c) throw new Error(`no criterion ${id}`);
  return c;
};

describe('percentiles, tidy targets, and the survival estimate', () => {
  it('takes percentiles and tidies targets', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([10, 20], 10)).toBe(11);
    expect(tidy(42)).toBe(40);
    expect(tidy(437)).toBe(440);
    expect(tidy(4321)).toBe(4300);
    expect(tidy(43_210)).toBe(43_200);
  });

  it('estimates survival with overtime borrowing weeks', () => {
    const weekly = (w: number[]): RunRecord => ({ weekly: w }) as RunRecord;
    // 4 weeks per phase, 2 phases: 10 by week 4 and 30 by week 8.
    const runs = [weekly([1, 2, 3, 10, 12, 14, 16, 30, 32, 40])];
    expect(estimateSurvival(runs, [10, 30], 4, 2).winRate).toBe(1);
    // Missing 11 at week 4 borrows week 5 (12), which pushes milestone 2 to week 9 (32).
    expect(estimateSurvival(runs, [11, 31], 4, 2).winRate).toBe(1);
    expect(estimateSurvival(runs, [11, 41], 4, 0).survival).toEqual([0, 0]);
  });
});

describe('rates', () => {
  it('matches known Wilson 95% intervals', () => {
    const a = wilson(87, 200);
    expect(a.p).toBe(0.435);
    expect(a.lo).toBeCloseTo(0.3682, 4);
    expect(a.hi).toBeCloseTo(0.5043, 4);
    const b = wilson(5, 10);
    expect(b.lo).toBeCloseTo(0.2366, 4);
    expect(b.hi).toBeCloseTo(0.7634, 4);
    // At the ends the interval stays inside [0, 1] and doesn't collapse.
    expect(wilson(0, 10).lo).toBe(0);
    expect(wilson(0, 10).hi).toBeCloseTo(0.2775, 4);
    expect(wilson(10, 10).lo).toBeCloseTo(0.7225, 4);
    expect(wilson(10, 10).hi).toBe(1);
    expect(wilson(0, 0)).toEqual({ p: NaN, lo: 0, hi: 1 });
  });

  it('formats a rate with one decimal, the interval, and n', () => {
    expect(fmtRate(87, 200)).toBe('43.5% [36.8–50.4] n=200');
    expect(fmtRate(10, 10)).toBe('100.0% [72.2–100.0] n=10');
    expect(fmtRate(0, 0)).toBe('– n=0');
  });
});

describe('the criteria', () => {
  it('judges a range by the estimate, and is sure only when the interval agrees', () => {
    // 93 of 100 clear milestone 3: inside 92–98%, but the interval [86–97] crosses 92.
    let c = find(criteria(CONTENT, { greedy: runs('g', 100, 93, 3, 2) }), 'greedy-clears-1-3');
    expect([c.verdict, c.sure]).toEqual(['PASS', false]);
    expect(c.measured).toBe(fmtRate(93, 100));
    // 950 of 1,000: [93.5–96.2] sits inside.
    c = find(criteria(CONTENT, { greedy: runs('g', 1000, 950, 3, 2) }), 'greedy-clears-1-3');
    expect([c.verdict, c.sure]).toEqual(['PASS', true]);
    // 80 of 100: [71–87] is entirely below.
    c = find(criteria(CONTENT, { greedy: runs('g', 100, 80, 3, 2) }), 'greedy-clears-1-3');
    expect([c.verdict, c.sure]).toEqual(['FAIL', true]);
    // 90 of 100: below 92, but the interval [82.6–94.5] reaches above it.
    c = find(criteria(CONTENT, { greedy: runs('g', 100, 90, 3, 2) }), 'greedy-clears-1-3');
    expect([c.verdict, c.sure]).toEqual(['FAIL', false]);
  });

  it('checks the win rate, random’s floor, and milestone 1 by novice or else random', () => {
    const greedy = runs('g', 1000, 450, PHASES, 3);
    const cs = criteria(CONTENT, { greedy, random: runs('r', 100, 30, 3, 1) });
    expect(find(cs, 'greedy-wins')).toMatchObject({ verdict: 'PASS', sure: true });
    // 70 of 100 random runs lose at milestone 2 (cleared 1), 30 get past milestone 3.
    expect(find(cs, 'random-fails-by-3')).toMatchObject({ verdict: 'FAIL', sure: true });
    const m1 = find(cs, 'milestone-1-teaches');
    expect(m1.text).toContain('random');
    expect([m1.verdict, m1.sure]).toEqual(['PASS', true]);
    const withNovice = criteria(CONTENT, { novice: runs('n', 100, 85, 1, 0) });
    expect(find(withNovice, 'milestone-1-teaches')).toMatchObject({
      verdict: 'FAIL',
      sure: false,
    });
    expect(find(withNovice, 'milestone-1-teaches').text).toContain('novice');
  });

  it('pairs early always with never by seed', () => {
    const never = runs('s', 200, 90, PHASES, 4);
    // The same seeds: 30 seeds that won under never lose under always.
    const always = never.map((r, i) =>
      i >= 60 && i < 90 ? { ...r, result: 'lost' as const, cleared: 4, finalScore: 500 } : r,
    );
    const c = find(criteria(CONTENT, { greedy: never, earlyAlways: always }), 'early-live');
    expect([c.verdict, c.sure]).toEqual(['FAIL', true]);
    expect(c.measured).toContain('always 30.0% vs never 45.0%: −15.0 points');
    expect(c.measured).toContain(
      'paired by seed, n=200: 0 won only with always, 30 only with never',
    );
    const same = find(criteria(CONTENT, { greedy: never, earlyAlways: never }), 'early-live');
    expect([same.verdict, same.sure]).toEqual(['PASS', true]);
    expect(same.measured).toContain('p50 1.00');
  });

  it('checks fences against the probe and the Fence cards offered by milestone 4', () => {
    const fenced = (seed: string, placements: number, offers: number) =>
      run(seed, 4, {
        enclosure: { placements, boundary: 6, yard: 9 },
        wallOffers: [offers, 0, 0, 0, 0, 0, 0].slice(0, PHASES),
      });
    const pass = Array.from({ length: 100 }, (_, i) => fenced(`f-${i}`, 2, i < 70 ? 3 : 1));
    expect(find(criteria(CONTENT, { greedy: pass }), 'fences-pay')).toMatchObject({
      verdict: 'PASS',
      sure: true,
    });
    const tooFew = Array.from({ length: 100 }, (_, i) => fenced(`f-${i}`, 2, i < 20 ? 3 : 1));
    expect(find(criteria(CONTENT, { greedy: tooFew }), 'fences-pay')).toMatchObject({
      verdict: 'FAIL',
      sure: true,
    });
    const expensive = Array.from({ length: 100 }, (_, i) => fenced(`f-${i}`, 5, 9));
    expect(find(criteria(CONTENT, { greedy: expensive }), 'fences-pay').verdict).toBe('FAIL');
  });

  it('says what it can’t measure', () => {
    const cs = criteria(CONTENT, {});
    for (const id of ['planner-wins', 'no-must-buy', 'client-crew-spread', 'greedy-wins']) {
      expect(find(cs, id)).toMatchObject({ verdict: 'NOT MEASURED', sure: false });
    }
    const text = criteriaReport(CONTENT, { greedy: runs('g', 100, 45, PHASES, 3) });
    expect(text).toContain('PASS, unsure  greedy wins 40–50% of runs');
    expect(text).toContain('NOT MEASURED  planner wins about 75% of runs');
  });
});

describe('the aggregation', () => {
  const a = run('a', 3, {
    pieces: {
      bedroom: piece({ offered: 4, dead: 1, placed: 2, wow: 60, pieceWeeks: 6, zeroWeeks: 3 }),
      lKitchen: piece({ offered: 1, placed: 1, wow: 20, pieceWeeks: 4, clusteredWeeks: 2 }),
      // Never offered or placed (a transform's result): left out.
      tree: piece({ pieceWeeks: 3 }),
    },
    layers: { comfort: 50, charm: 40, sparkle: 10 },
    sources: { terrain: 10, street: -2, piece: 4, plain: 8, sets: 0 },
    struck: [{ type: 'bedroom', shop: 2 }],
  });
  const b = run('b', 3, {
    pieces: { bedroom: piece({ offered: 2, dead: 1, placed: 1, wow: 40, pieceWeeks: 4 }) },
    layers: { comfort: 100, charm: 0, sparkle: 0 },
    sources: { terrain: 0, street: 0, piece: 0, plain: 20, sets: 20 },
    setWow: 60,
    struck: [{ type: 'kitchen', shop: 1 }],
  });

  it('pools pieces over runs', () => {
    const rows = summarizePieces(CONTENT, [a, b]);
    expect(rows.map((r) => r.id)).toEqual(['bedroom', 'lKitchen']);
    const bed = rows[0]!;
    expect(bed.name).toBe('Bedroom');
    expect(bed.offered).toBe(3);
    expect(bed.placed).toBe(1.5);
    expect(bed.dead).toBeCloseTo(2 / 6);
    expect(bed.pick).toBe(0.5);
    expect(bed.fitPick).toBe(0.75);
    expect(bed.wowShare).toBe(0.5);
    expect(bed.wowPerCopy).toBeCloseTo(100 / 3);
    expect(bed.zeroWeeks).toBe(0.3);
    expect(bed.clustered).toBe(0);
    expect(bed.struck).toBe(0.5);
    // The L-Kitchen counts as a Kitchen, so striking Kitchens strikes it.
    const lk = rows[1]!;
    expect(lk.struck).toBe(0.5);
    expect(lk.clustered).toBe(0.5);
    expect(lk.wowShare).toBe(0.1);
  });

  it('gives the sets’ Points their own row, so the shares cover all the Wow', () => {
    const text = report(CONTENT, [a, b], 'shares');
    const row = text.split('\n').find((l) => l.startsWith('(set bonuses)'));
    // Bedroom 100, L-Kitchen 20, and the sets 60 of the 200 tallied Wow.
    expect(row).toContain('30.0%');
  });

  it('splits Wow into layers and flat points into sources, pooled and per run', () => {
    const layers = summarizeLayers([a, b]);
    expect(layers.comfort.share).toBe(0.75);
    expect(layers.charm.share).toBe(0.2);
    expect(layers.sparkle.share).toBe(0.05);
    expect(layers.comfort.p50).toBe(0.75);
    expect(layers.comfort.p10).toBeCloseTo(0.55);
    const sources = summarizeSources([a, b]);
    expect(sources.street.share).toBeCloseTo(-2 / 60);
    expect(sources.sets.share).toBeCloseTo(20 / 60);
    expect(sources.plain.p50).toBeCloseTo((0.4 + 0.5) / 2);
  });

  it('renders a whole report from synthetic records, and from none', () => {
    const rich = run('rich', PHASES, {
      pieces: a.pieces,
      layers: a.layers,
      sources: a.sources,
      struck: a.struck,
      enclosure: { placements: 2, boundary: 6, yard: 9 },
      overtimeExhausted: true,
      early: [{ phase: 0, weeksSaved: 2, score: 12, budget: 4 }],
      economy: {
        ...a.economy,
        offered: { 'tool:movingTruck': 2, 'tool:rushOrder': 1, 'service:reroll': 3 },
        bought: { 'tool:rushOrder': 1, 'service:reroll': 1 },
        inCrates: { 'blueprint:fengShui': 1 },
        picked: { 'blueprint:fengShui': 1 },
        budgetAtLeave: [1, 0],
        heldAtEnd: ['rushOrder'],
        installs: [{ id: 'fireplace', from: 'hand', gain: 5, week: 6, weeksLeft: 20 }],
        tools: [{ id: 'remodelEntertainer', gain: 30, week: 9, weeksLeft: 18 }],
      },
    });
    const text = report(CONTENT, [rich, b], 'synthetic');
    for (const part of [
      'synthetic: 2 runs',
      'Win rate 50.0%',
      'Runs that used every overtime week: 50.0%',
      'Bedroom',
      'Comfort (Points)',
      'House siting',
      '1. Groundbreaking',
      'Enclosure probe after milestone 3',
      'bought, never used',
      'Remodel Plans: Entertainer',
      '+1 reroll',
    ]) {
      expect(text).toContain(part);
    }
    // Rush Order was bought and never used; the Moving Truck is one of the bot's blind spots.
    expect(text).toMatch(/Rush Order .*bought, never used/);
    const blind = BOT_BLIND['tool:movingTruck'];
    if (blind) expect(text).toContain(blind);
    expect(() => report(CONTENT, [], 'empty')).not.toThrow();
    expect(report(CONTENT, [b], 'never early')).toContain(
      'Early completion: never taken by greedy',
    );
  });
});

describe('a real run’s record', () => {
  it('adds up: layers to the score, offers to the hands, placements to the pieces', () => {
    const { record, state } = simulateRun(rules, 'report-0', POLICIES.random!, {
      probePhase: null,
    });
    const { layers, pieces } = record;
    // Random never completes early, so every Wow came from a tally.
    expect(record.early).toEqual([]);
    expect(layers.comfort + layers.charm + layers.sparkle).toBe(record.finalScore);
    expect(record.finalScore).toBe(state.score);
    expect(record.weekly.at(-1)).toBe(state.score);
    const stats = Object.values(pieces);
    expect(stats.reduce((n, p) => n + p.placed, 0)).toBe(record.placements);
    const walls = Object.entries(pieces)
      .filter(([id]) => CONTENT.pieces[id as keyof typeof CONTENT.pieces].wall)
      .reduce((n, [, p]) => n + p.offered, 0);
    expect(record.wallOffers.reduce((n, x) => n + x, 0)).toBe(walls);
    for (const p of stats) {
      expect(p.dead).toBeLessThanOrEqual(p.offered);
      expect(p.zeroWeeks).toBeLessThanOrEqual(p.pieceWeeks);
      expect(p.clusteredWeeks).toBeLessThanOrEqual(p.pieceWeeks);
    }
    const h = state.house.lot.height;
    expect(record.siting.firstRow).toBeGreaterThanOrEqual(0);
    expect(record.siting.firstRow).toBeLessThan(h);
    expect(record.economy.finalReward).toBe(
      record.result === 'won' ? state.milestones.at(-1)!.reward.budget : 0,
    );
  });

  it('shares all of the Wow between the pieces and the sets', () => {
    // A greedy run builds sets, so the sets' row is tested with real Points in it.
    const { record } = simulateRun(rules, 'sim-3', POLICIES.greedy!, { probePhase: null });
    const pieceWow = Object.values(record.pieces).reduce((n, p) => n + p.wow, 0);
    expect(record.setWow).toBeGreaterThan(0);
    expect(pieceWow + record.setWow).toBeCloseTo(record.finalScore, 6);
  });
});
