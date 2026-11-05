// Crews (Appendix B · Crews; D-012). The General Contractor is the default crew from M2 and
// the only one until M4b, which adds the Landscaper and the Architect and the crew pick.

import type { CrewDef, CrewId } from '../rules/index.ts';

export const CREWS: Readonly<Record<CrewId, CrewDef>> = {
  generalContractor: {
    id: 'generalContractor',
    name: 'General Contractor',
    tier: 'core',
    blurb: 'Steady hands. One extra reroll every phase.',
    modifiers: [{ kind: 'rule', key: 'rerollsPerPhase', add: 1 }],
  },
};
