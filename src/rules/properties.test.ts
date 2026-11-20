// Property tests (implementation-plan.md §9), kept to the few that pay for themselves:
// - preview(s, p).after equals the tally from apply(s, p), and .before the tally from a pass
// - scoreOnly equals preview().after
// - replay(log) reproduces the state
// - a strike from the hand (D-157) is a free action that keeps the hand's size
// - a pin (D-186) is a free action, and next week's draw is the pin-less one with the kept card
// - the same seed gives the same game

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Action, InstallAction, PlaceAction, RunState } from './index.ts';
import { stream } from './rng.ts';
import { createRules } from './run.ts';
import { drawnBefore, keptInto, rowSlot, TEST_CONTENT } from './testing.ts';

// Targets high enough that most random runs reach the second phase, low enough that some win.
const content = {
  ...TEST_CONTENT,
  balance: {
    ...TEST_CONTENT.balance,
    weeksPerPhase: 4,
    phases: [
      { name: 'One', target: 1 },
      { name: 'Two', target: 40 },
      { name: 'Three', target: 200 },
    ],
  },
};
const rules = createRules(content);

const clock = (x: RunState) => [x.screen, x.phase, x.slot, x.week, x.overtimeWeek, x.draws];

/**
 * A random legal placement (a few tries near the house), or a pass; with `free`, sometimes a
 * free action instead (a reroll, a demolition, early completion, the auto-complete toggle, a pin).
 * Driven by a seeded stream.
 */
function randomAction(state: RunState, seed: string, step: number, free = false): Action {
  const rng = stream(seed, `test/${step}`);
  // The shop between milestones: sometimes buy what's affordable, then leave.
  if (state.screen === 'shop') {
    // An open crate first: keep an option (or discard it).
    const picks = rules.legalActions(state).filter((a) => a.t === 'pick');
    if (picks.length > 0) return rng.pick(picks);
    const ok = rules.shopOffers(state).filter((o) => o.ok && o.offer.kind !== 'service');
    return ok.length > 0 && rng.chance(50) ? { t: 'buy', i: rng.pick(ok).i } : { t: 'leaveShop' };
  }
  // A fixture card in the hand: install it in a random host (the week's turn).
  const fixtures = state.hand.flatMap((c, i) => (c.kind === 'fixture' ? [i] : []));
  if (fixtures.length > 0 && rng.chance(30)) {
    const i = rng.pick(fixtures);
    const hosts = rules.installHosts(state, 'hand', i);
    if (hosts.length > 0) return { t: 'install', from: 'hand', i, uid: rng.pick(hosts) };
  }
  if (free) {
    const roll = rng.int(100);
    if (roll < 4) return { t: 'setAutoComplete', on: !state.autoComplete };
    if (roll < 9 && rules.canReroll(state).ok) return { t: 'reroll' };
    if (roll < 14 && rules.canCompleteEarly(state).ok) return { t: 'completeEarly' };
    if (roll < 19 && state.demolitionsLeft > 0 && state.house.pieces.length > 0) {
      const p = rng.pick(state.house.pieces);
      const d = rules.previewDemolish(state, p.x, p.y);
      if (d.legal) return { t: 'demolish', x: p.x, y: p.y };
    }
    if (roll < 25 && state.hand.length > 0) {
      const i = rng.int(state.hand.length);
      if (rules.canPin(state, i).ok) return { t: 'pin', i };
    }
  }
  if (rng.chance(10)) return { t: 'pass' };
  const { width, height } = state.house.lot;
  const anchor = state.house.pieces.length > 0 ? rng.pick(state.house.pieces) : null;
  for (let tries = 0; tries < 60; tries++) {
    const near = anchor && tries < 40;
    const play: PlaceAction = {
      t: 'place',
      from: 'hand',
      i: rng.int(state.hand.length),
      x: near ? anchor.x + rng.range(-3, 3) : rng.int(width),
      y: near ? anchor.y + rng.range(-3, 3) : rng.int(height),
      rot: rng.pick([0, 1, 2, 3] as const),
    };
    if (rules.checkPlay(state, play).legal) return play;
  }
  return { t: 'pass' };
}

function playOut(
  seed: string,
  steps: number,
  free = true,
): { states: RunState[]; actions: Action[] } {
  let state = rules.newRun({
    seed,
    clientId: 'hendersons',
    crewId: 'generalContractor',
    mode: 'standard',
  });
  const states = [state];
  const actions: Action[] = [];
  for (
    let step = 0;
    step < steps && (state.screen === 'build' || state.screen === 'shop');
    step++
  ) {
    const action = randomAction(state, seed, step, free);
    state = rules.apply(state, action).state;
    actions.push(action);
    states.push(state);
  }
  return { states, actions };
}

const seedArb = fc.string({ minLength: 1, maxLength: 12 });

describe('properties', () => {
  it('preview equals the real tally, and scoreOnly equals preview', () => {
    let checked = 0;
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 11 }), (seed, steps) => {
        const { states } = playOut(seed, steps);
        const state = states.at(-1)!;
        if (state.screen !== 'build') return;
        const play = randomAction(state, `${seed}/play`, 99);
        const passTally = rules.apply(state, { t: 'pass' }).events.find((e) => e.t === 'tally')!;
        if (play.t === 'place' || play.t === 'install') {
          // Hovering previews many spots on the same state, so the cached "before" is what the
          // UI sees: warm the cache with another spot first.
          const warm = randomAction(state, `${seed}/warm`, 98);
          if (warm.t === 'place' || warm.t === 'install') rules.preview(state, warm);
          const p = rules.preview(state, play);
          expect(p.legal).toBe(true);
          const real = rules.apply(state, play).events.find((e) => e.t === 'tally')!;
          if (real.t !== 'tally' || passTally.t !== 'tally') throw new Error('no tally');
          expect(p.after).toEqual({
            points: real.tally.points,
            mult: real.tally.mult,
            total: real.tally.total,
          });
          expect(p.before.total).toBe(passTally.tally.total);
          expect(p.delta).toBe(real.tally.total - passTally.tally.total);
          expect(rules.scoreOnly(state, play)).toBe(p.after.total);
          // Every piece whose earnings changed is listed, and nothing else.
          const beforeEarned = new Map(passTally.tally.pieces.map((x) => [x.uid, x.earned]));
          const changed = real.tally.pieces
            .filter((x) => beforeEarned.get(x.uid) !== x.earned)
            .map((x) => x.uid);
          // An install always lists its host, like a new piece, even if its earnings hold.
          if (play.t === 'install' && !changed.includes(play.uid)) changed.push(play.uid);
          expect(p.lines.map((l) => l.uid).sort()).toEqual(changed.sort());
          checked++;
        }
        expect(rules.scoreOnly(state, null)).toBe(
          passTally.t === 'tally' ? passTally.tally.total : -1,
        );
      }),
      { numRuns: 120 },
    );
    expect(checked).toBeGreaterThan(40);
  }, 60_000);

  it('replay(log) reproduces the state', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 14 }), (seed, steps) => {
        const { states, actions } = playOut(seed, steps);
        const replayed = rules.replay(
          { seed, clientId: 'hendersons', crewId: 'generalContractor', mode: 'standard' },
          actions,
        );
        expect(replayed.failedAt).toBeUndefined();
        expect(replayed.state).toEqual(states.at(-1));
      }),
      { numRuns: 60 },
    );
  }, 60_000);

  it('replay stops at the first action that fails, without throwing', () => {
    const { actions, states } = playOut('stale', 5, false);
    const bad: Action = { t: 'place', from: 'hand', i: 0, x: -5, y: 0, rot: 0 };
    const result = rules.replay(
      { seed: 'stale', clientId: 'hendersons', crewId: 'generalContractor', mode: 'standard' },
      [...actions.slice(0, 3), bad, ...actions.slice(3)],
    );
    expect(result.failedAt).toBe(3);
    expect(result.error).toBe("That's off the lot.");
    expect(result.state).toEqual(states[3]);
  });

  // D-157: with strikes to use (TEST_CONTENT has none), each strike listed applies, and it's a
  // free action: the hand keeps its length, and the week and the draws stay.
  it('a strike keeps the hand’s length, the week and the draws, and legalActions lists only strikes that apply', () => {
    const striking = createRules({
      ...content,
      balance: { ...content.balance, rules: { ...content.balance.rules, strikes: 2 } },
    });
    let listed = 0;
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 11 }), (seed, steps) => {
        const end = playOut(seed, steps).states.at(-1)!;
        if (end.screen !== 'build') return;
        // The same run with two strikes in hand: the content differs only in the start.
        const s = { ...end, strikesLeft: 2 };
        const strikes = striking.legalActions(s).filter((a) => a.t === 'strikeCard');
        s.hand.forEach((_, i) => {
          expect(strikes.some((a) => a.i === i)).toBe(striking.canStrikeCard(s, i).ok);
        });
        for (const a of strikes) {
          const out = striking.apply(s, a).state;
          expect(out.hand).toHaveLength(s.hand.length);
          expect(clock(out)).toEqual(clock(s));
          expect(out.strikesLeft).toBe(1);
          listed++;
        }
      }),
      { numRuns: 40 },
    );
    expect(listed).toBeGreaterThan(0);
  }, 60_000);

  // D-186: a pin keeps the hand, the week and the draws. When the pass after it starts another
  // week with no milestone between, that week's draw is the one it makes with no pin, with the
  // pinned card in its row, at its slot, in place of one of the draw's cards.
  it('a pin is a free action, and next week’s draw is the pin-less one with the kept card in it', () => {
    let kept = 0;
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 11 }), fc.nat(), (seed, steps, pick) => {
        const end = playOut(seed, steps).states.at(-1)!;
        if (end.screen !== 'build') return;
        const pins = rules.legalActions(end).filter((a) => a.t === 'pin');
        end.hand.forEach((_, i) => {
          expect(pins.some((a) => a.i === i)).toBe(rules.canPin(end, i).ok);
        });
        if (pins.length === 0) return;
        const a = pins[pick % pins.length]!;
        const out = rules.apply(end, a).state;
        expect(out.hand).toEqual(end.hand);
        expect(clock(out)).toEqual(clock(end));
        expect(out.pinned).toBe(end.pinned === a.i ? undefined : a.i);
        if (out.pinned === undefined) return;
        const { pinned: _pinned, ...bare } = out;
        const withPin = rules.apply(out, { t: 'pass' });
        const plain = rules.apply(bare, { t: 'pass' });
        if (withPin.state.screen !== 'build' || withPin.events.some((e) => e.t === 'milestone')) {
          expect(withPin.state.kept).toBeUndefined();
          return;
        }
        const drawn = (events: typeof plain.events) =>
          drawnBefore(events.find((e) => e.t === 'handDrawn'));
        const card = end.hand[a.i]!;
        const want = keptInto(content, drawn(plain.events), card, rowSlot(content, end.hand, a.i));
        expect(drawn(withPin.events)).toEqual(want.hand);
        expect(withPin.state.kept).toBe(want.i);
        expect(withPin.state.hand[want.i]).toEqual(card);
        kept++;
      }),
      { numRuns: 60 },
    );
    expect(kept).toBeGreaterThan(10);
  }, 60_000);

  it('the same seed gives the same game', () => {
    fc.assert(
      fc.property(seedArb, (seed) => {
        const a = playOut(seed, 12);
        const b = playOut(seed, 12);
        expect(b.actions).toEqual(a.actions);
        expect(b.states).toEqual(a.states);
      }),
      { numRuns: 25 },
    );
  }, 60_000);
});
