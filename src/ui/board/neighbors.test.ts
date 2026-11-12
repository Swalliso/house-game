// Your houses on the street (D-156): what of a house stands on the street, and which house stands
// on which plot: the newest nearest, beside the lot at its own row, LimeZu's houses filling the
// nearest plots until yours do, never two in one place and never in the creek.

import { describe, expect, it } from 'vitest';
import type { HouseState, PieceId, PlacedPiece } from '../../rules/index.ts';
import { lotFromRows } from '../../rules/lot.ts';
import type { Plot } from '../company.ts';
import { CELL } from '../sprites.ts';
import { boardRows } from './geometry.ts';
import {
  neighborAt,
  neighbors,
  opaqueBox,
  plotPart,
  STREET,
  type Filler,
  type Neighbor,
  type PlotHouse,
} from './neighbors.ts';

const LOT = lotFromRows(Array.from({ length: 24 }, () => '.'.repeat(24)));
const W = LOT.width * CELL;
const STREET_Y = LOT.height * CELL;
const FOOT = boardRows(LOT.height) * CELL;

function house(specs: readonly (readonly [PieceId, number, number])[], lot = LOT): HouseState {
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

const FILLERS: readonly Filler[] = [
  { sprite: 'neighbor-country', w: 288, h: 256 },
  { sprite: 'neighbor-modern', w: 368, h: 224 },
  { sprite: 'neighbor-japanese', w: 240, h: 224 },
];

/** A filed house: `w` × `h` art px, its top-left at (x, y) on its own 24 × 24 lot. */
function filed(n: number, over: Partial<Plot> = {}): PlotHouse {
  return {
    key: `seed${n}:hendersons:generalContractor`,
    plot: {
      src: `data:image/png;base64,${n}`,
      x: 320,
      y: 384,
      w: 448,
      h: 320,
      lotW: 24,
      lotH: 24,
      ...over,
    },
  };
}

const overlaps = (a: Neighbor, b: Neighbor) =>
  a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;

describe('what of a house stands on the street', () => {
  it('is its rooms and the yard pieces touching them, whole, with a cell around', () => {
    const part = plotPart(
      house([
        ['bedroom', 4, 6],
        // Touching the Bedroom's east wall.
        ['porch', 6, 7],
        // Off on its own.
        ['flowerBed', 14, 14],
        ['greenhouse', 12, 2],
      ]),
    )!;
    expect([...part.uids].sort()).toEqual([1, 2]);
    // Cells 4–7 across, 6–7 down, and a cell around.
    expect(part.frame).toEqual({ x: 3 * CELL, y: 5 * CELL, w: 6 * CELL, h: 4 * CELL });
  });

  it('is every piece for a house of yard pieces alone, and nothing for an empty lot', () => {
    const part = plotPart(
      house([
        ['flowerBed', 2, 2],
        ['patio', 10, 10],
      ]),
    )!;
    expect([...part.uids].sort()).toEqual([1, 2]);
    expect(part.frame).toEqual({ x: CELL, y: CELL, w: 12 * CELL, h: 12 * CELL });
    expect(plotPart(house([]))).toBeNull();
  });

  it('stays on the board at its corners', () => {
    const part = plotPart(
      house([
        ['bedroom', 0, 0],
        ['kitchen', 22, 22],
      ]),
    )!;
    expect(part.frame).toEqual({ x: 0, y: 0, w: W, h: 25 * CELL });
  });

  it('is cut to what was painted', () => {
    const w = 6;
    const h = 5;
    const data = new Uint8ClampedArray(w * h * 4);
    expect(opaqueBox(data, w, h)).toBeNull();
    data[(1 * w + 2) * 4 + 3] = 255;
    data[(3 * w + 4) * 4 + 3] = 40;
    expect(opaqueBox(data, w, h)).toEqual({ x: 2, y: 1, w: 3, h: 3 });
  });
});

describe('the street', () => {
  it('has LimeZu’s houses on the nearest plots until yours stand there', () => {
    const street = neighbors([], FILLERS, LOT, 'abc123');
    expect(street.map((n) => n.side).sort()).toEqual(['across', 'left', 'right']);
    expect(new Set(street.map((n) => n.key))).toEqual(new Set(FILLERS.map((f) => f.sprite)));
    for (const n of street) {
      expect('sprite' in n.look).toBe(true);
      // Beside the lot, a front yard from the street.
      if (n.side !== 'across') expect(n.y + n.h).toBe(STREET_Y - STREET.frontYard);
    }
    // One house of yours: it takes a plot, LimeZu's the other two.
    const one = neighbors([filed(1)], FILLERS, LOT, 'abc123');
    expect(one).toHaveLength(3);
    expect(one.filter((n) => 'src' in n.look)).toHaveLength(1);
    // Three or more: no LimeZu houses.
    const four = neighbors(
      [1, 2, 3, 4].map((n) => filed(n)),
      FILLERS,
      LOT,
      'abc123',
    );
    expect(four).toHaveLength(4);
    expect(four.every((n) => 'src' in n.look)).toBe(true);
  });

  it('puts the newest nearest: beside the lot first, then across the road, then further out', () => {
    for (const seed of ['abc123', 'house7', '99k6ct', 'jbf3zs']) {
      const houses = [1, 2, 3, 4, 5, 6].map((n) => filed(n));
      const street = neighbors(houses, FILLERS, LOT, seed);
      expect(street).toHaveLength(6);
      const at = (n: number) => street.find((s) => s.key === houses[n]!.key)!;
      const sides = [0, 1, 2].map((n) => at(n).side);
      expect(sides.slice(0, 2).sort()).toEqual(['left', 'right']);
      expect(sides[2]).toBe('across');
      // The nearest plots beside the lot are a cell from its property line.
      const near = (n: number) => (at(n).side === 'left' ? -(at(n).x + at(n).w) : at(n).x - W);
      expect(near(0)).toBe(STREET.beside);
      expect(near(1)).toBe(STREET.beside);
      // The next ones out on the same sides, past them.
      expect(at(3).side).toBe(at(0).side);
      expect(near(3)).toBe(STREET.beside + at(0).w + STREET.between);
      expect(at(4).side).toBe(at(1).side);
      expect(at(5).side).toBe('across');
      // Across the road: the newest there in the middle, under the far curb.
      expect(at(2).x + at(2).w / 2).toBeCloseTo(W / 2, 0);
      for (const n of [2, 5]) expect(at(n).y).toBe(FOOT + STREET.across);
    }
  });

  it('stands each house beside the lot at the row it was built on, on the same street', () => {
    const street = neighbors([filed(1, { y: 400 })], [], LOT, 'abc123');
    expect(street[0]!.y).toBe(400);
    // A house from a taller lot keeps its distance from its street.
    const tall = neighbors([filed(1, { y: 400, lotH: 26 })], [], LOT, 'abc123');
    expect(tall[0]!.y).toBe(400 - 2 * CELL);
  });

  it('never puts two houses in one place, nor one on the lot or the road', () => {
    for (const seed of ['a', 'b', 'c', 'd', 'e']) {
      const houses = [1, 2, 3, 4, 5, 6].map((n) =>
        // Up to the street, as a house built on the lot's front row is.
        filed(n, { w: 300 + 37 * n, h: 200 + 29 * n, y: STREET_Y - (200 + 29 * n) - 13 * n }),
      );
      const street = neighbors(houses, FILLERS, LOT, seed);
      for (const [i, a] of street.entries()) {
        for (const b of street.slice(i + 1)) expect(overlaps(a, b)).toBe(false);
        const onLotColumns = a.x < W && a.x + a.w > 0;
        if (a.side === 'across') expect(a.y).toBeGreaterThanOrEqual(FOOT);
        else expect(onLotColumns).toBe(false);
        expect(a.side === 'across' ? a.y >= FOOT : a.y + a.h <= STREET_Y).toBe(true);
        for (const v of [a.x, a.y, a.w, a.h]) expect(Number.isInteger(v)).toBe(true);
      }
    }
  });

  it('keeps a house out of a creek running on past the lot’s edge', () => {
    // The house's rows are 12–21; a creek runs on past both sides at rows 12–13.
    const wet = [
      { side: 'left', at: 12, span: 2 },
      { side: 'right', at: 12, span: 2 },
    ] as const;
    const street = neighbors([filed(1), filed(2)], FILLERS, LOT, 'abc123', wet);
    expect(street.filter((n) => 'src' in n.look).map((n) => n.side)).toEqual(['across', 'across']);
    // LimeZu's houses, nearer the street (rows 14 and down), still fit beside it.
    expect(
      street
        .filter((n) => 'sprite' in n.look)
        .map((n) => n.side)
        .sort(),
    ).toEqual(['left', 'right']);
    // A creek elsewhere doesn't move it.
    const dry = neighbors([filed(1)], [], LOT, 'abc123', [{ side: 'left', at: 2, span: 1 }]);
    expect(dry[0]!.side).not.toBe('across');
  });

  it('changes sides from run to run, and stays put within one', () => {
    const houses = [filed(1)];
    const sides = new Set(
      ['a', 'b', 'c', 'd', 'e', 'f'].map((s) => neighbors(houses, [], LOT, s)[0]!.side),
    );
    expect(sides).toEqual(new Set(['left', 'right']));
    expect(neighbors(houses, FILLERS, LOT, 'x')).toEqual(neighbors(houses, FILLERS, LOT, 'x'));
  });

  it('finds the house under the pointer', () => {
    const street = neighbors([filed(1)], FILLERS, LOT, 'abc123');
    for (const n of street) {
      expect(neighborAt(street, n.x, n.y)).toBe(n);
      expect(neighborAt(street, n.x + n.w - 1, n.y + n.h - 1)).toBe(n);
      expect(neighborAt(street, n.x + n.w, n.y)).not.toBe(n);
    }
    expect(neighborAt(street, W / 2, STREET_Y / 2)).toBeNull();
  });
});
