// D-181: a finished room's lamp coming on. The flicker keeps the Flashing setting's promise
// (never more than three flashes a second, none with it off), and the director holds a light
// off from the action that finishes its room until that action's beat switches it on; with
// Reduce motion, and in a run loaded or started afresh, it's simply on.
//
// The store and the director play real runs here, on a house made for the test.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { CONTENT, isFinished, type ClientId, type RunSetup } from '../../rules/index.ts';
import { emptyRows, houseFrom } from '../../rules/testing.ts';
import { lampSpot } from '../art/house-paint.ts';
import { audio } from '../audio/audio.ts';
import { hallLinks, houseModel, sunLight } from '../board/house-model.ts';
import { settings } from '../settings.ts';
import { CELL } from '../sprites.ts';
import { installSupply, run, startRun } from '../store.ts';
import { busy, fxHooks, instantTally, lightsHeld, lightSwitched } from './director.ts';
import { FEEL } from './feel.ts';
import { lightOnFrames } from './light.ts';

/** When the light falls (a flash), in ms from the start, for keyframes played over `ms`. */
function falls(frames: readonly Keyframe[], ms: number): number[] {
  const out: number[] = [];
  for (let i = 1; i < frames.length; i++) {
    if (Number(frames[i]!.opacity) < Number(frames[i - 1]!.opacity))
      out.push(Number(frames[i]!.offset ?? i / (frames.length - 1)) * ms);
  }
  return out;
}

describe('the light’s flicker', () => {
  it('comes on at once and ends on, under three flashes in any second', () => {
    const { frames, ms } = lightOnFrames(true);
    expect(frames[0]).toMatchObject({ opacity: 1, offset: 0 });
    expect(frames.at(-1)).toMatchObject({ opacity: 1, offset: 1 });
    const offsets = frames.map((f) => Number(f.offset));
    expect(offsets).toEqual([...offsets].sort((a, b) => a - b));
    const at = falls(frames, ms);
    expect(at).toHaveLength(FEEL.lightOn.dips.length);
    for (const t of at) expect(at.filter((u) => u >= t && u < t + 1000).length).toBeLessThan(3);
  });

  it('fades in with Flashing off: it never dims on the way', () => {
    const { frames, ms } = lightOnFrames(false);
    expect(ms).toBe(FEEL.lightOn.fadeMs);
    expect(falls(frames, ms)).toEqual([]);
    expect(frames[0]).toMatchObject({ opacity: 0 });
    expect(frames.at(-1)).toMatchObject({ opacity: 1 });
  });
});

const SETUP: RunSetup = {
  seed: 'lights-on',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
};

/** A run with a Bedroom grown by Extend (uid 1) and a Fireplace in the supplies. */
function ready(): void {
  startRun(SETUP);
  const h = houseFrom(CONTENT, emptyRows(12, 12), [['bedroom', 2, 2]]);
  run.value = {
    ...run.value,
    house: { ...h, pieces: h.pieces.map((p) => ({ ...p, extended: 1 })) },
    supplies: [{ kind: 'fixture', id: 'fireplace' }],
  };
}

const lightOns = (play: { mock: { calls: unknown[][] } }) =>
  play.mock.calls.filter(([id]) => id === 'light-on').length;

describe('the light coming on', () => {
  const before = settings.value;
  let now = 0;

  beforeEach(() => {
    // The beats wait on frames: here they're a timer's turn, 50 ms apart.
    vi.spyOn(performance, 'now').mockImplementation(() => (now += 50));
    vi.stubGlobal('requestAnimationFrame', (cb: FrameRequestCallback) =>
      setTimeout(() => cb(performance.now()), 0),
    );
    // The bursts look for their elements, and find none.
    vi.stubGlobal('document', { querySelector: () => null, querySelectorAll: () => [] });
    instantTally.value = false;
    settings.value = { ...before, reduceMotion: false };
  });

  afterEach(async () => {
    await vi.waitFor(() => expect(busy.value).toBe(false));
    settings.value = before;
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it('holds the light of the room an action finishes, until its beat switches it on', async () => {
    ready();
    const play = vi.spyOn(audio, 'play');
    expect(installSupply(0, 1)).toBe(true);
    expect(isFinished(run.value.house.pieces[0]!)).toBe(true);
    // The render this action queued shows the room finished, its light still off.
    expect(lightsHeld.value.has(1)).toBe(true);
    expect(busy.value).toBe(true);
    await vi.waitFor(() => expect(busy.value).toBe(false));
    expect(lightsHeld.value.size).toBe(0);
    expect(lightSwitched.value).toMatchObject({ uid: 1 });
    expect(lightOns(play)).toBe(1);
  });

  it('with Reduce motion, the light is on with the room', async () => {
    settings.value = { ...settings.value, reduceMotion: true };
    ready();
    installSupply(0, 1);
    expect(lightsHeld.value.size).toBe(0);
    await vi.waitFor(() => expect(busy.value).toBe(false));
    expect(lightsHeld.value.size).toBe(0);
  });

  it('sends its glints from the lamp the board lights, in the client’s own room too (D-183)', async () => {
    // The Barkers' first Living Room, grown by Extend, with their dogs' bed in it.
    startRun({ ...SETUP, clientId: 'barkers' });
    const h = houseFrom(CONTENT, emptyRows(12, 12), [['livingRoom', 2, 2]]);
    run.value = {
      ...run.value,
      house: { ...h, pieces: h.pieces.map((p) => ({ ...p, extended: 1 })) },
      supplies: [{ kind: 'fixture', id: 'fireplace' }],
    };
    const bursts: { x: number; y: number }[] = [];
    const toScreen = fxHooks.toScreen;
    fxHooks.toScreen = (x, y) => {
      bursts.push({ x, y });
      return null;
    };
    try {
      expect(installSupply(0, 1)).toBe(true);
      await vi.waitFor(() => expect(busy.value).toBe(false));
    } finally {
      fxHooks.toScreen = toScreen;
    }
    const s = run.value;
    const lamp = (client?: ClientId) =>
      lampSpot(houseModel(s.house, hallLinks(s), sunLight(s), client), 1)!;
    const theirs = lamp('barkers');
    // Their dogs' bed moves the lamp: a house without them would light it elsewhere.
    expect(theirs).not.toEqual(lamp());
    expect(bursts).toContainEqual({ x: theirs.x / CELL, y: theirs.y / CELL });
  });

  it('a new run lets go of a light still waiting for its beat', async () => {
    ready();
    installSupply(0, 1);
    expect(lightsHeld.value.has(1)).toBe(true);
    startRun(SETUP);
    expect(lightsHeld.value.size).toBe(0);
  });
});
