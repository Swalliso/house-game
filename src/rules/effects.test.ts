// The M2 effect kinds and placement rules (implementation-plan.md §4 Layout rules and Scoring
// pipeline, §5 Effect kinds, Appendix A · M2, Appendix B base-pool rows), one describe each.
// Tallies run on small hand-built lots from testing.ts, so tuning real content never breaks
// them. Every piece placed by houseFrom has placedWeek 1, so tallying in week w means age w − 1.

import { describe, expect, it } from 'vitest';
import type { Content, PieceId, PieceScore, Rot, Tally } from './index.ts';
import { placedCells } from './grid.ts';
import { computeLayout } from './layout.ts';
import { checkPlacement, REASONS, roomToo } from './placement.ts';
import { tallyHouse } from './scoring.ts';
import { emptyRows, houseFrom, TEST_CONTENT as C, withPieces, type Placement } from './testing.ts';

/** The house's layout, with every piece's placedWeek set (houseFrom uses 1). */
function layoutFor(
  content: Content,
  rows: readonly string[],
  placements: readonly Placement[],
  placedWeek = 1,
) {
  const house = houseFrom(content, rows, placements);
  return computeLayout(content, {
    ...house,
    pieces: house.pieces.map((p) => ({ ...p, placedWeek })),
  });
}

function tallyAt(
  content: Content,
  rows: readonly string[],
  placements: readonly Placement[],
  week = 1,
  placedWeek = 1,
): Tally {
  return tallyHouse(content, layoutFor(content, rows, placements, placedWeek), week, true);
}

function scoreOf(t: Tally, uid: number): PieceScore {
  const s = t.pieces.find((p) => p.uid === uid);
  if (!s) throw new Error(`no piece ${uid} in the tally`);
  return s;
}

/** What uid earns in each of the given weeks. */
function earnedByWeek(
  content: Content,
  rows: readonly string[],
  placements: readonly Placement[],
  uid: number,
  weeks: readonly number[],
): number[] {
  return weeks.map((w) => scoreOf(tallyAt(content, rows, placements, w), uid).earned);
}

/** Can `id` be built at (x, y) on this house? A pack (D-106) can be given its own tiles. */
function check(
  content: Content,
  rows: readonly string[],
  placements: readonly Placement[],
  id: PieceId,
  x: number,
  y: number,
  rot: Rot = 0,
  shape?: readonly string[],
) {
  const house = houseFrom(content, rows, placements);
  const def = content.pieces[id];
  return checkPlacement(
    content,
    computeLayout(content, house),
    def,
    x,
    y,
    rot,
    1,
    (h) => computeLayout(content, h),
    shape ?? def.shape,
  );
}

const WEEKS = [1, 2, 3, 4, 5, 6, 7];

/** The Fence pack's suggested L, and a Driveway pack of 5 in a row (D-106). */
const L = ['#..', '#..', '###'];
const LONG = ['#####'];

// ---------------------------------------------------------------------------------------
// Effect kinds.

describe('rhythm', () => {
  // A Closet that pays 5 every 3rd week of its life (the Pool's kind).
  const c = withPieces({ closet: { effects: [{ kind: 'rhythm', every: 3, amount: 5 }] } });
  const rows = emptyRows(4, 4);

  it('pays when (age + 1) is a multiple of `every`, so the build week counts as the first', () => {
    // Placed in week 1: ages 0..6. It pays at ages 2 and 5, weeks 3 and 6.
    expect(earnedByWeek(c, rows, [['closet', 0, 0]], 1, WEEKS)).toEqual([0, 0, 5, 0, 0, 5, 0]);
  });

  it('counts from the week the piece was placed, not from the start of the run', () => {
    // Placed in week 4: it pays in weeks 6 and 9.
    const at = (week: number) => scoreOf(tallyAt(c, rows, [['closet', 0, 0]], week, 4), 1).earned;
    expect([4, 5, 6, 7, 8, 9].map(at)).toEqual([0, 0, 5, 0, 0, 5]);
  });

  it('shows "Every 3rd week" on the breakdown when it pays, and no line when it doesn’t', () => {
    expect(scoreOf(tallyAt(c, rows, [['closet', 0, 0]], 3), 1).lines).toEqual([
      { label: 'Every 3rd week', op: 'add', value: 5, from: [] },
    ]);
    expect(scoreOf(tallyAt(c, rows, [['closet', 0, 0]], 2), 1).lines).toEqual([]);
    const c2 = withPieces({ closet: { effects: [{ kind: 'rhythm', every: 2, amount: 4 }] } });
    expect(scoreOf(tallyAt(c2, rows, [['closet', 0, 0]], 2), 1).lines).toEqual([
      { label: 'Every 2nd week', op: 'add', value: 4, from: [] },
    ]);
  });
});

describe('growth', () => {
  const rows = emptyRows(4, 4);

  it('earns perWeek × (age + 1), capped at max', () => {
    const c = withPieces({ closet: { effects: [{ kind: 'growth', perWeek: 2, max: 7 }] } });
    // 2, 4, 6, then capped at 7.
    expect(earnedByWeek(c, rows, [['closet', 0, 0]], 1, WEEKS)).toEqual([2, 4, 6, 7, 7, 7, 7]);
  });

  it('grows without limit when there’s no max', () => {
    const c = withPieces({ closet: { effects: [{ kind: 'growth', perWeek: 1 }] } });
    expect(earnedByWeek(c, rows, [['closet', 0, 0]], 1, [1, 5, 20])).toEqual([1, 5, 20]);
  });

  it('counts from its own placement week', () => {
    const c = withPieces({ closet: { effects: [{ kind: 'growth', perWeek: 3 }] } });
    // Placed in week 5, tallied in week 6: it has stood 2 weeks.
    const s = scoreOf(tallyAt(c, rows, [['closet', 0, 0]], 6, 5), 1);
    expect(s.earned).toBe(6);
    expect(s.lines).toEqual([{ label: 'Grown for 2 weeks', op: 'add', value: 6, from: [] }]);
    expect(scoreOf(tallyAt(c, rows, [['closet', 0, 0]], 5, 5), 1).lines).toEqual([
      { label: 'Grown for 1 week', op: 'add', value: 3, from: [] },
    ]);
  });
});

describe('enclosure (the Fence)', () => {
  it('earns perTile per tile of the fenced yard it borders', () => {
    // The Bedroom (x 2–3) and the Fence (row 2) close a 2×2 yard in the top-left corner.
    const rows = emptyRows(8, 8);
    const layout = layoutFor(C, rows, [
      ['bedroom', 2, 0],
      ['fence', 0, 2],
    ]);
    expect(layout.fencedSizes).toEqual([4]);
    const fence = scoreOf(tallyHouse(C, layout, 1, true), 2);
    expect(fence.earned).toBe(4);
    expect(fence.lines).toEqual([
      { label: 'Fenced yard of 4 tiles', op: 'add', value: 4, from: [] },
    ]);
  });

  it('caps the total at 6', () => {
    // An 8-tile yard: x 0–3, rows 0–1.
    const t = tallyAt(C, emptyRows(8, 8), [
      ['bedroom', 4, 0],
      ['fence', 0, 2],
    ]);
    expect(scoreOf(t, 2).earned).toBe(6);
    expect(scoreOf(t, 2).lines[0]).toMatchObject({ op: 'add', value: 6 });
    expect(scoreOf(t, 2).lines[0]!.label).toContain('8 tiles');
  });

  it('sums the tiles of every fenced yard it borders, then caps the sum', () => {
    // A vertical Fence at x 2 splits the top rows into two 4-tile yards, each closed below by
    // a Bedroom.
    const placements: Placement[] = [
      ['fence', 2, 0, 1],
      ['bedroom', 0, 2],
      ['bedroom', 3, 2],
    ];
    const rows = emptyRows(5, 7);
    expect(layoutFor(C, rows, placements).fencedSizes).toEqual([4, 4]);
    const uncapped = withPieces({ fence: { effects: [{ kind: 'enclosure', perTile: 1 }] } });
    expect(scoreOf(tallyAt(uncapped, rows, placements), 1).earned).toBe(8);
    const perTile2 = withPieces({
      fence: { effects: [{ kind: 'enclosure', perTile: 2, cap: 100 }] },
    });
    expect(scoreOf(tallyAt(perTile2, rows, placements), 1).earned).toBe(16);
    expect(scoreOf(tallyAt(C, rows, placements), 1).earned).toBe(6);
  });

  it('earns nothing without a fenced yard', () => {
    // A Fence alone.
    const alone = scoreOf(tallyAt(C, emptyRows(8, 8), [['fence', 0, 2]]), 1);
    expect(alone.earned).toBe(0);
    expect(alone.lines).toEqual([]);
    // A lone L-shaped Fence closing a corner: no house, so no fenced yard (§4's house rule).
    const corner = layoutFor(C, emptyRows(8, 8), [['fence', 0, 0, 3, L]]);
    expect(corner.fencedSizes).toEqual([]);
    expect(scoreOf(tallyHouse(C, corner, 1, true), 1).earned).toBe(0);
    // A yard that reaches the street edge isn't fenced.
    const street = tallyAt(C, emptyRows(8, 4), [
      ['bedroom', 2, 2],
      ['fence', 0, 1],
    ]);
    expect(scoreOf(street, 2).earned).toBe(0);
    // Fewer than fencedYardMin (4) tiles isn't a yard: a 1×2 pocket beside a Bedroom.
    const small = layoutFor(C, emptyRows(8, 8), [
      ['bedroom', 1, 0],
      ['fence', 0, 2],
    ]);
    expect(small.fencedSizes).toEqual([]);
    expect(scoreOf(tallyHouse(C, small, 1, true), 2).earned).toBe(0);
  });

  it('counts an L-shaped Fence pack the same way', () => {
    // The Bedroom covers x 0–1, rows 0–1; the L at (2,0), rot 3 ('..#', '..#', '###'), covers
    // (4,0), (4,1), (2,2), (3,2), and (4,2). Between them is a 4-tile yard: x 2–3, rows 0–1.
    const layout = layoutFor(C, emptyRows(8, 8), [
      ['bedroom', 0, 0],
      ['fence', 2, 0, 3, L],
    ]);
    expect(layout.fencedSizes).toEqual([4]);
    expect(scoreOf(tallyHouse(C, layout, 1, true), 2).earned).toBe(4);
  });
});

describe('economy', () => {
  // A Home Office (x 5–6, row 0; every 2nd week) and a Garage on the street (every 3rd week),
  // apart, so the Garage's Loud doesn't touch the Office.
  const rows = emptyRows(8, 4);
  const placements: Placement[] = [
    ['homeOffice', 5, 0],
    ['garage', 0, 2],
  ];

  it('pays budget on its cadence, counting the build week as the first', () => {
    const budgets = (uid: number) =>
      WEEKS.map((w) => scoreOf(tallyAt(C, rows, placements, w), uid).budget);
    expect(budgets(1)).toEqual([0, 1, 0, 1, 0, 1, 0]); // Home Office: every 2nd week
    expect(budgets(2)).toEqual([0, 0, 1, 0, 0, 1, 0]); // Garage: every 3rd week
  });

  it('sums every piece’s budget into Tally.budget, separate from the score', () => {
    expect(WEEKS.map((w) => tallyAt(C, rows, placements, w).budget)).toEqual([0, 1, 1, 1, 0, 2, 0]);
    const t = tallyAt(C, rows, placements, 6);
    // Budget never adds to what a piece earns: Office 2 (steady), Garage 1 (steady).
    expect(scoreOf(t, 1).earned).toBe(2);
    expect(scoreOf(t, 2).earned).toBe(1);
    expect(t.points).toBe(3);
  });

  it('shows a budget line when it pays', () => {
    const t = tallyAt(C, rows, placements, 6);
    expect(scoreOf(t, 1).lines).toContainEqual({
      label: 'Every 2nd week',
      op: 'budget',
      value: 1,
      from: [],
    });
    expect(scoreOf(t, 2).lines).toContainEqual({
      label: 'Every 3rd week',
      op: 'budget',
      value: 1,
      from: [],
    });
    expect(scoreOf(tallyAt(C, rows, placements, 5), 1).lines.some((l) => l.op === 'budget')).toBe(
      false,
    );
  });

  it('pays every week without `every`', () => {
    const c = withPieces({ closet: { effects: [{ kind: 'economy', budget: 2 }] } });
    const t = (w: number) => tallyAt(c, emptyRows(4, 4), [['closet', 0, 0]], w);
    expect([1, 2, 3].map((w) => t(w).budget)).toEqual([2, 2, 2]);
    expect(scoreOf(t(1), 1).lines).toEqual([
      { label: 'Every week', op: 'budget', value: 2, from: [] },
    ]);
  });

  it('counts from the week the piece was placed', () => {
    // A Home Office placed in week 3 pays in weeks 4 and 6.
    const office: Placement[] = [['homeOffice', 0, 0]];
    const at = (w: number) => tallyAt(C, emptyRows(6, 6), office, w, 3).budget;
    expect([3, 4, 5, 6].map(at)).toEqual([0, 1, 0, 1]);
  });

  it('pays no budget while its requirement is unmet', () => {
    // A Garage off the street, with no Driveway: in its 3rd week it would pay 1.
    const t = tallyAt(C, emptyRows(8, 6), [['garage', 0, 0]], 3);
    const garage = scoreOf(t, 1);
    expect(garage.budget).toBe(0);
    expect(garage.earned).toBe(0);
    expect(garage.unmet).toBe('touching the street or a Driveway');
    expect(garage.lines.map((l) => l.op)).toEqual(['none']);
    expect(t.budget).toBe(0);
  });
});

describe('perTile (the Herb Garden)', () => {
  // The sun from the back (the top): a Tree or a building shades the tile below it (D-120).
  const rows = ['......', '......', '.....T', '......', '......', '......', '......', '......'];
  const t = tallyAt(C, rows, [
    ['herbGarden', 0, 0], // 1: both tiles in the sun
    ['herbGarden', 5, 3, 1], // 2: (5,3) in the Tree's shade, (5,4) in the sun
    ['bedroom', 2, 4], // 3: shades the two tiles below it
    ['herbGarden', 2, 6], // 4: in the Bedroom's shade
  ]);

  it('earns +1 per tile in the sun', () => {
    expect(scoreOf(t, 1).earned).toBe(2);
    expect(scoreOf(t, 1).lines).toEqual([
      { label: '2 tiles in the sun', op: 'add', value: 2, from: [] },
    ]);
    expect(scoreOf(t, 2).earned).toBe(1);
    expect(scoreOf(t, 2).lines).toEqual([
      { label: '1 tile in the sun', op: 'add', value: 1, from: [] },
    ]);
  });

  it('earns nothing in the shade', () => {
    expect(scoreOf(t, 4).earned).toBe(0);
    expect(scoreOf(t, 4).lines).toEqual([]);
  });

  it('follows the lot’s sun', () => {
    const house = houseFrom(C, emptyRows(6, 8), [
      ['bedroom', 0, 4],
      ['herbGarden', 0, 6], // right under the Bedroom: shaded from the back, lit from the left
    ]);
    const left = { ...house, lot: { ...house.lot, sun: 'left' as const } };
    expect(scoreOf(tallyHouse(C, computeLayout(C, left), 1, true), 2).earned).toBe(2);
    expect(scoreOf(tallyHouse(C, computeLayout(C, house), 1, true), 2).earned).toBe(0);
  });
});

describe('link (the Hallway)', () => {
  const rows = emptyRows(8, 6);

  it('makes rooms touching it neighbors: a Bathroom linked to a Bedroom gets +3', () => {
    const linked = tallyAt(C, rows, [
      ['bedroom', 0, 0],
      ['hallway', 2, 0],
      ['bathroom', 4, 0],
    ]);
    expect(scoreOf(linked, 3).earned).toBe(3);
    expect(scoreOf(linked, 3).lines).toEqual([
      { label: 'Touching a Bedroom', op: 'add', value: 3, from: [{ kind: 'piece', uid: 1 }] },
    ]);
    // Without the Hallway they're apart.
    const apart = tallyAt(C, rows, [
      ['bedroom', 0, 0],
      ['bathroom', 4, 0],
    ]);
    expect(scoreOf(apart, 2).earned).toBe(0);
  });

  it('changes scoring neighbors, not physical touching', () => {
    const layout = layoutFor(C, rows, [
      ['bedroom', 0, 0],
      ['hallway', 2, 0],
      ['bathroom', 4, 0],
    ]);
    expect(layout.touching.get(3)).toEqual([{ kind: 'piece', uid: 2 }]);
    expect(layout.neighbors.get(3)).toEqual([{ kind: 'piece', uid: 1 }]);
    expect(layout.neighbors.get(1)).toEqual([{ kind: 'piece', uid: 3 }]);
  });

  it('isn’t a neighbor for bonuses itself, and earns nothing', () => {
    // A Closet that earns +1 per neighbor of any kind, touching only the Hallway: it counts the
    // two linked rooms, not the Hallway.
    const c = withPieces({ closet: { effects: [{ kind: 'neighbor', match: 'all', amount: 1 }] } });
    const t = tallyAt(c, rows, [
      ['bedroom', 0, 0],
      ['hallway', 2, 0],
      ['bathroom', 4, 0],
      ['closet', 3, 1],
    ]);
    expect(scoreOf(t, 4).earned).toBe(2);
    expect(scoreOf(t, 2)).toMatchObject({ earned: 0, lines: [] });
  });

  it('links through a connected group of Hallways, the Long Hallway included', () => {
    const t = tallyAt(C, rows, [
      ['bedroom', 0, 0],
      ['hallway', 2, 0],
      ['longHallway', 4, 0],
      ['bathroom', 7, 0],
    ]);
    expect(scoreOf(t, 4).earned).toBe(3);
  });

  it('carries auras: a Dining Room linked to a Kitchen boosts it', () => {
    const t = tallyAt(C, rows, [
      ['diningRoom', 0, 0],
      ['hallway', 2, 0],
      ['kitchen', 4, 0],
    ]);
    expect(scoreOf(t, 3)).toMatchObject({ points: 2, pct: 50, earned: 3 });
  });

  it('counts for sets: Jack-and-Jill through a Hallway', () => {
    const t = tallyAt(C, rows, [
      ['bedroom', 0, 0],
      ['hallway', 2, 0],
      ['bathroom', 4, 0],
      ['bedroom', 5, 0],
    ]);
    expect(t.sets.map((s) => s.set)).toEqual(['jackAndJill']);
  });

  it('counts for conditions: a linked Bedroom meets "touching a Bedroom"', () => {
    const c = withPieces({
      closet: {
        effects: [
          {
            kind: 'requires',
            condition: { touching: { piece: 'bedroom' } },
            blocksPlacement: false,
          },
          {
            kind: 'conditional',
            when: { touching: { piece: 'bedroom' } },
            effect: { kind: 'steady', amount: 2 },
          },
        ],
      },
    });
    const linked = tallyAt(c, rows, [
      ['bedroom', 0, 0],
      ['hallway', 2, 0],
      ['closet', 4, 0],
    ]);
    expect(scoreOf(linked, 3)).toMatchObject({ earned: 2 });
    expect(scoreOf(linked, 3).unmet).toBeUndefined();
    const apart = tallyAt(c, rows, [
      ['bedroom', 0, 0],
      ['closet', 4, 0],
    ]);
    expect(scoreOf(apart, 2)).toMatchObject({ earned: 0, unmet: 'touching a Bedroom' });
  });

  it('links rooms only: yard pieces touching it aren’t linked', () => {
    // Two Lawns either side of a Hallway: each earns only its steady 1.
    const t = tallyAt(C, rows, [
      ['lawn', 0, 2],
      ['hallway', 2, 2],
      ['lawn', 4, 2],
    ]);
    expect(scoreOf(t, 1).earned).toBe(1);
    expect(scoreOf(t, 3).earned).toBe(1);
  });
});

describe('requires', () => {
  it('a Doghouse outside a fenced yard earns nothing and says why', () => {
    // Beside a Lawn it would earn 1 + 1.
    const t = tallyAt(C, emptyRows(6, 6), [
      ['lawn', 0, 0],
      ['doghouse', 2, 0],
    ]);
    const dog = scoreOf(t, 2);
    expect(dog.earned).toBe(0);
    expect(dog.points).toBe(0);
    expect(dog.unmet).toBe('in a fenced yard');
    expect(dog.lines).toHaveLength(1);
    expect(dog.lines[0]).toMatchObject({ op: 'none', value: 0, from: [] });
    expect(dog.lines[0]!.label).toContain('in a fenced yard');
  });

  it('a Doghouse inside a fenced yard earns', () => {
    // The 8-tile yard (x 0–3, rows 0–1) from the Fence tests, with a Lawn in it too.
    const t = tallyAt(C, emptyRows(8, 8), [
      ['bedroom', 4, 0],
      ['fence', 0, 2],
      ['doghouse', 0, 0],
      ['lawn', 1, 0],
    ]);
    const dog = scoreOf(t, 3);
    expect(dog.unmet).toBeUndefined();
    expect(dog.earned).toBe(2); // steady 1 + Lawn 1
    expect(dog.lines.some((l) => l.op === 'none')).toBe(false);
  });

  it('an unmet piece’s auras don’t apply', () => {
    // A Dining Room that needs a Tree beside it to boost the Kitchen.
    const c = withPieces({
      diningRoom: {
        effects: [
          {
            kind: 'requires',
            condition: { touching: { feature: 'tree' } },
            blocksPlacement: false,
          },
          { kind: 'aura', match: { piece: ['kitchen', 'livingRoom'] }, scope: 'adjacent', pct: 50 },
        ],
      },
    });
    const placements: Placement[] = [
      ['kitchen', 0, 0],
      ['diningRoom', 2, 0],
    ];
    const unmet = tallyAt(c, emptyRows(6, 6), placements);
    expect(scoreOf(unmet, 2).unmet).toBe('touching a Tree');
    // The Kitchen still counts the Dining Room as a neighbor (+2), but gets no +50%.
    expect(scoreOf(unmet, 1)).toMatchObject({ points: 2, pct: 0, earned: 2 });
    expect(scoreOf(unmet, 1).lines.some((l) => l.op === 'pct')).toBe(false);
    const met = tallyAt(c, ['....T.', ...emptyRows(6, 5)], placements);
    expect(scoreOf(met, 2).unmet).toBeUndefined();
    expect(scoreOf(met, 1)).toMatchObject({ points: 2, pct: 50, earned: 3 });
  });

  it('an unmet piece still counts for sets', () => {
    const c = withPieces({
      bathroom: {
        effects: [
          {
            kind: 'requires',
            condition: { touching: { feature: 'tree' } },
            blocksPlacement: false,
          },
          { kind: 'neighbor', match: { piece: 'bedroom' }, amount: 3, max: 1 },
        ],
      },
    });
    const t = tallyAt(c, emptyRows(8, 6), [
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
      ['bedroom', 3, 0],
    ]);
    expect(scoreOf(t, 2).earned).toBe(0);
    expect(scoreOf(t, 2).unmet).toBeDefined();
    expect(t.sets.map((s) => s.set)).toEqual(['jackAndJill']);
  });

  it('a placement-blocking requirement that breaks later also earns nothing', () => {
    // A Driveway in the front yard that touches neither the street nor another Driveway.
    const t = tallyAt(C, emptyRows(6, 8), [['driveway', 2, 4]]);
    expect(scoreOf(t, 1)).toMatchObject({
      earned: 0,
      unmet: 'touching the street or a Driveway',
    });
  });
});

describe('conditional', () => {
  it('Flower Bed: +2 more in the front yard only', () => {
    // The Bedroom's front row is row 3; the front yard is rows 4 and nearer the street.
    const t = tallyAt(C, emptyRows(6, 8), [
      ['bedroom', 0, 2],
      ['flowerBed', 5, 6], // front yard
      ['flowerBed', 5, 0], // back yard
      ['flowerBed', 5, 3], // the house's front row: a side yard, so back yard
    ]);
    expect(scoreOf(t, 2).earned).toBe(3);
    expect(scoreOf(t, 2).lines).toEqual([
      { label: 'Every week', op: 'add', value: 1, from: [] },
      { label: 'Every week (in the front yard)', op: 'add', value: 2, from: [] },
    ]);
    expect(scoreOf(t, 3).earned).toBe(1);
    expect(scoreOf(t, 3).lines).toEqual([{ label: 'Every week', op: 'add', value: 1, from: [] }]);
    expect(scoreOf(t, 4).earned).toBe(1);
  });

  it('Flower Bed: all yard is front yard before the first room', () => {
    expect(scoreOf(tallyAt(C, emptyRows(6, 8), [['flowerBed', 2, 0]]), 1).earned).toBe(3);
  });

  it('Driveway: +1 in the front yard', () => {
    // The Bedroom's front row is row 1. A 5-tile Driveway up the side (rows 3–7) is all front
    // yard; a Driveway above it (rows 0–2) touches it but isn't wholly in the front yard.
    const t = tallyAt(C, emptyRows(6, 8), [
      ['bedroom', 0, 0],
      ['driveway', 5, 3, 1, LONG],
      ['driveway', 5, 0, 1],
    ]);
    expect(scoreOf(t, 2)).toMatchObject({ earned: 1 });
    expect(scoreOf(t, 2).unmet).toBeUndefined();
    expect(scoreOf(t, 2).lines).toEqual([
      { label: 'Every week (in the front yard)', op: 'add', value: 1, from: [] },
    ]);
    expect(scoreOf(t, 3)).toMatchObject({ earned: 0, lines: [] });
    expect(scoreOf(t, 3).unmet).toBeUndefined();
  });

  it('Driveway: a house built up to the street leaves no front yard', () => {
    const t = tallyAt(C, emptyRows(6, 4), [
      ['bedroom', 0, 2],
      ['driveway', 3, 3],
    ]);
    expect(scoreOf(t, 2)).toMatchObject({ earned: 0 });
    expect(scoreOf(t, 2).unmet).toBeUndefined();
  });

  it('the inner effect can be any kind: a conditional rhythm', () => {
    const c = withPieces({
      closet: {
        effects: [
          {
            kind: 'conditional',
            when: { touching: { feature: 'tree' } },
            effect: { kind: 'rhythm', every: 2, amount: 4 },
          },
        ],
      },
    });
    const rows = ['.T..', ...emptyRows(4, 3)];
    expect(earnedByWeek(c, rows, [['closet', 0, 0]], 1, [1, 2, 3, 4])).toEqual([0, 4, 0, 4]);
    expect(earnedByWeek(c, emptyRows(4, 4), [['closet', 0, 0]], 1, [1, 2, 3, 4])).toEqual([
      0, 0, 0, 0,
    ]);
    expect(scoreOf(tallyAt(c, rows, [['closet', 0, 0]], 2), 1).lines).toEqual([
      { label: 'Every 2nd week (touching a Tree)', op: 'add', value: 4, from: [] },
    ]);
  });
});

describe('transform', () => {
  it('has no effect on the tally: a Sapling earns its steady 1, before and after its timer', () => {
    for (const week of [1, 4, 5, 9]) {
      const s = scoreOf(tallyAt(C, emptyRows(4, 4), [['sapling', 0, 0]], week), 1);
      expect(s.earned).toBe(1);
      expect(s.lines).toEqual([{ label: 'Every week', op: 'add', value: 1, from: [] }]);
    }
  });
});

// ---------------------------------------------------------------------------------------
// Placement.

describe('placement: building over the creek', () => {
  // A creek across row 4; the street is below row 6.
  const rows = ['........', '........', '........', '........', 'CCCCCCCC', '........', '........'];

  it('lets a Driveway (canCover) cross the creek, which stays', () => {
    const r = check(C, rows, [], 'driveway', 2, 4, 1);
    expect(r.legal).toBe(true);
    expect(r.reason).toBeUndefined();
    expect(r.clearedTrees).toEqual([]); // the creek isn't cleared: it gets a culvert
    expect(check(C, rows, [], 'driveway', 2, 2, 1, LONG).legal).toBe(true);
  });

  it('lets nothing else onto the creek', () => {
    const covers = Object.values(C.pieces).filter((d) => d.canCover?.includes('creek'));
    expect(covers.map((d) => d.id).sort()).toEqual(['driveway']);
    const others = Object.values(C.pieces).filter((d) => !d.canCover);
    expect(others.length).toBeGreaterThan(10);
    for (const def of others) {
      // Put the shape's first cell on the creek at (2, 4).
      const first = placedCells(def.shape, 0, 0, 0)[0]!;
      const r = check(C, rows, [], def.id, 2 - first.x, 4 - first.y);
      expect({ id: def.id, reason: r.reason }).toEqual({ id: def.id, reason: REASONS.creek });
    }
  });

  it('doesn’t let a Driveway onto the pond or a boulder', () => {
    const lot = [
      '........',
      '........',
      '........',
      '........',
      '..PP.B..',
      '........',
      '........',
    ];
    expect(check(C, lot, [], 'driveway', 2, 4, 1).reason).toBe(REASONS.pond);
    expect(check(C, lot, [], 'driveway', 5, 4, 1).reason).toBe(REASONS.boulder);
  });
});

describe('placement: the Garage', () => {
  const rows = emptyRows(8, 6);
  const reason = 'Garage must be built touching the street or a Driveway.';

  it('must touch the street or a Driveway, with a readable reason', () => {
    expect(check(C, rows, [], 'garage', 0, 0)).toMatchObject({ legal: false, reason });
    expect(check(C, rows, [], 'garage', 0, 4).legal).toBe(true); // on the street
    // Beside a Driveway that runs to the street.
    expect(check(C, rows, [['driveway', 2, 3, 1]], 'garage', 0, 2).legal).toBe(true);
  });

  it('touches a Driveway pack of any shape, along any of its tiles', () => {
    // A 5-tile pack up from the street; the Garage touches only its top tile.
    expect(check(C, rows, [['driveway', 2, 1, 1, LONG]], 'garage', 0, 0).legal).toBe(true);
    // An L of 6 along the street and up the side: (2..5, 5) and (5, 3..4). The Garage at
    // (4..5, 1..2) touches only its top tile.
    const bend: Placement = ['driveway', 2, 3, 0, ['...#', '...#', '####']];
    expect(check(C, rows, [bend], 'garage', 4, 1).legal).toBe(true);
    expect(check(C, rows, [bend], 'garage', 0, 0).reason).toBe(reason);
  });

  it('must also touch the house', () => {
    const house: Placement[] = [['bedroom', 4, 2]];
    expect(check(C, rows, house, 'garage', 4, 4).legal).toBe(true); // the house and the street
    expect(check(C, rows, house, 'garage', 0, 4).reason).toBe(roomToo('Garage'));
    expect(check(C, rows, house, 'garage', 6, 2).reason).toBe(reason); // the house only
  });
});

describe('placement: the Driveway', () => {
  const rows = emptyRows(8, 6);

  it('must touch the street or another Driveway', () => {
    expect(check(C, rows, [], 'driveway', 0, 0)).toMatchObject({
      legal: false,
      reason: 'Driveway must be built touching the street or a Driveway.',
    });
    expect(check(C, rows, [], 'driveway', 0, 5).legal).toBe(true);
    expect(check(C, rows, [['driveway', 7, 3, 1]], 'driveway', 4, 3).legal).toBe(true);
    // A Garage isn't a Driveway.
    expect(check(C, rows, [['garage', 0, 0]], 'driveway', 2, 0).legal).toBe(false);
  });

  it('chains packs of any shape, both ways', () => {
    // A Driveway off a 5-tile one.
    expect(check(C, rows, [['driveway', 7, 1, 1, LONG]], 'driveway', 4, 1).legal).toBe(true);
    // A 5-tile one off a Driveway, and alone.
    expect(check(C, rows, [['driveway', 7, 3, 1]], 'driveway', 2, 3, 0, LONG).legal).toBe(true);
    expect(check(C, rows, [], 'driveway', 0, 0, 0, LONG)).toMatchObject({
      legal: false,
      reason: 'Driveway must be built touching the street or a Driveway.',
    });
    // An L off a Driveway, touching it with one tile: (7, 2) sits on the Driveway's top.
    const bend = ['...#', '####'];
    expect(check(C, rows, [['driveway', 7, 3, 1]], 'driveway', 4, 1, 0, bend).legal).toBe(true);
    expect(check(C, rows, [['driveway', 7, 3, 1]], 'driveway', 3, 0, 0, bend).legal).toBe(false);
  });
});

describe('placement: the Treehouse', () => {
  const reason = 'Treehouse must be built touching a Tree.';

  it('must touch a Tree', () => {
    const rows = ['......', '......', '..T...', '......', '......', '......'];
    expect(check(C, rows, [], 'treehouse', 0, 2)).toMatchObject({ legal: true, clearedTrees: [] });
    expect(check(C, emptyRows(6, 6), [], 'treehouse', 0, 2)).toMatchObject({
      legal: false,
      reason,
    });
  });

  it('is judged after placement: building over the only Tree fails', () => {
    const rows = ['......', '......', '..T...', '......', '......', '......'];
    expect(check(C, rows, [], 'treehouse', 2, 2)).toMatchObject({ legal: false, reason });
    expect(check(C, rows, [], 'treehouse', 1, 1)).toMatchObject({ legal: false, reason });
  });

  it('can clear one Tree while touching another', () => {
    const rows = ['......', '......', '..T.T.', '......', '......', '......'];
    expect(check(C, rows, [], 'treehouse', 2, 2)).toMatchObject({
      legal: true,
      clearedTrees: [{ x: 2, y: 2 }],
    });
  });
});

describe('placement: the Doghouse', () => {
  it('has a requirement that doesn’t block, so it goes anywhere legal', () => {
    expect(check(C, emptyRows(6, 6), [], 'doghouse', 0, 0)).toMatchObject({ legal: true });
    expect(check(C, emptyRows(6, 6), [], 'doghouse', 3, 5).reason).toBeUndefined();
    // Over a Tree, which it clears.
    expect(check(C, ['T.....', ...emptyRows(6, 5)], [], 'doghouse', 0, 0)).toMatchObject({
      legal: true,
      clearedTrees: [{ x: 0, y: 0 }],
    });
  });

  it('is still refused on water, a boulder, or another piece', () => {
    const rows = ['.P....', '.B....', '..C...', '......'];
    expect(check(C, rows, [], 'doghouse', 1, 0).reason).toBe(REASONS.pond);
    expect(check(C, rows, [], 'doghouse', 1, 1).reason).toBe(REASONS.boulder);
    expect(check(C, rows, [], 'doghouse', 2, 2).reason).toBe(REASONS.creek);
    expect(check(C, rows, [['lawn', 4, 0]], 'doghouse', 4, 1).reason).toBe(REASONS.occupied);
  });
});
