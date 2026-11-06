// Run codes and debug hooks for M3a (implementation-plan.md §4 "Actions, events, and the API",
// §6 "Run codes"; CLAUDE.md: decodeRunCode rebuilds every action field by field). Every new
// action round-trips exactly, decoding keeps only known fields (nested strikes and goods too)
// and rejects damaged forms without throwing, a real M3a run (shop, sells, refresh, strike,
// installs, the reserve, forceShop, giveGood) replays exactly from its code, and a stale code
// stops at the step that fails. Then the ?debug hooks themselves: forceShop opens the shop
// mid-week and leaving returns to the same week; giveGood puts a good where buying would.
// Rules tests use TEST_CONTENT (src/rules/testing.ts), never src/content.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type {
  Action,
  BlueprintId,
  Content,
  FixtureId,
  GameEvent,
  Good,
  InstallAction,
  PieceId,
  PlaceAction,
  Rot,
  RunCodeData,
  RunSetup,
  RunState,
  ServiceId,
  ShopOffer,
} from './index.ts';
import { drawHand, slotKey } from './draw.ts';
import { createRules, IllegalAction, type Rules } from './run.ts';
import { base64urlEncode, contentHash, decodeRunCode, encodeRunCode } from './runcode.ts';
import { SHOP_REASONS } from './shop.ts';
import { setup, TEST_CONTENT as C } from './testing.ts';

const rules = createRules(C);

const BASE: RunCodeData = {
  build: 'm3test',
  contentHash: contentHash(C),
  setup: setup('runcode-m3'),
  actions: [],
};

/** One of each M3a action form (and each Good kind), with values that aren't defaults. */
const M3_ACTIONS: readonly Action[] = [
  { t: 'place', from: 'reserve', i: 1, x: 9, y: 14, rot: 2 },
  { t: 'install', from: 'hand', i: 3, uid: 12 },
  { t: 'install', from: 'supplies', i: 2, uid: 1 },
  { t: 'sell', from: 'blueprints', i: 3 },
  { t: 'sell', from: 'supplies', i: 0 },
  { t: 'buy', i: 0 },
  { t: 'buy', i: 6, strike: { kind: 'piece', id: 'fence' } },
  { t: 'buy', i: 6, strike: { kind: 'fixture', id: 'skylight' } },
  { t: 'refreshShop' },
  { t: 'leaveShop' },
  { t: 'debug', op: 'forceShop' },
  { t: 'debug', op: 'giveGood', good: { kind: 'blueprint', id: 'crownJewel' } },
  { t: 'debug', op: 'giveGood', good: { kind: 'piece', id: 'pool' } },
  { t: 'debug', op: 'giveGood', good: { kind: 'fixture', id: 'pergola' } },
  { t: 'debug', op: 'giveGood', good: { kind: 'fixtureCard', id: 'bayWindow' } },
];

/**
 * A run code built from raw JSON, bypassing encodeRunCode's typed payload, so a test can put
 * anything in it. ASCII only, so each character is one byte.
 */
function rawCode(payload: unknown): string {
  const json = JSON.stringify(payload);
  expect(json).toMatch(/^[\x20-\x7e]*$/);
  return 'OH1.' + base64urlEncode([...json].map((c) => c.charCodeAt(0)));
}

const rawWith = (actions: readonly unknown[], extra: Record<string, unknown> = {}) =>
  rawCode({ ...BASE, actions, ...extra });

/** Decodes, failing the test (rather than crashing it) if decoding throws. */
function safeDecode(code: string) {
  let result: ReturnType<typeof decodeRunCode> | undefined;
  expect(() => {
    result = decodeRunCode(code);
  }).not.toThrow();
  return result!;
}

const eventsOf = <K extends GameEvent['t']>(events: readonly GameEvent[], t: K) =>
  events.filter((e): e is Extract<GameEvent, { t: K }> => e.t === t);

// ---------------------------------------------------------------------------------------
// Encoding and decoding.

describe('run codes round-trip every M3a action', () => {
  it.each(M3_ACTIONS.map((a) => [JSON.stringify(a), a] as const))('%s', (_, action) => {
    const data: RunCodeData = { ...BASE, actions: [action] };
    expect(decodeRunCode(encodeRunCode(data))).toStrictEqual({ ok: true, data });
  });

  it('all of them in one log, in order, with a pending install from the hand or the supplies', () => {
    for (const pending of [
      { t: 'install', from: 'hand', i: 2, uid: 7 },
      { t: 'install', from: 'supplies', i: 0, uid: 3 },
      { t: 'place', from: 'reserve', i: 0, x: 4, y: 5, rot: 1 },
    ] as const) {
      const data: RunCodeData = { ...BASE, actions: M3_ACTIONS, pending };
      const code = encodeRunCode(data);
      const decoded = decodeRunCode(code);
      expect(decoded).toStrictEqual({ ok: true, data });
      // Re-encoding a decoded code gives the same string.
      expect(decoded.ok && encodeRunCode(decoded.data)).toBe(code);
    }
  });

  it('any well-formed M3a action log round-trips exactly (property)', () => {
    const int = fc.integer({ min: -1000, max: 1000 });
    const pieceIds = Object.keys(C.pieces) as PieceId[];
    const fixtureIds = Object.keys(C.fixtures) as FixtureId[];
    const blueprintIds = Object.keys(C.blueprints) as BlueprintId[];
    const cardType = fc.oneof(
      fc.record({ kind: fc.constant('piece' as const), id: fc.constantFrom(...pieceIds) }),
      fc.record({ kind: fc.constant('fixture' as const), id: fc.constantFrom(...fixtureIds) }),
    );
    const good: fc.Arbitrary<Good> = fc.oneof(
      fc.record({ kind: fc.constant('blueprint' as const), id: fc.constantFrom(...blueprintIds) }),
      fc.record({ kind: fc.constant('piece' as const), id: fc.constantFrom(...pieceIds) }),
      fc.record({ kind: fc.constant('fixture' as const), id: fc.constantFrom(...fixtureIds) }),
      fc.record({ kind: fc.constant('fixtureCard' as const), id: fc.constantFrom(...fixtureIds) }),
    );
    const rot = fc.constantFrom<Rot>(0, 1, 2, 3);
    const action: fc.Arbitrary<Action> = fc.oneof(
      fc.record({
        t: fc.constant('place' as const),
        from: fc.constantFrom('hand' as const, 'reserve' as const),
        i: int,
        x: int,
        y: int,
        rot,
      }),
      fc.record({
        t: fc.constant('install' as const),
        from: fc.constantFrom('hand' as const, 'supplies' as const),
        i: int,
        uid: int,
      }),
      fc.record({
        t: fc.constant('sell' as const),
        from: fc.constantFrom('blueprints' as const, 'supplies' as const),
        i: int,
      }),
      fc.record({ t: fc.constant('buy' as const), i: int }),
      fc.record({ t: fc.constant('buy' as const), i: int, strike: cardType }),
      fc.constant({ t: 'refreshShop' as const }),
      fc.constant({ t: 'leaveShop' as const }),
      fc.constant({ t: 'debug' as const, op: 'forceShop' as const }),
      fc.record({ t: fc.constant('debug' as const), op: fc.constant('giveGood' as const), good }),
    );
    fc.assert(
      fc.property(fc.array(action, { maxLength: 12 }), (actions) => {
        // fc.record builds null-prototype objects, nested ones too; decoding gives plain ones.
        const plain = JSON.parse(JSON.stringify(actions)) as Action[];
        const data: RunCodeData = { ...BASE, actions: plain };
        expect(decodeRunCode(encodeRunCode(data))).toStrictEqual({ ok: true, data });
      }),
    );
  });
});

describe('decoding keeps only the known fields of M3a actions', () => {
  it('strips unknown fields from every M3a action', () => {
    const junk = { extra: 1, note: 'hi', nested: { a: [1, 2] } };
    const dirty = M3_ACTIONS.map((a) => ({ ...junk, ...a }));
    expect(safeDecode(rawWith(dirty))).toStrictEqual({
      ok: true,
      data: { ...BASE, actions: M3_ACTIONS },
    });
  });

  it('strips junk inside a strike and a good, and fields of other action kinds', () => {
    const dirty = [
      { t: 'buy', i: 6, strike: { kind: 'piece', id: 'fence', uid: 3, sold: true }, from: 'hand' },
      { t: 'buy', i: 1, x: 2, y: 3, good: { kind: 'blueprint', id: 'fengShui' } },
      { t: 'install', from: 'hand', i: 0, uid: 3, x: 1, y: 2, rot: 0, strike: {} },
      { t: 'place', from: 'reserve', i: 0, x: 1, y: 2, rot: 1, uid: 4 },
      { t: 'sell', from: 'supplies', i: 0, uid: 2, kind: 'fixture' },
      { t: 'refreshShop', i: 2, price: 3 },
      { t: 'leaveShop', on: true },
      { t: 'debug', op: 'forceShop', good: { kind: 'piece', id: 'pool' }, amount: 3 },
      {
        t: 'debug',
        op: 'giveGood',
        good: { kind: 'fixtureCard', id: 'bayWindow', week: 4, uid: 1 },
        id: 'garage',
        amount: 1,
      },
    ];
    expect(safeDecode(rawWith(dirty))).toStrictEqual({
      ok: true,
      data: {
        ...BASE,
        actions: [
          { t: 'buy', i: 6, strike: { kind: 'piece', id: 'fence' } },
          { t: 'buy', i: 1 },
          { t: 'install', from: 'hand', i: 0, uid: 3 },
          { t: 'place', from: 'reserve', i: 0, x: 1, y: 2, rot: 1 },
          { t: 'sell', from: 'supplies', i: 0 },
          { t: 'refreshShop' },
          { t: 'leaveShop' },
          { t: 'debug', op: 'forceShop' },
          { t: 'debug', op: 'giveGood', good: { kind: 'fixtureCard', id: 'bayWindow' } },
        ],
      },
    });
  });

  it('strips unknown fields from a pending install', () => {
    const code = rawWith([{ t: 'leaveShop' }], {
      pending: { t: 'install', from: 'supplies', i: 1, uid: 5, x: 3, y: 4, rot: 0, ghost: true },
    });
    expect(safeDecode(code)).toStrictEqual({
      ok: true,
      data: {
        ...BASE,
        actions: [{ t: 'leaveShop' }],
        pending: { t: 'install', from: 'supplies', i: 1, uid: 5 },
      },
    });
  });
});

describe('decoding rejects damaged M3a actions without throwing', () => {
  const badActions: [string, unknown][] = [
    ['a place from the supplies', { t: 'place', from: 'supplies', i: 0, x: 0, y: 0, rot: 0 }],
    ['a place from the blueprints', { t: 'place', from: 'blueprints', i: 0, x: 0, y: 0, rot: 0 }],
    ['an install with no uid', { t: 'install', from: 'hand', i: 0 }],
    ['an install with a fractional i', { t: 'install', from: 'hand', i: 0.5, uid: 1 }],
    ['an install with a string i', { t: 'install', from: 'supplies', i: '0', uid: 1 }],
    ['an install with a string uid', { t: 'install', from: 'supplies', i: 0, uid: '1' }],
    ['an install from the reserve', { t: 'install', from: 'reserve', i: 0, uid: 1 }],
    ['an install with no source', { t: 'install', i: 0, uid: 1 }],
    ['a sell from the reserve', { t: 'sell', from: 'reserve', i: 0 }],
    ['a sell from the hand', { t: 'sell', from: 'hand', i: 0 }],
    ['a sell with a fractional i', { t: 'sell', from: 'blueprints', i: 1.5 }],
    ['a sell with no i', { t: 'sell', from: 'supplies' }],
    ['a buy with a fractional i', { t: 'buy', i: 2.5 }],
    ['a buy with a string i', { t: 'buy', i: '2' }],
    ['a buy with no i', { t: 'buy' }],
    ['a strike of an unknown kind', { t: 'buy', i: 6, strike: { kind: 'tool', id: 'hammer' } }],
    ['a strike of a blueprint', { t: 'buy', i: 6, strike: { kind: 'blueprint', id: 'fengShui' } }],
    ['a strike with no kind', { t: 'buy', i: 6, strike: { id: 'fence' } }],
    ['a strike with no id', { t: 'buy', i: 6, strike: { kind: 'piece' } }],
    ['a strike with a numeric id', { t: 'buy', i: 6, strike: { kind: 'fixture', id: 3 } }],
    ['a strike as a bare string', { t: 'buy', i: 6, strike: 'fence' }],
    [
      'giveGood with an unknown kind',
      { t: 'debug', op: 'giveGood', good: { kind: 'tool', id: 'x' } },
    ],
    [
      'giveGood with a service',
      { t: 'debug', op: 'giveGood', good: { kind: 'service', id: 'reroll' } },
    ],
    ['giveGood with no id', { t: 'debug', op: 'giveGood', good: { kind: 'blueprint' } }],
    ['giveGood with a numeric id', { t: 'debug', op: 'giveGood', good: { kind: 'piece', id: 7 } }],
    ['giveGood with no good', { t: 'debug', op: 'giveGood' }],
    [
      'giveGood with the good spread flat',
      { t: 'debug', op: 'giveGood', kind: 'piece', id: 'pool' },
    ],
    ['giveGood with a good array', { t: 'debug', op: 'giveGood', good: ['piece', 'pool'] }],
  ];

  it.each(badActions)('%s', (_, bad) => {
    // On its own, and after valid actions: one bad action rejects the whole code.
    for (const actions of [[bad], [{ t: 'debug', op: 'forceShop' }, { t: 'refreshShop' }, bad]]) {
      expect(safeDecode(rawWith(actions))).toStrictEqual({
        ok: false,
        error: expect.stringMatching(/action/),
      });
    }
  });

  it('a damaged pending install or a pending action that is not a play', () => {
    for (const pending of [
      { t: 'install', from: 'hand', i: 0 },
      { t: 'install', from: 'reserve', i: 0, uid: 1 },
      { t: 'install', from: 'supplies', i: 0.5, uid: 1 },
      { t: 'place', from: 'supplies', i: 0, x: 0, y: 0, rot: 0 },
      { t: 'buy', i: 0 },
      { t: 'debug', op: 'forceShop' },
    ]) {
      expect(safeDecode(rawWith([{ t: 'pass' }], { pending }))).toStrictEqual({
        ok: false,
        error: expect.stringMatching(/pending/),
      });
    }
  });
});

// ---------------------------------------------------------------------------------------
// Determinism: a scripted M3a run, through both kinds of shop, replays exactly from its code.

const SEED = 'm3-code-a';

interface Played {
  setup: RunSetup;
  log: Action[];
  states: RunState[];
  events: GameEvent[][];
  final: RunState;
  /** A legal install from the hand on the final state, for the code's `pending`. */
  pending: InstallAction;
  /** Indexes into the log. */
  at: { firstBuy: number; strike: number };
}

function playM3Run(): Played {
  const runSetup = setup(SEED);
  let state = rules.newRun(runSetup);
  const log: Action[] = [];
  const states: RunState[] = [];
  const events: GameEvent[][] = [];
  const act = (action: Action) => {
    const out = rules.apply(state, action);
    log.push(action);
    states.push(out.state);
    events.push(out.events);
    state = out.state;
  };
  /** The first offer of this kind that can be bought now. */
  const offerOf = (kind: Exclude<ShopOffer['kind'], 'service'>) => {
    const view = rules.shopOffers(state).find((o) => o.offer.kind === kind && o.ok);
    if (!view) throw new Error(`No ${kind} to buy in this shop`);
    return view.i;
  };
  const serviceOf = (service: ServiceId) =>
    rules.shopOffers(state).find((o) => o.offer.kind === 'service' && o.offer.service === service)!
      .i;
  const firstPlacement = (from: PlaceAction['from'], ok: (p: PlaceAction) => boolean) => {
    const play = rules.legalPlacements(state).find((p) => p.from === from && ok(p));
    if (!play) throw new Error(`No legal placement from the ${from}`);
    return play;
  };
  const isRoom = (p: PlaceAction) => {
    const card = state.hand[p.i]!;
    if (card.kind !== 'piece') return false;
    const def = C.pieces[card.id];
    return def.category === 'indoor' && !def.connector;
  };

  act({ t: 'debug', op: 'addBudget', amount: 40 });
  // Phase 1, week 1: a room from the hand, to host fixtures later.
  act(firstPlacement('hand', isRoom));
  const host = state.house.pieces[0]!.uid;

  // Week 2: the ?debug panel opens shop 1 mid-week.
  act({ t: 'debug', op: 'forceShop' });
  const firstBuy = log.length;
  act({ t: 'buy', i: offerOf('blueprint') });
  act({ t: 'refreshShop' });
  act({ t: 'buy', i: offerOf('piece') });
  act({ t: 'buy', i: offerOf('fixture') });
  const strike = log.length;
  act({ t: 'buy', i: serviceOf('strike'), strike: { kind: 'piece', id: 'fence' } });
  act({ t: 'sell', from: 'blueprints', i: 0 });
  act({ t: 'leaveShop' });

  // Still week 2: the bought fixture goes in for free; then a Fireplace card replaces it as
  // the week's turn, which ends the phase with its target met.
  act({ t: 'install', from: 'supplies', i: 0, uid: host });
  act({ t: 'debug', op: 'addScore', amount: 10 });
  act({ t: 'debug', op: 'giveGood', good: { kind: 'fixtureCard', id: 'fireplace' } });
  act({ t: 'install', from: 'hand', i: state.hand.length - 1, uid: host });

  // Milestone 1 met: the regular shop 1.
  act({ t: 'buy', i: serviceOf('reroll') });
  act({ t: 'debug', op: 'giveGood', good: { kind: 'fixture', id: 'gardenLights' } });
  act({ t: 'sell', from: 'supplies', i: 0 });
  act({ t: 'leaveShop' });

  // Phase 2, week 1: the bought piece from the reserve is the week's turn.
  act(firstPlacement('reserve', () => true));

  // Week 2: free actions, and a fixture card left pending.
  act({ t: 'reroll' });
  act({ t: 'debug', op: 'giveGood', good: { kind: 'blueprint', id: 'crownJewel' } });
  act({ t: 'debug', op: 'giveGood', good: { kind: 'piece', id: 'library' } });
  act({ t: 'sell', from: 'blueprints', i: 0 });
  act({ t: 'debug', op: 'giveGood', good: { kind: 'fixtureCard', id: 'skylight' } });
  const pending: InstallAction = {
    t: 'install',
    from: 'hand',
    i: state.hand.length - 1,
    uid: host,
  };
  return { setup: runSetup, log, states, events, final: state, pending, at: { firstBuy, strike } };
}

let memo: Played | undefined;
const played = () => (memo ??= playM3Run());

const codeOf = (p: Played, content: Content = C) =>
  encodeRunCode({
    build: 'm3test',
    contentHash: contentHash(content),
    setup: p.setup,
    actions: p.log,
    pending: p.pending,
  });

describe('a real M3a run replays exactly from its run code', () => {
  it('the scripted run went through both shops and used every M3a action form', () => {
    const p = played();
    const has = (pred: (a: Action) => boolean) => expect(p.log.some(pred)).toBe(true);
    has((a) => a.t === 'place' && a.from === 'reserve');
    has((a) => a.t === 'install' && a.from === 'hand');
    has((a) => a.t === 'install' && a.from === 'supplies');
    has((a) => a.t === 'sell' && a.from === 'blueprints');
    has((a) => a.t === 'sell' && a.from === 'supplies');
    has((a) => a.t === 'buy' && a.strike === undefined);
    has((a) => a.t === 'buy' && a.strike?.kind === 'piece');
    has((a) => a.t === 'refreshShop');
    has((a) => a.t === 'leaveShop');
    has((a) => a.t === 'debug' && a.op === 'forceShop');
    for (const kind of ['blueprint', 'piece', 'fixture', 'fixtureCard'] as const) {
      has((a) => a.t === 'debug' && a.op === 'giveGood' && a.good.kind === kind);
    }
    const all = p.events.flat();
    // A forced shop, then shop 1 after the milestone; the hand install replaced the supply one.
    expect(eventsOf(all, 'shopOpened').map((e) => e.number)).toEqual([1, 1]);
    expect(
      p.states[p.log.findIndex((a) => a.t === 'debug' && a.op === 'forceShop')]!.offers,
    ).toMatchObject({ shop: { forced: true } });
    expect(eventsOf(all, 'milestone')).toMatchObject([{ phase: 0, result: 'onTime' }]);
    const boughtFixture = eventsOf(all, 'bought').find((e) => e.offer.kind === 'fixture')!.offer;
    expect(boughtFixture.kind).toBe('fixture');
    const supplyId = (boughtFixture as Extract<ShopOffer, { kind: 'fixture' }>).id;
    expect(eventsOf(all, 'installed')).toStrictEqual([
      { t: 'installed', uid: p.pending.uid, fixture: supplyId, from: 'supplies' },
      {
        t: 'installed',
        uid: p.pending.uid,
        fixture: 'fireplace',
        from: 'hand',
        replaced: supplyId,
      },
    ]);
    // The strike held: no Fence or L-Fence in any hand drawn after it.
    const later = p.events.slice(p.at.strike + 1).flat();
    for (const e of eventsOf(later, 'handDrawn')) {
      expect(e.hand.filter((c) => c.id === 'fence' || c.id === 'lFence')).toEqual([]);
    }
    expect(p.final).toMatchObject({ screen: 'build', phase: 1, slot: 2, debug: true });
    expect(rules.checkPlay(p.final, p.pending).legal).toBe(true);
  });

  it('decodes to the same log, and replay() rebuilds the same state', () => {
    const p = played();
    const decoded = decodeRunCode(codeOf(p));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.data.actions).toStrictEqual(p.log);
    expect(decoded.data.setup).toStrictEqual(p.setup);
    expect(decoded.data.pending).toStrictEqual(p.pending);

    const replayed = rules.replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.error).toBeUndefined();
    expect(replayed.state).toStrictEqual(p.final);
    // A fresh rules object (no caches carried over) agrees, down to the JSON.
    const fresh = createRules(C).replay(decoded.data.setup, decoded.data.actions);
    expect(fresh.failedAt).toBeUndefined();
    expect(JSON.stringify(fresh.state)).toBe(JSON.stringify(p.final));
  });

  it('step by step, every intermediate state and every event matches', () => {
    const p = played();
    const decoded = decodeRunCode(codeOf(p));
    if (!decoded.ok) throw new Error(decoded.error);
    const fresh = createRules(C);
    let s = fresh.newRun(decoded.data.setup);
    decoded.data.actions.forEach((action, n) => {
      const step = fresh.apply(s, action);
      expect(step.events).toStrictEqual(p.events[n]);
      expect(step.state).toStrictEqual(p.states[n]);
      s = step.state;
    });
  });

  it('the pending install previews the same on the replayed state, and as apply scores it', () => {
    const p = played();
    const decoded = decodeRunCode(codeOf(p));
    if (!decoded.ok) throw new Error(decoded.error);
    const fresh = createRules(C);
    const replayed = fresh.replay(decoded.data.setup, decoded.data.actions).state;
    const preview = fresh.preview(replayed, decoded.data.pending!);
    expect(preview).toStrictEqual(rules.preview(p.final, p.pending));
    expect(preview).toMatchObject({ legal: true, host: p.pending.uid });
    // The host holds the Fireplace, so the Skylight would replace it.
    expect(preview.replaces).toBe('fireplace');
    const tally = eventsOf(fresh.apply(replayed, decoded.data.pending!).events, 'tally')[0]!;
    expect(tally.tally.total).toBe(preview.after.total);
  });
});

describe('a stale run code stops at the step that fails', () => {
  it('replayed against content with dearer blueprints, it fails at the first purchase', () => {
    const p = played();
    const dearer: Content = {
      ...C,
      blueprints: Object.fromEntries(
        Object.entries(C.blueprints).map(([id, def]) => [id, { ...def, price: 99 }]),
      ) as Content['blueprints'],
    };
    // The code says which content it came from, so the UI can tell.
    expect(contentHash(dearer)).not.toBe(contentHash(C));
    const decoded = decodeRunCode(codeOf(p));
    if (!decoded.ok) throw new Error(decoded.error);
    const result = createRules(dearer).replay(decoded.data.setup, decoded.data.actions);
    // The first buy is a blueprint: 99 > the 40 budget the cheat gave.
    expect(p.log[p.at.firstBuy]).toMatchObject({ t: 'buy' });
    expect(result.failedAt).toBe(p.at.firstBuy);
    expect(result.error).toBe(SHOP_REASONS.budget);
    // The state is the one just before it: the forced shop, as the live run had it.
    expect(result.state).toStrictEqual(p.states[p.at.firstBuy - 1]);
  });

  it('a giveGood for a blueprint this build lacks stops the replay there, softly', () => {
    const p = played();
    const k = p.at.strike;
    const actions = [
      ...p.log.slice(0, k),
      { t: 'debug', op: 'giveGood', good: { kind: 'blueprint', id: 'dragonLair' } },
      ...p.log.slice(k),
    ];
    const decoded = safeDecode(rawWith(actions, { setup: p.setup }));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const result = rules.replay(decoded.data.setup, decoded.data.actions);
    expect(result.failedAt).toBe(k);
    expect(result.error).toEqual(expect.any(String));
    expect(result.state).toStrictEqual(p.states[k - 1]);
    expect(() => rules.legalActions(result.state)).not.toThrow();
  });

  it('a strike bought without naming a card stops the replay there', () => {
    const p = played();
    const k = p.at.strike;
    const actions = p.log.map((a, n) => (n === k ? { t: 'buy', i: (a as { i: number }).i } : a));
    const decoded = safeDecode(rawWith(actions, { setup: p.setup }));
    if (!decoded.ok) throw new Error(decoded.error);
    const result = rules.replay(decoded.data.setup, decoded.data.actions);
    expect(result.failedAt).toBe(k);
    expect(result.error).toBe('Pick a card type to strike.');
    expect(result.state).toStrictEqual(p.states[k - 1]);
  });

  // §4: apply throws IllegalAction with a reason. A code from another build can name a piece
  // this one lacks; with a strike already made, that must still be a clean refusal.
  it('a strike naming an unknown piece is an IllegalAction, before and after another strike', () => {
    const p = played();
    const inShop = p.states[p.at.strike - 1]!;
    const afterStrike = p.states[p.at.strike]!;
    expect(afterStrike.struck).toEqual([{ kind: 'piece', id: 'fence' }]);
    const i = (p.log[p.at.strike] as { i: number }).i;
    const bad = { t: 'buy', i, strike: { kind: 'piece', id: 'dragon' as PieceId } } as const;
    expect(() => rules.apply(inShop, bad)).toThrow(IllegalAction);
    expect(() => rules.apply(afterStrike, bad)).toThrow(IllegalAction);
  });
});

// ---------------------------------------------------------------------------------------
// The ?debug hooks.

/** TEST_CONTENT with four phases, so later shop numbers exist. */
const FOUR_PHASES: Content = {
  ...C,
  balance: {
    ...C.balance,
    phases: [5, 30, 60, 100].map((target, i) => ({ name: `Phase ${i + 1}`, target })),
  },
};

const FORCE: Action = { t: 'debug', op: 'forceShop' };
const LEAVE: Action = { t: 'leaveShop' };

/** The hand the run's own draw would give for this week at draw count n. */
const handAt = (s: RunState, n: number, content: Content = C) =>
  drawHand(
    content,
    s.setup.seed,
    s.phase,
    slotKey(s.slot, s.overtimeWeek),
    n,
    content.balance.rules.handSize,
    { struck: s.struck },
  );

describe('debug forceShop', () => {
  it('opens the shop mid-week: shopOpened, a forced visit, the hand set aside, the week unchanged', () => {
    const s = rules.newRun(setup('force-shop'));
    expect(s.debug).toBeUndefined();
    const { state, events } = rules.apply(s, FORCE);
    const visit = state.offers!.shop!;
    // Shop number min(max(1, phase + 1), phaseCount − 1) = min(1, 1) = 1 in phase 0.
    expect(visit).toStrictEqual({
      number: 1,
      offers: visit.offers,
      sale: visit.sale,
      refreshes: 0,
      boughtAny: false,
      forced: true,
    });
    expect(events).toStrictEqual([
      { t: 'shopOpened', number: 1, offers: visit.offers, sale: visit.sale },
    ]);
    // Shop 1: 2 blueprints and 2 cards, then the three services.
    expect(visit.offers.slice(4)).toStrictEqual([
      { kind: 'service', service: 'reroll' },
      { kind: 'service', service: 'demolition' },
      { kind: 'service', service: 'strike' },
    ]);
    expect(visit.offers).toHaveLength(7);
    expect(state).toMatchObject({ screen: 'shop', hand: [], debug: true });
    for (const k of [
      'phase',
      'slot',
      'week',
      'overtimeWeek',
      'draws',
      'score',
      'budget',
    ] as const) {
      expect(state[k]).toBe(s[k]);
    }
  });

  it('stocks what that shop would after its milestone (same stream)', () => {
    const s = rules.newRun(setup('force-shop'));
    const forced = rules.apply(s, FORCE).state.offers!.shop!;
    // Reach milestone 1: meet the target of 5, then pass both weeks.
    let t = rules.apply(s, { t: 'debug', op: 'addScore', amount: 5 }).state;
    t = rules.apply(t, { t: 'pass' }).state;
    t = rules.apply(t, { t: 'pass' }).state;
    expect(t.screen).toBe('shop');
    const regular = t.offers!.shop!;
    expect(regular.number).toBe(1);
    expect(regular.forced).toBeUndefined();
    expect(regular.offers).toStrictEqual(forced.offers);
    expect(regular.sale).toBe(forced.sale);
  });

  it('leaving returns to the same week, slot, and phase, with a fresh hand drawn at n = draws', () => {
    const s = rules.newRun(setup('force-shop'));
    const inShop = rules.apply(s, FORCE).state;
    const { state, events } = rules.apply(inShop, LEAVE);
    const hand = handAt(s, s.draws);
    // Nothing was bought or refreshed, so the skip reward (1) is paid.
    expect(events).toStrictEqual([
      { t: 'shopClosed', number: 1, skipReward: 1, budgetBefore: s.budget, budget: s.budget + 1 },
      { t: 'handDrawn', phase: 0, slot: s.slot, overtimeWeek: 0, hand, free: false, reroll: false },
    ]);
    expect(state).toMatchObject({
      screen: 'build',
      phase: s.phase,
      slot: s.slot,
      week: s.week,
      overtimeWeek: 0,
      hand,
      draws: s.draws + 1,
      rerollsLeft: s.rerollsLeft,
      budget: s.budget + 1,
      budgetEarned: s.budgetEarned + 1,
    });
    expect(state.offers).toBeUndefined();
    // The same hand a reroll from before the shop would have drawn: the same draw key.
    expect(rules.apply(s, { t: 'reroll' }).state.hand).toStrictEqual(hand);
    // And the week goes on: passing tallies week 1, then week 2 starts.
    const pass = rules.apply(state, { t: 'pass' });
    expect(eventsOf(pass.events, 'tally')).toMatchObject([{ week: 1, slot: 1, phase: 0 }]);
    expect(pass.state).toMatchObject({ slot: 2, week: 2, draws: expect.any(Number) });
  });

  it('each forced visit in a week draws the next key, so no hand repeats a draw', () => {
    let s = rules.newRun(setup('force-shop'));
    const n0 = s.draws;
    const hands = [];
    for (let k = 0; k < 2; k++) {
      s = rules.apply(rules.apply(s, FORCE).state, LEAVE).state;
      hands.push(s.hand);
    }
    expect(s.draws).toBe(n0 + 2);
    expect(hands).toStrictEqual([handAt(s, n0), handAt(s, n0 + 1)]);
    // A reroll after them draws at n0 + 2.
    expect(rules.apply(s, { t: 'reroll' }).state.hand).toStrictEqual(handAt(s, n0 + 2));
  });

  it('in an overtime week, leaving draws from that week’s own key (ot1)', () => {
    const base = rules.newRun(setup('force-overtime'));
    const s: RunState = { ...base, slot: 3, week: 3, overtimeWeek: 1, overtimeLeft: 1, draws: 1 };
    const back = rules.apply(rules.apply(s, FORCE).state, LEAVE).state;
    expect(back).toMatchObject({ slot: 3, week: 3, overtimeWeek: 1, overtimeLeft: 1, draws: 2 });
    expect(back.hand).toStrictEqual(drawHand(C, 'force-overtime', 0, 'ot1', 1, 3, { struck: [] }));
  });

  it('a refresh or a purchase keeps the visit forced, and leaving still returns to the week', () => {
    let s = rules.newRun(setup('force-shop'));
    s = rules.apply(s, { t: 'debug', op: 'addBudget', amount: 10 }).state;
    const before = s;
    s = rules.apply(s, FORCE).state;
    s = rules.apply(s, { t: 'refreshShop' }).state;
    expect(s.offers!.shop).toMatchObject({ forced: true, refreshes: 1, boughtAny: true });
    // The refresh cost refresh.base = 2.
    expect(s.budget).toBe(8);
    const { state, events } = rules.apply(s, LEAVE);
    expect(eventsOf(events, 'shopClosed')).toMatchObject([{ skipReward: 0, budget: 8 }]);
    expect(state).toMatchObject({ slot: before.slot, week: before.week, draws: before.draws + 1 });
  });

  it('picks shop min(max(1, phase + 1), phaseCount − 1) by phase', () => {
    const r4 = createRules(FOUR_PHASES);
    const base = r4.newRun(setup('force-number'));
    // Phases 0–3 of four: shops 1, 2, 3, and min(4, 3) = 3.
    const numbers = [0, 1, 2, 3].map(
      (phase) => r4.apply({ ...base, phase }, FORCE).state.offers!.shop!.number,
    );
    expect(numbers).toEqual([1, 2, 3, 3]);
    // Shop 2 uses stock row 2: 3 blueprints and 2 cards, then the 3 services.
    expect(r4.apply({ ...base, phase: 1 }, FORCE).state.offers!.shop!.offers).toHaveLength(8);
    // With TEST_CONTENT's two phases, phase 1 is capped at shop 1.
    const s = rules.newRun(setup('force-number'));
    expect(rules.apply({ ...s, phase: 1 }, FORCE).state.offers!.shop!.number).toBe(1);
  });

  it('is refused in the shop, forced or regular, and once the run is over', () => {
    const s = rules.newRun(setup('force-shop'));
    const forced = rules.apply(s, FORCE).state;
    expect(() => rules.apply(forced, FORCE)).toThrow(IllegalAction);
    let t = rules.apply(s, { t: 'debug', op: 'addScore', amount: 5 }).state;
    t = rules.apply(rules.apply(t, { t: 'pass' }).state, { t: 'pass' }).state;
    expect(t.screen).toBe('shop');
    expect(() => rules.apply(t, FORCE)).toThrow(IllegalAction);
    for (const screen of ['won', 'lost'] as const) {
      expect(() => rules.apply({ ...s, screen }, FORCE)).toThrow(IllegalAction);
    }
  });
});

describe('debug giveGood puts a good where buying it would', () => {
  const give = (s: RunState, good: Good) => rules.apply(s, { t: 'debug', op: 'giveGood', good });

  it('a blueprint goes into the blueprint slots, bought this week; owned or full is refused', () => {
    let s = rules.newRun(setup('give-good'));
    const out = give(s, { kind: 'blueprint', id: 'crownJewel' });
    expect(out.events).toEqual([]);
    expect(out.state.blueprints).toStrictEqual([{ id: 'crownJewel', boughtWeek: s.week }]);
    expect(out.state.debug).toBe(true);
    s = out.state;
    expect(() => give(s, { kind: 'blueprint', id: 'crownJewel' })).toThrow(SHOP_REASONS.owned);
    // Four blueprint slots (blueprintSlots 4).
    expect(rules.slots(s).blueprints).toBe(4);
    for (const id of ['fengShui', 'greenThumb', 'modelHome'] as const) {
      s = give(s, { kind: 'blueprint', id }).state;
    }
    expect(s.blueprints.map((o) => o.id)).toEqual([
      'crownJewel',
      'fengShui',
      'greenThumb',
      'modelHome',
    ]);
    expect(() => give(s, { kind: 'blueprint', id: 'quietHours' })).toThrow(IllegalAction);
    expect(() => give(s, { kind: 'blueprint', id: 'quietHours' })).toThrow(
      SHOP_REASONS.blueprintsFull,
    );
  });

  it('a piece goes into the reserve, up to its 2 slots, and can be placed from there', () => {
    let s = rules.newRun(setup('give-good'));
    s = give(s, { kind: 'piece', id: 'pool' }).state;
    s = give(s, { kind: 'piece', id: 'bedroom' }).state;
    expect(s.reserve).toStrictEqual([{ id: 'pool' }, { id: 'bedroom' }]);
    expect(() => give(s, { kind: 'piece', id: 'library' })).toThrow(SHOP_REASONS.reserveFull);
    expect(rules.reserveFits(s, 0)).toBe(true);
    const play = rules.legalPlacements(s).find((p) => p.from === 'reserve' && p.i === 0)!;
    const placed = rules.apply(s, play);
    expect(eventsOf(placed.events, 'placed')).toMatchObject([{ defId: 'pool' }]);
    expect(placed.state.reserve).toStrictEqual([{ id: 'bedroom' }]);
  });

  it('a fixture goes into the supplies, up to its 3 slots', () => {
    let s = rules.newRun(setup('give-good'));
    for (const id of ['skylight', 'skylight', 'chandelier'] as const) {
      s = give(s, { kind: 'fixture', id }).state;
    }
    expect(s.supplies).toStrictEqual([
      { kind: 'fixture', id: 'skylight' },
      { kind: 'fixture', id: 'skylight' },
      { kind: 'fixture', id: 'chandelier' },
    ]);
    expect(() => give(s, { kind: 'fixture', id: 'pergola' })).toThrow(SHOP_REASONS.suppliesFull);
  });

  it('a fixture card goes at the end of the hand, and only on the build screen', () => {
    const s = rules.newRun(setup('give-good'));
    const out = give(s, { kind: 'fixtureCard', id: 'bayWindow' });
    expect(out.state.hand).toStrictEqual([...s.hand, { kind: 'fixture', id: 'bayWindow' }]);
    expect(out.state.draws).toBe(s.draws);
    const inShop = rules.apply(s, FORCE).state;
    expect(() => give(inShop, { kind: 'fixtureCard', id: 'bayWindow' })).toThrow(IllegalAction);
  });

  it('works in the shop, and the matching offers grey out', () => {
    let s = rules.newRun(setup('give-good'));
    s = rules.apply(s, { t: 'debug', op: 'addBudget', amount: 20 }).state;
    s = rules.apply(s, FORCE).state;
    const offers = s.offers!.shop!.offers;
    const bpAt = offers.findIndex((o) => o.kind === 'blueprint');
    const bp = offers[bpAt] as Extract<ShopOffer, { kind: 'blueprint' }>;
    s = give(s, { kind: 'blueprint', id: bp.id }).state;
    expect(rules.shopOffers(s)[bpAt]).toMatchObject({ ok: false, reason: SHOP_REASONS.owned });
    expect(() => rules.apply(s, { t: 'buy', i: bpAt })).toThrow(IllegalAction);
    // Fill the reserve and the supplies: every piece and fixture offer greys out.
    s = give(give(s, { kind: 'piece', id: 'pool' }).state, { kind: 'piece', id: 'pool' }).state;
    for (let k = 0; k < 3; k++) s = give(s, { kind: 'fixture', id: 'sprinkler' }).state;
    for (const view of rules.shopOffers(s)) {
      if (view.offer.kind === 'piece') expect(view.reason).toBe(SHOP_REASONS.reserveFull);
      if (view.offer.kind === 'fixture') expect(view.reason).toBe(SHOP_REASONS.suppliesFull);
    }
    // Still the shop, still forced.
    expect(s).toMatchObject({ screen: 'shop', offers: { shop: { forced: true } } });
  });

  it('refuses ids this content lacks, inherited keys, and unknown kinds', () => {
    const s = rules.newRun(setup('give-good'));
    const bad = [
      { kind: 'blueprint', id: 'dragonLair' },
      { kind: 'piece', id: 'dragon' },
      { kind: 'fixture', id: 'hotSauce' },
      { kind: 'fixtureCard', id: 'hotSauce' },
      { kind: 'blueprint', id: 'constructor' },
      { kind: 'piece', id: 'toString' },
      { kind: 'fixtureCard', id: '__proto__' },
      { kind: 'tool', id: 'hammer' },
    ];
    for (const good of bad) {
      expect(() => give(s, good as unknown as Good), JSON.stringify(good)).toThrow(IllegalAction);
    }
  });
});
