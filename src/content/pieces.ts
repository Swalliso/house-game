// The base-pool pieces (Appendix B of implementation-plan.md): 9 indoor types, 7 yard types,
// and 3 "-house" outbuildings, as 23 cards (shape variants are separate cards sharing a type),
// then the 9 special pieces: the shop's, the crates', and the Catalog's (weight 0, but for the
// Sunroom, drawn from Foundation since D-120, and the Birdhouse and the Fire Pit, drawn from
// Roofing and Drywall since D-145), the Porch (D-145, drawn from Drywall), then (M4b) the 7
// member rooms (weight 0), which arrive with the household (D-103).
// Shapes and tags Appendix B leaves open come from content-brainstorm.md §3, §4, and §6
// (D-067). Complexity is Appendix A · M1's list (D-055). Every card is weight 10, so a type
// with two cards comes up about twice as often. Numbers are placeholders for the sim and
// playtests to tune.

import type { PieceDef, PieceId } from '../rules/index.ts';

/** The sun's payoff (D-120): the rooms people live in by day want a sunny wall. */
const WHILE_SUNNY = (amount: number) =>
  ({
    kind: 'conditional',
    when: { is: { tag: 'Sunny' } },
    effect: { kind: 'steady', amount },
  }) as const;

/**
 * The Old Shed's payoff (D-145, D-091): the pieces that would use a shed earn more beside it,
 * so keeping it competes with clearing it for its tool. The shed counts once.
 */
const SHED = (amount: number) =>
  ({ kind: 'neighbor', match: { feature: 'oldShed' }, amount, max: 1 }) as const;

/**
 * A yard piece's side (D-166): what goes out back (a Patio, a Lawn, a Pool, a Treehouse) earns
 * more in the back yard, behind the house's front, and what greets the street (the Porch, the
 * Driveway, the Flower Bed) in the front yard, between the house and the street. So where the
 * house sits decides how much room each side gets: a house against the street has no front
 * yard. The line comes last, so a hand card still shows what the piece is for; the board shades
 * the yard while the card is picked. The front pays more because it's the smaller side and its
 * pieces fewer; at +2 out back greedy took a yard piece over a room or a Hallway often enough
 * to lose 7 points of wins (D-166's trial).
 */
const BACK_YARD = {
  kind: 'conditional',
  when: { in: 'backYard' },
  effect: { kind: 'steady', amount: 1 },
} as const;
const FRONT_YARD = {
  kind: 'conditional',
  when: { in: 'frontYard' },
  effect: { kind: 'steady', amount: 2 },
} as const;

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
    perHouse: 1, // D-165: One Kitchen (and the L-Kitchen is one)
    effects: [
      { kind: 'neighbor', match: { piece: ['diningRoom', 'herbGarden'] }, amount: 2 },
      WHILE_SUNNY(2),
      { kind: 'steady', amount: 3 },
    ],
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
    effects: [
      { kind: 'neighbor', match: { piece: ['diningRoom', 'herbGarden'] }, amount: 2 },
      WHILE_SUNNY(2),
      { kind: 'steady', amount: 3 },
    ],
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
    perHouse: 1, // D-165: A living room or two's "at most one Dining Room"
    effects: [
      { kind: 'aura', match: { piece: ['kitchen', 'livingRoom'] }, scope: 'adjacent', pct: 50 },
      WHILE_SUNNY(2),
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
    perHouse: 2, // D-165: A living room or two
    effects: [
      { kind: 'neighbor', match: { property: 'viewSource' }, amount: 2, max: 3 },
      WHILE_SUNNY(2),
    ],
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
    // D-114 (playtest 4): a link alone paid almost nothing, so the hall pays for the rooms it
    // touches too. Connectors still aren't neighbors to other pieces (D-046).
    effects: [
      { kind: 'link' },
      { kind: 'neighbor', match: { property: 'room' }, amount: 2, max: 4 },
    ],
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
    // D-114 (playtest 4): a link alone paid almost nothing, so the hall pays for the rooms it
    // touches too. Connectors still aren't neighbors to other pieces (D-046).
    effects: [
      { kind: 'link' },
      { kind: 'neighbor', match: { property: 'room' }, amount: 2, max: 4 },
    ],
  },
  // The Garage is built like any room (D-140): it earns only while the street or a Driveway
  // touches it, as a Patio earns only beside a room (D-105). Until D-140 it couldn't be built
  // anywhere else, and with houses a median 10 rows back from the street the card had no legal
  // spot in 82% of the weeks it was offered. Unreached, it still counts for Full House.
  garage: {
    id: 'garage',
    name: 'Garage',
    tier: 'core',
    category: 'indoor',
    // It belongs to the drive and the street, and no checklist line asks for it (D-121).
    row: 'layout',
    shape: ['##', '##'],
    tags: ['Loud'],
    drawWeight: 10,
    complexity: 2,
    fromPhase: 0,
    perHouse: 1, // D-165: one Garage a house
    effects: [
      {
        kind: 'requires',
        condition: { touching: { any: [{ feature: 'street' }, { piece: 'driveway' }] } },
        blocksPlacement: false,
      },
      { kind: 'steady', amount: 5 },
      { kind: 'economy', budget: 1, every: 2 }, // garage sales
      SHED(3), // a workshop (D-145)
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
    perHouse: 2, // D-165: two Home Offices at most
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
      // A Boulder on the grass is something to climb (D-145).
      {
        kind: 'neighbor',
        match: { any: [{ piece: 'lawn' }, { feature: 'boulder' }] },
        amount: 1,
        max: 4,
      },
      BACK_YARD,
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
      // A rock garden (D-145): a Boulder counts as another bed would.
      {
        kind: 'neighbor',
        match: { any: [{ piece: 'flowerBed' }, { feature: 'boulder' }] },
        amount: 1,
      },
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
      SHED(2),
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
      BACK_YARD,
    ],
  },
  // The Fence is a pack (D-106): one card places 1–8 connected tiles in a week, as one piece
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
    // 10 in the two-card Layout row (D-121), where 20 would show it more often than one pool did.
    drawWeight: 10,
    complexity: 3,
    fromPhase: 0,
    effects: [{ kind: 'enclosure', perTile: 1, cap: 6 }],
  },
  // The Driveway is a pack (D-106): one card places 1–8 connected tiles that reach the street
  // or a Driveway, as one piece. Its job is the Garage (D-140): it pays for touching one, and
  // the Garage earns only once the drive (or the street) reaches it. 8 tiles, as the Fence: a
  // Garage on the street side of a median house is 8 rows back. The only piece that can be
  // built over the creek (a culvert), so a house on the far bank can still have a Garage. It
  // replaced the 1×3 and 1×5 cards, at their combined weight. D-166: it's a front-yard piece,
  // +2 while every tile is in the front yard (D-140 had +1 anywhere), and the board shades the
  // front yard while the card is picked, the answer to D-080's misread. Paid per tile, greedy
  // laid 8-tile drives as carpets (placed 0.14 → 0.95 a run).
  driveway: {
    id: 'driveway',
    name: 'Driveway',
    tier: 'core',
    category: 'yard',
    canCover: ['creek'],
    shape: ['###'],
    pack: { maxTiles: 8, shapes: [['###'], ['#####']] },
    tags: [],
    drawWeight: 10, // as the Fence (D-121)
    complexity: 2,
    fromPhase: 0,
    effects: [
      {
        kind: 'requires',
        condition: { touching: { any: [{ feature: 'street' }, { piece: 'driveway' }] } },
        blocksPlacement: true,
      },
      { kind: 'neighbor', match: { piece: 'garage' }, amount: 3, max: 1 },
      FRONT_YARD,
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
      BACK_YARD,
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
      BACK_YARD,
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
    // It earned nothing of its own until D-145: beside the Old Shed it has a potting shed.
    effects: [
      {
        kind: 'aura',
        match: { all: [{ property: 'viewSource' }, { property: 'yard' }] },
        scope: 'adjacent',
        pct: 50,
      },
      SHED(4),
    ],
  },

  // ---------------------------------------------------------------------------------------
  // Special pieces (Appendix B; weight 0, so never in the base draw, but for the Sunroom since
  // D-120, which left the shop for the weekly draw). The first four are Core
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
    perHouse: 1, // D-165: one of each special room
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
    perHouse: 1, // D-165: one of each special room
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
    perHouse: 1, // D-165: one of each special room
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
      BACK_YARD,
    ],
  },
  // In the weekly draw from Foundation (D-120): it was a special piece at +2 a tile on the
  // sunny side, and Sunny by its card wherever it stood. Now it's Sunny only on the sunny face.
  sunroom: {
    id: 'sunroom',
    name: 'Sunroom',
    tier: 'core',
    category: 'indoor',
    shape: ['##', '##'],
    tags: [],
    drawWeight: 5,
    complexity: 2,
    fromPhase: 1,
    perHouse: 1, // D-165: one of each special room
    effects: [WHILE_SUNNY(6)],
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
      BACK_YARD,
    ],
  },
  // In the weekly draw from Drywall (D-145), at half a card's weight: something to place late
  // that reads the finished house (its Patio) and the lot (Boulders to sit on). It was a special
  // piece, sold in the shop.
  firePit: {
    id: 'firePit',
    name: 'Fire Pit',
    tier: 'core',
    category: 'yard',
    shape: ['#'],
    tags: ['Social'],
    drawWeight: 5,
    complexity: 2,
    fromPhase: 4,
    effects: [
      // The Patio rule (D-093): an outdoor room earns nothing unless it touches a room. It
      // doesn't block placement, and touching only a Hallway doesn't count.
      { kind: 'requires', condition: { touching: { property: 'room' } }, blocksPlacement: false },
      { kind: 'aura', match: { piece: 'patio' }, scope: 'adjacent', pct: 50 },
      { kind: 'neighbor', match: { feature: 'boulder' }, amount: 2, max: 2 },
      BACK_YARD,
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
      SHED(2), // the feed's in the shed
    ],
  },
  // In the weekly draw from Roofing (D-145), at half a card's weight: a small late piece that
  // reads the lot's Trees. It was a special piece, sold in the shop.
  birdhouse: {
    id: 'birdhouse',
    name: 'Birdhouse',
    tier: 'core',
    category: 'outbuilding',
    shape: ['#'],
    tags: ['House'],
    drawWeight: 5,
    complexity: 1,
    fromPhase: 3,
    effects: [{ kind: 'neighbor', match: { feature: 'tree' }, amount: 1, max: 3 }],
  },
  // D-145: the late game's own piece, in the weekly draw from Drywall at half a card's weight.
  // It reads the finished house: every room it touches earns more, so the best spot is a notch
  // between the rooms that earn most, and a Renovation or a fixture there pays again. The +1 a
  // room is so it earns in its own name: a piece that only boosts others shows 0 in the tally
  // and "Nothing yet" in Inspect, which read as broken in the browser pass.
  porch: {
    id: 'porch',
    name: 'Porch',
    tier: 'core',
    category: 'yard',
    shape: ['##'],
    tags: ['Outdoor'],
    drawWeight: 5,
    complexity: 2,
    fromPhase: 4,
    effects: [
      { kind: 'aura', match: { property: 'room' }, scope: 'adjacent', pct: 25 },
      { kind: 'neighbor', match: { property: 'room' }, amount: 1, max: 4 },
      FRONT_YARD,
    ],
  },

  // ---------------------------------------------------------------------------------------
  // Member rooms (M4b, D-103): each arrives in the reserve with a member of a client's
  // household (households.ts); weight 0, and never drawn, sold, copied, or in a crate. Each
  // counts as a Bedroom (Room for everyone, the Bathroom rule, the Bedroom limit, and sets),
  // and from its member's arrival on, Room for everyone needs it. The Hendersons' are the
  // systems review's (§4); the rest are simple, in the same range, each fitting its client.
  nursery: {
    id: 'nursery',
    name: 'Nursery',
    tier: 'core',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##', '##'],
    tags: ['Quiet', 'Kid'],
    drawWeight: 0,
    complexity: 2,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 2 },
      { kind: 'neighbor', match: { piece: 'bedroom' }, amount: 2, max: 2 },
      // The twins grow up: 8 weeks after it's placed, at the start of a week. Its shape is the
      // Kids' Room's, so it grows in place, keeping its level and fixture (D-102).
      { kind: 'transform', into: { piece: 'kidsRoom' }, afterWeeks: 8 },
    ],
  },
  kidsRoom: {
    id: 'kidsRoom',
    name: 'Kids’ Room',
    tier: 'core',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##', '##'],
    tags: ['Kid'],
    drawWeight: 0,
    complexity: 1,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 4 },
      {
        kind: 'neighbor',
        match: { any: [{ tag: 'Kid' }, { feature: 'tree' }] },
        amount: 2,
        max: 3,
      },
    ],
  },
  grandmasRoom: {
    id: 'grandmasRoom',
    name: 'Grandma’s Room',
    tier: 'core',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##', '##'],
    tags: ['Quiet'],
    drawWeight: 0,
    complexity: 1,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 3 },
      {
        kind: 'neighbor',
        match: { piece: ['bathroom', 'livingRoom', 'kitchen'] },
        amount: 2,
        max: 3,
      },
      { kind: 'neighbor', match: { piece: ['flowerBed', 'herbGarden'] }, amount: 1, max: 2 },
    ],
  },
  // Count Vladislav's man, Renfield: a small room that wants to be in the middle of the house,
  // where it's Dark (and the Count's Dark pieces earn double).
  renfieldsRoom: {
    id: 'renfieldsRoom',
    name: 'Renfield’s Room',
    tier: 'core',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##'],
    tags: ['Quiet'],
    drawWeight: 0,
    complexity: 1,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 2 },
      { kind: 'neighbor', match: { property: 'room' }, amount: 1, max: 3 },
    ],
  },
  // The Barkers' Nana likes the dogs close by: a Doghouse outside her window, or the Mudroom.
  nanasRoom: {
    id: 'nanasRoom',
    name: 'Nana’s Room',
    tier: 'core',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##', '##'],
    tags: ['Quiet'],
    drawWeight: 0,
    complexity: 1,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 3 },
      { kind: 'neighbor', match: { tag: 'Pet' }, amount: 2, max: 2 },
    ],
  },
  // Juniper's Rowan paints: a small studio that wants a view (and Juniper wants rooms with one).
  rowansStudio: {
    id: 'rowansStudio',
    name: 'Rowan’s Studio',
    tier: 'core',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##'],
    tags: ['Quiet'],
    drawWeight: 0,
    complexity: 1,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 2 },
      { kind: 'neighbor', match: { property: 'viewSource' }, amount: 2, max: 2 },
    ],
  },
  // Dale's daughter Ivy does her homework beside his office.
  ivysRoom: {
    id: 'ivysRoom',
    name: 'Ivy’s Room',
    tier: 'core',
    category: 'indoor',
    countsAs: 'bedroom',
    member: true,
    shape: ['##', '##'],
    tags: ['Kid'],
    drawWeight: 0,
    complexity: 1,
    fromPhase: 0,
    effects: [
      { kind: 'steady', amount: 3 },
      { kind: 'neighbor', match: { piece: 'homeOffice' }, amount: 2, max: 1 },
    ],
  },
};
