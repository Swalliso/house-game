// A won run's open house (D-175, crowd.ts): the same run always gets the same crowd, the turnout
// follows the verdict, the crowd lines the sidewalk in front of the house facing the front door
// with no two on one spot, nobody walks through anybody, the cars park past the crowd and never
// across a drive, and all of it comes to rest inside a win's look down the street.

import { describe, expect, it } from 'vitest';
import { CONTENT } from '../../rules/index.ts';
import { arrivePlan } from '../fx/Drive.tsx';
import { FEEL } from '../fx/feel.ts';
import { CELL, spritePos } from '../sprites.ts';
import { CARS, CROWD_LANES, crowdPlan, WALKERS, type Crowd, type Visitor } from './crowd.ts';
import { LANES } from './life.ts';

const SEEDS = ['jbf3zs', 'abc123', 'house7', '99k6ct', 'bv6bsv', 'oh-1107', 'stamp-1', 'z'];
const BANDS = CONTENT.balance.verdicts.map((_, b) => b);
/** The lot's width in columns, and front doors across it, near either edge too, in art px. */
const LOT = 24;
const DOORS = [2.5 * CELL, 7 * CELL, 12 * CELL, 16.5 * CELL, 21.5 * CELL];
const f = FEEL.openHouse;

const mid = (v: Visitor) => v.x + spritePos(v.id).w / 2;
const right = (x: number, id: Parameters<typeof spritePos>[0]) => x + spritePos(id).w;

function plans(): { seed: string; band: number; door: number; crowd: Crowd }[] {
  return SEEDS.flatMap((seed) =>
    BANDS.flatMap((band) =>
      DOORS.map((door) => ({ seed, band, door, crowd: crowdPlan(seed, band, door, LOT) })),
    ),
  );
}

describe('who turns out', () => {
  it('is the same every time for the same run, verdict and door', () => {
    for (const { seed, band, door, crowd } of plans()) {
      expect(crowdPlan(seed, band, door, LOT)).toEqual(crowd);
    }
  });

  it('follows the verdict: more people and more cars for a better house', () => {
    expect(f.visitors).toHaveLength(CONTENT.balance.verdicts.length);
    expect(f.cars).toHaveLength(CONTENT.balance.verdicts.length);
    for (const seed of SEEDS) {
      const counts = BANDS.map((b) => crowdPlan(seed, b, 12 * CELL, LOT));
      expect(counts.map((c) => c.visitors.length)).toEqual([...f.visitors]);
      expect(counts.map((c) => c.cars.length)).toEqual([...f.cars]);
    }
    expect([...f.visitors]).toEqual([...f.visitors].sort((a, b) => a - b));
    expect(new Set(f.cars).size).toBeGreaterThan(1);
    // A verdict past either end counts as the end.
    expect(crowdPlan('z', 99, 300, LOT).visitors).toHaveLength(f.visitors.at(-1)!);
    expect(crowdPlan('z', -3, 300, LOT).visitors).toHaveLength(f.visitors[0]!);
  });

  it('differs from run to run: the sides, the walkers and the spots', () => {
    const looks = new Set(SEEDS.map((s) => JSON.stringify(crowdPlan(s, 3, 12 * CELL, LOT))));
    expect(looks.size).toBe(SEEDS.length);
    const firstFrom = new Set(SEEDS.map((s) => crowdPlan(s, 0, 12 * CELL, LOT).visitors[0]!.from));
    expect(firstFrom.size).toBe(2);
  });

  it('is the street’s four walkers and its three cars, dealt so neighbors differ', () => {
    for (const { door, crowd } of plans()) {
      for (const v of crowd.visitors) expect(WALKERS).toContain(v.id);
      for (const c of crowd.cars) expect(CARS).toContain(c.id);
      expect(new Set(crowd.cars.map((c) => c.id)).size).toBe(crowd.cars.length);
      const rows = (['west', 'east'] as const).map((side) =>
        crowd.visitors
          .filter((v) => v.from === side)
          .sort((a, b) => Math.abs(mid(a) - door) - Math.abs(mid(b) - door)),
      );
      for (const row of rows) {
        for (let i = 1; i < row.length; i++) expect(row[i]!.id).not.toBe(row[i - 1]!.id);
      }
      // The pair either side of the door differ too.
      if (rows[0]![0] && rows[1]![0]) expect(rows[0]![0].id).not.toBe(rows[1]![0].id);
    }
  });
});

describe('where they stop', () => {
  it('in front of the house, half from each end, each facing the front door’s middle', () => {
    for (const { door, crowd } of plans()) {
      const west = crowd.visitors.filter((v) => v.from === 'west');
      const east = crowd.visitors.filter((v) => v.from === 'east');
      expect(Math.abs(west.length - east.length)).toBeLessThanOrEqual(1);
      // From the west they walk east, and stop west of the door; from the east, the other way.
      for (const v of west) expect(mid(v)).toBeLessThan(door);
      for (const v of east) expect(mid(v)).toBeGreaterThan(door);
      // The nearest either side stand close by the door's middle.
      for (const row of [west, east]) {
        if (row.length === 0) continue;
        const near = Math.min(...row.map((v) => Math.abs(mid(v) - door)));
        expect(near).toBeGreaterThanOrEqual(f.innerPx[0]);
        expect(near).toBeLessThanOrEqual(f.innerPx[1] + 1);
      }
      // A crowd of ten stays within about three cells of the door either way.
      for (const v of crowd.visitors) expect(Math.abs(mid(v) - door)).toBeLessThan(4 * CELL);
    }
  });

  it('on the sidewalk, in the lane for the way they walk, keeping to the right', () => {
    for (const { crowd } of plans()) {
      for (const v of crowd.visitors) {
        expect(v.base).toBe(v.from === 'west' ? LANES.walkEast : LANES.walkWest);
        expect(CROWD_LANES).toContain(v.base);
        expect(Number.isInteger(v.x)).toBe(true);
      }
    }
  });

  it('no two on one spot: a lane’s people a walker’s width apart at least', () => {
    for (const { crowd } of plans()) {
      const spots = crowd.visitors.map((v) => `${v.base}:${v.x}`);
      expect(new Set(spots).size).toBe(spots.length);
      expect(new Set(crowd.visitors.map((v) => v.x)).size).toBe(crowd.visitors.length);
      for (const lane of [LANES.walkWest, LANES.walkEast]) {
        const xs = crowd.visitors
          .filter((v) => v.base === lane)
          .map((v) => v.x)
          .sort((a, b) => a - b);
        for (let i = 1; i < xs.length; i++) {
          expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(spritePos('life-walker-1').w);
        }
      }
    }
  });
});

describe('walking in', () => {
  /** Where a visitor's left edge is at `t` ms: walking in from walkPx out, then standing. */
  function at(v: Visitor, t: number): number | null {
    if (t < v.delayMs) return null;
    const { distance, ms } = arrivePlan(f.walkPx, f.walkPxPerSecond);
    const left = Math.max(0, distance - Math.floor(((t - v.delayMs) / ms) * distance));
    return v.x + (v.from === 'west' ? -left : left);
  }

  it('nearest the door first in each lane, so nobody walks through anybody', () => {
    const w = spritePos('life-walker-1').w;
    for (const { door, crowd } of plans()) {
      for (const side of ['west', 'east'] as const) {
        const row = crowd.visitors
          .filter((v) => v.from === side)
          .sort((a, b) => Math.abs(mid(a) - door) - Math.abs(mid(b) - door));
        for (let i = 1; i < row.length; i++) {
          expect(row[i]!.delayMs).toBeGreaterThan(row[i - 1]!.delayMs);
        }
        // Step through the walk: two in a lane are never closer than a walker's width.
        for (let t = 0; t <= 5000; t += 20) {
          const xs = row.map((v) => at(v, t)).filter((x): x is number => x !== null);
          xs.sort((a, b) => a - b);
          for (let i = 1; i < xs.length; i++) expect(xs[i]! - xs[i - 1]!).toBeGreaterThanOrEqual(w);
        }
      }
    }
  });

  it('comes to rest, crowd and cars, while a win’s look down the street holds', () => {
    const window = FEEL.streetView.outMs + f.holdMs;
    const walk = arrivePlan(f.walkPx, f.walkPxPerSecond).ms;
    const roll = arrivePlan(f.rollPx, FEEL.street.carPxPerSecond).ms;
    for (const { crowd } of plans()) {
      for (const v of crowd.visitors) expect(v.delayMs + walk).toBeLessThanOrEqual(window - 250);
      for (const c of crowd.cars) expect(c.delayMs + roll).toBeLessThanOrEqual(window - 250);
    }
  });

  it('a whole art px a step', () => {
    expect(arrivePlan(-64, 28)).toEqual({ distance: 64, ms: 2286 });
    expect(arrivePlan(95.6, 56).distance).toBe(96);
    expect(Number.isInteger(arrivePlan(-63.4, 28).distance)).toBe(true);
  });
});

describe('the cars at the kerb', () => {
  const extent = (crowd: Crowd) => ({
    west: Math.min(...crowd.visitors.map((v) => v.x)),
    east: Math.max(...crowd.visitors.map((v) => right(v.x, v.id))),
  });

  it('park past the crowd, never in front of it, and never two in one place', () => {
    for (const { crowd } of plans()) {
      const { west, east } = extent(crowd);
      const cars = [...crowd.cars].sort((a, b) => a.x - b.x);
      for (const c of cars) {
        expect(c.x >= east || right(c.x, c.id) <= west).toBe(true);
        expect(Number.isInteger(c.x)).toBe(true);
      }
      for (let i = 1; i < cars.length; i++) {
        expect(cars[i]!.x).toBeGreaterThanOrEqual(right(cars[i - 1]!.x, cars[i - 1]!.id));
      }
      // The first east of the crowd, the way the lane's traffic comes from.
      if (cars.length > 0) expect(cars.some((c) => c.x >= east)).toBe(true);
    }
  });

  it('roll in from the east, the westmost first, so none drives through another', () => {
    for (const { crowd } of plans()) {
      const byX = [...crowd.cars].sort((a, b) => a.x - b.x);
      expect(byX.map((c) => c.delayMs)).toEqual(byX.map((_, i) => i * f.carStaggerMs));
    }
  });

  it('never across a drive', () => {
    const door = 12 * CELL;
    for (const seed of SEEDS) {
      const open = crowdPlan(seed, 4, door, LOT);
      // A Driveway meeting the street under each car that parked on open kerb.
      const cuts = Array.from({ length: LOT }, () => false);
      for (const c of open.cars) {
        const col = Math.floor((c.x + spritePos(c.id).w / 2) / CELL);
        if (col >= 0 && col < LOT) cuts[col] = true;
      }
      const moved = crowdPlan(seed, 4, door, LOT, cuts);
      expect(moved.visitors).toEqual(open.visitors);
      for (const c of moved.cars) {
        for (let x = c.x; x < right(c.x, c.id); x++) {
          const col = Math.floor(x / CELL);
          if (col >= 0 && col < LOT) expect(cuts[col], `${seed}: column ${col}`).toBe(false);
        }
      }
    }
  });

  it('never across the lot’s edge, where the street past it is dimmed', () => {
    for (const { crowd } of plans()) {
      for (const c of crowd.cars) {
        for (const edge of [0, LOT * CELL]) {
          expect(c.x < edge && edge < right(c.x, c.id)).toBe(false);
        }
      }
    }
  });
});
