// Drawing atlas sprites into the lot's canvases, at 1 canvas px per art px (the canvases are
// scaled by CSS, never redrawn on zoom). Sets of 16 px tiles (autotile sets, animation
// frames) are drawn a subtile at a time.

import atlas from '../../../../assets/atlas.json';
import type { SpriteId } from '../../sprites.ts';
import { SUBTILE } from '../autotile.ts';

/** A sprite's rect in the atlas, and its frames (1 for a still sprite). */
export interface SheetRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
  readonly frames: number;
  /** Frame k starts at x + k × stride. */
  readonly stride: number;
  /** How long each frame shows; 0 for a still sprite. */
  readonly ms: number;
}

export function sheetRect(id: SpriteId): SheetRect {
  const s: {
    x: number;
    y: number;
    w: number;
    h: number;
    frames?: number;
    stride?: number;
    ms?: number;
  } = atlas.sprites[id];
  return {
    x: s.x,
    y: s.y,
    w: s.w,
    h: s.h,
    frames: s.frames ?? 1,
    stride: s.stride ?? 0,
    ms: s.ms ?? 0,
  };
}

/** Draws a whole sprite (one frame of an animation) with its top-left at (x, y) art px. */
export function drawSprite(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  id: SpriteId,
  x: number,
  y: number,
  frame = 0,
): void {
  const r = sheetRect(id);
  ctx.drawImage(img, r.x + (frame % r.frames) * r.stride, r.y, r.w, r.h, x, y, r.w, r.h);
}

/**
 * Draws the 16 px tile at (col, row) of a set (an autotile set, or a block of an animated one)
 * with its top-left at (x, y) art px.
 */
export function drawSubtile(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  id: SpriteId,
  col: number,
  row: number,
  x: number,
  y: number,
  frame = 0,
): void {
  const r = sheetRect(id);
  const sx = r.x + (frame % r.frames) * r.stride + col * SUBTILE;
  ctx.drawImage(img, sx, r.y + row * SUBTILE, SUBTILE, SUBTILE, x, y, SUBTILE, SUBTILE);
}
