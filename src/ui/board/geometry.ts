// Board geometry shared by the board's layers: occupancy, walls, and the scale.

import {
  CONTENT,
  placedCells,
  type Cell,
  type HouseState,
  type PieceId,
  type PlacedPiece,
} from '../../rules/index.ts';

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

/**
 * The default zoom (§12, Art): whole device pixels, at least 2×, as large as fits. The lot
 * plus the street row below it. The camera (camera.ts) starts here.
 */
export function fitScale(
  availWidth: number,
  availHeight: number,
  lotW: number,
  lotH: number,
): number {
  const dpr = window.devicePixelRatio || 1;
  const byH = Math.floor((availHeight * dpr) / ((lotH + 1) * 16)) / dpr;
  const byW = Math.floor((availWidth * dpr) / (lotW * 16)) / dpr;
  return Math.max(2, Math.min(byH, byW));
}

/**
 * The Fit overview (§12, Art): the largest scale that shows the whole lot and the street,
 * the one exception to whole-number scales. Cells stay a whole number of device pixels, so
 * the grid lines up even though the sprites' pixels come out slightly uneven.
 */
export function overviewScale(
  availWidth: number,
  availHeight: number,
  lotW: number,
  lotH: number,
): number {
  const dpr = window.devicePixelRatio || 1;
  const cell = Math.min(availWidth / lotW, availHeight / (lotH + 1));
  return Math.max(1, Math.floor(cell * dpr)) / dpr / 16;
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
