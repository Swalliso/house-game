// D-188: the wrong delivery. Once a run, in the first week of `surpriseDelivery.phase`, a piece
// nobody ordered lands in the reserve's extra slots: the first in an order drawn once a run from
// `delivery/surprise` whose type isn't at a limit for the client. Never in a first job or an
// overtime week; a struck type still comes (D-157, as the stock does). It's marked `surprise`,
// it's free to build like everything in Your goods (D-163), and the pick comes from the seed
// alone, so a run code replays it. On TEST_CONTENT, with the delivery turned on.

import { describe, expect, it } from 'vitest';
import type { Action, Content, GameEvent, PieceId, RunState } from './index.ts';
import { decodeRunCode, encodeRunCode } from './runcode.ts';
import { createRules, type Rules } from './run.ts';
import { inExtraSlot, reserveUsed } from './shop.ts';
import { setup, TEST_CONTENT, withClient } from './testing.ts';

const PIECES: readonly PieceId[] = ['pool', 'hotTub', 'henhouse'];

/** Four two-week phases with targets of 0, and the wrong delivery at the third's start. */
function surprising(over: Partial<Content['balance']> = {}, base: Content = TEST_CONTENT): Content {
  return {
    ...base,
    balance: {
      ...base.balance,
      phases: [0, 1, 2, 3].map((k) => ({ name: `Phase ${k + 1}`, target: 0 })),
      surpriseDelivery: { phase: 2, pieces: PIECES },
      ...over,
    },
  };
}

const C = surprising();
const r = createRules(C);

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

const surprises = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { t: 'delivered' }> =>
      e.t === 'delivered' && e.from === 'surprise',
  );

/** The piece a run of `seed` gets at the third phase's start, on rules `rr`. */
function deliveredTo(rr: Rules, seed: string, clientId?: Parameters<typeof setup>[1]): PieceId {
  const { events } = playUntil(rr.newRun(setup(seed, clientId)), at(2), rr);
  const e = surprises(events);
  expect(e, seed).toHaveLength(1);
  return e[0]!.cards[0]!;
}

/** The first legal placement of reserve card `i`. */
function placeReserve(rr: Rules, s: RunState, i: number): Action {
  const play = rr.legalPlacements(s).find((p) => p.from === 'reserve' && p.i === i);
  if (!play) throw new Error(`reserve card ${i} has nowhere to go`);
  return play;
}

/** Rules whose client can't take any of `ids`: a wish of none of each, a limit of 0. */
function atLimit(ids: readonly PieceId[]): Rules {
  return createRules(
    withClient(
      {
        specs: ids.map((id) => ({
          id: `no-${id}`,
          name: `No ${id}`,
          group: 'wishes' as const,
          condition: { count: { piece: id }, max: 0 },
        })),
      },
      C,
    ),
  );
}

describe('the wrong delivery (D-188)', () => {
  it('comes once, in the first week of its phase, before the draw', () => {
    const start = r.newRun(setup('once'));
    expect(start.reserve).toEqual([]);
    const { state, events } = playUntil(start, at(2));
    const e = surprises(events);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ t: 'delivered', from: 'surprise', phase: 2 });
    expect(e[0]!.cards).toHaveLength(1);
    const id = e[0]!.cards[0]!;
    expect(PIECES).toContain(id);
    expect(state.reserve).toEqual([{ id, surprise: true }]);
    // At the start of the week, before its hand is drawn.
    const k = events.indexOf(e[0]!);
    expect(events.slice(k + 1).map((x) => x.t)).toEqual(['handDrawn']);
    // Nothing else brings another, to the run's last week.
    const rest = playUntil(state, at(3, 2));
    expect(surprises(rest.events)).toEqual([]);
    expect(rest.state.reserve).toEqual([{ id, surprise: true }]);
  });

  it('lands after the client’s, the stock’s and the crew’s cards the same week', () => {
    // The stock and the crew's own card first come at the third phase too (D-160, D-171).
    const base = withClient(
      { deliveries: [{ phase: 2, cards: ['homeOffice'], text: 'They bring it.' }] },
      surprising({
        standingStock: {
          fromPhase: 2,
          pieces: ['hallway', 'fence'],
          firstJobPhase: 1,
          firstJobSlot: 1,
          refill: false,
        },
      }),
    );
    const { startReserve: _start, ...crew } = base.crews.landscaper;
    const rr = createRules({
      ...base,
      crews: { ...base.crews, landscaper: { ...crew, stock: ['lawn'] } },
    });
    const s0 = rr.newRun({ ...setup('order'), crewId: 'landscaper' });
    expect(s0.reserve).toEqual([]);
    const { state, events } = playUntil(s0, at(2), rr);
    const kinds = events
      .filter((e) => e.t === 'delivered' || e.t === 'handDrawn')
      .map((e) => (e.t === 'delivered' ? `${e.t}:${e.from}` : e.t));
    expect(kinds.slice(-5)).toEqual([
      'delivered:client',
      'delivered:stock',
      'delivered:crew',
      'delivered:surprise',
      'handDrawn',
    ]);
    const id = surprises(events)[0]!.cards[0]!;
    expect(state.reserve).toEqual([
      { id: 'homeOffice', client: true },
      { id: 'hallway', stock: true },
      { id: 'fence', stock: true },
      { id: 'lawn', crew: true },
      { id, surprise: true },
    ]);
  });

  it('comes from the seed alone: the same piece for any client or crew, or after an early finish', () => {
    const got = new Map<string, PieceId>();
    for (let k = 0; k < 24; k++) got.set(`seed-${k}`, deliveredTo(r, `seed-${k}`));
    // Every one of the three comes for some seed.
    expect(new Set(got.values())).toEqual(new Set(PIECES));
    for (const [seed, id] of [...got].slice(0, 6)) {
      // The same seed again, for another client, and for another crew.
      expect(deliveredTo(r, seed)).toBe(id);
      expect(deliveredTo(r, seed, 'dale')).toBe(id);
      const crew = r.newRun({ ...setup(seed), crewId: 'architect' });
      expect(surprises(playUntil(crew, at(2)).events)[0]!.cards).toEqual([id]);
      // The second milestone completed early, in its first week: the same piece.
      const s = playUntil(r.newRun(setup(seed)), at(1)).state;
      const early = r.apply(s, { t: 'completeEarly' });
      const next = playUntil(early.state, at(2));
      expect(surprises([...early.events, ...next.events])[0]!.cards).toEqual([id]);
    }
  });

  it('never comes in a first job', () => {
    const first = { ...setup('first'), mode: 'firstJob' as const };
    const { state, events } = playUntil(r.newRun(first), at(3, 2));
    expect(state).toMatchObject({ phase: 3, slot: 2 });
    expect(surprises(events)).toEqual([]);
    expect(state.reserve.some((x) => x.surprise)).toBe(false);
  });

  it('comes once even when its phase runs into overtime', () => {
    // The third milestone needs 1 Wow, so the empty house runs into overtime there.
    const hard = createRules(
      surprising({ phases: [0, 0, 1, 0].map((target) => ({ name: 'P', target })) }),
    );
    const ot = playUntil(hard.newRun(setup('overtime')), (s) => s.overtimeWeek > 0, hard);
    expect(ot.state).toMatchObject({ phase: 2, overtimeWeek: 1 });
    expect(surprises(ot.events)).toHaveLength(1);
    const met = hard.apply(ot.state, { t: 'debug', op: 'addScore', amount: 1 }).state;
    const { events } = playUntil(met, at(3, 2), hard);
    expect(surprises(events)).toEqual([]);
  });

  it('skips a type at a limit for the client to the next in the run’s order, and none fits: none', () => {
    const seed = 'limits';
    const first = deliveredTo(r, seed);
    const second = deliveredTo(atLimit([first]), seed);
    expect(second).not.toBe(first);
    const third = deliveredTo(atLimit([first, second]), seed);
    expect([first, second]).not.toContain(third);
    expect(new Set([first, second, third])).toEqual(new Set(PIECES));
    // The order is the run's: a limit on a later piece doesn't change the first.
    expect(deliveredTo(atLimit([third]), seed)).toBe(first);
    expect(deliveredTo(atLimit([second, third]), seed)).toBe(first);
    // With all three at their limits, nothing comes.
    const none = atLimit(PIECES);
    const { state, events } = playUntil(none.newRun(setup(seed)), at(3, 2), none);
    expect(surprises(events)).toEqual([]);
    expect(state.reserve).toEqual([]);
  });

  it('still comes when its type is struck from the draws', () => {
    const id = deliveredTo(r, 'struck');
    const s = playUntil(r.newRun(setup('struck')), at(1)).state;
    const struck: RunState = { ...s, struck: [{ kind: 'piece', id }] };
    const { state, events } = playUntil(struck, at(2));
    expect(surprises(events)[0]!.cards).toEqual([id]);
    expect(state.reserve).toEqual([{ id, surprise: true }]);
  });

  it('sits in an extra slot: two bought pieces still fit beside it, not three', () => {
    const s = playUntil(r.newRun(setup('slots')), at(2)).state;
    expect(s.reserve.every(inExtraSlot)).toBe(true);
    expect(reserveUsed(s)).toBe(0);
    const give = (x: RunState) =>
      r.apply(x, { t: 'debug', op: 'giveGood', good: { kind: 'piece', id: 'library' } }).state;
    const two = give(give(s));
    expect(reserveUsed(two)).toBe(2);
    expect(() => give(two)).toThrow('Your reserve is full. Place a piece from it first.');
  });

  it('is placed from the reserve, and the week goes on (D-163)', () => {
    const s = playUntil(r.newRun(setup('place')), at(2)).state;
    const id = s.reserve[0]!.id;
    expect(r.reserveFits(s, 0)).toBe(true);
    const { state, events } = r.apply(s, placeReserve(r, s, 0));
    expect(events).toEqual([expect.objectContaining({ t: 'placed', defId: id })]);
    expect(state).toMatchObject({ phase: 2, slot: 1, hand: s.hand, reserve: [] });
    // Placed, it never comes back.
    expect(surprises(playUntil(state, at(3, 2)).events)).toEqual([]);
  });

  it('is off with no pieces: the reserve is as before', () => {
    const off = createRules(surprising({ surpriseDelivery: { phase: 2, pieces: [] } }));
    const { state, events } = playUntil(off.newRun(setup('off')), at(3, 2), off);
    expect(surprises(events)).toEqual([]);
    expect(state.reserve).toEqual([]);
  });

  it('replays exactly from a run code, the same piece from the same seed', () => {
    const s = playUntil(r.newRun(setup('replay')), at(2));
    const place = placeReserve(r, s.state, 0);
    const after = r.apply(s.state, place).state;
    const rest = playUntil(after, at(3, 2));
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
    const id = s.state.reserve[0]!.id;
    expect(replayed.state.house.pieces.some((p) => p.defId === id)).toBe(true);
  });
});
