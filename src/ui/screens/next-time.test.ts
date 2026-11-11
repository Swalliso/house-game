// The end screen's "Next time" (D-150): which tip a finished run gets, read from its state alone.
// A loss whose house held no set names the Suite and what a set does; a loss with a set and a
// reroll left over says what Reroll is for; anything else gets none, a win included. Never
// "Complete early": the sim finds that completing every milestone early costs a run Wow. And on
// real runs, played by the rules: a house of nothing, and the first job's opening and no more.

import { describe, expect, it } from 'vitest';
import {
  CONTENT,
  HINT_WORDS,
  rules,
  SCORE_LABELS,
  type Action,
  type PieceId,
  type PlaceAction,
  type RunSetup,
  type RunState,
} from '../../rules/index.ts';
import { nextTime, nextTimeKind } from './next-time.ts';

const { firstSeed, firstClient } = CONTENT.balance.jobBoard;
const SETUP: RunSetup = {
  seed: firstSeed,
  clientId: firstClient,
  crewId: 'generalContractor',
  mode: 'standard',
};
const start = rules.newRun(SETUP);

/** A finished run: its screen, the set instances its last tally held, and rerolls left. */
function finished(
  screen: RunState['screen'],
  sets: readonly string[] | null,
  rerolls: { left?: number; bonus?: number } = {},
): RunState {
  return {
    ...start,
    screen,
    lastTally: sets && { points: 10, mult: 150, total: 15, setInstances: sets, specsMet: [] },
    rerollsLeft: rerolls.left ?? 0,
    bonusRerolls: rerolls.bonus ?? 0,
  };
}

const words = (text: string) => text.split(/\s+/).filter(Boolean).length;
const L = SCORE_LABELS;

describe('the next-time tip', () => {
  it('is for a lost run only', () => {
    expect(nextTime(finished('won', []))).toBeNull();
    expect(nextTime(finished('won', ['suite:1,2,3'], { left: 1 }))).toBeNull();
    expect(nextTime(finished('build', []))).toBeNull();
    expect(nextTime(finished('shop', [], { left: 1 }))).toBeNull();
  });

  it('names the Suite and what a set does when the house held no set', () => {
    for (const s of [
      finished('lost', []),
      finished('lost', null),
      finished('lost', [], { left: 1 }),
    ]) {
      expect(nextTimeKind(s)).toBe('set');
    }
    const tip = nextTime(finished('lost', []))!;
    expect(tip.kind).toBe('set');
    // The Suite's recipe as the content has it: the tip names each piece, and says "touching"
    // because the set must be one connected group.
    const suite = CONTENT.sets.suite;
    expect(suite.members).toEqual({ bedroom: 1, bathroom: 1, closet: 1 });
    expect(suite.connected).toBe(true);
    expect(tip.text).toContain(`Build a ${suite.name}:`);
    for (const id of Object.keys(suite.members) as PieceId[]) {
      expect(tip.text).toContain(`a ${CONTENT.pieces[id].name}`);
    }
    expect(tip.text).toContain('touching');
    // The score layers by their labels (D-019).
    expect(tip.text).toContain(
      `A set raises ${L.mult}, which multiplies ${L.points} into ${L.total}.`,
    );
  });

  it('says what Reroll is for when a set held and a reroll was left over', () => {
    const one = nextTime(finished('lost', ['suite:1,2,3'], { left: 1 }))!;
    expect(one.kind).toBe('reroll');
    expect(one.text).toMatch(/^You ended with a reroll to spare\. /);
    expect(one.text).toContain('Reroll it');
    // A bought one kept counts too.
    expect(nextTime(finished('lost', ['suite:1,2,3'], { bonus: 1 }))!.text).toMatch(
      /^You ended with a reroll to spare\. /,
    );
    expect(nextTime(finished('lost', ['suite:1,2,3'], { left: 1, bonus: 2 }))!.text).toMatch(
      /^You ended with 3 rerolls to spare\. /,
    );
  });

  it('says nothing when a set held and every reroll was spent', () => {
    expect(nextTime(finished('lost', ['suite:1,2,3']))).toBeNull();
    expect(nextTime(finished('lost', ['suite:1,2,3', 'jackAndJill:1,4,5']))).toBeNull();
  });

  it('never says to complete early, and keeps to a hint’s length', () => {
    const tips = [
      nextTime(finished('lost', [])),
      nextTime(finished('lost', ['suite:1,2,3'], { left: 1 })),
      nextTime(finished('lost', ['suite:1,2,3'], { left: 2, bonus: 9 })),
    ];
    for (const tip of tips) {
      expect(tip).not.toBeNull();
      expect(tip!.text.toLowerCase()).not.toContain('early');
      expect(words(tip!.text)).toBeLessThanOrEqual(HINT_WORDS);
    }
  });
});

/**
 * Plays a run by the rules to its end: passes on the build screen, after `first` plays. It buys
 * nothing: a crate waiting in the shop (the Housewarming one) is put back, and the shop left.
 */
function playToTheEnd(first: readonly PieceId[] = []): RunState {
  let s = rules.newRun(SETUP);
  for (const id of first) {
    const i = s.hand.findIndex((c) => c.kind === 'piece' && c.id === id);
    const play = rules
      .legalPlays(s)
      .find((p): p is PlaceAction => p.t === 'place' && p.from === 'hand' && p.i === i);
    expect(play, `week ${s.week}: a ${id} to place`).toBeDefined();
    s = rules.apply(s, play!).state;
  }
  for (let step = 0; step < 500 && s.screen !== 'won' && s.screen !== 'lost'; step++) {
    const action: Action =
      s.screen === 'shop'
        ? s.offers?.pick
          ? { t: 'pick', i: -1 }
          : { t: 'leaveShop' }
        : s.screen === 'changeOrder'
          ? { t: 'answerChangeOrder', i: 0 }
          : { t: 'pass' };
    s = rules.apply(s, action).state;
  }
  return s;
}

describe('the next-time tip, on runs played by the rules', () => {
  it('tells a house of nothing to build a set', () => {
    const s = playToTheEnd();
    expect(s.screen).toBe('lost');
    expect(s.house.pieces).toHaveLength(0);
    expect(nextTimeKind(s)).toBe('set');
  });

  it('tells the first job’s opening, built and left, what Reroll is for', () => {
    // The Bedroom, the Bathroom and the Closet make the Suite (first-job.test.ts holds the lot
    // to dealing them), and it holds to the end. No reroll was spent, so the last one is spare.
    const s = playToTheEnd(['bedroom', 'bathroom', 'closet']);
    expect(s.screen).toBe('lost');
    expect(s.lastTally?.setInstances.some((k) => k.startsWith('suite:'))).toBe(true);
    expect(s.rerollsLeft).toBeGreaterThan(0);
    expect(nextTime(s)?.kind).toBe('reroll');
  });
});
