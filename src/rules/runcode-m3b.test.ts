// Run codes for M3b (implementation-plan.md §4 "Actions, events, and the API", §6 "Run codes"
// and its key table, Appendix A "M3a and M3b"; CLAUDE.md: decodeRunCode rebuilds every action
// field by field). The new forms ({t: 'pick'}, {t: 'useTool'} with each target shape, and
// giveGood's tool and upgrade kinds) round-trip exactly; decoding keeps only their known fields
// and rejects damaged ones without throwing; a real M3b run (the Housewarming crate, a tool, a
// crate and an upgrade bought, nine kinds of tool used, both finds claimed) replays exactly
// from its code; and a stale code stops at the step that fails, with the state before it.
// Rules tests use TEST_CONTENT (src/rules/testing.ts) and variants of it, never src/content.

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type {
  Action,
  Cell,
  Content,
  GameEvent,
  Good,
  Rot,
  RunCodeData,
  RunSetup,
  RunState,
  ShopOffer,
  TerrainId,
  ToolId,
  UpgradeId,
  UseToolAction,
} from './index.ts';
import { REASONS } from './placement.ts';
import { stream } from './rng.ts';
import { createRules, type Rules } from './run.ts';
import { base64urlEncode, contentHash, decodeRunCode, encodeRunCode } from './runcode.ts';
import { setup, TEST_CONTENT as C } from './testing.ts';

const BASE: RunCodeData = {
  build: 'm3btest',
  contentHash: contentHash(C),
  setup: setup('runcode-m3b'),
  actions: [],
};

/** One of each M3b action form, with values that aren't defaults (and zeros, which are falsy). */
const M3B_ACTIONS: readonly Action[] = [
  { t: 'pick', i: 0 },
  { t: 'pick', i: 2 },
  { t: 'pick', i: -1 },
  { t: 'useTool', i: 0 },
  { t: 'useTool', i: 2, target: { uid: 7 } },
  { t: 'useTool', i: 1, target: { uid: 3, x: 11, y: 14, rot: 3 } },
  { t: 'useTool', i: 0, target: { uid: 0, x: 0, y: 0, rot: 0 } },
  { t: 'debug', op: 'giveGood', good: { kind: 'tool', id: 'movingTruck' } },
  { t: 'debug', op: 'giveGood', good: { kind: 'upgrade', id: 'savingsAccount' } },
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

describe('run codes round-trip every M3b action', () => {
  it('each form on its own: pick (−1 too), useTool with no target, a uid, or a spot; giveGood', () => {
    for (const action of M3B_ACTIONS) {
      const data: RunCodeData = { ...BASE, actions: [action] };
      expect(decodeRunCode(encodeRunCode(data)), JSON.stringify(action)).toStrictEqual({
        ok: true,
        data,
      });
    }
  });

  it('all of them in one log, in order, mixed with M3a actions; re-encoding gives the same code', () => {
    const actions: Action[] = [
      { t: 'buy', i: 6 },
      ...M3B_ACTIONS.slice(0, 3),
      { t: 'sell', from: 'supplies', i: 1 },
      ...M3B_ACTIONS.slice(3),
      { t: 'install', from: 'supplies', i: 0, uid: 2 },
    ];
    const data: RunCodeData = {
      ...BASE,
      actions,
      pending: { t: 'place', from: 'reserve', i: 0, x: 4, y: 5, rot: 1 },
    };
    const code = encodeRunCode(data);
    const decoded = decodeRunCode(code);
    expect(decoded).toStrictEqual({ ok: true, data });
    expect(decoded.ok && encodeRunCode(decoded.data)).toBe(code);
  });

  it('any well-formed log of picks, tool uses, and tool or upgrade gifts round-trips (property)', () => {
    const int = fc.integer({ min: -1000, max: 1000 });
    const rot = fc.constantFrom<Rot>(0, 1, 2, 3);
    const toolIds = Object.keys(C.tools) as ToolId[];
    const upgradeIds = Object.keys(C.upgrades) as UpgradeId[];
    const good: fc.Arbitrary<Good> = fc.oneof(
      fc.record({ kind: fc.constant('tool' as const), id: fc.constantFrom(...toolIds) }),
      fc.record({ kind: fc.constant('upgrade' as const), id: fc.constantFrom(...upgradeIds) }),
    );
    const action: fc.Arbitrary<Action> = fc.oneof(
      fc.record({ t: fc.constant('pick' as const), i: int }),
      fc.record({ t: fc.constant('useTool' as const), i: int }),
      fc.record({ t: fc.constant('useTool' as const), i: int, target: fc.record({ uid: int }) }),
      fc.record({
        t: fc.constant('useTool' as const),
        i: int,
        target: fc.record({ uid: int, x: int, y: int, rot }),
      }),
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

describe('decoding keeps only the known fields of M3b actions', () => {
  it('strips unknown fields from every M3b action', () => {
    const junk = { extra: 1, note: 'hi', nested: { a: [1, 2] } };
    const dirty = M3B_ACTIONS.map((a) => ({ ...junk, ...a }));
    expect(safeDecode(rawWith(dirty))).toStrictEqual({
      ok: true,
      data: { ...BASE, actions: M3B_ACTIONS },
    });
  });

  it('strips junk inside a target and a good, and fields of other action kinds', () => {
    const dirty = [
      { t: 'pick', i: 1, from: 'hand', uid: 3, option: { kind: 'blueprint', id: 'fengShui' } },
      { t: 'pick', i: -1, strike: { kind: 'piece', id: 'fence' }, source: 'housewarming' },
      // A spot at the top level isn't a target: the action keeps no target at all.
      { t: 'useTool', i: 0, x: 4, y: 5, rot: 1, uid: 9 },
      { t: 'useTool', i: 2, target: { uid: 7, defId: 'bedroom', cells: [] } },
      {
        t: 'useTool',
        i: 1,
        target: { uid: 3, x: 11, y: 14, rot: 3, from: [{ x: 1, y: 1 }], free: true },
        tool: 'movingTruck',
      },
      {
        t: 'debug',
        op: 'giveGood',
        good: { kind: 'tool', id: 'catalog', sold: true, price: 2 },
        amount: 3,
      },
      {
        t: 'debug',
        op: 'giveGood',
        good: { kind: 'upgrade', id: 'foreman', modifiers: [] },
        id: 'garage',
      },
    ];
    expect(safeDecode(rawWith(dirty))).toStrictEqual({
      ok: true,
      data: {
        ...BASE,
        actions: [
          { t: 'pick', i: 1 },
          { t: 'pick', i: -1 },
          { t: 'useTool', i: 0 },
          { t: 'useTool', i: 2, target: { uid: 7 } },
          { t: 'useTool', i: 1, target: { uid: 3, x: 11, y: 14, rot: 3 } },
          { t: 'debug', op: 'giveGood', good: { kind: 'tool', id: 'catalog' } },
          { t: 'debug', op: 'giveGood', good: { kind: 'upgrade', id: 'foreman' } },
        ],
      },
    });
  });
});

describe('decoding rejects damaged M3b actions without throwing', () => {
  const badActions: [string, unknown][] = [
    ['a pick with a fractional i', { t: 'pick', i: 0.5 }],
    ['a pick with a string i', { t: 'pick', i: '1' }],
    ['a pick with no i', { t: 'pick' }],
    ['a useTool with no i', { t: 'useTool', target: { uid: 1 } }],
    ['a useTool with a fractional i', { t: 'useTool', i: 1.5 }],
    ['a target with a fractional uid', { t: 'useTool', i: 0, target: { uid: 1.5 } }],
    ['a target with a string uid', { t: 'useTool', i: 0, target: { uid: '1' } }],
    ['a target with a spot but no uid', { t: 'useTool', i: 0, target: { x: 1, y: 2, rot: 0 } }],
    ['a target with x but no y or rot', { t: 'useTool', i: 0, target: { uid: 1, x: 3 } }],
    ['a target with x and y but no rot', { t: 'useTool', i: 0, target: { uid: 1, x: 3, y: 4 } }],
    ['a target with only a rot', { t: 'useTool', i: 0, target: { uid: 1, rot: 1 } }],
    ['a target with rot 4', { t: 'useTool', i: 0, target: { uid: 1, x: 3, y: 4, rot: 4 } }],
    [
      'a target with a string rot',
      { t: 'useTool', i: 0, target: { uid: 1, x: 3, y: 4, rot: '2' } },
    ],
    [
      'a target with a fractional y',
      { t: 'useTool', i: 0, target: { uid: 1, x: 3, y: 4.5, rot: 0 } },
    ],
    ['a target that is a number', { t: 'useTool', i: 0, target: 3 }],
    ['a target that is null', { t: 'useTool', i: 0, target: null }],
    ['giveGood of a tool with no id', { t: 'debug', op: 'giveGood', good: { kind: 'tool' } }],
    [
      'giveGood of a tool with a numeric id',
      { t: 'debug', op: 'giveGood', good: { kind: 'tool', id: 4 } },
    ],
    [
      'giveGood of an upgrade with no id',
      { t: 'debug', op: 'giveGood', good: { kind: 'upgrade' } },
    ],
    [
      'giveGood of a crate (not a good)',
      { t: 'debug', op: 'giveGood', good: { kind: 'crate', id: 'showroom' } },
    ],
  ];

  it.each(badActions)('%s', (_, bad) => {
    // On its own, and after valid M3b actions: one bad action rejects the whole code.
    for (const actions of [[bad], [{ t: 'pick', i: 0 }, { t: 'useTool', i: 1 }, bad]]) {
      expect(safeDecode(rawWith(actions))).toStrictEqual({
        ok: false,
        error: expect.stringMatching(/action/),
      });
    }
  });
});

// ---------------------------------------------------------------------------------------
// Determinism: a scripted M3b run replays exactly from its code.

/**
 * TEST_CONTENT with four phases (targets 5, 10, 15, 20) so shops 1–3 open, shop 1's free
 * Housewarming crate of 3 Common blueprints, and lots that get one Old Shed and one Time
 * Capsule (TEST_LOT_BALANCE has none). A replay rebuilds the lot from the seed, so the finds
 * have to come from the lot's own generation.
 */
const M3B: Content = {
  ...C,
  balance: {
    ...C.balance,
    lot: { ...C.balance.lot, oldSheds: [1, 1], timeCapsules: [1, 1], findStreetGap: 4 },
    phases: [5, 10, 15, 20].map((target, i) => ({ name: `Phase ${i + 1}`, target })),
    shop: {
      ...C.balance.shop,
      stock: C.balance.shop.stock.map((row, k) => (k === 0 ? { ...row, housewarming: 3 } : row)),
    },
  },
};
const rules = createRules(M3B);
const SEED = 'm3b-code-a';

/** The tiles of a lot feature, in reading order. */
function tilesOf(s: RunState, t: TerrainId): Cell[] {
  const { width, terrain } = s.house.lot;
  return terrain.flatMap((f, idx) =>
    f === t ? [{ x: idx % width, y: Math.floor(idx / width) }] : [],
  );
}

/** The first legal Moving Truck move of any piece (rot 0), scanning the lot in reading order. */
function findMove(r: Rules, s: RunState, i: number): UseToolAction {
  const { width, height } = s.house.lot;
  for (const piece of s.house.pieces) {
    for (let y = 0; y < height; y++) {
      for (let x = 0; x < width; x++) {
        const a: UseToolAction = { t: 'useTool', i, target: { uid: piece.uid, x, y, rot: 0 } };
        if (r.canUseTool(s, a).ok) return a;
      }
    }
  }
  throw new Error('No legal move');
}

interface Played {
  setup: RunSetup;
  log: Action[];
  states: RunState[];
  events: GameEvent[][];
  final: RunState;
  /** Where the capsule and the shed were on the generated lot (the shed's top-left tile). */
  capsule: Cell;
  shed: Cell;
  /** Indexes into the log. */
  at: {
    firstUseTool: number;
    freePlace: number;
    secondPlace: number;
    shedDemolish: number;
    phase1Pass: number;
    housewarmingPick: number;
    move: number;
    phase2Pass: number;
  };
}

function playM3bRun(): Played {
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
    return log.length - 1;
  };
  const give = (good: Good) => act({ t: 'debug', op: 'giveGood', good });
  /** Gives a tool and uses it at once, from the end of the supplies. */
  const useNow = (id: ToolId, target?: UseToolAction['target']) => {
    give({ kind: 'tool', id });
    const i = state.supplies.length - 1;
    return act(target ? { t: 'useTool', i, target } : { t: 'useTool', i });
  };
  const meetTarget = () => {
    const need = rules.target(state) - state.score;
    if (need > 0) act({ t: 'debug', op: 'addScore', amount: need });
  };
  const offerOf = (kind: Exclude<ShopOffer['kind'], 'service'>) => {
    const view = rules.shopOffers(state).find((o) => o.offer.kind === kind && o.ok);
    if (!view) throw new Error(`No ${kind} to buy in this shop`);
    return view.i;
  };
  const lastCardPlacement = () => {
    const i = state.hand.length - 1;
    const play = rules.legalPlacements(state).find((p) => p.from === 'hand' && p.i === i);
    if (!play) throw new Error('No legal placement for the last card');
    return play;
  };

  const capsule = tilesOf(state, 'timeCapsule')[0]!;
  const shed = tilesOf(state, 'oldShed')[0]!;

  act({ t: 'debug', op: 'addBudget', amount: 60 });
  // Phase 1, week 1: a Weekend Crew, so a Closet over the Time Capsule is a free play; then a
  // Bedroom beside it ends the week.
  const firstUseTool = useNow('weekendCrew');
  act({ t: 'debug', op: 'giveCard', id: 'closet' });
  const freePlace = act({
    t: 'place',
    from: 'hand',
    i: state.hand.length - 1,
    x: capsule.x,
    y: capsule.y,
    rot: 0,
  });
  act({ t: 'debug', op: 'giveCard', id: 'bedroom' });
  const secondPlace = act(lastCardPlacement());

  // Week 2: the Old Shed demolished from its bottom-right tile (its tool goes into the
  // supplies), a Rush Order and a Fertilizer, then a pass ends the phase with its target met.
  const shedDemolish = act({ t: 'demolish', x: shed.x + 1, y: shed.y + 1 });
  useNow('rushOrder');
  useNow('fertilizer');
  meetTarget();
  const phase1Pass = act({ t: 'pass' });

  // Shop 1 opens with the Housewarming crate: the Old Shed's tool is sold while it's open,
  // then its first blueprint kept. Nothing was bought, so leaving pays the skip reward.
  act({ t: 'sell', from: 'supplies', i: 0 });
  const housewarmingPick = act({ t: 'pick', i: 0 });
  // The ?debug panel gives a Savings Account, so milestone 2 pays interest.
  give({ kind: 'upgrade', id: 'savingsAccount' });
  act({ t: 'leaveShop' });

  // Phase 2, week 3: copy the Bedroom, level Jack-and-Jill, move a piece, redraw from the
  // Catalog, then place the copy from the reserve.
  const bedroom = state.house.pieces.find((p) => p.defId === 'bedroom')!.uid;
  useNow('copyMachine', { uid: bedroom });
  useNow('remodelJackAndJill');
  give({ kind: 'tool', id: 'movingTruck' });
  const move = act(findMove(rules, state, state.supplies.length - 1));
  useNow('catalog');
  const fromReserve = rules.legalPlacements(state).find((p) => p.from === 'reserve');
  if (!fromReserve) throw new Error('No legal placement from the reserve');
  act(fromReserve);

  // Week 4: a Dumpster and an Open House Party, then the milestone.
  useNow('dumpster');
  useNow('openHouseParty');
  meetTarget();
  const phase2Pass = act({ t: 'pass' });

  // Shop 2: a tool, the crate (keep an option there's room for), and the upgrade.
  act({ t: 'buy', i: offerOf('tool') });
  act({ t: 'buy', i: offerOf('crate') });
  const keep = rules.legalActions(state).find((a) => a.t === 'pick' && a.i >= 0);
  act(keep ?? { t: 'pick', i: -1 });
  act({ t: 'buy', i: offerOf('upgrade') });
  act({ t: 'leaveShop' });

  // Phase 3, week 5: the bought tool (the first supply) is used.
  const bought = state.supplies[0];
  if (bought?.kind !== 'tool') throw new Error('The bought tool should be the first supply');
  const use = M3B.tools[bought.id].use.kind;
  act(
    use === 'move'
      ? findMove(rules, state, 0)
      : use === 'copy'
        ? { t: 'useTool', i: 0, target: { uid: state.house.pieces[0]!.uid } }
        : { t: 'useTool', i: 0 },
  );

  return {
    setup: runSetup,
    log,
    states,
    events,
    final: state,
    capsule,
    shed,
    at: {
      firstUseTool,
      freePlace,
      secondPlace,
      shedDemolish,
      phase1Pass,
      housewarmingPick,
      move,
      phase2Pass,
    },
  };
}

let memo: Played | undefined;
const played = () => (memo ??= playM3bRun());

const codeOf = (p: Played, content: Content = M3B) =>
  encodeRunCode({
    build: 'm3btest',
    contentHash: contentHash(content),
    setup: p.setup,
    actions: p.log,
  });

describe('a real M3b run replays exactly from its run code', () => {
  it('the generated lot has one Old Shed (2×2) and one Time Capsule, back from the street', () => {
    const s = rules.newRun(setup(SEED));
    const shed = tilesOf(s, 'oldShed');
    const capsules = tilesOf(s, 'timeCapsule');
    const { x, y } = shed[0]!;
    expect(shed).toStrictEqual([
      { x, y },
      { x: x + 1, y },
      { x, y: y + 1 },
      { x: x + 1, y: y + 1 },
    ]);
    expect(capsules).toHaveLength(1);
    // findStreetGap 4 on a 24-row lot: every find at y ≤ 24 − 1 − 4 = 19.
    for (const c of [...shed, ...capsules]) expect(c.y).toBeLessThanOrEqual(19);
    // The same lot as TEST_CONTENT's without finds, apart from the finds' tiles.
    const plain = createRules(C).newRun(setup(SEED)).house.lot;
    const findTiles = new Set([...shed, ...capsules].map((c) => c.y * 24 + c.x));
    s.house.lot.terrain.forEach((t, idx) => {
      if (findTiles.has(idx)) expect(plain.terrain[idx]).toBeNull();
      else expect(t).toBe(plain.terrain[idx]);
    });
  });

  it('the scripted run used every M3b action form and ten tools', () => {
    const p = played();
    const has = (pred: (a: Action) => boolean) => expect(p.log.some(pred)).toBe(true);
    has((a) => a.t === 'pick' && a.i === 0);
    has((a) => a.t === 'useTool' && a.target === undefined);
    has((a) => a.t === 'useTool' && a.target !== undefined && a.target.x === undefined);
    has((a) => a.t === 'useTool' && a.target?.x !== undefined);
    for (const kind of ['tool', 'upgrade'] as const) {
      has((a) => a.t === 'debug' && a.op === 'giveGood' && a.good.kind === kind);
    }
    const all = p.events.flat();
    // Nine tools given and used, then the one bought in shop 2.
    const used = eventsOf(all, 'toolUsed').map((e) => e.tool);
    expect(used.slice(0, 9)).toEqual([
      'weekendCrew',
      'rushOrder',
      'fertilizer',
      'copyMachine',
      'remodelJackAndJill',
      'movingTruck',
      'catalog',
      'dumpster',
      'openHouseParty',
    ]);
    expect(used).toHaveLength(10);
    expect(eventsOf(all, 'moved')).toHaveLength(1);
    expect(eventsOf(all, 'handDrawn').filter((e) => e.special)).toHaveLength(1);
    expect(p.final.setLevels).toStrictEqual({ jackAndJill: 2 });
    expect(p.final).toMatchObject({ screen: 'build', phase: 2, slot: 1, week: 5, debug: true });
  });

  it('the Weekend Crew’s free play claimed the Time Capsule; the second play ended the week', () => {
    const p = played();
    const free = p.events[p.at.freePlace]!;
    expect(free.map((e) => e.t)).toEqual(['placed', 'findClaimed']);
    expect(free[0]).toMatchObject({ t: 'placed', uid: 1, defId: 'closet', free: true });
    expect(free[1]).toStrictEqual({
      t: 'findClaimed',
      feature: 'timeCapsule',
      x: p.capsule.x,
      y: p.capsule.y,
      reward: { budget: 3 },
    });
    // 60 from the cheat, then +3 from the capsule; the week goes on.
    expect(p.states[p.at.freePlace]).toMatchObject({ budget: 63, freePlay: 'used', week: 1 });
    const second = p.events[p.at.secondPlace]!;
    expect(eventsOf(second, 'placed')).toMatchObject([{ uid: 2, defId: 'bedroom' }]);
    expect(eventsOf(second, 'placed')[0]!.free).toBeUndefined();
    // Week 1's tally counts both pieces; week 2 starts with the Weekend Crew reset.
    const tally = eventsOf(second, 'tally')[0]!;
    expect(tally).toMatchObject({ week: 1, passed: false });
    expect(tally.tally.pieces.map((q) => q.uid)).toEqual([1, 2]);
    expect(p.states[p.at.secondPlace]).toMatchObject({ week: 2, slot: 2, freePlay: 'none' });
  });

  it('the Old Shed: one demolition clears its four tiles and pays a tool from find/<top-left>', () => {
    const p = played();
    const offered = (Object.keys(M3B.tools) as ToolId[]).filter((id) => M3B.tools[id].offered);
    const shedTool = stream(SEED, `find/${p.shed.x},${p.shed.y}`).pick(offered);
    const { x, y } = p.shed;
    expect(p.events[p.at.shedDemolish]).toStrictEqual([
      {
        t: 'demolished',
        feature: 'oldShed',
        cells: [
          { x, y },
          { x: x + 1, y },
          { x, y: y + 1 },
          { x: x + 1, y: y + 1 },
        ],
        // 2 demolitions to start, 1 spent.
        demolitionsLeft: 1,
      },
      { t: 'findClaimed', feature: 'oldShed', x, y, reward: { tool: shedTool } },
    ]);
    const after = p.states[p.at.shedDemolish]!;
    expect(after.supplies).toStrictEqual([{ kind: 'tool', id: shedTool }]);
    expect(tilesOf(after, 'oldShed')).toEqual([]);
  });

  it('week 2’s tally had the Rush Order’s +0.5 Mult, and week 3’s didn’t', () => {
    const p = played();
    const week2 = eventsOf(p.events[p.at.phase1Pass]!, 'tally')[0]!;
    expect(week2.week).toBe(2);
    expect(week2.tally.multTerms).toStrictEqual([
      { source: { kind: 'tool', id: 'rushOrder' }, label: 'Rush Order', add: 50 },
    ]);
    // ×1 + 0.5 = ×1.5, in hundredths.
    expect(week2.tally.mult).toBe(150);
    const later = eventsOf(p.events.slice(p.at.phase1Pass + 1).flat(), 'tally');
    expect(later.map((e) => e.week)).toEqual([3, 4]);
    for (const e of later) {
      expect(e.tally.multTerms.filter((m) => m.source.kind === 'tool')).toEqual([]);
    }
  });

  it('the Housewarming pick, the bought crate and upgrade, the skip reward, and interest', () => {
    const p = played();
    const all = p.events.flat();
    // Two crates: Housewarming in shop 1 (3 Common blueprints), then the bought one in shop 2.
    const opened = eventsOf(all, 'crateOpened');
    expect(opened.map((e) => e.source)[0]).toBe('housewarming');
    expect(opened).toHaveLength(2);
    expect(opened[0]!.options).toHaveLength(3);
    for (const o of opened[0]!.options) {
      expect(o.kind).toBe('blueprint');
      expect(M3B.blueprints[o.id as keyof typeof M3B.blueprints].rarity).toBe('common');
    }
    // The Old Shed's tool was sold while the crate was open, for floor(price × 50%).
    const sellAt = p.at.housewarmingPick - 1;
    expect(p.states[sellAt]!.offers?.pick?.source).toBe('housewarming');
    const shedTool = p.states[p.at.shedDemolish]!.supplies[0]!;
    expect(p.events[sellAt]).toMatchObject([
      {
        t: 'sold',
        from: 'supplies',
        item: shedTool.id,
        price: Math.floor(M3B.tools[shedTool.id as ToolId].price / 2),
      },
    ]);
    const picked = eventsOf(all, 'picked');
    expect(picked.map((e) => e.source)).toEqual(['housewarming', opened[1]!.source]);
    expect(picked[0]!.option).toStrictEqual(opened[0]!.options[0]);
    expect(p.states[p.at.housewarmingPick]!.blueprints[0]).toStrictEqual({
      id: (opened[0]!.options[0] as { id: string }).id,
      boughtWeek: 3,
    });
    // Picking from the Housewarming crate isn't buying: shop 1 paid its skip reward (1).
    expect(eventsOf(all, 'shopClosed').map((e) => [e.number, e.skipReward])).toEqual([
      [1, 1],
      [2, 0],
    ]);
    expect(eventsOf(all, 'bought').map((e) => e.offer.kind)).toEqual(['tool', 'crate', 'upgrade']);
    // The given Savings Account, then shop 2's upgrade (never one the run owns).
    expect(p.final.upgrades).toHaveLength(2);
    expect(p.final.upgrades[0]).toBe('savingsAccount');
    // Milestone 1 paid no interest (no Savings Account yet); milestone 2 paid
    // min(floor(budget held / 5), 3) = 3 with over 15 held.
    const held = p.states[p.at.phase2Pass - 1]!.budget;
    expect(held).toBeGreaterThanOrEqual(15);
    expect(p.final.milestones.map((m) => m.reward)).toStrictEqual([
      { budget: 3, score: 0, interest: 0 },
      { budget: 3 + 3, score: 0, interest: 3 },
    ]);
  });

  it('decodes to the same log, and replay() rebuilds the same state', () => {
    const p = played();
    const decoded = decodeRunCode(codeOf(p));
    expect(decoded.ok).toBe(true);
    if (!decoded.ok) return;
    expect(decoded.data.actions).toStrictEqual(p.log);
    expect(decoded.data.setup).toStrictEqual(p.setup);

    const replayed = rules.replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.error).toBeUndefined();
    expect(replayed.state).toStrictEqual(p.final);
    // A fresh rules object (no caches carried over) agrees, down to the JSON.
    const fresh = createRules(M3B).replay(decoded.data.setup, decoded.data.actions);
    expect(fresh.failedAt).toBeUndefined();
    expect(JSON.stringify(fresh.state)).toBe(JSON.stringify(p.final));
  });

  it('step by step, every intermediate state and every event matches', () => {
    const p = played();
    const decoded = decodeRunCode(codeOf(p));
    if (!decoded.ok) throw new Error(decoded.error);
    const fresh = createRules(M3B);
    let s = fresh.newRun(decoded.data.setup);
    decoded.data.actions.forEach((action, n) => {
      const step = fresh.apply(s, action);
      expect(step.events).toStrictEqual(p.events[n]);
      expect(step.state).toStrictEqual(p.states[n]);
      s = step.state;
    });
  });

  it('the Moving Truck kept the piece’s uid and place in the placement order', () => {
    const p = played();
    const before = p.states[p.at.move - 1]!;
    const after = p.states[p.at.move]!;
    const action = p.log[p.at.move] as UseToolAction;
    const t = action.target!;
    const k = before.house.pieces.findIndex((q) => q.uid === t.uid);
    expect(after.house.pieces[k]).toStrictEqual({
      ...before.house.pieces[k]!,
      x: t.x,
      y: t.y,
      rot: t.rot,
    });
    expect(after.house.pieces.map((q) => q.uid)).toEqual(before.house.pieces.map((q) => q.uid));
    // A free action: the week, slot, and draws stay.
    for (const key of ['week', 'slot', 'draws', 'phase'] as const) {
      expect(after[key]).toBe(before[key]);
    }
  });
});

// ---------------------------------------------------------------------------------------
// A shorter run on TEST_CONTENT itself: tools within a week, then shop 1 and back.

describe('a TEST_CONTENT run with tools replays exactly', () => {
  it('Weekend Crew, Rush Order, Open House Party, Dumpster, and Fertilizer in one week, then shop 1', () => {
    const r = createRules(C);
    let state = r.newRun(setup('m3b-plain'));
    const log: Action[] = [];
    const act = (a: Action) => {
      state = r.apply(state, a).state;
      log.push(a);
    };
    for (const id of ['rushOrder', 'openHouseParty', 'weekendCrew'] as const) {
      act({ t: 'debug', op: 'giveGood', good: { kind: 'tool', id } });
    }
    // Supplies [Rush Order, Open House Party, Weekend Crew]: use them from the back.
    act({ t: 'useTool', i: 2 });
    act({ t: 'useTool', i: 1 });
    act({ t: 'useTool', i: 0 });
    expect(state.supplies).toEqual([]);
    expect(state.timedEffects.map((e) => [e.source, 'week' in e.until && e.until.week])).toEqual([
      ['openHouseParty', 1],
      ['rushOrder', 1],
    ]);
    act({ t: 'debug', op: 'giveGood', good: { kind: 'tool', id: 'dumpster' } });
    act({ t: 'useTool', i: 0 });
    // 2 demolitions to start, +2 from the Dumpster.
    expect(state.demolitionsLeft).toBe(4);
    act({ t: 'debug', op: 'giveGood', good: { kind: 'tool', id: 'fertilizer' } });
    act({ t: 'useTool', i: 0 });
    // Two plays in week 1: the first is the Weekend Crew's.
    act(r.legalPlacements(state).find((p) => p.from === 'hand')!);
    expect(state).toMatchObject({ week: 1, freePlay: 'used' });
    act(r.legalPlacements(state).find((p) => p.from === 'hand')!);
    expect(state).toMatchObject({ week: 2, freePlay: 'none', timedEffects: [] });
    act({ t: 'debug', op: 'addScore', amount: 5 });
    act({ t: 'pass' });
    expect(state.screen).toBe('shop');
    act({ t: 'debug', op: 'giveGood', good: { kind: 'upgrade', id: 'savingsAccount' } });
    act({ t: 'leaveShop' });

    const decoded = decodeRunCode(
      encodeRunCode({
        build: 'm3btest',
        contentHash: contentHash(C),
        setup: state.setup,
        actions: log,
      }),
    );
    if (!decoded.ok) throw new Error(decoded.error);
    expect(decoded.data.actions).toStrictEqual(log);
    const replayed = createRules(C).replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.state).toStrictEqual(state);
    expect(replayed.state.upgrades).toEqual(['savingsAccount']);
  });
});

// ---------------------------------------------------------------------------------------
// Stale codes.

describe('a stale M3b run code stops at the step that fails', () => {
  const replayOf = (actions: readonly unknown[], content: Content = M3B) => {
    const decoded = safeDecode(rawWith(actions, { setup: played().setup }));
    if (!decoded.ok) throw new Error(decoded.error);
    return createRules(content).replay(decoded.data.setup, decoded.data.actions);
  };

  it('a useTool of an empty supply index fails there, with the state before it', () => {
    const p = played();
    const k = p.at.firstUseTool;
    // The Weekend Crew sits alone in the supplies, at 0: index 2 is empty.
    expect(p.states[k - 1]!.supplies).toStrictEqual([{ kind: 'tool', id: 'weekendCrew' }]);
    const result = replayOf(p.log.map((a, n) => (n === k ? { t: 'useTool', i: 2 } : a)));
    expect(result.failedAt).toBe(k);
    expect(result.error).toBe('There’s no tool there.');
    expect(result.state).toStrictEqual(p.states[k - 1]);
  });

  it('a Moving Truck aimed at the piece’s own spot fails there', () => {
    const p = played();
    const k = p.at.move;
    const t = (p.log[k] as UseToolAction).target!;
    const piece = p.states[k - 1]!.house.pieces.find((q) => q.uid === t.uid)!;
    const same = {
      ...(p.log[k] as UseToolAction),
      target: { ...t, x: piece.x, y: piece.y, rot: piece.rot },
    };
    const result = replayOf(p.log.map((a, n) => (n === k ? same : a)));
    expect(result.failedAt).toBe(k);
    expect(result.error).toBe('Pick a new spot for it.');
    expect(result.state).toStrictEqual(p.states[k - 1]);
  });

  it('against content with no Housewarming crate, it fails at the first pick', () => {
    const p = played();
    const k = p.at.housewarmingPick;
    const noHousewarming: Content = {
      ...M3B,
      balance: { ...M3B.balance, shop: { ...M3B.balance.shop, stock: C.balance.shop.stock } },
    };
    const result = replayOf(p.log, noHousewarming);
    expect(result.failedAt).toBe(k);
    expect(result.error).toBe('There’s no crate open.');
    // The state before it is the live one without the open crate.
    const live = p.states[k - 1]!;
    expect(live.offers?.pick?.source).toBe('housewarming');
    expect(result.state).toStrictEqual({ ...live, offers: { shop: live.offers!.shop } });
  });

  it('against content whose lots have no finds, it fails at the Old Shed’s demolition', () => {
    const p = played();
    const k = p.at.shedDemolish;
    const noFinds: Content = {
      ...M3B,
      balance: {
        ...M3B.balance,
        lot: { ...M3B.balance.lot, oldSheds: [0, 0], timeCapsules: [0, 0] },
      },
    };
    const result = replayOf(p.log, noFinds);
    expect(result.failedAt).toBe(k);
    expect(result.error).toBe(REASONS.nothingThere);
    // The Closet still went down on that tile, but no capsule paid: 3 less budget.
    const live = p.states[k - 1]!;
    expect(result.state.budget).toBe(live.budget - 3);
    expect(result.state.budgetEarned).toBe(live.budgetEarned - 3);
    expect(result.state.house.pieces).toStrictEqual(live.house.pieces);
  });

  it('a pick with nothing open, and a giveGood of an unknown tool, fail softly', () => {
    const p = played();
    const k = p.at.firstUseTool;
    for (const bad of [
      { t: 'pick', i: 0 },
      { t: 'debug', op: 'giveGood', good: { kind: 'tool', id: 'jackhammer' } },
      { t: 'debug', op: 'giveGood', good: { kind: 'upgrade', id: 'helicopter' } },
    ]) {
      const result = replayOf([...p.log.slice(0, k), bad, ...p.log.slice(k)]);
      expect(result.failedAt).toBe(k);
      expect(result.error).toEqual(expect.any(String));
      expect(result.state).toStrictEqual(p.states[k - 1]);
    }
  });
});
