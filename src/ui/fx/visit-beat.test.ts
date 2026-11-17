// The client's visit in the director (D-182, director.ts visitBeat): at a milestone met that
// isn't the last, the client comes to the door under the banner's last second and stays
// FEEL.visit.ms, so the sheet after the milestone opens FEEL.visit.ms − underBannerMs later than
// it did. A click takes the visit down at once. Nothing comes for a missed milestone, in the
// guided first job, with Reduce motion, or on the ?debug panel's instant tally.
//
// The store and the director play real runs here, on fake timers: frames are 16 ms timeouts.

import { effect } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT, rules, type RunSetup } from '../../rules/index.ts';
import { settings, updateSettings } from '../settings.ts';
import { debugAction, dispatch, endWeek, firstJobSeed, run, startRun } from '../store.ts';
import { banner, busy, clientVisit, instantTally, skip } from './director.ts';
import { FEEL } from './feel.ts';

const W = CONTENT.balance.weeksPerPhase;
const SETUP: RunSetup = {
  seed: 'visit-beat',
  clientId: 'barkers',
  crewId: 'generalContractor',
  mode: 'standard',
};
const f = FEEL.visit;

/** Fake time on, a frame at a time, until the director is done (or `ms` have gone). */
async function settle(ms = 30000): Promise<void> {
  for (let t = 0; t < ms && busy.value; t += 16) await vi.advanceTimersByTimeAsync(16);
  await vi.advanceTimersByTimeAsync(16);
}

/** Plays the milestone's weeks before its last on the instant tally, a room each when it can. */
async function toLastWeek(): Promise<void> {
  instantTally.value = true;
  while (run.value.slot < W) {
    const s = run.value;
    const room = rules
      .legalPlacements(s)
      .find(
        (p) =>
          p.from === 'hand' &&
          s.hand[p.i]?.kind === 'piece' &&
          CONTENT.pieces[s.hand[p.i]!.id as keyof typeof CONTENT.pieces].category === 'indoor',
      );
    if (room) dispatch(room);
    else endWeek();
    await settle();
  }
  instantTally.value = false;
}

/** What the milestone week shows, in fake ms from the milestone's banner. */
interface Seen {
  bannerAt: number | null;
  visitAt: number | null;
  visitGoneAt: number | null;
  doneAt: number | null;
  visit: typeof clientVisit.value;
}

/** Ends the milestone's last week, meeting its target (or missing it), and watches. */
async function playMilestone(opts: { miss?: boolean; clickAt?: number } = {}): Promise<Seen> {
  if (opts.miss) debugAction({ t: 'debug', op: 'forceMiss' });
  else debugAction({ t: 'debug', op: 'addScore', amount: rules.toGo(run.value) });
  const seen: Seen = {
    bannerAt: null,
    visitAt: null,
    visitGoneAt: null,
    doneAt: null,
    visit: null,
  };
  const start = performance.now();
  const stop = effect(() => {
    const now = performance.now() - start;
    if (banner.value && seen.bannerAt === null) seen.bannerAt = now;
    const v = clientVisit.value;
    if (v && seen.visitAt === null) {
      seen.visitAt = now;
      seen.visit = v;
    }
    if (!v && seen.visitAt !== null && seen.visitGoneAt === null) seen.visitGoneAt = now;
  });
  endWeek();
  for (let t = 0; t < 30000 && busy.value; t += 16) {
    await vi.advanceTimersByTimeAsync(16);
    if (opts.clickAt !== undefined && seen.visitAt !== null) {
      if (performance.now() - start >= seen.visitAt + opts.clickAt && clientVisit.value) skip();
    }
  }
  seen.doneAt = performance.now() - start;
  stop();
  // As times from the banner.
  const from = seen.bannerAt ?? 0;
  const rel = (t: number | null) => (t === null ? null : t - from);
  return {
    ...seen,
    visitAt: rel(seen.visitAt),
    visitGoneAt: rel(seen.visitGoneAt),
    doneAt: rel(seen.doneAt),
  };
}

describe('the client’s visit', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'],
    });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16),
    );
    // The banner's sparkles look for the ribbon, and find none.
    vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [] });
    updateSettings({ reduceMotion: false, tallySpeed: 8 });
    firstJobSeed.value = null;
  });

  afterEach(async () => {
    await settle();
    instantTally.value = false;
    firstJobSeed.value = null;
    banner.value = null;
    clientVisit.value = null;
    updateSettings({ reduceMotion: false, tallySpeed: 1 });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('comes under the banner’s last second, and the sheet waits for it', async () => {
    startRun(SETUP);
    await toLastWeek();
    const seen = await playMilestone();
    expect(seen.bannerAt).not.toBeNull();
    expect(seen.visit).toMatchObject({ clientId: 'barkers' });
    // The banner of a milestone met on time stays FEEL.bannerMs.
    const lead = FEEL.bannerMs - f.underBannerMs;
    expect(seen.visitAt).toBeGreaterThanOrEqual(lead);
    expect(seen.visitAt).toBeLessThan(lead + 100);
    expect(seen.visitGoneAt! - seen.visitAt!).toBeGreaterThanOrEqual(f.ms - 16);
    expect(seen.visitGoneAt! - seen.visitAt!).toBeLessThan(f.ms + 100);
    // The sheet opens once the visit is over: FEEL.visit.ms − underBannerMs past the banner.
    expect(seen.doneAt).toBeGreaterThanOrEqual(FEEL.bannerMs + f.ms - f.underBannerMs - 16);
    expect(run.value.screen === 'shop' || run.value.screen === 'changeOrder').toBe(true);
  });

  it('goes at once for a click', async () => {
    startRun(SETUP);
    await toLastWeek();
    const seen = await playMilestone({ clickAt: 200 });
    expect(seen.visitAt).not.toBeNull();
    expect(seen.visitGoneAt! - seen.visitAt!).toBeLessThan(200 + 50);
    expect(seen.doneAt!).toBeLessThan(seen.visitAt! + f.ms);
  });

  it('never comes for a missed milestone', async () => {
    startRun(SETUP);
    await toLastWeek();
    const seen = await playMilestone({ miss: true });
    expect(seen.bannerAt).not.toBeNull();
    expect(seen.visitAt).toBeNull();
  });

  it('never comes with Reduce motion', async () => {
    startRun(SETUP);
    await toLastWeek();
    updateSettings({ reduceMotion: true });
    expect(settings.value.reduceMotion).toBe(true);
    const seen = await playMilestone();
    expect(seen.bannerAt).not.toBeNull();
    expect(seen.visitAt).toBeNull();
  });

  it('never comes in the guided first job', async () => {
    const first: RunSetup = { ...SETUP, seed: 'visit-beat-first', mode: 'firstJob' };
    firstJobSeed.value = first.seed;
    startRun(first);
    await toLastWeek();
    const seen = await playMilestone();
    expect(seen.bannerAt).not.toBeNull();
    expect(seen.visitAt).toBeNull();
  });

  it('never comes on the instant tally', async () => {
    startRun(SETUP);
    await toLastWeek();
    instantTally.value = true;
    const seen = await playMilestone();
    expect(seen.visitAt).toBeNull();
  });
});
