// The Barkers' witness layout (implementation-plan.md §5 and §9): a hand-built house on the real
// content that meets every line of their checklist at every milestone, built one legal
// placement at a time, which proves the checklist can be met without a solver. If a content
// change breaks it, rebuild the house; if no house can meet the checklist any more, that's a
// content bug.
//
// The finished house. The street runs along the bottom edge, so row 13 is the street row.
// Rooms: B Bedroom, b Bathroom, M Mudroom, L Living Room, K Kitchen, N Nana's Room (from
// Drywall, M4b). Yard: F Fence, g Lawn, d Doghouse. Lot: T Tree, P pond.
//
//    0123456789012345
//  0 ................
//  1 .TT...........T.
//  2 .T..FFFFFFFF....  the back Fence
//  3 ....Fggggd.F....  the dog yard (6 × 3, 18 tiles): two Lawns and two Doghouses
//  4 ....Fggggd.F....
//  5 ....F......F....
//  6 ....FBBMMBBF....  Bedroom, Mudroom (the back door, onto the dog yard), Bedroom
//  7 .....BBbbBB.....  two Bathrooms between the Bedrooms
//  8 .....LLLKK......  the Living Room and the Kitchen at the front
//  9 .....LLLKK......
// 10 ......TNN.......  a Tree outside the Living Room; Nana's Room, from Drywall
// 11 .......NN....PP.  the pond
// 12 .............PP.
// 13 ................  the street row
//
// 7 rooms (22 tiles in a 6 × 4 box), 2 Bedrooms, 2 Bathrooms, and 8 yard pieces: 4 Fences, 2
// Lawns, 2 Doghouses. Room for everyone grows with the household (M4b, D-099): 1–2 Bedrooms,
// then 2–3 and Nana's room from Drywall. Her room counts as a Bedroom (3, so 2 Bathrooms) and
// is a reserve play; the house is then 8 rooms in a 6 × 6 box.

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
  ['bathroom', 8, 7], // above the Kitchen, so the house has no hole: Nana makes 3 Bedrooms
  // 2 Bedrooms of their own: 1–2 to start, then 2–3 with Nana's room.
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

/** Nana's room (D-099), from the reserve when she arrives: [the phase, placement]. */
const MEMBERS: readonly [number, Placement][] = [
  [4, ['nanasRoom', 7, 10]], // in front of the Living Room and the Kitchen
];

/** The house at a milestone: these pieces, then the household's rooms from their arrivals on. */
const houseAt = (phase: number, placements: readonly Placement[] = PLACEMENTS): HouseState =>
  houseFrom(CONTENT, LOT, [
    ...placements,
    ...MEMBERS.filter(([at]) => at <= phase).map(([, p]) => p),
  ]);

const RUN: RunState = rules.newRun({
  seed: 'witness-barkers',
  clientId: 'barkers',
  crewId: 'generalContractor',
  mode: 'standard',
});
/** The finished house, Nana's room and all. */
const HOUSE = houseAt(CONTENT.balance.phases.length - 1);
/** Every milestone, 0-based: Groundbreaking to the Final Walkthrough. */
const PHASES = CONTENT.balance.phases.map((_, i) => i);

/** The run with this house in place of its own (the house brings its lot). */
const withHouse = (house: HouseState): RunState => ({ ...RUN, house });

/**
 * The rules' own check of building this piece next, from a hand holding its card. A Fence is a
 * pack (D-102), so its play carries its tiles, turned, as the board sends them: at rot 0.
 */
function checkNext(
  house: HouseState,
  [id, x, y, rot = 0, shape]: Placement,
  from: 'hand' | 'reserve' = 'hand',
) {
  const state: RunState =
    from === 'hand'
      ? { ...withHouse(house), hand: [{ kind: 'piece', id }] }
      : { ...withHouse(house), reserve: [{ id, arrival: 'nana' }] };
  const def = CONTENT.pieces[id];
  const play: PlaceAction = def.pack
    ? { t: 'place', from, i: 0, x, y, rot: 0, shape: rotateShape(shape ?? def.shape, rot) }
    : { t: 'place', from, i: 0, x, y, rot };
  return rules.checkPlay(state, play);
}

/** Builds the placements one at a time, then Nana's room from the reserve, each legal. */
function expectBuildable(placements: readonly Placement[]): void {
  placements.forEach((placement, k) => {
    const check = checkNext(houseFrom(CONTENT, LOT, placements.slice(0, k)), placement);
    const [id, x, y] = placement;
    expect(check.legal, `#${k + 1}, ${id} at (${x}, ${y}): ${check.reason}`).toBe(true);
  });
  for (const [, placement] of MEMBERS) {
    const check = checkNext(houseFrom(CONTENT, LOT, placements), placement, 'reserve');
    expect(check.legal, `${placement[0]}: ${check.reason}`).toBe(true);
  }
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
      const unmet = unmetLines(houseAt(phase), phase).map(
        (line) => `${line.name}: ${line.progress.map((part) => part.text).join(' · ')}`,
      );
      expect(unmet, rules.phaseName(phase)).toEqual([]);
    }
  });

  it('with Nana’s room left in the reserve, Room for everyone fails from Drywall on', () => {
    const base = houseFrom(CONTENT, LOT, PLACEMENTS);
    for (const phase of PHASES) {
      const unmet = unmetLines(base, phase).map((line) => line.id);
      expect(unmet, rules.phaseName(phase)).toEqual(phase >= 4 ? ['roomForEveryone'] : []);
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
    for (const phase of PHASES) {
      const unmet = unmetLines(houseAt(phase, placements), phase).map((line) => line.id);
      expect(unmet, rules.phaseName(phase)).toEqual([lost]);
    }
  });
});
