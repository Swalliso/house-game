// The camera at 125% and 150% display scaling (D-097's zoom note): the default is crisp, and
// it's one of the zoom steps, so zooming in and back out, or Fit and back, returns to it.

import { afterEach, describe, expect, it } from 'vitest';
import {
  cameraScale,
  canZoomOut,
  isFit,
  lotSize,
  toggleFit,
  viewSize,
  zoom,
  zoomIn,
  zoomOut,
} from './camera.ts';

/** Whole device pixels per art pixel, give or take float noise. */
function crisp(scale: number, dpr: number): boolean {
  return Math.abs(scale * dpr - Math.round(scale * dpr)) < 1e-9;
}

/** A fresh camera over about the board's room in a 1536×864 window. */
function start(dpr: number): void {
  zoom.value = null;
  lotSize.value = { width: 24, height: 24 };
  viewSize.value = { width: 1150, height: 700, dpr };
}

afterEach(() => {
  if (isFit.value) toggleFit();
  zoom.value = null;
  viewSize.value = null;
});

describe('the camera at 125% and 150% display scaling', () => {
  const cases: [dpr: number, floor: number][] = [
    [1.25, 0.8],
    [1.5, 1 / 1.5],
  ];
  for (const [dpr, floor] of cases) {
    it(`starts crisp, at one device pixel per art pixel, at a ratio of ${dpr}`, () => {
      start(dpr);
      expect(cameraScale.value).toBe(floor);
      expect(crisp(cameraScale.value, dpr)).toBe(true);
      // It's the smallest step there, so there's nothing further out.
      expect(canZoomOut()).toBe(false);
    });

    it(`comes back to the default after zooming in and out at ${dpr}`, () => {
      start(dpr);
      const first = cameraScale.value;
      zoomIn();
      expect(cameraScale.value).toBe(2 / dpr);
      expect(crisp(cameraScale.value, dpr)).toBe(true);
      zoomOut();
      expect(cameraScale.value).toBe(first);
    });

    it(`comes back to the default from Fit, and steps from Fit to the default, at ${dpr}`, () => {
      start(dpr);
      const first = cameraScale.value;
      toggleFit();
      expect(isFit.value).toBe(true);
      toggleFit();
      expect(isFit.value).toBe(false);
      expect(cameraScale.value).toBe(first);
      // A step out from Fit lands on the default too.
      toggleFit();
      zoomOut();
      expect(cameraScale.value).toBe(first);
    });
  }

  it('still starts at 1× at a devicePixelRatio of 1 and 2', () => {
    for (const dpr of [1, 2]) {
      start(dpr);
      expect(cameraScale.value).toBe(1);
    }
  });
});
