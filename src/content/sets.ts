// Sets (Appendix B; values from Appendix A · M4a). M1 brings in the first two, so Charm moves
// from the start; Suite and Full House join in M4a. Mult is in hundredths: 50 is +0.5.

import type { SetDef, SetId } from '../rules/index.ts';

export const SETS: Readonly<Record<SetId, SetDef>> = {
  jackAndJill: {
    id: 'jackAndJill',
    name: 'Jack-and-Jill',
    tier: 'core',
    members: { bedroom: 2, bathroom: 1 },
    connected: true,
    hub: 'bathroom',
    points: 10,
    mult: 50,
    level: { points: 8, mult: 25 },
  },
  entertainer: {
    id: 'entertainer',
    name: 'Entertainer',
    tier: 'core',
    members: { kitchen: 1, diningRoom: 1, livingRoom: 1 },
    connected: true,
    points: 25,
    mult: 100,
    level: { points: 15, mult: 50 },
  },
};
