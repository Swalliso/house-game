// The woods' floor (D-097): a step darker than the lot's grass under every Tree cell, so a
// cluster of trees reads as one wood and the gaps between their crowns are shade. LimeZu's
// grass edge (woods-edge, a 47-tile set) softens its border: the open grass's blades reach a
// few px into the shade. Off the lot's sides and top edge, the woods run on, so the floor has no
// edge there; along the street it closes with a verge of open grass, the grass whose blades hang
// over the sidewalk (street.ts). A lone Tree stands in a round patch of its own shade.

import { terrainAt, type Cell, type Lot } from '../../../rules/index.ts';
import { CELL } from '../../sprites.ts';
import { blobMask, blobTile, bySubtile, SUB, SUBTILE, withEdge } from '../autotile.ts';
import { drawSprite, drawSubtile } from './atlas.ts';
import { inLook, lotLook, type Look } from './biome.ts';

/** One tile of an autotile set on one subtile. */
export interface SetTile {
  readonly sx: number;
  readonly sy: number;
  readonly col: number;
  readonly row: number;
}

export interface WoodsFloor {
  /** The Tree cells, each floored with grass-woods. */
  readonly cells: readonly Cell[];
  /** The woods-edge tiles, on the floor's subtiles with open ground beside them. */
  readonly edge: readonly SetTile[];
  /** The lot's look (D-174). */
  readonly look: Look;
}

export function woodsFloor(lot: Lot): WoodsFloor {
  const tree = (x: number, y: number) => terrainAt(lot, x, y) === 'tree';
  const runOn = withEdge(tree, lot.width, lot.height, 'extend');
  const woods = bySubtile((x, y) => y < lot.height && runOn(x, y));
  const cells: Cell[] = [];
  const edge: SetTile[] = [];
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) if (tree(x, y)) cells.push({ x, y });
  }
  for (const { x, y } of cells) {
    for (let j = 0; j < SUB; j++) {
      for (let i = 0; i < SUB; i++) {
        const sx = x * SUB + i;
        const sy = y * SUB + j;
        const mask = blobMask(woods, sx, sy);
        if (mask !== 255) edge.push({ sx, sy, ...blobTile('godot', mask) });
      }
    }
  }
  return { cells, edge, look: lotLook(lot) };
}

export function paintWoodsFloor(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  floor: WoodsFloor,
): void {
  const ground = inLook('grass-woods', floor.look);
  const edge = inLook('woods-edge', floor.look);
  for (const c of floor.cells) drawSprite(ctx, img, ground, c.x * CELL, c.y * CELL);
  for (const t of floor.edge) {
    drawSubtile(ctx, img, edge, t.col, t.row, t.sx * SUBTILE, t.sy * SUBTILE);
  }
}
