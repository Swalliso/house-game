import { describe, expect, it } from 'vitest';
import type { Action, Content, GameEvent, PlaceAction, RunState } from './index.ts';
import { createRules, IllegalAction } from './run.ts';
import { lotFromRows } from './lot.ts';
import { emptyRows, TEST_CONTENT as C } from './testing.ts';

const rules = createRules(C);

function withTargets(targets: number[]): Content {
  return {
    ...C,
    balance: {
      ...C.balance,
      phases: targets.map((target, i) => ({ name: `Phase ${i + 1}`, target })),
    },
  };
}

/** A run on an empty lot, so placements are easy to reason about. */
function onEmptyLot(r = rules, seed = 'empty'): RunState {
  const s = r.newRun({ seed, crewId: 'generalContractor', mode: 'standard' });
  return { ...s, house: { ...s.house, lot: lotFromRows(emptyRows(12, 12)) } };
}

function deepFreeze<T>(value: T): T {
  if (value && typeof value === 'object' && !Object.isFrozen(value)) {
    Object.freeze(value);
    for (const v of Object.values(value)) deepFreeze(v);
  }
  return value;
}

const types = (events: GameEvent[]) => events.map((e) => e.t);
const PASS: Action = { t: 'pass' };

/** Puts a chosen card in the hand, for tests that need a particular piece. */
function withHand(s: RunState, ...ids: RunState['hand'][number]['id'][]): RunState {
  return { ...s, hand: ids.map((id) => ({ kind: 'piece', id })) };
}

describe('a new run', () => {
  it('starts at week 1 with a hand, from the seed', () => {
    const s = rules.newRun({ seed: 'start', crewId: 'generalContractor', mode: 'standard' });
    expect(s).toMatchObject({ phase: 0, slot: 1, week: 1, draws: 1, score: 0, screen: 'build' });
    expect(s.hand).toHaveLength(3);
    expect(s.house.pieces).toEqual([]);
    expect(rules.newRun({ seed: 'start', crewId: 'generalContractor', mode: 'standard' })).toEqual(
      s,
    );
    expect(
      rules.newRun({ seed: 'other', crewId: 'generalContractor', mode: 'standard' }).house.lot,
    ).not.toEqual(s.house.lot);
  });
});

describe('a week', () => {
  it('pass: tallies, then starts the next week with a new hand', () => {
    const s = onEmptyLot();
    const { state, events } = rules.apply(s, PASS);
    expect(types(events)).toEqual(['tally', 'handDrawn']);
    expect(events[0]).toMatchObject({
      t: 'tally',
      week: 1,
      phase: 0,
      slot: 1,
      passed: true,
      scoreBefore: 0,
      score: 0,
    });
    expect(state).toMatchObject({ slot: 2, week: 2, score: 0, draws: 1 });
    expect(state.hand).toHaveLength(3);
  });

  it('place: the piece earns that same week', () => {
    const s = withHand(onEmptyLot(), 'bedroom', 'lawn', 'kitchen');
    const { state, events } = rules.apply(s, {
      t: 'place',
      from: 'hand',
      i: 0,
      x: 2,
      y: 2,
      rot: 0,
    });
    expect(types(events)).toEqual(['placed', 'tally', 'handDrawn']);
    expect(events[0]).toMatchObject({
      t: 'placed',
      uid: 1,
      defId: 'bedroom',
      x: 2,
      y: 2,
      rot: 0,
      clearedTrees: [],
    });
    expect(state.house.pieces).toEqual([
      { uid: 1, defId: 'bedroom', x: 2, y: 2, rot: 0, placedWeek: 1 },
    ]);
    expect(state.score).toBe(3);
    expect(state.lastTally).toEqual({ points: 3, mult: 100, total: 3, setInstances: [] });
  });

  it('building over Trees removes them', () => {
    const base = withHand(onEmptyLot(), 'bathroom', 'lawn', 'kitchen');
    const s = {
      ...base,
      house: { ...base.house, lot: lotFromRows(['T...', '....', '....', '....']) },
    };
    const { state, events } = rules.apply(s, {
      t: 'place',
      from: 'hand',
      i: 0,
      x: 0,
      y: 0,
      rot: 0,
    });
    expect(events[0]).toMatchObject({ clearedTrees: [{ x: 0, y: 0 }] });
    expect(state.house.lot.terrain[0]).toBe(null);
    expect(s.house.lot.terrain[0]).toBe('tree'); // the input is untouched
  });

  it('refuses illegal plays with a reason', () => {
    const s = withHand(onEmptyLot(), 'bedroom', 'lawn', 'kitchen');
    expect(() => rules.apply(s, { t: 'place', from: 'hand', i: 0, x: 11, y: 0, rot: 0 })).toThrow(
      IllegalAction,
    );
    expect(() => rules.apply(s, { t: 'place', from: 'hand', i: 0, x: 11, y: 0, rot: 0 })).toThrow(
      "That's off the lot.",
    );
    expect(() => rules.apply(s, { t: 'place', from: 'hand', i: 5, x: 0, y: 0, rot: 0 })).toThrow(
      IllegalAction,
    );
    expect(() => rules.apply(s, { t: 'place', from: 'hand', i: 0, x: 0.5, y: 0, rot: 0 })).toThrow(
      IllegalAction,
    );
    expect(() => rules.apply(s, { t: 'shout' } as unknown as Action)).toThrow(IllegalAction);
  });

  it('never mutates its input', () => {
    const s = deepFreeze(withHand(onEmptyLot(), 'bedroom', 'lawn', 'kitchen'));
    const before = JSON.stringify(s);
    rules.apply(s, { t: 'place', from: 'hand', i: 0, x: 2, y: 2, rot: 0 });
    rules.apply(s, PASS);
    rules.preview(s, { t: 'place', from: 'hand', i: 1, x: 5, y: 5, rot: 0 });
    expect(JSON.stringify(s)).toBe(before);
  });

  it('announces a set the week it first holds, not again', () => {
    let s = withHand(onEmptyLot(), 'bedroom', 'bathroom', 'kitchen');
    s = rules.apply(s, { t: 'place', from: 'hand', i: 0, x: 0, y: 0, rot: 0 }).state;
    s = withHand(s, 'bathroom', 'bedroom', 'kitchen');
    s = rules.apply(s, { t: 'place', from: 'hand', i: 0, x: 2, y: 0, rot: 0 }).state;
    s = withHand(s, 'bedroom', 'bathroom', 'kitchen');
    const third = rules.apply(s, { t: 'place', from: 'hand', i: 0, x: 3, y: 0, rot: 0 });
    expect(third.events.filter((e) => e.t === 'setCompleted')).toEqual([
      { t: 'setCompleted', set: 'jackAndJill', key: 'jackAndJill:1,2,3', members: [1, 2, 3] },
    ]);
    const fourth = rules.apply(third.state, PASS);
    expect(fourth.events.some((e) => e.t === 'setCompleted')).toBe(false);
  });
});

describe('milestones', () => {
  it('a missed target at the phase end loses the run once overtime is spent', () => {
    let s = { ...onEmptyLot(), overtimeLeft: 0 };
    s = rules.apply(s, PASS).state;
    const { state, events } = rules.apply(s, PASS);
    expect(types(events)).toEqual(['tally', 'milestone', 'runEnded']);
    expect(events[1]).toEqual({
      t: 'milestone',
      phase: 0,
      name: 'Groundbreaking',
      result: 'failed',
      target: 5,
      score: 0,
      weeksSaved: 0,
      overtimeUsed: 0,
      reward: { budget: 0, score: 0 },
    });
    expect(events[2]).toEqual({
      t: 'runEnded',
      result: 'lost',
      score: 0,
      phase: 0,
      verdict: 'Fixer-Upper',
    });
    expect(state.screen).toBe('lost');
    expect(state.hand).toEqual([]);
    expect(() => rules.apply(state, PASS)).toThrow('The run is over.');
    expect(rules.legalActions(state)).toEqual([]);
  });

  it('a met target moves to the next phase, and the last one wins the run', () => {
    const r = createRules(withTargets([0, 0]));
    let s = onEmptyLot(r);
    s = r.apply(s, PASS).state;
    const end1 = r.apply(s, PASS);
    expect(types(end1.events)).toEqual(['tally', 'milestone', 'handDrawn']);
    expect(end1.events[1]).toMatchObject({ result: 'onTime', phase: 0 });
    expect(end1.state).toMatchObject({
      phase: 1,
      slot: 1,
      week: 3,
      phaseStartScore: 0,
      screen: 'build',
    });
    s = r.apply(end1.state, PASS).state;
    const end2 = r.apply(s, PASS);
    expect(types(end2.events)).toEqual(['tally', 'milestone', 'runEnded']);
    expect(end2.events[2]).toMatchObject({ result: 'won', verdict: 'Dream Home' });
    expect(end2.state).toMatchObject({ screen: 'won', week: 4 });
  });

  it('fires targetReached when the score first crosses the target', () => {
    const r = createRules(withTargets([3, 100]));
    let s = withHand(onEmptyLot(r), 'bedroom', 'lawn', 'kitchen');
    const first = r.apply(s, { t: 'place', from: 'hand', i: 0, x: 4, y: 4, rot: 0 });
    expect(first.events.find((e) => e.t === 'targetReached')).toEqual({
      t: 'targetReached',
      phase: 0,
      target: 3,
      score: 3,
    });
    s = first.state;
    const second = r.apply(s, PASS);
    expect(second.events.some((e) => e.t === 'targetReached')).toBe(false);
    // Phase 2 starts from the score so far, and pace is measured from there.
    expect(second.state).toMatchObject({ phase: 1, phaseStartScore: 6 });
    expect(r.pace(second.state)).toBe((100 - 6) / 2);
  });

  it('pace is what is left of the target spread over the weeks, unrounded', () => {
    const r = createRules(withTargets([7, 30]));
    expect(r.pace(onEmptyLot(r))).toBe(3.5);
  });

  it('pace is never below 1, even once the target is met', () => {
    const r = createRules(withTargets([0, 0]));
    const { events } = r.apply(onEmptyLot(r), PASS);
    expect(events[0]).toMatchObject({ t: 'tally', pace: 1 });
  });
});

describe('legal actions', () => {
  it('lists every distinct legal placement, then pass and the free actions', () => {
    const s = withHand(onEmptyLot(), 'bedroom', 'bathroom', 'lKitchen');
    const actions = rules.legalActions(s);
    const free = actions.filter((a) => a.t !== 'place');
    // A new run: two rerolls (the General Contractor's extra), nothing to demolish yet, and
    // the target isn't met, so no early completion.
    expect(free).toEqual([PASS, { t: 'reroll' }]);
    const per = (i: number) =>
      actions.filter((a): a is PlaceAction => a.t === 'place' && a.i === i).length;
    expect(per(0)).toBe(11 * 11); // a 2×2 has one rotation
    expect(per(1)).toBe(12 * 12);
    expect(per(2)).toBe(4 * 11 * 11); // an L has four
    for (const a of actions.slice(0, 50)) expect(() => rules.apply(s, a)).not.toThrow();
    expect(rules.cardFits(s, 0)).toBe(true);
    expect(rules.cardFits(s, 7)).toBe(false);
  });
});
