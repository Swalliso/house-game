// Life on the lot (D-155): the flock lands on open grass with room around it, the same week of
// the same run always gets the same flock, the pointer and the piece being placed send it up,
// and the street's regulars keep to their lanes, one to a lane.

import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../content/balance.ts';
import type { Cell, HouseState, PieceId, PlacedPiece } from '../../rules/index.ts';
import { generateLot, lotFromRows } from '../../rules/lot.ts';
import { FEEL } from '../fx/feel.ts';
import { spritePos } from '../sprites.ts';
import { occupancy, uidAt } from './geometry.ts';
import {
  flight,
  flock,
  groundKey,
  LANES,
  regulars,
  startledBy,
  within,
  type Crow,
} from './life.ts';

const SEEDS = ['jbf3zs', 'abc123', 'house7', '99k6ct', 'bv6bsv'];

function house(
  lot: HouseState['lot'],
  specs: readonly (readonly [PieceId, number, number])[] = [],
): HouseState {
  const pieces: PlacedPiece[] = specs.map(([defId, x, y], i) => ({
    uid: i + 1,
    defId,
    x,
    y,
    rot: 0,
    placedWeek: i,
  }));
  return { lot, pieces, nextUid: pieces.length + 1 };
}

/** Real lots with a little house on each: a Bedroom, a Kitchen and a Bathroom near the street. */
const HOUSES = SEEDS.map((seed) => {
  const lot = generateLot(seed, BALANCE.lot);
  return { seed, house: house(lot) };
});

/** Nothing of the lot's and no piece on a cell, and the cell is on the lot. */
function open(h: HouseState, x: number, y: number): boolean {
  const { lot } = h;
  if (x < 0 || y < 0 || x >= lot.width || y >= lot.height) return false;
  return lot.terrain[y * lot.width + x] == null && uidAt(occupancy(h), x, y) === 0;
}

describe('the flock', () => {
  it('lands the same way every time for the same run and week', () => {
    for (const { seed, house: h } of HOUSES) {
      for (let week = 1; week <= 6; week++) {
        expect(flock(h, seed, week)).toEqual(flock(h, seed, week));
      }
    }
  });

  it('moves from week to week, and from run to run', () => {
    for (const { seed, house: h } of HOUSES) {
      const spots = new Set<string>();
      for (let week = 1; week <= 8; week++) spots.add(JSON.stringify(flock(h, seed, week)));
      expect(spots.size).toBeGreaterThan(4);
    }
    const lot = lotFromRows(Array.from({ length: 16 }, () => '.'.repeat(16)));
    const runs = new Set(['a', 'b', 'c', 'd'].map((s) => JSON.stringify(flock(house(lot), s, 1))));
    expect(runs.size).toBeGreaterThan(2);
  });

  it('is two or three crows on one 2 × 2 block, each on its own cell, inside it', () => {
    for (const { seed, house: h } of HOUSES) {
      for (let week = 1; week <= 12; week++) {
        const crows = flock(h, seed, week);
        expect(crows.length === 2 || crows.length === 3).toBe(true);
        const cells = new Set(crows.map((c) => `${c.x},${c.y}`));
        expect(cells.size).toBe(crows.length);
        const xs = crows.map((c) => c.x);
        const ys = crows.map((c) => c.y);
        expect(Math.max(...xs) - Math.min(...xs)).toBeLessThanOrEqual(1);
        expect(Math.max(...ys) - Math.min(...ys)).toBeLessThanOrEqual(1);
        for (const c of crows) {
          // The pecking crow's body (art px 5–25 across, 8–22 down its 32 px frame) stays in its cell.
          expect(Math.abs(c.dx)).toBeLessThanOrEqual(5);
          expect(Math.abs(c.dy)).toBeLessThanOrEqual(4);
        }
      }
    }
  });

  it('keeps to open grass with room around it: nothing within a cell of a crow', () => {
    const built = HOUSES.map(({ seed, house: h }) => ({
      seed,
      house: house(h.lot, [
        ['bedroom', 4, 6],
        ['kitchen', 10, 12],
        ['bathroom', 15, 4],
        ['livingRoom', 8, 18],
      ]),
    }));
    for (const { seed, house: h } of [...HOUSES, ...built]) {
      for (let week = 1; week <= 12; week++) {
        for (const c of flock(h, seed, week)) {
          for (let y = c.y - 1; y <= c.y + 1; y++) {
            for (let x = c.x - 1; x <= c.x + 1; x++) {
              expect(open(h, x, y), `${seed} week ${week}: (${x}, ${y})`).toBe(true);
            }
          }
        }
      }
    }
  });

  it('lands out of reach of the pointer and the piece being placed', () => {
    const d = FEEL.life.crows.startleCells;
    for (const { seed, house: h } of HOUSES) {
      for (let week = 1; week <= 6; week++) {
        const first = flock(h, seed, week);
        // Put the pointer right on the flock: the flock lands somewhere else.
        const avoid: Cell[] = [
          { x: first[0]!.x, y: first[0]!.y },
          { x: 3, y: 3 },
        ];
        const crows = flock(h, seed, week, avoid, d);
        expect(crows.length).toBeGreaterThan(0);
        for (const c of crows) for (const a of avoid) expect(within(c, a, d)).toBe(false);
      }
    }
  });

  it('stays away when there is no room', () => {
    const woods = lotFromRows(
      Array.from({ length: 12 }, (_, y) => (y % 3 === 1 ? 'T' : '.').repeat(12)),
    );
    expect(flock(house(woods), 'seed', 1)).toEqual([]);
    const tiny = lotFromRows(['...', '...', '...']);
    expect(flock(house(tiny), 'seed', 1)).toEqual([]);
  });
});

describe('what sends the flock up', () => {
  const crows: Crow[] = [
    { x: 10, y: 10, dx: 0, dy: 0, west: false },
    { x: 11, y: 10, dx: 0, dy: 0, west: true },
  ];

  it('is the pointer or a piece within two cells, either way', () => {
    expect(startledBy(crows, [{ x: 13, y: 12 }], 2)).toEqual({ x: 13, y: 12 });
    expect(startledBy(crows, [{ x: 8, y: 8 }], 2)).toEqual({ x: 8, y: 8 });
    expect(startledBy(crows, [{ x: 14, y: 10 }], 2)).toBeNull();
    expect(startledBy(crows, [{ x: 10, y: 13 }], 2)).toBeNull();
    expect(startledBy(crows, [null, { x: 20, y: 2 }], 2)).toBeNull();
    expect(startledBy([], [{ x: 10, y: 10 }], 2)).toBeNull();
  });

  it('is a piece built, moved or torn down beside it, not one further off', () => {
    const lot = lotFromRows(Array.from({ length: 20 }, () => '.'.repeat(20)));
    const before = groundKey(house(lot), crows, 2);
    expect(groundKey(house(lot, [['bathroom', 12, 12]]), crows, 2)).not.toBe(before);
    expect(groundKey(house(lot, [['bathroom', 14, 10]]), crows, 2)).toBe(before);
    expect(groundKey(house(lot, [['bedroom', 1, 1]]), crows, 2)).toBe(before);
  });

  it('flies them up and away from it, or over the nearer edge with nothing to flee', () => {
    const f = FEEL.life.crows;
    const fromRight = flight(crows, { x: 13, y: 10 }, 24, f.flyUpCells, f.flyAwayCells);
    expect(fromRight.every((t) => t.x < 0 && t.y < 0)).toBe(true);
    const fromLeft = flight(crows, { x: 9, y: 11 }, 24, f.flyUpCells, f.flyAwayCells);
    expect(fromLeft.every((t) => t.x > 0 && t.y < 0)).toBe(true);
    // A flock left of the middle leaves over the left edge, and the crows spread.
    const quiet = flight(crows, null, 24, f.flyUpCells, f.flyAwayCells);
    expect(quiet.every((t) => t.x < 0)).toBe(true);
    expect(Math.abs(quiet[1]!.x)).toBeGreaterThan(Math.abs(quiet[0]!.x));
    const east = crows.map((c) => ({ ...c, x: c.x + 8 }));
    expect(flight(east, null, 24, f.flyUpCells, f.flyAwayCells).every((t) => t.x > 0)).toBe(true);
  });
});

describe('the street’s regulars', () => {
  const all = regulars(FEEL.life.street);

  it('keep one to a lane, so no two ever drive through each other', () => {
    const lanes = all.map((r) => r.base);
    expect(new Set(lanes).size).toBe(lanes.length);
    expect(lanes.sort((a, b) => a - b)).toEqual(Object.values(LANES).sort((a, b) => a - b));
  });

  it('walk the sidewalk and drive the road, keeping to the right', () => {
    for (const r of all) {
      if (r.kind === 'walker') {
        expect(r.base).toBeLessThan(28);
      } else {
        expect(r.base).toBeGreaterThan(32);
        expect(r.base).toBeLessThanOrEqual(96);
        // West in the lane by the sidewalk, east in the far one.
        expect(r.dir).toBe(r.base < 64 ? -1 : 1);
      }
      expect(r.pauseMs).toBeGreaterThan(0);
      expect(r.phase).toBeGreaterThanOrEqual(0);
      expect(r.phase).toBeLessThan(1);
      expect(r.ids.length === 1 || r.ids.length === 2).toBe(true);
      for (const id of r.ids) expect(spritePos(id).w).toBeGreaterThan(0);
    }
    // A walker each way.
    expect(
      all
        .filter((r) => r.kind === 'walker')
        .map((r) => r.dir)
        .sort(),
    ).toEqual([-1, 1]);
  });

  it('come back to front, so the far lane passes in front of the rest', () => {
    const bases = all.map((r) => r.base);
    expect(bases).toEqual([...bases].sort((a, b) => a - b));
  });
});
