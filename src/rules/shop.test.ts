// The shop between milestones (D-051, D-076; implementation-plan.md §5 Shop goods, §9 Testing,
// Appendix A · M3a): when it opens and its number, the stock per visit, the sale, refresh and
// service prices, buying into each slot, full slots, selling, the skip reward, leaving, the
// reserve, and which actions each screen takes. Rules tests use TEST_CONTENT (testing.ts):
// 2 phases of 2 weeks (targets 5 and 30), so only shop 1 opens; tests that need shops 2+ build
// a content with more phases.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Balance,
  BlueprintId,
  Card,
  Content,
  GameEvent,
  PieceId,
  Rarity,
  RunState,
  ShopOffer,
  ShopVisit,
} from './index.ts';
import { drawableTypes, drawHand } from './draw.ts';
import { lotFromRows } from './lot.ts';
import { stream } from './rng.ts';
import { createRules, IllegalAction, type Rules } from './run.ts';
import { roundHalfUp } from './scoring.ts';
import { offerPrice, SERVICES, sellPrice, SHOP_REASONS, stockGoods } from './shop.ts';
import { emptyRows, houseFrom, setup, TEST_CONTENT as C } from './testing.ts';

const rules = createRules(C);

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

/** TEST_CONTENT with other rule values or shop numbers. */
function tuned(
  ruleValues: Partial<Balance['rules']>,
  shop: Partial<Balance['shop']> = {},
  base: Content = C,
): Content {
  return {
    ...base,
    balance: {
      ...base.balance,
      rules: { ...base.balance.rules, ...ruleValues },
      shop: { ...base.balance.shop, ...shop },
    },
  };
}

const PASS: Action = { t: 'pass' };
const REROLL: Action = { t: 'reroll' };
const LEAVE: Action = { t: 'leaveShop' };
const REFRESH: Action = { t: 'refreshShop' };
const buy = (i: number, strike?: Card): Action =>
  strike ? { t: 'buy', i, strike } : { t: 'buy', i };

const types = (events: readonly GameEvent[]) => events.map((e) => e.t);

function eventsOf<K extends GameEvent['t']>(
  events: readonly GameEvent[],
  t: K,
): Extract<GameEvent, { t: K }>[] {
  return events.filter((e): e is Extract<GameEvent, { t: K }> => e.t === t);
}

/** Applies actions in turn; returns the last state and every event along the way. */
function applyAll(r: Rules, s: RunState, actions: readonly Action[]) {
  const events: GameEvent[] = [];
  for (const a of actions) {
    const out = r.apply(s, a);
    s = out.state;
    events.push(...out.events);
  }
  return { state: s, events };
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
function shop1(seed = 'shop', r: Rules = rules): RunState {
  const s = finishPhase(r, r.newRun(setup(seed))).state;
  expect(s.screen).toBe('shop');
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

/** Shop 1 with these goods, then the three services (reroll, demolition, strike). */
function withGoods(s: RunState, goods: readonly ShopOffer[], sale: number | null = null): RunState {
  const visit: ShopVisit = {
    number: 1,
    offers: [...goods, ...SERVICE_OFFERS],
    sale,
    refreshes: 0,
    boughtAny: false,
  };
  return { ...s, screen: 'shop', hand: [], offers: { shop: visit } };
}

const goodsOf = (v: ShopVisit) => v.offers.filter((o) => o.kind !== 'service');
const withSeed = (s: RunState, seed: string): RunState => ({ ...s, setup: { ...s.setup, seed } });

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

const rarityOf = (o: ShopOffer): Rarity | undefined =>
  o.kind === 'blueprint'
    ? C.blueprints[o.id].rarity
    : o.kind === 'fixture'
      ? C.fixtures[o.id].rarity
      : undefined;

const COMMONS: BlueprintId[] = [
  'fengShui',
  'curbAppeal',
  'quietHours',
  'greenThumb',
  'partyHouse',
  'waterfront',
];
const owned = (...ids: BlueprintId[]) => ids.map((id) => ({ id, boughtWeek: 1 }));

const FENCE: Card = { kind: 'piece', id: 'fence' };
const FIREPLACE: Card = { kind: 'fixture', id: 'fireplace' };
const isFence = (c: Card) => c.kind === 'piece' && (c.id === 'fence' || c.id === 'lFence');

// ---------------------------------------------------------------------------------------

describe('when the shop opens', () => {
  it('opens after milestone 1, with phase 2’s first week set up and no hand', () => {
    // A reroll in phase 1 (2 a phase: 1 base + the General Contractor's 1) shows the reset.
    let s = rules.apply(rules.newRun(setup('open')), REROLL).state;
    expect(s.rerollsLeft).toBe(1);
    const { state, events } = finishPhase(rules, s);
    s = state;
    expect(types(events).slice(-3)).toEqual(['tally', 'milestone', 'shopOpened']);
    expect(s).toMatchObject({
      screen: 'shop',
      phase: 1,
      slot: 1,
      overtimeWeek: 0,
      week: 3, // weeks 1 and 2 were phase 1's; the shop sits before week 3
      draws: 0,
      rerollsLeft: 2,
      hand: [],
      budget: 3, // milestoneBudget
      budgetEarned: 3,
    });
    const visit = visitOf(s);
    expect(visit).toMatchObject({ number: 1, refreshes: 0, boughtAny: false });
    expect(eventsOf(events, 'shopOpened')[0]).toEqual({
      t: 'shopOpened',
      number: 1,
      offers: visit.offers,
      sale: visit.sale,
    });
    // Interest is M3b's Savings Account: interestMax is 0, so it pays nothing yet.
    expect(eventsOf(events, 'milestone')[0]!.reward).toEqual({ budget: 3, score: 0, interest: 0 });
  });

  it('doesn’t open after the last milestone: the run is won instead', () => {
    const s = rules.apply(shop1(), LEAVE).state;
    const { state, events } = finishPhase(rules, s);
    expect(state.screen).toBe('won');
    expect(types(events)).not.toContain('shopOpened');
    expect(types(events).slice(-2)).toEqual(['milestone', 'runEnded']);
    expect(state.offers?.shop).toBeUndefined();
  });

  it('doesn’t open after a failed milestone', () => {
    // Target 5 never met: 2 weeks, then both overtime weeks, then the loss.
    const { state, events } = applyAll(rules, rules.newRun(setup('fail')), [
      PASS,
      PASS,
      PASS,
      PASS,
    ]);
    expect(state.screen).toBe('lost');
    expect(types(events)).not.toContain('shopOpened');
  });

  it('shop k follows milestone k, and shops past the stock table use its last row', () => {
    const r = createRules(phases(4));
    let s = r.newRun(setup('numbers'));
    const seen: { number: number; offers: number }[] = [];
    for (let k = 0; k < 3; k++) {
      s = finishPhase(r, s).state;
      const v = visitOf(s);
      seen.push({ number: v.number, offers: v.offers.length });
      s = r.apply(s, LEAVE).state;
    }
    // Shop 1: 2 blueprints + 2 cards + 3 services; shops 2 and 3 (row 2 repeats): 3 + 2 + 3.
    expect(seen).toEqual([
      { number: 1, offers: 7 },
      // 3 blueprints, 2 cards, 2 tools, a crate, the upgrade, and 3 services (M3b).
      { number: 2, offers: 12 },
      { number: 3, offers: 12 },
    ]);
    expect(finishPhase(r, s).state.screen).toBe('won');
  });
});

describe('stock per visit', () => {
  it('shop 1: 2 Common blueprints, 2 distinct cards (Common fixtures or special pieces), then the services', () => {
    const base = shop1();
    expect(visitOf(base).offers.slice(-3)).toEqual(SERVICE_OFFERS);
    let fixtures = 0;
    for (let k = 0; k < 200; k++) {
      const goods = stockGoods(C, withSeed(base, `s1/${k}`), 1, 0);
      expect(goods).toHaveLength(4);
      const [b1, b2, c1, c2] = goods;
      expect([b1!.kind, b2!.kind]).toEqual(['blueprint', 'blueprint']);
      expect(rarityOf(b1!)).toBe('common');
      expect(rarityOf(b2!)).toBe('common');
      expect(b1).not.toEqual(b2);
      for (const card of [c1!, c2!]) {
        if (card.kind === 'piece') expect(C.pieces[card.id].drawWeight).toBe(0);
        else if (card.kind === 'fixture') {
          fixtures++;
          // Shop 1 rolls Common only, so never the Rare Chandelier (D-056).
          expect(rarityOf(card)).toBe('common');
        } else throw new Error(`a card slot held a ${card.kind}`);
      }
      expect(c1).not.toEqual(c2);
    }
    // cardFixturePct 50: about half of the 400 cards are fixtures.
    expect(fixtures).toBeGreaterThan(140);
    expect(fixtures).toBeLessThan(260);
  });

  it('shop 2: 3 blueprints at 70/25/5, never an owned one or Dream Home (offered: false)', () => {
    const base = { ...shop1(), blueprints: owned('fengShui', 'crownJewel') };
    const count: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0 };
    for (let k = 0; k < 1000; k++) {
      const goods = stockGoods(C, withSeed(base, `s2/${k}`), 2, 0);
      const bps = goods.filter((o) => o.kind === 'blueprint');
      expect(bps).toHaveLength(3);
      // 2 cards, 2 tools, and a crate (M3b); the upgrade isn't a refreshable good.
      expect(goods.filter((o) => o.kind !== 'blueprint')).toHaveLength(5);
      const ids = bps.map((o) => (o.kind === 'blueprint' ? o.id : null));
      expect(new Set(ids).size).toBe(3);
      for (const id of ids) expect(['fengShui', 'crownJewel', 'dreamHome']).not.toContain(id);
      for (const o of bps) count[rarityOf(o)!]++;
    }
    // 3000 blueprints: about 2100 / 750 / 150 (each ±3σ is about ±75, ±70, ±36).
    expect(count.common).toBeGreaterThan(1950);
    expect(count.common).toBeLessThan(2250);
    expect(count.uncommon).toBeGreaterThan(600);
    expect(count.uncommon).toBeLessThan(900);
    expect(count.rare).toBeGreaterThan(90);
    expect(count.rare).toBeLessThan(230);
  });

  it('a rarity with nothing left falls back to the likeliest one that has something', () => {
    // Every Common owned. Shop 1 (100/0/0) then offers Uncommons (Uncommon before Rare on a tie).
    const base = { ...shop1(), blueprints: owned(...COMMONS) };
    for (let k = 0; k < 50; k++) {
      const bps = stockGoods(C, withSeed(base, `fb1/${k}`), 1, 0).filter(
        (o) => o.kind === 'blueprint',
      );
      expect(bps.map(rarityOf)).toEqual(['uncommon', 'uncommon']);
    }
    // Shop 2 (70/25/5): a rolled Common becomes an Uncommon, so Rares stay at about 5%.
    const count: Record<Rarity, number> = { common: 0, uncommon: 0, rare: 0 };
    for (let k = 0; k < 300; k++) {
      for (const o of stockGoods(C, withSeed(base, `fb2/${k}`), 2, 0)) {
        if (o.kind === 'blueprint') count[rarityOf(o)!]++;
      }
    }
    expect(count.common).toBe(0);
    expect(count.uncommon + count.rare).toBe(900);
    expect(count.rare).toBeLessThan(90);
  });

  it('the same seed gives the same offers and sale, from the shop/<n>/<refresh> streams', () => {
    const a = visitOf(shop1('same'));
    const b = visitOf(shop1('same'));
    expect(a).toEqual(b);
    const goods = stockGoods(C, shop1('same'), 1, 0);
    expect(a.offers).toEqual([...goods, ...SERVICE_OFFERS]);
    expect(a.sale).toBe(stream('same', 'shop/1/0/sale').int(goods.length));
  });

  it('different seeds give different offers', () => {
    const base = shop1();
    const distinct = new Set<string>();
    for (let k = 0; k < 10; k++)
      distinct.add(JSON.stringify(stockGoods(C, withSeed(base, `d${k}`), 1, 0)));
    expect(distinct.size).toBeGreaterThan(5);
  });
});

describe('the sale', () => {
  it('is exactly one good each visit, never a service', () => {
    for (let k = 0; k < 20; k++) {
      const s = { ...shop1(`sale${k}`), budget: 50 };
      const v = visitOf(s);
      expect(v.sale).not.toBeNull();
      expect(v.offers[v.sale!]!.kind).not.toBe('service');
      const views = rules.shopOffers(s);
      expect(views.filter((o) => o.onSale).map((o) => o.i)).toEqual([v.sale]);
      for (const o of views) if (!o.onSale) expect(o.price).toBe(o.fullPrice);
    }
  });

  it('halves the price, rounding half up', () => {
    const s = { ...shop1(), budget: 50 };
    const rows: [ShopOffer, number, number][] = [
      [{ kind: 'blueprint', id: 'fengShui' }, 4, 2], // Common
      [{ kind: 'blueprint', id: 'openConcept' }, 6, 3], // Uncommon
      [{ kind: 'blueprint', id: 'crownJewel' }, 8, 4], // Rare
      [{ kind: 'fixture', id: 'fireplace' }, 2, 1], // Common
      [{ kind: 'fixture', id: 'kitchenIsland' }, 3, 2], // Uncommon: 1.5 rounds up
      [{ kind: 'fixture', id: 'chandelier' }, 4, 2], // Rare
      [{ kind: 'piece', id: 'library' }, 3, 2], // piecePrice 3: 1.5 rounds up
    ];
    for (const [good, full, sale] of rows) {
      const view = rules.shopOffers(withGoods(s, [good], 0))[0]!;
      expect({ good, price: view.price, fullPrice: view.fullPrice, onSale: view.onSale }).toEqual({
        good,
        price: sale,
        fullPrice: full,
        onSale: true,
      });
      // Off sale, it's the full price.
      expect(rules.shopOffers(withGoods(s, [good]))[0]!.price).toBe(full);
    }
  });

  it('never drops a price below 1', () => {
    // shopPricePct 10 makes a 4 cost roundHalfUp(0.4) = 0 → 1; salePct 40 makes that 0.4 → 0 → 1.
    const content = tuned({ shopPricePct: 10 }, { salePct: 40 });
    const s = withGoods({ ...shop1(), budget: 50 }, [{ kind: 'blueprint', id: 'fengShui' }], 0);
    expect(offerPrice(content, s, visitOf(s), 0)).toEqual({ price: 1, fullPrice: 1, onSale: true });
  });

  it('moves with a refresh, to the good picked by shop/<n>/<refresh>/sale', () => {
    const s = { ...shop1('move'), budget: 10 };
    const { state, events } = rules.apply(s, REFRESH);
    const v = visitOf(state);
    const goods = goodsOf(v).length;
    expect(v.sale).toBe(stream('move', 'shop/1/1/sale').int(goods));
    expect(v.offers[v.sale!]!.kind).not.toBe('service');
    expect(eventsOf(events, 'shopRefreshed')[0]!.sale).toBe(v.sale);
  });

  it('is gone once its good is bought', () => {
    const s = withGoods(
      { ...shop1(), budget: 10 },
      [
        { kind: 'blueprint', id: 'fengShui' },
        { kind: 'blueprint', id: 'partyHouse' },
      ],
      0,
    );
    const { state, events } = rules.apply(s, buy(0));
    expect(eventsOf(events, 'bought')[0]!.price).toBe(2); // 4 at half price
    expect(state.budget).toBe(8);
    const views = rules.shopOffers(state);
    expect(views.some((o) => o.onSale)).toBe(false);
    expect(views[0]).toMatchObject({ ok: false, reason: SHOP_REASONS.sold, onSale: false });
    expect(views[1]!.price).toBe(4);
  });
});

describe('the refresh', () => {
  it('costs 2, 3, 4 within a visit, and 2 again at the next', () => {
    const r = createRules(phases(3));
    let s = { ...shop1('refresh', r), budget: 20 };
    const { state, events } = applyAll(r, s, [REFRESH, REFRESH, REFRESH]);
    expect(eventsOf(events, 'shopRefreshed').map((e) => [e.refreshes, e.price])).toEqual([
      [1, 2],
      [2, 3],
      [3, 4],
    ]);
    expect(state.budget).toBe(20 - 2 - 3 - 4);
    expect(r.canRefresh(state)).toEqual({ ok: true, price: 5 });
    s = finishPhase(r, r.apply(state, LEAVE).state).state;
    expect(visitOf(s)).toMatchObject({ number: 2, refreshes: 0 });
    expect(r.canRefresh(s).price).toBe(2);
  });

  it('rerolls the goods from shop/<n>/<refresh> but keeps the services', () => {
    let s = { ...shop1('reroll goods'), budget: 20 };
    s = rules.apply(s, buy(0)).state; // a sold mark, which the new goods don't carry
    const before = visitOf(s);
    const after = visitOf(rules.apply(s, REFRESH).state);
    const goods = stockGoods(C, s, 1, 1);
    expect(after.offers).toEqual([...goods, ...SERVICE_OFFERS]);
    expect(goodsOf(after)).not.toEqual(goodsOf(before));
    expect(after.offers.some((o) => o.kind !== 'service' && o.sold)).toBe(false);
    expect(after).toMatchObject({ number: 1, refreshes: 1, boughtAny: true });
  });

  it('needs the budget', () => {
    const poor = { ...shop1(), budget: 1 };
    expect(rules.canRefresh(poor)).toEqual({ ok: false, reason: SHOP_REASONS.budget, price: 2 });
    expect(illegal(() => rules.apply(poor, REFRESH)).reason).toBe(SHOP_REASONS.budget);
    expect(rules.apply({ ...poor, budget: 2 }, REFRESH).state.budget).toBe(0);
  });
});

describe('buying', () => {
  it('puts each good where it goes and marks its offer sold', () => {
    const goods: ShopOffer[] = [
      { kind: 'blueprint', id: 'fengShui' },
      { kind: 'piece', id: 'library' },
      { kind: 'fixture', id: 'fireplace' },
    ];
    const s = withGoods({ ...shop1(), budget: 20 }, goods);
    expect(s.week).toBe(3);
    const { state, events } = applyAll(rules, s, [buy(0), buy(1), buy(2)]);
    expect(state.blueprints).toEqual([{ id: 'fengShui', boughtWeek: 3 }]);
    expect(state.reserve).toEqual([{ id: 'library' }]);
    expect(state.supplies).toEqual([{ kind: 'fixture', id: 'fireplace' }]);
    // 4 + 3 + 2, at full price.
    expect(state.budget).toBe(11);
    expect(eventsOf(events, 'bought')).toEqual([
      { t: 'bought', i: 0, offer: goods[0], price: 4, budgetBefore: 20, budget: 16 },
      { t: 'bought', i: 1, offer: goods[1], price: 3, budgetBefore: 16, budget: 13 },
      { t: 'bought', i: 2, offer: goods[2], price: 2, budgetBefore: 13, budget: 11 },
    ]);
    const v = visitOf(state);
    expect(v.offers.slice(0, 3)).toEqual(goods.map((g) => ({ ...g, sold: true })));
    expect(v.boughtAny).toBe(true);
    for (const o of rules.shopOffers(state).slice(0, 3)) {
      expect(o).toMatchObject({ ok: false, reason: SHOP_REASONS.sold });
    }
    expect(illegal(() => rules.apply(state, buy(1))).reason).toBe(SHOP_REASONS.sold);
  });

  it('greys out a good with no free slot, or a blueprint already owned, and buying it throws', () => {
    const base = { ...shop1(), budget: 50 };
    expect(rules.slots(base)).toEqual({ reserve: 2, supplies: 3, blueprints: 4 });
    const cases: [Partial<RunState>, ShopOffer, string][] = [
      [
        { blueprints: owned('quietHours', 'greenThumb', 'partyHouse', 'waterfront') },
        { kind: 'blueprint', id: 'fengShui' },
        SHOP_REASONS.blueprintsFull,
      ],
      [
        { blueprints: owned('fengShui') },
        { kind: 'blueprint', id: 'fengShui' },
        SHOP_REASONS.owned,
      ],
      [
        { reserve: [{ id: 'library' }, { id: 'pool' }] },
        { kind: 'piece', id: 'sunroom' },
        SHOP_REASONS.reserveFull,
      ],
      [
        {
          supplies: [
            { kind: 'fixture', id: 'skylight' },
            { kind: 'fixture', id: 'sprinkler' },
            { kind: 'fixture', id: 'pergola' },
          ],
        },
        { kind: 'fixture', id: 'fireplace' },
        SHOP_REASONS.suppliesFull,
      ],
    ];
    for (const [patch, good, reason] of cases) {
      const s = withGoods({ ...base, ...patch }, [good]);
      expect(rules.shopOffers(s)[0]).toMatchObject({ ok: false, reason });
      expect(illegal(() => rules.apply(s, buy(0))).reason).toBe(reason);
      expect(rules.legalActions(s)).not.toContainEqual(buy(0));
    }
  });

  it('a crew’s starting pieces sit in extra reserve slots', () => {
    const s = withGoods(
      {
        ...shop1(),
        budget: 50,
        reserve: [
          { id: 'library', crew: true },
          { id: 'pool', crew: true },
        ],
      },
      [{ kind: 'piece', id: 'sunroom' }],
    );
    expect(rules.shopOffers(s)[0]!.ok).toBe(true);
    expect(rules.apply(s, buy(0)).state.reserve).toHaveLength(3);
  });

  it('needs the budget', () => {
    const s = withGoods({ ...shop1(), budget: 3 }, [{ kind: 'blueprint', id: 'fengShui' }]);
    expect(rules.shopOffers(s)[0]).toMatchObject({
      ok: false,
      reason: SHOP_REASONS.budget,
      price: 4,
    });
    expect(illegal(() => rules.apply(s, buy(0))).reason).toBe(SHOP_REASONS.budget);
    expect(rules.apply({ ...s, budget: 4 }, buy(0)).state.budget).toBe(0);
  });
});

describe('services', () => {
  it('+1 reroll and +1 demolition cost 1, 2, 3, 4, then stay at 4, and never sell out', () => {
    const s = { ...shop1(), budget: 100 };
    const v = visitOf(s);
    const reroll = v.offers.findIndex((o) => o.kind === 'service' && o.service === 'reroll');
    const demolition = v.offers.findIndex(
      (o) => o.kind === 'service' && o.service === 'demolition',
    );
    const five = (i: number) => Array.from({ length: 5 }, () => buy(i));
    const { state, events } = applyAll(rules, s, [...five(reroll), ...five(demolition)]);
    expect(eventsOf(events, 'bought').map((e) => e.price)).toEqual([1, 2, 3, 4, 4, 1, 2, 3, 4, 4]);
    expect(state.budget).toBe(100 - 28);
    expect(state.bonusRerolls).toBe(5);
    expect(state.demolitionsLeft).toBe(2 + 5); // the demolitions rule is 2
    expect(state.servicesBought).toEqual({ reroll: 5, demolition: 5, strike: 0 });
    expect(visitOf(state).offers).toEqual(v.offers);
  });

  it('a strike costs 2, 3, 4, 5, then stays at 5', () => {
    const s = { ...shop1(), budget: 100 };
    const strike = visitOf(s).offers.length - 1;
    const picks = rules.strikeOptions(s).slice(0, 5);
    const { state, events } = applyAll(
      rules,
      s,
      picks.map((t) => buy(strike, t)),
    );
    expect(eventsOf(events, 'bought').map((e) => [e.price, e.strike])).toEqual(
      picks.map((t, k) => [[2, 3, 4, 5, 5][k], t]),
    );
    expect(state.struck).toEqual(picks);
    expect(state.servicesBought.strike).toBe(5);
  });

  it('prices keep rising across visits, and aren’t discounted or put on sale', () => {
    const r = createRules(phases(3));
    let s = { ...shop1('services', r), budget: 20 };
    const offers = visitOf(s).offers;
    const at = (service: string) =>
      offers.findIndex((o) => o.kind === 'service' && o.service === service);
    s = applyAll(r, s, [buy(at('reroll')), buy(at('demolition'))]).state;
    s = finishPhase(r, r.apply(s, LEAVE).state).state;
    const prices = r
      .shopOffers(s)
      .filter((o) => o.offer.kind === 'service')
      .map((o) => [o.price, o.onSale]);
    expect(prices).toEqual([
      [2, false],
      [2, false],
      [2, false], // the strike, not yet bought
    ]);
    // shopPricePct 50 halves the goods but not the services.
    const cheap = createRules(tuned({ shopPricePct: 50 }));
    const views = cheap.shopOffers(
      withGoods({ ...shop1(), budget: 20 }, [{ kind: 'blueprint', id: 'fengShui' }]),
    );
    expect(views.map((o) => o.price)).toEqual([2, 1, 1, 2]);
  });

  it('a bought reroll is spent after the phase’s own, and survives the phase change', () => {
    const r = createRules(phases(3));
    const s = { ...shop1('bonus', r), budget: 20 };
    const reroll = visitOf(s).offers.findIndex(
      (o) => o.kind === 'service' && o.service === 'reroll',
    );
    let b = r.apply(r.apply(s, buy(reroll)).state, LEAVE).state;
    expect(b).toMatchObject({ rerollsLeft: 2, bonusRerolls: 1 });
    const left: [number, number][] = [];
    for (let k = 0; k < 3; k++) {
      b = r.apply(b, REROLL).state;
      left.push([b.rerollsLeft, b.bonusRerolls]);
    }
    expect(left).toEqual([
      [1, 1],
      [0, 1],
      [0, 0],
    ]);
    expect(r.canReroll(b).ok).toBe(false);
    expect(() => r.apply(b, REROLL)).toThrow(IllegalAction);
    // Unspent, it outlasts phase 2 and its reset.
    let kept = r.apply(r.apply(s, buy(reroll)).state, LEAVE).state;
    kept = r.apply(finishPhase(r, kept).state, LEAVE).state;
    expect(kept).toMatchObject({ phase: 2, rerollsLeft: 2, bonusRerolls: 1 });
  });
});

describe('the strike (D-076)', () => {
  it('strikeOptions lists each drawable root type: no shape variants, special pieces, or Chandelier', () => {
    const opts = rules.strikeOptions(shop1());
    // 19 base-pool piece types (the L-Kitchen, Long Hallway, L-Fence, and Long Driveway share
    // theirs) and the 10 drawable fixtures.
    expect(opts).toHaveLength(29);
    expect(opts).toEqual(drawableTypes(C));
    expect(opts).toContainEqual(FENCE);
    expect(opts).toContainEqual(FIREPLACE);
    const ids = opts.map((o) => o.id);
    for (const id of [
      'lFence',
      'lKitchen',
      'longHallway',
      'longDriveway',
      'library',
      'pool',
      'chandelier',
    ]) {
      expect(ids).not.toContain(id);
    }
  });

  it('a struck type, shape variants included, never comes up in a later hand', () => {
    const seed = 'struck';
    const s = { ...shop1(seed), budget: 20 };
    const strike = visitOf(s).offers.length - 1;
    const { state, events } = applyAll(rules, s, [buy(strike, FENCE), buy(strike, FIREPLACE)]);
    expect(state.struck).toEqual([FENCE, FIREPLACE]);
    expect(eventsOf(events, 'bought').map((e) => [e.price, e.strike])).toEqual([
      [2, FENCE],
      [3, FIREPLACE],
    ]);
    const opts = rules.strikeOptions(state);
    expect(opts).toHaveLength(27);
    expect(opts).not.toContainEqual(FENCE);

    /** Phase 2's hands over 400 rerolls, after leaving the shop. */
    const hands = (from: RunState) => {
      let b: RunState = { ...rules.apply(from, LEAVE).state, rerollsLeft: 400 };
      const out: Card[][] = [];
      for (let k = 0; k < 400; k++) {
        const n = b.draws;
        b = rules.apply(b, REROLL).state;
        out.push([...b.hand]);
        // Draw keys don't change: the same draw/<phase>/<slot>/<n> stream, a smaller pool.
        if (k < 5) expect(b.hand).toEqual(drawHand(C, seed, 1, '1', n, 3, { struck: from.struck }));
      }
      return out.flat();
    };
    const struck = hands(state);
    expect(struck.some(isFence)).toBe(false);
    expect(struck).not.toContainEqual(FIREPLACE);
    // Without the strike, the same hands do show them.
    const control = hands(s);
    expect(control.some(isFence)).toBe(true);
    expect(control).toContainEqual(FIREPLACE);
  });

  it('needs a type it can strike', () => {
    const s = { ...shop1(), budget: 20, struck: [FENCE] };
    const strike = visitOf(s).offers.length - 1;
    expect(illegal(() => rules.apply(s, buy(strike))).reason).toMatch(/Pick a card type/);
    expect(illegal(() => rules.apply(s, buy(strike, FENCE))).reason).toMatch(/already struck/);
    // Only root types: the L-Fence is a Fence. Special pieces aren't in the draws.
    expect(() => rules.apply(s, buy(strike, { kind: 'piece', id: 'lFence' }))).toThrow(
      IllegalAction,
    );
    expect(() => rules.apply(s, buy(strike, { kind: 'piece', id: 'library' }))).toThrow(
      IllegalAction,
    );
    expect(() => rules.apply(s, buy(strike, { kind: 'fixture', id: 'chandelier' }))).toThrow(
      IllegalAction,
    );
  });

  it('can’t leave fewer than strikeMinTypes (8) drawable types', () => {
    const all = drawableTypes(C);
    const s = { ...shop1(), budget: 20, struck: all.slice(0, 20) };
    const strike = visitOf(s).offers.length - 1;
    expect(rules.strikeOptions(s)).toEqual(all.slice(20)); // 9 left: one more strike leaves 8
    const after = rules.apply(s, buy(strike, all[20]!)).state;
    expect(drawableTypes(C, after.struck)).toHaveLength(8);
    expect(rules.strikeOptions(after)).toEqual([]);
    expect(rules.shopOffers(after)[strike]).toMatchObject({
      ok: false,
      reason: SHOP_REASONS.noStrike,
    });
    expect(illegal(() => rules.apply(after, buy(strike, all[21]!))).reason).toBe(
      SHOP_REASONS.noStrike,
    );
  });
});

describe('selling', () => {
  it('pays half the list price, rounded down, as a free action on the build screen', () => {
    const start = rules.newRun(setup('sell'));
    const s: RunState = {
      ...start,
      budget: 0,
      blueprints: owned('fengShui', 'openConcept', 'crownJewel'), // 4, 6, 8
      supplies: [
        { kind: 'fixture', id: 'chandelier' }, // Rare, 4
        { kind: 'fixture', id: 'kitchenIsland' }, // Uncommon, 3
        { kind: 'fixture', id: 'fireplace' }, // Common, 2
      ],
    };
    expect([0, 1, 2].map((i) => rules.sellPrice(s, 'blueprints', i))).toEqual([2, 3, 4]);
    expect([0, 1, 2].map((i) => rules.sellPrice(s, 'supplies', i))).toEqual([2, 1, 1]);
    const { state, events } = applyAll(rules, s, [
      { t: 'sell', from: 'blueprints', i: 0 },
      { t: 'sell', from: 'supplies', i: 1 },
    ]);
    expect(eventsOf(events, 'sold')).toEqual([
      { t: 'sold', from: 'blueprints', item: 'fengShui', price: 2, budgetBefore: 0, budget: 2 },
      { t: 'sold', from: 'supplies', item: 'kitchenIsland', price: 1, budgetBefore: 2, budget: 3 },
    ]);
    expect(state.blueprints.map((o) => o.id)).toEqual(['openConcept', 'crownJewel']);
    expect(state.supplies.map((o) => o.id)).toEqual(['chandelier', 'fireplace']);
    // A refund, not budget earned; and the week goes on.
    expect(state.budgetEarned).toBe(s.budgetEarned);
    expect(state).toMatchObject({ week: s.week, slot: s.slot, hand: s.hand, screen: 'build' });
  });

  it('works in the shop too, and doesn’t count as buying', () => {
    const s = {
      ...shop1(),
      blueprints: owned('fengShui'),
      supplies: [{ kind: 'fixture', id: 'chandelier' } as const],
    };
    const { state, events } = applyAll(rules, s, [
      { t: 'sell', from: 'blueprints', i: 0 },
      { t: 'sell', from: 'supplies', i: 0 },
      LEAVE,
    ]);
    // 3 from the milestone, +2 and +2 from selling, +1 skip reward.
    expect(eventsOf(events, 'sold').map((e) => e.price)).toEqual([2, 2]);
    expect(eventsOf(events, 'shopClosed')[0]!.skipReward).toBe(1);
    expect(state.budget).toBe(8);
  });

  it('can’t sell an empty slot or a reserve piece', () => {
    const s = { ...rules.newRun(setup('sell')), reserve: [{ id: 'library' as PieceId }] };
    expect(() => rules.apply(s, { t: 'sell', from: 'blueprints', i: 0 })).toThrow(IllegalAction);
    expect(() => rules.apply(s, { t: 'sell', from: 'supplies', i: 0 })).toThrow(IllegalAction);
    const reserve = { t: 'sell', from: 'reserve', i: 0 } as unknown as Action;
    expect(() => rules.apply(s, reserve)).toThrow(IllegalAction);
  });

  it('a sold blueprint’s modifiers stop applying at once', () => {
    const start = rules.newRun(setup('sold bp'));
    const s: RunState = {
      ...start,
      house: houseFrom(C, emptyRows(6, 6), [['bedroom', 0, 0]]),
      blueprints: owned('quietHours', 'dreamHome'),
    };
    // A lone Bedroom: steady 3, Quiet, so Quiet Hours' +50% makes 4.5 → 5.
    expect(rules.currentTally(s).total).toBe(5);
    expect(rules.rule(s, 'specBonus')).toBe(35); // Dream Home: 25 + 10
    const sold = rules.apply(rules.apply(s, { t: 'sell', from: 'blueprints', i: 0 }).state, {
      t: 'sell',
      from: 'blueprints',
      i: 0,
    }).state;
    expect(sold.blueprints).toEqual([]);
    expect(rules.currentTally(sold).total).toBe(3);
    expect(rules.rule(sold, 'specBonus')).toBe(25);
    expect(rules.preview(sold, null).before.total).toBe(3);
  });

  it('buying on sale and selling back is never a profit, at any price 1–10 and shopPricePct 75 or 100', () => {
    const base = shop1();
    for (const pct of [75, 100]) {
      for (let list = 1; list <= 10; list++) {
        const content = tuned({ shopPricePct: pct });
        const priced: Content = {
          ...content,
          blueprints: {
            ...content.blueprints,
            fengShui: { ...content.blueprints.fengShui, price: list },
          },
        };
        const s = withGoods(base, [{ kind: 'blueprint', id: 'fengShui' }], 0);
        const full = Math.max(1, roundHalfUp(list * pct, 100));
        const paid = offerPrice(priced, s, visitOf(s), 0);
        const back = sellPrice(priced, s, list);
        expect({ pct, list, paid: paid.price, full: paid.fullPrice, back }).toEqual({
          pct,
          list,
          paid: Math.max(1, roundHalfUp(full * 50, 100)),
          full,
          back: Math.floor((full * 50) / 100),
        });
        expect(back).toBeLessThanOrEqual(paid.price);
      }
    }
  });

  it('a round trip through the rules leaves the budget no higher', () => {
    for (const pct of [75, 100]) {
      const r = createRules(tuned({ shopPricePct: pct }));
      const s = withGoods(
        { ...shop1('trip', r), budget: 10 },
        [{ kind: 'blueprint', id: 'fengShui' }],
        0,
      );
      const bought = r.apply(s, buy(0)).state;
      const back = r.apply(bought, { t: 'sell', from: 'blueprints', i: 0 }).state;
      // 100%: pay 2 (4 on sale), get 2 back. 75%: 4 → 3, pay 2 (1.5 rounds up), get 1 back.
      expect([pct, 10 - bought.budget, back.budget - bought.budget]).toEqual(
        pct === 100 ? [100, 2, 2] : [75, 2, 1],
      );
      expect(back.budget).toBeLessThanOrEqual(10);
    }
  });
});

describe('leaving the shop', () => {
  it('pays the skip reward when nothing was bought or refreshed, then draws phase 2’s first hand', () => {
    const seed = 'leave';
    const s = shop1(seed);
    const { state, events } = rules.apply(s, LEAVE);
    expect(events[0]).toEqual({
      t: 'shopClosed',
      number: 1,
      skipReward: 1,
      budgetBefore: 3,
      budget: 4,
    });
    expect(events[1]).toEqual({
      t: 'handDrawn',
      phase: 1,
      slot: 1,
      overtimeWeek: 0,
      hand: drawHand(C, seed, 1, '1', 0, 3),
      free: false,
      reroll: false,
    });
    expect(state).toMatchObject({
      screen: 'build',
      phase: 1,
      slot: 1,
      week: 3,
      budget: 4,
      budgetEarned: 4, // the skip reward counts as budget earned
    });
    expect(state.offers?.shop).toBeUndefined();
    expect(state.draws).toBeGreaterThanOrEqual(1);
    expect(state.hand.length).toBe(3);
  });

  it('pays nothing after buying a good or a service, or refreshing', () => {
    const s = { ...shop1(), budget: 20 };
    const strike = visitOf(s).offers.length - 1;
    const reroll = strike - 2;
    for (const first of [buy(0), buy(reroll), buy(strike, FENCE), REFRESH]) {
      const shopped = rules.apply(s, first).state;
      const { state, events } = rules.apply(shopped, LEAVE);
      expect(eventsOf(events, 'shopClosed')[0]!.skipReward).toBe(0);
      expect(state.budget).toBe(shopped.budget);
      expect(state.budgetEarned).toBe(shopped.budgetEarned);
    }
  });

  it('says the new phase’s target is already met before its first hand', () => {
    // Score 40 by milestone 1; phase 2's target is 30.
    const s = { ...shop1(), score: 40 };
    const { events } = rules.apply(s, LEAVE);
    expect(types(events).slice(0, 3)).toEqual(['shopClosed', 'targetReached', 'handDrawn']);
    expect(events[1]).toEqual({ t: 'targetReached', phase: 1, target: 30, score: 40 });
  });
});

describe('the reserve', () => {
  it('placing a reserve piece is the week’s turn, and frees its slot', () => {
    let s = withGoods({ ...shop1(), budget: 10 }, [{ kind: 'piece', id: 'library' }]);
    s = applyAll(rules, s, [buy(0), LEAVE]).state;
    s = { ...s, house: houseFrom(C, emptyRows(8, 8)) };
    expect(s.reserve).toEqual([{ id: 'library' }]);
    expect(rules.reserveFits(s, 0)).toBe(true);
    const play: Action = { t: 'place', from: 'reserve', i: 0, x: 0, y: 0, rot: 0 };
    expect(rules.legalActions(s)).toContainEqual(play);
    const { state, events } = rules.apply(s, play);
    expect(types(events).slice(0, 2)).toEqual(['placed', 'tally']);
    expect(eventsOf(events, 'placed')[0]).toMatchObject({ defId: 'library', x: 0, y: 0 });
    expect(eventsOf(events, 'tally')[0]!.passed).toBe(false);
    expect(state.reserve).toEqual([]);
    expect(state.house.pieces.map((p) => [p.defId, p.placedWeek])).toEqual([['library', 3]]);
    expect(state).toMatchObject({ phase: 1, slot: 2, week: 4 });
  });

  it('reserveFits says whether a reserve piece has a legal spot', () => {
    const start = rules.apply(shop1(), LEAVE).state;
    const s: RunState = { ...start, reserve: [{ id: 'library' }] };
    expect(rules.reserveFits({ ...s, house: houseFrom(C, emptyRows(4, 4)) }, 0)).toBe(true);
    // A 2×2 Library can't fit on a one-row lot.
    const strip = { ...s, house: { lot: lotFromRows(['......']), pieces: [], nextUid: 1 } };
    expect(rules.reserveFits(strip, 0)).toBe(false);
    expect(rules.legalPlacements(strip).some((p) => p.from === 'reserve')).toBe(false);
    expect(rules.reserveFits(s, 1)).toBe(false); // nothing in that slot
  });
});

describe('what each screen takes', () => {
  it('the shop rejects the build screen’s actions', () => {
    const s = {
      ...shop1(),
      budget: 20,
      reserve: [{ id: 'library' as PieceId }],
      supplies: [{ kind: 'fixture', id: 'fireplace' } as const],
      house: houseFrom(C, emptyRows(8, 8), [['bedroom', 0, 0]]),
    };
    const build: Action[] = [
      { t: 'place', from: 'hand', i: 0, x: 4, y: 4, rot: 0 },
      { t: 'place', from: 'reserve', i: 0, x: 4, y: 4, rot: 0 },
      { t: 'install', from: 'hand', i: 0, uid: 1 },
      { t: 'install', from: 'supplies', i: 0, uid: 1 },
      { t: 'pass' },
      { t: 'reroll' },
      { t: 'demolish', x: 0, y: 0 },
      { t: 'completeEarly' },
    ];
    for (const a of build) expect(() => rules.apply(s, a), a.t).toThrow(IllegalAction);
    // The auto-complete toggle works anywhere but the end screens.
    expect(rules.apply(s, { t: 'setAutoComplete', on: true }).state.autoComplete).toBe(true);
  });

  it('the build screen rejects the shop’s actions', () => {
    const s = { ...rules.newRun(setup('build')), budget: 20 };
    for (const a of [buy(0), REFRESH, LEAVE]) {
      expect(illegal(() => rules.apply(s, a)).reason).toBe(SHOP_REASONS.notOpen);
    }
    expect(rules.shopOffers(s)).toEqual([]);
    expect(rules.canRefresh(s).ok).toBe(false);
  });

  it('legalActions in the shop: each buy (each strike option), sells, the refresh, and leaving', () => {
    const s = {
      ...shop1('legal'),
      budget: 100,
      blueprints: owned('moodLighting'), // Uncommon, so never offered in shop 1
      supplies: [{ kind: 'fixture', id: 'fireplace' } as const],
    };
    const v = visitOf(s);
    const strike = v.offers.length - 1;
    const options = rules.strikeOptions(s);
    expect(rules.legalActions(s)).toEqual([
      ...v.offers.slice(0, strike).map((_, i) => buy(i)),
      ...options.map((t) => buy(strike, t)),
      { t: 'sell', from: 'blueprints', i: 0 },
      { t: 'sell', from: 'supplies', i: 0 },
      REFRESH,
      LEAVE,
    ]);
    // Every one of them applies.
    for (const a of rules.legalActions(s)) expect(() => rules.apply(s, a)).not.toThrow();
    // With no budget: only the sells and leaving.
    expect(rules.legalActions({ ...s, budget: 0 })).toEqual([
      { t: 'sell', from: 'blueprints', i: 0 },
      { t: 'sell', from: 'supplies', i: 0 },
      LEAVE,
    ]);
  });
});

describe('the debug panel’s shop', () => {
  it('forceShop opens a shop mid-week; leaving returns to the same week with a fresh hand', () => {
    const seed = 'forced';
    const s = rules.newRun(setup(seed));
    const { state: shop, events } = rules.apply(s, { t: 'debug', op: 'forceShop' });
    expect(types(events)).toEqual(['shopOpened']);
    expect(shop).toMatchObject({ screen: 'shop', debug: true, hand: [] });
    // min(max(1, phase + 1), phaseCount − 1) = 1.
    expect(visitOf(shop)).toMatchObject({
      number: 1,
      forced: true,
      refreshes: 0,
      boughtAny: false,
    });
    const { state: back, events: out } = rules.apply(shop, LEAVE);
    expect(types(out)).toEqual(['shopClosed', 'handDrawn']);
    expect(back).toMatchObject({ screen: 'build', phase: 0, slot: 1, week: 1, draws: s.draws + 1 });
    expect(back.hand).toEqual(drawHand(C, seed, 0, '1', s.draws, 3));
    expect(back.offers?.shop).toBeUndefined();
  });
});
