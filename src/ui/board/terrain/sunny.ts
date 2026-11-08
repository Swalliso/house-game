// The sunny side's edge (D-049, D-097). Sunny cells are exactly isSunny(lot, x, y): the band of
// rows along one side, except Tree cells, which stay shaded. Where sunny ground meets shade,
// LimeZu's grass edge in the sunny colors (sun-edge, a 47-tile set) is drawn over the shaded
// subtiles, so sunny tufts and a soft shadow reach a few px into the shade: the band's inner
// edge reads as sunlight. A Tree inside the band keeps its whole cell in shade (its woods floor
// and that floor's own soft edge), as the rules and the inspect panel say.

import { isSunny, terrainAt, type Lot } from '../../../rules/index.ts';
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
 * The lot's painters' sunny ground, cell by cell: isSunny, except below the lot (the street),
 * where each column takes its bottom row's state, so no sunny edge ever faces the street. Off the
 * lot's other edges, isSunny's band runs on along its side, so the band has no edge there.
 */
export function sunnyGround(lot: Lot): (x: number, y: number) => boolean {
  return (x, y) => isSunny(lot, x, Math.min(y, lot.height - 1));
}

/**
 * Tree cells inside the sunny band: the rules shade them (isSunny), so no sunny edge is drawn
 * on them, and they read as shade all the way to their cell's edge.
 */
export function bandTree(lot: Lot): (x: number, y: number) => boolean {
  // isSunny on the lot without its trees is the band itself.
  const band: Lot = { ...lot, terrain: lot.terrain.map(() => null) };
  return (x, y) => terrainAt(lot, x, y) === 'tree' && isSunny(band, x, y);
}

/**
 * The sun-edge tiles: one on every shaded subtile with sunny ground beside it, picked by which
 * of its neighbors are shaded too, except on the Trees inside the band.
 */
export function sunnyEdge(lot: Lot): SetTile[] {
  const sunny = sunnyGround(lot);
  const inBand = bandTree(lot);
  const shaded = bySubtile((x, y) => !sunny(x, y));
  const out: SetTile[] = [];
  for (let sy = 0; sy < lot.height * SUB; sy++) {
    for (let sx = 0; sx < lot.width * SUB; sx++) {
      if (!shaded(sx, sy) || inBand(Math.floor(sx / SUB), Math.floor(sy / SUB))) continue;
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
