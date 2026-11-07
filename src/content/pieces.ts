// The base-pool pieces (Appendix B of implementation-plan.md): 9 indoor types, 7 yard types,
// and 3 "-house" outbuildings, as 23 cards (shape variants are separate cards sharing a type),
// then the 9 special pieces (weight 0): the shop's, the crates', and the Catalog's.
// Shapes and tags Appendix B leaves open come from content-brainstorm.md §3, §4, and §6
// (D-067). Complexity is Appendix A · M1's list (D-055). Every card is weight 10, so a type
// with two cards comes up about twice as often. Numbers are placeholders for the sim and
// playtests to tune.

import type { PieceDef, PieceId } from '../rules/index.ts';

export const PIECES: Readonly<Record<PieceId, PieceDef>> = {
  bedroom: {
    id: 'bedroom',
    name: 'Bedroom',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Quiet'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 3 },
      {
        kind: 'neighbor',
        match: { any: [{ feature: 'tree' }, { tag: 'Quiet' }] },
        amount: 1,
        max: 3,
      },
      { kind: 'neighbor', match: { tag: 'Loud' }, amount: -2 }, // the street is Loud
    ],
  },
  bathroom: {
    id: 'bathroom',
    name: 'Bathroom',
    tier: 'core',
    category: 'indoor',
    shape: ['#'],
    tags: ['Wet'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [
      // Earns nothing alone; capped at one Bedroom because Jack-and-Jill pays for two (D-046).
      { kind: 'neighbor', match: { piece: 'bedroom' }, amount: 3, max: 1 },
      { kind: 'neighbor', match: { piece: 'kitchen' }, amount: -2 },
    ],
  },
  // Kitchen and L-Kitchen are two cards sharing a type. Both earn per touching Dining Room or
  // Herb Garden.
  kitchen: {
    id: 'kitchen',
    name: 'Kitchen',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Social'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [{ kind: 'neighbor', match: { piece: ['diningRoom', 'herbGarden'] }, amount: 2 }],
  },
  lKitchen: {
    id: 'lKitchen',
    name: 'L-Kitchen',
    tier: 'core',
    category: 'indoor',
    countsAs: 'kitchen',
    shape: ['#.', '##'],
    tags: ['Social'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [{ kind: 'neighbor', match: { piece: ['diningRoom', 'herbGarden'] }, amount: 2 }],
  },
  diningRoom: {
    id: 'diningRoom',
    name: 'Dining Room',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Social'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [
      { kind: 'aura', match: { piece: ['kitchen', 'livingRoom'] }, scope: 'adjacent', pct: 50 },
    ],
  },
  livingRoom: {
    id: 'livingRoom',
    name: 'Living Room',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##', '##'],
    tags: ['Social'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [{ kind: 'neighbor', match: { property: 'viewSource' }, amount: 2, max: 3 }],
  },
  closet: {
    id: 'closet',
    name: 'Closet',
    tier: 'core',
    category: 'indoor',
    shape: ['#'],
    tags: [],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    // A small steady earner; it completes the Suite set when sets arrive in M4a.
    effects: [{ kind: 'steady', amount: 1 }],
  },
  // Hallway and Long Hallway: two cards sharing a type. A connector links every room touching
  // it (or a connected group of them), and isn't a room or a neighbor for bonuses itself.
  hallway: {
    id: 'hallway',
    name: 'Hallway',
    tier: 'core',
    category: 'indoor',
    connector: true,
    shape: ['##'],
    tags: [],
    drawWeight: 10,
    complexity: 3,
    fromPhase: 0,
    effects: [{ kind: 'link' }],
  },
  longHallway: {
    id: 'longHallway',
    name: 'Long Hallway',
    tier: 'core',
    category: 'indoor',
    connector: true,
    countsAs: 'hallway',
    shape: ['###'],
    tags: [],
    drawWeight: 10,
    complexity: 3,
    fromPhase: 0,
    effects: [{ kind: 'link' }],
  },
  garage: {
    id: 'garage',
    name: 'Garage',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Loud'],
    drawWeight: 10,
    complexity: 2,
    fromPhase: 0,
    effects: [
      {
        kind: 'requires',
        condition: { touching: { any: [{ feature: 'street' }, { piece: 'driveway' }] } },
        blocksPlacement: true,
      },
      { kind: 'steady', amount: 1 },
      { kind: 'economy', budget: 1, every: 3 }, // garage sales
    ],
  },
  homeOffice: {
    id: 'homeOffice',
    name: 'Home Office',
    tier: 'core',
    category: 'indoor',
    shape: ['##'],
    tags: ['Quiet'],
    drawWeight: 10,
    complexity: 2,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 2 },
      { kind: 'neighbor', match: { tag: 'Loud' }, amount: -2 },
      { kind: 'economy', budget: 1, every: 2 },
    ],
  },
  lawn: {
    id: 'lawn',
    name: 'Lawn',
    tier: 'core',
    category: 'yard',
    shape: ['##', '##'],
    tags: ['Outdoor', 'Green'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 1 },
      { kind: 'neighbor', match: { piece: 'lawn' }, amount: 1, max: 4 },
    ],
  },
  sapling: {
    id: 'sapling',
    name: 'Sapling',
    tier: 'core',
    category: 'yard',
    shape: ['#'],
    tags: ['Green'],
    drawWeight: 10,
    complexity: 2,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 1 },
      // At the start of a week, 4 weeks after planting, it becomes a mature Tree: a lot
      // feature (Quiet, Green, a view), so it no longer counts as a piece.
      { kind: 'transform', into: { feature: 'tree' }, afterWeeks: 4 },
    ],
  },
  flowerBed: {
    id: 'flowerBed',
    name: 'Flower Bed',
    tier: 'core',
    category: 'yard',
    givesView: true,
    shape: ['#'],
    tags: ['Green', 'Pretty'],
    drawWeight: 10,
    complexity: 2,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 1 },
      // Curb appeal.
      { kind: 'conditional', when: { in: 'frontYard' }, effect: { kind: 'steady', amount: 2 } },
      { kind: 'neighbor', match: { piece: 'flowerBed' }, amount: 1 },
    ],
  },
  herbGarden: {
    id: 'herbGarden',
    name: 'Herb Garden',
    tier: 'core',
    category: 'yard',
    givesView: true,
    shape: ['##'],
    tags: ['Green'],
    drawWeight: 10,
    complexity: 2,
    fromPhase: 0,
    effects: [
      { kind: 'perTile', region: 'sunny', amount: 1 },
      { kind: 'aura', match: { piece: 'kitchen' }, scope: 'adjacent', pct: 25 },
    ],
  },
  patio: {
    id: 'patio',
    name: 'Patio',
    tier: 'core',
    category: 'yard',
    shape: ['##', '##'],
    tags: ['Outdoor', 'Social'],
    drawWeight: 10,
    complexity: 1,
    fromPhase: 0,
    effects: [
      // The Patio rule (D-093): an outdoor room earns nothing unless it touches a room. It
      // doesn't block placement, and touching only a Hallway doesn't count.
      { kind: 'requires', condition: { touching: { property: 'room' } }, blocksPlacement: false },
      { kind: 'neighbor', match: { piece: ['livingRoom', 'kitchen'] }, amount: 2 },
      { kind: 'neighbor', match: { property: 'viewSource' }, amount: 1, max: 3 },
    ],
  },
  // The Fence is a pack (D-102): one card places 1–8 connected tiles in a week, as one piece
  // (one enclosure payout). Fences are walls for the fenced-yard flood fill, and earn per tile
  // of the fenced yards they border, capped in total. It replaced the 1×4 and L-Fence cards,
  // at their combined weight; it suggests their shapes.
  fence: {
    id: 'fence',
    name: 'Fence',
    tier: 'core',
    category: 'yard',
    wall: true,
    shape: ['####'],
    pack: { maxTiles: 8, shapes: [['####'], ['#..', '#..', '###']] },
    tags: [],
    drawWeight: 20,
    complexity: 3,
    fromPhase: 0,
    effects: [{ kind: 'enclosure', perTile: 1, cap: 6 }],
  },
  // The Driveway is a pack (D-102): one card places 1–6 connected tiles that reach the street
  // or a Driveway, as one piece. The only piece that can be built over the creek (a culvert),
  // so a house on the far bank can still have a Garage. It replaced the 1×3 and 1×5 cards, at
  // their combined weight.
  driveway: {
    id: 'driveway',
    name: 'Driveway',
    tier: 'core',
    category: 'yard',
    canCover: ['creek'],
    shape: ['###'],
    pack: { maxTiles: 6, shapes: [['###'], ['#####']] },
    tags: [],
    drawWeight: 20,
    complexity: 2,
    fromPhase: 0,
    effects: [
      {
        kind: 'requires',
        condition: { touching: { any: [{ feature: 'street' }, { piece: 'driveway' }] } },
        blocksPlacement: true,
      },
      { kind: 'conditional', when: { in: 'frontYard' }, effect: { kind: 'steady', amount: 1 } },
    ],
  },
  // The "-house" family: small outbuildings that all carry the House tag.
  doghouse: {
    id: 'doghouse',
    name: 'Doghouse',
    tier: 'core',
    category: 'outbuilding',
    shape: ['#'],
    tags: ['Pet', 'House'],
    drawWeight: 10,
    complexity: 3,
    fromPhase: 0,
    effects: [
      // It can be built anywhere, but earns only inside a fenced yard.
      { kind: 'requires', condition: { in: 'fencedYard' }, blocksPlacement: false },
      { kind: 'steady', amount: 1 },
      { kind: 'neighbor', match: { piece: 'lawn' }, amount: 1 },
    ],
  },
  treehouse: {
    id: 'treehouse',
    name: 'Treehouse',
    tier: 'core',
    category: 'outbuilding',
    shape: ['##', '##'],
    tags: ['Kid', 'House'],
    drawWeight: 10,
    complexity: 2,
    fromPhase: 0,
    effects: [
      { kind: 'requires', condition: { touching: { feature: 'tree' } }, blocksPlacement: true },
      // Appendix B gives it only the Kid bonus, and the base pool has no other Kid piece until
      // the shop's Playroom (M3), so a small steady earning keeps it from being a dead card.
      { kind: 'steady', amount: 2 },
      // Treehouses don't count each other (D-079, D-093), so a cluster isn't the best spot.
      {
        kind: 'neighbor',
        match: { all: [{ tag: 'Kid' }, { not: { piece: 'treehouse' } }] },
        amount: 2,
      },
    ],
  },
  greenhouse: {
    id: 'greenhouse',
    name: 'Greenhouse',
    tier: 'core',
    category: 'outbuilding',
    givesView: true,
    shape: ['##', '##'],
    tags: ['Green', 'House'],
    drawWeight: 10,
    complexity: 3,
    fromPhase: 0,
    // Boosts the gardens around it (yard pieces that give a view: Flower Beds, Herb Gardens).
    effects: [
      {
        kind: 'aura',
        match: { all: [{ property: 'viewSource' }, { property: 'yard' }] },
        scope: 'adjacent',
        pct: 50,
      },
    ],
  },

  // ---------------------------------------------------------------------------------------
  // Special pieces (Appendix B; weight 0, so never in the base draw). The first four are Core
  // pieces from content-brainstorm.md; the last five were Stretch and are promoted as shop
  // pieces, so the shop has buildings worth buying (D-051). Shapes Appendix B leaves open are
  // D-082's defaults: Playroom and Library 2×2, Mudroom 1×2, Pool 2×3.
  playroom: {
    id: 'playroom',
    name: 'Playroom',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Loud', 'Kid'],
    drawWeight: 0,
    complexity: 2,
    fromPhase: 0,
    effects: [
      { kind: 'neighbor', match: { piece: 'bedroom' }, amount: 2 },
      // Noisy: the Quiet rooms around it lose a little.
      { kind: 'aura', match: { tag: 'Quiet' }, scope: 'adjacent', amount: -2 },
    ],
  },
  library: {
    id: 'library',
    name: 'Library',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Quiet'],
    drawWeight: 0,
    complexity: 1,
    fromPhase: 0,
    effects: [{ kind: 'neighbor', match: { tag: 'Quiet' }, amount: 2, max: 3 }],
  },
  mudroom: {
    id: 'mudroom',
    name: 'Mudroom',
    tier: 'core',
    category: 'indoor',
    shape: ['##'],
    tags: ['Pet'],
    drawWeight: 0,
    complexity: 3,
    fromPhase: 0,
    effects: [
      {
        kind: 'conditional',
        when: { borders: 'fencedYard' },
        effect: { kind: 'aura', match: { tag: 'Pet' }, scope: 'region', pct: 50 },
      },
    ],
  },
  pool: {
    id: 'pool',
    name: 'Pool',
    tier: 'core',
    category: 'yard',
    shape: ['###', '###'],
    tags: ['Wet', 'Sunny', 'Loud'],
    drawWeight: 0,
    complexity: 2,
    fromPhase: 0,
    effects: [
      { kind: 'rhythm', every: 3, amount: 12 },
      // Leaves in the water.
      { kind: 'neighbor', match: { feature: 'tree' }, amount: -2, max: 3 },
    ],
  },
  sunroom: {
    id: 'sunroom',
    name: 'Sunroom',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##'],
    tags: ['Sunny'],
    drawWeight: 0,
    complexity: 2,
    fromPhase: 0,
    effects: [{ kind: 'perTile', region: 'sunny', amount: 2 }],
  },
  hotTub: {
    id: 'hotTub',
    name: 'Hot Tub',
    tier: 'core',
    category: 'yard',
    shape: ['#'],
    tags: ['Wet', 'Social'],
    drawWeight: 0,
    complexity: 1,
    fromPhase: 0,
    effects: [
      // The Patio rule (D-093): an outdoor room earns nothing unless it touches a room. It
      // doesn't block placement, and touching only a Hallway doesn't count.
      { kind: 'requires', condition: { touching: { property: 'room' } }, blocksPlacement: false },
      { kind: 'neighbor', match: { piece: 'patio' }, amount: 3 },
    ],
  },
  firePit: {
    id: 'firePit',
    name: 'Fire Pit',
    tier: 'core',
    category: 'yard',
    shape: ['#'],
    tags: ['Social'],
    drawWeight: 0,
    complexity: 2,
    fromPhase: 0,
    effects: [
      // The Patio rule (D-093): an outdoor room earns nothing unless it touches a room. It
      // doesn't block placement, and touching only a Hallway doesn't count.
      { kind: 'requires', condition: { touching: { property: 'room' } }, blocksPlacement: false },
      { kind: 'aura', match: { piece: 'patio' }, scope: 'adjacent', pct: 50 },
    ],
  },
  henhouse: {
    id: 'henhouse',
    name: 'Henhouse',
    tier: 'core',
    category: 'outbuilding',
    shape: ['##'],
    tags: ['House'],
    drawWeight: 0,
    complexity: 2,
    fromPhase: 0,
    effects: [
      { kind: 'economy', budget: 1, every: 2 }, // eggs
      { kind: 'neighbor', match: { piece: ['herbGarden', 'flowerBed'] }, amount: 1 },
    ],
  },
  birdhouse: {
    id: 'birdhouse',
    name: 'Birdhouse',
    tier: 'core',
    category: 'outbuilding',
    shape: ['#'],
    tags: ['House'],
    drawWeight: 0,
    complexity: 1,
    fromPhase: 0,
    effects: [{ kind: 'neighbor', match: { feature: 'tree' }, amount: 1, max: 3 }],
  },
};
