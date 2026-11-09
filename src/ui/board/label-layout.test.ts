// The pieces' labels on the board: a badge never covers the weekly digit, at any zoom the camera
// offers (1×, the default's floor where display scaling isn't whole, Retina's 0.5× steps, Fit),
// and badges sit on whole device pixels with room for their ring and icon.

import { describe, expect, it } from 'vitest';
import type { Cell } from '../../rules/index.ts';
import {
  BADGE_ICON,
  badgeSize,
  digitBox,
  digitFont,
  fitBadge,
  minBadge,
  overlaps,
  pieceLabels,
  spreadBadges,
  type BadgeSpot,
  type Box,
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

  it('changes nothing for what keeps clear of the labels', () => {
    for (const [zoom, px, dpr] of ZOOMS) {
      const input = {
        cells: cellsOf(2, 2),
        inset: walls(0, px),
        px,
        dpr,
        digit: 2,
        fixture: true,
        unmet: true,
      };
      // A Greenhouse's roof rising into the row above, and a mat on the far side.
      const keepOff = [
        { x: 3 * px, y: 5 * px - 14 * (px / 32), w: 2 * px, h: 14 * (px / 32) },
        { x: 3 * px + 4, y: 7 * px, w: 18, h: 6 },
      ];
      expect(pieceLabels({ ...input, keepOff }), zoom).toEqual(pieceLabels(input));
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

describe('what the labels keep off', () => {
  // Another piece's prop rising from the row below into the piece's bottom row, in art px: how
  // far it rises, and which of the digit's cell's columns it covers (its left and right, from
  // the cell's left edge; a prop can reach past the cell on either side).
  const RISES: readonly (readonly [string, number, number, number])[] = [
    ['a Greenhouse’s roof', 14, -28, 28],
    ['the Treehouse', 25, -30, 32],
    ['a Birdhouse', 9, 10, 21],
    ['a car’s roof', 6, -20, 32],
    ['a parasol’s crown', 4, -10, 27],
  ];
  const shapes: readonly (readonly [string, number, number])[] = [
    ['one cell', 1, 1],
    ['one row', 2, 1],
    ['one column', 1, 2],
    ['2×2', 2, 2],
  ];
  const box = (b: BadgeSpot) => ({ x: b.x, y: b.y, w: b.w, h: b.h });

  for (const [zoom, px, dpr] of ZOOMS) {
    it(`keeps the digit off another piece’s prop rising into its cell at ${zoom}`, () => {
      const k = px / 32;
      for (const [shape, w, h] of shapes) {
        for (const art of [OUTER, 0]) {
          for (const [what, rise, x0, x1] of RISES) {
            for (const chars of [1, 2, 3]) {
              for (const [fixture, unmet] of [
                [false, false],
                [true, false],
                [true, true],
              ] as const) {
                if (unmet && chars > 1) continue;
                const name = `${shape}${art ? ' room' : ' yard piece'} over ${what}, ${chars}-digit score${fixture ? ', fixture' : ''}${unmet ? ', unmet' : ''}`;
                const cells = cellsOf(w, h);
                // The digit's cell: the bottom-right one, at (2 + w, 4 + h).
                const cx = (2 + w) * px;
                const bottom = (5 + h) * px;
                const prop = {
                  x: cx + x0 * k,
                  y: bottom - rise * k,
                  w: (x1 - x0) * k,
                  h: rise * k,
                };
                const l = pieceLabels({
                  cells,
                  inset: walls(art, px),
                  px,
                  dpr,
                  digit: chars,
                  fixture,
                  unmet,
                  keepOff: [prop],
                });
                const digit = digitBox(l.digit!, chars);
                // The piece's top inside its walls, and where the digit starts.
                const top = 5 * px + (art * px) / 32;
                const start =
                  Math.round((bottom - (art * px) / 32 - 1) * dpr) / dpr - digitFont(px);
                // Clear of the prop, unless its piece has no room for it above the prop (one row
                // in front of the Treehouse, or a cell too small): then as high as its piece
                // allows (on whole device pixels), leaving a badge above it the room for its icon
                // (playtest 5a: a badge squeezed to a ring hid what was bought).
                if (overlaps(digit, prop)) {
                  const reserve = Math.max(
                    fixture ? minBadge(BADGE_ICON.fixture, dpr) : 0,
                    unmet ? minBadge(BADGE_ICON.unmet, dpr) : 0,
                  );
                  const ceiling = Math.max(top, reserve > 0 ? 5 * px + reserve : 0);
                  const what = `${name}: ${JSON.stringify({ digit, prop, ceiling })}`;
                  // (Or no lower than it would be anyway, where it drops to make room for a badge.)
                  const plain = pieceLabels({
                    cells,
                    inset: walls(art, px),
                    px,
                    dpr,
                    digit: chars,
                    fixture,
                    unmet,
                  });
                  expect(digit.y, what).toBeLessThanOrEqual(
                    Math.max(ceiling + 1 / dpr, start, digitBox(plain.digit!, chars).y) + 1e-6,
                  );
                  expect(digit.h, what).toBeGreaterThan(
                    prop.y - Math.max(1, px / 16) - ceiling - 1e-6,
                  );
                }
                // On its piece's bottom row, its corner no further right than its bottom-right
                // cell (it moves left past what it can't rise over), and no higher than its top,
                // or than it starts in a cell too small for it.
                expect(l.digit!.right, name).toBeLessThanOrEqual(cx + px + 1e-6);
                expect(l.digit!.right, name).toBeGreaterThan(3 * px);
                expect(l.digit!.bottom, name).toBeGreaterThan(bottom - px);
                expect(digit.y, name).toBeGreaterThanOrEqual(Math.min(top, start) - 1e-6);
                for (const v of [l.digit!.right, l.digit!.bottom])
                  expect(whole(v, dpr), `${name}: ${v}`).toBe(true);
                // And the badges keep off it, crisp, on the piece.
                for (const b of [l.fixture, l.unmet].filter((q): q is BadgeSpot => !!q)) {
                  expect(overlaps(box(b), digit), `${name}: ${JSON.stringify({ b, digit })}`).toBe(
                    false,
                  );
                  expect(b.y, name).toBeGreaterThanOrEqual(5 * px - 1e-6);
                  expect(b.x, name).toBeGreaterThanOrEqual(3 * px - 1e-6);
                  expect(b.x + b.w, name).toBeLessThanOrEqual((3 + w) * px + 1e-6);
                  for (const v of [b.x, b.y, b.w, b.h, b.ring, b.icon])
                    expect(whole(v, dpr), `${name}: ${v}`).toBe(true);
                }
                if (l.fixture && l.unmet) {
                  expect(overlaps(box(l.fixture), box(l.unmet)), name).toBe(false);
                }
              }
            }
          }
        }
      }
    });

    it(`keeps the badges and the digit off a door’s mat at ${zoom}`, () => {
      const k = px / 32;
      // A 2×2 yard piece at (3, 5): a door's mat (18 by 6 art px) on each outer edge of its
      // corner cells, wherever along the edge the door is.
      const mat = (cell: Cell, side: Side, off: number) => {
        const X = cell.x * px;
        const Y = cell.y * px;
        const along = (off - 1) * k;
        if (side === 'N') return { x: X + along, y: Y + k, w: 18 * k, h: 6 * k };
        if (side === 'S') return { x: X + along, y: Y + 25 * k, w: 18 * k, h: 6 * k };
        if (side === 'E') return { x: X + 25 * k, y: Y + along, w: 6 * k, h: 18 * k };
        return { x: X + k, y: Y + along, w: 6 * k, h: 18 * k };
      };
      const cases: [string, Cell, Side][] = [
        ['top-right cell, north edge', { x: 4, y: 5 }, 'N'],
        ['top-right cell, east edge', { x: 4, y: 5 }, 'E'],
        ['top-left cell, north edge', { x: 3, y: 5 }, 'N'],
        ['top-left cell, west edge', { x: 3, y: 5 }, 'W'],
        ['bottom-right cell, south edge', { x: 4, y: 6 }, 'S'],
        ['bottom-right cell, east edge', { x: 4, y: 6 }, 'E'],
      ];
      for (const [where, cell, side] of cases) {
        for (const off of side === 'N' || side === 'S' ? [5, 8, 11] : [5, 9, 14]) {
          for (const chars of [1, 2, 3]) {
            const m = mat(cell, side, off);
            const name = `${where}, door at ${off}, ${chars}-digit score`;
            const l = pieceLabels({
              cells: cellsOf(2, 2),
              inset: walls(0, px),
              px,
              dpr,
              digit: chars,
              fixture: true,
              unmet: chars === 1,
              keepOff: [m],
            });
            const digit = digitBox(l.digit!, chars);
            expect(overlaps(digit, m), `${name}: digit ${JSON.stringify({ digit, m })}`).toBe(
              false,
            );
            for (const b of [l.fixture, l.unmet].filter((q): q is BadgeSpot => !!q)) {
              expect(overlaps(box(b), m), `${name}: badge ${JSON.stringify({ b, m })}`).toBe(false);
              expect(overlaps(box(b), digit), `${name}: ${JSON.stringify({ b, digit })}`).toBe(
                false,
              );
              expect(b.y, name).toBeGreaterThanOrEqual(5 * px - 1e-6);
              expect(b.y + b.h, name).toBeLessThanOrEqual(7 * px + 1e-6);
              expect(b.x, name).toBeGreaterThanOrEqual(3 * px - 1e-6);
              expect(b.x + b.w, name).toBeLessThanOrEqual(5 * px + 1e-6);
              for (const v of [b.x, b.y, b.w, b.h])
                expect(whole(v, dpr), `${name}: ${v}`).toBe(true);
            }
            if (l.fixture && l.unmet) {
              expect(overlaps(box(l.fixture), box(l.unmet)), name).toBe(false);
            }
          }
        }
      }
    });
  }

  it('lifts the playtest’s Patio 12’s digit off Greenhouse 25’s roof, and a Bedroom’s too', () => {
    // Patio 12 on (13–14, 18–19); Greenhouse 25 on (14–15, 20–21) rises 14 art px into row 19.
    const patio = [
      { x: 13, y: 18 },
      { x: 14, y: 18 },
      { x: 13, y: 19 },
      { x: 14, y: 19 },
    ];
    for (const [zoom, scale, dpr] of [
      ['1×', 1, 2],
      ['2×', 2, 2],
      ['3×', 3, 1],
      ['Fit', 1.53125, 2],
    ] as const) {
      const px = 32 * scale;
      const roof = { x: 452 * scale, y: 626 * scale, w: 56 * scale, h: 14 * scale };
      const l = pieceLabels({
        cells: patio,
        inset: () => 0,
        px,
        dpr,
        digit: 2,
        fixture: false,
        unmet: false,
        keepOff: [roof],
      });
      // Above the roof by a badge's gap from its corner, still at its cell's right edge.
      const gap = Math.max(1, px / 16);
      expect(l.digit!.right, zoom).toBe(15 * px - 2);
      expect(l.digit!.bottom, zoom).toBeLessThanOrEqual(roof.y - gap + 1e-6);
      expect(l.digit!.bottom, zoom).toBeGreaterThan(roof.y - gap - 1 / dpr - 1e-6);
      expect(l.digit!.bottom - l.digit!.font, zoom).toBeGreaterThanOrEqual(19 * px - 1e-6);
    }
    // At 1×: from the cell's bottom (639) to 2 px above the roof's peak (624).
    const at1 = pieceLabels({
      cells: patio,
      inset: () => 0,
      px: 32,
      dpr: 2,
      digit: 2,
      fixture: false,
      unmet: false,
      keepOff: [{ x: 452, y: 626, w: 56, h: 14 }],
    });
    expect(at1.digit).toEqual({ right: 478, bottom: 624, font: 11 });
    // Bedroom 16 on (15–16, 10–11), its south wall on Greenhouse 10's roof (rising into row 11).
    const bed = pieceLabels({
      cells: [
        { x: 15, y: 10 },
        { x: 16, y: 10 },
        { x: 15, y: 11 },
        { x: 16, y: 11 },
      ],
      inset: walls(OUTER, 32),
      px: 32,
      dpr: 2,
      digit: 2,
      fixture: false,
      unmet: false,
      keepOff: [{ x: 484, y: 370, w: 56, h: 14 }],
    });
    expect(bed.digit).toEqual({ right: 17 * 32 - 6 - 2, bottom: 368, font: 11 });
  });

  it('moves a fixture’s badge in past a mat in its corner, the shorter way', () => {
    // The playtest's Patio 8 with a fixture's badge, at 1×: Living Room 1's back door opens west
    // onto its east edge, the mat at x 345–351, y 516–534, in the badge's corner. (Its Pergola
    // shows as art now, a narrower cut clear of the mat: yard.ts; a badge stands in for one only
    // where doors open onto two of a Patio's sides.)
    const l = pieceLabels({
      cells: [
        { x: 9, y: 16 },
        { x: 10, y: 16 },
        { x: 9, y: 17 },
        { x: 10, y: 17 },
      ],
      inset: () => 0,
      px: 32,
      dpr: 2,
      digit: 2,
      fixture: true,
      unmet: false,
      keepOff: [{ x: 345, y: 516, w: 6, h: 18 }],
    });
    // Left of the mat by the badge's gap from a corner (2 px), still along the top edge.
    expect(l.fixture).toMatchObject({ x: 345 - 2 - 14, y: 16 * 32 + 2, w: 14 });
  });

  it('keeps a one-column piece’s badges off a mat and apart', () => {
    // The review's case: a 1×2 yard piece with a fixture's badge and a ⚠ in its top cell, and a
    // door's mat on that cell's east edge. The fixture's badge can't move in past the mat (the ⚠
    // is there), so it moves down, and the two badges never meet.
    for (const [zoom, px, dpr] of ZOOMS) {
      const k = px / 32;
      const cells = [
        { x: 4, y: 5 },
        { x: 4, y: 6 },
      ];
      for (const off of [3, 5, 9]) {
        const m = { x: 5 * px - 7 * k, y: 5 * px + off * k, w: 6 * k, h: 18 * k };
        const name = `${zoom}, mat at ${off}`;
        const l = pieceLabels({
          cells,
          inset: () => 0,
          px,
          dpr,
          digit: 1,
          fixture: true,
          unmet: true,
          keepOff: [m],
        });
        const badges = [l.fixture!, l.unmet!];
        if (overlaps(box(l.fixture!), m)) {
          // Only where the piece has no room for it below the mat and above the digit.
          const digit = digitBox(l.digit!, 1);
          expect(m.y + m.h + Math.max(1, px / 16) + l.fixture!.h, name).toBeGreaterThan(
            digit.y - 1e-6,
          );
        }
        expect(overlaps(box(badges[0]!), box(badges[1]!)), name).toBe(false);
        for (const b of badges) {
          expect(overlaps(box(b), digitBox(l.digit!, 1)), name).toBe(false);
          expect(b.x, name).toBeGreaterThanOrEqual(4 * px - 1e-6);
          expect(b.x + b.w, name).toBeLessThanOrEqual(5 * px + 1e-6);
        }
      }
    }
    // At 1×: the badge moves down past the mat, and keeps its size and icon.
    const at1 = pieceLabels({
      cells: [
        { x: 4, y: 5 },
        { x: 4, y: 6 },
      ],
      inset: () => 0,
      px: 32,
      dpr: 1,
      digit: 1,
      fixture: true,
      unmet: true,
      keepOff: [{ x: 153, y: 164, w: 6, h: 18 }],
    });
    expect(at1.fixture).toMatchObject({ x: 160 - 2 - 14, y: 164 + 18 + 2, w: 14, icon: 1 });
    expect(at1.unmet).toMatchObject({ x: 128 + 2, y: 160 + 2 });
  });

  it('never squeezes a badge’s icon out to lift the digit off what it keeps off', () => {
    // The review's cases: a one-cell Closet with Blackout Curtains, or a Bathroom with a
    // Fireplace (both shown as badges), north of a Greenhouse; a one-row piece in front of the
    // Treehouse. A badge that has its icon beside the digit keeps it when the digit lifts.
    const RISES = [14, 25, 9, 6, 4];
    for (const [zoom, px, dpr] of ZOOMS) {
      const k = px / 32;
      for (const [w, h] of [
        [1, 1],
        [2, 1],
        [1, 2],
        [2, 2],
      ] as const) {
        for (const art of [OUTER, 2, 0]) {
          for (const rise of RISES) {
            for (const chars of [1, 2, 3]) {
              for (const [fixture, unmet] of [
                [true, false],
                [false, true],
                [true, true],
              ] as const) {
                const cells = cellsOf(w, h);
                const bottom = (5 + h) * px;
                const prop = {
                  x: (2 + w) * px - 30 * k,
                  y: bottom - rise * k,
                  w: 62 * k,
                  h: rise * k,
                };
                const input = {
                  cells,
                  inset: walls(art, px),
                  px,
                  dpr,
                  digit: chars,
                  fixture,
                  unmet,
                };
                const plain = pieceLabels(input);
                const kept = pieceLabels({ ...input, keepOff: [prop] });
                const name = `${zoom} ${w}×${h}, walls ${art}, rise ${rise}, ${chars} digits, ${fixture ? 'fixture ' : ''}${unmet ? '⚠' : ''}`;
                for (const which of ['fixture', 'unmet'] as const) {
                  if ((plain[which]?.icon ?? 0) > 0) {
                    expect(kept[which]!.icon, `${name}: ${which}`).toBeGreaterThan(0);
                  }
                }
              }
            }
          }
        }
      }
    }
    // At 1×: a one-cell room with a fixture's badge north of a Greenhouse keeps its 14 px badge.
    const closet = pieceLabels({
      cells: [{ x: 3, y: 5 }],
      inset: walls(2, 32),
      px: 32,
      dpr: 1,
      digit: 1,
      fixture: true,
      unmet: false,
      keepOff: [{ x: 3 * 32 - 30, y: 6 * 32 - 14, w: 62, h: 14 }],
    });
    expect(closet.fixture).toMatchObject({ w: 14, icon: 1 });
  });
});

describe("a Renovated room's stars (D-102)", () => {
  /** Walls 6 art px deep on a room's outer edges only, none between its own cells. */
  const roomWalls = (cells: readonly Cell[], px: number) => {
    const own = new Set(cells.map((c) => `${c.x},${c.y}`));
    const step: Record<Side, readonly [number, number]> = {
      N: [0, -1],
      E: [1, 0],
      S: [0, 1],
      W: [-1, 0],
    };
    return (c: Cell, side: Side) =>
      own.has(`${c.x + step[side][0]},${c.y + step[side][1]}`) ? 0 : (OUTER * px) / 32;
  };
  /** A shape's cells, as rows of '#' and '.', with its top-left cell at (3, 5). */
  const cellsOfRows = (rows: readonly string[]): Cell[] =>
    rows.flatMap((r, y) => [...r].flatMap((ch, x) => (ch === '#' ? [{ x: 3 + x, y: 5 + y }] : [])));
  // Every room a card can renovate: a Bedroom, Kitchen or Dining Room, a Living Room either way,
  // Renfield's Room or Rowan's Studio either way, the L-Kitchen in each turn; and a one-cell room.
  const ROOMS: readonly (readonly [string, readonly string[]])[] = [
    ['2×2', ['##', '##']],
    ['3×2', ['###', '###']],
    ['2×3', ['##', '##', '##']],
    ['2×1', ['##']],
    ['1×2', ['#', '#']],
    ['L', ['#.', '##']],
    ['L turned once', ['##', '#.']],
    ['L turned twice', ['##', '.#']],
    ['L turned thrice', ['.#', '##']],
    ['one cell', ['#']],
  ];
  const combos = [
    [false, false],
    [true, false],
    [false, true],
    [true, true],
  ] as const;
  /**
   * What a label keeps off that can reach a room's cells: another piece's prop or a tree's
   * crown, rising into its bottom row from the row below (art px high, from and to in art px
   * across the digit's cell).
   */
  const RISES: readonly (readonly [string, number, number, number])[] = [
    ['nothing', 0, 0, 0],
    ['a Greenhouse’s roof', 14, -28, 28],
    ['the Treehouse', 25, -30, 32],
    ['a Birdhouse', 9, 10, 21],
    ['a car’s roof', 6, -20, 32],
    ['a tree’s crown', 21, -12, 40],
  ];

  for (const [zoom, px, dpr] of ZOOMS) {
    it(`stay in their room, off the digit, the badges and what labels keep off, at ${zoom}`, () => {
      const k = px / 32;
      for (const [shape, rows] of ROOMS) {
        const cells = cellsOfRows(rows);
        const bottom = Math.max(...cells.map((c) => c.y));
        const right = Math.max(...cells.filter((c) => c.y === bottom).map((c) => c.x));
        for (const [what, rise, x0, x1] of RISES) {
          // Rising into the bottom row, under its bottom-right cell (the digit's).
          const keepOff = rise
            ? [
                {
                  x: right * px + x0 * k,
                  y: (bottom + 1) * px - rise * k,
                  w: (x1 - x0) * k,
                  h: rise * k,
                },
              ]
            : [];
          for (const level of [1, 2]) {
            for (const [fixture, unmet] of combos) {
              const chars = unmet ? 1 : 2;
              const input = {
                cells,
                inset: roomWalls(cells, px),
                px,
                dpr,
                digit: chars,
                fixture,
                unmet,
                keepOff,
              };
              const l = pieceLabels({ ...input, level });
              const badges = `${fixture ? ', fixture' : ''}${unmet ? ', unmet' : ''}`;
              const name = `${shape} over ${what}, level ${level}${badges}`;
              // The stars come last: they move nothing.
              const { level: stars, ...rest } = l;
              expect(rest, name).toEqual(pieceLabels(input));
              if (!stars) continue;
              const box = badgeBox(stars);
              expect(overlaps(box, digitBox(l.digit!, chars)), name).toBe(false);
              for (const b of [l.fixture, l.unmet]) {
                if (b) expect(overlaps(box, badgeBox(b)), name).toBe(false);
              }
              for (const kb of keepOff) expect(overlaps(box, kb), name).toBe(false);
              // On the room's own cells, inside its outer walls.
              const wall = (OUTER * px) / 32;
              const e = 1e-6;
              for (
                let cy = Math.floor(box.y / px + e);
                cy <= Math.floor((box.y + box.h) / px - e);
                cy++
              ) {
                for (
                  let cx = Math.floor(box.x / px + e);
                  cx <= Math.floor((box.x + box.w) / px - e);
                  cx++
                ) {
                  expect(
                    cells.some((c) => c.x === cx && c.y === cy),
                    `${name}: ${cx},${cy}`,
                  ).toBe(true);
                }
              }
              const top = Math.min(
                ...cells.filter((c) => c.x === Math.floor(box.x / px + e)).map((c) => c.y),
              );
              expect(box.y, name).toBeGreaterThanOrEqual(top * px + wall - e);
              // Crisp, never smaller than a badge with its icon (minBadge), with room for every
              // star and its ring: a star is 9 icon pixels, an icon pixel apart.
              for (const v of [box.x, box.y, box.w, box.h, stars.ring, stars.icon])
                expect(whole(v, dpr), `${name}: ${v}`).toBe(true);
              expect(stars.icon, name).toBeGreaterThan(0);
              expect(Math.min(box.w, box.h), name).toBeGreaterThanOrEqual(
                minBadge(BADGE_ICON.level, dpr) - e,
              );
              const run = stars.icon * (BADGE_ICON.level * level + (level - 1)) + 2 * stars.ring;
              expect(stars.column ? box.h : box.w, name).toBeGreaterThanOrEqual(run - e);
              expect(stars.column ? box.w : box.h, name).toBeGreaterThanOrEqual(
                stars.icon * BADGE_ICON.level + 2 * stars.ring - e,
              );
            }
          }
        }
      }
    });
  }

  /** A room's stars at a zoom, with or without the other badges, at level 2. */
  const at = (
    rows: readonly string[],
    px: number,
    dpr: number,
    fixture: boolean,
    unmet: boolean,
  ) => {
    const cells = cellsOfRows(rows);
    const l = pieceLabels({
      cells,
      inset: roomWalls(cells, px),
      px,
      dpr,
      digit: unmet ? 1 : 2,
      fixture,
      unmet,
      level: 2,
    });
    return { ...l, stars: l.level };
  };

  it('show both stars where a room has the room: after the ⚠, under it, or in a column', () => {
    for (const [px, dpr] of [
      [32, 1],
      [64, 1],
      [32, 2],
      [48, 2],
    ] as const) {
      const zoom = `${px / 32}× at ${dpr}`;
      for (const [fixture, unmet] of combos) {
        // A Bedroom, a Living Room, an L-Kitchen in any turn: always. In a rectangle, as tall as
        // the ⚠ (both icons are 9 icon pixels; a fixture's is 8); in an L with both other badges
        // in its top row, perhaps smaller, under the fixture's.
        const full = fitBadge(badgeSize(px, BADGE_ICON.level, dpr), BADGE_ICON.level, dpr).size;
        for (const [shape, rows] of ROOMS.filter(([, r]) => r.length > 1 && r[0]!.length > 1)) {
          const l = at(rows, px, dpr, fixture, unmet);
          const name = `${shape} at ${zoom}${fixture ? ', fixture' : ''}${unmet ? ', unmet' : ''}`;
          expect(l.stars, name).toBeTruthy();
          const tall = l.stars!.column ? l.stars!.w : l.stars!.h;
          if (shape.startsWith('L') && fixture && unmet) {
            expect(tall, name).toBeGreaterThanOrEqual(minBadge(BADGE_ICON.level, dpr));
          } else {
            expect(tall, name).toBe(full);
          }
          if (l.unmet) expect(l.unmet.h, name).toBe(full);
        }
        // A room one cell wide (Renfield's, Rowan's): a column, under the top's badges.
        const narrow = at(['#', '#'], px, dpr, fixture, unmet);
        expect(narrow.stars, `1×2 at ${zoom}`).toMatchObject({ column: true });
        for (const b of [narrow.fixture, narrow.unmet]) {
          if (b) expect(narrow.stars!.y, `1×2 at ${zoom}`).toBeGreaterThan(b.y + b.h);
        }
      }
      // One cell wide and one row: beside the ⚠ in the row, unless both badges crowd it at 1×.
      expect(at(['##'], px, dpr, false, true).stars, zoom).toMatchObject({ column: false });
      expect(at(['##'], px, dpr, true, false).stars, zoom).toMatchObject({ column: false });
    }
    // On a Retina screen at 1×, the ⚠ and a fixture's badge in a one-row room leave room for a
    // smaller badge of stars (a device pixel per icon pixel), centered on the ⚠ beside it; at 1×
    // on a screen of 1, none.
    const retina = at(['##'], 32, 2, true, true);
    expect(retina.stars).toMatchObject({ icon: 0.5, ring: 0.5, column: false });
    expect(retina.stars!.y + retina.stars!.h / 2).toBeCloseTo(
      retina.unmet!.y + retina.unmet!.h / 2,
      0,
    );
    expect(at(['##'], 32, 1, true, true).stars).toBeUndefined();
    // At 1×, right after the ⚠ by a badge's gap, as tall as it, a star and a gap wider.
    const l = at(['##', '##'], 32, 1, false, true);
    expect(l.stars).toEqual({
      x: l.unmet!.x + l.unmet!.w + 2,
      y: l.unmet!.y,
      w: l.unmet!.w + 10,
      h: l.unmet!.h,
      ring: 1,
      icon: 1,
      column: false,
    });
    // A Bedroom with no other badges: in the ⚠'s place, top left inside the walls.
    expect(at(['##', '##'], 32, 1, false, false).stars).toMatchObject({
      x: 3 * 32 + 8,
      y: 5 * 32 + 8,
    });
    // A one-cell room at 1× hasn't the room beside its digit: Inspect states the level. (No card
    // renovates one, but the rule holds for any room; zoomed in, a smaller badge fits.)
    for (const dpr of [1, 2]) {
      expect(at(['#'], 32, dpr, false, false).stars, `1× at ${dpr}`).toBeUndefined();
    }
  });

  it('keep off what the labels keep off, or stay out', () => {
    const cells = cellsOf(2, 2);
    const input = {
      cells,
      inset: roomWalls(cells, 32),
      px: 32,
      dpr: 1,
      digit: 2,
      fixture: false,
      unmet: false,
      level: 2,
    };
    const free = pieceLabels(input).level!;
    expect(free).toMatchObject({ column: false });
    // Something in the second star's way: the stars stand in a column instead.
    const side = { x: free.x + free.h + 2, y: free.y, w: 6, h: 6 };
    const column = pieceLabels({ ...input, keepOff: [side] }).level!;
    expect(column).toMatchObject({ x: free.x, y: free.y, column: true });
    expect(overlaps(badgeBox(column), side)).toBe(false);
    // Something over their corner: they move along the top row past it, to the next cell's
    // corner, and never onto it; with the top row taken, they're left out.
    const mat = { x: free.x, y: free.y, w: 18, h: 6 };
    const moved = pieceLabels({ ...input, keepOff: [mat] }).level!;
    expect(moved).toMatchObject({ x: 4 * 32 + 2, y: free.y, column: false });
    expect(overlaps(badgeBox(moved), mat)).toBe(false);
    const band = { x: 3 * 32, y: 5 * 32, w: 64, h: 24 };
    expect(pieceLabels({ ...input, keepOff: [band] }).level).toBeUndefined();
    // Renfield's Room across, in front of the Treehouse: its roof takes the row's height, so the
    // stars stay out; the digit moved past it keeps its place.
    const row = cellsOf(2, 1);
    const tree = { x: 3 * 32 + 2, y: 6 * 32 - 25, w: 62, h: 25 };
    const front = { ...input, cells: row, inset: roomWalls(row, 32), keepOff: [tree] };
    const l = pieceLabels(front);
    expect(l.level).toBeUndefined();
    const { level: _, ...withoutStars } = front;
    expect(l.digit).toEqual(pieceLabels(withoutStars).digit);
  });
});

describe("the fixture hosts' gain badges (D-107)", () => {
  /** A badge `w` × 20 CSS px on a cell's middle at 1×, on whole pixels, as HostBadges has it. */
  const at = (cx: number, cy: number, w: number): Box => ({
    x: Math.round((cx + 0.5) * 32 - w / 2),
    y: (cy + 0.5) * 32 - 10,
    w,
    h: 20,
  });
  /** A one-character digit in a cell's bottom-right corner at 1× (digitFont, DIGIT_IN). */
  const digit = (cx: number, cy: number): Box => ({
    x: cx * 32 + 22,
    y: cy * 32 + 20,
    w: 8,
    h: 11,
  });
  const clear = (boxes: readonly Box[], keepOff: readonly Box[]) =>
    boxes.every((b, i) => boxes.every((o, j) => i === j || !overlaps(b, o))) &&
    boxes.every((b) => keepOff.every((k) => !overlaps(b, k)));

  it('stay on their spots when nothing is in the way', () => {
    const spots = [at(2, 2, 29), at(6, 2, 57)];
    expect(spreadBadges(spots, [], 32, 1)).toEqual(spots);
  });

  it('keep two one-cell rooms side by side apart, and off both digits', () => {
    // A Bathroom's "★ ▲ +2" (57 px, placed first as the best) and a Closet's "±0" beside it.
    const spots = [at(4, 5, 57), at(3, 5, 29)];
    const digits = [digit(3, 5), digit(4, 5)];
    expect(overlaps(spots[0]!, spots[1]!)).toBe(true);
    const boxes = spreadBadges(spots, digits, 32, 1);
    expect(clear(boxes, digits)).toBe(true);
    // Each stays within a cell of its spot.
    boxes.forEach((b, i) => {
      expect(Math.abs(b.x - spots[i]!.x)).toBeLessThanOrEqual(32);
      expect(Math.abs(b.y - spots[i]!.y)).toBeLessThanOrEqual(32);
    });
  });

  it('move the least they can, up or down before sideways', () => {
    // A digit just under a badge's middle: one step up clears it.
    const spot = at(2, 2, 29);
    const under = { x: spot.x + 10, y: spot.y + 18, w: 8, h: 11 };
    const [b] = spreadBadges([spot], [under], 32, 1);
    expect(b).toEqual({ ...spot, y: spot.y - 2 });
  });

  it('land on whole device pixels', () => {
    const spots = [
      { x: 10.3, y: 7.7, w: 29.5, h: 20 },
      { x: 20.1, y: 7.7, w: 57, h: 20 },
    ];
    for (const dpr of [1, 1.25, 2]) {
      for (const b of spreadBadges(spots, [], 32, dpr)) {
        expect(Math.abs(b.x * dpr - Math.round(b.x * dpr))).toBeLessThan(1e-6);
        expect(Math.abs(b.y * dpr - Math.round(b.y * dpr))).toBeLessThan(1e-6);
      }
    }
  });

  it('cover another badge least where nothing nearby is clear', () => {
    // Over something wider than they can move past, the second badge still keeps off the first.
    const spots = [at(5, 5, 57), at(5, 5, 57)];
    const walls = [{ x: 0, y: 0, w: 32 * 12, h: 32 * 12 }];
    const boxes = spreadBadges(spots, walls, 24, 1);
    expect(boxes[0]).toEqual(spots[0]);
    expect(overlaps(boxes[0]!, boxes[1]!)).toBe(false);
    // The nearest such spot: just above the first.
    expect(boxes[1]).toEqual({ ...spots[1]!, y: spots[1]!.y - 20 });
  });
});
