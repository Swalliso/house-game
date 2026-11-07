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
// (the Old Shed and Time Capsules).
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
  | 'fence'
  | 'lFence'
  | 'driveway'
  | 'longDriveway'
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
  | 'birdhouse';

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
  'street' | 'tree' | 'pond' | 'creek' | 'boulder' | 'oldShed' | 'timeCapsule';
/** The features that sit on tiles of the lot. */
export type TerrainId = Exclude<FeatureId, 'street'>;

export type SetId = 'jackAndJill' | 'entertainer';

/** Crews (D-012). The General Contractor is the default and, until M4b, the only one. */
export type CrewId = 'generalContractor';

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
 * - sunny: the sunny side's tiles (not under a Tree)
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
  | { tag: Tag } // effective tags: own tags, plus Dark if interior and Sunny if on a sunny tile
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
  /** `amount` per tile of the piece in the region (the Herb Garden on sunny tiles). */
  | { kind: 'perTile'; region: Region; amount: number }
  /** A connector (the Hallway): every room touching it, or a group of them, counts as touching every other. */
  | { kind: 'link' }
  /**
   * The piece earns nothing (no score, no budget) unless the condition holds. With
   * `blocksPlacement`, it also can't be placed where the condition fails.
   */
  | { kind: 'requires'; condition: PieceCondition; blocksPlacement: boolean }
  /** The inner effect applies only while the condition holds (the Flower Bed in the front yard). */
  | { kind: 'conditional'; when: PieceCondition; effect: Effect };

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
  /** Lot features that give nothing as neighbors (boulders, finds). */
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
  | 'handSize'
  | 'earlyRewardPct'
  // The shop's goods (M3).
  | 'reserveSlots'
  | 'supplySlots'
  | 'blueprintSlots'
  | 'shopPricePct'
  | 'specBonus'
  | 'interestMax';

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
  /** +Mult, optionally per matching piece (It's a House). */
  | { kind: 'mult'; add: number; per?: Selector }
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
  /** Clients and crews only, so weights stay fixed for the run (D-043). */
  | { kind: 'drawWeight'; target: Selector; add?: number; pct?: number }
  | { kind: 'rule'; key: RuleKey; add?: number; pct?: number };

export interface CrewDef {
  id: CrewId;
  name: string;
  tier: Tier;
  blurb: string;
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
  /** Paid every week the set holds, like a poker hand's chips and mult. Mult is in hundredths. */
  points: number;
  mult: number;
  /** Added per level from Remodel Plans (M3b). Every set is level 1 until then. */
  level: { points: number; mult: number };
}

export interface FixtureDef {
  id: FixtureId;
  name: string;
  tier: Tier;
  rarity: Rarity;
  /** Which placed pieces can host it, checked when it's installed. */
  fits: Selector;
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
  /** The creek stays at least this many rows clear of the street edge. */
  creekStreetGap: number;
  pondSize: Range;
  boulders: Range;
  sunnyRows: number;
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
  shop: ShopBalance;
  /** The fewest tiles a fenced yard needs (§4). */
  fencedYardMin: number;
  /** D-055: draw-weight percentages by phase (the last row repeats), for complexity 1, 2, and 3. */
  complexityPct: readonly (readonly [number, number, number])[];
  /** Run-end verdicts by score band, lowest first (§12, The score's names). */
  verdicts: readonly VerdictDef[];
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
  /** D-076: a strike can't leave fewer drawable card types than this. */
  strikeMinTypes: number;
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
  fixtures: Readonly<Record<FixtureId, FixtureDef>>;
  blueprints: Readonly<Record<BlueprintId, BlueprintDef>>;
  tools: Readonly<Record<ToolId, ToolDef>>;
  upgrades: Readonly<Record<UpgradeId, UpgradeDef>>;
  crates: Readonly<Record<CrateId, CrateDef>>;
  balance: Balance;
}

// ---------------------------------------------------------------------------------------
// State. Plain, JSON-serializable data. D-025 keeps the house separate from the run.

export interface Lot {
  width: number;
  height: number;
  /** Row-major, width × height: what sits on each tile. The street is outside the grid. */
  terrain: readonly (TerrainId | null)[];
  /** The sunny side: `sunnyRows` rows along this edge, except Tree tiles (used from M2). */
  sunnySide: 'top' | 'left' | 'right';
  sunnyRows: number;
  /** Which `lot/<attempt>` stream made it. */
  attempt: number;
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
}

export interface HouseState {
  lot: Lot;
  /** In placement order. */
  pieces: readonly PlacedPiece[];
  nextUid: number;
}

/** A card in the hand: a piece, or (from phase 2) a fixture. */
export type Card = { kind: 'piece'; id: PieceId } | { kind: 'fixture'; id: FixtureId };

/** A card type that can be struck from the draws (D-076): a piece type (its countsAs root) or a fixture. */
export type CardType = Card;

/** What sits in a supply slot: bought fixtures and tools, used as free actions. */
export type Supply = { kind: 'fixture'; id: FixtureId } | { kind: 'tool'; id: ToolId };

export interface ReservePiece {
  id: PieceId;
  /** A crew's starting piece, in an extra slot that doesn't count against the reserve (M4b). */
  crew?: true;
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

/** A tool's effect that lasts until the end of a week (Rush Order). */
export interface TimedEffect {
  source: ToolId;
  until: { week: number };
  modifiers: readonly Modifier[];
}

export interface RunSetup {
  seed: string;
  crewId: CrewId;
  mode: 'standard';
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
}

export type MilestoneResult = 'onTime' | 'early' | 'overtime' | 'failed';

/** What the milestone paid: the milestone's budget, plus the early bonus and interest if any. */
export interface MilestoneReward {
  budget: number;
  score: number;
  /** Savings Account interest, included in `budget`. */
  interest: number;
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
  /** Card types struck from the draws (D-076): never drawn again this run. */
  struck: readonly CardType[];
  /** Reset to the `rerollsPerPhase` rule at each phase start; not carried over. */
  rerollsLeft: number;
  /** Bought from the shop; spent after `rerollsLeft`, and never expire. */
  bonusRerolls: number;
  demolitionsLeft: number;
  overtimeLeft: number;
  /** Whether this week's free redraw (none of the first hand fit) was used. */
  freeRedrawUsed: boolean;
  /** D-040: complete each milestone as soon as its target is met. Starts off. */
  autoComplete: boolean;
  /** A run stat for scaling ×Mult (Ahead of Schedule, M3). */
  milestonesEarly: number;
  /** Each milestone resolved so far, in order. */
  milestones: readonly MilestoneRecord[];
  lastTally: WeekSummary | null;
  /** The shop opens after milestones 1–6 (D-051). */
  screen: 'build' | 'shop' | 'won' | 'lost';
  offers?: { shop?: ShopVisit; pick?: CratePick };
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
export type PassAction = { t: 'pass' };
/** Free actions: they don't end the week. */
export type RerollAction = { t: 'reroll' };
export type DemolishAction = { t: 'demolish'; x: number; y: number };
export type CompleteEarlyAction = { t: 'completeEarly' };
export type SetAutoCompleteAction = { t: 'setAutoComplete'; on: boolean };
/** Sells a blueprint or a supply for half its price, on the build and shop screens. */
export type SellAction = { t: 'sell'; from: 'blueprints' | 'supplies'; i: number };
/** The shop's actions. `strike` names the card type for the strike service (D-076). */
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
  | { t: 'debug'; op: 'giveGood'; good: Good };

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
  | PassAction
  | RerollAction
  | DemolishAction
  | CompleteEarlyAction
  | SetAutoCompleteAction
  | SellAction
  | BuyAction
  | RefreshShopAction
  | LeaveShopAction
  | PickAction
  | UseToolAction
  | DebugAction;

/** A week's play: a placement, an install, or nothing (a pass). Previews take supply installs too. */
export type Play = PlaceAction | InstallAction | null;

/** What caused a breakdown line, so the UI can badge it. */
export type SourceRef =
  | { kind: 'piece'; uid: number }
  | { kind: 'terrain'; feature: TerrainId; x: number; y: number }
  | { kind: 'street'; x: number };

/** Where a modifier came from, for breakdown labels and the ×Mult order. */
export type ModSource =
  | { kind: 'crew'; id: CrewId }
  | { kind: 'blueprint'; id: BlueprintId }
  | { kind: 'fixture'; id: FixtureId; uid: number }
  | { kind: 'upgrade'; id: UpgradeId }
  | { kind: 'tool'; id: ToolId };

export interface BreakdownLine {
  /** Plain language: "Touching Trees or Quiet neighbors (2)". */
  label: string;
  /** `add`: flat points. `pct`: a percentage term. `budget`: budget this week. `none`: earns nothing. */
  op: 'add' | 'pct' | 'budget' | 'none';
  value: number;
  from: readonly SourceRef[];
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

export interface Tally extends WeekScore {
  pieces: readonly PieceScore[];
  sets: readonly SetScore[];
  /** +Mult from modifiers, after sets. */
  multTerms: readonly MultTerm[];
  /** ×Mult sources, each once, in order (D-056). */
  xMults: readonly XMultTerm[];
  /** Crown Jewel's piece, if any: its earnings before and after the bonus. */
  best: { uid: number; pct: number; before: number; after: number } | null;
  /** Budget from economy pieces this week. */
  budget: number;
}

export type GameEvent =
  | {
      t: 'handDrawn';
      phase: number;
      slot: number;
      overtimeWeek: number;
      hand: readonly Card[];
      /** The free redraw: none of the week's first hand fit anywhere. */
      free: boolean;
      /** A manual reroll. */
      reroll: boolean;
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
      /** The strike service's card type. */
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
  | { t: 'shopClosed'; number: number; skipReward: number; budgetBefore: number; budget: number };

export interface PreviewLine {
  uid: number;
  defId: PieceId;
  isNew: boolean;
  before: number;
  after: number;
  /** The piece's breakdown with the play. */
  reasons: readonly BreakdownLine[];
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
  setsGained: readonly SetScore[];
  setsLost: readonly SetScore[];
  cells: readonly Cell[];
  clearedTrees: readonly Cell[];
  /** Timers a single number can't show: "Becomes a Tree at the start of week 9". */
  upcoming: readonly string[];
  /** For an install: the host, and the fixture the install would replace (and lose). */
  host?: number;
  replaces?: FixtureId;
  /** The ×Mult sources with the play, so a Sparkle can light up before it's committed. */
  xMults: readonly XMultTerm[];
  /** Finds the play would dig up (a Time Capsule), each with what it pays. */
  finds: readonly { x: number; y: number; feature: TerrainId; reward: Reward }[];
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
  /** A tentative placement or install, so a preview bug can be reproduced. */
  pending?: PlaceAction | InstallAction;
}

/** What the inspect panel says about a placed piece's place in the layout. */
export interface PieceInfo {
  /** Effective tags: its own, plus Dark (interior) and Sunny (on a sunny tile). */
  tags: readonly Tag[];
  /** For rooms: whether it touches the outside. */
  side: 'exterior' | 'interior' | null;
  /** Regions every tile of it is in. */
  regions: readonly Region[];
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
export { shapeCells, placedCells, uniqueRotations, rotateCells, parseShape } from './grid.ts';
export { isSunny, terrainAt } from './lot.ts';
export {
  blueprintText,
  cardText,
  conditionText,
  crateText,
  effectText,
  fixtureText,
  glossary,
  modifierText,
  multNumber,
  regionText,
  rewardText,
  selectorText,
  toolText,
  upgradeText,
} from './text.ts';
export type { Term } from './text.ts';
export { earnedFor, roundHalfUp, weekTotal } from './scoring.ts';
export { ruleValue } from './modifiers.ts';
export { fitsText } from './fixtures.ts';
export { SHOP_REASONS } from './shop.ts';

export { CONTENT, SCORE_LABELS } from '../content/index.ts';

/** The game's own rules, bound to the real content. Tests can build others with createRules(). */
export const rules = bindRules(CONTENT);
