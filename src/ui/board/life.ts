// Life on the lot (D-155), the part that decides, kept pure so tests can check it: which open
// grass a week's flock of crows lands on, where each crow stands, what sends the flock up and
// which way it flies, and the street's regulars. LifeLayer.tsx draws it. None of it is the
// rules: it reads the house and changes nothing.

import type { Cell, HouseState } from '../../rules/index.ts';
import type { SpriteId } from '../sprites.ts';
import { occupancy, uidAt, type Occupancy } from './geometry.ts';
import { seedSalt, tileHash } from './terrain/hash.ts';

/** A crow: its cell, where in it (art px from the cell's corner), and which way it faces. */
export interface Crow {
  readonly x: number;
  readonly y: number;
  readonly dx: number;
  readonly dy: number;
  readonly west: boolean;
}

/** Nothing on it: no piece, and none of the lot's own (a Tree, water, a Boulder, a find). */
function clear(house: HouseState, occ: Occupancy, x: number, y: number): boolean {
  const { lot } = house;
  if (x < 0 || y < 0 || x >= lot.width || y >= lot.height) return false;
  return lot.terrain[y * lot.width + x] == null && uidAt(occ, x, y) === 0;
}

/** Whether two cells are within `d` of each other, either way (a square around each). */
export function within(a: Cell, b: Cell, d: number): boolean {
  return Math.abs(a.x - b.x) <= d && Math.abs(a.y - b.y) <= d;
}

/**
 * The week's flock: two or three crows on a 2 × 2 block of open grass. Every cell within one of
 * the block is open too, so no tree's crown, outbuilding's roof or tall prop from next door
 * stands over a crow, and none of `avoid` (the pointer, the piece being placed) is within
 * `startle` cells of a crow, so the flock doesn't take off as it lands. Of the blocks that
 * qualify, the run's seed and the week pick one by hash, never by chance: the same week of the
 * same run gets the same flock. No block, no flock.
 */
export function flock(
  house: HouseState,
  seed: string,
  week: number,
  avoid: readonly Cell[] = [],
  startle = 2,
): Crow[] {
  const occ = occupancy(house);
  const salt = seedSalt(seed) ^ Math.imul(week + 1, 0x9e3779b1);
  const { width, height } = house.lot;
  let best: { x: number; y: number; h: number } | null = null;
  for (let y = 1; y + 2 < height; y++) {
    for (let x = 1; x + 2 < width; x++) {
      const h = tileHash(x, y, salt);
      if (best && h >= best.h) continue;
      if (!openAround(house, occ, x, y)) continue;
      if (avoid.some((a) => a.x >= x - startle && a.x <= x + 1 + startle && near(a, y, startle))) {
        continue;
      }
      best = { x, y, h };
    }
  }
  if (!best) return [];
  const { x, y, h } = best;
  // Three crows leave one cell of the block out; one block in four gets two, on a diagonal.
  const cells: [number, number][] = [
    [0, 0],
    [1, 0],
    [1, 1],
    [0, 1],
  ];
  const skip = h % 4;
  const spots =
    (h >>> 2) % 4 === 0
      ? [cells[skip % 2]!, cells[(skip % 2) + 2]!]
      : cells.filter((_, i) => i !== skip);
  return spots.map(([ox, oy], i) => {
    const r = tileHash(x + ox, y + oy, salt ^ (i + 7));
    return {
      x: x + ox,
      y: y + oy,
      dx: (r % 11) - 5,
      dy: ((r >>> 8) % 9) - 4,
      west: ((r >>> 16) & 1) === 1,
    };
  });
}

/** The cell `a` is within `d` rows of the block's two rows starting at `y`. */
function near(a: Cell, y: number, d: number): boolean {
  return a.y >= y - d && a.y <= y + 1 + d;
}

/** The 2 × 2 block at (x, y) and every cell within one of it are clear. */
function openAround(house: HouseState, occ: Occupancy, x: number, y: number): boolean {
  for (let j = y - 1; j <= y + 2; j++) {
    for (let i = x - 1; i <= x + 2; i++) if (!clear(house, occ, i, j)) return false;
  }
  return true;
}

/** The first of `cells` within `d` of a crow: what sends the flock up. Null when none is. */
export function startledBy(
  crows: readonly Crow[],
  cells: readonly (Cell | null)[],
  d: number,
): Cell | null {
  for (const c of cells) if (c && crows.some((crow) => within(crow, c, d))) return c;
  return null;
}

/**
 * What stands within `d` of the flock, as a key: the piece on each cell there, in reading order.
 * A piece built, moved or torn down beside the flock changes it, and the flock takes off.
 */
export function groundKey(house: HouseState, crows: readonly Crow[], d: number): string {
  if (crows.length === 0) return '';
  const occ = occupancy(house);
  const xs = crows.map((c) => c.x);
  const ys = crows.map((c) => c.y);
  const out: number[] = [];
  for (let y = Math.min(...ys) - d; y <= Math.max(...ys) + d; y++) {
    for (let x = Math.min(...xs) - d; x <= Math.max(...xs) + d; x++) {
      const inside = x >= 0 && y >= 0 && x < house.lot.width && y < house.lot.height;
      out.push(inside ? uidAt(occ, x, y) : 0);
    }
  }
  return out.join(',');
}

/**
 * Where each crow flies to, in cells from its spot: up, and sideways away from `from` (what
 * startled the flock), or with nothing to flee, away from the lot's middle, so it leaves over
 * the nearer edge. Each crow after the first goes a cell further, so they spread. A flock lands
 * along the same line, the other way.
 */
export function flight(
  crows: readonly Crow[],
  from: Cell | null,
  lotWidth: number,
  up: number,
  away: number,
): { x: number; y: number }[] {
  if (crows.length === 0) return [];
  const mid = crows.reduce((sum, c) => sum + c.x, 0) / crows.length + 0.5;
  const side = from ? (from.x + 0.5 <= mid ? 1 : -1) : mid < lotWidth / 2 ? -1 : 1;
  return crows.map((_, i) => ({ x: side * (away + i), y: -(up + i) }));
}

// ---------------------------------------------------------------------------------------------
// The street's regulars.

/**
 * One of the street's regulars: a car, or a walker, crossing the view over and over (fx/Drive.tsx).
 * `ids`: one sprite, or two that take turns. `base`: where its wheels or feet are, in art px down
 * from the street row's top. `phase`: how far into its loop it is when the lot first shows.
 */
export interface Regular {
  readonly ids: readonly SpriteId[];
  readonly kind: 'car' | 'walker';
  readonly dir: 1 | -1;
  readonly base: number;
  readonly pauseMs: number;
  readonly phase: number;
}

/**
 * The street, from the lot's edge down (art px from the street row's top; terrain/street.ts):
 * the sidewalk to its curb's lip at about 28, then the road, its lane by the sidewalk, the dashed
 * line at 48 to 64, the far lane, and the far curb from 80. Traffic keeps to the right: the lane
 * by the sidewalk goes west, the far one east. Each lane holds one regular, so no two ever
 * overlap: two in a lane at the same speed would meet whenever their pauses differ.
 */
export const LANES = {
  /** A walker going west, a little up the sidewalk, so the one going east passes in front. */
  walkWest: 19,
  walkEast: 25,
  /** Wheels on the lane by the sidewalk, just above the dashed line. */
  nearCar: 50,
  /** Wheels on the far lane, just above the far curb. */
  farCar: 78,
} as const;

/**
 * The street's regulars, back to front (so the far lane's car passes in front of everything):
 * a walker each way on the sidewalk, and a car in each lane. The lane by the sidewalk, which a
 * laptop's default zoom shows, has two cars taking turns; the far lane, often under the bottom
 * edge there, has one.
 */
export function regulars(pauses: {
  readonly nearCarPauseMs: number;
  readonly farCarPauseMs: number;
  readonly walkerPauseMs: readonly number[];
}): Regular[] {
  const [walkWest = 0, walkEast = 0] = pauses.walkerPauseMs;
  return [
    {
      ids: ['life-walker-3', 'life-walker-4'],
      kind: 'walker',
      dir: -1,
      base: LANES.walkWest,
      pauseMs: walkWest,
      phase: 0.75,
    },
    {
      ids: ['life-walker-1', 'life-walker-2'],
      kind: 'walker',
      dir: 1,
      base: LANES.walkEast,
      pauseMs: walkEast,
      phase: 0.3,
    },
    {
      ids: ['life-car-teal', 'title-car'],
      kind: 'car',
      dir: -1,
      base: LANES.nearCar,
      pauseMs: pauses.nearCarPauseMs,
      phase: 0.45,
    },
    {
      ids: ['life-car-red'],
      kind: 'car',
      dir: 1,
      base: LANES.farCar,
      pauseMs: pauses.farCarPauseMs,
      phase: 0.1,
    },
  ];
}
