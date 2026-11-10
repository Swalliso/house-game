// The street along the lot's bottom edge (D-049, D-097), in 16 px rows of subtiles:
// - The street row (the rules' street, where pieces touch it): a sidewalk, its curb's lip on
//   its south edge (Godot set 18). The lot's grass hangs a few blades over its north edge, but
//   not where water or a piece meets the street (a Driveway runs onto the sidewalk).
// - The road below, decoration only (ROAD_ROWS): asphalt with a dashed center line, then the
//   far curb and the start of the far sidewalk, where the board ends.

import { terrainAt, type Lot } from '../../../rules/index.ts';
import { type SpriteId } from '../../sprites.ts';
import { blobTile, E, N, NE, NW, S, SE, SUB, SUBTILE, SW, W } from '../autotile.ts';
import { ROAD_ROWS } from '../geometry.ts';
import { drawSprite, drawSubtile } from './atlas.ts';

/** One 16 px tile of the street: a whole sprite, or a tile of a set. */
export interface StreetTile {
  readonly id: SpriteId;
  readonly col: number;
  readonly row: number;
  /** In lot subtiles; the street row starts at lot height × SUB. */
  readonly sx: number;
  readonly sy: number;
}

export type StreetRow = 'sidewalk' | 'curb' | 'road' | 'line' | 'far';

/** The street's rows of subtiles, from the lot's edge down. */
export function streetRows(): StreetRow[] {
  const road = ROAD_ROWS * SUB - 1;
  const rows: StreetRow[] = ['sidewalk', 'curb'];
  for (let i = 0; i < road; i++) rows.push(i === (road - 1) >> 1 ? 'line' : 'road');
  rows.push('far');
  return rows.slice(0, (1 + ROAD_ROWS) * SUB);
}

const set = (mask: number) => blobTile('godot', mask);
const PAVING = {
  sidewalk: set(255),
  // The sidewalk's south edge: the curb's lip, then the road.
  curb: set(N | NE | E | W | NW),
  // The far sidewalk's north edge, across the road.
  far: set(E | SE | S | SW | W),
};

/**
 * The paving of one subtile of the street, in a row of this kind, in subtile column `sx` (any
 * whole number, off the board too: the dashes keep their step). `sy` is where it goes.
 */
export function pavingTile(kind: StreetRow, sx: number, sy: number): StreetTile {
  const odd = ((sx % 2) + 2) % 2 === 1;
  if (kind === 'road' || (kind === 'line' && odd)) {
    return { id: 'street-asphalt', col: 0, row: 0, sx, sy };
  }
  if (kind === 'line') return { id: 'street-line', col: 0, row: 0, sx, sy };
  return { id: 'street-sidewalk', ...PAVING[kind], sx, sy };
}

/**
 * The street's tiles: the paving, then the lot's grass over the sidewalk's north edge.
 * `front[x]` is true where a piece stands on the lot's bottom row in column x: no grass there.
 */
export function streetTiles(lot: Lot, front: readonly boolean[] = []): StreetTile[] {
  const out: StreetTile[] = [];
  const top = lot.height * SUB;
  const width = lot.width * SUB;
  streetRows().forEach((kind, j) => {
    for (let sx = 0; sx < width; sx++) out.push(pavingTile(kind, sx, top + j));
  });
  // The lot's grass over the sidewalk's north edge; not where water or a piece meets the street.
  const blades = set(E | SE | S | SW | W);
  const cell = (sx: number) => Math.floor(sx / SUB);
  for (let sx = 0; sx < width; sx++) {
    const t = terrainAt(lot, cell(sx), lot.height - 1);
    if (t === 'pond' || t === 'creek' || front[cell(sx)]) continue;
    out.push({ id: 'woods-edge', ...blades, sx, sy: top });
  }
  return out;
}

export function paintStreet(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  tiles: readonly StreetTile[],
): void {
  for (const t of tiles) {
    const x = t.sx * SUBTILE;
    const y = t.sy * SUBTILE;
    if (t.id === 'street-asphalt' || t.id === 'street-line') {
      drawSprite(ctx, img, t.id, x, y);
    } else {
      drawSubtile(ctx, img, t.id, t.col, t.row, x, y);
    }
  }
}
