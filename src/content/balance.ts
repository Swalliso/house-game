// Every tunable number, in one place (implementation-plan.md §3; D-029, D-046). All of these
// are placeholders: the sim sets real milestone targets from M2 (D-044), and playtests tune
// the rest.

import type { Balance } from '../rules/index.ts';

export const BALANCE: Balance = {
  // Appendix A · M1. Width and height are separate so a playtest can try 20×20 or 24×18.
  lot: {
    width: 24,
    height: 24,
    woodsClusters: [3, 4],
    woodsClusterSize: [15, 30],
    loneTrees: [6, 10],
    creekPct: 70,
    // Keeps the creek in the back part of the lot, so the street side has room for the house.
    creekStreetGap: 6,
    pondSize: [2, 3],
    boulders: [6, 10],
    sunnyRows: 4,
    minFreePct: 85,
    minFreeStreetTiles: 10,
    minStreetSidePct: 60,
    maxAttempts: 50,
  },

  weeksPerPhase: 4, // D-042

  // M1's three milestones (D-018's first three phases), with hand-set rising targets. From a
  // throwaway greedy bot on 120 seeds (median cumulative Wow 57, 317, and 1,017 at weeks 4, 8,
  // and 12): about 0.55, 0.65, and 0.7 of it, so the first milestone nearly always passes. The
  // sim replaces them in M2.
  phases: [
    { name: 'Groundbreaking', target: 30 },
    { name: 'Foundation', target: 200 },
    { name: 'Framing', target: 700 },
  ],

  handSize: 3, // D-036

  // D-055: draw-weight percentages for complexity 1, 2, and 3, by phase; the last row repeats.
  complexityPct: [
    [100, 30, 5],
    [100, 60, 25],
    [100, 85, 60],
    [100, 100, 100],
  ],

  // The run-end verdict by final score, as a percentage of the last target (§12).
  verdicts: [
    { name: 'Fixer-Upper', minPctOfTarget: 0 },
    { name: 'Starter Home', minPctOfTarget: 100 },
    { name: 'Charmer', minPctOfTarget: 125 },
    { name: 'Showhome', minPctOfTarget: 150 },
    { name: 'Dream Home', minPctOfTarget: 200 },
  ],
};
