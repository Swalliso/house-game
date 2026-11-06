// Property tests (implementation-plan.md §9), kept to the few that pay for themselves:
// - preview(s, p).after equals the tally from apply(s, p), and .before the tally from a pass
// - scoreOnly equals preview().after
// - replay(log) reproduces the state
// - the same seed gives the same game

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Action, InstallAction, PlaceAction, RunState } from './index.ts';
import { stream } from './rng.ts';
import { createRules } from './run.ts';
import { TEST_CONTENT } from './testing.ts';

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

/**
 * A random legal placement (a few tries near the house), or a pass; with `free`, sometimes a
 * free action instead (a reroll, a demolition, early completion, the auto-complete toggle).
 * Driven by a seeded stream.
 */
function randomAction(state: RunState, seed: string, step: number, free = false): Action {
  const rng = stream(seed, `test/${step}`);
  // The shop between milestones: sometimes buy what's affordable, then leave.
  if (state.screen === 'shop') {
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
  let state = rules.newRun({ seed, crewId: 'generalContractor', mode: 'standard' });
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
          { seed, crewId: 'generalContractor', mode: 'standard' },
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
    const result = rules.replay({ seed: 'stale', crewId: 'generalContractor', mode: 'standard' }, [
      ...actions.slice(0, 3),
      bad,
      ...actions.slice(3),
    ]);
    expect(result.failedAt).toBe(3);
    expect(result.error).toBe("That's off the lot.");
    expect(result.state).toEqual(states[3]);
  });

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
