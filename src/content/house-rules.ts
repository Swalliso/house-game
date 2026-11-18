// The house rules (house-systems-review.md §4; D-093, option B; D-165): what every house keeps,
// whoever the client. D-165 moved most of them off the checklist and onto the rooms, where the
// board's digits show them:
//
// - On the rooms (ROOM_RULES, as Comfort): Cozy (a room earns more for each room it touches,
//   where D-101 had "every room touches two others" as a line) and A Bathroom nearby (a Bedroom
//   earns more with a Bathroom in reach, each Bathroom serving two, where D-101 had "a Bathroom
//   for every two Bedrooms").
// - On the cards: One Kitchen and A living room or two are the Kitchen's, the Dining Room's and
//   the Living Room's `perHouse` (pieces.ts): another card of a type the house has enough of
//   renovates instead of being placed (D-102).
// - On the checklist, each +0.25 Charm while it holds, like any spec (D-021, D-056), in the
//   client's numbers: Room for everyone, A compact house, and A tidy yard. A client wish that
//   repeats one becomes the client's numbers for it instead of paying twice (the Hendersons'
//   4+ Bedrooms are where their household ends up; Juniper's 4–8 rooms are her numbers for A
//   compact house).
//   - Room for everyone is built from the client's household (M4b, D-103; households.ts): its
//     Bedroom range rises by one at each end at each arrival's phase, and from each arrival on
//     it also needs one of that member's rooms. A member's room counts as a Bedroom (countsAs).
//   - A compact house: rooms that fill their box, no longer than twice its width. D-160 renamed
//     it from "Under one roof", which an outside playtester read as "everything connected", the
//     placement rule; its id stays underOneRoof.
//   - A tidy yard (6 or more yard pieces, no type 4 or more times; Fences, Driveways, and
//     Saplings count toward the 6 but never break it, so a fenced yard or a long drive is
//     always fine).

import type {
  ArrivalDef,
  HouseCondition,
  Household,
  RoomRuleDef,
  RoomRuleId,
  Selector,
  SpecDef,
} from '../rules/index.ts';

/**
 * What Room for everyone and A Bathroom nearby count as a Bedroom. Member rooms count as
 * Bedrooms (`countsAs`), so they're in it.
 */
export const BEDROOMS: Selector = { piece: 'bedroom' };

/**
 * D-165: the house rules that pay on the rooms, as Comfort. Each is a modifier every run has
 * (source `house`), and each line it adds to a room reads the rule's name.
 */
export const ROOM_RULES: Readonly<Record<RoomRuleId, RoomRuleDef>> = {
  cozy: {
    id: 'cozy',
    name: 'Cozy',
    text: 'A room touching 2 or more rooms earns +2. A Hallway’s link counts.',
    modifiers: [
      {
        kind: 'grantEffect',
        target: { property: 'room' },
        effect: {
          kind: 'conditional',
          when: { is: { touching: { property: 'room' }, min: 2 } },
          effect: { kind: 'steady', amount: 2 },
        },
      },
    ],
  },
  bathroomNearby: {
    id: 'bathroomNearby',
    name: 'A Bathroom nearby',
    text: 'A Bedroom earns +8 with a Bathroom in reach, and each Bathroom serves two.',
    modifiers: [
      {
        kind: 'grantEffect',
        target: BEDROOMS,
        effect: { kind: 'served', by: { piece: 'bathroom' }, amount: 8, capacity: 2 },
      },
    ],
  },
};

/** A client's numbers for the house rules. */
export interface HouseholdNumbers {
  /** Room for everyone: the household's starting Bedroom range and its arrivals (D-103). */
  household: Household;
  /** A compact house's rooms: at least `min`, and at most `max` if the client has a limit. */
  rooms?: { min: number; max?: number };
}

/** Milestone names for card text, in order (D-018). */
const PHASE_NAMES = [
  'Groundbreaking',
  'Foundation',
  'Framing',
  'Roofing',
  'Drywall',
  'Finishes',
  'the Final Walkthrough',
] as const;

const range = (min: number, max: number) => (min === max ? `${min}` : `${min}–${max}`);

/** The phases arrivals come at, in order, each with everyone who's arrived by then. */
function arrivalStages(h: Household): { phase: number; arrived: readonly ArrivalDef[] }[] {
  const phases = [...new Set(h.arrivals.map((a) => a.phase))].sort((a, b) => a - b);
  return phases.map((phase) => ({ phase, arrived: h.arrivals.filter((a) => a.phase <= phase) }));
}

/**
 * Room for everyone's condition (D-103): the Bedroom range, one more at each end for each
 * arrival from its phase on, and from then one of each arrived member's rooms.
 */
export function roomForEveryone(h: Household): HouseCondition {
  const [min, max] = h.bedrooms;
  const stages = arrivalStages(h);
  if (stages.length === 0) return { count: BEDROOMS, min, max };
  return {
    stages: [
      { fromPhase: 0, condition: { count: BEDROOMS, min, max } },
      ...stages.map(({ phase, arrived }) => ({
        fromPhase: phase,
        condition: {
          and: [
            { count: BEDROOMS, min: min + arrived.length, max: max + arrived.length },
            ...arrived.map((a): HouseCondition => ({ count: { piece: a.room }, min: 1 })),
          ],
        },
      })),
    ],
  };
}

/** "the twins’ room", "Grandma’s room". */
function memberRoom(a: ArrivalDef): string {
  const name = a.name.startsWith('The ') ? `the ${a.name.slice(4)}` : a.name;
  return `${name}${name.endsWith('s') ? '’' : '’s'} room`;
}

/**
 * "Bedrooms for the household: 2–3 to start, then one more for each arrival, and each arrival
 * has their own room: 3–4 and the twins’ room from Framing, 4–5 and Grandma’s room from Drywall."
 */
function bedroomText(h: Household): string {
  const [min, max] = h.bedrooms;
  const head = `Bedrooms for the household: ${range(min, max)}`;
  const stages = arrivalStages(h);
  if (stages.length === 0) return `${head}.`;
  const later = stages.map(({ phase, arrived }) => {
    const k = arrived.length;
    const rooms = arrived.filter((a) => a.phase === phase).map(memberRoom);
    return `${range(min + k, max + k)} and ${rooms.join(' and ')} from ${PHASE_NAMES[phase]}`;
  });
  const tail = later.length === 1 ? later[0] : `${later.slice(0, -1).join(', ')}, ${later.at(-1)}`;
  return `${head} to start, then one more for each arrival, and each arrival has their own room: ${tail}.`;
}

/** The house rules on the checklist (D-165: three of D-101's seven), in checklist order. */
export function houseRules(n: HouseholdNumbers): SpecDef[] {
  const rooms = n.rooms ?? { min: 4 };
  const bedrooms = roomForEveryone(n.household);
  const roomsText =
    rooms.max === undefined ? `${rooms.min}+ rooms` : `${rooms.min}–${rooms.max} rooms`;
  return [
    {
      id: 'roomForEveryone',
      name: 'Room for everyone',
      group: 'household',
      condition: bedrooms,
      text: bedroomText(n.household),
    },
    {
      // D-160: its id from when it was "Under one roof", so saves, run codes and the sim's
      // records keep their key.
      id: 'underOneRoof',
      name: 'A compact house',
      group: 'shape',
      condition: {
        outline: { minRooms: rooms.min, maxRooms: rooms.max, minFillPct: 60, maxAspect: 2 },
      },
      text: `${roomsText} that fill at least 60% of the box around them, and the box is no longer than twice its width.`,
    },
    {
      id: 'tidyYard',
      name: 'A tidy yard',
      group: 'yard',
      condition: {
        variety: {
          of: { any: [{ property: 'yard' }, { property: 'outbuilding' }] },
          min: 6,
          maxEach: 3,
          exempt: { piece: ['fence', 'driveway', 'sapling'] },
        },
      },
      text: '6 or more yard pieces, and no yard type stands 4 or more times. Fences, Driveways, and Saplings never break it.',
    },
  ];
}
