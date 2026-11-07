// House conditions (src/rules/conditions.ts; implementation-plan.md §5; house-systems-review.md
// §4 and its Appendix, "The house rules as simulated"): every HouseCondition kind on small
// hand-built houses, the checklist's progress parts, the type limits behind Renovate and the
// half-weight draws, and each kind's card text. The houses use TEST_CONTENT, so tuning the real
// numbers never breaks these. houseFrom() places pieces unchecked and numbers them 1, 2, … in
// order; fixtures go in with withFixture(), as an install would.

import { describe, expect, it } from 'vitest';
import type {
  FixtureId,
  HouseCondition,
  PieceId,
  ProgressPart,
  Selector,
  SpecDef,
  TypeLimit,
} from './index.ts';
import {
  countMatching,
  currentStage,
  fillPct,
  limitReached,
  meetsHouse,
  outlineOf,
  progressOf,
  typeLimits,
  typesAtLimit,
  type CondCtx,
  type NounFn,
} from './conditions.ts';
import { withFixture } from './fixtures.ts';
import { computeLayout, largestFencedYard, type Layout } from './layout.ts';
import { matchesPiece, rootType } from './selectors.ts';
import { houseConditionText, selectorText, specText } from './text.ts';
import {
  emptyRows,
  houseFrom,
  TEST_BALANCE,
  TEST_CONTENT as C,
  TEST_FIXTURES,
  withClient,
  type Placement,
} from './testing.ts';

// ---------------------------------------------------------------------------------------
// Helpers.

type Staged = Extract<HouseCondition, { stages: unknown }>;
type OutlineRule = Extract<HouseCondition, { outline: unknown }>['outline'];
type VarietyRule = Extract<HouseCondition, { variety: unknown }>['variety'];
type Installs = readonly (readonly [uid: number, id: FixtureId])[];

/** A 12 × 8 empty lot. The street runs below row 7. */
const LOT = emptyRows(12, 8);

/** The layout of a house on a lot, with fixtures installed (in week 1) by uid. */
function layoutOf(
  placements: readonly Placement[],
  fixtures: Installs = [],
  rows: readonly string[] = LOT,
): Layout {
  let house = houseFrom(C, rows, placements);
  for (const [uid, id] of fixtures) house = withFixture(house, uid, id, 1);
  return computeLayout(C, house);
}

/** n copies of a piece in a row at y: x = x0, x0 + step, … (2 × 2 pieces touch at step 2). */
function row(id: PieceId, n: number, y = 0, x0 = 0, step = 2): Placement[] {
  return Array.from({ length: n }, (_, k): Placement => [id, x0 + k * step, y]);
}

/** Bedrooms along the top (uids 1, 2, …), then Bathrooms side by side below them. */
function household(bedrooms: number, bathrooms: number, fixtures: Installs = []): Layout {
  return layoutOf([...row('bedroom', bedrooms), ...row('bathroom', bathrooms, 4, 0, 1)], fixtures);
}

const P0: CondCtx = { phase: 0 };
const at = (phase: number): CondCtx => ({ phase });
/** A change order accepted before the piece with this uid went in. */
const since = (sinceUid: number, demolished = 0): CondCtx => ({
  phase: 0,
  order: { sinceUid, demolished },
});

function meets(layout: Layout, cond: HouseCondition, ctx: CondCtx = P0): boolean {
  return meetsHouse(C, layout, cond, ctx);
}

/** The checklist's nouns, worded as run.ts words them: "Bedrooms", "room". */
const noun: NounFn = (sel, n) => selectorText(C, sel, n === 1 ? 'one' : 'some');

function progress(layout: Layout, cond: HouseCondition, ctx: CondCtx = P0): ProgressPart[] {
  return progressOf(C, layout, cond, ctx, noun);
}

function spec(id: string, condition: HouseCondition, text?: string): SpecDef {
  const base: SpecDef = { id, name: id, group: 'wishes', condition };
  return text === undefined ? base : { ...base, text };
}

const sorted = (items: Iterable<string>) => [...items].sort();

const BEDROOM: Selector = { piece: 'bedroom' };
const BATHROOM: Selector = { piece: 'bathroom' };
const KITCHEN: Selector = { piece: 'kitchen' };
const DINING: Selector = { piece: 'diningRoom' };
const LIVING: Selector = { piece: 'livingRoom' };
const POOL: Selector = { piece: 'pool' };
const LAWN: Selector = { piece: 'lawn' };
const ROOM: Selector = { property: 'room' };
const YARD: Selector = { property: 'yard' };

/** The house rules' Bathroom line: a Bathroom for every two Bedrooms, at least one. */
const BATH_RATIO: HouseCondition = { ratio: { count: BATHROOM, per: BEDROOM, every: 2, min: 1 } };

/** Cozy's second half: no room touching fewer than 2 rooms (links count). */
const EVERY_ROOM_TOUCHES_TWO: HouseCondition = {
  none: { all: [ROOM, { not: { touching: ROOM, min: 2 } }] },
};

/** Room for everyone, stepping up from Foundation (phase 1). */
const GROWING: Staged = {
  stages: [
    { fromPhase: 0, condition: { count: BEDROOM, min: 2, max: 3 } },
    { fromPhase: 1, condition: { count: BEDROOM, min: 3, max: 4 } },
  ],
};

/** Under one roof's shape, at 3+ rooms unless a test says otherwise. */
const roof = (o: Partial<OutlineRule> = {}): HouseCondition => ({
  outline: { minRooms: 3, minFillPct: 60, maxAspect: 2, ...o },
});

/** A tidy yard in small numbers: 4+ yard pieces, none of a type more than twice. */
const tidy = (o: Partial<VarietyRule> = {}): HouseCondition => ({
  variety: { of: YARD, min: 4, maxEach: 2, ...o },
});

/**
 * A Living Room (2 × 3) with three Bathrooms along its foot: 4 rooms, 9 tiles in a 5 × 3 box,
 * exactly 60% full.
 *   LL...
 *   LL...
 *   LLbbb
 */
const SIXTY: Placement[] = [
  ['livingRoom', 0, 0],
  ['bathroom', 2, 2],
  ['bathroom', 3, 2],
  ['bathroom', 4, 2],
];

/**
 * Two fenced yards behind a row of Bedrooms, split by two Bathrooms (b) and closed off from the
 * street by a Fence (F) and two more Bathrooms:
 *   BBBBBB
 *   BBBBBB
 *   ..b...   left: 4 tiles; right: 6
 *   ..b...
 *   FFFFbb
 */
const twoYards = () =>
  layoutOf(
    [
      ['bedroom', 0, 0],
      ['bedroom', 2, 0],
      ['bedroom', 4, 0],
      ['bathroom', 2, 2],
      ['bathroom', 2, 3],
      ['fence', 0, 4],
      ['bathroom', 4, 4],
      ['bathroom', 5, 4],
    ],
    [],
    emptyRows(6, 5),
  );

/** A Suite: Bedroom, Bathroom, and Closet, touching in a row. */
const SUITE: Placement[] = [
  ['bedroom', 0, 0],
  ['bathroom', 2, 0],
  ['closet', 3, 0],
];

// ---------------------------------------------------------------------------------------
// The condition kinds.

describe('count', () => {
  const bedrooms = (n: number) => layoutOf(row('bedroom', n));
  const kitchens = (n: number) => layoutOf(row('kitchen', n));

  it('holds from a min up, and from none up to a max', () => {
    const atLeast2: HouseCondition = { count: BEDROOM, min: 2 };
    expect([0, 1, 2, 5].map((n) => meets(bedrooms(n), atLeast2))).toEqual([
      false,
      false,
      true,
      true,
    ]);
    const atMost1: HouseCondition = { count: KITCHEN, max: 1 };
    expect([0, 1, 2].map((n) => meets(kitchens(n), atMost1))).toEqual([true, true, false]);
  });

  it('holds inside both bounds, ends included; at exactly min when min = max; always with neither', () => {
    const range: HouseCondition = { count: BEDROOM, min: 2, max: 3 };
    expect([1, 2, 3, 4].map((n) => meets(bedrooms(n), range))).toEqual([false, true, true, false]);
    const oneKitchen: HouseCondition = { count: KITCHEN, min: 1, max: 1 };
    expect([0, 1, 2].map((n) => meets(kitchens(n), oneKitchen))).toEqual([false, true, false]);
    expect(meets(bedrooms(0), { count: BEDROOM })).toBe(true);
    expect(meets(bedrooms(4), { count: BEDROOM })).toBe(true);
  });
});

describe('counting weights', () => {
  it('counts a Bedroom with Bunk Beds twice for { piece: bedroom }', () => {
    // The test Bunk Beds make their host count as 2 Bedrooms.
    expect(TEST_FIXTURES.bunkBeds.modifiers).toEqual([
      { kind: 'countsAs', target: { host: true }, as: 'bedroom', times: 2 },
    ]);
    const layout = layoutOf(row('bedroom', 2), [[1, 'bunkBeds']]);
    expect(countMatching(C, layout, BEDROOM)).toBe(3); // 2 (Bunk Beds) + 1
    expect(meets(layout, { count: BEDROOM, min: 3, max: 3 })).toBe(true);
    expect(meets(layout, { count: BEDROOM, max: 2 })).toBe(false);
  });

  it('counts a Kitchen with a Kitchen Island once as a Kitchen, and not as a Dining Room', () => {
    expect(TEST_FIXTURES.kitchenIsland.modifiers[0]).toEqual({
      kind: 'countsAs',
      target: { host: true },
      as: 'diningRoom',
    });
    const layout = layoutOf([['kitchen', 0, 0]], [[1, 'kitchenIsland']]);
    // The Island makes it a Dining Room for effects and selectors…
    expect(matchesPiece(C, layout, DINING, 1)).toBe(true);
    // …but it adds no room to a count.
    expect(countMatching(C, layout, DINING)).toBe(0);
    expect(countMatching(C, layout, KITCHEN)).toBe(1);
    expect(countMatching(C, layout, { piece: ['kitchen', 'diningRoom'] })).toBe(1);
    expect(meets(layout, { count: DINING, min: 1 })).toBe(false);
    expect(meets(layout, { count: KITCHEN, min: 1, max: 1 })).toBe(true);
  });

  it('matches a Kitchen with a Kitchen Island by its own card in adjacentPair, group, and variety too', () => {
    // A Kitchen with an Island (uid 1) beside a plain Kitchen (uid 2): neither is a Dining Room.
    const island = layoutOf(
      [
        ['kitchen', 0, 0],
        ['kitchen', 2, 0],
      ],
      [[1, 'kitchenIsland']],
    );
    expect(matchesPiece(C, island, DINING, 1)).toBe(true);
    expect(meets(island, { adjacentPair: [KITCHEN, DINING] })).toBe(false);
    expect(meets(island, { group: DINING, minTiles: 1 })).toBe(false);
    expect(meets(island, { variety: { of: DINING, min: 1, maxEach: 1 } })).toBe(false);
    // A real Dining Room beside the Kitchen is one for all three.
    const real = layoutOf([
      ['diningRoom', 0, 0],
      ['kitchen', 2, 0],
    ]);
    expect(meets(real, { adjacentPair: [KITCHEN, DINING] })).toBe(true);
    expect(meets(real, { group: DINING, minTiles: 4 })).toBe(true);
    expect(meets(real, { variety: { of: DINING, min: 1, maxEach: 1 } })).toBe(true);
  });

  it('counts an L-Kitchen as a Kitchen', () => {
    const lKitchen = layoutOf([['lKitchen', 0, 0]]);
    expect(countMatching(C, lKitchen, KITCHEN)).toBe(1);
    expect(meets(lKitchen, { count: KITCHEN, min: 1, max: 1 })).toBe(true);
    // A Kitchen and an L-Kitchen are two Kitchens, and one L-Kitchen.
    const both = layoutOf([
      ['kitchen', 0, 0],
      ['lKitchen', 3, 0],
    ]);
    expect(countMatching(C, both, KITCHEN)).toBe(2);
    expect(countMatching(C, both, { piece: 'lKitchen' })).toBe(1);
    expect(meets(both, { count: KITCHEN, min: 1, max: 1 })).toBe(false);
  });

  it('weighs a { piece } inside a top-level all the same way', () => {
    // Bedrooms 1 and 3 share the Bathroom (2); Bedroom 4 is off on its own. Bunk Beds in 1 and 4.
    const layout = layoutOf(
      [
        ['bedroom', 0, 0],
        ['bathroom', 2, 0],
        ['bedroom', 3, 0],
        ['bedroom', 8, 0],
      ],
      [
        [1, 'bunkBeds'],
        [4, 'bunkBeds'],
      ],
    );
    const sel: Selector = { all: [BEDROOM, { touching: BATHROOM }] };
    // 2 (Bedroom 1, Bunk Beds) + 1 (Bedroom 3) + 0 (Bedroom 4 touches no Bathroom)
    expect(countMatching(C, layout, sel)).toBe(3);
    // Wherever the { piece } sits in the all.
    expect(countMatching(C, layout, { all: [{ touching: BATHROOM }, BEDROOM] })).toBe(3);
    expect(meets(layout, { count: sel, min: 3 })).toBe(true);
  });

  it('counts each match once for a selector that names no piece type directly', () => {
    const layout = layoutOf(row('bedroom', 2), [[1, 'bunkBeds']]);
    // { piece }: 2 + 1. A property, a tag, any, not, and 'all': 1 each.
    expect(countMatching(C, layout, BEDROOM)).toBe(3);
    expect(countMatching(C, layout, ROOM)).toBe(2);
    expect(countMatching(C, layout, { tag: 'Quiet' })).toBe(2);
    expect(countMatching(C, layout, { any: [BEDROOM] })).toBe(2);
    expect(countMatching(C, layout, { not: BATHROOM })).toBe(2);
    expect(countMatching(C, layout, 'all')).toBe(2);
  });

  it('never counts lot features', () => {
    // Trees (Quiet) and the Pond around a Bedroom: only the Bedroom counts.
    const layout = layoutOf([['bedroom', 1, 0]], [], ['T.....', 'T.....', '..PP..', '......']);
    expect(countMatching(C, layout, { feature: 'tree' })).toBe(0);
    expect(countMatching(C, layout, { any: [{ feature: 'tree' }, { feature: 'pond' }] })).toBe(0);
    expect(countMatching(C, layout, { tag: 'Quiet' })).toBe(1);
    expect(meets(layout, { count: { feature: 'tree' }, min: 1 })).toBe(false);
  });
});

describe('countNew and demolishedSinceAccepted (M4b)', () => {
  it('countNew counts only pieces placed since the order, and never holds without one', () => {
    // Bedrooms 1–4; the order was accepted before Bedroom 3.
    const layout = layoutOf(row('bedroom', 4));
    expect(countMatching(C, layout, BEDROOM, 3)).toBe(2);
    expect(meets(layout, { countNew: BEDROOM, min: 2 }, since(3))).toBe(true);
    expect(meets(layout, { countNew: BEDROOM, min: 3 }, since(3))).toBe(false);
    expect(meets(layout, { count: BEDROOM, min: 4 }, since(3))).toBe(true); // count sees them all
    // No order: not even min 0 holds.
    expect(meets(layout, { countNew: BEDROOM, min: 1 })).toBe(false);
    expect(meets(layout, { countNew: BEDROOM, min: 0 })).toBe(false);
  });

  it('countNew weighs new pieces as count does: Bunk Beds in a new Bedroom count twice', () => {
    // The shared weighting (the design notes don't say whether countNew weighs; see the report).
    const layout = layoutOf(row('bedroom', 3), [
      [1, 'bunkBeds'],
      [3, 'bunkBeds'],
    ]);
    expect(countMatching(C, layout, BEDROOM, 3)).toBe(2); // Bedroom 3 alone, ×2
    expect(meets(layout, { countNew: BEDROOM, min: 2 }, since(3))).toBe(true);
  });

  it('demolishedSinceAccepted counts demolitions since the order, and none without one', () => {
    const layout = layoutOf([]);
    const cond: HouseCondition = { demolishedSinceAccepted: { min: 2 } };
    expect([1, 2, 3].map((d) => meets(layout, cond, since(1, d)))).toEqual([false, true, true]);
    expect(meets(layout, { demolishedSinceAccepted: { min: 1 } })).toBe(false);
  });
});

describe('none', () => {
  it('holds with no matching piece, and fails with one', () => {
    const cond: HouseCondition = { none: POOL };
    expect(meets(layoutOf(row('bedroom', 2)), cond)).toBe(true);
    const withPool = layoutOf([
      ['bedroom', 0, 0],
      ['pool', 4, 0],
    ]);
    expect(meets(withPool, cond)).toBe(false);
  });

  it('looks at pieces only, weighed as count does', () => {
    // A Tree (Quiet) beside a Kitchen (Social): lot features never break it.
    const layout = layoutOf([['kitchen', 1, 0]], [], ['T.....', '......', '......']);
    expect(meets(layout, { none: { feature: 'tree' } })).toBe(true);
    expect(meets(layout, { none: { tag: 'Quiet' } })).toBe(true);
    expect(meets(layout, { none: { tag: 'Social' } })).toBe(false);
    // A Kitchen with an Island is no Dining Room.
    expect(meets(layoutOf([['kitchen', 0, 0]], [[1, 'kitchenIsland']]), { none: DINING })).toBe(
      true,
    );
  });
});

describe('adjacentPair', () => {
  const PAIR: HouseCondition = { adjacentPair: [KITCHEN, DINING] };

  it('holds when some A touches some B, in either order, and fails when none does', () => {
    const side = layoutOf([
      ['kitchen', 0, 0],
      ['diningRoom', 2, 0],
    ]);
    expect(meets(side, PAIR)).toBe(true);
    expect(meets(side, { adjacentPair: [DINING, KITCHEN] })).toBe(true);
    // Corners don't touch.
    const corner = layoutOf([
      ['kitchen', 0, 0],
      ['diningRoom', 2, 2],
    ]);
    expect(meets(corner, PAIR)).toBe(false);
    expect(meets(layoutOf([['kitchen', 0, 0]]), PAIR)).toBe(false);
  });

  it('counts a Hallway link as touching', () => {
    // Kitchen | Hallway | Dining Room: linked through the Hallway, not touching.
    const layout = layoutOf([
      ['kitchen', 0, 0],
      ['hallway', 2, 0],
      ['diningRoom', 4, 0],
    ]);
    expect(layout.touching.get(1)).not.toContainEqual({ kind: 'piece', uid: 3 });
    expect(meets(layout, PAIR)).toBe(true);
  });

  it('never pairs a piece with itself', () => {
    const SOCIAL: Selector = { tag: 'Social' };
    const alone = layoutOf([['kitchen', 0, 0]]);
    expect(meets(alone, { adjacentPair: [SOCIAL, SOCIAL] })).toBe(false);
    const two = layoutOf([
      ['kitchen', 0, 0],
      ['diningRoom', 2, 0],
    ]);
    expect(meets(two, { adjacentPair: [SOCIAL, SOCIAL] })).toBe(true);
  });

  it('pairs pieces only, never a lot feature', () => {
    const layout = layoutOf([['bedroom', 1, 0]], [], ['T.....', '......', '......']);
    expect(layout.neighbors.get(1)).toContainEqual({
      kind: 'terrain',
      feature: 'tree',
      x: 0,
      y: 0,
    });
    expect(meets(layout, { adjacentPair: [BEDROOM, { feature: 'tree' }] })).toBe(false);
  });

  // A Bedroom's scoring neighbors drop the Hallway it touches (a connector isn't a neighbor),
  // but the Hallway's own list keeps the Bedroom. adjacentPair looks both ways round, so the
  // pair's order never matters.
  it('reads the same in both orders when one side is a Hallway', () => {
    const layout = layoutOf([
      ['bedroom', 0, 0],
      ['hallway', 2, 0],
    ]);
    expect(layout.neighbors.get(1)).not.toContainEqual({ kind: 'piece', uid: 2 });
    expect(layout.neighbors.get(2)).toContainEqual({ kind: 'piece', uid: 1 });
    const HALLWAY: Selector = { piece: 'hallway' };
    expect(meets(layout, { adjacentPair: [BEDROOM, HALLWAY] })).toBe(true);
    expect(meets(layout, { adjacentPair: [HALLWAY, BEDROOM] })).toBe(true);
  });
});

describe('fencedYardTiles', () => {
  it('reads the largest single fenced yard: two yards never add up', () => {
    const layout = twoYards();
    expect([...layout.fencedSizes].sort((a, b) => a - b)).toEqual([4, 6]);
    expect(meets(layout, { fencedYardTiles: { min: 6 } })).toBe(true);
    expect(meets(layout, { fencedYardTiles: { min: 7 } })).toBe(false);
    expect(meets(layout, { fencedYardTiles: { min: 10 } })).toBe(false); // not 4 + 6
  });

  it('needs a yard of fencedYardMin tiles (4) for it to be fenced at all', () => {
    expect(TEST_BALANCE.fencedYardMin).toBe(4);
    // BBBB / BBBB / ...b / FFFF: a pocket of 3 tiles isn't a fenced yard.
    const three = layoutOf(
      [
        ['bedroom', 0, 0],
        ['bedroom', 2, 0],
        ['bathroom', 3, 2],
        ['fence', 0, 3],
      ],
      [],
      emptyRows(4, 4),
    );
    expect(largestFencedYard(three)).toBe(0);
    expect(meets(three, { fencedYardTiles: { min: 3 } })).toBe(false);
    // Without the Bathroom it's 4 tiles, and it is.
    const four = layoutOf(
      [
        ['bedroom', 0, 0],
        ['bedroom', 2, 0],
        ['fence', 0, 3],
      ],
      [],
      emptyRows(4, 4),
    );
    expect(meets(four, { fencedYardTiles: { min: 4 } })).toBe(true);
    expect(meets(four, { fencedYardTiles: { min: 5 } })).toBe(false);
    // And with no Fence there's no fenced yard.
    expect(meets(layoutOf(row('bedroom', 2)), { fencedYardTiles: { min: 1 } })).toBe(false);
  });
});

describe('group', () => {
  it('measures the largest physically connected group, in tiles, never joined by links', () => {
    // Lawns 1 and 2 touch (8 tiles); Lawn 3 stands apart (4).
    const lawns = layoutOf([
      ['lawn', 0, 0],
      ['lawn', 2, 0],
      ['lawn', 6, 0],
    ]);
    expect(meets(lawns, { group: LAWN, minTiles: 8 })).toBe(true);
    expect(meets(lawns, { group: LAWN, minTiles: 9 })).toBe(false); // 8 + 4 aren't one group
    // Bedroom | Hallway | Bedroom: linked rooms, but two groups of 4 Bedroom tiles.
    const linked = layoutOf([
      ['bedroom', 0, 0],
      ['hallway', 2, 0],
      ['bedroom', 4, 0],
    ]);
    expect(linked.links.get(1)?.has(3)).toBe(true);
    expect(meets(linked, { group: BEDROOM, minTiles: 4 })).toBe(true);
    expect(meets(linked, { group: BEDROOM, minTiles: 5 })).toBe(false);
    // A Hallway that matches joins its group physically: 4 + 2 + 4.
    expect(meets(linked, { group: { property: 'indoor' }, minTiles: 10 })).toBe(true);
  });
});

describe('set', () => {
  it('counts held instances, needing one by default', () => {
    const one = layoutOf(SUITE);
    expect(meets(one, { set: 'suite' })).toBe(true);
    expect(meets(one, { set: 'suite', min: 2 })).toBe(false);
    expect(meets(one, { set: 'jackAndJill' })).toBe(false);
    const two = layoutOf([...SUITE, ['bedroom', 0, 3], ['bathroom', 2, 3], ['closet', 3, 3]]);
    expect(meets(two, { set: 'suite', min: 2 })).toBe(true);
  });

  it('fails when the members are there but the set doesn’t hold', () => {
    // The Closet stands apart, so the Suite isn't connected.
    const apart = layoutOf([
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
      ['closet', 5, 0],
    ]);
    expect(meets(apart, { set: 'suite' })).toBe(false);
  });
});

describe('ratio', () => {
  /** The fewest Bathrooms that meet the condition for this many Bedrooms. */
  function fewest(cond: HouseCondition, bedrooms: number, fixtures: Installs = []): number {
    for (let k = 0; k <= 6; k++) if (meets(household(bedrooms, k, fixtures), cond)) return k;
    return -1;
  }

  it('needs a Bathroom for every 2 Bedrooms, rounded up, and at least 1, with no ceiling', () => {
    // max(1, ⌈b ÷ 2⌉): 0 → 1, 1 → 1, 2 → 1, 3 → 2, 4 → 2, 5 → 3.
    expect([0, 1, 2, 3, 4, 5].map((b) => fewest(BATH_RATIO, b))).toEqual([1, 1, 1, 2, 2, 3]);
    expect(meets(household(3, 1), BATH_RATIO)).toBe(false);
    expect(meets(household(5, 2), BATH_RATIO)).toBe(false);
    expect(meets(household(2, 6), BATH_RATIO)).toBe(true);
  });

  it('counts Bunk Beds on the per side', () => {
    // Two Bedrooms, one with Bunk Beds: ⌈(2 + 1) ÷ 2⌉ = 2 Bathrooms, against 1 without.
    expect(fewest(BATH_RATIO, 2)).toBe(1);
    expect(fewest(BATH_RATIO, 2, [[1, 'bunkBeds']])).toBe(2);
  });

  it('without a min needs nothing for no Bedrooms; with every 1, one each', () => {
    const half: HouseCondition = { ratio: { count: BATHROOM, per: BEDROOM, every: 2 } };
    expect([0, 1, 2, 3].map((b) => fewest(half, b))).toEqual([0, 1, 1, 2]);
    const each: HouseCondition = { ratio: { count: BATHROOM, per: BEDROOM, every: 1 } };
    expect([0, 1, 3].map((b) => fewest(each, b))).toEqual([0, 1, 3]);
  });
});

describe('outline', () => {
  it('counts rooms, not connectors, and fills with every indoor tile, Hallways included', () => {
    // Bedroom (Bunk Beds) | Hallway | Bedroom, and a Lawn: 2 rooms, 4 + 2 + 4 = 10 indoor tiles
    // in a 6 × 2 box. Bunk Beds don't make a second room, and the Lawn isn't indoors.
    const layout = layoutOf(
      [
        ['bedroom', 0, 0],
        ['hallway', 2, 0],
        ['bedroom', 4, 0],
        ['lawn', 6, 0],
      ],
      [[1, 'bunkBeds']],
    );
    expect(outlineOf(C, layout)).toEqual({ rooms: 2, tiles: 10, w: 6, h: 2 });
    expect(fillPct(outlineOf(C, layout))).toBe(83); // ⌊1000 ÷ 12⌋
    expect(outlineOf(C, layout)).toBe(outlineOf(C, layout)); // cached per layout
  });

  it('passes at exactly the minimum fill, and fails one tile short', () => {
    const full = layoutOf(SIXTY);
    expect(outlineOf(C, full)).toEqual({ rooms: 4, tiles: 9, w: 5, h: 3 });
    expect(meets(full, roof())).toBe(true); // 9 × 100 = 60 × 15
    // Without the middle Bathroom: 8 tiles in the same box.
    const short = layoutOf(SIXTY.filter(([, x]) => x !== 3));
    expect(outlineOf(C, short)).toEqual({ rooms: 3, tiles: 8, w: 5, h: 3 });
    expect(meets(short, roof())).toBe(false); // 800 < 900
  });

  it('holds a box of exactly 2:1 either way round, and fails one tile longer', () => {
    // A Bedroom and four Bathrooms fill a 4 × 2 box; a fifth Bathroom makes it 5 × 2.
    const block: Placement[] = [
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
      ['bathroom', 3, 0],
      ['bathroom', 2, 1],
      ['bathroom', 3, 1],
    ];
    const wide = layoutOf(block);
    expect(outlineOf(C, wide)).toMatchObject({ w: 4, h: 2 });
    expect(meets(wide, roof())).toBe(true); // 4 ≤ 2 × 2
    const wider = layoutOf([...block, ['bathroom', 4, 0]]);
    expect(outlineOf(C, wider)).toMatchObject({ tiles: 9, w: 5, h: 2 });
    expect(meets(wider, roof())).toBe(false); // 5 > 4, though 90% full
    expect(meets(wider, roof({ maxAspect: 3 }))).toBe(true); // 5 ≤ 6
    // Standing up: 2 × 4 holds, 2 × 5 doesn't.
    const column: Placement[] = [
      ['bedroom', 0, 0],
      ['bathroom', 0, 2],
      ['bathroom', 1, 2],
      ['bathroom', 0, 3],
      ['bathroom', 1, 3],
    ];
    const tall = layoutOf(column);
    expect(outlineOf(C, tall)).toMatchObject({ w: 2, h: 4 });
    expect(meets(tall, roof())).toBe(true);
    const taller = layoutOf([...column, ['bathroom', 0, 4]]);
    expect(outlineOf(C, taller)).toMatchObject({ w: 2, h: 5 });
    expect(meets(taller, roof())).toBe(false);
  });

  it('needs minRooms, and no more than maxRooms when it has one', () => {
    // Bathrooms in a 3 × 3 block: 9 rooms; without the middle one, 8 (8 of 9 tiles).
    const block = (withMiddle: boolean) =>
      layoutOf(
        [0, 1, 2].flatMap((y) =>
          [0, 1, 2]
            .filter((x) => withMiddle || x !== 1 || y !== 1)
            .map((x): Placement => ['bathroom', x, y]),
        ),
      );
    const juniper = roof({ minRooms: 4, maxRooms: 8 });
    expect(outlineOf(C, block(true)).rooms).toBe(9);
    expect(meets(block(true), juniper)).toBe(false);
    expect(meets(block(false), juniper)).toBe(true);
    expect(meets(block(false), roof({ minRooms: 9 }))).toBe(false);
    expect(meets(block(true), roof({ minRooms: 9 }))).toBe(true); // no maxRooms, no ceiling
  });

  it('fails with no indoor tiles whatever the numbers, and fillPct rounds down', () => {
    const yard = layoutOf([
      ['lawn', 0, 0],
      ['patio', 3, 0],
    ]);
    expect(outlineOf(C, yard)).toEqual({ rooms: 0, tiles: 0, w: 0, h: 0 });
    expect(meets(yard, { outline: { minRooms: 0, minFillPct: 0, maxAspect: 2 } })).toBe(false);
    expect(fillPct(outlineOf(C, yard))).toBe(0);
    expect(fillPct({ rooms: 0, tiles: 9, w: 5, h: 3 })).toBe(60);
    expect(fillPct({ rooms: 0, tiles: 19, w: 8, h: 4 })).toBe(59); // 59.375
    expect(fillPct({ rooms: 0, tiles: 2, w: 3, h: 1 })).toBe(66);
    expect(fillPct({ rooms: 0, tiles: 4, w: 2, h: 2 })).toBe(100);
  });
});

describe('variety', () => {
  // Yard pieces spread over the lot, none touching.
  const FENCE: Placement = ['fence', 0, 0]; // x 0–3, y 0
  const FENCE_2: Placement = ['fence', 0, 2]; // x 0–3, y 2
  // A Fence pack in the L it suggests (D-102): (5,0) (5,1) (5,2) (6,2) (7,2).
  const L_FENCE: Placement = ['fence', 5, 0, 0, ['#..', '#..', '###']];
  const FLOWERS: Placement = ['flowerBed', 9, 0];
  const LAWN_1: Placement = ['lawn', 0, 4];
  const LAWN_2: Placement = ['lawn', 3, 4];
  const PATIO: Placement = ['patio', 6, 4];

  it('reads types by their root (Fence packs of any shape are one), up to maxEach of each', () => {
    // 2 Fences and an L-shaped one: three of one type, more than maxEach 2.
    expect(meets(layoutOf([FENCE, FENCE_2, L_FENCE, FLOWERS]), tidy())).toBe(false);
    // A Fence and an L-shaped one: two, which is fine.
    expect(meets(layoutOf([FENCE, L_FENCE, FLOWERS, LAWN_1]), tidy())).toBe(true);
    expect(meets(layoutOf([FENCE, FENCE_2, L_FENCE, LAWN_1]), tidy({ maxEach: 3 }))).toBe(true);
    // Shape variants share their root too: an L-Kitchen is a Kitchen.
    expect(rootType(C.pieces.lKitchen)).toBe('kitchen');
    const rooms = (...more: Placement[]) =>
      layoutOf([['kitchen', 0, 0], ['lKitchen', 2, 0], ['bedroom', 4, 0], ...more]);
    expect(meets(rooms(['closet', 6, 0]), tidy({ of: ROOM }))).toBe(true); // 2 Kitchens
    expect(meets(rooms(['kitchen', 6, 0]), tidy({ of: ROOM }))).toBe(false); // 3
  });

  it('counts exempt types toward min, but never against maxEach', () => {
    const fences = layoutOf([FENCE, FENCE_2, L_FENCE, FLOWERS]);
    expect(meets(fences, tidy({ exempt: { piece: 'fence' } }))).toBe(true); // 4 pieces
    expect(meets(fences, tidy({ exempt: { piece: 'fence' }, min: 5 }))).toBe(false); // 4 < 5
  });

  it('needs min pieces matching `of`, even with no repeats', () => {
    expect(meets(layoutOf([FLOWERS, LAWN_1, PATIO]), tidy())).toBe(false);
    // A Bedroom isn't a yard piece, so it doesn't make the 4th.
    expect(meets(layoutOf([FLOWERS, LAWN_1, PATIO, ['bedroom', 9, 4]]), tidy())).toBe(false);
    expect(meets(layoutOf([FLOWERS, LAWN_1, PATIO, LAWN_2]), tidy())).toBe(true);
  });
});

describe('stages', () => {
  it('applies the last stage whose phase has begun', () => {
    const two = layoutOf(row('bedroom', 2));
    const four = layoutOf(row('bedroom', 4));
    // 2–3 Bedrooms in phase 0, 3–4 from phase 1 on.
    expect([0, 1, 6].map((p) => meets(two, GROWING, at(p)))).toEqual([true, false, false]);
    expect([0, 1, 6].map((p) => meets(four, GROWING, at(p)))).toEqual([false, true, true]);
    // Between an earlier and a later stage, the latest begun.
    const [a, b, c]: HouseCondition[] = [
      { count: BEDROOM, min: 1 },
      { count: BEDROOM, min: 2 },
      { count: BEDROOM, min: 3 },
    ];
    const three: Staged = {
      stages: [
        { fromPhase: 0, condition: a! },
        { fromPhase: 2, condition: b! },
        { fromPhase: 4, condition: c! },
      ],
    };
    expect([0, 1, 2, 3, 4, 9].map((p) => currentStage(three, p))).toEqual([a, a, b, b, c, c]);
  });

  it('never holds before its first stage, or with no stages', () => {
    // From phase 1, a condition that always holds.
    const later: Staged = { stages: [{ fromPhase: 1, condition: { count: BEDROOM } }] };
    const layout = layoutOf([]);
    expect(currentStage(later, 0)).toBeNull();
    expect(meets(layout, later, at(0))).toBe(false);
    expect(meets(layout, later, at(1))).toBe(true);
    expect(currentStage({ stages: [] }, 3)).toBeNull();
    expect(meets(layout, { stages: [] })).toBe(false);
  });

  it('with one stage from phase 0, holds as its condition does in every phase', () => {
    const one: Staged = { stages: [{ fromPhase: 0, condition: { count: BEDROOM, min: 2 } }] };
    for (const p of [0, 1, 6]) {
      expect(meets(layoutOf(row('bedroom', 2)), one, at(p))).toBe(true);
      expect(meets(layoutOf(row('bedroom', 1)), one, at(p))).toBe(false);
    }
  });
});

describe('and, or, not', () => {
  // A Kitchen and a Bedroom; no Dining Room.
  const layout = layoutOf([
    ['kitchen', 0, 0],
    ['bedroom', 2, 0],
  ]);
  const KITCHEN_1: HouseCondition = { count: KITCHEN, min: 1 };
  const BEDROOM_1: HouseCondition = { count: BEDROOM, min: 1 };
  const DINING_1: HouseCondition = { count: DINING, min: 1 };

  it('and holds when every part does (an empty and holds)', () => {
    expect(meets(layout, { and: [KITCHEN_1, BEDROOM_1] })).toBe(true);
    expect(meets(layout, { and: [KITCHEN_1, DINING_1] })).toBe(false);
    expect(meets(layout, { and: [] })).toBe(true);
  });

  it('or holds when any part does (an empty or never does)', () => {
    expect(meets(layout, { or: [DINING_1, BEDROOM_1] })).toBe(true);
    expect(meets(layout, { or: [DINING_1, { none: BEDROOM }] })).toBe(false);
    expect(meets(layout, { or: [] })).toBe(false);
  });

  it('not inverts, and they nest', () => {
    expect(meets(layout, { not: DINING_1 })).toBe(true);
    expect(meets(layout, { not: KITCHEN_1 })).toBe(false);
    expect(meets(layout, { not: { not: KITCHEN_1 } })).toBe(true);
    // A Kitchen, and a Dining Room or no Pool, and not two Bedrooms.
    const nested: HouseCondition = {
      and: [KITCHEN_1, { or: [DINING_1, { none: POOL }] }, { not: { count: BEDROOM, min: 2 } }],
    };
    expect(meets(layout, nested)).toBe(true);
  });
});

// ---------------------------------------------------------------------------------------
// Progress, for the checklist.

describe('progressOf', () => {
  it('reads a count with both bounds as "n <noun> (min–max)", weighted', () => {
    const cond: HouseCondition = { count: BEDROOM, min: 3, max: 4 };
    expect(progress(layoutOf(row('bedroom', 3)), cond)).toEqual([
      { text: '3 Bedrooms (3–4)', ok: true },
    ]);
    expect(progress(layoutOf(row('bedroom', 5)), cond)).toEqual([
      { text: '5 Bedrooms (3–4)', ok: false },
    ]);
    // Bunk Beds count: 2 + 1.
    expect(progress(layoutOf(row('bedroom', 2), [[1, 'bunkBeds']]), cond)).toEqual([
      { text: '3 Bedrooms (3–4)', ok: true },
    ]);
  });

  it('reads a floor, a ceiling, and an exact count the same way, the bounds in brackets', () => {
    // A min-only count reads "n <noun> (≥ min)", never "<noun> n of min".
    expect(progress(layoutOf(row('bedroom', 1)), { count: BEDROOM, min: 2 })).toEqual([
      { text: '1 Bedroom (≥ 2)', ok: false },
    ]);
    expect(progress(layoutOf(row('bedroom', 2)), { count: BEDROOM, min: 2 })).toEqual([
      { text: '2 Bedrooms (≥ 2)', ok: true },
    ]);
    expect(progress(layoutOf(row('diningRoom', 2)), { count: DINING, max: 1 })).toEqual([
      { text: '2 Dining Rooms (≤ 1)', ok: false },
    ]);
    const kitchen = layoutOf(row('kitchen', 1));
    expect(progress(kitchen, { count: KITCHEN, min: 1, max: 1 })).toEqual([
      { text: '1 Kitchen (exactly 1)', ok: true },
    ]);
    expect(progress(layoutOf([]), { count: KITCHEN, min: 1, max: 1 })).toEqual([
      { text: '0 Kitchens (exactly 1)', ok: false },
    ]);
    expect(progress(kitchen, { count: KITCHEN })).toEqual([{ text: '1 Kitchen (≥ 0)', ok: true }]);
  });

  it('reads a plain noun number first, in the number’s own grammar: "3 rooms (≥ 6)"', () => {
    expect(progress(layoutOf(row('bedroom', 3)), { count: ROOM, min: 6 })).toEqual([
      { text: '3 rooms (≥ 6)', ok: false },
    ]);
    expect(progress(layoutOf(row('bedroom', 1)), { count: ROOM, min: 6 })).toEqual([
      { text: '1 room (≥ 6)', ok: false },
    ]);
    expect(progress(layoutOf(row('bedroom', 5)), { count: ROOM, min: 4, max: 8 })).toEqual([
      { text: '5 rooms (4–8)', ok: true },
    ]);
  });

  it('reads countNew as "n new of min" and demolitions as "n of min demolished", 0 without an order', () => {
    const layout = layoutOf(row('bedroom', 4));
    const fresh: HouseCondition = { countNew: BEDROOM, min: 3 };
    expect(progress(layout, fresh, since(3))).toEqual([{ text: '2 new of 3', ok: false }]);
    expect(progress(layout, fresh)).toEqual([{ text: '0 new of 3', ok: false }]);
    const cleared: HouseCondition = { demolishedSinceAccepted: { min: 2 } };
    expect(progress(layout, cleared, since(1, 1))).toEqual([
      { text: '1 of 2 demolished', ok: false },
    ]);
    expect(progress(layout, cleared)).toEqual([{ text: '0 of 2 demolished', ok: false }]);
  });

  it('reads a none as "n <noun> (none allowed)"', () => {
    const cond: HouseCondition = { none: POOL };
    expect(progress(layoutOf(row('bedroom', 1)), cond)).toEqual([
      { text: '0 Pools (none allowed)', ok: true },
    ]);
    expect(progress(layoutOf([['pool', 0, 0]]), cond)).toEqual([
      { text: '1 Pool (none allowed)', ok: false },
    ]);
    expect(progress(layoutOf(row('pool', 2, 0, 0, 3)), cond)).toEqual([
      { text: '2 Pools (none allowed)', ok: false },
    ]);
    // Dale's quiet office (the plan's Appendix B): the whole selector is the noun.
    const office: Selector = { piece: 'homeOffice' };
    const loud: HouseCondition = { none: { all: [{ tag: 'Loud' }, { touching: office }] } };
    expect(progress(layoutOf([['homeOffice', 0, 0]]), loud)).toEqual([
      { text: '0 Loud pieces touching a Home Office (none allowed)', ok: true },
    ]);
  });

  it('reads a none over A-but-not-touching-B as "k of n A touch m+ B", links included', () => {
    // Three Bedrooms in a row: only the middle one touches two rooms.
    expect(progress(layoutOf(row('bedroom', 3)), EVERY_ROOM_TOUCHES_TWO)).toEqual([
      { text: '1 of 3 rooms touch 2+ rooms', ok: false },
    ]);
    // Four in a square: each touches two.
    const square = layoutOf([...row('bedroom', 2), ...row('bedroom', 2, 2)]);
    expect(progress(square, EVERY_ROOM_TOUCHES_TWO)).toEqual([
      { text: '4 of 4 rooms touch 2+ rooms', ok: true },
    ]);
    // Two Bedrooms and a Bathroom around a Hallway, touching only it: each is linked to both
    // others, and the Hallway isn't a room.
    //   BB..BB
    //   BBhhBB
    //   ..b...
    const hub = layoutOf([
      ['bedroom', 0, 0],
      ['hallway', 2, 1],
      ['bedroom', 4, 0],
      ['bathroom', 2, 2],
    ]);
    expect(progress(hub, EVERY_ROOM_TOUCHES_TWO)).toEqual([
      { text: '3 of 3 rooms touch 2+ rooms', ok: true },
    ]);
    // No rooms at all: nothing to break it.
    expect(progress(layoutOf([]), EVERY_ROOM_TOUCHES_TWO)).toEqual([
      { text: '0 of 0 rooms touch 2+ rooms', ok: true },
    ]);
  });

  // With a `touching` of min 1, the touched noun is singular, with its article.
  it('puts an article before a single touched noun: "touch a Bathroom"', () => {
    // Bedroom 1 shares the Bathroom; Bedroom 3 doesn't.
    const layout = layoutOf([
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
      ['bedroom', 4, 0],
    ]);
    const cond: HouseCondition = { none: { all: [BEDROOM, { not: { touching: BATHROOM } }] } };
    expect(progress(layout, cond)).toEqual([
      { text: '1 of 2 Bedrooms touch a Bathroom', ok: false },
    ]);
  });

  it('reads a none over A-but-not-B, for B not a touching, as "k of n A are B"', () => {
    // Nine Bathrooms in a 3 × 3 block: the middle one is interior.
    const layout = layoutOf(
      [1, 2, 3].flatMap((y) => [1, 2, 3].map((x): Placement => ['bathroom', x, y])),
      [],
      emptyRows(5, 5),
    );
    const cond: HouseCondition = { none: { all: [ROOM, { not: { property: 'exterior' } }] } };
    expect(progress(layout, cond)).toEqual([
      { text: '8 of 9 rooms are exterior rooms', ok: false },
    ]);
  });

  it('reads a fenced yard and a group as "n of min tiles", and a set as "<name> n of min"', () => {
    expect(progress(twoYards(), { fencedYardTiles: { min: 8 } })).toEqual([
      { text: '6 of 8 tiles', ok: false },
    ]);
    const lawns = layoutOf([
      ['lawn', 0, 0],
      ['lawn', 2, 0],
      ['lawn', 6, 0],
    ]);
    expect(progress(lawns, { group: LAWN, minTiles: 8 })).toEqual([
      { text: '8 of 8 tiles', ok: true },
    ]);
    const suite = layoutOf(SUITE);
    expect(progress(suite, { set: 'suite', min: 2 })).toEqual([
      { text: 'Suite 1 of 2', ok: false },
    ]);
    expect(progress(suite, { set: 'suite' })).toEqual([{ text: 'Suite 1 of 1', ok: true }]);
  });

  it('never asks a fenced yard for fewer tiles than fencedYardMin: no smaller yard is fenced', () => {
    // The Hendersons' "any fenced yard" is min 4 under the real fencedYardMin of 10 (D-069);
    // here, min 2 under TEST_BALANCE's 4.
    expect(TEST_BALANCE.fencedYardMin).toBe(4);
    const any: HouseCondition = { fencedYardTiles: { min: 2 } };
    expect(progress(layoutOf(row('bedroom', 2)), any)).toEqual([
      { text: '0 of 4 tiles', ok: false },
    ]);
    // A 3-tile pocket isn't a fenced yard, so it's still 0 of 4.
    const three = layoutOf(
      [
        ['bedroom', 0, 0],
        ['bedroom', 2, 0],
        ['bathroom', 3, 2],
        ['fence', 0, 3],
      ],
      [],
      emptyRows(4, 4),
    );
    expect(progress(three, any)).toEqual([{ text: '0 of 4 tiles', ok: false }]);
    // Any real yard is at least that big, and counts.
    expect(progress(twoYards(), any)).toEqual([{ text: '6 of 4 tiles', ok: true }]);
  });

  it('says what an adjacent pair is missing: one of the two, or only their touching', () => {
    const pair: HouseCondition = { adjacentPair: [KITCHEN, DINING] };
    expect(progress(layoutOf([]), pair)).toEqual([
      { text: 'no Kitchen or Dining Room yet', ok: false },
    ]);
    expect(progress(layoutOf([['kitchen', 0, 0]]), pair)).toEqual([
      { text: 'no Dining Room yet', ok: false },
    ]);
    expect(progress(layoutOf([['diningRoom', 0, 0]]), pair)).toEqual([
      { text: 'no Kitchen yet', ok: false },
    ]);
    const apart = layoutOf([
      ['kitchen', 0, 0],
      ['diningRoom', 5, 0],
    ]);
    expect(progress(apart, pair)).toEqual([{ text: 'not yet beside each other', ok: false }]);
    const beside = layoutOf([
      ['kitchen', 0, 0],
      ['diningRoom', 2, 0],
    ]);
    expect(progress(beside, pair)).toEqual([{ text: 'beside each other', ok: true }]);
  });

  it('reads a ratio as "<noun> have of need"', () => {
    expect(progress(household(3, 1), BATH_RATIO)).toEqual([
      { text: 'Bathrooms 1 of 2', ok: false },
    ]);
    expect(progress(household(0, 0), BATH_RATIO)).toEqual([
      { text: 'Bathrooms 0 of 1', ok: false },
    ]);
    expect(progress(household(5, 3), BATH_RATIO)).toEqual([{ text: 'Bathrooms 3 of 3', ok: true }]);
  });

  it('gives an outline three parts: rooms, fill, and the box', () => {
    expect(progress(layoutOf(SIXTY), roof({ minRooms: 4 }))).toEqual([
      { text: '4 rooms (≥ 4)', ok: true },
      { text: 'fill 60% (≥ 60%)', ok: true },
      { text: 'box 5 × 3 (≤ 2:1)', ok: true },
    ]);
    expect(progress(layoutOf(SIXTY), roof({ minRooms: 4, maxRooms: 4 }))[0]).toEqual({
      text: '4 rooms (exactly 4)',
      ok: true,
    });
    expect(progress(layoutOf(row('bedroom', 1)), roof())[0]).toEqual({
      text: '1 room (≥ 3)',
      ok: false,
    });
    // With no indoor tiles, the fill and the box both fail.
    const yard = layoutOf([['lawn', 0, 0]]);
    expect(progress(yard, { outline: { minRooms: 0, minFillPct: 0, maxAspect: 2 } })).toEqual([
      { text: '0 rooms (≥ 0)', ok: true },
      { text: 'fill 0% (≥ 0%)', ok: false },
      { text: 'box 0 × 0 (≤ 2:1)', ok: false },
    ]);
  });

  it('shows fill rounded down, so 59.4% reads 59% and fails', () => {
    // Four Bedrooms across the top, Bathrooms at (0,2), (0,3), and (7,3): 19 tiles in 8 × 4.
    const layout = layoutOf([
      ...row('bedroom', 4),
      ['bathroom', 0, 2],
      ['bathroom', 0, 3],
      ['bathroom', 7, 3],
    ]);
    expect(progress(layout, roof({ minRooms: 4, maxRooms: 8 }))).toEqual([
      { text: '7 rooms (4–8)', ok: true },
      { text: 'fill 59% (≥ 60%)', ok: false },
      { text: 'box 8 × 4 (≤ 2:1)', ok: true }, // exactly 2:1
    ]);
  });

  it('gives a variety two parts: the pieces in the yard, and the most of one type', () => {
    const fences = layoutOf([
      ['fence', 0, 0],
      ['fence', 0, 2],
      ['fence', 5, 0, 0, ['#..', '#..', '###']],
      ['flowerBed', 9, 0],
    ]);
    expect(progress(fences, tidy())).toEqual([
      { text: '4 in the yard (≥ 4)', ok: true },
      { text: '3 of a type (≤ 2)', ok: false },
    ]);
    expect(progress(fences, tidy({ exempt: { piece: 'fence' } }))).toEqual([
      { text: '4 in the yard (≥ 4)', ok: true },
      { text: '1 of a type (≤ 2)', ok: true },
    ]);
    expect(progress(layoutOf([['flowerBed', 0, 0]]), tidy())).toEqual([
      { text: '1 in the yard (≥ 4)', ok: false },
      { text: '1 of a type (≤ 2)', ok: true },
    ]);
  });

  it('joins an and’s parts, shows an or’s first met part, and has none for not', () => {
    // Two Living Rooms and a Dining Room: A living room or two.
    const layout = layoutOf([
      ['livingRoom', 0, 0],
      ['livingRoom', 2, 0],
      ['diningRoom', 4, 0],
    ]);
    const living: HouseCondition = {
      and: [
        { count: LIVING, min: 1, max: 2 },
        { count: DINING, max: 1 },
      ],
    };
    expect(progress(layout, living)).toEqual([
      { text: '2 Living Rooms (1–2)', ok: true },
      { text: '1 Dining Room (≤ 1)', ok: true },
    ]);
    const either: HouseCondition = {
      or: [
        { count: POOL, min: 1 },
        { count: DINING, min: 1 },
        { count: LIVING, min: 1 },
      ],
    };
    expect(progress(layout, either)).toEqual([{ text: '1 Dining Room (≥ 1)', ok: true }]);
    expect(progress(layoutOf([]), either)).toEqual([]); // none met
    expect(progress(layout, { not: { count: POOL, min: 1 } })).toEqual([]);
    // An adjacent pair that holds says so (its misses are in their own test above).
    expect(progress(layout, { adjacentPair: [LIVING, DINING] })).toEqual([
      { text: 'beside each other', ok: true },
    ]);
  });

  it('shows the current stage only, and nothing before the first', () => {
    const two = layoutOf(row('bedroom', 2));
    expect(progress(two, GROWING, at(0))).toEqual([{ text: '2 Bedrooms (2–3)', ok: true }]);
    expect(progress(two, GROWING, at(1))).toEqual([{ text: '2 Bedrooms (3–4)', ok: false }]);
    const later: HouseCondition = { stages: [{ fromPhase: 1, condition: { count: BEDROOM } }] };
    expect(progress(two, later, at(0))).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------
// Limits, for Renovate and the half-weight draws.

describe('typeLimits, limitReached, typesAtLimit', () => {
  // Kitchen 1, Living Rooms 2 and 3, Dining Room 4, Bedrooms 5 (Bunk Beds) and 6.
  const layout = layoutOf(
    [
      ['kitchen', 0, 0],
      ['livingRoom', 2, 0],
      ['livingRoom', 4, 0],
      ['diningRoom', 6, 0],
      ['bedroom', 8, 0],
      ['bedroom', 10, 0],
    ],
    [[5, 'bunkBeds']],
  );
  const LIMITING = ['oneKitchen', 'livingRooms', 'roomForEveryone'];
  const content = withClient({
    specs: [
      spec('oneKitchen', { count: KITCHEN, min: 1, max: 1 }),
      spec('livingRooms', {
        and: [
          { count: LIVING, min: 1, max: 2 },
          { count: DINING, max: 1 },
        ],
      }),
      spec('roomForEveryone', {
        stages: [
          { fromPhase: 0, condition: { count: BEDROOM, min: 2, max: 3 } },
          { fromPhase: 1, condition: { and: [{ count: BEDROOM, min: 3, max: 4 }] } },
        ],
      }),
      // None of these is a limit.
      spec('rooms', { count: ROOM, max: 8 }),
      spec('outerBaths', { count: { all: [BATHROOM, { property: 'exterior' }] }, max: 2 }),
      spec('anything', { count: 'all', max: 20 }),
      spec('aCloset', { count: { piece: 'closet' }, min: 1 }),
      spec('noGarage', {
        or: [
          { count: { piece: 'garage' }, max: 0 },
          { count: KITCHEN, min: 5 },
        ],
      }),
      spec('fewOffices', { not: { count: { piece: 'homeOffice' }, min: 2 } }),
    ],
  });
  const specs = content.clients.hendersons.specs;
  const limits = (phase: number) => typeLimits(content, layout, specs, at(phase));

  it('come from counts with a max over { piece }, through and and the current stage', () => {
    expect(limits(0)).toEqual([
      { types: ['kitchen'], max: 1, count: 1 },
      { types: ['livingRoom'], max: 2, count: 2 },
      { types: ['diningRoom'], max: 1, count: 1 },
      { types: ['bedroom'], max: 3, count: 3 }, // 2 (Bunk Beds) + 1
    ]);
    expect(limits(1)).toHaveLength(4);
    expect(limits(1)[3]).toEqual({ types: ['bedroom'], max: 4, count: 3 });
  });

  it('never come from or, not, a count without a max, or a selector other than { piece }', () => {
    const others = specs.filter((s) => !LIMITING.includes(s.id));
    expect(others).toHaveLength(6);
    expect(typeLimits(content, layout, others, P0)).toEqual([]);
  });

  it('are reached at count ≥ max, for a card’s root type', () => {
    expect(limitReached(limits(0), 'kitchen')).toEqual({ types: ['kitchen'], max: 1, count: 1 });
    expect(limitReached(limits(0), 'bedroom')).toEqual({ types: ['bedroom'], max: 3, count: 3 });
    expect(limitReached(limits(0), 'bathroom')).toBeNull();
    expect(limitReached(limits(1), 'bedroom')).toBeNull(); // 3 of 4
    // An L-Kitchen card is at the Kitchen limit.
    expect(rootType(C.pieces.lKitchen)).toBe('kitchen');
    expect(limitReached(limits(0), rootType(C.pieces.lKitchen))?.types).toEqual(['kitchen']);
    expect(sorted(typesAtLimit(limits(0)))).toEqual([
      'bedroom',
      'diningRoom',
      'kitchen',
      'livingRoom',
    ]);
    expect(sorted(typesAtLimit(limits(1)))).toEqual(['diningRoom', 'kitchen', 'livingRoom']);
  });

  it('compare count ≥ max at the edges, and give the first reached limit that names the type', () => {
    const kitchens = (count: number): TypeLimit[] => [{ types: ['kitchen'], max: 1, count }];
    expect(limitReached(kitchens(0), 'kitchen')).toBeNull();
    expect(limitReached(kitchens(1), 'kitchen')).not.toBeNull();
    expect(limitReached(kitchens(2), 'kitchen')).not.toBeNull(); // past it is still at it
    expect(typesAtLimit(kitchens(0)).size).toBe(0);
    // A max of 0 is reached from the start.
    expect(limitReached([{ types: ['garage'], max: 0, count: 0 }], 'garage')).not.toBeNull();
    const two: TypeLimit[] = [
      { types: ['bedroom'], max: 5, count: 3 },
      { types: ['bedroom', 'closet'], max: 2, count: 3 },
    ];
    expect(limitReached(two, 'bedroom')).toBe(two[1]);
    expect(limitReached(two, 'closet')).toBe(two[1]);
    expect(sorted(typesAtLimit(two))).toEqual(['bedroom', 'closet']);
  });

  it('cover every type a { piece: [...] } names, with one weighted count', () => {
    const shared = [spec('shared', { count: { piece: ['livingRoom', 'diningRoom'] }, max: 3 })];
    const l = typeLimits(content, layout, shared, P0);
    expect(l).toEqual([{ types: ['livingRoom', 'diningRoom'], max: 3, count: 3 }]);
    expect(sorted(typesAtLimit(l))).toEqual(['diningRoom', 'livingRoom']);
  });

  it('count a Kitchen with an Island toward the Kitchen limit only', () => {
    const island = layoutOf([['kitchen', 0, 0]], [[1, 'kitchenIsland']]);
    const two = [spec('k', { count: KITCHEN, max: 1 }), spec('d', { count: DINING, max: 1 })];
    const l = typeLimits(content, island, two, P0);
    expect(l).toEqual([
      { types: ['kitchen'], max: 1, count: 1 },
      { types: ['diningRoom'], max: 1, count: 0 },
    ]);
    expect(limitReached(l, 'diningRoom')).toBeNull();
  });

  it('have none before a staged limit’s first stage', () => {
    const later = [
      spec('beds', { stages: [{ fromPhase: 1, condition: { count: BEDROOM, max: 1 } }] }),
    ];
    expect(typeLimits(content, layout, later, P0)).toEqual([]);
    expect(typeLimits(content, layout, later, at(1))).toEqual([
      { types: ['bedroom'], max: 1, count: 3 },
    ]);
  });
});

// ---------------------------------------------------------------------------------------
// Card text.

describe('houseConditionText', () => {
  const text = (cond: HouseCondition) => houseConditionText(C, cond);

  it('reads a count as a range, a floor, or a ceiling', () => {
    expect(text({ count: BEDROOM, min: 2, max: 3 })).toBe('2–3 Bedrooms');
    expect(text({ count: KITCHEN, min: 2, max: 2 })).toBe('exactly 2 Kitchens');
    expect(text({ count: { piece: 'library' }, min: 1 })).toBe('a Library');
    expect(text({ count: { all: [ROOM, { tag: 'Dark' }] }, min: 3 })).toBe('3 or more Dark rooms');
    expect(text({ count: LIVING, max: 2 })).toBe('at most 2 Living Rooms');
    expect(text({ count: POOL, max: 0 })).toBe('no Pools');
  });

  // A count of one with a ceiling reads "one", not an article (text.ts, counted()).
  it('reads exactly one as "exactly one Kitchen", not "exactly a Kitchen"', () => {
    expect(text({ count: KITCHEN, min: 1, max: 1 })).toBe('exactly one Kitchen');
  });

  it('reads a ceiling of one as "at most one Dining Room", not "at most a"', () => {
    expect(text({ count: DINING, max: 1 })).toBe('at most one Dining Room');
  });

  it('reads countNew, none, adjacentPair, a fenced yard, a group, a set, and demolitions', () => {
    expect(text({ countNew: BEDROOM, min: 1 })).toBe('a new Bedroom');
    expect(text({ countNew: BEDROOM, min: 2 })).toBe('2 new Bedrooms');
    expect(text({ none: POOL })).toBe('no Pools');
    expect(text({ adjacentPair: [KITCHEN, DINING] })).toBe('a Kitchen beside a Dining Room');
    // A letter read aloud takes "an": "el".
    expect(text({ adjacentPair: [{ piece: 'lKitchen' }, DINING] })).toBe(
      'an L-Kitchen beside a Dining Room',
    );
    // fencedYardMin is 4: any fenced yard is at least that big.
    expect(text({ fencedYardTiles: { min: 4 } })).toBe('a fenced yard');
    expect(text({ fencedYardTiles: { min: 5 } })).toBe('a fenced yard of 5 or more tiles');
    expect(text({ group: LAWN, minTiles: 8 })).toBe('8 or more tiles of Lawns in one group');
    expect(text({ set: 'suite' })).toBe('a Suite');
    expect(text({ set: 'entertainer' })).toBe('an Entertainer');
    expect(text({ set: 'jackAndJill', min: 2 })).toBe('2 Jack-and-Jills');
    expect(text({ demolishedSinceAccepted: { min: 1 } })).toBe('demolish a piece');
    expect(text({ demolishedSinceAccepted: { min: 2 } })).toBe('demolish 2 pieces');
  });

  it('reads a ratio, with its floor', () => {
    expect(text(BATH_RATIO)).toBe('a Bathroom for every 2 Bedrooms (at least 1)');
    expect(text({ ratio: { count: BATHROOM, per: BEDROOM, every: 1 } })).toBe(
      'a Bathroom for every Bedroom',
    );
    expect(text({ ratio: { count: BATHROOM, per: BEDROOM, every: 3, min: 0 } })).toBe(
      'a Bathroom for every 3 Bedrooms',
    );
  });

  it('reads an outline and a variety as the house rules do', () => {
    expect(text(roof({ minRooms: 4 }))).toBe(
      '4+ rooms, filling at least 60% of their box, and the box is no longer than twice its width',
    );
    expect(text(roof({ minRooms: 4, maxRooms: 8, maxAspect: 3 }))).toBe(
      '4–8 rooms, filling at least 60% of their box, and the box is no longer than 3 times its width',
    );
    expect(text({ variety: { of: YARD, min: 6, maxEach: 3 } })).toBe(
      '6 or more yard pieces, and none of a type stands 4 or more times',
    );
  });

  it('reads stages by milestone name, and past the last name by number', () => {
    expect(text(GROWING)).toBe('2–3 Bedrooms; from Foundation, 3–4 Bedrooms');
    const late: HouseCondition = {
      stages: [
        { fromPhase: 1, condition: { count: BEDROOM, min: 2, max: 3 } },
        { fromPhase: 2, condition: { count: BEDROOM, min: 4, max: 5 } },
      ],
    };
    // TEST_BALANCE has two phases, so phase 2 has no name.
    expect(TEST_BALANCE.phases).toHaveLength(2);
    expect(text(late)).toBe('from Foundation, 2–3 Bedrooms; from phase 3, 4–5 Bedrooms');
  });

  it('joins and, or, and not', () => {
    const a: HouseCondition = { count: KITCHEN, min: 1 };
    const b: HouseCondition = { count: DINING, min: 1 };
    const c: HouseCondition = { count: LIVING, min: 1 };
    expect(text({ and: [a, b] })).toBe('a Kitchen and a Dining Room');
    expect(text({ and: [a, b, c] })).toBe('a Kitchen, a Dining Room, and a Living Room');
    expect(
      text({
        or: [
          { count: POOL, min: 1 },
          { count: { piece: 'hotTub' }, min: 1 },
        ],
      }),
    ).toBe('a Pool or a Hot Tub');
    expect(text({ not: { count: POOL, min: 1 } })).toBe('not a Pool');
  });
});

describe('specText', () => {
  it('prefers the spec’s own text, capitalized, with a full stop if it has none', () => {
    const own = spec(
      'oneKitchen',
      { count: KITCHEN, min: 1, max: 1 },
      'one Kitchen. An L-Kitchen counts.',
    );
    expect(specText(C, own)).toBe('One Kitchen. An L-Kitchen counts.');
    const library: HouseCondition = { count: { piece: 'library' }, min: 1 };
    expect(specText(C, spec('library', library, 'a Library'))).toBe('A Library.');
    // Its own ending stands.
    expect(specText(C, spec('library', library, 'a Library!'))).toBe('A Library!');
  });

  it('generates the rest from the condition, capitalized, with a full stop', () => {
    expect(specText(C, spec('pair', { adjacentPair: [KITCHEN, DINING] }))).toBe(
      'A Kitchen beside a Dining Room.',
    );
    expect(specText(C, spec('library', { count: { piece: 'library' }, min: 1 }))).toBe(
      'A Library.',
    );
    // Dale's quiet office (the plan's Appendix B): a Home Office, and nothing Loud against one.
    const office: Selector = { piece: 'homeOffice' };
    const quiet = spec('quietOffice', {
      and: [{ count: office, min: 1 }, { none: { all: [{ tag: 'Loud' }, { touching: office }] } }],
    });
    expect(specText(C, quiet)).toBe('A Home Office and no Loud pieces touching a Home Office.');
    // A number needs no capital.
    expect(specText(C, spec('beds', GROWING))).toBe('2–3 Bedrooms; from Foundation, 3–4 Bedrooms.');
  });
});
