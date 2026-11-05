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

  // D-018's seven milestones. The targets are written by `npm run sim -- --suggest-targets`
  // (D-044): α × the greedy bot's median cumulative Wow at each milestone. Keep the markers.
  // sim:targets:start
  phases: [
    { name: 'Groundbreaking', target: 30 },
    { name: 'Foundation', target: 200 },
    { name: 'Framing', target: 700 },
    { name: 'Roofing', target: 1600 },
    { name: 'Drywall', target: 3000 },
    { name: 'Finishes', target: 5000 },
    { name: 'Final Walkthrough', target: 8000 },
  ],
  // sim:targets:end

  // Run-level rules before crew modifiers (Appendix A · M2). The General Contractor adds a
  // reroll. earlyRewardPct scales the early-completion bonus (100 = as below).
  rules: {
    rerollsPerPhase: 1,
    demolitions: 2,
    overtime: 2,
    handSize: 3, // D-036
    earlyRewardPct: 100,
  },

  // D-040 placeholders, per week saved, by phase (the last entry repeats): +2 budget, and 10%
  // of this phase's earnings as Wow.
  early: {
    budgetPerWeek: [2],
    scorePct: [10],
  },

  // Appendix A · M3a: +3 budget per milestone met. It accrues from M2; the shop spends it in M3.
  milestoneBudget: 3,

  // §4: a fenced yard has at least 4 tiles.
  fencedYardMin: 4,

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
