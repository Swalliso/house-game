// A piece's juice on the board (D-059): its parts in each layer react together. A room's floor
// and walls, and a yard piece's ground, are drawn with the whole house, so they never move: a
// piece's items (and their parts on the overhang) wobble, its cells flash, and its digit pops.
//
// A piece's parts mount in different layers, and a part can mount after its piece's animation
// has started: a placed piece's tall tops and flash in the same commit as its items, a fixture's
// new part right after the install's wobble. So each animation is remembered while it plays, and
// a part that registers mid-flight joins it where it has got to: the parts always move as one.

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
