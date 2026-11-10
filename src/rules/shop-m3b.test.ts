// The M3b shop and finds (implementation-plan.md §5 Shop goods; §4 Transitions and the Finds
// bullet of Layout rules; §6's shop, crate, and find keys; Appendix A · M3a and M3b; Appendix B
// "Lot features", "Tools", "Company upgrades", "Crates").
//
// - Shop 2 on: 3 blueprints, 2 cards, 2 tools (rarity-weighted, distinct, offered only), a
//   crate (a uniform pick), then the visit's company upgrade (from shop/<n>/upgrade, never
//   owned, kept by a refresh), then the services.
// - Supplier Discount takes 25% off goods (rounded half up), not services or the refresh.
// - Each upgrade's rule takes effect at its moment: slots at once, Bigger Truck from the next
//   hand, Foreman at the next phase start, Savings Account at the next milestone.
// - Crates: buying needs a free slot of the contents' kind and opens a pick of 3 from
//   crate/<shop>/<refreshes>/<offer index>; while it's open, only picks, sells, and toggles go
//   through. The Housewarming crate is shop 1's free pick of 3 Common blueprints.
// - Finds: an Old Shed (2×2, blocks, demolish for a random tool from find/<top-left>) and Time
//   Capsules (1×1, don't block, +3 budget to the first piece built over them).
//
// Rules tests use TEST_CONTENT (testing.ts): 2 phases of 2 weeks (targets 5 and 30), and only
// shop 2+ stocks tools, a crate, and an upgrade, so shop-2 flows use a 3-phase variant. Its lot
// balance generates no finds, so they're laid by hand with lotFromRows (S Old Shed, K Time
// Capsule). The lot-generation test uses the real CONTENT, as does one Housewarming test.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  BlueprintId,
  Card,
  Cell,
  Content,
  CrateId,
  GameEvent,
  Lot,
  PickOption,
  PieceId,
  Rarity,
  RunState,
  ShopOffer,
  ShopStock,
  ShopVisit,
  Supply,
  TerrainId,
  ToolId,
  UpgradeId,
} from './index.ts';
import { drawHand } from './draw.ts';
import { generateLot } from './lot.ts';
import { REASONS } from './placement.ts';
import { stream } from './rng.ts';
import { createRules, IllegalAction, type Rules } from './run.ts';
import { crateOptions, openVisit, SERVICES, SHOP_REASONS, stockGoods } from './shop.ts';
import {
  drawnBefore,
  drawRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  type Placement,
} from './testing.ts';
import { CONTENT } from '../content/index.ts';

// ---------------------------------------------------------------------------------------
// Content variants and rules.

/** TEST_CONTENT with `count` phases (targets 5, 10, 15, …), so shops 2+ open. */
function phases(count: number, base: Content = C): Content {
  return {
    ...base,
    balance: {
      ...base.balance,
      phases: Array.from({ length: count }, (_, i) => ({
        name: `Phase ${i + 1}`,
        target: 5 * (i + 1),
      })),
    },
  };
}

/** TEST_CONTENT with one stock row changed (row 0 is shop 1). */
function stockRow(row: number, patch: Partial<ShopStock>, base: Content = C): Content {
  const stock = base.balance.shop.stock.map((r, k) => (k === row ? { ...r, ...patch } : r));
  return {
    ...base,
    balance: { ...base.balance, shop: { ...base.balance.shop, stock } },
  };
}

/** Targets far out of reach in 4-week phases, so no tally here ends a phase. */
const BIG: Content = {
  ...C,
  balance: {
    ...C.balance,
    weeksPerPhase: 4,
    phases: [
      { name: 'Phase 1', target: 100_000 },
      { name: 'Phase 2', target: 200_000 },
    ],
  },
};

const P3 = phases(3);
const rules = createRules(C);
const R3 = createRules(P3);
const RB = createRules(BIG);

// ---------------------------------------------------------------------------------------
// Actions, events, and flows.

const PASS: Action = { t: 'pass' };
const REROLL: Action = { t: 'reroll' };
const LEAVE: Action = { t: 'leaveShop' };
const REFRESH: Action = { t: 'refreshShop' };
const buy = (i: number): Action => ({ t: 'buy', i });
const pick = (i: number): Action => ({ t: 'pick', i });
const demolish = (x: number, y: number): Action => ({ t: 'demolish', x, y });
const sellBlueprint = (i: number): Action => ({ t: 'sell', from: 'blueprints', i });
const sellSupply = (i: number): Action => ({ t: 'sell', from: 'supplies', i });

const types = (events: readonly GameEvent[]) => events.map((e) => e.t);

function eventsOf<K extends GameEvent['t']>(
  events: readonly GameEvent[],
  t: K,
): Extract<GameEvent, { t: K }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: K }> => e.t === t);
}

/** The IllegalAction a call throws (fails the test if it throws nothing, or something else). */
function illegal(fn: () => unknown): IllegalAction {
  try {
    fn();
  } catch (e) {
    if (e instanceof IllegalAction) return e;
    throw e;
  }
  throw new Error('expected an IllegalAction');
}

/** Meets this phase's target, then passes until the milestone resolves (the shop, or the end). */
function finishPhase(r: Rules, s: RunState) {
  s = { ...s, score: Math.max(s.score, r.target(s)) };
  const events: GameEvent[] = [];
  while (s.screen === 'build') {
    const out = r.apply(s, PASS);
    s = out.state;
    events.push(...out.events);
  }
  return { state: s, events };
}

/** A new run, through milestone 1 and into shop 1 (budget 3 from the milestone, week 3). */
function shop1(seed: string, r: Rules = rules): RunState {
  const s = finishPhase(r, r.newRun(setup(seed))).state;
  if (s.screen !== 'shop') throw new Error('shop 1 didn’t open');
  return s;
}

/** Through shop 1 (left without buying: budget 4) and milestone 2, into shop 2 (budget 7). */
function shop2(seed: string): RunState {
  const s = finishPhase(R3, R3.apply(shop1(seed, R3), LEAVE).state).state;
  if (s.offers?.shop?.number !== 2) throw new Error('shop 2 didn’t open');
  return s;
}

const visitOf = (s: RunState): ShopVisit => {
  const v = s.offers?.shop;
  if (!v) throw new Error('no shop visit');
  return v;
};

const SERVICE_OFFERS: ShopOffer[] = SERVICES.map((service): ShopOffer => ({
  kind: 'service',
  service,
}));

/** A shop visit (shop 2 unless said) with these goods, then the three services. */
function withGoods(
  s: RunState,
  goods: readonly ShopOffer[],
  number = 2,
  sale: number | null = null,
): RunState {
  const visit: ShopVisit = {
    number,
    offers: [...goods, ...SERVICE_OFFERS],
    sale,
    refreshes: 0,
    boughtAny: false,
  };
  return { ...s, screen: 'shop', hand: [], offers: { shop: visit } };
}

/** The state with a crate open on top of its shop visit. */
function withPick(
  s: RunState,
  source: CrateId | 'housewarming',
  options: readonly PickOption[],
): RunState {
  return { ...s, offers: { ...s.offers, pick: { source, options } } };
}

const withSeed = (s: RunState, seed: string): RunState => ({ ...s, setup: { ...s.setup, seed } });
const owned = (...ids: BlueprintId[]) => ids.map((id) => ({ id, boughtWeek: 1 }));
const tool = (id: ToolId): Supply => ({ kind: 'tool', id });
const fixtureSupply = (id: 'fireplace' | 'skylight' | 'sprinkler'): Supply => ({
  kind: 'fixture',
  id,
});
const pc = (id: PieceId): Card => ({ kind: 'piece', id });
const bpOpt = (id: BlueprintId): PickOption => ({ kind: 'blueprint', id });

const rarityCount = (): Record<Rarity, number> => ({ common: 0, uncommon: 0, rare: 0 });

/** Tools a find or the shop can hand out: every one but Inspector's Visit (offered: false). */
const OFFERED_TOOLS = (Object.keys(C.tools) as ToolId[]).filter((id) => C.tools[id].offered);
const UPGRADES = Object.keys(C.upgrades) as UpgradeId[];
const CRATES = Object.keys(C.crates) as CrateId[];

/** A plain run state to roll stock from (stockGoods reads only the seed and owned blueprints). */
const START = rules.newRun(setup('m3b'));
/** Shop 1, reached by play: phase 1, week 3, budget 3, rerollsLeft 2. */
const SHOP1 = shop1('m3b');

// ---------------------------------------------------------------------------------------

describe('tools and crates on offer', () => {
  it('shop 2 offers 2 distinct tools after the cards, at 70/25/5, never Inspector’s Visit', () => {
    expect(OFFERED_TOOLS).toHaveLength(12);
    expect(OFFERED_TOOLS).not.toContain('inspectorsVisit');
    const count = rarityCount();
    const seen = new Set<ToolId>();
    for (let k = 0; k < 1000; k++) {
      const goods = stockGoods(C, withSeed(START, `tools/${k}`), 2, 0);
      // 3 blueprints, 2 cards, then the 2 tools and the crate.
      expect(goods.slice(5).map((o) => o.kind)).toEqual(['tool', 'tool', 'crate']);
      const ids = goods.flatMap((o) => (o.kind === 'tool' ? [o.id] : []));
      expect(new Set(ids).size).toBe(2);
      for (const id of ids) {
        expect(C.tools[id].offered).toBe(true);
        count[C.tools[id].rarity]++;
        seen.add(id);
      }
    }
    // 2000 tools: about 1400 / 500 / 100 (±4σ is about ±82, ±78, ±39).
    expect(count.common).toBeGreaterThan(1318);
    expect(count.common).toBeLessThan(1482);
    expect(count.uncommon).toBeGreaterThan(422);
    expect(count.uncommon).toBeLessThan(578);
    expect(count.rare).toBeGreaterThan(61);
    expect(count.rare).toBeLessThan(139);
    expect(seen).toEqual(new Set(OFFERED_TOOLS));
    // TEST_CONTENT's shop 1 stocks no tools or crates.
    const first = stockGoods(C, START, 1, 0).map((o) => o.kind);
    expect(first).not.toContain('tool');
    expect(first).not.toContain('crate');
  });

  it('the crate slot picks one of the four crates uniformly; more slots never repeat one', () => {
    const count: Record<string, number> = {};
    for (let k = 0; k < 1000; k++) {
      const crates = stockGoods(C, withSeed(START, `crates/${k}`), 2, 0).filter(
        (o) => o.kind === 'crate',
      );
      expect(crates).toHaveLength(1);
      const id = crates[0]!.kind === 'crate' ? crates[0]!.id : '';
      count[id] = (count[id] ?? 0) + 1;
    }
    // 1000 crates: about 250 each (±4σ is about ±55).
    expect(Object.keys(count).sort()).toEqual([...CRATES].sort());
    for (const id of CRATES) {
      expect(count[id]).toBeGreaterThan(195);
      expect(count[id]).toBeLessThan(305);
    }
    // Six crate slots: each of the four crates once.
    const many = stockRow(1, { crates: 6 });
    for (let k = 0; k < 20; k++) {
      const ids = stockGoods(many, withSeed(START, `many/${k}`), 2, 0).flatMap((o) =>
        o.kind === 'crate' ? [o.id] : [],
      );
      expect([...ids].sort()).toEqual([...CRATES].sort());
    }
  });
});

describe('the company upgrade', () => {
  it('one per visit from shop 2, from shop/<n>/upgrade, after the goods and never on sale', () => {
    expect(visitOf(SHOP1).offers.some((o) => o.kind === 'upgrade')).toBe(false);
    for (let k = 0; k < 50; k++) {
      const seed = `upgrade/${k}`;
      const s = withSeed(START, seed);
      const v = openVisit(C, s, 2);
      expect(v.offers.slice(0, 8)).toEqual(stockGoods(C, s, 2, 0));
      expect(v.offers.slice(8)).toEqual([
        { kind: 'upgrade', id: stream(seed, 'shop/2/upgrade').pick(UPGRADES) },
        ...SERVICE_OFFERS,
      ]);
      // Shop 3 has its own key.
      expect(openVisit(C, s, 3).offers[8]).toEqual({
        kind: 'upgrade',
        id: stream(seed, 'shop/3/upgrade').pick(UPGRADES),
      });
      // The sale is one of the 8 goods: never the upgrade (index 8) or a service.
      expect(v.sale).not.toBeNull();
      expect(v.sale!).toBeLessThan(8);
    }
  });

  it('never offers one the run owns; with all seven owned there is none', () => {
    const six = UPGRADES.filter((id) => id !== 'foreman');
    const two: UpgradeId[] = ['savingsAccount', 'toolBelt'];
    const rest = UPGRADES.filter((id) => !two.includes(id));
    for (let k = 0; k < 20; k++) {
      const seed = `owned up/${k}`;
      const s = withSeed(START, seed);
      const ups = (o: readonly UpgradeId[]) =>
        openVisit(C, { ...s, upgrades: o }, 2).offers.filter((x) => x.kind === 'upgrade');
      expect(ups(six)).toEqual([{ kind: 'upgrade', id: 'foreman' }]);
      expect(ups(two)).toEqual([
        { kind: 'upgrade', id: stream(seed, 'shop/2/upgrade').pick(rest) },
      ]);
      const all = openVisit(C, { ...s, upgrades: UPGRADES }, 2);
      expect(all.offers.filter((x) => x.kind === 'upgrade')).toEqual([]);
      expect(all.offers).toHaveLength(8 + 3);
    }
  });

  it('a refresh rerolls the goods but keeps the upgrade, sold mark and all', () => {
    const s = { ...shop2('keep'), budget: 30 };
    const v = visitOf(s);
    const ui = v.offers.findIndex((o) => o.kind === 'upgrade');
    expect(ui).toBe(8);
    const up = v.offers[ui]!;
    if (up.kind !== 'upgrade') throw new Error('no upgrade');
    // Unsold, it carries over as it was.
    const refreshed = visitOf(R3.apply(s, REFRESH).state);
    expect(refreshed.offers[ui]).toEqual(up);
    expect(refreshed.offers.slice(0, 8)).toEqual(stockGoods(P3, s, 2, 1));
    // Bought, it joins state.upgrades and stays sold through the refresh.
    const { state, events } = R3.apply(s, buy(ui));
    expect(state.upgrades).toEqual([up.id]);
    expect(eventsOf(events, 'bought')[0]).toMatchObject({
      offer: up,
      price: C.upgrades[up.id].price,
    });
    const after = R3.apply(state, REFRESH).state;
    expect(visitOf(after).offers[ui]).toEqual({ ...up, sold: true });
    expect(R3.shopOffers(after)[ui]).toMatchObject({ ok: false, reason: SHOP_REASONS.sold });
  });
});

describe('prices', () => {
  it('tools, crates, and upgrades cost their defs’ prices', () => {
    const goods: ShopOffer[] = [
      { kind: 'tool', id: 'rushOrder' }, // Common 2
      { kind: 'tool', id: 'movingTruck' }, // Uncommon 3
      { kind: 'tool', id: 'copyMachine' }, // Rare 4
      { kind: 'crate', id: 'gardenCenter' }, // 4
      ...UPGRADES.map((id): ShopOffer => ({ kind: 'upgrade', id })),
    ];
    const s = withGoods({ ...SHOP1, budget: 50 }, goods);
    expect(rules.shopOffers(s).map((o) => o.price)).toEqual([
      2, 3, 4, 4,
      // Storage Unit 6, Tool Belt 6, Drafting Table 7, Bigger Truck 8, Foreman 7, Supplier
      // Discount 7, Savings Account 6.
      6, 6, 7, 8, 7, 7, 6,
      // The services: reroll 1, demolition 1, strike 2.
      1, 1, 2,
    ]);
  });

  it('Supplier Discount takes 25% off every good, rounded half up, at once; not services or the refresh', () => {
    const goods: ShopOffer[] = [
      { kind: 'tool', id: 'rushOrder' }, // 2 → 1.5 → 2
      { kind: 'tool', id: 'movingTruck' }, // 3 → 2.25 → 2
      { kind: 'tool', id: 'copyMachine' }, // 4 → 3
      { kind: 'crate', id: 'showroom' }, // 4 → 3
      { kind: 'upgrade', id: 'savingsAccount' }, // 6 → 4.5 → 5
      { kind: 'upgrade', id: 'foreman' }, // 7 → 5.25 → 5
      { kind: 'upgrade', id: 'biggerTruck' }, // 8 → 6
      { kind: 'blueprint', id: 'fengShui' }, // 4 → 3
      { kind: 'blueprint', id: 'openConcept' }, // 6 → 4.5 → 5
      { kind: 'fixture', id: 'kitchenIsland' }, // 3 → 2.25 → 2
      { kind: 'piece', id: 'library' }, // 3 → 2.25 → 2
      { kind: 'upgrade', id: 'supplierDiscount' }, // 7, bought first
    ];
    const s = withGoods({ ...SHOP1, budget: 50 }, goods);
    expect(rules.shopOffers(s).map((o) => o.price)).toEqual([
      2, 3, 4, 4, 6, 7, 8, 4, 6, 3, 3, 7, 1, 1, 2,
    ]);
    expect(rules.canRefresh(s).price).toBe(2);
    const { state, events } = rules.apply(s, buy(11));
    expect(eventsOf(events, 'bought')[0]!.price).toBe(7);
    expect(state.upgrades).toEqual(['supplierDiscount']);
    expect(rules.rule(state, 'shopPricePct')).toBe(75);
    const views = rules.shopOffers(state);
    expect(views.map((o) => o.price)).toEqual([
      2,
      2,
      3,
      3,
      5,
      5,
      6,
      3,
      5,
      2,
      2,
      5, // the sold Supplier Discount itself, at today's price
      1,
      1,
      2, // services unchanged
    ]);
    expect(views.map((o) => o.fullPrice).slice(0, 11)).toEqual([2, 2, 3, 3, 5, 5, 6, 3, 5, 2, 2]);
    expect(rules.canRefresh(state)).toEqual({ ok: true, price: 2 });
    // Buying a good charges its discounted price.
    const copied = rules.apply(state, buy(2));
    expect(eventsOf(copied.events, 'bought')[0]!.price).toBe(3);
    expect(copied.state.budget).toBe(50 - 7 - 3);
    // The sale halves the discounted price: Copy Machine 4 → 3 → 1.5 → 2.
    const onSale = withGoods({ ...state }, goods, 2, 2);
    expect(rules.shopOffers({ ...onSale, upgrades: ['supplierDiscount'] })[2]).toMatchObject({
      price: 2,
      fullPrice: 3,
      onSale: true,
    });
  });
});

describe('buying tools and upgrades', () => {
  it('a tool goes into the supplies, which it shares with fixtures; full supplies grey it out', () => {
    const s = withGoods(
      { ...SHOP1, budget: 10, supplies: [fixtureSupply('fireplace'), fixtureSupply('skylight')] },
      [
        { kind: 'tool', id: 'rushOrder' },
        { kind: 'tool', id: 'dumpster' },
      ],
    );
    const { state } = rules.apply(s, buy(0));
    expect(state.supplies).toEqual([
      fixtureSupply('fireplace'),
      fixtureSupply('skylight'),
      tool('rushOrder'),
    ]);
    expect(state.budget).toBe(8);
    expect(rules.shopOffers(state)[1]).toMatchObject({
      ok: false,
      reason: SHOP_REASONS.suppliesFull,
    });
    expect(illegal(() => rules.apply(state, buy(1))).reason).toBe(SHOP_REASONS.suppliesFull);
  });

  it('Storage Unit, Tool Belt, and Drafting Table add their slot at once, in the same visit', () => {
    const cases: [
      UpgradeId,
      Partial<RunState>,
      ShopOffer,
      'reserve' | 'supplies' | 'blueprints',
      string,
    ][] = [
      [
        'storageUnit',
        { reserve: [{ id: 'library' }, { id: 'pool' }] },
        { kind: 'piece', id: 'sunroom' },
        'reserve',
        SHOP_REASONS.reserveFull,
      ],
      [
        'toolBelt',
        { supplies: [tool('rushOrder'), tool('dumpster'), fixtureSupply('fireplace')] },
        { kind: 'tool', id: 'catalog' },
        'supplies',
        SHOP_REASONS.suppliesFull,
      ],
      [
        'draftingTable',
        { blueprints: owned('quietHours', 'greenThumb', 'partyHouse', 'waterfront') },
        { kind: 'blueprint', id: 'fengShui' },
        'blueprints',
        SHOP_REASONS.blueprintsFull,
      ],
    ];
    for (const [id, patch, good, slot, reason] of cases) {
      const s = withGoods({ ...SHOP1, budget: 50, ...patch }, [{ kind: 'upgrade', id }, good]);
      const base = rules.slots(s)[slot];
      expect(rules.shopOffers(s)[1]).toMatchObject({ ok: false, reason });
      const up = rules.apply(s, buy(0)).state;
      expect(up.upgrades).toEqual([id]);
      expect(rules.slots(up)[slot]).toBe(base + 1);
      expect(rules.shopOffers(up)[1]!.ok).toBe(true);
      expect(() => rules.apply(up, buy(1))).not.toThrow();
    }
  });

  it('Bigger Truck: the next hand drawn has a third Rooms card (D-121)', () => {
    const seed = 'bigger truck';
    const s = withGoods(
      { ...shop1(seed), budget: 20 },
      [{ kind: 'upgrade', id: 'biggerTruck' }],
      1,
    );
    const bought = rules.apply(s, buy(0)).state;
    expect(rules.rule(bought, 'roomsRow')).toBe(3);
    expect(bought.hand).toEqual([]);
    const { state, events } = rules.apply(bought, LEAVE);
    const first = eventsOf(events, 'handDrawn')[0]!;
    expect(first.hand).toHaveLength(5);
    // Phase 2 (index 1), week 1, draw 0: 3 Rooms cards, then 2 Layout cards.
    expect(drawnBefore(first)).toEqual(drawRows(C, seed, 1, '1', 0, {}, { rooms: 3 }));
    expect(rules.apply(state, REROLL).state.hand).toHaveLength(5);
    // Without it, 2 + 2.
    const control = eventsOf(rules.apply(s, LEAVE).events, 'handDrawn')[0]!;
    expect(control.hand).toHaveLength(4);
  });

  it('Foreman: one more reroll, from the next phase’s start', () => {
    const s = withGoods({ ...SHOP1, budget: 20 }, [{ kind: 'upgrade', id: 'foreman' }], 1);
    expect(s.rerollsLeft).toBe(2); // 1 base + the General Contractor's 1
    const bought = rules.apply(s, buy(0)).state;
    expect(rules.rule(bought, 'rerollsPerPhase')).toBe(3);
    expect(bought.rerollsLeft).toBe(2); // set when the milestone resolved
    expect(rules.apply(bought, LEAVE).state.rerollsLeft).toBe(3);
  });
});

describe('Savings Account interest', () => {
  it('pays min(floor(budget ÷ 5), 3) at a met milestone, inside reward.budget and reward.interest', () => {
    const rows: [number, number][] = [
      [4, 0],
      [5, 1],
      [12, 2],
      [15, 3],
      [40, 3], // floor(40 / 5) = 8, capped at interestMax 3
    ];
    for (const [budget, interest] of rows) {
      const s: RunState = {
        ...rules.newRun(setup(`save ${budget}`)),
        budget,
        upgrades: ['savingsAccount'],
      };
      expect(rules.rule(s, 'interestMax')).toBe(3);
      const { state, events } = finishPhase(rules, s);
      const reward = { budget: 3 + interest, score: 0, interest }; // milestoneBudget 3
      expect(eventsOf(events, 'milestone')[0]).toMatchObject({ result: 'onTime', reward });
      expect(state.milestones[0]!.reward).toEqual(reward);
      expect(state.budget).toBe(budget + 3 + interest);
      expect(state.budgetEarned).toBe(3 + interest);
    }
    // Without it, interestMax is 0.
    const plain = { ...rules.newRun(setup('save none')), budget: 40 };
    const { events } = finishPhase(rules, plain);
    expect(eventsOf(events, 'milestone')[0]!.reward).toEqual({ budget: 3, score: 0, interest: 0 });
  });

  it('counts the budget held before the reward, so an early bonus doesn’t raise it', () => {
    const s: RunState = {
      ...rules.newRun(setup('save early')),
      budget: 5,
      score: 5,
      upgrades: ['savingsAccount'],
    };
    const { state, events } = rules.apply(s, { t: 'completeEarly' });
    // 2 weeks saved: +2 × 2 = 4 budget, and roundHalfUp(5 × 10% × 2) = 1 Wow. Interest on
    // the 5 held is 1 (not floor((5 + 3 + 4) / 5) = 2).
    expect(eventsOf(events, 'milestone')[0]).toMatchObject({
      result: 'early',
      weeksSaved: 2,
      reward: { budget: 3 + 4 + 1, score: 1, interest: 1 },
    });
    expect(state.budget).toBe(5 + 8);
  });

  it('pays nothing on a failed milestone', () => {
    const s: RunState = {
      ...rules.newRun(setup('save fail')),
      budget: 40,
      upgrades: ['savingsAccount'],
    };
    let cur = s;
    const events: GameEvent[] = [];
    // Target 5 never met: 2 weeks, both overtime weeks, then the loss.
    for (let k = 0; k < 4; k++) {
      const out = rules.apply(cur, PASS);
      cur = out.state;
      events.push(...out.events);
    }
    expect(cur.screen).toBe('lost');
    expect(eventsOf(events, 'milestone')[0]).toMatchObject({
      result: 'failed',
      reward: { budget: 0, score: 0, interest: 0 },
    });
    expect(cur.budget).toBe(40);
  });

  it('bought in the shop, it pays from the next milestone', () => {
    const s = withGoods(
      { ...shop1('saver'), budget: 20 },
      [{ kind: 'upgrade', id: 'savingsAccount' }],
      1,
    );
    let cur = rules.apply(s, buy(0)).state; // 20 − 6 = 14
    cur = rules.apply(cur, LEAVE).state; // bought something: no skip reward
    expect(cur.budget).toBe(14);
    const { state, events } = finishPhase(rules, cur);
    // floor(14 / 5) = 2. The last milestone: the run is won.
    expect(eventsOf(events, 'milestone')[0]!.reward).toEqual({ budget: 5, score: 0, interest: 2 });
    expect(state.screen).toBe('won');
    expect(state.budget).toBe(19);
  });
});

describe('crates', () => {
  it('buying one opens a pick of 3 from crate/<shop>/<refreshes>/<offer index>', () => {
    const s = R3.apply({ ...shop2('crate'), budget: 30 }, REFRESH).state; // 30 − 2
    const v = visitOf(s);
    expect(v).toMatchObject({ number: 2, refreshes: 1 });
    const crate = v.offers[7]!;
    if (crate.kind !== 'crate') throw new Error('no crate at 7');
    const { state, events } = R3.apply(s, buy(7));
    const options = crateOptions(P3, s, crate.id, 'crate/2/1/7');
    expect(options).toHaveLength(3);
    expect(types(events)).toEqual(['bought', 'crateOpened']);
    expect(events[1]).toEqual({ t: 'crateOpened', source: crate.id, options });
    expect(state.offers?.pick).toEqual({ source: crate.id, options });
    expect(state.budget).toBe(28 - 4);
    expect(visitOf(state).offers[7]).toEqual({ ...crate, sold: true });
    expect(visitOf(state).boughtAny).toBe(true);
  });

  it('a Blueprint Folio holds 3 distinct offered, unowned blueprints at the shop’s rarity weights', () => {
    const base = withGoods({ ...SHOP1, blueprints: owned('fengShui', 'crownJewel') }, []);
    const count = rarityCount();
    for (let k = 0; k < 500; k++) {
      const opts = crateOptions(C, withSeed(base, `folio/${k}`), 'blueprintFolio', 'crate/2/0/7');
      expect(opts).toHaveLength(3);
      const ids = opts.map((o) => {
        if (o.kind !== 'blueprint') throw new Error(`a folio held a ${o.kind}`);
        return o.id;
      });
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) {
        expect(['fengShui', 'crownJewel', 'dreamHome']).not.toContain(id);
        count[C.blueprints[id].rarity]++;
      }
    }
    // Shop 2 (70/25/5), 1500 options: about 1050 / 375 / 75 (±4σ is about ±71, ±67, ±34).
    expect(count.common).toBeGreaterThan(979);
    expect(count.common).toBeLessThan(1121);
    expect(count.uncommon).toBeGreaterThan(308);
    expect(count.uncommon).toBeLessThan(442);
    expect(count.rare).toBeGreaterThan(41);
    expect(count.rare).toBeLessThan(109);
    // In shop 1 (100/0/0), Common only.
    const first = withGoods(base, [], 1);
    for (let k = 0; k < 50; k++) {
      for (const o of crateOptions(C, withSeed(first, `folio1/${k}`), 'blueprintFolio', 'k')) {
        expect(o.kind === 'blueprint' && C.blueprints[o.id].rarity).toBe('common');
      }
    }
  });

  it('a Fixture Crate holds 3 distinct fixtures by rarity, the Rare Chandelier included', () => {
    const base = withGoods(SHOP1, []);
    const count = rarityCount();
    for (let k = 0; k < 500; k++) {
      const opts = crateOptions(C, withSeed(base, `fixtures/${k}`), 'fixtureCrate', 'crate/2/0/7');
      expect(opts).toHaveLength(3);
      const ids = opts.map((o) => {
        if (o.kind !== 'fixture') throw new Error(`a fixture crate held a ${o.kind}`);
        return o.id;
      });
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) count[C.fixtures[id].rarity]++;
    }
    expect(count.rare).toBeGreaterThan(0); // the Chandelier is the one Rare fixture
    expect(count.common).toBeGreaterThan(count.uncommon);
    expect(count.uncommon).toBeGreaterThan(count.rare);
    // Shop 1: Common only.
    const first = withGoods(base, [], 1);
    for (let k = 0; k < 50; k++) {
      for (const o of crateOptions(C, withSeed(first, `fixtures1/${k}`), 'fixtureCrate', 'k')) {
        expect(o.kind === 'fixture' && C.fixtures[o.id].rarity).toBe('common');
      }
    }
  });

  it('a Garden Center holds yard pieces and outbuildings, base or special; a Showroom, special pieces', () => {
    const base = withGoods(SHOP1, []);
    const defs = Object.values(C.pieces);
    const garden = defs.filter((d) => d.category !== 'indoor').map((d) => d.id);
    // Member rooms (M4b) are weight 0 too, but never in a crate.
    const special = defs.filter((d) => d.drawWeight === 0 && !d.member).map((d) => d.id);
    expect(garden).toHaveLength(15); // 10 yard pieces (2 of them packs) and 5 outbuildings
    expect(special).toHaveLength(9);
    const cases: [CrateId, PieceId[]][] = [
      ['gardenCenter', garden],
      ['showroom', special],
    ];
    for (const [crate, pool] of cases) {
      const seen = new Set<PieceId>();
      for (let k = 0; k < 300; k++) {
        const opts = crateOptions(C, withSeed(base, `${crate}/${k}`), crate, 'crate/2/0/7');
        expect(opts).toHaveLength(3);
        const ids = opts.map((o) => {
          if (o.kind !== 'piece') throw new Error(`a ${crate} held a ${o.kind}`);
          return o.id;
        });
        expect(new Set(ids).size).toBe(3);
        for (const id of ids) seen.add(id);
      }
      expect(seen).toEqual(new Set(pool));
    }
    // The Garden Center mixes both pools: a base Lawn and a special Pool are both in it.
    expect(garden).toContain('lawn');
    expect(garden).toContain('pool');
  });

  it('a crate needs a free slot of its contents’ kind to be bought', () => {
    const fullBlueprints = {
      blueprints: owned('fengShui', 'quietHours', 'greenThumb', 'waterfront'),
    };
    const fullSupplies = {
      supplies: [tool('rushOrder'), tool('dumpster'), fixtureSupply('fireplace')],
    };
    const fullReserve = { reserve: [{ id: 'library' as PieceId }, { id: 'pool' as PieceId }] };
    const cases: [CrateId, Partial<RunState>, string][] = [
      ['blueprintFolio', fullBlueprints, SHOP_REASONS.blueprintsFull],
      ['fixtureCrate', fullSupplies, SHOP_REASONS.suppliesFull], // tools count too
      ['gardenCenter', fullReserve, SHOP_REASONS.reserveFull],
      ['showroom', fullReserve, SHOP_REASONS.reserveFull],
    ];
    for (const [id, patch, reason] of cases) {
      const s = withGoods({ ...SHOP1, budget: 20, ...patch }, [{ kind: 'crate', id }]);
      expect(rules.shopOffers(s)[0]).toMatchObject({ ok: false, reason });
      expect(illegal(() => rules.apply(s, buy(0))).reason).toBe(reason);
      expect(rules.legalActions(s)).not.toContainEqual(buy(0));
    }
    // Other kinds' full slots don't matter.
    const s = withGoods({ ...SHOP1, budget: 20, ...fullSupplies, ...fullReserve }, [
      { kind: 'crate', id: 'blueprintFolio' },
    ]);
    expect(rules.shopOffers(s)[0]!.ok).toBe(true);
    expect(rules.apply(s, buy(0)).state.offers?.pick?.source).toBe('blueprintFolio');
  });

  it('while a crate is open, every offer greys out and only picks, sells, and toggles go through', () => {
    const s = withGoods(
      {
        ...SHOP1,
        budget: 20,
        blueprints: owned('quietHours'),
        supplies: [fixtureSupply('fireplace')],
      },
      [
        { kind: 'crate', id: 'showroom' },
        { kind: 'blueprint', id: 'fengShui' },
        { kind: 'tool', id: 'rushOrder' },
      ],
    );
    const open = rules.apply(s, buy(0)).state;
    expect(open.offers?.pick?.options).toHaveLength(3);
    const views = rules.shopOffers(open);
    expect(views[0]).toMatchObject({ ok: false, reason: SHOP_REASONS.sold });
    for (const o of views.slice(1)) {
      expect(o).toMatchObject({ ok: false, reason: SHOP_REASONS.picking });
    }
    expect(views.slice(1).map((o) => o.offer.kind)).toEqual([
      'blueprint',
      'tool',
      'service',
      'service',
      'service',
    ]);
    expect(rules.canRefresh(open)).toEqual({ ok: false, reason: SHOP_REASONS.picking, price: 2 });
    for (const a of [buy(1), buy(3), REFRESH, LEAVE]) {
      expect(illegal(() => rules.apply(open, a)).reason).toBe(SHOP_REASONS.picking);
    }
    // The build screen's actions, tools included, stay closed.
    expect(() => rules.apply(open, PASS)).toThrow(IllegalAction);
    expect(() => rules.apply(open, { t: 'useTool', i: 0 })).toThrow(IllegalAction);
    // Sells, the toggle, and debug cheats work, and leave the crate open.
    const sold = rules.apply(open, sellBlueprint(0)).state;
    expect(sold.budget).toBe(open.budget + 2); // Quiet Hours: 4 → 2
    expect(sold.offers?.pick).toEqual(open.offers?.pick);
    const toggled = rules.apply(open, { t: 'setAutoComplete', on: true }).state;
    expect(toggled.autoComplete).toBe(true);
    expect(toggled.offers?.pick).toEqual(open.offers?.pick);
    const cheat = rules.apply(open, { t: 'debug', op: 'addBudget', amount: 5 }).state;
    expect(cheat.offers?.pick).toEqual(open.offers?.pick);
    // legalActions: each option with room, the discard, then the sells.
    expect(rules.legalActions(open)).toEqual([
      pick(0),
      pick(1),
      pick(2),
      pick(-1),
      sellBlueprint(0),
      sellSupply(0),
    ]);
  });

  it('a pick goes where buying it would; −1 discards the crate; both close it', () => {
    const base = withGoods({ ...SHOP1, budget: 10 }, [{ kind: 'blueprint', id: 'partyHouse' }]);
    const cases: [CrateId, PickOption, Partial<RunState>][] = [
      [
        'blueprintFolio',
        bpOpt('fengShui'),
        { blueprints: [{ id: 'fengShui', boughtWeek: 3 }] }, // bought this week (3)
      ],
      [
        'fixtureCrate',
        { kind: 'fixture', id: 'chandelier' },
        { supplies: [{ kind: 'fixture', id: 'chandelier' }] },
      ],
      ['gardenCenter', { kind: 'piece', id: 'pool' }, { reserve: [{ id: 'pool' }] }],
    ];
    for (const [source, option, where] of cases) {
      const s = withPick(base, source, [bpOpt('curbAppeal'), option, bpOpt('waterfront')]);
      const { state, events } = rules.apply(s, pick(1));
      expect(events).toEqual([{ t: 'picked', source, option }]);
      expect(state).toMatchObject({ ...where, budget: 10 });
      expect(state.offers).toEqual({ shop: visitOf(base) });
      // The shop opens up again.
      expect(rules.shopOffers(state)[0]!.ok).toBe(true);
    }
    const s = withPick(base, 'showroom', [
      { kind: 'piece', id: 'library' },
      { kind: 'piece', id: 'pool' },
      { kind: 'piece', id: 'sunroom' },
    ]);
    const { state, events } = rules.apply(s, pick(-1));
    expect(events).toEqual([{ t: 'picked', source: 'showroom', option: null }]);
    expect(state.offers).toEqual({ shop: visitOf(base) });
    expect(state).toMatchObject({ budget: 10, reserve: [], supplies: [], blueprints: [] });
  });

  it('a discarded crate was still a purchase: leaving pays no skip reward', () => {
    const s = withGoods({ ...SHOP1, budget: 10 }, [{ kind: 'crate', id: 'fixtureCrate' }], 1);
    let cur = rules.apply(s, buy(0)).state;
    cur = rules.apply(cur, pick(-1)).state;
    const { events } = rules.apply(cur, LEAVE);
    expect(eventsOf(events, 'shopClosed')[0]).toMatchObject({ skipReward: 0, budget: 6 });
  });

  it('room is checked again at the pick: sell to make room, then pick', () => {
    const full = owned('fengShui', 'quietHours', 'greenThumb', 'waterfront');
    let s = withPick(withGoods({ ...SHOP1, budget: 0, blueprints: full }, []), 'blueprintFolio', [
      bpOpt('fengShui'), // owned
      bpOpt('partyHouse'),
      bpOpt('curbAppeal'),
    ]);
    expect(rules.legalActions(s)).toEqual([pick(-1), ...[0, 1, 2, 3].map(sellBlueprint)]);
    expect(illegal(() => rules.apply(s, pick(0))).reason).toBe(SHOP_REASONS.owned);
    expect(illegal(() => rules.apply(s, pick(1))).reason).toBe(SHOP_REASONS.blueprintsFull);
    s = rules.apply(s, sellBlueprint(1)).state; // Quiet Hours: +2
    expect(s.budget).toBe(2);
    expect(rules.legalActions(s)).toEqual([
      pick(1),
      pick(2),
      pick(-1),
      ...[0, 1, 2].map(sellBlueprint),
    ]);
    expect(illegal(() => rules.apply(s, pick(0))).reason).toBe(SHOP_REASONS.owned);
    const kept = rules.apply(s, pick(1)).state;
    expect(kept.blueprints.map((o) => o.id)).toEqual([
      'fengShui',
      'greenThumb',
      'waterfront',
      'partyHouse',
    ]);
    // The same for a fixture with the supplies full of tools.
    let f = withPick(
      withGoods(
        { ...SHOP1, budget: 0, supplies: [tool('rushOrder'), tool('catalog'), tool('dumpster')] },
        [],
      ),
      'fixtureCrate',
      [{ kind: 'fixture', id: 'fireplace' }],
    );
    expect(illegal(() => rules.apply(f, pick(0))).reason).toBe(SHOP_REASONS.suppliesFull);
    f = rules.apply(f, sellSupply(0)).state;
    expect(rules.apply(f, pick(0)).state.supplies).toEqual([
      tool('catalog'),
      tool('dumpster'),
      { kind: 'fixture', id: 'fireplace' },
    ]);
  });

  it('pick needs an open crate and one of its options', () => {
    expect(illegal(() => rules.apply(SHOP1, pick(0))).reason).toBe('There’s no crate open.');
    expect(illegal(() => rules.apply(START, pick(0))).reason).toBe(SHOP_REASONS.notOpen);
    const s = withPick(withGoods(SHOP1, []), 'showroom', [{ kind: 'piece', id: 'library' }]);
    for (const i of [1, -2, 0.5]) {
      expect(illegal(() => rules.apply(s, pick(i))).reason).toBe('That isn’t one of the options.');
    }
  });
});

describe('the Housewarming crate', () => {
  const HW = stockRow(0, { housewarming: 3 });
  const RH = createRules(HW);

  it('a shop with housewarming 3 opens with a pick of 3 Common blueprints, after shopOpened', () => {
    const { state, events } = finishPhase(RH, RH.newRun(setup('housewarming')));
    expect(types(events).slice(-3)).toEqual(['milestone', 'shopOpened', 'crateOpened']);
    const open = state.offers?.pick;
    expect(open?.source).toBe('housewarming');
    const options = open!.options;
    expect(options).toHaveLength(3);
    expect(options).toEqual(crateOptions(HW, state, 'housewarming', 'crate/1/0/housewarming', 3));
    expect(events.at(-1)).toEqual({ t: 'crateOpened', source: 'housewarming', options });
    const ids = options.map((o) => (o.kind === 'blueprint' ? o.id : null));
    expect(new Set(ids).size).toBe(3);
    for (const id of ids) {
      expect(C.blueprints[id!]).toMatchObject({ rarity: 'common', offered: true });
    }
    // Over many seeds: always 3 distinct Commons.
    for (let k = 0; k < 100; k++) {
      const opts = crateOptions(HW, withSeed(state, `hw/${k}`), 'housewarming', 'x', 3);
      expect(opts).toHaveLength(3);
      expect(new Set(opts.map((o) => o.id)).size).toBe(3);
      for (const o of opts)
        expect(o.kind === 'blueprint' && C.blueprints[o.id].rarity).toBe('common');
    }
  });

  it('never offers an owned blueprint; with every Common owned there’s no pick', () => {
    const three = owned('fengShui', 'curbAppeal', 'quietHours');
    const s = { ...RH.newRun(setup('hw owned')), blueprints: three };
    const opts = finishPhase(RH, s).state.offers!.pick!.options.map((o) => o.id);
    expect([...opts].sort()).toEqual(['greenThumb', 'partyHouse', 'waterfront']);
    // Four owned: only two Commons left.
    const four = { ...s, blueprints: owned('fengShui', 'curbAppeal', 'quietHours', 'greenThumb') };
    expect(finishPhase(RH, four).state.offers!.pick!.options).toHaveLength(2);
    // All six: the shop opens without one.
    const all = owned(
      'fengShui',
      'curbAppeal',
      'quietHours',
      'greenThumb',
      'partyHouse',
      'waterfront',
    );
    const { state, events } = finishPhase(RH, { ...s, blueprints: all });
    expect(state.offers?.pick).toBeUndefined();
    expect(types(events)).not.toContain('crateOpened');
    expect(types(events).at(-1)).toBe('shopOpened');
  });

  it('prefers blueprints the shop beside it isn’t selling', () => {
    for (let k = 0; k < 40; k++) {
      const open = finishPhase(RH, RH.newRun(setup(`hw shop ${k}`))).state;
      const inShop = open.offers!.shop!.offers.flatMap((o) =>
        o.kind === 'blueprint' ? [o.id] : [],
      );
      const gift = open.offers!.pick!.options.map((o) => o.id);
      // 6 Commons, 2 in the shop: the gift's 3 all come from the other 4.
      expect(gift).toHaveLength(3);
      for (const id of gift) expect(inShop).not.toContain(id);
    }
  });

  it('picking it is free and isn’t buying: leaving still pays the skip reward', () => {
    const open = finishPhase(RH, RH.newRun(setup('hw free'))).state;
    expect(open.budget).toBe(3);
    // Until it's picked or discarded, the shop waits.
    expect(illegal(() => RH.apply(open, LEAVE)).reason).toBe(SHOP_REASONS.picking);
    expect(illegal(() => RH.apply(open, buy(0))).reason).toBe(SHOP_REASONS.picking);
    const option = open.offers!.pick!.options[0]!;
    const { state, events } = RH.apply(open, pick(0));
    expect(events).toEqual([{ t: 'picked', source: 'housewarming', option }]);
    expect(state.budget).toBe(3);
    expect(state.blueprints).toEqual([{ id: option.id, boughtWeek: 3 }]);
    expect(visitOf(state).boughtAny).toBe(false);
    const left = RH.apply(state, LEAVE);
    expect(eventsOf(left.events, 'shopClosed')[0]).toMatchObject({ skipReward: 1, budget: 4 });
    // Discarding it is free too.
    const discarded = RH.apply(open, pick(-1)).state;
    expect(eventsOf(RH.apply(discarded, LEAVE).events, 'shopClosed')[0]!.skipReward).toBe(1);
  });

  it('the real content’s first shop opens with it', () => {
    const real = createRules(CONTENT);
    const { state, events } = finishPhase(real, real.newRun(setup('real housewarming')));
    expect(state.offers?.shop?.number).toBe(1);
    expect(types(events).slice(-2)).toEqual(['shopOpened', 'crateOpened']);
    const open = state.offers?.pick;
    expect(open?.source).toBe('housewarming');
    expect(open!.options).toHaveLength(3);
    for (const o of open!.options) {
      if (o.kind !== 'blueprint') throw new Error(`housewarming held a ${o.kind}`);
      expect(CONTENT.blueprints[o.id]).toMatchObject({ rarity: 'common', offered: true });
    }
  });
});

// ---------------------------------------------------------------------------------------
// Finds.

/** A lot's tiles of one feature, top-left first. */
function cellsOf(lot: Lot, t: TerrainId): Cell[] {
  const out: Cell[] = [];
  lot.terrain.forEach((v, i) => {
    if (v === t) out.push({ x: i % lot.width, y: Math.floor(i / lot.width) });
  });
  return out;
}

const terrainAtCell = (s: RunState, c: Cell) =>
  s.house.lot.terrain[c.y * s.house.lot.width + c.x] ?? null;

/** A run in week 1 on a hand-made lot (the BIG targets keep the phase going). */
function onLot(
  rows: readonly string[],
  placements: readonly Placement[] = [],
  patch: Partial<RunState> = {},
  seed = 'finds',
): RunState {
  const s = RB.newRun(setup(seed));
  return { ...s, house: houseFrom(BIG, rows, placements), hand: [], ...patch };
}

describe('finds on generated lots', () => {
  it('real lots get one 2×2 Old Shed and 1–2 Time Capsules, back from the street and apart (300 seeds)', () => {
    const lb = CONTENT.balance.lot;
    const bare = { ...lb, oldSheds: [0, 0] as const, timeCapsules: [0, 0] as const };
    const maxY = lb.height - 1 - lb.findStreetGap; // 24 − 1 − 4 = 19
    expect(maxY).toBe(19);
    const capsuleCounts = new Set<number>();
    for (let k = 0; k < 300; k++) {
      const seed = `finds/${k}`;
      const lot = generateLot(seed, lb);
      expect(generateLot(seed, lb)).toEqual(lot);
      const sheds = cellsOf(lot, 'oldShed');
      const capsules = cellsOf(lot, 'timeCapsule');
      expect(sheds).toHaveLength(4);
      const { x, y } = sheds[0]!;
      expect(sheds).toEqual([
        { x, y },
        { x: x + 1, y },
        { x, y: y + 1 },
        { x: x + 1, y: y + 1 },
      ]);
      expect(capsules.length).toBeGreaterThanOrEqual(1);
      expect(capsules.length).toBeLessThanOrEqual(2);
      capsuleCounts.add(capsules.length);
      for (const c of [...sheds, ...capsules]) expect(c.y).toBeLessThanOrEqual(maxY);
      // No Time Capsule touches another find (the Shed's own tiles touch each other).
      for (const c of capsules) {
        for (const [dx, dy] of [
          [1, 0],
          [-1, 0],
          [0, 1],
          [0, -1],
        ] as const) {
          const nx = c.x + dx;
          const ny = c.y + dy;
          if (nx < 0 || ny < 0 || nx >= lot.width || ny >= lot.height) continue;
          const t = lot.terrain[ny * lot.width + nx];
          expect(t === 'oldShed' || t === 'timeCapsule').toBe(false);
        }
      }
      // The finds sit on ground that was free, and the rest of the terrain is unchanged.
      const plain = generateLot(seed, bare);
      expect(plain.attempt).toBe(lot.attempt);
      expect(plain.sun).toBe(lot.sun);
      lot.terrain.forEach((t, i) => {
        if (t === 'oldShed' || t === 'timeCapsule') expect(plain.terrain[i]).toBeNull();
        else expect(plain.terrain[i]).toBe(t);
      });
    }
    expect(capsuleCounts).toEqual(new Set([1, 2]));
  });
});

describe('the Old Shed', () => {
  const SHED = ['........', '.SS.....', '.SS.....', '........', '........', '........'];
  const SHED_CELLS: Cell[] = [
    { x: 1, y: 1 },
    { x: 2, y: 1 },
    { x: 1, y: 2 },
    { x: 2, y: 2 },
  ];

  it('blocks building until it’s demolished', () => {
    const s = onLot(SHED, [], { hand: [pc('closet'), pc('bedroom')] });
    const on = { t: 'place', from: 'hand', i: 0, x: 2, y: 2, rot: 0 } as const;
    expect(RB.checkPlay(s, on)).toMatchObject({ legal: false, reason: REASONS.oldShed });
    expect(RB.preview(s, on)).toMatchObject({ legal: false, reason: REASONS.oldShed });
    // A Bedroom at (0, 0) overlaps its top-left tile.
    const over = { t: 'place', from: 'hand', i: 1, x: 0, y: 0, rot: 0 } as const;
    expect(RB.checkPlay(s, over)).toMatchObject({ legal: false, reason: REASONS.oldShed });
    // Beside it is fine, and no legal placement covers it.
    expect(RB.checkPlay(s, { ...on, x: 3, y: 1 }).legal).toBe(true);
    const shed = new Set(SHED_CELLS.map((c) => `${c.x},${c.y}`));
    for (const p of RB.legalPlacements(s)) {
      const def = BIG.pieces[s.hand[p.i]!.id as PieceId];
      const w = def.shape[0]!.length;
      const h = def.shape.length;
      for (let dy = 0; dy < h; dy++)
        for (let dx = 0; dx < w; dx++)
          if (def.shape[dy]![dx] === '#') expect(shed.has(`${p.x + dx},${p.y + dy}`)).toBe(false);
    }
  });

  it('demolishing any of its tiles removes all four and pays a random tool from find/<top-left>', () => {
    const seed = 'shed';
    const s = onLot(SHED, [], { hand: [pc('closet')] }, seed);
    const reward = stream(seed, 'find/1,1').pick(OFFERED_TOOLS);
    for (const c of SHED_CELLS) {
      expect(RB.legalActions(s)).toContainEqual(demolish(c.x, c.y));
      expect(RB.previewDemolish(s, c.x, c.y)).toMatchObject({
        legal: true,
        target: { feature: 'oldShed' },
        cells: SHED_CELLS,
      });
      const { state, events } = RB.apply(s, demolish(c.x, c.y));
      expect(events).toEqual([
        { t: 'demolished', feature: 'oldShed', cells: SHED_CELLS, demolitionsLeft: 1 },
        { t: 'findClaimed', feature: 'oldShed', x: 1, y: 1, reward: { tool: reward } },
      ]);
      expect(state.supplies).toEqual([tool(reward)]);
      for (const cell of SHED_CELLS) expect(terrainAtCell(state, cell)).toBeNull();
      // A free action: the week goes on, and the ground is buildable now.
      expect(state).toMatchObject({ week: 1, slot: 1, hand: s.hand, budget: s.budget });
      expect(
        RB.checkPlay(state, { t: 'place', from: 'hand', i: 0, x: 2, y: 2, rot: 0 }).legal,
      ).toBe(true);
    }
    // Elsewhere, the key follows its top-left tile.
    const moved = onLot(
      ['........', '........', '........', '....SS..', '....SS..', '........'],
      [],
      {},
      seed,
    );
    const claim = eventsOf(RB.apply(moved, demolish(5, 4)).events, 'findClaimed')[0]!;
    expect(claim).toMatchObject({
      x: 4,
      y: 3,
      reward: { tool: stream(seed, 'find/4,3').pick(OFFERED_TOOLS) },
    });
  });

  it('its tool can be any offered tool, never Inspector’s Visit (200 seeds)', () => {
    const s = onLot(SHED);
    const seen = new Set<ToolId>();
    for (let k = 0; k < 200; k++) {
      const { state } = RB.apply(withSeed(s, `shed/${k}`), demolish(2, 2));
      const got = state.supplies[0];
      if (got?.kind !== 'tool') throw new Error('no tool');
      seen.add(got.id);
    }
    expect(seen).toEqual(new Set(OFFERED_TOOLS));
  });

  it('with the supplies full, the tool is sold at once for half its price', () => {
    const seed = 'shed full';
    const reward = stream(seed, 'find/1,1').pick(OFFERED_TOOLS);
    const half = Math.floor(C.tools[reward].price / 2);
    const full = [
      fixtureSupply('fireplace'),
      fixtureSupply('skylight'),
      fixtureSupply('sprinkler'),
    ];
    const s = onLot(SHED, [], { supplies: full, budget: 1 }, seed);
    const { state, events } = RB.apply(s, demolish(1, 1));
    expect(eventsOf(events, 'findClaimed')).toEqual([
      {
        t: 'findClaimed',
        feature: 'oldShed',
        x: 1,
        y: 1,
        reward: { tool: reward },
        soldTool: half,
      },
    ]);
    expect(state.supplies).toEqual(full);
    expect(state.budget).toBe(1 + half);
    // With a Tool Belt's fourth slot, it goes in instead.
    const belt = RB.apply({ ...s, upgrades: ['toolBelt'] }, demolish(1, 1));
    expect(belt.state.supplies).toEqual([...full, tool(reward)]);
    expect(eventsOf(belt.events, 'findClaimed')[0]).not.toHaveProperty('soldTool');
    expect(belt.state.budget).toBe(1);
  });
});

describe('Time Capsules', () => {
  /** A Time Capsule at (1, 1). */
  const CAPSULE = ['......', '.K....', '......', '......', '......', '......'];
  const CLOSET_THERE = { t: 'place', from: 'hand', i: 0, x: 1, y: 1, rot: 0 } as const;
  const CLAIM = {
    t: 'findClaimed',
    feature: 'timeCapsule',
    x: 1,
    y: 1,
    reward: { budget: 3 },
  } as const;

  it('doesn’t block: checkPlay lists it in finds (Trees stay in clearedTrees), and the preview is legal', () => {
    // A Bedroom at (0, 0) covers a Tree at (0, 1) and the capsule at (1, 1).
    const s = onLot(['......', 'TK....', '......', '......'], [], { hand: [pc('bedroom')] });
    const play = { t: 'place', from: 'hand', i: 0, x: 0, y: 0, rot: 0 } as const;
    const check = RB.checkPlay(s, play);
    expect(check).toMatchObject({
      legal: true,
      clearedTrees: [{ x: 0, y: 1 }],
      finds: [{ x: 1, y: 1 }],
    });
    expect(check.cells).toHaveLength(4);
    const preview = RB.preview(s, play);
    expect(preview).toMatchObject({ legal: true, clearedTrees: [{ x: 0, y: 1 }] });
    // Elsewhere, there's nothing to find.
    expect(RB.checkPlay(s, { ...play, x: 3, y: 0 }).finds).toBeUndefined();
  });

  it('the first piece built over it from the hand pays +3 budget, before the week’s tally', () => {
    const s = onLot(CAPSULE, [], { hand: [pc('closet')] });
    const { state, events } = RB.apply(s, CLOSET_THERE);
    expect(types(events).slice(0, 3)).toEqual(['placed', 'findClaimed', 'tally']);
    expect(events[1]).toEqual(CLAIM);
    expect(eventsOf(events, 'placed')[0]!.clearedTrees).toEqual([]);
    expect(eventsOf(events, 'tally')[0]).toMatchObject({ budgetBefore: 3, budget: 3 });
    expect(state).toMatchObject({ budget: 3, budgetEarned: 3, week: 2 });
    expect(terrainAtCell(state, { x: 1, y: 1 })).toBeNull();
  });

  it('pays once: a piece built there again later pays nothing', () => {
    let s = RB.apply(onLot(CAPSULE, [], { hand: [pc('closet')] }), CLOSET_THERE).state;
    s = { ...s, hand: [pc('closet')] };
    s = RB.apply(s, demolish(1, 1)).state; // the Closet comes down
    expect(s.house.pieces).toEqual([]);
    expect(RB.checkPlay(s, CLOSET_THERE).finds).toBeUndefined();
    const { state, events } = RB.apply(s, CLOSET_THERE);
    expect(types(events)).not.toContain('findClaimed');
    expect(state.budget).toBe(3);
  });

  it('from the reserve too', () => {
    const s = onLot(CAPSULE, [], { reserve: [{ id: 'closet' }] });
    const { state, events } = RB.apply(s, { ...CLOSET_THERE, from: 'reserve' });
    expect(types(events).slice(0, 3)).toEqual(['placed', 'findClaimed', 'tally']);
    expect(events[1]).toEqual(CLAIM);
    expect(state).toMatchObject({ budget: 3, reserve: [] });
  });

  it('a piece over two capsules pays each', () => {
    // A Bedroom at (1, 0) covers (1, 1) and (2, 1).
    const s = onLot(['......', '.KK...', '......', '......'], [], { hand: [pc('bedroom')] });
    const { state, events } = RB.apply(s, { ...CLOSET_THERE, y: 0 });
    expect(eventsOf(events, 'findClaimed')).toEqual([CLAIM, { ...CLAIM, x: 2 }]);
    expect(state).toMatchObject({ budget: 6, budgetEarned: 6 });
  });

  it('a Weekend Crew free play over it pays, and the week goes on', () => {
    const s = onLot(CAPSULE, [], {
      hand: [pc('closet'), pc('bathroom')],
      supplies: [tool('weekendCrew')],
    });
    const ready = RB.apply(s, { t: 'useTool', i: 0 }).state;
    expect(ready.freePlay).toBe('ready');
    const { state, events } = RB.apply(ready, CLOSET_THERE);
    expect(types(events)).toEqual(['placed', 'findClaimed']);
    expect(events[0]).toMatchObject({ t: 'placed', free: true, x: 1, y: 1 });
    expect(events[1]).toEqual(CLAIM);
    expect(state).toMatchObject({
      budget: 3,
      budgetEarned: 3,
      week: 1,
      freePlay: 'used',
      hand: [pc('bathroom')],
    });
  });

  it('a Moving Truck move onto it pays', () => {
    // A Lawn (uid 1) at (3, 0), moved to (0, 0): its new tiles cover the capsule at (1, 1).
    const s = onLot(CAPSULE, [['lawn', 3, 0]], { supplies: [tool('movingTruck')] });
    const use = { t: 'useTool', i: 0, target: { uid: 1, x: 0, y: 0, rot: 0 } } as const;
    expect(RB.canUseTool(s, use)).toEqual({ ok: true });
    const { state, events } = RB.apply(s, use);
    expect(types(events)).toEqual(['toolUsed', 'moved', 'findClaimed']);
    expect(events[2]).toEqual(CLAIM);
    expect(state).toMatchObject({ budget: 3, budgetEarned: 3, week: 1 });
    expect(terrainAtCell(state, { x: 1, y: 1 })).toBeNull();
  });
});
