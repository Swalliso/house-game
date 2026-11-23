// The Bigsbys' witness layout (implementation-plan.md §5, §9; D-219): a house a player could
// build, one legal placement at a time, that meets every line of their checklist at every
// milestone. It proves their specs can be met without a solver. Their checklist is the house
// rules in their numbers (D-165: Room for everyone, A compact house, A tidy yard), then A
// Playroom. Room for everyone grows by one at each end every milestone from Foundation to
// Finishes (households.ts): 2–3 Bedrooms, then 3–4, 4–5, 5–6, 6–7 and 7–8. Their members have
// no room of their own: each brings a plain Bedroom card, so the house is seven Bedrooms, two
// to start and one more each milestone, and it stays compact the whole way.
//
//      0123456789012345
//    0 T.............PP   L Living Room   K Kitchen      D Dining Room   P Playroom
//    1 ..............PP   1 2 the first two Bedrooms     b Bathrooms
//    2 ................   3 4 5 6 7 the members' Bedrooms, at Foundation, Framing, Roofing,
//    3 ................     Drywall and Finishes
//    4 ....33445566....   p Patio  w Lawn  * Flower Bed  e Herb Garden  f Fire Pit
//    5 ....33445566....
//    6 ..ppLLLKKDDb....   The house is a box 8 × 4 to start, 30 of its 32 tiles, then the back
//    7 ..ppLLLKKDDbf...   row fills in, one Bedroom a milestone (8 × 6, 34 to 46 of 48), and
//    8 ..ww11b22PP77...   the seventh takes the front corner at Finishes (9 × 6, 50 of 54).
//    9 ..ww11b22PP77...   Four Bathrooms: two between the first two Bedrooms, and two beside
//   10 .....*..*ee....B   the Dining Room, below the back row.
//   11 ................
//   12 ................
//   13 ................
//      ================   the street

import { describe, expect, it } from 'vitest';
import type { HouseState, PieceId, PlaceAction, RunState } from '../rules/index.ts';
import { CONTENT, rules } from '../rules/index.ts';
import { rotateShape } from '../rules/grid.ts';
import { houseFrom, type Placement } from '../rules/testing.ts';

/** A 16 × 14 lot. The street runs along the bottom edge, below row 13. */
const LOT = [
  'T.............PP', //  0
  '..............PP',
  '................',
  '................',
  '................',
  '................', //  5
  '................',
  '................',
  '................',
  '................',
  '...............B', // 10
  '................',
  '................',
  '................', // 13: the street row
];

/** In build order: [piece, x, y, rot], where (x, y) is the top-left of the turned shape. */
const PLACEMENTS: readonly Placement[] = [
  ['livingRoom', 4, 6, 1], // turned to 3 × 2, the middle of the house
  ['kitchen', 7, 6], // beside the Living Room
  ['diningRoom', 9, 6], // beside the Kitchen
  ['bedroom', 4, 8], // Bedroom 1, in front of the Living Room
  ['bathroom', 6, 8], // between Bedrooms 1 and 2
  ['bedroom', 7, 8], // Bedroom 2, in front of the Kitchen
  ['bathroom', 6, 9], // the second between them
  ['playroom', 9, 8], // their wish, in front of the Dining Room
  ['bathroom', 11, 6], // beside the Dining Room, for the back row
  ['bathroom', 11, 7],
  ['patio', 2, 6], // off the Living Room
  ['lawn', 2, 8], // beside Bedroom 1
  ['flowerBed', 5, 10], // two Flower Beds out front
  ['flowerBed', 8, 10],
  ['herbGarden', 9, 10], // in front of the Playroom
  ['firePit', 12, 7], // by the side door
];

/**
 * The household's Bedrooms (D-219), each from the reserve once its member arrives: [the phase
 * it arrives at, placement]. Each is a plain Bedroom.
 */
const MEMBERS: readonly [number, Placement][] = [
  [1, ['bedroom', 4, 4]], // Aunt Bea, behind the Living Room
  [2, ['bedroom', 6, 4]], // the cousins, behind the Living Room and the Kitchen
  [3, ['bedroom', 8, 4]], // Grandpa, behind the Kitchen and the Dining Room
  [4, ['bedroom', 10, 4]], // the newlyweds, behind the Dining Room and a Bathroom
  [5, ['bedroom', 11, 8]], // the baby, in the front corner beside the Playroom
];

/**
 * The house at a milestone: every piece, then the household's Bedrooms from their arrivals on,
 * and any `extra` pieces. `keep` can leave a member's Bedroom out.
 */
function houseAt(
  phase: number,
  extra: readonly Placement[] = [],
  keep: (p: Placement) => boolean = () => true,
): HouseState {
  const members = MEMBERS.filter(([from]) => from <= phase)
    .map(([, p]) => p)
    .filter(keep);
  return houseFrom(CONTENT, LOT, [...PLACEMENTS, ...members, ...extra]);
}

/** A Bigsbys run. Each test swaps in its own house, lot and all. */
const RUN: RunState = rules.newRun({
  seed: 'witness-bigsbys',
  clientId: 'bigsbys',
  crewId: 'generalContractor',
  mode: 'standard',
});

/** Every milestone, 0-based. */
const PHASES = CONTENT.balance.phases.map((_, phase) => phase);

/**
 * The rules' own check of a placement, with the piece's card in hand, or (a member's Bedroom) in
 * the reserve. A pack's play carries its tiles, turned, as the board sends them: at rot 0.
 */
function checkPlace(
  house: HouseState,
  [id, x, y, rot = 0, shape]: Placement,
  from: 'hand' | 'reserve' = 'hand',
) {
  const state: RunState =
    from === 'hand'
      ? { ...RUN, house, hand: [{ kind: 'piece', id }] }
      : { ...RUN, house, reserve: [{ id, arrival: 'auntBea' }] };
  const def = CONTENT.pieces[id];
  const play: PlaceAction = def.pack
    ? { t: 'place', from, i: 0, x, y, rot: 0, shape: rotateShape(shape ?? def.shape, rot) }
    : { t: 'place', from, i: 0, x, y, rot };
  return rules.checkPlay(state, play);
}

/** The ids of the checklist lines that don't hold. */
function failing(house: HouseState, phase: number): string[] {
  return rules
    .checklist({ ...RUN, house, phase })
    .filter((line) => !line.met)
    .map((line) => line.id);
}

/** How many pieces of a type (an L-Kitchen counts as a Kitchen). */
function count(house: HouseState, type: PieceId): number {
  return house.pieces.filter((p) => (CONTENT.pieces[p.defId].countsAs ?? p.defId) === type).length;
}

describe("the Bigsbys' witness layout", () => {
  it('is a house a player could build, one legal placement at a time', () => {
    PLACEMENTS.forEach((placement, k) => {
      const check = checkPlace(houseFrom(CONTENT, LOT, PLACEMENTS.slice(0, k)), placement);
      const [id, x, y] = placement;
      const what = `${k + 1}. ${CONTENT.pieces[id].name} at (${x}, ${y})`;
      expect(check.legal, `${what}: ${check.reason}`).toBe(true);
    });
    // The household's Bedrooms are reserve plays, as their members arrive.
    MEMBERS.forEach(([, placement], k) => {
      const built = [...PLACEMENTS, ...MEMBERS.slice(0, k).map(([, p]) => p)];
      const check = checkPlace(houseFrom(CONTENT, LOT, built), placement, 'reserve');
      const [id, x, y] = placement;
      expect(check.legal, `${CONTENT.pieces[id].name} at (${x}, ${y}): ${check.reason}`).toBe(true);
    });
  });

  it('meets every line of the checklist at every milestone', () => {
    const misses = PHASES.flatMap((phase) => {
      const lines = rules.checklist({ ...RUN, house: houseAt(phase), phase });
      expect(lines.map((line) => line.id)).toEqual([
        'roomForEveryone',
        'underOneRoof',
        'tidyYard',
        'playroom',
      ]);
      return lines
        .filter((line) => !line.met)
        .map((line) => {
          const progress = line.progress.map((p) => (p.ok ? p.text : `✗ ${p.text}`));
          return `${rules.phaseName(phase)}: ${[line.name, ...progress].join(', ')}`;
        });
    });
    expect(misses).toEqual([]);
  });

  it('has two Bedrooms to start and one more each milestone, seven by Finishes', () => {
    expect(PHASES.map((phase) => count(houseAt(phase), 'bedroom'))).toEqual([2, 3, 4, 5, 6, 7, 7]);
  });

  it('stays compact the whole way: the box at least 60% full, never twice as long as wide', () => {
    for (const phase of PHASES) {
      const lines = rules.checklist({ ...RUN, house: houseAt(phase), phase });
      const compact = lines.find((line) => line.id === 'underOneRoof')!;
      expect(compact.met, rules.phaseName(phase)).toBe(true);
    }
  });

  it('reads as a house: one Kitchen, Living Room and Dining Room, a Bathroom for every two Bedrooms', () => {
    const house = houseAt(PHASES.at(-1)!);
    expect(count(house, 'kitchen')).toBe(1);
    expect(count(house, 'livingRoom')).toBe(1);
    expect(count(house, 'diningRoom')).toBe(1);
    expect(count(house, 'playroom')).toBe(1);
    expect(count(house, 'bedroom')).toBe(7);
    expect(count(house, 'bathroom')).toBe(4);
  });
});

describe('one piece more or less breaks just the line it should', () => {
  it('with Aunt Bea’s Bedroom left in the reserve, Room for everyone fails from Foundation on', () => {
    const bea = MEMBERS[0]![1];
    for (const phase of PHASES) {
      const house = houseAt(phase, [], (p) => p !== bea);
      expect(failing(house, phase), rules.phaseName(phase)).toEqual(
        phase >= 1 ? ['roomForEveryone'] : [],
      );
    }
  });

  it('a Bedroom ahead of the doorbell still holds, and a second is one too many', () => {
    const drywall = 4;
    const ahead: Placement = ['bedroom', 11, 8]; // the baby's spot, a milestone early
    const second: Placement = ['bedroom', 12, 5]; // beside the newlyweds' Bedroom
    expect(checkPlace(houseAt(drywall), ahead).legal).toBe(true);
    expect(checkPlace(houseAt(drywall, [ahead]), second).legal).toBe(true);
    // 7 against 6–7 holds; 8 doesn't.
    expect(failing(houseAt(drywall, [ahead]), drywall)).toEqual([]);
    expect(failing(houseAt(drywall, [ahead, second]), drywall)).toEqual(['roomForEveryone']);
  });

  it('without the Playroom, only their wish fails', () => {
    for (const phase of PHASES) {
      const house = houseFrom(CONTENT, LOT, [
        ...PLACEMENTS.filter(([id]) => id !== 'playroom'),
        ...MEMBERS.filter(([from]) => from <= phase).map(([, p]) => p),
      ]);
      expect(failing(house, phase), rules.phaseName(phase)).toEqual(['playroom']);
    }
  });
});
