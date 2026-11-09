// The board's scales (§12, Art; D-097): CSS px per art px, with one cell CELL art px.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import { placedCells } from '../../rules/index.ts';
import { CELL, cellUnit } from '../sprites.ts';
import {
  boardRows,
  CANOPY_ROOM,
  canopyRoom,
  defaultFloor,
  fitScale,
  furnitureSpot,
  keepInView,
  labelLines,
  labelRows,
  labelSpot,
  MAX_ZOOM,
  maxZoom,
  minZoom,
  overviewScale,
  ROAD_ROWS,
  snapZoom,
  startScrollTop,
  streetLabelRun,
  streetLabelSize,
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

describe("the street's label", () => {
  it('keeps the body size where the row has room, and halves it in a Retina 0.5× row', () => {
    // 1×, 1080p: 16 px text in a 32 px row. Fit at 720p: 16 px in 22 still fits.
    expect(streetLabelSize(32, 2, 1)).toBe(16);
    expect(streetLabelSize(22, 2, 1)).toBe(16);
    // 0.667× at 150% and 0.571× at 175%: the UI pixel's own size.
    expect(streetLabelSize(64 / 3, 2, 1.5)).toBe(16);
    expect(streetLabelSize(32 / 1.75, 3 / 1.75, 1.75)).toBeCloseTo(24 / 1.75);
    // 0.5× on a Retina screen: a 16 px row takes 8 px text, two device pixels per font pixel.
    expect(streetLabelSize(16, 2, 2)).toBe(8);
    // Never under one device pixel per font pixel.
    expect(streetLabelSize(8, 2, 1)).toBe(8);
  });

  it('lies on the longest stretch of sidewalk with no curb cut', () => {
    const at = (s: string) => [...s].map((c) => c === 'x');
    // A Driveway at x = 2: the label starts after it.
    expect(streetLabelRun(at('..x.........'))).toEqual({ from: 3, to: 12 });
    // No cut: the whole street.
    expect(streetLabelRun(at('........'))).toEqual({ from: 0, to: 8 });
    // The longest stretch, the leftmost of equals.
    expect(streetLabelRun(at('...x..x......'))).toEqual({ from: 7, to: 13 });
    expect(streetLabelRun(at('...x...x'))).toEqual({ from: 0, to: 3 });
    // Every cell cut: the whole street.
    expect(streetLabelRun(at('xxxx'))).toEqual({ from: 0, to: 4 });
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

  it('is never below 1× at a devicePixelRatio of 1 or 2, so a small window pans', () => {
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

describe('the default zoom at 125% and 150% display scaling (D-097’s zoom note)', () => {
  it('rounds the 1× floor down to whole device pixels per art pixel', () => {
    expect(defaultFloor(1)).toBe(1);
    expect(defaultFloor(2)).toBe(1);
    expect(defaultFloor(3)).toBe(1);
    expect(defaultFloor(1.25)).toBe(0.8);
    expect(defaultFloor(1.5)).toBe(1 / 1.5);
    expect(defaultFloor(1.75)).toBe(1 / 1.75);
    expect(defaultFloor(2.5)).toBe(2 / 2.5);
    // A browser zoomed out to 90% still gets one whole device pixel per art pixel.
    expect(defaultFloor(0.9)).toBe(1 / 0.9);
  });

  it('is the default where two device pixels per art pixel don’t fit', () => {
    // The board's room as measured in a 1536×864 window (a 1920×1080 screen at 125%) and in a
    // 1280×720 one (the same screen at 150%); a tiny window pans at the floor.
    expect(fitScale(914, 759, 24, 24, 1.25)).toBe(0.8);
    expect(fitScale(792, 615, 24, 24, 1.5)).toBe(1 / 1.5);
    // 175% display scaling: one device pixel per art pixel is 0.57×.
    expect(fitScale(700, 500, 24, 24, 1.75)).toBe(1 / 1.75);
    expect(fitScale(400, 300, 24, 24, 1.25)).toBe(0.8);
    expect(fitScale(400, 300, 24, 24, 1.5)).toBe(1 / 1.5);
    // A window that holds two device pixels per art pixel gets them: 1.6× and 1.33×.
    expect(fitScale(2400, 1500, 24, 24, 1.25)).toBe(1.6);
    expect(fitScale(2400, 1500, 24, 24, 1.5)).toBe(2 / 1.5);
  });

  it('is always one of the zoom steps, so zooming in and back out returns to it', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(0.9, 1, 1.1, 1.25, 1.5, 1.75, 2, 2.25, 2.5, 3),
        fc.integer({ min: 100, max: 4000 }),
        fc.integer({ min: 100, max: 3000 }),
        (dpr, width, height) => {
          const s = fitScale(width, height, 24, 24, dpr);
          expect(stops(dpr)).toContain(s);
          expect(s).toBeGreaterThanOrEqual(defaultFloor(dpr));
          const up = zoomStep(s, 1, dpr);
          if (up !== s) expect(zoomStep(up, -1, dpr)).toBe(s);
        },
      ),
    );
  });
});

describe('a piece’s heart (furnitureSpot), where a fixture host’s badge sits (D-107)', () => {
  it('is the middle of a rectangle, as the cell whose middle it is', () => {
    expect(furnitureSpot(placedCells(['##', '##'], 3, 4, 0))).toEqual({ x: 3.5, y: 4.5 });
    expect(furnitureSpot(placedCells(['###'], 2, 5, 1))).toEqual({ x: 2, y: 6 });
    expect(furnitureSpot([{ x: 7, y: 1 }])).toEqual({ x: 7, y: 1 });
  });

  it('is the cell with the most neighbors in any other shape: an L’s corner, a T’s joint', () => {
    expect(furnitureSpot(placedCells(['#.', '##'], 0, 0, 0))).toEqual({ x: 0, y: 1 });
    expect(furnitureSpot(placedCells(['###', '.#.'], 4, 4, 0))).toEqual({ x: 5, y: 4 });
    // A pack's tiles (D-106) are just another shape: on one of its own cells, never in a gap.
    const fence = placedCells(['#..', '#..', '###'], 2, 2, 0);
    expect(fence).toContainEqual(furnitureSpot(fence));
  });
});

describe('a label by the pointer', () => {
  it('sits above its cells, or below them where the rows its stack needs run off the lot', () => {
    const cells = placedCells(['##'], 4, 2, 0);
    expect(labelSpot(cells, 12)).toEqual({ x: 5, y: 2, below: false });
    // The ghost's stack of three (its change, a broken restriction, a pack's next tile).
    expect(labelSpot(cells, 12, 3)).toEqual({ x: 5, y: 3, below: true });
    // Kept away from the lot's side edges.
    expect(labelSpot(placedCells(['#'], 0, 5, 0), 12).x).toBe(3);
  });

  it('takes as many rows above its cells as its stack is tall, more where cells are small', () => {
    // At 1× (32 CSS px a cell, 2 CSS px a UI pixel): a one-line label in a row, a pack's ghost
    // (its change and count, what's next, and the next tile's label: three lines in two labels)
    // in three, as the ghost's stack once counted a row a line.
    expect(labelRows([1], 32, 2)).toBe(1);
    expect(labelRows([2, 1], 32, 2)).toBe(3);
    expect(labelRows([2, 1, 1], 32, 2)).toBe(4);
    // At 0.5× on a Retina screen the text keeps its size and the cells halve: twice the rows.
    expect(labelRows([1], 16, 2)).toBe(2);
    expect(labelRows([2, 1], 16, 2)).toBe(5);
    // At 2× it needs fewer; Fit at 720p, 22 CSS px a cell, more.
    expect(labelRows([2, 1], 64, 2)).toBe(2);
    expect(labelRows([2, 1], 22, 2)).toBe(4);
    // At 125% display scaling the UI pixel is 1.6 CSS px, and the readable font's 19 px line
    // is the taller.
    expect(labelRows([1], 25.6, 1.6)).toBe(1);
    // Never under a row, and never short of the stack's height.
    fc.assert(
      fc.property(
        fc.array(fc.integer({ min: 1, max: 4 }), { minLength: 1, maxLength: 4 }),
        fc.constantFrom(16, 22, 25.6, 32, 48, 64, 96),
        fc.constantFrom(1.6, 2, 3, 4),
        (lines, px, ui) => {
          const rows = labelRows(lines, px, ui);
          const tall = lines.reduce((h, n) => h + n * Math.max(10 * ui, 19) + 4 * ui, 0);
          expect(rows).toBeGreaterThanOrEqual(1);
          expect(rows * px).toBeGreaterThanOrEqual(tall - 1e-6);
          expect((rows - 1) * px).toBeLessThan(Math.max(tall, px));
        },
      ),
    );
  });

  it('counts a long label as the lines it wraps to', () => {
    expect(labelLines('▲ +12 Wow · End week to build')).toBe(1);
    const renovate = 'Renovate the Bedroom to level 2: ▲ +17 Wow · End week to renovate';
    expect(labelLines(renovate)).toBe(2);
    expect(labelLines('')).toBe(1);
  });

  it('stays where it is when it fits in the view', () => {
    expect(keepInView(100, 300, 0, 720)).toBe(0);
    expect(keepInView(4, 716, 0, 720)).toBe(0);
  });

  it('is nudged back inside the view, with a little room to spare', () => {
    // Past the right edge by 80 px: 84 px left, in whole px.
    expect(keepInView(500, 800, 0, 720)).toBe(-84);
    expect(keepInView(500, 800.5, 0, 720)).toBe(-85);
    // Past the left edge: to the right.
    expect(keepInView(-40, 200, 0, 720)).toBe(44);
    expect(keepInView(250, 400, 280, 1000)).toBe(34);
  });

  it('reads from its first word when it is wider than the view', () => {
    expect(keepInView(-100, 900, 0, 720)).toBe(104);
    expect(keepInView(100, 900, 0, 720)).toBe(-96);
    fc.assert(
      fc.property(
        fc.integer({ min: -2000, max: 2000 }),
        fc.integer({ min: 1, max: 1500 }),
        fc.integer({ min: 100, max: 2000 }),
        (left, width, view) => {
          const dx = keepInView(left, left + width, 0, view);
          // Its start is never cut off, and a label that fits is never cut off at its end.
          expect(left + dx).toBeGreaterThanOrEqual(4);
          if (width <= view - 8) expect(left + width + dx).toBeLessThanOrEqual(view - 4);
        },
      ),
    );
  });
});
