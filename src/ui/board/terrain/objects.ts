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

import { terrainAt, type Lot } from '../../../rules/index.ts';
import { CELL, type SpriteId } from '../../sprites.ts';
import { SUBTILE } from '../autotile.ts';
import { sheetRect } from './atlas.ts';
import { inLook, lotLook } from './biome.ts';
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

/** Every kind of tree that grows on a Tree cell. */
export const TREE_KINDS: readonly SpriteId[] = TREES.map((t) => t.id);

/** How far a tree may stray from its cell's middle, in art px: sideways, and up. */
const TREE_JITTER_X = 2;
export const TREE_JITTER_UP = 2;

/** The tree that grows on a cell, by tile hash (with the run's salt: hash.ts seedSalt). */
export function treeKind(x: number, y: number, salt = 0): SpriteId {
  let r = (tileHash(x, y, salt) >>> 8) % TREE_WEIGHT;
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
export function trees(lot: Lot, salt = 0): Placed[] {
  const out: Placed[] = [];
  const under = new Set<number>();
  for (const b of bigTreeBlocks(lot)) {
    // The big tree stands on the block's lower row; the upper row's trees show behind it.
    under.add((b.y + 1) * lot.width + b.x);
    under.add((b.y + 1) * lot.width + b.x + 1);
    const id = tileHash(b.y, b.x, salt) % BIG_APPLE_EVERY === 0 ? 'tree-big-apple' : 'tree-big';
    out.push(standing(id, (b.x + 1) * CELL, (b.y + 2) * CELL, b.y * CELL));
  }
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) {
      if (terrainAt(lot, x, y) !== 'tree' || under.has(y * lot.width + x)) continue;
      const h = tileHash(x, y, salt);
      // Sideways within the cell (never past the lot's sides), and up a little, never down.
      const left = x === 0 ? 0 : -TREE_JITTER_X;
      const right = x === lot.width - 1 ? 0 : TREE_JITTER_X;
      const dx = left + ((h >>> 4) % (right - left + 1));
      const dy = -((h >>> 12) % (TREE_JITTER_UP + 1));
      const kind = treeKind(x, y, salt);
      out.push(standing(kind, (x + 0.5) * CELL + dx, (y + 1) * CELL + dy, y * CELL));
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
export function boulders(lot: Lot, salt = 0): Placed[] {
  const out: Placed[] = [];
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) {
      if (terrainAt(lot, x, y) !== 'boulder') continue;
      const h = tileHash(x, y, salt);
      const id: SpriteId = 'rocks';
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
        out.push(standing('time-capsule', (x + 0.5) * CELL, (y + 1) * CELL, y * CELL));
      }
    }
  }
  return out;
}

/**
 * Everything that stands on the lot, in drawing order: by bottom edge, then left to right.
 * `salt` is the run's (hash.ts seedSalt): which tree grows where, and how the rocks lie. Each
 * is in the lot's look (D-174): a biome's cut is the same size as the meadow's.
 */
export function lotObjects(lot: Lot, salt = 0): Placed[] {
  const look = lotLook(lot);
  return [...trees(lot, salt), ...boulders(lot, salt), ...finds(lot)]
    .map((p) => ({ ...p, id: inLook(p.id, look) }))
    .sort((a, b) => a.y + a.h - (b.y + b.h) || a.x - b.x);
}

/** A box in art px. */
export interface ArtBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * The parts above their own cells (the tree tops the canopy canvas draws), as boxes in art px:
 * the pieces' digits and badges, drawn over the canopy, keep off them where they can
 * (label-layout.ts).
 */
export function canopyParts(placed: readonly Placed[]): ArtBox[] {
  return placed.flatMap((p) =>
    p.y < p.top ? [{ x: p.x, y: p.y, w: p.w, h: Math.min(p.top, p.y + p.h) - p.y }] : [],
  );
}

/**
 * The canopy canvas's box, or null when nothing rises above its own cells: the whole lot and
 * the row above it (a tree in the top row rises past the lot's edge; the tallest rises 21 px).
 * It keeps its size while trees come and go, so redrawing it never blanks it first, and it's
 * whole cells, so at Fit's fractional scale its pixels land on the terrain's.
 */
export function canopyBox(lot: Lot, placed: readonly Placed[]): ArtBox | null {
  let top = 0;
  let rises = false;
  for (const p of placed) {
    if (p.y >= p.top) continue;
    rises = true;
    top = Math.min(top, p.y);
  }
  if (!rises) return null;
  const y = Math.min(-CELL, Math.floor(top / CELL) * CELL);
  return { x: 0, y, w: lot.width * CELL, h: lot.height * CELL - y };
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
