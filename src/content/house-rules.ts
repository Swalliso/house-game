// The house rules (house-systems-review.md §4; D-093, option B): seven lines every client's
// checklist starts with, written in that client's numbers. Each adds +0.25 Charm while it
// holds, like any spec (D-021, D-056). A client wish that repeats a house rule becomes the
// client's numbers for it instead of paying twice (the Hendersons' 4+ Bedrooms and 2+
// Bathrooms are where their household ends up; Juniper's 4–8 rooms is her Under one roof).
//
// - The household (D-093's option 1): Room for everyone, a Bathroom for every two Bedrooms,
//   One Kitchen, and a living room or two. Each has a floor, and all but the Bathroom rule a
//   ceiling, so a second Kitchen loses a rule; a room type at its ceiling can renovate instead.
// - The shape: Under one roof (a filled box no longer than twice its width) and Cozy (every
//   room touches two others).
// - The yard: a tidy yard (6 or more yard pieces, no type 4 or more times; Fences, Driveways,
//   and Saplings count toward the 6 but never break it, so a fenced yard or a long drive is
//   always fine).

import type { HouseCondition, Selector, SpecDef } from '../rules/index.ts';

/** What Room for everyone and the Bathroom rule count as a Bedroom. */
export const BEDROOMS: Selector = { piece: 'bedroom' };

/** One stage of a household's Bedroom range, from a milestone (0-based) on. */
export interface BedroomStage {
  fromPhase: number;
  min: number;
  max: number;
}

/** A client's numbers for the house rules. */
export interface HouseholdNumbers {
  /** Room for everyone: the Bedroom range, rising as the household grows. */
  bedrooms: readonly BedroomStage[];
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

/** "Bedrooms for the household: 2–3, then 2–4 from Framing and 3–5 from Drywall." */
function bedroomText(stages: readonly BedroomStage[]): string {
  const [first, ...rest] = stages;
  const head = `Bedrooms for the household: ${range(first!.min, first!.max)}`;
  if (rest.length === 0) return `${head}.`;
  const later = rest.map((s) => `${range(s.min, s.max)} from ${PHASE_NAMES[s.fromPhase]}`);
  const tail =
    later.length === 1 ? later[0] : `${later.slice(0, -1).join(', ')} and ${later.at(-1)}`;
  return `${head}, then ${tail}.`;
}

/** The seven house rules, in checklist order. */
export function houseRules(n: HouseholdNumbers): SpecDef[] {
  const rooms = n.rooms ?? { min: 4 };
  const bedrooms: HouseCondition =
    n.bedrooms.length === 1
      ? { count: BEDROOMS, min: n.bedrooms[0]!.min, max: n.bedrooms[0]!.max }
      : {
          stages: n.bedrooms.map((s) => ({
            fromPhase: s.fromPhase,
            condition: { count: BEDROOMS, min: s.min, max: s.max },
          })),
        };
  const roomsText =
    rooms.max === undefined ? `${rooms.min}+ rooms` : `${rooms.min}–${rooms.max} rooms`;
  return [
    {
      id: 'roomForEveryone',
      name: 'Room for everyone',
      group: 'household',
      condition: bedrooms,
      text: bedroomText(n.bedrooms),
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
      text: '6 or more yard pieces, and no yard type stands 4 or more times.',
    },
  ];
}

/**
 * Until M4b's arrivals, a household's Bedroom range steps up at Framing and Drywall as the
 * systems review's option A did (2–3, then 2–4, then 3–5 for the Hendersons): the ceiling
 * rises at Framing, and both ends at Drywall.
 */
export function steppedBedrooms(min: number, max: number): BedroomStage[] {
  return [
    { fromPhase: 0, min, max },
    { fromPhase: 2, min, max: max + 1 },
    { fromPhase: 4, min: min + 1, max: max + 2 },
  ];
}
