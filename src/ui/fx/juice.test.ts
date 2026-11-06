import { describe, expect, it } from 'vitest';
import { FEEL } from './feel.ts';
import { budgetStepMs, shakeOffsets, tallySpeed } from './juice.ts';

describe('tallySpeed', () => {
  const speed = (chosen: number, accelerator: number, holding = false, closing = false) =>
    tallySpeed({ chosen, accelerator, holding, closing });

  it('adds auto-acceleration past 1, up to the cap', () => {
    expect(speed(1, 0)).toBe(1);
    expect(speed(1, 1)).toBe(1);
    expect(speed(1, 3)).toBe(3);
    expect(speed(2, 100)).toBe(2 + FEEL.tally.accelCap);
  });

  it('plays the closing beats at the chosen speed, however long the tally ran', () => {
    for (const chosen of FEEL.speeds) {
      expect(speed(chosen, 100, false, true)).toBe(chosen);
      expect(speed(chosen, 0, false, true)).toBe(chosen);
    }
  });

  it('holding fast-forwards, closing beats included', () => {
    expect(speed(1, 0, true)).toBe(FEEL.tally.holdSpeed);
    expect(speed(1, 0, true, true)).toBe(FEEL.tally.holdSpeed);
    expect(speed(0.5, 100, true, true)).toBe(FEEL.tally.holdSpeed);
    // A faster auto speed isn't slowed down by holding.
    expect(speed(4, 100, true)).toBe(4 + FEEL.tally.accelCap);
  });
});

describe('shakeOffsets', () => {
  /** The shake the director asks for: px at the default 50, scaled by the setting. */
  const atSetting = (px: number, setting: number) => shakeOffsets((px * setting) / 50);

  it('is none at a setting of 0, or when the shake rounds to nothing', () => {
    expect(atSetting(FEEL.shake.triggerPx, 0)).toBeNull();
    expect(atSetting(FEEL.shake.triggerPx, 5)).toBeNull();
    expect(shakeOffsets(0)).toBeNull();
    expect(shakeOffsets(-3)).toBeNull();
    expect(shakeOffsets(Number.NaN)).toBeNull();
  });

  it('moves in whole CSS px only', () => {
    for (let amount = 0; amount <= 20; amount += 0.05) {
      const o = shakeOffsets(amount);
      if (!o) continue;
      expect(Number.isInteger(o.full)).toBe(true);
      expect(Number.isInteger(o.half)).toBe(true);
      expect(o.full).toBeGreaterThanOrEqual(1);
      expect(o.half).toBeLessThanOrEqual(o.full);
    }
  });

  it('grows with the Screen shake setting, with no floor', () => {
    const full = (setting: number) => atSetting(FEEL.shake.triggerPx, setting)?.full ?? 0;
    expect(full(10)).toBe(0);
    expect(full(25)).toBe(1);
    expect(full(50)).toBe(FEEL.shake.triggerPx);
    expect(full(100)).toBe(FEEL.shake.triggerPx * 2);
    for (let s = 0; s < 100; s++) expect(full(s + 1)).toBeGreaterThanOrEqual(full(s));
    // The big week's shake is bigger than a trigger's at every setting.
    for (let s = 10; s <= 100; s += 10) {
      expect(atSetting(FEEL.shake.bigWeekPx, s)!.full).toBeGreaterThan(full(s));
    }
  });
});

describe('budgetStepMs', () => {
  const b = FEEL.budget;

  it('counts a gain coin by coin, faster for bigger amounts', () => {
    expect(budgetStepMs(1, false)).toBe(b.coinMs);
    expect(budgetStepMs(b.fastAbove, false)).toBe(b.coinMs);
    expect(budgetStepMs(b.fastAbove + 1, false)).toBe(b.fastMs);
    expect(budgetStepMs(b.fasterAbove + 1, false)).toBe(b.fasterMs);
    expect(budgetStepMs(b.jumpAbove, false)).toBe(b.fasterMs);
  });

  it('counts spending down at the fastest rate', () => {
    expect(budgetStepMs(-1, false)).toBe(b.fasterMs);
    expect(budgetStepMs(-b.jumpAbove, false)).toBe(b.fasterMs);
  });

  it('jumps above the threshold, and always with Reduce motion or the instant tally', () => {
    expect(budgetStepMs(b.jumpAbove + 1, false)).toBeNull();
    expect(budgetStepMs(-(b.jumpAbove + 1), false)).toBeNull();
    expect(budgetStepMs(3, true)).toBeNull();
    expect(budgetStepMs(-3, true)).toBeNull();
  });
});
