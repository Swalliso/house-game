// The Hendersons' witness layout (implementation-plan.md §5, §9): a house a player could build,
// one legal placement at a time, that meets every line of their checklist at every milestone.
// It proves their specs can be met without a solver. Their checklist is the house rules in their
// numbers (D-165: Room for everyone, A compact house, A tidy yard), then Kitchen beside the
// Dining Room and A fenced yard. Room for everyone
// grows with the household (M4b, D-103): 2–3 Bedrooms, then 3–4 and the twins' room from
// Framing, then 4–5 and Grandma's room from Drywall. Each member's room counts as a Bedroom,
// so three Bedrooms of their own fit every stage.
//
//      0123456789012345
//    0 ..T.........PP..   L Living Room   K Kitchen      D Dining Room
//    1 ............PP..   1 2 3 Bedrooms  b Bathroom
//    2 ...........T....   N the twins' Nursery (Framing), a Kids' Room from Drywall
//    3 ................   G Grandma's Room and her Bathroom g (Drywall)
//    4 ................   f Fence         h Treehouse    w Lawn
//    5 ....ppNNGG......   p Patio         e Herb Garden  * Flower Bed
//    6 ffffppNNGGg.....   T Tree          P pond         B boulder
//    7 .T..LLLKKDDee...
//    8 hh..LLLKKDDww...   The house fills a 7 × 4 box with 8 rooms to Framing, then 7 × 6
//    9 hhww11b2233ww...   with 9 and 11. Both of their own Bathrooms sit between Bedrooms,
//   10 ..ww11b2233.....   so every room touches two others (Cozy pays on each).
//   11 ffff.*..*.......
//   12 ..............B.   The play yard (columns 0–3, rows 7–10) is closed by two Fences,
//   13 ................   the house, and the lot's edge: 16 tiles, clear of the street.
//      ================   the street

import { describe, expect, it } from 'vitest';
import type { HouseState, PieceId, PlaceAction, RunState } from '../rules/index.ts';
import { CONTENT, rules } from '../rules/index.ts';
import { rotateShape } from '../rules/grid.ts';
import { houseFrom, type Placement } from '../rules/testing.ts';

/** A 16 × 14 lot. The street runs along the bottom edge, below row 13. */
const LOT = [
  '..T.........PP..', //  0
  '............PP..',
  '...........T....',
  '................',
  '................',
  '................', //  5
  '................',
  '.T..............', //  7: the play yard's Tree
  '................',
  '................',
  '................', // 10
  '................',
  '..............B.',
  '................', // 13: the street row
];

/** In build order: [piece, x, y, rot], where (x, y) is the top-left of the turned shape. */
const PLACEMENTS: readonly Placement[] = [
  ['livingRoom', 4, 7, 1], // turned to 3 × 2, at the back of the house
  ['kitchen', 7, 7], // beside the Living Room
  ['diningRoom', 9, 7], // beside the Kitchen: their wish
  ['bedroom', 4, 9], // Bedroom 1, in front of the Living Room
  ['bathroom', 6, 9], // between Bedrooms 1 and 2 (a Jack-and-Jill)
  ['bedroom', 7, 9], // Bedroom 2
  ['bathroom', 6, 10], // the second Bathroom, for the third Bedroom
  ['bedroom', 9, 9], // Bedroom 3, in front of the Dining Room
  ['fence', 0, 6], // the play yard's back fence
  ['fence', 0, 11], // and its front fence
  ['treehouse', 0, 8], // touching the Tree
  ['lawn', 2, 9], // in the play yard
  ['patio', 4, 5], // off the Living Room
  ['herbGarden', 11, 7], // beside the Dining Room
  ['lawn', 11, 8], // the side lawn
  ['flowerBed', 5, 11], // two Flower Beds out front
  ['flowerBed', 8, 11],
];

/**
 * The household's rooms (D-103), each from the reserve once its member arrives: [the phase it
 * arrives at, placement]. Grandma brings her Bathroom too.
 */
const MEMBERS: readonly [number, Placement][] = [
  [2, ['nursery', 6, 5]], // the twins, behind the Living Room and the Kitchen
  [4, ['grandmasRoom', 8, 5]], // Grandma, behind the Kitchen and the Dining Room
  [4, ['bathroom', 10, 6]], // her Bathroom, behind the Dining Room
];

/** The Nursery grows into the Kids' Room 8 weeks after it's placed: Drywall's first week. */
const GROWN = 4;

/**
 * The house at a milestone: every piece, then the household's rooms from their arrivals on,
 * and any `extra` pieces. `keep` can leave a member's room out.
 */
function houseAt(
  phase: number,
  extra: readonly Placement[] = [],
  keep: (p: Placement) => boolean = () => true,
): HouseState {
  const members = MEMBERS.filter(([from]) => from <= phase)
    .map(([, p]) => p)
    .filter(keep)
    .map(([id, ...rest]): Placement => [
      id === 'nursery' && phase >= GROWN ? 'kidsRoom' : id,
      ...rest,
    ]);
  return houseFrom(CONTENT, LOT, [...PLACEMENTS, ...members, ...extra]);
}

/** A Hendersons run. Each test swaps in its own house, lot and all. */
const RUN: RunState = rules.newRun({
  seed: 'witness-hendersons',
  clientId: 'hendersons',
  crewId: 'generalContractor',
  mode: 'standard',
});

/** Every milestone, 0-based. */
const PHASES = CONTENT.balance.phases.map((_, phase) => phase);

/**
 * The rules' own check of a placement, with the piece's card in hand, or (a member's room) in
 * the reserve. A Fence is a pack (D-106), so its play carries its tiles, turned, as the board
 * sends them: at rot 0.
 */
function checkPlace(
  house: HouseState,
  [id, x, y, rot = 0, shape]: Placement,
  from: 'hand' | 'reserve' = 'hand',
) {
  const state: RunState =
    from === 'hand'
      ? { ...RUN, house, hand: [{ kind: 'piece', id }] }
      : { ...RUN, house, reserve: [{ id, arrival: 'twins' }] };
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

describe("the Hendersons' witness layout", () => {
  it('is a house a player could build, one legal placement at a time', () => {
    PLACEMENTS.forEach((placement, k) => {
      const check = checkPlace(houseFrom(CONTENT, LOT, PLACEMENTS.slice(0, k)), placement);
      const [id, x, y] = placement;
      const what = `${k + 1}. ${CONTENT.pieces[id].name} at (${x}, ${y})`;
      expect(check.legal, `${what}: ${check.reason}`).toBe(true);
    });
    // The household's rooms are reserve plays, as their members arrive.
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
      expect(lines.length).toBeGreaterThan(0);
      // "Drywall: Cozy, 8 rooms (≥ 6), ✗ 7 of 8 rooms touch 2+ rooms"
      return lines
        .filter((line) => !line.met)
        .map((line) => {
          const progress = line.progress.map((p) => (p.ok ? p.text : `✗ ${p.text}`));
          return `${rules.phaseName(phase)}: ${[line.name, ...progress].join(', ')}`;
        });
    });
    expect(misses).toEqual([]);
  });

  it('reads as a house: no second Kitchen or Dining Room, and at most two Living Rooms', () => {
    const house = houseAt(PHASES.at(-1)!);
    const count = (type: PieceId) =>
      house.pieces.filter((p) => (CONTENT.pieces[p.defId].countsAs ?? p.defId) === type).length;
    expect(count('kitchen')).toBeLessThanOrEqual(1); // an L-Kitchen counts as a Kitchen
    expect(count('livingRoom')).toBeLessThanOrEqual(2);
    expect(count('diningRoom')).toBeLessThanOrEqual(1);
    // Three Bedrooms, the Kids' Room, and Grandma's Room: 5, the top of 4–5.
    expect(count('bedroom')).toBe(5);
  });

  it('has a fenced yard of 12 or more tiles', () => {
    const yards = rules.fencedYards({ ...RUN, house: houseAt(PHASES.at(-1)!) });
    expect(Math.max(...yards)).toBeGreaterThanOrEqual(12);
  });
});

describe('one piece more or less breaks just the line it should', () => {
  it('a second Kitchen card can’t be placed: it renovates the Kitchen (an L-Kitchen counts)', () => {
    const lKitchen: Placement = ['lKitchen', 6, 11, 2]; // in front of the Bathroom and Bedroom 2
    const check = checkPlace(houseAt(PHASES.at(-1)!), lKitchen);
    expect(check.legal).toBe(false);
    expect(check.reason).toBe('The house has its Kitchen: this card extends or renovates it.');
  });

  it('a fourth Bedroom of their own is one too many: the range rises only for the household', () => {
    const bedroom: Placement = ['bedroom', 6, 11]; // in front of the Bathroom and Bedroom 2
    expect(checkPlace(houseAt(PHASES.at(-1)!), bedroom).legal).toBe(true);
    for (const phase of PHASES) {
      // 4 Bedrooms against 2–3; with the Nursery, 5 against 3–4; with Grandma's Room too, 6
      // against 4–5.
      expect(failing(houseAt(phase, [bedroom]), phase), rules.phaseName(phase)).toEqual([
        'roomForEveryone',
      ]);
    }
  });

  it('with the Nursery left in the reserve, Room for everyone fails from Framing on', () => {
    for (const phase of PHASES) {
      const house = houseAt(phase, [], ([id]) => id !== 'nursery');
      expect(failing(house, phase), rules.phaseName(phase)).toEqual(
        phase >= 2 ? ['roomForEveryone'] : [],
      );
    }
  });
});
