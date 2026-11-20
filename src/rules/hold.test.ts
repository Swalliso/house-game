// D-196: hold a good for the next visit. A free action in the shop holds one good, any but a
// service: holding another moves the hold, and the held one again lets it go. Each stocking after
// it, a refresh's and the next visit's, puts it back on the shelf in place of a fresh good of its
// kind (of itself, if the stocking drew it too; a piece or a fixture with none of its kind takes
// a card's place; with nothing of its kind it goes after the goods; a held upgrade is the visit's),
// at that stocking's price. Buying it lets it go, and so does a stocking it can't come back to: a
// blueprint or an upgrade the run owns by then, a special piece whose type is at its limit, said
// with an event and the visit's line. No shop follows the last one, so it holds nothing. Run codes
// replay holds.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Content,
  GameEvent,
  Good,
  RunState,
  ShelfGood,
  ShopOffer,
  ShopVisit,
} from './index.ts';
import { decodeRunCode, encodeRunCode } from './runcode.ts';
import { createRules, IllegalAction, type Rules } from './run.ts';
import { HOLD_REASONS, openVisit, SHOP_REASONS, stockGoods, withHeld } from './shop.ts';
import { emptyRows, houseFrom, setup, TEST_CONTENT, withPieces } from './testing.ts';

/** TEST_CONTENT with `count` phases (targets 5, 10, 15, …): shops 1 to count − 1. */
function phases(count: number, base: Content = TEST_CONTENT): Content {
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

/** Four phases: shops 1, 2 and 3, the third the last. */
const C = phases(4);
const rules = createRules(C);

const PASS: Action = { t: 'pass' };
const LEAVE: Action = { t: 'leaveShop' };
const REFRESH: Action = { t: 'refreshShop' };
const hold = (i: number): Action => ({ t: 'hold', i });
const buy = (i: number): Action => ({ t: 'buy', i });
const addBudget = (amount: number): Action => ({ t: 'debug', op: 'addBudget', amount });
const give = (good: Good): Action => ({ t: 'debug', op: 'giveGood', good });

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

function illegal(fn: () => unknown): IllegalAction {
  try {
    fn();
  } catch (e) {
    if (e instanceof IllegalAction) return e;
    throw e;
  }
  throw new Error('expected an IllegalAction');
}

const visitOf = (s: RunState): ShopVisit => {
  const v = s.offers?.shop;
  if (!v) throw new Error('no shop visit');
  return v;
};
const goods = (s: RunState) => visitOf(s).offers.filter((o) => o.kind !== 'service');
/** Offer i as a hold keeps it. */
function goodAt(s: RunState, i: number): ShelfGood {
  const o = visitOf(s).offers[i];
  if (!o || o.kind === 'service') throw new Error(`no good at ${i}`);
  return { kind: o.kind, id: o.id } as ShelfGood;
}
const firstOf = (s: RunState, kind: ShopOffer['kind']) =>
  visitOf(s).offers.findIndex((o) => o.kind === kind);
const same = (o: ShopOffer, g: ShelfGood) => o.kind === g.kind && 'id' in o && o.id === g.id;
const heldViews = (s: RunState) =>
  rules
    .shopOffers(s)
    .filter((o) => o.held)
    .map((o) => o.i);

/** A run in shop 1 (phase 1 about to start). */
const shop1 = (seed: string, r: Rules = rules) => finishPhase(r, r.newRun(setup(seed))).state;
/** A run in shop 2, past shop 1 with nothing done there. */
const shop2 = (seed: string) => finishPhase(rules, rules.apply(shop1(seed), LEAVE).state).state;

describe('holding a good (D-196)', () => {
  it('holds a good, moves the hold to another, and lets it go: a free action', () => {
    const s = shop1('hold-a');
    const a = rules.apply(s, hold(0));
    expect(a.state.held).toEqual(goodAt(s, 0));
    expect(a.events).toEqual([{ t: 'goodHeld', i: 0, good: goodAt(s, 0), held: true }]);
    expect({ ...a.state, held: undefined }).toEqual(s);
    expect(heldViews(a.state)).toEqual([0]);
    // One at a time: holding another moves it.
    const b = rules.apply(a.state, hold(2));
    expect(b.state.held).toEqual(goodAt(s, 2));
    expect(b.events).toEqual([{ t: 'goodHeld', i: 2, good: goodAt(s, 2), held: true }]);
    expect(heldViews(b.state)).toEqual([2]);
    // The held one again lets it go, and leaves nothing behind in the state.
    const c = rules.apply(b.state, hold(2));
    expect('held' in c.state).toBe(false);
    expect(c.events).toEqual([{ t: 'goodHeld', i: 2, good: goodAt(s, 2), held: false }]);
    expect(c.state).toEqual(s);
  });

  it('refuses a service, nothing there, a sold good, and off the shop screen', () => {
    const s = rules.apply(shop1('hold-b'), addBudget(50)).state;
    const offers = visitOf(s).offers;
    offers.forEach((o, i) => {
      if (o.kind !== 'service') return;
      expect(rules.canHold(s, i)).toEqual({ ok: false, reason: HOLD_REASONS.service });
      expect(illegal(() => rules.apply(s, hold(i))).reason).toBe(HOLD_REASONS.service);
    });
    for (const i of [-1, offers.length, 0.5, Number.NaN]) {
      expect(rules.canHold(s, i)).toEqual({ ok: false, reason: HOLD_REASONS.nothing });
      expect(illegal(() => rules.apply(s, hold(i))).reason).toBe(HOLD_REASONS.nothing);
    }
    const sold = rules.apply(s, buy(0)).state;
    expect(rules.canHold(sold, 0)).toEqual({ ok: false, reason: SHOP_REASONS.sold });
    const build = rules.apply(s, LEAVE).state;
    expect(rules.canHold(build, 0)).toEqual({ ok: false, reason: SHOP_REASONS.notOpen });
    expect(illegal(() => rules.apply(build, hold(0))).reason).toBe(SHOP_REASONS.notOpen);
  });

  it('waits for an open crate’s pick', () => {
    const s = rules.apply(shop2('hold-c'), addBudget(50)).state;
    const picking = rules.apply(s, buy(firstOf(s, 'crate'))).state;
    expect(picking.offers?.pick).toBeDefined();
    expect(rules.canHold(picking, 0)).toEqual({ ok: false, reason: SHOP_REASONS.picking });
    expect(illegal(() => rules.apply(picking, hold(0))).reason).toBe(SHOP_REASONS.picking);
    expect(rules.legalActions(picking).some((a) => a.t === 'hold')).toBe(false);
  });

  it('is listed for every good but the services, and the held one', () => {
    const s = rules.apply(shop2('hold-d'), hold(1)).state;
    const listed = rules.legalActions(s).flatMap((a) => (a.t === 'hold' ? [a.i] : []));
    const expected = visitOf(s).offers.flatMap((o, i) => (o.kind === 'service' ? [] : [i]));
    expect(listed).toEqual(expected);
    expect(listed).toContain(1);
  });

  it('buying the held good lets its hold go; buying another keeps it', () => {
    const s = applyAll(rules, shop1('hold-e'), [addBudget(50), hold(1)]).state;
    const other = rules.apply(s, buy(0)).state;
    expect(other.held).toEqual(goodAt(s, 1));
    expect(heldViews(other)).toEqual([1]);
    const bought = rules.apply(s, buy(1));
    expect('held' in bought.state).toBe(false);
    expect(bought.events.map((e) => e.t)).toEqual(['bought']);
    expect(heldViews(bought.state)).toEqual([]);
  });
});

describe('the held good back on the shelf (D-196)', () => {
  it('a refresh rerolls the rest, and puts it back in place of the first fresh good of its kind', () => {
    const s = applyAll(rules, shop1('hold-f'), [addBudget(10), hold(1)]).state;
    const held = goodAt(s, 1);
    const fresh = stockGoods(C, s, 1, 1);
    // This seed's refresh doesn't draw it again, so it stands in for another good.
    expect(fresh.some((o) => same(o, held))).toBe(false);
    const out = rules.apply(s, REFRESH);
    expect(out.state.held).toEqual(held);
    expect(goods(out.state)).toEqual(withHeld(fresh, [], held).goods);
    const at = fresh.findIndex((o) => o.kind === held.kind);
    expect(goods(out.state)[at]).toEqual(held);
    expect(heldViews(out.state)).toEqual([at]);
    expect(out.events.map((e) => e.t)).toEqual(['shopRefreshed']);
  });

  it('the next visit has it in place of the first good of its kind, at that visit’s price', () => {
    let s = shop1('hold-g');
    const i = firstOf(s, 'blueprint') + 1;
    const held = goodAt(s, i);
    const before = rules.shopOffers(s)[i]!;
    s = applyAll(rules, s, [hold(i), LEAVE]).state;
    expect(s.held).toEqual(held);
    // A Supplier Discount (−25%) by then: the held good comes back at the new price.
    s = rules.apply(s, give({ kind: 'upgrade', id: 'supplierDiscount' })).state;
    const out = finishPhase(rules, s).state;
    const v = visitOf(out);
    expect(v.number).toBe(2);
    const fresh = stockGoods(C, out, 2, 0);
    expect(fresh.some((o) => same(o, held))).toBe(false);
    expect(goods(out).filter((o) => o.kind !== 'upgrade')).toEqual(withHeld(fresh, [], held).goods);
    const at = fresh.findIndex((o) => o.kind === held.kind);
    const view = rules.shopOffers(out)[at]!;
    expect(view.offer).toEqual(held);
    expect(view.held).toBe(true);
    expect(out.held).toEqual(held);
    expect(view.fullPrice).toBeLessThan(before.fullPrice);
    expect(view.fullPrice).toBe(Math.max(1, Math.floor((before.fullPrice * 75) / 100 + 0.5)));
  });

  it('stays held until it’s bought: a good can wait more than one visit', () => {
    const s = shop2('hold-h');
    const i = firstOf(s, 'tool');
    const held = goodAt(s, i);
    const out = finishPhase(rules, applyAll(rules, s, [hold(i), LEAVE]).state).state;
    expect(visitOf(out).number).toBe(3);
    expect(out.held).toEqual(held);
    expect(goods(out).filter((o) => same(o, held))).toHaveLength(1);
  });

  it('a held upgrade is the next visit’s; the last shop has it back, and holds nothing', () => {
    const s = shop2('hold-i');
    const u = firstOf(s, 'upgrade');
    const held = goodAt(s, u);
    const left = applyAll(rules, s, [hold(u), LEAVE]).state;
    const out = finishPhase(rules, left).state;
    const v = visitOf(out);
    expect(v.number).toBe(3);
    // Its own upgrade, without the hold, would have been another.
    const { held: _held, ...plain } = { ...out, offers: undefined };
    const own = openVisit(C, plain, 3).offers.filter((o) => o.kind === 'upgrade');
    expect(own).not.toEqual([held]);
    expect(v.offers.filter((o) => o.kind === 'upgrade')).toEqual([held]);
    expect(rules.shopOffers(out).find((o) => o.held)?.offer).toEqual(held);
    // No shop follows the last phase's milestone: nothing can be held, or let go.
    for (const o of rules.shopOffers(out)) {
      expect(rules.canHold(out, o.i)).toEqual({ ok: false, reason: HOLD_REASONS.lastShop });
    }
    expect(illegal(() => rules.apply(out, hold(u))).reason).toBe(HOLD_REASONS.lastShop);
    expect(rules.legalActions(out).some((a) => a.t === 'hold')).toBe(false);
  });
});

describe('where the held good goes (D-196)', () => {
  const bp = (id: string) => ({ kind: 'blueprint', id }) as ShopOffer;
  const pc = (id: string) => ({ kind: 'piece', id }) as ShopOffer;
  const fx = (id: string) => ({ kind: 'fixture', id }) as ShopOffer;
  const up = (id: string) => ({ kind: 'upgrade', id }) as ShopOffer;
  const g = (o: ShopOffer) => o as ShelfGood;

  it('in place of itself, if the stocking drew it too, else of the first good of its kind', () => {
    const shelf = [bp('fengShui'), bp('waterfront'), fx('sprinkler'), pc('library')];
    expect(withHeld(shelf, [], g(bp('waterfront'))).goods).toEqual(shelf);
    expect(withHeld(shelf, [], g(bp('goodBones'))).goods).toEqual([
      bp('goodBones'),
      bp('waterfront'),
      fx('sprinkler'),
      pc('library'),
    ]);
    expect(withHeld(shelf, [], g(pc('pool'))).goods).toEqual([
      bp('fengShui'),
      bp('waterfront'),
      fx('sprinkler'),
      pc('pool'),
    ]);
  });

  it('a piece or a fixture with none of its kind takes the first card’s place', () => {
    const shelf = [bp('fengShui'), fx('sprinkler'), fx('pergola')];
    expect(withHeld(shelf, [], g(pc('pool'))).goods).toEqual([
      bp('fengShui'),
      pc('pool'),
      fx('pergola'),
    ]);
    expect(withHeld([bp('fengShui'), pc('pool')], [], g(fx('pergola'))).goods).toEqual([
      bp('fengShui'),
      fx('pergola'),
    ]);
  });

  it('with nothing of its kind it goes after the goods; a held upgrade is the visit’s', () => {
    expect(withHeld([bp('fengShui')], [], g(pc('pool'))).goods).toEqual([
      bp('fengShui'),
      pc('pool'),
    ]);
    const held = withHeld([bp('fengShui')], [up('foreman')], g(up('toolBelt')));
    expect(held).toEqual({ goods: [bp('fengShui')], upgrade: [up('toolBelt')] });
    // A visit with no upgrade of its own (shop 1) takes it too.
    expect(withHeld([bp('fengShui')], [], g(up('toolBelt'))).upgrade).toEqual([up('toolBelt')]);
  });
});

describe('a held good that can’t come back (D-196)', () => {
  it('a blueprint the run owns by the next visit is dropped, with an event and the visit’s line', () => {
    let s = shop1('hold-j');
    const i = firstOf(s, 'blueprint');
    const held = goodAt(s, i);
    s = applyAll(rules, s, [hold(i), LEAVE]).state;
    s = rules.apply(s, give(held as Good)).state;
    const out = finishPhase(rules, s);
    expect(out.events.filter((e) => e.t === 'holdDropped')).toEqual([
      { t: 'holdDropped', good: held, why: 'owned' },
    ]);
    const order = out.events.map((e) => e.t);
    expect(order.indexOf('holdDropped')).toBeLessThan(order.indexOf('shopOpened'));
    expect('held' in out.state).toBe(false);
    expect(visitOf(out.state).dropped).toEqual({ good: held, why: 'owned' });
    expect(heldViews(out.state)).toEqual([]);
  });

  it('one the run comes to own in the visit is dropped at the next refresh', () => {
    let s = applyAll(rules, shop1('hold-k'), [addBudget(20)]).state;
    const i = firstOf(s, 'blueprint');
    const held = goodAt(s, i);
    s = applyAll(rules, s, [hold(i), give(held as Good)]).state;
    // The ?debug panel (or a crate's pick) gave it: it can be let go, but not held again.
    expect(rules.canHold(s, i)).toEqual({ ok: true });
    expect(rules.canHold(rules.apply(s, hold(i)).state, i)).toEqual({
      ok: false,
      reason: SHOP_REASONS.owned,
    });
    const out = rules.apply(s, REFRESH);
    expect(out.events.map((e) => e.t)).toEqual(['holdDropped', 'shopRefreshed']);
    expect('held' in out.state).toBe(false);
    expect(visitOf(out.state).dropped).toEqual({ good: held, why: 'owned' });
  });

  it('a special piece whose type is at its limit by then is dropped; one at its limit now can’t be held', () => {
    const capped = withPieces({ library: { perHouse: 1 } }, C);
    const r = createRules(capped);
    const LIBRARY: ShelfGood = { kind: 'piece', id: 'library' };
    let s = shop1('hold-l', r);
    const v = visitOf(s);
    s = { ...s, offers: { shop: { ...v, offers: [LIBRARY, ...v.offers.slice(1)] } } };
    s = applyAll(r, s, [hold(0), LEAVE]).state;
    expect(s.held).toEqual(LIBRARY);
    // A Library goes up before the next visit: its type is at its one-per-house cap.
    s = { ...s, house: houseFrom(capped, emptyRows(10, 6), [['library', 0, 0]]) };
    const out = finishPhase(r, s);
    expect(out.events.filter((e) => e.t === 'holdDropped')).toEqual([
      { t: 'holdDropped', good: LIBRARY, why: 'limit' },
    ]);
    expect('held' in out.state).toBe(false);
    const w = visitOf(out.state);
    const shelf = { ...out.state, offers: { shop: { ...w, offers: [LIBRARY, ...w.offers] } } };
    expect(r.canHold(shelf, 0)).toEqual({ ok: false, reason: HOLD_REASONS.atLimit });
  });
});

describe('run codes (D-196)', () => {
  it('a run with holds replays from its code', () => {
    let s = rules.newRun(setup('hold-code'));
    const actions: Action[] = [];
    const act = (a: Action) => {
      actions.push(a);
      s = rules.apply(s, a).state;
    };
    /** Passes to the milestone: the score already meets it. */
    const toShop = () => {
      while (rules.legalActions(s).some((a) => a.t === 'pass')) act(PASS);
    };
    act({ t: 'debug', op: 'addScore', amount: 100 });
    toShop();
    act(hold(0));
    act(hold(1));
    act(addBudget(20));
    act(REFRESH);
    act(LEAVE);
    toShop();
    const back = rules.shopOffers(s).find((o) => o.held);
    expect(back).toBeDefined();
    act(addBudget(50));
    act(buy(back!.i));
    expect(s.held).toBeUndefined();
    const code = encodeRunCode({ build: 'test', contentHash: 'x', setup: s.setup, actions });
    const decoded = decodeRunCode(code);
    if (!decoded.ok) throw new Error(decoded.error);
    expect(decoded.data.actions).toEqual(actions);
    const replayed = rules.replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.state).toEqual(s);
  });

  it('a hold with no good is refused when the code is read', () => {
    for (const bad of [{ t: 'hold' }, { t: 'hold', i: '1' }, { t: 'hold', i: 1.5 }]) {
      const code = encodeRunCode({
        build: 'test',
        contentHash: 'x',
        setup: setup('hold-bad'),
        actions: [bad as Action],
      });
      expect(decodeRunCode(code).ok).toBe(false);
    }
  });
});
