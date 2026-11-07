// The pieces' labels on the board: a badge never covers the weekly digit, at any zoom the camera
// offers (1×, the default's floor where display scaling isn't whole, Retina's 0.5× steps, Fit),
// and badges sit on whole device pixels with room for their ring and icon.

import { describe, expect, it } from 'vitest';
import type { Cell } from '../../rules/index.ts';
import {
  BADGE_ICON,
  badgeSize,
  digitBox,
  fitBadge,
  overlaps,
  pieceLabels,
  type BadgeSpot,
  type Side,
} from './label-layout.ts';

/** [name, CSS px per cell, devicePixelRatio]: every zoom a player can be at. */
const ZOOMS: readonly (readonly [string, number, number])[] = [
  ['1×', 32, 1],
  ['2×', 64, 1],
  ['3×', 96, 1],
  ['0.8× at 125%', 25.6, 1.25],
  ['1.6× at 125%', 51.2, 1.25],
  ['0.667× at 150%', 64 / 3, 1.5],
  ['1.333× at 150%', 128 / 3, 1.5],
  ['0.571× at 175%', 32 / 1.75, 1.75],
  ['0.5× on Retina', 16, 2],
  ['1× on Retina', 32, 2],
  ['1.5× on Retina', 48, 2],
  ['Fit at 720p', 22, 1],
  ['Fit at 1080p', 34, 1],
  ['Fit on Retina', 17.5, 2],
];

/** Walls 6 art px deep on every side (a room alone), or none (a yard piece). */
const OUTER = 6;
const walls =
  (art: number, px: number) =>
  (_c: Cell, _s: Side): number =>
    (art * px) / 32;

const cellsOf = (w: number, h: number): Cell[] =>
  Array.from({ length: w * h }, (_, i) => ({ x: 3 + (i % w), y: 5 + Math.floor(i / w) }));

const whole = (v: number, dpr: number) => Math.abs(v * dpr - Math.round(v * dpr)) < 1e-6;

function badgeBox(b: BadgeSpot) {
  return { x: b.x, y: b.y, w: b.w, h: b.h };
}

describe("the pieces' labels", () => {
  const shapes: readonly (readonly [string, number, number])[] = [
    ['one cell', 1, 1],
    ['one row', 2, 1],
    ['one column', 1, 2],
    ['2×2', 2, 2],
  ];
  for (const [zoom, px, dpr] of ZOOMS) {
    it(`keeps every badge off the digit at ${zoom}`, () => {
      for (const [shape, w, h] of shapes) {
        for (const art of [OUTER, 0]) {
          for (const chars of [1, 2, 3]) {
            for (const [fixture, unmet] of [
              [true, false],
              [false, true],
              [true, true],
            ] as const) {
              // An unmet piece earns nothing: its digit is 0.
              if (unmet && chars > 1) continue;
              const name = `${shape}${art ? ' room' : ' yard piece'}, ${chars}-digit score${fixture ? ', fixture' : ''}${unmet ? ', unmet' : ''}`;
              const cells = cellsOf(w, h);
              const l = pieceLabels({
                cells,
                inset: walls(art, px),
                px,
                dpr,
                digit: chars,
                fixture,
                unmet,
              });
              const digit = digitBox(l.digit!, chars);
              const badges = [l.fixture, l.unmet].filter((b): b is BadgeSpot => !!b);
              expect(badges, name).toHaveLength((fixture ? 1 : 0) + (unmet ? 1 : 0));
              for (const b of badges) {
                expect(
                  overlaps(badgeBox(b), digit),
                  `${name}: ${JSON.stringify({ b, digit })}`,
                ).toBe(false);
                // Inside the piece's own cells, from its top row's top edge down.
                expect(b.y, name).toBeGreaterThanOrEqual(5 * px - 1e-6);
                expect(b.x, name).toBeGreaterThanOrEqual(3 * px - 1e-6);
                expect(b.x + b.w, name).toBeLessThanOrEqual((3 + w) * px + 1e-6);
                // Crisp: whole device pixels, its icon at whole device pixels per icon pixel.
                for (const v of [b.x, b.y, b.w, b.h, b.ring, b.icon])
                  expect(whole(v, dpr), `${name}: ${v}`).toBe(true);
              }
              if (l.fixture && l.unmet) {
                expect(overlaps(badgeBox(l.fixture), badgeBox(l.unmet)), name).toBe(false);
              }
              // The digit stays in its own cell: its corner never drops past the piece's bottom.
              expect(l.digit!.bottom, name).toBeLessThanOrEqual((5 + h) * px + 1e-6);
            }
          }
        }
      }
    });
  }

  it('keeps 1×’s places in a 2×2 room: inside the walls, a 14 px badge', () => {
    const l = pieceLabels({
      cells: cellsOf(2, 2),
      inset: walls(OUTER, 32),
      px: 32,
      dpr: 1,
      digit: 2,
      fixture: true,
      unmet: true,
    });
    // The digit in the bottom-right corner inside the walls; the badges at the top inside them.
    expect(l.digit).toEqual({ right: 5 * 32 - 6 - 2, bottom: 7 * 32 - 6 - 1, font: 11 });
    expect(l.fixture).toMatchObject({ x: 5 * 32 - 6 - 2 - 14, y: 5 * 32 + 6 + 2, w: 14 });
    expect(l.unmet).toMatchObject({ x: 3 * 32 + 6 + 2, y: 5 * 32 + 6 + 2 });
  });

  it('moves a badge in the digit’s cell to the top edge, and the digit down, only as needed', () => {
    // A one-cell Bathroom at 1×: the Fireplace's badge rises over the north wall band, and the
    // digit keeps its place inside the walls.
    const at1 = pieceLabels({
      cells: cellsOf(1, 1),
      inset: walls(OUTER, 32),
      px: 32,
      dpr: 1,
      digit: 1,
      fixture: true,
      unmet: false,
    });
    expect(at1.digit!.bottom).toBe(6 * 32 - 6 - 1);
    expect(at1.fixture!.y + at1.fixture!.h).toBeLessThanOrEqual(at1.digit!.bottom - 11);
    // At 0.667× the digit drops into the south wall band too.
    const px = 64 / 3;
    const small = pieceLabels({
      cells: cellsOf(1, 1),
      inset: walls(OUTER, px),
      px,
      dpr: 1.5,
      digit: 1,
      fixture: true,
      unmet: false,
    });
    expect(small.digit!.bottom).toBeGreaterThan(6 * px - 4 - 1);
    expect(small.fixture!.y).toBeCloseTo(5 * px);
  });

  it('sizes badges with the cell: 14 px at 1×, larger zoomed in, smaller below 1×', () => {
    const fix = BADGE_ICON.fixture;
    expect(badgeSize(32, fix, 1)).toBe(14);
    expect(badgeSize(64, fix, 1)).toBe(24);
    expect(badgeSize(96, fix, 1)).toBe(36);
    expect(badgeSize(64 / 3, fix, 1.5)).toBeCloseTo(9.6);
    expect(badgeSize(16, fix, 2)).toBe(9);
    // Never too small for its icon and ring at one device pixel each: Fit at 720p.
    expect(badgeSize(22, fix, 1)).toBe(10);
    expect(badgeSize(22, BADGE_ICON.unmet, 1)).toBe(11);
  });

  it('shows the icon at every zoom where a badge has its own corner, at Fit at 720p too', () => {
    for (const [zoom, px, dpr] of ZOOMS) {
      const l = pieceLabels({
        cells: cellsOf(2, 2),
        inset: walls(OUTER, px),
        px,
        dpr,
        digit: 1,
        fixture: true,
        unmet: true,
      });
      expect(l.fixture!.icon, zoom).toBeGreaterThan(0);
      expect(l.unmet!.icon, zoom).toBeGreaterThan(0);
    }
  });

  it('fits a ring and an icon on whole device pixels, or just a ring when there’s no room', () => {
    // 14 px at 1×: an 8 px icon, a 1 px ring, 2 px of paper each side.
    expect(fitBadge(14, BADGE_ICON.fixture, 1)).toEqual({ size: 14, ring: 1, icon: 1 });
    // 24 px at 2×: icon pixels of 2 px.
    expect(fitBadge(24, BADGE_ICON.fixture, 1)).toEqual({ size: 24, ring: 2, icon: 2 });
    // The ⚠ is 9 icon pixels wide: an odd badge, so it sits centered.
    expect(fitBadge(14, BADGE_ICON.unmet, 1).size).toBe(13);
    // 5 CSS px on Retina is 10 device px: the icon meets its ring, with no paper between.
    expect(fitBadge(5, BADGE_ICON.fixture, 2)).toEqual({ size: 5, ring: 0.5, icon: 0.5 });
    // 9 device px: no room for the icon at all, just the ring and its fill.
    expect(fitBadge(9, BADGE_ICON.fixture, 1)).toMatchObject({ size: 9, icon: 0 });
  });
});
