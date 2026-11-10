import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEL } from './feel.ts';
import {
  bestWeek,
  glowOf,
  intensity,
  markTierSeen,
  pileCount,
  pilePieces,
  recordWeek,
  tierOf,
  tierSeen,
} from './ladder.ts';

describe('tierOf (§12, The celebration ladder)', () => {
  const pace = 100;

  it('is Normal under 2× pace, Good from 2×, Great from 5×, Huge from 25×', () => {
    expect(tierOf(0, pace)).toBe('normal');
    expect(tierOf(199, pace)).toBe('normal');
    expect(tierOf(200, pace)).toBe('good');
    expect(tierOf(499, pace)).toBe('good');
    expect(tierOf(500, pace)).toBe('great');
    expect(tierOf(2499, pace)).toBe('great');
    expect(tierOf(2500, pace)).toBe('huge');
  });

  it('makes a Great week that beats the best week Huge, and only a Great one', () => {
    expect(tierOf(600, pace, 550)).toBe('huge');
    expect(tierOf(600, pace, 600)).toBe('great');
    expect(tierOf(600, pace, 0)).toBe('great');
    // A Good week that beats the best stays Good: the record lifts Great weeks only.
    expect(tierOf(300, pace, 250)).toBe('good');
  });

  it('never divides by a pace under 1 (pace is at least 1 in the rules)', () => {
    expect(tierOf(1, 0)).toBe('normal');
    expect(tierOf(2, 0)).toBe('good');
    expect(tierOf(25, -5)).toBe('huge');
  });

  it('keeps a week that earned nothing, or less, Normal', () => {
    expect(tierOf(-10, 1)).toBe('normal');
    expect(tierOf(Number.NaN, 1)).toBe('normal');
  });
});

describe('intensity and the glow', () => {
  it('is log5 of total ÷ pace', () => {
    expect(intensity(5, 1)).toBeCloseTo(1);
    expect(intensity(25, 1)).toBeCloseTo(2);
    expect(intensity(100, 100)).toBeCloseTo(0);
    expect(intensity(0, 1)).toBe(-Infinity);
  });

  it('glows from pace, more as I grows, fully at 25× pace', () => {
    expect(glowOf(null, 100)).toBe(0);
    expect(glowOf(99, 100)).toBe(0);
    expect(glowOf(100, 100)).toBeCloseTo(FEEL.glow.base);
    expect(glowOf(500, 100)).toBeGreaterThan(glowOf(200, 100));
    expect(glowOf(2500, 100)).toBeCloseTo(1);
    expect(glowOf(1e9, 100)).toBe(1);
  });
});

describe('the pile', () => {
  it('grows with the tier, and a Normal week has none', () => {
    expect(pileCount('normal')).toBe(0);
    expect(pileCount('good')).toBeLessThan(pileCount('great'));
    expect(pileCount('great')).toBeLessThan(pileCount('huge'));
  });

  it("takes the week's best earners, ties to the earliest placed, none that earned nothing", () => {
    const pieces = [
      { uid: 1, earned: 5 },
      { uid: 2, earned: 9 },
      { uid: 3, earned: 0 },
      { uid: 4, earned: 9 },
      { uid: 5, earned: 2 },
    ];
    expect(pilePieces(pieces, 3).map((p) => p.uid)).toEqual([2, 4, 1]);
    expect(pilePieces(pieces, 10).map((p) => p.uid)).toEqual([2, 4, 1, 5]);
    expect(pilePieces(pieces, 0)).toEqual([]);
  });
});

describe("the browser's records", () => {
  const store = new Map<string, string>();
  beforeEach(() => {
    store.clear();
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    });
  });
  afterEach(() => vi.unstubAllGlobals());

  it('keeps the best week, and only raises it', () => {
    const before = bestWeek();
    recordWeek(before + 1000);
    expect(bestWeek()).toBe(before + 1000);
    recordWeek(before + 10);
    expect(bestWeek()).toBe(before + 1000);
  });

  it('remembers which tiers have played in full', () => {
    markTierSeen('great');
    expect(tierSeen('great')).toBe(true);
    expect([...store.values()].some((v) => v.includes('great'))).toBe(true);
  });

  it('survives storage that throws', () => {
    vi.stubGlobal('localStorage', {
      getItem: () => {
        throw new Error('blocked');
      },
      setItem: () => {
        throw new Error('blocked');
      },
    });
    expect(() => recordWeek(1e12)).not.toThrow();
    expect(bestWeek()).toBe(1e12);
    expect(() => markTierSeen('huge')).not.toThrow();
    expect(tierSeen('huge')).toBe(true);
  });
});
