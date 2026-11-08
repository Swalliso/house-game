// The camera where display scaling isn't a whole number (D-097's zoom note): the default is
// crisp, and it's one of the zoom steps, so zooming in and back out, or Fit and back, returns to
// it, and from there the board follows the window again.

import { afterEach, describe, expect, it, vi } from 'vitest';
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

/**
 * A fresh camera over a 24×24 lot in a view this big: by default the board's room in a 1536×864
 * window (a 1920×1080 screen at 125%), 914×759 CSS px as measured in the app.
 */
function start(dpr: number, width = 914, height = 759): void {
  zoom.value = null;
  lotSize.value = { width: 24, height: 24 };
  viewSize.value = { width, height, dpr };
}

afterEach(() => {
  if (isFit.value) toggleFit();
  zoom.value = null;
  viewSize.value = null;
  vi.unstubAllGlobals();
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
      // The default again, not a zoom that happens to match it: it follows the window.
      expect(zoom.value).toBe(null);
      viewSize.value = { width: 2400, height: 1500, dpr };
      expect(cameraScale.value).toBe(2 / dpr);
    });

    it(`comes back to the default from Fit at ${dpr}`, () => {
      start(dpr);
      const first = cameraScale.value;
      toggleFit();
      expect(isFit.value).toBe(true);
      toggleFit();
      expect(isFit.value).toBe(false);
      expect(cameraScale.value).toBe(first);
    });

    // Whether Fit is above or below the default depends on how many rows the board has (the
    // street, the road, the canopy's room), so each side gets a view of its own, and the test
    // checks that the step it takes is a real one rather than passing when Fit is the default.
    it(`steps out from Fit to the default where the board fits at the default, at ${dpr}`, () => {
      start(dpr);
      const first = cameraScale.value;
      expect(first).toBe(floor);
      toggleFit();
      expect(cameraScale.value).toBeGreaterThan(first);
      zoomOut();
      expect(isFit.value).toBe(false);
      expect(zoom.value).toBe(null);
      expect(cameraScale.value).toBe(first);
    });

    it(`steps in from Fit to the default where the default pans, at ${dpr}`, () => {
      start(dpr, 914, 500);
      const first = cameraScale.value;
      expect(first).toBe(floor);
      toggleFit();
      expect(cameraScale.value).toBeLessThan(first);
      zoomIn();
      expect(isFit.value).toBe(false);
      expect(zoom.value).toBe(null);
      expect(cameraScale.value).toBe(first);
    });
  }

  it('keeps a zoom the player picked when the window resizes', () => {
    start(1.25);
    zoomIn();
    zoomIn();
    expect(cameraScale.value).toBe(3 / 1.25);
    viewSize.value = { width: 2400, height: 1500, dpr: 1.25 };
    expect(cameraScale.value).toBe(3 / 1.25);
    zoomOut();
    // 1.6× is this bigger window's default, so the step lands back on it.
    expect(zoom.value).toBe(null);
    expect(cameraScale.value).toBe(1.6);
  });

  it('draws at the default’s floor before the board first measures', () => {
    vi.stubGlobal('window', { devicePixelRatio: 1.5 });
    viewSize.value = null;
    expect(cameraScale.value).toBe(1 / 1.5);
  });

  it('still starts at 1× at a devicePixelRatio of 1 and 2', () => {
    for (const dpr of [1, 2]) {
      start(dpr);
      expect(cameraScale.value).toBe(1);
    }
  });
});
