// Juniper Vale's witness layout (implementation-plan.md §5, §9 · M4a): a house built by hand
// from the real content that meets every line of her checklist at every milestone, which
// proves her specs can be met without a solver. Her checklist is the house rules in her
// numbers (house-rules.ts) and her one wish, Two rooms with a view.
//
// The numbers that shape it:
// - Room for everyone grows with the household (M4b, D-103): 1–2 Bedrooms, then 2–3 and
//   Rowan's room from Drywall. Rowan's Studio counts as a Bedroom, so the house has 2 Bedrooms
//   of its own and, for the 3 from Drywall, 2 Bathrooms. The studio is a reserve play.
// - Her A compact house is 4–8 rooms: 2 Bedrooms, 2 Bathrooms, a Kitchen, and a Living Room,
//   then Rowan's Studio makes 7. (Cozy, a line until D-165, wanted 6+, each touching two; it
//   pays on the rooms now.)
// - A tidy yard: 6 yard pieces, no type more than twice.

import { describe, expect, it } from 'vitest';
import type { ChecklistLine, HouseState, PieceId, RunState } from '../rules/index.ts';
import { CONTENT, rules } from '../rules/index.ts';
import { houseFrom, type Placement } from '../rules/testing.ts';

// 18 × 16, the street along the bottom edge: woods at the back left, a lone Tree, the pond,
// and two boulders.
const LOT = [
  'TTT...............',
  'TT.......B........',
  'T.................',
  '..................',
  '..................',
  '.......T....PP....',
  '............PP....',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..................',
  '..B...............',
  '..................',
  '..................',
];

// One piece a week, in this order: [piece, x, y, rotation].
const PLACEMENTS: readonly Placement[] = [
  ['livingRoom', 7, 8, 1], // turned 3 wide, at the front of the house
  ['kitchen', 10, 8], // beside the Living Room
  ['bedroom', 7, 6], // behind the Living Room, by the lone Tree: a view
  ['bathroom', 9, 6], // between the Bedrooms, touching both
  ['bathroom', 9, 7], // the sixth room, for Cozy, and the second Bathroom for Rowan's room
  ['bedroom', 10, 6], // behind the Kitchen, by the pond: a view
  ['herbGarden', 12, 8, 1], // upright, beside the Kitchen: a view
  ['flowerBed', 8, 10], // in front of the Living Room: a view
  ['flowerBed', 11, 10], // in front of the Kitchen, across the front walk
  ['patio', 5, 8], // off the side of the Living Room
  ['lawn', 5, 11], // the front lawn's left half
  ['lawn', 7, 11], // and its right half, by the Flower Bed
];

/** Rowan's room (D-103), from the reserve when Rowan arrives: [the phase, placement]. */
const MEMBERS: readonly [number, Placement][] = [
  [4, ['rowansStudio', 8, 5]], // behind the Bedroom and the Bathroom, by the lone Tree: a view
];

/** The house at a milestone: these pieces, then the household's rooms from their arrivals on. */
const houseAt = (phase: number, placements: readonly Placement[] = PLACEMENTS): HouseState =>
  houseFrom(CONTENT, LOT, [
    ...placements,
    ...MEMBERS.filter(([at]) => at <= phase).map(([, p]) => p),
  ]);

// The finished house (b Bedroom, w Bathroom, r Rowan's Studio from Drywall, l Living Room, k
// Kitchen; h Herb Garden, f Flower Bed, p Patio, g Lawn; T Tree, P pond, B boulder):
//
//   TTT...............
//   TT.......B........
//   T.................
//   ..................
//   ..................
//   .......Trr..PP....
//   .......bbwbbPP....
//   .......bbwbb......
//   .....pplllkkh.....
//   .....pplllkkh.....
//   ........f..f......
//   .....gggg.........
//   .....gggg.........
//   ..B...............
//   ..................
//   ..................
//   ~~~~~ street ~~~~~
//
// 6 rooms filling a 5 × 4 box (7 in a 5 × 5 from Drywall), each touching 2 or more rooms. 4
// rooms have a view: the Bedrooms look out on the Tree and the pond, the Kitchen on the Herb
// Garden, and the Living Room on a Flower Bed (and from Drywall, Rowan's Studio on the Tree).
// 6 yard pieces, 2 of a type at most.

const run = rules.newRun({
  seed: 'witness-juniper',
  clientId: 'juniper',
  crewId: 'generalContractor',
  mode: 'standard',
});
const PHASES = CONTENT.balance.phases;

/** "legal", or why a player couldn't place this piece from the hand on the house built so far. */
function placing(
  built: readonly Placement[],
  [id, x, y, rot = 0]: Placement,
  from: 'hand' | 'reserve' = 'hand',
): string {
  const house = houseFrom(CONTENT, LOT, built);
  const state: RunState =
    from === 'hand'
      ? { ...run, house, hand: [{ kind: 'piece', id }] }
      : { ...run, house, reserve: [{ id, arrival: 'rowan' }] };
  const check = rules.checkPlay(state, { t: 'place', from, i: 0, x, y, rot });
  return check.legal ? 'legal' : (check.reason ?? 'illegal');
}

/** The checklist lines a house misses at a milestone (0-based). */
function missed(house: HouseState, phase: number): ChecklistLine[] {
  return rules.checklist({ ...run, house, phase }).filter((line) => !line.met);
}

/** A line as the checklist shows it: "Cozy: 5 rooms (≥ 6), 5 of 5 rooms touch 2+ rooms". */
const shown = (line: ChecklistLine) =>
  `${line.name}: ${line.progress.map((p) => p.text).join(', ')}`;

describe('Juniper Vale’s witness house', () => {
  it('is built one legal piece at a time and meets every line at every milestone', () => {
    PLACEMENTS.forEach((placement, k) => {
      const [id, x, y] = placement;
      const where = `${k + 1}. ${CONTENT.pieces[id].name} at (${x}, ${y})`;
      expect(placing(PLACEMENTS.slice(0, k), placement), where).toBe('legal');
    });
    // Rowan's Studio is a reserve play, once Rowan arrives.
    for (const [, placement] of MEMBERS) {
      expect(placing(PLACEMENTS, placement, 'reserve'), placement[0]).toBe('legal');
    }

    PHASES.forEach(({ name }, phase) => {
      const lines = missed(houseAt(phase), phase).map(shown);
      expect(lines.length, `at ${name}, the house misses ${lines.join('; ')}`).toBe(0);
    });
    const house = houseAt(PHASES.length - 1);

    // It reads as a house: no visible repeats, as the cards' caps demand too (D-165).
    const ofType = (type: PieceId) =>
      house.pieces.filter((p) => (CONTENT.pieces[p.defId].countsAs ?? p.defId) === type).length;
    expect(ofType('kitchen')).toBeLessThanOrEqual(1); // Kitchens and L-Kitchens together
    expect(ofType('livingRoom')).toBeLessThanOrEqual(2);
    expect(ofType('diningRoom')).toBeLessThanOrEqual(1);
  });

  it('takes no second Kitchen, and loses one line without Rowan’s Studio', () => {
    // A second Kitchen card (an L-Kitchen on the front walk) renovates instead (D-165).
    const lKitchen: Placement = ['lKitchen', 9, 10, 1];
    expect(placing(PLACEMENTS, lKitchen)).toBe(
      'The house has its Kitchen: this card renovates it.',
    );
    // Rowan's Studio left in the reserve: from Drywall, Room for everyone needs it.
    const noRowan = houseFrom(CONTENT, LOT, PLACEMENTS);
    PHASES.forEach(({ name }, phase) => {
      const names = (house: HouseState) => missed(house, phase).map((line) => line.name);
      expect(names(noRowan), `at ${name}`).toEqual(phase >= 4 ? ['Room for everyone'] : []);
    });
  });
});
