// Crews (Appendix B · Crews; D-012): picked at the start of a run. The General Contractor is
// the default crew from M2; M4b adds the Landscaper and the Architect. A crew's starting cards
// (`startReserve`) wait in the reserve's extra slots from week 1.

import type { CrewDef, CrewId } from '../rules/index.ts';

export const CREWS: Readonly<Record<CrewId, CrewDef>> = {
  generalContractor: {
    id: 'generalContractor',
    name: 'General Contractor',
    tier: 'core',
    blurb: 'Steady hands. One extra reroll every phase.',
    modifiers: [{ kind: 'rule', key: 'rerollsPerPhase', add: 1 }],
  },
  landscaper: {
    id: 'landscaper',
    name: 'Landscaper',
    tier: 'core',
    blurb: 'Yard pieces show up more and earn more. Starts with a Sapling and a Fence.',
    modifiers: [
      { kind: 'drawWeight', target: { property: 'yard' }, pct: 50 },
      { kind: 'earn', target: { property: 'yard' }, pct: 25 },
    ],
    startReserve: ['sapling', 'fence'],
  },
  architect: {
    id: 'architect',
    name: 'Architect',
    tier: 'core',
    blurb: 'Special rooms show up in the weekly draw, and every set pays 50% more.',
    modifiers: [
      // Weight 0 + 5 for the four Core special pieces (Appendix A · M4a: "special rooms at weight 5").
      { kind: 'drawWeight', target: { piece: ['playroom', 'library', 'mudroom', 'pool'] }, add: 5 },
      { kind: 'setBonus', pct: 50 },
    ],
  },
};
