// The households (M4b, D-099; house-systems-review.md §4, "Filling up: the household"): who
// each house is for, and who moves in mid-run. Arrivals are fixed for the client, shown on the
// job board from week 1, and can't be declined. In the first week of an arrival's phase (after
// transforms, before the draw) the member's cards go into the reserve's extra slots. From then
// on Room for everyone (house-rules.ts builds it from these) counts one more Bedroom at each end
// of its range and needs one of the member's rooms. The member rooms are in pieces.ts.
//
// Each arrival's `text` says who and what, not when: the job board adds the phase's name.
// Ranges: the Hendersons' are the systems review's (2–3, then 3–4 from Framing and 4–5 from
// Drywall, where their 4+ Bedrooms and 2+ Bathrooms end up). The others start at M4a's 1–2 and
// end at 2–3 after their one arrival (M4a's stepped range ended at 2–4).

import type { ClientId, Household } from '../rules/index.ts';

export const HOUSEHOLDS: Readonly<Record<ClientId, Household>> = {
  hendersons: {
    bedrooms: [2, 3],
    arrivals: [
      {
        id: 'twins',
        name: 'The twins',
        phase: 2, // Framing
        cards: ['nursery'],
        room: ['nursery', 'kidsRoom'],
        text: 'The twins arrive, with a Nursery that grows into a Kids’ Room.',
      },
      {
        id: 'grandma',
        name: 'Grandma',
        phase: 4, // Drywall
        cards: ['grandmasRoom', 'bathroom'],
        room: ['grandmasRoom'],
        text: 'Grandma moves in, with her own room and a Bathroom.',
      },
    ],
  },
  vladislav: {
    bedrooms: [1, 2],
    arrivals: [
      {
        id: 'renfield',
        name: 'Renfield',
        phase: 2, // Framing
        cards: ['renfieldsRoom'],
        room: ['renfieldsRoom'],
        text: 'Renfield, the Count’s man, moves in. He keeps to the dark middle of the house.',
      },
    ],
  },
  barkers: {
    bedrooms: [1, 2],
    arrivals: [
      {
        id: 'nana',
        name: 'Nana',
        phase: 4, // Drywall
        cards: ['nanasRoom'],
        room: ['nanasRoom'],
        text: 'Nana moves in, and wants the dogs nearby.',
      },
    ],
  },
  juniper: {
    bedrooms: [1, 2],
    arrivals: [
      {
        id: 'rowan',
        name: 'Rowan',
        phase: 4, // Drywall
        cards: ['rowansStudio'],
        room: ['rowansStudio'],
        text: 'Rowan moves in, and paints: a studio with a view.',
      },
    ],
  },
  dale: {
    bedrooms: [1, 2],
    arrivals: [
      {
        id: 'ivy',
        name: 'Ivy',
        phase: 2, // Framing
        cards: ['ivysRoom'],
        room: ['ivysRoom'],
        text: 'Dale’s daughter Ivy comes to live with him, and does her homework by his office.',
      },
    ],
  },
};
