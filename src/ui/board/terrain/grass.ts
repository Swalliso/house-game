// The lot's grass (D-097): LimeZu's grass on every cell, muted so the pieces stand out, with
// light tufts and tiny flowers scattered on open ground by tile hash (the audit prototype's
// rates). The sunny band's warmer grass went with the band (D-120): the sun shines on the whole
// lot, and shade.ts darkens the tiles a Tree shades.

import { terrainAt, type Lot } from '../../../rules/index.ts';
import { CELL, type SpriteId } from '../../sprites.ts';
import { SUB, SUBTILE } from '../autotile.ts';
import { drawSprite } from './atlas.ts';
import { tileHash } from './hash.ts';

/** About one subtile of open ground in this many gets a tuft… */
export const TUFT_EVERY = 11;
/** …and one in this many of the others a few tiny flowers. */
export const WILDFLOWERS_EVERY = 23;

const TUFTS = ['tuft-0', 'tuft-1'] as const satisfies readonly SpriteId[];
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
 * The tuft or the flowers on subtile (sx, sy) of open ground, if any, by tile hash. The title
 * screen's lawn strews its grass the same way.
 */
export function grassSprite(sx: number, sy: number, salt = 0): SpriteId | null {
  const h = tileHash(sx, sy, salt);
  if (h % TUFT_EVERY === 0) return TUFTS[(h >>> 4) & 1]!;
  if (h % WILDFLOWERS_EVERY === 0) return WILDFLOWERS[(h >>> 5) % WILDFLOWERS.length]!;
  return null;
}

/**
 * The tufts and flowers: on subtiles of open ground only, so water, trees, rocks, and finds
 * stand on plain grass. `salt` is the run's (hash.ts seedSalt), so each lot is strewn its own
 * way.
 */
export function grassDecor(lot: Lot, salt = 0): SubtileSprite[] {
  const out: SubtileSprite[] = [];
  for (let sy = 0; sy < lot.height * SUB; sy++) {
    for (let sx = 0; sx < lot.width * SUB; sx++) {
      const x = Math.floor(sx / SUB);
      const y = Math.floor(sy / SUB);
      if (terrainAt(lot, x, y) !== null) continue;
      const id = grassSprite(sx, sy, salt);
      if (id) out.push({ sx, sy, id });
    }
  }
  return out;
}

/** Grass on every cell of the lot, then the tufts and flowers. */
export function paintGrass(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  lot: Lot,
  salt = 0,
): void {
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) {
      drawSprite(ctx, img, 'grass-0', x * CELL, y * CELL);
    }
  }
  for (const d of grassDecor(lot, salt)) drawSprite(ctx, img, d.id, d.sx * SUBTILE, d.sy * SUBTILE);
}
