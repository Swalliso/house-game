// D-209 (S26): what the company upgrades bring. From the first milestone after the shop that
// sold it, at each milestone's start (its first week, never an overtime week, before the draw):
// - the Storage Unit adds a special piece to Your goods' extra slots, marked with it: the first
//   in its run's order (`upgrade/storageUnit`) that the house doesn't have yet, built or waiting,
//   and whose type isn't at a limit; with every one there, the first a house can hold two of, then
//   the first whose type isn't at a limit; with none, nothing;
// - the Tool Belt adds a tool of its rarity to the supplies: the milestone's in its run's order
//   (`upgrade/toolBelt`), passing over one already there and one that can't pay in the house as
//   it stands, or sells it at once when they're full, and the event says so.
// The Drafting Table opens a pick of three Common blueprints as it's bought, on its own stream.
// The picks come from the seed alone, so a run code replays them. On TEST_CONTENT, with four
// two-week phases and the three upgrades delivering as the real ones do.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  BlueprintId,
  Content,
  GameEvent,
  PieceId,
  RunState,
  ShopOffer,
  ToolId,
  UpgradeId,
} from './index.ts';
import { stream } from './rng.ts';
import { decodeRunCode, encodeRunCode } from './runcode.ts';
import { createRules, type Rules } from './run.ts';
import { crateOptions, inExtraSlot, reserveUsed, SERVICES, sellPrice } from './shop.ts';
import { setup, TEST_CONTENT, withClient, withPieces } from './testing.ts';
import { UPGRADES } from '../content/upgrades.ts';

/** Four two-week phases with targets of 0, and the slot upgrades delivering as the real ones. */
function delivering(base: Content = TEST_CONTENT): Content {
  const upgrades = { ...base.upgrades };
  for (const id of ['storageUnit', 'toolBelt', 'draftingTable'] as const) {
    upgrades[id] = { ...upgrades[id], delivers: UPGRADES[id].delivers! };
  }
  return {
    ...base,
    upgrades,
    balance: {
      ...base.balance,
      phases: [0, 1, 2, 3].map((k) => ({ name: `Phase ${k + 1}`, target: 0 })),
    },
  };
}

const C = delivering();
const r = createRules(C);

const SPECIALS = (Object.keys(C.pieces) as PieceId[]).filter((id) => {
  const def = C.pieces[id];
  return !!def.special && !def.member && !def.addition;
});
const COMMON_TOOLS = (Object.keys(C.tools) as ToolId[]).filter(
  (id) => C.tools[id].offered && C.tools[id].rarity === 'common',
);

/** `pool` in the order a run draws once from `key`: the rules' runOrder, the contract. */
function order<T>(seed: string, key: string, pool: readonly T[]): T[] {
  const rng = stream(seed, key);
  const left = [...pool];
  const out: T[] = [];
  while (left.length > 0) out.push(...left.splice(rng.int(left.length), 1));
  return out;
}

const give = (rr: Rules, s: RunState, id: UpgradeId): RunState =>
  rr.apply(s, { t: 'debug', op: 'giveGood', good: { kind: 'upgrade', id } }).state;

/** Passes, leaves shops (a pick set aside), until `stop`; the events and actions on the way. */
function playUntil(s: RunState, stop: (s: RunState) => boolean, rr: Rules = r, max = 100) {
  const events: GameEvent[] = [];
  const actions: Action[] = [];
  for (let k = 0; k < max && !stop(s); k++) {
    const a: Action =
      s.screen === 'shop'
        ? s.offers?.pick
          ? { t: 'pick', i: -1 }
          : { t: 'leaveShop' }
        : { t: 'pass' };
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
const inShop = (number: number) => (s: RunState) =>
  s.screen === 'shop' && s.offers?.shop?.number === number;

const fromUpgrades = (events: readonly GameEvent[]) =>
  events.filter(
    (e): e is Extract<GameEvent, { t: 'delivered' }> => e.t === 'delivered' && e.from === 'upgrade',
  );
const toolsOf = (events: readonly GameEvent[]) =>
  events.filter((e): e is Extract<GameEvent, { t: 'upgradeTool' }> => e.t === 'upgradeTool');

/** The shop with these goods on its shelf, then the services, and budget to spend. */
function shelf(s: RunState, goods: readonly ShopOffer[], budget = 30): RunState {
  const v = s.offers!.shop!;
  const offers = [
    ...goods,
    ...SERVICES.map((service): ShopOffer => ({ kind: 'service', service })),
  ];
  return { ...s, budget, offers: { shop: { ...v, offers, sale: null } } };
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

describe('the Storage Unit (D-209): a special piece each milestone', () => {
  it('comes at each milestone’s start after it’s owned, in an extra slot, before the draw', () => {
    const s0 = give(r, r.newRun(setup('storage')), 'storageUnit');
    expect(s0.reserve).toEqual([]);
    const brought: PieceId[] = [];
    let s = s0;
    for (const phase of [1, 2, 3]) {
      const run = playUntil(s, at(phase));
      const e = fromUpgrades(run.events);
      expect(e, `phase ${phase}`).toHaveLength(1);
      expect(e[0]).toMatchObject({ from: 'upgrade', upgrade: 'storageUnit', phase });
      const id = e[0]!.cards[0]!;
      expect(SPECIALS).toContain(id);
      brought.push(id);
      // At the start of the week, before its hand is drawn.
      const k = run.events.indexOf(e[0]!);
      expect(run.events.slice(k + 1).map((x) => x.t)).toEqual(['handDrawn']);
      s = run.state;
      expect(s.reserve.at(-1)).toEqual({ id, upgrade: 'storageUnit' });
      // Its own slot is still free: Your goods' extra slots hold it.
      expect(inExtraSlot(s.reserve.at(-1)!)).toBe(true);
      expect(reserveUsed(s)).toBe(0);
      // Nothing more in the phase's other week.
      expect(fromUpgrades(playUntil(s, at(phase, 2)).events)).toEqual([]);
    }
    // A different one each milestone, in the run's order.
    expect(brought).toEqual(order('storage', 'upgrade/storageUnit', SPECIALS).slice(0, 3));
  });

  it('first comes as the milestone after the shop that sold it starts', () => {
    const atShop = playUntil(r.newRun(setup('bought')), inShop(1)).state;
    const s = shelf(atShop, [{ kind: 'upgrade', id: 'storageUnit' }]);
    const bought = r.apply(s, { t: 'buy', i: 0 });
    expect(bought.state.upgrades).toEqual(['storageUnit']);
    expect(fromUpgrades(bought.events)).toEqual([]);
    expect(bought.state.offers?.pick).toBeUndefined();
    const left = r.apply(bought.state, { t: 'leaveShop' });
    expect(left.state.phase).toBe(1);
    const e = fromUpgrades(left.events);
    expect(e).toHaveLength(1);
    expect(left.state.reserve).toEqual([{ id: e[0]!.cards[0]!, upgrade: 'storageUnit' }]);
  });

  it('brings one the house doesn’t have yet, built or waiting, and none at a limit', () => {
    const seed = 'which';
    const [first, second, third] = order(seed, 'upgrade/storageUnit', SPECIALS);
    const start = give(r, r.newRun(setup(seed)), 'storageUnit');
    expect(fromUpgrades(playUntil(start, at(1)).events)[0]!.cards).toEqual([first]);
    // The first waits in Your goods: the second comes.
    const waiting = r.apply(start, {
      t: 'debug',
      op: 'giveGood',
      good: { kind: 'piece', id: first! },
    }).state;
    expect(fromUpgrades(playUntil(waiting, at(1)).events)[0]!.cards).toEqual([second]);
    // The client can't take the first: the second comes.
    const limited = atLimit([first!]);
    const s = give(limited, limited.newRun(setup(seed)), 'storageUnit');
    expect(fromUpgrades(playUntil(s, at(1), limited).events)[0]!.cards).toEqual([second]);
    // Neither the first nor the second: the third.
    const two = atLimit([first!, second!]);
    const s2 = give(two, two.newRun(setup(seed)), 'storageUnit');
    expect(fromUpgrades(playUntil(s2, at(1), two).events)[0]!.cards).toEqual([third]);
  });

  it('with every one there, brings the first a house holds two of; with all at a limit, nothing', () => {
    const seed = 'all in';
    const all = order(seed, 'upgrade/storageUnit', SPECIALS);
    // Every special piece waits in the reserve's extra slots already (as the stock's would).
    const start = give(r, r.newRun(setup(seed)), 'storageUnit');
    const full: RunState = {
      ...start,
      reserve: SPECIALS.map((id) => ({ id, stock: true as const })),
    };
    expect(fromUpgrades(playUntil(full, at(1)).events)[0]!.cards).toEqual([all[0]]);
    // A room the house holds one of (D-165) waits its turn: the first it can hold two of comes.
    const capped = createRules(
      withPieces(Object.fromEntries(all.slice(0, 2).map((id) => [id, { perHouse: 1 }])), C),
    );
    const s1 = {
      ...give(capped, capped.newRun(setup(seed)), 'storageUnit'),
      reserve: full.reserve,
    };
    expect(fromUpgrades(playUntil(s1, at(1), capped).events)[0]!.cards).toEqual([all[2]]);
    const none = atLimit(SPECIALS);
    const s = give(none, none.newRun(setup(seed)), 'storageUnit');
    const run = playUntil(s, at(1), none);
    expect(fromUpgrades(run.events)).toEqual([]);
    expect(run.state.reserve).toEqual([]);
  });

  it('never comes in an overtime week; the next milestone brings it', () => {
    const s0 = give(r, r.newRun(setup('late')), 'storageUnit');
    const week2 = playUntil(s0, at(0, 2)).state;
    const missed = r.apply(week2, { t: 'debug', op: 'forceMiss' }).state;
    const over = playUntil(missed, (s) => s.overtimeWeek === 1);
    expect(over.state.overtimeWeek).toBe(1);
    expect(fromUpgrades(over.events)).toEqual([]);
    const next = playUntil(over.state, at(1));
    expect(fromUpgrades(next.events)).toHaveLength(1);
  });
});

describe('the Tool Belt (D-209): a tool each milestone', () => {
  it('comes into the supplies at each milestone’s start, the milestone’s in its order', () => {
    const seed = 'belt';
    const s0 = give(r, r.newRun(setup(seed)), 'toolBelt');
    const run = playUntil(s0, at(1));
    const e = toolsOf(run.events);
    expect(e).toHaveLength(1);
    expect(e[0]).toMatchObject({ upgrade: 'toolBelt', phase: 1 });
    expect(e[0]!.sold).toBeUndefined();
    expect(COMMON_TOOLS).toContain(e[0]!.tool);
    expect(run.state.supplies).toEqual([{ kind: 'tool', id: e[0]!.tool }]);
    // Before the draw, as the crew's tool is.
    const k = run.events.indexOf(e[0]!);
    expect(run.events.slice(k + 1).map((x) => x.t)).toEqual(['handDrawn']);
    // Each later milestone brings one more; never in the phase's other week.
    expect(toolsOf(playUntil(run.state, at(1, 2)).events)).toEqual([]);
    expect(toolsOf(playUntil(run.state, at(2)).events)).toHaveLength(1);
  });

  it('passes over one already in the supplies and one that can’t pay here', () => {
    // A seed whose second milestone's tool in the order can pay in an empty house (not a set's
    // Remodel Plans), so the plain case and the held case can both be read.
    const payable = (t: ToolId) => C.tools[t].use.kind !== 'levelSet';
    let seed = '';
    let list: ToolId[] = [];
    for (let k = 0; k < 200 && !seed; k++) {
      const o = order(`belt ${k}`, 'upgrade/toolBelt', COMMON_TOOLS);
      if (payable(o[1 % o.length]!) && payable(o[2 % o.length]!)) [seed, list] = [`belt ${k}`, o];
    }
    expect(seed).not.toBe('');
    const s0 = give(r, r.newRun(setup(seed)), 'toolBelt');
    expect(toolsOf(playUntil(s0, at(1)).events)[0]!.tool).toBe(list[1]);
    // The milestone's tool is in the supplies already: the next one comes.
    const held = r.apply(s0, {
      t: 'debug',
      op: 'giveGood',
      good: { kind: 'tool', id: list[1]! },
    }).state;
    expect(toolsOf(playUntil(held, at(1)).events)[0]!.tool).toBe(list[2]);
    // A Remodel Plans for a set the house isn't near never comes while another can pay.
    for (let k = 0; k < 40; k++) {
      const s = give(r, r.newRun(setup(`plans ${k}`)), 'toolBelt');
      const tool = toolsOf(playUntil(s, at(1)).events)[0]!.tool;
      expect(C.tools[tool].use.kind, `plans ${k}`).not.toBe('levelSet');
    }
  });

  it('with the supplies full, it’s sold at once for half its price, and the event says so', () => {
    const s0 = give(r, r.newRun(setup('full')), 'toolBelt');
    const slots = r.slots(s0).supplies;
    expect(slots).toBe(C.balance.rules.supplySlots + 1);
    let s = s0;
    for (let k = 0; k < slots; k++) {
      s = r.apply(s, {
        t: 'debug',
        op: 'giveGood',
        good: { kind: 'fixture', id: 'skylight' },
      }).state;
    }
    const before = playUntil(s, at(0, 2)).state;
    const run = playUntil(before, at(1));
    const e = toolsOf(run.events);
    expect(e).toHaveLength(1);
    const price = sellPrice(C, before, C.tools[e[0]!.tool].price);
    expect(e[0]!.sold).toBe(price);
    expect(run.state.supplies).toEqual(before.supplies);
    // Paid as the next milestone starts, after the shop closed; budget earned, as the crew's
    // tool's sale is (D-171). Nothing was spent on the way.
    const closed = run.events.find(
      (x): x is Extract<GameEvent, { t: 'shopClosed' }> => x.t === 'shopClosed',
    )!;
    expect(run.state.budget).toBe(closed.budget + price);
    expect(run.state.budgetEarned - before.budgetEarned).toBe(run.state.budget - before.budget);
  });
});

describe('the Drafting Table (D-209): a pick of three Common blueprints as it’s bought', () => {
  it('opens on its own stream, Common blueprints the run doesn’t own, for its new slot', () => {
    const atShop = playUntil(r.newRun(setup('drafting')), inShop(1)).state;
    // The Housewarming gift's pick is set aside first (TEST_CONTENT's shop 1 has none).
    expect(atShop.offers?.pick).toBeUndefined();
    const s = shelf(atShop, [{ kind: 'upgrade', id: 'draftingTable' }]);
    const { state, events } = r.apply(s, { t: 'buy', i: 0 });
    const opened = events.filter(
      (e): e is Extract<GameEvent, { t: 'crateOpened' }> => e.t === 'crateOpened',
    );
    expect(opened).toHaveLength(1);
    expect(opened[0]!.source).toBe('draftingTable');
    const options = opened[0]!.options;
    expect(options).toHaveLength(3);
    const bought = { ...s, budget: s.budget - C.upgrades.draftingTable.price };
    expect(options).toEqual(
      crateOptions(
        C,
        { ...bought, upgrades: ['draftingTable'] },
        'draftingTable',
        'crate/1/0/draftingTable',
        3,
      ),
    );
    for (const o of options) {
      expect(o.kind).toBe('blueprint');
      expect(C.blueprints[o.id as BlueprintId].rarity).toBe('common');
    }
    expect(new Set(options.map((o) => o.id)).size).toBe(3);
    expect(state.offers?.pick).toEqual({ source: 'draftingTable', options });
    // Kept, it takes the slot the table added.
    const kept = r.apply(state, { t: 'pick', i: 1 }).state;
    expect(kept.blueprints.map((b) => b.id)).toEqual([options[1]!.id]);
    expect(r.slots(kept).blueprints).toBe(C.balance.rules.blueprintSlots + 1);
    expect(kept.offers?.pick).toBeUndefined();
    // Or set aside, as a crate's can be.
    expect(r.apply(state, { t: 'pick', i: -1 }).state.blueprints).toEqual([]);
  });

  it('with every Common blueprint owned, opens nothing; other upgrades open nothing', () => {
    const atShop = playUntil(r.newRun(setup('drafting')), inShop(1)).state;
    const commons = (Object.keys(C.blueprints) as BlueprintId[]).filter(
      (id) => C.blueprints[id].offered && C.blueprints[id].rarity === 'common',
    );
    const owned: RunState = {
      ...atShop,
      blueprints: commons.map((id) => ({ id, boughtWeek: 1 })),
    };
    // Room for the table's slot isn't what stops it: there's nothing to offer.
    const rich = createRules({
      ...C,
      balance: { ...C.balance, rules: { ...C.balance.rules, blueprintSlots: commons.length } },
    });
    const s = shelf(owned, [{ kind: 'upgrade', id: 'draftingTable' }]);
    const out = rich.apply(s, { t: 'buy', i: 0 });
    expect(out.events.map((e) => e.t)).not.toContain('crateOpened');
    expect(out.state.offers?.pick).toBeUndefined();
    for (const id of ['foreman', 'biggerTruck', 'storageUnit', 'toolBelt'] as const) {
      const other = r.apply(shelf(atShop, [{ kind: 'upgrade', id }]), { t: 'buy', i: 0 });
      expect(other.state.offers?.pick, id).toBeUndefined();
    }
  });
});

describe('what the upgrades bring replays', () => {
  it('a run code brings the same pieces and tools, and opens the same pick', () => {
    const seed = 'replay';
    let s = r.newRun(setup(seed));
    const actions: Action[] = [];
    const step = (a: Action) => {
      s = r.apply(s, a).state;
      actions.push(a);
    };
    step({ t: 'debug', op: 'giveGood', good: { kind: 'upgrade', id: 'storageUnit' } });
    step({ t: 'debug', op: 'giveGood', good: { kind: 'upgrade', id: 'toolBelt' } });
    const toShop = playUntil(s, inShop(1));
    toShop.actions.forEach((a) => actions.push(a));
    s = toShop.state;
    step({ t: 'debug', op: 'addBudget', amount: 20 });
    const rest = playUntil(s, (x) => x.screen === 'won' || x.screen === 'lost');
    rest.actions.forEach((a) => actions.push(a));
    const end = rest.state;
    expect(end.screen).toBe('won');
    const code = encodeRunCode({
      build: 'test',
      contentHash: 'test',
      setup: setup(seed),
      actions,
    });
    const decoded = decodeRunCode(code);
    if (!decoded.ok) throw new Error(decoded.error);
    const again = r.replay(decoded.data.setup, decoded.data.actions);
    expect(again.failedAt).toBeUndefined();
    expect(again.state).toEqual(end);
    expect(end.reserve.filter((x) => x.upgrade === 'storageUnit')).toHaveLength(3);
    expect(end.supplies.filter((x) => x.kind === 'tool').length).toBeGreaterThan(0);
  });
});
