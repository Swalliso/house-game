// The milestone meter's week ticks (M5a): at the rules' pace, inside the meter, never doubled.

import { describe, expect, it } from 'vitest';
import { CONTENT, rules } from '../../rules/index.ts';
import { weekTicks } from './meter.ts';

describe("the milestone meter's week ticks", () => {
  it('mark each week boundary at the pace, as a fraction of the target', () => {
    expect(weekTicks(0, 25, 100, 4)).toEqual([0.25, 0.5, 0.75]);
    // A later phase starts from the score so far.
    expect(weekTicks(60, 10, 100, 4)).toEqual([0.7, 0.8, 0.9]);
  });

  it("follow the rules' own pace on a real run", () => {
    const s = rules.newRun({ seed: 'meter', crewId: 'generalContractor', mode: 'standard' });
    const target = rules.target(s);
    const weeks = CONTENT.balance.weeksPerPhase;
    const ticks = weekTicks(s.phaseStartScore, rules.pace(s), target, weeks);
    expect(ticks).toHaveLength(weeks - 1);
    ticks.forEach((t, k) => expect(t * target).toBeCloseTo(rules.pace(s) * (k + 1)));
  });

  it('leave out ticks at or past the target, so a phase that began met has none', () => {
    // The pace never drops below 1 (paceFor), so every tick would sit past the target.
    expect(weekTicks(120, 1, 100, 4)).toEqual([]);
    expect(weekTicks(100, 1, 100, 4)).toEqual([]);
    // Close to the target: only the ticks short of it.
    expect(weekTicks(97, 1, 100, 4)).toEqual([0.98, 0.99]);
    expect(weekTicks(0, 1, 0, 4)).toEqual([]);
  });

  it('never repeat a tick (they key the meter’s marks)', () => {
    for (const [start, pace, target] of [
      [0, 25, 100],
      [97, 1, 100],
      [5, 1, 9],
    ] as const) {
      const ticks = weekTicks(start, pace, target, 4);
      expect(new Set(ticks).size).toBe(ticks.length);
    }
  });
});
