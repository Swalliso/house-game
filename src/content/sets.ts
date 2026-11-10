// Sets (Appendix B; values from Appendix A · M4a): a poker-hand ladder, where both the Points
// and the Mult rise with how hard the set is (D-056). M1 brought in Jack-and-Jill and the
// Entertainer, so Charm moved from the start; M4a adds the Suite and Full House, and holds the
// Entertainer to one per house (D-093). Mult is in hundredths: 50 is +0.5.

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
    // One per house (D-093): a second Kitchen, Dining Room, and Living Room earn their own
    // Comfort, but no second Entertainer.
    maxInstances: 1,
    points: 25,
    mult: 100,
    level: { points: 15, mult: 50 },
  },
  suite: {
    id: 'suite',
    name: 'Suite',
    tier: 'core',
    members: { bedroom: 1, bathroom: 1, closet: 1 },
    connected: true,
    points: 15,
    mult: 50,
    level: { points: 10, mult: 25 },
  },
  // One of each of the 9 Core indoor types; they needn't touch. The game's one set Sparkle.
  // ×1.5 since D-140 (was ×2): while the Garage could only be built by the street or a Driveway,
  // greedy held this set in 1.5% of runs. Built like any room, it's held in about 20%, from a
  // median week 23, and at ×2 those runs' final Wow nearly doubled (×1.95 against the same seeds
  // before); at ×1.5 it's about ×1.5. A Garage nothing reaches still counts (D-070).
  fullHouse: {
    id: 'fullHouse',
    name: 'Full House',
    tier: 'core',
    members: {
      bedroom: 1,
      bathroom: 1,
      kitchen: 1,
      diningRoom: 1,
      livingRoom: 1,
      closet: 1,
      hallway: 1,
      garage: 1,
      homeOffice: 1,
    },
    connected: false,
    maxInstances: 1,
    points: 40,
    mult: 100,
    times: 150,
    level: { points: 20, mult: 50 },
  },
};
