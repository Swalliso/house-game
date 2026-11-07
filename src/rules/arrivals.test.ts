// The household's arrivals (M4b, D-099): a member's cards land in the reserve's extra slots in
// the first week of their phase, after transforms and before the draw; member rooms are never
// drawn, sold, copied, or in the shop, a crate, or the Catalog; they count as Bedrooms (a
// Bedroom card can renovate one, their own card can't); Room for everyone's range rises with
// each arrival and needs their room; the Nursery grows into the Kids' Room keeping its level
// and fixture; and the ?debug panel's forceArrival. On TEST_CONTENT with a test household.

import { describe, expect, it } from 'vitest';
import type { Content, GameEvent, Household, RunState, SpecDef } from './index.ts';
import { houseRules, roomForEveryone } from '../content/house-rules.ts';
import { drawableTypes, drawWeights } from './draw.ts';
import { createRules, IllegalAction } from './run.ts';
import { canStrike, crateOptions, reserveUsed, stockGoods } from './shop.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withClient,
  type Placement,
} from './testing.ts';

/** Twins at phase 1 (a Nursery), Grandma at phase 2 (her room and a Bathroom). */
const HOUSEHOLD: Household = {
  bedrooms: [1, 2],
  arrivals: [
    {
      id: 'twins',
      name: 'The twins',
      phase: 1,
      cards: ['nursery'],
      room: ['nursery', 'kidsRoom'],
      text: 'The twins arrive.',
    },
    {
      id: 'grandma',
      name: 'Grandma',
      phase: 2,
      cards: ['grandmasRoom', 'bathroom'],
      room: ['grandmasRoom'],
      text: 'Grandma moves in.',
    },
  ],
};

const ROOM_FOR_EVERYONE: SpecDef = {
  id: 'roomForEveryone',
  name: 'Room for everyone',
  group: 'household',
  condition: roomForEveryone(HOUSEHOLD),
};

/** Three two-week phases with targets of 0, and the Hendersons' household. */
function content(over: Partial<Content['balance']> = {}): Content {
  const base = withClient({ household: HOUSEHOLD, specs: [ROOM_FOR_EVERYONE] });
  return {
    ...base,
    balance: {
      ...base.balance,
      phases: [0, 1, 2].map((k) => ({ name: `Phase ${k + 1}`, target: 0 })),
      ...over,
    },
  };
}

const C3 = content();
const r = createRules(C3);

/** Passes, leaves shops, until `stop`; returns the events on the way. */
function playUntil(s: RunState, stop: (s: RunState) => boolean, rr = r, max = 100) {
  const events: GameEvent[] = [];
  for (let k = 0; k < max && !stop(s); k++) {
    const out = rr.apply(s, s.screen === 'shop' ? { t: 'leaveShop' } : { t: 'pass' });
    events.push(...out.events);
    s = out.state;
  }
  return { state: s, events };
}

describe('arrivals', () => {
  it('land in the first week of their phase: after transforms, before the draw', () => {
    const start = r.newRun(setup('arrive'));
    expect(start.reserve).toEqual([]);
    expect(start.arrived).toEqual([]);
    // On to the shop after milestone 1, with a Sapling about to become a Tree.
    let { state } = playUntil(start, (s) => s.screen === 'shop');
    const house = houseFrom(C3, emptyRows(8, 8), [['sapling', 0, 0]]);
    state = {
      ...state,
      house: { ...house, pieces: [{ ...house.pieces[0]!, ageBonus: 4 }] },
    };
    const { state: s, events } = r.apply(state, { t: 'leaveShop' });
    // (The target of 0 is met as the phase starts; a free redraw may follow the draw.)
    expect(events.map((e) => e.t).slice(0, 5)).toEqual([
      'shopClosed',
      'targetReached',
      'transformed',
      'arrived',
      'handDrawn',
    ]);
    expect(events[3]).toEqual({ t: 'arrived', arrival: 'twins', phase: 1, cards: ['nursery'] });
    expect(s).toMatchObject({ phase: 1, slot: 1, arrived: ['twins'] });
    expect(s.reserve).toEqual([{ id: 'nursery', arrival: 'twins' }]);
    // The next week brings no one; the next phase brings Grandma, with her Bathroom.
    const week2 = r.apply(s, { t: 'pass' });
    expect(week2.events.some((e) => e.t === 'arrived')).toBe(false);
    const next = playUntil(week2.state, (x) => x.phase === 2 && x.screen === 'build');
    expect(next.events.filter((e) => e.t === 'arrived')).toEqual([
      { t: 'arrived', arrival: 'grandma', phase: 2, cards: ['grandmasRoom', 'bathroom'] },
    ]);
    expect(next.state.reserve).toEqual([
      { id: 'nursery', arrival: 'twins' },
      { id: 'grandmasRoom', arrival: 'grandma' },
      { id: 'bathroom', arrival: 'grandma' },
    ]);
  });

  it('never in an overtime week: the member waits for their phase', () => {
    // Milestone 1 needs 1 Wow, so the empty house runs into overtime first.
    const hard = createRules(content({ phases: [1, 2, 3].map((t) => ({ name: 'P', target: t })) }));
    const s0 = hard.newRun(setup('overtime'));
    const ot = playUntil(s0, (s) => s.overtimeWeek > 0, hard);
    expect(ot.state.overtimeWeek).toBe(1);
    expect(ot.events.some((e) => e.t === 'arrived')).toBe(false);
    const met = hard.apply(ot.state, { t: 'debug', op: 'addScore', amount: 1 }).state;
    const next = playUntil(met, (s) => s.phase === 1 && s.screen === 'build', hard);
    expect(next.events.filter((e) => e.t === 'arrived').map((e) => e.t)).toEqual(['arrived']);
  });

  it('take extra slots: two bought pieces still fit beside them', () => {
    const s: RunState = {
      ...r.newRun(setup('slots')),
      reserve: [
        { id: 'nursery', arrival: 'twins' },
        { id: 'grandmasRoom', arrival: 'grandma' },
        { id: 'bathroom', arrival: 'grandma' },
      ],
    };
    expect(reserveUsed(s)).toBe(0);
    const give = (x: RunState) =>
      r.apply(x, { t: 'debug', op: 'giveGood', good: { kind: 'piece', id: 'library' } }).state;
    const two = give(give(s));
    expect(reserveUsed(two)).toBe(2);
    expect(two.reserve).toHaveLength(5);
    expect(() => give(two)).toThrow('Your reserve is full. Place a piece from it first.');
  });

  it('take extra slots in the shop too: two pieces can be bought beside them, not three', () => {
    const base = r.newRun(setup('buy'));
    const s: RunState = {
      ...base,
      screen: 'shop',
      budget: 99,
      reserve: [
        { id: 'nursery', arrival: 'twins' },
        { id: 'sapling', crew: true },
      ],
      offers: {
        shop: {
          number: 2,
          offers: [
            { kind: 'piece', id: 'library' },
            { kind: 'piece', id: 'pool' },
            { kind: 'piece', id: 'sunroom' },
          ],
          sale: null,
          refreshes: 0,
          boughtAny: false,
        },
      },
    };
    const one = r.apply(s, { t: 'buy', i: 0 }).state;
    const two = r.apply(one, { t: 'buy', i: 1 }).state;
    expect(two.reserve.map((p) => p.id)).toEqual(['nursery', 'sapling', 'library', 'pool']);
    expect(r.shopOffers(two)[2]).toMatchObject({
      ok: false,
      reason: 'Your reserve is full. Place a piece from it first.',
    });
  });

  it('a member card is placed from the reserve like any reserve piece, ending the week', () => {
    const s: RunState = {
      ...r.newRun(setup('place')),
      house: houseFrom(C3, emptyRows(8, 8), [['bedroom', 0, 0]]),
      reserve: [{ id: 'nursery', arrival: 'twins' }],
    };
    expect(r.reserveFits(s, 0)).toBe(true);
    const { state, events } = r.apply(s, { t: 'place', from: 'reserve', i: 0, x: 2, y: 0, rot: 0 });
    expect(events[0]).toMatchObject({ t: 'placed', defId: 'nursery' });
    expect(events.some((e) => e.t === 'tally')).toBe(true);
    expect(state.reserve).toEqual([]);
  });
});

describe('member rooms', () => {
  it('are never drawn, even with a weight added, nor by the Catalog, nor struck', () => {
    const add = [{ kind: 'drawWeight', target: { piece: 'nursery' }, add: 50 } as const];
    for (let phase = 0; phase < 2; phase++) {
      for (const opts of [{}, { mods: add }, { special: true }]) {
        const ids = drawWeights(C, phase, opts).map((w) => w.card.id);
        for (const id of ['nursery', 'kidsRoom', 'grandmasRoom', 'ivysRoom']) {
          expect(ids).not.toContain(id);
        }
      }
    }
    expect(drawableTypes(C).some((t) => t.kind === 'piece' && C.pieces[t.id].member)).toBe(false);
    expect(canStrike(C, r.newRun(setup('strike')), { kind: 'piece', id: 'nursery' }).ok).toBe(
      false,
    );
  });

  it('are never in the shop or a crate', () => {
    const s = r.newRun(setup('shop'));
    for (let k = 0; k < 60; k++) {
      const seeded = { ...s, setup: { ...s.setup, seed: `shop-${k}` } };
      for (const shop of [1, 2]) {
        for (const o of stockGoods(C, seeded, shop, 0)) {
          if (o.kind === 'piece') expect(C.pieces[o.id].member, o.id).toBeUndefined();
        }
      }
      for (const crate of ['showroom', 'gardenCenter'] as const) {
        for (const o of crateOptions(C, seeded, crate, `crate/2/0/${k}`)) {
          if (o.kind === 'piece') expect(C.pieces[o.id].member, o.id).toBeUndefined();
        }
      }
    }
  });

  it('are never sold or copied', () => {
    const s: RunState = {
      ...r.newRun(setup('copy')),
      house: houseFrom(C3, emptyRows(8, 8), [
        ['bedroom', 0, 0],
        ['nursery', 2, 0],
      ]),
      reserve: [{ id: 'grandmasRoom', arrival: 'grandma' }],
      supplies: [{ kind: 'tool', id: 'copyMachine' }],
    };
    expect(() => r.apply(s, { t: 'sell', from: 'reserve', i: 0 } as never)).toThrow(IllegalAction);
    const nursery = s.house.pieces[1]!.uid;
    expect(r.canUseTool(s, { t: 'useTool', i: 0, target: { uid: nursery } })).toEqual({
      ok: false,
      reason: 'A household member’s room can’t be copied.',
    });
    expect(
      r.canUseTool(s, { t: 'useTool', i: 0, target: { uid: s.house.pieces[0]!.uid } }).ok,
    ).toBe(true);
  });

  it('count as Bedrooms: a Bedroom card renovates one, but a member card never renovates', () => {
    // 1 Bedroom and the Nursery: 2, the top of 1–2, so Bedrooms are at their limit.
    const s: RunState = {
      ...r.newRun(setup('renovate')),
      house: houseFrom(C3, emptyRows(8, 8), [
        ['bedroom', 0, 0],
        ['nursery', 2, 0],
      ]),
      hand: [{ kind: 'piece', id: 'bedroom' }],
      reserve: [{ id: 'grandmasRoom', arrival: 'grandma' }],
    };
    expect(r.limits(s)).toEqual([{ types: ['bedroom'], max: 2, count: 2 }]);
    const [bed, nursery] = s.house.pieces.map((p) => p.uid);
    expect(r.renovateTargets(s, 'hand', 0)).toEqual([bed, nursery]);
    expect(r.renovateTargets(s, 'reserve', 0)).toEqual([]);
    // A possessive name takes no article: "Grandma’s Room card", not "A Grandma’s Room card".
    expect(r.checkPlay(s, { t: 'renovate', from: 'reserve', i: 0, uid: bed! }).reason).toBe(
      'Grandma’s Room card can’t renovate: it’s a household member’s room.',
    );
    const { events } = r.apply(s, { t: 'renovate', from: 'hand', i: 0, uid: nursery! });
    expect(events[0]).toEqual({
      t: 'renovated',
      uid: nursery,
      defId: 'nursery',
      level: 1,
      card: 'bedroom',
    });
  });

  it('count as Bedrooms in sets: a Nursery fills a Jack-and-Jill', () => {
    const house = houseFrom(C3, emptyRows(8, 8), [
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
      ['nursery', 3, 0],
    ]);
    const s: RunState = { ...r.newRun(setup('sets')), house };
    expect(r.currentTally(s).sets.map((x) => x.set)).toEqual(['jackAndJill']);
  });

  it('the Nursery grows into the Kids’ Room 8 weeks on, keeping its uid, level, and fixture', () => {
    const house = houseFrom(C3, emptyRows(8, 8), [
      ['bedroom', 0, 0],
      ['nursery', 2, 0],
    ]);
    const s0 = r.newRun(setup('grow'));
    const nursery = {
      ...house.pieces[1]!,
      level: 1,
      fixture: { id: 'fireplace' as const, week: 1 },
    };
    // 7 weeks old already (as Fertilizer would make it): it grows at the start of next week.
    const s: RunState = {
      ...s0,
      house: { ...house, pieces: [house.pieces[0]!, { ...nursery, ageBonus: 7 }] },
    };
    const { state, events } = r.apply(s, { t: 'pass' });
    expect(events.find((e) => e.t === 'transformed')).toMatchObject({
      uid: nursery.uid,
      defId: 'nursery',
      into: { piece: 'kidsRoom' },
    });
    const grown = state.house.pieces.find((p) => p.uid === nursery.uid)!;
    expect(grown).toMatchObject({
      defId: 'kidsRoom',
      level: 1,
      fixture: { id: 'fireplace', week: 1 },
    });
    // Still the twins' room, and still a Bedroom.
    expect(r.checklist(state)[0]).toMatchObject({ id: 'roomForEveryone', met: true });
  });
});

describe('Room for everyone (built from the household)', () => {
  /** The checklist line at a phase, for a house of these pieces. */
  const line = (phase: number, pieces: readonly Placement[]) => {
    const house = houseFrom(C3, emptyRows(10, 10), pieces);
    return r.checklist({ ...r.newRun(setup('range')), house, phase })[0]!;
  };

  it('rises by one at each end with each arrival, and needs each one’s room from then on', () => {
    const one: Placement[] = [['bedroom', 0, 0]];
    const withTwins: Placement[] = [...one, ['nursery', 2, 0]];
    const withAll: Placement[] = [...withTwins, ['grandmasRoom', 4, 0]];
    // Phase 0: 1–2 Bedrooms.
    expect(line(0, one).met).toBe(true);
    expect(line(0, one).progress).toEqual([{ text: '1 Bedroom (1–2)', ok: true }]);
    // Phase 1: 2–3, and the twins' room.
    expect(line(1, one).met).toBe(false);
    expect(line(1, withTwins).met).toBe(true);
    expect(line(1, withTwins).progress).toEqual([
      { text: '2 Bedrooms (2–3)', ok: true },
      { text: '1 Nursery or Kids’ Room (≥ 1)', ok: true },
    ]);
    // Two plain Bedrooms are in the range but aren't the twins' room.
    expect(line(1, [...one, ['bedroom', 2, 0]]).progress[1]).toEqual({
      text: '0 Nurseries or Kids’ Rooms (≥ 1)',
      ok: false,
    });
    // Phase 2: 3–4, the twins' room and Grandma's.
    expect(line(2, withTwins).met).toBe(false);
    expect(line(2, withAll).met).toBe(true);
    expect(line(2, withAll).progress.map((p) => p.text)).toEqual([
      '3 Bedrooms (3–4)',
      '1 Nursery or Kids’ Room (≥ 1)',
      '1 Grandma’s Room (≥ 1)',
    ]);
  });

  it('says so in its card text', () => {
    expect(houseRules({ household: HOUSEHOLD })[0]!.text).toBe(
      'Bedrooms for the household: 1–2 to start, then one more for each arrival, and each ' +
        'arrival has their own room: 2–3 and the twins’ room from Foundation, 3–4 and ' +
        'Grandma’s room from Framing.',
    );
  });

  it('with no arrivals it’s a plain range', () => {
    expect(roomForEveryone({ bedrooms: [2, 3], arrivals: [] })).toEqual({
      count: { piece: 'bedroom' },
      min: 2,
      max: 3,
    });
  });
});

describe('forceArrival (the ?debug panel)', () => {
  it('lands a member now, once; their phase then brings no one twice', () => {
    const s = r.newRun(setup('force'));
    const { state, events } = r.apply(s, { t: 'debug', op: 'forceArrival', id: 'grandma' });
    expect(events).toEqual([
      {
        t: 'arrived',
        arrival: 'grandma',
        phase: 0,
        cards: ['grandmasRoom', 'bathroom'],
        forced: true,
      },
    ]);
    expect(state).toMatchObject({ arrived: ['grandma'], debug: true });
    expect(state.reserve).toEqual([
      { id: 'grandmasRoom', arrival: 'grandma' },
      { id: 'bathroom', arrival: 'grandma' },
    ]);
    expect(() => r.apply(state, { t: 'debug', op: 'forceArrival', id: 'grandma' })).toThrow(
      'Grandma already moved in.',
    );
    expect(() => r.apply(state, { t: 'debug', op: 'forceArrival', id: 'ivy' })).toThrow(
      'No one by that name is joining this household.',
    );
    const later = playUntil(state, (x) => x.screen === 'won');
    expect(
      later.events.filter((e) => e.t === 'arrived').map((e) => e.t === 'arrived' && e.arrival),
    ).toEqual(['twins']);
  });
});
