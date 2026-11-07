// The Hendersons' witness layout (implementation-plan.md §5, §9): a house a player could build,
// one legal placement at a time, that meets every line of their checklist at every milestone.
// It proves their specs can be met without a solver. Their checklist is the seven house rules
// in their numbers (Bedrooms 2–3, then 2–4 from Framing and 3–5 from Drywall), then Kitchen
// beside the Dining Room. Three Bedrooms is the one count inside every stage. The house also
// has a fenced yard of 12+ tiles, for the fenced-yard wish that's waiting on a decision.
//
//      0123456789012345
//    0 ..T.........PP..   L Living Room   K Kitchen      D Dining Room
//    1 ............PP..   1 2 3 Bedrooms  b Bathroom
//    2 ...........T....   f Fence         h Treehouse    w Lawn
//    3 ................   p Patio         g Herb Garden  * Flower Bed
//    4 ................   T Tree          P pond         B boulder
//    5 ....pp...ww.....
//    6 ffffpp.ggww.....   The house fills a 7 × 4 box with 8 rooms. Both Bathrooms sit
//    7 .T..LLLKKDD.....   between Bedrooms, so every room touches two others (Cozy).
//    8 hh..LLLKKDD.....
//    9 hhww11b2233.....   The play yard (columns 0–3, rows 7–10) is closed by two Fences,
//   10 ..ww11b2233.....   the house, and the lot's edge: 16 tiles, clear of the street.
//   11 ffff.*..*.......
//   12 ..............B.
//   13 ................
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
  ['herbGarden', 7, 6], // by the Kitchen
  ['lawn', 9, 5], // the back lawn
  ['flowerBed', 5, 11], // two Flower Beds out front
  ['flowerBed', 8, 11],
];

const HOUSE = houseFrom(CONTENT, LOT, PLACEMENTS);

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
 * The rules' own check of a placement, with the piece's card in hand. A Fence is a pack
 * (D-102), so its play carries its tiles, turned, as the board sends them: at rot 0.
 */
function checkPlace(house: HouseState, [id, x, y, rot = 0, shape]: Placement) {
  const state: RunState = { ...RUN, house, hand: [{ kind: 'piece', id }] };
  const def = CONTENT.pieces[id];
  const play: PlaceAction = def.pack
    ? { t: 'place', from: 'hand', i: 0, x, y, rot: 0, shape: rotateShape(shape ?? def.shape, rot) }
    : { t: 'place', from: 'hand', i: 0, x, y, rot };
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
  });

  it('meets every line of the checklist at every milestone', () => {
    const misses = PHASES.flatMap((phase) => {
      const lines = rules.checklist({ ...RUN, house: HOUSE, phase });
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
    const count = (type: PieceId) =>
      HOUSE.pieces.filter((p) => (CONTENT.pieces[p.defId].countsAs ?? p.defId) === type).length;
    expect(count('kitchen')).toBeLessThanOrEqual(1); // an L-Kitchen counts as a Kitchen
    expect(count('livingRoom')).toBeLessThanOrEqual(2);
    expect(count('diningRoom')).toBeLessThanOrEqual(1);
  });

  it('has a fenced yard of 12 or more tiles', () => {
    expect(Math.max(...rules.fencedYards({ ...RUN, house: HOUSE }))).toBeGreaterThanOrEqual(12);
  });
});

describe('one piece more or less breaks just the line it should', () => {
  it('a second Kitchen breaks One Kitchen (an L-Kitchen counts)', () => {
    const lKitchen: Placement = ['lKitchen', 6, 11, 2]; // in front of the Bathroom and Bedroom 2
    expect(checkPlace(HOUSE, lKitchen).legal).toBe(true);
    const house = houseFrom(CONTENT, LOT, [...PLACEMENTS, lKitchen]);
    for (const phase of PHASES) {
      expect(failing(house, phase), rules.phaseName(phase)).toEqual(['oneKitchen']);
    }
  });

  it('without the second Bathroom, three Bedrooms break the Bathroom rule', () => {
    const house = houseFrom(
      CONTENT,
      LOT,
      PLACEMENTS.filter(([id, x, y]) => !(id === 'bathroom' && x === 6 && y === 10)),
    );
    for (const phase of PHASES) {
      expect(failing(house, phase), rules.phaseName(phase)).toEqual(['bathrooms']);
    }
  });

  it('a fourth Bedroom is one too many until Framing raises the range', () => {
    const bedroom: Placement = ['bedroom', 6, 11]; // in front of the Bathroom and Bedroom 2
    expect(checkPlace(HOUSE, bedroom).legal).toBe(true);
    const house = houseFrom(CONTENT, LOT, [...PLACEMENTS, bedroom]);
    for (const phase of PHASES) {
      // 2–3 Bedrooms, then 2–4 from Framing and 3–5 from Drywall.
      const expected = phase < 2 ? ['roomForEveryone'] : [];
      expect(failing(house, phase), rules.phaseName(phase)).toEqual(expected);
    }
  });
});
