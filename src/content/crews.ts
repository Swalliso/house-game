// Crews (Appendix B · Crews; D-012): picked at the start of a run. The General Contractor is
// the default crew from M2; M4b adds the Landscaper and the Architect. The numbers are from M4b's
// sim (D-109): at sets +50% and yard draws +50%, the Architect won 61% and the Landscaper 28%
// against the General Contractor's 38%; at these, 45.5%, 39.7%, and 41.5%. With the draw's
// two rows (D-121) the Landscaper's yard draws came back as a third Layout card, which can't
// crowd out rooms: they have their own row.
//
// D-171: each crew adds its own free build to the stock everyone gets (D-160, D-169), and the
// Handyman joins. A card from a crew's `stock` waits in the reserve's extra slots each time the
// standing stock comes, one at a time; the Landscaper's took the place of its starting Sapling
// and Fence. In the sim (600 runs a crew on the four-week targets, before the re-fit) the
// General Contractor's Weekend Crew won 56.7%, the Landscaper's yard piece 60.3%, the
// Architect's Addition 57.7% and the Handyman's free installs 61.0%, from 47.7%, 46.3% and
// 44.5%. What was tried and left out is in D-171: a free yard piece every week won 90.8%, and a
// small room each milestone for the General Contractor 80.2%.

import type { CrewDef, CrewId } from '../rules/index.ts';

export const CREWS: Readonly<Record<CrewId, CrewDef>> = {
  generalContractor: {
    id: 'generalContractor',
    name: 'General Contractor',
    tier: 'core',
    blurb: 'One extra reroll every phase, and a Weekend Crew with each change order.',
    modifiers: [{ kind: 'rule', key: 'rerollsPerPhase', add: 1 }],
    // Extra hands when the plans change: three a run, from the third milestone, so a first
    // job's guided opening never sees one.
    orderTool: 'weekendCrew',
  },
  landscaper: {
    id: 'landscaper',
    name: 'Landscaper',
    tier: 'core',
    blurb:
      'Yard pieces earn half again as much, and a third Layout card comes every week. A free yard piece each milestone.',
    modifiers: [
      { kind: 'earn', target: { property: 'yard' }, pct: 50 },
      { kind: 'rule', key: 'layoutRow', add: 1 },
    ],
    // Eight for seven milestones, so no run sees one twice.
    stock: [
      'lawn',
      'flowerBed',
      'patio',
      'herbGarden',
      'treehouse',
      'greenhouse',
      'doghouse',
      'sapling',
    ],
  },
  architect: {
    id: 'architect',
    name: 'Architect',
    tier: 'core',
    blurb: 'An Addition each milestone grows a room. Special pieces show up in the draw.',
    modifiers: [
      // Weight 0 + 5 for the four Core special pieces (Appendix A · M4a: "special rooms at weight 5").
      { kind: 'drawWeight', target: { piece: ['playroom', 'library', 'mudroom', 'pool'] }, add: 5 },
      { kind: 'setBonus', pct: 10 },
    ],
    stock: ['addition'],
  },
  handyman: {
    id: 'handyman',
    name: 'Handyman',
    tier: 'core',
    blurb: 'Fixtures from your hand go in without using your week.',
    modifiers: [{ kind: 'rule', key: 'freeInstalls', add: 1 }],
  },
};
