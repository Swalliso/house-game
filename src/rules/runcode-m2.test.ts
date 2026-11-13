// Run codes for M2's actions (implementation-plan.md §4 "Actions, events, and the API", §6 "Run
// codes"): every action kind round-trips, decoding keeps only known fields and rejects bad
// ones without throwing, and a real run replays exactly from its code.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type {
  Action,
  GameEvent,
  PieceId,
  PlaceAction,
  RunCodeData,
  RunSetup,
  RunState,
} from './index.ts';
import { CONTENT, createRules, rules } from './index.ts';
import { stream, type Rng } from './rng.ts';
import { base64urlEncode, contentHash, decodeRunCode, encodeRunCode } from './runcode.ts';

const SETUP: RunSetup = {
  seed: 'runcode-m2',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};

const BASE: RunCodeData = {
  build: 'm2test',
  contentHash: contentHash(CONTENT),
  setup: SETUP,
  actions: [],
};

/** One of each action kind (and each debug op), with values that aren't defaults. */
const EVERY_ACTION: readonly Action[] = [
  { t: 'place', from: 'hand', i: 2, x: 17, y: 23, rot: 3 },
  { t: 'place', from: 'hand', i: 0, x: 0, y: 0, rot: 0 },
  { t: 'pass' },
  { t: 'reroll' },
  { t: 'demolish', x: 21, y: 4 },
  { t: 'completeEarly' },
  { t: 'setAutoComplete', on: true },
  { t: 'setAutoComplete', on: false },
  { t: 'debug', op: 'addScore', amount: 250 },
  { t: 'debug', op: 'addScore', amount: -40 },
  { t: 'debug', op: 'addBudget', amount: 9 },
  { t: 'debug', op: 'addBudget', amount: -3 },
  { t: 'debug', op: 'giveCard', id: 'treehouse' },
  { t: 'debug', op: 'forceMiss' },
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

/** Decodes, failing the test (rather than crashing it) if decoding throws. */
function safeDecode(code: string) {
  let result: ReturnType<typeof decodeRunCode> | undefined;
  expect(() => {
    result = decodeRunCode(code);
  }).not.toThrow();
  return result!;
}

const rawWith = (actions: readonly unknown[], extra: Record<string, unknown> = {}) =>
  rawCode({ ...BASE, actions, ...extra });

describe('run codes round-trip every M2 action kind', () => {
  it.each(EVERY_ACTION.map((a) => [JSON.stringify(a), a] as const))('%s', (_, action) => {
    const data: RunCodeData = { ...BASE, actions: [action] };
    expect(decodeRunCode(encodeRunCode(data))).toStrictEqual({ ok: true, data });
  });

  it('all of them in one log, in order, with a pending placement', () => {
    const data: RunCodeData = {
      ...BASE,
      actions: EVERY_ACTION,
      pending: { t: 'place', from: 'hand', i: 1, x: 3, y: 9, rot: 2 },
    };
    const code = encodeRunCode(data);
    const decoded = decodeRunCode(code);
    expect(decoded).toStrictEqual({ ok: true, data });
    // Re-encoding a decoded code gives the same string.
    expect(decoded.ok && encodeRunCode(decoded.data)).toBe(code);
  });

  it("keeps the setup's client, crew, seed, and mode", () => {
    const decoded = decodeRunCode(encodeRunCode(BASE));
    expect(decoded).toMatchObject({ ok: true });
    if (!decoded.ok) return;
    expect(decoded.data.setup).toStrictEqual({
      seed: 'runcode-m2',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    // A crew from another build still decodes: crews are checked against the content when
    // the code replays, not here.
    const otherCrew = { ...BASE, setup: { ...SETUP, crewId: 'landscaper' as never } };
    expect(decodeRunCode(encodeRunCode(otherCrew))).toMatchObject({
      ok: true,
      data: { setup: { crewId: 'landscaper' } },
    });
  });

  it('any well-formed action log round-trips exactly (property)', () => {
    const int = fc.integer({ min: -1000, max: 1000 });
    const pieceIds = Object.keys(CONTENT.pieces) as PieceId[];
    const action: fc.Arbitrary<Action> = fc.oneof(
      fc.record({
        t: fc.constant('place' as const),
        from: fc.constant('hand' as const),
        i: int,
        x: int,
        y: int,
        rot: fc.constantFrom(0 as const, 1 as const, 2 as const, 3 as const),
      }),
      fc.constant({ t: 'pass' as const }),
      fc.constant({ t: 'reroll' as const }),
      fc.record({ t: fc.constant('demolish' as const), x: int, y: int }),
      fc.constant({ t: 'completeEarly' as const }),
      fc.record({ t: fc.constant('setAutoComplete' as const), on: fc.boolean() }),
      fc.record({
        t: fc.constant('debug' as const),
        op: fc.constantFrom('addScore' as const, 'addBudget' as const),
        amount: int,
      }),
      fc.record({
        t: fc.constant('debug' as const),
        op: fc.constant('giveCard' as const),
        id: fc.constantFrom(...pieceIds),
      }),
      fc.constant({ t: 'debug' as const, op: 'forceMiss' as const }),
    );
    fc.assert(
      fc.property(fc.array(action, { maxLength: 12 }), fc.string(), (actions, seed) => {
        // fc.record builds null-prototype objects; decoding gives plain ones.
        const plain = actions.map((a) => ({ ...a }));
        const data: RunCodeData = { ...BASE, setup: { ...SETUP, seed }, actions: plain };
        expect(decodeRunCode(encodeRunCode(data))).toStrictEqual({ ok: true, data });
      }),
    );
  });
});

describe('decoding keeps only known fields', () => {
  it('strips unknown fields from every action kind', () => {
    const junk = { extra: 1, note: 'hi', nested: { a: [1, 2] } };
    const dirty = EVERY_ACTION.map((a) => ({ ...junk, ...a }));
    expect(safeDecode(rawWith(dirty))).toStrictEqual({
      ok: true,
      data: { ...BASE, actions: EVERY_ACTION },
    });
  });

  it('strips fields that belong to another action kind or debug op', () => {
    const dirty = [
      { t: 'pass', x: 1, y: 2, on: true },
      { t: 'reroll', i: 0 },
      // D-121's codes named a row; a reroll is both rows now (D-132), so any row is dropped.
      { t: 'reroll', row: 'rooms' },
      { t: 'reroll', row: 'layout', i: 1 },
      { t: 'demolish', x: 3, y: 4, rot: 1, uid: 7 },
      { t: 'completeEarly', on: false },
      { t: 'setAutoComplete', on: true, amount: 5 },
      { t: 'debug', op: 'forceMiss', amount: 99, id: 'garage' },
      { t: 'debug', op: 'giveCard', id: 'garage', amount: 99 },
      { t: 'debug', op: 'addScore', amount: 4, id: 'garage' },
      { t: 'place', from: 'hand', i: 0, x: 1, y: 2, rot: 1, uid: 3, on: true },
    ];
    expect(safeDecode(rawWith(dirty))).toStrictEqual({
      ok: true,
      data: {
        ...BASE,
        actions: [
          { t: 'pass' },
          { t: 'reroll' },
          { t: 'reroll' },
          { t: 'reroll' },
          { t: 'demolish', x: 3, y: 4 },
          { t: 'completeEarly' },
          { t: 'setAutoComplete', on: true },
          { t: 'debug', op: 'forceMiss' },
          { t: 'debug', op: 'giveCard', id: 'garage' },
          { t: 'debug', op: 'addScore', amount: 4 },
          { t: 'place', from: 'hand', i: 0, x: 1, y: 2, rot: 1 },
        ],
      },
    });
  });

  it('strips unknown fields from the setup, the pending placement, and the payload', () => {
    const code = rawCode({
      ...BASE,
      setup: { ...SETUP, client: 'hendersons', crewId: 'generalContractor' },
      actions: [{ t: 'pass' }],
      pending: { t: 'place', from: 'hand', i: 1, x: 2, y: 3, rot: 0, ghost: true },
      saveVersion: 7,
    });
    expect(safeDecode(code)).toStrictEqual({
      ok: true,
      data: {
        ...BASE,
        actions: [{ t: 'pass' }],
        pending: { t: 'place', from: 'hand', i: 1, x: 2, y: 3, rot: 0 },
      },
    });
  });
});

describe('decoding rejects bad actions and setups without throwing', () => {
  const badActions: [string, unknown][] = [
    ['demolish with a fractional x', { t: 'demolish', x: 1.5, y: 2 }],
    ['demolish with a string x', { t: 'demolish', x: '1', y: 2 }],
    ['demolish with no x', { t: 'demolish', y: 2 }],
    ['demolish with a null y', { t: 'demolish', x: 1, y: null }],
    ['setAutoComplete with a string', { t: 'setAutoComplete', on: 'true' }],
    ['setAutoComplete with a number', { t: 'setAutoComplete', on: 1 }],
    ['setAutoComplete with no value', { t: 'setAutoComplete' }],
    ['setAutoComplete with null', { t: 'setAutoComplete', on: null }],
    ['an unknown debug op', { t: 'debug', op: 'teleport' }],
    ['a debug action with no op', { t: 'debug' }],
    ['addScore with a fractional amount', { t: 'debug', op: 'addScore', amount: 2.5 }],
    ['addScore with a string amount', { t: 'debug', op: 'addScore', amount: '5' }],
    ['addBudget with no amount', { t: 'debug', op: 'addBudget' }],
    ['giveCard with a numeric id', { t: 'debug', op: 'giveCard', id: 7 }],
    ['giveCard with no id', { t: 'debug', op: 'giveCard' }],
    ['an unknown action type', { t: 'dance' }],
    ['a wrongly cased action type', { t: 'Pass' }],
    ['an action with no type', { x: 1, y: 2 }],
    ['a place from somewhere else', { t: 'place', from: 'deck', i: 0, x: 0, y: 0, rot: 0 }],
    ['a place with no rotation', { t: 'place', from: 'hand', i: 0, x: 0, y: 0 }],
    ['a place with a fractional index', { t: 'place', from: 'hand', i: 0.5, x: 0, y: 0, rot: 0 }],
    ['null', null],
    ['a bare string', 'pass'],
    ['a number', 7],
    ['an array', ['pass']],
  ];

  it.each(badActions)('%s', (_, bad) => {
    // On its own, and after valid actions: one bad action rejects the whole code.
    for (const actions of [[bad], [{ t: 'pass' }, { t: 'reroll' }, bad, { t: 'pass' }]]) {
      expect(safeDecode(rawWith(actions))).toStrictEqual({
        ok: false,
        error: expect.stringMatching(/action/),
      });
    }
  });

  const badSetups: [string, unknown][] = [
    ['no crewId', { seed: 's', mode: 'standard' }],
    ['a numeric crewId', { seed: 's', crewId: 5, mode: 'standard' }],
    ['a null crewId', { seed: 's', crewId: null, mode: 'standard' }],
    ['no seed', { crewId: 'generalContractor', mode: 'standard' }],
    ['another mode', { seed: 's', crewId: 'generalContractor', mode: 'daily' }],
    ['no setup at all', undefined],
    ['a null setup', null],
    ['an array setup', ['s', 'generalContractor', 'standard']],
  ];

  it.each(badSetups)('a setup with %s', (_, setup) => {
    expect(safeDecode(rawWith([{ t: 'pass' }], { setup }))).toStrictEqual({
      ok: false,
      error: expect.stringMatching(/setup/),
    });
  });

  it('a setup missing crewId, through encodeRunCode too', () => {
    const { crewId: _, ...noCrew } = SETUP;
    const code = encodeRunCode({ ...BASE, setup: noCrew as never });
    expect(safeDecode(code)).toMatchObject({ ok: false });
  });

  it('a payload without a build, a content hash, or an action list', () => {
    for (const payload of [
      { ...BASE, build: undefined },
      { ...BASE, build: 12 },
      { ...BASE, contentHash: undefined },
      { ...BASE, actions: undefined },
      { ...BASE, actions: { 0: { t: 'pass' } } },
      { ...BASE, actions: 'pass' },
    ]) {
      expect(safeDecode(rawCode(payload))).toMatchObject({ ok: false });
    }
  });

  it('any JSON as an action or a setup is either rejected or cleaned (property)', () => {
    fc.assert(
      fc.property(fc.jsonValue(), fc.jsonValue(), (action, setup) => {
        for (const code of [rawWith([action]), rawWith([], { setup })]) {
          const result = safeDecode(code);
          if (!result.ok) {
            expect(typeof result.error).toBe('string');
            continue;
          }
          // Whatever got through is already clean: decoding its re-encoding changes nothing.
          expect(decodeRunCode(encodeRunCode(result.data))).toStrictEqual(result);
        }
      }),
      { numRuns: 300 },
    );
  });
});

describe('decoded codes from other builds replay without crashing', () => {
  it('an unknown piece in giveCard stops the replay at that action', () => {
    const decoded = safeDecode(
      rawWith([{ t: 'reroll' }, { t: 'debug', op: 'giveCard', id: 'dragon' }, { t: 'pass' }]),
    );
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const result = rules.replay(decoded.data.setup, decoded.data.actions);
    expect(result.failedAt).toBe(1);
    expect(result.error).toEqual(expect.any(String));
  });

  // applyDebug checks the id is the content's own key, so an inherited Object.prototype key
  // ('constructor', 'toString', ...) is refused like any unknown piece (§6: loading never
  // crashes).
  it('a giveCard for an inherited key like "constructor" stops the replay too', () => {
    const decoded = safeDecode(rawWith([{ t: 'debug', op: 'giveCard', id: 'constructor' }]));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    const result = rules.replay(decoded.data.setup, decoded.data.actions);
    expect(() => rules.legalActions(result.state)).not.toThrow();
    expect(result.failedAt).toBe(0);
  });

  // decodeRunCode accepts any crewId string; replay checks it against the content and fails
  // softly at step 0 (§4: replay "returns the step where it fails instead of throwing").
  it('a crew this build does not have makes replay fail softly, not throw', () => {
    // M4b added the Landscaper and the Architect, so these are crews no build has.
    for (const crewId of ['handyman', 'constructor']) {
      const decoded = safeDecode(
        encodeRunCode({ ...BASE, setup: { ...SETUP, crewId: crewId as never } }),
      );
      expect(decoded.ok).toBe(true);
      if (!decoded.ok) return;
      const result = rules.replay(decoded.data.setup, decoded.data.actions);
      expect(result.failedAt).toBe(0);
      expect(result.state.screen).toBe('build');
    }
  });
});

// ---------------------------------------------------------------------------------------
// Determinism: a real run, with free actions and debug cheats, replays exactly from its code.

type Kind =
  'place' | 'pass' | 'reroll' | 'demolish' | 'setAutoComplete' | 'completeEarly' | 'debug';
const ALL_KINDS: readonly Kind[] = [
  'place',
  'pass',
  'reroll',
  'demolish',
  'setAutoComplete',
  'completeEarly',
  'debug',
];
/** How often each kind is picked once it has been used: mostly building, some of the rest. */
const WEIGHT: Record<Kind, number> = {
  place: 6,
  pass: 2,
  reroll: 1,
  demolish: 1,
  setAutoComplete: 1,
  completeEarly: 2,
  debug: 1,
};
const PIECE_IDS = Object.keys(CONTENT.pieces) as PieceId[];

function debugAction(rng: Rng): Action {
  switch (rng.int(5)) {
    case 0:
    case 1:
      // Mostly upward, so targets get met and early completion comes up.
      return { t: 'debug', op: 'addScore', amount: rng.range(-10, 60) };
    case 2:
      return { t: 'debug', op: 'addBudget', amount: rng.range(-5, 15) };
    case 3:
      return { t: 'debug', op: 'giveCard', id: rng.pick(PIECE_IDS) };
    default:
      return { t: 'debug', op: 'forceMiss' };
  }
}

/**
 * Picks an action by a seeded stream: an unused kind half the time, else by weight. Random
 * building rarely meets a target, so near a phase's end a cheat usually covers the shortfall:
 * that keeps the run going into later phases and brings early completion within reach. In the
 * shop it buys or sells something now and then, and otherwise leaves.
 */
function chooseAction(state: RunState, rng: Rng, used: ReadonlySet<Kind>): Action {
  if (state.screen === 'shop') {
    // An open crate: keep something (or discard it) before anything else.
    if (state.offers?.pick)
      return rng.pick(rules.legalActions(state).filter((a) => a.t === 'pick'));
    const shopping = rules.legalActions(state).filter((a) => a.t === 'buy' || a.t === 'sell');
    if (shopping.length > 0 && rng.chance(60)) return rng.pick(shopping);
    return { t: 'leaveShop' };
  }
  const target = rules.target(state);
  if (state.score < target && rules.weeksLeft(state) <= 2 && rng.chance(60)) {
    return { t: 'debug', op: 'addScore', amount: target - state.score + rng.range(0, 20) };
  }
  const options = new Map<Kind, Action[]>();
  for (const a of rules.legalActions(state)) {
    const kind = a.t as Kind;
    options.set(kind, [...(options.get(kind) ?? []), a]);
  }
  options.set('setAutoComplete', [{ t: 'setAutoComplete', on: !state.autoComplete }]);
  options.set('debug', [debugAction(rng)]);
  const available = ALL_KINDS.filter((k) => options.has(k));
  const unused = available.filter((k) => !used.has(k));
  let kind: Kind;
  if (unused.length > 0 && rng.chance(50)) {
    kind = rng.pick(unused);
  } else {
    let r = rng.int(available.reduce((sum, k) => sum + WEIGHT[k], 0));
    kind = available.find((k) => (r -= WEIGHT[k]) < 0)!;
  }
  return rng.pick(options.get(kind)!);
}

interface Played {
  setup: RunSetup;
  log: Action[];
  states: RunState[];
  events: GameEvent[][];
  final: RunState;
}

function playRun(seed: string, steps: number): Played {
  const setup: RunSetup = {
    seed,
    clientId: 'hendersons',
    crewId: 'generalContractor',
    mode: 'standard',
  };
  const rng = stream(seed, 'test/runcode-m2');
  let state = rules.newRun(setup);
  const log: Action[] = [];
  const states: RunState[] = [];
  const events: GameEvent[][] = [];
  const used = new Set<Kind>();
  for (let n = 0; n < steps && (state.screen === 'build' || state.screen === 'shop'); n++) {
    const action = chooseAction(state, rng, used);
    const result = rules.apply(state, action);
    if ((ALL_KINDS as readonly string[]).includes(action.t)) used.add(action.t as Kind);
    log.push(action);
    states.push(result.state);
    events.push(result.events);
    state = result.state;
  }
  return { setup, log, states, events, final: state };
}

describe('a real run replays exactly from its run code', () => {
  // Seeds whose random stream reaches every kind of action; a content change can move a seed
  // off one (M4b's targets moved determinism-a), so pick another that covers them all.
  // The batch (D-169) moved i, f and c off.
  const SEEDS = ['determinism-e', 'determinism-k', 'determinism-n'];

  it.each(SEEDS)('seed %s', (seed) => {
    // M3b's Housewarming pick takes a step, so the run is a little longer than M2's 24.
    const played = playRun(seed, 30);
    const kinds = new Set(played.log.map((a) => a.t));
    // The stream reached every kind of action, free ones included, and shopped in a shop.
    const SHOP: readonly string[] = ['buy', 'sell', 'leaveShop', 'pick'];
    expect([...kinds].filter((k) => !SHOP.includes(k)).sort()).toEqual([...ALL_KINDS].sort());
    expect(kinds.has('buy') && kinds.has('leaveShop')).toBe(true);
    expect(played.log.length).toBeGreaterThanOrEqual(18);
    expect(played.final.debug).toBe(true);
    // It crossed milestones, one of them early, so the log replays fast-forwarded weeks too.
    expect(played.final.milestones.some((m) => m.result === 'early')).toBe(true);
    expect(played.events.flat().some((e) => e.t === 'tally' && e.fastForward)).toBe(true);

    const legalPending = rules
      .legalActions(played.final)
      .find((a): a is PlaceAction => a.t === 'place');
    const code = encodeRunCode({
      build: 'm2test',
      contentHash: contentHash(CONTENT),
      setup: played.setup,
      actions: played.log,
      ...(legalPending ? { pending: legalPending } : {}),
    });
    const decoded = decodeRunCode(code);
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.data.actions).toStrictEqual(played.log);
    expect(decoded.data.setup).toStrictEqual(played.setup);
    expect(decoded.data.contentHash).toBe(contentHash(CONTENT));

    // replay() rebuilds the same state, with the same rules object and with a fresh one (so
    // no cache carries anything over).
    const replayed = rules.replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.error).toBeUndefined();
    expect(replayed.state).toStrictEqual(played.final);
    const fresh = createRules(CONTENT);
    const freshReplay = fresh.replay(decoded.data.setup, decoded.data.actions);
    expect(freshReplay.failedAt).toBeUndefined();
    expect(JSON.stringify(freshReplay.state)).toBe(JSON.stringify(played.final));

    // Step by step, every intermediate state and every event matches too.
    let s = fresh.newRun(decoded.data.setup);
    decoded.data.actions.forEach((action, n) => {
      const step = fresh.apply(s, action);
      expect(step.events).toStrictEqual(played.events[n]);
      expect(step.state).toStrictEqual(played.states[n]);
      s = step.state;
    });

    // The pending placement previews the same on the replayed state.
    if (decoded.data.pending && played.final.screen === 'build') {
      expect(fresh.preview(replayed.state, decoded.data.pending)).toStrictEqual(
        rules.preview(played.final, legalPending!),
      );
    }
  });

  it('the same seed always picks the same actions', () => {
    expect(playRun('determinism-a', 24).log).toStrictEqual(playRun('determinism-a', 24).log);
  });
});
