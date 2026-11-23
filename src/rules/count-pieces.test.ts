// D-212: countPieces, the read-only count behind the end screen's listing. It counts the house's
// pieces that match a selector, each once: a member's room is a Bedroom and an L-Kitchen a
// Kitchen (their cards' countsAs), a Bedroom with Bunk Beds is one Bedroom (where the
// checklist's count reads two, D-198), a Hallway is no room, and lot features never count. The
// houses use TEST_CONTENT on a 10 × 8 lot, placed unchecked; the street runs below row 7.

import { describe, expect, it } from 'vitest';
import type { RunState, Selector } from './index.ts';
import { countMatching } from './conditions.ts';
import { withFixture } from './fixtures.ts';
import { computeLayout } from './layout.ts';
import { createRules } from './run.ts';
import { emptyRows, houseFrom, setup, TEST_CONTENT as C, type Placement } from './testing.ts';

const rules = createRules(C);
const start = rules.newRun(setup('count-pieces'));

function withHouse(placements: readonly Placement[], rows = emptyRows(10, 8)): RunState {
  return { ...start, house: houseFrom(C, rows, placements) };
}

const BEDROOMS: Selector = { piece: 'bedroom' };
const KITCHENS: Selector = { piece: 'kitchen' };
const ROOMS: Selector = { property: 'room' };

/**
 * A Bedroom (uid 1), a Nursery (2) and Grandma's Room (3) in a row along the top, an L-Kitchen
 * (4) under the Bedroom, a Bathroom (5) beside it, and a Hallway (6) under the Nursery.
 *   y0  BBNNGG
 *   y1  BBNNGG
 *   y2  L.tHH.     (t: the Bathroom; H: the Hallway)
 *   y3  LL....
 */
const HOUSE: Placement[] = [
  ['bedroom', 0, 0],
  ['nursery', 2, 0],
  ['grandmasRoom', 4, 0],
  ['lKitchen', 0, 2],
  ['bathroom', 2, 2],
  ['hallway', 3, 2],
];

describe('countPieces', () => {
  it('counts a member’s room as a Bedroom and an L-Kitchen as a Kitchen', () => {
    const s = withHouse(HOUSE);
    expect(rules.countPieces(s, BEDROOMS)).toBe(3);
    expect(rules.countPieces(s, KITCHENS)).toBe(1);
    expect(rules.countPieces(s, { piece: 'bathroom' })).toBe(1);
    expect(rules.countPieces(s, { piece: 'nursery' })).toBe(1);
  });

  it('counts rooms without the Hallway, and nothing in an empty house', () => {
    expect(rules.countPieces(withHouse(HOUSE), ROOMS)).toBe(5);
    const empty = withHouse([]);
    for (const sel of [BEDROOMS, KITCHENS, ROOMS, 'all' as const]) {
      expect(rules.countPieces(empty, sel)).toBe(0);
    }
  });

  it('counts a Bedroom with Bunk Beds once, where the checklist’s count reads two', () => {
    const s = withHouse(HOUSE);
    const bunks = { ...s, house: withFixture(s.house, 1, 'bunkBeds', 1) };
    expect(rules.countPieces(bunks, BEDROOMS)).toBe(3);
    expect(countMatching(C, computeLayout(C, bunks.house), BEDROOMS)).toBe(4);
  });

  it('counts by the layout’s tags: a room with no outside wall is Dark', () => {
    // A Bathroom (uid 5) boxed in by four rooms has no outside wall, so it's interior, and Dark.
    // The others each touch the outside somewhere.
    //   y0  .AA..
    //   y1  .AABB
    //   y2  KKtBB
    //   y3  KKCC.
    //   y4  ..CC.
    const s = withHouse([
      ['bedroom', 1, 0],
      ['bedroom', 3, 1],
      ['bedroom', 2, 3],
      ['kitchen', 0, 2],
      ['bathroom', 2, 2],
    ]);
    const dark: Selector = { all: [ROOMS, { tag: 'Dark' }] };
    expect(rules.countPieces(s, dark)).toBe(1);
    expect(rules.describePiece(s, 5)?.tags).toContain('Dark');
  });

  it('never counts lot features', () => {
    const rows = ['TT........', 'CCCCCCCCCC', ...emptyRows(10, 6)];
    const s = withHouse([['bedroom', 0, 4]], rows);
    expect(rules.countPieces(s, { feature: 'tree' })).toBe(0);
    expect(rules.countPieces(s, { feature: 'creek' })).toBe(0);
    expect(rules.countPieces(s, 'all')).toBe(1);
  });

  it('reads the state and changes nothing', () => {
    const s = withHouse(HOUSE);
    const before = JSON.stringify(s);
    rules.countPieces(s, BEDROOMS);
    rules.countPieces(s, { all: [ROOMS, { tag: 'Dark' }] });
    expect(JSON.stringify(s)).toBe(before);
  });
});
