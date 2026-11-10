// Fixtures (D-050; Appendix B of implementation-plan.md): 7 for rooms, 3 for the yard, and the
// Rare Chandelier (D-056). Every modifier targets `{ host: true }`, the piece the fixture is
// installed in. They join the weekly draw from phase 2 at weight 5 each (about one hand in two
// has one by midgame) and are sold in the shop; the Chandelier is shop only. Prices come from
// balance.ts by rarity.
//
// Skylight, Blackout Curtains, and Bunk Beds also earn +25% (D-082): their Appendix B effects
// (Sunny, Dark, counting twice) only pay off with a blueprint or M4a's client specs, so on their
// own they'd be dead cards in M3.

import type { FixtureDef, FixtureId } from '../rules/index.ts';
import { PRICES } from './balance.ts';

const ROOM = { property: 'room' } as const;
const HOST = { host: true } as const;

export const FIXTURES: Readonly<Record<FixtureId, FixtureDef>> = {
  fireplace: {
    id: 'fireplace',
    name: 'Fireplace',
    tier: 'core',
    rarity: 'common',
    fits: ROOM,
    drawWeight: 5,
    fromPhase: 1,
    price: PRICES.fixture.common,
    modifiers: [
      { kind: 'earn', target: HOST, pct: 50 },
      // +100% in all in a Living Room or a Library.
      { kind: 'earn', target: { all: [HOST, { piece: ['livingRoom', 'library'] }] }, pct: 50 },
    ],
  },
  skylight: {
    id: 'skylight',
    name: 'Skylight',
    tier: 'core',
    rarity: 'common',
    fits: ROOM,
    drawWeight: 5,
    fromPhase: 1,
    price: PRICES.fixture.common,
    modifiers: [
      { kind: 'grantTag', target: HOST, tag: 'Sunny' },
      { kind: 'removeTag', target: HOST, tag: 'Dark' },
      { kind: 'earn', target: HOST, pct: 25 },
    ],
  },
  blackoutCurtains: {
    id: 'blackoutCurtains',
    name: 'Blackout Curtains',
    tier: 'core',
    rarity: 'common',
    fits: ROOM,
    drawWeight: 5,
    fromPhase: 1,
    price: PRICES.fixture.common,
    // Drawn, they keep the sun out too (D-120): the Count's answer to a sunny wall.
    modifiers: [
      { kind: 'grantTag', target: HOST, tag: 'Dark' },
      { kind: 'removeTag', target: HOST, tag: 'Sunny' },
      { kind: 'earn', target: HOST, pct: 25 },
    ],
  },
  soundproofing: {
    id: 'soundproofing',
    name: 'Soundproofing',
    tier: 'core',
    rarity: 'common',
    fits: ROOM,
    drawWeight: 5,
    fromPhase: 1,
    price: PRICES.fixture.common,
    // The street is Loud, so its penalty goes too.
    modifiers: [{ kind: 'blockPenalties', target: HOST, from: { tag: 'Loud' } }],
  },
  kitchenIsland: {
    id: 'kitchenIsland',
    name: 'Kitchen Island',
    tier: 'core',
    rarity: 'uncommon',
    fits: { piece: 'kitchen' },
    drawWeight: 5,
    fromPhase: 1,
    price: PRICES.fixture.uncommon,
    modifiers: [
      { kind: 'countsAs', target: HOST, as: 'diningRoom' },
      { kind: 'earn', target: HOST, pct: 25 },
    ],
  },
  bunkBeds: {
    id: 'bunkBeds',
    name: 'Bunk Beds',
    tier: 'core',
    rarity: 'uncommon',
    fits: { piece: 'bedroom' },
    drawWeight: 5,
    fromPhase: 1,
    price: PRICES.fixture.uncommon,
    // Counts twice in count conditions (the Hendersons' 4 Bedrooms, M4a); once in sets.
    modifiers: [
      { kind: 'countsAs', target: HOST, as: 'bedroom', times: 2 },
      { kind: 'earn', target: HOST, pct: 25 },
    ],
  },
  bayWindow: {
    id: 'bayWindow',
    name: 'Bay Window',
    tier: 'core',
    rarity: 'common',
    // Checked when it's installed: it stays if the room later becomes interior.
    fits: { all: [ROOM, { property: 'exterior' }] },
    drawWeight: 5,
    fromPhase: 1,
    price: PRICES.fixture.common,
    modifiers: [{ kind: 'grantView', target: HOST }],
  },
  sprinkler: {
    id: 'sprinkler',
    name: 'Sprinkler',
    tier: 'core',
    rarity: 'common',
    fits: { piece: 'lawn' },
    drawWeight: 5,
    fromPhase: 1,
    price: PRICES.fixture.common,
    modifiers: [{ kind: 'earn', target: HOST, pct: 100 }],
  },
  pergola: {
    id: 'pergola',
    name: 'Pergola',
    tier: 'core',
    rarity: 'uncommon',
    fits: { piece: 'patio' },
    drawWeight: 5,
    fromPhase: 1,
    price: PRICES.fixture.uncommon,
    modifiers: [
      { kind: 'grantView', target: HOST },
      { kind: 'earn', target: HOST, pct: 50 },
    ],
  },
  gardenLights: {
    id: 'gardenLights',
    name: 'Garden Lights',
    tier: 'core',
    rarity: 'common',
    fits: { property: 'yard' },
    drawWeight: 5,
    fromPhase: 1,
    price: PRICES.fixture.common,
    modifiers: [
      { kind: 'grantTag', target: HOST, tag: 'Pretty' },
      { kind: 'earn', target: { all: [HOST, { in: 'frontYard' }] }, pct: 50 },
    ],
  },
  // D-056: one of the few ×Mult sources, and it needs a setup: its room in an Entertainer.
  chandelier: {
    id: 'chandelier',
    name: 'Chandelier',
    tier: 'core',
    rarity: 'rare',
    fits: { piece: ['diningRoom', 'livingRoom'] },
    drawWeight: 0,
    fromPhase: 1,
    price: PRICES.fixture.rare,
    modifiers: [{ kind: 'xMult', times: 125, when: { host: { inSet: 'entertainer' } } }],
  },
};
