// Autotiling (D-097): which piece of a tile set to draw at each place of a region, from which
// of its neighbors are in the region too. Pure: no DOM. The lot's painters use it on the 16 px
// subtile grid, where each 32 px cell is 2×2 of LimeZu's 16 px tiles; anything that joins up
// (shores, grass edges, pavings, fences) can use it on any grid.
//
// Three kinds of set:
// - Blob sets, 47 tiles: an 8-neighbor mask picks the tile. LimeZu's autotile sheets
//   (Modern Exteriors' Godot_Autotiles_16x16.png and Game_Maker_Studio_Autotiles_16x16.png)
//   hold 26 such sets of 12 × 4 tiles each, in two layouts (BLOB_LAYOUTS).
// - Quarter sets (RPG Maker's A2 style): a 3 × 3 block of corners, edges and middle, plus a
//   2 × 2 block of inner corners, as in LimeZu's animated water. With 2 × 2 subtiles per cell,
//   each subtile's piece depends only on its own corner of the cell (quarterPiece).
// - Line sets, 16 tiles: a 4-neighbor mask, for fences and paths (lineMask).

/** A place on the grid being autotiled, and whether it's in the region. */
export type Inside = (x: number, y: number) => boolean;

// The 8-neighbor mask's bits, clockwise from north.
export const N = 1;
export const NE = 2;
export const E = 4;
export const SE = 8;
export const S = 16;
export const SW = 32;
export const W = 64;
export const NW = 128;

/** Subtiles per cell side: a 32 px cell is 2 × 2 of LimeZu's 16 px tiles. */
export const SUB = 2;
/** A subtile's size in art px. */
export const SUBTILE = 16;

/** Each corner bit with the two side bits it sits between. */
const CORNERS = [
  [NE, N, E],
  [SE, S, E],
  [SW, S, W],
  [NW, N, W],
] as const;

/**
 * Drops each corner bit whose two sides aren't both set: a corner only shapes the tile when the
 * region runs past it on both sides. Every mask becomes one of the 47 in BLOB47_MASKS.
 */
export function canonicalBlob(mask: number): number {
  let m = mask & 0xff;
  for (const [corner, a, b] of CORNERS) if (!(m & a && m & b)) m &= ~corner;
  return m;
}

/** The 47 canonical masks, ascending. */
export const BLOB47_MASKS: readonly number[] = [
  ...new Set(Array.from({ length: 256 }, (_, m) => canonicalBlob(m))),
].sort((a, b) => a - b);

/** The canonical 8-neighbor mask of (x, y) in the region. (x, y) itself isn't checked. */
export function blobMask(inside: Inside, x: number, y: number): number {
  let m = 0;
  if (inside(x, y - 1)) m |= N;
  if (inside(x + 1, y)) m |= E;
  if (inside(x, y + 1)) m |= S;
  if (inside(x - 1, y)) m |= W;
  if (m & N && m & E && inside(x + 1, y - 1)) m |= NE;
  if (m & S && m & E && inside(x + 1, y + 1)) m |= SE;
  if (m & S && m & W && inside(x - 1, y + 1)) m |= SW;
  if (m & N && m & W && inside(x - 1, y - 1)) m |= NW;
  return m;
}

/** LimeZu's two layouts of a 47-tile set (12 × 4 tiles). */
export type BlobLayout = 'godot' | 'gamemaker';

/**
 * Each layout's mask at each tile, row by row (-1: the set's one unused slot). Worked out from
 * the pixels by the M5a audit (SP/exteriors/godot_47_layout.json, render-arch's blobmask.py for
 * GameMaker's) and checked by drawing ponds and creeks.
 */
export const BLOB_LAYOUTS: Readonly<Record<BlobLayout, readonly (readonly number[])[]>> = {
  godot: [
    [16, 20, 84, 80, 213, 92, 116, 87, 28, 125, 124, 112],
    [17, 21, 85, 81, 29, 127, 253, 113, 31, 119, -1, 245],
    [1, 5, 69, 65, 23, 223, 247, 209, 95, 255, 221, 241],
    [0, 4, 68, 64, 117, 71, 197, 93, 7, 199, 215, 193],
  ],
  gamemaker: [
    [-1, 255, 127, 253, 125, 247, 119, 245, 117, 223, 95, 221],
    [93, 215, 87, 213, 85, 31, 29, 23, 21, 124, 116, 92],
    [84, 241, 209, 113, 81, 199, 71, 197, 69, 17, 68, 28],
    [20, 112, 80, 193, 65, 7, 5, 16, 4, 1, 64, 0],
  ],
};

/** A tile's column and row within its set. */
export interface TilePos {
  readonly col: number;
  readonly row: number;
}

const BLOB_INDEX: Readonly<Record<BlobLayout, ReadonlyMap<number, TilePos>>> = {
  godot: indexLayout(BLOB_LAYOUTS.godot),
  gamemaker: indexLayout(BLOB_LAYOUTS.gamemaker),
};

function indexLayout(rows: readonly (readonly number[])[]): Map<number, TilePos> {
  const index = new Map<number, TilePos>();
  rows.forEach((masks, row) => {
    masks.forEach((mask, col) => {
      if (mask >= 0) index.set(mask, { col, row });
    });
  });
  return index;
}

/** Where a mask's tile is in a 47-tile set. Any mask works: it's made canonical first. */
export function blobTile(layout: BlobLayout, mask: number): TilePos {
  const pos = BLOB_INDEX[layout].get(canonicalBlob(mask));
  if (!pos) throw new Error(`blobTile: no ${layout} tile for mask ${mask}`);
  return pos;
}

/**
 * The subtile grid from a cell test: subtile (x, y) is in the region when its cell is. Cells
 * off the grid get negative or too-large coordinates, for an edge policy to settle.
 */
export function bySubtile(cellInside: Inside, sub: number = SUB): Inside {
  return (x, y) => cellInside(Math.floor(x / sub), Math.floor(y / sub));
}

/**
 * What counts as in the region off a width × height grid:
 * - 'outside': nothing (a pond ends at the lot's edge).
 * - 'inside': everything (a region that runs on past the edge).
 * - 'extend': whatever the nearest place on the grid is (a creek flows on past the edge).
 */
export type EdgePolicy = 'outside' | 'inside' | 'extend';

/** `inside` on the grid, and the policy off it. */
export function withEdge(
  inside: Inside,
  width: number,
  height: number,
  policy: EdgePolicy,
): Inside {
  return (x, y) => {
    if (x >= 0 && y >= 0 && x < width && y < height) return inside(x, y);
    if (policy === 'outside') return false;
    if (policy === 'inside') return true;
    return inside(Math.min(width - 1, Math.max(0, x)), Math.min(height - 1, Math.max(0, y)));
  };
}

/**
 * A quarter set's piece: a tile of its 3 × 3 block (corners, edges, middle) or of its 2 × 2
 * block of inner corners (land in one corner, the region all around).
 */
export type QuarterPiece =
  | { readonly block: 'outer'; readonly col: number; readonly row: number }
  | { readonly block: 'inner'; readonly col: number; readonly row: number };

/**
 * The piece of a quarter set for a subtile with this mask, where the subtile is the corner of
 * its cell given by `right` and `down` (the north-west corner is false, false). With 2 × 2
 * subtiles per cell, the three neighbors inside the subtile's own cell are always in the
 * region, so only the other three decide: the side neighbor across, the one up or down, and
 * the corner between them.
 */
export function quarterPiece(mask: number, right: boolean, down: boolean): QuarterPiece {
  const vertical = mask & (down ? S : N);
  const across = mask & (right ? E : W);
  const corner = mask & (down ? (right ? SE : SW) : right ? NE : NW);
  if (vertical && across && !corner) {
    // An inner corner: the 2 × 2 block's tile with land in this subtile's outer corner.
    return { block: 'inner', col: right ? 0 : 1, row: down ? 0 : 1 };
  }
  return {
    block: 'outer',
    col: across ? 1 : right ? 2 : 0,
    row: vertical ? 1 : down ? 2 : 0,
  };
}

// The 4-neighbor (line) mask's bits.
export const LINE_N = 1;
export const LINE_E = 2;
export const LINE_S = 4;
export const LINE_W = 8;

/** The 4-neighbor mask of (x, y), 0–15: which side neighbors are in the region. */
export function lineMask(inside: Inside, x: number, y: number): number {
  return (
    (inside(x, y - 1) ? LINE_N : 0) |
    (inside(x + 1, y) ? LINE_E : 0) |
    (inside(x, y + 1) ? LINE_S : 0) |
    (inside(x - 1, y) ? LINE_W : 0)
  );
}
