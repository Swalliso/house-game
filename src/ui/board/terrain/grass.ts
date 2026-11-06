// The lot's grass (D-097): LimeZu's grass on every cell, muted so the pieces stand out, in the
// sunny side's warmer colors where isSunny says so, with light tufts and tiny flowers scattered
// on open ground by tile hash (the audit prototype's rates).

import { isSunny, terrainAt, type Lot } from '../../../rules/index.ts';
import { CELL, type SpriteId } from '../../sprites.ts';
import { SUB, SUBTILE } from '../autotile.ts';
import { drawSprite } from './atlas.ts';
import { tileHash } from './hash.ts';

/** About one subtile of open ground in this many gets a tuft… */
export const TUFT_EVERY = 11;
/** …and one in this many of the others a few tiny flowers. */
export const WILDFLOWERS_EVERY = 23;

const TUFTS = ['tuft-0', 'tuft-1'] as const satisfies readonly SpriteId[];
const SUNNY_TUFTS = ['tuft-sunny-0', 'tuft-sunny-1'] as const satisfies readonly SpriteId[];
const WILDFLOWERS = [
  'wildflowers-0',
  'wildflowers-1',
  'wildflowers-2',
  'wildflowers-3',
  'wildflowers-4',
] as const satisfies readonly SpriteId[];

/** A 16 px sprite on one subtile: (sx, sy) on the subtile grid, SUB × SUB per cell. */
export interface SubtileSprite {
  readonly sx: number;
  readonly sy: number;
  readonly id: SpriteId;
}

/**
 * The tufts and flowers: on subtiles of open ground only, so water, trees, rocks, and finds
 * stand on plain grass. A tuft takes the colors of the grass it's on.
 */
export function grassDecor(lot: Lot): SubtileSprite[] {
  const out: SubtileSprite[] = [];
  for (let sy = 0; sy < lot.height * SUB; sy++) {
    for (let sx = 0; sx < lot.width * SUB; sx++) {
      const x = Math.floor(sx / SUB);
      const y = Math.floor(sy / SUB);
      if (terrainAt(lot, x, y) !== null) continue;
      const h = tileHash(sx, sy);
      if (h % TUFT_EVERY === 0) {
        out.push({ sx, sy, id: (isSunny(lot, x, y) ? SUNNY_TUFTS : TUFTS)[(h >>> 4) & 1]! });
      } else if (h % WILDFLOWERS_EVERY === 0) {
        out.push({ sx, sy, id: WILDFLOWERS[(h >>> 5) % WILDFLOWERS.length]! });
      }
    }
  }
  return out;
}

/** Grass on every cell of the lot, then the tufts and flowers. */
export function paintGrass(ctx: CanvasRenderingContext2D, img: CanvasImageSource, lot: Lot): void {
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) {
      drawSprite(ctx, img, isSunny(lot, x, y) ? 'grass-sunny' : 'grass-0', x * CELL, y * CELL);
    }
  }
  for (const d of grassDecor(lot)) drawSprite(ctx, img, d.id, d.sx * SUBTILE, d.sy * SUBTILE);
}
