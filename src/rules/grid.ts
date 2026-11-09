// Coordinates, shapes, and rotation (implementation-plan.md §4).
//
// A shape is ASCII rows ('#' filled, '.' empty). A placement's (x, y) is the top-left cell of
// the rotated shape's bounding box, and each rotation's cells are normalized so their minimum
// x and y are 0. Rotation is clockwise on screen (y grows downward). There's no mirroring.

import type { Cell, Rot } from './index.ts';

export const ROTATIONS: readonly Rot[] = [0, 1, 2, 3];

/** Right, down, left, up. */
export const ORTHOGONAL: readonly (readonly [number, number])[] = [
  [1, 0],
  [0, 1],
  [-1, 0],
  [0, -1],
];

export function parseShape(rows: readonly string[]): Cell[] {
  const cells: Cell[] = [];
  rows.forEach((row, y) => {
    for (let x = 0; x < row.length; x++) {
      const ch = row[x];
      if (ch === '#') cells.push({ x, y });
      else if (ch !== '.') throw new Error(`Bad shape character "${ch}" in "${row}"`);
    }
  });
  return cells;
}

/** Sorted row by row, then by column, so equal shapes compare equal. */
function normalize(cells: readonly Cell[]): Cell[] {
  let minX = Infinity;
  let minY = Infinity;
  for (const c of cells) {
    minX = Math.min(minX, c.x);
    minY = Math.min(minY, c.y);
  }
  return cells
    .map((c) => ({ x: c.x - minX, y: c.y - minY }))
    .sort((a, b) => a.y - b.y || a.x - b.x);
}

/** Rotates clockwise `rot` quarter turns and normalizes: (x, y) → (−y, x) per turn. */
export function rotateCells(cells: readonly Cell[], rot: Rot): Cell[] {
  let out: Cell[] = cells.map((c) => ({ x: c.x, y: c.y }));
  for (let i = 0; i < rot; i++) out = out.map((c) => ({ x: -c.y, y: c.x }));
  return normalize(out);
}

const shapeCache = new Map<string, readonly Cell[]>();

/** The shape's cells in a rotation, normalized to (0, 0). Cached. */
export function shapeCells(shape: readonly string[], rot: Rot): readonly Cell[] {
  const key = `${shape.join('/')}|${rot}`;
  let cells = shapeCache.get(key);
  if (!cells) {
    cells = Object.freeze(rotateCells(parseShape(shape), rot).map((c) => Object.freeze(c)));
    shapeCache.set(key, cells);
  }
  return cells;
}

export function placedCells(shape: readonly string[], x: number, y: number, rot: Rot): Cell[] {
  return shapeCells(shape, rot).map((c) => ({ x: c.x + x, y: c.y + y }));
}

export function bounds(cells: readonly Cell[]): { w: number; h: number } {
  let w = 0;
  let h = 0;
  for (const c of cells) {
    w = Math.max(w, c.x + 1);
    h = Math.max(h, c.y + 1);
  }
  return { w, h };
}

/** The rotations that give distinct cell sets: a 2×2 has one, a 1×N two, an L four. */
export function uniqueRotations(shape: readonly string[]): Rot[] {
  const seen = new Set<string>();
  const out: Rot[] = [];
  for (const rot of ROTATIONS) {
    const key = shapeCells(shape, rot)
      .map((c) => `${c.x},${c.y}`)
      .join(' ');
    if (!seen.has(key)) {
      seen.add(key);
      out.push(rot);
    }
  }
  return out;
}

/** True if the cells form one orthogonally connected polyomino (and there is at least one). */
export function isConnected(cells: readonly Cell[]): boolean {
  if (cells.length === 0) return false;
  const key = (c: Cell) => `${c.x},${c.y}`;
  const all = new Set(cells.map(key));
  const seen = new Set<string>([key(cells[0]!)]);
  const stack: Cell[] = [cells[0]!];
  while (stack.length > 0) {
    const c = stack.pop()!;
    for (const [dx, dy] of ORTHOGONAL) {
      const k = `${c.x + dx},${c.y + dy}`;
      if (all.has(k) && !seen.has(k)) {
        seen.add(k);
        stack.push({ x: c.x + dx, y: c.y + dy });
      }
    }
  }
  return seen.size === all.size;
}

export function cellIndex(width: number, x: number, y: number): number {
  return y * width + x;
}

export function inBounds(width: number, height: number, x: number, y: number): boolean {
  return x >= 0 && y >= 0 && x < width && y < height;
}

/** Cells as a placement: the top-left corner of their box and the shape's ASCII rows. */
export function cellsToShape(cells: readonly Cell[]): { x: number; y: number; shape: string[] } {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const c of cells) {
    x0 = Math.min(x0, c.x);
    y0 = Math.min(y0, c.y);
    x1 = Math.max(x1, c.x);
    y1 = Math.max(y1, c.y);
  }
  const rows: string[][] = Array.from({ length: y1 - y0 + 1 }, () =>
    Array.from({ length: x1 - x0 + 1 }, () => '.'),
  );
  for (const c of cells) rows[c.y - y0]![c.x - x0] = '#';
  return { x: x0, y: y0, shape: rows.map((r) => r.join('')) };
}

/** A shape's rows turned `rot` quarter turns clockwise, as ASCII. */
export function rotateShape(shape: readonly string[], rot: Rot): string[] {
  return cellsToShape(shapeCells(shape, rot)).shape;
}

/**
 * Why a pack's tiles (D-106) aren't a shape it can place, or null: ASCII rows of equal length,
 * '#' and '.' only, 1 to `maxTiles` tiles in one connected group, with a tile in the first row
 * and the first column (so the placement's corner is its box's).
 */
export function packShapeProblem(shape: readonly string[], maxTiles: number): string | null {
  if (!Array.isArray(shape) || shape.length === 0 || shape.length > maxTiles) {
    return `Up to ${maxTiles} tiles, all touching.`;
  }
  const width = shape[0]?.length ?? 0;
  if (
    width === 0 ||
    width > maxTiles ||
    shape.some((r) => typeof r !== 'string' || r.length !== width || /[^#.]/.test(r))
  ) {
    return `Up to ${maxTiles} tiles, all touching.`;
  }
  const cells = parseShape(shape);
  if (cells.length === 0 || cells.length > maxTiles)
    return `Up to ${maxTiles} tiles, all touching.`;
  // Trimmed, as cellsToShape writes it: one way to write each set of tiles.
  if (
    !cells.some((c) => c.y === 0) ||
    !cells.some((c) => c.x === 0) ||
    !cells.some((c) => c.y === shape.length - 1) ||
    !cells.some((c) => c.x === width - 1)
  ) {
    return 'That shape has an empty edge.';
  }
  if (!isConnected(cells)) return 'A pack’s tiles must all touch.';
  return null;
}
