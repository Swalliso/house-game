// D-181 (backlog S07): a finished room, the one definition the UI's lamp and the budget payout
// share. A room is finished once it has a fixture and a level (Renovate) or an extension
// (Extend a room). None of the three goes back, so neither does finished.
//
// D-211 (S07, stage 2): finishing a room pays balance.finishReward (2 budget in the game), once,
// through payReward, with a roomFinished event right after the play's own. A play goes down one
// of three ways, and each pays: the free install from the supplies, a play that doesn't end the
// week (from Your goods, the Handyman's install from the hand, Weekend Crew's card), and the
// week's play, whose payout comes before its tally, as a find's does. preview() names the room
// a play would finish and what it pays. TEST_CONTENT pays nothing for it, so these turn it on.
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
  GameEvent,
  PieceId,
  PlacedPiece,
  Play,
  ReservePiece,
  Reward,
  RunSetup,
  RunState,
  SpecDef,
  Supply,
  ToolId,
} from './index.ts';
import { isFinished } from './finished.ts';
import { createRules } from './run.ts';
import { contentHash, decodeRunCode, encodeRunCode } from './runcode.ts';
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

// ---------------------------------------------------------------------------------------------
// D-211: finishing a room pays.

/** K, with finishing a room paying 2 budget, as the game's balance does. */
const PAY: Content = { ...K, balance: { ...K.balance, finishReward: { budget: 2 } } };
const RP = createRules(PAY);
const PAID = { budget: 2 };

const tool = (id: ToolId): Supply => ({ kind: 'tool', id });
const types = (events: readonly GameEvent[]) => events.map((e) => e.t);
function eventsOf<T extends GameEvent['t']>(
  events: readonly GameEvent[],
  t: T,
): Extract<GameEvent, { t: T }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: T }> => e.t === t);
}
const finishedIn = (events: readonly GameEvent[]) =>
  eventsOf(events, 'roomFinished').map((e) => e.uid);

/** A run on PAY in week 1 on an empty 12×12 lot, as `build`, with a reserve and a crew. */
function paying(
  placements: readonly Placement[],
  opts: {
    hand?: readonly Card[];
    reserve?: readonly ReservePiece[];
    supplies?: readonly Supply[];
    crew?: RunSetup['crewId'];
  } = {},
): RunState {
  const s = RP.newRun({ ...setup('finish-pays'), ...(opts.crew ? { crewId: opts.crew } : {}) });
  return {
    ...s,
    house: houseFrom(PAY, emptyRows(12, 12), placements),
    hand: opts.hand ?? [],
    reserve: opts.reserve ?? [],
    supplies: opts.supplies ?? [],
  };
}

/** A Bedroom (uid 1) grown by a Bedroom card from the hand: the week's play, in week 1. */
function grownBedroom(opts: Parameters<typeof paying>[1] = {}): RunState {
  const s = paying([['bedroom', 2, 2]], { ...opts, hand: [pc('bedroom'), ...(opts.hand ?? [])] });
  const grown = RP.apply(s, { t: 'extend', from: 'hand', i: 0, uid: 1, x: 4, y: 2, rot: 0 });
  // Growth alone doesn't finish a room, so it pays nothing.
  expect(finishedIn(grown.events)).toEqual([]);
  return { ...grown.state, hand: opts.hand ?? [] };
}

/** A Kitchen (uid 1) boxed in by two Bedrooms, so a Kitchen card renovates it (D-168). */
const BOXED_KITCHEN: Placement[] = [
  ['kitchen', 0, 0],
  ['bedroom', 2, 0],
  ['bedroom', 0, 2],
];

describe('finishing a room pays, once (D-211)', () => {
  it('the week’s play: a fixture from the hand in a grown room pays before the tally', () => {
    const s = withHand(grownBedroom(), [fx('fireplace')]);
    const { state, events } = RP.apply(s, { t: 'install', from: 'hand', i: 0, uid: 1 });
    expect(types(events).slice(0, 3)).toEqual(['installed', 'roomFinished', 'tally']);
    expect(eventsOf(events, 'roomFinished')).toEqual([
      { t: 'roomFinished', uid: 1, defId: 'bedroom', reward: PAID },
    ]);
    // Paid before the tally, so the tally starts from it, as from a find's.
    const tally = eventsOf(events, 'tally')[0]!;
    expect(tally.budgetBefore).toBe(s.budget + 2);
    expect(state.budget).toBe(s.budget + 2 + tally.tally.budget);
    expect(state.budgetEarned).toBe(s.budgetEarned + 2 + tally.tally.budget);
    expect(state.week).toBe(s.week + 1);
  });

  it('the week’s play: an extension of a fitted room, and a Renovation of one, each pay', () => {
    const fitted = RP.apply(paying([['bedroom', 2, 2]], { hand: [fx('fireplace')] }), {
      t: 'install',
      from: 'hand',
      i: 0,
      uid: 1,
    });
    // A fixture alone doesn't finish a room either.
    expect(finishedIn(fitted.events)).toEqual([]);
    const s = withHand(fitted.state, [pc('bedroom')]);
    const grown = RP.apply(s, { t: 'extend', from: 'hand', i: 0, uid: 1, x: 4, y: 2, rot: 0 });
    expect(types(grown.events).slice(0, 3)).toEqual(['extended', 'roomFinished', 'tally']);
    expect(eventsOf(grown.events, 'tally')[0]!.budgetBefore).toBe(s.budget + 2);

    const k = RP.apply(paying(BOXED_KITCHEN, { hand: [fx('kitchenIsland')] }), {
      t: 'install',
      from: 'hand',
      i: 0,
      uid: 1,
    }).state;
    const kitchen = withHand(k, [pc('kitchen')]);
    const renovated = RP.apply(kitchen, { t: 'renovate', from: 'hand', i: 0, uid: 1 });
    expect(types(renovated.events).slice(0, 3)).toEqual(['renovated', 'roomFinished', 'tally']);
    expect(eventsOf(renovated.events, 'roomFinished')[0]).toMatchObject({
      uid: 1,
      defId: 'kitchen',
    });
    expect(eventsOf(renovated.events, 'tally')[0]!.budgetBefore).toBe(kitchen.budget + 2);
  });

  it('the free install from the supplies pays at once, and the week goes on', () => {
    const s = { ...grownBedroom(), supplies: [supply('fireplace')] };
    const { state, events } = RP.apply(s, { t: 'install', from: 'supplies', i: 0, uid: 1 });
    expect(events).toEqual([
      { t: 'installed', uid: 1, fixture: 'fireplace', from: 'supplies' },
      { t: 'roomFinished', uid: 1, defId: 'bedroom', reward: PAID },
    ]);
    expect(state).toMatchObject({
      week: s.week,
      budget: s.budget + 2,
      budgetEarned: s.budgetEarned + 2,
      supplies: [],
    });
  });

  it('a play that doesn’t end the week pays at once: from Your goods, and the Handyman’s install', () => {
    // A Bedroom card from Your goods extends a fitted room (D-163).
    const fitted = paying([['bedroom', 2, 2]], {
      reserve: [{ id: 'bedroom' }],
      supplies: [supply('fireplace')],
    });
    const lit = RP.apply(fitted, { t: 'install', from: 'supplies', i: 0, uid: 1 }).state;
    const goods = RP.apply(lit, {
      t: 'extend',
      from: 'reserve',
      i: 0,
      uid: 1,
      x: 4,
      y: 2,
      rot: 0,
    });
    expect(types(goods.events)).toEqual(['extended', 'roomFinished']);
    expect(goods.state).toMatchObject({ week: 1, reserve: [], budget: lit.budget + 2 });

    // The Handyman installs a fixture from the hand without ending the week (D-171).
    const s = grownBedroom({ crew: 'handyman', hand: [fx('fireplace'), pc('closet')] });
    expect(RP.endsWeek(s, { t: 'install', from: 'hand', i: 0, uid: 1 })).toBe(false);
    const handy = RP.apply(s, { t: 'install', from: 'hand', i: 0, uid: 1 });
    expect(types(handy.events)).toEqual(['installed', 'roomFinished']);
    expect(handy.state).toMatchObject({ week: s.week, budget: s.budget + 2 });
    expect(handy.state.hand).toEqual([pc('closet')]);
  });

  it('Weekend Crew’s free play pays at once: its Renovation finishes a fitted room', () => {
    const k = RP.apply(paying(BOXED_KITCHEN, { hand: [fx('kitchenIsland')] }), {
      t: 'install',
      from: 'hand',
      i: 0,
      uid: 1,
    }).state;
    const s = { ...withHand(k, [pc('kitchen'), pc('closet')]), supplies: [tool('weekendCrew')] };
    const ready = RP.apply(s, { t: 'useTool', i: 0 }).state;
    expect(ready.freePlay).toBe('ready');
    const { state, events } = RP.apply(ready, { t: 'renovate', from: 'hand', i: 0, uid: 1 });
    expect(types(events)).toEqual(['renovated', 'roomFinished']);
    expect(eventsOf(events, 'renovated')[0]).toMatchObject({ free: true });
    expect(state).toMatchObject({ week: ready.week, freePlay: 'used', budget: ready.budget + 2 });
  });

  it('once: a new fixture, or a second level, in a finished room pays nothing more', () => {
    const s = { ...grownBedroom(), supplies: [supply('fireplace')] };
    const lit = RP.apply(s, { t: 'install', from: 'supplies', i: 0, uid: 1 }).state;
    const swapped = RP.apply(withHand(lit, [fx('skylight')]), {
      t: 'install',
      from: 'hand',
      i: 0,
      uid: 1,
    });
    expect(eventsOf(swapped.events, 'installed')[0]).toMatchObject({ replaced: 'fireplace' });
    expect(finishedIn(swapped.events)).toEqual([]);
    expect(eventsOf(swapped.events, 'tally')[0]!.budgetBefore).toBe(lit.budget);

    // A boxed-in Kitchen finished at level 1, then renovated to level 2.
    const k = RP.apply(paying(BOXED_KITCHEN, { hand: [fx('kitchenIsland')] }), {
      t: 'install',
      from: 'hand',
      i: 0,
      uid: 1,
    }).state;
    const one = RP.apply(withHand(k, [pc('kitchen')]), {
      t: 'renovate',
      from: 'hand',
      i: 0,
      uid: 1,
    });
    expect(finishedIn(one.events)).toEqual([1]);
    const two = RP.apply(withHand(one.state, [pc('kitchen')]), {
      t: 'renovate',
      from: 'hand',
      i: 0,
      uid: 1,
    });
    expect(pieceOf(two.state, 1).level).toBe(2);
    expect(finishedIn(two.events)).toEqual([]);
  });

  it('a demolished room’s successor is a new room: finishing it pays again', () => {
    const s = paying([['bedroom', 2, 2]], {
      hand: [pc('bedroom')],
      reserve: [{ id: 'bedroom' }, { id: 'bedroom' }],
      supplies: [supply('fireplace'), supply('fireplace')],
    });
    const paid: number[] = [];
    let tallies = 0;
    let state = s;
    const play = (a: Action) => {
      const r = RP.apply(state, a);
      paid.push(...finishedIn(r.events));
      tallies += eventsOf(r.events, 'tally').reduce((n, e) => n + e.tally.budget, 0);
      state = r.state;
    };
    play({ t: 'extend', from: 'reserve', i: 0, uid: 1, x: 4, y: 2, rot: 0 });
    play({ t: 'install', from: 'supplies', i: 0, uid: 1 });
    play({ t: 'demolish', x: 2, y: 2 });
    play({ t: 'place', from: 'hand', i: 0, x: 2, y: 2, rot: 0 });
    const uid = state.house.pieces[0]!.uid;
    expect(uid).not.toBe(1);
    play({ t: 'extend', from: 'reserve', i: 0, uid, x: 4, y: 2, rot: 0 });
    play({ t: 'install', from: 'supplies', i: 0, uid });
    expect(paid).toEqual([1, uid]);
    // 2 for each, beside what the week's tally paid.
    expect(state.budgetEarned - s.budgetEarned).toBe(4 + tallies);
  });

  it('preview names the room a play would finish and what it pays, as apply pays it', () => {
    const grown = grownBedroom({ hand: [fx('fireplace')], supplies: [supply('fireplace')] });
    const fromHand = { t: 'install', from: 'hand', i: 0, uid: 1 } as const;
    const fromSupplies = { t: 'install', from: 'supplies', i: 0, uid: 1 } as const;
    expect(RP.preview(grown, fromHand).finishes).toEqual({ uid: 1, reward: PAID });
    expect(RP.preview(grown, fromSupplies).finishes).toEqual({ uid: 1, reward: PAID });
    expect(finishedIn(RP.apply(grown, fromHand).events)).toEqual([1]);

    // An extension of a fitted room, from Your goods.
    const fitted = RP.apply(
      paying([['bedroom', 2, 2]], { reserve: [{ id: 'bedroom' }], hand: [fx('fireplace')] }),
      fromHand,
    ).state;
    const ext = { t: 'extend', from: 'reserve', i: 0, uid: 1, x: 4, y: 2, rot: 0 } as const;
    expect(RP.preview({ ...fitted, reserve: [{ id: 'bedroom' }] }, ext).finishes).toEqual({
      uid: 1,
      reward: PAID,
    });

    // None for a fixture in a room that hasn't grown, a placement, or a finished room's new
    // fixture.
    const bare = paying([['bedroom', 2, 2]], { hand: [fx('fireplace'), pc('closet')] });
    expect(RP.preview(bare, fromHand).legal).toBe(true);
    expect(RP.preview(bare, fromHand)).not.toHaveProperty('finishes');
    const place = { t: 'place', from: 'hand', i: 1, x: 4, y: 2, rot: 0 } as const;
    expect(RP.preview(bare, place).legal).toBe(true);
    expect(RP.preview(bare, place)).not.toHaveProperty('finishes');
    const lit = RP.apply(grown, fromSupplies).state;
    const again = withHand(lit, [fx('skylight')]);
    expect(RP.preview(again, fromHand)).not.toHaveProperty('finishes');

    // Where finishing pays nothing (the test content's balance), it says nothing and pays nothing.
    const plain = { ...grown, hand: [fx('fireplace')] };
    expect(R.preview(plain, fromHand)).not.toHaveProperty('finishes');
    const unpaid = R.apply(plain, fromHand);
    expect(isFinished(pieceOf(unpaid.state, 1))).toBe(true);
    expect(finishedIn(unpaid.events)).toEqual([]);
  });

  it('preview().finishes names what apply() pays, for every play from the hand, Your goods and the supplies', () => {
    // The boxed-in Kitchen (uid 1) and a Bedroom (uid 4) have fixtures and haven't grown; a
    // Bedroom (uid 5) has grown (a level) with no fixture; the boxing Bedrooms have neither.
    const s0 = paying([...BOXED_KITCHEN, ['bedroom', 6, 6], ['bedroom', 6, 10]], {
      hand: [pc('bedroom'), fx('fireplace'), pc('kitchen')],
      reserve: [{ id: 'bedroom' }, { id: 'kitchen' }],
      supplies: [supply('skylight')],
    });
    const fixture = (id: FixtureId) => ({ id, week: 1 });
    const s: RunState = {
      ...s0,
      house: {
        ...s0.house,
        pieces: s0.house.pieces.map((p) =>
          p.uid === 1
            ? { ...p, fixture: fixture('kitchenIsland') }
            : p.uid === 4
              ? { ...p, fixture: fixture('fireplace') }
              : p.uid === 5
                ? { ...p, level: 1 }
                : p,
        ),
      },
    };
    expect(s.house.pieces.filter((p) => isFinished(p))).toEqual([]);
    const fromSupplies = s.house.pieces.map((p): NonNullable<Play> => ({
      t: 'install',
      from: 'supplies',
      i: 0,
      uid: p.uid,
    }));
    const legal = RP.legalPlays(s);
    const plays = [
      ...legal.filter((p) => p.t !== 'place'),
      // A new room is never finished: a few placements stand for the rest.
      ...legal.filter((p) => p.t === 'place').slice(0, 6),
      ...fromSupplies.filter((p) => RP.preview(s, p).legal),
    ];
    const finishing = new Set<string>();
    for (const play of plays) {
      const preview = RP.preview(s, play);
      const { state, events } = RP.apply(s, play);
      const paid = eventsOf(events, 'roomFinished');
      expect(paid.length, JSON.stringify(play)).toBeLessThanOrEqual(1);
      expect(preview.finishes?.uid, JSON.stringify(play)).toBe(paid[0]?.uid);
      if (!preview.finishes) continue;
      expect(preview.finishes.reward).toEqual(PAID);
      expect(state.budgetEarned - s.budgetEarned).toBe(
        2 + eventsOf(events, 'tally').reduce((n, e) => n + e.tally.budget, 0),
      );
      if (play.t !== 'place') finishing.add(`${play.t}/${play.from}/${play.uid}`);
    }
    // Each way in: a fixture into the grown room, from the hand or the supplies; the Kitchen
    // renovated, from the hand or Your goods; the fitted Bedroom extended, from either.
    expect([...finishing].sort()).toEqual([
      'extend/hand/4',
      'extend/reserve/4',
      'install/hand/5',
      'install/supplies/5',
      'renovate/hand/1',
      'renovate/reserve/1',
    ]);
  });

  it('pays whatever finishReward holds, through payReward; a reward of zeros says and pays nothing', () => {
    const s = { ...grownBedroom(), supplies: [supply('fireplace')] };
    const fromSupplies = { t: 'install', from: 'supplies', i: 0, uid: 1 } as const;
    const rulesPaying = (finishReward: Reward) =>
      createRules({ ...K, balance: { ...K.balance, finishReward } });
    // Each kind alone, and what it changes, with the budget left as it was.
    const kinds: [Reward, Partial<RunState>][] = [
      [{ score: 7 }, { score: s.score + 7 }],
      [{ rerolls: 1 }, { bonusRerolls: s.bonusRerolls + 1 }],
      [{ demolitions: 1 }, { demolitionsLeft: s.demolitionsLeft + 1 }],
      [{ overtime: 1 }, { overtimeLeft: s.overtimeLeft + 1 }],
      [{ tool: 'catalog' }, { supplies: [tool('catalog')] }],
    ];
    for (const [reward, changed] of kinds) {
      const rr = rulesPaying(reward);
      expect(rr.preview(s, fromSupplies).finishes).toEqual({ uid: 1, reward });
      const paid = rr.apply(s, fromSupplies);
      expect(eventsOf(paid.events, 'roomFinished')).toEqual([
        { t: 'roomFinished', uid: 1, defId: 'bedroom', reward },
      ]);
      expect(paid.state).toMatchObject({ ...changed, budget: s.budget });
    }
    // Zeros pay nothing, so nothing is said: no event, no line in the preview.
    const zeros = rulesPaying({ budget: 0, score: 0 });
    expect(zeros.preview(s, fromSupplies)).not.toHaveProperty('finishes');
    const unpaid = zeros.apply(s, fromSupplies);
    expect(isFinished(pieceOf(unpaid.state, 1))).toBe(true);
    expect(types(unpaid.events)).toEqual(['installed']);
    expect(unpaid.state.budget).toBe(s.budget);
  });

  it('a run code replays the payouts exactly', () => {
    const SETUP: RunSetup = { ...setup('finish-replay'), crewId: 'handyman' };
    let state = RP.newRun(SETUP);
    const actions: Action[] = [];
    const events: GameEvent[] = [];
    const act = (a: Action) => {
      const r = RP.apply(state, a);
      actions.push(a);
      events.push(...r.events);
      state = r.state;
    };
    // A Bedroom from Your goods, where a second one from Your goods can grow it, then a
    // Fireplace from the supplies: free actions, all in week 1, so the lot's own draw decides
    // nothing.
    act({ t: 'debug', op: 'giveGood', good: { kind: 'piece', id: 'bedroom' } });
    const spots = RP.legalPlays(state).filter((p) => p.t === 'place' && p.from === 'reserve');
    let uid = 0;
    for (const spot of spots) {
      const placed = RP.apply(state, spot).state;
      const more = RP.apply(placed, {
        t: 'debug',
        op: 'giveGood',
        good: { kind: 'piece', id: 'bedroom' },
      }).state;
      if (RP.legalPlays(more).some((p) => p.t === 'extend' && p.from === 'reserve')) {
        act(spot);
        uid = state.house.pieces.at(-1)!.uid;
        break;
      }
    }
    expect(uid).toBeGreaterThan(0);
    act({ t: 'debug', op: 'giveGood', good: { kind: 'piece', id: 'bedroom' } });
    act(RP.legalPlays(state).find((p) => p.t === 'extend' && p.from === 'reserve')!);
    act({ t: 'debug', op: 'giveGood', good: { kind: 'fixture', id: 'fireplace' } });
    act({ t: 'install', from: 'supplies', i: state.supplies.length - 1, uid });
    expect(finishedIn(events)).toEqual([uid]);
    expect(state.week).toBe(1);

    const code = encodeRunCode({
      build: 'test',
      contentHash: contentHash(PAY),
      setup: SETUP,
      actions,
    });
    const decoded = decodeRunCode(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const replayed = RP.replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.state).toEqual(state);
    expect(replayed.state.budget).toBe(RP.newRun(SETUP).budget + 2);
  });
});
