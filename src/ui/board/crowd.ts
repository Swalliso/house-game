// A won run's open house (D-175), the part that decides, kept pure so tests can check it: who
// turns out for the verdict, which end of the street each visitor comes from, where on the
// sidewalk they stop and when they set off, and the cars that park at the kerb. Crowd.tsx draws
// it in the street's boxes (LifeLayer.tsx) as the end of the run looks down the street
// (Board.tsx, D-156; fx/open-house.ts starts it). None of it is the rules: it reads the run's
// seed, its verdict and the lot, and changes nothing.
//
// Nobody leaves the sidewalk: the walkers have east and west frames only, and nothing in the
// game finds a path. So the crowd lines the sidewalk in front of the house, each side facing the
// front door's middle. Who comes from the west walks east, in the sidewalk's eastbound lane, and
// stops west of the door; who comes from the east the other way. In each lane the one nearest
// the door sets off first, so nobody walks through anybody.

import { FEEL } from '../fx/feel.ts';
import { CELL, spritePos, type SpriteId } from '../sprites.ts';
import { LANES } from './life.ts';
import { seedSalt, tileHash } from './terrain/hash.ts';

/** The neighbors who turn out: the street's four walkers (art/limezu/life.json), cut facing east. */
export const WALKERS: readonly SpriteId[] = [
  'life-walker-1',
  'life-walker-2',
  'life-walker-3',
  'life-walker-4',
];

/** The cars that park: the street's two sedans and the title's blue hatchback, cut facing east. */
export const CARS: readonly SpriteId[] = ['life-car-teal', 'life-car-red', 'title-car'];

/** A walker's frame with its feet together (the walk cycle's sixth), held once it has stopped. */
export const STAND_FRAME = 5;

/** A sedan's frame with the least of the exhaust's puff, held once it has parked. */
export const PARK_FRAME = 0;

/** The lanes the open house takes: the sidewalk's two, and the kerb's. Their regulars wait. */
export const CROWD_LANES: readonly number[] = [LANES.walkWest, LANES.walkEast, LANES.nearCar];

/** Which end of the street a visitor comes from. */
export type Side = 'west' | 'east';

export interface Visitor {
  readonly id: SpriteId;
  /** From the west they walk east and stop west of the door; from the east, the other way. */
  readonly from: Side;
  /** Their feet, in art px down the street row: the sidewalk's lane for the way they walk. */
  readonly base: number;
  /** Where they stop: the sprite's left edge, in art px from the lot's west edge. */
  readonly x: number;
  /** When they set off, in ms after the look down the street starts. */
  readonly delayMs: number;
}

export interface ParkedCar {
  readonly id: SpriteId;
  /** Where it parks, in the lane by the sidewalk: its left edge, art px from the lot's west edge. */
  readonly x: number;
  /** When it pulls in, in ms after the look down the street starts. */
  readonly delayMs: number;
}

export interface Crowd {
  readonly visitors: readonly Visitor[];
  readonly cars: readonly ParkedCar[];
}

/** The numbers the plan reads (FEEL.openHouse's). */
export interface CrowdFeel {
  readonly visitors: readonly number[];
  readonly cars: readonly number[];
  readonly staggerMs: number;
  readonly innerPx: readonly [number, number];
  readonly gapPx: readonly [number, number];
  readonly carGapPx: readonly [number, number];
  readonly carStaggerMs: number;
}

/** Keeps the crowd's hashes apart from the flock's and the terrain's for the same run. */
const SALT = 0x6f70656e;

/** A whole number in `range` (both ends in), picked by a hash. */
const within = ([lo, hi]: readonly [number, number], h: number) => lo + (h % (hi - lo + 1));

/** `list` in an order the hash deals: the same run always deals it the same way. */
function dealt<T>(list: readonly T[], salt: number, key: number): T[] {
  return list
    .map((v, i) => ({ v, h: tileHash(i, key, salt) }))
    .sort((a, b) => a.h - b.h)
    .map(({ v }) => v);
}

/**
 * A car `w` wide with its left edge at `x`, moved along `dir` until it covers no column where a
 * Driveway's concrete crosses the sidewalk (`cuts`), since nobody parks across a drive, and
 * doesn't straddle the lot's edge at either side (`width` columns), where the street past the
 * lot is dimmed (LifeLayer.tsx): a parked car stands in one light.
 */
function clearOf(cuts: readonly boolean[], width: number, x: number, w: number, dir: 1 | -1) {
  const edges = [0, width * CELL];
  for (let tries = 0; tries <= cuts.length + edges.length; tries++) {
    const covered: number[] = [];
    for (let c = Math.floor(x / CELL); c <= Math.floor((x + w - 1) / CELL); c++) {
      if (cuts[c]) covered.push(c);
    }
    if (covered.length > 0) {
      x = dir > 0 ? (Math.max(...covered) + 1) * CELL : Math.min(...covered) * CELL - w;
      continue;
    }
    const edge = edges.find((e) => x < e && e < x + w);
    if (edge === undefined) return x;
    x = dir > 0 ? edge : edge - w;
  }
  return x;
}

/**
 * Who turns out for a won run, and the cars at the kerb. `band` is the verdict's place in
 * balance.verdicts (0, Fixer-Upper, up to Dream Home), `doorX` the front door's middle in art px
 * from the lot's west edge, `width` the lot's in columns, and `cuts[x]` says a Driveway's
 * concrete crosses the sidewalk at its column x. The run's seed picks the rest by hash, never by
 * chance: the same run always gets the same crowd.
 * - Turnout follows the verdict (`f.visitors`), half from each end, the seed's end taking the
 *   odd one. The nearest on each side stand `innerPx` from the door's middle and the rest
 *   `gapPx` apart, a walker's width at least, so no two share a spot, and they set off nearest
 *   first, a side at a time, `staggerMs` apart.
 * - Each side deals the four walkers in turn, starting two apart, so no two neighbors match and
 *   the pair at the door don't either.
 * - The cars (`f.cars`) park past the crowd, never in front of it: the first east of it (the
 *   lane's traffic comes from the east), the next west of it, the third past the first; never
 *   across a drive or the lot's edge. They roll in from the east, the westmost first, so none
 *   drives through another.
 */
export function crowdPlan(
  seed: string,
  band: number,
  doorX: number,
  width: number,
  cuts: readonly boolean[] = [],
  f: CrowdFeel = FEEL.openHouse,
): Crowd {
  const salt = seedSalt(seed) ^ SALT;
  const b = Math.max(0, Math.min(Math.round(band), f.visitors.length - 1));
  const door = Math.round(doorX);
  const n = f.visitors[b] ?? 0;
  const first: Side = (tileHash(0, 0, salt) & 1) === 1 ? 'east' : 'west';
  const sides: readonly Side[] = [first, first === 'west' ? 'east' : 'west'];
  const walkers = dealt(WALKERS, salt, 1);
  const visitors: Visitor[] = [];
  sides.forEach((side, s) => {
    const count = s === 0 ? Math.ceil(n / 2) : Math.floor(n / 2);
    const dir = side === 'west' ? -1 : 1;
    let d = within(f.innerPx, tileHash(s, 2, salt));
    for (let k = 0; k < count; k++) {
      const id = walkers[(k + 2 * s) % walkers.length]!;
      const { w } = spritePos(id);
      visitors.push({
        id,
        from: side,
        base: side === 'west' ? LANES.walkEast : LANES.walkWest,
        x: door + dir * d - Math.round(w / 2),
        delayMs: (2 * k + s) * f.staggerMs,
      });
      d += within(f.gapPx, tileHash(k, 3 + s, salt));
    }
  });

  const lefts = visitors.map((v) => v.x);
  const rights = visitors.map((v) => v.x + spritePos(v.id).w);
  let west = lefts.length > 0 ? Math.min(...lefts) : door;
  let east = rights.length > 0 ? Math.max(...rights) : door;
  const models = dealt(CARS, salt, 5);
  const nc = f.cars[b] ?? 0;
  const parked: { id: SpriteId; x: number }[] = [];
  for (let i = 0; i < nc; i++) {
    const id = models[i % models.length]!;
    const { w } = spritePos(id);
    const gap = within(f.carGapPx, tileHash(i, 6, salt));
    if (i % 2 === 0) {
      const x = clearOf(cuts, width, east + gap, w, 1);
      parked.push({ id, x });
      east = x + w;
    } else {
      const x = clearOf(cuts, width, west - gap - w, w, -1);
      parked.push({ id, x });
      west = x;
    }
  }
  const cars = parked
    .sort((p, q) => p.x - q.x)
    .map((c, i) => ({ ...c, delayMs: i * f.carStaggerMs }));
  return { visitors, cars };
}
