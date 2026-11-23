// The top bar's overtime clocks and the run's length in weeks (D-041, D-206): one clock for every
// overtime week the run has had, the rule's two and a neighbor's gift, the spent ones after those
// left; and each overtime week counted once, the last one too when the run ends in it.

import { describe, expect, it } from 'vitest';
import { rules, type MilestoneRecord, type RunState } from '../../rules/index.ts';
import { overtimeClocks, overtimeUsed } from './household.ts';

const start = rules.newRun({
  seed: 'overtime-clocks',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
});

/** A milestone met (in overtime when it used any): only `overtimeUsed` matters here. */
const met = (phase: number, overtime: number): MilestoneRecord => ({
  phase,
  result: overtime > 0 ? 'overtime' : 'onTime',
  target: 0,
  score: 0,
  weeksSaved: 0,
  overtimeUsed: overtime,
  reward: { budget: 0, score: 0, interest: 0 },
});

const at = (over: Partial<RunState>): RunState => ({ ...start, ...over });

describe('the overtime clocks', () => {
  it('start with the rule’s two, both left', () => {
    expect(rules.rule(start, 'overtime')).toBe(2);
    expect(overtimeClocks(start)).toEqual({ total: 2, left: 2 });
    expect(overtimeUsed(start)).toBe(0);
  });

  it('spend one in an overtime week, and keep it spent after its milestone', () => {
    const during = at({ phase: 1, milestones: [met(0, 0)], overtimeWeek: 1, overtimeLeft: 1 });
    expect(overtimeUsed(during)).toBe(1);
    expect(overtimeClocks(during)).toEqual({ total: 2, left: 1 });
    const after = at({ phase: 2, milestones: [met(0, 0), met(1, 1)], overtimeLeft: 1 });
    expect(overtimeUsed(after)).toBe(1);
    expect(overtimeClocks(after)).toEqual({ total: 2, left: 1 });
  });

  it('add the neighbor’s week as a third clock, all left when none was used', () => {
    const s = at({ phase: 4, milestones: [0, 1, 2, 3].map((p) => met(p, 0)), overtimeLeft: 3 });
    expect(overtimeClocks(s)).toEqual({ total: 3, left: 3 });
  });

  it('keep the weeks spent before the neighbor’s gift as spent clocks', () => {
    // Both of the rule's weeks spent by Roofing, then the neighbor's: 3 clocks, 1 left (2 before).
    const both = at({
      phase: 4,
      milestones: [met(0, 0), met(1, 1), met(2, 0), met(3, 1)],
      overtimeLeft: 1,
    });
    expect(overtimeUsed(both)).toBe(2);
    expect(overtimeClocks(both)).toEqual({ total: 3, left: 1 });
    // One spent, then the gift: 3 clocks, 2 left (2 before, both lit, and the spent one gone).
    const one = at({
      phase: 4,
      milestones: [met(0, 0), met(1, 1), met(2, 0), met(3, 0)],
      overtimeLeft: 2,
    });
    expect(overtimeClocks(one)).toEqual({ total: 3, left: 2 });
  });

  it('count the overtime week a run ends in once', () => {
    // Lost in Final Walkthrough's second overtime week: its milestone counted both weeks, and the
    // state still holds the week it ended in.
    const lost = at({
      screen: 'lost',
      phase: 6,
      milestones: [0, 1, 2, 3, 4, 5]
        .map((p) => met(p, 0))
        .concat({ ...met(6, 2), result: 'failed' }),
      overtimeWeek: 2,
      overtimeLeft: 0,
    });
    expect(overtimeUsed(lost)).toBe(2);
    expect(overtimeClocks(lost)).toEqual({ total: 2, left: 0 });
    // Won in an overtime week: the same.
    const won = at({
      screen: 'won',
      phase: 6,
      milestones: [0, 1, 2, 3, 4, 5].map((p) => met(p, 0)).concat(met(6, 1)),
      overtimeWeek: 1,
      overtimeLeft: 1,
    });
    expect(overtimeUsed(won)).toBe(1);
    expect(overtimeClocks(won)).toEqual({ total: 2, left: 1 });
  });
});
