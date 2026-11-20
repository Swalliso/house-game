// A pin's beats (D-186, director.ts): a pushpin's sound going in and coming out, and a hand
// dealt around a kept card (FEEL.pin), the week after a pin or a reroll's with one in the hand.
// Like a strike's, they play outside the tally's chain: the deal never marks the director busy,
// and any action ends it at once. And the hand's pins (actions.ts): a click on a pushpin, or P,
// changes the pin and nothing else, and P does nothing in strike mode or with no card to pin.
//
// The store and the director play real runs here.

import { effect } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rules, type RunSetup } from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { pinAt, pinKey, selectCard, toggleStrike } from '../hud/actions.ts';
import { settings } from '../settings.ts';
import { endWeek, log, reroll, run, selected, startRun, tentative, tool } from '../store.ts';
import { busy, dealView, instantTally } from './director.ts';
import { FEEL } from './feel.ts';

const SETUP: RunSetup = {
  seed: 'pin-beat',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};
const f = FEEL.pin;

/** How long a hand of `cards` takes to deal around its kept card: the last one's delay and slide. */
const dealMs = (cards: number) => f.dealMs + f.staggerMs * (cards - 2);

/** Pins hand card i and passes the week: the next week's hand holds the card, kept. */
function keepCard(i: number): number {
  pinAt(i);
  endWeek();
  const k = run.value.kept;
  if (k === undefined) throw new Error('nothing kept');
  return k;
}

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
    setTimeout(() => cb(performance.now()), 0),
  );
  // No card has the focus or the pointer: P finds the card picked, or none.
  vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [] });
  instantTally.value = false;
  settings.value = { ...settings.value, reduceMotion: false };
  startRun(SETUP);
});

afterEach(() => {
  vi.runOnlyPendingTimers();
  vi.useRealTimers();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
  instantTally.value = false;
});

describe('a pin', () => {
  it('pins a card and takes the pin out with a pushpin’s sound, and the card picked stays', () => {
    selectCard(0);
    const play = vi.spyOn(audio, 'play');
    pinAt(1);
    expect(run.value.pinned).toBe(1);
    expect(log.value.at(-1)).toEqual({ t: 'pin', i: 1 });
    expect(selected.value).toBe(0);
    pinAt(1);
    expect(run.value.pinned).toBeUndefined();
    expect(selected.value).toBe(0);
    // Out, it's higher and lighter.
    expect(play.mock.calls).toEqual([
      ['pin', undefined],
      ['pin', { rate: 1.35, gain: 0.8 }],
    ]);
  });

  it('P pins the card picked, and does nothing in strike mode', () => {
    selectCard(2);
    pinKey();
    expect(run.value.pinned).toBe(2);
    expect(rules.canStrikeAny(run.value).ok).toBe(true);
    toggleStrike();
    expect(tool.value).toBe('strike');
    const before = log.value;
    pinKey();
    expect(log.value).toBe(before);
  });

  it('says no to P with no card picked, and to the card last week’s pin kept', () => {
    const play = vi.spyOn(audio, 'play');
    pinKey();
    expect(log.value).toEqual([]);
    expect(play).toHaveBeenLastCalledWith('illegal');
    const k = keepCard(1);
    const before = log.value;
    // A click on its Kept tag.
    pinAt(k);
    expect(log.value).toBe(before);
    expect(play).toHaveBeenLastCalledWith('illegal');
  });

  it('says no to a pin on the card waiting to be placed: the play takes it', () => {
    const play = vi.spyOn(audio, 'play');
    tentative.value = { t: 'place', from: 'hand', i: 1, x: 0, y: 0, rot: 0 };
    const before = log.value;
    pinAt(1);
    expect(log.value).toBe(before);
    expect(play).toHaveBeenLastCalledWith('illegal');
    // Another card can be pinned meanwhile: the play doesn't end the week until End week.
    pinAt(0);
    expect(run.value.pinned).toBe(0);
    expect(tentative.value).toMatchObject({ i: 1 });
    tentative.value = null;
  });
});

describe('the deal around a kept card', () => {
  it('deals the week after a pin around the card it kept, at once, then ends', () => {
    const k = keepCard(1);
    // Before the new week's render: the listener is synchronous.
    expect(dealView.value).toMatchObject({ kept: k });
    const ms = dealMs(run.value.hand.length);
    // Four cards: three slide in, 60 ms apart, in 340 ms.
    expect(dealMs(4)).toBe(340);
    vi.advanceTimersByTime(ms - 1);
    expect(dealView.value).toMatchObject({ kept: k });
    vi.advanceTimersByTime(1);
    expect(dealView.value).toBeNull();
  });

  it('deals a reroll around it too, never busy, and ends at once for the next action', () => {
    // The kept week, loaded: no tally plays.
    startRun(SETUP, [{ t: 'pin', i: 0 }, { t: 'pass' }]);
    const k = run.value.kept;
    expect(k).toBeDefined();
    const was = busy.value;
    const seen: boolean[] = [];
    const stop = effect(() => void seen.push(busy.value));
    expect(reroll()).toBe(true);
    stop();
    expect(seen).toEqual([was]);
    expect(run.value.kept).toBe(k);
    expect(dealView.value).toMatchObject({ kept: k });
    // A pin is an action: the deal ends.
    pinAt(k === 0 ? 1 : 0);
    expect(dealView.value).toBeNull();
  });

  it('isn’t dealt with no kept card, with Reduce motion, or on the instant tally', () => {
    endWeek();
    expect(dealView.value).toBeNull();
    settings.value = { ...settings.value, reduceMotion: true };
    keepCard(1);
    expect(run.value.kept).toBeDefined();
    expect(dealView.value).toBeNull();
    settings.value = { ...settings.value, reduceMotion: false };
    startRun(SETUP);
    instantTally.value = true;
    keepCard(1);
    expect(dealView.value).toBeNull();
  });

  it('goes with the run when a new one starts', () => {
    keepCard(2);
    expect(dealView.value).not.toBeNull();
    startRun(SETUP);
    expect(dealView.value).toBeNull();
  });
});
