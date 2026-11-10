// Change orders (M4b; implementation-plan.md §5, Appendix B's clients and generic change
// orders; D-011): one is offered after each of milestones 2, 4, and 6, from the client's own
// (ClientDef.changeOrders) and the generic ones, and runs through the next phase.
// - Requests: accept or decline, no penalty; met at the next milestone → the reward. "New"
//   (countNew) means placed since it was accepted. Requests never change the checklist.
// - Restrictions: accept or decline; placing a piece they forbid breaks them; kept to the next
//   milestone → the reward.
// - Phase effects: announced, then their modifiers apply for the next phase. After milestone 6
//   only these are offered, so every client has four (D-137): the three generic ones and one
//   of its own (the Barkers', Juniper's, and Dale's came with D-137). Milestones 2 and 4 use up
//   at most two. Each pays something and costs something, as Heat wave does, so the player has
//   a reason to build differently for a phase.
//
// Rewards are budget, sized to the effort, here in the defs (placeholders for the sim and
// playtest 4): 3 for one ordinary new piece; 4 for a piece that needs a spot (a Patio with a
// view, an interior room), a demolition, or a restriction kept; 5 for two new interior rooms,
// or a yard that needs a fenced yard first (a Doghouse in one, two Lawns side by side in one).
//
// Not here any more: the Hendersons' *Twins* and the generic *Grandma's moving in* became the
// Hendersons' arrivals (D-103; households.ts).

import type { ChangeOrderDef, ChangeOrderId } from '../rules/index.ts';

const ROOM = { property: 'room' } as const;

export const CHANGE_ORDERS: Readonly<Record<ChangeOrderId, ChangeOrderDef>> = {
  // ---------------------------------------------------------------------------------------
  // Generic: any client can get these.
  workingFromHome: {
    id: 'workingFromHome',
    name: 'Working from home',
    scope: 'generic',
    tier: 'core',
    kind: 'request',
    text: 'A new Home Office.',
    condition: { countNew: { piece: 'homeOffice' }, min: 1 },
    reward: { budget: 3 },
  },
  heatWave: {
    id: 'heatWave',
    name: 'Heat wave',
    scope: 'generic',
    tier: 'core',
    kind: 'phase',
    text: 'This phase, Pools and pieces beside Trees earn double, and Sunny rooms earn half.',
    modifiers: [
      { kind: 'earn', target: { piece: 'pool' }, pct: 100 },
      // Trees don't earn; the pieces beside them do (Appendix A's content wording).
      { kind: 'earn', target: { touching: { feature: 'tree' } }, pct: 100 },
      { kind: 'earn', target: { all: [ROOM, { tag: 'Sunny' }] }, pct: -50 },
    ],
  },
  // D-137: two more phase effects and a restriction, so the same order comes up less often.
  coldSnap: {
    id: 'coldSnap',
    name: 'Cold snap',
    scope: 'generic',
    tier: 'core',
    kind: 'phase',
    text: 'This phase, rooms with a Fireplace earn double, and Bathrooms earn half. The pipes froze.',
    modifiers: [
      // A Fireplace fits rooms only; the shop that follows the offer may sell one.
      { kind: 'earn', target: { hasFixture: 'fireplace' }, pct: 100 },
      { kind: 'earn', target: { piece: 'bathroom' }, pct: -50 },
    ],
  },
  rainySeason: {
    id: 'rainySeason',
    name: 'Rainy season',
    scope: 'generic',
    tier: 'core',
    kind: 'phase',
    text: 'This phase, Green pieces earn double, and Patios earn nothing. Bring the cushions in.',
    modifiers: [
      { kind: 'earn', target: { tag: 'Green' }, pct: 100 },
      { kind: 'earnNothing', target: { piece: 'patio' } },
    ],
  },
  hoaLetter: {
    id: 'hoaLetter',
    name: 'A letter from the HOA',
    scope: 'generic',
    tier: 'core',
    kind: 'restriction',
    text: 'Nothing new in the front yard this phase, per section 9, paragraph 4.',
    forbid: { in: 'frontYard' },
    reward: { budget: 4 },
  },

  // ---------------------------------------------------------------------------------------
  // The Hendersons.
  goldenRetriever: {
    id: 'goldenRetriever',
    name: 'We got a golden retriever',
    scope: 'hendersons',
    tier: 'core',
    kind: 'request',
    text: 'A Doghouse in a fenced yard.',
    condition: { count: { all: [{ piece: 'doghouse' }, { in: 'fencedYard' }] }, min: 1 },
    reward: { budget: 5 },
  },
  thanksgiving: {
    id: 'thanksgiving',
    name: 'We’re hosting Thanksgiving',
    scope: 'hendersons',
    tier: 'core',
    kind: 'phase',
    text: 'This phase, the Entertainer pays double.',
    modifiers: [{ kind: 'setBonus', set: 'entertainer', pct: 100 }],
  },

  // ---------------------------------------------------------------------------------------
  // Count Vladislav. "Interior" is checked when the request is (Appendix A's wording).
  covenVisiting: {
    id: 'covenVisiting',
    name: 'The coven is visiting',
    scope: 'vladislav',
    tier: 'core',
    kind: 'request',
    text: 'Two new interior rooms.',
    condition: { countNew: { all: [ROOM, { property: 'interior' }] }, min: 2 },
    reward: { budget: 5 },
  },
  eternalNight: {
    id: 'eternalNight',
    name: 'Eternal night',
    scope: 'vladislav',
    tier: 'core',
    kind: 'phase',
    text: 'This phase, every room counts as Dark.',
    modifiers: [{ kind: 'grantTag', target: ROOM, tag: 'Dark' }],
  },

  // ---------------------------------------------------------------------------------------
  // The Barkers.
  anotherRescue: {
    id: 'anotherRescue',
    name: 'Another rescue',
    scope: 'barkers',
    tier: 'core',
    kind: 'request',
    text: 'A new Doghouse.',
    condition: { countNew: { piece: 'doghouse' }, min: 1 },
    reward: { budget: 3 },
  },
  agilityCourse: {
    id: 'agilityCourse',
    name: 'An agility course',
    scope: 'barkers',
    tier: 'core',
    kind: 'request',
    text: 'Two Lawns side by side in a fenced yard: 8 tiles of Lawn in one group.',
    condition: { group: { all: [{ piece: 'lawn' }, { in: 'fencedYard' }] }, minTiles: 8 },
    reward: { budget: 5 },
  },
  puppies: {
    id: 'puppies',
    name: 'A litter of puppies',
    scope: 'barkers',
    tier: 'core',
    kind: 'phase',
    text: 'Six puppies! This phase, Pet pieces and Lawns earn double, and Flower Beds earn nothing.',
    modifiers: [
      { kind: 'earn', target: { tag: 'Pet' }, pct: 100 },
      { kind: 'earn', target: { piece: 'lawn' }, pct: 100 },
      { kind: 'earnNothing', target: { piece: 'flowerBed' } },
    ],
  },

  // ---------------------------------------------------------------------------------------
  // Juniper Vale.
  declutter: {
    id: 'declutter',
    name: 'Declutter',
    scope: 'juniper',
    tier: 'core',
    kind: 'request',
    text: 'Demolish a piece.',
    condition: { demolishedSinceAccepted: { min: 1 } },
    reward: { budget: 4 },
  },
  teaGarden: {
    id: 'teaGarden',
    name: 'A tea garden',
    scope: 'juniper',
    tier: 'core',
    kind: 'request',
    text: 'A new Patio with a view.',
    condition: { countNew: { all: [{ piece: 'patio' }, { property: 'view' }] }, min: 1 },
    reward: { budget: 4 },
  },
  magazineShoot: {
    id: 'magazineShoot',
    name: 'A magazine shoot',
    scope: 'juniper',
    tier: 'core',
    kind: 'phase',
    text: 'This phase, rooms with a view earn double, and Closets and Hallways earn nothing. Nothing extra in the shot.',
    modifiers: [
      { kind: 'earn', target: { all: [ROOM, { property: 'view' }] }, pct: 100 },
      { kind: 'earnNothing', target: { piece: 'closet' } },
      // Long Hallways count as Hallways. Their links still hold; only their own points go.
      { kind: 'earnNothing', target: { piece: 'hallway' } },
    ],
  },

  // ---------------------------------------------------------------------------------------
  // Dale.
  bigDeadline: {
    id: 'bigDeadline',
    name: 'Big deadline',
    scope: 'dale',
    tier: 'core',
    kind: 'restriction',
    text: 'Place nothing Loud this phase.',
    forbid: { tag: 'Loud' },
    reward: { budget: 4 },
  },
  startedAPodcast: {
    id: 'startedAPodcast',
    name: 'Started a podcast',
    scope: 'dale',
    tier: 'core',
    kind: 'request',
    text: 'A new interior room, for the studio.',
    condition: { countNew: { all: [ROOM, { property: 'interior' }] }, min: 1 },
    reward: { budget: 4 },
  },
  outOfOffice: {
    id: 'outOfOffice',
    name: 'Out of office',
    scope: 'dale',
    tier: 'core',
    kind: 'phase',
    text: 'This phase, Outdoor pieces earn double, and Home Offices earn nothing. Not checking email.',
    modifiers: [
      { kind: 'earn', target: { tag: 'Outdoor' }, pct: 100 },
      // Points only: the Home Offices still pay their budget.
      { kind: 'earnNothing', target: { piece: 'homeOffice' } },
    ],
  },
};
