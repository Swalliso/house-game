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
//
// A Renovated room's level (D-102) is one more badge, a star per level side by side, after the
// ⚠ in the top row (or under it, or a column of stars in a room one cell wide; or under the
// fixture's badge, or in another top corner, an L's other arm): only where it fits on the
// room's own cells, inside its walls and clear of everything above, what the labels keep off
// included. It's placed last and moves nothing. Where only a smaller one fits it shrinks, as the
// other badges do, never below minBadge; where none fits it's left out, since the Inspect panel
// states the level in words.

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
  /**
   * A Renovated room's level (D-102): one badge as tall as the others, its stars side by side
   * (or one above another, `column`), each `icon` px per icon pixel with an icon pixel between.
   */
  readonly level?: BadgeSpot & { readonly column: boolean };
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
  /** A Renovated room's level (PlacedPiece.level), or 0. */
  readonly level?: number;
  /**
   * What the labels keep off where they can, in CSS px: other pieces' props that rise into this
   * piece's cells (yard.ts risingParts), the trees' crowns that do (terrain/objects.ts
   * canopyParts) and the doors' mats. Boxes clear of its labels change nothing.
   */
  readonly keepOff?: readonly Box[];
}

/** The icons' sizes in icon pixels (theme/icons.ts): a fixture's, the ⚠'s, and a level's star. */
export const BADGE_ICON = { fixture: 8, unmet: 9, level: 9 } as const;

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

  // A Renovated room's stars (D-102): one badge as tall as the others, a star per level side by
  // side with an icon pixel of paper between them, right of the ⚠ in the top row, else under
  // it, else a column of stars (a room one cell wide); without a ⚠, in its place. Where those are
  // taken, under the fixture's badge, or under the top's badges at the room's left, or in the top
  // left corner of another cell along the room's top (an L's other arm). Placed last, so they
  // move nothing, where they fit on the room's own cells inside their walls, clear of the digit,
  // the other badges and what the labels keep off (another piece's roof, a tree's crown, a mat).
  // Where only a smaller badge fits, a smaller one, as the other badges shrink in a tight cell,
  // but never too small for its stars at a device pixel per icon pixel (minBadge); nowhere else,
  // since Inspect says the level in words.
  let level: (BadgeSpot & { column: boolean }) | undefined;
  const stars = o.level ?? 0;
  if (stars > 0) {
    const one = spot(tl, BADGE_ICON.level, false);
    // Its sizes, largest first: the other badges' (k device pixels per icon pixel, p of paper
    // each side of its stars), then the same stars with less paper, then smaller stars with the
    // same paper and less, never under minBadge. A smaller badge keeps the others' margins, so
    // its stars fill it as theirs do.
    const k0 = Math.round(one.icon * dpr);
    const p0 = Math.round((one.size * dpr - (BADGE_ICON.level + 2) * k0) / 2);
    const least = minBadge(BADGE_ICON.level, dpr);
    const sizes: { size: number; ring: number; icon: number }[] = [];
    for (let k = k0; k >= 1; k--) {
      for (let p = p0; p >= 0; p--) {
        const size = ((BADGE_ICON.level + 2) * k + 2 * p) / dpr;
        if (size >= least - 1e-6) sizes.push({ size, ring: k / dpr, icon: k / dpr });
      }
    }
    const warn = unmet && place(unmet)!;
    const fix = fixture && place(fixture)!;
    const placed = [fix, warn].filter((b): b is BadgeSpot => !!b);
    const taken = [...keep, ...(digit ? [digitBox(digit, chars)] : []), ...placed];
    const e = 1e-6;
    /** Whether box `b` is on the piece's own cells, inside the walls at its edges. */
    const inside = (b: Box): boolean => {
      const x0 = Math.floor(b.x / px + e);
      const x1 = Math.floor((b.x + b.w) / px - e);
      const y0 = Math.floor(b.y / px + e);
      const y1 = Math.floor((b.y + b.h) / px - e);
      for (let cy = y0; cy <= y1; cy++) {
        for (let cx = x0; cx <= x1; cx++) {
          const c = { x: cx, y: cy };
          if (!own.has(`${cx},${cy}`)) return false;
          if (cx === x0 && b.x < cx * px + inset(c, 'W') - e) return false;
          if (cx === x1 && b.x + b.w > (cx + 1) * px - inset(c, 'E') + e) return false;
          if (cy === y0 && b.y < cy * px + inset(c, 'N') - e) return false;
          if (cy === y1 && b.y + b.h > (cy + 1) * px - inset(c, 'S') + e) return false;
        }
      }
      return true;
    };
    /** A spot to try: its top-left corner, or its top-right with `right`. */
    type Try = { x: number; y: number; column: boolean; right?: boolean };
    const both = (t: Omit<Try, 'column'>): Try[] => [
      { ...t, column: false },
      { ...t, column: true },
    ];
    // The top-left corners of the room's other cells with a wall above them, top to bottom and
    // west to east: along its top row, and an L's other arm.
    const corners = cells
      .filter((c) => !own.has(`${c.x},${c.y - 1}`) && !same(c, tl))
      .sort((a, b) => a.y - b.y || a.x - b.x)
      .map((c) => ({ x: c.x * px + inset(c, 'W') + gap, y: c.y * px + inset(c, 'N') + gap }));
    find: for (const s of sizes) {
      // The rest of the stars, each an icon wide and an icon pixel apart.
      const more = (stars - 1) * (BADGE_ICON.level + 1) * s.icon;
      const tries: Try[] = [
        ...(warn
          ? [
              // Beside the ⚠, centered on it when it's the smaller.
              { x: warn.x + warn.w + gap, y: warn.y + (warn.h - s.size) / 2, column: false },
              ...both({ x: warn.x, y: warn.y + warn.h + gap }),
            ]
          : both({ x: one.x, y: one.y })),
        ...(fix ? both({ x: fix.x + fix.w, y: fix.y + fix.h + gap, right: true }) : []),
        ...(placed.length > 0
          ? both({ x: one.x, y: Math.max(...placed.map((b) => b.y + b.h)) + gap })
          : []),
        ...corners.flatMap(both),
      ];
      for (const t of tries) {
        const w = s.size + (t.column ? 0 : more);
        // On whole device pixels before it's checked, so where it's drawn is where it fits.
        const box = {
          x: snap(t.right ? t.x - w : t.x, dpr),
          y: Math.floor(t.y * dpr + e) / dpr,
          w,
          h: s.size + (t.column ? more : 0),
        };
        if (inside(box) && !taken.some((k) => overlaps(box, k))) {
          level = { ...box, ring: s.ring, icon: s.icon, column: t.column };
          break find;
        }
      }
    }
  }
  return {
    ...(digit ? { digit } : {}),
    ...(fixture ? { fixture: place(fixture)! } : {}),
    ...(unmet ? { unmet: place(unmet)! } : {}),
    ...(level ? { level } : {}),
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
