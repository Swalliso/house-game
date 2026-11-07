// Count Vladislav's witness layout (implementation-plan.md §5 and §9, M4a): a house built by
// hand from the real content that meets every line of his checklist at every milestone, which
// proves his specs can be met without a solver. His checklist is the seven house rules in his
// numbers (house-rules.ts) and his two wishes, Three Dark rooms and A Library.
//
// The numbers that shape it:
// - Room for everyone steps up: 1–2 Bedrooms, then 1–3 from Framing and 2–4 from Drywall.
//   2 is the only count inside all three, so the house has 2 Bedrooms and 1 Bathroom.
// - Three Dark rooms: a room is Dark when every tile beside it is indoor (no yard, no lot
//   edge), so the house is three rooms deep and the middle row's rooms are walled in: by the
//   back row (Living Room, Dining Room, Kitchen), the front row (the guest Bedroom, the Garage,
//   the front hall), a side Hallway, and the Bathroom and Closet.
// - The Library is a special piece: weight 0 in the base draw, and his pool adds it at 20.
// - A tidy yard: 7 yard pieces, no type more than twice, and no Herb Garden (garlic).

import { describe, expect, it } from 'vitest';
import type { ChecklistLine, HouseState, Legality, PieceId, RunState } from '../rules/index.ts';
import { CONTENT, rules } from '../rules/index.ts';
import { houseFrom, type Placement } from '../rules/testing.ts';

// 18 × 16, the street along the bottom edge: woods at the back left, the pond at the back
// right, two boulders, and three Trees for shade beside the house. The sunny side is the top 4
// rows (lotFromRows' default), and the house keeps out of it: Sunny pieces earn him nothing.
const LOT = [
  'TTT...............',
  'TT............PP..',
  'T.............PP..',
  '..................',
  '...........B......',
  '..................',
  '..................',
  '..................',
  '....T.......T.....',
  '..................',
  '..................',
  '..................',
  '.....T............',
  '..B...............',
  '..................',
  '..................',
];

/** The side Hallway: the Library's west wall. */
const SIDE_HALL: Placement = ['hallway', 5, 9, 1];

// One piece a week, in this order: [piece, x, y, rotation].
const PLACEMENTS: readonly Placement[] = [
  ['driveway', 9, 13, 1], // upright, in from the street
  ['garage', 8, 11], // at the top of the Driveway
  ['bedroom', 6, 11], // the guest Bedroom, beside the Garage
  ['hallway', 10, 11, 1], // upright: the front hall, on the Garage's other side
  ['bedroom', 8, 9], // the Count's, behind the Garage
  ['library', 6, 9], // behind the guest Bedroom
  ['homeOffice', 10, 9, 1], // upright: his study, behind the front hall
  ['bathroom', 11, 9], // beside the study
  ['closet', 11, 10], // below the Bathroom, closing the study's east side
  SIDE_HALL, // upright, beside the Library
  ['livingRoom', 5, 7, 1], // turned 3 wide, across the back: now the Library is Dark
  ['diningRoom', 8, 7], // behind the Count's Bedroom: now it's Dark
  ['kitchen', 10, 7], // behind the study: now it's Dark
  ['patio', 5, 5], // off the back of the Living Room
  ['lawn', 8, 5], // behind the Dining Room
  ['flowerBed', 6, 13], // in front of the guest Bedroom
  ['flowerBed', 7, 13],
  ['fence', 5, 15], // railings along the street, either side of the Driveway
  ['fence', 10, 15],
];

// The finished house (L Living Room, D Dining Room, K Kitchen, Y Library, V the Count's
// Bedroom, O Home Office, W Bathroom, C Closet, E guest Bedroom, G Garage, H Hallway; p Patio,
// l Lawn, f Flower Bed, d Driveway, = Fence; T Tree, P pond, B boulder):
//
//   TTT...............
//   TT............PP..
//   T.............PP..
//   ..................
//   ...........B......
//   .....pp.ll........
//   .....pp.ll........
//   .....LLLDDKK......
//   ....TLLLDDKKT.....
//   .....HYYVVOW......
//   .....HYYVVOC......
//   ......EEGGH.......
//   .....TEEGGH.......
//   ..B...ff.d........
//   .........d........
//   .....====d====....
//   ~~~~~ street ~~~~~
//
// Y, V, and O are the Dark rooms: every tile beside them is indoor. 10 rooms (and two
// Hallways) fill 90% of a 7 × 6 box, each touching 2 or more rooms. 7 yard pieces, 2 of a
// type at most; the Driveway and the Fences never break a tidy yard.

const run = rules.newRun({
  seed: 'witness-vladislav',
  clientId: 'vladislav',
  crewId: 'generalContractor',
  mode: 'standard',
});
const PHASES = CONTENT.balance.phases;

/** Could a player place this piece from the hand on the house these placements build? */
function checkPlace(built: readonly Placement[], [id, x, y, rot = 0]: Placement): Legality {
  const state: RunState = {
    ...run,
    house: houseFrom(CONTENT, LOT, built),
    hand: [{ kind: 'piece', id }],
  };
  return rules.checkPlay(state, { t: 'place', from: 'hand', i: 0, x, y, rot });
}

/** The checklist lines a house misses at a milestone (0-based). */
function missed(house: HouseState, phase: number): ChecklistLine[] {
  return rules.checklist({ ...run, house, phase }).filter((line) => !line.met);
}

/** A line as the checklist shows it: "Three Dark rooms: Dark rooms 2 of 3". */
const shown = (line: ChecklistLine) =>
  `${line.name}: ${line.progress.map((p) => p.text).join(', ')}`;

describe('Count Vladislav’s witness house', () => {
  it('is built one legal piece at a time and meets every line at every milestone', () => {
    PLACEMENTS.forEach((placement, k) => {
      const [id, x, y] = placement;
      const check = checkPlace(PLACEMENTS.slice(0, k), placement);
      expect(
        check.legal,
        `${k + 1}. ${CONTENT.pieces[id].name} at (${x}, ${y}): ${check.reason}`,
      ).toBe(true);
    });
    // One piece a week: 19 pieces fit in a run's 28 weeks.
    expect(PLACEMENTS.length).toBeLessThanOrEqual(CONTENT.balance.weeksPerPhase * PHASES.length);

    const house = houseFrom(CONTENT, LOT, PLACEMENTS);
    PHASES.forEach(({ name }, phase) => {
      expect(missed(house, phase).map(shown), `missed at ${name}`).toEqual([]);
    });

    // The Dark rooms are the middle row's three: his Bedroom, the Library, and his study.
    const state: RunState = { ...run, house };
    const dark = house.pieces.filter((p) =>
      rules.describePiece(state, p.uid)?.tags.includes('Dark'),
    );
    expect(dark.map((p) => p.defId)).toEqual(['bedroom', 'library', 'homeOffice']);

    // It reads as a house: no visible repeats, as the household rules demand too.
    const ofType = (type: PieceId) =>
      house.pieces.filter((p) => (CONTENT.pieces[p.defId].countsAs ?? p.defId) === type).length;
    expect(ofType('kitchen')).toBeLessThanOrEqual(1); // an L-Kitchen counts as one
    expect(ofType('livingRoom')).toBeLessThanOrEqual(2);
    expect(ofType('diningRoom')).toBeLessThanOrEqual(1);
  });

  it('loses exactly one line when one piece is added or taken away', () => {
    // One piece fewer: without the side Hallway, the Library touches the yard and isn't Dark.
    const noSideHall = houseFrom(
      CONTENT,
      LOT,
      PLACEMENTS.filter((p) => p !== SIDE_HALL),
    );
    // One piece more: a second Kitchen (an L-Kitchen past the Bathroom, a legal play).
    const lKitchen: Placement = ['lKitchen', 12, 9, 1];
    expect(checkPlace(PLACEMENTS, lKitchen).legal).toBe(true);
    const twoKitchens = houseFrom(CONTENT, LOT, [...PLACEMENTS, lKitchen]);
    PHASES.forEach(({ name }, phase) => {
      const ids = (house: HouseState) => missed(house, phase).map((line) => line.id);
      expect(ids(noSideHall), `at ${name}`).toEqual(['darkRooms']);
      expect(ids(twoKitchens), `at ${name}`).toEqual(['oneKitchen']);
    });
  });
});
