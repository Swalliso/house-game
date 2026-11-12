// Your houses on the street (D-156), the part that decides, kept pure so tests can check it:
// - what of a finished house stands on the street (its rooms and the yard pieces touching them),
//   and the box it's painted through (screens/photo-paint.ts paintPlot paints it at run end);
// - which house stands on which plot around the lot: the newest nearest, beside the lot at the
//   row it was built on (so it meets the same street), then across the road. Until there are
//   houses enough, LimeZu's own houses fill the nearest plots.
// NeighborsLayer.tsx draws them. None of it is the rules: the company's record (company.ts) is
// UI state the rules never read (D-016).

import type { HouseState, Lot } from '../../rules/index.ts';
import type { Plot } from '../company.ts';
import type { PhotoFrame } from '../screens/photos.ts';
import { CELL } from '../sprites.ts';
import { boardRows, isIndoor, occupancy } from './geometry.ts';
import { seedSalt } from './terrain/hash.ts';

/** What of a finished house stands on the street: its pieces, and the box they're painted in. */
export interface PlotPart {
  readonly uids: ReadonlySet<number>;
  /** Art px on the house's own board: the pieces' cells with a cell around, on the board. */
  readonly frame: PhotoFrame;
}

/**
 * The part of a finished house that stands on the street: its rooms and every yard piece that
 * touches one (a porch, the garage's driveway, a fence along a wall), whole, so nothing's cut
 * in half; the yard pieces out on their own stay home. A house of yard pieces alone stands as
 * all of them. The frame has a cell around them for what rises over their top row and the
 * house's shadow. Null for an empty lot.
 */
export function plotPart(house: HouseState): PlotPart | null {
  const occ = occupancy(house);
  const rooms = house.pieces.filter((p) => isIndoor(p.defId));
  const roomCells = new Set<string>();
  for (const p of rooms) for (const c of occ.cells.get(p.uid) ?? []) roomCells.add(`${c.x},${c.y}`);
  const touches = (uid: number) =>
    (occ.cells.get(uid) ?? []).some(({ x, y }) =>
      [
        [x - 1, y],
        [x + 1, y],
        [x, y - 1],
        [x, y + 1],
      ].some(([nx, ny]) => roomCells.has(`${nx},${ny}`)),
    );
  const uids = new Set(
    rooms.length > 0
      ? house.pieces.filter((p) => isIndoor(p.defId) || touches(p.uid)).map((p) => p.uid)
      : house.pieces.map((p) => p.uid),
  );
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const uid of uids) {
    for (const c of occ.cells.get(uid) ?? []) {
      x0 = Math.min(x0, c.x);
      y0 = Math.min(y0, c.y);
      x1 = Math.max(x1, c.x + 1);
      y1 = Math.max(y1, c.y + 1);
    }
  }
  if (x0 === Infinity) return null;
  const { width, height } = house.lot;
  const left = Math.max(0, (x0 - 1) * CELL);
  const top = Math.max(0, (y0 - 1) * CELL);
  const right = Math.min(width * CELL, (x1 + 1) * CELL);
  const bottom = Math.min(boardRows(height) * CELL, (y1 + 1) * CELL);
  return { uids, frame: { x: left, y: top, w: right - left, h: bottom - top } };
}

/**
 * The box around what a picture painted: its pixels with any alpha, in RGBA `data` `w` px
 * wide. Null for a blank picture.
 */
export function opaqueBox(
  data: ArrayLike<number>,
  w: number,
  h: number,
): { x: number; y: number; w: number; h: number } | null {
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      if (data[(y * w + x) * 4 + 3] === 0) continue;
      if (x < x0) x0 = x;
      if (x > x1) x1 = x;
      if (y < y0) y0 = y;
      y1 = y;
    }
  }
  return x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
}

/** Where a plot is: beside the lot, either side, on its street; or across the road. */
export type PlotSide = 'left' | 'right' | 'across';

/** A house on a plot around the lot. */
export interface Neighbor {
  /** A filed house's job key (company.ts jobKey), or a LimeZu house's sprite id. */
  readonly key: string;
  /** A filed house's picture (its plot's PNG), or LimeZu's own house. */
  readonly look: { readonly src: string } | { readonly sprite: string };
  readonly side: PlotSide;
  /** Its box, in art px from the lot's top-left (negative: left of it). */
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/** A house that can stand on the street: a filed job's key and its plot, newest first. */
export interface PlotHouse {
  readonly key: string;
  readonly plot: Plot;
}

/** LimeZu's own houses, for the plots no house of yours stands on yet: a sprite and its size. */
export interface Filler {
  readonly sprite: string;
  readonly w: number;
  readonly h: number;
}

/** Where the water runs on past the board's left or right edge (outside.ts waterSlices). */
export interface WaterRun {
  readonly side: 'left' | 'right' | 'top';
  readonly at: number;
  readonly span: number;
}

/** The street's spacing, in art px. */
export const STREET = {
  /** From the lot's property line to the nearest house beside it. */
  beside: CELL,
  /** Between two houses on the same side. */
  between: 2 * CELL,
  /** From the board's foot (the far curb) to the tops of the houses across the road. */
  across: CELL,
  /** A LimeZu house's front yard: from its front to the street row. */
  frontYard: CELL + CELL / 2,
} as const;

/** How many plots around the lot LimeZu's houses fill until yours stand there: the nearest. */
const FIRST_PLOTS = 3;

/**
 * The houses around this lot, for the whole run: `houses` newest first (the run's own lot
 * left out by the caller), the newest on the nearest plot. The plots, nearest first, come in
 * rings: beside the lot on one side, on the other, then across the road; the run's seed says
 * which side comes first. A house beside the lot stands at the row it was built on, so it meets
 * the street; a creek running on past that edge at its rows sends it to the next plot. Across
 * the road the houses line up under the far curb, from the middle out. Plots of the first ring
 * that no house takes get one of LimeZu's houses each (`fillers`, in the seed's order).
 */
export function neighbors(
  houses: readonly PlotHouse[],
  fillers: readonly Filler[],
  lot: Pick<Lot, 'width' | 'height'>,
  seed: string,
  water: readonly WaterRun[] = [],
): Neighbor[] {
  const h = seedSalt(seed);
  const first: 'left' | 'right' = h & 1 ? 'left' : 'right';
  const second = first === 'left' ? 'right' : 'left';
  const ring: readonly PlotSide[] = [first, second, 'across'];
  const street = lot.height * CELL;
  const foot = boardRows(lot.height) * CELL;
  // Rows a creek runs through, past each edge.
  const wet = (side: PlotSide, y: number, height: number) =>
    side !== 'across' &&
    water.some(
      (w) =>
        w.side === side &&
        w.at < Math.ceil((y + height) / CELL) &&
        w.at + w.span > Math.floor(y / CELL),
    );

  // Each house takes the nearest plot left that it fits (across the road, any: no creek runs
  // on below the board). `y` is where it stands beside the lot: its own row on its own lot.
  const taken = new Map<number, Omit<Neighbor, 'x'>>();
  for (const { key, plot } of houses) {
    const y = plot.y - plot.lotH * CELL + street;
    for (let k = 0; ; k++) {
      const side = ring[k % ring.length]!;
      if (taken.has(k) || wet(side, y, plot.h)) continue;
      taken.set(k, { side, key, look: { src: plot.src }, y, w: plot.w, h: plot.h });
      break;
    }
  }
  // LimeZu's houses on the first ring's empty plots.
  const order = fillers.map((_, i) => fillers[(i + (h >>> 1)) % fillers.length]!);
  let f = 0;
  for (let k = 0; k < FIRST_PLOTS && f < order.length; k++) {
    if (taken.has(k)) continue;
    const side = ring[k % ring.length]!;
    const filler = order[f]!;
    const y = street - STREET.frontYard - filler.h;
    if (wet(side, y, filler.h)) continue;
    f++;
    taken.set(k, { side, key: filler.sprite, look: { sprite: filler.sprite }, y, ...size(filler) });
  }

  // Each side's houses outward from the lot, nearest plot first; across the road, from the
  // middle out, the first side's way first.
  const out: Neighbor[] = [];
  let left = -STREET.beside;
  let right = lot.width * CELL + STREET.beside;
  let acrossLeft = 0;
  let acrossRight = 0;
  let acrossN = 0;
  for (const k of [...taken.keys()].sort((a, b) => a - b)) {
    const t = taken.get(k)!;
    if (t.side === 'left') {
      left -= t.w;
      out.push({ ...t, x: left });
      left -= STREET.between;
    } else if (t.side === 'right') {
      out.push({ ...t, x: right });
      right += t.w + STREET.between;
    } else {
      // Across the road a house has no row of its own on this street: under the far curb.
      const y = foot + STREET.across;
      let x: number;
      if (acrossN === 0) {
        x = Math.round((lot.width * CELL - t.w) / 2);
        acrossLeft = x - STREET.between;
        acrossRight = x + t.w + STREET.between;
      } else if ((acrossN % 2 === 1) === (first === 'right')) {
        x = acrossRight;
        acrossRight += t.w + STREET.between;
      } else {
        x = acrossLeft - t.w;
        acrossLeft = x - STREET.between;
      }
      acrossN++;
      out.push({ ...t, x, y });
    }
  }
  return out;
}

const size = ({ w, h }: { w: number; h: number }) => ({ w, h });

/** The neighbor whose box holds the point (art px from the lot's top-left), or null. */
export function neighborAt(all: readonly Neighbor[], x: number, y: number): Neighbor | null {
  for (let i = all.length - 1; i >= 0; i--) {
    const n = all[i]!;
    if (x >= n.x && x < n.x + n.w && y >= n.y && y < n.y + n.h) return n;
  }
  return null;
}
