import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import {
  BLOB47_MASKS,
  BLOB_LAYOUTS,
  blobMask,
  blobTile,
  bySubtile,
  canonicalBlob,
  E,
  LINE_E,
  LINE_N,
  LINE_S,
  LINE_W,
  lineMask,
  N,
  NE,
  NW,
  quarterPiece,
  S,
  SE,
  SW,
  W,
  withEdge,
  type BlobLayout,
  type Inside,
} from './autotile.ts';

/** A region from ASCII rows: '#' is in. Off the rows is out. */
function region(rows: readonly string[]): Inside {
  return (x, y) => rows[y]?.[x] === '#';
}

const LAYOUTS = Object.keys(BLOB_LAYOUTS) as BlobLayout[];

describe('blob masks', () => {
  it('come in 47 canonical kinds', () => {
    expect(BLOB47_MASKS).toHaveLength(47);
    expect(BLOB47_MASKS[0]).toBe(0);
    expect(BLOB47_MASKS.at(-1)).toBe(255);
  });

  it('keep a corner only between two sides that are in', () => {
    expect(canonicalBlob(NE)).toBe(0);
    expect(canonicalBlob(N | NE)).toBe(N);
    expect(canonicalBlob(N | E | NE)).toBe(N | E | NE);
    expect(canonicalBlob(0xff)).toBe(0xff);
    expect(canonicalBlob(S | W | SW | NW)).toBe(S | W | SW);
    for (let m = 0; m < 256; m++) expect(canonicalBlob(canonicalBlob(m))).toBe(canonicalBlob(m));
  });

  it('read the 8 neighbors, corners only between sides', () => {
    const r = region(['###', '#.#', '##.']);
    // The middle: everything but its south-east corner is in.
    expect(blobMask(r, 1, 1)).toBe(N | NE | E | S | SW | W | NW);
    // A lone place has nothing around it; a filled middle has everything.
    expect(blobMask(region(['...', '.#.', '...']), 1, 1)).toBe(0);
    expect(blobMask(region(['###', '###', '###']), 1, 1)).toBe(255);
    // A corner whose sides are out doesn't count.
    expect(blobMask(region(['#..', '...', '...']), 1, 1)).toBe(0);
  });

  it('are always one of the 47', () => {
    fc.assert(
      fc.property(fc.array(fc.boolean(), { minLength: 9, maxLength: 9 }), (cells) => {
        const inside: Inside = (x, y) => x >= 0 && x < 3 && y >= 0 && y < 3 && cells[y * 3 + x]!;
        expect(BLOB47_MASKS).toContain(blobMask(inside, 1, 1));
      }),
    );
  });
});

describe('the 47-tile layouts', () => {
  it.each(LAYOUTS)('%s holds each canonical mask once in 12 × 4 tiles', (layout) => {
    const rows = BLOB_LAYOUTS[layout];
    expect(rows).toHaveLength(4);
    for (const row of rows) expect(row).toHaveLength(12);
    const masks = rows.flat();
    expect(masks.filter((m) => m === -1)).toHaveLength(1);
    expect(masks.filter((m) => m >= 0).sort((a, b) => a - b)).toEqual(BLOB47_MASKS);
  });

  it.each(LAYOUTS)('%s finds every mask, made canonical first', (layout) => {
    for (let m = 0; m < 256; m++) {
      const { col, row } = blobTile(layout, m);
      expect(BLOB_LAYOUTS[layout][row]![col]).toBe(canonicalBlob(m));
    }
  });

  it('puts known tiles where LimeZu draws them', () => {
    // Godot: a lone tile at the bottom left, the full one in row 2; GameMaker: the reverse.
    expect(blobTile('godot', 0)).toEqual({ col: 0, row: 3 });
    expect(blobTile('godot', 255)).toEqual({ col: 9, row: 2 });
    expect(blobTile('gamemaker', 255)).toEqual({ col: 1, row: 0 });
    expect(blobTile('gamemaker', 0)).toEqual({ col: 11, row: 3 });
    // The top end of a vertical strip (only south is in).
    expect(blobTile('godot', S)).toEqual({ col: 0, row: 0 });
    expect(blobTile('gamemaker', S)).toEqual({ col: 7, row: 3 });
  });
});

describe('the subtile grid', () => {
  it('maps each subtile to its cell, off the grid too', () => {
    const seen: [number, number][] = [];
    const sub = bySubtile((x, y) => {
      seen.push([x, y]);
      return true;
    });
    sub(3, 1);
    sub(-1, -2);
    sub(-3, 4);
    expect(seen).toEqual([
      [1, 0],
      [-1, -1],
      [-2, 2],
    ]);
  });

  it('gives a pond of 2 × 2 cells rounded corners and straight sides', () => {
    // Cells: a 2 × 2 pond in a 4 × 4 lot. Subtiles: 8 × 8, the pond at 2–5.
    const pond = bySubtile(region(['....', '.##.', '.##.', '....']));
    expect(blobMask(pond, 2, 2)).toBe(E | SE | S);
    expect(blobMask(pond, 3, 2)).toBe(E | SE | S | SW | W);
    expect(blobMask(pond, 3, 3)).toBe(255);
    expect(blobMask(pond, 5, 5)).toBe(N | W | NW);
  });

  it('keeps a creek one cell wide as two subtiles, banks on both sides', () => {
    const creek = bySubtile(region(['.#.', '.#.', '.#.']));
    expect(blobMask(creek, 2, 2)).toBe(N | NE | E | SE | S);
    expect(blobMask(creek, 3, 2)).toBe(N | S | SW | W | NW);
  });
});

describe('edge policies', () => {
  const lot = region(['#..', '...']);

  it('treat the grid as it is, and off it as out, in, or the nearest place', () => {
    const outside = withEdge(lot, 3, 2, 'outside');
    const inside = withEdge(lot, 3, 2, 'inside');
    const extend = withEdge(lot, 3, 2, 'extend');
    for (const f of [outside, inside, extend]) {
      expect(f(0, 0)).toBe(true);
      expect(f(1, 0)).toBe(false);
    }
    expect(outside(-1, 0)).toBe(false);
    expect(inside(-1, 0)).toBe(true);
    expect(inside(5, 9)).toBe(true);
    expect(extend(-1, 0)).toBe(true);
    expect(extend(-4, -4)).toBe(true);
    expect(extend(0, 2)).toBe(false);
    expect(extend(3, 0)).toBe(false);
  });

  it('let a creek run on past the edge while a pond closes', () => {
    // A creek along the left column, and a pond at the right, both touching the top edge.
    const water = region(['#.#', '#..']);
    const creek = bySubtile(withEdge(water, 3, 2, 'extend'));
    const pond = bySubtile(withEdge(water, 3, 2, 'outside'));
    // The creek's top-left subtile is open to the north and the west: it flows on off the lot.
    expect(blobMask(creek, 0, 0) & (N | W)).toBe(N | W);
    // The pond's top subtiles have a shore along the lot's edge.
    expect(blobMask(pond, 4, 0) & N).toBe(0);
    expect(blobMask(pond, 5, 0) & N).toBe(0);
  });
});

describe('quarter sets', () => {
  // Masks as a subtile sees them: its own cell's three neighbors are always in.
  const NW_OWN = E | SE | S;

  it('pick corners, edges, and the middle from the 3 × 3 block', () => {
    expect(quarterPiece(NW_OWN, false, false)).toEqual({ block: 'outer', col: 0, row: 0 });
    expect(quarterPiece(NW_OWN | N | NE, false, false)).toEqual({
      block: 'outer',
      col: 0,
      row: 1,
    });
    expect(quarterPiece(NW_OWN | W | SW, false, false)).toEqual({
      block: 'outer',
      col: 1,
      row: 0,
    });
    expect(quarterPiece(255, false, false)).toEqual({ block: 'outer', col: 1, row: 1 });
    // The south-east subtile with land to the south and east: the south-east corner.
    expect(quarterPiece(N | NW | W, true, true)).toEqual({ block: 'outer', col: 2, row: 2 });
    expect(quarterPiece(255, true, true)).toEqual({ block: 'outer', col: 1, row: 1 });
  });

  it('pick the inner corner whose land is in the subtile’s own corner', () => {
    const allBut = (corner: number) => 255 & ~corner;
    expect(quarterPiece(allBut(NW), false, false)).toEqual({ block: 'inner', col: 1, row: 1 });
    expect(quarterPiece(allBut(NE), true, false)).toEqual({ block: 'inner', col: 0, row: 1 });
    expect(quarterPiece(allBut(SW), false, true)).toEqual({ block: 'inner', col: 1, row: 0 });
    expect(quarterPiece(allBut(SE), true, true)).toEqual({ block: 'inner', col: 0, row: 0 });
    // Another corner's land doesn't matter to this subtile.
    expect(quarterPiece(allBut(SE), false, false)).toEqual({ block: 'outer', col: 1, row: 1 });
  });
});

describe('line masks', () => {
  it('read the 4 side neighbors, 16 cases', () => {
    const plus = region(['.#.', '###', '.#.']);
    expect(lineMask(plus, 1, 1)).toBe(LINE_N | LINE_E | LINE_S | LINE_W);
    expect(lineMask(plus, 1, 0)).toBe(LINE_S);
    expect(lineMask(plus, 0, 1)).toBe(LINE_E);
    expect(lineMask(region(['#.#', '...', '#.#']), 1, 1)).toBe(0);
    const seen = new Set<number>();
    for (let bits = 0; bits < 16; bits++) {
      const r: Inside = (x, y) =>
        (y === 0 && x === 1 && !!(bits & 1)) ||
        (y === 1 && x === 2 && !!(bits & 2)) ||
        (y === 2 && x === 1 && !!(bits & 4)) ||
        (y === 1 && x === 0 && !!(bits & 8));
      seen.add(lineMask(r, 1, 1));
    }
    expect(seen.size).toBe(16);
  });
});
