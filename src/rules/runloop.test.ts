// The M2 run loop (implementation-plan.md §4, Transitions; Appendix A · M2): overtime, early
// completion with fast-forward, auto-complete, rerolls, the free redraw, demolitions,
// milestone rewards, the forecast, piece timers, the debug cheats, and the order of events.
// Rules tests use TEST_CONTENT (src/rules/testing.ts), with balance overrides where a test
// needs other targets or a longer phase.

import { describe, expect, it } from 'vitest';
import type {
  Action,
  Balance,
  Cell,
  Content,
  GameEvent,
  PieceId,
  PlaceAction,
  Rot,
  RunState,
} from './index.ts';
import { createRules, IllegalAction, type Rules } from './run.ts';
import { drawHand } from './draw.ts';
import { lotFromRows } from './lot.ts';
import { roundHalfUp } from './scoring.ts';
import {
  emptyRows,
  houseFrom,
  setup,
  TEST_CONTENT as C,
  withPieces,
  type Placement,
} from './testing.ts';

const rules = createRules(C);

/** TEST_CONTENT with these phase targets, and optionally a different phase length. */
function content(targets: number[], weeksPerPhase = 2, extra: Partial<Balance> = {}): Content {
  return {
    ...C,
    balance: {
      ...C.balance,
      ...extra,
      weeksPerPhase,
      phases: targets.map((target, i) => ({ name: `Phase ${i + 1}`, target })),
    },
  };
}

/** A run on an empty lot, so placements are easy to reason about. */
function onEmptyLot(r: Rules = rules, seed = 'empty'): RunState {
  const s = r.newRun(setup(seed));
  return { ...s, house: { ...s.house, lot: lotFromRows(emptyRows(12, 12)) } };
}

/** Puts chosen cards in the hand, for tests that need a particular piece. */
function withHand(s: RunState, ...ids: PieceId[]): RunState {
  return { ...s, hand: ids.map((id) => ({ kind: 'piece', id })) };
}

/** Replaces the house with one built from ASCII rows and placements (placed in week 1). */
function withHouse(s: RunState, rows: readonly string[], placements: Placement[] = []): RunState {
  return { ...s, house: houseFrom(C, rows, placements) };
}

/**
 * A Jack-and-Jill on an empty lot: two Bedrooms (3 each) and the Bathroom between them (3),
 * plus the set's 10 Points and +50% Mult: (9 + 10) × 1.5 = 28.5 → 29 a week.
 */
const JACK_AND_JILL: Placement[] = [
  ['bedroom', 0, 0],
  ['bathroom', 2, 0],
  ['bedroom', 3, 0],
];
const JJ_WEEKLY = 29;
function jackAndJillRun(r: Rules): RunState {
  return withHouse(onEmptyLot(r), emptyRows(12, 12), JACK_AND_JILL);
}

const place = (i: number, x: number, y: number, rot: Rot = 0): PlaceAction => ({
  t: 'place',
  from: 'hand',
  i,
  x,
  y,
  rot,
});
const PASS: Action = { t: 'pass' };
const REROLL: Action = { t: 'reroll' };
const COMPLETE_EARLY: Action = { t: 'completeEarly' };
const LEAVE: Action = { t: 'leaveShop' };

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

const byPos = (cells: readonly Cell[]) => [...cells].sort((a, b) => a.y - b.y || a.x - b.x);

/** The early bonus as §4 states it: roundHalfUp(earnings × scorePct × weeksSaved × earlyRewardPct / 10000). */
function expectedBonus(earnings: number, weeksSaved: number, scorePct = 10, rewardPct = 100) {
  return {
    score: roundHalfUp(earnings * scorePct * weeksSaved * rewardPct, 10000),
    budget: roundHalfUp(2 * weeksSaved * rewardPct, 100),
  };
}

// ---------------------------------------------------------------------------------------

describe('overtime', () => {
  it('a target missed at the phase’s last week starts an overtime week with its own draw key', () => {
    const seed = 'overtime';
    let s = onEmptyLot(rules, seed); // target 5, 2 weeks a phase, 2 overtime weeks a run
    expect(s).toMatchObject({ overtimeLeft: 2, overtimeWeek: 0, rerollsLeft: 2 });
    s = rules.apply(s, PASS).state;
    const { state, events } = rules.apply(s, PASS);
    expect(types(events)).toEqual(['tally', 'overtimeUsed', 'handDrawn']);
    expect(events[1]).toEqual({
      t: 'overtimeUsed',
      phase: 0,
      overtimeLeft: 1,
      target: 5,
      score: 0,
    });
    const hand = drawHand(C, seed, 0, 'ot1', 0, 3);
    expect(events[2]).toEqual({
      t: 'handDrawn',
      phase: 0,
      slot: 3,
      overtimeWeek: 1,
      hand,
      free: false,
      reroll: false,
    });
    expect(state).toMatchObject({
      phase: 0,
      slot: 3,
      week: 3,
      overtimeWeek: 1,
      overtimeLeft: 1,
      draws: 1,
      rerollsLeft: 2,
      screen: 'build',
      milestones: [],
    });
    expect(state.hand).toEqual(hand);
    expect(rules.weeksLeft(state)).toBe(1);
  });

  it('an overtime week can’t be completed early, even with the target met', () => {
    let s = onEmptyLot();
    s = applyAll(rules, s, [PASS, PASS]).state;
    expect(s.overtimeWeek).toBe(1);
    const met = { ...s, score: 50 };
    const offer = rules.canCompleteEarly(met);
    expect(offer).toMatchObject({
      ok: false,
      reason: 'An overtime week can’t be completed early.',
      weeksSaved: 0,
    });
    expect(() => rules.apply(met, COMPLETE_EARLY)).toThrow(IllegalAction);
    expect(() => rules.apply(met, COMPLETE_EARLY)).toThrow(
      'An overtime week can’t be completed early.',
    );
    expect(rules.legalActions(met)).not.toContainEqual(COMPLETE_EARLY);
  });

  it('meeting the target in overtime resolves as “overtime”; the next phase gets its full weeks', () => {
    const r = createRules(content([3, 100]));
    let s = applyAll(r, onEmptyLot(r), [PASS, PASS]).state;
    expect(s).toMatchObject({ overtimeWeek: 1, slot: 3, week: 3 });
    s = withHand(s, 'bedroom', 'lawn', 'kitchen');
    const met = r.apply(s, place(0, 2, 2)); // the Bedroom earns 3
    expect(types(met.events)).toEqual([
      'placed',
      'tally',
      'targetReached',
      'milestone',
      'shopOpened',
    ]);
    const record = {
      phase: 0,
      result: 'overtime',
      target: 3,
      score: 3,
      weeksSaved: 0,
      overtimeUsed: 1,
      reward: { budget: 3, score: 0, interest: 0 },
    };
    expect(met.events[3]).toEqual({ t: 'milestone', name: 'Phase 1', ...record });
    expect(met.state).toMatchObject({ screen: 'shop', phase: 1, slot: 1, week: 4, hand: [] });
    // Leaving the shop without buying pays the skip reward, then draws the first hand.
    const { state, events } = r.apply(met.state, LEAVE);
    expect(types(events)).toEqual(['shopClosed', 'handDrawn']);
    expect(events[0]).toMatchObject({ skipReward: 1, budgetBefore: 3, budget: 4 });
    expect(events[1]).toEqual({
      t: 'handDrawn',
      phase: 1,
      slot: 1,
      overtimeWeek: 0,
      hand: drawHand(r.content, 'empty', 1, '1', 0, 3),
      free: false,
      reroll: false,
    });
    expect(state).toMatchObject({
      phase: 1,
      slot: 1,
      overtimeWeek: 0,
      week: 4,
      overtimeLeft: 1, // overtime is per run, not per phase
      phaseStartScore: 3,
      score: 3,
      budget: 3 + 1,
      rerollsLeft: 2,
      screen: 'build',
    });
    expect(state.milestones).toEqual([record]);
    expect(r.weeksLeft(state)).toBe(2);

    // Phase 2 runs its 2 weeks in full, then takes the run's last overtime week, then is lost.
    const week1 = r.apply(state, PASS);
    expect(types(week1.events)).toEqual(['tally', 'handDrawn']);
    expect(week1.state).toMatchObject({ phase: 1, slot: 2, week: 5, score: 6 });
    const week2 = r.apply(week1.state, PASS);
    expect(types(week2.events)).toEqual(['tally', 'overtimeUsed', 'handDrawn']);
    expect(week2.events[2]).toMatchObject({
      phase: 1,
      overtimeWeek: 1,
      hand: drawHand(r.content, 'empty', 1, 'ot1', 0, 3),
    });
    expect(week2.state).toMatchObject({ overtimeWeek: 1, overtimeLeft: 0, slot: 3, week: 6 });
    const lost = r.apply(week2.state, PASS);
    expect(types(lost.events)).toEqual(['tally', 'milestone', 'runEnded']);
    expect(lost.events[1]).toMatchObject({ phase: 1, result: 'failed', overtimeUsed: 1 });
    expect(lost.state.milestones.map((m) => m.result)).toEqual(['overtime', 'failed']);
  });

  it('missing the target after the last overtime week loses the run', () => {
    let s = onEmptyLot(rules, 'ot-loss');
    s = applyAll(rules, s, [PASS, PASS]).state; // overtime week 1
    const ot2 = rules.apply(s, PASS);
    expect(types(ot2.events)).toEqual(['tally', 'overtimeUsed', 'handDrawn']);
    expect(ot2.events[1]).toMatchObject({ overtimeLeft: 0 });
    expect(ot2.events[2]).toMatchObject({
      slot: 4,
      overtimeWeek: 2,
      hand: drawHand(C, 'ot-loss', 0, 'ot2', 0, 3),
    });
    expect(ot2.state).toMatchObject({ overtimeWeek: 2, overtimeLeft: 0, slot: 4, week: 4 });

    const { state, events } = rules.apply(ot2.state, PASS);
    expect(types(events)).toEqual(['tally', 'milestone', 'runEnded']);
    const record = {
      phase: 0,
      result: 'failed',
      target: 5,
      score: 0,
      weeksSaved: 0,
      overtimeUsed: 2,
      reward: { budget: 0, score: 0, interest: 0 },
    };
    expect(events[1]).toEqual({ t: 'milestone', name: 'Groundbreaking', ...record });
    expect(events[2]).toEqual({
      t: 'runEnded',
      result: 'lost',
      score: 0,
      phase: 0,
      verdict: 'Fixer-Upper',
    });
    expect(state).toMatchObject({ screen: 'lost', week: 4, budget: 0, hand: [] });
    expect(state.milestones).toEqual([record]);
    expect(rules.legalActions(state)).toEqual([]);
  });

  it('an overtime week uses the phase’s remaining rerolls, keyed by its own slot', () => {
    let s = onEmptyLot(rules, 'ot-reroll');
    s = applyAll(rules, s, [REROLL, PASS, PASS]).state;
    expect(s).toMatchObject({ overtimeWeek: 1, rerollsLeft: 1, draws: 1 });
    const { state, events } = rules.apply(s, REROLL);
    expect(events).toEqual([
      {
        t: 'handDrawn',
        phase: 0,
        slot: 3,
        overtimeWeek: 1,
        hand: drawHand(C, 'ot-reroll', 0, 'ot1', 1, 3),
        free: false,
        reroll: true,
      },
    ]);
    expect(state).toMatchObject({ rerollsLeft: 0, draws: 2 });
  });
});

// ---------------------------------------------------------------------------------------

describe('early completion', () => {
  it('a manual completion mid-week saves this week too, fast-forwards, and pays the bonus', () => {
    const r = createRules(content([20, 1000], 4));
    let s = jackAndJillRun(r);
    expect(r.currentTally(s).total).toBe(JJ_WEEKLY);
    expect(r.canCompleteEarly(s)).toMatchObject({ ok: false, reason: 'Reach the target first.' });
    expect(() => r.apply(s, COMPLETE_EARLY)).toThrow('Reach the target first.');
    expect(r.legalActions(s)).not.toContainEqual(COMPLETE_EARLY);

    s = r.apply(s, PASS).state; // week 1: 29 ≥ 20
    expect(s).toMatchObject({ slot: 2, week: 2, score: 29 });
    // Weeks 2, 3, and 4 are saved: 29 × 10% × 3 = 8.7 → 9 Wow, and 2 × 3 budget.
    const bonus = { score: 9, budget: 6 };
    expect(expectedBonus(29, 3)).toEqual(bonus);
    expect(r.canCompleteEarly(s)).toEqual({ ok: true, weeksSaved: 3, bonus });
    expect(r.legalActions(s)).toContainEqual(COMPLETE_EARLY);

    const { state, events } = applyAll(r, s, [COMPLETE_EARLY, LEAVE]);
    expect(types(events)).toEqual([
      'tally',
      'tally',
      'tally',
      'milestone',
      'shopOpened',
      'shopClosed',
      'handDrawn',
    ]);
    const tallies = eventsOf(events, 'tally');
    expect(tallies.map((t) => [t.week, t.slot, t.overtimeWeek, t.fastForward, t.passed])).toEqual([
      [2, 2, 0, true, false],
      [3, 3, 0, true, false],
      [4, 4, 0, true, false],
    ]);
    expect(tallies.map((t) => [t.scoreBefore, t.score])).toEqual([
      [29, 58],
      [58, 87],
      [87, 116],
    ]);
    const record = {
      phase: 0,
      result: 'early',
      target: 20,
      score: 116 + 9,
      weeksSaved: 3,
      overtimeUsed: 0,
      reward: { budget: 3 + 6, score: 9, interest: 0 },
    };
    expect(events[3]).toEqual({ t: 'milestone', name: 'Phase 1', ...record });
    expect(events[5]).toMatchObject({ t: 'shopClosed', skipReward: 1, budget: 9 + 1 });
    expect(events[6]).toMatchObject({
      t: 'handDrawn',
      phase: 1,
      slot: 1,
      overtimeWeek: 0,
      free: false,
      reroll: false,
    });
    expect(state).toMatchObject({
      phase: 1,
      slot: 1,
      week: 5,
      score: 125,
      phaseStartScore: 125,
      budget: 9 + 1,
      milestonesEarly: 1,
      draws: 1,
    });
    expect(state.milestones).toEqual([record]);
  });

  it('on the phase’s last week, a manual completion saves just that week', () => {
    const r = createRules(content([3, 1000]));
    let s = withHand(onEmptyLot(r), 'bedroom', 'lawn', 'kitchen');
    s = r.apply(s, place(0, 2, 2)).state; // 3
    expect(s.slot).toBe(2);
    // 3 × 10% × 1 = 0.3 → 0 Wow; 2 budget.
    expect(r.canCompleteEarly(s)).toEqual({
      ok: true,
      weeksSaved: 1,
      bonus: { score: 0, budget: 2 },
    });
    const { state, events } = r.apply(s, COMPLETE_EARLY);
    expect(types(events)).toEqual(['tally', 'milestone', 'shopOpened']);
    expect(events[0]).toMatchObject({ week: 2, slot: 2, fastForward: true, passed: false });
    expect(events[1]).toMatchObject({
      result: 'early',
      weeksSaved: 1,
      score: 6,
      reward: { budget: 5, score: 0 },
    });
    expect(state).toMatchObject({ phase: 1, week: 3, milestonesEarly: 1, screen: 'shop' });
  });

  it('the bonus counts only this phase’s earnings so far, not the fast-forwarded weeks', () => {
    // A Home Office: +2 a week, and 1 budget every 2nd week of its life.
    const r = createRules(content([0, 1000], 6));
    const s = withHouse(onEmptyLot(r), emptyRows(12, 12), [['homeOffice', 0, 0]]);
    // Week 1, nothing tallied yet: all 6 weeks are saved, and this phase has earned nothing.
    expect(r.canCompleteEarly(s)).toEqual({
      ok: true,
      weeksSaved: 6,
      bonus: { score: 0, budget: 12 },
    });
    const { state, events } = r.apply(s, COMPLETE_EARLY);
    const tallies = eventsOf(events, 'tally');
    expect(tallies.map((t) => t.week)).toEqual([1, 2, 3, 4, 5, 6]);
    expect(tallies.every((t) => t.fastForward && !t.passed)).toBe(true);
    // Pieces earn and timers tick: +2 a week, budget in weeks 2, 4, and 6.
    expect(tallies.map((t) => t.tally.budget)).toEqual([0, 1, 0, 1, 0, 1]);
    expect(eventsOf(events, 'milestone')[0]).toMatchObject({
      result: 'early',
      weeksSaved: 6,
      score: 12,
      reward: { budget: 3 + 12, score: 0 },
    });
    expect(state).toMatchObject({ score: 12, budget: 3 + 3 + 12, phaseStartScore: 12 });
  });

  it('earlyRewardPct scales both halves of the bonus', () => {
    const base = content([20, 1000], 4);
    const doubled: Content = {
      ...base,
      crews: {
        ...base.crews,
        generalContractor: {
          ...base.crews.generalContractor,
          modifiers: [
            ...base.crews.generalContractor.modifiers,
            { kind: 'rule', key: 'earlyRewardPct', pct: 100 },
          ],
        },
      },
    };
    const r = createRules(doubled);
    const s = r.apply(jackAndJillRun(r), PASS).state;
    expect(r.rule(s, 'earlyRewardPct')).toBe(200);
    // 29 × 10% × 3 × 2 = 17.4 → 17 Wow; 2 × 3 × 2 = 12 budget.
    expect(r.canCompleteEarly(s)).toEqual({
      ok: true,
      weeksSaved: 3,
      bonus: { score: 17, budget: 12 },
    });
    expect(expectedBonus(29, 3, 10, 200)).toEqual({ score: 17, budget: 12 });
  });

  it('no hands are drawn while fast-forwarding, and a Sapling still becomes a Tree on time', () => {
    const r = createRules(content([1, 1000], 6));
    let s = withHand(onEmptyLot(r), 'sapling', 'lawn', 'kitchen');
    s = r.apply(s, place(0, 5, 5)).state; // week 1: the Sapling earns 1
    expect(s).toMatchObject({ slot: 2, week: 2, score: 1 });
    const { state, events } = applyAll(r, s, [COMPLETE_EARLY, LEAVE]); // saves weeks 2–6
    expect(types(events)).toEqual([
      'tally',
      'tally',
      'tally',
      'transformed',
      'tally',
      'tally',
      'milestone',
      'shopOpened',
      'shopClosed',
      'handDrawn',
    ]);
    // Placed in week 1 with afterWeeks 4: it becomes a Tree at the start of week 5.
    expect(events[3]).toEqual({
      t: 'transformed',
      uid: 1,
      defId: 'sapling',
      into: { feature: 'tree' },
      cells: [{ x: 5, y: 5 }],
    });
    const tallies = eventsOf(events, 'tally');
    expect(tallies.map((t) => [t.week, t.tally.total])).toEqual([
      [2, 1],
      [3, 1],
      [4, 1],
      [5, 0],
      [6, 0],
    ]);
    // 1 × 10% × 5 = 0.5, rounded half up to 1.
    expect(events[6]).toMatchObject({
      result: 'early',
      weeksSaved: 5,
      score: 4 + 1,
      reward: { budget: 3 + 10, score: 1 },
    });
    expect(eventsOf(events, 'handDrawn')).toHaveLength(1);
    expect(events[9]).toMatchObject({ phase: 1, slot: 1 });
    expect(state.house.pieces).toEqual([]);
    expect(state.house.lot.terrain[5 * 12 + 5]).toBe('tree');
  });

  it('completing the last phase early wins the run', () => {
    const r = createRules(content([20, 50], 4));
    let s = applyAll(r, jackAndJillRun(r), [PASS, COMPLETE_EARLY, LEAVE]).state;
    expect(s).toMatchObject({ phase: 1, slot: 1, week: 5, score: 125, phaseStartScore: 125 });
    // Already over the next target, but this phase has earned nothing yet.
    expect(r.canCompleteEarly(s)).toEqual({
      ok: true,
      weeksSaved: 4,
      bonus: { score: 0, budget: 8 },
    });
    s = r.apply(s, PASS).state; // 154
    expect(r.canCompleteEarly(s)).toEqual({
      ok: true,
      weeksSaved: 3,
      bonus: { score: 9, budget: 6 },
    });
    const { state, events } = r.apply(s, COMPLETE_EARLY);
    expect(types(events)).toEqual(['tally', 'tally', 'tally', 'milestone', 'runEnded']);
    const final = 154 + 3 * JJ_WEEKLY + 9;
    expect(events[3]).toMatchObject({
      phase: 1,
      result: 'early',
      weeksSaved: 3,
      score: final,
      reward: { budget: 9, score: 9 },
    });
    expect(events[4]).toEqual({
      t: 'runEnded',
      result: 'won',
      score: final,
      phase: 1,
      verdict: 'Dream Home',
    });
    expect(state).toMatchObject({
      screen: 'won',
      score: final,
      week: 8,
      milestonesEarly: 2,
      hand: [],
    });
    expect(state.milestones.map((m) => m.result)).toEqual(['early', 'early']);
    expect(() => r.apply(state, PASS)).toThrow('The run is over.');
    expect(r.canCompleteEarly(state)).toMatchObject({ ok: false, reason: 'The run is over.' });
    expect(() => r.apply(state, { t: 'setAutoComplete', on: true })).toThrow('The run is over.');
  });
});

// ---------------------------------------------------------------------------------------

describe('auto-complete', () => {
  it('is off by default: a target met mid-phase just carries on', () => {
    const r = createRules(content([20, 1000], 4));
    const s = jackAndJillRun(r);
    expect(s.autoComplete).toBe(false);
    const { state, events } = r.apply(s, PASS);
    expect(types(events)).toEqual(['tally', 'setCompleted', 'targetReached', 'handDrawn']);
    expect(state).toMatchObject({ phase: 0, slot: 2, week: 2, milestonesEarly: 0 });
  });

  it('once on, the tally that meets the target with weeks left completes the milestone early', () => {
    const r = createRules(content([20, 1000], 4));
    const s = jackAndJillRun(r);
    const on = r.apply(s, { t: 'setAutoComplete', on: true });
    // A free action: nothing tallies, the week goes on.
    expect(on.events).toEqual([]);
    expect(on.state).toMatchObject({ autoComplete: true, slot: 1, week: 1, score: 0, draws: 1 });
    expect(on.state.hand).toEqual(s.hand);

    const { state, events } = r.apply(on.state, PASS);
    expect(types(events)).toEqual([
      'tally',
      'setCompleted',
      'targetReached',
      'tally',
      'tally',
      'tally',
      'milestone',
      'shopOpened',
    ]);
    // The week just tallied isn't saved; weeks 2–4 are.
    const tallies = eventsOf(events, 'tally');
    expect(tallies.map((t) => [t.week, t.fastForward, t.passed])).toEqual([
      [1, false, true],
      [2, true, false],
      [3, true, false],
      [4, true, false],
    ]);
    expect(events[6]).toMatchObject({
      t: 'milestone',
      result: 'early',
      weeksSaved: 3,
      score: 4 * JJ_WEEKLY + 9,
      reward: { budget: 3 + 6, score: 9 },
    });
    expect(state).toMatchObject({
      phase: 1,
      slot: 1,
      week: 5,
      milestonesEarly: 1,
      autoComplete: true,
      screen: 'shop',
    });
  });

  it('doesn’t fire on the phase’s last week: that milestone is on time', () => {
    const r = createRules(content([40, 1000]));
    let s = { ...jackAndJillRun(r), autoComplete: true };
    s = r.apply(s, PASS).state; // 29 < 40
    expect(s).toMatchObject({ phase: 0, slot: 2 });
    const { state, events } = r.apply(s, PASS); // 58 ≥ 40
    expect(types(events)).toEqual(['tally', 'targetReached', 'milestone', 'shopOpened']);
    expect(events[2]).toMatchObject({
      result: 'onTime',
      weeksSaved: 0,
      reward: { budget: 3, score: 0 },
    });
    expect(state.milestonesEarly).toBe(0);
  });

  it('doesn’t fire in an overtime week: that milestone is overtime', () => {
    const r = createRules(content([70, 1000]));
    const s = { ...jackAndJillRun(r), autoComplete: true };
    const { events } = applyAll(r, s, [PASS, PASS, PASS]); // 29, 58 (overtime), 87
    expect(eventsOf(events, 'milestone')).toEqual([
      expect.objectContaining({ result: 'overtime', weeksSaved: 0, overtimeUsed: 1 }),
    ]);
    expect(eventsOf(events, 'tally').some((t) => t.fastForward)).toBe(false);
  });

  it('auto-completing the last phase wins the run', () => {
    const r = createRules(content([20, 50], 4));
    const s = { ...jackAndJillRun(r), autoComplete: true };
    const first = applyAll(r, s, [PASS, LEAVE]);
    expect(first.state).toMatchObject({ phase: 1, score: 125, screen: 'build' });
    const { state, events } = r.apply(first.state, PASS);
    expect(types(events)).toEqual(['tally', 'tally', 'tally', 'tally', 'milestone', 'runEnded']);
    expect(events[4]).toMatchObject({ phase: 1, result: 'early', weeksSaved: 3 });
    expect(events[5]).toMatchObject({ result: 'won' });
    expect(state.screen).toBe('won');
  });

  it('refuses a toggle that isn’t a boolean', () => {
    const s = onEmptyLot();
    expect(() => rules.apply(s, { t: 'setAutoComplete', on: 'yes' } as unknown as Action)).toThrow(
      'Bad toggle.',
    );
  });
});

// ---------------------------------------------------------------------------------------

describe('rerolls', () => {
  it('the General Contractor gets 2 a phase; each draws the next key, then they run out', () => {
    const seed = 'reroll';
    const s = onEmptyLot(rules, seed);
    expect(rules.rule(s, 'rerollsPerPhase')).toBe(2);
    expect(s).toMatchObject({ rerollsLeft: 2, draws: 1 });
    expect(s.hand).toEqual(drawHand(C, seed, 0, '1', 0, 3));
    expect(rules.canReroll(s)).toEqual({ ok: true });
    expect(rules.legalActions(s)).toContainEqual(REROLL);

    const one = rules.apply(s, REROLL);
    const hand1 = drawHand(C, seed, 0, '1', 1, 3);
    expect(one.events).toEqual([
      {
        t: 'handDrawn',
        phase: 0,
        slot: 1,
        overtimeWeek: 0,
        hand: hand1,
        free: false,
        reroll: true,
      },
    ]);
    expect(one.state).toMatchObject({ rerollsLeft: 1, draws: 2, slot: 1, week: 1, score: 0 });
    expect(one.state.hand).toEqual(hand1);

    const two = rules.apply(one.state, REROLL);
    expect(two.state.hand).toEqual(drawHand(C, seed, 0, '1', 2, 3));
    expect(two.state).toMatchObject({ rerollsLeft: 0, draws: 3 });

    expect(rules.canReroll(two.state)).toEqual({
      ok: false,
      reason: 'No rerolls left this phase.',
    });
    expect(() => rules.apply(two.state, REROLL)).toThrow(IllegalAction);
    expect(() => rules.apply(two.state, REROLL)).toThrow('No rerolls left this phase.');
    expect(rules.legalActions(two.state)).not.toContainEqual(REROLL);
  });

  it('last the whole phase, reset at the next, and don’t carry over', () => {
    const r = createRules(content([0, 0, 0]));
    let s = r.apply(onEmptyLot(r), REROLL).state;
    expect(s.rerollsLeft).toBe(1);
    s = r.apply(s, PASS).state;
    expect(s).toMatchObject({ phase: 0, slot: 2, rerollsLeft: 1, draws: 1 });
    s = applyAll(r, s, [PASS, LEAVE]).state;
    expect(s).toMatchObject({ phase: 1, slot: 1, rerollsLeft: 2 });
    // Unused rerolls don't carry over either.
    s = applyAll(r, s, [PASS, PASS, LEAVE]).state;
    expect(s).toMatchObject({ phase: 2, rerollsLeft: 2 });
  });
});

// ---------------------------------------------------------------------------------------

describe('the free redraw', () => {
  // Boulders everywhere except nine lone tiles: only 1×1 pieces fit.
  const ISLANDS = ['.B.B.', 'BBBBB', '.B.B.', 'BBBBB', '.B.B.'];
  const ONE_TILE = new Set<PieceId>(['bathroom', 'closet', 'sapling', 'flowerBed', 'doghouse']);
  const fitsIslands = (n: number, seed: string) =>
    drawHand(C, seed, 0, '2', n, 3).some((c) => c.kind === 'piece' && ONE_TILE.has(c.id));

  function findSeed(ok: (seed: string) => boolean): string {
    for (let i = 0; i < 2000; i++) if (ok(`redraw-${i}`)) return `redraw-${i}`;
    throw new Error('no seed found');
  }

  /** A run on the islands lot, about to start week 2. */
  function onIslands(seed: string, rows = ISLANDS): RunState {
    const s = rules.newRun(setup(seed));
    return { ...s, house: { ...s.house, lot: lotFromRows(rows) } };
  }

  it('when nothing in the week’s first hand fits anywhere, there’s one free redraw', () => {
    const seed = findSeed((sd) => !fitsIslands(0, sd));
    const { state, events } = rules.apply(onIslands(seed), PASS);
    const first = drawHand(C, seed, 0, '2', 0, 3);
    const redraw = drawHand(C, seed, 0, '2', 1, 3);
    const drawn = { t: 'handDrawn', phase: 0, slot: 2, overtimeWeek: 0, reroll: false };
    expect(events.slice(1)).toEqual([
      { ...drawn, hand: first, free: false },
      { ...drawn, hand: redraw, free: true },
    ]);
    // It doesn't cost a reroll.
    expect(state).toMatchObject({ draws: 2, freeRedrawUsed: true, rerollsLeft: 2 });
    expect(state.hand).toEqual(redraw);
    // A manual reroll afterwards draws the week's next key.
    const reroll = rules.apply(state, REROLL);
    expect(reroll.state.hand).toEqual(drawHand(C, seed, 0, '2', 2, 3));
    expect(reroll.state).toMatchObject({ draws: 3, rerollsLeft: 1 });
  });

  it('no redraw when any card in the first hand fits', () => {
    const seed = findSeed((sd) => fitsIslands(0, sd));
    const { state, events } = rules.apply(onIslands(seed), PASS);
    expect(types(events)).toEqual(['tally', 'handDrawn']);
    expect(state).toMatchObject({ draws: 1, freeRedrawUsed: false });
  });

  it('is at most one a week, and comes again the next week', () => {
    // Nothing fits on an all-boulder lot, so neither hand fits.
    const r = createRules(content([1000, 1000], 4));
    let s = r.newRun(setup('boulders'));
    s = { ...s, house: { ...s.house, lot: lotFromRows(['BBB', 'BBB', 'BBB']) } };
    const week2 = r.apply(s, PASS);
    expect(eventsOf(week2.events, 'handDrawn').map((e) => e.free)).toEqual([false, true]);
    expect(week2.state).toMatchObject({ slot: 2, draws: 2, freeRedrawUsed: true });
    const week3 = r.apply(week2.state, PASS);
    expect(eventsOf(week3.events, 'handDrawn').map((e) => e.free)).toEqual([false, true]);
    expect(week3.state).toMatchObject({ slot: 3, draws: 2, freeRedrawUsed: true });
  });

  it('never follows a manual reroll, even when nothing in the new hand fits', () => {
    const seed = findSeed((sd) => fitsIslands(0, sd) && !fitsIslands(1, sd));
    const s = rules.apply(onIslands(seed), PASS).state;
    expect(s).toMatchObject({ slot: 2, draws: 1, freeRedrawUsed: false });
    const { state, events } = rules.apply(s, REROLL);
    expect(events).toEqual([
      {
        t: 'handDrawn',
        phase: 0,
        slot: 2,
        overtimeWeek: 0,
        hand: drawHand(C, seed, 0, '2', 1, 3),
        free: false,
        reroll: true,
      },
    ]);
    expect(state.hand.some((_, i) => rules.cardFits(state, i))).toBe(false);
    expect(state).toMatchObject({ draws: 2, freeRedrawUsed: false, rerollsLeft: 1 });
  });
});

// ---------------------------------------------------------------------------------------

describe('demolitions', () => {
  it('removes a whole piece with no refund; the score stays and the week goes on', () => {
    let s = withHand(onEmptyLot(), 'bedroom', 'lawn', 'kitchen');
    s = rules.apply(s, place(0, 2, 2)).state; // 3
    expect(s).toMatchObject({ score: 3, slot: 2, demolitionsLeft: 2 });
    const { state, events } = rules.apply(s, { t: 'demolish', x: 3, y: 3 });
    expect(types(events)).toEqual(['demolished']);
    const ev = eventsOf(events, 'demolished')[0]!;
    expect(ev).toMatchObject({ uid: 1, defId: 'bedroom', demolitionsLeft: 1 });
    expect(byPos(ev.cells)).toEqual([
      { x: 2, y: 2 },
      { x: 3, y: 2 },
      { x: 2, y: 3 },
      { x: 3, y: 3 },
    ]);
    expect(state.house.pieces).toEqual([]);
    expect(state).toMatchObject({ score: 3, budget: 0, slot: 2, week: 2, demolitionsLeft: 1 });
    expect(state.hand).toEqual(s.hand);
    // From now on it earns nothing.
    expect(eventsOf(rules.apply(state, PASS).events, 'tally')[0]!.tally.total).toBe(0);
  });

  it('counts down 2 → 1 → 0 for the run, then is refused; a boulder can go', () => {
    const r = createRules(content([0, 0]));
    let s = withHouse(onEmptyLot(r), ['BBB.', '....', '....']);
    expect(r.legalActions(s)).toContainEqual({ t: 'demolish', x: 0, y: 0 });
    const first = r.apply(s, { t: 'demolish', x: 0, y: 0 });
    expect(first.events).toEqual([
      { t: 'demolished', feature: 'boulder', cells: [{ x: 0, y: 0 }], demolitionsLeft: 1 },
    ]);
    expect(first.state.house.lot.terrain[0]).toBe(null);
    // Demolitions are per run: a new phase doesn't restore them.
    s = applyAll(r, first.state, [PASS, PASS, LEAVE]).state;
    expect(s).toMatchObject({ phase: 1, demolitionsLeft: 1 });
    s = r.apply(s, { t: 'demolish', x: 1, y: 0 }).state;
    expect(s.demolitionsLeft).toBe(0);
    expect(r.legalActions(s).some((a) => a.t === 'demolish')).toBe(false);
    expect(() => r.apply(s, { t: 'demolish', x: 2, y: 0 })).toThrow('No demolitions left.');
    expect(r.previewDemolish(s, 2, 0)).toMatchObject({
      legal: false,
      reason: 'No demolitions left.',
      target: { feature: 'boulder' },
    });
  });

  it('water and Trees can’t be demolished, and there must be something there', () => {
    const s = withHouse(onEmptyLot(), ['PCT.', '....']);
    const refused: [number, number, string][] = [
      [0, 0, "Water can't be demolished."],
      [1, 0, "Water can't be demolished."],
      [2, 0, 'Trees can’t be demolished: build over them instead.'],
      [3, 0, "There's nothing there to demolish."],
      [9, 9, "That's off the lot."],
    ];
    for (const [x, y, reason] of refused) {
      expect(() => rules.apply(s, { t: 'demolish', x, y })).toThrow(reason);
      expect(rules.previewDemolish(s, x, y)).toMatchObject({ legal: false, reason, delta: 0 });
    }
    expect(rules.previewDemolish(s, 0, 0).target).toEqual({ feature: 'pond' });
    expect(rules.previewDemolish(s, 2, 0).target).toEqual({ feature: 'tree' });
    expect(rules.legalActions(s).some((a) => a.t === 'demolish')).toBe(false);
  });

  it('won’t split the house, but the last indoor piece can go', () => {
    // Bedroom · Closet · Bedroom in a row: the Closet holds the house together.
    const s = withHouse(onEmptyLot(), emptyRows(8, 4), [
      ['bedroom', 0, 0],
      ['closet', 2, 0],
      ['bedroom', 3, 0],
    ]);
    expect(() => rules.apply(s, { t: 'demolish', x: 2, y: 0 })).toThrow(
      'This would split the house.',
    );
    expect(rules.previewDemolish(s, 2, 0)).toMatchObject({
      legal: false,
      reason: 'This would split the house.',
      target: { uid: 2, defId: 'closet' },
      cells: [{ x: 2, y: 0 }],
      delta: 0,
    });
    const demolitions = rules.legalActions(s).filter((a) => a.t === 'demolish');
    expect(demolitions).toEqual([
      { t: 'demolish', x: 0, y: 0 },
      { t: 'demolish', x: 3, y: 0 },
    ]);

    // An end Bedroom can go; then the Closet can too, leaving one Bedroom.
    let t = rules.apply(s, { t: 'demolish', x: 4, y: 1 }).state;
    t = rules.apply(t, { t: 'demolish', x: 2, y: 0 }).state;
    expect(t.house.pieces.map((p) => p.defId)).toEqual(['bedroom']);
    expect(t.demolitionsLeft).toBe(0);
    // The last indoor piece is never a split.
    const lone = withHouse(onEmptyLot(), emptyRows(8, 4), [['bedroom', 0, 0]]);
    const gone = rules.apply(lone, { t: 'demolish', x: 1, y: 1 }).state;
    expect(gone.house.pieces).toEqual([]);
  });

  it('previewDemolish gives the change to this week’s total, and apply agrees', () => {
    // A Bedroom (3) and the Bathroom beside it (+3 for touching a Bedroom).
    const s = withHouse(onEmptyLot(), emptyRows(12, 12), [
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
    ]);
    const bedroom = rules.previewDemolish(s, 1, 1);
    expect(bedroom).toMatchObject({
      legal: true,
      target: { uid: 1, defId: 'bedroom' },
      before: { points: 6, mult: 100, total: 6 },
      after: { points: 0, mult: 100, total: 0 },
      delta: -6,
    });
    expect(bedroom.cells).toHaveLength(4);
    expect(rules.previewDemolish(s, 2, 0)).toMatchObject({
      legal: true,
      target: { uid: 2, defId: 'bathroom' },
      after: { total: 3 },
      delta: -3,
    });
    const after = rules.apply(s, { t: 'demolish', x: 2, y: 0 }).state;
    expect(rules.currentTally(after).total).toBe(3);

    // Taking away a Loud Garage helps the Bedroom beside it: 3 − 2 + 1 → 3.
    const loud = withHouse(onEmptyLot(), emptyRows(12, 12), [
      ['bedroom', 0, 8],
      ['garage', 0, 10],
    ]);
    expect(rules.previewDemolish(loud, 0, 10)).toMatchObject({
      legal: true,
      target: { uid: 2, defId: 'garage' },
      before: { total: 2 },
      after: { total: 3 },
      delta: 1,
    });
    // A boulder changes nothing.
    const rock = withHouse(onEmptyLot(), ['B...', '....']);
    expect(rules.previewDemolish(rock, 0, 0)).toMatchObject({
      legal: true,
      target: { feature: 'boulder' },
      cells: [{ x: 0, y: 0 }],
      delta: 0,
    });
  });

  it('previewDemolish names a set it would break, but not one that re-forms from other pieces', () => {
    // The Jack-and-Jill: demolishing an end Bedroom breaks it, and apply agrees.
    const s = withHouse(onEmptyLot(), emptyRows(12, 12), JACK_AND_JILL);
    const set = rules.currentTally(s).sets[0]!;
    expect(set).toMatchObject({ set: 'jackAndJill', members: [1, 2, 3], points: 10, mult: 50 });
    const p = rules.previewDemolish(s, 0, 0);
    expect(p).toMatchObject({ legal: true, setsGained: [], setsLost: [set] });
    const after = rules.apply(s, { t: 'demolish', x: 0, y: 0 }).state;
    expect(rules.currentTally(after).sets).toEqual([]);
    expect(rules.currentTally(after).total).toBe(p.after.total);
    // Nothing to break: no set flips, and an illegal target has none either.
    expect(rules.previewDemolish(withHouse(onEmptyLot(), ['B...', '....']), 0, 0)).toMatchObject({
      legal: true,
      setsGained: [],
      setsLost: [],
    });
    expect(rules.previewDemolish(s, 9, 9)).toMatchObject({ legal: false, setsLost: [] });

    // A third Bedroom (uid 4) above the Bathroom: without Bedroom 1, the set re-forms from
    // Bedrooms 3 and 4, so the preview breaks nothing, though the instance is a new one.
    //   .44.
    //   .44.
    //   11b33
    //   11.33
    const three = withHouse(onEmptyLot(), emptyRows(12, 12), [
      ['bedroom', 0, 2],
      ['bathroom', 2, 2],
      ['bedroom', 3, 2],
      ['bedroom', 1, 0],
    ]);
    expect(rules.currentTally(three).sets.map((x) => x.key)).toEqual(['jackAndJill:1,2,3']);
    expect(rules.previewDemolish(three, 0, 3)).toMatchObject({
      legal: true,
      setsGained: [],
      setsLost: [],
    });
    const reformed = rules.apply(three, { t: 'demolish', x: 0, y: 3 }).state;
    expect(rules.currentTally(reformed).sets.map((x) => x.key)).toEqual(['jackAndJill:2,3,4']);
  });

  it('a requirement that breaks later: the Garage earns nothing once its Driveway is gone', () => {
    // The Garage (rows 9–10) touches the Driveway (row 11), not the street.
    const s = withHouse(onEmptyLot(), emptyRows(12, 12), [
      ['garage', 0, 9],
      ['driveway', 0, 11],
    ]);
    const before = rules.currentTally(s);
    const garage = before.pieces.find((p) => p.defId === 'garage')!;
    const driveway = before.pieces.find((p) => p.defId === 'driveway')!;
    expect(garage.unmet).toBeUndefined();
    expect(garage.earned).toBeGreaterThan(0);
    const pv = rules.previewDemolish(s, 2, 11);
    expect(pv).toMatchObject({ legal: true, target: { uid: 2, defId: 'driveway' } });
    expect(pv.delta).toBe(-(garage.earned + driveway.earned));
    const after = rules.currentTally(rules.apply(s, { t: 'demolish', x: 2, y: 11 }).state);
    expect(after.pieces).toEqual([
      expect.objectContaining({ defId: 'garage', earned: 0, budget: 0, unmet: expect.any(String) }),
    ]);
    expect(after.total).toBe(pv.after.total);
  });
});

// ---------------------------------------------------------------------------------------

describe('milestone rewards', () => {
  it('each met milestone pays milestoneBudget, and RunState.milestones records each', () => {
    const r = createRules(content([0, 0]));
    const first = applyAll(r, onEmptyLot(r), [PASS, PASS]);
    expect(first.state).toMatchObject({ phase: 1, budget: 3, screen: 'shop' });
    // Leaving the shop without buying adds the skip reward.
    const end = applyAll(r, first.state, [LEAVE, PASS, PASS]);
    expect(end.state).toMatchObject({ screen: 'won', budget: 3 + 1 + 3 });
    const met = (phase: number) => ({
      phase,
      result: 'onTime',
      target: 0,
      score: 0,
      weeksSaved: 0,
      overtimeUsed: 0,
      reward: { budget: 3, score: 0, interest: 0 },
    });
    expect(end.state.milestones).toEqual([met(0), met(1)]);
  });

  it('the milestone’s budget comes on top of what pieces paid that week', () => {
    // A Home Office pays 1 budget every 2nd week of its life: week 2 here.
    const r = createRules(content([0, 1000]));
    const s = withHouse(onEmptyLot(r), emptyRows(12, 12), [['homeOffice', 0, 0]]);
    const { state, events } = applyAll(r, s, [PASS, PASS]);
    const tallies = eventsOf(events, 'tally');
    expect(tallies.map((t) => [t.budgetBefore, t.budget])).toEqual([
      [0, 0],
      [0, 1],
    ]);
    expect(eventsOf(events, 'milestone')[0]).toMatchObject({ reward: { budget: 3, score: 0 } });
    expect(state.budget).toBe(1 + 3);
  });
});

// ---------------------------------------------------------------------------------------

describe('forecast', () => {
  it('is the score plus this week’s total (with the play) for each week left', () => {
    const r = createRules(content([1000, 1000], 4));
    let s = withHand(onEmptyLot(r), 'bedroom', 'closet', 'kitchen');
    expect(r.weeksLeft(s)).toBe(4);
    expect(r.forecast(s)).toBe(0);
    expect(r.forecast(s, place(0, 2, 2))).toBe(3 * 4);
    s = r.apply(s, place(0, 2, 2)).state; // 3
    s = withHand(s, 'closet', 'bedroom', 'kitchen');
    expect(r.weeksLeft(s)).toBe(3);
    expect(r.forecast(s)).toBe(3 + 3 * 3);
    // A Closet beside the Bedroom: 3 + 1 a week.
    expect(r.forecast(s, place(0, 4, 2))).toBe(3 + 4 * 3);
    // An illegal play forecasts as a pass rather than throwing.
    expect(r.forecast(s, place(0, 50, 50))).toBe(r.forecast(s));
  });

  it('counts one week in overtime, and is the score once the run is over', () => {
    let s = withHand(onEmptyLot(), 'bedroom', 'lawn', 'kitchen');
    s = rules.apply(s, place(0, 2, 2)).state; // 3
    s = rules.apply(s, PASS).state; // 6 ≥ 5: phase 1 is met
    expect(s.phase).toBe(1);
    s = rules.apply(s, LEAVE).state;
    // Phase 2 (target 30): 2 weeks of 3, then overtime.
    s = applyAll(rules, s, [PASS, PASS]).state; // 12
    expect(s).toMatchObject({ overtimeWeek: 1, score: 12 });
    expect(rules.weeksLeft(s)).toBe(1);
    expect(rules.forecast(s)).toBe(12 + 3);
    const lost = applyAll(rules, s, [PASS, PASS]).state;
    expect(lost.screen).toBe('lost');
    expect(rules.forecast(lost)).toBe(lost.score);
  });
});

// ---------------------------------------------------------------------------------------

describe('piece timers', () => {
  it('a Sapling says when it becomes a Tree, and it does then', () => {
    const r = createRules(content([0, 0], 6));
    let s = withHand(onEmptyLot(r), 'sapling', 'lawn', 'kitchen');
    expect(r.preview(s, place(0, 5, 5)).upcoming).toEqual([
      expect.stringMatching(/Tree.*at the start of week 5$/),
    ]);
    s = r.apply(s, place(0, 5, 5)).state;
    expect(r.pieceTimers(s, 1)).toEqual([expect.stringMatching(/Tree.*at the start of week 5$/)]);
    s = applyAll(r, s, [PASS, PASS]).state; // weeks 2 and 3
    expect(s.week).toBe(4);
    expect(s.house.pieces).toHaveLength(1);
    const { state, events } = r.apply(s, PASS);
    expect(types(events)).toEqual(['tally', 'transformed', 'handDrawn']);
    expect(state.week).toBe(5);
    expect(state.house.pieces).toEqual([]);
    expect(state.house.lot.terrain[5 * 12 + 5]).toBe('tree');
    expect(r.pieceTimers(state, 1)).toEqual([]);
  });

  it('a Garage says when it next pays budget, and pays then', () => {
    const s = withHouse(onEmptyLot(), emptyRows(12, 12), [['garage', 0, 10]]);
    const at = (week: number): RunState => ({ ...s, week });
    // Placed in week 1, it pays every 3rd week of its life: weeks 3, 6, 9...
    expect(rules.pieceTimers(at(1), 1)).toEqual([expect.stringMatching(/\bweek 3\b/)]);
    expect(rules.pieceTimers(at(2), 1)).toEqual([expect.stringMatching(/\bweek 3\b/)]);
    expect(rules.pieceTimers(at(3), 1)).toEqual([expect.stringMatching(/this week/)]);
    expect(rules.pieceTimers(at(4), 1)).toEqual([expect.stringMatching(/\bweek 6\b/)]);
    expect([1, 2, 3, 4, 5, 6].map((w) => rules.currentTally(at(w)).budget)).toEqual([
      0, 0, 1, 0, 0, 1,
    ]);
  });

  it('a rhythm piece says when it next pays, and pays then', () => {
    // A stand-in Pool: +5 every 3rd week of its life.
    const r = createRules(
      withPieces({ closet: { effects: [{ kind: 'rhythm', every: 3, amount: 5 }] } }),
    );
    const base = onEmptyLot(r);
    const s = { ...base, house: houseFrom(r.content, emptyRows(12, 12), [['closet', 0, 0]]) };
    const at = (week: number): RunState => ({ ...s, week });
    expect(r.pieceTimers(at(1), 1)).toEqual([expect.stringMatching(/\+5.*\bweek 3\b/)]);
    expect(r.pieceTimers(at(3), 1)).toEqual([expect.stringMatching(/\+5 this week/)]);
    expect(r.pieceTimers(at(4), 1)).toEqual([expect.stringMatching(/\bweek 6\b/)]);
    expect([1, 2, 3, 4, 5, 6].map((w) => r.currentTally(at(w)).total)).toEqual([0, 0, 5, 0, 0, 5]);
  });

  it('a piece with no timers, or no piece at all, has none', () => {
    const s = withHouse(onEmptyLot(), emptyRows(12, 12), [['bedroom', 0, 0]]);
    expect(rules.pieceTimers(s, 1)).toEqual([]);
    expect(rules.pieceTimers(s, 99)).toEqual([]);
  });
});

// ---------------------------------------------------------------------------------------

describe('debug actions', () => {
  it('addScore that crosses the target fires targetReached and marks the run', () => {
    const s = onEmptyLot(); // target 5
    expect(s.debug).toBeUndefined();
    const { state, events } = rules.apply(s, { t: 'debug', op: 'addScore', amount: 5 });
    expect(events).toEqual([{ t: 'targetReached', phase: 0, target: 5, score: 5 }]);
    expect(state).toMatchObject({ score: 5, debug: true, slot: 1, week: 1 });
    expect(state.hand).toEqual(s.hand);
    // The next tally doesn't fire it again, and the run stays marked.
    const next = rules.apply(state, PASS);
    expect(types(next.events)).not.toContain('targetReached');
    expect(next.state.debug).toBe(true);

    const small = rules.apply(s, { t: 'debug', op: 'addScore', amount: 2 });
    expect(small.events).toEqual([]);
    expect(small.state).toMatchObject({ score: 2, debug: true });
    expect(() => rules.apply(s, { t: 'debug', op: 'addScore', amount: 1.5 })).toThrow(
      'Bad amount.',
    );
  });

  it('addBudget adds budget', () => {
    const { state, events } = rules.apply(onEmptyLot(), {
      t: 'debug',
      op: 'addBudget',
      amount: 7,
    });
    expect(events).toEqual([]);
    expect(state).toMatchObject({ budget: 7, debug: true });
  });

  it('giveCard appends a card to the hand, and it can be played', () => {
    const s = onEmptyLot();
    const { state, events } = rules.apply(s, { t: 'debug', op: 'giveCard', id: 'garage' });
    expect(events).toEqual([]);
    expect(state.hand).toEqual([...s.hand, { kind: 'piece', id: 'garage' }]);
    expect(state.debug).toBe(true);
    const played = rules.apply(state, place(3, 0, 10));
    expect(played.events[0]).toMatchObject({ t: 'placed', defId: 'garage', x: 0, y: 10 });
    expect(() => rules.apply(s, { t: 'debug', op: 'giveCard', id: 'mansion' as PieceId })).toThrow(
      'Unknown piece.',
    );
  });

  it('forceMiss sends a met phase into overtime; the overtime week then resolves normally', () => {
    const r = createRules(content([0, 0]));
    let s = r.apply(onEmptyLot(r), { t: 'debug', op: 'forceMiss' }).state;
    expect(s).toMatchObject({ forcedMiss: 0, debug: true });
    s = r.apply(s, PASS).state;
    const miss = r.apply(s, PASS);
    expect(types(miss.events)).toEqual(['tally', 'overtimeUsed', 'handDrawn']);
    expect(miss.state).toMatchObject({ phase: 0, overtimeWeek: 1, overtimeLeft: 1 });
    const ot = r.apply(miss.state, PASS);
    expect(eventsOf(ot.events, 'milestone')).toEqual([
      expect.objectContaining({ phase: 0, result: 'overtime', overtimeUsed: 1 }),
    ]);
    expect(ot.state).toMatchObject({ phase: 1, slot: 1 });
  });

  it('forceMiss with no overtime left loses the run', () => {
    const r = createRules(content([0, 0]));
    let s = { ...onEmptyLot(r), overtimeLeft: 0 };
    s = applyAll(r, s, [{ t: 'debug', op: 'forceMiss' }, PASS]).state;
    const { state, events } = r.apply(s, PASS);
    expect(types(events)).toEqual(['tally', 'milestone', 'runEnded']);
    expect(events[1]).toMatchObject({ result: 'failed', reward: { budget: 0, score: 0 } });
    expect(state.screen).toBe('lost');
  });
});

// ---------------------------------------------------------------------------------------

describe('the order of events', () => {
  it('a placement week: placed, tally, setCompleted, targetReached, then the next hand', () => {
    const r = createRules(content([5, 1000], 4));
    let s = withHouse(onEmptyLot(r), emptyRows(12, 12), [
      ['bedroom', 0, 0],
      ['bathroom', 2, 0],
    ]);
    s = withHand(s, 'bedroom', 'lawn', 'kitchen');
    const { events } = r.apply(s, place(0, 3, 0)); // completes the Jack-and-Jill
    expect(types(events)).toEqual([
      'placed',
      'tally',
      'setCompleted',
      'targetReached',
      'handDrawn',
    ]);
    expect(events[4]).toMatchObject({ phase: 0, slot: 2 });
  });

  it('a milestone week: the tally, the milestone, the shop, then the next phase’s first hand', () => {
    let s = withHand(onEmptyLot(), 'bedroom', 'lawn', 'kitchen');
    s = rules.apply(s, place(0, 2, 2)).state; // 3
    s = withHand(s, 'closet', 'lawn', 'kitchen');
    const met = rules.apply(s, place(0, 4, 2)); // 3 + 4 ≥ 5 in the phase's last week
    expect(types(met.events)).toEqual([
      'placed',
      'tally',
      'targetReached',
      'milestone',
      'shopOpened',
    ]);
    expect(met.events[3]).toMatchObject({ phase: 0, result: 'onTime', score: 7 });
    expect(met.events[4]).toMatchObject({ t: 'shopOpened', number: 1 });
    const { events } = rules.apply(met.state, LEAVE);
    expect(types(events)).toEqual(['shopClosed', 'handDrawn']);
    expect(events[1]).toMatchObject({ phase: 1, slot: 1 });
  });

  it('a transform at the start of the next phase comes after the milestone and the shop, before the hand', () => {
    const r = createRules(content([0, 0, 0]));
    let s = withHand(onEmptyLot(r), 'sapling', 'lawn', 'kitchen');
    s = applyAll(r, s, [place(0, 5, 5), PASS, LEAVE, PASS]).state; // weeks 1–3
    expect(s).toMatchObject({ phase: 1, slot: 2, week: 4 });
    // Week 4 ends phase 2; leaving the shop starts week 5, phase 3's first.
    const { state, events } = applyAll(r, s, [PASS, LEAVE]);
    // With targets of 0, the new phase's target is met as it starts.
    expect(types(events)).toEqual([
      'tally',
      'milestone',
      'shopOpened',
      'shopClosed',
      'targetReached',
      'transformed',
      'handDrawn',
    ]);
    expect(state).toMatchObject({ phase: 2, slot: 1, week: 5 });
  });
});
