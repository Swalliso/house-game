// Board geometry shared by the board's layers: occupancy, walls, and the scale.

import {
  CONTENT,
  placedCells,
  type Cell,
  type HouseState,
  type PieceId,
  type PlacedPiece,
} from '../../rules/index.ts';
import { CELL } from '../sprites.ts';

export interface Occupancy {
  width: number;
  height: number;
  /** The uid on each cell, or 0. */
  uids: Int32Array;
  byUid: Map<number, PlacedPiece>;
  cells: Map<number, Cell[]>;
}

const cache = new WeakMap<HouseState, Occupancy>();

export function occupancy(house: HouseState): Occupancy {
  let occ = cache.get(house);
  if (occ) return occ;
  const { width, height } = house.lot;
  const uids = new Int32Array(width * height);
  const byUid = new Map<number, PlacedPiece>();
  const cells = new Map<number, Cell[]>();
  for (const p of house.pieces) {
    const pc = placedCells(CONTENT.pieces[p.defId].shape, p.x, p.y, p.rot);
    for (const c of pc) uids[c.y * width + c.x] = p.uid;
    byUid.set(p.uid, p);
    cells.set(p.uid, pc);
  }
  occ = { width, height, uids, byUid, cells };
  cache.set(house, occ);
  return occ;
}

export function uidAt(occ: Occupancy, x: number, y: number): number {
  if (x < 0 || y < 0 || x >= occ.width || y >= occ.height) return 0;
  return occ.uids[y * occ.width + x]!;
}

export function isIndoor(id: PieceId): boolean {
  return CONTENT.pieces[id].category === 'indoor';
}

/** Where the furniture goes: the middle of a rectangle, or an L's corner cell. In tiles. */
export function furnitureSpot(cells: readonly Cell[]): { x: number; y: number } {
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const w = Math.max(...cells.map((c) => c.x)) - minX + 1;
  const h = Math.max(...cells.map((c) => c.y)) - minY + 1;
  if (cells.length === w * h) return { x: minX + (w - 1) / 2, y: minY + (h - 1) / 2 };
  const key = new Set(cells.map((c) => `${c.x},${c.y}`));
  let best = cells[0]!;
  let bestN = -1;
  for (const c of cells) {
    const n = [
      [1, 0],
      [-1, 0],
      [0, 1],
      [0, -1],
    ].filter(([dx, dy]) => key.has(`${c.x + dx!},${c.y + dy!}`)).length;
    if (n > bestN) [best, bestN] = [c, n];
  }
  return { x: best.x, y: best.y };
}

/** The bottom-right cell, where the piece's weekly score digit sits (§12, Numbers). */
export function digitCell(cells: readonly Cell[]): Cell {
  return [...cells].sort((a, b) => b.y - a.y || b.x - a.x)[0]!;
}

export function center(cells: readonly Cell[]): { x: number; y: number } {
  const minX = Math.min(...cells.map((c) => c.x));
  const minY = Math.min(...cells.map((c) => c.y));
  const maxX = Math.max(...cells.map((c) => c.x));
  const maxY = Math.max(...cells.map((c) => c.y));
  return { x: (minX + maxX + 1) / 2, y: (minY + maxY + 1) / 2 };
}

// ---------------------------------------------------------------------------------------
// Scales (§12, Art; D-097). A scale is CSS px per art px, and one cell is CELL art px. The
// camera's scales are whole device pixels per art pixel, k ÷ devicePixelRatio: 1×, 2× and 3×
// at a devicePixelRatio of 1, and 0.5× steps on a Retina screen. Fit is the one exception.

/** The camera zooms in up to this scale; its last step is the largest k ÷ dpr not above it. */
export const MAX_ZOOM = 3;

/** Whole device pixels per art pixel at `scale`, give or take float noise. */
function devicePx(scale: number, dpr: number): number {
  return Math.round(scale * dpr * 1e6) / 1e6;
}

/** The smallest zoom: one device pixel per art pixel (1× at a dpr of 1, 0.5× on Retina). */
export function minZoom(dpr: number): number {
  return 1 / dpr;
}

/** The largest zoom: the largest whole device pixels per art pixel up to MAX_ZOOM. */
export function maxZoom(dpr: number): number {
  return Math.max(1, Math.floor(devicePx(MAX_ZOOM, dpr))) / dpr;
}

/**
 * The default zoom's floor (D-097's zoom note): 1× rounded down to whole device pixels per art
 * pixel, and at least one. That's 1× at a devicePixelRatio of 1, 2 or 3; one device pixel per
 * art pixel where display scaling isn't a whole number (0.8× at 125%, 0.67× at 150%, 0.57× at
 * 175%), crisp where 1× would have uneven pixels; and above 1× below a ratio of 1, in a browser
 * zoomed out (1.11× at 90%).
 */
export function defaultFloor(dpr: number): number {
  return Math.max(1, Math.floor(devicePx(1, dpr))) / dpr;
}

/**
 * A zoom the player picked, on this screen: the nearest whole device pixels per art pixel
 * (moving the window to another screen keeps its size about the same), within the limits.
 */
export function snapZoom(scale: number, dpr: number): number {
  const k = Math.max(1, Math.round(devicePx(scale, dpr)));
  return Math.min(maxZoom(dpr), Math.max(minZoom(dpr), k / dpr));
}

/**
 * One zoom step in (+1) or out (−1) from `scale`: the next whole device pixels per art pixel,
 * within the limits. From a fractional scale (Fit), the first step rounds. Returns `scale`
 * itself when there's no further step that way.
 */
export function zoomStep(scale: number, dir: 1 | -1, dpr: number): number {
  const k = devicePx(scale, dpr);
  const next =
    dir > 0
      ? Math.min(maxZoom(dpr), (Math.floor(k) + 1) / dpr)
      : Math.max(minZoom(dpr), (Math.ceil(k) - 1) / dpr);
  return (dir > 0 ? next > scale : next < scale) ? next : scale;
}

/**
 * The default zoom (§12, Art): the largest whole device pixels per art pixel at which the lot
 * plus the street row below it fit, never below defaultFloor (1×, rounded down to whole device
 * pixels where display scaling isn't a whole number; a smaller view pans) and never above the
 * camera's largest zoom. So it's always one of the zoom steps, and zooming back always finds
 * it. The camera (camera.ts) starts here.
 */
export function fitScale(
  availWidth: number,
  availHeight: number,
  lotW: number,
  lotH: number,
  dpr: number,
): number {
  const byH = Math.floor((availHeight * dpr) / ((lotH + 1) * CELL)) / dpr;
  const byW = Math.floor((availWidth * dpr) / (lotW * CELL)) / dpr;
  return Math.min(maxZoom(dpr), Math.max(defaultFloor(dpr), Math.min(byH, byW)));
}

/**
 * The Fit overview (§12, Art): the largest scale that shows the whole lot and the street,
 * the one exception to whole device pixels per art pixel. Cells stay a whole number of device
 * pixels, so the grid lines up even though the sprites' pixels come out slightly uneven.
 */
export function overviewScale(
  availWidth: number,
  availHeight: number,
  lotW: number,
  lotH: number,
  dpr: number,
): number {
  const cell = Math.min(availWidth / lotW, availHeight / (lotH + 1));
  return Math.max(1, Math.floor(cell * dpr)) / dpr / CELL;
}

/**
 * The title screen's street (§12, Art): tiles of 64, 48, or 32 CSS px by the window's height,
 * the sizes the 16 px art had, at the nearest whole device pixels per art pixel (down on a
 * tie), and never under 32 CSS px, so the footer stays on the far sidewalk. On a Retina screen
 * the street is as it was. At a devicePixelRatio of 1 the 48 px size comes out at 32, and at
 * 1.25 every size at 51.2; at 1.5 the 48 and 32 px sizes come out at 42.7.
 */
export function streetScale(windowHeight: number, dpr: number): number {
  const tile = windowHeight >= 1000 ? 64 : windowHeight >= 760 ? 48 : 32;
  const nearest = Math.ceil(devicePx(tile / CELL, dpr) - 0.5);
  return Math.max(nearest, Math.ceil(devicePx(1, dpr))) / dpr;
}

/**
 * Where a label over some cells goes, in tiles: centered above them, or below them at the
 * top edge, and kept away from the lot's side edges.
 */
export function labelSpot(
  cells: readonly Cell[],
  lotW: number,
): { x: number; y: number; below: boolean } {
  const c = center(cells);
  const top = Math.min(...cells.map((q) => q.y));
  const below = top < 1;
  return {
    x: Math.min(Math.max(c.x, 3), lotW - 3),
    y: below ? Math.max(...cells.map((q) => q.y)) + 1 : top,
    below,
  };
}

const r2 = (n: number) => Math.round(n * 100) / 100;

/**
 * SVG paths for a set of cells at `px` per cell: `fill` covers every cell, `edge` traces the
 * region's outline (runs merged, so dashes flow along a whole side).
 */
export function cellsOutline(cells: Iterable<Cell>, px: number): { fill: string; edge: string } {
  const list = [...cells];
  const has = new Set(list.map((c) => `${c.x},${c.y}`));
  const inSet = (x: number, y: number) => has.has(`${x},${y}`);
  const rows = new Map<number, number[]>();
  const cols = new Map<number, number[]>();
  const add = (m: Map<number, number[]>, line: number, at: number) => {
    const runs = m.get(line);
    if (runs) runs.push(at);
    else m.set(line, [at]);
  };
  let fill = '';
  for (const c of list) {
    fill += `M${r2(c.x * px)} ${r2(c.y * px)}h${r2(px)}v${r2(px)}h${r2(-px)}z`;
    if (!inSet(c.x, c.y - 1)) add(rows, c.y, c.x);
    if (!inSet(c.x, c.y + 1)) add(rows, c.y + 1, c.x);
    if (!inSet(c.x - 1, c.y)) add(cols, c.x, c.y);
    if (!inSet(c.x + 1, c.y)) add(cols, c.x + 1, c.y);
  }
  let edge = '';
  const trace = (m: Map<number, number[]>, horizontal: boolean) => {
    for (const [line, starts] of m) {
      starts.sort((a, b) => a - b);
      let i = 0;
      while (i < starts.length) {
        const from = starts[i]!;
        let to = from + 1;
        while (i + 1 < starts.length && starts[i + 1] === to) {
          i++;
          to++;
        }
        i++;
        edge += horizontal
          ? `M${r2(from * px)} ${r2(line * px)}H${r2(to * px)}`
          : `M${r2(line * px)} ${r2(from * px)}V${r2(to * px)}`;
      }
    }
  };
  trace(rows, true);
  trace(cols, false);
  return { fill, edge };
}
