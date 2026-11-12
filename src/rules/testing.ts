// Test helpers for the rules: a small, fixed Content and house builders. Rules tests use this
// rather than src/content, so tuning the real numbers never breaks a rules test. (Not to be
// confused with fixtures, which are game content: upgrades installed in a placed piece.)

import type {
  Balance,
  Card,
  GameEvent,
  SwappedCard,
  BlueprintDef,
  BlueprintId,
  ChangeOrderDef,
  ChangeOrderId,
  ClientDef,
  ClientId,
  Content,
  CrateDef,
  CrateId,
  CrewDef,
  CrewId,
  FeatureDef,
  FeatureId,
  FixtureDef,
  FixtureId,
  HouseState,
  LotBalance,
  LotTraitDef,
  LotTraitId,
  Modifier,
  PieceDef,
  PieceId,
  Rarity,
  Rot,
  RunSetup,
  SetDef,
  SetId,
  ToolDef,
  ToolId,
  UpgradeDef,
  UpgradeId,
} from './index.ts';
import { DRAW_ROWS, drawHand, type DrawOptions } from './draw.ts';
import { placedCells } from './grid.ts';
import { lotFromRows, terrainAt } from './lot.ts';
import { addPiece } from './placement.ts';

const piece = (
  def: Omit<PieceDef, 'tier' | 'drawWeight' | 'complexity' | 'fromPhase'> & Partial<PieceDef>,
): PieceDef => ({
  tier: 'core',
  drawWeight: 10,
  complexity: 1,
  fromPhase: 0,
  ...def,
});

export const TEST_PIECES: Record<PieceId, PieceDef> = {
  bedroom: piece({
    id: 'bedroom',
    name: 'Bedroom',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Quiet'],
    effects: [
      { kind: 'steady', amount: 3 },
      {
        kind: 'neighbor',
        match: { any: [{ feature: 'tree' }, { tag: 'Quiet' }] },
        amount: 1,
        max: 3,
      },
      { kind: 'neighbor', match: { tag: 'Loud' }, amount: -2 },
    ],
  }),
  bathroom: piece({
    id: 'bathroom',
    name: 'Bathroom',
    category: 'indoor',
    shape: ['#'],
    tags: ['Wet'],
    effects: [
      { kind: 'neighbor', match: { piece: 'bedroom' }, amount: 3, max: 1 },
      { kind: 'neighbor', match: { piece: 'kitchen' }, amount: -2 },
    ],
  }),
  kitchen: piece({
    id: 'kitchen',
    name: 'Kitchen',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Social'],
    effects: [{ kind: 'neighbor', match: { piece: 'diningRoom' }, amount: 2 }],
  }),
  lKitchen: piece({
    id: 'lKitchen',
    name: 'L-Kitchen',
    category: 'indoor',
    countsAs: 'kitchen',
    shape: ['#.', '##'],
    tags: ['Social'],
    effects: [{ kind: 'neighbor', match: { piece: 'diningRoom' }, amount: 2 }],
  }),
  diningRoom: piece({
    id: 'diningRoom',
    name: 'Dining Room',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Social'],
    effects: [
      { kind: 'aura', match: { piece: ['kitchen', 'livingRoom'] }, scope: 'adjacent', pct: 50 },
    ],
  }),
  livingRoom: piece({
    id: 'livingRoom',
    name: 'Living Room',
    category: 'indoor',
    shape: ['##', '##', '##'],
    tags: ['Social'],
    effects: [{ kind: 'neighbor', match: { property: 'viewSource' }, amount: 2, max: 3 }],
  }),
  closet: piece({
    id: 'closet',
    name: 'Closet',
    category: 'indoor',
    shape: ['#'],
    tags: [],
    effects: [{ kind: 'steady', amount: 1 }],
  }),
  hallway: piece({
    id: 'hallway',
    name: 'Hallway',
    category: 'indoor',
    connector: true,
    shape: ['##'],
    tags: [],
    complexity: 3,
    effects: [{ kind: 'link' }],
  }),
  longHallway: piece({
    id: 'longHallway',
    name: 'Long Hallway',
    category: 'indoor',
    connector: true,
    countsAs: 'hallway',
    shape: ['###'],
    tags: [],
    complexity: 3,
    effects: [{ kind: 'link' }],
  }),
  garage: piece({
    id: 'garage',
    name: 'Garage',
    category: 'indoor',
    row: 'layout',
    shape: ['##', '##'],
    tags: ['Loud'],
    complexity: 2,
    effects: [
      {
        kind: 'requires',
        condition: { touching: { any: [{ feature: 'street' }, { piece: 'driveway' }] } },
        blocksPlacement: true,
      },
      { kind: 'steady', amount: 1 },
      { kind: 'economy', budget: 1, every: 3 },
    ],
  }),
  homeOffice: piece({
    id: 'homeOffice',
    name: 'Home Office',
    category: 'indoor',
    shape: ['##'],
    tags: ['Quiet'],
    complexity: 2,
    effects: [
      { kind: 'steady', amount: 2 },
      { kind: 'neighbor', match: { tag: 'Loud' }, amount: -2 },
      { kind: 'economy', budget: 1, every: 2 },
    ],
  }),
  lawn: piece({
    id: 'lawn',
    name: 'Lawn',
    category: 'yard',
    shape: ['##', '##'],
    tags: ['Outdoor', 'Green'],
    complexity: 2,
    effects: [
      { kind: 'steady', amount: 1 },
      { kind: 'neighbor', match: { piece: 'lawn' }, amount: 1, max: 4 },
    ],
  }),
  sapling: piece({
    id: 'sapling',
    name: 'Sapling',
    category: 'yard',
    shape: ['#'],
    tags: ['Green'],
    complexity: 2,
    effects: [
      { kind: 'steady', amount: 1 },
      { kind: 'transform', into: { feature: 'tree' }, afterWeeks: 4 },
    ],
  }),
  flowerBed: piece({
    id: 'flowerBed',
    name: 'Flower Bed',
    category: 'yard',
    givesView: true,
    shape: ['#'],
    tags: ['Green', 'Pretty'],
    complexity: 2,
    effects: [
      { kind: 'steady', amount: 1 },
      { kind: 'conditional', when: { in: 'frontYard' }, effect: { kind: 'steady', amount: 2 } },
      { kind: 'neighbor', match: { piece: 'flowerBed' }, amount: 1 },
    ],
  }),
  herbGarden: piece({
    id: 'herbGarden',
    name: 'Herb Garden',
    category: 'yard',
    givesView: true,
    shape: ['##'],
    tags: ['Green'],
    complexity: 2,
    effects: [
      { kind: 'perTile', region: 'sunny', amount: 1 },
      { kind: 'aura', match: { piece: 'kitchen' }, scope: 'adjacent', pct: 25 },
    ],
  }),
  patio: piece({
    id: 'patio',
    name: 'Patio',
    category: 'yard',
    shape: ['##', '##'],
    tags: ['Outdoor', 'Social'],
    effects: [
      { kind: 'neighbor', match: { piece: ['livingRoom', 'kitchen'] }, amount: 2 },
      { kind: 'neighbor', match: { property: 'viewSource' }, amount: 1, max: 3 },
    ],
  }),
  fence: piece({
    id: 'fence',
    name: 'Fence',
    category: 'yard',
    wall: true,
    shape: ['####'],
    pack: { maxTiles: 8, shapes: [['####'], ['#..', '#..', '###']] },
    tags: [],
    complexity: 3,
    drawWeight: 20,
    effects: [{ kind: 'enclosure', perTile: 1, cap: 6 }],
  }),
  driveway: piece({
    id: 'driveway',
    name: 'Driveway',
    category: 'yard',
    canCover: ['creek'],
    shape: ['###'],
    pack: { maxTiles: 6, shapes: [['###'], ['#####']] },
    tags: [],
    complexity: 2,
    drawWeight: 20,
    effects: [
      {
        kind: 'requires',
        condition: { touching: { any: [{ feature: 'street' }, { piece: 'driveway' }] } },
        blocksPlacement: true,
      },
      { kind: 'conditional', when: { in: 'frontYard' }, effect: { kind: 'steady', amount: 1 } },
    ],
  }),
  doghouse: piece({
    id: 'doghouse',
    name: 'Doghouse',
    category: 'outbuilding',
    shape: ['#'],
    tags: ['Pet', 'House'],
    complexity: 3,
    effects: [
      { kind: 'requires', condition: { in: 'fencedYard' }, blocksPlacement: false },
      { kind: 'steady', amount: 1 },
      { kind: 'neighbor', match: { piece: 'lawn' }, amount: 1 },
    ],
  }),
  treehouse: piece({
    id: 'treehouse',
    name: 'Treehouse',
    category: 'outbuilding',
    shape: ['##', '##'],
    tags: ['Kid', 'House'],
    complexity: 2,
    effects: [
      { kind: 'requires', condition: { touching: { feature: 'tree' } }, blocksPlacement: true },
      { kind: 'neighbor', match: { tag: 'Kid' }, amount: 2 },
    ],
  }),
  greenhouse: piece({
    id: 'greenhouse',
    name: 'Greenhouse',
    category: 'outbuilding',
    givesView: true,
    shape: ['##', '##'],
    tags: ['Green', 'House'],
    complexity: 3,
    effects: [
      {
        kind: 'aura',
        match: { all: [{ property: 'viewSource' }, { property: 'yard' }] },
        scope: 'adjacent',
        pct: 50,
      },
    ],
  }),
  // Special pieces (weight 0: shop only).
  playroom: piece({
    id: 'playroom',
    name: 'Playroom',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Loud', 'Kid'],
    drawWeight: 0,
    effects: [
      { kind: 'neighbor', match: { piece: 'bedroom' }, amount: 2 },
      { kind: 'aura', match: { tag: 'Quiet' }, scope: 'adjacent', amount: -2 },
    ],
  }),
  library: piece({
    id: 'library',
    name: 'Library',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Quiet'],
    drawWeight: 0,
    effects: [{ kind: 'neighbor', match: { tag: 'Quiet' }, amount: 2, max: 3 }],
  }),
  mudroom: piece({
    id: 'mudroom',
    name: 'Mudroom',
    category: 'indoor',
    shape: ['##'],
    tags: ['Pet'],
    drawWeight: 0,
    effects: [
      {
        kind: 'conditional',
        when: { borders: 'fencedYard' },
        effect: { kind: 'aura', match: { tag: 'Pet' }, scope: 'region', pct: 50 },
      },
    ],
  }),
  pool: piece({
    id: 'pool',
    name: 'Pool',
    category: 'yard',
    shape: ['###', '###'],
    tags: ['Wet', 'Sunny', 'Loud'],
    drawWeight: 0,
    effects: [
      { kind: 'rhythm', every: 3, amount: 12 },
      { kind: 'neighbor', match: { feature: 'tree' }, amount: -2, max: 3 },
    ],
  }),
  sunroom: piece({
    id: 'sunroom',
    name: 'Sunroom',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Sunny'],
    drawWeight: 0,
    effects: [{ kind: 'perTile', region: 'sunny', amount: 2 }],
  }),
  hotTub: piece({
    id: 'hotTub',
    name: 'Hot Tub',
    category: 'yard',
    shape: ['#'],
    tags: ['Wet', 'Social'],
    drawWeight: 0,
    effects: [{ kind: 'neighbor', match: { piece: 'patio' }, amount: 3 }],
  }),
  firePit: piece({
    id: 'firePit',
    name: 'Fire Pit',
    category: 'yard',
    shape: ['#'],
    tags: ['Social'],
    drawWeight: 0,
    effects: [{ kind: 'aura', match: { piece: 'patio' }, scope: 'adjacent', pct: 50 }],
  }),
  henhouse: piece({
    id: 'henhouse',
    name: 'Henhouse',
    category: 'outbuilding',
    shape: ['##'],
    tags: ['House'],
    drawWeight: 0,
    effects: [
      { kind: 'economy', budget: 1, every: 2 },
      { kind: 'neighbor', match: { piece: ['herbGarden', 'flowerBed'] }, amount: 1 },
    ],
  }),
  birdhouse: piece({
    id: 'birdhouse',
    name: 'Birdhouse',
    category: 'outbuilding',
    shape: ['#'],
    tags: ['House'],
    drawWeight: 0,
    effects: [{ kind: 'neighbor', match: { feature: 'tree' }, amount: 1, max: 3 }],
  }),
  // D-145's late piece. Weight 0 here, so the test content's draws stay as they were.
  porch: piece({
    id: 'porch',
    name: 'Porch',
    category: 'yard',
    shape: ['##'],
    tags: ['Outdoor'],
    drawWeight: 0,
    complexity: 2,
    effects: [
      { kind: 'aura', match: { property: 'room' }, scope: 'adjacent', pct: 25 },
      { kind: 'neighbor', match: { property: 'room' }, amount: 1, max: 4 },
    ],
  }),
  // Member rooms (M4b, D-103): weight 0, counting as Bedrooms, never drawn or sold. No test
  // client's household brings them unless a test gives it one (withHousehold).
  nursery: piece({
    id: 'nursery',
    name: 'Nursery',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##', '##'],
    tags: ['Quiet', 'Kid'],
    drawWeight: 0,
    complexity: 2,
    effects: [
      { kind: 'steady', amount: 2 },
      { kind: 'neighbor', match: { piece: 'bedroom' }, amount: 2, max: 2 },
      { kind: 'transform', into: { piece: 'kidsRoom' }, afterWeeks: 8 },
    ],
  }),
  kidsRoom: piece({
    id: 'kidsRoom',
    name: 'Kids’ Room',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##', '##'],
    tags: ['Kid'],
    drawWeight: 0,
    effects: [
      { kind: 'steady', amount: 4 },
      {
        kind: 'neighbor',
        match: { any: [{ tag: 'Kid' }, { feature: 'tree' }] },
        amount: 2,
        max: 3,
      },
    ],
  }),
  grandmasRoom: piece({
    id: 'grandmasRoom',
    name: 'Grandma’s Room',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##', '##'],
    tags: ['Quiet'],
    drawWeight: 0,
    effects: [
      { kind: 'steady', amount: 3 },
      {
        kind: 'neighbor',
        match: { piece: ['bathroom', 'livingRoom', 'kitchen'] },
        amount: 2,
        max: 3,
      },
    ],
  }),
  renfieldsRoom: piece({
    id: 'renfieldsRoom',
    name: 'Renfield’s Room',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##'],
    tags: ['Quiet'],
    drawWeight: 0,
    effects: [{ kind: 'steady', amount: 2 }],
  }),
  nanasRoom: piece({
    id: 'nanasRoom',
    name: 'Nana’s Room',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##', '##'],
    tags: ['Quiet'],
    drawWeight: 0,
    effects: [{ kind: 'steady', amount: 3 }],
  }),
  rowansStudio: piece({
    id: 'rowansStudio',
    name: 'Rowan’s Studio',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##'],
    tags: ['Quiet'],
    drawWeight: 0,
    effects: [{ kind: 'steady', amount: 2 }],
  }),
  ivysRoom: piece({
    id: 'ivysRoom',
    name: 'Ivy’s Room',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##', '##'],
    tags: ['Kid'],
    drawWeight: 0,
    effects: [{ kind: 'steady', amount: 3 }],
  }),
};

const HOST = { host: true } as const;
const ROOM = { property: 'room' } as const;
const PRICE: Record<Rarity, number> = { common: 2, uncommon: 3, rare: 4 };

const fixture = (
  id: FixtureId,
  name: string,
  rarity: Rarity,
  fits: FixtureDef['fits'],
  modifiers: readonly Modifier[],
  drawWeight = 5,
): FixtureDef => ({
  id,
  name,
  tier: 'core',
  rarity,
  fits,
  drawWeight,
  fromPhase: 1,
  price: PRICE[rarity],
  modifiers,
});

/** The fixtures, as Appendix B encodes them (without D-082's +25%, so tests see the plain effects). */
export const TEST_FIXTURES: Record<FixtureId, FixtureDef> = {
  fireplace: fixture('fireplace', 'Fireplace', 'common', ROOM, [
    { kind: 'earn', target: HOST, pct: 50 },
    { kind: 'earn', target: { all: [HOST, { piece: ['livingRoom', 'library'] }] }, pct: 50 },
  ]),
  skylight: fixture('skylight', 'Skylight', 'common', ROOM, [
    { kind: 'grantTag', target: HOST, tag: 'Sunny' },
    { kind: 'removeTag', target: HOST, tag: 'Dark' },
  ]),
  blackoutCurtains: fixture('blackoutCurtains', 'Blackout Curtains', 'common', ROOM, [
    { kind: 'grantTag', target: HOST, tag: 'Dark' },
  ]),
  soundproofing: fixture('soundproofing', 'Soundproofing', 'common', ROOM, [
    { kind: 'blockPenalties', target: HOST, from: { tag: 'Loud' } },
  ]),
  kitchenIsland: fixture('kitchenIsland', 'Kitchen Island', 'uncommon', { piece: 'kitchen' }, [
    { kind: 'countsAs', target: HOST, as: 'diningRoom' },
    { kind: 'earn', target: HOST, pct: 25 },
  ]),
  bunkBeds: fixture('bunkBeds', 'Bunk Beds', 'uncommon', { piece: 'bedroom' }, [
    { kind: 'countsAs', target: HOST, as: 'bedroom', times: 2 },
  ]),
  bayWindow: fixture(
    'bayWindow',
    'Bay Window',
    'common',
    { all: [ROOM, { property: 'exterior' }] },
    [{ kind: 'grantView', target: HOST }],
  ),
  // The yard's fixtures draw in the Layout row (D-121).
  sprinkler: {
    ...fixture('sprinkler', 'Sprinkler', 'common', { piece: 'lawn' }, [
      { kind: 'earn', target: HOST, pct: 100 },
    ]),
    row: 'layout',
  },
  pergola: {
    ...fixture('pergola', 'Pergola', 'uncommon', { piece: 'patio' }, [
      { kind: 'grantView', target: HOST },
      { kind: 'earn', target: HOST, pct: 50 },
    ]),
    row: 'layout',
  },
  gardenLights: {
    ...fixture('gardenLights', 'Garden Lights', 'common', { property: 'yard' }, [
      { kind: 'grantTag', target: HOST, tag: 'Pretty' },
      { kind: 'earn', target: { all: [HOST, { in: 'frontYard' }] }, pct: 50 },
    ]),
    row: 'layout',
  },
  chandelier: fixture(
    'chandelier',
    'Chandelier',
    'rare',
    { piece: ['diningRoom', 'livingRoom'] },
    [{ kind: 'xMult', times: 125, when: { host: { inSet: 'entertainer' } } }],
    0,
  ),
};

const bp = (
  id: BlueprintId,
  name: string,
  rarity: Rarity,
  modifiers: readonly Modifier[],
  offered = true,
): BlueprintDef => ({
  id,
  name,
  tier: 'core',
  rarity,
  price: { common: 4, uncommon: 6, rare: 8 }[rarity],
  modifiers,
  offered,
});

// The blueprints as Appendix B first encoded them. The game's own were re-weighed in D-143;
// these keep the plain encodings, so the rules tests see one modifier of each kind.
export const TEST_BLUEPRINTS: Record<BlueprintId, BlueprintDef> = {
  fengShui: bp('fengShui', 'Feng Shui', 'common', [
    { kind: 'earn', target: { property: 'view' }, pct: 50 },
  ]),
  curbAppeal: bp('curbAppeal', 'Curb Appeal', 'common', [
    { kind: 'earn', target: { in: 'frontYard' }, pct: 100 },
  ]),
  quietHours: bp('quietHours', 'Quiet Hours', 'common', [
    { kind: 'earn', target: { tag: 'Quiet' }, pct: 50 },
  ]),
  greenThumb: bp('greenThumb', 'Green Thumb', 'common', [
    { kind: 'earn', target: { tag: 'Green' }, pct: 50 },
  ]),
  partyHouse: bp('partyHouse', 'Party House', 'common', [
    { kind: 'earn', target: { tag: 'Social' }, pct: 50 },
  ]),
  waterfront: bp('waterfront', 'Waterfront', 'common', [
    { kind: 'earn', target: { touching: { feature: ['pond', 'creek'] } }, pct: 50 },
  ]),
  openConcept: bp('openConcept', 'Open Concept', 'uncommon', [
    { kind: 'link', among: ['kitchen', 'diningRoom', 'livingRoom'] },
  ]),
  goodBones: bp('goodBones', 'Good Bones', 'uncommon', [
    {
      kind: 'grantEffect',
      target: { property: 'room' },
      effect: { kind: 'growth', perWeek: 1, max: 10 },
    },
  ]),
  itsAHouse: bp('itsAHouse', 'It’s a House', 'uncommon', [
    { kind: 'mult', add: 15, per: { tag: 'House' } },
  ]),
  countryLiving: bp('countryLiving', 'Country Living', 'uncommon', [
    {
      kind: 'grantEffect',
      target: 'all',
      effect: { kind: 'neighbor', match: { feature: 'tree' }, amount: 1, max: 3 },
    },
  ]),
  moodLighting: bp('moodLighting', 'Mood Lighting', 'uncommon', [
    { kind: 'earn', target: { all: [{ property: 'room' }, { tag: 'Dark' }] }, pct: 100 },
  ]),
  showHome: bp('showHome', 'Show Home', 'uncommon', [
    { kind: 'earn', target: { hasFixture: 'any' }, pct: 50 },
  ]),
  solarPanels: bp('solarPanels', 'Solar Panels', 'uncommon', [
    {
      kind: 'grantEffect',
      target: { tag: 'Sunny' },
      effect: { kind: 'economy', budget: 1, every: 4 },
    },
  ]),
  crownJewel: bp('crownJewel', 'Crown Jewel', 'rare', [{ kind: 'bestPiece', pct: 100 }]),
  dreamHome: bp(
    'dreamHome',
    'Dream Home',
    'rare',
    [{ kind: 'rule', key: 'specBonus', add: 10 }],
    false,
  ),
  lastMinutePush: bp('lastMinutePush', 'Last-Minute Push', 'rare', [
    { kind: 'xMult', times: 200, when: 'lastWeekOfPhase' },
  ]),
  modelHome: bp('modelHome', 'Model Home', 'rare', [
    { kind: 'xMult', times: 100, plusPer: { per: { hasFixture: 'any' }, add: 10 } },
  ]),
  aheadOfSchedule: bp('aheadOfSchedule', 'Ahead of Schedule', 'rare', [
    { kind: 'xMult', times: 100, plusPer: { per: 'milestonesEarly', add: 20 } },
  ]),
};

export const TEST_CREWS: Record<CrewId, CrewDef> = {
  generalContractor: {
    id: 'generalContractor',
    name: 'General Contractor',
    tier: 'core',
    blurb: 'Reliable. One extra reroll each phase.',
    modifiers: [{ kind: 'rule', key: 'rerollsPerPhase', add: 1 }],
  },
  // M4b, as Appendix B encodes them.
  landscaper: {
    id: 'landscaper',
    name: 'Landscaper',
    tier: 'core',
    blurb: 'Yard pieces show up more and earn more.',
    modifiers: [
      { kind: 'drawWeight', target: { property: 'yard' }, pct: 50 },
      { kind: 'earn', target: { property: 'yard' }, pct: 25 },
    ],
    startReserve: ['sapling', 'fence'],
  },
  architect: {
    id: 'architect',
    name: 'Architect',
    tier: 'core',
    blurb: 'Special rooms in the draw; sets pay more.',
    modifiers: [
      { kind: 'drawWeight', target: { piece: ['playroom', 'library', 'mudroom', 'pool'] }, add: 5 },
      { kind: 'setBonus', pct: 50 },
    ],
  },
};

export const TEST_FEATURES: Record<FeatureId, FeatureDef> = {
  street: { id: 'street', name: 'Street', tier: 'core', tags: ['Loud'], blocks: false },
  tree: {
    id: 'tree',
    name: 'Tree',
    tier: 'core',
    tags: ['Quiet', 'Green'],
    blocks: false,
    clear: 'buildOver',
    viewSource: true,
  },
  pond: {
    id: 'pond',
    name: 'Pond',
    tier: 'core',
    tags: [],
    blocks: true,
    viewSource: true,
    body: true,
  },
  creek: {
    id: 'creek',
    name: 'Creek',
    tier: 'core',
    tags: [],
    blocks: true,
    viewSource: true,
    body: true,
  },
  boulder: {
    id: 'boulder',
    name: 'Boulder',
    tier: 'core',
    tags: [],
    blocks: true,
    clear: 'demolish',
    inert: true,
  },
  oldShed: {
    id: 'oldShed',
    name: 'Old Shed',
    tier: 'core',
    tags: [],
    blocks: true,
    clear: 'demolish',
    inert: true,
    size: [2, 2],
    reward: { tool: 'random' },
  },
  timeCapsule: {
    id: 'timeCapsule',
    name: 'Time Capsule',
    tier: 'core',
    tags: [],
    blocks: false,
    clear: 'buildOver',
    inert: true,
    reward: { budget: 3 },
  },
};

export const TEST_SETS: Record<SetId, SetDef> = {
  jackAndJill: {
    id: 'jackAndJill',
    name: 'Jack-and-Jill',
    tier: 'core',
    members: { bedroom: 2, bathroom: 1 },
    connected: true,
    hub: 'bathroom',
    points: 10,
    mult: 50,
    level: { points: 8, mult: 25 },
  },
  entertainer: {
    id: 'entertainer',
    name: 'Entertainer',
    tier: 'core',
    members: { kitchen: 1, diningRoom: 1, livingRoom: 1 },
    connected: true,
    points: 25,
    mult: 100,
    level: { points: 15, mult: 50 },
  },
  suite: {
    id: 'suite',
    name: 'Suite',
    tier: 'core',
    members: { bedroom: 1, bathroom: 1, closet: 1 },
    connected: true,
    points: 15,
    mult: 50,
    level: { points: 10, mult: 25 },
  },
  fullHouse: {
    id: 'fullHouse',
    name: 'Full House',
    tier: 'core',
    members: {
      bedroom: 1,
      bathroom: 1,
      kitchen: 1,
      diningRoom: 1,
      livingRoom: 1,
      closet: 1,
      hallway: 1,
      garage: 1,
      homeOffice: 1,
    },
    connected: false,
    maxInstances: 1,
    points: 40,
    mult: 100,
    times: 200,
    level: { points: 20, mult: 50 },
  },
};

const testClient = (id: ClientId, name: string): ClientDef => ({
  id,
  name,
  rarity: 'common',
  tier: 'core',
  brief: `${name}'s house.`,
  specs: [],
  tastes: [],
  pool: [],
  targetPct: 100,
  household: { bedrooms: [1, 2], arrivals: [] },
  changeOrders: [],
});

/**
 * Test clients have empty checklists, tastes, pools, households, and change orders, so rules
 * tests that don't care about clients score as before; client tests add their own with
 * withClient(). (TEST_BALANCE offers no change orders either: change-order tests turn them on.)
 */
export const TEST_CLIENTS: Record<ClientId, ClientDef> = {
  hendersons: testClient('hendersons', 'The Hendersons'),
  vladislav: { ...testClient('vladislav', 'Count Vladislav'), rarity: 'rare' },
  barkers: testClient('barkers', 'The Barkers'),
  juniper: { ...testClient('juniper', 'Juniper Vale'), rarity: 'uncommon' },
  dale: testClient('dale', 'Dale'),
};

export const TEST_LOT_BALANCE: LotBalance = {
  width: 24,
  height: 24,
  woodsClusters: [3, 4],
  woodsClusterSize: [15, 30],
  loneTrees: [6, 10],
  creekPct: 70,
  // Every test lot keeps its pond, as before D-119.
  pondPctCreek: 100,
  creekStreetGap: 6,
  pondSize: [2, 3],
  boulders: [6, 10],
  minFreePct: 85,
  minFreeStreetTiles: 10,
  minStreetSidePct: 60,
  maxAttempts: 50,
  // Rules tests place finds by hand (lotFromRows' S and K), so generated test lots have none.
  oldSheds: [0, 0],
  timeCapsules: [0, 0],
  findStreetGap: 4,
};

export const TEST_BALANCE: Balance = {
  lot: TEST_LOT_BALANCE,
  weeksPerPhase: 2,
  phases: [
    { name: 'Groundbreaking', target: 5 },
    { name: 'Foundation', target: 30 },
  ],
  rules: {
    rerollsPerPhase: 1,
    demolitions: 2,
    overtime: 2,
    roomsRow: 2,
    layoutRow: 2,
    earlyRewardPct: 100,
    reserveSlots: 2,
    supplySlots: 3,
    blueprintSlots: 4,
    shopPricePct: 100,
    specBonus: 25,
    interestMax: 0,
    // D-157: none, so legalActions and the bots' runs here are as before; strike tests add some.
    strikes: 0,
  },
  early: { budgetPerWeek: [2], scorePct: [10] },
  milestoneBudget: 3,
  // Off here, so the test content's runs end on the scores they always did; runloop.test.ts
  // turns it on for D-145's own tests.
  leftoverBudgetWow: 0,
  shop: {
    stock: [
      {
        blueprints: 2,
        cards: 2,
        tools: 0,
        crates: 0,
        upgrades: 0,
        housewarming: 0,
        rarity: [100, 0, 0],
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
    ],
    cardFixturePct: 50,
    piecePrice: 3,
    salePct: 50,
    sellPct: 50,
    refresh: { base: 2, step: 1 },
    services: {
      reroll: { base: 1, step: 1, max: 4 },
      demolition: { base: 1, step: 1, max: 4 },
      strike: { base: 2, step: 1, max: 5 },
    },
    skipReward: 1,
    strikeMinTypes: { rooms: 5, layout: 4 },
    crateOptions: 3,
    interestPer: 5,
  },
  fencedYardMin: 4,
  complexityPct: [
    [100, 30, 5],
    [100, 60, 25],
  ],
  verdicts: [
    { name: 'Fixer-Upper', minPctOfTarget: 0 },
    { name: 'Starter Home', minPctOfTarget: 100 },
    { name: 'Dream Home', minPctOfTarget: 200 },
  ],
  renovate: { pointsPerLevel: 4, maxLevel: 2 },
  drawAtLimitPct: 50,
  swapTries: 3,
  jobBoard: {
    contracts: 3,
    rarity: { common: 65, uncommon: 27, rare: 8 },
    firstClient: 'hendersons',
    firstSeed: 'firstlot',
    firstTargetPct: 80,
  },
  // No change orders unless a test turns them on (two phases: after milestone 1 is the one).
  changeOrderAfter: [],
  strikesPerMilestone: 0,
  // D-160: no standing stock, so the test content's reserves are as before; stock.test.ts
  // turns it on.
  standingStock: { fromPhase: 1, pieces: [], firstJobSlot: 1, refill: false },
};

const testTool = (
  id: ToolId,
  name: string,
  rarity: Rarity,
  use: ToolDef['use'],
  offered = true,
): ToolDef => ({ id, name, tier: 'core', rarity, price: PRICE[rarity], use, offered });

export const TEST_TOOLS: Record<ToolId, ToolDef> = {
  movingTruck: testTool('movingTruck', 'Moving Truck', 'uncommon', { kind: 'move' }),
  copyMachine: testTool('copyMachine', 'Copy Machine', 'rare', { kind: 'copy' }),
  rushOrder: testTool('rushOrder', 'Rush Order', 'common', {
    kind: 'weekModifiers',
    modifiers: [{ kind: 'mult', add: 50 }],
  }),
  openHouseParty: testTool('openHouseParty', 'Open House Party', 'common', {
    kind: 'weekModifiers',
    modifiers: [
      { kind: 'earn', target: { tag: 'Social' }, pct: 100 },
      { kind: 'earn', target: { tag: 'Pretty' }, pct: 100 },
    ],
  }),
  catalog: testTool('catalog', 'Catalog', 'common', { kind: 'specialHand' }),
  fertilizer: testTool('fertilizer', 'Fertilizer', 'uncommon', { kind: 'advanceTimers', weeks: 2 }),
  inspectorsVisit: testTool(
    'inspectorsVisit',
    'Inspector’s Visit',
    'uncommon',
    { kind: 'weekModifiers', modifiers: [{ kind: 'rule', key: 'specBonus', add: 25 }] },
    false,
  ),
  dumpster: testTool('dumpster', 'Dumpster', 'common', {
    kind: 'reward',
    reward: { demolitions: 2 },
  }),
  remodelJackAndJill: testTool('remodelJackAndJill', 'Remodel Plans: Jack-and-Jill', 'common', {
    kind: 'levelSet',
    set: 'jackAndJill',
  }),
  remodelEntertainer: testTool('remodelEntertainer', 'Remodel Plans: Entertainer', 'common', {
    kind: 'levelSet',
    set: 'entertainer',
  }),
  remodelSuite: testTool('remodelSuite', 'Remodel Plans: Suite', 'common', {
    kind: 'levelSet',
    set: 'suite',
  }),
  remodelFullHouse: testTool('remodelFullHouse', 'Remodel Plans: Full House', 'uncommon', {
    kind: 'levelSet',
    set: 'fullHouse',
  }),
  weekendCrew: testTool('weekendCrew', 'Weekend Crew', 'rare', { kind: 'extraPlay' }),
};

const testUpgrade = (
  id: UpgradeId,
  name: string,
  price: number,
  mod: UpgradeDef['modifiers'][number],
): UpgradeDef => ({ id, name, tier: 'core', price, modifiers: [mod] });

export const TEST_UPGRADES: Record<UpgradeId, UpgradeDef> = {
  storageUnit: testUpgrade('storageUnit', 'Storage Unit', 6, {
    kind: 'rule',
    key: 'reserveSlots',
    add: 1,
  }),
  toolBelt: testUpgrade('toolBelt', 'Tool Belt', 6, { kind: 'rule', key: 'supplySlots', add: 1 }),
  draftingTable: testUpgrade('draftingTable', 'Drafting Table', 7, {
    kind: 'rule',
    key: 'blueprintSlots',
    add: 1,
  }),
  biggerTruck: testUpgrade('biggerTruck', 'Bigger Truck', 8, {
    kind: 'rule',
    key: 'roomsRow',
    add: 1,
  }),
  foreman: testUpgrade('foreman', 'Foreman', 7, { kind: 'rule', key: 'rerollsPerPhase', add: 1 }),
  supplierDiscount: testUpgrade('supplierDiscount', 'Supplier Discount', 7, {
    kind: 'rule',
    key: 'shopPricePct',
    pct: -25,
  }),
  savingsAccount: testUpgrade('savingsAccount', 'Savings Account', 6, {
    kind: 'rule',
    key: 'interestMax',
    add: 3,
  }),
};

export const TEST_CRATES: Record<CrateId, CrateDef> = {
  blueprintFolio: {
    id: 'blueprintFolio',
    name: 'Blueprint Folio',
    tier: 'core',
    price: 4,
    contents: 'blueprint',
  },
  fixtureCrate: {
    id: 'fixtureCrate',
    name: 'Fixture Crate',
    tier: 'core',
    price: 4,
    contents: 'fixture',
  },
  gardenCenter: {
    id: 'gardenCenter',
    name: 'Garden Center',
    tier: 'core',
    price: 4,
    contents: 'piece',
    pool: 'all',
    filter: { any: [{ property: 'yard' }, { property: 'outbuilding' }] },
  },
  showroom: {
    id: 'showroom',
    name: 'Showroom',
    tier: 'core',
    price: 4,
    contents: 'piece',
    pool: 'special',
  },
};

const ROOMS = { property: 'room' } as const;

/**
 * The change orders (M4b), as Appendix B encodes them, with fixed rewards (3, 4, 5). No test
 * client lists its own and TEST_BALANCE offers none, so they only come up where a test asks.
 */
export const TEST_CHANGE_ORDERS: Record<ChangeOrderId, ChangeOrderDef> = {
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
    text: 'Pools and shady spots earn double; Sunny rooms earn half.',
    modifiers: [
      { kind: 'earn', target: { piece: 'pool' }, pct: 100 },
      { kind: 'earn', target: { touching: { feature: 'tree' } }, pct: 100 },
      { kind: 'earn', target: { all: [ROOMS, { tag: 'Sunny' }] }, pct: -50 },
    ],
  },
  coldSnap: {
    id: 'coldSnap',
    name: 'Cold snap',
    scope: 'generic',
    tier: 'core',
    kind: 'phase',
    text: 'Rooms with a Fireplace earn double; Bathrooms earn half.',
    modifiers: [
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
    text: 'Green pieces earn double; Patios earn nothing.',
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
    text: 'Nothing new in the front yard.',
    forbid: { in: 'frontYard' },
    reward: { budget: 4 },
  },
  goldenRetriever: {
    id: 'goldenRetriever',
    name: 'Golden retriever',
    scope: 'hendersons',
    tier: 'core',
    kind: 'request',
    text: 'A Doghouse in a fenced yard.',
    condition: { count: { all: [{ piece: 'doghouse' }, { in: 'fencedYard' }] }, min: 1 },
    reward: { budget: 5 },
  },
  thanksgiving: {
    id: 'thanksgiving',
    name: 'Thanksgiving',
    scope: 'hendersons',
    tier: 'core',
    kind: 'phase',
    text: 'The Entertainer pays double.',
    modifiers: [{ kind: 'setBonus', set: 'entertainer', pct: 100 }],
  },
  covenVisiting: {
    id: 'covenVisiting',
    name: 'The coven is visiting',
    scope: 'vladislav',
    tier: 'core',
    kind: 'request',
    text: 'Two new interior rooms.',
    condition: { countNew: { all: [ROOMS, { property: 'interior' }] }, min: 2 },
    reward: { budget: 5 },
  },
  eternalNight: {
    id: 'eternalNight',
    name: 'Eternal night',
    scope: 'vladislav',
    tier: 'core',
    kind: 'phase',
    text: 'Every room counts as Dark.',
    modifiers: [{ kind: 'grantTag', target: ROOMS, tag: 'Dark' }],
  },
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
    name: 'Agility course',
    scope: 'barkers',
    tier: 'core',
    kind: 'request',
    text: 'Two Lawns side by side in a fenced yard.',
    condition: { group: { all: [{ piece: 'lawn' }, { in: 'fencedYard' }] }, minTiles: 8 },
    reward: { budget: 5 },
  },
  puppies: {
    id: 'puppies',
    name: 'A litter of puppies',
    scope: 'barkers',
    tier: 'core',
    kind: 'phase',
    text: 'Pet pieces and Lawns earn double; Flower Beds earn nothing.',
    modifiers: [
      { kind: 'earn', target: { tag: 'Pet' }, pct: 100 },
      { kind: 'earn', target: { piece: 'lawn' }, pct: 100 },
      { kind: 'earnNothing', target: { piece: 'flowerBed' } },
    ],
  },
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
    name: 'Tea garden',
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
    text: 'Rooms with a view earn double; Closets and Hallways earn nothing.',
    modifiers: [
      { kind: 'earn', target: { all: [ROOMS, { property: 'view' }] }, pct: 100 },
      { kind: 'earnNothing', target: { piece: 'closet' } },
      { kind: 'earnNothing', target: { piece: 'hallway' } },
    ],
  },
  bigDeadline: {
    id: 'bigDeadline',
    name: 'Big deadline',
    scope: 'dale',
    tier: 'core',
    kind: 'restriction',
    text: 'Place nothing Loud next phase.',
    forbid: { tag: 'Loud' },
    reward: { budget: 4 },
  },
  startedAPodcast: {
    id: 'startedAPodcast',
    name: 'Started a podcast',
    scope: 'dale',
    tier: 'core',
    kind: 'request',
    text: 'A new interior room.',
    condition: { countNew: { all: [ROOMS, { property: 'interior' }] }, min: 1 },
    reward: { budget: 4 },
  },
  outOfOffice: {
    id: 'outOfOffice',
    name: 'Out of office',
    scope: 'dale',
    tier: 'core',
    kind: 'phase',
    text: 'Outdoor pieces earn double; Home Offices earn nothing.',
    modifiers: [
      { kind: 'earn', target: { tag: 'Outdoor' }, pct: 100 },
      { kind: 'earnNothing', target: { piece: 'homeOffice' } },
    ],
  },
};

/**
 * The lot traits (D-119), without modifiers: generated test lots have creeks on 70% of seeds,
 * and Creekside would change their scores. Tests of Creekside give it its pay (modifiers.test.ts).
 */
export const TEST_LOT_TRAITS: Record<LotTraitId, LotTraitDef> = {
  creekside: {
    id: 'creekside',
    name: 'Creekside',
    blurb: 'Only a Driveway crosses it.',
    when: { terrain: 'creek', min: 1 },
    modifiers: [],
  },
  wooded: {
    id: 'wooded',
    name: 'Wooded',
    blurb: 'Lots of Trees.',
    when: { terrain: 'tree', min: 100 },
    modifiers: [],
    suits: ['vladislav'],
  },
};

export const TEST_CONTENT: Content = {
  pieces: TEST_PIECES,
  features: TEST_FEATURES,
  sets: TEST_SETS,
  crews: TEST_CREWS,
  clients: TEST_CLIENTS,
  fixtures: TEST_FIXTURES,
  blueprints: TEST_BLUEPRINTS,
  tools: TEST_TOOLS,
  upgrades: TEST_UPGRADES,
  crates: TEST_CRATES,
  changeOrders: TEST_CHANGE_ORDERS,
  lotTraits: TEST_LOT_TRAITS,
  balance: TEST_BALANCE,
};

/** The default setup for tests. */
export const setup = (seed: string, clientId: ClientId = 'hendersons'): RunSetup => ({
  seed,
  clientId,
  crewId: 'generalContractor',
  mode: 'standard',
});

/** Content whose client (the Hendersons by default) has these fields. */
export function withClient(
  overrides: Partial<ClientDef>,
  base: Content = TEST_CONTENT,
  id: ClientId = 'hendersons',
): Content {
  return { ...base, clients: { ...base.clients, [id]: { ...base.clients[id], ...overrides } } };
}

export function withPieces(
  overrides: Partial<Record<PieceId, Partial<PieceDef>>>,
  base: Content = TEST_CONTENT,
): Content {
  const pieces = { ...base.pieces };
  for (const [id, o] of Object.entries(overrides) as [PieceId, Partial<PieceDef>][]) {
    pieces[id] = { ...pieces[id], ...o };
  }
  return { ...base, pieces };
}

/** A piece at (x, y), turned `rot`; a pack (D-106) can take its own tiles as ASCII rows. */
export type Placement = [PieceId, number, number, Rot?, (readonly string[])?];

/** A house on an ASCII lot (. ground, T tree, P pond, C creek, B boulder), pieces placed unchecked. */
export function houseFrom(
  content: Content,
  rows: readonly string[],
  placements: readonly Placement[] = [],
): HouseState {
  let house: HouseState = { lot: lotFromRows(rows), pieces: [], nextUid: 1 };
  for (const [id, x, y, rot = 0, shape] of placements) {
    // Building over Trees removes them, as a real placement would.
    const cleared = placedCells(shape ?? content.pieces[id].shape, x, y, rot).filter(
      (c) => terrainAt(house.lot, c.x, c.y) === 'tree',
    );
    house = addPiece(house, id, x, y, rot, 1, cleared, shape).house;
  }
  return house;
}

/** An empty lot of the given size. */
export function emptyRows(width: number, height: number): string[] {
  return Array.from({ length: height }, () => '.'.repeat(width));
}

/**
 * A hand as the rules draw it (D-121), before any swaps: the Rooms row, then the Layout row,
 * each on its own stream. Row sizes default to the content's rules.
 */
export function drawRows(
  content: Content,
  seed: string,
  phase: number,
  slot: string,
  n: number,
  opts: DrawOptions = {},
  sizes: { rooms?: number; layout?: number } = {},
): Card[] {
  const size = {
    rooms: sizes.rooms ?? content.balance.rules.roomsRow,
    layout: sizes.layout ?? content.balance.rules.layoutRow,
  };
  return DRAW_ROWS.flatMap((row) =>
    drawHand(content, seed, phase, slot, n, size[row], { ...opts, row }),
  );
}

/** A hand before its swaps (D-121): each swapped card back to the one it replaced. */
export function beforeSwaps(hand: readonly Card[], swapped: readonly SwappedCard[] = []): Card[] {
  return hand.map((c, i) => swapped.find((w) => w.i === i)?.was ?? c);
}

/** A `handDrawn` event's hand as it was drawn, before its swaps. */
export function drawnBefore(e: GameEvent | undefined): Card[] {
  if (e?.t !== 'handDrawn') throw new Error(`not a handDrawn event: ${e?.t}`);
  return beforeSwaps(e.hand, e.swapped);
}
