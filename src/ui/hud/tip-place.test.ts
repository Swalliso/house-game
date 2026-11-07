// The tooltip's note (M5a): inside the window, its tail on the term, on whole device pixels.

import { describe, expect, it } from 'vitest';
import { NOTE_W, placeTip } from './tip-place.ts';

const VIEW = { w: 1920, h: 1080 };
const term = (x: number, below = false) => ({ x, top: 500, bottom: 520, below });

describe("the tooltip's note", () => {
  it('centers over its term, its tail under the term', () => {
    const at = placeTip(term(960), VIEW, 2, 1);
    expect(at.left).toBe(960 - (NOTE_W * 2) / 2);
    // The tail (9 UI px wide) is centered on the term.
    expect(at.left + at.tail + 4.5 * 2).toBe(960);
    // Over the term: 3 UI px of gap and 5 of tail between them.
    expect(at.bottom).toBe(1080 - 500 + 16);
    expect(at.top).toBeUndefined();
  });

  it('goes under a term near the top of the window', () => {
    const at = placeTip(term(960, true), VIEW, 2, 1);
    expect(at.top).toBe(520 + 16);
    expect(at.bottom).toBeUndefined();
  });

  it('stays inside the window at both edges, its tail clear of its corners', () => {
    const w = NOTE_W * 2;
    const nearLeft = placeTip(term(3), VIEW, 2, 1);
    expect(nearLeft.left).toBe(8);
    expect(nearLeft.tail).toBe(6);
    const nearRight = placeTip(term(1918), VIEW, 2, 1);
    expect(nearRight.left).toBe(1920 - w - 8);
    expect(nearRight.tail).toBe(w - 24);
  });

  it('lands every edge on a whole device pixel', () => {
    for (const dpr of [1, 1.25, 1.5, 2]) {
      const px = dpr === 1.25 ? 1.6 : 2;
      const at = placeTip({ x: 333.3, top: 401.7, bottom: 419.9, below: false }, VIEW, px, dpr);
      for (const v of [at.left, at.tail, at.bottom!]) {
        expect(v * dpr).toBeCloseTo(Math.round(v * dpr));
      }
    }
  });
});
