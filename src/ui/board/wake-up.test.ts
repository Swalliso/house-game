// The Doghouse wakes up (D-179): the board notices a Doghouse whose requirement has just been met
// (its fenced yard closed) between two house changes in one run, from the rules' own tally, and
// nothing else wakes it: a first look, another run, a Doghouse placed straight into a fenced
// yard, one demolished, or any other piece.

import { describe, expect, it } from 'vitest';
import { CONTENT, type HouseState } from '../../rules/index.ts';
import { computeLayout } from '../../rules/layout.ts';
import { tallyHouse } from '../../rules/scoring.ts';
import { emptyRows, houseFrom, type Placement } from '../../rules/testing.ts';
import { unmetOf } from '../art/yard.ts';
import { asleepIn, wokenUp, type Seen } from './wake-up.ts';

/**
 * A house on an empty 8 × 8 lot: a Bedroom in its back right corner (uid 1), then these pieces,
 * placed unchecked, in order (uids from 2).
 */
const houseOf = (placements: readonly Placement[]): HouseState =>
  houseFrom(CONTENT, emptyRows(8, 8), [['bedroom', 5, 0], ...placements]);

/** The pieces whose requirement isn't met, as the rules' tally says (the board's ⚠). */
const unmetIn = (house: HouseState) =>
  unmetOf(tallyHouse(CONTENT, computeLayout(CONTENT, house), 1, false).pieces);

/** What the board would remember after showing `house` in `run`. */
const seen = (run: object, house: HouseState): Seen => ({
  run,
  asleep: asleepIn(house, unmetIn(house)),
});

const DOGHOUSE: Placement = ['doghouse', 1, 1];
/**
 * A Fence across the lot's row 3: with the lot's back and sides and the Bedroom it closes a
 * yard of 20 tiles.
 */
const FENCE: Placement = ['fence', 0, 3, 0, ['########']];

describe('the Doghouse wakes up', () => {
  const run = {};
  const open = houseOf([DOGHOUSE]);
  const fenced = houseOf([DOGHOUSE, FENCE]);

  it('sits on its lead outside a fenced yard, by the rules’ tally', () => {
    expect([...unmetIn(open)]).toEqual([2]);
    expect([...asleepIn(open, unmetIn(open))]).toEqual([2]);
    expect([...unmetIn(fenced)]).toEqual([]);
  });

  it('when the Fence that closes its yard goes in, in the same run', () => {
    expect(wokenUp(seen(run, open), run, fenced, unmetIn(fenced))).toEqual([2]);
  });

  it('once: the next change finds it awake already', () => {
    const more = houseOf([DOGHOUSE, FENCE, ['lawn', 2, 1]]);
    expect(wokenUp(seen(run, fenced), run, more, unmetIn(more))).toEqual([]);
  });

  it('not on the board’s first look, a load or a new run', () => {
    expect(wokenUp(null, run, fenced, unmetIn(fenced))).toEqual([]);
    // Another run's setup, even with the same house: a run loaded, or the same lot played again.
    expect(wokenUp(seen({}, open), run, fenced, unmetIn(fenced))).toEqual([]);
  });

  it('not for a Doghouse placed straight into a fenced yard: it’s simply awake', () => {
    const yard = houseOf([FENCE]);
    const placed = houseOf([FENCE, DOGHOUSE]);
    expect(placed.pieces[2]!.defId).toBe('doghouse');
    expect(unmetIn(placed).has(3)).toBe(false);
    expect(wokenUp(seen(run, yard), run, placed, unmetIn(placed))).toEqual([]);
  });

  it('not while its yard stays open, nor for one demolished', () => {
    const lawn = houseOf([DOGHOUSE, ['lawn', 2, 1]]);
    expect(wokenUp(seen(run, open), run, lawn, unmetIn(lawn))).toEqual([]);
    const gone = houseOf([]);
    expect(wokenUp(seen(run, open), run, gone, unmetIn(gone))).toEqual([]);
  });

  it('only the Doghouses: another piece whose requirement is met stays as it was', () => {
    // A Garage earns once the street or a Driveway reaches it (D-140): not a piece that wakes.
    const garage: HouseState = {
      ...open,
      pieces: open.pieces.map((p) => (p.uid === 2 ? { ...p, defId: 'garage' } : p)),
    };
    expect(asleepIn(garage, new Set([2])).size).toBe(0);
    expect(wokenUp({ run, asleep: new Set([2]) }, run, garage, new Set())).toEqual([]);
  });

  it('every Doghouse the Fence lets loose, in uid order', () => {
    const two = houseOf([DOGHOUSE, ['doghouse', 3, 1]]);
    const both = houseOf([DOGHOUSE, ['doghouse', 3, 1], FENCE]);
    expect([...unmetIn(two)]).toEqual([2, 3]);
    expect(wokenUp(seen(run, two), run, both, unmetIn(both))).toEqual([2, 3]);
  });
});
