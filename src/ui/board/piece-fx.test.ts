// A piece's parts move as one (D-059): a part that mounts after its piece's settle or wobble has
// started (a tall top on the overhang layer, the flash, a fixture's new part) joins it where it
// has got to, whichever layer registers first. A placed room's furniture drops in item by item
// (D-178): each item falls as a copy over the walls, inside the budget, and lands in its own place
// under them, or a tall one as its copy while its two halves wait hidden together; at the tally
// speed setting; and anything the player does next finishes it, never without its first thock.

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { FEEL } from '../fx/feel.ts';
import {
  drop,
  dropFrames,
  dropPlan,
  fallFrames,
  finishDrop,
  finishDrops,
  landFrames,
  register,
  settle,
  wobble,
} from './piece-fx.ts';

interface Run {
  frames: Keyframe[];
  duration: number;
  delay: number;
  currentTime: number;
  playbackRate: number;
  finished: boolean;
  finish(): void;
}

/** A stand-in for a DOM element: records the animations started on it. */
function part() {
  const runs: Run[] = [];
  const el = {
    animate(frames: Keyframe[], options: { duration: number; delay?: number }) {
      const run: Run = {
        frames,
        duration: options.duration,
        delay: options.delay ?? 0,
        currentTime: 0,
        playbackRate: 1,
        finished: false,
        finish() {
          run.finished = true;
        },
      };
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

// ---------------------------------------------------------------------------------------
// D-178: the drop.

const f = FEEL.drop;
/** One item's copy, from its start: falling, landing, then fading over the item itself. */
const EACH = f.fallMs + f.landMs + f.swapMs;
/** When an item's copy has come to rest over its own parts, from its start. */
const LANDED = f.fallMs + f.landMs;

/** An item's element in a layer: its place in its room's list, and whether it's a drop's copy. */
function item(i: number, copy = false) {
  const p = part();
  Object.assign(p.el, {
    getAttribute: (name: string) => (name === 'data-i' ? String(i) : null),
    classList: { contains: (c: string) => c === 'item-drop' && copy },
  });
  return p;
}

/** A piece's container in a layer, holding these items. */
function layer(...kids: { el: Element }[]) {
  const p = part();
  Object.assign(p.el, { children: kids.map((k) => k.el) });
  return p;
}

/** A translateY's whole CSS px, from a keyframe's transform. */
const lift = (k: Keyframe) => Number(/translateY\((-?[\d.]+)px\)/.exec(String(k.transform))?.[1]);

describe('a room’s drop', () => {
  it('starts each item 60 ms after the last, or sooner: the last within the budget', () => {
    for (let n = 1; n <= 16; n++) {
      const { delays, endMs } = dropPlan(n);
      const step = Math.min(f.staggerMs, f.budgetMs / n);
      expect(delays).toHaveLength(n);
      delays.forEach((d, i) => expect(d).toBeCloseTo(i * step, 9));
      expect(delays.at(-1)!).toBeLessThan(f.budgetMs);
      expect(endMs).toBeCloseTo(delays.at(-1)! + EACH, 9);
    }
    // A Bathroom's toilet alone; a Living Room's five; a room of eleven at 30 ms.
    expect(dropPlan(1).delays).toEqual([0]);
    expect(dropPlan(5).delays).toEqual([0, 60, 120, 180, 240]);
    expect(dropPlan(11).delays[1]).toBe(30);
    expect(f.budgetMs).toBeGreaterThanOrEqual(300);
    expect(f.budgetMs).toBeLessThanOrEqual(350);
  });

  it('thocks on its first, middle and last landing, each a step up; an empty room once', () => {
    const at = (n: number) => dropPlan(n).thocks.map(({ i, k }) => [i, k]);
    expect(at(0)).toEqual([[0, 0]]);
    expect(at(1)).toEqual([[0, 0]]);
    expect(at(2)).toEqual([
      [0, 0],
      [1, 1],
    ]);
    expect(at(3)).toEqual([
      [0, 0],
      [1, 1],
      [2, 2],
    ]);
    expect(at(8)).toEqual([
      [0, 0],
      [4, 1],
      [7, 2],
    ]);
  });

  it('falls a whole art px at a time, faster as it goes, then lands where it stands', () => {
    for (const artPx of [1, 2, 0.8]) {
      const frames = dropFrames(artPx);
      const fall = frames.filter((k) => k.easing === 'steps(1, end)');
      // Each height from fallPx down to 1 once, in whole art px, each held until the next.
      expect(fall.map((k) => lift(k) / -artPx).map((v) => Math.round(v * 1e9) / 1e9)).toEqual(
        Array.from({ length: f.fallPx }, (_, j) => f.fallPx - j),
      );
      const gaps = fall.slice(1).map((k, j) => (k.offset as number) - (fall[j]!.offset as number));
      gaps.slice(1).forEach((g, j) => expect(g).toBeLessThan(gaps[j]!));
      // Down at fallMs, opaque through its landing, and at rest as it fades over the item.
      const landed = frames[f.fallPx]!;
      expect(landed.offset).toBeCloseTo(f.fallMs / EACH, 9);
      expect(lift(landed)).toBe(0);
      expect(frames.slice(0, -1).every((k) => k.opacity === 1)).toBe(true);
      expect(frames.at(-2)).toMatchObject({ transform: 'translateY(0px) scale(1, 1)' });
      expect(frames.at(-2)!.offset).toBeCloseTo(LANDED / EACH, 9);
      expect(frames.at(-1)).toMatchObject({ transform: 'translateY(0px) scale(1, 1)', opacity: 0 });
      expect(frames.at(-1)!.offset).toBe(1);
    }
  });

  it('lands an item under the walls in its own place as its copy would have, from touchdown', () => {
    for (const artPx of [1, 2, 0.8]) {
      const copy = dropFrames(artPx);
      const falls = fallFrames(artPx);
      // Its copy falls as a tall item's does, over fallMs, opaque, and is down on its spot at the end.
      expect(falls.map((k) => k.transform)).toEqual([
        ...copy.slice(0, f.fallPx).map((k) => k.transform),
        'translateY(0px) scale(1, 1)',
      ]);
      falls.slice(0, -1).forEach((k, j) => {
        expect(k.easing).toBe('steps(1, end)');
        expect(k.offset as number).toBeCloseTo(((copy[j]!.offset as number) * EACH) / f.fallMs, 9);
      });
      expect(falls.at(-1)!.offset).toBe(1);
      expect(falls.every((k) => k.opacity === 1)).toBe(true);
    }
    // The item itself lands with the copy's squash and stretch, at the same times from touchdown.
    const landing = dropFrames(1).slice(f.fallPx, -1);
    const lands = landFrames();
    expect(lands.map((k) => [k.transform, k.easing])).toEqual(
      landing.map((k) => [k.transform, k.easing]),
    );
    lands.forEach((k, j) => {
      const ms = (landing[j]!.offset as number) * EACH;
      expect((k.offset as number) * f.landMs + f.fallMs).toBeCloseTo(ms, 9);
    });
    // Its opacity is its own: it shows once its hiding is over.
    expect(lands.every((k) => k.opacity === undefined)).toBe(true);
    // A copy is opaque by the time it touches down.
    expect(f.fadeMs).toBeLessThanOrEqual(f.fallMs);
  });

  describe('on the board', () => {
    beforeEach(() => {
      vi.useFakeTimers({ toFake: ['setTimeout', 'clearTimeout'] });
      // The player's input: a click, a key or the wheel finishes a drop.
      vi.stubGlobal('window', new EventTarget());
    });

    afterEach(() => {
      finishDrops();
      vi.useRealTimers();
      vi.unstubAllGlobals();
    });

    /** A room of three: a rug, a tall bookcase (its top over the north wall) and a chair. */
    function room(uid: number, opts: { copies?: number[] } = {}) {
      const bottoms = [item(0), item(1), item(2)];
      const top = item(1);
      const copies = (opts.copies ?? [0, 1, 2]).map((i) => item(i, true));
      const flash = part();
      reg(uid, 'items', layer(...bottoms).el);
      reg(uid, 'overhang', layer(top, ...copies).el);
      reg(uid, 'flash', flash.el);
      return { bottoms, top, copies, flash };
    }

    it('drops each item as its copy over the walls, and lands it in its own place', () => {
      const r = room(20);
      drop(20, { count: 3, scale: 2, rate: 1 });
      r.copies.forEach((c, i) => {
        const tall = i === 1;
        const [fall, fade] = c.runs;
        expect(c.runs).toHaveLength(2);
        expect(fall).toMatchObject({ delay: i * f.staggerMs, duration: tall ? EACH : f.fallMs });
        expect(fall!.frames).toEqual(tall ? dropFrames(2) : fallFrames(2));
        expect(fade).toMatchObject({ delay: i * f.staggerMs, duration: f.fadeMs });
        expect(fade!.frames).toEqual([{ opacity: 0 }, { opacity: 1 }]);
      });
      // The rug and the chair, all under the walls (and so under a garage door's rail, a side
      // wall's band or a sunny room's light, as at rest): each is hidden until its copy touches
      // down, and lands in its own place from that very moment.
      for (const i of [0, 2]) {
        const [hide, land] = r.bottoms[i]!.runs;
        expect(r.bottoms[i]!.runs).toHaveLength(2);
        expect(hide).toMatchObject({ delay: 0, duration: i * f.staggerMs + f.fallMs });
        expect(hide!.frames).toEqual([{ opacity: 0 }, { opacity: 0 }]);
        expect(land).toMatchObject({ delay: i * f.staggerMs + f.fallMs, duration: f.landMs });
        expect(land!.frames).toEqual(landFrames());
      }
      // The tall bookcase lands as its copy: its two halves wait out one animation, ending as its
      // copy comes to rest over them, and never move apart.
      const [bottom] = r.bottoms[1]!.runs;
      const [top] = r.top.runs;
      const timing = (a?: Run) => a && [a.frames, a.delay, a.duration, a.playbackRate];
      expect(r.bottoms[1]!.runs).toHaveLength(1);
      expect(r.top.runs).toHaveLength(1);
      expect(timing(bottom)).toEqual(timing(top));
      expect(bottom).toMatchObject({ delay: 0, duration: f.staggerMs + LANDED });
      expect(bottom!.frames).toEqual([{ opacity: 0 }, { opacity: 0 }]);
      // The new floor flashes, as the settle's does.
      expect(r.flash.runs).toHaveLength(1);
      expect(r.flash.runs[0]!.duration).toBe(FEEL.placeMs * 2);
    });

    it('leaves an item as it stands when its copy isn’t there', () => {
      const r = room(21, { copies: [0, 1] });
      drop(21, { count: 3, scale: 1, rate: 1 });
      expect(r.bottoms[2]!.runs).toHaveLength(0);
      expect(r.bottoms[1]!.runs).toHaveLength(1);
    });

    /** Every animation a room's drop started. */
    const runsOf = (r: ReturnType<typeof room>) =>
      [...r.copies, ...r.bottoms, r.top, r.flash].flatMap((p) => p.runs);

    it('plays at the tally speed setting, and thocks as each of its items lands', () => {
      for (const rate of FEEL.speeds) {
        const r = room(22);
        const onLand = vi.fn();
        drop(22, { count: 3, scale: 1, rate, onLand });
        // Each copy's fall and fade; the rug's and the chair's hiding and landing; the bookcase's
        // two halves' hiding; the floor's flash.
        expect(runsOf(r).length).toBe(3 * 2 + 2 * 2 + 2 + 1);
        expect(runsOf(r).every((a) => a.playbackRate === rate)).toBe(true);
        let t = 0;
        const to = (ms: number) => {
          vi.advanceTimersByTime(ms - t);
          t = ms;
        };
        // In a room of three, every item's landing thocks, each a step up.
        for (const k of [0, 1, 2]) {
          const lands = (k * f.staggerMs + f.fallMs) / rate;
          to(lands - 1);
          expect(onLand).toHaveBeenCalledTimes(k);
          to(lands + 1);
          expect(onLand).toHaveBeenCalledTimes(k + 1);
          expect(onLand).toHaveBeenLastCalledWith(k);
        }
        finishDrops();
      }
    });

    it('finishes at once on a click, a key or the wheel, and its later thocks never come', () => {
      for (const type of ['pointerdown', 'keydown', 'wheel']) {
        const r = room(23);
        const onLand = vi.fn();
        drop(23, { count: 3, scale: 1, rate: 1, onLand });
        vi.advanceTimersByTime(f.fallMs + 1);
        expect(onLand).toHaveBeenCalledTimes(1);
        expect(runsOf(r).some((a) => a.finished)).toBe(false);
        window.dispatchEvent(new Event(type));
        expect(runsOf(r).every((a) => a.finished)).toBe(true);
        vi.advanceTimersByTime(2000);
        expect(onLand).toHaveBeenCalledTimes(1);
      }
    });

    it('lands at once, with its first thock, when finished before its first item lands', () => {
      // The first thock and the dust are the placement's own (the director plays no other): a
      // double-click on End week, a key pressed straight after a build, or the next build, before
      // the first landing (fallMs at the tally speed), never leaves the room silent.
      const finishers: ((uid: number) => void)[] = [
        () => window.dispatchEvent(new Event('pointerdown')),
        () => window.dispatchEvent(new Event('keydown')),
        () => window.dispatchEvent(new Event('wheel')),
        (uid) => finishDrop(uid),
        () => drop(99, { count: 1, scale: 1, rate: 1 }),
      ];
      for (const rate of [1, 0.5]) {
        for (const [at, finish] of [0, f.fallMs / rate - 10].flatMap((ms) =>
          finishers.map((fn) => [ms, fn] as const),
        )) {
          const r = room(27);
          const onLand = vi.fn();
          drop(27, { count: 3, scale: 1, rate, onLand });
          vi.advanceTimersByTime(at);
          expect(onLand).not.toHaveBeenCalled();
          finish(27);
          expect(runsOf(r).every((a) => a.finished)).toBe(true);
          expect(onLand.mock.calls).toEqual([[0]]);
          // And never again: the later ones are cut, and the first isn't played twice.
          vi.advanceTimersByTime(2000);
          finishDrops();
          expect(onLand.mock.calls).toEqual([[0]]);
        }
      }
    });

    it('leaves the player’s input alone once it has played out', () => {
      const r = room(24);
      drop(24, { count: 3, scale: 1, rate: 1 });
      // Its items and its floor's flash have all played.
      vi.advanceTimersByTime(Math.max(dropPlan(3).endMs, FEEL.placeMs * 2) + 100);
      window.dispatchEvent(new Event('pointerdown'));
      expect(runsOf(r).some((a) => a.finished)).toBe(false);
    });

    it('is finished by the next room’s drop, so a quick second build never plays over it', () => {
      const first = room(25);
      drop(25, { count: 3, scale: 1, rate: 1 });
      const second = room(26);
      drop(26, { count: 3, scale: 1, rate: 1 });
      expect(runsOf(first).every((a) => a.finished)).toBe(true);
      expect(runsOf(second).some((a) => a.finished)).toBe(false);
      // And by its own room's next beat (HouseLayers.tsx): a move, an extension, the room going.
      finishDrop(26);
      expect(runsOf(second).every((a) => a.finished)).toBe(true);
    });
  });
});
