// The house builds itself (D-187, timelapse.ts): its schedule fits any run in FEEL's five
// seconds, a short run at FEEL's own pace, and a late frame shows the latest build due; the place
// sounds climb the tally's ladder from the first build to the last. Only a run that ends in this
// browser gets one, by the look down the street's own guards (not a debug run, not with Reduce
// motion on, not a run loaded already over), and a new run or a load drops it.
//
// The store plays real actions here, without the director: nothing tallies, so a run put on its
// last week with its target met is won by one pass, in that dispatch.

import { afterEach, describe, expect, it } from 'vitest';
import { makeGreedy } from '../../../sim/policies/index.ts';
import { simulateRun } from '../../../sim/simulate.ts';
import { CONTENT, rules, type RunSetup, type RunState } from '../../rules/index.ts';
import { ladderSemitones } from '../audio/kit.ts';
import { FEEL } from '../fx/feel.ts';
import { settings } from '../settings.ts';
import { debugAction, dispatch, inProgress, run, startRun } from '../store.ts';
import { buildRate, frameAt, timelapse, timelapsePlan } from './timelapse.ts';

const F = FEEL.timelapse;

describe('its schedule', () => {
  const room = F.maxMs - F.startMs - F.holdMs;
  /** The most builds FEEL's own pace fits in its five seconds. */
  const most = Math.floor(room / F.stepMs);

  it('plays a short run at FEEL’s pace, and hurries a long one to fit', () => {
    expect(most).toBeGreaterThan(20);
    for (const builds of [1, 12, most]) {
      expect(timelapsePlan(builds)).toEqual({
        stepMs: F.stepMs,
        totalMs: F.startMs + builds * F.stepMs + F.holdMs,
      });
    }
    for (const builds of [most + 1, 60, 150, 1000]) {
      const { stepMs, totalMs } = timelapsePlan(builds);
      expect(stepMs).toBeLessThan(F.stepMs);
      expect(stepMs).toBeGreaterThan(0);
      expect(totalMs).toBeCloseTo(F.maxMs);
    }
    // Nothing built: the cleared lot, and the hold.
    expect(timelapsePlan(0)).toEqual({ stepMs: 0, totalMs: F.startMs + F.holdMs });
  });

  it('shows the cleared lot, then each build in turn, then the finished house to the end', () => {
    for (const builds of [1, 5, most, 80, 300]) {
      const { stepMs, totalMs } = timelapsePlan(builds);
      expect(frameAt(0, builds, stepMs)).toBe(0);
      expect(frameAt(F.startMs - 1, builds, stepMs)).toBe(0);
      // Each build is due for a whole step, from its own start.
      for (let i = 1; i <= builds; i++) {
        for (const into of [0.01, 0.5, 0.99]) {
          expect(frameAt(F.startMs + (i - 1 + into) * stepMs, builds, stepMs)).toBe(i);
        }
      }
      expect(frameAt(totalMs, builds, stepMs)).toBe(builds);
      expect(frameAt(totalMs * 4, builds, stepMs)).toBe(builds);
      // Never back: a late frame paints the latest build due, and skips the ones it missed.
      let last = 0;
      for (let ms = 0; ms <= totalMs; ms += 7) {
        const f = frameAt(ms, builds, stepMs);
        expect(f).toBeGreaterThanOrEqual(last);
        last = f;
      }
    }
    expect(frameAt(1000, 0, 0)).toBe(0);
  });

  it('climbs the tally’s ladder over the whole run, from FEEL’s rate, never down', () => {
    // Four steps of the major pentatonic: a major sixth over the rebuild.
    const top = F.rate * 2 ** (ladderSemitones(F.ladderSteps) / 12);
    expect(top / F.rate).toBeCloseTo(2 ** (9 / 12));
    for (const builds of [2, 5, most, 80]) {
      const rates = Array.from({ length: builds }, (_, i) => buildRate(i, builds));
      expect(rates[0]).toBeCloseTo(F.rate);
      expect(rates.at(-1)).toBeCloseTo(top);
      rates.slice(1).forEach((r, i) => expect(r).toBeGreaterThanOrEqual(rates[i]!));
      // Only the ladder's own notes.
      expect(new Set(rates).size).toBeLessThanOrEqual(F.ladderSteps + 1);
    }
    expect(buildRate(0, 1)).toBe(F.rate);
  });
});

const SETUP: RunSetup = {
  seed: 'timelapse-1',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};
const W = CONTENT.balance.weeksPerPhase;
const LAST = CONTENT.balance.phases.length - 1;

/** The run on its last week with `score` Wow. */
function lastWeek(score: number, from: RunState): RunState {
  return { ...from, phase: LAST, slot: W, week: LAST * W + W, score, phaseStartScore: 0 };
}

/** Starts SETUP's run, puts it on its last week with `score`, and plays End week. */
function endLastWeek(score: number, debug = false): void {
  startRun(SETUP);
  if (debug) debugAction({ t: 'debug', op: 'addBudget', amount: 1 });
  run.value = lastWeek(score, run.value);
  dispatch({ t: 'pass' });
}

describe('which runs get one', () => {
  afterEach(() => {
    settings.value = { ...settings.value, reduceMotion: false };
    startRun(SETUP);
  });

  it('a run won here, from the action that won it, for that run', () => {
    startRun(SETUP);
    expect(timelapse.value).toBeNull();
    endLastWeek(10 ** 7);
    expect(run.value.screen).toBe('won');
    expect(timelapse.value).toEqual({ phase: 'due', run: run.value.setup });
  });

  it('a run lost here, as its last overtime week ends', () => {
    endLastWeek(0);
    for (let n = 0; n < 8 && run.value.screen === 'build'; n++) {
      expect(timelapse.value).toBeNull();
      dispatch({ t: 'pass' });
    }
    expect(run.value.screen).toBe('lost');
    expect(timelapse.value).toEqual({ phase: 'due', run: run.value.setup });
  });

  it('none for a debug run, or with Reduce motion on', () => {
    endLastWeek(10 ** 7, true);
    expect(run.value).toMatchObject({ screen: 'won', debug: true });
    expect(timelapse.value).toBeNull();
    settings.value = { ...settings.value, reduceMotion: true };
    endLastWeek(10 ** 7);
    expect(run.value.screen).toBe('won');
    expect(timelapse.value).toBeNull();
  });

  it('none for a run loaded already over; a new run or a load drops one that’s due', () => {
    endLastWeek(10 ** 7);
    expect(timelapse.value?.phase).toBe('due');
    startRun(SETUP);
    expect(timelapse.value).toBeNull();
    // A whole run, loaded as a run code is: it replays to its end without a dispatch.
    const done = simulateRun(rules, 'timelapse-load', makeGreedy({ early: 'always' }));
    expect(inProgress(done.state)).toBe(false);
    endLastWeek(10 ** 7);
    expect(timelapse.value?.phase).toBe('due');
    startRun(done.state.setup, done.actions);
    expect(inProgress(run.value)).toBe(false);
    expect(timelapse.value).toBeNull();
  });
});
