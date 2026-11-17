// A won run's open house (D-175, open-house.ts): only a run won in this browser gets one, the
// look's own guards (not a lost run, not a debug run, not a run loaded already over); its crowd
// follows the verdict and its hearts the last tally's best earners; the fanfare waits for the
// look down the street, or with Reduce motion on plays alone once the last tally is over; and a
// new run empties the street.
//
// The store and the director play real actions here, on the ?debug panel's instant tally. A
// won run is a run put on its last week with its target met: one End week wins it.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTENT,
  rules,
  type GameEvent,
  type PieceScore,
  type PlacedPiece,
  type RunSetup,
  type RunState,
} from '../../rules/index.ts';
import { audio } from '../audio/audio.ts';
import { streetView } from '../board/camera.ts';
import { settings } from '../settings.ts';
import { appScreen, debugAction, endWeek, run, startRun } from '../store.ts';
import { busy, instantTally } from './director.ts';
import { FEEL } from './feel.ts';
import { openHouse, openHouseFor, openHouseOf, verdictBand } from './open-house.ts';

const SETUP: RunSetup = {
  seed: 'open-house-1',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};
const W = CONTENT.balance.weeksPerPhase;
const LAST = CONTENT.balance.phases.length - 1;

/** A run on its last week with `score` Wow, and a few rooms by the street. */
function lastWeek(score: number, from: RunState = rules.newRun(SETUP)): RunState {
  const { lot } = from.house;
  const y = lot.height - 3;
  const pieces: PlacedPiece[] = (['bedroom', 'kitchen', 'livingRoom'] as const).map((defId, i) => ({
    uid: i + 1,
    defId,
    x: 6 + 3 * i,
    y,
    rot: 0,
    placedWeek: i,
  }));
  return {
    ...from,
    phase: LAST,
    slot: W,
    week: LAST * W + W,
    score,
    phaseStartScore: 0,
    house: { ...from.house, pieces, nextUid: pieces.length + 1 },
  };
}

/** The last tally's pieces: what each earned. */
function tallied(earned: readonly [number, number][]): GameEvent {
  const pieces = earned.map(([uid, e]) => ({ uid, earned: e }) as PieceScore);
  return { t: 'tally', tally: { pieces } } as unknown as GameEvent;
}

describe('which runs get one', () => {
  const before = lastWeek(10 ** 7);
  const won = rules.apply(before, { t: 'pass' });

  it('a run won by this action, with a crowd for its verdict', () => {
    expect(won.state.screen).toBe('won');
    const oh = openHouseOf(won.events, before, won.state)!;
    expect(oh.run).toBe(won.state.setup);
    const band = verdictBand(rules.verdict(won.state));
    expect(CONTENT.balance.verdicts[band]!.name).toBe('Dream Home');
    expect(oh.crowd.visitors).toHaveLength(FEEL.openHouse.visitors[band]!);
    expect(oh.crowd.cars).toHaveLength(FEEL.openHouse.cars[band]!);
  });

  it('none for a lost run, a debug run, a run already over, or one still going', () => {
    const lost = { ...won.state, screen: 'lost' as const };
    expect(openHouseOf(won.events, before, lost)).toBeNull();
    expect(openHouseOf(won.events, before, { ...won.state, debug: true })).toBeNull();
    expect(openHouseOf(won.events, won.state, won.state)).toBeNull();
    expect(openHouseOf(won.events, before, before)).toBeNull();
  });

  it('a smaller crowd for a smaller verdict', () => {
    const target = rules.target(before);
    const just = lastWeek(target);
    const r = rules.apply(just, { t: 'pass' });
    expect(r.state.screen).toBe('won');
    const band = verdictBand(rules.verdict(r.state));
    expect(band).toBeLessThan(CONTENT.balance.verdicts.length - 1);
    expect(openHouseOf(r.events, just, r.state)!.crowd.visitors.length).toBeLessThan(
      openHouseOf(won.events, before, won.state)!.crowd.visitors.length,
    );
  });

  it('hearts over the last tally’s best earners, the best first', () => {
    const middle = (uid: number) => {
      const p = won.state.house.pieces.find((q) => q.uid === uid)!;
      const shape = CONTENT.pieces[p.defId].shape;
      return { x: p.x + shape[0]!.length / 2, y: p.y + shape.length / 2 };
    };
    // Two tallies: the last one counts.
    const two = [
      tallied([[1, 90]]),
      tallied([
        [1, 40],
        [2, 90],
        [3, 10],
      ]),
    ];
    const oh = openHouseOf(two, before, won.state)!;
    expect(oh.hearts).toEqual([middle(2), middle(1), middle(3)]);
    expect(oh.hearts.length).toBeLessThanOrEqual(FEEL.openHouse.hearts);
    // Nothing earned, no hearts; and the run's own tally, as the rules played it.
    expect(openHouseOf([tallied([[1, 0]])], before, won.state)!.hearts).toEqual([]);
    const own = won.events.find((e) => e.t === 'tally');
    const best = own?.t === 'tally' ? own.tally.pieces.filter((p) => p.earned > 0) : [];
    best.sort((a, b) => b.earned - a.earned);
    expect(openHouseOf(won.events, before, won.state)!.hearts).toEqual(
      best.slice(0, FEEL.openHouse.hearts).map((p) => middle(p.uid)),
    );
    // The front door, for the confetti, is on the house's south side.
    expect(oh.door).not.toBeNull();
    expect(oh.door!.y).toBeGreaterThan(won.state.house.pieces[0]!.y);
  });
});

describe('in play', () => {
  const played: string[] = [];

  /** Lets the director play what's queued, and the open house's microtask run. */
  async function settle(): Promise<void> {
    await vi.waitFor(() => expect(busy.value).toBe(false));
    await new Promise((r) => setTimeout(r, 0));
  }

  /** Puts SETUP's run on its last week with `score`, and plays End week. */
  async function endLastWeek(score: number, debug = false): Promise<void> {
    appScreen.value = 'game';
    startRun(SETUP);
    await settle();
    if (debug) debugAction({ t: 'debug', op: 'addBudget', amount: 1 });
    run.value = lastWeek(score, run.value);
    endWeek();
    await settle();
  }

  beforeEach(() => {
    // The tally waits on frames: here they're a timer's turn.
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0),
    );
    // The tally's bursts look for their elements, and find none.
    vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [] });
    instantTally.value = true;
    played.length = 0;
    vi.spyOn(audio, 'play').mockImplementation((id) => void played.push(id));
  });

  afterEach(async () => {
    await settle();
    streetView.value = null;
    settings.value = { ...settings.value, reduceMotion: false };
    startRun(SETUP);
    appScreen.value = 'title';
    instantTally.value = false;
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it('a won run’s is due once its last tally is over, and starts with the look down the street', async () => {
    await endLastWeek(10 ** 7);
    expect(run.value.screen).toBe('won');
    const due = openHouse.value!;
    expect(due).toMatchObject({ phase: 'due', run: run.value.setup, hurried: false });
    expect(openHouseFor(run.value.setup)).toBe(true);
    // Nothing plays until the look starts.
    await new Promise((r) => setTimeout(r, FEEL.streetView.delayMs + 50));
    expect(played).not.toContain('run-won');
    streetView.value = {
      phase: 'on',
      run: run.value.setup,
      k: 0.6,
      from: { left: 0, top: 0, width: 800, height: 600, x: 0, y: 0 },
    };
    expect(played.filter((id) => id === 'run-won')).toHaveLength(1);
    expect(openHouse.value).toMatchObject({ phase: 'on', crowd: due.crowd });
    expect(openHouse.value!.at).toBeGreaterThan(0);
    // The look ends: the crowd stays for the rest of the run.
    streetView.value = null;
    expect(openHouse.value?.phase).toBe('on');
    // A new run empties the street.
    startRun(SETUP);
    expect(openHouse.value).toBeNull();
    expect(openHouseFor(run.value.setup)).toBe(false);
  });

  it('with Reduce motion on, the fanfare alone, as the look would have started', async () => {
    settings.value = { ...settings.value, reduceMotion: true };
    await endLastWeek(10 ** 7);
    expect(openHouse.value?.phase).toBe('due');
    expect(played).not.toContain('run-won');
    await vi.waitFor(() => expect(played).toContain('run-won'), {
      timeout: FEEL.streetView.delayMs + 500,
    });
    expect(played.filter((id) => id === 'run-won')).toHaveLength(1);
    expect(openHouse.value?.phase).toBe('on');
    expect(streetView.value).toBeNull();
  });

  it('none for a lost run or a debug run', async () => {
    await endLastWeek(10 ** 7, true);
    expect(run.value.screen).toBe('won');
    expect(run.value.debug).toBe(true);
    expect(openHouse.value).toBeNull();
    // An empty lot that falls short in its last overtime week is lost.
    await endLastWeek(0);
    for (let n = 0; n < 6 && run.value.screen === 'build'; n++) {
      endWeek();
      await settle();
    }
    expect(run.value.screen).toBe('lost');
    expect(openHouse.value).toBeNull();
    await new Promise((r) => setTimeout(r, FEEL.streetView.delayMs + 50));
    expect(played).not.toContain('run-won');
  });
});
