// Every tunable number, in one place (implementation-plan.md §3; D-029, D-046). All of these
// are placeholders: the sim sets real milestone targets from M2 (D-044), and playtests tune
// the rest.

import type { Balance, Rarity } from '../rules/index.ts';

/** Shop prices by rarity (Appendix A · M3a placeholders). Content defs read them from here. */
export const PRICES: {
  readonly blueprint: Readonly<Record<Rarity, number>>;
  readonly fixture: Readonly<Record<Rarity, number>>;
} = {
  blueprint: { common: 4, uncommon: 6, rare: 8 },
  fixture: { common: 2, uncommon: 3, rare: 4 },
};

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
  // From `npm run sim -- --suggest-targets --runs 200` (D-072): α × the greedy bot's
  // median cumulative Wow at each milestone, with α set so greedy's estimated survival
  // follows 100%, 98%, 95%, 85%, 72%, 58%, 45%.
  phases: [
    { name: 'Groundbreaking', target: 15 }, // median 42, α 0.36
    { name: 'Foundation', target: 120 }, // median 167, α 0.72
    { name: 'Framing', target: 270 }, // median 475, α 0.57
    { name: 'Roofing', target: 650 }, // median 952, α 0.68
    { name: 'Drywall', target: 1350 }, // median 1715, α 0.79
    { name: 'Finishes', target: 2900 }, // median 2808, α 1.03
    { name: 'Final Walkthrough', target: 5300 }, // median 4257, α 1.25
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
    // Slots (Appendix A · M3a); company upgrades add one of each in M3b.
    reserveSlots: 2,
    supplySlots: 3,
    blueprintSlots: 4,
    shopPricePct: 100, // Supplier Discount: −25
    specBonus: 25, // +0.25 Mult per spec met (M4a; Dream Home raises it)
    interestMax: 0, // Savings Account: +3
  },

  // D-040 placeholders, per week saved, by phase (the last entry repeats): +2 budget, and 10%
  // of this phase's earnings as Wow.
  early: {
    budgetPerWeek: [2],
    scorePct: [10],
  },

  // Appendix A · M3a: +3 budget per milestone met.
  milestoneBudget: 3,

  // The shop (D-051, Appendix A · M3a). Shop k opens after milestone k, for k = 1–6.
  shop: {
    stock: [
      // Shop 1: 2 blueprints (Common only) and 2 cards; M3b adds the free Housewarming crate.
      { blueprints: 2, cards: 2, rarity: [100, 0, 0] },
      // Shops 2–3, then 4–6. Rarity weights: Common, Uncommon, Rare.
      { blueprints: 3, cards: 2, rarity: [70, 25, 5] },
      { blueprints: 3, cards: 2, rarity: [70, 25, 5] },
      { blueprints: 3, cards: 2, rarity: [55, 33, 12] },
    ],
    // A card slot is a fixture half the time, otherwise a special piece.
    cardFixturePct: 50,
    piecePrice: 3,
    salePct: 50, // one random good per visit, half price
    sellPct: 50, // selling pays half the price, rounded down
    refresh: { base: 2, step: 1 }, // 2, then 3, 4, …; back to 2 next visit
    services: {
      reroll: { base: 1, step: 1, max: 4 },
      demolition: { base: 1, step: 1, max: 4 },
      strike: { base: 2, step: 1, max: 5 }, // D-076, D-084
    },
    skipReward: 1, // leaving without buying anything
    strikeMinTypes: 8,
  },

  // A fenced yard has at least 10 tiles (D-069, amending D-046's 4, confirmed 2026-11-05): at
  // 4, one Fence closes a pocket in a notch of the house; at 10 the sim's enclosure probe says
  // a yard costs 2–3 Fence cards, as §8 asks, and a Fence then always reaches its +6 cap.
  fencedYardMin: 10,

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
