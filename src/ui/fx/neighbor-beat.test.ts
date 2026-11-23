// D-206: the neighbor's ask met at its milestone, in the director (neighborResolvedBeat). Their
// heart and their going run in real time (NeighborAskLayer.tsx), so the beat holds the sheet after
// the milestone for FEEL.neighbor.metMs of real time at any tally speed, and a click still skips
// it. The overtime week they give pops onto the top bar once: the gift is let go once they've
// gone, so a top bar drawn again later doesn't pop it again.
//
// The store and the director play a real run here, on fake timers: frames are 16 ms timeouts.

import { effect } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT, rules, type PlaceAction, type RunSetup } from '../../rules/index.ts';
import { updateSettings } from '../settings.ts';
import {
  answerChangeOrder,
  debugAction,
  dispatch,
  endWeek,
  firstJobSeed,
  leaveShop,
  pickOption,
  run,
  startRun,
} from '../store.ts';
import { banner, busy, instantTally, neighborMoment, overtimeGift, skip } from './director.ts';
import { FEEL, type TallySpeed } from './feel.ts';

const W = CONTENT.balance.weeksPerPhase;
// The Hendersons on 'oak': the neighbor on the left asks for a Fence at Roofing's start
// (board/neighbor-ask.test.ts).
const SETUP: RunSetup = {
  seed: 'oak',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};
const f = FEEL.neighbor;

/** Fake time on, a frame at a time, until the director is done (or `ms` have gone). */
async function settle(ms = 30000): Promise<void> {
  for (let t = 0; t < ms && busy.value; t += 16) await vi.advanceTimersByTimeAsync(16);
  await vi.advanceTimersByTimeAsync(16);
}

/** On the instant tally: meets this milestone by a cheat and plays on to its shop. */
async function toShop(): Promise<void> {
  debugAction({ t: 'debug', op: 'addScore', amount: rules.toGo(run.value) });
  await settle();
  while (run.value.screen === 'build') {
    endWeek();
    await settle();
  }
  if (run.value.screen === 'changeOrder') {
    answerChangeOrder(0);
    await settle();
  }
  if (run.value.offers?.pick) {
    pickOption(-1);
    await settle();
  }
  expect(run.value.screen).toBe('shop');
}

/**
 * Roofing's last week with the neighbor's Fence laid along their side and the target met, on
 * the instant tally; then the tally plays at `speed` for the milestone.
 */
async function toRoofingsEnd(speed: TallySpeed): Promise<void> {
  instantTally.value = true;
  startRun(SETUP);
  await settle();
  for (let k = 0; k < 3; k++) {
    await toShop();
    leaveShop();
    await settle();
  }
  expect(run.value.phase).toBe(3);
  expect(run.value.neighbor?.side).toBe('left');
  const i = run.value.reserve.findIndex((c) => c.id === 'fence');
  const lay: PlaceAction = {
    t: 'place',
    from: 'reserve',
    i,
    x: 0,
    y: 0,
    rot: 0,
    shape: ['#', '#', '#', '#', '#'],
  };
  while (lay.y + 5 <= run.value.house.lot.height && !rules.checkPlay(run.value, lay).legal) lay.y++;
  expect(dispatch(lay)).toBe(true);
  await settle();
  expect(rules.neighbor(run.value)?.have).toBeGreaterThanOrEqual(run.value.neighbor!.tiles);
  debugAction({ t: 'debug', op: 'addScore', amount: rules.toGo(run.value) });
  await settle();
  while (run.value.slot < W) {
    endWeek();
    await settle();
  }
  instantTally.value = false;
  updateSettings({ reduceMotion: false, tallySpeed: speed });
}

interface Seen {
  metAt: number | null;
  giftAt: number | null;
  doneAt: number | null;
}

/** Ends Roofing's last week and watches; `clickAt` clicks that long after the heart. */
async function playMilestone(clickAt?: number): Promise<Seen> {
  const seen: Seen = { metAt: null, giftAt: null, doneAt: null };
  const start = performance.now();
  const stop = effect(() => {
    const now = performance.now() - start;
    if (neighborMoment.value?.kind === 'met' && seen.metAt === null) seen.metAt = now;
    if (overtimeGift.value && seen.giftAt === null) seen.giftAt = now;
  });
  endWeek();
  for (let t = 0; t < 30000 && busy.value; t += 16) {
    await vi.advanceTimersByTimeAsync(16);
    const now = performance.now() - start;
    if (clickAt !== undefined && seen.metAt !== null && now >= seen.metAt + clickAt) skip();
  }
  seen.doneAt = performance.now() - start;
  stop();
  return seen;
}

describe('the neighbor’s ask met at its milestone', () => {
  beforeEach(() => {
    vi.useFakeTimers({
      toFake: ['setTimeout', 'clearTimeout', 'setInterval', 'clearInterval', 'performance', 'Date'],
    });
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 16),
    );
    vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [] });
    updateSettings({ reduceMotion: false, tallySpeed: 1 });
    firstJobSeed.value = null;
  });

  afterEach(async () => {
    await settle();
    instantTally.value = false;
    banner.value = null;
    neighborMoment.value = null;
    overtimeGift.value = null;
    updateSettings({ reduceMotion: false, tallySpeed: 1 });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  for (const speed of [1, 8] as const) {
    it(`holds their heart for its real time before the sheet, at ${speed}×`, async () => {
      await toRoofingsEnd(speed);
      const seen = await playMilestone();
      expect(seen.metAt).not.toBeNull();
      expect(run.value.screen === 'shop' || run.value.screen === 'changeOrder').toBe(true);
      // The sheet waits out the heart: FEEL.neighbor.metMs of real time, not of the tally's.
      expect(seen.doneAt! - seen.metAt!).toBeGreaterThanOrEqual(f.metMs - 16);
      expect(seen.doneAt! - seen.metAt!).toBeLessThan(f.metMs + 200);
    });
  }

  it('goes at once for a click', async () => {
    await toRoofingsEnd(1);
    const seen = await playMilestone(200);
    expect(seen.metAt).not.toBeNull();
    expect(seen.doneAt! - seen.metAt!).toBeLessThan(200 + 100);
  });

  it('pops the week they give once, and lets it go once they’ve gone', async () => {
    await toRoofingsEnd(1);
    const seen = await playMilestone();
    expect(seen.giftAt).toBe(seen.metAt);
    expect(run.value.overtimeLeft).toBe(rules.rule(run.value, 'overtime') + 1);
    // Their going is over FEEL.neighbor.metMs + outMs after the heart, and the gift with it.
    await vi.advanceTimersByTimeAsync(f.metMs + f.outMs);
    expect(neighborMoment.value).toBeNull();
    expect(overtimeGift.value).toBeNull();
  });
});
