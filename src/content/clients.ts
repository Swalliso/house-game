// Clients (Appendix B · Clients; D-010, D-026, D-031): who the house is for. Each brings a
// checklist (the house rules in this client's numbers, then its own wishes), tastes (likes
// +50%, dislikes −50%, "earns double" +100%, "earns nothing"), a pool (its spec pieces +100%,
// its signature special pieces at weight 20), and a target factor the sim sets.
// Everyday clients are common and eccentrics rare (D-026).

import type { ClientDef, ClientId } from '../rules/index.ts';

export const CLIENTS: Readonly<Record<ClientId, ClientDef>> = {
  hendersons: {
    id: 'hendersons',
    name: 'The Hendersons',
    rarity: 'common',
    tier: 'core',
    brief: 'A growing family: room for everyone, and a yard to play in.',
    specs: [],
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
    pool: [{ kind: 'drawWeight', target: { piece: ['bedroom', 'bathroom', 'fence'] }, pct: 100 }],
    targetPct: 100,
  },
  vladislav: {
    id: 'vladislav',
    name: 'Count Vladislav',
    rarity: 'rare',
    tier: 'core',
    brief: 'Somewhere quiet. Somewhere… dark.',
    specs: [],
    tastes: [
      { kind: 'earn', target: { tag: 'Dark' }, pct: 100 },
      // So a Pool earns nothing: "no Pool" is a taste, not a spec (Appendix A · M4a).
      { kind: 'earnNothing', target: { tag: 'Sunny' } },
      { kind: 'earn', target: { touching: { feature: 'tree' } }, pct: 50 }, // likes shade
      { kind: 'earn', target: { piece: 'herbGarden' }, pct: -100 }, // garlic
    ],
    pool: [{ kind: 'drawWeight', target: { piece: 'library' }, add: 20 }],
    targetPct: 100,
  },
  barkers: {
    id: 'barkers',
    name: 'The Barkers',
    rarity: 'common',
    tier: 'core',
    brief: 'Two dogs and counting, and a yard they can run in.',
    specs: [],
    tastes: [
      { kind: 'earn', target: { tag: 'Pet' }, pct: 50 },
      { kind: 'earn', target: { piece: 'lawn' }, pct: 50 },
      { kind: 'earn', target: { piece: 'flowerBed' }, pct: -50 }, // dug up
    ],
    pool: [
      { kind: 'drawWeight', target: { piece: 'mudroom' }, add: 20 },
      { kind: 'drawWeight', target: { piece: ['doghouse', 'fence'] }, pct: 100 },
    ],
    targetPct: 100,
  },
  juniper: {
    id: 'juniper',
    name: 'Juniper Vale',
    rarity: 'uncommon',
    tier: 'core',
    brief: 'A small house, beautifully done. Nothing extra.',
    specs: [],
    tastes: [
      { kind: 'perCountOver', match: { property: 'room' }, over: 8, pct: -10 },
      { kind: 'earn', target: { piece: 'garage' }, pct: -100 },
      // Finishing a milestone early pays her double.
      { kind: 'rule', key: 'earlyRewardPct', add: 100 },
    ],
    pool: [],
    targetPct: 100,
  },
  dale: {
    id: 'dale',
    name: 'Dale',
    rarity: 'common',
    tier: 'core',
    brief: 'Works from home. Needs quiet, and an office or two.',
    specs: [],
    tastes: [{ kind: 'budget', target: 'all', pct: 100 }],
    pool: [{ kind: 'drawWeight', target: { piece: 'homeOffice' }, pct: 100 }],
    targetPct: 100,
  },
};
