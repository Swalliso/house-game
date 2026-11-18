// The week's stamp (D-154, week-stamp.ts): each week of a milestone is stamped once, as the
// board goes quiet. A milestone's first week names it and what its target needs, its middle
// weeks get a smaller, quieter stamp, and its last says what's still needed. None in an overtime
// week (its banner says so), none in the guided first job's first week (D-149), and none while a
// tally plays: a tally takes it down at once. An action with nothing to play (a reroll, a strike
// from the hand, leaving the shop) leaves it up, and never marks the tally director busy.
//
// The store and the director play real runs here, on the ?debug panel's instant tally.

import { effect } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT, rules, type RunSetup, type RunState } from '../../rules/index.ts';
import { banner, busy, instantTally } from '../fx/director.ts';
import { FEEL } from '../fx/feel.ts';
import {
  answerChangeOrder,
  appScreen,
  debugAction,
  endWeek,
  firstJob,
  leaveShop,
  newRun,
  pickOption,
  reroll,
  run,
  startRun,
  strikeCard,
} from '../store.ts';
import { decidingWeek, stakesOf, stampFor, weekStamp, type WeekStampView } from './week-stamp.ts';

const W = CONTENT.balance.weeksPerPhase;
const SETUP: RunSetup = {
  seed: 'stamp-1',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};
/** A build week of the first milestone. */
const at = (slot: number, extra: Partial<RunState> = {}): RunState => ({
  ...rules.newRun(SETUP),
  slot,
  week: slot,
  ...extra,
});

describe('which stamp a week gets', () => {
  const f = FEEL.weekStamp;

  it('a milestone’s first week, its middle weeks and its last, each held its own time', () => {
    expect(W).toBe(4);
    const kinds = [1, 2, 3, 4].map((slot) => stampFor(at(slot), false)?.kind);
    expect(kinds).toEqual(['first', 'mid', 'mid', 'last']);
    for (const slot of [1, 2, 4]) {
      const v = stampFor(at(slot), false)!;
      expect(v.ms).toBe(f.inMs + f.holdMs[v.kind] + f.outMs);
      expect(v).toMatchObject({ slot, weeks: W, phase: rules.phaseName(0) });
    }
    // The middle weeks' are the shortest, so some 28 a run don't wear thin; the last's longest.
    expect(f.holdMs.mid).toBeLessThan(f.holdMs.first);
    expect(f.holdMs.first).toBeLessThan(f.holdMs.last);
  });

  it('says what the target still needs, from the rules', () => {
    const s = at(W, { score: 7 });
    expect(stampFor(s, false)?.toGo).toBe(rules.toGo(s));
    expect(rules.toGo(s)).toBe(rules.target(s) - 7);
    expect(stampFor(at(W, { score: rules.target(s) + 5 }), false)?.toGo).toBe(0);
  });

  it('none in an overtime week, off the build screen, or in the first job’s first week', () => {
    expect(stampFor(at(W + 1, { overtimeWeek: 1 }), false)).toBeNull();
    expect(stampFor(at(2, { screen: 'shop' }), false)).toBeNull();
    expect(stampFor(at(2, { screen: 'changeOrder' }), false)).toBeNull();
    expect(stampFor(at(1), true)).toBeNull();
    expect(stampFor(at(2), true)?.kind).toBe('mid');
    // A later milestone's first week is stamped in the first job too.
    expect(stampFor(at(1, { phase: 1, week: W + 1 }), true)?.kind).toBe('first');
  });

  it('End week’s deciding week: the last, and each overtime week', () => {
    expect([1, 2, 3, 4].map((slot) => decidingWeek(at(slot)))).toEqual([false, false, false, true]);
    expect(decidingWeek(at(W + 1, { overtimeWeek: 1 }))).toBe(true);
    expect(decidingWeek(at(W, { screen: 'shop' }))).toBe(false);
    expect(stakesOf(at(2))).toBeNull();
    const s = at(W, { score: 7 });
    expect(stakesOf(s)).toBe(
      `The last week of ${rules.phaseName(0)}: ${rules.toGo(s)} Wow to go. The target is checked as this week is tallied.`,
    );
    expect(stakesOf(at(W + 1, { overtimeWeek: 1 }))).toMatch(/^Overtime week 1: /);
  });
});

describe('the stamp in play', () => {
  /** Every change to the director's busy and the stamp, in order. */
  let seen: { busy: boolean; stamp: WeekStampView | null }[] = [];
  let stop: () => void = () => {};

  /** Lets the director play what's queued, and the stamp's check run. */
  async function settle(): Promise<void> {
    await vi.waitFor(() => expect(busy.value).toBe(false));
    await new Promise((r) => setTimeout(r, 0));
  }
  /** Passes weeks until the run's week is `week`. */
  async function passTo(week: number): Promise<void> {
    while (run.value.week < week) {
      endWeek();
      await settle();
    }
  }
  const busyEver = () => seen.some((e) => e.busy);

  beforeEach(() => {
    // The tally waits on frames: here they're a timer's turn.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0),
    );
    // The tally's bursts look for their elements, and find none.
    vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [] });
    instantTally.value = true;
  });

  afterEach(async () => {
    stop();
    await settle();
    banner.value = null;
    appScreen.value = 'title';
    instantTally.value = false;
    vi.unstubAllGlobals();
  });

  /** Starts a run of SETUP (unguided), and records from then on. */
  async function begin(): Promise<void> {
    appScreen.value = 'game';
    startRun(SETUP);
    await settle();
    seen = [];
    stop = effect(() => {
      seen.push({ busy: busy.value, stamp: weekStamp.value });
    });
  }

  it('stamps each week once as it comes up, in its kind', async () => {
    await begin();
    const first = weekStamp.value;
    expect(first).toMatchObject({ kind: 'first', slot: 1, toGo: rules.toGo(run.value) });
    // Away to the title and back: the week was stamped already.
    appScreen.value = 'title';
    await settle();
    expect(weekStamp.value).toBeNull();
    appScreen.value = 'game';
    await settle();
    expect(weekStamp.value).toBeNull();
    const kinds: string[] = [];
    for (let week = 2; week <= W; week++) {
      await passTo(week);
      kinds.push(`${weekStamp.value?.kind} ${weekStamp.value?.slot}`);
    }
    expect(kinds).toEqual(['mid 2', 'mid 3', `last ${W}`]);
    expect(weekStamp.value?.toGo).toBe(rules.toGo(run.value));
    // One stamp a week: the first week's, then one for each week after it.
    const ids = [...new Set(seen.flatMap((e) => (e.stamp ? [e.stamp.id] : [])))];
    expect(ids).toHaveLength(W);
    expect(ids[0]).toBe(first!.id);
  });

  it('a tally takes it down at once, and the next week’s comes once it has played', async () => {
    await begin();
    const week1 = weekStamp.value!;
    endWeek();
    // The tally has begun: the director is busy before the first frame.
    expect(busy.value).toBe(true);
    await Promise.resolve();
    expect(weekStamp.value).toBeNull();
    await settle();
    expect(weekStamp.value).toMatchObject({ kind: 'mid', slot: 2 });
    // While the tally played there was no stamp: down, then the next one once it was done.
    const during = seen.filter((e) => e.busy);
    expect(during.length).toBeGreaterThan(0);
    expect(during.at(-1)?.stamp).toBeNull();
    expect(seen.find((e) => e.stamp && e.stamp.id !== week1.id)?.busy).toBe(false);
  });

  it('a reroll leaves it up, and never marks the director busy', async () => {
    await begin();
    const up = weekStamp.value!;
    const hand = run.value.hand;
    expect(reroll()).toBe(true);
    await settle();
    expect(run.value.hand).not.toEqual(hand);
    expect(weekStamp.value?.id).toBe(up.id);
    expect(busyEver()).toBe(false);
  });

  it('a strike from the hand leaves it up, and never marks the director busy (D-157)', async () => {
    await begin();
    const up = weekStamp.value!;
    const i = run.value.hand.findIndex((_, k) => rules.canStrikeCard(run.value, k).ok);
    expect(i).toBeGreaterThanOrEqual(0);
    const card = run.value.hand[i];
    expect(strikeCard(i)).toBe(true);
    await settle();
    expect(weekStamp.value?.id).toBe(up.id);
    expect(run.value.hand[i]).not.toEqual(card);
    expect(busyEver()).toBe(false);
  });

  it('leaving the shop stamps the next milestone’s first week, and nothing takes it down', async () => {
    await begin();
    await passTo(W);
    debugAction({ t: 'debug', op: 'addScore', amount: rules.toGo(run.value) });
    endWeek();
    await settle();
    if (run.value.screen === 'changeOrder') {
      answerChangeOrder(0);
      await settle();
    }
    expect(run.value.screen).toBe('shop');
    expect(weekStamp.value).toBeNull();
    // The first shop opens with a crate to pick from.
    while (run.value.offers?.pick) {
      pickOption(0);
      await settle();
    }
    seen = [];
    expect(leaveShop()).toBe(true);
    await settle();
    expect(weekStamp.value).toMatchObject({ kind: 'first', slot: 1, phase: rules.phaseName(1) });
    expect(busyEver()).toBe(false);
    expect(seen.at(-1)?.stamp).toBe(weekStamp.value);
  });

  it('none in an overtime week', async () => {
    await begin();
    // An empty lot earns nothing: the first milestone goes to overtime.
    await passTo(W + 1);
    expect(run.value.overtimeWeek).toBe(1);
    expect(weekStamp.value).toBeNull();
    // Nor once its Overtime! banner goes.
    banner.value = null;
    await settle();
    expect(weekStamp.value).toBeNull();
  });

  it('none in the guided first job’s first week; its second is stamped', async () => {
    newRun('stamp-first-job');
    expect(firstJob.value).toBe(true);
    await settle();
    expect(weekStamp.value).toBeNull();
    endWeek();
    await settle();
    expect(weekStamp.value).toMatchObject({ kind: 'mid', slot: 2 });
  });
});
