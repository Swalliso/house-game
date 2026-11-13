// The public API of the pure rules module and all its shared types: src/ui and sim/ import
// only from here (implementation-plan.md §4). Each phase writes out the types it adds. M1
// covered the vertical slice: the lot, placement, steady/neighbor/aura effects, two sets,
// Points × Mult scoring, hands, and run codes. M2 adds the full run (7 milestones, overtime,
// early completion with fast-forward, rerolls, demolitions, the free redraw, the forecast),
// every layout property, the remaining effect kinds, the base-pool pieces, and crews' `rule`
// modifiers (for the General Contractor). M3a adds the economy: the full modifier set and every
// rule key, fixtures, blueprints, the special pieces, the reserve, supplies, and blueprint
// slots, and the shop between milestones (offers, buying, selling, the sale, the refresh, and
// the services, including D-076's strike). M3b adds tools (with D-075's Weekend Crew),
// company upgrades, crates and the Housewarming crate, Savings Account interest, and the finds
// (the Old Shed and Time Capsules). M4a adds clients, their checklists, sets, and Renovate. M4b
// adds change orders (a 'changeOrder' screen after milestones 2, 4, and 6), the household's
// arrivals (D-103: member rooms that land in the reserve), and the Landscaper and Architect.
//
// Pure means no DOM, no Preact, no Math.random, no Date, and imports only from src/rules
// and src/content. tsconfig.rules.json and purity.test.ts enforce it.

import { CONTENT } from '../content/index.ts';
import { createRules as bindRules } from './run.ts';

// ---------------------------------------------------------------------------------------
// Ids. String-literal unions, so a typo in content is a compile error (D-038). Later phases
// extend them.

export type PieceId =
  // Indoor rooms (base pool). Shape variants are separate cards sharing a type (`countsAs`).
  | 'bedroom'
  | 'bathroom'
  | 'kitchen'
  | 'lKitchen'
  | 'diningRoom'
  | 'livingRoom'
  | 'closet'
  | 'hallway'
  | 'longHallway'
  | 'garage'
  | 'homeOffice'
  // Yard pieces (base pool).
  | 'lawn'
  | 'sapling'
  | 'flowerBed'
  | 'herbGarden'
  | 'patio'
  // Packs (D-106): one card places several connected tiles as one piece.
  | 'fence'
  | 'driveway'
  // "-house" outbuildings (base pool).
  | 'doghouse'
  | 'treehouse'
  | 'greenhouse'
  // Special pieces (weight 0): the shop, crates, and the Catalog (Appendix B).
  | 'playroom'
  | 'library'
  | 'mudroom'
  | 'pool'
  | 'sunroom'
  | 'hotTub'
  | 'firePit'
  | 'henhouse'
  | 'birdhouse'
  // D-145: a late piece in the weekly draw from Drywall; every room it touches earns more.
  | 'porch'
  // Member rooms (M4b, D-103): each arrives with a member of a client's household, into the
  // reserve. Never drawn, sold, or in the shop, a crate, or the Catalog; they count as Bedrooms.
  | 'nursery'
  | 'kidsRoom'
  | 'grandmasRoom'
  | 'renfieldsRoom'
  | 'nanasRoom'
  | 'rowansStudio'
  | 'ivysRoom';

/** Fixtures (D-050): installed in a placed piece. 7 for rooms, 3 for the yard, and the Chandelier. */
export type FixtureId =
  | 'fireplace'
  | 'skylight'
  | 'blackoutCurtains'
  | 'soundproofing'
  | 'kitchenIsland'
  | 'bunkBeds'
  | 'bayWindow'
  | 'sprinkler'
  | 'pergola'
  | 'gardenLights'
  | 'chandelier';

/** Blueprints (D-051, D-056): run-long rule benders in their own slots. */
export type BlueprintId =
  | 'fengShui'
  | 'curbAppeal'
  | 'quietHours'
  | 'greenThumb'
  | 'partyHouse'
  | 'waterfront'
  | 'openConcept'
  | 'goodBones'
  | 'itsAHouse'
  | 'countryLiving'
  | 'moodLighting'
  | 'showHome'
  | 'solarPanels'
  | 'crownJewel'
  | 'dreamHome'
  | 'lastMinutePush'
  | 'modelHome'
  | 'aheadOfSchedule';

/**
 * Tools (M3b): one-shot free actions from the supplies. The Remodel Plans for Suite and Full
 * House join once M4a adds those sets. Weekend Crew is D-075's banked building.
 */
export type ToolId =
  | 'movingTruck'
  | 'copyMachine'
  | 'rushOrder'
  | 'openHouseParty'
  | 'catalog'
  | 'fertilizer'
  | 'inspectorsVisit'
  | 'dumpster'
  | 'remodelJackAndJill'
  | 'remodelEntertainer'
  | 'remodelSuite'
  | 'remodelFullHouse'
  | 'weekendCrew';

/** Company upgrades (M3b): permanent `rule` modifiers, one offered per visit from shop 2. */
export type UpgradeId =
  | 'storageUnit'
  | 'toolBelt'
  | 'draftingTable'
  | 'biggerTruck'
  | 'foreman'
  | 'supplierDiscount'
  | 'savingsAccount';

/** Crates (M3b): open one and keep 1 of 3. */
export type CrateId = 'blueprintFolio' | 'fixtureCrate' | 'gardenCenter' | 'showroom';

/** Shown on every blueprint, fixture, and tool as a colored border plus a label (D-051). */
export type Rarity = 'common' | 'uncommon' | 'rare';

/** Lot features (D-049). The street runs along the bottom edge, outside the grid. Finds (M3b) pay once. */
export type FeatureId =
  'street' | 'tree' | 'pond' | 'creek' | 'lake' | 'boulder' | 'oldShed' | 'timeCapsule';
/** The features that sit on tiles of the lot. */
export type TerrainId = Exclude<FeatureId, 'street'>;

/**
 * Sets (D-056): a poker-hand ladder. M4a adds the Suite and Full House; D-164 the yard sets,
 * whose members include yard pieces and outbuildings.
 */
export type SetId =
  | 'jackAndJill'
  | 'suite'
  | 'entertainer'
  | 'fullHouse'
  | 'backyard'
  | 'harvest'
  | 'dogRun'
  | 'playYard'
  | 'driveIn';

/** Crews (D-012): picked at the start of a run. The General Contractor is the default. */
export type CrewId = 'generalContractor' | 'landscaper' | 'architect';

/** Clients (M4a): who the house is for. Each brings a checklist, tastes, and a pool. */
export type ClientId = 'hendersons' | 'vladislav' | 'barkers' | 'juniper' | 'dale';

/** Lot traits (D-119, D-166): what a lot has that changes how you'd build there. */
export type LotTraitId =
  'creekside' | 'pondside' | 'wooded' | 'rocky' | 'open' | 'lakefront' | 'oldWoods';

/**
 * A lot's kind (D-166): drawn once the lot has passed its checks. A plain lot stays as drawn;
 * the others are shaped toward a trait (more Boulders, no woods, a bigger pond, D-174's lake
 * along the back, a creek through the middle, old woods whose Trees stay).
 */
export type LotKind = 'plain' | 'rocky' | 'open' | 'pond' | 'lake' | 'split' | 'oldWoods';
export type ShapedKind = Exclude<LotKind, 'plain'>;

/**
 * A run's biome (D-174): the lot's look, and the family of lot kinds it deals. The first job's
 * lot is always a meadow, today's look.
 */
export type BiomeId = 'meadow' | 'lakeside' | 'autumn' | 'dry';

/**
 * The house rules that pay on the rooms (D-165): every house has them, whoever the client,
 * and they pay as Comfort on the rooms they're about instead of as checklist lines.
 */
export type RoomRuleId = 'cozy' | 'bathroomNearby';

/** The household's arrivals (M4b, D-103): who moves in, by client. */
export type ArrivalId = 'twins' | 'grandma' | 'renfield' | 'nana' | 'rowan' | 'ivy';

/**
 * Change orders (M4b, D-011): two offered after each of milestones 2, 4, and 6, to pick one
 * from (D-144). Five generic ones apply to every client; each client has two or three of its
 * own, at least one a phase effect, so every client has four phase effects and the offer after
 * milestone 6 always has two (Appendix B, D-137).
 */
export type ChangeOrderId =
  // Generic.
  | 'workingFromHome'
  | 'heatWave'
  | 'coldSnap'
  | 'rainySeason'
  | 'hoaLetter'
  // The Hendersons.
  | 'goldenRetriever'
  | 'thanksgiving'
  // Count Vladislav.
  | 'covenVisiting'
  | 'eternalNight'
  // The Barkers.
  | 'anotherRescue'
  | 'agilityCourse'
  | 'puppies'
  // Juniper Vale.
  | 'declutter'
  | 'teaGarden'
  | 'magazineShoot'
  // Dale.
  | 'bigDeadline'
  | 'startedAPodcast'
  | 'outOfOffice';

/**
 * The checklist's headings: the house rules every client starts with (the household, the
 * shape, the yard; house-systems-review.md §4), then the client's own wishes.
 */
export type SpecGroup = 'household' | 'shape' | 'yard' | 'wishes';

export type Tag =
  | 'Quiet'
  | 'Loud'
  | 'Social'
  | 'Wet'
  | 'Sunny'
  | 'Outdoor'
  | 'Green'
  | 'Kid'
  | 'Pet'
  | 'Pretty'
  | 'Dark'
  | 'House';

/**
 * Layout properties (§4, Layout rules). A room is an indoor piece that isn't a connector (the
 * Hallway). Exterior and interior apply to rooms only; interior rooms are Dark.
 */
export type Property =
  'indoor' | 'yard' | 'outbuilding' | 'room' | 'exterior' | 'interior' | 'view' | 'viewSource';

/**
 * Regions (§4). A multi-tile piece is in a region only if all its tiles are.
 * - sunny: tiles in the sun (D-120): not a Tree, with no Tree or building on the next tile
 *   toward the sun
 * - frontYard: non-indoor tiles in rows nearer the street than the house's front row
 * - backYard: every other non-indoor tile, side yards included
 * - fencedYard: an enclosed area that borders a Fence and the house and not the street
 */
export type Region = 'sunny' | 'frontYard' | 'backYard' | 'fencedYard';

export type Rot = 0 | 1 | 2 | 3;
export type Tier = 'core' | 'stretch' | 'later';
export type Category = 'indoor' | 'yard' | 'outbuilding';

export interface Cell {
  x: number;
  y: number;
}

// ---------------------------------------------------------------------------------------
// Content (D-038). Typed object literals in src/content; card text is generated from them.

/** Which pieces or lot features an effect looks at. */
export type Selector =
  | { piece: PieceId | readonly PieceId[] } // matches the id or `countsAs`
  | { feature: FeatureId | readonly FeatureId[] }
  | { tag: Tag } // effective tags: own tags, plus Dark if interior and Sunny if a building in the sun
  | { property: Property }
  /** Inside a fixture's modifiers: the piece it's installed in. */
  | { host: true }
  | { hasFixture: FixtureId | 'any' }
  | { in: Region } // every tile of the piece is in the region
  | { touching: Selector; min?: number } // pieces touching at least `min` (1) matches
  | { any: readonly Selector[] }
  | { all: readonly Selector[] }
  | { not: Selector }
  | 'all';

/** A condition about one piece: for `requires` and `conditional` effects. */
export type PieceCondition =
  | { touching: Selector; min?: number }
  | { in: Region }
  | { borders: 'fencedYard' }
  | { is: Selector }
  /** The piece is a member of a held instance of this set. */
  | { inSet: SetId }
  | { and: readonly PieceCondition[] }
  | { or: readonly PieceCondition[] }
  | { not: PieceCondition };

/**
 * A condition about the whole house (§5): client specs, the house rules, and (M4b) change-order
 * requests. Counts weigh a piece by its countsAs modifiers (Bunk Beds make a Bedroom count
 * twice); lot features never count.
 */
export type HouseCondition =
  | { count: Selector; min?: number; max?: number }
  /** M4b: placed since the change order was accepted, still on the lot. */
  | { countNew: Selector; min: number }
  | { none: Selector }
  /** Some piece matching the first touches one matching the second (links count). */
  | { adjacentPair: readonly [Selector, Selector] }
  /** The largest single fenced yard. */
  | { fencedYardTiles: { min: number } }
  /** The largest connected group of matching pieces' tiles. */
  | { group: Selector; minTiles: number }
  /** Held instances of a set. */
  | { set: SetId; min?: number }
  /** M4b: demolitions since the change order was accepted. */
  | { demolishedSinceAccepted: { min: number } }
  /**
   * One count against another: at least one `count` for every `every` of `per`, and at least
   * `min` (a Bathroom for every two Bedrooms, at least one).
   */
  | { ratio: { count: Selector; per: Selector; every: number; min?: number } }
  /**
   * The house's outline (A compact house): how many rooms, how full the box around its indoor
   * tiles is, and how long the box is against its width.
   */
  | {
      outline: { minRooms: number; maxRooms?: number; minFillPct: number; maxAspect: number };
    }
  /**
   * A yard that doesn't repeat (a tidy yard): at least `min` pieces matching `of`, and no type
   * among them stands more than `maxEach` times. `exempt` types count toward `min` but never
   * break it (Fences, Driveways, Saplings).
   */
  | { variety: { of: Selector; min: number; maxEach: number; exempt?: Selector } }
  /** By milestone: the last stage whose phase has begun applies (a household that grows). */
  | { stages: readonly { fromPhase: number; condition: HouseCondition }[] }
  | { and: readonly HouseCondition[] }
  | { or: readonly HouseCondition[] }
  | { not: HouseCondition };

/**
 * Effect kinds (§5). Timers count from the week a piece was placed: its age is
 * `week − placedWeek`, 0 in the week it's built. "Every 3rd week" pays when (age + 1) is a
 * multiple of 3, so the placement week counts as the first.
 */
export type Effect =
  /** Earns `amount` every week. */
  | { kind: 'steady'; amount: number }
  /** `amount` per distinct touching neighbor that matches, up to `max` of them. Negative = penalty. */
  | { kind: 'neighbor'; match: Selector; amount: number; max?: number }
  /**
   * Changes what each matching piece earns: `pct` to its percentage, `amount` to its flat
   * points. `adjacent`: touching pieces. `region`: pieces in the fenced yards it borders (the
   * Mudroom).
   */
  | { kind: 'aura'; match: Selector; scope: 'adjacent' | 'region'; pct?: number; amount?: number }
  /** Earns `amount` every `every`-th week of its life (the Pool). */
  | { kind: 'rhythm'; every: number; amount: number }
  /** Earns `perWeek` × the weeks it has stood, this one included, up to `max` (Good Bones). */
  | { kind: 'growth'; perWeek: number; max?: number }
  /** `perTile` per tile of the fenced yards it borders, `cap` on the total (the Fence). */
  | { kind: 'enclosure'; perTile: number; cap?: number }
  /** At the start of a week, once `afterWeeks` have passed since placement, becomes something else (the Sapling). */
  | { kind: 'transform'; into: { piece: PieceId } | { feature: 'tree' }; afterWeeks: number }
  /** Pays `budget` every week, or every `every`-th week of its life (the Garage, the Home Office). */
  | { kind: 'economy'; budget: number; every?: number }
  /** `amount` per tile of the piece in the region (the Herb Garden's tiles in the sun). */
  | { kind: 'perTile'; region: Region; amount: number }
  /** A connector (the Hallway): every room touching it, or a group of them, counts as touching every other. */
  | { kind: 'link' }
  /**
   * The piece earns nothing (no score, no budget) unless the condition holds. With
   * `blocksPlacement`, it also can't be placed where the condition fails.
   */
  | { kind: 'requires'; condition: PieceCondition; blocksPlacement: boolean }
  /** The inner effect applies only while the condition holds (the Flower Bed in the front yard). */
  | { kind: 'conditional'; when: PieceCondition; effect: Effect }
  /**
   * D-165: earns `amount` while a `by` piece in reach (touching it, or linked to it across a
   * Hallway) serves it, where each `by` piece serves at most `capacity` of the pieces with this
   * effect: a Bathroom serves two Bedrooms. The house is matched to serve as many as it can,
   * the earliest placed first (scoring.ts).
   */
  | { kind: 'served'; by: Selector; amount: number; capacity: number };

export interface PieceDef {
  id: PieceId;
  name: string;
  tier: Tier;
  category: Category;
  /** Shape variants (the L-Kitchen) share a type for effects and sets. */
  countsAs?: PieceId;
  givesView?: true;
  /** The Hallway: links rooms, and isn't a room or a neighbor for bonuses itself. */
  connector?: true;
  /**
   * Its row in the weekly draw (D-121). Unset: Rooms for an indoor piece that isn't a
   * connector, Layout for everything else (the yard, outbuildings, Hallways).
   */
  row?: DrawRow;
  /** The Fence: blocks the fenced-yard flood fill, as indoor tiles do. */
  wall?: true;
  /** Blocking features it can be built over without removing them (the Driveway's culvert). */
  canCover?: readonly TerrainId[];
  /** ASCII rows: '#' filled, '.' empty. */
  shape: readonly string[];
  tags: readonly Tag[];
  /** 10 = normal; 0 = not in the base pool. */
  drawWeight: number;
  /** D-055: 1 = plain earners, 2 = conditions and timers, 3 = build-arounds. */
  complexity: 1 | 2 | 3;
  /** Hard gate: the earliest phase (0-based) it can be drawn. */
  fromPhase: number;
  effects: readonly Effect[];
  /**
   * A pack (D-106): the card places 1–`maxTiles` connected tiles that the player clicks out,
   * as one piece with that shape. `shapes` are the ones it suggests, which the rules list (in
   * every rotation, with a single tile) for bots. `shape` above is the card's picture, and the
   * tiles of a pack piece built without its own (a test's house).
   */
  pack?: { maxTiles: number; shapes: readonly (readonly string[])[] };
  /**
   * A household member's room (M4b, D-103). It arrives in the reserve with its member and is
   * never drawn, sold, copied, or in the shop, a crate, or the Catalog. It counts as a Bedroom
   * (`countsAs: 'bedroom'`) everywhere a Bedroom counts, sets included, and its card can't
   * renovate (a Bedroom card can renovate it).
   */
  member?: true;
  /**
   * D-165: the most of this type a house holds (one Kitchen, two Living Rooms), on the type's
   * own card (not a variant: the L-Kitchen has the Kitchen's). Counted as the checklist counts
   * a type, so an L-Kitchen is a Kitchen. A card of the type can't be placed once the house has
   * that many: it renovates instead (D-102), and the type draws at half weight (D-104).
   */
  perHouse?: number;
}

export interface FeatureDef {
  id: FeatureId;
  name: string;
  tier: Tier;
  tags: readonly Tag[];
  /** Can't be built on. */
  blocks: boolean;
  /** Trees: building over removes them. Boulders: a demolition (M2). */
  clear?: 'buildOver' | 'demolish';
  viewSource?: true;
  /** Orthogonally connected tiles of this feature count as one neighbor (the pond, the creek). */
  body?: true;
  /** Lot features that give nothing as neighbors (a Time Capsule). */
  inert?: true;
  /** A multi-tile object (the Old Shed's [2, 2]): demolishing any tile removes all of it. */
  size?: readonly [number, number];
  /** Finds: paid once, when cleared (the Old Shed) or first built over (a Time Capsule). */
  reward?: Reward;
}

/** What a find, a tool, or (M4) a change order pays. */
export interface Reward {
  /** A one-time Wow payout. */
  score?: number;
  budget?: number;
  /** Bought-style rerolls: they never expire. */
  rerolls?: number;
  demolitions?: number;
  overtime?: number;
  /** A tool into the supplies (or sold at once for half if they're full); 'random' from the offered tools. */
  tool?: ToolId | 'random';
}

/** The run-level numbers that modifiers can change (§5). */
export type RuleKey =
  | 'rerollsPerPhase'
  | 'demolitions'
  | 'overtime'
  // The weekly draw's two rows (D-121).
  | 'roomsRow'
  | 'layoutRow'
  | 'earlyRewardPct'
  // The shop's goods (M3).
  | 'reserveSlots'
  | 'supplySlots'
  | 'blueprintSlots'
  | 'shopPricePct'
  | 'specBonus'
  | 'interestMax'
  // D-157: strikes in hand at the run's start. Each strikes a hand card's type from the draws.
  | 'strikes';

/** One small function per kind in rules/tools.ts (§5, Shop goods). */
export type ToolUse =
  /** Moving Truck: a placed piece, fixture and all, to another legal spot. */
  | { kind: 'move' }
  /** Copy Machine: a placed piece's card into the reserve. */
  | { kind: 'copy' }
  /** Rush Order, Open House Party, Inspector's Visit: this week's tally only. */
  | { kind: 'weekModifiers'; modifiers: readonly Modifier[] }
  /** Catalog: redraw this hand from special pieces and fixtures. */
  | { kind: 'specialHand' }
  /** Fertilizer: every timer on the lot moves forward. */
  | { kind: 'advanceTimers'; weeks: number }
  /** Dumpster. */
  | { kind: 'reward'; reward: Reward }
  /** Remodel Plans: +1 level for a set type, for the rest of the run. */
  | { kind: 'levelSet'; set: SetId }
  /** Weekend Crew (D-075): this week's next play doesn't end the week. */
  | { kind: 'extraPlay' };

/** Counts that can scale a ×Mult (Ahead of Schedule). */
export type RunStat = 'milestonesEarly';

/**
 * Rule benders (§5): from crews, blueprints, fixtures (which target `{ host: true }`), company
 * upgrades, and this week's tools; clients and change orders add their own in M4. Percentages
 * and Mult are integers in hundredths. A `rule`'s value combines as
 * (base + Σ add) × (100 + Σ pct) / 100, rounded half up.
 */
export type Modifier =
  /** "Dark pieces earn double" is +100. `lastWeekOfPhase` counts only a week actually played. */
  | { kind: 'earn'; target: Selector; pct: number; when?: 'lastWeekOfPhase' }
  /** Crown Jewel: the week's top earner gets `pct` more, after every other term. */
  | { kind: 'bestPiece'; pct: number }
  /**
   * +Mult, optionally per matching piece (It's a House). With `maxEach`, at most that many
   * pieces of one type count (D-143), as a tidy yard counts its types.
   */
  | { kind: 'mult'; add: number; per?: Selector; maxEach?: number }
  /**
   * ×Mult: `times + add × count`. Each distinct source multiplies the week's Mult once,
   * however many pieces trigger it (D-056).
   */
  | {
      kind: 'xMult';
      times: number;
      plusPer?: { per: Selector | RunStat; add: number };
      when?: 'lastWeekOfPhase' | { host: PieceCondition };
    }
  | { kind: 'earnNothing'; target: Selector }
  /** Tags are granted, then removed, matched against the piece's own and layout tags only. */
  | { kind: 'grantTag'; target: Selector; tag: Tag }
  | { kind: 'removeTag'; target: Selector; tag: Tag }
  /** Bay Window: the piece has a view, and counts it as one more view for "per view" bonuses. */
  | { kind: 'grantView'; target: Selector }
  /** Soundproofing: penalties from matching neighbors (the street included) don't apply. */
  | { kind: 'blockPenalties'; target: Selector; from: Selector }
  /** Kitchen Island; Bunk Beds count `times` in count conditions (M4a's specs), once in sets. */
  | { kind: 'countsAs'; target: Selector; as: PieceId; times?: number }
  /** Open Concept: touching pieces of these types form linked groups, as a Hallway links rooms. */
  | { kind: 'link'; among: readonly PieceId[] }
  /** Good Bones: the effect is added to every matching piece; timers count from the grant. */
  | { kind: 'grantEffect'; target: Selector; effect: Effect }
  /** Juniper's room limit: every matching piece earns `pct` for each one over `over`. */
  | { kind: 'perCountOver'; match: Selector; over: number; pct: number }
  /** +N% to a set's (or every set's) Points and +Mult. */
  | { kind: 'setBonus'; set?: SetId; pct: number }
  /** Economy output of matching pieces. */
  | { kind: 'budget'; target: Selector | 'all'; pct: number }
  /** Clients, crews and lot traits (D-166) only, so weights stay fixed for the run (D-043). */
  | { kind: 'drawWeight'; target: Selector; add?: number; pct?: number }
  | { kind: 'rule'; key: RuleKey; add?: number; pct?: number };

export interface CrewDef {
  id: CrewId;
  name: string;
  tier: Tier;
  blurb: string;
  modifiers: readonly Modifier[];
  /** Cards in the reserve from week 1, in extra slots that don't count against it (M4b). */
  startReserve?: readonly PieceId[];
}

/**
 * A lot trait (D-119): a chip on the contract's card. A lot has it when it holds at least `min`
 * tiles of `terrain`, or (D-166) was shaped to `kind`, as the run begins, and keeps it all run.
 * Its modifiers join the run's, like a crew's (its `drawWeight` ones too, as a client's pool
 * does), and a trait that has some stays on the checklist all run.
 */
export interface LotTraitDef {
  id: LotTraitId;
  /** The chip: "Creekside". */
  name: string;
  /** The tip's last line, after what the modifiers say: "Only a Driveway crosses it." */
  blurb: string;
  when: { terrain: TerrainId; min: number } | { kind: ShapedKind };
  modifiers: readonly Modifier[];
  /**
   * Terrain no piece is built over on this lot (D-174's Old Woods keeps its Trees): placement
   * refuses it, as it does water.
   */
  protects?: readonly TerrainId[];
  /** Clients it suits: their contract marks the chip with the up icon. */
  suits?: readonly ClientId[];
}

/**
 * A house rule that pays on the rooms (D-165): Cozy, A Bathroom nearby. Every run has it, whoever
 * the client. Its modifiers join the run's like a crew's (a `grantEffect` gives each room its
 * pay), and the lines it adds to a room's breakdown carry its name.
 */
export interface RoomRuleDef {
  id: RoomRuleId;
  /** "Cozy": the breakdown line's label, and How to play's term. */
  name: string;
  /** One sentence for How to play and the term's tip: "A room earns +2 per room it touches (up to 3)." */
  text: string;
  modifiers: readonly Modifier[];
}

export interface SetDef {
  id: SetId;
  name: string;
  tier: Tier;
  /** How many of each piece type an instance needs (`countsAs` counts). */
  members: Partial<Record<PieceId, number>>;
  /** The members form one connected group. */
  connected: boolean;
  /** The hub touches every other member (Jack-and-Jill's Bathroom). */
  hub?: PieceId;
  /** At most this many instances in a house (One Entertainer per house; Full House). */
  maxInstances?: number;
  /** Paid every week the set holds, like a poker hand's chips and mult. Mult is in hundredths. */
  points: number;
  mult: number;
  /** A ×Mult while it holds, in hundredths (Full House: 200), first in the ×Mult order. */
  times?: number;
  /** Added per level from Remodel Plans (M3b). Every set is level 1 until then. */
  level: { points: number; mult: number };
}

/** One line of a client's checklist: a house rule or one of the client's own wishes. */
export interface SpecDef {
  /** Stable within a client, for events and the UI: 'oneKitchen', 'fencedYard'. */
  id: string;
  /** "Room for everyone", "A fenced yard". */
  name: string;
  group: SpecGroup;
  condition: HouseCondition;
  /**
   * Card text, where the generated text wouldn't read as well (the house rules write theirs
   * from each client's numbers). Otherwise it's generated from the condition.
   */
  text?: string;
}

/**
 * A member of the household who moves in mid-run (M4b, D-103). Arrivals are fixed for the
 * client, shown from week 1 (the job board), and can't be declined. At the first week of their
 * phase (after transforms, before the draw) their cards go into the reserve's extra slots.
 * From then on Room for everyone counts one more Bedroom at each end of its range and needs
 * one of their rooms.
 */
export interface ArrivalDef {
  id: ArrivalId;
  /** "The twins", "Grandma". */
  name: string;
  /** The phase (0-based, at least 1) they arrive at: their cards land in its first week. */
  phase: number;
  /** What lands in the reserve: their room's card, and anything they bring (Grandma's Bathroom). */
  cards: readonly PieceId[];
  /** The member room types that count as theirs (the Nursery, and the Kids' Room it grows into). */
  room: readonly PieceId[];
  /** One line for the job board: who's coming, and when. */
  text: string;
}

/**
 * D-160: what a client brings for a wish, so the card it names is never left to the draw (Dale's
 * first Home Office, the Barkers' first Doghouse). In the first week of its phase (0 = week 1),
 * after any arrival, its cards go into the reserve's extra slots, marked as the client's. It
 * isn't a household member: Room for everyone doesn't change, and it's no arrival.
 */
export interface DeliveryDef {
  /** The phase (0-based) whose first week it lands in. */
  phase: number;
  cards: readonly PieceId[];
  /** One line for the job board: what they bring. The board adds when. */
  text: string;
}

/** Who the house is for (M4b, D-103): the Bedrooms they need to start, and who's coming. */
export interface Household {
  /** Room for everyone's Bedroom range before anyone arrives: [min, max]. */
  bedrooms: Range;
  arrivals: readonly ArrivalDef[];
}

/**
 * A client (M4a): one contract's household. Its checklist starts with the house rules (in
 * this client's numbers), then its own wishes; each line met adds `specBonus` to the Mult.
 */
export interface ClientDef {
  id: ClientId;
  name: string;
  rarity: Rarity;
  tier: Tier;
  /** One line for the job board. */
  brief: string;
  specs: readonly SpecDef[];
  /** Likes and dislikes: `earn`, `earnNothing`, `perCountOver`, `budget`, and `rule` modifiers. */
  tastes: readonly Modifier[];
  /** `drawWeight` modifiers only: the client's spec pieces and signature pieces. */
  pool: readonly Modifier[];
  /** This client's targets as a percentage of the curve in balance.ts (set by the sim). */
  targetPct: number;
  /** M4b: the household and its arrivals; Room for everyone is built from it (house-rules.ts). */
  household: Household;
  /** D-160: what the client brings for its wishes, if anything (not household members). */
  deliveries?: readonly DeliveryDef[];
  /** M4b: the client's own change orders (scope = this client); the generic ones apply too. */
  changeOrders: readonly ChangeOrderId[];
}

/**
 * A change order (M4b; implementation-plan.md §5, Appendix B). Two are offered after each of
 * milestones 2, 4, and 6, from the client's own and the generic ones; the one picked (D-144)
 * runs through the next phase, resolving at its milestone.
 * - request: met at the milestone → `reward`. A temporary goal: it never changes the
 *   checklist. `countNew` counts pieces placed since it was picked.
 * - restriction: placing a piece that matches `forbid` breaks it; kept to the milestone →
 *   `reward`.
 * - phase: its modifiers apply for the next phase.
 */
export type ChangeOrderDef = {
  id: ChangeOrderId;
  name: string;
  /** What it asks or does, as a sentence (generated text is in text.ts' changeOrderText). */
  text: string;
  /** 'generic' for every client, or the one client it belongs to. */
  scope: 'generic' | ClientId;
  tier: Tier;
} & (
  | { kind: 'request'; condition: HouseCondition; reward: Reward }
  | { kind: 'restriction'; forbid: Selector; reward: Reward }
  | { kind: 'phase'; modifiers: readonly Modifier[] }
);

export type ChangeOrderKind = ChangeOrderDef['kind'];

export interface FixtureDef {
  id: FixtureId;
  name: string;
  tier: Tier;
  rarity: Rarity;
  /** Which placed pieces can host it, checked when it's installed. */
  fits: Selector;
  /** Its row in the weekly draw (D-121): its hosts' row. Unset: Rooms. */
  row?: DrawRow;
  /** In the weekly draw from `fromPhase`; 0 = shop only (the Chandelier). */
  drawWeight: number;
  fromPhase: number;
  price: number;
  /** Their targets are `{ host: true }`. */
  modifiers: readonly Modifier[];
}

export interface BlueprintDef {
  id: BlueprintId;
  name: string;
  tier: Tier;
  rarity: Rarity;
  price: number;
  modifiers: readonly Modifier[];
  /** False for goods the shop holds back until their mechanic exists (Dream Home needs M4a's specs). */
  offered: boolean;
}

export interface ToolDef {
  id: ToolId;
  name: string;
  tier: Tier;
  rarity: Rarity;
  price: number;
  use: ToolUse;
  /** False while its mechanic is missing (Inspector's Visit needs M4a's specs). */
  offered: boolean;
}

export interface UpgradeDef {
  id: UpgradeId;
  name: string;
  tier: Tier;
  price: number;
  /** `rule` modifiers, permanent for the run. */
  modifiers: readonly Modifier[];
}

export interface CrateDef {
  id: CrateId;
  name: string;
  tier: Tier;
  price: number;
  contents: 'blueprint' | 'fixture' | 'piece';
  /** For pieces: 'special' (the Showroom) or 'all' (base and special: the Garden Center). */
  pool?: 'special' | 'all';
  /** For pieces: which cards qualify (the Garden Center's yard pieces and outbuildings). */
  filter?: Selector;
}

/** One of an opened crate's options. */
export type PickOption =
  | { kind: 'blueprint'; id: BlueprintId }
  | { kind: 'fixture'; id: FixtureId }
  | { kind: 'piece'; id: PieceId };

export type Range = readonly [min: number, max: number];

/** Lot generation (Appendix A · M1). */
export interface LotBalance {
  width: number;
  height: number;
  woodsClusters: Range;
  woodsClusterSize: Range;
  loneTrees: Range;
  /** Percent of lots with a creek. */
  creekPct: number;
  /** Percent of creek lots that keep their pond (D-119); a lot without a creek always has one. */
  pondPctCreek: number;
  /** The creek stays at least this many rows clear of the street edge. */
  creekStreetGap: number;
  pondSize: Range;
  boulders: Range;
  /** Regeneration checks. */
  minFreePct: number;
  minFreeStreetTiles: number;
  minStreetSidePct: number;
  maxAttempts: number;
  /** Finds (M3b): how many Old Sheds and Time Capsules a lot gets. */
  oldSheds: Range;
  timeCapsules: Range;
  /** Finds stay at least this many rows clear of the street edge, so the front stays open. */
  findStreetGap: number;
  /**
   * Biomes (D-174), by weight, from each seed's own `lot/biome` stream, before the lot is drawn:
   * each sets the lot's look and its lot kinds (D-166), which are drawn from each lot's own
   * `lot/<attempt>/kind` stream once it has passed its checks, before its finds. A plain lot
   * stays exactly as drawn.
   */
  biomes: Readonly<Record<BiomeId, BiomeBalance>>;
  /** A Rocky lot's Boulders, on top of `boulders`. */
  rockyBoulders: Range;
  /** A pond lot's pond grows to this many tiles (a lot whose creek took its pond stays plain). */
  pondTiles: Range;
  /** A lake lot's lake (D-174): this many rows from the back edge, its shore wandering. */
  lakeRows: Range;
}

/** A biome's lots (D-174): how often it comes up, its kinds, and its own draw. */
export interface BiomeBalance {
  weight: number;
  /** Its lot kinds by weight (D-166); a kind it leaves out never comes up there. */
  kinds: Readonly<Partial<Record<LotKind, number>>>;
  /** Overrides of the lot's draw: more woods in the autumn woods, fewer creeks on a dry lot. */
  woodsClusters?: Range;
  creekPct?: number;
}

export interface PhaseDef {
  /** D-018's construction phases. */
  name: string;
  /** The cumulative Wow needed by the end of the phase. Set by `npm run sim -- --suggest-targets`. */
  target: number;
}

export interface VerdictDef {
  name: string;
  /** The final score as a percentage of the last target. A lost run is always the first verdict. */
  minPctOfTarget: number;
}

export interface Balance {
  lot: LotBalance;
  weeksPerPhase: number;
  /** D-018's seven milestones; the sim sets the targets (D-044). */
  phases: readonly PhaseDef[];
  /** Base values of the run-level rules, before crew modifiers (`earlyRewardPct` is a percentage). */
  rules: Readonly<Record<RuleKey, number>>;
  /** Early completion (D-040), per week saved, by phase (the last entry repeats). */
  early: {
    /** Budget per week saved. */
    budgetPerWeek: readonly number[];
    /** Percent of this phase's earnings, per week saved, paid as Wow. */
    scorePct: readonly number[];
  };
  /** Budget paid at each milestone met. */
  milestoneBudget: number;
  /**
   * D-145: Wow for each budget held when the last milestone is met, its own payout included
   * (no shop follows it, so nothing else can be done with it). 0 turns it off.
   */
  leftoverBudgetWow: number;
  shop: ShopBalance;
  /** The fewest tiles a fenced yard needs (§4). */
  fencedYardMin: number;
  /** D-055: draw-weight percentages by phase (the last row repeats), for complexity 1, 2, and 3. */
  complexityPct: readonly (readonly [number, number, number])[];
  /**
   * D-166: the run modes whose lot cards skip that ramp, at full weight from Groundbreaking. A
   * lot card is a Layout piece but the Hallways and the Fence, which read the house (draw.ts).
   */
  lotCardsFullIn: readonly RunMode[];
  /** Run-end verdicts by score band, lowest first (§12, The score's names). */
  verdicts: readonly VerdictDef[];
  /**
   * Renovate (house-systems-review.md §4): a room card whose type is at its limit levels up a
   * room of that type instead. Each level adds flat Comfort, up to `maxLevel`. D-168: only a
   * room the card can't extend (no open ground beside it, or grown as far as it goes).
   */
  renovate: { pointsPerLevel: number; maxLevel: number };
  /**
   * D-168, Extend a room: a card of one of these room types (by root type) laid beside a room of
   * its type, sharing at least `minShared` tiles of wall with it, joins that room, up to
   * `maxPerRoom` cards a room. An extended room adds `pointsPerTile` flat Comfort for each tile
   * beyond its own card's, before its percentages.
   */
  extend: {
    types: readonly PieceId[];
    maxPerRoom: number;
    pointsPerTile: number;
    minShared: number;
  };
  /** A card whose type is at its limit draws at this percent of its weight (D-043, amended). */
  drawAtLimitPct: number;
  /** D-121: how many cards from its row a card with no play is swapped for, at most. */
  swapTries: number;
  /**
   * The job board (D-032, D-045): its contracts, rarity weights, and the first visit's client.
   * `firstSeed` is the first job's lot (D-149): the run seed of the first visit's one open
   * contract, picked so its first hands teach in order (src/ui/hud/first-job.ts).
   * `firstTargetPct` scales a first job's targets (D-151): a `firstJob` run's client needs this
   * percent of its usual targets (100 = no change).
   */
  jobBoard: {
    contracts: number;
    rarity: Readonly<Record<Rarity, number>>;
    firstClient: ClientId;
    firstSeed: string;
    firstTargetPct: number;
  };
  /**
   * M4b: the milestones (1-based) after which one change order is offered, before the shop
   * (2, 4, and 6). Never the last milestone: the run ends there.
   */
  changeOrderAfter: readonly number[];
  /**
   * D-157: strikes added at each milestone the run goes on from (1–6, never the last), on top
   * of the `strikes` rule's start. Unused strikes are kept.
   */
  strikesPerMilestone: number;
  /**
   * D-160: the standing stock. The first week of `fromPhase` fills the reserve's extra slots up
   * to one of each of `pieces`, adding only what's missing. A first job (D-149) brings it in
   * week `firstJobSlot` of `firstJobPhase` instead (D-162), so it doesn't arrive with the guided
   * opening or the parts of the screen Foundation brings in; one that missed that week gets it
   * at the next milestone's first. With `refill`, each later milestone's first week tops it up
   * the same way (D-160); without, it comes once (D-163: its pieces don't use the week, so a
   * top-up at every milestone was two more builds a milestone).
   */
  standingStock: {
    fromPhase: number;
    pieces: readonly PieceId[];
    firstJobPhase: number;
    firstJobSlot: number;
    refill: boolean;
  };
}

/** What a shop visit stocks (Appendix A · M3a), by shop; the last row repeats. */
export interface ShopStock {
  blueprints: number;
  /** Special pieces or fixtures. */
  cards: number;
  tools: number;
  crates: number;
  /** Company upgrades: one per visit from the second shop. */
  upgrades: number;
  /** The free Housewarming crate (shop 1): this many Common blueprints to pick 1 from. */
  housewarming: number;
  /** Rarity weights for blueprint, fixture, and tool slots: Common, Uncommon, Rare. */
  rarity: readonly [number, number, number];
}

export interface ServicePrice {
  base: number;
  /** Added per purchase, for the rest of the run, up to `max`. */
  step: number;
  max: number;
}

export interface ShopBalance {
  /** Shop k (after milestone k) uses row k − 1; the last row repeats. */
  stock: readonly ShopStock[];
  /** Percent chance that a card slot is a fixture rather than a special piece. */
  cardFixturePct: number;
  /** A special piece's price (blueprints and fixtures carry their own). */
  piecePrice: number;
  /** The sale's price, as a percent of the price. */
  salePct: number;
  /** Selling pays this percent of the item's price, rounded down. */
  sellPct: number;
  /** The refresh: `base`, plus `step` per further refresh in the same visit. */
  refresh: { base: number; step: number };
  services: Readonly<Record<ServiceId, ServicePrice>>;
  /** Leaving without buying anything pays this. */
  skipReward: number;
  /** D-076: a strike can't leave fewer drawable card types than this in either row (D-121). */
  strikeMinTypes: Readonly<Record<DrawRow, number>>;
  /** Options in an opened crate. */
  crateOptions: number;
  /** Savings Account interest: +1 budget per this many held, up to the `interestMax` rule. */
  interestPer: number;
}

export interface Content {
  pieces: Readonly<Record<PieceId, PieceDef>>;
  features: Readonly<Record<FeatureId, FeatureDef>>;
  sets: Readonly<Record<SetId, SetDef>>;
  crews: Readonly<Record<CrewId, CrewDef>>;
  clients: Readonly<Record<ClientId, ClientDef>>;
  fixtures: Readonly<Record<FixtureId, FixtureDef>>;
  blueprints: Readonly<Record<BlueprintId, BlueprintDef>>;
  tools: Readonly<Record<ToolId, ToolDef>>;
  upgrades: Readonly<Record<UpgradeId, UpgradeDef>>;
  crates: Readonly<Record<CrateId, CrateDef>>;
  changeOrders: Readonly<Record<ChangeOrderId, ChangeOrderDef>>;
  lotTraits: Readonly<Record<LotTraitId, LotTraitDef>>;
  /** D-165: the house rules that pay on the rooms (a test's content may have none). */
  roomRules: Readonly<Partial<Record<RoomRuleId, RoomRuleDef>>>;
  balance: Balance;
}

// ---------------------------------------------------------------------------------------
// State. Plain, JSON-serializable data. D-025 keeps the house separate from the run.

/** The edges the sun can shine from (D-120): `top` is the back of the lot, `bottom` the street. */
export type SunSide = 'top' | 'left' | 'right' | 'bottom';

export interface Lot {
  width: number;
  height: number;
  /** Row-major, width × height: what sits on each tile. The street is outside the grid. */
  terrain: readonly (TerrainId | null)[];
  /**
   * The edge the sun shines from (D-120): `top` is the back of the lot, `bottom` the street's
   * side. A tile is in the sun unless it's a Tree or a Tree or a building stands on the next tile
   * toward the sun, and a building with a tile in the sun is Sunny.
   */
  sun: SunSide;
  /** Which `lot/<attempt>` stream made it. */
  attempt: number;
  /** The kind it was shaped to (D-166); unset on a plain lot. */
  kind?: ShapedKind;
  /** Its biome (D-174): the look, and the kinds it was drawn from. Unset on a meadow lot. */
  biome?: Exclude<BiomeId, 'meadow'>;
  /**
   * Its traits as the run began (D-166), in content order: they pay and tilt the draw all run,
   * so building over Trees can't take Wooded away. Unset on a fresh lot or a test's, whose
   * traits are read from its terrain.
   */
  traits?: readonly LotTraitId[];
}

export interface PlacedPiece {
  uid: number;
  defId: PieceId;
  /** The top-left cell of the rotated shape's bounding box. */
  x: number;
  y: number;
  rot: Rot;
  placedWeek: number;
  /** Weeks added to its timers (Fertilizer, M3b). */
  ageBonus?: number;
  /** One per piece (D-050); installing another replaces it. Gone when the piece is demolished. */
  fixture?: { id: FixtureId; week: number };
  /** Renovations (M4a): each level adds Comfort. Kept through a move and a transform. */
  level?: number;
  /**
   * A pack's own tiles (D-106), or an extended room's (D-168), as ASCII rows; turned by `rot`
   * like any shape.
   */
  shape?: readonly string[];
  /** D-168: how many room cards have joined it (Extend a room). Its `shape` holds their tiles. */
  extended?: number;
}

export interface HouseState {
  lot: Lot;
  /** In placement order. */
  pieces: readonly PlacedPiece[];
  nextUid: number;
}

/** A card in the hand: a piece, or (from phase 2) a fixture. */
export type Card = { kind: 'piece'; id: PieceId } | { kind: 'fixture'; id: FixtureId };

/** The weekly draw's two rows (D-121): where a card is built, in the house or around it. */
export type DrawRow = 'rooms' | 'layout';

/** A card swapped in at the start of a week or after a reroll (D-121): the one it replaced. */
export interface SwappedCard {
  /** Its place in the hand. */
  i: number;
  /** The card it replaced, which had no play. */
  was: Card;
}

/** A card type that can be struck from the draws (D-076): a piece type (its countsAs root) or a fixture. */
export type CardType = Card;

/** What sits in a supply slot: bought fixtures and tools, used as free actions. */
export type Supply = { kind: 'fixture'; id: FixtureId } | { kind: 'tool'; id: ToolId };

/**
 * A card waiting in the reserve: bought, picked, or copied (in the `reserveSlots` slots), or in
 * an extra slot that doesn't count against them: a crew's starting card or an arrival's (M4b),
 * the client's or the standing stock's (D-160). shop.ts' inExtraSlot says which.
 */
export interface ReservePiece {
  id: PieceId;
  /** A crew's starting piece, in an extra slot that doesn't count against the reserve (M4b). */
  crew?: true;
  /** An arrival's card (D-103), in an extra slot that doesn't count against the reserve (M4b). */
  arrival?: ArrivalId;
  /** D-160: a card the client brought (ClientDef.deliveries), in an extra slot. */
  client?: true;
  /** D-160: a card from the standing stock (balance.standingStock), in an extra slot. */
  stock?: true;
}

export interface OwnedBlueprint {
  id: BlueprintId;
  /** The week it was bought: Good Bones and other granted timers count from here. */
  boughtWeek: number;
}

export type ServiceId = 'reroll' | 'demolition' | 'strike';

export type ShopOffer =
  | { kind: 'blueprint'; id: BlueprintId; sold?: true }
  | { kind: 'piece'; id: PieceId; sold?: true }
  | { kind: 'fixture'; id: FixtureId; sold?: true }
  | { kind: 'tool'; id: ToolId; sold?: true }
  | { kind: 'crate'; id: CrateId; sold?: true }
  /** Fixed for the visit: a refresh doesn't reroll it. */
  | { kind: 'upgrade'; id: UpgradeId; sold?: true }
  /** Services stay on offer: each purchase raises the price for the rest of the run. */
  | { kind: 'service'; service: ServiceId };

export interface ShopVisit {
  /** Which shop this is: 1 after milestone 1, up to 6. */
  number: number;
  offers: readonly ShopOffer[];
  /** The offer at the sale price this visit, if it's still for sale. */
  sale: number | null;
  /** Refreshes so far this visit. */
  refreshes: number;
  /** Anything bought or refreshed: leaving then pays no skip reward. */
  boughtAny: boolean;
  /** Opened by the ?debug panel mid-phase: leaving goes back to the same week. */
  forced?: true;
}

/** An opened crate waiting for a choice: only `pick` (or -1 to discard) and `sell` until then. */
export interface CratePick {
  source: CrateId | 'housewarming';
  options: readonly PickOption[];
}

/**
 * Modifiers for a while: a tool's for this week's tally (Rush Order, `until.week`), or (M4b) a
 * change order's phase effect for the phase it runs through (Heat wave, `until.phase`).
 */
export interface TimedEffect {
  /** A tool's id when `until` is a week; a change order's when it's a phase. */
  source: ToolId | ChangeOrderId;
  /** The last week, or the last phase (it ends when that phase's milestone resolves). */
  until: { week: number } | { phase: number };
  modifiers: readonly Modifier[];
}

/** How an accepted change order ended (M4b). A phase effect just ends. */
export type ChangeOrderResult = 'met' | 'missed' | 'kept' | 'broken' | 'ended';

/**
 * The change orders offered after a milestone, waiting on the 'changeOrder' screen for one to
 * be picked (D-144).
 */
export interface ChangeOrderOffer {
  /**
   * The orders to pick from, in the order shown: two, or one when only one is eligible (or
   * the ?debug panel forced one alone).
   */
  ids: readonly ChangeOrderId[];
  /** The phase the pick would run through (0-based): it resolves when that phase's milestone does. */
  phase: number;
  /** Forced by the ?debug panel mid-week: answering it goes back to the same week. */
  forced?: true;
}

/** A change order picked this run (M4b, D-144). */
export interface ChangeOrderRecord {
  id: ChangeOrderId;
  /** The phase it runs through (0-based). */
  phase: number;
  /** The week it was picked: the first week it counts in. */
  week: number;
  /** Requests: pieces with a uid from here on are new (the house's nextUid when picked). */
  sinceUid: number;
  /** Requests: pieces demolished since it was picked (Declutter). */
  demolished: number;
  /** The orders offered beside it and passed over: they can be offered again (D-144). */
  passedOver: readonly ChangeOrderId[];
  /** Restrictions: the forbidden piece whose placement broke it. */
  brokenBy?: number;
  /** Once its phase's milestone resolves. */
  result?: ChangeOrderResult;
  /** What it paid: a request met or a restriction kept. */
  reward?: Reward;
}

/**
 * How a run is played. `firstJob` (D-151) is a browser's first job, guided by the UI (D-149):
 * the client's targets are scaled by the job board's `firstTargetPct`, so a newcomer can get
 * past the walls a first run meets at Roofing and Drywall. Everything else is a standard run.
 */
export type RunMode = 'standard' | 'firstJob';

export interface RunSetup {
  seed: string;
  /** The contract's client (M4a). */
  clientId: ClientId;
  crewId: CrewId;
  mode: RunMode;
}

export interface WeekScore {
  points: number;
  /** In hundredths: 250 is ×2.5. */
  mult: number;
  total: number;
}

export interface WeekSummary extends WeekScore {
  /** Keys of the set instances held, for spotting new ones. */
  setInstances: readonly string[];
  /** Whether each of the client's specs held, in checklist order, for specMet and specLost. */
  specsMet: readonly boolean[];
}

export type MilestoneResult = 'onTime' | 'early' | 'overtime' | 'failed';

/** What the milestone paid: the milestone's budget, plus the early bonus and interest if any. */
export interface MilestoneReward {
  budget: number;
  score: number;
  /** Savings Account interest, included in `budget`. */
  interest: number;
  /** D-157: the strikes it gave (`strikesPerMilestone`); absent when none (a failed or last one). */
  strikes?: number;
  /**
   * The last milestone only, when it's met (D-145): the budget held after its payout, and the
   * Wow that paid, at `leftoverBudgetWow` each. It's in the milestone's score, not in `score`
   * above (the early bonus).
   */
  leftover?: { budget: number; score: number };
}

export interface MilestoneRecord {
  phase: number;
  result: MilestoneResult;
  target: number;
  /** The score when it resolved, after any reward. */
  score: number;
  weeksSaved: number;
  overtimeUsed: number;
  reward: MilestoneReward;
}

export interface RunState {
  setup: RunSetup;
  house: HouseState;
  /** 0-based milestone index. */
  phase: number;
  /** 1-based week within the phase. Overtime weeks carry on past the phase's last week. */
  slot: number;
  /** 0 in a regular week; k in the phase's k-th overtime week (D-041). */
  overtimeWeek: number;
  /** 1-based week of the run: the week being played, or the last one played once the run ends. */
  week: number;
  /** Draws so far this week (keys the RNG). */
  draws: number;
  /** D-028: one running total of Wow. */
  score: number;
  phaseStartScore: number;
  /** Accrues from economy pieces, milestones, early completion, and the skip reward; spent in the shop. */
  budget: number;
  /** Every budget earned this run (not refunds from selling), for the end screen. */
  budgetEarned: number;
  hand: readonly Card[];
  /** Bought pieces (`reserveSlots`, 2) wait here; placing one is the week's turn. */
  reserve: readonly ReservePiece[];
  /** Bought fixtures (`supplySlots`, 3), installed as free actions. */
  supplies: readonly Supply[];
  /** Run-long rule benders (`blueprintSlots`, 4), no duplicates. */
  blueprints: readonly OwnedBlueprint[];
  /** Company upgrades, permanent for the run, no duplicates. */
  upgrades: readonly UpgradeId[];
  /** Each set type's level, from Remodel Plans; 1 when absent. */
  setLevels: Partial<Record<SetId, number>>;
  /** Tools' effects for this week's tally. */
  timedEffects: readonly TimedEffect[];
  /** Weekend Crew (D-075): 'ready' once used this week, 'used' after its free play. */
  freePlay: 'none' | 'ready' | 'used';
  /** How many of each service have been bought: their prices rise per purchase. */
  servicesBought: Readonly<Record<ServiceId, number>>;
  /** Card types struck from the draws (D-076, D-157): never drawn again this run. */
  struck: readonly CardType[];
  /**
   * D-157: strikes to use from the hand: the `strikes` rule at the start, `strikesPerMilestone`
   * at each milestone the run goes on from, and each one bought. Kept from phase to phase.
   */
  strikesLeft: number;
  /** Reset to the `rerollsPerPhase` rule at each phase start; not carried over. */
  rerollsLeft: number;
  /** Bought from the shop; spent after `rerollsLeft`, and never expire. */
  bonusRerolls: number;
  demolitionsLeft: number;
  overtimeLeft: number;
  /** Cards swapped in this week because the ones they replaced had no play (D-121). */
  swapped: readonly SwappedCard[];
  /** D-040: complete each milestone as soon as its target is met. Starts off. */
  autoComplete: boolean;
  /** A run stat for scaling ×Mult (Ahead of Schedule, M3). */
  milestonesEarly: number;
  /** Each milestone resolved so far, in order. */
  milestones: readonly MilestoneRecord[];
  lastTally: WeekSummary | null;
  /**
   * The shop opens after milestones 1–6 (D-051). After milestones 2, 4, and 6 two change
   * orders come first (M4b, D-144): their screen waits for one to be picked, then the shop
   * opens.
   */
  screen: 'build' | 'changeOrder' | 'shop' | 'won' | 'lost';
  offers?: { shop?: ShopVisit; pick?: CratePick; changeOrder?: ChangeOrderOffer };
  /** M4b: every change order picked this run, in order, with how it went. */
  changeOrders: readonly ChangeOrderRecord[];
  /** M4b: the household members who've arrived (D-103), in order. */
  arrived: readonly ArrivalId[];
  /** D-163: the standing stock has come (without `refill`, it comes once). */
  stocked?: true;
  /** Set by the ?debug panel's cheats: this phase's regular end counts as a miss. */
  forcedMiss?: number;
  /** Set once any debug action has changed the run. */
  debug?: true;
}

// ---------------------------------------------------------------------------------------
// Actions, plays, and events.

export interface PlaceAction {
  t: 'place';
  /** A card from the hand, or a bought piece waiting in the reserve. Either is the week's turn. */
  from: 'hand' | 'reserve';
  i: number;
  x: number;
  y: number;
  rot: Rot;
  /**
   * A pack card's tiles (D-106): ASCII rows, '#' filled, with a tile in the first row and the
   * first column; (x, y) is its top-left corner and `rot` is 0. Only pack cards take one.
   */
  shape?: readonly string[];
}
/**
 * A fixture into a placed piece (D-050). From the hand it's the week's turn; from the supplies
 * it's a free action. A piece holds one fixture: a new one replaces the old.
 */
export interface InstallAction {
  t: 'install';
  from: 'hand' | 'supplies';
  i: number;
  uid: number;
}
/**
 * Renovate (M4a): a room card whose type is at its limit, played on a room of that type, which
 * gains a level. It's the week's turn, like placing.
 */
export interface RenovateAction {
  t: 'renovate';
  from: 'hand' | 'reserve';
  i: number;
  uid: number;
}
/**
 * D-168, Extend a room: a room card laid beside a room of its type, sharing wall with it, joins
 * that room: its tiles become the room's, which stays one piece (its uid, fixture, timers and
 * place in the placement order) with a bigger outline. (x, y, rot) place the card's own shape,
 * as a placement's would. It's the week's turn, like placing.
 */
export interface ExtendAction {
  t: 'extend';
  from: 'hand' | 'reserve';
  i: number;
  /** The room that grows. */
  uid: number;
  x: number;
  y: number;
  rot: Rot;
}
export type PassAction = { t: 'pass' };
/** Free actions: they don't end the week. */
/** Redraws the whole hand, both rows (D-132; D-121 had a reroll per row). */
export type RerollAction = { t: 'reroll' };
/**
 * D-157: strikes hand card i. Its type (a piece's root type, or a fixture) is never drawn
 * again this run; it and any other hand card of that type leave at once, and each slot takes
 * a card from its row. A free action that uses one of `strikesLeft`.
 */
export type StrikeCardAction = { t: 'strikeCard'; i: number };
export type DemolishAction = { t: 'demolish'; x: number; y: number };
export type CompleteEarlyAction = { t: 'completeEarly' };
export type SetAutoCompleteAction = { t: 'setAutoComplete'; on: boolean };
/** Sells a blueprint or a supply for half its price, on the build and shop screens. */
export type SellAction = { t: 'sell'; from: 'blueprints' | 'supplies'; i: number };
/**
 * The shop's actions. The strike service is +1 strike (D-157). `strike` is a run code's from
 * before it, when the service named a card type (D-076): it still replays that way.
 */
export type BuyAction = { t: 'buy'; i: number; strike?: CardType };
export type RefreshShopAction = { t: 'refreshShop' };
/** Keeps one of an opened crate's options; -1 discards the crate. */
export type PickAction = { t: 'pick'; i: number };
/**
 * Uses a supply tool, a free action on the build screen. The Moving Truck needs a piece and
 * a spot; the Copy Machine a piece.
 */
export type UseToolAction = {
  t: 'useTool';
  i: number;
  target?: { uid: number; x?: number; y?: number; rot?: Rot };
};
export type LeaveShopAction = { t: 'leaveShop' };
/**
 * M4b, D-144: the answer on the 'changeOrder' screen: which of the offer's orders is picked
 * (its index in `offers.changeOrder.ids`). One must be; the others go back in the pool.
 */
export type AnswerChangeOrderAction = { t: 'answerChangeOrder'; i: number };
/**
 * The ?debug panel's cheats. They are actions so that a run code still replays exactly, and
 * any of them marks the run as a debug run.
 */
export type DebugAction =
  | { t: 'debug'; op: 'addScore'; amount: number }
  | { t: 'debug'; op: 'addBudget'; amount: number }
  | { t: 'debug'; op: 'giveCard'; id: PieceId }
  /** This phase's regular end counts as a miss, so overtime (or the loss) can be tried. */
  | { t: 'debug'; op: 'forceMiss' }
  /** Opens the shop now, as if the milestone had just been met (the week's hand is set aside). */
  | { t: 'debug'; op: 'forceShop' }
  /** Puts a good where buying it would: a blueprint, a reserve piece, a supply, or a hand card. */
  | { t: 'debug'; op: 'giveGood'; good: Good }
  /**
   * M4b: offers this change order now, from the build screen, as if a milestone had just been
   * met: it runs through the current phase, and answering it goes back to the same week, hand
   * and all. Any change order, even one already picked. Alone, or (D-144) beside `other`, to
   * pick one of the two.
   */
  | { t: 'debug'; op: 'forceChangeOrder'; id: ChangeOrderId; other?: ChangeOrderId }
  /** M4b: this household member arrives now: their cards go into the reserve's extra slots. */
  | { t: 'debug'; op: 'forceArrival'; id: ArrivalId };

/** A good the debug panel can give: where it goes is where buying it would put it. */
export type Good =
  | { kind: 'blueprint'; id: BlueprintId }
  | { kind: 'piece'; id: PieceId }
  | { kind: 'fixture'; id: FixtureId }
  | { kind: 'tool'; id: ToolId }
  | { kind: 'upgrade'; id: UpgradeId }
  /** A fixture card in the hand, so a hand install can be tried. */
  | { kind: 'fixtureCard'; id: FixtureId };

export type Action =
  | PlaceAction
  | InstallAction
  | RenovateAction
  | ExtendAction
  | PassAction
  | RerollAction
  | StrikeCardAction
  | DemolishAction
  | CompleteEarlyAction
  | SetAutoCompleteAction
  | SellAction
  | BuyAction
  | RefreshShopAction
  | LeaveShopAction
  | PickAction
  | UseToolAction
  | AnswerChangeOrderAction
  | DebugAction;

/**
 * A week's play: a placement, an install, a Renovation, an extension (D-168), or nothing (a
 * pass). Previews take supply installs too.
 */
export type Play = PlaceAction | InstallAction | RenovateAction | ExtendAction | null;

/** What caused a breakdown line, so the UI can badge it. */
export type SourceRef =
  | { kind: 'piece'; uid: number }
  | { kind: 'terrain'; feature: TerrainId; x: number; y: number }
  | { kind: 'street'; x: number };

/** Where a modifier came from, for breakdown labels and the ×Mult order. */
export type ModSource =
  | { kind: 'crew'; id: CrewId }
  /** The client's tastes and pool. */
  | { kind: 'client'; id: ClientId }
  | { kind: 'blueprint'; id: BlueprintId }
  | { kind: 'fixture'; id: FixtureId; uid: number }
  | { kind: 'upgrade'; id: UpgradeId }
  | { kind: 'tool'; id: ToolId }
  /** M4b: a phase effect (Heat wave) while it runs. */
  | { kind: 'changeOrder'; id: ChangeOrderId }
  /** D-119: a trait of the lot (Creekside), all run. */
  | { kind: 'lot'; id: LotTraitId }
  /** D-165: a house rule that pays on the rooms (Cozy), in every run. */
  | { kind: 'house'; id: RoomRuleId };

export interface BreakdownLine {
  /** Plain language: "Touching Trees or Quiet neighbors (2)". */
  label: string;
  /** `add`: flat points. `pct`: a percentage term. `budget`: budget this week. `none`: earns nothing. */
  op: 'add' | 'pct' | 'budget' | 'none';
  value: number;
  from: readonly SourceRef[];
  /** D-165: the house rule that pays it (Cozy), so Inspect can say the rule. */
  rule?: RoomRuleId;
}

export interface PieceScore {
  uid: number;
  defId: PieceId;
  /** The flat sum, before clamping at 0. */
  points: number;
  /** The sum of percentage terms. */
  pct: number;
  earned: number;
  /** Budget it pays this week. */
  budget: number;
  /** An unmet requirement, as text: the piece earns nothing (a warning icon). */
  unmet?: string;
  /** Empty from scoreOnly(). */
  lines: readonly BreakdownLine[];
}

export interface SetScore {
  set: SetId;
  /** `<setId>:<member uids>`, stable while the instance holds. */
  key: string;
  members: readonly number[];
  points: number;
  mult: number;
}

/**
 * How far the house is toward a set whose members needn't touch (Full House), for a card's set
 * chip and Inspect (D-153): `Rules.setProgress`.
 */
export interface SetProgress {
  set: SetId;
  /**
   * The members the house has toward one, each type counted up to what the set needs: for Full
   * House, the member types built.
   */
  have: number;
  /** The members one needs: 9 for Full House. */
  need: number;
  /** The member types still short, one entry for each member missing, in the set's order. */
  missing: readonly PieceId[];
  /** Whether the house holds one now. */
  held: boolean;
}

/** A +Mult term from a modifier (It's a House, Rush Order), in hundredths. */
export interface MultTerm {
  source: ModSource;
  label: string;
  add: number;
}

/** A ×Mult source that landed this week, in the fixed order: sets, fixtures, blueprints, tools. */
export interface XMultTerm {
  source: ModSource | { kind: 'set'; id: SetId };
  label: string;
  /** In hundredths: 125 is ×1.25. */
  times: number;
  /** Mult before and after this source multiplied it. */
  before: number;
  after: number;
}

/** One checklist line's result in a tally. */
export interface SpecScore {
  id: string;
  met: boolean;
}

export interface Tally extends WeekScore {
  pieces: readonly PieceScore[];
  sets: readonly SetScore[];
  /** The client's checklist, in order: each spec met adds `specBonus` to the Mult, after sets. */
  specs: readonly SpecScore[];
  /** What each spec met adds this week, in hundredths (the `specBonus` rule). */
  specBonus: number;
  /** +Mult from modifiers, after specs. */
  multTerms: readonly MultTerm[];
  /** ×Mult sources, each once, in order (D-056). */
  xMults: readonly XMultTerm[];
  /** Crown Jewel's piece, if any: its earnings before and after the bonus. */
  best: { uid: number; pct: number; before: number; after: number } | null;
  /** Budget from economy pieces this week. */
  budget: number;
}

/** D-157: a hand slot a strike emptied, and the card from its row that took its place. */
export interface StruckSlot {
  i: number;
  was: Card;
  card: Card;
}

export type GameEvent =
  /**
   * D-157: a strike from the hand. `i` is the card picked; `slots` are every hand card of its
   * type that left (that one among them), in hand order, each with the card that took its place.
   */
  | {
      t: 'cardStruck';
      i: number;
      type: CardType;
      slots: readonly StruckSlot[];
      strikesLeft: number;
    }
  | {
      t: 'handDrawn';
      phase: number;
      slot: number;
      overtimeWeek: number;
      hand: readonly Card[];
      /** Cards were swapped (D-121): `hand` is after the swaps, and `swapped` says what went. */
      free: boolean;
      /** A manual reroll: both rows (D-132). */
      reroll: boolean;
      /** With `free`, the cards swapped in and what each replaced, which had no play. */
      swapped?: readonly SwappedCard[];
      /** The Catalog's redraw from special pieces and fixtures. */
      special?: true;
    }
  | {
      t: 'placed';
      uid: number;
      defId: PieceId;
      x: number;
      y: number;
      rot: Rot;
      cells: readonly Cell[];
      clearedTrees: readonly Cell[];
      /** Weekend Crew's free play: the week goes on. */
      free?: true;
    }
  | {
      t: 'moved';
      uid: number;
      defId: PieceId;
      from: readonly Cell[];
      cells: readonly Cell[];
      clearedTrees: readonly Cell[];
    }
  | {
      t: 'toolUsed';
      tool: ToolId;
      /** The piece it acted on (the Moving Truck's, the Copy Machine's). */
      uid?: number;
    }
  | {
      t: 'findClaimed';
      feature: TerrainId;
      x: number;
      y: number;
      /** What it paid: the random tool resolved, and whether it was sold for want of a slot. */
      reward: Reward & { tool?: ToolId };
      soldTool?: number;
    }
  | { t: 'crateOpened'; source: CratePick['source']; options: readonly PickOption[] }
  | { t: 'picked'; source: CratePick['source']; option: PickOption | null }
  | {
      t: 'demolished';
      /** The piece removed, or the lot feature cleared. */
      uid?: number;
      defId?: PieceId;
      feature?: TerrainId;
      cells: readonly Cell[];
      demolitionsLeft: number;
    }
  | {
      t: 'transformed';
      uid: number;
      defId: PieceId;
      into: { piece: PieceId } | { feature: 'tree' };
      cells: readonly Cell[];
    }
  | {
      t: 'tally';
      week: number;
      phase: number;
      slot: number;
      overtimeWeek: number;
      passed: boolean;
      /** A week skipped by early completion: pieces earn, timers tick, nothing is placed. */
      fastForward: boolean;
      tally: Tally;
      /** §12: max(1, (target − score at the phase start) ÷ weeks per phase), fixed for the phase. */
      pace: number;
      scoreBefore: number;
      score: number;
      budgetBefore: number;
      budget: number;
    }
  | { t: 'setCompleted'; set: SetId; key: string; members: readonly number[] }
  /** A checklist line held this week that didn't last week (after the tally), or lost one. */
  | { t: 'specMet'; id: string; index: number }
  | { t: 'specLost'; id: string; index: number }
  | {
      t: 'renovated';
      uid: number;
      defId: PieceId;
      /** The room's level now. */
      level: number;
      /** The card's type, which may differ from the room's (a Bedroom card on a member's room). */
      card: PieceId;
      /** Weekend Crew's free play: the week goes on. */
      free?: true;
    }
  | {
      t: 'extended';
      uid: number;
      defId: PieceId;
      /** The card's type, which may differ from the room's (a Bedroom card on a member's room). */
      card: PieceId;
      /** The tiles that joined the room. */
      cells: readonly Cell[];
      clearedTrees: readonly Cell[];
      /** Weekend Crew's free play: the week goes on. */
      free?: true;
    }
  | { t: 'targetReached'; phase: number; target: number; score: number }
  | { t: 'overtimeUsed'; phase: number; overtimeLeft: number; target: number; score: number }
  | {
      t: 'milestone';
      phase: number;
      name: string;
      result: MilestoneResult;
      target: number;
      /** The score after the reward. */
      score: number;
      weeksSaved: number;
      overtimeUsed: number;
      reward: MilestoneReward;
    }
  | { t: 'runEnded'; result: 'won' | 'lost'; score: number; phase: number; verdict: string }
  | {
      t: 'installed';
      uid: number;
      fixture: FixtureId;
      from: 'hand' | 'supplies';
      /** The fixture it replaced, which is gone. */
      replaced?: FixtureId;
      /** Weekend Crew's free play: the week goes on. */
      free?: true;
    }
  | { t: 'shopOpened'; number: number; offers: readonly ShopOffer[]; sale: number | null }
  | {
      t: 'bought';
      i: number;
      offer: ShopOffer;
      price: number;
      budgetBefore: number;
      budget: number;
      /** A run code's strike from before D-157: the card type the service named. */
      strike?: CardType;
    }
  | {
      t: 'sold';
      from: 'blueprints' | 'supplies';
      item: OwnedBlueprint['id'] | Supply['id'];
      price: number;
      budgetBefore: number;
      budget: number;
    }
  | {
      t: 'shopRefreshed';
      refreshes: number;
      price: number;
      budget: number;
      offers: readonly ShopOffer[];
      sale: number | null;
    }
  | { t: 'shopClosed'; number: number; skipReward: number; budgetBefore: number; budget: number }
  /**
   * M4b: a household member arrived (D-103), at the start of their phase's first week (after
   * transforms, before the draw): their cards went into the reserve's extra slots.
   */
  | { t: 'arrived'; arrival: ArrivalId; phase: number; cards: readonly PieceId[]; forced?: true }
  /**
   * D-160: cards went into the reserve's extra slots at the start of a week, after any arrival
   * and before the draw: what the client brought ('client'), or the standing stock's top-up.
   */
  | { t: 'delivered'; from: 'client' | 'stock'; phase: number; cards: readonly PieceId[] }
  /**
   * M4b, D-144: change orders are offered, two as a rule; the 'changeOrder' screen waits for
   * one to be picked.
   */
  | {
      t: 'changeOrderOffered';
      /** The orders to pick from, in the order shown. */
      options: readonly { id: ChangeOrderId; kind: ChangeOrderKind }[];
      /** The phase the pick would run through. */
      phase: number;
      forced?: true;
    }
  /** The order picked (the offer's `i`-th), and the ones passed over, which can come again. */
  | {
      t: 'changeOrderAnswered';
      id: ChangeOrderId;
      kind: ChangeOrderKind;
      i: number;
      passedOver: readonly ChangeOrderId[];
    }
  /** A piece the restriction forbids was placed while it ran: it pays nothing now. */
  | { t: 'changeOrderBroken'; id: ChangeOrderId; uid: number }
  /**
   * At its phase's milestone (when it's met): a request met or missed, a restriction kept or
   * broken, or a phase effect over. `reward` is what it paid.
   */
  | {
      t: 'changeOrderResolved';
      id: ChangeOrderId;
      kind: ChangeOrderKind;
      result: ChangeOrderResult;
      reward?: Reward;
    };

export interface PreviewLine {
  uid: number;
  defId: PieceId;
  isNew: boolean;
  before: number;
  after: number;
  /** The piece's breakdown with the play. */
  reasons: readonly BreakdownLine[];
}

/** D-122: what kind of cause a part of a play's change to the week's Wow is. */
export type WowPartKind = 'piece' | 'neighbor' | 'set' | 'spec' | 'charm' | 'sparkle' | 'other';

/**
 * D-122: one cause of a play's change to the week's Wow (attribution.ts). The rules attribute it;
 * the board names it. A play's parts add up to its `delta` exactly.
 */
export interface WowPart {
  kind: WowPartKind;
  /**
   * Short, for the board's label: the piece's name ("Closet"), "Living Room earns less", a set
   * ("Suite", "Breaks Suite"), a checklist line ("Room for everyone", "Cozy off"), a +Mult
   * modifier's label, a ×Mult source or "Sparkle", or "Other changes".
   */
  label: string;
  /** Its share of the change to the week's Wow. */
  wow: number;
  /** The piece, for a piece's own part and a neighbor's. */
  uid?: number;
}

export interface Preview {
  legal: boolean;
  reason?: string;
  before: WeekScore;
  after: WeekScore;
  /** Budget this week, before and after. */
  budgetBefore: number;
  budgetAfter: number;
  /** The change to the week's total. */
  delta: number;
  /** Every piece whose earnings change, the new piece first. */
  lines: readonly PreviewLine[];
  /** The new piece's own breakdown, with the neighbors that help or hurt it. */
  newPiece: PieceScore | null;
  /** A placed piece that would be Sunny (D-120), for the ghost's sun. Absent when it wouldn't. */
  sunny?: true;
  setsGained: readonly SetScore[];
  setsLost: readonly SetScore[];
  cells: readonly Cell[];
  clearedTrees: readonly Cell[];
  /** Timers a single number can't show: "Becomes a Tree at the start of week 9". */
  upcoming: readonly string[];
  /** For an install: the host, and the fixture the install would replace (and lose). */
  host?: number;
  replaces?: FixtureId;
  /** For a Renovation: the room, and the level it would reach. */
  renovates?: { uid: number; level: number };
  /** D-168: for an extension, the room that grows, and its tiles once it has. */
  extends?: { uid: number; cells: readonly Cell[] };
  /** Checklist lines the play would turn on, and off (spec ids). */
  specsGained: readonly string[];
  specsLost: readonly string[];
  /** The ×Mult sources with the play, so a Sparkle can light up before it's committed. */
  xMults: readonly XMultTerm[];
  /** Finds the play would dig up (a Time Capsule), each with what it pays. */
  finds: readonly { x: number; y: number; feature: TerrainId; reward: Reward }[];
  /**
   * M4b: the running restriction this placement would break (Big deadline and a Loud piece),
   * for a warning. The placement stays legal; the restriction just pays nothing.
   */
  breaks?: ChangeOrderId;
  /** D-122: where `delta` comes from, biggest first; empty when the play isn't legal. */
  parts: readonly WowPart[];
}

/** What demolishing at a spot would do, for the demolish tool's hover. */
export interface DemolishPreview {
  legal: boolean;
  reason?: string;
  /** What would go: a piece, or a lot feature. */
  target: { uid: number; defId: PieceId } | { feature: TerrainId } | null;
  cells: readonly Cell[];
  before: WeekScore;
  after: WeekScore;
  delta: number;
  /** Checklist lines the demolition would turn on, and off (spec ids): "loses One Kitchen". */
  specsGained: readonly string[];
  specsLost: readonly string[];
  /**
   * Sets the demolition would complete, and break: "breaks Jack-and-Jill". A set that re-forms
   * from other pieces (the same set, new members) is neither.
   */
  setsGained: readonly SetScore[];
  setsLost: readonly SetScore[];
}

/**
 * D-107: one legal host for a fixture being installed, with what installing it there does to
 * this week's total: its install preview's delta, net of the fixture it would replace.
 */
export interface InstallGain {
  uid: number;
  gain: number;
  /** The fixture the host has now, which the install would replace (and lose). */
  replaces?: FixtureId;
}

/**
 * D-107: what a fixture not yet owned (a shop offer) would add: its best host in the house as it
 * stands, and what installing it there does to this week's total (in the shop, the next week's).
 */
export interface FixtureValue {
  /** The host (by uid) whose install gains the most; the first in placement order on a tie. */
  host: number;
  /**
   * The host's piece as it's valued: in the shop, after the transforms that start the next
   * week, so a Nursery that grows into a Kids' Room then is a Kids' Room here.
   */
  hostDefId: PieceId;
  /** That install's preview delta, net of the fixture it would replace. */
  gain: number;
  /** The fixture the host has now, which installing would replace (and lose). */
  replaces?: FixtureId;
  /** Weeks still to play in the run, this one (in the shop, the next one) included. */
  weeksLeft: number;
  /** gain × weeksLeft: roughly what it adds over the rest of the run. */
  overRun: number;
}

/**
 * D-141: what a blueprint would add to the house as it stands, for the shop's line: the week's
 * total with it in play, less without. In the shop the first week valued is the next phase's
 * first, after its start-of-week transforms, as for a fixture (D-107).
 */
export interface BlueprintValue {
  /** The Wow it adds in the week `when` names. */
  gain: number;
  /**
   * The week `gain` is for: the first one valued, or, for a blueprint that acts only in a
   * phase's last week (Last-Minute Push), the next of those.
   */
  when: 'week' | 'lastWeek';
  /**
   * For a granted growth timer (Good Bones): the most it adds in any one of the weeks left.
   * Unset when it never passes `gain`.
   */
  growsTo?: number;
  /** Weeks still to play in the run, the first one valued included; never overtime. */
  weeksLeft: number;
  /**
   * Each of those weeks' gain, added up, with nothing more built: the house's timers run on,
   * and each phase's last week counts as one. Roughly what it adds over the rest of the run.
   */
  overRun: number;
  /** The budget it would pay over those weeks (Solar Panels). */
  budget: number;
  /**
   * For a ×Mult that scales with a run stat (Ahead of Schedule's early milestones): what one
   * more of it would add to `gain`. It depends on what the player does next, so it's shown
   * beside the gain, never folded into it.
   */
  perStat?: { stat: RunStat; gain: number };
  /**
   * For a Mult counted per piece (It's a House's House pieces, Model Home's pieces with a
   * fixture; D-143): what one more of them would add to a week, its own Comfort aside, and
   * what one is called ("House piece"). It names the build, so it's shown even when `needs` is.
   */
  perPiece?: { what: string; gain: number };
  /**
   * When it would add nothing in the weeks left: what it's waiting for, in a few words ("No
   * Dark rooms yet").
   */
  needs?: string;
  /** It's one of the run's blueprints already: this is what it's adding. */
  held: boolean;
}

export interface Legality {
  legal: boolean;
  reason?: string;
  cells: readonly Cell[];
  clearedTrees: readonly Cell[];
  /** Finds the piece would be built over (a Time Capsule): each pays its reward. */
  finds?: readonly Cell[];
}

export interface ReplayResult {
  state: RunState;
  /** The index of the first action that failed; the state is the one just before it. */
  failedAt?: number;
  error?: string;
}

export interface RunCodeData {
  /** The git short SHA of the build that made it (the UI passes it in). */
  build: string;
  contentHash: string;
  setup: RunSetup;
  actions: readonly Action[];
  /** A tentative placement, install, Renovation, or extension, so a preview bug can be reproduced. */
  pending?: PlaceAction | InstallAction | RenovateAction | ExtendAction;
}

/** One part of a checklist line's progress: "Bedrooms 3 (3–4)", "fill 61% (≥ 60%)". */
export interface ProgressPart {
  text: string;
  ok: boolean;
}

/** A checklist line as the UI shows it (§7 M4a): the rule, whether it holds, and its progress. */
export interface ChecklistLine {
  id: string;
  name: string;
  group: SpecGroup;
  met: boolean;
  /** The whole rule as card text, every stage included (the progress shows the current one). */
  text: string;
  progress: readonly ProgressPart[];
}

/**
 * A change order as the UI shows it (M4b): one of the offer's on the 'changeOrder' screen, or
 * one that's running (a request, a restriction, or a phase effect), with its progress.
 */
export interface ChangeOrderView {
  id: ChangeOrderId;
  name: string;
  kind: ChangeOrderKind;
  /** The order's own sentence: "Two new interior rooms." */
  text: string;
  /** The rules as generated from the data (text.ts' changeOrderText): "+100% for Pools", … */
  terms: readonly string[];
  /** What a request met or a restriction kept pays. */
  reward?: Reward;
  /** The phase it runs through (0-based): it resolves when that phase's milestone resolves. */
  phase: number;
  /**
   * On an offer, a phase effect (D-144): what it would change a week's total by, with the house
   * as it stands in the week it starts. The house will change; this is where it starts from.
   */
  houseGain?: number;
  /** Requests: whether it would count as met if the milestone resolved now. */
  met?: boolean;
  /** Requests: "1 new of 2", "0 of 1 demolished". */
  progress?: readonly ProgressPart[];
  /** Restrictions: the piece that broke it, once one did. */
  brokenBy?: number;
}

/** The 'changeOrder' screen's offer as the UI shows it (D-144): pick one of its orders. */
export interface ChangeOrderOfferView {
  /** In the order shown; `answerChangeOrder`'s `i` is an index here. */
  options: readonly ChangeOrderView[];
  /** The phase the pick runs through (0-based). */
  phase: number;
  /** Forced by the ?debug panel mid-week: answering it goes back to the same week. */
  forced: boolean;
}

/** A room type at its limit (from the checklist's ceilings): its cards can renovate instead. */
export interface TypeLimit {
  /** The types the limit counts (a Bedroom limit counts members' rooms too, M4b). */
  types: readonly PieceId[];
  max: number;
  count: number;
}

/**
 * Where a piece's effective tag comes from: its card, the layout (an interior room is Dark, a
 * building in the sun is Sunny), or a modifier that grants it (its fixture, a blueprint, or a
 * change order's phase effect, M4b), so the inspect panel can say: "Dark · from Eternal night".
 */
export type TagSource = { kind: 'card' } | { kind: 'interior' } | { kind: 'sunny' } | ModSource;

/** What the inspect panel says about a placed piece's place in the layout. */
export interface PieceInfo {
  /**
   * Effective tags: its own, plus Dark (interior) and Sunny (a building in the sun), then those
   * modifiers grant, less those they remove.
   */
  tags: readonly Tag[];
  /** Each effective tag's sources, in that order: card, layout, then each modifier granting it. */
  tagSources: Readonly<Partial<Record<Tag, readonly TagSource[]>>>;
  /** For rooms: whether it touches the outside. */
  side: 'exterior' | 'interior' | null;
  /** Regions every tile of it is in. */
  regions: readonly Region[];
  /** Its tiles in the sun (D-120), in reading order: where the board draws its light. */
  sunlit: readonly Cell[];
  view: boolean;
  /** Rooms it's linked to through Hallways. */
  linked: readonly number[];
  /** Tiles of the fenced yards it borders or sits in. */
  fencedYardTiles: number;
}

/** What the inspect panel says about a lot tile. */
export interface TileInfo {
  regions: readonly Region[];
  /** Tiles in the fenced yard this tile is in, or 0. */
  fencedYardTiles: number;
}

/** Why a free action or button is unavailable, for greying it out with a reason. */
export interface Availability {
  ok: boolean;
  reason?: string;
}

/** D-157: what striking a hand card would do, for the hand's strike mode (Rules.previewStrike). */
export interface StrikePreview extends Availability {
  /** The type it strikes: a piece's root type, or a fixture. Null with no card there. */
  type: CardType | null;
  /** The hand cards that would leave, in hand order: it, and any other of its type. */
  cards: readonly number[];
  /** "No more Garages this run", "No more Kitchens or L-Kitchens this run"; '' with no card. */
  text: string;
}

/** A shop offer as the shop screen shows it. */
export interface OfferView extends Availability {
  i: number;
  offer: ShopOffer;
  name: string;
  /** Blueprints, fixtures, and tools. */
  rarity?: Rarity;
  /** What it costs now: after the discount and the sale, or the service's current price. */
  price: number;
  /** Before the sale (the discount included), for the struck-through price. */
  fullPrice: number;
  onSale: boolean;
}

/** How many of each slot the run has, after upgrades. */
export interface Slots {
  reserve: number;
  supplies: number;
  blueprints: number;
}

// ---------------------------------------------------------------------------------------
// The API.

export type { EarlyOffer, Rules, ToolPreview } from './run.ts';
export type { Estimate } from './estimate.ts';
export { stream, type Rng } from './rng.ts';
export { createRules, IllegalAction } from './run.ts';
export { encodeRunCode, decodeRunCode, contentHash } from './runcode.ts';
export {
  cellsToShape,
  packShapeProblem,
  parseShape,
  placedCells,
  rotateCells,
  rotateShape,
  shapeCells,
  uniqueRotations,
} from './grid.ts';
export { lotBiome, lotTraits, protectedTerrain, SUN_SIDES, SUN_STEP, terrainAt } from './lot.ts';
export { DRAW_ROWS, rowOf } from './draw.ts';
export {
  article,
  blueprintText,
  cardText,
  changeOrderText,
  conditionText,
  crateText,
  definite,
  effectText,
  fixtureText,
  glossary,
  growGain,
  handCardLines,
  HINT_WORDS,
  hintText,
  houseConditionText,
  houseRuleNames,
  houseRulesText,
  lastShopText,
  lotTraitText,
  featureWantedText,
  modifierText,
  multNumber,
  regionText,
  rewardText,
  selectorText,
  setProgressText,
  setsOfPiece,
  setText,
  specText,
  stockFromText,
  stockText,
  strikeText,
  struckNames,
  struckText,
  sunSideText,
  toolText,
  upgradeText,
} from './text.ts';
export type { HintTerm, Term } from './text.ts';
export { earnedFor, roundHalfUp, weekTotal } from './scoring.ts';
export { ruleValue, sourceName } from './modifiers.ts';
export { meetsHouse, outlineOf, progressOf } from './conditions.ts';
export { jobBoard, type Contract } from './jobs.ts';
export { fitsText } from './fixtures.ts';
export { inExtraSlot, SERVICE_NAMES, SHOP_REASONS } from './shop.ts';
export { countedSelector, countingMod, totalWithOneMore } from './blueprint-value.ts';
export { matchesDef, yardsRead, type Yard } from './selectors.ts';

export { CONTENT, SCORE_LABELS } from '../content/index.ts';

/** The game's own rules, bound to the real content. Tests can build others with createRules(). */
export const rules = bindRules(CONTENT);
