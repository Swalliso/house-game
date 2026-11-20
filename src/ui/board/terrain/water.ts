// The lot's water (D-049, D-097): ponds and the creek in LimeZu's animated water, a shore
// autotiled per 16 px subtile from its 3 × 3 block and its inner corners (autotile.ts
// quarterPiece), with lily pads on a pond's open water. A creek flows on off the lot from the
// ends of its path, so they stay open (where it runs along the edge, it keeps a bank there), and
// a pond ends; outside.ts draws the creek flowing on. The water has its own small canvas over its
// bounding box, redrawn only to change frames; its shore's grass is keyed out, so the terrain
// canvas's grass shows around it, and the blades at the water's edge take that grass's colors.
// D-190: lily pads in a lake's shallows too (its cells beside the lot's open ground), and logs
// adrift on a lake and on a big pond.

import { terrainAt, type Lot } from '../../../rules/index.ts';
import { CELL, type SpriteId } from '../../sprites.ts';
import {
  blobMask,
  bySubtile,
  quarterPiece,
  SUB,
  SUBTILE,
  withEdge,
  type Inside,
  type QuarterPiece,
} from '../autotile.ts';
import { drawSprite, drawSubtile, sheetRect } from './atlas.ts';
import { inLook, lotLook, type Look } from './biome.ts';
import type { SubtileSprite } from './grass.ts';
import { tileHash } from './hash.ts';

/** About one open-water subtile of a pond in this many gets lily pads. */
export const LILY_EVERY = 4;
/**
 * D-190: about one open-water subtile of a lake's shallows (its cells beside open ground) in
 * this many gets them.
 */
export const LAKE_LILY_EVERY = 5;
/**
 * D-190: the logs adrift, longest first: two on a lake, and one on a pond of LOG_POND_CELLS
 * cells or more.
 */
export const LOGS = [
  'drift-log-2',
  'drift-log-0',
  'drift-log-1',
] as const satisfies readonly SpriteId[];
export const LOG_POND_CELLS = 12;
const LOG_SALT = 0x0a11;
const LILIES = ['lily-0', 'lily-1', 'lily-2'] as const satisfies readonly SpriteId[];
const SIDES = [
  [0, -1],
  [1, 0],
  [0, 1],
  [-1, 0],
] as const;

export interface WaterTile {
  readonly sx: number;
  readonly sy: number;
  readonly piece: QuarterPiece;
}

/** A box of cells. */
export interface CellBox {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

export interface WaterPlan {
  /** The cells the water covers, as a box: its canvas's place. Null when there's no water. */
  readonly box: CellBox | null;
  /** The lot's look (D-174): the grass blades at the water's edge. */
  readonly look: Look;
  /** A piece of the shore set on every subtile of water, in lot subtiles. */
  readonly tiles: readonly WaterTile[];
  readonly lilies: readonly SubtileSprite[];
  /** D-190: logs adrift, each with its top-left on a subtile and its box over open water. */
  readonly logs: readonly SubtileSprite[];
}

/**
 * The water, cell by cell, on the lot and off it: off the lot, a pond ends, and a creek flows
 * on from the ends of its path (straight on, as far as you like); where it runs along the
 * lot's edge it keeps a bank there. A lake (D-174) runs on past the lot's back edge and sides.
 */
export function waterCells(lot: Lot): Inside {
  const { width: w, height: h } = lot;
  const isCreek = (x: number, y: number) => terrainAt(lot, x, y) === 'creek';
  const onLot = (x: number, y: number) => x >= 0 && y >= 0 && x < w && y < h;
  // The path's ends: creek cells with at most one other creek cell beside them.
  const isEnd = (x: number, y: number) => {
    if (!isCreek(x, y)) return false;
    let beside = 0;
    for (const [dx, dy] of SIDES) if (isCreek(x + dx, y + dy)) beside++;
    return beside <= 1;
  };
  const ends = withEdge(isEnd, w, h, 'extend');
  const creek = (x: number, y: number) => (onLot(x, y) ? isCreek(x, y) : ends(x, y));
  const pond = withEdge((x, y) => terrainAt(lot, x, y) === 'pond', w, h, 'outside');
  const lake = withEdge((x, y) => terrainAt(lot, x, y) === 'lake', w, h, 'extend');
  return (x, y) => creek(x, y) || pond(x, y) || lake(x, y);
}

/**
 * Where each subtile of water takes its piece of the shore, and where the lilies float.
 * `salt` is the run's (hash.ts seedSalt).
 */
export function waterPlan(lot: Lot, salt = 0): WaterPlan {
  const { width: w, height: h } = lot;
  const pond = (x: number, y: number) => terrainAt(lot, x, y) === 'pond';
  // A lake's shallows: a cell of it beside open ground of the lot, sides or corners.
  const shallows = (x: number, y: number) => {
    if (terrainAt(lot, x, y) !== 'lake') return false;
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        const nx = x + dx;
        const ny = y + dy;
        if (nx >= 0 && ny >= 0 && nx < w && ny < h && terrainAt(lot, nx, ny) === null) return true;
      }
    }
    return false;
  };
  const water = bySubtile(waterCells(lot));
  const tiles: WaterTile[] = [];
  const lilies: SubtileSprite[] = [];
  let x0 = w;
  let y0 = h;
  let x1 = -1;
  let y1 = -1;
  for (let sy = 0; sy < h * SUB; sy++) {
    for (let sx = 0; sx < w * SUB; sx++) {
      if (!water(sx, sy)) continue;
      const x = Math.floor(sx / SUB);
      const y = Math.floor(sy / SUB);
      x0 = Math.min(x0, x);
      y0 = Math.min(y0, y);
      x1 = Math.max(x1, x);
      y1 = Math.max(y1, y);
      const mask = blobMask(water, sx, sy);
      const piece = quarterPiece(mask, sx % SUB === SUB - 1, sy % SUB === SUB - 1);
      tiles.push({ sx, sy, piece });
      const hash = tileHash(sx, sy, salt);
      if (
        mask === 255 &&
        ((pond(x, y) && hash % LILY_EVERY === 0) ||
          (shallows(x, y) && hash % LAKE_LILY_EVERY === 0))
      ) {
        lilies.push({ sx, sy, id: LILIES[(hash >>> 3) % LILIES.length]! });
      }
    }
  }
  const box = x1 < 0 ? null : { x: x0, y: y0, w: x1 - x0 + 1, h: y1 - y0 + 1 };
  return { box, look: lotLook(lot), tiles, lilies, logs: driftLogs(lot, tiles, lilies, salt) };
}

/**
 * D-190: two logs adrift on a lake and one on a pond of LOG_POND_CELLS or more, longest first,
 * each where its box and a subtile round it lie on the lot's open water, a cell in from the lot's
 * edge and clear of the lilies and the other log. Their places are the water's subtiles in an
 * order hashed from the run's salt.
 */
function driftLogs(
  lot: Lot,
  tiles: readonly WaterTile[],
  lilies: readonly SubtileSprite[],
  salt: number,
): SubtileSprite[] {
  const sw = lot.width * SUB;
  const sh = lot.height * SUB;
  const open = new Set<number>();
  for (const t of tiles)
    if (t.piece.block === 'outer' && t.piece.col === 1 && t.piece.row === 1)
      open.add(t.sy * sw + t.sx);
  for (const l of lilies) open.delete(l.sy * sw + l.sx);
  const logs: SubtileSprite[] = [];
  for (const body of waterBodies(lot)) {
    const want =
      body.kind === 'lake'
        ? 2
        : body.kind === 'pond' && body.cells.length >= LOG_POND_CELLS
          ? 1
          : 0;
    if (want === 0) continue;
    const cells = new Set(body.cells);
    const places = tiles
      .filter((t) => cells.has(Math.floor(t.sy / SUB) * lot.width + Math.floor(t.sx / SUB)))
      .map((t) => ({ sx: t.sx, sy: t.sy, h: tileHash(t.sx, t.sy, salt ^ LOG_SALT) }))
      .sort((a, b) => a.h - b.h || a.sy - b.sy || a.sx - b.sx);
    let placed = 0;
    for (const p of places) {
      if (placed === want) break;
      const id = LOGS[placed % LOGS.length]!;
      const r = sheetRect(id);
      // The log's box and a subtile round it, a cell in from the lot's edge.
      const left = p.sx - 1;
      const top = p.sy - 1;
      const right = p.sx + Math.ceil(r.w / SUBTILE);
      const bottom = p.sy + Math.ceil(r.h / SUBTILE);
      if (left < SUB - 1 || top < SUB - 1 || right > sw - SUB || bottom > sh - SUB) continue;
      let clear = true;
      for (let y = top; y <= bottom && clear; y++) {
        for (let x = left; x <= right && clear; x++) clear = open.has(y * sw + x);
      }
      if (!clear) continue;
      for (let y = top; y <= bottom; y++)
        for (let x = left; x <= right; x++) open.delete(y * sw + x);
      logs.push({ sx: p.sx, sy: p.sy, id });
      placed++;
    }
  }
  return logs;
}

/** The subtiles a log's box covers, as indices on the lot's subtile grid. */
function logSubtiles(log: SubtileSprite, subtilesWide: number): number[] {
  const r = sheetRect(log.id);
  const out: number[] = [];
  for (let j = 0; j < Math.ceil(r.h / SUBTILE); j++) {
    for (let i = 0; i < Math.ceil(r.w / SUBTILE); i++)
      out.push((log.sy + j) * subtilesWide + log.sx + i);
  }
  return out;
}

/**
 * Draws one frame of the water into its own canvas, whose top-left is the box's top-left cell.
 * The canvas is cleared first: everything around the shore stays clear for the grass below.
 */
export function paintWater(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  plan: WaterPlan,
  frame: number,
): void {
  const { box } = plan;
  if (!box) return;
  ctx.clearRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  const ox = box.x * CELL;
  const oy = box.y * CELL;
  for (const { sx, sy, piece } of plan.tiles) {
    drawSubtile(
      ctx,
      img,
      inLook(shoreSet(piece), plan.look),
      piece.col,
      piece.row,
      sx * SUBTILE - ox,
      sy * SUBTILE - oy,
      frame,
    );
  }
  for (const l of plan.lilies) drawSprite(ctx, img, l.id, l.sx * SUBTILE - ox, l.sy * SUBTILE - oy);
  for (const l of plan.logs) drawSprite(ctx, img, l.id, l.sx * SUBTILE - ox, l.sy * SUBTILE - oy);
}

/** The shore set a piece comes from: the 3 × 3 block or the inner corners. */
export function shoreSet(piece: QuarterPiece): SpriteId {
  return piece.block === 'outer' ? 'shore' : 'shore-corners';
}

// ---------------------------------------------------------------------------------------------
// D-185: life at the water. A frog sits on some of a pond's big lily pads, breathing now and
// then, and now and then fish swim by under the surface of each pond, creek and lake.
// TerrainLayer.tsx draws them over the water canvas, so the pieces and the tree crowns stay in
// front. The photos and the street's houses paint the water alone (photo-paint.ts): no life.

/** A rectangle in art px. */
export interface ArtRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}

/**
 * The lily pad a frog sits on: lily-2's one big pad (art px 1–13 across its subtile, 3–14 down),
 * and where the frog's frame goes on the pad's subtile, facing west or mirrored: its body (3–13
 * across its frame, 2–12 mirrored) over the pad's middle.
 */
export const FROG_PAD: {
  readonly id: SpriteId;
  readonly at: { readonly x: number; readonly y: number };
  readonly mirrored: { readonly x: number; readonly y: number };
} = { id: 'lily-2', at: { x: -1, y: 0 }, mirrored: { x: 0, y: 0 } };
/** About one big pad in this many gets a frog, and a pond with any big pad gets one. */
export const FROG_EVERY = 3;
/** About one fish for this many cells of a pond, creek or lake: one at least, FISH_MAX at most. */
export const FISH_CELLS = 16;
export const FISH_MAX = 3;
/** Two fish in the same water keep at least this many cells apart, one way or the other. */
export const FISH_APART = 4;
/** On open water: a school passing, a fish rising and circling, or two circling. */
export const FISH_OPEN = [
  'life-fish-1',
  'life-fish-2',
  'life-fish-3',
] as const satisfies readonly SpriteId[];
/** Across a creek a cell wide, the school passing: the others circle, which it hasn't room for. */
export const FISH_NARROW: SpriteId = 'life-fish-1';

/** A whole 16 × 16 frame shows. */
const WHOLE: ArtRect = { x: 0, y: 0, w: SUBTILE, h: SUBTILE };

/**
 * A straight run of creek a cell wide: where a fish's frame goes in the cell, and the part of it
 * that shows. That's the shore's open water between the banks' shadows, the same in all its
 * frames: rows 13–23 of a cell running east–west (its top subtiles' last three, its bottom ones'
 * first eight), columns 9–21 of one running north–south.
 */
interface Run {
  readonly frame: { readonly x: number; readonly y: number };
  readonly clip: ArtRect;
}
export const RUNS = {
  eastWest: { frame: { x: 8, y: 10 }, clip: { x: 0, y: 3, w: 16, h: 11 } },
  northSouth: { frame: { x: 7, y: 8 }, clip: { x: 2, y: 0, w: 13, h: 16 } },
} as const satisfies Record<string, Run>;

/**
 * A frog or a fish on the water: its sprite, its frame's top-left in lot art px, the part of the
 * frame that shows, whether it's mirrored, and a hash for its timing (lifeBeat).
 */
export interface WaterCritter {
  readonly id: SpriteId;
  readonly x: number;
  readonly y: number;
  readonly clip: ArtRect;
  readonly flip: boolean;
  readonly beat: number;
}

export interface WaterLife {
  readonly frogs: readonly WaterCritter[];
  readonly fish: readonly WaterCritter[];
}

/** A pond, a creek or a lake on the lot: its cells (indices, in order), joined side by side. */
export interface WaterBody {
  readonly kind: 'pond' | 'creek' | 'lake';
  readonly cells: readonly number[];
}

/** The lot's bodies of water, in reading order of their first cells. */
export function waterBodies(lot: Lot): WaterBody[] {
  const { width: w, height: h } = lot;
  const seen = new Uint8Array(w * h);
  const out: WaterBody[] = [];
  for (let i = 0; i < w * h; i++) {
    const kind = lot.terrain[i];
    if (seen[i] || (kind !== 'pond' && kind !== 'creek' && kind !== 'lake')) continue;
    const cells: number[] = [];
    const todo = [i];
    seen[i] = 1;
    while (todo.length > 0) {
      const c = todo.pop()!;
      cells.push(c);
      const x = c % w;
      const y = (c - x) / w;
      for (const [dx, dy] of SIDES) {
        const nx = x + dx;
        const ny = y + dy;
        const n = ny * w + nx;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h || seen[n] || lot.terrain[n] !== kind) continue;
        seen[n] = 1;
        todo.push(n);
      }
    }
    out.push({ kind, cells: cells.sort((a, b) => a - b) });
  }
  return out;
}

/** Whether a subtile's piece is the shore block's tile at (col, row): (1, 1) is open water. */
function isPiece(p: QuarterPiece | undefined, col: number, row: number): boolean {
  return p?.block === 'outer' && p.col === col && p.row === row;
}

/** The cell's run, if it's on a straight stretch of creek a cell wide; null if not. */
function straightRun(
  pieces: ReadonlyMap<number, QuarterPiece>,
  lotWidth: number,
  x: number,
  y: number,
): Run | null {
  const is = (dx: number, dy: number, col: number, row: number) =>
    isPiece(pieces.get((y * SUB + dy) * lotWidth * SUB + x * SUB + dx), col, row);
  // Banks north and south, water on east and west; or banks east and west.
  if (is(0, 0, 1, 0) && is(1, 0, 1, 0) && is(0, 1, 1, 2) && is(1, 1, 1, 2)) return RUNS.eastWest;
  if (is(0, 0, 0, 1) && is(1, 0, 2, 1) && is(0, 1, 0, 1) && is(1, 1, 2, 1)) return RUNS.northSouth;
  return null;
}

// Each pick hashes the place with its own salt, so the picks don't follow one another.
const FROG_SALT = 0x2f6b9a43;
const FISH_SALT = 0x6c8e9cf5;
const BEAT_SALT = 0x1b873593;

/** A place a fish could come by, and its cell, for keeping two apart. */
interface FishSpot {
  readonly id: SpriteId;
  readonly x: number;
  readonly y: number;
  readonly clip: ArtRect;
  readonly cx: number;
  readonly cy: number;
  readonly h: number;
}

/**
 * The water's life (D-185), from its plan. On each pond, frogs on about one big lily pad in
 * FROG_EVERY (a pond with any gets one). In each pond, creek and lake, about one fish for every
 * FISH_CELLS cells (one to FISH_MAX), FISH_APART cells apart or more: on a subtile of open water
 * with no lily, or across a straight run of the creek. Every pick is a hash of the place and the
 * run's `salt`, never chance, so the same lot always has the same life. `covered`: the cells of
 * water a piece stands over (a Driveway's bridge), where no fish would show.
 */
export function waterLife(
  lot: Lot,
  plan: WaterPlan,
  salt = 0,
  covered: readonly number[] = [],
): WaterLife {
  const w = lot.width;
  const sw = w * SUB;
  const pieces = new Map(plan.tiles.map((t) => [t.sy * sw + t.sx, t.piece]));
  const lilies = new Map(plan.lilies.map((l) => [l.sy * sw + l.sx, l.id]));
  // D-190: no fish shows over a log adrift.
  const logged = new Set(plan.logs.flatMap((l) => logSubtiles(l, sw)));
  const under = new Set(covered);
  const frogs: WaterCritter[] = [];
  const fish: WaterCritter[] = [];
  const beat = (x: number, y: number) => tileHash(x, y, salt ^ BEAT_SALT);
  for (const body of waterBodies(lot)) {
    const pads: { sx: number; sy: number; h: number }[] = [];
    const spots: FishSpot[] = [];
    for (const i of body.cells) {
      const cx = i % w;
      const cy = (i - cx) / w;
      const run = straightRun(pieces, w, cx, cy);
      if (run && !under.has(i)) {
        const x = cx * CELL + run.frame.x;
        const y = cy * CELL + run.frame.y;
        const h = tileHash(x, y, salt ^ FISH_SALT);
        spots.push({ id: FISH_NARROW, x, y, clip: run.clip, cx, cy, h });
        continue;
      }
      for (let k = 0; k < SUB * SUB; k++) {
        const sx = cx * SUB + (k % SUB);
        const sy = cy * SUB + Math.floor(k / SUB);
        const lily = lilies.get(sy * sw + sx);
        if (lily === FROG_PAD.id) pads.push({ sx, sy, h: tileHash(sx, sy, salt ^ FROG_SALT) });
        if (
          lily ||
          logged.has(sy * sw + sx) ||
          under.has(i) ||
          !isPiece(pieces.get(sy * sw + sx), 1, 1)
        )
          continue;
        const x = sx * SUBTILE;
        const y = sy * SUBTILE;
        const h = tileHash(x, y, salt ^ FISH_SALT);
        spots.push({ id: FISH_OPEN[(h >>> 4) % FISH_OPEN.length]!, x, y, clip: WHOLE, cx, cy, h });
      }
    }
    pads.sort((a, b) => a.h - b.h);
    const frogsHere = pads.length === 0 ? 0 : Math.max(1, Math.round(pads.length / FROG_EVERY));
    for (const { sx, sy, h } of pads.slice(0, frogsHere)) {
      const flip = (h & 1) === 1;
      const at = flip ? FROG_PAD.mirrored : FROG_PAD.at;
      const x = sx * SUBTILE + at.x;
      const y = sy * SUBTILE + at.y;
      frogs.push({ id: 'life-frog', x, y, clip: WHOLE, flip, beat: beat(x, y) });
    }
    spots.sort((a, b) => a.h - b.h);
    const fishHere = Math.min(FISH_MAX, Math.max(1, Math.round(body.cells.length / FISH_CELLS)));
    const taken: FishSpot[] = [];
    for (const s of spots) {
      if (taken.length === fishHere) break;
      const apart = (t: FishSpot) =>
        Math.abs(t.cx - s.cx) >= FISH_APART || Math.abs(t.cy - s.cy) >= FISH_APART;
      if (taken.every(apart)) taken.push(s);
    }
    for (const { id, x, y, clip, h } of taken) {
      fish.push({ id, x, y, clip, flip: (h & 1) === 1, beat: beat(x, y) });
    }
  }
  return { frogs, fish };
}

/**
 * A critter's time on the water: its strip has `positions` frames of `ms` each, so it comes
 * round once every so often, somewhere in `everyMs` by its beat. `delayMs` is how far into that
 * it is when the lot first shows, a whole number of frames, by its beat too, so no two of them
 * keep time together.
 */
export function lifeBeat(
  beat: number,
  frames: number,
  ms: number,
  everyMs: readonly [number, number],
): { positions: number; delayMs: number } {
  const [lo, hi] = everyMs;
  const every = lo + (((beat >>> 8) % 1024) / 1023) * (hi - lo);
  const positions = Math.max(frames + 1, Math.round(every / ms));
  return { positions, delayMs: (beat % positions) * ms };
}

/**
 * The frame a critter's strip shows at each of its `positions`, -1 for none. A frog breathes
 * through its frames, then sits on its first. The fish come by at the strip's end, after a stretch
 * of open water, so a strip held on its first position (Reduce motion) shows the frog sitting
 * and no fish.
 */
export function lifeStrip(kind: 'frog' | 'fish', frames: number, positions: number): number[] {
  const from = positions - frames;
  return Array.from({ length: positions }, (_, k) => {
    if (kind === 'frog') return k < frames ? k : 0;
    return k < from ? -1 : k - from;
  });
}
