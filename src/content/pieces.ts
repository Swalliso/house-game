// The pieces (Appendix B of implementation-plan.md). M1's slice: six pieces as seven cards.
// Numbers are placeholders for the sim to tune (from M2).

import type { PieceDef, PieceId } from '../rules/index.ts';

export const PIECES: Readonly<Record<PieceId, PieceDef>> = {
  bedroom: {
    id: 'bedroom',
    name: 'Bedroom',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Quiet'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 3 },
      {
        kind: 'neighbor',
        match: { any: [{ feature: 'tree' }, { tag: 'Quiet' }] },
        amount: 1,
        max: 3,
      },
      { kind: 'neighbor', match: { tag: 'Loud' }, amount: -2 }, // the street is Loud
    ],
  },
  bathroom: {
    id: 'bathroom',
    name: 'Bathroom',
    tier: 'core',
    category: 'indoor',
    shape: ['#'],
    tags: ['Wet'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [
      // Earns nothing alone; capped at one Bedroom because Jack-and-Jill pays for two (D-046).
      { kind: 'neighbor', match: { piece: 'bedroom' }, amount: 3, max: 1 },
      { kind: 'neighbor', match: { piece: 'kitchen' }, amount: -2 },
    ],
  },
  // Kitchen and L-Kitchen are two cards sharing a type. Both earn per touching Dining Room;
  // the Herb Garden joins that list when it arrives in M2.
  kitchen: {
    id: 'kitchen',
    name: 'Kitchen',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Social'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [{ kind: 'neighbor', match: { piece: 'diningRoom' }, amount: 2 }],
  },
  lKitchen: {
    id: 'lKitchen',
    name: 'L-Kitchen',
    tier: 'core',
    category: 'indoor',
    countsAs: 'kitchen',
    shape: ['#.', '##'],
    tags: ['Social'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [{ kind: 'neighbor', match: { piece: 'diningRoom' }, amount: 2 }],
  },
  diningRoom: {
    id: 'diningRoom',
    name: 'Dining Room',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Social'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [
      { kind: 'aura', match: { piece: ['kitchen', 'livingRoom'] }, scope: 'adjacent', pct: 50 },
    ],
  },
  livingRoom: {
    id: 'livingRoom',
    name: 'Living Room',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##', '##'],
    tags: ['Social'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [{ kind: 'neighbor', match: { property: 'viewSource' }, amount: 2, max: 3 }],
  },
  lawn: {
    id: 'lawn',
    name: 'Lawn',
    tier: 'core',
    category: 'yard',
    shape: ['##', '##'],
    tags: ['Outdoor', 'Green'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 1 },
      { kind: 'neighbor', match: { piece: 'lawn' }, amount: 1, max: 4 },
    ],
  },
};
