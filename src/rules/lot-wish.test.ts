// D-205: the lot's wish (S17). One feature on the lot asks for company: the Pond where there is
// one, otherwise the Old Shed (`balance.lotWish`'s order). Once `need` of the pieces it counts
// touch it, it pays its reward once: a piece into the reserve's extra slots, marked `wish`, free
// to build like everything in Your goods (D-163). It's looked at after everything that changes
// the house, a week's play before its tally. A first job carries none, and an Old Shed
// demolished before its wish paid takes the wish with it (its tool still pays). On TEST_CONTENT,
// with the wishes turned on.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Card,
  Content,
  FeatureWish,
  GameEvent,
  PieceId,
  PlaceAction,
  Rot,
  RunState,
  Supply,
} from './index.ts';
import { decodeRunCode, encodeRunCode } from './runcode.ts';
import { createRules, type Rules } from './run.ts';
import { inExtraSlot, reserveUsed } from './shop.ts';
import { houseFrom, setup, TEST_CONTENT, type Placement } from './testing.ts';

const POND_WISH: FeatureWish = { count: { tag: 'Green' }, need: 3, reward: { piece: 'hotTub' } };
const SHED_WISH: FeatureWish = {
  count: { piece: ['greenhouse', 'garage', 'herbGarden'] },
  need: 2,
  reward: { piece: 'henhouse' },
};

/**
 * TEST_CONTENT with the real content's wishes, an Old Shed that counts once as a neighbor (as
 * the real one does since D-145), and targets out of reach in 4-week phases unless `phases`.
 */
function wishing(over: Partial<Content['balance']> = {}): Content {
  const { inert: _inert, ...shed } = TEST_CONTENT.features.oldShed;
  return {
    ...TEST_CONTENT,
    features: {
      ...TEST_CONTENT.features,
      pond: { ...TEST_CONTENT.features.pond, wish: POND_WISH },
      oldShed: { ...shed, body: true, wish: SHED_WISH },
    },
    balance: {
      ...TEST_CONTENT.balance,
      weeksPerPhase: 4,
      phases: [
        { name: 'Phase 1', target: 100_000 },
        { name: 'Phase 2', target: 200_000 },
      ],
      lotWish: ['pond', 'oldShed'],
      ...over,
    },
  };
}

const C = wishing();
const R = createRules(C);

const pc = (id: PieceId): Card => ({ kind: 'piece', id });
const tool = (id: 'movingTruck'): Supply => ({ kind: 'tool', id });
const place = (
  i: number,
  x: number,
  y: number,
  from: 'hand' | 'reserve' = 'hand',
  rot: Rot = 0,
): PlaceAction => ({ t: 'place', from, i, x, y, rot });
const PASS: Action = { t: 'pass' };

/** A run in week 1 on a hand-made lot, with these pieces built and this hand. */
function onLot(
  rows: readonly string[],
  placements: readonly Placement[] = [],
  patch: Partial<RunState> = {},
  rules: Rules = R,
  content: Content = C,
): RunState {
  const s = rules.newRun(setup('wish'));
  return { ...s, house: houseFrom(content, rows, placements), hand: [], ...patch };
}

const wishEvents = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { t: 'wishFilled' }> => e.t === 'wishFilled');

// A 3 × 2 pond in the middle, an Old Shed at the top right.
const POND = [
  '..........',
  '.......SS.',
  '.......SS.',
  '...PPP....',
  '...PPP....',
  '..........',
  '..........',
  '..........',
];
// The same lot without its pond: the Old Shed asks.
const SHED_ONLY = POND.map((row) => row.replaceAll('P', '.'));

describe('which wish a lot carries', () => {
  it('the Pond where there is one, otherwise the Old Shed, otherwise none', () => {
    expect(R.lotWish(onLot(POND))).toMatchObject({ feature: 'pond', need: 3, filled: false });
    expect(R.lotWish(onLot(SHED_ONLY))).toMatchObject({ feature: 'oldShed', need: 2 });
    expect(R.lotWish(onLot(SHED_ONLY.map((row) => row.replaceAll('S', '.'))))).toBeNull();
    // A lake isn't a Pond.
    const lake = ['LLLLLLLLLL', ...SHED_ONLY.slice(1)];
    expect(R.lotWish(onLot(lake))).toMatchObject({ feature: 'oldShed' });
  });

  it('the view names its tiles, what it counts, the cards it counts and its prize', () => {
    const view = R.lotWish(onLot(POND))!;
    expect(view.cells).toEqual([
      { x: 3, y: 3 },
      { x: 4, y: 3 },
      { x: 5, y: 3 },
      { x: 3, y: 4 },
      { x: 4, y: 4 },
      { x: 5, y: 4 },
    ]);
    expect(view.count).toEqual({ tag: 'Green' });
    expect(view.reward).toEqual({ piece: 'hotTub' });
    expect(view.counted).toEqual([]);
    expect([...view.wants].sort()).toEqual(
      ['flowerBed', 'greenhouse', 'herbGarden', 'lawn', 'sapling'].sort(),
    );
    expect([...R.lotWish(onLot(SHED_ONLY))!.wants].sort()).toEqual(
      ['garage', 'greenhouse', 'herbGarden'].sort(),
    );
  });

  it('a first job carries none, and neither does a run with the list empty', () => {
    const first = R.newRun({ ...setup('wish'), mode: 'firstJob' });
    expect(R.lotWish({ ...first, house: houseFrom(C, POND) })).toBeNull();
    const off = createRules(wishing({ lotWish: [] }));
    expect(off.lotWish(onLot(POND, [], {}, off))).toBeNull();
  });
});

describe('the count', () => {
  it('counts the pieces it names that touch it, each once, and nothing else', () => {
    const s = onLot(POND, [
      // Two Flower Beds by the pond, one on its own, and a Herb Garden along its whole top.
      ['flowerBed', 2, 3],
      ['flowerBed', 6, 4],
      ['flowerBed', 0, 0],
      ['herbGarden', 3, 2],
      // Not Green, though it touches.
      ['patio', 3, 5],
    ]);
    const view = R.lotWish(s)!;
    expect(view.counted).toEqual([1, 2, 4]);
  });

  it('with a play, as it would be: a card that would touch it counts', () => {
    const s = onLot(POND, [['flowerBed', 2, 3]], { hand: [pc('flowerBed'), pc('bedroom')] });
    expect(R.lotWish(s, place(0, 6, 3))!.counted).toEqual([1, 2]);
    expect(R.lotWish(s, place(0, 0, 0))!.counted).toEqual([1]);
    // An illegal play is the house as it stands.
    expect(R.lotWish(s, place(0, 4, 4))!.counted).toEqual([1]);
  });
});

describe('filling it', () => {
  it('a week’s play that brings the third Green piece pays a Hot Tub once, before the tally', () => {
    const s = onLot(POND, [
      ['flowerBed', 2, 3],
      ['flowerBed', 6, 4],
    ]);
    const before = { ...s, hand: [pc('lawn'), pc('bedroom')] };
    const { state, events } = R.apply(before, place(0, 3, 5));
    const types = events.map((e) => e.t);
    expect(types.indexOf('placed')).toBeLessThan(types.indexOf('wishFilled'));
    expect(types.indexOf('wishFilled')).toBeLessThan(types.indexOf('tally'));
    expect(wishEvents(events)).toEqual([
      {
        t: 'wishFilled',
        feature: 'pond',
        // The pond's middle tile, the first in reading order on a tie.
        x: 4,
        y: 3,
        reward: { piece: 'hotTub' },
        pieces: [1, 2, 3],
      },
    ]);
    expect(state.wishFilled).toBe('pond');
    const card = state.reserve.at(-1)!;
    expect(card).toEqual({ id: 'hotTub', wish: true });
    // In an extra slot: it doesn't take one of the reserve's own.
    expect(inExtraSlot(card)).toBe(true);
    expect(reserveUsed(state)).toBe(reserveUsed(before));
    expect(R.lotWish(state)).toMatchObject({ filled: true, counted: [1, 2, 3] });
  });

  it('pays once: losing a piece and building another never pays again', () => {
    const s = onLot(
      POND,
      [
        ['flowerBed', 2, 3],
        ['flowerBed', 6, 4],
      ],
      { hand: [pc('flowerBed')], demolitionsLeft: 2 },
    );
    const filled = R.apply(s, place(0, 3, 5)).state;
    expect(filled.wishFilled).toBe('pond');
    const down = R.apply(filled, { t: 'demolish', x: 3, y: 5 });
    expect(wishEvents(down.events)).toEqual([]);
    const again = R.apply({ ...down.state, hand: [pc('flowerBed')] }, place(0, 4, 5));
    expect(wishEvents(again.events)).toEqual([]);
    expect(again.state.reserve.filter((r) => r.wish)).toHaveLength(1);
  });

  it('a piece from Your goods fills it at once, and the week goes on', () => {
    const s = onLot(
      POND,
      [
        ['flowerBed', 2, 3],
        ['flowerBed', 6, 4],
      ],
      { reserve: [{ id: 'flowerBed' }], hand: [pc('bedroom')] },
    );
    const { state, events } = R.apply(s, place(0, 3, 5, 'reserve'));
    expect(events.map((e) => e.t)).toEqual(['placed', 'wishFilled']);
    expect(state).toMatchObject({ week: 1, slot: 1, wishFilled: 'pond' });
    expect(state.reserve).toEqual([{ id: 'hotTub', wish: true }]);
    // Its piece is free to build too, like everything in Your goods (D-163).
    expect(R.endsWeek(state, place(0, 0, 7, 'reserve'))).toBe(false);
    const built = R.apply(state, place(0, 0, 7, 'reserve'));
    expect(built.state).toMatchObject({ week: 1, reserve: [] });
    expect(built.state.house.pieces.at(-1)!.defId).toBe('hotTub');
  });

  it('a move that brings a third Green piece beside it fills it', () => {
    const s = onLot(
      POND,
      [
        ['flowerBed', 2, 3],
        ['flowerBed', 6, 4],
        ['flowerBed', 0, 7],
      ],
      { supplies: [tool('movingTruck')] },
    );
    const { state, events } = R.apply(s, {
      t: 'useTool',
      i: 0,
      target: { uid: 3, x: 3, y: 5, rot: 0 },
    });
    expect(wishEvents(events)).toHaveLength(1);
    expect(state.wishFilled).toBe('pond');
  });

  it('a pass with the house already holding them pays it at the next look', () => {
    // A house that holds the count without having been looked at (a test's house): the
    // week's tally and the next week's transforms look again.
    const s = onLot(POND, [
      ['flowerBed', 2, 3],
      ['flowerBed', 6, 4],
      ['flowerBed', 3, 5],
    ]);
    const { state, events } = R.apply(s, PASS);
    expect(wishEvents(events)).toHaveLength(1);
    expect(state.wishFilled).toBe('pond');
  });
});

describe('its view agrees with apply()', () => {
  /** Two Flower Beds by the pond, Green cards and others in the hand, a Sapling in Your goods. */
  const twoBeds = () =>
    onLot(
      POND,
      [
        ['flowerBed', 2, 3],
        ['flowerBed', 6, 4],
      ],
      {
        hand: [pc('lawn'), pc('flowerBed'), pc('bedroom'), pc('patio')],
        reserve: [{ id: 'sapling' }],
      },
    );

  it('counts what each legal play builds, and fills exactly when apply() pays', () => {
    const s = twoBeds();
    const plays = R.legalPlays(s);
    let fills = 0;
    for (const p of plays) {
      const view = R.lotWish(s, p)!;
      const out = R.apply(s, p);
      expect(view.counted, JSON.stringify(p)).toEqual(R.lotWish(out.state)!.counted);
      const fill = view.counted.length >= view.need;
      expect(wishEvents(out.events), JSON.stringify(p)).toHaveLength(fill ? 1 : 0);
      if (fill) fills++;
    }
    // From the hand and from Your goods, some plays fill it and some don't.
    expect(fills).toBeGreaterThan(0);
    expect(fills).toBeLessThan(plays.length);
    expect(plays.some((p) => p.from === 'reserve' && R.lotWish(s, p)!.counted.length === 3)).toBe(
      true,
    );
  });

  it('never hands a view with a play to a look without one, or the other way round', () => {
    const lawn = place(0, 3, 5);
    const asIs = R.lotWish(twoBeds())!;
    expect(asIs.counted).toEqual([1, 2]);
    // With the play first, then without.
    const a = twoBeds();
    expect(R.lotWish(a, lawn)!.counted).toEqual([1, 2, 3]);
    expect(R.lotWish(a)).toEqual(asIs);
    // Without first, then with, then without again.
    const b = twoBeds();
    expect(R.lotWish(b)).toEqual(asIs);
    expect(R.lotWish(b, lawn)!.counted).toEqual([1, 2, 3]);
    expect(R.lotWish(b)).toEqual(asIs);
    // An illegal play (on the pond) is the house as it stands; a legal one after it isn't.
    const c = twoBeds();
    expect(R.lotWish(c, place(0, 4, 4))).toEqual(asIs);
    expect(R.lotWish(c, lawn)!.counted).toEqual([1, 2, 3]);
    expect(R.lotWish(c)).toEqual(asIs);
  });

  it('once it has paid, a play looked at shows the house as it stands', () => {
    const s = twoBeds();
    const paid = R.apply(s, place(0, 3, 5, 'reserve')).state;
    expect(paid.wishFilled).toBe('pond');
    // A Lawn along the pond's top would be a fourth Green piece.
    const lawn = place(0, 3, 1);
    expect(R.checkPlay(paid, lawn).legal).toBe(true);
    expect(R.lotWish(paid, lawn)).toEqual(R.lotWish(paid));
    expect(R.lotWish(paid)).toMatchObject({ filled: true, counted: [1, 2, 3] });
  });
});

describe('it settles after everything that changes the house', () => {
  /** wishing() with the Pond's wish counting `count`, one of them for a Hot Tub. */
  const pondWants = (count: FeatureWish['count'], over: Partial<Content['balance']> = {}) => {
    const c = wishing(over);
    const wish: FeatureWish = { count, need: 1, reward: { piece: 'hotTub' } };
    return { ...c, features: { ...c.features, pond: { ...c.features.pond, wish } } };
  };

  it('a fixture from the supplies that makes a piece count: at once, after the room it finishes pays (D-211)', () => {
    const content = pondWants({ hasFixture: 'any' }, { finishReward: { budget: 2 } });
    const rules = createRules(content);
    // Two Bedrooms along the pond's top, the first renovated (D-211: a fixture finishes it).
    const s = onLot(
      POND,
      [
        ['bedroom', 3, 1],
        ['bedroom', 5, 1],
      ],
      {
        supplies: [
          { kind: 'fixture', id: 'skylight' },
          { kind: 'fixture', id: 'skylight' },
        ],
      },
      rules,
      content,
    );
    const before: RunState = {
      ...s,
      house: {
        ...s.house,
        pieces: s.house.pieces.map((p) => (p.uid === 1 ? { ...p, level: 1 } : p)),
      },
    };
    expect(rules.lotWish(before)!.counted).toEqual([]);
    const { state, events } = rules.apply(before, { t: 'install', from: 'supplies', i: 0, uid: 1 });
    expect(events.map((e) => e.t)).toEqual(['installed', 'roomFinished', 'wishFilled']);
    expect(wishEvents(events)[0]).toMatchObject({ feature: 'pond', pieces: [1] });
    expect(state).toMatchObject({ week: 1, slot: 1, wishFilled: 'pond' });
    expect(state.budget).toBe(before.budget + 2);
    expect(state.reserve).toEqual([{ id: 'hotTub', wish: true }]);
    // The second Skylight, in the other Bedroom by the pond: nothing more.
    const again = rules.apply(state, { t: 'install', from: 'supplies', i: 0, uid: 2 });
    expect(again.events.map((e) => e.t)).toEqual(['installed']);
    expect(rules.lotWish(again.state)).toMatchObject({ filled: true, counted: [1, 2] });
    expect(again.state.reserve.filter((r) => r.wish)).toHaveLength(1);
  });

  it('a week’s growth that brings one: as the next week starts, before the draw, once', () => {
    const content = pondWants({ piece: 'kidsRoom' });
    const rules = createRules(content);
    // Two Nurseries along the pond's top, growing into Kids' Rooms as weeks 2 and 3 start.
    const s = onLot(
      POND,
      [
        ['nursery', 3, 1],
        ['nursery', 5, 1],
      ],
      {},
      rules,
      content,
    );
    const before: RunState = {
      ...s,
      house: {
        ...s.house,
        pieces: s.house.pieces.map((p) => ({ ...p, ageBonus: p.uid === 1 ? 7 : 6 })),
      },
    };
    expect(rules.lotWish(before)!.counted).toEqual([]);
    const week2 = rules.apply(before, PASS);
    const types = week2.events.map((e) => e.t);
    expect(types.indexOf('tally')).toBeLessThan(types.indexOf('transformed'));
    expect(types.indexOf('transformed')).toBeLessThan(types.indexOf('wishFilled'));
    expect(types.indexOf('wishFilled')).toBeLessThan(types.indexOf('handDrawn'));
    expect(wishEvents(week2.events)).toEqual([
      { t: 'wishFilled', feature: 'pond', x: 4, y: 3, reward: { piece: 'hotTub' }, pieces: [1] },
    ]);
    expect(week2.state).toMatchObject({ week: 2, wishFilled: 'pond' });
    // The second grows as week 3 starts, and pays nothing more.
    const week3 = rules.apply(week2.state, PASS);
    expect(week3.events.filter((e) => e.t === 'transformed')).toHaveLength(1);
    expect(wishEvents(week3.events)).toEqual([]);
    expect(rules.lotWish(week3.state)).toMatchObject({ filled: true, counted: [1, 2] });
    expect(week3.state.reserve.filter((r) => r.wish)).toHaveLength(1);
  });
});

describe('the Old Shed’s wish', () => {
  const SHED_LOT = [
    '..........',
    '..........',
    '...SS.....',
    '...SS.....',
    '..........',
    '..........',
    '..........',
    '..........',
  ];

  it('counts the Greenhouse, the Garage and a Herb Garden beside it, and pays a Henhouse', () => {
    const s = onLot(SHED_LOT, [
      ['greenhouse', 1, 2],
      // A Henhouse wants the shed too, but it's the prize, so it doesn't count.
      ['henhouse', 3, 4],
    ]);
    expect(R.lotWish(s)!.counted).toEqual([1]);
    const { state, events } = R.apply({ ...s, hand: [pc('herbGarden')] }, place(0, 5, 2));
    expect(wishEvents(events)).toEqual([
      {
        t: 'wishFilled',
        feature: 'oldShed',
        x: 3,
        y: 2,
        reward: { piece: 'henhouse' },
        pieces: [1, 3],
      },
    ]);
    expect(state.reserve.at(-1)).toEqual({ id: 'henhouse', wish: true });
  });

  it('demolishing it first ends the wish, says so beforehand, and still pays its tool', () => {
    const s = onLot(SHED_LOT, [['greenhouse', 1, 2]], { demolitionsLeft: 1 });
    expect(R.previewDemolish(s, 3, 2)).toMatchObject({ legal: true, endsWish: true });
    const { state, events } = R.apply(s, { t: 'demolish', x: 4, y: 3 });
    expect(events.map((e) => e.t)).toEqual(['demolished', 'findClaimed']);
    expect(state.supplies).toHaveLength(1);
    expect(R.lotWish(state)).toBeNull();
    // Nothing it counted pays now.
    const built = R.apply({ ...state, hand: [pc('herbGarden')] }, place(0, 3, 4));
    expect(wishEvents(built.events)).toEqual([]);
    expect(built.state.wishFilled).toBeUndefined();
  });

  it('once it has paid, demolishing it gives nothing up, and the view stays filled', () => {
    const s = onLot(
      SHED_LOT,
      [
        ['greenhouse', 1, 2],
        ['herbGarden', 5, 2],
      ],
      { demolitionsLeft: 1 },
    );
    const filled = R.apply(s, PASS).state;
    expect(filled.wishFilled).toBe('oldShed');
    expect(R.previewDemolish(filled, 3, 2)).not.toHaveProperty('endsWish');
    const gone = R.apply(filled, { t: 'demolish', x: 3, y: 2 }).state;
    expect(R.lotWish(gone)).toMatchObject({ feature: 'oldShed', filled: true, cells: [] });
  });

  it('on a lot with a Pond, the Shed is just a shed: its demolition ends nothing', () => {
    const s = onLot(POND, [], { demolitionsLeft: 1 });
    expect(R.previewDemolish(s, 7, 1)).not.toHaveProperty('endsWish');
  });
});

describe('a run code', () => {
  /**
   * Plays a run toward the wish: each build week, the play from the hand or Your goods that
   * adds most to the wish's count (the first of them on a tie), or a pass; Your goods' wish piece
   * goes down once it comes. Leaves shops. Stops once that piece is built or after `max` steps.
   */
  function seekWish(rules: Rules, seed: string, max = 120) {
    let s = rules.newRun(setup(seed));
    const actions: Action[] = [];
    const events: GameEvent[] = [];
    for (let k = 0; k < max && (s.screen === 'build' || s.screen === 'shop'); k++) {
      let a: Action = s.screen === 'shop' ? { t: 'leaveShop' } : PASS;
      if (s.screen === 'build') {
        const plays = rules.legalPlacements(s);
        const prize = plays.find((p) => p.from === 'reserve' && s.reserve[p.i]?.wish);
        const have = rules.lotWish(s)?.counted.length ?? 0;
        let best = 0;
        for (const p of prize ? [] : plays) {
          const gain = (rules.lotWish(s, p)?.counted.length ?? 0) - have;
          if (gain > best) [best, a] = [gain, p];
        }
        if (prize) a = prize;
      }
      const out = rules.apply(s, a);
      actions.push(a);
      events.push(...out.events);
      s = out.state;
      if (a.t === 'place' && a.from === 'reserve' && events.some((e) => e.t === 'wishFilled'))
        break;
    }
    return { state: s, actions, events };
  }

  it('replays the wish and its piece exactly', () => {
    const rules = createRules(wishing({ phases: TEST_CONTENT.balance.phases, weeksPerPhase: 2 }));
    const seed = ['wish-a', 'wish-b', 'wish-c', 'wish-d'].find(
      (k) => wishEvents(seekWish(rules, k).events).length === 1,
    );
    expect(seed).toBeDefined();
    const run = seekWish(rules, seed!);
    expect(run.state.house.pieces.some((p) => p.defId === 'hotTub')).toBe(true);
    const code = encodeRunCode({
      build: 'test',
      contentHash: 'test',
      setup: setup(seed!),
      actions: run.actions,
    });
    const decoded = decodeRunCode(code);
    if (!decoded.ok) throw new Error(decoded.error);
    const replayed = rules.replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.state).toEqual(run.state);
  });
});
