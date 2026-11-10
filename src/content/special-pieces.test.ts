// One test per special piece (Appendix B · Special pieces; D-051, D-082), against the real
// content: what each one earns on a small hand-built lot, its budget, its shape and tags, its
// generated card text, and that it's shop only (weight 0, at the shop's piece price). Numbers
// here follow pieces.ts; when tuning changes a number, change the test with it.

import { describe, expect, it } from 'vitest';
import type { Category, HouseState, PieceId, Tag, Tally } from '../rules/index.ts';
import { drawWeights } from '../rules/draw.ts';
import { bounds, shapeCells, uniqueRotations } from '../rules/grid.ts';
import { computeLayout } from '../rules/layout.ts';
import { tallyHouse } from '../rules/scoring.ts';
import { listPrice } from '../rules/shop.ts';
import { cardText } from '../rules/text.ts';
import { emptyRows, houseFrom, type Placement } from '../rules/testing.ts';
import { CONTENT } from './index.ts';

const SPECIAL = [
  'playroom',
  'library',
  'mudroom',
  'pool',
  'hotTub',
  'firePit',
  'henhouse',
  'birdhouse',
] as const satisfies readonly PieceId[];

/** The tally of a house in `week`. */
function tallyOf(house: HouseState, week = 1): Tally {
  return tallyHouse(CONTENT, computeLayout(CONTENT, house), week, true);
}

/** The house's tally in `week` (every piece is placed in week 1, so week 3 is age 2). */
function tally(rows: readonly string[], placements: readonly Placement[], week = 1): Tally {
  return tallyOf(houseFrom(CONTENT, rows, placements), week);
}

/** What each piece earns, in placement order. */
function earned(rows: readonly string[], placements: readonly Placement[], week = 1): number[] {
  return tally(rows, placements, week).pieces.map((p) => p.earned);
}

/** The same house with every piece placed in `week` instead. */
function placedIn(house: HouseState, week: number): HouseState {
  return { ...house, pieces: house.pieces.map((p) => ({ ...p, placedWeek: week })) };
}

/** The first piece's earnings in each of `weeks`. */
function earnedOver(house: HouseState, weeks: readonly number[]): number[] {
  return weeks.map((w) => tallyOf(house, w).pieces[0]!.earned);
}

/** The shape's bounding box (width × height in rotation 0) and its distinct rotations. */
function shapeOf(id: PieceId) {
  const cells = shapeCells(CONTENT.pieces[id].shape, 0);
  return {
    ...bounds(cells),
    tiles: cells.length,
    rotations: uniqueRotations(CONTENT.pieces[id].shape).length,
  };
}

/** Appendix B's category and tags for the piece, and its card text reads cleanly. */
function expectCard(
  id: PieceId,
  category: Category,
  tags: readonly Tag[],
  effects: readonly string[],
): void {
  const def = CONTENT.pieces[id];
  expect(def.category).toBe(category);
  expect([...def.tags].sort()).toEqual([...tags].sort());
  expect(def.drawWeight).toBe(0);
  const text = cardText(CONTENT, def);
  expect(text.effects).toHaveLength(def.effects.length);
  for (const line of [...text.effects, ...text.notes]) {
    expect(line.trim()).not.toBe('');
    expect(line).not.toMatch(/undefined|NaN|null|\[object|  /);
  }
  expect(text.effects).toEqual(effects);
}

const open = emptyRows(10, 10);

describe('special pieces', () => {
  it('are the 8 weight-0 pieces: never in the weekly draw, all in the shop and the Catalog', () => {
    // Member rooms (M4b) are weight 0 too, but arrive with the household (households.test.ts).
    // The Sunroom left them for the weekly draw (D-120).
    const weightless = (Object.keys(CONTENT.pieces) as PieceId[]).filter(
      (id) => CONTENT.pieces[id].drawWeight === 0 && !CONTENT.pieces[id].member,
    );
    expect(weightless.sort()).toEqual([...SPECIAL].sort());
    for (let phase = 0; phase < CONTENT.balance.phases.length; phase++) {
      const drawn = drawWeights(CONTENT, phase).map((w) => w.card.id);
      for (const id of SPECIAL) expect(drawn).not.toContain(id);
      // The Catalog (M3b) draws them at equal weight.
      const catalog = drawWeights(CONTENT, phase, { special: true }).filter(
        (w) => w.card.kind === 'piece',
      );
      expect(catalog.map((w) => w.card.id).sort()).toEqual([...SPECIAL].sort());
    }
  });

  it('cost the shop’s piece price, 3 (Appendix A · M3a)', () => {
    expect(CONTENT.balance.shop.piecePrice).toBe(3);
    for (const id of SPECIAL) expect(listPrice(CONTENT, { kind: 'piece', id })).toBe(3);
  });

  it('have D-082’s shapes where Appendix B leaves them open, and its sizes elsewhere', () => {
    expect(shapeOf('playroom')).toMatchObject({ w: 2, h: 2, tiles: 4 });
    expect(shapeOf('library')).toMatchObject({ w: 2, h: 2, tiles: 4 });
    expect(shapeOf('mudroom')).toMatchObject({ w: 2, h: 1, tiles: 2, rotations: 2 });
    expect(shapeOf('pool')).toMatchObject({ w: 3, h: 2, tiles: 6, rotations: 2 });
    expect(shapeOf('sunroom')).toMatchObject({ w: 2, h: 2, tiles: 4 });
    expect(shapeOf('hotTub')).toMatchObject({ w: 1, h: 1, tiles: 1 });
    expect(shapeOf('firePit')).toMatchObject({ w: 1, h: 1, tiles: 1 });
    expect(shapeOf('henhouse')).toMatchObject({ w: 2, h: 1, tiles: 2, rotations: 2 });
    expect(shapeOf('birdhouse')).toMatchObject({ w: 1, h: 1, tiles: 1 });
  });
});

describe('Playroom', () => {
  it('+2 per touching Bedroom, and the Bedrooms lose 2 for the noise on top of its Loud tag', () => {
    expectCard(
      'playroom',
      'indoor',
      ['Loud', 'Kid'],
      ['+2 per touching Bedroom', 'Touching Quiet neighbors get −2'],
    );
    expect(earned(open, [['playroom', 0, 0]])).toEqual([0]);
    // Between two Bedrooms: 2 + 2. Each Bedroom is 3, −2 for a Loud neighbor, and −2 from the
    // aura: −1, which floors at 0.
    const t = tally(open, [
      ['playroom', 2, 0],
      ['bedroom', 0, 0],
      ['bedroom', 4, 0],
    ]);
    expect(t.pieces.map((p) => p.earned)).toEqual([4, 0, 0]);
    expect(t.pieces.map((p) => p.points)).toEqual([4, -1, -1]);
  });

  it('its aura is a flat −2 on Quiet pieces only, and it’s a Kid neighbor', () => {
    // A Library with three Quiet Bedrooms: 2 × 3, −2 from the Playroom above it. The Bedrooms
    // (+1 for the Library) don't touch the Playroom; the Closet does, but has no tags.
    const t = tally(open, [
      ['library', 2, 2],
      ['bedroom', 0, 2],
      ['bedroom', 4, 2],
      ['bedroom', 2, 4],
      ['playroom', 2, 0],
      ['closet', 4, 0],
    ]);
    expect(t.pieces.map((p) => p.earned)).toEqual([4, 4, 4, 4, 0, 1]);
    expect(t.pieces[0]!.lines).toContainEqual({
      label: 'Playroom next door',
      op: 'add',
      value: -2,
      from: [{ kind: 'piece', uid: 5 }],
    });
    // A Treehouse by a Tree gets its +2 per Kid neighbor: 2 + 2.
    expect(
      earned(
        ['T.........', ...emptyRows(10, 9)],
        [
          ['treehouse', 1, 0],
          ['playroom', 3, 0],
        ],
      ),
    ).toEqual([4, 0]);
  });
});

describe('Library', () => {
  it('+2 per touching Quiet neighbor (up to 3), Trees included', () => {
    expectCard('library', 'indoor', ['Quiet'], ['+2 per touching Quiet neighbor (up to 3)']);
    expect(earned(open, [['library', 0, 0]])).toEqual([0]);
    // Next to a Bedroom: 2, and the Bedroom gets +1 for a Quiet neighbor.
    expect(
      earned(open, [
        ['library', 0, 0],
        ['bedroom', 2, 0],
      ]),
    ).toEqual([2, 4]);
    // Four Trees touch it (Trees are Quiet); three count: 6.
    const rows = ['.TT...', 'T.....', 'T.....', ...emptyRows(6, 3)];
    const t = tally(rows, [['library', 1, 1]]);
    expect(t.pieces[0]!.earned).toBe(6);
    expect(t.pieces[0]!.lines[0]!.label).toBe('Touching 4 Trees (3 count)');
  });
});

describe('Mudroom', () => {
  // pieces.test.ts's Doghouse yard: two Bedrooms down the left side, a Fence across row 4, and
  // the lot's top and right edges close a 16-tile yard holding a Doghouse and a Lawn.
  const rows = emptyRows(6, 8);
  const yard: Placement[] = [
    ['bedroom', 0, 0],
    ['bedroom', 0, 2],
    ['fence', 2, 4],
    ['doghouse', 2, 0],
    ['lawn', 3, 0],
  ];

  it('bordering a fenced yard, the Pet pieces in it earn +50%', () => {
    expectCard(
      'mudroom',
      'indoor',
      ['Pet'],
      ['Pet pieces in the fenced yard it borders earn +50%'],
    );
    // Upright against the lower Bedroom, inside the yard: 16 − 2 = 14 tiles. The Doghouse is
    // 1 + 1 for the Lawn, at +50%: 3. A second Doghouse in the far corner: 1 at +50% is 1.5,
    // which rounds up to 2. The Lawn isn't a Pet; the Fence still earns its 6.
    const placements: Placement[] = [...yard, ['mudroom', 2, 2, 1], ['doghouse', 5, 3]];
    const house = houseFrom(CONTENT, rows, placements);
    expect(computeLayout(CONTENT, house).fencedSizes).toEqual([14]);
    const t = tallyOf(house);
    expect(t.pieces.map((p) => p.earned)).toEqual([4, 4, 6, 3, 1, 0, 2]);
    expect(t.pieces[3]!.lines).toContainEqual({
      label: 'Mudroom next door',
      op: 'pct',
      value: 50,
      from: [{ kind: 'piece', uid: 6 }],
    });
  });

  it('outside the yard, below the Fence, it does nothing', () => {
    // Below the lower Bedroom it touches only the Fence's end and the open ground: the yard
    // stays 16 tiles and the Doghouses earn their plain 2 and 1.
    const placements: Placement[] = [...yard, ['mudroom', 0, 4], ['doghouse', 5, 3]];
    const house = houseFrom(CONTENT, rows, placements);
    expect(computeLayout(CONTENT, house).fencedSizes).toEqual([16]);
    expect(tallyOf(house).pieces.map((p) => p.earned)).toEqual([4, 4, 6, 2, 1, 0, 1]);
  });
});

describe('Pool', () => {
  it('+12 every 3rd week of its life (its build week is the first)', () => {
    expectCard(
      'pool',
      'yard',
      ['Wet', 'Sunny', 'Loud'],
      ['+12 every 3rd week', '−2 per touching Tree (up to 3)'],
    );
    const house = houseFrom(CONTENT, emptyRows(8, 8), [['pool', 2, 2]]);
    expect(earnedOver(house, [1, 2, 3, 4, 5, 6])).toEqual([0, 0, 12, 0, 0, 12]);
    expect(tallyOf(house, 3).pieces[0]!.lines).toEqual([
      { label: 'Every 3rd week', op: 'add', value: 12, from: [] },
    ]);
    // Built in week 2, it pays in weeks 4 and 7.
    expect(earnedOver(placedIn(house, 2), [2, 3, 4, 5, 6, 7])).toEqual([0, 0, 12, 0, 0, 12]);
  });

  it('−2 per touching Tree (up to 3), and it’s Loud', () => {
    // Four Trees around it; three count: 12 − 6 in week 3, and −6 floors at 0 in week 1.
    const rows = ['.T...', 'T...T', 'T....', '.....', '.....'];
    const t1 = tally(rows, [['pool', 1, 1]], 1);
    expect(t1.pieces[0]).toMatchObject({ points: -6, earned: 0 });
    expect(tally(rows, [['pool', 1, 1]], 3).pieces[0]!.earned).toBe(6);
    // Two Trees: 12 − 4.
    expect(earned(['.T...', 'T....', ...emptyRows(5, 3)], [['pool', 1, 1]], 3)).toEqual([8]);
    // A Bedroom beside it loses 2 for a Loud neighbor.
    expect(
      earned(
        emptyRows(8, 8),
        [
          ['pool', 0, 0],
          ['bedroom', 3, 0],
        ],
        3,
      ),
    ).toEqual([12, 1]);
  });
});

describe('Sunroom', () => {
  it('+6 while Sunny, in the weekly draw from Foundation (D-120)', () => {
    const def = CONTENT.pieces.sunroom;
    expect(def).toMatchObject({ category: 'indoor', tags: [], drawWeight: 5, fromPhase: 1 });
    expect(cardText(CONTENT, def).effects).toEqual(['+6 every week while Sunny']);
    expect(drawWeights(CONTENT, 0).some((w) => w.card.id === 'sunroom')).toBe(false);
    expect(drawWeights(CONTENT, 1).some((w) => w.card.id === 'sunroom')).toBe(true);
    // A wall to the sun: +6.
    expect(earned(open, [['sunroom', 0, 0]])).toEqual([6]);
    // Right behind a Bedroom, away from the sun: in its shade, so not Sunny, and 0.
    const shade = houseFrom(CONTENT, open, [
      ['bedroom', 0, 0],
      ['sunroom', 0, 2],
    ]);
    expect(tallyOf(shade).pieces[1]!.earned).toBe(0);
    expect(computeLayout(CONTENT, shade).tags.get(2)!.has('Sunny')).toBe(false);
  });
});

describe('Hot Tub', () => {
  it('+3 per touching Patio, while it touches a room', () => {
    expectCard(
      'hotTub',
      'yard',
      ['Wet', 'Social'],
      ['Earns nothing unless touching a room', '+3 per touching Patio'],
    );
    expect(earned(open, [['hotTub', 0, 0]])).toEqual([0]);
    // Between two Patios, above a Closet that all three touch: 3 + 3. It's no view or Kitchen,
    // so the Patios get nothing.
    const patios: Placement[] = [
      ['patio', 0, 0],
      ['hotTub', 2, 0],
      ['patio', 3, 0],
    ];
    expect(earned(open, [...patios, ['closet', 2, 1]])).toEqual([0, 6, 0, 1]);
    // The Patio rule (D-105): with no room it earns nothing, and a Hallway isn't a room.
    expect(tally(open, patios).pieces[1]).toMatchObject({ earned: 0, unmet: 'touching a room' });
    expect(earned(open, [...patios, ['hallway', 2, 1, 1]])).toEqual([0, 0, 0, 0]);
  });
});

describe('Fire Pit', () => {
  it('touching Patios earn +50% while it touches a room; nothing else does', () => {
    expectCard(
      'firePit',
      'yard',
      ['Social'],
      ['Earns nothing unless touching a room', 'Touching Patios earn +50%'],
    );
    expect(earned(open, [['firePit', 0, 0]])).toEqual([0]);
    // The Patio: +2 for the Kitchen and +2 for the Living Room, at +50%: 6. The Hot Tub beside
    // the Fire Pit earns its plain 3. Each touches a room (the Fire Pit the Kitchen, the Hot
    // Tub the Living Room), as the Patio rule (D-105) asks.
    const house: Placement[] = [
      ['patio', 2, 0],
      ['kitchen', 0, 1],
      ['livingRoom', 4, 0],
      ['firePit', 2, 2],
      ['hotTub', 3, 2],
    ];
    expect(earned(open, house)).toEqual([6, 2, 2, 0, 3]); // the Kitchen and the Living Room in the sun
    // With the Kitchen a row up, the Fire Pit touches no room, so its aura doesn't apply and
    // the Patio earns its plain 4.
    const away = tally(open, [
      ['patio', 2, 0],
      ['kitchen', 0, 0],
      ['livingRoom', 4, 0],
      ['firePit', 2, 2],
      ['hotTub', 3, 2],
    ]);
    expect(away.pieces.map((p) => p.earned)).toEqual([4, 2, 2, 0, 3]);
    expect(away.pieces[3]!.unmet).toBe('touching a room');
    // Two Fire Pits, each touching the Kitchen too, add up: +2 at +100% is 4, shown as one
    // aura line.
    const t = tally(open, [
      ['patio', 2, 0],
      ['kitchen', 0, 1],
      ['firePit', 2, 2],
      ['firePit', 1, 0],
    ]);
    expect(t.pieces[0]!.earned).toBe(4);
    expect(t.pieces[0]!.lines).toContainEqual({
      label: '2 Fire Pits next door',
      op: 'pct',
      value: 100,
      from: [
        { kind: 'piece', uid: 3 },
        { kind: 'piece', uid: 4 },
      ],
    });
  });
});

describe('Henhouse', () => {
  it('1 budget every 2nd week, and +1 per touching Herb Garden or Flower Bed', () => {
    expectCard(
      'henhouse',
      'outbuilding',
      ['House'],
      ['+1 budget every 2nd week', '+1 per touching Herb Garden or Flower Bed'],
    );
    const alone = houseFrom(CONTENT, open, [['henhouse', 0, 0]]);
    expect([1, 2, 3, 4].map((w) => tallyOf(alone, w).pieces[0]!.budget)).toEqual([0, 1, 0, 1]);
    expect(tallyOf(alone, 2)).toMatchObject({ budget: 1, total: 0 });
    // A Flower Bed (1, +2 in the front yard) and an Herb Garden beside it: 1 + 1. The Herb
    // Garden is in the Henhouse's shade (D-120), so it earns nothing itself.
    expect(
      earned(open, [
        ['henhouse', 2, 0],
        ['flowerBed', 1, 0],
        ['herbGarden', 2, 1],
      ]),
    ).toEqual([2, 3, 0]);
  });
});

describe('Birdhouse', () => {
  it('+1 per touching Tree (up to 3)', () => {
    expectCard('birdhouse', 'outbuilding', ['House'], ['+1 per touching Tree (up to 3)']);
    expect(earned(emptyRows(3, 3), [['birdhouse', 1, 1]])).toEqual([0]);
    expect(earned(['T..', '...', '...'], [['birdhouse', 1, 0]])).toEqual([1]);
    // Four Trees around it; three count.
    expect(earned(['.T.', 'T.T', '.T.'], [['birdhouse', 1, 1]])).toEqual([3]);
  });
});
