// The Barkers' witness layout (implementation-plan.md §5 and §9): a hand-built house on the real
// content that meets every line of their checklist at every milestone, built one legal
// placement at a time, which proves the checklist can be met without a solver. If a content
// change breaks it, rebuild the house; if no house can meet the checklist any more, that's a
// content bug.
//
// The finished house. The street runs along the bottom edge, so row 13 is the street row.
// Rooms: B Bedroom, b Bathroom, c Closet, M Mudroom, L Living Room, K Kitchen. Yard: F Fence,
// g Lawn, d Doghouse. Lot: T Tree, P pond.
//
//    0123456789012345
//  0 ................
//  1 .TT...........T.
//  2 .T..FFFFFFFF....  the back Fence
//  3 ....Fggggd.F....  the dog yard (6 × 3, 18 tiles): two Lawns and two Doghouses
//  4 ....Fggggd.F....
//  5 ....F......F....
//  6 ....FBBMMBBF....  Bedroom, Mudroom (the back door, onto the dog yard), Bedroom
//  7 .....BBbcBB.....  the Bathroom and a Closet between the Bedrooms
//  8 .....LLLKK......  the Living Room and the Kitchen at the front
//  9 .....LLLKK......
// 10 ......T.........  a Tree outside the Living Room
// 11 .............PP.  the pond
// 12 .............PP.
// 13 ................  the street row
//
// 7 rooms (22 tiles in a 6 × 4 box), 2 Bedrooms, 1 Bathroom, and 8 yard pieces: 4 Fences, 2
// Lawns, 2 Doghouses.

import { describe, expect, it } from 'vitest';
import type { HouseState, PieceId, PlaceAction, RunState } from '../rules/index.ts';
import { CONTENT, rules } from '../rules/index.ts';
import { rotateShape } from '../rules/grid.ts';
import { houseFrom, type Placement } from '../rules/testing.ts';

const LOT = [
  '................', //  0
  '.TT...........T.', //  1
  '.T..............', //  2
  '................', //  3
  '................', //  4
  '................', //  5
  '................', //  6
  '................', //  7
  '................', //  8
  '................', //  9
  '......T.........', // 10
  '.............PP.', // 11
  '.............PP.', // 12
  '................', // 13: the street row
];

/** The build order: [piece, x, y, rotation]. Each one is legal on the house before it. */
const PLACEMENTS: readonly Placement[] = [
  ['livingRoom', 5, 8, 1], // turned to 3 × 2; the first room can go anywhere
  ['kitchen', 8, 8], // beside the Living Room
  ['bedroom', 5, 6], // behind the Living Room
  ['bathroom', 7, 7], // touching the Bedroom and the Living Room
  ['closet', 8, 7], // above the Kitchen, so the finished house has no hole
  // 2 Bedrooms sit inside every stage of Room for everyone: 1–2, then 1–3, then 2–4.
  ['bedroom', 9, 6],
  ['mudroom', 7, 6], // the back door, between the Bedrooms
  ['fence', 4, 2], // the back Fence, left half
  ['fence', 8, 2], // and right half
  ['fence', 4, 3, 1], // the left side, down to the house
  ['fence', 11, 3, 1], // the right side
  ['lawn', 5, 3], // two Lawns for the dogs
  ['lawn', 7, 3],
  ['doghouse', 9, 3], // two Doghouses inside the fence, by the Lawns
  ['doghouse', 9, 4],
];

const RUN: RunState = rules.newRun({
  seed: 'witness-barkers',
  clientId: 'barkers',
  crewId: 'generalContractor',
  mode: 'standard',
});
const HOUSE = houseFrom(CONTENT, LOT, PLACEMENTS);
/** Every milestone, 0-based: Groundbreaking to the Final Walkthrough. */
const PHASES = CONTENT.balance.phases.map((_, i) => i);

/** The run with this house in place of its own (the house brings its lot). */
const withHouse = (house: HouseState): RunState => ({ ...RUN, house });

/**
 * The rules' own check of building this piece next, from a hand holding its card. A Fence is a
 * pack (D-102), so its play carries its tiles, turned, as the board sends them: at rot 0.
 */
function checkNext(house: HouseState, [id, x, y, rot = 0, shape]: Placement) {
  const state: RunState = { ...withHouse(house), hand: [{ kind: 'piece', id }] };
  const def = CONTENT.pieces[id];
  const play: PlaceAction = def.pack
    ? { t: 'place', from: 'hand', i: 0, x, y, rot: 0, shape: rotateShape(shape ?? def.shape, rot) }
    : { t: 'place', from: 'hand', i: 0, x, y, rot };
  return rules.checkPlay(state, play);
}

/** Builds the placements one at a time, expecting each to be legal. */
function expectBuildable(placements: readonly Placement[]): void {
  placements.forEach((placement, k) => {
    const check = checkNext(houseFrom(CONTENT, LOT, placements.slice(0, k)), placement);
    const [id, x, y] = placement;
    expect(check.legal, `#${k + 1}, ${id} at (${x}, ${y}): ${check.reason}`).toBe(true);
  });
}

/** The checklist lines that don't hold at a milestone. */
function unmetLines(house: HouseState, phase: number) {
  return rules.checklist({ ...withHouse(house), phase }).filter((line) => !line.met);
}

/** How many pieces are of a type, counting the cards that count as it (an L-Kitchen). */
function countOf(house: HouseState, type: PieceId): number {
  return house.pieces.filter((p) => {
    const def = CONTENT.pieces[p.defId];
    return def.id === type || def.countsAs === type;
  }).length;
}

describe('the Barkers’ witness house', () => {
  it('is a house a player could build, one legal placement at a time', () => {
    expectBuildable(PLACEMENTS);
  });

  it('meets every line of the checklist at every milestone', () => {
    // The Barkers' own checklist (the house rules, then their wishes), so this isn't vacuous.
    const ids = rules.checklist(withHouse(HOUSE)).map((line) => line.id);
    expect(ids).toEqual(expect.arrayContaining(['doghouses', 'mudroom']));
    for (const phase of PHASES) {
      const unmet = unmetLines(HOUSE, phase).map(
        (line) => `${line.name}: ${line.progress.map((part) => part.text).join(' · ')}`,
      );
      expect(unmet, rules.phaseName(phase)).toEqual([]);
    }
  });

  it('keeps both Doghouses in a fenced yard of 12+ tiles, by the Mudroom', () => {
    // The Barkers' fenced yard of 12 tiles waits on a decision; this house already has one.
    const state = withHouse(HOUSE);
    expect(Math.max(...rules.fencedYards(state))).toBeGreaterThanOrEqual(12);
    const tally = rules.currentTally(state);
    const doghouses = HOUSE.pieces.filter((p) => p.defId === 'doghouse');
    expect(doghouses).toHaveLength(2);
    for (const dog of doghouses) {
      expect(rules.describePiece(state, dog.uid)?.regions).toContain('fencedYard');
      // A Doghouse earns only in a fenced yard: no unmet requirement here.
      const score = tally.pieces.find((p) => p.uid === dog.uid);
      expect(score).toBeDefined();
      expect(score!.unmet).toBeUndefined();
    }
    const mudroom = HOUSE.pieces.find((p) => p.defId === 'mudroom')!;
    expect(rules.describePiece(state, mudroom.uid)?.fencedYardTiles).toBeGreaterThan(0);
  });

  it('reads as a house: no visible repeats', () => {
    expect(countOf(HOUSE, 'kitchen')).toBeLessThanOrEqual(1);
    expect(countOf(HOUSE, 'livingRoom')).toBeLessThanOrEqual(2);
    expect(countOf(HOUSE, 'diningRoom')).toBeLessThanOrEqual(1);
  });

  // One piece more or less, and exactly one line goes false at every milestone.
  it.each<{ change: string; placements: readonly Placement[]; lost: string }>([
    {
      // An L-Kitchen counts as a Kitchen: here it fills the front corner beside the first.
      change: 'a second Kitchen',
      placements: [...PLACEMENTS, ['lKitchen', 10, 8]],
      lost: 'oneKitchen',
    },
    { change: 'one Doghouse fewer', placements: PLACEMENTS.slice(0, -1), lost: 'doghouses' },
  ])('$change loses exactly one line ($lost)', ({ placements, lost }) => {
    expectBuildable(placements);
    const house = houseFrom(CONTENT, LOT, placements);
    for (const phase of PHASES) {
      const unmet = unmetLines(house, phase).map((line) => line.id);
      expect(unmet, rules.phaseName(phase)).toEqual([lost]);
    }
  });
});
