// The public API of the pure rules module and all its shared types: src/ui and sim/ import
// only from here (implementation-plan.md §4). Each phase writes out the types it adds. M1
// covered the vertical slice: the lot, placement, steady/neighbor/aura effects, two sets,
// Points × Mult scoring, hands, and run codes. M2 adds the full run (7 milestones, overtime,
// early completion with fast-forward, rerolls, demolitions, the free redraw, the forecast),
// every layout property, the remaining effect kinds, the base-pool pieces, and crews' `rule`
// modifiers (for the General Contractor).
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
  | 'greenhouse';

/** Lot features (D-049). The street runs along the bottom edge, outside the grid. */
export type FeatureId = 'street' | 'tree' | 'pond' | 'creek' | 'boulder';
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
  /** Changes what each touching piece that matches earns: `pct` to its percentage, `amount` to its flat points. */
  | { kind: 'aura'; match: Selector; scope: 'adjacent'; pct?: number; amount?: number }
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
  /** Lot features that give nothing as neighbors (boulders). */
  inert?: true;
}

/** The run-level numbers that modifiers can change (§5). Later phases add the shop's keys. */
export type RuleKey =
  'rerollsPerPhase' | 'demolitions' | 'overtime' | 'handSize' | 'earlyRewardPct';

/**
 * Run-level rule benders (§5). M2 has only `rule`, for crews. Values combine as
 * (base + Σ add) × (100 + Σ pct) / 100, rounded half up.
 */
export type Modifier = { kind: 'rule'; key: RuleKey; add?: number; pct?: number };

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
  /** Budget paid at each milestone met (spending arrives with the shop in M3). */
  milestoneBudget: number;
  /** The fewest tiles a fenced yard needs (§4). */
  fencedYardMin: number;
  /** D-055: draw-weight percentages by phase (the last row repeats), for complexity 1, 2, and 3. */
  complexityPct: readonly (readonly [number, number, number])[];
  /** Run-end verdicts by score band, lowest first (§12, The score's names). */
  verdicts: readonly VerdictDef[];
}

export interface Content {
  pieces: Readonly<Record<PieceId, PieceDef>>;
  features: Readonly<Record<FeatureId, FeatureDef>>;
  sets: Readonly<Record<SetId, SetDef>>;
  crews: Readonly<Record<CrewId, CrewDef>>;
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
}

export interface HouseState {
  lot: Lot;
  /** In placement order. */
  pieces: readonly PlacedPiece[];
  nextUid: number;
}

export type Card = { kind: 'piece'; id: PieceId };

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

/** What the milestone paid: the milestone's budget, plus the early bonus if any. */
export interface MilestoneReward {
  budget: number;
  score: number;
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
  /** Accrues from economy pieces and milestones; spent in the shop from M3. */
  budget: number;
  hand: readonly Card[];
  /** Reset to the `rerollsPerPhase` rule at each phase start; not carried over. */
  rerollsLeft: number;
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
  screen: 'build' | 'won' | 'lost';
  /** Set by the ?debug panel's cheats: this phase's regular end counts as a miss. */
  forcedMiss?: number;
  /** Set once any debug action has changed the run. */
  debug?: true;
}

// ---------------------------------------------------------------------------------------
// Actions, plays, and events.

export interface PlaceAction {
  t: 'place';
  from: 'hand';
  i: number;
  x: number;
  y: number;
  rot: Rot;
}
export type PassAction = { t: 'pass' };
/** Free actions: they don't end the week. */
export type RerollAction = { t: 'reroll' };
export type DemolishAction = { t: 'demolish'; x: number; y: number };
export type CompleteEarlyAction = { t: 'completeEarly' };
export type SetAutoCompleteAction = { t: 'setAutoComplete'; on: boolean };
/**
 * The ?debug panel's cheats. They are actions so that a run code still replays exactly, and
 * any of them marks the run as a debug run.
 */
export type DebugAction =
  | { t: 'debug'; op: 'addScore'; amount: number }
  | { t: 'debug'; op: 'addBudget'; amount: number }
  | { t: 'debug'; op: 'giveCard'; id: PieceId }
  /** This phase's regular end counts as a miss, so overtime (or the loss) can be tried. */
  | { t: 'debug'; op: 'forceMiss' };

export type Action =
  | PlaceAction
  | PassAction
  | RerollAction
  | DemolishAction
  | CompleteEarlyAction
  | SetAutoCompleteAction
  | DebugAction;

/** A week's play: a placement, or nothing (a pass). */
export type Play = PlaceAction | null;

/** What caused a breakdown line, so the UI can badge it. */
export type SourceRef =
  | { kind: 'piece'; uid: number }
  | { kind: 'terrain'; feature: TerrainId; x: number; y: number }
  | { kind: 'street'; x: number };

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

export interface Tally extends WeekScore {
  pieces: readonly PieceScore[];
  sets: readonly SetScore[];
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
    }
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
  | { t: 'runEnded'; result: 'won' | 'lost'; score: number; phase: number; verdict: string };

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
  /** A tentative placement, so a preview bug can be reproduced. */
  pending?: PlaceAction;
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

// ---------------------------------------------------------------------------------------
// The API.

export type { EarlyOffer, Rules } from './run.ts';
export type { Estimate } from './estimate.ts';
export { stream, type Rng } from './rng.ts';
export { createRules, IllegalAction } from './run.ts';
export { encodeRunCode, decodeRunCode, contentHash } from './runcode.ts';
export { shapeCells, placedCells, uniqueRotations, rotateCells, parseShape } from './grid.ts';
export { isSunny, terrainAt } from './lot.ts';
export { cardText, conditionText, effectText, selectorText, regionText } from './text.ts';
export { earnedFor, roundHalfUp, weekTotal } from './scoring.ts';
export { ruleValue } from './modifiers.ts';

export { CONTENT, SCORE_LABELS } from '../content/index.ts';

/** The game's own rules, bound to the real content. Tests can build others with createRules(). */
export const rules = bindRules(CONTENT);
