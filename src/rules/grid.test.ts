import fc from 'fast-check';
import { describe, expect, it } from 'vitest';
import type { Rot } from './index.ts';
import {
  bounds,
  isConnected,
  parseShape,
  placedCells,
  rotateCells,
  shapeCells,
  uniqueRotations,
} from './grid.ts';

const L = ['#.', '##'];
const LONG_L = ['#..', '#..', '###'];

describe('shapes', () => {
  it('parses ASCII rows into cells', () => {
    expect(parseShape(['##', '#.'])).toEqual([
      { x: 0, y: 0 },
      { x: 1, y: 0 },
      { x: 0, y: 1 },
    ]);
    expect(() => parseShape(['#x'])).toThrow(/Bad shape character/);
  });

  it('checks for one connected polyomino', () => {
    expect(isConnected(parseShape(['##', '.#']))).toBe(true);
    expect(isConnected(parseShape(['#.', '.#']))).toBe(false); // diagonal only
    expect(isConnected([])).toBe(false);
  });

  it('measures bounds', () => {
    expect(bounds(shapeCells(['###'], 0))).toEqual({ w: 3, h: 1 });
    expect(bounds(shapeCells(['###'], 1))).toEqual({ w: 1, h: 3 });
  });
});

describe('rotation', () => {
  it('turns clockwise and normalizes to the top-left', () => {
    // #.      ##      ##      .#
    // ##  →   #.  →   .#  →   ##
    expect(shapeCells(L, 1)).toEqual(parseShape(['##', '#.']));
    expect(shapeCells(L, 2)).toEqual(parseShape(['##', '.#']));
    expect(shapeCells(L, 3)).toEqual(parseShape(['.#', '##']));
  });

  it('turns a bar on its side', () => {
    expect(shapeCells(['###'], 1)).toEqual(parseShape(['#', '#', '#']));
  });

  it('places cells relative to the bounding box', () => {
    expect(placedCells(L, 5, 7, 2)).toEqual([
      { x: 5, y: 7 },
      { x: 6, y: 7 },
      { x: 6, y: 8 },
    ]);
  });

  it('counts the distinct rotations', () => {
    expect(uniqueRotations(['##', '##'])).toEqual([0]);
    expect(uniqueRotations(['###'])).toEqual([0, 1]);
    expect(uniqueRotations(L)).toEqual([0, 1, 2, 3]);
    expect(uniqueRotations(LONG_L)).toEqual([0, 1, 2, 3]);
  });

  it('rotating four times is the identity (property)', () => {
    const shapeArb = fc
      .array(fc.tuple(fc.integer({ min: 0, max: 4 }), fc.integer({ min: 0, max: 4 })), {
        minLength: 1,
        maxLength: 8,
      })
      .map((pairs) => pairs.map(([x, y]) => ({ x, y })));
    fc.assert(
      fc.property(shapeArb, fc.constantFrom<Rot>(0, 1, 2, 3), (cells, rot) => {
        const once = rotateCells(cells, rot);
        let spun = once;
        for (let i = 0; i < 4; i++) spun = rotateCells(spun, 1);
        expect(spun).toEqual(once);
        // And r turns then (4 − r) turns gets back to the normalized original.
        expect(rotateCells(once, ((4 - rot) % 4) as Rot)).toEqual(rotateCells(cells, 0));
      }),
    );
  });
});
