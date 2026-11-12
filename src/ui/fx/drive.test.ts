// The street's traffic (fx/Drive.tsx): a crossing comes in from just past one end, leaves past
// the other, and stays out of sight for its pause, a whole art px at a time.

import { describe, expect, it } from 'vitest';
import { drivePlan } from './Drive.tsx';
import { FEEL } from './feel.ts';

describe('a crossing', () => {
  it('covers the span, the sprite on both ends, and the pause at its speed', () => {
    const { distance, ms } = drivePlan(1000, 61, 56, 5000);
    expect(distance).toBe(1000 + 2 * 61 + 280);
    expect(ms).toBe(Math.round((distance / 56) * 1000));
  });

  it('rounds a fractional span up, so the step stays a whole art px', () => {
    expect(drivePlan(999.2, 16, 20, 0).distance).toBe(1000 + 32);
    expect(Number.isInteger(drivePlan(512.7, 96, 56, 14000).distance)).toBe(true);
  });

  it('keeps the title’s car as it was (M5a)', () => {
    const viewW = 1280;
    const w = 61;
    const f = FEEL.street.carPxPerSecond;
    const expected = Math.ceil(viewW) + 2 * w + Math.round((f * FEEL.title.carPauseMs) / 1000);
    expect(drivePlan(viewW, w, f, FEEL.title.carPauseMs).distance).toBe(expected);
    expect(f).toBe(56);
  });
});
