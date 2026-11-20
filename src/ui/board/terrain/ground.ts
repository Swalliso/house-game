// The lot's ground (D-190): the grass in patches, wildflowers in drifts, and the woods'
// undergrowth, so a lot has places (a clearing, a flower patch, a damp corner by the pond)
// instead of one even sheet of lawn. All of it is flat and muted (D-099) and lies on open
// ground, under the pieces; only the undergrowth stands up, on a Tree's own cell. Every pick is
// a hash of the place and the run's salt, never chance, so a lot looks the same every time,
// and the plan reads only the lot's terrain, so it changes only where that does (a Tree cleared
// for a piece, a Sapling grown).
// - Patches: smooth noise over the 16 px subtile grid picks where the grass grows lush (the
//   woods' floor, joined to it, woods.ts), where it's short and sunny (grass-light, edged with
//   the woods edge's blades), and where the earth shows (dirt-edge, a 47-tile set). Lush grass
//   gathers by the water and the woods; bare earth keeps clear of the water and is commonest on
//   a dry lot. A patch keeps only subtiles in some whole 2 × 2 block of it, so it has no strips
//   a subtile wide and no specks.
// - Scatter: wildflowers in drifts of one color, clover and sprigs in the lush grass,
//   mushrooms and twigs at the woods' edge, pebbles by the Boulders and on bare earth, fallen
//   leaves round the autumn woods, and a few tufts and flowers everywhere else. A sprite goes
//   down only where its whole box is on open ground of the lot.
// - Undergrowth: ferns, shrubs, moss and mushrooms on some Tree cells, at the foot of the cell
//   in front of its trunk.

import { terrainAt, type Lot, type TerrainId } from '../../../rules/index.ts';
import { CELL, type SpriteId } from '../../sprites.ts';
import { blobMask, blobTile, SUB, SUBTILE, type Inside } from '../autotile.ts';
import { drawSprite, drawSubtile, sheetRect } from './atlas.ts';
import { inLook, lotLook, type Look } from './biome.ts';
import { tileHash } from './hash.ts';
import { bigTreeBlocks } from './objects.ts';
import {
  paintWoodsFloor,
  woodsFloor,
  type SetTile,
  type Subtile,
  type WoodsFloor,
} from './woods.ts';

/**
 * Each look's thresholds on the patches' noise (0 to 1; higher is rarer): where the grass grows
 * lush, where it's short and sunny, where the earth shows, and where the wildflowers drift.
 * The lakeside looks like the meadow.
 */
export const GROUND: Readonly<
  Record<
    Look,
    { readonly lush: number; readonly light: number; readonly dirt: number; readonly drift: number }
  >
> = {
  meadow: { lush: 0.67, light: 0.62, dirt: 0.81, drift: 0.73 },
  autumn: { lush: 0.73, light: 0.7, dirt: 0.83, drift: 0.82 },
  dry: { lush: 0.8, light: 0.6, dirt: 0.71, drift: 0.84 },
};

/**
 * How much more readily the grass grows lush beside the water, a cell further out, and by the
 * woods.
 */
const LUSH_BY_WATER = 0.2;
const LUSH_NEAR_WATER = 0.1;
const LUSH_BY_WOODS = 0.08;

// Each layer of noise hashes the place with its own salt, so the patches don't follow one another.
const LUSH_SALT = 0x1111;
const LIGHT_SALT = 0x2222;
const DIRT_SALT = 0x3333;
const DRIFT_SALT = 0x4444;
const DRIFT_COLOR_SALT = 0x5555;
const SCATTER_SALT = 0x51ed27;
const UNDERGROWTH_SALT = 0x6b43a9;
const OCTAVE_SALT = 0x5bd1e995;

/** A drift's color holds over a square of this many subtiles a side. */
export const DRIFT_ZONE = 7;

const DRIFTS = [
  'drift-white',
  'drift-blue',
  'drift-pink',
  'drift-violet',
  'drift-red',
] as const satisfies readonly SpriteId[];
const WILDFLOWERS = [
  'wildflowers-0',
  'wildflowers-1',
  'wildflowers-2',
  'wildflowers-3',
  'wildflowers-4',
] as const satisfies readonly SpriteId[];
const LEAVES = [
  'leaves-0',
  'leaves-1',
  'leaves-2',
  'leaves-3',
  'leaves-4',
  'leaves-5',
] as const satisfies readonly SpriteId[];
const PEBBLES = [
  'pebbles-0',
  'pebbles-1',
  'pebbles-2',
  'pebbles-3',
] as const satisfies readonly SpriteId[];
const WOODS_EDGE = [
  'mush-0',
  'mush-1',
  'mush-2',
  'mush-3',
  'twig-0',
  'twig-1',
  'mush-0',
  'twig-0',
] as const satisfies readonly SpriteId[];
const BARE = [
  'pebbles-0',
  'pebbles-1',
  'twig-0',
  'pebbles-3',
] as const satisfies readonly SpriteId[];
const LUSH = [
  'clover-0',
  'clover-1',
  'clover-2',
  'clover-3',
  'sprig-0',
  'sprig-1',
  'tuft-0',
] as const satisfies readonly SpriteId[];
const SUNNY = [
  'tuft-1',
  'wildflowers-0',
  'wildflowers-3',
  'tuft-0',
] as const satisfies readonly SpriteId[];
const ELSEWHERE = [
  'tuft-0',
  'tuft-1',
  'wildflowers-1',
  'wildflowers-2',
  'sprig-2',
] as const satisfies readonly SpriteId[];
/** At the woods' edge, the undergrowth is shrubs and ferns; inside, ferns and moss. */
const UNDER_EDGE = [
  'shrub-0',
  'shrub-1',
  'shrub-2',
  'fern-0',
  'fern-1',
  'fern-2',
  'mush-3',
  'shrub-1',
] as const satisfies readonly SpriteId[];
const UNDER_INSIDE = [
  'fern-0',
  'fern-1',
  'fern-2',
  'fern-3',
  'moss-0',
  'mush-0',
  'fern-1',
  'mush-3',
] as const satisfies readonly SpriteId[];

const pick = <T>(list: readonly T[], h: number): T => list[h % list.length]!;

/** Smooth value noise, 0 to 1: hashed values on a lattice `scale` subtiles apart, eased between. */
function noise(sx: number, sy: number, scale: number, salt: number): number {
  const gx = sx / scale;
  const gy = sy / scale;
  const x0 = Math.floor(gx);
  const y0 = Math.floor(gy);
  const v = (x: number, y: number) => (tileHash(x, y, salt) & 0xffff) / 0xffff;
  const ease = (t: number) => t * t * (3 - 2 * t);
  const u = ease(gx - x0);
  const w = ease(gy - y0);
  const a = v(x0, y0);
  const b = v(x0 + 1, y0);
  const c = v(x0, y0 + 1);
  const d = v(x0 + 1, y0 + 1);
  return a + (b - a) * u + (c - a) * w + (a - b - c + d) * u * w;
}

/** Two octaves of noise: broad patches with ragged edges. */
export function patchNoise(sx: number, sy: number, scale: number, salt: number): number {
  return 0.65 * noise(sx, sy, scale, salt) + 0.35 * noise(sx, sy, scale / 2.3, salt ^ OCTAVE_SALT);
}

/** Each cell's distance to the nearest cell of the kinds in `kinds`, four ways, up to `cap`. */
function distanceTo(lot: Lot, kinds: readonly TerrainId[], cap = 6): Uint8Array {
  const { width: w, height: h } = lot;
  const d = new Uint8Array(w * h).fill(cap);
  const queue: number[] = [];
  for (let i = 0; i < w * h; i++) {
    const t = lot.terrain[i];
    if (t != null && kinds.includes(t)) {
      d[i] = 0;
      queue.push(i);
    }
  }
  for (let head = 0; head < queue.length; head++) {
    const i = queue[head]!;
    const x = i % w;
    const y = (i - x) / w;
    for (const [nx, ny] of [
      [x + 1, y],
      [x - 1, y],
      [x, y + 1],
      [x, y - 1],
    ] as const) {
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const j = ny * w + nx;
      if (d[j]! > d[i]! + 1) {
        d[j] = d[i]! + 1;
        queue.push(j);
      }
    }
  }
  return d;
}

/**
 * A patch with no strips a subtile wide and no specks: only subtiles in some whole 2 × 2 block
 * of it stay, then a subtile of `fill` ground whose four sides are all in the patch joins it.
 */
export function tidyPatch(
  patch: Uint8Array,
  width: number,
  height: number,
  fill: (sx: number, sy: number) => boolean,
): Uint8Array {
  const at = (m: Uint8Array, x: number, y: number) =>
    x >= 0 && y >= 0 && x < width && y < height && m[y * width + x] === 1;
  const out = new Uint8Array(width * height);
  for (let y = 0; y < height - 1; y++) {
    for (let x = 0; x < width - 1; x++) {
      if (
        at(patch, x, y) &&
        at(patch, x + 1, y) &&
        at(patch, x, y + 1) &&
        at(patch, x + 1, y + 1)
      ) {
        out[y * width + x] = 1;
        out[y * width + x + 1] = 1;
        out[(y + 1) * width + x] = 1;
        out[(y + 1) * width + x + 1] = 1;
      }
    }
  }
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      if (out[y * width + x] || !fill(x, y)) continue;
      if (at(out, x - 1, y) && at(out, x + 1, y) && at(out, x, y - 1) && at(out, x, y + 1)) {
        out[y * width + x] = 1;
      }
    }
  }
  return out;
}

/** A sprite and its top-left, in lot art px. */
export interface GroundBit {
  readonly id: SpriteId;
  readonly x: number;
  readonly y: number;
}

export interface GroundPlan {
  /** The lot's look (D-174). */
  readonly look: Look;
  /** The short, sunny grass's subtiles, and its edge: the woods edge's blades reaching in. */
  readonly light: readonly Subtile[];
  readonly lightEdge: readonly SetTile[];
  /** The woods' floor: the Tree cells and the lush grass, with one edge (woods.ts). */
  readonly floor: WoodsFloor;
  /** The bare earth: a tile of dirt-edge on each of its subtiles. */
  readonly dirt: readonly SetTile[];
  /** Flat things on open ground, in the order they're drawn. */
  readonly scatter: readonly GroundBit[];
  /** The woods' undergrowth, drawn after what stands on the lot. */
  readonly undergrowth: readonly GroundBit[];
}

/**
 * The lot's ground: where its patches lie and what's strewn on it. `salt` is the run's (hash.ts
 * seedSalt).
 */
export function groundPlan(lot: Lot, salt = 0): GroundPlan {
  const look = lotLook(lot);
  const tune = GROUND[look];
  const { width: w, height: h } = lot;
  const sw = w * SUB;
  const sh = h * SUB;
  const cellOf = (sx: number, sy: number) => Math.floor(sy / SUB) * w + Math.floor(sx / SUB);
  const open = (sx: number, sy: number) =>
    sx >= 0 && sy >= 0 && sx < sw && sy < sh && lot.terrain[cellOf(sx, sy)] == null;
  const water = distanceTo(lot, ['pond', 'creek', 'lake']);
  const woods = distanceTo(lot, ['tree']);
  const rocks = distanceTo(lot, ['boulder']);
  const near = (d: Uint8Array, sx: number, sy: number) => d[cellOf(sx, sy)]!;

  // The patches: lush first, then the sunny grass and the bare earth where it isn't lush.
  let lush: Uint8Array = new Uint8Array(sw * sh);
  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      if (!open(sx, sy)) continue;
      const wet = near(water, sx, sy);
      const bonus =
        (wet <= 1 ? LUSH_BY_WATER : wet <= 2 ? LUSH_NEAR_WATER : 0) +
        (near(woods, sx, sy) <= 1 ? LUSH_BY_WOODS : 0);
      if (patchNoise(sx, sy, 7, salt ^ LUSH_SALT) + bonus > tune.lush) lush[sy * sw + sx] = 1;
    }
  }
  lush = tidyPatch(lush, sw, sh, open);
  const notLush = (sx: number, sy: number) => open(sx, sy) && lush[sy * sw + sx] === 0;
  const dry = (sx: number, sy: number) => notLush(sx, sy) && near(water, sx, sy) > 1;
  let light: Uint8Array = new Uint8Array(sw * sh);
  let dirt: Uint8Array = new Uint8Array(sw * sh);
  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      if (notLush(sx, sy) && patchNoise(sx, sy, 8, salt ^ LIGHT_SALT) > tune.light)
        light[sy * sw + sx] = 1;
      if (dry(sx, sy) && patchNoise(sx, sy, 5, salt ^ DIRT_SALT) > tune.dirt)
        dirt[sy * sw + sx] = 1;
    }
  }
  light = tidyPatch(light, sw, sh, notLush);
  dirt = tidyPatch(dirt, sw, sh, dry);

  const inPatch =
    (m: Uint8Array): Inside =>
    (sx, sy) =>
      sx >= 0 && sy >= 0 && sx < sw && sy < sh && m[sy * sw + sx] === 1;
  const floor = woodsFloor(lot, inPatch(lush));
  const lightSubtiles: Subtile[] = [];
  const lightEdge: SetTile[] = [];
  const dirtTiles: SetTile[] = [];
  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      const i = sy * sw + sx;
      if (light[i]) {
        lightSubtiles.push({ sx, sy });
        const mask = blobMask(inPatch(light), sx, sy);
        if (mask !== 255) lightEdge.push({ sx, sy, ...blobTile('godot', mask) });
      }
      if (dirt[i])
        dirtTiles.push({ sx, sy, ...blobTile('godot', blobMask(inPatch(dirt), sx, sy)) });
    }
  }

  // The scatter: each sprite centered on its subtile, nudged a few px by hash, and only where
  // its whole box lies on open ground of the lot.
  const scatter: GroundBit[] = [];
  const fits = (r: { w: number; h: number }, x: number, y: number) => {
    if (x < 0 || y < 0 || x + r.w > w * CELL || y + r.h > h * CELL) return false;
    for (let cy = Math.floor(y / CELL); cy <= Math.floor((y + r.h - 1) / CELL); cy++) {
      for (let cx = Math.floor(x / CELL); cx <= Math.floor((x + r.w - 1) / CELL); cx++) {
        if (terrainAt(lot, cx, cy) !== null) return false;
      }
    }
    return true;
  };
  const put = (id: SpriteId, sx: number, sy: number, hash: number) => {
    const r = sheetRect(id);
    const x = sx * SUBTILE + SUBTILE / 2 - Math.floor(r.w / 2) + ((hash >>> 9) % 7) - 3;
    const y = sy * SUBTILE + SUBTILE / 2 - Math.floor(r.h / 2) + ((hash >>> 13) % 7) - 3;
    if (fits(r, x, y)) scatter.push({ id, x, y });
  };
  for (let sy = 0; sy < sh; sy++) {
    for (let sx = 0; sx < sw; sx++) {
      if (!open(sx, sy)) continue;
      const i = sy * sw + sx;
      const hash = tileHash(sx, sy, salt ^ SCATTER_SALT);
      const drift = patchNoise(sx, sy, 6, salt ^ DRIFT_SALT);
      const byWoods = near(woods, sx, sy);
      if (look === 'autumn' && byWoods <= 2 && hash % (byWoods === 1 ? 3 : 5) === 0) {
        put(pick(LEAVES, hash >>> 3), sx, sy, hash);
      } else if (drift > tune.drift && !dirt[i]) {
        // A drift: one color over a square of DRIFT_ZONE subtiles, a clump on one subtile in 4.
        const zone = tileHash(
          Math.floor(sx / DRIFT_ZONE),
          Math.floor(sy / DRIFT_ZONE),
          salt ^ DRIFT_COLOR_SALT,
        );
        if (hash % 4 === 0) put(pick(DRIFTS, zone), sx, sy, hash);
      } else if (drift > tune.drift - 0.06 && !dirt[i]) {
        // Round a drift, a fringe of tiny flowers.
        if (hash % 5 === 0) put(pick(WILDFLOWERS, hash >>> 3), sx, sy, hash);
      } else if (near(rocks, sx, sy) <= 1 && hash % 6 === 0) {
        put(pick(PEBBLES, hash >>> 3), sx, sy, hash);
      } else if (byWoods === 1 && hash % 9 === 0) {
        put(pick(WOODS_EDGE, hash >>> 3), sx, sy, hash);
      } else if (dirt[i]) {
        if (hash % 5 === 0) put(pick(BARE, hash >>> 3), sx, sy, hash);
      } else if (lush[i]) {
        if (hash % 6 === 0) put(pick(LUSH, hash >>> 3), sx, sy, hash);
      } else if (light[i]) {
        if (hash % 9 === 0) put(pick(SUNNY, hash >>> 3), sx, sy, hash);
      } else if (hash % 13 === 0) {
        put(pick(ELSEWHERE, hash >>> 3), sx, sy, hash);
      }
    }
  }

  // The undergrowth: on about one Tree cell in 3 at the woods' edge and one in 5 inside it, at
  // the cell's foot, to the left or the right of the trunk. A big tree's upper cells have none:
  // their foot is in the middle of the big tree, which stands in front.
  const behindBig = new Set(bigTreeBlocks(lot).flatMap((b) => [b.y * w + b.x, b.y * w + b.x + 1]));
  const undergrowth: GroundBit[] = [];
  for (const { x, y } of floor.cells) {
    if (behindBig.has(y * w + x)) continue;
    const hash = tileHash(x, y, salt ^ UNDERGROWTH_SALT);
    const edge = (
      [
        [1, 0],
        [-1, 0],
        [0, 1],
        [0, -1],
      ] as const
    ).some(([dx, dy]) => {
      const nx = x + dx;
      const ny = y + dy;
      return nx >= 0 && ny >= 0 && nx < w && ny < h && terrainAt(lot, nx, ny) === null;
    });
    if (hash % (edge ? 3 : 5) !== 0) continue;
    const id = pick(edge ? UNDER_EDGE : UNDER_INSIDE, hash >>> 4);
    const r = sheetRect(id);
    const left = ((hash >>> 9) & 1) === 0;
    undergrowth.push({
      id,
      x: x * CELL + (left ? 1 : CELL - r.w - 1),
      y: (y + 1) * CELL - r.h - ((hash >>> 11) % 3),
    });
  }

  return { look, light: lightSubtiles, lightEdge, floor, dirt: dirtTiles, scatter, undergrowth };
}

/**
 * The ground under what stands on the lot: the grass on every cell, the sunny patches, the
 * woods' floor with the lush grass, the bare earth, then the scatter, in the lot's look.
 */
export function paintGround(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  lot: Lot,
  plan: GroundPlan,
): void {
  const { look } = plan;
  const grass = inLook('grass-0', look);
  for (let y = 0; y < lot.height; y++) {
    for (let x = 0; x < lot.width; x++) drawSprite(ctx, img, grass, x * CELL, y * CELL);
  }
  const light = inLook('grass-light', look);
  const edge = inLook('woods-edge', look);
  for (const { sx, sy } of plan.light)
    drawSubtile(ctx, img, light, sx % SUB, sy % SUB, sx * SUBTILE, sy * SUBTILE);
  for (const t of plan.lightEdge)
    drawSubtile(ctx, img, edge, t.col, t.row, t.sx * SUBTILE, t.sy * SUBTILE);
  paintWoodsFloor(ctx, img, plan.floor);
  const dirt = inLook('dirt-edge', look);
  for (const t of plan.dirt)
    drawSubtile(ctx, img, dirt, t.col, t.row, t.sx * SUBTILE, t.sy * SUBTILE);
  for (const b of plan.scatter) drawSprite(ctx, img, inLook(b.id, look), b.x, b.y);
}

/** The woods' undergrowth, over the trunks: drawn after what stands on the lot. */
export function paintUndergrowth(
  ctx: CanvasRenderingContext2D,
  img: CanvasImageSource,
  plan: GroundPlan,
): void {
  for (const b of plan.undergrowth) drawSprite(ctx, img, inLook(b.id, plan.look), b.x, b.y);
}
