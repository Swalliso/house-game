// What stands on the lot (D-049, D-097): the woods, the boulders, and the finds, as LimeZu
// sprites placed by rule and tile hash, never by chance, so the same lot always looks the same.
// Each sprite stands on its own cells; whatever rises above them (tree tops) goes on the canopy
// canvas, above the pieces, and the rest on the terrain canvas. Both are drawn in row order,
// south in front.
//
// - Woods: one tree per Tree cell, its kind by tile hash (round, bushy, conifers, a pine, now
//   and then apples), so every tree cell stays countable. Deep in the woods, on a 2 × 2 block
//   of Tree cells that no piece can touch (every cell beside the block is a Tree or off the
//   lot), a big tree stands in for the block's lower trees. Under it all, the woods' floor
//   (woods.ts).
// - Boulders: two or three rocks per cell.
// - Finds: the Old Shed on its 2 × 2 footprint, and the Time Capsule's dug soil and shovel.

import { isSunny, terrainAt, type Lot } from '../../../rules/index.ts';
import { CELL, type SpriteId } from '../../sprites.ts';
import { SUBTILE } from '../autotile.ts';
import { sheetRect } from './atlas.ts';
import { tileHash } from './hash.ts';

/** A sprite, or one 16 px tile of a set, standing on the lot. All sizes in art px. */
export interface Placed {
  readonly id: SpriteId;
  /** The part of the sprite to draw: the whole sprite, or one tile of a set. */
  readonly sx: number;
  readonly sy: number;
  readonly w: number;
  readonly h: number;
  /** Where its top-left lands on the lot. */
  readonly x: number;
  readonly y: number;
  /** The top edge of the cells it stands on: the part above goes on the canopy. */
  readonly top: number;
}

/** A tree's kind, and how often it grows, out of TREE_WEIGHT. */
const TREES: readonly { readonly id: SpriteId; readonly weight: number }[] = [
  { id: 'tree-round', weight: 6 },
  { id: 'tree-bushy', weight: 5 },
  { id: 'tree-bush', weight: 2 },
  { id: 'tree-conifer', weight: 3 },
  { id: 'tree-conifer-cones', weight: 1 },
  { id: 'tree-pine', weight: 1 },
  { id: 'tree-apple', weight: 1 },
  { id: 'tree-bushy-apple', weight: 1 },
];
const TREE_WEIGHT = TREES.reduce((n, t) => n + t.weight, 0);

/** About one big tree in this many is an apple tree. */
const BIG_APPLE_EVERY = 5;

/** How far a tree may stray from its cell's middle, in art px: sideways, and up. */
const TREE_JITTER_X = 2;
const TREE_JITTER_UP = 2;

/** The tree that grows on a cell, by tile hash. */
export function treeKind(x: number, y: number): SpriteId {
  let r = (tileHash(x, y) >>> 8) % TREE_WEIGHT;
  for (const t of TREES) {
    if (r < t.weight) return t.id;
    r -= t.weight;
  }
  return TREES[0]!.id;
}

/** A whole sprite with its bottom edge at `bottom` and its middle at `mid`. */
function standing(id: SpriteId, mid: number, bottom: number, top: number): Placed {
  const { w, h } = sheetRect(id);
  return { id, sx: 0, sy: 0, w, h, x: Math.round(mid - w / 2), y: bottom - h, top };
}

/**
 * The 2 × 2 blocks of Tree cells deep enough in the woods for a big tree, as their top-left
 * cells: every cell beside the block is a Tree too, or off the lot, so no piece can touch the
 * block and the trees a player counts beside a piece are always one per cell. Taken greedily,
 * row by row; blocks never overlap.
 */
export function bigTreeBlocks(lot: Lot): { x: number; y: number }[] {
  const tree = (x: number, y: number) => terrainAt(lot, x, y) === 'tree';
  const onLot = (x: number, y: number) => x >= 0 && y >= 0 && x < lot.width && y < lot.height;
  const closed = (x: number, y: number) => !onLot(x, y) || tree(x, y);
  const taken = new Set<number>();
  const blocks: { x: number; y: number }[] = [];
  for (let y = 0; y + 1 < lot.height; y++) {
    for (let x = 0; x + 1 < lot.width; x++) {
      const cells = [
        [x, y],
        [x + 1, y],
        [x, y + 1],
        [x + 1, y + 1],
      ] as const;
      if (!cells.every(([cx, cy]) => tree(cx, cy) && !taken.has(cy * lot.width + cx))) continue;
      const beside = [
        [x, y - 1],
        [x + 1, y - 1],
        [x, y + 2],
        [x + 1, y + 2],
        [x - 1, y],
        [x - 1, y + 1],
        [x + 2, y],
        [x + 2, y + 1],
      ] as const;
      if (!beside.every(([cx, cy]) => closed(cx, cy))) continue;
      for (const [cx, cy] of cells) taken.add(cy * lot.width + cx);
      blocks.push({ x, y });
    }
  }
  return blocks;
}

/** The trees: one per Tree cell, except where a big tree stands for a block's lower row. */
export function trees(lot: Lot): Placed[] {
  const out: Placed[] = [];
  const under = new Set<number>();
  for (const b of bigTreeBlocks(lot)) {
    // The big tree stands on the block's lower row; the upper row's trees show behind it.
    under.add((b.y + 1) * lot.width + b.x);
    under.add((b.y + 1) * lot.width + b.x + 1);
    const id = tileHash(b.y, b.x) % BIG_APPLE_EVERY === 0 ? 'tree-big-apple' : 'tree-big';
    out.push(standing(id, (b.x + 1) * CELL, (b.y + 2) * CELL, b.y * CELL));
  }
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) {
      if (terrainAt(lot, x, y) !== 'tree' || under.has(y * lot.width + x)) continue;
      const h = tileHash(x, y);
      // Sideways within the cell (never past the lot's sides), and up a little, never down.
      const left = x === 0 ? 0 : -TREE_JITTER_X;
      const right = x === lot.width - 1 ? 0 : TREE_JITTER_X;
      const dx = left + ((h >>> 4) % (right - left + 1));
      const dy = -((h >>> 12) % (TREE_JITTER_UP + 1));
      out.push(standing(treeKind(x, y), (x + 0.5) * CELL + dx, (y + 1) * CELL + dy, y * CELL));
    }
  }
  return out;
}

// The rocks in their set (a 3 × 3 block of 16 px tiles): big ones, middling, and small, and
// the row in its tile where each one's foot is.
const BIG_ROCKS = [1, 2, 6, 7] as const;
const MID_ROCKS = [3, 4, 5] as const;
const SMALL_ROCKS = [0, 8] as const;
const ROCK_FOOT = [13, 15, 15, 12, 13, 13, 14, 16, 15] as const;

/**
 * Two or three rocks on each Boulder cell, by tile hash: a middling one behind, a big one in
 * front of it, and most often a small one at their feet, mirrored on some cells. They fill the
 * cell without leaving it. The grass at their feet takes the colors of the ground they're on.
 */
export function boulders(lot: Lot): Placed[] {
  const out: Placed[] = [];
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) {
      if (terrainAt(lot, x, y) !== 'boulder') continue;
      const h = tileHash(x, y);
      const id: SpriteId = isSunny(lot, x, y) ? 'rocks-sunny' : 'rocks';
      const mirror = ((h >>> 15) & 1) === 1;
      // A rock's tile with its left edge at rx and its foot on row `foot` of the cell.
      const rock = (k: number, rx: number, foot: number): Placed => ({
        id,
        sx: (k % 3) * SUBTILE,
        sy: Math.floor(k / 3) * SUBTILE,
        w: SUBTILE,
        h: SUBTILE,
        x: x * CELL + (mirror ? CELL - SUBTILE - rx : rx),
        y: y * CELL + foot - ROCK_FOOT[k]!,
        top: y * CELL,
      });
      out.push(rock(MID_ROCKS[(h >>> 3) % MID_ROCKS.length]!, 12 + ((h >>> 9) % 5), 19));
      out.push(rock(BIG_ROCKS[h % BIG_ROCKS.length]!, 2 + ((h >>> 11) % 5), 29));
      if ((h >>> 6) % 4 !== 0) {
        out.push(rock(SMALL_ROCKS[(h >>> 7) % SMALL_ROCKS.length]!, 14 + ((h >>> 13) % 3), 31));
      }
    }
  }
  return out;
}

/** The finds: the Old Shed on its 2 × 2 footprint, and each Time Capsule's dug soil. */
export function finds(lot: Lot): Placed[] {
  const out: Placed[] = [];
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) {
      const t = terrainAt(lot, x, y);
      if (t === 'oldShed') {
        // Once per shed, from its top-left cell, at LimeZu's size, in the middle of the
        // footprint: it fills the 2 × 2 cells' height exactly, so nothing rises above them.
        if (terrainAt(lot, x - 1, y) === 'oldShed' || terrainAt(lot, x, y - 1) === 'oldShed') {
          continue;
        }
        out.push(standing('old-shed', (x + 1) * CELL, (y + 2) * CELL, y * CELL));
      } else if (t === 'timeCapsule') {
        const id: SpriteId = isSunny(lot, x, y) ? 'time-capsule-sunny' : 'time-capsule';
        out.push(standing(id, (x + 0.5) * CELL, (y + 1) * CELL, y * CELL));
      }
    }
  }
  return out;
}

/** Everything that stands on the lot, in drawing order: by bottom edge, then left to right. */
export function lotObjects(lot: Lot): Placed[] {
  return [...trees(lot), ...boulders(lot), ...finds(lot)].sort(
    (a, b) => a.y + a.h - (b.y + b.h) || a.x - b.x,
  );
}

/** A box in art px. */
export interface ArtBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * The box around everything that rises above its own cells (the canopy's), or null, in whole
 * cells: at Fit's fractional scale, cells are whole device pixels, so the canopy's pixels land
 * on the terrain's.
 */
export function canopyBox(placed: readonly Placed[]): ArtBox | null {
  let x0 = Infinity;
  let y0 = Infinity;
  let x1 = -Infinity;
  let y1 = -Infinity;
  for (const p of placed) {
    if (p.y >= p.top) continue;
    x0 = Math.min(x0, p.x);
    y0 = Math.min(y0, p.y);
    x1 = Math.max(x1, p.x + p.w);
    y1 = Math.max(y1, p.top);
  }
  if (x1 < x0) return null;
  const down = (v: number) => Math.floor(v / CELL) * CELL;
  const up = (v: number) => Math.ceil(v / CELL) * CELL;
  return { x: down(x0), y: down(y0), w: up(x1) - down(x0), h: up(y1) - down(y0) };
}

function drawRows(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  p: Placed,
  from: number,
  to: number,
  ox: number,
  oy: number,
): void {
  if (to <= from) return;
  const r = sheetRect(p.id);
  const sy = p.sy + (from - p.y);
  ctx.drawImage(img, r.x + p.sx, r.y + sy, p.w, to - from, p.x - ox, from - oy, p.w, to - from);
}

/** The parts on their own cells, into the terrain canvas (the lot's top-left at 0, 0). */
export function paintObjects(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  placed: readonly Placed[],
): void {
  for (const p of placed) drawRows(ctx, img, p, Math.max(p.y, p.top), p.y + p.h, 0, 0);
}

/** The parts above their own cells, into the canopy canvas, whose top-left is the box's. */
export function paintCanopy(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  placed: readonly Placed[],
  box: ArtBox,
): void {
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  for (const p of placed) drawRows(ctx, img, p, p.y, Math.min(p.top, p.y + p.h), box.x, box.y);
}
