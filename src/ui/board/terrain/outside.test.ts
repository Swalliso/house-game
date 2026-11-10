// What runs on past the board's edges: the road, and each creek mouth (outside.ts).

import { describe, expect, it } from 'vitest';
import { BALANCE } from '../../../content/balance.ts';
import { generateLot, lotFromRows, terrainAt } from '../../../rules/lot.ts';
import { SUB } from '../autotile.ts';
import { ROAD_ROWS } from '../geometry.ts';
import { dim, outsideSlices, roadSlices, sliceSize, waterSlices, type Slice } from './outside.ts';
import { streetRows, streetTiles } from './street.ts';
import { waterPlan } from './water.ts';

/** The real lot balance with a creek on every lot (D-119 put one on about a quarter). */
const CREEK_LOTS = { ...BALANCE.lot, creekPct: 100 };

const pieces = (s: Slice) => s.tiles.map((t) => `${t.sx},${t.sy}:${t.id}@${t.col},${t.row}`);

describe('the road', () => {
  const lot = lotFromRows(['....', '....', '....']);
  const [left, right] = roadSlices(lot);

  it('runs on both ways from the street row down, a cell at a time', () => {
    for (const s of [left!, right!]) {
      expect(s).toMatchObject({ kind: 'road', at: lot.height, span: 1 + ROAD_ROWS });
      expect(sliceSize(s)).toEqual({ w: 32, h: (1 + ROAD_ROWS) * 32 });
      expect(s.tiles).toHaveLength(SUB * streetRows().length);
    }
    expect(left!.side).toBe('left');
    expect(right!.side).toBe('right');
  });

  it('is the board’s own paving, its dashes in step with the board’s', () => {
    // A cell of the board's street (columns 0 and 1 are even and odd, like every cell past it).
    const top = lot.height * SUB;
    const board = streetTiles(lot)
      .filter((t) => t.sx < SUB && !t.id.endsWith('edge'))
      .map((t) => `${t.sx},${t.sy - top}:${t.id}@${t.col},${t.row}`);
    expect(pieces(left!)).toEqual(board);
    expect(pieces(right!)).toEqual(board);
  });
});

describe('the creek’s mouths', () => {
  it('flow on from where the creek leaves the lot, with the shore the edge cells have', () => {
    // In from the top at column 2, down, then out through the right edge on row 2.
    const lot = lotFromRows(['..C...', '..C...', '..CCCC', '......']);
    const slices = waterSlices(lot);
    expect(slices.map((s) => [s.side, s.at, s.span])).toEqual([
      ['right', 2, 1],
      ['top', 2, 1],
    ]);
    const top = slices.find((s) => s.side === 'top')!;
    const right = slices.find((s) => s.side === 'right')!;
    expect(sliceSize(top)).toEqual({ w: 32, h: 32 });
    // Up past the top edge, banks west and east, open north and south: as the creek's own top
    // cell has them on the lot (water.ts).
    const plan = waterPlan(lot);
    const own = (sx: number, sy: number) => plan.tiles.find((t) => t.sx === sx && t.sy === sy)!;
    for (const t of top.tiles) {
      expect(t.id).toBe('shore');
      expect({ block: 'outer', col: t.col, row: t.row }).toEqual(own(4 + t.sx, 0).piece);
    }
    // Off the right edge: banks north and south, open east and west.
    expect(pieces(right)).toEqual([
      '0,0:shore@1,0',
      '1,0:shore@1,0',
      '0,1:shore@1,2',
      '1,1:shore@1,2',
    ]);
  });

  it('don’t run on from a pond, or where the creek runs along the edge', () => {
    // A pond on the left edge; a creek in at (1, 0), east along the top row, then south.
    const lot = lotFromRows(['PPCCC.', 'PP..C.', '....C.', '......']);
    const slices = waterSlices(lot);
    expect(slices.map((s) => [s.side, s.at, s.span])).toEqual([['top', 2, 1]]);
  });

  it('match every seed’s shore, wherever its creek leaves', () => {
    for (const seed of ['jbf3zs', 'abc123', 'house7', 's7', 's28']) {
      const lot = generateLot(seed, CREEK_LOTS);
      const plan = waterPlan(lot);
      const piece = new Map(plan.tiles.map((t) => [`${t.sx},${t.sy}`, t.piece]));
      for (const s of waterSlices(lot)) {
        // The lot's cells along the edge under the slice are creek, open toward the slice.
        for (let i = 0; i < s.span; i++) {
          const x = s.side === 'top' ? s.at + i : s.side === 'left' ? 0 : lot.width - 1;
          const y = s.side === 'top' ? 0 : s.at + i;
          expect(terrainAt(lot, x, y), `${seed} ${s.side} ${x},${y}`).toBe('creek');
        }
        for (const t of s.tiles) {
          // The lot's subtile at the edge, beside this one: the same piece, since the creek runs
          // on straight (the slice repeats it all the way out).
          const sx =
            s.side === 'top'
              ? s.at * SUB + t.sx
              : s.side === 'left'
                ? t.sx
                : (lot.width - 1) * SUB + t.sx;
          const sy = s.side === 'top' ? t.sy : s.at * SUB + t.sy;
          const edge = piece.get(`${sx},${sy}`)!;
          expect(edge.block, `${seed} ${s.side} ${sx},${sy}`).toBe('outer');
          expect([edge.col, edge.row]).toEqual([t.col, t.row]);
        }
      }
    }
  });

  it('come with the road on every lot', () => {
    const lot = generateLot('house7', CREEK_LOTS);
    const all = outsideSlices(lot);
    expect(all.filter((s) => s.kind === 'road')).toHaveLength(2);
    expect(all.filter((s) => s.kind === 'water').length).toBeGreaterThan(0);
  });
});

describe('the garden’s dimming', () => {
  it('takes grass-0’s colors to within a step of grass-outside’s', () => {
    const pairs: [number[], number[]][] = [
      [
        [0x5a, 0x8a, 0x5e],
        [0x53, 0x71, 0x55],
      ],
      [
        [0x4c, 0x7a, 0x52],
        [0x47, 0x64, 0x4a],
      ],
      [
        [0x43, 0x6b, 0x52],
        [0x3e, 0x58, 0x48],
      ],
      [
        [0x6a, 0x9a, 0x67],
        [0x60, 0x7f, 0x5e],
      ],
    ];
    for (const [from, to] of pairs) {
      const got = dim(from[0]!, from[1]!, from[2]!);
      for (let i = 0; i < 3; i++)
        expect(Math.abs(got[i]! - to[i]!), `${from} → ${to}`).toBeLessThanOrEqual(1);
    }
  });
});
