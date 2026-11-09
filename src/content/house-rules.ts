// The house rules (house-systems-review.md §4; D-093, option B): seven lines every client's
// checklist starts with, written in that client's numbers. Each adds +0.25 Charm while it
// holds, like any spec (D-021, D-056). A client wish that repeats a house rule becomes the
// client's numbers for it instead of paying twice (the Hendersons' 4+ Bedrooms and 2+
// Bathrooms are where their household ends up; Juniper's 4–8 rooms is her Under one roof).
//
// - The household (D-093's option 1): Room for everyone, a Bathroom for every two Bedrooms,
//   One Kitchen, and a living room or two. Each has a floor, and all but the Bathroom rule a
//   ceiling, so a second Kitchen loses a rule; a room type at its ceiling can renovate instead.
//   Room for everyone is built from the client's household (M4b, D-103; households.ts): its
//   Bedroom range rises by one at each end at each arrival's phase, and from each arrival on it
//   also needs one of that member's rooms. A member's room counts as a Bedroom (countsAs).
// - The shape: Under one roof (a filled box no longer than twice its width) and Cozy (every
//   room touches two others).
// - The yard: a tidy yard (6 or more yard pieces, no type 4 or more times; Fences, Driveways,
//   and Saplings count toward the 6 but never break it, so a fenced yard or a long drive is
//   always fine).

import type { ArrivalDef, HouseCondition, Household, Selector, SpecDef } from '../rules/index.ts';

/**
 * What Room for everyone and the Bathroom rule count as a Bedroom. Member rooms count as
 * Bedrooms (`countsAs`), so they're in it.
 */
export const BEDROOMS: Selector = { piece: 'bedroom' };

/** A client's numbers for the house rules. */
export interface HouseholdNumbers {
  /** Room for everyone: the household's starting Bedroom range and its arrivals (D-103). */
  household: Household;
  /** Under one roof's rooms: at least `min`, and at most `max` if the client has a limit. */
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

/** The seven house rules, in checklist order. */
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
      id: 'bathrooms',
      name: 'A Bathroom for every two Bedrooms',
      group: 'household',
      condition: { ratio: { count: { piece: 'bathroom' }, per: BEDROOMS, every: 2, min: 1 } },
      text: 'A Bathroom for every two Bedrooms (at least one).',
    },
    {
      id: 'oneKitchen',
      name: 'One Kitchen',
      group: 'household',
      condition: { count: { piece: 'kitchen' }, min: 1, max: 1 },
      text: 'Exactly one Kitchen. An L-Kitchen counts.',
    },
    {
      id: 'livingRooms',
      name: 'A living room or two',
      group: 'household',
      condition: {
        and: [
          { count: { piece: 'livingRoom' }, min: 1, max: 2 },
          { count: { piece: 'diningRoom' }, max: 1 },
        ],
      },
      text: '1–2 Living Rooms, and at most one Dining Room.',
    },
    {
      id: 'underOneRoof',
      name: 'Under one roof',
      group: 'shape',
      condition: {
        outline: { minRooms: rooms.min, maxRooms: rooms.max, minFillPct: 60, maxAspect: 2 },
      },
      text: `${roomsText}, filling at least 60% of their box, and the box is no longer than twice its width.`,
    },
    {
      id: 'cozy',
      name: 'Cozy',
      group: 'shape',
      condition: {
        and: [
          { count: { property: 'room' }, min: 6 },
          {
            none: {
              all: [{ property: 'room' }, { not: { touching: { property: 'room' }, min: 2 } }],
            },
          },
        ],
      },
      text: '6+ rooms, each touching 2 or more rooms. A Hallway’s link counts as touching.',
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
