// Where a first-time hint's card goes (D-045, M4b; D-110): by the panel it talks about, sized in
// UI pixels, never off the window's foot, with a panel that isn't laid out counted as missing,
// and every edge on a whole device pixel.

import { describe, expect, it } from 'vitest';
import {
  BESIDE_WIDTH,
  GAP,
  MIN_HEIGHT,
  placeFirstHint,
  type HintAnchors,
} from './first-hint-place.ts';

/** 1280×720 at 1×, laid out as the game is: 280 px columns, the strip under the board only. */
const VIEW = { w: 1280, h: 720 };
const PX = 2;
const LAYOUT: HintAnchors = {
  left: { left: 0, top: 64, right: 280, bottom: 720 },
  right: { left: 1000, top: 64, right: 1280, bottom: 720 },
  score: { left: 8, top: 72, right: 272, bottom: 424 },
  checklist: { left: 8, top: 432, right: 272, bottom: 656 },
  inventory: { left: 1008, top: 72, right: 1272, bottom: 300 },
  strip: { left: 280, top: 688, right: 1000, bottom: 720 },
};

describe("a first-time hint's card", () => {
  it('sits beside the checklist, over the lot’s edge, 150 UI px at most, above the strip', () => {
    const at = placeFirstHint('besideChecklist', LAYOUT, VIEW, PX, 1);
    expect(at.left).toBe(280 + GAP * PX);
    expect(at.top).toBe(432);
    expect(at.width).toBe(BESIDE_WIDTH * PX);
    expect(at.top + at.maxHeight).toBe(688 - GAP * PX);
  });

  it('runs to the window’s foot beside the checklist when the strip is hidden', () => {
    // The strip is display: none on a short window with nothing to show: it's missing.
    const at = placeFirstHint('besideChecklist', { ...LAYOUT, strip: undefined }, VIEW, PX, 1);
    expect(at.top + at.maxHeight).toBe(720 - GAP * PX);
  });

  it('keeps inside the window beside the checklist on a narrow one', () => {
    const view = { w: 560, h: 720 };
    const at = placeFirstHint('besideChecklist', LAYOUT, view, PX, 1);
    expect(at.left + at.width).toBeLessThanOrEqual(view.w - GAP * PX);
  });

  it('covers the checklist, or the score panel, and stops at its column’s foot', () => {
    const over = placeFirstHint('overChecklist', LAYOUT, VIEW, PX, 1);
    expect([over.left, over.top, over.width]).toEqual([8, 432, 264]);
    // A side column runs to the window's foot on a short window: the strip isn't its floor.
    expect(over.top + over.maxHeight).toBe(720 - GAP * PX);
    const score = placeFirstHint('overScore', LAYOUT, VIEW, PX, 1);
    expect([score.left, score.top, score.width]).toEqual([8, 72, 264]);
  });

  it('sits where the checklist will be while the first job has none yet (D-149)', () => {
    // Weeks 2 and 3: the score panel is up, so the card goes under it.
    const noList = { ...LAYOUT, checklist: undefined };
    const under = placeFirstHint('overChecklist', noList, VIEW, PX, 1);
    expect([under.left, under.top, under.width]).toEqual([8, 424 + GAP * PX, 264]);
    expect(under.top + under.maxHeight).toBe(720 - GAP * PX);
    // Week 1: no score panel either, so it sits at the column's top, inset like a panel.
    const bare = placeFirstHint('overChecklist', { ...noList, score: undefined }, VIEW, PX, 1);
    expect([bare.left, bare.top, bare.width]).toEqual([
      GAP * PX,
      64 + GAP * PX,
      280 - 2 * GAP * PX,
    ]);
  });

  it('sits under the goods, or at the right column’s top when there are none to show', () => {
    const under = placeFirstHint('underGoods', LAYOUT, VIEW, PX, 1);
    expect([under.left, under.top, under.width]).toEqual([1008, 300 + GAP * PX, 264]);
    expect(under.top + under.maxHeight).toBe(720 - GAP * PX);
    // A change order with no goods: the inventory isn't laid out (display: none, or not there).
    const none = placeFirstHint('underGoods', { ...LAYOUT, inventory: undefined }, VIEW, PX, 1);
    expect(none.top).toBe(64 + GAP * PX);
    expect(none.left).toBe(1000 + GAP * PX);
    expect(none.width).toBe(280 - 2 * GAP * PX);
  });

  it('rises over the goods when they reach the window’s foot, so Got it stays on screen', () => {
    const full = { ...LAYOUT, inventory: { left: 1008, top: 72, right: 1272, bottom: 716 } };
    const floor = 720 - GAP * PX;
    // Before its height is known it keeps its least height inside the window.
    const unknown = placeFirstHint('underGoods', full, VIEW, PX, 1);
    expect(unknown.top).toBe(floor - MIN_HEIGHT * PX);
    expect(unknown.top + unknown.maxHeight).toBe(floor);
    // Once measured, it rises to fit, never above the right column's top.
    expect(placeFirstHint('underGoods', full, VIEW, PX, 1, 256).top).toBe(floor - 256);
    expect(placeFirstHint('underGoods', full, VIEW, PX, 1, 2000).top).toBe(64 + GAP * PX);
    // With room under the goods it stays under them.
    expect(placeFirstHint('underGoods', LAYOUT, VIEW, PX, 1, 256).top).toBe(300 + GAP * PX);
  });

  it('rises over the column when it’s taller than the room under the checklist’s top', () => {
    // Week 1 at 1280×720: the score panel's suggestion for a first set pushes the checklist down.
    const low = { ...LAYOUT, checklist: { left: 8, top: 568, right: 272, bottom: 664 } };
    const fits = placeFirstHint('overChecklist', low, VIEW, PX, 1, 120);
    expect(fits.top).toBe(568);
    const tall = placeFirstHint('overChecklist', low, VIEW, PX, 1, 300);
    expect(tall.top).toBe(720 - GAP * PX - 300);
    expect(tall.top + tall.maxHeight).toBe(720 - GAP * PX);
    // Never above the column's top: then its text scrolls.
    const huge = placeFirstHint('overChecklist', low, VIEW, PX, 1, 2000);
    expect(huge.top).toBe(64 + GAP * PX);
    // Beside the checklist it rises the same way, over the lot's edge, to fit above the strip.
    const beside = placeFirstHint('besideChecklist', low, VIEW, PX, 1, 300);
    expect(beside.top).toBe(688 - GAP * PX - 300);
    // The other spots stay put.
    expect(placeFirstHint('overScore', low, VIEW, PX, 1, 2000).top).toBe(72);
  });

  it('keeps some height however close its floor is', () => {
    const low = { ...LAYOUT, checklist: { left: 8, top: 700, right: 272, bottom: 716 } };
    const at = placeFirstHint('overChecklist', low, VIEW, PX, 1);
    expect(at.maxHeight).toBe(MIN_HEIGHT * PX);
  });

  it('measures its gap and width in UI pixels', () => {
    // At 125% a UI pixel is 1.6 CSS px.
    const at = placeFirstHint('besideChecklist', LAYOUT, VIEW, 1.6, 1.25);
    expect(at.left).toBeCloseTo(280 + GAP * 1.6);
    expect(at.width).toBeCloseTo(BESIDE_WIDTH * 1.6);
  });

  it('lands every edge on a whole device pixel', () => {
    const odd: HintAnchors = {
      left: { left: 0, top: 63.7, right: 279.6, bottom: 719.3 },
      right: { left: 1000.4, top: 63.7, right: 1280, bottom: 719.3 },
      score: { left: 6.4, top: 70.1, right: 273.2, bottom: 431.9 },
      checklist: { left: 6.4, top: 438.3, right: 273.2, bottom: 655.5 },
      inventory: { left: 1006.8, top: 70.1, right: 1273.6, bottom: 299.7 },
      strip: { left: 279.6, top: 687.5, right: 1000.4, bottom: 719.3 },
    };
    for (const [dpr, px] of [
      [1, 2],
      [1.25, 1.6],
      [1.5, 2],
      [2, 2],
    ] as const) {
      for (const spot of ['besideChecklist', 'overChecklist', 'overScore', 'underGoods'] as const) {
        const at = placeFirstHint(spot, odd, VIEW, px, dpr);
        for (const v of [at.left, at.top, at.width, at.maxHeight, at.top + at.maxHeight]) {
          expect(v * dpr, `${spot} at ${dpr}×`).toBeCloseTo(Math.round(v * dpr));
        }
      }
    }
  });
});
