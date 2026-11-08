// Where a piece's labels go on the board (§12, Numbers): its weekly score's digit in its
// bottom-right cell, and its badges in its top corners (a fixture that can't be drawn at the top
// right, an unmet requirement's ⚠ at the top left), inside its walls. Pure: the labels layer
// (HouseLayers.tsx) places its elements where this says, and the tests hold it to its promise.
//
// The badges grow with the cell, and shrink with it below 1× (min(max(14, 6u), max(9, 0.45 ×
// the cell)), u a sixteenth of a cell, and never under their icon and ring at a device pixel
// each), on whole device pixels, with their pixel icon at whole device pixels per icon pixel and
// an ink ring one icon pixel wide. Where a badge in the digit's row would touch it (a one-cell
// piece, or a one-row piece's fixture), it rises to its cell's top edge and the digit drops
// toward the cell's bottom edge, over the wall bands, as far as it takes to keep them apart; in
// a cell too small even for that, the badge shrinks. So a badge never covers the digit, at any
// zoom.
//
// The labels also keep off what isn't their piece's (`keepOff`): another piece's prop that rises
// into its cells (a Greenhouse's roof 14 art px, the Treehouse 25, a Birdhouse, a car's roof), a
// tree's crown that does, and a door's mat. A digit there would read as that prop's, and a badge
// would hide the mat. The digit rises above it, up into its own cells above if it must, or moves
// left past it, whichever is the shorter move that keeps it on its piece, and stays as far from
// it as a badge from its corner; where neither move does (a one-row piece in front of a
// Treehouse), it rises as high as its piece allows. It never takes a badge's room for its icon
// (minBadge) to get clear, and drops back onto what it keeps off rather than squeeze a badge out
// of its icon: a purchase is always visible (D-100). A badge moves down or inward past it the
// same way, never onto the digit or the other badge, or stays put.

import type { Cell } from '../../rules/index.ts';
import { cellUnit } from '../sprites.ts';
import { digitCell } from './geometry.ts';

export type Side = 'N' | 'E' | 'S' | 'W';

/** A box on the board, in CSS px. */
export interface Box {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A badge's box, and how its ring and icon fit in it. */
export interface BadgeSpot extends Box {
  /** The ink ring's width, in CSS px: one icon pixel. */
  readonly ring: number;
  /** CSS px per icon pixel; 0 when there's no room for the icon (just the ring and its fill). */
  readonly icon: number;
}

export interface DigitSpot {
  /** The digit box's right and bottom edges, in CSS px: it grows left and up from there. */
  readonly right: number;
  readonly bottom: number;
  /** Its font size in CSS px, which is its box's height (line-height 1). */
  readonly font: number;
}

export interface PieceLabels {
  readonly digit?: DigitSpot;
  readonly fixture?: BadgeSpot;
  readonly unmet?: BadgeSpot;
}

export interface LabelInput {
  /** The piece's cells on the lot. */
  readonly cells: readonly Cell[];
  /** How deep cell c's wall on `side` reaches into it, in CSS px (0 for a yard piece). */
  readonly inset: (c: Cell, side: Side) => number;
  /** A cell's size, in CSS px. */
  readonly px: number;
  readonly dpr: number;
  /** The digit's length in characters (the week's score as shown), or null with no digit. */
  readonly digit: number | null;
  readonly fixture: boolean;
  readonly unmet: boolean;
  /**
   * What the labels keep off where they can, in CSS px: other pieces' props that rise into this
   * piece's cells (yard.ts risingParts), the trees' crowns that do (terrain/objects.ts
   * canopyParts) and the doors' mats. Boxes clear of its labels change nothing.
   */
  readonly keepOff?: readonly Box[];
}

/** The icons' sizes in icon pixels (theme/icons.ts): a fixture's, and the ⚠'s. */
export const BADGE_ICON = { fixture: 8, unmet: 9 } as const;

/** The digit's box sits this far in from its corner, in CSS px. */
const DIGIT_IN = { right: 2, bottom: 1 } as const;

/** A step toward each side, in cells. */
const STEP: Readonly<Record<Side, readonly [number, number]>> = {
  N: [0, -1],
  E: [1, 0],
  S: [0, 1],
  W: [-1, 0],
};

/** The digit's size: it grows with the zoom, never under 11 CSS px. */
export function digitFont(px: number): number {
  return Math.max(11, 5 * cellUnit(px));
}

/**
 * A badge's size before it's fitted to whole device pixels, in CSS px: 14 at 1×, growing with
 * the zoom, smaller below 1× but never under 9 CSS px, nor under its icon and ring at one device
 * pixel each (`iconW` icon pixels wide).
 */
export function badgeSize(px: number, iconW: number, dpr: number): number {
  const u = cellUnit(px);
  return Math.min(Math.max(14, 6 * u), Math.max(9, (iconW + 2) / dpr, 0.45 * px));
}

/**
 * A badge of about `size` CSS px around an icon `iconW` icon pixels wide, on whole device pixels:
 * the largest whole device pixels per icon pixel (k) that leave room for the ring (k each side)
 * and a device pixel of paper, the paper even on both sides so the icon sits centered; in a badge
 * too small for paper, the icon meets its ring. Too small for an icon at one device pixel per icon
 * pixel, it's just its ring and fill.
 */
export function fitBadge(
  size: number,
  iconW: number,
  dpr: number,
): { size: number; ring: number; icon: number } {
  const dev = Math.max(2, Math.floor(size * dpr + 1e-6));
  const k = Math.floor((dev - 2) / (iconW + 2));
  if (k >= 1) {
    const paper = Math.floor((dev - (iconW + 2) * k) / 2);
    return { size: ((iconW + 2) * k + 2 * paper) / dpr, ring: k / dpr, icon: k / dpr };
  }
  if (dev >= iconW + 2) return { size: (iconW + 2) / dpr, ring: 1 / dpr, icon: 1 / dpr };
  return { size: dev / dpr, ring: 1 / dpr, icon: 0 };
}

/**
 * The smallest badge that still shows its icon, in CSS px: the icon at a device pixel per icon
 * pixel in its ring, never under 9 CSS px (badgeSize's floor), on whole device pixels.
 */
export function minBadge(iconW: number, dpr: number): number {
  return fitBadge(Math.max(9, (iconW + 2) / dpr), iconW, dpr).size;
}

const snap = (v: number, dpr: number) => Math.round(v * dpr) / dpr;

/** Where the piece's digit and badges go. */
export function pieceLabels(o: LabelInput): PieceLabels {
  const { cells, inset, px, dpr } = o;
  if (cells.length === 0) return {};
  const same = (a: Cell, b: Cell) => a.x === b.x && a.y === b.y;
  // The digit's cell: the bottom-right one (§12, Numbers). The badges' cells: the top row's ends.
  const d = digitCell(cells);
  const top = Math.min(...cells.map((c) => c.y));
  const row = cells.filter((c) => c.y === top);
  const tr = row.reduce((a, b) => (b.x > a.x ? b : a));
  const tl = row.reduce((a, b) => (b.x < a.x ? b : a));
  const gap = Math.max(1, cellUnit(px));
  const font = digitFont(px);

  const chars = o.digit ?? 0;
  let digit: DigitSpot | undefined =
    o.digit !== null
      ? {
          right: snap((d.x + 1) * px - inset(d, 'E') - DIGIT_IN.right, dpr),
          bottom: snap((d.y + 1) * px - inset(d, 'S') - DIGIT_IN.bottom, dpr),
          font,
        }
      : undefined;

  // What isn't the piece's: another piece's prop rising into its cells, a door's mat.
  const keep = o.keepOff ?? [];
  const own = new Set(cells.map((c) => `${c.x},${c.y}`));
  /** The far edge, inside the walls, of the piece's own cells in a line from `c` toward `side`. */
  const reach = (c: Cell, side: Side): number => {
    const [dx, dy] = STEP[side];
    let at = c;
    while (own.has(`${at.x + dx},${at.y + dy}`)) at = { x: at.x + dx, y: at.y + dy };
    if (side === 'N') return at.y * px + inset(at, 'N');
    if (side === 'S') return (at.y + 1) * px - inset(at, 'S');
    if (side === 'W') return at.x * px + inset(at, 'W');
    return (at.x + 1) * px - inset(at, 'E');
  };
  /**
   * How far box `b` slides along (dx, dy) to clear every box of `off` it meets, by `margin`, in
   * whole device pixels; null if that's more than `limit`.
   */
  const slide = (
    b: Box,
    dx: number,
    dy: number,
    margin: number,
    limit: number,
    off: readonly Box[],
  ): number | null => {
    let t = 0;
    for (let i = 0; i <= off.length + 1; i++) {
      const at = { ...b, x: b.x + dx * t, y: b.y + dy * t };
      const hit = off.filter((k) => overlaps(at, k));
      if (hit.length === 0) return t;
      const past = (k: Box) =>
        dx < 0
          ? b.x + b.w - k.x
          : dx > 0
            ? k.x + k.w - b.x
            : dy < 0
              ? b.y + b.h - k.y
              : k.y + k.h - b.y;
      t = Math.ceil((Math.max(...hit.map(past)) + margin) * dpr - 1e-6) / dpr;
      if (t > limit + 1e-6) return null;
    }
    return null;
  };

  // The digit keeps off them, `gap` away: it rises above, or moves left past them, whichever is
  // shorter and keeps it on its own cells; else it rises as high as they allow. A badge whose
  // cell it would rise into keeps the room for its icon above it (minBadge: D-100's "a purchase
  // is always visible"), from its cell's top edge, where the badge can rise to. `floor` is the
  // lowest its bottom may drop to below (for a badge in its cell), staying clear; one that
  // couldn't get clear may still drop to its cell's bottom edge, so a badge keeps its icon.
  let floor = (d.y + 1) * px;
  if (digit && keep.length > 0) {
    const box = digitBox(digit, chars);
    if (keep.some((k) => overlaps(box, k))) {
      const room = (cell: Cell, iconW: number) =>
        box.x < (cell.x + 1) * px && cell.x * px < box.x + box.w ? minBadge(iconW, dpr) : 0;
      const reserve = Math.max(
        o.fixture ? room(tr, BADGE_ICON.fixture) : 0,
        o.unmet ? room(tl, BADGE_ICON.unmet) : 0,
      );
      const ceiling = Math.max(reach(d, 'N'), reserve > 0 ? top * px + reserve : -Infinity);
      const upRoom = Math.max(0, box.y - ceiling);
      const up = slide(box, 0, -1, gap, upRoom, keep);
      const left = slide(box, -1, 0, gap, Math.max(0, box.x - reach(d, 'W')), keep);
      if (left !== null && (up === null || left < up)) {
        digit = { ...digit, right: digit.right - left };
      } else {
        const lift = up ?? Math.floor(upRoom * dpr + 1e-6) / dpr;
        digit = { ...digit, bottom: digit.bottom - lift };
      }
    }
    const b = digitBox(digit, chars);
    if (!keep.some((k) => overlaps(b, k))) {
      const below = keep.filter(
        (k) => k.x < b.x + b.w - 1e-6 && b.x < k.x + k.w - 1e-6 && k.y + k.h > b.y,
      );
      const tops = below.map((k) => Math.floor((k.y - gap) * dpr + 1e-6) / dpr);
      floor = Math.max(digit.bottom, Math.min(floor, ...tops));
    }
  }

  type Spot = { x: number; y: number; size: number; ring: number; icon: number };
  const spot = (
    cell: Cell,
    iconW: number,
    right: boolean,
    size = badgeSize(px, iconW, dpr),
  ): Spot => {
    const b = fitBadge(size, iconW, dpr);
    const x = right
      ? (cell.x + 1) * px - inset(cell, 'E') - gap - b.size
      : cell.x * px + inset(cell, 'W') + gap;
    // Its top on a whole device pixel already (place() floors it), so a slide is exact.
    const y = Math.floor((cell.y * px + inset(cell, 'N') + gap) * dpr + 1e-6) / dpr;
    return { x, y, ...b };
  };
  let fixture = o.fixture ? spot(tr, BADGE_ICON.fixture, true) : undefined;
  let unmet = o.unmet ? spot(tl, BADGE_ICON.unmet, false) : undefined;
  const boxOf = (b: Spot): Box => ({ x: b.x, y: b.y, w: b.size, h: b.size });

  // Two badges in one cell (a piece one cell wide at the top) keep apart: out to the cell's
  // sides, then smaller.
  if (fixture && unmet && same(tl, tr) && unmet.x + unmet.size > fixture.x) {
    const left = tl.x * px;
    const right = (tl.x + 1) * px;
    unmet = { ...unmet, x: left };
    fixture = { ...fixture, x: right - fixture.size };
    if (unmet.x + unmet.size > fixture.x) {
      const each = (px - 1 / dpr) / 2;
      const a = fitBadge(each, BADGE_ICON.unmet, dpr);
      const b = fitBadge(each, BADGE_ICON.fixture, dpr);
      unmet = { ...unmet, ...a };
      fixture = { ...fixture, ...b, x: right - b.size };
    }
  }

  // A badge keeps off what isn't its piece's too: it moves down, or inward (the fixture's left,
  // the ⚠ right), past it, whichever is shorter and keeps it on its own cells and off the digit
  // and the other badge; else it stays put.
  const avoid = (
    b: Spot | undefined,
    cell: Cell,
    right: boolean,
    other: Spot | undefined,
  ): Spot | undefined => {
    if (!b || keep.length === 0) return b;
    const box = boxOf(b);
    if (!keep.some((k) => overlaps(box, k))) return b;
    const off = [
      ...keep,
      ...(digit ? [digitBox(digit, chars)] : []),
      ...(other ? [boxOf(other)] : []),
    ];
    const down = slide(box, 0, 1, gap, reach(cell, 'S') - (box.y + box.h), off);
    const across = right
      ? slide(box, -1, 0, gap, box.x - reach(cell, 'W'), off)
      : slide(box, 1, 0, gap, reach(cell, 'E') - (box.x + box.w), off);
    if (across !== null && (down === null || across < down)) {
      return { ...b, x: b.x + (right ? -across : across) };
    }
    return down !== null ? { ...b, y: b.y + down } : b;
  };
  fixture = avoid(fixture, tr, true, unmet);
  unmet = avoid(unmet, tl, false, fixture);

  // A badge that would touch the digit (in its row, or above it where the digit rose) keeps above
  // it instead: it rises to its cell's top edge, then the digit drops toward its cell's bottom
  // edge (no further than `floor`, unless the badge would lose its icon), then the badge shrinks
  // to the room that's left, keeping its outer edge where it was (so one moved off a mat stays
  // off it). (A digit grows left from its corner, so a long one can reach a cell to its left.)
  const clear = (
    b: Spot | undefined,
    cell: Cell,
    iconW: number,
    right: boolean,
  ): Spot | undefined => {
    if (!b || !digit) return b;
    if (!overlaps(boxOf(b), digitBox(digit, chars))) return b;
    const cellTop = cell.y * px;
    const digitTop = () => digit!.bottom - digit!.font;
    if (b.y + b.size > digitTop()) b = { ...b, y: Math.max(cellTop, digitTop() - b.size) };
    if (b.y + b.size > digitTop()) {
      const bottom = Math.min(floor, Math.ceil((b.y + b.size + font) * dpr - 1e-6) / dpr);
      digit = { ...digit!, bottom: Math.max(digit!.bottom, bottom) };
    }
    // Still no room for its icon: the digit drops on toward its cell's bottom edge, onto what it
    // keeps off if it must (a purchase is always visible, D-100).
    const icon = minBadge(iconW, dpr);
    if (digitTop() - cellTop < icon - 1e-6) {
      const lowest = (d.y + 1) * px;
      const bottom = Math.min(lowest, Math.ceil((cellTop + icon + font) * dpr - 1e-6) / dpr);
      digit = { ...digit!, bottom: Math.max(digit!.bottom, bottom) };
    }
    if (b.y + b.size > digitTop()) {
      const room = Math.max(1 / dpr, digitTop() - cellTop);
      const fitted = spot(cell, iconW, right, room);
      const size = Math.min(fitted.size, room);
      b = { ...fitted, x: right ? b.x + b.size - size : b.x, y: cellTop, size };
    }
    return b;
  };
  fixture = clear(fixture, tr, BADGE_ICON.fixture, true);
  unmet = clear(unmet, tl, BADGE_ICON.unmet, false);

  // On whole device pixels: across to the nearest, and up, never down toward the digit.
  const place = (b: Spot | undefined): BadgeSpot | undefined =>
    b && {
      x: snap(b.x, dpr),
      y: Math.floor(b.y * dpr + 1e-6) / dpr,
      w: b.size,
      h: b.size,
      ring: b.ring,
      icon: b.icon,
    };
  return {
    ...(digit ? { digit } : {}),
    ...(fixture ? { fixture: place(fixture)! } : {}),
    ...(unmet ? { unmet: place(unmet)! } : {}),
  };
}

/** The digit's box for a score `chars` characters long, at most as wide as its font says. */
export function digitBox(d: DigitSpot, chars: number): Box {
  // System digits in a heavy weight are about 0.6 em wide; 0.75 em leaves room for any font.
  const w = chars * d.font * 0.75;
  return { x: d.right - w, y: d.bottom - d.font, w, h: d.font };
}

/** Whether two boxes overlap (touching edges don't). */
export function overlaps(a: Box, b: Box): boolean {
  const e = 1e-6;
  return a.x < b.x + b.w - e && b.x < a.x + a.w - e && a.y < b.y + b.h - e && b.y < a.y + a.h - e;
}
