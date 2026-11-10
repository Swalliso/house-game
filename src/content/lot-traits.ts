// Lot traits (D-119): what a lot has that changes how you'd build there, as chips on the
// contract's card. A lot has a trait while it holds at least `min` tiles of the terrain. A trait
// with modifiers pays all run, like a crew, and stays on the checklist; one without is a hint.

import type { LotTraitDef, LotTraitId } from '../rules/index.ts';

export const LOT_TRAITS: Readonly<Record<LotTraitId, LotTraitDef>> = {
  // About one lot in four has a creek (balance.ts), and it pays: the house's bank is a decision.
  creekside: {
    id: 'creekside',
    name: 'Creekside',
    blurb: 'Only a Driveway crosses it.',
    when: { terrain: 'creek', min: 1 },
    modifiers: [{ kind: 'earn', target: { touching: { feature: 'creek' } }, pct: 50 }],
  },
  // About a fifth of lots (the median lot has 86 Tree tiles). The Count likes pieces by Trees.
  wooded: {
    id: 'wooded',
    name: 'Wooded',
    blurb:
      'Lots of Trees: they’re Quiet and give the rooms beside them views. Building over one clears it.',
    when: { terrain: 'tree', min: 100 },
    modifiers: [],
    suits: ['vladislav'],
  },
};
