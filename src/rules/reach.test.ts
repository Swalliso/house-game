// D-199 (S31): a landmark's reach, the layout query behind it. The pieces with a tile within r
// tiles of one of a piece's own, across or diagonally (a square around each of its tiles), rooms
// and yard alike, touching or not; worked out once per layout, since the tally runs for every
// preview and every play the bot weighs.

import { describe, expect, it } from 'vitest';
import type { PieceDef } from './index.ts';
import { auraReach, computeLayout, piecesWithin, reachOf, tilesWithin } from './layout.ts';
import { lotFromRows } from './lot.ts';
import { emptyRows, houseFrom, TEST_CONTENT as C, type Placement } from './testing.ts';

describe('the pieces within r tiles (piecesWithin)', () => {
  // An L Kitchen (#. / ##) at (3, 3): its tiles (3, 3), (3, 4) and (4, 4), and its notch at
  // (4, 3). Closets around it, uids 2 to 7 in this order.
  const placements: Placement[] = [
    ['lKitchen', 3, 3],
    ['closet', 4, 3], // in the notch: touching
    ['closet', 6, 2], // 2 across and 2 up from (4, 4): diagonal counts
    ['closet', 1, 1], // 2 and 2 from (3, 3)
    ['closet', 5, 6], // 1 across and 2 down from (4, 4)
    ['closet', 6, 1], // 3 from every one of its tiles
    ['closet', 7, 4], // 3 across from (4, 4)
  ];
  const layout = computeLayout(C, houseFrom(C, emptyRows(10, 10), placements));

  it('is a square around each of its tiles, so an L reaches round its corner', () => {
    expect(piecesWithin(layout, 1, 2)).toEqual([2, 3, 4, 5]);
    expect(piecesWithin(layout, 1, 1)).toEqual([2]);
    expect(piecesWithin(layout, 1, 3)).toEqual([2, 3, 4, 5, 6, 7]);
  });

  it('goes both ways, never lists the piece itself, and is worked out once per layout', () => {
    // The Closet at (6, 2) reaches the L back, the notch's Closet, and its two neighbors east.
    expect(piecesWithin(layout, 3, 2)).toEqual([1, 2, 6, 7]);
    // The one at (6, 1) reaches the notch's, 2 across and 2 down, and the one below it: not the
    // L, as the L doesn't reach it.
    expect(piecesWithin(layout, 6, 2)).toEqual([2, 3]);
    const once = piecesWithin(layout, 1, 2);
    expect(piecesWithin(layout, 1, 2)).toBe(once);
    // A new layout, a new answer.
    const moved = computeLayout(
      C,
      houseFrom(C, emptyRows(10, 10), [placements[0]!, ['closet', 8, 8]]),
    );
    expect(piecesWithin(moved, 1, 2)).toEqual([]);
  });
});

describe('the tiles within r tiles (tilesWithin)', () => {
  const lot = lotFromRows(emptyRows(8, 8));
  const at = (list: readonly number[]) => list.map((i) => `${i % 8},${Math.floor(i / 8)}`);

  it('is the square around its tiles, clipped to the lot, without them', () => {
    expect(tilesWithin(lot, [{ x: 4, y: 4 }], 2)).toHaveLength(24);
    // In a corner, 3 × 3 less its own.
    expect(at(tilesWithin(lot, [{ x: 0, y: 0 }], 2))).toEqual([
      '1,0',
      '2,0',
      '0,1',
      '1,1',
      '2,1',
      '0,2',
      '1,2',
      '2,2',
    ]);
    // Two tiles side by side: a 6 × 5 square, less the two.
    expect(
      tilesWithin(
        lot,
        [
          { x: 3, y: 3 },
          { x: 4, y: 3 },
        ],
        2,
      ),
    ).toHaveLength(28);
  });
});

describe('a card’s reach (reachOf, auraReach)', () => {
  it('is its farthest aura’s, 0 for none: a conditional aura counts', () => {
    expect(reachOf(C.pieces.fountain)).toBe(2);
    expect(reachOf(C.pieces.bedroom)).toBe(0);
    // An adjacent aura (the Dining Room's) and a region's (the Mudroom's) reach no tiles.
    expect(reachOf(C.pieces.diningRoom)).toBe(0);
    expect(reachOf(C.pieces.mudroom)).toBe(0);
    const far: PieceDef = {
      ...C.pieces.fountain,
      effects: [
        { kind: 'aura', match: 'all', scope: { within: 1 }, pct: 10 },
        {
          kind: 'conditional',
          when: { in: 'frontYard' },
          effect: { kind: 'aura', match: 'all', scope: { within: 3 }, amount: 1 },
        },
      ],
    };
    expect(reachOf(far)).toBe(3);
    expect(far.effects.map(auraReach)).toEqual([1, 0]);
  });
});
