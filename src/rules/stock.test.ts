// D-160: the standing stock and what a client brings. From `fromPhase` on, the first week of
// each milestone tops the reserve's extra slots up to one of each stock piece, adding only what's
// missing (a first job's first comes in week `firstJobSlot` of that phase); a client's
// deliveries land in the first week of their phase, after its arrivals and before the draw.
// Both are reserve cards in extra slots, placed as a week's build; neither is a household
// member, and a strike never touches them. On TEST_CONTENT, with the stock turned on.

import { describe, expect, it } from 'vitest';
import type { Action, Content, GameEvent, PieceId, ReservePiece, RunState } from './index.ts';
import { decodeRunCode, encodeRunCode } from './runcode.ts';
import { createRules, type Rules } from './run.ts';
import { inExtraSlot, reserveUsed } from './shop.ts';
import { setup, TEST_CONTENT, withClient } from './testing.ts';

/** Four two-week phases with targets of 0, the stock from phase 1, and a strike to use. */
function stocked(over: Partial<Content['balance']> = {}, base: Content = TEST_CONTENT): Content {
  return {
    ...base,
    balance: {
      ...base.balance,
      phases: [0, 1, 2, 3].map((k) => ({ name: `Phase ${k + 1}`, target: 0 })),
      rules: { ...base.balance.rules, strikes: 1 },
      standingStock: { fromPhase: 1, pieces: ['hallway', 'fence'], firstJobSlot: 2 },
      ...over,
    },
  };
}

const C = stocked();
const r = createRules(C);

const STOCK: readonly ReservePiece[] = [
  { id: 'hallway', stock: true },
  { id: 'fence', stock: true },
];

/** Passes, leaves shops, until `stop`; returns the events on the way and the actions taken. */
function playUntil(s: RunState, stop: (s: RunState) => boolean, rr: Rules = r, max = 100) {
  const events: GameEvent[] = [];
  const actions: Action[] = [];
  for (let k = 0; k < max && !stop(s); k++) {
    const a: Action = s.screen === 'shop' ? { t: 'leaveShop' } : { t: 'pass' };
    const out = rr.apply(s, a);
    actions.push(a);
    events.push(...out.events);
    s = out.state;
  }
  return { state: s, events, actions };
}

const at =
  (phase: number, slot = 1) =>
  (s: RunState) =>
    s.screen === 'build' && s.phase === phase && s.slot === slot;

const delivered = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { t: 'delivered' }> => e.t === 'delivered');

/** The first legal placement of reserve card `i`. */
function placeReserve(rr: Rules, s: RunState, i: number): Action {
  const play = rr.legalPlacements(s).find((p) => p.from === 'reserve' && p.i === i);
  if (!play) throw new Error(`reserve card ${i} has nowhere to go`);
  return play;
}

describe('the standing stock (D-160)', () => {
  it('tops up in the first week of each milestone from Foundation on, before the draw', () => {
    const start = r.newRun(setup('stock'));
    expect(start.reserve).toEqual([]);
    const { state, events } = playUntil(start, at(1));
    const e = delivered(events);
    expect(e).toEqual([{ t: 'delivered', from: 'stock', phase: 1, cards: ['hallway', 'fence'] }]);
    // After the milestone's own beats and before the hand is drawn.
    const k = events.indexOf(e[0]!);
    expect(events.findIndex((x, i) => i > k && x.t === 'handDrawn')).toBeGreaterThan(k);
    expect(events.slice(k).some((x) => x.t === 'shopClosed')).toBe(false);
    expect(state.reserve).toEqual(STOCK);
    // The phase's second week brings nothing, and nor does the next milestone with both waiting.
    const next = playUntil(state, at(2));
    expect(delivered(next.events)).toEqual([]);
    expect(next.state.reserve).toEqual(STOCK);
  });

  it('adds only what’s missing, so it never holds two of either', () => {
    const s = playUntil(r.newRun(setup('missing')), at(1)).state;
    const placed = r.apply(s, placeReserve(r, s, 0)).state;
    expect(placed.reserve).toEqual([{ id: 'fence', stock: true }]);
    const { state, events } = playUntil(placed, at(2));
    expect(delivered(events)).toEqual([
      { t: 'delivered', from: 'stock', phase: 2, cards: ['hallway'] },
    ]);
    expect(state.reserve).toEqual([
      { id: 'fence', stock: true },
      { id: 'hallway', stock: true },
    ]);
  });

  it('counts a piece of its type in another extra slot (a crew’s Fence), not a bought one', () => {
    const shop = playUntil(r.newRun(setup('crew-fence')), (s) => s.screen === 'shop').state;
    const s: RunState = {
      ...shop,
      reserve: [{ id: 'fence', crew: true }, { id: 'fence' }],
    };
    const { state, events } = r.apply(s, { t: 'leaveShop' });
    expect(delivered(events)).toEqual([
      { t: 'delivered', from: 'stock', phase: 1, cards: ['hallway'] },
    ]);
    expect(state.reserve).toEqual([
      { id: 'fence', crew: true },
      { id: 'fence' },
      { id: 'hallway', stock: true },
    ]);
  });

  it('never comes in an overtime week: it waits for the next milestone’s first week', () => {
    // Milestone 1 needs 1 Wow, so the empty house runs into overtime first.
    const hard = createRules(
      stocked({ phases: [1, 0, 0, 0].map((target) => ({ name: 'P', target })) }),
    );
    const ot = playUntil(hard.newRun(setup('overtime')), (s) => s.overtimeWeek > 0, hard);
    expect(ot.state.overtimeWeek).toBe(1);
    expect(delivered(ot.events)).toEqual([]);
    const met = hard.apply(ot.state, { t: 'debug', op: 'addScore', amount: 1 }).state;
    const { state, events } = playUntil(met, at(1), hard);
    expect(delivered(events).map((e) => e.phase)).toEqual([1]);
    expect(state.reserve).toEqual(STOCK);
  });

  it('in a first job, comes first in week firstJobSlot of Foundation, then as in any run', () => {
    const first = { ...setup('first'), mode: 'firstJob' as const };
    const week1 = playUntil(r.newRun(first), at(1));
    expect(delivered(week1.events)).toEqual([]);
    expect(week1.state.reserve).toEqual([]);
    const { state, events } = r.apply(week1.state, { t: 'pass' });
    expect(state).toMatchObject({ phase: 1, slot: 2 });
    expect(delivered(events)).toEqual([
      { t: 'delivered', from: 'stock', phase: 1, cards: ['hallway', 'fence'] },
    ]);
    // Later milestones top up in their first week.
    const used = r.apply(state, placeReserve(r, state, 1)).state;
    const next = playUntil(used, at(2));
    expect(delivered(next.events)).toEqual([
      { t: 'delivered', from: 'stock', phase: 2, cards: ['fence'] },
    ]);
  });

  it('in a first job whose Foundation is completed before that week, comes with the next', () => {
    const first = { ...setup('early'), mode: 'firstJob' as const };
    const s = playUntil(r.newRun(first), at(1)).state;
    expect(r.canCompleteEarly(s).ok).toBe(true);
    const done = r.apply(s, { t: 'completeEarly' });
    expect(delivered(done.events)).toEqual([]);
    const { state, events } = playUntil(done.state, at(2));
    expect(delivered(events)).toEqual([
      { t: 'delivered', from: 'stock', phase: 2, cards: ['hallway', 'fence'] },
    ]);
    expect(state.reserve).toEqual(STOCK);
  });

  it('sits in extra slots: two bought pieces still fit beside it, not three', () => {
    const s = playUntil(r.newRun(setup('slots')), at(1)).state;
    expect(s.reserve.every(inExtraSlot)).toBe(true);
    expect(reserveUsed(s)).toBe(0);
    const give = (x: RunState) =>
      r.apply(x, { t: 'debug', op: 'giveGood', good: { kind: 'piece', id: 'library' } }).state;
    const two = give(give(s));
    expect(reserveUsed(two)).toBe(2);
    expect(() => give(two)).toThrow('Your reserve is full. Place a piece from it first.');
  });

  it('is placed from the reserve as the week’s build', () => {
    const s = playUntil(r.newRun(setup('place')), at(1)).state;
    expect(r.reserveFits(s, 0)).toBe(true);
    const { state, events } = r.apply(s, placeReserve(r, s, 0));
    expect(events[0]).toMatchObject({ t: 'placed', defId: 'hallway' });
    expect(events.some((e) => e.t === 'tally')).toBe(true);
    expect(state).toMatchObject({ phase: 1, slot: 2 });
    expect(state.reserve).toEqual([{ id: 'fence', stock: true }]);
  });

  it('is left alone by a strike of its type, and goes on topping it up', () => {
    const s0 = playUntil(r.newRun(setup('strike')), at(1)).state;
    const s: RunState = { ...s0, hand: [{ kind: 'piece', id: 'fence' }, ...s0.hand.slice(1)] };
    const struck = r.apply(s, { t: 'strikeCard', i: 0 }).state;
    expect(struck.struck).toEqual([{ kind: 'piece', id: 'fence' }]);
    expect(struck.reserve).toEqual(STOCK);
    const used = r.apply(struck, placeReserve(r, struck, 1)).state;
    const { state, events } = playUntil(used, at(2));
    expect(delivered(events)).toEqual([
      { t: 'delivered', from: 'stock', phase: 2, cards: ['fence'] },
    ]);
    expect(state.reserve.filter((p) => p.id === 'fence')).toEqual([{ id: 'fence', stock: true }]);
  });

  it('is off with no pieces: the reserve is as before', () => {
    const off = createRules(
      stocked({ standingStock: { fromPhase: 1, pieces: [], firstJobSlot: 1 } }),
    );
    const { state, events } = playUntil(off.newRun(setup('off')), at(2), off);
    expect(delivered(events)).toEqual([]);
    expect(state.reserve).toEqual([]);
  });

  it('replays exactly from a run code', () => {
    const s = playUntil(r.newRun(setup('replay')), at(1));
    const place = placeReserve(r, s.state, 1);
    const after = r.apply(s.state, place).state;
    const rest = playUntil(after, at(3));
    const actions = [...s.actions, place, ...rest.actions];
    const code = encodeRunCode({
      build: 'test',
      contentHash: 'test',
      setup: setup('replay'),
      actions,
    });
    const decoded = decodeRunCode(code);
    if (!decoded.ok) throw new Error(decoded.error);
    const replayed = r.replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.state).toEqual(rest.state);
  });
});

describe('what a client brings (D-160)', () => {
  const brings = (phase: number, cards: readonly PieceId[], base: Content = C) =>
    withClient({ deliveries: [{ phase, cards, text: 'They bring it.' }] }, base);

  it('lands in week 1 for phase 0, in an extra slot, marked as the client’s', () => {
    const rr = createRules(brings(0, ['homeOffice']));
    const s = rr.newRun(setup('week1'));
    expect(s.reserve).toEqual([{ id: 'homeOffice', client: true }]);
    expect(s.arrived).toEqual([]);
    expect(reserveUsed(s)).toBe(0);
    // Placed like any reserve card, as the week's build; nothing comes back for it.
    const placed = rr.apply(s, placeReserve(rr, s, 0));
    expect(placed.events[0]).toMatchObject({ t: 'placed', defId: 'homeOffice' });
    const { state, events } = playUntil(placed.state, at(2), rr);
    expect(delivered(events).filter((e) => e.from === 'client')).toEqual([]);
    expect(state.reserve).toEqual(STOCK);
  });

  it('lands in its phase’s first week after the arrivals, then the stock, before the draw', () => {
    const household = {
      bedrooms: [1, 2] as const,
      arrivals: [
        {
          id: 'twins' as const,
          name: 'The twins',
          phase: 1,
          cards: ['nursery'] as const,
          room: ['nursery', 'kidsRoom'] as const,
          text: 'The twins arrive.',
        },
      ],
    };
    const rr = createRules(withClient({ household }, brings(1, ['doghouse'])));
    const { state, events } = playUntil(rr.newRun(setup('order')), at(1), rr);
    const kinds = events
      .filter((e) => ['arrived', 'delivered', 'handDrawn'].includes(e.t))
      .map((e) => (e.t === 'delivered' ? `${e.t}:${e.from}` : e.t));
    // Phase 0's two hands, then the phase 1 week's arrivals, deliveries and hand.
    expect(kinds.slice(-4)).toEqual([
      'arrived',
      'delivered:client',
      'delivered:stock',
      'handDrawn',
    ]);
    expect(delivered(events)[0]).toEqual({
      t: 'delivered',
      from: 'client',
      phase: 1,
      cards: ['doghouse'],
    });
    expect(state.reserve).toEqual([
      { id: 'nursery', arrival: 'twins' },
      { id: 'doghouse', client: true },
      ...STOCK,
    ]);
    // A delivery isn't a member: only the twins arrived.
    expect(state.arrived).toEqual(['twins']);
  });
});
