// Test helpers for the rules: a small, fixed Content and house builders. Rules tests use this
// rather than src/content, so tuning the real numbers never breaks a rules test. (Not to be
// confused with fixtures, which are game content: upgrades installed in a placed piece.)

import type {
  Balance,
  Content,
  FeatureDef,
  FeatureId,
  HouseState,
  LotBalance,
  PieceDef,
  PieceId,
  Rot,
  SetDef,
  SetId,
} from './index.ts';
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
};

export const TEST_LOT_BALANCE: LotBalance = {
  width: 24,
  height: 24,
  woodsClusters: [3, 4],
  woodsClusterSize: [15, 30],
  loneTrees: [6, 10],
  creekPct: 70,
  creekStreetGap: 6,
  pondSize: [2, 3],
  boulders: [6, 10],
  sunnyRows: 4,
  minFreePct: 85,
  minFreeStreetTiles: 10,
  minStreetSidePct: 60,
  maxAttempts: 50,
};

export const TEST_BALANCE: Balance = {
  lot: TEST_LOT_BALANCE,
  weeksPerPhase: 2,
  phases: [
    { name: 'Groundbreaking', target: 5 },
    { name: 'Foundation', target: 30 },
  ],
  handSize: 3,
  complexityPct: [
    [100, 30, 5],
    [100, 60, 25],
  ],
  verdicts: [
    { name: 'Fixer-Upper', minPctOfTarget: 0 },
    { name: 'Starter Home', minPctOfTarget: 100 },
    { name: 'Dream Home', minPctOfTarget: 200 },
  ],
};

export const TEST_CONTENT: Content = {
  pieces: TEST_PIECES,
  features: TEST_FEATURES,
  sets: TEST_SETS,
  balance: TEST_BALANCE,
};

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

export type Placement = [PieceId, number, number, Rot?];

/** A house on an ASCII lot (. ground, T tree, P pond, C creek, B boulder), pieces placed unchecked. */
export function houseFrom(
  content: Content,
  rows: readonly string[],
  placements: readonly Placement[] = [],
): HouseState {
  let house: HouseState = { lot: lotFromRows(rows), pieces: [], nextUid: 1 };
  for (const [id, x, y, rot = 0] of placements) {
    // Building over Trees removes them, as a real placement would.
    const cleared = placedCells(content.pieces[id].shape, x, y, rot).filter(
      (c) => terrainAt(house.lot, c.x, c.y) === 'tree',
    );
    house = addPiece(house, id, x, y, rot, 1, cleared).house;
  }
  return house;
}

/** An empty lot of the given size. */
export function emptyRows(width: number, height: number): string[] {
  return Array.from({ length: height }, () => '.'.repeat(width));
}
