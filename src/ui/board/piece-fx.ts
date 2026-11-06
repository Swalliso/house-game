// A piece's juice on the board (D-059): its parts in each layer react together. A room's floor
// and walls are drawn with the whole house, so they never move: its items (and their parts on
// the overhang) wobble, its floor flashes, and its digit pops. A yard piece is still one
// element (until its art moves to the house layers) and wobbles whole.

import { FEEL } from '../fx/feel.ts';

/** A piece's elements in each layer. */
export type Part = 'items' | 'overhang' | 'yard' | 'digit' | 'flash';

const parts = new Map<number, Map<Part, Element>>();

/** Records a piece's element in a layer; the returned function forgets it. */
export function register(uid: number, part: Part, el: Element): () => void {
  let m = parts.get(uid);
  if (!m) parts.set(uid, (m = new Map()));
  m.set(part, el);
  return () => {
    const now = parts.get(uid);
    if (now?.get(part) === el) {
      now.delete(part);
      if (now.size === 0) parts.delete(uid);
    }
  };
}

function get(uid: number, part: Part): Element | undefined {
  return parts.get(uid)?.get(part);
}

/** The cells flash: white over the floor, up and back down. */
function flash(uid: number, ms: number): void {
  get(uid, 'flash')?.animate(
    [{ opacity: 0 }, { opacity: FEEL.flash.peak, offset: 0.3 }, { opacity: 0 }],
    { duration: ms, easing: 'ease-out' },
  );
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
  for (const part of ['items', 'overhang', 'yard'] as const) {
    get(uid, part)?.animate(frames, { duration: FEEL.wobble.ms, easing: 'ease-out' });
  }
  get(uid, 'digit')?.animate(
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
  for (const part of ['items', 'overhang', 'yard'] as const) {
    get(uid, part)?.animate(frames, { duration: FEEL.placeMs, easing: 'ease-out' });
  }
  flash(uid, FEEL.placeMs * 2);
}
