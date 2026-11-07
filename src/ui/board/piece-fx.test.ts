// A piece's parts move as one (D-059): a part that mounts after its piece's settle or wobble has
// started (a tall top on the overhang layer, the flash, a fixture's new part) joins it where it
// has got to, whichever layer registers first.

import { afterEach, describe, expect, it, vi } from 'vitest';
import { FEEL } from '../fx/feel.ts';
import { register, settle, wobble } from './piece-fx.ts';

/** A stand-in for a DOM element: records the animations started on it. */
function part() {
  const runs: { frames: Keyframe[]; duration: number; currentTime: number }[] = [];
  const el = {
    animate(frames: Keyframe[], options: { duration: number }) {
      const run = { frames, duration: options.duration, currentTime: 0 };
      runs.push(run);
      return run;
    },
  };
  return { el: el as unknown as Element, runs };
}

let now = 1000;
vi.spyOn(performance, 'now').mockImplementation(() => now);
const forget: (() => void)[] = [];
const reg = (uid: number, p: Parameters<typeof register>[1], el: Element) =>
  forget.push(register(uid, p, el));

afterEach(() => {
  forget.splice(0).forEach((f) => f());
  now += 10_000;
});

describe('a piece’s parts', () => {
  it('settle together when its items start the settle before its top and flash register', () => {
    const items = part();
    const top = part();
    const flash = part();
    reg(7, 'items', items.el);
    settle(7);
    expect(items.runs).toHaveLength(1);
    // The overhang and the flash mount later in the same commit, a few ms on.
    now += 4;
    reg(7, 'overhang', top.el);
    reg(7, 'flash', flash.el);
    expect(top.runs).toHaveLength(1);
    expect(top.runs[0]!.frames).toEqual(items.runs[0]!.frames);
    expect(top.runs[0]!.currentTime).toBe(4);
    expect(flash.runs).toHaveLength(1);
  });

  it('join an install’s wobble when a fixture’s new part mounts after it', () => {
    const items = part();
    reg(8, 'items', items.el);
    wobble(8);
    now += 30;
    const top = part();
    reg(8, 'overhang', top.el);
    expect(top.runs).toHaveLength(1);
    expect(top.runs[0]!.duration).toBe(FEEL.wobble.ms);
    expect(top.runs[0]!.currentTime).toBe(30);
  });

  it('don’t replay an animation that has finished', () => {
    const items = part();
    reg(9, 'items', items.el);
    settle(9);
    now += FEEL.placeMs * 2 + 1;
    const late = part();
    reg(9, 'overhang', late.el);
    reg(9, 'flash', late.el);
    expect(late.runs).toHaveLength(0);
  });
});
