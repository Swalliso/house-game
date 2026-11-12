// D-157: strikes from the hand. The run starts with the `strikes` rule's count and gains
// `strikesPerMilestone` at each milestone it goes on from; a strike takes a hand card's whole
// type out of the draws for the run, and every hand card of that type leaves, each slot taking a
// card from its row on a stream of its own; the shop's service is +1 strike; and a run code's
// typed strike from before still replays as D-076's.

import { describe, expect, it } from 'vitest';
import type { Action, Card, CardType, Content, GameEvent, RunState } from './index.ts';
import { CONTENT } from '../content/index.ts';
import { decodeRunCode, encodeRunCode } from './runcode.ts';
import { drawableTypes, drawWeights, rowOf, slotKey, strikeCandidates, strikeKey } from './draw.ts';
import { runModifiers } from './modifiers.ts';
import { createRules, IllegalAction, type Rules } from './run.ts';
import { SHOP_REASONS } from './shop.ts';
import {
  glossary,
  HINT_WORDS,
  hintText,
  modifierText,
  strikeText,
  struckNames,
  struckText,
} from './text.ts';
import { drawRows, setup, TEST_CONTENT } from './testing.ts';

/** TEST_CONTENT with strikes: `start` at the run's start, `per` at each milestone, `count` phases. */
function withStrikes(start = 2, per = 1, count = 2, base: Content = TEST_CONTENT): Content {
  return {
    ...base,
    balance: {
      ...base.balance,
      rules: { ...base.balance.rules, strikes: start },
      strikesPerMilestone: per,
      phases: Array.from({ length: count }, (_, i) => ({
        name: `Phase ${i + 1}`,
        target: 5 * (i + 1),
      })),
    },
  };
}

const C = withStrikes();
const rules = createRules(C);
/** The real content's rules, for what its own pieces, clients and change orders do. */
const real = createRules(CONTENT);
const KITCHEN: Card = { kind: 'piece', id: 'kitchen' };
const L_KITCHEN: Card = { kind: 'piece', id: 'lKitchen' };
const NOT_IN_DRAW = 'That card never comes up in the weekly draw.';

const words = (text: string) => text.trim().split(/\s+/).length;

function illegal(fn: () => unknown): IllegalAction {
  try {
    fn();
  } catch (e) {
    if (e instanceof IllegalAction) return e;
    throw e;
  }
  throw new Error('expected an IllegalAction');
}

function struckEvent(events: readonly GameEvent[]) {
  const e = events.find((x) => x.t === 'cardStruck');
  if (e?.t !== 'cardStruck') throw new Error('no cardStruck event');
  return e;
}

/** Passes weeks until the screen changes (a milestone resolved). */
function finishPhase(r: Rules, s: RunState): { state: RunState; events: GameEvent[] } {
  const events: GameEvent[] = [];
  const phase = s.phase;
  while (s.screen === 'build' && s.phase === phase) {
    const out = r.apply(s, { t: 'pass' });
    events.push(...out.events);
    s = out.state;
  }
  return { state: s, events };
}

/** The run's modifiers, as the draw reads them (the crew's and the client's). */
const modsOf = (s: RunState) => runModifiers(C, s).map((a) => a.mod);

/**
 * The cards a strike tries in hand slot `j`, as the rules draw them (D-157): on
 * `draw/<phase>/<slot>/<n>/<row>/strike<m>/<k>`, with m the struck types (this one included),
 * k the slot's place in its row, and the row as `hand` holds it left out. The houses here are
 * empty, so no type is at its limit yet.
 */
function tried(
  s: RunState,
  j: number,
  n: number,
  struck: readonly CardType[],
  hand: readonly Card[],
): Card[] {
  const row = rowOf(C, s.hand[j]!);
  const at = hand.flatMap((c, x) => (rowOf(C, c) === row ? [x] : []));
  return strikeCandidates(
    C,
    s.setup.seed,
    s.phase,
    slotKey(s.slot, s.overtimeWeek),
    n,
    struck.length,
    at.indexOf(j),
    C.balance.swapTries,
    at.map((x) => hand[x]!),
    { struck, mods: modsOf(s), row, atLimit: new Set() },
  );
}

/** What slot `j` should hold after the strike: the first card tried with a play, else the last. */
function chosen(after: RunState, j: number, cards: readonly Card[]): Card | undefined {
  const has = (c: Card) => {
    const s = { ...after, hand: after.hand.map((x, k) => (k === j ? c : x)) };
    return rules.cardFits(s, j) || rules.renovateTargets(s, 'hand', j).length > 0;
  };
  return cards.find(has) ?? cards.at(-1);
}

describe('how many strikes (D-157)', () => {
  it('starts with the `strikes` rule, a crew’s modifier included', () => {
    expect(rules.newRun(setup('n')).strikesLeft).toBe(2);
    const crew: Content = {
      ...C,
      crews: {
        ...C.crews,
        generalContractor: {
          ...C.crews.generalContractor,
          modifiers: [
            ...C.crews.generalContractor.modifiers,
            { kind: 'rule', key: 'strikes', add: 1 },
          ],
        },
      },
    };
    expect(createRules(crew).newRun(setup('n')).strikesLeft).toBe(3);
  });

  it('gains strikesPerMilestone at each milestone it goes on from, never the last, and keeps them', () => {
    const r = createRules(withStrikes(1, 1, 3));
    let s = r.newRun(setup('gain', 'hendersons'));
    s = { ...s, score: 1000 };
    // Milestone 1: met, +1 (in its reward); the shop, then phase 2 keeps it.
    let out = finishPhase(r, s);
    const m1 = out.events.find((e) => e.t === 'milestone');
    expect(m1).toMatchObject({ t: 'milestone', phase: 0, reward: { strikes: 1 } });
    expect(out.state.strikesLeft).toBe(2);
    s = r.apply(out.state, { t: 'leaveShop' }).state;
    expect(s.strikesLeft).toBe(2);
    out = finishPhase(r, s);
    expect(out.state.strikesLeft).toBe(3);
    s = r.apply(out.state, { t: 'leaveShop' }).state;
    // The last milestone ends the run: no strike, and none in its reward.
    out = finishPhase(r, s);
    const last = out.events.find((e) => e.t === 'milestone');
    expect(last).toMatchObject({ phase: 2, result: 'onTime' });
    expect((last as Extract<GameEvent, { t: 'milestone' }>).reward.strikes).toBeUndefined();
    expect(out.state).toMatchObject({ screen: 'won', strikesLeft: 3 });
  });

  it('a failed milestone gives none', () => {
    const r = createRules(withStrikes(1, 1, 3));
    let s = r.newRun(setup('fail'));
    s = { ...s, overtimeLeft: 0 };
    const out = finishPhase(r, s);
    expect(out.state.screen).toBe('lost');
    expect(out.state.strikesLeft).toBe(1);
  });
});

describe('a strike from the hand (D-157)', () => {
  const start = rules.newRun(setup('strike-a'));

  it('takes the card’s root type, uses a strike, and only its slot changes', () => {
    const i = 0;
    const card = start.hand[i]!;
    const { state, events } = rules.apply(start, { t: 'strikeCard', i });
    const e = struckEvent(events);
    const type =
      card.kind === 'piece'
        ? { kind: 'piece', id: C.pieces[card.id].countsAs ?? card.id }
        : { kind: 'fixture', id: card.id };
    expect(e.type).toEqual(type);
    expect(state.struck).toEqual([type]);
    expect(state.strikesLeft).toBe(start.strikesLeft - 1);
    expect(state.draws).toBe(start.draws);
    expect(e.strikesLeft).toBe(state.strikesLeft);
    // No other card moves.
    const others = start.hand.flatMap((c, j) =>
      e.slots.some((x) => x.i === j) ? [] : [[j, c] as const],
    );
    for (const [j, c] of others) expect(state.hand[j]).toEqual(c);
    expect(state.hand).toHaveLength(start.hand.length);
    // Its slot took a card from its row, from the strike's own stream: the first of the
    // candidates with a play, else the last tried.
    const row = rowOf(C, card);
    const at = start.hand.flatMap((c, j) => (rowOf(C, c) === row ? [j] : []));
    const tries = strikeCandidates(
      C,
      start.setup.seed,
      start.phase,
      slotKey(start.slot, start.overtimeWeek),
      start.draws - 1,
      1,
      at.indexOf(i),
      C.balance.swapTries,
      at.map((j) => start.hand[j]!),
      {
        struck: [type as Card],
        mods: C.crews.generalContractor.modifiers,
        row,
        atLimit: new Set(),
      },
    );
    expect(tries).toContainEqual(state.hand[i]);
    expect(rowOf(C, state.hand[i]!)).toBe(row);
    expect(e.slots[0]).toEqual({ i, was: card, card: state.hand[i] });
  });

  it('draws on keys of its own: n is the hand’s draw, m counts the struck types', () => {
    expect(strikeKey(0, '1', 0, 'rooms', 1, 0)).toBe('draw/0/1/0/rooms/strike1/0');
    // A strike, a reroll, then a second strike: it draws from the rerolled hand's draw (n =
    // draws − 1, which is 1) with m = 2.
    const first = rules.apply(start, { t: 'strikeCard', i: 0 }).state;
    const rerolled = rules.apply(first, { t: 'reroll' }).state;
    expect(rerolled.draws).toBe(2);
    const i = rerolled.hand.findIndex(
      (_, j) =>
        rules.canStrikeCard(rerolled, j).ok && rules.previewStrike(rerolled, j).cards.length === 1,
    );
    expect(i).toBeGreaterThanOrEqual(0);
    const { state, events } = rules.apply(rerolled, { t: 'strikeCard', i });
    expect(state.struck).toHaveLength(2);
    const tries = tried(rerolled, i, rerolled.draws - 1, state.struck, rerolled.hand);
    expect(tries).toContainEqual(state.hand[i]);
    expect(state.hand[i]).toEqual(chosen(state, i, tries));
    expect(struckEvent(events).slots).toEqual([{ i, was: rerolled.hand[i], card: state.hand[i] }]);
    // The other hand cards stay as the reroll left them.
    const others = (hand: readonly Card[]) => hand.filter((_, j) => j !== i);
    expect(others(state.hand)).toEqual(others(rerolled.hand));
  });

  it('takes every hand card of the type: a Kitchen and an L-Kitchen both go, each replaced', () => {
    const s: RunState = { ...start, hand: [KITCHEN, L_KITCHEN, ...start.hand.slice(2)] };
    const view = rules.previewStrike(s, 1);
    expect(view).toMatchObject({
      ok: true,
      type: KITCHEN,
      cards: [0, 1],
      text: 'No more Kitchens or L-Kitchens this run',
    });
    const { state, events } = rules.apply(s, { t: 'strikeCard', i: 1 });
    const e = struckEvent(events);
    expect(e).toMatchObject({ i: 1, type: KITCHEN });
    expect(e.slots.map((x) => [x.i, x.was])).toEqual([
      [0, KITCHEN],
      [1, L_KITCHEN],
    ]);
    expect(state.struck).toEqual([KITCHEN]);
    const isKitchen = (c: Card) => c.id === 'kitchen' || c.id === 'lKitchen';
    expect(state.hand.some(isKitchen)).toBe(false);
    expect(state.hand[0]).not.toEqual(state.hand[1]);
    expect(state.hand.slice(2)).toEqual(s.hand.slice(2));
    // Neither comes up again: 300 rerolls of later hands.
    let b: RunState = { ...state, rerollsLeft: 300 };
    for (let k = 0; k < 300; k++) {
      b = rules.apply(b, { t: 'reroll' }).state;
      expect(b.hand.some(isKitchen)).toBe(false);
    }
  });

  it('draws two slots of a type in hand order: the second leaves out the first one’s new card', () => {
    const s: RunState = { ...start, hand: [KITCHEN, L_KITCHEN, ...start.hand.slice(2)] };
    const { state } = rules.apply(s, { t: 'strikeCard', i: 1 });
    const n = s.draws - 1;
    const first = tried(s, 0, n, [KITCHEN], s.hand);
    expect(state.hand[0]).toEqual(chosen(state, 0, first));
    // The second slot's: the row as it stands, with the first slot's new card in it.
    const mid = s.hand.map((c, j) => (j === 0 ? state.hand[0]! : c));
    const second = tried(s, 1, n, [KITCHEN], mid);
    expect(second).not.toContainEqual(state.hand[0]);
    expect(state.hand[1]).toEqual(chosen(state, 1, second));
  });

  it('takes the first card tried that has a play: a fixture with nothing to go in is passed over', () => {
    // Phase 2's draw deals fixtures, and on an empty lot a fixture has no host.
    let seen = 0;
    for (let k = 0; k < 30 && seen === 0; k++) {
      let s = finishPhase(rules, { ...rules.newRun(setup(`passed-over-${k}`)), score: 100 }).state;
      s = rules.apply(s, { t: 'leaveShop' }).state;
      expect(s.house.pieces).toEqual([]);
      for (let i = 0; i < s.hand.length && seen === 0; i++) {
        const view = rules.previewStrike(s, i);
        if (!view.ok || view.cards.length !== 1) continue;
        const after = rules.apply(s, { t: 'strikeCard', i }).state;
        const tries = tried(s, i, s.draws - 1, after.struck, s.hand);
        if (tries[0]?.kind !== 'fixture' || tries.length < 2) continue;
        seen++;
        expect(after.hand[i]).toEqual(chosen(after, i, tries));
        expect(after.hand[i]).not.toEqual(tries[0]);
      }
    }
    expect(seen).toBeGreaterThan(0);
  });

  it('shifts no other draw: a reroll and the next week draw on their own keys, from the smaller pool', () => {
    const { state } = rules.apply(start, { t: 'strikeCard', i: 0 });
    const n = state.draws;
    const rerolled = rules.apply(state, { t: 'reroll' }).state;
    const held = state.hand;
    const expected = drawRows(C, start.setup.seed, 0, '1', n, {
      struck: state.struck,
      held,
      mods: C.crews.generalContractor.modifiers,
    });
    // Before any swaps (D-121): each swapped card back to the one it replaced.
    const before = rerolled.hand.map((c, j) => rerolled.swapped.find((w) => w.i === j)?.was ?? c);
    expect(before).toEqual(expected);
  });

  it('drops a swapped-in card’s note with it, and keeps the others', () => {
    const s: RunState = {
      ...start,
      swapped: [
        { i: 0, was: KITCHEN },
        { i: 3, was: { kind: 'piece', id: 'garage' } },
      ],
    };
    const { state } = rules.apply(s, { t: 'strikeCard', i: 0 });
    expect(state.swapped).toEqual([{ i: 3, was: { kind: 'piece', id: 'garage' } }]);
  });

  it('is deterministic: the same strike on the same state gives the same state and events', () => {
    const two: RunState = { ...start, hand: [KITCHEN, L_KITCHEN, ...start.hand.slice(2)] };
    for (const [s, i] of [
      [start, 0],
      [two, 1],
    ] as const) {
      const a = rules.apply(s, { t: 'strikeCard', i });
      const b = rules.apply(s, { t: 'strikeCard', i });
      const fresh = createRules(C).apply(s, { t: 'strikeCard', i });
      expect(b.state).toStrictEqual(a.state);
      expect(b.events).toStrictEqual(a.events);
      expect(fresh.state).toStrictEqual(a.state);
      expect(fresh.events).toStrictEqual(a.events);
    }
  });

  it('says why not: off the build screen, none left, no card, not in the draws, struck, the floor', () => {
    const shop = { ...start, screen: 'shop' as const };
    expect(rules.canStrikeCard(shop, 0)).toEqual({ ok: false, reason: 'The shop is open.' });
    expect(rules.canStrikeCard({ ...start, strikesLeft: 0 }, 0)).toEqual({
      ok: false,
      reason: 'No strikes left.',
    });
    expect(rules.canStrikeCard(start, 9).ok).toBe(false);
    expect(rules.canStrikeCard(start, 0.5).ok).toBe(false);
    // A member's room (the ?debug panel's) and a special piece no one here draws (the Catalog's).
    const nursery: RunState = { ...start, hand: [{ kind: 'piece', id: 'nursery' }] };
    expect(rules.canStrikeCard(nursery, 0).reason).toBe(NOT_IN_DRAW);
    const library: RunState = { ...start, hand: [{ kind: 'piece', id: 'library' }] };
    expect(rules.canStrikeCard(library, 0).reason).toBe(NOT_IN_DRAW);
    // The Architect draws the Library, so it can be struck.
    const arch = { ...library, setup: { ...library.setup, crewId: 'architect' as const } };
    expect(rules.canStrikeCard(arch, 0)).toEqual({ ok: true });
    expect(drawableTypes(C, [], 'rooms', C.crews.architect.modifiers)).toContainEqual({
      kind: 'piece',
      id: 'library',
    });
    // Already struck (a card the ?debug panel gave).
    const again: RunState = { ...start, hand: [KITCHEN], struck: [KITCHEN] };
    expect(rules.canStrikeCard(again, 0).reason).toBe('That card is already struck.');
    // A row at its floor.
    const rooms = drawableTypes(C, [], 'rooms');
    const floor = C.balance.shop.strikeMinTypes.rooms;
    const atFloor: RunState = {
      ...start,
      hand: [KITCHEN],
      struck: rooms.filter((t) => t.id !== 'kitchen').slice(0, rooms.length - floor),
    };
    expect(drawableTypes(C, atFloor.struck, 'rooms')).toHaveLength(floor);
    expect(rules.canStrikeCard(atFloor, 0).reason).toBe(SHOP_REASONS.rowFloor);
    // apply() refuses the shop's actions first, in its own words (as for a reroll).
    for (const s of [nursery, atFloor]) {
      expect(illegal(() => rules.apply(s, { t: 'strikeCard', i: 0 })).reason).toBe(
        rules.canStrikeCard(s, 0).reason,
      );
    }
  });

  it('in a Catalog hand: a special piece can’t go, and a fixture’s slot takes a card from the weekly pool (a known gap)', () => {
    let found = 0;
    for (let k = 0; k < 12 && found === 0; k++) {
      let s = finishPhase(rules, { ...rules.newRun(setup(`catalog-${k}`)), score: 100 }).state;
      s = rules.apply(s, { t: 'leaveShop' }).state;
      s = rules.apply(s, {
        t: 'debug',
        op: 'giveGood',
        good: { kind: 'tool', id: 'catalog' },
      }).state;
      const tool = s.supplies.findIndex((x) => x.kind === 'tool' && x.id === 'catalog');
      const special = rules.apply(s, { t: 'useTool', i: tool }).state;
      const fx = special.hand.findIndex(
        (c, i) => c.kind === 'fixture' && rules.canStrikeCard(special, i).ok,
      );
      if (fx < 0) continue;
      found++;
      // The Catalog's special pieces aren't in this run's draw.
      special.hand.forEach((c, i) => {
        if (c.kind === 'piece') expect(rules.canStrikeCard(special, i).reason).toBe(NOT_IN_DRAW);
      });
      const { state, events } = rules.apply(special, { t: 'strikeCard', i: fx });
      expect(struckEvent(events).slots).toEqual([
        { i: fx, was: special.hand[fx], card: state.hand[fx] },
      ]);
      // The weekly pool of its row (the draw without `special`), not the Catalog's: the rules
      // don't record that a hand is the Catalog's.
      const pool = drawWeights(C, state.phase, {
        struck: state.struck,
        mods: modsOf(state),
        row: rowOf(C, special.hand[fx]!),
      });
      expect(pool.map((p) => p.card)).toContainEqual(state.hand[fx]);
    }
    expect(found).toBeGreaterThan(0);
  });

  it('legalActions lists a strike for each card that can go, and each applies', () => {
    const listed = rules.legalActions(start).filter((a) => a.t === 'strikeCard');
    expect(listed).toEqual(start.hand.map((_, i) => ({ t: 'strikeCard', i })));
    for (const a of listed) expect(() => rules.apply(start, a)).not.toThrow();
    expect(rules.legalActions({ ...start, strikesLeft: 0 }).some((a) => a.t === 'strikeCard')).toBe(
      false,
    );
  });

  it('a run code with strikes replays exactly', () => {
    const log: Action[] = [{ t: 'strikeCard', i: 0 }, { t: 'reroll' }, { t: 'strikeCard', i: 2 }];
    let s = start;
    for (const a of log) s = rules.apply(s, a).state;
    const code = encodeRunCode({ build: 't', contentHash: 'x', setup: start.setup, actions: log });
    const decoded = decodeRunCode(code);
    if (!decoded.ok) throw new Error(decoded.error);
    expect(decoded.data.actions).toStrictEqual(log);
    expect(rules.replay(decoded.data.setup, decoded.data.actions).state).toStrictEqual(s);
    // Junk is dropped; a strike without a whole index isn't one.
    const raw = (actions: unknown[]) =>
      'OH1.' +
      Buffer.from(
        JSON.stringify({ build: 't', contentHash: 'x', setup: start.setup, actions }),
      ).toString('base64url');
    const junk = decodeRunCode(raw([{ t: 'strikeCard', i: 1, type: { kind: 'piece', id: 'x' } }]));
    expect(junk.ok && junk.data.actions).toEqual([{ t: 'strikeCard', i: 1 }]);
    const extra = decodeRunCode(raw([{ t: 'strikeCard', i: 1, extra: 1 }]));
    expect(extra.ok && extra.data.actions).toStrictEqual([{ t: 'strikeCard', i: 1 }]);
    expect(decodeRunCode(raw([{ t: 'strikeCard', i: '1' }])).ok).toBe(false);
    // `strike` is no action of this build's: only a buy has a field of that name.
    expect(decodeRunCode(raw([{ t: 'strike', i: 1 }])).ok).toBe(false);
  });
});

describe('whether Strike can be used at all (D-157)', () => {
  const start = rules.newRun(setup('strike-any'));

  it('is ok with a strike and a card that can go; off the build screen, with none left, or with nothing left to strike, it says why not', () => {
    expect(rules.canStrikeAny(start)).toEqual({ ok: true });
    expect(rules.canStrikeAny({ ...start, screen: 'shop' })).toEqual({
      ok: false,
      reason: 'The shop is open.',
    });
    expect(rules.canStrikeAny({ ...start, strikesLeft: 0 })).toEqual({
      ok: false,
      reason: 'No strikes left.',
    });
    // Every row at its floor.
    const mods = modsOf(start);
    const rooms = drawableTypes(C, [], 'rooms', mods);
    const layout = drawableTypes(C, [], 'layout', mods);
    const floor = C.balance.shop.strikeMinTypes;
    const done: RunState = {
      ...start,
      struck: [...rooms.slice(0, -floor.rooms), ...layout.slice(0, -floor.layout)],
    };
    expect(rules.strikeOptions(done)).toEqual([]);
    expect(rules.canStrikeAny(done)).toEqual({ ok: false, reason: SHOP_REASONS.noStrike });
  });

  it('is refused for a hand none of whose cards can go, and legalActions lists no strike', () => {
    const s0 = real.newRun({
      seed: 'strike-none',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    expect(s0.strikesLeft).toBeGreaterThan(0);
    expect(real.canStrikeAny(s0)).toEqual({ ok: true });
    // Special pieces the General Contractor and the Hendersons never draw: the Hendersons'
    // pool only adds percent, so a weight of 0 stays 0.
    const ids = ['playroom', 'library', 'hotTub', 'henhouse'] as const;
    for (const id of ids) {
      expect(CONTENT.pieces[id].drawWeight).toBe(0);
      expect(CONTENT.pieces[id].member).toBeFalsy();
    }
    const s: RunState = { ...s0, hand: ids.map((id): Card => ({ kind: 'piece', id })) };
    s.hand.forEach((_, i) => expect(real.canStrikeCard(s, i).reason).toBe(NOT_IN_DRAW));
    expect(real.canStrikeAny(s)).toEqual({
      ok: false,
      reason: 'No card in your hand can be struck.',
    });
    expect(real.legalActions(s).some((a) => a.t === 'strikeCard')).toBe(false);
  });
});

describe('change orders after a strike (D-157)', () => {
  it('striking the Home Office from the hand takes Working from home out of the offers', () => {
    const s0 = real.newRun({
      seed: 'strike-orders',
      clientId: 'hendersons',
      crewId: 'generalContractor',
      mode: 'standard',
    });
    expect(s0.phase).toBe(0);
    expect(real.eligibleChangeOrders(s0)).toContain('workingFromHome');
    // None in the reserve, where it could still be placed from.
    expect(s0.reserve).toEqual([]);
    const office: Card = { kind: 'piece', id: 'homeOffice' };
    const s: RunState = { ...s0, hand: [office, ...s0.hand.slice(1)] };
    const { state } = real.apply(s, { t: 'strikeCard', i: 0 });
    expect(state.struck).toEqual([office]);
    expect(real.eligibleChangeOrders(state)).not.toContain('workingFromHome');
  });
});

describe('the shop’s strike service is +1 strike (D-157)', () => {
  const shopState = (seed = 'svc') => {
    const s = rules.newRun(setup(seed));
    const out = finishPhase(rules, { ...s, score: 100 });
    return { ...out.state, budget: 30 };
  };
  it('adds a strike at 2, 3, 4, 5, then 5, and names no type', () => {
    let s = shopState();
    const v = s.offers!.shop!;
    const i = v.offers.findIndex((o) => o.kind === 'service' && o.service === 'strike');
    const prices: number[] = [];
    const left = s.strikesLeft;
    for (let k = 0; k < 5; k++) {
      const out = rules.apply(s, { t: 'buy', i });
      const e = out.events.find((x) => x.t === 'bought')!;
      if (e.t !== 'bought') throw new Error();
      prices.push(e.price);
      expect(e.strike).toBeUndefined();
      s = out.state;
    }
    expect(prices).toEqual([2, 3, 4, 5, 5]);
    expect(s.strikesLeft).toBe(left + 5);
    expect(s.struck).toEqual([]);
    expect(s.servicesBought.strike).toBe(5);
  });

  it('can’t be bought with nothing left to strike, and a typed strike still works as D-076’s', () => {
    const s = shopState();
    const i = s.offers!.shop!.offers.findIndex(
      (o) => o.kind === 'service' && o.service === 'strike',
    );
    const rooms = drawableTypes(C, [], 'rooms');
    const layout = drawableTypes(C, [], 'layout');
    const floor = C.balance.shop.strikeMinTypes;
    const done = {
      ...s,
      struck: [...rooms.slice(0, -floor.rooms), ...layout.slice(0, -floor.layout)],
    };
    expect(rules.shopOffers(done)[i]).toMatchObject({ ok: false, reason: SHOP_REASONS.noStrike });
    const typed = rules.apply(s, { t: 'buy', i, strike: KITCHEN });
    expect(typed.state.struck).toEqual([KITCHEN]);
    expect(typed.state.strikesLeft).toBe(s.strikesLeft);
    expect(typed.events.find((e) => e.t === 'bought')).toMatchObject({ strike: KITCHEN });
  });
});

describe('the words (D-157)', () => {
  it('name the type and its variants in the draw, plural', () => {
    const t = (kind: 'piece' | 'fixture', id: string) => strikeText(CONTENT, { kind, id } as Card);
    expect(t('piece', 'garage')).toBe('No more Garages this run');
    expect(t('piece', 'kitchen')).toBe('No more Kitchens or L-Kitchens this run');
    expect(t('piece', 'hallway')).toBe('No more Hallways or Long Hallways this run');
    expect(t('piece', 'porch')).toBe('No more Porches this run');
    expect(t('piece', 'library')).toBe('No more Libraries this run');
    expect(t('piece', 'bedroom')).toBe('No more Bedrooms this run');
    expect(t('fixture', 'soundproofing')).toBe('No more Soundproofing this run');
    expect(t('fixture', 'gardenLights')).toBe('No more Garden Lights this run');
    expect(struckText(CONTENT, [])).toBeNull();
    const struck: CardType[] = [
      { kind: 'piece', id: 'garage' },
      { kind: 'fixture', id: 'skylight' },
    ];
    expect(struckNames(CONTENT, struck)).toEqual(['Garage', 'Skylight']);
    expect(struckNames(CONTENT, [])).toEqual([]);
    expect(struckText(CONTENT, struck)).toBe('Struck: Garage, Skylight');
  });

  it('every type a strike can take reads as a sentence', () => {
    for (const type of drawableTypes(CONTENT)) {
      expect(strikeText(CONTENT, type)).toMatch(/^No more [A-Z][^]* this run$/);
    }
  });

  it('the hint keeps to its budget and says where more strikes come from', () => {
    const hint = hintText(CONTENT).strike;
    expect(words(hint)).toBeLessThanOrEqual(HINT_WORDS);
    expect(hint).toContain('Milestones add strikes.');
    // With none at the milestones (TEST_CONTENT's balance), the shop is where more come from.
    expect(TEST_CONTENT.balance.strikesPerMilestone).toBe(0);
    const shop = hintText(TEST_CONTENT).strike;
    expect(shop).toMatch(/ The shop sells more\.$/);
    expect(words(shop)).toBeLessThanOrEqual(HINT_WORDS);
  });

  it('the glossary names the draw’s variants and takes its numbers from the balance', () => {
    const g = glossary(CONTENT).strike.text;
    expect(g).toContain('(the L-Kitchen goes with the Kitchen, the Long Hallway with the Hallway)');
    expect(g).toContain('You start with 1 strike and get 1 more at each milestone.');
    expect(g).toContain('2 budget, 1 more each time (up to 5)');
    expect(g).toBe(
      'Strike a card in your hand and its type is never drawn again this run (the L-Kitchen ' +
        'goes with the Kitchen, the Long Hallway with the Hallway): a card from its row takes ' +
        'its place, and the week goes on. You start with 1 strike and get 1 more at each ' +
        'milestone. The shop sells more: 2 budget, 1 more each time (up to 5). At least 5 Rooms ' +
        'and 4 Layout types always stay.',
    );
    expect(glossary(CONTENT).services.text).toContain('demolition or strike');
  });

  it('a strikes rule (a crew’s, say) reads as the shop’s service does', () => {
    expect(modifierText(CONTENT, { kind: 'rule', key: 'strikes', add: 1 })).toBe('+1 strike');
    expect(modifierText(CONTENT, { kind: 'rule', key: 'strikes', add: 2 })).toBe('+2 strikes');
  });
});
