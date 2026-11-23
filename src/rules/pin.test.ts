// D-186: pin one card. A free action pins a hand card for next week (one pin at a time; a
// second pin moves it, and the pinned card again takes it off). Next week the card is back in
// its row, at the slot it was pinned from, in place of a card of that week's own draw: the draw
// keeps its keys, so nothing else shifts, and the swaps (D-121) skip it. The card a pin kept
// can't be pinned again. A pin goes with its card (played, struck, rerolled, or redrawn by the
// Catalog); a reroll and the Catalog leave the kept card where it is; it carries into an
// overtime week. D-207: it carries past a milestone, its change orders and its shop (Complete
// early's too) into the next phase's first week, and there's none to set in the run's last
// week, which no week follows. Run codes replay it.

import { describe, expect, it } from 'vitest';
import type { Action, Card, Content, GameEvent, RunState } from './index.ts';
import { rowOf } from './draw.ts';
import { decodeRunCode, encodeRunCode } from './runcode.ts';
import { createRules, IllegalAction, type Rules } from './run.ts';
import {
  drawnBefore,
  emptyRows,
  houseFrom,
  keptInto,
  rowSlot,
  setup,
  TEST_CONTENT,
} from './testing.ts';

const C = TEST_CONTENT;
const rules = createRules(C);
const KEPT_AGAIN = 'Kept from last week: it can’t be pinned again.';
const NO_WEEK_AFTER = 'No week comes after this one.';

const J = (x: unknown) => JSON.stringify(x);

function illegal(fn: () => unknown): IllegalAction {
  try {
    fn();
  } catch (e) {
    if (e instanceof IllegalAction) return e;
    throw e;
  }
  throw new Error('expected an IllegalAction');
}

/** The first `handDrawn` event. */
function drawnEvent(events: readonly GameEvent[]) {
  const e = events.find((x) => x.t === 'handDrawn');
  if (e?.t !== 'handDrawn') throw new Error('no handDrawn event');
  return e;
}

/** Applies actions in turn. */
function run(r: Rules, s: RunState, actions: readonly Action[]) {
  const events: GameEvent[] = [];
  for (const a of actions) {
    const out = r.apply(s, a);
    events.push(...out.events);
    s = out.state;
  }
  return { state: s, events };
}

const clock = (s: RunState) => [s.screen, s.phase, s.slot, s.week, s.overtimeWeek, s.draws];

describe('pinning a card (D-186)', () => {
  it('pins a hand card, moves the pin to another, and takes it off: a free action', () => {
    const s = rules.newRun(setup('pin-a'));
    expect(s.pinned).toBeUndefined();
    const a = rules.apply(s, { t: 'pin', i: 1 });
    expect(a.state.pinned).toBe(1);
    expect(a.events).toEqual([{ t: 'cardPinned', i: 1, pinned: true }]);
    expect(a.state.hand).toEqual(s.hand);
    expect(clock(a.state)).toEqual(clock(s));
    // One at a time: a second pin moves it.
    const b = rules.apply(a.state, { t: 'pin', i: 3 });
    expect(b.state.pinned).toBe(3);
    expect(b.events).toEqual([{ t: 'cardPinned', i: 3, pinned: true }]);
    // The pinned card again: the pin comes off, and leaves nothing behind in the state.
    const c = rules.apply(b.state, { t: 'pin', i: 3 });
    expect('pinned' in c.state).toBe(false);
    expect(c.events).toEqual([{ t: 'cardPinned', i: 3, pinned: false }]);
    expect(c.state).toEqual(s);
  });

  it('refuses a card that isn’t in the hand, and off the build screen', () => {
    const s = rules.newRun(setup('pin-b'));
    for (const i of [-1, s.hand.length, 0.5, Number.NaN]) {
      expect(rules.canPin(s, i)).toEqual({ ok: false, reason: 'Pick a card in your hand.' });
      expect(illegal(() => rules.apply(s, { t: 'pin', i })).reason).toBe(
        'Pick a card in your hand.',
      );
    }
    const shop = rules.apply(s, { t: 'debug', op: 'forceShop' }).state;
    expect(shop.screen).toBe('shop');
    expect(rules.canPin(shop, 0)).toEqual({ ok: false, reason: 'The shop is open.' });
    expect(() => rules.apply(shop, { t: 'pin', i: 0 })).toThrow(IllegalAction);
  });

  it('is listed for every hand card the last week’s pin didn’t keep', () => {
    const s = rules.newRun(setup('pin-c'));
    const pins = (x: RunState) => rules.legalActions(x).filter((a) => a.t === 'pin');
    expect(pins(s)).toEqual(s.hand.map((_, i) => ({ t: 'pin', i })));
    const next = run(rules, s, [{ t: 'pin', i: 2 }, { t: 'pass' }]).state;
    expect(next.kept).toBe(2);
    expect(pins(next)).toEqual(
      next.hand.flatMap((_, i) => (i === 2 ? [] : [{ t: 'pin' as const, i }])),
    );
  });
});

describe('next week’s hand (D-186)', () => {
  it('holds the pinned card at its slot in its row, in place of a card of the week’s own draw', () => {
    let dealtElsewhere = 0;
    let dealtThere = 0;
    for (let n = 0; n < 24; n++) {
      const s = rules.newRun(setup(`pin-next-${n}`));
      s.hand.forEach((card, i) => {
        const withPin = run(rules, s, [{ t: 'pin', i }, { t: 'pass' }]);
        const plain = run(rules, s, [{ t: 'pass' }]);
        const k = rowSlot(C, s.hand, i);
        const fresh = drawnBefore(drawnEvent(plain.events));
        const want = keptInto(C, fresh, card, k);
        // The same slot, its card from last week; the rest is this week's own draw, before swaps.
        expect(withPin.state.kept).toBe(want.i);
        expect(withPin.state.hand[want.i]).toEqual(card);
        expect(drawnBefore(drawnEvent(withPin.events))).toEqual(want.hand);
        expect(drawnEvent(withPin.events).kept).toBe(want.i);
        expect(withPin.state.pinned).toBeUndefined();
        const at = fresh.findIndex((c) => J(c) === J(card));
        if (at === want.i) dealtThere++;
        else if (at >= 0) dealtElsewhere++;
        // The week after, nothing has shifted: the same hand as without the pin.
        const after = rules.apply(withPin.state, { t: 'pass' });
        const plainAfter = rules.apply(plain.state, { t: 'pass' });
        expect(after.state.hand).toEqual(plainAfter.state.hand);
        expect(after.state.kept).toBeUndefined();
      });
    }
    // Both of the draw's own cases came up: it dealt the kept card in another slot of its row
    // (that slot takes the card the kept one displaced), and in the kept card's own slot.
    expect(dealtElsewhere).toBeGreaterThan(0);
    expect(dealtThere).toBeGreaterThan(0);
  });

  it('keeps a card the swaps would replace: a fixture with nothing to go in', () => {
    // An empty lot: a fixture has no host, so the week's swaps would replace it (D-121).
    const s = run(rules, rules.newRun(setup('pin-fixture')), [
      { t: 'debug', op: 'giveGood', good: { kind: 'fixtureCard', id: 'fireplace' } },
    ]).state;
    const i = s.hand.length - 1;
    expect(s.hand[i]).toEqual({ kind: 'fixture', id: 'fireplace' });
    expect(rowOf(C, s.hand[i]!)).toBe('rooms');
    const next = run(rules, s, [{ t: 'pin', i }, { t: 'pass' }]);
    // It was the Rooms row's third card; next week's row has two, so it takes the last.
    expect(next.state.kept).toBe(1);
    expect(next.state.hand[1]).toEqual({ kind: 'fixture', id: 'fireplace' });
    expect(rules.cardFits(next.state, 1)).toBe(false);
    expect(drawnEvent(next.events).swapped?.some((w) => w.i === 1) ?? false).toBe(false);
  });

  it('puts the card in a row the draw left empty', () => {
    const noLayout = createRules({
      ...C,
      balance: { ...C.balance, rules: { ...C.balance.rules, layoutRow: 0 } },
    });
    const s = run(noLayout, noLayout.newRun(setup('pin-empty-row')), [
      { t: 'debug', op: 'giveCard', id: 'fence' },
    ]).state;
    const i = s.hand.length - 1;
    expect(s.hand.every((c, j) => j === i || rowOf(C, c) === 'rooms')).toBe(true);
    const next = run(noLayout, s, [{ t: 'pin', i }, { t: 'pass' }]).state;
    expect(next.hand).toHaveLength(3);
    expect(next.kept).toBe(2);
    expect(next.hand[2]).toEqual({ kind: 'piece', id: 'fence' });
  });

  it('isn’t kept when it’s the card played', () => {
    const s = rules.newRun(setup('pin-played'));
    const play = rules.legalPlacements(s)[0]!;
    const out = run(rules, s, [{ t: 'pin', i: play.i }, play]);
    expect(out.state.week).toBe(2);
    expect(out.state.kept).toBeUndefined();
    expect(drawnEvent(out.events).kept).toBeUndefined();
  });

  it('can’t be pinned again the week after; another card can, and it’s the one kept next', () => {
    const s = rules.newRun(setup('pin-again'));
    const week2 = run(rules, s, [{ t: 'pin', i: 0 }, { t: 'pass' }]).state;
    const k = week2.kept!;
    expect(rules.canPin(week2, k)).toEqual({ ok: false, reason: KEPT_AGAIN });
    expect(illegal(() => rules.apply(week2, { t: 'pin', i: k })).reason).toBe(KEPT_AGAIN);
    const other = k === 0 ? 1 : 0;
    const card = week2.hand[other]!;
    // The phase's last week: with nothing built the target is missed, and an overtime week
    // follows. A pin carries into it.
    const week3 = run(rules, week2, [{ t: 'pin', i: other }, { t: 'pass' }]);
    expect(week3.events.some((e) => e.t === 'overtimeUsed')).toBe(true);
    expect(week3.state.overtimeWeek).toBe(1);
    expect(week3.state.hand[week3.state.kept!]).toEqual(card);
    // And from one overtime week into the next.
    const j = week3.state.kept === 2 ? 3 : 2;
    const week4 = run(rules, week3.state, [{ t: 'pin', i: j }, { t: 'pass' }]).state;
    expect(week4.overtimeWeek).toBe(2);
    expect(week4.hand[week4.kept!]).toEqual(week3.state.hand[j]);
  });
});

describe('past a milestone (D-207)', () => {
  /** A run in Groundbreaking's last week with its target met. */
  function lastWeekMet(seed: string, r: Rules = rules): RunState {
    return run(r, r.newRun(setup(seed)), [{ t: 'pass' }, { t: 'debug', op: 'addScore', amount: 5 }])
      .state;
  }

  /** From past a milestone into the next phase's first week: a crate let go, an order picked. */
  function intoPhase(r: Rules, s: RunState) {
    const actions: Action[] = [];
    for (let x = s; x.screen !== 'build';) {
      const a: Action =
        x.screen === 'changeOrder'
          ? { t: 'answerChangeOrder', i: 0 }
          : x.offers?.pick
            ? { t: 'pick', i: -1 }
            : { t: 'leaveShop' };
      actions.push(a);
      x = r.apply(x, a).state;
    }
    return run(r, s, actions);
  }

  /**
   * The next phase's first hand, with `card` pinned from slot k of its row in the phase's last
   * week: the hand it deals with no pin, with the card at its slot in place of one of that
   * draw's cards (or of the duplicate's, as next week's hand does it), and nothing shifted.
   */
  function expectKept(
    withPin: { state: RunState; events: GameEvent[] },
    plain: { state: RunState; events: GameEvent[] },
    card: Card,
    k: number,
  ) {
    const want = keptInto(C, drawnBefore(drawnEvent(plain.events)), card, k);
    expect(drawnBefore(drawnEvent(withPin.events))).toEqual(want.hand);
    expect(drawnEvent(withPin.events).kept).toBe(want.i);
    expect(withPin.state.kept).toBe(want.i);
    expect(withPin.state.hand[want.i]).toEqual(card);
    expect('pinnedOver' in withPin.state || 'pinned' in withPin.state).toBe(false);
    expect(clock(withPin.state)).toEqual(clock(plain.state));
  }

  it('a milestone and its shop: the card waits, and comes back in the next phase’s first week', () => {
    let checked = 0;
    for (let n = 0; n < 8; n++) {
      const s = lastWeekMet(`pin-milestone-${n}`);
      expect(s.slot).toBe(2);
      s.hand.forEach((card, i) => {
        const k = rowSlot(C, s.hand, i);
        const out = run(rules, s, [{ t: 'pin', i }, { t: 'pass' }]);
        expect(out.events.some((e) => e.t === 'milestone')).toBe(true);
        expect(out.state.screen).toBe('shop');
        expect('pinned' in out.state || 'kept' in out.state).toBe(false);
        expect(out.state.pinnedOver).toEqual({ card, k });
        const plain = run(rules, s, [{ t: 'pass' }]);
        expect('pinnedOver' in plain.state).toBe(false);
        // The shop's own actions leave it be.
        const refreshed = rules.apply(out.state, { t: 'refreshShop' }).state;
        expect(refreshed.pinnedOver).toEqual({ card, k });
        const next = intoPhase(rules, out.state);
        expect(next.state.phase).toBe(1);
        expect(next.state.slot).toBe(1);
        expectKept(next, intoPhase(rules, plain.state), card, k);
        // It can't be pinned again; the week after, nothing has shifted.
        expect(rules.canPin(next.state, next.state.kept!)).toEqual({
          ok: false,
          reason: KEPT_AGAIN,
        });
        const after = rules.apply(next.state, { t: 'pass' });
        const plainAfter = rules.apply(intoPhase(rules, plain.state).state, { t: 'pass' });
        expect(after.state.hand).toEqual(plainAfter.state.hand);
        checked++;
      });
    }
    expect(checked).toBeGreaterThan(20);
  });

  it('Complete early, from the button or Auto', () => {
    const met = run(rules, rules.newRun(setup('pin-early')), [
      { t: 'debug', op: 'addScore', amount: 5 },
      { t: 'pin', i: 2 },
    ]).state;
    expect(met.slot).toBe(1);
    const card = met.hand[2]!;
    const k = rowSlot(C, met.hand, 2);
    const { pinned: _pinned, ...bare } = met;
    // The button: this week's hand is set aside, and the pinned card goes on.
    const manual = rules.apply(met, { t: 'completeEarly' }).state;
    expect(manual.screen).toBe('shop');
    expect('pinned' in manual || 'kept' in manual).toBe(false);
    expect(manual.pinnedOver).toEqual({ card, k });
    const plainManual = rules.apply(bare, { t: 'completeEarly' }).state;
    expectKept(intoPhase(rules, manual), intoPhase(rules, plainManual), card, k);
    // Auto, as the week's tally meets the target.
    const auto = run(rules, met, [{ t: 'setAutoComplete', on: true }, { t: 'pass' }]);
    expect(auto.events.some((e) => e.t === 'milestone' && e.result === 'early')).toBe(true);
    expect(auto.state.screen).toBe('shop');
    expect('pinned' in auto.state || 'kept' in auto.state).toBe(false);
    expect(auto.state.pinnedOver).toEqual({ card, k });
    const plainAuto = run(rules, bare, [{ t: 'setAutoComplete', on: true }, { t: 'pass' }]).state;
    expectKept(intoPhase(rules, auto.state), intoPhase(rules, plainAuto), card, k);
  });

  it('an overtime week’s milestone, and a change order before the shop', () => {
    // Groundbreaking missed in its last week: an overtime week, met there.
    const overtime = run(rules, rules.newRun(setup('pin-overtime')), [
      { t: 'pass' },
      { t: 'pass' },
      { t: 'debug', op: 'addScore', amount: 5 },
    ]).state;
    expect(overtime.overtimeWeek).toBe(1);
    const i = overtime.kept === 0 ? 1 : 0;
    const card = overtime.hand[i]!;
    const out = run(rules, overtime, [{ t: 'pin', i }, { t: 'pass' }]);
    expect(out.events.some((e) => e.t === 'milestone' && e.result === 'overtime')).toBe(true);
    expect(out.state.pinnedOver).toEqual({ card, k: rowSlot(C, overtime.hand, i) });
    expect(intoPhase(rules, out.state).state.hand).toContainEqual(card);
    // With change orders after the first milestone, the card waits through the pick too.
    const ordering = createRules({
      ...C,
      balance: { ...C.balance, changeOrderAfter: [1] },
    });
    const s = lastWeekMet('pin-order', ordering);
    const card2 = s.hand[1]!;
    const k2 = rowSlot(C, s.hand, 1);
    const offered = run(ordering, s, [{ t: 'pin', i: 1 }, { t: 'pass' }]);
    expect(offered.state.screen).toBe('changeOrder');
    expect(offered.state.pinnedOver).toEqual({ card: card2, k: k2 });
    const picked = ordering.apply(offered.state, { t: 'answerChangeOrder', i: 0 }).state;
    expect(picked.screen).toBe('shop');
    expect(picked.pinnedOver).toEqual({ card: card2, k: k2 });
    const plain = run(ordering, s, [{ t: 'pass' }]).state;
    expectKept(intoPhase(ordering, offered.state), intoPhase(ordering, plain), card2, k2);
  });

  it('a type struck in the shop (an old run code’s typed strike) takes the card', () => {
    const s = lastWeekMet('pin-struck');
    let struck = 0;
    s.hand.forEach((card, i) => {
      const shop = { ...run(rules, s, [{ t: 'pin', i }, { t: 'pass' }]).state, budget: 30 };
      const at = shop.offers!.shop!.offers.findIndex(
        (o) => o.kind === 'service' && o.service === 'strike',
      );
      expect(at).toBeGreaterThanOrEqual(0);
      const type = { kind: card.kind, id: card.id } as Card;
      let bought: RunState;
      try {
        bought = rules.apply(shop, { t: 'buy', i: at, strike: type }).state;
      } catch (e) {
        if (e instanceof IllegalAction) return;
        throw e;
      }
      expect(bought.pinnedOver).toEqual(shop.pinnedOver);
      const next = intoPhase(rules, bought);
      expect(next.state.kept).toBeUndefined();
      expect(drawnEvent(next.events).kept).toBeUndefined();
      expect(next.state.hand).not.toContainEqual(card);
      struck++;
    });
    expect(struck).toBeGreaterThan(0);
  });

  it('the ?debug panel’s shop, opened mid-week, deals a fresh hand and takes the pin', () => {
    const s = rules.apply(rules.newRun(setup('pin-forced')), { t: 'pin', i: 0 }).state;
    const shop = rules.apply(s, { t: 'debug', op: 'forceShop' }).state;
    expect('pinned' in shop || 'pinnedOver' in shop).toBe(false);
    const back = rules.apply(shop, { t: 'leaveShop' }).state;
    expect(back.week).toBe(1);
    expect(back.kept).toBeUndefined();
  });

  it('a change order the ?debug panel forces mid-week keeps the pin: the card comes next week', () => {
    const s = rules.apply(rules.newRun(setup('pin-forced-order')), { t: 'pin', i: 1 }).state;
    const card = s.hand[1]!;
    const offered = rules.apply(s, {
      t: 'debug',
      op: 'forceChangeOrder',
      id: 'workingFromHome',
    }).state;
    expect(offered.screen).toBe('changeOrder');
    expect('pinnedOver' in offered).toBe(false);
    // Answered, it goes back to the same week and the same hand, the pin still on its card.
    const back = rules.apply(offered, { t: 'answerChangeOrder', i: 0 }).state;
    expect([back.screen, back.week]).toEqual(['build', 1]);
    expect(back.hand).toEqual(s.hand);
    expect(back.pinned).toBe(1);
    const next = run(rules, back, [{ t: 'pass' }]);
    const want = keptInto(
      C,
      drawnBefore(drawnEvent(rules.apply(withoutPin(back), { t: 'pass' }).events)),
      card,
      rowSlot(C, s.hand, 1),
    );
    expect(drawnBefore(drawnEvent(next.events))).toEqual(want.hand);
    expect(next.state.kept).toBe(want.i);
  });

  it('the shop’s own actions and the ?debug panel’s gifts leave the waiting card; its opener and a forced order are refused', () => {
    const s = lastWeekMet('pin-shop-actions');
    const card = s.hand[0]!;
    const shop = run(rules, s, [{ t: 'pin', i: 0 }, { t: 'pass' }]).state;
    const over = { card, k: rowSlot(C, s.hand, 0) };
    expect(shop.pinnedOver).toEqual(over);
    const after = run(rules, shop, [
      { t: 'debug', op: 'addBudget', amount: 20 },
      { t: 'debug', op: 'giveGood', good: { kind: 'tool', id: 'catalog' } },
      { t: 'sell', from: 'supplies', i: 0 },
      { t: 'refreshShop' },
      { t: 'debug', op: 'addScore', amount: 3 },
      { t: 'setAutoComplete', on: true },
    ]).state;
    expect(after.screen).toBe('shop');
    expect(after.pinnedOver).toEqual(over);
    // The ?debug panel's shop and forced orders open from the build screen only.
    expect(() => rules.apply(after, { t: 'debug', op: 'forceShop' })).toThrow(IllegalAction);
    expect(() =>
      rules.apply(after, { t: 'debug', op: 'forceChangeOrder', id: 'workingFromHome' }),
    ).toThrow(IllegalAction);
    const next = intoPhase(rules, after).state;
    expect(next.hand[next.kept!]).toEqual(card);
  });

  it('a milestone missed in an earlier phase, the run lost, keeps nothing; met there, the card waits', () => {
    // Groundbreaking's second overtime week, with none left: its tally meets the milestone or
    // ends the run, which the player can't know yet, so a pin is there to set (D-207).
    const s = run(rules, rules.newRun(setup('pin-lost')), [
      { t: 'pass' },
      { t: 'pass' },
      { t: 'pass' },
    ]).state;
    expect([s.phase, s.overtimeWeek, s.overtimeLeft]).toEqual([0, 2, 0]);
    expect(rules.lastWeekOfRun(s)).toBe(false);
    const i = s.kept === 0 ? 1 : 0;
    expect(rules.canPin(s, i)).toEqual({ ok: true });
    const lost = run(rules, s, [{ t: 'pin', i }, { t: 'pass' }]);
    expect(lost.events.some((e) => e.t === 'milestone' && e.result === 'failed')).toBe(true);
    expect(lost.state.screen).toBe('lost');
    expect('pinned' in lost.state || 'pinnedOver' in lost.state || 'kept' in lost.state).toBe(
      false,
    );
    const met = run(rules, { ...s, score: 5 }, [{ t: 'pin', i }, { t: 'pass' }]).state;
    expect(met.screen).toBe('shop');
    expect(met.pinnedOver).toEqual({ card: s.hand[i]!, k: rowSlot(C, s.hand, i) });
  });
});

/** The state with no pin: the same week as a player who didn't pin would have it. */
function withoutPin(s: RunState): RunState {
  const { pinned: _pinned, ...rest } = s;
  return rest;
}

describe('the run’s last week (D-207)', () => {
  /** Foundation, the last phase, in its last week, with `overtime` weeks of overtime left. */
  function lastPhaseLastWeek(seed: string, overtime: number): RunState {
    let s = run(rules, rules.newRun(setup(seed)), [
      { t: 'pass' },
      { t: 'debug', op: 'addScore', amount: 5 },
      { t: 'pass' },
      { t: 'leaveShop' },
      { t: 'pass' },
    ]).state;
    expect([s.phase, s.slot]).toEqual([1, 2]);
    expect(s.overtimeLeft).toBe(2);
    s = { ...s, overtimeLeft: overtime };
    return s;
  }

  it('has no pin to set: no week comes after it', () => {
    const s = lastPhaseLastWeek('pin-last', 0);
    expect(rules.lastWeekOfRun(s)).toBe(true);
    s.hand.forEach((_, i) => {
      expect(rules.canPin(s, i)).toEqual({ ok: false, reason: NO_WEEK_AFTER });
      expect(illegal(() => rules.apply(s, { t: 'pin', i })).reason).toBe(NO_WEEK_AFTER);
    });
    expect(rules.legalActions(s).some((a) => a.t === 'pin')).toBe(false);
    // Its tally ends the run, won or lost.
    expect(rules.apply(s, { t: 'pass' }).state.screen).toBe('lost');
    expect(rules.apply({ ...s, score: 1000 }, { t: 'pass' }).state.screen).toBe('won');
  });

  it('with overtime left, a week may follow: a pin carries into the overtime week', () => {
    const s = lastPhaseLastWeek('pin-last-ot', 1);
    expect(rules.lastWeekOfRun(s)).toBe(false);
    expect(rules.canPin(s, 0)).toEqual({ ok: true });
    const card = s.hand[0]!;
    const out = run(rules, s, [{ t: 'pin', i: 0 }, { t: 'pass' }]).state;
    expect(out.overtimeWeek).toBe(1);
    expect(out.hand[out.kept!]).toEqual(card);
    // That overtime week is the run's last: none is left after it.
    expect(out.overtimeLeft).toBe(0);
    expect(rules.lastWeekOfRun(out)).toBe(true);
    expect(rules.canPin(out, out.kept === 0 ? 1 : 0).ok).toBe(false);
  });

  it('a milestone the run ends on keeps nothing', () => {
    const s = lastPhaseLastWeek('pin-won', 1);
    const won = run(rules, { ...s, score: 1000 }, [{ t: 'pin', i: 0 }, { t: 'pass' }]).state;
    expect(won.screen).toBe('won');
    expect('pinned' in won || 'pinnedOver' in won || 'kept' in won).toBe(false);
  });

  it('isn’t an earlier phase’s last week, nor the last phase’s earlier weeks', () => {
    const first = run(rules, rules.newRun(setup('pin-not-last')), [{ t: 'pass' }]).state;
    expect([first.phase, first.slot]).toEqual([0, 2]);
    expect(rules.lastWeekOfRun({ ...first, overtimeLeft: 0 })).toBe(false);
    const s = lastPhaseLastWeek('pin-not-last-2', 0);
    expect(rules.lastWeekOfRun({ ...s, slot: 1 })).toBe(false);
  });

  it('the overtime week the neighbor gives (D-206) is a week after it: a pin carries into it', () => {
    // Four two-week phases, the last one's target out of reach, and the neighbor's ask at the
    // third, for 5 tiles of Fence along their side.
    const asking: Content = {
      ...C,
      balance: {
        ...C.balance,
        phases: [0, 0, 0, 1e9].map((target, k) => ({ name: `Phase ${k + 1}`, target })),
        neighborAsk: { phase: 2, piece: 'fence', depth: 2, tiles: 5, reward: { overtime: 1 } },
      },
    };
    const r = createRules(asking);
    const lot = emptyRows(12, 8);
    const start = r.newRun(setup('pin-neighbor'));
    const opening = { ...start, house: houseFrom(asking, lot, [['bedroom', 5, 3]]) };
    const at = (s: RunState, phase: number, slot: number) =>
      s.screen === 'build' && s.phase === phase && s.slot === slot;
    /** Passes, and leaves shops, to `slot` of `phase`. */
    const to = (s: RunState, phase: number, slot: number) => {
      for (let n = 0; n < 40 && !at(s, phase, slot); n++)
        s = r.apply(s, s.screen === 'shop' ? { t: 'leaveShop' } : { t: 'pass' }).state;
      expect(at(s, phase, slot)).toBe(true);
      return s;
    };
    // The ask comes as the third phase starts; by then no overtime is left.
    const asked = { ...to(opening, 2, 1), overtimeLeft: 0 };
    expect(asked.neighbor).toBeDefined();
    // Five tiles of Fence down both edges: whichever side they asked, it's met.
    const five = ['#', '#', '#', '#', '#'];
    const fenced: RunState = {
      ...asked,
      house: houseFrom(asking, lot, [
        ['bedroom', 5, 3],
        ['fence', 0, 0, 0, five],
        ['fence', 10, 0, 0, five],
      ]),
    };
    expect(r.neighbor(fenced)).toMatchObject({ met: true });

    // Unmet, the last phase's last week is the run's last.
    const plain = to(asked, 3, 2);
    expect(plain.overtimeLeft).toBe(0);
    expect(r.lastWeekOfRun(plain)).toBe(true);
    expect(r.canPin(plain, 0)).toEqual({ ok: false, reason: NO_WEEK_AFTER });
    // Met, the neighbor's week follows it: a pin is there to set, and carries into that week.
    const s = to(fenced, 3, 2);
    expect(s.overtimeLeft).toBe(1);
    expect(r.lastWeekOfRun(s)).toBe(false);
    const i = s.kept === 0 ? 1 : 0;
    expect(r.canPin(s, i)).toEqual({ ok: true });
    const card = s.hand[i]!;
    const over = run(r, s, [{ t: 'pin', i }, { t: 'pass' }]).state;
    expect([over.phase, over.overtimeWeek, over.overtimeLeft]).toEqual([3, 1, 0]);
    expect(over.hand[over.kept!]).toEqual(card);
    // That week is the run's last: its tally ends the run, and nothing is kept.
    expect(r.lastWeekOfRun(over)).toBe(true);
    const lost = r.apply(over, { t: 'pass' }).state;
    expect(lost.screen).toBe('lost');
    expect('pinned' in lost || 'pinnedOver' in lost || 'kept' in lost).toBe(false);
  });
});

describe('the pin and the hand’s other actions (D-186)', () => {
  /** Week 2, with the card pinned from week 1's slot `i` kept. */
  function keptWeek(seed: string, i = 3): RunState {
    return run(rules, rules.newRun(setup(seed)), [{ t: 'pin', i }, { t: 'pass' }]).state;
  }

  it('a reroll leaves the kept card where it is, redraws the rest, and takes a pin with its card', () => {
    const s = keptWeek('pin-reroll');
    const k = s.kept!;
    const pinned = k === 0 ? 1 : 0;
    const before = rules.apply(s, { t: 'pin', i: pinned }).state;
    const out = rules.apply(before, { t: 'reroll' });
    expect(out.state.kept).toBe(k);
    expect(out.state.hand[k]).toEqual(s.hand[k]);
    expect(out.state.pinned).toBeUndefined();
    const e = drawnEvent(out.events);
    expect(e.reroll).toBe(true);
    expect(e.kept).toBe(k);
    // The rest is the reroll's own draw: the same reroll with no kept card draws it.
    const { kept: _kept, ...bare } = before;
    const plain = drawnBefore(drawnEvent(rules.apply(bare, { t: 'reroll' }).events));
    const want = keptInto(C, plain, s.hand[k]!, rowSlot(C, s.hand, k));
    expect(drawnBefore(e)).toEqual(want.hand);
    expect(want.i).toBe(k);
  });

  it('the Catalog’s redraw leaves the kept card where it is, and takes a pin with its card', () => {
    const s = run(rules, keptWeek('pin-catalog'), [
      { t: 'debug', op: 'giveGood', good: { kind: 'tool', id: 'catalog' } },
    ]).state;
    const k = s.kept!;
    const pinned = k === 0 ? 1 : 0;
    const before = rules.apply(s, { t: 'pin', i: pinned }).state;
    const out = rules.apply(before, { t: 'useTool', i: 0 });
    expect(out.state.kept).toBe(k);
    expect(out.state.hand[k]).toEqual(s.hand[k]);
    expect(out.state.pinned).toBeUndefined();
    const e = drawnEvent(out.events);
    expect(e.special).toBe(true);
    expect(e.kept).toBe(k);
  });

  it('a strike of the pinned card’s type takes the pin; of the kept card’s, the kept mark', () => {
    const striking = createRules({
      ...C,
      balance: { ...C.balance, rules: { ...C.balance.rules, strikes: 3 } },
    });
    const s = run(striking, striking.newRun(setup('pin-strike')), [
      { t: 'pin', i: 3 },
      { t: 'pass' },
    ]).state;
    const k = s.kept!;
    const others = s.hand.flatMap((_, i) => (i === k ? [] : [i]));
    const [a, b] = others.filter((i) => striking.canStrikeCard(s, i).ok) as [number, number];
    expect(b).toBeDefined();
    // Another card's strike leaves the pin where it is.
    const pinnedA = striking.apply(s, { t: 'pin', i: a }).state;
    const struckB = striking.apply(pinnedA, { t: 'strikeCard', i: b }).state;
    expect(striking.previewStrike(pinnedA, b).cards.includes(a)).toBe(false);
    expect(struckB.pinned).toBe(a);
    expect(struckB.kept).toBe(k);
    // Its own type's strike takes it.
    const struckA = striking.apply(pinnedA, { t: 'strikeCard', i: a }).state;
    expect(struckA.pinned).toBeUndefined();
    expect(struckA.kept).toBe(k);
    // So does the kept card's.
    if (striking.canStrikeCard(s, k).ok) {
      const struckK = striking.apply(s, { t: 'strikeCard', i: k }).state;
      expect(struckK.kept).toBeUndefined();
      expect(struckK.hand[k]).not.toEqual(s.hand[k]);
    }
  });

  it('a free play from the hand moves the pin with the cards after it, and takes it with its card', () => {
    const s = run(rules, rules.newRun(setup('pin-free')), [
      { t: 'debug', op: 'giveGood', good: { kind: 'tool', id: 'weekendCrew' } },
      { t: 'useTool', i: 0 },
    ]).state;
    expect(s.freePlay).toBe('ready');
    const play = rules.legalPlacements(s).find((p) => p.i === 0)!;
    expect(play).toBeDefined();
    const card = s.hand[3]!;
    const out = run(rules, s, [{ t: 'pin', i: 3 }, play]).state;
    expect(out.week).toBe(1);
    expect(out.pinned).toBe(2);
    expect(out.hand[2]).toEqual(card);
    const next = rules.apply(out, { t: 'pass' }).state;
    expect(next.hand[next.kept!]).toEqual(card);
    // The pinned card played for free: the pin goes with it.
    const gone = run(rules, s, [{ t: 'pin', i: 0 }, play]).state;
    expect(gone.pinned).toBeUndefined();
  });
});

describe('run codes (D-186)', () => {
  it('a run with pins replays from its code', () => {
    const s = rules.newRun(setup('pin-code'));
    const actions: Action[] = [
      { t: 'pin', i: 1 },
      { t: 'pin', i: 2 },
      { t: 'pass' },
      { t: 'reroll' },
      { t: 'pin', i: 0 },
      { t: 'pin', i: 0 },
      { t: 'pin', i: 3 },
      { t: 'pass' },
    ];
    const played = run(rules, s, actions).state;
    expect(played.kept).toBeDefined();
    const code = encodeRunCode({ build: 'test', contentHash: 'x', setup: s.setup, actions });
    const decoded = decodeRunCode(code);
    if (!decoded.ok) throw new Error(decoded.error);
    expect(decoded.data.actions).toEqual(actions);
    const replayed = rules.replay(decoded.data.setup, decoded.data.actions);
    expect(replayed.failedAt).toBeUndefined();
    expect(replayed.state).toEqual(played);
  });

  it('a code saved in the shop while a pinned card waits replays to it, and on into the next phase (D-207)', () => {
    const s = rules.newRun(setup('pin-code-over'));
    const toShop: Action[] = [
      { t: 'pass' },
      { t: 'debug', op: 'addScore', amount: 5 },
      { t: 'pin', i: 1 },
      { t: 'pass' },
      { t: 'refreshShop' },
    ];
    const replay = (actions: readonly Action[]) => {
      const code = encodeRunCode({ build: 'test', contentHash: 'x', setup: s.setup, actions });
      const decoded = decodeRunCode(code);
      if (!decoded.ok) throw new Error(decoded.error);
      const out = rules.replay(decoded.data.setup, decoded.data.actions);
      expect(out.failedAt).toBeUndefined();
      return out.state;
    };
    const inShop = run(rules, s, toShop).state;
    expect(inShop.screen).toBe('shop');
    expect(inShop.pinnedOver?.card).toEqual(run(rules, s, toShop.slice(0, 2)).state.hand[1]);
    expect(replay(toShop)).toEqual(inShop);
    const onward: Action[] = [...toShop, { t: 'leaveShop' }];
    const next = run(rules, s, onward).state;
    expect(next.hand[next.kept!]).toEqual(inShop.pinnedOver!.card);
    expect(replay(onward)).toEqual(next);
  });

  it('a pin with no card is refused when the code is read', () => {
    for (const bad of [{ t: 'pin' }, { t: 'pin', i: '1' }, { t: 'pin', i: 1.5 }]) {
      const code = encodeRunCode({
        build: 'test',
        contentHash: 'x',
        setup: setup('pin-bad'),
        actions: [bad as Action],
      });
      expect(decodeRunCode(code).ok).toBe(false);
    }
  });
});
