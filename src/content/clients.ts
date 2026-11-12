// Clients (Appendix B · Clients; D-010, D-026, D-031): who the house is for. Each brings a
// checklist (the house rules in this client's numbers, then its own wishes), tastes (likes
// +50%, dislikes −50%, "earns double" +100%, "earns nothing"), a pool (its spec pieces +100%,
// its signature special pieces at weight 20), and a target factor the sim sets.
// Everyday clients are common and eccentrics rare (D-026).

import type { ClientDef, ClientId } from '../rules/index.ts';
import { HOUSEHOLDS } from './households.ts';
import { houseRules } from './house-rules.ts';

export const CLIENTS: Readonly<Record<ClientId, ClientDef>> = {
  hendersons: {
    id: 'hendersons',
    name: 'The Hendersons',
    rarity: 'common',
    tier: 'core',
    brief: 'A growing family: room for everyone, and a yard to play in.',
    // M4b: the twins at Framing and Grandma at Drywall (households.ts), and their change orders.
    household: HOUSEHOLDS.hendersons,
    changeOrders: ['goldenRetriever', 'thanksgiving'],
    specs: [
      // Their 4+ Bedrooms and 2+ Bathrooms (Appendix B) are where this household ends up.
      ...houseRules({ household: HOUSEHOLDS.hendersons }),
      {
        id: 'kitchenDining',
        name: 'Kitchen beside the Dining Room',
        group: 'wishes',
        condition: { adjacentPair: [{ piece: 'kitchen' }, { piece: 'diningRoom' }] },
      },
      // Any fenced yard (Appendix B's 4 tiles is under D-069's 10-tile minimum).
      {
        id: 'fencedYard',
        name: 'A fenced yard',
        group: 'wishes',
        condition: { fencedYardTiles: { min: 4 } },
      },
    ],
    tastes: [
      { kind: 'earn', target: { tag: 'Kid' }, pct: 50 },
      { kind: 'earn', target: { piece: 'lawn' }, pct: 50 },
      // A noisy room against a bedroom wakes the kids.
      {
        kind: 'earn',
        target: { all: [{ tag: 'Loud' }, { touching: { piece: 'bedroom' } }] },
        pct: -50,
      },
    ],
    // Spec pieces +100% (Appendix B), but not the Kitchen: every house takes exactly one, and
    // extra Kitchen cards were the review's most common dead card.
    pool: [
      {
        kind: 'drawWeight',
        target: { piece: ['bedroom', 'bathroom', 'diningRoom', 'fence'] },
        pct: 100,
      },
    ],
    targetPct: 110, // fitted by npm run sim -- --suggest-targets, then checked held out (D-146)
  },
  vladislav: {
    id: 'vladislav',
    name: 'Count Vladislav',
    rarity: 'rare',
    tier: 'core',
    brief: 'Somewhere quiet. Somewhere… dark.',
    household: HOUSEHOLDS.vladislav,
    changeOrders: ['covenVisiting', 'eternalNight'],
    specs: [
      ...houseRules({ household: HOUSEHOLDS.vladislav }),
      {
        id: 'darkRooms',
        name: 'Three Dark rooms',
        group: 'wishes',
        condition: { count: { all: [{ property: 'room' }, { tag: 'Dark' }] }, min: 3 },
      },
      {
        id: 'library',
        name: 'One Library',
        group: 'wishes',
        condition: { count: { piece: 'library' }, min: 1, max: 1 },
      },
    ],
    tastes: [
      { kind: 'earn', target: { tag: 'Dark' }, pct: 100 },
      // So a Pool earns nothing: "no Pool" is a taste, not a spec (Appendix A · M4a).
      { kind: 'earnNothing', target: { tag: 'Sunny' } },
      { kind: 'earn', target: { touching: { feature: 'tree' } }, pct: 50 }, // likes shade
      { kind: 'earn', target: { piece: 'herbGarden' }, pct: -100 }, // garlic
    ],
    pool: [{ kind: 'drawWeight', target: { piece: 'library' }, add: 20 }],
    targetPct: 95, // fitted by npm run sim -- --suggest-targets, then checked held out (D-146)
  },
  barkers: {
    id: 'barkers',
    name: 'The Barkers',
    rarity: 'common',
    tier: 'core',
    brief: 'Two dogs and counting, and a yard they can run in.',
    household: HOUSEHOLDS.barkers,
    changeOrders: ['anotherRescue', 'agilityCourse', 'puppies'],
    specs: [
      ...houseRules({ household: HOUSEHOLDS.barkers }),
      {
        id: 'bigYard',
        name: 'A big fenced yard',
        group: 'wishes',
        condition: { fencedYardTiles: { min: 12 } },
      },
      {
        id: 'doghouses',
        name: 'Two Doghouses',
        group: 'wishes',
        condition: { count: { piece: 'doghouse' }, min: 2 },
      },
      {
        id: 'mudroom',
        name: 'One Mudroom',
        group: 'wishes',
        condition: { count: { piece: 'mudroom' }, min: 1, max: 1 },
      },
    ],
    tastes: [
      { kind: 'earn', target: { tag: 'Pet' }, pct: 50 },
      { kind: 'earn', target: { piece: 'lawn' }, pct: 50 },
      { kind: 'earn', target: { piece: 'flowerBed' }, pct: -50 }, // dug up
    ],
    pool: [
      { kind: 'drawWeight', target: { piece: 'mudroom' }, add: 20 },
      { kind: 'drawWeight', target: { piece: ['doghouse', 'fence'] }, pct: 100 },
    ],
    // D-160: the first of their two Doghouses comes with them; the big fenced yard's Fence is
    // the standing stock's, from week 1 too (D-162).
    deliveries: [
      { phase: 0, cards: ['doghouse'], text: 'The Barkers bring one of their two Doghouses.' },
    ],
    targetPct: 90, // fitted by npm run sim -- --suggest-targets, then checked held out (D-146)
  },
  juniper: {
    id: 'juniper',
    name: 'Juniper Vale',
    rarity: 'uncommon',
    tier: 'core',
    brief: 'A small house, beautifully done. Nothing extra.',
    household: HOUSEHOLDS.juniper,
    changeOrders: ['declutter', 'teaGarden', 'magazineShoot'],
    specs: [
      // Her "a house of 4–8 rooms" (Appendix A · M4a) is her numbers for A compact house.
      ...houseRules({ household: HOUSEHOLDS.juniper, rooms: { min: 4, max: 8 } }),
      {
        id: 'viewRooms',
        name: 'Two rooms with a view',
        group: 'wishes',
        condition: { count: { all: [{ property: 'room' }, { property: 'view' }] }, min: 2 },
      },
    ],
    tastes: [
      { kind: 'perCountOver', match: { property: 'room' }, over: 8, pct: -10 },
      { kind: 'earn', target: { piece: 'garage' }, pct: -100 },
      // Finishing a milestone early pays her double.
      { kind: 'rule', key: 'earlyRewardPct', add: 100 },
    ],
    pool: [],
    targetPct: 95, // fitted by npm run sim -- --suggest-targets, then checked held out (D-146)
  },
  dale: {
    id: 'dale',
    name: 'Dale',
    rarity: 'common',
    tier: 'core',
    brief: 'Works from home. Needs quiet, and an office or two.',
    household: HOUSEHOLDS.dale,
    changeOrders: ['bigDeadline', 'startedAPodcast', 'outOfOffice'],
    specs: [
      ...houseRules({ household: HOUSEHOLDS.dale }),
      {
        id: 'offices',
        name: 'Two Home Offices',
        group: 'wishes',
        condition: { count: { piece: 'homeOffice' }, min: 2, max: 2 },
      },
      {
        // The street doesn't count (Appendix A · M4a): `none` looks at pieces only.
        id: 'quietOffice',
        name: 'Nothing Loud next to an office',
        group: 'wishes',
        text: 'A Home Office, and nothing Loud touching one. The street doesn’t count.',
        condition: {
          and: [
            { count: { piece: 'homeOffice' }, min: 1 },
            { none: { all: [{ tag: 'Loud' }, { touching: { piece: 'homeOffice' } }] } },
          ],
        },
      },
    ],
    tastes: [{ kind: 'budget', target: 'all', pct: 100 }],
    pool: [{ kind: 'drawWeight', target: { piece: 'homeOffice' }, pct: 100 }],
    // D-160: the first of his two Home Offices comes with him, so the wish never waits on the
    // draw for both (a novice bot was offered none in 11% of runs on develop at dcad8da).
    deliveries: [
      { phase: 0, cards: ['homeOffice'], text: 'Dale brings one of his two Home Offices.' },
    ],
    targetPct: 115, // fitted by npm run sim -- --suggest-targets, then checked held out (D-146)
  },
};
