// The smoke sim in npm test (§9): the random bot plays 5 seeded runs of the real game to the
// end, with no run-breaking bugs; each run code replays to the same state; and the same seed
// and policy give the same results (§8, Determinism). Greedy runs stay in npm run sim.

import { describe, expect, it } from 'vitest';
import { decodeRunCode, encodeRunCode, rules } from '../src/rules/index.ts';
import { POLICIES } from './policies/index.ts';
import { estimateSurvival, percentile, tidy } from './report.ts';
import { simulateRun, type RunRecord } from './simulate.ts';

describe('the smoke sim', () => {
  it('plays 5 random runs to the end, and each one replays from its run code', () => {
    for (let i = 0; i < 5; i++) {
      const { record, actions, state } = simulateRun(rules, `smoke-${i}`, POLICIES.random!, {
        probePhase: null,
      });
      expect(['won', 'lost']).toContain(state.screen);
      expect(record.weeks).toBeLessThanOrEqual(30);
      expect(record.weekly.length).toBeGreaterThan(0);
      const code = encodeRunCode({ build: 'test', contentHash: 'x', setup: state.setup, actions });
      const decoded = decodeRunCode(code);
      if (!decoded.ok) throw new Error(decoded.error);
      const replayed = rules.replay(decoded.data.setup, decoded.data.actions);
      expect(replayed.failedAt).toBeUndefined();
      expect(replayed.state).toEqual(state);
    }
  }, 30_000);

  it('gives the same results for the same seed and policy', () => {
    for (const policy of [POLICIES.random!, POLICIES.greedy!]) {
      const a = simulateRun(rules, 'determinism', policy, { maxWeeks: 10 });
      const b = simulateRun(rules, 'determinism', policy, { maxWeeks: 10 });
      expect(b.actions).toEqual(a.actions);
      expect(b.state).toEqual(a.state);
      expect({ ...b.record, ms: 0 }).toEqual({ ...a.record, ms: 0 });
    }
  }, 30_000);

  it('greedy beats random', () => {
    // Random play may lose before week 8, so compare the last score each reached.
    const score = (name: 'random' | 'greedy', seed: string) =>
      simulateRun(rules, seed, POLICIES[name]!, { probePhase: null, maxWeeks: 8 }).record.weekly.at(
        -1,
      )!;
    expect(score('greedy', 'versus')).toBeGreaterThan(score('random', 'versus'));
  }, 30_000);
});

describe('the report math', () => {
  it('takes percentiles and tidies targets', () => {
    expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    expect(percentile([10, 20], 10)).toBe(11);
    expect(tidy(42)).toBe(40);
    expect(tidy(437)).toBe(440);
    expect(tidy(4321)).toBe(4300);
    expect(tidy(43_210)).toBe(43_200);
  });

  it('estimates survival with overtime borrowing weeks', () => {
    const run = (weekly: number[]): RunRecord => ({ weekly }) as RunRecord;
    // 4 weeks per phase, 2 phases: 10 by week 4 and 30 by week 8.
    const runs = [run([1, 2, 3, 10, 12, 14, 16, 30, 32, 40])];
    expect(estimateSurvival(runs, [10, 30], 4, 2).winRate).toBe(1);
    // Missing 11 at week 4 borrows week 5 (12), which pushes milestone 2 to week 9 (32).
    expect(estimateSurvival(runs, [11, 31], 4, 2).winRate).toBe(1);
    expect(estimateSurvival(runs, [11, 41], 4, 0).survival).toEqual([0, 0]);
  });
});
