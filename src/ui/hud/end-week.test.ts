// End week while a tally plays (D-068): Enter, or a click on the End week button, only hurries
// the tally. Before, the first such press armed a pass and the second confirmed it, so one
// double-click on End week passed the next week without the player seeing it.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { busy, skip } from '../fx/director.ts';
import { log, run, tentative } from '../store.ts';
import { passArmed, requestEndWeek } from './actions.ts';

vi.mock('../fx/director.ts', async (original) => ({
  ...(await original<typeof import('../fx/director.ts')>()),
  skip: vi.fn(),
}));

const start = run.value;

afterEach(() => {
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

  it('still arms a pass on the first press once the board is quiet', () => {
    run.value = { ...start, screen: 'build' };
    requestEndWeek();
    expect(passArmed.value).toBe(true);
    expect(skip).not.toHaveBeenCalled();
  });
});
