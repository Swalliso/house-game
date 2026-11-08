// The tooltip's note (M5a): inside the window, its tail on the term, on whole device pixels, over
// its term where it fits, under it where it doesn't.

import { describe, expect, it } from 'vitest';
import { NOTE_W, placeTip } from './tip-place.ts';

const VIEW = { w: 1920, h: 1080 };
const term = (x: number, top = 500) => ({ x, top, bottom: top + 20 });
/** A note four lines tall, about 100 CSS px. */
const NOTE = 100;

describe("the tooltip's note", () => {
  it('centers over its term, its tail under the term', () => {
    const at = placeTip(term(960), VIEW, 2, 1, NOTE);
    expect(at.left).toBe(960 - (NOTE_W * 2) / 2);
    // The tail (9 UI px wide) is centered on the term.
    expect(at.left + at.tail + 4.5 * 2).toBe(960);
    // Over the term: 3 UI px of gap and 5 of tail between them.
    expect(at.bottom).toBe(1080 - 500 + 16);
    expect(at.top).toBeUndefined();
    expect(at.below).toBe(false);
  });

  it('goes under its term when the note is taller than the room above it', () => {
    // "Supplies" on a Retina screen: 176 CSS px from the top, a note 190 px tall.
    const at = placeTip(term(960, 176), VIEW, 2, 2, 190);
    expect(at.below).toBe(true);
    expect(at.top).toBe(196 + 16);
    expect(at.bottom).toBeUndefined();
    // A short note still fits over a term that high.
    expect(placeTip(term(960, 176), VIEW, 2, 2, 60).below).toBe(false);
  });

  it('never leaves the window: on the roomier side, pushed back inside', () => {
    // A note taller than the room on either side of a term in the middle of a short window.
    const view = { w: 1280, h: 300 };
    const at = placeTip(term(640, 120), view, 2, 1, 200);
    const top = at.top ?? view.h - at.bottom! - 200;
    expect(top).toBeGreaterThanOrEqual(8);
    expect(top + 200).toBeLessThanOrEqual(view.h - 8);
  });

  it('stays inside the window at both edges, its tail clear of its corners', () => {
    const w = NOTE_W * 2;
    const nearLeft = placeTip(term(3), VIEW, 2, 1, NOTE);
    expect(nearLeft.left).toBe(8);
    expect(nearLeft.tail).toBe(6);
    const nearRight = placeTip(term(1918), VIEW, 2, 1, NOTE);
    expect(nearRight.left).toBe(1920 - w - 8);
    expect(nearRight.tail).toBe(w - 24);
  });

  it('lands every edge on a whole device pixel', () => {
    for (const dpr of [1, 1.25, 1.5, 2]) {
      const px = dpr === 1.25 ? 1.6 : 2;
      for (const t of [
        { x: 333.3, top: 401.7, bottom: 419.9 },
        { x: 333.3, top: 31.7, bottom: 49.9 },
      ]) {
        const at = placeTip(t, VIEW, px, dpr, 97.3);
        for (const v of [at.left, at.tail, at.top ?? at.bottom!]) {
          expect(v * dpr).toBeCloseTo(Math.round(v * dpr));
        }
      }
    }
  });
});
