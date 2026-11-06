// The street along the lot's bottom edge (D-049, D-097), in 16 px rows of subtiles:
// - The street row (the rules' street, where pieces touch it): a sidewalk, its curb's lip on
//   its south edge (Godot set 18). The lot's grass hangs a few blades over its north edge.
// - The road below, decoration only (ROAD_ROWS): asphalt with a dashed center line, then the
//   far curb and the start of the far sidewalk, where the board ends.

import { isSunny, terrainAt, type Lot } from '../../../rules/index.ts';
import { type SpriteId } from '../../sprites.ts';
import { blobTile, E, N, NE, NW, S, SE, SUB, SUBTILE, SW, W } from '../autotile.ts';
import { ROAD_ROWS } from '../geometry.ts';
import { drawSprite, drawSubtile, sheetRect } from './atlas.ts';

/** One 16 px tile of the street: a whole sprite, or a tile of a set. */
export interface StreetTile {
  readonly id: SpriteId;
  readonly col: number;
  readonly row: number;
  /** In lot subtiles; the street row starts at lot height × SUB. */
  readonly sx: number;
  readonly sy: number;
  /** Only these columns of the tile, [from, to) in art px, when not all of it. */
  readonly cols?: readonly [number, number];
}

/**
 * How far the sunny side's edge reaches into the shade beside it, in art px: its blades on a
 * shaded subtile (sunny.ts, LimeZu's grass edge) are 6 px deep.
 */
export const SUN_SPILL = 6;

/** The street's rows of subtiles, from the lot's edge down. */
export function streetRows(): ('sidewalk' | 'curb' | 'road' | 'line' | 'far')[] {
  const road = ROAD_ROWS * SUB - 1;
  const rows: ('sidewalk' | 'curb' | 'road' | 'line' | 'far')[] = ['sidewalk', 'curb'];
  for (let i = 0; i < road; i++) rows.push(i === (road - 1) >> 1 ? 'line' : 'road');
  rows.push('far');
  return rows.slice(0, (1 + ROAD_ROWS) * SUB);
}

export function streetTiles(lot: Lot): StreetTile[] {
  const out: StreetTile[] = [];
  const top = lot.height * SUB;
  const set = (mask: number) => blobTile('godot', mask);
  const tiles = {
    sidewalk: set(255),
    // The sidewalk's south edge: the curb's lip, then the road.
    curb: set(N | NE | E | W | NW),
    // The far sidewalk's north edge, across the road.
    far: set(E | SE | S | SW | W),
  };
  streetRows().forEach((kind, j) => {
    for (let sx = 0; sx < lot.width * SUB; sx++) {
      const sy = top + j;
      if (kind === 'road' || (kind === 'line' && sx % 2 === 1)) {
        out.push({ id: 'street-asphalt', col: 0, row: 0, sx, sy });
      } else if (kind === 'line') {
        out.push({ id: 'street-line', col: 0, row: 0, sx, sy });
      } else {
        out.push({ id: 'street-sidewalk', ...tiles[kind], sx, sy });
      }
    }
  });
  // The lot's grass over the sidewalk's north edge, in the colors of the grass above it; not
  // where water meets the street. Beside the sunny side, its blades reach into the shade as
  // the sunny side's edge does above them.
  const blades = set(E | SE | S | SW | W);
  const width = lot.width * SUB;
  const sunny = (sx: number) => isSunny(lot, Math.floor(sx / SUB), lot.height - 1);
  for (let sx = 0; sx < width; sx++) {
    const t = terrainAt(lot, Math.floor(sx / SUB), lot.height - 1);
    if (t === 'pond' || t === 'creek') continue;
    out.push({ id: sunny(sx) ? 'sun-edge' : 'woods-edge', ...blades, sx, sy: top });
    if (sunny(sx)) continue;
    if (sx > 0 && sunny(sx - 1)) {
      out.push({ id: 'sun-edge', ...blades, sx, sy: top, cols: [0, SUN_SPILL] });
    }
    if (sx + 1 < width && sunny(sx + 1)) {
      out.push({ id: 'sun-edge', ...blades, sx, sy: top, cols: [SUBTILE - SUN_SPILL, SUBTILE] });
    }
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
    if (t.cols) {
      const r = sheetRect(t.id);
      const [from, to] = t.cols;
      const sx = r.x + t.col * SUBTILE + from;
      ctx.drawImage(
        img,
        sx,
        r.y + t.row * SUBTILE,
        to - from,
        SUBTILE,
        x + from,
        y,
        to - from,
        SUBTILE,
      );
    } else if (t.id === 'street-asphalt' || t.id === 'street-line') {
      drawSprite(ctx, img, t.id, x, y);
    } else {
      drawSubtile(ctx, img, t.id, t.col, t.row, x, y);
    }
  }
}
