// A piece's juice on the board (D-059): its parts in each layer react together. A room's floor
// and walls, and a yard piece's ground, are drawn with the whole house, so they never move: a
// piece's items (and their parts on the overhang) wobble, its cells flash, and its digit pops.
//
// A piece's parts mount in different layers, and a part can mount after its piece's animation
// has started: a placed piece's tall tops and flash in the same commit as its items, a fixture's
// new part right after the install's wobble. So each animation is remembered while it plays, and
// a part that registers mid-flight joins it where it has got to: the parts always move as one.
//
// A placed room's furniture drops in item by item instead (D-178, `drop` below).

import { FEEL } from '../fx/feel.ts';

/** A piece's elements in each layer. */
export type Part = 'items' | 'overhang' | 'digit' | 'flash';

const parts = new Map<number, Map<Part, Element>>();

/** One animation of a piece's parts, while it plays. */
interface Flight {
  part: Part;
  frames: Keyframe[];
  options: KeyframeAnimationOptions & { duration: number };
  start: number;
}

const flights = new Map<number, Flight[]>();

/** The animations of piece `uid` still playing at `now`. */
function inFlight(uid: number, now: number): Flight[] {
  const list = (flights.get(uid) ?? []).filter((f) => now - f.start < f.options.duration);
  if (list.length > 0) flights.set(uid, list);
  else flights.delete(uid);
  return list;
}

/** Records a piece's element in a layer, joining any of its animations in flight; the returned function forgets it. */
export function register(uid: number, part: Part, el: Element): () => void {
  let m = parts.get(uid);
  if (!m) parts.set(uid, (m = new Map()));
  m.set(part, el);
  const now = performance.now();
  for (const f of inFlight(uid, now)) {
    if (f.part !== part) continue;
    const a = el.animate(f.frames, f.options);
    a.currentTime = now - f.start;
  }
  return () => {
    const cur = parts.get(uid);
    if (cur?.get(part) === el) {
      cur.delete(part);
      if (cur.size === 0) parts.delete(uid);
    }
  };
}

function get(uid: number, part: Part): Element | undefined {
  return parts.get(uid)?.get(part);
}

/** Plays an animation on one of a piece's parts, now or as soon as it registers. */
function play(
  uid: number,
  part: Part,
  frames: Keyframe[],
  options: KeyframeAnimationOptions & { duration: number },
): void {
  const start = performance.now();
  // A new animation of a part replaces the one it had in flight.
  const list = inFlight(uid, start).filter((f) => f.part !== part);
  list.push({ part, frames, options, start });
  flights.set(uid, list);
  // Forget the finished ones of pieces that won't play again (demolished, moved away).
  if (flights.size > 64) for (const u of [...flights.keys()]) inFlight(u, start);
  get(uid, part)?.animate(frames, options);
}

/** The cells flash: white over the floor, up and back down. */
function flash(uid: number, ms: number): void {
  play(uid, 'flash', [{ opacity: 0 }, { opacity: FEEL.flash.peak, offset: 0.3 }, { opacity: 0 }], {
    duration: ms,
    easing: 'ease-out',
  });
}

/** Squash-and-wobble: a scoring piece in the tally, a set's members, an installed fixture. */
export function wobble(uid: number): void {
  const s = FEEL.wobble.scale;
  const frames = [
    { transform: 'scale(1)' },
    { transform: `scale(${s}, ${2 - s})` },
    { transform: `scale(${2 - s * 0.97}, ${s * 0.97})` },
    { transform: 'scale(1)' },
  ];
  for (const part of ['items', 'overhang'] as const) {
    play(uid, part, frames, { duration: FEEL.wobble.ms, easing: 'ease-out' });
  }
  play(
    uid,
    'digit',
    [
      { transform: 'scale(1)' },
      { transform: `scale(${FEEL.digitBump})`, offset: 0.35 },
      { transform: 'scale(1)' },
    ],
    { duration: FEEL.wobble.ms, easing: 'ease-out' },
  );
  flash(uid, FEEL.wobble.ms);
}

/** A placed piece settles: its items drop in and squash, and its new floor flashes. */
export function settle(uid: number): void {
  const frames = [
    { transform: 'translateY(-6%) scale(1.06)' },
    { transform: 'translateY(0) scale(0.98)' },
    { transform: 'scale(1)' },
  ];
  for (const part of ['items', 'overhang'] as const) {
    play(uid, part, frames, { duration: FEEL.placeMs, easing: 'ease-out' });
  }
  flash(uid, FEEL.placeMs * 2);
}

// ---------------------------------------------------------------------------------------
// D-178: a placed room's furniture drops in, item by item.
//
// Each item falls and lands in turn, back to front (the room's items are listed that way: the rug
// first, then by their feet), inside FEEL.drop's budget. A raised item would slip under its room's
// north wall band, since the walls canvas lies over the items layer, and a tall one would show the
// band through it between its two halves. So an item falls as a copy of its whole sprite on the
// overhang layer, over the walls (HouseLayers.tsx draws the copies for the room just placed),
// while its own parts, its bottom in the items layer and its top on the overhang, wait hidden.
// Both halves wait out the same animation, so they show together, as the copy comes to rest over
// them in the same pixels; the copy then fades away. Every animation of a room starts in one call,
// so they share a start time.
//
// It plays at the tally speed setting, and a click, a key, the wheel or the next placement
// finishes it at once, with its thocks still to come. It never holds input: the director's beat
// still waits FEEL.placeMs, and the rest plays on while the player moves on.

/** What a room's drop needs from the board. */
export interface DropOptions {
  /** The room's items: they're its plan. An empty room still lands once, for its thock. */
  count: number;
  /** CSS px per art px, so the fall moves a whole art px at a time (D-097). */
  scale: number;
  /** The tally speed setting: the drop plays this many times as fast. */
  rate: number;
  /** As each thocking landing comes: `k` is its thock, 0 the first. */
  onLand?: (k: number) => void;
}

/** A room's drop: when each item starts, which landings thock, and when it's over. */
export interface DropPlan {
  /** Each item's start after the first's, in ms at 1×. */
  delays: readonly number[];
  /** The landings that thock: item `i`'s, as thock `k`. */
  thocks: readonly { i: number; k: number }[];
  /** When the last item is at rest, in ms at 1×. */
  endMs: number;
}

/**
 * The drop of a room of `count` items (FEEL.drop): each item starts the smaller of `staggerMs`
 * and `budgetMs / count` after the one before, so a room of many still starts its last within the
 * budget; and up to `thocks` landings thock, spread across it (the first, the middle, the last).
 */
export function dropPlan(count: number): DropPlan {
  const f = FEEL.drop;
  const n = Math.max(0, Math.floor(count));
  const step = n > 0 ? Math.min(f.staggerMs, f.budgetMs / n) : 0;
  const delays = Array.from({ length: n }, (_, i) => i * step);
  const last = Math.max(0, n - 1);
  const t = Math.min(f.thocks, last + 1);
  const thocks = Array.from({ length: t }, (_, k) => ({
    i: t === 1 ? 0 : Math.round((k * last) / (t - 1)),
    k,
  }));
  return { delays, thocks, endMs: (delays[last] ?? 0) + dropItemMs() };
}

/** One item's drop: its fall, its landing, and its copy handing over to it. */
function dropItemMs(): number {
  const f = FEEL.drop;
  return f.fallMs + f.landMs + f.swapMs;
}

/**
 * One item's copy as keyframes, over FEEL.drop's `fallMs` + `landMs` + `swapMs`: it falls
 * `fallPx` art px (`artPx` CSS px each) as a dropped thing does, slowly and then faster, a whole
 * art px at a time (each step held until the next), squashes on its foot and springs back, then
 * fades at rest over the item's own parts, which show from then on. The walls' canvas lies
 * between the two, so what it draws over the furniture (a sunny room's light) fades in, where
 * a swap at a stroke would flick it on. Opaque until then: a copy is hidden except while it drops.
 */
export function dropFrames(artPx: number): Keyframe[] {
  const f = FEEL.drop;
  const at = (ms: number) => ms / dropItemMs();
  const pose = (up: number, [sx, sy]: readonly [number, number] = [1, 1], opacity = 1) => ({
    transform: `translateY(${up > 0 ? -up * artPx : 0}px) scale(${sx}, ${sy})`,
    opacity,
  });
  const frames: Keyframe[] = [];
  // Its height t ms into the fall is fallPx × (1 − (t / fallMs)²), shown rounded up: it's `up` art
  // px above its spot from when that height comes down to `up`.
  for (let up = f.fallPx; up > 0; up--) {
    const ms = f.fallMs * Math.sqrt(1 - up / f.fallPx);
    frames.push({ ...pose(up), offset: at(ms), easing: 'steps(1, end)' });
  }
  const landed = f.fallMs + f.landMs;
  frames.push(
    { ...pose(0), offset: at(f.fallMs), easing: 'ease-out' },
    { ...pose(0, f.squash), offset: at(f.fallMs + f.landMs * 0.3), easing: 'ease-in-out' },
    { ...pose(0, f.stretch), offset: at(f.fallMs + f.landMs * 0.65), easing: 'ease-out' },
    { ...pose(0), offset: at(landed) },
    { ...pose(0, [1, 1], 0), offset: 1 },
  );
  return frames;
}

interface Dropping {
  uid: number;
  anims: Animation[];
  timers: ReturnType<typeof setTimeout>[];
}

let dropping: Dropping[] = [];

/** What finishes a drop at once: anything the player does next (Board.tsx's street view's too). */
const HURRY = ['pointerdown', 'keydown', 'wheel'] as const;
let listening = false;

function listen(on: boolean): void {
  if (on === listening || typeof window === 'undefined') return;
  listening = on;
  for (const type of HURRY) {
    if (on) window.addEventListener(type, finishDrops, true);
    else window.removeEventListener(type, finishDrops, true);
  }
}

/** A drop is over: it's forgotten, and once none plays, the player's input stops ending one. */
function forget(d: Dropping): void {
  dropping = dropping.filter((x) => x !== d);
  if (dropping.length === 0) listen(false);
  for (const t of d.timers) clearTimeout(t);
}

/** Ends a drop at once: every item at rest, and the thocks still to come never played. */
function end(d: Dropping): void {
  forget(d);
  for (const a of d.anims) {
    try {
      a.finish();
    } catch {
      // An animation that can't finish (its element gone) has nothing left to show.
    }
  }
}

/** Finishes every drop at once: the items at rest, and the thocks still to come not played. */
export function finishDrops(): void {
  for (const d of [...dropping]) end(d);
}

/** Finishes room `uid`'s drop, if it's playing. */
export function finishDrop(uid: number): void {
  for (const d of dropping.filter((x) => x.uid === uid)) end(d);
}

/** The items in a layer's container by their place in the room's list (their `data-i`). */
function byIndex(container: Element | undefined, copies: boolean): Map<number, Element> {
  const out = new Map<number, Element>();
  for (const el of Array.from(container?.children ?? [])) {
    const i = el.getAttribute('data-i');
    if (i !== null && el.classList.contains('item-drop') === copies) out.set(Number(i), el);
  }
  return out;
}

/**
 * Room `uid` was just placed: its furniture drops in, item by item, and its new floor flashes. Any
 * drop still playing finishes first, so a quick second build never plays over the first.
 */
export function drop(uid: number, o: DropOptions): void {
  finishDrops();
  const f = FEEL.drop;
  const rate = o.rate > 0 ? o.rate : 1;
  const plan = dropPlan(o.count);
  const each = dropItemMs();
  // The parts wait until the copy comes to rest over them.
  const landed = f.fallMs + f.landMs;
  const d: Dropping = { uid, anims: [], timers: [] };
  const animate = (el: Element, frames: Keyframe[], timing: KeyframeAnimationOptions) => {
    const a = el.animate(frames, timing);
    a.playbackRate = rate;
    d.anims.push(a);
  };
  const copies = byIndex(get(uid, 'overhang'), true);
  const tops = byIndex(get(uid, 'overhang'), false);
  const bottoms = byIndex(get(uid, 'items'), false);
  const frames = dropFrames(o.scale);
  for (const [i, delay] of plan.delays.entries()) {
    const copy = copies.get(i);
    // Without its copy, an item stays as it is.
    if (!copy) continue;
    animate(copy, frames, { duration: each, delay });
    // Started after the fall, so its opacity is the one shown while it plays.
    animate(copy, [{ opacity: 0 }, { opacity: 1 }], { duration: f.fadeMs, delay });
    for (const part of [bottoms.get(i), tops.get(i)]) {
      if (part) animate(part, [{ opacity: 0 }, { opacity: 0 }], { duration: delay + landed });
    }
  }
  // The floor flashes as the settle's does.
  const flashMs = FEEL.placeMs * 2;
  const floor = get(uid, 'flash');
  if (floor) {
    animate(floor, [{ opacity: 0 }, { opacity: FEEL.flash.peak, offset: 0.3 }, { opacity: 0 }], {
      duration: flashMs,
      easing: 'ease-out',
    });
  }
  for (const { i, k } of plan.thocks) {
    d.timers.push(setTimeout(() => o.onLand?.(k), ((plan.delays[i] ?? 0) + f.fallMs) / rate));
  }
  // Over once it has all played (the animations start on the next frame: a frame's grace).
  d.timers.push(setTimeout(() => forget(d), Math.max(plan.endMs, flashMs) / rate + 50));
  dropping.push(d);
  listen(true);
}
