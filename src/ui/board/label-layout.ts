// Where a piece's labels go on the board (§12, Numbers): its weekly score's digit in its
// bottom-right cell, and its badges in its top corners (a fixture that can't be drawn at the top
// right, an unmet requirement's ⚠ at the top left), inside its walls. Pure: the labels layer
// (HouseLayers.tsx) places its elements where this says, and the tests hold it to its promise.
//
// The badges grow with the cell, and shrink with it below 1× (min(max(14, 6u), max(9, 0.45 ×
// the cell)), u a sixteenth of a cell), on whole device pixels, with their pixel icon at whole
// device pixels per icon pixel and an ink ring one icon pixel wide. Where a badge shares the
// digit's cell (a one-cell piece, or a one-row piece's fixture), it rises to the cell's top edge
// and the digit drops toward the cell's bottom edge, over the wall bands, as far as it takes to
// keep them apart; in a cell too small even for that, the badge shrinks. So a badge never covers
// the digit, at any zoom.

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
}

/** The icons' sizes in icon pixels (theme/icons.ts): a fixture's, and the ⚠'s. */
export const BADGE_ICON = { fixture: 8, unmet: 9 } as const;

/** The digit's box sits this far in from its corner, in CSS px. */
const DIGIT_IN = { right: 2, bottom: 1 } as const;

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
    return { x, y: cell.y * px + inset(cell, 'N') + gap, ...b };
  };
  let fixture = o.fixture ? spot(tr, BADGE_ICON.fixture, true) : undefined;
  let unmet = o.unmet ? spot(tl, BADGE_ICON.unmet, false) : undefined;

  // A badge in the digit's row that would touch it keeps above it instead: it rises to its cell's
  // top edge, then the digit drops to its cell's bottom edge, then the badge shrinks to the room
  // that's left. (A digit grows left from its corner, so a long one can reach a cell to its left.)
  const clear = (
    b: Spot | undefined,
    cell: Cell,
    iconW: number,
    right: boolean,
  ): Spot | undefined => {
    if (!b || !digit || cell.y !== d.y) return b;
    if (!overlaps({ x: b.x, y: b.y, w: b.size, h: b.size }, digitBox(digit, chars))) return b;
    const cellTop = cell.y * px;
    const cellBottom = (cell.y + 1) * px;
    const digitTop = () => digit!.bottom - digit!.font;
    if (b.y + b.size > digitTop()) b = { ...b, y: Math.max(cellTop, digitTop() - b.size) };
    if (b.y + b.size > digitTop()) {
      const bottom = Math.min(cellBottom, Math.ceil((b.y + b.size + font) * dpr - 1e-6) / dpr);
      digit = { ...digit!, bottom: Math.max(digit!.bottom, bottom) };
    }
    if (b.y + b.size > digitTop()) {
      const room = Math.max(1 / dpr, digitTop() - cellTop);
      const fitted = spot(cell, iconW, right, room);
      b = { ...fitted, y: cellTop, size: Math.min(fitted.size, room) };
    }
    return b;
  };
  fixture = clear(fixture, tr, BADGE_ICON.fixture, true);
  unmet = clear(unmet, tl, BADGE_ICON.unmet, false);

  // Two badges in one cell (a piece one cell wide at the top) keep apart too: out to the cell's
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
