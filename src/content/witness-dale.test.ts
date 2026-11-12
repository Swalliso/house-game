// Dale's witness layout (implementation-plan.md §5 and §9): a house built from the real
// content, one legal placement at a time, that meets every line of his checklist at every
// milestone. It proves the checklist can be met without a solver.
//
// Dale's checklist is the house rules in his numbers (house-rules.ts), then his two
// wishes: two Home Offices, and nothing Loud touching one. Room for everyone grows with the
// household (M4b, D-103): 1–2 Bedrooms, then 2–3 and Ivy's room from Framing. Ivy's Room counts
// as a Bedroom, so the house has 2 Bedrooms of its own and, for the 3 from Framing, 2
// Bathrooms; her room is a reserve play. The Garage is the house's one Loud piece, so it sits
// at the front, away from both offices, and no Hallway links it to one (a link counts as
// touching). The street is Loud too, but the wish counts pieces only.
//
// The finished house (columns are x mod 10; the street runs below row 15):
//
//          3456789012
//      5   .....II...   I  Ivy's Room, from Framing
//      6   .....II...
//      7   ..OOBBWBB.   O  Home Offices, in the back corner
//      8   ..OOBBWBB.   B  Bedrooms, sharing the two Bathrooms (W)
//      9   ppLLLDDKKh   L  Living Room, D  Dining Room, K  Kitchen
//     10   ppLLLDDKKh   p  Patio, h  Herb Garden
//     11   ..llllGG..   G  Garage (Loud), touching the Dining Room and the Kitchen
//     12   ..llllGG..   l  Lawns
//     13   .....f==..   =  Driveways, from the street to the Garage
//     14   .....f==..   f  Flower Beds
//     15   ......==..
//            street

import { describe, expect, it } from 'vitest';
import type { ChecklistLine, HouseState, PieceId, PlaceAction, RunState } from '../rules/index.ts';
import { CONTENT, rules } from '../rules/index.ts';
import { rotateShape } from '../rules/grid.ts';
import { houseFrom, type Placement } from '../rules/testing.ts';

/** Woods in the back-left corner, a pond at the back-right, two boulders, two lone Trees. */
const LOT = [
  'TT............PP..', //  0
  'TTT..........PPP..', //  1
  'T.............PP..', //  2
  '..................', //  3
  '.........B........', //  4
  '..................', //  5
  '..............T...', //  6
  '..................', //  7
  '..................', //  8
  '..................', //  9
  '..................', // 10
  '................B.', // 11
  '..................', // 12
  '..................', // 13
  '.T................', // 14
  '..................', // 15: pieces on this row touch the street
];

/** The office in the back corner, which the last test takes away. */
const BACK_OFFICE: Placement = ['homeOffice', 5, 7];

/** The house in build order: [piece, x, y, rot]. Each room touches the house so far. */
const PLACEMENTS: readonly Placement[] = [
  ['livingRoom', 5, 9, 1], // turned to 3 × 2: the first room
  ['diningRoom', 8, 9], // beside the Living Room
  ['kitchen', 10, 9], // beside the Dining Room
  ['bedroom', 7, 7], // behind the Living and Dining Rooms
  ['bathroom', 9, 7], // between the two Bedrooms
  ['bedroom', 10, 7], // behind the Kitchen
  ['bathroom', 9, 8], // under the Bathroom, closing the gap: Ivy makes 3 Bedrooms
  ['homeOffice', 5, 8], // behind the Living Room
  BACK_OFFICE, // behind the first office: the quietest corner
  ['driveway', 9, 13, 1], // up from the street
  ['driveway', 10, 13, 1], // a two-car drive
  ['garage', 9, 11], // on the Driveways
  ['herbGarden', 12, 9, 1], // outside the Kitchen
  ['patio', 3, 9], // off the Living Room
  ['lawn', 5, 11], // the front lawn
  ['lawn', 7, 11],
  ['flowerBed', 8, 13], // along the drive
  ['flowerBed', 8, 14],
];

/** Ivy's room (D-103), from the reserve when she arrives: [the phase, placement]. */
const MEMBERS: readonly [number, Placement][] = [
  [2, ['ivysRoom', 8, 5]], // behind the first Bedroom and the Bathroom
];

/** The house at a milestone: these pieces, then the household's rooms from their arrivals on. */
const houseAt = (phase: number, placements: readonly Placement[] = PLACEMENTS): HouseState =>
  houseFrom(CONTENT, LOT, [
    ...placements,
    ...MEMBERS.filter(([from]) => from <= phase).map(([, p]) => p),
  ]);

/** The finished house, Ivy's room and all. */
const HOUSE = houseAt(CONTENT.balance.phases.length - 1);

const START = rules.newRun({
  seed: 'witness-dale',
  clientId: 'dale',
  crewId: 'generalContractor',
  mode: 'standard',
});

/** Dale's run with this house, at a milestone (0-based). */
const at = (house: HouseState, phase = 0): RunState => ({ ...START, house, phase });

/**
 * The rules' own check of placing the piece on the house from the hand. A Driveway is a pack
 * (D-106), so its play carries its tiles, turned, as the board sends them: at rot 0.
 */
function checkPlace(
  house: HouseState,
  [id, x, y, rot = 0, shape]: Placement,
  from: 'hand' | 'reserve' = 'hand',
) {
  const state: RunState =
    from === 'hand'
      ? { ...at(house), hand: [{ kind: 'piece', id }] }
      : { ...at(house), reserve: [{ id, arrival: 'ivy' }] };
  const def = CONTENT.pieces[id];
  const play: PlaceAction = def.pack
    ? { t: 'place', from, i: 0, x, y, rot: 0, shape: rotateShape(shape ?? def.shape, rot) }
    : { t: 'place', from, i: 0, x, y, rot };
  return rules.checkPlay(state, play);
}

/** The lines that don't hold, as "name: progress", so a failure says what's missing. */
const unmet = (lines: readonly ChecklistLine[]) =>
  lines.filter((l) => !l.met).map((l) => `${l.name}: ${l.progress.map((p) => p.text).join('; ')}`);

/** Pieces of a type in the house, counting cards that share it (an L-Kitchen is a Kitchen). */
const count = (house: HouseState, type: PieceId) =>
  house.pieces.filter((p) => (CONTENT.pieces[p.defId].countsAs ?? p.defId) === type).length;

describe("Dale's witness layout", () => {
  it('is built one legal placement at a time', () => {
    PLACEMENTS.forEach((placement, k) => {
      const check = checkPlace(houseFrom(CONTENT, LOT, PLACEMENTS.slice(0, k)), placement);
      expect(check.legal, `${k + 1}. ${placement.join(' ')}: ${check.reason}`).toBe(true);
    });
    // Ivy's Room is a reserve play, once she arrives.
    for (const [, placement] of MEMBERS) {
      const check = checkPlace(houseFrom(CONTENT, LOT, PLACEMENTS), placement, 'reserve');
      expect(check.legal, `${placement.join(' ')}: ${check.reason}`).toBe(true);
    }
  });

  it('meets every line of the checklist at every milestone', () => {
    // The house rules, then Dale's two wishes.
    const ids = rules.checklist(at(HOUSE)).map((l) => l.id);
    expect(ids).toEqual(expect.arrayContaining(['offices', 'quietOffice']));
    CONTENT.balance.phases.forEach(({ name }, phase) => {
      expect(unmet(rules.checklist(at(houseAt(phase), phase))), `at ${name}`).toEqual([]);
    });
  });

  it('with Ivy’s Room left in the reserve, Room for everyone fails from Framing on', () => {
    const base = houseFrom(CONTENT, LOT, PLACEMENTS);
    CONTENT.balance.phases.forEach(({ name }, phase) => {
      const broken = rules
        .checklist(at(base, phase))
        .filter((l) => !l.met)
        .map((l) => l.id);
      expect(broken, `at ${name}`).toEqual(phase >= 2 ? ['roomForEveryone'] : []);
    });
  });

  it('reads as a house: no visible repeats', () => {
    // The cards' caps (D-165), plus research.md's plausibility caps on Garages and Home
    // Offices: Dale's two offices sit right at that cap.
    const most: [PieceId, number][] = [
      ['kitchen', 1],
      ['livingRoom', 2],
      ['diningRoom', 1],
      ['garage', 1],
      ['homeOffice', 2],
    ];
    for (const [type, max] of most) expect(count(HOUSE, type), type).toBeLessThanOrEqual(max);
  });
});

describe('one piece more or less on the witness breaks one line', () => {
  const cases: { what: string; add?: Placement; drop?: Placement; breaks: string }[] = [
    { what: 'a Pool outside the offices', add: ['pool', 2, 7], breaks: 'quietOffice' },
    { what: 'demolishing the back office', drop: BACK_OFFICE, breaks: 'offices' },
  ];

  it.each(cases)('$what breaks only $breaks', ({ add, drop, breaks }) => {
    // Each change is a move a player could make on the finished house.
    if (add) expect(checkPlace(HOUSE, add).legal).toBe(true);
    if (drop) expect(rules.previewDemolish(at(HOUSE), drop[1], drop[2]).legal).toBe(true);
    const placements = add ? [...PLACEMENTS, add] : PLACEMENTS.filter((p) => p !== drop);
    CONTENT.balance.phases.forEach(({ name }, phase) => {
      const lines = rules.checklist(at(houseAt(phase, placements), phase));
      const broken = lines.filter((l) => !l.met).map((l) => l.id);
      expect(broken, `at ${name}`).toEqual([breaks]);
    });
  });

  it('a second Kitchen card can’t be placed: it renovates the Kitchen (D-165)', () => {
    expect(checkPlace(HOUSE, ['kitchen', 11, 11]).reason).toBe(
      'The house has its Kitchen: this card renovates it.',
    );
  });
});
