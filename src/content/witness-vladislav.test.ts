// Count Vladislav's witness layout (implementation-plan.md §5 and §9, M4a): a house built by
// hand from the real content that meets every line of his checklist at every milestone, which
// proves his specs can be met without a solver. His checklist is the seven house rules in his
// numbers (house-rules.ts) and his two wishes, Three Dark rooms and A Library.
//
// The numbers that shape it:
// - Room for everyone grows with the household (M4b, D-103): 1–2 Bedrooms, then 2–3 and
//   Renfield's room from Framing. His room counts as a Bedroom, so the house has 2 Bedrooms of
//   its own and, for the 3 from Framing, 2 Bathrooms. Renfield's room is a reserve play.
// - Three Dark rooms: a room is Dark when every tile beside it is indoor (no yard, no lot
//   edge), so the house is three rooms deep and the middle row's rooms are walled in: by the
//   back row (Living Room, Dining Room, Kitchen), the front row (the guest Bedroom, the Garage,
//   the front hall), a side Hallway, and the Bathroom and Closet.
// - The Library is a special piece: weight 0 in the base draw, and his pool adds it at 20.
// - A tidy yard: 7 yard pieces, no type more than twice, and no Herb Garden (garlic).

import { describe, expect, it } from 'vitest';
import type {
  ChecklistLine,
  HouseState,
  Legality,
  PieceId,
  PlaceAction,
  RunState,
} from '../rules/index.ts';
import { CONTENT, rules } from '../rules/index.ts';
import { rotateShape } from '../rules/grid.ts';
import { houseFrom, type Placement } from '../rules/testing.ts';

// 18 × 16, the street along the bottom edge: woods at the back left, the pond at the back
// right, two boulders, and three Trees for shade beside the house. The sun shines from the back
// (lotFromRows' default, D-120), so the rooms across the back are Sunny and earn him nothing;
// this test is about his checklist, not his score.
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
  ['bathroom', 11, 10], // below it, closing the study's east side: Renfield makes 3 Bedrooms
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

/** Renfield's room (D-103), from the reserve when he arrives: [the phase, placement]. */
const MEMBERS: readonly [number, Placement][] = [
  [2, ['renfieldsRoom', 11, 11, 1]], // upright, by the Bathroom, linked through the front hall
];

/** The house at a milestone: every piece, then the household's rooms from their arrivals on. */
const houseAt = (phase: number, pieces: readonly Placement[] = PLACEMENTS): HouseState =>
  houseFrom(CONTENT, LOT, [...pieces, ...MEMBERS.filter(([at]) => at <= phase).map(([, p]) => p)]);

// The finished house (L Living Room, D Dining Room, K Kitchen, Y Library, V the Count's
// Bedroom, O Home Office, W Bathrooms, E guest Bedroom, G Garage, H Hallway, R Renfield's
// room from Framing; p Patio, l Lawn, f Flower Bed, d Driveway, = Fence; T Tree, P pond, B
// boulder):
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
//   .....HYYVVOW......
//   ......EEGGHR......
//   .....TEEGGHR......
//   ..B...ff.d........
//   .........d........
//   .....====d====....
//   ~~~~~ street ~~~~~
//
// Y, V, and O are the Dark rooms: every tile beside them is indoor. 10 rooms (and two
// Hallways) fill 90% of a 7 × 6 box, each touching 2 or more rooms; Renfield's makes 11, and
// touches the study and the Garage through the front hall. 7 yard pieces, 2 of a type at
// most; the Driveway and the Fences never break a tidy yard.

const run = rules.newRun({
  seed: 'witness-vladislav',
  clientId: 'vladislav',
  crewId: 'generalContractor',
  mode: 'standard',
});
const PHASES = CONTENT.balance.phases;

/**
 * Could a player place this piece from the hand on the house these placements build? A Fence or
 * a Driveway is a pack (D-106), so its play carries its tiles, turned, as the board sends them:
 * at rot 0.
 */
function checkPlace(
  built: readonly Placement[],
  [id, x, y, rot = 0, shape]: Placement,
  from: 'hand' | 'reserve' = 'hand',
): Legality {
  const house = houseFrom(CONTENT, LOT, built);
  const state: RunState =
    from === 'hand'
      ? { ...run, house, hand: [{ kind: 'piece', id }] }
      : { ...run, house, reserve: [{ id, arrival: 'renfield' }] };
  const def = CONTENT.pieces[id];
  const play: PlaceAction = def.pack
    ? { t: 'place', from, i: 0, x, y, rot: 0, shape: rotateShape(shape ?? def.shape, rot) }
    : { t: 'place', from, i: 0, x, y, rot };
  return rules.checkPlay(state, play);
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
    // Renfield's room is a reserve play, once he arrives.
    MEMBERS.forEach(([, placement]) => {
      const [id, x, y] = placement;
      const check = checkPlace(PLACEMENTS, placement, 'reserve');
      expect(check.legal, `${CONTENT.pieces[id].name} at (${x}, ${y}): ${check.reason}`).toBe(true);
    });
    // One piece a week: 20 pieces fit in a run's 28 weeks.
    expect(PLACEMENTS.length + MEMBERS.length).toBeLessThanOrEqual(
      CONTENT.balance.weeksPerPhase * PHASES.length,
    );

    PHASES.forEach(({ name }, phase) => {
      expect(missed(houseAt(phase), phase).map(shown), `missed at ${name}`).toEqual([]);
    });
    const house = houseAt(PHASES.length - 1);

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

  it('loses exactly one line when one piece is added or taken away, or Renfield’s room', () => {
    // One piece fewer: without the side Hallway, the Library touches the yard and isn't Dark.
    const noSideHall = PLACEMENTS.filter((p) => p !== SIDE_HALL);
    // One piece more: a second Kitchen (an L-Kitchen past the Bathroom, a legal play).
    const lKitchen: Placement = ['lKitchen', 12, 9, 1];
    expect(checkPlace(PLACEMENTS, lKitchen).legal).toBe(true);
    // Renfield left in the reserve: from Framing, Room for everyone needs his room.
    PHASES.forEach(({ name }, phase) => {
      const ids = (house: HouseState) => missed(house, phase).map((line) => line.id);
      expect(ids(houseAt(phase, noSideHall)), `at ${name}`).toEqual(['darkRooms']);
      expect(ids(houseAt(phase, [...PLACEMENTS, lKitchen])), `at ${name}`).toEqual(['oneKitchen']);
      const noRenfield = houseFrom(CONTENT, LOT, PLACEMENTS);
      expect(ids(noRenfield), `at ${name}`).toEqual(phase >= 2 ? ['roomForEveryone'] : []);
    });
  });
});
