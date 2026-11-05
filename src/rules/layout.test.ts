import { describe, expect, it } from 'vitest';
import { computeLayout, layoutCache } from './layout.ts';
import { matchesNeighbor, matchesPiece } from './selectors.ts';
import { checkPlacement, REASONS } from './placement.ts';
import { emptyRows, houseFrom, TEST_CONTENT as C } from './testing.ts';

describe('neighbors', () => {
  it('counts each touching piece once, however many edges it shares', () => {
    // Two 2×2 Bedrooms side by side share two edges.
    const house = houseFrom(C, emptyRows(8, 8), [
      ['bedroom', 1, 1],
      ['bedroom', 3, 1],
    ]);
    const layout = computeLayout(C, house);
    expect(layout.neighbors.get(1)).toEqual([{ kind: 'piece', uid: 2 }]);
    expect(layout.neighbors.get(2)).toEqual([{ kind: 'piece', uid: 1 }]);
  });

  it('ignores diagonals', () => {
    const house = houseFrom(C, emptyRows(8, 8), [
      ['bathroom', 1, 1],
      ['bathroom', 2, 2],
    ]);
    expect(computeLayout(C, house).neighbors.get(1)).toEqual([]);
  });

  it('counts every Tree tile separately, but the pond and the creek once each', () => {
    // The Bathroom at (1,1) touches Trees at (1,0) and (0,1), and two creek tiles of one body.
    const house = houseFrom(C, ['TTT.', 'T.C.', 'TCC.', '....'], [['bathroom', 1, 1]]);
    expect(computeLayout(C, house).neighbors.get(1)).toEqual([
      { kind: 'terrain', feature: 'tree', x: 1, y: 0 },
      { kind: 'terrain', feature: 'tree', x: 0, y: 1 },
      { kind: 'terrain', feature: 'creek', x: 2, y: 1 },
    ]);
    // A 2×2 Bedroom touching two pond tiles still has one pond neighbor.
    const pond = houseFrom(C, ['.....', '..PP.', '..PP.', '.....'], [['bedroom', 0, 1]]);
    expect(computeLayout(C, pond).neighbors.get(1)).toEqual([
      { kind: 'terrain', feature: 'pond', x: 2, y: 1 },
    ]);
  });

  it('makes the street one neighbor for pieces touching the bottom edge, and boulders nothing', () => {
    const house = houseFrom(C, ['....', '.B..', '....', '....'], [['bedroom', 1, 2]]);
    const layout = computeLayout(C, house);
    expect(layout.neighbors.get(1)).toEqual([{ kind: 'street', x: 1 }]);
  });

  it('knows which pieces have a view', () => {
    const house = houseFrom(
      C,
      ['T.....', '......', '......', '......'],
      [
        ['bathroom', 0, 1],
        ['bathroom', 3, 1],
      ],
    );
    const layout = computeLayout(C, house);
    expect(layout.hasView.has(1)).toBe(true);
    expect(layout.hasView.has(2)).toBe(false);
  });

  it('caches by house identity', () => {
    const get = layoutCache(C);
    const house = houseFrom(C, emptyRows(4, 4));
    expect(get(house)).toBe(get(house));
    expect(get({ ...house })).not.toBe(get(house));
  });
});

describe('selectors', () => {
  const house = houseFrom(
    C,
    ['T.....', '......', '......', '......'],
    [
      ['bedroom', 1, 0],
      ['lKitchen', 3, 0],
      ['lawn', 1, 2],
    ],
  );
  const layout = computeLayout(C, house);

  it('match pieces by id, countsAs, tag, and property', () => {
    expect(matchesPiece(C, layout, { piece: 'kitchen' }, 2)).toBe(true); // L-Kitchen counts as a Kitchen
    expect(matchesPiece(C, layout, { piece: ['lawn', 'bedroom'] }, 1)).toBe(true);
    expect(matchesPiece(C, layout, { tag: 'Quiet' }, 1)).toBe(true);
    expect(matchesPiece(C, layout, { property: 'indoor' }, 3)).toBe(false);
    expect(matchesPiece(C, layout, { property: 'yard' }, 3)).toBe(true);
    expect(matchesPiece(C, layout, { property: 'room' }, 1)).toBe(true);
    expect(matchesPiece(C, layout, { property: 'view' }, 1)).toBe(true); // touches the Tree
    expect(matchesPiece(C, layout, { property: 'view' }, 2)).toBe(false);
    expect(matchesPiece(C, layout, { not: { tag: 'Quiet' } }, 2)).toBe(true);
    expect(matchesPiece(C, layout, { all: [{ tag: 'Quiet' }, { property: 'room' }] }, 1)).toBe(
      true,
    );
    expect(matchesPiece(C, layout, { feature: 'tree' }, 1)).toBe(false);
  });

  it('match lot features by id, tag, and view source', () => {
    const tree = { kind: 'terrain', feature: 'tree', x: 0, y: 0 } as const;
    const street = { kind: 'street', x: 0 } as const;
    expect(matchesNeighbor(C, layout, { feature: 'tree' }, tree)).toBe(true);
    expect(matchesNeighbor(C, layout, { tag: 'Quiet' }, tree)).toBe(true);
    expect(matchesNeighbor(C, layout, { property: 'viewSource' }, tree)).toBe(true);
    expect(matchesNeighbor(C, layout, { tag: 'Loud' }, street)).toBe(true);
    expect(matchesNeighbor(C, layout, { property: 'viewSource' }, street)).toBe(false);
    expect(matchesNeighbor(C, layout, { piece: 'bedroom' }, street)).toBe(false);
    expect(matchesNeighbor(C, layout, 'all', street)).toBe(true);
  });
});

describe('placement', () => {
  const rows = ['T.PP....', '..PP....', '.B......', '...C....', '...C....', '........'];

  function check(
    placements: Parameters<typeof houseFrom>[2],
    id: keyof typeof C.pieces,
    x: number,
    y: number,
    rot: 0 | 1 | 2 | 3 = 0,
  ) {
    const house = houseFrom(C, rows, placements);
    return checkPlacement(C, computeLayout(C, house), C.pieces[id], x, y, rot);
  }

  it('keeps pieces on the lot', () => {
    expect(check([], 'bedroom', 7, 0).reason).toBe(REASONS.offLot);
    expect(check([], 'bedroom', -1, 0).reason).toBe(REASONS.offLot);
    expect(check([], 'livingRoom', 4, 4).reason).toBe(REASONS.offLot);
  });

  it('refuses overlaps, water, and boulders', () => {
    expect(check([['lawn', 5, 4]], 'lawn', 6, 4).reason).toBe(REASONS.occupied);
    expect(check([], 'bathroom', 2, 0).reason).toBe(REASONS.pond);
    expect(check([], 'bathroom', 3, 3).reason).toBe(REASONS.creek);
    expect(check([], 'bathroom', 1, 2).reason).toBe(REASONS.boulder);
  });

  it('builds over Trees and reports them cleared', () => {
    const result = check([], 'bathroom', 0, 0);
    expect(result.legal).toBe(true);
    expect(result.clearedTrees).toEqual([{ x: 0, y: 0 }]);
  });

  it('keeps one connected house: a new room must touch a room', () => {
    expect(check([], 'bedroom', 5, 0).legal).toBe(true); // the first room goes anywhere
    expect(check([['bedroom', 5, 0]], 'bathroom', 7, 3).reason).toBe(REASONS.disconnected);
    expect(check([['bedroom', 5, 0]], 'bathroom', 7, 2).reason).toBe(REASONS.disconnected); // diagonal
    expect(check([['bedroom', 5, 0]], 'bathroom', 6, 2).legal).toBe(true); // below it
    expect(check([['bedroom', 5, 0]], 'bathroom', 4, 1).legal).toBe(true);
    // Yard pieces needn't touch the house, and don't count as house for rooms.
    expect(check([['bedroom', 5, 0]], 'lawn', 0, 4).legal).toBe(true);
    expect(check([['lawn', 4, 4]], 'bedroom', 0, 4).legal).toBe(true);
    expect(
      check(
        [
          ['bedroom', 5, 0],
          ['lawn', 5, 2],
        ],
        'bathroom',
        5,
        4,
      ).reason,
    ).toBe(REASONS.disconnected);
  });
});
