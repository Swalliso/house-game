// The woods' floor (D-097): a step darker than the lot's grass under every Tree cell, so a
// cluster of trees reads as one wood and the gaps between their crowns are shade. LimeZu's
// grass edge (woods-edge, a 47-tile set) softens its border: the open grass's blades reach a
// few px into the shade. Off the lot's sides and top edge, the woods run on, so the floor has no
// edge there; along the street it closes with a verge of open grass, the grass whose blades hang
// over the sidewalk (street.ts). A lone Tree stands in a round patch of its own shade.
// D-190: the ground's lush grass (ground.ts) is the same floor out in the open, so a wood spills
// into the lawn and a patch by the water joins it with one edge.

import { terrainAt, type Cell, type Lot } from '../../../rules/index.ts';
import { CELL } from '../../sprites.ts';
import { blobMask, blobTile, bySubtile, SUB, SUBTILE, withEdge, type Inside } from '../autotile.ts';
import { drawSprite, drawSubtile } from './atlas.ts';
import { inLook, lotLook, type Look } from './biome.ts';

/** One tile of an autotile set on one subtile. */
export interface SetTile {
  readonly sx: number;
  readonly sy: number;
  readonly col: number;
  readonly row: number;
}

/** A subtile of the lot: (sx, sy) on the subtile grid, SUB × SUB per cell. */
export interface Subtile {
  readonly sx: number;
  readonly sy: number;
}

export interface WoodsFloor {
  /** The Tree cells, each floored with grass-woods. */
  readonly cells: readonly Cell[];
  /** D-190: the lush grass's subtiles out in the open, floored with grass-woods too. */
  readonly lush: readonly Subtile[];
  /** The woods-edge tiles, on the floor's subtiles with open ground beside them. */
  readonly edge: readonly SetTile[];
  /** The lot's look (D-174). */
  readonly look: Look;
}

/**
 * The floor under the lot's Trees and, D-190, on the subtiles of open ground where `lush` says
 * the grass grows lush (ground.ts): one region, with one edge where it meets the open grass.
 */
export function woodsFloor(lot: Lot, lush: Inside = () => false): WoodsFloor {
  const tree = (x: number, y: number) => terrainAt(lot, x, y) === 'tree';
  const runOn = withEdge(tree, lot.width, lot.height, 'extend');
  const woods = bySubtile((x, y) => y < lot.height && runOn(x, y));
  const sw = lot.width * SUB;
  const sh = lot.height * SUB;
  const open = (sx: number, sy: number) =>
    sx >= 0 &&
    sy >= 0 &&
    sx < sw &&
    sy < sh &&
    terrainAt(lot, Math.floor(sx / SUB), Math.floor(sy / SUB)) === null;
  const isLush = (sx: number, sy: number) => open(sx, sy) && lush(sx, sy);
  const floor: Inside = (sx, sy) => woods(sx, sy) || isLush(sx, sy);
  const cells: Cell[] = [];
  const lushSubtiles: Subtile[] = [];
  const edge: SetTile[] = [];
  const edgeAt = (sx: number, sy: number) => {
    const mask = blobMask(floor, sx, sy);
    if (mask !== 255) edge.push({ sx, sy, ...blobTile('godot', mask) });
  };
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) if (tree(x, y)) cells.push({ x, y });
  }
  for (const { x, y } of cells) {
    for (let j = 0; j < SUB; j++) {
      for (let i = 0; i < SUB; i++) edgeAt(x * SUB + i, y * SUB + j);
    }
  }
  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      if (!isLush(sx, sy)) continue;
      lushSubtiles.push({ sx, sy });
      edgeAt(sx, sy);
    }
  }
  return { cells, lush: lushSubtiles, edge, look: lotLook(lot) };
}

export function paintWoodsFloor(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  floor: WoodsFloor,
): void {
  const ground = inLook('grass-woods', floor.look);
  const edge = inLook('woods-edge', floor.look);
  for (const c of floor.cells) drawSprite(ctx, img, ground, c.x * CELL, c.y * CELL);
  for (const { sx, sy } of floor.lush) {
    drawSubtile(ctx, img, ground, sx % SUB, sy % SUB, sx * SUBTILE, sy * SUBTILE);
  }
  for (const t of floor.edge) {
    drawSubtile(ctx, img, edge, t.col, t.row, t.sx * SUBTILE, t.sy * SUBTILE);
  }
}
