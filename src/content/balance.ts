// Every tunable number, in one place (implementation-plan.md §3; D-029, D-046). All of these
// are placeholders: the sim sets real milestone targets from M2 (D-044), and playtests tune
// the rest.

import type { Balance, Rarity } from '../rules/index.ts';

/** Shop prices by rarity (Appendix A · M3a placeholders). Content defs read them from here. */
export const PRICES: {
  readonly blueprint: Readonly<Record<Rarity, number>>;
  readonly fixture: Readonly<Record<Rarity, number>>;
  readonly tool: Readonly<Record<Rarity, number>>;
  readonly crate: number;
} = {
  blueprint: { common: 4, uncommon: 6, rare: 8 },
  fixture: { common: 2, uncommon: 3, rare: 4 },
  tool: { common: 2, uncommon: 3, rare: 4 },
  crate: 4,
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
    // Finds (Appendix B, M3b): one Old Shed and one or two Time Capsules, placed after the
    // checks on free ground, at least this many rows back from the street.
    oldSheds: [1, 1],
    timeCapsules: [1, 2],
    findStreetGap: 4,
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
    { name: 'Foundation', target: 150 }, // median 220, α 0.68
    { name: 'Framing', target: 470 }, // median 582, α 0.81
    { name: 'Roofing', target: 1050 }, // median 1408, α 0.75
    { name: 'Drywall', target: 2250 }, // median 2693, α 0.84
    { name: 'Finishes', target: 4950 }, // median 4459, α 1.11
    { name: 'Final Walkthrough', target: 9750 }, // median 7528, α 1.30
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

  // Appendix A · M3a's +3 budget per milestone, raised to 4 (D-085): with 3 the greedy bot earned
  // a median 25 a run against the plan's 30–40, so the shop was too tight to plan around.
  milestoneBudget: 4,

  // The shop (D-051, Appendix A · M3a). Shop k opens after milestone k, for k = 1–6.
  shop: {
    stock: [
      // Shop 1: 2 blueprints (Common only), 2 cards, and the free Housewarming crate (pick 1 of
      // 3 Common blueprints), which teaches blueprints with something in hand.
      {
        blueprints: 2,
        cards: 2,
        tools: 0,
        crates: 0,
        upgrades: 0,
        housewarming: 3,
        rarity: [100, 0, 0],
      },
      // Shops 2–3, then 4–6: 3 blueprints, 2 cards, 2 tools, a crate, and an upgrade.
      // Rarity weights: Common, Uncommon, Rare.
      {
        blueprints: 3,
        cards: 2,
        tools: 2,
        crates: 1,
        upgrades: 1,
        housewarming: 0,
        rarity: [70, 25, 5],
      },
      {
        blueprints: 3,
        cards: 2,
        tools: 2,
        crates: 1,
        upgrades: 1,
        housewarming: 0,
        rarity: [70, 25, 5],
      },
      {
        blueprints: 3,
        cards: 2,
        tools: 2,
        crates: 1,
        upgrades: 1,
        housewarming: 0,
        rarity: [55, 33, 12],
      },
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
    crateOptions: 3, // open a crate, keep 1 of 3
    interestPer: 5, // Savings Account: +1 per 5 held, up to the interestMax rule
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
