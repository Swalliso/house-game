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
    // D-119: about one lot in four, a Creekside lot. A creek lot keeps its pond half the time; a
    // lot without a creek always has one.
    creekPct: 25,
    pondPctCreek: 50,
    // Keeps the creek in the back part of the lot, so the street side has room for the house.
    creekStreetGap: 6,
    pondSize: [2, 3],
    boulders: [6, 10],
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
  // From `npm run sim -- --suggest-targets --runs 2000 --crew all` (D-072, D-089, D-123): α × the
  // greedy bot's median cumulative Wow at each milestone on seeds sim-*, with α set so greedy's
  // estimated survival follows 100%, 98%, 95%, 85%, 72%, 58%, 45%. Held out (2,000 runs on
  // check-*), greedy won 44.0% against the fit's 46.6%, so the fit is used as it is. Each
  // client's targetPct scales these.
  phases: [
    { name: 'Groundbreaking', target: 20 }, // median 95, α 0.21
    { name: 'Foundation', target: 560 }, // median 728, α 0.77
    { name: 'Framing', target: 1750 }, // median 2395, α 0.73
    { name: 'Roofing', target: 4850 }, // median 5127, α 0.95
    { name: 'Drywall', target: 10200 }, // median 9604, α 1.06
    { name: 'Finishes', target: 18800 }, // median 15782, α 1.19
    { name: 'Final Walkthrough', target: 32600 }, // median 26151, α 1.25
  ],
  // sim:targets:end

  // Run-level rules before crew modifiers (Appendix A · M2). The General Contractor adds a
  // reroll. earlyRewardPct scales the early-completion bonus (100 = as below).
  rules: {
    rerollsPerPhase: 1,
    demolitions: 2,
    overtime: 2,
    // The weekly draw's two rows (D-121): 2 Rooms cards and 2 Layout cards a week.
    roomsRow: 2,
    layoutRow: 2,
    earlyRewardPct: 100,
    // Slots (Appendix A · M3a); company upgrades add one of each in M3b.
    reserveSlots: 2,
    supplySlots: 3,
    blueprintSlots: 4,
    shopPricePct: 100, // Supplier Discount: −25
    specBonus: 25, // +0.25 Mult per spec met (M4a; Dream Home raises it)
    interestMax: 0, // Savings Account: +3
  },

  // D-040, per week saved, by phase (the last entry repeats): +4 budget, and 30% of this phase's
  // earnings as Wow. In M4b's sim (1,000 held-out runs), greedy that always completes early won
  // 9.7 points less than one that never does at +2 budget, 5.7 at +4, and 1.7 at +6; more Wow
  // (40%) didn't help.
  early: {
    budgetPerWeek: [4],
    scorePct: [30],
  },

  // Appendix A · M3a's +3 budget per milestone, raised to 4 (D-085): with 3 the greedy bot earned
  // a median 25 a run against the plan's 30–40, so the shop was too tight to plan around.
  milestoneBudget: 4,

  // D-145: no shop follows the last milestone, so the budget held when it's met (its own payout
  // and any early bonus included) pays Wow: 100 each. It's paid after the target is met, so it
  // moves the verdict and the company's best, never a loss into a win. Greedy holds a median 10
  // at the end of a win, about +1,000 on a final score near 37,000.
  leftoverBudgetWow: 100,

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
    strikeMinTypes: { rooms: 5, layout: 4 }, // in each row (D-121)
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

  // Renovate (house-systems-review.md §4, D-093 option B): a room card whose type is at its
  // limit levels up a room of that type instead: +4 Comfort a level, up to 2 levels.
  renovate: { pointsPerLevel: 4, maxLevel: 2 },
  // A type at its limit draws at half weight while it stays there (D-043, amended by D-093).
  drawAtLimitPct: 50,
  // A card with no play is swapped for one from its row, trying up to 3 cards (D-121).
  swapTries: 3,

  // The job board (Appendix A · M4a; D-026, D-045): 3 contracts, clients by rarity (no Rare is
  // guaranteed), and the Hendersons as contract 0 on a first visit.
  jobBoard: {
    contracts: 3,
    rarity: { common: 65, uncommon: 27, rare: 8 },
    firstClient: 'hendersons',
  },

  // Change orders (M4b; jam-scope.md, implementation-plan.md §7): one is offered after each of
  // these milestones (1-based), before the shop. The rewards are in change-orders.ts.
  changeOrderAfter: [2, 4, 6],
};
