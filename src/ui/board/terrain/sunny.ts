// The sunny side's edge (D-049, D-097). Sunny cells are exactly isSunny(lot, x, y): the band of
// rows along one side, except Tree cells, which stay shaded. Where sunny ground meets shade,
// LimeZu's grass edge in the sunny colors (sun-edge, a 47-tile set) is drawn over the shaded
// subtiles, so sunny tufts and a soft shadow reach a few px into the shade: the band's inner
// edge reads as sunlight, and a Tree in the band stands in a round patch of its own shade.

import { isSunny, type Lot } from '../../../rules/index.ts';
import { blobMask, blobTile, bySubtile, SUB, SUBTILE } from '../autotile.ts';
import { drawSubtile } from './atlas.ts';

/** One tile of an autotile set on one subtile. */
export interface SetTile {
  readonly sx: number;
  readonly sy: number;
  readonly col: number;
  readonly row: number;
}

/**
 * The sun-edge tiles: one on every shaded subtile with sunny ground beside it, picked by which
 * of its neighbors are shaded too. Off the lot, isSunny's band runs on along its side, so the
 * band has no edge at the lot's border.
 */
export function sunnyEdge(lot: Lot): SetTile[] {
  const shaded = bySubtile((x, y) => !isSunny(lot, x, y));
  const out: SetTile[] = [];
  for (let sy = 0; sy < lot.height * SUB; sy++) {
    for (let sx = 0; sx < lot.width * SUB; sx++) {
      if (!shaded(sx, sy)) continue;
      const mask = blobMask(shaded, sx, sy);
      if (mask !== 255) out.push({ sx, sy, ...blobTile('godot', mask) });
    }
  }
  return out;
}

export function paintSunnyEdge(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  tiles: readonly SetTile[],
): void {
  for (const t of tiles)
    drawSubtile(ctx, img, 'sun-edge', t.col, t.row, t.sx * SUBTILE, t.sy * SUBTILE);
}
