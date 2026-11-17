// D-178: a placed room's furniture drops in on the board (piece-fx.ts drop), and none of it holds
// the player up: the placement's beat in the director still waits FEEL.placeMs, at the tally
// speed setting, and no more, as it did before; the drop plays on past it. The director asks the
// board for the drop only where it can play: a room, with motion on, and no newer action waiting.
// Its thocks come from the board as the items land (dropLanded).
//
// The store and the director play a real run here, with frames every 16 ms of a fake clock.

import { effect } from '@preact/signals';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { rules, type PieceId, type RunSetup } from '../../rules/index.ts';
import { dropPlan } from '../board/piece-fx.ts';
import { audio } from '../audio/audio.ts';
import { settings } from '../settings.ts';
import { debugAction, endWeek, run, startRun, tentative } from '../store.ts';
import { busy, dropLanded, instantTally, justPlaced } from './director.ts';
import { FEEL } from './feel.ts';

const SETUP: RunSetup = {
  seed: 'drop-beat',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};
const FRAME = 16;
const start = settings.value;

/** Builds a piece from Your goods (D-163: at once, the week goes on), as End week does. */
function build(id: PieceId): number {
  debugAction({ t: 'debug', op: 'giveGood', good: { kind: 'piece', id } });
  const s = run.value;
  const i = s.reserve.findIndex((g) => g.id === id);
  for (let y = 2; y < s.house.lot.height; y++) {
    for (let x = 2; x < s.house.lot.width; x++) {
      const play = { t: 'place', from: 'reserve', i, x, y, rot: 0 } as const;
      if (!rules.checkPlay(s, play).legal) continue;
      tentative.value = play;
      endWeek();
      return run.value.house.pieces.at(-1)!.uid;
    }
  }
  throw new Error(`nowhere to build a ${id}`);
}

/** How long the placement's beat held input: until busy went, in fake ms. */
async function heldFor(id: PieceId): Promise<number> {
  const from = performance.now();
  build(id);
  expect(busy.value).toBe(true);
  while (busy.value) await vi.advanceTimersByTimeAsync(1);
  return performance.now() - from;
}

describe('a placement’s beat', () => {
  beforeEach(() => {
    vi.useFakeTimers();
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), FRAME),
    );
    vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [] });
    instantTally.value = false;
    settings.value = { ...start, reduceMotion: false, tallySpeed: 1 };
    startRun(SETUP);
  });

  afterEach(async () => {
    // The director's chain goes quiet before the clock is real again.
    while (busy.value) await vi.advanceTimersByTimeAsync(FRAME);
    await vi.runOnlyPendingTimersAsync();
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
    settings.value = start;
  });

  it('holds input FEEL.placeMs and no longer, room or yard piece, at every speed', async () => {
    for (const speed of FEEL.speeds) {
      settings.value = { ...settings.value, tallySpeed: speed };
      const hold = FEEL.placeMs / speed;
      for (const id of ['bedroom', 'lawn'] as const) {
        const held = await heldFor(id);
        expect(held).toBeGreaterThanOrEqual(hold);
        expect(held).toBeLessThanOrEqual(hold + FRAME + 1);
      }
      // A room's drop plays on past it, while the player moves on.
      expect(dropPlan(3).endMs / speed).toBeGreaterThan(hold);
    }
  });

  it('asks the board to drop a room in, and leaves its thocks to the landings', async () => {
    const play = vi.spyOn(audio, 'play');
    const uid = build('bedroom');
    await vi.advanceTimersByTimeAsync(0);
    expect(justPlaced.value).toMatchObject({ uid, drop: true });
    const thocks = () => play.mock.calls.filter(([id]) => id === 'place-room');
    expect(thocks()).toEqual([]);
    // What the board calls as the first, middle and last items land: each a step higher.
    for (const k of [0, 1, 2]) dropLanded(uid, k);
    const step = 2 ** (FEEL.drop.thockSemitones / 12);
    expect(thocks()).toEqual([
      ['place-room', undefined],
      ['place-room', { rate: step, gain: FEEL.drop.thockGain }],
      ['place-room', { rate: step * step, gain: FEEL.drop.thockGain }],
    ]);
  });

  it('settles a yard piece as before, with its sound at once', async () => {
    const play = vi.spyOn(audio, 'play');
    const uid = build('lawn');
    await vi.advanceTimersByTimeAsync(0);
    expect(justPlaced.value).toEqual({ uid, id: justPlaced.value!.id });
    expect(play.mock.calls.filter(([id]) => id === 'place-yard')).toHaveLength(1);
  });

  it('drops nothing with Reduce motion, and the room thocks at once, as before', async () => {
    settings.value = { ...settings.value, reduceMotion: true };
    const play = vi.spyOn(audio, 'play');
    const uid = build('bedroom');
    await vi.advanceTimersByTimeAsync(0);
    expect(justPlaced.value).toEqual({ uid, id: justPlaced.value!.id });
    expect(play.mock.calls.filter(([id]) => id === 'place-room')).toHaveLength(1);
  });

  it('drops nothing on the ?debug panel’s instant tally', async () => {
    instantTally.value = true;
    const uid = build('bedroom');
    await vi.advanceTimersByTimeAsync(0);
    expect(justPlaced.value).toEqual({ uid, id: justPlaced.value!.id });
  });

  it('drops nothing for a placement a newer one has hurried', async () => {
    const seen: { uid: number; drop?: true }[] = [];
    const stop = effect(() => {
      const p = justPlaced.value;
      if (p) seen.push(p);
    });
    const first = build('bedroom');
    const second = build('kitchen');
    while (busy.value) await vi.advanceTimersByTimeAsync(1);
    stop();
    expect(seen.map((p) => [p.uid, p.drop ?? false])).toEqual([
      [first, false],
      [second, true],
    ]);
  });
});
