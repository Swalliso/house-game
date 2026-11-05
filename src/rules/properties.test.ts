// Property tests (implementation-plan.md §9), kept to the few that pay for themselves:
// - preview(s, p).after equals the tally from apply(s, p), and .before the tally from a pass
// - scoreOnly equals preview().after
// - replay(log) reproduces the state
// - the same seed gives the same game

import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Action, PlaceAction, RunState } from './index.ts';
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

/** A random legal placement (a few tries near the house), or a pass. Driven by a seeded stream. */
function randomAction(state: RunState, seed: string, step: number): Action {
  const rng = stream(seed, `test/${step}`);
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

function playOut(seed: string, steps: number): { states: RunState[]; actions: Action[] } {
  let state = rules.newRun({ seed, mode: 'standard' });
  const states = [state];
  const actions: Action[] = [];
  for (let step = 0; step < steps && state.screen === 'build'; step++) {
    const action = randomAction(state, seed, step);
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
        if (play.t === 'place') {
          // Hovering previews many spots on the same state, so the cached "before" is what the
          // UI sees: warm the cache with another spot first.
          rules.preview(state, randomAction(state, `${seed}/warm`, 98) as PlaceAction);
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
          expect(p.lines.map((l) => l.uid).sort()).toEqual(changed.sort());
          checked++;
        }
        expect(rules.scoreOnly(state, null)).toBe(
          passTally.t === 'tally' ? passTally.tally.total : -1,
        );
      }),
      { numRuns: 150 },
    );
    expect(checked).toBeGreaterThan(50);
  });

  it('replay(log) reproduces the state', () => {
    fc.assert(
      fc.property(seedArb, fc.integer({ min: 0, max: 14 }), (seed, steps) => {
        const { states, actions } = playOut(seed, steps);
        const replayed = rules.replay({ seed, mode: 'standard' }, actions);
        expect(replayed.failedAt).toBeUndefined();
        expect(replayed.state).toEqual(states.at(-1));
      }),
      { numRuns: 60 },
    );
  });

  it('replay stops at the first action that fails, without throwing', () => {
    const { actions, states } = playOut('stale', 5);
    const bad: Action = { t: 'place', from: 'hand', i: 0, x: -5, y: 0, rot: 0 };
    const result = rules.replay({ seed: 'stale', mode: 'standard' }, [
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
  });
});
