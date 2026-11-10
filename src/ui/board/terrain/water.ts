// The lot's water (D-049, D-097): ponds and the creek in LimeZu's animated water, a shore
// autotiled per 16 px subtile from its 3 × 3 block and its inner corners (autotile.ts
// quarterPiece), with lily pads on a pond's open water. A creek flows on off the lot from the
// ends of its path, so they stay open (where it runs along the edge, it keeps a bank there), and
// a pond ends; outside.ts draws the creek flowing on. The water has its own small canvas over its
// bounding box, redrawn only to change frames; its shore's grass is keyed out, so the terrain
// canvas's grass shows around it, and the blades at the water's edge take that grass's colors.

import { terrainAt, type Lot } from '../../../rules/index.ts';
import { CELL, type SpriteId } from '../../sprites.ts';
import {
  blobMask,
  bySubtile,
  quarterPiece,
  SUB,
  SUBTILE,
  withEdge,
  type Inside,
  type QuarterPiece,
} from '../autotile.ts';
import { drawSprite, drawSubtile } from './atlas.ts';
import type { SubtileSprite } from './grass.ts';
import { tileHash } from './hash.ts';

/** About one open-water subtile of a pond in this many gets lily pads. */
export const LILY_EVERY = 4;
const LILIES = ['lily-0', 'lily-1', 'lily-2'] as const satisfies readonly SpriteId[];
const SIDES = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

export interface WaterTile {
  readonly sx: number;
  readonly sy: number;
  readonly piece: QuarterPiece;
}

/** A box of cells. */
export interface CellBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface WaterPlan {
  /** The cells the water covers, as a box: its canvas's place. Null when there's no water. */
  readonly box: CellBox | null;
  /** A piece of the shore set on every subtile of water, in lot subtiles. */
  readonly tiles: readonly WaterTile[];
  readonly lilies: readonly SubtileSprite[];
}

/**
 * The water, cell by cell, on the lot and off it: off the lot, a pond ends, and a creek flows
 * on from the ends of its path (straight on, as far as you like); where it runs along the
 * lot's edge it keeps a bank there.
 */
export function waterCells(lot: Lot): Inside {
  const { width: w, height: h } = lot;
  const isCreek = (x: number, y: number) => terrainAt(lot, x, y) === 'creek';
  const onLot = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  // The path's ends: creek cells with at most one other creek cell beside them.
  const isEnd = (x: number, y: number) => {
    if (!isCreek(x, y)) return false;
    let beside = 0;
    for (const [dx, dy] of SIDES) if (isCreek(x + dx, y + dy)) beside++;
    return beside <= 1;
  };
  const ends = withEdge(isEnd, w, h, 'extend');
  const creek = (x: number, y: number) => (onLot(x, y) ? isCreek(x, y) : ends(x, y));
  const pond = withEdge((x, y) => terrainAt(lot, x, y) === 'pond', w, h, 'outside');
  return (x, y) => creek(x, y) || pond(x, y);
}

/**
 * Where each subtile of water takes its piece of the shore, and where the lilies float.
 * `salt` is the run's (hash.ts seedSalt).
 */
export function waterPlan(lot: Lot, salt = 0): WaterPlan {
  const { width: w, height: h } = lot;
  const pond = (x: number, y: number) => terrainAt(lot, x, y) === 'pond';
  const water = bySubtile(waterCells(lot));
  const tiles: WaterTile[] = [];
  const lilies: SubtileSprite[] = [];
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let sy = 0; sy < h * SUB; sy++) {
    for (let sx = 0; sx < w * SUB; sx++) {
      if (!water(sx, sy)) continue;
      const x = Math.floor(sx / SUB);
      const y = Math.floor(sy / SUB);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      const mask = blobMask(water, sx, sy);
      const piece = quarterPiece(mask, sx % SUB === SUB - 1, sy % SUB === SUB - 1);
      tiles.push({ sx, sy, piece });
      const hash = tileHash(sx, sy, salt);
      if (mask === 255 && pond(x, y) && hash % LILY_EVERY === 0) {
        lilies.push({ sx, sy, id: LILIES[(hash >>> 3) % LILIES.length]! });
      }
    }
  }
  const box = x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  return { box, tiles, lilies };
}

/**
 * Draws one frame of the water into its own canvas, whose top-left is the box's top-left cell.
 * The canvas is cleared first: everything around the shore stays clear for the grass below.
 */
export function paintWater(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  plan: WaterPlan,
  frame: number,
): void {
  const { box } = plan;
  if (!box) return;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const ox = box.x * CELL;
  const oy = box.y * CELL;
  for (const { sx, sy, piece } of plan.tiles) {
    drawSubtile(
      ctx,
      img,
      shoreSet(piece),
      piece.col,
      piece.row,
      sx * SUBTILE - ox,
      sy * SUBTILE - oy,
      frame,
    );
  }
  for (const l of plan.lilies) drawSprite(ctx, img, l.id, l.sx * SUBTILE - ox, l.sy * SUBTILE - oy);
}

/** The shore set a piece comes from: the 3 × 3 block or the inner corners. */
export function shoreSet(piece: QuarterPiece): SpriteId {
  return piece.block === 'outer' ? 'shore' : 'shore-corners';
}
