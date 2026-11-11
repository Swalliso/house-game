// The end screen's buttons come up where End week was, the moment the last tally ends. A
// double-click that skipped that tally used to land its second click on Title or New run, and
// the end screen can't be opened again. They now take no click until the screen has been up for
// FEEL.endScreen.clickDelayMs.

import { describe, expect, it } from 'vitest';
import { FEEL } from '../fx/feel.ts';
import { endScreenShown, settled } from './EndScreen.tsx';

describe("the end screen's buttons", () => {
  it('take no click just after the screen comes up, and take one after the delay', () => {
    const wait = FEEL.endScreen.clickDelayMs;
    endScreenShown(1000);
    // The second click of a double-click, and a slow one.
    expect(settled(1000)).toBe(false);
    expect(settled(1000 + 120)).toBe(false);
    expect(settled(1000 + wait - 1)).toBe(false);
    expect(settled(1000 + wait)).toBe(true);
  });

  it('wait again each time the screen comes up', () => {
    endScreenShown(1000);
    endScreenShown(5000);
    expect(settled(5000 + 120)).toBe(false);
  });

  it('wait longer than a double-click, and not so long that a meant click is lost', () => {
    expect(FEEL.endScreen.clickDelayMs).toBeGreaterThanOrEqual(500);
    expect(FEEL.endScreen.clickDelayMs).toBeLessThanOrEqual(1000);
  });
});
