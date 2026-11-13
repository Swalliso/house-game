// D-151: a browser's first job is a run in `firstJob` mode, whose client needs the job board's
// firstTargetPct of its usual targets. Everything else about the run is a standard run's: the
// same lot, the same draws, the same scoring. The mode travels in the run code, so a replay
// meets the same targets.

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../content/index.ts';
import type { RunSetup } from './index.ts';
import { isRunMode, phaseTarget, targetPctFor } from './milestones.ts';
import { createRules } from './run.ts';
import { contentHash, decodeRunCode, encodeRunCode } from './runcode.ts';
import { roundHalfUp } from './scoring.ts';

const rules = createRules(CONTENT);
const b = CONTENT.balance;
const standard: RunSetup = {
  seed: 'oh-4243',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};
const first: RunSetup = { ...standard, mode: 'firstJob' };

describe('a first job’s targets (D-151)', () => {
  it('are each client’s, times the job board’s firstTargetPct, to a whole percent', () => {
    expect(b.jobBoard.firstTargetPct).toBe(73);
    for (const client of Object.values(CONTENT.clients)) {
      const setup = { ...standard, clientId: client.id };
      expect(targetPctFor(CONTENT, setup)).toBe(client.targetPct);
      expect(targetPctFor(CONTENT, { ...setup, mode: 'firstJob' })).toBe(
        roundHalfUp(client.targetPct * b.jobBoard.firstTargetPct, 100),
      );
    }
    // The Hendersons, the first job's client: 110% of the curve becomes 80%.
    expect(targetPctFor(CONTENT, first)).toBe(80);
  });

  it('are what the run is held to, milestone by milestone, and what its verdict reads', () => {
    let s = rules.newRun(first);
    let plain = rules.newRun(standard);
    for (let phase = 0; phase < b.phases.length; phase++) {
      s = { ...s, phase };
      plain = { ...plain, phase };
      expect(rules.target(s)).toBe(phaseTarget(b, phase, 80));
      expect(rules.target(plain)).toBe(phaseTarget(b, phase, 110));
      expect(rules.target(s)).toBeLessThan(rules.target(plain));
    }
    // A won run's verdict is measured against its own last target.
    const last = phaseTarget(b, b.phases.length - 1, 80);
    const top = b.verdicts[b.verdicts.length - 1]!;
    const won = {
      ...s,
      screen: 'won' as const,
      score: Math.ceil((last * top.minPctOfTarget) / 100),
    };
    expect(rules.verdict(won)).toBe(top.name);
    expect(rules.verdict({ ...won, setup: standard })).not.toBe(top.name);
  });

  it('change nothing else: the same lot, hand, budget and streams as a standard run', () => {
    const s = rules.newRun(first);
    const plain = rules.newRun(standard);
    // But the standing stock: a standard run's is there from week 1, a first job's comes in
    // Foundation's third week (D-162, stock.test.ts).
    expect(s.reserve).toEqual([]);
    expect(plain.reserve.length).toBeGreaterThan(0);
    expect(plain.reserve.every((r) => r.stock)).toBe(true);
    expect({ ...s, setup: plain.setup, reserve: plain.reserve }).toEqual(plain);
    // And a week played the same way scores the same.
    const a = rules.apply(s, { t: 'pass' }).state;
    const c = rules.apply(plain, { t: 'pass' }).state;
    expect(a.score).toBe(c.score);
    expect(a.hand).toEqual(c.hand);
  });

  it('travel in the run code, so a replay meets the same targets', () => {
    const code = encodeRunCode({
      build: 'abc1234',
      contentHash: contentHash(CONTENT),
      setup: first,
      actions: [{ t: 'pass' }],
    });
    const decoded = decodeRunCode(code);
    expect(decoded.ok && decoded.data.setup).toEqual(first);
    const { state, failedAt } = rules.replay(first, [{ t: 'pass' }]);
    expect(failedAt).toBeUndefined();
    expect(state.setup.mode).toBe('firstJob');
  });

  it('are the only other mode: an unknown one is a bad setup and a damaged code', () => {
    expect(isRunMode('standard')).toBe(true);
    expect(isRunMode('firstJob')).toBe(true);
    expect(isRunMode('daily')).toBe(false);
    expect(isRunMode(undefined)).toBe(false);
    const bad = { ...standard, mode: 'hard' } as unknown as RunSetup;
    expect(() => rules.newRun(bad)).toThrow('Bad run setup');
    const code = encodeRunCode({
      build: 'abc1234',
      contentHash: contentHash(CONTENT),
      setup: bad,
      actions: [],
    });
    expect(decodeRunCode(code).ok).toBe(false);
  });
});
