// Where the tooltip's note goes (M5a): over its term, or under it when there's no room above for
// the note (measured, not guessed), kept inside the window, with its tail pointing at the term.
// Every edge lands on a whole device pixel, so the note's pixel text stays crisp.

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
}

export interface TipPlace {
  left: number;
  /** From the window's top, for a note under its term. */
  top?: number;
  /** From the window's bottom, for a note over its term. */
  bottom?: number;
  /** The tail's left edge, from the note's outer left edge. */
  tail: number;
  /** The note sits under its term (its tail points up). */
  below: boolean;
}

/**
 * Where a note `noteH` CSS px tall goes for its term: over it if it fits there, else under it if
 * it fits there, else on the roomier side, pushed back inside the window.
 */
export function placeTip(
  term: TipTerm,
  view: { w: number; h: number },
  px: number,
  dpr: number,
  noteH: number,
): TipPlace {
  const snap = (v: number) => Math.round(v * dpr) / dpr;
  const w = NOTE_W * px;
  const margin = MARGIN * px;
  const left = snap(Math.max(margin, Math.min(view.w - w - margin, term.x - w / 2)));
  const tailMin = CORNER * px;
  const tailMax = w - (TAIL_W + CORNER) * px;
  const tail = snap(Math.max(tailMin, Math.min(tailMax, term.x - left - (TAIL_W / 2) * px)));
  const gap = (GAP + TAIL_H) * px;
  const roomAbove = term.top - gap - margin;
  const roomBelow = view.h - margin - (term.bottom + gap);
  const below = noteH > roomAbove && (noteH <= roomBelow || roomBelow > roomAbove);
  if (below) {
    const top = Math.max(margin, Math.min(term.bottom + gap, view.h - margin - noteH));
    return { left, tail, top: snap(top), below };
  }
  const bottom = Math.max(margin, Math.min(view.h - term.top + gap, view.h - margin - noteH));
  return { left, tail, bottom: snap(bottom), below };
}
