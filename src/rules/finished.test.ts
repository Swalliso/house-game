// D-181 (backlog S07): a finished room, the one definition the UI's lamp and a later budget
// payout share. A room is finished once it has a fixture and a level (Renovate) or an extension
// (Extend a room). None of the three goes back, so neither does finished.
//
// Rules tests use TEST_CONTENT (src/rules/testing.ts). These turn on extensions for Bedrooms,
// Kitchens, Living Rooms and Dining Rooms (balance.extend, as extend.test.ts does), and give the
// Hendersons a one-Kitchen line, so a second Kitchen card renovates (as renovate.test.ts does).
// Houses are built on an empty 12×12 lot with houseFrom, so uids follow the placement order.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Balance,
  Card,
  Content,
  FixtureId,
  PieceId,
  PlacedPiece,
  RunState,
  SpecDef,
  Supply,
} from './index.ts';
import { isFinished } from './finished.ts';
import { createRules } from './run.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withClient,
  type Placement,
} from './testing.ts';

const ONE_KITCHEN: SpecDef = {
  id: 'oneKitchen',
  name: 'One Kitchen',
  group: 'household',
  condition: { count: { piece: 'kitchen' }, min: 1, max: 1 },
};

const EXTEND: Balance['extend'] = {
  ...C.balance.extend,
  types: ['bedroom', 'kitchen', 'livingRoom', 'diningRoom'],
};

/** The Hendersons with one Kitchen, far-off targets, extensions on, and 4-week phases. */
const K: Content = (() => {
  const base = withClient({ specs: [ONE_KITCHEN], tastes: [] }, C);
  return {
    ...base,
    balance: {
      ...base.balance,
      weeksPerPhase: 4,
      phases: [
        { name: 'Phase 1', target: 100_000 },
        { name: 'Phase 2', target: 200_000 },
      ],
      extend: EXTEND,
    },
  };
})();
const R = createRules(K);

const pc = (id: PieceId): Card => ({ kind: 'piece', id });
const fx = (id: FixtureId): Card => ({ kind: 'fixture', id });
const supply = (id: FixtureId): Supply => ({ kind: 'fixture', id });

/** A run in week 1 on an empty 12×12 lot with these pieces, cards and supplies. */
function build(
  placements: readonly Placement[],
  opts: { hand?: readonly Card[]; supplies?: readonly Supply[] } = {},
): RunState {
  const s = R.newRun(setup('finished'));
  return {
    ...s,
    house: houseFrom(K, emptyRows(12, 12), placements),
    hand: opts.hand ?? [],
    reserve: [],
    supplies: opts.supplies ?? [],
  };
}

const pieceOf = (s: RunState, uid: number) => s.house.pieces.find((p) => p.uid === uid)!;
/** The next week's hand, so a test can play the card it wants next. */
const withHand = (s: RunState, hand: readonly Card[]): RunState => ({ ...s, hand });

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

describe('a finished room', () => {
  const room: PlacedPiece = { uid: 1, defId: 'bedroom', x: 2, y: 2, rot: 0, placedWeek: 1 };
  const fireplace = { id: 'fireplace', week: 1 } as const;

  it('has a fixture, and a level or an extension', () => {
    expect(isFinished(room)).toBe(false);
    expect(isFinished({ ...room, fixture: fireplace })).toBe(false);
    expect(isFinished({ ...room, level: 1 })).toBe(false);
    expect(isFinished({ ...room, extended: 1 })).toBe(false);
    expect(isFinished({ ...room, level: 0, extended: 0, fixture: fireplace })).toBe(false);
    expect(isFinished({ ...room, fixture: fireplace, level: 1 })).toBe(true);
    expect(isFinished({ ...room, fixture: fireplace, level: 2 })).toBe(true);
    expect(isFinished({ ...room, fixture: fireplace, extended: 1 })).toBe(true);
    expect(isFinished({ ...room, fixture: fireplace, level: 1, extended: 1 })).toBe(true);
  });

  it('reads the piece and changes nothing', () => {
    const piece = deepFreeze({ ...room, fixture: fireplace, extended: 1 });
    const copy = structuredClone(piece);
    expect(isFinished(piece)).toBe(true);
    expect(piece).toEqual(copy);
  });

  it('a fixture, then an extension: the extension finishes it', () => {
    const s = build([['bedroom', 2, 2]], { hand: [fx('fireplace')] });
    const fitted = R.apply(s, { t: 'install', from: 'hand', i: 0, uid: 1 }).state;
    expect(isFinished(pieceOf(fitted, 1))).toBe(false);
    const grown = R.apply(withHand(fitted, [pc('bedroom')]), {
      t: 'extend',
      from: 'hand',
      i: 0,
      uid: 1,
      x: 4,
      y: 2,
      rot: 0,
    }).state;
    expect(pieceOf(grown, 1)).toMatchObject({ fixture: { id: 'fireplace' }, extended: 1 });
    expect(isFinished(pieceOf(grown, 1))).toBe(true);
  });

  it('an extension, then a fixture from the supplies (a free action): the install finishes it', () => {
    const s = build([['bedroom', 2, 2]], {
      hand: [pc('bedroom')],
      supplies: [supply('fireplace')],
    });
    const grown = R.apply(s, { t: 'extend', from: 'hand', i: 0, uid: 1, x: 4, y: 2, rot: 0 });
    expect(isFinished(pieceOf(grown.state, 1))).toBe(false);
    const { state, events } = R.apply(grown.state, {
      t: 'install',
      from: 'supplies',
      i: 0,
      uid: 1,
    });
    expect(events.map((e) => e.t)).toEqual(['installed']);
    expect(isFinished(pieceOf(state, 1))).toBe(true);
  });

  it('a fixture, then a Renovation: the Renovation finishes it, and the reverse', () => {
    // A Kitchen boxed in, so the second Kitchen card can't extend it and renovates it (D-168).
    const boxed: Placement[] = [
      ['kitchen', 0, 0],
      ['bedroom', 2, 0],
      ['bedroom', 0, 2],
    ];
    const fitted = build(boxed, { hand: [fx('kitchenIsland')] });
    const a = R.apply(fitted, { t: 'install', from: 'hand', i: 0, uid: 1 }).state;
    expect(isFinished(pieceOf(a, 1))).toBe(false);
    const renovated = R.apply(withHand(a, [pc('kitchen')]), {
      t: 'renovate',
      from: 'hand',
      i: 0,
      uid: 1,
    }).state;
    expect(pieceOf(renovated, 1)).toMatchObject({ level: 1, fixture: { id: 'kitchenIsland' } });
    expect(isFinished(pieceOf(renovated, 1))).toBe(true);

    const bare = build(boxed, { hand: [pc('kitchen')] });
    const b = R.apply(bare, { t: 'renovate', from: 'hand', i: 0, uid: 1 }).state;
    expect(isFinished(pieceOf(b, 1))).toBe(false);
    const done = R.apply(withHand(b, [fx('kitchenIsland')]), {
      t: 'install',
      from: 'hand',
      i: 0,
      uid: 1,
    }).state;
    expect(isFinished(pieceOf(done, 1))).toBe(true);
  });

  it('stays finished when its fixture is replaced', () => {
    const s = build([['bedroom', 2, 2]], {
      hand: [pc('bedroom')],
      supplies: [supply('fireplace')],
    });
    const grown = R.apply(s, { t: 'extend', from: 'hand', i: 0, uid: 1, x: 4, y: 2, rot: 0 });
    const lit = R.apply(grown.state, { t: 'install', from: 'supplies', i: 0, uid: 1 }).state;
    const swapped = R.apply(withHand(lit, [fx('skylight')]), {
      t: 'install',
      from: 'hand',
      i: 0,
      uid: 1,
    });
    expect(swapped.events.find((e) => e.t === 'installed')).toMatchObject({
      fixture: 'skylight',
      replaced: 'fireplace',
    });
    expect(isFinished(pieceOf(swapped.state, 1))).toBe(true);
  });

  it('a Bathroom with a fixture never grows, so it never finishes', () => {
    const s = build([['bathroom', 2, 2]], { hand: [fx('skylight'), pc('bathroom')] });
    const fitted = R.apply(s, { t: 'install', from: 'hand', i: 0, uid: 1 }).state;
    const next = withHand(fitted, [pc('bathroom')]);
    const plays: Action[] = R.legalPlays(next);
    expect(plays.some((p) => p.t === 'extend' || p.t === 'renovate')).toBe(false);
    expect(isFinished(pieceOf(next, 1))).toBe(false);
  });
});
