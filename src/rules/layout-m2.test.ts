// M2 layout properties (implementation-plan.md §4 Layout rules, §5 selectors and conditions,
// Appendix A · M2): exterior and interior rooms and the Dark tag, the sun and the Sunny tag
// (D-120), front and back yard, fenced yards, Hallway links, and the selectors and conditions that
// read them. Every lot here is hand-built with TEST_CONTENT.

import { describe, expect, it } from 'vitest';
import type { Content, HouseState, PieceCondition, Region, Selector, SunSide } from './index.ts';
import {
  computeLayout,
  fencedYardsBordered,
  largestFencedYard,
  pieceIn,
  REGION_BIT,
  tilesIn,
  type Layout,
} from './layout.ts';
import { lotFromRows } from './lot.ts';
import { checkDemolish, REASONS } from './placement.ts';
import { createRules } from './run.ts';
import {
  countTouching,
  matchesNeighbor,
  matchesPiece,
  meetsCondition,
  pieceTags,
} from './selectors.ts';
import { matchSets } from './sets.ts';
import { emptyRows, houseFrom, setup, TEST_CONTENT as C, type Placement } from './testing.ts';

function layoutOf(
  rows: readonly string[],
  placements: readonly Placement[],
  content: Content = C,
): Layout {
  return computeLayout(content, houseFrom(content, rows, placements));
}

/** The same house on a lot whose sun shines from another edge. */
function withSun(house: HouseState, sun: SunSide): HouseState {
  return { ...house, lot: { ...house.lot, sun } };
}

/** '#' on each tile in the region, '.' elsewhere. */
function regionRows(layout: Layout, region: Region): string[] {
  const { width: w, height: h } = layout.house.lot;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++)
      row += layout.regionBits[y * w + x]! & REGION_BIT[region] ? '#' : '.';
    rows.push(row);
  }
  return rows;
}

/** Each tile's fenced-yard id as a digit, '.' outside any fenced yard. */
function fencedRows(layout: Layout): string[] {
  const { width: w, height: h } = layout.house.lot;
  const rows: string[] = [];
  for (let y = 0; y < h; y++) {
    let row = '';
    for (let x = 0; x < w; x++) {
      const id = layout.fencedId[y * w + x]!;
      row += id >= 0 ? String(id) : '.';
    }
    rows.push(row);
  }
  return rows;
}

const pieceUids = (layout: Layout, uid: number, which: 'touching' | 'neighbors') =>
  (layout[which].get(uid) ?? []).flatMap((n) => (n.kind === 'piece' ? [n.uid] : []));

const tags = (layout: Layout, uid: number) => [...pieceTags(layout, uid)].sort();

const withFencedMin = (min: number): Content => ({
  ...C,
  balance: { ...C.balance, fencedYardMin: min },
});

// ---------------------------------------------------------------------------------------

describe('exterior and interior rooms', () => {
  // A Closet at (3,5) with a Hallway above, Bathrooms left and right, and a Long Hallway below.
  //   y4  ..HH....
  //   y5  ..bCb...
  //   y6  ..LLL...
  const enclosed: Placement[] = [
    ['closet', 3, 5], // 1
    ['hallway', 2, 4], // 2: (2,4) (3,4)
    ['bathroom', 2, 5], // 3
    ['bathroom', 4, 5], // 4
    ['longHallway', 2, 6], // 5: (2,6) (3,6) (4,6)
  ];

  it('makes a room enclosed by indoor pieces, Hallways included, interior and Dark', () => {
    const layout = layoutOf(emptyRows(8, 10), enclosed);
    expect([...layout.interior]).toEqual([1]);
    expect([...layout.exterior].sort()).toEqual([3, 4]);
    expect(tags(layout, 1)).toEqual(['Dark']);
    expect(matchesPiece(C, layout, { tag: 'Dark' }, 1)).toBe(true);
    expect(matchesPiece(C, layout, { property: 'interior' }, 1)).toBe(true);
    expect(matchesPiece(C, layout, { property: 'exterior' }, 1)).toBe(false);
    // The Bathrooms touch open ground.
    expect(matchesPiece(C, layout, { tag: 'Dark' }, 3)).toBe(false);
    expect(matchesPiece(C, layout, { property: 'exterior' }, 3)).toBe(true);
    expect(tags(layout, 3)).toEqual(['Wet']);
  });

  it('never makes a Hallway (a connector, not a room) exterior, interior, or Dark', () => {
    // A Hallway buried between rooms on every side.
    const layout = layoutOf(emptyRows(8, 10), [
      ['hallway', 2, 5], // 1: (2,5) (3,5)
      ['bedroom', 0, 4], // 2: (0..1, 4..5), left
      ['bedroom', 4, 4], // 3: (4..5, 4..5), right
      ['hallway', 2, 4], // 4: above
      ['longHallway', 1, 6], // 5: below
    ]);
    for (const uid of [1, 4, 5]) {
      expect(layout.exterior.has(uid)).toBe(false);
      expect(layout.interior.has(uid)).toBe(false);
      expect(matchesPiece(C, layout, { tag: 'Dark' }, uid)).toBe(false);
      expect(matchesPiece(C, layout, { property: 'room' }, uid)).toBe(false);
    }
  });

  it.each([
    [
      'the top-left corner',
      [
        ['closet', 0, 0],
        ['bathroom', 1, 0],
        ['bathroom', 0, 1],
      ],
    ],
    [
      'the top edge',
      [
        ['closet', 3, 0],
        ['bathroom', 2, 0],
        ['bathroom', 4, 0],
        ['bathroom', 3, 1],
      ],
    ],
    [
      'the right edge',
      [
        ['closet', 7, 3],
        ['bathroom', 7, 2],
        ['bathroom', 7, 4],
        ['bathroom', 6, 3],
      ],
    ],
    [
      'the street edge',
      [
        ['closet', 3, 7],
        ['bathroom', 2, 7],
        ['bathroom', 4, 7],
        ['bathroom', 3, 6],
      ],
    ],
  ] as [string, Placement[]][])(
    'makes a room on %s exterior, though indoor pieces fill every in-lot side',
    (_, placements) => {
      const layout = layoutOf(emptyRows(8, 8), placements);
      expect(layout.exterior.has(1)).toBe(true);
      expect(layout.interior.has(1)).toBe(false);
      expect(matchesPiece(C, layout, { tag: 'Dark' }, 1)).toBe(false);
    },
  );

  it.each([
    ['open ground', null],
    ['a yard piece', 'sapling'],
    ['a Flower Bed', 'flowerBed'],
    ['an outbuilding', 'doghouse'],
  ] as const)('makes a room beside %s exterior', (_, id) => {
    const placements = enclosed.filter((p) => !(p[0] === 'bathroom' && p[1] === 4));
    if (id) placements.push([id, 4, 5]);
    const layout = layoutOf(emptyRows(8, 10), placements);
    expect(layout.exterior.has(1)).toBe(true);
    expect(layout.interior.has(1)).toBe(false);
    expect(tags(layout, 1)).toEqual([]);
  });

  it('makes a room beside a Fence exterior: a Fence is a wall, but not indoor', () => {
    const placements = enclosed.filter((p) => !(p[0] === 'bathroom' && p[1] === 4));
    placements.push(['fence', 4, 2, 1]); // vertical: (4,2) .. (4,5)
    const layout = layoutOf(emptyRows(8, 10), placements);
    expect(layout.occupant[5 * 8 + 4]).toBe(5); // the Fence covers (4,5)
    expect(layout.exterior.has(1)).toBe(true);
    expect(matchesPiece(C, layout, { tag: 'Dark' }, 1)).toBe(false);
  });

  it('makes a multi-tile room exterior if any one tile touches the outside', () => {
    // A Bedroom at (2..3, 2..3) walled in on every side but (4,3).
    const walls: Placement[] = [
      ['bedroom', 2, 2], // 1
      ['hallway', 2, 1], // 2: above
      ['hallway', 1, 2, 1], // 3: left, (1,2) (1,3)
      ['hallway', 2, 4], // 4: below
      ['bathroom', 4, 2], // 5: right, top tile only
    ];
    const open = layoutOf(emptyRows(8, 8), walls);
    expect(open.exterior.has(1)).toBe(true);
    const closed = layoutOf(emptyRows(8, 8), [...walls, ['bathroom', 4, 3]]);
    expect(closed.interior.has(1)).toBe(true);
    expect(pieceTags(closed, 1).has('Dark')).toBe(true);
    expect(pieceTags(closed, 1).has('Quiet')).toBe(true); // its own tags stay
  });

  it('never puts an interior room in the sun: a building stands on every side of it', () => {
    for (const sun of ['top', 'left', 'right', 'bottom'] as const) {
      const layout = computeLayout(C, withSun(houseFrom(C, emptyRows(8, 10), enclosed), sun));
      expect(layout.interior.has(1)).toBe(true);
      expect(tags(layout, 1)).toEqual(['Dark']);
      expect(tilesIn(layout, 1, 'sunny')).toBe(0);
    }
  });

  it('ignores links: a linked room is still exterior or interior by its own tiles', () => {
    // The enclosed Closet touches the Hallway at (2..3,4), which also touches a Bedroom outside.
    const layout = layoutOf(emptyRows(8, 10), [...enclosed, ['bedroom', 0, 3]]);
    expect(layout.links.get(1)?.has(6)).toBe(true);
    expect(layout.interior.has(1)).toBe(true);
    expect(layout.exterior.has(6)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------

describe('the sun (D-120)', () => {
  it('lights every tile but Trees and the tiles a Tree shades, behind it from the sun', () => {
    // The sun from the back (top): each Tree shades the tile below it.
    const layout = layoutOf(['......', '.T....', '......', '...T..', '......', '......'], []);
    expect(regionRows(layout, 'sunny')).toEqual([
      '######',
      '#.####',
      '#.####',
      '###.##',
      '###.##',
      '######',
    ]);
  });

  it('lets a building shade its own back tiles and the tile behind it', () => {
    //   y0  ..BB..   the Bedroom's top row is in the sun, its bottom row in its own shade,
    //   y1  ..BB..   and the tiles below it are in its shade
    const layout = layoutOf(emptyRows(6, 4), [['bedroom', 2, 0]]);
    expect(regionRows(layout, 'sunny')).toEqual(['######', '##..##', '##..##', '######']);
    expect(tilesIn(layout, 1, 'sunny')).toBe(2);
    expect(tags(layout, 1)).toEqual(['Quiet', 'Sunny']);
    // In the region only if every tile is.
    expect(pieceIn(layout, 1, 'sunny')).toBe(false);
    expect(matchesPiece(C, layout, { tag: 'Sunny' }, 1)).toBe(true);
    expect(matchesPiece(C, layout, { in: 'sunny' }, 1)).toBe(false);
  });

  it('makes a building Sunny while one wall faces the sun with nothing in front of it', () => {
    const layout = layoutOf(emptyRows(8, 8), [
      ['bedroom', 0, 2], // 1: open above: Sunny
      ['bedroom', 0, 4], // 2: Bedroom 1 stands in front of its whole sunny wall
      ['bedroom', 4, 4], // 3: open above
      ['closet', 4, 3], // 4: in front of half of Bedroom 3's wall; the Closet itself is Sunny
      ['doghouse', 7, 7], // 5: an outbuilding in the sun
    ]);
    expect(pieceTags(layout, 1).has('Sunny')).toBe(true);
    expect(pieceTags(layout, 2).has('Sunny')).toBe(false);
    expect(tilesIn(layout, 3, 'sunny')).toBe(1);
    expect(pieceTags(layout, 3).has('Sunny')).toBe(true);
    expect(pieceTags(layout, 4).has('Sunny')).toBe(true);
    expect(pieceTags(layout, 5).has('Sunny')).toBe(true);
    // A Tree in front of a wall shades it too.
    const shaded = layoutOf(['..TT....', ...emptyRows(8, 5)], [['bedroom', 2, 1]]);
    expect(pieceTags(shaded, 1).has('Sunny')).toBe(false);
  });

  it('never makes a yard piece Sunny, though it counts its tiles in the sun', () => {
    const layout = layoutOf(emptyRows(8, 8), [
      ['lawn', 4, 0], // 1: all four tiles in the sun
      ['flowerBed', 0, 0], // 2
    ]);
    expect(tags(layout, 1)).toEqual(['Green', 'Outdoor']);
    expect(pieceTags(layout, 2).has('Sunny')).toBe(false);
    expect(tilesIn(layout, 1, 'sunny')).toBe(4);
    expect(pieceIn(layout, 1, 'sunny')).toBe(true);
    expect(matchesPiece(C, layout, { in: 'sunny' }, 1)).toBe(true);
    // A yard piece casts no shade: the Bedroom behind the Lawn keeps its sun.
    const behind = layoutOf(emptyRows(8, 8), [
      ['lawn', 0, 0],
      ['bedroom', 0, 2],
    ]);
    expect(pieceTags(behind, 2).has('Sunny')).toBe(true);
  });

  it('gives the sun back once a piece is built over the Tree in front (the Tree is gone)', () => {
    const rows = ['..T...', '......', '......', '......'];
    const before = layoutOf(rows, [['bedroom', 2, 1]]);
    expect(tilesIn(before, 1, 'sunny')).toBe(1);
    const after = layoutOf(rows, [
      ['bedroom', 2, 1],
      ['sapling', 2, 0],
    ]);
    expect(after.house.lot.terrain[2]).toBeNull();
    expect(tilesIn(after, 1, 'sunny')).toBe(2);
  });

  it('lets the Old Shed shade its own back tiles and the tile behind it, as a building does', () => {
    const layout = layoutOf(['..SS..', '..SS..', '......'], []);
    expect(regionRows(layout, 'sunny')).toEqual(['######', '##..##', '##..##']);
  });

  it('follows the lot’s sun: left, right, and the street’s side', () => {
    // A Bedroom at (3..4, 2..3): its sunny wall and its shade turn with the sun.
    const house = houseFrom(C, emptyRows(8, 6), [['bedroom', 3, 2]]);
    const lit = (sun: SunSide) => regionRows(computeLayout(C, withSun(house, sun)), 'sunny');
    const open = '########';
    expect(lit('left')).toEqual([open, open, '####..##', '####..##', open, open]);
    expect(lit('right')).toEqual([open, open, '##..####', '##..####', open, open]);
    expect(lit('bottom')).toEqual([open, '###..###', '###..###', open, open, open]);
    expect(lotFromRows(emptyRows(4, 4), 'bottom').sun).toBe('bottom');
    expect(lotFromRows(emptyRows(4, 4)).sun).toBe('top');
  });

  it('tells the board which tiles are lit and whether a ghost would be Sunny', () => {
    const R = createRules(C);
    const run = (rows: readonly string[], placements: Placement[]) => ({
      ...R.newRun(setup('sun')),
      house: houseFrom(C, rows, placements),
      hand: [{ kind: 'piece' as const, id: 'bedroom' as const }],
    });
    const s = run(emptyRows(8, 6), [['bedroom', 2, 0]]);
    expect(R.describePiece(s, 1)!.sunlit).toEqual([
      { x: 2, y: 0 },
      { x: 3, y: 0 },
    ]);
    const play = (x: number, y: number) =>
      ({ t: 'place', from: 'hand', i: 0, x, y, rot: 0 }) as const;
    // Beside it, in the open: Sunny. Right behind it, in its shade: not.
    expect(R.preview(s, play(4, 0))).toMatchObject({ legal: true, sunny: true });
    const behind = R.preview(s, play(2, 2));
    expect(behind.legal).toBe(true);
    expect(behind).not.toHaveProperty('sunny');
    // Behind a row of Trees, too.
    const trees = run(['..TT....', ...emptyRows(8, 5)], []);
    expect(R.preview(trees, play(2, 1))).not.toHaveProperty('sunny');
    expect(R.preview(trees, play(5, 1))).toMatchObject({ legal: true, sunny: true });
  });
});

// ---------------------------------------------------------------------------------------

describe('front yard and back yard', () => {
  it('makes all yard front yard before any indoor piece', () => {
    const layout = layoutOf(emptyRows(6, 6), [
      ['lawn', 0, 0], // 1
      ['doghouse', 5, 0], // 2
      ['fence', 1, 3], // 3
    ]);
    expect(layout.frontRow).toBeNull();
    expect(regionRows(layout, 'frontYard')).toEqual(Array(6).fill('######'));
    expect(regionRows(layout, 'backYard')).toEqual(Array(6).fill('......'));
    for (const uid of [1, 2, 3]) {
      expect(pieceIn(layout, uid, 'frontYard')).toBe(true);
      expect(pieceIn(layout, uid, 'backYard')).toBe(false);
    }
  });

  // A Bedroom at (3..4, 2..3): the front row is 3.
  //   y0  ...s....      s Sapling (back)
  //   y1  ........
  //   y2  LL.BBf..      L Lawn C (side yard: back), f Flower Bed (side yard: back)
  //   y3  LL.BB.MM      M Lawn B straddles the front row
  //   y4  AA....MM      A Lawn A (front)
  //   y5  AA......
  //   y6  ...F....      F Flower Bed (front)
  //   y7  ........
  const placements: Placement[] = [
    ['bedroom', 3, 2], // 1
    ['lawn', 0, 4], // 2: A
    ['lawn', 6, 3], // 3: B
    ['lawn', 0, 2], // 4: C
    ['sapling', 3, 0], // 5
    ['flowerBed', 5, 2], // 6
    ['flowerBed', 3, 6], // 7
  ];
  const layout = layoutOf(emptyRows(8, 8), placements);

  it('splits the yard by rows at the house’s front row', () => {
    expect(layout.frontRow).toBe(3);
    expect(regionRows(layout, 'frontYard')).toEqual([
      '........',
      '........',
      '........',
      '........',
      '########',
      '########',
      '########',
      '########',
    ]);
    expect(regionRows(layout, 'backYard')).toEqual([
      '########',
      '########',
      '###..###',
      '###..###',
      '........',
      '........',
      '........',
      '........',
    ]);
  });

  it('puts pieces in front, behind, and beside the house in the right yard', () => {
    expect(pieceIn(layout, 2, 'frontYard')).toBe(true); // in front
    expect(pieceIn(layout, 7, 'frontYard')).toBe(true);
    expect(pieceIn(layout, 5, 'backYard')).toBe(true); // behind
    expect(pieceIn(layout, 4, 'backYard')).toBe(true); // a side yard is back yard
    expect(pieceIn(layout, 6, 'backYard')).toBe(true); // right beside the house too
    expect(pieceIn(layout, 4, 'frontYard')).toBe(false);
    expect(matchesPiece(C, layout, { in: 'frontYard' }, 2)).toBe(true);
    expect(matchesPiece(C, layout, { in: 'backYard' }, 4)).toBe(true);
    expect(matchesPiece(C, layout, { in: 'frontYard' }, 6)).toBe(false);
  });

  it('puts a piece straddling the front row in neither yard', () => {
    expect(tilesIn(layout, 3, 'frontYard')).toBe(2);
    expect(tilesIn(layout, 3, 'backYard')).toBe(2);
    expect(pieceIn(layout, 3, 'frontYard')).toBe(false);
    expect(pieceIn(layout, 3, 'backYard')).toBe(false);
    expect(matchesPiece(C, layout, { in: 'frontYard' }, 3)).toBe(false);
    expect(matchesPiece(C, layout, { in: 'backYard' }, 3)).toBe(false);
  });

  it('puts indoor tiles in neither yard', () => {
    expect(tilesIn(layout, 1, 'frontYard')).toBe(0);
    expect(tilesIn(layout, 1, 'backYard')).toBe(0);
  });

  it('feeds the Flower Bed’s {in: frontYard} condition', () => {
    expect(meetsCondition(C, layout, { in: 'frontYard' }, 7)).toBe(true);
    expect(meetsCondition(C, layout, { in: 'frontYard' }, 6)).toBe(false);
  });

  it('takes the front row from the indoor tile nearest the street, so a wing moves it', () => {
    const wing = layoutOf(emptyRows(8, 8), [
      ['bedroom', 3, 2], // 1: rows 2–3
      ['bathroom', 3, 4], // 2: row 4
      ['sapling', 7, 4], // 3: beside the wing
      ['sapling', 7, 5], // 4: in front of it
    ]);
    expect(wing.frontRow).toBe(4);
    expect(pieceIn(wing, 3, 'backYard')).toBe(true);
    expect(pieceIn(wing, 4, 'frontYard')).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------

describe('fenced yards', () => {
  // A Bedroom in the top-left corner, a Fence below the yard and one down its right side.
  //   y0  BB..|...
  //   y1  BB..|...
  //   y2  ----|...
  //   y3  ....|...
  const corner: Placement[] = [
    ['bedroom', 0, 0], // 1
    ['fence', 4, 0, 1], // 2: (4,0) .. (4,3)
    ['fence', 0, 2], // 3: (0,2) .. (3,2)
  ];
  const yardRows = ['..00....', '..00....', ...Array(6).fill('........')];

  it('encloses a region with the house, Fences, and the lot edge', () => {
    const layout = layoutOf(emptyRows(8, 8), corner);
    expect(fencedRows(layout)).toEqual(yardRows);
    expect(layout.fencedSizes).toEqual([4]);
    expect(largestFencedYard(layout)).toBe(4);
    expect(regionRows(layout, 'fencedYard')).toEqual(yardRows.map((r) => r.replace(/0/g, '#')));
    // Walls aren't in the yard.
    expect(tilesIn(layout, 2, 'fencedYard')).toBe(0);
    expect(tilesIn(layout, 1, 'fencedYard')).toBe(0);
  });

  it('keeps yard pieces, outbuildings, Trees, and water inside as part of the region', () => {
    const rows = ['..T.....', '...P....', ...emptyRows(8, 6)];
    const layout = layoutOf(rows, [
      ...corner,
      ['sapling', 3, 0], // 4
      ['doghouse', 2, 1], // 5
    ]);
    expect(layout.house.lot.terrain[2]).toBe('tree'); // nothing was built over it
    expect(fencedRows(layout)).toEqual(yardRows);
    expect(layout.fencedSizes).toEqual([4]);
    expect(pieceIn(layout, 4, 'fencedYard')).toBe(true);
    expect(pieceIn(layout, 5, 'fencedYard')).toBe(true);
    expect(matchesPiece(C, layout, { in: 'fencedYard' }, 5)).toBe(true);
    // The Doghouse's requirement holds.
    expect(meetsCondition(C, layout, { in: 'fencedYard' }, 5)).toBe(true);
  });

  it('needs at least fencedYardMin tiles', () => {
    const at4 = computeLayout(withFencedMin(4), houseFrom(C, emptyRows(8, 8), corner));
    expect(at4.fencedSizes).toEqual([4]);
    const at5 = computeLayout(withFencedMin(5), houseFrom(C, emptyRows(8, 8), corner));
    expect(at5.fencedSizes).toEqual([]);
    expect(fencedRows(at5)).toEqual(Array(8).fill('........'));
    expect(largestFencedYard(at5)).toBe(0);
    // A 2-tile pocket: the right Fence one tile further left, and a Bathroom under it.
    const pocket = layoutOf(emptyRows(8, 8), [
      ['bedroom', 0, 0],
      ['fence', 3, 0, 1], // (3,0) .. (3,3)
      ['bathroom', 2, 2], // closes (2,0)–(2,1) from below
    ]);
    expect(pocket.fencedSizes).toEqual([]);
  });

  it('is not fenced if it touches the street row', () => {
    // The yard below the house reaches the bottom row of a 4×4 lot.
    const down = layoutOf(emptyRows(4, 4), [
      ['bedroom', 0, 0],
      ['fence', 2, 0, 1], // (2,0) .. (2,3)
    ]);
    expect(down.fencedSizes).toEqual([]);
    // The same shape with the yard behind the house, away from the street.
    const up = layoutOf(emptyRows(4, 5), [
      ['bedroom', 0, 2],
      ['fence', 2, 0, 1], // (2,0) .. (2,3)
    ]);
    expect(fencedRows(up)).toEqual(['00..', '00..', '....', '....', '....']);
  });

  it.each([
    ['the pond', 'P'],
    ['a Boulder', 'B'],
    ['a Tree', 'T'],
  ])('lets the yard leak out through %s: only indoor tiles and Fences are walls', (_, tile) => {
    // The corner yard with its right Fence moved down a tile, and a feature in the gap at (4,0).
    const rows = [`....${tile}...`, ...emptyRows(8, 7)];
    const layout = layoutOf(rows, [
      ['bedroom', 0, 0],
      ['fence', 4, 1, 1], // (4,1) .. (4,4)
      ['fence', 0, 2], // (0,2) .. (3,2)
    ]);
    expect(layout.house.lot.terrain[4]).not.toBeNull();
    expect(layout.fencedSizes).toEqual([]);
    expect(layout.fencedId[2]).toBe(-1); // (2,0), which the Fence alone used to close in
  });

  it('is not fenced if it borders no Fence (a courtyard closed by the house alone)', () => {
    // A 2×2 courtyard at (2..3, 2..3) ringed by Hallways.
    const ring: Placement[] = [
      ['hallway', 2, 1], // 1: above
      ['hallway', 1, 2, 1], // 2: left
      ['hallway', 4, 2, 1], // 3: right
    ];
    const courtyard = layoutOf(emptyRows(8, 8), [...ring, ['hallway', 2, 4]]);
    expect(courtyard.fencedSizes).toEqual([]);
    // Swap the lower Hallway for a Fence and it's a fenced yard.
    const fenced = layoutOf(emptyRows(8, 8), [...ring, ['fence', 1, 4]]);
    expect(fenced.fencedSizes).toEqual([4]);
    expect(fencedRows(fenced).slice(1, 5)).toEqual([
      '........',
      '..00....',
      '..00....',
      '........',
    ]);
  });

  it('is not fenced if it borders no indoor piece: a lone L-shaped Fence in a corner', () => {
    // The L-shaped Fence pack (D-106) at (3,0) closes (4..5, 0..1) against the top and right
    // edges.
    const lone: Placement[] = [['fence', 3, 0, 0, ['#..', '#..', '###']]];
    const layout = layoutOf(emptyRows(6, 6), lone);
    expect(layout.cells.get(1)).toEqual([
      { x: 3, y: 0 },
      { x: 3, y: 1 },
      { x: 3, y: 2 },
      { x: 4, y: 2 },
      { x: 5, y: 2 },
    ]);
    expect(layout.fencedSizes).toEqual([]);
    // A house elsewhere on the lot doesn't help: it has to border the region.
    const away = layoutOf(emptyRows(6, 6), [...lone, ['bedroom', 0, 4]]);
    expect(away.fencedSizes).toEqual([]);
    // A room inside the corner borders it (3 tiles are left, so lower the minimum).
    const inside = computeLayout(
      withFencedMin(3),
      houseFrom(C, emptyRows(6, 6), [...lone, ['closet', 5, 0]]),
    );
    expect(fencedRows(inside).slice(0, 3)).toEqual(['....0.', '....00', '......']);
  });

  // Two yards either side of a Bedroom.
  //   y0  0000BB11|.
  //   y1  0000BB11|.
  //   y2  --------|.
  //   y3  ........|.
  const two: Placement[] = [
    ['bedroom', 4, 0], // 1
    ['fence', 0, 2], // 2: (0..3, 2)
    ['fence', 4, 2], // 3: (4..7, 2)
    ['fence', 8, 0, 1], // 4: (8, 0..3)
    ['lawn', 0, 0], // 5: inside the left yard
    ['sapling', 9, 5], // 6: outside
  ];
  const twoLayout = layoutOf(emptyRows(10, 8), two);

  it('numbers each fenced yard and records its size', () => {
    expect(fencedRows(twoLayout)).toEqual([
      '0000..11..',
      '0000..11..',
      ...Array(6).fill('..........'),
    ]);
    expect(twoLayout.fencedSizes).toEqual([8, 4]);
    expect(largestFencedYard(twoLayout)).toBe(8);
    expect(pieceIn(twoLayout, 5, 'fencedYard')).toBe(true);
    expect(tilesIn(twoLayout, 5, 'fencedYard')).toBe(4);
  });

  it('knows which fenced yards a piece borders', () => {
    expect(fencedYardsBordered(twoLayout, 1)).toEqual([0, 1]); // the Bedroom, between both
    expect(fencedYardsBordered(twoLayout, 2)).toEqual([0]);
    expect(fencedYardsBordered(twoLayout, 3)).toEqual([1]); // under the Bedroom and yard 1
    expect(fencedYardsBordered(twoLayout, 4)).toEqual([1]);
    expect(fencedYardsBordered(twoLayout, 5)).toEqual([0]); // a Lawn sitting in yard 0
    expect(fencedYardsBordered(twoLayout, 6)).toEqual([]);
    expect(fencedYardsBordered(twoLayout, 99)).toEqual([]);
  });

  it('feeds {borders: fencedYard} and {in: fencedYard}', () => {
    const borders: PieceCondition = { borders: 'fencedYard' };
    expect(meetsCondition(C, twoLayout, borders, 1)).toBe(true);
    expect(meetsCondition(C, twoLayout, borders, 4)).toBe(true);
    expect(meetsCondition(C, twoLayout, borders, 6)).toBe(false);
    expect(meetsCondition(C, twoLayout, { in: 'fencedYard' }, 5)).toBe(true);
    expect(meetsCondition(C, twoLayout, { in: 'fencedYard' }, 6)).toBe(false);
    expect(meetsCondition(C, twoLayout, { in: 'fencedYard' }, 2)).toBe(false); // a Fence is a wall
  });

  it('still makes fenced-yard tiles front or back yard', () => {
    // Both yards are behind the house's front row (1), so they're back yard.
    expect(pieceIn(twoLayout, 5, 'backYard')).toBe(true);
    expect(tilesIn(twoLayout, 5, 'frontYard')).toBe(0);
  });
});

// ---------------------------------------------------------------------------------------

describe('links', () => {
  // Bedroom – Hallway – Bedroom in a row.
  //   y0  BBHHCC
  //   y1  BB..CC
  const pair: Placement[] = [
    ['bedroom', 0, 0], // 1
    ['hallway', 2, 0], // 2
    ['bedroom', 4, 0], // 3
  ];

  it('makes rooms touching a Hallway scoring neighbors, but not physical ones', () => {
    const layout = layoutOf(emptyRows(10, 6), pair);
    expect(layout.links.get(1)).toEqual(new Set([3]));
    expect(layout.links.get(3)).toEqual(new Set([1]));
    expect(layout.links.has(2)).toBe(false);
    expect(pieceUids(layout, 1, 'touching')).toEqual([2]);
    expect(pieceUids(layout, 1, 'neighbors')).toEqual([3]);
    expect(pieceUids(layout, 3, 'touching')).toEqual([2]);
    expect(pieceUids(layout, 3, 'neighbors')).toEqual([1]);
    // The Hallway still sees the rooms it touches.
    expect(pieceUids(layout, 2, 'neighbors')).toEqual([1, 3]);
  });

  it('keeps the Hallway itself out of scoring neighbors and touching selectors', () => {
    const layout = layoutOf(emptyRows(10, 6), pair);
    expect(countTouching(C, layout, 1, { property: 'indoor' })).toBe(1); // the other Bedroom
    expect(countTouching(C, layout, 1, { piece: 'hallway' })).toBe(0);
    expect(countTouching(C, layout, 1, { piece: 'bedroom' })).toBe(1);
  });

  it('links every room touching a chain of Hallways, but no yard pieces', () => {
    //   y0  BBHHLLLCC.
    //   y1  BBww.b.CC.
    //   y2  ..ww......
    const layout = layoutOf(emptyRows(10, 6), [
      ['bedroom', 0, 0], // 1
      ['hallway', 2, 0], // 2
      ['longHallway', 4, 0], // 3: (4..6, 0)
      ['bedroom', 7, 0], // 4
      ['bathroom', 5, 1], // 5: under the Long Hallway
      ['lawn', 2, 1], // 6: under the Hallway, beside Bedroom 1
    ]);
    expect(layout.links.get(1)).toEqual(new Set([4, 5]));
    expect(layout.links.get(4)).toEqual(new Set([1, 5]));
    expect(layout.links.get(5)).toEqual(new Set([1, 4]));
    expect(layout.links.has(6)).toBe(false);
    expect(pieceUids(layout, 1, 'neighbors')).toEqual([4, 5, 6]);
    expect(pieceUids(layout, 5, 'neighbors')).toEqual([1, 4]);
    expect(pieceUids(layout, 5, 'touching')).toEqual([3]);
    // The Lawn keeps its physical Bedroom and loses the Hallway.
    expect(pieceUids(layout, 6, 'touching')).toEqual([1, 2]);
    expect(pieceUids(layout, 6, 'neighbors')).toEqual([1]);
  });

  it('links only within a Hallway group: two groups meeting at a room stay apart', () => {
    //   y0  BBHHCC
    //   y1  BB..CC      a vertical Hallway under Bedroom 1, then a Bathroom under it
    //   y2  h.....
    //   y3  h.....
    //   y4  b.....
    const layout = layoutOf(emptyRows(8, 8), [
      ['bedroom', 0, 0], // 1
      ['hallway', 2, 0], // 2: (2,0) (3,0)
      ['bedroom', 4, 0], // 3
      ['hallway', 0, 2, 1], // 4: (0,2) (0,3)
      ['bathroom', 0, 4], // 5
    ]);
    expect(layout.links.get(1)).toEqual(new Set([3, 5]));
    expect(layout.links.get(3)).toEqual(new Set([1]));
    expect(layout.links.get(5)).toEqual(new Set([1]));
    expect(pieceUids(layout, 3, 'neighbors')).toEqual([1]);
  });

  it('counts a room that is both touching and linked once', () => {
    const layout = layoutOf(emptyRows(8, 6), [
      ['bedroom', 0, 0], // 1
      ['hallway', 2, 0], // 2
      ['bathroom', 2, 1], // 3: touches the Bedroom and the Hallway
    ]);
    expect(layout.links.get(1)).toEqual(new Set([3]));
    expect(pieceUids(layout, 1, 'neighbors')).toEqual([3]);
    expect(countTouching(C, layout, 1, { piece: 'bathroom' })).toBe(1);
  });

  it('carries no terrain or views across a link', () => {
    // Bedroom 3 touches the Tree at (6,0); Bedroom 1 is only linked to it.
    const layout = layoutOf(['......T...', ...emptyRows(10, 5)], pair);
    expect(layout.neighbors.get(3)).toContainEqual({
      kind: 'terrain',
      feature: 'tree',
      x: 6,
      y: 0,
    });
    expect(layout.neighbors.get(1)!.some((n) => n.kind === 'terrain')).toBe(false);
    expect(layout.hasView.has(3)).toBe(true);
    expect(layout.hasView.has(1)).toBe(false);
    expect(matchesPiece(C, layout, { property: 'view' }, 1)).toBe(false);
    expect(countTouching(C, layout, 1, { feature: 'tree' })).toBe(0);
  });

  it('doesn’t count for connectivity: removing the Hallway would split the house', () => {
    const layout = layoutOf(emptyRows(10, 6), pair);
    const hall = checkDemolish(C, layout, 2, 0);
    expect(hall.legal).toBe(false);
    if (!hall.legal) expect(hall.reason).toBe(REASONS.split);
    expect(checkDemolish(C, layout, 4, 0).legal).toBe(true); // an end Bedroom is fine
  });

  it('forms Jack-and-Jill from a Bedroom, Bathroom, and Bedroom linked by a Hallway', () => {
    //   y0  BBLLLCC
    //   y1  BB.b.CC
    const linked: Placement[] = [
      ['bedroom', 0, 0], // 1
      ['longHallway', 2, 0], // 2: (2..4, 0)
      ['bedroom', 5, 0], // 3
      ['bathroom', 3, 1], // 4: under the Long Hallway
    ];
    const layout = layoutOf(emptyRows(10, 6), linked);
    const sets = matchSets(C, layout);
    expect(sets.map((s) => [s.set, s.members])).toEqual([['jackAndJill', [1, 3, 4]]]);
    for (const uid of [1, 3, 4]) {
      expect(meetsCondition(C, layout, { inSet: 'jackAndJill' }, uid)).toBe(true);
    }
    expect(meetsCondition(C, layout, { inSet: 'jackAndJill' }, 2)).toBe(false);
    expect(meetsCondition(C, layout, { inSet: 'entertainer' }, 1)).toBe(false);
    // The Bathroom touches two Bedrooms, through the link.
    expect(matchesPiece(C, layout, { touching: { piece: 'bedroom' }, min: 2 }, 4)).toBe(true);
    expect(matchesPiece(C, layout, { touching: { piece: 'bedroom' }, min: 3 }, 4)).toBe(false);

    // Closets (rooms, not connectors) in the Hallway's place link nothing.
    const closets = layoutOf(emptyRows(10, 6), [
      ['bedroom', 0, 0],
      ['closet', 2, 0],
      ['closet', 3, 0],
      ['closet', 4, 0],
      ['bedroom', 5, 0],
      ['bathroom', 3, 1],
    ]);
    expect(closets.links.size).toBe(0);
    expect(matchSets(C, closets)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------

describe('selectors and conditions on layout properties', () => {
  // An interior Closet, an exterior Bathroom, a Hallway, a Lawn in the front yard, and a
  // Flower Bed in the back yard.
  //   y4  ..HH....
  //   y5  ..bCb.f.
  //   y6  ..LLL...
  //   y7  ........
  //   y8  ww......
  //   y9  ww......
  const layout = layoutOf(emptyRows(8, 10), [
    ['closet', 3, 5], // 1
    ['hallway', 2, 4], // 2
    ['bathroom', 2, 5], // 3
    ['bathroom', 4, 5], // 4
    ['longHallway', 2, 6], // 5
    ['lawn', 0, 8], // 6
    ['flowerBed', 6, 5], // 7
  ]);

  it('{property: room | exterior | interior}', () => {
    const room: Selector = { property: 'room' };
    expect([1, 2, 3, 4, 5, 6, 7].filter((u) => matchesPiece(C, layout, room, u))).toEqual([
      1, 3, 4,
    ]);
    const ext: Selector = { property: 'exterior' };
    expect([1, 2, 3, 4, 5, 6, 7].filter((u) => matchesPiece(C, layout, ext, u))).toEqual([3, 4]);
    const int: Selector = { property: 'interior' };
    expect([1, 2, 3, 4, 5, 6, 7].filter((u) => matchesPiece(C, layout, int, u))).toEqual([1]);
    // Lot features are never rooms, exterior, or interior.
    const tree = { kind: 'terrain', feature: 'tree', x: 0, y: 0 } as const;
    expect(matchesNeighbor(C, layout, room, tree)).toBe(false);
    expect(matchesNeighbor(C, layout, int, { kind: 'street', x: 0 })).toBe(false);
  });

  it('{in: region}', () => {
    expect(matchesPiece(C, layout, { in: 'frontYard' }, 6)).toBe(true);
    expect(matchesPiece(C, layout, { in: 'backYard' }, 7)).toBe(true);
    expect(matchesPiece(C, layout, { in: 'backYard' }, 6)).toBe(false);
    expect(matchesPiece(C, layout, { in: 'frontYard' }, 1)).toBe(false); // indoor
    expect(matchesPiece(C, layout, { in: 'fencedYard' }, 6)).toBe(false);
    expect(matchesPiece(C, layout, { in: 'sunny' }, 1)).toBe(false);
    // A feature is never in a region, for selectors.
    const tree = { kind: 'terrain', feature: 'tree', x: 0, y: 0 } as const;
    expect(matchesNeighbor(C, layout, { in: 'sunny' }, tree)).toBe(false);
  });

  it('{touching: selector, min}', () => {
    // The Closet's scoring neighbors are the two Bathrooms (the Hallways aren't neighbors, and
    // link nothing else).
    expect(pieceUids(layout, 1, 'neighbors')).toEqual([3, 4]);
    expect(matchesPiece(C, layout, { touching: { tag: 'Wet' } }, 1)).toBe(true);
    expect(matchesPiece(C, layout, { touching: { tag: 'Wet' }, min: 2 }, 1)).toBe(true);
    expect(matchesPiece(C, layout, { touching: { tag: 'Wet' }, min: 3 }, 1)).toBe(false);
    // A Bathroom touches the interior Closet (and, linked, the other Bathroom).
    expect(matchesPiece(C, layout, { touching: { property: 'interior' } }, 3)).toBe(true);
    expect(matchesPiece(C, layout, { touching: { tag: 'Dark' } }, 4)).toBe(true);
    expect(matchesPiece(C, layout, { touching: { piece: 'hallway' } }, 3)).toBe(false);
    expect(countTouching(C, layout, 3, { property: 'room' })).toBe(2);
    // Nested inside all/not.
    const darkNeighbor: Selector = { all: [{ property: 'room' }, { touching: { tag: 'Dark' } }] };
    expect(matchesPiece(C, layout, darkNeighbor, 3)).toBe(true);
    expect(matchesPiece(C, layout, darkNeighbor, 1)).toBe(false);
    expect(matchesPiece(C, layout, { not: darkNeighbor }, 1)).toBe(true);
    // A feature never touches anything, for selectors.
    expect(matchesNeighbor(C, layout, { touching: 'all' }, { kind: 'street', x: 0 })).toBe(false);
  });

  it('meetsCondition: touching, in, is, and, or, not', () => {
    const touchingWet: PieceCondition = { touching: { tag: 'Wet' }, min: 2 };
    expect(meetsCondition(C, layout, touchingWet, 1)).toBe(true);
    expect(meetsCondition(C, layout, { touching: { tag: 'Wet' }, min: 3 }, 1)).toBe(false);
    expect(meetsCondition(C, layout, { touching: { piece: 'closet' } }, 3)).toBe(true);
    expect(meetsCondition(C, layout, { in: 'frontYard' }, 6)).toBe(true);
    expect(meetsCondition(C, layout, { in: 'frontYard' }, 7)).toBe(false);
    expect(meetsCondition(C, layout, { is: { property: 'interior' } }, 1)).toBe(true);
    expect(meetsCondition(C, layout, { is: { property: 'interior' } }, 3)).toBe(false);
    expect(meetsCondition(C, layout, { is: { tag: 'Dark' } }, 1)).toBe(true);

    const darkAndWet: PieceCondition = { and: [{ is: { tag: 'Dark' } }, touchingWet] };
    expect(meetsCondition(C, layout, darkAndWet, 1)).toBe(true);
    expect(meetsCondition(C, layout, darkAndWet, 3)).toBe(false);
    const frontOrDark: PieceCondition = { or: [{ in: 'frontYard' }, { is: { tag: 'Dark' } }] };
    expect([1, 3, 6, 7].filter((u) => meetsCondition(C, layout, frontOrDark, u))).toEqual([1, 6]);
    expect(meetsCondition(C, layout, { not: { in: 'frontYard' } }, 7)).toBe(true);
    expect(meetsCondition(C, layout, { not: frontOrDark }, 6)).toBe(false);
    expect(meetsCondition(C, layout, { and: [] }, 1)).toBe(true);
    expect(meetsCondition(C, layout, { or: [] }, 1)).toBe(false);
  });

  it('meetsCondition: borders and inSet are false with no fenced yard or set', () => {
    expect(layout.fencedSizes).toEqual([]);
    expect(meetsCondition(C, layout, { borders: 'fencedYard' }, 3)).toBe(false);
    expect(meetsCondition(C, layout, { inSet: 'jackAndJill' }, 3)).toBe(false);
  });

  it('pieceIn and tilesIn are empty for an unknown piece', () => {
    expect(tilesIn(layout, 99, 'frontYard')).toBe(0);
    expect(pieceIn(layout, 99, 'frontYard')).toBe(false);
    expect(matchesPiece(C, layout, 'all', 99)).toBe(false);
  });
});
