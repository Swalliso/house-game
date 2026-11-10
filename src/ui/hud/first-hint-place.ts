// Where a first-time hint's card goes (D-045, M4b; in the pixel UI's units, D-110): by the panel
// it talks about, never over the lot or a sheet's controls, and never off the window's foot.
// FirstHints.tsx measures the panels; this works out the box, so it can be tested without a
// browser. Every edge lands on a whole device pixel, so the card's pixel text stays crisp.

/**
 * - besideChecklist: right of the left column, level with the checklist, over the lot's edge.
 * - overChecklist: over the checklist, in the left column (week 1's hint, before the checklist's
 *   own, so the score panel it names stays in view).
 * - overScore: over the score panel, at the top of the left column.
 * - underGoods: in the right column, under the company's goods: the shop leaves that empty, and
 *   a change order's sheet sets the hand there aside.
 */
export type HintSpot = 'besideChecklist' | 'overChecklist' | 'overScore' | 'underGoods';

/** A box in CSS px from the window's top left, as getBoundingClientRect gives it. */
export interface Box {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

/**
 * The boxes a card is placed by. A panel that isn't laid out (display: none, as the strip is
 * on a short window with nothing to show, or the goods with nothing in them) is left out: it's
 * missing, not a box at the window's corner.
 */
export interface HintAnchors {
  /** The side columns. */
  left: Box;
  right: Box;
  score?: Box;
  checklist?: Box;
  /** The company's goods, in the right column. */
  inventory?: Box;
  /** The controls strip under the board. */
  strip?: Box;
}

export interface HintPlace {
  spot: HintSpot;
  left: number;
  top: number;
  width: number;
  /** The card's tallest: down to the floor of where it sits. Its text scrolls inside it. */
  maxHeight: number;
}

/** The gap between a card and the panel it sits by, in UI pixels. */
export const GAP = 4;
/** The most a card beside the checklist is wide, in UI pixels. */
export const BESIDE_WIDTH = 150;
/** The least height a card keeps, in UI pixels, however close its floor is. */
export const MIN_HEIGHT = 60;

/**
 * Where the card for `spot` goes, in a window `view` CSS px wide and tall, with UI pixels `px`
 * CSS px wide at `dpr` device pixels per CSS px. `height` is the card's own height at that
 * width, once it's known (its whole text, unscrolled).
 *
 * Its floor: a card in a side column stops at the column's foot (above the controls strip, or
 * the window's foot on a short window, where the strip sits under the board only: D-098), and
 * the card beside the checklist, over the board, stops above the strip (the window's foot when
 * the strip is hidden). A card by the checklist that's taller than the room under the
 * checklist's top rises until it fits, up to the left column's top: on a short window in week
 * 1 the checklist sits low, under the score panel's suggestion for a first set, and the card
 * covers that rather than scroll its text in a sliver. A card under the goods sits at the right
 * column's top when there are none to show.
 */
export function placeFirstHint(
  spot: HintSpot,
  a: HintAnchors,
  view: { w: number; h: number },
  px: number,
  dpr: number,
  height?: number,
): HintPlace {
  const snap = (v: number) => Math.round(v * dpr) / dpr;
  const gap = GAP * px;
  const strip = a.strip?.top ?? view.h;
  const column = spot === 'underGoods' ? a.right : a.left;
  const floor = Math.min(view.h, spot === 'besideChecklist' ? strip : column.bottom) - gap;
  const box = (top: number, x: number, width: number): HintPlace => ({
    spot,
    left: snap(x),
    top: snap(top),
    width: snap(width),
    maxHeight: snap(Math.max(MIN_HEIGHT * px, floor - top)),
  });
  /** A top by the checklist, risen as far as the card needs and the column allows. */
  const rise = (top: number) =>
    height === undefined || top + height <= floor
      ? top
      : Math.min(top, Math.max(a.left.top + gap, floor - height));
  const width = (b: Box) => b.right - b.left;
  switch (spot) {
    case 'besideChecklist': {
      const c = a.checklist ?? a.left;
      const room = view.w - a.left.right - 2 * gap;
      return box(rise(c.top), a.left.right + gap, Math.min(BESIDE_WIDTH * px, room));
    }
    case 'overChecklist': {
      const c = a.checklist ?? a.left;
      return box(rise(c.top), c.left, width(c));
    }
    case 'overScore': {
      const p = a.score ?? a.left;
      return box(p.top, p.left, width(p));
    }
    case 'underGoods': {
      const inv = a.inventory;
      if (inv) return box(inv.bottom + gap, inv.left, width(inv));
      return box(a.right.top + gap, a.right.left + gap, width(a.right) - 2 * gap);
    }
  }
}
