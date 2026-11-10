import { describe, expect, it } from 'vitest';
import type { PieceId, PlaceAction, RunState, SpecDef } from './index.ts';
import { followedLines } from './estimate.ts';
import { computeLayout } from './layout.ts';
import { lotFromRows } from './lot.ts';
import { createRules, type Rules } from './run.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withClient,
  type Placement,
} from './testing.ts';

const rules = createRules(C);

function onLot(rows: string[], ...ids: PieceId[]): RunState {
  const s = rules.newRun(setup('estimate'));
  return {
    ...s,
    house: { ...s.house, lot: lotFromRows(rows) },
    hand: ids.map((id) => ({ kind: 'piece', id })),
  };
}

const place = (i: number, x: number, y: number, rot: 0 | 1 | 2 | 3 = 0): PlaceAction => ({
  t: 'place',
  from: 'hand',
  i,
  x,
  y,
  rot,
});

/** A Fence pack's play (D-106): 4 tiles in a row, across or upright, at (x, y). */
const fence = (i: number, x: number, y: number, upright = false): PlaceAction => ({
  t: 'place',
  from: 'hand',
  i,
  x,
  y,
  rot: 0,
  shape: upright ? ['#', '#', '#', '#'] : ['####'],
});

/** A house built unchecked on an empty 8×8 lot, with this hand. */
function built(placements: Placement[], ...ids: PieceId[]): RunState {
  const s = rules.newRun(setup('estimate'));
  return {
    ...s,
    house: houseFrom(C, emptyRows(8, 8), placements),
    hand: ids.map((id) => ({ kind: 'piece', id })),
  };
}

const exact = (s: RunState, p: PlaceAction) => rules.scoreOnly(s, p) - rules.scoreOnly(s, null);

/** Plays a card, leaving the shop if that week ended a phase, then sets the next hand. */
function playThen(s: RunState, p: PlaceAction, ...ids: PieceId[]): RunState {
  let next = rules.apply(s, p).state;
  if (next.screen === 'shop') next = rules.apply(next, { t: 'leaveShop' }).state;
  return { ...next, hand: ids.map((id) => ({ kind: 'piece', id })) };
}

describe('the greedy bot’s cheap estimate', () => {
  it('matches the exact change for neighbor bonuses, penalties, and auras', () => {
    let s = onLot(
      ['T.......', '........', '........', '........'],
      'bedroom',
      'kitchen',
      'diningRoom',
    );
    // A Bedroom touching a Tree: 3 + 1.
    expect(rules.estimatePlay(s, place(0, 1, 0)).delta).toBe(exact(s, place(0, 1, 0)));
    s = rules.apply(s, place(1, 2, 0)).state; // a Kitchen
    s = {
      ...s,
      hand: [
        { kind: 'piece', id: 'diningRoom' },
        { kind: 'piece', id: 'bathroom' },
      ],
    };
    // The Dining Room adds +2 to the Kitchen, then its aura makes that +50%.
    expect(rules.estimatePlay(s, place(0, 4, 0)).delta).toBe(exact(s, place(0, 4, 0)));
    // A Bathroom next to the Kitchen: −2, clamped at 0.
    expect(rules.estimatePlay(s, place(1, 2, 2)).delta).toBe(exact(s, place(1, 2, 2)));
  });

  it('respects caps on what a neighbor already counts', () => {
    let s = onLot(emptyRows(10, 4), 'lawn');
    for (const x of [0, 2, 4, 6]) s = playThen(s, place(0, x, 0), 'lawn');
    expect(rules.estimatePlay(s, place(0, 2, 2)).delta).toBe(exact(s, place(0, 2, 2)));
  });

  it('sees a Hallway’s pay for the rooms it touches, under its cap (D-114)', () => {
    const pay = { kind: 'neighbor', match: { property: 'room' }, amount: 2, max: 2 } as const;
    const hallway = { ...C.pieces.hallway, effects: [...C.pieces.hallway.effects, pay] };
    const paid = createRules({ ...C, pieces: { ...C.pieces, hallway } });
    const est = (r: Rules, s: RunState, p: PlaceAction) => r.estimatePlay(s, p).delta;
    const exactPaid = (s: RunState, p: PlaceAction) =>
      paid.scoreOnly(s, p) - paid.scoreOnly(s, null);
    // A Closet beside it: its own 1, and the Hallway's +2 for a room, which it doesn't count back.
    const one = built([['hallway', 2, 2]], 'closet');
    expect(est(paid, one, place(0, 2, 1))).toBe(exactPaid(one, place(0, 2, 1)));
    expect(est(paid, one, place(0, 2, 1))).toBeGreaterThan(est(rules, one, place(0, 2, 1)));
    // With two rooms on it already the pay is capped, so a third Closet pays only its own.
    const two = built(
      [
        ['hallway', 2, 2],
        ['closet', 2, 1],
        ['closet', 3, 1],
      ],
      'closet',
    );
    expect(est(paid, two, place(0, 2, 3))).toBe(exactPaid(two, place(0, 2, 3)));
    expect(est(paid, two, place(0, 2, 3))).toBe(est(rules, two, place(0, 2, 3)));
  });

  it('sees rooms linked through a Hallway', () => {
    let s = onLot(emptyRows(10, 10), 'bedroom', 'longHallway', 'bathroom');
    s = playThen(s, place(0, 0, 0), 'longHallway');
    s = playThen(s, place(0, 2, 1), 'bedroom');
    s = playThen(s, place(0, 5, 0), 'bathroom');
    // The Bathroom touches only the Hallway, which links it to both Bedrooms.
    const est = rules.estimatePlay(s, place(0, 3, 2));
    expect(est.setHint).toBe(true);
    expect(est.delta).toBeGreaterThan(0);
  });

  it('flags plays that might complete a set', () => {
    let s = onLot(emptyRows(8, 6), 'bedroom', 'bathroom');
    s = playThen(s, place(0, 0, 0), 'bathroom');
    expect(rules.estimatePlay(s, place(0, 2, 0)).setHint).toBe(true);
    expect(rules.estimatePlay(s, place(0, 6, 4)).setHint).toBe(false);
  });

  // A Bedroom in the top-left corner and a Fence under the yard beside it (fencedYardMin 4).
  //   y0  BB..?...
  //   y1  BB..?...
  //   y2  ----?...
  //   y3  ....?...
  const corner: Placement[] = [
    ['bedroom', 0, 0],
    ['fence', 0, 2],
  ];

  it('flags a Fence that closes a new fenced yard', () => {
    const s = built(corner, 'fence');
    const closing = fence(0, 4, 0, true); // (4,0) .. (4,3)
    expect(rules.fencedYards(s)).toEqual([]);
    expect(rules.estimatePlay(s, closing).yardHint).toBe(true);
    // The estimate can't see the yard's own payoff, which is why the hint exists.
    expect(exact(s, closing)).toBeGreaterThan(rules.estimatePlay(s, closing).delta);
    expect(rules.fencedYards(rules.apply(s, closing).state)).toEqual([4]);
  });

  it('doesn’t flag a Fence that leaves the yard open, or one inside a yard already fenced', () => {
    const s = built(corner, 'fence');
    // One column further right: the yard leaks out under it, past the first Fence's end.
    expect(rules.estimatePlay(s, fence(0, 5, 0, true)).yardHint).toBe(false);
    expect(rules.estimatePlay(s, fence(0, 0, 6)).yardHint).toBe(false);
    // Row 5 all Fence: everything behind it is one fenced yard, and a Fence inside it only
    // shrinks or splits that yard.
    const behind = built(
      [
        ['bedroom', 0, 0],
        ['fence', 0, 5],
        ['fence', 4, 5],
      ],
      'fence',
    );
    expect(rules.fencedYards(behind)).toEqual([36]);
    expect(rules.estimatePlay(behind, fence(0, 2, 3)).yardHint).toBe(false);
    expect(rules.estimatePlay(behind, fence(0, 3, 0, true)).yardHint).toBe(false);
  });

  it('reads a pack’s own tiles: an L-shaped Fence closes the same yard', () => {
    // The L's upright (4,0)..(4,2) closes the corner yard; its foot (5,2) (6,2) stays outside.
    const s = built(corner, 'fence');
    const L: PlaceAction = { ...fence(0, 4, 0), shape: ['#..', '#..', '###'] };
    expect(rules.checkPlay(s, L).legal).toBe(true);
    expect(rules.estimatePlay(s, L).yardHint).toBe(true);
    expect(exact(s, L)).toBeGreaterThan(rules.estimatePlay(s, L).delta);
    expect(rules.fencedYards(rules.apply(s, L).state)).toEqual([4]);
  });

  // Two Bedrooms with a Closet between them on row 0: they touch the Closet, not each other.
  //   y0  BBCbb...
  //   y1  BB?bb...
  //   y2  ..?.....
  const rooms: Placement[] = [
    ['bedroom', 0, 0],
    ['closet', 2, 0],
    ['bedroom', 3, 0],
  ];

  it('flags a Hallway that links rooms not linked yet', () => {
    const s = built(rooms, 'hallway');
    const linking = place(0, 2, 1, 1); // (2,1) (2,2): touches both Bedrooms and the Closet
    const est = rules.estimatePlay(s, linking);
    expect(est.linkHint).toBe(true);
    // Linked Bedrooms count as neighbors (Quiet +1 each), which the estimate misses.
    expect(exact(s, linking)).toBeGreaterThan(est.delta);
    // Touching one room links nothing.
    expect(rules.estimatePlay(s, place(0, 0, 2)).linkHint).toBe(false);
  });

  it('doesn’t flag a Hallway joining a group that already links the same rooms', () => {
    const s = built([...rooms, ['hallway', 2, 1, 1]], 'hallway');
    // (3,2) (4,2): touches the second Bedroom and the first Hallway, whose rooms it already links.
    expect(rules.estimatePlay(s, place(0, 3, 2)).linkHint).toBe(false);
    // With a Bathroom at (4,3), a Hallway at (2,3) (3,3) joins the group and brings it a new room.
    const t = built([...rooms, ['hallway', 2, 1, 1], ['bathroom', 4, 3]], 'hallway');
    expect(rules.estimatePlay(t, place(0, 2, 3)).linkHint).toBe(true);
  });

  it('only checks yards for wall pieces and links for connectors', () => {
    const s = built(corner, 'closet', 'lawn');
    for (const p of rules.legalPlacements(s)) {
      const est = rules.estimatePlay(s, p);
      expect(est.yardHint || est.linkHint).toBe(false);
    }
  });
});

// ---------------------------------------------------------------------------------------
// The checklist (M4a): each line met adds specBonus (25) to the week's Mult. TEST_CONTENT's
// clients have empty checklists, so each test gives the Hendersons theirs with withClient().
// A Bedroom earns 3, +1 per Quiet neighbor (a Bedroom is Quiet); a Closet earns 1; a Kitchen
// earns nothing alone. Houses sit in rows 4–7 of a 10 × 10 lot, clear of the sunny rows and
// the street.

const spec = (id: string, condition: SpecDef['condition']): SpecDef => ({
  id,
  name: id,
  group: 'wishes',
  condition,
});

const UNDER_ONE_ROOF = spec('underOneRoof', {
  outline: { minRooms: 2, minFillPct: 60, maxAspect: 2 },
});
const ONE_KITCHEN = spec('oneKitchen', { count: { piece: 'kitchen' }, min: 1, max: 1 });
const KITCHEN_DINING = spec('kitchenDining', {
  adjacentPair: [{ piece: 'kitchen' }, { piece: 'diningRoom' }],
});

/** A house with this checklist, its rules, and the same house with no checklist. */
function withLines(
  specs: readonly SpecDef[],
  placements: Placement[],
  ...ids: PieceId[]
): { R: Rules; s: RunState; plain: RunState } {
  const R = createRules(withClient({ specs }));
  const house = houseFrom(C, emptyRows(10, 10), placements);
  const hand = ids.map((id) => ({ kind: 'piece' as const, id }));
  return {
    R,
    s: { ...R.newRun(setup('checklist')), house, hand },
    plain: { ...rules.newRun(setup('checklist')), house, hand },
  };
}

const exactIn = (R: Rules, s: RunState, p: PlaceAction) => R.scoreOnly(s, p) - R.scoreOnly(s, null);

describe('the sun in the estimate (D-120)', () => {
  // A Kitchen that earns +2 while Sunny, as the game's do. The lots' sun is at the back (top).
  const WHILE_SUNNY = {
    kind: 'conditional',
    when: { is: { tag: 'Sunny' } },
    effect: { kind: 'steady', amount: 2 },
  } as const;
  const kitchen = { ...C.pieces.kitchen, effects: [...C.pieces.kitchen.effects, WHILE_SUNNY] };
  const R = createRules({ ...C, pieces: { ...C.pieces, kitchen } });
  const est = (s: RunState, p: PlaceAction) => R.estimatePlay(s, p);
  const exactSun = (s: RunState, p: PlaceAction) => exactIn(R, s, p);

  it('sees a building’s own sun: its back row lit, unless Trees stand in front', () => {
    const open = onLot(emptyRows(8, 6), 'kitchen');
    const shaded = onLot(['........', '..TT....', '........', '........'], 'kitchen');
    expect(est(open, place(0, 2, 2)).delta).toBe(exactSun(open, place(0, 2, 2)));
    expect(est(shaded, place(0, 2, 2)).delta).toBe(exactSun(shaded, place(0, 2, 2)));
    expect(exactSun(open, place(0, 2, 2)) - exactSun(shaded, place(0, 2, 2))).toBe(2);
    // One Tree leaves the other back tile lit: still Sunny.
    const half = onLot(['........', '..T.....', '........', '........'], 'kitchen');
    expect(est(half, place(0, 2, 2)).delta).toBe(exactSun(open, place(0, 2, 2)));
  });

  it('sees the shade a new building casts on the piece behind it', () => {
    const s = playThen(onLot(emptyRows(8, 6), 'kitchen'), place(0, 2, 2), 'bedroom', 'lawn');
    // A Bedroom right in front of the Kitchen takes its sun: the Kitchen's −2 counts.
    expect(est(s, place(0, 2, 0)).delta).toBe(exactSun(s, place(0, 2, 0)));
    // Half in front, the Kitchen keeps a lit tile, and its sun.
    expect(est(s, place(0, 3, 0)).delta).toBe(exactSun(s, place(0, 3, 0)));
    expect(exactSun(s, place(0, 3, 0)) - exactSun(s, place(0, 2, 0))).toBe(2);
    // A yard piece casts no shade.
    expect(est(s, place(1, 2, 0)).delta).toBe(exactSun(s, place(1, 2, 0)));
  });

  it('sees the sun a piece gives back by clearing the Trees in front', () => {
    let s = onLot(['........', '..TT....', '........', '........'], 'kitchen');
    s = playThen(s, place(0, 2, 2), 'herbGarden');
    // The Herb Garden over both Trees clears them: the Kitchen behind is Sunny again.
    expect(R.checkPlay(s, place(0, 2, 1))).toMatchObject({ legal: true });
    expect(est(s, place(0, 2, 1)).delta).toBe(exactSun(s, place(0, 2, 1)));
  });

  it('flags a play that moves another piece’s sun only when a modifier reads Sunny', () => {
    const s = playThen(onLot(emptyRows(8, 6), 'kitchen'), place(0, 2, 2), 'bedroom');
    expect(est(s, place(0, 2, 0)).sunHint).toBe(false);
    const panels = { ...s, blueprints: [{ id: 'solarPanels' as const, boughtWeek: 1 }] };
    expect(est(panels, place(0, 2, 0)).sunHint).toBe(true);
    // A play that leaves the Kitchen's sun as it was isn't flagged.
    expect(est(panels, place(0, 3, 0)).sunHint).toBe(false);
    expect(est(panels, place(0, 5, 3)).sunHint).toBe(false);
  });
});

describe('the checklist in the estimate', () => {
  it('ranks a play that keeps Under one roof above an otherwise-equal one that breaks it', () => {
    // Two Bedrooms side by side: a 4 × 2 box, at 2:1. A Closet under the first makes it 4 × 3;
    // one right of the second makes it 5 × 2, too long. Either way it touches one Bedroom.
    const { R, s, plain } = withLines(
      [UNDER_ONE_ROOF],
      [
        ['bedroom', 0, 4],
        ['bedroom', 2, 4],
      ],
      'closet',
    );
    const keeps = place(0, 0, 6);
    const breaks = place(0, 4, 4);
    expect(rules.estimatePlay(plain, keeps)).toEqual(rules.estimatePlay(plain, breaks));
    const k = R.estimatePlay(s, keeps);
    const b = R.estimatePlay(s, breaks);
    expect([k.specFlips, b.specFlips]).toEqual([0, -1]);
    expect(k.delta).toBeGreaterThan(b.delta);
    // 8 Points at ×1.25: the Closet's 1 keeps ×1.25 (11, +1) or drops to ×1 (9, −1).
    expect(k.delta).toBe(exactIn(R, s, keeps));
    expect(b.delta).toBe(exactIn(R, s, breaks));
    expect(R.preview(s, breaks).specsLost).toEqual(['underOneRoof']);
  });

  it('lowers the estimate for a second Kitchen, an L-Kitchen included', () => {
    // Two Bedrooms (8 Points) and a Kitchen: One Kitchen holds, so the week is 8 × 1.25 = 10.
    const { R, s, plain } = withLines(
      [ONE_KITCHEN],
      [
        ['bedroom', 0, 4],
        ['bedroom', 2, 4],
        ['kitchen', 4, 4],
      ],
      'kitchen',
      'lKitchen',
      'closet',
    );
    const kitchen = place(0, 4, 6);
    const lKitchen = place(1, 4, 6);
    const closet = place(2, 4, 6);
    expect(rules.estimatePlay(plain, kitchen).delta).toBe(0);
    for (const p of [kitchen, lKitchen]) {
      const est = R.estimatePlay(s, p);
      expect(est.specFlips).toBe(-1);
      expect(est.delta).toBe(-2); // 8 × 1
      expect(est.delta).toBe(exactIn(R, s, p));
    }
    expect(R.estimatePlay(s, closet).specFlips).toBe(0);
    expect(R.estimatePlay(s, closet).delta).toBe(exactIn(R, s, closet));
  });

  it('turns on a line it completes, scaled by the ×Mult the week already has', () => {
    // Two Bedrooms and no Kitchen: a Kitchen turns One Kitchen on, +0.25 on 8 Points.
    const { R, s } = withLines(
      [ONE_KITCHEN],
      [
        ['bedroom', 0, 4],
        ['bedroom', 2, 4],
      ],
      'kitchen',
    );
    const kitchen = place(0, 4, 4);
    expect(R.estimatePlay(s, kitchen)).toMatchObject({ specFlips: 1, delta: 2 });
    expect(exactIn(R, s, kitchen)).toBe(2);
    // Ahead of Schedule with five milestones early is ×2, after the checklist's +Mult, so the
    // line is worth +0.5 (8 × 2 = 16, then 8 × 2.5 = 20).
    const early: RunState = {
      ...s,
      blueprints: [{ id: 'aheadOfSchedule', boughtWeek: 1 }],
      milestonesEarly: 5,
    };
    expect(R.scoreOnly(early, null)).toBe(16);
    expect(R.estimatePlay(early, kitchen)).toMatchObject({ specFlips: 1, delta: 4 });
    expect(exactIn(R, early, kitchen)).toBe(4);
  });

  // Lines the estimate follows (count, none, ratio, outline, variety; stages, and, or, not of
  // them) and lines it leaves to the exact score (touching, adjacency, fenced yards, Dark).
  const FOLLOWED: SpecDef[] = [
    spec('roomForEveryone', {
      stages: [
        { fromPhase: 0, condition: { count: { piece: 'bedroom' }, min: 1, max: 2 } },
        { fromPhase: 1, condition: { count: { piece: 'bedroom' }, min: 3, max: 4 } },
      ],
    }),
    spec('bathrooms', {
      ratio: { count: { piece: 'bathroom' }, per: { piece: 'bedroom' }, every: 2, min: 1 },
    }),
    ONE_KITCHEN,
    spec('livingRooms', {
      and: [
        { count: { piece: 'livingRoom' }, min: 1, max: 2 },
        { count: { piece: 'diningRoom' }, max: 1 },
      ],
    }),
    spec('underOneRoof', { outline: { minRooms: 4, minFillPct: 60, maxAspect: 2 } }),
    spec('tidyYard', {
      variety: {
        of: { any: [{ property: 'yard' }, { property: 'outbuilding' }] },
        min: 2,
        maxEach: 1,
        exempt: { piece: ['fence', 'driveway', 'sapling'] },
      },
    }),
    spec('noGarage', { none: { piece: 'garage' } }),
    spec('fewClosets', { not: { count: { piece: 'closet' }, min: 2 } }),
    spec('officeOrLibrary', {
      or: [
        { count: { piece: 'homeOffice' }, min: 1 },
        { count: { piece: 'library' }, min: 1 },
      ],
    }),
  ];
  const LEFT_OUT: SpecDef[] = [
    spec('cozy', {
      none: { all: [{ property: 'room' }, { not: { touching: { property: 'room' }, min: 2 } }] },
    }),
    KITCHEN_DINING,
    spec('fencedYard', { fencedYardTiles: { min: 4 } }),
    spec('dark', { count: { all: [{ property: 'room' }, { tag: 'Dark' }] }, min: 1 }),
  ];

  it('follows count, ratio, outline, and variety lines exactly, stage by stage', () => {
    // Two Bedrooms, a Bathroom, and a Kitchen in a 5 × 4 box (65% full), a Lawn and a Flower
    // Bed in the yard, and a hand that can turn each line on or off.
    const { R, s } = withLines(
      [...FOLLOWED, ...LEFT_OUT],
      [
        ['bedroom', 0, 4],
        ['bedroom', 2, 4],
        ['bathroom', 4, 4],
        ['kitchen', 0, 6],
        ['lawn', 6, 0],
        ['flowerBed', 8, 0],
      ],
      'bedroom',
      'kitchen',
      'livingRoom',
      'diningRoom',
      'closet',
      'garage',
      'homeOffice',
      'lawn',
      'sapling',
      'doghouse',
    );
    const ids = FOLLOWED.map((sp) => sp.id);
    const counts = { on: 0, off: 0 };
    for (const phase of [0, 1]) {
      const state = { ...s, phase };
      const { specs } = R.content.clients.hendersons;
      const layout = computeLayout(R.content, state.house);
      expect(followedLines(R.content, layout, { specs, phase })).toEqual(ids);
      const plays = R.legalPlacements(state);
      expect(plays.length).toBeGreaterThan(100);
      for (const p of plays) {
        const { specsGained, specsLost } = R.preview(state, p);
        const on = specsGained.filter((id) => ids.includes(id)).length;
        const off = specsLost.filter((id) => ids.includes(id)).length;
        expect(R.estimatePlay(state, p).specFlips).toBe(on - off);
        counts.on += on;
        counts.off += off;
      }
    }
    // The hand really does flip lines both ways.
    expect(counts.on).toBeGreaterThan(50);
    expect(counts.off).toBeGreaterThan(50);
  });

  it('flags a piece that would join an unmet pair line’s two types', () => {
    // A Kitchen and a Bedroom: a Dining Room touching the Kitchen joins the pair.
    const house: Placement[] = [
      ['kitchen', 0, 4],
      ['bedroom', 2, 4],
    ];
    const { R, s } = withLines([KITCHEN_DINING], house, 'diningRoom', 'closet');
    expect(R.estimatePlay(s, place(0, 0, 6)).specHint).toBe(true); // under the Kitchen
    expect(R.estimatePlay(s, place(0, 0, 2)).specHint).toBe(true); // over it
    expect(R.estimatePlay(s, place(0, 4, 4)).specHint).toBe(false); // the Bedroom only
    expect(R.estimatePlay(s, place(1, 0, 6)).specHint).toBe(false); // not a pair type
    // It's never in the delta: the exact score decides.
    expect(R.estimatePlay(s, place(0, 0, 6)).specFlips).toBe(0);
    // Once the pair holds, another Dining Room by the Kitchen joins nothing new.
    const held = withLines([KITCHEN_DINING], [...house, ['diningRoom', 0, 6]], 'diningRoom');
    expect(held.R.checklist(held.s).find((l) => l.id === 'kitchenDining')?.met).toBe(true);
    expect(held.R.estimatePlay(held.s, place(0, 0, 2)).specHint).toBe(false);
  });
});
