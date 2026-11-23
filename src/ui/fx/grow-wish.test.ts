// D-205 with M4b's growth beats (director.ts growBeats): a phase that starts with a household
// member arriving and a piece growing plays the growth once the member's doorbell has rung
// (FEEL.transform.afterArrivalMs). A play made before then that fills the lot's wish holds its
// prize back for its own beat; the growth's late beat, finding that play's tally running, leaves
// the prize to it, so it shows once, with its pop, not a moment early and then again.
//
// The store and the director play a real run here, on fake timers: frames are 16 ms timeouts.

import { effect } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  rules,
  type PieceId,
  type PlaceAction,
  type RunSetup,
  type RunState,
} from '../../rules/index.ts';
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
import { banner, busy, instantTally, justDelivered, wishHeld } from './director.ts';
import { FEEL } from './feel.ts';

// The Hendersons on 'oak': the lot wishes for pieces by its pond; the twins bring a Nursery at
// Framing, which grows into a Kids' Room as Drywall starts, when Grandma moves in.
const SETUP: RunSetup = {
  seed: 'oak',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};

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

/** A legal placement of `from`[i] that adds to the lot's wish, or null. */
function wishPlay(s: RunState, from: 'hand' | 'reserve', i: number): PlaceAction | null {
  const base = rules.lotWish(s)?.counted.length ?? 0;
  return (
    rules
      .legalPlacements(s)
      .find(
        (p) => p.from === from && p.i === i && (rules.lotWish(s, p)?.counted.length ?? 0) > base,
      ) ?? null
  );
}

/** Gives the hand a card and builds it by the wish's feature: the week's play. */
async function buildByWish(id: PieceId): Promise<void> {
  debugAction({ t: 'debug', op: 'giveCard', id });
  await settle();
  const p = wishPlay(run.value, 'hand', run.value.hand.length - 1);
  expect(p, `a spot by the wish for ${id}`).not.toBeNull();
  expect(dispatch(p!)).toBe(true);
  await settle();
}

describe('a growth’s late beat and the lot’s wish', () => {
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
    wishHeld.value = false;
    justDelivered.value = null;
    updateSettings({ reduceMotion: false, tallySpeed: 1 });
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('leaves a newer play’s prize to that play’s own beat', async () => {
    instantTally.value = true;
    startRun(SETUP);
    await settle();
    expect(rules.lotWish(run.value)?.feature).toBe('pond');
    await buildByWish('flowerBed');
    await buildByWish('flowerBed');
    for (let k = 0; k < 2; k++) {
      await toShop();
      leaveShop();
      await settle();
    }
    // Framing's first week: the twins' Nursery, from Your goods.
    const ni = run.value.reserve.findIndex((r) => r.id === 'nursery');
    const nursery = rules
      .legalPlacements(run.value)
      .find((p) => p.from === 'reserve' && p.i === ni);
    expect(nursery).toBeDefined();
    expect(dispatch(nursery!)).toBe(true);
    await settle();
    await toShop();
    leaveShop();
    await settle();
    await toShop();
    debugAction({ t: 'debug', op: 'giveGood', good: { kind: 'piece', id: 'lawn' } });
    await settle();
    instantTally.value = false;

    // When the held prize shows, and what pops with it.
    let held = false;
    const shown: (string | null)[] = [];
    const stop = effect(() => {
      const h = wishHeld.value;
      const from = justDelivered.value?.from ?? null;
      if (held && !h) shown.push(from);
      held = h;
    });
    // Drywall starts: Grandma moves in and the Nursery grows, its beat after her doorbell.
    const grew = run.value.house.pieces.length;
    expect(leaveShop()).toBe(true);
    expect(run.value.arrived).toContain('grandma');
    expect(run.value.house.pieces.length).toBe(grew);
    expect(run.value.house.pieces.some((p) => p.defId === 'kidsRoom')).toBe(true);
    // Just before the growth's beat, the play that fills the wish: its prize waits for its beat.
    const early = FEEL.transform.afterArrivalMs - 100;
    await vi.advanceTimersByTimeAsync(early);
    const li = run.value.reserve.findIndex((r) => r.id === 'lawn' && !r.stock);
    const p = wishPlay(run.value, 'reserve', li);
    expect(p).not.toBeNull();
    expect(dispatch(p!)).toBe(true);
    expect(run.value.wishFilled).toBe('pond');
    expect(wishHeld.value).toBe(true);
    // The growth's late beat comes while that play's tally runs.
    await vi.advanceTimersByTimeAsync(FEEL.transform.afterArrivalMs - early + 16);
    expect(busy.value).toBe(true);
    await settle();
    stop();
    // Shown once, by the wish's own beat, its pop with it.
    expect(shown).toEqual(['wish']);
  });
});
