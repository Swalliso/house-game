// One test per base-pool card (Appendix B of implementation-plan.md), against the real content:
// what each card earns on a small hand-built lot, its budget, its placement rule, its transform,
// and its shape, plus its generated card text and its complexity (Appendix A · M1, D-055).
// Numbers here follow pieces.ts; when tuning changes a number, change the test with it.

import { describe, expect, it } from 'vitest';
import type { PieceId, Rot, RunState, Tally } from '../rules/index.ts';
import { cardText, createRules } from '../rules/index.ts';
import { bounds, cellIndex, shapeCells, uniqueRotations } from '../rules/grid.ts';
import { computeLayout, layoutCache } from '../rules/layout.ts';
import { lotFromRows } from '../rules/lot.ts';
import { checkPlacement } from '../rules/placement.ts';
import { tallyHouse } from '../rules/scoring.ts';
import { emptyRows, houseFrom, type Placement } from '../rules/testing.ts';
import { CONTENT } from './index.ts';

const layoutOf = layoutCache(CONTENT);

/** The house's tally in `week` (every piece is placed in week 1, so week 3 is age 2). */
function tally(rows: readonly string[], placements: readonly Placement[], week = 1): Tally {
  const layout = computeLayout(CONTENT, houseFrom(CONTENT, rows, placements));
  return tallyHouse(CONTENT, layout, week, true);
}

/** What each piece earns, in placement order. */
function earned(rows: readonly string[], placements: readonly Placement[], week = 1): number[] {
  return tally(rows, placements, week).pieces.map((p) => p.earned);
}

/** The budget the first piece pays in each of weeks 1..n. */
function budgets(rows: readonly string[], placements: readonly Placement[], n: number): number[] {
  return Array.from({ length: n }, (_, i) => tally(rows, placements, i + 1).pieces[0]!.budget);
}

/** The sizes of the fenced yards. */
function fencedSizes(rows: readonly string[], placements: readonly Placement[]): number[] {
  return [...computeLayout(CONTENT, houseFrom(CONTENT, rows, placements)).fencedSizes];
}

/** Can `id` be built at (x, y) on this house? A pack (D-106) can be given its own tiles. */
function check(
  rows: readonly string[],
  placements: readonly Placement[],
  id: PieceId,
  x: number,
  y: number,
  rot: Rot = 0,
  shape?: readonly string[],
) {
  const house = houseFrom(CONTENT, rows, placements);
  const def = CONTENT.pieces[id];
  return checkPlacement(CONTENT, layoutOf(house), def, x, y, rot, 1, layoutOf, shape ?? def.shape);
}

const R = createRules(CONTENT);
const START = R.newRun({
  seed: 'pieces',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
});

/** The rules' own check of a pack card's play (D-106): these tiles at (x, y), from the hand. */
function checkPack(rows: readonly string[], id: PieceId, x: number, y: number, shape: string[]) {
  const s: RunState = {
    ...START,
    house: houseFrom(CONTENT, rows),
    hand: [{ kind: 'piece', id }],
  };
  return R.checkPlay(s, { t: 'place', from: 'hand', i: 0, x, y, rot: 0, shape });
}

/** The shape as "x,y" cells in rotation 0, with its bounding box and distinct rotations. */
function shapeOf(id: PieceId) {
  const cells = shapeCells(CONTENT.pieces[id].shape, 0);
  return {
    cells: cells.map((c) => `${c.x},${c.y}`),
    ...bounds(cells),
    rotations: uniqueRotations(CONTENT.pieces[id].shape).length,
  };
}

/** Appendix A · M1's complexity list (D-055). Shape variants share their type's complexity. */
const COMPLEXITY: Record<PieceId, 1 | 2 | 3> = {
  bedroom: 1,
  bathroom: 1,
  kitchen: 1,
  lKitchen: 1,
  diningRoom: 1,
  livingRoom: 1,
  closet: 1,
  lawn: 1,
  patio: 1,
  flowerBed: 2,
  herbGarden: 2,
  sapling: 2,
  driveway: 2,
  garage: 2,
  homeOffice: 2,
  treehouse: 2,
  fence: 3,
  hallway: 3,
  longHallway: 3,
  doghouse: 3,
  greenhouse: 3,
  // Special pieces (weight 0: shop only).
  playroom: 2,
  library: 1,
  mudroom: 3,
  pool: 2,
  sunroom: 2,
  hotTub: 1,
  firePit: 2,
  henhouse: 2,
  birdhouse: 1,
  // Member rooms (M4b): never drawn, so only Appendix A's labels: the Nursery's timer is a 2.
  // Their tests are in households.test.ts.
  nursery: 2,
  kidsRoom: 1,
  grandmasRoom: 1,
  renfieldsRoom: 1,
  nanasRoom: 1,
  rowansStudio: 1,
  ivysRoom: 1,
};

/** The card's complexity matches Appendix A, and its text reads cleanly. */
function expectCard(id: PieceId, effects?: readonly string[]): void {
  const def = CONTENT.pieces[id];
  expect(def.complexity).toBe(COMPLEXITY[id]);
  if (def.countsAs) expect(def.complexity).toBe(CONTENT.pieces[def.countsAs].complexity);
  const text = cardText(CONTENT, def);
  expect(text.effects).toHaveLength(def.effects.length);
  for (const line of [...text.effects, ...text.notes]) {
    expect(line.trim()).not.toBe('');
    expect(line).not.toMatch(/undefined|NaN|null|\[object|  /);
  }
  if (effects) expect(text.effects).toEqual(effects);
}

const open = emptyRows(10, 10);

describe('the base pool', () => {
  it('has a test below for every card, each with its Appendix A complexity', () => {
    expect(Object.keys(COMPLEXITY).sort()).toEqual(Object.keys(CONTENT.pieces).sort());
    // The base pool is the drawable cards; special pieces (weight 0) come from the shop. The
    // Sunroom left them for the draw at half weight (D-120).
    const base = Object.values(CONTENT.pieces).filter((d) => d.drawWeight > 0);
    expect(base).toHaveLength(22);
    // The two packs (D-106) took the weight of the two cards each one replaced, 20, until the
    // draw's two rows (D-121): in a two-card Layout row they draw at 10, like every card. The
    // Sunroom, in the Rooms row, draws at half that (D-120).
    expect(base.filter((d) => d.pack).map((d) => d.id)).toEqual(['fence', 'driveway']);
    for (const def of base) expect(def.drawWeight, def.id).toBe(def.id === 'sunroom' ? 5 : 10);
    for (const def of Object.values(CONTENT.pieces)) {
      expect(def.complexity).toBe(COMPLEXITY[def.id]);
    }
  });
});

describe('indoor rooms', () => {
  it('Bedroom: 3, +1 per Tree or Quiet neighbor (up to 3), −2 per Loud neighbor', () => {
    expectCard('bedroom', [
      '+3 every week',
      '+1 per touching Tree or Quiet neighbor (up to 3)',
      '−2 per touching Loud neighbor',
    ]);
    expect(earned(open, [['bedroom', 0, 0]])).toEqual([3]);
    // A Tree and a Bedroom both count; a Home Office is Quiet too.
    expect(
      earned(
        ['T.......', '........', '........', '........'],
        [
          ['bedroom', 1, 0],
          ['bedroom', 3, 0],
          ['homeOffice', 5, 0],
        ],
      ),
    ).toEqual([3 + 2, 3 + 2, 2]);
    // Four Trees touch it, and only three count.
    expect(earned(['TTT...', 'T.....', 'T.....', '......'], [['bedroom', 1, 1]])).toEqual([3 + 3]);
    // The street and a Garage are both Loud: 3 − 2 − 2 floors at 0.
    const t = tally(emptyRows(6, 6), [
      ['bedroom', 0, 4],
      ['garage', 2, 4],
    ]);
    expect(t.pieces[0]).toMatchObject({ points: -1, earned: 0 });
    expect(t.pieces[1]!.earned).toBe(5);
  });

  it('Bathroom: +3 next to a Bedroom (once), −2 per Kitchen, L-Kitchens included', () => {
    expectCard('bathroom', ['+3 if touching a Bedroom', '−2 per touching Kitchen']);
    expect(earned(open, [['bathroom', 0, 0]])).toEqual([0]);
    // Between two Bedrooms it still earns +3 once.
    expect(
      earned(open, [
        ['bedroom', 0, 0],
        ['bathroom', 2, 0],
        ['bedroom', 3, 0],
      ]),
    ).toEqual([3, 3, 3]);
    expect(
      earned(open, [
        ['bedroom', 0, 0],
        ['bathroom', 2, 0],
        ['lKitchen', 3, 0],
      ]),
    ).toEqual([3, 1, 2]); // the L-Kitchen faces the sun: +2 while Sunny (D-120)
    // A Kitchen alone pulls it below zero, which floors at 0.
    const t = tally(open, [
      ['bathroom', 0, 0],
      ['kitchen', 1, 0],
    ]);
    expect(t.pieces[0]).toMatchObject({ points: -2, earned: 0 });
  });

  it('Kitchen: +2 per Dining Room or Herb Garden, and both boost it', () => {
    expectCard('kitchen', [
      '+2 per touching Dining Room or Herb Garden',
      '+2 every week while Sunny',
    ]);
    expect(shapeOf('kitchen')).toMatchObject({ w: 2, h: 2, rotations: 1 });
    // On the lot's back edge its wall faces the sun (D-120): +2.
    expect(earned(open, [['kitchen', 0, 0]])).toEqual([2]);
    // +2, and +2 in the sun, then the Dining Room's +50%: 6. The Dining Room is in the sun too.
    expect(
      earned(open, [
        ['kitchen', 0, 0],
        ['diningRoom', 2, 0],
      ]),
    ).toEqual([6, 2]);
    // +2 and +2, then the Herb Garden's +25%: 5. The Herb Garden is in the Kitchen's shade.
    expect(
      earned(open, [
        ['kitchen', 0, 0],
        ['herbGarden', 0, 2],
      ]),
    ).toEqual([5, 0]);
    // Both: +6 at +75% is 10.5, so 11.
    expect(
      earned(open, [
        ['kitchen', 0, 0],
        ['diningRoom', 2, 0],
        ['herbGarden', 0, 2],
      ]),
    ).toEqual([11, 2, 0]);
  });

  it('L-Kitchen: the 3-tile L, counted as a Kitchen, earning the same', () => {
    expectCard('lKitchen', [
      '+2 per touching Dining Room or Herb Garden',
      '+2 every week while Sunny',
    ]);
    const def = CONTENT.pieces.lKitchen;
    expect(def.countsAs).toBe('kitchen');
    expect(def.effects).toEqual(CONTENT.pieces.kitchen.effects);
    expect(shapeOf('lKitchen')).toEqual({
      cells: ['0,0', '0,1', '1,1'],
      w: 2,
      h: 2,
      rotations: 4,
    });
    // The Dining Room's aura reaches it as a Kitchen. Both face the sun.
    expect(
      earned(open, [
        ['lKitchen', 0, 0],
        ['diningRoom', 2, 0],
      ]),
    ).toEqual([6, 2]);
    expect(
      earned(open, [
        ['lKitchen', 0, 0],
        ['diningRoom', 2, 0],
        ['herbGarden', 0, 2],
      ]),
    ).toEqual([11, 2, 0]);
  });

  it('Dining Room: Kitchens and Living Rooms next to it earn +50%, and two add up', () => {
    expectCard('diningRoom', [
      'Touching Kitchens and Living Rooms earn +50%',
      '+2 every week while Sunny',
    ]);
    expect(earned(open, [['diningRoom', 0, 0]])).toEqual([2]);
    // A Living Room with a view (+2 from the Flower Bed) and the sun (+2) earns 6; the Dining
    // Room below it is in its shade (D-120), and the Bedroom isn't boosted.
    expect(
      earned(open, [
        ['livingRoom', 0, 0],
        ['flowerBed', 2, 0],
        ['diningRoom', 0, 3],
        ['bedroom', 2, 3],
      ]),
    ).toEqual([6, 1, 0, 3]);
    // Two Dining Rooms: +6 at +100% is 12, shown as one aura line. All three are in the sun.
    const t = tally(open, [
      ['kitchen', 2, 0],
      ['diningRoom', 0, 0],
      ['diningRoom', 4, 0],
    ]);
    expect(t.pieces.map((p) => p.earned)).toEqual([12, 2, 2]);
    expect(t.pieces[0]!.lines).toContainEqual({
      label: '2 Dining Rooms next door',
      op: 'pct',
      value: 100,
      from: [
        { kind: 'piece', uid: 2 },
        { kind: 'piece', uid: 3 },
      ],
    });
  });

  it('Living Room: +2 per view (up to 3); the pond counts once', () => {
    expectCard('livingRoom', ['+2 per touching view (up to 3)', '+2 every week while Sunny']);
    expect(shapeOf('livingRoom')).toMatchObject({ w: 2, h: 3, rotations: 2 });
    // In the sun (D-120): +2.
    expect(earned(open, [['livingRoom', 0, 0]])).toEqual([2]);
    // Two pond tiles are one view. Water casts no shade, so it's in the sun too.
    expect(earned(['PPP...', ...emptyRows(6, 5)], [['livingRoom', 0, 1]])).toEqual([4]);
    // The pond, a Tree, the creek, and a Flower Bed: four views, three count, and the sun.
    const rows = ['.PP...', 'T..C..', '...C..', '...C..', '......', '......'];
    const t = tally(rows, [
      ['livingRoom', 1, 1],
      ['flowerBed', 1, 4],
    ]);
    expect(t.pieces.map((p) => p.earned)).toEqual([8, 3]);
    const line = t.pieces[0]!.lines[0]!;
    expect(line.value).toBe(6);
    expect(line.from).toHaveLength(3);
    expect(line.label).toBe('Touching a Flower Bed, the Pond, a Tree, and the Creek (3 count)');
  });

  it('Closet: a steady 1', () => {
    expectCard('closet', ['+1 every week']);
    expect(shapeOf('closet')).toMatchObject({ w: 1, h: 1 });
    expect(earned(open, [['closet', 0, 0]])).toEqual([1]);
    // It has no tags, so it gives a Bedroom nothing.
    expect(
      earned(open, [
        ['bedroom', 0, 0],
        ['closet', 2, 0],
      ]),
    ).toEqual([3, 1]);
  });

  it('Hallway: a 1×2 connector that links every room touching it, and is no neighbor', () => {
    expectCard('hallway', [
      'Links the rooms it touches: they count as touching each other',
      '+2 per touching room (up to 4)',
    ]);
    expect(shapeOf('hallway')).toEqual({ cells: ['0,0', '1,0'], w: 2, h: 1, rotations: 2 });
    expect(CONTENT.pieces.hallway.connector).toBe(true);
    // The Bathroom touches the Hallway's side, not its end, and is still linked to the Bedroom.
    const house = houseFrom(CONTENT, open, [
      ['bedroom', 0, 0],
      ['hallway', 2, 0],
      ['bathroom', 3, 1],
    ]);
    const layout = computeLayout(CONTENT, house);
    expect(tallyHouse(CONTENT, layout, 1, false).pieces.map((p) => p.earned)).toEqual([3, 4, 3]);
    expect(layout.touching.get(1)!.map((n) => n.kind === 'piece' && n.uid)).toEqual([2]);
    expect(layout.neighbors.get(1)).toEqual([{ kind: 'piece', uid: 3 }]);
    // Upright works too.
    expect(
      earned(open, [
        ['bedroom', 0, 0],
        ['hallway', 0, 2, 1],
        ['bathroom', 0, 4],
      ]),
    ).toEqual([3, 4, 3]);
    // It's indoor, so it must join the house.
    expect(check(open, [['bedroom', 0, 0]], 'hallway', 6, 6)).toMatchObject({
      legal: false,
      reason: 'Rooms must connect to the house.',
    });
    expect(check(open, [['bedroom', 0, 0]], 'hallway', 2, 0).legal).toBe(true);
  });

  it('Long Hallway: a 1×3 Hallway; a connected group of Hallways links as one', () => {
    expectCard('longHallway', [
      'Links the rooms it touches: they count as touching each other',
      '+2 per touching room (up to 4)',
    ]);
    const def = CONTENT.pieces.longHallway;
    expect(def.countsAs).toBe('hallway');
    expect(def.connector).toBe(true);
    expect(shapeOf('longHallway')).toEqual({
      cells: ['0,0', '1,0', '2,0'],
      w: 3,
      h: 1,
      rotations: 2,
    });
    expect(
      earned(open, [
        ['kitchen', 0, 0],
        ['longHallway', 2, 0],
        ['diningRoom', 5, 0],
      ]),
    ).toEqual([6, 4, 2]); // the Kitchen and the Dining Room in the sun: +2 each (D-120)
    // The Kitchen touches only the Long Hallway and the Dining Room only the short one. Each
    // hall pays for the rooms it touches itself; the other hall isn't a room.
    expect(
      earned(open, [
        ['kitchen', 0, 0],
        ['longHallway', 2, 0],
        ['hallway', 4, 1, 1],
        ['diningRoom', 5, 1],
      ]),
    ).toEqual([6, 2, 2, 2]);
  });

  it('Hallways pay +2 for each room they touch, up to 4 (D-114)', () => {
    const hall: Placement = ['longHallway', 1, 1];
    const closets = (...cells: [number, number][]) =>
      cells.map(([x, y]): Placement => ['closet', x, y]);
    // Three Closets along it: +6. Five: capped at four rooms, +8.
    expect(earned(open, [hall, ...closets([1, 0], [2, 0], [3, 0])])[0]).toBe(6);
    expect(earned(open, [hall, ...closets([1, 0], [2, 0], [3, 0], [1, 2], [2, 2])])[0]).toBe(8);
    // A room counts once however many tiles it touches, and a Hallway on its end isn't a room.
    const e = earned(open, [hall, ['bedroom', 1, 2], ['hallway', 4, 1]]);
    expect([e[0], e[2]]).toEqual([2, 0]);
  });

  it('Garage: built like any room; 5 and +1 budget every 2nd week once the street or a Driveway reaches it (D-140)', () => {
    expectCard('garage', [
      'Earns nothing unless touching the street or a Driveway',
      '+5 every week',
      '+1 budget every 2nd week',
    ]);
    const rows = emptyRows(6, 6);
    // On the street: the build week counts as the first, so it pays in weeks 2, 4 and 6.
    expect(earned(rows, [['garage', 0, 4]])).toEqual([5]);
    expect(budgets(rows, [['garage', 0, 4]], 6)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(tally(rows, [['garage', 0, 4]], 2).budget).toBe(1);
    // Touching a Driveway pack, of 3 tiles or 5, also meets it (each one runs down to the
    // street, so the Garage itself doesn't touch it). The Driveway pays for the Garage too.
    const drives: [string[], number][] = [
      [['###'], 6],
      [['#####'], 8],
    ];
    for (const [shape, height] of drives) {
      const t = tally(
        emptyRows(6, height),
        [
          ['garage', 0, 3],
          ['driveway', 2, 3, 1, shape],
        ],
        2,
      );
      expect(t.pieces[0]).toMatchObject({ earned: 5, budget: 1 });
      expect(t.pieces[0]!.unmet).toBeUndefined();
      expect(t.pieces[1]!.earned).toBe(1 + 3);
    }
    // Away from both it earns nothing and pays nothing, and says why.
    const t = tally(rows, [['garage', 0, 0]], 2);
    expect(t.pieces[0]).toMatchObject({
      earned: 0,
      budget: 0,
      unmet: 'touching the street or a Driveway',
    });
    expect(t.pieces[0]!.lines).toEqual([
      {
        label: 'Earns nothing: it must be touching the street or a Driveway',
        op: 'none',
        value: 0,
        from: [],
      },
    ]);
    expect(t.budget).toBe(0);
    // Placement (D-140): anywhere a room can go. Until D-140 this spot was refused with
    // "Garage must be built touching the street or a Driveway."
    expect(check(rows, [], 'garage', 0, 0)).toMatchObject({ legal: true });
    expect(check(rows, [], 'garage', 0, 4).legal).toBe(true);
    const small = emptyRows(6, 4);
    expect(check(small, [['bedroom', 0, 0]], 'garage', 0, 2).legal).toBe(true);
    // Beside the house and nowhere near the street: legal, as for a Bedroom.
    const deep = emptyRows(8, 12);
    expect(check(deep, [['bedroom', 0, 0]], 'garage', 2, 0).legal).toBe(true);
    // A room, so it must join the house, with every room's reason.
    expect(check(small, [['bedroom', 0, 0]], 'garage', 4, 2)).toMatchObject({
      legal: false,
      reason: 'Rooms must connect to the house.',
    });
    expect(CONTENT.pieces.garage.tags).toContain('Loud');
  });

  it('Garage: a Driveway laid later turns it on, and it’s Loud either way (D-140)', () => {
    // A house 9 rows back on a 6 × 12 lot: a Bedroom, and a Garage in front of it (rows 2–3).
    const rows = emptyRows(6, 12);
    const house: Placement[] = [
      ['bedroom', 0, 0],
      ['garage', 0, 2],
    ];
    const before = tally(rows, house, 2);
    expect(before.pieces[1]).toMatchObject({ earned: 0, budget: 0 });
    expect(before.pieces[1]!.unmet).toBe('touching the street or a Driveway');
    // Unreached, it's still a Loud room beside the Bedroom: 3 − 2.
    expect(before.pieces[0]!.earned).toBe(1);
    // One pack of 8 from the street (rows 4–11) reaches it: both pay from that week.
    const drive: Placement = ['driveway', 0, 4, 0, ['#', '#', '#', '#', '#', '#', '#', '#']];
    expect(check(rows, house, 'driveway', 0, 4, 0, drive[4]).legal).toBe(true);
    const after = tally(rows, [...house, drive], 2);
    expect(after.pieces[1]).toMatchObject({ earned: 5, budget: 1 });
    expect(after.pieces[1]!.unmet).toBeUndefined();
    expect(after.pieces[2]!.earned).toBe(1 + 3);
    // A drive that stops a tile short earns its +1 and leaves the Garage waiting.
    const short: Placement = ['driveway', 0, 5, 0, ['#', '#', '#', '#', '#', '#', '#']];
    const stub = tally(rows, [...house, short], 2);
    expect(stub.pieces[1]!.unmet).toBe('touching the street or a Driveway');
    expect(stub.pieces[2]!.earned).toBe(1);
    // A second pack off the first finishes it.
    const rest: Placement = ['driveway', 0, 4, 0, ['#']];
    expect(check(rows, [...house, short], 'driveway', 0, 4, 0, rest[4]).legal).toBe(true);
    const joined = tally(rows, [...house, short, rest], 2);
    expect(joined.pieces[1]!.earned).toBe(5);
    // The pack that touches the Garage is the one that's paid for it.
    expect(joined.pieces.slice(2).map((p) => p.earned)).toEqual([1, 1 + 3]);
  });

  it('Garage: in a run, it goes down off the street and completes Full House at ×1.5; then a Driveway turns it on (D-140)', () => {
    // The other eight Core room types on rows 0–2 of a 12 × 12 lot, nine rows from the street.
    const eight: Placement[] = [
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
      ['kitchen', 3, 0],
      ['diningRoom', 5, 0],
      ['livingRoom', 7, 0],
      ['closet', 2, 1],
      ['hallway', 0, 2],
      ['homeOffice', 2, 2],
    ];
    const s: RunState = {
      ...START,
      house: houseFrom(CONTENT, emptyRows(12, 12), eight),
      hand: [{ kind: 'piece', id: 'garage' }],
    };
    expect(R.currentTally(s).sets.map((x) => x.set)).not.toContain('fullHouse');
    // Under the Kitchen, at rows 2–3: nothing reaches it. The card has a play (no dead card),
    // and the preview says what the Garage is waiting for.
    const garage = { t: 'place', from: 'hand', i: 0, x: 4, y: 2, rot: 0 } as const;
    expect(R.cardFits(s, 0)).toBe(true);
    expect(R.checkPlay(s, garage).legal).toBe(true);
    expect(R.preview(s, garage).newPiece).toMatchObject({
      earned: 0,
      unmet: 'touching the street or a Driveway',
    });
    const built = R.apply(s, garage);
    const t1 = built.events.find((e) => e.t === 'tally')!.tally;
    expect(t1.pieces.at(-1)).toMatchObject({ defId: 'garage', earned: 0, budget: 0 });
    // It still counts for the set (D-070), which pays its Sparkle: ×1.5 since D-140.
    expect(t1.sets.map((x) => x.set)).toContain('fullHouse');
    expect(t1.xMults).toHaveLength(1);
    expect(t1.xMults[0]).toMatchObject({ source: { kind: 'set', id: 'fullHouse' }, times: 150 });
    expect(t1.xMults[0]!.after).toBe(Math.floor((t1.xMults[0]!.before * 150 + 50) / 100));
    // A Driveway pack of 8, from the street (row 11) up to the Garage's south wall (row 4).
    const s2: RunState = { ...built.state, hand: [{ kind: 'piece', id: 'driveway' }] };
    const drive = {
      t: 'place',
      from: 'hand',
      i: 0,
      x: 4,
      y: 4,
      rot: 0,
      shape: ['#', '#', '#', '#', '#', '#', '#', '#'],
    } as const;
    expect(R.checkPlay(s2, drive).legal).toBe(true);
    const t2 = R.apply(s2, drive).events.find((e) => e.t === 'tally')!.tally;
    const [g, d] = t2.pieces.slice(-2);
    expect(g).toMatchObject({ defId: 'garage', points: 5 });
    expect(g!.unmet).toBeUndefined();
    expect(g!.earned).toBeGreaterThan(0);
    expect(d).toMatchObject({ defId: 'driveway', points: 1 + 3 });
    expect(t2.total).toBeGreaterThan(t1.total);
  });

  it('Home Office: 2, −2 per Loud neighbor, +1 budget every 2nd week', () => {
    expectCard('homeOffice', [
      '+2 every week',
      '−2 per touching Loud neighbor',
      '+1 budget every 2nd week',
    ]);
    expect(shapeOf('homeOffice')).toMatchObject({ w: 2, h: 1, rotations: 2 });
    const rows = emptyRows(6, 6);
    expect(earned(rows, [['homeOffice', 0, 0]])).toEqual([2]);
    expect(budgets(rows, [['homeOffice', 0, 0]], 4)).toEqual([0, 1, 0, 1]);
    // On the street: 2 − 2.
    expect(earned(rows, [['homeOffice', 0, 5]])).toEqual([0]);
    // On the street and next to a Garage: 2 − 2 − 2 floors at 0, but it still pays budget.
    const t = tally(
      rows,
      [
        ['homeOffice', 2, 5],
        ['garage', 0, 4],
      ],
      2,
    );
    expect(t.pieces[0]).toMatchObject({ points: -2, earned: 0, budget: 1 });
    expect(CONTENT.pieces.homeOffice.tags).toContain('Quiet');
  });
});

describe('yard pieces', () => {
  it('Lawn: a 2×2, 1 and +1 per touching Lawn (up to 4)', () => {
    expectCard('lawn', ['+1 every week', '+1 per touching Lawn (up to 4)']);
    expect(shapeOf('lawn')).toMatchObject({ w: 2, h: 2, rotations: 1 });
    expect(earned(open, [['lawn', 0, 0]])).toEqual([1]);
    // The first Lawn touches the five others; four count.
    expect(
      earned(emptyRows(8, 8), [
        ['lawn', 2, 2],
        ['lawn', 0, 1],
        ['lawn', 0, 3],
        ['lawn', 2, 0],
        ['lawn', 4, 2],
        ['lawn', 2, 4],
      ]),
    ).toEqual([5, 4, 4, 3, 2, 3]);
  });

  it('Sapling: 1, and a Tree (a lot feature) at the start of its 5th week', () => {
    expectCard('sapling', ['+1 every week', 'Becomes a Tree after 4 weeks']);
    expect(earned(open, [['sapling', 0, 0]])).toEqual([1]);
    expect(CONTENT.pieces.sapling.effects).toContainEqual({
      kind: 'transform',
      into: { feature: 'tree' },
      afterWeeks: 4,
    });

    const r = createRules(CONTENT);
    const start = r.newRun({
      seed: 'sapling',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    const lot = lotFromRows(emptyRows(12, 12));
    let s: RunState = {
      ...start,
      house: { ...start.house, lot },
      hand: [{ kind: 'piece', id: 'sapling' }],
    };
    s = r.apply(s, { t: 'place', from: 'hand', i: 0, x: 5, y: 5, rot: 0 }).state;
    expect(r.pieceTimers(s, 1)).toEqual(['Becomes a Tree at the start of week 5']);
    const transformedIn: number[] = [];
    while (s.week < 5) {
      const { state, events } = r.apply(s, { t: 'pass' });
      if (events.some((e) => e.t === 'transformed')) transformedIn.push(state.week);
      if (state.week < 5) expect(state.house.pieces.map((p) => p.defId)).toEqual(['sapling']);
      s = state;
    }
    expect(transformedIn).toEqual([5]);
    expect(s.house.pieces).toEqual([]);
    expect(s.house.lot.terrain[cellIndex(12, 5, 5)]).toBe('tree');
    expect(r.currentTally(s).pieces).toEqual([]);
    // The new Tree is a Tree for everything else, such as a Treehouse.
    s = { ...s, hand: [{ kind: 'piece', id: 'treehouse' }] };
    expect(r.checkPlay(s, { t: 'place', from: 'hand', i: 0, x: 6, y: 5, rot: 0 }).legal).toBe(true);
    expect(r.checkPlay(s, { t: 'place', from: 'hand', i: 0, x: 8, y: 8, rot: 0 })).toMatchObject({
      legal: false,
      reason: 'Treehouse must be built touching a Tree.',
    });
  });

  it('Flower Bed: a view; 1, +2 in the front yard, +1 per touching Flower Bed', () => {
    expectCard('flowerBed', [
      '+1 every week',
      '+2 every week in the front yard',
      '+1 per touching Flower Bed',
    ]);
    expect(CONTENT.pieces.flowerBed.givesView).toBe(true);
    // Before the first room, all yard is front yard.
    expect(earned(open, [['flowerBed', 0, 0]])).toEqual([3]);
    // The Bedroom's front row is row 1: rows 0 and 1 are back yard, row 5 is front yard.
    const t = tally(open, [
      ['bedroom', 0, 0],
      ['flowerBed', 5, 0],
      ['flowerBed', 6, 0],
      ['flowerBed', 5, 5],
    ]);
    expect(t.pieces.map((p) => p.earned)).toEqual([3, 2, 2, 3]);
    expect(t.pieces[3]!.lines).toEqual([
      { label: 'Every week', op: 'add', value: 1, from: [] },
      { label: 'Every week (in the front yard)', op: 'add', value: 2, from: [] },
    ]);
  });

  it('Herb Garden: a view; +1 per tile in the sun, and Kitchens next to it earn +25%', () => {
    expectCard('herbGarden', ['+1 per tile in the sun', 'Touching Kitchens earn +25%']);
    expect(CONTENT.pieces.herbGarden.givesView).toBe(true);
    expect(shapeOf('herbGarden')).toMatchObject({ w: 2, h: 1, rotations: 2 });
    // The sun shines from the back here; a building shades the tile behind it (D-120).
    expect(earned(open, [['herbGarden', 0, 0]])).toEqual([2]);
    expect(earned(open, [['herbGarden', 0, 6]])).toEqual([2]);
    expect(
      earned(open, [
        ['closet', 0, 2],
        ['herbGarden', 0, 3, 1], // (0,3) in the Closet's shade, (0,4) in the sun
      ]),
    ).toEqual([1, 1]);
    expect(
      earned(open, [
        ['bedroom', 0, 4],
        ['herbGarden', 0, 6], // both tiles in the Bedroom's shade
      ]),
    ).toEqual([3, 0]);
    // Two of them by a Kitchen in the sun: +6 at +50% is 9. A Bedroom next to one isn't boosted.
    expect(
      earned(open, [
        ['kitchen', 2, 0],
        ['herbGarden', 1, 0, 1],
        ['herbGarden', 4, 0, 1],
        ['bedroom', 5, 0],
      ]),
    ).toEqual([9, 2, 2, 3]);
    // An L-Kitchen counts as a Kitchen: +4 at +25% is 5. The Herb Garden is in its shade.
    expect(
      earned(open, [
        ['lKitchen', 0, 0],
        ['herbGarden', 0, 2],
      ]),
    ).toEqual([5, 0]);
  });

  it('Patio: earns only touching a room; +2 per Living Room or Kitchen, +1 per view (up to 3)', () => {
    expectCard('patio', [
      'Earns nothing unless touching a room',
      '+2 per touching Living Room or Kitchen',
      '+1 per touching view (up to 3)',
    ]);
    // A Kitchen, a Living Room, a Flower Bed, and a Tree: 2 + 2 + 1 + 1.
    const rows = ['..........', '...T......', ...emptyRows(10, 8)];
    expect(
      earned(rows, [
        ['patio', 2, 2],
        ['kitchen', 0, 2],
        ['livingRoom', 4, 1],
        ['flowerBed', 2, 4],
      ]),
    ).toEqual([6, 2, 4, 3]); // the Kitchen and the Living Room in the sun: +2 each (D-120)
    // Seven Trees and a Closet around it: three of the Trees count.
    expect(
      earned(
        ['.TT.', '...T', 'T..T', '.TT.'],
        [
          ['patio', 1, 1],
          ['closet', 0, 1],
        ],
      ),
    ).toEqual([3, 1]);
    expect(
      earned(open, [
        ['patio', 2, 0],
        ['lKitchen', 0, 0],
      ]),
    ).toEqual([2, 2]);
    // The Patio rule (D-105): by a Tree but touching no room, it earns nothing, though it's
    // still legal. A Hallway isn't a room, and links only rooms, so one beside it doesn't help.
    const tree = ['.T........', ...emptyRows(10, 9)];
    expect(tally(tree, [['patio', 0, 1]]).pieces[0]).toMatchObject({
      earned: 0,
      unmet: 'touching a room',
    });
    expect(check(tree, [], 'patio', 0, 1).legal).toBe(true);
    expect(
      earned(tree, [
        ['patio', 0, 1],
        ['hallway', 2, 1, 1],
      ]),
    ).toEqual([0, 0]);
  });

  it('Fence: a wall, +1 per tile of the fenced yards it borders, up to 6', () => {
    expectCard('fence', ['+1 per tile of the fenced yards it borders (up to +6)']);
    expect(CONTENT.pieces.fence.wall).toBe(true);
    // A pack (D-106): 1–8 touching tiles from one card. It suggests the 1×4 and the L it
    // replaced; the 1×4 is the card's picture, and a test house's Fence without its own tiles.
    expect(CONTENT.pieces.fence.pack).toEqual({
      maxTiles: 8,
      shapes: [['####'], ['#..', '#..', '###']],
    });
    expect(cardText(CONTENT, CONTENT.pieces.fence).pack).toBe(
      'A pack: click out up to 8 tiles that touch, one piece in one week.',
    );
    expect(shapeOf('fence')).toEqual({
      cells: ['0,0', '1,0', '2,0', '3,0'],
      w: 4,
      h: 1,
      rotations: 2,
    });
    // D-069: a fenced yard has at least 10 tiles, so a Fence that closes one always earns 6.
    expect(CONTENT.balance.fencedYardMin).toBe(10);
    // Exactly 10 tiles between the Bedroom, the Fence, a Closet, and the lot's edges.
    const rows = emptyRows(7, 6);
    const ten: Placement[] = [
      ['bedroom', 0, 0],
      ['fence', 2, 2],
      ['closet', 6, 2],
    ];
    expect(fencedSizes(rows, ten)).toEqual([10]);
    expect(earned(rows, ten)).toEqual([3, 6, 1]);
    // Another Closet in the yard leaves 9 tiles: too small.
    const nine: Placement[] = [...ten, ['closet', 6, 0]];
    expect(fencedSizes(rows, nine)).toEqual([]);
    expect(earned(rows, nine)).toEqual([3, 0, 1, 1]);
    // Open to the street, it's no fenced yard.
    expect(
      earned(emptyRows(6, 6), [
        ['bedroom', 0, 0],
        ['fence', 2, 0, 1],
      ]),
    ).toEqual([3, 0]);
    // Two yards of 12, one on each side: 24 tiles, capped at 6.
    const two: Placement[] = [
      ['fence', 3, 0, 1],
      ['livingRoom', 0, 4, 1],
      ['livingRoom', 4, 4, 1],
    ];
    expect(fencedSizes(emptyRows(7, 8), two)).toEqual([12, 12]);
    const t = tally(emptyRows(7, 8), two);
    expect(t.pieces.map((p) => p.earned)).toEqual([6, 2, 2]); // Living Rooms in the sun
    expect(t.pieces[0]!.lines).toEqual([
      { label: '2 fenced yards, 24 tiles (up to 6)', op: 'add', value: 6, from: [] },
    ]);
  });

  it('Fence pack: one card, any 1–8 touching tiles as one piece; a yard needs the house as well', () => {
    // One card: no shape variant shares its type any more.
    expect(CONTENT.pieces.fence.countsAs).toBeUndefined();
    expect(Object.values(CONTENT.pieces).filter((d) => d.countsAs === 'fence')).toEqual([]);
    // The suggested shapes, and any other of up to 8 touching tiles; not 9, and not apart.
    const L = ['#..', '#..', '###'];
    for (const shape of [['#'], ['####'], L, ['####', '####'], ['#.#', '###']]) {
      expect(checkPack(open, 'fence', 0, 0, shape).legal, shape.join('/')).toBe(true);
    }
    expect(checkPack(open, 'fence', 0, 0, ['#########'])).toMatchObject({
      legal: false,
      reason: 'Up to 8 tiles, all touching.',
    });
    expect(checkPack(open, 'fence', 0, 0, ['#.#'])).toMatchObject({
      legal: false,
      reason: 'A pack’s tiles must all touch.',
    });
    // A Fence and an L-shaped one (its bar along the top) close 12 tiles in a corner, but with
    // no house it's no yard.
    const rows = emptyRows(6, 8);
    const corner: Placement[] = [
      ['fence', 2, 0, 1],
      ['fence', 3, 4, 1, L],
    ];
    expect(fencedSizes(rows, corner)).toEqual([]);
    expect(earned(rows, corner)).toEqual([0, 0]);
    // A Closet in the corner borders it: 11 tiles, and each Fence earns its 6.
    const withCloset: Placement[] = [...corner, ['closet', 5, 0]];
    expect(fencedSizes(rows, withCloset)).toEqual([11]);
    expect(earned(rows, withCloset)).toEqual([6, 6, 1]);
    // One pack of 8 tiles does both their work, as one piece: one payout.
    const onePack: Placement[] = [
      ['fence', 2, 0, 0, ['#...', '#...', '#...', '#...', '####']],
      ['closet', 5, 0],
    ];
    expect(fencedSizes(rows, onePack)).toEqual([11]);
    expect(earned(rows, onePack)).toEqual([6, 1]);
    // An L on its own against two Bedrooms: 12 tiles.
    const alone: Placement[] = [
      ['bedroom', 0, 0],
      ['bedroom', 0, 2],
      ['fence', 2, 4, 1, L],
    ];
    expect(fencedSizes(emptyRows(5, 8), alone)).toEqual([12]);
    expect(earned(emptyRows(5, 8), alone)).toEqual([4, 4, 6]);
  });

  it('Driveway: a pack from the street or another Driveway; +3 at a Garage, +1 anywhere; crosses the creek', () => {
    expectCard('driveway', [
      'Must be built touching the street or a Driveway',
      '+3 if touching a Garage',
      '+1 every week',
    ]);
    expect(CONTENT.pieces.driveway.canCover).toEqual(['creek']);
    // A pack (D-106): 1–8 touching tiles from one card (D-140; 6 before), as the Fence. It
    // suggests the 1×3 and the 1×5 it replaced; the 1×3 is the card's picture, and a test
    // house's Driveway without its own tiles.
    expect(CONTENT.pieces.driveway.pack).toEqual({ maxTiles: 8, shapes: [['###'], ['#####']] });
    expect(CONTENT.pieces.driveway.pack!.maxTiles).toBe(CONTENT.pieces.fence.pack!.maxTiles);
    expect(cardText(CONTENT, CONTENT.pieces.driveway).pack).toBe(
      'A pack: click out up to 8 tiles that touch, one piece in one week.',
    );
    expect(shapeOf('driveway')).toEqual({
      cells: ['0,0', '1,0', '2,0'],
      w: 3,
      h: 1,
      rotations: 2,
    });
    const rows = emptyRows(6, 6);
    expect(earned(rows, [['driveway', 0, 5]])).toEqual([1]);
    // Chained off another Driveway.
    expect(
      earned(rows, [
        ['driveway', 0, 5],
        ['driveway', 0, 2, 1],
      ]),
    ).toEqual([1, 1]);
    // Away from both it earns nothing.
    expect(tally(rows, [['driveway', 0, 0]]).pieces[0]).toMatchObject({
      earned: 0,
      unmet: 'touching the street or a Driveway',
    });
    // Its +1 no longer reads the yard it's in (D-140, settling D-080): beside a house that
    // comes down to the street it's in the back yard, and paid 0 until now.
    const back = tally(rows, [
      ['driveway', 0, 5],
      ['bedroom', 3, 4],
    ]);
    expect(back.pieces[0]!.earned).toBe(1);
    expect(back.pieces[0]!.unmet).toBeUndefined();
    // Touching a Garage pays once, however many Garages: +3.
    expect(
      earned(emptyRows(8, 6), [
        ['driveway', 2, 3, 1],
        ['garage', 0, 3],
        ['garage', 3, 3],
      ])[0],
    ).toBe(1 + 3);
    // Placement.
    expect(check(rows, [], 'driveway', 0, 0)).toMatchObject({
      legal: false,
      reason: 'Driveway must be built touching the street or a Driveway.',
    });
    expect(check(rows, [], 'driveway', 0, 5).legal).toBe(true);
    // A Garage isn't the street: a Driveway can't start from one.
    expect(check(rows, [['garage', 0, 0]], 'driveway', 2, 0).legal).toBe(false);
    // Over the creek, chained from the street; nothing else can go there, and not on the pond.
    const creek = ['......', '......', 'PP....', '......', 'CCCCCC', '......', '......', '......'];
    const first: Placement[] = [['driveway', 2, 5, 1]];
    expect(check(creek, [], 'driveway', 2, 5, 1).legal).toBe(true);
    expect(check(creek, first, 'driveway', 2, 2, 1).legal).toBe(true);
    expect(check(creek, first, 'lawn', 0, 3)).toMatchObject({
      legal: false,
      reason: "You can't build on the creek.",
    });
    expect(check(creek, [['driveway', 0, 5, 1]], 'driveway', 0, 2, 1)).toMatchObject({
      legal: false,
      reason: "You can't build on the pond.",
    });
  });

  it('Driveway pack: one card, 1–8 touching tiles; a long one takes a Garage across the creek', () => {
    // One card: no shape variant shares its type any more.
    expect(CONTENT.pieces.driveway.countsAs).toBeUndefined();
    expect(Object.values(CONTENT.pieces).filter((d) => d.countsAs === 'driveway')).toEqual([]);
    const LONG = ['#####'];
    expect(earned(emptyRows(8, 8), [['driveway', 0, 7, 0, LONG]])).toEqual([1]);
    // The suggested shapes, and any other of up to 8 touching tiles, when one of them reaches
    // the street (each shape here ends on the street row); not 9.
    const street = emptyRows(10, 8);
    for (const shape of [
      ['#'],
      ['###'],
      LONG,
      ['######'],
      ['########'],
      ['#.', '#.', '##'],
      ['##', '##', '##'],
      ['#.', '#.', '#.', '#.', '#.', '#.', '##'],
    ]) {
      const legal = checkPack(street, 'driveway', 0, 8 - shape.length, shape).legal;
      expect(legal, shape.join('/')).toBe(true);
    }
    expect(checkPack(street, 'driveway', 0, 7, ['#########'])).toMatchObject({
      legal: false,
      reason: 'Up to 8 tiles, all touching.',
    });
    expect(checkPack(street, 'driveway', 0, 0, LONG)).toMatchObject({
      legal: false,
      reason: 'Driveway must be built touching the street or a Driveway.',
    });
    // From the street across the creek at row 4; a Garage on the far bank touches it.
    const rows = ['........', '........', '........', '........', 'CCCCCCCC', ...emptyRows(8, 3)];
    const drive: Placement[] = [['driveway', 3, 3, 1, LONG]];
    expect(check(rows, [], 'driveway', 3, 3, 1, LONG).legal).toBe(true);
    expect(check(rows, drive, 'garage', 4, 2).legal).toBe(true);
    // Off the drive it can be built too (D-140), and earns nothing there.
    expect(check(rows, drive, 'garage', 6, 0).legal).toBe(true);
    expect(tally(rows, [...drive, ['garage', 6, 0]], 2).pieces[1]).toMatchObject({
      earned: 0,
      budget: 0,
    });
    // A short Driveway can chain off it.
    expect(check(rows, drive, 'driveway', 0, 3).legal).toBe(true);
    const t = tally(rows, [...drive, ['garage', 4, 2]], 2);
    expect(t.pieces[1]).toMatchObject({ defId: 'garage', earned: 5, budget: 1 });
    expect(t.pieces[1]!.unmet).toBeUndefined();
    expect(t.pieces[0]).toMatchObject({ defId: 'driveway', earned: 1 + 3 });
  });
});

describe('"-house" outbuildings', () => {
  it('Doghouse: earns only in a fenced yard (but can be built anywhere); 1, +1 per Lawn', () => {
    expectCard('doghouse', [
      'Earns nothing unless in a fenced yard',
      '+1 every week',
      '+1 per touching Lawn',
    ]);
    expect(CONTENT.pieces.doghouse.tags).toEqual(['Pet', 'House']);
    const rows = emptyRows(6, 6);
    // Out in the open, next to a Lawn: nothing, with a warning line. It's still legal.
    const t = tally(rows, [
      ['doghouse', 0, 0],
      ['lawn', 1, 0],
    ]);
    expect(t.pieces.map((p) => p.earned)).toEqual([0, 1]);
    expect(t.pieces[0]).toMatchObject({ unmet: 'in a fenced yard', budget: 0 });
    expect(t.pieces[0]!.lines[0]!.op).toBe('none');
    expect(check(rows, [], 'doghouse', 0, 0).legal).toBe(true);
    // In a 16-tile fenced yard beside two Bedrooms, with a Lawn: 1 + 1. The yard's tiles
    // include the Doghouse's and the Lawn's own.
    const yard: Placement[] = [
      ['bedroom', 0, 0],
      ['bedroom', 0, 2],
      ['fence', 2, 4],
      ['doghouse', 2, 0],
      ['lawn', 3, 0],
    ];
    expect(fencedSizes(emptyRows(6, 8), yard)).toEqual([16]);
    expect(earned(emptyRows(6, 8), yard)).toEqual([4, 4, 6, 2, 1]);
  });

  it('Treehouse: must touch a Tree; 2, +2 per Kid neighbor other than Treehouses', () => {
    expectCard('treehouse', [
      'Must be built touching a Tree',
      '+2 every week',
      '+2 per touching Kid neighbor other than Treehouses',
    ]);
    expect(CONTENT.pieces.treehouse.tags).toEqual(['Kid', 'House']);
    const rows = ['T.....', ...emptyRows(6, 5)];
    expect(earned(rows, [['treehouse', 1, 0]])).toEqual([2]);
    // A Playroom is a Kid neighbor: 2 + 2.
    expect(
      earned(rows, [
        ['treehouse', 1, 0],
        ['playroom', 3, 0],
      ]),
    ).toEqual([4, 0]);
    // Two Treehouses, each by its own Tree, are both Kid, but don't count each other (D-105),
    // so a cluster isn't the best spot.
    expect(
      earned(
        ['T....T', ...emptyRows(6, 5)],
        [
          ['treehouse', 1, 0],
          ['treehouse', 3, 0],
        ],
      ),
    ).toEqual([2, 2]);
    expect(tally(rows, [['treehouse', 2, 2]]).pieces[0]).toMatchObject({
      earned: 0,
      unmet: 'touching a Tree',
    });
    // Placement is checked with the Trees under it gone.
    expect(check(rows, [], 'treehouse', 1, 0).legal).toBe(true);
    expect(check(rows, [], 'treehouse', 3, 3)).toMatchObject({
      legal: false,
      reason: 'Treehouse must be built touching a Tree.',
    });
    expect(check(rows, [], 'treehouse', 0, 0)).toMatchObject({
      legal: false,
      reason: 'Treehouse must be built touching a Tree.',
    });
    const two = ['T.....', '......', 'T.....', ...emptyRows(6, 3)];
    expect(check(two, [], 'treehouse', 0, 0)).toMatchObject({
      legal: true,
      clearedTrees: [{ x: 0, y: 0 }],
    });
  });

  it('Greenhouse: a view; the gardens next to it (yard pieces with a view) earn +50%', () => {
    expectCard('greenhouse');
    const def = CONTENT.pieces.greenhouse;
    expect(def.givesView).toBe(true);
    expect(def.tags).toEqual(['Green', 'House']);
    expect(shapeOf('greenhouse')).toMatchObject({ w: 2, h: 2, rotations: 1 });
    // A front-yard Flower Bed (3) and an Herb Garden in the sun (2) are boosted; a Lawn isn't.
    expect(
      earned(open, [
        ['greenhouse', 2, 2],
        ['flowerBed', 1, 2],
        ['herbGarden', 2, 1],
        ['lawn', 4, 2],
      ]),
    ).toEqual([0, 5, 3, 1]);
    // A Living Room next to it gets a view, but no boost: it isn't a yard piece. It's in the sun.
    expect(
      earned(open, [
        ['greenhouse', 0, 0],
        ['livingRoom', 2, 0],
      ]),
    ).toEqual([0, 4]);
  });

  // The aura's selector is `all: [viewSource, yard]`: only gardens (the givesView yard
  // pieces), so the card mustn't read as every yard piece and every view.
  it('Greenhouse: its card text names only the gardens it boosts', () => {
    const text = cardText(CONTENT, CONTENT.pieces.greenhouse).effects[0]!;
    expect(text).not.toMatch(/views? and yard pieces?|yard pieces? and views?/);
  });
});
