// A strike's beat (D-157, director.ts strikeBeat): the struck slots hold their old cards under a
// red plate, the cards drop away, and the new ones slide in, 860 ms in all (FEEL.strike). It
// plays in real time outside the tally's chain, so it never marks the director busy, and any
// action ends it at once: another strike, a pick (a click on the held card picks the new one),
// a reroll, a mode, a new run. The milestone banner says the strikes it gave, once Strike is on
// the plank.
//
// The store and the director play real runs here.

import { effect } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT, rules, strikeText, type GameEvent, type RunSetup } from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { selectCard, toggleStrike } from '../hud/actions.ts';
import {
  debugAction,
  endWeek,
  firstJobSeed,
  leaveShop,
  log,
  onEvents,
  pickOption,
  reroll,
  run,
  selected,
  source,
  startRun,
  strikeArmed,
  tool,
} from '../store.ts';
import { banner, busy, instantTally, strikeView, struckIn, struckSaid } from './director.ts';
import { FEEL } from './feel.ts';

const SETUP: RunSetup = {
  seed: 'strike-beat',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};
const W = CONTENT.balance.weeksPerPhase;
const f = FEEL.strike;

type Struck = Extract<GameEvent, { t: 'cardStruck' }>;

/** The first hand card a strike can take now. */
function strikable(): number {
  const i = run.value.hand.findIndex((_, k) => rules.canStrikeCard(run.value, k).ok);
  expect(i).toBeGreaterThanOrEqual(0);
  return i;
}

/** Strikes hand card i as two clicks in strike mode do, and returns the strike's event. */
function strike(i: number): Struck {
  toggleStrike();
  selectCard(i);
  const events: GameEvent[] = [];
  const stop = onEvents((e) => events.push(...e));
  selectCard(i);
  stop();
  const e = events.find((x): x is Struck => x.t === 'cardStruck');
  if (!e) throw new Error('no strike');
  return e;
}

describe('the strike’s beat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0),
    );
    // The ink's burst looks for the stamps, and finds none.
    vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [] });
    instantTally.value = false;
    startRun(SETUP);
  });

  afterEach(() => {
    vi.runOnlyPendingTimers();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    instantTally.value = false;
  });

  it('stamps the struck card at once, holds it, drops it, then slides the new one in', () => {
    const before = run.value.hand;
    const i = strikable();
    const e = strike(i);
    // The listener is synchronous: the first render after the strike shows the old card stamped.
    expect(strikeView.value).toMatchObject({ text: strikeText(CONTENT, e.type), leaving: false });
    expect(strikeView.value?.cards).toEqual(e.slots.map(({ i: at, was }) => ({ i: at, was })));
    expect(strikeView.value?.cards.find((c) => c.i === i)?.was).toEqual(before[i]);
    expect(struckIn.value).toBeNull();
    vi.advanceTimersByTime(f.stampInMs + f.holdMs - 1);
    expect(strikeView.value?.leaving).toBe(false);
    vi.advanceTimersByTime(1);
    expect(strikeView.value?.leaving).toBe(true);
    vi.advanceTimersByTime(f.outMs);
    expect(strikeView.value).toBeNull();
    expect(struckIn.value?.slots).toEqual(e.slots.map((x) => x.i));
    vi.advanceTimersByTime(f.inMs);
    expect(struckIn.value).toBeNull();
    // 860 ms in all.
    expect(f.stampInMs + f.holdMs + f.outMs + f.inMs).toBe(860);
  });

  it('never marks the director busy', () => {
    const seen: boolean[] = [];
    const stop = effect(() => void seen.push(busy.value));
    strike(strikable());
    vi.advanceTimersByTime(1000);
    stop();
    expect(seen.some(Boolean)).toBe(false);
  });

  it('ends at once for a reroll during the hold', () => {
    strike(strikable());
    vi.advanceTimersByTime(f.stampInMs);
    expect(strikeView.value).not.toBeNull();
    expect(reroll()).toBe(true);
    expect(strikeView.value).toBeNull();
    expect(struckIn.value).toBeNull();
  });

  it('ends at once for a click on the held card, which picks the new card', () => {
    const i = strikable();
    const e = strike(i);
    vi.advanceTimersByTime(f.stampInMs);
    expect(strikeView.value?.cards.some((c) => c.i === i)).toBe(true);
    // What the held card's onClick and its number key call.
    selectCard(i);
    expect(strikeView.value).toBeNull();
    expect(selected.value).toBe(i);
    expect(source.value).toBe('hand');
    expect(run.value.hand[i]).toEqual(e.slots.find((x) => x.i === i)?.card);
  });

  it('ends at once for a mode, so a number key arms the new card, never one under a stamp', () => {
    run.value = { ...run.value, strikesLeft: 2 };
    const i = strikable();
    strike(i);
    vi.advanceTimersByTime(f.stampInMs);
    expect(strikeView.value).not.toBeNull();
    toggleStrike();
    expect(strikeView.value).toBeNull();
    expect(tool.value).toBe('strike');
    expect(rules.canStrikeCard(run.value, i).ok).toBe(true);
    const before = log.value;
    selectCard(i);
    expect(strikeArmed.value).toBe(i);
    expect(log.value).toBe(before);
  });

  it('plays no beat on the ?debug panel’s instant tally, and still says what it did', () => {
    instantTally.value = true;
    const e = strike(strikable());
    expect(strikeView.value).toBeNull();
    const names = e.slots.map((x) =>
      x.card.kind === 'piece' ? CONTENT.pieces[x.card.id].name : CONTENT.fixtures[x.card.id].name,
    );
    expect(struckSaid.value).toBe(
      `${strikeText(CONTENT, e.type)}. New ${names.length === 1 ? 'card' : 'cards'}: ` +
        `${names.join(', ')}. 0 strikes left.`,
    );
  });

  it('goes with the run when a new one starts', () => {
    strike(strikable());
    vi.advanceTimersByTime(f.stampInMs + f.holdMs + f.outMs);
    expect(struckIn.value).not.toBeNull();
    expect(struckSaid.value).not.toBe('');
    startRun(SETUP);
    expect(strikeView.value).toBeNull();
    expect(struckIn.value).toBeNull();
    expect(struckSaid.value).toBe('');
  });

  it('sounds the strike, then the card going, then the new one landing', () => {
    const i = strikable();
    toggleStrike();
    selectCard(i);
    const play = vi.spyOn(audio, 'play');
    selectCard(i);
    vi.advanceTimersByTime(1000);
    expect(play.mock.calls.map(([id]) => id)).toEqual(['strike', 'rotate', 'select']);
    // The new card lands at about 70% of its slide.
    expect(play.mock.calls[2]?.[1]).toEqual({ rate: 0.7, delay: (f.inMs * 0.7) / 1000 });
  });
});

describe('the milestone banner’s strikes', () => {
  let details: string[] = [];
  let stop: () => void = () => {};

  async function settle(): Promise<void> {
    await vi.waitFor(() => expect(busy.value).toBe(false));
    await new Promise((r) => setTimeout(r, 0));
  }
  async function passTo(week: number): Promise<void> {
    while (run.value.week < week) {
      endWeek();
      await settle();
    }
  }
  /** Meets the target in the milestone's last week, and records what its banner says. */
  async function meet(lastWeek: number): Promise<string | undefined> {
    await passTo(lastWeek);
    details = [];
    debugAction({ t: 'debug', op: 'addScore', amount: rules.toGo(run.value) });
    endWeek();
    await settle();
    return details.find((d) => d.startsWith('On to'));
  }

  beforeEach(() => {
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0),
    );
    vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [] });
    instantTally.value = true;
    stop = effect(() => {
      const b = banner.value;
      if (b) details.push(b.detail);
    });
  });

  afterEach(async () => {
    stop();
    await settle();
    banner.value = null;
    firstJobSeed.value = null;
    instantTally.value = false;
    vi.unstubAllGlobals();
  });

  it('says +1 strike in a standard run', async () => {
    startRun(SETUP);
    expect(await meet(W)).toMatch(/ \+1 strike\.$/);
  });

  it('leaves it out of the first job’s first milestone, and says it from the second', async () => {
    const first: RunSetup = { ...SETUP, seed: 'strike-beat-first', mode: 'firstJob' };
    firstJobSeed.value = first.seed;
    startRun(first);
    const one = await meet(W);
    expect(one).toBeDefined();
    expect(one).not.toMatch(/strike/);
    expect(run.value.screen).toBe('shop');
    // The first shop opens with a crate to pick from.
    while (run.value.offers?.pick) {
      pickOption(0);
      await settle();
    }
    expect(leaveShop()).toBe(true);
    await settle();
    expect(await meet(2 * W)).toMatch(/ \+1 strike\.$/);
  });
});
