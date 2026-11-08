// Around the lot (D-097): the street and the creek don't stop at the board's edges. Past them, in
// the dimmed garden around the lot (terrain.css), the road runs on to the edges of the view, and
// each creek mouth flows on straight, the way the lot's own shore already assumes (water.ts
// waterCells keeps the water open where a creek leaves the lot). Each runs on as one slice a cell
// deep, painted once per lot in the garden's dimmed colors and repeated away from the board by
// CSS, so nothing redraws on zoom, resize, or pan. The water out there is still: only the lot's
// own water moves.

import type { Lot } from '../../../rules/index.ts';
import type { SpriteId } from '../../sprites.ts';
import { blobMask, bySubtile, quarterPiece, SUB, SUBTILE } from '../autotile.ts';
import { ROAD_ROWS } from '../geometry.ts';
import { drawSprite, drawSubtile } from './atlas.ts';
import { pavingTile, streetRows } from './street.ts';
import { shoreSet, waterCells } from './water.ts';

/** Which edge of the board a slice runs off. The street side has none: the road runs across. */
export type Side = 'left' | 'right' | 'top';

/** One 16 px tile of a slice, at (sx, sy) subtiles from the slice's top-left. */
export interface SliceTile {
  readonly id: SpriteId;
  /** The tile in its set (0, 0 for a whole 16 px sprite). */
  readonly col: number;
  readonly row: number;
  readonly sx: number;
  readonly sy: number;
}

/**
 * What runs on past one edge of the board, one cell deep (the cell next to the edge): it
 * repeats away from the board. `at` and `span` place it along the edge, in cells: rows on the
 * left and right, columns along the top.
 */
export interface Slice {
  readonly side: Side;
  readonly kind: 'road' | 'water';
  readonly at: number;
  readonly span: number;
  readonly tiles: readonly SliceTile[];
}

/** Its size in art px: a cell deep, `span` cells along the edge. */
export function sliceSize(s: Slice): { w: number; h: number } {
  const along = s.span * SUB * SUBTILE;
  const deep = SUB * SUBTILE;
  return s.side === 'top' ? { w: along, h: deep } : { w: deep, h: along };
}

const mod = (n: number, m: number) => ((n % m) + m) % m;

/**
 * The road, both ways: the street row's sidewalk and the road's rows below it, as one cell of
 * them. Off the board's left edge the next cell's subtiles are −2 and −1, off its right edge
 * 2 × width and the one after: even and odd, as in this slice, so the dashes keep their step.
 */
export function roadSlices(lot: Lot): Slice[] {
  const tiles: SliceTile[] = [];
  streetRows().forEach((kind, j) => {
    for (let i = 0; i < SUB; i++) {
      const t = pavingTile(kind, i, j);
      tiles.push({ id: t.id, col: t.col, row: t.row, sx: i, sy: j });
    }
  });
  const span = 1 + ROAD_ROWS;
  return (['left', 'right'] as const).map((side) => ({
    side,
    kind: 'road',
    at: lot.height,
    span,
    tiles,
  }));
}

/**
 * Each creek mouth, flowing on off the lot: the cells next to the board's edge that are water
 * (waterCells), in runs along the edge, with the shore's pieces their masks give, the same
 * pieces the cells beyond them have, all the way out.
 */
export function waterSlices(lot: Lot): Slice[] {
  const { width: w, height: h } = lot;
  const cells = waterCells(lot);
  const water = bySubtile(cells);
  const out: Slice[] = [];
  const edges: { side: Side; cell: (i: number) => [number, number]; length: number }[] = [
    { side: 'left', cell: (i) => [-1, i], length: h },
    { side: 'right', cell: (i) => [w, i], length: h },
    { side: 'top', cell: (i) => [i, -1], length: w },
  ];
  for (const { side, cell, length } of edges) {
    for (let i = 0; i < length; i++) {
      if (!cells(...cell(i))) continue;
      let span = 1;
      while (i + span < length && cells(...cell(i + span))) span++;
      const [x0, y0] = cell(i);
      const cols = side === 'top' ? span * SUB : SUB;
      const rows = side === 'top' ? SUB : span * SUB;
      const tiles: SliceTile[] = [];
      for (let j = 0; j < rows; j++) {
        for (let k = 0; k < cols; k++) {
          const sx = x0 * SUB + k;
          const sy = y0 * SUB + j;
          const piece = quarterPiece(
            blobMask(water, sx, sy),
            mod(sx, SUB) === SUB - 1,
            mod(sy, SUB) === SUB - 1,
          );
          tiles.push({ id: shoreSet(piece, false), col: piece.col, row: piece.row, sx: k, sy: j });
        }
      }
      out.push({ side, kind: 'water', at: i, span, tiles });
      i += span - 1;
    }
  }
  return out;
}

/** Everything that runs on past the board's edges. */
export function outsideSlices(lot: Lot): Slice[] {
  return [...roadSlices(lot), ...waterSlices(lot)];
}

/**
 * The garden's dimming (grass-outside against grass-0, art/limezu/terrain.json): toward gray
 * (Rec. 601 luma) by a quarter, then 15% darker. It takes grass-0's colors to within a step of
 * grass-outside's, so whatever runs on out there sits in the same light as the grass around it.
 */
export function dim(r: number, g: number, b: number): [number, number, number] {
  const luma = 0.299 * r + 0.587 * g + 0.114 * b;
  const one = (c: number) => Math.min(255, Math.round(0.85 * (luma + 0.74 * (c - luma))));
  return [one(r), one(g), one(b)];
}

/** Paints a slice at 1 canvas px per art px into a canvas of sliceSize, dimmed. */
export function paintSlice(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  slice: Slice,
): void {
  const { w, h } = sliceSize(slice);
  ctx.imageSmoothingEnabled = false;
  ctx.clearRect(0, 0, w, h);
  for (const t of slice.tiles) {
    const x = t.sx * SUBTILE;
    const y = t.sy * SUBTILE;
    if (t.id === 'street-asphalt' || t.id === 'street-line') drawSprite(ctx, img, t.id, x, y);
    else drawSubtile(ctx, img, t.id, t.col, t.row, x, y);
  }
  const data = ctx.getImageData(0, 0, w, h);
  const px = data.data;
  for (let i = 0; i < px.length; i += 4) {
    if (px[i + 3] === 0) continue;
    const [r, g, b] = dim(px[i]!, px[i + 1]!, px[i + 2]!);
    px[i] = r;
    px[i + 1] = g;
    px[i + 2] = b;
  }
  ctx.putImageData(data, 0, 0);
}
