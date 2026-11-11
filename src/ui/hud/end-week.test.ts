// End week while a tally plays (D-068): Enter, or a click on the End week button, only hurries
// the tally. Before, the first such press armed a pass and the second confirmed it, so one
// double-click on End week passed the next week without the player seeing it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { busy, skip } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import { log, run, tentative } from '../store.ts';
import { passArmed, requestEndWeek } from './actions.ts';

vi.mock('../fx/director.ts', async (original) => ({
  ...(await original<typeof import('../fx/director.ts')>()),
  skip: vi.fn(),
}));

const start = run.value;

/** The clock End week reads; each test starts long after the last one's presses. */
let now = 0;
beforeEach(() => {
  now += 60_000;
  vi.spyOn(performance, 'now').mockImplementation(() => now);
});

afterEach(() => {
  vi.restoreAllMocks();
  run.value = start;
  busy.value = false;
  tentative.value = null;
  passArmed.value = false;
  vi.mocked(skip).mockClear();
});

describe('End week during a tally', () => {
  it('skips the tally, and neither arms nor confirms a pass, however often it is pressed', () => {
    run.value = { ...start, screen: 'build' };
    busy.value = true;
    const before = log.value;
    for (let press = 1; press <= 3; press++) {
      requestEndWeek();
      expect(passArmed.value).toBe(false);
      expect(skip).toHaveBeenCalledTimes(press);
    }
    expect(log.value).toBe(before);
    expect(run.value.week).toBe(start.week);
  });

  it('does not confirm a pass that was armed before the tally began', () => {
    run.value = { ...start, screen: 'build' };
    passArmed.value = true;
    busy.value = true;
    const before = log.value;
    requestEndWeek();
    expect(log.value).toBe(before);
  });

  it('does not arm a pass on a press just after the one that skipped it', () => {
    // Four quick presses: End week, a skip, and two more on the quiet board of the next week.
    run.value = { ...start, screen: 'build' };
    busy.value = true;
    requestEndWeek();
    busy.value = false;
    const before = log.value;
    now += 150;
    requestEndWeek();
    expect(passArmed.value).toBe(false);
    // Once the hurry is over, a pass is two presses again.
    now += FEEL.endWeek.hurryMs;
    requestEndWeek();
    expect(passArmed.value).toBe(true);
    expect(log.value).toBe(before);
  });

  it('still arms a pass on the first press once the board is quiet', () => {
    run.value = { ...start, screen: 'build' };
    requestEndWeek();
    expect(passArmed.value).toBe(true);
    expect(skip).not.toHaveBeenCalled();
  });
});
