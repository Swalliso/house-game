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
    // D-166: most lots are shaped toward a trait once they pass their checks. Rocky has 14–22
    // Boulders (a plain lot 6–10), Open only its lone Trees, a pond lot a pond of 14–20 tiles
    // (a plain one 4–9). With the creek and the woods' own Wooded, about one lot in five is
    // plain, and most carry one trait or two.
    kinds: { plain: 35, rocky: 25, open: 20, pond: 20 },
    rockyBoulders: [8, 12],
    pondTiles: [14, 20],
  },

  weeksPerPhase: 4, // D-042

  // D-018's seven milestones. The targets are written by `npm run sim -- --suggest-targets`
  // (D-044): α × the greedy bot's median cumulative Wow at each milestone. Keep the markers.
  // sim:targets:start
  // From `npm run sim -- --suggest-targets --runs 2000 --crew all` (D-072, D-089) with each
  // crew's own free build and the Handyman (D-171), then set against played runs (D-146): α ×
  // the greedy bot's median cumulative Wow at each milestone on seeds sim-*. The fit's estimate
  // overstates what an overtime week rescues (in play the next shop hasn't opened yet), so α sits
  // where greedy's played survival follows 100%, 98%, 95%, 85%, 72%, 58%, 45%: on 2,000 runs of
  // check-* it was 100, 99.8, 95.0, 86.2, 72.3, 59.9 and 47.0%, and 44.9% won on 2,000 runs no
  // fit had seen (hold-*). Each client's targetPct scales these: D-169's factors still fit.
  phases: [
    { name: 'Groundbreaking', target: 35 }, // median 182, α 0.19
    { name: 'Foundation', target: 720 }, // median 1365, α 0.53
    { name: 'Framing', target: 3750 }, // median 5012, α 0.75
    { name: 'Roofing', target: 10200 }, // median 11209, α 0.91
    { name: 'Drywall', target: 24400 }, // median 23374, α 1.04
    { name: 'Finishes', target: 46100 }, // median 41729, α 1.10
    { name: 'Final Walkthrough', target: 87100 }, // median 72450, α 1.20
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
    // D-157: strikes to use from the hand at the run's start (a crew could add more); each
    // milestone adds strikesPerMilestone, and unused ones are kept.
    strikes: 1,
    // D-171: 0 = a fixture from the hand is the week's turn (D-050). The Handyman adds 1.
    freeInstalls: 0,
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
      strike: { base: 2, step: 1, max: 5 }, // D-157: +1 strike (D-076, D-084 named a type)
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
  // D-166: in a standard run the lot's cards (the yard, the outbuildings, the Garage) come at
  // full weight from week 1, while the house is sited; a first job keeps the ramp (D-149).
  lotCardsFullIn: ['standard'],

  // The run-end verdict by final score, as a percentage of the last target (§12).
  verdicts: [
    { name: 'Fixer-Upper', minPctOfTarget: 0 },
    { name: 'Starter Home', minPctOfTarget: 100 },
    { name: 'Charmer', minPctOfTarget: 125 },
    { name: 'Showhome', minPctOfTarget: 150 },
    { name: 'Dream Home', minPctOfTarget: 200 },
  ],

  // Renovate (house-systems-review.md §4, D-093 option B): a room card whose type is at its
  // limit levels up a room of that type instead: +4 Comfort a level, up to 2 levels. D-168: only
  // a room the card can't extend (boxed in, or grown already).
  renovate: { pointsPerLevel: 4, maxLevel: 2 },
  // D-168, Extend a room: a Bedroom, Kitchen, Living Room or Dining Room card laid beside a room
  // of its type, sharing 2 or more tiles of wall with it, joins that room, once a room, any week.
  // A bigger room earns +2 Comfort a tile beyond its own card's (a Bedroom or Kitchen card: +8, a
  // Living Room card: +12). In the sim (200 held-out runs), +1 a tile left greedy extending about
  // once a run and winning as often as without it; +2 made it a real choice, 2.3 a run.
  extend: {
    types: ['bedroom', 'kitchen', 'livingRoom', 'diningRoom'],
    maxPerRoom: 1,
    pointsPerTile: 2,
    minShared: 2,
  },
  // A type at its limit draws at half weight while it stays there (D-043, amended by D-093).
  drawAtLimitPct: 50,
  // A card with no play is swapped for one from its row, trying up to 3 cards (D-121).
  swapTries: 3,

  // The job board (Appendix A · M4a; D-026, D-045): 3 contracts, clients by rarity (no Rare is
  // guaranteed), and the Hendersons as contract 0 on a first visit.
  //
  // firstSeed is the first job's lot (D-149), the one contract a first visit can take. Of 6,000
  // lots, 348 have no creek and deal the Hendersons a Bedroom, then a Bathroom, then a Closet or
  // a second Bedroom in weeks 1 to 3. This one has no trait, a first hand with neither a Bathroom
  // nor a Closet to play out of order, and the same four hands wherever the three go: a Suite by
  // week 3 in 300 of 300 random placements, 58 to 82 Wow against Groundbreaking's 39 (22 at a
  // first job's targets; D-171). With those three weeks played as the guide says, a bot that
  // then picks a random card met Foundation in 19 of 24 runs and Framing in 14 on D-149's
  // targets (12% and 5% on any lot, unguided). src/ui/hud/first-job.test.ts holds the hands, so
  // a change to the draw says to pick again.
  //
  // firstTargetPct (D-151): a first job's client needs this percent of its usual targets. The
  // guided opening gets a newcomer through Framing, but the 2026-11-11 survey's casual bot
  // (greedy's move half the time) then met Roofing 52% and Drywall 20% of the time on this lot
  // and won 3%. At 73% it won 28% (D-151). On D-169's targets, fitted with the stock topped up
  // at each milestone, 66% left it 18% (400 runs), so it was 60% (28%). On D-171's targets,
  // with the General Contractor's Weekend Crews from the third milestone, 60% left it 25% (400
  // runs), so it's 57%: the Hendersons' 110% of the curve is 63%, and the bot meets Roofing 90%
  // and Drywall 70% of the time and wins 29% (400 runs). Milestone 2 alone at 450 only moved
  // the wall. A percent of the client's own, so
  // every client keeps its place in the order.
  jobBoard: {
    contracts: 3,
    rarity: { common: 65, uncommon: 27, rare: 8 },
    firstClient: 'hendersons',
    firstSeed: 'oh-4243',
    firstTargetPct: 57,
  },

  // Change orders (M4b; jam-scope.md, implementation-plan.md §7): one is offered after each of
  // these milestones (1-based), before the shop. The rewards are in change-orders.ts.
  changeOrderAfter: [2, 4, 6],

  // D-157: a strike at each milestone the run goes on from (1–6), on top of the rules' strikes.
  strikesPerMilestone: 1,

  // D-160: the standing stock, the pieces a house always needs and the draw holds back early
  // (D-055 has complexity 3 at 5% in milestone 1 and 25% in milestone 2). It fills the reserve's
  // extra slots up to one Hallway and one Fence pack, adding only what's missing. Both stay in
  // the weekly draw at their usual weights.
  //
  // D-162: from week 1, so a house can open up from its first rooms. A first job keeps D-160's
  // timing, Foundation's third week: its first three weeks are the guided opening, Foundation's
  // first week brings in Demolish, the budget, overtime and Complete early, and its second
  // Strike (first-job.ts).
  //
  // D-163: placing one doesn't use the week, so it came once (`refill: false`). Topped up at
  // every milestone (D-160's `refill: true`), the free stock was about two more builds a
  // milestone: greedy won 85% of the check's runs against develop's 49.5%, with six Hallways a
  // run. D-169: the user chose the top-ups (2026-11-12), so it comes in week 1 and again at
  // each milestone's start, only what's missing, and the targets are fitted with it.
  standingStock: {
    fromPhase: 0,
    pieces: ['hallway', 'fence'],
    firstJobPhase: 1,
    firstJobSlot: 3,
    refill: true,
  },
};
