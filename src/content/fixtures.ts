// Fixtures (D-050; Appendix B of implementation-plan.md): 7 for rooms, 3 for the yard, and the
// Rare Chandelier (D-056). Every modifier targets `{ host: true }`, the piece the fixture is
// installed in. They join the weekly draw from phase 2 at weight 5 each (about one hand in two
// has one by midgame) and are sold in the shop; the Chandelier is shop only. Prices come from
// balance.ts by rarity.
//
// Skylight, Blackout Curtains, and Bunk Beds also earn +25% (D-082): their Appendix B effects
// (Sunny, Dark, counting twice) only pay off with a blueprint or M4a's client specs, so on their
// own they'd be dead cards in M3.
//
// D-172: a fixture fits only where it makes sense. The Fireplace, Blackout Curtains and the Bay
// Window took any room, a Bathroom, Closet or Garage included; now each names the rooms it
// leaves out (`roomsBut`), and its card says "most rooms". The Skylight and Soundproofing still
// fit any room: a skylit Bathroom and a soundproofed Garage are real things.
//
// D-194: every fixture pays something wherever it fits. Soundproofing, the Bay Window and Garden
// Lights get D-082's +25% floor (Garden Lights stays +50% in the front yard), the Kitchen Island
// adds a second +2 to its Kitchen's for each Dining Room or Herb Garden beside it, and the
// Pergola stands over a Lawn as well as a Patio.

import type { FixtureDef, FixtureId, PieceId } from '../rules/index.ts';
import { PRICES } from './balance.ts';

const ROOM = { property: 'room' } as const;
/** D-172: every room but these (a variant counts as its type, as everywhere). */
const roomsBut = (...out: PieceId[]) => ({ all: [ROOM, { not: { piece: out } }] }) as const;
const HOST = { host: true } as const;

export const FIXTURES: Readonly<Record<FixtureId, FixtureDef>> = {
  fireplace: {
    id: 'fireplace',
    name: 'Fireplace',
    tier: 'core',
    rarity: 'common',
    // No hearth in a room of tile, coats or cars.
    fits: roomsBut('bathroom', 'closet', 'garage', 'mudroom'),
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
    fits: roomsBut('bathroom', 'closet', 'garage'),
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
    // The street is Loud, so its penalty goes too. D-194: the +25% floor pays in the rooms
    // nothing Loud touches.
    modifiers: [
      { kind: 'blockPenalties', target: HOST, from: { tag: 'Loud' } },
      { kind: 'earn', target: HOST, pct: 25 },
    ],
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
    // What it earns comes first, so the hand card leads with it (D-148). D-194: its Kitchen's
    // +2 for each Dining Room or Herb Garden beside it becomes +4. It counted as a Dining Room
    // for the pieces touching it (D-081), and since a house holds one Kitchen (D-165) nothing
    // touching it read that.
    modifiers: [
      { kind: 'earn', target: HOST, pct: 25 },
      {
        kind: 'grantEffect',
        target: HOST,
        effect: { kind: 'neighbor', match: { piece: ['diningRoom', 'herbGarden'] }, amount: 2 },
      },
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
    fits: {
      all: [ROOM, { property: 'exterior' }, { not: { piece: ['bathroom', 'closet', 'garage'] } }],
    },
    drawWeight: 5,
    fromPhase: 1,
    price: PRICES.fixture.common,
    // D-194: the +25% floor pays in a room with no "per view" pay of its own.
    modifiers: [
      { kind: 'grantView', target: HOST },
      { kind: 'earn', target: HOST, pct: 25 },
    ],
  },
  sprinkler: {
    id: 'sprinkler',
    name: 'Sprinkler',
    tier: 'core',
    rarity: 'common',
    fits: { piece: 'lawn' },
    row: 'layout', // a yard fixture: the Layout row (D-121)
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
    // D-194: over a Lawn too. Both are 2×2, so the Patio's Pergola stands over either.
    fits: { piece: ['patio', 'lawn'] },
    row: 'layout', // a yard fixture: the Layout row (D-121)
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
    row: 'layout', // a yard fixture: the Layout row (D-121)
    drawWeight: 5,
    fromPhase: 1,
    price: PRICES.fixture.common,
    // D-194: +25% anywhere, and +25% more in the front yard, so it's still +50% there.
    modifiers: [
      { kind: 'grantTag', target: HOST, tag: 'Pretty' },
      { kind: 'earn', target: HOST, pct: 25 },
      { kind: 'earn', target: { all: [HOST, { in: 'frontYard' }] }, pct: 25 },
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
