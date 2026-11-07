// Juniper Vale's witness layout (implementation-plan.md §5, §9 · M4a): a house built by hand
// from the real content that meets every line of her checklist at every milestone, which
// proves her specs can be met without a solver. Her checklist is the seven house rules in her
// numbers (house-rules.ts) and her one wish, Two rooms with a view.
//
// The numbers that shape it:
// - Room for everyone steps up: 1–2 Bedrooms, then 1–3 from Framing and 2–4 from Drywall.
//   2 is the only count inside all three, so the house has 2 Bedrooms and 1 Bathroom.
// - Cozy wants 6+ rooms and her Under one roof at most 8, so 6–8 rooms. 2 Bedrooms, a
//   Bathroom, a Kitchen, and a Living Room are 5, so the house has one room more: a Closet.
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
  ['closet', 9, 7], // the sixth room, for Cozy
  ['bedroom', 10, 6], // behind the Kitchen, by the pond: a view
  ['herbGarden', 12, 8, 1], // upright, beside the Kitchen: a view
  ['flowerBed', 8, 10], // in front of the Living Room: a view
  ['flowerBed', 11, 10], // in front of the Kitchen, across the front walk
  ['patio', 5, 8], // off the side of the Living Room
  ['lawn', 5, 11], // the front lawn's left half
  ['lawn', 7, 11], // and its right half, by the Flower Bed
];

// The finished house (b Bedroom, w Bathroom, c Closet, l Living Room, k Kitchen; h Herb
// Garden, f Flower Bed, p Patio, g Lawn; T Tree, P pond, B boulder):
//
//   TTT...............
//   TT.......B........
//   T.................
//   ..................
//   ..................
//   .......T....PP....
//   .......bbwbbPP....
//   .......bbcbb......
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
// 6 rooms filling a 5 × 4 box, each touching 2 or more rooms. 4 rooms have a view: the
// Bedrooms look out on the Tree and the pond, the Kitchen on the Herb Garden, and the Living
// Room on a Flower Bed. 6 yard pieces, 2 of a type at most.

const run = rules.newRun({
  seed: 'witness-juniper',
  clientId: 'juniper',
  crewId: 'generalContractor',
  mode: 'standard',
});
const PHASES = CONTENT.balance.phases;

/** "legal", or why a player couldn't place this piece from the hand on the house built so far. */
function placing(built: readonly Placement[], [id, x, y, rot = 0]: Placement): string {
  const state: RunState = {
    ...run,
    house: houseFrom(CONTENT, LOT, built),
    hand: [{ kind: 'piece', id }],
  };
  const check = rules.checkPlay(state, { t: 'place', from: 'hand', i: 0, x, y, rot });
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

    const house = houseFrom(CONTENT, LOT, PLACEMENTS);
    PHASES.forEach(({ name }, phase) => {
      const lines = missed(house, phase).map(shown);
      expect(lines.length, `at ${name}, the house misses ${lines.join('; ')}`).toBe(0);
    });

    // It reads as a house: no visible repeats, as the household rules demand too.
    const ofType = (type: PieceId) =>
      house.pieces.filter((p) => (CONTENT.pieces[p.defId].countsAs ?? p.defId) === type).length;
    expect(ofType('kitchen')).toBeLessThanOrEqual(1); // Kitchens and L-Kitchens together
    expect(ofType('livingRoom')).toBeLessThanOrEqual(2);
    expect(ofType('diningRoom')).toBeLessThanOrEqual(1);
  });

  it('loses exactly one line when one piece is added or taken away', () => {
    // One piece more: a second Kitchen (an L-Kitchen on the front walk, a legal play).
    const lKitchen: Placement = ['lKitchen', 9, 10, 1];
    expect(placing(PLACEMENTS, lKitchen)).toBe('legal');
    const twoKitchens = houseFrom(CONTENT, LOT, [...PLACEMENTS, lKitchen]);
    // One piece fewer: without the Closet, 5 rooms still suit Under one roof (4–8) but not
    // Cozy (6+).
    const withoutCloset = PLACEMENTS.filter(([id]) => id !== 'closet');
    const noCloset = houseFrom(CONTENT, LOT, withoutCloset);
    PHASES.forEach(({ name }, phase) => {
      const names = (house: HouseState) => missed(house, phase).map((line) => line.name);
      expect(names(twoKitchens), `at ${name}`).toEqual(['One Kitchen']);
      expect(names(noCloset), `at ${name}`).toEqual(['Cozy']);
    });
  });
});
