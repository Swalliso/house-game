// Where the tooltip's note goes (M5a): centered over its term, or under it near the top of the
// window, kept inside the window, with its tail pointing at the term. Every edge lands on a
// whole device pixel, so the note's pixel text stays crisp.

/** The note's width, in UI pixels (tip.css sets the same). */
export const NOTE_W = 160;
/** The gap between a term and the note's tail, in UI pixels. */
const GAP = 3;
/** The tail: 9 UI pixels wide and 5 tall. */
const TAIL_W = 9;
const TAIL_H = 5;
/** The note keeps this many UI pixels from the window's edges, and its tail from its corners. */
const MARGIN = 4;
const CORNER = 3;

export interface TipTerm {
  /** The term's center, and its top and bottom edges, in CSS px from the window's corner. */
  x: number;
  top: number;
  bottom: number;
  /** The note goes under the term (near the top of the window) rather than over it. */
  below: boolean;
}

export interface TipPlace {
  left: number;
  /** From the window's top, for a note under its term. */
  top?: number;
  /** From the window's bottom, for a note over its term. */
  bottom?: number;
  /** The tail's left edge, from the note's outer left edge. */
  tail: number;
}

export function placeTip(
  term: TipTerm,
  view: { w: number; h: number },
  px: number,
  dpr: number,
): TipPlace {
  const snap = (v: number) => Math.round(v * dpr) / dpr;
  const w = NOTE_W * px;
  const margin = MARGIN * px;
  const left = snap(Math.max(margin, Math.min(view.w - w - margin, term.x - w / 2)));
  const tailMin = CORNER * px;
  const tailMax = w - (TAIL_W + CORNER) * px;
  const tail = snap(Math.max(tailMin, Math.min(tailMax, term.x - left - (TAIL_W / 2) * px)));
  const gap = (GAP + TAIL_H) * px;
  return term.below
    ? { left, tail, top: snap(term.bottom + gap) }
    : { left, tail, bottom: snap(view.h - term.top + gap) };
}
