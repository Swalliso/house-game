// The board's scales (§12, Art; D-097): CSS px per art px, with one cell CELL art px.

import { describe, expect, it } from 'vitest';
import { CELL, cellUnit } from '../sprites.ts';
import {
  boardRows,
  CANOPY_ROOM,
  canopyRoom,
  fitScale,
  MAX_ZOOM,
  maxZoom,
  minZoom,
  overviewScale,
  ROAD_ROWS,
  snapZoom,
  startScrollTop,
  streetScale,
  viewReach,
  zoomStep,
} from './geometry.ts';

/** Every zoom stop from the smallest up, by stepping in. */
function stops(dpr: number): number[] {
  const out = [minZoom(dpr)];
  for (;;) {
    const next = zoomStep(out.at(-1)!, 1, dpr);
    if (next === out.at(-1)) return out;
    out.push(next);
  }
}

describe('cells', () => {
  it('are 32 art px, and a sixteenth of one is a pixel of the old 16 px art', () => {
    expect(CELL).toBe(32);
    // 1× now draws a cell as 2× did with 16 px art: 32 CSS px, so 2 CSS px per old pixel.
    expect(cellUnit(CELL * 1)).toBe(2);
    expect(cellUnit(CELL * 3)).toBe(6);
  });
});

describe('the board', () => {
  it('is the lot, the street row, and two rows of road below it', () => {
    expect(boardRows(24)).toBe(27);
  });

  it('keeps room above the lot for the top row’s tree tops, in whole device pixels', () => {
    expect(canopyRoom(1, 1)).toBe(CANOPY_ROOM);
    expect(canopyRoom(2, 1)).toBe(2 * CANOPY_ROOM);
    expect(canopyRoom(0.5, 2)).toBe(CANOPY_ROOM / 2);
    // Fit's 22 px cells: 16.5 px of room, rounded up.
    expect(canopyRoom(22 / CELL, 1)).toBe(17);
    for (const [scale, dpr] of [
      [0.8, 1.25],
      [1, 1.5],
      [45 / 64, 2],
    ] as const) {
      const device = canopyRoom(scale, dpr) * dpr;
      expect(Math.abs(device - Math.round(device))).toBeLessThan(1e-9);
      expect(canopyRoom(scale, dpr)).toBeGreaterThanOrEqual(CANOPY_ROOM * scale - 1e-9);
    }
  });

  it('knows how far the view reaches past it, to the scroll area’s edges and no further', () => {
    // 1920×1080 at 1×: 265 px beside the board, the room and half the spare height above it.
    expect(viewReach({ width: 1298, height: 974 }, 24, 24, 1, 1, 6)).toEqual({
      left: 271,
      right: 271,
      top: 6 + 24 + 43,
    });
    // An odd spare width rounds down to whole device pixels, never past the scroll area's edge.
    expect(viewReach({ width: 1299, height: 974 }, 24, 24, 1, 1, 6).right).toBe(271);
    expect(viewReach({ width: 1299, height: 974 }, 24, 24, 1, 2, 6).right).toBe(271.5);
    // A board bigger than the view: just the padding beside it, and the room above.
    expect(viewReach({ width: 792, height: 614 }, 24, 24, 2, 1, 6)).toEqual({
      left: 6,
      right: 6,
      top: 6 + 48,
    });
    expect(viewReach(null, 24, 24, 1, 1, 6)).toEqual({ left: 6, right: 6, top: 30 });
  });

  it('starts a new run’s view on the street row, the road a short pan below', () => {
    // 1600×900: the board and its room overflow by 94 px; the road's two rows stay below.
    expect(startScrollTop(900, 806, 32)).toBe(900 - 806 - ROAD_ROWS * 32);
    // A view that holds the board: no scrolling.
    expect(startScrollTop(900, 980, 32)).toBe(0);
    expect(startScrollTop(900, 870, 32)).toBe(0);
  });
});

describe('the default zoom', () => {
  // About the board's space in a 1920×1080 window: between the panels, under the top bar.
  it('fits a 24×24 lot, its street and road at 1× at 1080p: 32 CSS px per cell', () => {
    const s = fitScale(1296, 970, 24, 24, 1);
    expect(s).toBe(1);
    expect(CELL * s * boardRows(24)).toBe(864);
    expect(CELL * s * boardRows(24) + canopyRoom(s, 1)).toBeLessThanOrEqual(970);
  });

  it('is never below 1×, so a small window pans', () => {
    expect(fitScale(960, 600, 24, 24, 1)).toBe(1);
    expect(fitScale(960, 600, 24, 24, 2)).toBe(1);
  });

  it('is the largest whole number of device pixels per art pixel that fits', () => {
    // 1800 CSS px tall fits 2× (1728 px and 48 px of canopy room) at a dpr of 1, and 2× at 2.
    expect(fitScale(2000, 1800, 24, 24, 1)).toBe(2);
    expect(fitScale(2000, 1800, 24, 24, 2)).toBe(2);
    // 1700 CSS px doesn't: 1× at a dpr of 1, and 1.5× on Retina.
    expect(fitScale(2000, 1700, 24, 24, 1)).toBe(1);
    expect(fitScale(2000, 1700, 24, 24, 2)).toBe(1.5);
    // 1340 CSS px fits 1.5× on Retina (2664 of 2680 device px) but only 1× at a dpr of 1.
    expect(fitScale(2000, 1340, 24, 24, 2)).toBe(1.5);
    expect(fitScale(2000, 1340, 24, 24, 1)).toBe(1);
    // 1300 CSS px doesn't, now that the canopy's room counts.
    expect(fitScale(2000, 1300, 24, 24, 2)).toBe(1);
    // The narrower side decides.
    expect(fitScale(1200, 1800, 24, 24, 1)).toBe(1);
  });

  it('never goes past the camera’s largest zoom', () => {
    expect(fitScale(8000, 8000, 24, 24, 1)).toBe(MAX_ZOOM);
    expect(fitScale(8000, 8000, 24, 24, 1.25)).toBe(2.4);
  });
});

describe('the zoom steps', () => {
  it('are 1×, 2× and 3× at a devicePixelRatio of 1', () => {
    expect(stops(1)).toEqual([1, 2, 3]);
  });

  it('go by halves from 0.5× to 3× on a Retina screen', () => {
    expect(stops(2)).toEqual([0.5, 1, 1.5, 2, 2.5, 3]);
  });

  it('are whole device pixels per art pixel at other ratios', () => {
    for (const dpr of [1.25, 1.5, 3]) {
      for (const s of stops(dpr)) {
        expect(Math.abs(s * dpr - Math.round(s * dpr))).toBeLessThan(1e-9);
        expect(s).toBeLessThanOrEqual(MAX_ZOOM);
      }
    }
    expect(stops(1.5).map((s) => +s.toFixed(4))).toEqual([0.6667, 1.3333, 2, 2.6667]);
  });

  it('step out the same way, and stop at the ends', () => {
    expect(zoomStep(2, -1, 1)).toBe(1);
    expect(zoomStep(1, -1, 1)).toBe(1);
    expect(zoomStep(1, -1, 2)).toBe(0.5);
    expect(zoomStep(0.5, -1, 2)).toBe(0.5);
    expect(zoomStep(3, 1, 1)).toBe(3);
    expect(zoomStep(3, 1, 2)).toBe(3);
    expect(maxZoom(1)).toBe(3);
    expect(minZoom(1)).toBe(1);
  });

  it('round from Fit’s fractional scale on the first step', () => {
    expect(zoomStep(0.75, 1, 1)).toBe(1);
    expect(zoomStep(0.75, -1, 1)).toBe(0.75);
    expect(zoomStep(0.75, 1, 2)).toBe(1);
    expect(zoomStep(0.75, -1, 2)).toBe(0.5);
    expect(zoomStep(1.7, 1, 1)).toBe(2);
    expect(zoomStep(1.7, -1, 1)).toBe(1);
  });

  it('snap a picked zoom to this screen’s device pixels', () => {
    expect(snapZoom(1.5, 2)).toBe(1.5);
    expect(snapZoom(1.5, 1)).toBe(2);
    expect(snapZoom(0.5, 1)).toBe(1);
    expect(snapZoom(3, 1.25)).toBe(2.4);
    expect(snapZoom(2, 1)).toBe(2);
  });
});

describe('the title screen’s street', () => {
  /** A street tile's size in CSS px, for a window this tall. */
  const tile = (height: number, dpr: number) => +(CELL * streetScale(height, dpr)).toFixed(2);

  it('keeps the 16 px art’s tile sizes on a Retina screen: 64, 48, or 32 CSS px', () => {
    expect([tile(1100, 2), tile(900, 2), tile(700, 2)]).toEqual([64, 48, 32]);
  });

  it('rounds to whole device pixels per art pixel, down on a tie, at a ratio of 1', () => {
    expect([tile(1100, 1), tile(900, 1), tile(700, 1)]).toEqual([64, 32, 32]);
  });

  it('never goes under 32 CSS px at 125% and 150%, so the footer stays on the sidewalk', () => {
    expect([tile(1100, 1.25), tile(900, 1.25), tile(700, 1.25)]).toEqual([51.2, 51.2, 51.2]);
    expect([tile(1100, 1.5), tile(900, 1.5), tile(600, 1.5)]).toEqual([64, 42.67, 42.67]);
  });

  it('is whole device pixels per art pixel at any ratio', () => {
    for (const dpr of [0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.5, 3]) {
      for (const height of [600, 800, 1100]) {
        const k = streetScale(height, dpr) * dpr;
        expect(Math.abs(k - Math.round(k)), `${height} at ${dpr}`).toBeLessThan(1e-9);
        expect(CELL * streetScale(height, dpr), `${height} at ${dpr}`).toBeGreaterThanOrEqual(32);
      }
    }
  });
});

describe('Fit', () => {
  it('shows the whole board and the canopy’s room with cells of whole device pixels', () => {
    // 1280×720 (the board's space measured in the browser): about 0.69×, cells of 22 CSS px.
    const s = overviewScale(792, 614, 24, 24, 1);
    expect(CELL * s).toBe(22);
    expect(CELL * s * boardRows(24) + canopyRoom(s, 1)).toBeLessThanOrEqual(614);
    // On Retina, cells are a whole number of device pixels, which can be half a CSS px.
    expect(overviewScale(792, 614, 24, 24, 2) * CELL * 2).toBe(44);
    expect(overviewScale(792, 640, 24, 24, 2) * CELL * 2).toBe(46);
    // 1920×1080: cells of 35 CSS px.
    expect(overviewScale(1298, 973, 24, 24, 1) * CELL).toBe(35);
  });

  it('counts the room rounded up, so the board never overflows by a pixel', () => {
    // 610.6 px would hold 22 px cells if the room could be 16.5 px; rounded up to 17, it can't.
    const s = overviewScale(792, 610.6, 24, 24, 1);
    expect(CELL * s).toBe(21);
    for (const h of [600, 610.6, 614, 700, 973]) {
      for (const dpr of [1, 1.25, 1.5, 2]) {
        const fit = overviewScale(2000, h, 24, 24, dpr);
        const device = (CELL * fit * boardRows(24) + canopyRoom(fit, dpr)) * dpr;
        expect(device, `${h} at ${dpr}`).toBeLessThanOrEqual(h * dpr + 1e-6);
      }
    }
  });
});
